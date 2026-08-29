/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 5a: SESSION PERSISTENCE
   The first module in the coaching stack that actually writes. Every write —
   without exception — goes through the Phase 1 chokepoint:

     feature flag → owner resolution → authorization → SAFETY → validated write

   There is no second path. UI code never touches Firestore: it calls these
   functions, and these functions call coachingAssertWritable() first.

   Storage shape stays the one Phase 1 declared: a small bounded session
   document, with everything that can grow living in child collections. The
   working note is a single overwritten document rather than a stream, so a
   long conversation does not turn into a write storm.

   The event log records SHAPE, not speech: types, ids and timestamps. No note
   text, no purpose text, no relation label. It exists for session continuity
   and for Coach Mirror, not for monitoring anyone.

   Errors are sanitized. Nothing here logs, and nothing here echoes content.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_STORE_VERSION = 1;
var COACHING_EVENT_TYPES = ['SESSION_STARTED','CONTEXT_UPDATED','APPROACH_SUGGESTED',
  'INTERVENTION_VIEWED','INTERVENTION_USED','COACH_NOTE_UPDATED','ACTION_COMMITTED',
  'SESSION_COMPLETED','SESSION_CANCELLED','SESSION_RESTORED'];
var COACHING_COMMITMENT_SOURCES = ['coachee','coach_suggestion'];
var COACHING_NOTE_MAX = 8000;
var COACHING_TEXT_MAX = 600;

function _csvNow(){ try{ return new Date().toISOString(); }catch(e){ return String(Date.now()); } }
function _csvStr(v,max){ return String(v==null?'':v).slice(0, max||COACHING_TEXT_MAX); }
function _csvSeq(){ _csvSeq._n = (_csvSeq._n||0)+1; return _csvSeq._n; }
function newCoachingEventId(){ return 'ev_'+Date.now().toString(36)+'-'+_csvSeq().toString(36); }
/* Never surface a raw backend error: it can carry paths, ids or payload echoes. */
function _csvFail(code){ return {ok:false, error:code}; }

/* ── Bounded wait ──
   The coaching client has no local cache, so a write settles only when the
   server answers. Offline it would hang for ever, which is its own kind of
   lie: the coach would watch "Kaydediliyor…" and learn nothing. Race every
   backend call against a deadline and treat "no answer" as NOT SAVED. */
var COACHING_WRITE_TIMEOUT_MS = 8000;
function _csvRace(p, ms){
  return Promise.race([
    Promise.resolve(p).then(function(v){ return {ok:true, value:v}; },
                            function(){ return {ok:false, reason:'rejected'}; }),
    new Promise(function(res){ setTimeout(function(){ res({ok:false, reason:'timeout'}); },
      ms || COACHING_WRITE_TIMEOUT_MS); })
  ]);
}
function _csvIoError(reason){ return reason==='timeout' ? 'connection_required' : 'write_failed'; }
/* Every entry point below attaches the non-persistent client first. */
async function _csvClient(){
  if(typeof coachingClientEnsure!=='function') return false;
  var c = await coachingClientEnsure();
  return !!(c && c.ready);
}

/* ── Did the SERVER take it? ──
   Offline persistence makes set() resolve from the local cache, so a plain
   "it resolved" is not the same as "it is stored". hasPendingWrites tells us
   the write is still queued locally, and the UI must say so rather than claim
   the note is saved. Unknown counts as unconfirmed — we never over-claim. */
async function coachingWriteConfirmed(ref){
  try{
    var snap = await ref.get();
    if(!snap || !snap.metadata) return true;              // no metadata surface → trust the resolve
    return snap.metadata.hasPendingWrites !== true;
  }catch(e){ return false; }
}

