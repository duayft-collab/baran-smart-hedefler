/* ══════════════════════════════════════════════════════════════════════════
   D10.5.2 — ORTAK İÇERİK GÖSTERİM/ROTASYON ÇEKİRDEĞİ (koleksiyon-agnostik)
   Tek timer + tek visibilitychange + tek kart renderer + kaynak seçimi + local history.
   Adapter'lar (11b wisdom, 11f principles) kaynağa özgü havuz/skor/kart/frekans sağlar.
   contentDisplaySettings = ortak kart+kaynak davranışı (cloud). Local history = fu7_content_display.
   Rotasyon 0 cloud write. D10.2 davranışı wisdom adapter üzerinden BİREBİR korunur.
   ══════════════════════════════════════════════════════════════════════════ */

/* Kayıtlı adapter'lar: {source: {source,pool,score,frequencyMs,markShown,byId,cardInner,label,canPin,editable}} */
var CD_ADAPTERS={};
function registerContentAdapter(cfg){ if(cfg&&cfg.source)CD_ADAPTERS[cfg.source]=cfg; }
window.registerContentAdapter=registerContentAdapter;

var _cdBooted=false, _cdTimer=null, _cdVisBound=false, _cdLastRenderedKey=null, _cdFloatDismissed=false;

/* Ortak ayar (cloud). */
function cdGet(){ if(!D.contentDisplaySettings||typeof D.contentDisplaySettings!=='object')D.contentDisplaySettings=Object.assign({},INIT.contentDisplaySettings); return D.contentDisplaySettings; }
window.cdGet=cdGet;

/* ── Local history (fu7_content_display) + eski fu7_wisdom_disp'ten kayıpsız migrasyon ── */
function cdTrack(){
  var t;
  try{ t=JSON.parse(localStorage.getItem('fu7_content_display')||'null'); }catch(e){ t=null; }
  if(!t||typeof t!=='object'){
    t={currentSource:null,currentId:null,lastRotation:0,sourceSequenceIndex:0,lastShownRevision:0,history:{wisdom:{},principles:{}}};
    // Eski wisdom gösterim geçmişini güvenle taşı (local, cloud değil)
    try{
      var old=JSON.parse(localStorage.getItem('fu7_wisdom_disp')||'null');
      if(old&&typeof old==='object'){
        if(old.currentId){ t.currentSource='wisdom'; t.currentId=old.currentId; }
        if(old.lastRotation)t.lastRotation=old.lastRotation;
      }
    }catch(e){}
  }
  if(!t.history||typeof t.history!=='object')t.history={wisdom:{},principles:{}};
  if(!t.history.wisdom)t.history.wisdom={};
  if(!t.history.principles)t.history.principles={};
  return t;
}
function cdTrackSave(t){ try{ localStorage.setItem('fu7_content_display',JSON.stringify(t)); localStorage.removeItem('fu7_wisdom_disp'); }catch(e){} } // migrasyon başarılıysa eski anahtar temizlenir
window.cdTrack=cdTrack;window.cdTrackSave=cdTrackSave;
/* Adapter'ların yerel gösterim geçmişine erişimi (principles için showCount kaynağı). */
function cdHistoryFor(source,id){ var t=cdTrack(); var b=t.history[source]||{}; return b[String(id)]||{showCount:0,lastShownAt:null,lastShownRevision:0}; }
function _cdRev(){ return (typeof CLOUD!=='undefined'&&typeof CLOUD.revision==='number')?CLOUD.revision:0; }
function cdMarkHistory(source,id){ var t=cdTrack(); if(!t.history[source])t.history[source]={}; var e=t.history[source][String(id)]||{showCount:0,lastShownAt:null,lastShownRevision:0}; e.showCount=(e.showCount||0)+1; e.lastShownAt=new Date().toISOString(); e.lastShownRevision=_cdRev(); t.history[source][String(id)]=e; t.lastShownRevision=_cdRev(); cdTrackSave(t); }
/* Restore/import sonrası (revision değişti, aynı ID farklı içerik olabilir) yerel gösterim geçmişini güvenle sıfırla. */
function cdInvalidateHistory(){ var t=cdTrack(); t.history={wisdom:{},principles:{}}; t.currentSource=null; t.currentId=null; t.lastRotation=0; t.lastShownRevision=_cdRev(); cdTrackSave(t); }
window.cdHistoryFor=cdHistoryFor;window.cdMarkHistory=cdMarkHistory;window.cdInvalidateHistory=cdInvalidateHistory;

