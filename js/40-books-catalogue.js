/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 8b: THE CURATED CATALOGUE

   Nineteen books. Every bibliographic fact below was checked against the
   publisher or an equivalent bibliographic authority on 2026-08-30; anything
   that could not be established was left out rather than guessed at, which is
   why some obvious titles are absent.

   Evidence grades are the Phase 4 vocabulary and they are unkind on purpose.
   A book can be excellent, widely loved, and still a C: the grade describes
   the strength of the evidence behind its claims, not how useful the book is
   or how much the field admires it. Two entries here sell in the millions and
   are graded C; one is graded D as a coaching foundation precisely because it
   is a serious book about something coaching must not attempt.

   Everything written about each book is original. No summaries, no excerpts,
   no substitute for reading it.
   ══════════════════════════════════════════════════════════════════════════ */

var _BK_V = { metadataVerified:true, verifiedAt:'2026-08-30',
  verificationBasis:'publisher_or_bibliographic_authority' };
function _bk(id, def){ return booksRegister(id, Object.assign({}, _BK_V, def)); }

/* ── FOUNDATION ───────────────────────────────────────────────────────────── */

_bk('whitmore.performance6', {
  title:'Coaching for Performance', subtitle:'The Principles and Practice of Coaching and Leadership',
  authors:['John Whitmore','Tiffany Gaskell'], publicationYear:2024, editionNote:'6. baskı',
  publisher:'John Murray / Nicholas Brealey', isbn13:'9781399814904',
  category:'FOUNDATION', audienceLevel:'BASLANGIC', evidenceGrade:'B',
  evidenceNotes:'GROW yaygın ve yerleşik bir çerçevedir; yapısının kendisi için güçlü bağımsız kanıt yoktur. Yerleşik çerçeve olarak B.',
  whyRead:'Koçluğun bir yapı içinde nasıl yürüdüğünü ve performans dilinin farkındalık ve sorumlulukla nasıl birleştiğini gösterir.',
  whatItHelpsWith:['Görüşmeye yapı vermek','Farkındalık ve sorumluluk kavramlarını netleştirmek','Yönetici bağlamında koçluk dili'],
  whatItDoesNotProve:['GROW\'un diğer yaklaşımlardan üstün olduğunu','Her görüşmenin bir modele oturması gerektiğini'],
  whenNotToChooseIt:['Danışan henüz konusunu bulamamışken model zorlamak istiyorsan'],
  cautions:['Model, konuşmaya hizmet eder; konuşma modele değil.'],
  reflectionPrompts:['Hangi aşamayı atlamaya en çok meyilliyim?','Yapı bana mı, danışana mı hizmet ediyor?'],
  applicationPrompts:['Bir görüşmede modeli bilerek bırak ve danışanın nerede olduğunu takip et.'],
  competencyTags:['Anlaşmayı kurma ve sürdürme'], academyUnitTags:['CRAFT_OPENING','METHOD_OVERVIEW'],
  approachTags:['GROW'], mirrorLinks:['SESSION_FLOW','METHOD_FLEXIBILITY'],
  sourceRefs:['whitmore.performance'], relatedBooks:['co.active'] });

_bk('co.active', {
  title:'Co-Active Coaching', subtitle:'The proven framework for transformative conversations at work and in life',
  authors:['Karen Kimsey-House','Henry Kimsey-House','Phillip Sandhal','Laura Whitworth'],
  publicationYear:2018, editionNote:'4. baskı', publisher:'Nicholas Brealey', isbn13:'9781473674981',
  category:'FOUNDATION', audienceLevel:'BASLANGIC', evidenceGrade:'B',
  evidenceNotes:'Geniş biçimde öğretilen, tutarlı bir uygulayıcı çerçevesi. Doğrudan sonuç kanıtı sınırlı; yerleşik çerçeve olarak B.',
  whyRead:'Koçun ve danışanın ilişkiyi birlikte kurduğu bir çalışma biçimini ayrıntılı biçimde tarif eder.',
  whatItHelpsWith:['Danışan sahipliğini korumak','Koçluk duruşu','Dinleme düzeyleri','İlişki kurmak'],
  whatItDoesNotProve:['Belirli bir koçluk okulunun ölçülebilir üstünlüğünü'],
  whenNotToChooseIt:['Kısa ve hızlı bir başlangıç arıyorsan; bu kitap kapsamlıdır'],
  cautions:['Kavram sözlüğü zengindir; terimleri danışana taşımamaya dikkat et.'],
  reflectionPrompts:['Hangi dinleme düzeyinde çalışıyorum?','İlişkiyi kim kuruyor?'],
  applicationPrompts:['Bir görüşmede yalnızca danışanın gündemini takip et; kendi merakını bir kenara koy.'],
  competencyTags:['Koçluk duruşunu koruma','Aktif dinleme'],
  academyUnitTags:['FND_WHAT_COACHING','FND_AGENCY','CORE_LISTENING'],
  mirrorLinks:['CLIENT_AGENCY','LISTENING'], relatedBooks:['whitmore.performance6'] });

