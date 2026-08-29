/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 4a: CANONICAL APPROACH LIBRARY
   Ten professional approaches under ONE schema. An approach is a lens over the
   existing Phase 3 registry — it FILTERS AND WEIGHTS the 164 canonical moves,
   it never owns a copy of them. There is no per-methodology question bank.

   ── EVIDENCE DISCIPLINE ──
   Three different claims are kept apart on purpose, because conflating them is
   how coaching literature oversells itself:
     1. coachingGenerally   — does coaching help at all?
     2. underlyingPrinciple — is the psychological mechanism well supported?
     3. namedMethodology    — is THIS branded approach itself well evidenced?
   No named methodology is graded A. Wide adoption is not evidence, and a
   framework's therapy research does not transfer to its coaching adaptation.
   Every record states that caution in its own words.

   No framework text or book passage is reproduced — descriptions and
   principles are written from scratch.

   Pure data + pure functions. No I/O, no persistence, no network.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_APPROACH_SCHEMA_VERSION = 1;
var COACHING_MINOR_POLICIES = ['permitted','permitted_with_adaptation','not_for_minors'];

var COACHING_APPROACH_REGISTRY = {};
var _caSeq = 0;
function _caArr(v){ return Array.isArray(v) ? v.map(String) : []; }

function coachingRegisterApproachDef(def){
  def = def || {};
  var id = String(def.id||'');
  if(!/^[A-Z][A-Z0-9_]{2,39}$/.test(id)) return {ok:false,error:'INVALID_APPROACH_ID'};
  if(Object.prototype.hasOwnProperty.call(COACHING_APPROACH_REGISTRY,id)) return {ok:false,error:'DUPLICATE_APPROACH:'+id};
  if(COACHING_MINOR_POLICIES.indexOf(def.minorPolicy)<0) return {ok:false,error:'INVALID_MINOR_POLICY'};
  var ev = def.evidence || {};
  var parts = ['coachingGenerally','underlyingPrinciple','namedMethodology'];
  for(var i=0;i<parts.length;i++){
    var p = ev[parts[i]];
    if(!p || !coachingValidGrade(p.grade)) return {ok:false,error:'INVALID_EVIDENCE:'+parts[i]};
    if(!p.note || String(p.note).length<20) return {ok:false,error:'EVIDENCE_NOTE_REQUIRED:'+parts[i]};
  }
  /* A branded coaching methodology is never graded A here — see header. */
  if(ev.namedMethodology.grade==='A') return {ok:false,error:'NAMED_METHODOLOGY_CANNOT_BE_GRADE_A'};
  if(!ev.caution || String(ev.caution).length<20) return {ok:false,error:'EVIDENCE_CAUTION_REQUIRED'};
  var srcs = _caArr(def.professionalSourceIds);
  for(var s=0;s<srcs.length;s++){ if(typeof coachingSource==='function' && !coachingSource(srcs[s])) return {ok:false,error:'UNKNOWN_SOURCE:'+srcs[s]}; }
  var stages = _caArr(def.compatibleStages);
  for(var st=0;st<stages.length;st++){ if(!coachingValidStage(stages[st])) return {ok:false,error:'INVALID_STAGE:'+stages[st]}; }
  var purposes = _caArr(def.compatiblePurposes);
  for(var pu=0;pu<purposes.length;pu++){ if(!coachingValidPurpose(purposes[pu])) return {ok:false,error:'INVALID_PURPOSE:'+purposes[pu]}; }
  var contexts = coachingExpandContexts(def.applicableContexts);
  var types = _caArr(def.preferredInterventionTypes).concat(_caArr(def.cautionInterventionTypes));
  for(var t=0;t<types.length;t++){ if(!coachingValidInterventionType(types[t])) return {ok:false,error:'INVALID_TYPE:'+types[t]}; }

  var rec = {
    id:id, title:String(def.title||''), shortTitle:String(def.shortTitle||''),
    description:String(def.description||''),
    bestFor:_caArr(def.bestFor), notBestFor:_caArr(def.notBestFor),
    applicableContexts:contexts, compatibleStages:stages, compatiblePurposes:purposes,
    preferredInterventionTypes:_caArr(def.preferredInterventionTypes),
    cautionInterventionTypes:_caArr(def.cautionInterventionTypes),
    contraindications:_caArr(def.contraindications),
    minorPolicy:def.minorPolicy,
    evidenceGrade:ev.namedMethodology.grade,
    evidenceBasis:{ coachingGenerally:ev.coachingGenerally, underlyingPrinciple:ev.underlyingPrinciple,
      namedMethodology:ev.namedMethodology, caution:String(ev.caution) },
    professionalSourceIds:srcs,
    corePrinciples:_caArr(def.corePrinciples),
    coachStance:String(def.coachStance||''),
    /* tagging inputs — questions by purpose (curated per approach), non-question
       moves by explicit hand-picked id. Nothing is tagged "because it might fit". */
    tagPurposes:_caArr(def.tagPurposes), tagIncludeIds:_caArr(def.tagIncludeIds),
    tagExcludeIds:_caArr(def.tagExcludeIds),
    order:(_caSeq++), active:def.active!==false
  };
  COACHING_APPROACH_REGISTRY[id] = rec;
  /* PHASE 1 BRIDGE — the approach-key registry declared in 17-coaching-domain.js
     is the single authority for "is this a valid approach?" (coachingValidApproach,
     and therefore session.approach normalization). Phase 4 fills it rather than
     standing up a second methodology store beside it. */
  if(typeof coachingRegisterApproach==='function')
    coachingRegisterApproach(id, {label:rec.shortTitle||rec.title, addedIn:'phase4'});
  return {ok:true, approach:rec};
}
function coachingApproach(id){ return Object.prototype.hasOwnProperty.call(COACHING_APPROACH_REGISTRY,id)?COACHING_APPROACH_REGISTRY[id]:null; }
function coachingApproachIds(){ return Object.keys(COACHING_APPROACH_REGISTRY).sort(); }
function coachingApproachList(){
  return coachingApproachIds().map(function(id){ return COACHING_APPROACH_REGISTRY[id]; })
    .sort(function(a,b){ return a.order-b.order; });
}
function coachingApproachAllowedForContext(id, context){
  var a = coachingApproach(id); if(!a || !a.active) return false;
  var minor = (typeof coachingContextIsMinor==='function') ? coachingContextIsMinor(context) : false;
  if(minor && a.minorPolicy==='not_for_minors') return false;
  return a.applicableContexts.indexOf(context)>=0;
}

