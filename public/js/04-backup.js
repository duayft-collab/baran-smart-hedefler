async function sha256Hex(input){
  if(!(window.crypto&&window.crypto.subtle))
    throw new Error('Bu tarayıcı ortamında güvenli özet (SHA-256) kullanılamıyor');
  var bytes=typeof input==='string'?new TextEncoder().encode(input):input;
  var buf=await window.crypto.subtle.digest('SHA-256',bytes);
  var out='',view=new Uint8Array(buf);
  for(var i=0;i<view.length;i++)out+=view[i].toString(16).padStart(2,'0');
  return out;
}

/* ── D1: sikistirma + geri dusus ─────────────────────────────────────────── */
async function compressPayload(text){
  var raw=new TextEncoder().encode(text);
  if(typeof CompressionStream==='undefined')return {encoding:'json',bytes:raw};
  try{
    var cs=new CompressionStream('gzip');
    var w=cs.writable.getWriter();w.write(raw);w.close();
    var buf=await new Response(cs.readable).arrayBuffer();
    return {encoding:'gzip',bytes:new Uint8Array(buf)};
  }catch(e){
    console.warn('[BACKUP] gzip başarısız, düz JSON kullanılıyor',e);
    return {encoding:'json',bytes:raw};
  }
}
async function decompressPayload(bytes,encoding){
  if(encoding==='json')return new TextDecoder().decode(bytes);
  if(encoding!=='gzip')throw new Error('Bilinmeyen kodlama: '+encoding);
  if(typeof DecompressionStream==='undefined')
    throw new Error('Bu tarayıcı sıkıştırılmış yedeği açamıyor');
  var ds=new DecompressionStream('gzip');
  var w=ds.writable.getWriter();w.write(bytes);w.close();
  var buf=await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(buf);
}
/* Firestore ikili veri: compat Blob varsa onu, yoksa base64 string kullan */
function bytesToStore(u8){
  if(firebase.firestore&&firebase.firestore.Blob)
    return firebase.firestore.Blob.fromUint8Array(u8);
  var s='';for(var i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);
  return {__b64:btoa(s)};
}
function storeToBytes(v){
  if(v&&typeof v.toUint8Array==='function')return v.toUint8Array();
  if(v&&typeof v.__b64==='string'){
    var s=atob(v.__b64),u=new Uint8Array(s.length);
    for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
    return u;
  }
  if(v instanceof Uint8Array)return v;
  throw new Error('Yedek verisi okunamadı');
}

/* ── D1: ortam yetenekleri ───────────────────────────────────────────────── */
function getBackupCapabilities(){
  return {
    secureContext:typeof isSecureContext!=='undefined'?!!isSecureContext:false,
    crypto:!!(window.crypto&&window.crypto.subtle),
    compression:typeof CompressionStream!=='undefined',
    decompression:typeof DecompressionStream!=='undefined',
    firestoreReady:!!(CLOUD.db&&CLOUD.uid),
    authenticated:!!(CLOUD.user&&!CLOUD.user.isAnonymous)
  };
}
function assertCanBackup(){
  var c=getBackupCapabilities();
  if(!c.firestoreReady)throw new Error('Bulut bağlantısı hazır değil');
  if(!c.crypto)throw new Error('Güvenli özet kullanılamıyor; yedek doğrulanamayacağı için oluşturulmadı');
  return c;
}

/* ── D2: yardimcilar ─────────────────────────────────────────────────────── */
function backupsRef(uid){return CLOUD.db.collection('users').doc(uid).collection('backups');}
function blobRef(uid,id){return backupsRef(uid).doc(id).collection('blob').doc('data');}
function sanitizeText(s,max){
  if(s===undefined||s===null)return '';
  // kontrol karakterleri acik escape ile temizlenir (literal karakter kullanilmaz)
  return String(s).replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
}
function countRecords(p){
  p=p||{};
  var n=function(k){var v=p[k];
    return Array.isArray(v)?v.length:(v&&typeof v==='object'?Object.keys(v).length:0);};
  var c={goals:n('goals'),todos:n('todos'),habits:n('habits'),journal:n('journal'),
    quotes:n('quotes'),routines:n('routines'),kpis:n('kpis'),logs:n('logs')};
  var t=0;Object.keys(p).forEach(function(k){
    var v=p[k];
    if(Array.isArray(v))t+=v.length;
    else if(v&&typeof v==='object')t+=Object.keys(v).length;
  });
  c.totalRecords=t;
  return c;
}
/* Yedek zaman damgasi oturum icinde KESIN ARTAN olmalidir. Ayni milisaniyede iki
   yedek olusursa hem Firestore hem yerel siralama esitligi belge kimligiyle bozar;
   kimlik hash tabanli oldugu icin kronolojik degildir ve zincir/rotasyon sirasi
   belirsizlesir. Monotonik damga bu belirsizligi tamamen kaldirir. */