_bk('coaching.habit', {
  title:'The Coaching Habit', subtitle:'Say Less, Ask More & Change the Way You Lead Forever',
  authors:['Michael Bungay Stanier'], publicationYear:2016, publisher:'Box of Crayons Press',
  isbn13:'9780978440749',
  category:'FOUNDATION', audienceLevel:'BASLANGIC', evidenceGrade:'C',
  evidenceNotes:'Çok satan ve pratik bir uygulayıcı aracı; yedi sorunun etkisi için bağımsız kanıt yoktur. Popülerlik kanıt değildir.',
  whyRead:'Tavsiye verme dürtüsünü fark etmek ve daha az konuşarak daha çok alan açmak için hızlı bir giriş.',
  whatItHelpsWith:['Tavsiye dürtüsünü tutmak','Sade soru sormak','Konuşmayı danışanda tutmak'],
  whatItDoesNotProve:['Yedi sorunun her bağlamda yeterli olduğunu','Soru listesinin koçluk yetkinliği kazandırdığını'],
  whenNotToChooseIt:['Derinlik ve kuramsal temel arıyorsan'],
  cautions:['Soru listesi ezberlemek koç yapmaz; ne zaman soru SORMAYACAĞINI bilmek daha zordur.'],
  reflectionPrompts:['Hangi durumda soru sormak yerine susmalıydım?'],
  applicationPrompts:['Bir görüşmede ilk aklına gelen tavsiyeyi yut ve yerine tek bir soru sor.'],
  competencyTags:['Danışanın gelişimini kolaylaştırma'],
  academyUnitTags:['CORE_NO_ADVICE','CORE_QUESTIONS'],
  antiPatternHint:true, mirrorLinks:['QUESTIONING','CLIENT_AGENCY'],
  practiceIds:['PRACTICE_ELICIT_BEFORE_INFORM'], relatedBooks:['schein.humble'] });

_bk('kline.time', {
  title:'Time to Think', subtitle:'Listening to Ignite the Human Mind',
  authors:['Nancy Kline'], publicationYear:1999, publisher:'Cassell', isbn13:'9780706377453',
  category:'FOUNDATION', audienceLevel:'GELISEN', evidenceGrade:'C',
  evidenceNotes:'Dinleme kalitesi üzerine güçlü bir uygulayıcı savı; "Thinking Environment" bileşenleri için bağımsız kanıt sınırlıdır.',
  whyRead:'Bir insanın gerçekten düşünebilmesi için karşısındakinin dikkatinin ne kadar belirleyici olduğunu görünür kılar.',
  whatItHelpsWith:['Kesintisiz dikkat','Sessizliğe tahammül','Düşünmeye alan açmak'],
  whatItDoesNotProve:['Belirli bir oturum formatının ölçülmüş üstünlüğünü'],
  whenNotToChooseIt:['Yapılandırılmış bir görüşme modeli arıyorsan'],
  cautions:['Kavramlar ilham verici biçimde sunulur; kanıt dili olarak okuma.'],
  reflectionPrompts:['Danışanı en son ne zaman gerçekten bölmeden dinledim?'],
  applicationPrompts:['Bir görüşmede danışan durduğunda hemen konuşma; beşe kadar say.'],
  competencyTags:['Aktif dinleme'], academyUnitTags:['CORE_LISTENING','CORE_SILENCE'],
  mirrorLinks:['LISTENING','SILENCE'], practiceIds:['PRACTICE_HOLD_SILENCE'],
  relatedBooks:['schein.humble'] });

