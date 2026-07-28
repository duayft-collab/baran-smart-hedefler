/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom P4 — PROFESYONEL BİLGİ & ÖĞRENME MERKEZİ (TÜRETİLMİŞ)
   Tamamen SALT OKUNUR. Tek kaynak: mevcut wisdom (wqList/wqById) + relations
   (getRelatedEntities). Yeni koleksiyon/alan/write/migration/restore/listener YOK.
   Grafik YOK; sadece kart + rozet + pill. Design system (card/pill/ic). Responsive.
   ══════════════════════════════════════════════════════════════════════════ */

function _wlcList(){ return (typeof wqList==='function')?wqList():(Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]); }
function _wlcActive(){ return _wlcList().filter(function(q){ return q&&q.active!==false&&String(q.quote==null?'':q.quote).trim(); }); }
function _wlcTs(x){ if(x==null||x==='')return 0; var t=Date.parse(x); if(!isNaN(t))return t; var n=Number(x); return isNaN(n)?0:n; }
function _wlcNow(now){ return now?(now instanceof Date?now.getTime():Number(now)):Date.now(); }
function _wlcDayNum(now){ var d=new Date(_wlcNow(now)); return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000); }
function _wlcNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr').replace(/\s+/g,' ').trim(); }
function _wle(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _wlcIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }

/* Okuma süresi (türetilmiş; ~200 kelime/dk). */
function wlcReadingTime(q){
  var w=String(q&&q.quote||'').trim(); if(!w)return {seconds:0,label:'—'};
  var words=w.split(/\s+/).filter(Boolean).length;
  var sec=Math.max(3,Math.round(words/200*60));
  return {seconds:sec,words:words,label:sec<60?('≈ '+sec+' sn'):('≈ '+Math.ceil(sec/60)+' dk')};
}
window.wlcReadingTime=wlcReadingTime;

/* Öğrenme Merkezi kategorileri (sabit liste + türetilmiş sayı). */
var WLC_CATEGORIES=['Yönetim','Liderlik','Ticaret','Finans','Satış','Satınalma','Müzakere','Psikoloji','Disiplin','Aile','Çocuk','Sağlık','Girişimcilik','Üretkenlik','Tarih','Bilim','Teknoloji','Yazılım','İslam','Hayat'];
window.WLC_CATEGORIES=WLC_CATEGORIES;
function wlcCategories(){
  var counts={}; _wlcActive().forEach(function(q){ var c=q.category||'—'; counts[c]=(counts[c]||0)+1; });
  var defs=WLC_CATEGORIES.map(function(c){ return {category:c,count:counts[c]||0}; });
  // veride olup listede olmayan ek kategoriler de eklenir
  Object.keys(counts).forEach(function(c){ if(c!=='—'&&WLC_CATEGORIES.indexOf(c)<0)defs.push({category:c,count:counts[c]}); });
  return defs;
}
function wlcByCategory(cat){ return _wlcActive().filter(function(q){ return q.category===cat; }); }
window.wlcCategories=wlcCategories; window.wlcByCategory=wlcByCategory;

/* Haftanın Teması — haftaya göre deterministik. */
function wlcWeeklyTheme(now){
  var week=Math.floor(_wlcDayNum(now)/7);
  var theme=WLC_CATEGORIES[week%WLC_CATEGORIES.length];
  var items=wlcByCategory(theme);
  return {theme:theme,label:theme+' Haftası',count:items.length,items:items};
}
window.wlcWeeklyTheme=wlcWeeklyTheme;