var lastBackupTs=0;
function nextBackupTs(){
  var t=Date.now();
  if(t<=lastBackupTs)t=lastBackupTs+1;
  lastBackupTs=t;
  return t;
}
function stagingList(){
  try{return JSON.parse(localStorage.getItem(STAGING_KEY)||'[]');}catch(e){return [];}
}
function stagingAdd(id){
  try{var l=stagingList();l.push({id:id,at:Date.now()});
    localStorage.setItem(STAGING_KEY,JSON.stringify(l.slice(-20)));}catch(e){}
}
function stagingRemove(id){
  try{localStorage.setItem(STAGING_KEY,
    JSON.stringify(stagingList().filter(function(x){return x.id!==id;})));}catch(e){}
}

/* Suspect: bozulmus bir state'in otomatik yedeklenip iyi yedekleri
   rotasyonla silmesini onler. */
function detectSuspect(counts,plainBytes,prev){
  if(!prev)return {suspect:false,reason:''};
  var pc=prev.counts||{},pb=Number(prev.plainBytes||0);
  var reasons=[];
  if(pc.totalRecords>0&&counts.totalRecords<pc.totalRecords*0.5)
    reasons.push('kayıt sayısı %50\'den fazla düştü ('+pc.totalRecords+' -> '+counts.totalRecords+')');
  if(pb>0&&plainBytes<pb*0.4)
    reasons.push('veri boyutu %60\'tan fazla düştü ('+pb+' -> '+plainBytes+' bayt)');
  ['goals','todos','habits','quotes'].forEach(function(k){
    if((pc[k]||0)>0&&(counts[k]||0)===0)reasons.push(k+' alanı sıfırlandı');
  });
  return {suspect:reasons.length>0,reason:reasons.join('; ')};
}

