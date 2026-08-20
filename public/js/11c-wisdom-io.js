/* ══════════════════════════════════════════════════════════════════════════
   D10.3 — ÖZLÜ SÖZLER İÇE/DIŞA AKTARMA (JSON + CSV)
   Additive. D.wisdomQuotes üzerine çalışır; D.quotes/wisdomSettings/D6/D9 dokunulmaz.
   Dışa aktarma = 0 bulut write. İçe aktarma = snap() + tek save() (atomik).
   "Excel" = UTF-8 BOM'lu CSV (Excel native açar); harici kütüphane YOK.
   ══════════════════════════════════════════════════════════════════════════ */

/* Dışa aktarımda yer alan temiz kullanıcı alanları (id/tarih/gösterim-takibi hariç). */
var WQ_CSV_FIELDS=['quote','author','category','tags','language','priority','favorite','pinned','source','notes'];

/* ═══ Step 5E: İçe aktarma metin-kalitesi denetimi (SAF; metni ASLA yeniden yazmaz) ═══
   Yalnız işaret eder; kelime tahmin etmez, otomatik düzeltmez. Dil-duyarlı: yalnız Türkçe
   (veya dil belirtilmemiş) kayıtlarda ASCII-Türkçe kaybı uyarısı üretir; geçerli İngilizce/başka
   dil, Türkçe karakter içermediği için ASLA engellenmez. */
var WQ_REPL_RE=/\uFFFD/;                                  // Unicode replacement char (U+FFFD)
var WQ_CTRL_RE=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/; // yasak C0/C1 kontrol (TAB/LF/CR haric)
var WQ_CYRILLIC_RE=/[\u0400-\u04FF]/;
var WQ_ARABIC_RE=/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
var WQ_LATIN_RE=/[A-Za-z\u00C7\u011E\u0130\u00D6\u015E\u00DC\u00E7\u011F\u0131\u00F6\u015F\u00FC]/;
var WQ_TR_DIACRITIC=/[\u00E7\u011F\u0131\u0130\u00F6\u015F\u00FC\u00C7\u011E\u00D6\u015E\u00DC]/;
/* Muhafazakâr ASCII-Türkçe kaybı sinyali (5C denetimindeki aile ile aynı mantık):
   Türkçe-biçimli ASCII ekler/sözcükler + metinde HİÇ Türkçe diacritic yok. İngilizce tetiklemez. */
function _wqLooksTrAsciiLoss(q){
  if(WQ_TR_DIACRITIC.test(q))return false;                     // zaten diacritic var → kayıp değil
  var lw=String(q).toLocaleLowerCase('tr');
  if(/(digin|diklar|larin|ligin|caktir|maktir|istir|iniz|oldugu|yasan|baslang|bitis|gerekt|dongu|olcum)/.test(lw))return true;
  // diacriticsiz yazılmış yaygın Türkçe sözcükler (normalde ç/ş/ö/ü/ğ/ı taşır)
  return /\b(icin|cok|guzel|calis|basari|ozgur|dusun|degil|gunes|mutluluk|calisma|ogren|dogru|yuksek)\b/.test(lw);
}
/* text-quality bulguları → [{code,severity}]; severity 'error' engelleyici, 'warning' bilgilendirici. */
function wqTextQuality(text,language){
  var q=String(text==null?'':text), out=[];
  if(WQ_REPL_RE.test(q))out.push({code:'UNICODE_REPLACEMENT_CHAR',severity:'error'});
  if(WQ_CTRL_RE.test(q))out.push({code:'CONTROL_CHARACTER',severity:'error'});
  var hasLatin=WQ_LATIN_RE.test(q),hasCyr=WQ_CYRILLIC_RE.test(q),hasAr=WQ_ARABIC_RE.test(q);
  if(hasLatin&&(hasCyr||hasAr))out.push({code:'MIXED_ALPHABET',severity:'warning'});
  var lang=String(language||'').toLowerCase();
  var trContext=(lang===''||lang==='tr');                      // dil yoksa tr varsay (kütüphane Türkçe)
  if(trContext&&!hasCyr&&!hasAr&&_wqLooksTrAsciiLoss(q))out.push({code:'POSSIBLE_TR_DIACRITIC_LOSS',severity:'warning'});
  if(/\S[ \t]{2,}\S/.test(q))out.push({code:'INTERNAL_WHITESPACE',severity:'warning'});
  if(q!==q.replace(/^\s+|\s+$/g,''))out.push({code:'EDGE_WHITESPACE',severity:'warning'});
  return out;
}
var WQ_TEXT_QUALITY_CODES={POSSIBLE_TR_DIACRITIC_LOSS:1,MIXED_ALPHABET:1,UNICODE_REPLACEMENT_CHAR:1,CONTROL_CHARACTER:1,INTERNAL_WHITESPACE:1,EDGE_WHITESPACE:1};

/* Küçük non-blocking bildirim (app'te toast yoktu; alert bloklar/otomasyonu keser). Self-contained. */
function wqToast(msg,isErr){
  try{
    var t=document.createElement('div');
    t.setAttribute('role','status');t.textContent=String(msg);
    t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:200;'+
      'padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;max-width:88vw;'+
      'box-shadow:0 4px 16px rgba(0,0,0,.18);color:#fff;background:'+(isErr?'#c0392b':'#2c3e50')+';opacity:0;transition:opacity .2s';
    document.body.appendChild(t);
    requestAnimationFrame(function(){t.style.opacity='1';});
    setTimeout(function(){t.style.opacity='0';setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},250);},2600);
  }catch(e){}
}

/* ── CSV serileştirme (RFC4180) ── */
/* Formül enjeksiyonu koruması (OWASP): ilk gerçek karakter =,+,-,@ ya da ham ilk karakter
   TAB/CR ise başına tek apostrof ekle. Baştaki normal boşluklar korunur (kaybolmaz). */
