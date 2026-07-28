/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom Sharding P1 (REVISED) — WISDOM STORE + DUAL-READ FOUNDATION
   Ayrı Firestore koleksiyonu: users/{uid}/wisdomQuotes/{quoteId}. Bu faz YALNIZ
   altyapı: runtime cache (WQ_STORE) + salt-okunur dual-read + (bağlanmamış) write
   primitifleri. Migration / import / boot / dual-write / realtime listener YOK → P2.
   Bu fazda hiçbir production yazma TETİKLENMEZ. sharded bayrağı asla otomatik açılmaz
   (legacy D.wisdomQuotes otoriter kalır). Bilinmeyen alanlar korunur (normalize YOK).
   Checksum = SHA-256 (backup doğrulama standardı sha256Hex). Batch = WISDOM_BATCH_SIZE.
   users/{uid}/app/state · revision · commitMutation · queueCloudSave · backup ·
   restore · rules DEĞİŞMEZ.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Sabitler ── */
const WISDOM_BATCH_SIZE = 450; // Firestore 500 batch sınırının güvenli altında
window.WISDOM_BATCH_SIZE = WISDOM_BATCH_SIZE;

/* ── Tek runtime cache + durum (tamamı runtime; Firestore'a YAZILMAZ) ── */
var WQ_STORE = new Map();
var WQ_STORE_STATE = { loaded:false, loading:false, sharded:false, error:null, count:0, checksum:null, lastLoadAt:null,
  activationChecked:false, activationReady:false, activationReason:null }; // P2.1: boot read-transition (runtime; Firestore'a YAZILMAZ)
window.WQ_STORE = WQ_STORE; window.WQ_STORE_STATE = WQ_STORE_STATE;

function wisdomStoreCol(uid){
  if(typeof CLOUD==='undefined'||!CLOUD.db)return null;
  var u=uid||CLOUD.uid; if(!u)return null;
  return CLOUD.db.collection('users').doc(u).collection('wisdomQuotes');
}

/* ── Sharded karar: yalnız bayrak açık + başarıyla yüklü + hatasız + dolu cache ──
   Boş koleksiyon / yüklenmemiş / hata → false → legacy fallback (güvenli). */
function wisdomStoreIsSharded(){
  return WQ_STORE_STATE.sharded===true&&WQ_STORE_STATE.loaded===true&&!WQ_STORE_STATE.error&&WQ_STORE.size>0;
}
window.wisdomStoreIsSharded=wisdomStoreIsSharded;

/* ── Salt-okunur cache erişimi ── */
function wisdomStoreList(){ return Array.from(WQ_STORE.values()); }
function wisdomStoreById(id){ return WQ_STORE.get(String(id))||null; }
window.wisdomStoreList=wisdomStoreList; window.wisdomStoreById=wisdomStoreById;

/* ── Checksum = SHA-256 (backup standardı sha256Hex). id'ye göre sıralı + canonical.
   Async (Promise) — backup doğrulamasıyla aynı algoritma; FNV yok. Saf; 0 yazma. */
function _wqsCanon(o){ return (typeof canonicalStringify==='function')?canonicalStringify(o):JSON.stringify(o); }
function wisdomStoreChecksum(records){
  var arr=(Array.isArray(records)?records:wisdomStoreList()).slice().sort(function(a,b){return String(a&&a.id).localeCompare(String(b&&b.id));});
  var s=arr.map(function(r){return String(r&&r.id)+_wqsCanon(r);}).join('');
  if(typeof sha256Hex!=='function')return Promise.reject(new Error('sha256Hex unavailable'));
  return sha256Hex(s).then(function(hex){ return {count:arr.length,hash:hex}; });
}
window.wisdomStoreChecksum=wisdomStoreChecksum;

/* İÇERİK checksum'ı (P3b) — volatile/runtime alanlar HARİÇ. Yalnız kalıcı içerik
   bütünlüğünü temsil eder; showCount/lastShownAt/updatedAt gibi alanların değişmesi
   checksum'ı değiştirmez → aktivasyon kapısı bayatlamaz. SHA-256, deterministik. */
var WISDOM_VOLATILE_FIELDS=['showCount','lastShownAt','updatedAt','lastViewedAt','lastPopupAt','lastRotationAt'];
window.WISDOM_VOLATILE_FIELDS=WISDOM_VOLATILE_FIELDS;
function _wqStripVolatile(r){ if(!r||typeof r!=='object')return r; var o={}; for(var k in r){ if(Object.prototype.hasOwnProperty.call(r,k)&&WISDOM_VOLATILE_FIELDS.indexOf(k)<0)o[k]=r[k]; } return o; }
function wisdomContentChecksum(records){
  var arr=(Array.isArray(records)?records:wisdomStoreList()).slice().sort(function(a,b){return String(a&&a.id).localeCompare(String(b&&b.id));}).map(_wqStripVolatile);
  var s=arr.map(function(r){return String(r&&r.id)+_wqsCanon(r);}).join('');
  if(typeof sha256Hex!=='function')return Promise.reject(new Error('sha256Hex unavailable'));
  return sha256Hex(s).then(function(hex){ return {count:arr.length,hash:hex}; });
}
window.wisdomContentChecksum=wisdomContentChecksum;

