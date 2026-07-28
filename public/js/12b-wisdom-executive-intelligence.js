/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom P11 — EXECUTIVE INTELLIGENCE & STRATEGIC DECISION CENTER
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK · YAZDIRILABİLİR)

   Wisdom çalışma alanını, kullanıcının birikmiş bilgisini sürekli olarak
   uygulanabilir stratejik içgörülere dönüştüren yönetici karar zekâsı merkezine
   çevirir: Yönetici Öncelikleri (top 10), Stratejik Riskler, Stratejik Fırsatlar,
   Yönetici Isı Haritası, Karar Güveni, Yönetici Odağı (Bugün/Hafta/Ay), Yönetici
   Brifingi.

   P4 (wlc*), P5 (wkg*), P6 (wco*), P7 (wia*), P8 (wer*), P10 (wws*) çıktıları
   YENİDEN KULLANILIR — tek paylaşılan memoize snapshot, çift tarama yok. Tek okuma
   girişi wqList()/wqById(). Sharded runtime cache'ine veya legacy söz dizisine
   doğrudan erişmez. Yeni koleksiyon/payload/settings/write/network/AI/realtime-
   listener YOK. Kütüphanesiz saf HTML/CSS ısı haritası. Erişilebilir, responsive,
   yazdırma-dostu.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── küçük yardımcılar ── */