function wqCsvGuardFormula(s){
  if(s.length===0)return s;
  var firstRaw=s.charAt(0);
  if(firstRaw==='\t'||firstRaw==='\r')return "'"+s;      // ham TAB/CR başlangıcı
  var t=s.replace(/^ +/,'');                             // yalnız normal boşlukları atla
  var c=t.charAt(0);
  if(c==='='||c==='+'||c==='-'||c==='@')return "'"+s;
  return s;
}
function wqCsvEscape(v){
  var s=wqCsvGuardFormula((v==null)?'':String(v));       // önce formül koruması
  if(/[",\n\r]/.test(s))return '"'+s.replace(/"/g,'""')+'"';  // sonra standart quoting
  return s;
}
/* Import de-guard: kendi export'umuzdaki güvenlik apostrofunu geri al.
   Yalnız apostroftan sonraki ilk gerçek karakter formül karakteriyse (=,+,-,@,TAB,CR) tek apostrof kaldırılır;
   normal metindeki meşru apostrof (örn. 'Efesli') KORUNUR. Belirsiz durumda koruma tercih edilir. */
function wqCsvDeguard(s){
  s=String(s==null?'':s);
  if(s.charAt(0)!=="'")return s;
  var rest=s.slice(1);
  var firstRaw=rest.charAt(0);
  if(firstRaw==='\t'||firstRaw==='\r')return rest;
  var t=rest.replace(/^ +/,'');
  var c=t.charAt(0);
  if(c==='='||c==='+'||c==='-'||c==='@')return rest;
  return s;
}
/* rows: düz nesne dizisi → CSV metni (başlık + satırlar). BOM eklenmez (indirmede eklenir). */
function wqCsvSerialize(rows){
  var out=[WQ_CSV_FIELDS.join(',')];
  (rows||[]).forEach(function(r){
    out.push(WQ_CSV_FIELDS.map(function(f){return wqCsvEscape(r[f]);}).join(','));
  });
  return out.join('\r\n');
}
/* CSV metni → satır nesneleri. RFC4180 durum makinesi (tırnaklı alan, gömülü virgül/newline/çift-tırnak). */
function wqCsvParse(text){
  var s=String(text||'');
  if(s.charCodeAt(0)===0xFEFF)s=s.slice(1);            // BOM at
  var rows=[],row=[],field='',i=0,inQ=false,n=s.length;
  function endField(){row.push(field);field='';}
  function endRow(){endField();rows.push(row);row=[];}
  while(i<n){
    var c=s[i];
    if(inQ){
      if(c==='"'){ if(s[i+1]==='"'){field+='"';i+=2;continue;} inQ=false;i++;continue; }
      field+=c;i++;continue;
    }
    if(c==='"'){inQ=true;i++;continue;}
    if(c===','){endField();i++;continue;}
    if(c==='\r'){ if(s[i+1]==='\n')i++; endRow();i++;continue; }
    if(c==='\n'){endRow();i++;continue;}
    field+=c;i++;
  }
  // son alan/satır (dosya newline ile bitmeyebilir)
  if(field!==''||row.length){endRow();}
  // boş kuyruk satırlarını at
  rows=rows.filter(function(r){return !(r.length===1&&r[0]==='');});
  if(!rows.length)return [];
  var header=rows[0].map(function(h){return String(h||'').trim().toLowerCase();});
  return rows.slice(1).map(function(r){
    var o={};header.forEach(function(h,idx){o[h]=r[idx]!=null?r[idx]:'';});return o;
  });
}

/* Boolean CSV çözümleme: evet/true/1/x/yes → true. */
function wqParseBool(v){ return /^(evet|true|1|x|yes|✓)$/i.test(String(v==null?'':v).trim()); }
function wqBoolOut(b){ return b?'evet':'hayır'; }
/* tags: '; ' ile ayır (CSV virgül delimiter olduğu için tag ayırıcı ';'). */
function wqTagsOut(tags){ return (Array.isArray(tags)?tags:[]).join('; '); }
function wqTagsIn(v){ return String(v==null?'':v).split(/[;,]/).map(function(t){return t.trim();}).filter(Boolean); }  // ; veya , ile böl, kırp, boşları at

/* Bir wisdomQuote → temiz CSV satır nesnesi (kullanıcı alanları). */
function wqToCsvRow(q){
  return {quote:q.quote,author:q.author,category:q.category,tags:wqTagsOut(q.tags),
    language:q.language,priority:q.priority,favorite:wqBoolOut(q.favorite),
    pinned:wqBoolOut(q.pinned),source:q.source,notes:q.notes};
}
/* CSV satır nesnesi → ham quote girdisi (normalizeWisdomQuote sonra temizler/kliper).
   Metin alanlarında de-guard: export güvenlik apostrofu geri alınır (round-trip temiz). */
function wqFromCsvRow(o){
  var g=function(k){return wqCsvDeguard(o[k]!=null?o[k]:'');};
  return {quote:g('quote'),author:g('author'),category:g('category'),tags:wqTagsIn(g('tags')),
    language:g('language')||'tr',priority:Number(wqCsvDeguard(o.priority))||0,
    favorite:wqParseBool(g('favorite')),pinned:wqParseBool(g('pinned')),
    source:g('source'),notes:g('notes')};
}

/* ── Dosya indirme (JSON app'te U.dl var; CSV için BOM'lu text/csv) ── */
function wqDownloadText(text,filename,mime){
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type:mime}));
  a.download=filename;document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(a.href);},100);
}
function wqDateStamp(){ var d=new Date();var p=function(x){return ('0'+x).slice(-2);};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }

/* ── DIŞA AKTARMA (0 bulut write) ── */
/* Step 5E: metin üreticileri test edilebilir olsun diye ayrıştırıldı.
   JSON = kayıpsız (tüm alanlar). CSV = yalnız kullanıcı alanları + BOM (7 teknik alan bilinçli düşer). */
