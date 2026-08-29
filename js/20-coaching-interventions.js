/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 3a: CANONICAL INTERVENTION REGISTRY
   One registry for every coaching move. A QUESTION IS A SUBTYPE, not a
   separate world: intervention.type === 'OPEN_QUESTION'. There is no parallel
   question schema, so the ranking engine can compare a reflection and a
   question on the same terms and can answer "do not ask another question yet".

   Methodology-neutral by design: the stage model is not GROW, and no approach
   content lives here — Phase 4 maps GROW / Solution-Focused / MI onto these
   primitives via compatibleApproaches.

   Evidence grading attaches to the MOVE TYPE and the principle behind it, never
   to an individual sentence: no wording in this product is claimed to be
   experimentally validated.

   Every registration goes through the Phase 2 policy mechanism, so nothing
   silently becomes child-safe. Pure data + pure functions; no I/O.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_INTERVENTION_SCHEMA_VERSION = 1;

/* ── Conversation stages — methodology-neutral ── */
var COACHING_STAGES = ['OPENING','CONTRACTING','EXPLORING','DEEPENING','AWARENESS',
  'OPTIONS','COMMITMENT','CLOSING','FOLLOW_UP'];
function coachingValidStage(s){ return COACHING_STAGES.indexOf(s)>=0; }

/* ── Question purpose taxonomy — small enough to reason about ── */
var COACHING_PURPOSES = ['CONTRACT','GOAL','CLARIFY','REALITY','EMOTION','VALUE','ASSUMPTION',
  'MEANING','PERSPECTIVE','STRENGTH','RESOURCE','EXCEPTION','POSSIBILITY','OPTION','DECISION',
  'OWNERSHIP','ACTION','ACCOUNTABILITY','LEARNING','FOLLOW_UP','CLOSURE'];
function coachingValidPurpose(p){ return COACHING_PURPOSES.indexOf(p)>=0; }

/* ── Depth: 1 surface / 2 working / 3 deep ── */
var COACHING_DEPTHS = [1,2,3];
var COACHING_RISK_LEVELS = ['low','medium','high'];

/* ── Evidence grading. Attaches to the TYPE and the principle, not to wording. ── */
var COACHING_EVIDENCE_GRADES = {
  A:'Güçlü profesyonel/araştırma temeli',
  B:'Yerleşik, kabul görmüş çerçeve',
  C:'Uygulayıcı aracı, sınırlı kanıt',
  D:'Temel olarak uygun değil'
};
function coachingValidGrade(g){ return Object.prototype.hasOwnProperty.call(COACHING_EVIDENCE_GRADES,g); }

/* ── The 12 canonical move types ── */
var COACHING_INTERVENTION_TYPES = {};
function _cit(key, def){
  COACHING_INTERVENTION_TYPES[key] = {
    key:key, label:def.label, isQuestion:def.isQuestion===true,
    defaultDepth:def.defaultDepth, defaultRisk:def.defaultRisk||'low',
    intent:def.intent,
    evidence:{ grade:def.grade, sourceIds:def.sourceIds||[], principleIds:def.principleIds||[],
      note:'Kanıt derecesi bu HAMLE TÜRÜ ve arkasındaki ilke içindir; tek tek cümlelerin deneysel olarak doğrulandığı iddia edilmez.' }
  };
}
_cit('OPEN_QUESTION', {label:'Açık Soru', isQuestion:true, defaultDepth:2, grade:'A', sourceIds:['icf.competencies'],
  intent:'Danışanın kendi düşüncesini genişletmesi için alan açar.'});
_cit('REFLECTION', {label:'Yansıtma', defaultDepth:2, grade:'A', sourceIds:['icf.competencies'],
  intent:'Söyleneni geri verir; danışan kendi sözünü dışarıdan duyar.'});
_cit('PARAPHRASE', {label:'Başka Sözcüklerle Anlatma', defaultDepth:1, grade:'A', sourceIds:['icf.competencies'],
  intent:'Anlaşıldığını doğrular ve yanlış anlamayı erken yakalar.'});
_cit('SUMMARY', {label:'Özetleme', defaultDepth:1, grade:'A', sourceIds:['icf.competencies'],
  intent:'Dağınık parçaları toplar; nereye gelindiğini görünür kılar.'});
_cit('AFFIRMATION', {label:'Onaylama', defaultDepth:1, grade:'B', sourceIds:['icf.competencies'],
  intent:'Gerçek ve somut bir gücü adlandırır — iltifat değil, gözlem.'});
