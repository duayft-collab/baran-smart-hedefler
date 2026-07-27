/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Phase 2 P1 — GENERIC RELATIONS UI (Goals ↔ Kayıtlar)
   TEK motor: 11h (D.relations). Bu dosya İKİNCİ bir CRUD/koleksiyon AÇMAZ —
   yalnız relAdd/relDelete/relResolve/getOutgoing/IncomingRelations'ı ÇAĞIRIR.
   Kaynak kayıtlara (goal/decision/…) hiçbir ilişki verisi GÖMÜLMEZ.
   Harness-güvenli: üst-seviye DOM/timer YOK, saf fonksiyonlar + additive resolver kaydı.
   11j (Karar Günlüğü ilişki UI) bu fazda YENİDEN YAZILMAZ.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Additive resolver'lar (goal/decision/principle/wisdomQuote 11h+11i'de zaten var) ── */
if(typeof registerRelationResolver==='function'){
  registerRelationResolver('generalNote',{
    byId:function(id){ return (D.generalNotes||[]).filter(function(n){return String(n.id)===String(id);})[0]||null; },
    label:function(rec){ return rec&&(rec.title||rec.content)?String(rec.title||rec.content).slice(0,60):''; }
  });
  registerRelationResolver('task',{
    byId:function(id){ return (D.todos||[]).filter(function(t){return String(t.id)===String(id);})[0]||null; },
    label:function(rec){ return rec&&rec.text?String(rec.text).slice(0,60):''; }
  });
}

/* ── Etiketler (Türkçe) ── */
var REL_ENTITY_LABELS={goal:'Hedef',decision:'Karar',principle:'İlke',wisdomQuote:'Özlü Söz',generalNote:'Genel Not',task:'Görev'};
var REL_ENTITY_ORDER=['goal','decision','principle','wisdomQuote','generalNote','task'];
/* Goal picker'ında sunulan ilişki türleri (5); used_in/derived_from Karar Günlüğü mirası, burada sunulmaz. */
var REL_PICKER_TYPES=[['related_to','İlgili'],['supports','Destekler'],['inspired_by','İlham Aldı'],['depends_on','Bağlıdır'],['blocks','Engeller']];
var REL_TYPE_LABELS={related_to:'İlgili',supports:'Destekler',inspired_by:'İlham Aldı',depends_on:'Bağlıdır',blocks:'Engeller',used_in:'Kullanıldı',derived_from:'Türetildi'};
/* Doğrudan açılabilen türler. task'ın detay/edit formu yok → tam-kayıt adaptörü openTaskById
   (09-goals) görev sekmesine gidip TAM görevi odaklar (yeni ekran/renderer YOK). */
var REL_OPENABLE=['goal','decision','principle','wisdomQuote','generalNote','task'];

function relEntityTypeLabel(type){ return REL_ENTITY_LABELS[type]||String(type||''); }
function relTypeLabel(relationType){ return REL_TYPE_LABELS[relationType]||String(relationType||''); }
function relCanOpen(type){ return REL_OPENABLE.indexOf(type)>=0; }

/* Yön-duyarlı etiket. related_to simetrik ("İlgili"). Diğerleri yönlü: outgoing = hedef eylemi
   yapar; incoming = başka kayıt bu hedefe yönelik eylemi yapar (renk TEK sinyal değil, metin var). */
function relDirectionLabel(relationType,direction){
  if(relationType==='related_to')return 'İlgili';
  var outMap={supports:'Destekler',inspired_by:'İlham Aldı',depends_on:'Bağlıdır',blocks:'Engeller',used_in:'Kullanıldı',derived_from:'Türetildi'};
  var incMap={supports:'Bu hedefi destekler',inspired_by:'Bu hedeften ilham aldı',depends_on:'Bu hedefe bağlıdır',blocks:'Bu hedefi engeller',used_in:'Bu hedefte kullanıldı',derived_from:'Bu hedeften türetildi'};
  return (direction==='incoming'?incMap:outMap)[relationType]||relTypeLabel(relationType);
}

/* ── Orphan-KORUYAN görüntü satırları ── getRelatedEntities çözülemeyeni DÜŞÜRÜR; burada
   satır KORUNUR ve entity=null (available:false) işaretlenir → kullanıcı yine KALDIRABİLİR.
   Mevcut getRelatedEntities davranışı DEĞİŞTİRİLMEZ (11j/diğer modüller onu kullanır). */
