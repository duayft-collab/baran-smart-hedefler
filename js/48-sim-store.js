/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 9e: PRACTICE PERSISTENCE

   No new storage architecture, for the fourth phase running: practice records
   are coach-level development data, so they live in the same owner-private
   coachingDevelopment collection, tagged by `kind`, behind the same
   non-persistent client and the same already-deployed rules. No rules change.

   The separation that matters most is here. A practice session is written as
   `kind:'practice_session'` in the development collection — NEVER as a
   coachingSession, never as an observation, never anywhere the Coach Mirror
   reads. Mirror evidence comes from real conversations with real people, and
   a simulation must not be allowed to look like one.
   ══════════════════════════════════════════════════════════════════════════ */

var SIM_DEV_KINDS = { session:'practice_session', reflection:'practice_reflection' };
var SIM_LOAD_LIMIT = 60;
/* stored turns are capped: a practice transcript is for the debrief, not an archive */
var SIM_STORED_TURN_CAP = 40;

function _spFail(code){ return {ok:false, error:code}; }

/* What actually gets persisted — bounded, and no scenario text copied in. */
function simSessionRecord(session){
  if(!session || !session.id) return null;
  var turns = (session.turns||[]).slice(0, SIM_STORED_TURN_CAP).map(function(t){
    return { id:t.id, index:t.index, role:t.role,
      text:String(t.text==null?'':t.text).slice(0, SIM_TEXT_MAX),
      intent:t.intent||null, at:t.at||null };
  });
  return {
    id: session.id, kind: SIM_DEV_KINDS.session,
    scenarioId: session.scenarioId, scenarioVersion: session.scenarioVersion||1,
    generatorType: session.generatorType || SIM_ACTIVE_GENERATOR,
    status: SIM_STATUS.indexOf(session.status)>=0 ? session.status : 'ACTIVE',
    startedAt: session.startedAt || null, completedAt: session.completedAt || null,
    seed: session.seed || 0,
    focusPracticeId: session.focusPracticeId || null,
    state: session.state || null,
    boundaryHandled: session.boundaryHandled===true,
    turns: turns,
    debrief: session.debrief || null,
    updatedAt: (function(){ try{ return new Date().toISOString(); }catch(e){ return ''; } })()
  };
}

async function simSaveSession(session){
  if(typeof coachingSaveDevelopmentDoc!=='function') return _spFail('storage_unavailable');
  var rec = simSessionRecord(session);
  if(!rec) return _spFail('invalid_record');
  return await coachingSaveDevelopmentDoc(rec);
}

function simBuildReflection(sessionId, text){
  var body = String(text==null?'':text).slice(0, SIM_REFLECTION_MAX);
  if(!sessionId || !body.trim()) return null;
  return { id:'prf_'+sessionId, kind:SIM_DEV_KINDS.reflection, sessionId:sessionId,
    body:body, updatedAt:(function(){ try{ return new Date().toISOString(); }catch(e){ return ''; } })() };
}
async function simSaveReflection(sessionId, text){
  if(typeof coachingSaveDevelopmentDoc!=='function') return _spFail('storage_unavailable');
  var rec = simBuildReflection(sessionId, text);
  if(!rec) return _spFail('invalid_record');
  return await coachingSaveDevelopmentDoc(rec);
}

async function simLoadRecords(limit){
  if(typeof coachingLoadDevelopment!=='function') return _spFail('storage_unavailable');
  var n = Math.min(Math.max(1, Number(limit)||SIM_LOAD_LIMIT), SIM_LOAD_LIMIT);
  var r = await coachingLoadDevelopment(null, n);
  if(!r.ok) return r;                      /* a failed read is not "no practice" */
  return {ok:true, records: r.records || []};
}
function simSessionsFrom(records){
  return (records||[]).filter(function(r){ return r && r.kind===SIM_DEV_KINDS.session; })
    .sort(function(a,b){ return String(b.startedAt).localeCompare(String(a.startedAt)); });
}
function simReflectionFor(records, sessionId){
  return (records||[]).filter(function(r){
    return r && r.kind===SIM_DEV_KINDS.reflection && r.sessionId===sessionId; })[0] || null;
}

/* The debrief's one recommendation becomes a canonical Phase 6 practice.
   There is no simulator practice tracker. */
async function simAdoptPractice(debrief){
  if(!debrief || !debrief.practiceCode) return _spFail('no_practice');
  if(typeof coachingBuildPractice!=='function' || typeof coachingSaveDevelopmentDoc!=='function')
    return _spFail('storage_unavailable');
  var rec = coachingBuildPractice(debrief.practiceCode);
  if(!rec) return _spFail('no_practice');
  var saved = await coachingSaveDevelopmentDoc(rec);
  if(!saved.ok) return saved;
  return {ok:true, practice:rec};
}

/* Owner-scoped and kind-scoped: practice records only. */
async function simPurge(records){
  if(typeof coachingPurgeDevelopment!=='function') return _spFail('storage_unavailable');
  var ids = (records||[]).filter(function(r){
    return r && (r.kind===SIM_DEV_KINDS.session || r.kind===SIM_DEV_KINDS.reflection);
  }).map(function(r){ return r.id; });
  if(!ids.length) return {ok:true, purged:0};
  var res = await coachingPurgeDevelopment(ids);
  if(!res.ok) return res;
  return {ok:true, purged:ids.length};
}

if(typeof window!=='undefined'){
  window.SIM_DEV_KINDS=SIM_DEV_KINDS; window.SIM_LOAD_LIMIT=SIM_LOAD_LIMIT;
  window.SIM_STORED_TURN_CAP=SIM_STORED_TURN_CAP;
  window.simSessionRecord=simSessionRecord; window.simSaveSession=simSaveSession;
  window.simBuildReflection=simBuildReflection; window.simSaveReflection=simSaveReflection;
  window.simLoadRecords=simLoadRecords; window.simSessionsFrom=simSessionsFrom;
  window.simReflectionFor=simReflectionFor; window.simAdoptPractice=simAdoptPractice;
  window.simPurge=simPurge;
}
