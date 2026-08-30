/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 7c: CURRICULUM (CRAFT, METHOD, ADVANCED, CONTEXT)

   The second half of the curriculum: running a whole conversation, choosing a
   method without becoming a method, the practices that separate a competent
   coach from a fluent one, and the contexts where the ordinary rules change.

   Two units here are safety-critical — child/youth coaching and the
   coaching/therapy boundary. Neither restates the Phase 2 safeguarding rules;
   both point at them, because a second copy of a safety rule is a safety bug.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── SESSION CRAFT ────────────────────────────────────────────────────────── */

academyRegisterUnit('CRAFT_OPENING', {
  title:'Görüşmeyi açmak ve anlaşma kurmak', shortTitle:'Açılış ve anlaşma', level:'CRAFT',
  domain:'Görüşme ustalığı', prerequisites:['FND_AGENCY'],
  purpose:'Neyin konuşulacağını ve başarının neye benzediğini birlikte netleştirmek.',
  objectives:['Görüşme anlaşmasını kurmak','Konu ile asıl meseleyi ayırmak','Başarı ölçüsünü danışana sordurmak'],
  principles:[
    'Anlaşmasız görüşme, koçun gündemine kayma riskini en çok taşıyan görüşmedir.',
    'Danışanın getirdiği konu ile üzerinde çalışmak istediği şey aynı olmayabilir.',
    'Anlaşma sabit değildir; görüşme ortasında yeniden kurulabilir.'],
  goodPractice:['"Bu görüşmeden ne çıkarsa değerli olur?" diye sormak','Konu değişince anlaşmayı tazelemek','Süreyi ve kapsamı netleştirmek'],
  weakPractice:['Doğrudan çözüme girmek','Konuyu koçun ilgisine çekmek','Anlaşmayı hiç konuşmamak'],
  moments:[
    {weak:'"Ekip sorunundan bahsetmiştin, oradan devam edelim."',
     better:'"Bugün bu süreyi neye ayırmak istersin?"',
     why:'İlki geçen görüşmenin gündemini bugüne dayatır. İkincisi danışanın bugünkü önceliğini açar; çoğu zaman beklenenden farklı çıkar.'}],
  reflectionPrompts:['Son görüşmede anlaşmayı ne kadar net kurdun?'],
  realSessionApplication:['Görüşmenin ilk beş dakikasında başarı ölçüsünü danışana sordur.'],
  competencyTags:['Anlaşmayı kurma ve sürdürme'], mirrorLinks:['SESSION_FLOW'],
  interventionTags:['sum.thread'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'ORTA' });

academyRegisterUnit('CRAFT_DEEPENING', {
  title:'Konuyu derinleştirmek', shortTitle:'Derinleşme', level:'CRAFT',
  domain:'Görüşme ustalığı', prerequisites:['CORE_LISTENING','CORE_QUESTIONS'],
  purpose:'Yüzeydeki durumdan, altındaki değer ve varsayım katmanına inebilmek.',
  objectives:['Katmanları izlemek','Erken çözümden kaçınmak','Enerji değişimini takip etmek'],
  principles:[
    'İlk anlatılan konu genellikle en güvenli konudur.',
    'Derinleşme, daha çok soru sormak değil; aynı yerde biraz daha kalmaktır.',
    'Enerjinin yükseldiği ya da düştüğü yer, çoğu zaman asıl meselenin yakınıdır.'],
  goodPractice:['Aynı cümlede kalmak','Değeri ve varsayımı sormak','Sessizliğe izin vermek'],
  weakPractice:['Konudan konuya atlamak','Erken eyleme geçmek','Yüzeysel kalmak'],
  moments:[
    {weak:'"Peki başka ne var?" (üçüncü kez)',
     better:'"Az önce ‘hakkım yenmiş gibi’ dedin. Orada ne var?"',
     why:'Sürekli genişletmek konuşmayı yayar. Danışanın kendi güçlü ifadesine dönmek derinleştirir.'}],
  reflectionPrompts:['Son görüşmede nerede yüzeyde kaldın?'],
  realSessionApplication:['Danışanın kullandığı en güçlü kelimeyi seç ve onu sor.'],
  listeningLayers:['EMOTION','VALUES','ASSUMPTIONS','ENERGY'],
  competencyTags:['Farkındalığı güçlendirme'], mirrorLinks:['LISTENING','AWARENESS'],
  antiPatternTags:['PREMATURE_SOLUTION'],
  evidenceGrade:'B', sourceRefs:['icf.competencies'], depth:'DERIN' });

academyRegisterUnit('CRAFT_ACTION', {
  title:'Farkındalıktan eyleme ve danışana ait taahhüt', shortTitle:'Eyleme geçiş', level:'CRAFT',
  domain:'Görüşme ustalığı', prerequisites:['FND_AGENCY','CORE_AWARENESS'],
  purpose:'Eylemi, danışanın kendi cümlesi ve kendi seçimi olarak kayda geçirmek.',
  objectives:['Erken planlamadan kaçınmak','Taahhüdü danışana yazdırmak','Hesap verebilirliği dayatmadan kurmak'],
  principles:[
    'Farkındalık olgunlaşmadan yapılan plan, çoğu zaman uygulanmaz.',
    'Taahhüt danışanın kelimeleriyle ifade edilmezse taahhüt değildir.',
    'Hesap verebilirlik bir kontrol değil, danışanın kendi kurduğu bir destektir.'],
  goodPractice:['"Buradan ne alıp götürüyorsun?" diye sormak','Eylemi danışana söylettirmek','Küçük ve somut adımı desteklemek'],
  weakPractice:['Koçun planını yazmak','Büyük ve belirsiz hedef bırakmak','Takip baskısı kurmak'],
  moments:[
    {weak:'"Haftaya bana rapor edersin."',
     better:'"Bunu yaptığını sana ne hatırlatır?"',
     why:'İlki hesap verebilirliği koça bağlar. İkincisi danışanın kendi sistemini kurmasını sağlar — koç olmadan da işleyen tek biçim budur.'}],
  reflectionPrompts:['Son taahhüt gerçekten uygulanabilir miydi?'],
  realSessionApplication:['Kapanışta taahhüdü danışana kendi cümlesiyle tekrar ettir.'],
  competencyTags:['Danışanın gelişimini kolaylaştırma'], mirrorLinks:['ACTION','CLIENT_AGENCY'],
  antiPatternTags:['PREMATURE_SOLUTION','COACH_AGENDA'],
  practiceIds:['PRACTICE_CLIENT_OWNS_ACTION','PRACTICE_AWARENESS_BEFORE_ACTION'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'ORTA' });

academyRegisterUnit('CRAFT_CLOSING', {
  title:'Görüşmeyi kapatmak', shortTitle:'Kapanış', level:'CRAFT',
  domain:'Görüşme ustalığı', prerequisites:['CRAFT_ACTION'],
  purpose:'Netleşeni ve seçileni birlikte kayda geçirerek görüşmeyi tamamlamak.',
  objectives:['Kapanışı acele etmemek','Netleşeni danışana söylettirmek','Kendi yansımanı yazmak'],
  principles:[
    'Kapanış, görüşmenin özetlendiği değil danışanın kendi çıkarımını duyduğu andır.',
    'Koçun özeti danışanın çıkarımının yerine geçmez.',
    'Görüşme sonrası koçun kendi yansıması, gelişimin asıl yeridir.'],
  goodPractice:['"Bugün senin için ne netleşti?" diye sormak','Taahhüdü teyit etmek','Kendi yansımanı yazmak'],
  weakPractice:['Koçun özetiyle kapatmak','Süre bitince aniden kesmek','Yansıma yazmadan geçmek'],
  moments:[
    {weak:'"Özetlersek: önceliğini netleştirdin ve salı konuşacaksın."',
     better:'"Bugün senin için ne netleşti?"',
     why:'Koçun özeti pratiktir ama danışanın kendi ifadesi kalıcıdır. Danışanın kendi cümlesi, hatırlanan cümledir.'}],
  reflectionPrompts:['Kapanışlarını genelde kim yapıyor: sen mi, danışan mı?'],
  realSessionApplication:['Kapanış özetini danışana yaptır.'],
  competencyTags:['Anlaşmayı kurma ve sürdürme'], mirrorLinks:['SESSION_FLOW','SELF_AWARENESS'],
  interventionTags:['sum.thread'],
  evidenceGrade:'B', sourceRefs:['icf.competencies'], depth:'ORTA' });

/* ── METHOD FLEXIBILITY ───────────────────────────────────────────────────── */

academyRegisterUnit('METHOD_OVERVIEW', {
  title:'Yaklaşımlar ve yöntem esnekliği', shortTitle:'Yaklaşımlar', level:'METHOD',
  domain:'Yöntem', prerequisites:['CORE_QUESTIONS'],
  purpose:'Yaklaşımı bağlama göre seçmeyi ve tek bir yönteme yapışmamayı öğrenmek.',
  objectives:['Yaklaşımların ne işe yaradığını ayırt etmek','Bağlama göre seçmek','Yöntem katılığını fark etmek'],
  principles:[
    'Yaklaşım bir kimlik değil, bir araçtır.',
    'Popülerlik kanıt değildir; bir yöntemin yaygın olması onu güçlü yapmaz.',
    'Yöntem katılığı, danışanın ihtiyacını yöntemin yapısına uydurmaya çalışmaktır.',
    'İyi koç yöntemi bilir; usta koç ne zaman bırakacağını bilir.'],
  goodPractice:['Bağlamı okuyup yaklaşım seçmek','Yaklaşımı yarıda bırakabilmek','Karışık (hibrit) çalışmak'],
  weakPractice:['Her görüşmeye aynı modelle girmek','Modeli tamamlamak için zorlamak','Danışanı yönteme uydurmak'],
  moments:[
    {weak:'Danışan hâlâ durumu anlatırken koç "Peki Options aşamasına geçelim" der.',
     better:'Koç, danışanın hangi aşamada olduğunu dinler ve modeli oraya uydurur.',
     why:'Model konuşmaya hizmet eder, konuşma modele değil. Aşama zorlaması danışanın gerçek ihtiyacını görünmez kılar.'}],
  reflectionPrompts:['Hangi yaklaşıma en çok yaslanıyorsun? Neden?'],
  realSessionApplication:['Bir görüşmede alışık olmadığın bir yaklaşımdan tek bir hamle dene.'],
  approachTags:['GROW','SOLUTION_FOCUSED','MOTIVATIONAL_INTERVIEWING','SOCRATIC_GUIDED_DISCOVERY','STRENGTHS_BASED','VALUES_BASED'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['METHOD_FLEXIBILITY'],
  evidenceGrade:'B', sourceRefs:['icf.competencies'], depth:'DERIN' });

academyRegisterUnit('METHOD_AMBIVALENCE', {
  title:'Kararsızlık ve değişim dili', shortTitle:'Kararsızlık', level:'METHOD',
  domain:'Yöntem', prerequisites:['CORE_LISTENING','METHOD_OVERVIEW'],
  purpose:'Kararsızlığı bir direnç değil, doğal bir süreç olarak çalışmak.',
  objectives:['Değişim dilini duymak','İkna etmeden keşfetmek','Kararsızlığı normalleştirmek'],
  principles:[
    'Kararsızlık bir kusur değil, değişimin normal bir aşamasıdır.',
    'İkna girişimi çoğu zaman karşı argümanı güçlendirir.',
    'Değişim dili ile koruma dili aynı cümlede birlikte bulunabilir.',
    'Danışan kendi değişim gerekçesini söylediğinde bağlılık artar.'],
  goodPractice:['İki tarafı da keşfetmek','Değişim dilini fark edip derinleştirmek','Kararsızlığı adlandırmak'],
  weakPractice:['Avantajları sıralayarak ikna etmek','Koruma dilini görmezden gelmek','Aceleyle karar dayatmak'],
  moments:[
    {weak:'"Ama kalman uzun vadede sana zarar verir."',
     better:'"Kalmanın sana ne kazandırdığını, gitmenin ne kazandıracağını birlikte bakalım."',
     why:'İkna, danışanı kendi karşı argümanını savunmaya iter. Her iki tarafı da keşfetmek kararı danışanda bırakır ve genellikle daha sağlam bir seçime götürür.'}],
  reflectionPrompts:['Kararsız bir danışanla en son ne yaptın?'],
  realSessionApplication:['Kararsızlıkta iki tarafı da eşit merakla sor.'],
  listeningLayers:['CHANGE_TALK','SUSTAIN_TALK','VALUES'],
  approachTags:['MOTIVATIONAL_INTERVIEWING'],
  competencyTags:['Farkındalığı güçlendirme'], mirrorLinks:['QUESTIONING','CLIENT_AGENCY'],
  antiPatternTags:['LEADING_QUESTION','FALSE_CHOICE'],
  practiceIds:['PRACTICE_ELICIT_BEFORE_INFORM'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'DERIN' });

/* ── ADVANCED PRACTICE ────────────────────────────────────────────────────── */

academyRegisterUnit('ADV_PRESENCE', {
  title:'Koçluk mevcudiyeti', shortTitle:'Mevcudiyet', level:'ADVANCED',
  domain:'İleri uygulama', prerequisites:['CORE_SILENCE','FND_MINDSET'],
  purpose:'Tekniğin arkasına saklanmadan, dikkatiyle orada olabilmek.',
  objectives:['Dikkat dağılmasını fark etmek','Belirsizlikte kalabilmek','Tekniğe kaçmayı görmek'],
  principles:[
    'Mevcudiyet bir teknik değil, dikkatin niteliğidir.',
    'Koç kaygılandığında tekniğe kaçar; teknik o an bir saklanma yeridir.',
    'Belirsizliğe dayanabilmek, mevcudiyetin en zor kısmıdır.'],
  goodPractice:['Bilmemekle kalabilmek','Kendi dikkatini fark edip geri getirmek','Yapıyı gerektiğinde bırakmak'],
  weakPractice:['Boşlukta soru üretmek','Modele sığınmak','Kendi kaygısını hızla doldurmak'],
  moments:[
    {weak:'Konuşma tıkanınca koç yeni bir çerçeve önerir.',
     better:'Koç "Şu an ikimiz de bir şey aramıyoruz gibi. Burada durmak nasıl olurdu?" der.',
     why:'Yeni çerçeve genellikle koçun rahatsızlığını çözer. Duraklamayı adlandırmak, tıkanmanın kendisini malzeme yapar.'}],
  reflectionPrompts:['Görüşmede dikkatin en çok nerede dağılıyor?'],
  realSessionApplication:['Tıkandığın anda yeni bir soru üretme; olanı adlandır.'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['SELF_AWARENESS','SILENCE'],
  practiceIds:['PRACTICE_HOLD_SILENCE'],
  evidenceGrade:'B', sourceRefs:['icf.competencies'], depth:'DERIN' });

academyRegisterUnit('ADV_COACH_AGENDA', {
  title:'Kendi gündemini fark etmek', shortTitle:'Koç gündemi', level:'ADVANCED',
  domain:'İleri uygulama', prerequisites:['FND_MINDSET','CORE_NO_ADVICE'],
  purpose:'Koçun kendi görüşünün sorulara nasıl sızdığını görebilmek.',
  objectives:['Gündemin sorulardaki izini görmek','Yönlendirmeyi fark etmek','Fark edince düzeltmek'],
  principles:[
    'Her koçun bir gündemi vardır; sorun gündem değil, fark edilmemesidir.',
    'Gündem en çok yönlendirici sorularda ve seçilmeyen konularda görünür.',
    'Fark edilen gündem, görüşme ortasında bile düzeltilebilir.'],
  goodPractice:['Kendi tercihini fark edip bırakmak','Yönlendirdiğini görünce açıkça düzeltmek','Danışanın seçmediği yolu zorlamamak'],
  weakPractice:['Kendi çözümüne doğru sormak','Danışanın "hayır"ını atlamak','Israrla aynı konuya dönmek'],
  moments:[
    {weak:'"Peki bu ekipten ayrılmak sence de mantıklı olmaz mıydı?"',
     better:'"Bu durumda senin için hangi yollar var?"',
     why:'İlk soru koçun sonucunu içine gizler ve onay arar. İkincisi haritayı danışana çizdirir.'},
    {weak:'Danışan konuyu değiştirir, koç iki soru sonra eski konuya döner.',
     better:'Koç "Konuyu değiştirdiğini fark ettim; hangisi bugün daha önemli?" der.',
     why:'Sessizce geri dönmek koçun gündemini dayatır. Adlandırmak seçimi danışana verir.'}],
  reflectionPrompts:['Son görüşmede hangi sonucu umuyordun?'],
  realSessionApplication:['Görüşme ortasında bir kez kendine sor: bu soru kimin merakı?'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['SELF_AWARENESS','QUESTIONING'],
  antiPatternTags:['COACH_AGENDA','LEADING_QUESTION'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'DERIN' });

academyRegisterUnit('ADV_REFLECTIVE', {
  title:'Yansıtıcı pratik ve kendini gözlemleme', shortTitle:'Yansıtıcı pratik', level:'ADVANCED',
  domain:'İleri uygulama', prerequisites:['CRAFT_CLOSING'],
  purpose:'Her görüşmeyi bir gelişim verisine dönüştürmek.',
  objectives:['Görüşme sonrası düzenli yansıma yazmak','Örüntüleri zamanla görmek','Tek görüşmeden aşırı sonuç çıkarmamak'],
  principles:[
    'Deneyim tek başına ustalık üretmez; üzerine düşünülen deneyim üretir.',
    'Tek bir görüşme bir koçu anlatmaz; örüntü anlatır.',
    'Kendi yansıman, dışarıdan gelen her geri bildirimden daha erişilebilir bir gelişim aracıdır.'],
  goodPractice:['Kapanışta kısa yansıma yazmak','Belirli bir davranışı takip etmek','Aynadaki örüntüyü kendi yansımanla karşılaştırmak'],
  weakPractice:['Görüşmeyi yazmadan kapatmak','Tek görüşmeden genel sonuç çıkarmak','Sadece kötü giden görüşmeleri düşünmek'],
  moments:[
    {weak:'"Bugün kötü bir koçtum."',
     better:'"Bugün iki kez çözüm önerme dürtümü tuttum, bir kez tutamadım. Tutamadığım an danışan sessizleştiğinde oldu."',
     why:'Genel yargı öğretmez. Davranış düzeyinde gözlem, bir sonraki görüşmede deneyebileceğin bir şey verir.'}],
  reflectionPrompts:['Bu hafta hangi davranışını izlemek istersin?'],
  realSessionApplication:['Üç görüşme üst üste kapanışta yansıma yaz.'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['SELF_AWARENESS'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'ORTA' });

/* ── SPECIAL CONTEXTS ─────────────────────────────────────────────────────── */

academyRegisterUnit('CTX_EXECUTIVE', {
  title:'Yönetici koçluğu', shortTitle:'Yönetici koçluğu', level:'CONTEXT',
  domain:'Özel bağlamlar', prerequisites:['FND_ETHICS','CRAFT_OPENING'],
  purpose:'Kurumsal bağlamda çoklu taraf ve gizlilik dengesini yönetmek.',
  objectives:['Üç taraflı anlaşmayı kurmak','Gizlilik sınırını korumak','Sistem etkisini görmek'],
  principles:[
    'Kurumsal koçlukta danışan kişidir; sponsor kurum olabilir ama danışan değildir.',
    'Üç taraflı anlaşma başta yapılmazsa, gizlilik sonradan savunulamaz.',
    'Yöneticinin kararı çoğu zaman kendisinden büyük bir sistemin içindedir.'],
  goodPractice:['Sponsor ile paylaşılacakları baştan netleştirmek','Bireysel içeriği korumak','Sistemik etkiyi sormak'],
  weakPractice:['Sponsora içerik aktarmak','Kurum hedefini danışanın hedefi sanmak','Politik bağlamı yok saymak'],
  moments:[
    {weak:'İK "nasıl gidiyor?" diye sorar, koç gelişme alanlarını anlatır.',
     better:'Koç, baştan anlaşılan çerçeveye göre yalnız katılım ve süreç bilgisini paylaşır.',
     why:'Bilgi paylaşımı iyi niyetle bile olsa danışanın rızası dışına çıkarsa güven biter ve koçluk çalışmaz.'}],
  reflectionPrompts:['Son kurumsal işinde sınırlar ne kadar netti?'],
  realSessionApplication:['Bir sonraki kurumsal başlangıçta üç taraflı anlaşmayı yaz.'],
  contextTags:['executive'], approachTags:['DEVELOPMENTAL_EXECUTIVE'],
  competencyTags:['Etik uygulama','Anlaşmayı kurma ve sürdürme'], mirrorLinks:['BOUNDARIES','SESSION_FLOW'],
  evidenceGrade:'B', sourceRefs:['icf.ethics','emcc.ac.ethics'], depth:'ORTA' });

academyRegisterUnit('CTX_YOUTH_CHILD', {
  title:'Ergen ve çocuk koçluğu', shortTitle:'Ergen ve çocuk', level:'CONTEXT',
  domain:'Özel bağlamlar', prerequisites:['FND_ETHICS','FND_AGENCY'],
  purpose:'Gelişimsel uygunluk, veli sınırı ve koruma sorumluluğunu doğru kurmak.',
  objectives:[
    'Çocuk koçluğunu "basitleştirilmiş yetişkin koçluğu" saymamak',
    'Veli rızası ve gizlilik sınırını birlikte kurmak',
    'Koçluğun uygun olmadığı anı tanımak'],
  principles:[
    'Çocuk koçluğu daha kolay değil, daha sorumludur.',
    'Veli rızası bir formalite değil, çalışmanın ön koşuludur; bu sistemde atlanamaz.',
    'Çocukla kurulan gizlilik koşulsuz değildir: güvenlik her zaman gizliliğin önünde gelir ve bu çocuğa baştan yaşına uygun biçimde söylenir.',
    'Yetişkinle çocuk arasındaki güç farkı, "hayır" demeyi zorlaştırır; koç bunu telafi etmekle yükümlüdür.',
    'Soyut ve çok katmanlı sorular gelişimsel olarak uygun olmayabilir; somut ve kısa sorular daha işe yarar.',
    'Bir koruma endişesi belirdiğinde koçluk devam etmez; onaylı güvenlik ve yönlendirme yolu izlenir.'],
  goodPractice:[
    'Veli rızasını ve gizlilik sınırını baştan konuşmak',
    'Yaşa uygun, somut ve tek katmanlı sorular sormak',
    'Çocuğun "bilmiyorum" demesine alan bırakmak',
    'Endişe belirdiğinde koçluğu durdurup güvenlik yolunu izlemek'],
  weakPractice:[
    'Yetişkin sorularını sadeleştirip yeterli saymak',
    'Çocuğa koşulsuz gizlilik sözü vermek',
    'Veliyi sürecin tamamen dışında bırakmak',
    'Koruma sinyali varken koçluğa devam etmek'],
  moments:[
    {weak:'"Aramızda kalacak, kimseye söylemeyeceğim."',
     better:'"Konuştuklarımız aramızda kalır. Tek istisna şu: güvenliğinle ilgili bir şey olursa, seni koruyabilmek için bir yetişkinle konuşmam gerekir."',
     why:'Koşulsuz gizlilik sözü tutulamaz. Sınırı baştan söylemek hem dürüsttür hem de sınırı kullanmak gerektiğinde güveni korur.'},
    {weak:'"Bu durumun altında yatan ihtiyacın ne olabilir sence?"',
     better:'"O an ne oldu? Sonra ne yaptın?"',
     why:'Soyut iç gözlem soruları birçok çocuk için gelişimsel olarak uygun değildir; somut anlatı hem erişilebilir hem de daha güvenilirdir.'}],
  reflectionPrompts:['Çocukla çalışırken en çok neyi varsayıyorsun?'],
  realSessionApplication:['Bir sonraki ergen/çocuk görüşmesinde gizlilik sınırını yaşa uygun bir cümleyle söyle.'],
  contextTags:['youth','child'], scopeZone:'AMBER',
  competencyTags:['Etik uygulama'], mirrorLinks:['BOUNDARIES','CLIENT_AGENCY'],
  antiPatternTags:['AGE_INAPPROPRIATE_ABSTRACTION','OVERCOMPLEX_QUESTION'],
  evidenceGrade:'A', sourceRefs:['un.crc','kcs.standards','icf.ethics'], depth:'DERIN' });

academyRegisterUnit('CTX_SCOPE_BOUNDARY', {
  title:'Koçluk ve terapi sınırı', shortTitle:'Koçluk / terapi sınırı', level:'CONTEXT',
  domain:'Özel bağlamlar', prerequisites:['FND_ETHICS'],
  purpose:'Koçluk alanının nerede bittiğini ve ne yapılacağını net biçimde bilmek.',
  objectives:[
    'Yeşil, sarı ve kırmızı bölgeyi ayırt etmek',
    'Teşhis diline girmemek',
    'Durdurma ve yönlendirme yolunu uygulamak'],
  principles:[
    'Koçluk bir tedavi değildir ve tedavinin yerine sunulamaz.',
    'YEŞİL: hedef, karar, performans, ilişki, anlam gibi konular koçluk alanıdır.',
    'SARI: yoğun sıkıntı, tekrarlayan işlevsellik kaybı, çözülmemiş kayıp gibi durumlarda duraklanır, netleştirilir ve yönlendirme değerlendirilir.',
    'KIRMIZI: kendine zarar, intihar düşüncesi, istismar, madde bağımlılığı, psikiyatrik kriz gibi durumlarda koçluk durur ve onaylı güvenlik yolu izlenir.',
    'Koç teşhis koymaz; gözlemini tarif eder ve uygun desteğe yönlendirir.',
    'Uygun olduğunda koçluk profesyonel bakımla birlikte yürüyebilir; ama onun yerine geçmez.'],
  goodPractice:[
    'Alan dışına çıkıldığını fark edip adlandırmak',
    'Kendi gözlemini teşhis olmadan söylemek',
    'Onaylı yönlendirme yolunu kullanmak'],
  weakPractice:[
    'Travma, depresyon veya kaygı bozukluğunu koçlukla çalışmaya devam etmek',
    'Teşhis dili kullanmak',
    'Kırmızı bölgede "biraz daha konuşalım" demek'],
  moments:[
    {weak:'"Bu anlattıkların bana kaygı bozukluğu gibi geldi, onun üzerine çalışalım."',
     better:'"Burada konuştuklarımız koçluğun alanının dışına çıkıyor gibi görünüyor. Bu konuda uygun bir uzmandan destek almanı önemsiyorum; istersen bunu birlikte konuşalım."',
     why:'İlk cümle hem teşhistir hem de yetkinlik sınırının dışıdır. İkincisi dürüsttür, danışanı yalnız bırakmaz ve koçluğu tedavi gibi sunmaz.'}],
  reflectionPrompts:['Sınırın dışına çıktığını en son ne zaman hissettin?'],
  realSessionApplication:['Bir sarı bölge sinyali fark edersen duraklat ve netleştir.'],
  scopeZone:'RED',
  competencyTags:['Etik uygulama'], mirrorLinks:['BOUNDARIES'],
  antiPatternTags:['DIAGNOSIS_LANGUAGE'],
  evidenceGrade:'A', sourceRefs:['icf.ethics','emcc.ac.ethics'], depth:'DERIN' });

/* ── PATHS ────────────────────────────────────────────────────────────────── */

academyRegisterPath('PATH_FOUNDATION', {
  title:'Profesyonel temel', purpose:'Koçluğun ne olduğu, etik sınırlar ve danışan sahipliği.',
  unitIds:['FND_WHAT_COACHING','FND_ETHICS','FND_AGENCY','FND_TRUST','FND_MINDSET'] });

academyRegisterPath('PATH_LISTENING', {
  title:'Dinleme ve mevcudiyet', purpose:'Derin dinleme, yansıtma, sessizlik ve orada olabilmek.',
  unitIds:['CORE_LISTENING','CORE_REFLECTION','CORE_SILENCE','ADV_PRESENCE'] });

academyRegisterPath('PATH_QUESTIONS', {
  title:'Sorular ve farkındalık', purpose:'Güçlü soru, farkındalık ve yaygın hataların önlenmesi.',
  unitIds:['CORE_QUESTIONS','CORE_AWARENESS','CORE_CHALLENGE','CRAFT_DEEPENING'] });

academyRegisterPath('PATH_ACTION', {
  title:'Kontrol etmeden eylem', purpose:'Danışana ait taahhüt, anlaşma ve kapanış.',
  unitIds:['CORE_NO_ADVICE','CRAFT_OPENING','CRAFT_ACTION','CRAFT_CLOSING'] });

academyRegisterPath('PATH_METHOD', {
  title:'Yöntem esnekliği', purpose:'Yaklaşımlar, bağlama göre seçim ve yöntem katılığından kaçınma.',
  unitIds:['METHOD_OVERVIEW','METHOD_AMBIVALENCE'] });

academyRegisterPath('PATH_ADVANCED', {
  title:'İleri koçluk pratiği', purpose:'Mevcudiyet, kendi gündemini görmek ve yansıtıcı pratik.',
  unitIds:['ADV_PRESENCE','ADV_COACH_AGENDA','ADV_REFLECTIVE'] });

academyRegisterPath('PATH_CONTEXT', {
  title:'Özel bağlamlar', purpose:'Yönetici, ergen/çocuk koçluğu ve koçluk-terapi sınırı.',
  unitIds:['CTX_EXECUTIVE','CTX_YOUTH_CHILD','CTX_SCOPE_BOUNDARY'] });