function relRowsForDisplay(sourceType,sourceId){
  var rows=[];
  (typeof getOutgoingRelations==='function'?getOutgoingRelations(sourceType,sourceId):[]).forEach(function(r){
    var res=(typeof relResolve==='function')?relResolve(r.targetType,r.targetId):null;
    rows.push({relation:r,direction:'outgoing',otherType:r.targetType,otherId:r.targetId,entity:res,available:!!res});
  });
  (typeof getIncomingRelations==='function'?getIncomingRelations(sourceType,sourceId):[]).forEach(function(r){
    var res=(typeof relResolve==='function')?relResolve(r.sourceType,r.sourceId):null;
    rows.push({relation:r,direction:'incoming',otherType:r.sourceType,otherId:r.sourceId,entity:res,available:!!res});
  });
  return rows;
}
window.relRowsForDisplay=relRowsForDisplay;

function _relEsc(v){ return (typeof U!=='undefined'&&U&&U.esc)?U.esc(String(v==null?'':v)):String(v==null?'':v); }

function _relRowHtml(sourceType,sourceId,row){
  var typeLabel=relEntityTypeLabel(row.otherType);
  var dirLabel=relDirectionLabel(row.relation.relationType,row.direction);
  var h='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 9px;background:var(--s2);border-radius:7px;margin-bottom:4px;flex-wrap:wrap">';
  h+='<div style="min-width:0;flex:1">';
  h+='<span class="pill p-gray" style="font-size:9px">'+_relEsc(typeLabel)+'</span> ';
  if(row.available){ h+='<span style="font-size:12px">'+_relEsc(row.entity.label||'')+'</span>'; }
  else { h+='<span style="font-size:12px;color:var(--t3);font-style:italic">Kayıt artık erişilebilir değil</span>'; }
  h+='<div style="font-size:10px;color:var(--t2);margin-top:2px">'+_relEsc(dirLabel)+'</div>';
  h+='</div>';
  h+='<div style="display:flex;gap:4px">';
  if(row.available&&relCanOpen(row.otherType)){
    h+='<button type="button" class="btn btn-s btn-sm" data-t="'+_relEsc(row.otherType)+'" data-i="'+_relEsc(row.otherId)+'" onclick="openRelatedEntity(this.dataset.t,this.dataset.i)" aria-label="Kaydı aç">Aç</button>';
  } else {
    h+='<button type="button" class="btn btn-s btn-sm" disabled style="opacity:.4" title="Bu kayıt doğrudan açılamıyor" aria-label="Açılamaz">Aç</button>';
  }
  h+='<button type="button" class="btn btn-g btn-sm" data-rid="'+_relEsc(row.relation.id)+'" data-st="'+_relEsc(sourceType)+'" data-si="'+_relEsc(sourceId)+'" onclick="relRemove(this.dataset.rid,this.dataset.st,this.dataset.si)" aria-label="İlişkiyi kaldır">Kaldır</button>';
  h+='</div></div>';
  return h;
}

/* Panel — "İlişkili Kayıtlar (N)" + Ekle + satırlar. #ent_rel_box wrapper'ı ÇAĞIRAN kurar
   (openGoalDetail); burası yalnız iç içeriği döndürür → re-render güvenli. */
function entityRelationsPanelHtml(sourceType,sourceId){
  var rows=relRowsForDisplay(sourceType,sourceId);
  var h='<div style="margin-top:4px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  h+='<p class="lbl">İlişkili Kayıtlar ('+rows.length+')</p>';
  h+='<button type="button" class="btn btn-g btn-sm" data-st="'+_relEsc(sourceType)+'" data-si="'+_relEsc(sourceId)+'" onclick="relPickerToggle(this.dataset.st,this.dataset.si)">'+(_rpOpen?'Kapat':'İlişki Ekle')+'</button>';
  h+='</div>';
  if(_rpOpen)h+=relPickerHtml(sourceType,sourceId);
  if(!rows.length){ h+='<p style="font-size:11px;color:var(--t3)">Henüz ilişkili kayıt yok.</p>'; }
  else { rows.forEach(function(row){ h+=_relRowHtml(sourceType,sourceId,row); }); }
  h+='</div>';
  return h;
}
window.entityRelationsPanelHtml=entityRelationsPanelHtml;

/* ── Picker durumu (tek anda tek picker; 11j deseniyle aynı ruh) ── */
var _rpOpen=false,_rpType='',_rpQuery='',_rpRelType='related_to',_rpConf='medium';

