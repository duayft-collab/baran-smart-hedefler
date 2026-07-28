/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom P6 — AI KNOWLEDGE COACH (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK)
   Kişisel bilgi koçu: kullanıcının GÜNCEL bağlamına (aktif hedefler, açık kararlar,
   aktif ilkeler, yaşam alanları, günün bölümü) en uygun sözleri deterministik
   relevans skoruyla yüzeye çıkarır ve NEDEN uygun olduğunu açıklar.

   "AI" = deterministik relevans skorlaması (anahtar kelime/etiket/yaşam-alanı/kategori
   örtüşmesi + öncelik + yenilik). LLM veya API YOK, network YOK.

   Tek okuma kaynağı: wqList() / wqById() (dual-read tek giriş) + D.goals / D.decisions
   / D.principles / D.relations + mevcut relation resolver'ları. Sharded runtime cache'e
   veya legacy diziye DOĞRUDAN erişmez. Yeni koleksiyon/payload alanı/write/migration/
   import/restore/backup/realtime-listener YOK. localStorage yalnız günlük içgörü işareti
   (payload/backup'a girmez). Design-system uyumlu, erişilebilir, responsive.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── küçük yardımcılar ── */
function _wce(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _wcoIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _wcoNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr'); }
function _wcoTs(x){ if(x==null||x==='')return 0; var t=Date.parse(x); if(!isNaN(t))return t; var n=Number(x); return isNaN(n)?0:n; }
var WCO_STOP={ 've':1,'ile':1,'ama':1,'fakat':1,'için':1,'gibi':1,'çok':1,'daha':1,'the':1,'and':1,'for':1,'that':1,'with':1,'you':1,'are':1,'this':1,'her':1,'bir':1,'bu':1,'şu':1,'o':1,'de':1,'da':1,'ki':1,'mi':1,'ne':1,'ya':1,'en':1,'ise':1,'ama':1,'çünkü':1,'olan':1,'olarak':1,'kadar':1,'sonra':1,'önce':1,'the':1,'not':1,'but':1 };
function _wcoTokens(s){
  var raw=_wcoNorm(s).replace(/[^0-9a-zçğıöşü\s]/g,' ').split(/\s+/);
  var seen={},out=[];
  for(var i=0;i<raw.length;i++){ var t=raw[i]; if(t.length<3||WCO_STOP[t])continue; if(!seen[t]){ seen[t]=1; out.push(t); } }
  return out;
}
function _wcoBag(arr){ var m={}; (arr||[]).forEach(function(t){ if(t)m[t]=1; }); return m; }
function _wcoOverlap(tokens,bag){ var n=0; for(var i=0;i<tokens.length;i++){ if(bag[tokens[i]])n++; } return n; }
function _wcoQuoteTokens(q){ return _wcoTokens(String(q&&q.quote||'')+' '+((q&&q.tags||[]).join(' '))+' '+String(q&&q.category||'')); }

/* Tek okuma girişi — sharded/legacy fark etmez; doğrudan cache/diziye erişilmez. */
function _wcoAllQuotes(){ return (typeof wqList==='function')?wqList():[]; }
function _wcoActiveQuotes(){ return _wcoAllQuotes().filter(function(q){ return q&&q.active!==false&&String(q.quote==null?'':q.quote).trim(); }); }

/* ── veri modeli okuyucuları (mevcut alanlar; hiçbirini mutasyona uğratmaz) ── */
function _wcoActiveGoals(){
  var g=Array.isArray(D.goals)?D.goals:[];
  return g.filter(function(x){ return x&&x.status!=='done'&&x.status!=='archived'; }).map(function(x){
    var toks=_wcoTokens([x.title,x.desc,x.cat,x.measurable,(x.tags||[]).join(' ')].join(' '));
    return { id:x.id, label:String(x.title||x.desc||'').slice(0,80), cat:x.cat||'', tags:(x.tags||[]).slice(), tokens:toks, bag:_wcoBag(toks) };
  });
}
function _wcoOpenDecisions(){
  var d=(typeof decList==='function')?decList():(Array.isArray(D.decisions)?D.decisions:[]);
  return d.filter(function(x){ return x&&x.status==='open'; }).map(function(x){
    var toks=_wcoTokens([x.title,x.decision,x.context,(x.tags||[]).join(' ')].join(' '));
    return { id:x.id, label:String(x.title||x.decision||'').slice(0,80), tags:(x.tags||[]).slice(), tokens:toks, bag:_wcoBag(toks) };
  });
}
function _wcoAreaLabel(a){ return (typeof pAreaLabel==='function')?pAreaLabel(a):String(a||''); }
function _wcoActivePrinciples(){
  var p=(typeof pList==='function')?pList():(Array.isArray(D.principles)?D.principles:[]);
  return p.filter(function(x){ return x&&(x.status==null||x.status==='active'); }).map(function(x){
    var areaLabel=_wcoAreaLabel(x.lifeArea);
    var toks=_wcoTokens([x.title,x.statement,x.text,x.category,areaLabel,(x.tags||[]).join(' ')].join(' '));
    return { id:x.id, label:String(x.title||x.statement||x.text||'').slice(0,80), lifeArea:x.lifeArea||'', areaLabel:areaLabel, category:x.category||'', tokens:toks, bag:_wcoBag(toks) };
  });
}
function _wcoDayPart(){ var h=new Date().getHours(); if(h>=5&&h<12)return 'morning'; if(h>=12&&h<17)return 'afternoon'; if(h>=17&&h<22)return 'evening'; return 'night'; }
var WCO_DAYPART_LABEL={ morning:'Sabah', afternoon:'Öğleden Sonra', evening:'Akşam', night:'Gece' };
var WCO_WEEKDAY_LABEL=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

/* ── 1) Bağlam anlık görüntüsü (salt-okunur) ── */
function wcoBuildContext(){
  var goals=_wcoActiveGoals(), decisions=_wcoOpenDecisions(), principles=_wcoActivePrinciples();
  var kw={},cats={},tags={},areas={},lifeAreaTok=[];
  function addBag(b){ Object.keys(b).forEach(function(k){ kw[k]=1; }); }
  goals.forEach(function(x){ addBag(x.bag); if(x.cat)cats[x.cat]=1; });
  decisions.forEach(function(x){ addBag(x.bag); });
  principles.forEach(function(x){ addBag(x.bag); if(x.category)cats[x.category]=1; if(x.areaLabel){ areas[x.areaLabel]=1; _wcoTokens(x.areaLabel).forEach(function(t){ lifeAreaTok.push(t); }); } });
  [goals,decisions].forEach(function(list){ list.forEach(function(x){ (x.tags||[]).forEach(function(t){ tags[_wcoNorm(t)]=1; }); }); });
  var dp=(typeof cdDayPart==='function')?cdDayPart():_wcoDayPart();
  var wd=new Date().getDay();
  return {
    now:Date.now(),
    dayPart:dp, dayPartLabel:WCO_DAYPART_LABEL[dp]||dp,
    weekday:wd, weekdayLabel:WCO_WEEKDAY_LABEL[wd]||'',
    source:(typeof wisdomReadSource==='function')?wisdomReadSource():'legacy',
    goals:goals, decisions:decisions, principles:principles,
    lifeAreas:Object.keys(areas),
    categories:Object.keys(cats), tags:Object.keys(tags),
    keywords:Object.keys(kw),
    goalBag:goals.reduce(function(m,x){ Object.keys(x.bag).forEach(function(k){m[k]=1;}); return m; },{}),
    decisionBag:decisions.reduce(function(m,x){ Object.keys(x.bag).forEach(function(k){m[k]=1;}); return m; },{}),
    principleBag:principles.reduce(function(m,x){ Object.keys(x.bag).forEach(function(k){m[k]=1;}); return m; },{}),
    lifeAreaBag:_wcoBag(lifeAreaTok)
  };
}
window.wcoBuildContext=wcoBuildContext;

/* ── 2) Deterministik relevans skoru [0,1] — yan etkisiz ── */
var WCO_W={ goal:1.4, decision:1.1, principle:1.0, lifeArea:0.8, category:0.9, tag:0.7, priority:0.25, favorite:0.5, reflected:0.4, recent:1.2, repeat:0.5 };
function wcoScoreQuote(quote,context){
  var ctx=context||wcoBuildContext();
  var qt=_wcoQuoteTokens(quote);
  var goalOv=_wcoOverlap(qt,ctx.goalBag||{});
  var decOv=_wcoOverlap(qt,ctx.decisionBag||{});
  var priOv=_wcoOverlap(qt,ctx.principleBag||{});
  var laOv=_wcoOverlap(qt,ctx.lifeAreaBag||{});
  var catM=(quote&&quote.category&&(ctx.categories||[]).indexOf(quote.category)>=0)?1:0;
  var tagM=((quote&&quote.tags)||[]).filter(function(t){ return (ctx.tags||[]).indexOf(_wcoNorm(t))>=0; }).length;
  var priority=Number(quote&&quote.priority)||3;
  var fav=(quote&&quote.favorite)?1:0;
  var refl=(quote&&quote.reflected)?1:0;
  var last=_wcoTs(quote&&quote.lastShownAt);
  var recent=last>0?Math.max(0,1-(ctx.now-last)/(2*864e5)):0; // 2 gün içinde gösterildiyse ceza
  var repeat=Math.min(1,(Number(quote&&quote.showCount)||0)/20);
  var raw=goalOv*WCO_W.goal+decOv*WCO_W.decision+priOv*WCO_W.principle+laOv*WCO_W.lifeArea
        +catM*WCO_W.category+tagM*WCO_W.tag+(priority-3)*WCO_W.priority+fav*WCO_W.favorite+refl*WCO_W.reflected
        -recent*WCO_W.recent-repeat*WCO_W.repeat;
  return 1/(1+Math.exp(-raw*0.6)); // lojistik: raw'da monoton, daima (0,1)
}
window.wcoScoreQuote=wcoScoreQuote;

/* En güçlü eşleşen hedef/ilke/yaşam-alanı/anahtar kelime — açıklama için */
function _wcoBestMatches(quote,ctx){
  var qt=_wcoQuoteTokens(quote), qbag=_wcoBag(qt);
  function best(list){ var bi=null,bo=0; (list||[]).forEach(function(x){ var o=_wcoOverlap(x.tokens,qbag); if(o>bo){ bo=o; bi=x; } }); return bo>0?bi:null; }
  var g=best(ctx.goals), p=best(ctx.principles), d=best(ctx.decisions);
  var lifeArea='';
  if(p&&p.areaLabel&&_wcoOverlap(_wcoTokens(p.areaLabel),qbag)>0)lifeArea=p.areaLabel;
  if(!lifeArea){ (ctx.lifeAreas||[]).some(function(a){ if(_wcoOverlap(_wcoTokens(a),qbag)>0){ lifeArea=a; return true; } return false; }); }
  var keyword=''; for(var i=0;i<qt.length;i++){ if((ctx.keywords||[]).indexOf(qt[i])>=0){ keyword=qt[i]; break; } }
  var category=(quote&&quote.category&&(ctx.categories||[]).indexOf(quote.category)>=0)?quote.category:'';
  var tag=''; ((quote&&quote.tags)||[]).some(function(t){ if((ctx.tags||[]).indexOf(_wcoNorm(t))>=0){ tag=t; return true; } return false; });
  return { goal:g?g.label:'', goalId:g?g.id:null, principle:p?p.label:'', principleId:p?p.id:null,
           decision:d?d.label:'', decisionId:d?d.id:null, lifeArea:lifeArea, keyword:keyword, category:category, tag:tag };
}
function _wcoReason(m,ctx){
  var parts=[];
  if(m.goal)parts.push('İlgili hedef: '+m.goal);
  if(m.principle)parts.push('İlkenle bağlantılı: '+m.principle);
  if(m.decision)parts.push('Açık kararınla ilgili: '+m.decision);
  if(m.lifeArea)parts.push('Yaşam alanı: '+m.lifeArea);
  if(!m.goal&&!m.principle&&!m.decision){
    if(m.category)parts.push('Odak kategorin: '+m.category);
    else if(m.keyword)parts.push('Ortak konu: '+m.keyword);
    else parts.push('Öncelik ve okuma geçmişine göre öne çıktı');
  }
  return parts.join(' · ');
}

/* ── 3) Öneri motoru — sıralı, deterministik ── */
function wcoRecommend(context,limit,offset){
  var ctx=context||wcoBuildContext();
  limit=limit==null?3:limit; offset=offset||0;
  var scored=_wcoActiveQuotes().map(function(q){
    var s=wcoScoreQuote(q,ctx), m=_wcoBestMatches(q,ctx);
    return { id:q.id, quote:String(q.quote||''), author:String(q.author||''), category:q.category||'',
             score:s, priority:Number(q.priority)||3,
             matchedGoal:m.goal, matchedPrinciple:m.principle, matchedDecision:m.decision,
             matchedLifeArea:m.lifeArea, matchedKeyword:m.keyword, matchedCategory:m.category, matchedTag:m.tag,
             reason:_wcoReason(m,ctx), readingTime:wcoReadingTime(q.quote), readingSeconds:wcoReadingSeconds(q.quote),
             favorite:!!q.favorite };
  });
  scored.sort(function(a,b){
    if(b.score!==a.score)return b.score-a.score;
    if(b.priority!==a.priority)return b.priority-a.priority;
    var ai=String(a.id),bi=String(b.id); return ai<bi?-1:(ai>bi?1:0);
  });
  if(offset>0&&scored.length)offset=offset%scored.length;
  return scored.slice(offset,offset+limit);
}
window.wcoRecommend=wcoRecommend;

/* ── okuma süresi (türetilmiş) ── */
function _wcoWordCount(t){ t=String(t==null?'':t).trim(); return t?t.split(/\s+/).length:0; }
function wcoReadingSeconds(t){ return Math.max(1,Math.round(_wcoWordCount(t)/(200/60))); } // ~200 kelime/dk
function wcoReadingTime(t){ var s=wcoReadingSeconds(t); return s<60?('≈'+s+' sn okuma'):('≈'+Math.round(s/60)+' dk okuma'); }
window.wcoReadingSeconds=wcoReadingSeconds; window.wcoReadingTime=wcoReadingTime;

/* ── 4) İçgörü serisi — showCount/lastShownAt/reflected + localStorage günlük işaret ── */
var WCO_STREAK_KEY='fu7_wco_streak';
window.WCO_STREAK_KEY=WCO_STREAK_KEY;
function _wcoPad(n){ return (n<10?'0':'')+n; }
function _wcoDayStr(d){ d=d||new Date(); return d.getFullYear()+'-'+_wcoPad(d.getMonth()+1)+'-'+_wcoPad(d.getDate()); }
function _wcoReadStreak(){
  try{ var raw=(typeof localStorage!=='undefined')?localStorage.getItem(WCO_STREAK_KEY):null;
    if(raw){ var o=JSON.parse(raw); if(o&&Array.isArray(o.days))return { days:o.days.slice(), longest:Number(o.longest)||0 }; }
  }catch(e){}
  return { days:[], longest:0 };
}
function _wcoWriteStreak(o){ try{ if(typeof localStorage!=='undefined')localStorage.setItem(WCO_STREAK_KEY,JSON.stringify({ days:(o.days||[]).slice(-90), longest:Number(o.longest)||0 })); }catch(e){} }
function _wcoDayNum(str){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str||'')); return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5):null; }
function _wcoRunLength(days,todayStr){
  if(!days||!days.length)return 0;
  var set={}; days.forEach(function(d){ set[d]=1; });
  var today=_wcoDayNum(todayStr); if(today==null)return 0;
  var start=set[todayStr]?today:(set[_wcoDayStrFromNum(today-1)]?today-1:null);
  if(start==null)return 0;
  var len=0,cur=start;
  while(set[_wcoDayStrFromNum(cur)]){ len++; cur--; }
  return len;
}
function _wcoDayStrFromNum(n){ var d=new Date(n*864e5); return d.getUTCFullYear()+'-'+_wcoPad(d.getUTCMonth()+1)+'-'+_wcoPad(d.getUTCDate()); }
/* Salt-okunur türetim: Firestore/payload'a YAZMAZ (localStorage'ı bile değiştirmez). */
function wcoInsightStreak(){
  var st=_wcoReadStreak(), today=_wcoDayStr();
  var current=_wcoRunLength(st.days,today);
  var q=_wcoActiveQuotes(), reflected=0,readToday=0;
  q.forEach(function(x){ if(x.reflected)reflected++; if(_wcoDayStr(new Date(_wcoTs(x.lastShownAt)))===today&&_wcoTs(x.lastShownAt)>0)readToday++; });
  return { current:current, longest:Math.max(st.longest||0,current), reflectedTotal:reflected, readToday:readToday, activeDays:st.days.length };
}
window.wcoInsightStreak=wcoInsightStreak;
/* Günlük işaret — YALNIZ panel render'ından çağrılır; SADECE localStorage (payload/backup değil). */
function _wcoTouchStreak(){
  var st=_wcoReadStreak(), today=_wcoDayStr();
  if(st.days.indexOf(today)<0)st.days.push(today);
  st.longest=Math.max(st.longest||0,_wcoRunLength(st.days,today));
  _wcoWriteStreak(st);
}