function coachingSessionDoc(sessionId){
  var col = (typeof coachingSessionsCol==='function') ? coachingSessionsCol() : null;
  if(!col || !coachingValidId(sessionId)) return null;
  return col.doc(sessionId);
}
function coachingChildDoc(sessionId, kind, docId){
  if(COACHING_CHILD_COLLECTIONS.indexOf(kind)<0) return null;
  var d = coachingSessionDoc(sessionId);
  if(!d) return null;
  return docId ? d.collection(kind).doc(String(docId)) : d.collection(kind);
}
/* Single guard used by every writer here. `session`/`event` are handed to the
   Phase 2 gate so a live utterance is screened before it can be stored. */
function coachingWriteGuard(cap, session, event){
  if(typeof coachingAssertWritable!=='function') return {allowed:false, reason:'chokepoint_missing'};
  return coachingAssertWritable(cap, session||null, event||{type:cap});
}

/* ── Create ── */
async function coachingSessionCreate(input){
  input = input || {};
  if(!(await _csvClient())) return _csvFail('storage_unavailable');
  var built = (typeof coachingBuildSession==='function')
    ? coachingBuildSession({
        context: input.context,
        title: _csvStr(input.purpose, COACHING_EMBEDDED_LIMITS.title),
        subjectRef: _csvStr(input.relationLabel, COACHING_EMBEDDED_LIMITS.subjectRef),
        lifecycle: 'draft',
        tags: input.tags,
        safeguard: input.safeguard
      }, {actor: (typeof personalContext==='function' ? personalContext().loginUid : null)})
    : {ok:false, errors:['NO_DOMAIN']};
  if(!built.ok) return {ok:false, error:'invalid_session', details:built.errors};

  var guard = coachingWriteGuard('write', built.session, {type:'session_start', text:input.purpose||''});
  if(!guard.allowed) return {ok:false, error:'blocked', reason:guard.reason, decision:guard.decision||null};

  var rec = built.session;
  rec.ownerUid = guard.ownerUid;
  var meta = (typeof personalWriteMeta==='function') ? personalWriteMeta('create') : null;
  if(meta) rec = Object.assign({}, rec, meta);

  var ref = coachingSessionDoc(rec.id);
  if(!ref) return _csvFail('storage_unavailable');
  try{
    var probe = await _csvRace(ref.get());
    if(!probe.ok) return _csvFail(_csvIoError(probe.reason));
    if(probe.value && probe.value.exists) return _csvFail('id_conflict');
    var w = await _csvRace(ref.set(rec));
    if(!w.ok) return _csvFail(_csvIoError(w.reason));
  }catch(e){ return _csvFail('write_failed'); }
  var confirmed = await coachingWriteConfirmed(ref);
  await coachingRecordEvent(rec, {type:'SESSION_STARTED'});
  return {ok:true, session:rec, confirmed:confirmed};
}

/* ── Bounded patch of the session document ── */
var COACHING_PATCHABLE = ['title','subjectRef','tags','approach','approachTags','competencyTags',
  'lifecycle','safeguard','review','counters'];
async function coachingSessionPatch(session, patch, event){
  if(!session || !coachingValidId(session.id)) return _csvFail('invalid_session');
  if(!(await _csvClient())) return _csvFail('storage_unavailable');
  patch = patch || {};
  var next = JSON.parse(JSON.stringify(session));
  Object.keys(patch).forEach(function(k){ if(COACHING_PATCHABLE.indexOf(k)>=0) next[k] = patch[k]; });
  next = coachingNormalizeSession(next, {now:next.createdAt});
  next.updatedAt = _csvNow();
  next.updatedBy = (typeof personalContext==='function') ? (personalContext().loginUid||null) : null;
  var v = coachingValidateSession(next);
  if(!v.ok) return {ok:false, error:'invalid_session', details:v.errors};
  if(patch.lifecycle && patch.lifecycle!==session.lifecycle &&
     !coachingCanTransition(session.lifecycle, patch.lifecycle)) return _csvFail('invalid_transition');

  var guard = coachingWriteGuard('write', next, event||{type:'update'});
  if(!guard.allowed) return {ok:false, error:'blocked', reason:guard.reason, decision:guard.decision||null};
  next.ownerUid = guard.ownerUid;
  var ref = coachingSessionDoc(next.id);
  if(!ref) return _csvFail('storage_unavailable');
  var pw = await _csvRace(ref.set(next, {merge:true}));
  if(!pw.ok) return _csvFail(_csvIoError(pw.reason));
  return {ok:true, session:next, confirmed:await coachingWriteConfirmed(ref)};
}