function _relRerender(sourceType,sourceId){
  var box=(typeof ge==='function')?ge('ent_rel_box'):null;
  if(box)box.innerHTML=entityRelationsPanelHtml(sourceType,sourceId);
}
function _relRerenderResults(sourceType,sourceId){
  var box=(typeof ge==='function')?ge('rel_picker_results'):null;
  if(box)box.innerHTML=relPickerResultsHtml(sourceType,sourceId);
}

function relPickerToggle(sourceType,sourceId){ _rpOpen=!_rpOpen; if(!_rpOpen){_rpQuery='';_rpType='';} _relRerender(sourceType,sourceId); }
function relPickerSetQuery(sourceType,sourceId,v){ _rpQuery=v; _relRerenderResults(sourceType,sourceId); }
function relPickerSetType(sourceType,sourceId,t){ _rpType=t; _relRerender(sourceType,sourceId); }
function relPickerSetRelType(v){ _rpRelType=v; }
function relPickerSetConfidence(v){ _rpConf=v; }

/* Adaylar: desteklenen türler; goal türünde MEVCUT hedefi (self) HARİÇ tut. */
function relPickerCandidates(sourceType,sourceId){
  var q=String(_rpQuery||'').toLocaleLowerCase('tr').trim();
  var srcs={
    goal:{list:(D.goals||[]),label:function(g){return String(g.title||'');}},
    decision:{list:(D.decisions||[]),label:function(d){return String(d.title||d.decision||'');}},
    principle:{list:(typeof pViewList==='function'?pViewList():(D.principles||[])),label:function(p){return String(p.title||p.statement||'');}},
    wisdomQuote:{list:(D.wisdomQuotes||[]),label:function(w){return String(w.quote||'');}},
    generalNote:{list:(D.generalNotes||[]),label:function(n){return String(n.title||n.content||'');}},
    task:{list:(D.todos||[]),label:function(t){return String(t.text||'');}}
  };
  var out=[];
  REL_ENTITY_ORDER.forEach(function(tp){
    if(_rpType&&_rpType!==tp)return;
    var cfg=srcs[tp]; if(!cfg)return;
    (cfg.list||[]).forEach(function(rec){
      if(tp===sourceType&&String(rec.id)===String(sourceId))return;   // self-link engeli (picker)
      var label=cfg.label(rec);
      if(q&&label.toLocaleLowerCase('tr').indexOf(q)<0)return;
      out.push({type:tp,id:rec.id,label:label.slice(0,80)});
    });
  });
  return out.slice(0,30);
}
window.relPickerCandidates=relPickerCandidates;

function relPickerResultsHtml(sourceType,sourceId){
  var cands=relPickerCandidates(sourceType,sourceId);
  var existing={};
  (typeof getOutgoingRelations==='function'?getOutgoingRelations(sourceType,sourceId):[]).forEach(function(r){ existing[r.targetType+'|'+r.targetId]=1; });
  if(!cands.length)return '<p style="font-size:11px;color:var(--t3)">Sonuç yok.</p>';
  var h='';
  cands.forEach(function(c){
    var already=!!existing[c.type+'|'+c.id];
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0"><span style="font-size:12px;min-width:0;flex:1"><span class="pill p-gray" style="font-size:8.5px">'+_relEsc(relEntityTypeLabel(c.type))+'</span> '+_relEsc(c.label)+'</span>';
    h+=already?'<span style="font-size:10px;color:var(--t3)">Bağlı</span>'
      :'<button type="button" class="btn btn-g btn-sm" data-st="'+_relEsc(sourceType)+'" data-si="'+_relEsc(sourceId)+'" data-tt="'+_relEsc(c.type)+'" data-ti="'+_relEsc(c.id)+'" onclick="relPickerAdd(this.dataset.st,this.dataset.si,this.dataset.tt,this.dataset.ti)">Ekle</button>';
    h+='</div>';
  });
  return h;
}
window.relPickerResultsHtml=relPickerResultsHtml;