_cit('SILENCE', {label:'Sessizlik', defaultDepth:2, grade:'B', sourceIds:['icf.competencies'],
  intent:'Düşünmeye zaman bırakır; koçun doldurma refleksini durdurur.'});
_cit('OBSERVATION', {label:'Gözlem Paylaşımı', defaultDepth:2, grade:'B', sourceIds:['icf.competencies'],
  intent:'Fark edileni yargısız biçimde ortaya koyar; yorum dayatmaz.'});
_cit('CHALLENGE', {label:'Nazik Meydan Okuma', defaultDepth:3, defaultRisk:'medium', grade:'C', sourceIds:['icf.ethics'],
  intent:'Bir tutarsızlığı veya kaçınmayı ilişkiyi bozmadan görünür kılar.'});
_cit('REFRAME', {label:'Yeniden Çerçeveleme', defaultDepth:3, defaultRisk:'medium', grade:'B', sourceIds:['icf.competencies'],
  intent:'Aynı olguyu başka bir çerçeveden görme imkânı sunar — dayatmadan.'});
_cit('SCALING', {label:'Ölçekleme', defaultDepth:2, grade:'B', sourceIds:['icf.competencies'],
  intent:'Soyut bir durumu somut bir aralığa taşır; ilerlemeyi konuşulabilir kılar.'});
_cit('PERMISSION_BASED_INFORMATION', {label:'İzinli Bilgi Paylaşımı', defaultDepth:2, defaultRisk:'medium', grade:'B',
  sourceIds:['icf.ethics'], principleIds:['ethics.competence'],
  intent:'Bilgi ancak istendiğinde ve izinle verilir; tavsiye yerine seçenek olur.'});
_cit('ACTION_COMMITMENT', {label:'Eylem Taahhüdü', defaultDepth:2, grade:'B', sourceIds:['icf.competencies'],
  intent:'Farkındalığı, danışanın kendi seçtiği somut bir adıma bağlar.'});
function coachingInterventionTypeKeys(){ return Object.keys(COACHING_INTERVENTION_TYPES).sort(); }
function coachingValidInterventionType(t){ return Object.prototype.hasOwnProperty.call(COACHING_INTERVENTION_TYPES,t); }
function coachingTypeIsQuestion(t){ var d=COACHING_INTERVENTION_TYPES[t]; return !!(d && d.isQuestion); }

/* ── Context shorthands used by the content modules ── */
var COACHING_ADULTISH = ['self','adult','executive'];
var COACHING_ALL_CONTEXTS = ['self','adult','executive','youth','child'];
function coachingExpandContexts(code){
  if(Array.isArray(code)) return code.slice();
  if(code==='all') return COACHING_ALL_CONTEXTS.slice();
  if(code==='*') return COACHING_ADULTISH.slice();
  if(code==='minor') return ['child','youth'];
  if(code==='child') return ['child'];
  if(code==='youth') return ['youth'];
  if(code==='exec') return ['executive'];
  if(code==='self') return ['self'];
  return COACHING_ADULTISH.slice();
}

/* ── The registry ── */
var COACHING_INTERVENTIONS = {};
var _ciSeq = 0;
function _ciStr(v,max){ var s=String(v==null?'':v); return max?s.slice(0,max):s; }
function _ciArr(v){ return Array.isArray(v) ? v.map(String) : []; }

