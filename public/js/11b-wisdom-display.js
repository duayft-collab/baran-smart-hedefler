/* ══════════════════════════════════════════════════════════════════════════
   D10.2 — BİLGELİK GÖSTERİM ve ROTASYON MOTORU  ·  D10.1 kütüphanesi üzerine
   Additive. D6/D9/SMART/Coach/Quality/XP/Progress/Genel Notlar/D.quotes/
   RESTORE_API DEĞİŞMEZ. D10.1 veri modeli (wisdomQuotes) kullanılır; yeni kayıt
   modeli oluşturulmaz. wisdomSettings = kullanıcı tercihleri (cloud, save()).
   Pasif gösterim takibi (showCount++/lastShownAt) + currentId/lastRotation
   YALNIZ localStorage'a yazılır (writeLocal / ayrı anahtar) -> rotasyon 0
   cloud-write; sync churn/açılış-yazımı/sahte conflict YOK. Sayaçlar sonraki
   gerçek save()'te cloud'a piggyback gider.
   ══════════════════════════════════════════════════════════════════════════ */
var WD_ROTATIONS=[
  ['pageopen','Her açılış',0],['1h','Her 1 saat',3600e3],['3h','Her 3 saat',3*3600e3],
  ['6h','Her 6 saat',6*3600e3],['12h','Her 12 saat',12*3600e3],['1d','Günde 1',864e5],
  ['3d','3 günde 1',3*864e5],['7d','Haftada 1',7*864e5],['30d','Ayda 1',30*864e5],['manual','Sadece manuel',-1]
];
var WD_POSITIONS=[['hero','Panoda (hero)'],['top','Üst ince kart'],['bottomright','Sağ alt'],['bottomleft','Sol alt'],['modal','Popup modal'],['off','Kapalı']];
var WD_ANIMATIONS=[['fade','Fade'],['slide','Slide'],['crossfade','Crossfade'],['none','Yok']];
var WD_LANGS=[['tr','Türkçe'],['en','English'],['fr','Français'],['ar','العربية'],['ku','Kurdî']];
/* Bağlamsal ağırlık haritası (AI değil): modül -> kategori. */
var WD_CONTEXT={smart:['Disiplin','Karakter','Sabır'],goals:['Başarı','Hedef','Motivasyon','Disiplin'],
  onething:['Disiplin','Odak'],habits:['Disiplin'],deepwork:['Çalışmak','Odak'],restore:['Sabır','Karakter'],
  generalnotes:['Karakter'],mybooks:['Gelişim'],kpi:['Başarı'],weeklyreview:['Karakter']};

var _wdBooted=false, _wdTimer=null, _wdVisBound=false, _wdModalOpen=false, _wdLastRenderedId=null, _wdFloatDismissed=false;

function wsGet(){ if(!D.wisdomSettings||typeof D.wisdomSettings!=='object')D.wisdomSettings=Object.assign({},INIT.wisdomSettings); return D.wisdomSettings; }
/* Yerel gösterim durumu (CLOUD DIŞI): {currentId,lastRotation}. */
function wdTrack(){ try{var t=JSON.parse(localStorage.getItem('fu7_wisdom_disp')||'{}'); return (t&&typeof t==='object')?t:{};}catch(e){return {};} }
function wdTrackSave(t){ try{localStorage.setItem('fu7_wisdom_disp',JSON.stringify(t));}catch(e){} }
function _wdLocalPersist(){ if(typeof writeLocal==='function')writeLocal(Date.now()); } // showCount/lastShownAt yerel; cloud yazımı yok

function wdActiveList(){ return (Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]).filter(function(q){return q&&q.active;}); }
function wdById(id){ return (Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]).filter(function(q){return String(q.id)===String(id);})[0]||null; }

/* ── Havuz ── (favori/kategori/dil filtreleri) */
function wdPool(){
  var s=wsGet();
  return wdActiveList().filter(function(q){
    if(s.favoritesOnly&&!q.favorite)return false;
    if(Array.isArray(s.selectedCategories)&&s.selectedCategories.length&&s.selectedCategories.indexOf(q.category)<0)return false;
    if(Array.isArray(s.selectedLanguages)&&s.selectedLanguages.length&&s.selectedLanguages.indexOf(q.language||'tr')<0)return false;
    return true;
  });
}
/* ── Akıllı skor ── (küçük = önce). Hiç gösterilmeyen -> en eski -> priority ->
   favorite -> reflected -> normal. Bağlamsal ağırlık isteğe bağlı. */
