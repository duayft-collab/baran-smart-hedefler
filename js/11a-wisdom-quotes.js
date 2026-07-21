/* ══════════════════════════════════════════════════════════════════════════
   D10.1 — ÖZLÜ SÖZLER KÜTÜPHANESİ (wisdomQuotes)  ·  yalnız veri temeli + CRUD
   Additive. SMART/Coach/Quality/XP/Progress/Restore/Backup/Genel Notlar'a
   DOKUNMAZ. Bu fazda: veri modeli, ayrı view, CRUD, favori/aktif/pinned/
   reflected, kategori/etiket, arama/filtre, deterministik sıra, dirty draft,
   temel istatistik, Backup/DIFF entegrasyonu.
   YOK: otomatik gösterim, zamanlama, rotasyon, timer, import/export, bağlamsal.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Dirty draft (kendi namespace'i) ── */
var WISDOM_DRAFT={open:false,id:null,original:'',current:'',dirty:false};
function _wqFormSnapshot(){
  var g=function(id){var e=ge(id);return e?(e.type==='checkbox'?(e.checked?'1':'0'):e.value):'';};
  return JSON.stringify({q:g('wq_quote'),a:g('wq_author'),c:g('wq_category'),t:g('wq_tags'),
    l:g('wq_language'),p:g('wq_priority'),s:g('wq_source'),n:g('wq_notes'),
    act:g('wq_active'),fav:g('wq_favorite'),pin:g('wq_pinned'),ref:g('wq_reflected')});
}
function wqCaptureDraft(){ if(!WISDOM_DRAFT.open)return; WISDOM_DRAFT.current=_wqFormSnapshot(); WISDOM_DRAFT.dirty=(WISDOM_DRAFT.current!==WISDOM_DRAFT.original); }
function wqClearDraft(){ WISDOM_DRAFT={open:false,id:null,original:'',current:'',dirty:false}; }
function wqDraftDirty(){ return WISDOM_DRAFT.open&&WISDOM_DRAFT.dirty; }
window.wqCaptureDraft=wqCaptureDraft;window.wqClearDraft=wqClearDraft;window.wqDraftDirty=wqDraftDirty;

/* ── Kimlik / zaman ── */
function _wqSeq(){ _wqSeq._c=(_wqSeq._c||0)+1; return _wqSeq._c; }
function newWqId(){ return 'wq'+Date.now().toString(36)+'-'+(_wqSeq()).toString(36); }
function wqNow(){ try{return new Date().toISOString();}catch(e){return String(Date.now());} }

/* ── Normalize (fail-safe, MUTASYON YOK) ── */
var WQ_LIMITS={quote:1000,author:150,category:100,tags:20,tag:50,source:500,notes:20000};
function _wqTags(v){
  var arr=Array.isArray(v)?v:(typeof v==='string'?v.split(','):[]);
  var out=[],seen={};
  arr.forEach(function(t){ t=String(t).trim().slice(0,WQ_LIMITS.tag); if(!t)return; var k=t.toLocaleLowerCase('tr'); if(seen[k])return; seen[k]=1; out.push(t); });
  return out.slice(0,WQ_LIMITS.tags);
}
function normalizeWisdomQuote(q,i){
  if(!q||typeof q!=='object')return null;
  var quote=(q.quote!=null?String(q.quote):'').replace(/\r\n/g,'\n').slice(0,WQ_LIMITS.quote).trim();
  if(!quote)return null;
  return {
    id:(q.id!=null&&String(q.id))?String(q.id):('wq-legacy-'+i),
    quote:quote,
    author:String(q.author||'').slice(0,WQ_LIMITS.author),
    category:String(q.category||'').slice(0,WQ_LIMITS.category),
    tags:_wqTags(q.tags),
    language:String(q.language||'tr').slice(0,8)||'tr',
    favorite:!!q.favorite, active:q.active===false?false:true, pinned:!!q.pinned,
    priority:Number(q.priority)||0,
    notes:String(q.notes||'').slice(0,WQ_LIMITS.notes),
    source:String(q.source||'').slice(0,WQ_LIMITS.source),
    reflected:!!q.reflected,
    createdAt:q.createdAt?String(q.createdAt):wqNow(),
    updatedAt:q.updatedAt?String(q.updatedAt):wqNow(),
    lastShownAt:q.lastShownAt!=null?String(q.lastShownAt):null,
    showCount:Number(q.showCount)||0
  };
}
function normalizeWisdomQuotes(list){ return (Array.isArray(list)?list:[]).map(normalizeWisdomQuote).filter(Boolean); }
window.normalizeWisdomQuote=normalizeWisdomQuote;window.normalizeWisdomQuotes=normalizeWisdomQuotes;

