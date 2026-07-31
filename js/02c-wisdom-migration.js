/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom Sharding P2 — MIGRATION ENGINE
   Mevcut legacy D.wisdomQuotes (130) → users/{uid}/wisdomQuotes/{quoteId}.
   Manifest: users/{uid}/app/wisdomMigration · Meta: users/{uid}/app/wisdomMeta.
   AÇIK ÇAĞRI ile çalışır — auto-migration YOK. Doğrulanmış backup zorunlu; backup
   başarısızsa 0 write. Batch = WISDOM_BATCH_SIZE. Doküman id = quote id (wq-legacy-*
   → yeni benzersiz id). Idempotent + resume + concurrency guard. Realtime listener YOK.
   sharded=true YALNIZ üçlü kapı (meta.sharded + status completed + count/checksum eşit)
   geçince set edilir. Legacy dizi KALDIRILMAZ (P3). 02-sync/rules/backup-diff DEĞİŞMEZ.
   ══════════════════════════════════════════════════════════════════════════ */

var WISDOM_MIGRATION={
  status:'idle', // idle | in_progress | verifying | completed | failed
  total:0, migratedCount:0, lastBatchIndex:-1,
  sourceChecksum:null, targetChecksum:null,
  startedAt:null, completedAt:null, error:null
};
window.WISDOM_MIGRATION=WISDOM_MIGRATION;
var _wmRunning=false; // aynı süreçte eşzamanlı çalıştırma kilidi

function wisdomMigrationStatus(){ return JSON.parse(JSON.stringify(WISDOM_MIGRATION)); }
window.wisdomMigrationStatus=wisdomMigrationStatus;

function _wmLegacy(){ return Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]; }
function _wmMetaDoc(uid){ var u=uid||(typeof CLOUD!=='undefined'&&CLOUD.uid); if(typeof CLOUD==='undefined'||!CLOUD.db||!u)return null; return CLOUD.db.collection('users').doc(u).collection('app').doc('wisdomMeta'); }
function _wmMigDoc(uid){ var u=uid||(typeof CLOUD!=='undefined'&&CLOUD.uid); if(typeof CLOUD==='undefined'||!CLOUD.db||!u)return null; return CLOUD.db.collection('users').doc(u).collection('app').doc('wisdomMigration'); }
function _wmPersistManifest(){ var d=_wmMigDoc(); if(!d)return Promise.resolve(); try{ return d.set(wisdomMigrationStatus()).catch(function(){}); }catch(e){ return Promise.resolve(); } }

/* wq-legacy-* / eksik / boş id → yeni benzersiz id. Diğerleri korunur (idempotency için). */
function _wmFinalId(q,seen){
  var id=(q&&q.id!=null)?String(q.id):'';
  if(!id||/^wq-legacy-/.test(id)||seen[id]){ id=(typeof newWqId==='function')?newWqId():('wq'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)); }
  seen[id]=1; return id;
}

/* ── Plan (read-only): final id'li kayıtlar + kaynak SHA-256. D'yi mutasyona uğratmaz. ── */
function wisdomMigrationPlan(){
  var legacy=_wmLegacy(), seen={}, records=legacy.map(function(q){
    var copy=Object.assign({},q); copy.id=_wmFinalId(q,seen); return copy; // bilinmeyen alanlar KORUNUR
  });
  var bs=(typeof WISDOM_BATCH_SIZE==='number')?WISDOM_BATCH_SIZE:450;
  var batchCount=Math.ceil(records.length/bs);
  return wisdomContentChecksum(records).then(function(cs){
    return {total:records.length,batchSize:bs,batchCount:batchCount,sourceChecksum:cs.hash,records:records};
  });
}
window.wisdomMigrationPlan=wisdomMigrationPlan;

