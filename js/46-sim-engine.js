/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 9c: SIMULATION ENGINE

   One boundary matters here: simGenerateClientResponse(). Everything above it
   — safety, state, turns, debrief — is generator-agnostic. Today the only
   registered generator is DETERMINISTIC. When a server-side model is approved
   it registers as SERVER_SIDE_AI against the same contract and nothing else in
   Phase 9 moves.

   The engine reads two things about a coach turn: the intent the coach
   declared, and a few structural facts about the text (how many questions,
   how long). It does not read meaning, and it never claims to — every
   observation this phase produces is traceable to a declared intent or a
   counted character.

   Safety sits above the generator, not inside it. A RED decision from the
   Phase 2 authority ends the simulation regardless of what any generator
   would have said.
   ══════════════════════════════════════════════════════════════════════════ */

function _seStr(v,max){ return String(v==null?'':v).slice(0, max||SIM_TEXT_MAX); }
function _seNow(){ try{ return new Date().toISOString(); }catch(e){ return String(Date.now()); } }

/* Seeded so a test can replay a session exactly. Same seed, same practice. */
function simSeedFrom(str){
  var h = 2166136261;
  String(str||'').split('').forEach(function(c){
    h ^= c.charCodeAt(0); h = (h * 16777619) >>> 0;
  });
  return h >>> 0;
}
function simRandom(seed){
  /* one step of a small LCG — enough variation, fully reproducible */
  var s = (seed * 1664525 + 1013904223) >>> 0;
  return { seed:s, value: s / 4294967296 };
}

/* ── Structural signals ──
   Only what can be counted. No semantics, no inference about the person. */
function simStructuralSignals(text, intent){
  var t = _seStr(text);
  var questionMarks = (t.match(/\?/g)||[]).length;
  var words = t.trim() ? t.trim().split(/\s+/).length : 0;
  return {
    questionMarks: questionMarks,
    stacked: questionMarks >= 2,          /* two questions in one turn */
    words: words,
    longTurn: words >= 60,
    empty: words === 0,
    intent: SIM_INTENTS.indexOf(intent)>=0 ? intent : 'DIGER'
  };
}

/* ── State ── */
function simInitialState(scenario){
  return { ownership:'PRESERVED',
    engagement: (scenario && (scenario.context==='YOUTH'||scenario.context==='CHILD')) ? 'GUARDED' : 'NEUTRAL',
    depth:'SURFACE', boundaryReached:false, consecutiveQuestions:0, silenceUsed:0,
    reflectionUsed:0, adviceUsed:0, challengeUsed:0 };
}
function _seShift(list, current, target){
  if(!target) return current;
  return list.indexOf(target)>=0 ? target : current;
}
function simApplyTurnToState(state, signals, reply){
  var next = Object.assign({}, state);
  next.consecutiveQuestions = (signals.intent==='SORU')
    ? next.consecutiveQuestions + 1 : 0;
  if(signals.intent==='SESSIZLIK') next.silenceUsed++;
  if(signals.intent==='YANSITMA') next.reflectionUsed++;
  if(signals.intent==='BILGI_IZIN') next.adviceUsed++;
  if(signals.intent==='MEYDAN_OKUMA') next.challengeUsed++;
  if(reply){
    next.ownership = _seShift(SIM_OWNERSHIP, next.ownership, reply.ownership);
    next.engagement = _seShift(SIM_ENGAGEMENT, next.engagement, reply.engagement);
    next.depth = _seShift(SIM_DEPTH, next.depth, reply.depth);
  }
  /* piling questions on costs engagement — the one structural rule that bites */
  if(next.consecutiveQuestions >= 3 && SIM_ENGAGEMENT.indexOf(next.engagement) > 0)
    next.engagement = SIM_ENGAGEMENT[SIM_ENGAGEMENT.indexOf(next.engagement)-1];
  if(signals.stacked && SIM_ENGAGEMENT.indexOf(next.engagement) > 0)
    next.engagement = SIM_ENGAGEMENT[SIM_ENGAGEMENT.indexOf(next.engagement)-1];
  return next;
}

/* ── Generator boundary ──
   register(type, fn) where fn(context) -> {text, ownership, engagement, depth, note}
   The context handed to a generator is the whole simulation truth EXCEPT the
   coach's private world: there is nothing here from a real session. */
var SIM_GENERATOR_IMPL = {};
function simRegisterGenerator(type, fn){
  if(SIM_GENERATORS.indexOf(type)<0) return false;
  if(typeof fn!=='function') return false;
  SIM_GENERATOR_IMPL[type] = fn;
  return true;
}
function simGeneratorType(){ return SIM_ACTIVE_GENERATOR; }

