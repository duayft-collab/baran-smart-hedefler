/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 6b: DELIBERATE PRACTICE + COACH FEEDBACK
   One practice at a time. Not eight improvement tasks, not a task manager, and
   not a streak: a single small thing to try in the next conversation, which the
   coach may accept, change or skip without consequence.

   The mirror can be wrong. "Bu gözlem bana uymuyor" is a first-class action
   here, it is stored as the coach's own evidence, and it never deletes the
   observation or silently rewrites a rule. Disagreement is data, not defiance.

   No XP, no levels, no medals, no daily guilt. Mastery is the motivation.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_PRACTICE_VERSION = 1;
var COACHING_PRACTICE_STATUS = ['ACTIVE','COMPLETED','SKIPPED'];
var COACHING_PRACTICE_OUTCOMES = ['EVET','KISMEN','HAYIR'];
var COACHING_FEEDBACK_REASONS = ['CONTEXT_DIFFERENT','INTENTIONAL','MISSING_DATA','OTHER'];
var COACHING_FEEDBACK_LABEL = { CONTEXT_DIFFERENT:'Bağlam farklıydı', INTENTIONAL:'Bilerek yaptım',
  MISSING_DATA:'Eksik veri var', OTHER:'Diğer' };

var _cpSeq = 0;
function _cpId(prefix){ return prefix+'_'+Date.now().toString(36)+'-'+(_cpSeq++).toString(36); }
function _cpNow(){ try{ return new Date().toISOString(); }catch(e){ return String(Date.now()); } }
function _cpStr(v,max){ return String(v==null?'':v).slice(0,max||400); }

/* ── Catalogue. Small, concrete, and doable inside one conversation. ── */
var COACHING_PRACTICES = {};
function _cp(code, def){
  COACHING_PRACTICES[code] = { code:code, focusArea:def.focusArea, title:def.title,
    instruction:def.instruction, why:def.why, competencyTags:[def.focusArea],
    relevantContexts:def.relevantContexts || null,   /* null = every context */
    reviewAfterSessions:def.reviewAfterSessions || 3 };
}
_cp('PRACTICE_REFLECT_BEFORE_ASKING', { focusArea:'REFLECTION',
  title:'Sormadan önce yansıt',
  instruction:'Bu hafta: yeni bir soru sormadan önce en az bir kez duyduğunu geri ver.',
  why:'Yansıtma, danışanın kendi cümlesini dışarıdan duymasını sağlar; arka arkaya soru bunu zorlaştırır.' });
_cp('PRACTICE_HOLD_SILENCE', { focusArea:'SILENCE',
  title:'Farkındalıktan sonra bekle',
  instruction:'Bu hafta: önemli bir cevaptan sonra üç saniye hiçbir şey söyleme.',
  why:'Farkındalık doğduğu anda konuşmak onu kapatır; sessizlik onu büyütür.' });
_cp('PRACTICE_AWARENESS_BEFORE_ACTION', { focusArea:'AWARENESS',
  title:'Eylemden önce farkındalık',
  instruction:'Bu hafta: eylem planına geçmeden önce "buradan ne fark ettin?" diye sor.',
  why:'Erken eylem, yanlış soruna doğru çözüm üretme riskini taşır.' });
_cp('PRACTICE_CLIENT_OWNS_ACTION', { focusArea:'CLIENT_AGENCY',
  title:'Eylemi danışan söylesin',
  instruction:'Bu hafta: kapanışta eylemi kendi cümlelerinle özetleme; danışanın söylemesini bekle.',
  why:'Koçun cümlesiyle yazılan taahhüt, danışanın taahhüdü değildir.' });
_cp('PRACTICE_SPACE_AFTER_CHALLENGE', { focusArea:'CHALLENGE',
  title:'Meydan okumadan sonra alan bırak',
  instruction:'Bu hafta: bir meydan okumanın ardından hemen devam etme; yansıt veya bekle.',
  why:'Alan bırakılmayan meydan okuma çoğu zaman savunma üretir.',
  relevantContexts:['self','adult','executive'] });
