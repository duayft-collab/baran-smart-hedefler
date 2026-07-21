function log(m){D.logs=[{time:U.ts(),action:m}].concat(D.logs||[]).slice(0,100);}
function xp(amt,why){D.stats.xp=(D.stats.xp||0)+amt;D.stats.level=Math.floor(D.stats.xp/500)+1;log('+'+amt+' XP: '+why);save();}
function snap(){hist=[JSON.stringify(D)].concat(hist).slice(0,50);}
function undo(){
  if(!assertRestoreIdle('undo'))return;     // restore kilidi: hist tuketilmez, D degismez
  if(!hist.length)return;D=JSON.parse(hist[0]);hist=hist.slice(1);save();render();
}

function ge(id){return document.getElementById(id);}
function sh(id,html){var e=ge(id);if(e)e.innerHTML=html;}

function toggleNav(){var s=document.getElementById('shell');if(s)s.classList.toggle('nav-open');}
function closeNav(){var s=document.getElementById('shell');if(s)s.classList.remove('nav-open');}
window.toggleNav=toggleNav;
function gotoTab(id){tab=id;renderNav();renderPage();closeNav();if(typeof wdTick==='function')wdTick();} // D10.2: gezinmede Bilgelik kartı (bellekten, Firestore okumaz)
window.gotoTab=gotoTab;

function fil(list,keys){
  if(!searchQ||!list)return list||[];
  var lq=searchQ.toLowerCase();
  return list.filter(function(i){return keys.some(function(k){return i[k]&&String(i[k]).toLowerCase().indexOf(lq)>=0;});});
}

function del(id,type){
  if(!confirm(L('confirm')))return;
  var km={goal:'goals',todo:'todos',kpi:'kpis',quote:'quotes',journal:'journal',principle:'principles',coaching:'coaching',question:'questions',vault:'vault',challenge:'challenges',mybook:'mybooks',sop:'sops',habit:'habits',gtd:'gtdInbox'};
  var key=km[type];
  if(!key||!D[key])return;
  snap();D[key]=D[key].filter(function(i){return i.id!==id;});
  log(type+' silindi');save();renderPage();
}
window.del=del;

/* ══════════════════════════════════════════════════════════════════════════
   SMART P0 MOTORU — icerik-farkinda analiz, Quality Index, Coach, metric ilerleme
   Additive: yeni goal.metric alani opsiyonel; measurable string geriye uyumlu korunur.
   ══════════════════════════════════════════════════════════════════════════ */
var VAGUE_WORDS=['daha iyi','daha mutlu','daha başarılı','daha çok','daha fazla','biraz',
  'güzel','mutlu olmak','iyi olmak','pozitif olmak','gelişmek','başarılı olmak',
  'daha pozitif','daha sağlıklı','kaliteli biri'];
var GRANDIOSE=['milyarder','trilyon','dünyanın en','en zengin','milyoner','imparatorluk'];
var ACTION_VERBS=['al','bitir','yayınla','ulaş','kazan','koş','oku','yaz','tamamla','kur',
  'öğren','sertifika','geç','düş','artır','azalt','başla','sat','üret','indir','çık'];
/* Anlamsiz "neden" dolgu kaliplari — yalnizca dolu oldugu icin puan almamali. */
var WEAK_WHY=['önemli','iyi olur','iyi olsun','lazım','gerekli','hedefim','olsun',
  'istiyorum','faydalı','güzel olur','iyi bir şey','yapmalıyım'];