function wqList(){ if(!Array.isArray(D.wisdomQuotes))D.wisdomQuotes=[]; return D.wisdomQuotes; }
function wqById(id){ return wqList().filter(function(q){return String(q.id)===String(id);})[0]||null; }
function wqCategories(){ var s={}; wqList().forEach(function(q){ if(q.category)s[q.category]=1; }); return Object.keys(s).sort(function(a,b){return a.localeCompare(b,'tr');}); }
function wqLanguages(){ var s={}; wqList().forEach(function(q){ s[q.language||'tr']=1; }); return Object.keys(s).sort(); }

/* ── Validation ── */
function _wqNorm(s){ return String(s||'').toLocaleLowerCase('tr').replace(/\s+/g,' ').trim(); }
function wqValidateQuote(quote){
  var q=String(quote||'').trim();
  if(!q)return 'Söz metni gerekli.';
  if(q.length>WQ_LIMITS.quote)return 'Söz çok uzun (en fazla '+WQ_LIMITS.quote+' karakter).';
  if(!/[\p{L}]/u.test(q))return 'Söz metni anlamlı bir ifade içermeli.'; // yalnız boşluk/noktalama/rakam reddi
  return null;
}
function wqIsDuplicate(quote,author,excludeId){
  var nq=_wqNorm(quote), na=_wqNorm(author);
  return wqList().some(function(q){ return String(q.id)!==String(excludeId||'')&&_wqNorm(q.quote)===nq&&_wqNorm(q.author)===na; });
}
window.wqValidateQuote=wqValidateQuote;window.wqIsDuplicate=wqIsDuplicate;

/* ── Deterministik sıralama ── */
function wqSort(list){
  return list.slice().sort(function(a,b){
    if(!!b.pinned-!!a.pinned)return !!b.pinned-!!a.pinned;
    if(!!b.favorite-!!a.favorite)return !!b.favorite-!!a.favorite;
    if((b.priority||0)!==(a.priority||0))return (b.priority||0)-(a.priority||0);
    if(String(b.updatedAt||'')!==String(a.updatedAt||''))return String(a.updatedAt||'')<String(b.updatedAt||'')?1:-1;
    if(String(b.createdAt||'')!==String(a.createdAt||''))return String(a.createdAt||'')<String(b.createdAt||'')?1:-1;
    return String(a.id).localeCompare(String(b.id));
  });
}
function wqFilter(list,query,filter,cat,lang){
  var q=_wqNorm(query);
  return list.filter(function(w){
    if(filter==='favorites'&&!w.favorite)return false;
    if(filter==='pinned'&&!w.pinned)return false;
    if(filter==='active'&&!w.active)return false;
    if(filter==='passive'&&w.active)return false;
    if(filter==='reflected'&&!w.reflected)return false;
    if(cat&&w.category!==cat)return false;
    if(lang&&w.language!==lang)return false;
    if(!q)return true;
    var notesPlain=(typeof richTextToPlainText==='function')?richTextToPlainText(w.notes||''):(w.notes||'');
    var hay=_wqNorm(w.quote+' '+w.author+' '+w.category+' '+(w.tags||[]).join(' ')+' '+w.source+' '+notesPlain);
    return hay.indexOf(q)>=0;
  });
}
window.wqSort=wqSort;window.wqFilter=wqFilter;

