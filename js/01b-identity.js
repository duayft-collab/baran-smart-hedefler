/* ══════════════════════════════════════════════════════════════════════════
   PERSONAL IDENTITY LAYER (PIL) — V3 (hardened)
   Single source of truth for DATA OWNERSHIP + module-scoped AUTHORIZATION for
   every personal module (wisdom, goals, principles, notes, decisions, relations,
   archive/backup … and any future module). No module implements its own
   ownership or role logic — they all consume the functions below.

   ── REQUIREMENT: master feature flag (IDENTITY.sharingEnabled) ──
   DEFAULT-OFF. With sharingEnabled=false the app is BYTE-IDENTICAL to pre-PIL:
     • personalOwnerUid() === CLOUD.uid   (no resolution, no registry lookup)
     • every capability granted            (self owns own data)
     • NO shared paths, NO async work
     • flipping the flag back to false = INSTANT rollback, ZERO data migration

   ── REQUIREMENT: dynamic, data-driven ownership registry ──
   ownershipMap/{loginUid} = { ownerUid, organizationId, role, permissions,
   status, createdAt, createdBy, updatedAt, updatedBy, deletedAt?, deletedBy?,
   lastLoginAt?, lastOwnerResolutionAt? }. Adding/removing an authorized login is
   a DATA change only — never a code or Firestore-Rules edit, never a hardcoded UID.

   ── REQUIREMENT: fail-closed ownership ──
   When sharing is ON and resolution cannot be completed (missing registry,
   disabled member, inactive owner, corrupted permissions, no owner) the context
   is DENIED — access is refused. The layer NEVER silently falls back to another
   owner and NEVER guesses. (Flag OFF is unaffected: it is legacy self-ownership.)

   ── REQUIREMENT: organization-ready resolution chain ──
     login → personalContext() → [organization] → owner → storage
   The organization step is a pass-through today (_pilResolveOwner). Adding a real
   org registry later is ADDITIVE — no caller changes, no redesign.

   ── REQUIREMENT: module-scoped permissions ──
   Authorization is always permissions[module][capability]; the engine never
   hardcodes a module list, so a NEW module is a data change, not a code change.
   ══════════════════════════════════════════════════════════════════════════ */

/* Master switch. false = legacy single-user behavior (see header). */
var IDENTITY = { sharingEnabled:false };

/* Per-module capability verbs + the modules known today (defaults for enrollment;
   NOT a closed set — the engine reads flags generically). */
var PIL_CAPS = ['read','write','delete','import','restore','backup'];
var PIL_MODULES = ['wisdom','goals','principles','notes','decisions','relations','state','archive'];

/* Role → capability preset. Roles are human LABELS only; every authorization
   decision is made on the resolved capability flags, NEVER on the role string.
   A new role = a new preset entry — engine and Rules unchanged. */
var PIL_ROLE_PRESETS = {
  owner:   {read:true,  write:true,  delete:true,  import:true,  restore:true,  backup:true},
  manager: {read:true,  write:true,  delete:true,  import:true,  restore:true,  backup:true},
  editor:  {read:true,  write:true,  delete:true,  import:true,  restore:false, backup:false},
  viewer:  {read:true,  write:false, delete:false, import:false, restore:false, backup:false}
};

/* Build a module-scoped permissions object from a role preset (used by enrollment).
   Role→capability mapping lives ONLY here; the registry stores the explicit object
   so Rules/engine never key off the role name. */
function pilPermissionsFromRole(role, modules){
  var preset = PIL_ROLE_PRESETS[role] || PIL_ROLE_PRESETS.viewer;
  var out = {};
  (modules||PIL_MODULES).forEach(function(m){ out[m] = Object.assign({}, preset); });
  return out;
}

function _pilLoginUid(){ return (typeof CLOUD!=='undefined' && CLOUD.uid) ? CLOUD.uid : null; }
function _pilLoginEmail(){ return (typeof CLOUD!=='undefined' && CLOUD.user && CLOUD.user.email) ? CLOUD.user.email : null; }

/* Self-context: the login owns its own data with full rights. Produced ONLY when
   sharing is OFF — identical to pre-PIL behavior. */
