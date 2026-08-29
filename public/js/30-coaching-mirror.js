/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 6a: COACH MIRROR
   A private professional mirror, not a grade. It answers "what did I actually
   do?" from evidence the coach already generated — never from a score, never
   from a recording, and never by reading the private note.

   ── THREE EVIDENCE LAYERS, KEPT APART ──
     OBSERVED       what the structured record shows (moves used, commitments,
                    boundary events, completion)
     SELF_REPORTED  what the coach said about their own session
     INFERRED       a cautious reading of the two above — always phrased as a
                    possibility, never as a finding

   ── WHAT IT WILL NOT DO ──
   No transcript, no microphone, no speech-to-text, no LLM, no semantic analysis
   of free text. If the structured evidence cannot support an observation, the
   observation is not made. Silence beats a manufactured criticism.

   ── NO SINGLE SCORE ──
   There is no 72/100 and no "coaching level". Numbers appear only where a count
   makes the evidence understandable ("son 5 görüşmenin 4'ünde"). Thresholds are
   internal; what the coach reads is a sentence they can check.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_MIRROR_VERSION = 1;
var COACHING_EVIDENCE_LAYERS = ['OBSERVED','SELF_REPORTED','INFERRED'];
var COACHING_MIRROR_CATEGORIES = ['LISTENING','QUESTIONING','REFLECTION','SILENCE','AWARENESS',
  'CHALLENGE','CLIENT_AGENCY','ACTION','SESSION_FLOW','METHOD_FLEXIBILITY','BOUNDARIES','SELF_AWARENESS'];
var COACHING_OBSERVATION_TYPES = ['STRENGTH','WATCH','NEUTRAL'];
/* NOT COACHING_CONFIDENCE — that global belongs to the Phase 4 router. */
var COACHING_MIRROR_CONFIDENCE = ['SINIRLI_KANIT','OLUSAN_ORUNTU','DAHA_GUCLU_ORUNTU'];
var COACHING_MIRROR_CONFIDENCE_LABEL = { SINIRLI_KANIT:'Sınırlı kanıt', OLUSAN_ORUNTU:'Oluşan örüntü',
  DAHA_GUCLU_ORUNTU:'Daha güçlü örüntü' };
/* Evidence thresholds. One session describes a session; it never describes a coach. */
var COACHING_PATTERN_MIN_SESSIONS = 3;
var COACHING_STRONG_PATTERN_MIN_SESSIONS = 10;
var COACHING_PATTERN_RATIO = 0.6;

/* Developmental areas. These POINT AT the ICF competency model registered in
   the source library; they are our own wording, and they are not an assessment. */
var COACHING_ICF_AREA = {
  LISTENING:'Aktif dinleme', QUESTIONING:'Farkındalığı güçlendirme',
  REFLECTION:'Aktif dinleme', SILENCE:'Koçluk duruşunu koruma',
  AWARENESS:'Farkındalığı güçlendirme', CHALLENGE:'Koçluk duruşunu koruma',
  CLIENT_AGENCY:'Danışanın gelişimini kolaylaştırma', ACTION:'Danışanın gelişimini kolaylaştırma',
  SESSION_FLOW:'Anlaşmayı kurma ve sürdürme', METHOD_FLEXIBILITY:'Koçluk duruşunu koruma',
  BOUNDARIES:'Etik uygulama', SELF_AWARENESS:'Koçluk duruşunu koruma'
};
var COACHING_ICF_DISCLAIMER =
  'FocusUp bir gelişim aynasıdır; resmî bir ICF değerlendirmesi değildir. Burada seviye, puan veya yeterlilik kararı verilmez.';

function _cmStr(v,max){ return String(v==null?'':v).slice(0,max||400); }
function _cmNow(){ try{ return new Date().toISOString(); }catch(e){ return String(Date.now()); } }
var _cmSeq = 0;
function newCoachingObservationId(){ return 'obs_'+Date.now().toString(36)+'-'+(_cmSeq++).toString(36); }

