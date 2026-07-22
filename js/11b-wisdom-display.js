/* ══════════════════════════════════════════════════════════════════════════
   D10.2/D10.5.2 — WISDOM (Özlü Sözler) ADAPTER  ·  ortak çekirdek (11e) üzerine
   Wisdom'a özgü havuz/skor/kart/frekans/ayar; orkestrasyon (timer/visibility/kart/
   rotasyon) 11e-content-display-core'da. D10.2 SEÇİM davranışı BİREBİR korunur.
   wisdomSettings = Wisdom'a özel filtre/görünüm (rotationMode/favoritesOnly/
   selectedCategories/selectedLanguages/showAuthor/showCategory/showProgress/
   respectPriority/avoidRecentlyShown). Ortak kart/kaynak/pin = contentDisplaySettings.
   Gösterim takibi (showCount/lastShownAt) YINE item üzerinde + writeLocal (0 cloud, D10.2).
   ══════════════════════════════════════════════════════════════════════════ */
var WD_ROTATIONS=[
  ['pageopen','Her açılış',0],['1h','Her 1 saat',3600e3],['3h','Her 3 saat',3*3600e3],
  ['6h','Her 6 saat',6*3600e3],['12h','Her 12 saat',12*3600e3],['1d','Günde 1',864e5],
  ['3d','3 günde 1',3*864e5],['7d','Haftada 1',7*864e5],['30d','Ayda 1',30*864e5],['manual','Sadece manuel',-1]
];
var WD_POSITIONS=[['hero','Panoda (hero)'],['top','Üst ince kart'],['bottomright','Sağ alt'],['bottomleft','Sol alt'],['modal','Popup modal'],['off','Kapalı']];
var WD_ANIMATIONS=[['fade','Fade'],['slide','Slide'],['crossfade','Crossfade'],['none','Yok']];
var WD_LANGS=[['tr','Türkçe'],['en','English'],['fr','Français'],['ar','العربية'],['ku','Kurdî']];
var WD_CONTEXT={smart:['Disiplin','Karakter','Sabır'],goals:['Başarı','Hedef','Motivasyon','Disiplin'],
  onething:['Disiplin','Odak'],habits:['Disiplin'],deepwork:['Çalışmak','Odak'],restore:['Sabır','Karakter'],
  generalnotes:['Karakter'],mybooks:['Gelişim'],kpi:['Başarı'],weeklyreview:['Karakter']};

function wsGet(){ if(!D.wisdomSettings||typeof D.wisdomSettings!=='object')D.wisdomSettings=Object.assign({},INIT.wisdomSettings); return D.wisdomSettings; }
window.wsGet=wsGet;

function wdActiveList(){ return (Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]).filter(function(q){return q&&q.active;}); }
function wdById(id){ return (Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]).filter(function(q){return String(q.id)===String(id);})[0]||null; }
/* ── Havuz ── (favori/kategori/dil filtreleri) — D10.2 birebir */
function wdPool(){
  var s=wsGet();
  return wdActiveList().filter(function(q){
    if(s.favoritesOnly&&!q.favorite)return false;
    if(Array.isArray(s.selectedCategories)&&s.selectedCategories.length&&s.selectedCategories.indexOf(q.category)<0)return false;
    if(Array.isArray(s.selectedLanguages)&&s.selectedLanguages.length&&s.selectedLanguages.indexOf(q.language||'tr')<0)return false;
    return true;
  });
}
function _wdContextCats(){ var s=wsGet(); if(!s.contextAware)return null; return (typeof tab!=='undefined'&&WD_CONTEXT[tab])||null; }
/* ── Akıllı skor (küçük=önce) — D10.2 birebir: showCount→lastShownAt→priority→favorite→reflected→context */
function wdScore(q){
  var s=wsGet(), sc=0;
  sc+= (q.showCount||0)*1e12;
  sc+= (q.lastShownAt?Date.parse(q.lastShownAt)||0:0);
  if(s.respectPriority!==false)sc-=(q.priority||0)*3600e3;
  if(q.favorite)sc-=1800e3;
  if(q.reflected)sc-=900e3;
  var ctx=_wdContextCats();
  if(ctx&&ctx.indexOf(q.category)>=0)sc-=5*3600e3;
  return sc;
}
function _wdMs(mode){ var r=WD_ROTATIONS.filter(function(x){return x[0]===mode;})[0]; return r?r[2]:0; }
/* Gösterim takibi: showCount/lastShownAt YINE item + writeLocal (0 cloud, D10.2). */
function wdMarkShown(q){ if(!q)return; q.showCount=(q.showCount||0)+1; q.lastShownAt=new Date().toISOString(); if(typeof writeLocal==='function')writeLocal(Date.now()); }

