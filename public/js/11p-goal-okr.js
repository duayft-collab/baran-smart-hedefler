/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Phase 5 P1 — OKR FOUNDATION (Hedef Kümeleri / Objectives)
   TAMAMEN TÜRETİLMİŞ. Yeni hedef sistemi YOK; mevcut hedefler üst-seviyede gruplanır.
   Objective = mevcut goal KATEGORİSİ (cat) — her goal tek cat → tek Objective. Goal modeli
   DEĞİŞMEZ, goal'a alan EKLENMEZ, write/şema/backup/relations/import-export/sync DOKUNULMAZ.
   Progress/SMART/Health tamamen bağlı goal'lardan türetilir (manuel progress alanı YOK).
   Harness-güvenli: üst-seviye DOM/timer YOK; D'ye 0 mutasyon.
   ══════════════════════════════════════════════════════════════════════════ */

/* Filtre (dashboard P1 ile aynı türetilmiş mantık; D değişmez) */
function _okrFilter(goals,filter){
  filter=filter||{};
  return (goals||[]).filter(function(g){
    if(filter.status&&g.status!==filter.status)return false;
    if(filter.cat&&String(g.cat||'Diğer')!==String(filter.cat))return false;
    if(filter.year&&String(goalYear(g))!==String(filter.year))return false;
    if(filter.quarter&&goalQuarter(g)!==filter.quarter)return false;
    if(filter.health&&goalHealthStatus(g)!==filter.health)return false;
    if(filter.priority&&goalPriority(g)!==filter.priority)return false;
    return true;
  });
}
function _okrGoalRisky(g){ var hs=goalHealthStatus(g); return hs==='at_risk'||hs==='off_track'||(typeof goalIsBlocked==='function'&&goalIsBlocked(g.id)); }

/* Objective (kategori grubu) rollup — hepsi türetilmiş */
function _okrRollup(key,members){
  var o={key:key,title:key,goalCount:members.length,goals:members.map(function(g){return g.id;}),
    progress:0,smart:0,quality:0,health:{on_track:0,at_risk:0,off_track:0,paused:0},confidence:{high:0,medium:0,low:0},
    status:'active',risky:false,criticality:0};
  var sp=0,ss=0,sq=0,anyActive=false,riskyCount=0;
  members.forEach(function(g){
    var pr=Number(goalProgress(g))||0; sp+=pr; ss+=Number(smartScore(g))||0; sq+=Number(qualityIndex(g))||0;
    var hs=goalHealthStatus(g); if(o.health[hs]==null)o.health[hs]=0; o.health[hs]++;
    var cf=goalConfidence(g); if(o.confidence[cf]==null)o.confidence[cf]=0; o.confidence[cf]++;
    if(g.status!=='done')anyActive=true;
    if(_okrGoalRisky(g))riskyCount++;
  });
  if(members.length){ o.progress=Math.round(sp/members.length); o.smart=Math.round(ss/members.length*10)/10; o.quality=Math.round(sq/members.length); }
  o.status=(members.length&&!anyActive)?'done':'active';
  o.risky=riskyCount>0;
  o.criticality=(o.status==='done')?-1:((100-o.progress)+riskyCount*15);   // yüksek = daha kritik
  return o;
}

/* Objective listesi (filtreli); sıralama: kritiklik DESC */
function okrObjectives(filter){
  var goals=_okrFilter((typeof D!=='undefined'&&D.goals)?D.goals:[],filter);
  var map={},order=[];
  goals.forEach(function(g){ var k=String(g.cat||'Diğer'); if(!map[k]){map[k]=[];order.push(k);} map[k].push(g); });
  return order.map(function(k){return _okrRollup(k,map[k]);}).sort(function(a,b){return b.criticality-a.criticality;});
}
window.okrObjectives=okrObjectives;
function okrObjectiveByKey(key,filter){ return okrObjectives(filter).filter(function(o){return String(o.key)===String(key);})[0]||null; }
window.okrObjectiveByKey=okrObjectiveByKey;

function okrDashboardStats(filter){
  var objs=okrObjectives(filter);
  var s={objectiveCount:objs.length,avgProgress:0,riskyCount:0,doneCount:0,mostCritical:null};
  var sp=0;
  objs.forEach(function(o){ sp+=o.progress; if(o.risky)s.riskyCount++; if(o.status==='done')s.doneCount++; });
  if(objs.length)s.avgProgress=Math.round(sp/objs.length);
  var active=objs.filter(function(o){return o.status!=='done';});
  s.mostCritical=active.length?active[0].key:null;   // okrObjectives kritiklik DESC sıralı
  return s;
}
window.okrDashboardStats=okrDashboardStats;

