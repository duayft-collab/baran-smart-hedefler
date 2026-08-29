/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 2a: PROFESSIONAL SOURCE REGISTRY + ETHICS
   The normative basis for the safeguarding engine (19-coaching-safeguard.js).

   ── NO COPYRIGHTED TEXT ──
   Not one sentence of any standard is reproduced. This file stores only
   (a) SOURCE METADATA — title, issuing body, version, date, reference URL —
   and (b) DERIVED PRINCIPLES written in our own words with a short internal
   rationale. Reading the actual standard remains the coach's responsibility.

   ── STANDARD vs POLICY ──
   Every principle is explicitly one of:
     PROFESSIONAL_STANDARD — what the profession requires of a coach.
     FOCUSUP_PRODUCT_POLICY — what THIS product chooses to do about it.
   The two are never blended: a product policy can be stricter than a standard,
   but it may never be presented as if the profession demanded it.

   ── VERIFICATION HONESTY ──
   Version/date metadata is marked verifiedByUser:false until the coach (the
   domain expert) confirms it against the primary source. coachingSourcesNeeding
   Verification() lists what is still unconfirmed. Nothing here is presented as
   a citation of exact wording.

   Pure data + pure functions. No I/O, no network, no writes, no persistence.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_ETHICS_VERSION = 1;
var COACHING_PRINCIPLE_KIND = ['PROFESSIONAL_STANDARD','FOCUSUP_PRODUCT_POLICY'];

/* ── 1) Source registry ──────────────────────────────────────────────────── */
var COACHING_SOURCES = {};
function coachingRegisterSource(id, def){
  if(typeof id!=='string' || !/^[a-z][a-z0-9_.]{1,47}$/.test(id)) return {ok:false,error:'INVALID_SOURCE_ID'};
  def = def || {};
  COACHING_SOURCES[id] = {
    id:id,
    title: String(def.title||''),
    issuingBody: String(def.issuingBody||''),
    version: def.version!=null ? String(def.version) : null,
    effectiveDate: def.effectiveDate!=null ? String(def.effectiveDate) : null,
    url: def.url!=null ? String(def.url) : null,
    scope: Array.isArray(def.scope) ? def.scope.map(String) : [],
    /* false until a human confirms the metadata against the primary source. */
    verifiedByUser: def.verifiedByUser===true,
    unverifiedFields: Array.isArray(def.unverifiedFields) ? def.unverifiedFields.map(String) : [],
    note: String(def.note||'')
  };
  return {ok:true, source:COACHING_SOURCES[id]};
}
function coachingSource(id){ return Object.prototype.hasOwnProperty.call(COACHING_SOURCES,id) ? COACHING_SOURCES[id] : null; }
function coachingSourceIds(){ return Object.keys(COACHING_SOURCES).sort(); }
function coachingSourcesNeedingVerification(){
  return coachingSourceIds().filter(function(id){ return COACHING_SOURCES[id].verifiedByUser!==true; })
    .map(function(id){ return {id:id, title:COACHING_SOURCES[id].title, unverifiedFields:COACHING_SOURCES[id].unverifiedFields.slice()}; });
}

coachingRegisterSource('icf.ethics', {
  title:'ICF Code of Ethics', issuingBody:'International Coaching Federation (ICF)',
  version:'2020 revision', effectiveDate:'2020-01',
  url:'https://coachingfederation.org/ethics/code-of-ethics',
  scope:['ethics','confidentiality','conflict_of_interest','scope_of_practice','referral'],
  unverifiedFields:['version','effectiveDate'],
  note:'Primary ethical basis for the coach role. Read in full; not summarized here.' });

coachingRegisterSource('icf.competencies', {
  title:'ICF Core Competencies (updated model)', issuingBody:'International Coaching Federation (ICF)',
  version:'updated model', effectiveDate:'2019-11',
  url:'https://coachingfederation.org/credentials-and-standards/core-competencies',
  scope:['competency','ethics','presence','listening','evoking_awareness','agreement'],
  unverifiedFields:['version','effectiveDate'],
  note:'Competency vocabulary for later phases; Phase 2 uses only the ethical-foundation domain.' });

coachingRegisterSource('icf.referral', {
  title:'ICF guidance on referring a client to therapy', issuingBody:'International Coaching Federation (ICF)',
  version:null, effectiveDate:null, url:null,
  scope:['referral','coaching_vs_therapy','scope_of_practice'],
  unverifiedFields:['version','effectiveDate','url'],
  note:'Exact document reference NOT confirmed offline. The coach must supply the current citation before this source is quoted anywhere user-facing.' });