/* ── Start: doğrulanmış backup zorunlu → batch yazım → verify. Concurrency guard. ── */
function wisdomMigrationStart(opts){
  opts=opts||{};
  if(_wmRunning||WISDOM_MIGRATION.status==='in_progress'||WISDOM_MIGRATION.status==='verifying')
    return Promise.resolve({ok:false,reason:'already_running'});
  if(typeof createBackup!=='function')return Promise.resolve({ok:false,reason:'no_backup_engine'});
  _wmRunning=true;
  // 1) Doğrulanmış backup — başarısızsa SIFIR write (backup hatası ayrı etiketlenir)
  return Promise.resolve().then(function(){ return createBackup('before_migration',{force:true,label:'Wisdom sharding migration safety backup'}); })
    .then(function(bk){ if(!bk||(!bk.id&&!bk.skipped))return Promise.reject({__backup:true}); return bk; },
          function(e){ return Promise.reject({__backup:true,msg:String((e&&e.message)||e)}); })
    .then(function(bk){ return wisdomMigrationPlan(); })
    .then(function(plan){
      WISDOM_MIGRATION.status='in_progress'; WISDOM_MIGRATION.total=plan.total; WISDOM_MIGRATION.migratedCount=0;
      WISDOM_MIGRATION.lastBatchIndex=-1; WISDOM_MIGRATION.sourceChecksum=plan.sourceChecksum;
      WISDOM_MIGRATION.startedAt=Date.now(); WISDOM_MIGRATION.error=null; WISDOM_MIGRATION.completedAt=null;
      WISDOM_MIGRATION._records=plan.records;
      return _wmPersistManifest().then(function(){ return _wmRunBatches(plan.records,0); });
    })
    .then(function(){ return wisdomMigrationVerify(); })
    .then(function(v){ _wmRunning=false; return v; })
    .catch(function(e){
      var isBackup=!!(e&&e.__backup);
      WISDOM_MIGRATION.status='failed';
      WISDOM_MIGRATION.error=isBackup?'backup_failed':String((e&&e.message)||e||'error');
      _wmRunning=false;
      if(!isBackup)_wmPersistManifest(); // backup gate hiç yazmadı → manifest de yazma (0 write)
      return {ok:false,reason:isBackup?'backup_failed':'failed',error:WISDOM_MIGRATION.error};
    });
}
window.wisdomMigrationStart=wisdomMigrationStart;

/* Batch döngüsü — wisdomStoreBatchWrite (WISDOM_BATCH_SIZE). Idempotent (id=quote id). */
function _wmRunBatches(records,fromBatch){
  var bs=(typeof WISDOM_BATCH_SIZE==='number')?WISDOM_BATCH_SIZE:450;
  var lots=[]; for(var i=0;i<records.length;i+=bs)lots.push(records.slice(i,i+bs));
  function run(k){
    if(k>=lots.length)return Promise.resolve({ok:true});
    return wisdomStoreBatchWrite(lots[k]).then(function(res){
      if(!res||!res.ok)throw new Error('batch_write_failed');
      WISDOM_MIGRATION.lastBatchIndex=k; WISDOM_MIGRATION.migratedCount+=lots[k].length;
      return _wmPersistManifest().then(function(){ return run(k+1); });
    });
  }
  return run(fromBatch<0?0:fromBatch);
}

/* ── Resume: yarım kalan migration'ı kaldığı batch'ten sürdür (idempotent). ── */
function wisdomMigrationResume(){
  if(_wmRunning)return Promise.resolve({ok:false,reason:'already_running'});
  if(WISDOM_MIGRATION.status!=='in_progress'&&WISDOM_MIGRATION.status!=='verifying'&&WISDOM_MIGRATION.status!=='failed')
    return Promise.resolve({ok:false,reason:'nothing_to_resume'});
  var records=WISDOM_MIGRATION._records;
  if(!Array.isArray(records))return Promise.resolve({ok:false,reason:'no_plan'});
  _wmRunning=true; WISDOM_MIGRATION.status='in_progress'; WISDOM_MIGRATION.error=null;
  return _wmRunBatches(records,WISDOM_MIGRATION.lastBatchIndex+1)
    .then(function(){ return wisdomMigrationVerify(); })
    .then(function(v){ _wmRunning=false; return v; })
    .catch(function(e){ WISDOM_MIGRATION.status='failed'; WISDOM_MIGRATION.error=String((e&&e.message)||e); _wmRunning=false; return {ok:false,reason:'failed',error:WISDOM_MIGRATION.error}; });
}
window.wisdomMigrationResume=wisdomMigrationResume;

/* ── Verify: count eşit + kaynak/hedef SHA-256 eşit + her legacy kayıt hedefte. ──
   Geçerse status=completed + meta{sharded:true,count,checksum}. Yoksa sharded ASLA true. */
