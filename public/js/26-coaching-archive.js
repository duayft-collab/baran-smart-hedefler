/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — B3: PRIVACY-SAFE COACHING EXPORT / RESTORE
   The blocker Phase 1 opened and Phase 5 cannot start without.

   Coaching material is third-party material held in trust. It therefore never
   joins the legacy plaintext D backup and never joins U.dl(D, ...). It gets its
   own channel with three scopes and one rule per scope:

     metadata_only        default. Counts, context, lifecycle, dates by MONTH.
                          No title, no subjectRef, no notes. Plaintext is safe
                          because there is nothing personal in it.
     deidentified_derived Phase 2 derived observations. Shape without story.
     full_owner_export    Everything the owner holds — and therefore ENCRYPTION
                          IS MANDATORY. Refused without a passphrase, on
                          purpose: an unencrypted full export is the exact
                          failure this blocker existed to prevent.

   Encryption is PBKDF2-SHA256 → AES-GCM-256 through WebCrypto, the same
   primitive family the existing backup verification already relies on. The
   passphrase is never stored, never logged and never leaves the call.

   Restore VALIDATES but does NOT PERSIST. Writing belongs to Phase 5 and must
   go through coachingAssertWritable() like every other coaching write.

   No network. No automatic export. Nothing runs unless the owner asks.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_EXPORT_FORMAT = 'focusup.coaching.export';
var COACHING_EXPORT_VERSION = 2;   /* v2 adds mirror + development records; v1 still opens */
var COACHING_EXPORT_SCOPES = ['metadata_only','deidentified_derived','full_owner_export'];
var COACHING_EXPORT_DEFAULT_SCOPE = 'metadata_only';
var COACHING_KDF_ITERATIONS = 210000;
/* Scopes whose content is personal enough that plaintext is not an option. */
var COACHING_ENCRYPTION_REQUIRED_SCOPES = ['full_owner_export'];
/* Retention before an archived session becomes purge-eligible. */
var COACHING_PURGE_AFTER_DAYS = 365;

/* ── base64 without btoa/Buffer, so browser and test sandbox behave alike ── */
var _B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function _caB64(bytes){
  var out='', i;
  for(i=0;i+2<bytes.length;i+=3){
    var n=(bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2];
    out+=_B64[(n>>18)&63]+_B64[(n>>12)&63]+_B64[(n>>6)&63]+_B64[n&63];
  }
  var rem=bytes.length-i;
  if(rem===1){ var a=bytes[i]<<16; out+=_B64[(a>>18)&63]+_B64[(a>>12)&63]+'=='; }
  else if(rem===2){ var b=(bytes[i]<<16)|(bytes[i+1]<<8); out+=_B64[(b>>18)&63]+_B64[(b>>12)&63]+_B64[(b>>6)&63]+'='; }
  return out;
}
function _caUnB64(str){
  var s=String(str||'').replace(/=+$/,''), out=[], acc=0, bits=0;
  for(var i=0;i<s.length;i++){
    var v=_B64.indexOf(s[i]); if(v<0) continue;
    acc=(acc<<6)|v; bits+=6;
    if(bits>=8){ bits-=8; out.push((acc>>bits)&255); }
  }
  return new Uint8Array(out);
}
function _caCrypto(){
  if(typeof crypto!=='undefined' && crypto && crypto.subtle) return crypto;
  if(typeof window!=='undefined' && window.crypto && window.crypto.subtle) return window.crypto;
  return null;
}
function _caBytes(text){ return new TextEncoder().encode(String(text)); }
function _caText(bytes){ return new TextDecoder().decode(bytes); }
function _caCanon(o){ return (typeof canonicalStringify==='function') ? canonicalStringify(o) : JSON.stringify(o); }