/* ── Bağlam / DayPart (yerel cihaz saati; timezone/AI yok). İleride contexts[] (hafta sonu/iş günü/ofis/ev…) eklenebilecek şekilde generic. ── */
function cdDayPart(){ var h=new Date().getHours();
  if(h>=5&&h<12)return 'morning'; if(h>=12&&h<17)return 'afternoon'; if(h>=17&&h<22)return 'evening'; return 'night'; }
/* Aktif bağlam anahtarları (şu an yalnız dayPart; ileride hafta günü/konum vb. eklenir). */
function cdActiveContexts(){ return ['any',cdDayPart()]; }
/* Generic bağlam uyumu: item'ın bağlamı (şimdilik dayPart) aktif bağlamlarla eşleşiyor mu. */
function cdContextMatch(item){
  if(!cdGet().dayPartAware)return true;
  var dp=(item&&item.dayPart)||'any';
  if(dp==='any')return true;
  return cdActiveContexts().indexOf(dp)>=0;
}
function cdDayPartOk(itemDayPart){ return cdContextMatch({dayPart:itemDayPart}); } // geriye-uyum alias
window.cdDayPart=cdDayPart;window.cdActiveContexts=cdActiveContexts;window.cdContextMatch=cdContextMatch;window.cdDayPartOk=cdDayPartOk;

/* ── Kaynak modu + hangi kaynaklar aktif ── */
function _cdModeSources(){ var m=cdGet().sourceMode;
  if(m==='off')return []; if(m==='wisdom')return ['wisdom']; if(m==='principles')return ['principles']; return ['principles','wisdom']; }
function cdSourceHasPool(source){ var a=CD_ADAPTERS[source]; return !!(a&&a.pool().length); }
/* Yılın günü (deterministik pattern seçimi için; rastgele değil). */
function cdDayOfYear(){ var n=new Date(); return Math.floor((n-new Date(n.getFullYear(),0,0))/864e5); }
/* Aynı oranı koruyan birkaç deterministik 10-slot pattern (base'in faz kaydırmaları) → monotonluk azalır, rastgelelik YOK. */
function cdBuildPatterns(pSlots,wSlots){
  var base=[],pi=0,wi=0;
  for(var i=0;i<10;i++){ if(pi*wSlots<=wi*pSlots&&pi<pSlots){base.push('principles');pi++;} else if(wi<wSlots){base.push('wisdom');wi++;} else {base.push('principles');pi++;} }
  var pats=[]; for(var off=0;off<5;off++){ var r=[]; for(var j=0;j<10;j++)r.push(base[(j+off*2)%10]); pats.push(r); } // 5 faz-kaydırmalı varyant (aynı P/W sayısı)
  return pats;
}
/* Mixed 10-slot dizi (principleWeight oranı + dayOfYear ile pattern rotasyonu). Rastgele yok. */
function cdMixSequence(){
  var s=cdGet(); var pw=Math.max(0,Math.min(100,Number(s.principleWeight)||70));
  var pSlots=Math.max(0,Math.min(10,Math.round(pw/10)));
  var pats=cdBuildPatterns(pSlots,10-pSlots);
  return pats[cdDayOfYear()%pats.length];
}
/* Sıradaki kaynağı seç (mixed: dizi + boş havuz fallback + streak≤3). Index YALNIZ cdRotate'te ilerler. */
function cdNextSource(peek){
  var modes=_cdModeSources(); if(!modes.length)return null;
  var avail=modes.filter(cdSourceHasPool); if(!avail.length)return null;
  if(avail.length===1)return avail[0];
  var t=cdTrack(); var seq=cdMixSequence();
  var idx=t.sourceSequenceIndex||0;
  var want=seq[idx%seq.length];
  if(avail.indexOf(want)<0)want=avail[0]; // istenen kaynak boşsa diğerine güvenli fallback
  return want;
}
window.cdNextSource=cdNextSource;

