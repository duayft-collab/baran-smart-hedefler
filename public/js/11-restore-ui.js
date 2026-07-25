/* RESTORE-UX-P2 madde 2: gerçek BACKUP_REASONS (js/03-auth.js) değerlerine dayalı filtreler.
   'migration' (bare, hiçbir kod yolu tarafından fiilen üretilmiyor) ve gelecekte çıkabilecek
   herhangi bilinmeyen bir reason, isimlendirilmemiş oldukları için 'other' altına düşer —
   gizlenmez, "Diğer" filtresinde görünür kalır. */
var RST_FILTER_DEFS=[
  {key:'all',label:'Tümü'},
  {key:'manual',label:'Manuel',reason:'manual'},
  {key:'daily',label:'Otomatik',reason:'daily'},
  {key:'before_restore',label:'Restore Öncesi',reason:'before_restore'},
  {key:'before_migration',label:'Migration Öncesi',reason:'before_migration'},
  {key:'before_import',label:'Import Öncesi',reason:'before_import'},
  {key:'before_conflict_overwrite',label:'Conflict Overwrite Öncesi',reason:'before_conflict_overwrite'},
  {key:'emergency',label:'Acil',reason:'before_bulk_delete'},
  {key:'other',label:'Diğer'}
];
var RST_NAMED_REASONS=RST_FILTER_DEFS.filter(function(f){return f.reason;}).map(function(f){return f.reason;});
function rstMatchesFilter(m,key){
  if(key==='all')return true;
  if(key==='other')return RST_NAMED_REASONS.indexOf(m.reason)<0;
  var def=RST_FILTER_DEFS.filter(function(f){return f.key===key;})[0];
  return !!def&&m.reason===def.reason;
}
function rstFilterCounts(){
  var backups=RESTORE_UI.backups||[],counts={};
  RST_FILTER_DEFS.forEach(function(f){counts[f.key]=backups.filter(function(m){return rstMatchesFilter(m,f.key);}).length;});
  return counts;
}
function renderRestore(){
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Yedekler / Geri Yükleme</h1><p class="sh-sub">Bir yedek seç, önizle ve güvenle geri yükle. Geri yükleme öncesi otomatik güvenlik yedeği alınır.</p></div>';
  h+='<button class="btn btn-g" onclick="rstLoadList()">'+ic('ci',13)+' Yenile</button></div>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">';
  h+='<input class="inp" id="rst_search" style="max-width:280px" placeholder="Yedeklerde ara (açıklama, tarih, tip)..." value="'+U.esc(RESTORE_UI.query)+'" oninput="rstSetQuery(this.value)">';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';
  var counts=rstFilterCounts();
  RST_FILTER_DEFS.forEach(function(f){var a=RESTORE_UI.filter===f.key;
    h+='<button class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'" data-v="'+f.key+'" onclick="rstSetFilter(this.dataset.v)">'+f.label+' ('+(counts[f.key]||0)+')</button>';});
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
    if(!rstMatchesFilter(m,f))return false;
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
    h+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'+rstReasonPill(m.reason)+rstHealthBadge(m)+(m.suspect?'<span class="pill p-orange" style="font-size:9px">Şüpheli</span>':'')+'<p style="font-weight:700;font-size:13.5px;word-break:break-word">'+U.esc(m.label||_gnDate(m.createdAtClient))+'</p></div>';
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
/* RESTORE-UX-P2: filtre değişimi açık bir onay/önizleme oturumunu YARIM bırakmaz — varsa
   önce güvenle iptal edilir (cancelRestore, mevcut motor), sonra filtre değişir. Bu, "filtre
   değişince seçili backup yanlışlıkla restore edilmez" kuralının doğrudan uygulanışı. */
function rstSetFilter(v){
  if(RESTORE_UI.opId){try{cancelRestore(RESTORE_UI.opId);}catch(e){}RESTORE_UI.opId=null;RESTORE_UI.preview=null;sh('modal-root','');rstResetConfirmState();}
  RESTORE_UI.filter=v;renderRestore();
}
window.rstSetQuery=rstSetQuery;window.rstSetFilter=rstSetFilter;
/* ── Önizleme + onay ── */
async function rstOpenPreview(backupId){
  if(RESTORE_UI.busy)return;
  // Aktif oturum varsa once guvenle iptal (yeni preview icin)
  if(RESTORE_UI.opId){try{cancelRestore(RESTORE_UI.opId);}catch(e){}RESTORE_UI.opId=null;}
  RESTORE_UI.busy=true;RESTORE_UI.view='loading';RESTORE_UI.backupId=backupId;rstResetConfirmState();RESTORE_UI.error=null;
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
/* RESTORE-UX-P0: goruntulenecek modul sirasi + Turkce etiketler (motor DEGISMEDI,
   yalniz buildRestorePreview'in zaten hesapladigi perModule verisi yuzeye cikariliyor). */
/* RESTORE-UX-P0 revizyon: alfabetik değil, kullanıcının değer sırasına göre 4 katman:
   kritik kişisel içerik > diğer kişisel kayıtlar > operasyonel > geri kalan. */
var RST_MODULE_ORDER=[
  'wisdomQuotes','principles','goals',      // en değerli / kritik
  'generalNotes','journal','logs',
  'todos','habits','routines',
  'quotes','kpis'                            // diğerleri
];
var RST_MODULE_TIER_BREAKS={'generalNotes':1,'todos':1};   // bu alandan önce görsel ayraç
var RST_MODULE_LABELS={goals:'Hedefler',todos:'Görevler',habits:'Alışkanlıklar',journal:'Günlük',
  quotes:'Öz Sözler (Legacy)',wisdomQuotes:'Özlü Sözler',principles:'İlkeler',generalNotes:'Genel Notlar',
  logs:'Kayıtlar',kpis:'KPI',routines:'Rutinler'};
/* RESTORE-UX-P2: cur/tgt hesaplaması artık paylaşılan tek yerden (P0'da rstModuleRow'a
   gömülüydü, P2'nin sonuç-özeti de aynı hesaba ihtiyaç duyunca çıkarıldı — motor DEĞİŞMEDİ,
   yalnız zaten var olan perModule alanlarından türetilen saf aritmetik. */
function rstModuleCurTgt(d){
  return {cur:(d.unchanged||0)+(d.changed||0)+(d.removed||0), tgt:(d.unchanged||0)+(d.changed||0)+(d.added||0)};
}
/* Sifir-fark modul de gizlenmez ("Degisiklik yok" olarak isaretlenir) — RESTORE-UX-P0 madde 2. */
function rstModuleRow(pv,field,label){
  var d=pv.perModule&&pv.perModule[field];if(!d)return '';
  var ct=rstModuleCurTgt(d);
  var noChange=!d.added&&!d.removed&&!d.changed;
  var right=noChange
    ? '<span style="color:var(--t3)">Değişiklik yok ('+ct.cur+')</span>'
    : '<span style="color:var(--t3)">'+ct.cur+' → '+ct.tgt+' &nbsp;(+'+d.added+' / −'+d.removed+' / ~'+d.changed+')</span>';
  return '<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0"><span style="color:var(--t2)">'+label+'</span>'+right+'</div>';
}
/* RESTORE-UX-P2 madde 1: restore sonuç ekranı için modül-bazlı özet satırı (3 satırlı,
   daha belirgin format). Yalnız RESTORE_UI.preview.perModule'ü (zaten hesaplanmış, motor
   tarafından üretilmiş veri) okur — yeniden diff hesaplama YOK. */
function rstResultModuleRow(field,label,d){
  var ct=rstModuleCurTgt(d);
  return '<div class="card" style="padding:8px 10px;margin-bottom:6px">'
    +'<p style="font-size:11.5px;font-weight:700;color:var(--t2);margin-bottom:2px">'+U.esc(label)+'</p>'
    +'<p style="font-size:13.5px;font-weight:800">'+ct.cur+' → '+ct.tgt+'</p>'
    +'<p style="font-size:10.5px;color:var(--t3);margin-top:1px">+'+(d.added||0)+' / −'+(d.removed||0)+' / ~'+(d.changed||0)+'</p>'
    +'</div>';
}
function rstResultModuleRows(perModule,showAll){
  var rows='';
  RST_MODULE_ORDER.forEach(function(f){
    var d=perModule&&perModule[f];if(!d)return;
    var changed=!!(d.added||d.removed||d.changed);
    if(!showAll&&!changed)return;               // kompakt: yalnız gerçekten değişenler
    rows+=rstResultModuleRow(f,RST_MODULE_LABELS[f]||f,d);
  });
  return rows;
}
function rstToggleResultShowAll(){ RESTORE_UI.resultShowAll=!RESTORE_UI.resultShowAll; renderRestoreModal(); }
window.rstToggleResultShowAll=rstToggleResultShowAll;
function renderRestoreModal(){
  var v=RESTORE_UI.view,h='';
  if(v==='loading'){showModal('<div style="padding:34px;text-align:center;color:var(--t3)">Önizleme hazırlanıyor…</div>');return;}
  if(v==='preview'){
    var pv=RESTORE_UI.preview,risk=rstRisk(pv),sus=RESTORE_UI.suspect;
    var affected=pv.affectedModules||[],totals=pv.totals||{};
    h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px"><h2 style="font-size:17px;font-weight:800">Geri Yükleme Önizlemesi</h2><button class="btn btn-g btn-ic" style="width:30px;height:30px" onclick="rstCancel()">'+ic('x',14)+'</button></div>';
    h+='<div style="padding:10px 12px;border-radius:10px;background:'+risk.bg+';color:#fff;margin-bottom:12px"><b style="font-size:13px">'+risk.label+'</b><div style="font-size:11px;opacity:.9;margin-top:2px">Yıkıcı etki: '+(pv.destructiveImpact||'?')+' · Güven: '+(pv.confidence||'?')+'</div></div>';
    /* RESTORE-UX-P1 madde 3: revizyon karşılaştırması — veri buildRestorePreview'da zaten vardı, hiç render edilmiyordu. */
    if(pv.sourceRevision!=null||pv.targetRevision!=null){
      h+='<p style="font-size:11px;color:var(--t2);margin-bottom:8px">Mevcut Revizyon: <b>'+(pv.sourceRevision!=null?pv.sourceRevision:'?')+'</b> &nbsp;→&nbsp; Restore Revizyonu: <b>'+(pv.targetRevision!=null?pv.targetRevision:'?')+'</b></p>';
    }
    h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">';
    h+='<div class="card" style="padding:9px 12px;flex:1;min-width:100px"><p style="font-size:10px;color:var(--t3)">Etkilenen modül</p><p style="font-size:18px;font-weight:800">'+affected.length+'</p></div>';
    h+='<div class="card" style="padding:9px 12px;flex:1;min-width:100px"><p style="font-size:10px;color:var(--t3)">Eklenecek/Silinecek/Değişecek</p><p style="font-size:14px;font-weight:800">+'+(totals.added||0)+' / −'+(totals.removed||0)+' / ~'+(totals.changed||0)+'</p></div>';
    h+='</div>';
    /* RESTORE-UX-P1 madde 2: kritik modüller için mutlak sayı karşılaştırması ("Şu an X → Restore Y").
       Yalnız delta (+/-/~) yetersizdi; en değerli koleksiyonlar için ayrı, göz ardı edilemez bir blok. */
    var critCompare=(IMPACT_RULES.criticalModules||[]).map(function(m){
      var d=pv.perModule&&pv.perModule[m];if(!d||(!d.added&&!d.removed&&!d.changed))return null;
      var cur=(d.unchanged||0)+(d.changed||0)+(d.removed||0), tgt=(d.unchanged||0)+(d.changed||0)+(d.added||0);
      return {m:m,cur:cur,tgt:tgt};
    }).filter(Boolean);
    if(critCompare.length){
      h+='<div class="card" style="padding:9px 12px;margin-bottom:12px">';
      h+='<p style="font-size:10px;color:var(--t3);margin-bottom:6px">Karşılaştırma</p>';
      critCompare.forEach(function(c){
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-top:1px solid var(--s2)">';
        h+='<span style="font-size:12px;color:var(--t2)">'+U.esc(RST_MODULE_LABELS[c.m]||c.m)+'</span>';
        h+='<span style="font-size:12px"><span style="color:var(--t3)">Şu an: </span><b>'+c.cur+'</b> &nbsp;→&nbsp; <span style="color:var(--t3)">Restore: </span><b>'+c.tgt+'</b></span>';
        h+='</div>';
      });
      h+='</div>';
    }
    /* RESTORE-UX-P0 madde 1: Yumuşak uyarı — genel silinme oranı yüksekse (impact high/critical). */
    if(pv.destructiveImpact==='high'||pv.destructiveImpact==='critical'){
      h+='<div style="padding:8px 12px;border-radius:8px;background:var(--bl);border-left:3px solid var(--orange);margin-bottom:12px"><p style="font-size:12px;color:var(--t2);line-height:1.6">Bu restore mevcut verilerin önemli bir bölümünü kaldıracak.<br>Silinecek toplam kayıt: '+(totals.removed||0)+'<br>Değişecek kayıt: '+(totals.changed||0)+'</p></div>';
    }
    var modRows=RST_MODULE_ORDER.map(function(f){
      var row=rstModuleRow(pv,f,RST_MODULE_LABELS[f]);
      if(row&&RST_MODULE_TIER_BREAKS[f])row='<div style="border-top:1px solid var(--s2);margin-top:4px;padding-top:4px"></div>'+row;
      return row;
    }).join('');
    if(modRows)h+='<div class="card" style="padding:8px 12px;margin-bottom:12px"><p style="font-size:10px;color:var(--t3);margin-bottom:4px">Modül değişiklikleri</p>'+modRows+'</div>';
    if(affected.length)h+='<p style="font-size:11px;color:var(--t2);margin-bottom:10px"><b>Etkilenen:</b> '+affected.map(function(m){return U.esc(m);}).join(', ')+'</p>';
    var warns=(RESTORE_UI.warnings||[]).concat((sus&&sus.reasons)||[]);
    var uniqW=warns.filter(function(w,i){return warns.indexOf(w)===i;});
    if(uniqW.length){h+='<div style="padding:8px 12px;border-radius:8px;background:var(--bl);border-left:3px solid var(--orange);margin-bottom:12px"><p style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:3px">'+ic('ci',11,'var(--orange)')+' Uyarılar</p>';uniqW.forEach(function(w){h+='<p style="font-size:11px;color:var(--t2);line-height:1.5">• '+U.esc(w)+'</p>';});h+='</div>';}
    /* RESTORE-UX-P0 madde 4 (RESTORE-GUARD-01): kritik modüllerden biri criticalDropPct'i aşınca sert kapı. */
    var hardGate=(pv.destructiveImpact==='critical');
    if(hardGate){
      var critLines=(IMPACT_RULES.criticalModules||[]).map(function(m){
        var d=pv.perModule&&pv.perModule[m];if(!d||!d.removed)return null;
        var cur=(d.unchanged||0)+(d.changed||0)+(d.removed||0), tgt=(d.unchanged||0)+(d.changed||0)+(d.added||0);
        return {m:m,cur:cur,tgt:tgt};
      }).filter(Boolean);
      h+='<div style="padding:10px 12px;border-radius:8px;background:var(--bl);border-left:3px solid var(--red);margin-bottom:12px">';
      h+='<p style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px">Bu işlem geri alınabilir ancak önemli veri kaybına neden olabilir.</p>';
      critLines.forEach(function(c){h+='<p style="font-size:12px;color:var(--t2)">'+U.esc(RST_MODULE_LABELS[c.m]||c.m)+': '+c.cur+' → '+c.tgt+'</p>';});
      h+='<p style="font-size:11px;color:var(--t3);margin-top:8px">Devam etmek için aşağıya <b>RESTORE ONAY</b> yazın:</p>';
      h+='<input class="inp" id="rst_confirm_text" placeholder="RESTORE ONAY" value="'+U.esc(RESTORE_UI.confirmText||'')+'" oninput="rstSetConfirmText(this.value)" style="margin-top:6px;width:100%">';
      h+='</div>';
    }
    h+='<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:10px;border-radius:8px;background:var(--s2);margin-bottom:12px"><input type="checkbox" id="rst_accept" '+(RESTORE_UI.accepted?'checked':'')+' onchange="rstToggleAccept(this.checked)" style="margin-top:2px"><span style="font-size:12px;color:var(--t2)">Bu geri yüklemenin mevcut verimin üzerine yazacağını anlıyorum. İşlem öncesi otomatik <b>güvenlik yedeği</b> alınacak. <b>Kabul ediyorum.</b></span></label>';
    var confirmOk=!hardGate||rstConfirmTextOk(RESTORE_UI.confirmText);
    var goEnabled=!!(RESTORE_UI.accepted&&confirmOk);
    h+='<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="btn btn-g" onclick="rstCancel()">Vazgeç</button><button class="btn btn-p" id="rst_go" '+(goEnabled?'':'disabled style="opacity:.5;pointer-events:none"')+' onclick="rstConfirmExecute()">'+ic('arc',13)+' Geri Yükle</button></div>';
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
    /* RESTORE-UX-P2 madde 1: yalnız committed VE elimizde eşleşen bir preview varsa göster.
       Preview yoksa (örn. sayfa yenilendi) sahte/eksik bir özet UYDURULMAZ. */
    if(ok&&RESTORE_UI.preview&&RESTORE_UI.preview.perModule){
      var showAll=!!RESTORE_UI.resultShowAll;
      var resultRows=rstResultModuleRows(RESTORE_UI.preview.perModule,showAll);
      if(resultRows){
        h+='<p style="font-size:11px;font-weight:700;color:var(--t2);margin:12px 0 6px">Modül Değişiklikleri</p>';
        h+=resultRows;
        h+='<button class="btn btn-g btn-sm" onclick="rstToggleResultShowAll()" style="margin-bottom:12px">'+(showAll?'Yalnız değişenleri göster':'Tüm modülleri göster')+'</button>';
      }
    }
    h+='<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">';
    /* RESTORE-UX-P1 madde 1: tek-tık geri al — restore öncesi otomatik alınan safeguard
       yedeğini, kullanıcı yedek listesine gitmeden, doğrudan aynı önizleme akışına sokar. */
    if(ok&&r.safeguardBackupId)h+='<button class="btn btn-g" onclick="rstUndoLastRestore()">'+ic('arc',13)+' Bu Restore\'u Geri Al</button>';
    h+='<button class="btn btn-p" onclick="rstFinishModal()">Tamam</button></div>';
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
/* RESTORE-UX-P0 revizyon: typed-confirm case-insensitive (CAPS LOCK yüzünden gereksiz
   sürtünme olmasın); yalnız baş/son boşluk kırpılır + Türkçe-güvenli küçük harfe çevrilir. */
function rstConfirmTextOk(v){ return String(v||'').trim().toLocaleLowerCase('tr')==='restore onay'; }
/* RESTORE-UX-P0 revizyon: "Geri Yükle" butonu iki bağımsız koşula bağlı — checkbox onayı VE
   (yalnız hard-gate tetiklendiyse) doğru yazılmış "RESTORE ONAY" metni. Tek yerden hesaplanır. */
function rstUpdateGoButton(){
  var pv=RESTORE_UI.preview||{};
  var hardGate=pv.destructiveImpact==='critical';
  var confirmOk=!hardGate||rstConfirmTextOk(RESTORE_UI.confirmText);
  var enabled=!!(RESTORE_UI.accepted&&confirmOk);
  var b=ge('rst_go');
  if(b){if(enabled){b.disabled=false;b.style.opacity='';b.style.pointerEvents='';}else{b.disabled=true;b.style.opacity='.5';b.style.pointerEvents='none';}}
}
function rstToggleAccept(ch){RESTORE_UI.accepted=!!ch;rstUpdateGoButton();}
function rstSetConfirmText(v){RESTORE_UI.confirmText=v;rstUpdateGoButton();}
/* Önizleme her yenilendiğinde veya modal kapandığında eski onay/typed-confirm geçersiz olmalı. */
function rstResetConfirmState(){RESTORE_UI.accepted=false;RESTORE_UI.confirmText='';RESTORE_UI.resultShowAll=false;}
window.rstToggleAccept=rstToggleAccept;window.rstSetConfirmText=rstSetConfirmText;window.rstResetConfirmState=rstResetConfirmState;
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
  rstStopProgress();RESTORE_UI.view='list';RESTORE_UI.busy=false;rstResetConfirmState();
  sh('modal-root','');
}
window.rstCancel=rstCancel;
function rstFinishModal(){
  rstStopProgress();RESTORE_UI.view='list';RESTORE_UI.opId=null;RESTORE_UI.busy=false;rstResetConfirmState();
  sh('modal-root','');
  rstLoadList();                                    // yeni before_restore yedegi listeye gelsin
}
window.rstFinishModal=rstFinishModal;
/* RESTORE-UX-P1 madde 1: mevcut, zaten güvenli preview→confirm akışını safeguard yedeğine
   yönlendirir — yeni bir "onaysız anında geri al" mekanizması İCAT EDİLMEDİ, yalnız
   kullanıcının backup listesinde doğru ID'yi kendisi aramasına gerek kalmıyor. */
function rstUndoLastRestore(){
  var id=RESTORE_UI.report&&RESTORE_UI.report.safeguardBackupId;
  if(!id)return;
  rstOpenPreview(id);
}
window.rstUndoLastRestore=rstUndoLastRestore;
/* closeModal (scrim) restore oturumunu guvenle iptal etsin (yalniz iptal edilebilir asamada). */
function rstMaybeCancelSession(){
  if(RESTORE_UI.opId&&['PREPARING','VERIFYING','PREVIEW','AWAITING_CONFIRM'].indexOf(RESTORE.state)>=0){
    try{cancelRestore(RESTORE_UI.opId);}catch(e){}
    RESTORE_UI.opId=null;RESTORE_UI.view='list';RESTORE_UI.busy=false;RESTORE_UI.accepted=false;rstStopProgress();
  }
}

