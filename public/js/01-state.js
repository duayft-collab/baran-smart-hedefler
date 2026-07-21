function loadData(){
  try{
    var s=localStorage.getItem('fu7');
    if(s){
      var p=JSON.parse(s);
      return Object.assign({},INIT,p,{
        routines:Object.assign({},INIT.routines,p.routines||{}),
        stats:Object.assign({},INIT.stats,p.stats||{}),
        compat:Object.assign({},INIT.compat,p.compat||{}),
      });
    }
  }catch(e){}
  return JSON.parse(JSON.stringify(INIT));
}

// ─── Quote helpers ───────────────────────────────────────────────────────────
function rndQuote(cat){
  var pool = cat ? D.quotes.filter(function(q){return q.cat===cat;}) : D.quotes;
  if(!pool.length) pool = D.quotes;
  return pool.length ? pool[Math.floor(Math.random()*pool.length)] : null;
}
function quoteWidget(cat, accent){
  var q = rndQuote(cat);
  if(!q) return '';
  var ac = accent || 'var(--blue)';
  return '<div style="padding:14px 18px;border-radius:12px;background:var(--s2);border-left:3px solid '+ac+';margin-bottom:16px">'
    + '<p style="font-size:13px;font-style:italic;line-height:1.7;color:var(--t)">&ldquo;'+U.esc(q.text)+'&rdquo;</p>'
    + (q.author ? '<p style="font-size:11px;font-weight:700;color:'+ac+';margin-top:6px">&mdash; '+U.esc(q.author)+'</p>' : '')
    + '<p style="font-size:10px;color:var(--t3);margin-top:3px">'+U.esc(q.cat)+'</p></div>';
}
var D=loadData();


var U={
  isoWeek:function(d){var dt=new Date(d.getTime());dt.setHours(0,0,0,0);dt.setDate(dt.getDate()+3-(dt.getDay()+6)%7);var w1=new Date(dt.getFullYear(),0,4);return 1+Math.round(((dt-w1)/86400000-3+(w1.getDay()+6)%7)/7);},
  quarter:function(d){return 'Q'+Math.floor((d.getMonth()+3)/3);},
  fmt:function(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');},
  today:function(){return new Date().toISOString().split('T')[0];},
  ts:function(){return new Date().toLocaleString('tr-TR');},
  isActive:function(p,last){
    if(!last)return true;
    var l=new Date(last),n=new Date();
    if(p==='daily')return l.toDateString()!==n.toDateString();
    if(p==='weekly')return(n-l)>7*864e5;
    if(p==='monthly')return l.getMonth()!==n.getMonth()||l.getFullYear()!==n.getFullYear();
    return true;
  },
  esc:function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');},
  dl:function(data,fn){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=fn;a.click();}
};

/* Icons */
var SV={
  dash:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  tgt:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  kpi:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  trophy:'<path d="M8 21h8M12 17v4M7 4H4a1 1 0 0 0-1 1v3c0 3.3 2.7 6 6 6h6c3.3 0 6-2.7 6-6V5a1 1 0 0 0-1-1h-3"/>',
  zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  flame:'<path d="M12 2C6.5 7 4 10.5 4 14a8 8 0 0 0 16 0c0-5.5-5-10-8-12z"/>',
  csq:'<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  ref:'<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>',
  bk:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  layers:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  arc:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  qt:'<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  sh:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  us:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  hp:'<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  act:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  play:'<polygon points="5 3 19 12 5 21 5 3"/>',
  pause:'<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  rst:'<path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>',
  sun:'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  chk:'<polyline points="20 6 9 17 4 12"/>',
  dl:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a4 4 0 0 1 0 8h-1"/>',
  star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  ci:'<circle cx="12" cy="12" r="10"/>',
  brain:'<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.04z"/>',
  ar:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  vol:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  prn:'<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
};
function ic(n,sz,cl){return '<svg width="'+(sz||16)+'" height="'+(sz||16)+'" viewBox="0 0 24 24" fill="none" stroke="'+(cl||'currentColor')+'" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;flex-shrink:0;vertical-align:middle">'+(SV[n]||'')+'</svg>';}


var tab='dashboard';
var dark=localStorage.getItem('fu7_t')==='1';
var searchQ='';
var hist=[];
var audio=null;
var tmMode='focus',tmLeft=25*60,tmOn=false,tmInt=null;
var TDUR={focus:25*60,short:5*60,long:15*60};
var dwLeft=50*60,dwOn=false,dwInt=null;
var gView=localStorage.getItem('gview')||'grid';
var gFilter='all';
var openGId=null;
var todoView='list';

var SCHEMA_VERSION=3;
var CLOUD={ready:false,uid:null,db:null,auth:null,user:null,timer:null,lastError:null,
  deviceId:null,unsubAuth:null,unsubDoc:null,listenerUid:null,
  revision:0,applyingRemote:false,badgeTimer:null,
  pendingMutation:null,conflict:null,flushing:false,retryTimer:null,lastSavedAt:0};

/* Kalici, kisisel veri icermeyen cihaz kimligi */
function deviceId(){
  if(CLOUD.deviceId)return CLOUD.deviceId;
  var id=localStorage.getItem('fu7_device');
  if(!id){
    id='dev-'+Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);
    try{localStorage.setItem('fu7_device',id);}catch(e){}
  }
  CLOUD.deviceId=id;
  return id;
}
function newMutationId(){return deviceId()+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);}

