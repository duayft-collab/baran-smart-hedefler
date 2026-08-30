/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 6c: MIRROR + DEVELOPMENT UI
   Two calm screens. The session mirror the coach sees once, right after
   closing — and the development view they visit when they want to.

   The order matters: the coach writes their own reflection in the closing form
   BEFORE the mirror appears. The system is meant to train self-observation, not
   replace it, so it speaks second.

   Under ten seconds to read: one strength, one thing worth noticing, one thing
   to try. Everything else — the evidence, the ICF area, the full list — sits
   behind disclosure.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_MIRROR_UI_VERSION = 1;
var COACHING_L_CATEGORY = { LISTENING:'Dinleme', QUESTIONING:'Soru', REFLECTION:'Yansıtma',
  SILENCE:'Sessizlik', AWARENESS:'Farkındalık', CHALLENGE:'Meydan okuma',
  CLIENT_AGENCY:'Danışanın sahipliği', ACTION:'Eylem', SESSION_FLOW:'Görüşme akışı',
  METHOD_FLEXIBILITY:'Yaklaşım esnekliği', BOUNDARIES:'Sınırlar', SELF_AWARENESS:'Öz farkındalık' };

/* ══ Generate + persist the mirror for a completed session ══ */
async function coachingGenerateMirror(session, extra){
  if(!session) return {ok:false, error:'invalid_session'};
  var ev = await coachingLoadEvents(session.id, 100);
  var events = ev.ok ? ev.events : [];
  var mirror = coachingSessionMirror(session, events, extra || {});
  var summary = coachingMirrorSummary(mirror);
  var saved = await coachingSaveObservations(session, mirror.observations, summary);
  return { ok:true, mirror:mirror, summary:summary, session:saved.ok?saved.session:session,
    persisted:saved.ok };
}

