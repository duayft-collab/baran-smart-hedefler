/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom P12 — ENTERPRISE KNOWLEDGE OS (CROSS-MODULE KNOWLEDGE FABRIC)
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK)

   Wisdom'ı, ERP modüllerini (SMART Goals, Kararlar, İlkeler, Notlar, Kitaplar,
   Görevler) MEVCUT D.relations grafiği üzerinden birbirine bağlayan kurumsal bilgi
   bağlantı katmanına dönüştürür. Herhangi bir sözden, uygulama genelindeki bağlı iş
   ağı; herhangi bir modülden, onu besleyen bilgelik görülür.

   Tek okuma girişi wqList()/wqById() + mevcut D.relations + mevcut getRelatedEntities
   / RELATION_RESOLVERS. Yeni veri modeli / relation tipi / payload / koleksiyon YOK;
   relation MUTASYONU YOK; cloud write / network / AI YOK. Çapraz gezinme yalnız
   mevcut açıcıları (openGoalDetail/djOpenDetail/openPrincipleForm/openWqForm/
   openGeneralNoteForm/openTaskById) kullanır — yeni açıcı yok. Sharded runtime
   cache'ine veya legacy söz dizisine doğrudan erişmez. Erişilebilir, responsive.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── küçük yardımcılar ── */