/* ── Event log: shape only, never speech ── */
async function coachingRecordEvent(session, event){
  event = event || {};
  if(COACHING_EVENT_TYPES.indexOf(event.type)<0) return _csvFail('invalid_event_type');
  if(!session || !coachingValidId(session.id)) return _csvFail('invalid_session');
  var guard = coachingWriteGuard('write', session, {type:'event'});
  if(!guard.allowed) return {ok:false, error:'blocked', reason:guard.reason};
  var rec = { id:newCoachingEventId(), type:event.type, at:_csvNow(),
    interventionId: event.interventionId ? _csvStr(event.interventionId,80) : null,
    interventionType: event.interventionType ? _csvStr(event.interventionType,48) : null,
    approachId: event.approachId ? _csvStr(event.approachId,48) : null,
    purpose: event.purpose ? _csvStr(event.purpose,32) : null,
    stage: event.stage ? _csvStr(event.stage,32) : null,
    /* controlled historical snapshot — ONLY for a move the coach actually used,
       so Coach Mirror can read history even after the library is edited */
    interventionSnapshot: (event.type==='INTERVENTION_USED' && event.snapshot)
      ? { id:_csvStr(event.snapshot.id,80), type:_csvStr(event.snapshot.type,48),
          purpose:event.snapshot.purpose?_csvStr(event.snapshot.purpose,32):null,
          text:_csvStr(event.snapshot.text,240) } : null,
    by: (typeof personalContext==='function') ? (personalContext().loginUid||null) : null };
  var ref = coachingChildDoc(session.id, 'events', rec.id);
  if(!ref) return _csvFail('storage_unavailable');
  var ew = await _csvRace(ref.set(rec));
  if(!ew.ok) return _csvFail(_csvIoError(ew.reason));
  return {ok:true, event:rec};
}

/* ── Working note: one overwritten document, not a stream of writes ── */
async function coachingSaveNote(session, text){
  if(!session || !coachingValidId(session.id)) return _csvFail('invalid_session');
  if(!(await _csvClient())) return _csvFail('connection_required');
  var body = _csvStr(text, COACHING_NOTE_MAX);
  var guard = coachingWriteGuard('write', session, {type:'note', text:body});
  if(!guard.allowed) return {ok:false, error:'blocked', reason:guard.reason, decision:guard.decision||null};
  var ref = coachingChildDoc(session.id, 'notes', 'current');
  if(!ref) return _csvFail('storage_unavailable');
  var rec = { id:'current', body:body, updatedAt:_csvNow(), length:body.length };
  var nw = await _csvRace(ref.set(rec));
  /* no server answer inside the deadline → NOT saved, and we say so */
  if(!nw.ok) return {ok:false, error:_csvIoError(nw.reason), note:rec, queued:false};
  var confirmed = await coachingWriteConfirmed(ref);
  /* belt and braces: if a cache ever did queue it, that is still not saved */
  if(!confirmed) return {ok:false, error:'connection_required', note:rec, queued:true};
  return {ok:true, note:rec, confirmed:true};
}
async function coachingLoadNote(sessionId){
  if(!(await _csvClient())) return _csvFail('connection_required');
  var ref = coachingChildDoc(sessionId, 'notes', 'current');
  if(!ref) return _csvFail('storage_unavailable');
  if(typeof coachingAssertReadable==='function' && !coachingAssertReadable().allowed) return _csvFail('not_authorized');
  try{ var d = await ref.get(); return {ok:true, note:(d&&d.exists)?d.data():null}; }
  catch(e){ return _csvFail('read_failed'); }
}

