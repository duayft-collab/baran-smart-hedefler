/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Platform P4 — AKSİYON-MERKEZLİ GÜNLÜK YÜRÜTME EKRANI ("Bugün")
   (TÜRETİLMİŞ · SALT OKUNUR). Bilgi göstermez — YÜRÜTMEYİ SÜRÜKLER. Kullanıcı
   "şimdi ne yapmalıyım?" diye sormaz; ekran zaten yanıtlar. Her görünür öğe ya
   bir karar verdirir ya da bir sonraki aksiyonu anında çalıştırır. P2 yürütme
   motoru + goal analytics + bağımlılık + K1 wisdom + karar motoru YENİDEN
   KULLANILIR; skor/risk/ivme/bağımlılık/wisdom mantığı TEKRARLANMAZ. Yeni veri
   modeli/koleksiyon/payload/ayar/kalıcılık/tamamlama-durumu/ağ/AI/takvim/
   bildirim/zamanlayıcı/dinleyici YOK. Tek memoize snapshot; deterministik;
   0 yazma. Hedef açan her aksiyon openGoalDetail(+id) kullanır.
   ══════════════════════════════════════════════════════════════════════════ */

function _dwe(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _dwic(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _dwCall(fn,a,b,d){ try{ return (typeof window[fn]==='function')?window[fn](a,b):d; }catch(e){ return d; } }
function _dwExec(fn,a,d){ try{ return (typeof window[fn]==='function')?window[fn](a):d; }catch(e){ return d; } }

/* ── Etiketler (yalnız sunum) ── */
var _DW_DUE_TR={overdue:'Gecikmiş',today:'Bugün son gün',tomorrow:'Yarın',this_week:'Bu hafta',due_soon:'Yakında',future:'İleride',none:'Tarih yok',done:'Bitti'};
var _DW_MOM_TR={improving:'yükseliyor',declining:'geriliyor',stable:'sabit',unknown:'belirsiz'};
var _DW_FLOW=[['ŞİMDİ','var(--green)'],['SONRA','var(--blue)'],['ARDINDAN','var(--t2)'],['BUGÜN İLERİDE','var(--t3)']];

function _dwDuration(effort,blockedOrReview){
  if(blockedOrReview)return 20;
  return effort==='Yüksek'?90:(effort==='Düşük'?30:60);
}
function _dwImpactRank(imp){ return imp==='Yüksek'?0:(imp==='Orta'?1:2); }
function _dwItemVerb(it){
  if(it.blocked)return 'resolve_blocker';
  if(it.due==='overdue'||it.health==='off_track'||(it.staleDays!=null&&it.staleDays>14))return 'review';
  return 'continue';
}
function _dwBlockType(verb,effort){
  if(verb==='resolve_blocker')return 'Engel';
  if(verb==='review')return 'Gözden Geçir';
  return effort==='Yüksek'?'Derin Çalışma':'Yürütme';
}
function _dwHHMM(mins){ var h=Math.floor(mins/60)%24, m=mins%60; return ('0'+h).slice(-2)+':'+('0'+m).slice(-2); }

/* ══ Paylaşılan yürütme bağlamı (memoize; yukarı-akış execContext referansına bağlı) ══ */
var _DW_CACHE=null, _DW_CTXREF=null;
function dailyInvalidate(){ _DW_CACHE=null; _DW_CTXREF=null; }
window.dailyInvalidate=dailyInvalidate;

function dailyExecutionContext(){
  var ctx=_dwExec('execContext',undefined,[])||[];
  if(_DW_CACHE&&_DW_CTXREF===ctx)return _DW_CACHE;   /* değişmemiş state → aynı referans */
  var t=new Date(); var dateStr=t.getFullYear()+'-'+('0'+(t.getMonth()+1)).slice(-2)+'-'+('0'+t.getDate()).slice(-2);
  var snap={
    date:dateStr,
    activeCount:ctx.length,
    mit:dailyMostImportantTask(),
    flow:dailyExecutionFlow(),
    blocks:dailyTimeBlocks(),
    deepWork:dailyDeepWorkCandidate(),
    later:dailyLaterList(3),
    wisdomId:_dwWisdomIdForBest()
  };
  _DW_CTXREF=ctx; _DW_CACHE=snap; return snap;
}
window.dailyExecutionContext=dailyExecutionContext;

function _dwCtxById(id){
  var ctx=_dwExec('execContext',undefined,[])||[];
  for(var i=0;i<ctx.length;i++){ if(String(ctx[i].id)===String(id))return ctx[i]; }
  return null;
}
function _dwWisdomIdForBest(){ var a=_dwExec('execTodaysBestAction',undefined,null); return a&&a.wisdomId?a.wisdomId:null; }

/* ══ 1) Bugünün En Önemli İşi (TEK birincil; execTodaysBestAction türevi) ══ */
function dailyMostImportantTask(){
  var a=_dwExec('execTodaysBestAction',undefined,null); if(!a)return null;
  var c=_dwCtxById(a.goalId);
  return {
    goalId:a.goalId, title:a.title, verb:a.verb, action:a.action, reason:a.reason,
    effort:a.effort, impact:a.impact,
    risk:c?Math.round(Number(c.risk)||0):0,
    blocked:!!(c?c.blocked:a.verb==='resolve_blocker'),
    blockerLabel:a.blockerLabel||null,
    wisdomId:a.wisdomId||null
  };
}
window.dailyMostImportantTask=dailyMostImportantTask;

/* ══ 2) Yürütme akışı — ŞİMDİ / SONRA / ARDINDAN / BUGÜN İLERİDE (her biri TEK iş) ══ */
function _dwPlanRow(it,i){
  var verb=_dwItemVerb(it), blockedOrReview=it.blocked||verb==='review';
  return { order:i+1, goalId:it.goalId, title:it.title,
    verb:verb, action:(verb==='review'?'Gözden geçir':(verb==='resolve_blocker'?'Önce engeli çöz':'Devam et')),
    reason:it.reason, effort:it.effort, impact:it.impact, blocked:!!it.blocked,
    focusMinutes:_dwDuration(it.effort,blockedOrReview) };
}
function dailyPlan(limit){
  limit=(limit==null)?5:limit;
  return (_dwExec('execQueue',limit,[])||[]).map(_dwPlanRow);
}
window.dailyPlan=dailyPlan;

function dailyExecutionFlow(){
  return dailyPlan(4).map(function(p,i){
    return { slot:_DW_FLOW[i]?_DW_FLOW[i][0]:'BUGÜN İLERİDE', color:_DW_FLOW[i]?_DW_FLOW[i][1]:'var(--t3)',
      goalId:p.goalId, title:p.title, action:p.action, reason:p.reason, effort:p.effort, focusMinutes:p.focusMinutes, blocked:p.blocked };
  });
}
window.dailyExecutionFlow=dailyExecutionFlow;

/* ══ 3) Akıllı zaman blokları — gerçekçi saat dizisi (09:00 başlangıç; türetilmiş) ══ */
function dailyTimeBlocks(){
  var t=9*60, out=[];   /* 09:00 iş günü çıpası — deterministik, takvime yazılmaz */
  dailyPlan(4).forEach(function(p){
    var start=t, end=t+p.focusMinutes;
    out.push({ order:p.order, goalId:p.goalId, title:p.title, minutes:p.focusMinutes,
      start:_dwHHMM(start), end:_dwHHMM(end), type:_dwBlockType(p.verb,p.effort) });
    t=end+10;   /* bloklar arası 10 dk ara */
  });
  return out;
}
window.dailyTimeBlocks=dailyTimeBlocks;

/* ══ 4) Derin Çalışma adayı (en yüksek etkili, engelsiz) ══ */
function dailyDeepWorkCandidate(){
  var q=(_dwExec('execQueue',null,[])||[]).filter(function(it){ return !it.blocked; });
  if(!q.length)return null;
  q=q.slice().sort(function(a,b){
    var ra=_dwImpactRank(a.impact), rb=_dwImpactRank(b.impact);
    if(ra!==rb)return ra-rb;
    if(b.score!==a.score)return b.score-a.score;
    return String(a.goalId)<String(b.goalId)?-1:1;
  });
  var top=q[0], verb=_dwItemVerb(top);
  return { goalId:top.goalId, title:top.title, suggestedDuration:_dwDuration(top.effort,verb==='review'),
    reason:'En yüksek etkili engelsiz iş — kesintisiz derin çalışmaya en uygun', expectedImpact:top.impact };
}
window.dailyDeepWorkCandidate=dailyDeepWorkCandidate;

/* ══ 5) Bugünün Önceliği Değil (pozitif çerçeve; MIT asla dahil; gizlemez) ══ */
function dailyLaterList(limit){
  limit=(limit==null)?3:limit;
  var q=_dwExec('execQueue',null,[])||[];
  var picks=[], seen={};
  function add(it,reason){ if(seen[it.goalId])return; seen[it.goalId]=1; picks.push({goalId:it.goalId,title:it.title,reason:reason}); }
  for(var i=q.length-1;i>=1;i--){ var it=q[i];
    if(it.blocked){ add(it,'Dış bağımlılık bekleniyor — sırası gelince'); }
    else if(it.impact==='Düşük'){ add(it,'Bugünün önceliklerine göre düşük etki'); }
    else if(it.due==='future'||it.due==='none'){ add(it,'Zamanı henüz gelmedi — planlı beklemede'); }
  }
  for(var j=q.length-1;j>=1&&picks.length<limit;j--){ add(q[j],'Bugünün öncelikleri arasında değil'); }
  return picks.slice(0,limit);
}
window.dailyLaterList=dailyLaterList;

/* ══ İkincil aksiyonlar (yalnız GERÇEK, AYRI, salt-okunur hedefe götürenler; yoksa gizli) ══ */
function _dwRelatedDecisionId(goalId){
  if(typeof getRelatedEntities!=='function')return null;
  var rel=[]; try{ rel=getRelatedEntities('goal',goalId)||[]; }catch(e){ rel=[]; }
  for(var i=0;i<rel.length;i++){ var e=rel[i]&&rel[i].entity; if(e&&e.type==='decision'&&e.id!=null)return e.id; }
  return null;
}
function _dwSecondaryActions(mit){
  var acts=[];
  if(mit.blocked){
    var br=_dwCall('goalBlockReasons',mit.goalId,null,[])||[]; var b=br[0];
    var bid=b&&b.goal&&b.goal.id!=null?b.goal.id:(b&&b.id!=null?b.id:null);
    if(bid!=null)acts.push({icon:'csq',label:'Engeli Aç',aid:String(bid),oc:"if(typeof openGoalDetail===\'function\')openGoalDetail(+this.dataset.aid)"});
  }
  var dec=_dwRelatedDecisionId(mit.goalId);
  if(dec)acts.push({icon:'layers',label:'Kararı Aç',aid:String(dec),oc:"if(typeof djOpenDetail===\'function\')djOpenDetail(this.dataset.aid)"});
  if(mit.wisdomId)acts.push({icon:'qt',label:'Bilgeliği Aç',aid:String(mit.wisdomId),oc:"if(typeof wiOpen===\'function\')wiOpen(this.dataset.aid)"});
  return acts;
}

/* ══ UI ══ */
function _dwStyle(){
  return '<style>.dw-ws :focus-visible{outline:2px solid var(--blue);outline-offset:2px;border-radius:6px}'+
    '.dw-ws .dw-act{transition:background .12s ease}'+
    '@media (prefers-reduced-motion:reduce){.dw-ws .dw-act{transition:none}}'+
    '.dw-ws details>summary{list-style:none;cursor:pointer}.dw-ws details>summary::-webkit-details-marker{display:none}</style>';
}
function _dwSecondaryHtml(mit){
  var acts=_dwSecondaryActions(mit); if(!acts.length)return '';
  var h='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
  acts.forEach(function(a){ h+='<button class="btn btn-s btn-sm dw-act" data-aid="'+_dwe(a.aid)+'" onclick="'+a.oc+'" title="'+_dwe(a.label)+'">'+_dwic(a.icon,12,'var(--t2)')+' '+_dwe(a.label)+'</button>'; });
  h+='</div>'; return h;
}
function _dwWhyHtml(mit){
  var c=_dwCtxById(mit.goalId);
  var rows=[['Aciliyet',c?(_DW_DUE_TR[c.due]||c.due):'—'],['Önem',mit.impact],['Engel',mit.blocked?('Var'+(mit.blockerLabel?' — '+mit.blockerLabel:'')):'Yok'],['İvme',c&&c.momentum?(_DW_MOM_TR[c.momentum.state]||'belirsiz'):'belirsiz']];
  var h='<details style="margin-top:12px"><summary style="font-size:12px;font-weight:600;color:var(--t3)">'+_dwic('brain',12,'var(--t3)')+' Neden önce bu?</summary><div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">';
  rows.forEach(function(r){ h+='<div style="display:flex;gap:8px;font-size:12px"><span style="min-width:60px;color:var(--t3);font-weight:600">'+_dwe(r[0])+'</span><span style="color:var(--t2)">'+_dwe(r[1])+'</span></div>'; });
  h+='</div></details>'; return h;
}
function _dwMitHtml(mit){
  var vc=mit.blocked?'var(--red)':(mit.verb==='review'?'var(--orange)':'var(--green)');
  var h='<div style="background:var(--s);border:1px solid var(--bd);border-radius:16px;padding:20px 22px">';
  h+='<p style="font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--t3);text-transform:uppercase;display:flex;align-items:center;gap:6px">'+_dwic('zap',12,vc)+' Bugünün En Önemli İşi</p>';
  h+='<p style="font-size:21px;font-weight:800;color:var(--t1);line-height:1.25;margin-top:10px">'+_dwe(mit.title)+'</p>';
  h+='<p style="font-size:14px;color:var(--t2);margin-top:6px">'+_dwe(mit.action)+' — '+_dwe(mit.reason)+'.</p>';
  h+='<p style="font-size:13px;color:var(--t3);margin-top:8px;font-style:italic">Bunu bugün tamamlarsan günün başarılı sayılır.</p>';
  h+='<div style="margin-top:14px"><button class="btn btn-p dw-act" data-id="'+_dwe(String(mit.goalId))+'" onclick="if(typeof openGoalDetail===\'function\')openGoalDetail(+this.dataset.id)" style="font-size:14px;padding:10px 20px">'+_dwic('tgt',13,'#fff')+' Hedefi Aç</button></div>';
  h+=_dwSecondaryHtml(mit);
  h+=_dwWhyHtml(mit);
  h+='</div>';
  return h;
}
function _dwWhyNextMap(){
  var map={}; if(typeof execIntelligentSequence!=='function')return map;
  try{ (execIntelligentSequence()||[]).forEach(function(s){ map[String(s.goalId)]=s.whyNext; }); }catch(e){}
  return map;
}
function _dwFlowHtml(flow){
  if(flow.length<=1)return '';
  var wn=_dwWhyNextMap();   /* P6: "neden sonra" akıllı sıradan (varsa) */
  var h='<div style="margin-top:24px"><p style="font-size:13px;font-weight:700;color:var(--t2);margin-bottom:10px">Yürütme Akışı</p>';
  flow.slice(1).forEach(function(f){
    var why=wn[String(f.goalId)];
    h+='<div style="padding:10px 0;border-top:1px solid var(--bd)">';
    h+='<p style="font-size:10px;font-weight:700;letter-spacing:.5px;color:'+f.color+';text-transform:uppercase">'+_dwe(f.slot)+'</p>';
    h+='<button class="btn-link dw-act" data-id="'+_dwe(String(f.goalId))+'" onclick="if(typeof openGoalDetail===\'function\')openGoalDetail(+this.dataset.id)" style="background:none;border:none;padding:0;text-align:left;font-size:15px;font-weight:700;color:var(--t1);cursor:pointer;margin-top:3px">'+_dwe(f.action)+': '+_dwe(f.title)+'</button>';
    if(why)h+='<p style="font-size:11px;color:var(--t2);margin-top:2px;font-style:italic">Neden sonra: '+_dwe(why)+'</p>';
    h+='<p style="font-size:12px;color:var(--t3);margin-top:2px">'+_dwe(f.reason)+' · Efor: '+_dwe(f.effort)+' · '+f.focusMinutes+' dk odak</p>';
    h+='</div>';
  });
  h+='</div>'; return h;
}
function _dwBlocksHtml(blocks){
  if(blocks.length<=1)return '';
  var h='<div style="margin-top:24px"><p style="font-size:13px;font-weight:700;color:var(--t2);margin-bottom:10px">Zaman Blokları</p>';
  blocks.forEach(function(b,i){
    if(i>0)h+='<div style="text-align:center;color:var(--t3);font-size:12px;line-height:1">↓</div>';
    h+='<div style="display:flex;gap:12px;align-items:baseline;padding:6px 0">';
    h+='<span style="font-size:13px;font-weight:700;color:var(--t2);white-space:nowrap;font-variant-numeric:tabular-nums">'+b.start+'–'+b.end+'</span>';
    h+='<div style="flex:1;min-width:0"><span style="font-size:11px;font-weight:600;color:var(--t3)">'+_dwe(b.type)+'</span><br><span style="font-size:14px;font-weight:600;color:var(--t1)">'+_dwe(b.title)+'</span></div>';
    h+='<span style="font-size:12px;color:var(--t3);white-space:nowrap">'+b.minutes+' dk</span></div>';
  });
  h+='<p style="font-size:10px;color:var(--t3);margin-top:6px">Yalnızca öneri — takvime yazılmaz.</p></div>'; return h;
}
function _dwDeepHtml(dw){
  if(!dw)return '';
  var h='<div style="margin-top:24px"><p style="font-size:13px;font-weight:700;color:var(--t2);margin-bottom:8px">Derin Çalışma</p>';
  h+='<div style="background:var(--s2);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px">'+_dwic('flame',18,'var(--orange)');
  h+='<div style="flex:1;min-width:0"><button class="btn-link dw-act" data-id="'+_dwe(String(dw.goalId))+'" onclick="if(typeof openGoalDetail===\'function\')openGoalDetail(+this.dataset.id)" style="background:none;border:none;padding:0;text-align:left;font-size:14px;font-weight:700;color:var(--t1);cursor:pointer">'+_dwe(dw.title)+'</button>';
  h+='<p style="font-size:11px;color:var(--t3);margin-top:1px">'+_dwe(dw.reason)+'</p></div>';
  h+='<span style="font-size:12px;color:var(--t2);white-space:nowrap">'+dw.suggestedDuration+' dk</span></div></div>'; return h;
}
function _dwLaterHtml(list){
  if(!list.length)return '';
  var h='<div style="margin-top:24px"><p style="font-size:13px;font-weight:700;color:var(--t2);margin-bottom:8px">Bugünün Önceliği Değil</p><div style="display:flex;flex-direction:column;gap:6px">';
  list.forEach(function(it){ h+='<div style="display:flex;gap:8px;font-size:12px;align-items:baseline"><span>'+_dwic('ar',11,'var(--t3)')+'</span><span><span style="color:var(--t2);font-weight:600">'+_dwe(it.title)+'</span> — <span style="color:var(--t3)">'+_dwe(it.reason)+'</span></span></div>'; });
  h+='</div></div>'; return h;
}
function _dwWisdomHtml(wid){
  if(!wid)return '';
  var q=(typeof wqById==='function')?wqById(wid):null; if(!q||!q.quote)return '';
  return '<div style="margin-top:26px;padding-top:14px;border-top:1px solid var(--bd)"><p style="font-size:13px;color:var(--t3);font-style:italic;line-height:1.5">'+_dwic('qt',12,'var(--t3)')+' '+_dwe(q.quote)+(q.author?' <span style="opacity:.7">— '+_dwe(q.author)+'</span>':'')+'</p></div>';
}
function _dwEmptyHtml(){
  var h='<div style="text-align:center;padding:44px 20px">'+_dwic('chk',30,'var(--t3)');
  h+='<p style="margin-top:10px;font-size:15px;font-weight:600;color:var(--t2)">Bugün için aktif yürütme yok.</p>';
  h+='<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px">';
  h+='<button class="btn btn-s dw-act" onclick="if(typeof gotoTab===\'function\')gotoTab(\'goals\')">'+_dwic('tgt',12,'var(--t2)')+' Hedefleri Gözden Geçir</button>';
  h+='<button class="btn btn-p dw-act" onclick="if(typeof openGoalForm===\'function\')openGoalForm()">'+_dwic('plus',12,'#fff')+' Hedef Oluştur</button>';
  h+='<button class="btn btn-s dw-act" onclick="if(typeof gotoTab===\'function\')gotoTab(\'decisions\')">'+_dwic('layers',12,'var(--t2)')+' Kararları Gözden Geçir</button>';
  h+='</div></div>';
  return h;
}
function dailyWorkspaceHtml(){
  var s=dailyExecutionContext();
  var h='<div class="dw-ws fade" style="max-width:640px;margin:0 auto">'+_dwStyle();
  h+='<div style="margin-bottom:16px"><p style="font-size:22px;font-weight:800;color:var(--t1)">Bugün</p><p style="font-size:12px;color:var(--t3)">'+_dwe(s.date)+' · '+s.activeCount+' aktif hedef</p></div>';
  if(!s.mit){ h+=_dwEmptyHtml()+'</div>'; return h; }
  h+=_dwMitHtml(s.mit);
  if(typeof execOsInsightsHtml==='function'){ try{ h+=execOsInsightsHtml(); }catch(e){} }   /* P6: sessiz adaptif içgörü paneli (≤1 öneri/uyarı/fırsat/öncelik) */
  h+=_dwFlowHtml(s.flow);
  h+=_dwBlocksHtml(s.blocks);
  h+=_dwDeepHtml(s.deepWork);
  h+=_dwLaterHtml(s.later);
  h+=_dwWisdomHtml(s.wisdomId);
  h+='</div>';
  return h;
}
window.dailyWorkspaceHtml=dailyWorkspaceHtml;

function renderDailyWorkspace(){ if(typeof sh==='function')sh('pinner',dailyWorkspaceHtml()); }
window.renderDailyWorkspace=renderDailyWorkspace;
