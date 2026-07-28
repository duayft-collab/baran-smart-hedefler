/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Dashboard P1 — Hedef Panosu (TAMAMEN TÜRETİLMİŞ)
   Yeni veri modeli / write YOK. Tüm sayılar mevcut saf reader'lardan türetilir:
   smartScore/qualityIndex/goalProgress/goalDueState/goalHealthStatus/goalConfidence/
   goalPriority/goalYear/goalQuarter + goalCheckInTrend (11m). D'ye HİÇBİR mutasyon.
   Harness-güvenli: üst-seviye DOM/timer YOK.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Saf aggregatör (D'yi değiştirmez; filter uygulanmış küme üzerinden) ── */
function goalsDashboardStats(goals, filter){
  filter=filter||{};
  var fg=(goals||[]).filter(function(g){
    if(filter.status&&g.status!==filter.status)return false;
    if(filter.cat&&String(g.cat||'')!==String(filter.cat))return false;
    if(filter.year&&String(goalYear(g))!==String(filter.year))return false;
    if(filter.quarter&&goalQuarter(g)!==filter.quarter)return false;
    if(filter.health&&goalHealthStatus(g)!==filter.health)return false;
    if(filter.priority&&goalPriority(g)!==filter.priority)return false;
    return true;
  });
  var s={total:fg.length,active:0,done:0,overdue:0,atRisk:0,dueSoon:0,
    priority:{p1:0,p2:0,p3:0},health:{on_track:0,at_risk:0,off_track:0,paused:0},confidence:{high:0,medium:0,low:0},
    avg:{smart:0,quality:0,progress:0},byCategory:[],checkInTrend:{improving:0,declining:0,stable:0,none:0}};
  var sumS=0,sumQ=0,sumP=0,catMap={};
  fg.forEach(function(g){
    if(g.status==='done')s.done++; else s.active++;
    var due=(typeof goalDueState==='function')?goalDueState(g):'none';
    if(due==='overdue')s.overdue++;
    if(['today','tomorrow','this_week','due_soon'].indexOf(due)>=0)s.dueSoon++;
    var hs=goalHealthStatus(g); if(s.health[hs]==null)s.health[hs]=0; s.health[hs]++;
    if(hs==='at_risk'||hs==='off_track')s.atRisk++;
    var cf=goalConfidence(g); if(s.confidence[cf]==null)s.confidence[cf]=0; s.confidence[cf]++;
    var pl=goalPriority(g); if(s.priority[pl]==null)s.priority[pl]=0; s.priority[pl]++;
    var sc=Number(smartScore(g))||0, qi=Number(qualityIndex(g))||0, pr=Number(goalProgress(g))||0;
    sumS+=sc; sumQ+=qi; sumP+=pr;
    var cat=String(g.cat||'Diğer'); if(!catMap[cat])catMap[cat]={cat:cat,count:0,sumP:0}; catMap[cat].count++; catMap[cat].sumP+=pr;
    var tr=(typeof goalCheckInTrend==='function')?goalCheckInTrend(g.id).state:'unknown';
    if(tr==='improving')s.checkInTrend.improving++; else if(tr==='declining')s.checkInTrend.declining++;
    else if(tr==='stable')s.checkInTrend.stable++; else s.checkInTrend.none++;
  });
  if(fg.length){ s.avg.smart=Math.round(sumS/fg.length*10)/10; s.avg.quality=Math.round(sumQ/fg.length); s.avg.progress=Math.round(sumP/fg.length); }
  s.byCategory=Object.keys(catMap).map(function(c){return {cat:c,count:catMap[c].count,avgProgress:Math.round(catMap[c].sumP/catMap[c].count)};})
    .sort(function(a,b){return b.count-a.count;});
  return s;
}
window.goalsDashboardStats=goalsDashboardStats;

/* ── Filtre durumu (yalnız görünüm; D'ye yazmaz) ── */
var GD_FILTER={};
function goalsDashboardSetFilter(key,val){ if(val==='')delete GD_FILTER[key]; else GD_FILTER[key]=val; if(typeof renderPage==='function')renderPage(); }
window.goalsDashboardSetFilter=goalsDashboardSetFilter;

/* ── Render helpers ── */
function _gdEsc(v){ return (typeof U!=='undefined'&&U&&U.esc)?U.esc(String(v==null?'':v)):String(v==null?'':v); }
function _gdCard(label,val,icon,color){ return (typeof statCard==='function')?statCard(label,val,icon,color)
  :'<div class="card" style="padding:12px 14px"><div style="font-size:11px;color:var(--t2)">'+_gdEsc(label)+'</div><div style="font-size:20px;font-weight:700;color:'+color+'">'+_gdEsc(val)+'</div></div>'; }
/* Inline-SVG donut (kütüphanesiz; renk yalnız vurgu — her dilim metin+sayı ile listelenir) */
function _gdDonut(segments,size){
  size=size||90; var r=size/2-8, cx=size/2, cy=size/2, C=2*Math.PI*r, total=0;
  segments.forEach(function(s){total+=s.value;});
  var off=0, arcs='';
  if(total>0)segments.forEach(function(s){ if(!s.value)return; var frac=s.value/total; var dash=frac*C;
    arcs+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="10" stroke-dasharray="'+dash+' '+(C-dash)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 '+cx+' '+cy+')"/>'; off+=dash; });
  else arcs='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--s2)" stroke-width="10"/>';
  return '<svg viewBox="0 0 '+size+' '+size+'" style="width:'+size+'px;height:'+size+'px;flex-shrink:0">'+arcs+'</svg>';
}
function _gdLegend(segments){ return '<div style="display:flex;flex-direction:column;gap:3px;font-size:11px">'+segments.map(function(s){
  return '<div style="display:flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:2px;background:'+s.color+';flex-shrink:0"></span><span style="color:var(--t2)">'+_gdEsc(s.label)+'</span><b style="margin-left:auto">'+s.value+'</b></div>';
}).join('')+'</div>'; }
function _gdBreakdownCard(title,segments){
  return '<div class="card" style="padding:14px 16px"><p style="font-weight:700;font-size:13px;margin-bottom:10px">'+_gdEsc(title)+'</p>'+
    '<div style="display:flex;gap:14px;align-items:center">'+_gdDonut(segments)+_gdLegend(segments)+'</div></div>';
}
function _gdFilterBtns(key,opts,cur){
  var h='<div style="display:flex;gap:4px;flex-wrap:wrap">';
  h+='<button type="button" class="btn btn-sm" style="background:'+(!cur?'var(--blue)':'var(--s2)')+';color:'+(!cur?"#fff":'var(--t2)')+'" data-k="'+key+'" data-v="" onclick="goalsDashboardSetFilter(this.dataset.k,this.dataset.v)">Tümü</button>';
  opts.forEach(function(o){ var a=String(cur)===String(o.v); h+='<button type="button" class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?"#fff":'var(--t2)')+'" data-k="'+key+'" data-v="'+_gdEsc(o.v)+'" onclick="goalsDashboardSetFilter(this.dataset.k,this.dataset.v)">'+_gdEsc(o.l)+'</button>'; });
  return h+'</div>';
}

function goalsDashboardHtml(filter){
  filter=filter||GD_FILTER;
  var goals=(typeof D!=='undefined'&&D.goals)?D.goals:[];
  var st=goalsDashboardStats(goals,filter);
  var HL=(typeof GOAL_HEALTH_LABELS!=='undefined')?GOAL_HEALTH_LABELS:{on_track:'Yolunda',at_risk:'Riskte',off_track:'Yolunda Değil',paused:'Duraklatıldı'};
  var CL=(typeof GOAL_CONFIDENCE_LABELS!=='undefined')?GOAL_CONFIDENCE_LABELS:{high:'Yüksek',medium:'Orta',low:'Düşük'};
  var PL=(typeof GOAL_PRIORITY_LABELS!=='undefined')?GOAL_PRIORITY_LABELS:{p1:'P1',p2:'P2',p3:'P3'};
  var ic2=(typeof ic==='function')?ic:function(){return '';};
  var years={}; goals.forEach(function(g){ years[goalYear(g)]=1; });
  var cats={}; goals.forEach(function(g){ cats[String(g.cat||'Diğer')]=1; });

  var _exFocus=(typeof execDailyFocusCardHtml==='function')?execDailyFocusCardHtml():''; // PLATFORM-P2: Günün En İyi Aksiyonu (türetilmiş, salt-okunur, 0 write)
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Hedef Panosu</h1><p class="sh-sub">Türetilmiş özet — '+st.total+' hedef</p></div>'+
    '<button class="btn btn-s btn-sm" onclick="gotoTab(\'goals\')">'+ic2('tgt',12)+' Hedefler</button></div>';
  h+=_exFocus; // PLATFORM-P2: Günün En İyi Aksiyonu kartı (panonun en üstünde, filtrelerden önce)

  /* Filtreler */
  h+='<div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px">';
  h+='<div><p class="lbl" style="margin-bottom:4px">Yıl</p>'+_gdFilterBtns('year',Object.keys(years).sort().map(function(y){return {v:y,l:y};}),filter.year)+'</div>';
  h+='<div><p class="lbl" style="margin-bottom:4px">Çeyrek</p>'+_gdFilterBtns('quarter',[{v:'Q1',l:'Q1'},{v:'Q2',l:'Q2'},{v:'Q3',l:'Q3'},{v:'Q4',l:'Q4'}],filter.quarter)+'</div>';
  h+='<div><p class="lbl" style="margin-bottom:4px">Durum</p>'+_gdFilterBtns('status',[{v:'active',l:'Aktif'},{v:'done',l:'Tamamlanan'}],filter.status)+'</div>';
  h+='<div><p class="lbl" style="margin-bottom:4px">Sağlık</p>'+_gdFilterBtns('health',['on_track','at_risk','off_track','paused'].map(function(k){return {v:k,l:HL[k]};}),filter.health)+'</div>';
  h+='<div><p class="lbl" style="margin-bottom:4px">Öncelik</p>'+_gdFilterBtns('priority',['p1','p2','p3'].map(function(k){return {v:k,l:PL[k]};}),filter.priority)+'</div>';
  if(Object.keys(cats).length>1)h+='<div><p class="lbl" style="margin-bottom:4px">Kategori</p>'+_gdFilterBtns('cat',Object.keys(cats).sort().map(function(c){return {v:c,l:c};}),filter.cat)+'</div>';
  h+='</div>';

  /* Özet kartlar */
  h+='<div class="g4" style="margin-bottom:14px">';
  h+=_gdCard('Toplam',st.total,'tgt','var(--blue)');
  h+=_gdCard('Aktif',st.active,'zap','var(--teal)');
  h+=_gdCard('Tamamlanan',st.done,'chk','var(--green)');
  h+=_gdCard('Geciken',st.overdue,'flame','var(--red)');
  h+='</div><div class="g4" style="margin-bottom:14px">';
  h+=_gdCard('Riskli',st.atRisk,'flame','var(--orange)');
  h+=_gdCard('Due Soon',st.dueSoon,'ci','var(--orange)');
  h+=_gdCard('Ort. SMART',st.avg.smart,'star','var(--purple)');
  h+=_gdCard('Ort. İlerleme','%'+st.avg.progress,'ref','var(--blue)');
  h+='</div>';

  /* Dağılımlar (donut) */
  h+='<div class="g3" style="margin-bottom:14px">';
  h+=_gdBreakdownCard('Sağlık',[{label:HL.on_track,value:st.health.on_track,color:'var(--green)'},{label:HL.at_risk,value:st.health.at_risk,color:'var(--orange)'},{label:HL.off_track,value:st.health.off_track,color:'var(--red)'},{label:HL.paused,value:st.health.paused,color:'var(--t3)'}]);
  h+=_gdBreakdownCard('Öncelik',[{label:PL.p1,value:st.priority.p1,color:'var(--red)'},{label:PL.p2,value:st.priority.p2,color:'var(--blue)'},{label:PL.p3,value:st.priority.p3,color:'var(--t3)'}]);
  h+=_gdBreakdownCard('Güven',[{label:CL.high,value:st.confidence.high,color:'var(--green)'},{label:CL.medium,value:st.confidence.medium,color:'var(--orange)'},{label:CL.low,value:st.confidence.low,color:'var(--red)'}]);
  h+='</div>';

  /* Check-in trend */
  h+='<div class="card" style="padding:14px 16px;margin-bottom:14px"><p style="font-weight:700;font-size:13px;margin-bottom:8px">İlerleme (Check-in) Trendi</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px">'+
    '<span class="pill p-green">İyileşiyor: '+st.checkInTrend.improving+'</span>'+
    '<span class="pill p-orange">Sabit: '+st.checkInTrend.stable+'</span>'+
    '<span class="pill p-red">Geriliyor: '+st.checkInTrend.declining+'</span>'+
    '<span class="pill p-gray">Kayıt yok: '+st.checkInTrend.none+'</span></div></div>';

  /* Kategori performansı */
  h+='<div class="card" style="padding:14px 16px"><p style="font-weight:700;font-size:13px;margin-bottom:10px">Kategori Performansı</p>';
  if(!st.byCategory.length)h+='<p style="font-size:11px;color:var(--t3)">Hedef yok.</p>';
  else st.byCategory.forEach(function(c){
    h+='<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>'+_gdEsc(c.cat)+' ('+c.count+')</span><span style="color:var(--t2)">%'+c.avgProgress+'</span></div>'+((typeof progBar==='function')?progBar(c.avgProgress):'')+'</div>';
  });
  h+='</div></div>';
  return h;
}
window.goalsDashboardHtml=goalsDashboardHtml;

function renderGoalsDashboard(){ if(typeof sh==='function')sh('pinner',goalsDashboardHtml(GD_FILTER)); }
window.renderGoalsDashboard=renderGoalsDashboard;
