/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Phase 3 P1 — CHECK-IN HISTORY (İlerleme Geçmişi)
   TEK kaynak: D.goalCheckIns[]. Goal'a GÖMÜLMEZ. Goal varsayılan byte-identical.
   metric.current/health/confidence/planning/priority/lifecycle SESSİZ değişmez.
   Mevcut save/sync/backup motorları yeniden kullanılır (ikincisi açılmaz).
   Harness-güvenli: üst-seviye DOM/timer YOK (yalnız idempotent del-decorator).
   ══════════════════════════════════════════════════════════════════════════ */

function gciList(){ if(!Array.isArray(D.goalCheckIns))D.goalCheckIns=[]; return D.goalCheckIns; }
window.gciList=gciList;
function _gciGoal(goalId){ return (D.goals||[]).filter(function(g){return String(g.id)===String(goalId);})[0]||null; }
function goalCheckInById(id){ return gciList().filter(function(c){return String(c.id)===String(id);})[0]||null; }
function goalHasCheckIns(goalId){ return gciList().some(function(c){return String(c.goalId)===String(goalId);}); }
function goalCheckInCount(goalId){ return gciList().filter(function(c){return String(c.goalId)===String(goalId);}).length; }
function _gciToast(m,e){ var f=(typeof toast==='function')?toast:((typeof wqToast==='function')?wqToast:null); if(f)f(m,e); }
function _gciNow(){ try{return new Date().toISOString();}catch(e){return String(Date.now());} }

/* ── ID: ci-<ts36>-<seq36>; bağlam-tuzlu + havuz çakışma kontrolü (row-index / ci-legacy YOK) ── */
var _GCI_SALT=Math.floor(Math.random()*0x1000000).toString(36);
var _gciSeq=Math.floor(Math.random()*0x1000);
function newGoalCheckInId(existing){
  var id,guard=0;
  do{ _gciSeq++; id='ci-'+Date.now().toString(36)+'-'+(_GCI_SALT+_gciSeq.toString(36)); guard++; }
  while(existing&&existing[id]&&guard<100000);
  return id;
}

/* ── Sorgular (saf, DESC checkInDate, createdAt tie-break; mutasyon yok) ── */
function goalCheckIns(goalId){
  return gciList().filter(function(c){return String(c.goalId)===String(goalId);}).slice().sort(function(a,b){
    var da=String(a.checkInDate||''),db=String(b.checkInDate||'');
    if(da!==db)return da<db?1:-1;
    var ca=String(a.createdAt||''),cb=String(b.createdAt||'');
    return ca<cb?1:(ca>cb?-1:0);
  });
}
function latestGoalCheckIn(goalId){ return goalCheckIns(goalId)[0]||null; }
function previousGoalCheckIn(goalId){ return goalCheckIns(goalId)[1]||null; }
function orphanGoalCheckIns(){ return gciList().filter(function(c){return !_gciGoal(c.goalId);}); }

/* ── Progress (mevcut metric semantiği; direction'a saygılı; 0–100 clamp; geçersiz→null) ── */
function goalCheckInProgress(g,metricValue){
  var m=(typeof readMetric==='function')?readMetric(g):(g&&g.metric&&typeof g.metric.target==='number'?{target:g.metric.target,start:Number(g.metric.start||0),direction:g.metric.direction||'up',structured:true}:{structured:false});
  if(!m||!m.structured||m.target===m.start)return null;
  var v=Number(metricValue); if(isNaN(v))return null;
  var pct=(m.direction==='down')?(m.start-v)/(m.start-m.target)*100:(v-m.start)/(m.target-m.start)*100;
  return Math.max(0,Math.min(100,Math.round(pct)));
}

/* ── Trend: son iki geçerli check-in; progress öncelikli, yoksa metric+direction ── */
function goalCheckInTrend(goalId){
  var list=goalCheckIns(goalId), latest=list[0]||null, prev=list[1]||null;
  if(!latest||!prev)return {state:'unknown',metricDelta:null,progressDelta:null,latest:latest,previous:prev};
  var mA=(latest.metricValue!=null&&prev.metricValue!=null)?Number(latest.metricValue)-Number(prev.metricValue):null;
  var pA=(latest.progressPct!=null&&prev.progressPct!=null)?Number(latest.progressPct)-Number(prev.progressPct):null;
  var g=_gciGoal(goalId), dir=(g&&g.metric&&g.metric.direction==='down')?'down':'up';
  var state='unknown';
  if(pA!=null){ state=pA>0?'improving':(pA<0?'declining':'stable'); }
  else if(mA!=null){ state=(mA===0)?'stable':(((dir==='down')?mA<0:mA>0)?'improving':'declining'); }
  return {state:state,metricDelta:mA,progressDelta:pA,latest:latest,previous:prev};
}

