/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 9a: SIMULATOR DOMAIN

   Practice without a real client. The scenario is synthetic, the simulated
   coachee is synthetic, and — for this release — so is the mechanism: the
   responses are authored and selected by deterministic rules, not generated
   by a model. The UI says so. Nothing here is described as AI, because it
   is not, and a product that overstates what it is teaches the coach to
   trust the wrong thing.

   What this module owns: the scenario schema, the qualitative simulation
   state, and the generator BOUNDARY. When a server-side model is eventually
   approved it replaces exactly one thing — the client-response generator —
   and nothing else in this phase has to move.

   Everything professional stays canonical: interventions, anti-patterns,
   competencies, safety and practices are all references, checked here.
   ══════════════════════════════════════════════════════════════════════════ */

var SIM_VERSION = 1;

var SIM_CONTEXTS = ['ADULT','EXECUTIVE','CAREER','HABIT_CHANGE','AMBIVALENCE','YOUTH','CHILD'];
var SIM_CONTEXT_LABEL = {
  ADULT:'Yetişkin', EXECUTIVE:'Yönetici', CAREER:'Kariyer', HABIT_CHANGE:'Davranış değişimi',
  AMBIVALENCE:'Kararsızlık', YOUTH:'Ergen', CHILD:'Çocuk' };
/* which real coaching context each practice context maps onto, so the
   canonical safeguarding rules apply unchanged */
var SIM_CONTEXT_COACHING = {
  ADULT:'adult', EXECUTIVE:'executive', CAREER:'adult', HABIT_CHANGE:'adult',
  AMBIVALENCE:'adult', YOUTH:'youth', CHILD:'child' };

var SIM_DIFFICULTY = ['FOUNDATION','INTERMEDIATE','ADVANCED'];
var SIM_DIFFICULTY_LABEL = { FOUNDATION:'Temel', INTERMEDIATE:'Orta', ADVANCED:'İleri' };

/* The coach declares what they meant to do. The engine cannot read language,
   so it does not pretend to: the declared intent is the honest input, and the
   few structural signals below are the only things read from the text. */
var SIM_INTENTS = ['SORU','YANSITMA','GOZLEM','MEYDAN_OKUMA','BILGI_IZIN','SESSIZLIK','DIGER'];
var SIM_INTENT_LABEL = {
  SORU:'Soru', YANSITMA:'Yansıtma', GOZLEM:'Gözlem', MEYDAN_OKUMA:'Meydan okuma',
  BILGI_IZIN:'İzinli bilgi / öneri', SESSIZLIK:'Bekle / alan bırak', DIGER:'Diğer' };
/* every intent maps onto the Phase 3 taxonomy — no second authority */
var SIM_INTENT_INTERVENTION = {
  SORU:'OPEN_QUESTION', YANSITMA:'REFLECTION', GOZLEM:'OBSERVATION',
  MEYDAN_OKUMA:'CHALLENGE', BILGI_IZIN:'PERMISSION_BASED_INFORMATION',
  SESSIZLIK:'SILENCE', DIGER:null };

/* Qualitative only. A percentage here would be invented precision about a
   simulated person, which is worse than useless. */
var SIM_OWNERSHIP = ['PRESERVED','WEAKENING','HANDED_TO_COACH'];
var SIM_OWNERSHIP_LABEL = {
  PRESERVED:'Danışanda', WEAKENING:'Zayıflıyor', HANDED_TO_COACH:'Koça geçti' };
var SIM_ENGAGEMENT = ['GUARDED','NEUTRAL','ENGAGED','OPEN'];
var SIM_ENGAGEMENT_LABEL = {
  GUARDED:'Temkinli', NEUTRAL:'Nötr', ENGAGED:'Katılımcı', OPEN:'Açık' };
var SIM_DEPTH = ['SURFACE','EXPLORING','DEEPENING'];
var SIM_DEPTH_LABEL = { SURFACE:'Yüzey', EXPLORING:'Keşfediyor', DEEPENING:'Derinleşiyor' };