function wqBuildJsonText(list){ return JSON.stringify(list,null,2); }
function wqBuildCsvText(list){ return '﻿'+wqCsvSerialize((list||[]).map(wqToCsvRow)); }  // BOM → Excel Türkçe
/* CSV teknik alanları KORUMAZ (id/tarih/tracking düşer); tam round-trip yedek için JSON önerilir. */
function wqCsvRoundTripNotice(){
  return 'CSV içerik düzenleme ve aktarım içindir; ID, tarih, gösterim geçmişi, aktiflik ve düşündürüldü '+
         'gibi teknik alanları KORUMAZ. Kayıpsız yedek veya tam round-trip için JSON kullanın.';
}
function wqExportJSON(){
  var list=wqList();
  if(!list.length){ wqToast('Dışa aktarılacak söz yok',true); return; }
  wqDownloadText(wqBuildJsonText(list),'ozlu-sozler-'+wqDateStamp()+'.json','application/json');
  wqToast(list.length+' söz JSON olarak indirildi (kayıpsız tam yedek)');
}
function wqExportCSV(){
  var list=wqList();
  if(!list.length){ wqToast('Dışa aktarılacak söz yok',true); return; }
  wqDownloadText(wqBuildCsvText(list),'ozlu-sozler-'+wqDateStamp()+'.csv','text/csv;charset=utf-8');
  wqToast(list.length+' söz CSV olarak indirildi — CSV teknik alanları korumaz, tam yedek için JSON kullanın',true);
}

/* ── İÇE AKTARMA ── */
var WQ_IMPORT={items:null,stats:null,_applying:null};   // önizleme durumu (geçici); _applying: tek-uçuş guard (runtime)

/* Yapılandırılmış hata mesajları (Türkçe). code stabil/makine-okunur. */
var WQ_ERR_MSG={
  REQUIRED_QUOTE:'Söz metni gerekli (alan yok).', EMPTY_QUOTE:'Söz metni boş.',
  PUNCTUATION_ONLY:'Söz anlamlı ifade içermiyor (yalnız noktalama).', NUMBER_ONLY:'Söz yalnız rakamlardan oluşuyor.',
  QUOTE_TOO_LONG:'Söz çok uzun, kırpıldı.', AUTHOR_TOO_LONG:'Yazar adı çok uzun, kırpıldı.',
  CATEGORY_TOO_LONG:'Kategori çok uzun, kırpıldı.', TOO_MANY_TAGS:'Çok fazla etiket, fazlası atıldı.',
  TAG_TOO_LONG:'Etiket çok uzun, kırpıldı.', SOURCE_TOO_LONG:'Kaynak çok uzun, kırpıldı.',
  NOTES_TOO_LONG:'Not çok uzun, kırpıldı.', INVALID_LANGUAGE:'Geçersiz dil, "tr" varsayıldı.',
  INVALID_BOOLEAN:'Geçersiz evet/hayır değeri, "hayır" varsayıldı.', INVALID_PRIORITY:'Geçersiz öncelik, 0 varsayıldı.',
  INVALID_DATE:'Geçersiz tarih, temizlendi.', DUPLICATE_CONTENT:'Aynı söz+yazar zaten mevcut.',
  DUPLICATE_ID:'Aynı ID mevcut, yeni ID atanacak.', DUPLICATE_IN_FILE:'Dosya içinde tekrarlanan söz.',
  ATTRIBUTION_CONFLICT:'Aynı söz metni farklı yazarla mevcut — olası atıf çakışması (gözden geçirin).',
  INVALID_JSON:'Geçersiz JSON.', INVALID_CSV:'Geçersiz CSV.', MISSING_HEADER:'Başlık satırı eksik.',
  // Step 5E metin-kalitesi kodları (engelleyici = error, gözden geçirilebilir = warning)
  UNICODE_REPLACEMENT_CHAR:'Bozuk Unicode (replacement karakteri) içeriyor.',
  CONTROL_CHARACTER:'Geçersiz kontrol karakteri içeriyor.',
  MIXED_ALPHABET:'Karışık alfabe (Latin + Kiril/Arap) — kurtarılabilir olabilir, gözden geçirin.',
  POSSIBLE_TR_DIACRITIC_LOSS:'Türkçe karakter kaybı olası (ör. ç/ğ/ı/ö/ş/ü düşmüş) — gözden geçirin.',
  INTERNAL_WHITESPACE:'Metin içinde tekrarlanan boşluk.', EDGE_WHITESPACE:'Başta/sonda boşluk.'
};
function _wqPreview(v){ var s=String(v==null?'':v).replace(/\s+/g,' ').trim(); return s.length>40?s.slice(0,40)+'…':s; }
function _wqErr(rn,field,code,sev,raw){ return {rowNumber:rn,field:field,code:code,message:WQ_ERR_MSG[code]||code,severity:sev,rawValuePreview:_wqPreview(raw)}; }