_bk('schon.reflective', {
  title:'The Reflective Practitioner', subtitle:'How Professionals Think in Action',
  authors:['Donald A. Schön'], publicationYear:1983, publisher:'Basic Books', isbn13:'9780465068784',
  category:'FOUNDATION', audienceLevel:'ILERI', evidenceGrade:'B',
  evidenceNotes:'Profesyonel pratik kuramında temel bir eser; kuramsal ve gözlemsel, deneysel değil.',
  whyRead:'Ustalığın kitaptan değil, iş üstünde düşünmekten geldiğini anlatır — bu sistemin yansıtıcı pratik anlayışının kökeni.',
  whatItHelpsWith:['Görüşme içinde düşünmek','Kendi pratiğini gözlemlemek','Deneyimi öğrenmeye çevirmek'],
  whatItDoesNotProve:['Yansıtıcı pratiğin ölçülmüş etki büyüklüğünü'],
  whenNotToChooseIt:['Hemen uygulanabilir teknik arıyorsan; bu kitap kavramsaldır'],
  cautions:['Akademik ve yoğundur; acele okunacak bir kitap değildir.'],
  reflectionPrompts:['Görüşme sırasında mı yoksa sonrasında mı düşünüyorum?'],
  applicationPrompts:['Üç görüşme üst üste kapanışta kendi yansımanı yaz.'],
  competencyTags:['Koçluk duruşunu koruma'], academyUnitTags:['ADV_REFLECTIVE','ADV_PRESENCE'],
  mirrorLinks:['SELF_AWARENESS'], relatedBooks:['ericsson.peak'] });

/* ── SKILL ────────────────────────────────────────────────────────────────── */

_bk('mi.4e', {
  title:'Motivational Interviewing', subtitle:'Helping People Change and Grow',
  authors:['William R. Miller','Stephen Rollnick'], publicationYear:2023, editionNote:'4. baskı',
  publisher:'The Guilford Press', isbn13:'9781462552795',
  category:'SKILL', audienceLevel:'GELISEN', evidenceGrade:'A',
  evidenceNotes:'Onlarca yıllık denemeli araştırma ve meta-analizlerle desteklenen, bu kitaplıktaki en güçlü kanıt temeline sahip çerçeve.',
  whyRead:'Kararsızlığın bir direnç değil normal bir süreç olduğunu ve ikna etmeden nasıl çalışılacağını öğretir.',
  whatItHelpsWith:['Değişim dilini duymak','Kararsızlıkla çalışmak','İkna dürtüsünü tutmak','Özerkliği korumak'],
  whatItDoesNotProve:['Koçluğun terapi yerine geçebileceğini','Her danışanın değişime hazır olduğunu'],
  whenNotToChooseIt:['Basit bir hedef belirleme aracı arıyorsan'],
  cautions:['MI klinik bağlamdan doğdu; koçlukta ilkeleri alınır, tedavi rolü alınmaz.'],
  reflectionPrompts:['En son ne zaman ikna etmeye çalıştım?','Koruma dilini duyuyor muyum?'],
  applicationPrompts:['Kararsız bir danışanla iki tarafı da eşit merakla sor.'],
  competencyTags:['Farkındalığı güçlendirme'], approachTags:['MOTIVATIONAL_INTERVIEWING'],
  academyUnitTags:['METHOD_AMBIVALENCE','CORE_LISTENING'],
  mirrorLinks:['QUESTIONING','CLIENT_AGENCY'], practiceIds:['PRACTICE_ELICIT_BEFORE_INFORM'],
  sourceRefs:['mi.miller_rollnick'], relatedBooks:['dejong.solutions'] });

_bk('dejong.solutions', {
  title:'Interviewing for Solutions', authors:['Peter De Jong','Insoo Kim Berg'],
  publicationYear:2012, editionNote:'4. baskı', publisher:'Cengage Learning / Brooks Cole',
  isbn13:'9781111722203',
  category:'SKILL', audienceLevel:'GELISEN', evidenceGrade:'B',
  evidenceNotes:'Çözüm odaklı çalışmanın en yerleşik uygulama metni; kanıt tabanı MI kadar geniş değildir.',
  whyRead:'Sorunu analiz etmeden, danışanın işleyen istisnalarından ilerlemeyi somut biçimde gösterir.',
  whatItHelpsWith:['İstisnaları fark etmek','Ölçek soruları','Küçük ve somut adım','Sorun analizinden çıkmak'],
  whatItDoesNotProve:['Her konunun çözüm odaklı çalışmaya uygun olduğunu'],
  whenNotToChooseIt:['Danışanın önce duyulmaya ihtiyacı varken çözüme koşuyorsan'],
  cautions:['Teknikler klinik görüşmeden gelir; koçlukta ilke olarak kullanılır.'],
  reflectionPrompts:['Neyin işlediğini ne sıklıkla soruyorum?'],
  applicationPrompts:['Bir görüşmede sorunun tarihini değil, işlediği bir anı sor.'],
  competencyTags:['Farkındalığı güçlendirme'], approachTags:['SOLUTION_FOCUSED'],
  academyUnitTags:['METHOD_OVERVIEW','CRAFT_DEEPENING'], mirrorLinks:['QUESTIONING','AWARENESS'],
  sourceRefs:['sfbt.origin'], relatedBooks:['mi.4e'] });