/* ── Validasyon (içerik ASLA sessizce yeniden yazılmaz; bilinmeyen alanlar korunur) ── */
var GCI_ERR_TR={
  MISSING_GOAL_ID:'Hedef seçimi zorunlu.', GOAL_NOT_FOUND:'Bağlı hedef bulunamadı.',
  MISSING_CHECKIN_DATE:'Tarih zorunlu.', INVALID_CHECKIN_DATE:'Geçersiz tarih (YYYY-AA-GG).',
  INVALID_METRIC_VALUE:'Geçersiz metrik değeri.', INVALID_PROGRESS:'İlerleme 0–100 arası olmalı.',
  INVALID_HEALTH_STATUS:'Geçersiz durum.', INVALID_CONFIDENCE:'Geçersiz güven düzeyi.',
  DUPLICATE_CHECKIN_ID:'Bu kayıt zaten mevcut.', EMPTY_CHECKIN:'Anlamlı içerik gir (metrik/ilerleme/not/engel/aksiyon).',
  CONTROL_CHARACTER:'Metinde kontrol karakteri var.', UNICODE_REPLACEMENT_CHARACTER:'Metinde bozuk Unicode (�) var.'
};
function _gciErr(f,c){ return {field:f,code:c,message:GCI_ERR_TR[c]||c}; }
function _gciIsDate(s){ return /^\d{4}-\d{2}-\d{2}/.test(String(s||''))&&!isNaN(new Date(s).getTime()); }
function _gciCtrl(s){ s=String(s||""); for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i); if(c<=8||c===11||c===12||(c>=14&&c<=31))return true; } return false; }
function _gciRepl(s){ return String(s||'').indexOf('�')>=0; }
function _gciText(v){ return (typeof sanitizeRichText==='function')?sanitizeRichText(v):String(v==null?'':v); }
function _gciMeaningful(i){ return (i.metricValue!=null&&i.metricValue!=='')||(i.progressPct!=null&&i.progressPct!=='')||String(i.note||'').trim()||String(i.blockers||'').trim()||String(i.nextAction||'').trim(); }
function validateGoalCheckIn(input){
  input=input||{}; var errors=[];
  function e(f,c){errors.push(_gciErr(f,c));}
  if(input.goalId==null||input.goalId==='')e('goalId','MISSING_GOAL_ID');
  else if(!_gciGoal(input.goalId))e('goalId','GOAL_NOT_FOUND');
  if(!input.checkInDate)e('checkInDate','MISSING_CHECKIN_DATE');
  else if(!_gciIsDate(input.checkInDate))e('checkInDate','INVALID_CHECKIN_DATE');
  if(input.metricValue!=null&&input.metricValue!==''&&!isFinite(Number(input.metricValue)))e('metricValue','INVALID_METRIC_VALUE');
  if(input.progressPct!=null&&input.progressPct!==''){ var p=Number(input.progressPct); if(!isFinite(p)||p<0||p>100)e('progressPct','INVALID_PROGRESS'); }
  if(input.healthStatus!=null&&input.healthStatus!==''&&(typeof GOAL_HEALTH_STATUSES==='undefined'||GOAL_HEALTH_STATUSES.indexOf(input.healthStatus)<0))e('healthStatus','INVALID_HEALTH_STATUS');
  if(input.confidence!=null&&input.confidence!==''&&(typeof GOAL_CONFIDENCES==='undefined'||GOAL_CONFIDENCES.indexOf(input.confidence)<0))e('confidence','INVALID_CONFIDENCE');
  if(input.id&&goalCheckInById(input.id)&&!input.__editing)e('id','DUPLICATE_CHECKIN_ID');
  if(_gciCtrl(input.note)||_gciCtrl(input.blockers)||_gciCtrl(input.nextAction))e('note','CONTROL_CHARACTER');
  if(_gciRepl(input.note)||_gciRepl(input.blockers)||_gciRepl(input.nextAction))e('note','UNICODE_REPLACEMENT_CHARACTER');
  if(!_gciMeaningful(input))e('record','EMPTY_CHECKIN');
  // normalize (bilinmeyen alanlar korunur; içerik yeniden yazılmaz — yalnız yapısal)
  var rec=null;
  if(!errors.length){
    rec={}; Object.keys(input).forEach(function(k){ if(k!=='__editing')rec[k]=input[k]; });
    rec.goalId=String(input.goalId); rec.checkInDate=String(input.checkInDate);
    if(input.metricValue!=null&&input.metricValue!=='')rec.metricValue=Number(input.metricValue); else delete rec.metricValue;
    if(input.progressPct!=null&&input.progressPct!=='')rec.progressPct=Number(input.progressPct); else delete rec.progressPct;
    if(input.note!=null)rec.note=_gciText(input.note);
    if(input.blockers!=null)rec.blockers=_gciText(input.blockers);
    if(input.nextAction!=null)rec.nextAction=_gciText(input.nextAction);
  }
  return {errors:errors,warnings:[],record:rec};
}