/* ── Pin (ortak: pinnedSource + pinnedItemId) ── */
function cdPinnedItem(){ var s=cdGet(); if(!s.pinnedSource||!s.pinnedItemId)return null;
  var a=CD_ADAPTERS[s.pinnedSource]; if(!a)return null; var it=a.byId(s.pinnedItemId);
  if(!it||(a.canPin&&!a.canPin(it))){ return null; } // geçersiz/uygunsuz → fail-safe (pin bellekte yok sayılır)
  return {source:s.pinnedSource,item:it};
}

/* ── Seçim ── */
function cdPickIn(source){
  var a=CD_ADAPTERS[source]; if(!a)return null;
  var pool=a.pool(); if(!pool.length)return null;
  var sorted=pool.slice().sort(function(x,y){ var d=a.score(x)-a.score(y); return d!==0?d:String(x.id).localeCompare(String(y.id)); });
  var t=cdTrack();
  // aynı kayıt arka arkaya gösterilmez
  if(sorted.length>1&&t.currentSource===source&&t.currentId&&String(sorted[0].id)===String(t.currentId))return sorted[1];
  return sorted[0];
}
/* Rotasyon: kaynak seç → item seç → mark → track (currentSource/currentId/lastRotation/sequenceIndex). 0 cloud. */
function cdRotate(){
  var pin=cdPinnedItem();
  if(pin){ var t0=cdTrack(); t0.currentSource=pin.source; t0.currentId=pin.item.id; t0.lastRotation=Date.now(); cdTrackSave(t0); return pin; }
  var source=cdNextSource(); if(!source)return null;
  var item=cdPickIn(source); if(!item){ // seçilen kaynak boşsa diğerini dene
    var others=_cdModeSources().filter(function(s){return s!==source&&cdSourceHasPool(s);});
    if(others.length){source=others[0];item=cdPickIn(source);}
    if(!item)return null;
  }
  var a=CD_ADAPTERS[source]; if(a.markShown)a.markShown(item);
  var t=cdTrack(); t.currentSource=source; t.currentId=item.id; t.lastRotation=Date.now();
  var seq=cdMixSequence(); t.sourceSequenceIndex=((t.sourceSequenceIndex||0)+1)%seq.length; // index yalnız gerçek gösterimde ilerler
  cdTrackSave(t);
  return {source:source,item:item};
}
window.cdRotate=cdRotate;
/* Güncel gösterim (pin > currentSource/currentId geçerli > rotate). */
function cdCurrent(){
  var pin=cdPinnedItem(); if(pin)return pin;
  var t=cdTrack();
  if(t.currentSource&&_cdModeSources().indexOf(t.currentSource)>=0&&t.currentId&&CD_ADAPTERS[t.currentSource]){ // kaynak mevcut sourceMode'a uygun olmalı
    var a=CD_ADAPTERS[t.currentSource]; var it=a.byId(t.currentId);
    if(it&&a.pool().some(function(x){return String(x.id)===String(t.currentId);}))return {source:t.currentSource,item:it};
  }
  return cdRotate();
}
window.cdCurrent=cdCurrent;
/* Rotasyon zamanı geldi mi (güncel item'ın frekansına göre; adapter sağlar). */
function cdShouldRotate(){
  var cur=cdCurrent(); if(!cur)return false;
  var a=CD_ADAPTERS[cur.source]; if(!a||!a.frequencyMs)return false;
  var ms=a.frequencyMs(cur.item);
  if(ms<=0)return false; // pageopen(0)/manual(-1) → timer rotasyonu yok
  return (Date.now()-(cdTrack().lastRotation||0))>=ms;
}
window.cdShouldRotate=cdShouldRotate;