/* ── Yükleme: koleksiyonu cache'e al (bilinmeyen alan KORUNUR; normalize YOK) ──
   DB yoksa/hata → loaded=false → sharded false kalır → legacy fallback.
   HİÇBİR boot akışına bağlı DEĞİL (P1). Realtime listener KULLANMAZ (tek get()). */
function wisdomStoreLoad(uid){
  WQ_STORE_STATE.error=null; WQ_STORE_STATE.loading=true;
  var col=wisdomStoreCol(uid);
  if(!col){ WQ_STORE_STATE.loading=false; WQ_STORE_STATE.loaded=false; WQ_STORE_STATE.count=0; return Promise.resolve({ok:false,reason:'no_db'}); }
  return col.get().then(function(snap){
    WQ_STORE.clear();
    snap.forEach(function(doc){ var d=doc.data()||{}; if(d.id==null)d.id=doc.id; WQ_STORE.set(String(d.id),d); });
    WQ_STORE_STATE.loaded=true; WQ_STORE_STATE.count=WQ_STORE.size; WQ_STORE_STATE.lastLoadAt=Date.now();
    return wisdomStoreChecksum().then(function(cs){ WQ_STORE_STATE.checksum=cs.hash; },function(){ WQ_STORE_STATE.checksum=null; })
      .then(function(){ WQ_STORE_STATE.loading=false; return {ok:true,count:WQ_STORE.size,checksum:WQ_STORE_STATE.checksum}; });
  }).catch(function(e){
    WQ_STORE_STATE.loading=false; WQ_STORE_STATE.loaded=false; WQ_STORE_STATE.error=String((e&&e.message)||e||'error'); WQ_STORE_STATE.count=0;
    return {ok:false,reason:'error',error:WQ_STORE_STATE.error};
  });
}
window.wisdomStoreLoad=wisdomStoreLoad;

/* ── Durum (runtime) ── */
function wisdomStoreStatus(){
  return {loaded:WQ_STORE_STATE.loaded,loading:WQ_STORE_STATE.loading,sharded:WQ_STORE_STATE.sharded,
    error:WQ_STORE_STATE.error,count:WQ_STORE_STATE.count,checksum:WQ_STORE_STATE.checksum,
    lastLoadAt:WQ_STORE_STATE.lastLoadAt,cacheSize:WQ_STORE.size};
}
window.wisdomStoreStatus=wisdomStoreStatus;

/* ══ WRITE PRİMİTİFLERİ — P1'de UYGULANIR ama BAĞLANMAZ (boot/CRUD/import çağırmaz).
   Çağrılırsa tek dokümanı yazar; migration/dual-write P2 kapsamındadır. ══ */
function _wqsValidId(r){ return r&&typeof r==='object'&&r.id!=null&&String(r.id)!==''; }
function wisdomStoreSet(record){
  if(!_wqsValidId(record))return Promise.resolve({ok:false,error:'MISSING_ID'});
  var col=wisdomStoreCol(); if(!col)return Promise.resolve({ok:false,error:'NO_DB'});
  var id=String(record.id);
  return col.doc(id).set(record).then(function(){ WQ_STORE.set(id,record); WQ_STORE_STATE.count=WQ_STORE.size; return {ok:true,id:id}; });
}
function wisdomStoreUpdate(id,patch){
  if(id==null||String(id)==='')return Promise.resolve({ok:false,error:'MISSING_ID'});
  var col=wisdomStoreCol(); if(!col)return Promise.resolve({ok:false,error:'NO_DB'});
  var key=String(id);
  return col.doc(key).update(patch||{}).then(function(){ var cur=WQ_STORE.get(key)||{id:key}; WQ_STORE.set(key,Object.assign({},cur,patch||{})); return {ok:true,id:key}; });
}
function wisdomStoreDelete(id){
  if(id==null||String(id)==='')return Promise.resolve({ok:false,error:'MISSING_ID'});
  var col=wisdomStoreCol(); if(!col)return Promise.resolve({ok:false,error:'NO_DB'});
  var key=String(id);
  return col.doc(key).delete().then(function(){ WQ_STORE.delete(key); WQ_STORE_STATE.count=WQ_STORE.size; return {ok:true,id:key}; });
}
/* Batch (WISDOM_BATCH_SIZE/lot; Firestore 500 sınırının altında). Sıralı lotlar;
   idempotent (doküman id=quote id). */