function _wdContextCats(){ var s=wsGet(); if(!s.contextAware)return null; return (typeof tab!=='undefined'&&WD_CONTEXT[tab])||null; }
function wdScore(q){
  var s=wsGet(), sc=0;
  sc+= (q.showCount||0)*1e12;                         // 1. hiç gösterilmeyen önce
  sc+= (q.lastShownAt?Date.parse(q.lastShownAt)||0:0);// 2. en uzun süredir gösterilmeyen
  if(s.respectPriority!==false)sc-=(q.priority||0)*3600e3; // 3. priority
  if(q.favorite)sc-=1800e3;                           // 4. favorite
  if(q.reflected)sc-=900e3;                           // 5. reflected
  var ctx=_wdContextCats();
  if(ctx&&ctx.indexOf(q.category)>=0)sc-=5*3600e3;    // bağlamsal ağırlık
  return sc;
}
function wdPick(){
  var s=wsGet();
  if(s.pinMode==='pin'&&s.pinnedQuoteId){ var pq=wdById(s.pinnedQuoteId); if(pq&&pq.active)return pq; }
  var pool=wdPool(); if(!pool.length)pool=wdActiveList(); if(!pool.length)return null;
  var sorted=pool.slice().sort(function(a,b){ var d=wdScore(a)-wdScore(b); return d!==0?d:String(a.id).localeCompare(String(b.id)); });
  var cur=wdTrack().currentId;
  if(s.avoidRecentlyShown!==false&&sorted.length>1&&cur&&String(sorted[0].id)===String(cur))return sorted[1];
  return sorted[0];
}
function _wdMs(mode){ var r=WD_ROTATIONS.filter(function(x){return x[0]===mode;})[0]; return r?r[2]:0; }
function wdShouldRotate(){
  var s=wsGet(); if(s.rotationMode==='manual'||s.rotationMode==='pageopen')return false;
  var t=wdTrack(); return (Date.now()-(t.lastRotation||0))>=_wdMs(s.rotationMode);
}
function wdMarkShown(q){ if(!q)return; q.showCount=(q.showCount||0)+1; q.lastShownAt=new Date().toISOString(); _wdLocalPersist(); }
/* Rotasyon: yeni söz seç; currentId/lastRotation + gösterimi YEREL yaz (cloud yok). */
function wdRotate(){
  var s=wsGet();
  if(s.pinMode==='pin'&&s.pinnedQuoteId){ var pq=wdById(s.pinnedQuoteId); if(pq&&pq.active){var t0=wdTrack();t0.currentId=pq.id;t0.lastRotation=Date.now();wdTrackSave(t0);return pq;} }
  var q=wdPick(); if(!q)return null;
  wdMarkShown(q); var t=wdTrack(); t.currentId=q.id; t.lastRotation=Date.now(); wdTrackSave(t);
  return q;
}
function wdCurrent(){
  var s=wsGet();
  if(s.pinMode==='pin'&&s.pinnedQuoteId){ var pq=wdById(s.pinnedQuoteId); if(pq&&pq.active)return pq; }
  var cur=wdTrack().currentId; var q=cur?wdById(cur):null;
  if(!q||!q.active)q=wdRotate();
  return q;
}