function wisdomMigrationVerify(){
  WISDOM_MIGRATION.status='verifying';
  var records=WISDOM_MIGRATION._records||[];
  var col=wisdomStoreCol(); if(!col)return Promise.resolve({ok:false,reason:'no_db'});
  return col.get().then(function(snap){
    var target=[]; snap.forEach(function(doc){ var d=doc.data()||{}; if(d.id==null)d.id=doc.id; target.push(d); });
    var countOk=(target.length===records.length);
    var idset={}; target.forEach(function(t){ idset[String(t.id)]=1; });
    var allPresent=records.every(function(r){ return idset[String(r.id)]; });
    return wisdomContentChecksum(target).then(function(cs){
      WISDOM_MIGRATION.targetChecksum=cs.hash;
      var checksumOk=(WISDOM_MIGRATION.sourceChecksum===cs.hash);
      if(countOk&&allPresent&&checksumOk){
        WISDOM_MIGRATION.status='completed'; WISDOM_MIGRATION.completedAt=Date.now(); WISDOM_MIGRATION.error=null;
        var meta=_wmMetaDoc(), setMeta=meta?meta.set({sharded:true,count:target.length,checksum:cs.hash,updatedAt:Date.now()}).catch(function(){}):Promise.resolve();
        return Promise.resolve(setMeta).then(_wmPersistManifest).then(function(){ return {ok:true,count:target.length,checksum:cs.hash}; });
      }
      WISDOM_MIGRATION.status='failed'; WISDOM_MIGRATION.error='verify_mismatch';
      return _wmPersistManifest().then(function(){ return {ok:false,reason:'verify_mismatch',countOk:countOk,checksumOk:checksumOk,allPresent:allPresent}; });
    });
  }).catch(function(e){ WISDOM_MIGRATION.status='failed'; WISDOM_MIGRATION.error=String((e&&e.message)||e); return {ok:false,reason:'error',error:WISDOM_MIGRATION.error}; });
}
window.wisdomMigrationVerify=wisdomMigrationVerify;

/* ── Abort: durumu failed'e çek; kısmi koleksiyon zararsız (resume idempotent). ── */
function wisdomMigrationAbort(){
  _wmRunning=false; WISDOM_MIGRATION.status='failed'; WISDOM_MIGRATION.error=WISDOM_MIGRATION.error||'aborted';
  return _wmPersistManifest().then(function(){ return {ok:true,status:'failed'}; });
}
window.wisdomMigrationAbort=wisdomMigrationAbort;

/* ── Read-transition kapısı: sharded=true olabilmesi için üç koşul birlikte. ── */
function wisdomMigrationCanShard(){
  return WISDOM_MIGRATION.status==='completed'&&
    WISDOM_MIGRATION.total===WISDOM_MIGRATION.migratedCount&&
    WISDOM_MIGRATION.sourceChecksum!=null&&
    WISDOM_MIGRATION.sourceChecksum===WISDOM_MIGRATION.targetChecksum;
}
window.wisdomMigrationCanShard=wisdomMigrationCanShard;

/* ══ P0-LOAD (INSTRUCTION 2): AÇIK YAŞAM-DÖNGÜSÜ DURUM MAKİNESİ ══
   wqLifecycleState() TEK yetkili kaynak — hero ve liste ikisi de bunu okur (RC-1/RC-3
   düzeltmesi). Saf/türetilmiş: mevcut activationReason (zaten açık bir enum) + retry
   sayaçları + D.wisdomQuotes uzunluğu üzerinden hesaplanır; ayrı/çakışan bir alan
   TUTULMAZ (tek kaynak, kayma riski yok). 9 durum: idle/waiting_auth/activating/
   loading/retrying/ready/empty/settled_legacy/error. */
var WQ_LC={IDLE:'idle',WAITING_AUTH:'waiting_auth',ACTIVATING:'activating',LOADING:'loading',
  RETRYING:'retrying',READY:'ready',EMPTY:'empty',SETTLED_LEGACY:'settled_legacy',ERROR:'error'};
