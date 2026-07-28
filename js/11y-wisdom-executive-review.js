/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom P8 — EXECUTIVE REVIEW & DECISION INTELLIGENCE
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK · YAZDIRILABİLİR)

   Tek profesyonel "Yönetici İncelemesi" workspace'i: yönetici raporlama + karar
   zekâsı + öğrenme ivmesi + öncelikli aksiyonlar — kalabalık Wisdom sayfasına
   ikinci bir tam panel EKLEMEDEN, kompakt bir giriş noktasından açılan sekmeli
   çalışma alanı (Genel / Kararlar / Öğrenme / Raporlar).

   Tek okuma girişi: wqList()/wqById() + P4 (wlc*), P5 (wkg*), P6 (wco*), P7 (wia*)
   çıktıları YENİDEN KULLANILIR. Tek paylaşılan türetilmiş snapshot (imza-tabanlı
   memoize) → sekme geçişi O(1), her sekmede tam kütüphane taraması YOK. Sharded
   runtime cache'ine veya legacy söz dizisine doğrudan erişmez; migration/backup/
   restore iç yapılarına dokunmaz. Yeni koleksiyon/payload/settings/write/network/
   realtime-listener YOK. Yalnız yazdırma
   window.print() (indirme/yükleme yok). Design-system, erişilebilir, responsive.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── küçük yardımcılar ── */
