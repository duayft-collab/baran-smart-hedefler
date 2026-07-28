/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom Sharding P3c — SHARDED RESTORE ENGINE
   Sharded aktifken backup payload'ındaki wisdomQuotes'u KOLEKSİYONA (batch replace)
   geri yükler — app/state'e YAZMAZ (1MiB güvenli). Akış: doğrulanmış before_restore
   backup → payload doğrula → geçici plan → id/count/content-checksum doğrula → batch
   replace → meta/manifest güncelle → cache reload. Doğrulama geçmeden koleksiyon
   SİLİNMEZ. Hata → yarım koleksiyon bırakma; before_restore ile rollback mümkün.
   Legacy D.wisdomQuotes DEĞİŞTİRİLMEZ/SİLİNMEZ. Realtime listener YOK. Rules DEĞİŞMEZ.
   ══════════════════════════════════════════════════════════════════════════ */

var WISDOM_RESTORE={ stage:'idle', done:0, total:0, error:null, backupId:null };
window.WISDOM_RESTORE=WISDOM_RESTORE;
function wisdomRestoreStatus(){ return JSON.parse(JSON.stringify(WISDOM_RESTORE)); }
window.wisdomRestoreStatus=wisdomRestoreStatus;
function _wrStage(s,done,total){ WISDOM_RESTORE.stage=s; if(done!=null)WISDOM_RESTORE.done=done; if(total!=null)WISDOM_RESTORE.total=total; }
function wisdomRestoreReset(){ WISDOM_RESTORE.stage='idle';WISDOM_RESTORE.done=0;WISDOM_RESTORE.total=0;WISDOM_RESTORE.error=null;WISDOM_RESTORE.backupId=null; }
window.wisdomRestoreReset=wisdomRestoreReset;

/* Payload'dan wisdomQuotes çıkar (dizi veya {wisdomQuotes:[]}); eski/yeni backup uyumlu. */
function _wrExtract(payload){
  if(Array.isArray(payload))return payload;
  if(payload&&Array.isArray(payload.wisdomQuotes))return payload.wisdomQuotes;
  return null;
}
/* Doğrulama: dizi olmalı; her kayıt quote içermeli. Bilinmeyen alanlar KORUNUR (normalize yok). */
function wisdomRestoreValidate(payload){
  var recs=_wrExtract(payload);
  if(!Array.isArray(recs))return {ok:false,reason:'NOT_ARRAY',valid:[]};
  var valid=[], skipped=0, seen={};
  recs.forEach(function(q){
    if(!q||typeof q!=='object'||typeof q.quote!=='string'||!q.quote.trim()){ skipped++; return; }
    var rec=Object.assign({},q); // TÜM alanlar korunur
    var id=(rec.id!=null&&String(rec.id))?String(rec.id):('wq-restore-'+valid.length);
    if(seen[id])id=id+'-'+valid.length; seen[id]=1; rec.id=id;
    valid.push(rec);
  });
  return {ok:valid.length>0,reason:valid.length?null:'EMPTY',valid:valid,skipped:skipped};
}
window.wisdomRestoreValidate=wisdomRestoreValidate;

/* Batch replace: önce tüm restore kayıtlarını yaz, sonra restore setinde OLMAYAN mevcut
   koleksiyon dokümanlarını sil (gerçek replace). Sıralı lot; hata → reject (yarım bırakma
   çağıran katmanın rollback'ine devredilir). */
function _wrBatchReplace(records){
  var col=(typeof wisdomStoreCol==='function')?wisdomStoreCol():null;
  if(!col)return Promise.reject(new Error('NO_DB'));
  if(typeof CLOUD==='undefined'||!CLOUD.db||typeof CLOUD.db.batch!=='function')return Promise.reject(new Error('NO_BATCH'));
  var LOT=(typeof WISDOM_BATCH_SIZE==='number')?WISDOM_BATCH_SIZE:450;
  var keepIds={}; records.forEach(function(r){ keepIds[String(r.id)]=1; });
  // 1) yeni kayıtları yaz
  var writeLots=[]; for(var i=0;i<records.length;i+=LOT)writeLots.push(records.slice(i,i+LOT));
  function writeRun(k){
    if(k>=writeLots.length)return Promise.resolve();
    var b=CLOUD.db.batch();
    writeLots[k].forEach(function(r){ b.set(col.doc(String(r.id)),r); });
    return b.commit().then(function(){ _wrStage('restoring',Math.min((k+1)*LOT,records.length),records.length); return writeRun(k+1); });
  }
  // 2) fazlalıkları sil (restore setinde olmayan mevcut dokümanlar)
  return writeRun(0).then(function(){
    return col.get().then(function(snap){
      var stale=[]; snap.forEach(function(doc){ var id=String(doc.id); if(!keepIds[id])stale.push(id); });
      var delLots=[]; for(var j=0;j<stale.length;j+=LOT)delLots.push(stale.slice(j,j+LOT));
      function delRun(k){ if(k>=delLots.length)return Promise.resolve(); var b=CLOUD.db.batch(); delLots[k].forEach(function(id){ b.delete(col.doc(id)); }); return b.commit().then(function(){ return delRun(k+1); }); }
      return delRun(0);
    });
  });
}