/* Anlamsiz/filler metin: cok kisa, yalniz rakam/noktalama, harfsiz, tek tekrar karakter. */
function isJunkText(t){
  t=String(t==null?'':t).trim();
  if(t.length<4)return true;                          // cok kisa
  if(/^[\d\s.,:;/_\-]+$/.test(t))return true;         // yalniz rakam/noktalama
  if(!/[a-zçğıöşüâîû]/i.test(t))return true;          // hic harf yok (sadece sembol)
  if(/^(.)\1{2,}$/.test(t.replace(/\s+/g,'')))return true; // aaaa / 1111 tek karakter tekrari
  return false;
}
/* Bir adim gecerli (anlamli) aksiyon mu? */
function isValidStep(s){return !isJunkText(s&&s.t!==undefined?s.t:s);}
function validStepCount(g){return ((g&&g.steps)||[]).filter(isValidStep).length;}
/* Neden gucu: 0=yok/cok kisa, 1=zayif/dolgu, 2=anlamli. */
function whyStrength(why){
  why=String(why||'').trim();
  if(why.length<12)return 0;
  var lw=why.toLowerCase();
  var onlyWeak=why.length<24&&WEAK_WHY.some(function(w){return lw.indexOf(w)>=0;});
  if(onlyWeak)return 1;
  return why.length>=28?2:1;
}
/* Clarity: uzunluk tek basina yetmez; somut fiil/nesne + belirsiz/test/filler cezasi. */
function clarityScore(title){
  title=String(title||'').trim();
  if(title.length<10||hasVague(title)||isJunkText(title))return 0;
  if(/\btest\b/i.test(title))return 2;                // test/filler basligi cezali
  var hv=hasActionVerb(title), hn=/\d/.test(title);
  if(hv&&hn)return 8;
  if(hv||hn)return 6;
  return title.length>=15?4:2;
}

/* measurable string veya goal.metric objesinden sayisal olcum cikar (dual-read) */
function readMetric(g){
  if(g&&g.metric&&typeof g.metric.target==='number'){
    return {target:g.metric.target,current:Number(g.metric.current||0),
      start:Number(g.metric.start||0),unit:g.metric.unit||'',
      direction:g.metric.direction||'up',structured:true};
  }
  // eski measurable stringinde sayi ara
  var s=String((g&&g.measurable)||'');
  var m=s.match(/-?\d[\d.,]*/);
  return {hasNumber:!!m,raw:s,structured:false};
}
function hasVague(t){t=(t||'').toLowerCase();return VAGUE_WORDS.some(function(w){return t.indexOf(w)>=0;});}
function hasActionVerb(t){t=(t||'').toLowerCase();return ACTION_VERBS.some(function(v){
  return new RegExp('(^|\\s)'+v).test(t);});}
function isGrandiose(t){t=(t||'').toLowerCase();return GRANDIOSE.some(function(w){return t.indexOf(w)>=0;});}
function daysUntil(dl){if(!dl)return null;return Math.ceil((new Date(dl)-new Date())/864e5);}

/* Icerik-farkinda SMART analizi: her harf {pass, reason, suggestion} */
function smartAnalyze(g){
  g=g||{};
  var title=g.title||'', mm=readMetric(g), dl=g.deadline, du=daysUntil(dl);
  var why=(g.desc||g.notes||'');
  var R={};
  // S — Spesifik: net, belirsiz kelime yok, eylem/nesne var
  if(!title||title.length<10)
    R.S={pass:false,reason:'Başlık çok kısa/genel',suggestion:'Neyi, ne kadar? Somut yaz.'};
  else if(hasVague(title))
    R.S={pass:false,reason:'Belirsiz ifade içeriyor',suggestion:'"'+title+'" belirsiz. Ölçülebilir bir sonuca çevir.'};
  else if(!hasActionVerb(title)&&!/\d/.test(title))
    R.S={pass:false,reason:'Somut eylem yok',suggestion:'Bir eylem fiili ekle: al, bitir, ulaş...'};
  else R.S={pass:true,reason:'Spesifik',suggestion:''};
  // M — Olculebilir: yapisal metric veya sayi+birim
  if(mm.structured)R.M={pass:true,reason:'Sayısal hedef tanımlı',suggestion:''};
  else if(mm.hasNumber)R.M={pass:true,reason:'Ölçütte sayı var',suggestion:'Hedef/mevcut değeri yapısal gir (otomatik %).'};
  else R.M={pass:false,reason:'Ölçüt sayısal değil',suggestion:'Bunu bir sayıya bağla: kaç? kaça kadar?'};
  // T — Zamanli: gelecekte tarih
  if(!dl)R.T={pass:false,reason:'Tarih yok',suggestion:'Bitiş tarihi + ara kontrol noktaları koy.'};
  else if(du!==null&&du<0)R.T={pass:false,reason:'Tarih geçmişte',suggestion:'Deadline geçmiş. Gerçekçi bir tarih seç.'};
  else R.T={pass:true,reason:'Zamanlı',suggestion:''};
  // A — Ulasilabilir: buyukluk/sure orani + parcalama
  var steps=validStepCount(g);
  if(isGrandiose(title)&&(du===null||du<180))
    R.A={pass:false,reason:'Süreye göre çok iddialı',suggestion:'Aşamalandır veya süreyi gerçekçileştir.'};
  else if(steps===0&&!(g.metric&&g.metric.checkpoints&&g.metric.checkpoints.length))
    R.A={pass:false,reason:'Geçerli aksiyon planı yok',suggestion:'İlk 1-3 somut, anlamlı adımı ekle; hedefi böl.'};
  else R.A={pass:true,reason:'Ulaşılabilir görünüyor',suggestion:''};
  // R — Anlamli: gercek bir neden
  if(!why||why.length<12)R.R={pass:false,reason:'Neden zayıf/yok',suggestion:'Bu hedef neden **senin için** önemli? Yaz.'};
  else R.R={pass:true,reason:'Anlamlı',suggestion:''};
  R.passCount=['S','M','A','R','T'].filter(function(k){return R[k].pass;}).length;
  return R;
}
/* Eski imza korunur ama artik ICERIK-FARKINDA (0-5). Tum cagiranlar calisir. */
function smartScore(g){return smartAnalyze(g).passCount;}

