/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Cross-Module Knowledge Integration K1 (TÜRETİLMİŞ · SALT OKUNUR)
   Wisdom'ı platformun bilgi katmanı yapar: kullanıcı iş yaparken (Hedef/Karar/İlke…)
   bağlama uygun TEK küçük "İlgili Bilgelik" kartı yüzeye çıkar. Wisdom modülü minimal
   kalır; yeni dashboard/panel/veri modeli YOK. Tek okuma girişi wqList()/wqById() +
   mevcut relations (getRelatedEntities) + koç önerisi (wcoRecommend) YENİDEN KULLANILIR.
   0 write / 0 network / 0 listener / 0 timer. Çapraz gezinme mevcut açıcılarla.
   ══════════════════════════════════════════════════════════════════════════ */

function _wie(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _wiIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||12,cl):''; }
function _wiNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr'); }
var _WI_STOP={ 've':1,'ile':1,'için':1,'bir':1,'bu':1,'the':1,'and':1,'for':1,'de':1,'da':1,'ki':1,'en':1 };
function _wiTokens(s){ var raw=_wiNorm(s).replace(/[^0-9a-zçğıöşü\s]/g,' ').split(/\s+/), seen={}, out=[]; for(var i=0;i<raw.length;i++){ var t=raw[i]; if(t.length<3||_WI_STOP[t])continue; if(!seen[t]){ seen[t]=1; out.push(t); } } return out; }
function _wiBag(arr){ var m={}; (arr||[]).forEach(function(t){ if(t)m[_wiNorm(t)]=1; }); return m; }
function _wiOverlap(tokens,bag){ var n=0; for(var i=0;i<tokens.length;i++)if(bag[tokens[i]])n++; return n; }
function _wiActive(){ var l=(typeof wqList==='function')?wqList():[]; return l.filter(function(q){ return q&&q.active!==false&&String(q.quote==null?'':q.quote).trim(); }); }

/* ── Bağlam üreticileri (mevcut alanlardan; salt-okunur) ── */
function wiCtxFromGoal(g){ if(!g)return null; return {type:'goal',id:g.id,text:[g.title,g.desc,g.cat,g.measurable].join(' '),tags:(g.tags||[]),category:g.cat||'',lifeArea:''}; }
function wiCtxFromDecision(d){ if(!d)return null; return {type:'decision',id:d.id,text:[d.title,d.decision,d.context].join(' '),tags:(d.tags||[]),category:'',lifeArea:''}; }
function wiCtxFromPrinciple(p){ if(!p)return null; return {type:'principle',id:p.id,text:[p.title,p.statement,p.text].join(' '),tags:(p.tags||[]),category:p.category||'',lifeArea:(typeof pAreaLabel==='function'?pAreaLabel(p.lifeArea):'')}; }
window.wiCtxFromGoal=wiCtxFromGoal; window.wiCtxFromDecision=wiCtxFromDecision; window.wiCtxFromPrinciple=wiCtxFromPrinciple;