function _pilSelfContext(loginUid, loginEmail){
  return { loginUid:loginUid, loginEmail:loginEmail,
           ownerUid:loginUid, ownerEmail:loginEmail,
           organizationId:null, role:'owner', permissions:null /* null sentinel = all granted */,
           status:'active', isOwner:true, isMember:false, denied:false, deniedReason:null };
}

/* Denied context: fail-closed. No owner, no rights, access refused. */
function _pilDenied(loginUid, loginEmail, reason){
  return { loginUid:loginUid, loginEmail:loginEmail,
           ownerUid:null, ownerEmail:null,
           organizationId:null, role:null, permissions:{},
           status:'denied', isOwner:false, isMember:false, denied:true, deniedReason:reason||'denied' };
}

/* A member permissions object must be a non-empty map of module→{cap:bool}. Any
   other shape (null, array, primitive, empty, module→non-object) is CORRUPT →
   fail-closed. */
function _pilValidPermissions(p){
  if(!p || typeof p!=='object' || Array.isArray(p)) return false;
  var keys = Object.keys(p); if(keys.length===0) return false;
  for(var i=0;i<keys.length;i++){ var m=p[keys[i]]; if(!m || typeof m!=='object' || Array.isArray(m)) return false; }
  return true;
}

/* Resolution-chain owner step: login-entry → [org] → owner. Today the org step is
   a pass-through (entry.ownerUid is authoritative). When an org layer is added this
   is the single place an organizationId→ownerUid lookup slots in — no caller changes. */
function _pilResolveOwner(entry){
  if(!entry) return null;
  // future org step: if(entry.organizationId && !entry.ownerUid) return pilOrgOwner(entry.organizationId);
  return entry.ownerUid || null;
}

/* THE identity object every module consumes. Synchronous: derives from the entry
   cached on CLOUD.personalEntry (fetched at auth by pilResolveOnAuth) and the
   owner-active flag CLOUD.personalOwnerActive. FAIL-CLOSED when sharing is on. */
function personalContext(){
  var loginUid = _pilLoginUid(), loginEmail = _pilLoginEmail();
  // Flag OFF → pure legacy self-context. No registry, no org, no shared path.
  if(!IDENTITY.sharingEnabled) return _pilSelfContext(loginUid, loginEmail);
  var entry = (typeof CLOUD!=='undefined' && CLOUD.personalEntry) ? CLOUD.personalEntry : null;
  if(!entry) return _pilDenied(loginUid, loginEmail, 'not_enrolled');
  if(entry.status!=='active') return _pilDenied(loginUid, loginEmail, 'member_'+(entry.status||'inactive'));
  var ownerUid = _pilResolveOwner(entry);
  if(!ownerUid) return _pilDenied(loginUid, loginEmail, 'no_owner');
  var isOwner = ownerUid===loginUid;
  if(!isOwner){
    if(!_pilValidPermissions(entry.permissions)) return _pilDenied(loginUid, loginEmail, 'corrupt_permissions');
    if(typeof CLOUD!=='undefined' && CLOUD.personalOwnerActive===false) return _pilDenied(loginUid, loginEmail, 'owner_inactive');
  }
  return {
    loginUid:loginUid, loginEmail:loginEmail,
    ownerUid:ownerUid, ownerEmail:entry.ownerEmail || (isOwner?loginEmail:null),
    organizationId:entry.organizationId||null,
    role:entry.role || (isOwner?'owner':'viewer'),
    permissions:isOwner ? null : entry.permissions,   // owner: null = all granted
    status:'active', isOwner:isOwner, isMember:!isOwner, denied:false, deniedReason:null
  };
}

/* Canonical owner uid for ALL data paths. Flag OFF → CLOUD.uid (identical). When
   sharing is on and resolution is denied → null (fail-closed; never the login,
   never a guessed owner). */
function personalOwnerUid(){
  var ctx = personalContext();
  if(ctx && ctx.denied) return null;
  return (ctx && ctx.ownerUid) || _pilLoginUid();
}

/* Module-scoped authorization. Denied → false. Owner/self → true. Member →
   permissions[module][capability] must be EXACTLY true. Unknown → false. */
