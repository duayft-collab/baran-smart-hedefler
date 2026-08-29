/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 3d: MOVE SUGGESTION ENGINE
   Deterministic ranking over the canonical registry. Answers "what kind of
   move fits here?" — and is willing to answer "not another question".

   Three suggestions maximum. Each one says why now, what it is for, what the
   safety layer decided and what the runner-up would have been. Internal
   weights are numeric; what the coach reads is a sentence.

   Safety is upstream, not a filter bolted on: the Phase 2 evaluation runs
   first, a stop_and_refer returns NO coaching moves at all, and every
   candidate must pass coachingInterventionAllowed() — so an unregistered or
   non-minor-safe move can never surface for a child or a youth.

   No network, no AI, no persistence, no session data retained.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_SUGGEST_VERSION = 1;
var COACHING_SUGGEST_MAX = 3;
var COACHING_SPACE_TYPES = ['REFLECTION','SUMMARY','SILENCE','PARAPHRASE'];

var _CS_W = {
  stageMatch:3, stageMiss:-1, purposeMatch:4, depthBase:2,
  competency:1, sameTypeAsLast:-3, sameTypeTwice:-5, alreadyUsed:-6, samePurposeRecent:-2,
  spaceAfterQuestions:5, questionAfterQuestions:-3, stackedChallenge:-8,
  spaceAfterRealization:5, questionAfterRealization:-3, mediumRisk:-1
};

function _sgArr(v){ return Array.isArray(v) ? v : []; }
function _sgTypes(moves){ return _sgArr(moves).map(function(m){ return (m && m.type) || String(m||''); }); }
function _sgQuestionRun(types){
  var run=0;
  for(var i=types.length-1;i>=0;i--){
    if(typeof coachingTypeIsQuestion==='function' && coachingTypeIsQuestion(types[i])) run++;
    else break;
  }
  return run;
}

/* Candidate scoring — returns {score, reasons:[{text,delta}]} */
function _sgScore(x, ctx){
  var score = 0, reasons = [];
  function add(delta, text){ score += delta; if(text) reasons.push({text:text, delta:delta}); }

  if(ctx.stage){
    if(x.conversationStages.indexOf(ctx.stage)>=0) add(_CS_W.stageMatch, '"'+ctx.stage+'" aşaması için tasarlanmış bir hamle.');
    else if(x.conversationStages.length) add(_CS_W.stageMiss, null);
  }
  if(ctx.purpose && x.purpose===ctx.purpose) add(_CS_W.purposeMatch, 'Aradığın amaçla ("'+ctx.purpose+'") doğrudan eşleşiyor.');
  if(ctx.depth){
    var d = _CS_W.depthBase - Math.abs(x.depth - ctx.depth);
    add(d, d>=2 ? 'İstenen derinlikte.' : null);
  }
  if(ctx.competencyFocus && x.competencyTags.indexOf(ctx.competencyFocus)>=0)
    add(_CS_W.competency, 'Geliştirmek istediğin yetkinliğe dokunuyor.');

  var types = ctx.recentTypes;
  var last = types.length ? types[types.length-1] : null;
  if(last===x.type) add(_CS_W.sameTypeAsLast, null);
  if(types.length>=2 && types[types.length-1]===x.type && types[types.length-2]===x.type)
    add(_CS_W.sameTypeTwice, null);
  if(ctx.usedIds.indexOf(x.id)>=0) add(_CS_W.alreadyUsed, null);
  if(x.purpose && ctx.recentPurposes.indexOf(x.purpose)>=0) add(_CS_W.samePurposeRecent, null);

  var isSpace = COACHING_SPACE_TYPES.indexOf(x.type)>=0;
  if(ctx.questionRun>=2){
    if(isSpace) add(_CS_W.spaceAfterQuestions, 'Son '+ctx.questionRun+' hamle soruydu; burada alan açmak danışanın kendi düşüncesini duymasını sağlar.');
    else if(x.isQuestion) add(_CS_W.questionAfterQuestions, null);
  }
  if(last==='CHALLENGE' && x.type==='CHALLENGE') add(_CS_W.stackedChallenge, null);
  if(ctx.significantRealization){
    if(x.type==='SILENCE'||x.type==='REFLECTION') add(_CS_W.spaceAfterRealization, 'Az önce bir farkındalık doğdu; onu bozmadan bırakmak çoğu zaman yeni bir sorudan güçlüdür.');
    else if(x.isQuestion) add(_CS_W.questionAfterRealization, null);
  }
  if(x.riskLevel==='medium') add(_CS_W.mediumRisk, null);
  return {score:score, reasons:reasons};
}

