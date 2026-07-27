/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Phase 4 P1 — GOAL DEPENDENCIES (Bağımlılıklar)
   Mevcut D.relations (11h) üzerine TÜRETİLMİŞ katman. Yeni ilişki motoru/koleksiyon YOK.
   Goal'a dependency alanı GÖMÜLMEZ. depends_on/blocks/supports zaten REL_TYPES'te.
   Cycle/self/dup/deleted engellenir (bounded DFS, sonsuz döngü YOK). Critical path saf türetim.
   İlişki oluşturma/silme mevcut relAdd/relDelete + tek save/ACK ile; goal DEĞİŞMEZ.
   Harness-güvenli: üst-seviye DOM/timer YOK.
   ══════════════════════════════════════════════════════════════════════════ */

var DEP_TYPES=['depends_on','blocks','supports'];
function _depGoal(id){ return (typeof D!=='undefined'&&D.goals?D.goals:[]).filter(function(g){return String(g.id)===String(id);})[0]||null; }
function _depOut(id,t){ var l=(typeof getOutgoingRelations==='function')?getOutgoingRelations('goal',id):[]; return l.filter(function(r){return r.relationType===t;}); }
function _depIn(id,t){ var l=(typeof getIncomingRelations==='function')?getIncomingRelations('goal',id):[]; return l.filter(function(r){return r.relationType===t;}); }
function _depRow(r,otherId){ var g=_depGoal(otherId); return {id:otherId,relationId:r.id,goal:g,title:g?g.title:null,status:g?g.status:null,available:!!g}; }

/* ── Türetilmiş sorgular (mutasyon yok) ── */
function goalDependencies(goalId){
  var waitingFor=_depOut(goalId,'depends_on').map(function(r){return _depRow(r,r.targetId);});
  var blocking=_depOut(goalId,'blocks').map(function(r){return _depRow(r,r.targetId);});
  var supporting=_depOut(goalId,'supports').map(function(r){return _depRow(r,r.targetId);});
  var incBlocks=_depIn(goalId,'blocks').map(function(r){return _depRow(r,r.sourceId);});
  // "Bu hedefi engelleyenler" = gelen blocks (aktif) + tamamlanmamış beklenen hedefler
  var seen={}, blockedBy=[];
  incBlocks.forEach(function(x){ if(x.available&&x.goal.status!=='done'&&!seen[x.id]){seen[x.id]=1;blockedBy.push(x);} });
  waitingFor.forEach(function(x){ if(x.available&&x.goal.status!=='done'&&!seen[x.id]){seen[x.id]=1;blockedBy.push(x);} });
  return {waitingFor:waitingFor,blocking:blocking,supporting:supporting,blockedBy:blockedBy,
    count:waitingFor.length+blocking.length+supporting.length};
}
function goalIsBlocked(goalId){ return goalDependencies(goalId).blockedBy.length>0; }
function goalBlockReasons(goalId){ return goalDependencies(goalId).blockedBy; }

/* ── "Waits-for" grafiği (depends_on: A→B; blocks A,B: B→A). supports dahil değil. ── */
function _depWaitsAdj(){
  var adj={}, rels=(typeof D!=='undefined'&&Array.isArray(D.relations))?D.relations:[];
  rels.forEach(function(r){
    if(r.sourceType!=='goal'||r.targetType!=='goal')return;
    if(r.relationType==='depends_on'){ (adj[r.sourceId]=adj[r.sourceId]||[]).push(String(r.targetId)); }
    else if(r.relationType==='blocks'){ (adj[r.targetId]=adj[r.targetId]||[]).push(String(r.sourceId)); }
  });
  return adj;
}
function _depReaches(start,target,adj){
  var stack=[String(start)], seen={}, guard=0;
  while(stack.length&&guard<100000){ guard++; var n=stack.pop(); if(String(n)===String(target))return true; if(seen[n])continue; seen[n]=1;
    (adj[n]||[]).forEach(function(m){ if(!seen[m])stack.push(m); }); }
  return false;
}
function hasCircularDependency(fromId,toId,type){
  if(type==='supports')return false;
  var adj=_depWaitsAdj(), waiter,waitee;
  if(type==='blocks'){ waiter=String(toId); waitee=String(fromId); } else { waiter=String(fromId); waitee=String(toId); }
  if(waiter===waitee)return true;
  return _depReaches(waitee,waiter,adj);   // waitee zaten waiter'a ulaşıyorsa yeni kenar döngü kapatır
}

