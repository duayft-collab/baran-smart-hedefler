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

/* ── 1) Source registry ──────────────────────────────────────────────────
   Metadata only. `verified` means THE RECORDED FIELDS are confirmed; anything
   still unknown is listed in `unverifiedFields` and stored as null rather than
   guessed. `verificationBasis` says HOW it was confirmed, so a later reader can
   judge the strength of the claim instead of trusting a boolean. ── */
var COACHING_SOURCE_TYPES = ['code_of_ethics','competency_framework','guidance',
  'international_treaty','safeguarding_standards'];

var COACHING_SOURCES = {};
function coachingRegisterSource(id, def){
  if(typeof id!=='string' || !/^[a-z][a-z0-9_.]{1,47}$/.test(id)) return {ok:false,error:'INVALID_SOURCE_ID'};
  def = def || {};
  if(def.sourceType!=null && COACHING_SOURCE_TYPES.indexOf(def.sourceType)<0) return {ok:false,error:'INVALID_SOURCE_TYPE'};
  var nn = function(v){ return v!=null ? String(v) : null; };
  COACHING_SOURCES[id] = {
    sourceId:id,
    title: String(def.title||''),
    issuingBody: String(def.issuingBody||''),
    sourceType: nn(def.sourceType),
    officialUrl: nn(def.officialUrl),
    publicationDate: nn(def.publicationDate),
    revisionDate: nn(def.revisionDate),
    version: nn(def.version),
    verified: def.verified===true,
    verifiedAt: nn(def.verifiedAt),
    verificationBasis: nn(def.verificationBasis),
    unverifiedFields: Array.isArray(def.unverifiedFields) ? def.unverifiedFields.map(String) : [],
    supersedes: nn(def.supersedes),
    supersededBy: nn(def.supersededBy),
    scope: Array.isArray(def.scope) ? def.scope.map(String) : [],
    note: String(def.note||'')
  };
  return {ok:true, source:COACHING_SOURCES[id]};
}
function coachingSource(id){ return Object.prototype.hasOwnProperty.call(COACHING_SOURCES,id) ? COACHING_SOURCES[id] : null; }
function coachingSourceIds(){ return Object.keys(COACHING_SOURCES).sort(); }
function coachingSourcesNeedingVerification(){
  return coachingSourceIds().filter(function(id){ return COACHING_SOURCES[id].verified!==true; })
    .map(function(id){ return {sourceId:id, title:COACHING_SOURCES[id].title,
      unverifiedFields:COACHING_SOURCES[id].unverifiedFields.slice()}; });
}

coachingRegisterSource('icf.ethics', {
  title:'ICF Code of Ethics', issuingBody:'International Coaching Federation (ICF)',
  sourceType:'code_of_ethics', version:'2025', publicationDate:'2025',
  officialUrl:'https://coachingfederation.org/wp-content/uploads/2025/03/icf-ethics-code-of-ethics-2025.pdf',
  supersedes:'2020 edition',
  verified:true, verifiedAt:'2026-08-29', verificationBasis:'owner_confirmed_first_party_document',
  scope:['ethics','confidentiality','conflict_of_interest','scope_of_practice','referral'],
  note:'Primary ethical basis. Automated probe returns 403 (bot protection), so confirmation is the owner\'s, not this tool\'s.' });

coachingRegisterSource('icf.competencies', {
  title:'ICF Core Competencies', issuingBody:'International Coaching Federation (ICF)',
  sourceType:'competency_framework', version:'2025', publicationDate:'2025',
  officialUrl:'https://coachingfederation.org/wp-content/uploads/2025/09/icf-cs-core-competencies-2025.pdf',
  supersedes:'2019 updated model',
  verified:true, verifiedAt:'2026-08-29', verificationBasis:'owner_confirmed_first_party_document',
  scope:['competency','ethics','presence','listening','evoking_awareness','agreement'],
  note:'Competency vocabulary for Phase 7. Automated probe returns 403 (bot protection).' });