/* ── Kart HTML (Wisdom) ── */
function _we(s){return U.esc(String(s||''));}
function wdCardInner(q){
  var s=wsGet(); if(!q)return '';
  var h='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
  if(s.showCategory&&q.category)h+='<span class="pill p-blue" style="font-size:9px">'+_we(q.category)+'</span>';
  if(q.favorite)h+='<span class="pill p-orange" style="font-size:9px">★</span>';
  if(q.pinned)h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">Sabit</span>';
  h+='</div>';
  h+='<p style="font-size:13.5px;font-style:italic;line-height:1.65;color:var(--t);word-break:break-word">&ldquo;'+_we(q.quote)+'&rdquo;</p>';
  if(s.showAuthor&&q.author)h+='<p style="font-size:11px;font-weight:700;color:var(--blue);margin-top:5px">&mdash; '+_we(q.author)+'</p>';
  if(s.showProgress)h+='<p style="font-size:9.5px;color:var(--t3);margin-top:3px">Gösterim: '+(q.showCount||0)+'</p>';
  var id=_we(q.id), cds=(typeof cdGet==='function')?cdGet():{};
  h+='<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:9px">';
  h+='<button class="btn btn-g btn-sm" title="Favori" data-id="'+id+'" onclick="wqToggleFav(this.dataset.id);cdRefresh()">'+(q.favorite?'★':'☆')+'</button>';
  h+='<button class="btn btn-g btn-sm" title="Sabitle" data-id="'+id+'" onclick="cdPinToggle(\'wisdom\',this.dataset.id)">'+((cds.pinnedSource==='wisdom'&&cds.pinnedItemId===q.id)?'Sabit ✓':'Sabitle')+'</button>';
  h+='<button class="btn btn-g btn-sm" title="Beni düşündürdü" data-id="'+id+'" onclick="wqToggleReflect(this.dataset.id);cdRefresh()">'+(q.reflected?'💡':'○')+'</button>';
  h+='<button class="btn btn-g btn-sm" title="Sonrakini getir" onclick="cdNext()">Sonraki ›</button>';
  h+='<button class="btn btn-g btn-sm" title="Kopyala" data-id="'+id+'" onclick="wdCopy(this.dataset.id)">Kopyala</button>';
  h+='<button class="btn btn-g btn-sm" title="Paylaş" data-id="'+id+'" onclick="wdShare(this.dataset.id)">Paylaş</button>';
  h+='<button class="btn btn-g btn-sm" title="Düzenle" data-id="'+id+'" onclick="openWqForm(this.dataset.id)">Düzenle</button>';
  h+='</div>';
  return h;
}

/* ── Wisdom adapter'ı ortak çekirdeğe kaydet ── */
if(typeof registerContentAdapter==='function'){
  registerContentAdapter({
    source:'wisdom',
    pool:wdPool,
    score:wdScore,
    frequencyMs:function(){ return _wdMs(wsGet().rotationMode); }, // Wisdom: global rotationMode (D10.2)
    markShown:wdMarkShown,
    byId:wdById,
    cardInner:wdCardInner,
    label:function(){ return 'Günün Bilgeliği'; },
    canPin:function(q){ return !!(q&&q.active); }
  });
}

