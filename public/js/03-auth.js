async function bootstrapUser(user){
  CLOUD.ready=false;
  CLOUD.revision=localRevision();
  CLOUD.pendingMutation=loadPending(); // sayfa yenilemesinde korunan bekleyen degisiklik
  var ref=stateRef(user.uid);
  var snap=await ref.get();
  var remote=snap.exists?snap.data():null;
  var remoteRev=remote?Number(remote.revision||0):0;

  // Bekleyen degisiklik varsa yerel state onun payload'idir; buluta korlemesine devretme.
  if(CLOUD.pendingMutation&&remote&&remote.payload){
    CLOUD.ready=true;
    if(remoteRev===CLOUD.pendingMutation.expectedRevision){
      CLOUD.revision=remoteRev;
      console.log('[SYNC] Bekleyen değişiklik geri yüklendi, gönderiliyor.');
      if(!user.isAnonymous)startDocListener(user.uid);
      flushPending();
      return;
    }
    CLOUD.revision=remoteRev;
    if(!user.isAnonymous)startDocListener(user.uid);
    enterConflict(remote,CLOUD.pendingMutation); // sunucu ilerlemis
    return;
  }

  if(remote&&remote.payload){
    /* Karar matrisi:
       B  remoteRev > localRev            -> uzak otorite, uygula, YAZMA YOK
       D  remoteRev === localRev, ayni    -> HICBIR YAZMA, yalniz listener
       E  remoteRev === localRev, farkli  -> veri tutarsizligi, sessiz ezme YOK
       C  remoteRev < localRev            -> yerel gercekten yeni, transaction */
    var takeRemote,equalRev=false;
    if(remoteRev>0){
      takeRemote=remoteRev>CLOUD.revision;
      equalRev=remoteRev===CLOUD.revision;
    }else{
      // schemaVersion 2 belgesi: revision yok, eski davranisa geri dus
      takeRemote=Number(remote.clientUpdatedAt||0)>localStamp();
    }
    if(CLOUD.revision===0&&localStamp()===0){takeRemote=true;equalRev=false;} // bos cihaz dolu bulutu ezmez
    if(takeRemote){
      CLOUD.applyingRemote=true;
      try{
        mergeRemotePayload(remote.payload);
        CLOUD.revision=remoteRev;
        writeLocal(Date.now());
        render();
      }finally{CLOUD.applyingRemote=false;}
      console.log('[SYNC] Açılışta bulut verisi alındı. revision:',CLOUD.revision);
    }else if(equalRev){
      CLOUD.revision=remoteRev;
      CLOUD.ready=true;
      if(samePayloadAsLocal(remote.payload)){
        // D: sunucu ve yerel ayni. Yazma yok, revision artmaz, mutationId uretilmez.
        if(!user.isAnonymous)startDocListener(user.uid);
        else console.log('[SYNC] Anonim oturum, gerçek zamanlı listener kurulmadı');
        console.log('[SYNC] Açılışta yerel ve bulut aynı. revision:',CLOUD.revision);
        setSync(navigator.onLine?'ok':'offline');
        return;
      }
      // E: ayni revision farkli icerik -> hangisinin dogru oldugu bilinemez
      console.warn('[SYNC] Aynı revision, farklı içerik. Kullanıcı kararı isteniyor.');
      if(!user.isAnonymous)startDocListener(user.uid);
      enterConflict(remote,newPendingMutation());
      return;
    }else{
      // C: yerel daha yeni, transaction ile yukselt
      CLOUD.revision=remoteRev;
      CLOUD.ready=true;
      CLOUD.pendingMutation=newPendingMutation();savePending();
      if(!user.isAnonymous)startDocListener(user.uid);
      flushPending();
      return;
    }
  }else{
    // Belge yok: ilk kurulum, expectedRevision 0
    CLOUD.revision=0;
    CLOUD.ready=true;
    CLOUD.pendingMutation=newPendingMutation();savePending();
    if(!user.isAnonymous)startDocListener(user.uid);
    flushPending();
    return;
  }

  CLOUD.ready=true;
  // Listener yalnizca Google kullanicisi icin. Anonim oturumda kurulmaz.
  if(!user.isAnonymous)startDocListener(user.uid);
  else console.log('[SYNC] Anonim oturum, gerçek zamanlı listener kurulmadı');
  setSync(navigator.onLine?'ok':'offline');
}

