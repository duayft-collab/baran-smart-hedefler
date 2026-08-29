/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 4b: CONTEXT ROUTER
   Answers "which approach fits THIS situation?" from STRUCTURED context — not
   from free-text psychological inference. It reads bounded signals the coach
   (or a later UI) sets, and unknown stays unknown: a missing signal scores
   nothing and is never invented.

   The router recommends; it does not lock. At most three approaches, usually
   one primary plus one secondary, each with a readable reason and an honest
   confidence band. There is no percentage match, because there is no
   measurement that would justify one.

   ORDER OF AUTHORITY — safety always wins:
     structured context → PHASE 2 safety → PHASE 4 router → PHASE 3 ranker
   A stop_and_refer returns no approach at all, and an unmet guardian
   requirement for a minor returns no approach at all.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_ROUTER_VERSION = 1;
var COACHING_ROUTER_MAX = 3;
var COACHING_SCALE = ['unknown','low','medium','high'];
var COACHING_FLAG = ['unknown','no','yes'];
var COACHING_CONFIDENCE = ['LOW','MEDIUM','HIGH'];
var COACHING_GOAL_TYPES = ['unknown','performance','decision','relationship','wellbeing','identity','learning'];

function _crScale(v){ return COACHING_SCALE.indexOf(v)>=0 ? v : 'unknown'; }
function _crFlag(v){ return COACHING_FLAG.indexOf(v)>=0 ? v : (v===true?'yes':(v===false?'no':'unknown')); }
function _crIs(v, level){ return _crScale(v)===level; }
function _crYes(v){ return _crFlag(v)==='yes'; }

/* Signal rules per approach. Each entry: [test, weight, human-readable reason].
   Weights are internal; only the reasons are ever shown. */