_bk('schein.humble', {
  title:'Humble Inquiry', subtitle:'The Gentle Art of Asking Instead of Telling',
  authors:['Edgar H. Schein','Peter A. Schein'], publicationYear:2021, editionNote:'2. baskı',
  publisher:'Berrett-Koehler', isbn13:'9781523092628',
  category:'SKILL', audienceLevel:'BASLANGIC', evidenceGrade:'B',
  evidenceNotes:'Örgütsel psikolojide uzun bir gözlem geleneğine dayanır; deneysel etki ölçümü sunmaz.',
  whyRead:'Cevabını bilmediğin soruyu sormanın neden bu kadar zor olduğunu ve ilişkiyi nasıl kurduğunu açıklar.',
  whatItHelpsWith:['Merakı korumak','Söyleme dürtüsünü fark etmek','Statü farkının konuşmayı nasıl bozduğunu görmek'],
  whatItDoesNotProve:['Belirli bir soru kalıbının üstünlüğünü'],
  whenNotToChooseIt:['Teknik bir soru kataloğu arıyorsan'],
  cautions:['Kısa bir kitaptır; derinliği uygulamada ortaya çıkar.'],
  reflectionPrompts:['Cevabını bilmediğim kaç soru sordum?'],
  applicationPrompts:['Bir görüşmede yalnızca cevabını gerçekten bilmediğin soruları sor.'],
  competencyTags:['Koçluk duruşunu koruma'], academyUnitTags:['CORE_QUESTIONS','FND_MINDSET'],
  mirrorLinks:['QUESTIONING','SELF_AWARENESS'], relatedBooks:['coaching.habit'] });

_bk('rosenberg.nvc', {
  title:'Nonviolent Communication', subtitle:'A Language of Life',
  authors:['Marshall B. Rosenberg'], publicationYear:2015, editionNote:'3. baskı',
  publisher:'PuddleDancer Press', isbn13:'9781892005281',
  category:'SKILL', audienceLevel:'BASLANGIC', evidenceGrade:'C',
  evidenceNotes:'Yaygın ve etkili bir uygulayıcı çerçevesi; bileşenlerinin etkisi için bağımsız denemeli kanıt sınırlıdır.',
  whyRead:'Gözlem, duygu, ihtiyaç ve rica ayrımı, yargısız yansıtma pratiğini somutlaştırır.',
  whatItHelpsWith:['Gözlemi yorumdan ayırmak','Duygu ve ihtiyacı adlandırmak','Yargısız dil'],
  whatItDoesNotProve:['Belirli bir cümle kalıbının her kültürde işlediğini'],
  whenNotToChooseIt:['Kalıp cümleleri danışana uygulayacaksan — o zaman zarar verir'],
  cautions:['Kalıp hâline gelirse yapay ve mesafeli duyulur. Yapı değil, ayrım öğrenilmelidir.'],
  reflectionPrompts:['Gözlemimi yorum gibi mi söylüyorum?'],
  applicationPrompts:['Bir görüşmede bir yorumunu, gözlem cümlesine çevirerek söyle.'],
  competencyTags:['Aktif dinleme'], academyUnitTags:['CORE_REFLECTION','FND_TRUST'],
  mirrorLinks:['REFLECTION','LISTENING'], practiceIds:['PRACTICE_REFLECT_BEFORE_ASKING'],
  relatedBooks:['stone.difficult'] });

_bk('stone.difficult', {
  title:'Difficult Conversations', subtitle:'How to Discuss What Matters Most',
  authors:['Douglas Stone','Bruce Patton','Sheila Heen'], publicationYear:2023, editionNote:'3. baskı',
  publisher:'Penguin Books', isbn13:'9780143137597',
  category:'SKILL', audienceLevel:'GELISEN', evidenceGrade:'B',
  evidenceNotes:'Harvard Müzakere Projesi geleneğinden; uzun süreli uygulama ve gözleme dayanır, deneysel etki ölçümü sınırlıdır.',
  whyRead:'Zor bir konuşmanın üç ayrı katmanını ayırmayı öğretir; koçlukta meydan okumanın nereden geldiğini netleştirir.',
  whatItHelpsWith:['Niyeti etkiden ayırmak','Kimlik tehdidini fark etmek','Suçlamadan konuşmak'],
  whatItDoesNotProve:['Her zor konuşmanın çözülebileceğini'],
  whenNotToChooseIt:['Koçluk sınırının dışına çıkmış bir konuyu konuşmaya çalışıyorsan'],
  cautions:['Bu bir koçluk kitabı değildir; ilkeler koçluk bağlamına uyarlanmalıdır.'],
  reflectionPrompts:['Meydan okurken danışanın kimliğine mi dokunuyorum?'],
  applicationPrompts:['Bir meydan okumadan sonra hiçbir şey ekleme; alan bırak.'],
  competencyTags:['Koçluk duruşunu koruma'], academyUnitTags:['CORE_CHALLENGE','FND_TRUST'],
  mirrorLinks:['CHALLENGE','LISTENING'], practiceIds:['PRACTICE_SPACE_AFTER_CHALLENGE'],
  relatedBooks:['stone.feedback'] });