/* ══ Evidence context — built ONLY from structured records ══ */
function coachingBuildMirrorContext(session, events, extra){
  session = (session && typeof session==='object') ? session : {};
  events = Array.isArray(events) ? events : [];
  extra = extra || {};
  var moves = [], stages = {}, byType = {};
  var realizationMarked = false, questionAfterRealization = false, sawRealization = false;
  var boundary = [], commitmentCorrected = false;
  events.forEach(function(e){
    if(!e || !e.type) return;
    if(e.type==='INTERVENTION_USED'){
      var t = e.interventionType || null;
      moves.push({type:t, purpose:e.purpose||null, stage:e.stage||null, at:e.at||null});
      if(t) byType[t] = (byType[t]||0)+1;
      if(e.stage) stages[e.stage] = true;
      if(sawRealization && typeof coachingTypeIsQuestion==='function' && coachingTypeIsQuestion(t)){
        questionAfterRealization = true; sawRealization = false;
      }else if(sawRealization && t){ sawRealization = false; }
    }else if(e.type==='CONTEXT_UPDATED'){
      if(e.contextKey==='significantRealization'){ realizationMarked = true; sawRealization = true; }
    }else if(e.type==='SAFETY_BOUNDARY_HELD'){
      boundary.push({decision:e.decision||null, reasonCode:e.reasonCode||null});
    }else if(e.type==='COMMITMENT_SOURCE_CORRECTED'){ commitmentCorrected = true; }
  });
  var q = 0, run = 0, maxRun = 0;
  moves.forEach(function(m){
    var isQ = (typeof coachingTypeIsQuestion==='function') && coachingTypeIsQuestion(m.type);
    if(isQ){ q++; run++; if(run>maxRun) maxRun = run; } else run = 0;
  });
  return {
    sessionId: session.id || null,
    context: session.context || null,
    approach: session.approach || null,
    minor: (typeof coachingContextIsMinor==='function') ? coachingContextIsMinor(session.context) : false,
    completed: session.lifecycle==='completed',
    moves: moves, moveCount: moves.length, byType: byType,
    questionCount: q, maxQuestionRun: maxRun,
    reflectionCount: (byType.REFLECTION||0) + (byType.PARAPHRASE||0),
    silenceCount: byType.SILENCE||0, summaryCount: byType.SUMMARY||0,
    challengeCount: byType.CHALLENGE||0, infoCount: byType.PERMISSION_BASED_INFORMATION||0,
    actionCount: byType.ACTION_COMMITMENT||0, affirmCount: byType.AFFIRMATION||0,
    stages: stages,
    realizationMarked: realizationMarked, questionAfterRealization: questionAfterRealization,
    boundaryHeld: boundary, commitmentCorrected: commitmentCorrected,
    coacheeCommitment: extra.coacheeCommitment===true || Number((session.counters||{}).commitments||0)>0,
    insightRecorded: extra.insightRecorded===true,
    coachReflectionRecorded: extra.coachReflectionRecorded===true
  };
}

/* ══ Rule library — bounded, deterministic, evidence-gated ══
   Each rule states what it needs, and produces nothing when it is not there. */
