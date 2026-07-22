/* ══════════════════════════════════════════════════════════════════════════
   D10.5.1 — İLKELERİM (Kişisel Karakter Sistemi) · Kütüphane + CRUD
   Mevcut D.principles koleksiyonunun RICH modele evrimi. Legacy {id,type,text} uyumlu.
   Bu faz: model + normalize + validation + ayrı ekran + CRUD + dirty-guard + backup/restore uyumu.
   YOK (sonraki fazlar): rotasyon, timer, ortak kart, sabah/öğlen/akşam, import/export, istatistik-öğrenme, AI.
   ══════════════════════════════════════════════════════════════════════════ */

var P_LIMITS={title:140,statement:1200,category:100,source:180,notes:5000,tags:20,tag:50};

/* ENUM'lar — [anahtar, Türkçe etiket] */
var P_STATUS=[['active','Aktif'],['paused','Duraklatıldı'],['seasonal','Mevsimsel'],['internalized','Karakterime Yerleşti'],['archived','Arşiv']];
var P_TYPES=[['principle','İlke'],['rule','Kural'],['mental_seed','Zihinsel Tohum'],['promise_to_self','Kendime Söz'],['behavior_standard','Davranış Standardı'],['reflection_question','Öz Değerlendirme Sorusu']];
var P_LIFEAREAS=[['myself','Kendim'],['spouse','Eşim'],['daughters','Kızlarım'],['family','Ailem'],['business','İş'],['trade','Ticaret'],['leadership','Liderlik'],['health','Sağlık'],['spirituality','Maneviyat'],['society','Toplum'],['character','Karakter']];
var _pStatusKeys=P_STATUS.map(function(x){return x[0];});
var _pTypeKeys=P_TYPES.map(function(x){return x[0];});
var _pAreaKeys=P_LIFEAREAS.map(function(x){return x[0];});
function _pLbl(arr,key){for(var i=0;i<arr.length;i++)if(arr[i][0]===key)return arr[i][1];return arr[0][1];}
function pStatusLabel(s){return _pLbl(P_STATUS,s);}
function pTypeLabel(t){return _pLbl(P_TYPES,t);}
function pAreaLabel(a){return _pLbl(P_LIFEAREAS,a);}
/* status sıralama önceliği (deterministik sort için) */
var _pStatusOrder={active:0,seasonal:1,paused:2,internalized:3,archived:4};
/* legacy type metni → yeni type enum (eşleşmezse category'ye taşınır) */
var _pLegacyTypeMap={'kural':'rule','ilke':'principle','prensip':'principle','zihinsel tohum':'mental_seed','kendime söz':'promise_to_self','davranış standardı':'behavior_standard','öz değerlendirme sorusu':'reflection_question'};

function _pSeq(){ _pSeq._c=(_pSeq._c||0)+1; return _pSeq._c; }
function newPrincipleId(){ return 'pr'+Date.now().toString(36)+'-'+(_pSeq()).toString(36); }
function _pNow(){ return new Date().toISOString(); }
function _pNorm(s){ return String(s||'').toLocaleLowerCase('tr').replace(/\s+/g,' ').trim(); }
function _pTags(v){
  var arr=Array.isArray(v)?v:(v!=null&&v!==''?String(v).split(/[;,]/):[]);
  var seen={},out=[];
  arr.forEach(function(t){ t=String(t).trim().slice(0,P_LIMITS.tag); if(!t)return; var k=t.toLocaleLowerCase('tr'); if(seen[k])return; seen[k]=1; out.push(t); });
  return out.slice(0,P_LIMITS.tags);
}
function _pShortTitle(statement){ var s=String(statement||'').replace(/\s+/g,' ').trim(); if(s.length<=60)return s; return s.slice(0,57).replace(/\s+\S*$/,'')+'…'; }

