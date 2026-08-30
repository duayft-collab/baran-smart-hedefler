/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 7b: CURRICULUM (FOUNDATION + CORE SKILLS)

   Every unit here teaches an observable behaviour, not a sentiment. "Listen
   carefully" is not teaching. "A question that carries one inquiry, follows
   what was actually said, and hides no advice" is teaching, because a coach
   can check themselves against it mid-session.

   Examples are synthetic and deliberately short. They are illustrations of a
   distinction, never a script: a line that is stronger in one moment can be
   wrong in the next, which is why every pair carries its reason.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── FOUNDATION ────────────────────────────────────────────────────────────── */

academyRegisterUnit('FND_WHAT_COACHING', {
  title:'Koçluk nedir, ne değildir', shortTitle:'Koçluk nedir', level:'FOUNDATION',
  domain:'Profesyonel temel',
  purpose:'Koçluğu; danışmanlık, mentorluk, eğitim ve terapiden ayıran çalışma biçimini netleştirmek.',
  objectives:[
    'Koçluğun temel varsayımını kendi cümlenle söyleyebilmek',
    'Bir konuşmanın ne zaman koçluk olmaktan çıktığını fark etmek',
    'Cevabı bilme dürtüsünü tanımak'],
  principles:[
    'Koçluk, danışanın düşünme kapasitesine yapılan bir yatırımdır; bilgi aktarımı değildir.',
    'Danışan kendi hayatının uzmanıdır; koç sürecin sorumluluğunu taşır, içeriğin değil.',
    'Mentorluk deneyim aktarır, danışmanlık çözüm üretir, terapi iyileştirir; koçluk farkındalık ve seçim üretir.',
    'Koç bir konuda uzman olabilir, ama uzmanlığını danışanın düşünmesinin yerine koymaz.'],
  goodPractice:[
    'Danışanın kendi çözümüne alan bırakmak',
    'Ne çalıştığını konuşmanın başında birlikte netleştirmek',
    'Bilmediğini bilmek ve merak etmek'],
  weakPractice:[
    'Deneyimini örnek diye anlatıp yönlendirmek',
    'Danışanın sözünü çözüm için kesmek',
    'Konuyu koçun uzmanlık alanına çekmek'],
  moments:[
    {weak:'"Ben de aynısını yaşamıştım, şöyle yapmıştım."',
     better:'"Bu durumda senin için en zor olan ne?"',
     why:'İlkinde konuşmanın merkezi koça kayar. İkincisi danışanın kendi deneyimini incelemesine alan açar. Deneyim paylaşmak yasak değildir; ama izinle, kısa ve danışanın düşünmesini kapatmayacak biçimde yapılır.'},
    {weak:'"Bence önce yöneticinle konuşmalısın."',
     better:'"Bu durumu değiştirebilecek hangi seçenekler var sence?"',
     why:'Tavsiye, sahipliği koça taşır. Seçenek sorusu, kararı danışanda bırakır ve genellikle danışanın kendi bağlamına daha uygun bir yol çıkarır.'}],
  reflectionPrompts:[
    'Son görüşmende cevabı bildiğini hissettiğin an neydi?',
    'O an ne yaptın?'],
  realSessionApplication:[
    'Bir sonraki görüşmede tavsiye verme dürtünü fark ettiğinde, onun yerine bir soru sor.'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['CLIENT_AGENCY','SELF_AWARENESS'],
  antiPatternTags:['ADVICE_IN_DISGUISE','PREMATURE_SOLUTION'],
  evidenceGrade:'A', sourceRefs:['icf.competencies','icf.ethics'], depth:'ORTA' });

academyRegisterUnit('FND_ETHICS', {
  title:'Etik ve profesyonel sınırlar', shortTitle:'Etik', level:'FOUNDATION',
  domain:'Profesyonel temel',
  purpose:'Gizlilik, çıkar çatışması ve yetkinlik sınırı gibi konularda net davranış kuralları kurmak.',
  objectives:[
    'Gizliliğin sınırlarını görüşme başında konuşabilmek',
    'Çıkar çatışmasını erken fark etmek',
    'Kendi yetkinlik sınırını tanımak'],
  principles:[
    'Gizlilik varsayılan değil, açıkça konuşulan bir anlaşmadır.',
    'Gizliliğin sınırları vardır; bu sınırlar sonradan değil, başta söylenir.',
    'Yetkinlik sınırının dışına çıkmak kötü niyet gerektirmez; fark etmemek yeterlidir.',
    'Çıkar çatışması gizlenmez, konuşulur.'],
  goodPractice:[
    'İlk görüşmede gizlilik ve sınırları açıkça konuşmak',
    'Kendi rolünle çelişen bir durumu adlandırmak',
    'Uygun olmayan konuyu yönlendirmek'],
  weakPractice:[
    'Gizliliği hiç konuşmamak',
    'Yöneticiye "genel bilgi" diye içerik aktarmak',
    'Alan dışı bir konuda devam etmek'],
  moments:[
    {weak:'Koç, danışanın yöneticisine "genel olarak iyi gidiyor" der.',
     better:'Koç, görüşme başında neyin paylaşılıp neyin paylaşılmayacağını üç taraflı olarak netleştirir.',
     why:'İyi niyetli bir özet bile, danışanın rıza vermediği bir aktarımdır. Sınır sonradan savunulmaz; baştan kurulur.'}],
  reflectionPrompts:['Gizlilik sınırlarını en son ne zaman açıkça konuştun?'],
  realSessionApplication:['Bir sonraki ilk görüşmede gizlilik sınırlarını kendi cümlenle söyle.'],
  competencyTags:['Etik uygulama'], mirrorLinks:['BOUNDARIES'],
  antiPatternTags:['DIAGNOSIS_LANGUAGE'],
  evidenceGrade:'A', sourceRefs:['icf.ethics','emcc.ac.ethics'], depth:'ORTA' });

academyRegisterUnit('FND_AGENCY', {
  title:'Danışan sahipliği ve özerklik', shortTitle:'Danışan sahipliği', level:'FOUNDATION',
  domain:'Profesyonel temel',
  purpose:'Kararın, eylemin ve anlamın danışana ait kalmasını korumak.',
  objectives:[
    'Sahipliğin nerede kaydığını fark etmek',
    'Koç önerisini danışan taahhüdünden ayırmak',
    'Danışanın "hayır" diyebilmesini korumak'],
  principles:[
    'Eylem danışanın kendi cümlesiyse taahhüttür; koçun cümlesiyse öneridir.',
    'Danışan reddedebiliyorsa özerklik vardır.',
    'Koçun iyi fikri, danışanın sahipliğinden daha değerli değildir.',
    'Sahiplik, görüşmenin sonunda değil boyunca korunur.'],
  goodPractice:[
    'Eylemi danışanın kendi ifadesiyle kayda geçirmek',
    'Öneriyi izin isteyerek ve ayrı tutarak sunmak',
    '"Bu sana uyuyor mu?" diye kontrol etmek'],
  weakPractice:[
    'Koçun önerisini taahhüt gibi yazmak',
    'Danışan tereddüt ederken ikna etmek',
    'Danışan adına önceliği seçmek'],
  moments:[
    {weak:'"O zaman salı günü yöneticinle konuşacaksın."',
     better:'"Buradan çıkarken kendine ne söz veriyorsun?"',
     why:'İlk cümle koçun planını danışanın taahhüdü gibi kaydeder. İkincisi taahhüdün sahibini danışan yapar; danışan farklı bir şey seçerse bu bir başarısızlık değil, bilgidir.'}],
  reflectionPrompts:['Son taahhüt gerçekten danışanın cümlesi miydi?'],
  realSessionApplication:['Kapanışta eylemi danışanın kendi kelimeleriyle tekrar ettir.'],
  competencyTags:['Danışanın gelişimini kolaylaştırma'], mirrorLinks:['CLIENT_AGENCY','ACTION'],
  antiPatternTags:['COACH_AGENDA','RESCUING'], practiceIds:['PRACTICE_CLIENT_OWNS_ACTION'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'ORTA' });

academyRegisterUnit('FND_TRUST', {
  title:'Güven ve psikolojik güvenlik', shortTitle:'Güven', level:'FOUNDATION',
  domain:'Profesyonel temel', prerequisites:['FND_ETHICS'],
  purpose:'Danışanın henüz net olmayan şeyi yüksek sesle düşünebileceği bir alan kurmak.',
  objectives:['Güveni davranışla kurmak','Yargı sinyallerini fark etmek','Sessizliğe tahammül etmek'],
  principles:[
    'Güven bir duygu değil, tekrarlanan öngörülebilir davranıştır.',
    'Danışan yanlış bir şey söylemekten korkuyorsa, gerçekten düşünemez.',
    'Küçük yargı sinyalleri (ses tonu, acele, düzeltme) güveni sözlerden hızlı aşındırır.'],
  goodPractice:['Söyleneni yargılamadan geri vermek','Acele etmemek','Belirsizliğe izin vermek'],
  weakPractice:['Hızlı düzeltmek','"Aslında..." ile başlamak','Duyguyu hemen çerçevelemek'],
  moments:[
    {weak:'"Aslında bu kadar büyütmene gerek yok."',
     better:'"Bu sana şu an oldukça büyük geliyor."',
     why:'İlk cümle danışanın deneyimini küçültür ve bir daha söylememeyi öğretir. İkincisi deneyimi olduğu gibi kabul eder; küçültmeden de ilerlenebilir.'}],
  reflectionPrompts:['Danışan en son ne zaman senin yanında fikrini değiştirdi?'],
  realSessionApplication:['Bir görüşmede hiçbir şeyi düzeltmeden önce duyduğunu geri ver.'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['LISTENING','REFLECTION'],
  antiPatternTags:['JUDGMENT'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'ORTA' });

academyRegisterUnit('FND_MINDSET', {
  title:'Koçluk zihniyeti', shortTitle:'Zihniyet', level:'FOUNDATION',
  domain:'Profesyonel temel',
  purpose:'Merak, alçakgönüllülük ve kendini yönetme alışkanlığını bir duruş hâline getirmek.',
  objectives:['Kendi gündemini fark etmek','Merakı tekniğin önüne koymak','Görüşme öncesi hazırlanmak'],
  principles:[
    'Koçun en sık yaptığı hata teknik eksikliği değil, kendi gündemini fark etmemesidir.',
    'Merak taklit edilemez; ya vardır ya yoktur, ve danışan bunu hisseder.',
    'Koçluk duruşu görüşmeden önce başlar.'],
  goodPractice:['Görüşme öncesi kendi dikkatini toparlamak','Bilmediğini kabul etmek','Kendi tepkisini fark edip bırakmak'],
  weakPractice:['Hazırlıksız ve dağınık başlamak','Sonucu baştan tasarlamak','Kendi kaygısını danışana taşımak'],
  moments:[
    {weak:'Koç görüşmeye, danışanın istifa etmesi gerektiğini düşünerek girer.',
     better:'Koç kendi görüşünü fark eder, bir kenara koyar ve danışanın nereye bakmak istediğini sorar.',
     why:'Gündem yok sayılamaz; ancak fark edilirse yönetilebilir. Fark edilmeyen gündem sorulara sızar.'}],
  reflectionPrompts:['Bugün hangi görüşmeye bir beklentiyle giriyorsun?'],
  realSessionApplication:['Görüşmeden önce bir cümleyle kendi beklentini yaz ve bir kenara koy.'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['SELF_AWARENESS','METHOD_FLEXIBILITY'],
  antiPatternTags:['COACH_AGENDA'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'ORTA' });

/* ── CORE CONVERSATION SKILLS ─────────────────────────────────────────────── */

academyRegisterUnit('CORE_LISTENING', {
  title:'Aktif ve derin dinleme', shortTitle:'Dinleme', level:'CORE',
  domain:'Konuşma becerileri', prerequisites:['FND_TRUST'],
  purpose:'Söylenenin altındaki katmanları duymayı öğrenmek.',
  objectives:['Katmanlı dinlemeyi uygulamak','Kendi iç sesini fark etmek','Duyduğunu kanıtlamak'],
  principles:[
    'Dinlemek, sıradaki soruyu hazırlamayı bırakmaktır.',
    'Olgular, duygu, değer, varsayım ve ihtiyaç aynı cümlenin içinde bulunabilir.',
    'Duyduğunu göstermeden dinlediğini iddia edemezsin.',
    'Katmanlar bir tahmin aracıdır, bir teşhis aracı değil.'],
  goodPractice:['Cümleyi tamamlanmadan bölmemek','Duyduğunu kısa ve sadık biçimde geri vermek','Fark ettiğin çelişkiyi merakla sormak'],
  weakPractice:['Sıradaki soruyu hazırlamak','Duyguyu atlayıp olguya geçmek','Yorumu duyulmuş gibi sunmak'],
  moments:[
    {weak:'Danışan uzun bir durum anlatır; koç hemen "Peki hedefin ne?" diye sorar.',
     better:'"Anlattıklarında en çok yorulduğun kısım, kimsenin bunu fark etmemesi gibi duyuluyor."',
     why:'İlkinde koç kendi yapısına döner. İkincisi duyulan katmanı sınar; yanlışsa danışan düzeltir, doğruysa konuşma derinleşir.'}],
  reflectionPrompts:['Son görüşmede duyduğun ama sormadığın ne vardı?'],
  realSessionApplication:['Bir görüşmede her sorudan önce duyduğunu bir cümleyle geri ver.'],
  listeningLayers:['FACTS','EMOTION','VALUES','ASSUMPTIONS','NEEDS','CONTRADICTIONS','ENERGY'],
  competencyTags:['Aktif dinleme'], mirrorLinks:['LISTENING','REFLECTION'],
  interventionTags:['reflect.mirror','reflect.feeling'],
  antiPatternTags:['INTERROGATION','STACKED_QUESTIONS'],
  practiceIds:['PRACTICE_REFLECT_BEFORE_ASKING'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'DERIN' });

academyRegisterUnit('CORE_QUESTIONS', {
  title:'Güçlü soru sorma', shortTitle:'Sorular', level:'CORE',
  domain:'Konuşma becerileri', prerequisites:['CORE_LISTENING'],
  purpose:'Merakı koçun değil danışanın düşünmesine hizmet eden bir soruya dönüştürmek.',
  objectives:['Tek bir soru sormak','Gömülü tavsiyeyi fark etmek','Danışanın kelimesinden devam etmek'],
  principles:[
    'İşe yarayan soru koçun merakına değil danışanın düşünmesine hizmet eder.',
    'Tek bir asıl soru taşır; üst üste binmez.',
    'İçine tavsiye gizlemez.',
    'Bir yorumu doğruymuş gibi varsaymaz.',
    'Danışanın gerçekten söylediği şeyi takip eder.',
    'Kısa soru genellikle uzun sorudan daha çok alan açar.'],
  goodPractice:['Soruyu sorup beklemek','Danışanın kelimesini kullanmak','Sorudan sonra susmak'],
  weakPractice:['Arka arkaya üç soru sormak','"Şunu denedin mi?" demek','Soruyu açıklamayla boğmak'],
  moments:[
    {weak:'"Bunu neden yapmadın? Zaman mı yoktu, yoksa istemedin mi?"',
     better:'"Bunu yapmanı zorlaştıran neydi?"',
     why:'İlk cümle hem üst üste soru yığar hem iki şık dayatır hem de savunma çağırır. İkincisi tek bir kapı açar ve cevabın şeklini danışana bırakır.'},
    {weak:'"Bir listeye yazsan daha kolay olmaz mıydı?"',
     better:'"Bunu daha yönetilebilir kılacak ne olurdu?"',
     why:'Birincisi soru kılığında tavsiyedir; danışan ya kabul eder ya reddeder, ama düşünmez. İkincisi çözümü danışanın üretmesine alan bırakır.'}],
  reflectionPrompts:['Son görüşmede sorduğun en iyi soru hangisiydi? Neden işe yaradı?'],
  realSessionApplication:['Bir görüşme boyunca hiçbir soruyu ikinci bir soruyla takip etme.'],
  competencyTags:['Farkındalığı güçlendirme'], mirrorLinks:['QUESTIONING','AWARENESS'],
  antiPatternTags:['STACKED_QUESTIONS','LEADING_QUESTION','ADVICE_IN_DISGUISE','WHY_BOMBARDMENT','FALSE_CHOICE','OVERCOMPLEX_QUESTION'],
  practiceIds:['PRACTICE_REFLECT_BEFORE_ASKING'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'DERIN' });

academyRegisterUnit('CORE_REFLECTION', {
  title:'Yansıtma ve yeniden ifade', shortTitle:'Yansıtma', level:'CORE',
  domain:'Konuşma becerileri', prerequisites:['CORE_LISTENING'],
  purpose:'Danışanın kendi sözünü dışarıdan duymasını sağlamak.',
  objectives:['Sadık yansıtma yapmak','Yorumu yansıtmadan ayırmak','Yansıtmayı kısa tutmak'],
  principles:[
    'Yansıtma bir özet değil, bir ayna tutmadır.',
    'Danışanın kelimesini koçun kelimesiyle değiştirmek çoğu zaman anlamı kaydırır.',
    'Yorum yansıtma değildir; yorum sunulur ve sınanır.'],
  goodPractice:['Danışanın kendi kelimelerini kullanmak','Kısa tutmak','Yansıtmadan sonra susmak'],
  weakPractice:['Uzun özet çekmek','Kendi yorumunu ekleyip yansıtma demek','Duyguyu hemen olumluya çevirmek'],
  moments:[
    {weak:'Danışan "yoruldum" der; koç "yani motivasyonun düşmüş" der.',
     better:'"Yoruldum dedin."',
     why:'Yorum, danışanın deneyimini koçun kategorisine taşır. Kelimeyi olduğu gibi geri vermek çoğu zaman danışanın kendi tanımını derinleştirmesine yol açar.'}],
  reflectionPrompts:['En son ne zaman yansıtma yerine yorum yaptın?'],
  realSessionApplication:['Bir görüşmede üç kez, danışanın tam kelimesini geri ver.'],
  listeningLayers:['EMOTION','VALUES'],
  competencyTags:['Aktif dinleme'], mirrorLinks:['REFLECTION','LISTENING'],
  interventionTags:['reflect.mirror','para.check'],
  antiPatternTags:['DIAGNOSIS_LANGUAGE'],
  practiceIds:['PRACTICE_REFLECT_BEFORE_ASKING'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'ORTA' });

academyRegisterUnit('CORE_SILENCE', {
  title:'Koçlukta sessizlik', shortTitle:'Sessizlik', level:'CORE',
  domain:'Konuşma becerileri', prerequisites:['CORE_REFLECTION'],
  purpose:'Düşünmenin oluştuğu boşluğu doldurmamayı öğrenmek.',
  objectives:['Sessizliğe dayanmak','Sessizliğin türünü ayırt etmek','Kendi kaygını yönetmek'],
  principles:[
    'Sessizlik boşluk değildir; çoğu zaman düşünmenin kendisidir.',
    'Sessizliği çoğu kez danışan değil koç bozar.',
    'Her sessizlik verimli değildir; kilitlenme ile düşünme farklıdır.',
    'Bir farkındalık doğduğunda en iyi müdahale genellikle hiçbir şey söylememektir.'],
  goodPractice:['Sorudan sonra beklemek','Farkındalık anında susmak','Sessizliği adlandırıp izin vermek'],
  weakPractice:['Boşluğu yeni soruyla doldurmak','Soruyu yeniden formüle etmek','Sessizliği onaysızlık sanmak'],
  moments:[
    {weak:'Koç sorar, üç saniye sonra "yani şunu mu demek istiyorum..." diye açıklar.',
     better:'Koç sorar ve bekler.',
     why:'Açıklama, danışanın henüz başlamış düşüncesini keser. Üç saniye koça uzun gelir; düşünen kişiye gelmez.'}],
  reflectionPrompts:['Sessizlik sana ne hissettiriyor?'],
  realSessionApplication:['Her sorudan sonra üçe kadar say, sonra konuş.'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['SILENCE','AWARENESS'],
  practiceIds:['PRACTICE_HOLD_SILENCE'],
  evidenceGrade:'B', sourceRefs:['icf.competencies'], depth:'ORTA' });

academyRegisterUnit('CORE_AWARENESS', {
  title:'Farkındalık oluşturma', shortTitle:'Farkındalık', level:'CORE',
  domain:'Konuşma becerileri', prerequisites:['CORE_QUESTIONS'],
  purpose:'Danışanın kendi örüntüsünü görmesine alan açmak.',
  objectives:['Farkındalık anını tanımak','Gözlemi iddia değil hipotez olarak sunmak','Aceleyle eyleme geçmemek'],
  principles:[
    'Farkındalık koçun açıklamasından değil danışanın görmesinden doğar.',
    'Bir gözlem paylaşılırken kesinlik değil merak taşır.',
    'Farkındalık taze iken eylem konuşmak onu bastırabilir.'],
  goodPractice:['Çelişkiyi nazikçe adlandırmak','Gözlemi "…gibi geliyor" diye sunmak','Farkındalıktan sonra beklemek'],
  weakPractice:['Danışan adına sonuç çıkarmak','Yorumu gerçek gibi söylemek','Hemen plan yapmaya geçmek'],
  moments:[
    {weak:'"Demek ki aslında bu işi istemiyorsun."',
     better:'"İşten bahsederken sesin değişiyor gibi geldi bana; sen ne fark ediyorsun?"',
     why:'İlki koçun yorumunu danışanın gerçeği yerine koyar. İkincisi gözlemi sahiplenir ama yorumu danışana bırakır — yanlışsa düzeltilebilir.'}],
  reflectionPrompts:['Son görüşmede farkındalık doğduğunda ne yaptın?'],
  realSessionApplication:['Bir farkındalık anından sonra en az beş saniye sessiz kal.'],
  competencyTags:['Farkındalığı güçlendirme'], mirrorLinks:['AWARENESS','SILENCE'],
  antiPatternTags:['DIAGNOSIS_LANGUAGE','PREMATURE_SOLUTION'],
  practiceIds:['PRACTICE_AWARENESS_BEFORE_ACTION'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'DERIN' });

academyRegisterUnit('CORE_CHALLENGE', {
  title:'Meydan okuma ve alanı koruma', shortTitle:'Meydan okuma', level:'CORE',
  domain:'Konuşma becerileri', prerequisites:['FND_AGENCY','CORE_AWARENESS'],
  purpose:'Rahatsız edici soruyu, ilişkiyi ve sahipliği bozmadan sorabilmek.',
  objectives:['Meydan okumayı desteklemekle birleştirmek','Sonrasında alan bırakmak','Aşırıya kaçtığını fark etmek'],
  principles:[
    'Meydan okuma güven varsa işe yarar; güven yoksa savunma üretir.',
    'İyi meydan okuma danışanın kendi sözündeki gerilimi gösterir, koçun görüşünü değil.',
    'Meydan okumadan sonra alan bırakılmazsa, o bir baskıdır.'],
  goodPractice:['Danışanın kendi çelişkisini göstermek','Sonrasında susmak','İzin isteyerek zorlamak'],
  weakPractice:['Üst üste zorlamak','Kendi görüşünü dayatmak','Savunmayı ikna ile karşılamak'],
  moments:[
    {weak:'"Bu bahane gibi geliyor."',
     better:'"Bir yandan bunun çok önemli olduğunu söylüyorsun, bir yandan üç aydır ertelemişsin. Bu ikisini birlikte nasıl anlamlandırıyorsun?"',
     why:'İlki yargıdır ve savunma üretir. İkincisi danışanın kendi iki cümlesini yan yana koyar; gerilim koçun değil danışanın malzemesidir.'}],
  reflectionPrompts:['En son ne zaman zorlamaktan çekindin? Ne oldu?'],
  realSessionApplication:['Bir meydan okumadan sonra hiçbir şey ekleme.'],
  competencyTags:['Koçluk duruşunu koruma'], mirrorLinks:['CHALLENGE','CLIENT_AGENCY'],
  antiPatternTags:['JUDGMENT','COACH_AGENDA'],
  practiceIds:['PRACTICE_SPACE_AFTER_CHALLENGE'],
  evidenceGrade:'B', sourceRefs:['icf.competencies'], depth:'DERIN' });

academyRegisterUnit('CORE_NO_ADVICE', {
  title:'Tavsiye vermemek ve danışan alanını korumak', shortTitle:'Tavsiye vermemek', level:'CORE',
  domain:'Konuşma becerileri', prerequisites:['FND_AGENCY'],
  purpose:'Yardım etme dürtüsünü, danışanın düşünmesini kapatmadan yönetmek.',
  objectives:['Kılık değiştirmiş tavsiyeyi tanımak','Bilgi paylaşımını izinle yapmak','Kurtarma dürtüsünü fark etmek'],
  principles:[
    'Tavsiye kötü değildir; yerini almadığı sürece. Danışanın düşünmesinin yerine geçtiğinde zarar verir.',
    'Soru kılığındaki tavsiye en sinsi biçimdir.',
    'Gerçekten gerekli bilgi izin istenerek, kısa ve ayrı tutularak paylaşılır.',
    'Kurtarma isteği çoğu zaman koçun rahatsızlığını azaltır, danışanın kapasitesini değil.'],
  goodPractice:['Önce danışanın fikrini sormak','Bilgi vermeden izin istemek','Öneriyi taahhütten ayrı tutmak'],
  weakPractice:['"…denedin mi?" sormak','Danışan zorlanınca çözümü söylemek','Öneriyi kapanışta taahhüt diye yazmak'],
  moments:[
    {weak:'"Bunu yöneticinle konuşmayı denedin mi?"',
     better:'"Bu konuda hangi seçenekleri düşündün?"',
     why:'İlki tek bir yolu masaya koyar ve danışanın kendi seçeneklerini üretmesini durdurur. İkincisi danışanın kendi haritasını görünür kılar.'},
    {weak:'Danışan sessizleşince koç çözümü söyler.',
     better:'Koç bekler; gerekirse "Şu an kafanda ne dönüyor?" diye sorar.',
     why:'Sessizlikte çözüm söylemek koçun kaygısını yatıştırır. Beklemek danışanın düşünme kasını çalıştırır.'}],
  reflectionPrompts:['Tavsiye verme dürtün en çok ne zaman geliyor?'],
  realSessionApplication:['Bir görüşme boyunca hiç öneri verme; sadece sor ve yansıt.'],
  competencyTags:['Danışanın gelişimini kolaylaştırma'], mirrorLinks:['CLIENT_AGENCY','QUESTIONING'],
  antiPatternTags:['ADVICE_IN_DISGUISE','RESCUING','PREMATURE_SOLUTION','LEADING_QUESTION'],
  practiceIds:['PRACTICE_ELICIT_BEFORE_INFORM'],
  evidenceGrade:'A', sourceRefs:['icf.competencies'], depth:'DERIN' });