/* Günün Öğretisi — güne göre deterministik seçim + türetilmiş açıklama/aksiyon + ilişkiler. */
function wlcTeachingOfDay(now){
  var pool=_wlcActive(); if(!pool.length)return null;
  var sorted=pool.slice().sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); });
  var q=sorted[_wlcDayNum(now)%sorted.length];
  var rel=(typeof getRelatedEntities==='function')?getRelatedEntities('wisdomQuote',q.id):[];
  function relOf(t){ return (rel||[]).filter(function(x){return x&&x.entity&&x.entity.type===t;}).map(function(x){return x.entity;}); }
  var notesPlain=(typeof richTextToPlainText==='function'&&q.notes)?richTextToPlainText(q.notes):(q.notes||'');
  return {
    quote:q,
    explanation:(notesPlain&&notesPlain.trim())?notesPlain.trim():('Bu söz '+(q.category||'genel')+' alanında bir ilke sunar; bugün üzerinde bir kez düşün.'),
    actionSuggestion:'Bugün bu ilkeyi tek bir küçük kararında uygula.',
    relatedGoals:relOf('goal'), relatedDecisions:relOf('decision')
  };
}
window.wlcTeachingOfDay=wlcTeachingOfDay;

/* Bilgelik Haritası. */
function wlcMap(now){
  var pool=_wlcActive(), N=6;
  function relCount(id){ var o=(typeof getOutgoingRelations==='function')?getOutgoingRelations('wisdomQuote',id).length:0; var i=(typeof getIncomingRelations==='function')?getIncomingRelations('wisdomQuote',id).length:0; return o+i; }
  var byRead=pool.slice().sort(function(a,b){return (b.showCount||0)-(a.showCount||0);});
  var byRel=pool.slice().map(function(q){return {q:q,n:relCount(q.id)};}).sort(function(a,b){return b.n-a.n;});
  return {
    mostRead:byRead.filter(function(q){return (q.showCount||0)>0;}).slice(0,N),
    mostFavorited:pool.filter(function(q){return q.favorite;}).slice(0,N),
    mostRelated:byRel.filter(function(x){return x.n>0;}).slice(0,N).map(function(x){return x.q;}),
    mostUsed:byRead.slice(0,N),
    newest:pool.slice().sort(function(a,b){return _wlcTs(b.createdAt)-_wlcTs(a.createdAt);}).slice(0,N),
    recentlyUpdated:pool.slice().sort(function(a,b){return _wlcTs(b.updatedAt)-_wlcTs(a.updatedAt);}).slice(0,N)
  };
}
window.wlcMap=wlcMap;

/* Öğrenme İlerlemesi. */
function wlcProgress(now){
  var pool=_wlcActive(), nowMs=_wlcNow(now), weekAgo=nowMs-7*864e5, monthAgo=nowMs-30*864e5;
  var wk=0,mo=0,fav=0,done=0,reread=0,unread=0;
  pool.forEach(function(q){
    var t=_wlcTs(q.lastShownAt);
    if(t){ if(t>=weekAgo)wk++; if(t>=monthAgo)mo++; }
    if(q.favorite)fav++;
    if(q.reflected)done++;
    if(q.pinned)reread++;
    if(!t&&(q.showCount||0)===0)unread++; // hiç gösterilmemiş = henüz okunmamış
  });
  return {thisWeek:wk,thisMonth:mo,favorites:fav,completed:done,toReread:reread,unread:unread,total:pool.length};
}
window.wlcProgress=wlcProgress;

/* İlişkili İçerikler — benzer/aynı yazar/kategori/etiket + ilişkiler. */
function wlcRelated(id){
  var q=(typeof wqById==='function')?wqById(id):null; if(!q)return null;
  var pool=_wlcActive().filter(function(x){return String(x.id)!==String(id);});
  var tags=(q.tags||[]).map(_wlcNorm);
  function sameTag(x){ return (x.tags||[]).some(function(t){return tags.indexOf(_wlcNorm(t))>=0;}); }
  var rel=(typeof getRelatedEntities==='function')?getRelatedEntities('wisdomQuote',id):[];
  function relOf(t){ return (rel||[]).filter(function(x){return x&&x.entity&&x.entity.type===t;}).map(function(x){return x.entity;}); }
  return {
    sameAuthor:q.author?pool.filter(function(x){return x.author&&_wlcNorm(x.author)===_wlcNorm(q.author);}).slice(0,6):[],
    sameCategory:q.category?pool.filter(function(x){return x.category===q.category;}).slice(0,6):[],
    sameTag:tags.length?pool.filter(sameTag).slice(0,6):[],
    similar:pool.filter(function(x){return (q.category&&x.category===q.category)||sameTag(x);}).slice(0,6),
    relatedGoals:relOf('goal'), relatedDecisions:relOf('decision'), relatedNotes:relOf('generalNote').concat(relOf('note'))
  };
}
window.wlcRelated=wlcRelated;

