/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Phase 7 P1 — GOAL ANALYTICS & INSIGHTS (TAMAMEN TÜRETİLMİŞ)
   Tek kaynaklar: D.goals · D.goalCheckIns · D.relations (hepsi SALT OKUNUR).
   Yeni koleksiyon / alan / sync / backup / Firebase YOK. Hiçbir değer kaydedilmez.
   Mevcut türetilmiş okuyucular yeniden kullanılır (goalProgress/goalDaysRemaining/
   goalDueState/goalHealthStatus/goalConfidence/goalCheckIns/goalCheckInTrend/
   goalDependencies). Grafik: yalnız inline-SVG + progBar. D'ye 0 mutasyon.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Salt-okunur yardımcılar ── */
function _anGoals(){ return Array.isArray(D.goals)?D.goals:[]; }
function _anActive(){ return _anGoals().filter(function(g){ return g&&g.status!=='done'; }); }
function _anGoalOf(x){ return (x&&typeof x==='object'&&x.id!=null&&x.title!=null)?x:_anGoals().filter(function(g){return String(g.id)===String(x);})[0]||null; }
function _anProgress(g){ return (typeof goalProgress==='function')?goalProgress(g):0; }
function _anChecks(gid){ return (typeof goalCheckIns==='function')?goalCheckIns(gid):[]; } // DESC (checkInDate)
function _anDayFromStr(s){ var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||'')); if(!m)return null; return Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/86400000); }
function _anToday(now){ var d=now?(now instanceof Date?now:new Date(now)):new Date(); if(isNaN(d.getTime()))d=new Date(); return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000); }
/* Bir check-in'in türetilmiş ilerlemesi: progressPct öncelikli; yoksa metricValue→goalCheckInProgress. */
function _anCheckProgress(c,g){
  if(!c)return null;
  if(c.progressPct!=null&&c.progressPct!=='')return Math.max(0,Math.min(100,Number(c.progressPct)));
  if(c.metricValue!=null&&c.metricValue!==''&&typeof goalCheckInProgress==='function'){ var p=goalCheckInProgress(g,c.metricValue); return p==null?null:p; }
  return null;
}

/* ── Velocity: ilerleme %/gün (ilk↔son geçerli veri noktası; <2 nokta → 0) ── */
function goalVelocity(x,now){
  var g=_anGoalOf(x); if(!g)return 0;
  var asc=_anChecks(g.id).slice().reverse(); // ASC (checkInDate)
  var pts=[];
  asc.forEach(function(c){ var p=_anCheckProgress(c,g), d=_anDayFromStr(c.checkInDate); if(p!=null&&d!=null)pts.push({d:d,p:p}); });
  if(pts.length<2)return 0;
  var a=pts[0], b=pts[pts.length-1];
  var span=b.d-a.d; if(span<=0)return 0;
  return Math.round(((b.p-a.p)/span)*100)/100; // 2 ondalık
}
window.goalVelocity=goalVelocity;

/* ── Momentum: son iki check-in eğilimi (mevcut goalCheckInTrend) ── */
function goalMomentum(x){
  var g=_anGoalOf(x); if(!g)return {state:'unknown',delta:null,score:0};
  var t=(typeof goalCheckInTrend==='function')?goalCheckInTrend(g.id):{state:'unknown',progressDelta:null,metricDelta:null};
  var delta=(t.progressDelta!=null)?t.progressDelta:t.metricDelta;
  var score=0;
  if(t.state==='improving')score=Math.max(1,Math.min(100,Math.abs(Number(delta)||1)));
  else if(t.state==='declining')score=-Math.max(1,Math.min(100,Math.abs(Number(delta)||1)));
  return {state:t.state,delta:(delta==null?null:Number(delta)),score:score};
}
window.goalMomentum=goalMomentum;

/* ── Consistency: check-in aralıklarının düzenliliği (0–100; CV tabanlı; <2 kayıt → 0) ── */
function goalConsistency(x){
  var g=_anGoalOf(x); if(!g)return 0;
  var asc=_anChecks(g.id).slice().reverse().map(function(c){return _anDayFromStr(c.checkInDate);}).filter(function(d){return d!=null;});
  if(asc.length<2)return 0;
  var iv=[]; for(var i=1;i<asc.length;i++){ var d=asc[i]-asc[i-1]; if(d>=0)iv.push(d); }
  if(!iv.length)return 0;
  var mean=iv.reduce(function(a,b){return a+b;},0)/iv.length;
  if(mean===0)return 100;
  var vv=iv.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/iv.length;
  var cv=Math.sqrt(vv)/mean;
  return Math.max(0,Math.min(100,Math.round(100*(1-cv))));
}
window.goalConsistency=goalConsistency;