/* ── Hızlı işlemler ── (1 write) */
function _wqTouch(w){ w.updatedAt=wqNow(); }
function _wqAfter(){ if(typeof save==='function')save(); if(tab==='wisdom')renderWisdomQuotes(); }
function wqToggleFav(id){ var w=wqById(id); if(!w)return; if(typeof snap==='function')snap(); w.favorite=!w.favorite; _wqTouch(w); _wqAfter(); }
function wqToggleActive(id){ var w=wqById(id); if(!w)return; if(typeof snap==='function')snap(); w.active=!w.active; _wqTouch(w); _wqAfter(); }
function wqTogglePin(id){ var w=wqById(id); if(!w)return; if(typeof snap==='function')snap(); w.pinned=!w.pinned; _wqTouch(w); _wqAfter(); } // bu fazda birden fazla pinned olabilir
function wqToggleReflect(id){ var w=wqById(id); if(!w)return; if(typeof snap==='function')snap(); w.reflected=!w.reflected; _wqTouch(w); _wqAfter(); }
function wqDelete(id){ if(!confirm('Bu söz kalıcı olarak silinsin mi?'))return; if(typeof snap==='function')snap(); D.wisdomQuotes=wqList().filter(function(q){return String(q.id)!==String(id);}); _wqAfter(); }
window.wqToggleFav=wqToggleFav;window.wqToggleActive=wqToggleActive;window.wqTogglePin=wqTogglePin;window.wqToggleReflect=wqToggleReflect;window.wqDelete=wqDelete;

