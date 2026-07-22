/* ══════════════════════════════════════════════════════════════════════════
   D10.5.2 — İLKELERİM (Principles) ADAPTER + ORTAK GÖSTERİM PANELİ  ·  11e üzerine
   İlkelere özgü havuz/skor/kart/frekans/dayPart; orkestrasyon ortak çekirdekte.
   Gösterim takibi (showCount/lastShownAt) YEREL history bucket'ta (cloud item'da DEĞİL) → 0 cloud.
   ══════════════════════════════════════════════════════════════════════════ */

var PD_FREQ=[['pageopen','Her açılış',0],['1h','Her 1 saat',3600e3],['3h','Her 3 saat',3*3600e3],['6h','Her 6 saat',6*3600e3],['12h','Her 12 saat',12*3600e3],['daily','Günde 1',864e5],['every3days','3 günde 1',3*864e5],['weekly','Haftada 1',7*864e5],['monthly','Ayda 1',30*864e5],['manual','Sadece manuel',-1]];
var PD_DAYPARTS=[['any','Her Zaman'],['morning','Sabah'],['afternoon','Öğleden Sonra'],['evening','Akşam'],['night','Gece']];
function _pdFreqMs(mode){ var r=PD_FREQ.filter(function(x){return x[0]===mode;})[0]; return r?r[2]:864e5; }
function pdGet(){ if(!D.principleDisplaySettings||typeof D.principleDisplaySettings!=='object')D.principleDisplaySettings=Object.assign({},INIT.principleDisplaySettings); return D.principleDisplaySettings; }
window.pdGet=pdGet;

/* Havuz: normalize edilmiş ilkeler; status active/seasonal + lifeArea/type/status filtreleri + dayPart uygun + statement dolu. */
function pdPool(){
  var s=pdGet();
  var statuses=(Array.isArray(s.selectedStatuses)&&s.selectedStatuses.length)?s.selectedStatuses:['active','seasonal'];
  return (typeof pViewList==='function'?pViewList():[]).filter(function(p){
    if(!p.statement)return false;
    if(statuses.indexOf(p.status)<0)return false;               // varsayılan: yalnız active+seasonal (paused/internalized/archived hariç)
    if(Array.isArray(s.selectedLifeAreas)&&s.selectedLifeAreas.length&&s.selectedLifeAreas.indexOf(p.lifeArea)<0)return false;
    if(Array.isArray(s.selectedTypes)&&s.selectedTypes.length&&s.selectedTypes.indexOf(p.type)<0)return false;
    if(typeof cdDayPartOk==='function'&&!cdDayPartOk(p.dayPart))return false; // dayPart uyumu
    return true;
  });
}
/* Skor (küçük=önce): showCount(yerel history)→lastShownAt→priority→reflected. Rastgele yok. */
function pdScore(p){
  var s=pdGet(), h=(typeof cdHistoryFor==='function')?cdHistoryFor('principles',p.id):{showCount:0,lastShownAt:null};
  var sc=0;
  sc+=(h.showCount||0)*1e12;
  sc+=(h.lastShownAt?Date.parse(h.lastShownAt)||0:0);
  if(s.respectPriority!==false)sc-=(p.priority||0)*3600e3;
  if(p.reflected)sc-=900e3;
  return sc;
}
function pdById(id){ return (typeof pViewList==='function'?pViewList():[]).filter(function(p){return String(p.id)===String(id);})[0]||null; }
function pdMarkShown(p){ if(!p)return; if(typeof cdMarkHistory==='function')cdMarkHistory('principles',p.id); } // yalnız yerel history (0 cloud)
function pdFrequencyMs(p){ return _pdFreqMs((p&&p.frequency)||pdGet().defaultFrequency||'daily'); }
/* Kaynak etiketi: lifeArea/type'a göre türetilir. */
function pdLabel(p){
  if(!p)return 'Bugünkü İlkem';
  if(p.type==='mental_seed')return 'Zihinsel Tohum';
  if(p.type==='promise_to_self')return 'Kendime Söz';
  var byArea={spouse:'Eş İlkem',daughters:'Kızlarım İlkesi',family:'Aile İlkem',business:'İş İlkem',trade:'Ticaret İlkem',leadership:'Liderlik İlkem',health:'Sağlık İlkem',spirituality:'Maneviyat İlkem',society:'Toplum İlkem',character:'Karakter İlkem'};
  return byArea[p.lifeArea]||'Bugünkü İlkem';
}
function pdCanPin(p){ return !!(p&&(p.status==='active'||p.status==='seasonal')); } // paused/internalized/archived pinlenemez
/* Kart içeriği (İlke). */
function _pde(s){return U.esc(String(s||''));}
function pdCardInner(p){
  if(!p)return ''; var cds=(typeof cdGet==='function')?cdGet():{};
  var h='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
  h+='<span class="pill p-purple" style="font-size:9px">'+_pde(typeof pAreaLabel==='function'?pAreaLabel(p.lifeArea):p.lifeArea)+'</span>';
  h+='<span class="pill p-blue" style="font-size:9px">'+_pde(typeof pTypeLabel==='function'?pTypeLabel(p.type):p.type)+'</span>';
  if(p.status==='internalized')h+='<span class="pill p-green" style="font-size:9px">Yerleşti</span>';
  h+='</div>';
  if(p.title&&p.title!==p.statement)h+='<p style="font-size:11px;font-weight:800;color:var(--t2);margin-bottom:2px">'+_pde(p.title)+'</p>';
  h+='<p style="font-size:13.5px;line-height:1.65;color:var(--t);word-break:break-word">'+_pde(p.statement)+'</p>';
  if(p.source&&p.source!=='Kendi İlkem')h+='<p style="font-size:10px;color:var(--t3);margin-top:4px">'+_pde(p.source)+'</p>';
  var id=_pde(p.id);
  h+='<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:9px">';
  h+='<button class="btn btn-g btn-sm" title="Sabitle" data-id="'+id+'" onclick="cdPinToggle(\'principles\',this.dataset.id)">'+((cds.pinnedSource==='principles'&&cds.pinnedItemId===p.id)?'Sabit ✓':'Sabitle')+'</button>';
  h+='<button class="btn btn-g btn-sm" title="Beni düşündürdü" data-id="'+id+'" onclick="pToggleReflect(this.dataset.id);cdRefresh()">'+(p.reflected?'💡':'○')+'</button>';
  h+='<button class="btn btn-g btn-sm" title="Sonrakini getir" onclick="cdNext()">Sonraki ›</button>';
  h+='<button class="btn btn-g btn-sm" title="Kopyala" data-id="'+id+'" onclick="pdCopy(this.dataset.id)">Kopyala</button>';
  h+='<button class="btn btn-g btn-sm" title="Düzenle" data-id="'+id+'" onclick="openPrincipleForm(this.dataset.id)">Düzenle</button>';
  h+='</div>';
  return h;
}
function pdCopy(id){ var p=pdById(id); if(!p)return; var txt=p.statement+(p.source&&p.source!=='Kendi İlkem'?' — '+p.source:''); try{navigator.clipboard.writeText(txt);if(typeof cloudBadge==='function')cloudBadge('Kopyalandı','ok');}catch(e){} }
window.pdPool=pdPool;window.pdScore=pdScore;window.pdById=pdById;window.pdCardInner=pdCardInner;window.pdCopy=pdCopy;window.pdLabel=pdLabel;