/* ══ GÖRÜŞME AYNASI ══ */
function renderCoachingMirror(){
  COACHING_UI.view = 'mirror';
  var m = COACHING_UI.mirror;
  var h = '<div class="fade" style="max-width:720px">';
  h += coachingSectionHead('Görüşme Aynası',
    'Not bir puan değil — ne yaptığına dair bir gözlem.',
    '<button class="btn btn-s" onclick="coachingBackHome()">Kapat</button>');
  if(COACHING_UI.notice) h += coachingBanner('info', COACHING_UI.notice);
  if(COACHING_UI.error) h += coachingBanner('error', COACHING_UI.error);

  if(!m || m.insufficientEvidence){
    h += '<div class="card" style="padding:28px 22px;text-align:center">'+
      '<p style="font-size:13px;color:var(--t2);line-height:1.7">'+
      _cue((m && m.note) || 'Bu görüşmede ayna için yeterli yapılandırılmış kanıt yok.')+'</p></div>';
    h += '</div>'; sh('pinner', h); return;
  }

  var strengths = m.strengths || [], watch = m.watch || [], neutral = m.neutral || [];
  h += _cmuBlock('İyi yaptığın şey', strengths, 'var(--green)');
  h += _cmuBlock('Dikkat etmeye değer', watch.concat(neutral), 'var(--orange)');

  var p = COACHING_UI.practice;
  h += '<div class="card" style="padding:16px 18px;margin-bottom:14px;border-left:3px solid var(--blue)">'+
    '<p style="font-size:10.5px;font-weight:700;color:var(--blue);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Bir sonraki görüşmede dene</p>';
  if(p){
    h += '<p style="font-weight:700;font-size:13.5px;margin-bottom:3px">'+_cue(p.title)+'</p>'+
      '<p style="font-size:12.5px;color:var(--t2);line-height:1.7">'+_cue(p.instruction)+'</p>'+
      '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;font-weight:700;color:var(--blue)">Neden?</summary>'+
      '<p style="font-size:11.5px;color:var(--t2);margin-top:4px;line-height:1.6">'+_cue(p.why)+'</p></details>'+
      '<div style="display:flex;gap:7px;margin-top:12px;flex-wrap:wrap">'+
      '<button class="btn btn-p btn-sm" onclick="coachingAcceptPractice()">Kabul et</button>'+
      '<button class="btn btn-s btn-sm" onclick="coachingChangePractice()">Değiştir</button>'+
      '<button class="btn btn-g btn-sm" onclick="coachingSkipPractice()">Şimdi değil</button></div>';
  }else if(COACHING_UI.activePractice){
    h += '<p style="font-size:12.5px;color:var(--t2);line-height:1.7">Zaten açık bir pratiğin var: <b>'+
      _cue(COACHING_UI.activePractice.title)+'</b>. Aynı anda tek bir şeye çalışmak daha iyi sonuç veriyor.</p>';
  }else{
    h += '<p style="font-size:12.5px;color:var(--t2);line-height:1.7">Bu görüşmede belirgin bir pratik önerisi çıkmadı. Zorlama bir eleştiri üretmiyoruz.</p>';
  }
  h += '</div>';

  if(COACHING_UI.practiceAsk && COACHING_UI.activePractice){
    h += '<div class="card" style="padding:15px 17px;margin-bottom:14px">'+
      '<p style="font-weight:700;font-size:12.5px;margin-bottom:4px">Bu görüşmede pratiğini denedin mi?</p>'+
      '<p style="font-size:11.5px;color:var(--t3);margin-bottom:10px">'+_cue(COACHING_UI.activePractice.instruction)+'</p>'+
      '<div style="display:flex;gap:7px;flex-wrap:wrap">'+
      ['EVET','KISMEN','HAYIR'].map(function(o){
        return '<button class="btn btn-s btn-sm" data-o="'+o+'" onclick="coachingReportPracticeUi(this.dataset.o)">'+
          _cue({EVET:'Evet',KISMEN:'Kısmen',HAYIR:'Hayır'}[o])+'</button>';
      }).join('')+'</div>'+
      '<p style="font-size:11px;color:var(--t3);margin-top:9px">Kendi beyanın olarak kaydedilir. Doğru cevabı yok.</p></div>';
  }

  h += '<details class="card" style="padding:14px 16px"><summary style="cursor:pointer;font-weight:700;font-size:12.5px">Tüm gözlemler ve ICF bağlantısı</summary>';
  h += '<div style="margin-top:10px">';
  (m.observations||[]).forEach(function(o){ h += _cmuObservation(o, true); });
  h += '<p style="font-size:11px;color:var(--t3);margin-top:12px;line-height:1.6">'+
    _cue(COACHING_ICF_DISCLAIMER)+'</p></div></details>';
  h += '</div>';
  sh('pinner', h);
}
window.renderCoachingMirror = renderCoachingMirror;

function _cmuBlock(title, list, color){
  if(!list || !list.length) return '';
  var h = '<div class="card" style="padding:16px 18px;margin-bottom:14px;border-left:3px solid '+color+'">'+
    '<p style="font-size:10.5px;font-weight:700;color:'+color+';letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">'+_cue(title)+'</p>';
  list.forEach(function(o, i){ h += _cmuObservation(o, false, i>0); });
  return h + '</div>';
}
function _cmuObservation(o, showMeta, spaced){
  var h = '<div style="'+(spaced?'margin-top:12px;padding-top:12px;border-top:1px solid var(--s2);':'')+'">'+
    '<p style="font-weight:700;font-size:13px;margin-bottom:3px">'+_cue(o.title)+'</p>'+
    '<p style="font-size:12.5px;color:var(--t2);line-height:1.7">'+_cue(o.description)+'</p>';
  if(o.developmentDirection)
    h += '<p style="font-size:12px;color:var(--t2);line-height:1.7;margin-top:5px">'+_cue(o.developmentDirection)+'</p>';
  h += '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;font-weight:700;color:var(--blue)">Neye dayanıyor?</summary>'+
    '<p style="font-size:11.5px;color:var(--t2);margin-top:4px;line-height:1.6">'+_cue(o.evidenceText)+'</p>';
  if(showMeta){
    h += '<p style="font-size:11px;color:var(--t3);margin-top:5px">İlişkili alan: '+_cue(o.icfArea||'—')+
      ' · '+_cue(coachingLabel(COACHING_L_CATEGORY, o.category, o.category))+
      ' · '+_cue(coachingLabel(COACHING_MIRROR_CONFIDENCE_LABEL, o.confidence, o.confidence))+'</p>';
  }
  h += '</details>';
  h += '<button class="btn btn-g btn-sm" style="margin-top:8px;font-size:11px" data-c="'+_cue(o.code)+'" '+
    'onclick="coachingDisputeObservation(this.dataset.c)">Bu gözlem bana uymuyor</button>';
  return h + '</div>';
}

