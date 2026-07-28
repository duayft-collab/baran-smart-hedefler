/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Platform P6 — ADAPTİF YÜRÜTME İŞLETİM SİSTEMİ (TÜRETİLMİŞ · SALT OKUNUR)
   Sürekli yanıtlar: (1) şu an neye dikkat etmeliyim? (2) ne bekleyebilir?
   (3) ilerlemeyi ne engelliyor? (4) bugün en büyük etkiyi hangi tek değişiklik yaratır?
   Proaktif ama gürültüsüz. Mevcut motorların (P2 execQueue/execContext, 11r analytics
   risk/momentum/stale, 11o bağımlılık, 07 due/health/priority/progress, K1 wisdom)
   ürettiği sinyaller YENİDEN KULLANILIR — skor/risk/ivme/bağımlılık mantığı
   TEKRARLANMAZ. Yeni veri modeli/koleksiyon/payload/ayar/kalıcılık/ağ/AI/zamanlayıcı/
   dinleyici YOK. Tek memoize birleşik görünüm (yukarı-akış execContext ref'ine bağlı);
   deterministik; 0 yazma. Kullanıcı bugünün işini asla elle yeniden önceliklendirmez.
   ══════════════════════════════════════════════════════════════════════════ */

function _ose(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _osic(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _osCall(fn,a,b,d){ try{ return (typeof window[fn]==='function')?window[fn](a,b):d; }catch(e){ return d; } }
function _osExec(fn,a,d){ try{ return (typeof window[fn]==='function')?window[fn](a):d; }catch(e){ return d; } }
function _osCtx(){ return _osExec('execContext',undefined,[])||[]; }
function _osQueue(){ return _osExec('execQueue',null,[])||[]; }
function _osGoal(id){ var gs=(typeof D!=='undefined'&&Array.isArray(D.goals))?D.goals:[]; for(var i=0;i<gs.length;i++){ if(String(gs[i].id)===String(id))return gs[i]; } return null; }

var _OS_SEQ=['ŞİMDİ','SONRA','ARDINDAN','BUGÜN İLERİDE'];

/* ── Tek birleşim noktası: execContext (momentum/priority/due/health/stale) + execQueue
   (score/effort/impact). Hiçbir metrik yeniden hesaplanmaz. Memoize: yukarı-akış ref'i. ── */
var _OS_MERGE=null, _OS_REF=null;
function execOsInvalidate(){ _OS_MERGE=null; _OS_REF=null; }
window.execOsInvalidate=execOsInvalidate;
function _osMerged(){
  var ctx=_osCtx();
  if(_OS_MERGE&&_OS_REF===ctx)return _OS_MERGE;
  var q=_osQueue(), qm={}; q.forEach(function(x){ qm[String(x.goalId)]=x; });
  _OS_MERGE=ctx.map(function(c){ var x=qm[String(c.id)]||{};
    return { id:c.id, title:c.title, due:c.due, daysRemaining:c.daysRemaining, risk:c.risk,
      momentum:c.momentum||{state:'unknown',score:0}, blocked:!!c.blocked, priorityWeight:c.priorityWeight,
      health:c.health, staleDays:c.staleDays, hasCheckIns:c.hasCheckIns,
      score:(x.score!=null?x.score:0), effort:(x.effort||'Orta'), impact:(x.impact||'Orta') }; });
  _OS_REF=ctx; return _OS_MERGE;
}
function _osUrgent(c){ return c.due==='overdue'||c.due==='today'||c.due==='tomorrow'; }
function _osDur(effort,blockedOrReview){ if(blockedOrReview)return 20; return effort==='Yüksek'?90:(effort==='Düşük'?30:60); }

/* ══ PART 1 — Dinamik Öncelik Motoru (yalnız anlamlı değişimler; ↑/↓) ══ */
function execAdaptivePriority(){
  return _osMerged().map(function(c){
    var dir=null, reason='';
    if(c.blocked){ dir='down'; reason='Bağımlılık engelliyor'; }
    else if(_osUrgent(c)&&c.priorityWeight>=2){ dir='up'; reason='Son tarih yaklaşıyor'; }
    else if(c.health==='off_track'&&c.priorityWeight===1){ dir='up'; reason='Kritik hedef yolunda değil'; }
    else if(c.staleDays!=null&&c.staleDays>14&&c.priorityWeight<=2){ dir='up'; reason='Uzun süredir ilerleme yok'; }
    else if(c.momentum&&c.momentum.state==='declining'&&!_osUrgent(c)){ dir='down'; reason='İvme geriliyor'; }
    return dir?{ goalId:c.id, title:c.title, direction:dir, reason:reason }:null;
  }).filter(Boolean);
}
window.execAdaptivePriority=execAdaptivePriority;

/* ══ PART 2 — Yürütme Danışmanı (TEK öneri; her zaman WHY ile) ══ */
function _osBlockerTitle(id){
  var br=_osCall('goalBlockReasons',id,null,[])||[]; var b=br[0];
  return b&&(b.title||(b.goal&&b.goal.title)||b.label)||'bağımlılık';
}
function execAdvisor(){
  var m=_osMerged(); if(!m.length)return null;
  var q=_osQueue(), top=q[0], byId={}; m.forEach(function(c){ byId[String(c.id)]=c; });
  var tc=top?byId[String(top.goalId)]:null;
  if(tc&&tc.blocked)
    return { kind:'resolve_blocker', goalId:tc.id, title:tc.title, recommendation:'Önce şu engeli çöz: '+_osBlockerTitle(tc.id), why:'Bugünün en yüksek değerli işi bu, ama bir bağımlılık onu durduruyor.' };
  var blockedHi=m.filter(function(c){ return c.blocked&&c.priorityWeight===1; })[0];
  if(blockedHi)
    return { kind:'delay', goalId:blockedHi.id, title:blockedHi.title, recommendation:blockedHi.title+' — bağımlılığı bitene kadar beklet', why:'Yüksek öncelikli ama şu an engelli; beklemek eforu boşa harcamayı önler.' };
  var review=m.filter(function(c){ return c.due==='overdue'||c.health==='off_track'; })[0];
  if(review)
    return { kind:'review', goalId:review.id, title:review.title, recommendation:'Bugün şunu gözden geçir: '+review.title, why:(review.due==='overdue'?'Son tarihi geçti':'Sağlık yolunda değil')+' — küçük bir düzeltme rotayı toparlar.' };
  var reduce=m.filter(function(c){ return c.momentum&&c.momentum.state==='declining'&&c.priorityWeight===3; })[0];
  if(reduce)
    return { kind:'reduce', goalId:reduce.id, title:reduce.title, recommendation:'Şuna odağı azalt: '+reduce.title, why:'Düşük değerli ve ivmesi düşüyor; eforu yüksek etkili işe kaydır.' };
  return { kind:'progress', goalId:top.goalId, title:top.title, recommendation:'Şunda ilerle: '+top.title, why:'Bugünün en yüksek etkili, engelsiz işi.' };
}
window.execAdvisor=execAdvisor;

/* ══ PART 3 — Fırsat Tespiti (en fazla 3) ══ */
function execOpportunities(){
  var m=_osMerged(), out=[], seen={};
  function add(c,type,reason){ if(seen[c.id]||out.length>=3)return; seen[c.id]=1; out.push({goalId:c.id,title:c.title,type:type,reason:reason}); }
  m.forEach(function(c){
    if(out.length>=3||c.blocked)return;
    if(c.impact==='Yüksek'&&c.effort==='Düşük'){ add(c,'high_impact_low_effort','Yüksek etki, düşük efor — bugün bitir'); return; }
    var prog=_osCall('goalProgress',_osGoal(c.id),null,0);
    if(prog>=80){ add(c,'near_done','Tamamlanmaya çok yakın — bitirmek kolay'); return; }
    if(c.effort==='Düşük'&&c.priorityWeight<=2){ add(c,'quick_win','Düşük efor — hızlı kazanım'); return; }
    if(c.staleDays!=null&&c.staleDays>14&&c.momentum&&c.momentum.state!=='declining'){ add(c,'recoverable','Duraklamış ama toparlanabilir — tek check-in yeter'); return; }
  });
  return out;
}
window.execOpportunities=execOpportunities;

/* ══ PART 4 — Yürütme Riskleri (yalnız gerçek riskler; sade dil; yüzde/grafik yok) ══ */
function execExecutionRisks(){
  var m=_osMerged(), out=[];
  m.forEach(function(c){
    if(c.staleDays!=null&&c.staleDays>=14) out.push({goalId:c.id,title:c.title,risk:'stale',message:c.staleDays+' gündür ilerleme kaydı yok'});
    if(c.daysRemaining!=null&&c.daysRemaining>=0&&c.daysRemaining<=2) out.push({goalId:c.id,title:c.title,risk:'deadline',message:'Son tarihe '+c.daysRemaining+' gün kaldı'});
    if(c.blocked) out.push({goalId:c.id,title:c.title,risk:'dependency',message:'Bir bağımlılık ilerlemeyi durduruyor'});
    if(c.momentum&&c.momentum.state==='declining'&&(Number(c.momentum.score)||0)<-3) out.push({goalId:c.id,title:c.title,risk:'momentum',message:'İvme hızla düşüyor'});
    if(c.health==='off_track') out.push({goalId:c.id,title:c.title,risk:'health',message:'Sağlık: yolunda değil'});
  });
  return out;
}
window.execExecutionRisks=execExecutionRisks;

/* ══ PART 5 — Akıllı Sıra (ŞİMDİ/SONRA/ARDINDAN/BUGÜN İLERİDE + neden sonra) ══ */
function _osWhyNext(it,i){
  if(i===0)return 'En yüksek etkili, engelsiz iş';
  if(it.blocked)return 'Engelli — çözülünce sıraya girer';
  if(it.due==='overdue')return 'Son tarihi geçti — öncelikli';
  if(it.due==='today'||it.due==='tomorrow')return 'Son tarihi çok yakın';
  if(it.impact==='Yüksek')return 'Yüksek etkili ve engelsiz';
  return 'Öncekinden sonra en yüksek değerli iş';
}
function execIntelligentSequence(){
  return _osQueue().slice(0,4).map(function(it,i){
    var review=it.blocked||it.due==='overdue'||it.health==='off_track'||(it.staleDays!=null&&it.staleDays>14);
    return { slot:_OS_SEQ[i]||'BUGÜN İLERİDE', goalId:it.goalId, title:it.title,
      whyNext:_osWhyNext(it,i), effort:it.effort, focusMinutes:_osDur(it.effort,review), blocked:!!it.blocked };
  });
}
window.execIntelligentSequence=execIntelligentSequence;

/* ══ PART 6 — Odak Koruması (iş EKLEMEYİ değil ÇIKARMAYI önerir) ══ */
function execFocusProtection(){
  var m=_osMerged(), out=[];
  if(m.length>7) out.push({kind:'too_many',message:'Çok fazla aktif hedef ('+m.length+'). Bugün en fazla 3 tanesine odaklan, gerisini ertele.'});
  var blocked=m.filter(function(c){ return c.blocked; });
  if(blocked.length>=2) out.push({kind:'blocked_noise',message:blocked.length+' engelli iş dikkat çalıyor — çözülene kadar görünürden çıkar.'});
  var urgentLow=m.filter(function(c){ return (c.due==='overdue'||c.due==='today')&&c.priorityWeight===3; });
  if(urgentLow.length) out.push({kind:'urgent_low_value',message:'Acil ama düşük değerli işler var — kaldır ya da ertele, yüksek etkiye odaklan.'});
  return out;
}
window.execFocusProtection=execFocusProtection;

/* ══ PART 7 — Sessiz içgörü paneli (aynı anda EN FAZLA: 1 öneri + 1 uyarı + 1 fırsat + 1 öncelik) ══ */
function _osRow(icon,label,text,why,color){
  var h='<div style="display:flex;gap:9px;align-items:flex-start;padding:9px 12px;background:var(--s2);border-radius:10px;border-left:3px solid '+color+'">';
  h+='<span style="flex-shrink:0;margin-top:1px">'+_osic(icon,14,color)+'</span>';
  h+='<div style="flex:1;min-width:0"><p style="font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--t3)">'+_ose(label)+'</p>';
  h+='<p style="font-size:13px;color:var(--t1);font-weight:600;margin-top:1px">'+_ose(text)+'</p>';
  if(why)h+='<p style="font-size:11px;color:var(--t3);margin-top:2px">'+_ose(why)+'</p>';
  h+='</div>';
  return h;
}
function execOsInsightsHtml(){
  var adv=execAdvisor(), risks=execExecutionRisks(), opps=execOpportunities(), prio=execAdaptivePriority(), focus=execFocusProtection();
  var warn=risks[0]?risks[0].message:(focus[0]?focus[0].message:null);
  if(!adv&&!warn&&!opps.length&&!prio.length)return '';
  var h='<div class="os-panel" style="margin-top:18px;display:flex;flex-direction:column;gap:8px">';
  if(adv){
    var r=_osRow('brain','Öneri',adv.recommendation,adv.why,'var(--green)');
    if(adv.goalId!=null)r+='<div style="margin:-4px 0 0 34px"><button class="btn btn-s btn-sm" data-id="'+_ose(String(adv.goalId))+'" onclick="if(typeof openGoalDetail===\'function\')openGoalDetail(+this.dataset.id)">Aç</button></div>';
    h+=r;
  }
  if(warn)h+=_osRow('csq','Uyarı',warn,'','var(--red)');
  if(opps[0])h+=_osRow('zap','Fırsat',opps[0].reason+' — '+opps[0].title,'','var(--blue)');
  if(prio[0])h+=_osRow('ar','Öncelik',(prio[0].direction==='up'?'↑ ':'↓ ')+prio[0].title+' — '+prio[0].reason,'','var(--t2)');
  h+='</div>';
  return h;
}
window.execOsInsightsHtml=execOsInsightsHtml;