/* ══ THE LIBRARY ══ */
coachingRegisterApproachDef({
  id:'GROW', title:'GROW Yapısı', shortTitle:'GROW',
  description:'Hedef, mevcut durum, seçenekler ve irade sırasını izleyen bir konuşma iskeleti. Bir yöntem değil, düzen sağlayan bir çerçevedir.',
  bestFor:['hedef makul ölçüde net','performans veya eylem konusu','keşiften seçeneklere geçiş','somut taahhüt gerekiyor'],
  notBestFor:['yüksek kararsızlık','önce anlam/değer açıklığı gereken konular','güvenlik veya sınır uyarısı açık','küçük çocukta soyut sıralama'],
  applicableContexts:['self','adult','executive','youth'], minorPolicy:'permitted_with_adaptation',
  compatibleStages:['CONTRACTING','EXPLORING','OPTIONS','COMMITMENT','CLOSING'],
  compatiblePurposes:['GOAL','REALITY','OPTION','DECISION','ACTION','ACCOUNTABILITY'],
  preferredInterventionTypes:['OPEN_QUESTION','SUMMARY','SCALING','ACTION_COMMITMENT'],
  cautionInterventionTypes:['CHALLENGE'],
  contraindications:['her oturumu G ile başlatıp W ile bitirme zorunluluğu','kararsızlığı seçenek üretimiyle geçiştirme'],
  corePrinciples:['Önce ne istendiği netleşir','Sonra bugün nerede olunduğu','Sonra hangi yolların bulunduğu','En sonda hangisinin gerçekten yapılacağı'],
  coachStance:'Düzen sağlar, yönü danışana bırakır.',
  professionalSourceIds:['whitmore.performance','icf.competencies'],
  evidence:{ coachingGenerally:{grade:'B',note:'Koçluğun genel olarak yardımcı olduğuna dair yerleşik uygulama birikimi vardır.'},
    underlyingPrinciple:{grade:'B',note:'Net hedef ve somut adım belirlemenin ilerlemeyi kolaylaştırdığı yaygın kabul görür.'},
    namedMethodology:{grade:'C',note:'GROW yaygın kullanılır ancak kendisi doğrudan sınanmış bir müdahale değildir; bir düzenleme aracıdır.'},
    caution:'Yaygın olması kanıt değildir. GROW bir sıralamadır; her konuşmaya dayatılırsa kararsızlığı görünmez kılar.' },
  tagPurposes:['GOAL','REALITY','OPTION','DECISION','ACTION','ACCOUNTABILITY'],
  tagIncludeIds:['sum.thread','scale.now','act.first_step','act.obstacle','act.accountability','para.check']
});

