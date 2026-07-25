/* ══════════════════════════════════════════════════════════════════════════
   PERSONAL-KNOWLEDGE-P0-2 — DECISION JOURNAL
   Additive. Ayrı, kendi amacına özel koleksiyon (D.decisions[]) — KnowledgeItem'a
   veya wisdomQuotes/principles'a ZORLANMADI (zaman-eksenli açık→çözümlenmiş doğası
   durağan bilgi kayıtlarından temelden farklı — PERSONAL-KNOWLEDGE-P0 mimari kararı).
   İlişkiler mevcut relations[] (11h) üzerinden kurulur; 11h'ye HİÇ DOKUNULMADI,
   yalnız burada yeni bir 'decision' resolver'ı KAYDEDİLDİ (additive genişletme).
   ══════════════════════════════════════════════════════════════════════════ */

var DEC_STATUS=['open','resolved','archived'];
var DEC_RESULT=['better_than_expected','as_expected','worse_than_expected','inconclusive'];
var DEC_DEFAULT_REVIEW_DAYS=30;

function decList(){ if(!Array.isArray(D.decisions))D.decisions=[]; return D.decisions; }
window.decList=decList;

var _decSeq_c=0;
function _decSeq(){ _decSeq_c++; return _decSeq_c; }
/* Mevcut newWqId()/newPrincipleId()/newRelationId() deseniyle aynı iskelet. */
function newDecisionId(){ return 'dec_'+Date.now().toString(36)+'-'+(_decSeq()).toString(36); }
function _decNow(){ try{return new Date().toISOString();}catch(e){return String(Date.now());} }
function _decDefaultReviewAt(fromIso){
  try{
    var d=new Date(fromIso);
    d.setDate(d.getDate()+DEC_DEFAULT_REVIEW_DAYS);
    return d.toISOString();
  }catch(e){return fromIso;}
}
/* principles'taki _pShortTitle ile aynı desen: başlık verilmezse metinden türet. */
function _decShortTitle(text){
  var s=String(text||'').replace(/\s+/g,' ').trim();
  if(s.length<=60)return s;
  return s.slice(0,57).replace(/\s+\S*$/,'')+'…';
}

function decisionById(id){ return decList().filter(function(x){return String(x.id)===String(id);})[0]||null; }
window.decisionById=decisionById;

/* Zorunlu tek alan: decision. Geri kalan her şey opsiyonel — mevcut
   wisdomQuotes/principles'taki "hızlı yakala, sonra zenginleştir" disiplini. */
function decisionCreate(input){
  input=input||{};
  var decision=String(input.decision||'').trim();
  if(!decision)return {ok:false,error:'EMPTY_DECISION'};
  var now=_decNow();
  var options=Array.isArray(input.options)?input.options.map(function(o,i){
    if(o&&typeof o==='object')return {key:o.key?String(o.key):String.fromCharCode(65+i),text:String(o.text||'')};
    return {key:String.fromCharCode(65+i),text:String(o||'')};
  }):[];
  var rec={
    id:newDecisionId(),
    title:input.title?String(input.title).slice(0,140):_decShortTitle(decision),
    decision:decision,
    options:options,
    chosenOption:input.chosenOption!=null?String(input.chosenOption):'',
    status:'open',
    decidedAt:input.decidedAt?String(input.decidedAt):now,
    reviewAt:input.reviewAt?String(input.reviewAt):_decDefaultReviewAt(now),
    expectedOutcome:input.expectedOutcome!=null?String(input.expectedOutcome):'',
    actualOutcome:'',
    result:null,
    lessonLearned:'',
    successFactors:[],
    evidenceLink:input.evidenceLink!=null?String(input.evidenceLink):'',
    evidenceNote:input.evidenceNote!=null?String(input.evidenceNote):'',
    tags:Array.isArray(input.tags)?input.tags.map(String):[],
    createdAt:now, updatedAt:now, resolvedAt:null
  };
  decList().push(rec);
  return {ok:true,decision:rec};
}

/* Sonuç/durum DEĞİŞTİRMEZ — yalnız açıklayıcı/planlama alanlarını günceller.
   Sonuçlandırma yalnız decisionResolve() ile yapılır (tek yetkili yol). */
function decisionUpdate(id,patch){
  var r=decisionById(id);
  if(!r)return {ok:false,error:'NOT_FOUND'};
  patch=patch||{};
  ['title','decision','chosenOption','expectedOutcome','evidenceLink','evidenceNote','reviewAt'].forEach(function(k){
    if(patch[k]!=null)r[k]=String(patch[k]);
  });
  if(Array.isArray(patch.options))r.options=patch.options;
  if(Array.isArray(patch.tags))r.tags=patch.tags.map(String);
  r.updatedAt=_decNow();
  return {ok:true,decision:r};
}

/* Kararı sonuçlandırır — status='resolved', resolvedAt set edilir. result tarafsız
   bir sınıflandırmadır (başarı/başarısızlık İKİLİSİ DEĞİL — 'inconclusive' dahil). */
function decisionResolve(id,input){
  var r=decisionById(id);
  if(!r)return {ok:false,error:'NOT_FOUND'};
  input=input||{};
  if(input.result!=null&&DEC_RESULT.indexOf(input.result)<0)return {ok:false,error:'INVALID_RESULT'};
  if(input.actualOutcome!=null)r.actualOutcome=String(input.actualOutcome);
  if(input.result!=null)r.result=input.result;
  if(input.lessonLearned!=null)r.lessonLearned=String(input.lessonLearned);
  if(Array.isArray(input.successFactors))r.successFactors=input.successFactors.map(String);
  r.status='resolved';
  r.resolvedAt=_decNow();
  r.updatedAt=_decNow();
  return {ok:true,decision:r};
}

function decisionDelete(id){
  var before=decList().length;
  D.decisions=decList().filter(function(x){return String(x.id)!==String(id);});
  return {ok:true,deleted:before!==D.decisions.length};
}

/* review_due SAKLANMAZ, hesaplanır (PERSONAL-KNOWLEDGE-P0 mimari kararı — arka planda
   güncelleyen bir süreç olmadan saklanan bir durum bayatlar/yanlış kalır). */
function decisionIsReviewDue(dec){ return dec.status==='open'&&!!dec.reviewAt&&dec.reviewAt<=_decNow(); }
function decisionsReviewDue(){ return decList().filter(decisionIsReviewDue); }

window.DEC_STATUS=DEC_STATUS; window.DEC_RESULT=DEC_RESULT;
window.newDecisionId=newDecisionId;
window.decisionCreate=decisionCreate; window.decisionUpdate=decisionUpdate;
window.decisionDelete=decisionDelete; window.decisionResolve=decisionResolve;
window.decisionIsReviewDue=decisionIsReviewDue; window.decisionsReviewDue=decisionsReviewDue;

/* ── relations[] (11h) genişletmesi — 11h-relations.js'e HİÇ DOKUNULMADI ── */
if(typeof registerRelationResolver==='function'){
  registerRelationResolver('decision',{
    byId:function(id){ return decisionById(id); },
    label:function(rec){ return rec&&rec.title?String(rec.title):''; }
  });
}