/* ── Saf normalize (legacy {id,type,text} + rich uyumlu). Girdiyi mutasyona uğratmaz. Prototype-safe (taze nesne). ── */
function normalizePrinciple(p,i){
  if(!p||typeof p!=='object')return null;
  var statement=(p.statement!=null?String(p.statement):(p.text!=null?String(p.text):'')).replace(/\r\n/g,'\n').slice(0,P_LIMITS.statement).trim();
  if(!statement)return null;
  var title=(p.title!=null&&String(p.title).trim())?String(p.title).slice(0,P_LIMITS.title).trim():_pShortTitle(statement);
  var rawType=p.type!=null?String(p.type):'';
  var type, legacyToCat='';
  if(_pTypeKeys.indexOf(rawType)>=0){ type=rawType; }
  else { var m=_pLegacyTypeMap[_pNorm(rawType)]; if(m){ type=m; } else { type='principle'; if(rawType.trim())legacyToCat=rawType.trim(); } }
  var category=(p.category!=null&&String(p.category).trim())?String(p.category).slice(0,P_LIMITS.category).trim():legacyToCat.slice(0,P_LIMITS.category);
  var status=_pStatusKeys.indexOf(p.status)>=0?p.status:'active';
  var lifeArea=_pAreaKeys.indexOf(p.lifeArea)>=0?p.lifeArea:'myself';
  var priority=Math.max(1,Math.min(5,Math.round(Number(p.priority))||3));
  return {
    id:(p.id!=null&&String(p.id))?String(p.id):('pr-legacy-'+i),
    title:title, statement:statement, lifeArea:lifeArea, category:category, type:type, status:status,
    priority:priority, tags:_pTags(p.tags),
    source:(p.source!=null&&String(p.source).trim())?String(p.source).slice(0,P_LIMITS.source):'Kendi İlkem',
    notes:String(p.notes||'').slice(0,P_LIMITS.notes),
    pinned:!!p.pinned, reflected:!!p.reflected,
    /* D10.5.2 — gösterim alanları (additive; legacy'de yoksa varsayılan, otomatik migration write YOK) */
    frequency:(['pageopen','1h','3h','6h','12h','daily','every3days','weekly','monthly','manual'].indexOf(p.frequency)>=0)?p.frequency:'daily',
    dayPart:(['any','morning','afternoon','evening','night'].indexOf(p.dayPart)>=0)?p.dayPart:'any',
    createdAt:p.createdAt?String(p.createdAt):_pNow(),
    updatedAt:p.updatedAt?String(p.updatedAt):(p.createdAt?String(p.createdAt):_pNow()),
    /* internalizedAt: yalnız gerçek değeri geçir; icat etme (write katmanı set eder). status değişse de tarih korunur. */
    internalizedAt:(p.internalizedAt!=null&&String(p.internalizedAt).trim())?String(p.internalizedAt):null
  };
}
function normalizePrinciples(list){ return (Array.isArray(list)?list:[]).map(normalizePrinciple).filter(Boolean); }

/* ── Erişim ── */
function pList(){ if(!Array.isArray(D.principles))D.principles=[]; return D.principles; }
function pById(id){ return pList().filter(function(p){return String(p.id)===String(id);})[0]||null; }
/* Görüntü-normalize: D.principles'i MUTASYONA UĞRATMADAN normalize kopya döndürür (legacy display için). */
function pViewList(){ return normalizePrinciples(pList()); }
function pCategories(){ var s={}; pViewList().forEach(function(p){ if(p.category)s[p.category]=1; }); return Object.keys(s).sort(function(a,b){return a.localeCompare(b,'tr');}); }

/* ── Validation ── */
function pValidateStatement(statement){
  var q=String(statement||'').trim();
  if(!q)return 'İlke cümlesi gerekli.';
  if(q.length>P_LIMITS.statement)return 'İlke cümlesi çok uzun (en fazla '+P_LIMITS.statement+' karakter).';
  if(!/[\p{L}]/u.test(q))return 'İlke cümlesi anlamlı bir ifade içermeli.';
  return null;
}
function pIsDuplicate(statement,excludeId){
  var ns=_pNorm(statement);
  return pList().some(function(p){ return String(p.id)!==String(excludeId||'')&&_pNorm(p.statement!=null?p.statement:p.text)===ns; });
}