/* Tek satır doğrulama → {quote(normalized|null), errors[], warnings[]}. Hassas veri/stack YOK. */
function wqValidateImportRow(raw,rowNumber){
  var errors=[],warnings=[];
  if(!raw||typeof raw!=='object'){ errors.push(_wqErr(rowNumber,'-','EMPTY_QUOTE','error','')); return {quote:null,errors:errors,warnings:warnings}; }
  var qStr=String(raw.quote==null?'':raw.quote);
  if(!qStr.trim()){ errors.push(_wqErr(rowNumber,'quote',raw.quote==null?'REQUIRED_QUOTE':'EMPTY_QUOTE','error',raw.quote)); return {quote:null,errors:errors,warnings:warnings}; }
  if(!/[\p{L}]/u.test(qStr)){ errors.push(_wqErr(rowNumber,'quote',/\d/.test(qStr)&&!/[^\d\s.,]/.test(qStr)?'NUMBER_ONLY':'PUNCTUATION_ONLY','error',qStr)); return {quote:null,errors:errors,warnings:warnings}; }
  // Step 5E: metin-kalitesi denetimi (dil-duyarlı). Engelleyici bulgular satırı atlar; uyarılar apply'ı engellemez.
  var quality=wqTextQuality(qStr,raw.language);
  var qBlock=quality.filter(function(x){return x.severity==='error';});
  quality.filter(function(x){return x.severity==='warning';}).forEach(function(w){warnings.push(_wqErr(rowNumber,'quote',w.code,'warning',qStr));});
  if(qBlock.length){ qBlock.forEach(function(e){errors.push(_wqErr(rowNumber,'quote',e.code,'error',qStr));}); return {quote:null,errors:errors,warnings:warnings}; }
  // uzunluk → warning (normalize klipler, satır apply edilir, veri kaybı yaratmaz)
  if(qStr.length>WQ_LIMITS.quote)warnings.push(_wqErr(rowNumber,'quote','QUOTE_TOO_LONG','warning',qStr));
  if(String(raw.author||'').length>WQ_LIMITS.author)warnings.push(_wqErr(rowNumber,'author','AUTHOR_TOO_LONG','warning',raw.author));
  if(String(raw.category||'').length>WQ_LIMITS.category)warnings.push(_wqErr(rowNumber,'category','CATEGORY_TOO_LONG','warning',raw.category));
  if(String(raw.source||'').length>WQ_LIMITS.source)warnings.push(_wqErr(rowNumber,'source','SOURCE_TOO_LONG','warning',raw.source));
  if(String(raw.notes||'').length>WQ_LIMITS.notes)warnings.push(_wqErr(rowNumber,'notes','NOTES_TOO_LONG','warning',raw.notes));
  var tags=Array.isArray(raw.tags)?raw.tags:(raw.tags!=null&&raw.tags!==''?String(raw.tags).split(/[;,]/):[]);
  if(tags.length>WQ_LIMITS.tags)warnings.push(_wqErr(rowNumber,'tags','TOO_MANY_TAGS','warning',tags.join('; ')));
  if(tags.some(function(t){return String(t).trim().length>WQ_LIMITS.tag;}))warnings.push(_wqErr(rowNumber,'tags','TAG_TOO_LONG','warning',tags.join('; ')));
  if(raw.language!=null&&String(raw.language).length>8)warnings.push(_wqErr(rowNumber,'language','INVALID_LANGUAGE','warning',raw.language));
  if(raw.priority!=null&&String(raw.priority).trim()!==''&&isNaN(Number(raw.priority)))warnings.push(_wqErr(rowNumber,'priority','INVALID_PRIORITY','warning',raw.priority));
  ['favorite','pinned'].forEach(function(bf){ var v=raw[bf]; if(v!=null&&typeof v!=='boolean'&&String(v).trim()!==''&&!/^(evet|hayır|hayir|true|false|1|0|x|yes|no|✓)$/i.test(String(v).trim()))warnings.push(_wqErr(rowNumber,bf,'INVALID_BOOLEAN','warning',v)); });
  ['createdAt','updatedAt','lastShownAt'].forEach(function(df){ var v=raw[df]; if(v!=null&&String(v).trim()!==''&&isNaN(new Date(v).getTime()))warnings.push(_wqErr(rowNumber,df,'INVALID_DATE','warning',v)); });
  return {quote:normalizeWisdomQuote(raw,rowNumber),errors:errors,warnings:warnings};
}

/* Phase 3: aynı söz METNİ mevcut ama YAZAR farklı → mevcut yazarı döndür (atıf çakışması);
   yoksa null. wqIsDuplicate (quote+author) eşleşmesi olanlar zaten DUPLICATE_CONTENT sayılır. */
function _wqAttributionConflict(quote,author){
  var nq=_wqNorm(quote), na=_wqNorm(author);
  var m=(typeof wqList==='function'?wqList():[]).filter(function(x){ return _wqNorm(x.quote)===nq && _wqNorm(x.author)!==na; })[0];
  return m?String(m.author||''):null;
}
/* Ham girdi listesi → yapılandırılmış önizleme (rowNumber'lı hata/uyarı + dedup). fmt: 'csv'|'json'. */
function wqImportAnalyze(rawList,fmt){
  var base=(fmt==='csv')?2:1;                            // CSV: başlık=1, ilk veri=2. JSON: 1-tabanlı.
  var seen={},items=[],errors=[],warnings=[];
  var newCount=0,dupExisting=0,dupInFile=0,invalidCount=0;
  (Array.isArray(rawList)?rawList:[]).forEach(function(raw,i){
    var rn=i+base;
    var res=wqValidateImportRow(raw,rn);
    res.warnings.forEach(function(w){warnings.push(w);});
    if(res.errors.length){ res.errors.forEach(function(e){errors.push(e);}); invalidCount++; return; }
    var q=res.quote;
    var key=_wqNorm(q.quote)+'||'+_wqNorm(q.author);
    if(seen[key]){ dupInFile++; warnings.push(_wqErr(rn,'quote','DUPLICATE_IN_FILE','warning',q.quote)); return; }  // dosya içi tekrar → apply edilmez
    seen[key]=1;
    var isExisting=wqIsDuplicate(q.quote,q.author,null);
    if(isExisting){ dupExisting++; warnings.push(_wqErr(rn,'quote','DUPLICATE_CONTENT','warning',q.quote)); }
    else {
      newCount++;
      // INSTRUCTION 8 Phase 3: aynı söz METNİ farklı yazarla mevcutsa → engellemeyen atıf-çakışması
      // uyarısı (mevcut + gelen yazar gösterilir). Sessiz birleştirme/üzerine-yazma YOK; import edilir.
      var _confAuthor=_wqAttributionConflict(q.quote,q.author);
      if(_confAuthor!=null){
        // _wqErr'in 40-char kırpması iki yazarı kesmesin → doğrudan kur (her yazar ≤40 char).
        warnings.push({rowNumber:rn,field:'author',code:'ATTRIBUTION_CONFLICT',message:WQ_ERR_MSG.ATTRIBUTION_CONFLICT,severity:'warning',
          rawValuePreview:'mevcut: '+String(_confAuthor||'(boş)').slice(0,40)+' · gelen: '+String(q.author||'(boş)').slice(0,40)});
      }
    }
    if(q.id&&typeof wqById==='function'&&wqById(q.id))warnings.push(_wqErr(rn,'id','DUPLICATE_ID','warning',q.id));
    items.push({q:q,dup:isExisting,rowNumber:rn});
  });
  var valid=items.length;
  // Step 5E: metin-kalitesi bulgularını (hem uyarı hem engelleyici) say → önizleme özeti için
  var trIssues=errors.concat(warnings).filter(function(x){return WQ_TEXT_QUALITY_CODES[x.code];}).length;
  return {total:(Array.isArray(rawList)?rawList.length:0),
    parsed:valid,valid:valid,newCount:newCount,dupExisting:dupExisting,dupInFile:dupInFile,
    invalid:invalidCount,invalidCount:invalidCount,warnCount:warnings.length,trIssues:trIssues,
    items:items,errors:errors,warnings:warnings};
}