function coachingMirrorRules(){
  return [
  { code:'CLIENT_AGENCY', category:'CLIENT_AGENCY', type:'STRENGTH', layer:'OBSERVED',
    when:function(c){ return c.coacheeCommitment; },
    title:'Eylem danışanın kendi cümlesi oldu',
    describe:function(){ return 'Danışanın kendi eylemini tanımlamasına alan bıraktın.'; },
    basis:function(){ return 'Görüşme, danışana ait bir taahhütle kapandı.'; },
    direction:'Bunu sürdür.' },

  { code:'STRONG_CLOSURE', category:'SESSION_FLOW', type:'STRENGTH', layer:'OBSERVED',
    when:function(c){ return c.completed && c.coacheeCommitment && c.insightRecorded; },
    title:'Kapanış netti',
    describe:function(){ return 'Neyin netleştiği ve danışanın ne yapacağı birlikte kayda geçti.'; },
    basis:function(){ return 'Tamamlanan görüşmede hem içgörü hem danışana ait eylem var.'; },
    direction:'Bunu sürdür.' },

  { code:'SPACE_MAKING', category:'REFLECTION', type:'STRENGTH', layer:'OBSERVED',
    when:function(c){ return c.moveCount>=4 && (c.reflectionCount + c.silenceCount) >= c.questionCount; },
    title:'Soru kadar alan da açtın',
    describe:function(c){ return 'Bu görüşmede '+c.questionCount+' soruya karşılık '+
      (c.reflectionCount + c.silenceCount)+' yansıtma/sessizlik kullandın.'; },
    basis:function(c){ return 'Kullanılan '+c.moveCount+' hamlenin dağılımı.'; },
    direction:'Bunu sürdür.' },

  { code:'REFLECTION_PRACTICE', category:'SELF_AWARENESS', type:'STRENGTH', layer:'SELF_REPORTED',
    when:function(c){ return c.coachReflectionRecorded; },
    title:'Görüşme sonrası kendine baktın',
    describe:function(){ return 'Görüşmenin ardından kendi yansımanı yazdın. Gelişimin asıl yeri burası.'; },
    basis:function(){ return 'Kapanışta koç yansıması kaydedildi.'; },
    direction:'Bunu sürdür.' },

  { code:'BOUNDARY_DISCIPLINE', category:'BOUNDARIES', type:'STRENGTH', layer:'OBSERVED',
    when:function(c){ return c.boundaryHeld.length>0; },
    title:'Koçluk sınırını korudun',
    describe:function(){ return 'Kapsam dışına çıkma ihtimali belirdiğinde devam etmek yerine durdun.'; },
    basis:function(c){ return 'Görüşmede '+c.boundaryHeld.length+' kez sınır kararı uygulandı.'; },
    direction:'Bunu sürdür.' },

  { code:'QUESTION_STACKING', category:'QUESTIONING', type:'WATCH', layer:'INFERRED',
    when:function(c){ return c.maxQuestionRun>=3; },
    title:'Art arda sorular',
    describe:function(c){ return 'Bir bölümde art arda '+c.maxQuestionRun+
      ' soru kullandın. Cevaptan sonra hemen yeni bir soru gelmesi, danışanın kendi düşüncesini duymasını zorlaştırıyor olabilir.'; },
    basis:function(c){ return 'Kullanılan hamlelerde en uzun kesintisiz soru dizisi: '+c.maxQuestionRun+'.'; },
    direction:'Bir sonraki görüşmede önemli bir cevaptan sonra yansıtma veya kısa bir sessizlik denemeyi düşünebilirsin.',
    practice:'PRACTICE_REFLECT_BEFORE_ASKING' },

  { code:'REFLECTION_SCARCITY', category:'REFLECTION', type:'WATCH', layer:'INFERRED',
    when:function(c){ return c.moveCount>=5 && c.reflectionCount===0 && (c.stages.EXPLORING || c.stages.DEEPENING); },
    title:'Yansıtma az kaldı',
    describe:function(){ return 'Keşif/derinleşme bölümünde hiç yansıtma kullanılmamış görünüyor. Yansıtma, danışanın kendi sözünü dışarıdan duymasını sağlıyor.'; },
    basis:function(c){ return 'Kullanılan '+c.moveCount+' hamlenin hiçbiri yansıtma değildi.'; },
    direction:'Bir sonraki görüşmede en az bir kez, soru sormadan önce duyduğunu geri vermeyi dene.',
    practice:'PRACTICE_REFLECT_BEFORE_ASKING' },

  { code:'SILENCE_AVOIDANCE', category:'SILENCE', type:'WATCH', layer:'INFERRED',
    when:function(c){ return c.realizationMarked && c.questionAfterRealization; },
    title:'Farkındalıktan hemen sonra soru',
    describe:function(){ return 'Bir farkındalık işaretlendikten hemen sonra yeni bir soru gelmiş. O an sessizlik, sorudan daha çok iş görüyor olabilir.'; },
    basis:function(){ return 'Farkındalık işaretlendi ve sonraki hamle bir soruydu.'; },
    direction:'Bir sonraki görüşmede farkındalıktan sonra üç saniye beklemeyi dene.',
    practice:'PRACTICE_HOLD_SILENCE' },

  { code:'PREMATURE_ACTION', category:'ACTION', type:'WATCH', layer:'INFERRED',
    when:function(c){ return c.actionCount>=1 && c.moveCount<=3 && !c.stages.AWARENESS && !c.stages.DEEPENING
      && c.approach!=='GROW' && c.approach!=='BEHAVIOUR_CHANGE'; },
    title:'Eyleme erken geçilmiş olabilir',
    describe:function(){ return 'Keşif çok kısayken eylem taahhüdüne geçilmiş görünüyor. Doğru soruna yanlış çözüm bulma riski burada başlıyor.'; },
    basis:function(c){ return 'Toplam '+c.moveCount+' hamle içinde eylem taahhüdü kullanıldı; farkındalık aşaması işaretlenmedi.'; },
    direction:'Eyleme geçmeden önce "buradan ne fark ettin?" diye alan açmayı dene.',
    practice:'PRACTICE_AWARENESS_BEFORE_ACTION' },

  { code:'COACH_OWNED_ACTION_ATTEMPT', category:'CLIENT_AGENCY', type:'WATCH', layer:'OBSERVED',
    when:function(c){ return c.commitmentCorrected; },
    title:'Taahhüt önce koça aitti',
    describe:function(){ return 'Kapanışta eylem önce koç önerisi olarak girildi. Sistem bunu taahhüde çevirmedi — eylemin sahibi danışan olmalı.'; },
    basis:function(){ return 'Kapanışta koça ait bir taahhüt denemesi kaydedildi.'; },
    direction:'Kapanışta eylemi danışanın kendi cümlesiyle söylemesini iste.',
    practice:'PRACTICE_CLIENT_OWNS_ACTION' },

  { code:'CHALLENGE_OVERUSE', category:'CHALLENGE', type:'WATCH', layer:'INFERRED',
    when:function(c){ return c.challengeCount >= (c.context==='executive' ? 3 : 2) && c.reflectionCount===0; },
    title:'Meydan okuma yoğun kalmış olabilir',
    describe:function(){ return 'Meydan okuma arka arkaya kullanılmış ve arada yansıtma yok. Alan bırakılmadığında meydan okuma savunma üretebiliyor.'; },
    basis:function(c){ return c.challengeCount+' meydan okuma, 0 yansıtma.'; },
    direction:'Meydan okumadan sonra bir yansıtma ile alan bırakmayı dene.',
    practice:'PRACTICE_SPACE_AFTER_CHALLENGE' },

  { code:'ADVICE_PRESSURE', category:'CLIENT_AGENCY', type:'WATCH', layer:'INFERRED',
    when:function(c){ return c.infoCount>=2 && c.moveCount<6; },
    title:'Bilgi paylaşımı öne çıkmış olabilir',
    describe:function(){ return 'Kısa bir görüşmede izinli bilgi paylaşımı birden fazla kez kullanılmış. Koçluk, bilgi vermekten önce alan açmak.'; },
    basis:function(c){ return c.moveCount+' hamlede '+c.infoCount+' kez bilgi paylaşımı.'; },
    direction:'Bilgi vermeden önce danışanın ne bildiğini sormayı dene.',
    practice:'PRACTICE_ELICIT_BEFORE_INFORM' },

  { code:'QUESTION_DOMINANCE', category:'QUESTIONING', type:'NEUTRAL', layer:'OBSERVED',
    when:function(c){ return c.moveCount>=5 && c.questionCount/c.moveCount >= 0.75; },
    title:'Görüşme soru ağırlıklı geçti',
    describe:function(c){ return 'Kullanılan '+c.moveCount+' hamlenin '+c.questionCount+
      ' tanesi soruydu. Bu tek başına iyi ya da kötü değil — bağlama göre değişir.'; },
    basis:function(c){ return 'Hamle dağılımı: '+c.questionCount+' soru / '+c.moveCount+' toplam.'; },
    direction:'Bir sonraki görüşmede dağılımın bilinçli bir seçim olup olmadığına bak.' }
  ];
}

