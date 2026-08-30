/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 7e: ACADEMY PERSISTENCE

   Academy adds no storage architecture of its own. Personal learning state is
   coach-level development data, exactly like a deliberate practice or a
   mirror dispute, so it lives in the SAME owner-private coachingDevelopment
   collection, tagged by `kind`, reached through the SAME non-persistent
   client, and covered by the SAME already-deployed rules.

   That is why there is no second Firebase client, no second rules block and
   no rules change in this phase. Every call below goes through the canonical
   bounded helpers, so an Academy write can fail truthfully but can never hang.

   The curriculum itself is application content and is never copied into a
   user's data — only the unitId is stored.
   ══════════════════════════════════════════════════════════════════════════ */

var ACADEMY_LOAD_LIMIT = 120;

/* Every entry point returns a controlled result; nothing here throws at the UI. */
function _asFail(code){ return {ok:false, error:code}; }

async function academySaveUnitState(unitId, state, extra){
  if(typeof coachingSaveDevelopmentDoc!=='function') return _asFail('storage_unavailable');
  var rec = academyBuildUnitState(unitId, state, extra);
  if(!rec) return _asFail('invalid_record');
  /* bounded by coachingSaveDevelopmentDoc's _csvRace — no separate deadline */
  return await coachingSaveDevelopmentDoc(rec);
}

async function academySaveReflection(unitId, text){
  if(typeof coachingSaveDevelopmentDoc!=='function') return _asFail('storage_unavailable');
  var rec = academyBuildReflection(unitId, text);
  if(!rec) return _asFail('invalid_record');
  return await coachingSaveDevelopmentDoc(rec);
}

/* One bounded read for everything the Academy screens need. The development
   collection already holds practices and mirror feedback, and the engine wants
   those too (an active practice drives the first recommendation), so a single
   query serves the whole surface rather than one query per kind. */
async function academyLoadRecords(limit){
  if(typeof coachingLoadDevelopment!=='function') return _asFail('storage_unavailable');
  var n = Math.min(Math.max(1, Number(limit)||ACADEMY_LOAD_LIMIT), ACADEMY_LOAD_LIMIT);
  var r = await coachingLoadDevelopment(null, n);
  if(!r.ok) return r;
  return {ok:true, records: r.records || []};
}

function academyRecordsOfKind(records, kind){
  return (records||[]).filter(function(r){ return r && r.kind===kind; });
}
function academyReflectionFor(records, unitId){
  var list = academyRecordsOfKind(records, ACADEMY_DEV_KINDS.reflection)
    .filter(function(r){ return r.unitId===unitId; });
  list.sort(function(a,b){ return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return list[0] || null;
}

/* Turning a unit's suggestion into a real deliberate practice goes through the
   Phase 6 practice architecture — Academy does not keep a second tracker, and
   the one-active-practice rule stays where it already lives. */
async function academyAdoptPractice(unitId){
  var u = academyUnit(unitId);
  if(!u || !u.practiceIds.length) return _asFail('no_practice');
  if(typeof coachingBuildPractice!=='function' || typeof coachingSaveDevelopmentDoc!=='function')
    return _asFail('storage_unavailable');
  var rec = coachingBuildPractice(u.practiceIds[0]);
  if(!rec) return _asFail('no_practice');
  var saved = await coachingSaveDevelopmentDoc(rec);
  if(!saved.ok) return saved;
  var st = await academySaveUnitState(unitId, 'PRACTICING', {practiceCode:u.practiceIds[0]});
  if(!st.ok) return st;
  return {ok:true, practice:rec, unitState:st.record};
}

/* Purge is owner-scoped and kind-scoped: it removes Academy records only, and
   never touches practices, mirror feedback or any coaching session. */
async function academyPurge(records){
  if(typeof coachingPurgeDevelopment!=='function') return _asFail('storage_unavailable');
  var ids = (records||[]).filter(function(r){
    return r && (r.kind===ACADEMY_DEV_KINDS.unit || r.kind===ACADEMY_DEV_KINDS.reflection
      || r.kind===ACADEMY_DEV_KINDS.check);
  }).map(function(r){ return r.id; });
  if(!ids.length) return {ok:true, purged:0};
  var res = await coachingPurgeDevelopment(ids);
  if(!res.ok) return res;
  return {ok:true, purged:ids.length};
}

if(typeof window!=='undefined'){
  window.ACADEMY_LOAD_LIMIT=ACADEMY_LOAD_LIMIT;
  window.academySaveUnitState=academySaveUnitState; window.academySaveReflection=academySaveReflection;
  window.academyLoadRecords=academyLoadRecords; window.academyRecordsOfKind=academyRecordsOfKind;
  window.academyReflectionFor=academyReflectionFor; window.academyAdoptPractice=academyAdoptPractice;
  window.academyPurge=academyPurge;
}
