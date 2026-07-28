/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom Sharding P3d — RUNTIME HEALTH + RESILIENCE LAYER
   Sharded koleksiyon = PRIMARY. Legacy dizi = PASİF güvenlik fallback'i.
   Normal çalışmada legacy okunmaz (wqList sharded modda yalnız cache döner — O(1),
   tek kaynak). Fallback yalnız kapı-sonrası hata (load/count/empty/error) olduğunda.
   Bu modül SALT OKUNUR sorgu + rozet + sağlık kartı üretir. 0 write, 0 listener,
   yeni koleksiyon yok. Durum WQ_STORE_STATE (runtime; Firestore'a yazılmaz) üzerinden.
   ══════════════════════════════════════════════════════════════════════════ */

function _wrhState(){ return (typeof WQ_STORE_STATE!=='undefined')?WQ_STORE_STATE:{source:'legacy',fallbackReason:null,fallbackCount:0,lastFallbackAt:null,lastSuccessfulRead:null}; }

/* Primary (sharded koleksiyon) kullanılabilir mi. */
function wisdomPrimaryAvailable(){ return typeof wisdomStoreIsSharded==='function'&&wisdomStoreIsSharded()===true; }
window.wisdomPrimaryAvailable=wisdomPrimaryAvailable;

/* Şu an okuma kaynağı. */
function wisdomReadSource(){ return wisdomPrimaryAvailable()?'sharded':'legacy'; }
window.wisdomReadSource=wisdomReadSource;

/* Fallback devrede mi = primary yok VE gerçek bir kapı-sonrası hata kaydı var. */
function wisdomShouldFallback(){ return !wisdomPrimaryAvailable()&&!!_wrhState().fallbackReason; }
window.wisdomShouldFallback=wisdomShouldFallback;

function wisdomFallbackReason(){ return wisdomShouldFallback()?_wrhState().fallbackReason:null; }
window.wisdomFallbackReason=wisdomFallbackReason;

/* Tüm runtime sağlık görünümü (salt okunur). */
function wisdomRuntimeHealth(){
  var s=_wrhState();
  return {
    source:wisdomReadSource(),
    primaryAvailable:wisdomPrimaryAvailable(),
    fallback:wisdomShouldFallback(),
    fallbackReason:wisdomFallbackReason(),
    fallbackCount:s.fallbackCount||0,
    lastFallbackAt:s.lastFallbackAt||null,
    lastSuccessfulRead:s.lastSuccessfulRead||null,
    cacheSize:(typeof WQ_STORE!=='undefined')?WQ_STORE.size:0
  };
}
window.wisdomRuntimeHealth=wisdomRuntimeHealth;

function wisdomFallbackMetrics(){ var s=_wrhState(); return {count:s.fallbackCount||0,lastAt:s.lastFallbackAt||null,reason:s.fallbackReason||null}; }
window.wisdomFallbackMetrics=wisdomFallbackMetrics;

/* ── UI: kaynak rozeti (sağ üst). Primary → sade "Bulut Arşivi"; fallback → uyarı
   "Yerel Güvenlik Arşivi" + tooltip. role=status, responsive, popup/toast yok. ── */
function _wrhIc(n,c){ return (typeof ic==='function')?ic(n,12,c):''; }
function wisdomSourceBadgeHtml(){
  if(wisdomShouldFallback()){
    return '<span role="status" title="Bulut arşivi geçici olarak kullanılamadığı için güvenlik kopyası kullanılmaktadır." '+
      'style="display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:3px 9px;border-radius:999px;background:var(--s2);font-size:10.5px;font-weight:700;color:var(--orange)">'+
      _wrhIc('csq','var(--orange)')+'Yerel Güvenlik Arşivi</span>';
  }
  if(wisdomPrimaryAvailable()){
    return '<span role="status" title="Sözler bulut arşivinden (sharded koleksiyon) okunuyor." '+
      'style="display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:3px 9px;border-radius:999px;background:var(--s2);font-size:10.5px;font-weight:600;color:var(--t2)">'+
      _wrhIc('qt','var(--blue)')+'Bulut Arşivi</span>';
  }
  return ''; // migration öncesi legacy (fallback değil) → rozet yok
}
window.wisdomSourceBadgeHtml=wisdomSourceBadgeHtml;

/* ── Sağlık paneli mini kartı: Arşiv Durumu ── */
function _wrhTime(ts){ if(!ts)return '—'; try{ var d=new Date(ts); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }catch(e){ return '—'; } }
function wisdomArchiveHealthCardHtml(){
  var h=wisdomRuntimeHealth();
  var e=(typeof U!=='undefined'&&U.esc)?U.esc:function(s){return String(s==null?'':s);};
  var srcLabel=h.source==='sharded'?'Bulut (Sharded)':'Yerel Güvenlik';
  var srcColor=h.source==='sharded'?'var(--green)':'var(--orange)';
  var icn=(typeof ic==='function')?ic(h.source==='sharded'?'qt':'csq',13,srcColor):'';
  var rows=[
    ['Kaynak',srcLabel,srcColor],
    ['Cache',String(h.cacheSize),'var(--t)'],
    ['Fallback Sayısı',String(h.fallbackCount),h.fallbackCount>0?'var(--orange)':'var(--t)'],
    ['Son Başarılı Okuma',_wrhTime(h.lastSuccessfulRead),'var(--t2)'],
    ['Son Fallback',_wrhTime(h.lastFallbackAt),'var(--t2)']
  ];
  var h2='<div class="card" style="padding:11px 13px;flex:1 1 220px;min-width:200px;max-width:100%">';
  h2+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">'+icn+'<span style="font-size:11px;font-weight:800">Arşiv Durumu</span></div>';
  h2+='<div style="display:flex;flex-direction:column;gap:3px">';
  rows.forEach(function(r){ h2+='<div style="display:flex;justify-content:space-between;gap:8px;font-size:10.5px"><span style="color:var(--t3)">'+e(r[0])+'</span><span style="font-weight:700;color:'+r[2]+'">'+e(r[1])+'</span></div>'; });
  h2+='</div></div>';
  return h2;
}
window.wisdomArchiveHealthCardHtml=wisdomArchiveHealthCardHtml;