function relPickerHtml(sourceType,sourceId){
  var h='<div style="margin-top:4px;margin-bottom:8px;padding:10px 12px;background:var(--s2);border-radius:9px">';
  h+='<input class="inp" placeholder="Ara..." aria-label="İlişkili kayıt ara" style="margin-bottom:6px" data-st="'+_relEsc(sourceType)+'" data-si="'+_relEsc(sourceId)+'" oninput="relPickerSetQuery(this.dataset.st,this.dataset.si,this.value)">';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">';
  [['','Tümü'],['goal','Hedef'],['decision','Karar'],['principle','İlke'],['wisdomQuote','Özlü Söz'],['generalNote','Genel Not'],['task','Görev']].forEach(function(f){
    var a=_rpType===f[0];
    h+='<button type="button" class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s)')+';color:'+(a?'#fff':'var(--t2)')+'" data-st="'+_relEsc(sourceType)+'" data-si="'+_relEsc(sourceId)+'" data-t="'+f[0]+'" onclick="relPickerSetType(this.dataset.st,this.dataset.si,this.dataset.t)">'+f[1]+'</button>';
  });
  h+='</div>';
  h+='<div style="display:flex;gap:6px;margin-bottom:6px">';
  h+='<select class="inp" style="flex:1" aria-label="İlişki türü" onchange="relPickerSetRelType(this.value)">';
  REL_PICKER_TYPES.forEach(function(rt){ h+='<option value="'+rt[0]+'"'+(rt[0]==='related_to'?' selected':'')+'>'+rt[1]+'</option>'; });
  h+='</select>';
  h+='<select class="inp" style="flex:1" aria-label="Güven düzeyi" onchange="relPickerSetConfidence(this.value)"><option value="low">Düşük</option><option value="medium" selected>Orta</option><option value="high">Yüksek</option></select>';
  h+='</div>';
  h+='<div id="rel_picker_results">'+relPickerResultsHtml(sourceType,sourceId)+'</div></div>';
  return h;
}
window.relPickerHtml=relPickerHtml;

/* Ekleme: kaynak+hedef ÇÖZÜLMELİ (geçersiz/silinmiş id reddi), sonra motor relAdd (self-link/dup
   motorda). Tek snap→save döngüsü; yalnız D.relations mutasyonu; hedef/kaynak kaydı DEĞİŞMEZ. */
function relPickerAdd(sourceType,sourceId,targetType,targetId){
  if(typeof relResolve!=='function')return {ok:false,error:'ENGINE_MISSING'};
  if(!relResolve(sourceType,sourceId))return {ok:false,error:'SOURCE_UNRESOLVED'};
  if(!relResolve(targetType,targetId))return {ok:false,error:'TARGET_UNRESOLVED'};
  if(typeof snap==='function')snap();
  var res=relAdd({sourceType:sourceType,sourceId:sourceId,targetType:targetType,targetId:targetId,relationType:_rpRelType,confidence:_rpConf});
  if(res&&res.ok&&typeof save==='function')save();
  _rpOpen=false;
  _relRerender(sourceType,sourceId);
  return res;
}
window.relPickerAdd=relPickerAdd;

/* Doğrudan aç — resolver'dan GERÇEK tipli id ile ilgili modülün detay/form'unu aç (modal).
   task: openTaskById (09-goals) görev sekmesine gidip TAM görevi odaklar. */
function openRelatedEntity(type,id){
  if(typeof relResolve!=='function')return;
  var r=relResolve(type,id); if(!r||!r.record)return;
  if(!relCanOpen(type))return;
  var rid=r.record.id;
  if(type==='goal'&&typeof openGoalDetail==='function')return openGoalDetail(rid);
  if(type==='decision'&&typeof djOpenDetail==='function')return djOpenDetail(rid);
  if(type==='principle'&&typeof openPrincipleForm==='function')return openPrincipleForm(rid);
  if(type==='wisdomQuote'&&typeof openWqForm==='function')return openWqForm(rid);
  if(type==='generalNote'&&typeof openGeneralNoteForm==='function')return openGeneralNoteForm(rid);
  if(type==='task'&&typeof openTaskById==='function')return openTaskById(rid);
}
window.openRelatedEntity=openRelatedEntity;

/* Kaldır — yalnız ilişki kaydını siler (kaynak/hedef kayda DOKUNMAZ). Tek snap→save. */
function relRemove(relationId,sourceType,sourceId){
  if(typeof snap==='function')snap();
  if(typeof relDelete==='function')relDelete(relationId);
  if(typeof save==='function')save();
  _relRerender(sourceType,sourceId);
}
window.relRemove=relRemove;

/* Exports (onclick handler'ları + test erişimi) */
window.relEntityTypeLabel=relEntityTypeLabel; window.relTypeLabel=relTypeLabel;
window.relCanOpen=relCanOpen; window.relDirectionLabel=relDirectionLabel;
window.relPickerToggle=relPickerToggle;
window.relPickerSetQuery=relPickerSetQuery; window.relPickerSetType=relPickerSetType;
window.relPickerSetRelType=relPickerSetRelType; window.relPickerSetConfidence=relPickerSetConfidence;
window._relPickerSetQuery=relPickerSetQuery; window._relPickerSetType=relPickerSetType;