/* ── Deterministik sıralama: pinned > priority desc > status önceliği > updatedAt desc > createdAt desc > id ── */
function pSort(list){
  return list.slice().sort(function(a,b){
    if(!!b.pinned!==!!a.pinned)return b.pinned?1:-1;
    if(b.priority!==a.priority)return b.priority-a.priority;
    var sa=_pStatusOrder[a.status]!=null?_pStatusOrder[a.status]:9, sb=_pStatusOrder[b.status]!=null?_pStatusOrder[b.status]:9;
    if(sa!==sb)return sa-sb;
    if((b.updatedAt||'')!==(a.updatedAt||''))return (b.updatedAt||'')<(a.updatedAt||'')?-1:1;
    if((b.createdAt||'')!==(a.createdAt||''))return (b.createdAt||'')<(a.createdAt||'')?-1:1;
    return String(a.id)<String(b.id)?-1:(String(a.id)>String(b.id)?1:0);
  });
}
/* Arama + filtre (status/area/type). Boş area/type = tümü. */
function pFilter(list,q,statusMode,area,type){
  var nq=_pNorm(q);
  return list.filter(function(p){
    if(statusMode==='pinned'){ if(!p.pinned)return false; }
    else if(statusMode==='reflected'){ if(!p.reflected)return false; }
    else if(statusMode&&statusMode!=='all'){ if(p.status!==statusMode)return false; }
    if(area&&p.lifeArea!==area)return false;
    if(type&&p.type!==type)return false;
    if(!nq)return true;
    var hay=[p.title,p.statement,pAreaLabel(p.lifeArea),p.category,pTypeLabel(p.type),(p.tags||[]).join(' '),p.source,p.notes].join(' ');
    return _pNorm(hay).indexOf(nq)>=0;
  });
}

/* ── Dirty draft (ayrı namespace) ── */
var PRINCIPLE_DRAFT={open:false,id:null,original:null,current:null,dirty:false};
function _pFormSnapshot(){
  function g(id){var e=document.getElementById(id);return e?(e.type==='checkbox'?!!e.checked:e.value):'';}
  return JSON.stringify({title:g('p_title'),statement:g('p_statement'),lifeArea:g('p_lifeArea'),category:g('p_category'),type:g('p_type'),status:g('p_status'),priority:g('p_priority'),tags:g('p_tags'),source:g('p_source'),notes:g('p_notes'),pinned:g('p_pinned'),reflected:g('p_reflected')});
}
function pCaptureDraft(){ if(!PRINCIPLE_DRAFT.open)return; if(!document.getElementById('p_statement'))return; PRINCIPLE_DRAFT.current=_pFormSnapshot(); PRINCIPLE_DRAFT.dirty=(PRINCIPLE_DRAFT.current!==PRINCIPLE_DRAFT.original); }
function pDraftDirty(){ return PRINCIPLE_DRAFT.open&&PRINCIPLE_DRAFT.dirty; }
function pClearDraft(){ PRINCIPLE_DRAFT={open:false,id:null,original:null,current:null,dirty:false}; }

/* ── İstatistik özeti (salt türetim, write yok) ── */
function pStats(){
  var l=pViewList();
  return {total:l.length,
    active:l.filter(function(p){return p.status==='active';}).length,
    internalized:l.filter(function(p){return p.status==='internalized';}).length,
    archived:l.filter(function(p){return p.status==='archived';}).length,
    pinned:l.filter(function(p){return p.pinned;}).length,
    reflected:l.filter(function(p){return p.reflected;}).length};
}

/* ── Filtre durumu ── */
var pQuery='', pStatusFilter='all', pArea='', pType='';
function pSetQuery(v){ pQuery=v; renderPrinciples(); }
function pSetFilter(v){ pStatusFilter=v; renderPrinciples(); }
function pSetArea(v){ pArea=v; renderPrinciples(); }
function pSetType(v){ pType=v; renderPrinciples(); }