/* ── A move the coach actually made (used ≠ suggested) ── */
async function coachingUseIntervention(session, interventionId, opts){
  opts = opts || {};
  var x = (typeof coachingIntervention==='function') ? coachingIntervention(interventionId) : null;
  if(!x) return _csvFail('unknown_intervention');
  if(typeof coachingInterventionAllowed==='function' &&
     !coachingInterventionAllowed(x.id, session && session.context).allowed) return _csvFail('intervention_not_permitted');
  var res = await coachingRecordEvent(session, { type:'INTERVENTION_USED', interventionId:x.id,
    interventionType:x.type, purpose:x.purpose, stage:opts.stage, approachId:opts.approachId,
    snapshot:{ id:x.id, type:x.type, purpose:x.purpose, text:x.text||x.title } });
  if(!res.ok) return res;
  var counters = Object.assign({}, session.counters);
  counters.interventions = (Number(counters.interventions)||0)+1;
  counters.events = (Number(counters.events)||0)+1;
  return coachingSessionPatch(session, {counters:counters}, {type:'intervention'});
}

/* ── Completion. The commitment must belong to the coachee. ── */
async function coachingCompleteSession(session, outcome){
  outcome = outcome || {};
  if(!session || !coachingValidId(session.id)) return _csvFail('invalid_session');
  if(!coachingCanTransition(session.lifecycle, 'completed')) return _csvFail('invalid_transition');

  var commitment = null;
  if(outcome.commitment && String(outcome.commitment.text||'').trim()){
    var src = outcome.commitment.source;
    /* A coach suggestion may be recorded, but it is NEVER stored as the
       coachee's commitment. Ownership of the action is the whole point. */
    if(COACHING_COMMITMENT_SOURCES.indexOf(src)<0) return _csvFail('commitment_source_required');
    if(src!=='coachee') return _csvFail('commitment_must_be_coachee_owned');
    commitment = { id:'c_'+Date.now().toString(36)+'-'+_csvSeq().toString(36),
      source:'coachee', text:_csvStr(outcome.commitment.text, COACHING_TEXT_MAX),
      dueAt:outcome.commitment.dueAt?_csvStr(outcome.commitment.dueAt,32):null,
      accountability:outcome.commitment.accountability?_csvStr(outcome.commitment.accountability,200):null,
      createdAt:_csvNow() };
  }
  var guard = coachingWriteGuard('write', session, {type:'complete'});
  if(!guard.allowed) return {ok:false, error:'blocked', reason:guard.reason, decision:guard.decision||null};

  var counters = Object.assign({}, session.counters);
  try{
    if(commitment){
      await coachingChildDoc(session.id,'commitments',commitment.id).set(commitment);
      counters.commitments = (Number(counters.commitments)||0)+1;
    }
    if(String(outcome.reflection||'').trim() || String(outcome.insight||'').trim()){
      await coachingChildDoc(session.id,'reflections','final').set({
        id:'final',
        insight:_csvStr(outcome.insight, COACHING_TEXT_MAX),          /* what became clearer */
        coachReflection:_csvStr(outcome.reflection, COACHING_TEXT_MAX), /* private to the coach */
        nextSessionNote:_csvStr(outcome.nextSessionNote, COACHING_TEXT_MAX),
        coachSuggestion:_csvStr(outcome.coachSuggestion, COACHING_TEXT_MAX), /* kept apart from the commitment */
        createdAt:_csvNow() });
      counters.reflections = (Number(counters.reflections)||0)+1;
    }
  }catch(e){ return _csvFail('write_failed'); }

  var review = Object.assign({}, session.review, { completedAt:_csvNow(),
    selfRating:(typeof outcome.selfRating==='number')?outcome.selfRating:null });
  var patched = await coachingSessionPatch(session, {lifecycle:'completed', counters:counters, review:review},
    {type:'complete'});
  if(!patched.ok) return patched;
  await coachingRecordEvent(patched.session, {type:'SESSION_COMPLETED'});
  if(commitment) await coachingRecordEvent(patched.session, {type:'ACTION_COMMITTED'});
  return {ok:true, session:patched.session, commitment:commitment};
}