window.WQ_LC=WQ_LC;
function wqLifecycleState(){
  var ss=WQ_STORE_STATE;
  if(ss.retrying)return WQ_LC.RETRYING;
  if(ss.retryExhausted)return WQ_LC.ERROR;
  var ar=ss.activationReason;
  if(ar==null)return ss._activationScheduled?WQ_LC.WAITING_AUTH:WQ_LC.IDLE;
  if(ar==='no_auth')return WQ_LC.WAITING_AUTH;
  if(ar==='checking')return WQ_LC.ACTIVATING;
  if(ar==='verifying')return WQ_LC.LOADING;
  if(ar==='ready'||ar==='metadata_update'){
    if(typeof wisdomStoreIsSharded==='function'&&wisdomStoreIsSharded()&&WQ_STORE.size===0)return WQ_LC.EMPTY; // savunma; pratikte erişilmez (empty_cache kapısı önce yakalar)
    return WQ_LC.READY;
  }
  if(ar==='load_failed'||ar==='error')return WQ_LC.ERROR;
  // no_db / no_migration / gate_failed / empty_cache / no_auth_timeout → legacy'ye yerleşti (kasıtlı)
  var legacyLen=Array.isArray(D.wisdomQuotes)?D.wisdomQuotes.length:0;
  return legacyLen===0?WQ_LC.EMPTY:WQ_LC.SETTLED_LEGACY;
}
window.wqLifecycleState=wqLifecycleState;

/* ══ Sınırlı otomatik yeniden deneme (RC-2). Yalnız GEÇİCİ hatalarda; en fazla 3 deneme,
   800ms→2000ms→5000ms taban + ±%20 jitter. Kalıcı hatalar (izin reddi/geçersiz
   yapılandırma) ASLA yeniden denenmez. Tek zincir (retrying bayrağı yinelenen
   zamanlamayı engeller); zamanlayıcı iptal edilebilir (_wqCancelRetry, dispose). ══ */
var WQ_RETRY_MAX=3, WQ_RETRY_BASE_DELAYS=[800,2000,5000];
function _wqRetryDelay(attempt){
  var base=WQ_RETRY_BASE_DELAYS[Math.min(Math.max(attempt,1)-1,WQ_RETRY_BASE_DELAYS.length-1)];
  var jitter=base*0.2;
  return Math.round(base-jitter+Math.random()*jitter*2); // taban ±%20
}
window._wqRetryDelay=_wqRetryDelay;
var _WQ_PERMANENT_CODES={'permission-denied':1,'unauthenticated':1,'invalid-argument':1,'not-found':1,'failed-precondition':1};
function _wqClassifyError(err){
  var code=(err&&err.code)||'';
  if(_WQ_PERMANENT_CODES[code])return 'permanent';
  var msg=String((err&&err.message)||err||'').toLowerCase();
  if(/permission|unauthenticated|invalid.argument/.test(msg))return 'permanent';
  return 'transient'; // network/timeout/unavailable/aborted/bilinmeyen → iyimser: sınır içinde yeniden dene
}
window._wqClassifyError=_wqClassifyError;
function wisdomActivationRetryStatus(){ return {attempt:WQ_STORE_STATE.retryAttempt||0,max:WQ_RETRY_MAX,retrying:!!WQ_STORE_STATE.retrying,exhausted:!!WQ_STORE_STATE.retryExhausted}; }
window.wisdomActivationRetryStatus=wisdomActivationRetryStatus;
function _wqCancelRetry(){
  if(WQ_STORE_STATE._retryTimer!=null&&typeof clearTimeout==='function'){ try{clearTimeout(WQ_STORE_STATE._retryTimer);}catch(e){} }
  WQ_STORE_STATE._retryTimer=null; WQ_STORE_STATE.retrying=false; WQ_STORE_STATE._retryPending=false;
}
window._wqCancelRetry=_wqCancelRetry;
/* triggerReason: 'load_failed'|'error' — yalnız geçici sınıflandırılan hatalarda çağrılır.
   retrying: TÜM deneme dizisi boyunca true kalır (UI sürekliliği — deneme aralarında
   ACTIVATING/LOADING'e geri kaymaz). _retryPending: yalnız bir zamanlayıcı SAYARKEN true
   — yinelenen-zincir koruması BUNA bakar (retrying'e bakarsa 2. başarısızlıkta kilitlenir). */
