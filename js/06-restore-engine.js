async function restorePrecheck(backupId,opts){
  opts=opts||{};
  if(!CLOUD.user||!CLOUD.uid)return restoreErr('AUTH_REQUIRED','Oturum gerekli');
  if(!CLOUD.ready||!CLOUD.db)return restoreErr('PRECHECK_FAILED','Bulut bağlantısı hazır değil');
  if(!navigator.onLine)return restoreErr('OFFLINE','Çevrimdışı');
  if(CLOUD.conflict)return restoreErr('CONFLICT_ACTIVE','Aktif çakışma var');
  if(CLOUD.pendingMutation||loadPending())return restoreErr('PENDING_MUTATION','Bekleyen değişiklik var');
  if(!opts.session){
    if(RESTORE.state!=='IDLE')return restoreErr('RESTORE_BUSY','Zaten bir geri yükleme var');
  }
  if(!backupId)return restoreErr('BACKUP_NOT_FOUND','Yedek kimliği yok');
  var metaSnap;
  try{metaSnap=await backupsRef(CLOUD.uid).doc(backupId).get();}
  catch(e){return restoreErr('PRECHECK_FAILED','Yedek okunamadı');}
  if(!metaSnap.exists)return restoreErr('BACKUP_NOT_FOUND','Yedek bulunamadı');
  var m=metaSnap.data()||{};
  if(m.createdByUid&&m.createdByUid!==CLOUD.uid)return restoreErr('WRONG_USER','Yedek bu hesaba ait değil');
  if(m.status!=='complete')return restoreErr('BACKUP_INCOMPLETE','Yedek tamamlanmamış');
  var sv=Number(m.schemaVersion||0);
  if(sv>SCHEMA_VERSION)return restoreErr('FUTURE_SCHEMA','Yedek şeması bu sürümden yeni');
  if(sv>0&&sv<SCHEMA_VERSION&&sv<2)return restoreErr('UNSUPPORTED_SCHEMA','Yedek şeması desteklenmiyor');
  return null;                                       // temiz
}

/* verifyBackup statusunu yapilandirilmis restore hata koduna esler. */
function mapBackupStatusToCode(status){
  if(status==='Corrupted')return 'BACKUP_CORRUPTED';
  if(status==='Incomplete')return 'BACKUP_INCOMPLETE';
  if(status==='Unsupported Future Schema')return 'FUTURE_SCHEMA';
  return null;                                       // Suspect/Legacy/Migration/Verified/Healthy -> restore edilebilir
}

/* D6.3 — PREPARE/VERIFY/PREVIEW. Yazma YOK, before-restore backup YOK, D degismez. */
async function prepareRestore(backupId){
  var pc=await restorePrecheck(backupId);
  if(pc)return restoreResult('error',{error:pc});
  var opId=beginRestoreSession('restore:'+backupId);   // IDLE->PREPARING
  RS={operationId:opId,backupId:backupId,startedAt:Date.now(),confirmed:false,
      sourceRevision:Number(CLOUD.revision||0)};
  try{
    transitionRestore('VERIFYING');
    var v=await verifyBackup(backupId,{cache:false});
    var badCode=mapBackupStatusToCode(v.status);
    if(badCode)throw restoreErr(badCode,'Yedek uygun değil: '+v.status);
    var lp=await loadBackupPayload(backupId);          // {payload,meta} (Corrupted/Incomplete/Future reddeder)
    if(lp.meta&&lp.meta.createdByUid&&lp.meta.createdByUid!==CLOUD.uid)
      throw restoreErr('WRONG_USER','Yedek bu hesaba ait değil');
    var current=JSON.parse(JSON.stringify(D));         // mevcut canonical snapshot
    transitionRestore('PREVIEW');
    var preview=buildRestorePreview(current,lp.payload,
      {sourceRevision:Number(CLOUD.revision||0),targetRevision:Number(lp.meta.sourceRevision||0)});
    var suspect=analyzeSuspiciousChange(current,lp.payload);
    var warnings=(preview.warnings||[]).concat(suspect.reasons||[]);
    RS.backupPayload=lp.payload; RS.backupMeta=lp.meta; RS.currentSnapshot=current;
    RS.currentCanonical=canonicalStringify(current);
    RS.preview=preview; RS.suspect=suspect; RS.warnings=warnings;
    RS.expiresAt=Date.now()+RESTORE_PREVIEW_TTL_MS;
    transitionRestore('AWAITING_CONFIRM');
    return restoreResult('awaiting-confirmation',{operationId:opId,backupId:backupId,
      preview:preview,suspectAnalysis:suspect,warnings:warnings,expiresAt:RS.expiresAt});
  }catch(e){
    var code=(e&&e.code)?e.code:'PREPARE_FAILED';
    failRestoreSession(e instanceof Error?e:new Error(e.message||code));
    buildRestoreReport('failed',{errorCode:code});
    resetRestoreSession(); RS=null;
    return restoreResult('error',{error:restoreErr(code,(e&&e.message)||code)});
  }
}