function _crRules(){
  return {
    GROW:[
      [function(c){ return _crIs(c.clarity,'high'); },4,'Hedef makul ölçüde net; yapı burada işe yarar.'],
      [function(c){ return _crIs(c.readinessForAction,'high'); },3,'Eyleme hazır görünüyor.'],
      [function(c){ return c.coachingGoalType==='performance'; },3,'Konu performans/eylem alanında.'],
      [function(c){ return _crIs(c.ambivalence,'high'); },-5,null],
      [function(c){ return _crYes(c.meaningIdentityContext); },-2,null]
    ],
    SOLUTION_FOCUSED:[
      [function(c){ return _crIs(c.strengthsOpportunity,'high'); },3,'İşe yarayan istisnalar ve mevcut kaynaklar var.'],
      [function(c){ return _crIs(c.readinessForAction,'medium')||_crIs(c.readinessForAction,'high'); },2,'Hareket etme isteği mevcut.'],
      [function(c){ return ['EXCEPTION','POSSIBILITY','RESOURCE'].indexOf(c.currentPurpose)>=0; },3,'Şu anki amaç istisna/olasılık/kaynak yönünde.'],
      [function(c){ return _crIs(c.clarity,'low')&&_crIs(c.ambivalence,'high'); },-2,null]
    ],
    MOTIVATIONAL_INTERVIEWING:[
      [function(c){ return _crIs(c.ambivalence,'high'); },6,'Kararsızlık belirgin; asıl çalışılacak malzeme bu.'],
      [function(c){ return _crIs(c.ambivalence,'medium'); },3,'Motivasyon karışık görünüyor.'],
      [function(c){ return _crIs(c.readinessForAction,'low'); },3,'Niyet var ama taahhüde dönüşmüyor.'],
      [function(c){ return ['OWNERSHIP','DECISION','EMOTION'].indexOf(c.currentPurpose)>=0; },2,'Sahiplenme ve karar alanında çalışılıyor.'],
      [function(c){ return _crIs(c.readinessForAction,'high')&&_crIs(c.ambivalence,'low'); },-3,null]
    ],
    SOCRATIC_GUIDED_DISCOVERY:[
      [function(c){ return _crIs(c.assumptionExplorationNeeded,'high'); },6,'Sınanmamış bir varsayım konuşmayı yönetiyor.'],
      [function(c){ return _crIs(c.assumptionExplorationNeeded,'medium'); },3,'Yorumun kanıtla sınanması yararlı olabilir.'],
      [function(c){ return ['ASSUMPTION','PERSPECTIVE'].indexOf(c.currentPurpose)>=0; },3,'Amaç varsayım/bakış açısı incelemesi.'],
      [function(c){ return _crIs(c.ambivalence,'high'); },-3,null]
    ],
    STRENGTHS_BASED:[
      [function(c){ return _crIs(c.strengthsOpportunity,'high'); },6,'Halihazırda var olan kapasite ve geçmiş başarı kullanılabilir.'],
      [function(c){ return _crIs(c.strengthsOpportunity,'medium'); },3,'Kullanılabilir bir kaynak görünüyor.'],
      [function(c){ return ['STRENGTH','RESOURCE','EXCEPTION'].indexOf(c.currentPurpose)>=0; },3,'Amaç güç/kaynak alanında.'],
      [function(c){ return _crIs(c.clarity,'low'); },1,null]
    ],
    VALUES_BASED:[
      [function(c){ return _crIs(c.valuesConflict,'high'); },6,'Öncelikler birbiriyle çatışıyor.'],
      [function(c){ return _crIs(c.valuesConflict,'medium'); },3,'Öncelikler arasında gerilim var.'],
      [function(c){ return _crYes(c.meaningIdentityContext); },2,'Anlam ve kimlik konusu masada.'],
      [function(c){ return _crYes(c.careerContext); },2,'Kariyer kararı çoğu zaman değer kararıdır.'],
      [function(c){ return ['VALUE','MEANING'].indexOf(c.currentPurpose)>=0; },3,'Amaç değer/anlam alanında.']
    ],
    BEHAVIOUR_CHANGE:[
      [function(c){ return _crIs(c.behaviourChangeNeed,'high'); },6,'Ne yapılacağı biliniyor; sorun sürdürülebilirlikte.'],
      [function(c){ return _crIs(c.behaviourChangeNeed,'medium'); },3,'Davranışın tekrarı üzerinde çalışmak yararlı olabilir.'],
      [function(c){ return _crIs(c.readinessForAction,'high'); },3,'Eyleme hazır; plan somutlaşabilir.'],
      [function(c){ return _crIs(c.clarity,'high'); },2,'Hedef net; iş uygulamada.'],
      [function(c){ return _crIs(c.ambivalence,'high'); },-5,null]
    ],
    DEVELOPMENTAL_EXECUTIVE:[
      [function(c){ return _crYes(c.leadershipContext); },6,'Konu liderlik davranışı ve sorumluluk alanında.'],
      [function(c){ return c.personContext==='executive'; },3,'Yönetici bağlamında çalışılıyor.'],
      [function(c){ return ['PERSPECTIVE','OWNERSHIP','DECISION'].indexOf(c.currentPurpose)>=0; },2,'Amaç bakış açısı ve sahiplenme yönünde.'],
      [function(c){ return c.coachingGoalType==='relationship'; },1,null]
    ],
    CAREER_COACHING:[
      [function(c){ return _crYes(c.careerContext); },6,'Kariyer yönü veya rol geçişi konuşuluyor.'],
      [function(c){ return _crIs(c.valuesConflict,'high'); },2,'Seçenekler değer düzeyinde çatışıyor.'],
      [function(c){ return ['DECISION','OPTION'].indexOf(c.currentPurpose)>=0; },2,'Amaç karar/seçenek alanında.']
    ],
    NARRATIVE_REFLECTIVE:[
      [function(c){ return _crYes(c.meaningIdentityContext); },6,'Kimlik ve anlam soruları öne çıkıyor.'],
      [function(c){ return ['MEANING','PERSPECTIVE','CLOSURE'].indexOf(c.currentPurpose)>=0; },3,'Amaç anlam/bakış açısı alanında.'],
      [function(c){ return c.coachingGoalType==='identity'; },3,'Hedef türü kimlik gelişimi.'],
      [function(c){ return _crIs(c.readinessForAction,'high'); },-2,null]
    ]
  };
}