/* ── öneri döngüsü (Yeni Öneri) — salt görsel, 0 write ── */
var _wcoOffset=0;
function wcoNextRecommendation(){ _wcoOffset+=3; if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); }
window.wcoNextRecommendation=wcoNextRecommendation;
function wcoCopy(id){
  var q=(typeof wqById==='function')?wqById(id):null; if(!q)return;
  var txt=String(q.quote||'')+(q.author?(' — '+q.author):'');
  try{ if(typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt); }catch(e){}
  if(typeof wqToast==='function')wqToast('Panoya kopyalandı');
}
window.wcoCopy=wcoCopy;

/* ── 5) Panel (Knowledge Coach) — design-system, erişilebilir, responsive ── */
function _wcoWhyHtml(r){
  var rows=[];
  if(r.matchedGoal)rows.push([_wcoIc('target',12,'var(--blue)'),'Eşleşen hedef',r.matchedGoal]);
  if(r.matchedPrinciple)rows.push([_wcoIc('shield',12,'var(--purple)'),'Eşleşen ilke',r.matchedPrinciple]);
  if(r.matchedDecision)rows.push([_wcoIc('git',12,'var(--orange)'),'Açık karar',r.matchedDecision]);
  if(r.matchedLifeArea)rows.push([_wcoIc('us',12,'var(--green)'),'Yaşam alanı',r.matchedLifeArea]);
  if(r.matchedKeyword&&!r.matchedGoal&&!r.matchedPrinciple)rows.push([_wcoIc('search',12,'var(--t2)'),'Ortak konu',r.matchedKeyword]);
  if(r.matchedCategory)rows.push([_wcoIc('layers',12,'var(--t2)'),'Kategori',r.matchedCategory]);
  if(!rows.length)rows.push([_wcoIc('info',12,'var(--t3)'),'Gerekçe','Öncelik ve okuma geçmişine göre öne çıktı']);
  var body='';
  rows.forEach(function(x){ body+='<div style="display:flex;gap:6px;align-items:flex-start;margin-top:4px"><span style="flex-shrink:0">'+x[0]+'</span><span style="font-size:10.5px;color:var(--t3);font-weight:700;flex-shrink:0">'+_wce(x[1])+':</span><span style="font-size:10.5px;color:var(--t2);word-break:break-word">'+_wce(x[2])+'</span></div>'; });
  return '<details class="wco-why" style="margin-top:7px;max-width:100%" ontoggle="if(this.firstElementChild)this.firstElementChild.setAttribute(\'aria-expanded\',this.open?\'true\':\'false\')">'+
    '<summary aria-expanded="false" tabindex="0" style="cursor:pointer;font-size:10.5px;font-weight:700;color:var(--blue);padding:2px 0;display:flex;align-items:center;gap:5px">'+_wcoIc('info',12,'var(--blue)')+'Neden önemli?</summary>'+
    '<div style="margin-top:4px;padding-left:2px">'+body+'</div></details>';
}
function _wcoRecCardHtml(r){
  var id=_wce(String(r.id));
  var h='<div class="card" style="padding:11px 13px;max-width:100%;border:1px solid var(--s2)">';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:5px">';
  if(r.category)h+='<span class="pill p-blue" style="font-size:9px">'+_wce(r.category)+'</span>';
  h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3)">'+_wce(r.readingTime)+'</span>';
  h+='</div>';
  h+='<p style="font-size:13px;font-style:italic;line-height:1.55;color:var(--t);word-break:break-word">&ldquo;'+_wce(r.quote)+'&rdquo;</p>';
  if(r.author)h+='<p style="font-size:11px;font-weight:700;color:var(--blue);margin-top:3px">&mdash; '+_wce(r.author)+'</p>';
  if(r.reason)h+='<p style="font-size:10.5px;color:var(--t2);margin-top:5px;display:flex;gap:5px;align-items:flex-start"><span style="flex-shrink:0">'+_wcoIc('bulb',12,'var(--orange)')+'</span><span style="word-break:break-word">'+_wce(r.reason)+'</span></p>';
  h+=_wcoWhyHtml(r);
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">';
  h+='<button class="btn btn-g btn-sm" data-id="'+id+'" onclick="openWqForm(this.dataset.id)" title="Detayı aç">'+_wcoIc('edit',11,'var(--t3)')+' Detay</button>';
  h+='<button class="btn btn-g btn-sm" data-id="'+id+'" onclick="wcoCopy(this.dataset.id)" title="Kopyala">'+_wcoIc('copy',11,'var(--t3)')+' Kopyala</button>';
  h+='<button class="btn btn-g btn-sm" data-id="'+id+'" onclick="wqToggleFav(this.dataset.id)" title="Favori" aria-label="Favori">'+_wcoIc('star',11,r.favorite?'var(--orange)':'var(--t3)')+(r.favorite?' Favori ✓':' Favori')+'</button>';
  h+='</div></div>';
  return h;
}
function wcoCoachPanelHtml(){
  if(!_wcoActiveQuotes().length)return '';
  var ctx=wcoBuildContext();
  var recs=wcoRecommend(ctx,3,_wcoOffset);
  if(!recs.length)return '';
  _wcoTouchStreak(); // localStorage-only günlük işaret
  var s=wcoInsightStreak();
  var h='<div class="card wd-anim" style="padding:14px 16px;margin-bottom:14px;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2);max-width:100%">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap">'+_wcoIc('bulb',16,'var(--orange)')+'<h2 style="font-size:14px;font-weight:800;letter-spacing:.03em">Bilgi Koçu</h2>';
  h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3);margin-left:auto">'+_wce(ctx.dayPartLabel)+' · '+_wce(ctx.weekdayLabel)+'</span></div>';
  // bağlam özeti (renk-only değil: metin + ikon)
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px">';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--t2)">'+_wcoIc('target',11,'var(--blue)')+' '+ctx.goals.length+' aktif hedef</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--t2)">'+_wcoIc('git',11,'var(--orange)')+' '+ctx.decisions.length+' açık karar</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--t2)">'+_wcoIc('shield',11,'var(--purple)')+' '+ctx.principles.length+' aktif ilke</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--green)">'+_wcoIc('flame',11,'var(--green)')+' '+s.current+' günlük seri</span>';
  h+='</div>';
  // öneriler
  h+='<div style="display:flex;flex-direction:column;gap:8px">';
  recs.forEach(function(r){ h+=_wcoRecCardHtml(r); });
  h+='</div>';
  h+='<div style="margin-top:9px;text-align:right"><button class="btn btn-g btn-sm" onclick="wcoNextRecommendation()" title="Yeni öneri">'+_wcoIc('refresh',11,'var(--t3)')+' Yeni Öneri</button></div>';
  h+='</div>';
  return h;
}
window.wcoCoachPanelHtml=wcoCoachPanelHtml;