/* ── Tek kart renderer ── */
function _cde(s){return U.esc(String(s||''));}
function cdCardInner(cur){
  if(!cur)return ''; var a=CD_ADAPTERS[cur.source]; if(!a)return '';
  var label=a.label?a.label(cur.item):''; var h='';
  h+='<p style="font-size:8.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);opacity:.75;margin-bottom:5px">'+ic('qt',9,'var(--t3)')+' '+_cde(label)+'</p>';
  h+=a.cardInner(cur.item);
  return h;
}
window.cdCardInner=cdCardInner;
function cdHeroHtml(){
  var s=cdGet(); if(!s.enabled||s.position!=='hero')return '';
  var cur=cdCurrent(); if(!cur)return '';
  return '<div class="card wd-anim" style="padding:16px 18px;margin-bottom:16px">'+cdCardInner(cur)+'</div>';
}
window.cdHeroHtml=cdHeroHtml;
function _cdKey(cur){ return cur?cur.source+':'+cur.item.id:null; }
function cdRenderFloat(force){
  var s=cdGet(), box=ge('wisdom-float'); if(!box)return;
  if(!s.enabled||s.position==='hero'||s.position==='off'||_cdFloatDismissed){ box.innerHTML=''; _cdLastRenderedKey=null; return; }
  var cur=cdCurrent(); if(!cur){ box.innerHTML=''; _cdLastRenderedKey=null; return; }
  var key=_cdKey(cur);
  if(!force&&_cdLastRenderedKey===key&&box.innerHTML)return; // aynı içerik + render → dokunma (nav'da flof yok)
  var pos=s.position, wrap='position:fixed;z-index:90;';
  if(pos==='modal')wrap+='inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4);padding:20px;';
  else{ wrap+='max-width:340px;width:calc(100% - 32px);';
    if(pos==='top')wrap+='top:56px;left:50%;transform:translateX(-50%);';
    else if(pos==='bottomleft')wrap+='left:16px;bottom:16px;';
    else wrap+='right:16px;bottom:16px;'; }
  var anim=s.animation==='none'?'':' wd-anim-'+s.animation;
  var h='<div style="'+wrap+'"><div class="card wd-anim'+anim+'" style="padding:13px 15px;box-shadow:0 8px 30px rgba(0,0,0,.18);position:relative;max-width:360px">';
  h+='<button class="btn btn-g btn-ic" style="position:absolute;top:6px;right:6px;width:22px;height:22px" title="Kapat" onclick="cdDismissFloat()">'+ic('x',11)+'</button>';
  h+='<div style="padding-right:16px">'+cdCardInner(cur)+'</div></div></div>';
  box.innerHTML=h; _cdLastRenderedKey=key;
}
window.cdRenderFloat=cdRenderFloat;
function cdDismissFloat(){ _cdFloatDismissed=true; var b=ge('wisdom-float'); if(b)b.innerHTML=''; }
window.cdDismissFloat=cdDismissFloat;
function cdRefresh(){ _cdLastRenderedKey=null; cdRenderFloat(true); if(typeof tab!=='undefined'){ if(tab==='dashboard'&&cdGet().position==='hero')renderPage(); if(tab==='wisdom'&&typeof renderWisdomQuotes==='function')renderWisdomQuotes(); if(tab==='principles'&&typeof renderPrinciples==='function')renderPrinciples(); } }
window.cdRefresh=cdRefresh;

/* ── Ortak hızlı işlemler ── */
function cdNext(){ var t=cdTrack(); t.currentId=null; t.currentSource=null; cdTrackSave(t); var s=cdGet(); if(s.pinnedItemId){s.pinnedSource=null;s.pinnedItemId=null;if(typeof save==='function')save();} cdRotate(); cdRefresh(); }
function cdPinToggle(source,id){ var s=cdGet(); if(typeof snap==='function')snap();
  if(s.pinnedSource===source&&String(s.pinnedItemId)===String(id)){s.pinnedSource=null;s.pinnedItemId=null;}
  else{ var a=CD_ADAPTERS[source]; var it=a&&a.byId(id); if(it&&(!a.canPin||a.canPin(it))){s.pinnedSource=source;s.pinnedItemId=id;var t=cdTrack();t.currentSource=source;t.currentId=id;cdTrackSave(t);} }
  if(typeof save==='function')save(); cdRefresh(); }