/* Step 5E: yıkıcı `replace` importu için zorunlu kalıcı yedek. snap() oturum-içi geri-al oturumu
   reload'da kaybolur; bu yüzden mutasyondan ÖNCE 04-backup motoruyla doğrulanmış yedek şart. */
var WQ_REPLACE_BACKUP_LABEL='Wisdom Quotes replace import safety backup';
function _wqBackupVerified(bk){ return !!(bk&&bk.id&&!bk.skipped&&!bk.error); }

/* Fiili mutasyon: snap → (replace ise wipe) → yeni ID + push → tek save → temizlik. Yalnız
   güvenli bağlamda çağrılır (append doğrudan; replace ise yalnız yedek doğrulandıktan sonra). */
function _wqCommitImport(mode,st){
  if(typeof snap==='function')snap();                   // geri-al noktası
  var toAdd;
  if(mode==='replace'){ toAdd=st.items.map(function(x){return x.q;}); D.wisdomQuotes=[]; }
  else if(mode==='all'){ toAdd=st.items.map(function(x){return x.q;}); }
  else { toAdd=st.items.filter(function(x){return !x.dup;}).map(function(x){return x.q;}); } // skip
  // yeni ID ata (çakışma önle) + tarih koru; mevcut ID'lerle çakışırsa yenile
  var existing={}; wqList().forEach(function(q){existing[q.id]=1;});
  toAdd.forEach(function(q){
    // SG-SYNC-P0: id yoksa, çakışıyorsa VEYA index-tabanlı wq-legacy-* ise globalce benzersiz yeni id ver.
    // (Dış dosyalarda id yok → normalizeWisdomQuote wq-legacy-<satır> atar → iki bağlam aynı id üretir → çakışma.)
    if(!q.id||existing[q.id]||/^wq-legacy-/.test(String(q.id))){ q.id=newWqId(); }
    existing[q.id]=1;
    D.wisdomQuotes.push(q);
  });
  var revBefore=(typeof CLOUD!=='undefined')?Number(CLOUD.revision||0):0;
  if(typeof save==='function')save();                   // tek atomik bulut yazımı
  var added=toAdd.length;
  WQ_IMPORT.items=null;WQ_IMPORT.stats=null;
  if(typeof closeModal==='function')closeModal();
  var suffix=(mode==='replace'?' (tümü değiştirildi)':(mode==='skip'&&st.dupExisting?' ('+st.dupExisting+' yinelenen atlandı)':''));
  // SG-SYNC-P0: başarı YALNIZ bulut ACK'inden sonra. ACK gelene kadar "senkronize ediliyor".
  _wqImportAwaitAck(revBefore, added+' söz içe aktarıldı'+suffix);
  if(typeof render==='function')render();
  return added;
}
/* Import senkron sonucu: synced (pending temiz + revision ilerledi) | pending (bekliyor) | conflict. Saf. */
function _wqImportSyncOutcome(revBefore){
  if(typeof CLOUD==='undefined')return 'synced';
  if(CLOUD.conflict)return 'conflict';
  if(CLOUD.pendingMutation)return 'pending';
  return 'synced';   // pending yok + çakışma yok → yazma tamam (revision ilerledi ya da yazılacak bir şey yoktu)
}
/* ACK bekleyerek toast: önce "senkronize ediliyor", ACK'te başarı, çakışmada uyarı, zaman aşımında yerel-uyarı. */
function _wqImportAwaitAck(revBefore, successMsg){
  wqToast('Buluta senkronize ediliyor…');
  if(typeof CLOUD==='undefined'){wqToast(successMsg);return;}
  var tries=0, max=34;                                   // ~10sn (300ms×34)
  var iv=setInterval(function(){
    tries++;
    var out=_wqImportSyncOutcome(revBefore);
    if(out==='conflict'){clearInterval(iv);wqToast('İçe aktarıldı ama buluttaki değişiklikle çakıştı — çözüm bekleniyor',true);return;}
    if(out==='synced'&&Number(CLOUD.revision||0)>revBefore){clearInterval(iv);wqToast(successMsg+' — buluta kaydedildi');return;}
    if(tries>=max){clearInterval(iv);wqToast('Yerel kaydedildi; buluta senkronizasyon bekleniyor (bağlantıyı kontrol edin)',true);}
  },300);
}
window._wqImportSyncOutcome=_wqImportSyncOutcome;

/* replace: mutasyondan önce zorunlu `before_import` (force) yedek al + doğrula; başarısızsa
   SIFIR mutasyon, SIFIR snap, SIFIR save ile iptal et. Başarılıysa tek save döngüsü. */
async function _wqReplaceWithBackup(st){
  var bk;
  try{ bk=await createBackup('before_import',{force:true,label:WQ_REPLACE_BACKUP_LABEL}); }
  catch(e){ wqToast('Yedek alınamadı — içe aktarma iptal edildi (veri değişmedi)',true); return {aborted:true,reason:'backup_error'}; }
  if(!_wqBackupVerified(bk)){ wqToast('Yedek doğrulanamadı — içe aktarma iptal edildi (veri değişmedi)',true); return {aborted:true,reason:'backup_unverified'}; }
  var added=_wqCommitImport('replace',st);
  return {aborted:false,backupId:bk.id,added:added};
}

/* ══ SG-IMPORT-SHARD-P0: SHARDED-AWARE İÇE AKTARMA YAZMA YOLU ══
   Kök neden: okuma yolu sharded (wqList→WQ_STORE) ama _wqCommitImport yalnız legacy
   D.wisdomQuotes'a yazıyordu → sharded modda içe aktarılan sözler GÖRÜNMÜYOR (sessiz
   kısmi import). Sharded modda: koleksiyona wisdomStoreBatchWrite ile yaz (WQ_STORE
   cache güncellenir) → legacy mirror → save → meta-count senkronu → görünürlük doğrula.
   Yalnız sharded yazımı BAŞARILI olursa yan etki oluşur (batch fail → 0 mutasyon). ══ */