/* ══ Session mirror ══ */
function coachingSessionMirror(session, events, extra){
  var c = coachingBuildMirrorContext(session, events, extra);
  var out = [];
  if(c.moveCount===0 && !c.coacheeCommitment && !c.coachReflectionRecorded && !c.boundaryHeld.length){
    return { sessionId:c.sessionId, observations:[], insufficientEvidence:true,
      note:'Bu görüşmede ayna için yeterli yapılandırılmış kanıt yok. Hamleleri "Kullandım" ile işaretlersen bir sonraki sefer daha çok şey görebiliriz.',
      version:COACHING_MIRROR_VERSION };
  }
  coachingMirrorRules().forEach(function(r){
    var hit = false; try{ hit = r.when(c); }catch(e){ hit = false; }
    if(!hit) return;
    out.push({
      id:newCoachingObservationId(), sessionId:c.sessionId, code:r.code, category:r.category,
      evidenceLayer:r.layer, observationType:r.type,
      title:r.title, description:_cmStr(r.describe(c)),
      evidenceText:_cmStr(r.basis(c), 240), evidenceRefs:[c.sessionId],
      confidence:'SINIRLI_KANIT', developmentDirection:_cmStr(r.direction||'', 240),
      practiceSuggestion:r.practice||null,
      competencyTags:[r.category], icfArea:COACHING_ICF_AREA[r.category]||null,
      sessionCount:1, createdAt:_cmNow(), sourceVersion:COACHING_MIRROR_VERSION
    });
  });
  var strengths = out.filter(function(o){ return o.observationType==='STRENGTH'; });
  var watch = out.filter(function(o){ return o.observationType==='WATCH'; });
  return { sessionId:c.sessionId, observations:out, strengths:strengths, watch:watch,
    neutral:out.filter(function(o){ return o.observationType==='NEUTRAL'; }),
    insufficientEvidence:false, context:c, version:COACHING_MIRROR_VERSION };
}
/* Compact summary stored on the session doc so the development view needs one query. */
function coachingMirrorSummary(mirror){
  var obs = (mirror && mirror.observations) || [];
  return { version:COACHING_MIRROR_VERSION, generatedAt:_cmNow(),
    codes:obs.map(function(o){ return o.code; }),
    strengths:obs.filter(function(o){ return o.observationType==='STRENGTH'; }).length,
    watch:obs.filter(function(o){ return o.observationType==='WATCH'; }).length,
    practiceCode:(obs.filter(function(o){ return o.practiceSuggestion; })[0]||{}).practiceSuggestion||null };
}

