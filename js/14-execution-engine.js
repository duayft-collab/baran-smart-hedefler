/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Platform P2 — EXECUTION INTELLIGENCE ENGINE (TÜRETİLMİŞ · SALT OKUNUR)
   "Kullanıcının şu an yapması gereken tek en yüksek-değerli aksiyon nedir?"
   Mevcut goal motorları YENİDEN KULLANILIR (07 SMART/priority/due/health, 11r
   risk/momentum/velocity/forecast/stale, 11o bağımlılık/blocked, 11m check-in,
   K1 wisdom). Yeni veri modeli/koleksiyon/payload/write/migration/network/AI YOK.
   Tek paylaşılan memoize snapshot; deterministik; 0 write/listener/timer.
   ══════════════════════════════════════════════════════════════════════════ */

function _exe(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _exIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _exGoals(){ return (typeof D!=='undefined'&&Array.isArray(D.goals))?D.goals:[]; }
function _exActive(){ return _exGoals().filter(function(g){ return g&&g.status!=='done'&&g.status!=='archived'; }); }
function _exGoalById(id){ return _exGoals().filter(function(g){ return String(g.id)===String(id); })[0]||null; }
function _exCall(fn,a,b,d){ try{ return (typeof window[fn]==='function')?window[fn](a,b):d; }catch(e){ return d; } }

/* ── Paylaşılan yürütme bağlamı (imza-tabanlı memoize; tek geçiş) ── */
var _EX_CACHE=null, _EX_SIG=null;
function execInvalidate(){ _EX_CACHE=null; _EX_SIG=null; }
window.execInvalidate=execInvalidate;
function _exSig(){
  var g=_exGoals(), n=g.length, s='';
  for(var i=0;i<n;i++){ var x=g[i]; s+='|'+x.id+':'+(x.status||'')+':'+(x.deadline||'')+':'+((x.health&&x.health.status)||'')+':'+((x.priority&&x.priority.level)||''); }
  var rel=(typeof D!=='undefined'&&Array.isArray(D.relations))?D.relations.length:0;
  var chk=(typeof gciList==='function')?gciList().length:((typeof D!=='undefined'&&Array.isArray(D.goalCheckIns))?D.goalCheckIns.length:0);
  return n+'|'+rel+'|'+chk+'|'+s;
}
function execContext(){
  var sig=_exSig();
  if(_EX_CACHE&&_EX_SIG===sig)return _EX_CACHE;
  var now=Date.now();
  _EX_CACHE=_exActive().map(function(g){
    return {
      id:g.id, title:String(g.title||g.desc||'').slice(0,90),
      due:_exCall('goalDueState',g,now,'none'),
      daysRemaining:_exCall('goalDaysRemaining',g,now,null),
      risk:_exCall('goalRiskScore',g,now,0),
      momentum:_exCall('goalMomentum',g,null,{state:'unknown',score:0}),
      blocked:_exCall('goalIsBlocked',g.id,null,false),
      priorityWeight:_exCall('goalPriorityWeight',g,null,2),
      health:_exCall('goalHealthStatus',g,null,'on_track'),
      staleDays:_exCall('goalStaleDays',g,now,null),
      hasCheckIns:_exCall('goalHasCheckIns',g.id,null,false),
      forecast:_exCall('goalForecast',g,now,null)
    };
  });
  _EX_SIG=sig; return _EX_CACHE;
}
window.execContext=execContext;

/* ── Deterministik yürütme skoru (risk + aciliyet + önem; mevcut kompozitler) ── */
var _EX_URG={overdue:100,today:92,tomorrow:82,this_week:64,due_soon:44,future:16,none:10,done:0};
var _EX_IMP={1:100,2:60,3:30};
function execScore(c){
  var urg=_EX_URG[c.due]!=null?_EX_URG[c.due]:10;
  var imp=_EX_IMP[c.priorityWeight]!=null?_EX_IMP[c.priorityWeight]:60;
  var risk=Math.max(0,Math.min(100,Number(c.risk)||0));
  return Math.round((risk*0.45+urg*0.33+imp*0.22)*10)/10;
}
window.execScore=execScore;
function _exEffort(c){ var f=c.forecast; if(f&&f.daysToComplete!=null)return f.daysToComplete<=1?'Düşük':(f.daysToComplete<=7?'Orta':'Yüksek'); return 'Orta'; }
function _exImpact(c){ return c.priorityWeight===1?'Yüksek':(c.priorityWeight===3?'Düşük':'Orta'); }
function _exReason(c){
  if(c.due==='overdue')return 'Gecikmiş';
  if(c.due==='today')return 'Bugün son gün';
  if(c.blocked)return 'Bağımlılık engeli';
  if(c.health==='off_track')return 'Sağlık: yolunda değil';
  if(c.momentum&&c.momentum.state==='declining')return 'İvme geriliyor';
  if(c.staleDays!=null&&c.staleDays>14)return c.staleDays+' gündür ilerleme yok';
  if(c.due==='this_week'||c.due==='tomorrow')return 'Bu hafta içinde';
  if(c.momentum&&c.momentum.state==='improving')return 'İvme yükseliyor — sürdür';
  return 'Öncelikli hedef';
}

/* ── Yürütme kuyruğu (sıralı; saf/deterministik) ── */
function execQueue(limit){
  var ctx=execContext().slice();
  var scored=ctx.map(function(c){ return { goalId:c.id, title:c.title, score:execScore(c), reason:_exReason(c), effort:_exEffort(c), impact:_exImpact(c), due:c.due, blocked:c.blocked, health:c.health, staleDays:c.staleDays }; });
  scored.sort(function(a,b){ if(b.score!==a.score)return b.score-a.score; return String(a.goalId)<String(b.goalId)?-1:(String(a.goalId)>String(b.goalId)?1:0); });
  return (limit==null)?scored:scored.slice(0,limit);
}
window.execQueue=execQueue;

/* ── Bugünün En İyi Aksiyonu (TEK birincil öneri) ── */
function execTodaysBestAction(){
  var q=execQueue(5); if(!q.length)return null;
  var top=q[0], g=_exGoalById(top.goalId), verb='continue', action='Devam et: '+top.title, blockerId=null, blockerLabel=null, reason=top.reason;
  if(top.blocked){ var br=_exCall('goalBlockReasons',top.goalId,null,[])||[]; var b=br[0]; blockerLabel=b&&b.label||null; blockerId=b&&(b.id||b.goalId)||null; verb='resolve_blocker'; action='Önce engeli çöz — sonra: '+top.title; reason=blockerLabel?('Engel: '+blockerLabel):'Bağımlılık engeli'; }
  else if(top.due==='overdue'||top.health==='off_track'||(top.staleDays!=null&&top.staleDays>14)){ verb='review'; action='Gözden geçir: '+top.title; }
  var wisdomId=null; if(typeof wiRecommend==='function'&&typeof wiCtxFromGoal==='function'&&g){ try{ var r=wiRecommend(wiCtxFromGoal(g),1)||[]; wisdomId=r[0]?r[0].id:null; }catch(e){} }
  return { goalId:top.goalId, title:top.title, verb:verb, action:action, reason:reason, effort:top.effort, impact:top.impact, blockerId:blockerId, blockerLabel:blockerLabel, wisdomId:wisdomId };
}
window.execTodaysBestAction=execTodaysBestAction;

/* ── Engel tespiti (salt-okunur) ── */
function _exLbl(g){ return {id:g.id,title:String(g.title||'').slice(0,80)}; }
function execBlockers(){
  var now=Date.now(), o={stalled:[],overdue:[],dependencyBottleneck:[],noRecentExecution:[],unhealthy:[],abandoned:[]};
  _exActive().forEach(function(g){
    var due=_exCall('goalDueState',g,now,'none'); if(due==='overdue')o.overdue.push(_exLbl(g));
    var stale=_exCall('goalStaleDays',g,now,null);
    if(stale!=null&&stale>14&&stale<=45)o.stalled.push(_exLbl(g)); else if(stale!=null&&stale>45)o.abandoned.push(_exLbl(g));
    if(!_exCall('goalHasCheckIns',g.id,null,true))o.noRecentExecution.push(_exLbl(g));
    if(_exCall('goalHealthStatus',g,null,'on_track')==='off_track')o.unhealthy.push(_exLbl(g));
    if(_exCall('goalIsBlocked',g.id,null,false))o.dependencyBottleneck.push(_exLbl(g));
  });
  o.total=o.stalled.length+o.overdue.length+o.dependencyBottleneck.length+o.noRecentExecution.length+o.unhealthy.length+o.abandoned.length;
  return o;
}
window.execBlockers=execBlockers;

/* ── İvme motoru (türetilmiş) ── */
function _exCheckStreak(){
  var list=(typeof gciList==='function')?gciList():((typeof D!=='undefined'&&Array.isArray(D.goalCheckIns))?D.goalCheckIns:[]);
  var days={}; list.forEach(function(c){ var d=String(c.checkInDate||'').slice(0,10); if(/^\d{4}-\d{2}-\d{2}$/.test(d))days[d]=1; });
  function dnum(s){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5):null; }
  function dstr(n){ var d=new Date(n*864e5); return d.getUTCFullYear()+'-'+('0'+(d.getUTCMonth()+1)).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2); }
  var t=Math.floor(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())/864e5);
  var start=days[dstr(t)]?t:(days[dstr(t-1)]?t-1:null); if(start==null)return 0;
  var len=0,cur=start; while(days[dstr(cur)]){ len++; cur--; } return len;
}
function execMomentum(){
  var act=_exActive(), n=act.length; if(!n)return {streak:_exCheckStreak(),score:0,slowdown:0,recovery:0,trend:'idle'};
  var sum=0,decl=0,impr=0;
  act.forEach(function(g){ var m=_exCall('goalMomentum',g,null,{score:0,state:'unknown'}); sum+=Number(m.score)||0; if(m.state==='declining')decl++; else if(m.state==='improving')impr++; });
  var score=Math.round(sum/n);
  return { streak:_exCheckStreak(), score:score, slowdown:decl, recovery:impr, trend: score>5?'improving':(score<-5?'declining':'stable') };
}
window.execMomentum=execMomentum;