/* Goal Quality Index 0-100 — 14 boyut. Kalibrasyon: cop icerik taban puan almaz. */
function qualityIndex(g){
  g=g||{};var sa=smartAnalyze(g),mm=readMetric(g),title=g.title||'',why=(g.desc||g.notes||'');
  var vsteps=validStepCount(g),ws=whyStrength(why);
  var hasCheck=!!(g.metric&&g.metric.checkpoints&&g.metric.checkpoints.length);
  var p={};
  p.Specific=sa.S.pass?10:0;
  p.Measurable=sa.M.pass?(mm.structured?10:6):0;
  p.Achievable=sa.A.pass?10:0;
  p.Relevant=ws>=2?10:(ws===1?4:0);                        // neden kalitesine gore kademeli
  p.Time=sa.T.pass?10:0;
  p.Clarity=clarityScore(title);                           // uzunluk degil icerik
  p.Difficulty=mm.structured?6:(mm.hasNumber?3:0);
  p.Leverage=g.frog?6:0;                                    // kritik hedef = kaldirac
  p.OpportunityCost=4;                                      // notr (cross-goal analiz sonraki faz)
  p.Identity=/kimlik|biri olmak|insan olmak|karakter|değer/i.test(why)?6:0;
  p.Risk=(g.intel&&g.intel.risk)?6:0;
  p.SecondOrder=(g.intel&&g.intel.secondOrder)?4:0;
  p.Compound=(vsteps>0||hasCheck)?4:0;                      // gecerli adim/checkpoint
  p.ExecutionReadiness=vsteps>0?6:0;                        // gecerli adim varsa
  var score=Object.keys(p).reduce(function(a,k){return a+p[k];},0);
  // Kritik tavan: temel SMART sinyalleri eksikse yuksek puan verilmez.
  var crit=0;
  if(!sa.S.pass)crit++;
  if(!sa.M.pass)crit++;
  if(!sa.T.pass)crit++;
  if(vsteps===0&&!hasCheck)crit++;                         // gecerli aksiyon yok
  if(ws<1)crit++;                                           // gercek neden yok
  if(crit>=3)score=Math.min(score,39);
  else if(crit>=2)score=Math.min(score,49);
  score=Math.max(0,Math.min(100,score));
  var band=score>=85?'Mükemmel':score>=70?'Güçlü':score>=50?'Orta':score>=30?'Zayıf':'Çok Zayıf';
  return {score:score,band:band,parts:p};
}

/* ══ GOAL COACH P1 — deterministik teshis motoru ══
   goalDiagnose(g): yapilandirilmis teshis listesi (salt hesap; payload'a yazilmaz).
   goalCoach(g): geriye-uyumlu string[] (mevcut UI korunur). */

