/* ══════════════════════════════════════════════════════════════════════════
   D10.1 — ÖZLÜ SÖZLER KÜTÜPHANESİ (wisdomQuotes)  ·  yalnız veri temeli + CRUD
   Additive. SMART/Coach/Quality/XP/Progress/Restore/Backup/Genel Notlar'a
   DOKUNMAZ. Bu fazda: veri modeli, ayrı view, CRUD, favori/aktif/pinned/
   reflected, kategori/etiket, arama/filtre, deterministik sıra, dirty draft,
   temel istatistik, Backup/DIFF entegrasyonu.
   YOK: otomatik gösterim, zamanlama, rotasyon, timer, import/export, bağlamsal.
   ══════════════════════════════════════════════════════════════════════════
   R11 — WISDOM V1.0 STABLE · MİMARİ HARİTASI (sunum katmanı, bakım rehberi)

   RENDER PIPELINE — tek giriş `renderWisdomQuotes()`, üç moda dallanır:
     _wisdomReading  → renderWisdomReadingMode()  (UX-R9 dikkat-dağıtmayan okuma)
     _wisdomDest     → renderWisdomDest()          (UX-R8 komut-menüsü destination'ı, lazy)
     (varsayılan)    → sakin okuma ekranı: hero + özet + arama/filtre + kütüphane
   Liste ayrı: `_wqRenderList()` yalnız #wq_list'i doldurur (arama/filtre değişince).

   NAVİGASYON (tek felsefe, tek back davranışı):
     wisdomOpenMenu/CloseMenu  → komut-menüsü aç/kapa (odak yönetimi: _wisdomFocus)
     wisdomGoDest(d)           → destination'a git (readingmode→Reading Mode; reading/search→okuma)
     wisdomBackToReading()     → tek "‹ Okumaya Dön" davranışı; hero indeksi + arama sorgusu korunur
     wisdomMenuKey / wisdomReadingKey → klavye (Arrow/Home/End/Enter/Esc)

   KOMUT MENÜSÜ (UX-R8/R9): WISDOM_DEST_GROUPS (Okuma/Keşfet/Gelişmiş, sessiz etiketler) +
     WISDOM_DESTS (13 hedef) → wisdomCommandMenuHtml() fullscreen sheet; _wisdomDestPanel(d)
     mevcut motor panelini (P4–P12) LAZY render eder (paneller burada silinmez, çağrılır).

   HERO SEÇİMİ (UX-R4 determinizm): _wqDailyPick() = FNV-1a hash(id|_wqDailySeed()) MAX skor
     (list.length modulo YOK → kaynak/sıralama/aktivasyon-zamanı bağımsız aynı gün-id).
     _wqHeroReady() aktivasyon penceresinde false → _wqHeroLoadingHtml() placeholder;
     _wqHeroWatch() bounded self-terminating (aktivasyon bitince 1 kez re-render).

   ENTEGRASYON KATMANI (K1, ayrı dosya 13-wisdom-integration.js): wiCardHtml/wiRecommend
     Hedef/Karar/İlke ekranlarına bağlamsal "İlgili Bilgelik" kartı enjekte eder; buradaki
     wqList/wqById/rndQuote'u yeniden kullanır. 11a bu katmanı BİLMEZ (gevşek bağlı).

   DOKUNULMAZ (V1.0 dondurma): motorlar 11u/11v/11w/11x/11y/12a/12b/12c/13, store/sync/
     backup/restore/relations, DIFF_SCHEMA, veri modeli. Kabul edilen borç: türetilmiş
     modüllerin kendi _Xe/_XIc esc/ic wrapper'ları (bilinçli self-containment; motorlara
     dokunmamak için birleştirilmedi).
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

/* Wisdom Sharding P1 dual-read TEK geçiş noktası: sharded aktif+yüklü ise koleksiyon
   cache'i; aksi halde legacy D.wisdomQuotes (güvenli fallback). İkinci okuma motoru YOK. */
function wqList(){
  if(typeof wisdomStoreIsSharded==='function'&&wisdomStoreIsSharded())return wisdomStoreList();
  if(!Array.isArray(D.wisdomQuotes))D.wisdomQuotes=[]; return D.wisdomQuotes;
}
function wqById(id){
  if(typeof wisdomStoreIsSharded==='function'&&wisdomStoreIsSharded())return wisdomStoreById(id);
  return (Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]).filter(function(q){return String(q.id)===String(id);})[0]||null;
}
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
/* P2 dual-write: sharded aktifken tek alan değişimi koleksiyon-önce yazılır (legacy byte-identical kalır). */
function _wqSharded(){ return typeof wisdomStoreIsSharded==='function'&&wisdomStoreIsSharded(); }
function _wqDualToggle(id,field){ var c=wqById(id); if(!c)return; var patch={}; patch[field]=!c[field]; patch.updatedAt=wqNow();
  if(typeof wisdomDualApply==='function')wisdomDualApply(id,patch).then(function(r){ if(r&&r.ok&&tab==='wisdom'&&typeof renderWisdomQuotes==='function')renderWisdomQuotes(); }); }
