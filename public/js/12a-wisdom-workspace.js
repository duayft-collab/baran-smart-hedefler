/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom P10 — UNIFIED KNOWLEDGE WORKSPACE & PRODUCTIVITY HUB
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK)

   P4 (wlc*), P5 (wkg*), P6 (wco*), P7 (wia*), P8 (wer*) türetilmiş katmanlarını
   tek profesyonel çalışma alanında birleştirir: sol navigasyon + tek aktif bölüm
   (ana alan) + sağ bağlam kenar çubuğu + birleşik arama + çapraz gezinme + hızlı
   aksiyonlar + klavye kısayolları + odak modu + oturum anlık görüntüsü.

   Mevcut panelleri YENİDEN KULLANIR (silmez/değiştirmez); yalnızca reused HTML
   fonksiyonlarını `typeof`-guard ile çağırır. Tek okuma girişi wqList()/wqById().
   Tek paylaşılan memoize snapshot + tek arama indeksi → bölüm geçişi O(1). Yeni
   koleksiyon/payload/settings/write/network/AI/realtime-listener YOK. Sharded
   runtime cache'ine veya legacy söz dizisine doğrudan erişmez. Erişilebilir,
   responsive, yazdırma-dostu (Executive/Reports bölümleri P8 üzerinden).
   ══════════════════════════════════════════════════════════════════════════ */

