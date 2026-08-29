/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 3b: SEED QUESTION LIBRARY
   Original wording, authored for FocusUp. No question list, book passage or
   copyrighted material is reproduced. Nothing here claims a scientific basis:
   evidence grading lives on the MOVE TYPE (20-coaching-interventions.js), and
   a question may not carry its own grade — the registry refuses it.

   Quality before scale. A curated seed set beats a large mediocre one: every
   entry must survive the anti-pattern analyzer (22-coaching-quality.js), which
   the test suite enforces over the whole bank.

   Age adaptation is CONCEPTUAL, not mechanical vocabulary-simplification: a
   child variant shares its `concept` with the adult wording but is written
   from scratch for that developmental stage.

   Every row registers through coachingRegisterIntervention(), which in turn
   registers the Phase 2 policy — so no question silently becomes child-safe.
   ══════════════════════════════════════════════════════════════════════════ */

/* stage codes: O opening · C contracting · E exploring · D deepening ·
   A awareness · P options · M commitment · L closing · F follow-up */
var _QS = {O:'OPENING',C:'CONTRACTING',E:'EXPLORING',D:'DEEPENING',A:'AWARENESS',
           P:'OPTIONS',M:'COMMITMENT',L:'CLOSING',F:'FOLLOW_UP'};
function _qStages(codes){ return String(codes||'').split('').map(function(c){ return _QS[c]; }).filter(Boolean); }

