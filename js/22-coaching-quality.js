/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 3c: QUESTION QUALITY + ANTI-PATTERN REGISTRY
   Deterministic, explainable, offline. It returns REASON CODES a coach can
   argue with — never an opaque "AI score: 43%".

   It does NOT understand meaning. It recognises surface patterns that reliably
   correlate with unhelpful coaching moves, and every registry entry states its
   own detection limits out loud. A clean result is not a certificate of
   quality; a flagged result is an invitation to look again.

   Developmental, not punitive: each finding names a safer alternative, and the
   wording addresses the MOVE, never the coach.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_QUALITY_VERSION = 1;
var COACHING_QUALITY_LEVELS = ['strong','acceptable','weak','avoid'];

/* ── Anti-pattern registry ── */
var COACHING_ANTIPATTERNS = {};
function _cap(code, def){
  COACHING_ANTIPATTERNS[code] = { code:code, label:def.label, severity:def.severity,
    what:def.what, why:def.why, saferAlternative:def.safer, detectionLimits:def.limits,
    scope:def.scope||'utterance' };
}
_cap('LEADING_QUESTION',{label:'Yönlendiren soru',severity:'medium',
  what:'Cevabı soruya gömer; danışan yalnız onaylamaya davet edilir.',
  why:'Ortaya çıkan cevap danışanın değil koçun olur; farkındalık yerine uyum üretir.',
  safer:'Aynı konuyu içeriksiz bir açık soruya çevir: "Bu konuda sen ne görüyorsun?"',
  limits:'Kalıp tabanlıdır; nazikçe yönlendiren ama kalıp içermeyen soruları kaçırır.'});
_cap('ADVICE_IN_DISGUISE',{label:'Soru kılığında tavsiye',severity:'high',
  what:'"…denedin mi?" gibi biçimde soru, işlevde öneri olan cümleler.',
  why:'Danışanın düşünme alanını kapatır ve sorumluluğu sessizce koça taşır.',
  safer:'Önce seçenekleri danışandan iste; bilgi gerekiyorsa izin alarak paylaş.',
  limits:'Bazı "denedin mi" soruları gerçekten geçmişi araştırır; bağlamı ayırt edemez.'});
_cap('INTERROGATION',{label:'Sorgu örüntüsü',severity:'medium',scope:'sequence',
  what:'Arka arkaya, yansıtma olmadan sıralanan sorular.',
  why:'Konuşma sorgulamaya döner; danışan savunmaya geçer ve düşünmeye yer kalmaz.',
  safer:'Bir yansıtma, özet veya sessizlik yerleştir.',
  limits:'Yalnız hamle türü dizisine bakar; tonu ve ritmi göremez.'});
_cap('PREMATURE_SOLUTION',{label:'Erken çözüm',severity:'medium',
  what:'Durum yeterince anlaşılmadan çözüme atlamak.',
  why:'Yanlış soruna doğru çözüm üretilir; asıl mesele konuşulmadan kapanır.',
  safer:'Önce mevcut durumu ve daha önce denenenleri araştır.',
  limits:'Konuşmanın hangi aşamada olduğunu metinden bilemez.'});
_cap('COACH_AGENDA',{label:'Koçun gündemi',severity:'medium',
  what:'Koçun kendi görüşünü, tercihini veya çözümünü öne koyması.',
  why:'Oturum danışanın değil koçun gündemine kayar.',
  safer:'Görüşünü paylaşacaksan önce izin iste ve tek seçenek olarak sun.',
  limits:'Kalıp tabanlıdır; "bence" içermeyen örtük gündemi yakalayamaz.'});
_cap('WHY_BOMBARDMENT',{label:'"Neden" baskısı',severity:'medium',
  what:'Aynı cümlede ya da art arda tekrarlanan "neden/niye" soruları.',
  why:'Savunma ve gerekçelendirme üretir; merak yerine hesap sorma hissi verir.',
  safer:'"Ne" ve "nasıl" ile sor: "Bu kararı ne yönlendirdi?"',
  limits:'Sayım tabanlıdır; tek bir "neden" meşru olabilir.'});