/* ── Son check-in yaşı / stale gün ── */
function goalLastCheckInAge(x,now){
  var g=_anGoalOf(x); if(!g)return null;
  var latest=(typeof latestGoalCheckIn==='function')?latestGoalCheckIn(g.id):(_anChecks(g.id)[0]||null);
  if(!latest)return null;
  var d=_anDayFromStr(latest.checkInDate); if(d==null)return null;
  return Math.max(0,_anToday(now)-d);
}
function goalStaleDays(x,now){
  var g=_anGoalOf(x); if(!g)return null;
  var age=goalLastCheckInAge(g,now);
  if(age!=null)return age;
  var cd=_anDayFromStr(g.createdAt); // hiç check-in yok → oluşturulmadan bu yana
  if(cd==null)return null;
  return Math.max(0,_anToday(now)-cd);
}
window.goalLastCheckInAge=goalLastCheckInAge; window.goalStaleDays=goalStaleDays;

/* ── Check-in sıklığı: ortalama gün/aralık (null=yetersiz) ── */
function goalCheckInFrequency(x){
  var g=_anGoalOf(x); if(!g)return null;
  var asc=_anChecks(g.id).slice().reverse().map(function(c){return _anDayFromStr(c.checkInDate);}).filter(function(d){return d!=null;});
  if(asc.length<2)return null;
  var span=asc[asc.length-1]-asc[0]; if(span<=0)return null;
  return Math.round((span/(asc.length-1))*10)/10;
}
window.goalCheckInFrequency=goalCheckInFrequency;

/* ── Risk puanı: 0–100 kompozit (tamamlanan → 0) ── */
function goalRiskScore(x,now){
  var g=_anGoalOf(x); if(!g)return 0;
  if(g.status==='done'||_anProgress(g)>=100)return 0;
  var r=0;
  var hs=(typeof goalHealthStatus==='function')?goalHealthStatus(g):'on_track';
  if(hs==='at_risk')r+=20; else if(hs==='off_track')r+=30; else if(hs==='blocked')r+=35;
  if(typeof goalIsBlocked==='function'&&goalIsBlocked(g.id))r+=15;
  var cf=(typeof goalConfidence==='function')?goalConfidence(g):'medium';
  if(cf==='low')r+=15; else if(cf==='medium')r+=5;
  var due=(typeof goalDueState==='function')?goalDueState(g,now):'none';
  if(due==='overdue')r+=30; else if(due==='today'||due==='tomorrow')r+=15; else if(due==='this_week')r+=10; else if(due==='due_soon')r+=5;
  var stale=goalStaleDays(g,now);
  if(stale!=null){ if(stale>=30)r+=20; else if(stale>=14)r+=10; else if(stale>=7)r+=5; }
  if(goalVelocity(g,now)<=0)r+=15;
  if(goalMomentum(g).state==='declining')r+=10;
  return Math.max(0,Math.min(100,r));
}
window.goalRiskScore=goalRiskScore;

/* ── Tamamlanma tahmini (velocity tabanlı; deadline'a göre başarır mı) ── */
function goalForecast(x,now){
  var g=_anGoalOf(x); if(!g)return {state:'unknown',velocity:0,daysToComplete:null,forecastDay:null,willMakeDeadline:null,daysRemaining:null};
  var prog=_anProgress(g), v=goalVelocity(g,now);
  var dr=(typeof goalDaysRemaining==='function')?goalDaysRemaining(g,now):null;
  if(g.status==='done'||prog>=100)return {state:'done',velocity:v,daysToComplete:0,forecastDay:_anToday(now),willMakeDeadline:true,daysRemaining:dr};
  if(v<=0)return {state:'stalled',velocity:v,daysToComplete:null,forecastDay:null,willMakeDeadline:(dr==null?null:false),daysRemaining:dr};
  var days=Math.ceil((100-prog)/v);
  var fday=_anToday(now)+days;
  var make=(dr==null)?null:(days<=dr);
  return {state:(make===false?'at_risk':'on_track'),velocity:v,daysToComplete:days,forecastDay:fday,willMakeDeadline:make,daysRemaining:dr};
}
window.goalForecast=goalForecast;