coachingRegisterApproachDef({
  id:'SOLUTION_FOCUSED', title:'Çözüm Odaklı Yaklaşım', shortTitle:'Çözüm Odaklı',
  description:'Sorunun anatomisi yerine tercih edilen geleceğe, istisnalara ve halihazırda işe yarayana bakar.',
  bestFor:['tıkanmış ama hareket isteyen','tercih ettiği geleceği tarif edebilen','işe yarayan istisnalar var','küçük bir sonraki adım yeterli'],
  notBestFor:['önce duyulmaya ihtiyaç duyan','sorunun anlaşılması gerçekten gerekli','kayıp veya yas'],
  applicableContexts:'all', minorPolicy:'permitted',
  compatibleStages:['EXPLORING','DEEPENING','OPTIONS','COMMITMENT','CLOSING'],
  compatiblePurposes:['EXCEPTION','POSSIBILITY','RESOURCE','STRENGTH','GOAL','ACTION'],
  preferredInterventionTypes:['OPEN_QUESTION','SCALING','AFFIRMATION','SUMMARY','ACTION_COMMITMENT'],
  cautionInterventionTypes:['CHALLENGE','OBSERVATION'],
  contraindications:['gerçek zorluğu "pozitif kal" ile geçiştirmek'],
  corePrinciples:['Tercih edilen gelecek tarif edilir','İstisnalar bilgi taşır','Kaynak zaten vardır','Küçük adım yeter'],
  coachStance:'Merak eder, çözümü danışanın kendi deneyiminde arar.',
  professionalSourceIds:['sfbt.origin','icf.competencies'],
  evidence:{ coachingGenerally:{grade:'B',note:'Koçluk bağlamında yaygın ve pratikte iyi karşılanan bir çalışma biçimidir.'},
    underlyingPrinciple:{grade:'B',note:'İstisnaların ve mevcut kaynakların incelenmesi ilerleme için işlevsel bir bilgi kaynağıdır.'},
    namedMethodology:{grade:'B',note:'Çözüm odaklı koçluk uygulaması, terapideki kardeşinden ayrı ve daha az sınanmıştır.'},
    caution:'Çözüm Odaklı Kısa Terapi araştırması, çözüm odaklı KOÇLUĞUN kanıtı değildir; ikisi karıştırılmamalıdır.' },
  tagPurposes:['EXCEPTION','POSSIBILITY','RESOURCE','STRENGTH'],
  tagIncludeIds:['scale.now','scale.confidence','affirm.evidence','sum.thread','act.first_step']
});

coachingRegisterApproachDef({
  id:'MOTIVATIONAL_INTERVIEWING', title:'Motivasyonel Görüşme', shortTitle:'MI',
  description:'Kararsızlığı bir direnç olarak değil, çalışılacak asıl malzeme olarak ele alır. Bağ kurma, odaklanma, çağırma ve planlama olarak ilerler.',
  bestFor:['kararsızlık','çelişkili motivasyon','"istiyorum ama..."','tekrarlayan niyet, gerçekleşmeyen taahhüt','özerkliğin korunması gereken durum'],
  notBestFor:['kişi zaten kararlı, yalnız plan gerekiyor','koçun tercih ettiği bir sonuç varsa'],
  applicableContexts:['self','adult','executive','youth'], minorPolicy:'permitted_with_adaptation',
  compatibleStages:['OPENING','CONTRACTING','EXPLORING','DEEPENING','AWARENESS','COMMITMENT'],
  compatiblePurposes:['EMOTION','VALUE','MEANING','OWNERSHIP','DECISION','ACTION'],
  preferredInterventionTypes:['REFLECTION','AFFIRMATION','OPEN_QUESTION','SUMMARY','PERMISSION_BASED_INFORMATION'],
  cautionInterventionTypes:['CHALLENGE','REFRAME'],
  contraindications:['ikna aracı olarak kullanmak','kararsızlığa erken tavsiyeyle karşılık vermek','danışanı koçun tercihine yöneltmek'],
  corePrinciples:['Kararsızlık normaldir','Değişim gerekçesi danışandan çıkar','Özerklik korunur','Direnç, ilişkinin sinyalidir'],
  coachStance:'Ortak, ikna edici değil. Değişimin gerekçesini kendisi söylemez.',
  professionalSourceIds:['mi.mint','mi.miller_rollnick','sdt.deci_ryan'],
  evidence:{ coachingGenerally:{grade:'B',note:'Koçluk bağlamında kararsızlık çalışması için yerleşik ve yaygın bir uyarlamadır.'},
    underlyingPrinciple:{grade:'A',note:'Özerklik desteğinin ve kişinin kendi değişim gerekçesini üretmesinin motivasyona etkisi güçlü biçimde çalışılmıştır.'},
    namedMethodology:{grade:'B',note:'MI danışmanlık alanında geniş biçimde sınanmıştır; koçluk uyarlaması aynı ölçüde sınanmış değildir.'},
    caution:'MI bir ikna tekniği DEĞİLDİR. Danışanı koçun istediği karara taşımak için kullanılırsa yöntem ihlal edilmiş olur.' },
  tagPurposes:['EMOTION','VALUE','OWNERSHIP','DECISION','MEANING'],
  tagIncludeIds:['reflect.mirror','reflect.feeling','affirm.evidence','sum.thread','info.eliciting','silence.hold']
});

