/* ══════════════════════════════════════════════════════════════════════════
   D10.6.1 — ÖZ SÖZLER → ÖZLÜ SÖZLER MIGRATION  (admin-only, idempotent)
   Legacy D.quotes {id,text,author,cat} → wisdomQuotes kanonik modeli.
   Additive. Öz Sözler menü/route/CRUD/rndQuote/quoteWidget/dashboard/detectSuspect
   ve D10.2/10.3/10.5.x'e DOKUNMAZ. Yalnız wisdomQuotes'a ekler + migration marker yazar.
   Write disiplini: dry-run/preview/cancel = 0-write; execute = zorunlu backup + TEK save().
   ══════════════════════════════════════════════════════════════════════════ */
var MIG_ID='ozSozlerToWisdom';
var MIG_VERSION=1;

/* Tek timestamp kaynağı (execute başına bir kez çağrılır). */
function migNow(){ try{return new Date().toISOString();}catch(e){return String(Date.now());} }

/* Quote-only normalize — 11a'daki _wqNorm ile birebir (tutarlılık). */
function migNorm(s){
  if(typeof _wqNorm==='function')return _wqNorm(s);
  return String(s==null?'':s).toLocaleLowerCase('tr').replace(/\s+/g,' ').trim();
}

/* Deterministik checksum: FNV-1a 32-bit, canonicalStringify(sıralı liste) üzerinden.
   Crypto gerekmez; test edilebilir ve sıra-bağımsızdır (girdi sort edilir). */
function migChecksum(list){
  var arr=(Array.isArray(list)?list.slice():[]).map(function(x){return String(x);}).sort();
  var s=(typeof canonicalStringify==='function')?canonicalStringify(arr):JSON.stringify(arr);
  var h=0x811c9dc5>>>0;
  for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=(h*0x01000193)>>>0; }
  return ('00000000'+h.toString(16)).slice(-8);
}

/* Legacy → kanonik ham eşleme (henüz normalize edilmemiş). */
function migMapRaw(legacy,ts){
  var cat=String(legacy&&legacy.cat!=null?legacy.cat:'').trim()||'Genel';
  return {
    id:'ozs-'+String(legacy&&legacy.id),
    quote:legacy?legacy.text:'',
    author:legacy?legacy.author:'',
    category:cat,
    tags:[cat,'legacy'],
    language:'tr',
    favorite:false, active:true, pinned:false,
    priority:3, notes:'',
    source:'Legacy Öz Sözler',
    reflected:false,
    createdAt:ts, updatedAt:ts,
    lastShownAt:null, showCount:0
  };
}
/* normalizeWisdomQuote üzerinden geçir — BYPASS YOK. Boşsa null döner. */
function migBuildRecord(legacy,ts){
  if(typeof normalizeWisdomQuote!=='function')return null;
  return normalizeWisdomQuote(migMapRaw(legacy,ts),0);
}

var MIG_LIMIT=(typeof WQ_LIMITS!=='undefined'&&WQ_LIMITS.quote)?WQ_LIMITS.quote:1000;

/* Legacy kayıt migration'a uygun mu? Uygun değilse structured hata. */
function migValidateLegacy(q){
  var prev=String(q&&q.text!=null?q.text:'').slice(0,60);
  if(!q||typeof q!=='object')return {ok:false,code:'EMPTY_TEXT',field:'text',message:'Geçersiz kayıt',rawPreview:''};
  if(q.id==null||q.id==='')return {ok:false,code:'MISSING_ID',field:'id',message:'Legacy id yok',rawPreview:prev};
  var t=String(q.text==null?'':q.text).trim();
  if(!t)return {ok:false,code:'EMPTY_TEXT',field:'text',message:'Metin boş',rawPreview:prev};
  if(!/[\p{L}]/u.test(t)){
    if(/\d/.test(t)&&!/[^\d\s.,]/.test(t))return {ok:false,code:'NUMERIC_ONLY',field:'text',message:'Yalnız sayı',rawPreview:prev};
    return {ok:false,code:'PUNCTUATION_ONLY',field:'text',message:'Yalnız noktalama',rawPreview:prev};
  }
  if(t.length>MIG_LIMIT)return {ok:false,code:'TEXT_TOO_LONG',field:'text',message:'Metin çok uzun',rawPreview:prev};
  if(!migBuildRecord(q,'__probe__'))return {ok:false,code:'NORMALIZATION_FAILED',field:'text',message:'Normalize başarısız',rawPreview:prev};
  return {ok:true};
}
function migPortable(q){ return migValidateLegacy(q).ok; }

