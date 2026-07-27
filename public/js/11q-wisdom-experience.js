/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Phase 6 P1 — WISDOM EXPERIENCE SYSTEM (TAMAMEN READ-ONLY)
   Mevcut D.wisdomQuotes TEK KAYNAK. Yeni veri modeli / koleksiyon / sync /
   backup / seçim motoru YOK. Üç yüzey (Dashboard kartı, Floating kart, Welcome
   popup) TEK seçici wexPick()'i paylaşır. Seçim wdActiveList() (mevcut aktif
   havuz) üzerine kurulur; showCount/lastShownAt YAZILMAZ → tekrar önleme
   RUNTIME MEMORY ile yapılır. D.goals/goalCheckIns/relations/notes/settings
   ASLA değişmez. Tek kullanıcı-tetikli yazma: Favori = mevcut wqToggleFav
   (wisdomQuotes; korumalı koleksiyonlara dokunmaz). İlişkiler mevcut relations
   motorundan (getRelatedEntities) türetilir — yeni ilişki motoru yazılmaz.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Runtime memory (SADECE bellek; hiçbir kalıcı yazma yok) ── */
var WEX={
  dayKey:null,
  seenSession:{},     // id -> 1 (oturum boyunca)
  seenDay:{},         // id -> 1 (gün boyunca, gün değişince sıfırlanır)
  current:{},         // context -> quote id (kararlı render)
  popupShownSession:false,
  popupSuppressDay:null,
  floatOpen:false     // ilk hali KAPALI
};
function _wexToday(){ try{return new Date().toISOString().slice(0,10);}catch(e){return String(Date.now());} }
function _wexDayGate(){ var d=_wexToday(); if(WEX.dayKey!==d){ WEX.dayKey=d; WEX.seenDay={}; WEX.popupSuppressDay=null; } }
function wexReset(){ WEX.dayKey=null;WEX.seenSession={};WEX.seenDay={};WEX.current={};WEX.popupShownSession=false;WEX.popupSuppressDay=null;WEX.floatOpen=false; }
window.WEX=WEX; window.wexReset=wexReset;

/* ── Aktif havuz (mevcut wdActiveList yeniden kullanılır; yoksa güvenli fallback) ── */
function _wexActive(){
  if(typeof wdActiveList==='function')return wdActiveList()||[];
  return (Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]).filter(function(q){return q&&q.active;});
}

/* ── Bağlamsal kategori haritası — kategori yoksa genel havuza dön (null) ── */
var WEX_CONTEXT={
  dashboard:['Genel','Motivasyon','Hayat'],
  goals:['Disiplin','Odak','Başarı','Kararlılık'],
  goalsdash:['Disiplin','Odak','Başarı','Kararlılık'],
  okr:['Disiplin','Odak','Başarı','Kararlılık'],
  mybooks:['Öğrenme','Bilgelik'],
  readingplan:['Öğrenme','Bilgelik'],
  library:['Öğrenme','Bilgelik'],
  generalnotes:['Düşünme','Karar','Yazma']
};
function wexContextCats(ctx){ return WEX_CONTEXT[ctx]||null; }
function _wexTab(){ return (typeof tab!=='undefined'&&tab)?tab:'dashboard'; }
window.wexContextCats=wexContextCats;

/* Bağlamsal havuz: context kategorilerine göre filtre; eşleşme yoksa TÜM aktif havuz. */
function wexPool(ctx){
  var all=_wexActive();
  var cats=wexContextCats(ctx);
  if(!cats||!cats.length)return all;
  var narrowed=all.filter(function(q){ return q&&cats.indexOf(q.category)>=0; });
  return narrowed.length?narrowed:all; // kategori yoksa genel havuza dön
}
window.wexPool=wexPool;

/* ── Türetilmiş Impact (SADECE gösterim; hiçbir alan eklenmez/yazılmaz) ── */
function wexImpact(q){
  if(!q)return {level:'low',label:'Düşük'};
  var s=0;
  if(q.favorite)s+=2;
  if(q.reflected)s+=2;
  s+=Math.max(0,Math.min(3,Number(q.priority)||0));
  if((q.showCount||0)>=5)s+=1;
  var level=s>=4?'high':(s>=2?'medium':'low');
  return {level:level,label:level==='high'?'Yüksek':(level==='medium'?'Orta':'Düşük')};
}
window.wexImpact=wexImpact;

/* ── TEK SEÇİCİ (read-only): pool → oturum/gün tekrarını ele → deterministik sırala → seç ──
   Sıralama (read-only okuma): görülmemiş-gün önce → reflected → favorite → priority →
   showCount az → lastShownAt eski → id. Seçilen RUNTIME memory'ye işlenir (yazma yok). */