/* D6.4 — Onay. Yalniz onay state'ini isaretler; otomatik execute YOK. Idempotent. */
function confirmRestore(operationId){
  if(!RS||RS.operationId!==operationId||RESTORE.operationId!==operationId)
    return restoreResult('error',{error:restoreErr('WRONG_OPERATION','Geçersiz işlem kimliği')});
  if(RESTORE.state!=='AWAITING_CONFIRM')
    return restoreResult('error',{error:restoreErr('INVALID_STATE','Onay aşamasında değil: '+RESTORE.state)});
  if(Date.now()>RS.expiresAt)
    return restoreResult('error',{error:restoreErr('PREVIEW_STALE','Önizleme süresi doldu')});
  RS.confirmed=true; RS.confirmedAt=RS.confirmedAt||Date.now();
  return restoreResult('confirmed',{operationId:operationId});
}

/* D6.5 — Iptal. COMMITTING'de kabul edilmez. Ana state degismez, backup olusmaz. */
function cancelRestore(operationId){
  if(!RS||RS.operationId!==operationId)
    return restoreResult('error',{error:restoreErr('WRONG_OPERATION','Geçersiz işlem kimliği')});
  if(RESTORE.state==='COMMITTING')
    return restoreResult('error',{error:restoreErr('RESTORE_BUSY','Uygulama sırasında iptal edilemez')});
  var cancellable=['PREPARING','VERIFYING','PREVIEW','AWAITING_CONFIRM'];
  if(cancellable.indexOf(RESTORE.state)<0)
    return restoreResult('error',{error:restoreErr('INVALID_STATE','İptal edilemez aşama: '+RESTORE.state)});
  RESTORE.deferredRemoteSnapshot=null;
  buildRestoreReport('cancelled',{});
  resetRestoreSession(); RS=null;
  return restoreResult('cancelled',{operationId:operationId});
}