/* ── Form (oluştur / düzenle) ── */
function openWqForm(id){
  // Dirty koruma: açık ve kirli bir taslak varken başka söz düzenlemeye geçiş uyarısı
  if(WISDOM_DRAFT.open){ wqCaptureDraft(); if(WISDOM_DRAFT.dirty&&!confirm('Kaydedilmemiş söz değişiklikleri var. Vazgeçilsin mi?'))return; }
  wqClearDraft();
  var w=id?wqById(id):null; var e=function(v){return v?U.esc(v):'';};
  var cats=wqCategories();
  var h='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h2 style="font-size:17px;font-weight:800">'+(w?'Sözü Düzenle':'Yeni Söz')+'</h2><button class="btn btn-g btn-ic" style="width:30px;height:30px" onclick="closeModal()">'+ic('x',14)+'</button></div>';
  h+='<textarea class="inp" id="wq_quote" rows="3" placeholder="Söz metni (düz metin)..." oninput="wqCaptureDraft()" style="margin-bottom:8px">'+(w?e(w.quote):'')+'</textarea>';
  h+='<input class="inp" id="wq_author" placeholder="Söyleyen / yazar" value="'+(w?e(w.author):'')+'" oninput="wqCaptureDraft()" style="margin-bottom:8px">';
  h+='<input class="inp" id="wq_category" list="wq_catlist" placeholder="Kategori" value="'+(w?e(w.category):'')+'" oninput="wqCaptureDraft()" style="margin-bottom:8px">';
  h+='<datalist id="wq_catlist">'+cats.map(function(c){return '<option value="'+U.esc(c)+'">';}).join('')+'</datalist>';
  h+='<input class="inp" id="wq_tags" placeholder="Etiketler (virgülle)" value="'+(w?e(w.tags.join(', ')):'')+'" oninput="wqCaptureDraft()" style="margin-bottom:8px">';
  h+='<div style="display:flex;gap:8px;margin-bottom:8px"><input class="inp" id="wq_language" placeholder="Dil (tr)" value="'+(w?e(w.language):'tr')+'" oninput="wqCaptureDraft()" style="flex:1"><input class="inp" id="wq_priority" type="number" placeholder="Öncelik" value="'+(w?(w.priority||0):0)+'" oninput="wqCaptureDraft()" style="flex:1"></div>';
  h+='<input class="inp" id="wq_source" placeholder="Kaynak" value="'+(w?e(w.source):'')+'" oninput="wqCaptureDraft()" style="margin-bottom:8px">';
  h+='<p class="lbl" style="font-size:11px;color:var(--t3);margin:2px 0 3px">Not (zengin metin)</p>'+(typeof rtBar==='function'?rtBar('wq_notes'):'');
  h+='<textarea class="inp" id="wq_notes" rows="3" placeholder="Kişisel not... (**kalın**, *italik*, - liste)" oninput="wqCaptureDraft()" style="margin-bottom:8px">'+(w?e(w.notes):'')+'</textarea>';
  h+='<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" id="wq_active" '+((!w||w.active)?'checked':'')+' onchange="wqCaptureDraft()"> Aktif</label>';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" id="wq_favorite" '+((w&&w.favorite)?'checked':'')+' onchange="wqCaptureDraft()"> Favori</label>';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" id="wq_pinned" '+((w&&w.pinned)?'checked':'')+' onchange="wqCaptureDraft()"> Sabit</label>';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" id="wq_reflected" '+((w&&w.reflected)?'checked':'')+' onchange="wqCaptureDraft()"> Bugün beni düşündürdü</label>';
  h+='</div>';
  h+='<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-g" onclick="wqFormCancel()">İptal</button><button class="btn btn-p" data-id="'+(w?U.esc(w.id):'')+'" onclick="wqFormSave(this.dataset.id)">Kaydet</button></div>';
  showModal(h);
  WISDOM_DRAFT.open=true; WISDOM_DRAFT.id=id||null; WISDOM_DRAFT.original=_wqFormSnapshot(); WISDOM_DRAFT.current=WISDOM_DRAFT.original; WISDOM_DRAFT.dirty=false;
}
function wqFormCancel(){ wqCaptureDraft(); if(WISDOM_DRAFT.dirty&&!confirm('Kaydedilmemiş söz değişiklikleri var. Kapatılsın mı?'))return; wqClearDraft(); sh('modal-root',''); }
function wqFormSave(id){
  var g=function(k){var e=ge(k);return e?e.value:'';};
  var quote=g('wq_quote').trim();
  var err=wqValidateQuote(quote); if(err){alert(err);return;}
  var author=g('wq_author').trim();
  if(wqIsDuplicate(quote,author,id)){alert('Aynı söz ve yazar zaten kayıtlı.');return;}
  var rec={
    quote:quote, author:author, category:g('wq_category').trim(), tags:_wqTags(g('wq_tags')),
    language:(g('wq_language').trim()||'tr'), priority:Number(g('wq_priority'))||0,
    source:g('wq_source').trim(), notes:g('wq_notes'),
    active:!!(ge('wq_active')&&ge('wq_active').checked), favorite:!!(ge('wq_favorite')&&ge('wq_favorite').checked),
    pinned:!!(ge('wq_pinned')&&ge('wq_pinned').checked), reflected:!!(ge('wq_reflected')&&ge('wq_reflected').checked)
  };
  if(id){
    var w=wqById(id); if(!w){wqClearDraft();sh('modal-root','');return;}
    // Değişiklik yoksa 0 write
    var same=w.quote===rec.quote&&w.author===rec.author&&w.category===rec.category&&w.tags.join('|')===rec.tags.join('|')&&
      w.language===rec.language&&(w.priority||0)===rec.priority&&w.source===rec.source&&w.notes===rec.notes&&
      w.active===rec.active&&w.favorite===rec.favorite&&w.pinned===rec.pinned&&w.reflected===rec.reflected;
    if(same){ wqClearDraft(); sh('modal-root',''); return; }
    if(typeof snap==='function')snap();
    w.quote=rec.quote;w.author=rec.author;w.category=rec.category;w.tags=rec.tags;w.language=rec.language;
    w.priority=rec.priority;w.source=rec.source;w.notes=rec.notes;w.active=rec.active;w.favorite=rec.favorite;
    w.pinned=rec.pinned;w.reflected=rec.reflected;w.updatedAt=wqNow(); // createdAt korunur
  } else {
    if(typeof snap==='function')snap();
    var now=wqNow();
    wqList().unshift(normalizeWisdomQuote(Object.assign({id:newWqId(),createdAt:now,updatedAt:now,lastShownAt:null,showCount:0},rec),0));
  }
  wqClearDraft(); if(typeof save==='function')save(); sh('modal-root',''); renderWisdomQuotes();
}
window.openWqForm=openWqForm;window.wqFormCancel=wqFormCancel;window.wqFormSave=wqFormSave;