function wqToggleFav(id){ if(_wqSharded())return _wqDualToggle(id,'favorite'); var w=wqById(id); if(!w)return; if(typeof snap==='function')snap(); w.favorite=!w.favorite; _wqTouch(w); _wqAfter(); }
function wqToggleActive(id){ if(_wqSharded())return _wqDualToggle(id,'active'); var w=wqById(id); if(!w)return; if(typeof snap==='function')snap(); w.active=!w.active; _wqTouch(w); _wqAfter(); }
function wqTogglePin(id){ if(_wqSharded())return _wqDualToggle(id,'pinned'); var w=wqById(id); if(!w)return; if(typeof snap==='function')snap(); w.pinned=!w.pinned; _wqTouch(w); _wqAfter(); } // bu fazda birden fazla pinned olabilir
function wqToggleReflect(id){ if(_wqSharded())return _wqDualToggle(id,'reflected'); var w=wqById(id); if(!w)return; if(typeof snap==='function')snap(); w.reflected=!w.reflected; _wqTouch(w); _wqAfter(); }
function wqDelete(id){ if(!confirm('Bu söz kalıcı olarak silinsin mi?'))return;
  if(_wqSharded()){ if(typeof wisdomDualDelete==='function')wisdomDualDelete(id).then(function(r){ if(r&&r.ok&&tab==='wisdom'&&typeof renderWisdomQuotes==='function')renderWisdomQuotes(); }); return; }
  if(typeof snap==='function')snap(); D.wisdomQuotes=wqList().filter(function(q){return String(q.id)!==String(id);}); _wqAfter(); }
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
  /* P2 dual-write (sharded): Edit + Tek kayıt ekleme koleksiyon-önce yazılır. Legacy yolu (aşağıda) DEĞİŞMEZ. */
  if(_wqSharded()&&typeof wisdomDualSet==='function'){
    var nowS=wqNow(), full;
    if(id){ var cur=wqById(id); if(!cur){wqClearDraft();sh('modal-root','');return;} full=Object.assign({},cur,rec,{updatedAt:nowS}); }
    else { full=normalizeWisdomQuote(Object.assign({id:newWqId(),createdAt:nowS,updatedAt:nowS,lastShownAt:null,showCount:0},rec),0); }
    wisdomDualSet(full).then(function(){ wqClearDraft(); if(typeof sh==='function')sh('modal-root',''); if(typeof renderWisdomQuotes==='function')renderWisdomQuotes(); });
    return;
  }
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
/* ─────────────────────────────────────────────────────────────────────────
   WISDOM-UXR1: Minimalist bilgi mimarisi.
   Varsayılan ekran sakin bir okuma deneyimidir: üstte "Günün Bilgeliği" hero
   (birincil odak) + kompakt özet + arama/filtre + kütüphane. TÜM ağır analitik/
   araç panelleri (P4–P12) tek katlanabilir "Araçlar ve İçgörüler" bölümünde,
   varsayılan KAPALI. Yeni veri/işlev/motor YOK; yalnız yeniden düzenleme.
   ───────────────────────────────────────────────────────────────────────── */
var _whIdx=null;
function _wqHeroList(){ var l=(typeof wqList==='function'?wqList():[]).filter(function(q){return q&&q.active!==false&&String(q.quote==null?'':q.quote).trim();}); return (typeof wqSort==='function')?wqSort(l):l; }
/* UX-R4 HOTFIX: günlük hero seçimi STABİL ID-HASH ile — dayOfYear%list.length KALDIRILDI.
   Aynı takvim günü, kaynak (legacy/sharded), sıralama ve aktivasyon-zamanından BAĞIMSIZ
   olarak aynı söz id'sini üretir. Firestore dönüş sırasına ve list.length'e bağlı değil. */