/* D6.6+D6.7 — SAFEGUARD + COMMIT. Tek transaction otoritesi commitMutation. */
async function executeRestore(operationId){
  if(!RS||RS.operationId!==operationId||RESTORE.operationId!==operationId)
    return restoreResult('error',{error:restoreErr('WRONG_OPERATION','Geçersiz işlem kimliği')});
  if(RESTORE.state!=='AWAITING_CONFIRM')
    return restoreResult('error',{error:restoreErr('INVALID_STATE','Uygulama için onay aşaması gerekli: '+RESTORE.state)});
  if(!RS.confirmed)
    return restoreResult('error',{error:restoreErr('NOT_CONFIRMED','Önce onay gerekli')});
  // Yeniden precheck (fail-closed, oturum modunda)
  var pc=await restorePrecheck(RS.backupId,{session:true});
  if(pc){failRestoreSession(new Error(pc.message));buildRestoreReport('failed',{errorCode:pc.code});resetRestoreSession();var _r=RESTORE_LAST_REPORT;RS=null;return restoreResult('error',{error:pc,report:_r});}
  // Preview stale korumasi: D onizlemeden beri degismis olmamali
  if(canonicalStringify(D)!==RS.currentCanonical){
    failRestoreSession(new Error('Önizleme güncelliğini yitirdi'));
    buildRestoreReport('failed',{errorCode:'PREVIEW_STALE'});
    resetRestoreSession();RS=null;
    return restoreResult('error',{error:restoreErr('PREVIEW_STALE','Veri önizlemeden beri değişti')});
  }
  try{
    // ── SAFEGUARD ── (bu asamadaki HER hata SAFEGUARD_FAILED'e eslenir)
    transitionRestore('SAFEGUARDING');
    try{
      var sb=await createBackup('before_restore',
        {payload:RS.currentSnapshot,__restoreOperationId:operationId,label:'Geri yükleme öncesi'});
      var sbId=sb&&sb.id;
      if(!sbId)throw new Error('Güvenlik yedeği oluşturulamadı');
      var vsb=await verifyBackup(sbId,{cache:false});
      if(mapBackupStatusToCode(vsb.status))throw new Error('Güvenlik yedeği doğrulanamadı: '+vsb.status);
      RS.safeguardBackupId=sbId;
    }catch(sgErr){
      throw restoreErr('SAFEGUARD_FAILED','Güvenlik yedeği başarısız: '+((sgErr&&sgErr.message)||''));
    }
    // ── COMMIT (tek transaction otoritesi) ──
    transitionRestore('COMMITTING');
    var restoreState=buildStateFromPayload(RS.backupPayload);   // INIT-merge: eksik alanlar (generalNotes) additive
    var restorePayload=JSON.parse(JSON.stringify(restoreState));
    var m={id:newMutationId(),expectedRevision:RS.sourceRevision,
      payload:restorePayload,createdAt:Date.now(),updatedAt:Date.now()};
    RS.restoreMutationId=m.id; RS.restoreState=restoreState;
    RS.restoreCanonical=canonicalStringify(restorePayload);
    var res;
    try{res=await commitMutation(m);}
    catch(e){
      // Belirsiz: transaction sonucu bilinmiyor. Kor basari deme.
      RESTORE.commitUncertain=true; RS.commitError=e;
      buildRestoreReport('uncertain',{errorCode:'COMMIT_UNCERTAIN'});
      return restoreResult('uncertain',{operationId:operationId,needsVerification:true});
    }
    if(res.status==='conflict'){
      failRestoreSession(new Error('Sunucu revision çakışması'));
      buildRestoreReport('failed',{errorCode:'TRANSACTION_CONFLICT'});
      resetRestoreSession();RS=null;                 // before_restore korunur, local degismez
      return restoreResult('error',{error:restoreErr('TRANSACTION_CONFLICT','Sunucu sürümü değişmiş; geri yükleme uygulanmadı')});
    }
    // ok veya duplicate -> commit kesin
    return finalizeRestore(Number(res.revision||0),res.status==='ok'||res.status==='duplicate');
  }catch(e){
    var code=(e&&e.code)?e.code:'EXECUTE_FAILED';
    failRestoreSession(e instanceof Error?e:new Error(e.message||code));
    buildRestoreReport('failed',{errorCode:code});
    resetRestoreSession();RS=null;
    return restoreResult('error',{error:restoreErr(code,(e&&e.message)||code)});
  }
}