function _crNormalize(input){
  input = input || {};
  var ctx = input.personContext || (input.session && input.session.context) || 'adult';
  return {
    personContext: ctx,
    conversationStage: (typeof coachingValidStage==='function' && coachingValidStage(input.conversationStage)) ? input.conversationStage : null,
    currentPurpose: (typeof coachingValidPurpose==='function' && coachingValidPurpose(input.currentPurpose)) ? input.currentPurpose : null,
    coachingGoalType: COACHING_GOAL_TYPES.indexOf(input.coachingGoalType)>=0 ? input.coachingGoalType : 'unknown',
    clarity:_crScale(input.clarity), ambivalence:_crScale(input.ambivalence),
    readinessForAction:_crScale(input.readinessForAction), valuesConflict:_crScale(input.valuesConflict),
    assumptionExplorationNeeded:_crScale(input.assumptionExplorationNeeded),
    strengthsOpportunity:_crScale(input.strengthsOpportunity),
    behaviourChangeNeed:_crScale(input.behaviourChangeNeed),
    leadershipContext:_crFlag(input.leadershipContext), careerContext:_crFlag(input.careerContext),
    meaningIdentityContext:_crFlag(input.meaningIdentityContext),
    recentApproaches: Array.isArray(input.recentApproaches) ? input.recentApproaches.map(String) : []
  };
}
function _crKnownSignals(c){
  var n = 0;
  ['clarity','ambivalence','readinessForAction','valuesConflict','assumptionExplorationNeeded',
   'strengthsOpportunity','behaviourChangeNeed'].forEach(function(k){ if(c[k]!=='unknown') n++; });
  ['leadershipContext','careerContext','meaningIdentityContext'].forEach(function(k){ if(c[k]!=='unknown') n++; });
  if(c.currentPurpose) n++;
  if(c.coachingGoalType!=='unknown') n++;
  return n;
}

