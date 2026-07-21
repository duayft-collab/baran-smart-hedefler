/* ══════════════════════════════════════════════════════════════════════════
   D10.3 — ÖZLÜ SÖZLER İÇE/DIŞA AKTARMA (JSON + CSV)
   Additive. D.wisdomQuotes üzerine çalışır; D.quotes/wisdomSettings/D6/D9 dokunulmaz.
   Dışa aktarma = 0 bulut write. İçe aktarma = snap() + tek save() (atomik).
   "Excel" = UTF-8 BOM'lu CSV (Excel native açar); harici kütüphane YOK.
   ══════════════════════════════════════════════════════════════════════════ */

/* Dışa aktarımda yer alan temiz kullanıcı alanları (id/tarih/gösterim-takibi hariç). */
var WQ_CSV_FIELDS=['quote','author','category','tags','language','priority','favorite','pinned','source','notes'];

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
function wqExportJSON(){
  var list=wqList();
  if(!list.length){ wqToast('Dışa aktarılacak söz yok',true); return; }
  wqDownloadText(JSON.stringify(list,null,2),'ozlu-sozler-'+wqDateStamp()+'.json','application/json');
  wqToast(list.length+' söz JSON olarak indirildi');
}
function wqExportCSV(){
  var list=wqList();
  if(!list.length){ wqToast('Dışa aktarılacak söz yok',true); return; }
  var csv='﻿'+wqCsvSerialize(list.map(wqToCsvRow));   // BOM → Excel Türkçe
  wqDownloadText(csv,'ozlu-sozler-'+wqDateStamp()+'.csv','text/csv;charset=utf-8');
  wqToast(list.length+' söz CSV olarak indirildi');
}

/* ── İÇE AKTARMA ── */
var WQ_IMPORT={items:null,stats:null};   // önizleme durumu (geçici)

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
  INVALID_JSON:'Geçersiz JSON.', INVALID_CSV:'Geçersiz CSV.', MISSING_HEADER:'Başlık satırı eksik.'
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
    else newCount++;
    if(q.id&&typeof wqById==='function'&&wqById(q.id))warnings.push(_wqErr(rn,'id','DUPLICATE_ID','warning',q.id));
    items.push({q:q,dup:isExisting,rowNumber:rn});
  });
  var valid=items.length;
  return {total:(Array.isArray(rawList)?rawList.length:0),
    parsed:valid,valid:valid,newCount:newCount,dupExisting:dupExisting,dupInFile:dupInFile,
    invalid:invalidCount,invalidCount:invalidCount,warnCount:warnings.length,
    items:items,errors:errors,warnings:warnings};
}

/* Uygula: mode = 'skip' (yinelenenleri atla) | 'all' (hepsini ekle) | 'replace' (tümünü değiştir). */
function wqImportApply(mode){
  var st=WQ_IMPORT.stats; if(!st||!st.items){ wqToast('Önce dosya seçin',true); return; }
  if(typeof snap==='function')snap();                   // geri-al noktası
  var toAdd;
  if(mode==='replace'){ toAdd=st.items.map(function(x){return x.q;}); D.wisdomQuotes=[]; }
  else if(mode==='all'){ toAdd=st.items.map(function(x){return x.q;}); }
  else { toAdd=st.items.filter(function(x){return !x.dup;}).map(function(x){return x.q;}); } // skip
  // yeni ID ata (çakışma önle) + tarih koru; mevcut ID'lerle çakışırsa yenile
  var existing={}; wqList().forEach(function(q){existing[q.id]=1;});
  toAdd.forEach(function(q){
    if(!q.id||existing[q.id]){ q.id=newWqId(); }
    existing[q.id]=1;
    D.wisdomQuotes.push(q);
  });
  if(typeof save==='function')save();                   // tek atomik bulut yazımı
  var added=toAdd.length;
  WQ_IMPORT.items=null;WQ_IMPORT.stats=null;
  if(typeof closeModal==='function')closeModal();
  wqToast(added+' söz içe aktarıldı'+(mode==='replace'?' (tümü değiştirildi)':(mode==='skip'&&st.dupExisting?' ('+st.dupExisting+' yinelenen atlandı)':'')));
  if(typeof render==='function')render();
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
  h+='<p style="font-size:12px;color:var(--t3);margin-bottom:10px">Biçim: <b>'+e((fmt||'').toUpperCase())+'</b></p>';
  // özet kartları
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
  [['Toplam',stats.total,'var(--t2)'],['Geçerli',stats.valid,'var(--blue)'],['Eklenecek',stats.newCount,'var(--green)'],['Atlanacak',stats.dupExisting+stats.dupInFile,'var(--orange)'],['Hatalı',stats.invalidCount,'var(--red)'],['Uyarılı',stats.warnCount,'var(--orange)']].forEach(function(x){
    h+='<div class="card" style="padding:7px 10px;flex:1;min-width:72px"><p style="font-size:9.5px;color:var(--t3)">'+x[0]+'</p><p style="font-size:17px;font-weight:800;color:'+x[2]+'">'+x[1]+'</p></div>';});
  h+='</div>';
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
  h+='<button class="btn btn-g" style="color:var(--red)" onclick="wqImportApply(\'replace\')"'+(stats.valid?'':' disabled')+'>Tümünü değiştir (mevcut '+wqList().length+' söz silinir)</button>';
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

/* renderWisdomQuotes başlığına eklenen İçe/Dışa butonları (additive hook). */
function wisdomIoButtonsHtml(){
  return '<button class="btn btn-g" onclick="wqImportOpen()" title="JSON veya CSV içe aktar">'+ic('bk',13)+' İçe Aktar</button>'+
         '<button class="btn btn-g" onclick="wqExportJSON()" title="Tüm sözleri JSON indir">'+ic('dl',13)+' JSON</button>'+
         '<button class="btn btn-g" onclick="wqExportCSV()" title="Sözleri CSV indir (Excel uyumlu)">'+ic('dl',13)+' CSV</button>';
}

/* global maruz bırak (klasik script; inline onclick handler'lar için) */
window.wqToast=wqToast;window.wqCsvEscape=wqCsvEscape;window.wqCsvSerialize=wqCsvSerialize;window.wqCsvParse=wqCsvParse;
window.wqParseBool=wqParseBool;window.wqBoolOut=wqBoolOut;window.wqTagsOut=wqTagsOut;window.wqTagsIn=wqTagsIn;
window.wqToCsvRow=wqToCsvRow;window.wqFromCsvRow=wqFromCsvRow;
window.wqExportJSON=wqExportJSON;window.wqExportCSV=wqExportCSV;
window.wqImportAnalyze=wqImportAnalyze;window.wqImportApply=wqImportApply;window.wqParseImportText=wqParseImportText;
window.wqImportOpen=wqImportOpen;window.wqImportCancel=wqImportCancel;window.wisdomIoButtonsHtml=wisdomIoButtonsHtml;
window.wqCsvGuardFormula=wqCsvGuardFormula;window.wqCsvDeguard=wqCsvDeguard;window.wqValidateImportRow=wqValidateImportRow;
window.wqImportShowPreview=wqImportShowPreview;window.WQ_ERR_MSG=WQ_ERR_MSG;