/* State imzası — preview-stale tespiti için (D.quotes + wisdom + revision + marker). */
function migSignature(){
  var q=(typeof canonicalStringify==='function')?canonicalStringify((D.quotes||[]).map(function(x){return [x.id,x.text,x.author,x.cat];})):JSON.stringify(D.quotes||[]);
  var w=(typeof canonicalStringify==='function')?canonicalStringify((typeof wqList==='function'?wqList():D.wisdomQuotes||[]).map(function(x){return [String(x.id),migNorm(x.quote)];})):'';
  var rev=(typeof CLOUD!=='undefined'&&CLOUD)?String(CLOUD.revision):'0';
  var m=(typeof canonicalStringify==='function')?canonicalStringify((D.migrations&&D.migrations[MIG_ID])||null):'';
  return migChecksum([q,w,rev,m]);
}

/* ── DRY-RUN (kesin 0-write) ─────────────────────────────────────────────── */
function migDryRun(ts){
  ts=ts||migNow();
  var legacy=Array.isArray(D.quotes)?D.quotes.slice():[];
  var existing=(typeof wqList==='function')?wqList():(D.wisdomQuotes||[]);
  var byId={}, byNorm={};
  existing.forEach(function(w){ byId[String(w.id)]=w; var k=migNorm(w.quote); (byNorm[k]=byNorm[k]||[]).push(w); });
  var recordsToAdd=[], errors=[], exactDuplicates=[], quoteDuplicates=[], authorConflicts=[];
  var seenId={}, seenNorm={};
  legacy.forEach(function(q){
    var v=migValidateLegacy(q);
    if(!v.ok){ errors.push({legacyId:(q&&q.id!=null)?q.id:null,code:v.code,field:v.field,message:v.message,rawPreview:v.rawPreview}); return; }
    var newId='ozs-'+String(q.id);
    if(byId[newId]){ exactDuplicates.push({legacyId:q.id,code:'DUPLICATE_ID',newId:newId}); return; }
    if(seenId[newId]){ errors.push({legacyId:q.id,code:'DUPLICATE_ID',field:'id',message:'Legacy id yinelendi',rawPreview:String(q.text||'').slice(0,60)}); return; }
    var nq=migNorm(q.text);
    var hit=byNorm[nq];
    if(hit&&hit.length){
      var na=migNorm(q.author);
      var diffAuthor=hit.every(function(w){ return migNorm(w.author)!==na; });
      if(diffAuthor)authorConflicts.push({legacyId:q.id,code:'SAME_QUOTE_DIFFERENT_AUTHOR',quote:String(q.text||'').slice(0,80),legacyAuthor:q.author,existingAuthor:hit[0].author});
      quoteDuplicates.push({legacyId:q.id,code:'DUPLICATE_QUOTE'});
      return;
    }
    if(seenNorm[nq]){ quoteDuplicates.push({legacyId:q.id,code:'DUPLICATE_QUOTE'}); return; }
    var rec=migBuildRecord(q,ts);
    if(!rec){ errors.push({legacyId:q.id,code:'NORMALIZATION_FAILED',field:'text',message:'Normalize başarısız',rawPreview:String(q.text||'').slice(0,60)}); return; }
    seenId[newId]=1; seenNorm[nq]=1; recordsToAdd.push(rec);
  });
  var wisdomBefore=existing.length;
  var addCount=recordsToAdd.length;
  var duplicateCount=exactDuplicates.length+quoteDuplicates.length;
  var invalidCount=errors.length;
  // checksumBefore: taşınabilir legacy'nin BENZERSİZ normalize quote seti
  var portNorm=[], seenP={};
  legacy.forEach(function(q){ if(migPortable(q)){ var n=migNorm(q.text); if(!seenP[n]){seenP[n]=1;portNorm.push(n);} } });
  return {
    legacyCount:legacy.length, wisdomBefore:wisdomBefore,
    addCount:addCount, skipCount:duplicateCount, duplicateCount:duplicateCount, invalidCount:invalidCount,
    wisdomAfter:wisdomBefore+addCount,
    exactDuplicates:exactDuplicates, quoteDuplicates:quoteDuplicates, authorConflicts:authorConflicts,
    errors:errors, recordsToAdd:recordsToAdd,
    checksumBefore:migChecksum(portNorm), portableNorm:portNorm,
    ts:ts, sig:migSignature()
  };
}