coachingRegisterSource('emcc.ac.ethics', {
  title:'Global Code of Ethics for Coaches, Mentors and Supervisors',
  issuingBody:'EMCC Global / Association for Coaching',
  version:null, effectiveDate:null,
  url:'https://www.globalcodeofethics.org/',
  scope:['ethics','confidentiality','competence','supervision'],
  unverifiedFields:['version','effectiveDate'],
  note:'Secondary corroborating standard; used where it agrees with ICF, never to override it.' });

coachingRegisterSource('un.crc', {
  title:'UN Convention on the Rights of the Child', issuingBody:'United Nations',
  version:'1989', effectiveDate:'1990-09-02',
  url:'https://www.ohchr.org/en/instruments-mechanisms/instruments/convention-rights-child',
  scope:['minors','best_interests','participation','protection'],
  unverifiedFields:[],
  note:'Basis for treating child/youth safety as structural rather than a wording variant.' });

coachingRegisterSource('kcs.standards', {
  title:'International Child Safeguarding Standards', issuingBody:'Keeping Children Safe',
  version:null, effectiveDate:null, url:'https://www.keepingchildrensafe.global/',
  scope:['minors','safeguarding','escalation','reporting'],
  unverifiedFields:['version','effectiveDate'],
  note:'Used for the shape of a safeguarding response (recognise, respond, report, record), not for any reproduced wording.' });

/* ── 2) Derived principles (our own words) ───────────────────────────────── */
var COACHING_PRINCIPLES = {};
function coachingRegisterPrinciple(id, def){
  if(typeof id!=='string' || !/^[a-z][a-z0-9_.]{1,47}$/.test(id)) return {ok:false,error:'INVALID_PRINCIPLE_ID'};
  def = def || {};
  if(COACHING_PRINCIPLE_KIND.indexOf(def.kind)<0) return {ok:false,error:'INVALID_PRINCIPLE_KIND'};
  var srcs = Array.isArray(def.sourceIds) ? def.sourceIds.map(String) : [];
  for(var i=0;i<srcs.length;i++){ if(!coachingSource(srcs[i])) return {ok:false,error:'UNKNOWN_SOURCE:'+srcs[i]}; }
  /* A professional standard must name at least one source; a product policy is
     ours to make and may stand on its own reasoning. */
  if(def.kind==='PROFESSIONAL_STANDARD' && srcs.length===0) return {ok:false,error:'STANDARD_WITHOUT_SOURCE'};
  COACHING_PRINCIPLES[id] = { id:id, kind:def.kind, sourceIds:srcs,
    statement:String(def.statement||''), rationale:String(def.rationale||''),
    appliesTo: Array.isArray(def.appliesTo) ? def.appliesTo.map(String) : [] };
  return {ok:true, principle:COACHING_PRINCIPLES[id]};
}
function coachingPrinciple(id){ return Object.prototype.hasOwnProperty.call(COACHING_PRINCIPLES,id) ? COACHING_PRINCIPLES[id] : null; }
function coachingPrincipleIds(){ return Object.keys(COACHING_PRINCIPLES).sort(); }
function coachingPrinciplesOfKind(kind){ return coachingPrincipleIds().filter(function(id){ return COACHING_PRINCIPLES[id].kind===kind; }); }

coachingRegisterPrinciple('scope.not_therapy', { kind:'PROFESSIONAL_STANDARD', sourceIds:['icf.ethics','icf.referral'],
  statement:'Coaching is not therapy. When a topic needs clinical treatment, the coach names the limit and supports a referral instead of continuing.',
  rationale:'Working past the edge of the coaching role harms the client and breaches the professional role the coach agreed to.',
  appliesTo:['scope_of_practice'] });
coachingRegisterPrinciple('scope.no_diagnosis', { kind:'PROFESSIONAL_STANDARD', sourceIds:['icf.ethics'],
  statement:'A coach does not diagnose, label or treat mental-health conditions.',
  rationale:'Diagnosis is a licensed clinical act; a confident-sounding label from a coach can delay real care.',
  appliesTo:['scope_of_practice','clinical_risk'] });
coachingRegisterPrinciple('ethics.competence', { kind:'PROFESSIONAL_STANDARD', sourceIds:['icf.ethics','emcc.ac.ethics'],
  statement:'A coach works only within demonstrated competence and refers on when a situation exceeds it.',
  rationale:'Competence is the precondition of safety; goodwill is not a substitute for it.',
  appliesTo:['competence_limit'] });
coachingRegisterPrinciple('ethics.confidentiality', { kind:'PROFESSIONAL_STANDARD', sourceIds:['icf.ethics','emcc.ac.ethics'],
  statement:'What a client shares stays confidential, and the limits of that confidentiality are agreed with the client in advance.',
  rationale:'Confidentiality only protects anyone if its exceptions are known before something is disclosed.',
  appliesTo:['confidentiality'] });