/* Bilgelik Araması — quote/author/tag/category/language/source/notes + ilişki etiketleri. */
function wlcSearch(query){
  var qq=_wlcNorm(query); if(!qq)return _wlcActive();
  return _wlcActive().filter(function(w){
    var notesPlain=(typeof richTextToPlainText==='function')?richTextToPlainText(w.notes||''):(w.notes||'');
    var relLabels='';
    if(typeof getRelatedEntities==='function'){ try{ relLabels=getRelatedEntities('wisdomQuote',w.id).map(function(x){return x.entity&&x.entity.label||'';}).join(' '); }catch(e){} }
    var hay=_wlcNorm([w.quote,w.author,w.category,(w.tags||[]).join(' '),w.language,w.source,notesPlain,relLabels].join(' '));
    return hay.indexOf(qq)>=0;
  });
}
window.wlcSearch=wlcSearch;

/* Profesyonel dashboard kartları + öğrenme skoru. */
function wlcLearningScore(now){
  var p=wlcProgress(now); if(!p.total)return 0;
  var read=p.total-p.unread;
  var score=(read/p.total)*50 + (p.favorites/p.total)*25 + (p.completed/p.total)*25;
  return Math.round(Math.max(0,Math.min(100,score)));
}
function wlcDashboardCards(now){
  var pool=_wlcActive(), cats={}, authors={};
  pool.forEach(function(q){ if(q.category)cats[q.category]=1; if(q.author)authors[q.author]=1; });
  var t=wlcWeeklyTheme(now), teach=wlcTeachingOfDay(now), prog=wlcProgress(now);
  return {
    total:pool.length, activeCategories:Object.keys(cats).length, activeAuthors:Object.keys(authors).length,
    thisMonthRead:prog.thisMonth, favorites:prog.favorites,
    weeklyTheme:t.label, teachingSnippet:teach?String(teach.quote.quote).slice(0,50):'—', learningScore:wlcLearningScore(now)
  };
}
window.wlcDashboardCards=wlcDashboardCards; window.wlcLearningScore=wlcLearningScore;