/* ── Durma eğilimi (stale + düşük velocity + düşen momentum) ── */
function goalStallTendency(x,now){
  var g=_anGoalOf(x); if(!g)return {stalled:false,score:0};
  if(g.status==='done')return {stalled:false,score:0};
  var stale=goalStaleDays(g,now)||0, v=goalVelocity(g,now), mo=goalMomentum(g);
  var s=0; if(stale>=30)s+=2; else if(stale>=14)s+=1; if(v<=0)s+=1; if(mo.state==='declining')s+=1;
  return {stalled:s>=2,score:s};
}
window.goalStallTendency=goalStallTendency;

/* ── Stale hedefler (varsayılan >30 gün, aktif) ── */
function goalStaleGoals(days,now){
  var lim=(days==null)?30:Number(days);
  return _anActive().filter(function(g){ var s=goalStaleDays(g,now); return s!=null&&s>lim; })
    .map(function(g){ return {goal:g,staleDays:goalStaleDays(g,now)}; })
    .sort(function(a,b){ return b.staleDays-a.staleDays; });
}
window.goalStaleGoals=goalStaleGoals;

/* ── Tek hedef analitiği (tüm türetimler bir arada) ── */
function goalAnalyticsFor(x,now){
  var g=_anGoalOf(x); if(!g)return null;
  return {
    id:g.id, title:g.title, status:g.status, cat:g.cat,
    progress:_anProgress(g),
    velocity:goalVelocity(g,now),
    momentum:goalMomentum(g),
    consistency:goalConsistency(g),
    lastCheckInAge:goalLastCheckInAge(g,now),
    staleDays:goalStaleDays(g,now),
    checkInCount:(typeof goalCheckInCount==='function')?goalCheckInCount(g.id):_anChecks(g.id).length,
    frequency:goalCheckInFrequency(g),
    risk:goalRiskScore(g,now),
    forecast:goalForecast(g,now),
    stall:goalStallTendency(g,now),
    due:(typeof goalDueState==='function')?goalDueState(g,now):'none',
    daysRemaining:(typeof goalDaysRemaining==='function')?goalDaysRemaining(g,now):null,
    depCount:(typeof goalDependencies==='function')?(goalDependencies(g.id)||[]).length:0
  };
}
function goalAnalytics(now){ return _anActive().map(function(g){ return goalAnalyticsFor(g,now); }).filter(Boolean); }
window.goalAnalyticsFor=goalAnalyticsFor; window.goalAnalytics=goalAnalytics;

/* ── Insights: salt-okunur öneriler (per-goal id verilirse o hedef; yoksa tümü) ── */
function _anGoalInsights(g,now){
  var out=[], a=goalAnalyticsFor(g,now); if(!a)return out;
  var title=String(g.title||'').slice(0,60);
  if(a.staleDays!=null&&a.staleDays>=30)out.push({goalId:g.id,type:'no_progress',severity:'high',text:title+': Son '+a.staleDays+' gündür ilerleme yok.'});
  if(a.lastCheckInAge!=null&&a.frequency!=null&&a.lastCheckInAge>a.frequency*2)out.push({goalId:g.id,type:'checkin_late',severity:'medium',text:title+': Check-in gecikmiş ('+a.lastCheckInAge+' gün).'});
  else if(a.lastCheckInAge!=null&&a.lastCheckInAge>=14&&a.frequency==null)out.push({goalId:g.id,type:'checkin_late',severity:'medium',text:title+': Check-in gecikmiş ('+a.lastCheckInAge+' gün).'});
  if(['today','tomorrow','this_week','due_soon'].indexOf(a.due)>=0)out.push({goalId:g.id,type:'deadline_near',severity:(a.due==='due_soon'?'low':'medium'),text:title+': Deadline yaklaşmış ('+(a.daysRemaining!=null?a.daysRemaining+' gün':'')+').'});
  if(a.due==='overdue')out.push({goalId:g.id,type:'overdue',severity:'high',text:title+': Deadline geçmiş.'});
  if(a.risk>=60)out.push({goalId:g.id,type:'risk_up',severity:'high',text:title+': Risk yükselmiş (puan '+a.risk+').'});
  if(a.momentum.state==='declining')out.push({goalId:g.id,type:'momentum_down',severity:'medium',text:title+': Momentum düşmüş.'});
  if(a.depCount>=3)out.push({goalId:g.id,type:'many_deps',severity:'low',text:title+': Çok bağımlılık var ('+a.depCount+').'});
  if(a.momentum.state==='improving'&&a.consistency>=60)out.push({goalId:g.id,type:'improving',severity:'good',text:title+': Sürekli gelişiyor.'});
  return out;
}
function goalInsights(x,now){
  if(x!=null){ var g=_anGoalOf(x); return g?_anGoalInsights(g,now):[]; }
  var all=[]; _anActive().forEach(function(g){ all=all.concat(_anGoalInsights(g,now)); });
  var rank={high:0,medium:1,low:2,good:3};
  return all.sort(function(a,b){ return (rank[a.severity]-rank[b.severity]); });
}
window.goalInsights=goalInsights;