/* ── Sync outcome / ACK (SG-SYNC-P0 deseni; motor DEĞİŞMEZ) ── */
function _gciSyncOutcome(revBefore){ if(typeof CLOUD==='undefined')return 'synced'; if(CLOUD.conflict)return 'conflict'; if(CLOUD.pendingMutation)return 'pending'; return 'synced'; }
function _gciAwaitAck(revBefore,okMsg){
  _gciToast('İlerleme kaydı buluta kaydediliyor…');
  if(typeof CLOUD==='undefined'){ _gciToast(okMsg); return; }
  var t=0,max=34; var iv=setInterval(function(){ t++;
    var o=_gciSyncOutcome(revBefore);
    if(o==='conflict'){ clearInterval(iv); _gciToast('İlerleme kaydı oluşturuldu ancak senkronizasyon çakışması oluştu.',true); return; }
    if(o==='synced'&&Number(CLOUD.revision||0)>revBefore){ clearInterval(iv); _gciToast(okMsg); return; }
    if(t>=max){ clearInterval(iv); _gciToast('İlerleme kaydı yerel olarak kaydedildi; bulut senkronizasyonu bekleniyor.',true); }
  },300);
}

/* ── ADD / EDIT (tek snap→save→ACK). opts.updateMetric → yalnız açık confirm ile goal.metric.current. ── */
function submitGoalCheckIn(input,opts){
  opts=opts||{};
  var editing=!!(input&&input.id&&goalCheckInById(input.id));
  var v=validateGoalCheckIn(editing?Object.assign({__editing:true},input):input);
  if(v.errors.length)return {ok:false,errors:v.errors};
  var g=_gciGoal(v.record.goalId);
  // metrik opt-in (yalnız açık onay + yapılandırılmış metrik)
  var doMetric=false;
  if(opts.updateMetric&&v.record.metricValue!=null){
    if(!g||!g.metric||typeof g.metric.target!=='number'){ _gciToast('Bu hedefte yapılandırılmış metrik bulunmadığı için hedef değeri güncellenemedi.',true); }
    else if(typeof confirm!=='function'||confirm('Bu Check-in kaydıyla birlikte hedefin güncel metrik değeri de değiştirilecek.')){ doMetric=true; }
  }
  var revBefore=(typeof CLOUD!=='undefined')?Number(CLOUD.revision||0):0;
  if(typeof snap==='function')snap();
  if(editing){
    var idx=-1,l=gciList(); for(var i=0;i<l.length;i++){if(String(l[i].id)===String(input.id)){idx=i;break;}}
    if(idx>=0){ var old=l[idx]; var merged=Object.assign({},old,v.record);   // old'un bilinmeyen additive alanları KORUNUR
      merged.id=old.id; merged.createdAt=old.createdAt; merged.createdBy=old.createdBy; merged.updatedAt=_gciNow(); D.goalCheckIns[idx]=merged; v.record=merged; }
  } else {
    var used={}; gciList().forEach(function(c){used[c.id]=1;});
    v.record.id=(input&&input.id&&!used[input.id])?input.id:newGoalCheckInId(used);
    v.record.createdAt=_gciNow(); v.record.updatedAt=v.record.createdAt;
    v.record.createdBy=(typeof CLOUD!=='undefined'&&CLOUD.uid)?String(CLOUD.uid):'';
    gciList().push(v.record);
  }
  if(doMetric)g.metric.current=Number(v.record.metricValue);   // YALNIZ metric.current
  if(typeof save==='function')save();
  if(typeof closeModal==='function')closeModal();
  _gciAwaitAck(revBefore,'İlerleme kaydı buluta kaydedildi.');
  if(typeof render==='function')render();
  return {ok:true,record:v.record,metricUpdated:doMetric};
}