function _weie(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _weiIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _weiNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr'); }
function _weiClamp(v){ return Math.max(0,Math.min(100,Math.round(v))); }
function _weiList(){ var l=(typeof wqList==='function')?wqList():[]; return l.filter(function(q){ return q&&q.active!==false&&String(q.quote==null?'':q.quote).trim(); }); }
function _weiRel(type,id,targetType){ if(typeof getRelatedEntities!=='function')return []; try{ return getRelatedEntities(type,id).filter(function(x){return x&&x.entity&&x.entity.type===targetType;}); }catch(e){ return []; } }

/* ── paylaşılan snapshot (imza-tabanlı memoize) ── */
var _WEI_SNAP=null, _WEI_SIG=null;
function weiInvalidate(){ _WEI_SNAP=null; _WEI_SIG=null; }
window.weiInvalidate=weiInvalidate;
function _weiSig(){
  var l=(typeof wqList==='function')?wqList():[], n=l.length, sc=0, refl=0, fav=0, maxU=0;
  for(var i=0;i<n;i++){ var q=l[i]; sc+=Number(q.showCount)||0; if(q.reflected)refl++; if(q.favorite)fav++; var u=Date.parse(q.updatedAt||''); if(!isNaN(u)&&u>maxU)maxU=u; }
  var r=Array.isArray(D.relations)?D.relations.length:0, dcs=Array.isArray(D.decisions)?D.decisions.length:0;
  return [n,sc,refl,fav,maxU,r,dcs].join('|');
}
function weiSnapshot(){
  var sig=_weiSig();
  if(_WEI_SNAP&&_WEI_SIG===sig)return _WEI_SNAP;
  var ctx=(typeof wcoBuildContext==='function')?wcoBuildContext():{goals:[],decisions:[],principles:[],lifeAreas:[]};
  _WEI_SNAP={
    ctx:ctx,
    base:(typeof wiaBase==='function')?wiaBase():{list:[],total:0,now:Date.now()},
    dash:(typeof wiaExecutiveDashboard==='function')?wiaExecutiveDashboard():{},
    wr:(typeof wiaWeeklyReview==='function')?wiaWeeklyReview():{},
    gaps:(typeof wiaLearningGaps==='function')?wiaLearningGaps():[],
    eng:(typeof wiaEngagementStats==='function')?wiaEngagementStats():{},
    radars:(typeof wkgRadars==='function')?wkgRadars():{},
    expertise:(typeof wkgExpertise==='function')?wkgExpertise():[],
    momentum:(typeof werLearningMomentum==='function')?werLearningMomentum():{},
    decisions:(typeof werDecisionIntelligence==='function')?werDecisionIntelligence():[],
    recs:(typeof wcoRecommend==='function')?(wcoRecommend(ctx,50)||[]):[]
  };
  _WEI_SIG=sig; return _WEI_SNAP;
}
window.weiSnapshot=weiSnapshot;

/* ── Yönetici Öncelikleri (top 10) ── */
function weiExecutivePriority(){
  var s=weiSnapshot(), ctx=s.ctx;
  var scored=s.recs.map(function(r){
    var q=(typeof wqById==='function')?wqById(r.id):null; if(!q)return null;
    var goalRel=_weiRel('wisdomQuote',q.id,'goal').length;
    var decRel=_weiRel('wisdomQuote',q.id,'decision').length;
    var score=(r.score||0)*40 + (q.favorite?10:0) + ((Number(q.priority)||3)-3)*5 + (goalRel>0?15:0) + (decRel>0?10:0) + (q.reflected?0:10) + ((Number(q.showCount)||0)===0?10:0);
    var reasons=[];
    if((r.score||0)>0.55)reasons.push('Yüksek koç ilgisi');
    if(goalRel>0)reasons.push('Hedefe bağlı');
    if(decRel>0)reasons.push('Karara bağlı');
    if(!q.reflected)reasons.push('Henüz yansıtılmadı');
    if((Number(q.showCount)||0)===0)reasons.push('Okunmadı');
    if(q.favorite)reasons.push('Favori');
    return { id:q.id, quote:String(q.quote||'').slice(0,90), author:q.author||'', score:Math.round(score*10)/10, reasons:reasons };
  }).filter(Boolean);
  scored.sort(function(a,b){ if(b.score!==a.score)return b.score-a.score; return String(a.id)<String(b.id)?-1:(String(a.id)>String(b.id)?1:0); });
  return scored.slice(0,10);
}
window.weiExecutivePriority=weiExecutivePriority;

/* ── Stratejik Riskler ── */
var WEI_SEV={Critical:4,High:3,Medium:2,Low:1};
function weiStrategicRisks(){
  var s=weiSnapshot(), out=[];
  s.gaps.forEach(function(g){
    if(g.type==='lifearea_ignored')out.push({type:g.type,label:'İhmal edilen yaşam alanları',severity:'High',detail:(g.items||[]).slice(0,3).join(', ')});
    else if(g.type==='coach_unread')out.push({type:g.type,label:'Okunmamış koç önerileri',severity:'Medium',detail:g.count+' öğe'});
  });
  if(s.radars.weakest&&s.radars.weakest!=='—')out.push({type:'weak_category',label:'Zayıf bilgi kategorisi',severity:'Medium',detail:s.radars.weakest});
  var lowReady=s.decisions.filter(function(d){return d.readinessScore<40;});
  if(lowReady.length)out.push({type:'ignored_decision',label:'İhmal edilen yönetici kararları',severity:'Critical',detail:lowReady.length+' karar · en düşük %'+Math.min.apply(null,lowReady.map(function(d){return d.readinessScore;}))});
  if((s.eng.reflectionRate||0)<20)out.push({type:'low_reflection',label:'Düşük yansıma skoru',severity:'High',detail:'%'+(s.eng.reflectionRate||0)});
  if(s.momentum.trend==='declining')out.push({type:'declining_momentum',label:'Gerileyen öğrenme ivmesi',severity:'Medium',detail:(s.momentum.change||0)+' değişim'});
  out.sort(function(a,b){ if(WEI_SEV[b.severity]!==WEI_SEV[a.severity])return WEI_SEV[b.severity]-WEI_SEV[a.severity]; return a.type<b.type?-1:(a.type>b.type?1:0); });
  return out;
}
window.weiStrategicRisks=weiStrategicRisks;

/* ── Stratejik Fırsatlar ── */
function weiStrategicOpportunities(){
  var s=weiSnapshot(), b=s.base, out=[];
  if(s.radars.strongest&&s.radars.strongest!=='—')out.push({type:'strong_domain',label:'En güçlü bilgi alanı',detail:s.radars.strongest});
  if(s.radars.mostGrowing&&s.radars.mostGrowing!=='—')out.push({type:'improving_category',label:'Hızla gelişen kategori',detail:s.radars.mostGrowing});
  var highUnread=b.list.filter(function(q){ return (Number(q.showCount)||0)===0&&(Number(q.priority)||3)>=4; });
  if(highUnread.length)out.push({type:'high_value_unread',label:'Yüksek değerli okunmamış bilgi',detail:highUnread.length+' söz',items:highUnread.slice(0,3).map(function(q){return String(q.quote).slice(0,50);})});
  var negFav=b.list.filter(function(q){ return q.favorite&&(Number(q.showCount)||0)===0; });
  if(negFav.length)out.push({type:'neglected_favorite',label:'İhmal edilmiş favoriler',detail:negFav.length+' söz'});
  var impactDec=s.decisions.filter(function(d){return (d.relatedGoals||[]).length>0;});
  if(impactDec.length)out.push({type:'high_impact_decision',label:'Yüksek etkili kararlar',detail:impactDec.length+' hedef-bağlı karar'});
  return out;
}
window.weiStrategicOpportunities=weiStrategicOpportunities;

/* ── Karar Güveni (0–100 deterministik) ── */
function weiDecisionConfidence(decision){
  if(!decision)return 0;
  var base=(typeof werDecisionReadiness==='function')?werDecisionReadiness(decision):0;
  var w=_weiRel('decision',decision.id,'wisdomQuote');
  var hist=0; if(w.length){ var r=0; w.forEach(function(e){ var q=(typeof wqById==='function')?wqById(e.entity.id):null; if(q&&(Number(q.showCount)||0)>0)r++; }); hist=r/w.length; }
  return _weiClamp(base*0.8 + hist*20);
}
window.weiDecisionConfidence=weiDecisionConfidence;

/* ── Yönetici Isı Haritası (yaşam alanı × bilgi seviyesi; saf HTML/CSS) ── */
var WEI_LEVELS=['Yok','Zayıf','Orta','Güçlü'];
function _weiAreaScore(areaLabel){
  var kn=_weiNorm(areaLabel); if(!kn)return 0;
  var n=0,read=0;
  _weiList().forEach(function(q){ var hay=_weiNorm(q.quote+' '+(q.tags||[]).join(' ')+' '+(q.category||'')); if(hay.indexOf(kn)>=0){ n++; if((Number(q.showCount)||0)>0)read++; } });
  return n===0?0:(read>=3?3:(n>=6?2:(n>=2?1:1)));
}
function weiHeatmap(){
  var s=weiSnapshot();
  var areas=(s.ctx.lifeAreas&&s.ctx.lifeAreas.length)?s.ctx.lifeAreas.slice(0,10):[];
  if(!areas.length&&typeof pAreaLabel==='function'&&Array.isArray(D.principles)){ var set={}; D.principles.forEach(function(p){ if(p&&p.lifeArea)set[pAreaLabel(p.lifeArea)]=1; }); areas=Object.keys(set).slice(0,10); }
  if(!areas.length)areas=['Kendim','Ailem','İş','Sağlık','Maneviyat'];
  var rows=areas.map(function(a){ var lv=_weiAreaScore(a); return {area:a,level:lv,levelLabel:WEI_LEVELS[lv]}; });
  return { levels:WEI_LEVELS, rows:rows };
}
window.weiHeatmap=weiHeatmap;

/* ── Yönetici Odağı (Bugün / Hafta / Ay) ── */
function weiExecutiveFocus(){
  var actions=(typeof werPriorityActions==='function')?werPriorityActions():[];
  var pri=weiExecutivePriority();
  var risks=weiStrategicRisks(), opps=weiStrategicOpportunities();
  return {
    today:actions.slice(0,5).map(function(a){return a.title;}),
    week:pri.slice(0,5).map(function(p){return String(p.quote).slice(0,60);}),
    month:risks.slice(0,3).map(function(r){return 'Risk: '+r.label;}).concat(opps.slice(0,2).map(function(o){return 'Fırsat: '+o.label;}))
  };
}
window.weiExecutiveFocus=weiExecutiveFocus;

/* ── Yönetici Brifingi ── */
function weiExecutiveBrief(){
  var s=weiSnapshot();
  var risks=weiStrategicRisks(), opps=weiStrategicOpportunities(), pri=weiExecutivePriority();
  var actions=(typeof werPriorityActions==='function')?werPriorityActions():[];
  return {
    biggestProgress:(s.radars.mostGrowing&&s.radars.mostGrowing!=='—')?s.radars.mostGrowing:((_WEI_MOM[s.momentum.trend]||s.momentum.trend||'—')),
    biggestRisk:risks.length?risks[0].label:'—',
    biggestOpportunity:opps.length?opps[0].label:'—',
    recommendedNextAction:actions.length?actions[0].title:'—',
    recommendedWisdom:pri.length?pri[0].quote:'—',
    executiveHealth:s.dash.knowledgeHealth||0
  };
}
window.weiExecutiveBrief=weiExecutiveBrief;

/* ── UI ── */
var _WEI_MOM={improving:'Yükseliyor',declining:'Geriliyor',stable:'Dengeli',idle:'Durgun'};
var _WEI_SEVCOLOR={Critical:'var(--red)',High:'var(--orange)',Medium:'var(--blue)',Low:'var(--t3)'};
var _WEI_SEVLABEL={Critical:'Kritik',High:'Yüksek',Medium:'Orta',Low:'Düşük'};
function _weiKpi(label,val,icon,color,sub){
  return '<div class="card" style="padding:11px 13px;flex:1 1 140px;min-width:130px;max-width:100%"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+_weiIc(icon,13,color)+'<span style="font-size:9.5px;color:var(--t3);font-weight:700">'+_weie(label)+'</span></div>'+
    '<div style="font-size:18px;font-weight:800;color:'+color+';line-height:1.15;word-break:break-word">'+_weie(val)+'</div>'+(sub?'<div style="font-size:9px;color:var(--t3);margin-top:2px">'+_weie(sub)+'</div>':'')+'</div>';
}
function weiDashboardHtml(){
  if(!_weiList().length)return '<p style="font-size:11px;color:var(--t3)">Yönetici zekâsı için yeterli bilgi yok.</p>';
  var s=weiSnapshot(), br=weiExecutiveBrief();
  var h='<style>@media print{body *{visibility:hidden!important}.wei-report,.wei-report *{visibility:visible!important}.wei-report{position:absolute;left:0;top:0;width:100%}}</style>';
  h+='<div class="wei-report">';
  // sticky yönetici özeti
  h+='<div class="card" style="padding:11px 13px;margin-bottom:10px;max-width:100%;position:sticky;top:0;z-index:2;border:1px solid var(--s2)">';
  h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">'+_weiIc('briefcase',14,'var(--blue)')+'<span style="font-size:12px;font-weight:800">Yönetici Brifingi</span>'+
    '<span class="pill" style="margin-left:auto;font-size:9px;background:var(--s2);color:var(--green)">Sağlık %'+br.executiveHealth+'</span></div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap">';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--green)">En Büyük İlerleme: '+_weie(String(br.biggestProgress).slice(0,22))+'</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--red)">En Büyük Risk: '+_weie(String(br.biggestRisk).slice(0,22))+'</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--blue)">En Büyük Fırsat: '+_weie(String(br.biggestOpportunity).slice(0,22))+'</span>';
  h+='</div>';
  h+='<div style="font-size:10.5px;color:var(--t2);margin-top:6px;word-break:break-word">Önerilen Aksiyon: '+_weie(br.recommendedNextAction)+'</div>';
  h+='</div>';
  // KPI kartları
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+=_weiKpi('Yönetici Sağlığı','%'+(s.dash.knowledgeHealth||0),'shield','var(--green)');
  h+=_weiKpi('Yansıma','%'+(s.dash.reflectionScore||0),'bulb','var(--orange)');
  h+=_weiKpi('Karar Kapsamı','%'+(s.dash.decisionCoverage||0),'git','var(--purple)');
  h+=_weiKpi('İvme',_WEI_MOM[s.momentum.trend]||'—','chart','var(--blue)',(s.momentum.change>=0?'+':'')+(s.momentum.change||0));
  h+=_weiKpi('Knowledge Score','%'+(s.dash.knowledgeScore||0),'chk','var(--green)');
  h+='</div>';
  // Yönetici Öncelikleri
  var pri=weiExecutivePriority();
  h+='<p style="font-size:10.5px;color:var(--t3);font-weight:700;margin:11px 0 5px">Yönetici Öncelikleri (Top 10)</p><div style="display:flex;flex-direction:column;gap:5px">';
  pri.forEach(function(p,i){ h+='<div class="card" style="padding:8px 11px;max-width:100%;display:flex;gap:8px;align-items:flex-start">'+
    '<span class="pill" style="flex-shrink:0;font-size:9px;background:var(--blue);color:#fff">'+(i+1)+'</span>'+
    '<div style="flex:1;min-width:0"><div style="font-size:11px;color:var(--t);word-break:break-word">'+_weie(p.quote)+'</div>'+
    (p.reasons.length?'<div style="font-size:9px;color:var(--t3);margin-top:2px">'+_weie(p.reasons.slice(0,3).join(' · '))+'</div>':'')+'</div>'+
    '<button class="btn btn-g btn-sm" style="flex-shrink:0" data-id="'+_weie(String(p.id))+'" onclick="openWqForm(this.dataset.id)" title="Aç">'+_weiIc('arrow',11,'var(--t3)')+'</button></div>'; });
  h+='</div>';
  // Riskler + Fırsatlar (grid)
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:11px">';
  var risks=weiStrategicRisks();
  h+='<div style="flex:1 1 260px;min-width:0"><p style="font-size:10.5px;color:var(--t3);font-weight:700;margin-bottom:5px">'+_weiIc('alert',12,'var(--red)')+' Stratejik Riskler</p>';
  if(risks.length){ risks.forEach(function(r){ h+='<div style="font-size:10.5px;color:var(--t2);padding:3px 0;word-break:break-word"><span class="pill" style="font-size:8.5px;background:var(--s2);color:'+_WEI_SEVCOLOR[r.severity]+'">'+_WEI_SEVLABEL[r.severity]+'</span> '+_weie(r.label)+(r.detail?' — '+_weie(r.detail):'')+'</div>'; }); }
  else h+='<p style="font-size:10px;color:var(--t3)">Belirgin risk yok.</p>';
  h+='</div>';
  var opps=weiStrategicOpportunities();
  h+='<div style="flex:1 1 260px;min-width:0"><p style="font-size:10.5px;color:var(--t3);font-weight:700;margin-bottom:5px">'+_weiIc('star',12,'var(--green)')+' Stratejik Fırsatlar</p>';
  if(opps.length){ opps.forEach(function(o){ h+='<div style="font-size:10.5px;color:var(--t2);padding:3px 0;word-break:break-word">• '+_weie(o.label)+(o.detail?' — '+_weie(o.detail):'')+'</div>'; }); }
  else h+='<p style="font-size:10px;color:var(--t3)">Belirgin fırsat yok.</p>';
  h+='</div></div>';
  // Isı haritası
  var hm=weiHeatmap();
  h+='<p style="font-size:10.5px;color:var(--t3);font-weight:700;margin:11px 0 5px">Yönetici Isı Haritası (Yaşam Alanı × Bilgi Seviyesi)</p>';
  h+='<div style="overflow-x:auto;max-width:100%"><table role="table" style="border-collapse:collapse;font-size:10px;min-width:100%"><thead><tr><th scope="col" style="text-align:left;padding:4px 8px;color:var(--t3)">Yaşam Alanı</th>';
  hm.levels.forEach(function(lv){ h+='<th scope="col" style="padding:4px 8px;color:var(--t3);text-align:center">'+_weie(lv)+'</th>'; });
  h+='</tr></thead><tbody>';
  var LVC=['var(--s2)','var(--orange)','var(--blue)','var(--green)'];
  hm.rows.forEach(function(row){ h+='<tr><td style="padding:4px 8px;color:var(--t2);font-weight:600;word-break:break-word">'+_weie(row.area)+'</td>';
    hm.levels.forEach(function(lv,li){ var on=li===row.level; h+='<td style="padding:4px 8px;text-align:center"><span aria-label="'+_weie(row.area+' '+lv)+'" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:'+(on?LVC[li]:'transparent')+';border:1px solid var(--s2)"></span>'+(on?' <span style="font-size:8px;color:var(--t3)">'+_weie(row.levelLabel)+'</span>':'')+'</td>'; });
    h+='</tr>'; });
  h+='</tbody></table></div>';
  // Yönetici Odağı
  var fo=weiExecutiveFocus();
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:11px">';
  function focusBlock(title,arr,color){ var b='<div style="flex:1 1 200px;min-width:0"><p style="font-size:10px;color:'+color+';font-weight:700;margin-bottom:4px">'+_weie(title)+'</p>'; if(arr&&arr.length){ arr.forEach(function(x){ b+='<div style="font-size:10px;color:var(--t2);padding:2px 0;word-break:break-word">• '+_weie(String(x).slice(0,54))+'</div>'; }); }else b+='<p style="font-size:9.5px;color:var(--t3)">—</p>'; return b+'</div>'; }
  h+=focusBlock('Bugün',fo.today,'var(--green)')+focusBlock('Bu Hafta',fo.week,'var(--blue)')+focusBlock('Bu Ay',fo.month,'var(--purple)');
  h+='</div>';
  // Üretkenlik kısayolları (P10 workspace'e delege)
  h+='<div class="wei-noprint" style="display:flex;gap:5px;flex-wrap:wrap;margin-top:11px">';
  [['Gözden Geçir','executive','git'],['Koç','coach','target'],['Öğrenme','learning','book'],['Bilgi','knowledge','brain'],['Arama','search','search'],['Odak','','eye']].forEach(function(a){
    var act=a[1]?("wwsGo('"+a[1]+"')"):'wwsToggleFocus()';
    h+='<button class="btn btn-g btn-sm" onclick="'+act+'" title="'+_weie(a[0])+'">'+_weiIc(a[2],11,'var(--t3)')+' '+_weie(a[0])+'</button>'; });
  h+='<button class="btn btn-g btn-sm" onclick="if(typeof window.print===\'function\')window.print()" title="Yönetici özetini yazdır">'+_weiIc('print',11,'var(--t3)')+' Yazdır</button>';
  h+='</div>';
  h+='</div>';
  return h;
}
window.weiDashboardHtml=weiDashboardHtml;