coachingRegisterPrinciple('ethics.dual_relationship', { kind:'PROFESSIONAL_STANDARD', sourceIds:['icf.ethics'],
  statement:'Conflicting roles and interests are surfaced and resolved rather than left implicit.',
  rationale:'An unnamed second role quietly distorts every decision made inside the coaching relationship.',
  appliesTo:['dual_relationship'] });
coachingRegisterPrinciple('minor.best_interests', { kind:'PROFESSIONAL_STANDARD', sourceIds:['un.crc','kcs.standards'],
  statement:"A child's safety and best interests outrank the coaching agenda, the parent's preference and the coach's method.",
  rationale:'Everything else in a session is negotiable; this is not.',
  appliesTo:['safeguarding','minors'] });
coachingRegisterPrinciple('minor.voice', { kind:'PROFESSIONAL_STANDARD', sourceIds:['un.crc'],
  statement:'A child is entitled to be heard in matters that affect them, in language suited to their age.',
  rationale:'Coaching a minor without their own voice in it is instruction, not coaching.',
  appliesTo:['minors'] });
coachingRegisterPrinciple('minor.escalation', { kind:'PROFESSIONAL_STANDARD', sourceIds:['kcs.standards'],
  statement:'A safeguarding concern is recognised, responded to, reported to the responsible adult or authority, and recorded.',
  rationale:'An unreported concern is indistinguishable from an unnoticed one.',
  appliesTo:['safeguarding','minors'] });

coachingRegisterPrinciple('policy.fail_safe', { kind:'FOCUSUP_PRODUCT_POLICY', sourceIds:[],
  statement:'When the safety layer is uncertain, FocusUp pauses rather than continues.',
  rationale:'A needless pause costs a moment; an unsafe continuation can cost far more. The asymmetry decides the default.',
  appliesTo:['clinical_risk','safeguarding','scope_of_practice'] });
coachingRegisterPrinciple('policy.quiet_when_safe', { kind:'FOCUSUP_PRODUCT_POLICY', sourceIds:[],
  statement:'Ordinary low-risk coaching passes through the safety layer invisibly, with no warning, no ceremony and no medical framing.',
  rationale:'A tool that treats every session as a crisis trains the coach to ignore it — which is exactly when it stops working.',
  appliesTo:['scope_of_practice'] });
coachingRegisterPrinciple('policy.no_diagnostic_language', { kind:'FOCUSUP_PRODUCT_POLICY', sourceIds:[],
  statement:'FocusUp never tells anyone what condition they have. It speaks only about the limits of the coaching role.',
  rationale:'Scope language ("this may sit outside coaching") is true, useful and safe; a label is none of the three.',
  appliesTo:['scope_of_practice','clinical_risk'] });
coachingRegisterPrinciple('policy.private_by_default', { kind:'FOCUSUP_PRODUCT_POLICY', sourceIds:[],
  statement:'Coaching material is private to its owner and is never reused for product features without a deliberate, separate decision.',
  rationale:'Third-party material entrusted to a coach is not raw material for a product.',
  appliesTo:['confidentiality'] });
coachingRegisterPrinciple('policy.derived_only_learning', { kind:'FOCUSUP_PRODUCT_POLICY', sourceIds:[],
  statement:'Learning features consume de-identified derived observations, never identifiable session material.',
  rationale:'The system can learn from shape without ever holding the story.',
  appliesTo:['confidentiality'] });

/* ── 3) Confidentiality contract ─────────────────────────────────────────── */
var COACHING_DISCLOSURE_PURPOSES = ['owner_view','coach_review','explicit_share','export',
  'anonymous_metrics','academy_content','coach_dna','examples','analytics','ai_training'];
/* Purposes that may NEVER touch identifiable material — only derived observations. */
var COACHING_DERIVED_ONLY_PURPOSES = ['anonymous_metrics','academy_content','coach_dna','examples','analytics','ai_training'];
/* Purposes that require an explicit, per-act user decision. */
var COACHING_CONSENT_PURPOSES = ['explicit_share','export'];

function coachingDisclosureAllowed(purpose, session, opts){
  opts = opts || {};
  if(COACHING_DISCLOSURE_PURPOSES.indexOf(purpose)<0)
    return {allowed:false, reason:'unknown_purpose', requiresConfirmation:false, deidentificationRequired:false};
  if(COACHING_DERIVED_ONLY_PURPOSES.indexOf(purpose)>=0)
    return {allowed:false, reason:'requires_deidentified_derivation', requiresConfirmation:false,
            deidentificationRequired:true, principleIds:['policy.derived_only_learning','policy.private_by_default']};
  if(COACHING_CONSENT_PURPOSES.indexOf(purpose)>=0){
    if(opts.explicitConsent!==true)
      return {allowed:false, reason:'explicit_consent_required', requiresConfirmation:true,
              deidentificationRequired:false, principleIds:['ethics.confidentiality','policy.private_by_default']};
    /* B3 hold: no broad plaintext export path exists yet (see COACHING_BACKUP_POLICY). */
    if(purpose==='export' && opts.scopedExport!==true)
      return {allowed:false, reason:'no_privacy_safe_export_channel', requiresConfirmation:true,
              deidentificationRequired:false, principleIds:['policy.private_by_default']};
    return {allowed:true, reason:'explicit_consent', requiresConfirmation:true, deidentificationRequired:false};
  }
  /* owner_view / coach_review — the owner looking at their own practice. */
  return {allowed:true, reason:'owner_scope', requiresConfirmation:false, deidentificationRequired:false};
}

