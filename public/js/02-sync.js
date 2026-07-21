function commitMutation(m){
  var ref=stateRef(CLOUD.uid),uid=CLOUD.uid,dev=deviceId();
  return CLOUD.db.runTransaction(function(t){
    return t.get(ref).then(function(doc){
      var d=doc.exists?(doc.data()||{}):null;
      var serverRev=d?Number(d.revision||0):0;
      // Ayni mutation zaten yazilmis: tekrar yazma, basarili say
      if(d&&d.lastMutationId&&d.lastMutationId===m.id)return {status:'duplicate',revision:serverRev};
      // schemaVersion 2 belgesinde revision yok -> 0 kabul edilir, geriye uyumlu
      if(serverRev!==m.expectedRevision)return {status:'conflict',serverData:d,serverRevision:serverRev};
      t.set(ref,{
        payload:m.payload,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
        revision:serverRev+1,
        updatedByUid:uid,
        updatedByDeviceId:dev,
        lastMutationId:m.id,
        schemaVersion:SCHEMA_VERSION,
        clientUpdatedAt:m.createdAt // debug amacli
      },{merge:true});
      return {status:'ok',revision:serverRev+1};
    });
  });
}
function scheduleRetry(ms){
  clearTimeout(CLOUD.retryTimer);
  CLOUD.retryTimer=setTimeout(flushPending,ms||8000);
}
function flushPending(){
  if(RESTORE.state!=='IDLE')return;         // restore kilidi: transaction/retry yok
  if(CLOUD.flushing||!CLOUD.pendingMutation)return;
  if(!CLOUD.ready||!CLOUD.db||!CLOUD.uid)return;
  if(CLOUD.conflict){setSync('conflict');return;}
  if(!navigator.onLine){setSync('offline');scheduleRetry();return;} // offline'da transaction zorlanmaz
  CLOUD.flushing=true;
  var m=CLOUD.pendingMutation;
  commitMutation(m).then(function(res){
    CLOUD.flushing=false;
    if(res.status==='conflict'){
      console.warn('[SYNC] Çakışma: sunucu revision',res.serverRevision,'beklenen',m.expectedRevision);
      enterConflict(res.serverData,m);
      return;
    }
    CLOUD.revision=Number(res.revision||0);
    CLOUD.lastSavedAt=Date.now(); // FAZ-5B: admin cubugu icin son basarili commit zamani (lokal, write yok)
    localStorage.setItem('fu7_rev',String(CLOUD.revision));
    // Commit sirasinda yeni kullanici degisikligi geldiyse pending'i silme
    if(CLOUD.pendingMutation&&CLOUD.pendingMutation.id===m.id){CLOUD.pendingMutation=null;savePending();}
    else savePending();
    console.log('[SYNC] Commit '+res.status+'. revision:',CLOUD.revision);
    setSync('ok');
    if(typeof renderAdminSystemStatusBar==='function')renderAdminSystemStatusBar(); // FAZ-5B: commit sonrasi durum guncelle
    if(CLOUD.pendingMutation)flushPending(); // birikmis yeni degisiklik varsa devam et
  }).catch(function(e){
    CLOUD.flushing=false;CLOUD.lastError=e;
    console.error('[FIRESTORE] Transaction hatası',e);
    setSync(navigator.onLine?'error':'offline');
    scheduleRetry();
  });
}
function queueCloudSave(bypassLock){
  if(RESTORE.state!=='IDLE'&&!bypassLock)return; // restore kilidi: yeni pending/yazma yok
  if(!CLOUD.ready||!CLOUD.db||!CLOUD.uid)return;
  if(CLOUD.applyingRemote)return;         // uzak veri uygulanirken geri yazma yok
  // Pending payload HER durumda tazelenir. Cakismada yalniz BULUT YAZMASI bloke edilir;
  // boylece cakisma acikken yapilan degisiklik pending'e islenir ve kaybolmaz.
  if(CLOUD.pendingMutation){
    CLOUD.pendingMutation.payload=JSON.parse(JSON.stringify(D)); // derin kopya, D ile paylasimsiz
    // Payload degisti -> bu artik yeni bir mantiksal mutation. Ayni id ile gonderilirse
    // sunucudaki lastMutationId eslesmesi yeni veriyi yanlislikla duplicate sayabilir.
    CLOUD.pendingMutation.id=newMutationId();
    CLOUD.pendingMutation.updatedAt=Date.now();
  }else{
    CLOUD.pendingMutation=newPendingMutation();
  }
  savePending();
  if(CLOUD.conflict){                     // cakisma cozulmeden buluta yazilmaz
    CLOUD.conflict.mutation=CLOUD.pendingMutation;
    setSync('conflict');
    return;
  }
  clearTimeout(CLOUD.timer);
  setSync('saving');
  CLOUD.timer=setTimeout(flushPending,500);
}
function save(opts){
  opts=opts||{};
  // Restore kilidi. Bypass yalniz dogrulanmis dahili restore cagrisi icin (operationId eslesmeli).
  // Kullanici aksiyonlari save()'i argumansiz cagirir; bypass edemez.
  var bypass=opts.source==='restore'&&opts.bypassRestoreLock===true&&
    RESTORE.operationId&&opts.operationId===RESTORE.operationId;
  if(RESTORE.state!=='IDLE'&&!bypass){assertRestoreIdle('save');return;}
  writeLocal(Date.now());
  queueCloudSave(bypass);
}

