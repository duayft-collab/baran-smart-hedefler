function getDiffSchema(){return JSON.parse(JSON.stringify(DIFF_SCHEMA));}
function allSchemaFields(){
  return DIFF_SCHEMA.arrays.map(function(a){return a.field;})
    .concat(DIFF_SCHEMA.objects).concat(DIFF_SCHEMA.scalars);
}
function recHash(r){return canonicalStringify(r);}

/* ── D4.2: dizi diff ──────────────────────────────────────────────────────── */
function diffArrayRecords(source,target,opts){
  opts=opts||{};
  var identity=opts.identity||'id', limit=opts.detailLimit||DIFF_LIMITS.detailLimit;
  source=source||[]; target=target||[];
  var res={added:0,removed:0,changed:0,unchanged:0,
    addedDetail:[],removedDetail:[],changedDetail:[],
    duplicateIds:[],missingIds:[],truncated:false,totalDetailCount:0,confidence:'high'};

  if(identity==='content'){
    // Icerik tabanli coklu-kume: yalniz added/removed, changed YOK, missingIds YOK
    var ms=function(list){var m={};list.forEach(function(r){var k=recHash(r);m[k]=(m[k]||0)+1;});return m;};
    var sm=ms(source), tm=ms(target), keys={};
    Object.keys(sm).forEach(function(k){keys[k]=1;});Object.keys(tm).forEach(function(k){keys[k]=1;});
    Object.keys(keys).forEach(function(k){
      var s=sm[k]||0,t=tm[k]||0;
      if(t>s){res.added+=t-s;pushDetail(res.addedDetail,{hash:k},limit,res);}
      else if(s>t){res.removed+=s-t;pushDetail(res.removedDetail,{hash:k},limit,res);}
      var min=Math.min(s,t);res.unchanged+=min;
    });
    return res;
  }

  var idx=function(list){
    var byId={},dups={},missing=[];
    list.forEach(function(r,i){
      var id=(r&&typeof r==='object')?r.id:undefined;
      if(id===undefined||id===null){missing.push({index:i,hash:recHash(r)});return;}
      id=String(id);
      if(byId.hasOwnProperty(id)){
        if(!dups[id])dups[id]=[byId[id].hash];
        dups[id].push(recHash(r));
      }else byId[id]={rec:r,hash:recHash(r)};
    });
    return {byId:byId,dups:dups,missing:missing};
  };
  var S=idx(source),T=idx(target);
  var seenDup={};
  [S,T].forEach(function(side,si){
    Object.keys(side.dups).forEach(function(id){
      if(seenDup[id])return;seenDup[id]=1;
      res.duplicateIds.push({field:opts.field||null,id:id,
        sourceCount:(source.filter(function(r){return r&&String(r.id)===id;})).length,
        targetCount:(target.filter(function(r){return r&&String(r.id)===id;})).length,
        sourceHashes:S.dups[id]||(S.byId[id]?[S.byId[id].hash]:[]),
        targetHashes:T.dups[id]||(T.byId[id]?[T.byId[id].hash]:[])});
    });
  });
  S.missing.forEach(function(m){res.missingIds.push(Object.assign({side:'source'},m));});
  T.missing.forEach(function(m){res.missingIds.push(Object.assign({side:'target'},m));});

  var allIds={};
  Object.keys(S.byId).forEach(function(id){allIds[id]=1;});
  Object.keys(T.byId).forEach(function(id){allIds[id]=1;});
  Object.keys(allIds).forEach(function(id){
    if(seenDup[id])return; // cakisan id -> changed KESIN sayilmaz
    var s=S.byId[id],t=T.byId[id];
    if(s&&t){
      if(s.hash===t.hash)res.unchanged++;
      else{res.changed++;pushDetail(res.changedDetail,{id:id},limit,res);}
    }else if(t){res.added++;pushDetail(res.addedDetail,{id:id},limit,res);}
    else{res.removed++;pushDetail(res.removedDetail,{id:id},limit,res);}
  });

  var missCount=res.missingIds.length, dupCount=res.duplicateIds.length;
  if(dupCount>0||missCount>DIFF_LIMITS.missingLow)res.confidence='low';
  else if(missCount>0)res.confidence='medium';
  return res;
}
function pushDetail(list,item,limit,res){
  res.totalDetailCount++;
  if(list.length<limit)list.push(item);
  else res.truncated=true;
}