/* metric.current alani GERCEKTEN eksik mi? 0 gecerli bir degerdir. */
function metricCurrentMissing(g){
  if(!g||!g.metric||typeof g.metric.target!=='number')return false;
  var c=g.metric.current;
  if(c===undefined||c===null||c==='')return true;
  if(typeof c==='number')return isNaN(c);
  return isNaN(parseFloat(c));
}
/* Birlesik (coklu) hedef mi? Salt uzunluk DEGIL — bagimsiz sonuclar. */
function isMultiGoal(title){
  var t=(title||'').toLowerCase();
  if(/\bhem\b[^]*\bhem\b/.test(t))return true;                 // "hem ... hem ..."
  var parts=t.split(/\s+ve\s+|\s+ayrıca\s+|\s+bir de\s+/);
  if(parts.length>=2){
    var withNum=parts.filter(function(p){return /\d/.test(p);});
    if(withNum.length>=2)return true;                          // iki tarafta da sayisal sonuc
    var acted=parts.filter(function(p){return hasActionVerb(p)&&p.trim().length>=8;});
    if(acted.length>=2)return true;                            // iki bagimsiz eylem-cumlesi
  }
  return false;
}

/* Kural kaydi — tek otorite. when() smartAnalyze/qualityIndex ile TUTARLI. */
function coachRules(){
  return [
  {code:'junk_goal',dim:'S',severity:'high',priority:100,field:'title',
    when:function(g,x){return /\btest\b/i.test(g.title||'')||isJunkText(g.title||'');},
    title:'Taslak hedef',message:'Bu bir deneme/taslak gibi görünüyor.',action:'Gerçek, somut bir hedef yaz.'},
  {code:'vague_title',dim:'S',severity:'high',priority:92,field:'title',
    when:function(g,x){return !x.sa.S.pass&&hasVague(g.title||'');},
    title:'Belirsiz başlık',message:'Başlık belirsiz.',action:'Somut bir sonuç yaz: neyi, ne kadar?'},
  {code:'no_specificity',dim:'S',severity:'high',priority:90,field:'title',
    when:function(g,x){return !x.sa.S.pass&&!hasVague(g.title||'')&&!/\btest\b/i.test(g.title||'')&&!isJunkText(g.title||'');},
    title:'Somut değil',message:'Hedef yeterince somut değil.',action:'Bir eylem fiili ve net sonuç ekle.'},
  {code:'missing_metric',dim:'M',severity:'high',priority:88,field:'metric',
    when:function(g,x){return !x.sa.M.pass;},
    title:'Ölçüm eksik',message:'İlerlemeyi ölçemeyiz.',action:'Bir hedef değer ve birim ekle.'},
  {code:'missing_deadline',dim:'T',severity:'high',priority:82,field:'deadline',
    when:function(g,x){return !g.deadline;},
    title:'Tarih yok',message:'Bitiş tarihi yok.',action:'Gerçekçi bir bitiş tarihi seç.'},
  {code:'past_deadline',dim:'T',severity:'high',priority:82,field:'deadline',
    when:function(g,x){return !!g.deadline&&x.du!==null&&x.du<0;},
    title:'Tarih geçmiş',message:'Bitiş tarihi geçmişte.',action:'İleri bir tarih seç.'},
  {code:'unrealistic_scope',dim:'A',severity:'high',priority:78,field:'title',
    when:function(g,x){return !x.sa.A.pass&&isGrandiose(g.title||'');},
    title:'Gerçekçi değil',message:'Süreye göre çok iddialı.',action:'Aşamalandır veya süreyi gerçekçileştir.'},
  {code:'missing_valid_step',dim:'A',severity:'med',priority:74,field:'steps',
    when:function(g,x){return !x.sa.A.pass&&!isGrandiose(g.title||'');},
    title:'Uygulama planı yok',message:'Geçerli bir aksiyon adımı yok.',action:'İlk uygulanabilir adımı belirt.'},
  {code:'weak_why',dim:'R',severity:'med',priority:60,field:'desc',
    when:function(g,x){return !x.sa.R.pass;},
    title:'Neden zayıf',message:'Bu hedefin neden önemli olduğu belirsiz.',action:'Bu hedef senin için neden önemli, somutlaştır.'},
  {code:'weak_metric',dim:'M',severity:'low',priority:50,field:'metric',
    when:function(g,x){return x.sa.M.pass&&!x.mm.structured;},
    title:'Ölçüm yapısal değil',message:'Ölçüt metin içinde.',action:'Hedef/mevcut değeri sayısal gir (otomatik %).'},
  {code:'missing_start_value',dim:'M',severity:'low',priority:46,field:'metric',
    when:function(g,x){return x.mm.structured&&metricCurrentMissing(g);},
    title:'Mevcut değer eksik',message:'Başlangıç/mevcut değer girilmemiş.',action:'Mevcut değeri gir (0 da geçerlidir).'},
  {code:'multi_goal',dim:'S',severity:'low',priority:40,field:'title',
    when:function(g,x){return isMultiGoal(g.title||'');},
    title:'Birden fazla hedef',message:'Birden fazla bağımsız hedef birleşmiş.',action:'Ayrı hedeflere böl.'}
  ];
}
/* Yapilandirilmis teshis: oncelikli, deduped, banda gore capli. */
function goalDiagnose(g){
  g=g||{};
  var x={sa:smartAnalyze(g),qi:qualityIndex(g),mm:readMetric(g),du:daysUntil(g.deadline)};
  var out=[],seen={};
  coachRules().forEach(function(r){
    if(seen[r.code])return;
    var ok=false;try{ok=r.when(g,x);}catch(e){ok=false;}
    if(!ok)return;
    seen[r.code]=1;
    out.push({code:r.code,dimension:r.dim,severity:r.severity,priority:r.priority,
      title:r.title,message:r.message,action:r.action,field:r.field});
  });
  out.sort(function(a,b){return b.priority-a.priority;});
  var cap=x.qi.score>=70?1:x.qi.score>=50?3:4;                 // guclu:1, orta:3, kritik:4
  out=out.slice(0,cap);
  if(out.length===0&&x.qi.score>=70)
    out.push({code:'strong_goal',dimension:null,severity:'ok',priority:0,
      title:'Hedef güçlü',message:'Hedef güçlü görünüyor.',action:'',field:null});
  return out;
}
/* Geriye uyumlu string[] — mevcut UI (form/detay/SMART) korunur. */
function goalCoach(g){
  return goalDiagnose(g).filter(function(d){return d.code!=='strong_goal';})
    .map(function(d){return d.action||d.message;});
}
/* Kural tabanli, deterministik yeniden yazim onerisi. Uydurmaz; placeholder kullanir. Payload'i degistirmez. */
function suggestGoalRewrite(g){
  g=g||{};var mm=readMetric(g),du=daysUntil(g.deadline),missing=[];
  var core=String(g.title||'').trim();
  VAGUE_WORDS.forEach(function(w){core=core.replace(new RegExp(w,'gi'),'').trim();});
  if(!core)core='[hedefin]';
  var datePart;
  if(g.deadline&&du!==null&&du>=0){datePart=g.deadline+' tarihine kadar';}
  else{datePart='[tarih] tarihine kadar';missing.push('deadline');}
  var metricPart;
  if(mm.structured){metricPart=mm.target+' '+(mm.unit||'[birim]');if(!mm.unit)missing.push('metric');}
  else if(mm.hasNumber){metricPart=mm.raw;}
  else{metricPart='[hedef değer] [birim]';missing.push('metric');}
  var suggested=datePart+' '+core+' — '+metricPart+' seviyesine ulaş.';
  var conf=missing.length===0?'high':missing.length===1?'medium':'low';
  return {original:g.title||'',suggested:suggested,missingFields:missing,confidence:conf};
}