function wisdomStoreBatchWrite(records){
  var list=(Array.isArray(records)?records:[]).filter(_wqsValidId);
  var col=wisdomStoreCol(); if(!col)return Promise.resolve({ok:false,error:'NO_DB'});
  if(typeof CLOUD==='undefined'||!CLOUD.db||typeof CLOUD.db.batch!=='function')return Promise.resolve({ok:false,error:'NO_BATCH'});
  var lots=[]; for(var i=0;i<list.length;i+=WISDOM_BATCH_SIZE)lots.push(list.slice(i,i+WISDOM_BATCH_SIZE));
  var written=0;
  function run(k){
    if(k>=lots.length)return Promise.resolve({ok:true,written:written,lots:lots.length});
    var b=CLOUD.db.batch();
    lots[k].forEach(function(r){ b.set(col.doc(String(r.id)),r); });
    return b.commit().then(function(){ lots[k].forEach(function(r){ WQ_STORE.set(String(r.id),r); }); written+=lots[k].length; WQ_STORE_STATE.count=WQ_STORE.size; return run(k+1); });
  }
  return run(0);
}
window.wisdomStoreSet=wisdomStoreSet; window.wisdomStoreUpdate=wisdomStoreUpdate;
window.wisdomStoreDelete=wisdomStoreDelete; window.wisdomStoreBatchWrite=wisdomStoreBatchWrite;

/* ══ DUAL-WRITE (P2) — YALNIZ sharded aktifken. Koleksiyon ÖNCE; ACK başarısızsa
   legacy state DEĞİŞMEZ (sessiz başarı yok). İkincil legacy yazma + save geçici
   (P3'e kadar). Idempotent (id bazlı). Toplu 4987 import bu yolu ASLA kullanmaz. ══ */
function wisdomDualApply(id,patch){
  if(!wisdomStoreIsSharded())return Promise.resolve({ok:false,reason:'not_sharded'});
  return wisdomStoreUpdate(id,patch).then(function(res){
    if(!res||!res.ok)return {ok:false,reason:'collection_failed'};       // legacy DEĞİŞMEZ
    var w=(Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]).filter(function(q){return String(q.id)===String(id);})[0];
    if(w){ Object.assign(w,patch); if(typeof save==='function')save(); } // geçici legacy + save
    return {ok:true,id:String(id)};
  },function(e){ return {ok:false,reason:'collection_failed',error:String((e&&e.message)||e)}; });
}
function wisdomDualSet(record){
  if(!wisdomStoreIsSharded())return Promise.resolve({ok:false,reason:'not_sharded'});
  if(!_wqsValidId(record))return Promise.resolve({ok:false,reason:'MISSING_ID'});
  return wisdomStoreSet(record).then(function(res){
    if(!res||!res.ok)return {ok:false,reason:'collection_failed'};
    if(!Array.isArray(D.wisdomQuotes))D.wisdomQuotes=[];
    var i=D.wisdomQuotes.map(function(q){return String(q.id);}).indexOf(String(record.id));
    if(i>=0)D.wisdomQuotes[i]=record; else D.wisdomQuotes.push(record);
    if(typeof save==='function')save();
    return {ok:true,id:String(record.id)};
  },function(e){ return {ok:false,reason:'collection_failed',error:String((e&&e.message)||e)}; });
}
function wisdomDualDelete(id){
  if(!wisdomStoreIsSharded())return Promise.resolve({ok:false,reason:'not_sharded'});
  return wisdomStoreDelete(id).then(function(res){
    if(!res||!res.ok)return {ok:false,reason:'collection_failed'};
    if(Array.isArray(D.wisdomQuotes))D.wisdomQuotes=D.wisdomQuotes.filter(function(q){return String(q.id)!==String(id);});
    if(typeof save==='function')save();
    return {ok:true,id:String(id)};
  },function(e){ return {ok:false,reason:'collection_failed',error:String((e&&e.message)||e)}; });
}
window.wisdomDualApply=wisdomDualApply; window.wisdomDualSet=wisdomDualSet; window.wisdomDualDelete=wisdomDualDelete;

/* ── Test/geçiş yardımcıları (P1'de üretimde ÇAĞRILMAZ) ── */
function wisdomStoreReset(){ WQ_STORE.clear(); WQ_STORE_STATE.loaded=false; WQ_STORE_STATE.loading=false; WQ_STORE_STATE.sharded=false; WQ_STORE_STATE.error=null; WQ_STORE_STATE.count=0; WQ_STORE_STATE.checksum=null; WQ_STORE_STATE.lastLoadAt=null; WQ_STORE_STATE.activationChecked=false; WQ_STORE_STATE.activationReady=false; WQ_STORE_STATE.activationReason=null; WQ_STORE_STATE._selfHealed=false; WQ_STORE_STATE._activationScheduled=false; }
function wisdomStoreSetSharded(v){ WQ_STORE_STATE.sharded=!!v; } // P2 boot doğrulama sonrası açar; P1'de yalnız test
function _wisdomStoreSeed(records,sharded){ WQ_STORE.clear(); (Array.isArray(records)?records:[]).forEach(function(r){ if(_wqsValidId(r))WQ_STORE.set(String(r.id),r); }); WQ_STORE_STATE.loaded=true; WQ_STORE_STATE.error=null; WQ_STORE_STATE.count=WQ_STORE.size; WQ_STORE_STATE.sharded=!!sharded; }
window.wisdomStoreReset=wisdomStoreReset; window.wisdomStoreSetSharded=wisdomStoreSetSharded; window._wisdomStoreSeed=_wisdomStoreSeed;