/* ── Practice actions ── */
async function coachingAcceptPractice(){
  var p = COACHING_UI.practice; if(!p) return;
  var res = await coachingSaveDevelopmentDoc(p);
  if(!res.ok){ COACHING_UI.error = coachingErrorText(res.error, res.reason); renderCoachingMirror(); return; }
  COACHING_UI.activePractice = p; COACHING_UI.practice = null;
  COACHING_UI.notice = 'Pratiğin kaydedildi. Bir sonraki görüşmede hatırlatacağım.';
  if(COACHING_UI.session) coachingRecordEvent(COACHING_UI.session, {type:'PRACTICE_ACCEPTED', practiceId:p.id});
  renderCoachingMirror();
}
window.coachingAcceptPractice = coachingAcceptPractice;
function coachingChangePractice(){
  var cat = coachingPracticeCatalog();
  var cur = COACHING_UI.practice;
  var idx = cur ? cat.map(function(x){ return x.code; }).indexOf(cur.code) : -1;
  var next = cat[(idx+1) % cat.length];
  COACHING_UI.practice = coachingBuildPractice(next.code, cur ? cur.sourceObservationIds : []);
  renderCoachingMirror();
}
window.coachingChangePractice = coachingChangePractice;
async function coachingSkipPractice(){
  var p = COACHING_UI.practice; if(!p) return;
  var skipped = coachingSetPracticeStatus(p, 'SKIPPED');
  await coachingSaveDevelopmentDoc(skipped);
  if(COACHING_UI.session) coachingRecordEvent(COACHING_UI.session, {type:'PRACTICE_SKIPPED', practiceId:p.id});
  COACHING_UI.practice = null;
  COACHING_UI.notice = 'Tamam. Pratik zorunlu değil.';
  renderCoachingMirror();
}
window.coachingSkipPractice = coachingSkipPractice;
async function coachingReportPracticeUi(outcome){
  var a = COACHING_UI.activePractice; if(!a) return;
  var res = coachingReportPractice(a, outcome, COACHING_UI.session ? COACHING_UI.session.id : null);
  if(!res.ok) return;
  await coachingSaveDevelopmentDoc(res.practice);
  COACHING_UI.activePractice = res.practice; COACHING_UI.practiceAsk = false;
  if(COACHING_UI.session) coachingRecordEvent(COACHING_UI.session, {type:'PRACTICE_REPORTED', practiceId:a.id, outcome:outcome});
  COACHING_UI.notice = 'Kaydedildi. Denemiş olman yeterli.';
  renderCoachingMirror();
}
window.coachingReportPracticeUi = coachingReportPracticeUi;

