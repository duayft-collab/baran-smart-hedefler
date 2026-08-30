/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 7d: ACADEMY ENGINE

   Learning state, recommendations and knowledge checks.

   The recommendation engine is deterministic and explainable by construction:
   every suggestion carries the structured evidence that produced it, phrased
   at the confidence that evidence actually supports. One session says "in this
   session"; it never says "you are a poor listener". There is no model here,
   no embedding, no semantic reading of anything the coach wrote privately —
   the inputs are Mirror observation CODES, the active practice, and the
   coach's own learning state. Nothing else.
   ══════════════════════════════════════════════════════════════════════════ */

var ACADEMY_DEV_KINDS = { unit:'academy_unit', reflection:'academy_reflection', check:'academy_check' };
var ACADEMY_MAX_RECOMMENDATIONS = 3;
var ACADEMY_REFLECTION_MAX = 600;

function _aeStr(v,max){ return String(v==null?'':v).slice(0, max||240); }
function _aeNow(){ try{ return new Date().toISOString(); }catch(e){ return String(Date.now()); } }
var _aeSeq = 0;
function academyRecordId(prefix){
  return (prefix||'acd')+'_'+Date.now().toString(36)+'-'+(_aeSeq++).toString(36);
}

/* ── Learning state ──
   A record per unit. The machine never invents progress: only a coach action
   moves a unit forward, and there is no state that means "mastered". */