/* ── UI ── */
var OKR_FILTER={};
function okrSetFilter(key,val){ if(val==='')delete OKR_FILTER[key]; else OKR_FILTER[key]=val; if(typeof renderPage==='function')renderPage(); }
window.okrSetFilter=okrSetFilter;
function _okrEsc(v){ return (typeof U!=='undefined'&&U&&U.esc)?U.esc(String(v==null?'':v)):String(v==null?'':v); }
function _okrCard(l,v,ic0,c){ return (typeof statCard==='function')?statCard(l,v,ic0,c):'<div class="card" style="padding:12px 14px"><div style="font-size:11px;color:var(--t2)">'+_okrEsc(l)+'</div><div style="font-size:20px;font-weight:700;color:'+c+'">'+_okrEsc(v)+'</div></div>'; }
function _okrFilterBtns(key,opts,cur){
  var h='<div style="display:flex;gap:4px;flex-wrap:wrap">';
  h+='<button type="button" class="btn btn-sm" style="background:'+(!cur?'var(--blue)':'var(--s2)')+';color:'+(!cur?"#fff":'var(--t2)')+'" data-k="'+key+'" data-v="" onclick="okrSetFilter(this.dataset.k,this.dataset.v)">Tümü</button>';
  opts.forEach(function(o){ var a=String(cur)===String(o.v); h+='<button type="button" class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?"#fff":'var(--t2)')+'" data-k="'+key+'" data-v="'+_okrEsc(o.v)+'" onclick="okrSetFilter(this.dataset.k,this.dataset.v)">'+_okrEsc(o.l)+'</button>'; });
  return h+'</div>';
}
function okrDashboardHtml(filter){
  filter=filter||OKR_FILTER;
  var goals=(typeof D!=='undefined'&&D.goals)?D.goals:[];
  var objs=okrObjectives(filter), st=okrDashboardStats(filter);
  var HL=(typeof GOAL_HEALTH_LABELS!=='undefined')?GOAL_HEALTH_LABELS:{on_track:'Yolunda',at_risk:'Riskte',off_track:'Yolunda Değil',paused:'Duraklatıldı'};
  var PL=(typeof GOAL_PRIORITY_LABELS!=='undefined')?GOAL_PRIORITY_LABELS:{p1:'P1',p2:'P2',p3:'P3'};
  var ic2=(typeof ic==='function')?ic:function(){return '';};
  var years={}; goals.forEach(function(g){years[goalYear(g)]=1;}); var cats={}; goals.forEach(function(g){cats[String(g.cat||'Diğer')]=1;});
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">OKR — Hedef Kümeleri</h1><p class="sh-sub">Kategori bazlı objective özeti — '+st.objectiveCount+' küme (türetilmiş)</p></div>'+
    '<button class="btn btn-s btn-sm" onclick="gotoTab(\'goals\')">'+ic2('tgt',12)+' Hedefler</button></div>';
  /* Filtreler */
  h+='<div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px">';
  h+='<div><p class="lbl" style="margin-bottom:4px">Yıl</p>'+_okrFilterBtns('year',Object.keys(years).sort().map(function(y){return {v:y,l:y};}),filter.year)+'</div>';
  h+='<div><p class="lbl" style="margin-bottom:4px">Çeyrek</p>'+_okrFilterBtns('quarter',[{v:'Q1',l:'Q1'},{v:'Q2',l:'Q2'},{v:'Q3',l:'Q3'},{v:'Q4',l:'Q4'}],filter.quarter)+'</div>';
  h+='<div><p class="lbl" style="margin-bottom:4px">Durum</p>'+_okrFilterBtns('status',[{v:'active',l:'Aktif'},{v:'done',l:'Tamamlanan'}],filter.status)+'</div>';
  h+='<div><p class="lbl" style="margin-bottom:4px">Sağlık</p>'+_okrFilterBtns('health',['on_track','at_risk','off_track','paused'].map(function(k){return {v:k,l:HL[k]};}),filter.health)+'</div>';
  h+='<div><p class="lbl" style="margin-bottom:4px">Öncelik</p>'+_okrFilterBtns('priority',['p1','p2','p3'].map(function(k){return {v:k,l:PL[k]};}),filter.priority)+'</div>';
  if(Object.keys(cats).length>1)h+='<div><p class="lbl" style="margin-bottom:4px">Kategori</p>'+_okrFilterBtns('cat',Object.keys(cats).sort().map(function(c){return {v:c,l:c};}),filter.cat)+'</div>';
  h+='</div>';
  /* Özet kartlar */
  h+='<div class="g4" style="margin-bottom:14px">';
  h+=_okrCard('Objective',st.objectiveCount,'tgt','var(--blue)');
  h+=_okrCard('Ort. İlerleme','%'+st.avgProgress,'ref','var(--teal)');
  h+=_okrCard('Riskli',st.riskyCount,'flame','var(--orange)');
  h+=_okrCard('Tamamlanan',st.doneCount,'chk','var(--green)');
  h+='</div>';
  if(st.mostCritical)h+='<div class="card" style="padding:12px 14px;margin-bottom:14px;font-size:12px"><b>&#9889; En kritik objective:</b> '+_okrEsc(st.mostCritical)+'</div>';
  /* Objective listesi */
  if(!objs.length)h+='<div class="card" style="padding:40px;text-align:center;color:var(--t2)">Objective yok (hedef bulunamadı).</div>';
  else objs.forEach(function(o){
    var col=o.status==='done'?'var(--green)':(o.risky?'var(--orange)':'var(--blue)');
    h+='<div class="card cp" style="padding:14px 16px;margin-bottom:10px;cursor:pointer" data-k="'+_okrEsc(o.key)+'" onclick="okrOpenObjective(this.dataset.k)">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><p style="font-weight:700;font-size:14px">'+_okrEsc(o.title)+'</p>'+
      '<span style="display:flex;gap:5px;align-items:center">'+(o.risky?'<span class="pill p-orange" style="font-size:9px">&#9888; Riskli</span>':'')+(o.status==='done'?'<span class="pill p-green" style="font-size:9px">&#10003; Tamam</span>':'')+'<span class="pill p-gray" style="font-size:10px">'+o.goalCount+' hedef</span></span></div>';
    h+='<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t2);margin-bottom:3px"><span>İlerleme</span><span>%'+o.progress+' &middot; SMART '+o.smart+' &middot; Kalite '+o.quality+'</span></div>';
    h+=((typeof progBar==='function')?progBar(o.progress,col):'');
    h+='</div>';
  });
  h+='</div>';
  return h;
}
window.okrDashboardHtml=okrDashboardHtml;

function okrObjectiveDetailHtml(key){
  var o=okrObjectiveByKey(key);
  if(!o)return '<div class="fade"><div class="sh"><h1 class="sh-t">Objective</h1></div><div class="card" style="padding:30px;text-align:center;color:var(--t2)">Objective bulunamadı.</div></div>';
  var HL=(typeof GOAL_HEALTH_LABELS!=='undefined')?GOAL_HEALTH_LABELS:{};
  var CL=(typeof GOAL_CONFIDENCE_LABELS!=='undefined')?GOAL_CONFIDENCE_LABELS:{};
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">'+_okrEsc(o.title)+'</h1><p class="sh-sub">'+o.goalCount+' hedef · '+(o.status==='done'?'Tamamlandı':'Aktif')+(o.risky?' · Riskli':'')+'</p></div>'+
    '<button class="btn btn-s btn-sm" onclick="okrResetView();gotoTab(\'okr\')">'+((typeof ic==='function')?ic('ref',12):'')+' OKR</button></div>';
  h+='<div class="g4" style="margin-bottom:14px">';
  h+=_okrCard('Ort. İlerleme','%'+o.progress,'ref','var(--blue)');
  h+=_okrCard('Ort. SMART',o.smart,'star','var(--purple)');
  h+=_okrCard('Ort. Kalite',o.quality,'chk','var(--teal)');
  h+=_okrCard('Sağlık (Riskli)',(o.health.at_risk+o.health.off_track),'flame','var(--orange)');
  h+='</div>';
  h+='<div class="card" style="padding:12px 14px;margin-bottom:14px;font-size:12px;color:var(--t2)">Sağlık: '+
    Object.keys(o.health).filter(function(k){return o.health[k];}).map(function(k){return (HL[k]||k)+' '+o.health[k];}).join(' · ')+
    '<br>Güven: '+Object.keys(o.confidence).filter(function(k){return o.confidence[k];}).map(function(k){return (CL[k]||k)+' '+o.confidence[k];}).join(' · ')+'</div>';
  /* Bağlı goal listesi */
  h+='<div class="card" style="padding:14px 16px"><p style="font-weight:700;font-size:13px;margin-bottom:10px">Bağlı Hedefler</p>';
  var goals=(typeof D!=='undefined'&&D.goals)?D.goals:[];
  o.goals.forEach(function(gid){ var g=goals.filter(function(x){return x.id===gid;})[0]; if(!g)return;
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 9px;background:var(--s2);border-radius:7px;margin-bottom:5px;flex-wrap:wrap"><div style="min-width:0;flex:1"><span style="font-size:12.5px;font-weight:500">'+_okrEsc(g.title)+'</span><div style="font-size:10px;color:var(--t2)">%'+(Number(goalProgress(g))||0)+' · SMART '+(Number(smartScore(g))||0)+' · '+_okrEsc((HL[goalHealthStatus(g)]||''))+'</div></div>'+
      '<button type="button" class="btn btn-s btn-sm" data-i="'+g.id+'" onclick="openGoalDetail(+this.dataset.i)">Aç</button></div>';
  });
  h+='</div></div>';
  return h;
}
window.okrObjectiveDetailHtml=okrObjectiveDetailHtml;

var _okrOpenKey=null;
function okrOpenObjective(key){ _okrOpenKey=key; if(typeof renderPage==='function')renderPage(); }
window.okrOpenObjective=okrOpenObjective;
function renderOKR(){ if(typeof sh!=='function')return; sh('pinner', _okrOpenKey?okrObjectiveDetailHtml(_okrOpenKey):okrDashboardHtml(OKR_FILTER)); }
window.renderOKR=renderOKR;
/* OKR sekmesine her girişte listeye dön (detay geçici) */
function okrResetView(){ _okrOpenKey=null; }
window.okrResetView=okrResetView;