function _wqScheduleRetry(triggerReason){
  if(WQ_STORE_STATE._retryPending)return; // zaten bekleyen bir zamanlayıcı var → yinelenen zincir YOK
  var attempt=(WQ_STORE_STATE.retryAttempt||0)+1;
  if(attempt>WQ_RETRY_MAX){ WQ_STORE_STATE.retryExhausted=true; WQ_STORE_STATE.retrying=false; WQ_STORE_STATE._retryPending=false; return; }
  WQ_STORE_STATE.retryAttempt=attempt; WQ_STORE_STATE.retrying=true; WQ_STORE_STATE._retryPending=true;
  var delay=_wqRetryDelay(attempt);
  _wqLog('retry_scheduled','attempt',attempt,'delayMs',delay,'trigger',triggerReason);
  if(typeof setTimeout!=='function'){ WQ_STORE_STATE.retrying=false; WQ_STORE_STATE._retryPending=false; return; } // test/ortam güvencesi
  WQ_STORE_STATE._retryTimer=setTimeout(function(){
    WQ_STORE_STATE._retryTimer=null; WQ_STORE_STATE._retryPending=false; // zamanlayıcı ateşlendi → artık "bekleyen" değil (yeni başarısızlık yeniden zamanlayabilir)
    WQ_STORE_STATE.activationChecked=false; // kasıtlı sıfırlama: yalnız planlı retry burada yapar
    wisdomBootActivate();
  },delay);
  // Node ortamında (test) bekleyen retry zamanlayıcısı süreci/işlemi canlı tutmasın —
  // kimse sonucu beklemiyorsa dosya/işlem normal şekilde çıkabilir. Tarayıcıda unref yok
  // (typeof guard); zamanlayıcı davranışı HER İKİ ortamda da birebir aynı kalır.
  if(WQ_STORE_STATE._retryTimer&&typeof WQ_STORE_STATE._retryTimer.unref==='function')WQ_STORE_STATE._retryTimer.unref();
}
window._wqScheduleRetry=_wqScheduleRetry;
/* Kullanıcı tetikli manuel yeniden deneme (ERROR durumunda liste/hero butonu). */
function wqManualRetryLoad(){
  WQ_STORE_STATE.retryExhausted=false; WQ_STORE_STATE.retryAttempt=0; WQ_STORE_STATE.retrying=false; WQ_STORE_STATE._retryPending=false;
  WQ_STORE_STATE.activationChecked=false;
  return wisdomBootActivate().then(function(r){
    if(typeof tab!=='undefined'&&tab==='wisdom'&&typeof renderWisdomQuotes==='function')renderWisdomQuotes();
    return r;
  });
}
window.wqManualRetryLoad=wqManualRetryLoad;

/* ══ BOOT READ-TRANSITION ACTIVATION (P2.1, P0-LOAD genişletildi) — GATED. Migration
   tamamlanıp doğrulandıysa sharded read'i boot'ta güvenli+kalıcı aktive eder. Realtime
   listener YOK (tek get()). Migration BAŞLATMAZ, WRITE YAPMAZ, throw ETMEZ. Kapı
   geçmezse legacy fallback korunur. Auth öncesi ve oturumda ikinci çağrı no-op.
   Eşzamanlı çağrılar _activationInFlight ile TEK zincire indirgenir (single-flight). ══ */
