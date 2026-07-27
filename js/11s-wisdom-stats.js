/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Wisdom Sharding P3a — WISDOM STATS PANEL (TÜRETİLMİŞ, SALT OKUNUR)
   Özlü Sözler ekranına profesyonel istatistik paneli. Veri TEK geçiş noktası
   wqList() üzerinden okunur (sharded modda koleksiyon cache, legacy modda dizi).
   Yeni koleksiyon/alan/write YOK. Grafik yok; sadece kart + sayı. D'ye 0 mutasyon.
   Design system (card + ic + değişkenler). Tam responsive (flex-wrap, min-width, %).
   ══════════════════════════════════════════════════════════════════════════ */

function _wsTs(x){ if(x==null||x==='')return 0; var t=Date.parse(x); if(!isNaN(t))return t; var n=Number(x); return isNaN(n)?0:n; }
function _wsDayKey(ts){ try{ return new Date(ts).toISOString().slice(0,10); }catch(e){ return ''; } }
function _wsDate(x){ var t=_wsTs(x); if(!t)return '—'; try{ var d=new Date(t); return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear(); }catch(e){ return '—'; } }

/* Türetilmiş istatistikler — wqList() üzerinden (dual-read). Saf; 0 write. */
function wisdomStats(now){
  var l=(typeof wqList==='function')?wqList():(Array.isArray(D.wisdomQuotes)?D.wisdomQuotes:[]);
  var nowMs=now?(now instanceof Date?now.getTime():Number(now)):Date.now();
  var todayKey=_wsDayKey(nowMs), weekAgo=nowMs-7*864e5;
  var fav=0,cats={},authors={},langs={},todayShown=0,weekShown=0,newest=null,newestUpd=null;
  l.forEach(function(q){
    if(!q)return;
    if(q.favorite)fav++;
    if(q.category&&String(q.category).trim())cats[q.category]=1;
    if(q.author&&String(q.author).trim())authors[q.author]=1;
    langs[q.language||'tr']=1;
    if(q.lastShownAt){ var t=_wsTs(q.lastShownAt); if(t){ if(_wsDayKey(t)===todayKey)todayShown++; if(t>=weekAgo)weekShown++; } }
    if(q.createdAt&&(!newest||_wsTs(q.createdAt)>_wsTs(newest.createdAt)))newest=q;
    if(q.updatedAt&&(!newestUpd||_wsTs(q.updatedAt)>_wsTs(newestUpd.updatedAt)))newestUpd=q;
  });
  return { total:l.length, favorites:fav, categories:Object.keys(cats).length, authors:Object.keys(authors).length,
    languages:Object.keys(langs).length, todayShown:todayShown, weekShown:weekShown,
    newest:newest, newestUpdated:newestUpd,
    newestAt:newest?_wsDate(newest.createdAt):'—', newestUpdatedAt:newestUpd?_wsDate(newestUpd.updatedAt):'—' };
}
window.wisdomStats=wisdomStats;

function _wsCard(label,val,sub,icon,color){
  var e=(typeof U!=='undefined'&&U.esc)?U.esc:function(s){return String(s==null?'':s);};
  var icn=(typeof ic==='function')?ic(icon,14,color):'';
  return '<div class="card" style="padding:11px 13px;flex:1 1 130px;min-width:120px;max-width:100%">'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">'+icn+'<span style="font-size:10px;color:var(--t3);font-weight:600">'+e(label)+'</span></div>'+
    '<div style="font-size:19px;font-weight:800;color:'+color+';line-height:1.1;word-break:break-word">'+e(val)+'</div>'+
    (sub?'<div style="font-size:9.5px;color:var(--t3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e(sub)+'</div>':'')+
    '</div>';
}
/* Panel — 9 kart, tam responsive (flex-wrap; sabit px genişlik yok). */
function wisdomStatsPanelHtml(now){
  var s=wisdomStats(now);
  if(!s.total)return ''; // boş kütüphanede panel gösterme
  var icn=(typeof ic==='function')?ic('qt',13,'var(--blue)'):'';
  var newQ=s.newest&&s.newest.quote?String(s.newest.quote).slice(0,28):'';
  var updQ=s.newestUpdated&&s.newestUpdated.quote?String(s.newestUpdated.quote).slice(0,28):'';
  var h='<div class="card" style="padding:12px 14px;margin-bottom:14px;max-width:100%">';
  h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">'+icn+'<h3 style="font-size:13px;font-weight:800">Kütüphane İstatistikleri</h3></div>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+=_wsCard('Toplam Söz',s.total,null,'qt','var(--blue)');
  h+=_wsCard('Favoriler',s.favorites,null,'star','var(--orange)');
  h+=_wsCard('Kategori',s.categories,null,'layers','var(--purple)');
  h+=_wsCard('Yazar',s.authors,null,'us','var(--green)');
  h+=_wsCard('Dil',s.languages,null,'ref','var(--t2)');
  h+=_wsCard('Bugün Okunan',s.todayShown,null,'chk','var(--green)');
  h+=_wsCard('Bu Hafta Gösterilen',s.weekShown,null,'zap','var(--blue)');
  h+=_wsCard('Son Eklenen',s.newestAt,newQ,'plus','var(--t)');
  h+=_wsCard('Son Güncellenen',s.newestUpdatedAt,updQ,'edit','var(--t)');
  h+='</div></div>';
  return h;
}
window.wisdomStatsPanelHtml=wisdomStatsPanelHtml;
