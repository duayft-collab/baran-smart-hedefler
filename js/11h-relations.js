/* ══════════════════════════════════════════════════════════════════════════
   PERSONAL-KNOWLEDGE-P0-1 — İLİŞKİLER (relations[]) ALTYAPISI
   Additive. Ortak, üst-seviye D.relations[] — kaynak kayıtlara GÖMÜLÜ DEĞİL.
   Koleksiyonlar arası (wisdomQuote/principle/goal, ileride Decision) bağ kurar.
   Restore motoruna, backup sayımına DOKUNMADAN yalnız DIFF_SCHEMA/countRecords'a
   kayıt eklenir (04-backup.js) — yeni bir alt-sistem YOK, mevcut desen genişletilir.
   Resolver deseni ContentEngine'in (11e) CD_ADAPTERS registry'siyle aynı ruhtadır.
   ══════════════════════════════════════════════════════════════════════════ */

var REL_TYPES=['used_in','derived_from','inspired_by','related_to'];
var REL_CONFIDENCE=['low','medium','high'];

function relList(){ if(!Array.isArray(D.relations))D.relations=[]; return D.relations; }
window.relList=relList;

var _relSeq_c=0;
function _relSeq(){ _relSeq_c++; return _relSeq_c; }
/* Mevcut newWqId()/newPrincipleId() deseniyle aynı iskelet (prefix+timestamp36+seq36),
   yalnız prefix'ten sonra "_" var — backup/export JSON'ını gözle okurken prefix'in
   nerede bittiği belirsiz olmasın diye (kullanıcı talebi). */
function newRelationId(){ return 'rel_'+Date.now().toString(36)+'-'+(_relSeq()).toString(36); }
function _relNow(){ try{return new Date().toISOString();}catch(e){return String(Date.now());} }

function relValidateType(t){ return REL_TYPES.indexOf(t)>=0; }
function relValidateConfidence(c){ return REL_CONFIDENCE.indexOf(c)>=0; }

/* Duplicate anahtarı: sourceType+sourceId+targetType+targetId+relationType. */
function _relKey(r){ return [r.sourceType,r.sourceId,r.targetType,r.targetId,r.relationType].join('||'); }
function relFind(sourceType,sourceId,targetType,targetId,relationType){
  var key=[sourceType,sourceId,targetType,targetId,relationType].join('||');
  return relList().filter(function(r){return _relKey(r)===key;})[0]||null;
}

/* Ekle veya güncelle. Duplicate anahtar varsa YENİ KAYIT AÇILMAZ — mevcut
   kaydın note/confidence/updatedAt alanları güncellenir (madde 6/7 kuralı). */
function relAdd(input){
  input=input||{};
  if(!input.sourceType||input.sourceId==null||!input.targetType||input.targetId==null)
    return {ok:false,error:'MISSING_FIELDS'};
  var relationType=input.relationType||'related_to';
  if(!relValidateType(relationType))return {ok:false,error:'INVALID_RELATION_TYPE'};
  var confidence=input.confidence||'medium';
  if(!relValidateConfidence(confidence))return {ok:false,error:'INVALID_CONFIDENCE'};
  var sourceType=String(input.sourceType), sourceId=String(input.sourceId);
  var targetType=String(input.targetType), targetId=String(input.targetId);
  var existing=relFind(sourceType,sourceId,targetType,targetId,relationType);
  if(existing){
    if(input.note!=null)existing.note=String(input.note);
    existing.confidence=confidence;
    existing.updatedAt=_relNow();
    return {ok:true,relation:existing,created:false};
  }
  var now=_relNow();
  var rec={
    id:newRelationId(),
    sourceType:sourceType, sourceId:sourceId,
    targetType:targetType, targetId:targetId,
    relationType:relationType, confidence:confidence,
    note:input.note!=null?String(input.note):'',
    createdAt:now, updatedAt:now
  };
  relList().push(rec);
  return {ok:true,relation:rec,created:true};
}