function personalCan(module, cap){
  var ctx = personalContext();
  if(!ctx || ctx.denied) return false;
  if(ctx.isOwner || ctx.permissions==null) return true;
  var m = ctx.permissions[module];
  return !!(m && m[cap]===true);
}

/* Audit stamp for a SHARED write (created/updated/deleted × By/At). null when
   sharing is off (no extra fields → byte-identical), when denied, or when the
   writer is the owner on its own data (no cross-identity attribution). */
function personalWriteMeta(kind){
  if(!IDENTITY.sharingEnabled) return null;
  var ctx = personalContext();
  if(!ctx || ctx.denied || ctx.isOwner) return null;
  var by = ctx.loginUid, email = ctx.loginEmail, at = Date.now();
  var meta = { updatedBy:by, updatedByEmail:email, updatedAt:at };
  if(kind==='create'){ meta.createdBy=by; meta.createdByEmail=email; meta.createdAt=at; }
  if(kind==='delete'){ meta.deletedBy=by; meta.deletedByEmail=email; meta.deletedAt=at; }
  return meta;
}

/* Best-effort audit: stamp lastLoginAt + lastOwnerResolutionAt on the caller's OWN
   registry doc. Field-scoped so Rules permit a member to write only these two keys
   (never ownerUid/role/permissions/status). Non-blocking; failure is ignored. */
function pilStampResolution(loginUid){
  if(typeof CLOUD==='undefined' || !CLOUD.db || !loginUid) return;
  var now = Date.now();
  try{
    var p = CLOUD.db.collection('ownershipMap').doc(loginUid).update({lastLoginAt:now, lastOwnerResolutionAt:now});
    if(p && typeof p.catch==='function') p.catch(function(){});
  }catch(e){}
}

/* Resolve + cache the registry entry at auth. Flag OFF → NO fetch, entry=null
   (legacy). Flag ON → read ownershipMap/{loginUid}; for a member also read the
   OWNER's entry to verify it is active (fail-closed on inactive owner). Sets
   CLOUD.personalEntry, CLOUD.personalOwnerActive, CLOUD.personalResolveReason. */
async function pilResolveOnAuth(user){
  if(typeof CLOUD==='undefined') return null;
  CLOUD.personalEntry = null; CLOUD.personalOwnerActive = null; CLOUD.personalResolveReason = null;
  if(!IDENTITY.sharingEnabled) return null;              // no registry lookup when disabled
  if(!user || !user.uid || !CLOUD.db){ CLOUD.personalResolveReason='no_db'; return null; }
  var entry = null;
  try{
    var s = await CLOUD.db.collection('ownershipMap').doc(user.uid).get();
    entry = (s && s.exists) ? (s.data()||null) : null;
  }catch(e){ CLOUD.personalResolveReason='read_error'; return null; } // fail-closed (context → not_enrolled/denied)
  if(!entry){ CLOUD.personalResolveReason='not_enrolled'; return null; }
  var ownerUid = _pilResolveOwner(entry);
  if(ownerUid && ownerUid!==user.uid){
    try{
      var os = await CLOUD.db.collection('ownershipMap').doc(ownerUid).get();
      var oe = (os && os.exists) ? (os.data()||null) : null;
      CLOUD.personalOwnerActive = !!(oe && oe.status==='active');
    }catch(e){ CLOUD.personalOwnerActive = false; }      // fail-closed on owner read failure
  }else{
    CLOUD.personalOwnerActive = true;                     // self-owner
  }
  CLOUD.personalEntry = entry;
  CLOUD.personalResolveReason = 'resolved';
  pilStampResolution(user.uid);                           // audit: lastLoginAt / lastOwnerResolutionAt
  return entry;
}

/* ── Production enrollment (REQUIREMENT: no code/rules/UID edits) ──────────────
   Pure builder → the full ownershipMap doc with complete audit metadata. The
   acting admin (CLOUD.uid) is recorded as createdBy/updatedBy. Rules gate the
   actual write to an admin custom claim, so a member can never self-enroll. */