/* ── Idempotency durumu ──────────────────────────────────────────────────── */
function migStatus(){
  var m=(D.migrations&&D.migrations[MIG_ID])||null;
  if(!m)return {status:'NOT_RUN'};
  var existing=(typeof wqList==='function')?wqList():(D.wisdomQuotes||[]);
  var haveId={}, haveNorm={};
  existing.forEach(function(w){ haveId['ozs-'+String(w.id).replace(/^ozs-/,'')]=1; haveId[String(w.id)]=1; haveNorm[migNorm(w.quote)]=1; });
  var portable=(D.quotes||[]).filter(migPortable);
  var missing=portable.filter(function(q){ return !haveId['ozs-'+String(q.id)] && !haveNorm[migNorm(q.text)]; });
  if(missing.length)return {status:'MARKER_INCONSISTENT',missing:missing.map(function(q){return q.id;}),marker:m};
  return {status:'ALREADY_COMPLETED',marker:m};
}

/* ── Admin gate (fail-closed) ────────────────────────────────────────────── */
function migIsAdmin(){ return typeof isCurrentUserAdmin==='function' && isCurrentUserAdmin()===true; }

/* ── EXECUTE (zorunlu backup + TEK save) ─────────────────────────────────── */
async function migExecute(preview){
  if(!migIsAdmin())return {status:'ADMIN_REQUIRED'};
  var stt=migStatus();
  if(stt.status==='ALREADY_COMPLETED')return {status:'ALREADY_COMPLETED',marker:stt.marker,wisdomAfter:((typeof wqList==='function')?wqList():D.wisdomQuotes||[]).length};
  if(stt.status==='MARKER_INCONSISTENT')return {status:'MARKER_INCONSISTENT',missing:stt.missing};
  var ts=migNow();
  var dry=migDryRun(ts);
  if(preview&&preview.sig&&preview.sig!==dry.sig)return {status:'PREVIEW_STALE'};
  // Zorunlu güvenlik yedeği — force
  var bk;
  try{ bk=await createBackup('before_migration',{force:true,label:'Öz Sözler → Özlü Sözler migration öncesi'}); }
  catch(e){ return {status:'BACKUP_FAILED',error:'backup_error'}; }
  if(!bk||!bk.id)return {status:'BACKUP_FAILED',error:'no_backup_id'};
  // Mutasyon ÖNCESİ checksum doğrulaması (yeni wisdom in-memory hesaplanır, atanmaz)
  var existing=(typeof wqList==='function')?wqList():(D.wisdomQuotes||[]);
  var checksumBefore=migChecksum(dry.portableNorm);
  var newWisdom=existing.concat(dry.recordsToAdd);
  var have={}; newWisdom.forEach(function(w){ have[migNorm(w.quote)]=1; });
  var missing=dry.portableNorm.filter(function(n){ return !have[n]; });
  var checksumAfter=migChecksum(dry.portableNorm.filter(function(n){ return have[n]; }));
  if(missing.length||checksumAfter!==checksumBefore){
    return {status:'CHECKSUM_MISMATCH',missingCount:missing.length,checksumBefore:checksumBefore,checksumAfter:checksumAfter,backupId:bk.id};
  }
  var marker={version:MIG_VERSION,completedAt:ts,legacyCount:dry.legacyCount,addedCount:dry.addCount,skippedCount:dry.skipCount,invalidCount:dry.invalidCount,checksumBefore:checksumBefore,checksumAfter:checksumAfter};
  // ── TEK WRITE YOLU ──
  if(typeof snap==='function')snap();
  D.wisdomQuotes=newWisdom;
  if(!D.migrations||typeof D.migrations!=='object')D.migrations={};
  D.migrations[MIG_ID]=marker;
  if(typeof save==='function')save();
  return {
    status:'OK', backupId:bk.id, migrationVersion:MIG_VERSION,
    legacyCount:dry.legacyCount, wisdomBefore:dry.wisdomBefore, addedCount:dry.addCount,
    skippedCount:dry.skipCount, duplicateCount:dry.duplicateCount, invalidCount:dry.invalidCount,
    wisdomAfter:newWisdom.length, checksumBefore:checksumBefore, checksumAfter:checksumAfter,
    checksumMatch:checksumAfter===checksumBefore, missingCount:0, completedAt:ts
  };
}