_bk('stone.feedback', {
  title:'Thanks for the Feedback', subtitle:'The Science and Art of Receiving Feedback Well',
  authors:['Douglas Stone','Sheila Heen'], publicationYear:2014, publisher:'Viking',
  isbn13:'9780670014668',
  category:'SKILL', audienceLevel:'GELISEN', evidenceGrade:'B',
  evidenceNotes:'Geri bildirim alma üzerine tutarlı bir çerçeve; psikoloji literatürüne dayanır, kendi etkisi ölçülmemiştir.',
  whyRead:'Koçun kendi geri bildirimini — ve Aynadaki gözlemleri — savunmaya geçmeden karşılamasına yardım eder.',
  whatItHelpsWith:['Geri bildirimi ayrıştırmak','Tetiklenmeyi fark etmek','Kendi kör noktasına bakmak'],
  whatItDoesNotProve:['Her geri bildirimin doğru olduğunu'],
  whenNotToChooseIt:['Danışana geri bildirim vermeyi öğrenmek istiyorsan; bu kitap almak üzerinedir'],
  cautions:['Koçlukta geri bildirim vermek varsayılan değildir; önce gözlem paylaşılır.'],
  reflectionPrompts:['Aynadaki bir gözleme itiraz ettiğimde ne oldu?'],
  applicationPrompts:['Bir sonraki Aynada, kabul etmediğin gözlemi silmeden bir kez daha düşün.'],
  competencyTags:['Koçluk duruşunu koruma'], academyUnitTags:['ADV_REFLECTIVE','ADV_COACH_AGENDA'],
  mirrorLinks:['SELF_AWARENESS'], relatedBooks:['stone.difficult'] });

/* ── ADVANCED ─────────────────────────────────────────────────────────────── */

_bk('kegan.immunity', {
  title:'Immunity to Change',
  subtitle:'How to Overcome It and Unlock the Potential in Yourself and Your Organization',
  authors:['Robert Kegan','Lisa Laskow Lahey'], publicationYear:2009,
  publisher:'Harvard Business Review Press', isbn13:'9781422117361',
  category:'ADVANCED', audienceLevel:'ILERI', evidenceGrade:'B',
  evidenceNotes:'Yetişkin gelişimi kuramına dayanan yerleşik bir çerçeve; yöntemin etkisi için bağımsız denemeli kanıt sınırlıdır.',
  whyRead:'İnsanın gerçekten istediği değişime neden kendi eliyle direndiğini görünür kılar — koçlukta en sık takılınan yer.',
  whatItHelpsWith:['Görünmez taahhütleri fark etmek','Varsayımları sınamak','Derin değişim konuşmaları'],
  whatItDoesNotProve:['Her direncin gizli bir taahhütten kaynaklandığını'],
  whenNotToChooseIt:['Danışan hızlı ve somut bir karar üzerinde çalışıyorsa'],
  cautions:['Haritayı danışana teşhis gibi uygulama; bu bir keşif aracıdır.'],
  reflectionPrompts:['Kendi değişimimde hangi görünmez taahhüdüm var?'],
  applicationPrompts:['Bir görüşmede "istiyorum ama yapmıyorum" cümlesini yargısızca aç.'],
  competencyTags:['Farkındalığı güçlendirme'], academyUnitTags:['CRAFT_DEEPENING','ADV_PRESENCE'],
  approachTags:['DEVELOPMENTAL_EXECUTIVE'], mirrorLinks:['AWARENESS','CHALLENGE'],
  relatedBooks:['heifetz.line'] });