function pilBuildEnrollment(opts){
  opts = opts || {};
  var now = Date.now();
  var actor = (typeof CLOUD!=='undefined' && CLOUD.uid) || opts.actorUid || null;
  var role = opts.role || 'viewer';
  var isOwner = role==='owner' || (opts.ownerUid && opts.loginUid && opts.ownerUid===opts.loginUid);
  return {
    ownerUid: opts.ownerUid || null,
    organizationId: opts.organizationId || null,
    role: role,
    permissions: opts.permissions || (isOwner ? null : pilPermissionsFromRole(role, opts.modules)),
    status: opts.status || 'active',
    createdAt: now, createdBy: actor,
    updatedAt: now, updatedBy: actor
  };
}

/* Enroll (or re-enroll) a login as a member of an owner. Data-only; admin-gated. */
async function pilEnroll(loginUid, opts){
  if(typeof CLOUD==='undefined' || !CLOUD.db) return {ok:false, reason:'no_db'};
  if(!loginUid) return {ok:false, reason:'no_login'};
  var doc = pilBuildEnrollment(Object.assign({loginUid:loginUid}, opts||{}));
  if(!doc.ownerUid) return {ok:false, reason:'no_owner'};
  try{ await CLOUD.db.collection('ownershipMap').doc(loginUid).set(doc); return {ok:true, loginUid:loginUid, entry:doc}; }
  catch(e){ return {ok:false, reason:'write_failed', error:String((e&&e.message)||e)}; }
}

/* Bootstrap the canonical owner as its own active owner entry (self-mapping). This
   is the one-time step that must exist before the flag is turned on, else even the
   owner fails closed. */
async function pilEnrollOwner(loginUid, opts){
  var uid = loginUid || _pilLoginUid();
  if(!uid) return {ok:false, reason:'no_login'};
  return pilEnroll(uid, Object.assign({ownerUid:uid, role:'owner', status:'active', permissions:null}, opts||{}));
}

/* Update an existing enrollment (role/permissions/org/status), stamping updatedBy/At. */
async function pilUpdateEnrollment(loginUid, patch){
  if(typeof CLOUD==='undefined' || !CLOUD.db) return {ok:false, reason:'no_db'};
  if(!loginUid) return {ok:false, reason:'no_login'};
  var now = Date.now(), actor = _pilLoginUid();
  var upd = Object.assign({}, patch||{}, {updatedAt:now, updatedBy:actor});
  try{ await CLOUD.db.collection('ownershipMap').doc(loginUid).update(upd); return {ok:true, loginUid:loginUid, patch:upd}; }
  catch(e){ return {ok:false, reason:'write_failed', error:String((e&&e.message)||e)}; }
}

/* Revoke a login IMMEDIATELY: status='revoked' + deletedBy/deletedAt (soft, so the
   audit trail is preserved). Both the client (personalContext → denied) and Rules
   (status!='active') refuse access on the next request. */
async function pilRevoke(loginUid){
  if(typeof CLOUD==='undefined' || !CLOUD.db) return {ok:false, reason:'no_db'};
  if(!loginUid) return {ok:false, reason:'no_login'};
  var now = Date.now(), actor = _pilLoginUid();
  try{
    await CLOUD.db.collection('ownershipMap').doc(loginUid).update(
      {status:'revoked', deletedBy:actor, deletedAt:now, updatedBy:actor, updatedAt:now});
    return {ok:true, loginUid:loginUid};
  }catch(e){ return {ok:false, reason:'write_failed', error:String((e&&e.message)||e)}; }
}

/* Capture the CURRENT authenticated login's identity. This is the ONLY sanctioned
   source of a member uid: the second login signs in, this returns its real Firebase
   uid, and the owner uses that uid to enroll. The uid is NEVER derived from an email. */
function pilCaptureLoginIdentity(){
  if(typeof CLOUD==='undefined' || !CLOUD.user || !CLOUD.uid) return {ok:false, reason:'not_authenticated'};
  return {ok:true, uid:CLOUD.uid, email:(CLOUD.user.email||null), isAnonymous:!!CLOUD.user.isAnonymous, capturedAt:Date.now()};
}