/* ── JSON önizleme export (hassas veri YOK) ──────────────────────────────── */
function migPreviewJson(dry){
  dry=dry||migDryRun();
  return JSON.stringify({
    migrationVersion:MIG_VERSION,
    generatedAt:dry.ts,
    counts:{legacyCount:dry.legacyCount,wisdomBefore:dry.wisdomBefore,addCount:dry.addCount,skipCount:dry.skipCount,duplicateCount:dry.duplicateCount,invalidCount:dry.invalidCount,wisdomAfter:dry.wisdomAfter},
    records:dry.recordsToAdd,
    conflicts:dry.authorConflicts,
    errors:dry.errors
  },null,2);
}

/* ── Admin-only giriş butonu (Özlü Sözler ekranı başlığına hook) ──────────── */
function wisdomMigrationButtonHtml(){
  if(!migIsAdmin())return '';
  return '<button class="btn btn-s" style="margin-left:6px" data-mig="1" onclick="migOpenWizard()" title="Legacy Öz Sözler arşivini Özlü Sözler kütüphanesine taşı">'+((typeof ic==='function')?ic('arc',13):'⤵')+' Öz Sözler Taşı</button>';
}

/* ══════════════════════════════════════════════════════════════════════════
   WIZARD UI  (admin-only)  ·  dry-run → preview → onay checkbox → execute → sonuç
   ══════════════════════════════════════════════════════════════════════════ */
var MIG_WIZ={preview:null,confirmed:false};
function _migEsc(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(s):String(s==null?'':s); }