function _koe(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _koIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _koJs(s){ return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
/* Kitap tipleri tek 'book' altında normalize edilir (resolver'ı yok → orphan-safe). */
function _koNormType(t){ return (t==='mybook')?'book':t; }
var KOS_TYPES=['wisdomQuote','goal','decision','principle','generalNote','task','book'];
var KOS_TYPE_LABEL={wisdomQuote:'Söz',goal:'Hedef',decision:'Karar',principle:'İlke',generalNote:'Not',task:'Görev',book:'Kitap'};
var KOS_OPENER={ wisdomQuote:'openWqForm', goal:'openGoalDetail', decision:'djOpenDetail', principle:'openPrincipleForm', generalNote:'openGeneralNoteForm', task:'openTaskById' };
function _koRelations(){ return Array.isArray(D.relations)?D.relations:[]; }
function _koHasResolver(t){ return (typeof RELATION_RESOLVERS!=='undefined')&&RELATION_RESOLVERS&&typeof RELATION_RESOLVERS[t]==='object'; }
function _koLabel(type,id){
  if(type==='wisdomQuote'){ var q=(typeof wqById==='function')?wqById(id):null; return q?String(q.quote||'').slice(0,70):String(id); }
  if(_koHasResolver(type)&&typeof relResolve==='function'){ var e=relResolve(type,id); if(e&&e.label)return String(e.label).slice(0,70); }
  return KOS_TYPE_LABEL[type]?(KOS_TYPE_LABEL[type]+' '+id):String(id);
}

/* ── paylaşılan indeks (imza-tabanlı memoize; tek D.relations taraması) ── */
var _KOS=null, _KOS_SIG=null;
function wkosInvalidate(){ _KOS=null; _KOS_SIG=null; }
window.wkosInvalidate=wkosInvalidate;
function _koSig(){
  var rel=_koRelations();
  var g=Array.isArray(D.goals)?D.goals.length:0, d=Array.isArray(D.decisions)?D.decisions.length:0, p=Array.isArray(D.principles)?D.principles.length:0;
  var wl=(typeof wqList==='function')?wqList().length:0;
  return [rel.length,g,d,p,wl].join('|');
}
function _koIndex(){
  var sig=_koSig();
  if(_KOS&&_KOS_SIG===sig)return _KOS;
  var degree={}, linkTypes={}, matrix={};
  KOS_TYPES.forEach(function(a){ matrix[a]={}; KOS_TYPES.forEach(function(b){ matrix[a][b]=0; }); });
  function key(t,id){ return t+'|'+id; }
  _koRelations().forEach(function(r){
    if(!r)return;
    var st=_koNormType(r.sourceType), tt=_koNormType(r.targetType);
    var sk=key(st,r.sourceId), tk=key(tt,r.targetId);
    degree[sk]=(degree[sk]||0)+1; degree[tk]=(degree[tk]||0)+1;
    (linkTypes[sk]||(linkTypes[sk]={}))[tt]=1; (linkTypes[tk]||(linkTypes[tk]={}))[st]=1;
    if(matrix[st]&&matrix[st][tt]!=null){ matrix[st][tt]++; if(st!==tt)matrix[tt][st]++; }
  });
  _KOS={ degree:degree, linkTypes:linkTypes, matrix:matrix, totalLinks:_koRelations().length };
  _KOS_SIG=sig; return _KOS;
}

/* ── 1) Modül haritası (çapraz-modül bağlantı sayıları) ── */
function wkosModuleMap(){
  var idx=_koIndex();
  var totals={}; KOS_TYPES.forEach(function(t){ var s=0; KOS_TYPES.forEach(function(o){ s+=idx.matrix[t][o]; }); totals[t]=s; });
  return { types:KOS_TYPES.slice(), labels:KOS_TYPE_LABEL, matrix:idx.matrix, typeTotals:totals, totalLinks:idx.totalLinks };
}
window.wkosModuleMap=wkosModuleMap;

/* ── 2) Varlık ağı (modüle göre gruplu; orphan/resolver-safe) ── */
function wkosEntityWeb(type,id){
  var rel=(typeof getRelatedEntities==='function')?getRelatedEntities(type,id):[];
  var byModule={};
  (rel||[]).forEach(function(x){ if(!x||!x.entity)return; var t=_koNormType(x.entity.type);
    (byModule[t]||(byModule[t]=[])).push({type:t,id:x.entity.id,label:String(x.entity.label||_koLabel(t,x.entity.id)).slice(0,70),direction:x.direction,relationType:x.relation&&x.relation.relationType}); });
  Object.keys(byModule).forEach(function(t){ byModule[t].sort(function(a,b){ return String(a.id)<String(b.id)?-1:(String(a.id)>String(b.id)?1:0); }); });
  var total=Object.keys(byModule).reduce(function(s,t){ return s+byModule[t].length; },0);
  return { type:_koNormType(type), id:id, byModule:byModule, total:total };
}
window.wkosEntityWeb=wkosEntityWeb;

/* ── 3) Bilgi zinciri: Söz → İlke → Karar → Hedef → Görev ── */
function wkosKnowledgeFlow(wisdomId){
  var q=(typeof wqById==='function')?wqById(wisdomId):null; if(!q)return null;
  function firstRel(type,id,targetType){ if(typeof getRelatedEntities!=='function')return null; var e=getRelatedEntities(type,id)||[]; var m=e.filter(function(x){return x&&x.entity&&_koNormType(x.entity.type)===targetType;})[0]; return m?{id:m.entity.id,label:String(m.entity.label||'').slice(0,70)}:null; }
  var principle=firstRel('wisdomQuote',wisdomId,'principle');
  var decision=firstRel('wisdomQuote',wisdomId,'decision')||(principle?firstRel('principle',principle.id,'decision'):null);
  var goal=(decision?firstRel('decision',decision.id,'goal'):null)||firstRel('wisdomQuote',wisdomId,'goal');
  var task=(goal?firstRel('goal',goal.id,'task'):null)||(decision?firstRel('decision',decision.id,'task'):null);
  return { wisdom:{id:q.id,label:String(q.quote||'').slice(0,80)}, principle:principle, decision:decision, goal:goal, task:task };
}
window.wkosKnowledgeFlow=wkosKnowledgeFlow;

/* ── 4) En bağlı bilgi düğümleri ── */
function wkosMostConnected(limit){
  limit=limit==null?10:limit;
  var idx=_koIndex(), out=[];
  Object.keys(idx.degree).forEach(function(k){
    var p=k.indexOf('|'); var type=k.slice(0,p), id=k.slice(p+1);
    out.push({ type:type, id:id, degree:idx.degree[k], modules:Object.keys(idx.linkTypes[k]||{}).length, label:_koLabel(type,id) });
  });
  out.sort(function(a,b){ if(b.degree!==a.degree)return b.degree-a.degree; if(b.modules!==a.modules)return b.modules-a.modules;
    var ta=KOS_TYPES.indexOf(a.type),tb=KOS_TYPES.indexOf(b.type); if(ta!==tb)return ta-tb;
    return String(a.id)<String(b.id)?-1:(String(a.id)>String(b.id)?1:0); });
  return out.slice(0,limit);
}
window.wkosMostConnected=wkosMostConnected;

/* ── 5) Yetim (bağlantısız yüksek-değerli) fırsatları ── */
function _koDegreeOf(type,id){ var idx=_koIndex(); return idx.degree[type+'|'+id]||0; }
function wkosOrphans(){
  var wisdom=[], goals=[], decisions=[];
  var wl=(typeof wqList==='function')?wqList():[];
  wl.forEach(function(q){ if(!q||q.active===false)return; var hv=q.favorite||q.reflected||(Number(q.priority)||3)>=4;
    if(hv&&_koDegreeOf('wisdomQuote',q.id)===0)wisdom.push({id:q.id,label:String(q.quote||'').slice(0,70)}); });
  (Array.isArray(D.goals)?D.goals:[]).forEach(function(g){ if(g&&g.status!=='done'&&g.status!=='archived'&&_koDegreeOf('goal',g.id)===0)goals.push({id:g.id,label:String(g.title||'').slice(0,70)}); });
  (Array.isArray(D.decisions)?D.decisions:[]).forEach(function(d){ if(d&&d.status==='open'&&_koDegreeOf('decision',d.id)===0)decisions.push({id:d.id,label:String(d.title||d.decision||'').slice(0,70)}); });
  return { wisdom:wisdom.slice(0,8), goals:goals.slice(0,8), decisions:decisions.slice(0,8),
    total:wisdom.length+goals.length+decisions.length };
}
window.wkosOrphans=wkosOrphans;

/* ── 6) Bilgi kapsamı (wisdom bağlantısı olan modül kayıtları) ── */
function _koHasWisdomLink(type,id){ var idx=_koIndex(); var lt=idx.linkTypes[type+'|'+id]; return !!(lt&&lt.wisdomQuote); }
function _koCov(arr,type,filter){ var items=(arr||[]).filter(filter||function(){return true;}); var linked=items.filter(function(x){return _koHasWisdomLink(type,x.id);}).length; return { linked:linked, total:items.length, pct:items.length?Math.round(linked/items.length*100):0 }; }
function wkosCoverage(){
  return {
    goals:_koCov(D.goals,'goal',function(g){return g&&g.status!=='archived';}),
    decisions:_koCov(D.decisions,'decision',function(d){return !!d;}),
    principles:_koCov(D.principles,'principle',function(p){return p&&(p.status==null||p.status!=='archived');})
  };
}
window.wkosCoverage=wkosCoverage;

/* ── UI: Kurumsal Bilgi Haritası ── */
function _koOpenBtn(type,id){
  var fn=KOS_OPENER[type]; if(!fn||typeof window[fn]!=='function')return '';
  return '<button class="btn btn-g btn-sm" style="flex-shrink:0" data-t="'+_koe(type)+'" data-id="'+_koe(String(id))+'" onclick="wkosOpen(this.dataset.t,this.dataset.id)" title="Aç" aria-label="Aç">'+_koIc('arrow',11,'var(--t3)')+'</button>';
}
function wkosOpen(type,id){
  var fn=KOS_OPENER[type]; if(fn&&typeof window[fn]==='function')return window[fn](id);
}
window.wkosOpen=wkosOpen;
function _koCovRow(label,c,color){
  return '<div style="padding:5px 0;border-bottom:1px solid var(--s2)"><div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:3px"><span style="color:var(--t2);font-weight:600">'+_koe(label)+'</span><span style="color:'+color+';font-weight:800">%'+c.pct+' ('+c.linked+'/'+c.total+')</span></div>'+((typeof progBar==='function')?progBar(c.pct):'')+'</div>';
}
function wkosKnowledgeOsHtml(){
  if(typeof wqList==='function'&&!wqList().length)return '';
  var mm=wkosModuleMap(), cov=wkosCoverage(), mc=wkosMostConnected(8), orph=wkosOrphans();
  var h='<div class="card wd-anim" style="padding:14px 16px;max-width:100%;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2)">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">'+_koIc('grid',16,'var(--blue)')+'<h2 style="font-size:14px;font-weight:800;letter-spacing:.03em">Kurumsal Bilgi Haritası</h2>'+
    '<span class="pill" style="margin-left:auto;font-size:9px;background:var(--s2);color:var(--t3)" role="status">'+mm.totalLinks+' bağlantı</span></div>';
  // Kapsam (role=status)
  h+='<div role="status" style="margin-bottom:11px"><h3 style="font-size:11px;font-weight:800;color:var(--t2);margin-bottom:5px">'+_koIc('chk',12,'var(--green)')+' Bilgi Kapsamı</h3>';
  h+=_koCovRow('Hedefler (wisdom bağlı)',cov.goals,'var(--green)')+_koCovRow('Kararlar (wisdom bağlı)',cov.decisions,'var(--blue)')+_koCovRow('İlkeler (wisdom bağlı)',cov.principles,'var(--purple)');
  h+='</div>';
  // Çapraz-modül matrisi
  h+='<h3 style="font-size:11px;font-weight:800;color:var(--t2);margin:11px 0 5px">'+_koIc('layers',12,'var(--blue)')+' Çapraz-Modül Matrisi</h3>';
  h+='<div style="overflow-x:auto;max-width:100%"><table role="table" style="border-collapse:collapse;font-size:9.5px;min-width:100%"><thead><tr><th scope="col" style="text-align:left;padding:3px 6px;color:var(--t3)"></th>';
  mm.types.forEach(function(t){ h+='<th scope="col" style="padding:3px 6px;color:var(--t3);text-align:center">'+_koe(mm.labels[t])+'</th>'; });
  h+='</tr></thead><tbody>';
  mm.types.forEach(function(a){ h+='<tr><td style="padding:3px 6px;color:var(--t2);font-weight:700;white-space:nowrap">'+_koe(mm.labels[a])+'</td>';
    mm.types.forEach(function(b){ var v=mm.matrix[a][b]; h+='<td style="padding:3px 6px;text-align:center;color:'+(v?'var(--blue)':'var(--t3)')+';font-weight:'+(v?'800':'400')+'">'+(v||'·')+'</td>'; });
    h+='</tr>'; });
  h+='</tbody></table></div>';
  // En bağlı düğümler
  h+='<h3 style="font-size:11px;font-weight:800;color:var(--t2);margin:11px 0 5px">'+_koIc('compass',12,'var(--purple)')+' En Bağlı Bilgi</h3>';
  if(mc.length){ h+='<div style="display:flex;flex-direction:column;gap:4px">';
    mc.forEach(function(n){ h+='<div class="card" style="padding:7px 10px;max-width:100%;display:flex;gap:8px;align-items:center">'+
      '<span class="pill" style="flex-shrink:0;font-size:8.5px;background:var(--s2);color:var(--t2)">'+_koe(KOS_TYPE_LABEL[n.type]||n.type)+'</span>'+
      '<span style="flex:1;min-width:0;font-size:10.5px;color:var(--t);word-break:break-word">'+_koe(n.label)+'</span>'+
      '<span class="pill" style="flex-shrink:0;font-size:8.5px;background:var(--s2);color:var(--blue)">'+n.degree+' bağ · '+n.modules+' modül</span>'+_koOpenBtn(n.type,n.id)+'</div>'; });
    h+='</div>'; }
  else h+='<p style="font-size:10.5px;color:var(--t3)">Henüz çapraz-modül bağlantısı yok.</p>';
  // Bilgi zinciri (en bağlı sözden)
  var topWisdom=mc.filter(function(n){return n.type==='wisdomQuote';})[0];
  if(topWisdom){ var fl=wkosKnowledgeFlow(topWisdom.id);
    if(fl){ h+='<h3 style="font-size:11px;font-weight:800;color:var(--t2);margin:11px 0 5px">'+_koIc('git',12,'var(--orange)')+' Bilgi Zinciri</h3>';
      var chain=[['Söz',fl.wisdom],['İlke',fl.principle],['Karar',fl.decision],['Hedef',fl.goal],['Görev',fl.task]];
      h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">';
      chain.forEach(function(step,i){ if(i)h+='<span style="color:var(--t3)">'+_koIc('arrow',11,'var(--t3)')+'</span>';
        var v=step[1]; h+='<span class="pill" style="font-size:9px;background:var(--s2);color:'+(v?'var(--t2)':'var(--t3)')+'">'+_koe(step[0])+': '+_koe(v?String(v.label).slice(0,24):'—')+'</span>'; });
      h+='</div>'; } }
  // Yetim fırsatları
  h+='<h3 style="font-size:11px;font-weight:800;color:var(--t2);margin:11px 0 5px">'+_koIc('alert',12,'var(--orange)')+' Bağlanmamış Fırsatlar ('+orph.total+')</h3>';
  function orphBlk(title,arr){ if(!arr||!arr.length)return ''; var b='<p style="font-size:9.5px;color:var(--t3);font-weight:700;margin:4px 0 2px">'+_koe(title)+'</p>'; arr.slice(0,5).forEach(function(x){ b+='<div style="font-size:10px;color:var(--t2);padding:1px 0;word-break:break-word">• '+_koe(String(x.label).slice(0,60))+'</div>'; }); return b; }
  var ob=orphBlk('Yüksek değerli bağlanmamış sözler',orph.wisdom)+orphBlk('Bağlanmamış hedefler',orph.goals)+orphBlk('Bağlanmamış açık kararlar',orph.decisions);
  h+=(ob||'<p style="font-size:10px;color:var(--t3)">Tüm yüksek-değerli bilgi bağlı. 🎯</p>').replace('🎯','');
  h+='</div>';
  return h;
}
window.wkosKnowledgeOsHtml=wkosKnowledgeOsHtml;