function _were(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _werIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _werTs(x){ if(x==null||x==='')return 0; var t=Date.parse(x); if(!isNaN(t))return t; var n=Number(x); return isNaN(n)?0:n; }
function _werNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr'); }
function _werClamp(v){ return Math.max(0,Math.min(100,Math.round(v))); }
var _WER_DAY=864e5;
var WER_PERIODS=[['week','Bu Hafta',7],['month','Bu Ay',30],['quarter','Bu Çeyrek',91],['all','Tüm Zamanlar',null]];
function _werPeriodDef(p){ for(var i=0;i<WER_PERIODS.length;i++)if(WER_PERIODS[i][0]===p)return WER_PERIODS[i]; return WER_PERIODS[0]; }

/* açık kararlar (tek okuma) */
function _werOpenDecisions(){ var d=(typeof decList==='function')?decList():(Array.isArray(D.decisions)?D.decisions:[]); return d.filter(function(x){ return x&&x.status==='open'; }); }
function _werRel(type,id,targetType){ if(typeof getRelatedEntities!=='function')return []; try{ return getRelatedEntities(type,id).filter(function(x){return x&&x.entity&&x.entity.type===targetType;}).map(function(x){return x.entity;}); }catch(e){ return []; } }

/* ── Karar hazırlık skoru (deterministik 0–100) ── */
function werDecisionReadiness(decision){
  if(!decision)return 0;
  var w=_werRel('decision',decision.id,'wisdomQuote');
  var p=_werRel('decision',decision.id,'principle');
  var g=_werRel('decision',decision.id,'goal');
  var reflectedRatio=0;
  if(w.length){ var r=0; w.forEach(function(e){ var q=(typeof wqById==='function')?wqById(e.id):null; if(q&&q.reflected)r++; }); reflectedRatio=r/w.length; }
  var coachRel=_werDecisionCoachRelevance(decision);
  var score=Math.min(w.length,3)*12+Math.min(p.length,2)*10+Math.min(g.length,2)*8+reflectedRatio*20+coachRel*20;
  return _werClamp(score);
}
window.werDecisionReadiness=werDecisionReadiness;
function _werDecisionTokens(d){ return _werNorm([d.title,d.decision,d.context,(d.tags||[]).join(' ')].join(' ')).replace(/[^0-9a-zçğıöşü\s]/g,' ').split(/\s+/).filter(function(t){return t.length>=3;}); }
function _werDecisionCoachRelevance(decision){
  var recs=(typeof wcoRecommend==='function')?(wcoRecommend(null,10)||[]):[];
  if(!recs.length)return 0;
  var dtok={}; _werDecisionTokens(decision).forEach(function(t){ dtok[t]=1; });
  var best=0;
  recs.forEach(function(r){ var qt=_werNorm(r.quote).replace(/[^0-9a-zçğıöşü\s]/g,' ').split(/\s+/); var ov=0; qt.forEach(function(t){ if(t.length>=3&&dtok[t])ov++; }); var rel=Math.min(1,ov/3)*0.6+(r.score||0)*0.4; if(rel>best)best=rel; });
  return best;
}

/* ── Karar zekâsı ── */
function werDecisionIntelligence(){
  return _werOpenDecisions().map(function(d){
    var w=_werRel('decision',d.id,'wisdomQuote'), p=_werRel('decision',d.id,'principle'), g=_werRel('decision',d.id,'goal');
    var readiness=werDecisionReadiness(d);
    var reflectedRatio=0; if(w.length){ var r=0; w.forEach(function(e){ var q=(typeof wqById==='function')?wqById(e.id):null; if(q&&q.reflected)r++; }); reflectedRatio=Math.round(r/w.length*100); }
    var gap=w.length===0?'İlişkili söz yok':(p.length===0?'İlke bağlanmamış':(reflectedRatio===0?'Hiç yansıtılmamış':''));
    var risk=readiness>=70?'Düşük Risk':(readiness>=40?'Orta Risk':'Yüksek Risk');
    return { id:d.id, title:String(d.title||d.decision||'').slice(0,120),
      relatedWisdom:w.map(function(e){return {id:e.id,label:String(e.label||'').slice(0,70)};}),
      relatedGoals:g.map(function(e){return e.label;}), relatedPrinciples:p.map(function(e){return e.label;}),
      knowledgeCoverage:w.length, reflectedRatio:reflectedRatio, readinessScore:readiness,
      unresolvedGap:gap, recommendedNextReading:_werNextReading(d), decisionRiskLabel:risk };
  });
}
window.werDecisionIntelligence=werDecisionIntelligence;
function _werNextReading(decision){
  var recs=(typeof wcoRecommend==='function')?(wcoRecommend(null,20)||[]):[];
  if(!recs.length)return '';
  var dtok={}; _werDecisionTokens(decision).forEach(function(t){ dtok[t]=1; });
  var best=null,bo=-1;
  recs.forEach(function(r){ var qt=_werNorm(r.quote).replace(/[^0-9a-zçğıöşü\s]/g,' ').split(/\s+/); var ov=0; qt.forEach(function(t){ if(t.length>=3&&dtok[t])ov++; }); if(ov>bo){ bo=ov; best=r; } });
  return best?String(best.quote).slice(0,70):(recs[0]?String(recs[0].quote).slice(0,70):'');
}

/* ── Öğrenme ivmesi (P7 haftalık kovaları yeniden kullanılır) ── */
function werLearningMomentum(){
  var base=(typeof wiaBase==='function')?wiaBase():{weekBuckets:[0,0,0,0,0,0,0,0]};
  var wr=(typeof wiaWeeklyReview==='function')?wiaWeeklyReview(base):{};
  var gaps=(typeof wiaLearningGaps==='function')?wiaLearningGaps(base):[];
  var b=base.weekBuckets||[0,0,0,0,0,0,0,0];
  var current=b[7]||0, previous=b[6]||0, change=current-previous;
  var trend=change>0?'improving':(change<0?'declining':'stable');
  var neglected=gaps.length?gaps[0].label:'—';
  return { current:current, previous:previous, change:change, trend:trend,
    strongestArea:wr.strongestCategory||'—', weakestArea:wr.weakestCategory||'—',
    neglectedArea:neglected, recommendedFocus:wr.recommendedFocus||wr.weakestCategory||'—' };
}
window.werLearningMomentum=werLearningMomentum;

/* ── Executive snapshot (period-kapsamlı) ── */
function werBuildExecutiveSnapshot(period){
  period=period||_werPeriod;
  var pdef=_werPeriodDef(period);
  var base=(typeof wiaBase==='function')?wiaBase():{list:[],total:0,now:Date.now()};
  var dash=(typeof wiaExecutiveDashboard==='function')?wiaExecutiveDashboard():{};
  var wr=(typeof wiaWeeklyReview==='function')?wiaWeeklyReview(base):{};
  var gaps=(typeof wiaLearningGaps==='function')?wiaLearningGaps(base):[];
  var recs=(typeof wcoRecommend==='function')?(wcoRecommend(null,1)||[]):[];
  var openDecs=_werOpenDecisions();
  var win=pdef[2]; var periodReads=win==null?base.read:base.list.filter(function(q){ var t=_werTs(q.lastShownAt); return t>0&&(base.now-t)<=win*_WER_DAY; }).length;
  return {
    period:period, periodLabel:pdef[1], periodReads:periodReads,
    knowledgeHealth:dash.knowledgeHealth||0, reflectionScore:dash.reflectionScore||0,
    learningMomentum:dash.learningMomentum||'idle', coachSuccess:dash.coachSuccess||0,
    categoryBalance:dash.categoryBalance||0, strongestCategory:wr.strongestCategory||'—',
    weakestCategory:wr.weakestCategory||'—', mostImportantGap:gaps.length?gaps[0].label:'—',
    topRecommendation:recs.length?recs[0].quote:'', openDecisionCount:openDecs.length,
    decisionCoverage:dash.decisionCoverage||0, suggestedWeeklyFocus:dash.weeklyFocus||wr.recommendedFocus||'—'
  };
}
window.werBuildExecutiveSnapshot=werBuildExecutiveSnapshot;

/* ── Öncelikli aksiyonlar (≤5) ── */
function werPriorityActions(){
  var base=(typeof wiaBase==='function')?wiaBase():{list:[],now:Date.now()};
  var recs=(typeof wcoRecommend==='function')?(wcoRecommend(null,10)||[]):[];
  var wr=(typeof wiaWeeklyReview==='function')?wiaWeeklyReview(base):{};
  var out=[];
  // 1) okunmamış yüksek-ilgili söz
  var unread=recs.filter(function(r){ var q=(typeof wqById==='function')?wqById(r.id):null; return q&&(Number(q.showCount)||0)===0; })[0];
  if(unread)out.push({ title:'Yüksek ilgili bir sözü oku', reason:unread.reason||'Bağlamınla güçlü örtüşüyor', entity:{type:'wisdomQuote',id:unread.id,label:String(unread.quote).slice(0,60)}, open:"openWqForm('"+_werJs(unread.id)+"')", priority:5 });
  // 2) unutulmuş favori
  var forgotten=base.list.filter(function(q){ return q.favorite&&_werTs(q.lastShownAt)>0&&(base.now-_werTs(q.lastShownAt))>30*_WER_DAY; })[0];
  if(forgotten)out.push({ title:'Unutulmuş bir favorini tekrar gör', reason:'30 günden uzun süredir görülmedi', entity:{type:'wisdomQuote',id:forgotten.id,label:String(forgotten.quote).slice(0,60)}, open:"openWqForm('"+_werJs(forgotten.id)+"')", priority:4 });
  // 3) koç önerisini yansıt
  var reflect=recs.filter(function(r){ var q=(typeof wqById==='function')?wqById(r.id):null; return q&&!q.reflected; })[0];
  if(reflect)out.push({ title:'Bir koç önerisi üzerine düşün', reason:'Yansıma serini güçlendirir', entity:{type:'wisdomQuote',id:reflect.id,label:String(reflect.quote).slice(0,60)}, open:"openWqForm('"+_werJs(reflect.id)+"')", priority:4 });
  // 4) zayıf kategoriyi güçlendir
  if(wr.weakestCategory&&wr.weakestCategory!=='—')out.push({ title:'Zayıf kategorini güçlendir: '+wr.weakestCategory, reason:'En düşük okuma yoğunluğu', entity:{type:'category',id:wr.weakestCategory,label:wr.weakestCategory}, open:"wqSetCat('"+_werJs(wr.weakestCategory)+"')", priority:3 });
  // 5) bilgisi eksik açık kararı destekle
  var di=werDecisionIntelligence().filter(function(d){ return d.readinessScore<50; }).sort(function(a,b){return a.readinessScore-b.readinessScore;})[0];
  if(di)out.push({ title:'Açık kararı bilgiyle destekle', reason:di.unresolvedGap||('Hazırlık %'+di.readinessScore), entity:{type:'decision',id:di.id,label:di.title}, open:"djOpenDetail('"+_werJs(di.id)+"')", priority:5 });
  out.sort(function(a,b){ if(b.priority!==a.priority)return b.priority-a.priority; return String(a.entity.id)<String(b.entity.id)?-1:(String(a.entity.id)>String(b.entity.id)?1:0); });
  return out.slice(0,5);
}
window.werPriorityActions=werPriorityActions;
function _werJs(s){ return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

/* ── Paylaşılan snapshot (imza-tabanlı memoize; sekme geçişi O(1)) ── */
var _WER_CACHE=null, _WER_SIG=null, _werPeriod='week', _werTab='overview', _werOpen=false;
function werInvalidate(){ _WER_CACHE=null; _WER_SIG=null; }
window.werInvalidate=werInvalidate;
function werSnapshot(period){
  period=period||_werPeriod;
  var base=(typeof wiaBase==='function')?wiaBase():{total:0,showTotal:0,reflected:0,favorite:0,pinned:0};
  var relN=Array.isArray(D.relations)?D.relations.length:0;
  var openN=_werOpenDecisions().length;
  var sig=[base.total,base.showTotal,base.reflected,base.favorite,base.pinned,relN,openN,period].join('|');
  if(_WER_CACHE&&_WER_SIG===sig)return _WER_CACHE;
  _WER_CACHE={ period:period, exec:werBuildExecutiveSnapshot(period), momentum:werLearningMomentum(),
    decisions:werDecisionIntelligence(), actions:werPriorityActions(),
    gaps:(typeof wiaLearningGaps==='function')?wiaLearningGaps():[],
    engagement:(typeof wiaEngagementStats==='function')?wiaEngagementStats():{} };
  _WER_SIG=sig; return _WER_CACHE;
}
window.werSnapshot=werSnapshot;

/* ── UI parçaları ── */
function _werCard(label,val,icon,color,sub){
  return '<div class="card" style="padding:10px 12px;flex:1 1 140px;min-width:126px;max-width:100%">'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+_werIc(icon,13,color)+'<span style="font-size:9.5px;color:var(--t3);font-weight:600">'+_were(label)+'</span></div>'+
    '<div style="font-size:18px;font-weight:800;color:'+color+';line-height:1.15;word-break:break-word">'+_were(val)+'</div>'+
    (sub?'<div style="font-size:9px;color:var(--t3);margin-top:2px">'+_were(sub)+'</div>':'')+'</div>';
}
var _WER_MOM={improving:'Yükseliyor',declining:'Geriliyor',stable:'Dengeli',idle:'Durgun'};
function _werOverviewHtml(s){
  var e=s.exec, h='';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+=_werCard('Bilgi Sağlığı','%'+e.knowledgeHealth,'shield','var(--green)');
  h+=_werCard('Yansıma Skoru','%'+e.reflectionScore,'bulb','var(--orange)');
  h+=_werCard('Öğrenme İvmesi',_WER_MOM[e.learningMomentum]||e.learningMomentum,'flame','var(--blue)');
  h+=_werCard('Koç Başarısı','%'+e.coachSuccess,'target','var(--blue)');
  h+=_werCard('Kategori Dengesi','%'+e.categoryBalance,'layers','var(--t2)');
  h+=_werCard('Karar Kapsamı','%'+e.decisionCoverage,'git','var(--purple)');
  h+='</div>';
  h+='<div class="card" style="padding:10px 13px;margin-top:9px;max-width:100%"><div style="font-size:10px;color:var(--t3);font-weight:700;margin-bottom:3px">Haftalık Odak</div><div style="font-size:12.5px;font-weight:700;color:var(--t);word-break:break-word">'+_werIc('star',13,'var(--orange)')+' '+_were(e.suggestedWeeklyFocus)+'</div></div>';
  h+='<p style="font-size:10.5px;color:var(--t3);font-weight:700;margin:11px 0 5px">İlk 5 Öncelikli Aksiyon</p>';
  h+=_werActionsHtml(s.actions);
  return h;
}
function _werActionsHtml(actions){
  if(!actions||!actions.length)return '<p style="font-size:10.5px;color:var(--t3)">Şimdilik önerilen aksiyon yok.</p>';
  var h='<div style="display:flex;flex-direction:column;gap:6px">';
  actions.forEach(function(a){
    h+='<div class="card" style="padding:9px 12px;max-width:100%;display:flex;gap:9px;align-items:flex-start">';
    h+='<span class="pill" style="flex-shrink:0;font-size:9px;background:var(--s2);color:var(--t2)">P'+a.priority+'</span>';
    h+='<div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:700;color:var(--t);word-break:break-word">'+_were(a.title)+'</div>';
    h+='<div style="font-size:10px;color:var(--t3);margin-top:2px;word-break:break-word">'+_were(a.reason)+'</div></div>';
    h+='<button class="btn btn-g btn-sm" style="flex-shrink:0" onclick="'+a.open+'" title="Aç">'+_werIc('arrow',11,'var(--t3)')+' Aç</button>';
    h+='</div>';
  });
  return h+'</div>';
}
function _werDecisionsHtml(s){
  if(!s.decisions.length)return '<p style="font-size:11px;color:var(--t3)">Açık karar yok. Karar Günlüğü\'nden karar ekleyebilirsin.</p>';
  var RISK={'Düşük Risk':'var(--green)','Orta Risk':'var(--orange)','Yüksek Risk':'var(--red)'};
  var h='<div style="display:flex;flex-direction:column;gap:8px">';
  s.decisions.forEach(function(d){
    h+='<div class="card" style="padding:11px 13px;max-width:100%">';
    h+='<div style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">';
    h+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--t);word-break:break-word">'+_were(d.title)+'</div></div>';
    h+='<span class="pill" style="flex-shrink:0;font-size:9.5px;background:var(--s2);color:'+(RISK[d.decisionRiskLabel]||'var(--t2)')+'">'+_were(d.decisionRiskLabel)+' · %'+d.readinessScore+'</span></div>';
    h+='<div style="margin-top:6px">'+((typeof progBar==='function')?progBar(d.readinessScore):'')+'</div>';
    h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px">';
    h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">'+_werIc('qt',10,'var(--blue)')+' '+d.relatedWisdom.length+' söz</span>';
    h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">'+_werIc('shield',10,'var(--purple)')+' '+d.relatedPrinciples.length+' ilke</span>';
    h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">'+_werIc('target',10,'var(--green)')+' '+d.relatedGoals.length+' hedef</span>';
    if(d.reflectedRatio)h+='<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">%'+d.reflectedRatio+' yansıtıldı</span>';
    h+='</div>';
    if(d.unresolvedGap)h+='<div style="font-size:10px;color:var(--orange);margin-top:5px">'+_werIc('alert',11,'var(--orange)')+' Eksik: '+_were(d.unresolvedGap)+'</div>';
    if(d.recommendedNextReading)h+='<div style="font-size:10px;color:var(--t3);margin-top:4px;word-break:break-word">Önerilen okuma: '+_were(d.recommendedNextReading)+'</div>';
    h+='<div style="margin-top:7px"><button class="btn btn-g btn-sm" data-id="'+_were(String(d.id))+'" onclick="djOpenDetail(this.dataset.id)" title="Kararı aç">'+_werIc('arrow',11,'var(--t3)')+' Kararı Aç</button></div>';
    h+='</div>';
  });
  return h+'</div>';
}
function _werLearningHtml(s){
  var m=s.momentum, e=s.engagement, h='';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+=_werCard('İvme',_WER_MOM[m.trend]||m.trend,'flame','var(--blue)',(m.change>=0?'+':'')+m.change+' (önceki '+m.previous+')');
  h+=_werCard('Kategori Dengesi','%'+(s.exec.categoryBalance)||0,'layers','var(--t2)');
  h+=_werCard('Okuma Kapsamı','%'+(e.readCoverage||0),'chk','var(--green)');
  h+='</div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px">';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--green)">En Güçlü: '+_were(m.strongestArea)+'</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--orange)">En Zayıf: '+_were(m.weakestArea)+'</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--red)">İhmal: '+_were(m.neglectedArea)+'</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--purple)">Odak: '+_were(String(m.recommendedFocus).slice(0,24))+'</span>';
  h+='</div>';
  if(s.gaps&&s.gaps.length){ h+='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:11px 0 5px">Öğrenme Boşlukları</p><div style="display:flex;flex-direction:column;gap:4px">';
    s.gaps.slice(0,6).forEach(function(g){ h+='<div style="font-size:10.5px;color:var(--t2);word-break:break-word">'+_werIc('alert',11,'var(--orange)')+' '+_were(g.label)+' <b>('+g.count+')</b></div>'; });
    h+='</div>'; }
  return h;
}