/* ── Dashboard toplu istatistik ── */
function analyticsDashboardStats(now){
  var A=goalAnalytics(now), N=6;
  var withData=A.filter(function(a){return a.checkInCount>=2;});
  var byVelDesc=withData.slice().sort(function(a,b){return b.velocity-a.velocity;});
  var byVelAsc=withData.slice().sort(function(a,b){return a.velocity-b.velocity;});
  return {
    total:A.length,
    avgProgress:A.length?Math.round(A.reduce(function(s,a){return s+a.progress;},0)/A.length):0,
    avgRisk:A.length?Math.round(A.reduce(function(s,a){return s+a.risk;},0)/A.length):0,
    risky:A.filter(function(a){return a.risk>=50;}).sort(function(a,b){return b.risk-a.risk;}).slice(0,N),
    fastest:byVelDesc.filter(function(a){return a.velocity>0;}).slice(0,N),
    slowest:byVelAsc.slice(0,N),
    noCheckIn:A.filter(function(a){return a.checkInCount===0;}).slice(0,N),
    upcoming:A.filter(function(a){return ['today','tomorrow','this_week','due_soon'].indexOf(a.due)>=0;}).sort(function(a,b){return (a.daysRemaining==null?1e9:a.daysRemaining)-(b.daysRemaining==null?1e9:b.daysRemaining);}).slice(0,N),
    willSucceed:A.filter(function(a){return a.forecast.willMakeDeadline===true&&a.status!=='done';}).slice(0,N),
    willDelay:A.filter(function(a){return a.forecast.willMakeDeadline===false;}).slice(0,N),
    momentum:A.slice().sort(function(a,b){return b.momentum.score-a.momentum.score;}).slice(0,N),
    velocity:byVelDesc.slice(0,N)
  };
}
window.analyticsDashboardStats=analyticsDashboardStats;