/* ── DELETE (yalnız check-in; goal DEĞİŞMEZ) ── */
function deleteGoalCheckIn(id){
  var c=goalCheckInById(id); if(!c)return {ok:true,deleted:false};
  if(typeof confirm==='function'&&!confirm('Bu ilerleme kaydı silinsin mi?'))return {ok:false};
  var revBefore=(typeof CLOUD!=='undefined')?Number(CLOUD.revision||0):0;
  if(typeof snap==='function')snap();
  D.goalCheckIns=gciList().filter(function(x){return String(x.id)!==String(id);});
  if(typeof save==='function')save();
  _gciAwaitAck(revBefore,'İlerleme kaydı silindi.');
  if(typeof render==='function')render();
  return {ok:true,deleted:true};
}

/* ── Goal silme koruması (check-in varsa BLOKE; sessiz cascade YOK) ── */
function deleteGoalWithCheckInGuard(goalId){
  if(goalHasCheckIns(goalId)){ _gciToast('Bu hedefe bağlı '+goalCheckInCount(goalId)+' ilerleme kaydı bulunuyor. Hedefi doğrudan silemezsiniz.',true); return {ok:false,blocked:true}; }
  if(typeof _gciOrigDel==='function')return _gciOrigDel(goalId,'goal');
  return {ok:false};
}
/* del decorator (07/08 dosyaları DEĞİŞMEZ; goal+checkin ise blokla, aksi halde delege). Idempotent. */
var _gciOrigDel=null;
if(typeof del==='function'&&!window.__gciDelWrapped){
  _gciOrigDel=del;
  window.del=function(id,type){
    if(type==='goal'&&goalHasCheckIns(id)){ _gciToast('Bu hedefe bağlı '+goalCheckInCount(id)+' ilerleme kaydı bulunuyor. Hedefi doğrudan silemezsiniz.',true); return; }
    return _gciOrigDel.apply(this,arguments);
  };
  window.__gciDelWrapped=true;
}

/* ── UI (ince; ağır mantık burada, 09-goals yalnız çağırır) ── */
function _gciEsc(v){ return (typeof U!=='undefined'&&U&&U.esc)?U.esc(String(v==null?'':v)):String(v==null?'':v); }
function _gciHealthLabel(s){ return (typeof GOAL_HEALTH_LABELS!=='undefined'&&GOAL_HEALTH_LABELS[s])||s||''; }
function _gciConfLabel(c){ return (typeof GOAL_CONFIDENCE_LABELS!=='undefined'&&GOAL_CONFIDENCE_LABELS[c])||c||''; }
var GCI_TREND_LABEL={improving:'İyileşiyor',declining:'Geriliyor',stable:'Sabit',unknown:'—'};
function goalCheckInPanelHtml(goalId){
  var rows=goalCheckIns(goalId), tr=goalCheckInTrend(goalId);
  var h='<div style="margin-top:4px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  h+='<p class="lbl">İlerleme Geçmişi ('+rows.length+')'+(rows.length>1?' · '+_gciEsc(GCI_TREND_LABEL[tr.state]):'')+'</p>';
  h+='<button type="button" class="btn btn-g btn-sm" data-gid="'+_gciEsc(goalId)+'" onclick="openGoalCheckInForm(this.dataset.gid)">Check-in Ekle</button></div>';
  if(!rows.length){ h+='<p style="font-size:11px;color:var(--t3)">Henüz ilerleme kaydı yok.</p></div>'; return h; }
  rows.forEach(function(c){
    h+='<div style="background:var(--s2);border-radius:8px;padding:7px 10px;margin-bottom:5px;font-size:12px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b>'+_gciEsc(c.checkInDate)+'</b>';
    h+='<span style="display:flex;gap:4px">';
    h+='<button type="button" class="btn btn-s btn-sm" data-gid="'+_gciEsc(goalId)+'" data-id="'+_gciEsc(c.id)+'" onclick="openGoalCheckInForm(this.dataset.gid,this.dataset.id)" aria-label="Düzenle">Düzenle</button>';
    h+='<button type="button" class="btn btn-g btn-sm" data-id="'+_gciEsc(c.id)+'" onclick="deleteGoalCheckIn(this.dataset.id)" aria-label="Sil">Sil</button></span></div>';
    var parts=[];
    if(c.metricValue!=null)parts.push('Metrik: '+_gciEsc(c.metricValue));
    if(c.progressPct!=null)parts.push('İlerleme: %'+_gciEsc(c.progressPct));
    if(c.healthStatus)parts.push('Durum: '+_gciEsc(_gciHealthLabel(c.healthStatus)));
    if(c.confidence)parts.push('Güven: '+_gciEsc(_gciConfLabel(c.confidence)));
    if(parts.length)h+='<div style="color:var(--t2);margin-top:2px">'+parts.join(' · ')+'</div>';
    if(c.note)h+='<div style="margin-top:3px">'+_gciEsc(c.note)+'</div>';
    if(c.blockers)h+='<div style="margin-top:3px;color:var(--t2)"><b>Engeller:</b> '+_gciEsc(c.blockers)+'</div>';
    if(c.nextAction)h+='<div style="margin-top:3px;color:var(--t2)"><b>Sonraki:</b> '+_gciEsc(c.nextAction)+'</div>';
    h+='</div>';
  });
  h+='</div>'; return h;
}
window.goalCheckInPanelHtml=goalCheckInPanelHtml;