/* ── D4.3: nesne diff (noktali yol) ───────────────────────────────────────── */
function diffObjects(source,target,opts,prefix,depth){
  opts=opts||{};prefix=prefix||'';depth=depth||0;
  var res={changedKeys:[],addedKeys:[],removedKeys:[],unchangedKeys:[],nestedChanges:[]};
  // Firestore ic ice sinir 20; 40 gecilirse dairesel yapi kabul edip guvenli durur.
  if(depth>40){res.nestedChanges.push({path:prefix,error:'çok derin veya dairesel yapı'});return res;}
  source=source||{};target=target||{};
  var keys={};Object.keys(source).forEach(function(k){keys[k]=1;});
  Object.keys(target).forEach(function(k){keys[k]=1;});
  Object.keys(keys).forEach(function(k){
    var path=prefix?prefix+'.'+k:k, a=source[k], b=target[k];
    var inA=source.hasOwnProperty(k), inB=target.hasOwnProperty(k);
    if(!inA){res.addedKeys.push(path);return;}
    if(!inB){res.removedKeys.push(path);return;}
    var aObj=a&&typeof a==='object'&&!Array.isArray(a);
    var bObj=b&&typeof b==='object'&&!Array.isArray(b);
    if(aObj&&bObj){
      var sub=diffObjects(a,b,opts,path,depth+1);
      ['changedKeys','addedKeys','removedKeys','unchangedKeys'].forEach(function(kk){
        res[kk]=res[kk].concat(sub[kk]);});
      res.nestedChanges=res.nestedChanges.concat(sub.nestedChanges);
      return;
    }
    var ha,hb;
    try{ha=recHash(a);hb=recHash(b);}
    catch(e){res.nestedChanges.push({path:path,error:'karşılaştırılamadı: '+e.message});return;}
    if(ha===hb)res.unchangedKeys.push(path);
    else{res.changedKeys.push(path);res.nestedChanges.push({path:path,changed:true});}
  });
  return res;
}

/* ── D4.4: skaler diff ────────────────────────────────────────────────────── */
function scalarPreview(v){
  if(v===undefined)return {type:'undefined',preview:null};
  if(v===null)return {type:'null',preview:null};
  if(typeof v==='string'){
    if(v.length>DIFF_LIMITS.previewMax)
      return {type:'string',preview:v.slice(0,DIFF_LIMITS.previewMax)+'…',length:v.length,truncated:true};
    return {type:'string',preview:v,length:v.length};
  }
  return {type:typeof v,preview:v};
}
function diffScalars(before,after){
  var changed;
  try{changed=recHash(before)!==recHash(after);}
  catch(e){changed=true;}
  return {before:scalarPreview(before),after:scalarPreview(after),changed:changed};
}

/* ── D4.6: payload diff (saf) ─────────────────────────────────────────────── */
function diffPayloads(source,target,opts){
  opts=opts||{};
  var detailLimit=opts.detailLimit||DIFF_LIMITS.detailLimit;
  source=source||{};target=target||{};
  var out={arrays:{},objects:{},scalars:{},unknownFields:[]};
  DIFF_SCHEMA.arrays.forEach(function(a){
    out.arrays[a.field]=diffArrayRecords(source[a.field],target[a.field],
      {identity:a.identity,field:a.field,detailLimit:detailLimit});
  });
  DIFF_SCHEMA.objects.forEach(function(f){
    out.objects[f]=diffObjects(source[f],target[f],{});
  });
  DIFF_SCHEMA.scalars.forEach(function(f){
    out.scalars[f]=diffScalars(source[f],target[f]);
  });
  var known={};allSchemaFields().forEach(function(f){known[f]=1;});
  var seen={};[source,target].forEach(function(p){
    Object.keys(p||{}).forEach(function(k){
      if(!known[k]&&!seen[k]){seen[k]=1;out.unknownFields.push(k);}});});
  return out;
}