var DEP_ERR_TR={INVALID_DEP_TYPE:'Geçersiz bağımlılık türü.',SELF_DEPENDENCY:'Bir hedef kendine bağımlı olamaz.',
  SOURCE_NOT_FOUND:'Kaynak hedef bulunamadı.',TARGET_NOT_FOUND:'Bağlanılacak hedef bulunamadı (silinmiş olabilir).',
  DUPLICATE_DEPENDENCY:'Bu bağımlılık zaten var.',CIRCULAR_DEPENDENCY:'Döngüsel bağımlılık oluşur (A→B→…→A).'};
function canAddGoalDependency(fromId,toId,type){
  if(DEP_TYPES.indexOf(type)<0)return {ok:false,error:'INVALID_DEP_TYPE',message:DEP_ERR_TR.INVALID_DEP_TYPE};
  if(String(fromId)===String(toId))return {ok:false,error:'SELF_DEPENDENCY',message:DEP_ERR_TR.SELF_DEPENDENCY};
  if(!_depGoal(fromId))return {ok:false,error:'SOURCE_NOT_FOUND',message:DEP_ERR_TR.SOURCE_NOT_FOUND};
  if(!_depGoal(toId))return {ok:false,error:'TARGET_NOT_FOUND',message:DEP_ERR_TR.TARGET_NOT_FOUND};
  if(typeof relFind==='function'&&relFind('goal',String(fromId),'goal',String(toId),type))return {ok:false,error:'DUPLICATE_DEPENDENCY',message:DEP_ERR_TR.DUPLICATE_DEPENDENCY};
  if(hasCircularDependency(fromId,toId,type))return {ok:false,error:'CIRCULAR_DEPENDENCY',message:DEP_ERR_TR.CIRCULAR_DEPENDENCY};
  return {ok:true};
}

/* ── Critical path / depth / blocked count (bounded, cycle-güvenli) ── */
function _depLongestFrom(id,adj,memo,onstack){
  id=String(id); if(memo[id]!=null)return memo[id]; if(onstack[id])return [id]; onstack[id]=1;
  var best=[id];
  (adj[id]||[]).forEach(function(m){ var p=_depLongestFrom(m,adj,memo,onstack); if(p.length+1>best.length)best=[id].concat(p); });
  onstack[id]=0; memo[id]=best; return best;
}
function criticalPath(){
  var adj=_depWaitsAdj(), goals=(typeof D!=='undefined'&&D.goals?D.goals:[]), memo={}, best=[];
  goals.forEach(function(g){ var p=_depLongestFrom(g.id,adj,memo,{}); if(p.length>best.length)best=p; });
  return best;
}
function dependencyDepth(goalId){ return _depLongestFrom(goalId,_depWaitsAdj(),{},{}).length-1; }
function blockedGoalCount(){ return (typeof D!=='undefined'&&D.goals?D.goals:[]).filter(function(g){return goalIsBlocked(g.id);}).length; }
function _depOnCriticalPath(goalId){ var cp=criticalPath(); for(var i=0;i<cp.length;i++)if(String(cp[i])===String(goalId))return true; return false; }

/* ── Add / Remove (mevcut relAdd/relDelete; goal DEĞİŞMEZ; tek save→ACK) ── */
function _depToast(m,e){ var f=(typeof toast==='function')?toast:((typeof wqToast==='function')?wqToast:null); if(f)f(m,e); }
function _depAwaitAck(revBefore,okMsg){
  _depToast('Bağımlılık buluta kaydediliyor…');
  if(typeof CLOUD==='undefined'){ _depToast(okMsg); return; }
  var t=0; var iv=setInterval(function(){ t++;
    if(CLOUD.conflict){ clearInterval(iv); _depToast('Bağımlılık oluşturuldu ancak senkronizasyon çakışması oluştu.',true); return; }
    if(!CLOUD.pendingMutation&&Number(CLOUD.revision||0)>revBefore){ clearInterval(iv); _depToast(okMsg); return; }
    if(t>=34){ clearInterval(iv); _depToast('Bağımlılık yerel olarak kaydedildi; bulut senkronizasyonu bekleniyor.',true); }
  },300);
}
function addGoalDependency(fromId,toId,type){
  var v=canAddGoalDependency(fromId,toId,type);
  if(!v.ok){ _depToast(v.message||v.error,true); return v; }
  var revBefore=(typeof CLOUD!=='undefined')?Number(CLOUD.revision||0):0;
  if(typeof snap==='function')snap();
  var res=relAdd({sourceType:'goal',sourceId:String(fromId),targetType:'goal',targetId:String(toId),relationType:type});
  if(res&&res.ok&&typeof save==='function')save();
  _depPickerOpen=false; _depRerender(fromId);
  _depAwaitAck(revBefore,'Bağımlılık buluta kaydedildi.');
  return {ok:!!(res&&res.ok),relation:res&&res.relation};
}
function removeGoalDependency(relId,goalId){
  if(typeof confirm==='function'&&!confirm('Bu bağımlılık kaldırılsın mı?'))return {ok:false};
  var revBefore=(typeof CLOUD!=='undefined')?Number(CLOUD.revision||0):0;
  if(typeof snap==='function')snap();
  if(typeof relDelete==='function')relDelete(relId);
  if(typeof save==='function')save();
  _depRerender(goalId);
  _depAwaitAck(revBefore,'Bağımlılık kaldırıldı.');
  return {ok:true};
}