function _wexRank(a,b){
  var ad=WEX.seenDay[a.id]?1:0, bd=WEX.seenDay[b.id]?1:0; if(ad!==bd)return ad-bd;
  var ar=(b.reflected?1:0)-(a.reflected?1:0); if(ar)return ar;
  var af=(b.favorite?1:0)-(a.favorite?1:0); if(af)return af;
  var ap=(Number(b.priority)||0)-(Number(a.priority)||0); if(ap)return ap;
  var asc=(a.showCount||0)-(b.showCount||0); if(asc)return asc;
  var al=String(a.lastShownAt||''), bl=String(b.lastShownAt||''); if(al!==bl)return al<bl?-1:1;
  return String(a.id).localeCompare(String(b.id));
}
function wexPick(opts){
  opts=opts||{};
  _wexDayGate();
  var ctx=opts.context||_wexTab();
  var pool=(Array.isArray(opts.pool)?opts.pool:wexPool(ctx)).filter(Boolean);
  if(!pool.length)return null;
  var exclude=opts.exclude!=null?String(opts.exclude):null;
  var avail=pool.filter(function(q){ return !WEX.seenSession[q.id]&&(!exclude||String(q.id)!==exclude); });
  if(!avail.length){ // oturumda hepsi görüldü → oturum hafızasını bu bağlam için serbest bırak (döngü)
    avail=pool.filter(function(q){ return !exclude||String(q.id)!==exclude; });
    if(!avail.length)avail=pool.slice();
    // oturum tekrarını sıfırlamadan önce dedup mümkün olduğunca korunur; yine boşsa tüm havuz
    avail.forEach(function(q){ delete WEX.seenSession[q.id]; });
  }
  var picked=avail.slice().sort(_wexRank)[0];
  if(picked&&opts.advance!==false)wexMarkSeen(picked);
  return picked||null;
}
function wexMarkSeen(q){ if(!q)return; WEX.seenSession[q.id]=1; WEX.seenDay[q.id]=1; } // RUNTIME ONLY
window.wexPick=wexPick; window.wexMarkSeen=wexMarkSeen;

/* Kararlı geçerli seçim (yüzeyler re-render'da sabit kalsın). */
function wexCurrent(ctx){
  ctx=ctx||_wexTab();
  var id=WEX.current[ctx];
  if(id){ var cur=(typeof wqById==='function')?wqById(id):null; if(cur&&cur.active)return cur; }
  var q=wexPick({context:ctx});
  WEX.current[ctx]=q?q.id:null;
  return q;
}
function wexNext(ctx){
  ctx=ctx||_wexTab();
  var prev=WEX.current[ctx]||null;
  var q=wexPick({context:ctx,exclude:prev});
  WEX.current[ctx]=q?q.id:null;
  return q;
}
window.wexCurrent=wexCurrent; window.wexNext=wexNext;

/* ── Ortak kart gövdesi (üç yüzey aynı gövdeyi kullanır) ── */
function _wxe(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _wxIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz,cl):''; }
function wexMetaRow(q){
  if(!q)return '';
  var im=wexImpact(q), h='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
  if(q.category)h+='<span class="pill p-blue" style="font-size:9.5px">'+_wxe(q.category)+'</span>';
  var ic1=im.level==='high'?'var(--green)':(im.level==='medium'?'var(--orange)':'var(--t3)');
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:'+ic1+'">Etki: '+_wxe(im.label)+'</span>';
  if(q.source)h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--t3)">'+_wxe(String(q.source).slice(0,40))+'</span>';
  h+='</div>';
  return h;
}
/* big=büyük tipografi (Dashboard/Popup). Sabit px GENİŞLİK yok; clamp tipografi. */
function wexCardBody(q,big){
  if(!q)return '<p style="font-size:13px;color:var(--t3)">Gösterilecek söz yok.</p>';
  var qs=big?'clamp(17px,2.9vw,25px)':'14px', h='';
  h+=wexMetaRow(q);
  h+='<p style="font-style:italic;line-height:1.55;color:var(--t);word-break:break-word;margin-top:9px;font-size:'+qs+'">&ldquo;'+_wxe(q.quote)+'&rdquo;</p>';
  if(q.author)h+='<p style="font-size:12px;font-weight:700;color:var(--blue);margin-top:7px">&mdash; '+_wxe(q.author)+'</p>';
  return h;
}
window.wexCardBody=wexCardBody; window.wexMetaRow=wexMetaRow;