_bk('heifetz.line', {
  title:'Leadership on the Line', subtitle:'Staying Alive Through the Dangers of Change',
  authors:['Ronald A. Heifetz','Marty Linsky'], publicationYear:2017, editionNote:'yeni önsözlü baskı',
  publisher:'Harvard Business Review Press', isbn13:'9781633692831',
  category:'ADVANCED', audienceLevel:'ILERI', evidenceGrade:'B',
  evidenceNotes:'Uyarlanabilir liderlik çerçevesi; vaka temelli ve yerleşik, deneysel değil.',
  whyRead:'Yönetici danışanın kararlarının kendisinden büyük bir sistemin içinde olduğunu görmeyi sağlar.',
  whatItHelpsWith:['Teknik ve uyarlanabilir sorunu ayırmak','Sistem ve politik bağlamı okumak','Danışanın riskini görmek'],
  whatItDoesNotProve:['Belirli bir liderlik reçetesinin işlediğini'],
  whenNotToChooseIt:['Bireysel beceri koçluğu çalışıyorsan'],
  cautions:['Liderlik danışmanlığına kaymamak için koç rolünü koru.'],
  reflectionPrompts:['Danışanın sistemini mi, yoksa yalnız kendisini mi görüyorum?'],
  applicationPrompts:['Bir görüşmede danışanın kararının kimleri etkilediğini sor.'],
  competencyTags:['Farkındalığı güçlendirme'], contextTags:['executive'],
  academyUnitTags:['CTX_EXECUTIVE'], approachTags:['DEVELOPMENTAL_EXECUTIVE'],
  mirrorLinks:['AWARENESS','SESSION_FLOW'], relatedBooks:['kegan.immunity'] });

/* ── SCIENCE ──────────────────────────────────────────────────────────────── */

_bk('ryan.deci.sdt', {
  title:'Self-Determination Theory',
  subtitle:'Basic Psychological Needs in Motivation, Development, and Wellness',
  authors:['Richard M. Ryan','Edward L. Deci'], publicationYear:2017, publisher:'The Guilford Press',
  isbn13:'9781462528769',
  category:'SCIENCE', audienceLevel:'ILERI', evidenceGrade:'A',
  evidenceNotes:'Yüzlerce çalışmayla desteklenen, alanının en sağlam motivasyon kuramlarından biri.',
  whyRead:'Özerklik, yetkinlik ve ilişkisellik ihtiyaçları, danışan sahipliğinin neden bir tercih değil bir gereklilik olduğunu açıklar.',
  whatItHelpsWith:['Özerkliği desteklemek','Dış motivasyonun sınırlarını görmek','Taahhüdün neden danışana ait olması gerektiğini anlamak'],
  whatItDoesNotProve:['Koçluğun kendisinin ölçülmüş etkisini'],
  whenNotToChooseIt:['Hızlı uygulama arıyorsan; bu akademik bir başvuru kitabıdır'],
  cautions:['Ağır ve kapsamlıdır; bölüm bölüm okunması beklenir.'],
  reflectionPrompts:['Danışanın özerkliğini nerede daralttım?'],
  applicationPrompts:['Bir görüşmede eylemi danışanın kendi cümlesiyle kayda geçir.'],
  competencyTags:['Danışanın gelişimini kolaylaştırma'],
  academyUnitTags:['FND_AGENCY','CRAFT_ACTION'], mirrorLinks:['CLIENT_AGENCY','ACTION'],
  practiceIds:['PRACTICE_CLIENT_OWNS_ACTION'], sourceRefs:['sdt.deci_ryan'],
  relatedBooks:['mi.4e'] });

_bk('ericsson.peak', {
  title:'Peak', subtitle:'Secrets from the New Science of Expertise',
  authors:['Anders Ericsson','Robert Pool'], publicationYear:2016,
  publisher:'Houghton Mifflin Harcourt', isbn13:'9780544456235',
  category:'SCIENCE', audienceLevel:'GELISEN', evidenceGrade:'B',
  evidenceNotes:'Kasıtlı pratik araştırmasının birinci elden anlatımı. Kitap, kendi araştırmasından türetilen "10.000 saat kuralı" popülerleştirmesini açıkça düzeltir.',
  whyRead:'Bu sistemin kasıtlı pratik anlayışının kaynağı: tekrar değil, hedefli ve geri bildirimli çalışma.',
  whatItHelpsWith:['Tek bir davranış üzerinde çalışmak','Geri bildirim döngüsü kurmak','Deneyimi ustalıkla karıştırmamak'],
  whatItDoesNotProve:['Herkesin her alanda uzmanlaşabileceğini','10.000 saatin bir eşik olduğunu'],
  whenNotToChooseIt:['Koçluk tekniği arıyorsan; bu öğrenme bilimi üzerinedir'],
  cautions:['"10.000 saat" popülerleşmesi kitabın kendi söylediği şey değildir.'],
  reflectionPrompts:['Görüşmelerim tekrar mı, yoksa kasıtlı pratik mi?'],
  applicationPrompts:['Aynı anda tek bir davranışı seç ve üç görüşme boyunca onu izle.'],
  competencyTags:['Koçluk duruşunu koruma'], academyUnitTags:['ADV_REFLECTIVE'],
  mirrorLinks:['SELF_AWARENESS'], relatedBooks:['schon.reflective'] });