function coachingSuggestMoves(input){
  input = input || {};
  var notes = [];
  var context = input.context || (input.session && input.session.context) || 'adult';
  var stage = (typeof coachingValidStage==='function' && coachingValidStage(input.stage)) ? input.stage : null;
  var purpose = (typeof coachingValidPurpose==='function' && coachingValidPurpose(input.purpose)) ? input.purpose : null;
  var depth = (input.depth===1||input.depth===2||input.depth===3) ? input.depth : null;

  /* ── 1) Safety first ── */
  var safety = null;
  if(input.session && input.event && typeof coachingSafetyEvaluate==='function'){
    var ev = coachingSafetyEvaluate(input.session, input.event);
    safety = { decision:ev.decision, reasonCode:ev.reasonCode, severity:ev.severity,
               rationale:ev.rationale, nextAction:ev.nextAction, referralGuidance:ev.referralGuidance };
    if(ev.decision==='stop_and_refer')
      return { allowed:false, safety:safety, suggestions:[], considered:0,
        notes:['Güvenlik katmanı bu noktada koçluğa devam edilmemesi gerektiğini belirtti; hamle önerilmiyor.'],
        version:COACHING_SUGGEST_VERSION };
    if(ev.decision==='pause')
      notes.push('Güvenlik katmanı duraklama önerdi: yalnız düşük riskli ve izin gerektirmeyen hamleler listeleniyor.');
  }
  var restricted = !!(safety && safety.decision==='pause');
  var minor = (typeof coachingContextIsMinor==='function') ? coachingContextIsMinor(context) : false;

  /* ── 2) Eligibility — Phase 2 policy is authoritative ── */
  var pool = (typeof coachingInterventionList==='function') ? coachingInterventionList() : [];
  var considered = 0;
  var eligible = pool.filter(function(x){
    if(!x.active) return false;
    if(x.applicableContexts.indexOf(context)<0) return false;
    if(minor && !x.minorSafe) return false;
    if(typeof coachingInterventionAllowed==='function' && !coachingInterventionAllowed(x.id, context).allowed) return false;
    if(restricted && (x.riskLevel!=='low' || x.requiresPermission)) return false;
    considered++;
    return true;
  });

  /* ── 3) Rank ── */
  var types = _sgTypes(input.recentMoves);
  var ctx = {
    stage:stage, purpose:purpose, depth:depth,
    competencyFocus:input.competencyFocus||null,
    recentTypes:types, questionRun:_sgQuestionRun(types),
    recentPurposes:_sgArr(input.recentMoves).map(function(m){ return m && m.purpose; }).filter(Boolean),
    usedIds:_sgArr(input.usedIds).map(String),
    significantRealization: input.significantRealization===true
  };
  var scored = eligible.map(function(x){
    var s = _sgScore(x, ctx);
    return { x:x, score:s.score, reasons:s.reasons };
  });
  scored.sort(function(a,b){
    if(b.score!==a.score) return b.score-a.score;
    if(a.x.order!==b.x.order) return a.x.order-b.x.order;
    return a.x.id<b.x.id?-1:(a.x.id>b.x.id?1:0);
  });

  var top = scored.slice(0, COACHING_SUGGEST_MAX);
  var suggestions = top.map(function(c, i){
    var alt = null;
    for(var j=0;j<scored.length;j++){
      if(scored[j].x.type!==c.x.type){ alt = scored[j]; break; }
    }
    var why = c.reasons.filter(function(r){ return r.text; }).slice(0,2).map(function(r){ return r.text; });
    if(!why.length) why = [ (COACHING_INTERVENTION_TYPES[c.x.type]||{}).intent || 'Mevcut bağlama uygun bir hamle.' ];
    return {
      rank:i+1,
      intervention:{ id:c.x.id, type:c.x.type, isQuestion:c.x.isQuestion, title:c.x.title,
        text:c.x.text||null, purpose:c.x.purpose, depth:c.x.depth, riskLevel:c.x.riskLevel,
        conceptId:c.x.conceptId, requiresPermission:c.x.requiresPermission,
        typeLabel:(COACHING_INTERVENTION_TYPES[c.x.type]||{}).label||c.x.type,
        evidenceGrade:c.x.sourceBasis.typeGrade },
      whyNow: why.join(' '),
      purpose: c.x.purpose || ((COACHING_INTERVENTION_TYPES[c.x.type]||{}).intent||null),
      safety: safety ? {decision:safety.decision, reasonCode:safety.reasonCode} : {decision:'not_evaluated', reasonCode:null},
      alternative: alt ? { id:alt.x.id, type:alt.x.type, typeLabel:(COACHING_INTERVENTION_TYPES[alt.x.type]||{}).label||alt.x.type,
        title:alt.x.title, text:alt.x.text||null } : null,
      _score:c.score
    };
  });

  if(ctx.questionRun>=3) notes.push('Art arda '+ctx.questionRun+' soru soruldu — sorgu örüntüsüne yaklaşıyor.');
  if(!suggestions.length) notes.push('Bu bağlam ve kısıtlarla uygun hamle bulunamadı.');

  return { allowed:true, safety:safety, suggestions:suggestions, considered:considered,
    context:context, stage:stage, notes:notes, version:COACHING_SUGGEST_VERSION };
}

function coachingSuggestSelfCheck(){
  return { version:COACHING_SUGGEST_VERSION, max:COACHING_SUGGEST_MAX,
    spaceTypes:COACHING_SPACE_TYPES.slice(), weights:_CS_W };
}

if(typeof window!=='undefined'){
  window.COACHING_SUGGEST_VERSION=COACHING_SUGGEST_VERSION;
  window.COACHING_SUGGEST_MAX=COACHING_SUGGEST_MAX;
  window.COACHING_SPACE_TYPES=COACHING_SPACE_TYPES;
  window.coachingSuggestMoves=coachingSuggestMoves;
  window.coachingSuggestSelfCheck=coachingSuggestSelfCheck;
}