/* Ortak aksiyon çubuğu (Favori/Yeni/Detay). ctx=yüzey bağlamı, surface=refresh hedefi. */
function wexActions(q,surface){
  if(!q)return '';
  var id=_wxe(String(q.id)), s=_wxe(surface||'dashboard');
  var h='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:11px">';
  h+='<button class="btn btn-g btn-sm" title="Favori" aria-label="Favori" data-id="'+id+'" data-s="'+s+'" onclick="wexFav(this.dataset.id,this.dataset.s)">'+_wxIc('star',12,q.favorite?'var(--orange)':'var(--t3)')+' Favori</button>';
  h+='<button class="btn btn-g btn-sm" title="Yeni söz" aria-label="Yeni söz" data-s="'+s+'" onclick="wexNewOnSurface(this.dataset.s)">'+_wxIc('ref',12,'var(--t3)')+' Yeni</button>';
  h+='<button class="btn btn-g btn-sm" title="Detay" aria-label="Detay" data-id="'+id+'" onclick="wexOpenDetail(this.dataset.id)">'+_wxIc('bk',12,'var(--t3)')+' Detay</button>';
  h+='</div>';
  return h;
}
window.wexActions=wexActions;

/* ══ 1) DASHBOARD WISDOM CARD (premium, responsive, sabit px genişlik yok) ══ */
function wexDashboardCardHtml(){
  var q=wexCurrent('dashboard');
  if(!q)return '';
  var h='<div class="card wd-anim" role="region" aria-label="Bugünün Bilgeliği" style="margin-bottom:16px;padding:18px 20px;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2);box-shadow:0 6px 24px rgba(0,0,0,.06);max-width:100%">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+_wxIc('qt',15,'var(--blue)')+'<p style="font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--t3)">Bugünün Bilgeliği</p></div>';
  h+=wexCardBody(q,true);
  h+=wexActions(q,'dashboard');
  h+='</div>';
  return h;
}
window.wexDashboardCardHtml=wexDashboardCardHtml;

/* ══ 2) FLOATING WISDOM CARD (sağ alt, ilk hali kapalı, aç/kapat, ekranı kapatmaz) ══ */
function wexFloatHost(){
  if(typeof document==='undefined'||!document.body)return null;
  var el=document.getElementById('wex-float');
  if(!el){ el=document.createElement('div'); el.id='wex-float'; try{document.body.appendChild(el);}catch(e){} }
  return el;
}
function wexFloatOpenHtml(){
  var q=wexCurrent(_wexTab());
  var h='<div role="complementary" aria-label="Bilgelik kartı" style="position:fixed;right:16px;bottom:16px;z-index:90;max-width:340px;width:calc(100% - 32px)">';
  h+='<div class="card wd-anim" style="padding:13px 15px;box-shadow:0 8px 30px rgba(0,0,0,.18);position:relative;max-width:100%">';
  h+='<button class="btn btn-g btn-ic" style="position:absolute;top:6px;right:6px;width:22px;height:22px" title="Kapat" aria-label="Kapat" onclick="wexFloatToggle()">'+_wxIc('x',11)+'</button>';
  h+='<div style="padding-right:18px">'+(q?wexCardBody(q,false)+wexActions(q,'float'):'<p style="font-size:12.5px;color:var(--t3)">Gösterilecek söz yok.</p>')+'</div>';
  h+='</div></div>';
  return h;
}
function wexFloatClosedHtml(){
  return '<button class="btn btn-p btn-ic" title="Bilgelik" aria-label="Bilgelik kartını aç" aria-expanded="false" onclick="wexFloatToggle()" style="position:fixed;right:16px;bottom:16px;z-index:90;width:44px;height:44px;border-radius:50%;box-shadow:0 6px 20px rgba(0,0,0,.22)">'+_wxIc('qt',18,'#fff')+'</button>';
}
function wexRenderFloat(){
  var host=wexFloatHost(); if(!host)return;
  host.innerHTML=WEX.floatOpen?wexFloatOpenHtml():wexFloatClosedHtml();
}
function wexFloatToggle(){ WEX.floatOpen=!WEX.floatOpen; wexRenderFloat(); }
window.wexRenderFloat=wexRenderFloat; window.wexFloatToggle=wexFloatToggle;
window.wexFloatOpenHtml=wexFloatOpenHtml; window.wexFloatClosedHtml=wexFloatClosedHtml;