_bk('clear.atomic', {
  title:'Atomic Habits', subtitle:'An Easy & Proven Way to Build Good Habits & Break Bad Ones',
  authors:['James Clear'], publicationYear:2018, publisher:'Avery', isbn13:'9780735211292',
  category:'SCIENCE', audienceLevel:'BASLANGIC', evidenceGrade:'C',
  evidenceNotes:'Davranış bilimi bulgularının erişilebilir bir sentezi; kitabın kendi sisteminin etkisi bağımsız olarak ölçülmemiştir. Milyonlarca satması kanıt değildir.',
  whyRead:'Danışanın küçük ve sürdürülebilir bir adım seçmesine yardım ederken işine yarayacak somut bir dil verir.',
  whatItHelpsWith:['Küçük adım tasarlamak','Ortamı düzenlemek','Niyeti davranışa bağlamak'],
  whatItDoesNotProve:['Alışkanlık sisteminin her davranış için işlediğini','Motivasyonun tek başına yeterli olmadığını aşan iddiaları'],
  whenNotToChooseIt:['Danışanın konusu alışkanlık değil, anlam veya kimlikse'],
  cautions:['Reçete gibi kullanılırsa koçluk, kişisel gelişim tavsiyesine dönüşür.'],
  reflectionPrompts:['Danışana sistem mi öneriyorum, yoksa kendi seçimini mi destekliyorum?'],
  applicationPrompts:['Bir görüşmede taahhüdü danışanın kendisinin küçültmesini iste.'],
  competencyTags:['Danışanın gelişimini kolaylaştırma'], approachTags:['BEHAVIOUR_CHANGE'],
  academyUnitTags:['CRAFT_ACTION'], mirrorLinks:['ACTION'],
  sourceRefs:['behaviour.change_science'], relatedBooks:['ryan.deci.sdt'] });

/* ── CAREER ───────────────────────────────────────────────────────────────── */

_bk('ibarra.working', {
  title:'Working Identity', subtitle:'Unconventional Strategies for Reinventing Your Career',
  authors:['Herminia Ibarra'], publicationYear:2023, editionNote:'güncellenmiş baskı',
  publisher:'Harvard Business Review Press', isbn13:'9781647825560',
  category:'CAREER', audienceLevel:'GELISEN', evidenceGrade:'B',
  evidenceNotes:'Nitel araştırmaya dayanan yerleşik bir kariyer geçişi modeli; deneysel etki ölçümü yoktur.',
  whyRead:'Kariyer geçişinin analizle değil denemeyle ilerlediğini gösterir; kariyer koçluğunda planlama baskısını azaltır.',
  whatItHelpsWith:['Geçiş dönemiyle çalışmak','Kimlik denemeleri','Belirsizliğe tahammül'],
  whatItDoesNotProve:['Belirli bir geçiş sırasının herkes için doğru olduğunu'],
  whenNotToChooseIt:['Danışan somut ve acil bir karar veriyorsa'],
  cautions:['Kişilik testlerini kader gibi kullanma; bu kitap tam tersini söyler.'],
  reflectionPrompts:['Danışanı analiz etmeye mi, denemeye mi yönlendiriyorum?'],
  applicationPrompts:['Bir görüşmede "hangi küçük denemeyi yapabilirsin?" diye sor.'],
  competencyTags:['Farkındalığı güçlendirme'], approachTags:['CAREER_COACHING'],
  academyUnitTags:['CRAFT_DEEPENING'], mirrorLinks:['AWARENESS','ACTION'],
  sourceRefs:['career.construction'], relatedBooks:['kegan.immunity'] });

/* ── SPECIAL CONTEXT ──────────────────────────────────────────────────────── */