_cp('PRACTICE_ELICIT_BEFORE_INFORM', { focusArea:'CLIENT_AGENCY',
  title:'Bilgi vermeden önce sor',
  instruction:'Bu hafta: bilgi paylaşmadan önce danışanın konu hakkında ne bildiğini sor.',
  why:'Önce sorulan bilgi paylaşımı tavsiyeye dönüşmez, seçenek olarak kalır.' });

function coachingPracticeCatalog(){ return Object.keys(COACHING_PRACTICES).sort().map(function(k){ return COACHING_PRACTICES[k]; }); }
function coachingPracticeDef(code){ return Object.prototype.hasOwnProperty.call(COACHING_PRACTICES,code)?COACHING_PRACTICES[code]:null; }

/* ── Choosing ONE. The most serious watch observation that names a practice. ── */
function coachingSuggestPractice(mirror, existingRecords){
  var obs = (mirror && mirror.observations) || [];
  var active = coachingActivePractice(existingRecords);
  if(active) return { practice:null, active:active, reason:'already_active' };
  var candidates = obs.filter(function(o){ return o.observationType==='WATCH' && o.practiceSuggestion &&
    coachingPracticeDef(o.practiceSuggestion); });
  if(!candidates.length) return { practice:null, active:null, reason:'no_candidate' };
  /* stable choice: first by rule order, which is already severity-ordered */
  var chosen = candidates[0];
  return { practice:coachingBuildPractice(chosen.practiceSuggestion, [chosen.id]), active:null,
    reason:'suggested', fromObservation:chosen.code };
}
function coachingBuildPractice(code, sourceObservationIds){
  var def = coachingPracticeDef(code);
  if(!def) return null;
  return { id:_cpId('prc'), kind:'practice', code:code, focusArea:def.focusArea,
    title:def.title, instruction:def.instruction, why:def.why,
    sourceObservationIds:Array.isArray(sourceObservationIds)?sourceObservationIds.slice(0,8):[],
    competencyTags:def.competencyTags.slice(), relevantContexts:def.relevantContexts,
    status:'ACTIVE', startedAt:_cpNow(), completedAt:null,
    reviewAfterSessions:def.reviewAfterSessions, evidenceWindow:[], reports:[],
    version:COACHING_PRACTICE_VERSION };
}
function coachingActivePractice(records){
  var list = (Array.isArray(records) ? records : []).filter(function(r){ return r && r.kind==='practice' && r.status==='ACTIVE'; });
  list.sort(function(a,b){ return String(b.startedAt).localeCompare(String(a.startedAt)); });
  return list[0] || null;
}
function coachingSetPracticeStatus(practice, status){
  if(!practice || COACHING_PRACTICE_STATUS.indexOf(status)<0) return null;
  var next = JSON.parse(JSON.stringify(practice));
  next.status = status;
  if(status!=='ACTIVE') next.completedAt = _cpNow();
  return next;
}
/* One subtle line, only where the practice is actually relevant. */
function coachingPracticeReminder(practice, session){
  if(!practice || practice.status!=='ACTIVE') return null;
  var ctx = (session && session.context) || null;
  if(practice.relevantContexts && ctx && practice.relevantContexts.indexOf(ctx)<0) return null;
  return { practiceId:practice.id, title:practice.title, text:practice.instruction };
}
function coachingReportPractice(practice, outcome, sessionId){
  if(!practice) return {ok:false, error:'no_practice'};
  if(COACHING_PRACTICE_OUTCOMES.indexOf(outcome)<0) return {ok:false, error:'invalid_outcome'};
  var next = JSON.parse(JSON.stringify(practice));
  next.reports = (next.reports||[]).concat([{ at:_cpNow(), outcome:outcome,
    sessionId:sessionId?_cpStr(sessionId,64):null }]).slice(-20);
  if(sessionId && next.evidenceWindow.indexOf(sessionId)<0) next.evidenceWindow = next.evidenceWindow.concat([sessionId]).slice(-20);
  /* self-reported, never treated as objective proof — and never a failure */
  return {ok:true, practice:next, selfReported:true};
}