/* ══ Cross-session patterns ══ conservative by construction. */
function coachingCrossSessionMirror(sessions){
  var list = (Array.isArray(sessions) ? sessions : []).filter(function(s){
    return s && s.mirror && Array.isArray(s.mirror.codes) && s.mirror.version;
  });
  var n = list.length;
  var base = { sessionCount:n, observations:[], version:COACHING_MIRROR_VERSION };
  if(n < COACHING_PATTERN_MIN_SESSIONS){
    base.note = n===0 ? 'Henüz değerlendirme için tamamlanmış görüşme yok.'
      : 'Şu ana kadar '+n+' görüşme var. Örüntüden söz etmek için en az '+
        COACHING_PATTERN_MIN_SESSIONS+' görüşme gerekiyor — tek görüşme bir koçu anlatmaz.';
    return base;
  }
  var conf = n >= COACHING_STRONG_PATTERN_MIN_SESSIONS ? 'DAHA_GUCLU_ORUNTU' : 'OLUSAN_ORUNTU';
  var counts = {};
  list.forEach(function(s){ s.mirror.codes.forEach(function(code){ counts[code] = (counts[code]||0)+1; }); });
  var rules = {};
  coachingMirrorRules().forEach(function(r){ rules[r.code] = r; });
  Object.keys(counts).sort().forEach(function(code){
    var hits = counts[code];
    if(hits/n < COACHING_PATTERN_RATIO) return;
    var r = rules[code]; if(!r) return;
    base.observations.push({
      id:newCoachingObservationId(), sessionId:null, code:code, category:r.category,
      evidenceLayer:'INFERRED', observationType:r.type, title:r.title,
      description: (r.type==='STRENGTH')
        ? ('Son '+n+' görüşmenin '+hits+' tanesinde bu görüldü. Bu, koruman gereken bir tarafın olabilir.')
        : ('Son '+n+' görüşmenin '+hits+' tanesinde bu göze çarptı. Tekrar eden bir örüntü oluşuyor olabilir.'),
      evidenceText:'Son '+n+' uygun görüşmenin '+hits+"'inde.",
      evidenceRefs:list.map(function(s){ return s.id; }).slice(0,20),
      confidence:conf, developmentDirection:_cmStr(r.direction||''),
      practiceSuggestion:r.practice||null, competencyTags:[r.category],
      icfArea:COACHING_ICF_AREA[r.category]||null, sessionCount:n,
      createdAt:_cmNow(), sourceVersion:COACHING_MIRROR_VERSION });
  });
  /* method rigidity / flexibility — approach spread, never from one session */
  var approaches = list.map(function(s){ return s.approach; }).filter(Boolean);
  if(approaches.length >= COACHING_PATTERN_MIN_SESSIONS){
    var byA = {}; approaches.forEach(function(a){ byA[a] = (byA[a]||0)+1; });
    var keys = Object.keys(byA), top = keys.sort(function(a,b){ return byA[b]-byA[a]; })[0];
    if(byA[top]/approaches.length >= 0.8 && keys.length===1){
      base.observations.push(_cmPattern('METHOD_RIGIDITY','METHOD_FLEXIBILITY','WATCH',
        'Tek çerçevede kalıyor olabilirsin',
        'Son '+approaches.length+' görüşmenin tamamında aynı yaklaşım kullanıldı. Yaklaşım, danışanın durumuna göre değişebilir.',
        'Son '+approaches.length+' görüşmede tek yaklaşım.', conf, n,
        'Bir sonraki görüşmede önerilen ikincil merceğe de bak.'));
    }else if(keys.length>=3){
      base.observations.push(_cmPattern('APPROACH_FLEXIBILITY','METHOD_FLEXIBILITY','STRENGTH',
        'Yaklaşımını duruma göre değiştiriyorsun',
        'Son görüşmelerde '+keys.length+' farklı yaklaşım kullanılmış. Tek şablonda kalmamışsın.',
        keys.length+' farklı yaklaşım.', conf, n, 'Bunu sürdür.'));
    }
  }
  return base;
}
function _cmPattern(code, category, type, title, description, evidenceText, conf, n, direction){
  return { id:newCoachingObservationId(), sessionId:null, code:code, category:category,
    evidenceLayer:'INFERRED', observationType:type, title:title, description:description,
    evidenceText:evidenceText, evidenceRefs:[], confidence:conf,
    developmentDirection:direction||'', practiceSuggestion:null, competencyTags:[category],
    icfArea:COACHING_ICF_AREA[category]||null, sessionCount:n,
    createdAt:_cmNow(), sourceVersion:COACHING_MIRROR_VERSION };
}