function cloudBadge(text,state){
  var el=document.getElementById('cloud-sync-status');
  if(!el){
    el=document.createElement('div');el.id='cloud-sync-status';
    el.style.cssText='position:fixed;right:14px;bottom:14px;z-index:9999;padding:7px 10px;border-radius:999px;font:600 11px/1.2 system-ui;background:var(--s2);color:var(--t2);border:1px solid var(--bd);box-shadow:0 6px 22px rgba(0,0,0,.12)';
    document.body.appendChild(el);
  }
  el.textContent=text;
  el.dataset.state=state||'';
}

/* Tek senkronizasyon durum makinesi. Rozet yalnizca buradan guncellenir. */
var SYNC_TEXT={
  connecting:'Bağlanıyor',
  saving:'Kaydediliyor',
  ok:'Bulutta kayıtlı',
  okGoogle:'Google hesabında kayıtlı',
  offline:'Çevrimdışı',
  remote:'Buluttan güncellendi',
  conflict:'Çakışma bulundu',
  error:'Senkronizasyon hatası',
  local:'Yerel mod'
};
function setSync(state){
  if(RESTORE.state!=='IDLE')return;         // geri yukleme kendi rozetini yonetir
  clearTimeout(CLOUD.badgeTimer);
  if(CLOUD.conflict&&state!=='conflict')state='conflict'; // cakisma cozulmeden durum degismez
  var key=state;
  if(state==='ok'&&CLOUD.user&&!CLOUD.user.isAnonymous)key='okGoogle';
  cloudBadge(SYNC_TEXT[key]||SYNC_TEXT.ok,state);
  if(state==='remote'){
    CLOUD.badgeTimer=setTimeout(function(){setSync('ok');},2500);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   D5 — RESTORE LOCK DURUM MAKINESI
   Geri yukleme sirasinda tum mutasyon yollarini bloke eder. Kilit yalniz
   bellektedir; localStorage'a kalici kilit yazilmaz (sekme cokerse kilit kalmaz).
   Bu turda GERCEK restore YOK; yalniz altyapi ve kilit.
   ══════════════════════════════════════════════════════════════════════════ */
var RESTORE_WATCHDOG_MS=60000;
var RESTORE_STATES=['IDLE','PREPARING','VERIFYING','PREVIEW','AWAITING_CONFIRM',
  'SAFEGUARDING','COMMITTING','FINALIZING','FAILED'];
// Gecis matrisi tek yerde. FAILED her aktif asamadan failRestoreSession ile erisilir.
var RESTORE_TRANSITIONS={
  IDLE:['PREPARING'],
  PREPARING:['VERIFYING','FAILED','IDLE'],
  VERIFYING:['PREVIEW','FAILED','IDLE'],
  PREVIEW:['AWAITING_CONFIRM','FAILED','IDLE'],
  AWAITING_CONFIRM:['SAFEGUARDING','FAILED','IDLE'], // kullanici iptal -> IDLE
  SAFEGUARDING:['COMMITTING','FAILED'],
  COMMITTING:['FINALIZING','FAILED'],
  FINALIZING:['IDLE','FAILED'],
  FAILED:['IDLE']
};
// Asama basi watchdog. AWAITING_CONFIRM kullanici karari bekler -> watchdog kapali.
// COMMITTING gercek transaction; Firestore 270s ustunde tutulur, korlemesine kesilmez.
var RESTORE_WATCHDOG={PREPARING:RESTORE_WATCHDOG_MS,VERIFYING:RESTORE_WATCHDOG_MS,
  PREVIEW:RESTORE_WATCHDOG_MS,AWAITING_CONFIRM:0,SAFEGUARDING:RESTORE_WATCHDOG_MS,
  COMMITTING:300000,FINALIZING:RESTORE_WATCHDOG_MS};
var RESTORE_TEXT={PREPARING:'Geri yükleme hazırlanıyor',VERIFYING:'Yedek doğrulanıyor',
  PREVIEW:'Geri yükleme önizlemesi hazırlanıyor',AWAITING_CONFIRM:'Onay bekleniyor',
  SAFEGUARDING:'Güvenlik yedeği alınıyor',COMMITTING:'Geri yükleme uygulanıyor',
  FINALIZING:'Son kontroller yapılıyor',FAILED:'Geri yükleme başarısız',IDLE:null};

var RESTORE={state:'IDLE',startedAt:0,stageStartedAt:0,lastError:null,watchdogTimer:null,
  operationId:null,context:null,deferredRemoteSnapshot:null,commitUncertain:false,lastResult:null};

var _restoreBadgeState=null;
function restoreBadge(state){
  if(_restoreBadgeState===state)return;     // ayni state icin tekrar basma
  _restoreBadgeState=state;
  var t=RESTORE_TEXT[state];
  if(t)cloudBadge(t,'restore');
  else if(state==='IDLE')setSync(navigator.onLine?'ok':'offline'); // normale don
}
function getRestoreState(){return RESTORE.state;}
function isRestoreLocked(){return RESTORE.state!=='IDLE';}
function canTransitionRestore(from,to){
  if(RESTORE_STATES.indexOf(to)<0)return false;
  return (RESTORE_TRANSITIONS[from]||[]).indexOf(to)>=0;
}
function transitionRestore(next,context){
  if(RESTORE_STATES.indexOf(next)<0)throw new Error('Bilinmeyen restore durumu: '+next);
  var cur=RESTORE.state;
  if(next===cur)return false;               // gereksiz tekrar gecis
  if(!canTransitionRestore(cur,next))throw new Error('Geçersiz restore geçişi: '+cur+' -> '+next);
  RESTORE.state=next;
  RESTORE.stageStartedAt=Date.now();
  if(context!==undefined)RESTORE.context=context;
  restoreBadge(next);
  if(next==='IDLE'||next==='FAILED')stopRestoreWatchdog();
  else startRestoreWatchdog();
  console.log('[RESTORE] '+cur+' -> '+next);
  return true;
}
function beginRestoreSession(context){
  if(RESTORE.state!=='IDLE')throw new Error('Zaten bir geri yükleme oturumu var: '+RESTORE.state);
  RESTORE.operationId=newMutationId();
  RESTORE.startedAt=Date.now();
  RESTORE.lastError=null;RESTORE.commitUncertain=false;RESTORE.lastResult=null;
  RESTORE.deferredRemoteSnapshot=null;
  transitionRestore('PREPARING',context||null);
  console.log('[RESTORE] Oturum başladı:',RESTORE.operationId);
  return RESTORE.operationId;
}
function failRestoreSession(error){
  RESTORE.lastError=error||new Error('Bilinmeyen geri yükleme hatası');
  if(RESTORE.state!=='FAILED'&&RESTORE.state!=='IDLE'){
    RESTORE.state='FAILED';RESTORE.stageStartedAt=Date.now();
    stopRestoreWatchdog();restoreBadge('FAILED');
    console.error('[RESTORE] Başarısız:',RESTORE.lastError.message);
  }
  return RESTORE.state;
}
function finishRestoreSession(result){
  RESTORE.lastResult=result||'success';
  if(result==='uncertain')RESTORE.commitUncertain=true; // kor basari deme
  console.log('[RESTORE] Oturum sonucu:',RESTORE.lastResult);
  resetRestoreSession();
  return RESTORE.lastResult;
}
function resetRestoreSession(){
  stopRestoreWatchdog();
  RESTORE.state='IDLE';RESTORE.stageStartedAt=Date.now();
  RESTORE.operationId=null;RESTORE.context=null;RESTORE.deferredRemoteSnapshot=null;
  restoreBadge('IDLE');
}
function startRestoreWatchdog(){
  stopRestoreWatchdog();
  var ms=RESTORE_WATCHDOG[RESTORE.state];
  if(!ms)return;                            // IDLE / AWAITING_CONFIRM / FAILED -> watchdog yok
  var opId=RESTORE.operationId;
  RESTORE.watchdogTimer=setTimeout(function(){
    if(opId!==RESTORE.operationId)return;    // eski timer yeni oturumu etkilemez
    console.warn('[RESTORE] Watchdog: '+RESTORE.state+' zaman aşımı');
    if(RESTORE.state==='COMMITTING'){
      // gercek transaction devam ediyor olabilir; korlemesine IDLE yapma
      RESTORE.commitUncertain=true;
      RESTORE.lastError=new Error('Commit zaman aşımı; sonuç belirsiz');
    }else{
      failRestoreSession(new Error(RESTORE.state+' aşamasında zaman aşımı'));
    }
  },ms);
}
function stopRestoreWatchdog(){
  if(RESTORE.watchdogTimer){clearTimeout(RESTORE.watchdogTimer);RESTORE.watchdogTimer=null;}
}
var _restoreWarnAt=0;
function assertRestoreIdle(actionName){
  if(RESTORE.state==='IDLE')return true;
  var now=Date.now();
  if(now-_restoreWarnAt>2000){              // ayni olay icin tekrar toast basma
    _restoreWarnAt=now;
    cloudBadge('Geri yükleme devam ediyor','restore');
    console.warn('[RESTORE] Engellendi ('+RESTORE.state+'):',actionName);
  }
  return false;
}
function withRestoreLock(stage,fn){
  return Promise.resolve().then(function(){
    if(!canTransitionRestore(RESTORE.state,stage))
      throw new Error('withRestoreLock geçersiz aşama: '+RESTORE.state+' -> '+stage);
    transitionRestore(stage);
    return fn();
  }).then(function(res){return {status:'success',result:res};})
    .catch(function(e){failRestoreSession(e);return {status:'failed',error:e};});
}
/* D6 finalizasyonda cagrilacak; bu turda OTOMATIK cagrilmaz. */
function clearPendingForRestore(){
  CLOUD.pendingMutation=null;
  clearTimeout(CLOUD.timer);clearTimeout(CLOUD.retryTimer);
  try{localStorage.removeItem('fu7_pending_mutation');}catch(e){}
}
function clearUndoHistoryForRestore(){hist=[];}
function updateAuthButton(user){
  var btn=document.getElementById('google-auth-btn');
  if(!btn)return;
  if(user&&!user.isAnonymous){
    btn.textContent=user.displayName||user.email||'Google bağlı';
    btn.title=(user.email||'Google hesabı')+' bağlı';
    btn.disabled=true;
    btn.style.opacity='.85';
  }else{
    btn.textContent='Google ile bağla';
    btn.title='Verileri Google hesabına bağla';
    btn.disabled=false;
    btn.style.opacity='1';
  }
}
function localStamp(){return Number(localStorage.getItem('fu7_cloud_ts')||0);}
function localRevision(){return Number(localStorage.getItem('fu7_rev')||0);}
function writeLocal(ts){
  try{
    localStorage.setItem('fu7',JSON.stringify(D));
    if(ts)localStorage.setItem('fu7_cloud_ts',String(ts));
    localStorage.setItem('fu7_rev',String(CLOUD.revision||0));
  }catch(e){console.warn('[SYNC] Yerel kayıt başarısız',e);}
}
/* Uzak payload'dan yerel state uretir. Saf: D'ye dokunmaz.
   Karsilastirmada da kullanilir; boylece INIT ile birlesmeden dogan alan farki
   sahte tutarsizlik uretmez. */
function buildStateFromPayload(payload){
  return Object.assign({},INIT,payload||{}, {
    routines:Object.assign({},INIT.routines,(payload&&payload.routines)||{}),
    stats:Object.assign({},INIT.stats,(payload&&payload.stats)||{}),
    compat:Object.assign({},INIT.compat,(payload&&payload.compat)||{})
  });
}
function mergeRemotePayload(payload){D=buildStateFromPayload(payload);}
/* Uzak payload ile mevcut yerel state ayni mi? Anahtar sirasina duyarli
   JSON.stringify kullanilmaz. Her iki taraf da bir kez serilestirlir. */
function samePayloadAsLocal(payload){
  try{return canonicalStringify(buildStateFromPayload(payload))===canonicalStringify(D);}
  catch(e){console.warn('[SYNC] Payload karşılaştırılamadı',e);return false;}
}
function stateRef(uid){return CLOUD.db.collection('users').doc(uid).collection('app').doc('state');}
/* ── Pending mutation ──────────────────────────────────────────────────────
   CLOUD.revision YALNIZ dogrulanmis sunucu revision'ini temsil eder.
   Yerel kayitta asla erken artirilmaz; yalniz basarili commit sonrasi guncellenir. */
function newPendingMutation(){
  var now=Date.now();
  return {id:newMutationId(),expectedRevision:CLOUD.revision||0,
    payload:JSON.parse(JSON.stringify(D)),createdAt:now,updatedAt:now};
}
function savePending(){
  try{
    if(CLOUD.pendingMutation)localStorage.setItem('fu7_pending_mutation',JSON.stringify(CLOUD.pendingMutation));
    else localStorage.removeItem('fu7_pending_mutation');
  }catch(e){console.warn('[SYNC] Bekleyen değişiklik saklanamadı',e);}
}
function loadPending(){
  try{
    var s=localStorage.getItem('fu7_pending_mutation');
    if(!s)return null;
    var m=JSON.parse(s);
    if(!m||!m.id||typeof m.expectedRevision!=='number'||!m.payload)return null;
    return m;
  }catch(e){return null;}
}

/* Transaction. Callback SAF olmalidir: DOM/render/localStorage/yeni id YOK.
   Firestore contention'da callback'i tekrar calistirabilir. */
