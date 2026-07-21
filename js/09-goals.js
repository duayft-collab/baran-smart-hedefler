function openGoalDetail(goalId){
  /* FAZ-4.1: baska hedefe gecerken dirty not taslagi korumasi (ayni hedef re-render'da uyari YOK). */
  if(NOTE_DRAFT.goalId!==null&&NOTE_DRAFT.goalId!==goalId&&NOTE_DRAFT.dirty){
    if(!confirm('Kaydedilmemiş not değişiklikleri var. Bu hedefe geçilsin mi?'))return;
    clearNoteDraft();
  }
  openGId=goalId;
  var g=(D.goals||[]).find(function(x){return x.id===goalId;});if(!g)return;
  var p6=goalProgress(g),pc4=p6>=100?'var(--green)':p6>=60?'var(--blue)':p6>=30?'var(--orange)':'var(--red)';
  var cc5=GOAL_CC[g.cat||'Diğer']||'var(--t3)';
  var dl3=g.deadline?Math.ceil((new Date(g.deadline)-new Date())/864e5):null;
  var sc=smartScore(g),qi=qualityIndex(g),tips=goalCoach(g),mm=readMetric(g);
  var C2=2*Math.PI*36,doneS2=g.steps.filter(function(s){return s.done;}).length;
  var h='<div style="max-width:560px;background:var(--s);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;width:100%;max-height:88vh;display:flex;flex-direction:column">';
  h+='<div style="padding:18px 20px;background:'+cc5+'"><div style="display:flex;align-items:center;justify-content:space-between">';
  h+='<div style="display:flex;align-items:center;gap:8px">'+(g.frog?'<span style="font-size:18px">&#128056;</span>':'');
  h+='<div><p style="font-weight:700;font-size:15px;color:#fff;line-height:1.3">'+U.esc(g.title)+'</p>';
  h+='<div style="display:flex;gap:5px;margin-top:4px"><span style="background:rgba(255,255,255,.2);color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px">'+U.esc(g.cat||'')+'</span><span style="background:rgba(255,255,255,.2);color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px">'+g.quarter+'</span></div></div></div>';
  h+='<button class="btn" style="background:rgba(255,255,255,.2);color:#fff;width:30px;height:30px;padding:0;justify-content:center;border-radius:8px" onclick="closeModal()">'+ic('x',14,'#fff')+'</button></div></div>';
  h+='<div style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">';
  /* Ring */
  h+='<div style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center">';
  h+='<div style="position:relative;width:80px;height:80px"><svg viewBox="0 0 88 88" style="width:100%;height:100%"><circle cx="44" cy="44" r="36" fill="none" stroke="var(--s2)" stroke-width="6"/><circle cx="44" cy="44" r="36" fill="none" stroke="'+pc4+'" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+C2+'" stroke-dashoffset="'+(C2*(1-p6/100))+'" style="transform:rotate(-90deg);transform-origin:center"/></svg>';
  h+='<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="font-size:17px;font-weight:800;color:'+pc4+'">'+p6+'%</span></div></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">';
  [{l:'Adım',v:doneS2+'/'+g.steps.length,c:'var(--blue)'},{l:'SMART',v:sc+'/5',c:sc===5?'var(--green)':'var(--orange)'},{l:'Deadline',v:dl3===null?'Yok':dl3<0?'Gecti':dl3+'g',c:dl3!==null&&dl3<0?'var(--red)':'var(--t2)'},{l:'Durum',v:g.status==='done'?'Bitti':'Aktif',c:g.status==='done'?'var(--green)':'var(--orange)'}].forEach(function(s){
    h+='<div style="background:var(--s2);border-radius:8px;padding:8px 10px"><p style="font-size:10px;color:var(--t3);font-weight:600;margin-bottom:2px">'+s.l+'</p><p style="font-size:13px;font-weight:700;color:'+s.c+'">'+s.v+'</p></div>';
  });
  h+='</div></div>';
  /* Goal Quality Index + Coach */
  var qbc=qi.score>=70?'var(--green)':qi.score>=50?'var(--orange)':'var(--red)';
  h+='<div style="padding:12px 14px;background:var(--s2);border-radius:11px">';
  h+='<div style="display:flex;align-items:center;gap:11px"><div style="width:46px;height:46px;border-radius:11px;background:'+qbc+';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:17px;font-weight:800;color:#fff;line-height:1">'+qi.score+'</span><span style="font-size:8px;color:rgba(255,255,255,.85)">/100</span></div>';
  h+='<div style="flex:1"><p style="font-size:11px;color:var(--t3);font-weight:600">Kalite İndeksi</p><p style="font-size:14px;font-weight:800;color:'+qbc+'">'+qi.band+'</p></div>';
  h+='<button class="btn '+(tips.length?'btn-p':'btn-s')+' btn-sm" data-gid="'+g.id+'" onclick="openGoalEdit(+this.dataset.gid)">'+ic('edit',12)+(tips.length?' Geliştir':' Düzenle')+'</button></div>';
  if(tips.length){
    h+='<p style="font-size:11px;font-weight:700;color:var(--t2);margin-top:9px">Bu hedefi güçlendirmek için '+tips.length+' öneri</p>';
    h+='<div style="margin-top:5px;display:flex;flex-direction:column;gap:5px">';
    tips.forEach(function(t){h+='<div style="display:flex;gap:6px;align-items:flex-start"><span style="color:var(--blue);font-size:11px;font-weight:800;margin-top:1px">&rsaquo;</span><span style="font-size:11.5px;color:var(--t2);line-height:1.45">'+U.esc(t)+'</span></div>';});
    h+='</div>';
    var rw=suggestGoalRewrite(g);
    h+='<div style="margin-top:9px;padding:8px 10px;background:var(--bl);border-radius:8px"><p style="font-size:10px;color:var(--t3);font-weight:600;margin-bottom:2px">Önerilen yazım</p><p style="font-size:11.5px;color:var(--t2);line-height:1.45;font-style:italic">'+U.esc(rw.suggested)+'</p></div>';
  }else if(qi.score>=70){
    h+='<p style="font-size:11.5px;color:var(--green);font-weight:600;margin-top:9px">Hedef güçlü görünüyor.</p>';
  }
  h+='</div>';
  if(g.desc&&!isRichTextEmpty(g.desc))h+='<div class="rt" style="padding:10px 12px;background:var(--s2);border-radius:9px;border-left:3px solid '+cc5+';font-size:13px;color:var(--t2);line-height:1.6">'+renderRichText(g.desc)+'</div>';
  /* Sayisal ilerleme (metric) */
  if(mm.structured){var mp=metricPct(g);
    h+='<div style="padding:10px 12px;background:var(--bl);border-radius:9px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-size:12.5px;font-weight:600">'+ic('kpi',13,'var(--blue)')+' '+mm.current+' / '+mm.target+' '+U.esc(mm.unit)+'</span><span style="font-size:13px;font-weight:800;color:var(--blue)">%'+mp+'</span></div>'+progBar(mp)+'</div>';}
  else if(g.measurable)h+='<div style="display:flex;align-items:center;gap:7px;padding:8px 12px;background:var(--bl);border-radius:9px">'+ic('kpi',14,'var(--blue)')+'<span style="font-size:12.5px"><strong>Başarı:</strong> '+U.esc(g.measurable)+'</span></div>';
  /* Steps — normalize ile dual-read + string-guvenli ID. Duzenleme icin "Düzenle" (edit formu). */
  var dsteps=normalizeGoalSteps(g);
  h+='<div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px"><p style="font-weight:700;font-size:13px">Aksiyon Planı</p><div style="display:flex;gap:5px"><button class="btn btn-s btn-sm" data-gid="'+g.id+'" onclick="openGoalEdit(+this.dataset.gid)">'+ic('edit',11)+' Adımları Düzenle</button><button class="btn btn-s btn-sm" data-gid="'+g.id+'" onclick="openAddStep(+this.dataset.gid)">'+ic('plus',12)+' Adım</button></div></div>';
  if(!dsteps.length)h+='<div style="padding:14px;border:2px dashed var(--s3);border-radius:9px;text-align:center;color:var(--t3);font-size:12px">Adım eklenmedi</div>';
  else{
    h+='<div style="display:flex;flex-direction:column;gap:4px">';
    dsteps.forEach(function(s4){var sid=U.esc(String(s4.id));
      h+='<div style="display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:9px;background:'+(s4.done?'var(--gl)':'var(--s2)')+'">';
      h+='<input type="checkbox" class="cb" '+(s4.done?'checked':'')+' data-gid="'+g.id+'" data-sid="'+sid+'" onchange="toggleStep(+this.dataset.gid,this.dataset.sid)">';
      h+='<span style="font-size:12.5px;font-weight:500;text-decoration:'+(s4.done?'line-through':'none')+';color:'+(s4.done?'var(--t3)':'var(--t)')+';flex:1">'+U.esc(s4.t)+'</span>';
      h+='<button class="btn btn-g btn-ic" style="width:22px;height:22px;opacity:.5" data-gid="'+g.id+'" data-sid="'+sid+'" onclick="delStep(+this.dataset.gid,this.dataset.sid)">'+ic('x',10,'var(--t3)')+'</button></div>';
    });
    h+='</div>';
  }
  h+='</div>';
  h+='<div id="gnotes_box"></div>';
  h+='</div><div style="padding:12px 20px;border-top:1px solid var(--s2);display:flex;gap:8px">';
  if(g.status!=='done')h+='<button class="btn btn-p" style="flex:2;justify-content:center;background:var(--green)" data-gid="'+g.id+'" onclick="markGoalDone(+this.dataset.gid)">'+ic('chk',13)+' Tamamla (+100 XP)</button>';
  else h+='<button class="btn btn-s" style="flex:2;justify-content:center" data-gid="'+g.id+'" onclick="markGoalActive(+this.dataset.gid)">Tekrar Aktif</button>';
  h+='<button class="btn btn-s" onclick="closeModal()">Kapat</button></div></div>';
  showModal(h);
  /* FAZ-4.1: ayni hedef icin aktif taslak varsa edit modunu + taslagi KORU (re-render dayanikli). */
  if(NOTE_DRAFT.goalId===goalId){noteEditGid=goalId;}
  else{noteEditGid=null;noteExpanded=false;clearNoteDraft();}
  renderGoalNotesInto(g.id);
}
window.openGoalDetail=openGoalDetail;

function openAddStep(goalId){
  var h='<div class="mh"><span style="font-weight:700;font-size:15px">Adım Ekle</span><button class="btn btn-g btn-ic" onclick="closeModal()">'+ic('x',14)+'</button></div>';
  h+='<div class="mb"><p class="lbl" style="margin-bottom:3px">Aksiyon Adımi</p><input class="inp" id="step_inp" placeholder="Somut ve yapilabilir adım..." autofocus></div>';
  h+='<div class="mf"><button class="btn btn-s" style="flex:1" onclick="closeModal()">İptal</button><button class="btn btn-p" style="flex:2" data-gid="'+goalId+'" onclick="submitAddStep(+this.dataset.gid)">'+ic('plus',13)+' Ekle</button></div>';
  showModal(h);
}
window.openAddStep=openAddStep;

function submitAddStep(goalId){
  var inp=ge('step_inp');if(!inp||!inp.value.trim()){alert('Adım adi zorunlu!');return;}
  var chk=validateGoalStep(inp.value,(((D.goals||[]).find(function(x){return x.id===goalId;})||{}).steps)||[]);
  if(!chk.ok){alert(chk.reason);return;}
  snap();D.goals=D.goals.map(function(g){return g.id===goalId?Object.assign({},g,{steps:g.steps.concat([{id:newStepId(),t:inp.value.trim(),done:false}])}):g;});
  save();closeModal();openGoalDetail(goalId);
}
window.submitAddStep=submitAddStep;

function toggleStep(goalId,stepId){
  var sid=String(stepId);
  snap();
  D.goals=D.goals.map(function(g){
    if(g.id!==goalId)return g;
    var wasDone=(g.steps.find(function(s){return String(s&&s.id)===sid;})||{}).done;
    if(!wasDone)xp(10,'Adım tamamlandı');
    return Object.assign({},g,{steps:g.steps.map(function(s){return String(s&&s.id)===sid?Object.assign({},s,{done:!s.done}):s;})});
  });
  save();if(openGId===goalId)openGoalDetail(goalId);else renderPage();
}
window.toggleStep=toggleStep;

function delStep(goalId,stepId){
  var sid=String(stepId);
  snap();D.goals=D.goals.map(function(g){return g.id===goalId?Object.assign({},g,{steps:g.steps.filter(function(s){return String(s&&s.id)!==sid;})}):g;});
  save();if(openGId===goalId)openGoalDetail(goalId);else renderPage();
}
window.delStep=delStep;

/* ══ FAZ-4: Hedef detayinda hizli erisimli zengin Notlar ══
   Gorunum modu (rich onizleme + expand) <-> inline edit (toolbar+textarea+Kaydet/Iptal).
   Autosave YOK; acik Kaydet = 1 write. Iptal'de dirty uyarisi. FAZ-3 rich altyapisi yeniden kullanilir. */
var noteEditGid=null, noteExpanded=false;
/* FAZ-4.1: yeniden-render sirasinda taslak korumasi — YALNIZ bellekte, Firestore/localStorage YOK. */
var NOTE_DRAFT={goalId:null,value:'',originalValue:'',selectionStart:null,selectionEnd:null,dirty:false,updatedAt:0};
function noteDraftDirty(){return NOTE_DRAFT.goalId!==null&&NOTE_DRAFT.dirty;}
/* FAZ-4.2: ortak taslak-atma onayi. dirty degilse true; dirty ise confirm (vazgec=false, onay=temizle+true).
   Cagiran ONCE bunu kontrol etmeli — hicbir state degismeden. */