function handleAuthChange(user){
  if(!user){
    console.log('[AUTH] Oturum yok');
    if(RESTORE.state!=='IDLE'){failRestoreSession(new Error('Oturum kapandı'));resetRestoreSession();}
    if(typeof RS!=='undefined')RS=null; // D6: logout aktif restore oturumunu temizler
    stopDocListener();
    if(typeof clearNoteDraft==='function'){clearNoteDraft();noteEditGid=null;} // FAZ-4.1: logout'ta taslak temizle
    if(typeof gnClearDraft==='function')gnClearDraft(); // FAZ-6: logout'ta genel not taslagi temizle
    if(typeof wqClearDraft==='function')wqClearDraft(); // D10.1: logout'ta söz taslagi temizle
    if(typeof pClearDraft==='function')pClearDraft(); // D10.5.1: logout'ta ilke taslagi temizle
    CLOUD.user=null;CLOUD.uid=null;CLOUD.ready=false;
    updateAuthButton(null);
    if(typeof resetAdminUI==='function')resetAdminUI(); // FAZ-5B: logout'ta admin cubugu kaldir
    return;
  }
  if(CLOUD.uid===user.uid){CLOUD.user=user;updateAuthButton(user);if(typeof resolveCurrentAdminClaim==='function')resolveCurrentAdminClaim();return;} // ayni kullanici
  if(typeof clearNoteDraft==='function'){clearNoteDraft();noteEditGid=null;} // FAZ-4.1: UID degisiminde taslak baska hesaba tasinmaz
  if(typeof resetAdminUI==='function')resetAdminUI(); // FAZ-5B: UID degisti -> onceki admin durumunu sifirla (yeni UID icin yeniden coz)
  if(typeof gnClearDraft==='function')gnClearDraft(); // FAZ-6: UID degisiminde genel not taslagi temizle
  if(typeof wqClearDraft==='function')wqClearDraft(); // D10.1: UID degisiminde söz taslagi temizle
  if(typeof pClearDraft==='function')pClearDraft(); // D10.5.1: UID degisiminde ilke taslagi temizle
  console.log('[AUTH] Kullanıcı değişti:',user.uid,user.isAnonymous?'(anonim)':'(google)');
  if(RESTORE.state!=='IDLE'){failRestoreSession(new Error('Kullanıcı değişti'));resetRestoreSession();}
  if(typeof RS!=='undefined')RS=null; // D6: UID degisiminde aktif restore oturumunu temizler
  stopDocListener(); // UID degistiyse eski listener mutlaka kapanir
  CLOUD.user=user;CLOUD.uid=user.uid;
  updateAuthButton(user);
  if(typeof resolveCurrentAdminClaim==='function')resolveCurrentAdminClaim(); // FAZ-5B: yeni kullanici icin admin claim'i coz
  bootstrapUser(user).catch(function(e){
    CLOUD.lastError=e;
    console.error('[SYNC] Açılış senkronizasyonu başarısız',e);
    setSync('error');
  });
}

async function connectGoogle(){
  if(!CLOUD.auth)return;
  if(CLOUD.auth.currentUser&&!CLOUD.auth.currentUser.isAnonymous)return; // zaten bagli
  var btn=document.getElementById('google-auth-btn');
  if(btn){btn.disabled=true;btn.textContent='Google açılıyor…';}
  setSync('connecting');
  var provider=new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  try{
    // Her cihaz aynı Google hesabına girer, böylece UID her cihazda aynıdır.
    // Sonraki adımları onAuthStateChanged üstlenir.
    await CLOUD.auth.signInWithPopup(provider);
  }catch(e){
    if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request'){
      setSync('ok');
    }else{
      console.error('[AUTH] Google giriş hatası',e);
      setSync('error');
    }
    updateAuthButton(CLOUD.auth.currentUser);
  }
}
window.connectGoogle=connectGoogle;