window.cdNext=cdNext;window.cdPinToggle=cdPinToggle;

/* ── Tik + tek timer + tek Visibility ── */
function cdTick(fromBoot){
  var s=cdGet();
  if(!s.enabled||s.sourceMode==='off'){ var b=ge('wisdom-float'); if(b)b.innerHTML=''; cdStopTimer(); return; }
  if(fromBoot&&!_cdBooted){ _cdBooted=true; var t=cdTrack(); if(!t.currentId||cdShouldRotate()){cdRotate();_cdLastRenderedKey=null;} cdStartTimer(); }
  else if(cdShouldRotate()){ cdRotate(); _cdLastRenderedKey=null; }
  cdRenderFloat();
}
window.cdTick=cdTick;
function cdStartTimer(){ cdStopTimer(); if(typeof document!=='undefined'&&document.hidden)return; _cdTimer=setInterval(function(){ if(document.hidden)return; if(cdShouldRotate()){cdRotate();_cdLastRenderedKey=null;cdRenderFloat(true);} },60000); }
function cdStopTimer(){ if(_cdTimer){clearInterval(_cdTimer);_cdTimer=null;} }
window.cdStartTimer=cdStartTimer;window.cdStopTimer=cdStopTimer;
function cdBoot(){
  if(!_cdVisBound&&typeof document!=='undefined'){ _cdVisBound=true;
    document.addEventListener('visibilitychange',function(){ if(document.hidden)cdStopTimer(); else{ if(cdGet().enabled&&cdGet().sourceMode!=='off'){cdStartTimer(); if(cdShouldRotate()){cdRotate();_cdLastRenderedKey=null;} cdRenderFloat();} } });
  }
  cdTick(true);
}
window.cdBoot=cdBoot;

/* Ayar setter (ortak). */
function cdSet(key,val){ if(typeof snap==='function')snap(); var s=cdGet(); s[key]=val; if(typeof save==='function')save(); _cdFloatDismissed=false; _cdLastRenderedKey=null;
  if(key==='enabled'||key==='sourceMode'){ if(s.enabled&&s.sourceMode!=='off'){cdStartTimer();cdTick();}else{cdStopTimer();var b=ge('wisdom-float');if(b)b.innerHTML='';} }
  if(typeof tab!=='undefined'){ if(tab==='wisdom'&&typeof renderWisdomQuotes==='function')renderWisdomQuotes(); if(tab==='principles'&&typeof renderPrinciples==='function')renderPrinciples(); if(tab==='dashboard')renderPage(); }
  cdRenderFloat(true); }
window.cdSet=cdSet;

/* ── Ortak public API (gelecekte Dualarım/Sebeplerim/Kararlarım gibi içerik türleri için) ── */
var ContentEngine={
  register:registerContentAdapter,
  sources:function(){ return Object.keys(CD_ADAPTERS); },
  current:function(){ return cdCurrent(); },
  refresh:function(){ _cdLastRenderedKey=null; cdRefresh(); },              // yeniden render (seçim değiştirmeden)
  invalidate:function(){ cdInvalidateHistory(); cdRotate(); cdRefresh(); },  // yerel history sıfırla (restore/import sonrası) + yeni seç
  forcePick:function(){ var t=cdTrack(); t.currentId=null; t.currentSource=null; cdTrackSave(t); var r=cdRotate(); _cdLastRenderedKey=null; cdRenderFloat(true); return r; }, // zorla yeni içerik
  debugState:function(){ var t=cdTrack(); return { settings:cdGet(), sources:Object.keys(CD_ADAPTERS), sourceMode:cdGet().sourceMode, dayPart:cdDayPart(), current:cdCurrent(), track:{currentSource:t.currentSource,currentId:t.currentId,lastRotation:t.lastRotation,sourceSequenceIndex:t.sourceSequenceIndex,lastShownRevision:t.lastShownRevision}, poolSizes:Object.keys(CD_ADAPTERS).reduce(function(o,s){o[s]=CD_ADAPTERS[s].pool().length;return o;},{}) }; }
};
window.ContentEngine=ContentEngine;