/* ══ Change over time — a difference, never a causal claim ══ */
function coachingMirrorTrend(sessions, code){
  var list = (Array.isArray(sessions) ? sessions : []).filter(function(s){ return s && s.mirror && s.mirror.version; });
  if(list.length < 4) return null;
  var half = Math.floor(list.length/2);
  var older = list.slice(0, half), recent = list.slice(list.length-half);
  var inOlder = older.filter(function(s){ return s.mirror.codes.indexOf(code)>=0; }).length;
  var inRecent = recent.filter(function(s){ return s.mirror.codes.indexOf(code)>=0; }).length;
  if(inOlder===inRecent) return null;
  return { code:code, older:inOlder, recent:inRecent, olderOf:older.length, recentOf:recent.length,
    direction: inRecent<inOlder ? 'azaldı' : 'arttı',
    text:'Önceki '+older.length+' görüşmenin '+inOlder+"'inde, son "+recent.length+' görüşmenin '+
      inRecent+"'inde görüldü. Bir değişim görülüyor." };
}

/* ══ ICF developmental view — areas, never a verdict ══ */
function coachingIcfDevelopmentView(observations){
  var obs = Array.isArray(observations) ? observations : [];
  var areas = {};
  Object.keys(COACHING_ICF_AREA).forEach(function(cat){
    var a = COACHING_ICF_AREA[cat];
    if(!areas[a]) areas[a] = { area:a, strengths:[], practiceAreas:[], evidenceCount:0, categories:[] };
    if(areas[a].categories.indexOf(cat)<0) areas[a].categories.push(cat);
  });
  obs.forEach(function(o){
    var a = o.icfArea || COACHING_ICF_AREA[o.category];
    if(!a || !areas[a]) return;
    areas[a].evidenceCount++;
    if(o.observationType==='STRENGTH'){ if(areas[a].strengths.indexOf(o.title)<0) areas[a].strengths.push(o.title); }
    else if(o.observationType==='WATCH'){ if(areas[a].practiceAreas.indexOf(o.title)<0) areas[a].practiceAreas.push(o.title); }
  });
  return { areas:Object.keys(areas).sort().map(function(k){ return areas[k]; }),
    disclaimer:COACHING_ICF_DISCLAIMER, version:COACHING_MIRROR_VERSION };
}