/* ── Filtreler (runtime) ── */
function goalMatchesDependencyFilter(goalId,filter){
  var d=goalDependencies(goalId);
  var incAny=(_depIn(goalId,'depends_on').length+_depIn(goalId,'blocks').length+_depIn(goalId,'supports').length);
  var outAny=d.count;
  if(filter==='blocked')return goalIsBlocked(goalId);
  if(filter==='blockingOthers')return (_depIn(goalId,'depends_on').length>0)||(d.blocking.length>0);
  if(filter==='hasDeps')return outAny>0||incAny>0;
  if(filter==='independent')return outAny===0&&incAny===0;
  return true;
}

/* ── Badge (metin+ikon; renk tek sinyal değil) ── */
function goalDependencyBadge(g){
  if(!g)return ''; var id=g.id; var d=goalDependencies(id);
  var incAny=(_depIn(id,'depends_on').length+_depIn(id,'blocks').length);
  if(!d.count&&!incAny)return '';
  var parts=[];
  if(goalIsBlocked(id))parts.push('<span class="pill p-red" style="font-size:9px" title="Engelli">&#9940; Engelli</span>');
  else if(d.count||incAny)parts.push('<span class="pill p-blue" style="font-size:9px" title="Bağımlılık">&#128279; Bağımlı</span>');
  if(_depOnCriticalPath(id))parts.push('<span class="pill p-orange" style="font-size:9px" title="Kritik yol">&#9889; Kritik</span>');
  return parts.join('');
}
window.goalDependencyBadge=goalDependencyBadge;