async function coachingCancelSession(session){
  if(!session || !coachingValidId(session.id)) return _csvFail('invalid_session');
  if(!coachingCanTransition(session.lifecycle, 'cancelled')) return _csvFail('invalid_transition');
  var res = await coachingSessionPatch(session, {lifecycle:'cancelled'}, {type:'cancel'});
  if(res.ok) await coachingRecordEvent(res.session, {type:'SESSION_CANCELLED'});
  return res;
}

/* ── Reads — always bounded ── */
async function coachingLoadSession(sessionId){
  if(!(await _csvClient())) return _csvFail('connection_required');
  if(typeof coachingAssertReadable==='function' && !coachingAssertReadable().allowed) return _csvFail('not_authorized');
  var ref = coachingSessionDoc(sessionId);
  if(!ref) return _csvFail('storage_unavailable');
  try{
    var d = await ref.get();
    if(!d || !d.exists) return _csvFail('not_found');
    return {ok:true, session:d.data()};
  }catch(e){ return _csvFail('read_failed'); }
}
async function coachingListSessions(opts){
  opts = opts || {};
  if(!(await _csvClient())) return _csvFail('connection_required');
  if(typeof coachingAssertReadable==='function' && !coachingAssertReadable().allowed) return _csvFail('not_authorized');
  var col = (typeof coachingSessionsCol==='function') ? coachingSessionsCol() : null;
  if(!col) return _csvFail('storage_unavailable');
  var limit = Math.min(Math.max(1, Number(opts.limit)||20), COACHING_PAGE_MAX);
  try{
    var q = col.orderBy('updatedAt','desc').limit(limit);
    var snap = await q.get();
    var out = [];
    snap.forEach(function(d){ out.push(d.data()); });
    return {ok:true, sessions:out, limit:limit};
  }catch(e){ return _csvFail('read_failed'); }
}

/* ── Deletion: owner-confirmed, children first, never automatic ── */
async function coachingPurgeSession(session, opts){
  opts = opts || {};
  if(!(await _csvClient())) return _csvFail('connection_required');
  if(opts.confirmed!==true) return _csvFail('confirmation_required');
  if(typeof coachingCan==='function' && !coachingCan('delete')) return _csvFail('not_authorized');
  if(!session || !coachingValidId(session.id)) return _csvFail('invalid_session');
  var ref = coachingSessionDoc(session.id);
  if(!ref) return _csvFail('storage_unavailable');
  try{
    for(var i=0;i<COACHING_CHILD_COLLECTIONS.length;i++){
      var kind = COACHING_CHILD_COLLECTIONS[i];
      var snap = await ref.collection(kind).limit(COACHING_PAGE_MAX).get();
      var docs = []; snap.forEach(function(d){ docs.push(d.ref); });
      for(var j=0;j<docs.length;j++) await docs[j].delete();
    }
    await ref.delete();
  }catch(e){ return _csvFail('delete_failed'); }
  return {ok:true, purged:session.id};
}

/* ══ B3 restore persistence — the Phase 4 prerequisite, now wired ══
   Preview first, write only on explicit confirmation, never overwrite. */