_cap('RESCUING',{label:'Kurtarıcılık',severity:'high',
  what:'Rahatlatma, teselli veya yükü üstlenme ile zorlu anı erken kapatmak.',
  why:'Danışanın kendi kapasitesini keşfetmesini engeller ve bağımlılık üretir.',
  safer:'Duyguya alan aç, sessizlikle kal ve sorumluluğu danışanda bırak.',
  limits:'Gerçek empati ile kurtarıcılığı ayırt edemez; kalıp bazlıdır.'});
_cap('JUDGMENT',{label:'Yargı',severity:'high',
  what:'Danışanın seçimini veya kendisini değerlendiren ifadeler.',
  why:'Güveni bozar; danışan bundan sonra yalnız kabul göreceğini anlatır.',
  safer:'Yargıyı gözleme çevir: "Şunu fark ettim…" ve yorumu danışana bırak.',
  limits:'İma yoluyla kurulan yargıyı göremez.'});
_cap('STACKED_QUESTIONS',{label:'Üst üste sorular',severity:'medium',
  what:'Tek seferde birden fazla soru sormak.',
  why:'Danışan en kolayını yanıtlar; asıl soru kaybolur.',
  safer:'Tek soru sor ve bekle.',
  limits:'Soru işareti ve bağlaç sayımına dayanır.'});
_cap('FALSE_CHOICE',{label:'Yapay ikilem',severity:'medium',
  what:'Seçenekleri iki şıkla sınırlayan soru.',
  why:'Üçüncü, çoğu zaman daha iyi olan yolu görünmez kılar.',
  safer:'Seçenek üretimini aç: "Bunlardan başka ne olabilir?"',
  limits:'Meşru ikili kararları da işaretleyebilir.'});
_cap('DIAGNOSIS_LANGUAGE',{label:'Tanı dili',severity:'high',
  what:'Kişiye ruhsal durum etiketi koyan ifadeler.',
  why:'Koçun yetkisi dışındadır, yanlış olabilir ve gerçek desteği geciktirir.',
  safer:'Kapsam dilini kullan: "Bu konu koçluğun dışında olabilir; birlikte doğru desteği bulalım."',
  limits:'Terim listesine dayanır; dolaylı etiketlemeyi kaçırır.'});
_cap('OVERCOMPLEX_QUESTION',{label:'Aşırı karmaşık soru',severity:'low',
  what:'Çok uzun, çok katmanlı veya soyut kurulmuş soru.',
  why:'Danışan soruyu çözmeye çalışır, kendi düşüncesine değil soruya odaklanır.',
  safer:'Tek fikre indir ve kısalt.',
  limits:'Uzunluk ve bağlaç sayımıdır; kısa ama kafa karıştırıcı soruları kaçırır.'});
_cap('AGE_INAPPROPRIATE_ABSTRACTION',{label:'Yaşa uygun olmayan soyutluk',severity:'medium',
  what:'Çocuk/ergen bağlamında gelişimsel olarak ağır soyut kavramlar.',
  why:'Çocuk anlamadığını söylemek yerine uydurur; konuşma sahte bir zemine oturur.',
  safer:'Somut, güncel ve tek adımlık bir soruya çevir.',
  limits:'Kelime listesi ve uzunluk ölçer; gerçek gelişim düzeyini bilemez.'});
_cap('CLOSED_WHEN_OPEN_PREFERRED',{label:'Kapalı soru',severity:'low',
  what:'Evet/hayır ile kapanan, keşif aşamasında alan açmayan soru.',
  why:'Konuşmayı daraltır; koç sıradaki soruyu üretmek zorunda kalır.',
  safer:'"Ne" veya "nasıl" ile yeniden kur.',
  limits:'Kalıp tabanlıdır: rica biçimlerini ("anlatır mısın") kapalı saymaz ve her kapalı sorunun kötü olmadığını ayırt edemez.'});
function coachingAntiPattern(code){ return Object.prototype.hasOwnProperty.call(COACHING_ANTIPATTERNS,code)?COACHING_ANTIPATTERNS[code]:null; }
function coachingAntiPatternCodes(){ return Object.keys(COACHING_ANTIPATTERNS).sort(); }

/* ── Text folding (same approach as the safeguard layer) ── */
var _CQ_FOLD = { 'ı':'i','İ':'i','ğ':'g','Ğ':'g','ü':'u','Ü':'u','ş':'s','Ş':'s','ö':'o','Ö':'o','ç':'c','Ç':'c','â':'a','î':'i','û':'u' };
function _cqFold(t){
  var s=String(t==null?'':t), out='';
  for(var i=0;i<s.length;i++){ var c=s[i]; out += Object.prototype.hasOwnProperty.call(_CQ_FOLD,c)?_CQ_FOLD[c]:c; }
  return out.toLowerCase().replace(/\s+/g,' ').trim();
}
function _cqCount(re, t){ var m=t.match(re); return m?m.length:0; }