/* ── UI panel ── */
function _depEsc(v){ return (typeof U!=='undefined'&&U&&U.esc)?U.esc(String(v==null?'':v)):String(v==null?'':v); }
function _depStatusLabel(s){ return s==='done'?'Tamamlandı':(s==='active'?'Aktif':String(s||'')); }
function _depSection(title,rows,goalId,removable){
  var h='<div style="margin-bottom:8px"><p class="lbl" style="margin-bottom:4px">'+_depEsc(title)+' ('+rows.length+')</p>';
  if(!rows.length){ h+='<p style="font-size:11px;color:var(--t3)">—</p></div>'; return h; }
  rows.forEach(function(r){
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 9px;background:var(--s2);border-radius:7px;margin-bottom:4px;flex-wrap:wrap"><div style="min-width:0;flex:1">';
    if(r.available){ h+='<span style="font-size:12px">'+_depEsc(r.title)+'</span> <span class="pill p-gray" style="font-size:9px">'+_depEsc(_depStatusLabel(r.status))+'</span>'; }
    else h+='<span style="font-size:12px;color:var(--t3);font-style:italic">Kayıt artık erişilebilir değil</span>';
    h+='</div><div style="display:flex;gap:4px">';
    if(r.available)h+='<button type="button" class="btn btn-s btn-sm" data-i="'+_depEsc(r.id)+'" onclick="openGoalDetail(+this.dataset.i)" aria-label="Aç">Aç</button>';
    if(removable)h+='<button type="button" class="btn btn-g btn-sm" data-rid="'+_depEsc(r.relationId)+'" data-gid="'+_depEsc(goalId)+'" onclick="removeGoalDependency(this.dataset.rid,this.dataset.gid)" aria-label="Kaldır">Kaldır</button>';
    h+='</div></div>';
  });
  return h+'</div>';
}
var _depPickerOpen=false,_depPickerType='depends_on';
function _depRerender(goalId){ var box=(typeof ge==='function')?ge('goal_dep_box'):null; if(box)box.innerHTML=goalDependencyPanelHtml(goalId); }
function goalDependencyToggle(goalId){ _depPickerOpen=!_depPickerOpen; _depRerender(goalId); }
window.goalDependencyToggle=goalDependencyToggle;
function openGoalDependencyPicker(goalId){ _depPickerOpen=true; _depRerender(goalId); }
window.openGoalDependencyPicker=openGoalDependencyPicker;
function goalDependencySetType(v){ _depPickerType=v; }
window.goalDependencySetType=goalDependencySetType;
function goalDependencyPickerHtml(goalId){
  var goals=(typeof D!=='undefined'&&D.goals?D.goals:[]).filter(function(g){return String(g.id)!==String(goalId);});
  var h='<div style="margin-top:4px;margin-bottom:8px;padding:10px 12px;background:var(--s2);border-radius:9px">';
  h+='<select class="inp" style="margin-bottom:6px" aria-label="Bağımlılık türü" onchange="goalDependencySetType(this.value)">'+
    '<option value="depends_on">Beklediğim (depends_on)</option><option value="blocks">Engellediğim (blocks)</option><option value="supports">Desteklediğim (supports)</option></select>';
  if(!goals.length)h+='<p style="font-size:11px;color:var(--t3)">Başka hedef yok.</p>';
  else goals.forEach(function(g){
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0"><span style="font-size:12px;min-width:0;flex:1">'+_depEsc(g.title)+'</span>'+
      '<button type="button" class="btn btn-g btn-sm" data-f="'+_depEsc(goalId)+'" data-t="'+_depEsc(g.id)+'" onclick="addGoalDependency(+this.dataset.f,+this.dataset.t,goalDependencyPickerType())">Ekle</button></div>';
  });
  return h+'</div>';
}
window.goalDependencyPickerHtml=goalDependencyPickerHtml;
function goalDependencyPickerType(){ return _depPickerType; }
window.goalDependencyPickerType=goalDependencyPickerType;

function goalDependencyPanelHtml(goalId){
  var d=goalDependencies(goalId);
  var h='<div style="margin-top:4px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
    '<p class="lbl">Bağımlılıklar ('+d.count+')</p>'+
    '<button type="button" class="btn btn-g btn-sm" data-gid="'+_depEsc(goalId)+'" onclick="goalDependencyToggle(this.dataset.gid)">'+(_depPickerOpen?'Kapat':'Bağımlılık Ekle')+'</button></div>';
  if(_depPickerOpen)h+=goalDependencyPickerHtml(goalId);
  if(goalIsBlocked(goalId)){
    h+='<div style="padding:6px 9px;background:var(--rl);border-radius:7px;margin-bottom:6px;font-size:11px"><b>&#9940; Bu hedef engelli.</b> Bekliyor: '+
      _depEsc(goalBlockReasons(goalId).map(function(r){return r.title;}).filter(Boolean).join(', '))+'</div>';
  }
  if(!d.count&&!d.blockedBy.length){ h+='<p style="font-size:11px;color:var(--t3)">Henüz bağımlılık yok.</p></div>'; return h; }
  h+=_depSection('Beklediği Hedefler',d.waitingFor,goalId,true);
  h+=_depSection('Engellediği Hedefler',d.blocking,goalId,true);
  h+=_depSection('Desteklediği Hedefler',d.supporting,goalId,true);
  h+=_depSection('Bu Hedefi Engelleyenler',d.blockedBy,goalId,false);
  h+='</div>';
  return h;
}
window.goalDependencyPanelHtml=goalDependencyPanelHtml;

/* Exports (test + onclick) */
window.goalDependencies=goalDependencies; window.goalIsBlocked=goalIsBlocked; window.goalBlockReasons=goalBlockReasons;
window.hasCircularDependency=hasCircularDependency; window.canAddGoalDependency=canAddGoalDependency;
window.addGoalDependency=addGoalDependency; window.removeGoalDependency=removeGoalDependency;
window.criticalPath=criticalPath; window.dependencyDepth=dependencyDepth; window.blockedGoalCount=blockedGoalCount;
window.goalMatchesDependencyFilter=goalMatchesDependencyFilter; window.DEP_TYPES=DEP_TYPES;