/* Ana akış. opts.skipBackup yalnız test/dahili. Başarısızsa {ok:false,reason} + 0 kalıcı state. */
function wisdomShardedRestore(payload,opts){
  opts=opts||{};
  wisdomRestoreReset(); _wrStage('verifying_backup');
  // 1) payload doğrula (backup'tan ÖNCE — geçersizse hiç backup/write yok)
  var v=wisdomRestoreValidate(payload);
  if(!v.ok){ WISDOM_RESTORE.error='invalid_payload'; _wrStage('failed'); return Promise.resolve({ok:false,reason:'invalid_payload',detail:v.reason}); }
  var records=v.valid;
  // 2) doğrulanmış before_restore backup
  var backupStep = opts.skipBackup ? Promise.resolve({id:'__skip'})
    : (typeof createBackup==='function'
        ? createBackup('before_restore',{force:true,label:'Sharded wisdom restore öncesi'}).catch(function(e){ return Promise.reject({__backup:true,msg:String((e&&e.message)||e)}); })
        : Promise.reject({__backup:true,msg:'no_backup_engine'}));
  return Promise.resolve(backupStep).then(function(bk){
    if(!bk||(!bk.id&&!bk.skipped))return Promise.reject({__backup:true});
    WISDOM_RESTORE.backupId=bk.id||null;
    // 3) plan hazırla + content-checksum (koleksiyon HENÜZ silinmedi)
    _wrStage('preparing',0,records.length);
    return wisdomContentChecksum(records).then(function(cs){
      WISDOM_RESTORE._checksum=cs.hash;
      // 4) batch replace uygula
      _wrStage('restoring',0,records.length);
      return _wrBatchReplace(records);
    });
  }).then(function(){
    // 5) yükleme-sonrası doğrula: count + content-checksum
    _wrStage('verifying',records.length,records.length);
    var col=wisdomStoreCol();
    return col.get().then(function(snap){
      var target=[]; snap.forEach(function(doc){ var d=doc.data()||{}; if(d.id==null)d.id=doc.id; target.push(d); });
      if(target.length!==records.length)throw new Error('count_mismatch');
      return wisdomContentChecksum(target).then(function(cs2){
        if(cs2.hash!==WISDOM_RESTORE._checksum)throw new Error('checksum_mismatch');
        // 6) meta/manifest güncelle + cache reload + sharded aktif kalsın
        var meta=(typeof _wmMetaDoc==='function')?_wmMetaDoc():null, mig=(typeof _wmMigDoc==='function')?_wmMigDoc():null;
        var upd=Promise.resolve();
        if(meta&&typeof CLOUD.db.batch==='function'){ var b=CLOUD.db.batch();
          b.set(meta,{sharded:true,count:records.length,checksum:cs2.hash,updatedAt:Date.now()},{merge:true});
          if(mig)b.set(mig,{status:'completed',total:records.length,migratedCount:records.length,sourceChecksum:cs2.hash,targetChecksum:cs2.hash,updatedAt:Date.now()},{merge:true});
          upd=b.commit();
        }
        return Promise.resolve(upd).then(function(){ return (typeof wisdomStoreLoad==='function')?wisdomStoreLoad():null; }).then(function(){
          if(typeof wisdomStoreSetSharded==='function')wisdomStoreSetSharded(true);
          _wrStage('done',records.length,records.length);
          return {ok:true,count:records.length,checksum:cs2.hash,backupId:WISDOM_RESTORE.backupId};
        });
      });
    });
  }).catch(function(e){
    var isBackup=!!(e&&e.__backup);
    WISDOM_RESTORE.error=isBackup?'backup_failed':String((e&&e.message)||e||'error');
    _wrStage('failed');
    // yarım koleksiyon: before_restore backup ile rollback mümkün (backupId raporlanır)
    return {ok:false,reason:isBackup?'backup_failed':WISDOM_RESTORE.error,backupId:WISDOM_RESTORE.backupId,rollbackBackupId:WISDOM_RESTORE.backupId};
  });
}
window.wisdomShardedRestore=wisdomShardedRestore;

/* ── UX aşama göstergesi (salt-okunur; ikon+metin; sabit genişlik yok; popup yok) ── */
var _WR_STAGE={
  verifying_backup:{i:'ref',c:'var(--blue)',t:'Yedek doğrulanıyor'},
  preparing:{i:'ref',c:'var(--blue)',t:'Özlü sözler hazırlanıyor'},
  restoring:{i:'ref',c:'var(--orange)',t:'Buluta geri yükleniyor'},
  verifying:{i:'ref',c:'var(--orange)',t:'Veriler doğrulanıyor'},
  done:{i:'chk',c:'var(--green)',t:'Geri yükleme tamamlandı'},
  failed:{i:'csq',c:'var(--red)',t:'Geri yükleme başarısız, mevcut arşiv korundu'}
};
function wisdomRestoreStageHtml(){
  var st=WISDOM_RESTORE, m=_WR_STAGE[st.stage];
  if(!m)return ''; // idle → gizli
  var e=(typeof U!=='undefined'&&U.esc)?U.esc:function(s){return String(s==null?'':s);};
  var icn=(typeof ic==='function')?ic(m.i,13,m.c):'';
  var label=m.t;
  if(st.stage==='restoring'&&st.total)label+=' · '+st.done+' / '+st.total; // "Buluta geri yükleniyor · X / Y"
  return '<div role="status" aria-live="polite" style="display:flex;align-items:center;gap:7px;max-width:100%;padding:6px 10px;margin-bottom:10px;border-radius:8px;background:var(--s2);font-size:11.5px;color:var(--t2)">'+
    icn+'<span style="font-weight:600;color:'+m.c+'">'+e(label)+'</span></div>';
}
window.wisdomRestoreStageHtml=wisdomRestoreStageHtml;
