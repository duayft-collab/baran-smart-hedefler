/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 1: DOMAIN + PRIVACY FOUNDATION
   Foundation only. NO screen, NO menu entry, NO content library, NO AI, NO
   network, NO Firestore read/write, NO migration. Loading this file has ZERO
   observable effect on the running app beyond registering one relation
   resolver and defining pure functions.

   ── WHY A SEPARATE STORE ──
   Every other personal module lives inside D, which is persisted as ONE
   Firestore document (users/{ownerUid}/app/state). Professional coaching
   records are (a) privacy-sensitive third-party data and (b) unbounded in
   growth. Putting them in D would repeat the proven 1 MiB failure (Wisdom) and
   would expose coachee content to anyone holding generic state.read. Therefore
   coaching data NEVER enters D. It is owner-scoped, in its own collection, with
   its own module-scoped PIL capability that is NOT granted by any default role.

   ── FAIL-CLOSED CHAIN (single chokepoint: coachingAssertWritable) ──
     feature flag ON → owner resolved → coaching capability → safety gate
   Any missing link denies. The feature flag is a UX/rollout switch, NEVER a
   security boundary — Firestore Rules remain authoritative.

   ── PHASE 2 CONTRACT ──
   The safety gate slot below is EMPTY on purpose. With no gate installed the
   chain denies, so no live coaching write path can ever bypass the Phase 2
   Ethics/Boundaries/Safeguarding layer once that layer exists.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Master feature flag. DEFAULT OFF. Not a security boundary. ── */
var COACHING = { enabled:false };

var COACHING_SCHEMA_VERSION = 1;
var COACHING_MODULE = 'coaching';
/* Same capability verbs as PIL_CAPS. 'coaching' is deliberately NOT in
   PIL_MODULES: no existing or future role preset grants it implicitly, so a
   member with state.read gains nothing here. Granting it is an explicit,
   per-member data decision. */
var COACHING_CAPS = ['read','write','delete','import','restore','backup'];

