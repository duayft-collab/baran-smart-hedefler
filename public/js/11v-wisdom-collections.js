/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom P5 — KNOWLEDGE COLLECTIONS & KNOWLEDGE GRAPH (TÜRETİLMİŞ)
   Tamamen SALT OKUNUR. Tek kaynak: mevcut wisdom (wqList/wqById) + relations
   (getRelatedEntities) + P4 türetimleri (wlcRelated yeniden kullanılır). Yeni
   koleksiyon/alan/write/migration/restore/listener YOK. Grafik YOK. Design system.
   ══════════════════════════════════════════════════════════════════════════ */

function _wkList(){ return (typeof wqList==='function')?wqList():(Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]); }
function _wkActive(){ return _wkList().filter(function(q){ return q&&q.active!==false&&String(q.quote==null?'':q.quote).trim(); }); }
function _wkTs(x){ if(x==null||x==='')return 0; var t=Date.parse(x); if(!isNaN(t))return t; var n=Number(x); return isNaN(n)?0:n; }
function _wkNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr').replace(/\s+/g,' ').trim(); }
function _wke(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _wkIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _wkRelCount(id){ var o=(typeof getOutgoingRelations==='function')?getOutgoingRelations('wisdomQuote',id).length:0; var i=(typeof getIncomingRelations==='function')?getIncomingRelations('wisdomQuote',id).length:0; return o+i; }
function _wkGoalRels(id){ if(typeof getRelatedEntities!=='function')return 0; try{ return getRelatedEntities('wisdomQuote',id).filter(function(x){return x&&x.entity&&x.entity.type==='goal';}).length; }catch(e){ return 0; } }

/* ── 1) Koleksiyonlar (hazır; kategori + anahtar kelime türetimi) ── */
var WKG_COLLECTIONS=[
  {name:'Hayatımı Değiştirenler',special:'fav_reflect'},
  {name:'İş Dünyası',cats:['Yönetim','Ticaret','Girişimcilik']},
  {name:'Liderlik',cats:['Liderlik']},
  {name:'Disiplin',cats:['Disiplin']},
  {name:'Satış',cats:['Satış']},
  {name:'Finans',cats:['Finans']},
  {name:'Girişimcilik',cats:['Girişimcilik']},
  {name:'Aile',cats:['Aile']},
  {name:'Çocuk Eğitimi',cats:['Çocuk'],keys:['çocuk','eğitim']},
  {name:'İslam',cats:['İslam']},
  {name:'Bilim',cats:['Bilim']},
  {name:'Tarih',cats:['Tarih']},
  {name:'Psikoloji',cats:['Psikoloji']},
  {name:'Yazılım',cats:['Yazılım']},
  {name:'Teknoloji',cats:['Teknoloji']},
  {name:'Stoacılık',keys:['stoa','stoacı','marcus','epiktetos','seneca']},
  {name:'Başarı',keys:['başarı','başaracak']},
  {name:'Karar Verme',keys:['karar','tercih']},
  {name:'Müzakere',cats:['Müzakere'],keys:['müzakere','pazarlık']},
  {name:'Üretkenlik',cats:['Üretkenlik'],keys:['üretken','verimli','odak']}
];
window.WKG_COLLECTIONS=WKG_COLLECTIONS;
function _wkMatch(def,q){
  if(def.special==='fav_reflect')return !!(q.favorite||q.reflected);
  if(def.cats&&def.cats.indexOf(q.category)>=0)return true;
  if(def.keys){ var hay=_wkNorm(q.quote+' '+(q.tags||[]).join(' ')+' '+(q.category||'')); return def.keys.some(function(k){return hay.indexOf(k)>=0;}); }
  return false;
}
function wkgCollectionItems(name){ var def=WKG_COLLECTIONS.filter(function(d){return d.name===name;})[0]; if(!def)return []; return _wkActive().filter(function(q){return _wkMatch(def,q);}); }
function wkgCollection(name){
  var items=wkgCollectionItems(name); if(!items.length)return {name:name,total:0,favorites:0,lastRead:null,mostPopular:null,relatedGoals:0,items:[]};
  var fav=0,goalRels=0,lastRead=null,mostPop=null;
  items.forEach(function(q){ if(q.favorite)fav++; goalRels+=_wkGoalRels(q.id);
    var t=_wkTs(q.lastShownAt); if(t&&(!lastRead||t>_wkTs(lastRead.lastShownAt)))lastRead=q;
    if(!mostPop||(q.showCount||0)>(mostPop.showCount||0))mostPop=q; });
  return {name:name,total:items.length,favorites:fav,lastRead:lastRead,mostPopular:mostPop,relatedGoals:goalRels,items:items};
}
function wkgCollections(){ return WKG_COLLECTIONS.map(function(d){ var c=wkgCollection(d.name); return {name:c.name,total:c.total,favorites:c.favorites,relatedGoals:c.relatedGoals,mostPopularId:c.mostPopular?c.mostPopular.id:null}; }); }
window.wkgCollections=wkgCollections; window.wkgCollection=wkgCollection; window.wkgCollectionItems=wkgCollectionItems;

/* ── 2) Knowledge Graph (P4 wlcRelated yeniden kullanılır + kitap/konu) ── */
function wkgGraph(id){
  var base=(typeof wlcRelated==='function')?wlcRelated(id):null; if(!base)return null;
  var rel=(typeof getRelatedEntities==='function')?getRelatedEntities('wisdomQuote',id):[];
  function relOf(t){ return (rel||[]).filter(function(x){return x&&x.entity&&x.entity.type===t;}).map(function(x){return x.entity;}); }
  return {
    sameTopic:base.similar, sameAuthor:base.sameAuthor, similarTag:base.sameTag, similarContent:base.similar,
    sameCategory:base.sameCategory, relatedDecisions:base.relatedDecisions, relatedGoals:base.relatedGoals,
    relatedBooks:relOf('mybook').concat(relOf('book')), relatedNotes:base.relatedNotes
  };
}
window.wkgGraph=wkgGraph;

/* ── 3) Bilgi Zinciri: söz → ilişkili sözler → kitap → hedef → karar → not ── */
function wkgChain(id){
  var q=(typeof wqById==='function')?wqById(id):null; if(!q)return null;
  var g=wkgGraph(id)||{};
  return { quote:q, relatedQuotes:(g.sameTopic||[]).slice(0,5), book:(g.relatedBooks||[])[0]||null,
    goal:(g.relatedGoals||[])[0]||null, decision:(g.relatedDecisions||[])[0]||null, note:(g.relatedNotes||[])[0]||null };
}
window.wkgChain=wkgChain;

/* ── 4) Uzmanlık Alanları ── */
var WKG_FIELDS=['Yönetim','Satış','Liderlik','Finans','Yatırım','Pazarlama','Psikoloji','Yazılım','Teknoloji','İnsan Kaynakları','Ticaret','İslam','Tarih','Bilim','Üretim','Lojistik'];
window.WKG_FIELDS=WKG_FIELDS;
function _wkFieldItems(field){ var kn=_wkNorm(field); return _wkActive().filter(function(q){ if(q.category===field)return true; var hay=_wkNorm(q.quote+' '+(q.tags||[]).join(' ')); return hay.indexOf(kn)>=0; }); }
function wkgExpertise(){
  var total=_wkActive().length||1;
  return WKG_FIELDS.map(function(f){
    var items=_wkFieldItems(f), fav=0,read=0,refl=0;
    items.forEach(function(q){ if(q.favorite)fav++; if((q.showCount||0)>0)read++; if(q.reflected)refl++; });
    var density=Math.round(items.length/total*1000)/10; // %
    var score=items.length?Math.round((read*0.4+fav*0.35+refl*0.25)/items.length*100):0;
    return {field:f,total:items.length,expertiseScore:score,density:density,favorites:fav};
  });
}
window.wkgExpertise=wkgExpertise;

/* ── 5) Bilgi Skoru ── */
function wkgKnowledgeScore(){
  var pool=_wkActive(); if(!pool.length)return 0;
  var read=0,fav=0,rel=0,reread=0,noted=0;
  pool.forEach(function(q){ if((q.showCount||0)>0)read++; if(q.favorite)fav++; if(_wkRelCount(q.id)>0)rel++; if(q.pinned)reread++; if(q.notes&&String(q.notes).trim())noted++; });
  var n=pool.length;
  var s=(read/n)*30+(fav/n)*20+(rel/n)*20+(reread/n)*15+(noted/n)*15;
  return Math.round(Math.max(0,Math.min(100,s)));
}
window.wkgKnowledgeScore=wkgKnowledgeScore;

/* ── 6) Bilgi Radarları ── */
function wkgRadars(){
  var ex=wkgExpertise().filter(function(x){return x.total>0;});
  var byScore=ex.slice().sort(function(a,b){return b.expertiseScore-a.expertiseScore;});
  var byTotal=ex.slice().sort(function(a,b){return b.total-a.total;});
  var pool=_wkActive();
  // en aktif kategori/yazar (okunmuşluğa göre)
  var catRead={},authRead={};
  pool.forEach(function(q){ var r=(q.showCount||0); if(q.category)catRead[q.category]=(catRead[q.category]||0)+r; if(q.author)authRead[q.author]=(authRead[q.author]||0)+r; });
  function topKey(m){ var k=null,v=-1; Object.keys(m).forEach(function(x){ if(m[x]>v){v=m[x];k=x;} }); return k; }
  // gelişen = son 30 günde en çok gösterilen alan; ihmal = en düşük skorlu (>0)
  var growing={},nowMs=Date.now(),monthAgo=nowMs-30*864e5;
  pool.forEach(function(q){ var t=_wkTs(q.lastShownAt); if(t>=monthAgo&&q.category)growing[q.category]=(growing[q.category]||0)+1; });
  return {
    strongest:byScore[0]?byScore[0].field:null,
    weakest:byScore.length?byScore[byScore.length-1].field:null,
    mostGrowing:topKey(growing),
    mostNeglected:byTotal.length?byTotal[byTotal.length-1].field:null,
    mostActiveCategory:topKey(catRead),
    mostActiveAuthor:topKey(authRead)
  };
}
window.wkgRadars=wkgRadars;

/* ── 7) Dashboard kartları ── */
function wkgDashboardCards(){
  var cols=wkgCollections(), ex=wkgExpertise();
  return {
    knowledgeScore:wkgKnowledgeScore(),
    collections:cols.filter(function(c){return c.total>0;}).length,
    expertiseAreas:ex.filter(function(x){return x.total>0;}).length,
    graphNodes:_wkActive().length,
    radar:wkgRadars().strongest,
    learningDensity:(function(){ var pool=_wkActive(); if(!pool.length)return 0; var read=pool.filter(function(q){return (q.showCount||0)>0;}).length; return Math.round(read/pool.length*100); })()
  };
}
window.wkgDashboardCards=wkgDashboardCards;

/* ── UI: Bilgi Merkezi üst başlığı + özet + koleksiyon/uzmanlık/radar (design system) ── */
function _wkStat(label,val,icon,color){
  return '<div class="card" style="padding:10px 12px;flex:1 1 140px;min-width:130px;max-width:100%">'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+_wkIc(icon,13,color)+'<span style="font-size:9.5px;color:var(--t3);font-weight:600">'+_wke(label)+'</span></div>'+
    '<div style="font-size:18px;font-weight:800;color:'+color+';line-height:1.15;word-break:break-word">'+_wke(val)+'</div></div>';
}
function wkgKnowledgeCenterHtml(){
  if(!_wkActive().length)return '';
  var d=wkgDashboardCards();
  var h='<div class="card wd-anim" style="padding:14px 16px;margin-bottom:14px;background:linear-gradient(135deg,var(--bl),var(--s));border:1px solid var(--s2);max-width:100%">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:11px">'+_wkIc('brain',16,'var(--purple)')+'<h2 style="font-size:14px;font-weight:800;letter-spacing:.04em">Bilgi Merkezi</h2></div>';
  // özet 4 kart
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  h+=_wkStat('Toplam Bilgi',d.graphNodes,'qt','var(--blue)');
  h+=_wkStat('Koleksiyon Sayısı',d.collections,'layers','var(--purple)');
  h+=_wkStat('Uzmanlık Alanı',d.expertiseAreas,'us','var(--green)');
  h+=_wkStat('Knowledge Score','%'+d.knowledgeScore,'chk','var(--green)');
  h+='</div>';
  // katlı detaylar: koleksiyonlar + uzmanlık + radar
  h+='<details style="margin-top:4px"><summary style="cursor:pointer;font-size:11px;font-weight:700;color:var(--t2);padding:2px 0">Koleksiyonlar · Uzmanlık · Radar</summary><div style="margin-top:9px">';
  // Koleksiyonlar
  h+='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:2px 0 6px">Koleksiyonlar</p><div style="display:flex;gap:5px;flex-wrap:wrap">';
  wkgCollections().filter(function(c){return c.total>0;}).forEach(function(c){ h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:var(--t2)">'+_wke(c.name)+' <b style="color:var(--blue)">'+c.total+'</b>'+(c.favorites?' ★'+c.favorites:'')+'</span>'; });
  h+='</div>';
  // Uzmanlık Alanları
  h+='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:12px 0 6px">Uzmanlık Alanları</p><div style="display:flex;gap:8px;flex-wrap:wrap">';
  wkgExpertise().filter(function(x){return x.total>0;}).slice(0,12).forEach(function(x){
    h+='<div class="card" style="padding:8px 11px;flex:1 1 120px;min-width:110px"><p style="font-size:9.5px;font-weight:700">'+_wke(x.field)+'</p><p style="font-size:9px;color:var(--t3)">'+x.total+' söz · %'+x.density+' yoğunluk</p><div style="margin-top:4px">'+((typeof progBar==='function')?progBar(x.expertiseScore):'')+'</div></div>'; });
  h+='</div>';
  // Radar
  var r=wkgRadars();
  h+='<p style="font-size:10px;color:var(--t3);font-weight:700;margin:12px 0 6px">Bilgi Radarı</p><div style="display:flex;gap:5px;flex-wrap:wrap">';
  [['En Güçlü',r.strongest,'var(--green)'],['En Zayıf',r.weakest,'var(--orange)'],['En Gelişen',r.mostGrowing,'var(--blue)'],['En İhmal',r.mostNeglected,'var(--red)'],['Aktif Kategori',r.mostActiveCategory,'var(--t2)'],['Aktif Yazar',r.mostActiveAuthor,'var(--t2)']].forEach(function(x){
    if(x[1])h+='<span class="pill" style="font-size:9.5px;background:var(--s2);color:'+x[2]+'">'+_wke(x[0])+': '+_wke(String(x[1]).slice(0,22))+'</span>'; });
  h+='</div>';
  h+='</div></details></div>';
  return h;
}
window.wkgKnowledgeCenterHtml=wkgKnowledgeCenterHtml;