var SIM_STATUS = ['ACTIVE','COMPLETED','ABANDONED'];
var SIM_TURN_CAP = 24;
var SIM_MIN_TURNS_TO_END = 3;
var SIM_TEXT_MAX = 800;
var SIM_REFLECTION_MAX = 600;

/* The generator is honest about itself. */
var SIM_GENERATORS = ['DETERMINISTIC','SERVER_SIDE_AI'];
var SIM_ACTIVE_GENERATOR = 'DETERMINISTIC';

var SIM_DISCLAIMER =
  'Bu bir pratik simülasyonudur. Karşındaki kişi gerçek değildir ve yanıtlar ' +
  'önceden yazılmış senaryo kurgusundan seçilir — yapay zekâ tarafından üretilmez. ' +
  'Gerçek danışan bilgisi kullanma.';
var SIM_PRIVACY_REMINDER = 'Gerçek danışan bilgisi kullanmayın.';

var SIM_LIMITS = { title:120, line:400, profile:400 };
function _smStr(v,max){ return String(v==null?'':v).slice(0, max||SIM_LIMITS.line); }
function _smList(v,max,lim){
  if(!Array.isArray(v)) return [];
  return v.slice(0, max||10).map(function(x){ return _smStr(x, lim); });
}
function _smIds(v,max){
  if(!Array.isArray(v)) return [];
  return v.slice(0, max||10).map(function(x){ return _smStr(x,64); });
}

var SIM_SCENARIOS = {};
var SIM_SCENARIO_ORDER = [];

/* A scenario's hiddenDynamics drive what the simulated coachee does. They are
   never shown before the practice — that is the whole point of practising. */
function simRegisterScenario(scenarioId, def){
  def = def || {};
  var s = {
    scenarioId: _smStr(scenarioId,64),
    version: Number(def.version)||1,
    title: _smStr(def.title, SIM_LIMITS.title),
    context: SIM_CONTEXTS.indexOf(def.context)>=0 ? def.context : 'ADULT',
    difficulty: SIM_DIFFICULTY.indexOf(def.difficulty)>=0 ? def.difficulty : 'FOUNDATION',
    developmentGoal: _smStr(def.developmentGoal, SIM_LIMITS.line),
    visibleContext: _smStr(def.visibleContext, SIM_LIMITS.line),
    clientProfile: _smStr(def.clientProfile, SIM_LIMITS.profile),
    opening: _smStr(def.opening, SIM_LIMITS.line),
    hiddenDynamics: _smList(def.hiddenDynamics, 5),
    targetCompetencies: _smIds(def.targetCompetencies, 4),
    relevantApproaches: _smIds(def.relevantApproaches, 4),
    relevantInterventions: _smIds(def.relevantInterventions, 6),
    antiPatternRisks: _smIds(def.antiPatternRisks, 6),
    academyUnitTags: _smIds(def.academyUnitTags, 4),
    bookTags: _smIds(def.bookTags, 3),
    practiceIds: _smIds(def.practiceIds, 3),
    mirrorLinks: _smIds(def.mirrorLinks, 5),
    /* a scenario is either ordinary practice or explicitly a boundary drill —
       crisis content never ambushes a coach inside a normal scenario */
    safetyPolicy: (def.safetyPolicy==='BOUNDARY_DRILL') ? 'BOUNDARY_DRILL' : 'ORDINARY',
    boundaryTrigger: def.boundaryTrigger ? _smStr(def.boundaryTrigger, SIM_LIMITS.line) : null,
    debriefFocus: _smIds(def.debriefFocus, 5),
    responses: (def.responses && typeof def.responses==='object') ? def.responses : {},
    endConditions: _smList(def.endConditions, 4),
    status: def.status==='draft' ? 'draft' : 'published'
  };
  SIM_SCENARIOS[s.scenarioId] = s;
  if(SIM_SCENARIO_ORDER.indexOf(s.scenarioId)<0) SIM_SCENARIO_ORDER.push(s.scenarioId);
  return s;
}
function simScenario(id){ return SIM_SCENARIOS[id] || null; }
function simScenariosByContext(ctx){
  return SIM_SCENARIO_ORDER.map(simScenario).filter(function(s){ return s && s.context===ctx; });
}