/* ── Policy ── */
function coachingExportPolicy(){
  return {
    formatVersion: COACHING_EXPORT_VERSION,
    scopes: COACHING_EXPORT_SCOPES.slice(),
    defaultScope: COACHING_EXPORT_DEFAULT_SCOPE,
    encryptionRequiredScopes: COACHING_ENCRYPTION_REQUIRED_SCOPES.slice(),
    includedInLegacyStateBackup: false,
    includedInLocalJsonExport: false,
    registeredInDiffSchema: false,
    automaticExport: false,
    requiresExplicitUserAction: true,
    requiresOwnerCapability: 'backup',
    restorePersists: true,          /* Phase 5: wired through coachingAssertWritable */
    restoreRequiresCapability: 'restore',
    restoreOverwrites: false,       /* an existing session id is skipped, never replaced */
    transcriptsIncluded: false,
    transcriptNote: 'Transkript alt-koleksiyonu hiçbir kapsamda dışa aktarılmaz; ayrı ve açık bir karar gerektirir.',
    purgeAfterDays: COACHING_PURGE_AFTER_DAYS,
    auditRecorded: true
  };
}
function coachingExportPlan(scope, opts){
  opts = opts || {};
  var s = COACHING_EXPORT_SCOPES.indexOf(scope)>=0 ? scope : COACHING_EXPORT_DEFAULT_SCOPE;
  var encRequired = COACHING_ENCRYPTION_REQUIRED_SCOPES.indexOf(s)>=0;
  var includes = { counters:true, context:true, lifecycle:true, periodMonth:true, mirrorCounts:true,
    mirrorObservations:(s!=='metadata_only'), developmentRecords:(s==='full_owner_export'),
    safeguardState:(s!=='metadata_only'), competencyTags:(s!=='metadata_only'),
    title:(s==='full_owner_export'), subjectRef:(s==='full_owner_export'),
    notes:(s==='full_owner_export'), transcript:false, attachments:false };
  var blocked = null;
  if(encRequired && !opts.passphrase) blocked = 'passphrase_required_for_this_scope';
  if(!opts.explicitConsent) blocked = blocked || 'explicit_user_action_required';
  return { scope:s, encryptionRequired:encRequired, includes:includes, blocked:blocked,
    exactDatesIncluded:(s==='full_owner_export'), policy:coachingExportPolicy() };
}

/* ── Redaction per scope. Pure; the input session is never mutated. ── */
function coachingRedactSession(session, scope){
  var s = (session && typeof session==='object' && !Array.isArray(session)) ? session : {};
  var sc = COACHING_EXPORT_SCOPES.indexOf(scope)>=0 ? scope : COACHING_EXPORT_DEFAULT_SCOPE;
  var created = String(s.createdAt||'');
  var base = {
    schemaVersion: s.schemaVersion || null,
    context: s.context || null,
    lifecycle: s.lifecycle || null,
    privacy: s.privacy || null,
    approach: s.approach || null,
    counters: (s.counters && typeof s.counters==='object')
      ? Object.keys(s.counters).reduce(function(m,k){ m[k]=Number(s.counters[k])||0; return m; },{}) : {},
    period: /^\d{4}-\d{2}/.test(created) ? created.slice(0,7) : null,
    /* mirror COUNTS only — an observation code is a shape, not a sentence */
    mirror: (s.mirror && s.mirror.version)
      ? { version:s.mirror.version, strengths:Number(s.mirror.strengths)||0, watch:Number(s.mirror.watch)||0 } : null
  };
  if(sc==='metadata_only') return base;
  if(sc==='deidentified_derived'){
    return (typeof coachingDeriveObservation==='function')
      ? coachingDeriveObservation(s, {})
      : base;
  }
  /* full_owner_export — everything the owner already holds, encrypted in transit */
  return {
    id:s.id||null, schemaVersion:s.schemaVersion||null,
    createdAt:s.createdAt||null, createdBy:s.createdBy||null,
    updatedAt:s.updatedAt||null, updatedBy:s.updatedBy||null,
    ownerUid:s.ownerUid||null, context:s.context||null, approach:s.approach||null,
    approachTags:(s.approachTags||[]).slice(), competencyTags:(s.competencyTags||[]).slice(),
    tags:(s.tags||[]).slice(), lifecycle:s.lifecycle||null, privacy:s.privacy||null,
    title:s.title||'', subjectRef:s.subjectRef||'',
    safeguard:s.safeguard||null, counters:base.counters, review:s.review||null,
    mirror:s.mirror||null
  };
}