/* ── Render ── */
function renderPrinciples(){
  var st=pStats();
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">İlkelerim</h1><p class="sh-sub">Hayatında yaşatmak, zihnine yerleştirmek ve karakterine dönüştürmek istediğin ilkeler.</p></div>';
  h+='<button class="btn btn-p" onclick="openPrincipleForm()">'+ic('plus',13)+' Yeni İlke</button></div>';
  // özet kartları
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';
  [['Toplam',st.total],['Aktif',st.active],['Karakterime Yerleşti',st.internalized],['Arşiv',st.archived]].forEach(function(x){
    h+='<div class="card" style="padding:8px 12px;flex:1;min-width:100px"><p style="font-size:10px;color:var(--t3)">'+x[0]+'</p><p style="font-size:18px;font-weight:800">'+x[1]+'</p></div>';});
  h+='</div>';
  if(typeof cdPanelHtml==='function')h+=cdPanelHtml(); // D10.5.2: ortak gösterim motoru paneli
  if(typeof principleDisplayPanelHtml==='function')h+=principleDisplayPanelHtml(); // D10.5.2: ilke gösterim filtreleri
  // arama + status filtresi
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">';
  h+='<input class="inp" id="p_search" style="max-width:280px" placeholder="İlkelerde ara..." value="'+U.esc(pQuery)+'" oninput="pSetQuery(this.value)">';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';
  [['all','Tümü'],['active','Aktif'],['paused','Duraklatıldı'],['seasonal','Mevsimsel'],['internalized','Karakterime Yerleşti'],['archived','Arşiv'],['pinned','Sabitlenenler'],['reflected','Beni Düşündürenler']].forEach(function(f){var a=pStatusFilter===f[0];
    h+='<button class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'" data-v="'+f[0]+'" onclick="pSetFilter(this.dataset.v)">'+f[1]+'</button>';});
  h+='</div></div>';
  // hayat alanı + tür filtreleri
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">';
  h+='<select class="inp" style="width:auto;height:30px;font-size:12px" onchange="pSetArea(this.value)"><option value="">Tüm hayat alanları</option>'+P_LIFEAREAS.map(function(a){return '<option value="'+a[0]+'"'+(pArea===a[0]?' selected':'')+'>'+U.esc(a[1])+'</option>';}).join('')+'</select>';
  h+='<select class="inp" style="width:auto;height:30px;font-size:12px" onchange="pSetType(this.value)"><option value="">Tüm türler</option>'+P_TYPES.map(function(t){return '<option value="'+t[0]+'"'+(pType===t[0]?' selected':'')+'>'+U.esc(t[1])+'</option>';}).join('')+'</select>';
  h+='</div>';
  // liste
  var list=pSort(pFilter(pViewList(),pQuery,pStatusFilter,pArea,pType));
  if(!pViewList().length){
    h+='<div class="card" style="padding:48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">'+ic('sh',32,'var(--t3)')+
       '<p style="font-weight:700;font-size:16px">Henüz bir ilke eklemedin.</p>'+
       '<p style="font-size:13px;color:var(--t3);max-width:420px;line-height:1.6">Nasıl bir insan olmak istediğini, hangi kurallarla yaşamak istediğini ve zihnine yerleştirmek istediğin cümleleri buraya ekle.</p>'+
       '<button class="btn btn-p" onclick="openPrincipleForm()">'+ic('plus',13)+' İlk İlkeyi Ekle</button></div>';
  } else if(!list.length){
    h+='<div class="card" style="padding:32px;text-align:center"><p style="color:var(--t3)">Filtreye uygun ilke yok.</p></div>';
  } else {
    h+='<div class="ga">';
    list.forEach(function(p){ h+='<div class="card cp">'+pCard(p)+'</div>'; });
    h+='</div>';
  }
  h+='</div>';
  sh('pinner',h);
}

function pCard(p){
  var e=function(v){return U.esc(v);};
  var statusColor={active:'p-green',paused:'p-orange',seasonal:'p-blue',internalized:'p-purple',archived:'p-gray'}[p.status]||'p-blue';
  var h='';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px">';
  h+='<span class="pill p-purple" style="font-size:9.5px">'+e(pAreaLabel(p.lifeArea))+'</span>';
  h+='<span class="pill p-blue" style="font-size:9.5px">'+e(pTypeLabel(p.type))+'</span>';
  h+='<span class="pill '+statusColor+'" style="font-size:9.5px">'+e(pStatusLabel(p.status))+'</span>';
  if(p.category)h+='<span class="pill p-gray" style="font-size:9.5px">'+e(p.category)+'</span>';
  h+='<span style="font-size:10px;color:var(--orange);margin-left:auto">'+'★'.repeat(p.priority)+'</span>';
  h+='</div>';
  if(p.title&&p.title!==p.statement)h+='<p style="font-weight:800;font-size:13px;margin-bottom:3px">'+e(p.title)+'</p>';
  h+='<p style="font-size:13.5px;line-height:1.6;color:var(--t)">'+e(p.statement)+'</p>';
  if(p.tags&&p.tags.length)h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">'+p.tags.map(function(t){return '<span class="pill p-gray" style="font-size:9px">'+e(t)+'</span>';}).join('')+'</div>';
  if(p.notes)h+='<p style="font-size:11.5px;color:var(--t2);margin-top:6px;line-height:1.55">'+(typeof renderRichText==='function'?renderRichText(p.notes):e(p.notes))+'</p>';
  h+='<div style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:10px;color:var(--t3)">';
  h+='<span>'+e(p.source)+'</span>';
  if(typeof _gnDate==='function'&&p.updatedAt)h+='<span>· '+e(_gnDate(p.updatedAt))+'</span>';
  h+='</div>';
  // hızlı işlemler
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">';
  h+='<button class="btn btn-g btn-sm" onclick="openPrincipleForm(\''+e(p.id)+'\')">Düzenle</button>';
  h+='<button class="btn btn-g btn-sm" style="'+(p.pinned?'color:var(--blue)':'')+'" onclick="pTogglePin(\''+e(p.id)+'\')">'+(p.pinned?'Sabit ✓':'Sabitle')+'</button>';
  h+='<button class="btn btn-g btn-sm" style="'+(p.reflected?'color:var(--purple)':'')+'" onclick="pToggleReflect(\''+e(p.id)+'\')">Beni düşündürdü'+(p.reflected?' ✓':'')+'</button>';
  h+='<select class="inp" style="width:auto;height:26px;font-size:11px" onchange="pSetStatus(\''+e(p.id)+'\',this.value)">'+P_STATUS.map(function(s){return '<option value="'+s[0]+'"'+(p.status===s[0]?' selected':'')+'>'+e(s[1])+'</option>';}).join('')+'</select>';
  h+='<button class="btn btn-g btn-sm" style="color:var(--red);margin-left:auto" onclick="pDelete(\''+e(p.id)+'\')">Sil</button>';
  h+='</div>';
  return h;
}

/* ── Form ── */
function openPrincipleForm(id){
  if(PRINCIPLE_DRAFT.open){ pCaptureDraft(); if(PRINCIPLE_DRAFT.dirty&&!confirm('Kaydedilmemiş ilke değişiklikleri var. Vazgeçilsin mi?'))return; }
  pClearDraft();
  var p=id?normalizePrinciple(pById(id),0):null;
  var e=function(v){return v?U.esc(v):'';};
  var h='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h2 style="font-size:17px;font-weight:800">'+(p?'İlkeyi Düzenle':'Yeni İlke')+'</h2><button class="btn btn-g btn-ic" style="width:30px;height:30px" onclick="closeModal()">'+ic('x',14)+'</button></div>';
  h+='<input class="inp" id="p_title" placeholder="Kısa başlık (opsiyonel)" value="'+(p?e(p.title):'')+'" oninput="pCaptureDraft()" style="margin-bottom:8px">';
  h+='<textarea class="inp" id="p_statement" rows="3" placeholder="Öfkeliyken önemli karar vermem." oninput="pCaptureDraft()" style="margin-bottom:4px">'+(p?e(p.statement):'')+'</textarea>';
  h+='<p style="font-size:11px;color:var(--t3);margin:0 0 8px">Görev değil; yaşamak, tekrar etmek veya karakterine dönüştürmek istediğin cümleyi yaz.</p>';
  h+='<div style="display:flex;gap:8px;margin-bottom:8px">';
  h+='<select class="inp" id="p_lifeArea" style="flex:1">'+P_LIFEAREAS.map(function(a){return '<option value="'+a[0]+'"'+((p&&p.lifeArea===a[0])||(!p&&a[0]==='myself')?' selected':'')+'>'+U.esc(a[1])+'</option>';}).join('')+'</select>';
  h+='<select class="inp" id="p_type" style="flex:1">'+P_TYPES.map(function(t){return '<option value="'+t[0]+'"'+((p&&p.type===t[0])||(!p&&t[0]==='principle')?' selected':'')+'>'+U.esc(t[1])+'</option>';}).join('')+'</select>';
  h+='</div>';
  h+='<div style="display:flex;gap:8px;margin-bottom:8px">';
  h+='<select class="inp" id="p_status" style="flex:1">'+P_STATUS.map(function(s){return '<option value="'+s[0]+'"'+((p&&p.status===s[0])||(!p&&s[0]==='active')?' selected':'')+'>'+U.esc(s[1])+'</option>';}).join('')+'</select>';
  h+='<input class="inp" id="p_priority" type="number" min="1" max="5" placeholder="Öncelik 1-5" value="'+(p?p.priority:3)+'" oninput="pCaptureDraft()" style="flex:1">';
  h+='</div>';
  h+='<input class="inp" id="p_category" placeholder="Kategori (ör. Soğukkanlılık)" value="'+(p?e(p.category):'')+'" oninput="pCaptureDraft()" style="margin-bottom:8px">';
  h+='<input class="inp" id="p_tags" placeholder="Etiketler (virgülle)" value="'+(p?e(p.tags.join(', ')):'')+'" oninput="pCaptureDraft()" style="margin-bottom:8px">';
  h+='<input class="inp" id="p_source" placeholder="Kaynak" value="'+(p?e(p.source):'Kendi İlkem')+'" oninput="pCaptureDraft()" style="margin-bottom:8px">';
  h+='<p class="lbl" style="font-size:11px;color:var(--t3);margin:2px 0 3px">Not (zengin metin)</p>'+(typeof rtBar==='function'?rtBar('p_notes'):'');
  h+='<textarea class="inp" id="p_notes" rows="3" placeholder="Kişisel not... (**kalın**, *italik*, - liste)" oninput="pCaptureDraft()" style="margin-bottom:8px">'+(p?e(p.notes):'')+'</textarea>';
  h+='<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" id="p_pinned" '+((p&&p.pinned)?'checked':'')+' onchange="pCaptureDraft()"> Sabit</label>';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" id="p_reflected" '+((p&&p.reflected)?'checked':'')+' onchange="pCaptureDraft()"> Beni düşündürdü</label>';
  h+='</div>';
  h+='<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-g" onclick="pFormCancel()">İptal</button><button class="btn btn-p" data-id="'+(p?U.esc(p.id):'')+'" onclick="pFormSave(this.dataset.id)">Kaydet</button></div>';
  showModal(h);
  PRINCIPLE_DRAFT.open=true; PRINCIPLE_DRAFT.id=id||null; PRINCIPLE_DRAFT.original=_pFormSnapshot(); PRINCIPLE_DRAFT.current=PRINCIPLE_DRAFT.original; PRINCIPLE_DRAFT.dirty=false;
}
function pFormCancel(){ pClearDraft(); sh('modal-root',''); }

function pFormSave(id){
  var g=function(k){var el=document.getElementById(k);return el?(el.type==='checkbox'?!!el.checked:el.value):'';};
  var statement=g('p_statement');
  var err=pValidateStatement(statement);
  if(err){ alert(err); return; }
  var existing=id?pById(id):null;
  if(pIsDuplicate(statement,id)){ alert('Aynı ilke zaten mevcut.'); return; }
  var draft={
    id:id||undefined, title:g('p_title'), statement:statement, lifeArea:g('p_lifeArea'), category:g('p_category'),
    type:g('p_type'), status:g('p_status'), priority:g('p_priority'), tags:g('p_tags'), source:g('p_source'),
    notes:g('p_notes'), pinned:g('p_pinned'), reflected:g('p_reflected'),
    createdAt:existing?(existing.createdAt||_pNow()):_pNow()
  };
  var norm=normalizePrinciple(draft,0);
  norm.id=id?String(id):newPrincipleId();
  // internalizedAt write-katmanı: internalized'a İLK geçişte set, tarih korunur
  var prevInternalized=existing?existing.internalizedAt:null;
  if(norm.status==='internalized'){ norm.internalizedAt=prevInternalized?String(prevInternalized):_pNow(); }
  else { norm.internalizedAt=prevInternalized?String(prevInternalized):null; }
  // No-change tespiti: mevcut kaydın normalize hâli (updatedAt hariç) aynıysa 0 write
  if(existing){
    var _stripU=function(o){var c=Object.assign({},o);c.updatedAt='';return JSON.stringify(c);};
    var curNorm=normalizePrinciple(pById(id),0);
    norm.updatedAt=(curNorm&&curNorm.updatedAt)?curNorm.updatedAt:_pNow();
    if(curNorm&&_stripU(norm)===_stripU(curNorm)){ pClearDraft(); sh('modal-root',''); renderPrinciples(); return; } // değişiklik yok → 0 write
    norm.updatedAt=_pNow();
  } else { norm.updatedAt=_pNow(); }
  if(typeof snap==='function')snap();
  if(existing){ var idx=pList().map(function(x){return String(x.id);}).indexOf(String(id)); if(idx>=0)D.principles[idx]=norm; else D.principles.unshift(norm); }
  else { D.principles.unshift(norm); }
  pClearDraft();
  if(typeof save==='function')save();
  sh('modal-root','');
  renderPrinciples();
}

function pDelete(id){
  if(!confirm('Bu ilke kalıcı olarak silinsin mi?'))return;
  if(typeof snap==='function')snap();
  D.principles=pList().filter(function(p){return String(p.id)!==String(id);});
  if(typeof save==='function')save();
  renderPrinciples();
}

/* ── Toggle / status (gerçek değişimde tek write) ── */
function _pWriteItem(id,mut){
  var idx=pList().map(function(x){return String(x.id);}).indexOf(String(id));
  if(idx<0)return false;
  var cur=normalizePrinciple(D.principles[idx],idx);  // legacy'yi rich'e yükselt
  mut(cur);
  cur.updatedAt=_pNow();
  if(typeof snap==='function')snap();
  D.principles[idx]=cur;
  if(typeof save==='function')save();
  renderPrinciples();
  return true;
}
function pTogglePin(id){ _pWriteItem(id,function(p){p.pinned=!p.pinned;}); }
function pToggleReflect(id){ _pWriteItem(id,function(p){p.reflected=!p.reflected;}); }
function pSetStatus(id,status){
  if(_pStatusKeys.indexOf(status)<0)return;
  var cur=pById(id); if(cur&&cur.status===status&&('statement' in cur))return; // değişiklik yoksa 0 write (rich kayıt)
  _pWriteItem(id,function(p){ p.status=status; if(status==='internalized'&&!p.internalizedAt)p.internalizedAt=_pNow(); });
}

/* global maruz bırak */
window.P_STATUS=P_STATUS;window.P_TYPES=P_TYPES;window.P_LIFEAREAS=P_LIFEAREAS;
window.pStatusLabel=pStatusLabel;window.pTypeLabel=pTypeLabel;window.pAreaLabel=pAreaLabel;
window.normalizePrinciple=normalizePrinciple;window.normalizePrinciples=normalizePrinciples;window.newPrincipleId=newPrincipleId;
window.pList=pList;window.pById=pById;window.pViewList=pViewList;window.pCategories=pCategories;
window.pValidateStatement=pValidateStatement;window.pIsDuplicate=pIsDuplicate;window.pSort=pSort;window.pFilter=pFilter;
window.PRINCIPLE_DRAFT=PRINCIPLE_DRAFT;window.pCaptureDraft=pCaptureDraft;window.pDraftDirty=pDraftDirty;window.pClearDraft=pClearDraft;
window.pStats=pStats;window.pSetQuery=pSetQuery;window.pSetFilter=pSetFilter;window.pSetArea=pSetArea;window.pSetType=pSetType;
window.renderPrinciples=renderPrinciples;window.pCard=pCard;window.openPrincipleForm=openPrincipleForm;window.pFormCancel=pFormCancel;window.pFormSave=pFormSave;
window.pDelete=pDelete;window.pTogglePin=pTogglePin;window.pToggleReflect=pToggleReflect;window.pSetStatus=pSetStatus;