/* ── küçük yardımcılar ── */
function _wwe(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _wwIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _wwNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr'); }
function _wwCall(fn){ return (typeof window[fn]==='function')?window[fn]():''; }
function _wwList(){ return (typeof wqList==='function')?wqList():[]; }
function _wwById(id){ return (typeof wqById==='function')?wqById(id):null; }

/* ── workspace durumu (modül-global; kalıcı değil) ── */
var WWS_NAV=[
  ['dashboard','Panel','chart'],['coach','Koç','bulb'],['learning','Öğrenme','book'],
  ['knowledge','Bilgi','brain'],['analytics','Analitik','chart'],['executive','Yönetici','briefcase'],
  ['search','Arama','search'],['collections','Koleksiyonlar','layers'],['settings','Ayarlar','gear'],
  ['intel','Yönetici Zekâsı','briefcase'], // WISDOM-P11: Executive Intelligence bölümü (12b, typeof-guard'lı)
  ['kos','Kurumsal Harita','grid'] // WISDOM-P12: Enterprise Knowledge OS bölümü (12c, typeof-guard'lı)
];
window.WWS_NAV=WWS_NAV;
var _wwsSection='dashboard', _wwsFocus=false, _wwsQuery='';

/* ── paylaşılan snapshot (imza-tabanlı memoize; bölüm geçişi O(1)) ── */
var _WWS_SNAP=null, _WWS_SIG=null;
function wwsInvalidate(){ _WWS_SNAP=null; _WWS_SIG=null; _WWS_IDX=null; _WWS_IDX_SIG=null; }
window.wwsInvalidate=wwsInvalidate;
function _wwsSig(){
  var l=_wwList(), n=l.length, sc=0, refl=0, fav=0, maxU=0;
  for(var i=0;i<n;i++){ var q=l[i]; sc+=Number(q.showCount)||0; if(q.reflected)refl++; if(q.favorite)fav++; var u=Date.parse(q.updatedAt||''); if(!isNaN(u)&&u>maxU)maxU=u; }
  var g=Array.isArray(D.goals)?D.goals.length:0, d=Array.isArray(D.decisions)?D.decisions.length:0, p=Array.isArray(D.principles)?D.principles.length:0, r=Array.isArray(D.relations)?D.relations.length:0;
  return [n,sc,refl,fav,maxU,g,d,p,r].join('|');
}
function wwsSessionSnapshot(){
  var sig=_wwsSig();
  if(_WWS_SNAP&&_WWS_SIG===sig)return _WWS_SNAP;
  var ctx=(typeof wcoBuildContext==='function')?wcoBuildContext():{goals:[],decisions:[],principles:[],source:'legacy',dayPartLabel:''};
  var recs=(typeof wcoRecommend==='function')?(wcoRecommend(ctx,1)||[]):[];
  var streak=(typeof wcoInsightStreak==='function')?wcoInsightStreak():{current:0};
  var dash=(typeof wiaExecutiveDashboard==='function')?wiaExecutiveDashboard():{};
  var exec=(typeof werBuildExecutiveSnapshot==='function')?werBuildExecutiveSnapshot('week'):{};
  var health=(typeof wisdomRuntimeHealth==='function')?wisdomRuntimeHealth():{source:'legacy',fallback:false};
  var actions=(typeof werPriorityActions==='function')?werPriorityActions():[];
  var teaching=(typeof wlcTeachingOfDay==='function')?wlcTeachingOfDay():null;
  _WWS_SNAP={
    currentGoal:(ctx.goals[0]&&ctx.goals[0].label)||'—',
    currentDecision:(ctx.decisions[0]&&ctx.decisions[0].label)||'—',
    currentPrinciple:(ctx.principles[0]&&ctx.principles[0].label)||'—',
    coachStatus:recs.length?(recs.length+' öneri hazır'):'Öneri yok',
    topRecommendation:recs.length?recs[0]:null,
    learningMomentum:dash.learningMomentum||'idle',
    knowledgeScore:(typeof wkgKnowledgeScore==='function')?wkgKnowledgeScore():0,
    decisionReadiness:dash.decisionCoverage||0,
    reflectionStreak:streak.current||0,
    runtimeHealth:health, source:(typeof wisdomReadSource==='function')?wisdomReadSource():'legacy',
    dayPartLabel:ctx.dayPartLabel||'', priorityActions:actions, teaching:teaching, exec:exec
  };
  _WWS_SIG=sig; return _WWS_SNAP;
}
window.wwsSessionSnapshot=wwsSessionSnapshot;

/* ── birleşik arama indeksi (memoize) ── */
var _WWS_IDX=null, _WWS_IDX_SIG=null;
function _wwsIndex(){
  var sig=_wwsSig();
  if(_WWS_IDX&&_WWS_IDX_SIG===sig)return _WWS_IDX;
  var out=[], cats={}, tags={}, authors={};
  _wwList().forEach(function(q){
    if(q&&q.active!==false)out.push({type:'wisdomQuote',id:q.id,label:String(q.quote||'').slice(0,90),hay:_wwNorm([q.quote,q.author,q.category,(q.tags||[]).join(' '),q.notes].join(' '))});
    if(q&&q.author)authors[q.author]=1; if(q&&q.category)cats[q.category]=1; (q&&q.tags||[]).forEach(function(t){tags[t]=1;});
  });
  Object.keys(authors).forEach(function(a){ out.push({type:'author',id:a,label:a,hay:_wwNorm(a)}); });
  Object.keys(cats).forEach(function(c){ out.push({type:'category',id:c,label:c,hay:_wwNorm(c)}); });
  Object.keys(tags).forEach(function(t){ out.push({type:'tag',id:t,label:'#'+t,hay:_wwNorm(t)}); });
  (Array.isArray(D.goals)?D.goals:[]).forEach(function(g){ out.push({type:'goal',id:g.id,label:String(g.title||'').slice(0,90),hay:_wwNorm([g.title,g.desc,g.cat,g.measurable].join(' '))}); });
  (Array.isArray(D.decisions)?D.decisions:[]).forEach(function(d){ out.push({type:'decision',id:d.id,label:String(d.title||d.decision||'').slice(0,90),hay:_wwNorm([d.title,d.decision,d.context,(d.tags||[]).join(' ')].join(' '))}); });
  (Array.isArray(D.principles)?D.principles:[]).forEach(function(p){ out.push({type:'principle',id:p.id,label:String(p.title||p.statement||p.text||'').slice(0,90),hay:_wwNorm([p.title,p.statement,p.text,p.category,(p.tags||[]).join(' ')].join(' '))}); });
  (Array.isArray(D.relations)?D.relations:[]).forEach(function(r,i){ out.push({type:'relation',id:r.id||('rel'+i),label:_wwNorm(r.relationType||'related_to'),hay:_wwNorm([r.sourceType,r.sourceId,r.targetType,r.targetId,r.relationType].join(' '))}); });
  _WWS_IDX=out; _WWS_IDX_SIG=sig; return out;
}
var WWS_TYPE_ORDER={wisdomQuote:0,goal:1,decision:2,principle:3,author:4,category:5,tag:6,relation:7};
var WWS_TYPE_LABEL={wisdomQuote:'Söz',goal:'Hedef',decision:'Karar',principle:'İlke',author:'Yazar',category:'Kategori',tag:'Etiket',relation:'İlişki'};
function wwsSearch(query){
  var q=_wwNorm(String(query==null?'':query)).trim();
  if(!q)return [];
  var toks=q.split(/\s+/).filter(function(t){return t.length>=1;});
  var res=[];
  _wwsIndex().forEach(function(e){
    var lbl=_wwNorm(e.label), rank=-1, reason='';
    if(lbl===q){ rank=0; reason='Tam eşleşme'; }
    else if(lbl.indexOf(q)===0){ rank=1; reason='Başlıkta'; }
    else if(lbl.indexOf(q)>=0){ rank=2; reason='Başlıkta'; }
    else if(toks.every(function(t){return e.hay.indexOf(t)>=0;})){ rank=3; reason='İçerikte'; }
    if(rank>=0)res.push({type:e.type,id:e.id,label:e.label,reason:WWS_TYPE_LABEL[e.type]+' · '+reason,rank:rank});
  });
  res.sort(function(a,b){ if(a.rank!==b.rank)return a.rank-b.rank; var ta=WWS_TYPE_ORDER[a.type],tb=WWS_TYPE_ORDER[b.type]; if(ta!==tb)return ta-tb; return String(a.id)<String(b.id)?-1:(String(a.id)>String(b.id)?1:0); });
  // dedup (type+id)
  var seen={}, dedup=[]; res.forEach(function(r){ var k=r.type+'|'+r.id; if(!seen[k]){ seen[k]=1; dedup.push(r); } });
  return dedup;
}
window.wwsSearch=wwsSearch;

/* ── türetilmiş bilgi zaman çizelgesi ── */
function wwsTimeline(){
  var tl=(typeof wiaTimeline==='function')?wiaTimeline():{today:[],week:[],earlier:[]};
  var now=Date.now(), monthAgo=now-30*864e5, month=[];
  _wwList().forEach(function(q){ var u=Date.parse(q.updatedAt||''); if(!isNaN(u)&&u>=monthAgo&&u<now-7*864e5)month.push({id:q.id,quote:String(q.quote||'').slice(0,70),kind:'updated',ts:u}); });
  month.sort(function(a,b){return b.ts-a.ts;});
  return { today:tl.today, week:tl.week, month:month.slice(0,10), earlier:tl.earlier };
}
window.wwsTimeline=wwsTimeline;

/* ── hızlı aksiyonlar (kısayollar) ── */
function wwsQuickActions(){
  return [
    {label:'Bugünün Bilgeliği',icon:'bulb',action:"wwsGo('coach')"},
    {label:'Koçu Aç',icon:'target',action:"wwsGo('coach')"},
    {label:'Kararları Gözden Geçir',icon:'git',action:"wwsGo('executive')"},
    {label:'Haftalık Yansıma',icon:'calendar',action:"wwsGo('analytics')"},
    {label:'Yönetici Raporu',icon:'doc',action:"wwsGo('executive')"},
    {label:'Öğrenme Merkezi',icon:'book',action:"wwsGo('learning')"},
    {label:'Kütüphanede Ara',icon:'search',action:"wwsGo('search')"}
  ];
}
window.wwsQuickActions=wwsQuickActions;

/* ── çapraz gezinme (mevcut açıcılar; 0 write) ── */
function wwsOpenEntity(type,id){
  if(type==='wisdomQuote'&&typeof openWqForm==='function')return openWqForm(id);
  if(type==='goal'&&typeof openGoalDetail==='function')return openGoalDetail(id);
  if(type==='decision'&&typeof djOpenDetail==='function')return djOpenDetail(id);
  if(type==='principle'&&typeof openPrincipleForm==='function')return openPrincipleForm(id);
  if(type==='category'&&typeof wqSetCat==='function'){ wwsGo('search'); return wqSetCat(id); }
  if((type==='author'||type==='tag')&&typeof wwsSetQuery==='function')return wwsSetQuery(String(id));
}
window.wwsOpenEntity=wwsOpenEntity;

/* ── sağ kenar çubuğu (bağlam) ── */
function _wwSideRow(label,val,icon,color){
  return '<div style="padding:6px 0;border-bottom:1px solid var(--s2)"><div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">'+_wwIc(icon,11,color||'var(--t3)')+'<span style="font-size:9px;color:var(--t3);font-weight:700">'+_wwe(label)+'</span></div>'+
    '<div style="font-size:11px;color:var(--t);word-break:break-word">'+_wwe(val)+'</div></div>';
}
var _WW_MOM={improving:'Yükseliyor',declining:'Geriliyor',stable:'Dengeli',idle:'Durgun'};
function wwsSidebarHtml(){
  var s=wwsSessionSnapshot();
  var h='<div class="card" style="padding:11px 13px;max-width:100%"><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'+_wwIc('compass',13,'var(--blue)')+'<span style="font-size:11px;font-weight:800">Bağlam</span></div>';
  h+=_wwSideRow('Güncel Hedef',s.currentGoal,'target','var(--green)');
  h+=_wwSideRow('Güncel Karar',s.currentDecision,'git','var(--orange)');
  h+=_wwSideRow('Güncel İlke',s.currentPrinciple,'shield','var(--purple)');
  if(s.teaching&&s.teaching.quote)h+=_wwSideRow('Bugünün Öğretisi',String(s.teaching.quote).slice(0,70),'bulb','var(--orange)');
  if(s.topRecommendation)h+=_wwSideRow('Koç Önerisi',String(s.topRecommendation.quote).slice(0,70),'star','var(--blue)');
  h+=_wwSideRow('Öncelikli Aksiyon',(s.priorityActions[0]&&s.priorityActions[0].title)||'—','flag','var(--red)');
  h+=_wwSideRow('Çalışma Zamanı',(s.runtimeHealth.fallback?'Yerel Güvenlik Arşivi':'Bulut Arşivi')+' ('+_wwe(s.source)+')','shield',s.runtimeHealth.fallback?'var(--orange)':'var(--green)');
  h+='</div>';
  return h;
}
window.wwsSidebarHtml=wwsSidebarHtml;

/* ── oturum anlık görüntüsü kartları (Panel bölümü) ── */
function _wwSnapCard(label,val,icon,color,sub){
  return '<div class="card" style="padding:10px 12px;flex:1 1 130px;min-width:120px;max-width:100%"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+_wwIc(icon,13,color)+'<span style="font-size:9.5px;color:var(--t3);font-weight:600">'+_wwe(label)+'</span></div>'+
    '<div style="font-size:17px;font-weight:800;color:'+color+';line-height:1.15;word-break:break-word">'+_wwe(val)+'</div>'+(sub?'<div style="font-size:9px;color:var(--t3);margin-top:2px">'+_wwe(sub)+'</div>':'')+'</div>';
}
function _wwsDashboardHtml(){
  var s=wwsSessionSnapshot(), h='';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+=_wwSnapCard('Knowledge Score','%'+s.knowledgeScore,'chk','var(--green)');
  h+=_wwSnapCard('Yansıma Serisi',s.reflectionStreak+' gün','flame','var(--orange)');
  h+=_wwSnapCard('Öğrenme İvmesi',_WW_MOM[s.learningMomentum]||s.learningMomentum,'chart','var(--blue)');
  h+=_wwSnapCard('Karar Hazırlığı','%'+s.decisionReadiness,'git','var(--purple)');
  h+=_wwSnapCard('Koç',s.coachStatus,'target','var(--blue)');
  h+='</div>';
  // hızlı aksiyonlar
  h+='<p style="font-size:10.5px;color:var(--t3);font-weight:700;margin:11px 0 5px">Hızlı Aksiyonlar</p><div style="display:flex;gap:5px;flex-wrap:wrap">';
  wwsQuickActions().forEach(function(a,i){ h+='<button class="btn btn-g btn-sm" onclick="'+a.action+'" title="'+_wwe(a.label)+' (Ctrl+'+(i+1)+')">'+_wwIc(a.icon,11,'var(--t3)')+' '+_wwe(a.label)+'</button>'; });
  h+='</div>';
  // timeline
  var tl=wwsTimeline(); var KIND={reflected:'💡',favorited:'★',pinned:'Sabit',shown:'Görüldü',updated:'Güncel'};
  function blk(t,arr){ if(!arr||!arr.length)return ''; var b='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:8px 0 3px">'+_wwe(t)+'</p>'; arr.slice(0,6).forEach(function(it){ b+='<div style="font-size:10.5px;color:var(--t2);word-break:break-word">'+_wwe(KIND[it.kind]||'')+' '+_wwe(String(it.quote).slice(0,58))+'</div>'; }); return b; }
  var ti=blk('Bugün',tl.today)+blk('Bu Hafta',tl.week)+blk('Bu Ay',tl.month);
  h+='<details style="margin-top:10px;max-width:100%"><summary tabindex="0" style="cursor:pointer;font-size:11px;font-weight:800;color:var(--t2)">'+_wwIc('clock',12,'var(--blue)')+' Bilgi Zaman Çizelgesi</summary><div style="margin-top:6px">'+(ti||'<p style="font-size:10.5px;color:var(--t3)">Etkinlik yok.</p>')+'</div></details>';
  return h;
}

/* ── birleşik arama bölümü ── */
function _wwsSearchHtml(){
  var h='<div style="margin-bottom:10px"><input class="inp" id="wws_search" style="max-width:340px" placeholder="Söz · yazar · kategori · etiket · hedef · karar · ilke..." value="'+_wwe(_wwsQuery)+'" oninput="wwsSetQuery(this.value)" aria-label="Birleşik bilgi araması"></div>';
  if(!_wwsQuery.trim())return h+'<p style="font-size:11px;color:var(--t3)">Tüm bilgi tabanında ara: sözler, yazarlar, kategoriler, etiketler, hedefler, kararlar, ilkeler, ilişkiler.</p>';
  var res=wwsSearch(_wwsQuery);
  h+='<p style="font-size:11px;color:var(--t3);margin-bottom:6px">'+res.length+' sonuç</p>';
  if(!res.length)return h+'<p style="font-size:11px;color:var(--t3)">Eşleşme yok.</p>';
  h+='<div style="display:flex;flex-direction:column;gap:4px">';
  res.slice(0,40).forEach(function(r){ h+='<button class="card" style="padding:8px 11px;max-width:100%;text-align:left;border:1px solid var(--s2);cursor:pointer;display:flex;gap:8px;align-items:center" data-t="'+_wwe(r.type)+'" data-id="'+_wwe(String(r.id))+'" onclick="wwsOpenEntity(this.dataset.t,this.dataset.id)">'+
    '<span class="pill" style="flex-shrink:0;font-size:9px;background:var(--s2);color:var(--t2)">'+_wwe(r.reason)+'</span>'+
    '<span style="font-size:11px;color:var(--t);word-break:break-word;flex:1;min-width:0">'+_wwe(r.label)+'</span>'+_wwIc('arrow',11,'var(--t3)')+'</button>'; });
  h+='</div>';
  return h;
}

/* ── odak modu ── */
function wwsFocusModeHtml(){
  var s=wwsSessionSnapshot(), r=s.topRecommendation;
  var h='<div class="card wd-anim" style="padding:20px 22px;margin-bottom:14px;max-width:100%;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2)">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="display:flex;align-items:center;gap:7px">'+_wwIc('eye',15,'var(--blue)')+'<span style="font-size:12px;font-weight:800">Odak Modu</span></div>'+
    '<button class="btn btn-g btn-sm" onclick="wwsToggleFocus()" title="Odak modundan çık" aria-label="Kapat">'+_wwIc('x',12,'var(--t3)')+' Çık</button></div>';
  if(!r){ h+='<p style="font-size:12px;color:var(--t3)">Gösterilecek öneri yok.</p></div>'; return h; }
  h+='<p style="font-size:18px;font-style:italic;line-height:1.7;color:var(--t);word-break:break-word;text-align:center;padding:10px 0">&ldquo;'+_wwe(r.quote)+'&rdquo;</p>';
  if(r.author)h+='<p style="font-size:12px;font-weight:700;color:var(--blue);text-align:center;margin-bottom:10px">&mdash; '+_wwe(r.author)+'</p>';
  if(r.reason)h+='<p style="font-size:11px;color:var(--t2);text-align:center;margin-bottom:8px">'+_wwe(r.reason)+'</p>';
  if(r.matchedGoal)h+='<div style="font-size:10.5px;color:var(--t3);text-align:center">İlgili hedef: '+_wwe(r.matchedGoal)+'</div>';
  if(r.matchedPrinciple)h+='<div style="font-size:10.5px;color:var(--t3);text-align:center">İlgili ilke: '+_wwe(r.matchedPrinciple)+'</div>';
  h+='<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:14px">';
  h+='<button class="btn btn-g btn-sm" data-id="'+_wwe(String(r.id))+'" onclick="wqToggleReflect(this.dataset.id)">'+_wwIc('chk',11,'var(--green)')+' Bunu düşündüm</button>';
  h+='<button class="btn btn-g btn-sm" onclick="wcoNextRecommendation()">'+_wwIc('refresh',11,'var(--t3)')+' Sonraki Öneri</button>';
  h+='</div></div>';
  return h;
}
window.wwsFocusModeHtml=wwsFocusModeHtml;

/* ── ana bölüm yönlendirici (tek aktif bölüm; O(1)) ── */
function _wwsSectionInner(sec){
  if(sec==='dashboard')return _wwsDashboardHtml();
  if(sec==='coach')return _wwCall('wcoCoachPanelHtml')||'<p style="font-size:11px;color:var(--t3)">Koç kullanılamıyor.</p>';
  if(sec==='learning')return _wwCall('wlcLearningSectionHtml')||_wwCall('wlcDashboardHtml');
  if(sec==='knowledge')return _wwCall('wkgKnowledgeCenterHtml')||_wwCall('wisdomStatsPanelHtml');
  if(sec==='analytics')return _wwCall('wiaExecutiveInsightCenterHtml')||_wwCall('wisdomStatsPanelHtml');
  if(sec==='executive')return _wwCall('werExecutiveWorkspaceHtml');
  if(sec==='search')return _wwsSearchHtml();
  if(sec==='collections')return _wwCall('wkgKnowledgeCenterHtml');
  if(sec==='intel')return (typeof weiDashboardHtml==='function')?weiDashboardHtml():'<p style="font-size:11px;color:var(--t3)">Yönetici Zekâsı kullanılamıyor.</p>';
  if(sec==='kos')return (typeof wkosKnowledgeOsHtml==='function')?wkosKnowledgeOsHtml():'<p style="font-size:11px;color:var(--t3)">Kurumsal Bilgi Haritası kullanılamıyor.</p>';
  if(sec==='settings')return (typeof wpPreferencesSheetHtml==='function')?wpPreferencesSheetHtml():'<p style="font-size:11px;color:var(--t3)">Kişiselleştirme tercihleri sonraki fazda (P9) eklenecek. Şimdilik gösterim ayarları alttaki panellerden yönetilir.</p>';
  return '';
}
function _wwsMainHtml(){
  return '<div id="wws_main" role="tabpanel" aria-labelledby="wws_nav_'+_wwsSection+'" style="min-width:0">'+_wwsSectionInner(_wwsSection)+'</div>';
}

/* ── tam workspace ── */
function wwsWorkspaceHtml(){
  if(!_wwList().length)return '';
  if(_wwsFocus)return wwsFocusModeHtml();
  var h='<div class="card wd-anim" style="padding:12px 14px;margin-bottom:14px;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2);max-width:100%" onkeydown="wwsKey(event)">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">'+_wwIc('grid',16,'var(--blue)')+'<h2 style="font-size:14px;font-weight:800;letter-spacing:.03em">Bilgi Çalışma Alanı</h2>'+
    '<button class="btn btn-g btn-sm" style="margin-left:auto" onclick="wwsToggleFocus()" title="Odak modu">'+_wwIc('eye',12,'var(--t3)')+' Odak</button></div>';
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">';
  // sol nav (dikey tablist)
  h+='<nav role="tablist" aria-orientation="vertical" aria-label="Çalışma alanı bölümleri" style="display:flex;flex-direction:column;gap:3px;flex:0 0 auto;min-width:130px;max-width:100%">';
  WWS_NAV.forEach(function(t){ var a=_wwsSection===t[0];
    h+='<button role="tab" id="wws_nav_'+t[0]+'" aria-selected="'+(a?'true':'false')+'" tabindex="'+(a?'0':'-1')+'" data-sec="'+t[0]+'" onclick="wwsGo(this.dataset.sec)" class="btn btn-sm" style="justify-content:flex-start;background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'">'+_wwIc(t[2],12,a?'#fff':'var(--t3)')+' '+_wwe(t[1])+'</button>'; });
  h+='</nav>';
  // ana alan
  h+='<div style="flex:1 1 320px;min-width:0">'+_wwsMainHtml()+'</div>';
  // sağ kenar çubuğu
  h+='<div style="flex:0 0 auto;min-width:180px;max-width:100%">'+wwsSidebarHtml()+'</div>';
  h+='</div></div>';
  return h;
}
window.wwsWorkspaceHtml=wwsWorkspaceHtml;

/* ── etkileşim (0 write; yalnız görsel) ── */
function _wwsRerender(){ if(typeof renderWisdomQuotes==='function'&&tab==='wisdom')renderWisdomQuotes(); }
function wwsGo(sec){ _wwsSection=sec; var el=(typeof ge==='function')?ge('wws_main'):null; if(el)el.innerHTML=_wwsSectionInner(sec); _wwsRerender(); }
window.wwsGo=wwsGo;
function wwsToggleFocus(){ _wwsFocus=!_wwsFocus; _wwsRerender(); }
window.wwsToggleFocus=wwsToggleFocus;
function wwsSetQuery(q){ _wwsQuery=String(q==null?'':q); if(_wwsSection!=='search')_wwsSection='search'; var el=(typeof ge==='function')?ge('wws_main'):null; if(el)el.innerHTML=_wwsSectionInner('search'); }
window.wwsSetQuery=wwsSetQuery;
function wwsKey(ev){ if(!ev||!ev.ctrlKey)return; var n=parseInt(ev.key,10); if(n>=1&&n<=WWS_NAV.length){ if(typeof ev.preventDefault==='function')ev.preventDefault(); wwsGo(WWS_NAV[n-1][0]); } }
window.wwsKey=wwsKey;

/* Kompakt giriş noktası (üstte; mevcut paneller korunur, çalışma alanı ek katman) */
function wwsEntryPointHtml(){ return wwsWorkspaceHtml(); }
window.wwsEntryPointHtml=wwsEntryPointHtml;