function wisdomBootActivate(){
  if(WQ_STORE_STATE.activationChecked)return Promise.resolve({ok:false,reason:'already_checked'}); // oturumda tek kez
  if(WQ_STORE_STATE._activationInFlight)return Promise.resolve({ok:false,reason:'in_flight'}); // eşzamanlı ikinci çağrı → no-op
  if(typeof CLOUD==='undefined'||!CLOUD.db||!CLOUD.uid){ if(WQ_STORE_STATE.activationReason==null)WQ_STORE_STATE.activationReason='no_auth'; return Promise.resolve({ok:false,reason:'no_auth'}); } // auth öncesi: işaretleme, tekrar denenebilir
  WQ_STORE_STATE._activationInFlight=true;
  return _wisdomBootActivateInner().then(function(r){ WQ_STORE_STATE._activationInFlight=false; return r; },
                                          function(e){ WQ_STORE_STATE._activationInFlight=false; return {ok:false,reason:'error',error:String((e&&e.message)||e)}; });
}
function _wisdomBootActivateInner(){
  WQ_STORE_STATE.activationChecked=true; WQ_STORE_STATE.activationReady=false; WQ_STORE_STATE.activationReason='checking';
  _wqLog('activation_start');
  var meta=_wmMetaDoc(), mig=_wmMigDoc();
  if(!meta||!mig){ WQ_STORE_STATE.activationReason='no_db'; return Promise.resolve({ok:false,reason:'no_db'}); }
  return Promise.all([meta.get(),mig.get()]).then(function(res){
    var m=(res[0]&&res[0].exists)?res[0].data():null, g=(res[1]&&res[1].exists)?res[1].data():null;
    if(!m||!g){ WQ_STORE_STATE.activationReason='no_migration'; return {ok:false,reason:'no_migration'}; } // migration yok → legacy (normal)
    // ── Kapı (P3b): yalnız meta.sharded + migration.completed. Checksum kapıda DEĞİL. ──
    if(!(m.sharded===true && g.status==='completed')){ WQ_STORE_STATE.activationReason='gate_failed'; return {ok:false,reason:'gate_failed'}; } // legacy
    // ── Koleksiyonu yükle + yükleme-sonrası COUNT doğrula (legacy fallback koşulları) ──
    WQ_STORE_STATE.activationReason='verifying';
    return wisdomStoreLoad().then(function(lr){
      // P3d: kapı geçtikten SONRA başarısızlık = gerçek FALLBACK (koleksiyon bekleniyordu ama açılamadı)
      if(!lr||!lr.ok||WQ_STORE_STATE.error){
        WQ_STORE_STATE.activationReason='load_failed'; _wexFallback('load_failed');
        var cls=_wqClassifyError({code:WQ_STORE_STATE.errorCode,message:WQ_STORE_STATE.error});
        if(cls==='transient'&&(WQ_STORE_STATE.retryAttempt||0)<WQ_RETRY_MAX)_wqScheduleRetry('load_failed');
        else { WQ_STORE_STATE.retrying=false; WQ_STORE_STATE._retryPending=false; WQ_STORE_STATE.retryExhausted=true; }
        return {ok:false,reason:'load_failed'};
      }
      WQ_STORE_STATE.retrying=false; WQ_STORE_STATE._retryPending=false; // bu deneme (ilk veya retry) veriye ulaştı → retry döngüsü kapanır
      if(WQ_STORE.size===0){ WQ_STORE_STATE.activationReason='empty_cache'; _wexFallback('empty_cache'); return {ok:false,reason:'empty_cache'}; }
      // ── P3b-2: KOLEKSİYON OTORİTE. Temiz yüklendi + boş değil → count farkı BLOKE ETMEZ.
      //    Count ve/veya checksum farklıysa aktive et + tek yazma ile self-heal. ──
      WQ_STORE_STATE.metaCount=m.count;
      var countOk=(WQ_STORE.size===m.count);
      return wisdomContentChecksum().then(function(cs){
        var checksumOk=(cs.hash===m.checksum);
        wisdomStoreSetSharded(true); WQ_STORE_STATE.activationReady=true;
        WQ_STORE_STATE.activationReason=(checksumOk&&countOk)?'ready':'metadata_update';
        WQ_STORE_STATE.source='sharded'; WQ_STORE_STATE.fallbackReason=null; WQ_STORE_STATE.lastSuccessfulRead=Date.now(); // P3d: primary aktif
        _wqLog('settled','source','sharded','count',WQ_STORE.size);
        if(!checksumOk||!countOk)_wexSelfHealMeta(checksumOk?null:cs.hash, countOk?null:WQ_STORE.size); // count ve/veya checksum tek yazma
        return {ok:true,count:WQ_STORE.size,checksumOk:checksumOk,countOk:countOk};
      },function(){ // checksum hesaplanamadı → yine de count-based aktive (+ count self-heal gerekirse)
        wisdomStoreSetSharded(true); WQ_STORE_STATE.activationReady=true; WQ_STORE_STATE.activationReason=countOk?'ready':'metadata_update';
        WQ_STORE_STATE.source='sharded'; WQ_STORE_STATE.fallbackReason=null; WQ_STORE_STATE.lastSuccessfulRead=Date.now();
        _wqLog('settled','source','sharded','count',WQ_STORE.size);
        if(!countOk)_wexSelfHealMeta(null, WQ_STORE.size);
        return {ok:true,count:WQ_STORE.size,checksumOk:null,countOk:countOk};
      });
    });
  }).catch(function(e){
    WQ_STORE_STATE.activationReason='error'; _wexFallback('error');
    var cls=_wqClassifyError(e);
    if(cls==='transient'&&(WQ_STORE_STATE.retryAttempt||0)<WQ_RETRY_MAX)_wqScheduleRetry('error');
    else { WQ_STORE_STATE.retrying=false; WQ_STORE_STATE._retryPending=false; WQ_STORE_STATE.retryExhausted=true; }
    return {ok:false,reason:'error',error:String((e&&e.message)||e)};
  });
}
/* P3d: gerçek fallback kaydı (yalnız kapı geçtikten sonra oluşan hata). runtime; 0 write. */
function _wexFallback(reason){ WQ_STORE_STATE.source='legacy'; WQ_STORE_STATE.fallbackReason=reason; WQ_STORE_STATE.fallbackCount=(WQ_STORE_STATE.fallbackCount||0)+1; WQ_STORE_STATE.lastFallbackAt=Date.now(); }
window.wisdomBootActivate=wisdomBootActivate;
/* Self-heal (P3b/P3b-2): checksum ve/veya count farklıysa meta+manifest'i arka planda tek
   batch ile güncelle. Yalnız verilen alanlar yazılır. Oturumda tek sefer (_selfHealed). */