function coachingMirrorSelfCheck(){
  return { version:COACHING_MIRROR_VERSION, layers:COACHING_EVIDENCE_LAYERS.slice(),
    categories:COACHING_MIRROR_CATEGORIES.slice(), types:COACHING_OBSERVATION_TYPES.slice(),
    confidence:COACHING_MIRROR_CONFIDENCE.slice(), ruleCount:coachingMirrorRules().length,
    patternMin:COACHING_PATTERN_MIN_SESSIONS, strongPatternMin:COACHING_STRONG_PATTERN_MIN_SESSIONS,
    transcriptAnalysis:false, privateNoteAnalysis:false, singleScore:false };
}

if(typeof window!=='undefined'){
  window.COACHING_MIRROR_VERSION=COACHING_MIRROR_VERSION;
  window.COACHING_EVIDENCE_LAYERS=COACHING_EVIDENCE_LAYERS;
  window.COACHING_MIRROR_CATEGORIES=COACHING_MIRROR_CATEGORIES;
  window.COACHING_OBSERVATION_TYPES=COACHING_OBSERVATION_TYPES;
  window.COACHING_MIRROR_CONFIDENCE=COACHING_MIRROR_CONFIDENCE;
  window.COACHING_MIRROR_CONFIDENCE_LABEL=COACHING_MIRROR_CONFIDENCE_LABEL;
  window.COACHING_ICF_AREA=COACHING_ICF_AREA; window.COACHING_ICF_DISCLAIMER=COACHING_ICF_DISCLAIMER;
  window.COACHING_PATTERN_MIN_SESSIONS=COACHING_PATTERN_MIN_SESSIONS;
  window.COACHING_STRONG_PATTERN_MIN_SESSIONS=COACHING_STRONG_PATTERN_MIN_SESSIONS;
  window.newCoachingObservationId=newCoachingObservationId;
  window.coachingBuildMirrorContext=coachingBuildMirrorContext;
  window.coachingMirrorRules=coachingMirrorRules; window.coachingSessionMirror=coachingSessionMirror;
  window.coachingMirrorSummary=coachingMirrorSummary; window.coachingCrossSessionMirror=coachingCrossSessionMirror;
  window.coachingMirrorTrend=coachingMirrorTrend; window.coachingIcfDevelopmentView=coachingIcfDevelopmentView;
  window.coachingMirrorSelfCheck=coachingMirrorSelfCheck;
}