function coachingRegisterIntervention(def){
  def = def || {};
  var id = _ciStr(def.id).trim();
  if(!/^[a-z][a-z0-9_.]{2,63}$/.test(id)) return {ok:false,error:'INVALID_INTERVENTION_ID'};
  if(Object.prototype.hasOwnProperty.call(COACHING_INTERVENTIONS,id)) return {ok:false,error:'DUPLICATE_ID:'+id};
  if(!coachingValidInterventionType(def.type)) return {ok:false,error:'INVALID_TYPE'};
  var isQ = coachingTypeIsQuestion(def.type);
  if(isQ && !coachingValidPurpose(def.purpose)) return {ok:false,error:'INVALID_PURPOSE'};
  if(def.purpose!=null && !coachingValidPurpose(def.purpose)) return {ok:false,error:'INVALID_PURPOSE'};
  var text = _ciStr(def.text).trim();
  if(isQ && !text) return {ok:false,error:'EMPTY_QUESTION_TEXT'};
  var stages = _ciArr(def.conversationStages);
  for(var i=0;i<stages.length;i++){ if(!coachingValidStage(stages[i])) return {ok:false,error:'INVALID_STAGE:'+stages[i]}; }
  var contexts = coachingExpandContexts(def.applicableContexts);
  for(var c=0;c<contexts.length;c++){
    if(typeof coachingValidContext==='function' && !coachingValidContext(contexts[c])) return {ok:false,error:'INVALID_CONTEXT:'+contexts[c]};
  }
  var depth = COACHING_DEPTHS.indexOf(def.depth)>=0 ? def.depth : COACHING_INTERVENTION_TYPES[def.type].defaultDepth;
  var risk = COACHING_RISK_LEVELS.indexOf(def.riskLevel)>=0 ? def.riskLevel : COACHING_INTERVENTION_TYPES[def.type].defaultRisk;
  var minorSafe = def.minorSafe===true;
  /* A move offered to a minor must be declared minor-safe AND actually list a
     minor context — otherwise the declaration is meaningless. */
  var touchesMinor = contexts.indexOf('child')>=0 || contexts.indexOf('youth')>=0;
  if(touchesMinor && !minorSafe) return {ok:false,error:'MINOR_CONTEXT_WITHOUT_MINOR_SAFE'};
  if(def.evidenceGrade!=null && !coachingValidGrade(def.evidenceGrade)) return {ok:false,error:'INVALID_EVIDENCE_GRADE'};
  /* Individual wording never carries its own evidence claim (see header). */
  if(isQ && def.evidenceGrade!=null) return {ok:false,error:'QUESTION_CANNOT_CLAIM_EVIDENCE_GRADE'};

  var rec = {
    id:id, type:def.type, isQuestion:isQ,
    conceptId:_ciStr(def.conceptId||id,64),
    title:_ciStr(def.title||'',140),
    purpose:def.purpose||null,
    text:text,
    language:_ciStr(def.language||'tr',8),
    description:_ciStr(def.description||'',400),
    applicableContexts:contexts,
    conversationStages:stages,
    depth:depth,
    riskLevel:risk,
    requiresPermission:def.requiresPermission===true,
    minorSafe:minorSafe,
    contraindications:_ciArr(def.contraindications),
    compatibleApproaches:_ciArr(def.compatibleApproaches),   /* filled by Phase 4 */
    competencyTags:_ciArr(def.competencyTags),
    antiPatternRisks:_ciArr(def.antiPatternRisks),
    followUpTypes:_ciArr(def.followUpTypes),
    sourceBasis:{
      typeGrade:COACHING_INTERVENTION_TYPES[def.type].evidence.grade,
      grade:def.evidenceGrade||null,
      sourceIds:_ciArr(def.sourceIds),
      principleIds:_ciArr(def.principleIds),
      note:'Derece hamle türü içindir; bu cümlenin kendisi kanıtlanmış sayılmaz.'
    },
    order:(_ciSeq++),
    active:def.active!==false
  };
  COACHING_INTERVENTIONS[id] = rec;
  /* PHASE 2 BRIDGE — the single sanctioned way anything becomes usable in a
     context. Nothing here can quietly become child-safe. */
  if(typeof coachingRegisterInterventionPolicy==='function'){
    coachingRegisterInterventionPolicy(id, {
      allowedContexts:contexts, minorSafe:minorSafe, requiresCompetence:rec.competencyTags
    });
  }
  return {ok:true, intervention:rec};
}

function coachingIntervention(id){ return Object.prototype.hasOwnProperty.call(COACHING_INTERVENTIONS,id) ? COACHING_INTERVENTIONS[id] : null; }
function coachingInterventionIds(){ return Object.keys(COACHING_INTERVENTIONS).sort(); }
function coachingInterventionList(){
  return coachingInterventionIds().map(function(id){ return COACHING_INTERVENTIONS[id]; })
    .sort(function(a,b){ return a.order-b.order; });
}
function coachingInterventionsByType(type){ return coachingInterventionList().filter(function(x){ return x.type===type; }); }
function coachingQuestionsByPurpose(p){ return coachingInterventionList().filter(function(x){ return x.isQuestion && x.purpose===p; }); }
/* Concept identity: the same idea worded for a different developmental stage. */
function coachingConceptVariants(conceptId){ return coachingInterventionList().filter(function(x){ return x.conceptId===conceptId; }); }
function coachingInterventionStats(){
  var l=coachingInterventionList(), byType={}, byPurpose={}, byContext={}, minorSafe=0;
  l.forEach(function(x){
    byType[x.type]=(byType[x.type]||0)+1;
    if(x.purpose) byPurpose[x.purpose]=(byPurpose[x.purpose]||0)+1;
    x.applicableContexts.forEach(function(c){ byContext[c]=(byContext[c]||0)+1; });
    if(x.minorSafe) minorSafe++;
  });
  return { total:l.length, questions:l.filter(function(x){return x.isQuestion;}).length,
    nonQuestions:l.filter(function(x){return !x.isQuestion;}).length,
    byType:byType, byPurpose:byPurpose, byContext:byContext, minorSafe:minorSafe,
    concepts:Object.keys(l.reduce(function(m,x){ m[x.conceptId]=1; return m; },{})).length };
}