/* [id, concept, ctx, purpose, stages, depth, text] */
var COACHING_QUESTION_ROWS = [
/* ── CONTRACT ── */
['q.contract.outcome','contract_outcome','*','CONTRACT','OC',1,'Bu görüşmeden çıkarken elinde ne olsun isterdin?'],
['q.contract.topic','contract_topic','*','CONTRACT','C',1,'Bugün konuşmaya en çok değecek şey nedir?'],
['q.contract.success','contract_success','*','CONTRACT','C',2,'Bu konuşmanın işe yaradığını nereden anlayacaksın?'],
['q.contract.role','contract_role','*','CONTRACT','C',2,'Bu konuda benden en çok ne işine yarar?'],
['q.contract.time','contract_time','*','CONTRACT','C',1,'Elimizdeki süreyi nasıl kullanmak istersin?'],
['q.contract.boundary','contract_boundary','*','CONTRACT','C',2,'Bugün hangi alanı kapsam dışında tutmak istersin?'],
['q.contract.child','contract_outcome','child','CONTRACT','OC',1,'Bugün konuştuktan sonra ne değişse "iyi ki konuştuk" dersin?'],
['q.contract.youth','contract_topic','youth','CONTRACT','C',1,'Bugün en çok neyi konuşmak sana iyi gelir?'],
/* ── GOAL ── */
['q.goal.define','goal_define','*','GOAL','CE',2,'Tam olarak ne olmasını istiyorsun?'],
['q.goal.picture','goal_picture','*','GOAL','E',2,'Bu istediğin gerçekleştiğinde ortam neye benziyor?'],
['q.goal.measure','goal_measure','*','GOAL','CE',2,'Buna ulaştığını gösterecek ilk işaret ne olur?'],
['q.goal.trigger','goal_trigger','*','GOAL','ED',2,'Bunu şimdi ele almanı tetikleyen ne oldu?'],
['q.goal.gap','goal_gap','*','GOAL','E',2,'Bugün olduğun yer ile olmak istediğin yer arasındaki fark nedir?'],
['q.goal.scope','goal_scope','*','GOAL','C',2,'Bunun hangi kısmı gerçekten senin elinde?'],
['q.goal.horizon','goal_horizon','*','GOAL','E',2,'Bunu ne zamana kadar konuşmuş olmak istersin?'],
['q.goal.priority','goal_priority','exec','GOAL','CE',2,'Önündeki başlıklardan hangisi bırakılırsa en çok şey bozulur?'],
['q.goal.child','goal_picture','child','GOAL','E',1,'İşler istediğin gibi gitseydi o gün nasıl geçerdi?'],
['q.goal.youth','goal_define','youth','GOAL','CE',2,'Sen olsan bu işin sonunda ne olmasını isterdin?'],
/* ── CLARIFY ── */
['q.clarify.meaning','clarify_meaning','*','CLARIFY','E',1,'Bu sözcük senin için tam olarak ne anlama geliyor?'],
['q.clarify.example','clarify_example','*','CLARIFY','E',1,'Bunun somut bir örneğini anlatır mısın?'],
['q.clarify.which','clarify_which','*','CLARIFY','E',1,'Bunlardan hangisini kastediyorsun?'],
['q.clarify.who','clarify_who','*','CLARIFY','E',1,'Bu cümlede "onlar" kim?'],
['q.clarify.when','clarify_when','*','CLARIFY','E',1,'Bu en son ne zaman oldu?'],
['q.clarify.missing','clarify_missing','*','CLARIFY','ED',2,'Anlattıklarında henüz söylemediğin ne var?'],
['q.clarify.amount','clarify_amount','all','CLARIFY','E',1,'"Çok" dediğinde aklında ne kadarı var?'],
['q.clarify.child','clarify_example','child','CLARIFY','E',1,'Bunu bana bir örnekle anlatabilir misin?'],
/* ── REALITY ── */
['q.reality.now','reality_now','*','REALITY','E',1,'Şu an durum tam olarak nerede?'],
['q.reality.facts','reality_facts','*','REALITY','E',2,'Elinde bunu doğrulayan hangi bilgi var?'],
['q.reality.attempted','reality_attempted','*','REALITY','E',2,'Şimdiye kadar ne denedin?'],
['q.reality.result','reality_result','*','REALITY','ED',2,'Denediklerinden ne çıktı?'],
['q.reality.obstacle','reality_obstacle','*','REALITY','ED',2,'Seni şu an durduran şey ne?'],
['q.reality.cost','reality_cost','*','REALITY','DA',3,'Bu durum böyle devam ederse sana neye mal olur?'],
['q.reality.others','reality_others','*','REALITY','E',2,'Bu durumdan başka kim etkileniyor?'],
['q.reality.control','reality_control','*','REALITY','ED',2,'Bunun hangi kısmına doğrudan etki edebiliyorsun?'],
['q.reality.child','reality_now','child','REALITY','E',1,'Bugün bu iş nasıl gitti?'],
['q.reality.youth','reality_obstacle','youth','REALITY','ED',2,'Seni en çok ne zorluyor?'],
/* ── EMOTION ── */
['q.emotion.name','emotion_name','*','EMOTION','D',2,'Bunu anlatırken içinde ne oluyor?'],
['q.emotion.body','emotion_body','*','EMOTION','D',3,'Bu duyguyu bedeninde nerede fark ediyorsun?'],
['q.emotion.strongest','emotion_strongest','*','EMOTION','D',2,'Bu tabloda en ağır basan duygu hangisi?'],
['q.emotion.change','emotion_change','*','EMOTION','DA',2,'Konuşurken duygun nasıl değişti?'],
['q.emotion.signal','emotion_signal','*','EMOTION','D',3,'Bu duygu sana neyi işaret ediyor?'],
['q.emotion.after','emotion_after','all','EMOTION','A',2,'Bunu söyledikten sonra ne hissediyorsun?'],
['q.emotion.child','emotion_name','child','EMOTION','D',1,'Bugün içindeki hava nasıl?'],
['q.emotion.youth','emotion_name','youth','EMOTION','D',2,'Bunu düşününce en çok ne hissediyorsun?'],
/* ── VALUE ── */
['q.value.matters','value_matters','*','VALUE','D',3,'Bu konuda senin için asıl önemli olan ne?'],
['q.value.principle','value_principle','*','VALUE','DA',3,'Hangi ilkeni korumaya çalışıyorsun?'],
['q.value.tradeoff','value_tradeoff','*','VALUE','AP',3,'Neyi neye tercih ediyorsun?'],
['q.value.cost','value_cost','*','VALUE','A',3,'Bu değeri korumak sana neye mal oluyor?'],
['q.value.line','value_line','*','VALUE','DA',3,'Nerede çizgin var?'],
['q.value.child','value_fair','minor','VALUE','D',2,'Sence burada adil olan ne olurdu?'],
['q.value.exec','value_legacy','exec','VALUE','DA',3,'Bu kararla ekibe ne öğretmiş olursun?'],
/* ── ASSUMPTION ── */
['q.assume.hidden','assume_hidden','*','ASSUMPTION','DA',3,'Burada neyi varsayıyorsun?'],
['q.assume.evidence','assume_evidence','*','ASSUMPTION','A',3,'Bunu doğru kılan kanıt ne?'],
['q.assume.opposite','assume_opposite','*','ASSUMPTION','A',3,'Bunun tersi doğru olsaydı ne değişirdi?'],
['q.assume.rule','assume_rule','*','ASSUMPTION','A',3,'Bu kuralı kim koydu?'],
['q.assume.exception','assume_exception','*','ASSUMPTION','A',3,'Bu hangi durumlarda böyle olmadı?'],
['q.assume.if_wrong','assume_if_wrong','*','ASSUMPTION','A',3,'Bu varsayım yanlışsa elinde ne kalır?'],
['q.assume.child','assume_sure','child','ASSUMPTION','A',2,'Bundan nasıl bu kadar emin oldun?'],
['q.assume.youth','assume_rule','youth','ASSUMPTION','A',2,'Bu düşünce sana nereden geldi?'],
/* ── MEANING ── */
['q.meaning.story','meaning_story','*','MEANING','DA',3,'Bu olaya şu an hangi anlamı veriyorsun?'],
['q.meaning.matters','meaning_matters','*','MEANING','D',3,'Bunun senin için anlamı ne?'],
['q.meaning.identity','meaning_identity','*','MEANING','A',3,'Bu seçim seni nasıl biri yapıyor?'],
['q.meaning.future','meaning_future','*','MEANING','AP',3,'Beş yıl sonraki sen bu ana ne derdi?'],
['q.meaning.child','meaning_matters','child','MEANING','D',2,'Bu senin için ne demek?'],
/* ── PERSPECTIVE ── */
['q.persp.other','perspective_shift','*','PERSPECTIVE','DA',2,'Karşı taraf bunu nasıl anlatırdı?'],
['q.persp.observer','perspective_observer','*','PERSPECTIVE','A',3,'Dışarıdan bakan biri burada ne görürdü?'],
['q.persp.admired','perspective_admired','*','PERSPECTIVE','AP',2,'Saygı duyduğun biri bu durumda nasıl davranırdı?'],
['q.persp.distance','perspective_distance','*','PERSPECTIVE','A',3,'Bir yıl sonra bu ne kadar önemli olacak?'],
['q.persp.expect','perspective_expect','exec','PERSPECTIVE','A',3,'Yerinde olsan sen kendinden ne beklerdin?'],
['q.persp.system','perspective_system','exec','PERSPECTIVE','DA',3,'Bu durumu üreten sistem ne?'],
['q.persp.child','perspective_shift','child','PERSPECTIVE','A',2,'Onun sandalyesine otursaydın ne görürdün?'],
['q.persp.youth','perspective_shift','youth','PERSPECTIVE','AP',2,'Yakın arkadaşın aynı durumda olsa ona ne derdin?'],
/* ── STRENGTH ── */
['q.strength.past','strength_evidence','*','STRENGTH','ED',2,'Benzer bir zorluğu daha önce nasıl aştın?'],
['q.strength.proof','strength_proof','*','STRENGTH','D',2,'Bunu yapabileceğini gösteren ne var?'],
['q.strength.others','strength_others','*','STRENGTH','D',2,'Seni tanıyanlar hangi güçlü yanını sayardı?'],
['q.strength.energy','strength_energy','*','STRENGTH','E',2,'Bu işin hangi kısmı sana enerji veriyor?'],
['q.strength.team','strength_team','exec','STRENGTH','EP',2,'Ekibinde bu işi kolaylaştıracak kim var?'],
['q.strength.child','strength_evidence','child','STRENGTH','D',1,'Bu işte en iyi yaptığın şey ne?'],
['q.strength.youth','strength_proud','youth','STRENGTH','D',2,'Son zamanlarda kendinle gurur duyduğun bir an neydi?'],
/* ── RESOURCE ── */
['q.resource.have','resource_have','*','RESOURCE','P',2,'Elinde bunun için hangi kaynak zaten var?'],
['q.resource.need','resource_need','*','RESOURCE','P',2,'Bunun için sana en çok ne gerekli?'],
['q.resource.who','resource_who','*','RESOURCE','P',2,'Bu konuda kime danışabilirsin?'],
['q.resource.time','resource_time','*','RESOURCE','PM',2,'Bunun için haftanda nereden yer açabilirsin?'],
['q.resource.missing','resource_missing','*','RESOURCE','P',2,'Eksik olan tek şey ne?'],
['q.resource.child','resource_who','minor','RESOURCE','P',1,'Bu konuda sana kim yardım edebilir?'],
/* ── EXCEPTION ── */
['q.except.least','exception_least','*','EXCEPTION','ED',2,'Bu sorun en az ne zaman yaşandı?'],
['q.except.different','exception_different','*','EXCEPTION','D',2,'O sefer neyi farklı yaptın?'],
['q.except.small_win','exception_small_win','*','EXCEPTION','DP',2,'Son zamanlarda işe yarayan en küçük şey neydi?'],
['q.except.condition','exception_condition','*','EXCEPTION','D',2,'İşler iyi gittiğinde ortamda ne farklı oluyor?'],
['q.except.child','exception_least','minor','EXCEPTION','D',1,'Bu iş sana ne zaman kolay geliyor?'],
/* ── POSSIBILITY ── */
['q.poss.unblocked','possibility_unblocked','*','POSSIBILITY','P',2,'Hiçbir engel olmasaydı ne yapardın?'],
['q.poss.bold','possibility_bold','*','POSSIBILITY','P',2,'En cesur seçenek ne olurdu?'],
['q.poss.smallest','possibility_smallest','*','POSSIBILITY','PM',2,'En küçük anlamlı hamle ne olabilir?'],
['q.poss.someone','possibility_someone','*','POSSIBILITY','P',2,'Bu işi senden çok daha iyi yapan biri nasıl yaklaşırdı?'],
['q.poss.opposite','possibility_opposite','*','POSSIBILITY','P',3,'Tam tersini yapsaydın ne olurdu?'],
['q.poss.child','possibility_unblocked','child','POSSIBILITY','P',1,'Sihirli bir değneğin olsa ne değiştirirdin?'],
['q.poss.youth','possibility_three','youth','POSSIBILITY','P',2,'Aklına gelen üç yol ne olabilir?'],
/* ── OPTION ── */
['q.option.list','option_list','*','OPTION','P',2,'Önünde hangi seçenekler var?'],
['q.option.more','option_more','*','OPTION','P',2,'Bunlara ek olarak başka ne olabilir?'],
['q.option.tradeoff','option_tradeoff','*','OPTION','P',2,'Bu seçeneğin sana getirdiği ve götürdüğü ne?'],
['q.option.eliminate','option_eliminate','*','OPTION','P',2,'Hangisini şimdiden eliyorsun?'],
['q.option.combine','option_combine','*','OPTION','P',2,'Bu seçeneklerin hangi ikisi birleşebilir?'],
['q.option.risk','option_risk','exec','OPTION','P',3,'Bu seçenekte en büyük risk ne?'],
['q.option.child','option_more','minor','OPTION','P',1,'Başka nasıl yapılabilir?'],
/* ── DECISION ── */
['q.decide.criteria','decision_criteria','*','DECISION','PM',2,'Bu kararı neye göre vereceksin?'],
['q.decide.lean','decision_lean','*','DECISION','M',2,'Şu an hangisine daha yakınsın?'],
['q.decide.regret','decision_regret','*','DECISION','M',3,'Hangisini seçmezsen buna en çok pişman olursun?'],
['q.decide.enough','decision_enough','*','DECISION','M',2,'Karar vermek için daha ne bilmen gerekiyor?'],
['q.decide.reversible','decision_reversible','exec','DECISION','M',3,'Bu karardan geri dönmek ne kadar mümkün?'],
['q.decide.youth','decision_lean','youth','DECISION','M',2,'Sen olsan hangisini seçerdin?'],
/* ── OWNERSHIP ── */
['q.own.part','ownership_part','*','OWNERSHIP','A',3,'Bu tabloda senin payın ne?'],
['q.own.choice','ownership_choice','*','OWNERSHIP','AM',3,'Burada gerçekten senin seçimin olan ne?'],
['q.own.waiting','ownership_waiting','*','OWNERSHIP','A',3,'Neyi beklemekten vazgeçersen ilerlersin?'],
['q.own.permission','ownership_permission','*','OWNERSHIP','A',3,'Kimden izin bekliyorsun?'],
['q.own.exec','ownership_holding','exec','OWNERSHIP','AP',3,'Bunu sende tutan ne?'],
['q.own.child','ownership_part','minor','OWNERSHIP','A',2,'Bunun hangi kısmı sana bağlı?'],
/* ── ACTION ── */
['q.act.first','action_first_step','*','ACTION','M',2,'İlk adım ne olacak?'],
['q.act.when','action_when','*','ACTION','M',1,'Bunu ne zaman yapacaksın?'],
['q.act.smallest','action_smallest','*','ACTION','M',2,'Bugün atabileceğin en küçük adım ne?'],
['q.act.blocker','action_blocker','*','ACTION','M',2,'Bu adımı engelleyebilecek tek şey ne?'],
['q.act.environment','action_environment','*','ACTION','M',2,'Bu adımı kolaylaştırmak için ortamda neyi değiştirirsin?'],
['q.act.if_then','action_if_then','*','ACTION','M',2,'Engel çıkarsa yerine ne yapacaksın?'],
['q.act.exec','action_48h','exec','ACTION','M',2,'Önümüzdeki 48 saatte ne değişmiş olacak?'],
['q.act.child','action_first_step','minor','ACTION','M',1,'Bugün ilk olarak ne yapacaksın?'],
/* ── ACCOUNTABILITY ── */
['q.acc.who','accountability_who','*','ACCOUNTABILITY','MF',2,'Bunu kime söyleyeceksin?'],
['q.acc.when','accountability_when','*','ACCOUNTABILITY','MF',1,'Ne zaman geri dönüp bakacaksın?'],
['q.acc.signal','accountability_signal','*','ACCOUNTABILITY','MF',2,'Yoldan çıktığını nereden anlayacaksın?'],
['q.acc.confidence','accountability_confidence','all','ACCOUNTABILITY','M',2,'Bunu yapma ihtimalin sence ne kadar?'],
['q.acc.child','accountability_show','minor','ACCOUNTABILITY','MF',1,'Yaptığını bana nasıl göstereceksin?'],
/* ── LEARNING ── */
['q.learn.takeaway','learning_takeaway','*','LEARNING','L',1,'Bugün ne fark ettin?'],
['q.learn.change','learning_change','*','LEARNING','L',2,'Bu konuşma senin için neyi değiştirdi?'],
['q.learn.pattern','learning_pattern','*','LEARNING','LF',2,'Bunda tanıdık gelen ne var?'],
['q.learn.next','learning_next','*','LEARNING','F',2,'Bir dahaki sefere neyi farklı yaparsın?'],
['q.learn.exec','learning_transfer','exec','LEARNING','LF',3,'Bu deneyimden ekibe ne taşıyacaksın?'],
['q.learn.child','learning_takeaway','minor','LEARNING','L',1,'Bugün yeni olarak ne öğrendin?'],
/* ── FOLLOW_UP ── */
['q.follow.since','followup_since','*','FOLLOW_UP','F',1,'Geçen görüşmeden bu yana ne oldu?'],
['q.follow.step','followup_step','*','FOLLOW_UP','F',1,'Kararlaştırdığın adım nasıl gitti?'],
['q.follow.surprise','followup_surprise','*','FOLLOW_UP','F',2,'Seni en çok ne şaşırttı?'],
['q.follow.child','followup_since','minor','FOLLOW_UP','F',1,'Geçen sefer konuştuğumuzdan beri ne değişti?'],
/* ── CLOSURE ── */
['q.close.summary','closure_summary','*','CLOSURE','L',1,'Bugünü kendi cümlenle nasıl özetlersin?'],
['q.close.takeaway','closure_takeaway','*','CLOSURE','L',1,'Buradan çıkarken yanında ne götürüyorsun?'],
['q.close.unsaid','closure_unsaid','*','CLOSURE','L',2,'Söylenmeden kalan ne var?'],
['q.close.next','closure_next','*','CLOSURE','LF',1,'Bir sonraki görüşmede neyi konuşmuş olalım?'],
['q.close.child','closure_summary','minor','CLOSURE','L',1,'Bugünü tek kelimeyle nasıl anlatırsın?']
];