function _wqCommitImportSharded(mode,st){
  var toAdd=(mode==='all')?st.items.map(function(x){return x.q;}):st.items.filter(function(x){return !x.dup;}).map(function(x){return x.q;});
  // ID çakışma önleme: hem sharded görünüm hem legacy dizi id'lerine karşı (çift kaynak).
  var existing={}; wqList().forEach(function(q){existing[q.id]=1;}); (Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]).forEach(function(q){existing[q.id]=1;});
  toAdd.forEach(function(q){ if(!q.id||existing[q.id]||/^wq-legacy-/.test(String(q.id))){ q.id=newWqId(); } existing[q.id]=1; });
  var skipped=(mode==='skip')?(st.dupExisting||0):0;
  if(!toAdd.length){ WQ_IMPORT.items=null;WQ_IMPORT.stats=null; if(typeof closeModal==='function')closeModal();
    wqToast('Eklenecek yeni söz yok'+(skipped?' ('+skipped+' yinelenen atlandı)':''));
    return Promise.resolve({ok:true,stage:'done',added:0,skipped:skipped,target:'sharded',visible:wqList().length,metaSync:'skipped'}); }
  // 1) SHARDED batch yazımı (koleksiyon + WQ_STORE cache). Başarısızsa SIFIR yan etki.
  return Promise.resolve().then(function(){ return wisdomStoreBatchWrite(toAdd); })
    .then(function(res){ return res; }, function(e){ return {ok:false,error:String((e&&e.message)||e)}; })
    .then(function(res){
      if(!res||!res.ok){
        wqToast('İçe aktarma başarısız — bulut arşivine yazılamadı (batch: '+((res&&res.error)||'bilinmeyen')+'). Hiçbir kayıt eklenmedi; tekrar deneyebilirsiniz.',true);
        return {ok:false,stage:'batch_write',added:0,target:'sharded'};   // legacy/cache DOKUNULMADI
      }
      // 2) legacy mirror (yedek uyumluluğu) — YALNIZ sharded yazımı başarılıysa.
      // INSTRUCTION 7: legacy'ye karşı DEDUP (id VE quote+author). Eski bug'dan kalan
      // yetim (orphan) kayıtlar legacy'de mevcutsa, mirror aynı içeriği İKİNCİ kez EKLEMEZ
      // → görünmez legacy içerik-duplikasyonu önlenir. Sharded store yazımı etkilenmez.
      if(!Array.isArray(D.wisdomQuotes))D.wisdomQuotes=[];
      var _legId={}, _legCk={};
      D.wisdomQuotes.forEach(function(x){ _legId[String(x.id)]=1; _legCk[_wqNorm(x.quote)+'||'+_wqNorm(x.author)]=1; });
      toAdd.forEach(function(q){
        var ck=_wqNorm(q.quote)+'||'+_wqNorm(q.author);
        if(_legId[String(q.id)]||_legCk[ck])return;   // legacy'de id veya içerik zaten var → mirror atla
        _legId[String(q.id)]=1; _legCk[ck]=1; D.wisdomQuotes.push(q);
      });
      // 3) save (legacy + state) — sharded yazımından SONRA
      if(typeof save==='function')save();
      // 4) meta-count senkronu (await + durum raporu)
      return Promise.resolve().then(function(){ return (typeof wisdomImportSyncMeta==='function')?wisdomImportSyncMeta():'skipped'; },function(){return 'failed';})
        .then(function(metaSync){
          // 5) yazma-sonrası GÖRÜNÜRLÜK doğrulaması (başarı YALNIZ görünürlük teyidinden sonra)
          var allVisible=toAdd.every(function(q){ return typeof wqById==='function'&&!!wqById(q.id); });
          var visible=wqList().length;
          if(!allVisible){ wqToast('İçe aktarma tamamlandı ama bazı kayıtlar henüz görünmüyor — lütfen sayfayı yenileyin.',true);
            return {ok:false,stage:'visibility',added:toAdd.length,target:'sharded',metaSync:metaSync,visible:visible}; }
          WQ_IMPORT.items=null;WQ_IMPORT.stats=null; if(typeof closeModal==='function')closeModal();
          wqToast(toAdd.length+' söz içe aktarıldı → Bulut Arşivi'+(skipped?' ('+skipped+' yinelenen atlandı)':'')+' · görünür: '+visible+(metaSync==='failed'?' · uyarı: meta sayaç senkronu başarısız (arka planda düzeltilir)':''));
          if(typeof render==='function')render();
          return {ok:true,stage:'done',added:toAdd.length,skipped:skipped,target:'sharded',visible:visible,metaSync:metaSync};
        });
    });
}
/* Sharded modda replace: bu fazda otomatik bulut silme YOK. Yazma öncesi BLOKE + açık mesaj.
   Asla sessizce legacy diziye düşmez (mevcut sessiz-kısmi-import buggının önlenmesi). */
function _wqBlockShardedReplace(){
  wqToast('Bulut arşivinde "Tümünü değiştir" bu sürümde desteklenmiyor — tüm bulut arşivini değiştirmek ayrı, korumalı bir geçiş (migrasyon) akışı gerektirir. Lütfen "Yinelenenleri atla" veya "Hepsini ekle" kullanın.',true);
  return Promise.resolve({aborted:true,reason:'sharded_replace_blocked'});
}
/* Uygula: mode = 'skip' (yinelenenleri atla) | 'all' (hepsini ekle) | 'replace' (tümünü değiştir).
   Sharded modda append → koleksiyona yazar (görünür); replace → bloke. Non-sharded değişmedi.
   Tek-uçuş: aynı anda ikinci submit (WQ_IMPORT._applying) yeni yazma başlatmaz (çift-yazım önlenir). */