/* ── Görsel yardımcılar (inline-SVG + progBar; chart library YOK) ── */
function _ane(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _anIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz,cl):''; }
function _anBar(p,c){ return (typeof progBar==='function')?progBar(p,c):''; }
/* Küçük inline-SVG sparkline (check-in ilerleme serisi). */
function analyticsSparkline(x,w,h){
  var g=_anGoalOf(x); if(!g)return '';
  w=w||120; h=h||28;
  var asc=_anChecks(g.id).slice().reverse();
  var pts=[]; asc.forEach(function(c){ var p=_anCheckProgress(c,g); if(p!=null)pts.push(p); });
  if(pts.length<2)return '<span style="font-size:9px;color:var(--t3)">yetersiz veri</span>';
  var n=pts.length, dx=w/(n-1);
  var d=pts.map(function(p,i){ var y=h-(Math.max(0,Math.min(100,p))/100)*(h-2)-1; return (i===0?'M':'L')+(i*dx).toFixed(1)+' '+y.toFixed(1); }).join(' ');
  var up=pts[n-1]>=pts[0], col=up?'var(--green)':'var(--red)';
  return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" style="display:block"><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
window.analyticsSparkline=analyticsSparkline;

function _anRiskColor(r){ return r>=66?'var(--red)':r>=40?'var(--orange)':'var(--green)'; }
function _anGoalRow(a){
  var open='onclick="if(typeof openGoalDetail===\'function\')openGoalDetail('+(typeof a.id==='number'?a.id:JSON.stringify(String(a.id)))+')" style="cursor:pointer"';
  var h='<div class="card" '+open+' style="padding:10px 13px">';
  h+='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:5px"><span style="font-size:12.5px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_ane(a.title)+'</span>';
  h+='<span class="pill" style="font-size:9px;background:var(--s2);color:'+_anRiskColor(a.risk)+'">Risk '+a.risk+'</span></div>';
  h+=_anBar(a.progress);
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:9.5px;color:var(--t3)">';
  h+='<span>İlerleme %'+a.progress+'</span><span>Hız '+a.velocity+'/gün</span><span>Momentum '+_ane(a.momentum.state)+'</span>';
  if(a.staleDays!=null)h+='<span>Durgun '+a.staleDays+'g</span>';
  h+='</div></div>';
  return h;
}
function _anSection(title,icon,items,empty){
  var h='<div style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">'+_anIc(icon,14,'var(--blue)')+'<h3 style="font-size:13px;font-weight:800">'+_ane(title)+'</h3></div>';
  if(!items||!items.length){ h+='<p style="font-size:11px;color:var(--t3)">'+_ane(empty||'Kayıt yok.')+'</p></div>'; return h; }
  h+='<div style="display:flex;flex-direction:column;gap:8px">'+items.map(_anGoalRow).join('')+'</div></div>';
  return h;
}
function analyticsDashboardHtml(now){
  var s=analyticsDashboardStats(now);
  if(!s.total)return '<div class="fade"><div class="sh"><div><h1 class="sh-t">Analitik</h1><p class="sh-sub">Hedeflerden türetilmiş içgörüler.</p></div></div><div class="card" style="padding:44px;text-align:center;color:var(--t3)">'+_anIc('kpi',30,'var(--t3)')+'<p style="font-weight:700;font-size:15px;margin-top:8px">Aktif hedef yok.</p></div></div>';
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Analitik</h1><p class="sh-sub">Hedef, check-in ve bağımlılıklardan türetilmiş içgörüler. Salt okunur.</p></div></div>';
  // özet kartlar
  h+='<div class="g4" style="margin-bottom:16px">';
  h+=(typeof statCard==='function'?statCard('Aktif Hedef',s.total,'tgt','var(--blue)'):'');
  h+=(typeof statCard==='function'?statCard('Ort. İlerleme','%'+s.avgProgress,'zap','var(--green)'):'');
  h+=(typeof statCard==='function'?statCard('Ort. Risk',s.avgRisk,'flame',_anRiskColor(s.avgRisk)):'');
  h+=(typeof statCard==='function'?statCard('Riskli',s.risky.length,'csq','var(--red)'):'');
  h+='</div>';
  // insights
  var ins=goalInsights(null,now);
  if(ins.length){
    h+='<div class="card" style="padding:12px 14px;margin-bottom:16px"><div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">'+_anIc('brain',14,'var(--purple)')+'<h3 style="font-size:13px;font-weight:800">Öneriler</h3></div><div style="display:flex;flex-direction:column;gap:5px">';
    ins.slice(0,12).forEach(function(i){ var c=i.severity==='high'?'var(--red)':i.severity==='medium'?'var(--orange)':i.severity==='good'?'var(--green)':'var(--t3)';
      h+='<div style="display:flex;gap:7px;align-items:flex-start;font-size:11.5px;color:var(--t2)"><span style="color:'+c+';font-weight:800">•</span><span>'+_ane(i.text)+'</span></div>'; });
    h+='</div></div>';
  }
  // bölümler
  h+='<div class="g2">';
  h+='<div>'+_anSection('Riskli Hedefler','csq',s.risky,'Riskli hedef yok.')+_anSection('Yaklaşan Deadline','ref',s.upcoming,'Yaklaşan deadline yok.')+_anSection('En Hızlı İlerleyenler','zap',s.fastest,'Yeterli veri yok.')+_anSection('Momentum','flame',s.momentum,'Veri yok.')+'</div>';
  h+='<div>'+_anSection('Check-in Yapılmayanlar','pen',s.noCheckIn,'Tümünde check-in var.')+_anSection('En Yavaş İlerleyenler','ar',s.slowest,'Yeterli veri yok.')+_anSection('Tahmini Başarılacak','chk',s.willSucceed,'Tahmin için veri yok.')+_anSection('Tahmini Gecikecek','csq',s.willDelay,'Gecikme öngörülmüyor.')+'</div>';
  h+='</div></div>';
  return h;
}
window.analyticsDashboardHtml=analyticsDashboardHtml;
function renderAnalytics(){ if(typeof sh==='function')sh('pinner',analyticsDashboardHtml()); }
window.renderAnalytics=renderAnalytics;