/* ── Disagreement ── stored, never punished, never auto-applied to the rules. */
function coachingBuildFeedback(observation, reason, note){
  if(!observation || !observation.code) return null;
  if(COACHING_FEEDBACK_REASONS.indexOf(reason)<0) return null;
  return { id:_cpId('fb'), kind:'feedback', observationCode:_cpStr(observation.code,48),
    category:_cpStr(observation.category,48), sessionId:observation.sessionId||null,
    reason:reason, reasonLabel:COACHING_FEEDBACK_LABEL[reason],
    note:note!=null?_cpStr(note,240):null, at:_cpNow(), version:COACHING_PRACTICE_VERSION };
}
/* Calibration evidence for a later phase. Structure only: no labels about the
   coach, no client identity, no notes, no transcript. */
function coachingCalibrationSignals(records, sessions){
  var recs = Array.isArray(records) ? records : [];
  var sess = Array.isArray(sessions) ? sessions : [];
  var fb = recs.filter(function(r){ return r.kind==='feedback'; });
  var pr = recs.filter(function(r){ return r.kind==='practice'; });
  var reports = pr.reduce(function(a,p){ return a.concat(p.reports||[]); },[]);
  var byReason = {}; fb.forEach(function(f){ byReason[f.reason] = (byReason[f.reason]||0)+1; });
  var byOutcome = {}; reports.forEach(function(r){ byOutcome[r.outcome] = (byOutcome[r.outcome]||0)+1; });
  return { disputedByReason:byReason, disputedCodes:fb.map(function(f){ return f.observationCode; }),
    practicesAccepted:pr.filter(function(p){ return p.status==='ACTIVE'||p.status==='COMPLETED'; }).length,
    practicesSkipped:pr.filter(function(p){ return p.status==='SKIPPED'; }).length,
    practiceOutcomes:byOutcome, relevantSessionCount:sess.length,
    contextCategories:Object.keys(sess.reduce(function(m,s){ if(s&&s.context)m[s.context]=1; return m; },{})).sort(),
    approachCategories:Object.keys(sess.reduce(function(m,s){ if(s&&s.approach)m[s.approach]=1; return m; },{})).sort(),
    version:COACHING_PRACTICE_VERSION };
}

function coachingPracticeSelfCheck(){
  return { version:COACHING_PRACTICE_VERSION, catalog:Object.keys(COACHING_PRACTICES).sort(),
    statuses:COACHING_PRACTICE_STATUS.slice(), outcomes:COACHING_PRACTICE_OUTCOMES.slice(),
    feedbackReasons:COACHING_FEEDBACK_REASONS.slice(), onePrimaryActive:true, gamification:false };
}

if(typeof window!=='undefined'){
  window.COACHING_PRACTICE_VERSION=COACHING_PRACTICE_VERSION;
  window.COACHING_PRACTICES=COACHING_PRACTICES; window.COACHING_PRACTICE_STATUS=COACHING_PRACTICE_STATUS;
  window.COACHING_PRACTICE_OUTCOMES=COACHING_PRACTICE_OUTCOMES;
  window.COACHING_FEEDBACK_REASONS=COACHING_FEEDBACK_REASONS; window.COACHING_FEEDBACK_LABEL=COACHING_FEEDBACK_LABEL;
  window.coachingPracticeCatalog=coachingPracticeCatalog; window.coachingPracticeDef=coachingPracticeDef;
  window.coachingSuggestPractice=coachingSuggestPractice; window.coachingBuildPractice=coachingBuildPractice;
  window.coachingActivePractice=coachingActivePractice; window.coachingSetPracticeStatus=coachingSetPracticeStatus;
  window.coachingPracticeReminder=coachingPracticeReminder; window.coachingReportPractice=coachingReportPractice;
  window.coachingBuildFeedback=coachingBuildFeedback; window.coachingCalibrationSignals=coachingCalibrationSignals;
  window.coachingPracticeSelfCheck=coachingPracticeSelfCheck;
}