/* ══ FAZ-3: AKSIYON ADIMLARI (dual-read, string-guvenli ID) ══ */
var _stepSeq=0;
/* Cakismaya dayanikli step ID (yalniz Date.now degil). */
function newStepId(){return 's'+Date.now().toString(36)+'-'+(_stepSeq++).toString(36);}
/* Eski string veya {id,t/text,done} -> kanonik {id,t,done,order}. Payload MUTE edilmez. */
function normalizeGoalSteps(g){
  var arr=(g&&g.steps)||[];
  return arr.map(function(s,i){
    if(typeof s==='string')return {id:'s-legacy-'+i,t:s,done:false,order:i};
    var t=(s&&s.t!==undefined)?s.t:((s&&s.text!==undefined)?s.text:'');
    return {id:(s&&s.id!=null&&s.id!=='')?s.id:('s-legacy-'+i),t:String(t),done:!!(s&&s.done),order:i};
  });
}
/* Kaydedilecek forma cevir (dizi konumu = sira). */
function serializeGoalSteps(steps){
  return (steps||[]).map(function(s,i){return {id:s.id,t:String(s.t||''),done:!!s.done,order:i};});
}
/* Adim dogrulama: bos/bosluk/noktalama/rakam/tekrar/500+/duplicate. */
function validateGoalStep(text,existingSteps,selfId){
  var t=String(text==null?'':text).trim();
  if(!t)return {ok:false,reason:'Adım boş olamaz.'};
  if(t.length>500)return {ok:false,reason:'Adım 500 karakteri geçemez.'};
  if(isJunkText(t))return {ok:false,reason:'Daha anlamlı bir adım yaz.'};
  var dup=(existingSteps||[]).some(function(s){return String(s.id)!==String(selfId)&&
    String((s&&s.t!==undefined?s.t:s)||'').trim().toLowerCase()===t.toLowerCase();});
  if(dup)return {ok:false,reason:'Bu adım zaten var.'};
  return {ok:true};
}
/* Kaydetmede: bos/junk/500+/duplicate ayikla. Saf ve test edilebilir. */
function collectValidSteps(rawSteps){
  var out=[],seen={},dropped=0,dups=0;
  (rawSteps||[]).forEach(function(s){
    var t=String((s&&s.t!==undefined?s.t:s)||'').trim();
    if(!t){dropped++;return;}
    if(t.length>500)t=t.slice(0,500);
    if(isJunkText(t)){dropped++;return;}
    var key=t.toLowerCase();
    if(seen[key]){dups++;dropped++;return;}
    seen[key]=1;out.push({id:(s&&s.id)||newStepId(),t:t,done:!!(s&&s.done)});
  });
  return {steps:out,dropped:dropped,dups:dups};
}