/* ── Haftalık hazırlık (sunum-türevi) ── */
function execWeeklyReadiness(){
  var out=[], counts={Ready:0,'Needs Review':0,Blocked:0,'At Risk':0,Waiting:0,Completed:0};
  execContext().forEach(function(c){
    var s='Ready';
    if(c.blocked)s='Blocked';
    else if(c.due==='overdue'||c.health==='off_track')s='At Risk';
    else if((c.staleDays!=null&&c.staleDays>14)||!c.hasCheckIns)s='Needs Review';
    counts[s]++; out.push({id:c.id,title:c.title,status:s});
  });
  var done=_exGoals().filter(function(g){return g&&g.status==='done';}).length; counts.Completed=done;
  return { items:out, counts:counts };
}
window.execWeeklyReadiness=execWeeklyReadiness;

/* ── UI: Günün Odağı kartı (TEK öneri; dashboard/KPI yok) ── */
var _EX_READY_TR={Ready:'Hazır','Needs Review':'Gözden Geçir',Blocked:'Engelli','At Risk':'Riskli',Waiting:'Bekliyor',Completed:'Tamamlandı'};
function execDailyFocusCardHtml(){
  var a=execTodaysBestAction(); if(!a)return '';
  var vColor=a.verb==='resolve_blocker'?'var(--red)':(a.verb==='review'?'var(--orange)':'var(--green)');
  var h='<div class="card wd-anim" style="padding:14px 16px;margin-bottom:14px;max-width:100%;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2)">';
  h+='<div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--t3);font-weight:700;margin-bottom:8px">'+_exIc('zap',12,vColor)+' Günün En İyi Aksiyonu</div>';
  h+='<p style="font-size:15px;font-weight:800;color:var(--t);word-break:break-word;margin:0">'+_exe(a.action)+'</p>';
  if(a.reason)h+='<p style="font-size:11px;color:var(--t3);margin-top:4px">'+_exe(a.reason)+'</p>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px">';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--t2)">Efor: '+_exe(a.effort)+'</span>';
  h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--t2)">Etki: '+_exe(a.impact)+'</span>';
  if(a.blockerLabel)h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--red)">Engel: '+_exe(String(a.blockerLabel).slice(0,28))+'</span>';
  h+='</div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px">';
  h+='<button class="btn btn-g btn-sm" data-id="'+_exe(String(a.goalId))+'" onclick="if(typeof openGoalDetail===\'function\')openGoalDetail(+this.dataset.id)" title="Hedefi aç">'+_exIc('tgt',11,'var(--t3)')+' Hedefi Aç</button>';
  if(a.wisdomId)h+='<button class="btn btn-g btn-sm" data-id="'+_exe(String(a.wisdomId))+'" onclick="if(typeof wiOpen===\'function\')wiOpen(this.dataset.id)" title="İlgili bilgelik">'+_exIc('qt',11,'var(--t3)')+' İlgili Bilgelik</button>';
  h+='</div></div>';
  return h;
}
window.execDailyFocusCardHtml=execDailyFocusCardHtml;