coachingRegisterSource('icf.referral', {
  title:'ICF guidance on referring a client to therapy', issuingBody:'International Coaching Federation (ICF)',
  sourceType:'guidance', version:null, publicationDate:null, officialUrl:null,
  verified:false, verifiedAt:null, verificationBasis:null,
  unverifiedFields:['officialUrl','version','publicationDate'],
  scope:['referral','coaching_vs_therapy','scope_of_practice'],
  note:'No current governing first-party document established. Left unresolved on purpose: a secondary blog must never be cited as if it were the standard.' });

coachingRegisterSource('emcc.ac.ethics', {
  title:'Global Code of Ethics for Coaches, Mentors and Supervisors',
  issuingBody:'EMCC Global and signatory professional bodies',
  sourceType:'code_of_ethics', version:'4', revisionDate:'2025', publicationDate:'2026-02-15',
  officialUrl:'https://www.globalcodeofethics.org/', supersedes:'version 3',
  verified:true, verifiedAt:'2026-08-29',
  verificationBasis:'first_party_announcement_read: emccglobal.org/news/global-code-of-ethics-new-version (version 4, review completed late 2025, announced 2026-02-15)',
  scope:['ethics','confidentiality','competence','supervision'],
  note:'Secondary corroborating standard; used where it agrees with ICF, never to override it.' });

coachingRegisterSource('un.crc', {
  title:'Convention on the Rights of the Child', issuingBody:'United Nations',
  sourceType:'international_treaty', version:'1989', publicationDate:'1989-11-20',
  revisionDate:null, officialUrl:'https://www.ohchr.org/en/instruments-mechanisms/instruments/convention-rights-child',
  verified:true, verifiedAt:'2026-08-29',
  verificationBasis:'canonical_public_record: adopted 1989-11-20, entered into force 1990-09-02',
  scope:['minors','best_interests','participation','protection'],
  note:'Basis for treating child/youth safety as structural. Entered into force 1990-09-02.' });

coachingRegisterSource('kcs.standards', {
  title:'International Child Safeguarding Standards', issuingBody:'Keeping Children Safe',
  sourceType:'safeguarding_standards', version:null, publicationDate:null,
  officialUrl:'https://www.keepingchildrensafe.global/international-child-safeguarding-standards/',
  verified:true, verifiedAt:'2026-08-29',
  verificationBasis:'first_party_url_reachable (HTTP 200); edition/version deliberately not asserted',
  unverifiedFields:['version','publicationDate','revisionDate'],
  scope:['minors','safeguarding','escalation','reporting'],
  note:'A professional safeguarding reference, NOT law. Used for the shape of a response (recognise, respond, report, record).' });

/* ── PHASE 4 additions: the frameworks the approach library rests on ──
   Framework provenance, not framework text. Book/paper records carry
   verified:false because edition and identifier could not be confirmed offline
   — they name where an idea comes from, and are never cited as proof. ── */
coachingRegisterSource('whitmore.performance', {
  title:'Coaching for Performance (the GROW structure)', issuingBody:'John Whitmore / Nicholas Brealey Publishing',
  sourceType:'guidance', verified:false, unverifiedFields:['version','publicationDate','officialUrl'],
  scope:['grow','performance','structure'],
  note:'Origin of the GROW sequence in coaching practice. Edition not confirmed offline; used as provenance only.' });
coachingRegisterSource('sfbt.origin', {
  title:'Solution-Focused Brief Therapy foundational practice', issuingBody:'Steve de Shazer and Insoo Kim Berg',
  sourceType:'guidance', verified:false, unverifiedFields:['version','publicationDate','officialUrl'],
  scope:['solution_focused','exceptions','scaling','preferred_future'],
  note:'THERAPY provenance. Evidence for SFBT as therapy does not transfer to solution-focused coaching without qualification.' });
coachingRegisterSource('mi.mint', {
  title:'Motivational Interviewing Network of Trainers', issuingBody:'MINT Inc.',
  sourceType:'guidance', officialUrl:'https://motivationalinterviewing.org/',
  verified:true, verifiedAt:'2026-08-29', verificationBasis:'first_party_url_reachable (HTTP 200)',
  unverifiedFields:['version','publicationDate'],
  scope:['motivational_interviewing','ambivalence','autonomy','change_talk'],
  note:'Practitioner network for MI. MI originates in counselling; its coaching application is an adaptation.' });