/* ── İstatistik (temel) ── */
function wqStats(){
  var l=wqList(),fav=0,act=0,pas=0,pin=0,ref=0;
  l.forEach(function(w){ if(w.favorite)fav++; if(w.active)act++; else pas++; if(w.pinned)pin++; if(w.reflected)ref++; });
  return {total:l.length,favorites:fav,active:act,passive:pas,pinned:pin,reflected:ref};
}
window.wqStats=wqStats;

/* ── Sayfa ── */
var wqQuery='', wqFilterMode='all', wqCat='', wqLang='';
function wqSetQuery(v){ wqQuery=v; _wqRenderList(); }
function wqSetFilter(v){ wqFilterMode=v; renderWisdomQuotes(); }
function wqSetCat(c){ wqCat=(wqCat===c?'':c); renderWisdomQuotes(); }
function wqSetLang(v){ wqLang=v; renderWisdomQuotes(); }
window.wqSetQuery=wqSetQuery;window.wqSetFilter=wqSetFilter;window.wqSetCat=wqSetCat;window.wqSetLang=wqSetLang;
function renderWisdomQuotes(){
  var st=wqStats();
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Özlü Sözler</h1><p class="sh-sub">Kişisel özlü söz kütüphanen. Hedeflerden ve notlardan bağımsız.</p></div>';
  h+='<button class="btn btn-p" onclick="openWqForm()">'+ic('plus',13)+' Yeni Söz</button>';
  h+=(typeof wisdomIoButtonsHtml==='function'?wisdomIoButtonsHtml():'')+'</div>'; // D10.3: içe/dışa aktarma butonları (additive)
  // istatistik
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';
  [['Toplam',st.total],['Favori',st.favorites],['Aktif',st.active],['Pasif',st.passive],['Sabit',st.pinned],['Beni düşündüren',st.reflected]].forEach(function(x){
    h+='<div class="card" style="padding:8px 12px;flex:1;min-width:90px"><p style="font-size:10px;color:var(--t3)">'+x[0]+'</p><p style="font-size:18px;font-weight:800">'+x[1]+'</p></div>';});
  h+='</div>';
  if(typeof wisdomDisplayPanelHtml==='function')h+=wisdomDisplayPanelHtml(); // D10.2: gösterim/rotasyon ayar paneli (additive)
  // arama + durum filtresi
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">';
  h+='<input class="inp" id="wq_search" style="max-width:280px" placeholder="Sözlerde ara..." value="'+U.esc(wqQuery)+'" oninput="wqSetQuery(this.value)">';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';
  [['all','Tümü'],['favorites','Favoriler'],['pinned','Sabitlenenler'],['active','Aktif'],['passive','Pasif'],['reflected','Beni düşündürenler']].forEach(function(f){var a=wqFilterMode===f[0];
    h+='<button class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'" data-v="'+f[0]+'" onclick="wqSetFilter(this.dataset.v)">'+f[1]+'</button>';});
  h+='</div>';
  var langs=wqLanguages();
  if(langs.length>1){ h+='<select class="inp" style="width:auto;height:30px;font-size:12px" onchange="wqSetLang(this.value)"><option value="">Tüm diller</option>'+langs.map(function(l){return '<option value="'+U.esc(l)+'"'+(wqLang===l?' selected':'')+'>'+U.esc(l)+'</option>';}).join('')+'</select>'; }
  h+='</div>';
  // kategori filtreleri
  var cats=wqCategories();
  if(cats.length){ h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">';
    cats.forEach(function(c){var a=wqCat===c; h+='<button class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'" data-c="'+U.esc(c)+'" onclick="wqSetCat(this.dataset.c)">'+U.esc(c)+'</button>';});
    h+='</div>'; }
  h+='<div id="wq_list"></div></div>';
  sh('pinner',h);
  _wqRenderList();
}
window.renderWisdomQuotes=renderWisdomQuotes;
function _wqRenderList(){
  var box=ge('wq_list'); if(!box)return;
  var list=wqSort(wqFilter(wqList(),wqQuery,wqFilterMode,wqCat,wqLang)); var h='';
  var filtering=wqQuery.trim()||wqFilterMode!=='all'||wqCat||wqLang;
  if(filtering)h+='<p style="font-size:11px;color:var(--t3);margin-bottom:8px">'+list.length+' sonuç</p>';
  if(!list.length){
    var msg=filtering?'Ölçütlere uygun söz yok.':'Henüz söz yok.';
    h+='<div class="card" style="padding:44px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">'+ic('qt',30,'var(--t3)')+'<p style="font-weight:700;font-size:15px">'+msg+'</p>'+((!filtering)?'<button class="btn btn-p" onclick="openWqForm()">'+ic('plus',13)+' İlk sözünü ekle</button>':'')+'</div>';
    box.innerHTML=h; return;
  }
  h+='<div style="display:flex;flex-direction:column;gap:8px">';
  list.forEach(function(w){ var id=U.esc(String(w.id));
    h+='<div class="card" style="padding:14px 16px'+(w.active?'':';opacity:.6')+'">';
    h+='<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">';
    h+='<div style="flex:1;min-width:0"><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px">';
    if(w.category)h+='<span class="pill p-blue" style="font-size:9px">'+U.esc(w.category)+'</span>';
    if(w.favorite)h+='<span class="pill p-orange" style="font-size:9px">★ Favori</span>';
    if(w.pinned)h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">Sabit</span>';
    if(w.reflected)h+='<span class="pill" style="font-size:9px;background:var(--bl);color:var(--blue)">Düşündürdü</span>';
    if(!w.active)h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3)">Pasif</span>';
    if(w.priority)h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3)">Öncelik '+Number(w.priority)+'</span>';
    if(w.language&&w.language!=='tr')h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3)">'+U.esc(w.language)+'</span>';
    h+='</div>';
    h+='<p style="font-size:14px;font-style:italic;line-height:1.65;color:var(--t);word-break:break-word">&ldquo;'+U.esc(w.quote)+'&rdquo;</p>';
    if(w.author)h+='<p style="font-size:11.5px;font-weight:700;color:var(--blue);margin-top:5px">&mdash; '+U.esc(w.author)+'</p>';
    if(w.source)h+='<p style="font-size:10px;color:var(--t3);margin-top:2px">Kaynak: '+U.esc(w.source)+'</p>';
    if(w.tags&&w.tags.length)h+='<p style="font-size:10px;color:var(--t3);margin-top:3px">'+w.tags.map(function(t){return '#'+U.esc(t);}).join(' ')+'</p>';
    if(w.notes&&typeof isRichTextEmpty==='function'&&!isRichTextEmpty(w.notes))h+='<div class="rt" style="font-size:11.5px;line-height:1.5;color:var(--t2);margin-top:6px">'+renderRichText(w.notes)+'</div>';
    h+='<p style="font-size:9.5px;color:var(--t3);margin-top:5px">Güncellenme: '+U.esc(_wqDate(w.updatedAt))+'</p></div>';
    h+='<div style="display:flex;gap:2px;flex-shrink:0;flex-wrap:wrap;max-width:150px;justify-content:flex-end">';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="Favori" data-id="'+id+'" onclick="wqToggleFav(this.dataset.id)">'+ic('star',12,w.favorite?'var(--orange)':'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="'+(w.pinned?'Sabitlemeyi kaldır':'Sabitle')+'" data-id="'+id+'" onclick="wqTogglePin(this.dataset.id)">'+ic('star',12,w.pinned?'var(--blue)':'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="Beni düşündürdü" data-id="'+id+'" onclick="wqToggleReflect(this.dataset.id)">'+(w.reflected?'💡':'○')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="'+(w.active?'Pasifleştir':'Aktifleştir')+'" data-id="'+id+'" onclick="wqToggleActive(this.dataset.id)">'+ic(w.active?'check':'x',12,'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="Düzenle" data-id="'+id+'" onclick="openWqForm(this.dataset.id)">'+ic('edit',12,'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="Sil" data-id="'+id+'" onclick="wqDelete(this.dataset.id)">'+ic('trash',12,'var(--t3)')+'</button>';
    h+='</div></div></div>';
  });
  h+='</div>'; box.innerHTML=h;
}
window._wqRenderList=_wqRenderList;
function _wqDate(iso){ if(!iso)return '—'; try{var d=new Date(iso); if(isNaN(d))return String(iso); return d.getDate()+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}catch(e){return String(iso);} }