/* ── D4.5: hizli diff (yalniz metadata, blob YOK) ────────────────────────── */
function diffBackupMetadata(aMeta,bMeta){
  aMeta=aMeta||{};bMeta=bMeta||{};
  var ac=aMeta.counts||{},bc=bMeta.counts||{};
  var modules={},keys={};
  Object.keys(ac).forEach(function(k){if(k!=='totalRecords')keys[k]=1;});
  Object.keys(bc).forEach(function(k){if(k!=='totalRecords')keys[k]=1;});
  Object.keys(keys).forEach(function(k){modules[k]=(bc[k]||0)-(ac[k]||0);});
  return {
    perModule:modules,
    totalRecords:(bc.totalRecords||0)-(ac.totalRecords||0),
    plainBytes:(bMeta.plainBytes||0)-(aMeta.plainBytes||0),
    storedBytes:(bMeta.storedBytes||0)-(aMeta.storedBytes||0),
    sourceRevision:(bMeta.sourceRevision||0)-(aMeta.sourceRevision||0),
    schemaVersionChanged:aMeta.schemaVersion!==bMeta.schemaVersion,
    appVersionChanged:aMeta.appVersion!==bMeta.appVersion,
    createdAtDelta:(Number(bMeta.createdAtClient||0))-(Number(aMeta.createdAtClient||0)),
    limitation:'Yalnız net sayısal fark. changed kayıt sayısı ve duplicate id tespit edilemez; bunun için tam diff gerekir.'
  };
}

/* ── D4.6: backup seviyesi tam diff (Firestore erisimi burada) ───────────── */
async function loadBackupPayload(backupId){
  var v=await verifyBackup(backupId,{cache:false});
  if(['Corrupted','Incomplete','Unsupported Future Schema'].indexOf(v.status)>=0)
    throw new Error('Yedek karşılaştırmaya uygun değil: '+backupId+' ('+v.status+')');
  var uid=CLOUD.uid;
  var meta=(await backupsRef(uid).doc(backupId).get()).data()||{};
  var b=(await blobRef(uid,backupId).get()).data()||{};
  var text=await decompressPayload(storeToBytes(b.data),meta.encoding||b.encoding);
  return {meta:meta,payload:JSON.parse(text)};
}
async function diffBackups(sourceBackupId,targetBackupId,opts){
  opts=opts||{};
  console.log('[BACKUP:DIFF]',sourceBackupId,'->',targetBackupId);
  var s=await loadBackupPayload(sourceBackupId);
  var t=await loadBackupPayload(targetBackupId);
  return {source:{id:sourceBackupId,revision:s.meta.sourceRevision},
    target:{id:targetBackupId,revision:t.meta.sourceRevision},
    diff:diffPayloads(s.payload,t.payload,opts)};
}