/* ── UI (design system; responsive; grafik yok) ── */
function _wlcStat(label,val,icon,color){
  return '<div class="card" style="padding:10px 12px;flex:1 1 130px;min-width:120px;max-width:100%">'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+_wlcIc(icon,13,color)+'<span style="font-size:9.5px;color:var(--t3);font-weight:600">'+_wle(label)+'</span></div>'+
    '<div style="font-size:17px;font-weight:800;color:'+color+';line-height:1.15;word-break:break-word">'+_wle(val)+'</div></div>';
}
function wlcDashboardHtml(now){
  var c=wlcDashboardCards(now);
  var h='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+=_wlcStat('Toplam Söz',c.total,'qt','var(--blue)');
  h+=_wlcStat('Aktif Kategori',c.activeCategories,'layers','var(--purple)');
  h+=_wlcStat('Aktif Yazar',c.activeAuthors,'us','var(--green)');
  h+=_wlcStat('Bu Ay Okunan',c.thisMonthRead,'zap','var(--orange)');
  h+=_wlcStat('Favoriler',c.favorites,'star','var(--orange)');
  h+=_wlcStat('Haftanın Teması',c.weeklyTheme,'flame','var(--red)');
  h+=_wlcStat('Öğrenme Skoru','%'+c.learningScore,'chk','var(--green)');
  h+='</div>';
  return h;
}
function wlcTeachingCardHtml(now){
  var t=wlcTeachingOfDay(now); if(!t)return '';
  var q=t.quote, rt=wlcReadingTime(q);
  var h='<div class="card wd-anim" style="padding:16px 18px;margin-bottom:14px;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2);max-width:100%">';
  h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:9px">'+_wlcIc('qt',15,'var(--blue)')+'<span style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">Günün Öğretisi</span>'+
    '<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3);margin-left:auto">'+_wle(rt.label)+'</span></div>';
  h+='<p style="font-size:clamp(15px,2.6vw,20px);font-style:italic;line-height:1.55;color:var(--t);word-break:break-word">&ldquo;'+_wle(q.quote)+'&rdquo;</p>';
  if(q.author)h+='<p style="font-size:12px;font-weight:700;color:var(--blue);margin-top:6px">&mdash; '+_wle(q.author)+'</p>';
  h+='<p style="font-size:12px;color:var(--t2);margin-top:9px;line-height:1.55">'+_wle(t.explanation)+'</p>';
  h+='<div style="display:flex;align-items:center;gap:6px;margin-top:9px;padding:7px 10px;border-radius:8px;background:var(--s2)">'+_wlcIc('chk',13,'var(--green)')+'<span style="font-size:11.5px;font-weight:600;color:var(--t2)">'+_wle(t.actionSuggestion)+'</span></div>';
  if(t.relatedGoals.length||t.relatedDecisions.length){
    h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px">';
    t.relatedGoals.forEach(function(g){ h+='<span class="pill p-blue" style="font-size:9px">Hedef: '+_wle(String(g.label).slice(0,24))+'</span>'; });
    t.relatedDecisions.forEach(function(d){ h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">Karar: '+_wle(String(d.label).slice(0,24))+'</span>'; });
    h+='</div>';
  }
  h+='</div>';
  return h;
}
window.wlcDashboardHtml=wlcDashboardHtml; window.wlcTeachingCardHtml=wlcTeachingCardHtml;

/* Öğrenme Merkezi bölümü (Özlü Sözler ekranına katlı enjekte edilir). */
function wlcLearningSectionHtml(now){
  if(!_wlcActive().length)return '';
  var t=wlcWeeklyTheme(now), p=wlcProgress(now);
  var h='<details class="card" style="padding:12px 14px;margin-bottom:14px;max-width:100%"><summary style="cursor:pointer;font-size:12px;font-weight:800;color:var(--t2);padding:2px 0">'+_wlcIc('bk',13,'var(--blue)')+' Öğrenme Merkezi <span style="font-weight:500;color:var(--t3);font-size:10px">· '+_wle(t.label)+'</span></summary><div style="margin-top:10px">';
  h+=wlcTeachingCardHtml(now);
  h+='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:4px 0 6px">Profesyonel Panel</p>'+wlcDashboardHtml(now);
  // Öğrenme İlerlemesi
  h+='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:12px 0 6px">Öğrenme İlerlemesi</p><div style="display:flex;gap:8px;flex-wrap:wrap">';
  [['Bu Hafta',p.thisWeek],['Bu Ay',p.thisMonth],['Favoriler',p.favorites],['Tamamlanan',p.completed],['Tekrar Okunacak',p.toReread],['Henüz Okunmayan',p.unread]].forEach(function(x){
    h+='<div class="card" style="padding:8px 11px;flex:1 1 100px;min-width:96px"><p style="font-size:9px;color:var(--t3)">'+_wle(x[0])+'</p><p style="font-size:16px;font-weight:800">'+x[1]+'</p></div>'; });
  h+='</div>';
  // Kategori filtreleri (Öğrenme Merkezi)
  h+='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:12px 0 6px">Kategoriler</p><div style="display:flex;gap:4px;flex-wrap:wrap">';
  wlcCategories().filter(function(c){return c.count>0;}).forEach(function(c){ h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--t2)">'+_wle(c.category)+' ('+c.count+')</span>'; });
  h+='</div>';
  h+='</div></details>';
  return h;
}
window.wlcLearningSectionHtml=wlcLearningSectionHtml;