/* What the coach may see before starting. hiddenDynamics is deliberately absent. */
function simBriefing(scenarioId){
  var s = simScenario(scenarioId);
  if(!s) return null;
  return { scenarioId:s.scenarioId, title:s.title, context:s.context,
    difficulty:s.difficulty, developmentGoal:s.developmentGoal,
    visibleContext:s.visibleContext, clientProfile:s.clientProfile,
    safetyPolicy:s.safetyPolicy };
}

/* ── Integrity ── */
function simIntegrity(){
  var errors = [];
  var haveType = (typeof COACHING_INTERVENTION_TYPES!=='undefined') ? COACHING_INTERVENTION_TYPES : null;
  var haveAnti = (typeof COACHING_ANTIPATTERNS!=='undefined') ? COACHING_ANTIPATTERNS : null;
  var haveApproach = (typeof COACHING_APPROACHES!=='undefined') ? COACHING_APPROACHES : null;
  var havePractice = (typeof COACHING_PRACTICES!=='undefined') ? COACHING_PRACTICES : null;
  var haveMirror = (typeof COACHING_MIRROR_CATEGORIES!=='undefined') ? COACHING_MIRROR_CATEGORIES : null;
  var haveUnit = (typeof academyUnit==='function') ? academyUnit : null;
  var haveBook = (typeof book==='function') ? book : null;
  var haveCtx = (typeof COACHING_CONTEXTS!=='undefined') ? COACHING_CONTEXTS : null;
  var competencies = (typeof COACHING_ICF_AREA!=='undefined')
    ? Object.keys(COACHING_ICF_AREA).map(function(k){ return COACHING_ICF_AREA[k]; }) : null;

  SIM_SCENARIO_ORDER.forEach(function(id){
    var s = SIM_SCENARIOS[id];
    if(!s.title) errors.push(id+': missing title');
    if(!s.opening) errors.push(id+': missing opening line');
    if(!s.developmentGoal) errors.push(id+': missing development goal');
    if(!s.hiddenDynamics.length) errors.push(id+': no hidden dynamics — nothing to practise against');
    if(!s.visibleContext) errors.push(id+': missing visible context');
    if(haveType) s.relevantInterventions.forEach(function(t){
      if(!haveType[t]) errors.push(id+': unknown intervention type '+t); });
    if(haveAnti) s.antiPatternRisks.forEach(function(t){
      if(!haveAnti[t]) errors.push(id+': unknown anti-pattern '+t); });
    if(haveApproach) s.relevantApproaches.forEach(function(t){
      if(!haveApproach[t]) errors.push(id+': unknown approach '+t); });
    if(havePractice) s.practiceIds.forEach(function(t){
      if(!havePractice[t]) errors.push(id+': unknown practice '+t); });
    if(haveMirror) s.mirrorLinks.forEach(function(t){
      if(haveMirror.indexOf(t)<0) errors.push(id+': unknown mirror category '+t); });
    if(haveUnit) s.academyUnitTags.forEach(function(t){
      if(!haveUnit(t)) errors.push(id+': unknown academy unit '+t); });
    if(haveBook) s.bookTags.forEach(function(t){
      if(!haveBook(t)) errors.push(id+': unknown book '+t); });
    if(competencies) s.targetCompetencies.forEach(function(t){
      if(competencies.indexOf(t)<0) errors.push(id+': unknown competency '+t); });
    if(haveCtx && !haveCtx[SIM_CONTEXT_COACHING[s.context]])
      errors.push(id+': context does not map to a coaching context');
    if(s.safetyPolicy==='BOUNDARY_DRILL' && !s.boundaryTrigger)
      errors.push(id+': boundary drill without a trigger');
    if(s.safetyPolicy==='ORDINARY' && s.boundaryTrigger)
      errors.push(id+': ordinary scenario must not hide a crisis trigger');
    /* every branch the engine can ask for must exist */
    SIM_INTENTS.forEach(function(intent){
      if(intent==='DIGER') return;
      if(!Array.isArray(s.responses[intent]) || !s.responses[intent].length)
        errors.push(id+': no response branch for '+intent);
    });
    if(!Array.isArray(s.responses.FALLBACK) || !s.responses.FALLBACK.length)
      errors.push(id+': no FALLBACK branch');
  });
  return { ok: errors.length===0, errors: errors,
    scenarios: SIM_SCENARIO_ORDER.length,
    contexts: SIM_CONTEXTS.filter(function(c){ return simScenariosByContext(c).length>0; }).length };
}

