/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom P7 — INSIGHT ANALYTICS & REFLECTION INTELLIGENCE
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK)

   Wisdom modülünü pasif okuma deneyiminden aktif kişisel yansıma + karar-zekâsı
   sistemine dönüştürür. Tek okuma girişi: wqList()/wqById(). P4 (wlc*), P5 (wkg*),
   P6 (wco*) çıktıları YENİDEN KULLANILIR — çift tarama yok, tek wqList okuması
   memoize edilir. Yansıma yalnız mevcut wqToggleReflect() ile kalıcılaşır.

   Yeni koleksiyon/payload/settings/write/migration/import/restore/backup/network/
   realtime-listener YOK. Sharded runtime cache'e veya legacy diziye DOĞRUDAN
   erişmez. Design-system uyumlu, erişilebilir, responsive.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── küçük yardımcılar ── */
function _wiae(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _wiaIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _wiaTs(x){ if(x==null||x==='')return 0; var t=Date.parse(x); if(!isNaN(t))return t; var n=Number(x); return isNaN(n)?0:n; }
function _wiaPct(a,b){ return b>0?Math.round(a/b*100):0; }
function _wiaHash(s){ var h=0,str=String(s==null?'':s); for(var i=0;i<str.length;i++){ h=(h*31+str.charCodeAt(i))|0; } return Math.abs(h); }
var _WIA_DAY=864e5;

/* Tek okuma girişi — sharded/legacy fark etmez; cache/diziye doğrudan erişmez. */
function _wiaActive(){ var l=(typeof wqList==='function')?wqList():[]; return l.filter(function(q){ return q&&q.active!==false&&String(q.quote==null?'':q.quote).trim(); }); }

/* ── memoize edilmiş temel toplama (tek geçiş; imza değişince yeniden hesaplanır) ── */
var _WIA_CACHE=null, _WIA_SIG=null;
function wiaInvalidate(){ _WIA_CACHE=null; _WIA_SIG=null; }
window.wiaInvalidate=wiaInvalidate;
function wiaBase(){
  var list=_wiaActive(); // TEK wqList okuması
  var n=list.length, scTot=0, refl=0, fav=0, pin=0, read=0, maxU=0;
  for(var i=0;i<n;i++){ var q=list[i]; var sc=Number(q.showCount)||0; scTot+=sc; if(sc>0)read++; if(q.reflected)refl++; if(q.favorite)fav++; if(q.pinned)pin++; var u=_wiaTs(q.updatedAt); if(u>maxU)maxU=u; }
  var sig=n+'|'+scTot+'|'+refl+'|'+fav+'|'+pin+'|'+maxU;
  if(_WIA_CACHE&&_WIA_SIG===sig)return _WIA_CACHE;
  var now=Date.now(), wk=now-7*_WIA_DAY, mo=now-30*_WIA_DAY;
  var cats={}, authors={}, weekly=0, monthly=0, buckets=[0,0,0,0,0,0,0,0];
  list.forEach(function(q){
    var sc=Number(q.showCount)||0, last=_wiaTs(q.lastShownAt);
    var c=q.category||'—'; var cm=cats[c]||(cats[c]={total:0,read:0,reflect:0,fav:0}); cm.total++; if(sc>0)cm.read++; if(q.reflected)cm.reflect++; if(q.favorite)cm.fav++;
    var a=q.author||'—'; var am=authors[a]||(authors[a]={total:0,read:0}); am.total++; if(sc>0)am.read++;
    if(last>=wk)weekly++; if(last>=mo)monthly++;
    if(last>0){ var wago=Math.floor((now-last)/(7*_WIA_DAY)); if(wago>=0&&wago<8)buckets[7-wago]++; }
  });
  _WIA_CACHE={ list:list, total:n, read:read, reflected:refl, favorite:fav, pinned:pin, untouched:n-read,
    showTotal:scTot, weekly:weekly, monthly:monthly, cats:cats, authors:authors, weekBuckets:buckets, now:now };
  _WIA_SIG=sig; return _WIA_CACHE;
}
window.wiaBase=wiaBase;

/* ── Modül 1 — Engagement Analytics ── */
function wiaEngagementStats(b){
  b=b||wiaBase();
  var activeCats=Object.keys(b.cats).filter(function(c){ return c!=='—'&&b.cats[c].total>0; }).length;
  return {
    readCoverage:_wiaPct(b.read,b.total), reflectionRate:_wiaPct(b.reflected,b.total), favoriteRate:_wiaPct(b.favorite,b.total),
    untouched:b.untouched, weeklyReads:b.weekly, monthlyReads:b.monthly,
    knowledgeDensity:_wiaPct(b.read,b.total), activeCategories:activeCats
  };
}
window.wiaEngagementStats=wiaEngagementStats;

/* ── Modül 2 — Learning Gaps (öncelik sıralı) ── */
function wiaLearningGaps(b){
  b=b||wiaBase(); var gaps=[];
  var neverCats=Object.keys(b.cats).filter(function(c){ return c!=='—'&&b.cats[c].read===0; });
  if(neverCats.length)gaps.push({type:'category_unvisited',label:'Hiç okunmamış kategori',items:neverCats.slice(0,8),count:neverCats.length,priority:5});
  var neverAuth=Object.keys(b.authors).filter(function(a){ return a!=='—'&&b.authors[a].read===0; });
  if(neverAuth.length)gaps.push({type:'author_unread',label:'Hiç okunmamış yazar',items:neverAuth.slice(0,8),count:neverAuth.length,priority:3});
  var oldFav=b.list.filter(function(q){ return q.favorite&&(Number(q.showCount)||0)<=1; });
  if(oldFav.length)gaps.push({type:'favorite_unrevisited',label:'Tekrar ziyaret edilmemiş favoriler',items:oldFav.slice(0,8).map(_wiaLabel),count:oldFav.length,priority:4});
  var forgottenPin=b.list.filter(function(q){ return q.pinned&&_wiaTs(q.lastShownAt)>0&&(b.now-_wiaTs(q.lastShownAt))>30*_WIA_DAY; });
  if(forgottenPin.length)gaps.push({type:'pinned_forgotten',label:'Unutulmuş sabitlenenler',items:forgottenPin.slice(0,8).map(_wiaLabel),count:forgottenPin.length,priority:4});
  // ihmal edilen yaşam alanları (bağlamdan)
  if(typeof wcoBuildContext==='function'){ var ctx=wcoBuildContext(); (ctx.lifeAreas||[]).forEach(function(a){ /* okunmuş sözlerde alan geçmiyorsa ihmal */ });
    var ignored=(ctx.lifeAreas||[]).filter(function(a){ var kn=_wiaNorm(a); return !b.list.some(function(q){ return (Number(q.showCount)||0)>0&&_wiaNorm(q.quote+' '+(q.tags||[]).join(' ')).indexOf(kn)>=0; }); });
    if(ignored.length)gaps.push({type:'lifearea_ignored',label:'İhmal edilen yaşam alanları',items:ignored.slice(0,8),count:ignored.length,priority:4}); }
  // okunmamış koç önerileri
  if(typeof wcoRecommend==='function'){ var recs=wcoRecommend(null,10)||[]; var unread=recs.filter(function(r){ var q=(typeof wqById==='function')?wqById(r.id):null; return q&&(Number(q.showCount)||0)===0; });
    if(unread.length)gaps.push({type:'coach_unread',label:'Okunmamış koç önerileri',items:unread.slice(0,5).map(function(r){return r.quote.slice(0,60);}),count:unread.length,priority:5}); }
  gaps.sort(function(x,y){ if(y.priority!==x.priority)return y.priority-x.priority; return y.count-x.count; });
  return gaps;
}
function _wiaLabel(q){ return String(q.quote||'').slice(0,60); }
function _wiaNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr'); }
window.wiaLearningGaps=wiaLearningGaps;

/* ── Modül 3 — Follow Through (koç önerisi hunisi) ── */
function _wiaRelCount(id,type){ if(typeof getRelatedEntities!=='function')return 0; try{ return getRelatedEntities('wisdomQuote',id).filter(function(x){return x&&x.entity&&x.entity.type===type;}).length; }catch(e){ return 0; } }
function wiaFollowThrough(){
  var recs=(typeof wcoRecommend==='function')?(wcoRecommend(null,10)||[]):[];
  var total=recs.length, viewed=0,favorited=0,reflected=0,pinned=0,goal=0,decision=0;
  recs.forEach(function(r){ var q=(typeof wqById==='function')?wqById(r.id):null; if(!q)return;
    if((Number(q.showCount)||0)>0)viewed++; if(q.favorite)favorited++; if(q.reflected)reflected++; if(q.pinned)pinned++;
    if(_wiaRelCount(q.id,'goal')>0)goal++; if(_wiaRelCount(q.id,'decision')>0)decision++; });
  return { total:total, viewed:viewed, favorited:favorited, reflected:reflected, pinned:pinned, relatedGoal:goal, decisionInfluence:decision,
    viewedRate:_wiaPct(viewed,total), reflectedRate:_wiaPct(reflected,total) };
}
window.wiaFollowThrough=wiaFollowThrough;

/* ── Modül 4 — Reflection Intelligence (deterministik şablon) ── */
var WIA_PROMPTS=[
  'Bu söz hangi varsayımını sorguluyor?',
  'Bu ilkeyle yaşasaydın yarın ne değişirdi?',
  'Şu an hangi aktif hedefinle en çok bağlantılı?',
  'Bu söz hangi mevcut kararını kolaylaştırıyor?',
  'Bunu bir haftadır uygulasaydın ne fark ederdin?',
  'Bu düşünceye en çok karşı çıkan yanın hangisi?',
  'Bugün bu sözü tek bir eyleme nasıl dökersin?'
];
window.WIA_PROMPTS=WIA_PROMPTS;
function wiaReflectionPrompt(){
  var recs=(typeof wcoRecommend==='function')?(wcoRecommend(null,1)||[]):[];
  if(!recs.length)return null;
  var r=recs[0];
  var doy=Math.floor((Date.now()-Date.UTC(new Date().getFullYear(),0,0))/_WIA_DAY);
  var idx=(_wiaHash(r.id)+doy)%WIA_PROMPTS.length;
  return { id:r.id, quote:r.quote, author:r.author, prompt:WIA_PROMPTS[idx],
    relatedGoal:r.matchedGoal||'', relatedDecision:r.matchedDecision||'', relatedLifeArea:r.matchedLifeArea||'' };
}
window.wiaReflectionPrompt=wiaReflectionPrompt;

/* ── Modül 5 — Weekly Review ── */
function wiaWeeklyReview(b){
  b=b||wiaBase();
  var radars=(typeof wkgRadars==='function')?wkgRadars():{};
  var gaps=wiaLearningGaps(b);
  var recs=(typeof wcoRecommend==='function')?(wcoRecommend(null,1)||[]):[];
  var momentum=b.weekly>=Math.ceil(b.monthly/4)?'improving':(b.weekly>0?'stable':'idle');
  return {
    topInsight:recs.length?recs[0].quote:'',
    mostIgnoredArea:gaps.length?gaps[0].label:'—',
    strongestCategory:radars.strongest||'—',
    weakestCategory:radars.weakest||'—',
    biggestImprovement:radars.mostGrowing||'—',
    recommendedFocus:gaps.length?gaps[0].label:(radars.weakest||'—'),
    knowledgeMomentum:momentum
  };
}
window.wiaWeeklyReview=wiaWeeklyReview;

/* ── Modül 6 — Executive Dashboard ── */
function _wiaCategoryBalance(b){
  var cats=Object.keys(b.cats).filter(function(c){return c!=='—'&&b.cats[c].total>0;});
  if(!cats.length)return 0;
  var reads=cats.map(function(c){return b.cats[c].read;}); var sum=reads.reduce(function(a,x){return a+x;},0);
  if(sum<=0)return 0; var mean=sum/cats.length;
  var varc=reads.reduce(function(a,x){return a+(x-mean)*(x-mean);},0)/cats.length;
  var cv=mean>0?Math.sqrt(varc)/mean:1; return Math.round(Math.max(0,Math.min(100,(1-Math.min(1,cv))*100))); // dengeli=100
}
function wiaExecutiveDashboard(){
  var b=wiaBase(); // tek base; alt modüller yeniden kullanır
  var eng=wiaEngagementStats(b), ft=wiaFollowThrough(), wr=wiaWeeklyReview(b);
  var kScore=(typeof wkgKnowledgeScore==='function')?wkgKnowledgeScore():0;
  var decCov=_wiaDecisionCoverage();
  var health=Math.round((eng.readCoverage*0.4+eng.reflectionRate*0.35+kScore*0.25));
  var balance=_wiaCategoryBalance(b);
  return {
    knowledgeHealth:health,
    reflectionScore:eng.reflectionRate,
    learningMomentum:wr.knowledgeMomentum,
    decisionCoverage:decCov,
    categoryBalance:balance,
    knowledgeScore:kScore,
    coachSuccess:ft.reflectedRate,
    weeklyFocus:wr.recommendedFocus
  };
}
window.wiaExecutiveDashboard=wiaExecutiveDashboard;
function _wiaDecisionCoverage(){
  var decs=(typeof decList==='function')?decList():(Array.isArray(D.decisions)?D.decisions:[]);
  var open=decs.filter(function(d){return d&&d.status==='open';});
  if(!open.length)return 0;
  var covered=open.filter(function(d){ if(typeof getRelatedEntities!=='function')return false; try{ return getRelatedEntities('decision',d.id).some(function(x){return x&&x.entity&&x.entity.type==='wisdomQuote';}); }catch(e){ return false; } });
  return _wiaPct(covered.length,open.length);
}

/* ── Modül 7 — Insight Timeline (Bugün / Bu Hafta / Daha Önce) ── */
function wiaTimeline(b){
  b=b||wiaBase(); var items=[];
  function push(q,kind,ts){ if(ts>0)items.push({id:q.id,quote:String(q.quote||'').slice(0,80),author:q.author||'',kind:kind,ts:ts}); }
  b.list.forEach(function(q){
    if(q.reflected)push(q,'reflected',_wiaTs(q.updatedAt));
    else if(q.favorite)push(q,'favorited',_wiaTs(q.updatedAt));
    else if(q.pinned)push(q,'pinned',_wiaTs(q.updatedAt));
    if(_wiaTs(q.lastShownAt)>0)push(q,'shown',_wiaTs(q.lastShownAt));
  });
  items.sort(function(x,y){ if(y.ts!==x.ts)return y.ts-x.ts; return String(x.id)<String(y.id)?-1:(String(x.id)>String(y.id)?1:0); });
  var today=[],week=[],earlier=[]; var t0=b.now-_WIA_DAY, w0=b.now-7*_WIA_DAY;
  items.slice(0,60).forEach(function(it){ if(it.ts>=t0)today.push(it); else if(it.ts>=w0)week.push(it); else earlier.push(it); });
  return { today:today, week:week, earlier:earlier, total:items.length };
}
window.wiaTimeline=wiaTimeline;

/* ── Modül 8 — Personal Recommendations ── */
function wiaRecommendations(b){
  b=b||wiaBase();
  var best=(typeof wcoRecommend==='function')?(wcoRecommend(null,5)||[]):[];
  var needsReview=b.list.filter(function(q){ return (q.favorite||q.pinned)&&_wiaTs(q.lastShownAt)>0&&(b.now-_wiaTs(q.lastShownAt))>30*_WIA_DAY; }).slice(0,5).map(_wiaLabel);
  var hiddenGems=b.list.filter(function(q){ return (Number(q.showCount)||0)===0&&(Number(q.priority)||3)>=4; }).slice(0,5).map(_wiaLabel);
  var forgottenFav=b.list.filter(function(q){ return q.favorite&&(Number(q.showCount)||0)===0; }).slice(0,5).map(_wiaLabel);
  var goalAlign=best.filter(function(r){return r.matchedGoal;}).map(function(r){return {id:r.id,quote:r.quote,goal:r.matchedGoal};});
  var decAlign=best.filter(function(r){return r.matchedDecision;}).map(function(r){return {id:r.id,quote:r.quote,decision:r.matchedDecision};});
  var neverRead=b.list.filter(function(q){ return (Number(q.showCount)||0)===0; }).slice(0,5).map(_wiaLabel);
  return { todaysBest5:best, needsReview:needsReview, hiddenGems:hiddenGems, forgottenFavorites:forgottenFav,
    goalAlignment:goalAlign, decisionAlignment:decAlign, neverRead:neverRead };
}
window.wiaRecommendations=wiaRecommendations;

/* ── UI: Executive Insight Center (design-system, erişilebilir, responsive) ── */
function _wiaCard(label,val,icon,color,sub){
  return '<div class="card" style="padding:10px 12px;flex:1 1 140px;min-width:128px;max-width:100%">'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+_wiaIc(icon,13,color)+'<span style="font-size:9.5px;color:var(--t3);font-weight:600">'+_wiae(label)+'</span></div>'+
    '<div style="font-size:18px;font-weight:800;color:'+color+';line-height:1.15;word-break:break-word">'+_wiae(val)+'</div>'+
    (sub?'<div style="font-size:9px;color:var(--t3);margin-top:2px">'+_wiae(sub)+'</div>':'')+'</div>';
}
function _wiaSparkline(vals){
  if(!vals||!vals.length)return '';
  var w=112,h=26,max=Math.max.apply(null,vals.concat([1])),step=vals.length>1?w/(vals.length-1):w;
  var pts=vals.map(function(v,i){ return (i*step).toFixed(1)+','+(h-(v/max)*(h-4)-2).toFixed(1); }).join(' ');
  return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" style="max-width:100%;overflow:visible" role="img" aria-label="Haftalık okuma eğilimi">'+
    '<polyline points="'+pts+'" fill="none" stroke="var(--blue)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}
function _wiaChip(label,val,color){ return '<span class="pill" style="font-size:9.5px;background:var(--s2);color:'+(color||'var(--t2)')+'">'+_wiae(label)+': <b>'+_wiae(val)+'</b></span>'; }
function _wiaSection(title,icon,inner,open){
  return '<details'+(open?' open':'')+' style="margin-top:8px;max-width:100%"><summary tabindex="0" style="cursor:pointer;font-size:11.5px;font-weight:800;color:var(--t2);padding:3px 0;display:flex;align-items:center;gap:6px">'+_wiaIc(icon,13,'var(--blue)')+_wiae(title)+'</summary><div style="margin-top:8px">'+inner+'</div></details>';
}
function wiaExecutiveInsightCenterHtml(){
  if(!_wiaActive().length)return '';
  var b=wiaBase();
  var d=wiaExecutiveDashboard(), eng=wiaEngagementStats(b), wr=wiaWeeklyReview(b);
  var MOM={improving:'Yükseliyor',stable:'Dengeli',idle:'Durgun'};
  var h='<div class="card wd-anim" style="padding:14px 16px;margin-bottom:14px;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2);max-width:100%">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">'+_wiaIc('chart',16,'var(--blue)')+'<h2 style="font-size:14px;font-weight:800;letter-spacing:.03em">Yönetici İçgörü Merkezi</h2>'+
    '<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3);margin-left:auto">'+_wiaSparkline(b.weekBuckets)+'</span></div>';
  // Executive Dashboard — 8 kart
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+=_wiaCard('Bilgi Sağlığı','%'+d.knowledgeHealth,'shield','var(--green)');
  h+=_wiaCard('Yansıma Skoru','%'+d.reflectionScore,'bulb','var(--orange)');
  h+=_wiaCard('Öğrenme İvmesi',MOM[d.learningMomentum]||d.learningMomentum,'flame','var(--blue)');
  h+=_wiaCard('Karar Kapsamı','%'+d.decisionCoverage,'git','var(--purple)');
  h+=_wiaCard('Kategori Dengesi','%'+d.categoryBalance,'layers','var(--t2)');
  h+=_wiaCard('Knowledge Score','%'+d.knowledgeScore,'chk','var(--green)');
  h+=_wiaCard('Koç Başarısı','%'+d.coachSuccess,'target','var(--blue)');
  h+=_wiaCard('Haftalık Odak',String(d.weeklyFocus).slice(0,26),'star','var(--orange)');
  h+='</div>';
  // Reflection prompt
  var rp=wiaReflectionPrompt();
  if(rp){ h+='<div class="card" style="padding:11px 13px;margin-top:10px;border:1px solid var(--s2);max-width:100%">';
    h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">'+_wiaIc('bulb',13,'var(--orange)')+'<span style="font-size:10.5px;font-weight:800;color:var(--t2)">Bugünün Yansıması</span></div>';
    h+='<p style="font-size:12.5px;font-style:italic;line-height:1.5;color:var(--t);word-break:break-word">&ldquo;'+_wiae(rp.quote)+'&rdquo;</p>';
    h+='<p style="font-size:11.5px;font-weight:700;color:var(--blue);margin-top:6px;word-break:break-word">'+_wiaIc('help',12,'var(--blue)')+' '+_wiae(rp.prompt)+'</p>';
    if(rp.relatedGoal)h+='<p style="font-size:10px;color:var(--t3);margin-top:3px">İlgili hedef: '+_wiae(rp.relatedGoal)+'</p>';
    h+='<div style="margin-top:7px"><button class="btn btn-g btn-sm" data-id="'+_wiae(String(rp.id))+'" onclick="wqToggleReflect(this.dataset.id)" title="Bunu düşündüm">'+_wiaIc('chk',11,'var(--green)')+' Bunu düşündüm</button></div>';
    h+='</div>'; }
  // Learning Gaps
  var gaps=wiaLearningGaps(b);
  if(gaps.length){ var gi=''; gaps.slice(0,6).forEach(function(g){ gi+='<div style="margin-top:5px"><span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--orange)">'+_wiae(g.label)+' ('+g.count+')</span>'+
      (g.items&&g.items.length?'<span style="font-size:10px;color:var(--t3);margin-left:6px">'+_wiae(g.items.slice(0,3).join(' · '))+'</span>':'')+'</div>'; });
    h+=_wiaSection('Öğrenme Boşlukları','alert',gi,false); }
  // Weekly Review
  var wi='<div style="display:flex;gap:5px;flex-wrap:wrap">'+
    _wiaChip('En Güçlü',wr.strongestCategory,'var(--green)')+_wiaChip('En Zayıf',wr.weakestCategory,'var(--orange)')+
    _wiaChip('En Gelişen',wr.biggestImprovement,'var(--blue)')+_wiaChip('İvme',MOM[wr.knowledgeMomentum]||wr.knowledgeMomentum,'var(--t2)')+
    _wiaChip('Önerilen Odak',String(wr.recommendedFocus).slice(0,24),'var(--purple)')+'</div>';
  h+=_wiaSection('Haftalık Değerlendirme','calendar',wi,false);
  // Recommendations
  var rec=wiaRecommendations(b); var ri='';
  function recBlock(title,arr,fld){ if(!arr||!arr.length)return ''; var s='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:6px 0 3px">'+_wiae(title)+'</p><div style="display:flex;flex-direction:column;gap:3px">';
    arr.slice(0,5).forEach(function(x){ var txt=fld?(x[fld]||x.quote):x; s+='<div style="font-size:10.5px;color:var(--t2);word-break:break-word">• '+_wiae(String(txt).slice(0,72))+'</div>'; }); return s+'</div>'; }
  ri+=recBlock('Bugünün En İyi 5',rec.todaysBest5,'quote');
  ri+=recBlock('Gözden Geçir',rec.needsReview);
  ri+=recBlock('Gizli Cevherler',rec.hiddenGems);
  ri+=recBlock('Unutulmuş Favoriler',rec.forgottenFavorites);
  ri+=recBlock('Hiç Okunmayan',rec.neverRead);
  h+=_wiaSection('Kişisel Öneriler','star',ri,false);
  // Timeline
  var tl=wiaTimeline(b); var KIND={reflected:'💡 Düşündürdü',favorited:'★ Favori',pinned:'Sabit',shown:'Gösterildi'};
  function tlBlock(title,arr){ if(!arr||!arr.length)return ''; var s='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:6px 0 3px">'+_wiae(title)+'</p><div style="display:flex;flex-direction:column;gap:3px">';
    arr.slice(0,8).forEach(function(it){ s+='<div style="font-size:10.5px;color:var(--t2);word-break:break-word"><span style="color:var(--t3)">'+_wiae(KIND[it.kind]||it.kind)+'</span> · '+_wiae(String(it.quote).slice(0,60))+'</div>'; }); return s+'</div>'; }
  var ti=tlBlock('Bugün',tl.today)+tlBlock('Bu Hafta',tl.week)+tlBlock('Daha Önce',tl.earlier);
  if(!ti)ti='<p style="font-size:10.5px;color:var(--t3)">Henüz etkinlik yok.</p>';
  h+=_wiaSection('İçgörü Zaman Çizelgesi','clock',ti,false);
  h+='</div>';
  return h;
}
window.wiaExecutiveInsightCenterHtml=wiaExecutiveInsightCenterHtml;