function goalCheckInFormHtml(goalId,editId){
  var g=_gciGoal(goalId), c=editId?goalCheckInById(editId):null;
  var today=(typeof U!=='undefined'&&U.today)?U.today():_gciNow().slice(0,10);
  var hs=(c&&c.healthStatus)||(g&&g.health&&g.health.status)||'on_track';
  var cf=(c&&c.confidence)||(g&&g.health&&g.health.confidence)||'medium';
  var mv=(c&&c.metricValue!=null)?c.metricValue:((g&&g.metric&&g.metric.current!=null)?g.metric.current:'');
  function opt(list,cur,lbl){ return list.map(function(v){return '<option value="'+v+'"'+(v===cur?' selected':'')+'>'+_gciEsc(lbl?lbl(v):v)+'</option>';}).join(''); }
  var hStat=(typeof GOAL_HEALTH_STATUSES!=='undefined')?GOAL_HEALTH_STATUSES:['on_track','at_risk','off_track','paused'];
  var confs=(typeof GOAL_CONFIDENCES!=='undefined')?GOAL_CONFIDENCES:['high','medium','low'];
  var h='<div class="mh"><span style="font-weight:700;font-size:15px">'+(c?'Check-in Düzenle':'Yeni Check-in')+'</span><button class="btn btn-g btn-ic" onclick="closeModal()">'+((typeof ic==='function')?ic('x',14):'x')+'</button></div><div class="mb">';
  h+='<p class="lbl">Check-in Tarihi</p><input class="inp" id="gci_date" type="date" value="'+_gciEsc((c&&c.checkInDate)||today)+'" aria-label="Check-in tarihi">';
  h+='<div style="display:flex;gap:8px;margin-top:6px"><div style="flex:1"><p class="lbl">Güncel Metrik</p><input class="inp" id="gci_mv" type="number" value="'+_gciEsc(mv)+'" oninput="_gciFormProgress(\''+_gciEsc(goalId)+'\')" aria-label="Metrik değeri"></div>';
  h+='<div style="flex:1"><p class="lbl">İlerleme %</p><input class="inp" id="gci_pct" type="number" min="0" max="100" value="'+_gciEsc(c&&c.progressPct!=null?c.progressPct:'')+'" aria-label="İlerleme yüzdesi"></div></div>';
  h+='<p id="gci_calc" style="font-size:11px;color:var(--t2);margin-top:3px"></p>';
  h+='<div style="display:flex;gap:8px;margin-top:6px"><div style="flex:1"><p class="lbl">Durum</p><select class="inp" id="gci_health" aria-label="Durum">'+opt(hStat,hs,_gciHealthLabel)+'</select></div>';
  h+='<div style="flex:1"><p class="lbl">Güven</p><select class="inp" id="gci_conf" aria-label="Güven">'+opt(confs,cf,_gciConfLabel)+'</select></div></div>';
  h+='<p class="lbl" style="margin-top:6px">İlerleme Notu</p><textarea class="inp" id="gci_note" rows="2" aria-label="İlerleme notu">'+_gciEsc((c&&c.note)||'')+'</textarea>';
  h+='<p class="lbl" style="margin-top:6px">Engeller</p><textarea class="inp" id="gci_block" rows="2" aria-label="Engeller">'+_gciEsc((c&&c.blockers)||'')+'</textarea>';
  h+='<p class="lbl" style="margin-top:6px">Sonraki Aksiyon</p><textarea class="inp" id="gci_next" rows="2" aria-label="Sonraki aksiyon">'+_gciEsc((c&&c.nextAction)||'')+'</textarea>';
  if(!c)h+='<label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;cursor:pointer"><input type="checkbox" class="cb" id="gci_upd_metric"> Bu değeri hedefin güncel metrik değeri olarak da uygula</label>';
  h+='</div><div class="mf"><button class="btn btn-s" style="flex:1" onclick="closeModal()">İptal</button><button class="btn btn-p" style="flex:2" data-gid="'+_gciEsc(goalId)+'" data-id="'+_gciEsc(editId||'')+'" onclick="_gciFormSubmit(this.dataset.gid,this.dataset.id)">Kaydet</button></div>';
  return h;
}
window.goalCheckInFormHtml=goalCheckInFormHtml;
function openGoalCheckInForm(goalId,editId){ if(typeof showModal==='function')showModal(goalCheckInFormHtml(goalId,editId)); }
window.openGoalCheckInForm=openGoalCheckInForm;
function _gciFormProgress(goalId){
  var g=_gciGoal(goalId), mv=(typeof ge==='function')?ge('gci_mv'):null, out=(typeof ge==='function')?ge('gci_calc'):null;
  if(!out)return; var val=mv&&mv.value; var p=(val!==''&&val!=null)?goalCheckInProgress(g,val):null;
  out.textContent=(p!=null)?('Hesaplanan ilerleme: %'+p):'';
}
window._gciFormProgress=_gciFormProgress;
function _gciFormSubmit(goalId,editId){
  function val(id){ var el=(typeof ge==='function')?ge(id):null; return el?el.value:''; }
  var input={goalId:goalId,checkInDate:val('gci_date'),metricValue:val('gci_mv'),progressPct:val('gci_pct'),
    healthStatus:val('gci_health'),confidence:val('gci_conf'),note:val('gci_note'),blockers:val('gci_block'),nextAction:val('gci_next')};
  if(editId)input.id=editId;
  var updEl=(typeof ge==='function')?ge('gci_upd_metric'):null; var opts={updateMetric:!!(updEl&&updEl.checked)};
  // metric/progress ciddi çelişki uyarısı (sessiz düzeltme YOK)
  var g=_gciGoal(goalId), calc=(input.metricValue!==''&&input.metricValue!=null)?goalCheckInProgress(g,input.metricValue):null;
  if(calc!=null&&input.progressPct!==''&&input.progressPct!=null&&Math.abs(calc-Number(input.progressPct))>=20)_gciToast('Girilen ilerleme ile metrikten hesaplanan ilerleme farklı (%'+calc+').',true);
  if(g&&g.metric&&g.metric.direction==='down'&&opts.updateMetric)_gciToast('Bu hedefin metrik yönü azalan (down).');
  var res=submitGoalCheckIn(input,opts);
  if(!res.ok&&res.errors)_gciToast(res.errors[0].message,true);
  var box=(typeof ge==='function')?ge('goal_checkin_box'):null; if(box&&res.ok)box.innerHTML=goalCheckInPanelHtml(goalId);
  return res;
}
window._gciFormSubmit=_gciFormSubmit;

/* Exports (test + onclick) */
window.newGoalCheckInId=newGoalCheckInId; window.goalCheckInById=goalCheckInById;
window.goalCheckIns=goalCheckIns; window.latestGoalCheckIn=latestGoalCheckIn; window.previousGoalCheckIn=previousGoalCheckIn;
window.validateGoalCheckIn=validateGoalCheckIn; window.goalCheckInProgress=goalCheckInProgress; window.goalCheckInTrend=goalCheckInTrend;
window.submitGoalCheckIn=submitGoalCheckIn; window.deleteGoalCheckIn=deleteGoalCheckIn;
window.goalHasCheckIns=goalHasCheckIns; window.goalCheckInCount=goalCheckInCount; window.orphanGoalCheckIns=orphanGoalCheckIns;
window.deleteGoalWithCheckInGuard=deleteGoalWithCheckInGuard;