function academyCanTransition(from, to){
  if(ACADEMY_STATES.indexOf(to)<0) return false;
  if(!from || from===to) return ACADEMY_STATES.indexOf(to)>=0;
  var allowed = ACADEMY_TRANSITIONS[from] || [];
  return allowed.indexOf(to)>=0;
}
function academyBuildUnitState(unitId, state, extra){
  extra = extra || {};
  var u = academyUnit(unitId);
  if(!u) return null;
  if(ACADEMY_STATES.indexOf(state)<0) return null;
  return {
    id: 'acu_'+u.unitId,                 /* stable: one record per unit, overwritten */
    kind: ACADEMY_DEV_KINDS.unit,
    unitId: u.unitId,
    unitVersion: u.version,
    state: state,
    practiceCode: extra.practiceCode ? _aeStr(extra.practiceCode,64) : null,
    appliedSelfReport: ['EVET','KISMEN','HAYIR'].indexOf(extra.appliedSelfReport)>=0
      ? extra.appliedSelfReport : null,
    /* a self-report is a claim by the coach, never a measurement */
    selfReported: extra.appliedSelfReport ? true : false,
    updatedAt: _aeNow()
  };
}
function academyUnitStateOf(records, unitId){
  var list = (records||[]).filter(function(r){
    return r && r.kind===ACADEMY_DEV_KINDS.unit && r.unitId===unitId; });
  if(!list.length) return 'NOT_STARTED';
  list.sort(function(a,b){ return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return ACADEMY_STATES.indexOf(list[0].state)>=0 ? list[0].state : 'NOT_STARTED';
}
function academyStateMap(records){
  var out = {};
  ACADEMY_UNIT_ORDER.forEach(function(id){ out[id] = academyUnitStateOf(records, id); });
  return out;
}
/* A short, optional, private note the coach writes to themselves. */
function academyBuildReflection(unitId, text){
  var u = academyUnit(unitId);
  var body = _aeStr(text, ACADEMY_REFLECTION_MAX);
  if(!u || !body.trim()) return null;
  return { id: academyRecordId('acr'), kind: ACADEMY_DEV_KINDS.reflection,
    unitId: u.unitId, body: body, updatedAt: _aeNow() };
}

/* ── Progress, honestly described ──
   Counts of what the coach has done. Not a percentage of competence. */
function academyProgress(records){
  var map = academyStateMap(records);
  var out = { total: ACADEMY_UNIT_ORDER.length, started:0, reviewed:0, practicing:0, applied:0, revisit:0 };
  ACADEMY_UNIT_ORDER.forEach(function(id){
    var s = map[id];
    if(s!=='NOT_STARTED') out.started++;
    if(s==='REVIEWED') out.reviewed++;
    if(s==='PRACTICING') out.practicing++;
    if(s==='APPLIED') out.applied++;
    if(s==='REVISIT') out.revisit++;
  });
  return out;
}

/* ── Evidence, gathered from what already exists ──
   Mirror observation codes and their session spread. No note text, no
   transcript, no inference about the person. */
function academyGatherEvidence(observations, records, activePractice){
  var byCode = {};
  (observations||[]).forEach(function(o){
    if(!o || !o.code) return;
    var k = o.code;
    if(!byCode[k]) byCode[k] = { code:k, category:o.category||null, type:o.observationType||'NEUTRAL',
      sessions:{}, count:0 };
    byCode[k].count++;
    if(o.sessionId) byCode[k].sessions[o.sessionId] = true;
  });
  var codes = Object.keys(byCode).map(function(k){
    var e = byCode[k];
    e.sessionCount = Object.keys(e.sessions).length || e.count;
    delete e.sessions;
    return e;
  });
  /* a disputed observation is the coach saying "that is not what happened" —
     it must not keep driving recommendations */
  var disputed = {};
  (records||[]).forEach(function(r){
    if(r && r.kind==='feedback' && r.observationCode) disputed[r.observationCode] = true; });
  return { codes: codes.filter(function(e){ return !disputed[e.code]; }),
    disputedCodes: Object.keys(disputed),
    activePractice: activePractice || null };
}

/* Confidence language follows the Phase 6 thresholds exactly: one session is
   an event, three is a pattern forming, ten is a pattern that has held. */
function academyEvidenceLanguage(sessionCount){
  var min = (typeof COACHING_PATTERN_MIN_SESSIONS!=='undefined') ? COACHING_PATTERN_MIN_SESSIONS : 3;
  var strong = (typeof COACHING_STRONG_PATTERN_MIN_SESSIONS!=='undefined') ? COACHING_STRONG_PATTERN_MIN_SESSIONS : 10;
  var n = Number(sessionCount)||0;
  /* Each band writes its own whole sentence. Stitching one lead onto a shared
     tail produced sentences that were technically accurate and unreadable —
     and an explanation the coach cannot read explains nothing. */
  if(n >= strong) return { band:'DAHA_GUCLU_ORUNTU', lead:'Aynı eğilim birden fazla görüşmede görülüyor',
    phrase:function(code){ return 'Aynı eğilim '+n+' görüşmede görüldüğü için ("'+code+'") bu çalışmayı öneriyoruz.'; } };
  if(n >= min) return { band:'OLUSAN_ORUNTU', lead:'Son görüşmelerinde',
    phrase:function(code){ return 'Son görüşmelerinde "'+code+'" gözlemi '+n+' görüşmede kaydedildiği için bu çalışmayı öneriyoruz.'; } };
  return { band:'SINIRLI_KANIT', lead:'Bu görüşmede',
    phrase:function(code){ return 'Bu görüşmede "'+code+'" gözlemi kaydedildiği için bu çalışmayı öneriyoruz.'; } };
}

/* Which unit answers which observation. A mapping, deliberately explicit —
   an opaque scoring function could not be explained to the coach. */
var ACADEMY_CODE_UNIT = {
  QUESTION_STACKING:'CORE_QUESTIONS', INTERROGATION_RISK:'CORE_QUESTIONS',
  LEADING_RISK:'ADV_COACH_AGENDA', ADVICE_RISK:'CORE_NO_ADVICE',
  PREMATURE_ACTION:'CORE_AWARENESS', LOW_REFLECTION:'CORE_REFLECTION',
  SILENCE_AVOIDANCE:'CORE_SILENCE', NO_COACHEE_COMMITMENT:'CRAFT_ACTION',
  COACH_OWNED_ACTION:'FND_AGENCY', WEAK_CLOSURE:'CRAFT_CLOSING',
  NO_REFLECTION_RECORDED:'ADV_REFLECTIVE', METHOD_RIGIDITY:'METHOD_OVERVIEW',
  SAFETY_BOUNDARY_HELD:'CTX_SCOPE_BOUNDARY',
  CLIENT_AGENCY:'CORE_CHALLENGE', STRONG_CLOSURE:'CRAFT_DEEPENING',
  REFLECTION_PRACTICE:'ADV_PRESENCE'
};
/* When a mirror category is implicated but no specific code maps, fall back
   to the category's home unit. */
var ACADEMY_CATEGORY_UNIT = {
  LISTENING:'CORE_LISTENING', QUESTIONING:'CORE_QUESTIONS', REFLECTION:'CORE_REFLECTION',
  SILENCE:'CORE_SILENCE', AWARENESS:'CORE_AWARENESS', CHALLENGE:'CORE_CHALLENGE',
  CLIENT_AGENCY:'FND_AGENCY', ACTION:'CRAFT_ACTION', SESSION_FLOW:'CRAFT_OPENING',
  METHOD_FLEXIBILITY:'METHOD_OVERVIEW', BOUNDARIES:'CTX_SCOPE_BOUNDARY',
  SELF_AWARENESS:'ADV_REFLECTIVE'
};

/* ── Recommendations ──
   Deterministic: same evidence in, same list out, in the same order. Capped at
   three. Every item explains itself in the coach's language. */
function academyRecommend(evidence, records, opts){
  opts = opts || {};
  evidence = evidence || { codes:[] };
  var states = academyStateMap(records);
  var dismissed = {};
  (records||[]).forEach(function(r){
    if(r && r.kind===ACADEMY_DEV_KINDS.unit && r.dismissedRecommendation) dismissed[r.unitId] = true; });
  (opts.dismissed||[]).forEach(function(id){ dismissed[id] = true; });

  var out = [], seen = {};
  function push(unitId, reason, why, weight, band){
    if(!unitId || seen[unitId] || dismissed[unitId]) return;
    var u = academyUnit(unitId);
    if(!u) return;
    if(states[unitId]==='APPLIED' && weight < 90) return;   /* already tried it for real */
    seen[unitId] = true;
    out.push({ unitId:unitId, title:u.title, shortTitle:u.shortTitle,
      reason:reason, why:why, weight:weight, confidence:band||'SINIRLI_KANIT' });
  }

  /* 1. an active deliberate practice is the coach's current focus — it wins */
  var ap = evidence.activePractice;
  if(ap && ap.code){
    var pu = ACADEMY_CODE_UNIT[ap.code] || null;
    if(!pu && ap.focusArea) pu = ACADEMY_CATEGORY_UNIT[ap.focusArea] || null;
    if(pu) push(pu, 'Şu an üzerinde çalıştığın pratikle ilgili.',
      'Aktif pratiğin "'+_aeStr(ap.title||ap.code,80)+'" olduğu için bu çalışmayı öneriyoruz.',
      100, 'SINIRLI_KANIT');
  }

  /* 2. watch-type observations, strongest evidence first */
  var watch = evidence.codes.filter(function(e){ return e.type==='WATCH'; })
    .sort(function(a,b){
      if(b.sessionCount!==a.sessionCount) return b.sessionCount-a.sessionCount;
      return String(a.code).localeCompare(String(b.code));       /* stable tie-break */
    });
  watch.forEach(function(e){
    var lang = academyEvidenceLanguage(e.sessionCount);
    var unitId = ACADEMY_CODE_UNIT[e.code] || ACADEMY_CATEGORY_UNIT[e.category];
    push(unitId, lang.lead+' dikkat çeken bir örüntü var.',
      lang.phrase(_aeStr(e.code,48)), 50 + e.sessionCount, lang.band);
  });

  /* 3. a strength is worth deepening, not only a gap */
  var strengths = evidence.codes.filter(function(e){ return e.type==='STRENGTH'; })
    .sort(function(a,b){
      if(b.sessionCount!==a.sessionCount) return b.sessionCount-a.sessionCount;
      return String(a.code).localeCompare(String(b.code));
    });
  strengths.forEach(function(e){
    var lang = academyEvidenceLanguage(e.sessionCount);
    var unitId = ACADEMY_CODE_UNIT[e.code] || ACADEMY_CATEGORY_UNIT[e.category];
    push(unitId, 'Güçlü olduğun alanı derinleştirmek için.',
      (lang.band==='SINIRLI_KANIT'
        ? 'Bu görüşmede "'+_aeStr(e.code,48)+'" güçlü yönü göründüğü için bunun üzerine giden çalışmayı öneriyoruz.'
        : 'Son görüşmelerinde "'+_aeStr(e.code,48)+'" güçlü yönü '+e.sessionCount+' görüşmede göründüğü için bunun üzerine giden çalışmayı öneriyoruz.'),
      20 + e.sessionCount, lang.band);
  });

  /* 4. with no evidence at all, teach the beginning — and say so plainly */
  if(!out.length){
    var path = academyPath('PATH_FOUNDATION');
    var first = (path ? path.unitIds : []).filter(function(id){ return states[id]==='NOT_STARTED'; })[0];
    if(first) push(first, 'Başlangıç için.',
      'Henüz görüşme kanıtı yok; profesyonel temelden başlamanı öneriyoruz.', 10, 'SINIRLI_KANIT');
  }
  out.sort(function(a,b){
    if(b.weight!==a.weight) return b.weight-a.weight;
    return String(a.unitId).localeCompare(String(b.unitId));
  });
  return out.slice(0, ACADEMY_MAX_RECOMMENDATIONS);
}

/* ── Knowledge checks ──
   Scenario judgement, never trivia and never a score. A wrong answer is a
   place to explain something, so every option carries its own reasoning. */
var ACADEMY_CHECKS = {};
function academyRegisterCheck(checkId, def){
  def = def || {};
  var c = { checkId:_aeStr(checkId,64), unitId:_aeStr(def.unitId,64),
    scenario:_aeStr(def.scenario,400), question:_aeStr(def.question,240),
    options:(def.options||[]).slice(0,4).map(function(o,i){
      return { key:String.fromCharCode(65+i), text:_aeStr(o.text,240),
        best:o.best===true, why:_aeStr(o.why,320) }; }) };
  ACADEMY_CHECKS[c.checkId] = c;
  return c;
}
function academyCheck(checkId){ return ACADEMY_CHECKS[checkId] || null; }
function academyChecksFor(unitId){
  return Object.keys(ACADEMY_CHECKS).map(function(k){ return ACADEMY_CHECKS[k]; })
    .filter(function(c){ return c.unitId===unitId; });
}
function academyAnswerCheck(checkId, key){
  var c = academyCheck(checkId);
  if(!c) return null;
  var chosen = c.options.filter(function(o){ return o.key===key; })[0] || null;
  var best = c.options.filter(function(o){ return o.best; })[0] || null;
  return { checkId:c.checkId, chosen:chosen, best:best,
    /* no score, no pass/fail — the explanation IS the outcome */
    explanation: chosen ? chosen.why : '', bestExplanation: best ? best.why : '' };
}

academyRegisterCheck('CHK_AMBIVALENCE', {
  unitId:'METHOD_AMBIVALENCE',
  scenario:'Danışan şöyle diyor: "İşten ayrılmam gerektiğini biliyorum ama sürekli kalmak için sebep buluyorum."',
  question:'Danışanın sahipliğini korurken kararsızlığı en iyi hangi yanıt açar?',
  options:[
    {text:'"Kalmanın sana ne kazandırdığını da konuşalım mı?"', best:true,
     why:'Kararsızlığın iki tarafını da eşit merakla açar. Danışan kendi gerekçelerini duyduğunda karar kendisine ait kalır.'},
    {text:'"Ayrılmanın avantajlarını sıralayalım."', best:false,
     why:'Tek tarafı güçlendirmek genellikle karşı tarafı savunmaya iter; ikna girişimi kararsızlığı derinleştirebilir.'},
    {text:'"Neden hâlâ karar veremiyorsun?"', best:false,
     why:'"Neden" burada savunma çağırır ve kararsızlığı bir kusur gibi konumlar; oysa kararsızlık değişimin normal bir aşamasıdır.'},
    {text:'"Bence ayrılmalısın."', best:false,
     why:'Tavsiye, kararın sahipliğini koça taşır ve danışanın kendi gerekçesini üretmesini engeller.'}] });

academyRegisterCheck('CHK_ADVICE', {
  unitId:'CORE_NO_ADVICE',
  scenario:'Danışan bir süredir zorlandığı bir konuyu anlatıyor ve sustu.',
  question:'Hangi yanıt danışanın düşünme alanını en iyi korur?',
  options:[
    {text:'Beklemek.', best:true,
     why:'Sessizlik çoğu zaman düşünmenin kendisidir; boşluğu doldurmamak danışanın kendi çıkarımına alan bırakır.'},
    {text:'"Şunu denedin mi?" diye sormak.', best:false,
     why:'Soru kılığında tavsiyedir: tek bir yolu masaya koyar ve danışanın seçenek üretmesini durdurur.'},
    {text:'Benzer bir deneyimini anlatmak.', best:false,
     why:'Konuşmanın merkezini koça taşır. Deneyim paylaşımı yasak değildir ama izinle ve kısa olmalıdır.'},
    {text:'Konuyu özetleyip yeni bir başlık açmak.', best:false,
     why:'Sessizliği erken kapatır ve henüz olgunlaşmamış bir farkındalığı bastırabilir.'}] });

academyRegisterCheck('CHK_SCOPE', {
  unitId:'CTX_SCOPE_BOUNDARY',
  scenario:'Danışan, birkaç aydır uyuyamadığını, çoğu gün işe gidemediğini ve kendine zarar vermeyi düşündüğünü söylüyor.',
  question:'Koç olarak doğru adım nedir?',
  options:[
    {text:'Koçluğu durdurup onaylı güvenlik ve yönlendirme yolunu izlemek.', best:true,
     why:'Bu bir kırmızı bölge sinyalidir. Koçluk burada devam etmez; danışanın güvenliği ve uygun profesyonel desteğe erişimi önceliklidir.'},
    {text:'Hedef belirleyerek uyku düzenini koçlukla çalışmak.', best:false,
     why:'Belirti üzerinden koçluk yapmak, yetkinlik sınırının dışına çıkmak ve riski görmezden gelmektir.'},
    {text:'"Bu kaygı bozukluğu olabilir" deyip birlikte çalışmak.', best:false,
     why:'Bu bir teşhis dilidir ve koçun yetkisi dışındadır; ayrıca kırmızı bölgede koçluğa devam etmeyi meşrulaştırır.'},
    {text:'Biraz daha konuşup görüşme sonunda karar vermek.', best:false,
     why:'Kırmızı bölgede erteleme güvenli değildir; sinyal fark edildiği anda güvenlik yolu izlenir.'}] });

if(typeof window!=='undefined'){
  window.ACADEMY_DEV_KINDS=ACADEMY_DEV_KINDS; window.ACADEMY_MAX_RECOMMENDATIONS=ACADEMY_MAX_RECOMMENDATIONS;
  window.ACADEMY_REFLECTION_MAX=ACADEMY_REFLECTION_MAX; window.ACADEMY_CHECKS=ACADEMY_CHECKS;
  window.ACADEMY_CODE_UNIT=ACADEMY_CODE_UNIT; window.ACADEMY_CATEGORY_UNIT=ACADEMY_CATEGORY_UNIT;
  window.academyRecordId=academyRecordId; window.academyCanTransition=academyCanTransition;
  window.academyBuildUnitState=academyBuildUnitState; window.academyUnitStateOf=academyUnitStateOf;
  window.academyStateMap=academyStateMap; window.academyBuildReflection=academyBuildReflection;
  window.academyProgress=academyProgress; window.academyGatherEvidence=academyGatherEvidence;
  window.academyEvidenceLanguage=academyEvidenceLanguage; window.academyRecommend=academyRecommend;
  window.academyRegisterCheck=academyRegisterCheck; window.academyCheck=academyCheck;
  window.academyChecksFor=academyChecksFor; window.academyAnswerCheck=academyAnswerCheck;
}