/* ── Gercek zamanli listener ───────────────────────────────────────────────── */
function stopDocListener(){
  if(CLOUD.unsubDoc){
    console.log('[SYNC] Listener kapatıldı:',CLOUD.listenerUid);
    CLOUD.unsubDoc();
  }
  CLOUD.unsubDoc=null;CLOUD.listenerUid=null;
  if(typeof renderAdminSystemStatusBar==='function')renderAdminSystemStatusBar(); // FAZ-5B.1: listener durdu -> cubugu aninda guncelle
}
function startDocListener(uid){
  if(CLOUD.listenerUid===uid&&CLOUD.unsubDoc)return; // tekrar kurulum yok
  stopDocListener();
  CLOUD.listenerUid=uid;
  console.log('[SYNC] Listener kuruldu:',uid);
  CLOUD.unsubDoc=stateRef(uid).onSnapshot({includeMetadataChanges:true},onRemoteSnapshot,function(e){
    CLOUD.lastError=e;
    console.error('[SYNC] Listener hatası',e);
    setSync('error');
  });
  if(typeof renderAdminSystemStatusBar==='function')renderAdminSystemStatusBar(); // FAZ-5B.1: listener baglandi -> cubugu aninda guncelle
}
function onRemoteSnapshot(snap){
  var md=snap.metadata;
  if(md.hasPendingWrites)return;            // kendi yazmamiz, sunucuya ulasmadi
  if(md.fromCache){setSync('offline');return;} // sunucu dogrulamasi yok
  if(RESTORE.state!=='IDLE'){
    // Restore kilidi: uzak veri uygulanmaz, revision degismez, render tetiklenmez.
    // Yalniz en son sunucu-dogrulanmis payload tamponlanir (D6 karar verir).
    if(snap.exists){var d0=snap.data()||{};
      if(d0.payload)RESTORE.deferredRemoteSnapshot={
        payload:JSON.parse(JSON.stringify(d0.payload)),revision:Number(d0.revision||0),at:Date.now()};}
    return;
  }
  if(!snap.exists){setSync('ok');return;}
  var data=snap.data()||{};
  if(!data.payload){setSync('ok');return;}
  var remoteRev=Number(data.revision||0);
  if(data.updatedByDeviceId===deviceId()){  // kendi yazmamizin sunucu yankisi
    CLOUD.revision=Math.max(CLOUD.revision||0,remoteRev);
    localStorage.setItem('fu7_rev',String(CLOUD.revision));
    setSync('ok');return;
  }
  if(remoteRev<=(CLOUD.revision||0)){setSync('ok');return;} // eski/ilk snapshot yereli ezmez
  if(CLOUD.conflict)return;                 // kullanici karar veriyor, uzerine yazma
  // Bekleyen yerel degisiklik varken uzak veri KORLEMESINE uygulanmaz
  if(CLOUD.pendingMutation){enterConflict(data,CLOUD.pendingMutation);return;}
  applyRemoteState(data);
}