/* ── Öneri: (1) açık ilişki, (2) bağlam token örtüşmesi; bağlam yoksa koç önerisi ── */
function _wiReason(ctx,ov,tagM,catM){
  if(catM)return 'Odak: '+ctx.category;
  if(tagM)return 'Ortak etiket';
  if(ov>0)return 'İçerik örtüşmesi';
  return 'Öne çıkan bilgelik';
}
function wiRecommend(ctx,limit){
  limit=limit||2; var list=_wiActive(); if(!list.length)return [];
  var hasCtx=ctx&&(String(ctx.text||'').trim()||(ctx.tags&&ctx.tags.length)||ctx.category);
  if(!hasCtx){ // bağlam yok → mevcut koç önerisini yeniden kullan
    if(typeof wcoRecommend==='function'){ var r=(wcoRecommend(null,limit)||[]); return r.map(function(x){return {id:x.id,quote:x.quote,author:x.author||'',reason:x.reason||'Öne çıkan bilgelik'};}); }
    return list.slice(0,limit).map(function(q){return {id:q.id,quote:q.quote,author:q.author||'',reason:'Öne çıkan bilgelik'};});
  }
  var out=[], seen={};
  // 1) açık ilişki (relations motoru yeniden kullanılır)
  if(ctx.type&&ctx.id&&typeof getRelatedEntities==='function'){ try{ getRelatedEntities(ctx.type,ctx.id).forEach(function(x){ if(out.length>=limit)return; if(!x.entity||x.entity.type!=='wisdomQuote')return; var q=(typeof wqById==='function')?wqById(x.entity.id):null; if(q&&!seen[q.id]){ seen[q.id]=1; out.push({id:q.id,quote:q.quote,author:q.author||'',reason:'İlişkilendirilmiş'}); } }); }catch(e){} }
  // 2) token örtüşmesi
  var toks=_wiTokens(ctx.text||''), tagset=_wiBag(ctx.tags||[]), la=_wiTokens(ctx.lifeArea||'');
  var scored=list.map(function(q){ var qt=_wiTokens(String(q.quote||'')+' '+(q.tags||[]).join(' ')+' '+(q.category||'')); var ov=_wiOverlap(qt,_wiBag(toks))+_wiOverlap(qt,_wiBag(la)); var tagM=(q.tags||[]).filter(function(t){return tagset[_wiNorm(t)];}).length; var catM=(ctx.category&&q.category===ctx.category)?1:0; return {q:q, s:ov*1+tagM*0.8+catM*0.9+(q.reflected?0.3:0)+(q.favorite?0.2:0), reason:_wiReason(ctx,ov,tagM,catM)}; });
  scored.sort(function(a,b){ if(b.s!==a.s)return b.s-a.s; return String(a.q.id)<String(b.q.id)?-1:(String(a.q.id)>String(b.q.id)?1:0); });
  scored.forEach(function(x){ if(out.length>=limit)return; if(seen[x.q.id])return; seen[x.q.id]=1; out.push({id:x.q.id,quote:x.q.quote,author:x.q.author||'',reason:x.reason}); });
  return out.slice(0,limit);
}
window.wiRecommend=wiRecommend;

/* ── Çapraz gezinme: söze odaklı Wisdom (mevcut açıcı yeniden kullanılır) ── */
function wiOpen(id){ if(typeof closeModal==='function')closeModal(); if(typeof gotoTab==='function')gotoTab('wisdom'); if(typeof openWqForm==='function')openWqForm(id); }
window.wiOpen=wiOpen;

/* ── UI: tek küçük "İlgili Bilgelik" kartı (ikincil; iş akışı birincil kalır) ── */
function wiCardHtml(ctx){
  var recs=wiRecommend(ctx,2); if(!recs.length)return '';
  var r=recs[0], id=_wie(String(r.id));
  var h='<div class="card" style="padding:11px 13px;margin:10px 0;max-width:100%;border:1px solid var(--s2)">';
  h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">'+_wiIc('qt',12,'var(--blue)')+'<span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);font-weight:700">İlgili Bilgelik</span></div>';
  h+='<p style="font-size:12.5px;font-style:italic;line-height:1.55;color:var(--t);word-break:break-word">&ldquo;'+_wie(r.quote)+'&rdquo;</p>';
  if(r.author)h+='<p style="font-size:11px;font-weight:700;color:var(--blue);margin-top:3px">&mdash; '+_wie(r.author)+'</p>';
  if(r.reason)h+='<p style="font-size:9px;color:var(--t3);margin-top:3px">'+_wie(r.reason)+'</p>';
  h+='<div style="display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;align-items:center">';
  h+='<button class="btn btn-g btn-sm" data-id="'+id+'" onclick="wiOpen(this.dataset.id)" title="Wisdom\'da aç">'+_wiIc('ar',11,'var(--t3)')+' Aç</button>';
  if(recs[1]){ var id2=_wie(String(recs[1].id));
    h+='<details style="margin:0"><summary style="cursor:pointer;font-size:10.5px;color:var(--t3);list-style:none">Başka öneri</summary>'+
       '<div style="margin-top:6px"><p style="font-size:11.5px;font-style:italic;color:var(--t2);line-height:1.5;word-break:break-word">&ldquo;'+_wie(recs[1].quote)+'&rdquo;</p>'+
       '<button class="btn btn-g btn-sm" style="margin-top:4px" data-id="'+id2+'" onclick="wiOpen(this.dataset.id)">'+_wiIc('ar',11,'var(--t3)')+' Aç</button></div></details>'; }
  h+='</div></div>';
  return h;
}
window.wiCardHtml=wiCardHtml;