/* ── D2: yedek olustur ───────────────────────────────────────────────────── */
async function createBackup(reason,options){
  options=options||{};
  if(BACKUP_REASONS.indexOf(reason)<0)throw new Error('Geçersiz yedek nedeni: '+reason);
  // Restore kilidi: yalniz dogrulanmis dahili before_restore izinli (operationId eslesmeli).
  if(RESTORE.state!=='IDLE'){
    var okBefore=reason==='before_restore'&&options.__restoreOperationId&&
      options.__restoreOperationId===RESTORE.operationId;
    if(!okBefore)throw new Error('Geri yükleme sırasında yedek oluşturulamaz');
  }
  assertCanBackup();
  var uid=CLOUD.uid;

  var payload=JSON.parse(JSON.stringify(options.payload||D));      // derin snapshot
  var plain=canonicalStringify(payload);
  var plainSha256=await sha256Hex(plain);
  var plainBytes=new TextEncoder().encode(plain).length;
  var counts=countRecords(payload);

  var prev=await lastCompleteBackup(uid);

  // Dedup: ayni icerik + ayni reason kisa sure icinde tekrar yazilmaz
  if(!options.force&&prev&&prev.plainSha256===plainSha256&&prev.reason===reason&&
     (Date.now()-Number(prev.createdAtClient||0))<BACKUP.DEDUP_WINDOW_MS){
    console.log('[BACKUP] Aynı içerik zaten yedeklenmiş, atlandı:',prev.id);
    return {skipped:true,reason:'duplicate',id:prev.id};
  }

  var comp=await compressPayload(plain);
  var blobSha256=await sha256Hex(comp.bytes);
  var sus=detectSuspect(counts,plainBytes,prev);
  var now=nextBackupTs();
  var id=now+'-'+plainSha256.slice(0,8)+'-'+Math.random().toString(36).slice(2,6);

  stagingAdd(id);
  // 1) once blob
  await blobRef(uid,id).set({
    data:bytesToStore(comp.bytes), encoding:comp.encoding,
    blobSha256:blobSha256, storedBytes:comp.bytes.length, backupVersion:BACKUP_VERSION,
    status:'staging'
  });
  // 2) blob'un gercekten yazildigini dogrula
  var check=await blobRef(uid,id).get();
  if(!check.exists)throw new Error('Yedek verisi yazılamadı');

  // 3) metadata SON: commit isareti
  var meta={
    backupVersion:BACKUP_VERSION, manifestVersion:BACKUP_VERSION,
    schemaVersion:SCHEMA_VERSION, appVersion:APP_VERSION,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(), createdAtClient:now,
    createdByUid:uid, createdByDeviceId:deviceId(),
    reason:reason,
    label:sanitizeText(options.label,BACKUP.LABEL_MAX),
    note:sanitizeText(options.note,BACKUP.NOTE_MAX),
    sourceRevision:Number(CLOUD.revision||0),
    pinned:!!options.pinned, suspect:sus.suspect, suspectReason:sus.reason,
    encoding:comp.encoding, plainSha256:plainSha256, blobSha256:blobSha256,
    plainBytes:plainBytes, storedBytes:comp.bytes.length,
    compressionRatio:plainBytes>0?Number((comp.bytes.length/plainBytes).toFixed(4)):1,
    counts:counts,
    previousBackupHash:prev?prev.plainSha256:null,
    status:'complete'
  };
  meta.labelLower=meta.label.toLowerCase();
  meta.noteLower=meta.note.toLowerCase();
  await backupsRef(uid).doc(id).set(meta);
  stagingRemove(id);
  console.log('[BACKUP] Oluşturuldu:',id,reason,counts.totalRecords+' kayıt',
    comp.encoding,comp.bytes.length+'B'+(sus.suspect?' SUSPECT':''));

  try{await rotateBackups();}catch(e){console.warn('[BACKUP:ROTATE] Rotasyon başarısız',e);}
  return {skipped:false,id:id,meta:meta};
}
async function lastCompleteBackup(uid){
  var q=await backupsRef(uid).orderBy('createdAtClient','desc').limit(5).get();
  var found=null;
  q.forEach(function(d){
    if(found)return;
    var m=d.data()||{};
    if(m.status==='complete'&&!m.suspect){found=Object.assign({id:d.id},m);}
  });
  return found;
}