function coachingRouteApproaches(input){
  input = input || {};
  var notes = [];
  var c = _crNormalize(input);

  /* ── 1) Safety is upstream of everything ── */
  var safety = null, decision = input.safetyDecision || null;
  if(input.session && input.event && typeof coachingSafetyEvaluate==='function'){
    var ev = coachingSafetyEvaluate(input.session, input.event);
    safety = { decision:ev.decision, reasonCode:ev.reasonCode, severity:ev.severity, rationale:ev.rationale };
    decision = ev.decision;
  }else if(decision){
    safety = { decision:decision, reasonCode:input.safetyReasonCode||null, severity:null, rationale:null };
  }
  if(decision==='stop_and_refer')
    return { allowed:false, safety:safety, approaches:[], notes:['Güvenlik katmanı devam edilmemesi gerektiğini belirtti; yaklaşım önerilmiyor.'],
             knownSignals:_crKnownSignals(c), version:COACHING_ROUTER_VERSION };

  /* ── 2) Minors: the guardian requirement is not negotiable ── */
  var minor = (typeof coachingContextIsMinor==='function') ? coachingContextIsMinor(c.personContext) : false;
  if(minor){
    var g = input.guardianState;
    if(!g && input.session && input.session.safeguard && input.session.safeguard.guardianConsent)
      g = input.session.safeguard.guardianConsent.state;
    if(g!=='granted' && g!=='not_required')
      return { allowed:false, safety:safety, approaches:[],
        notes:['Reşit olmayan danışan için veli/vasi durumu karşılanmadan yaklaşım önerilmez.'],
        knownSignals:_crKnownSignals(c), version:COACHING_ROUTER_VERSION };
  }

  var paused = decision==='pause';
  if(paused) notes.push('Güvenlik katmanı duraklama önerdi: meydan okuma ve yeniden çerçeveleme ağırlıklı yaklaşımlar listelenmiyor.');

  /* ── 3) Eligibility ── */
  var rules = _crRules();
  var candidates = (typeof coachingApproachList==='function' ? coachingApproachList() : []).filter(function(a){
    if(!a.active) return false;
    if(typeof coachingApproachAllowedForContext==='function' && !coachingApproachAllowedForContext(a.id, c.personContext)) return false;
    if(paused && (a.preferredInterventionTypes.indexOf('CHALLENGE')>=0 || a.preferredInterventionTypes.indexOf('REFRAME')>=0)) return false;
    return true;
  });

  /* ── 4) Score ── */
  var scored = candidates.map(function(a){
    var score = 0, reasons = [];
    (rules[a.id]||[]).forEach(function(r){
      var ok=false; try{ ok = r[0](c); }catch(e){ ok=false; }
      if(!ok) return;
      score += r[1];
      if(r[2]) reasons.push(r[2]);
    });
    if(c.conversationStage){
      if(a.compatibleStages.indexOf(c.conversationStage)>=0) score += 2;
      else score -= 2;
    }
    if(c.currentPurpose && a.compatiblePurposes.indexOf(c.currentPurpose)>=0) score += 2;
    /* continuity is usually good; tunnel vision is not */
    var recent = c.recentApproaches;
    if(recent.length && recent[recent.length-1]===a.id) score += 1;
    if(recent.length>=3 && recent.slice(-3).every(function(x){ return x===a.id; })){
      /* a warning outranks a match reason — it goes to the front, not the tail */
      score -= 3; reasons.unshift('Son üç hamlede de aynı yaklaşım kullanıldı; tek çerçevede kalma riski var.');
    }
    if(minor && a.minorPolicy==='permitted_with_adaptation')
      reasons.push('Reşit olmayan danışanda somut ve gelişime uygun biçimde uyarlanmalı.');
    return { a:a, score:score, reasons:reasons };
  }).filter(function(s){ return s.score>0; });

  scored.sort(function(x,y){
    if(y.score!==x.score) return y.score-x.score;
    if(x.a.order!==y.a.order) return x.a.order-y.a.order;
    return x.a.id<y.a.id?-1:1;
  });

  /* ── 5) Bound the hybrid: one primary, usually one secondary, never a crowd ── */
  var chosen = [];
  if(scored.length){
    chosen.push(scored[0]);
    var top = scored[0].score;
    if(scored[1] && scored[1].score >= Math.max(3, top*0.55)) chosen.push(scored[1]);
    if(scored[2] && scored[2].score >= Math.max(6, top*0.8)) chosen.push(scored[2]);
  }
  chosen = chosen.slice(0, COACHING_ROUTER_MAX);

  var known = _crKnownSignals(c);
  if(known<2) notes.push('Yapılandırılmış bağlam sinyali az; öneri düşük güvenle sunuluyor.');
  if(!chosen.length) notes.push('Yeterli yapılandırılmış bağlam yok; yaklaşım önerilmiyor. Eksik bağlam uydurulmaz.');

  /* Confidence never rises as you go down the list: a runner-up cannot be more
     certain than the recommendation above it. */
  var prevBand = 'HIGH';
  var approaches = chosen.map(function(s, i){
    var band = 'LOW';
    var lead = (i===0 && scored[1]) ? (s.score - scored[1].score) : s.score;
    if(s.score>=10 && (i>0 || lead>=3)) band = 'HIGH';
    else if(s.score>=5) band = 'MEDIUM';
    if(known<2) band = 'LOW';
    if(known<4 && band==='HIGH') band = 'MEDIUM';
    if(COACHING_CONFIDENCE.indexOf(band) > COACHING_CONFIDENCE.indexOf(prevBand)) band = prevBand;
    prevBand = band;
    var why = s.reasons.slice(0,2);
    if(!why.length) why = [s.a.description];
    return {
      approachId:s.a.id, title:s.a.title, shortTitle:s.a.shortTitle,
      role: i===0 ? 'primary' : (i===1 ? 'secondary' : 'tertiary'),
      whyNow: why.join(' '),
      confidenceBand: band,
      suitablePurposes: s.a.compatiblePurposes.slice(),
      preferredInterventionTypes: s.a.preferredInterventionTypes.slice(),
      cautions: s.a.contraindications.slice().concat(s.a.cautionInterventionTypes.length
        ? ['Dikkatli kullan: '+s.a.cautionInterventionTypes.join(', ')] : []),
      evidenceGrade: s.a.evidenceGrade,
      evidenceCaution: s.a.evidenceBasis.caution,
      minorPolicy: s.a.minorPolicy,
      safetyStatus: safety ? safety.decision : 'not_evaluated'
    };
  });

  var combination = null;
  if(approaches.length>=2)
    combination = approaches[0].shortTitle+' + '+approaches[1].shortTitle+' — birincil çerçeve '+
      approaches[0].shortTitle+', ikincil mercek '+approaches[1].shortTitle+'.';

  return { allowed:true, safety:safety, approaches:approaches, combination:combination,
    considered:candidates.length, knownSignals:known, context:c.personContext,
    notes:notes, version:COACHING_ROUTER_VERSION };
}