/* ── Small helpers (no dependency on load order) ── */
function _coHas(o,k){ return !!o && Object.prototype.hasOwnProperty.call(o,k); }
function _coStr(v,max){ var s=String(v==null?'':v); return max?s.slice(0,max):s; }
function _coNow(){ try{ return new Date().toISOString(); }catch(e){ return String(Date.now()); } }
function _coIsIso(s){
  if(typeof s!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return false;
  var t=Date.parse(s); return !isNaN(t);
}
function _coIsPlainObject(o){ return !!o && typeof o==='object' && !Array.isArray(o); }
function _coInt(v,dflt){ var n=Number(v); return (typeof v!=='boolean' && isFinite(n) && Math.floor(n)===n && n>=0) ? n : dflt; }

/* ── Identifier: same skeleton as newWqId/newDecisionId/newRelationId ── */
var _coSeq_c = 0;
function _coSeq(){ _coSeq_c++; return _coSeq_c; }
function newCoachingSessionId(){ return 'coa_'+Date.now().toString(36)+'-'+(_coSeq()).toString(36); }
var COACHING_ID_RE = /^coa_[0-9a-z]+-[0-9a-z]+$/;
function coachingValidId(id){ return typeof id==='string' && COACHING_ID_RE.test(id); }

/* ══════════════════════════════════════════════════════════════════════════
   1) CONTEXT REGISTRY — WHO is being coached.
   Open registry, not a frozen enum: career/leadership/employee/entrepreneur/
   parent are added later with coachingRegisterContext(), no code surgery.
   CONTEXT IS NOT METHODOLOGY — approaches live in their own registry below.
   ══════════════════════════════════════════════════════════════════════════ */
var COACHING_CONTEXTS = {};
var COACHING_KEY_RE = /^[a-z][a-z0-9_]{1,31}$/;

function coachingRegisterContext(key, def){
  if(typeof key!=='string' || !COACHING_KEY_RE.test(key)) return {ok:false,error:'INVALID_CONTEXT_KEY'};
  def = def || {};
  var minor = def.minor===true;
  COACHING_CONTEXTS[key] = {
    key:key,
    label:_coStr(def.label||key,80),
    minor:minor,
    guardianConsentRequired: def.guardianConsentRequired===true || minor,
    heightenedSafeguarding: def.heightenedSafeguarding===true || minor,
    addedIn:_coStr(def.addedIn||'phase1',24)
  };
  return {ok:true, context:COACHING_CONTEXTS[key]};
}
function coachingContext(key){ return _coHas(COACHING_CONTEXTS,key) ? COACHING_CONTEXTS[key] : null; }
function coachingContextKeys(){ return Object.keys(COACHING_CONTEXTS).sort(); }
function coachingValidContext(key){ return !!coachingContext(key); }
function coachingContextIsMinor(key){ var c=coachingContext(key); return !!(c && c.minor); }

/* Canonical five. Child/youth are minors → guardian consent + heightened
   safeguarding are structural properties, not Phase 2 opinions. */
coachingRegisterContext('self',      {label:'Kendi Koçluğum'});
coachingRegisterContext('adult',     {label:'Yetişkin'});
coachingRegisterContext('youth',     {label:'Ergen', minor:true});
coachingRegisterContext('child',     {label:'Çocuk', minor:true});
coachingRegisterContext('executive', {label:'Yönetici'});

/* ══════════════════════════════════════════════════════════════════════════
   2) APPROACH REGISTRY — HOW the coaching is done (GROW, Solution-Focused,
   MI, Socratic, Strengths, Values...). Deliberately EMPTY in Phase 1: the
   content library is Phase 4. Only the contract exists here, so that context
   and methodology can never be conflated in the schema.
   ══════════════════════════════════════════════════════════════════════════ */
var COACHING_APPROACHES = {};
function coachingRegisterApproach(key, def){
  if(typeof key!=='string' || !COACHING_KEY_RE.test(key)) return {ok:false,error:'INVALID_APPROACH_KEY'};
  if(_coHas(COACHING_CONTEXTS,key)) return {ok:false,error:'APPROACH_SHADOWS_CONTEXT'};
  def = def || {};
  COACHING_APPROACHES[key] = { key:key, label:_coStr(def.label||key,80), addedIn:_coStr(def.addedIn||'',24) };
  return {ok:true, approach:COACHING_APPROACHES[key]};
}
function coachingApproachKeys(){ return Object.keys(COACHING_APPROACHES).sort(); }
function coachingValidApproach(key){ return _coHas(COACHING_APPROACHES,key); }

/* ══════════════════════════════════════════════════════════════════════════
   3) LIFECYCLE — explicit states + explicit transition matrix.
   Hard delete is NOT part of the normal lifecycle: 'archived' is terminal and
   preserves the record (same discipline as decisionArchive).
   ══════════════════════════════════════════════════════════════════════════ */
var COACHING_LIFECYCLE = ['draft','active','completed','archived'];
var COACHING_TRANSITIONS = {
  draft:     ['active','archived'],
  active:    ['completed','archived'],
  completed: ['archived'],
  archived:  []
};
function coachingValidLifecycle(s){ return COACHING_LIFECYCLE.indexOf(s)>=0; }
function coachingIsTerminal(s){ return s==='archived'; }
function coachingCanTransition(from,to){
  if(!coachingValidLifecycle(from) || !coachingValidLifecycle(to)) return false;
  return (COACHING_TRANSITIONS[from]||[]).indexOf(to)>=0;
}

/* ══════════════════════════════════════════════════════════════════════════
   4) PRIVACY — default and, in Phase 1, the ONLY value is 'private'.
   Broader levels are an additive, deliberate future decision; they can never
   be reached by accident and are never inherited from app/state sharing.
   ══════════════════════════════════════════════════════════════════════════ */
var COACHING_PRIVACY_DEFAULT = 'private';
var COACHING_PRIVACY_LEVELS = ['private'];
function coachingValidPrivacy(p){ return COACHING_PRIVACY_LEVELS.indexOf(p)>=0; }

/* ══════════════════════════════════════════════════════════════════════════
   5) SAFETY CONTRACT TYPES — vocabulary only. Phase 2 owns the engine and the
   rule library. Nothing here diagnoses anything and nothing here claims the
   application is therapy.
   ══════════════════════════════════════════════════════════════════════════ */
var COACHING_BOUNDARY_CATEGORIES = ['scope_of_practice','clinical_risk','safeguarding',
  'confidentiality','dual_relationship','competence_limit'];
var COACHING_SAFEGUARD_SEVERITY = ['none','watch','concern','urgent'];
var COACHING_SAFEGUARD_STATE    = ['clear','flagged','escalated','referred','closed'];
var COACHING_REFERRAL_STATE     = ['none','suggested','made','declined','confirmed'];
var COACHING_SAFETY_DECISION    = ['allow','allow_with_note','pause','stop_and_refer'];

/* Empty gate slot. Phase 2 installs the real engine here. */
var COACHING_SAFETY = { gate:null, contractVersion:1 };
function coachingInstallSafetyGate(fn){
  if(typeof fn!=='function') return {ok:false,error:'INVALID_GATE'};
  COACHING_SAFETY.gate = fn;
  return {ok:true};
}
function coachingSafetyGateInstalled(){ return typeof COACHING_SAFETY.gate==='function'; }
/* Fail-closed by construction: no gate installed → denied. A gate returning an
   unknown decision shape is treated as denied, never as permission. */
function coachingSafetyCheck(session, event){
  if(!coachingSafetyGateInstalled())
    return {allowed:false, decision:'pause', reason:'safety_layer_absent'};
  var res;
  try{ res = COACHING_SAFETY.gate(session, event); }
  catch(e){ return {allowed:false, decision:'pause', reason:'safety_gate_error'}; }
  if(!_coIsPlainObject(res) || COACHING_SAFETY_DECISION.indexOf(res.decision)<0)
    return {allowed:false, decision:'pause', reason:'safety_gate_invalid_result'};
  var allowed = res.decision==='allow' || res.decision==='allow_with_note';
  return {allowed:allowed, decision:res.decision, reason:res.reason||null};
}

/* ══════════════════════════════════════════════════════════════════════════
   6) STORAGE SHAPE — session document stays SMALL and BOUNDED.
   Anything that can grow without limit (notes, message turns, transcripts,
   attachments, simulator dialogue) is a CHILD COLLECTION, declared here now so
   Phase 5/7 never needs a destructive migration. Phase 1 stores nothing.
   ══════════════════════════════════════════════════════════════════════════ */
var COACHING_ROOT = 'coachingSessions';
var COACHING_CHILD_COLLECTIONS = ['notes','interventions','reflections','observations',
  'commitments','transcript','attachments'];
/* Bounded embedded arrays — hard caps enforced by normalization. */
var COACHING_EMBEDDED_LIMITS = { competencyTags:12, approachTags:6, tags:20, tagLen:48, title:140, subjectRef:64 };
var COACHING_PAGE_MAX = 100;   // no unbounded collection reads, ever

function coachingRootPath(ownerUid){
  if(!ownerUid) return null;
  return 'users/'+ownerUid+'/'+COACHING_ROOT;
}
function coachingSessionPath(ownerUid, sessionId){
  if(!ownerUid || !coachingValidId(sessionId)) return null;
  return coachingRootPath(ownerUid)+'/'+sessionId;
}
function coachingChildPath(ownerUid, sessionId, kind){
  if(COACHING_CHILD_COLLECTIONS.indexOf(kind)<0) return null;
  var p = coachingSessionPath(ownerUid, sessionId);
  return p ? (p+'/'+kind) : null;
}
/* Firestore handle. Fail-closed: null when the db is absent or the canonical
   owner cannot be resolved. Phase 1 never calls .get()/.set() on it. */
function coachingSessionsCol(ownerUid){
  if(typeof CLOUD==='undefined' || !CLOUD.db) return null;
  var u = ownerUid || coachingResolveOwner();
  if(!u) return null;
  return CLOUD.db.collection('users').doc(u).collection(COACHING_ROOT);
}
/* Runtime-only cache. Never persisted, never populated in Phase 1. */
var COACHING_STORE = new Map();
function coachingStoreList(){ return Array.from(COACHING_STORE.values()); }
function coachingStoreById(id){ return COACHING_STORE.get(String(id)) || null; }
function coachingStoreCount(){ return COACHING_STORE.size; }

/* ══════════════════════════════════════════════════════════════════════════
   7) OWNERSHIP + AUTHORIZATION — consumes PIL, never re-implements it.
   ══════════════════════════════════════════════════════════════════════════ */
/* Canonical owner uid, or null. NEVER falls back to the login uid when sharing
   is on and resolution failed — that is exactly the spoofing hole we refuse. */
function coachingResolveOwner(){
  if(typeof personalContext!=='function') return null;
  var ctx;
  try{ ctx = personalContext(); }catch(e){ return null; }
  if(!ctx || ctx.denied) return null;
  var owner = ctx.ownerUid;
  if(!owner) return null;
  var sharing = (typeof IDENTITY!=='undefined' && IDENTITY.sharingEnabled===true);
  /* impossible-state guard: a member whose resolved owner equals its own login
     is not a member — refuse rather than guess. */
  if(sharing && ctx.isMember===true && owner===ctx.loginUid) return null;
  return owner;
}
/* Module-scoped capability. 'coaching' is absent from every default role
   preset, so a member is denied unless it was explicitly granted. */
function coachingCan(cap){
  if(COACHING_CAPS.indexOf(cap)<0) return false;
  if(!coachingResolveOwner()) return false;
  if(typeof personalCan!=='function') return false;
  return personalCan(COACHING_MODULE, cap)===true;
}
function coachingEnabled(){ return COACHING.enabled===true; }

/* THE single write chokepoint. Every future coaching write must pass here. */
function coachingAssertWritable(cap, session, event){
  if(!coachingEnabled())      return {allowed:false, reason:'feature_disabled'};
  var owner = coachingResolveOwner();
  if(!owner)                  return {allowed:false, reason:'owner_unresolved'};
  if(!coachingCan(cap))       return {allowed:false, reason:'not_authorized'};
  var safe = coachingSafetyCheck(session||null, event||{type:cap});
  if(!safe.allowed)           return {allowed:false, reason:safe.reason||'safety_denied', decision:safe.decision};
  return {allowed:true, ownerUid:owner, cap:cap, decision:safe.decision};
}
/* Read chokepoint — same chain minus the safety decision (reading an existing
   record never creates coaching contact). */
function coachingAssertReadable(){
  var owner = coachingResolveOwner();
  if(!owner)                  return {allowed:false, reason:'owner_unresolved'};
  if(!coachingCan('read'))    return {allowed:false, reason:'not_authorized'};
  return {allowed:true, ownerUid:owner};
}

/* ══════════════════════════════════════════════════════════════════════════
   8) CANONICAL SESSION — pure normalization + validation. NOTHING PERSISTS.
   coachingBuildSession() is a builder, not a writer: Phase 5 adds the persist
   path behind coachingAssertWritable().
   ══════════════════════════════════════════════════════════════════════════ */
function _coTagList(v, max){
  if(!Array.isArray(v)) return [];
  var out=[], seen={};
  for(var i=0;i<v.length && out.length<max;i++){
    var t=_coStr(v[i],COACHING_EMBEDDED_LIMITS.tagLen).trim();
    if(!t || seen[t]) continue;
    seen[t]=1; out.push(t);
  }
  return out;
}
function _coSafeguard(s){
  s = _coIsPlainObject(s) ? s : {};
  return {
    state:    COACHING_SAFEGUARD_STATE.indexOf(s.state)>=0 ? s.state : 'clear',
    severity: COACHING_SAFEGUARD_SEVERITY.indexOf(s.severity)>=0 ? s.severity : 'none',
    referral: COACHING_REFERRAL_STATE.indexOf(s.referral)>=0 ? s.referral : 'none',
    reviewedAt: _coIsIso(s.reviewedAt) ? s.reviewedAt : null,
    reviewedBy: s.reviewedBy!=null ? _coStr(s.reviewedBy,128) : null
  };
}
function _coCounters(c){
  c = _coIsPlainObject(c) ? c : {};
  var out={};
  COACHING_CHILD_COLLECTIONS.forEach(function(k){ out[k]=_coInt(c[k],0); });
  return out;
}
function _coReview(r){
  r = _coIsPlainObject(r) ? r : {};
  return {
    completedAt: _coIsIso(r.completedAt) ? r.completedAt : null,
    selfRating:  (typeof r.selfRating==='number' && r.selfRating>=1 && r.selfRating<=5) ? r.selfRating : null,
    mirrorRef:   r.mirrorRef!=null ? _coStr(r.mirrorRef,64) : null
  };
}
/* Deterministic: same input → same output (except the caller-supplied id/time). */
function coachingNormalizeSession(input, opts){
  input = _coIsPlainObject(input) ? input : {};
  opts  = opts || {};
  var now = opts.now || _coNow();
  var actor = opts.actor!=null ? _coStr(opts.actor,128) : (input.createdBy!=null ? _coStr(input.createdBy,128) : null);
  var createdAt = _coIsIso(input.createdAt) ? input.createdAt : now;
  return {
    id: coachingValidId(input.id) ? input.id : (opts.id || newCoachingSessionId()),
    schemaVersion: COACHING_SCHEMA_VERSION,
    ownerUid: input.ownerUid!=null ? _coStr(input.ownerUid,128) : (opts.ownerUid || null),
    createdAt: createdAt,
    createdBy: input.createdBy!=null ? _coStr(input.createdBy,128) : actor,
    updatedAt: _coIsIso(input.updatedAt) ? input.updatedAt : createdAt,
    updatedBy: input.updatedBy!=null ? _coStr(input.updatedBy,128) : actor,
    context: coachingValidContext(input.context) ? input.context : 'self',
    approach: coachingValidApproach(input.approach) ? input.approach : null,
    approachTags: _coTagList(input.approachTags, COACHING_EMBEDDED_LIMITS.approachTags),
    competencyTags: _coTagList(input.competencyTags, COACHING_EMBEDDED_LIMITS.competencyTags),
    tags: _coTagList(input.tags, COACHING_EMBEDDED_LIMITS.tags),
    lifecycle: coachingValidLifecycle(input.lifecycle) ? input.lifecycle : 'draft',
    privacy: coachingValidPrivacy(input.privacy) ? input.privacy : COACHING_PRIVACY_DEFAULT,
    /* Non-sensitive short label. Coachee identity belongs in subjectRef, which
       is a pseudonymous reference — never an email address. */
    title: _coStr(input.title, COACHING_EMBEDDED_LIMITS.title).trim(),
    subjectRef: _coStr(input.subjectRef, COACHING_EMBEDDED_LIMITS.subjectRef).trim(),
    safeguard: _coSafeguard(input.safeguard),
    counters: _coCounters(input.counters),
    review: _coReview(input.review)
  };
}
/* Structural validation. Content quality is NOT judged here. */
function coachingValidateSession(rec){
  var errors = [];
  if(!_coIsPlainObject(rec)) return {ok:false, errors:['NOT_AN_OBJECT']};
  if(!coachingValidId(rec.id)) errors.push('INVALID_ID');
  if(!coachingAcceptSchemaVersion(rec.schemaVersion)) errors.push('INVALID_SCHEMA_VERSION');
  if(!_coIsIso(rec.createdAt)) errors.push('INVALID_CREATED_AT');
  if(!_coIsIso(rec.updatedAt)) errors.push('INVALID_UPDATED_AT');
  if(_coIsIso(rec.createdAt) && _coIsIso(rec.updatedAt) && Date.parse(rec.updatedAt) < Date.parse(rec.createdAt))
    errors.push('UPDATED_BEFORE_CREATED');
  if(!coachingValidContext(rec.context)) errors.push('INVALID_CONTEXT');
  if(rec.approach!=null && !coachingValidApproach(rec.approach)) errors.push('INVALID_APPROACH');
  if(!coachingValidLifecycle(rec.lifecycle)) errors.push('INVALID_LIFECYCLE');
  if(!coachingValidPrivacy(rec.privacy)) errors.push('INVALID_PRIVACY');
  if(typeof rec.subjectRef==='string' && rec.subjectRef.indexOf('@')>=0) errors.push('SUBJECT_REF_LOOKS_LIKE_EMAIL');
  if(typeof rec.title==='string' && rec.title.length>COACHING_EMBEDDED_LIMITS.title) errors.push('TITLE_TOO_LONG');
  /* Unbounded content must NEVER be embedded in the session document. */
  for(var i=0;i<COACHING_CHILD_COLLECTIONS.length;i++){
    var k = COACHING_CHILD_COLLECTIONS[i];
    if(_coHas(rec,k)){ errors.push('EMBEDDED_CHILD_COLLECTION:'+k); }
  }
  return {ok:errors.length===0, errors:errors};
}
/* Forward-incompatible documents are refused, not silently downgraded. */
function coachingAcceptSchemaVersion(v){
  return typeof v==='number' && isFinite(v) && Math.floor(v)===v && v>=1 && v<=COACHING_SCHEMA_VERSION;
}
/* Pure builder — returns {ok,session} or {ok:false,errors}. Persists NOTHING. */
function coachingBuildSession(input, opts){
  var rec = coachingNormalizeSession(input, opts);
  var v = coachingValidateSession(rec);
  if(!v.ok) return {ok:false, errors:v.errors};
  return {ok:true, session:rec};
}
/* Lifecycle move — pure; caller persists later through the write chokepoint. */
function coachingApplyTransition(rec, to, opts){
  if(!_coIsPlainObject(rec)) return {ok:false,error:'NOT_AN_OBJECT'};
  if(!coachingCanTransition(rec.lifecycle, to)) return {ok:false,error:'INVALID_TRANSITION'};
  opts = opts || {};
  var next = JSON.parse(JSON.stringify(rec));
  next.lifecycle = to;
  next.updatedAt = opts.now || _coNow();
  if(opts.actor!=null) next.updatedBy = _coStr(opts.actor,128);
  return {ok:true, session:next};
}

/* ══════════════════════════════════════════════════════════════════════════
   9) LEGACY D.coaching — READ-ONLY ARCHIVE ADAPTER.
   No migration, no rename, no normalization, no dual-write. The legacy array
   is never mutated and never becomes a source for the new store.
   ══════════════════════════════════════════════════════════════════════════ */
function coachingLegacyRaw(){
  return (typeof D!=='undefined' && Array.isArray(D.coaching)) ? D.coaching : [];
}
/* Returns deep COPIES so a caller can never reach back into D.coaching. */
function coachingLegacyArchive(){
  return coachingLegacyRaw().map(function(x){
    x = _coIsPlainObject(x) ? x : {};
    return { id:(x.id!=null?x.id:null), title:_coStr(x.title,COACHING_EMBEDDED_LIMITS.title),
             category:_coStr(x.cat,80), text:_coStr(x.text),
             source:'legacy', readOnly:true, schemaVersion:0 };
  });
}
function coachingLegacyCount(){ return coachingLegacyRaw().length; }
function coachingLegacyById(id){
  var l = coachingLegacyArchive();
  for(var i=0;i<l.length;i++){ if(String(l[i].id)===String(id)) return l[i]; }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   10) RELATIONS — reuse the canonical registry (11h). No second system.
   A relation record lives in D.relations and therefore must carry IDs ONLY:
   never a coachee name, never session content. The resolver label is derived
   from non-sensitive metadata (context + date) for the same reason.
   ══════════════════════════════════════════════════════════════════════════ */
var COACHING_RELATION_TYPE = 'coachingSession';
var COACHING_RELATION_TARGETS = ['goal','principle','decision','wisdomQuote'];

function coachingRelationLabel(rec){
  if(!_coIsPlainObject(rec)) return '';
  var c = coachingContext(rec.context);
  var day = _coIsIso(rec.createdAt) ? rec.createdAt.slice(0,10) : '';
  return ('Koçluk Oturumu' + (c?(' · '+c.label):'') + (day?(' · '+day):'')).trim();
}
/* Validates a relation BEFORE it is handed to relAdd(). Phase 1 adds no
   relation itself; it only guarantees invalid ones cannot be constructed. */
function coachingValidateRelation(input){
  input = _coIsPlainObject(input) ? input : {};
  if(input.sourceType!==COACHING_RELATION_TYPE) return {ok:false,error:'INVALID_SOURCE_TYPE'};
  if(!coachingValidId(input.sourceId)) return {ok:false,error:'INVALID_SOURCE_ID'};
  if(COACHING_RELATION_TARGETS.indexOf(input.targetType)<0) return {ok:false,error:'INVALID_TARGET_TYPE'};
  if(input.targetId==null || String(input.targetId)==='') return {ok:false,error:'MISSING_TARGET_ID'};
  if(typeof relValidateType==='function' && input.relationType!=null && !relValidateType(input.relationType))
    return {ok:false,error:'INVALID_RELATION_TYPE'};
  /* content must never travel into D.relations through the note field */
  if(input.note!=null && _coStr(input.note).length>280) return {ok:false,error:'NOTE_TOO_LONG'};
  return {ok:true, relation:{ sourceType:COACHING_RELATION_TYPE, sourceId:input.sourceId,
    targetType:String(input.targetType), targetId:String(input.targetId),
    relationType:input.relationType||'related_to',
    confidence:input.confidence||'medium', note:input.note!=null?_coStr(input.note,280):'' }};
}

/* ══════════════════════════════════════════════════════════════════════════
   11) BACKUP / RESTORE — EXPLICIT PHASE 1 DECISION: NOT INCLUDED.
   DIFF_SCHEMA describes fields of D only; coaching data is not in D, so
   registering it there would be a false claim. Copying sessions back into D to
   satisfy backup would recreate both the 1 MiB and the privacy problem, and
   the local JSON export (U.dl(D,...)) is unencrypted. Therefore coaching data
   participates in NO existing backup path, and 04-backup.js is untouched.
   The provider below is the interface a later phase implements once the
   consent + scoped-export design exists.
   ══════════════════════════════════════════════════════════════════════════ */
var COACHING_BACKUP_POLICY = {
  interfaceVersion:1,
  includedInStateBackup:false,
  includedInLocalJsonExport:false,
  registeredInDiffSchema:false,
  reason:'phase1_privacy_hold',
  requiredBeforeInclusion:['explicit_user_consent','scoped_or_encrypted_export','phase2_safeguard_classification']
};
function coachingBackupProvider(){
  return { included:false, count:0, records:[], policy:COACHING_BACKUP_POLICY };
}

/* ══════════════════════════════════════════════════════════════════════════
   12) SELF-CHECK — machine-readable invariants (used by tests and by a later
   admin diagnostics view). Pure; performs no I/O.
   ══════════════════════════════════════════════════════════════════════════ */
function coachingSelfCheck(){
  return {
    schemaVersion: COACHING_SCHEMA_VERSION,
    featureEnabled: coachingEnabled(),
    safetyGateInstalled: coachingSafetyGateInstalled(),
    writable: coachingAssertWritable('write').allowed,
    privacyDefault: COACHING_PRIVACY_DEFAULT,
    privacyLevels: COACHING_PRIVACY_LEVELS.slice(),
    contexts: coachingContextKeys(),
    approaches: coachingApproachKeys(),
    lifecycle: COACHING_LIFECYCLE.slice(),
    childCollections: COACHING_CHILD_COLLECTIONS.slice(),
    pageMax: COACHING_PAGE_MAX,
    storeCount: coachingStoreCount(),
    legacyCount: coachingLegacyCount(),
    inPayload: (typeof INIT!=='undefined') && Object.keys(INIT).some(function(k){ return k==='coachingSessions'; }),
    backup: COACHING_BACKUP_POLICY
  };
}

/* ── Canonical relation resolver registration (same pattern as 11i) ──
   The only side effect of loading this file. Until the store is populated the
   resolver returns null, and getRelatedEntities() already skips dangling
   relations defensively. */
if(typeof registerRelationResolver==='function'){
  registerRelationResolver(COACHING_RELATION_TYPE,{
    byId:function(id){ return coachingStoreById(id); },
    label:function(rec){ return coachingRelationLabel(rec); }
  });
}

if(typeof window!=='undefined'){
  window.COACHING=COACHING; window.COACHING_SCHEMA_VERSION=COACHING_SCHEMA_VERSION;
  window.COACHING_MODULE=COACHING_MODULE; window.COACHING_CAPS=COACHING_CAPS;
  window.COACHING_CONTEXTS=COACHING_CONTEXTS; window.COACHING_APPROACHES=COACHING_APPROACHES;
  window.COACHING_LIFECYCLE=COACHING_LIFECYCLE; window.COACHING_TRANSITIONS=COACHING_TRANSITIONS;
  window.COACHING_PRIVACY_DEFAULT=COACHING_PRIVACY_DEFAULT; window.COACHING_PRIVACY_LEVELS=COACHING_PRIVACY_LEVELS;
  window.COACHING_BOUNDARY_CATEGORIES=COACHING_BOUNDARY_CATEGORIES;
  window.COACHING_SAFEGUARD_SEVERITY=COACHING_SAFEGUARD_SEVERITY;
  window.COACHING_SAFEGUARD_STATE=COACHING_SAFEGUARD_STATE;
  window.COACHING_REFERRAL_STATE=COACHING_REFERRAL_STATE;
  window.COACHING_SAFETY_DECISION=COACHING_SAFETY_DECISION; window.COACHING_SAFETY=COACHING_SAFETY;
  window.COACHING_ROOT=COACHING_ROOT; window.COACHING_CHILD_COLLECTIONS=COACHING_CHILD_COLLECTIONS;
  window.COACHING_EMBEDDED_LIMITS=COACHING_EMBEDDED_LIMITS; window.COACHING_PAGE_MAX=COACHING_PAGE_MAX;
  window.COACHING_STORE=COACHING_STORE;
  window.COACHING_RELATION_TYPE=COACHING_RELATION_TYPE; window.COACHING_RELATION_TARGETS=COACHING_RELATION_TARGETS;
  window.COACHING_BACKUP_POLICY=COACHING_BACKUP_POLICY;
  window.newCoachingSessionId=newCoachingSessionId; window.coachingValidId=coachingValidId;
  window.coachingRegisterContext=coachingRegisterContext; window.coachingContext=coachingContext;
  window.coachingContextKeys=coachingContextKeys; window.coachingValidContext=coachingValidContext;
  window.coachingContextIsMinor=coachingContextIsMinor;
  window.coachingRegisterApproach=coachingRegisterApproach; window.coachingApproachKeys=coachingApproachKeys;
  window.coachingValidApproach=coachingValidApproach;
  window.coachingValidLifecycle=coachingValidLifecycle; window.coachingIsTerminal=coachingIsTerminal;
  window.coachingCanTransition=coachingCanTransition; window.coachingApplyTransition=coachingApplyTransition;
  window.coachingValidPrivacy=coachingValidPrivacy;
  window.coachingInstallSafetyGate=coachingInstallSafetyGate;
  window.coachingSafetyGateInstalled=coachingSafetyGateInstalled; window.coachingSafetyCheck=coachingSafetyCheck;
  window.coachingRootPath=coachingRootPath; window.coachingSessionPath=coachingSessionPath;
  window.coachingChildPath=coachingChildPath; window.coachingSessionsCol=coachingSessionsCol;
  window.coachingStoreList=coachingStoreList; window.coachingStoreById=coachingStoreById;
  window.coachingStoreCount=coachingStoreCount;
  window.coachingResolveOwner=coachingResolveOwner; window.coachingCan=coachingCan;
  window.coachingEnabled=coachingEnabled;
  window.coachingAssertWritable=coachingAssertWritable; window.coachingAssertReadable=coachingAssertReadable;
  window.coachingNormalizeSession=coachingNormalizeSession; window.coachingValidateSession=coachingValidateSession;
  window.coachingAcceptSchemaVersion=coachingAcceptSchemaVersion; window.coachingBuildSession=coachingBuildSession;
  window.coachingLegacyRaw=coachingLegacyRaw; window.coachingLegacyArchive=coachingLegacyArchive;
  window.coachingLegacyCount=coachingLegacyCount; window.coachingLegacyById=coachingLegacyById;
  window.coachingRelationLabel=coachingRelationLabel; window.coachingValidateRelation=coachingValidateRelation;
  window.coachingBackupProvider=coachingBackupProvider; window.coachingSelfCheck=coachingSelfCheck;
}
