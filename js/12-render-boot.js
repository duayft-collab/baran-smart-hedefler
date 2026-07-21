function renderPage(){
  var pages={
    dashboard:renderDashboard,kpi:renderKPI,goals:renderGoals,
    todos:renderTodos,habits:renderHabits,routines:renderRoutines,
    smart:renderSMART,onething:renderOneThing,frog:renderFrog,
    timeblock:renderTimeBlock,weeklyreview:renderWeeklyReview,gtd:renderGTD,
    library:renderLibrary,mybooks:renderMyBooks,readingplan:renderReadingPlan,
    challenges:renderChallenges,deepwork:renderDeepWork,sop:renderSOP,
    tools:renderTools,history:renderHistory,
    generalnotes:renderGeneralNotes,
    restore:renderRestore,
    wisdom:renderWisdomQuotes,
    quotes:function(){renderGenericList('quotes');},
    journal:function(){renderGenericList('journal');},
    principles:function(){renderGenericList('principles');},
    coaching:function(){renderGenericList('coaching');},
    vault:function(){renderGenericList('vault');},
    questions:function(){renderGenericList('questions');},
  };
  var fn=pages[tab];
  if(fn)fn();
  else{sh('pinner','<div class="empty">'+ic('ci',32,'var(--t3)')+'<p>Sayfa bulunamadi: '+tab+'</p></div>');}
}
/* ══════════════════════════════════════════════════════════════════════════
   FAZ-5B — YALNIZ ADMIN GORUNUR SISTEM DURUM CUBUGU
   Otorite: Firebase custom claim (getIdTokenResult().claims.admin===true). Fail-closed.
   Normal/anonim kullanicida DOM'a HIC eklenmez. Hassas veri (UID/email/token/path/
   raw hata) ASLA gosterilmez. Yeni write/listener/polling YOK; olay tabanli render.
   ══════════════════════════════════════════════════════════════════════════ */
var ADMIN_UI={resolved:false,isAdmin:false,checking:false,lastCheckedUid:null,lastError:null,_forcedOnce:false};
function isCurrentUserAdmin(){return ADMIN_UI.resolved===true&&ADMIN_UI.isAdmin===true;}
window.isCurrentUserAdmin=isCurrentUserAdmin;
function resetAdminUI(){ADMIN_UI={resolved:false,isAdmin:false,checking:false,lastCheckedUid:null,lastError:null,_forcedOnce:ADMIN_UI._forcedOnce};renderAdminSystemStatusBar();}
window.resetAdminUI=resetAdminUI;
/* Claim'i coz — anonim/yok=false; getIdTokenResult; hata=false (fail-closed). Raw claim/log/token yazilmaz. */
function resolveCurrentAdminClaim(forceRefresh){
  var u=(CLOUD.auth&&CLOUD.auth.currentUser)||CLOUD.user||null;
  if(!u||u.isAnonymous){ADMIN_UI.resolved=true;ADMIN_UI.isAdmin=false;ADMIN_UI.lastCheckedUid=u?u.uid:null;renderAdminSystemStatusBar();return Promise.resolve(false);}
  if(ADMIN_UI.checking)return Promise.resolve(ADMIN_UI.isAdmin);
  var force=!!forceRefresh;
  if(!force&&!ADMIN_UI._forcedOnce){force=true;ADMIN_UI._forcedOnce=true;} // tek seferlik tazeleme (yeni atanan admin gorsun)
  ADMIN_UI.checking=true;
  return u.getIdTokenResult(force).then(function(res){
    ADMIN_UI.isAdmin=!!(res&&res.claims&&res.claims.admin===true);
    ADMIN_UI.resolved=true;ADMIN_UI.lastCheckedUid=u.uid;ADMIN_UI.lastError=null;
  }).catch(function(){
    ADMIN_UI.isAdmin=false;ADMIN_UI.resolved=true;ADMIN_UI.lastError='claim_error'; // raw hata YOK
  }).then(function(){ADMIN_UI.checking=false;renderAdminSystemStatusBar();return ADMIN_UI.isAdmin;});
}
window.resolveCurrentAdminClaim=resolveCurrentAdminClaim;