function _wexSelfHealMeta(newChecksum,newCount){
  if(WQ_STORE_STATE._selfHealed)return; if(typeof CLOUD==='undefined'||!CLOUD.db)return;
  var meta=_wmMetaDoc(), mig=_wmMigDoc(); if(!meta)return;
  var mp={updatedAt:Date.now()}, gp={updatedAt:Date.now()}, changed=false;
  if(newChecksum){ mp.checksum=newChecksum; gp.sourceChecksum=newChecksum; gp.targetChecksum=newChecksum; changed=true; }
  if(newCount!=null){ mp.count=newCount; gp.total=newCount; gp.migratedCount=newCount; WQ_STORE_STATE.metaCount=newCount; changed=true; }
  if(!changed)return;
  WQ_STORE_STATE._selfHealed=true;
  try{
    if(typeof CLOUD.db.batch==='function'){
      var b=CLOUD.db.batch();
      b.set(meta,mp,{merge:true});
      if(mig)b.set(mig,gp,{merge:true});
      b.commit().then(function(){WQ_STORE_STATE.activationReason='ready';}).catch(function(){});
    } else { meta.set(mp,{merge:true}).then(function(){WQ_STORE_STATE.activationReason='ready';}).catch(function(){}); }
  }catch(e){}
}
window._wexSelfHealMeta=_wexSelfHealMeta;
/* P3b-2: dual-write add/delete sonrası meta.count senkronu (yalnız sharded + count değiştiyse).
   Koleksiyon ACK sonrası çağrılır; değişmediyse yazma yok (idempotent). _selfHealed'e bağlı DEĞİL. */
function wisdomSyncMetaCount(){
  if(typeof CLOUD==='undefined'||!CLOUD.db)return; if(!(typeof wisdomStoreIsSharded==='function'&&wisdomStoreIsSharded()))return;
  var size=(typeof WQ_STORE!=='undefined')?WQ_STORE.size:0;
  if(size===WQ_STORE_STATE.metaCount)return; // stored count ile aynı → yazma yok
  var meta=_wmMetaDoc(), mig=_wmMigDoc(); if(!meta)return;
  WQ_STORE_STATE.metaCount=size;
  try{
    if(typeof CLOUD.db.batch==='function'){ var b=CLOUD.db.batch();
      b.set(meta,{count:size,updatedAt:Date.now()},{merge:true});
      if(mig)b.set(mig,{total:size,migratedCount:size,updatedAt:Date.now()},{merge:true});
      b.commit().catch(function(){});
    } else meta.set({count:size,updatedAt:Date.now()},{merge:true}).catch(function(){});
  }catch(e){}
}
window.wisdomSyncMetaCount=wisdomSyncMetaCount;

/* Bounded hazır-bekleme (realtime listener DEĞİL): auth hazır olunca tek sefer aktive et. */
function wisdomBootActivateWhenReady(){
  if(WQ_STORE_STATE.activationChecked||WQ_STORE_STATE._activationScheduled)return;
  WQ_STORE_STATE._activationScheduled=true;
  var tries=0, max=40; // ~20sn (500ms×40); listener yok
  var iv=setInterval(function(){
    tries++;
    var ready=typeof CLOUD!=='undefined'&&CLOUD.ready&&CLOUD.db&&CLOUD.uid&&CLOUD.user&&!CLOUD.user.isAnonymous;
    if(ready){ clearInterval(iv); WQ_STORE_STATE._activationScheduled=false; _wqLog('auth_ready'); wisdomBootActivate(); }
    else if(tries>=max){ clearInterval(iv); WQ_STORE_STATE._activationScheduled=false; WQ_STORE_STATE.activationReason='no_auth_timeout'; } // auth gelmedi → kesin legacy (P0-LOAD: artık IDLE'da asılı kalmaz)
  },500);
}
window.wisdomBootActivateWhenReady=wisdomBootActivateWhenReady;