/* ── D2: rotasyon ────────────────────────────────────────────────────────── */
function backupClass(m){
  if(m.reason==='manual')return 'manual';
  if(m.reason==='daily')return 'daily';
  if(String(m.reason||'').indexOf('before_')===0)return 'emergency';
  return 'other';
}
async function rotateBackups(){
  if(!CLOUD.uid)return {deleted:0};
  var uid=CLOUD.uid;
  var q=await backupsRef(uid).orderBy('createdAtClient','desc').get();
  var all=[];
  q.forEach(function(d){var m=d.data()||{};if(m.status==='complete')all.push(Object.assign({id:d.id},m));});
  if(all.length<=1)return {deleted:0};

  var groups={manual:[],daily:[],emergency:[],other:[]};
  all.forEach(function(m){groups[backupClass(m)].push(m);});

  var doomed=[],now=Date.now();
  function mark(list,keep){
    for(var i=keep;i<list.length;i++)doomed.push(list[i]);
  }
  mark(groups.manual,BACKUP.KEEP.manual);
  mark(groups.other,BACKUP.KEEP.manual);
  // acil yedekler: sayi siniri VE 30 gunluk dokunulmazlik
  groups.emergency.forEach(function(m,i){
    if(i>=BACKUP.KEEP.emergency&&(now-Number(m.createdAtClient||0))>BACKUP.KEEP.emergencyMinAgeMs)
      doomed.push(m);
  });
  // daily: GFS-lite
  var kept={},dailyKeep=[];
  groups.daily.forEach(function(m){
    var d=new Date(Number(m.createdAtClient||0));
    var day=d.toISOString().slice(0,10), wk=d.getUTCFullYear()+'-W'+U.isoWeek(d), mo=d.toISOString().slice(0,7);
    var age=now-Number(m.createdAtClient||0);
    var tag=null;
    if(age<=7*864e5)tag='d:'+day; else if(age<=35*864e5)tag='w:'+wk; else tag='m:'+mo;
    if(!kept[tag]){kept[tag]=1;dailyKeep.push(m);}else doomed.push(m);
  });
  if(dailyKeep.length>BACKUP.KEEP.dailyDaily+BACKUP.KEEP.dailyWeekly+BACKUP.KEEP.dailyMonthly)
    mark(dailyKeep,BACKUP.KEEP.dailyDaily+BACKUP.KEEP.dailyWeekly+BACKUP.KEEP.dailyMonthly);

  // Muafiyetler ve invaryant
  doomed=doomed.filter(function(m){return !m.pinned&&!m.suspect;});
  var newestOf={};
  all.forEach(function(m){var c=backupClass(m);if(!newestOf[c]&&!m.suspect)newestOf[c]=m.id;});
  doomed=doomed.filter(function(m){return newestOf[backupClass(m)]!==m.id;});
  var survivors=all.length-doomed.length;
  if(survivors<1)return {deleted:0,blocked:'invaryant'};
  doomed=doomed.slice(0,BACKUP.ROTATE_MAX_DELETE);

  var deleted=0;
  for(var i=0;i<doomed.length;i++){
    var m=doomed[i];
    try{
      await blobRef(uid,m.id).delete();          // once blob
      await backupsRef(uid).doc(m.id).delete();  // sonra metadata
      deleted++;
      console.log('[BACKUP:ROTATE] Silindi:',m.id,m.reason);
    }catch(e){
      console.warn('[BACKUP:ROTATE] Silinemedi, metadata korundu:',m.id,e);
    }
  }
  return {deleted:deleted,considered:doomed.length};
}

/* ── D2: orphan temizligi ────────────────────────────────────────────────── */
async function cleanupOrphanBackups(){
  if(!CLOUD.uid)return {cleaned:0};
  var uid=CLOUD.uid,now=Date.now(),cleaned=0,keep=[];
  var list=stagingList();
  for(var i=0;i<list.length;i++){
    var e=list[i];
    if(now-Number(e.at||0)<24*3600*1000){keep.push(e);continue;}
    try{
      var meta=await backupsRef(uid).doc(e.id).get();
      if(meta.exists&&(meta.data()||{}).status==='complete'){continue;} // aslinda tamamlanmis
      await blobRef(uid,e.id).delete();
      try{await backupsRef(uid).doc(e.id).delete();}catch(x){}
      cleaned++;
      console.log('[BACKUP:ORPHAN] Temizlendi:',e.id);
    }catch(err){keep.push(e);console.warn('[BACKUP:ORPHAN] Temizlenemedi',e.id,err);}
  }
  try{localStorage.setItem(STAGING_KEY,JSON.stringify(keep));}catch(e){}
  return {cleaned:cleaned};
}

/* ── D3: listeleme (blob indirmez) ───────────────────────────────────────── */
async function listBackups(options){
  options=options||{};
  if(!CLOUD.uid)throw new Error('Bulut bağlantısı hazır değil');
  var q=await backupsRef(CLOUD.uid).orderBy('createdAtClient','desc')
    .limit(options.limit||30).get();
  var out=[];
  q.forEach(function(d){
    var m=d.data()||{};
    if(m.status!=='complete')return;
    out.push(Object.assign({id:d.id},m));
  });
  if(options.search){
    var s=String(options.search).toLowerCase();
    out=out.filter(function(m){
      return (m.labelLower||'').indexOf(s)>=0||(m.noteLower||'').indexOf(s)>=0||
             (m.reason||'').indexOf(s)>=0;});
  }
  if(options.reason)out=out.filter(function(m){return m.reason===options.reason;});
  return out;
}