coachingRegisterApproachDef({
  id:'SOCRATIC_GUIDED_DISCOVERY', title:'Sokratik / Rehberli Keşif', shortTitle:'Sokratik',
  description:'Varsayımları, yorumları ve kanıtı danışanın kendisinin incelemesine alan açar. Amaç keşiftir, haklı çıkmak değil.',
  bestFor:['katı yorum','mutlak inanç','varsayım incelemesi','alternatif bakış ihtiyacı'],
  notBestFor:['güvenin düşük olduğu ilişki','yüksek sıkıntı','kararsızlık (tartışma gibi hissettirir)','soyutlamayı taşıyamayan yaş'],
  applicableContexts:['self','adult','executive','youth'], minorPolicy:'permitted_with_adaptation',
  compatibleStages:['DEEPENING','AWARENESS'],
  compatiblePurposes:['ASSUMPTION','PERSPECTIVE','CLARIFY','MEANING'],
  preferredInterventionTypes:['OPEN_QUESTION','REFLECTION','OBSERVATION'],
  cautionInterventionTypes:['CHALLENGE','REFRAME'],
  contraindications:['ardışık "neden" zinciri','sorgu ritmi','her inancı akıl dışı sayma','koçun haklılığını kanıtlama'],
  corePrinciples:['Keşif rehberlidir, yargı değildir','Kanıt danışan tarafından tartılır','Alternatif sunulur, dayatılmaz'],
  coachStance:'Meraklı ve sabırlı; savcı değil.',
  professionalSourceIds:['cbt.guided_discovery','icf.competencies'],
  evidence:{ coachingGenerally:{grade:'B',note:'Varsayım incelemesi koçlukta yerleşik ve sık kullanılan bir çalışma biçimidir.'},
    underlyingPrinciple:{grade:'B',note:'Kişinin kendi yorumunu kanıtla sınamasının bakış açısını genişlettiği yaygın kabul görür.'},
    namedMethodology:{grade:'C',note:'Rehberli keşfin koçluk uyarlaması için ayrı ve doğrudan bir kanıt tabanı yoktur.'},
    caution:'Klinik kökenlidir. Koçlukta yalnız klinik olmayan varsayım incelemesiyle sınırlıdır ve sorguya dönüşmemelidir.' },
  tagPurposes:['ASSUMPTION','PERSPECTIVE','CLARIFY'],
  tagIncludeIds:['reflect.mirror','observe.pattern','sum.thread','silence.after_question']
});