/* D6.9 — FINALIZING. Pending/undo temizligi YALNIZ burada (kesin commit sonrasi). */
function finalizeRestore(newRevision,commitVerified){
  transitionRestore('FINALIZING');
  // Deferred snapshot karari: kendi yazmamiz otoritatif -> revision <= yeni ise at.
  var deferredAction='none';
  var ds=RESTORE.deferredRemoteSnapshot;
  if(ds){deferredAction=(Number(ds.revision||0)<=newRevision)?'dropped':'deferred-to-listener';}
  RESTORE.deferredRemoteSnapshot=null;
  // Bellek + local senkron
  D=RS.restoreState;
  CLOUD.revision=newRevision;
  try{localStorage.setItem('fu7_rev',String(newRevision));}catch(e){}
  writeLocal(Date.now());
  clearPendingForRestore();                          // pending + timerlar + localStorage pending
  clearUndoHistoryForRestore();                      // hist=[]
  CLOUD.pendingMutation=null; CLOUD.conflict=null;
  RS.restoredRevision=newRevision;
  var rep=buildRestoreReport('committed',
    {commitVerified:commitVerified,pendingCleared:true,undoCleared:true,deferredSnapshotAction:deferredAction});
  if(typeof render==='function')render();            // tek render
  if(typeof renderAdminSystemStatusBar==='function')renderAdminSystemStatusBar();
  finishRestoreSession('success');                   // -> resetRestoreSession -> IDLE
  RS=null;
  return restoreResult('success',{operationId:rep.operationId,report:rep});
}

/* D6.8 — Commit belirsizligi cozumu. Doc yeniden okunur; kor basari yok. */
async function verifyRestoreOutcome(operationId){
  if(!RS||RS.operationId!==operationId)
    return restoreResult('error',{error:restoreErr('WRONG_OPERATION','Geçersiz işlem kimliği')});
  if(!RS.restoreMutationId)
    return restoreResult('error',{error:restoreErr('INVALID_STATE','Doğrulanacak commit yok')});
  var doc;
  try{doc=await stateRef(CLOUD.uid).get();}
  catch(e){return restoreResult('uncertain',{outcome:'uncertain',error:restoreErr('VERIFY_READ_FAILED',e.message)});}
  var d=doc.exists?(doc.data()||{}):{};
  var serverRev=Number(d.revision||0);
  var expectRev=RS.sourceRevision+1;
  var idMatch=d.lastMutationId===RS.restoreMutationId;
  var revMatch=serverRev===expectRev;
  var hashMatch=d.payload?(canonicalStringify(d.payload)===RS.restoreCanonical):false;
  if(idMatch&&revMatch&&hashMatch){
    RESTORE.commitUncertain=false;
    return finalizeRestore(serverRev,true);          // committed
  }
  if(!idMatch&&serverRev===RS.sourceRevision){
    // yazilmamis: before_restore korunur, local degismez
    failRestoreSession(new Error('Commit uygulanmamış'));
    var rep=buildRestoreReport('not_committed',{errorCode:'NOT_COMMITTED'});
    resetRestoreSession();RS=null;
    return restoreResult('not_committed',{report:rep});
  }
  // belirsiz: kor IDLE yapma, raporda acikca belirt
  RESTORE.commitUncertain=true;
  var rep2=buildRestoreReport('uncertain',{errorCode:'COMMIT_UNCERTAIN'});
  return restoreResult('uncertain',{report:rep2});
}

function getRestoreReport(){return (RS&&RS.report)||RESTORE_LAST_REPORT||null;}

window.RESTORE_API={getRestoreState:getRestoreState,isRestoreLocked:isRestoreLocked,
  canTransitionRestore:canTransitionRestore,transitionRestore:transitionRestore,
  beginRestoreSession:beginRestoreSession,failRestoreSession:failRestoreSession,
  finishRestoreSession:finishRestoreSession,resetRestoreSession:resetRestoreSession,
  assertRestoreIdle:assertRestoreIdle,withRestoreLock:withRestoreLock,
  startRestoreWatchdog:startRestoreWatchdog,stopRestoreWatchdog:stopRestoreWatchdog,
  clearPendingForRestore:clearPendingForRestore,clearUndoHistoryForRestore:clearUndoHistoryForRestore,
  prepareRestore:prepareRestore,confirmRestore:confirmRestore,cancelRestore:cancelRestore,
  executeRestore:executeRestore,getRestoreReport:getRestoreReport,verifyRestoreOutcome:verifyRestoreOutcome};

