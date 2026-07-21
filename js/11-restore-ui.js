function renderRestore(){
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Yedekler / Geri Yükleme</h1><p class="sh-sub">Bir yedek seç, önizle ve güvenle geri yükle. Geri yükleme öncesi otomatik güvenlik yedeği alınır.</p></div>';
  h+='<button class="btn btn-g" onclick="rstLoadList()">'+ic('ci',13)+' Yenile</button></div>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">';
  h+='<input class="inp" id="rst_search" style="max-width:280px" placeholder="Yedeklerde ara (açıklama, tarih, tip)..." value="'+U.esc(RESTORE_UI.query)+'" oninput="rstSetQuery(this.value)">';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';
  [['all','Tümü'],['manual','Manuel'],['daily','Otomatik'],['before_restore','Güvenlik']].forEach(function(f){var a=RESTORE_UI.filter===f[0];
    h+='<button class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'" data-v="'+f[0]+'" onclick="rstSetFilter(this.dataset.v)">'+f[1]+'</button>';});
  h+='</div></div>';
  h+='<div id="rst_list"></div></div>';
  sh('pinner',h);
  if(RESTORE_UI.loaded)renderRestoreList();       // filtre/arama: cache'ten render (yeniden cekme yok)
  else rstLoadList();                             // sayfa girisi: bir kez yukle
}
window.renderRestore=renderRestore;
async function rstLoadList(){
  RESTORE_UI.loading=true;RESTORE_UI.loadError=false;renderRestoreList();
  try{RESTORE_UI.backups=await BACKUP_API.listBackups({limit:50});RESTORE_UI.loaded=true;}
  catch(e){RESTORE_UI.loadError=true;RESTORE_UI.backups=[];}
  RESTORE_UI.loading=false;
  if(tab==='restore')renderRestoreList();
}
window.rstLoadList=rstLoadList;
function rstFilteredBackups(){
  var q=RESTORE_UI.query.trim().toLocaleLowerCase('tr'),f=RESTORE_UI.filter;
  return RESTORE_UI.backups.filter(function(m){
    if(f==='manual'&&m.reason!=='manual')return false;
    if(f==='daily'&&m.reason!=='daily')return false;
    if(f==='before_restore'&&m.reason!=='before_restore')return false;
    if(!q)return true;
    var hay=((m.label||'')+' '+(m.reason||'')+' '+rstReasonLabel(m.reason)+' '+_gnDate(m.createdAtClient)).toLocaleLowerCase('tr');
    return hay.indexOf(q)>=0;
  });
}
function renderRestoreList(){
  var box=ge('rst_list');if(!box)return;
  if(RESTORE_UI.loading){box.innerHTML='<div class="card" style="padding:34px;text-align:center;color:var(--t3)">Yedekler yükleniyor…</div>';return;}
  if(RESTORE_UI.loadError){box.innerHTML='<div class="card" style="padding:34px;text-align:center"><p style="font-weight:700;color:var(--red)">Yedekler yüklenemedi.</p><button class="btn btn-g btn-sm" style="margin-top:8px" onclick="rstLoadList()">Tekrar dene</button></div>';return;}
  var list=rstFilteredBackups();var h='';
  if(RESTORE_UI.query.trim())h+='<p style="font-size:11px;color:var(--t3);margin-bottom:8px">'+list.length+' sonuç</p>';
  if(!list.length){h+='<div class="card" style="padding:44px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">'+ic('arc',30,'var(--t3)')+'<p style="font-weight:700;font-size:15px">'+(RESTORE_UI.query.trim()||RESTORE_UI.filter!=='all'?'Ölçütlere uygun yedek yok.':'Henüz yedek yok.')+'</p></div>';box.innerHTML=h;return;}
  h+='<div style="display:flex;flex-direction:column;gap:10px">';
  list.forEach(function(m){
    var recs=(m.counts&&m.counts.totalRecords)||0, sid=U.esc(String(m.id));
    h+='<div class="card" style="padding:14px 16px">';
    h+='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'+rstReasonPill(m.reason)+(m.suspect?'<span class="pill p-orange" style="font-size:9px">Şüpheli</span>':'')+'<p style="font-weight:700;font-size:13.5px;word-break:break-word">'+U.esc(m.label||_gnDate(m.createdAtClient))+'</p></div>';
    h+='<p style="font-size:11px;color:var(--t3)">'+ic('clock',10,'var(--t3)')+' '+U.esc(_gnDate(m.createdAtClient))+'</p>';
    h+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:var(--t2)">';
    h+='<span>Sürüm: <b>'+Number(m.sourceRevision||0)+'</b></span><span>Boyut: <b>'+rstFmtBytes(m.plainBytes)+'</b></span><span>Kayıt: <b>'+recs+'</b></span>';
    h+='</div></div>';
    h+='<button class="btn btn-p btn-sm" style="flex-shrink:0" data-id="'+sid+'" onclick="rstOpenPreview(this.dataset.id)">'+ic('ci',12)+' Önizle & Geri Yükle</button>';
    h+='</div></div>';
  });
  h+='</div>';
  box.innerHTML=h;
}
window.renderRestoreList=renderRestoreList;
function rstSetQuery(v){RESTORE_UI.query=v;renderRestoreList();}
function rstSetFilter(v){RESTORE_UI.filter=v;renderRestore();}
window.rstSetQuery=rstSetQuery;window.rstSetFilter=rstSetFilter;
/* ── Önizleme + onay ── */
async function rstOpenPreview(backupId){
  if(RESTORE_UI.busy)return;
  // Aktif oturum varsa once guvenle iptal (yeni preview icin)
  if(RESTORE_UI.opId){try{cancelRestore(RESTORE_UI.opId);}catch(e){}RESTORE_UI.opId=null;}
  RESTORE_UI.busy=true;RESTORE_UI.view='loading';RESTORE_UI.backupId=backupId;RESTORE_UI.accepted=false;RESTORE_UI.error=null;
  showModal('<div style="padding:34px;text-align:center;color:var(--t3)">Önizleme hazırlanıyor…</div>');
  var pr=await prepareRestore(backupId);
  RESTORE_UI.busy=false;
  if(pr.status!=='awaiting-confirmation'){
    RESTORE_UI.view='error';RESTORE_UI.error=(pr.error&&pr.error.code)||'PREPARE_FAILED';RESTORE_UI.opId=null;renderRestoreModal();return;
  }
  RESTORE_UI.opId=pr.operationId;RESTORE_UI.preview=pr.preview;RESTORE_UI.suspect=pr.suspectAnalysis;RESTORE_UI.warnings=pr.warnings||[];
  RESTORE_UI.view='preview';renderRestoreModal();
}
window.rstOpenPreview=rstOpenPreview;
function rstModuleRow(pv,field,label){
  var d=pv.perModule&&pv.perModule[field];if(!d)return '';
  if(!d.added&&!d.removed&&!d.changed)return '';
  return '<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0"><span style="color:var(--t2)">'+label+'</span><span style="color:var(--t3)">+'+d.added+' / −'+d.removed+' / ~'+d.changed+'</span></div>';
}
function renderRestoreModal(){
  var v=RESTORE_UI.view,h='';
  if(v==='loading'){showModal('<div style="padding:34px;text-align:center;color:var(--t3)">Önizleme hazırlanıyor…</div>');return;}
  if(v==='preview'){
    var pv=RESTORE_UI.preview,risk=rstRisk(pv),sus=RESTORE_UI.suspect;
    var affected=pv.affectedModules||[],totals=pv.totals||{};
    h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px"><h2 style="font-size:17px;font-weight:800">Geri Yükleme Önizlemesi</h2><button class="btn btn-g btn-ic" style="width:30px;height:30px" onclick="rstCancel()">'+ic('x',14)+'</button></div>';
    h+='<div style="padding:10px 12px;border-radius:10px;background:'+risk.bg+';color:#fff;margin-bottom:12px"><b style="font-size:13px">'+risk.label+'</b><div style="font-size:11px;opacity:.9;margin-top:2px">Yıkıcı etki: '+(pv.destructiveImpact||'?')+' · Güven: '+(pv.confidence||'?')+'</div></div>';
    h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">';
    h+='<div class="card" style="padding:9px 12px;flex:1;min-width:100px"><p style="font-size:10px;color:var(--t3)">Etkilenen modül</p><p style="font-size:18px;font-weight:800">'+affected.length+'</p></div>';
    h+='<div class="card" style="padding:9px 12px;flex:1;min-width:100px"><p style="font-size:10px;color:var(--t3)">Eklenecek/Silinecek/Değişecek</p><p style="font-size:14px;font-weight:800">+'+(totals.added||0)+' / −'+(totals.removed||0)+' / ~'+(totals.changed||0)+'</p></div>';
    h+='</div>';
    var modRows=rstModuleRow(pv,'goals','Hedefler')+rstModuleRow(pv,'generalNotes','Genel Notlar')+rstModuleRow(pv,'todos','Görevler')+rstModuleRow(pv,'habits','Alışkanlıklar');
    if(modRows)h+='<div class="card" style="padding:8px 12px;margin-bottom:12px"><p style="font-size:10px;color:var(--t3);margin-bottom:4px">Modül değişiklikleri (+ekle / −sil / ~değiş)</p>'+modRows+'</div>';
    if(affected.length)h+='<p style="font-size:11px;color:var(--t2);margin-bottom:10px"><b>Etkilenen:</b> '+affected.map(function(m){return U.esc(m);}).join(', ')+'</p>';
    var warns=(RESTORE_UI.warnings||[]).concat((sus&&sus.reasons)||[]);
    var uniqW=warns.filter(function(w,i){return warns.indexOf(w)===i;});
    if(uniqW.length){h+='<div style="padding:8px 12px;border-radius:8px;background:var(--bl);border-left:3px solid var(--orange);margin-bottom:12px"><p style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:3px">'+ic('ci',11,'var(--orange)')+' Uyarılar</p>';uniqW.forEach(function(w){h+='<p style="font-size:11px;color:var(--t2);line-height:1.5">• '+U.esc(w)+'</p>';});h+='</div>';}
    h+='<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:10px;border-radius:8px;background:var(--s2);margin-bottom:12px"><input type="checkbox" id="rst_accept" '+(RESTORE_UI.accepted?'checked':'')+' onchange="rstToggleAccept(this.checked)" style="margin-top:2px"><span style="font-size:12px;color:var(--t2)">Bu geri yüklemenin mevcut verimin üzerine yazacağını anlıyorum. İşlem öncesi otomatik <b>güvenlik yedeği</b> alınacak. <b>Kabul ediyorum.</b></span></label>';
    h+='<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="btn btn-g" onclick="rstCancel()">Vazgeç</button><button class="btn btn-p" id="rst_go" '+(RESTORE_UI.accepted?'':'disabled style="opacity:.5;pointer-events:none"')+' onclick="rstConfirmExecute()">'+ic('arc',13)+' Geri Yükle</button></div>';
    showModal(h);return;
  }
  if(v==='progress'){
    var STAGES=[['PREPARING','Hazırlanıyor'],['VERIFYING','Doğrulanıyor'],['AWAITING_CONFIRM','Onay bekleniyor'],['SAFEGUARDING','Güvenlik yedeği'],['COMMITTING','Kaydediliyor'],['VERIFYING_COMMIT','Commit doğrulanıyor'],['DONE','Tamamlandı']];
    var order=['PREPARING','VERIFYING','PREVIEW','AWAITING_CONFIRM','SAFEGUARDING','COMMITTING','VERIFYING_COMMIT','FINALIZING','DONE','IDLE'];
    var cur=RESTORE_UI.stage||RESTORE.state;var curIdx=order.indexOf(cur==='FINALIZING'||cur==='IDLE'?'DONE':cur);
    h+='<h2 style="font-size:17px;font-weight:800;margin-bottom:14px">Geri Yükleme Uygulanıyor</h2>';
    h+='<div style="display:flex;flex-direction:column;gap:8px">';
    STAGES.forEach(function(s){var i=order.indexOf(s[0]);var done=i<curIdx,now=i===curIdx;
      var dot=done?ic('check',13,'#fff'):(now?'●':'○');var col=done?'var(--green)':(now?'var(--blue)':'var(--s2)');var tc=done||now?'var(--t)':'var(--t3)';
      h+='<div style="display:flex;align-items:center;gap:10px"><span style="width:22px;height:22px;border-radius:50%;background:'+col+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px">'+dot+'</span><span style="font-size:12.5px;color:'+tc+';font-weight:'+(now?'700':'500')+'">'+s[1]+(now?'…':'')+'</span></div>';});
    h+='</div><p style="font-size:11px;color:var(--t3);margin-top:14px;text-align:center">Lütfen bekleyin, bu pencereyi kapatmayın.</p>';
    showModal(h);return;
  }
  if(v==='result'){
    var r=RESTORE_UI.report||{};var dur=(r.finishedAt&&r.startedAt)?Math.max(0,Math.round((r.finishedAt-r.startedAt)/1000)):null;
    var ok=r.outcome==='committed';
    h+='<div style="text-align:center;margin-bottom:14px">'+ic(ok?'check':'ci',34,ok?'var(--green)':'var(--orange)')+'<h2 style="font-size:18px;font-weight:800;margin-top:8px">'+(ok?'Geri Yükleme Tamamlandı':'Geri Yükleme Sonucu')+'</h2></div>';
    h+='<div class="card" style="padding:12px 14px;margin-bottom:12px">';
    function row(k,val){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--s2)"><span style="color:var(--t3)">'+k+'</span><span style="font-weight:700">'+val+'</span></div>';}
    h+=row('Sonuç',ok?'Başarılı':(r.outcome||'?'));
    if(r.restoredRevision!=null)h+=row('Yeni sürüm',r.restoredRevision);
    if(r.sourceRevision!=null)h+=row('Önceki sürüm',r.sourceRevision);
    h+=row('Güvenlik yedeği',r.safeguardBackupId?'Oluşturuldu ✓':'—');
    h+=row('Etkilenen modül',(r.affectedModules&&r.affectedModules.length)||0);
    if(r.previewTotals)h+=row('Değişiklik','+'+(r.previewTotals.added||0)+' / −'+(r.previewTotals.removed||0)+' / ~'+(r.previewTotals.changed||0));
    if(dur!=null)h+=row('Süre',dur+' sn');
    h+=row('Doğrulandı',r.commitVerified?'Evet ✓':'—');
    h+='</div>';
    h+='<div style="display:flex;justify-content:flex-end"><button class="btn btn-p" onclick="rstFinishModal()">Tamam</button></div>';
    showModal(h);return;
  }
  if(v==='error'){
    var code=RESTORE_UI.error||'EXECUTE_FAILED';
    h+='<div style="text-align:center;margin-bottom:12px">'+ic('ci',34,'var(--red)')+'<h2 style="font-size:17px;font-weight:800;margin-top:8px">Geri Yükleme Yapılamadı</h2></div>';
    h+='<div style="padding:12px 14px;border-radius:10px;background:var(--bl);border-left:3px solid var(--red);margin-bottom:14px"><p style="font-size:12.5px;color:var(--t2);line-height:1.55">'+U.esc(rstErrMsg(code))+'</p><p style="font-size:10px;color:var(--t3);margin-top:6px">Kod: '+U.esc(code)+'</p></div>';
    h+='<div style="display:flex;justify-content:flex-end"><button class="btn btn-p" onclick="rstFinishModal()">Kapat</button></div>';
    showModal(h);return;
  }
}
window.renderRestoreModal=renderRestoreModal;
function rstToggleAccept(ch){RESTORE_UI.accepted=!!ch;var b=ge('rst_go');if(b){if(ch){b.disabled=false;b.style.opacity='';b.style.pointerEvents='';}else{b.disabled=true;b.style.opacity='.5';b.style.pointerEvents='none';}}}
window.rstToggleAccept=rstToggleAccept;
function rstStartProgress(){rstStopProgress();RESTORE_UI.progressTimer=setInterval(function(){if(RESTORE_UI.stage!==RESTORE.state){RESTORE_UI.stage=RESTORE.state;if(RESTORE_UI.view==='progress')renderRestoreModal();}},120);}
function rstStopProgress(){if(RESTORE_UI.progressTimer){clearInterval(RESTORE_UI.progressTimer);RESTORE_UI.progressTimer=null;}}
async function rstConfirmExecute(){
  if(RESTORE_UI.busy||!RESTORE_UI.accepted||!RESTORE_UI.opId)return;
  RESTORE_UI.busy=true;
  var cf=confirmRestore(RESTORE_UI.opId);           // GÜVENLİK: confirm olmadan execute YOK
  if(cf.status!=='confirmed'){RESTORE_UI.busy=false;RESTORE_UI.view='error';RESTORE_UI.error=(cf.error&&cf.error.code)||'NOT_CONFIRMED';renderRestoreModal();return;}
  RESTORE_UI.view='progress';RESTORE_UI.stage=RESTORE.state;renderRestoreModal();rstStartProgress();
  var res=await executeRestore(RESTORE_UI.opId);
  if(res.status==='uncertain'){
    RESTORE_UI.stage='VERIFYING_COMMIT';renderRestoreModal();
    var vo=await verifyRestoreOutcome(RESTORE_UI.opId);
    rstStopProgress();RESTORE_UI.busy=false;
    if(vo.status==='success'){RESTORE_UI.report=vo.report;RESTORE_UI.view='result';}
    else{RESTORE_UI.report=vo.report||null;RESTORE_UI.view='error';RESTORE_UI.error=(vo.report&&vo.report.outcome==='not_committed')?'NOT_COMMITTED':'COMMIT_UNCERTAIN';}
    RESTORE_UI.opId=null;renderRestoreModal();return;
  }
  rstStopProgress();RESTORE_UI.busy=false;RESTORE_UI.opId=null;
  if(res.status==='success'){RESTORE_UI.report=res.report;RESTORE_UI.view='result';}
  else{RESTORE_UI.view='error';RESTORE_UI.error=(res.error&&res.error.code)||'EXECUTE_FAILED';}
  renderRestoreModal();
}
window.rstConfirmExecute=rstConfirmExecute;
function rstCancel(){
  if(RESTORE_UI.opId){try{cancelRestore(RESTORE_UI.opId);}catch(e){}RESTORE_UI.opId=null;}
  rstStopProgress();RESTORE_UI.view='list';RESTORE_UI.busy=false;RESTORE_UI.accepted=false;
  sh('modal-root','');
}
window.rstCancel=rstCancel;
function rstFinishModal(){
  rstStopProgress();RESTORE_UI.view='list';RESTORE_UI.opId=null;RESTORE_UI.busy=false;RESTORE_UI.accepted=false;
  sh('modal-root','');
  rstLoadList();                                    // yeni before_restore yedegi listeye gelsin
}
window.rstFinishModal=rstFinishModal;
/* closeModal (scrim) restore oturumunu guvenle iptal etsin (yalniz iptal edilebilir asamada). */
function rstMaybeCancelSession(){
  if(RESTORE_UI.opId&&['PREPARING','VERIFYING','PREVIEW','AWAITING_CONFIRM'].indexOf(RESTORE.state)>=0){
    try{cancelRestore(RESTORE_UI.opId);}catch(e){}
    RESTORE_UI.opId=null;RESTORE_UI.view='list';RESTORE_UI.busy=false;RESTORE_UI.accepted=false;rstStopProgress();
  }
}