/* ══ 3) WELCOME POPUP (login sonrası 15–30 sn, oturumda tek sefer; ESC/dışarı/focus-trap/ARIA) ══ */
function wexPopupHtml(q){
  var h='<div class="ov" id="wex-ov" style="position:fixed;inset:0;z-index:130;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:20px;backdrop-filter:blur(2px)">';
  h+='<div class="mbox wd-anim" role="dialog" aria-modal="true" aria-label="Bugünün Bilgeliği" id="wex-dialog" style="max-width:520px;width:100%;background:var(--s);border:1px solid var(--s2);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.35);padding:22px 24px">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  h+='<div style="display:flex;align-items:center;gap:8px">'+_wxIc('qt',16,'var(--blue)')+'<h2 style="font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--t2)">Bugünün Bilgeliği</h2></div>';
  h+='<button class="btn btn-g btn-ic" style="width:28px;height:28px" title="Kapat" aria-label="Kapat" onclick="wexPopupClose()">'+_wxIc('x',13)+'</button></div>';
  h+='<div>'+wexCardBody(q,true)+'</div>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:16px">';
  var id=_wxe(String(q.id));
  h+='<button class="btn btn-p btn-sm" data-id="'+id+'" onclick="wexFav(this.dataset.id,\'popup\')">'+_wxIc('star',12,'#fff')+' Favorilere Ekle</button>';
  h+='<button class="btn btn-g btn-sm" onclick="wexNewOnSurface(\'popup\')">'+_wxIc('ref',12,'var(--t3)')+' Yeni Söz</button>';
  h+='<button class="btn btn-g btn-sm" data-id="'+id+'" onclick="wexOpenDetail(this.dataset.id)">'+_wxIc('bk',12,'var(--t3)')+' Detay</button>';
  h+='<button class="btn btn-g btn-sm" onclick="wexPopupSuppressToday()">Bugün Bir Daha Gösterme</button>';
  h+='<button class="btn btn-g btn-sm" onclick="wexPopupClose()">Kapat</button>';
  h+='</div></div></div>';
  return h;
}
window.wexPopupHtml=wexPopupHtml;

function wexPopupHost(){
  if(typeof document==='undefined'||!document.body)return null;
  var el=document.getElementById('wex-popup');
  if(!el){ el=document.createElement('div'); el.id='wex-popup'; try{document.body.appendChild(el);}catch(e){} }
  return el;
}
function wexPopupOpen(){
  _wexDayGate();
  if(WEX.popupShownSession||WEX.popupSuppressDay===WEX.dayKey)return false;
  var q=wexCurrent(_wexTab()); if(!q)return false;
  var host=wexPopupHost(); if(!host)return false;
  WEX.popupShownSession=true;
  host.innerHTML=wexPopupHtml(q);
  wexBindPopup();
  return true;
}
function wexPopupClose(){ var h=wexPopupHost(); if(h)h.innerHTML=''; if(WEX._popupKey&&typeof document!=='undefined'&&typeof document.removeEventListener==='function')document.removeEventListener('keydown',WEX._popupKey); WEX._popupKey=null; }
function wexPopupSuppressToday(){ _wexDayGate(); WEX.popupSuppressDay=WEX.dayKey; wexPopupClose(); }
window.wexPopupOpen=wexPopupOpen; window.wexPopupClose=wexPopupClose; window.wexPopupSuppressToday=wexPopupSuppressToday;

/* ESC + dışarı tıklama + focus trap (erişilebilirlik). */
function wexBindPopup(){
  if(typeof document==='undefined')return;
  var ov=document.getElementById('wex-ov'), dlg=document.getElementById('wex-dialog');
  if(ov&&ov.addEventListener)ov.addEventListener('click',function(e){ if(e.target&&e.target.id==='wex-ov')wexPopupClose(); });
  var onKey=function(e){
    if(e.key==='Escape'||e.keyCode===27){ wexPopupClose(); return; }
    if((e.key==='Tab'||e.keyCode===9)&&dlg&&dlg.querySelectorAll){
      var f=dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if(!f||!f.length)return;
      var first=f[0], last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){ if(e.preventDefault)e.preventDefault(); if(last.focus)last.focus(); }
      else if(!e.shiftKey&&document.activeElement===last){ if(e.preventDefault)e.preventDefault(); if(first.focus)first.focus(); }
    }
  };
  WEX._popupKey=onKey;
  document.addEventListener('keydown',onKey);
  try{ if(dlg&&dlg.querySelector){ var fb=dlg.querySelector('button'); if(fb&&fb.focus)fb.focus(); } }catch(e){}
}
window.wexBindPopup=wexBindPopup;