function _qMinorSafe(ctx){ return ctx==='all'||ctx==='minor'||ctx==='child'||ctx==='youth'; }
var COACHING_QUESTION_LOAD = {registered:0, rejected:[]};
COACHING_QUESTION_ROWS.forEach(function(r){
  var res = coachingRegisterIntervention({
    id:r[0], conceptId:r[1], type:'OPEN_QUESTION', purpose:r[3],
    applicableContexts:r[2], conversationStages:_qStages(r[4]), depth:r[5],
    text:r[6], language:'tr', minorSafe:_qMinorSafe(r[2]),
    title:r[6].slice(0,80),
    followUpTypes:(r[5]>=3 ? ['SILENCE','REFLECTION'] : ['REFLECTION','PARAPHRASE'])
  });
  if(res.ok) COACHING_QUESTION_LOAD.registered++;
  else COACHING_QUESTION_LOAD.rejected.push({id:r[0], error:res.error});
});

function coachingQuestionBankStats(){
  var qs = coachingInterventionList().filter(function(x){ return x.isQuestion; });
  var byPurpose={}, byContext={}, concepts={}, minorSafe=0;
  qs.forEach(function(q){
    byPurpose[q.purpose]=(byPurpose[q.purpose]||0)+1;
    q.applicableContexts.forEach(function(c){ byContext[c]=(byContext[c]||0)+1; });
    concepts[q.conceptId]=(concepts[q.conceptId]||0)+1;
    if(q.minorSafe) minorSafe++;
  });
  var multi = Object.keys(concepts).filter(function(c){ return concepts[c]>1; });
  return { total:qs.length, byPurpose:byPurpose, byContext:byContext, minorSafe:minorSafe,
    concepts:Object.keys(concepts).length, conceptsWithVariants:multi.length,
    load:{registered:COACHING_QUESTION_LOAD.registered, rejected:COACHING_QUESTION_LOAD.rejected.slice()} };
}

if(typeof window!=='undefined'){
  window.COACHING_QUESTION_ROWS=COACHING_QUESTION_ROWS;
  window.COACHING_QUESTION_LOAD=COACHING_QUESTION_LOAD;
  window.coachingQuestionBankStats=coachingQuestionBankStats;
}