/* ══ The full chain: context → safety → approach → moves ══ */
function coachingRecommend(input){
  input = input || {};
  var routed = coachingRouteApproaches(input);
  if(!routed.allowed)
    return { allowed:false, safety:routed.safety, approaches:[], moves:[], notes:routed.notes,
             version:COACHING_ROUTER_VERSION };
  var primary = routed.approaches.length ? routed.approaches[0].approachId : null;
  var moves = (typeof coachingSuggestMoves==='function') ? coachingSuggestMoves({
    session:input.session, event:input.event,
    context:input.personContext || (input.session && input.session.context),
    stage:input.conversationStage, purpose:input.currentPurpose, depth:input.depth,
    recentMoves:input.recentMoves, usedIds:input.usedIds,
    significantRealization:input.significantRealization,
    competencyFocus:input.competencyFocus, approach:primary
  }) : {suggestions:[], notes:[]};
  return { allowed: moves.allowed!==false, safety: routed.safety || moves.safety,
    approaches:routed.approaches, combination:routed.combination,
    moves: moves.suggestions || [],
    notes: routed.notes.concat(moves.notes||[]), version:COACHING_ROUTER_VERSION };
}

function coachingRouterSelfCheck(){
  return { version:COACHING_ROUTER_VERSION, max:COACHING_ROUTER_MAX,
    scale:COACHING_SCALE.slice(), flag:COACHING_FLAG.slice(),
    confidenceBands:COACHING_CONFIDENCE.slice(), goalTypes:COACHING_GOAL_TYPES.slice(),
    ruledApproaches:Object.keys(_crRules()).sort() };
}

if(typeof window!=='undefined'){
  window.COACHING_ROUTER_VERSION=COACHING_ROUTER_VERSION; window.COACHING_ROUTER_MAX=COACHING_ROUTER_MAX;
  window.COACHING_SCALE=COACHING_SCALE; window.COACHING_FLAG=COACHING_FLAG;
  window.COACHING_CONFIDENCE=COACHING_CONFIDENCE; window.COACHING_GOAL_TYPES=COACHING_GOAL_TYPES;
  window.coachingRouteApproaches=coachingRouteApproaches; window.coachingRecommend=coachingRecommend;
  window.coachingRouterSelfCheck=coachingRouterSelfCheck;
}