/* ── D3: saglik degerlendirmesi ──────────────────────────────────────────── */
function scoreHealth(r){
  // Hash basarisizligi PUANLA MASKELENMEZ: dogrudan Corrupted.
  if(r.blobHashOk===false||r.plainHashOk===false||r.parseOk===false)
    return {status:'Corrupted',score:0};
  if(r.incomplete)return {status:'Incomplete',score:0};
  if(r.futureSchema)return {status:'Unsupported Future Schema',score:0};
  var s=0;
  s+=r.blobHashOk?30:0;
  s+=r.plainHashOk?25:0;
  s+=r.schemaEqual?15:(r.schemaMigratable?8:0);
  s+=r.metaOk?10:0;
  s+=r.plausible?10:0;
  var age=r.lastVerifiedAt?Date.now()-r.lastVerifiedAt:null;
  s+=(age!==null&&age<BACKUP.VERIFY_FRESH_MS)?10:((age!==null&&age<BACKUP.VERIFY_STALE_MS)?5:0);
  var status='Healthy';
  if(r.suspect||!r.plausible||r.countsMismatch||r.chainStatus==='broken')status='Suspect';
  else if(!r.schemaEqual&&r.schemaMigratable)status='Migration Required';
  else if(r.legacy)status='Legacy';
  else if(r.blobHashOk&&r.plainHashOk)status='Verified';
  return {status:status,score:Math.max(0,Math.min(100,s))};
}

/* ── D3: tek yedegi dogrula (hicbir state degistirmez) ───────────────────── */
async function verifyBackup(backupId,options){
  options=options||{};
  if(!CLOUD.uid)throw new Error('Bulut bağlantısı hazır değil');
  var uid=CLOUD.uid,r={id:backupId,checkedAt:Date.now()};
  var metaSnap=await backupsRef(uid).doc(backupId).get();
  if(!metaSnap.exists){r.incomplete=true;r.error='Metadata bulunamadı';
    return Object.assign(r,scoreHealth(r));}
  var m=metaSnap.data()||{};
  r.reason=m.reason;r.label=m.label;r.suspect=!!m.suspect;
  r.lastVerifiedAt=Number(m.lastVerifiedAt||0)||null;
  if(m.status!=='complete'){r.incomplete=true;r.error='Yedek tamamlanmamış';
    return Object.assign(r,scoreHealth(r));}
  r.metaOk=!!(m.plainSha256&&m.blobSha256&&m.encoding&&m.counts);
  r.legacy=!m.plainSha256||!m.blobSha256;

  var blobSnap=await blobRef(uid,backupId).get();
  if(!blobSnap.exists){r.incomplete=true;r.error='Yedek verisi bulunamadı';
    return Object.assign(r,scoreHealth(r));}
  var b=blobSnap.data()||{};

  try{
    var bytes=storeToBytes(b.data);
    r.blobHashOk=(await sha256Hex(bytes))===m.blobSha256;
    if(!r.blobHashOk){r.error='Sıkıştırılmış veri özeti uyuşmuyor';
      return Object.assign(r,scoreHealth(r));}
    var text=await decompressPayload(bytes,m.encoding||b.encoding);
    r.plainHashOk=(await sha256Hex(text))===m.plainSha256;
    if(!r.plainHashOk){r.error='Veri özeti uyuşmuyor';
      return Object.assign(r,scoreHealth(r));}
    var parsed=JSON.parse(text);
    r.parseOk=true;
    // kanonik yeniden uretim: serilestirme kararliligini dogrular
    r.canonicalStable=canonicalStringify(parsed)===text;
    var recount=countRecords(parsed);
    // Firestore map alanlarinin anahtar sirasini KORUMAZ. JSON.stringify siraya
    // duyarli oldugu icin ayni degerleri farkli sirada gelince yanlis uyusmazlik
    // uretiyordu. Kanonik karsilastirma sira bagimsizdir.
    r.countsMismatch=canonicalStringify(recount)!==canonicalStringify(m.counts||{});
    r.counts=recount;
    r.plausible=recount.totalRecords>0&&!r.countsMismatch;
  }catch(e){
    r.parseOk=false;r.error=e.message;
    return Object.assign(r,scoreHealth(r));
  }

  var sv=Number(m.schemaVersion||0);
  r.schemaEqual=sv===SCHEMA_VERSION;
  r.schemaMigratable=sv>0&&sv<SCHEMA_VERSION;
  r.futureSchema=sv>SCHEMA_VERSION;
  r.chainStatus=options.chainStatus||'unknown';

  var h=scoreHealth(r);
  Object.assign(r,h);
  if(options.cache!==false){
    // Degistirilemezlik payload ve hash alanlarina aittir; yalniz dogrulama
    // sonucu alanlari guncellenir.
    try{await backupsRef(uid).doc(backupId).update({
      lastVerifiedAt:Date.now(),verifyResult:r.error?String(r.error):'ok',
      healthStatus:h.status,healthScore:h.score});}catch(e){
      console.warn('[BACKUP:VERIFY] Sonuç önbelleğe yazılamadı',e);}
  }
  console.log('[BACKUP:VERIFY]',backupId,h.status,h.score);
  return r;
}