/* ── UX durum satırı (SALT OKUNUR): yalnız migration/storage hatası veya geçiş
   durumunda görünür. Normal legacy'de '' döner. İkon + açık metin (renk tek sinyal
   değil); sabit genişlik yok; popup yok; write/migration/auto-load tetiklemez. ── */
var _WEX_ACT_FAIL={gate_failed:1,count_mismatch:1,load_failed:1,empty_cache:1,error:1};
function wisdomStatusLineHtml(){
  var ms=(typeof wisdomMigrationStatus==='function')?wisdomMigrationStatus():{status:'idle'};
  var ss=(typeof WQ_STORE_STATE!=='undefined')?WQ_STORE_STATE:{error:null,activationReason:null,activationReady:false}; // activation alanları burada
  var kind=null;
  // P2.1 read-transition durumları (öncelikli). Normal legacy (no_migration/no_auth/no_db/null) → gizli.
  var ar=ss.activationReason;
  if(ar==='metadata_update')kind='act_metadata'; // aktif ama meta self-heal ediliyor (öncelikli)
  else if(ss.activationReady===true||ar==='ready')kind='act_ready';
  else if(ar==='checking')kind='act_checking';
  else if(ar==='verifying')kind='act_verifying';
  else if(ar&&_WEX_ACT_FAIL[ar])kind='act_failed';
  // Migration durumları (P2) — aktivasyon sinyali yoksa
  else if(ms.status==='failed'&&ms.error==='backup_failed')kind='backup_failed'; // P2.2: backup gate özel metni
  else if(ms.status==='failed'||ss.error)kind='error';
  else if(ms.status==='in_progress')kind='preparing';
  else if(ms.status==='verifying')kind='verifying';
  else if(ms.status==='completed')kind='ready';
  if(!kind)return ''; // normal legacy → hiçbir mesaj
  var M={ preparing:{i:'ref',c:'var(--blue)',t:'Bulut depolama hazırlanıyor'},
    verifying:{i:'ref',c:'var(--orange)',t:'Veriler doğrulanıyor'},
    ready:{i:'chk',c:'var(--green)',t:'Bulut depolama hazır'},
    error:{i:'csq',c:'var(--red)',t:'Senkronizasyon tamamlanamadı'},
    backup_failed:{i:'csq',c:'var(--red)',t:'Güvenli yedek oluşturulamadı. Taşıma başlatılmadı.'},
    act_checking:{i:'ref',c:'var(--blue)',t:'Bulut arşivi hazırlanıyor'},
    act_verifying:{i:'ref',c:'var(--orange)',t:'Bulut doğrulanıyor'},
    act_metadata:{i:'ref',c:'var(--blue)',t:'Bulut arşivi doğrulandı, metadata güncelleniyor'},
    act_ready:{i:'chk',c:'var(--green)',t:'Bulut arşivi hazır'},
    act_failed:{i:'csq',c:'var(--orange)',t:'Yerel arşiv kullanılıyor'} }[kind];
  var icn=(typeof ic==='function')?ic(M.i,13,M.c):'';
  return '<div role="status" aria-live="polite" style="display:flex;align-items:center;gap:7px;max-width:100%;padding:6px 10px;margin-bottom:10px;border-radius:8px;background:var(--s2);font-size:11.5px;color:var(--t2)">'+
    icn+'<span style="font-weight:600;color:'+M.c+'">'+M.t+'</span></div>';
}
window.wisdomStatusLineHtml=wisdomStatusLineHtml;

/* Test/geçiş yardımcısı — üretimde otomatik ÇAĞRILMAZ. */
function wisdomMigrationReset(){ WISDOM_MIGRATION.status='idle';WISDOM_MIGRATION.total=0;WISDOM_MIGRATION.migratedCount=0;WISDOM_MIGRATION.lastBatchIndex=-1;WISDOM_MIGRATION.sourceChecksum=null;WISDOM_MIGRATION.targetChecksum=null;WISDOM_MIGRATION.startedAt=null;WISDOM_MIGRATION.completedAt=null;WISDOM_MIGRATION.error=null;WISDOM_MIGRATION._records=null;_wmRunning=false; }
window.wisdomMigrationReset=wisdomMigrationReset;