/* ── Kart HTML ── */
function _we(s){return U.esc(String(s||''));}
function wdCardInner(q){
  var s=wsGet(); if(!q)return '';
  var h='';
  /* D10.2 UI/UX: kartın ne olduğunu belirten ince başlık (kullanıcı bağlamı anlar). */
  h+='<p style="font-size:8.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);opacity:.75;margin-bottom:5px">'+ic('qt',9,'var(--t3)')+' Günün Bilgeliği</p>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
  if(s.showCategory&&q.category)h+='<span class="pill p-blue" style="font-size:9px">'+_we(q.category)+'</span>';
  if(q.favorite)h+='<span class="pill p-orange" style="font-size:9px">★</span>';
  if(q.pinned)h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">Sabit</span>';
  h+='</div>';
  h+='<p style="font-size:13.5px;font-style:italic;line-height:1.65;color:var(--t);word-break:break-word">&ldquo;'+_we(q.quote)+'&rdquo;</p>';
  if(s.showAuthor&&q.author)h+='<p style="font-size:11px;font-weight:700;color:var(--blue);margin-top:5px">&mdash; '+_we(q.author)+'</p>';
  if(s.showProgress)h+='<p style="font-size:9.5px;color:var(--t3);margin-top:3px">Gösterim: '+(q.showCount||0)+'</p>';
  var id=_we(q.id);
  h+='<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:9px">';
  h+='<button class="btn btn-g btn-sm" title="Favori" data-id="'+id+'" onclick="wqToggleFav(this.dataset.id);wdRefresh()">'+(q.favorite?'★':'☆')+'</button>';
  h+='<button class="btn btn-g btn-sm" title="Sabitle" data-id="'+id+'" onclick="wdPinToggle(this.dataset.id)">'+(wsGet().pinnedQuoteId===q.id?'Sabit ✓':'Sabitle')+'</button>';
  h+='<button class="btn btn-g btn-sm" title="Beni düşündürdü" data-id="'+id+'" onclick="wqToggleReflect(this.dataset.id);wdRefresh()">'+(q.reflected?'💡':'○')+'</button>';
  h+='<button class="btn btn-g btn-sm" title="Sonrakini getir" onclick="wdNext()">Sonraki ›</button>';
  h+='<button class="btn btn-g btn-sm" title="Kopyala" data-id="'+id+'" onclick="wdCopy(this.dataset.id)">Kopyala</button>';
  h+='<button class="btn btn-g btn-sm" title="Paylaş" data-id="'+id+'" onclick="wdShare(this.dataset.id)">Paylaş</button>';
  h+='<button class="btn btn-g btn-sm" title="Düzenle" data-id="'+id+'" onclick="openWqForm(this.dataset.id)">Düzenle</button>';
  h+='</div>';
  return h;
}
/* Dashboard hero (renderDashboard çağırır). */
function wisdomHeroHtml(){
  var s=wsGet(); if(!s.enabled||s.position!=='hero')return '';
  var q=wdCurrent(); if(!q)return '';
  return '<div class="card wd-anim" style="padding:16px 18px;margin-bottom:16px">'+wdCardInner(q)+'</div>';
}
window.wisdomHeroHtml=wisdomHeroHtml;
/* Yüzen/modal kart. Yumuşak geçiş: aynı söz ise yeniden kurma (nav'da kaybolmaz). */
function renderWisdomFloat(force){
  var s=wsGet(), box=ge('wisdom-float'); if(!box)return;
  if(!s.enabled||s.position==='hero'||s.position==='off'||_wdFloatDismissed){ box.innerHTML=''; _wdLastRenderedId=null; return; }
  var q=wdCurrent(); if(!q){ box.innerHTML=''; _wdLastRenderedId=null; return; }
  if(!force&&_wdLastRenderedId===q.id&&box.innerHTML)return;    // aynı söz + zaten render -> dokunma (nav'da flof yok)
  var pos=s.position, wrap='position:fixed;z-index:90;';
  if(pos==='modal')wrap+='inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4);padding:20px;';
  else{ wrap+='max-width:340px;width:calc(100% - 32px);';
    if(pos==='top')wrap+='top:56px;left:50%;transform:translateX(-50%);';
    else if(pos==='bottomleft')wrap+='left:16px;bottom:16px;';
    else wrap+='right:16px;bottom:16px;'; }
  var anim=s.animation==='none'?'':' wd-anim-'+s.animation;
  var h='<div style="'+wrap+'"><div class="card wd-anim'+anim+'" style="padding:13px 15px;box-shadow:0 8px 30px rgba(0,0,0,.18);position:relative;max-width:360px">';
  h+='<button class="btn btn-g btn-ic" style="position:absolute;top:6px;right:6px;width:22px;height:22px" title="Kapat" onclick="wdDismissFloat()">'+ic('x',11)+'</button>';
  h+='<div style="padding-right:16px">'+wdCardInner(q)+'</div></div></div>';
  box.innerHTML=h; _wdLastRenderedId=q.id;
}
window.renderWisdomFloat=renderWisdomFloat;
function wdDismissFloat(){ _wdFloatDismissed=true; var b=ge('wisdom-float'); if(b)b.innerHTML=''; }
window.wdDismissFloat=wdDismissFloat;
/* Aktif kartı tazele (favori/reflected sonrası ikon güncelle). */
function wdRefresh(){ _wdLastRenderedId=null; renderWisdomFloat(true); if(tab==='dashboard'&&wsGet().position==='hero')renderPage(); if(tab==='wisdom')renderWisdomQuotes(); }
window.wdRefresh=wdRefresh;