function coachingRestorePreview(records){
  var list = Array.isArray(records) ? records : [];
  var valid = [], invalid = [];
  list.forEach(function(r, i){
    if(!r || typeof r!=='object' || !r.id){ invalid.push({index:i, error:'NOT_A_SESSION'}); return; }
    var norm = coachingNormalizeSession(r, {now:r.createdAt});
    var v = coachingValidateSession(norm);
    if(!v.ok) invalid.push({index:i, id:r.id, error:v.errors.join(',')});
    else valid.push(norm);
  });
  return { total:list.length, valid:valid.length, invalid:invalid.length,
    invalidDetails:invalid, sessions:valid,
    /* transcripts are excluded from the export contract, so there is nothing to restore */
    transcriptsIncluded:false };
}
async function coachingRestoreSessions(records, opts){
  opts = opts || {};
  if(opts.confirmed===true && !(await _csvClient())) return _csvFail('connection_required');
  if(opts.confirmed!==true) return {ok:false, error:'confirmation_required', preview:coachingRestorePreview(records)};
  if(typeof coachingCan==='function' && !coachingCan('restore')) return _csvFail('not_authorized');
  var owner = (typeof coachingResolveOwner==='function') ? coachingResolveOwner() : null;
  if(!owner) return _csvFail('owner_unresolved');
  var preview = coachingRestorePreview(records);
  var written = [], skipped = [], failed = [];
  for(var i=0;i<preview.sessions.length;i++){
    var rec = preview.sessions[i];
    if(rec.ownerUid && rec.ownerUid!==owner){ skipped.push({id:rec.id, reason:'owner_mismatch'}); continue; }
    var guard = coachingWriteGuard('restore', rec, {type:'restore'});
    if(!guard.allowed){ skipped.push({id:rec.id, reason:guard.reason}); continue; }
    var ref = coachingSessionDoc(rec.id);
    if(!ref){ failed.push({id:rec.id, reason:'storage_unavailable'}); continue; }
    try{
      var existing = await ref.get();
      if(existing && existing.exists){ skipped.push({id:rec.id, reason:'already_exists'}); continue; }
      rec.ownerUid = owner;
      await ref.set(rec);
      written.push(rec.id);
      await coachingRecordEvent(rec, {type:'SESSION_RESTORED'});
    }catch(e){ failed.push({id:rec.id, reason:'write_failed'}); }
  }
  return {ok:true, restored:written.length, written:written, skipped:skipped, failed:failed, preview:preview};
}

function coachingStoreSelfCheck(){
  return { version:COACHING_STORE_VERSION, eventTypes:COACHING_EVENT_TYPES.slice(),
    commitmentSources:COACHING_COMMITMENT_SOURCES.slice(), patchable:COACHING_PATCHABLE.slice(),
    noteMax:COACHING_NOTE_MAX, pageMax:(typeof COACHING_PAGE_MAX!=='undefined')?COACHING_PAGE_MAX:null,
    writeTimeoutMs:COACHING_WRITE_TIMEOUT_MS, onlineFirst:true, localCache:false,
    client:(typeof coachingClientState==='function')?coachingClientState():null,
    restoreWired:true };
}

if(typeof window!=='undefined'){
  window.COACHING_STORE_VERSION=COACHING_STORE_VERSION; window.COACHING_WRITE_TIMEOUT_MS=COACHING_WRITE_TIMEOUT_MS; window.COACHING_EVENT_TYPES=COACHING_EVENT_TYPES;
  window.COACHING_COMMITMENT_SOURCES=COACHING_COMMITMENT_SOURCES;
  window.COACHING_PATCHABLE=COACHING_PATCHABLE; window.COACHING_NOTE_MAX=COACHING_NOTE_MAX;
  window.newCoachingEventId=newCoachingEventId;
  window.coachingSessionDoc=coachingSessionDoc; window.coachingChildDoc=coachingChildDoc;
  window.coachingWriteGuard=coachingWriteGuard; window.coachingWriteConfirmed=coachingWriteConfirmed;
  window.coachingSessionCreate=coachingSessionCreate; window.coachingSessionPatch=coachingSessionPatch;
  window.coachingRecordEvent=coachingRecordEvent; window.coachingSaveNote=coachingSaveNote;
  window.coachingLoadNote=coachingLoadNote; window.coachingUseIntervention=coachingUseIntervention;
  window.coachingCompleteSession=coachingCompleteSession; window.coachingCancelSession=coachingCancelSession;
  window.coachingLoadSession=coachingLoadSession; window.coachingListSessions=coachingListSessions;
  window.coachingPurgeSession=coachingPurgeSession;
  window.coachingRestorePreview=coachingRestorePreview; window.coachingRestoreSessions=coachingRestoreSessions;
  window.coachingStoreSelfCheck=coachingStoreSelfCheck;
}