coachingRegisterSource('mi.miller_rollnick', {
  title:'Motivational Interviewing (the four processes)', issuingBody:'William R. Miller and Stephen Rollnick / Guilford Press',
  sourceType:'guidance', verified:false, unverifiedFields:['version','publicationDate','officialUrl'],
  scope:['motivational_interviewing','engaging','focusing','evoking','planning'],
  note:'Provenance of the four-process model. Edition not confirmed offline.' });
coachingRegisterSource('cbt.guided_discovery', {
  title:'Guided discovery in cognitive therapy', issuingBody:'Cognitive therapy tradition (Beck and successors)',
  sourceType:'guidance', verified:false, unverifiedFields:['version','publicationDate','officialUrl'],
  scope:['socratic','assumptions','evidence','alternative_perspective'],
  note:'CLINICAL provenance. Coaching use is limited to non-clinical exploration of assumptions.' });
coachingRegisterSource('strengths.via', {
  title:'VIA Character Strengths', issuingBody:'VIA Institute on Character',
  sourceType:'guidance', officialUrl:'https://www.viacharacter.org/',
  verified:true, verifiedAt:'2026-08-29', verificationBasis:'first_party_url_reachable (HTTP 200)',
  unverifiedFields:['version','publicationDate'],
  scope:['strengths','capability','positive_psychology'],
  note:'Strengths vocabulary. FocusUp does not administer or infer any strengths assessment.' });
coachingRegisterSource('sdt.deci_ryan', {
  title:'Self-Determination Theory (autonomy, competence, relatedness)', issuingBody:'Edward L. Deci and Richard M. Ryan',
  sourceType:'guidance', verified:false, unverifiedFields:['version','publicationDate','officialUrl'],
  scope:['values','autonomy','motivation'],
  note:'Motivational principle behind values-based and MI work. Automated probe blocked (403); not independently confirmed here.' });
coachingRegisterSource('behaviour.change_science', {
  title:'Behaviour change science: implementation intentions, cue-routine repetition and behavioural analysis',
  issuingBody:'Behavioural science literature (no single issuing body)',
  sourceType:'guidance', verified:false, unverifiedFields:['version','publicationDate','officialUrl'],
  scope:['behaviour_change','habits','environment','implementation_intentions'],
  note:'A field, not a document. Recorded so the behaviour-change approach names its basis without citing a specific study.' });
coachingRegisterSource('career.construction', {
  title:'Career construction and planned-happenstance perspectives', issuingBody:'Career development literature',
  sourceType:'guidance', verified:false, unverifiedFields:['version','publicationDate','officialUrl'],
  scope:['career','transition','decision_criteria'],
  note:'Provenance for career coaching. FocusUp asserts no labour-market facts.' });
coachingRegisterSource('narrative.practice', {
  title:'Narrative practice (externalising and alternative stories)', issuingBody:'Michael White and David Epston',
  sourceType:'guidance', verified:false, unverifiedFields:['version','publicationDate','officialUrl'],
  scope:['narrative','identity','meaning'],
  note:'THERAPY provenance. Coaching use stays non-clinical and stops at the Phase 2 boundary.' });

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
    mirrorCodes: (session.mirror && Array.isArray(session.mirror.codes)) ? session.mirror.codes.slice(0,16) : [],
    mirrorStrengths: (session.mirror && Number(session.mirror.strengths)) || 0,
    mirrorWatch: (session.mirror && Number(session.mirror.watch)) || 0,
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
    needsVerification: coachingSourcesNeedingVerification().map(function(x){ return x.sourceId; }),
    derivedOnlyPurposes: COACHING_DERIVED_ONLY_PURPOSES.slice(),
    consentPurposes: COACHING_CONSENT_PURPOSES.slice()
  };
}

if(typeof window!=='undefined'){
  window.COACHING_ETHICS_VERSION=COACHING_ETHICS_VERSION;
  window.COACHING_PRINCIPLE_KIND=COACHING_PRINCIPLE_KIND;
  window.COACHING_SOURCE_TYPES=COACHING_SOURCE_TYPES; window.COACHING_SOURCES=COACHING_SOURCES; window.COACHING_PRINCIPLES=COACHING_PRINCIPLES;
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