function wqImportApply(mode){
  var st=WQ_IMPORT.stats; if(!st||!st.items){ wqToast('Önce dosya seçin',true); return; }
  if(typeof personalCan==='function'&&!personalCan('wisdom','import')){ wqToast('Bu hesabın içe aktarma yetkisi yok',true); return; } // PIL module-scoped (flag OFF/owner → allowed)
  if(WQ_IMPORT._applying)return WQ_IMPORT._applying;   // tek-uçuş: bekleyen bir uygulama var
  var sharded=(typeof wisdomStoreIsSharded==='function'&&wisdomStoreIsSharded());
  if(mode==='replace'){
    if(sharded)return _wqBlockShardedReplace();          // 0 yazma
    return _wqReplaceWithBackup(st);                     // non-sharded: değişmedi
  }
  if(sharded){
    var p=_wqCommitImportSharded(mode,st).then(function(r){ WQ_IMPORT._applying=null; return r; },function(e){ WQ_IMPORT._applying=null; throw e; });
    WQ_IMPORT._applying=p; return p;
  }
  return _wqCommitImport(mode,st);                        // non-sharded: mevcut sync davranış (değişmedi)
}

/* Dosya metnini algıla + ayrıştır (JSON önce, değilse CSV). */
function wqParseImportText(text,filename){
  var t=String(text||'').replace(/^﻿/,'').trim();
  var isJson=/\.json$/i.test(filename||'')||(t[0]==='['||t[0]==='{');
  if(isJson){
    try{ var j=JSON.parse(t); var arr=Array.isArray(j)?j:(j&&Array.isArray(j.wisdomQuotes)?j.wisdomQuotes:[j]);
      return {ok:true,rows:arr,fmt:'json'}; }
    catch(e){ return {ok:false,err:'Geçersiz JSON: '+(e.message||''),fmt:'json'}; }
  }
  // CSV
  try{ var rows=wqCsvParse(text).map(wqFromCsvRow); return {ok:true,rows:rows,fmt:'csv'}; }
  catch(e){ return {ok:false,err:'Geçersiz CSV',fmt:'csv'}; }
}

/* Önizleme modalı: özet + satır bazlı hata/uyarı tablosu + birleştirme seçenekleri. */
function wqImportShowPreview(stats,fmt){
  WQ_IMPORT.stats=stats;
  var e=function(v){return U.esc(v);};
  var h='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h2 style="font-size:17px;font-weight:800">İçe Aktarma Önizleme</h2><button class="btn btn-g btn-ic" style="width:30px;height:30px" onclick="wqImportCancel()">'+ic('x',14)+'</button></div>';
  // SG-IMPORT-SHARD-P0 UX: hedef depo şeffaf gösterilir (kullanıcı yazımdan ÖNCE nereye
  // gideceğini görür; sharded modda replace'in neden kapalı olduğu açıklanır).
  var _shard=(typeof wisdomStoreIsSharded==='function'&&wisdomStoreIsSharded());
  var _tgtLabel=_shard?'Bulut Arşivi (sharded)':'Yerel Arşiv';
  h+='<p style="font-size:12px;color:var(--t3);margin-bottom:10px">Biçim: <b>'+e((fmt||'').toUpperCase())+'</b> · Hedef depo: <b style="color:'+(_shard?'var(--blue)':'var(--t2)')+'">'+e(_tgtLabel)+'</b></p>';
  // özet kartları
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
  [['Toplam',stats.total,'var(--t2)'],['Geçerli',stats.valid,'var(--blue)'],['Eklenecek',stats.newCount,'var(--green)'],['Atlanacak',stats.dupExisting+stats.dupInFile,'var(--orange)'],['Hatalı',stats.invalidCount,'var(--red)'],['Uyarılı',stats.warnCount,'var(--orange)'],['Metin sorunu',stats.trIssues||0,'var(--orange)']].forEach(function(x){
    h+='<div class="card" style="padding:7px 10px;flex:1;min-width:72px"><p style="font-size:9.5px;color:var(--t3)">'+x[0]+'</p><p style="font-size:17px;font-weight:800;color:'+x[2]+'">'+x[1]+'</p></div>';});
  h+='</div>';
  // Step 5E: kompakt kalite özeti + replace-yedek uyarısı
  h+='<div class="card" style="padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--t2);line-height:1.6">'+
     '<b>Kalite özeti:</b> '+stats.newCount+' yeni · '+(stats.dupExisting+stats.dupInFile)+' yinelenen · '+stats.invalidCount+' engelleyici hata · '+stats.warnCount+' uyarı · '+(stats.trIssues||0)+' olası Türkçe metin sorunu.<br>'+
     'Yıkıcı "Tümünü değiştir" (replace) modu için zorunlu kalıcı yedek: <b style="color:var(--red)">EVET</b> — yazma öncesi otomatik <code>before_import</code> yedeği alınır.</div>';
  // hata/uyarı tablosu
  var rows=(stats.errors||[]).concat(stats.warnings||[]).sort(function(a,b){return a.rowNumber-b.rowNumber;});
  if(rows.length){
    h+='<p style="font-size:12px;font-weight:700;margin-bottom:6px">Satır Bazlı Rapor ('+rows.length+')</p>';
    h+='<div style="max-height:220px;overflow:auto;border:1px solid var(--s2);border-radius:8px;margin-bottom:12px">';
    h+='<table style="width:100%;border-collapse:collapse;font-size:11px;min-width:460px"><thead><tr style="position:sticky;top:0;background:var(--s);text-align:left">'+
       '<th style="padding:5px 8px">Satır</th><th style="padding:5px 8px">Alan</th><th style="padding:5px 8px">Kod</th><th style="padding:5px 8px">Açıklama</th><th style="padding:5px 8px">Değer</th></tr></thead><tbody>';
    rows.forEach(function(r){
      var col=r.severity==='error'?'var(--red)':'var(--orange)';
      h+='<tr style="border-top:1px solid var(--s2)">'+
         '<td style="padding:5px 8px;white-space:nowrap">'+r.rowNumber+'</td>'+
         '<td style="padding:5px 8px">'+e(r.field)+'</td>'+
         '<td style="padding:5px 8px;font-weight:700;color:'+col+'">'+e(r.code)+'</td>'+
         '<td style="padding:5px 8px">'+e(r.message)+'</td>'+
         '<td style="padding:5px 8px;color:var(--t3)">'+e(r.rawValuePreview)+'</td></tr>';
    });
    h+='</tbody></table></div>';
    if(stats.invalidCount)h+='<p style="font-size:11px;color:var(--red);margin-bottom:10px">'+ic('ci',11,'var(--red)')+' Hatalı '+stats.invalidCount+' kayıt içe aktarılmayacak. Uyarılı kayıtlar (kırpma/varsayılan) içe aktarılır.</p>';
  }
  // birleştirme seçenekleri
  h+='<p style="font-size:12px;color:var(--t3);margin-bottom:8px">Birleştirme yöntemi:</p>';
  h+='<div style="display:flex;flex-direction:column;gap:8px">';
  h+='<button class="btn btn-p" onclick="wqImportApply(\'skip\')"'+(stats.newCount?'':' disabled')+'>Yinelenenleri atla, '+stats.newCount+' yeni söz ekle</button>';
  h+='<button class="btn btn-g" onclick="wqImportApply(\'all\')"'+(stats.valid?'':' disabled')+'>Hepsini ekle ('+stats.valid+' geçerli söz, kopyalar dahil)</button>';
  // SG-IMPORT-SHARD-P0: sharded modda "Tümünü değiştir" DEVRE DIŞI (bulut arşivi toplu silme ayrı korumalı faz).
  if(_shard){
    h+='<button class="btn btn-g" style="color:var(--t3)" disabled title="Bulut arşivinde desteklenmiyor">Tümünü değiştir — Bulut arşivinde kullanılamaz</button>';
    h+='<p style="font-size:10.5px;color:var(--orange);margin:0">'+ic('csq',11,'var(--orange)')+' Bulut arşivinde tüm sözleri değiştirmek ayrı, korumalı bir geçiş akışı gerektirir. Şimdilik "atla" veya "hepsini ekle" kullanın.</p>';
  } else {
    h+='<button class="btn btn-g" style="color:var(--red)" onclick="wqImportApply(\'replace\')"'+(stats.valid?'':' disabled')+'>Tümünü değiştir (mevcut '+wqList().length+' söz silinir)</button>';
  }
  h+='</div>';
  h+='<p style="font-size:11px;color:var(--t3);margin-top:10px">Yalnız geçerli kayıtlar uygulanır. Geri almak için üst menüden Geri Al kullanılabilir.</p>';
  if(typeof showModal==='function')showModal(h);
}
function wqImportCancel(){ WQ_IMPORT.items=null;WQ_IMPORT.stats=null; if(typeof closeModal==='function')closeModal(); }