function simBuildGeneratorContext(session, signals){
  var s = simScenario(session.scenarioId);
  return {
    scenarioId: session.scenarioId,
    context: s ? s.context : null,
    difficulty: s ? s.difficulty : null,
    hiddenDynamics: s ? s.hiddenDynamics.slice() : [],
    state: Object.assign({}, session.state),
    turnIndex: session.turns.length,
    signals: signals,
    seed: session.seed,
    safetyPolicy: s ? s.safetyPolicy : 'ORDINARY'
  };
}

/* The only generator that exists today. Authored branches, selected by the
   declared intent and narrowed by state; seeded variation where a branch has
   more than one candidate. */
function simDeterministicGenerator(ctx){
  var s = simScenario(ctx.scenarioId);
  if(!s) return null;
  var branch = s.responses[ctx.signals.intent];
  if(!Array.isArray(branch) || !branch.length) branch = s.responses.FALLBACK;
  if(!Array.isArray(branch) || !branch.length) return null;
  var st = ctx.state;
  /* prefer a reply whose `when` matches the live state, newest condition first */
  var matched = branch.filter(function(r){
    if(!r.when) return false;
    return r.when===st.depth || r.when===st.engagement || r.when===st.ownership;
  });
  var pool = matched.length ? matched : branch.filter(function(r){ return !r.when; });
  if(!pool.length) pool = branch;
  var pick = simRandom(ctx.seed + ctx.turnIndex);
  var chosen = pool[Math.floor(pick.value * pool.length) % pool.length];
  return { text: chosen.text, ownership: chosen.ownership, engagement: chosen.engagement,
    depth: chosen.depth, note: chosen.note || null, generator:'DETERMINISTIC' };
}
simRegisterGenerator('DETERMINISTIC', simDeterministicGenerator);

function simGenerateClientResponse(ctx){
  var fn = SIM_GENERATOR_IMPL[SIM_ACTIVE_GENERATOR];
  if(typeof fn!=='function') return null;
  return fn(ctx);
}

/* ── Safety, above everything ──
   The Phase 2 authority decides; the generator never gets a vote. */
function simSafetyCheck(session, coachText){
  var s = simScenario(session.scenarioId);
  if(!s) return {allowed:true};
  if(typeof coachingSafetyEvaluate!=='function') return {allowed:true};
  /* Hand the Phase 2 authority a session shaped the way it expects, with the
     practice context mapped onto a real coaching context so minors get the
     real safeguarding treatment. Guardian consent is granted here because the
     scenario is synthetic — the gate is being exercised for its content
     signals, not for a consent decision about a person who does not exist. */
  var ctxKey = SIM_CONTEXT_COACHING[s.context] || 'adult';
  var pseudoSession = { id:'coa_sim000000-1', context:ctxKey, lifecycle:'active',
    privacy:'private', safeguard:{ state:'clear', severity:'none', referral:'none',
      guardianConsent:{ state:'granted', by:null, at:null } } };
  var verdict = coachingSafetyEvaluate(pseudoSession, { type:'note', text:_seStr(coachText) });
  if(verdict && (verdict.decision==='stop_and_refer' || verdict.severity==='high'))
    return {allowed:false, decision:verdict.decision||'stop_and_refer',
      reason:verdict.reasonCode||verdict.reason||null};
  return {allowed:true};
}
/* A boundary drill reaches its edge on schedule, not by surprise. */
function simBoundaryDue(session){
  var s = simScenario(session.scenarioId);
  if(!s || s.safetyPolicy!=='BOUNDARY_DRILL') return false;
  return session.turns.filter(function(t){ return t.role==='coach'; }).length >= 1;
}

/* ── Turns ──
   Ids are stable per index so a retry after an uncertain write converges on
   the same pair instead of duplicating the exchange. */
function simTurnId(sessionId, index, role){ return 'trn_'+sessionId+'_'+index+'_'+role; }

function simBuildSession(scenarioId, opts){
  opts = opts || {};
  var s = simScenario(scenarioId);
  if(!s) return null;
  var id = opts.sessionId || ('sim_'+Date.now().toString(36));
  return {
    id: 'sim_'+String(id).replace(/[^A-Za-z0-9_.-]/g,'_'),
    kind: 'practice_session',
    scenarioId: s.scenarioId, scenarioVersion: s.version,
    generatorType: SIM_ACTIVE_GENERATOR,
    status: 'ACTIVE',
    startedAt: _seNow(), completedAt: null,
    seed: simSeedFrom(opts.seed != null ? String(opts.seed) : id),
    focusPracticeId: opts.focusPracticeId || null,
    state: simInitialState(s),
    turns: [ { id: simTurnId(id, 0, 'client'), index:0, role:'client',
               text: s.opening, at:_seNow() } ],
    debrief: null, coachReflection: null
  };
}