/* ── Hızlı işlemler ── */
function wdNext(){ var t=wdTrack(); t.currentId=null; wdTrackSave(t); var s=wsGet(); if(s.pinMode==='pin'){s.pinMode='rotate';s.pinnedQuoteId=null;if(typeof save==='function')save();} wdRotate(); wdRefresh(); }
function wdPinToggle(id){ var s=wsGet(); if(typeof snap==='function')snap(); if(s.pinnedQuoteId===id&&s.pinMode==='pin'){s.pinMode='rotate';s.pinnedQuoteId=null;}else{s.pinMode='pin';s.pinnedQuoteId=id;var t=wdTrack();t.currentId=id;wdTrackSave(t);} if(typeof save==='function')save(); wdRefresh(); }
function wdCopy(id){ var q=wdById(id); if(!q)return; var txt='“'+q.quote+'”'+(q.author?' — '+q.author:''); try{navigator.clipboard.writeText(txt);if(typeof cloudBadge==='function')cloudBadge('Kopyalandı','ok');}catch(e){} }
function wdShare(id){ var q=wdById(id); if(!q)return; var txt='“'+q.quote+'”'+(q.author?' — '+q.author:''); if(navigator.share){navigator.share({text:txt}).catch(function(){});}else{wdCopy(id);} }
window.wdNext=wdNext;window.wdPinToggle=wdPinToggle;window.wdCopy=wdCopy;window.wdShare=wdShare;

/* ── Tik + timer + Visibility ── */
function wdTick(fromBoot){
  var s=wsGet();
  if(!s.enabled){ var b=ge('wisdom-float'); if(b)b.innerHTML=''; wdStopTimer(); return; }
  if(fromBoot&&!_wdBooted){ _wdBooted=true; if(s.rotationMode==='pageopen'||wdShouldRotate()||!wdTrack().currentId){wdRotate();_wdLastRenderedId=null;} wdStartTimer(); }
  else if(wdShouldRotate()){ wdRotate(); _wdLastRenderedId=null; }
  renderWisdomFloat();
}
window.wdTick=wdTick;
function wdStartTimer(){ wdStopTimer(); if(typeof document!=='undefined'&&document.hidden)return; _wdTimer=setInterval(function(){ if(document.hidden)return; if(wdShouldRotate()){wdRotate();_wdLastRenderedId=null;renderWisdomFloat(true);} },60000); }
function wdStopTimer(){ if(_wdTimer){clearInterval(_wdTimer);_wdTimer=null;} }
function wdBoot(){
  if(!_wdVisBound&&typeof document!=='undefined'){ _wdVisBound=true;
    document.addEventListener('visibilitychange',function(){ if(document.hidden)wdStopTimer(); else{ if(wsGet().enabled){wdStartTimer(); if(wdShouldRotate()){wdRotate();_wdLastRenderedId=null;} renderWisdomFloat();} } });
  }
  wdTick(true);
}
window.wdBoot=wdBoot;

