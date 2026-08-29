/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 2b: SAFEGUARDING / BOUNDARY ENGINE
   The mandatory layer every coaching write passes through. Installs itself as
   the Phase 1 safety gate, so the chokepoint becomes:

     feature flag → owner resolution → authorization → SAFETY GATE → persistence

   ── WHAT THIS IS ──
   A deterministic, pure, offline phrase layer over the coach's own text. It
   classifies the SITUATION against the limits of the coaching role.

   ── WHAT THIS IS NOT ──
   It is not a diagnostic classifier, not a therapist, not a risk score, and not
   comprehension. It cannot know what a person means. It will miss things and it
   will occasionally over-fire. It is a SAFETY NET, never a safety guarantee —
   the coach stays responsible for the judgement. Because of that asymmetry the
   engine is deliberately biased toward pausing (policy.fail_safe), while
   ordinary coaching passes through invisibly (policy.quiet_when_safe).

   Language: FocusUp never names a condition. It speaks only about the scope of
   coaching (policy.no_diagnostic_language).

   Pure functions. No I/O, no network, no writes, no persistence, no timers.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_SAFEGUARD_VERSION = 1;

/* Stable reason codes. Callers may branch on these; entries are never renamed. */
var COACHING_REASON_CODES = [
  'ok_low_risk',
  'insufficient_context',
  'unknown_context',
  'guardian_consent_required',
  'guardian_consent_declined',
  'intervention_not_permitted_in_context',
  'minor_safeguarding_escalation',
  'immediate_safety_concern',
  'safeguarding_concern',
  'clinical_risk_indication',
  'scope_boundary',
  'competence_limit',
  'confidentiality_note',
  'dual_relationship_note'
];
function coachingValidReasonCode(c){ return COACHING_REASON_CODES.indexOf(c)>=0; }

var _CS_DEC_RANK = { allow:0, allow_with_note:1, pause:2, stop_and_refer:3 };
var _CS_SEV_RANK = { none:0, watch:1, concern:2, urgent:3 };
function _csMaxDec(a,b){ return (_CS_DEC_RANK[b]>_CS_DEC_RANK[a]) ? b : a; }
function _csMaxSev(a,b){ return (_CS_SEV_RANK[b]>_CS_SEV_RANK[a]) ? b : a; }
function _csEscalateDec(d){ return d==='allow'?'allow_with_note':(d==='allow_with_note'?'pause':(d==='pause'?'stop_and_refer':d)); }
function _csEscalateSev(s){ return s==='none'?'watch':(s==='watch'?'concern':(s==='concern'?'urgent':s)); }

/* ── Text folding: lowercase + Turkish→ASCII, so patterns match text typed
   with or without Turkish diacritics. Input text is READ ONLY and never
   stored, echoed or returned. ── */
var _CS_FOLD = { 'ı':'i','İ':'i','ğ':'g','Ğ':'g','ü':'u','Ü':'u','ş':'s','Ş':'s','ö':'o','Ö':'o','ç':'c','Ç':'c','â':'a','î':'i','û':'u' };
function _csFold(t){
  var s = String(t==null?'':t);
  var out='';
  for(var i=0;i<s.length;i++){ var c=s[i]; out += Object.prototype.hasOwnProperty.call(_CS_FOLD,c) ? _CS_FOLD[c] : c; }
  return out.toLowerCase().replace(/\s+/g,' ');
}

/* ══ Signal registry ══
   Each entry: what it is, how serious, what it forces, and which principle it
   rests on. Patterns are written in FOLDED (ascii, lowercase) form.
   Phrases are deliberately specific: a bare keyword would fire on ordinary
   coaching language and train the coach to ignore the layer. */