function _wqDailySeed(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function _wqHashId(id,seed){ var s=String(id)+'|'+String(seed), h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; } // FNV-1a
function _wqDailyPick(){
  var l=_wqHeroList(); if(!l.length)return null;
  var seed=_wqDailySeed(), best=null, bs=-1;
  for(var i=0;i<l.length;i++){ var sc=_wqHashId(l[i].id,seed); if(sc>bs||(sc===bs&&best&&String(l[i].id)<String(best.id))){ bs=sc; best=l[i]; } }
  return best;
}
/* Aktivasyon penceresinde otoriter kaynak henüz hazır değil → placeholder; sharded VEYA
   settled-legacy (loading değil) → hazır. WQ_STORE'a doğrudan erişmez (yalnız public accessor). */
function _wqHeroReady(){
  // P0-LOAD (RC-1 düzeltmesi): "loading!==true" ASLA tek başına "hazır" kanıtı sayılmaz.
  // Tek yetkili kaynak wqLifecycleState(); hazır = yalnız 4 SETTLED durumdan biri.
  if(typeof wqLifecycleState!=='function')return true; // motor yoksa eski davranış (güvenli varsayılan)
  var s=wqLifecycleState();
  return s==='ready'||s==='empty'||s==='settled_legacy'||s==='error';
}
function _wqHeroPick(){
  var l=_wqHeroList(); if(!l.length)return null;
  if(_whIdx==null){ var daily=_wqDailyPick(), di=0; if(daily){ for(var i=0;i<l.length;i++){ if(String(l[i].id)===String(daily.id)){ di=i; break; } } } _whIdx=di; }
  _whIdx=((_whIdx%l.length)+l.length)%l.length;
  return {q:l[_whIdx],idx:_whIdx,total:l.length};
}
/* Aktivasyon-esnası sakin placeholder (role=status, sistem ikonu + açık metin, spinner/
   modal/toast/layout-shift YOK, responsive, reduced-motion güvenli). */
function _wqHeroLoadingHtml(){
  return '<div id="wisdom_hero" class="wq-hero" role="status" aria-live="polite" style="max-width:64ch;margin:6px auto 30px;padding:30px 20px;text-align:center">'+
    '<div style="font-size:9.5px;letter-spacing:.22em;color:var(--t3);font-weight:600;text-transform:uppercase;margin-bottom:14px">Günün Bilgeliği</div>'+
    '<p style="font-size:13.5px;color:var(--t3);line-height:1.6;margin:0">'+ic('brain',15,'var(--t3)')+' Bilgelik arşivi hazırlanıyor…</p></div>';
}
/* Sınırlı, kendini-sonlandıran izleyici: aktivasyon bitince hero'yu BİR kez re-render eder.
   Kalıcı listener/durum/tarayıcı-deposu/bulut-yazımı YOK (bounded setTimeout, ~24s tavan). */
var _wqHeroWatching=false;
function _wqHeroWatch(){
  if(_wqHeroWatching||typeof setTimeout!=='function')return;
  _wqHeroWatching=true; var tries=0;
  var tick=function(){ tries++;
    if(_wqHeroReady()){ _wqHeroWatching=false; if(typeof renderWisdomQuotes==='function'&&typeof tab!=='undefined'&&tab==='wisdom')renderWisdomQuotes(); return; }
    if(tries>=65){ _wqHeroWatching=false; return; } // P0-LOAD: ~52sn tavan — auth-bekleme(~20sn)+3 sınırlı retry backoff'unu (~10sn) güvenle kapsar
    setTimeout(tick,800);
  };
  setTimeout(tick,800);
}
function wqHeroHtml(){
  if(!_wqHeroReady()){ _wqHeroWatch(); return _wqHeroLoadingHtml(); }
  var p=_wqHeroPick(); if(!p)return '';
  var q=p.q, id=U.esc(String(q.id));
  /* UX-R1.5: kitap-okuyucu hero — kartsız/kenarlıksız, 64ch merkezli okuma ölçüsü,
     büyük tipografi, cömert boşluk. Kategori pill değil ince üstbaşlık; sözle
     hiçbir şey yarışmaz (~%75 görsel dikkat). */
  var h='<div id="wisdom_hero" class="wq-hero" style="max-width:64ch;margin:6px auto 30px;padding:24px 20px 10px;text-align:center">';
  h+='<div style="font-size:9.5px;letter-spacing:.22em;color:var(--t3);font-weight:600;text-transform:uppercase;margin-bottom:24px">Günün Bilgeliği'+(q.category?(' &middot; '+U.esc(q.category)):'')+'</div>';
  h+='<p class="wq-hero-quote" style="font-size:clamp(19px,4.2vw,26px);line-height:1.62;font-weight:500;color:var(--t);margin:0 0 22px;word-break:break-word">'+U.esc(q.quote)+'</p>';
  if(q.author)h+='<p style="font-size:14px;font-weight:600;color:var(--blue);margin:0">'+U.esc(q.author)+'</p>';
  h+='<div style="display:flex;gap:2px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:26px">';
  h+='<button class="btn btn-g btn-ic wq-hero-btn" style="width:36px;height:36px;font-size:19px;line-height:1" title="Önceki" aria-label="Önceki söz" onclick="wqHeroNav(-1)">&lsaquo;</button>';
  h+='<button class="btn btn-g btn-ic wq-hero-btn" style="width:36px;height:36px" data-id="'+id+'" onclick="wqToggleFav(this.dataset.id)" title="Favori" aria-label="Favori">'+ic('star',15,q.favorite?'var(--orange)':'var(--t3)')+'</button>';
  h+='<button class="btn btn-g btn-sm wq-hero-btn" style="color:var(--t3)" data-id="'+id+'" onclick="wqHeroCopy(this.dataset.id)" title="Kopyala" aria-label="Kopyala">Kopyala</button>';
  h+='<button class="btn btn-g btn-sm wq-hero-btn" style="color:var(--t3)" data-id="'+id+'" onclick="wqHeroShare(this.dataset.id)" title="Paylaş" aria-label="Paylaş">Paylaş</button>';
  h+='<button class="btn btn-g btn-ic wq-hero-btn" style="width:36px;height:36px;font-size:19px;line-height:1" title="Sonraki" aria-label="Sonraki söz" onclick="wqHeroNav(1)">&rsaquo;</button>';
  h+='<button id="wisdom_readmode_btn" class="btn btn-g btn-ic wq-hero-btn" style="width:36px;height:36px" title="Okuma Modu" aria-label="Okuma Modu" onclick="wisdomEnterReading()">'+ic('sun',14,'var(--t3)')+'</button>'; // UX-R9: dikkat-dağıtmayan okuma modu girişi
  h+='</div>';
  // UX-R9: sessiz tipografik okuma-konumu göstergesi (kart değil; prev/next ile güncellenir; erişilebilir)
  h+='<div role="status" aria-label="Okuma konumu" style="font-size:9px;color:var(--t3);margin-top:12px;letter-spacing:.05em">'+(p.idx+1)+' / '+p.total+'</div>';
  h+='</div>';
  return h;
}
window.wqHeroHtml=wqHeroHtml;
/* UX-R2: sunum cilası — pseudo-class/media inline style ile yapılamaz, tek scoped
   <style> bloğu enjekte edilir (renderWisdomQuotes'ta bir kez). Hover/:focus-visible,
   ≥36px dokunma hedefi, prev/next için prefers-reduced-motion-korumalı ≤150ms geçiş. */
function wqUxStyleHtml(){
  return '<style id="wq-ux-style">'+
    '.wq-hero-btn{background:transparent;min-height:36px;transition:background .12s ease,color .12s ease}'+
    '.wq-hero-btn:hover{background:var(--s2)}'+
    '.wq-hero-btn:focus-visible{outline:2px solid var(--blue);outline-offset:2px}'+
    '@media (prefers-reduced-motion: no-preference){.wq-hero{animation:wqHeroFade 140ms ease}@keyframes wqHeroFade{from{opacity:.4}to{opacity:1}}.wq-cmd{animation:wqCmdIn 140ms ease}@keyframes wqCmdIn{from{opacity:0}to{opacity:1}}}'+
    '@media (prefers-reduced-motion: reduce){.wq-hero,.wq-cmd{animation:none}}'+
    '</style>';
}
window.wqUxStyleHtml=wqUxStyleHtml;
function wqHeroNav(d){ var l=_wqHeroList(); if(!l.length)return; if(_whIdx==null)_wqHeroPick(); _whIdx=((_whIdx+d)%l.length+l.length)%l.length; var el=(typeof ge==='function')?ge('wisdom_hero'):null; if(el&&el.parentNode){ el.outerHTML=wqHeroHtml(); } else if(typeof renderWisdomQuotes==='function'&&tab==='wisdom'){ renderWisdomQuotes(); } }
window.wqHeroNav=wqHeroNav;
function wqHeroCopy(id){ var q=(typeof wqById==='function')?wqById(id):null; if(!q)return; var t=String(q.quote||'')+(q.author?' — '+q.author:''); try{ if(typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t); }catch(e){} if(typeof wqToast==='function')wqToast('Panoya kopyalandı'); }
window.wqHeroCopy=wqHeroCopy;
function wqHeroShare(id){ var q=(typeof wqById==='function')?wqById(id):null; if(!q)return; var t=String(q.quote||'')+(q.author?' — '+q.author:''); try{ if(typeof navigator!=='undefined'&&navigator.share){ navigator.share({text:t}); return; } }catch(e){} wqHeroCopy(id); }
window.wqHeroShare=wqHeroShare;
/* ─────────────────────────────────────────────────────────────────────────
   UX-R8: "Araçlar, Analitik ve İçgörüler" katlanabilir bölümü KALDIRILDI.
   Yerine invisible-first Komut Menüsü / Kütüphane sheet'i. Default ekran saf
   okuma deneyimidir; tüm güçlü paneller (P4–P12) tek giriş noktasının arkasında
   ve YALNIZ seçilince lazy-render edilir (Apple Books / Linear command menu).
   Paneller SİLİNMEDİ — okuma arayüzünden çıkarıldı. Sunum+navigasyon; 0 write. */
var _wisdomDest=null, _wisdomMenuOpen=false, _wisdomMenuIdx=0, _wisdomReading=false;
var WISDOM_DESTS=[
  ['reading','Okuma','qt'],['readingmode','Okuma Modu','sun'],['search','Arama','ci'],
  ['collections','Koleksiyonlar','layers'],['coach','Koç','star'],['learning','Öğrenme','bk'],['knowledge','Bilgi Merkezi','brain'],
  ['statistics','İstatistikler','kpi'],['workspace','Çalışma Alanı','dash'],
  ['execreview','Yönetici İncelemesi','arc'],['execintel','Yönetici Zekâsı','trophy'],
  ['knowledgeos','Kurumsal Harita','layers'],['settings','Ayarlar','ref']
];
window.WISDOM_DESTS=WISDOM_DESTS;
/* UX-R9: sessiz metin etiketli 3 grup (tek seviye). */
var WISDOM_DEST_GROUPS=[
  ['Okuma',['reading','readingmode','search']],
  ['Keşfet',['collections','coach','learning','knowledge']],
  ['Gelişmiş',['statistics','workspace','execreview','execintel','knowledgeos','settings']]
];
function _wisdomDestEntry(k){ for(var i=0;i<WISDOM_DESTS.length;i++)if(WISDOM_DESTS[i][0]===k)return WISDOM_DESTS[i]; return [k,k,'qt']; }
function _wisdomDestLabel(d){ return _wisdomDestEntry(d)[1]; }
var WISDOM_DEST_DESC={ reading:'Sakin okuma ekranı', readingmode:'Dikkat dağıtmayan tam-okuma', search:'Kütüphanede ara',
  collections:'Konu koleksiyonları', coach:'Bağlamsal öneriler', learning:'Öğrenme merkezi', knowledge:'Bilgi merkezi',
  statistics:'Kütüphane istatistikleri', workspace:'Birleşik çalışma alanı', execreview:'Yönetici incelemesi',
  execintel:'Yönetici karar zekâsı', knowledgeos:'Çapraz-modül bilgi haritası', settings:'Gösterim ve arşiv ayarları' };
function _wisdomMenuItems(){ var out=[]; WISDOM_DEST_GROUPS.forEach(function(g){ g[1].forEach(function(k){ out.push(_wisdomDestEntry(k)); }); }); return out; } // düz liste (klavye indeksi)
function _wisdomDestPanel(d){ // lazy: yalnız aktif destination render edilir
  if(d==='coach')return (typeof wcoCoachPanelHtml==='function')?wcoCoachPanelHtml():'';
  if(d==='learning')return (typeof wlcLearningSectionHtml==='function')?wlcLearningSectionHtml():'';
  if(d==='knowledge'||d==='collections')return (typeof wkgKnowledgeCenterHtml==='function')?wkgKnowledgeCenterHtml():'';
  if(d==='statistics')return (typeof wisdomStatsPanelHtml==='function')?wisdomStatsPanelHtml():'';
  if(d==='workspace')return (typeof wwsWorkspaceHtml==='function')?wwsWorkspaceHtml():'';
  if(d==='execreview')return (typeof werExecutiveWorkspaceHtml==='function')?werExecutiveWorkspaceHtml():'';
  if(d==='execintel')return (typeof weiDashboardHtml==='function')?weiDashboardHtml():'';
  if(d==='knowledgeos')return (typeof wkosKnowledgeOsHtml==='function')?wkosKnowledgeOsHtml():'';
  if(d==='settings'){ var s=''; if(typeof wisdomDisplayPanelHtml==='function')s+=wisdomDisplayPanelHtml(); if(typeof wiaExecutiveInsightCenterHtml==='function')s+=wiaExecutiveInsightCenterHtml(); if(typeof wisdomArchiveHealthCardHtml==='function')s+=wisdomArchiveHealthCardHtml(); return s; }
  return '';
}
window._wisdomDestPanel=_wisdomDestPanel;
function wisdomCommandMenuHtml(){
  var h='<div id="wisdom_cmd" class="wq-cmd" role="dialog" aria-modal="true" aria-label="Kütüphane menüsü" tabindex="-1" onkeydown="wisdomMenuKey(event)" style="position:fixed;inset:0;z-index:60;background:var(--s);display:flex;flex-direction:column;padding:20px;overflow:auto">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;width:100%;max-width:560px;margin-left:auto;margin-right:auto">'+ic('layers',16,'var(--t3)')+'<h2 style="font-size:15px;font-weight:800">Kütüphane</h2>'+
     '<button class="btn btn-g btn-sm wq-hero-btn" style="margin-left:auto" onclick="wisdomCloseMenu()" aria-label="Kapat" title="Kapat">'+ic('x',13,'var(--t3)')+'</button></div>';
  h+='<div role="menu" aria-label="Hedefler" style="display:flex;flex-direction:column;gap:1px;width:100%;max-width:560px;margin:0 auto">';
  var idx=0;
  WISDOM_DEST_GROUPS.forEach(function(g){
    h+='<div role="presentation" style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--t3);font-weight:700;padding:12px 4px 4px">'+U.esc(g[0])+'</div>';
    g[1].forEach(function(k){ var d=_wisdomDestEntry(k), a=(idx===_wisdomMenuIdx);
      h+='<button role="menuitem" id="wisdom_menuitem_'+idx+'" data-d="'+k+'" tabindex="'+(a?'0':'-1')+'" aria-selected="'+(a?'true':'false')+'" onclick="wisdomGoDest(this.dataset.d)" class="btn btn-g wq-hero-btn" style="justify-content:flex-start;background:'+(a?'var(--s2)':'transparent')+';padding:11px 14px;font-size:14px;min-height:44px'+(a?';outline:2px solid var(--blue);outline-offset:-2px':'')+'">'+ic(d[2],15,'var(--t3)')+' '+U.esc(d[1])+'</button>';
      idx++;
    });
  });
  h+='</div></div>';
  return h;
}
window.wisdomCommandMenuHtml=wisdomCommandMenuHtml;
function _wisdomFocus(id){ var el=(typeof ge==='function')?ge(id):null; if(el&&typeof el.focus==='function')el.focus(); }
function wisdomOpenMenu(){ _wisdomMenuOpen=true; _wisdomMenuIdx=0; if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); _wisdomFocus('wisdom_menuitem_0'); }
function wisdomCloseMenu(){ _wisdomMenuOpen=false; if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); _wisdomFocus('wisdom_menu_btn'); } // odak Kütüphane butonuna döner
function wisdomGoDest(d){ _wisdomMenuOpen=false; if(d==='readingmode'){ return wisdomEnterReading(); } _wisdomDest=(d==='reading'||d==='search')?null:d; if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); }
function wisdomBackToReading(){ _wisdomDest=null; _wisdomMenuOpen=false; if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); }
function wisdomMenuKey(ev){ if(!ev)return; var k=ev.key;
  if(k==='Escape'){ wisdomCloseMenu(); return; }
  var items=_wisdomMenuItems(), n=items.length; if(!n)return;
  if(k==='ArrowDown')_wisdomMenuIdx=(_wisdomMenuIdx+1)%n;
  else if(k==='ArrowUp')_wisdomMenuIdx=(_wisdomMenuIdx-1+n)%n;
  else if(k==='Home')_wisdomMenuIdx=0;
  else if(k==='End')_wisdomMenuIdx=n-1;
  else if(k==='Enter'){ if(typeof ev.preventDefault==='function')ev.preventDefault(); wisdomGoDest(items[_wisdomMenuIdx][0]); return; }
  else return; // Tab vb. native davranış korunur
  if(typeof ev.preventDefault==='function')ev.preventDefault();
  if(_wisdomMenuOpen&&typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes();
  _wisdomFocus('wisdom_menuitem_'+_wisdomMenuIdx);
}
window.wisdomOpenMenu=wisdomOpenMenu; window.wisdomCloseMenu=wisdomCloseMenu; window.wisdomGoDest=wisdomGoDest; window.wisdomBackToReading=wisdomBackToReading; window.wisdomMenuKey=wisdomMenuKey;
/* UX-R9 Reading Mode — dikkat-dağıtmayan tam-okuma. Yalnız modül-yerel bayrak;
   tarayıcı-deposu/Firestore/payload/bulut-yazımı/tam-ekran-API kullanmaz. Esc çıkar,
   odak giriş kontrolüne döner. */
function wisdomEnterReading(){ _wisdomReading=true; _wisdomDest=null; _wisdomMenuOpen=false; if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); }
function wisdomExitReading(){ _wisdomReading=false; if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); _wisdomFocus('wisdom_readmode_btn'); }
function wisdomReadingKey(ev){ if(ev&&ev.key==='Escape')wisdomExitReading(); }
window.wisdomEnterReading=wisdomEnterReading; window.wisdomExitReading=wisdomExitReading; window.wisdomReadingKey=wisdomReadingKey;
function wisdomReadingModeHtml(){
  var p=_wqHeroPick(); if(!p)return '<div class="fade" role="region" aria-label="Okuma Modu" style="text-align:center;padding:40px">'+ic('sun',15,'var(--t3)')+' Okunacak söz yok. <button class="btn btn-s btn-sm" onclick="wisdomExitReading()">Çık</button></div>';
  var q=p.q, id=U.esc(String(q.id));
  var h='<div class="fade wq-cmd" id="wisdom_readmode" role="region" aria-label="Okuma Modu" tabindex="-1" onkeydown="wisdomReadingKey(event)" style="min-height:60vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:24px 20px">';
  h+=(typeof wqUxStyleHtml==='function'?wqUxStyleHtml():'');
  if(q.category)h+='<div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--t3);font-weight:600;margin-bottom:22px">'+U.esc(q.category)+'</div>';
  h+='<p class="wq-hero-quote" style="font-size:clamp(20px,4.6vw,30px);line-height:1.6;font-weight:500;color:var(--t);margin:0 0 24px;max-width:64ch;word-break:break-word">'+U.esc(q.quote)+'</p>';
  if(q.author)h+='<p style="font-size:15px;font-weight:600;color:var(--blue);margin:0 0 26px">'+U.esc(q.author)+'</p>';
  h+='<div style="display:flex;gap:2px;justify-content:center;align-items:center;flex-wrap:wrap">';
  h+='<button class="btn btn-g btn-ic wq-hero-btn" style="width:38px;height:38px;font-size:20px;line-height:1" aria-label="Önceki söz" onclick="wqHeroNav(-1)">&lsaquo;</button>';
  h+='<button class="btn btn-g btn-ic wq-hero-btn" style="width:38px;height:38px" data-id="'+id+'" onclick="wqToggleFav(this.dataset.id)" aria-label="Favori">'+ic('star',15,q.favorite?'var(--orange)':'var(--t3)')+'</button>';
  h+='<button class="btn btn-g btn-sm wq-hero-btn" style="background:transparent;color:var(--t3)" data-id="'+id+'" onclick="wqHeroCopy(this.dataset.id)" aria-label="Kopyala">Kopyala</button>';
  h+='<button class="btn btn-g btn-sm wq-hero-btn" style="background:transparent;color:var(--t3)" data-id="'+id+'" onclick="wqHeroShare(this.dataset.id)" aria-label="Paylaş">Paylaş</button>';
  h+='<button class="btn btn-g btn-ic wq-hero-btn" style="width:38px;height:38px;font-size:20px;line-height:1" aria-label="Sonraki söz" onclick="wqHeroNav(1)">&rsaquo;</button>';
  h+='</div>';
  h+='<div role="status" aria-label="Okuma konumu" style="font-size:9px;color:var(--t3);margin-top:14px;letter-spacing:.05em">'+(p.idx+1)+' / '+p.total+'</div>';
  h+='<button class="btn btn-s btn-sm wq-hero-btn" style="margin-top:22px" onclick="wisdomExitReading()" aria-label="Okuma modundan çık">'+ic('x',12,'var(--t3)')+' Okuma Modundan Çık</button>';
  h+='</div>';
  return h;
}
window.wisdomReadingModeHtml=wisdomReadingModeHtml;
function renderWisdomReadingMode(){ sh('pinner',wisdomReadingModeHtml()); }
window.renderWisdomReadingMode=renderWisdomReadingMode;
function renderWisdomDest(){
  var h='<div class="fade">';
  h+=(typeof wqUxStyleHtml==='function'?wqUxStyleHtml():'');
  h+='<div class="sh"><div><h1 class="sh-t">'+U.esc(_wisdomDestLabel(_wisdomDest))+'</h1><p class="sh-sub">'+U.esc(WISDOM_DEST_DESC[_wisdomDest]||'Özlü Sözler kütüphanesi')+'</p></div>';
  h+='<button class="btn btn-s btn-sm wq-hero-btn" onclick="wisdomBackToReading()" aria-label="Okumaya dön" title="Okumaya dön">&lsaquo; Okumaya Dön</button></div>';
  h+='<div id="wisdom_dest_panel">'+_wisdomDestPanel(_wisdomDest)+'</div></div>';
  sh('pinner',h);
}
window.renderWisdomDest=renderWisdomDest;