/* De-identified derived observation: shape without story. No id, no subjectRef,
   no title, no free text, no exact date — nothing that can re-identify a person. */
function coachingDeriveObservation(session, evaluation){
  session = (session && typeof session==='object' && !Array.isArray(session)) ? session : {};
  evaluation = (evaluation && typeof evaluation==='object') ? evaluation : {};
  var created = String(session.createdAt||'');
  return {
    kind:'derived_observation',
    context: session.context || null,
    minorContext: (typeof coachingContextIsMinor==='function') ? coachingContextIsMinor(session.context) : null,
    lifecycle: session.lifecycle || null,
    approach: session.approach || null,
    competencyTagCount: Array.isArray(session.competencyTags) ? session.competencyTags.length : 0,
    childCounts: (session.counters && typeof session.counters==='object') ?
      Object.keys(session.counters).reduce(function(m,k){ m[k]=Number(session.counters[k])||0; return m; },{}) : {},
    safetyDecision: evaluation.decision || null,
    safetyCategories: Array.isArray(evaluation.categories) ? evaluation.categories.slice() : [],
    period: /^\d{4}-\d{2}/.test(created) ? created.slice(0,7) : null,   // month only
    ethicsVersion: COACHING_ETHICS_VERSION
  };
}

/* ── 4) Basis lookup used by the safeguarding engine ─────────────────────── */
function coachingBasisFor(principleIds){
  var ids = Array.isArray(principleIds) ? principleIds : [];
  var standards = [], policies = [], sources = {};
  ids.forEach(function(pid){
    var p = coachingPrinciple(pid);
    if(!p) return;
    if(p.kind==='PROFESSIONAL_STANDARD') standards.push(pid); else policies.push(pid);
    p.sourceIds.forEach(function(s){ sources[s]=1; });
  });
  return { standards:standards, policies:policies, sourceIds:Object.keys(sources).sort() };
}

function coachingEthicsSelfCheck(){
  return {
    ethicsVersion: COACHING_ETHICS_VERSION,
    sources: coachingSourceIds(),
    principles: coachingPrincipleIds(),
    standards: coachingPrinciplesOfKind('PROFESSIONAL_STANDARD'),
    policies: coachingPrinciplesOfKind('FOCUSUP_PRODUCT_POLICY'),
    needsVerification: coachingSourcesNeedingVerification().map(function(x){ return x.id; }),
    derivedOnlyPurposes: COACHING_DERIVED_ONLY_PURPOSES.slice(),
    consentPurposes: COACHING_CONSENT_PURPOSES.slice()
  };
}

if(typeof window!=='undefined'){
  window.COACHING_ETHICS_VERSION=COACHING_ETHICS_VERSION;
  window.COACHING_PRINCIPLE_KIND=COACHING_PRINCIPLE_KIND;
  window.COACHING_SOURCES=COACHING_SOURCES; window.COACHING_PRINCIPLES=COACHING_PRINCIPLES;
  window.COACHING_DISCLOSURE_PURPOSES=COACHING_DISCLOSURE_PURPOSES;
  window.COACHING_DERIVED_ONLY_PURPOSES=COACHING_DERIVED_ONLY_PURPOSES;
  window.COACHING_CONSENT_PURPOSES=COACHING_CONSENT_PURPOSES;
  window.coachingRegisterSource=coachingRegisterSource; window.coachingSource=coachingSource;
  window.coachingSourceIds=coachingSourceIds; window.coachingSourcesNeedingVerification=coachingSourcesNeedingVerification;
  window.coachingRegisterPrinciple=coachingRegisterPrinciple; window.coachingPrinciple=coachingPrinciple;
  window.coachingPrincipleIds=coachingPrincipleIds; window.coachingPrinciplesOfKind=coachingPrinciplesOfKind;
  window.coachingDisclosureAllowed=coachingDisclosureAllowed;
  window.coachingDeriveObservation=coachingDeriveObservation;
  window.coachingBasisFor=coachingBasisFor; window.coachingEthicsSelfCheck=coachingEthicsSelfCheck;
}