/* ══ FAZ-3: GUVENLI ZENGIN METIN (markdown-string modeli) ══
   Ham HTML SAKLANMAZ. renderRichText once her seyi escape eder, yalniz allowlist
   tag'leri (p,br,strong,em,u,ul,ol,li,a) URETIR. script/onerror/javascript: literal metin olur. */
var RICH_ALLOW=['p','br','strong','em','u','ul','ol','li','a'];
function _rtEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function normalizeRichText(v){return String(v==null?'':v);}
/* Saklamadan once: string'e cevir, uzunluk sinirla. Guvenlik render'da (escape-all). */
function sanitizeRichText(v){return normalizeRichText(v).replace(/\r\n?/g,'\n').slice(0,5000);}
function isRichTextEmpty(v){return richTextToPlainText(v).trim()==='';}
function _rtInline(line){
  var s=_rtEsc(line);
  // Yalniz http(s) autolink (javascript:/data: ASLA eslesmez cunku sema kontrollu)
  s=s.replace(/https?:\/\/[^\s<]+/g,function(u){
    var core=u.replace(/[.,;:!?)]+$/,''),tail=u.slice(core.length);
    if(!/^https?:\/\//i.test(core))return u;
    return '<a href="'+core+'" rel="noopener noreferrer" target="_blank">'+core+'</a>'+tail;
  });
  s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
  s=s.replace(/__([^_\n]+)__/g,'<u>$1</u>');
  return s;
}
function renderRichText(value){
  var v=normalizeRichText(value).replace(/\r\n?/g,'\n');
  if(!v.trim())return '';
  var lines=v.split('\n'),html='',i=0;
  var isCheck=function(l){return /^\s*\[( |x|X)\]\s+/.test(l);};
  var isBullet=function(l){return /^\s*[-*]\s+/.test(l)&&!isCheck(l);};
  var isNum=function(l){return /^\s*\d+[.)]\s+/.test(l);};
  while(i<lines.length){
    var line=lines[i];
    if(/^\s*$/.test(line)){i++;continue;}
    if(isCheck(line)){
      html+='<ul>';
      while(i<lines.length&&isCheck(lines[i])){
        var mc=lines[i].match(/^\s*\[( |x|X)\]\s+(.*)$/),dn=mc[1].toLowerCase()==='x';
        html+='<li>'+(dn?'<strong>[x]</strong> ':'[ ] ')+_rtInline(mc[2])+'</li>';i++;
      }
      html+='</ul>';continue;
    }
    if(isBullet(line)){
      html+='<ul>';
      while(i<lines.length&&isBullet(lines[i])){html+='<li>'+_rtInline(lines[i].replace(/^\s*[-*]\s+/,''))+'</li>';i++;}
      html+='</ul>';continue;
    }
    if(isNum(line)){
      html+='<ol>';
      while(i<lines.length&&isNum(lines[i])){html+='<li>'+_rtInline(lines[i].replace(/^\s*\d+[.)]\s+/,''))+'</li>';i++;}
      html+='</ol>';continue;
    }
    var para=[];
    while(i<lines.length&&!/^\s*$/.test(lines[i])&&!isBullet(lines[i])&&!isNum(lines[i])&&!isCheck(lines[i])){
      para.push(_rtInline(lines[i]));i++;
    }
    html+='<p>'+para.join('<br>')+'</p>';
  }
  return html;
}
/* Quality/Coach icin duz metin karsiligi. */
function richTextToPlainText(value){
  return normalizeRichText(value).replace(/\r\n?/g,'\n')
    .replace(/^\s*\[( |x|X)\]\s+/gm,'').replace(/^\s*[-*]\s+/gm,'').replace(/^\s*\d+[.)]\s+/gm,'')
    .replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*\n]+)\*/g,'$1').replace(/__([^_\n]+)__/g,'$1')
    .replace(/\n+/g,' ').trim();
}