function renderWisdomQuotes(){
  if(_wisdomReading){ renderWisdomReadingMode(); return; } // UX-R9: dikkat-dağıtmayan okuma modu
  if(_wisdomDest){ renderWisdomDest(); return; } // UX-R8: destination fullscreen görünümü
  var st=wqStats();
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Özlü Sözler</h1><p class="sh-sub">Kişisel özlü söz kütüphanen. Hedeflerden ve notlardan bağımsız.</p></div>';
  h+=(typeof wisdomSourceBadgeHtml==='function'?'<span style="align-self:center">'+wisdomSourceBadgeHtml()+'</span>':''); // SG-SHARD-P3d: kaynak rozeti (Bulut Arşivi / fallback: Yerel Güvenlik Arşivi)
  h+='<button id="wisdom_menu_btn" class="btn btn-s btn-sm wq-hero-btn" onclick="wisdomOpenMenu()" aria-label="Kütüphane menüsü" title="Kütüphane">'+ic('layers',13,'var(--t3)')+' Kütüphane</button>'; // UX-R8: tek komut-menüsü giriş noktası (araçlar/analitik/içgörüler burada)
  h+='<button class="btn btn-p" onclick="openWqForm()">'+ic('plus',13)+' Yeni Söz</button>';
  h+=(typeof wisdomIoButtonsHtml==='function'?wisdomIoButtonsHtml():''); // D10.3: içe/dışa aktarma butonları (additive)
  h+=(typeof wisdomMigrationButtonHtml==='function'?wisdomMigrationButtonHtml():'')+'</div>'; // D10.6.1: admin-only Öz Sözler→Özlü Sözler taşıma butonu (additive, non-admin='')
  h+=(typeof wisdomStatusLineHtml==='function'?wisdomStatusLineHtml():''); // SG-SHARD-P2: salt-okunur bulut-depolama durum satırı (yalnız migration/hata; normal legacy'de '')
  // WISDOM-UXR1: sakin okuma merkezi — birincil odak, ekranın görsel merkezi
  h+=(typeof wqUxStyleHtml==='function'?wqUxStyleHtml():''); // UX-R2: scoped stil (hover/focus-visible/reduced-motion)
  h+=wqHeroHtml();
  // UX-R1.5: kartlı 4-box → ince tipografik özet satırı (dashboard hissi kaldırıldı; kenarlık/kutu yok). Pasif/Beni-düşündüren durum filtreleriyle erişilir; türetilmiş gösterim istatistikleri katlı panelde. wqStats DEĞİŞMEDİ.
  h+='<p style="font-size:10.5px;color:var(--t3);text-align:center;margin-bottom:20px;letter-spacing:.02em">'+st.total+' söz &middot; '+st.favorites+' favori &middot; '+st.active+' aktif &middot; '+st.pinned+' sabit</p>';
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
  // UX-R8: ağır paneller default ekrandan KALDIRILDI → yalnız Kütüphane komut-menüsü arkasında (lazy).
  h+='<div id="wq_list"></div></div>';
  if(_wisdomMenuOpen)h+=wisdomCommandMenuHtml(); // UX-R8: fullscreen komut-menüsü overlay (yalnız açıkken)
  sh('pinner',h);
  _wqRenderList();
}
window.renderWisdomQuotes=renderWisdomQuotes;
/* P0-LOAD (RC-3 düzeltmesi): sakin, düzen-kaymayan iskelet — mevcut placeholder ile
   aynı görsel dil (kart yok, spinner/modal/toast yok, responsive, role=status). */