/* ══ Non-question move templates — at least one per non-question type, so all
   12 types are exercisable. Wording is original and deliberately generic: these
   are coach-facing prompts, not scripts to read aloud. ══ */
var NQ = [
  ['REFLECTION','reflect.mirror','Kendi sözünü geri ver','Danışanın kullandığı anahtar ifadeyi, yorum eklemeden aynen geri ver ve bekle.',['EXPLORING','DEEPENING','AWARENESS'],2,'all',true],
  ['REFLECTION','reflect.feeling','Duyguyu adlandırmadan yansıt','Anlatılanın altındaki duyguyu bir varsayım olarak değil, bir olasılık olarak geri ver.',['DEEPENING','AWARENESS'],2,'all',true],
  ['PARAPHRASE','para.check','Anladığını doğrula','Duyduğunu kendi sözcüklerinle özetle ve "doğru anladım mı?" diye kontrol et.',['EXPLORING','CONTRACTING'],1,'all',true],
  ['SUMMARY','sum.thread','Konuşmanın ipini topla','Şimdiye kadar ortaya çıkan iki-üç ana başlığı sırala ve nereye gidileceğini danışana bırak.',['DEEPENING','OPTIONS','CLOSING'],1,'all',true],
  ['SUMMARY','sum.close','Kapanış özeti','Oturumda ortaya çıkan farkındalığı ve kararı danışanın kendi cümleleriyle özetlemesini iste.',['CLOSING'],1,'all',true],
  ['AFFIRMATION','affirm.evidence','Kanıta dayalı güç adlandırma','Övgü değil gözlem: bugün gösterdiği somut bir davranışı ve etkisini adlandır.',['EXPLORING','COMMITMENT','CLOSING'],1,'all',true],
  ['SILENCE','silence.hold','Sessizliği koru','Bir farkındalık cümlesinden sonra en az birkaç saniye hiçbir şey söyleme; alanı doldurma.',['DEEPENING','AWARENESS'],2,'all',true],
  ['SILENCE','silence.after_question','Sorudan sonra bekle','Soruyu sorduktan sonra yeniden ifade etme, örnek verme veya seçenek sunma.',['EXPLORING','DEEPENING','AWARENESS'],2,'all',true],
  ['OBSERVATION','observe.pattern','Tekrarlayan örüntüyü paylaş','Fark ettiğin tekrarı yargısız aktar ve yorumu danışana bırak.',['DEEPENING','AWARENESS'],2,'*',false],
  ['OBSERVATION','observe.energy','Enerji değişimini paylaş','Ses tonu/tempo değişimini gözlem olarak paylaş, teşhis olarak değil.',['DEEPENING','AWARENESS'],2,'*',false],
  ['CHALLENGE','challenge.gap','Söylem-eylem farkını nazikçe göster','Söylenen öncelik ile ayrılan zaman arasındaki farkı, suçlama olmadan gündeme getir.',['AWARENESS','OPTIONS'],3,'*',false],
  ['CHALLENGE','challenge.standard','Kendi ölçütünü hatırlat','Danışanın kendi koyduğu ölçütü hatırlat ve bugünkü kararla nasıl uyuştuğunu sor.',['AWARENESS','COMMITMENT'],3,'*',false],
  ['REFRAME','reframe.offer','Alternatif çerçeveyi öner, dayatma','Aynı olguya başka bir okuma sun ve "bu sana ne kadar oturuyor?" diye bırak.',['AWARENESS','OPTIONS'],3,'*',false],
  ['REFRAME','reframe.child_story','Hikâye üzerinden çerçeveleme','Çocuk bağlamında soyut yorum yerine kısa bir benzetme kur ve onun tamamlamasını iste.',['AWARENESS','OPTIONS'],2,'minor',true],
  ['SCALING','scale.now','Bugünkü yerini ölçekle','1-10 arasında bugünkü yerini sor; ardından "neden 1 daha düşük değil?" diye devam et.',['EXPLORING','DEEPENING','OPTIONS'],2,'all',true],
  ['SCALING','scale.confidence','Uygulama güvenini ölçekle','Kararlaştırılan adımı gerçekten yapma güvenini 1-10 arası sor; 7 altındaysa adımı küçült.',['COMMITMENT'],2,'all',true],
  ['PERMISSION_BASED_INFORMATION','info.eliciting','İzinle bilgi paylaş','Önce ne bildiğini sor, sonra izin iste, sonra kısa bilgi ver ve tekrar ona dön.',['OPTIONS','COMMITMENT'],2,'all',true],
  ['ACTION_COMMITMENT','act.first_step','İlk somut adım','Danışanın kendi seçtiği, bu hafta içinde yapılabilir tek adımı netleştir.',['COMMITMENT'],2,'all',true],
  ['ACTION_COMMITMENT','act.obstacle','Engeli önceden adlandır','Adımı engelleyebilecek tek şeyi ve buna karşı planını danışanın kendisinin söylemesini iste.',['COMMITMENT'],2,'all',true],
  ['ACTION_COMMITMENT','act.accountability','Hesap verebilirlik biçimi','Kime, ne zaman ve nasıl geri bildireceğini danışanın seçmesini sağla.',['COMMITMENT','FOLLOW_UP'],2,'all',true]
];
NQ.forEach(function(r){
  coachingRegisterIntervention({ id:r[1], type:r[0], conceptId:r[1], title:r[2], description:r[3],
    conversationStages:r[4], depth:r[5], applicableContexts:r[6], minorSafe:r[7],
    requiresPermission:(r[0]==='PERMISSION_BASED_INFORMATION'),
    antiPatternRisks:(r[0]==='CHALLENGE')?['JUDGMENT','COACH_AGENDA']:(r[0]==='REFRAME'?['COACH_AGENDA']:[]),
    contraindications:(r[0]==='CHALLENGE')?['düşük güven','kriz anı','safeguarding uyarısı açık']:[] });
});