function relUpdate(id,patch){
  var r=relList().filter(function(x){return String(x.id)===String(id);})[0];
  if(!r)return {ok:false,error:'NOT_FOUND'};
  patch=patch||{};
  if(patch.note!=null)r.note=String(patch.note);
  if(patch.confidence!=null){
    if(!relValidateConfidence(patch.confidence))return {ok:false,error:'INVALID_CONFIDENCE'};
    r.confidence=patch.confidence;
  }
  r.updatedAt=_relNow();
  return {ok:true,relation:r};
}

/* Olmayan id için güvenli no-op (madde 22). */
function relDelete(id){
  var before=relList().length;
  D.relations=relList().filter(function(x){return String(x.id)!==String(id);});
  return {ok:true,deleted:before!==D.relations.length};
}

function getOutgoingRelations(sourceType,sourceId){
  return relList().filter(function(r){return r.sourceType===sourceType&&String(r.sourceId)===String(sourceId);});
}
function getIncomingRelations(targetType,targetId){
  return relList().filter(function(r){return r.targetType===targetType&&String(r.targetId)===String(targetId);});
}
/* Çözülmüş görünüm: hedefi/kaynağı bulunamayan (dangling) ilişkiler burada
   SESSİZCE ATLANIR (madde 13) — ham veri (getOutgoing/IncomingRelations) asla
   kaybolmaz, yalnız bu "gösterilebilir" görünüm savunmacı filtrelenir. */
function getRelatedEntities(type,id){
  var out=getOutgoingRelations(type,id).map(function(r){
    return {relation:r,direction:'outgoing',entity:relResolve(r.targetType,r.targetId)};
  }).filter(function(x){return !!x.entity;});
  var inc=getIncomingRelations(type,id).map(function(r){
    return {relation:r,direction:'incoming',entity:relResolve(r.sourceType,r.sourceId)};
  }).filter(function(x){return !!x.entity;});
  return out.concat(inc);
}

/* ── Resolver registry — ContentEngine'in (11e) CD_ADAPTERS deseniyle aynı ruhta ── */
var RELATION_RESOLVERS={};
function registerRelationResolver(type,resolver){ RELATION_RESOLVERS[type]=resolver; }
/* Bilinmeyen targetType veya hatalı resolver: ASLA fırlatmaz, null döner (madde 14).
   Kod tabanında dev/prod ayrımı yapan bir mekanizma yok (kontrol edildi) — bu yüzden
   mevcut [SYNC]/[BACKUP] loglarıyla aynı desende, ortamdan bağımsız uyarı basılır. */
function relResolve(type,id){
  var r=RELATION_RESOLVERS[type];
  if(!r||typeof r.byId!=='function'){
    console.warn('[RELATIONS] unknown relation target type:',type);
    return null;
  }
  var rec=null;
  try{rec=r.byId(id);}catch(e){rec=null;}
  if(!rec)return null;
  var label='';
  try{label=typeof r.label==='function'?r.label(rec):String(rec.id!=null?rec.id:'');}catch(e){label='';}
  return {type:type,id:id,record:rec,label:label};
}

registerRelationResolver('wisdomQuote',{
  byId:function(id){ return (typeof wqById==='function')?wqById(id):null; },
  label:function(rec){ return rec&&rec.quote?String(rec.quote).slice(0,60):''; }
});
registerRelationResolver('principle',{
  byId:function(id){ return (typeof pById==='function')?pById(id):null; },
  label:function(rec){ return rec&&(rec.title||rec.statement)?String(rec.title||rec.statement).slice(0,60):''; }
});
registerRelationResolver('goal',{
  byId:function(id){ return (D.goals||[]).filter(function(g){return String(g.id)===String(id);})[0]||null; },
  label:function(rec){ return rec&&rec.title?String(rec.title):''; }
});

window.REL_TYPES=REL_TYPES; window.REL_CONFIDENCE=REL_CONFIDENCE;
window.newRelationId=newRelationId;
window.relValidateType=relValidateType; window.relValidateConfidence=relValidateConfidence;
window.relAdd=relAdd; window.relUpdate=relUpdate; window.relDelete=relDelete; window.relFind=relFind;
window.getOutgoingRelations=getOutgoingRelations; window.getIncomingRelations=getIncomingRelations;
window.getRelatedEntities=getRelatedEntities;
window.RELATION_RESOLVERS=RELATION_RESOLVERS; window.registerRelationResolver=registerRelationResolver;
window.relResolve=relResolve;