/* ── D4.7: restore preview modeli (saf) ──────────────────────────────────── */
function moduleTotals(d){
  // d: diffArrayRecords sonucu VEYA diffObjects sonucu VEYA diffScalars
  var t={added:0,removed:0,changed:0,unchanged:0,uncertain:0};
  if(d.addedDetail!==undefined){ // dizi
    t.added=d.added;t.removed=d.removed;t.changed=d.changed;t.unchanged=d.unchanged;
    t.uncertain=d.missingIds.length+d.duplicateIds.reduce(function(a,x){
      return a+Math.max(x.sourceCount,x.targetCount);},0);
  }else if(d.changedKeys!==undefined){ // nesne
    t.added=d.addedKeys.length;t.removed=d.removedKeys.length;
    t.changed=d.changedKeys.length;t.unchanged=d.unchangedKeys.length;
  }else{ // skaler
    if(d.changed)t.changed=1;else t.unchanged=1;
  }
  return t;
}
function buildRestorePreview(currentPayload,backupPayload,opts){
  opts=opts||{};
  console.log('[BACKUP:PREVIEW] hesaplanıyor');
  // Restore: backup yeni state olur -> source=current, target=backup
  var diff=diffPayloads(currentPayload,backupPayload,opts);
  var affected=[],unchanged=[],perModule={};
  var totals={added:0,removed:0,changed:0,unchanged:0,uncertain:0};
  var dupWarn=[],missWarn=[];

  function acc(name,d,critical){
    var mt=moduleTotals(d);
    perModule[name]=mt;
    totals.added+=mt.added;totals.removed+=mt.removed;totals.changed+=mt.changed;
    totals.unchanged+=mt.unchanged;totals.uncertain+=mt.uncertain;
    if(d.duplicateIds&&d.duplicateIds.length)
      dupWarn.push({module:name,count:d.duplicateIds.length});
    if(d.missingIds&&d.missingIds.length)
      missWarn.push({module:name,count:d.missingIds.length});
    if(mt.added||mt.removed||mt.changed)affected.push(name);else unchanged.push(name);
  }
  DIFF_SCHEMA.arrays.forEach(function(a){acc(a.field,diff.arrays[a.field],a.critical);});
  DIFF_SCHEMA.objects.forEach(function(f){acc(f,diff.objects[f]);});
  DIFF_SCHEMA.scalars.forEach(function(f){acc(f,diff.scalars[f]);});

  // Confidence (kritik modul agirlikli)
  var critDupMiss=IMPACT_RULES.criticalModules.some(function(m){
    var d=diff.arrays[m];return d&&(d.duplicateIds.length>0||d.missingIds.length>0);});
  var anyDup=dupWarn.length>0, totalMiss=missWarn.reduce(function(a,x){return a+x.count;},0);
  var confidence='high';
  if(critDupMiss||anyDup)confidence='low';
  else if(totalMiss>DIFF_LIMITS.missingLow)confidence='low';
  else if(totalMiss>0)confidence='medium';

  // Kaynak toplam kayit (silme yuzdesi icin)
  var srcTotal=0;DIFF_SCHEMA.arrays.forEach(function(a){
    srcTotal+=(currentPayload&&Array.isArray(currentPayload[a.field]))?currentPayload[a.field].length:0;});
  var removedPct=srcTotal>0?totals.removed/srcTotal:0;

  // Destructive impact
  var criticalHit=IMPACT_RULES.criticalModules.some(function(m){
    var cur=(currentPayload&&Array.isArray(currentPayload[m]))?currentPayload[m].length:0;
    var mt=perModule[m]||{removed:0};
    return cur>0&&mt.removed>=cur*IMPACT_RULES.criticalDropPct;});
  var impact;
  if(totals.added===0&&totals.removed===0&&totals.changed===0)impact='none';
  else if(criticalHit)impact='critical';
  else if(removedPct>IMPACT_RULES.highDeletePct)impact='high';
  else if(totals.removed===0&&totals.changed===0)impact='low';
  else impact='medium';

  var schemaWarnings=[];
  if(diff.unknownFields.length)
    schemaWarnings.push({type:'unknownFields',fields:diff.unknownFields});

  var curBytes=safeLen(currentPayload), bakBytes=safeLen(backupPayload);
  var warnings=[];
  if(dupWarn.length)warnings.push('Çakışan kayıt kimlikleri var; bazı değişiklikler kesin sayılamıyor.');
  if(missWarn.length)warnings.push('Kimliksiz kayıtlar var; karşılaştırma güvenilirliği düştü.');
  if(diff.unknownFields.length)warnings.push('Bilinmeyen alan(lar): '+diff.unknownFields.join(', '));

  return {
    sourceRevision:opts.sourceRevision!==undefined?opts.sourceRevision:null,
    targetRevision:opts.targetRevision!==undefined?opts.targetRevision:null,
    affectedModules:affected, unchangedModules:unchanged,
    totals:totals, perModule:perModule,
    warnings:warnings, confidence:confidence,
    duplicateIdWarnings:dupWarn, missingIdWarnings:missWarn, schemaWarnings:schemaWarnings,
    sizeDifference:bakBytes-curBytes, recordDifference:totals.added-totals.removed,
    destructiveImpact:impact,
    detailLimit:opts.detailLimit||DIFF_LIMITS.detailLimit
  };
}
function safeLen(o){try{return new TextEncoder().encode(canonicalStringify(o)).length;}catch(e){return 0;}}