/* ── D10.2 geriye-uyum köprüleri (baseline oracle + kart butonları + hook'lar) ── */
function wdPick(){ var r=(typeof cdPickIn==='function')?cdPickIn('wisdom'):null; return r; }
function wdShouldRotate(){ return (typeof cdShouldRotate==='function')?cdShouldRotate():false; }
function wdRotate(){ var r=(typeof cdRotate==='function')?cdRotate():null; return r?r.item:null; }
function wdCurrent(){ var r=(typeof cdCurrent==='function')?cdCurrent():null; return r?r.item:null; }
function wisdomHeroHtml(){ return (typeof cdHeroHtml==='function')?cdHeroHtml():''; }
function renderWisdomFloat(force){ if(typeof cdRenderFloat==='function')cdRenderFloat(force); }
function wdRefresh(){ if(typeof cdRefresh==='function')cdRefresh(); }
function wdTick(fromBoot){ if(typeof cdTick==='function')cdTick(fromBoot); }
function wdBoot(){ if(typeof cdBoot==='function')cdBoot(); }
function wdDismissFloat(){ if(typeof cdDismissFloat==='function')cdDismissFloat(); }
function wdNext(){ if(typeof cdNext==='function')cdNext(); }
function wdPinToggle(id){ if(typeof cdPinToggle==='function')cdPinToggle('wisdom',id); }
window.wdPick=wdPick;window.wdShouldRotate=wdShouldRotate;window.wdRotate=wdRotate;window.wdCurrent=wdCurrent;
window.wisdomHeroHtml=wisdomHeroHtml;window.renderWisdomFloat=renderWisdomFloat;window.wdRefresh=wdRefresh;
window.wdTick=wdTick;window.wdBoot=wdBoot;window.wdDismissFloat=wdDismissFloat;window.wdNext=wdNext;window.wdPinToggle=wdPinToggle;
window.wdActiveList=wdActiveList;window.wdById=wdById;window.wdPool=wdPool;window.wdScore=wdScore;window.wdMarkShown=wdMarkShown;window.wdCardInner=wdCardInner;

function wdCopy(id){ var q=wdById(id); if(!q)return; var txt='“'+q.quote+'”'+(q.author?' — '+q.author:''); try{navigator.clipboard.writeText(txt);if(typeof cloudBadge==='function')cloudBadge('Kopyalandı','ok');}catch(e){} }
function wdShare(id){ var q=wdById(id); if(!q)return; var txt='“'+q.quote+'”'+(q.author?' — '+q.author:''); if(navigator.share){navigator.share({text:txt}).catch(function(){});}else{wdCopy(id);} }
window.wdCopy=wdCopy;window.wdShare=wdShare;