var _CQ_OPEN_WORDS = /\b(ne|neyi|neye|nasil|hangi|kim|kimden|kime|nerede|nereden|kac|nicin)\b/;
var _CQ_REQUEST_TAIL = /(misin|misiniz|musun|musunuz)\s*\?*\s*$/;

/* ── Utterance analysis ── */
function coachingAnalyzeQuestion(text, opts){
  opts = opts || {};
  var raw = String(text==null?'':text);
  var t = _cqFold(raw);
  var findings = [];
  function flag(code, detail){
    var ap = coachingAntiPattern(code); if(!ap) return;
    findings.push({ code:code, severity:ap.severity, label:ap.label,
      saferAlternative:ap.saferAlternative, detectionLimits:ap.detectionLimits,
      detail:detail||null });
  }
  if(!t) return { quality:'weak', reasonCodes:['EMPTY'], findings:[],
    rationale:'Boş metin değerlendirilemez.', version:COACHING_QUALITY_VERSION };

  var qMarks = _cqCount(/\?/g, raw);
  if(qMarks>1) flag('STACKED_QUESTIONS','birden fazla soru işareti');
  else if(qMarks===1 && /\?[^?]*\b(ve|ayrica|bir de)\b[^?]*(ne|nasil|hangi|kim)\b/.test(t)) flag('STACKED_QUESTIONS','tek cümlede iki soru');
  else if(/\b(ne|nasil|hangi|kim)\b[^?]*\b(ve|ayrica|bir de)\b[^?]*\b(ne|nasil|hangi|kim)\b[^?]*\?/.test(t)) flag('STACKED_QUESTIONS','tek cümlede iki soru');

  if(/degil mi\s*\?*$|haksiz miyim|oyle degil mi|dogru mu\s*\?*$|olmaz miydi|en iyisi .* degil mi|sence de\b/.test(t))
    flag('LEADING_QUESTION');
  if(/\b(denedin mi|denemeyi dusundun mu|yapmayi dusundun mu|yapsan olmaz mi)\b/.test(t)
     || /\b(neden|niye)\b[^?]*m[iu]yorsun\b/.test(t)
     || /\b(have you tried|why don'?t you|why not just)\b/.test(t))
    flag('ADVICE_IN_DISGUISE');
  if(/\b(bence|ben olsam|sana tavsiyem|benim gorusum|yerinde olsam ben|senin yapman gereken)\b/.test(t)
     || /\bi think you should\b/.test(t))
    flag('COACH_AGENDA');
  if(/\b(hemen cozelim|soyle yapalim|sunu yapalim|cozum su|hemen bir plan yapalim)\b/.test(t))
    flag('PREMATURE_SOLUTION');
  var why = _cqCount(/\b(neden|niye|why)\b/g, t);
  if(why>=2) flag('WHY_BOMBARDMENT', why+' kez');
  if(/\b(merak etme|uzulme|hallederiz|ben hallederim|bosver|takma kafana|don'?t worry)\b/.test(t))
    flag('RESCUING');
  if(/\b(yanlis yapmissin|hata etmissin|yapmamaliydin|sacma|kotu bir karar|bu yanlis|boyle olmaz)\b/.test(t))
    flag('JUDGMENT');
  if(/\bm[iu]\b[^?]*\byoksa\b[^?]*\bm[iu]\b/.test(t) && !/\bbaska\b/.test(t))
    flag('FALSE_CHOICE');
  if(/\b(depresyondasin|depresyonun var|anksiyeten var|bipolarsin|narsist(sin)?|travmatiksin|hastasin|sende .* var)\b/.test(t)
     || /\byou (have|are) (depressed|bipolar|traumatized)\b/.test(t))
    flag('DIAGNOSIS_LANGUAGE');

  var words = t.split(' ').filter(Boolean).length;
  if(raw.length>160 || words>25 || _cqCount(/\b(ki|ancak|fakat|ragmen|dolayisiyla|bununla birlikte)\b/g,t)>=2)
    flag('OVERCOMPLEX_QUESTION', words+' kelime / '+raw.length+' karakter');

  var isRequest = _CQ_REQUEST_TAIL.test(t);
  if(!isRequest && /\bm[iu]\s*\?*\s*$/.test(t) && !_CQ_OPEN_WORDS.test(t) && opts.prefersOpen!==false)
    flag('CLOSED_WHEN_OPEN_PREFERRED');

  if(opts.context==='child' || opts.context==='youth'){
    var abstract = /\b(farkindalik|varsayim|perspektif|ic(sel)? motivasyon|deger sistemi|kavramsal|paradigma|ontolojik|stratejik onceli|oz farkindalik|bilissel)\b/.test(t);
    if(abstract || raw.length>90 || (opts.depth===3))
      flag('AGE_INAPPROPRIATE_ABSTRACTION', abstract?'soyut kavram':(raw.length>90?'çok uzun':'derinlik 3'));
  }

  var sev = findings.reduce(function(m,f){
    return (f.severity==='high') ? 'high' : (f.severity==='medium' && m!=='high') ? 'medium' : (m||(f.severity==='low'?'low':m));
  }, null);
  var quality = sev==='high' ? 'avoid' : sev==='medium' ? 'weak' : sev==='low' ? 'acceptable' : 'strong';
  var codes = findings.map(function(f){ return f.code; }).sort();
  return { quality:quality, reasonCodes:codes, findings:findings,
    rationale: codes.length ? 'Bu hamlede yeniden bakılacak nokta var.' : 'Bilinen bir sorun kalıbı bulunmadı (bu bir kalite garantisi değildir).',
    version:COACHING_QUALITY_VERSION };
}

/* ── Sequence analysis: patterns a single utterance cannot show ── */
function coachingAnalyzeSequence(recentMoves){
  var moves = Array.isArray(recentMoves) ? recentMoves.slice(-8) : [];
  var findings = [], types = moves.map(function(m){ return (m && m.type) || String(m||''); });
  var run = 0, maxRun = 0;
  types.forEach(function(t){ if(coachingTypeIsQuestion(t)){ run++; maxRun = Math.max(maxRun, run); } else run = 0; });
  if(maxRun>=3){
    var ap = coachingAntiPattern('INTERROGATION');
    findings.push({ code:'INTERROGATION', severity:ap.severity, label:ap.label,
      saferAlternative:ap.saferAlternative, detectionLimits:ap.detectionLimits, detail:maxRun+' ardışık soru' });
  }
  var challenges = types.filter(function(t){ return t==='CHALLENGE'; }).length;
  if(challenges>=2 && types.slice(-2).every(function(t){ return t==='CHALLENGE'; })){
    var ap2 = coachingAntiPattern('COACH_AGENDA');
    findings.push({ code:'COACH_AGENDA', severity:ap2.severity, label:ap2.label,
      saferAlternative:'Meydan okumadan sonra alan bırak: yansıtma veya sessizlik.',
      detectionLimits:ap2.detectionLimits, detail:'arka arkaya meydan okuma' });
  }
  return { questionRun:maxRun, findings:findings,
    reasonCodes:findings.map(function(f){ return f.code; }).sort(), version:COACHING_QUALITY_VERSION };
}

function coachingQualitySelfCheck(){
  return { version:COACHING_QUALITY_VERSION, levels:COACHING_QUALITY_LEVELS.slice(),
    antiPatterns:coachingAntiPatternCodes(),
    severities:coachingAntiPatternCodes().reduce(function(m,c){ m[c]=COACHING_ANTIPATTERNS[c].severity; return m; },{}) };
}

if(typeof window!=='undefined'){
  window.COACHING_QUALITY_VERSION=COACHING_QUALITY_VERSION;
  window.COACHING_QUALITY_LEVELS=COACHING_QUALITY_LEVELS;
  window.COACHING_ANTIPATTERNS=COACHING_ANTIPATTERNS;
  window.coachingAntiPattern=coachingAntiPattern; window.coachingAntiPatternCodes=coachingAntiPatternCodes;
  window.coachingAnalyzeQuestion=coachingAnalyzeQuestion; window.coachingAnalyzeSequence=coachingAnalyzeSequence;
  window.coachingQualitySelfCheck=coachingQualitySelfCheck;
}