coachingRegisterApproachDef({
  id:'STRENGTHS_BASED', title:'Güçlü Yönler Odaklı', shortTitle:'Güçlü Yönler',
  description:'Kişide zaten var olan kapasiteyi, geçmiş başarıyı ve az kullanılan yetkinliği görünür kılar.',
  bestFor:['güven düşük ama kapasite var','geçmiş başarı bilgi taşıyor','yetkinlik var, kullanılmıyor','kaldıraç aranıyor'],
  notBestFor:['gerçek bir sorunun yüzleşilmesi gerekiyor','övgü içi boş kalacaksa'],
  applicableContexts:'all', minorPolicy:'permitted',
  compatibleStages:['EXPLORING','DEEPENING','OPTIONS','CLOSING'],
  compatiblePurposes:['STRENGTH','RESOURCE','EXCEPTION','LEARNING'],
  preferredInterventionTypes:['AFFIRMATION','OPEN_QUESTION','REFLECTION','SUMMARY'],
  cautionInterventionTypes:['CHALLENGE'],
  contraindications:['boş övgü','sorunu görmezden gelme'],
  corePrinciples:['Kapasite zaten vardır','Geçmiş başarı kanıttır','Güç, kullanıldığında güçtür'],
  coachStance:'Kanıta bakar; iltifat etmez.',
  professionalSourceIds:['strengths.via','icf.competencies'],
  evidence:{ coachingGenerally:{grade:'B',note:'Mevcut kaynakların görünür kılınması koçlukta yerleşik bir çalışma biçimidir.'},
    underlyingPrinciple:{grade:'B',note:'Kişinin kendi yeterlilik kanıtına erişmesinin özyeterlik algısını desteklediği yaygın kabul görür.'},
    namedMethodology:{grade:'B',note:'Güçlü yönler odaklı koçluk için pozitif psikoloji kaynaklı çerçeveler vardır; kesinlik iddiası yoktur.'},
    caution:'Bu yaklaşım gerçek bir sorunu atlamak için kullanılırsa güven kaybettirir; övgü ile kanıt aynı şey değildir.' },
  tagPurposes:['STRENGTH','RESOURCE','EXCEPTION'],
  tagIncludeIds:['affirm.evidence','reflect.mirror','sum.thread','scale.confidence']
});

coachingRegisterApproachDef({
  id:'VALUES_BASED', title:'Değer Odaklı', shortTitle:'Değerler',
  description:'Kararın altındaki öncelikleri ve neyin neye tercih edildiğini açığa çıkarır. Kişilik teşhisi değildir.',
  bestFor:['çatışan öncelikler','başkasından devralınmış hedefler','kimlik ile davranış uyumsuzluğu','anlamlı seçenekler arasında karar'],
  notBestFor:['acil operasyonel karar','güvenlik uyarısı açık'],
  applicableContexts:'all', minorPolicy:'permitted_with_adaptation',
  compatibleStages:['DEEPENING','AWARENESS','OPTIONS','COMMITMENT'],
  compatiblePurposes:['VALUE','MEANING','DECISION','OWNERSHIP','PERSPECTIVE'],
  preferredInterventionTypes:['OPEN_QUESTION','REFLECTION','SILENCE','SUMMARY'],
  cautionInterventionTypes:['CHALLENGE','REFRAME'],
  contraindications:['danışana "asıl değerin şu" demek','gizli kişilik profili çıkarmak'],
  corePrinciples:['Öncelikler adlandırılabilir','Tercih bir bedeldir','Değer, davranışta görünür'],
  coachStance:'Netleştirir, tanımlamaz.',
  professionalSourceIds:['sdt.deci_ryan','icf.ethics'],
  evidence:{ coachingGenerally:{grade:'B',note:'Öncelik açıklığı koçlukta yerleşik ve sık başvurulan bir çalışma alanıdır.'},
    underlyingPrinciple:{grade:'A',note:'İçselleştirilmiş, kişinin kendi değerleriyle uyumlu amaçların sürdürülebilirliği güçlü biçimde çalışılmıştır.'},
    namedMethodology:{grade:'B',note:'Değer odaklı koçluk tek bir standart yöntem değil, bir vurgu ailesidir.'},
    caution:'Değerler bir kişilik teşhisi DEĞİLDİR. Sistem "senin gerçek değerin X" diyemez; yalnız "burada ne önemli" sorusunu açar.' },
  tagPurposes:['VALUE','MEANING','OWNERSHIP'],
  tagIncludeIds:['silence.hold','reflect.feeling','sum.close','challenge.standard']
});