/* ── Disagreement ── */
function coachingDisputeObservation(code){
  var all = ((COACHING_UI.mirror && COACHING_UI.mirror.observations) || [])
    .concat(COACHING_UI.devObservations || []);
  var o = all.filter(function(x){ return x.code===code; })[0];
  if(!o) return;
  var h = '<div class="mh"><span style="font-weight:700;font-size:15px">Bu gözlem bana uymuyor</span>'+
    '<button class="btn btn-g btn-ic" onclick="closeModal()">'+_cuIc('x',14)+'</button></div><div class="mb">'+
    '<p style="font-size:12.5px;color:var(--t2);line-height:1.7;margin-bottom:12px">'+_cue(o.title)+
    ' — geri bildirimin kaydedilir, gözlem silinmez ve kural değişmez. İtiraz cezalandırılmaz.</p>';
  COACHING_FEEDBACK_REASONS.forEach(function(r){
    h += '<button class="btn btn-s btn-sm" style="margin:0 6px 6px 0" data-c="'+_cue(code)+'" data-r="'+r+'" '+
      'onclick="coachingSubmitDispute(this.dataset.c,this.dataset.r)">'+
      _cue(COACHING_FEEDBACK_LABEL[r])+'</button>';
  });
  h += '</div>';
  if(typeof showModal==='function') showModal(h);
}
window.coachingDisputeObservation = coachingDisputeObservation;
async function coachingSubmitDispute(code, reason){
  var all = ((COACHING_UI.mirror && COACHING_UI.mirror.observations) || [])
    .concat(COACHING_UI.devObservations || []);
  var o = all.filter(function(x){ return x.code===code; })[0];
  var fb = coachingBuildFeedback(o, reason);
  if(fb) await coachingSaveDevelopmentDoc(fb);
  if(COACHING_UI.session) coachingRecordEvent(COACHING_UI.session, {type:'OBSERVATION_DISPUTED', observationCode:code});
  if(typeof closeModal==='function') closeModal();
  COACHING_UI.notice = 'Geri bildirimin kaydedildi. Gözlem duruyor; kural değişmedi.';
  if(COACHING_UI.view==='development') renderCoachingDevelopment(); else renderCoachingMirror();
}
window.coachingSubmitDispute = coachingSubmitDispute;

/* ══ GELİŞİMİM ══ */
async function coachingLoadDevelopmentView(){
  COACHING_UI.busy = true;
  var s = await coachingListSessions({limit:20});
  var d = await coachingLoadDevelopment(null, 50);
  COACHING_UI.busy = false;
  /* a failed refresh must not turn a real history into "no pattern yet" */
  var sessions = s.ok
    ? s.sessions.filter(function(x){ return x.lifecycle==='completed'; })
    : (COACHING_UI.devSessions || []);
  if(!s.ok) COACHING_UI.error = coachingErrorText(s.error, s.reason);
  else if(d.ok) COACHING_UI.error = null;
  COACHING_UI.devSessions = sessions;
  COACHING_UI.devRecords = d.ok ? d.records : (COACHING_UI.devRecords || []);
  COACHING_UI.activePractice = coachingActivePractice(COACHING_UI.devRecords);
  COACHING_UI.devCross = coachingCrossSessionMirror(sessions);
  COACHING_UI.devObservations = COACHING_UI.devCross.observations || [];
  if(typeof tab!=='undefined' && tab==='coachdev') renderCoachingDevelopment();
}
window.coachingLoadDevelopmentView = coachingLoadDevelopmentView;