/* The product must not describe itself as something it is not. */
var SIM_FORBIDDEN_AI_CLAIMS = /yapay zek[aâ] (üretir|yanıtl|oluştur)|\bAI (Coach|Client|Simulation)\b|GPT|LLM/i;
function simAiClaimAudit(){
  var hits = [];
  SIM_SCENARIO_ORDER.forEach(function(id){
    var s = SIM_SCENARIOS[id];
    if(SIM_FORBIDDEN_AI_CLAIMS.test(JSON.stringify(s))) hits.push(id);
  });
  return { ok: hits.length===0, hits: hits, activeGenerator: SIM_ACTIVE_GENERATOR };
}

if(typeof window!=='undefined'){
  window.SIM_VERSION=SIM_VERSION; window.SIM_CONTEXTS=SIM_CONTEXTS;
  window.SIM_CONTEXT_LABEL=SIM_CONTEXT_LABEL; window.SIM_CONTEXT_COACHING=SIM_CONTEXT_COACHING;
  window.SIM_DIFFICULTY=SIM_DIFFICULTY; window.SIM_DIFFICULTY_LABEL=SIM_DIFFICULTY_LABEL;
  window.SIM_INTENTS=SIM_INTENTS; window.SIM_INTENT_LABEL=SIM_INTENT_LABEL;
  window.SIM_INTENT_INTERVENTION=SIM_INTENT_INTERVENTION;
  window.SIM_OWNERSHIP=SIM_OWNERSHIP; window.SIM_OWNERSHIP_LABEL=SIM_OWNERSHIP_LABEL;
  window.SIM_ENGAGEMENT=SIM_ENGAGEMENT; window.SIM_ENGAGEMENT_LABEL=SIM_ENGAGEMENT_LABEL;
  window.SIM_DEPTH=SIM_DEPTH; window.SIM_DEPTH_LABEL=SIM_DEPTH_LABEL;
  window.SIM_STATUS=SIM_STATUS; window.SIM_TURN_CAP=SIM_TURN_CAP;
  window.SIM_MIN_TURNS_TO_END=SIM_MIN_TURNS_TO_END; window.SIM_TEXT_MAX=SIM_TEXT_MAX;
  window.SIM_REFLECTION_MAX=SIM_REFLECTION_MAX; window.SIM_GENERATORS=SIM_GENERATORS;
  window.SIM_ACTIVE_GENERATOR=SIM_ACTIVE_GENERATOR; window.SIM_DISCLAIMER=SIM_DISCLAIMER;
  window.SIM_PRIVACY_REMINDER=SIM_PRIVACY_REMINDER;
  window.SIM_SCENARIOS=SIM_SCENARIOS; window.SIM_SCENARIO_ORDER=SIM_SCENARIO_ORDER;
  window.simRegisterScenario=simRegisterScenario; window.simScenario=simScenario;
  window.simScenariosByContext=simScenariosByContext; window.simBriefing=simBriefing;
  window.simIntegrity=simIntegrity; window.simAiClaimAudit=simAiClaimAudit;
}