coachingRegisterApproachDef({
  id:'BEHAVIOUR_CHANGE', title:'Davranış Değişimi', shortTitle:'Davranış',
  description:'Niyeti değil davranışı çalışır: tetikleyici, sürtünme, ortam, tekrar, geri bildirim ve küçük denemeler.',
  bestFor:['ne yapacağını biliyor ama sürdüremiyor','ortam ve sürtünme belirleyici','rutin kurulacak','tekrar ve geri bildirim gerekiyor'],
  notBestFor:['kararsızlık çözülmemiş (önce MI)','asıl mesele anlam sorusu'],
  applicableContexts:'all', minorPolicy:'permitted_with_adaptation',
  compatibleStages:['OPTIONS','COMMITMENT','FOLLOW_UP'],
  compatiblePurposes:['ACTION','ACCOUNTABILITY','RESOURCE','REALITY'],
  preferredInterventionTypes:['ACTION_COMMITMENT','SCALING','OPEN_QUESTION','OBSERVATION'],
  cautionInterventionTypes:['CHALLENGE'],
  contraindications:['davranışı yalnız motivasyona indirgemek','tıbbi iddia','FocusUp alışkanlık verisini kopyalamak'],
  corePrinciples:['Davranış gözlemlenebilir','Ortam sonucu belirler','Küçük deneme büyük plandan iyidir','Engel önceden adlandırılır'],
  coachStance:'Somut ve deneyci; ahlakçı değil.',
  professionalSourceIds:['behaviour.change_science','icf.competencies'],
  evidence:{ coachingGenerally:{grade:'B',note:'Davranış odaklı çalışma koçlukta yerleşik ve ölçülebilir sonuç üreten bir alandır.'},
    underlyingPrinciple:{grade:'A',note:'Önceden belirlenmiş "engel çıkarsa şunu yaparım" planlarının uygulamayı artırdığı geniş biçimde çalışılmıştır.'},
    namedMethodology:{grade:'B',note:'Tek bir "davranış değişimi koçluğu" standardı yoktur; alandan derlenmiş bir uygulama ailesidir.'},
    caution:'Tıbbi veya klinik iddia içermez. Alışkanlık verisi FocusUp\'ın mevcut alanlarında kalır; burada ikinci bir kopya tutulmaz.' },
  tagPurposes:['ACTION','ACCOUNTABILITY','RESOURCE'],
  tagIncludeIds:['act.first_step','act.obstacle','act.accountability','scale.confidence','observe.pattern']
});

coachingRegisterApproachDef({
  id:'DEVELOPMENTAL_EXECUTIVE', title:'Gelişimsel / Yönetici Koçluğu', shortTitle:'Yönetici',
  description:'Liderlik davranışı, karar verme, paydaş bakışı, etki ve sorumluluk üzerine çalışır. Danışmanlık değildir.',
  bestFor:['delegasyon','liderlik davranışı','paydaş perspektifi','çatışma ve etki','takım performansı','stratejik düşünme'],
  notBestFor:['reşit olmayan danışan','talep aslında danışmanlıksa','uzmanlık bilgisi asıl ihtiyaçsa'],
  applicableContexts:['adult','executive','self'], minorPolicy:'not_for_minors',
  compatibleStages:['EXPLORING','DEEPENING','AWARENESS','OPTIONS','COMMITMENT'],
  compatiblePurposes:['PERSPECTIVE','OWNERSHIP','DECISION','VALUE','OPTION','MEANING'],
  preferredInterventionTypes:['OPEN_QUESTION','OBSERVATION','SUMMARY','CHALLENGE','REFRAME','PERMISSION_BASED_INFORMATION'],
  cautionInterventionTypes:['PERMISSION_BASED_INFORMATION'],
  contraindications:['varsayılan olarak tavsiye vermek','koçluk yerine danışmanlığa kaymak'],
  corePrinciples:['Sorumluluk liderde kalır','Sistem, kişiden büyüktür','Bilgi ancak izinle paylaşılır'],
  coachStance:'Düşündürür, çözümü satmaz.',
  professionalSourceIds:['icf.competencies','icf.ethics'],
  evidence:{ coachingGenerally:{grade:'B',note:'Yönetici koçluğu kurumsal bağlamda yerleşik ve yaygın biçimde uygulanan bir alandır.'},
    underlyingPrinciple:{grade:'B',note:'Yansıtıcı sorgulamanın liderlik davranışında farkındalık ürettiği yaygın kabul görür.'},
    namedMethodology:{grade:'C',note:'"Yönetici koçluğu" tek bir yöntem değil, bir bağlam etiketidir; içeriği koça göre değişir.'},
    caution:'Bu etiket altında koçluk sessizce danışmanlığa dönüşebilir. Bilgi paylaşımı yalnız açık izinle ve seçenek olarak yapılır.' },
  tagPurposes:['PERSPECTIVE','OWNERSHIP','DECISION','OPTION'],
  tagIncludeIds:['observe.pattern','observe.energy','challenge.gap','challenge.standard','info.eliciting','reframe.offer','sum.thread']
});