/* ── Build an export envelope. Async: hashing and encryption are async. ── */
async function coachingBuildExport(sessions, opts){
  opts = opts || {};
  var plan = coachingExportPlan(opts.scope, opts);
  if(plan.blocked) return {ok:false, error:plan.blocked, plan:plan};
  if(typeof coachingCan==='function' && !coachingCan('backup')) return {ok:false, error:'not_authorized', plan:plan};
  var owner = (typeof coachingResolveOwner==='function') ? coachingResolveOwner() : null;
  if(!owner) return {ok:false, error:'owner_unresolved', plan:plan};

  var list = Array.isArray(sessions) ? sessions : [];
  var records = list.map(function(s){ return coachingRedactSession(s, plan.scope); });
  /* Deliberate practice and coach feedback are the owner's own development
     record. They travel ONLY inside the encrypted full export. */
  var development = (plan.scope==='full_owner_export' && Array.isArray(opts.development))
    ? opts.development.slice(0,200) : [];
  var payload = { format:COACHING_EXPORT_FORMAT, formatVersion:COACHING_EXPORT_VERSION,
    scope:plan.scope, ownerUid:owner, records:records, development:development };
  var plain = _caCanon(payload);
  var c = _caCrypto();
  if(!c) return {ok:false, error:'crypto_unavailable', plan:plan};
  var payloadSha256 = (typeof sha256Hex==='function') ? await sha256Hex(plain) : null;

  var envelope = { format:COACHING_EXPORT_FORMAT, formatVersion:COACHING_EXPORT_VERSION,
    scope:plan.scope, ownerUid:owner, recordCount:records.length,
    createdAt:opts.now || new Date().toISOString(), developmentCount:development.length,
    payloadSha256:payloadSha256, encrypted:false, encryption:null, data:null };

  if(!plan.encryptionRequired && !opts.passphrase){
    envelope.data = payload;                       // no personal content by construction
  }else{
    var salt = c.getRandomValues(new Uint8Array(16));
    var iv   = c.getRandomValues(new Uint8Array(12));
    var keyMaterial = await c.subtle.importKey('raw', _caBytes(opts.passphrase), 'PBKDF2', false, ['deriveKey']);
    var key = await c.subtle.deriveKey(
      {name:'PBKDF2', salt:salt, iterations:COACHING_KDF_ITERATIONS, hash:'SHA-256'},
      keyMaterial, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
    var ct = await c.subtle.encrypt({name:'AES-GCM', iv:iv}, key, _caBytes(plain));
    envelope.encrypted = true;
    envelope.encryption = { alg:'AES-GCM-256', kdf:'PBKDF2-SHA256',
      iterations:COACHING_KDF_ITERATIONS, salt:_caB64(salt), iv:_caB64(iv) };
    envelope.ciphertext = _caB64(new Uint8Array(ct));
  }
  return { ok:true, envelope:envelope, plan:plan, audit:coachingExportAudit(envelope, opts) };
}

/* ── Audit record: who/when/what shape. Never any content. ── */
function coachingExportAudit(envelope, opts){
  opts = opts || {};
  return { event:'coaching_export', at:envelope.createdAt, scope:envelope.scope,
    ownerUid:envelope.ownerUid, recordCount:envelope.recordCount,
    encrypted:!!envelope.encrypted, payloadSha256:envelope.payloadSha256,
    requestedBy:(typeof personalContext==='function' ? (personalContext().loginUid||null) : null),
    explicitConsent:opts.explicitConsent===true };
}

/* ── Open an envelope. VALIDATES ONLY — persistence is Phase 5's job and must
   still pass coachingAssertWritable(). ── */
async function coachingOpenExport(envelope, opts){
  opts = opts || {};
  if(!envelope || typeof envelope!=='object') return {ok:false, error:'invalid_envelope'};
  if(envelope.format!==COACHING_EXPORT_FORMAT) return {ok:false, error:'unknown_format'};
  if(!(envelope.formatVersion>=1 && envelope.formatVersion<=COACHING_EXPORT_VERSION))
    return {ok:false, error:'unsupported_format_version'};
  if(typeof coachingCan==='function' && !coachingCan('restore')) return {ok:false, error:'not_authorized'};
  var owner = (typeof coachingResolveOwner==='function') ? coachingResolveOwner() : null;
  if(!owner) return {ok:false, error:'owner_unresolved'};
  if(envelope.ownerUid && envelope.ownerUid!==owner) return {ok:false, error:'owner_mismatch'};

  var payload = envelope.data || null;
  if(envelope.encrypted){
    if(!opts.passphrase) return {ok:false, error:'passphrase_required'};
    var c = _caCrypto(); if(!c) return {ok:false, error:'crypto_unavailable'};
    try{
      var e = envelope.encryption || {};
      var keyMaterial = await c.subtle.importKey('raw', _caBytes(opts.passphrase), 'PBKDF2', false, ['deriveKey']);
      var key = await c.subtle.deriveKey(
        {name:'PBKDF2', salt:_caUnB64(e.salt), iterations:Number(e.iterations)||COACHING_KDF_ITERATIONS, hash:'SHA-256'},
        keyMaterial, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
      var pt = await c.subtle.decrypt({name:'AES-GCM', iv:_caUnB64(e.iv)}, key, _caUnB64(envelope.ciphertext));
      payload = JSON.parse(_caText(new Uint8Array(pt)));
    }catch(err){ return {ok:false, error:'decrypt_failed'}; }
  }
  if(!payload || !Array.isArray(payload.records)) return {ok:false, error:'invalid_payload'};
  if(typeof sha256Hex==='function' && envelope.payloadSha256){
    var sha = await sha256Hex(_caCanon(payload));
    if(sha!==envelope.payloadSha256) return {ok:false, error:'checksum_mismatch'};
  }
  return { ok:true, scope:payload.scope, records:payload.records, count:payload.records.length,
    development:Array.isArray(payload.development)?payload.development:[],   /* v1 exports have none */
    persisted:false,
    note:'Kayıtlar yalnız doğrulandı. Yazmak için coachingRestoreSessions() çağrılmalıdır; o da yazma zincirinden geçer.' };
}

/* ── Deletion lifecycle ── */
function coachingDeletionPlan(session, now){
  var s = session || {};
  var t = now ? Date.parse(now) : Date.now();
  var updated = Date.parse(s.updatedAt||s.createdAt||'') || null;
  var ageDays = updated ? Math.floor((t-updated)/864e5) : null;
  var archived = s.lifecycle==='archived';
  return {
    lifecycle: s.lifecycle||null,
    archived: archived,
    ageDays: ageDays,
    purgeEligible: archived && ageDays!==null && ageDays>=COACHING_PURGE_AFTER_DAYS,
    purgeAfterDays: COACHING_PURGE_AFTER_DAYS,
    requiresOwnerConfirmation: true,
    requiresCapability: 'delete',
    childCollectionsPurgedFirst: (typeof COACHING_CHILD_COLLECTIONS!=='undefined') ? COACHING_CHILD_COLLECTIONS.slice() : [],
    note:'Silme, sahibin açık onayı olmadan hiçbir koşulda otomatik yürümez.'
  };
}

function coachingArchiveSelfCheck(){
  return { format:COACHING_EXPORT_FORMAT, formatVersion:COACHING_EXPORT_VERSION,
    scopes:COACHING_EXPORT_SCOPES.slice(), defaultScope:COACHING_EXPORT_DEFAULT_SCOPE,
    encryptionRequiredScopes:COACHING_ENCRYPTION_REQUIRED_SCOPES.slice(),
    kdfIterations:COACHING_KDF_ITERATIONS, policy:coachingExportPolicy() };
}

if(typeof window!=='undefined'){
  window.COACHING_EXPORT_FORMAT=COACHING_EXPORT_FORMAT; window.COACHING_EXPORT_VERSION=COACHING_EXPORT_VERSION;
  window.COACHING_EXPORT_SCOPES=COACHING_EXPORT_SCOPES; window.COACHING_EXPORT_DEFAULT_SCOPE=COACHING_EXPORT_DEFAULT_SCOPE;
  window.COACHING_ENCRYPTION_REQUIRED_SCOPES=COACHING_ENCRYPTION_REQUIRED_SCOPES;
  window.COACHING_PURGE_AFTER_DAYS=COACHING_PURGE_AFTER_DAYS;
  window.coachingExportPolicy=coachingExportPolicy; window.coachingExportPlan=coachingExportPlan;
  window.coachingRedactSession=coachingRedactSession; window.coachingBuildExport=coachingBuildExport;
  window.coachingOpenExport=coachingOpenExport; window.coachingExportAudit=coachingExportAudit;
  window.coachingDeletionPlan=coachingDeletionPlan; window.coachingArchiveSelfCheck=coachingArchiveSelfCheck;
}