_bk('siegel.wholebrain', {
  title:'The Whole-Brain Child',
  subtitle:'12 Revolutionary Strategies to Nurture Your Child\'s Developing Mind',
  authors:['Daniel J. Siegel','Tina Payne Bryson'], publicationYear:2011,
  publisher:'Delacorte Press', isbn13:'9780553807912',
  category:'CONTEXT', audienceLevel:'BASLANGIC', evidenceGrade:'C',
  evidenceNotes:'Gelişim psikolojisinden esinlenen erişilebilir bir uygulayıcı kitabı; sinirbilim anlatımı basitleştirilmiştir ve stratejilerin etkisi bağımsız olarak ölçülmemiştir.',
  whyRead:'Çocukla çalışırken gelişimsel uygunluğun ne demek olduğunu somutlaştırır — soyut iç gözlem sorularının neden işlemediğini anlatır.',
  whatItHelpsWith:['Yaşa uygun dil','Somut ve kısa sorular','Duyguyu adlandırmaya alan açmak'],
  whatItDoesNotProve:['Sunulan beyin modelinin birebir doğru olduğunu','Koçun terapötik müdahale yapabileceğini'],
  whenNotToChooseIt:['Bir koruma endişesi varsa — o zaman kitap değil, onaylı güvenlik yolu izlenir'],
  cautions:['Ebeveynler için yazılmıştır, koçlar için değil.',
    'Sinirbilim anlatımı popülerleştirilmiştir; kanıt dili olarak alıntılama.',
    'Çocuk koçluğu veli rızası ve koruma sorumluluğu olmadan yapılmaz.'],
  reflectionPrompts:['Çocuğa sorduğum soru gerçekten yaşına uygun muydu?'],
  applicationPrompts:['Bir ergen/çocuk görüşmesinde soyut soru yerine "o an ne oldu?" diye sor.'],
  competencyTags:['Etik uygulama'], contextTags:['child','youth'], scopeZone:'AMBER',
  academyUnitTags:['CTX_YOUTH_CHILD'], mirrorLinks:['BOUNDARIES'],
  sourceRefs:['un.crc'], relatedBooks:['vanderkolk.score'] });

_bk('vanderkolk.score', {
  title:'The Body Keeps the Score', subtitle:'Brain, Mind, and Body in the Healing of Trauma',
  authors:['Bessel van der Kolk'], publicationYear:2014, publisher:'Viking', isbn13:'9780670785933',
  category:'CONTEXT', audienceLevel:'ILERI', evidenceGrade:'D',
  evidenceNotes:'Koçluk için TEMEL OLARAK UYGUN DEĞİL — bu bir travma tedavisi kitabıdır ve derecelendirmesi kitabın kalitesini değil, koçluk temeli olarak uygunsuzluğunu ifade eder. Anlatılan tedavi yöntemlerinin kanıt düzeyi de kendi içinde değişkendir.',
  whyRead:'Yalnızca kapsam farkındalığı için: travmanın nasıl göründüğünü tanıyıp koçluğu durdurmayı ve yönlendirmeyi bilmek.',
  whatItHelpsWith:['Kapsam sınırını tanımak','Yönlendirme gerektiğini fark etmek','Terapi alanını koçluktan ayırmak'],
  whatItDoesNotProve:['Koçun travmayla çalışabileceğini','Bu kitabı okumanın bir yetkinlik kazandırdığını'],
  whenNotToChooseIt:['Danışanınla travma üzerine çalışmayı düşünüyorsan — bu, koçluğun işi değildir'],
  cautions:['Bu kitap koça tedavi öğretmez ve öğretmemelidir.',
    'Kırmızı bölge sinyali varsa koçluk durur; onaylı güvenlik ve yönlendirme yolu izlenir.',
    'Teşhis dili kullanmak koçun yetkisi dışındadır.'],
  reflectionPrompts:['Kapsam dışına çıktığımı nasıl fark ederim?'],
  applicationPrompts:['Bir sarı bölge sinyali fark ettiğinde duraklat ve netleştir.'],
  competencyTags:['Etik uygulama'], scopeZone:'RED',
  academyUnitTags:['CTX_SCOPE_BOUNDARY'], mirrorLinks:['BOUNDARIES'],
  sourceRefs:['icf.ethics'], relatedBooks:['siegel.wholebrain'] });

/* ── READING SEQUENCES ────────────────────────────────────────────────────────
   Attached to the Phase 7 paths. Short on purpose: a path that recommends six
   books recommends none, because nobody reads six books before their next
   session. Reading is one step in the loop, not the loop. */
booksRegisterReading('PATH_FOUNDATION', ['co.active','whitmore.performance6','coaching.habit']);
booksRegisterReading('PATH_LISTENING',  ['kline.time','rosenberg.nvc','schein.humble']);
booksRegisterReading('PATH_QUESTIONS',  ['schein.humble','mi.4e','dejong.solutions']);
booksRegisterReading('PATH_ACTION',     ['ryan.deci.sdt','clear.atomic','mi.4e']);
booksRegisterReading('PATH_METHOD',     ['mi.4e','dejong.solutions','whitmore.performance6']);
booksRegisterReading('PATH_ADVANCED',   ['schon.reflective','kegan.immunity','ericsson.peak','stone.feedback']);
booksRegisterReading('PATH_CONTEXT',    ['heifetz.line','siegel.wholebrain','vanderkolk.score']);