function confirmDiscardNoteDraft(){
  if(!noteDraftDirty())return true;
  if(!confirm('Kaydedilmemiş not değişiklikleri var. Devam edilsin mi?'))return false;
  clearNoteDraft();noteEditGid=null;return true;
}
window.confirmDiscardNoteDraft=confirmDiscardNoteDraft;
function captureNoteDraft(){
  var ta=ge('gnote_ta');if(!ta||NOTE_DRAFT.goalId===null)return;
  NOTE_DRAFT.value=ta.value;
  try{NOTE_DRAFT.selectionStart=ta.selectionStart;NOTE_DRAFT.selectionEnd=ta.selectionEnd;}catch(e){}
  NOTE_DRAFT.dirty=(ta.value!==NOTE_DRAFT.originalValue);NOTE_DRAFT.updatedAt=Date.now();
  var st=ge('gnote_status');if(st)st.textContent=NOTE_DRAFT.dirty?'Kaydedilmemiş değişiklik · Taslak korunuyor':'';
}
function restoreNoteDraft(){
  var ta=ge('gnote_ta');if(!ta||NOTE_DRAFT.goalId===null)return;
  ta.value=NOTE_DRAFT.value;
  try{ta.focus();var s=NOTE_DRAFT.selectionStart,e=NOTE_DRAFT.selectionEnd;
    if(s===null){s=e=ta.value.length;}
    ta.selectionStart=Math.min(s,ta.value.length);ta.selectionEnd=Math.min(e,ta.value.length);}catch(err){}
}
function clearNoteDraft(){NOTE_DRAFT={goalId:null,value:'',originalValue:'',selectionStart:null,selectionEnd:null,dirty:false,updatedAt:0};}
window.captureNoteDraft=captureNoteDraft;window.clearNoteDraft=clearNoteDraft;
function noteIsLong(notes){var pt=richTextToPlainText(notes);return pt.length>220||((notes||'').match(/\n/g)||[]).length>=6;}
function renderGoalNotesInto(goalId){
  var box=ge('gnotes_box');if(!box)return;
  var g=(D.goals||[]).find(function(x){return x.id===goalId;});if(!g)return;
  box.innerHTML=(noteEditGid===goalId)?noteEditHtml(g):noteViewHtml(g);
  if(noteEditGid===goalId)restoreNoteDraft();
}
window.renderGoalNotesInto=renderGoalNotesInto;
function noteViewHtml(g){
  var empty=isRichTextEmpty(g.notes);
  var h='<div style="margin-top:2px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">';
  h+='<p style="font-weight:700;font-size:13px">Notlar <span style="font-size:10px;color:var(--t3);font-weight:500">(ilerlemeyi etkilemez)</span></p>';
  h+='<button class="btn btn-s btn-sm" data-gid="'+g.id+'" onclick="noteEdit(+this.dataset.gid)">'+ic('edit',11)+(empty?' Not Ekle':' Notu Düzenle')+'</button></div>';
  if(empty){
    h+='<div style="padding:14px;border:2px dashed var(--s3);border-radius:9px;text-align:center;color:var(--t3);font-size:12px">Bu hedef için ilk notunu ekle</div>';
  }else{
    var long=noteIsLong(g.notes);
    h+='<div class="rt'+(long&&!noteExpanded?' note-clamp':'')+'" style="padding:10px 12px;background:var(--s2);border-radius:9px;font-size:12.5px;line-height:1.55;color:var(--t)">'+renderRichText(g.notes)+'</div>';
    if(long)h+='<button class="btn btn-g btn-sm" style="margin-top:5px" data-gid="'+g.id+'" onclick="noteToggleExpand(+this.dataset.gid)">'+(noteExpanded?'Daralt':'Devamını Göster')+'</button>';
    if(g.notesMeta&&g.notesMeta.updatedAt)h+='<p style="font-size:10px;color:var(--t3);margin-top:5px">Son güncelleme: '+U.esc(String(g.notesMeta.updatedAt))+'</p>';
  }
  h+='</div>';return h;
}
function noteEditHtml(g){
  var h='<div style="margin-top:2px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">';
  h+='<p style="font-weight:700;font-size:13px">Notu Düzenle <span style="font-size:10px;color:var(--t3);font-weight:500">(ilerlemeyi etkilemez)</span></p></div>';
  h+=rtBar('gnote_ta');
  var draftVal=(NOTE_DRAFT.goalId===g.id)?NOTE_DRAFT.value:(g.notes||'');
  h+='<textarea class="inp" id="gnote_ta" rows="5" oninput="captureNoteDraft()" placeholder="Notlar... (**kalın**, *italik*, - liste, 1. numaralı, [ ] yapılacak)">'+U.esc(draftVal)+'</textarea>';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 6px;gap:8px"><span style="font-size:10px;color:var(--t3)">Not içindeki checklist, hedef ilerlemesini etkilemez.</span><span id="gnote_status" style="font-size:10px;color:var(--orange);font-weight:600">'+(NOTE_DRAFT.goalId===g.id&&NOTE_DRAFT.dirty?'Kaydedilmemiş değişiklik · Taslak korunuyor':'')+'</span></div>';
  h+='<div style="display:flex;gap:7px"><button class="btn btn-s btn-sm" style="flex:1" data-gid="'+g.id+'" onclick="noteCancel(+this.dataset.gid)">İptal</button>';
  h+='<button class="btn btn-p btn-sm" style="flex:2" data-gid="'+g.id+'" onclick="noteSave(+this.dataset.gid)">'+ic('chk',12)+' Kaydet</button></div></div>';
  return h;
}
function noteEdit(goalId){
  var g=(D.goals||[]).find(function(x){return x.id===goalId;});var cur=(g&&g.notes)||'';
  NOTE_DRAFT={goalId:goalId,value:cur,originalValue:cur,selectionStart:null,selectionEnd:null,dirty:false,updatedAt:0};
  noteEditGid=goalId;renderGoalNotesInto(goalId);                                     /* write YOK */
}
function noteToggleExpand(goalId){noteExpanded=!noteExpanded;renderGoalNotesInto(goalId);}
function noteDirty(g){var ta=ge('gnote_ta');return ta?(ta.value!==(g.notes||'')):false;}
function noteCancel(goalId){
  if(noteDraftDirty()&&!confirm('Kaydedilmemiş değişiklikler var. Yine de kapatılsın mı?'))return;
  clearNoteDraft();noteEditGid=null;renderGoalNotesInto(goalId);                       /* write YOK */
}
function noteSave(goalId){
  var ta=ge('gnote_ta');if(!ta)return;
  var val=isRichTextEmpty(ta.value)?'':sanitizeRichText(ta.value);
  var g=(D.goals||[]).find(function(x){return x.id===goalId;});
  if(g&&(g.notes||'')===val){clearNoteDraft();noteEditGid=null;renderGoalNotesInto(goalId);return;} /* degisiklik yok -> write yok */
  snap();
  D.goals=D.goals.map(function(x){return x.id===goalId?Object.assign({},x,{notes:val,notesMeta:{updatedAt:U.today()}}):x;});
  save();                                                                              /* yalniz 1 write */
  clearNoteDraft();noteEditGid=null;renderGoalNotesInto(goalId);
}
window.noteEdit=noteEdit;window.noteToggleExpand=noteToggleExpand;window.noteCancel=noteCancel;window.noteSave=noteSave;

function markGoalDone(goalId){
  var g=(D.goals||[]).find(function(x){return x.id===goalId;});if(!g)return;
  // Completion gate: dusuk kaliteli hedef tek tikla tamamlanamaz
  var qi=qualityIndex(g);
  if(qi.score<50&&!confirm('Bu hedef yeterince kaliteli görünmüyor (Kalite '+qi.score+'/100). '+
    'Anlamsız bir hedefi tamamlamak sistemin değerini düşürür. Yine de tamamlansın mı?'))return;
  snap();D.goals=D.goals.map(function(x){return x.id===goalId?Object.assign({},x,{status:'done',completedAt:U.today()}):x;});
  xp(100,'Hedef tamamlandı');save();closeModal();renderPage();
}
function markGoalActive(goalId){snap();D.goals=D.goals.map(function(g){return g.id===goalId?Object.assign({},g,{status:'active',completedAt:null}):g;});save();closeModal();renderPage();}
window.markGoalDone=markGoalDone;window.markGoalActive=markGoalActive;


function renderTodos(){
  var all=D.todos||[];
  var filtered=fil(all,['text','category']);
  var done=all.filter(function(t){return t.done;}).length;
  var urgent=all.filter(function(t){return !t.done&&t.priority==='urgent';}).length;
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Yapılacaklar</h1><p class="sh-sub">Eisenhower Matrisi</p></div>';h+=quoteWidget('Üretkenlik','var(--orange)');
  h+='<div style="display:flex;gap:7px"><div style="display:flex;gap:3px;background:var(--s2);border-radius:8px;padding:3px">';
  [{v:'list',l:'Liste'},{v:'matrix',l:'Matris'}].forEach(function(vv){var a=todoView===vv.v;h+='<button class="btn btn-sm" style="padding:4px 10px;background:'+(a?'var(--s)':'transparent')+';color:'+(a?'var(--t)':'var(--t2)')+'" data-tv="'+vv.v+'" onclick="todoView=this.dataset.tv;renderPage()">'+vv.l+'</button>';});
  h+='</div><button class="btn btn-p" data-type="todo" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' Görev Ekle</button></div></div>';
  h+='<div class="g4" style="margin-bottom:16px">';
  h+=statCard('Toplam',all.length,'csq','var(--blue)');
  h+=statCard('Tamamlandı',done,'chk','var(--green)');
  h+=statCard('Acil',urgent,'flame','var(--red)');
  h+=statCard('Bekleyen',all.length-done,'ci','var(--orange)');
  h+='</div>';
  if(todoView==='matrix'){
    var quads=[{p:'urgent',l:'Hemen Yap',c:'var(--red)',e:'&#128293;'},{p:'high',l:'Planla',c:'var(--blue)',e:'&#128197;'},{p:'normal',l:'Delege Et',c:'var(--orange)',e:'&#128101;'},{p:'low',l:'Sil',c:'var(--t3)',e:'&#128465;'}];
    h+='<div class="g2">';
    quads.forEach(function(q){
      var qi=filtered.filter(function(t){return !t.done&&(q.p==='low'?['urgent','high','normal'].indexOf(t.priority)<0:t.priority===q.p);});
      h+='<div class="card" style="padding:14px 16px;border-top:3px solid '+q.c+'"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:18px">'+q.e+'</span><p style="font-weight:700;font-size:13px;color:'+q.c+'">'+q.l+'</p><span class="pill p-gray" style="font-size:9px;margin-left:auto">'+qi.length+'</span></div><div style="display:flex;flex-direction:column;gap:5px">';
      if(!qi.length)h+='<p style="font-size:11.5px;color:var(--t3);font-style:italic;text-align:center;padding:10px 0">Bos</p>';
      qi.slice(0,6).forEach(function(t){h+='<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:var(--s2);border-radius:8px"><input type="checkbox" class="cb" data-tid="'+t.id+'" onchange="toggleTodo(+this.dataset.tid)"><span style="font-size:12.5px;font-weight:500;flex:1">'+U.esc(t.text.slice(0,36))+(t.text.length>36?'...':'')+'</span></div>';});
      if(qi.length>6)h+='<p style="font-size:11px;color:var(--t3);text-align:center">+'+(qi.length-6)+' daha</p>';
      h+='</div></div>';
    });
    h+='</div>';
  }else{
    var groups=[{p:'urgent',l:'Acil',c:'var(--red)',e:'&#128293;'},{p:'high',l:'Önemli',c:'var(--orange)',e:'&#9193;'},{p:'normal',l:'Normal',c:'var(--blue)',e:'&#9679;'}];
    groups.forEach(function(g){
      var gi=filtered.filter(function(t){return !t.done&&t.priority===g.p;});
      if(!gi.length)return;
      h+='<div style="margin-bottom:14px"><div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span style="font-size:14px">'+g.e+'</span><span style="font-weight:700;font-size:13px;color:'+g.c+'">'+g.l+'</span><span class="pill p-gray" style="font-size:10px">'+gi.length+'</span></div><div class="card" style="overflow:hidden">';
      gi.forEach(function(t){
        var dl=t.end?Math.ceil((new Date(t.end)-new Date())/864e5):null;
        var dlc=dl===null?'var(--t3)':dl<0?'var(--red)':dl<3?'var(--orange)':'var(--t3)';
        h+='<div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid rgba(0,0,0,.05)"><input type="checkbox" class="cb" '+(t.done?'checked':'')+' data-tid="'+t.id+'" onchange="toggleTodo(+this.dataset.tid)"><div style="flex:1"><p style="font-weight:500;font-size:13.5px">'+U.esc(t.text)+'</p><div style="display:flex;gap:6px;margin-top:2px">'+(t.category?'<span class="pill p-gray" style="font-size:9.5px">'+U.esc(t.category)+'</span>':'')+(dl!==null?'<span style="font-size:10px;font-weight:600;color:'+dlc+'">'+(dl<0?'Gecti '+Math.abs(dl)+'g':dl===0?'Bugün':dl+'g kaldi')+'</span>':'')+'</div></div><button class="btn btn-g btn-ic" style="width:26px;height:26px" data-tid="'+t.id+'" data-dtype="todo" onclick="del(+this.dataset.tid,this.dataset.dtype)">'+ic('trash',12,'var(--t3)')+'</button></div>';
      });
      h+='</div></div>';
    });
    var noPri=filtered.filter(function(t){return !t.done&&['urgent','high','normal'].indexOf(t.priority)<0;});
    if(noPri.length){h+='<div style="margin-bottom:14px"><p class="lbl" style="margin-bottom:7px">Diğer</p><div class="card" style="overflow:hidden">';noPri.forEach(function(t){h+='<div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid rgba(0,0,0,.05)"><input type="checkbox" class="cb" data-tid="'+t.id+'" onchange="toggleTodo(+this.dataset.tid)"><span style="font-weight:500;flex:1">'+U.esc(t.text)+'</span><button class="btn btn-g btn-ic" style="width:26px;height:26px" data-tid="'+t.id+'" data-dtype="todo" onclick="del(+this.dataset.tid,this.dataset.dtype)">'+ic('trash',12,'var(--t3)')+'</button></div>';});h+='</div></div>';}
    var doneTodos=filtered.filter(function(t){return t.done;});
    if(doneTodos.length){h+='<details><summary style="cursor:pointer;font-size:12px;color:var(--t2);font-weight:600;padding:6px 2px">Tamamlanan ('+doneTodos.length+')</summary><div class="card" style="overflow:hidden;margin-top:8px">';doneTodos.forEach(function(t){h+='<div style="display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid rgba(0,0,0,.04);opacity:.5"><input type="checkbox" class="cb" checked data-tid="'+t.id+'" onchange="toggleTodo(+this.dataset.tid)"><span style="font-size:13px;text-decoration:line-through;color:var(--t2);flex:1">'+U.esc(t.text)+'</span><button class="btn btn-g btn-ic" style="width:24px;height:24px" data-tid="'+t.id+'" data-dtype="todo" onclick="del(+this.dataset.tid,this.dataset.dtype)">'+ic('trash',11,'var(--t3)')+'</button></div>';});h+='</div></details>';}
    if(!filtered.length)h+='<div class="card" style="padding:48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px"><div style="width:52px;height:52px;border-radius:14px;background:var(--gl);display:flex;align-items:center;justify-content:center">'+ic('chk',26,'var(--green)')+'</div><p style="font-weight:700;font-size:16px">Tüm görevler tamam!</p><button class="btn btn-p" data-type="todo" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' Yeni Görev</button></div>';
  }
  h+='</div>';sh('pinner',h);
}
function toggleTodo(id){snap();D.todos=D.todos.map(function(t){if(t.id!==id)return t;if(!t.done)xp(15,'Görev tamamlandı');return Object.assign({},t,{done:!t.done});});save();renderPage();}
window.toggleTodo=toggleTodo;