/* Dosya seçimi (gizli input) → oku → ayrıştır → önizle. 0 bulut write. */
function wqImportOpen(){
  var inp=document.createElement('input');
  inp.type='file';inp.accept='.json,.csv,application/json,text/csv';
  inp.onchange=function(){
    var f=inp.files&&inp.files[0]; if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){
      var res=wqParseImportText(rd.result,f.name);
      if(!res.ok){ wqToast(res.err,true); return; }
      var stats=wqImportAnalyze(res.rows,res.fmt);
      if(!stats.valid&&!stats.invalidCount){ wqToast('Dosyada geçerli söz bulunamadı',true); return; }
      wqImportShowPreview(stats,res.fmt);  // geçerli 0 ama hata varsa da göster (kullanıcı nedeni görsün)
    };
    rd.onerror=function(){ wqToast('Dosya okunamadı',true); };
    rd.readAsText(f,'utf-8');
  };
  inp.click();
}

/* renderWisdomQuotes başlığına eklenen İçe/Dışa butonları (additive hook).
   Step 5E: CSV teknik alanları KORUMAZ notu (JSON tam yedek önerilir). */
function wisdomIoButtonsHtml(){
  return '<button class="btn btn-g" onclick="wqImportOpen()" title="JSON veya CSV içe aktar">'+ic('bk',13)+' İçe Aktar</button>'+
         '<button class="btn btn-g" onclick="wqExportJSON()" title="Tüm sözleri JSON indir (kayıpsız tam yedek)">'+ic('dl',13)+' JSON</button>'+
         '<button class="btn btn-g" onclick="wqExportCSV()" title="Sözleri CSV indir (Excel uyumlu; teknik alanları korumaz)">'+ic('dl',13)+' CSV</button>'+
         '<span style="font-size:10px;color:var(--t3);align-self:center;max-width:220px;line-height:1.35">'+U.esc(wqCsvRoundTripNotice())+'</span>';
}

/* global maruz bırak (klasik script; inline onclick handler'lar için) */
window.wqToast=wqToast;window.wqCsvEscape=wqCsvEscape;window.wqCsvSerialize=wqCsvSerialize;window.wqCsvParse=wqCsvParse;
window.wqParseBool=wqParseBool;window.wqBoolOut=wqBoolOut;window.wqTagsOut=wqTagsOut;window.wqTagsIn=wqTagsIn;
window.wqToCsvRow=wqToCsvRow;window.wqFromCsvRow=wqFromCsvRow;
window.wqExportJSON=wqExportJSON;window.wqExportCSV=wqExportCSV;
window.wqImportAnalyze=wqImportAnalyze;window.wqImportApply=wqImportApply;window.wqParseImportText=wqParseImportText;
window._wqCommitImportSharded=_wqCommitImportSharded;window._wqBlockShardedReplace=_wqBlockShardedReplace;
window.wqImportOpen=wqImportOpen;window.wqImportCancel=wqImportCancel;window.wisdomIoButtonsHtml=wisdomIoButtonsHtml;
window.wqCsvGuardFormula=wqCsvGuardFormula;window.wqCsvDeguard=wqCsvDeguard;window.wqValidateImportRow=wqValidateImportRow;
window.wqImportShowPreview=wqImportShowPreview;window.WQ_ERR_MSG=WQ_ERR_MSG;
/* Step 5E yeni yüzey */
window.wqTextQuality=wqTextQuality;window.wqCsvRoundTripNotice=wqCsvRoundTripNotice;
window.wqBuildJsonText=wqBuildJsonText;window.wqBuildCsvText=wqBuildCsvText;