/* ── Cakisma yonetimi ─────────────────────────────────────────────────────── */
function enterConflict(serverData,m){
  CLOUD.conflict={serverData:serverData||null,mutation:m};
  clearTimeout(CLOUD.timer);clearTimeout(CLOUD.retryTimer);
  console.warn('[SYNC] Çakışma bulundu. Kullanıcı kararı bekleniyor.');
  setSync('conflict');
  showConflictUI();
}
function conflictLoadRemote(){
  if(!assertRestoreIdle('conflictLoadRemote'))return; // restore kilidi
  if(!CLOUD.conflict)return;
  var srv=CLOUD.conflict.serverData;
  if(!srv||!srv.payload){console.warn('[SYNC] Sunucu sürümü okunamadı');return;}
  // Ezmeden once yerel state'in guvenli kopyasi
  try{localStorage.setItem('fu7_conflict_backup',JSON.stringify({at:Date.now(),payload:D}));}catch(e){}
  CLOUD.applyingRemote=true;
  try{
    mergeRemotePayload(srv.payload);
    CLOUD.revision=Number(srv.revision||0);
    CLOUD.pendingMutation=null;savePending();
    writeLocal(Date.now());
    CLOUD.conflict=null;hideConflictUI();
    render();                               // tek render, geri yazma yok
    console.log('[SYNC] Buluttaki sürüm yüklendi. revision:',CLOUD.revision);
    setSync('ok');
  }catch(e){
    CLOUD.lastError=e;console.error('[SYNC] Sunucu sürümü uygulanamadı',e);setSync('error');
  }finally{CLOUD.applyingRemote=false;}
}
function conflictKeepLocal(){
  if(!assertRestoreIdle('conflictKeepLocal'))return; // restore kilidi
  if(!CLOUD.conflict)return;
  var srv=CLOUD.conflict.serverData,m=CLOUD.conflict.mutation;
  // Yeni sunucu revision'i baz alinarak yeniden dene. Payload en guncel yerel state'tir;
  // icerik degistigi icin yeni mutationId uretilir (duplicate yanlis eslesmesini onler).
  m.expectedRevision=srv?Number(srv.revision||0):0;
  m.payload=JSON.parse(JSON.stringify(D));
  m.id=newMutationId();
  m.updatedAt=Date.now();
  CLOUD.pendingMutation=m;savePending();
  CLOUD.conflict=null;hideConflictUI();
  console.log('[SYNC] Yerel değişiklik yeniden deneniyor. expectedRevision:',m.expectedRevision);
  setSync('saving');
  flushPending();                           // tekrar cakisirsa yine uyari cikar
}
window.conflictLoadRemote=conflictLoadRemote;
window.conflictKeepLocal=conflictKeepLocal;

function showConflictUI(){
  if(document.getElementById('sync-conflict'))return;
  var w=document.createElement('div');w.id='sync-conflict';
  w.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;'
    +'align-items:center;justify-content:center;padding:16px';
  var b=document.createElement('div');
  b.style.cssText='background:var(--s);color:var(--t);border:1px solid var(--bd);border-radius:14px;'
    +'max-width:440px;width:100%;max-height:85vh;overflow-y:auto;padding:22px;'
    +'box-shadow:0 18px 50px rgba(0,0,0,.28);font:400 13px/1.6 system-ui';
  b.innerHTML='<p style="font-size:15px;font-weight:700;margin-bottom:8px">Başka bir cihazda daha yeni değişiklik bulundu.</p>'
    +'<p style="color:var(--t2);margin-bottom:18px">Değişiklikleriniz bu cihazda korunuyor. '
    +'Buluttaki son sürümü inceleyip yeniden deneyin.</p>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
    +'<button type="button" class="btn btn-s" onclick="conflictLoadRemote()" style="flex:1;min-width:150px">Buluttaki sürümü yükle</button>'
    +'<button type="button" class="btn btn-s" onclick="conflictKeepLocal()" style="flex:1;min-width:150px">Bu cihazdaki değişikliği koru</button>'
    +'</div>';
  w.appendChild(b);
  document.body.appendChild(w);
}
function hideConflictUI(){
  var el=document.getElementById('sync-conflict');
  if(el&&el.parentNode)el.parentNode.removeChild(el);
}
function applyRemoteState(data){
  CLOUD.applyingRemote=true;
  try{
    mergeRemotePayload(data.payload);
    CLOUD.revision=Number(data.revision||0);
    writeLocal(Date.now());
    render();
    console.log('[SYNC] Buluttan güncellendi. revision:',CLOUD.revision);
    setSync('remote');
  }catch(e){
    CLOUD.lastError=e;
    console.error('[SYNC] Uzak veri uygulanamadı',e);
    setSync('error');
  }finally{
    CLOUD.applyingRemote=false;
  }
}
/* Acilis uzlasmasi. Otorite sirasi: revision > eski belgelerde clientUpdatedAt > yerel. */