coachingRegisterApproachDef({
  id:'CAREER_COACHING', title:'Kariyer Koçluğu', shortTitle:'Kariyer',
  description:'Yön, geçiş, karar ölçütü ve ödünleşimler üzerine çalışır. Meslek önermez, iş piyasası bilgisi iddia etmez.',
  bestFor:['kariyer yönü','rol geçişi','karar ölçütü belirsiz','ödünleşimlerin tartılması'],
  notBestFor:['iş piyasası verisi ihtiyacı','reşit olmayan danışanda veli katılımı olmadan meslek kararı'],
  applicableContexts:['self','adult','executive','youth'], minorPolicy:'permitted_with_adaptation',
  compatibleStages:['CONTRACTING','EXPLORING','OPTIONS','COMMITMENT'],
  compatiblePurposes:['VALUE','DECISION','OPTION','STRENGTH','POSSIBILITY','GOAL'],
  preferredInterventionTypes:['OPEN_QUESTION','SUMMARY','SCALING','ACTION_COMMITMENT'],
  cautionInterventionTypes:['PERMISSION_BASED_INFORMATION','REFRAME'],
  contraindications:['belirli bir mesleği önermek','doğrulanmamış iş piyasası iddiası'],
  corePrinciples:['Karar danışanındır','Ölçüt önce netleşir','Güçlü yön ve değer birlikte okunur'],
  coachStance:'Kararı kolaylaştırır, kararı vermez.',
  professionalSourceIds:['career.construction','icf.ethics'],
  evidence:{ coachingGenerally:{grade:'B',note:'Kariyer kararı desteği koçlukta yerleşik ve talep gören bir uygulama alanıdır.'},
    underlyingPrinciple:{grade:'B',note:'Karar ölçütünün önce netleştirilmesinin seçim kalitesini artırdığı yaygın kabul görür.'},
    namedMethodology:{grade:'C',note:'Kariyer koçluğu tek bir standart yöntem değildir; çerçeveler arasında belirgin fark vardır.'},
    caution:'Sistem kimsenin mesleğini bilemez. İş piyasası hakkında hiçbir olgu iddia edilmez.' },
  tagPurposes:['DECISION','OPTION','GOAL','POSSIBILITY'],
  tagIncludeIds:['sum.thread','scale.confidence','act.first_step','para.check']
});

coachingRegisterApproachDef({
  id:'NARRATIVE_REFLECTIVE', title:'Anlatı / Yansıtıcı Çalışma', shortTitle:'Anlatı',
  description:'Kişinin kendine anlattığı hikâyeyi, tekrarlayan örüntüleri ve olmak istediği kimliği klinik olmayan biçimde inceler.',
  bestFor:['kimlik soruları','tekrarlayan anlatı','anlam arayışı','olmak istenen kimlik'],
  notBestFor:['kriz','travma tedavisi','güvenlik uyarısı açık','acil eylem gerektiren durum','küçük çocukta soyut kimlik çalışması'],
  applicableContexts:['self','adult','executive','youth'], minorPolicy:'permitted_with_adaptation',
  compatibleStages:['DEEPENING','AWARENESS','CLOSING'],
  compatiblePurposes:['MEANING','PERSPECTIVE','LEARNING','CLOSURE','VALUE'],
  preferredInterventionTypes:['REFLECTION','SILENCE','OPEN_QUESTION','SUMMARY','REFRAME'],
  cautionInterventionTypes:['CHALLENGE','REFRAME'],
  contraindications:['travma çalışmasına kayma','psikoterapi taklidi','geçmişi yeniden işleme girişimi'],
  corePrinciples:['Hikâye tek değildir','Anlam sonradan kurulur','Kimlik seçimle şekillenir'],
  coachStance:'Eşlik eder, yorumlamaz.',
  professionalSourceIds:['narrative.practice','icf.ethics'],
  evidence:{ coachingGenerally:{grade:'B',note:'Yansıtıcı çalışma koçlukta yerleşik bir derinleşme biçimidir.'},
    underlyingPrinciple:{grade:'C',note:'Anlatının yeniden çerçevelenmesinin etkisi koçluk bağlamında sınırlı biçimde incelenmiştir.'},
    namedMethodology:{grade:'C',note:'Anlatı çalışmasının koçluk uyarlaması için ayrı bir kanıt tabanı bulunmamaktadır.'},
    caution:'Terapi kökenlidir. Faz 2 sınır katmanı her zaman önceliklidir; kapsam dışına çıkıldığı anda durdurulur.' },
  tagPurposes:['MEANING','PERSPECTIVE','LEARNING','CLOSURE'],
  tagIncludeIds:['reflect.mirror','reflect.feeling','silence.hold','sum.close','reframe.offer','reframe.child_story']
});

