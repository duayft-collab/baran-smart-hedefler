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
  return wisdomStoreChecksum(records).then(function(cs){
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
  // 1) Doğrulanmış backup — başarısızsa SIFIR write
  return Promise.resolve().then(function(){ return createBackup('before_shard_migration',{force:true,label:'Wisdom sharding migration safety backup'}); })
    .then(function(bk){
      if(!bk||(!bk.id&&!bk.skipped))throw new Error('backup_unverified');
      return wisdomMigrationPlan();
    })
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
      WISDOM_MIGRATION.status='failed'; WISDOM_MIGRATION.error=String((e&&e.message)||e||'error'); _wmRunning=false;
      _wmPersistManifest();
      return {ok:false,reason:'failed',error:WISDOM_MIGRATION.error};
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
    return wisdomStoreChecksum(target).then(function(cs){
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

/* ── UX durum satırı (SALT OKUNUR): yalnız migration/storage hatası veya geçiş
   durumunda görünür. Normal legacy'de '' döner. İkon + açık metin (renk tek sinyal
   değil); sabit genişlik yok; popup yok; write/migration/auto-load tetiklemez. ── */
function wisdomStatusLineHtml(){
  var ms=(typeof wisdomMigrationStatus==='function')?wisdomMigrationStatus():{status:'idle'};
  var ss=(typeof wisdomStoreStatus==='function')?wisdomStoreStatus():{error:null};
  var kind=null;
  if(ms.status==='failed'||ss.error)kind='error';
  else if(ms.status==='in_progress')kind='preparing';
  else if(ms.status==='verifying')kind='verifying';
  else if(ms.status==='completed')kind='ready';
  if(!kind)return ''; // normal legacy → hiçbir mesaj
  var M={ preparing:{i:'ref',c:'var(--blue)',t:'Bulut depolama hazırlanıyor'},
    verifying:{i:'ref',c:'var(--orange)',t:'Veriler doğrulanıyor'},
    ready:{i:'chk',c:'var(--green)',t:'Bulut depolama hazır'},
    error:{i:'csq',c:'var(--red)',t:'Senkronizasyon tamamlanamadı'} }[kind];
  var icn=(typeof ic==='function')?ic(M.i,13,M.c):'';
  return '<div role="status" aria-live="polite" style="display:flex;align-items:center;gap:7px;max-width:100%;padding:6px 10px;margin-bottom:10px;border-radius:8px;background:var(--s2);font-size:11.5px;color:var(--t2)">'+
    icn+'<span style="font-weight:600;color:'+M.c+'">'+M.t+'</span></div>';
}
window.wisdomStatusLineHtml=wisdomStatusLineHtml;

/* Test/geçiş yardımcısı — üretimde otomatik ÇAĞRILMAZ. */
function wisdomMigrationReset(){ WISDOM_MIGRATION.status='idle';WISDOM_MIGRATION.total=0;WISDOM_MIGRATION.migratedCount=0;WISDOM_MIGRATION.lastBatchIndex=-1;WISDOM_MIGRATION.sourceChecksum=null;WISDOM_MIGRATION.targetChecksum=null;WISDOM_MIGRATION.startedAt=null;WISDOM_MIGRATION.completedAt=null;WISDOM_MIGRATION.error=null;WISDOM_MIGRATION._records=null;_wmRunning=false; }
window.wisdomMigrationReset=wisdomMigrationReset;