/* ── Yönetici raporu (yazdırılabilir tek sayfa) ── */
function werExecutiveReportHtml(period){
  var s=werSnapshot(period||_werPeriod), e=s.exec, m=s.momentum;
  var h='<style>@media print{body *{visibility:hidden!important}.wer-report,.wer-report *{visibility:visible!important}.wer-report{position:absolute;left:0;top:0;width:100%;padding:12px}.wer-noprint{display:none!important}}</style>';
  h+='<div class="wer-report card" style="padding:16px 18px;max-width:100%">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--s2);padding-bottom:8px;margin-bottom:10px">';
  h+='<h2 style="font-size:15px;font-weight:800">Yönetici Bilgi Raporu</h2><span style="font-size:11px;color:var(--t3)">'+_were(e.periodLabel)+'</span></div>';
  function row(label,val){ return '<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dashed var(--s2)"><span style="font-size:11px;color:var(--t3);font-weight:700">'+_were(label)+'</span><span style="font-size:11.5px;color:var(--t);text-align:right;word-break:break-word">'+_were(val)+'</span></div>'; }
  h+='<p style="font-size:11px;font-weight:800;color:var(--t2);margin:6px 0 3px">Yönetici Özeti</p>';
  h+=row('Dönem Okuması',e.periodReads);
  h+=row('Bilgi Sağlığı','%'+e.knowledgeHealth);
  h+=row('Öğrenme İvmesi',(_WER_MOM[e.learningMomentum]||e.learningMomentum)+' ('+(m.change>=0?'+':'')+m.change+')');
  h+='<p style="font-size:11px;font-weight:800;color:var(--t2);margin:8px 0 3px">Karar Hazırlığı</p>';
  h+=row('Açık Karar',e.openDecisionCount);
  h+=row('Karar Kapsamı','%'+e.decisionCoverage);
  h+='<p style="font-size:11px;font-weight:800;color:var(--t2);margin:8px 0 3px">Öne Çıkan İçgörü</p>';
  h+='<p style="font-size:11.5px;font-style:italic;color:var(--t);word-break:break-word">&ldquo;'+_were(String(e.topRecommendation).slice(0,160))+'&rdquo;</p>';
  h+='<p style="font-size:11px;font-weight:800;color:var(--t2);margin:8px 0 3px">Bilgi Boşlukları · Haftalık Odak</p>';
  h+=row('En Önemli Boşluk',e.mostImportantGap);
  h+=row('En Güçlü / En Zayıf',e.strongestCategory+' / '+e.weakestCategory);
  h+=row('Haftalık Odak',e.suggestedWeeklyFocus);
  h+='<p style="font-size:11px;font-weight:800;color:var(--t2);margin:8px 0 3px">Öncelikli Aksiyonlar</p>';
  (s.actions||[]).forEach(function(a){ h+='<div style="font-size:11px;color:var(--t2);padding:2px 0;word-break:break-word">• '+_were(a.title)+'</div>'; });
  h+='</div>';
  return h;
}
window.werExecutiveReportHtml=werExecutiveReportHtml;
function werPrintReport(){ if(typeof window!=='undefined'&&typeof window.print==='function')window.print(); }
window.werPrintReport=werPrintReport;
function _werReportsHtml(period){
  var h='<div class="wer-noprint" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:9px">';
  h+='<span style="font-size:10px;color:var(--t3);font-weight:700">Dönem:</span>';
  WER_PERIODS.forEach(function(p){ var a=period===p[0]; h+='<button class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'" onclick="werSetPeriod(\''+p[0]+'\')">'+_were(p[1])+'</button>'; });
  h+='<button class="btn btn-g btn-sm" style="margin-left:auto" onclick="werPrintReport()" title="Raporu yazdır">'+_werIc('print',11,'var(--t3)')+' Yazdır</button></div>';
  h+=werExecutiveReportHtml(period);
  return h;
}

/* ── Sekmeli workspace ── */
var WER_TABS=[['overview','Genel','chart'],['decisions','Kararlar','git'],['learning','Öğrenme','bulb'],['reports','Raporlar','doc']];
function _werWorkspaceInner(){
  var s=werSnapshot(_werPeriod); var inner='';
  if(_werTab==='overview')inner=_werOverviewHtml(s);
  else if(_werTab==='decisions')inner=_werDecisionsHtml(s);
  else if(_werTab==='learning')inner=_werLearningHtml(s);
  else if(_werTab==='reports')inner=_werReportsHtml(_werPeriod);
  return '<div id="wer_panel" role="tabpanel" aria-labelledby="wer_tab_'+_werTab+'" style="margin-top:10px">'+inner+'</div>';
}
function werExecutiveWorkspaceHtml(){
  if(typeof wqList==='function'&&!wqList().length)return '';
  var h='<div class="card wd-anim" style="padding:12px 14px;margin-bottom:14px;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2);max-width:100%">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap">'+_werIc('briefcase',16,'var(--blue)')+'<h2 style="font-size:14px;font-weight:800;letter-spacing:.03em">Yönetici İncelemesi</h2>';
  h+='<button class="btn btn-g btn-sm" style="margin-left:auto" onclick="werToggleWorkspace()" title="Kapat" aria-label="Kapat">'+_werIc('x',12,'var(--t3)')+' Kapat</button></div>';
  // tablist
  h+='<div role="tablist" aria-label="Yönetici İncelemesi sekmeleri" style="display:flex;gap:4px;flex-wrap:wrap" onkeydown="werTabKey(event)">';
  WER_TABS.forEach(function(t){ var a=_werTab===t[0];
    h+='<button role="tab" id="wer_tab_'+t[0]+'" aria-selected="'+(a?'true':'false')+'" tabindex="'+(a?'0':'-1')+'" data-tab="'+t[0]+'" onclick="werSetTab(this.dataset.tab)" class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'">'+_werIc(t[2],12,a?'#fff':'var(--t3)')+' '+_were(t[1])+'</button>'; });
  h+='</div>';
  h+='<div id="wer_workspace">'+_werWorkspaceInner()+'</div>';
  h+='</div>';
  return h;
}
window.werExecutiveWorkspaceHtml=werExecutiveWorkspaceHtml;

/* Kompakt giriş noktası (kalabalık sayfaya tam panel eklemez) */
function werEntryPointHtml(){
  if(typeof wqList==='function'&&!wqList().length)return '';
  if(_werOpen)return werExecutiveWorkspaceHtml();
  return '<div class="card" style="padding:10px 14px;margin-bottom:14px;max-width:100%;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
    _werIc('briefcase',15,'var(--blue)')+'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:800">Yönetici İncelemesi</div>'+
    '<div style="font-size:10px;color:var(--t3)">Özet · Kararlar · Öğrenme · Raporlar</div></div>'+
    '<button class="btn btn-p btn-sm" onclick="werToggleWorkspace()" title="Yönetici İncelemesini aç">'+_werIc('arrow',12)+' Aç</button></div>';
}
window.werEntryPointHtml=werEntryPointHtml;

/* ── etkileşim (0 write; yalnız görsel + window.print) ── */
function _werRerender(){ if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); }
function werToggleWorkspace(){ _werOpen=!_werOpen; _werRerender(); }
window.werToggleWorkspace=werToggleWorkspace;
function werSetTab(t){ _werTab=t; var el=(typeof ge==='function')?ge('wer_workspace'):null; if(el){ el.innerHTML=_werWorkspaceInner(); var tl=el.parentNode?el.parentNode.querySelector('[role=tablist]'):null; /* aria güncelle */ }
  // erişilebilirlik: aktif tab aria/tabindex güncelle (tam re-render O(1) snapshot)
  _werRerender(); }
window.werSetTab=werSetTab;
function werSetPeriod(p){ _werPeriod=p; werSetTab('reports'); }
window.werSetPeriod=werSetPeriod;
function werTabKey(ev){ if(!ev)return; var k=ev.key; if(k!=='ArrowRight'&&k!=='ArrowLeft')return;
  var idx=0; for(var i=0;i<WER_TABS.length;i++)if(WER_TABS[i][0]===_werTab)idx=i;
  idx=(k==='ArrowRight')?(idx+1)%WER_TABS.length:(idx-1+WER_TABS.length)%WER_TABS.length;
  werSetTab(WER_TABS[idx][0]); }
window.werTabKey=werTabKey;