/* ── D4.9: suspect kayit duzeyi analizi (mevcut detectSuspect'e DOKUNMAZ) ── */
function analyzeSuspiciousChange(previousPayload,nextPayload){
  var diff=diffPayloads(previousPayload,nextPayload,{detailLimit:1});
  var prevTotal=0,nextTotal=0;
  DIFF_SCHEMA.arrays.forEach(function(a){
    prevTotal+=(previousPayload&&Array.isArray(previousPayload[a.field]))?previousPayload[a.field].length:0;
    nextTotal+=(nextPayload&&Array.isArray(nextPayload[a.field]))?nextPayload[a.field].length:0;
  });
  var catastrophicDrop=prevTotal>0&&nextTotal<prevTotal*0.5;
  var criticalModuleEmptied=IMPACT_RULES.criticalModules.some(function(m){
    var p=(previousPayload&&Array.isArray(previousPayload[m]))?previousPayload[m].length:0;
    var n=(nextPayload&&Array.isArray(nextPayload[m]))?nextPayload[m].length:0;
    return p>0&&n===0;});
  var dupDetected=false,missBefore=0,missAfter=0;
  DIFF_SCHEMA.arrays.forEach(function(a){
    var d=diff.arrays[a.field];
    if(d.duplicateIds.length)dupDetected=true;
    d.missingIds.forEach(function(m){if(m.side==='source')missBefore++;else missAfter++;});
  });
  var reasons=[];
  if(catastrophicDrop)reasons.push('toplam kayıt %50\'den fazla düştü');
  if(criticalModuleEmptied)reasons.push('kritik modül boşaldı');
  if(dupDetected)reasons.push('çakışan kayıt kimliği');
  if(missAfter>missBefore)reasons.push('kimliksiz kayıt arttı');
  return {catastrophicDrop:catastrophicDrop,criticalModuleEmptied:criticalModuleEmptied,
    duplicateIdDetected:dupDetected,missingIdIncrease:missAfter>missBefore,
    destructiveImpact:(catastrophicDrop||criticalModuleEmptied)?'critical':(reasons.length?'medium':'none'),
    reasons:reasons};
}

window.BACKUP_API={getBackupCapabilities:getBackupCapabilities,canonicalStringify:canonicalStringify,
  sha256Hex:sha256Hex,createBackup:createBackup,listBackups:listBackups,verifyBackup:verifyBackup,
  verifyAllBackups:verifyAllBackups,rotateBackups:rotateBackups,cleanupOrphanBackups:cleanupOrphanBackups,
  getDiffSchema:getDiffSchema,diffArrayRecords:diffArrayRecords,diffObjects:diffObjects,
  diffScalars:diffScalars,diffPayloads:diffPayloads,diffBackupMetadata:diffBackupMetadata,
  diffBackups:diffBackups,buildRestorePreview:buildRestorePreview,
  analyzeSuspiciousChange:analyzeSuspiciousChange};

/* ══════════════════════════════════════════════════════════════════════════
   D6 — GÜVENLİ RESTORE MOTORU
   D1-D5 altyapisini surer. Tek transaction otoritesi commitMutation'dir.
   Fail-closed, idempotent, safeguard zorunlu, preview-stale korumasi,
   pending/undo temizligi YALNIZ kesin commit sonrasi.
   ══════════════════════════════════════════════════════════════════════════ */
var RESTORE_PREVIEW_TTL_MS=300000;                 // 5 dk onay penceresi
var RS=null;                                        // aktif restore oturum verisi (RESTORE state'inden ayri)
var RESTORE_LAST_REPORT=null;

function restoreErr(code,message){return {code:code,message:message||code};}
function restoreResult(status,extra){return Object.assign({status:status},extra||{});}

/* Yapilandirilmis rapor. Hassas veri (payload/uid/token) ASLA girmez. */
function buildRestoreReport(outcome,extra){
  var s=RS||{};
  var pv=s.preview||{};
  var rep={
    operationId:s.operationId||null, backupId:s.backupId||null,
    safeguardBackupId:s.safeguardBackupId||null,
    startedAt:s.startedAt||null, finishedAt:Date.now(),
    sourceRevision:(s.sourceRevision!==undefined?s.sourceRevision:null),
    previousRevision:(s.sourceRevision!==undefined?s.sourceRevision:null),
    restoredRevision:(s.restoredRevision!==undefined?s.restoredRevision:null),
    previewTotals:pv.totals||null, affectedModules:pv.affectedModules||[],
    warnings:s.warnings||[], suspectAnalysis:s.suspect||null,
    destructiveImpact:pv.destructiveImpact||null,
    outcome:outcome, commitVerified:!!(extra&&extra.commitVerified),
    pendingCleared:!!(extra&&extra.pendingCleared), undoCleared:!!(extra&&extra.undoCleared),
    deferredSnapshotAction:(extra&&extra.deferredSnapshotAction)||'none',
    errorCode:(extra&&extra.errorCode)||null
  };
  RESTORE_LAST_REPORT=rep;
  if(s)s.report=rep;
  return rep;
}

/* Fail-closed precheck. opts.session=true ise aktif oturumda tekrar dogrulama
   (RESTORE-state IDLE kontrolu atlanir; operationId zaten dogrulanmistir). */