/* Saf oncelik: cakisma > restore belirsiz > restore basarisiz > offline > pending > restore aktif > listener>1 > hazir. */
function adminStatusPrimary(st){
  st=st||{};
  if(st.conflict)return {label:'Çakışma',severity:'error',cloudState:'Çakışma'};
  if(st.restoreUncertain)return {label:'Geri yükleme belirsiz',severity:'error',cloudState:'Geri yükleme'};
  if(st.restoreState==='FAILED')return {label:'Geri yükleme başarısız',severity:'error',cloudState:'Geri yükleme'};
  if(st.online===false)return {label:'Çevrimdışı',severity:'warn',cloudState:'Çevrimdışı'};
  if(st.pending)return {label:'Bekleyen değişiklik',severity:'warn',cloudState:'Bekleyen değişiklik'};
  if(st.restoreState&&st.restoreState!=='IDLE'){var t=(typeof RESTORE_TEXT!=='undefined'&&RESTORE_TEXT[st.restoreState])||'Geri yükleme';return {label:t,severity:'warn',cloudState:'Geri yükleme'};}
  if(st.listenerCount>1)return {label:'Birden fazla dinleyici',severity:'warn',cloudState:'Bağlı'};
  return {label:'Hazır',severity:'ok',cloudState:'Bağlı'};
}
window.adminStatusPrimary=adminStatusPrimary;
/* Durum modeli — salt hesap; hassas alan YOK; write/listener YOK. */
function getAdminSystemStatus(){
  var st={
    online:(typeof navigator!=='undefined')?navigator.onLine!==false:true,
    pending:!!CLOUD.pendingMutation,
    conflict:!!CLOUD.conflict,
    restoreState:(typeof RESTORE!=='undefined'&&RESTORE.state)||'IDLE',
    restoreUncertain:!!(typeof RESTORE!=='undefined'&&RESTORE.commitUncertain),
    listenerCount:(CLOUD.unsubDoc&&CLOUD.listenerUid===CLOUD.uid)?1:0,
    revision:(typeof CLOUD.revision==='number')?CLOUD.revision:null,
    lastSavedAt:(typeof CLOUD.lastSavedAt==='number'&&CLOUD.lastSavedAt>0)?CLOUD.lastSavedAt:null,
    appVersion:(typeof APP_VERSION==='string'&&APP_VERSION)?APP_VERSION:'—'
  };
  var pr=adminStatusPrimary(st);
  st.primaryState=pr.label;st.severity=pr.severity;st.cloudState=pr.cloudState;
  return st;
}
window.getAdminSystemStatus=getAdminSystemStatus;
function _adminFmtTime(ts){if(!ts)return null;try{var d=new Date(ts);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}catch(e){return null;}}
/* Tek render helper — admin degilse DOM'dan TAMAMEN kaldirir; admin ise tek bar. */
function renderAdminSystemStatusBar(){
  if(typeof document==='undefined'||!document.body)return;
  var existing=document.getElementById('admin-system-status-bar');
  if(!isCurrentUserAdmin()){
    if(existing&&existing.parentNode)existing.parentNode.removeChild(existing);
    document.body.classList.remove('admin-bar-on');
    return;
  }
  var st=getAdminSystemStatus();
  var sev=st.severity==='error'?'var(--red)':st.severity==='warn'?'var(--orange)':'var(--green)';
  var rev=(st.revision===null||st.revision===undefined)?'—':st.revision;
  var lastT=_adminFmtTime(st.lastSavedAt);
  var sep='<span style="color:var(--s3)">|</span>';
  var inner='<div style="display:flex;gap:9px;flex-wrap:wrap;align-items:center;font-size:10.5px;line-height:1.5">'+
    '<span style="font-weight:700;color:'+sev+'">Sistem: '+U.esc(st.primaryState)+'</span>'+sep+
    '<span style="color:var(--t3)">Bulut: '+U.esc(st.cloudState)+'</span>'+sep+
    '<span style="color:var(--t3)">Listener: '+st.listenerCount+'</span>'+sep+
    '<span style="color:var(--t3)">Rev. '+U.esc(String(rev))+'</span>'+sep+
    '<span style="color:var(--t3)">Son kayıt: '+(lastT?U.esc(lastT):'Henüz yok')+'</span>'+sep+
    '<span style="color:var(--t3)">Sürüm: '+U.esc(st.appVersion)+'</span></div>';
  if(!existing){
    var bar=document.createElement('div');
    bar.id='admin-system-status-bar';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');
    bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:120;background:var(--s);border-top:1px solid var(--s2);'+
      'padding:5px 14px;padding-bottom:calc(5px + env(safe-area-inset-bottom,0px));color:var(--t2);box-shadow:0 -1px 4px rgba(0,0,0,.05);overflow-x:auto';
    bar.innerHTML=inner;
    document.body.appendChild(bar);
  }else existing.innerHTML=inner;
  document.body.classList.add('admin-bar-on');
}
window.renderAdminSystemStatusBar=renderAdminSystemStatusBar;

function render(){renderNav();renderPage();if(typeof renderAdminSystemStatusBar==='function')renderAdminSystemStatusBar();}

/* Search */
var srch=document.getElementById('srch');
if(srch)srch.addEventListener('input',function(){searchQ=srch.value;renderPage();});

/* Theme button */
var themeBtn=document.getElementById('theme-btn');
if(themeBtn)themeBtn.addEventListener('click',toggleDark);
var googleAuthBtn=document.getElementById('google-auth-btn');
if(googleAuthBtn)googleAuthBtn.addEventListener('click',connectGoogle);

/* Boot */
applyTheme();
updateClock();
render();
initCloud();
// Dil butonu senkronizasyonu
(function(){
  document.querySelectorAll('.lang-sw button').forEach(function(b){
    b.className = b.dataset.lang === LANG ? 'on' : '';
  });
  var s = document.getElementById('srch');
  if(s) s.placeholder = L('search');
})();