/* Enroll a second login as a MEMBER of the canonical owner. Fail-closed and
   admin/owner-gated (Firestore Rules enforce the admin claim; this adds the
   orchestration + validation): the member uid must be a real uid (not an email),
   the canonical owner must already have an ACTIVE self-entry, the member cannot be
   the owner, the role must be known, and an existing entry is never silently
   overwritten (allowReenroll required). Writes data only — it does NOT flip the
   feature flag or change any runtime path. */
async function pilEnrollMember(memberUid, opts){
  opts = opts || {};
  if(typeof CLOUD==='undefined' || !CLOUD.db) return {ok:false, reason:'no_db'};
  if(!memberUid || typeof memberUid!=='string') return {ok:false, reason:'invalid_member_uid'};
  if(memberUid.indexOf('@')>=0) return {ok:false, reason:'uid_looks_like_email'};  // never derive a uid from an email
  var ownerUid = opts.ownerUid || _pilLoginUid();
  if(!ownerUid) return {ok:false, reason:'no_owner'};
  if(memberUid===ownerUid) return {ok:false, reason:'member_is_owner'};             // use pilEnrollOwner for the owner
  var role = opts.role || 'viewer';
  if(!PIL_ROLE_PRESETS[role]) return {ok:false, reason:'unknown_role'};
  // fail-closed: the canonical owner must already be an active self-owner, else the
  // member would resolve to an inactive/absent owner and be denied.
  var ownerEntry;
  try{ var os=await CLOUD.db.collection('ownershipMap').doc(ownerUid).get(); ownerEntry = os&&os.exists?(os.data()||null):null; }
  catch(e){ return {ok:false, reason:'owner_read_failed'}; }
  if(!ownerEntry || ownerEntry.status!=='active' || ownerEntry.ownerUid!==ownerUid) return {ok:false, reason:'owner_not_enrolled'};
  // no silent overwrite of an existing enrollment
  var existing;
  try{ var es=await CLOUD.db.collection('ownershipMap').doc(memberUid).get(); existing = es&&es.exists?(es.data()||null):null; }
  catch(e){ return {ok:false, reason:'member_read_failed'}; }
  if(existing && !opts.allowReenroll) return {ok:false, reason:'already_enrolled', existing:existing};
  var doc = pilBuildEnrollment({ loginUid:memberUid, ownerUid:ownerUid, role:role, modules:opts.modules,
    organizationId:(opts.organizationId!==undefined?opts.organizationId:(ownerEntry.organizationId||null)),
    permissions:opts.permissions });
  try{ await CLOUD.db.collection('ownershipMap').doc(memberUid).set(doc); }
  catch(e){ return {ok:false, reason:'write_failed', error:String((e&&e.message)||e)}; }
  try{ var vs=await CLOUD.db.collection('ownershipMap').doc(memberUid).get(); if(!vs||!vs.exists) return {ok:false, reason:'verify_failed'}; }
  catch(e){ return {ok:false, reason:'verify_read_failed'}; }
  return {ok:true, memberUid:memberUid, ownerUid:ownerUid, role:role, entry:doc};
}

if(typeof window!=='undefined'){
  window.IDENTITY=IDENTITY;
  window.pilCaptureLoginIdentity=pilCaptureLoginIdentity; window.pilEnrollMember=pilEnrollMember;
  window.PIL_CAPS=PIL_CAPS; window.PIL_MODULES=PIL_MODULES; window.PIL_ROLE_PRESETS=PIL_ROLE_PRESETS;
  window.pilPermissionsFromRole=pilPermissionsFromRole;
  window.personalContext=personalContext; window.personalOwnerUid=personalOwnerUid;
  window.personalCan=personalCan; window.personalWriteMeta=personalWriteMeta;
  window.pilResolveOnAuth=pilResolveOnAuth; window.pilStampResolution=pilStampResolution;
  window.pilBuildEnrollment=pilBuildEnrollment; window.pilEnroll=pilEnroll;
  window.pilEnrollOwner=pilEnrollOwner; window.pilUpdateEnrollment=pilUpdateEnrollment; window.pilRevoke=pilRevoke;
}