var COACHING_SIGNALS = [
  { code:'self_harm_suicide', category:'clinical_risk', severity:'urgent',
    decision:'stop_and_refer', reasonCode:'immediate_safety_concern',
    principleIds:['scope.not_therapy','policy.fail_safe'],
    patterns:[/\bintihar\b/, /kendim[ei]\s+oldur/, /kendime\s+zarar\s+ver/, /yasamak\s+istemiyorum/,
              /olmek\s+istiyorum/, /canima\s+kiy/, /hayatima\s+son\s+ver/,
              /\bsuicid/, /kill\s+myself/, /end\s+my\s+life/, /self[\s-]?harm/, /hurt\s+myself/] },

  { code:'harm_to_others', category:'clinical_risk', severity:'urgent',
    decision:'stop_and_refer', reasonCode:'immediate_safety_concern',
    principleIds:['scope.not_therapy','policy.fail_safe'],
    patterns:[/(onu|onlari|birini|kendisini)\s+oldur/, /(ona|onlara|birine)\s+zarar\s+verecegim/,
              /siddet\s+uygulayacagim/, /kill\s+(him|her|them|someone)/, /hurt\s+(him|her|them|someone)/] },

  { code:'abuse_disclosure', category:'safeguarding', severity:'urgent',
    decision:'stop_and_refer', reasonCode:'safeguarding_concern',
    principleIds:['minor.best_interests','minor.escalation','policy.fail_safe'],
    patterns:[/(cinsel|fiziksel|duygusal)\s+(taciz|istismar|siddet)/,
              /cocug[ua]\s+(taciz|istismar|siddet|dayak)/,
              /(babam|annem|esim|abim|amcam|ogretmen\w*)\s+(beni\s+)?(dovuyor|dovdu|taciz\s+ed)/,
              /siddet\s+goruyorum/, /dayak\s+yiyorum/,
              /(sexual|physical|emotional)\s+abuse/, /being\s+(beaten|abused)/, /child\s+abuse/] },

  { code:'severe_disorientation', category:'clinical_risk', severity:'urgent',
    decision:'stop_and_refer', reasonCode:'clinical_risk_indication',
    principleIds:['scope.not_therapy','scope.no_diagnosis','policy.fail_safe'],
    patterns:[/sesler\s+duyuyorum/, /gercekle\s+hayali\s+ayir/, /birileri\s+beni\s+izliyor\s+ve/,
              /hearing\s+voices/, /losing\s+touch\s+with\s+reality/] },

  { code:'severe_distress', category:'clinical_risk', severity:'concern',
    decision:'pause', reasonCode:'clinical_risk_indication',
    principleIds:['scope.not_therapy','policy.fail_safe'],
    patterns:[/yataktan\s+cikamiyorum/, /(her\s+gun|surekli)\s+agliyorum/, /panik\s+atak/,
              /hicbir\s+sey\s+hissetmiyorum/, /(tamamen|tumuyle)\s+umutsuz/,
              /can'?t\s+get\s+out\s+of\s+bed/, /panic\s+attack/, /crying\s+every\s+day/] },

  { code:'trauma_clinical', category:'scope_of_practice', severity:'concern',
    decision:'pause', reasonCode:'scope_boundary',
    principleIds:['scope.not_therapy','ethics.competence'],
    patterns:[/travma\s+(yasadim|sonrasi)/, /gecmis\s+travma/, /cocukluk\s+travma/,
              /\bptsd\b/, /flashback/, /childhood\s+trauma/] },

  { code:'addiction_dependency', category:'scope_of_practice', severity:'concern',
    decision:'pause', reasonCode:'scope_boundary',
    principleIds:['scope.not_therapy','ethics.competence'],
    patterns:[/(alkol|uyusturucu|madde|kumar|kokain|eroin)\s*\w*\s*bagimli/,
              /(alkol|uyusturucu|madde|kumar)\s+(sorunum|problemim)/,
              /(alcohol|drug|substance|gambling)\s+(addiction|dependen|problem)/] },

  { code:'diagnosis_request', category:'scope_of_practice', severity:'watch',
    decision:'pause', reasonCode:'scope_boundary',
    principleIds:['scope.no_diagnosis','policy.no_diagnostic_language'],
    patterns:[/(bende|onda|bunda)\s+\w*\s*(depresyon|anksiyete|bipolar|otizm|dehb|adhd|ocd)\s*\w*\s*(var\s*mi|mi)\b/,
              /teshis\s+(koy|et)/, /tani\s+koy/, /hangi\s+hastalig/,
              /do\s+i\s+have\s+(depression|anxiety|adhd|bipolar|autism|ocd)/, /diagnos(e|is)\s+me/] },

  { code:'treatment_request', category:'scope_of_practice', severity:'watch',
    decision:'pause', reasonCode:'scope_boundary',
    principleIds:['scope.not_therapy'],
    patterns:[/beni\s+(tedavi|iyilestir)/, /(bana|benimle)\s+(psiko)?terapi\s+(yap|uygula)/,
              /treat\s+me\b/, /be\s+my\s+therapist/] },

  { code:'medication_question', category:'scope_of_practice', severity:'watch',
    decision:'pause', reasonCode:'scope_boundary',
    principleIds:['scope.no_diagnosis','ethics.competence'],
    patterns:[/(ilaci?mi|antidepresani?mi|hapi?mi)\s+(birak|kullan)/,
              /(ilac|antidepresan)\s+(kullanmali\s*mi|onerir\s*mi|birakmali\s*mi)/,
              /doz(unu|umu)?\s+(artir|azalt)/,
              /should\s+i\s+(take|stop)\s+(my\s+)?(medication|antidepressant|pills)/] },

  { code:'competence_limit', category:'competence_limit', severity:'watch',
    decision:'pause', reasonCode:'competence_limit',
    principleIds:['ethics.competence'],
    patterns:[/(yetkin|yeterli|uzman)\s+degilim/, /bu\s+(konu|alan)\s+benim\s+(uzmanligim|alanim)\s+degil/,
              /basimi\s+asiyor/, /out\s+of\s+my\s+depth/, /not\s+(qualified|competent)/] },

  { code:'confidentiality_concern', category:'confidentiality', severity:'watch',
    decision:'allow_with_note', reasonCode:'confidentiality_note',
    principleIds:['ethics.confidentiality','policy.private_by_default'],
    patterns:[/aramizda\s+kalsin/, /kimseye\s+soyleme/, /gizli\s+kalmali/,
              /keep\s+(this|it)\s+(confidential|between\s+us)/, /don'?t\s+tell\s+anyone/] },

  { code:'dual_relationship', category:'dual_relationship', severity:'watch',
    decision:'allow_with_note', reasonCode:'dual_relationship_note',
    principleIds:['ethics.dual_relationship'],
    patterns:[/(kendi\s+)?(calisanima|akrabama|esime|kardesime|cocuguma)\s+kocluk/,
              /(hem|ayni\s+zamanda)\s+(patronu|yoneticisi|ortagi|akrabasi)yim/,
              /also\s+(my|their)\s+(boss|manager|relative|partner)/] }
];

/* Pure detection. Returns codes and metadata only — never the matched text. */
function coachingDetectSignals(text){
  var folded = _csFold(text);
  if(!folded.trim()) return [];
  var out = [];
  for(var i=0;i<COACHING_SIGNALS.length;i++){
    var sig = COACHING_SIGNALS[i], hit = false;
    for(var p=0;p<sig.patterns.length;p++){ if(sig.patterns[p].test(folded)){ hit = true; break; } }
    if(hit) out.push({ code:sig.code, category:sig.category, severity:sig.severity,
                       decision:sig.decision, reasonCode:sig.reasonCode, principleIds:sig.principleIds.slice() });
  }
  out.sort(function(a,b){
    var d = _CS_DEC_RANK[b.decision]-_CS_DEC_RANK[a.decision];
    if(d) return d;
    var s = _CS_SEV_RANK[b.severity]-_CS_SEV_RANK[a.severity];
    if(s) return s;
    return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
  });
  return out;
}

/* ══ Intervention policy ══
   Phase 3/4 registers real interventions. The rule that matters now: an
   intervention that has NOT declared itself safe for minors can never run
   silently in a child/youth context. */
var COACHING_INTERVENTION_POLICIES = {};
function coachingRegisterInterventionPolicy(key, def){
  if(typeof key!=='string' || !/^[a-z][a-z0-9_.]{1,47}$/.test(key)) return {ok:false,error:'INVALID_INTERVENTION_KEY'};
  def = def || {};
  COACHING_INTERVENTION_POLICIES[key] = {
    key:key,
    allowedContexts: Array.isArray(def.allowedContexts) ? def.allowedContexts.map(String) : [],
    minorSafe: def.minorSafe===true,
    requiresCompetence: Array.isArray(def.requiresCompetence) ? def.requiresCompetence.map(String) : []
  };
  return {ok:true, policy:COACHING_INTERVENTION_POLICIES[key]};
}
function coachingInterventionAllowed(key, context){
  var minor = (typeof coachingContextIsMinor==='function') ? coachingContextIsMinor(context) : false;
  if(key==null || key==='') return {allowed:true, reason:'no_intervention', registered:true};
  var p = Object.prototype.hasOwnProperty.call(COACHING_INTERVENTION_POLICIES,key) ? COACHING_INTERVENTION_POLICIES[key] : null;
  if(!p){
    /* fail-safe for minors, permissive for adults so later phases are not blocked */
    return minor ? {allowed:false, reason:'unregistered_intervention_in_minor_context', registered:false}
                 : {allowed:true, reason:'unregistered_intervention', registered:false};
  }
  if(p.allowedContexts.length && p.allowedContexts.indexOf(context)<0)
    return {allowed:false, reason:'context_not_allowed', registered:true};
  if(minor && !p.minorSafe)
    return {allowed:false, reason:'not_declared_minor_safe', registered:true};
  return {allowed:true, reason:'permitted', registered:true};
}

/* ══ Human-readable rationale — scope language only, never a condition name ══ */
var _CS_RATIONALE = {
  ok_low_risk:'Bu konu olağan koçluk kapsamında görünüyor.',
  insufficient_context:'Değerlendirme için yeterli bağlam yok; güvenli tarafta kalınıyor.',
  unknown_context:'Oturum bağlamı tanınmıyor; güvenli tarafta kalınıyor.',
  guardian_consent_required:'Reşit olmayan biriyle çalışmak için veli/vasi onayı kayıtlı değil.',
  guardian_consent_declined:'Veli/vasi onayı verilmemiş veya geri çekilmiş.',
  intervention_not_permitted_in_context:'Bu müdahale bu yaş/bağlam için uygun olduğunu beyan etmemiş.',
  minor_safeguarding_escalation:'Reşit olmayan bağlamda bu sinyal daha yüksek koruma gerektiriyor.',
  immediate_safety_concern:'Acil güvenlik olasılığı var. Bu koçluğun değil, ilgili acil/klinik desteğin alanıdır.',
  safeguarding_concern:'Koruma (safeguarding) gerektiren bir durum işareti var; sorumlu makama/kişiye taşınmalıdır.',
  clinical_risk_indication:'Bu durum klinik destek gerektiriyor olabilir; koçlukla sürdürmek uygun olmayabilir.',
  scope_boundary:'Bu konu koçluğun uygun kapsamı dışında olabilir.',
  competence_limit:'Bu konu beyan edilen yetkinliğin dışında görünüyor.',
  confidentiality_note:'Gizlilik beklentisi ve istisnaları açıkça konuşulmalı.',
  dual_relationship_note:'Çakışan rol/çıkar var; açıkça adlandırılmalı.'
};
var _CS_NEXT = {
  allow:'continue',
  allow_with_note:'record_note_and_continue',
  pause:'pause_and_review_scope',
  stop_and_refer:'stop_and_refer_to_appropriate_professional'
};

/* ══ THE EVALUATION ══ deterministic, pure, side-effect free. */
function coachingSafetyEvaluate(session, event){
  var isObj = function(o){ return !!o && typeof o==='object' && !Array.isArray(o); };
  var result = function(decision, reasonCode, severity, extra){
    var e = extra || {};
    var principleIds = e.principleIds || [];
    return {
      decision: decision,
      reasonCode: reasonCode,
      severity: severity,
      rationale: _CS_RATIONALE[reasonCode] || _CS_RATIONALE.ok_low_risk,
      context: e.context !== undefined ? e.context : null,
      minorContext: e.minorContext === true,
      categories: e.categories || [],
      signals: e.signals || [],
      basis: (typeof coachingBasisFor==='function') ? coachingBasisFor(principleIds) : {standards:[],policies:[],sourceIds:[]},
      principleIds: principleIds,
      nextAction: _CS_NEXT[decision],
      requiresConfirmation: decision !== 'allow',
      interventionUnregistered: e.interventionUnregistered === true,
      /* generic on purpose: emergency numbers differ by country and must be
         configured by the coach, never invented by the app. */
      referralGuidance: (decision === 'stop_and_refer')
        ? 'Uygun profesyonele yönlendir; acil güvenlik söz konusuysa yerel acil hizmetlere başvurulmalıdır.' : null,
      safeguardVersion: COACHING_SAFEGUARD_VERSION,
      ethicsVersion: (typeof COACHING_ETHICS_VERSION!=='undefined') ? COACHING_ETHICS_VERSION : null
    };
  };

  if(!isObj(session) || !isObj(event))
    return result('pause','insufficient_context','watch',{principleIds:['policy.fail_safe']});

  var ctx = session.context;
  if(typeof coachingValidContext!=='function' || !coachingValidContext(ctx))
    return result('pause','unknown_context','watch',{context:ctx==null?null:String(ctx), principleIds:['policy.fail_safe']});
  var minor = (typeof coachingContextIsMinor==='function') ? coachingContextIsMinor(ctx) : false;
  var base = { context:ctx, minorContext:minor };

  /* 1) Guardian consent gates a minor session before anything else is considered.
        A draft may exist; contact-bearing events may not. */
  if(minor && event.type !== 'draft'){
    var consent = (isObj(session.safeguard) && isObj(session.safeguard.guardianConsent))
      ? session.safeguard.guardianConsent : {state:'unknown'};
    if(consent.state === 'declined' || consent.state === 'withdrawn')
      return result('stop_and_refer','guardian_consent_declined','urgent',
        Object.assign({}, base, {categories:['safeguarding'], principleIds:['minor.best_interests','policy.fail_safe']}));
    if(consent.state !== 'granted' && consent.state !== 'not_required')
      return result('pause','guardian_consent_required','concern',
        Object.assign({}, base, {categories:['safeguarding'], principleIds:['minor.best_interests','minor.voice','policy.fail_safe']}));
  }

  /* 2) Intervention suitability for this context. */
  var iv = coachingInterventionAllowed(event.intervention, ctx);
  if(!iv.allowed)
    return result(minor ? 'stop_and_refer' : 'pause','intervention_not_permitted_in_context', minor ? 'concern' : 'watch',
      Object.assign({}, base, {categories:['safeguarding','competence_limit'],
        principleIds:['minor.best_interests','ethics.competence','policy.fail_safe'], interventionUnregistered:!iv.registered}));

  /* 3) Signals in the text being screened. */
  var signals = coachingDetectSignals(event.text);
  if(!signals.length)
    return result('allow','ok_low_risk','none',
      Object.assign({}, base, {principleIds:['policy.quiet_when_safe'], interventionUnregistered:!iv.registered}));

  var top = signals[0];
  var decision = top.decision, severity = top.severity, reasonCode = top.reasonCode;
  var principleIds = top.principleIds.slice();
  var categories = {}, i;
  for(i=0;i<signals.length;i++){
    categories[signals[i].category] = 1;
    decision = _csMaxDec(decision, signals[i].decision);
    severity = _csMaxSev(severity, signals[i].severity);
  }

  /* 4) Minor escalation: heightened protection is structural, not cosmetic.
        A safeguarding category in a minor context always stops. */
  if(minor){
    if(categories.safeguarding){ decision = 'stop_and_refer'; severity = 'urgent'; }
    else if(_CS_SEV_RANK[severity] >= _CS_SEV_RANK.concern){
      decision = _csEscalateDec(decision); severity = _csEscalateSev(severity);
      reasonCode = 'minor_safeguarding_escalation';
    }
    if(principleIds.indexOf('minor.best_interests')<0) principleIds.push('minor.best_interests');
  }
  if(principleIds.indexOf('policy.fail_safe')<0 && decision!=='allow' && decision!=='allow_with_note')
    principleIds.push('policy.fail_safe');

  return result(decision, reasonCode, severity, Object.assign({}, base, {
    categories: Object.keys(categories).sort(),
    signals: signals.map(function(s){ return {code:s.code, category:s.category, severity:s.severity}; }),
    principleIds: principleIds,
    interventionUnregistered: !iv.registered
  }));
}

/* ══ Gate adapter ══ the object returned satisfies the Phase 1 contract
   (a `decision` from COACHING_SAFETY_DECISION) and carries the full evaluation
   for callers that want the rationale. */
function coachingSafetyGateImpl(session, event){
  var ev = coachingSafetyEvaluate(session, event);
  return { decision: ev.decision, reason: ev.reasonCode, evaluation: ev };
}

function coachingSafeguardSelfCheck(){
  return {
    safeguardVersion: COACHING_SAFEGUARD_VERSION,
    gateInstalled: (typeof coachingSafetyGateInstalled==='function') ? coachingSafetyGateInstalled() : false,
    gateIsOurs: (typeof COACHING_SAFETY!=='undefined') && COACHING_SAFETY.gate === coachingSafetyGateImpl,
    signalCount: COACHING_SIGNALS.length,
    reasonCodes: COACHING_REASON_CODES.slice(),
    interventionPolicies: Object.keys(COACHING_INTERVENTION_POLICIES).sort(),
    categories: (typeof COACHING_BOUNDARY_CATEGORIES!=='undefined') ? COACHING_BOUNDARY_CATEGORIES.slice() : []
  };
}

/* ── Install the real gate into the Phase 1 chokepoint. This is the only side
   effect of loading this file. The feature flag stays OFF, so nothing becomes
   writable — the chain simply now has its safety link in place. ── */
if(typeof coachingInstallSafetyGate==='function'){
  coachingInstallSafetyGate(coachingSafetyGateImpl);
}

if(typeof window!=='undefined'){
  window.COACHING_SAFEGUARD_VERSION=COACHING_SAFEGUARD_VERSION;
  window.COACHING_REASON_CODES=COACHING_REASON_CODES;
  window.COACHING_SIGNALS=COACHING_SIGNALS;
  window.COACHING_INTERVENTION_POLICIES=COACHING_INTERVENTION_POLICIES;
  window.coachingValidReasonCode=coachingValidReasonCode;
  window.coachingDetectSignals=coachingDetectSignals;
  window.coachingRegisterInterventionPolicy=coachingRegisterInterventionPolicy;
  window.coachingInterventionAllowed=coachingInterventionAllowed;
  window.coachingSafetyEvaluate=coachingSafetyEvaluate;
  window.coachingSafetyGateImpl=coachingSafetyGateImpl;
  window.coachingSafeguardSelfCheck=coachingSafeguardSelfCheck;
}