function _wqListSkeletonHtml(text,icon){
  return '<div role="status" aria-live="polite" style="padding:36px 20px;text-align:center;color:var(--t3)">'+ic(icon,18,'var(--t3)')+'<p style="font-size:12.5px;margin-top:10px;line-height:1.5">'+U.esc(text)+'</p></div>';
}
function _wqErrorBannerHtml(){
  return '<div role="status" aria-live="polite" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;margin-bottom:10px;border-radius:8px;background:var(--s2);font-size:11.5px;color:var(--t2)">'+
    '<span style="display:flex;align-items:center;gap:7px">'+ic('csq',13,'var(--orange)')+'Arşiv güncellenemedi.</span>'+
    '<button class="btn btn-s btn-sm" onclick="if(typeof wqManualRetryLoad===\'function\')wqManualRetryLoad()">'+ic('ref',12)+' Yeniden Dene</button></div>';
}
function _wqRenderList(){
  var box=ge('wq_list'); if(!box)return;
  var _st=(typeof wqLifecycleState==='function')?wqLifecycleState():'ready'; // RC-3: liste hero ile AYNI tek yetkili kaynağı okur
  if(_st==='idle'||_st==='waiting_auth'||_st==='activating'||_st==='loading'){
    box.innerHTML=_wqListSkeletonHtml('Bilgelik arşivi hazırlanıyor…','ref'); return; // ayarlanmamış/beklemedeki durumda ASLA "Henüz söz yok"
  }
  if(_st==='retrying'){
    var _rs=(typeof wisdomActivationRetryStatus==='function')?wisdomActivationRetryStatus():{attempt:0,max:3};
    box.innerHTML=_wqListSkeletonHtml('Arşiv yüklenemedi. Otomatik olarak yeniden deneniyor… (Deneme '+_rs.attempt+'/'+_rs.max+')','csq'); return;
  }
  var list=wqSort(wqFilter(wqList(),wqQuery,wqFilterMode,wqCat,wqLang)); var h='';
  var filtering=wqQuery.trim()||wqFilterMode!=='all'||wqCat||wqLang;
  if(filtering)h+='<p style="font-size:11px;color:var(--t3);margin-bottom:8px">'+list.length+' sonuç</p>';
  if(!list.length){
    if(_st==='error'&&!filtering){
      h+='<div class="card" style="padding:44px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">'+ic('csq',30,'var(--orange)')+'<p style="font-weight:700;font-size:15px">Arşiv şu an yüklenemiyor.</p><button class="btn btn-p" onclick="if(typeof wqManualRetryLoad===\'function\')wqManualRetryLoad()">'+ic('ref',13)+' Yeniden Dene</button></div>';
      box.innerHTML=h; return;
    }
    var msg=filtering?'Ölçütlere uygun söz yok.':'Henüz söz yok.';
    h+='<div class="card" style="padding:44px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">'+ic('qt',30,'var(--t3)')+'<p style="font-weight:700;font-size:15px">'+msg+'</p>'+((!filtering)?'<button class="btn btn-p" onclick="openWqForm()">'+ic('plus',13)+' İlk sözünü ekle</button>':'')+'</div>';
    box.innerHTML=h; return;
  }
  if(_st==='error')h+=_wqErrorBannerHtml(); // kayıtlar mevcut → yalnız küçük, engellemeyen şerit
  h+='<div style="display:flex;flex-direction:column;gap:8px">';
  list.forEach(function(w){ var id=U.esc(String(w.id));
    /* QUOTES-CONSOLIDATION-P1 Step 5B: kompakt kart. Varsayılan görünür = göstergeler +
       söz + yazar + birincil aksiyonlar (Favori/Sabitle/Düzenle). İkincil metadata
       (kaynak/etiket/not/dil/öncelik/güncellenme/durum) ve ikincil aksiyonlar (Beni
       düşündürdü/Aktif-Pasif/Sil) native <details> içinde katlı. Söz metni TAM (clamp yok).
       Mevcut CRUD fonksiyonları yeniden kullanılır — yeni yazma yolu yok. */
    h+='<div class="card" style="padding:11px 14px'+(w.active?'':';opacity:.55')+'">';
    /* üst: sol (göstergeler+söz+yazar) | sağ (3 birincil aksiyon yan yana) — aksiyonlar
       söz ile paralel olduğundan kart yüksekliğine eklenmez; metadata katlanınca kart daralır. */
    h+='<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:5px">';
    if(w.category)h+='<span class="pill p-blue" style="font-size:9px">'+U.esc(w.category)+'</span>';
    if(w.favorite)h+='<span class="pill p-orange" style="font-size:9px" title="Favori">★</span>';
    if(w.pinned)h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">Sabit</span>';
    if(w.reflected)h+='<span class="pill" style="font-size:9px;background:var(--bl);color:var(--blue)" title="Beni düşündürdü">💡</span>';
    if(!w.active)h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3)">Pasif</span>';
    h+='</div>';
    h+='<p style="font-size:13.5px;font-style:italic;line-height:1.6;color:var(--t);word-break:break-word">&ldquo;'+U.esc(w.quote)+'&rdquo;</p>';
    if(w.author)h+='<p style="font-size:11px;font-weight:700;color:var(--blue);margin-top:4px">&mdash; '+U.esc(w.author)+'</p>';
    h+='</div>';
    /* birincil aksiyonlar (söz ile paralel sağ kolon) */
    h+='<div style="display:flex;gap:3px;flex-shrink:0">';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="Favori" aria-label="Favori" data-id="'+id+'" onclick="wqToggleFav(this.dataset.id)">'+ic('star',12,w.favorite?'var(--orange)':'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="'+(w.pinned?'Sabitlemeyi kaldır':'Sabitle')+'" aria-label="Sabitle" data-id="'+id+'" onclick="wqTogglePin(this.dataset.id)">'+ic('star',12,w.pinned?'var(--blue)':'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="Düzenle" aria-label="Düzenle" data-id="'+id+'" onclick="openWqForm(this.dataset.id)">'+ic('edit',12,'var(--t3)')+'</button>';
    h+='</div></div>';
    /* ikincil metadata + aksiyonlar (native <details>, varsayılan katlı, 0 write) */
    h+='<details style="margin-top:6px"><summary style="cursor:pointer;font-size:10.5px;color:var(--t3);padding:2px 0">Detay ve diğer işlemler</summary><div style="margin-top:6px">';
    if(w.source)h+='<p style="font-size:10px;color:var(--t3)">Kaynak: '+U.esc(w.source)+'</p>';
    if(w.tags&&w.tags.length)h+='<p style="font-size:10px;color:var(--t3);margin-top:2px">'+w.tags.map(function(t){return '#'+U.esc(t);}).join(' ')+'</p>';
    if(w.priority)h+='<p style="font-size:10px;color:var(--t3);margin-top:2px">Öncelik: '+Number(w.priority)+'</p>';
    if(w.language&&w.language!=='tr')h+='<p style="font-size:10px;color:var(--t3);margin-top:2px">Dil: '+U.esc(w.language)+'</p>';
    h+='<p style="font-size:10px;color:var(--t3);margin-top:2px">Durum: '+(w.active?'Aktif':'Pasif')+'</p>';
    if(w.notes&&typeof isRichTextEmpty==='function'&&!isRichTextEmpty(w.notes))h+='<div class="rt" style="font-size:11px;line-height:1.5;color:var(--t2);margin-top:4px">'+renderRichText(w.notes)+'</div>';
    h+='<p style="font-size:9.5px;color:var(--t3);margin-top:4px">Güncellenme: '+U.esc(_wqDate(w.updatedAt))+'</p>';
    h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">';
    h+='<button class="btn btn-g btn-sm" title="Beni düşündürdü" data-id="'+id+'" onclick="wqToggleReflect(this.dataset.id)">'+(w.reflected?'💡 Düşündürdü ✓':'Beni düşündürdü')+'</button>';
    h+='<button class="btn btn-g btn-sm" title="'+(w.active?'Pasifleştir':'Aktifleştir')+'" data-id="'+id+'" onclick="wqToggleActive(this.dataset.id)">'+(w.active?'Pasifleştir':'Aktifleştir')+'</button>';
    h+='<button class="btn btn-g btn-sm" style="color:var(--red)" title="Sil" aria-label="Sil" data-id="'+id+'" onclick="wqDelete(this.dataset.id)">'+ic('trash',11,'var(--red)')+' Sil</button>';
    h+='</div></div></details>';
    h+='</div>';
  });
  h+='</div>'; box.innerHTML=h;
}
window._wqRenderList=_wqRenderList;
function _wqDate(iso){ if(!iso)return '—'; try{var d=new Date(iso); if(isNaN(d))return String(iso); return d.getDate()+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}catch(e){return String(iso);} }