function renderCoachingDevelopment(){
  COACHING_UI.view = 'development';
  var cross = COACHING_UI.devCross || {sessionCount:0, observations:[]};
  var obs = cross.observations || [];
  var strengths = obs.filter(function(o){ return o.observationType==='STRENGTH'; });
  var watch = obs.filter(function(o){ return o.observationType!=='STRENGTH'; });
  var h = '<div class="fade" style="max-width:760px">';
  h += coachingSectionHead('Gelişimim',
    'Puan yok. Yalnız ne yaptığın ve neyi denemeye değer.',
    '<button class="btn btn-s" onclick="coachingBackHome()">Geri</button>');
  if(COACHING_UI.notice) h += coachingBanner('info', COACHING_UI.notice);

  var a = COACHING_UI.activePractice;
  h += '<div class="card" style="padding:16px 18px;margin-bottom:14px;border-left:3px solid '+(a?'var(--blue)':'var(--s3)')+'">'+
    '<p style="font-size:10.5px;font-weight:700;color:var(--t3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Aktif pratiğim</p>';
  if(a){
    h += '<p style="font-weight:700;font-size:13.5px;margin-bottom:3px">'+_cue(a.title)+'</p>'+
      '<p style="font-size:12.5px;color:var(--t2);line-height:1.7">'+_cue(a.instruction)+'</p>';
    var reports = a.reports || [];
    if(reports.length) h += '<p style="font-size:11.5px;color:var(--t3);margin-top:8px">'+
      reports.length+' görüşmede denendi · son yanıt: '+_cue({EVET:'Evet',KISMEN:'Kısmen',HAYIR:'Hayır'}[reports[reports.length-1].outcome]||'—')+'</p>';
    h += '<button class="btn btn-g btn-sm" style="margin-top:10px" onclick="coachingCompleteActivePractice()">Bu pratiği tamamla</button>';
  }else h += '<p style="font-size:12.5px;color:var(--t2)">Şu an açık bir pratiğin yok. Bir görüşme kapattığında ayna bir tane önerecek.</p>';
  h += '</div>';

  if(cross.note) h += '<div class="card" style="padding:20px;margin-bottom:14px"><p style="font-size:12.5px;color:var(--t2);line-height:1.7">'+_cue(cross.note)+'</p></div>';
  h += _cmuDevBlock('Koruman gereken taraflar', strengths, 'var(--green)');
  h += _cmuDevBlock('Pratik yapmaya değer alanlar', watch, 'var(--orange)');

  var icf = coachingIcfDevelopmentView(obs);
  h += '<details class="card" style="padding:14px 16px;margin-bottom:14px"><summary style="cursor:pointer;font-weight:700;font-size:12.5px">Gelişim alanları</summary><div style="margin-top:10px">';
  icf.areas.filter(function(x){ return x.evidenceCount>0; }).forEach(function(x){
    h += '<div style="padding:9px 0;border-top:1px solid var(--s2)">'+
      '<p style="font-weight:700;font-size:12.5px">'+_cue(x.area)+'</p>'+
      (x.strengths.length?'<p style="font-size:11.5px;color:var(--t2);margin-top:3px">Güçlü: '+_cue(x.strengths.join(' · '))+'</p>':'')+
      (x.practiceAreas.length?'<p style="font-size:11.5px;color:var(--t2);margin-top:3px">Pratik: '+_cue(x.practiceAreas.join(' · '))+'</p>':'')+
      '<p style="font-size:11px;color:var(--t3);margin-top:3px">Kanıt: '+x.evidenceCount+' gözlem · '+cross.sessionCount+' görüşme</p></div>';
  });
  if(!icf.areas.filter(function(x){ return x.evidenceCount>0; }).length)
    h += '<p style="font-size:12px;color:var(--t3)">Henüz alan bazlı kanıt oluşmadı.</p>';
  h += '<p style="font-size:11px;color:var(--t3);margin-top:12px;line-height:1.6">'+_cue(icf.disclaimer)+'</p>';
  h += '</div></details>';
  h += '</div>';
  sh('pinner', h);
}
window.renderCoachingDevelopment = renderCoachingDevelopment;
function _cmuDevBlock(title, list, color){
  if(!list || !list.length) return '';
  var h = '<div class="card" style="padding:16px 18px;margin-bottom:14px;border-left:3px solid '+color+'">'+
    '<p style="font-size:10.5px;font-weight:700;color:'+color+';letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">'+_cue(title)+'</p>';
  list.forEach(function(o,i){ h += _cmuObservation(o, true, i>0); });
  return h + '</div>';
}
async function coachingCompleteActivePractice(){
  var a = COACHING_UI.activePractice; if(!a) return;
  var done = coachingSetPracticeStatus(a, 'COMPLETED');
  await coachingSaveDevelopmentDoc(done);
  COACHING_UI.activePractice = null;
  COACHING_UI.notice = 'Pratik tamamlandı.';
  await coachingLoadDevelopmentView();
  renderCoachingDevelopment();
}
window.coachingCompleteActivePractice = coachingCompleteActivePractice;

function coachingMirrorUiSelfCheck(){
  return { version:COACHING_MIRROR_UI_VERSION, view:COACHING_UI.view,
    hasMirror:!!COACHING_UI.mirror, hasActivePractice:!!COACHING_UI.activePractice,
    reflectionBeforeMirror:true };
}

if(typeof window!=='undefined'){
  window.COACHING_MIRROR_UI_VERSION=COACHING_MIRROR_UI_VERSION;
  window.COACHING_L_CATEGORY=COACHING_L_CATEGORY;
  window.coachingGenerateMirror=coachingGenerateMirror;
  window.coachingMirrorUiSelfCheck=coachingMirrorUiSelfCheck;
}