/* One exchange: the coach's turn, then the simulated reply. */
function simCoachTurn(session, coachText, intent){
  if(!session || session.status!=='ACTIVE') return {ok:false, error:'not_active'};
  var s = simScenario(session.scenarioId);
  if(!s) return {ok:false, error:'unknown_scenario'};
  var coachTurns = session.turns.filter(function(t){ return t.role==='coach'; }).length;
  if(coachTurns >= SIM_TURN_CAP) return {ok:false, error:'turn_cap_reached'};

  var text = _seStr(coachText);
  var signals = simStructuralSignals(text, intent);
  if(signals.empty && signals.intent!=='SESSIZLIK') return {ok:false, error:'empty_turn'};

  /* safety first, and it can end the practice */
  var safety = simSafetyCheck(session, text);
  var idx = session.turns.length;
  var coachTurn = { id: simTurnId(session.id, idx, 'coach'), index: idx, role:'coach',
    text: signals.intent==='SESSIZLIK' ? '' : text,
    intent: signals.intent, signals: signals, at:_seNow() };

  if(!safety.allowed){
    return { ok:true, coachTurn:coachTurn,
      clientTurn:{ id: simTurnId(session.id, idx+1, 'client'), index: idx+1, role:'client',
        text:'', at:_seNow(), safetyStop:true },
      safetyStop:true, decision:safety.decision, state:session.state };
  }

  var ctx = simBuildGeneratorContext(Object.assign({}, session, {turns:session.turns.concat([coachTurn])}), signals);
  var reply = simGenerateClientResponse(ctx);
  if(!reply) return {ok:false, error:'generator_unavailable'};

  var nextState = simApplyTurnToState(session.state, signals, reply);
  /* a boundary drill crosses its line once the coach has engaged */
  if(simBoundaryDue(session) && !nextState.boundaryReached && reply.note==='kapsam dışı sinyal')
    nextState.boundaryReached = true;
  if(s.safetyPolicy==='BOUNDARY_DRILL' && coachTurns>=1) nextState.boundaryReached = true;

  var clientTurn = { id: simTurnId(session.id, idx+1, 'client'), index: idx+1, role:'client',
    text: reply.text, at:_seNow(), note: reply.note||null, generator: reply.generator||SIM_ACTIVE_GENERATOR };
  return { ok:true, coachTurn:coachTurn, clientTurn:clientTurn, state:nextState,
    boundaryReached: nextState.boundaryReached };
}

/* A hint teaches judgement, never a line to copy. */
function simHint(session){
  if(!session) return null;
  var st = session.state;
  if(st.consecutiveQuestions >= 2)
    return 'Bir soru daha sormadan önce duyduğunu yansıtmayı düşünebilirsin.';
  if(st.adviceUsed >= 2)
    return 'Öneri vermek yerine danışanın kendi seçeneklerini sormayı düşün.';
  if(st.silenceUsed === 0 && session.turns.length >= 6)
    return 'Burada alan bırakmak da bir müdahaledir.';
  if(st.depth==='SURFACE' && session.turns.length >= 6)
    return 'Danışanın kullandığı en güçlü kelimeyi takip etmeyi düşün.';
  if(st.ownership!=='PRESERVED')
    return 'Kararı danışana geri vermenin bir yolunu arayabilirsin.';
  return 'Şu an acele etmene gerek yok.';
}

function simCanEnd(session){
  if(!session) return false;
  return session.turns.filter(function(t){ return t.role==='coach'; }).length >= SIM_MIN_TURNS_TO_END;
}

if(typeof window!=='undefined'){
  window.simSeedFrom=simSeedFrom; window.simRandom=simRandom;
  window.simStructuralSignals=simStructuralSignals; window.simInitialState=simInitialState;
  window.simApplyTurnToState=simApplyTurnToState; window.simRegisterGenerator=simRegisterGenerator;
  window.simGeneratorType=simGeneratorType; window.simBuildGeneratorContext=simBuildGeneratorContext;
  window.simDeterministicGenerator=simDeterministicGenerator;
  window.simGenerateClientResponse=simGenerateClientResponse;
  window.simSafetyCheck=simSafetyCheck; window.simBoundaryDue=simBoundaryDue;
  window.simTurnId=simTurnId; window.simBuildSession=simBuildSession;
  window.simCoachTurn=simCoachTurn; window.simHint=simHint; window.simCanEnd=simCanEnd;
  window.SIM_GENERATOR_IMPL=SIM_GENERATOR_IMPL;
}