function renderHabits(){
  var habits=D.habits||[];var today=U.today();
  var doneToday=habits.filter(function(h){return(h.checkins||[]).indexOf(today)>=0;}).length;
  var maxStreak=habits.reduce(function(a,h){return Math.max(a,calcStreak(h.checkins||[]));},0);
  var hh='<div class="fade"><div class="sh"><div><h1 class="sh-t">Alışkanlıklar</h1><p class="sh-sub">Atomic Habits &mdash; %1 iyilesme = 37x buyume</p></div><button class="btn btn-p" data-type="habit" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' Alışkanlık Ekle</button></div>'+quoteWidget('Disiplin','var(--green)');
  hh+='<div class="g4" style="margin-bottom:16px">';
  hh+=statCard('Toplam',habits.length,'ref','var(--blue)');
  hh+=statCard('Bugün',doneToday,'chk','var(--green)');
  hh+=statCard('Kalan',habits.length-doneToday,'ci','var(--orange)');
  hh+=statCard('Max Seri',maxStreak+'g','flame','var(--purple)');
  hh+='</div><div class="gas">';
  habits.forEach(function(h){
    var checkins=h.checkins||[];var doneNow=checkins.indexOf(today)>=0;
    var streak=calcStreak(checkins);
    var cc={blue:'var(--blue)',green:'var(--green)',orange:'var(--orange)',purple:'var(--purple)',red:'var(--red)'}[h.color]||'var(--blue)';
    var last7=[];for(var d2=6;d2>=0;d2--){var dt2=new Date();dt2.setDate(dt2.getDate()-d2);last7.push(checkins.indexOf(dt2.toISOString().split('T')[0])>=0);}
    hh+='<div class="card cp" style="display:flex;flex-direction:column;gap:10px;border-top:3px solid '+cc+'">';
    hh+='<div style="display:flex;align-items:center;justify-content:space-between"><p style="font-weight:700;font-size:14px">'+U.esc(h.name)+'</p><div style="display:flex;gap:5px;align-items:center"><span style="font-size:11px;font-weight:700;color:'+cc+'">'+streak+' gun</span><button class="btn btn-g btn-ic" style="width:26px;height:26px" data-hid="'+h.id+'" data-dtype="habit" onclick="del(+this.dataset.hid,this.dataset.dtype)">'+ic('trash',12,'var(--t3)')+'</button></div></div>';
    hh+='<div style="display:flex;gap:5px">';last7.forEach(function(done2){hh+='<div style="flex:1;height:28px;border-radius:6px;background:'+(done2?cc:'var(--s2)')+';display:flex;align-items:center;justify-content:center">'+(done2?'<span style="color:#fff;font-size:11px">&#10003;</span>':'')+'</div>';});hh+='</div>';
    hh+='<button class="btn" style="width:100%;justify-content:center;background:'+(doneNow?'var(--gl)':cc)+';color:'+(doneNow?'var(--green)':'#fff')+(doneNow?';pointer-events:none':'')+'" data-hid="'+h.id+'" onclick="checkHabit(+this.dataset.hid)">'+(doneNow?ic('chk',13,'var(--green)')+' Yapildi!':ic('chk',13,'#fff')+' Bugün Yaptim (+10 XP)')+'</button></div>';
  });
  if(!habits.length)hh+='<div class="empty" style="grid-column:1/-1">'+ic('ref',32,'var(--t3)')+'<p>Alışkanlık eklenmedi</p></div>';
  hh+='</div></div>';sh('pinner',hh);
}
function checkHabit(id){
  var today2=U.today();
  D.habits=(D.habits||[]).map(function(h){if(h.id!==id)return h;if((h.checkins||[]).indexOf(today2)>=0)return h;return Object.assign({},h,{checkins:(h.checkins||[]).concat([today2])});});
  xp(10,'Alışkanlık');save();renderPage();
}
window.checkHabit=checkHabit;