/* ══ Populate Phase 3 `compatibleApproaches` — deliberate, deterministic,
   idempotent. Questions are tagged by curated purpose lists; non-question moves
   ONLY by explicit hand-picked id. Nothing is tagged "because it might fit". ══ */
function coachingApplyApproachTags(){
  if(typeof coachingInterventionList!=='function') return {tagged:0};
  var all = coachingInterventionList();
  all.forEach(function(x){ x.compatibleApproaches = []; });
  var tagged = 0;
  coachingApproachList().forEach(function(a){
    all.forEach(function(x){
      if(a.tagExcludeIds.indexOf(x.id)>=0) return;
      var hit = false;
      if(x.isQuestion) hit = !!x.purpose && a.tagPurposes.indexOf(x.purpose)>=0;
      else hit = a.tagIncludeIds.indexOf(x.id)>=0;
      if(!hit) return;
      /* an approach barred for minors never tags a minor-only move */
      if(a.minorPolicy==='not_for_minors' &&
         x.applicableContexts.length && x.applicableContexts.every(function(c){ return c==='child'||c==='youth'; })) return;
      /* and a move must actually be reachable in one of the approach's contexts */
      var shares = x.applicableContexts.some(function(c){ return a.applicableContexts.indexOf(c)>=0; });
      if(!shares) return;
      x.compatibleApproaches.push(a.id);
      tagged++;
    });
  });
  all.forEach(function(x){ x.compatibleApproaches.sort(); });
  return {tagged:tagged, interventions:all.length};
}
var COACHING_APPROACH_TAGGING = coachingApplyApproachTags();

function coachingInterventionsForApproach(approachId, context){
  return coachingInterventionList().filter(function(x){
    if(x.compatibleApproaches.indexOf(approachId)<0) return false;
    if(context && x.applicableContexts.indexOf(context)<0) return false;
    return true;
  });
}
function coachingApproachStats(){
  var l = (typeof coachingInterventionList==='function') ? coachingInterventionList() : [];
  var counts = l.map(function(x){ return x.compatibleApproaches.length; });
  var byApproach = {};
  coachingApproachIds().forEach(function(id){ byApproach[id] = coachingInterventionsForApproach(id).length; });
  return { approaches:coachingApproachIds().length, tagging:COACHING_APPROACH_TAGGING,
    byApproach:byApproach, untagged:counts.filter(function(n){ return n===0; }).length,
    maxPerIntervention:counts.reduce(function(m,n){ return n>m?n:m; },0),
    avgPerIntervention: counts.length ? Math.round(counts.reduce(function(a,b){return a+b;},0)/counts.length*100)/100 : 0 };
}
function coachingApproachesSelfCheck(){
  return { schemaVersion:COACHING_APPROACH_SCHEMA_VERSION, approaches:coachingApproachIds(),
    minorPolicies:coachingApproachList().reduce(function(m,a){ m[a.id]=a.minorPolicy; return m; },{}),
    grades:coachingApproachList().reduce(function(m,a){ m[a.id]=a.evidenceGrade; return m; },{}),
    stats:coachingApproachStats() };
}

if(typeof window!=='undefined'){
  window.COACHING_APPROACH_SCHEMA_VERSION=COACHING_APPROACH_SCHEMA_VERSION;
  window.COACHING_MINOR_POLICIES=COACHING_MINOR_POLICIES;
  window.COACHING_APPROACH_REGISTRY=COACHING_APPROACH_REGISTRY;
  window.COACHING_APPROACH_TAGGING=COACHING_APPROACH_TAGGING;
  window.coachingRegisterApproachDef=coachingRegisterApproachDef;
  window.coachingApproach=coachingApproach; window.coachingApproachIds=coachingApproachIds;
  window.coachingApproachList=coachingApproachList;
  window.coachingApproachAllowedForContext=coachingApproachAllowedForContext;
  window.coachingApplyApproachTags=coachingApplyApproachTags;
  window.coachingInterventionsForApproach=coachingInterventionsForApproach;
  window.coachingApproachStats=coachingApproachStats;
  window.coachingApproachesSelfCheck=coachingApproachesSelfCheck;
}