/* Zincir: rotasyon eski yedegi sildiginde kirik degil 'pruned' sayilir. */
function evaluateChain(list){
  var byHash={};list.forEach(function(m){byHash[m.plainSha256]=true;});
  var oldest=list.length?Number(list[list.length-1].createdAtClient||0):0;
  return list.map(function(m){
    var st;
    if(!m.previousBackupHash)st='root';
    else if(byHash[m.previousBackupHash])st='ok';
    else if(Number(m.createdAtClient||0)<=oldest)st='pruned';
    else st='pruned';   // referans listeden once budanmis
    return {id:m.id,chainStatus:st};
  });
}

/* ── D3: toplu dogrulama (kota dostu, sirali) ────────────────────────────── */
async function verifyAllBackups(options){
  options=options||{};
  var limit=options.limit||10;
  var list=await listBackups({limit:Math.max(limit,30)});
  var chain={};evaluateChain(list).forEach(function(c){chain[c.id]=c.chainStatus;});
  var targets=list.slice(0,limit),results=[];
  for(var i=0;i<targets.length;i++){
    try{
      var r=await verifyBackup(targets[i].id,{chainStatus:chain[targets[i].id],cache:options.cache});
      results.push(r);
    }catch(e){
      results.push({id:targets[i].id,status:'Corrupted',score:0,error:e.message});
    }
    if(options.onProgress)try{options.onProgress(i+1,targets.length,results[results.length-1]);}catch(e){}
  }
  var bad=results.filter(function(r){return r.status==='Corrupted'||r.status==='Incomplete';});
  console.log('[BACKUP:VERIFY] '+results.length+' yedek denetlendi, '+bad.length+' sorunlu');
  return {checked:results.length,problems:bad.length,results:results};
}

/* ══════════════════════════════════════════════════════════════════════════
   D4 — DIFF MOTORU VE RESTORE PREVIEW (saf fonksiyonlar)
   Firestore erisimi yalnizca diffBackups seviyesinde. diffPayloads saftir.
   ══════════════════════════════════════════════════════════════════════════ */

/* Tek kaynak: payload tip haritasi. 15 dizi + 7 nesne + 5 skaler = 27 alan.
   logs kayitlarinda kararli id yoktur; icerik tabanli eslenir (indeks DEGIL). */
var DIFF_SCHEMA={
  arrays:[
    {field:'goals',identity:'id',critical:true},
    {field:'todos',identity:'id',critical:true},
    {field:'habits',identity:'id',critical:true},
    {field:'quotes',identity:'id'},
    {field:'kpis',identity:'id'},
    {field:'journal',identity:'id'},
    {field:'principles',identity:'id'},
    {field:'coaching',identity:'id'},
    {field:'sops',identity:'id'},
    {field:'gtdInbox',identity:'id'},
    {field:'questions',identity:'id'},
    {field:'mybooks',identity:'id'},
    {field:'challenges',identity:'id'},
    {field:'vault',identity:'id'},
    {field:'generalNotes',identity:'id'},
    {field:'logs',identity:'content'}
  ],
  objects:['routines','timeblocks','weeklyReview','oneThing','compat','savedResources','stats'],
  scalars:['readingPlan','scratch','vol','activeSound','deepWorkSessions']
};
var DIFF_LIMITS={detailLimit:100, previewMax:120, missingLow:5};
var IMPACT_RULES={highDeletePct:0.20, criticalModules:['goals','todos','habits'],
  criticalDropPct:0.5};