function coachingInterventionsSelfCheck(){
  var st=coachingInterventionStats();
  return { schemaVersion:COACHING_INTERVENTION_SCHEMA_VERSION, types:coachingInterventionTypeKeys(),
    stages:COACHING_STAGES.slice(), purposes:COACHING_PURPOSES.slice(),
    grades:Object.keys(COACHING_EVIDENCE_GRADES), stats:st };
}

if(typeof window!=='undefined'){
  window.COACHING_INTERVENTION_SCHEMA_VERSION=COACHING_INTERVENTION_SCHEMA_VERSION;
  window.COACHING_STAGES=COACHING_STAGES; window.COACHING_PURPOSES=COACHING_PURPOSES;
  window.COACHING_DEPTHS=COACHING_DEPTHS; window.COACHING_RISK_LEVELS=COACHING_RISK_LEVELS;
  window.COACHING_EVIDENCE_GRADES=COACHING_EVIDENCE_GRADES;
  window.COACHING_INTERVENTION_TYPES=COACHING_INTERVENTION_TYPES;
  window.COACHING_INTERVENTIONS=COACHING_INTERVENTIONS;
  window.COACHING_ADULTISH=COACHING_ADULTISH; window.COACHING_ALL_CONTEXTS=COACHING_ALL_CONTEXTS;
  window.coachingValidStage=coachingValidStage; window.coachingValidPurpose=coachingValidPurpose;
  window.coachingValidGrade=coachingValidGrade; window.coachingValidInterventionType=coachingValidInterventionType;
  window.coachingTypeIsQuestion=coachingTypeIsQuestion; window.coachingInterventionTypeKeys=coachingInterventionTypeKeys;
  window.coachingExpandContexts=coachingExpandContexts;
  window.coachingRegisterIntervention=coachingRegisterIntervention;
  window.coachingIntervention=coachingIntervention; window.coachingInterventionIds=coachingInterventionIds;
  window.coachingInterventionList=coachingInterventionList; window.coachingInterventionsByType=coachingInterventionsByType;
  window.coachingQuestionsByPurpose=coachingQuestionsByPurpose; window.coachingConceptVariants=coachingConceptVariants;
  window.coachingInterventionStats=coachingInterventionStats;
  window.coachingInterventionsSelfCheck=coachingInterventionsSelfCheck;
}