function renderRoutines(){
  var pLabels={daily:'Günlük',weekly:'Haftalık',monthly:'Aylık',quarterly:'Çeyreklik',yearly:'Yıllık'};
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Rutinler</h1></div><button class="btn btn-p" data-type="routine" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' Rutin Ekle</button></div>';h+=quoteWidget('Disiplin','var(--purple)');
  var daily=D.routines.daily||[];
  if(daily.length){
    h+='<p style="font-weight:700;font-size:14px;margin-bottom:10px">Günlük Rutinler</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:16px">';
    daily.forEach(function(item){
      var isDone2=!U.isActive('daily',item.last);
      h+='<div data-period="daily" data-rid="'+item.id+'" onclick="checkRoutine(this.dataset.period,+this.dataset.rid)" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;background:'+(isDone2?'var(--gl)':'var(--s2)')+';cursor:'+(isDone2?'default':'pointer')+';border:1.5px solid '+(isDone2?'var(--green)':'transparent')+'">';
      h+='<div style="width:26px;height:26px;border-radius:99px;background:'+(isDone2?'var(--green)':'var(--s3)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(isDone2?'<span style="color:#fff;font-size:12px">&#10003;</span>':ic('ci',11,'var(--t3)'))+'</div>';
      h+='<span style="font-size:13px;font-weight:600;color:'+(isDone2?'var(--green)':'var(--t)')+';flex:1">'+U.esc(item.t)+'</span>';
      h+='<button data-period="daily" data-rid="'+item.id+'" onclick="event.stopPropagation();delRoutine(this.dataset.period,+this.dataset.rid)" style="background:none;border:none;cursor:pointer;color:var(--t3);padding:3px">'+ic('x',10)+'</button></div>';
    });
    h+='</div>';
  }
  ['weekly','monthly','quarterly','yearly'].forEach(function(period){
    var items=D.routines[period]||[];if(!items.length)return;
    var pDone=items.filter(function(r){return !U.isActive(period,r.last);}).length;
    h+='<div style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><p style="font-weight:600;font-size:13px">'+pLabels[period]+'</p><span class="pill '+(pDone===items.length&&items.length>0?'p-green':'p-gray')+'" style="font-size:10px">'+pDone+'/'+items.length+'</span></div><div class="card" style="overflow:hidden">';
    items.forEach(function(item){
      var isDone3=!U.isActive(period,item.last);
      h+='<div data-period="'+period+'" data-rid="'+item.id+'" onclick="checkRoutine(this.dataset.period,+this.dataset.rid)" style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,.05);cursor:'+(isDone3?'default':'pointer')+';background:'+(isDone3?'var(--gl)':'transparent')+'">';
      h+='<div style="width:20px;height:20px;border-radius:99px;background:'+(isDone3?'var(--green)':'var(--s2)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(isDone3?'<span style="color:#fff;font-size:10px">&#10003;</span>':ic('ci',9,'var(--t3)'))+'</div>';
      h+='<span style="font-size:13px;font-weight:500;flex:1;color:'+(isDone3?'var(--green)':'var(--t)')+'">'+U.esc(item.t)+'</span>';
      h+='<button data-period="'+period+'" data-rid="'+item.id+'" onclick="event.stopPropagation();delRoutine(this.dataset.period,+this.dataset.rid)" style="background:none;border:none;cursor:pointer;color:var(--t3);padding:3px">'+ic('x',11)+'</button></div>';
    });
    h+='</div></div>';
  });
  h+='</div>';sh('pinner',h);
}
function checkRoutine(period,id){snap();if(!D.routines[period])return;D.routines[period]=D.routines[period].map(function(r){return r.id===id?Object.assign({},r,{last:new Date().toISOString()}):r;});xp(10,'Rutin');save();renderPage();}
function delRoutine(period,id){snap();if(!D.routines[period])return;D.routines[period]=D.routines[period].filter(function(r){return r.id!==id;});save();renderPage();}
window.checkRoutine=checkRoutine;window.delRoutine=delRoutine;


function renderLibrary(){
  var catFilter=window._lcat||'all';var coreOnly=window._lcore||false;
  var myIds=(D.mybooks||[]).map(function(b){return b.libId;});
  var filtered=LIB.filter(function(b){
    if(coreOnly&&!b.core)return false;
    if(catFilter!=='all'&&b.cat!==parseInt(catFilter))return false;
    if(searchQ){var lq=searchQ.toLowerCase();return b.t.toLowerCase().indexOf(lq)>=0||b.a.toLowerCase().indexOf(lq)>=0;}
    return true;
  });
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Kitap Kütüphanesi</h1><p class="sh-sub">'+LIB.length+' kitap &mdash; 10 kategori</p></div><button class="btn btn-s btn-sm" style="background:'+(coreOnly?'var(--orange)':'')+';color:'+(coreOnly?'#fff':'')+'" onclick="window._lcore=!'+coreOnly+';renderPage()">'+ic('flame',12)+' Cekirdek</button></div>';
  h+=quoteWidget('Gelişim','var(--teal)');
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-sm" style="background:'+(catFilter==='all'?'var(--blue)':'var(--s2)')+';color:'+(catFilter==='all'?'#fff':'var(--t2)')+'" data-cat="all" onclick="window._lcat=this.dataset.cat;renderPage()">Tumu ('+LIB.length+')</button>';
  BOOK_CATS.forEach(function(cat,i){var cnt=LIB.filter(function(b){return b.cat===i;}).length;h+='<button class="btn btn-sm" style="background:'+(catFilter===String(i)?'var(--blue)':'var(--s2)')+';color:'+(catFilter===String(i)?'#fff':'var(--t2)')+'" data-ci="'+i+'" onclick="window._lcat=this.dataset.ci;renderPage()">'+cat+' ('+cnt+')</button>';});
  h+='</div><div class="ga">';
  filtered.forEach(function(lb){
    var inList=myIds.indexOf(lb.id)>=0;
    var mb2=inList?(D.mybooks||[]).find(function(b){return b.libId===lb.id;}):null;
    h+='<div class="card cp" style="display:flex;flex-direction:column;gap:9px"><div style="display:flex;align-items:flex-start;gap:9px"><div class="bc'+lb.cat+'" style="width:38px;height:52px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+ic('bk',16,'#fff')+'</div><div style="flex:1"><p style="font-weight:700;font-size:13px;line-height:1.3">'+U.esc(lb.t)+'</p><p style="font-size:11px;color:var(--t2);margin-top:2px">'+U.esc(lb.a)+'</p>'+(lb.core?'<span class="pill p-orange" style="font-size:9px;margin-top:4px">Cekirdek</span>':'')+'</div></div>';
    h+='<p style="font-size:12px;color:var(--t2);line-height:1.5">'+U.esc(lb.desc)+'</p><p style="font-size:11px;color:var(--t3)">'+lb.pages+' sayfa</p>';
    if(inList&&mb2){
      h+='<div style="display:flex;gap:6px;align-items:center"><span class="pill p-green" style="font-size:10px">Listede</span><select class="inp" style="flex:1;padding:3px 8px;font-size:11px" data-mbid="'+mb2.id+'" onchange="updateBookStatus(+this.dataset.mbid,this.value)"><option value="queue"'+(mb2.status==='queue'?' selected':'')+'>Sirada</option><option value="reading"'+(mb2.status==='reading'?' selected':'')+'>Okunuyor</option><option value="done"'+(mb2.status==='done'?' selected':'')+'>Bitti</option></select></div>';
    }else{h+='<button class="btn btn-p" style="font-size:11px;align-self:flex-start" data-lid="'+lb.id+'" onclick="addToList(this.dataset.lid)">'+ic('plus',12)+' Listeye Ekle</button>';}
    h+='</div>';
  });
  h+='</div></div>';sh('pinner',h);
}
function addToList(libId){
  var lb=LIB.find(function(b){return b.id===libId;});if(!lb)return;
  if((D.mybooks||[]).find(function(b){return b.libId===libId;})){alert('Zaten listede!');return;}
  snap();D.mybooks=[{id:Date.now(),libId:libId,title:lb.t,author:lb.a,pages:lb.pages,status:'queue',rating:0}].concat(D.mybooks||[]);
  xp(10,'Kitap eklendi');save();renderPage();
}
function updateBookStatus(id,status){
  var prev=(D.mybooks||[]).find(function(b){return b.id===id;});snap();
  D.mybooks=(D.mybooks||[]).map(function(b){return b.id===id?Object.assign({},b,{status:status}):b;});
  if(status==='done'&&prev&&prev.status!=='done')xp(50,'Kitap bitti');save();renderPage();
}
window.addToList=addToList;window.updateBookStatus=updateBookStatus;

function renderMyBooks(){
  var mb3=D.mybooks||[];
  var stats={q:mb3.filter(function(b){return b.status==='queue';}).length,r:mb3.filter(function(b){return b.status==='reading';}).length,d:mb3.filter(function(b){return b.status==='done';}).length};
  var pages=mb3.filter(function(b){return b.status==='done';}).reduce(function(a,b){return a+(b.pages||0);},0);
  var h='<div class="fade"><div class="sh"><h1 class="sh-t">Okuma Listesi</h1><button class="btn btn-s" data-tab="library" onclick="gotoTab(this.dataset.tab)">'+ic('bk',13)+' Kütüphane</button></div>';
  h+='<div class="g4" style="margin-bottom:16px">';
  [{l:'Sirada',v:stats.q,c:'var(--t2)'},{l:'Okunuyor',v:stats.r,c:'var(--blue)'},{l:'Bitti',v:stats.d,c:'var(--green)'},{l:'Sayfa',v:pages,c:'var(--purple)'}].forEach(function(s){h+='<div class="card" style="padding:14px 16px"><div class="kn" style="font-size:22px;color:'+s.c+'">'+s.v+'</div><div class="kl">'+s.l+'</div></div>';});
  h+='</div>';
  if(!mb3.length){h+='<div class="card" style="padding:48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">'+ic('bk',36,'var(--t3)')+'<p style="font-weight:700;font-size:16px">Okuma listen bos</p><button class="btn btn-p" data-tab="library" onclick="gotoTab(this.dataset.tab)">Kütüphane</button></div>';}
  else{
    h+='<div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th style="padding-left:16px">Kitap</th><th style="text-align:center">Puan</th><th>Durum</th><th style="width:40px"></th></tr></thead><tbody>';
    mb3.forEach(function(book){
      h+='<tr><td style="padding-left:16px"><p style="font-weight:600;font-size:13px">'+U.esc(book.title)+'</p><p style="font-size:11px;color:var(--t2)">'+U.esc(book.author)+'</p></td>';
      h+='<td style="text-align:center"><div style="display:flex;justify-content:center;gap:2px">';
      for(var st=1;st<=5;st++)h+='<span data-bid="'+book.id+'" data-st="'+st+'" onclick="rateBook(+this.dataset.bid,+this.dataset.st)" style="cursor:pointer;font-size:14px;color:'+(st<=(book.rating||0)?'var(--yellow)':'var(--s3)')+'">&#9733;</span>';
      h+='</div></td><td><select class="inp" style="width:auto;padding:3px 8px;font-size:11px" data-mbid="'+book.id+'" onchange="updateBookStatus(+this.dataset.mbid,this.value)"><option value="queue"'+(book.status==='queue'?' selected':'')+'>Sirada</option><option value="reading"'+(book.status==='reading'?' selected':'')+'>Okunuyor</option><option value="done"'+(book.status==='done'?' selected':'')+'>Bitti</option></select></td>';
      h+='<td><button class="btn btn-g btn-ic" style="width:26px;height:26px" data-bid="'+book.id+'" data-dtype="mybook" onclick="del(+this.dataset.bid,this.dataset.dtype)">'+ic('trash',12,'var(--t3)')+'</button></td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div>';sh('pinner',h);
}
function rateBook(id,rating){D.mybooks=(D.mybooks||[]).map(function(b){return b.id===id?Object.assign({},b,{rating:rating}):b;});save();renderPage();}
window.rateBook=rateBook;

function renderReadingPlan(){
  var ap=D.readingPlan;
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Okuma Planları</h1><p class="sh-sub">90 günlük kuratorlu okuma yol haritalari</p></div></div>';
  if(ap){
    h+='<div class="card" style="padding:16px 18px;border-left:3px solid var(--green);margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px"><div><p class="lbl">Aktif Plan</p><p style="font-weight:700;font-size:15px">'+U.esc(ap.name)+'</p></div>';
    h+='<button class="btn btn-s btn-sm" onclick="cancelReadingPlan()">'+ic('x',12)+' İptal</button></div>';
    ap.books.forEach(function(b3,i){
      var isDone4=(D.mybooks||[]).some(function(m){return m.libId===b3.libId&&m.status==='done';});
      var isCurr=new Date()>=new Date(b3.start)&&new Date()<=new Date(b3.end);
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:'+(isCurr?'var(--bl)':'var(--s2)')+';margin-bottom:5px"><div style="width:22px;height:22px;border-radius:99px;background:'+(isDone4?'var(--green)':isCurr?'var(--blue)':'var(--s3)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(isDone4?'<span style="color:#fff;font-size:11px">&#10003;</span>':'<span style="font-size:11px;font-weight:700;color:#fff">'+(i+1)+'</span>')+'</div><div style="flex:1"><p style="font-weight:600;font-size:12.5px">'+U.esc(b3.title)+'</p><p style="font-size:10.5px;color:var(--t2)">'+b3.start+' &mdash; '+b3.end+'</p></div>'+(isCurr?'<span class="pill p-blue" style="font-size:9px">Bugün</span>':'')+(isDone4?'<span class="pill p-green" style="font-size:9px">Bitti</span>':'')+'</div>';
    });
    h+='</div>';
  }
  h+='<div class="ga" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">';
  RPLANS.forEach(function(plan){
    var books4=plan.books.map(function(bid){return LIB.find(function(b){return b.id===bid;});}).filter(Boolean);
    var isActive=ap&&ap.id===plan.id;
    h+='<div class="card cp" style="display:flex;flex-direction:column;gap:10px;border-top:3px solid '+(isActive?'var(--green)':'var(--s3)')+'"><div><p style="font-weight:700;font-size:14px">'+U.esc(plan.name)+'</p><p style="font-size:11.5px;color:var(--t2);margin-top:2px">'+U.esc(plan.desc)+'</p></div><div style="display:flex;flex-direction:column;gap:4px">';
    books4.slice(0,4).forEach(function(b4){h+='<div style="display:flex;align-items:center;gap:7px;font-size:12px"><div class="bc'+b4.cat+'" style="width:14px;height:18px;border-radius:2px;flex-shrink:0"></div><span style="flex:1;font-weight:500">'+U.esc(b4.t)+'</span><span style="font-size:11px;color:var(--t3)">'+U.esc(b4.a.split(' ').pop())+'</span></div>';});
    if(books4.length>4)h+='<p style="font-size:11px;color:var(--t3);padding-left:21px">+ '+(books4.length-4)+' kitap</p>';
    h+='</div>'+(isActive?'<span class="pill p-green" style="align-self:flex-start">Aktif Plan</span>':'<button class="btn btn-p" style="align-self:flex-start;font-size:12px" data-pid="'+plan.id+'" onclick="activatePlan(this.dataset.pid)">'+ic('play',12)+' Baslat</button>')+'</div>';
  });
  h+='</div></div>';sh('pinner',h);
}
function cancelReadingPlan(){if(!confirm('Plani iptal et?'))return;snap();D.readingPlan=null;save();renderPage();}
function activatePlan(planId){
  var plan=RPLANS.find(function(p){return p.id===planId;});if(!plan)return;
  if(!confirm(plan.name+' planini baslat?'))return;
  var today3=new Date(),dpb=Math.floor(90/plan.books.length);
  var planBooks=plan.books.map(function(bid,i){
    var lb2=LIB.find(function(b){return b.id===bid;});if(!lb2)return null;
    var s5=new Date(today3);s5.setDate(s5.getDate()+i*dpb);
    var e5=new Date(s5);e5.setDate(e5.getDate()+dpb-2);
    return{libId:bid,title:lb2.t,author:lb2.a,start:s5.toISOString().split('T')[0],end:e5.toISOString().split('T')[0]};
  }).filter(Boolean);
  snap();D.readingPlan={id:planId,name:plan.name,books:planBooks,startedAt:U.today()};
  xp(30,'Okuma plani');save();renderPage();
}
window.cancelReadingPlan=cancelReadingPlan;window.activatePlan=activatePlan;

function renderTools(){
  var h='<div class="fade"><div class="sh"><h1 class="sh-t">Odak Araçları</h1></div>';
  h+='<div class="g2"><div class="card cp"><p style="font-weight:700;font-size:14px;margin-bottom:12px">'+ic('vol',15,'var(--blue)')+' Ortam Sesleri</p>';
  SOUNDS.forEach(function(s){
    var on=D.activeSound===s.url;
    h+='<button class="snd-btn'+(on?' on':'')+'" data-url="'+s.url+'" onclick="toggleSound(this.dataset.url)">'+s.emoji+'<span style="font-weight:600;font-size:13px">'+U.esc(s.name)+'</span>'+(on?'<span style="margin-left:auto;font-size:12px">&#128266; Caliniyor</span>':'')+'</button>';
  });
  h+='<div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06)">'+ic('vol',14,'var(--t2)')+'<input type="range" min="0" max="1" step="0.05" value="'+D.vol+'" oninput="setVol(this.value)"><span id="vol-pct" style="font-size:12px;color:var(--t2);min-width:28px">'+Math.round(D.vol*100)+'%</span></div></div>';
  h+='<div class="card cp"><p style="font-weight:700;font-size:14px;margin-bottom:12px">&#9201; Pomodoro İştatistikleri</p>';
  h+='<div style="display:flex;flex-direction:column;gap:8px">';
  [{l:'Toplam Odak',v:(D.stats.totalFocus||0)+' dk'},{l:'Bugünkü Odak',v:(D.stats.todayFocus||0)+' dk'},{l:'Seviye',v:'Lv. '+(D.stats.level||1)},{l:'XP',v:(D.stats.xp||0)+' XP'},{l:'Deep Work Seansı',v:D.deepWorkSessions||0}].forEach(function(s){
    h+='<div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--s2);border-radius:8px;font-size:13px"><span style="color:var(--t2)">'+s.l+'</span><span style="font-weight:600">'+s.v+'</span></div>';
  });
  h+='</div></div></div></div>';sh('pinner',h);
}

function renderChallenges(){
  var challenges=D.challenges||[];
  var active=challenges.filter(function(c){return c.status==='active';});
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">90-Gün Mücadelesi</h1><p class="sh-sub">Kendinle anlasma yap. Her gun kazan.</p></div><button class="btn btn-p" onclick="openChallengeModal()">'+ic('plus',13)+' Mücadele Baslat</button></div>';
  h+=quoteWidget('Cesaret','var(--red)');
  h+='<div class="g4" style="margin-bottom:16px">';
  h+=statCard('Aktif',active.length,'trophy','var(--orange)');
  h+=statCard('Tamamlanan',challenges.filter(function(c){return c.status==='done';}).length,'chk','var(--green)');
  h+=statCard('Toplam XP',challenges.reduce(function(a,c){return a+(c.xp||0);},0),'star','var(--purple)');
  h+=statCard('Kitap',CH_TPLS.length,'bk','var(--blue)');
  h+='</div>';
  if(!challenges.length){
    h+='<p style="font-weight:700;font-size:13px;margin-bottom:12px">Hazir Mücadeleler</p><div class="gas">';
    CH_TPLS.forEach(function(tpl){
      var d=DIFF[tpl.diff]||{l:tpl.diff,c:'p-gray'};
      h+='<div class="card cp" style="display:flex;flex-direction:column;gap:9px"><p style="font-weight:700;font-size:14px">'+U.esc(tpl.name)+'</p><p style="font-size:12px;color:var(--t2);line-height:1.5">'+U.esc(tpl.desc)+'</p><div style="display:flex;gap:5px"><span class="pill '+d.c+'" style="font-size:10px">'+d.l+'</span><span class="pill p-yellow" style="font-size:10px">+'+tpl.xp+' XP</span></div><button class="btn btn-p btn-sm" data-tid="'+tpl.id+'" onclick="startChallenge(this.dataset.tid)">'+ic('play',12)+' Baslat</button></div>';
    });
    h+='</div>';
  }else{
    h+='<div class="gas">';
    challenges.forEach(function(c){
      var elapsed=c.start?Math.max(0,Math.ceil((new Date()-new Date(c.start))/864e5)):0;
      var p2=Math.min(100,Math.round(elapsed/90*100));
      h+='<div class="card cp" style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><p style="font-weight:700;font-size:14px">'+U.esc(c.name)+'</p><span class="pill '+(c.status==='done'?'p-green':c.status==='failed'?'p-red':'p-orange')+'" style="font-size:10px">'+(c.status==='done'?'Bitti':c.status==='failed'?'Başarısiz':'Aktif')+'</span></div>';
      h+='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:var(--t2)">'+elapsed+'/90 gun</span><span style="font-weight:700">'+p2+'%</span></div>'+progBar(p2);
      h+='<div style="display:flex;gap:6px">';
      if(c.status==='active'){h+='<button class="btn btn-p btn-sm" data-cid="'+c.id+'" onclick="checkChallenge(+this.dataset.cid)">Bugünu İşaretle</button><button class="btn btn-g btn-sm" data-cid="'+c.id+'" data-dtype="challenge" onclick="del(+this.dataset.cid,this.dataset.dtype)">'+ic('trash',11)+'</button>';}
      h+='</div></div>';
    });
    h+='</div>';
  }
  h+='</div>';sh('pinner',h);
}
function openChallengeModal(){
  var h='<div class="mh"><span style="font-weight:700;font-size:15px">Mücadele Baslat</span><button class="btn btn-g btn-ic" onclick="closeModal()">'+ic('x',14)+'</button></div><div class="mb"><div class="gas">';
  CH_TPLS.forEach(function(tpl){var d=DIFF[tpl.diff]||{l:tpl.diff,c:'p-gray'};h+='<div class="card" style="padding:12px;cursor:pointer" data-tid="'+tpl.id+'" onclick="startChallenge(this.dataset.tid)"><p style="font-weight:700;font-size:13px;margin-bottom:4px">'+U.esc(tpl.name)+'</p><p style="font-size:11px;color:var(--t2);margin-bottom:7px">'+U.esc(tpl.desc)+'</p><div style="display:flex;gap:5px"><span class="pill '+d.c+'" style="font-size:10px">'+d.l+'</span><span class="pill p-yellow" style="font-size:10px">+'+tpl.xp+' XP</span></div></div>';});
  h+='</div></div><div class="mf"><button class="btn btn-s" onclick="closeModal()">İptal</button></div>';
  showModal(h);
}
function startChallenge(tplId){
  var tpl=CH_TPLS.find(function(t){return t.id===tplId;});if(!tpl)return;
  snap();D.challenges=[{id:Date.now(),tplId:tplId,name:tpl.name,desc:tpl.desc,cat:tpl.cat,diff:tpl.diff,xp:tpl.xp,start:U.today(),end:null,checkins:[],status:'active'}].concat(D.challenges||[]);
  xp(10,'Mücadele basladi');save();closeModal();renderPage();
}
function checkChallenge(id){
  var today4=U.today();
  D.challenges=(D.challenges||[]).map(function(c){
    if(c.id!==id)return c;
    if((c.checkins||[]).indexOf(today4)>=0)return c;
    var checkins=(c.checkins||[]).concat([today4]);
    var elapsed=Math.ceil((new Date()-new Date(c.start))/864e5);
    var status=elapsed>=90?'done':c.status;
    if(status==='done')xp(c.xp||100,'Mücadele tamamlandı!');
    return Object.assign({},c,{checkins:checkins,status:status});
  });
  xp(5,'Mücadele günlük');save();renderPage();
}
window.openChallengeModal=openChallengeModal;window.startChallenge=startChallenge;window.checkChallenge=checkChallenge;

function renderGenericList(type){
  var cfg={quotes:{t:'Öz Sözler',i:'qt',keys:['text','author'],cardFn:function(i){return '<p style="font-size:13.5px;font-style:italic;line-height:1.7">&ldquo;'+U.esc(i.text)+'&rdquo;</p>'+(i.author?'<p style="font-size:11px;font-weight:700;color:var(--blue);margin-top:5px">&mdash; '+U.esc(i.author)+'</p>':'')+('<div style="display:flex;gap:5px;margin-top:8px">'+(i.cat?'<span class="pill p-blue" style="font-size:10px">'+U.esc(i.cat)+'</span>':'')+'<button class="btn btn-g btn-ic" style="width:22px;height:22px;margin-left:auto" data-qid="'+i.id+'" data-dtype="quote" onclick="del(+this.dataset.qid,this.dataset.dtype)">'+ic('trash',10,'var(--t3)')+'</button></div>');}},
  journal:{t:'Günlük',i:'pen',keys:['text','cat'],cardFn:function(i){return '<p style="font-size:10.5px;color:var(--t3);margin-bottom:5px">'+U.esc(i.date||'')+(i.cat?' &bull; '+U.esc(i.cat):'')+'</p><p style="font-size:13px;line-height:1.6;color:var(--t)">'+U.esc(i.text)+'</p>'+'<div style="margin-top:8px"><button class="btn btn-g btn-ic" style="width:22px;height:22px" data-jid="'+i.id+'" data-dtype="journal" onclick="del(+this.dataset.jid,this.dataset.dtype)">'+ic('trash',10,'var(--t3)')+'</button></div>';}},
  principles:{t:'Prensipler',i:'sh',keys:['text','type'],cardFn:function(i){return (i.type?'<span class="pill p-purple" style="font-size:10px;margin-bottom:6px;display:inline-flex">'+U.esc(i.type)+'</span>':'')+'<p style="font-size:13px;line-height:1.6">'+U.esc(i.text)+'</p>'+'<div style="margin-top:8px"><button class="btn btn-g btn-ic" style="width:22px;height:22px" data-pid="'+i.id+'" data-dtype="principle" onclick="del(+this.dataset.pid,this.dataset.dtype)">'+ic('trash',10,'var(--t3)')+'</button></div>';}},
  coaching:{t:'Koçluk',i:'us',keys:['title','text','cat'],cardFn:function(i){return (i.cat?'<span class="pill p-green" style="font-size:10px;margin-bottom:6px;display:inline-flex">'+U.esc(i.cat)+'</span>':'')+'<p style="font-weight:700;font-size:13px;margin-bottom:4px">'+U.esc(i.title||'')+'</p><p style="font-size:12.5px;color:var(--t2);line-height:1.6">'+U.esc(i.text)+'</p>'+'<div style="margin-top:8px"><button class="btn btn-g btn-ic" style="width:22px;height:22px" data-cid="'+i.id+'" data-dtype="coaching" onclick="del(+this.dataset.cid,this.dataset.dtype)">'+ic('trash',10,'var(--t3)')+'</button></div>';}},
  vault:{t:'Bilgi Kasası',i:'arc',keys:['title','text','cat'],cardFn:function(i){return (i.cat?'<span class="pill p-orange" style="font-size:10px;margin-bottom:6px;display:inline-flex">'+U.esc(i.cat)+'</span>':'')+'<p style="font-weight:700;font-size:13px;margin-bottom:4px">'+U.esc(i.title||'')+'</p><p style="font-size:12.5px;color:var(--t2);line-height:1.6">'+U.esc(i.text)+'</p>'+'<div style="margin-top:8px"><button class="btn btn-g btn-ic" style="width:22px;height:22px" data-vid="'+i.id+'" data-dtype="vault" onclick="del(+this.dataset.vid,this.dataset.dtype)">'+ic('trash',10,'var(--t3)')+'</button></div>';}},
  questions:{t:'Soru Kasası',i:'qt',keys:['text'],cardFn:function(i){return '<p style="font-size:14px;font-style:italic;line-height:1.7;color:var(--t)">&ldquo;'+U.esc(i.text)+'&rdquo;</p>'+'<div style="margin-top:8px"><button class="btn btn-g btn-ic" style="width:22px;height:22px" data-qsid="'+i.id+'" data-dtype="question" onclick="del(+this.dataset.qsid,this.dataset.dtype)">'+ic('trash',10,'var(--t3)')+'</button></div>';}},
  };
  var c=cfg[type];if(!c)return;
  var list=fil(D[type]||[],c.keys);
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">'+c.t+'</h1></div><button class="btn btn-p" data-type="'+type+'" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' Ekle</button></div>';
  /* Category filter for quotes */
  if(type==='quotes'){
    var cats=['Tumu','Odak','Disiplin','Hedef','Gelişim','Zaman','Liderlik','Başarı','Vizyon','Zihin','Cesaret','Üretkenlik','Yönetim'];
    var activeCat=window._qcat||'Tumu';
    h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">';
    cats.forEach(function(ct){
      var on=activeCat===ct;
      h+='<button class="btn btn-sm" style="background:'+(on?'var(--blue)':'var(--s2)')+';color:'+(on?'#fff':'var(--t2)')+';font-size:11px" data-ct="'+ct+'" onclick="window._qcat=this.dataset.ct;renderPage()">'+ct+'</button>';
    });
    h+='</div>';
    if(activeCat!=='Tumu') list=list.filter(function(q){return q.cat===activeCat;});
    /* Random quote highlight */
    var rq2=rndQuote(activeCat==='Tumu'?null:activeCat);
    if(rq2) h+='<div style="padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,var(--bl),rgba(175,82,222,.07));border:1px solid rgba(0,113,227,.15);margin-bottom:16px"><p style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">&#10024; Anin Sözu</p><p style="font-size:15px;font-style:italic;line-height:1.75">&ldquo;'+U.esc(rq2.text)+'&rdquo;</p>'+(rq2.author?'<p style="font-size:12px;font-weight:700;color:var(--blue);margin-top:8px">&mdash; '+U.esc(rq2.author)+'</p>':'')+'</div>';
  }
  if(!list.length)h+='<div class="card" style="padding:48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">'+ic(c.i,32,'var(--t3)')+'<p style="font-weight:700;font-size:16px">Henüz eklenmedi</p></div>';
  else{h+='<div class="ga">';list.forEach(function(i){h+='<div class="card cp">'+c.cardFn(i)+'</div>';});h+='</div>';}
  h+='</div>';sh('pinner',h);
}

function renderSMART(){
  var goals=D.goals||[];
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">SMART Hedef Motoru</h1><p class="sh-sub">Spesifik &bull; Ölçulebilir &bull; Ulaşılabilir &bull; Anlamlı &bull; Zamanlı</p></div><button class="btn btn-p" onclick="openGoalForm()">'+ic('plus',13)+' SMART Hedef</button></div>';
  h+=quoteWidget('Hedef','var(--blue)');
  h+='<div style="margin-bottom:16px;padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,var(--bl),rgba(175,82,222,.08));border:1px solid rgba(0,113,227,.15)">';
  h+='<p style="font-size:13px;font-style:italic;font-weight:500;line-height:1.7">&ldquo;People with clear, written goals accomplish far more in a shorter period of time.&rdquo;</p><p style="font-size:11px;font-weight:700;color:var(--blue);margin-top:4px">&mdash; Brian Tracy</p></div>';
  h+='<div class="g5" style="margin-bottom:16px">';
  [{l:'S',n:'Spesifik',c:'#0071e3',bad:'Daha iyi olacagim',good:'Aylık 100K TL satis'},{l:'M',n:'Ölçulebilir',c:'#34c759',bad:'Cok para kazanacagim',good:'Net 20K TL tasarruf'},{l:'A',n:'Ulaşılabilir',c:'#ff9500',bad:'1 yilda milyarder',good:'6 ayda %30 artis'},{l:'R',n:'Anlamlı',c:'#af52de',bad:'Imrendirmek icin',good:'Aile icin ozgurluk'},{l:'T',n:'Zamanlı',c:'#ff3b30',bad:'Yakin zamanda',good:'31 Aralik 2026'}].forEach(function(cr){
    h+='<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:7px"><div style="width:34px;height:34px;border-radius:9px;background:'+cr.c+';display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff">'+cr.l+'</div><p style="font-weight:700;font-size:13px">'+cr.n+'</p><div style="display:flex;gap:4px"><span style="color:var(--red);font-size:11px;font-weight:700">&#10007;</span><span style="font-size:11px;color:var(--t3);font-style:italic">'+cr.bad+'</span></div><div style="display:flex;gap:4px"><span style="color:var(--green);font-size:11px;font-weight:700">&#10003;</span><span style="font-size:11px;font-weight:600">'+cr.good+'</span></div></div>';
  });
  h+='</div>';
  if(!goals.length){h+='<div class="card" style="padding:48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">'+ic('tgt',28,'var(--t3)')+'<p>Henüz hedef eklenmedi</p><button class="btn btn-p" onclick="openGoalForm()">Ilk Hedef</button></div>';}
  else{
    h+='<p style="font-weight:700;font-size:13px;margin-bottom:12px">SMART Analizi</p><div style="display:flex;flex-direction:column;gap:10px">';
    // ICERIK-FARKINDA analiz + Quality Index (once en dusuk kaliteliler)
    goals.slice().sort(function(a,b){return qualityIndex(a).score-qualityIndex(b).score;}).forEach(function(g){
      var sa=smartAnalyze(g),sc=sa.passCount,qi=qualityIndex(g),tips=goalCoach(g);
      var bc=qi.score>=70?'var(--green)':qi.score>=50?'var(--orange)':'var(--red)';
      var LC={S:'#0071e3',M:'#34c759',A:'#ff9500',R:'#af52de',T:'#ff3b30'};
      var crs=['S','M','A','R','T'].map(function(l){return {l:l,done:sa[l].pass,c:LC[l]};});
      h+='<div class="card" style="padding:15px 18px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px"><div style="flex:1"><p style="font-weight:700;font-size:14px;margin-bottom:3px">'+U.esc(g.title)+'</p><span class="pill p-blue" style="font-size:10px">'+g.quarter+'</span> <span class="pill" style="font-size:10px;background:var(--s2);color:var(--t2)">SMART '+sc+'/5</span></div><div style="width:52px;height:52px;border-radius:13px;background:'+bc+';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:19px;font-weight:800;color:#fff;line-height:1">'+qi.score+'</span><span style="font-size:8px;font-weight:700;color:rgba(255,255,255,.8)">/100</span></div></div>';
      h+='<div style="display:flex;gap:5px;margin-bottom:8px">';
      crs.forEach(function(cr){h+='<div style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:'+(cr.done?cr.c:'var(--s2)')+';color:'+(cr.done?'#fff':'var(--t3)')+';border:2px solid '+(cr.done?cr.c:'var(--s3)')+'">'+cr.l+'</div>';});
      h+='</div>'+progBar(qi.score);
      if(tips.length){h+='<div style="margin-top:9px;display:flex;flex-direction:column;gap:4px">';
        tips.slice(0,2).forEach(function(t){h+='<div style="display:flex;gap:6px;align-items:flex-start"><span style="color:var(--blue);font-size:11px;font-weight:800">&rsaquo;</span><span style="font-size:11px;color:var(--t2);line-height:1.4">'+U.esc(t)+'</span></div>';});
        h+='</div>';}
      h+='<div style="display:flex;gap:7px;margin-top:10px"><button class="btn btn-p btn-sm" data-gid="'+g.id+'" onclick="openGoalEdit(+this.dataset.gid)">'+ic('edit',11)+' Geliştir</button><button class="btn btn-s btn-sm" data-gid="'+g.id+'" onclick="openGoalDetail(+this.dataset.gid)">Detay</button><button class="btn btn-g btn-sm" data-gid="'+g.id+'" data-dtype="goal" onclick="del(+this.dataset.gid,this.dataset.dtype)" style="margin-left:auto">'+ic('trash',11)+'</button></div></div>';
    });
    h+='</div>';
  }
  h+='</div>';sh('pinner',h);
}

function renderOneThing(){
  var ot=D.oneThing||{};var today=U.today();var isDoneToday=ot.date===today&&ot.task;
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">ONE Thing</h1><p class="sh-sub">Gary Keller &mdash; Tek en kritik görev</p></div></div>';

  /* Hero soru */
  h+='<div style="margin-bottom:20px;padding:24px 20px;border-radius:14px;background:linear-gradient(135deg,#1a3a2e,#0d2d1e);text-align:center">';
  h+='<p style="font-size:11px;font-weight:700;color:rgba(167,243,208,.6);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">&#9889; Odak Sorusu</p>';
  h+='<p style="font-size:16px;font-style:italic;color:#a7f3d0;line-height:1.75;max-width:520px;margin:0 auto">&ldquo;Bugün yaparsam, diğer her seyi daha kolay ya da gereksiz kilacak TEK sey ne?&rdquo;</p>';
  h+='<p style="font-size:11px;color:rgba(110,231,183,.5);margin-top:10px">&mdash; Gary Keller, The ONE Thing</p></div>';

  /* ONE Thing seçimi */
  if(isDoneToday){
    h+='<div style="padding:20px;border-radius:14px;background:var(--gl);border:2px solid var(--green);text-align:center;margin-bottom:16px">';
    h+='<p style="font-size:26px;margin-bottom:6px">&#10003;</p>';
    h+='<p style="font-weight:700;font-size:18px;color:var(--green);margin-bottom:8px">Bugünün ONE Thing&#39;i belirlendi</p>';
    h+='<p style="font-size:15px;font-weight:600;padding:10px 16px;background:rgba(0,0,0,.08);border-radius:10px;display:inline-block">'+U.esc(ot.task)+'</p>';
    h+='<p style="font-size:12px;color:var(--t2);margin-top:10px">Şimdi bu göreve odaklan. Diğer her sey bekleyebilir.</p>';
    h+='<button class="btn btn-s btn-sm" style="margin-top:12px" onclick="clearOT()">Değiştir</button></div>';
  } else {
    h+='<div class="card" style="padding:20px;margin-bottom:16px">';
    h+='<p style="font-weight:700;font-size:14px;margin-bottom:6px">Bugünün ONE Thing&#39;ini sec</p>';
    h+='<p style="font-size:12px;color:var(--t2);margin-bottom:12px">Sadece bir sey yazacaksin. En önemli, en etkili, en zorlayici görev.</p>';
    h+='<input class="inp" id="ot-inp" placeholder="Ornek: X konu hakkinda raporun taslagi..." style="font-size:14px;padding:13px 16px;margin-bottom:12px">';
    h+='<button class="btn btn-p" style="width:100%;justify-content:center" onclick="saveOneThing()">'+ic('chk',14)+' ONE Thing Olarak Belirle &nbsp;(+25 XP)</button></div>';
  }

  /* Felsefe & nasıl çalışır */
  h+='<div style="margin-bottom:16px;padding:18px;border-radius:14px;background:linear-gradient(135deg,var(--bl),rgba(175,82,222,.07));border:1px solid rgba(0,113,227,.12)">';
  h+='<p style="font-weight:700;font-size:14px;margin-bottom:12px">&#128218; ONE Thing Nedir &mdash; Kitap Özeti</p>';
  h+='<p style="font-size:13px;color:var(--t2);line-height:1.75;margin-bottom:10px">Gary Keller&#39;in 2012&#39;de yayimlanan <em>The ONE Thing</em> kitabi, odaginizi <strong>tek bir kritik göreve</strong> yonlendirmenin nasil domino etkisi yarattigi fikrini temel alir: bir domino, kendisinden %50 daha büyük bir dominoyu devirebilir.</p>';
  h+='<p style="font-size:13px;color:var(--t2);line-height:1.75">Kitabin tezi: Cok is yapmak degil, <strong>dogru isi</strong> yapmak başarıya goturur. Her gun ONE Thing&#39;ini yapan biri, dagink calisanlara kiyasla aylar icerisinde katbekat daha ileri gider.</p></div>';

  /* Domino etkisi görseli */
  h+='<div class="card" style="padding:18px;margin-bottom:16px">';
  h+='<p style="font-weight:700;font-size:13px;margin-bottom:14px">&#127869; Domino Etkisi &mdash; Küçük eylem, büyük sonuc</p>';
  h+='<div style="display:flex;align-items:flex-end;gap:8px;overflow-x:auto;padding-bottom:4px">';
  var dominos=[{h:16,l:'Bugün'},{h:24,l:'Hafta'},{h:36,l:'Ay'},{h:54,l:'3 Ay'},{h:80,l:'Yil'},{h:120,l:'3 Yil'}];
  for(var di=0;di<dominos.length;di++){
    var dm=dominos[di];
    h+='<div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:52px">';
    h+='<div style="width:28px;border-radius:5px 5px 3px 3px;background:linear-gradient(180deg,var(--blue),rgba(0,113,227,.5));height:'+dm.h+'px"></div>';
    h+='<span style="font-size:10px;color:var(--t3);text-align:center">'+dm.l+'</span></div>';
  }
  h+='</div>';
  h+='<p style="font-size:11.5px;color:var(--t3);margin-top:10px">Her gun ONE Thing&#39;ini yaparak baslattigin domino zinciri zamanla katlanarak buyur.</p></div>';

  /* 5 adım metodoloji */
  h+='<div class="card" style="padding:18px;margin-bottom:16px">';
  h+='<p style="font-weight:700;font-size:13px;margin-bottom:14px">&#128218; ONE Thing Nasil Yapilir &mdash; 5 Adım</p>';
  var steps=[
    ['1','Listeni yaz','Bugün yapmak istedigin her seyi kagida doku. Uzun, karma bir liste olsun.','var(--blue)'],
    ['2','Tek soruyu sor','&ldquo;Yaparsam diğer her seyi kolaylastiracak ya da gereksiz kilacak TEK sey ne?&rdquo;','var(--purple)'],
    ['3','Korku faktorunu bul','En zor, en kacindigi, en cok itmis oldugu sey genellikle en yüksek degerli istir.','var(--orange)'],
    ['4','Günu buna ayir','ONE Thing&#39;i sabah, enerji en yüksekken yap. En az 4 saat blok zaman ayir.','var(--green)'],
    ['5','Hayir demek ozgurlugu','ONE Thing&#39;in disindaki her seye &ldquo;Şimdilik hayir&rdquo; diyebilirsin. Bu bir zaaf degil, stratejidir.','var(--red)'],
  ];
  for(var si=0;si<steps.length;si++){
    var st=steps[si];
    h+='<div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">';
    h+='<div style="width:28px;height:28px;border-radius:8px;background:'+st[3]+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex-shrink:0">'+st[0]+'</div>';
    h+='<div><p style="font-weight:700;font-size:13px;margin-bottom:2px">'+st[1]+'</p><p style="font-size:12px;color:var(--t2);line-height:1.6">'+st[2]+'</p></div></div>';
  }
  h+='</div>';

  /* Yanlış anlamalar */
  h+='<div class="card" style="padding:18px;margin-bottom:16px">';
  h+='<p style="font-weight:700;font-size:13px;margin-bottom:12px">&#10060; Yanlis Anlamalar</p>';
  var myths=[
    ['"Günün geri kalaninda hic is yapmayacagim"','Yanlis. ONE Thing tamamlandıktan sonra normal hayatina devam edersin.'],
    ['"Her zaman ayni sey olmali"','Yanlis. ONE Thing her gun, her hafta degisebilir.'],
    ['"Küçük görev secmek israf"','Yanlis. Bazi gunler en kritik ONE Thing &ldquo;15 dakika dinlen&rdquo; olabilir.'],
  ];
  for(var mi=0;mi<myths.length;mi++){
    var my=myths[mi];
    h+='<div style="margin-bottom:10px;padding:10px 12px;border-radius:10px;background:var(--rl)">';
    h+='<p style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:3px">'+my[0]+'</p>';
    h+='<p style="font-size:12px;color:var(--t2)">'+my[1]+'</p></div>';
  }
  h+='</div>';

  /* Çalışma araçları */
  h+='<div class="g2">';
  h+='<div class="card cp"><p style="font-weight:700;font-size:13px;margin-bottom:6px">&#9201; Pomodoro ile Calis</p><p style="font-size:12px;color:var(--t2);margin-bottom:10px">25 dk odak + 5 dk mola dongusuyle ONE Thing&#39;ine yonel.</p><button class="btn btn-p btn-sm" onclick="startFocusDash()">Baslat</button></div>';
  h+='<div class="card cp"><p style="font-weight:700;font-size:13px;margin-bottom:6px">&#129504; Deep Work ile Calis</p><p style="font-size:12px;color:var(--t2);margin-bottom:10px">50-90 dk kesintisiz, tam odakli calisma oturumu.</p><button class="btn btn-p btn-sm" data-tab="deepwork" onclick="gotoTab(this.dataset.tab)">Deep Work</button></div>';
  h+='</div></div>';
  sh('pinner',h);
}

function clearOT(){D.oneThing={task:'',date:''};save();renderPage();}
window.clearOT=clearOT;

function startFocusDash(){setTmMode('focus');startTm();gotoTab('dashboard');}
window.startFocusDash=startFocusDash;
function saveOneThing(){var inp=ge('ot-inp');if(!inp||!inp.value.trim()){alert('Bir şey yaz!');return;}snap();D.oneThing={task:inp.value.trim(),date:U.today()};xp(25,'ONE Thing');save();renderPage();}
window.saveOneThing=saveOneThing;

function renderFrog(){
  var frog=D.todos.find(function(t){return !t.done&&t.priority==='urgent';});
  var urgent=D.todos.filter(function(t){return !t.done&&t.priority==='urgent';});
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Eat That Frog</h1><p class="sh-sub">Brian Tracy &mdash; En zor görevi once bitir</p></div><button class="btn btn-p" data-type="todo" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' Acil Görev Ekle</button></div>';

  /* Hero */
  h+='<div style="margin-bottom:16px;padding:22px 20px;border-radius:14px;background:linear-gradient(135deg,#1a3a2e,#0d2d1e)">';
  h+='<p style="font-size:32px;margin-bottom:8px">&#128056;</p>';
  h+='<p style="font-weight:800;font-size:17px;color:#a7f3d0;margin-bottom:8px">Kurbağayı Ye!</p>';
  h+='<p style="font-size:13.5px;color:#6ee7b7;line-height:1.7;font-style:italic">&ldquo;Her sabah canli bir kurbagayi yersen, günün geri kalaninda senden daha kotu bir sey beklemek zorunda kalmazsin.&rdquo;</p>';
  h+='<p style="font-size:11px;color:rgba(110,231,183,.55);margin-top:8px">&mdash; Mark Twain (Brian Tracy tarafindan populerlestirilen)</p></div>';

  /* Bugünün kurbaği */
  if(frog){
    h+='<div style="margin-bottom:16px;padding:20px;border-radius:14px;background:var(--rl);border:2px solid var(--red)">';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
    h+='<span style="font-size:18px">&#128056;</span>';
    h+='<p style="font-weight:800;font-size:12px;color:var(--red);text-transform:uppercase;letter-spacing:.08em">Bugünün Kurbagasi</p></div>';
    h+='<p style="font-weight:700;font-size:17px;margin-bottom:14px">'+U.esc(frog.text)+'</p>';
    h+='<label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:rgba(255,255,255,.15);padding:10px 14px;border-radius:10px">';
    h+='<input type="checkbox" class="cb" style="width:20px;height:20px;border-radius:7px" data-tid="'+frog.id+'" onchange="toggleTodo(+this.dataset.tid)">';
    h+='<span style="font-size:13px;font-weight:600">Kurbağayı Yedim! &#127881;</span></label></div>';
  } else {
    h+='<div style="margin-bottom:16px;padding:20px;border-radius:14px;background:var(--gl);border:2px solid var(--green);text-align:center">';
    h+='<p style="font-size:32px;margin-bottom:8px">&#127881;</p>';
    h+='<p style="font-weight:700;font-size:16px;color:var(--green);margin-bottom:4px">Tum acil görevler tamamlandı!</p>';
    h+='<p style="font-size:12px;color:var(--t2)">Bugün kurbaganı yedin. Harika is!</p></div>';
  }

  /* Felsefe */
  h+='<div style="margin-bottom:16px;padding:18px;border-radius:14px;background:linear-gradient(135deg,var(--bl),rgba(0,113,227,.04));border:1px solid rgba(0,113,227,.12)">';
  h+='<p style="font-weight:700;font-size:14px;margin-bottom:12px">&#128218; Kurbaga Metaforu &mdash; Brian Tracy</p>';
  h+='<p style="font-size:13px;color:var(--t2);line-height:1.75;margin-bottom:10px">Brian Tracy&#39;in 2001 yilinda yayimlanan <em>Eat That Frog!</em> kitabi, ertelemeyi yenmenin en etkili yolunun <strong>günün en zor, en önemli görevini ilk anda yapmak</strong> oldugunu savunur.</p>';
  h+='<p style="font-size:13px;color:var(--t2);line-height:1.75">Mantik basit: Sabahın ilk saatlerinde enerjin ve irade gucun en yüksektir. Bu pencereyi email kontrolüne degil, <strong>en yüksek etkili göreve</strong> harca. Gerisi kolaylesir.</p></div>';

  /* 3 kural */
  h+='<div class="card" style="padding:18px;margin-bottom:16px">';
  h+='<p style="font-weight:700;font-size:13px;margin-bottom:14px">&#127869; Eat That Frog&#39;un 3 Altin Kurali</p>';
  var frogrules=[
    ['1','Kurbagani sabah ye','Günu email veya sosyal medya ile baslatma. Ilk göreve dokunmadan once kurbaganı piste sur.','var(--red)'],
    ['2','Kurbagani tanimla','Bugün mutlaka yapmam gereken, en zor, en erteledigim, en yüksek sonuclu görev nedir? Onu sec.','var(--orange)'],
    ['3','İki kurbagan varsa daha cirkin olanini ye','Bir gunde iki büyük görev varsa, en korkuncu ile basla. Ikincisi artik kolay gelecek.','var(--purple)'],
  ];
  for(var fgi=0;fgi<frogrules.length;fgi++){
    var fr=frogrules[fgi];
    h+='<div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">';
    h+='<div style="width:30px;height:30px;border-radius:9px;background:'+fr[3]+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;flex-shrink:0">'+fr[0]+'</div>';
    h+='<div><p style="font-weight:700;font-size:13px;margin-bottom:3px">'+fr[1]+'</p>';
    h+='<p style="font-size:12px;color:var(--t2);line-height:1.6">'+fr[2]+'</p></div></div>';
  }
  h+='</div>';

  /* Acil görevler listesi */
  if(urgent.length){
    h+='<p class="lbl" style="margin-bottom:8px">Acil Görevler Listesi</p><div class="card" style="overflow:hidden">';
    urgent.forEach(function(t){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(0,0,0,.05)">';
      h+='<input type="checkbox" class="cb" '+(t.done?'checked':'')+' data-tid="'+t.id+'" onchange="toggleTodo(+this.dataset.tid)">';
      h+='<span style="font-weight:500;flex:1;font-size:13.5px;'+(t.done?'text-decoration:line-through;opacity:.5':'')+'"">'+U.esc(t.text)+'</span>';
      h+='<span class="pill p-red" style="font-size:10px">Acil</span></div>';
    });
    h+='</div>';
  }

  h+='</div>';sh('pinner',h);
}

function renderGTD(){
  var inbox=D.gtdInbox||[];var pending=inbox.filter(function(i){return i.status==='inbox';});
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">GTD Inbox</h1><p class="sh-sub">David Allen &mdash; Zihnini bosalt, sisteme devret</p></div><button class="btn btn-p" data-type="gtd" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' Inbox&#39;a Ekle</button></div>';

  /* Felsefe */
  h+='<div style="margin-bottom:16px;padding:20px;border-radius:14px;background:linear-gradient(135deg,#1a2535,#0d1520)">';
  h+='<p style="font-size:11px;font-weight:700;color:rgba(160,200,255,.6);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">&#129504; GTD Felsefesi</p>';
  h+='<p style="font-size:15px;font-style:italic;color:#b0d4ff;line-height:1.75;margin-bottom:8px">&ldquo;Zihnin fikirler uretmek icin var, onlari tutmak icin degil.&rdquo;</p>';
  h+='<p style="font-size:11px;color:rgba(140,180,255,.5)">&mdash; David Allen, Getting Things Done (2001)</p></div>';

  /* GTD nedir */
  h+='<div style="margin-bottom:16px;padding:18px;border-radius:14px;background:linear-gradient(135deg,var(--bl),rgba(0,113,227,.04));border:1px solid rgba(0,113,227,.12)">';
  h+='<p style="font-weight:700;font-size:14px;margin-bottom:12px">&#128218; GTD (Getting Things Done) Nedir?</p>';
  h+='<p style="font-size:13px;color:var(--t2);line-height:1.75;margin-bottom:10px">David Allen&#39;in 2001&#39;de yayimlanan metodolojisidir. Temel fikir: <strong>kafanda tuttugun her sey seni yorar</strong>. Yapilacak isler, sorumluluklar, fikirler &mdash; bunlari bir sisteme aktarirsan zihnin raharlar ve odaklanabilirsin.</p>';
  h+='<p style="font-size:13px;color:var(--t2);line-height:1.75">GTD&#39;nin temeli: <strong>Inbox</strong>&#39;a her seyi at, sonra isle. Atma aksiyonu, isleme aksiyonu ayridir.</p></div>';

  /* 5 adım */
  h+='<div class="card" style="padding:18px;margin-bottom:16px">';
  h+='<p style="font-weight:700;font-size:13px;margin-bottom:14px">&#128336; GTD&#39;nin 5 Adımi</p>';
  var gtdsteps=[
    ['1','Yakala (Capture)','Aklina gelen her seyi &mdash; yapılacaklar, fikirler, sorumluluklar &mdash; aninda inbox&#39;a at. Kafanda tutma.','var(--blue)','&#128229;'],
    ['2','Acıkla (Clarify)','Her inbox itemini al: &ldquo;Bu eyleme donusulebilir mi?&rdquo; Evet ise sonraki adım ne? 2 dakikadan azsa hemen yap.','var(--purple)','&#128269;'],
    ['3','Organize Et (Organize)','Projeler, sonraki aksiyonlar, bekleyenler, bir gun belki listeleri &mdash; her seyi yerine koy.','var(--green)','&#128229;'],
    ['4','Gözden Geçir (Reflect)','Haftalık review&#39;de sistemini tara. Eski itemler var mi? Güncellik kaybeden listeler?','var(--orange)','&#128065;'],
    ['5','Yap (Engage)','Organize sistemine bakarak ne yapacagini se&ccedil;. Enerji, zaman ve baglam ile uyumlu görevi sec.','var(--red)','&#9654;'],
  ];
  for(var gi=0;gi<gtdsteps.length;gi++){
    var gs=gtdsteps[gi];
    h+='<div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">';
    h+='<div style="width:30px;height:30px;border-radius:9px;background:'+gs[3]+';display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">'+gs[4]+'</div>';
    h+='<div><p style="font-weight:700;font-size:13px;margin-bottom:2px">'+gs[0]+'. '+gs[1]+'</p>';
    h+='<p style="font-size:12px;color:var(--t2);line-height:1.6">'+gs[2]+'</p></div></div>';
  }
  h+='</div>';

  /* İstatistik */
  h+='<div style="display:flex;gap:10px;margin-bottom:14px">';
  h+=statCard('Toplam',inbox.length,'arc','var(--blue)');
  h+=statCard('Bekliyor',pending.length,'ci','var(--orange)');
  h+=statCard('İşlendi',inbox.length-pending.length,'chk','var(--green)');
  h+='</div>';

  /* Inbox listesi */
  if(!inbox.length){
    h+='<div class="empty">'+ic('arc',32,'var(--t3)')+'<p>GTD Inbox bos! Aklına gelen her seyi buraya at.</p></div>';
  } else {
    h+='<p class="lbl" style="margin-bottom:8px">Inbox Listesi</p>';
    h+='<div class="card" style="overflow:hidden">';
    inbox.forEach(function(item){
      var sc=item.status!=='inbox';
      h+='<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(0,0,0,.05);opacity:'+(sc?0.4:1)+'">';
      h+='<div style="flex:1">';
      h+='<p style="font-weight:500;font-size:13px;text-decoration:'+(sc?'line-through':'none')+'">'+U.esc(item.text)+'</p>';
      h+='<p style="font-size:10.5px;color:var(--t2);margin-top:2px">'+U.esc(item.addedAt||'')+' &bull; ';
      var statusLabel={inbox:'&#128229; Bekliyor',done:'&#10003; Yapildi',planned:'&#128197; Planlandı',deleted:'&#128465; Silindi'}[item.status]||item.status;
      h+=statusLabel+'</p></div>';
      if(!sc){
        h+='<div style="display:flex;gap:4px">';
        h+='<button class="btn btn-sm p-green" style="font-size:10px" data-iid="'+item.id+'" data-status="done" onclick="processGTD(+this.dataset.iid,this.dataset.status)">&#10003; Yap</button>';
        h+='<button class="btn btn-sm p-blue" style="font-size:10px" data-iid="'+item.id+'" data-status="planned" onclick="processGTD(+this.dataset.iid,this.dataset.status)">&#128197; Planla</button>';
        h+='<button class="btn btn-sm p-red" style="font-size:10px" data-iid="'+item.id+'" data-status="deleted" onclick="processGTD(+this.dataset.iid,this.dataset.status)">&#128465; Sil</button>';
        h+='</div>';
      }
      h+='</div>';
    });
    h+='</div>';
  }
  h+='</div>';sh('pinner',h);
}

function processGTD(id,status){
  snap();D.gtdInbox=(D.gtdInbox||[]).map(function(i){return i.id===id?Object.assign({},i,{status:status}):i;});
  if(status==='done')xp(10,'GTD item');save();renderPage();
}
window.processGTD=processGTD;

function renderTimeBlock(){
  var today=U.today();var blocks=D.timeblocks[today]||[];
  var filled=blocks.length;
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Zaman Bloklama</h1><p class="sh-sub">Cal Newport &mdash; Her saate bir misyon ver</p></div><button class="btn btn-p" onclick="addTimeBlock()">'+ic('plus',13)+' Blok Ekle</button></div>';

  /* Felsefe banner */
  h+='<div style="margin-bottom:16px;padding:20px;border-radius:14px;background:linear-gradient(135deg,#0d1a2e,#1a0d2e)">';
  h+='<p style="font-size:11px;font-weight:700;color:rgba(160,180,255,.6);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">&#128197; Zaman Bloklama Felsefesi</p>';
  h+='<p style="font-size:15px;font-style:italic;color:#b0c4ff;line-height:1.75;margin-bottom:8px">&ldquo;Yapacaklarini planlamak icin bir planin olmasi gerekir &mdash; ve o plana saygili olmak.&rdquo;</p>';
  h+='<p style="font-size:11px;color:rgba(140,160,255,.5)">&mdash; Cal Newport, Deep Work &amp; A World Without Email</p></div>';

  /* Ne işe yarar */
  h+='<div style="margin-bottom:16px;padding:18px;border-radius:14px;background:linear-gradient(135deg,var(--bl),rgba(0,113,227,.04));border:1px solid rgba(0,113,227,.12)">';
  h+='<p style="font-weight:700;font-size:14px;margin-bottom:12px">&#128161; Neden Zaman Bloklama?</p>';
  h+='<div style="display:flex;flex-direction:column;gap:10px">';
  var whys=[
    ['&#128248; Reaktiflikten proaktiflige gec','Yoksa gun biterken &ldquo;Ne yaptim ben bugün?&rdquo; diye dusunursun. Bloklar, gunu sen tasarlarsın.'],
    ['&#129504; Bilissel yuklenmeyi azalt','Her saat basinda &ldquo;Şimdi ne yapsam?&rdquo; sorusu yoktur. Karar onceden verilmistir.'],
    ['&#128293; Odak korunur','Blok varken email, mesaj, toplantı isteklerine &ldquo;Şimdi bloktayim&rdquo; diyebilirsin.'],
    ['&#128200; Gercekci tahmin gelisir','Bir is ne kadar surer? Bloklar tuttukca giderek daha iyi tahmin yaparsın.'],
  ];
  for(var wi=0;wi<whys.length;wi++){
    var wy=whys[wi];
    h+='<div style="display:flex;gap:10px;align-items:flex-start">';
    h+='<span style="font-size:16px;flex-shrink:0">'+wy[0].split(' ')[0]+'</span>';
    h+='<div><p style="font-weight:600;font-size:12.5px;margin-bottom:2px">'+wy[0].slice(wy[0].indexOf(' ')+1)+'</p>';
    h+='<p style="font-size:12px;color:var(--t2);line-height:1.6">'+wy[1]+'</p></div></div>';
  }
  h+='</div></div>';

  /* Nasıl yapılır */
  h+='<div class="card" style="padding:18px;margin-bottom:16px">';
  h+='<p style="font-weight:700;font-size:13px;margin-bottom:14px">&#128218; Nasil Yapilir &mdash; 5 Adım</p>';
  var tbsteps=[
    ['1','Sabah planla, aksam gözden geçir','Blokları gunu baslamadan once kur. Aksam yarının taslağını hazirla.','var(--blue)'],
    ['2','Tur bazli bloklar oluştur','Deep Work, yuzeysel is (email), toplantı ve enerji yenileme bloklari farkli renklerde olmali.','var(--purple)'],
    ['3','Blok bozulursa hemen yeniden planla','Bir acil durum bloklarini bozdu mu? Kalan gunu yeniden planla &mdash; kaos devam etmesin.','var(--orange)'],
    ['4','Tampon bloklar ekle','Her iki ciddi bloktan sonra 30 dk tampon birak. Insanlar kapina gelir, beklenmedik seyler olur.','var(--green)'],
    ['5','Gercegi kaydet','Plana karsi gercegi karsilastir. Nerede saptigin zamanla sana planlamayi ogretir.','var(--red)'],
  ];
  for(var ti=0;ti<tbsteps.length;ti++){
    var ts=tbsteps[ti];
    h+='<div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">';
    h+='<div style="width:28px;height:28px;border-radius:8px;background:'+ts[3]+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex-shrink:0">'+ts[0]+'</div>';
    h+='<div><p style="font-weight:700;font-size:13px;margin-bottom:2px">'+ts[1]+'</p><p style="font-size:12px;color:var(--t2);line-height:1.6">'+ts[2]+'</p></div></div>';
  }
  h+='</div>';

  /* İstatistik + bugünkü plan */
  h+='<div style="display:flex;gap:10px;margin-bottom:16px">';
  h+=statCard('Bugün Planlanan',filled,'ci','var(--blue)');
  h+=statCard('Saatlik Doluluk',filled?Math.round(filled/17*100)+"%" :"0%",'star','var(--green)');
  h+='</div>';

  /* Zaman çizelgesi */
  h+='<div class="card" style="overflow:hidden;margin-bottom:8px"><div style="padding:12px 16px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center"><p style="font-weight:700;font-size:13px">Bugünün Plani &mdash; '+today+'</p><span style="font-size:11px;color:var(--t3)">Bos bloga tikla &rarr; görev ekle</span></div>';
  for(var hr=6;hr<=22;hr++){
    var b=blocks.find(function(x){return x.hour===hr;});
    var hstr=(hr<10?'0':'')+hr+':00';
    var nowHr=new Date().getHours();
    var isCurrent=hr===nowHr;
    h+='<div style="display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid rgba(0,0,0,.04);'+(isCurrent?'background:rgba(0,113,227,.05)':'')+'">';
    h+='<span style="font-size:11.5px;font-weight:'+(isCurrent?'800':'600')+';color:'+(isCurrent?'var(--blue)':'var(--t3)')+';min-width:38px">'+hstr+'</span>';
    if(b){
      var pc={urgent:'var(--red)',high:'var(--orange)',normal:'var(--blue)'}[b.priority]||'var(--blue)';
      h+='<div style="flex:1;padding:7px 10px;border-radius:7px;background:var(--bl);border-left:3px solid '+pc+'">';
      h+='<p style="font-weight:600;font-size:12.5px">'+U.esc(b.task)+'</p></div>';
      h+='<button class="btn btn-g btn-ic" style="width:24px;height:24px" data-hr="'+hr+'" onclick="removeTimeBlock(+this.dataset.hr)">'+ic('x',10,'var(--t3)')+'</button>';
    }else{
      h+='<div style="flex:1;height:32px;border-radius:7px;border:1.5px dashed var(--s3);cursor:pointer;display:flex;align-items:center;padding:0 12px;transition:all .12s" data-hr="'+hr+'" onclick="addTimeBlock(+this.dataset.hr)">';
      h+='<span style="font-size:11px;color:var(--t3)">Bos &mdash; tikla ve görev ekle</span></div>';
    }
    h+='</div>';
  }
  h+='</div>';

  /* Cal Newport hakkında */
  h+='<div style="margin-top:16px;padding:16px 18px;border-radius:12px;background:var(--s2)">';
  h+='<p style="font-weight:700;font-size:12px;color:var(--t2);margin-bottom:6px">&#128065; Cal Newport Kimdir?</p>';
  h+='<p style="font-size:12px;color:var(--t3);line-height:1.65">Georgetown Universitesi bilgisayar bilimi profesoru ve &ldquo;Deep Work&rdquo;, &ldquo;Digital Minimalism&rdquo;, &ldquo;A World Without Email&rdquo; kitaplarinin yazari. Zaman bloklama metodunu akademik kariyeri boyunca uygulamis; her sabah günün bloklarini fiziksel bir deftere cizer, aksam gercekle karsilastirir.</p>';
  h+='</div></div>';
  sh('pinner',h);
}
function addTimeBlock(hr){
  var hour=hr!==undefined?hr:parseInt(prompt('Saat (6-22):',new Date().getHours())||new Date().getHours());
  if(isNaN(hour)||hour<6||hour>22)return;
  var task=prompt('Görev:');if(!task||!task.trim())return;
  snap();
  var today=U.today();D.timeblocks[today]=D.timeblocks[today]||[];
  D.timeblocks[today]=D.timeblocks[today].filter(function(b){return b.hour!==hour;});
  D.timeblocks[today].push({hour:hour,task:task.trim(),priority:'normal'});
  xp(5,'Zaman blok');save();renderPage();
}
function removeTimeBlock(hr){snap();var today=U.today();D.timeblocks[today]=(D.timeblocks[today]||[]).filter(function(b){return b.hour!==hr;});save();renderPage();}
window.addTimeBlock=addTimeBlock;window.removeTimeBlock=removeTimeBlock;

function renderWeeklyReview(){
  var wr=D.weeklyReview||{};
  var lastDate=wr.updatedAt||null;
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Haftalık Review</h1><p class="sh-sub">David Allen & GTD &mdash; Haftayi kapatirken ayna tut</p></div></div>';

  /* Felsefe */
  h+='<div style="margin-bottom:16px;padding:20px;border-radius:14px;background:linear-gradient(135deg,#1a2a1a,#0d200d)">';
  h+='<p style="font-size:11px;font-weight:700;color:rgba(167,243,208,.6);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">&#128218; Haftalık Review Nedir?</p>';
  h+='<p style="font-size:14px;color:#a7f3d0;line-height:1.75;margin-bottom:8px">David Allen&#39;in GTD (Getting Things Done) metodolojisinin temel rituelidir. Her haftanin sonunda 30-60 dakika ayrip <strong>gectigi, kaldi ve gelecege baktigi</strong> bir zihni temizlik yapar.</p>';
  h+='<p style="font-size:12px;color:rgba(110,231,183,.65)">&ldquo;Zihninizi sifirlamak icin en guclu arac: haftalık review.&rdquo; &mdash; David Allen</p></div>';

  /* Neden önemli */
  h+='<div style="margin-bottom:16px;padding:18px;border-radius:14px;background:linear-gradient(135deg,var(--gl),rgba(52,199,89,.04));border:1px solid rgba(52,199,89,.18)">';
  h+='<p style="font-weight:700;font-size:14px;margin-bottom:12px">&#128161; Neden Her Hafta?</p>';
  var reasons=[
    ['&#128540; Zihin temizlenir','Haftalık review olmadan zihinde bitmemis isler birikerek enerji tuketir. Cikartma yapinca &ldquo;Bunu yapmam lazim&rdquo; gerginligi gider.'],
    ['&#127919; Yön düzelir','1 hafta sapmayi kolay duzeltirsin. 1 ay sapmayi duzeltmek cok daha zordur.'],
    ['&#127881; Kazanımlar görünür olur','Depresif hissetmenin en büyük nedenlerinden biri: ne yaptigini görmemek. Review&#39;de kazanimlari liste yapinca &ldquo;Aslında cok şey yaptım&rdquo; farkındaligi gelir.'],
    ['&#128197; Gelecek planlanır','Yeni hafta ne kadar yoğun olacak? ONE Thing nedir? Bloklar nerede?'],
  ];
  for(var ri=0;ri<reasons.length;ri++){
    var rs=reasons[ri];
    h+='<div style="display:flex;gap:10px;margin-bottom:11px;align-items:flex-start">';
    h+='<span style="font-size:16px;flex-shrink:0">'+rs[0].split(' ')[0]+'</span>';
    h+='<div><p style="font-weight:600;font-size:12.5px;margin-bottom:2px">'+rs[0].slice(rs[0].indexOf(' ')+1)+'</p>';
    h+='<p style="font-size:12px;color:var(--t2);line-height:1.6">'+rs[1]+'</p></div></div>';
  }
  h+='</div>';

  /* Son review bilgisi */
  if(lastDate){
    h+='<div style="margin-bottom:14px;padding:10px 14px;border-radius:10px;background:var(--gl);display:flex;align-items:center;gap:8px">';
    h+='<span style="font-size:16px">&#10003;</span>';
    h+='<span style="font-size:12.5px;font-weight:600;color:var(--green)">Son review: '+U.esc(lastDate)+'</span></div>';
  } else {
    h+='<div style="margin-bottom:14px;padding:10px 14px;border-radius:10px;background:var(--ol);display:flex;align-items:center;gap:8px">';
    h+='<span style="font-size:16px">&#128336;</span>';
    h+='<span style="font-size:12.5px;font-weight:600;color:var(--orange)">Bu haftanin review&#39;i henuz yapilmadi</span></div>';
  }

  /* Sorular */
  h+='<div class="card cp"><p style="font-weight:700;font-size:14px;margin-bottom:14px">&#128221; Bu Haftanin Review&#39;i</p><div style="display:flex;flex-direction:column;gap:14px">';
  var wrfields=[
    {id:'done',l:'&#127881; Bu hafta ne yaptim?',ph:'Tamamlanan görevler, kaslar, başarılar, gururlandigin anlar...'},
    {id:'missed',l:'&#10060; Yapamadigim neydi?',ph:'Ertelenenler, yari birakilanlar, kacindiklarim...'},
    {id:'why',l:'&#128269; Neden yapamadım?',ph:'Gercek sebepler &mdash; dis etkenler mi, ic engeller mi?'},
    {id:'learn',l:'&#128218; Bu hafta ne öğrendim?',ph:'Yeni beceri, insight, ders, degisen bakis acisi...'},
    {id:'next',l:'&#128640; Gelecek hafta ne yapacagim?',ph:'Somut, gercekci, oncelikli planlar...'},
    {id:'oneThingNext',l:'&#9889; Gelecek haftanin ONE Thing&#39;i?',ph:'En kritik, en yüksek etkili tek sey...'},
  ];
  for(var fi=0;fi<wrfields.length;fi++){
    var f=wrfields[fi];
    h+='<div><p class="lbl" style="margin-bottom:4px;font-size:12.5px;font-weight:700">'+f.l+'</p>';
    h+='<textarea class="inp" id="wr_'+f.id+'" rows="3" placeholder="'+f.ph+'" style="font-size:13px">'+U.esc(wr[f.id]||'')+'</textarea></div>';
  }
  h+='<button class="btn btn-p" style="margin-top:4px" onclick="saveWeeklyReview()">'+ic('chk',13)+' Review&#39;i Tamamla &nbsp;(+35 XP)</button></div></div>';

  /* Ne zaman yapılır */
  h+='<div style="margin-top:16px;padding:16px 18px;border-radius:12px;background:var(--s2)">';
  h+='<p style="font-weight:700;font-size:12px;margin-bottom:8px">&#128336; Ideal Zamanlama</p>';
  h+='<p style="font-size:12px;color:var(--t3);line-height:1.65">Cuma aksami is biterken <em>veya</em> Pazar aksami. Hafta icindeki bir gun yapma &mdash; once haftayi kapatman gerekiyor. Takvinine &ldquo;Haftalık Review &mdash; 30 dk&rdquo; diye tekrarlayan bir blok ekle, aksatma.</p>';
  h+='</div></div>';
  sh('pinner',h);
}
function saveWeeklyReview(){
  snap();
  var fields=['done','missed','why','learn','next','oneThingNext'];
  fields.forEach(function(f){var el=ge('wr_'+f);if(el)D.weeklyReview[f]=el.value;});
  D.weeklyReview.updatedAt=U.today();
  xp(35,'Haftalık review');save();renderPage();
}
window.saveWeeklyReview=saveWeeklyReview;

function renderDeepWork(){
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Derin Çalışma</h1><p class="sh-sub">Cal Newport &mdash; Odak, modern dunyanin supergucudur</p></div></div>';

  /* Hero */
  h+='<div style="margin-bottom:16px;padding:22px 20px;border-radius:14px;background:linear-gradient(135deg,#0d1a2e,#1a0d2e)">';
  h+='<p style="font-size:11px;font-weight:700;color:rgba(160,180,255,.6);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">&#129504; Deep Work Tanimi</p>';
  h+='<p style="font-size:15px;font-style:italic;color:#b0c4ff;line-height:1.75;margin-bottom:8px">&ldquo;Profesyonel aktiviteler, dikkat dagitici unsurlardan uzakta, tam biliseel kapasite ile gerceklestirildiklerinde yeni deger uretir, becerileri gelistirir ve tekrar edilmesi zor isle sonuclanir.&rdquo;</p>';
  h+='<p style="font-size:11px;color:rgba(140,160,255,.5)">&mdash; Cal Newport, Deep Work (2016)</p></div>';

  /* Oturum başlat */
  h+=quoteWidget('Odak','var(--purple)');h+='<div class="card cp" style="margin-bottom:16px"><p style="font-weight:700;font-size:14px;margin-bottom:6px">&#9654; Oturum Başlat</p>';
  h+='<p style="font-size:12px;color:var(--t2);margin-bottom:12px">Görev yazarken &ldquo;X konusunda Y cikti uretecegim&rdquo; gibi somut bir tanim yap.</p>';
  h+='<input class="inp" id="dw-task-inp" placeholder="Ornek: Q3 raporu icin veri analizi yap" style="margin-bottom:12px">';
  h+='<div class="g3">';
  [{m:25,l:'Kısa',d:'Baslangic',c:'var(--blue)'},{m:50,l:'Standart',d:'Newport onerisi',c:'var(--purple)'},{m:90,l:'Derin',d:'Tam odak',c:'var(--orange)'}].forEach(function(opt){
    h+='<button class="btn btn-s" style="flex-direction:column;padding:14px 10px;height:auto;gap:3px;border:2px solid '+opt.c+';background:transparent" data-mins="'+opt.m+'" onclick="enterDW(+this.dataset.mins)">';
    h+='<span style="font-size:22px;font-weight:800;color:'+opt.c+'">'+opt.m+'dk</span>';
    h+='<span style="font-size:12px;font-weight:600">'+opt.l+'</span>';
    h+='<span style="font-size:10px;color:var(--t3)">'+opt.d+'</span></button>';
  });
  h+='</div></div>';

  /* Felsefe: Deep Work vs Shallow Work */
  h+='<div style="margin-bottom:16px;padding:18px;border-radius:14px;background:linear-gradient(135deg,var(--bl),rgba(0,113,227,.04));border:1px solid rgba(0,113,227,.12)">';
  h+='<p style="font-weight:700;font-size:14px;margin-bottom:12px">&#9878; Deep Work vs Shallow Work</p>';
  h+='<div class="g2" style="gap:12px">';
  h+='<div style="padding:14px;border-radius:10px;background:var(--gl);border:1.5px solid var(--green)">';
  h+='<p style="font-weight:700;font-size:12px;color:var(--green);margin-bottom:8px">&#9989; DERIN CALISMA</p>';
  ['Tam odak gerektirir','Bilissel efor yüksektir','Yeni beceri & deger uretir','Kesintiye gelemez','Makina ile rekabet edilemez'].forEach(function(i){
    h+='<div style="display:flex;gap:6px;margin-bottom:5px;align-items:flex-start"><span style="color:var(--green);font-size:11px;font-weight:800;flex-shrink:0">+</span><span style="font-size:12px">'+i+'</span></div>';
  });
  h+='</div>';
  h+='<div style="padding:14px;border-radius:10px;background:var(--rl);border:1.5px solid var(--red)">';
  h+='<p style="font-weight:700;font-size:12px;color:var(--red);margin-bottom:8px">&#10071; YUZEYSEL CALISMA</p>';
  ['Email, Slack, toplantı','Asla tam odak gerekmez','Minimal yeni deger uretir','Kolayca kesilip devam edilir','Robotlar / asistanis yapabilir'].forEach(function(i){
    h+='<div style="display:flex;gap:6px;margin-bottom:5px;align-items:flex-start"><span style="color:var(--red);font-size:11px;font-weight:800;flex-shrink:0">-</span><span style="font-size:12px">'+i+'</span></div>';
  });
  h+='</div></div></div>';

  /* 4 disiplin */
  h+='<div class="card" style="padding:18px;margin-bottom:16px">';
  h+='<p style="font-weight:700;font-size:13px;margin-bottom:14px">&#127775; Deep Work&#39;un 4 Felsefi Yaklasimi</p>';
  var philosophies=[
    ['Keşisci (Monastic)','Sosyal medya, email, anlık mesaj &mdash; dijital kaos yok. Kalıcı olarak derin çalışma modunda yasayan insanlar icin. (Don Knuth, Neal Stephenson)','var(--purple)','&#128111;'],
    ['İkili (Bimodal)','Yilın/haftanın belli donemlerini tamamen Deep Work&#39;e, kalanini normal hayata ayir. (Carl Jung, Adam Grant)','var(--blue)','&#9878;'],
    ['Ritimsel (Rhythmic)','Her gun belli saatte Deep Work blogu. Takvime kor, istisnasız yap. Cogu profesyonel icin en uygun yaklasim.','var(--green)','&#128197;'],
    ['Gazeteci (Journalistic)','Boş zaman buldukça hemen Deep Work moduna gec. Deneyim gerektirir; yeni baslayanlara tavsiye edilmez.','var(--orange)','&#128240;'],
  ];
  for(var pi=0;pi<philosophies.length;pi++){
    var ph=philosophies[pi];
    h+='<div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">';
    h+='<div style="width:34px;height:34px;border-radius:10px;background:'+ph[2]+';display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">'+ph[3]+'</div>';
    h+='<div><p style="font-weight:700;font-size:13px;margin-bottom:2px">'+ph[0]+'</p>';
    h+='<p style="font-size:12px;color:var(--t2);line-height:1.6">'+ph[1]+'</p></div></div>';
  }
  h+='</div>';

  /* Kurallar + istatistik */
  h+='<div class="g2">';
  h+='<div class="card cp"><p style="font-weight:700;font-size:13px;margin-bottom:10px">&#128241; Oturum Oncesi Kontrol</p><div style="display:flex;flex-direction:column;gap:7px">';
  ['Telefon sessiz, uzakta','Bildirimler kapali','Sadece 1-2 sekme acik','Su & atistirmalik hazir','Kulaklık & odak muzigi hazir','Hedef net: ne uretecegim?'].forEach(function(r,i){
    h+='<div style="display:flex;align-items:center;gap:8px"><div style="width:20px;height:20px;border-radius:6px;background:var(--blue);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">'+(i+1)+'</div><span style="font-size:12px">'+r+'</span></div>';
  });
  h+='</div></div>';
  h+='<div class="card cp"><p style="font-weight:700;font-size:13px;margin-bottom:10px">&#128200; İştatistiklerin</p><div style="display:flex;flex-direction:column;gap:7px">';
  [{l:'Deep Work Oturumu',v:D.deepWorkSessions||0},{l:'Toplam Odak',v:(D.stats.totalFocus||0)+' dk'},{l:'Toplam XP',v:D.stats.xp||0},{l:'Seviye',v:'Lv. '+(D.stats.level||1)}].forEach(function(s){
    h+='<div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--s2);border-radius:8px;font-size:13px"><span style="color:var(--t2)">'+s.l+'</span><span style="font-weight:700">'+s.v+'</span></div>';
  });
  h+='</div></div></div></div>';
  sh('pinner',h);
}

function renderSOP(){
  var sops=D.sops||[];
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">SOP Şablonları</h1><p class="sh-sub">Standart işlem prosedürleri</p></div><button class="btn btn-p" data-type="sop" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' SOP Ekle</button></div>';
  if(!sops.length)h+='<div class="empty">'+ic('layers',32,'var(--t3)')+'<p>SOP eklenmedi</p></div>';
  else{
    h+='<div class="ga">';
    sops.forEach(function(sop){
      h+='<div class="card cp" style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><p style="font-weight:700;font-size:14px">'+U.esc(sop.title)+'</p><button class="btn btn-g btn-ic" style="width:26px;height:26px" data-sid="'+sop.id+'" data-dtype="sop" onclick="del(+this.dataset.sid,this.dataset.dtype)">'+ic('trash',12,'var(--t3)')+'</button></div>';
      if(sop.steps&&sop.steps.length){
        h+='<div style="display:flex;flex-direction:column;gap:6px">';
        sop.steps.forEach(function(step,i){h+='<div style="display:flex;align-items:flex-start;gap:8px"><div style="width:20px;height:20px;border-radius:99px;background:var(--blue);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">'+(i+1)+'</div><span style="font-size:12.5px;padding-top:1px">'+U.esc(step)+'</span></div>';});
        h+='</div>';
      }
      h+='<button class="btn btn-s btn-sm" data-sid="'+sop.id+'" onclick="addSOPStep(+this.dataset.sid)">'+ic('plus',11)+' Adım Ekle</button></div>';
    });
    h+='</div>';
  }
  h+='</div>';sh('pinner',h);
}
function addSOPStep(id){
  var step=prompt('Yeni adım:');if(!step||!step.trim())return;
  snap();D.sops=(D.sops||[]).map(function(s){return s.id===id?Object.assign({},s,{steps:(s.steps||[]).concat([step.trim()])}):s;});save();renderPage();
}
window.addSOPStep=addSOPStep;

function renderHistory(){
  var logs=D.logs||[];
  var h='<div class="fade"><div class="sh"><h1 class="sh-t">Aktivite Geçmişi</h1></div>';
  if(!logs.length)h+='<div class="empty">'+ic('act',32,'var(--t3)')+'<p>Henüz aktivite yok</p></div>';
  else{h+='<div class="card" style="overflow:hidden">';logs.forEach(function(l){h+='<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,.05)">'+ic('act',12,'var(--t3)')+'<span style="font-size:13px;flex:1">'+U.esc(l.action)+'</span><span style="font-size:10.5px;color:var(--t3)">'+U.esc(l.time)+'</span></div>';});h+='</div>';}
  h+='</div>';sh('pinner',h);
}


/* ══════════════════════════════════════════════════════════════════════════
   FAZ-6 — HEDEFLERDEN BAGIMSIZ GENEL NOTLAR
   Additive payload alani: generalNotes:[{id,title,content,pinned,archived,createdAt,updatedAt}].
   SMART/Quality/Coach/XP/progress ETKILEMEZ. Ham HTML SAKLANMAZ (markdown-string + renderRichText).
   ══════════════════════════════════════════════════════════════════════════ */
var _genNoteSeq=0;
function newGeneralNoteId(){return 'gn'+Date.now().toString(36)+'-'+(_genNoteSeq++).toString(36);}