/* ── Ayar paneli (Özlü Sözler sayfasına enjekte) ── */
function _wdCats(){ var s={}; (D.wisdomQuotes||[]).forEach(function(q){if(q.category)s[q.category]=1;}); return Object.keys(s).sort(function(a,b){return a.localeCompare(b,'tr');}); }
function wisdomDisplayPanelHtml(){
  var s=wsGet();
  var h='<div class="card" style="padding:12px 14px;margin-bottom:14px"><p style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:8px">'+ic('qt',12)+' Bilgelik Gösterim Motoru</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t2)"><input type="checkbox" '+(s.enabled?'checked':'')+' onchange="wdSet(\'enabled\',this.checked)"> Sayfalarda göster</label>';
  h+='<span style="font-size:12px;color:var(--t2)">Sıklık: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="wdSet(\'rotationMode\',this.value)">'+WD_ROTATIONS.map(function(x){return '<option value="'+x[0]+'"'+(s.rotationMode===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='<span style="font-size:12px;color:var(--t2)">Konum: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="wdSet(\'position\',this.value)">'+WD_POSITIONS.map(function(x){return '<option value="'+x[0]+'"'+(s.position===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='<span style="font-size:12px;color:var(--t2)">Geçiş: <select class="inp" style="width:auto;display:inline-block;height:28px;font-size:12px" onchange="wdSet(\'animation\',this.value)">'+WD_ANIMATIONS.map(function(x){return '<option value="'+x[0]+'"'+(s.animation===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></span>';
  h+='</div><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:8px">';
  [['favoritesOnly','Sadece favoriler'],['contextAware','Bağlamsal (sayfaya göre)'],['respectPriority','Önceliğe uy'],['avoidRecentlyShown','Yakın tekrarı önle'],['showAuthor','Yazar göster'],['showCategory','Kategori göster'],['showProgress','Gösterim sayısı']].forEach(function(x){
    h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t2)"><input type="checkbox" '+(s[x[0]]?'checked':'')+' onchange="wdSet(\''+x[0]+'\',this.checked)"> '+x[1]+'</label>';});
  h+='</div>';
  // kategori seçimi
  var cats=_wdCats();
  if(cats.length){ h+='<p style="font-size:10px;color:var(--t3);margin:8px 0 3px">Kategori filtresi (boş=tümü)</p><div style="display:flex;gap:4px;flex-wrap:wrap">';
    cats.forEach(function(c){var on=(s.selectedCategories||[]).indexOf(c)>=0; h+='<button class="btn btn-sm" style="background:'+(on?'var(--blue)':'var(--s2)')+';color:'+(on?'#fff':'var(--t2)')+'" data-c="'+_we(c)+'" onclick="wdToggleCat(this.dataset.c)">'+_we(c)+'</button>';});
    h+='</div>'; }
  // dil seçimi
  h+='<p style="font-size:10px;color:var(--t3);margin:8px 0 3px">Dil filtresi (boş=tümü)</p><div style="display:flex;gap:4px;flex-wrap:wrap">';
  WD_LANGS.forEach(function(l){var on=(s.selectedLanguages||[]).indexOf(l[0])>=0; h+='<button class="btn btn-sm" style="background:'+(on?'var(--blue)':'var(--s2)')+';color:'+(on?'#fff':'var(--t2)')+'" data-l="'+l[0]+'" onclick="wdToggleLang(this.dataset.l)">'+_we(l[1])+'</button>';});
  h+='</div>';
  // güncel söz önizleme
  if(s.enabled){ var cur=wdCurrent(); if(cur)h+='<div style="margin-top:10px"><p style="font-size:10px;color:var(--t3);margin-bottom:4px">Şu an gösterilen</p><div class="card" style="padding:12px 14px">'+wdCardInner(cur)+'</div></div>'; }
  // gösterim istatistiği
  var st=wdStats();
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">';
  [['Toplam gösterim',st.totalShows],['Hiç gösterilmeyen',st.never],['En çok',st.mostCount],['Favori oranı',st.favPct+'%'],['Düşündüren oranı',st.reflPct+'%']].forEach(function(x){
    h+='<div class="card" style="padding:6px 10px;flex:1;min-width:80px"><p style="font-size:9px;color:var(--t3)">'+x[0]+'</p><p style="font-size:15px;font-weight:800">'+x[1]+'</p></div>';});
  h+='</div>';
  h+='</div>';
  return h;
}
window.wisdomDisplayPanelHtml=wisdomDisplayPanelHtml;
function wdStats(){
  var l=(D.wisdomQuotes||[]),ts=0,never=0,mostC=0,fav=0,refl=0;
  l.forEach(function(q){ ts+=(q.showCount||0); if((q.showCount||0)===0)never++; if((q.showCount||0)>mostC)mostC=q.showCount||0; if(q.favorite)fav++; if(q.reflected)refl++; });
  return {totalShows:ts,never:never,mostCount:mostC,favPct:l.length?Math.round(fav/l.length*100):0,reflPct:l.length?Math.round(refl/l.length*100):0};
}
window.wdStats=wdStats;

/* ── Ayar setter'ları (tercih -> save/cloud) ── */
function wdSet(key,val){ if(typeof snap==='function')snap(); var s=wsGet(); s[key]=val; if(typeof save==='function')save(); _wdFloatDismissed=false; _wdLastRenderedId=null;
  if(key==='enabled'){ if(val){wdStartTimer();wdTick();}else{wdStopTimer();} }
  if(tab==='wisdom')renderWisdomQuotes(); if(tab==='dashboard')renderPage(); renderWisdomFloat(true); }
function wdToggleCat(c){ if(typeof snap==='function')snap(); var s=wsGet(); if(!Array.isArray(s.selectedCategories))s.selectedCategories=[]; var i=s.selectedCategories.indexOf(c); if(i>=0)s.selectedCategories.splice(i,1);else s.selectedCategories.push(c); var t=wdTrack();t.currentId=null;wdTrackSave(t); if(typeof save==='function')save(); wdRotate(); wdRefresh(); }
function wdToggleLang(l){ if(typeof snap==='function')snap(); var s=wsGet(); if(!Array.isArray(s.selectedLanguages))s.selectedLanguages=[]; var i=s.selectedLanguages.indexOf(l); if(i>=0)s.selectedLanguages.splice(i,1);else s.selectedLanguages.push(l); var t=wdTrack();t.currentId=null;wdTrackSave(t); if(typeof save==='function')save(); wdRotate(); wdRefresh(); }
window.wdSet=wdSet;window.wdToggleCat=wdToggleCat;window.wdToggleLang=wdToggleLang;