/* Sayisal ilerleme (metric) — yon farkindali. */
function metricPct(g){
  var m=readMetric(g);if(!m.structured||m.target===m.start)return null;
  var pct;
  if(m.direction==='down')pct=(m.start-m.current)/(m.start-m.target)*100;
  else pct=(m.current-m.start)/(m.target-m.start)*100;
  return Math.max(0,Math.min(100,Math.round(pct)));
}
/* Birlesik ilerleme: metric varsa metric%, yoksa adim%. Adim sistemi KORUNUR. */
function goalProgress(g){
  var mp=metricPct(g);
  if(mp!==null)return mp;
  return goalPct(g);
}
function goalPct(g){if(!g.steps||!g.steps.length)return 0;return Math.round(g.steps.filter(function(s){return s.done;}).length/g.steps.length*100);}
function pct(cur,tgt){return Math.min(100,Math.round((parseFloat(cur)||0)/(parseFloat(tgt)||1)*100));}
function progBar(p,color){
  var c=color||(p>=100?'var(--green)':p>=60?'var(--blue)':p>=30?'var(--orange)':'var(--red)');
  return '<div class="bar"><div class="barf" style="width:'+Math.min(100,p)+'%;background:'+c+'"></div></div>';
}
function statCard(label,val,icon,color){
  return '<div class="card" style="padding:14px 16px">'+
    '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">'+ic(icon,14,color)+
    '<span style="font-size:11px;color:var(--t2);font-weight:600">'+label+'</span></div>'+
    '<div class="kn" style="color:'+color+'">'+val+'</div></div>';
}
function calcStreak(checkins){
  if(!checkins||!checkins.length)return 0;
  var streak=0,d=new Date();
  for(var i=0;i<90;i++){
    var ds=d.toISOString().split('T')[0];
    if(checkins.indexOf(ds)>=0){streak++;d.setDate(d.getDate()-1);}
    else if(i===0){d.setDate(d.getDate()-1);}
    else break;
  }
  return streak;
}