/* ── Wisdom ayar paneli (Özlü Sözler sayfasına enjekte) — rotationMode/filtreler wisdomSettings; enabled/pozisyon/animasyon ORTAK ── */
function _wdCats(){ var s={}; (D.wisdomQuotes||[]).forEach(function(q){if(q.category)s[q.category]=1;}); return Object.keys(s).sort(function(a,b){return a.localeCompare(b,'tr');}); }
function wisdomDisplayPanelHtml(){
  var s=wsGet(), cds=(typeof cdGet==='function')?cdGet():{};
  var h='<div class="card" style="padding:12px 14px;margin-bottom:14px"><p style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:8px">'+ic('qt',12)+' Özlü Söz Gösterim Ayarları</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">';
  h+='<span style="font-size:12px;color:var(--t2)">Sıklık: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="wdSet(\'rotationMode\',this.value)">'+WD_ROTATIONS.map(function(x){return '<option value="'+x[0]+'"'+(s.rotationMode===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='<span style="font-size:11px;color:var(--t3)">(Kart konumu/kaynağı ortak "Gösterim Motoru" panelinden)</span>';
  h+='</div><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:8px">';
  [['favoritesOnly','Sadece favoriler'],['contextAware','Bağlamsal (sayfaya göre)'],['respectPriority','Önceliğe uy'],['avoidRecentlyShown','Yakın tekrarı önle'],['showAuthor','Yazar göster'],['showCategory','Kategori göster'],['showProgress','Gösterim sayısı']].forEach(function(x){
    h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t2)"><input type="checkbox" '+(s[x[0]]?'checked':'')+' onchange="wdSet(\''+x[0]+'\',this.checked)"> '+x[1]+'</label>';});
  h+='</div>';
  var cats=_wdCats();
  if(cats.length){ h+='<p style="font-size:10px;color:var(--t3);margin:8px 0 3px">Kategori filtresi (boş=tümü)</p><div style="display:flex;gap:4px;flex-wrap:wrap">';
    cats.forEach(function(c){var on=(s.selectedCategories||[]).indexOf(c)>=0; h+='<button class="btn btn-sm" style="background:'+(on?'var(--blue)':'var(--s2)')+';color:'+(on?'#fff':'var(--t2)')+'" data-c="'+_we(c)+'" onclick="wdToggleCat(this.dataset.c)">'+_we(c)+'</button>';});
    h+='</div>'; }
  h+='<p style="font-size:10px;color:var(--t3);margin:8px 0 3px">Dil filtresi (boş=tümü)</p><div style="display:flex;gap:4px;flex-wrap:wrap">';
  WD_LANGS.forEach(function(l){var on=(s.selectedLanguages||[]).indexOf(l[0])>=0; h+='<button class="btn btn-sm" style="background:'+(on?'var(--blue)':'var(--s2)')+';color:'+(on?'#fff':'var(--t2)')+'" data-l="'+l[0]+'" onclick="wdToggleLang(this.dataset.l)">'+_we(l[1])+'</button>';});
  h+='</div>';
  var st=wdStats();
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">';
  [['Toplam gösterim',st.totalShows],['Hiç gösterilmeyen',st.never],['En çok',st.mostCount],['Favori oranı',st.favPct+'%'],['Düşündüren oranı',st.reflPct+'%']].forEach(function(x){
    h+='<div class="card" style="padding:6px 10px;flex:1;min-width:80px"><p style="font-size:9px;color:var(--t3)">'+x[0]+'</p><p style="font-size:15px;font-weight:800">'+x[1]+'</p></div>';});
  h+='</div></div>';
  return h;
}
window.wisdomDisplayPanelHtml=wisdomDisplayPanelHtml;
function wdStats(){
  var l=(D.wisdomQuotes||[]),ts=0,never=0,mostC=0,fav=0,refl=0;
  l.forEach(function(q){ ts+=(q.showCount||0); if((q.showCount||0)===0)never++; if((q.showCount||0)>mostC)mostC=q.showCount||0; if(q.favorite)fav++; if(q.reflected)refl++; });
  return {totalShows:ts,never:never,mostCount:mostC,favPct:l.length?Math.round(fav/l.length*100):0,reflPct:l.length?Math.round(refl/l.length*100):0};
}
window.wdStats=wdStats;

/* Wisdom-özel ayar setter'ları (wisdomSettings → save + kart tazele). */
function wdSet(key,val){ if(typeof snap==='function')snap(); var s=wsGet(); s[key]=val; if(typeof save==='function')save();
  if(typeof tab!=='undefined'){ if(tab==='wisdom')renderWisdomQuotes(); if(tab==='dashboard')renderPage(); } if(typeof cdRefresh==='function')cdRefresh(); }
function wdToggleCat(c){ if(typeof snap==='function')snap(); var s=wsGet(); if(!Array.isArray(s.selectedCategories))s.selectedCategories=[]; var i=s.selectedCategories.indexOf(c); if(i>=0)s.selectedCategories.splice(i,1);else s.selectedCategories.push(c); if(typeof save==='function')save(); if(typeof cdRotate==='function')cdRotate(); if(typeof cdRefresh==='function')cdRefresh(); }
function wdToggleLang(l){ if(typeof snap==='function')snap(); var s=wsGet(); if(!Array.isArray(s.selectedLanguages))s.selectedLanguages=[]; var i=s.selectedLanguages.indexOf(l); if(i>=0)s.selectedLanguages.splice(i,1);else s.selectedLanguages.push(l); if(typeof save==='function')save(); if(typeof cdRotate==='function')cdRotate(); if(typeof cdRefresh==='function')cdRefresh(); }
window.wdSet=wdSet;window.wdToggleCat=wdToggleCat;window.wdToggleLang=wdToggleLang;