/* ══ 7) WISDOM DETAIL (mevcut relations motoru; yeni ilişki motoru YOK) ══ */
function _wexRelGroup(list,type){ return (list||[]).filter(function(x){ return x&&x.entity&&x.entity.type===type; }); }
function wexDetailHtml(id){
  var q=(typeof wqById==='function')?wqById(id):null;
  if(!q)return '<p style="font-size:13px;color:var(--t3)">Söz bulunamadı.</p>';
  var im=wexImpact(q);
  var h='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h2 style="font-size:16px;font-weight:800">Bilgelik Detayı</h2><button class="btn btn-g btn-ic" style="width:30px;height:30px" title="Kapat" aria-label="Kapat" onclick="wexDetailClose()">'+_wxIc('x',14)+'</button></div>';
  h+='<p style="font-size:clamp(15px,2.4vw,20px);font-style:italic;line-height:1.55;color:var(--t);word-break:break-word">&ldquo;'+_wxe(q.quote)+'&rdquo;</p>';
  if(q.author)h+='<p style="font-size:12px;font-weight:700;color:var(--blue);margin-top:6px">&mdash; '+_wxe(q.author)+'</p>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
  if(q.category)h+='<span class="pill p-blue" style="font-size:10px">'+_wxe(q.category)+'</span>';
  h+='<span class="pill" style="font-size:10px;background:var(--s2);color:var(--t2)">Etki: '+_wxe(im.label)+'</span>';
  if(q.source)h+='<span class="pill" style="font-size:10px;background:var(--s2);color:var(--t3)">Kaynak: '+_wxe(q.source)+'</span>';
  h+='</div>';
  if(q.tags&&q.tags.length)h+='<p style="font-size:11px;color:var(--t3);margin-top:8px">'+q.tags.map(function(t){return '#'+_wxe(t);}).join(' ')+'</p>';
  // İlişkiler — mevcut motordan türetilir
  var rel=(typeof getRelatedEntities==='function')?getRelatedEntities('wisdomQuote',q.id):[];
  var groups=[['wisdomQuote','İlgili Bilgelik'],['principle','İlgili İlkeler'],['goal','İlgili Hedefler']];
  var any=false, gh='';
  groups.forEach(function(g){
    var items=_wexRelGroup(rel,g[0]); if(!items.length)return; any=true;
    gh+='<p style="font-size:11px;font-weight:700;color:var(--t2);margin:10px 0 4px">'+g[1]+'</p><div style="display:flex;flex-direction:column;gap:4px">';
    items.forEach(function(x){ gh+='<div class="card" style="padding:7px 10px;font-size:11.5px;color:var(--t2)">'+_wxe(x.entity.label||'(kayıt)')+'</div>'; });
    gh+='</div>';
  });
  h+='<div style="margin-top:6px;border-top:1px solid var(--s2);padding-top:8px">'+(any?gh:'<p style="font-size:11px;color:var(--t3);margin-top:8px">İlişkili kayıt yok.</p>')+'</div>';
  return h;
}
window.wexDetailHtml=wexDetailHtml;
function wexOpenDetail(id){ if(typeof showModal==='function')showModal(wexDetailHtml(id)); }
function wexDetailClose(){ if(typeof closeModal==='function')closeModal(); }
window.wexOpenDetail=wexOpenDetail; window.wexDetailClose=wexDetailClose;

/* ── Yüzey aksiyonları ── */
/* Favori: mevcut kullanıcı-tetikli wqToggleFav (wisdomQuotes; korumalı koleksiyon değil). */
function wexFav(id,surface){ if(typeof wqToggleFav==='function')wqToggleFav(id); wexRefreshSurface(surface); }
function wexNewOnSurface(surface){ wexNext(_wexTab()); wexRefreshSurface(surface); }
function wexRefreshSurface(surface){
  if(surface==='dashboard'){ if(typeof tab!=='undefined'&&tab==='dashboard'&&typeof renderPage==='function')renderPage(); }
  else if(surface==='float'){ wexRenderFloat(); }
  else if(surface==='popup'){ var h=wexPopupHost(); var q=wexCurrent(_wexTab()); if(h&&q){ h.innerHTML=wexPopupHtml(q); wexBindPopup(); } }
}
window.wexFav=wexFav; window.wexNewOnSurface=wexNewOnSurface; window.wexRefreshSurface=wexRefreshSurface;

/* ── Boot (ince hook: floating mount + gecikmeli tek popup). Yalnız runtime; 0 yazma. ── */
function wexBoot(){
  if(typeof document==='undefined')return;
  wexRenderFloat();
  var delay=15000+Math.floor(Math.random()*15000); // 15–30 sn
  try{ setTimeout(function(){ if(_wexActive().length)wexPopupOpen(); },delay); }catch(e){}
}
window.wexBoot=wexBoot;