/* Principle adapter'ı ortak çekirdeğe kaydet. */
if(typeof registerContentAdapter==='function'){
  registerContentAdapter({ source:'principles', pool:pdPool, score:pdScore, frequencyMs:pdFrequencyMs, markShown:pdMarkShown, byId:pdById, cardInner:pdCardInner, label:pdLabel, canPin:pdCanPin });
}

/* ── ORTAK gösterim paneli (contentDisplaySettings: enabled/kaynak/ağırlık/konum/animasyon/dayPart) ── */
function cdPanelHtml(){
  var s=(typeof cdGet==='function')?cdGet():{};
  var h='<div class="card" style="padding:12px 14px;margin-bottom:14px"><p style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:8px">'+ic('qt',12)+' Gösterim Motoru (Özlü Sözler + İlkelerim)</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t2)"><input type="checkbox" '+(s.enabled?'checked':'')+' onchange="cdSet(\'enabled\',this.checked)"> Sayfalarda göster</label>';
  h+='<span style="font-size:12px;color:var(--t2)">Kaynak: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="cdSet(\'sourceMode\',this.value)">'+[['mixed','Dönüşümlü'],['principles','Yalnız İlkelerim'],['wisdom','Yalnız Özlü Sözler'],['off','Kapalı']].map(function(x){return '<option value="'+x[0]+'"'+(s.sourceMode===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='<span style="font-size:12px;color:var(--t2)">Konum: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="cdSet(\'position\',this.value)">'+WD_POSITIONS.map(function(x){return '<option value="'+x[0]+'"'+(s.position===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='<span style="font-size:12px;color:var(--t2)">Geçiş: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="cdSet(\'animation\',this.value)">'+WD_ANIMATIONS.map(function(x){return '<option value="'+x[0]+'"'+(s.animation===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='</div>';
  if(s.sourceMode==='mixed'){
    h+='<div style="margin-top:8px;font-size:12px;color:var(--t2)">Dönüşümlü ağırlık: İlkelerim %<input class="inp" type="number" min="0" max="100" value="'+(s.principleWeight||70)+'" style="width:60px;display:inline-block;height:26px" onchange="cdSet(\'principleWeight\',Math.max(0,Math.min(100,+this.value||0)));cdSet(\'wisdomWeight\',100-Math.max(0,Math.min(100,+this.value||0)))"> · Özlü Söz %'+(100-(s.principleWeight||70))+'</div>';
  }
  h+='<div style="margin-top:8px"><label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t2)"><input type="checkbox" '+(s.dayPartAware?'checked':'')+' onchange="cdSet(\'dayPartAware\',this.checked)"> Sabah/öğlen/akşam farkındalığı</label></div>';
  // güncel kart önizleme
  if(s.enabled&&s.sourceMode!=='off'&&typeof cdCurrent==='function'){ var cur=cdCurrent(); if(cur)h+='<div style="margin-top:10px"><p style="font-size:10px;color:var(--t3);margin-bottom:4px">Şu an gösterilen</p><div class="card" style="padding:12px 14px">'+cdCardInner(cur)+'</div></div>'; }
  h+='</div>';
  return h;
}
window.cdPanelHtml=cdPanelHtml;

/* ── İlke gösterim filtre paneli (İlkelerim sayfasına) ── */
function principleDisplayPanelHtml(){
  var s=pdGet();
  var h='<div class="card" style="padding:12px 14px;margin-bottom:14px"><p style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:8px">'+ic('sh',12)+' İlke Gösterim Filtreleri</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">';
  h+='<span style="font-size:12px;color:var(--t2)">Varsayılan sıklık: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="pdSet(\'defaultFrequency\',this.value)">'+PD_FREQ.map(function(x){return '<option value="'+x[0]+'"'+(s.defaultFrequency===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='<span style="font-size:12px;color:var(--t2)">Varsayılan zaman: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="pdSet(\'defaultDayPart\',this.value)">'+PD_DAYPARTS.map(function(x){return '<option value="'+x[0]+'"'+(s.defaultDayPart===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='</div>';
  // durum filtresi
  h+='<p style="font-size:10px;color:var(--t3);margin:8px 0 3px">Gösterilecek durumlar</p><div style="display:flex;gap:4px;flex-wrap:wrap">';
  [['active','Aktif'],['seasonal','Mevsimsel'],['internalized','Karakterime Yerleşti']].forEach(function(st){var on=(s.selectedStatuses||[]).indexOf(st[0])>=0;h+='<button class="btn btn-sm" style="background:'+(on?'var(--blue)':'var(--s2)')+';color:'+(on?'#fff':'var(--t2)')+'" data-v="'+st[0]+'" onclick="pdToggleArr(\'selectedStatuses\',this.dataset.v)">'+st[1]+'</button>';});
  h+='</div>';
  // hayat alanı filtresi
  h+='<p style="font-size:10px;color:var(--t3);margin:8px 0 3px">Hayat alanı filtresi (boş=tümü)</p><div style="display:flex;gap:4px;flex-wrap:wrap">';
  P_LIFEAREAS.forEach(function(a){var on=(s.selectedLifeAreas||[]).indexOf(a[0])>=0;h+='<button class="btn btn-sm" style="background:'+(on?'var(--blue)':'var(--s2)')+';color:'+(on?'#fff':'var(--t2)')+'" data-v="'+a[0]+'" onclick="pdToggleArr(\'selectedLifeAreas\',this.dataset.v)">'+U.esc(a[1])+'</button>';});
  h+='</div></div>';
  return h;
}
window.principleDisplayPanelHtml=principleDisplayPanelHtml;
function pdSet(key,val){ if(typeof snap==='function')snap(); var s=pdGet(); s[key]=val; if(typeof save==='function')save(); if(typeof cdRotate==='function')cdRotate(); if(typeof cdRefresh==='function')cdRefresh(); if(typeof tab!=='undefined'&&tab==='principles'&&typeof renderPrinciples==='function')renderPrinciples(); }
function pdToggleArr(key,val){ if(typeof snap==='function')snap(); var s=pdGet(); if(!Array.isArray(s[key]))s[key]=[]; var i=s[key].indexOf(val); if(i>=0)s[key].splice(i,1);else s[key].push(val); if(typeof save==='function')save(); if(typeof cdRotate==='function')cdRotate(); if(typeof cdRefresh==='function')cdRefresh(); if(typeof tab!=='undefined'&&tab==='principles'&&typeof renderPrinciples==='function')renderPrinciples(); }
window.pdSet=pdSet;window.pdToggleArr=pdToggleArr;