async function initCloud(){
  setSync('connecting');
  deviceId();
  try{
    var cfg=await fetch('/__/firebase/init.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('Firebase yapılandırması alınamadı');return r.json();});
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    CLOUD.auth=firebase.auth();
    CLOUD.db=firebase.firestore();

    await CLOUD.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    try{
      await CLOUD.db.enablePersistence({synchronizeTabs:true});
      console.log('[FIRESTORE] Offline persistence açık');
    }catch(e){
      if(e.code==='failed-precondition')console.warn('[FIRESTORE] Persistence açılamadı: başka sekme kilitli tutuyor');
      else if(e.code==='unimplemented')console.warn('[FIRESTORE] Persistence bu tarayıcıda desteklenmiyor');
      else console.warn('[FIRESTORE] Persistence hatası',e);
    }

    // Kalici auth dinleyicisi. Tek kez kurulur, oturum degisimlerini izlemeye devam eder.
    if(!CLOUD.unsubAuth)CLOUD.unsubAuth=CLOUD.auth.onAuthStateChanged(handleAuthChange,function(e){
      CLOUD.lastError=e;
      console.error('[AUTH] Dinleyici hatası',e);
    });

    // Ilk callback'i bekle; kullanici yoksa anonim oturum ac.
    await new Promise(function(resolve){
      var done=false;
      var stop=CLOUD.auth.onAuthStateChanged(function(u){
        if(done)return;done=true;stop();
        if(!u)CLOUD.auth.signInAnonymously().catch(function(e){console.error('[AUTH] Anonim giriş hatası',e);});
        resolve();
      });
    });
  }catch(e){
    CLOUD.lastError=e;
    console.error('[FIRESTORE] Başlatma hatası',e);
    setSync('local');
  }
}

// Ag durumu yalnizca yardimci gostergedir; otorite Firestore metadata'sidir.
window.addEventListener('offline',function(){if(CLOUD.ready)setSync('offline');if(typeof renderAdminSystemStatusBar==='function')renderAdminSystemStatusBar();});
window.addEventListener('online',function(){
  if(typeof renderAdminSystemStatusBar==='function')renderAdminSystemStatusBar();
  if(!CLOUD.ready)return;
  setSync('ok');
  if(CLOUD.pendingMutation&&!CLOUD.conflict)flushPending(); // bekleyen degisikligi yeniden dene
});
window.addEventListener('beforeunload',function(){stopDocListener();stopRestoreWatchdog();});

/* ══════════════════════════════════════════════════════════════════════════
   BACKUP ALTYAPISI (D1 temel · D2 yazma · D3 dogrulama)
   Yollar: users/{uid}/backups/{id}  ve  users/{uid}/backups/{id}/blob/data
   Restore ve UI bu turda YOK.
   ══════════════════════════════════════════════════════════════════════════ */
var APP_VERSION='2026.07-d10-5-2';   // uygulamada onceden surum sabiti yoktu; proje ici acik surum
var BACKUP_VERSION=1;           // yedek zarf formati surumu (sharding'e gecis icin)
var BACKUP_REASONS=['manual','before_restore','before_conflict_overwrite','before_import',
  'before_migration','before_bulk_delete','daily','migration'];
var STAGING_KEY='fu7_backup_staging';

var BACKUP={
  LABEL_MAX:60, NOTE_MAX:500,
  DEDUP_WINDOW_MS:5*60*1000,
  ROTATE_MAX_DELETE:5,
  KEEP:{manual:10, emergency:10, emergencyMinAgeMs:30*24*3600*1000,
        dailyDaily:7, dailyWeekly:4, dailyMonthly:6},
  VERIFY_FRESH_MS:30*24*3600*1000, VERIFY_STALE_MS:90*24*3600*1000
};

/* ── D1: kanonik JSON ─────────────────────────────────────────────────────
   Ayni veri her cihazda ayni bayt dizisine serilesmelidir; aksi halde hash
   dogrulamasi saglam yedekleri bozuk sanar. */
function canonicalize(v,seen){
  seen=seen||[];
  var t=typeof v;
  if(t==='function'||t==='symbol')throw new Error('Desteklenmeyen tip: '+t);
  if(t==='number'&&!isFinite(v))throw new Error('NaN/Infinity serilestirilemez');
  if(v===null||t!=='object')return v;
  if(seen.indexOf(v)>=0)throw new Error('Dairesel referans');
  seen=seen.concat([v]);
  if(Array.isArray(v))return v.map(function(x){
    return x===undefined?null:canonicalize(x,seen); });   // dizide undefined -> null
  var out={},keys=Object.keys(v).sort();
  for(var i=0;i<keys.length;i++){
    var val=v[keys[i]];
    if(val===undefined)continue;                          // nesnede undefined -> alan dusurulur
    out[keys[i]]=canonicalize(val,seen);
  }
  return out;
}
function canonicalStringify(v){return JSON.stringify(canonicalize(v));}

/* ── D1: SHA-256 (secure context zorunlu) ────────────────────────────────── */
