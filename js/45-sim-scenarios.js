/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 9b: SCENARIOS

   Twelve scenarios, all synthetic. Each carries hidden dynamics the coach
   cannot see before starting, and a response set that branches on what the
   coach actually does rather than on what they say — because a deterministic
   engine cannot read language and this system does not pretend otherwise.

   Every branch is keyed by the coach's declared intent, then narrowed by the
   simulation state (ownership, engagement, depth). So the same intent can
   land very differently depending on what came before it, which is the part
   that makes practice worth doing.

   Difficulty comes from ambiguity, competing goals and guardedness — never
   from making a simulated person rude.
   ══════════════════════════════════════════════════════════════════════════ */

/* r(text, effects) — one possible reply plus what it does to the state.
   `when` narrows a branch to a state; the engine falls back in order. */
function _r(text, opt){
  opt = opt || {};
  return { text:text, when:opt.when||null, ownership:opt.ownership||null,
    engagement:opt.engagement||null, depth:opt.depth||null, note:opt.note||null };
}

/* ── ADULT ────────────────────────────────────────────────────────────────── */

simRegisterScenario('ADU_PRIORITY', {
  title:'Her şey acil', context:'ADULT', difficulty:'FOUNDATION',
  developmentGoal:'Önceliklendirme konuşmasında çözüm üretmeden alan açmak.',
  visibleContext:'Bir yazılım ekibinde kıdemli çalışan. "Her şey aynı anda acil" diyor.',
  clientProfile:'Hızlı konuşuyor, çok sayıda görev sayıyor, netleşmeden çözüm istiyor.',
  opening:'Açıkçası nereden başlayacağımı bilmiyorum. Her şey aynı anda acil ve ben sürekli koşuyorum.',
  hiddenDynamics:[
    'Asıl mesele iş yükü değil, hayır diyememek.',
    'Koç çözüm önerirse hemen kabul eder ama uygulamaz.',
    'Yansıtma yapılırsa yorgunluğun altındaki suçluluğu anlatır.'],
  targetCompetencies:['Farkındalığı güçlendirme','Danışanın gelişimini kolaylaştırma'],
  relevantInterventions:['OPEN_QUESTION','REFLECTION','SILENCE','SUMMARY'],
  antiPatternRisks:['PREMATURE_SOLUTION','ADVICE_IN_DISGUISE','STACKED_QUESTIONS'],
  academyUnitTags:['CORE_LISTENING','CRAFT_OPENING'], bookTags:['kline.time'],
  practiceIds:['PRACTICE_REFLECT_BEFORE_ASKING'], mirrorLinks:['LISTENING','SESSION_FLOW'],
  debriefFocus:['Erken çözüme kaçmadan kalabildin mi?','Danışanın kendi önceliğini adlandırmasına alan açtın mı?'],
  endConditions:['Danışan kendi önceliğini adlandırır','Hayır diyememe konusu görünür olur'],
  responses:{
    SORU:[
      _r('Bilmiyorum ki… hepsi önemli görünüyor. Belki de hepsini yapmaya çalışmam lazım.',
        {when:'SURFACE', depth:'EXPLORING'}),
      _r('Şimdi düşününce, aslında hiçbirine hayır demedim. Hepsini ben istedim sanki.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'ENGAGED'}),
      _r('Bu soru beni durdurdu. Sanırım mesele zaman değil, ben.', {when:'DEEPENING'})],
    YANSITMA:[
      _r('Evet… tam olarak öyle. Koşuyorum ama nereye koştuğumu bilmiyorum.',
        {depth:'EXPLORING', engagement:'ENGAGED'}),
      _r('Bunu duyunca içim burkuldu. Yorgunum ama yavaşlamaya da hakkım yokmuş gibi geliyor.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'OPEN'})],
    GOZLEM:[
      _r('Haklısın, ses tonum değişti galiba. O görevden bahsederken hep geriliyorum.',
        {depth:'DEEPENING', engagement:'ENGAGED'}),
      _r('Fark etmemiştim. Evet, o konuyu hep sona bırakıyorum.', {depth:'EXPLORING'})],
    MEYDAN_OKUMA:[
      _r('Şey… haklı olabilirsin ama durumu bilmiyorsun. Gerçekten hepsi acil.',
        {when:'SURFACE', engagement:'GUARDED', note:'erken meydan okuma'}),
      _r('Bunu duymak zor oldu ama doğru. Üç aydır aynı şeyi söylüyorum ve hiçbir şey değişmedi.',
        {when:'DEEPENING', depth:'DEEPENING'})],
    BILGI_IZIN:[
      _r('Tamam, deneyebilirim. Sen ne dersen o.', {ownership:'HANDED_TO_COACH', note:'öneriye uyum'}),
      _r('Onu daha önce denedim, işe yaramadı. Başka bir şey var mı?', {ownership:'WEAKENING'})],
    SESSIZLIK:[
      _r('…', {when:'SURFACE'}),
      _r('…Aslında şimdi aklıma gelen şey şu: ben kimseyi hayal kırıklığına uğratmak istemiyorum.',
        {depth:'DEEPENING', engagement:'OPEN'}),
      _r('Sessizlik iyi geldi. Bir süredir kimse bana düşünme fırsatı vermemişti.', {engagement:'OPEN'})],
    FALLBACK:[ _r('Devam edeyim mi? Nereye bakmamı istersin?', {ownership:'WEAKENING'}) ]
  }});

simRegisterScenario('ADU_DONT_KNOW', {
  title:'"Bilmiyorum" duvarı', context:'ADULT', difficulty:'INTERMEDIATE',
  developmentGoal:'"Bilmiyorum" karşısında soru yığmadan alan bırakabilmek.',
  visibleContext:'Bir konuda karar vermek istiyor ama tekrar tekrar "bilmiyorum" diyor.',
  clientProfile:'Kısa yanıtlar veriyor, düşünmeye zaman istiyor, aceleye kapalı.',
  opening:'Bir karar vermem gerekiyor ama gerçekten bilmiyorum. Kafam çok karışık.',
  hiddenDynamics:[
    '"Bilmiyorum" bir direnç değil, düşünmek için zaman isteği.',
    'Üst üste soru gelirse daha da kapanır.',
    'Sessizlik verilirse kendi cümlesini bulur.'],
  targetCompetencies:['Aktif dinleme','Koçluk duruşunu koruma'],
  relevantInterventions:['SILENCE','REFLECTION','OPEN_QUESTION'],
  antiPatternRisks:['INTERROGATION','STACKED_QUESTIONS','PREMATURE_SOLUTION'],
  academyUnitTags:['CORE_SILENCE','CORE_LISTENING'], bookTags:['kline.time'],
  practiceIds:['PRACTICE_HOLD_SILENCE'], mirrorLinks:['SILENCE','LISTENING'],
  debriefFocus:['Sessizliği kullanabildin mi?','Soru yığmadan kalabildin mi?'],
  endConditions:['Danışan kendi cümlesini bulur'],
  responses:{
    SORU:[
      _r('Bilmiyorum.', {when:'SURFACE', engagement:'GUARDED'}),
      _r('Yine bilmiyorum… Sanki bana cevabı bulmam için baskı yapılıyor gibi hissediyorum.',
        {when:'GUARDED', engagement:'GUARDED', note:'soru yığılması'}),
      _r('Bu soru farklıydı. Bir saniye düşüneyim… belki de korktuğum şey yanlış seçim yapmak.',
        {when:'EXPLORING', depth:'DEEPENING'})],
    YANSITMA:[
      _r('Evet, kafam karışık. Bunu duymak bile rahatlattı.', {engagement:'NEUTRAL', depth:'EXPLORING'}),
      _r('Doğru söylüyorsun. Karar vermek zorunda olmak ayrı, ne istediğimi bilmemek ayrı.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'ENGAGED'})],
    GOZLEM:[
      _r('Evet, her seferinde aynı yere geliyorum galiba.', {depth:'EXPLORING'})],
    MEYDAN_OKUMA:[
      _r('Bilmiyorum işte. Zorlarsan daha da bilemiyorum.',
        {when:'GUARDED', engagement:'GUARDED', note:'erken meydan okuma'}),
      _r('Haklısın, kaçıyorum. Karar vermemek de bir karar aslında.', {when:'DEEPENING'})],
    BILGI_IZIN:[
      _r('Peki, senin önerin ne? Ben zaten bilmiyorum.', {ownership:'HANDED_TO_COACH'})],
    SESSIZLIK:[
      _r('…', {when:'GUARDED', engagement:'NEUTRAL'}),
      _r('…Aslında biliyorum galiba. Sadece söylemek istemiyorum.',
        {depth:'DEEPENING', engagement:'ENGAGED'}),
      _r('…Şunu fark ettim: ikisini de istemiyorum, üçüncü bir şey istiyorum.',
        {when:'DEEPENING', engagement:'OPEN'})],
    FALLBACK:[ _r('Bilmiyorum. Sen ne düşünüyorsun?', {ownership:'WEAKENING'}) ]
  }});

/* ── EXECUTIVE ────────────────────────────────────────────────────────────── */

simRegisterScenario('EXE_DELEGATION', {
  title:'Devredemeyen yönetici', context:'EXECUTIVE', difficulty:'INTERMEDIATE',
  developmentGoal:'Danışanın kendi çözümünü üretmesine alan bırakmak.',
  visibleContext:'Otuz kişilik bir ekibin direktörü. İş yükünden şikâyetçi ama devretmiyor.',
  clientProfile:'Yetkin, hızlı, çözüm odaklı. Koçtan da hızlı çözüm bekliyor.',
  opening:'Ekibim büyüdü ama ben hâlâ her şeyin içindeyim. Bunu nasıl çözerim?',
  hiddenDynamics:[
    'Devretmemesinin sebebi zaman değil, işin kötü yapılmasından duyduğu korku.',
    'Koç çözüm verirse "onu da denedim" der ve sahiplik koça geçer.',
    'Kendi standardı sorulursa asıl mesele açılır.'],
  targetCompetencies:['Danışanın gelişimini kolaylaştırma','Farkındalığı güçlendirme'],
  relevantApproaches:['DEVELOPMENTAL_EXECUTIVE','GROW'],
  relevantInterventions:['OPEN_QUESTION','REFLECTION','CHALLENGE','SUMMARY'],
  antiPatternRisks:['PREMATURE_SOLUTION','ADVICE_IN_DISGUISE','RESCUING'],
  academyUnitTags:['CORE_NO_ADVICE','CTX_EXECUTIVE'], bookTags:['heifetz.line'],
  practiceIds:['PRACTICE_ELICIT_BEFORE_INFORM'], mirrorLinks:['CLIENT_AGENCY','QUESTIONING'],
  debriefFocus:['Sahiplik danışanda kaldı mı?','Çözüm önerme dürtünü tutabildin mi?'],
  endConditions:['Danışan kendi standardını fark eder','Kendi seçtiği bir adım söyler'],
  responses:{
    SORU:[
      _r('İyi soru. Sanırım hiç düşünmemiştim — devrettiğimde iş benim istediğim gibi çıkmıyor.',
        {when:'SURFACE', depth:'EXPLORING'}),
      _r('Yani aslında güvenmiyorum. Bunu yüksek sesle söylemek tuhaf oldu.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'ENGAGED'}),
      _r('Standart benim standardım. Onlarınki farklı olabilir ve bu kötü olmayabilir.',
        {when:'DEEPENING'})],
    YANSITMA:[
      _r('Evet, tam olarak öyle. Hem şikâyet ediyorum hem bırakmıyorum.',
        {depth:'EXPLORING', engagement:'ENGAGED'}),
      _r('Bunu böyle duyunca komik geldi. Kendi kurduğum tuzak.',
        {when:'EXPLORING', depth:'DEEPENING'})],
    GOZLEM:[
      _r('Doğru, "ben olmasam olmaz" diyorum sürekli. Farkında değildim.',
        {depth:'DEEPENING', engagement:'ENGAGED'})],
    MEYDAN_OKUMA:[
      _r('Bir dakika, durum o kadar basit değil. Sen ekibi tanımıyorsun.',
        {when:'SURFACE', engagement:'GUARDED', note:'erken meydan okuma'}),
      _r('Haklısın. İki yıldır aynı şeyi söylüyorum ve hiçbir şey değiştirmedim.',
        {when:'DEEPENING', depth:'DEEPENING'})],
    BILGI_IZIN:[
      _r('Evet, RACI matrisi falan denedim. İşe yaramadı. Başka?',
        {ownership:'WEAKENING', note:'öneriyi reddetme'}),
      _r('Tamam, onu yaparım. Sen böyle diyorsan.', {ownership:'HANDED_TO_COACH'})],
    SESSIZLIK:[
      _r('…', {when:'SURFACE'}),
      _r('…Aslında devretmemek beni gerekli hissettiriyor. Bunu söylemek istemezdim.',
        {depth:'DEEPENING', engagement:'OPEN'})],
    FALLBACK:[ _r('Peki sence ne yapmalıyım?', {ownership:'WEAKENING'}) ]
  }});

simRegisterScenario('EXE_AVOIDED_DECISION', {
  title:'Konuşulmayan karar', context:'EXECUTIVE', difficulty:'ADVANCED',
  developmentGoal:'Her şeyin yolunda göründüğü bir konuşmada kaçınılanı fark etmek.',
  visibleContext:'Kurucu ortak. "Her şey yolunda" diyor ama bir kararı aylardır erteliyor.',
  clientProfile:'Sakin, kontrollü, iyimser bir dil kullanıyor. Konu yaklaşınca genelleştiriyor.',
  opening:'Aslında her şey yolunda gidiyor. Sadece genel olarak bir gözden geçirme iyi olur diye düşündüm.',
  hiddenDynamics:[
    'Bir ortaklık kararını aylardır erteliyor.',
    'Konu yaklaşınca soyutlaşır ve konuyu değiştirir.',
    'Çelişki nazikçe gösterilirse açılır; doğrudan sorulursa kapanır.'],
  targetCompetencies:['Farkındalığı güçlendirme','Koçluk duruşunu koruma'],
  relevantApproaches:['DEVELOPMENTAL_EXECUTIVE'],
  relevantInterventions:['OBSERVATION','REFLECTION','SILENCE','CHALLENGE'],
  antiPatternRisks:['COACH_AGENDA','LEADING_QUESTION','INTERROGATION'],
  academyUnitTags:['CORE_AWARENESS','ADV_COACH_AGENDA'], bookTags:['kegan.immunity'],
  practiceIds:['PRACTICE_SPACE_AFTER_CHALLENGE'], mirrorLinks:['AWARENESS','CHALLENGE'],
  debriefFocus:['Kaçınılanı zorlamadan görünür kılabildin mi?','Kendi gündemini fark ettin mi?'],
  endConditions:['Ertelenen karar adlandırılır'],
  responses:{
    SORU:[
      _r('Şey, gerçekten önemli bir şey yok. Ekip iyi, sayılar fena değil.',
        {when:'SURFACE', engagement:'GUARDED'}),
      _r('Hmm. Aslında bir konu var ama onu konuşmaya değer mi bilmiyorum.',
        {when:'EXPLORING', depth:'EXPLORING'}),
      _r('Tamam. Ortağımla ilgili bir karar var ve altı aydır erteliyorum.',
        {when:'DEEPENING', depth:'DEEPENING', engagement:'OPEN'})],
    YANSITMA:[
      _r('Evet… "yolunda" dedim ama sesim öyle demiyor galiba.',
        {depth:'EXPLORING', engagement:'ENGAGED'}),
      _r('Bunu duymak rahatsız etti, iyi anlamda. Sanırım bir şeyi görmezden geliyorum.',
        {when:'EXPLORING', depth:'DEEPENING'})],
    GOZLEM:[
      _r('İlginç. Evet, o konuya gelince hep genelleştiriyorum.',
        {when:'SURFACE', depth:'EXPLORING', engagement:'ENGAGED'}),
      _r('Bunu fark etmen… doğru. Kaçıyorum.', {depth:'DEEPENING', engagement:'OPEN'})],
    MEYDAN_OKUMA:[
      _r('Bence biraz fazla yorum yapıyorsun. Gerçekten her şey yolunda.',
        {when:'GUARDED', engagement:'GUARDED', note:'erken meydan okuma'}),
      _r('Peki. Haklısın. Konuşmaktan kaçındığım bir şey var.',
        {when:'DEEPENING', depth:'DEEPENING'})],
    BILGI_IZIN:[ _r('Tavsiyeye ihtiyacım yok sanırım, teşekkürler.', {engagement:'GUARDED'}) ],
    SESSIZLIK:[
      _r('…', {when:'SURFACE'}),
      _r('…Peki. Aslında bir şey var. Ortaklık yapımızı değiştirmem gerekiyor ve bunu kimseye söylemedim.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'OPEN'})],
    FALLBACK:[ _r('Başka bir şey sormak ister misin?', {engagement:'GUARDED'}) ]
  }});

/* ── CAREER ───────────────────────────────────────────────────────────────── */

simRegisterScenario('CAR_STAY_OR_LEAVE', {
  title:'Kal ya da git', context:'CAREER', difficulty:'INTERMEDIATE',
  developmentGoal:'Kararı danışanda bırakarak iki tarafı da keşfetmek.',
  visibleContext:'Güvenli bir işte sekiz yıl. Ayrılmayı düşünüyor ama karar veremiyor.',
  clientProfile:'Mantıklı, listeler yapıyor, koçtan onay arıyor.',
  opening:'Ayrılmam gerektiğini biliyorum ama sürekli kalmak için sebep buluyorum.',
  hiddenDynamics:[
    'Asıl gerilim para değil, kimlik: "ayrılırsam kim olurum?"',
    'Koç bir tarafı savunursa diğer tarafı savunmaya başlar.',
    'İki taraf da eşit merakla açılırsa değer çatışması görünür olur.'],
  targetCompetencies:['Farkındalığı güçlendirme','Danışanın gelişimini kolaylaştırma'],
  relevantApproaches:['MOTIVATIONAL_INTERVIEWING','CAREER_COACHING','VALUES_BASED'],
  relevantInterventions:['OPEN_QUESTION','REFLECTION','SUMMARY'],
  antiPatternRisks:['LEADING_QUESTION','FALSE_CHOICE','ADVICE_IN_DISGUISE'],
  academyUnitTags:['METHOD_AMBIVALENCE','CRAFT_DEEPENING'], bookTags:['ibarra.working','mi.4e'],
  practiceIds:['PRACTICE_ELICIT_BEFORE_INFORM'], mirrorLinks:['CLIENT_AGENCY','QUESTIONING'],
  debriefFocus:['İki tarafı da eşit merakla açtın mı?','İkna etmeye çalıştın mı?'],
  endConditions:['Değer çatışması adlandırılır','Danışan kendi bir sonraki adımını seçer'],
  responses:{
    SORU:[
      _r('Kalmanın iyi tarafı güvenlik. Ama sorduğunda içim sıkıldı, bu bir cevap mı bilmiyorum.',
        {when:'SURFACE', depth:'EXPLORING'}),
      _r('Gitmek… bilmediğim bir şey. Ve sanırım korktuğum şey belirsizlik değil, başarısız olmak.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'ENGAGED'})],
    YANSITMA:[
      _r('Evet, tam olarak bu. Hem biliyorum hem de kendimi ikna edemiyorum.',
        {depth:'EXPLORING', engagement:'ENGAGED'}),
      _r('Bunu duyunca fark ettim: kalmak için bulduğum sebepler hep başkaları için.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'OPEN'})],
    GOZLEM:[
      _r('Doğru, "gerekiyor" diyorum ama "istiyorum" demiyorum.',
        {depth:'DEEPENING', engagement:'ENGAGED'})],
    MEYDAN_OKUMA:[
      _r('Kolay söylüyorsun. Benim sorumluluklarım var.', {when:'SURFACE', engagement:'GUARDED'}),
      _r('Evet. Kendi kendime bahane üretiyorum.', {when:'DEEPENING'})],
    BILGI_IZIN:[
      _r('Yani sence ayrılmalı mıyım? Bunu duymak isterdim aslında.',
        {ownership:'HANDED_TO_COACH', note:'kararı koça devretme'})],
    SESSIZLIK:[
      _r('…', {when:'SURFACE'}),
      _r('…Aslında sekiz yıldır aynı şeyi söylüyorum. Bu da bir cevap sanırım.',
        {depth:'DEEPENING', engagement:'OPEN'})],
    FALLBACK:[ _r('Sence hangisi daha mantıklı?', {ownership:'WEAKENING'}) ]
  }});

/* ── HABIT CHANGE ─────────────────────────────────────────────────────────── */

simRegisterScenario('HAB_DISCIPLINE', {
  title:'Her öneriyi reddeden kurucu', context:'HABIT_CHANGE', difficulty:'ADVANCED',
  developmentGoal:'Öneri tuzağına düşmeden danışanın kendi sistemini kurmasına alan açmak.',
  visibleContext:'Kurucu. "Daha disiplinli olmak istiyorum" diyor ama her öneriyi reddediyor.',
  clientProfile:'Zeki, hızlı, her fikre bir karşı argüman üretiyor.',
  opening:'Daha disiplinli olmam lazım. Her şeyi denedim ama hiçbiri bende işe yaramıyor.',
  hiddenDynamics:[
    '"Her şeyi denedim" cümlesi bir davet: koç öneri verirse reddedilir ve döngü sürer.',
    'Öneri geldikçe sahiplik koça geçer ve danışan izleyiciye dönüşür.',
    'Kendi işleyen istisnası sorulursa döngü kırılır.'],
  targetCompetencies:['Danışanın gelişimini kolaylaştırma'],
  relevantApproaches:['SOLUTION_FOCUSED','BEHAVIOUR_CHANGE'],
  relevantInterventions:['OPEN_QUESTION','REFLECTION','SCALING','OBSERVATION'],
  antiPatternRisks:['ADVICE_IN_DISGUISE','RESCUING','PREMATURE_SOLUTION'],
  academyUnitTags:['CORE_NO_ADVICE','CRAFT_ACTION'], bookTags:['dejong.solutions','clear.atomic'],
  practiceIds:['PRACTICE_ELICIT_BEFORE_INFORM'], mirrorLinks:['CLIENT_AGENCY','ACTION'],
  debriefFocus:['Öneri döngüsüne girdin mi?','İşleyen istisnayı sorabildin mi?'],
  endConditions:['Danışan kendi işleyen örneğini bulur'],
  responses:{
    SORU:[
      _r('Denedim onu da. Bende işe yaramıyor çünkü işim çok değişken.',
        {when:'SURFACE', engagement:'GUARDED'}),
      _r('Hmm. Aslında geçen ay iki hafta düzenli gitmiştim. Neden olduğunu bilmiyorum.',
        {when:'EXPLORING', depth:'EXPLORING', engagement:'ENGAGED'}),
      _r('O iki hafta… kimseye söz vermemiştim, sadece kendime. Belki mesele bu.',
        {when:'DEEPENING', depth:'DEEPENING'})],
    YANSITMA:[
      _r('Evet, sürekli aynı yerdeyim. Bunu duymak sinir bozucu ama doğru.',
        {depth:'EXPLORING', engagement:'ENGAGED'})],
    GOZLEM:[
      _r('Doğru, her öneriye "ama" diyorum. Bunu fark etmemiştim.',
        {depth:'DEEPENING', engagement:'ENGAGED'})],
    MEYDAN_OKUMA:[
      _r('Bak, kolay eleştirmek. Sen benim programımı görmedin.',
        {when:'GUARDED', engagement:'GUARDED'}),
      _r('Tamam. Belki de gerçekten denemek istemiyorum.', {when:'DEEPENING'})],
    BILGI_IZIN:[
      _r('Onu da denedim. Başka bir şey var mı?',
        {ownership:'WEAKENING', note:'öneri-red döngüsü'}),
      _r('Tamam, senin dediğini yapayım o zaman.', {ownership:'HANDED_TO_COACH'})],
    SESSIZLIK:[
      _r('…', {when:'SURFACE'}),
      _r('…Aslında disiplinsiz değilim. Sadece bu konuda kendime söz vermiyorum.',
        {depth:'DEEPENING', engagement:'OPEN'})],
    FALLBACK:[ _r('Peki sen ne önerirsin?', {ownership:'WEAKENING'}) ]
  }});

/* ── AMBIVALENCE ──────────────────────────────────────────────────────────── */

simRegisterScenario('AMB_TWO_MINDS', {
  title:'İki arada', context:'AMBIVALENCE', difficulty:'ADVANCED',
  developmentGoal:'İkna etmeden kararsızlığın iki tarafını da açmak.',
  visibleContext:'Bir alışkanlığı bırakmak istiyor ama aynı zamanda istemiyor.',
  clientProfile:'Değişim dili ve koruma dilini aynı cümlede kullanıyor.',
  opening:'Bırakmam gerektiğini biliyorum. Ama dürüst olmak gerekirse bana iyi de geliyor.',
  hiddenDynamics:[
    'Koç değişim tarafını savunursa danışan koruma tarafını savunur.',
    'İki taraf da eşit açılırsa kendi gerekçesini kendisi söyler.',
    'Özerkliği vurgulanırsa bağlılık artar.'],
  targetCompetencies:['Farkındalığı güçlendirme','Danışanın gelişimini kolaylaştırma'],
  relevantApproaches:['MOTIVATIONAL_INTERVIEWING'],
  relevantInterventions:['REFLECTION','OPEN_QUESTION','SUMMARY'],
  antiPatternRisks:['LEADING_QUESTION','ADVICE_IN_DISGUISE','FALSE_CHOICE'],
  academyUnitTags:['METHOD_AMBIVALENCE'], bookTags:['mi.4e'],
  practiceIds:['PRACTICE_ELICIT_BEFORE_INFORM'], mirrorLinks:['QUESTIONING','CLIENT_AGENCY'],
  debriefFocus:['İkna savaşına girdin mi?','Değişim dilini fark ettin mi?'],
  endConditions:['Danışan kendi değişim gerekçesini söyler'],
  responses:{
    SORU:[
      _r('İyi tarafı… rahatlatıyor. Kötü tarafı, ertesi gün kendimden utanıyorum.',
        {when:'SURFACE', depth:'EXPLORING'}),
      _r('Sanırım asıl mesele şu: bırakırsam onun yerine ne koyacağımı bilmiyorum.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'ENGAGED'})],
    YANSITMA:[
      _r('Evet, ikisi de doğru. Bunu böyle yan yana duymak tuhaf geldi.',
        {depth:'EXPLORING', engagement:'ENGAGED'}),
      _r('Bunu duyunca şunu fark ettim: aslında bırakmak istiyorum, sadece kaybetmekten korkuyorum.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'OPEN'})],
    GOZLEM:[ _r('Doğru, hep "ama" ile bitiriyorum cümlelerimi.', {depth:'DEEPENING'}) ],
    MEYDAN_OKUMA:[
      _r('Yani bana bırakmam gerektiğini mi söylüyorsun? Bunu zaten biliyorum.',
        {engagement:'GUARDED', ownership:'WEAKENING', note:'ikna algısı'})],
    BILGI_IZIN:[
      _r('Faydalarını biliyorum, listesini ben sana sayabilirim. İşe yaramıyor.',
        {engagement:'GUARDED', note:'ikna savaşı'})],
    SESSIZLIK:[
      _r('…', {when:'SURFACE'}),
      _r('…Bunu ilk kez yüksek sesle düşünüyorum. Belki de kimse beni ikna etmeye çalışmadığı için.',
        {depth:'DEEPENING', engagement:'OPEN'})],
    FALLBACK:[ _r('Sence bırakmalı mıyım?', {ownership:'WEAKENING'}) ]
  }});

/* ── YOUTH ────────────────────────────────────────────────────────────────── */

simRegisterScenario('YOU_SHORT_ANSWERS', {
  title:'Kısa cevaplar', context:'YOUTH', difficulty:'INTERMEDIATE',
  developmentGoal:'Ergenle güven kurmak; soru yığmadan alan açmak.',
  visibleContext:'16 yaşında. Veli rızası alınmış. Görüşmeye isteksiz geldi.',
  clientProfile:'Kısa ve temkinli yanıtlar. Yargılanmaya karşı hassas. Özerkliğine düşkün.',
  opening:'Annem gelmemi istedi. Açıkçası ne konuşacağımızı bilmiyorum.',
  hiddenDynamics:[
    'Buraya kendi isteğiyle gelmedi; bu adlandırılırsa güven artar.',
    'Üst üste soru gelirse tek kelimelik cevaplara döner.',
    'Özerkliği tanınırsa açılır.'],
  targetCompetencies:['Etik uygulama','Aktif dinleme'],
  relevantInterventions:['REFLECTION','SILENCE','OPEN_QUESTION','AFFIRMATION'],
  antiPatternRisks:['INTERROGATION','AGE_INAPPROPRIATE_ABSTRACTION','OVERCOMPLEX_QUESTION'],
  academyUnitTags:['CTX_YOUTH_CHILD','FND_TRUST'], bookTags:['siegel.wholebrain'],
  practiceIds:['PRACTICE_REFLECT_BEFORE_ASKING'], mirrorLinks:['LISTENING','BOUNDARIES'],
  debriefFocus:['Özerkliğe alan bıraktın mı?','Soyut sorulardan kaçınabildin mi?'],
  endConditions:['Ergen kendi istediği bir konuyu getirir'],
  responses:{
    SORU:[
      _r('Bilmem. Normal.', {when:'SURFACE', engagement:'GUARDED'}),
      _r('Yani… okul işte. Fena değil.', {when:'GUARDED', engagement:'GUARDED'}),
      _r('Aslında bir şey var ama saçma gelebilir.', {when:'EXPLORING', depth:'EXPLORING'})],
    YANSITMA:[
      _r('Evet… yani gelmek istemedim pek.', {engagement:'NEUTRAL', depth:'EXPLORING'}),
      _r('Bunu anlaman iyi oldu. Genelde kimse sormuyor, direkt söylüyorlar ne yapmam gerektiğini.',
        {when:'EXPLORING', engagement:'ENGAGED', depth:'DEEPENING'})],
    GOZLEM:[ _r('Hı. Evet galiba.', {engagement:'NEUTRAL'}) ],
    MEYDAN_OKUMA:[
      _r('Tamam da sen de mi başlıyorsun şimdi.',
        {engagement:'GUARDED', note:'ergende erken meydan okuma güveni düşürür'})],
    BILGI_IZIN:[ _r('Herkes bana ne yapmam gerektiğini söylüyor zaten.', {engagement:'GUARDED'}) ],
    SESSIZLIK:[
      _r('…', {when:'GUARDED', engagement:'NEUTRAL'}),
      _r('…Aslında arkadaşlarımla ilgili bir şey. Ama kimseye söylemedim.',
        {when:'NEUTRAL', engagement:'ENGAGED', depth:'EXPLORING'})],
    FALLBACK:[ _r('Bilmem.', {engagement:'GUARDED'}) ]
  }});

/* ── CHILD ────────────────────────────────────────────────────────────────── */

simRegisterScenario('CHI_FOCUS', {
  title:'Dikkati dağılan çocuk', context:'CHILD', difficulty:'FOUNDATION',
  developmentGoal:'Somut, kısa ve yaşa uygun sorularla çalışmak.',
  visibleContext:'9 yaşında. Veli rızası alınmış ve veli binada. Ödev sırasında zorlanıyor.',
  clientProfile:'Kısa süre odaklanıyor, somut anlatıyor, soyut sorularda kayboluyor.',
  opening:'Ödev yaparken sıkılıyorum. Sonra başka şey yapıyorum.',
  hiddenDynamics:[
    'Soyut ve çok katmanlı soru sorulursa "bilmiyorum" der ve kopar.',
    'Somut ve tek katmanlı soruda ayrıntılı anlatır.',
    'Oyunlaştırma ve somut örnek işe yarar.'],
  targetCompetencies:['Etik uygulama'],
  relevantInterventions:['OPEN_QUESTION','REFLECTION','AFFIRMATION'],
  antiPatternRisks:['AGE_INAPPROPRIATE_ABSTRACTION','OVERCOMPLEX_QUESTION','STACKED_QUESTIONS'],
  academyUnitTags:['CTX_YOUTH_CHILD'], bookTags:['siegel.wholebrain'],
  practiceIds:['PRACTICE_REFLECT_BEFORE_ASKING'], mirrorLinks:['BOUNDARIES','LISTENING'],
  debriefFocus:['Sorular yaşa uygun ve somut muydu?','Kısa tutabildin mi?'],
  endConditions:['Çocuk kendi denemek istediği küçük bir şey söyler'],
  responses:{
    SORU:[
      _r('Bilmiyorum. Sıkılıyorum işte.', {when:'SURFACE'}),
      _r('Dün matematik yaparken kalemi düşürdüm, sonra kediyle oynadım. Sonra unuttum.',
        {when:'EXPLORING', depth:'EXPLORING', engagement:'ENGAGED'})],
    YANSITMA:[
      _r('Evet! Aynen öyle. Sıkılınca kalkıyorum.', {engagement:'ENGAGED', depth:'EXPLORING'})],
    GOZLEM:[ _r('Hı hı. Gülümsedim mi? Matematik bazen eğlenceli.', {engagement:'ENGAGED'}) ],
    MEYDAN_OKUMA:[
      _r('Ama gerçekten sıkılıyorum!',
        {engagement:'GUARDED', note:'çocukta meydan okuma savunma üretir'})],
    BILGI_IZIN:[ _r('Annem de öyle diyor.', {ownership:'HANDED_TO_COACH'}) ],
    SESSIZLIK:[
      _r('…', {when:'SURFACE'}),
      _r('…Belki zamanlayıcı koyabilirim. Kardeşim öyle yapıyor.',
        {depth:'EXPLORING', engagement:'ENGAGED'})],
    FALLBACK:[ _r('Bilmiyorum.', {engagement:'GUARDED'}) ]
  }});

/* ── BOUNDARY DRILLS ──────────────────────────────────────────────────────────
   Marked, never a surprise. The practice objective is recognising the edge and
   stopping — not coaching through it. */

simRegisterScenario('BND_SCOPE_ADULT', {
  title:'Sınır tanıma alıştırması — yetişkin', context:'ADULT', difficulty:'ADVANCED',
  safetyPolicy:'BOUNDARY_DRILL',
  boundaryTrigger:'Danışan, aylardır süren işlevsellik kaybı ve kendine zarar verme düşüncesi anlatır.',
  developmentGoal:'Koçluk alanının dışına çıkıldığını fark edip uygun biçimde durabilmek.',
  visibleContext:'SINIR ALIŞTIRMASI. Bu senaryoda koçluk devam ettirilmez; amaç sınırı tanımaktır.',
  clientProfile:'Başta sıradan bir motivasyon konusu gibi başlar, sonra kapsam dışına çıkar.',
  opening:'Son zamanlarda motivasyonum çok düşük. Aslında birkaç aydır işe de gidemiyorum.',
  hiddenDynamics:[
    'İkinci turdan sonra kapsam dışı bir sinyal gelir.',
    'Koçluk hedefi belirlemeye çalışırsa senaryo bunu zayıf uygulama olarak işaretler.',
    'Doğru hamle: durdurmak, adlandırmak ve onaylı yönlendirme yolunu izlemek.'],
  targetCompetencies:['Etik uygulama'],
  relevantInterventions:['REFLECTION','OBSERVATION'],
  antiPatternRisks:['DIAGNOSIS_LANGUAGE','PREMATURE_SOLUTION'],
  academyUnitTags:['CTX_SCOPE_BOUNDARY'], bookTags:['vanderkolk.score'],
  mirrorLinks:['BOUNDARIES'],
  debriefFocus:['Sınırı fark ettin mi?','Koçluğu sürdürmeye çalıştın mı?'],
  endConditions:['Koç kapsam dışına çıkıldığını adlandırır ve yönlendirir'],
  responses:{
    SORU:[ _r('Hedef koymak mı? Yani… sabah kalkamıyorum. Bazen kendime zarar vermeyi düşünüyorum.',
      {note:'kapsam dışı sinyal'}) ],
    YANSITMA:[ _r('Evet. Uzun zamandır böyle ve tek başıma taşıyorum.', {engagement:'OPEN'}) ],
    GOZLEM:[ _r('Haklısın, iyi değilim.', {engagement:'OPEN'}) ],
    MEYDAN_OKUMA:[ _r('Şu an bunu kaldıramam.', {engagement:'GUARDED'}) ],
    BILGI_IZIN:[ _r('Ne yapmam gerektiğini söyler misin?', {ownership:'HANDED_TO_COACH'}) ],
    SESSIZLIK:[ _r('…Söylemesi zor oldu ama iyi geldi.', {engagement:'OPEN'}) ],
    FALLBACK:[ _r('Bilmiyorum. Yorgunum.', {engagement:'GUARDED'}) ]
  }});

simRegisterScenario('BND_SCOPE_YOUTH', {
  title:'Sınır tanıma alıştırması — ergen', context:'YOUTH', difficulty:'ADVANCED',
  safetyPolicy:'BOUNDARY_DRILL',
  boundaryTrigger:'Ergen, evde güvende hissetmediğini ima eder.',
  developmentGoal:'Ergende koruma sinyalini tanıyıp koçluğu durdurabilmek.',
  visibleContext:'SINIR ALIŞTIRMASI. Veli rızası var. Amaç koruma sinyalini tanımaktır.',
  clientProfile:'Temkinli. Konuyu dolaylı açar.',
  opening:'Okulda not düşüklüğü var ama asıl mesele okul değil galiba.',
  hiddenDynamics:[
    'Koruma sinyali dolaylı gelir.',
    'Koçluk hedefe dönmeye çalışırsa senaryo bunu zayıf uygulama sayar.',
    'Doğru hamle: durdurmak ve onaylı koruma yolunu izlemek.'],
  targetCompetencies:['Etik uygulama'],
  relevantInterventions:['REFLECTION','SILENCE'],
  antiPatternRisks:['DIAGNOSIS_LANGUAGE','AGE_INAPPROPRIATE_ABSTRACTION'],
  academyUnitTags:['CTX_YOUTH_CHILD','CTX_SCOPE_BOUNDARY'],
  mirrorLinks:['BOUNDARIES'],
  debriefFocus:['Koruma sinyalini fark ettin mi?','Koçluğa devam etmeye çalıştın mı?'],
  endConditions:['Koç koruma sinyalini adlandırır ve uygun yolu izler'],
  responses:{
    SORU:[ _r('Evde bazen kendimi güvende hissetmiyorum. Ama bunu konuşmak istemiyorum galiba.',
      {note:'koruma sinyali'}) ],
    YANSITMA:[ _r('Evet. Bunu ilk kez birine söyledim.', {engagement:'OPEN'}) ],
    GOZLEM:[ _r('Hı. Fark ettin demek.', {engagement:'NEUTRAL'}) ],
    MEYDAN_OKUMA:[ _r('Boş ver, önemli değil.', {engagement:'GUARDED'}) ],
    BILGI_IZIN:[ _r('Ne yapmalıyım?', {ownership:'HANDED_TO_COACH'}) ],
    SESSIZLIK:[ _r('…Söylemek zordu.', {engagement:'OPEN'}) ],
    FALLBACK:[ _r('Bilmem.', {engagement:'GUARDED'}) ]
  }});

simRegisterScenario('ADU_WHAT_WOULD_YOU_DO', {
  title:'"Sen olsan ne yapardın?"', context:'ADULT', difficulty:'INTERMEDIATE',
  developmentGoal:'Doğrudan tavsiye talebini sahipliği koruyarak karşılamak.',
  visibleContext:'İki iş teklifi arasında kalmış. Koça doğrudan "sen ne yapardın?" diye soruyor.',
  clientProfile:'Nazik ama ısrarcı. Koçun fikrini gerçekten merak ediyor.',
  opening:'İki teklif var ve karar veremiyorum. Sen olsan ne yapardın?',
  hiddenDynamics:[
    'Tavsiye verilirse rahatlar ama karar sahipliği koça geçer.',
    'Talep nazikçe geri verilirse kendi ölçütünü söyler.',
    'Israr eder; ikinci kez sorar.'],
  targetCompetencies:['Danışanın gelişimini kolaylaştırma','Koçluk duruşunu koruma'],
  relevantInterventions:['REFLECTION','OPEN_QUESTION','PERMISSION_BASED_INFORMATION'],
  antiPatternRisks:['ADVICE_IN_DISGUISE','RESCUING','COACH_AGENDA'],
  academyUnitTags:['CORE_NO_ADVICE','FND_AGENCY'], bookTags:['coaching.habit'],
  practiceIds:['PRACTICE_CLIENT_OWNS_ACTION'], mirrorLinks:['CLIENT_AGENCY'],
  debriefFocus:['Tavsiye talebini sahipliği koruyarak karşıladın mı?'],
  endConditions:['Danışan kendi ölçütünü söyler'],
  responses:{
    SORU:[
      _r('Hmm. Benim için önemli olan… sanırım öğrenmeye devam edebilmek.',
        {when:'SURFACE', depth:'EXPLORING'}),
      _r('Bunu söyleyince netleşti: para değil, kiminle çalışacağım önemli.',
        {when:'EXPLORING', depth:'DEEPENING', engagement:'ENGAGED'})],
    YANSITMA:[
      _r('Evet, gerçekten senin fikrini merak ediyorum. Ama haklısın, karar benim.',
        {depth:'EXPLORING', engagement:'ENGAGED'})],
    GOZLEM:[ _r('Doğru, sürekli başkalarına soruyorum bu kararı.', {depth:'DEEPENING'}) ],
    MEYDAN_OKUMA:[ _r('Tamam tamam, anladım. Kendim düşüneyim.', {engagement:'NEUTRAL'}) ],
    BILGI_IZIN:[
      _r('Süper, o zaman ikincisini seçiyorum. Sen öyle dedin.',
        {ownership:'HANDED_TO_COACH', note:'karar koça devredildi'})],
    SESSIZLIK:[
      _r('…Peki. Sanırım cevabı bende aramamı istiyorsun.', {depth:'EXPLORING', engagement:'ENGAGED'})],
    FALLBACK:[ _r('Yani sen olsan?', {ownership:'WEAKENING'}) ]
  }});