function migOpenWizard(){
  if(!migIsAdmin()){ if(typeof wqToast==='function')wqToast('Bu işlem yalnız yöneticiye açıktır',true); return; }
  MIG_WIZ.preview=migDryRun();
  MIG_WIZ.confirmed=false;
  if(typeof showModal==='function')showModal(migWizardHtml(MIG_WIZ.preview));
}
function migWizardHtml(p){
  var conflictRows=(p.authorConflicts||[]).slice(0,20).map(function(c){
    return '<div style="font-size:11px;color:var(--t2);padding:4px 0;border-bottom:1px solid rgba(0,0,0,.05)">&ldquo;'+_migEsc(c.quote)+'&rdquo;<br><span style="color:var(--orange)">Legacy: '+_migEsc(c.legacyAuthor)+' · Mevcut: '+_migEsc(c.existingAuthor)+'</span></div>';
  }).join('');
  var errRows=(p.errors||[]).slice(0,20).map(function(e){
    return '<div style="font-size:11px;color:var(--red);padding:3px 0">#'+_migEsc(e.legacyId)+' · '+_migEsc(e.code)+' · '+_migEsc(e.rawPreview)+'</div>';
  }).join('');
  var row=function(l,v,c){ return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.05)"><span style="color:var(--t2);font-size:12px">'+l+'</span><span style="font-weight:700;font-size:13px'+(c?';color:'+c:'')+'">'+v+'</span></div>'; };
  var h='<div class="mh"><span style="font-weight:700;font-size:15px">Öz Sözler → Özlü Sözler Taşıma</span><button class="btn btn-g btn-ic" onclick="closeModal()">'+((typeof ic==='function')?ic('x',14):'x')+'</button></div><div class="mb">';
  h+='<p style="font-size:12px;color:var(--t3);margin-bottom:10px">Bu işlem legacy Öz Sözler arşivini Özlü Sözler kütüphanesine taşır. Eski Öz Sözler ekranı bu adımda KALDIRILMAZ. Migration öncesi otomatik güvenlik yedeği alınır.</p>';
  h+=row('Legacy (Öz Sözler)',p.legacyCount);
  h+=row('Özlü Sözler (mevcut)',p.wisdomBefore);
  h+=row('Eklenecek',p.addCount,'var(--green)');
  h+=row('Atlanacak (mükerrer)',p.duplicateCount,p.duplicateCount?'var(--orange)':'');
  h+=row('Hatalı (taşınmaz)',p.invalidCount,p.invalidCount?'var(--red)':'');
  h+=row('Aynı söz farklı yazar',p.authorConflicts.length,p.authorConflicts.length?'var(--orange)':'');
  h+=row('Taşıma sonrası toplam',p.wisdomAfter,'var(--blue)');
  h+=row('Checksum (öncesi)',_migEsc(p.checksumBefore));
  if(conflictRows)h+='<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--orange)">Aynı söz farklı yazar ('+p.authorConflicts.length+') — güvenli atlandı</summary><div style="margin-top:6px">'+conflictRows+'</div></details>';
  if(errRows)h+='<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--red)">Hatalı kayıtlar ('+p.errors.length+')</summary><div style="margin-top:6px">'+errRows+'</div></details>';
  h+='<div style="margin-top:12px"><button class="btn btn-s btn-sm" onclick="migDownloadJson()">'+((typeof ic==='function')?ic('arc',12):'')+' Taşınacakları JSON indir</button></div>';
  h+='<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-top:14px"><input type="checkbox" class="cb" id="mig_confirm" onchange="migToggleConfirm(this.checked)"> Verileri inceledim, taşımayı onaylıyorum</label>';
  h+='</div><div class="mf"><button class="btn btn-s" style="flex:1" onclick="closeModal()">İptal</button><button class="btn btn-p" style="flex:2" id="mig_go" disabled onclick="migRunExecute()">Migration\'ı Başlat</button></div>';
  return h;
}
function migToggleConfirm(v){ MIG_WIZ.confirmed=!!v; var b=(typeof ge==='function')?ge('mig_go'):null; if(b)b.disabled=!v; }
function migDownloadJson(){
  var p=MIG_WIZ.preview||migDryRun();
  var txt=migPreviewJson(p);
  var fn='oz-sozler-tasima-'+((typeof wqDateStamp==='function')?wqDateStamp():'preview')+'.json';
  if(typeof wqDownloadText==='function')wqDownloadText(txt,fn,'application/json');
  else if(typeof U!=='undefined'&&U.dl)U.dl(txt,fn);
  if(typeof wqToast==='function')wqToast('Taşınacak kayıtlar JSON olarak indirildi');
}
async function migRunExecute(){
  if(!MIG_WIZ.confirmed){ if(typeof wqToast==='function')wqToast('Önce onay kutusunu işaretleyin',true); return; }
  var b=(typeof ge==='function')?ge('mig_go'):null; if(b){b.disabled=true;b.textContent='Taşınıyor…';}
  var res;
  try{ res=await migExecute(MIG_WIZ.preview); }
  catch(e){ res={status:'ERROR',error:'unexpected'}; }
  if(typeof showModal==='function')showModal(migResultHtml(res));
  if(res&&res.status==='OK'&&typeof renderWisdomQuotes==='function'){ /* liste tazelensin */ try{renderWisdomQuotes();}catch(e){} }
}
function migResultHtml(r){
  var okStatus=r&&r.status==='OK';
  var already=r&&r.status==='ALREADY_COMPLETED';
  var title=okStatus?'Taşıma Tamamlandı':already?'Zaten Tamamlanmış':'Taşıma Durumu';
  var color=okStatus?'var(--green)':already?'var(--blue)':'var(--red)';
  var row=function(l,v,c){ return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.05)"><span style="color:var(--t2);font-size:12px">'+l+'</span><span style="font-weight:700;font-size:13px'+(c?';color:'+c:'')+'">'+v+'</span></div>'; };
  var h='<div class="mh"><span style="font-weight:700;font-size:15px;color:'+color+'">'+title+'</span><button class="btn btn-g btn-ic" onclick="closeModal()">'+((typeof ic==='function')?ic('x',14):'x')+'</button></div><div class="mb">';
  h+=row('Durum',_migEsc(r&&r.status),color);
  if(okStatus||already){
    if(r.legacyCount!=null)h+=row('Legacy',r.legacyCount);
    if(r.wisdomBefore!=null)h+=row('Özlü Sözler (önce)',r.wisdomBefore);
    if(r.addedCount!=null)h+=row('Eklenen',r.addedCount,'var(--green)');
    if(r.skippedCount!=null)h+=row('Atlanan',r.skippedCount);
    if(r.invalidCount!=null)h+=row('Hatalı',r.invalidCount,r.invalidCount?'var(--red)':'');
    if(r.wisdomAfter!=null)h+=row('Özlü Sözler (sonra)',r.wisdomAfter,'var(--blue)');
    if(r.checksumMatch!=null)h+=row('Checksum eşleşti',r.checksumMatch?'Evet':'HAYIR',r.checksumMatch?'var(--green)':'var(--red)');
    if(r.missingCount!=null)h+=row('Eksik',r.missingCount,r.missingCount?'var(--red)':'');
    if(r.backupId)h+=row('Güvenlik yedeği','#'+_migEsc(String(r.backupId).slice(0,16)));
    if(r.migrationVersion!=null)h+=row('Migration sürümü','v'+r.migrationVersion);
  }else{
    var msg={ADMIN_REQUIRED:'Bu işlem yalnız yöneticiye açıktır.',BACKUP_FAILED:'Güvenlik yedeği alınamadı; taşıma başlatılmadı.',PREVIEW_STALE:'Veriler önizlemeden sonra değişti. Lütfen yeniden çalıştırın.',CHECKSUM_MISMATCH:'Bütünlük doğrulaması başarısız; taşıma yazılmadı.',MARKER_INCONSISTENT:'Migration işareti var ama beklenen kayıtlar eksik. Lütfen inceleyin.'};
    h+='<p style="font-size:12px;color:var(--t2);margin-top:8px">'+_migEsc(msg[r&&r.status]||'İşlem tamamlanamadı.')+'</p>';
  }
  h+='</div><div class="mf"><button class="btn btn-p" style="flex:1" onclick="closeModal()">Kapat</button></div>';
  return h;
}

/* ── Global export ── */
window.migDryRun=migDryRun; window.migExecute=migExecute; window.migStatus=migStatus;
window.migChecksum=migChecksum; window.migIsAdmin=migIsAdmin; window.migPreviewJson=migPreviewJson;
window.wisdomMigrationButtonHtml=wisdomMigrationButtonHtml; window.migOpenWizard=migOpenWizard;
window.migToggleConfirm=migToggleConfirm; window.migDownloadJson=migDownloadJson; window.migRunExecute=migRunExecute;
