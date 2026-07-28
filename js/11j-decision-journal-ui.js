/* ══════════════════════════════════════════════════════════════════════════
   PERSONAL-KNOWLEDGE-P0-3 — KARAR GÜNLÜĞÜ (Decision Journal) MİNİMUM UI
   Additive. Mevcut decisionCreate/Update/Delete/Resolve/decisionById/decisionsReviewDue
   (11i) YENİDEN YAZILMADI — yalnız çağrılır. relAdd/getOutgoingRelations/getRelatedEntities
   (11h) YENİDEN YAZILMADI. Tasarım deseni İlkelerim (11d) ve Özlü Sözler (11a) ile aynı:
   custom-div modal (showModal), form + liste + CRUD, native confirm() ile silme onayı.
   EngagementState/ContentEngine/retention/4-buton öğrenme/dashboard/grafik/knowledge
   score/unified search YOK (P0-3 kapsam dışı).
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Etiketler ── */
function djStatusLabel(s){ return {open:'Açık',resolved:'Sonuçlandı',archived:'Arşivlendi'}[s]||s; }
function djResultLabel(r){ return {better_than_expected:'Beklentiden iyi',as_expected:'Beklendiği gibi',worse_than_expected:'Beklentiden kötü',inconclusive:'Sonuç belirsiz'}[r]||''; }
function djConfidenceLabel(c){ return {low:'Düşük',medium:'Orta',high:'Yüksek'}[c]||''; }
function djRelTypeLabel(t){ return {used_in:'Kullanıldı',derived_from:'Buradan türedi',inspired_by:'İlham aldı',related_to:'İlgili'}[t]||t; }
function _djDate(iso){ if(!iso)return '—'; try{var d=new Date(iso); if(isNaN(d))return String(iso); return d.getDate()+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear();}catch(e){return String(iso);} }
function djDateInput(iso){ return String(iso||'').slice(0,10); }
function djChosenLabel(dec){
  if(!dec||!dec.chosenOption)return '';
  var opt=(dec.options||[]).filter(function(o){return o.key===dec.chosenOption;})[0];
  return opt?opt.text:'';
}
function _djTags(v){
  var arr=String(v||'').split(',');var out=[],seen={};
  arr.forEach(function(t){ t=t.trim(); if(!t)return; var k=t.toLocaleLowerCase('tr'); if(seen[k])return; seen[k]=1; out.push(t); });
  return out;
}
window.djStatusLabel=djStatusLabel;window.djResultLabel=djResultLabel;window.djConfidenceLabel=djConfidenceLabel;

/* ══ Karar Listesi ══ */
var djShowArchived=false;
function djToggleArchived(){ djShowArchived=!djShowArchived; renderDecisions(); }
window.djToggleArchived=djToggleArchived;

function renderDecisions(){
  var all=(typeof decList==='function')?decList():[];
  var due=(typeof decisionsReviewDue==='function')?decisionsReviewDue():[];
  var dueIds={}; due.forEach(function(d){dueIds[d.id]=1;});
  var open=all.filter(function(d){return d.status==='open'&&!dueIds[d.id];});
  var resolved=all.filter(function(d){return d.status==='resolved';});
  var archived=all.filter(function(d){return d.status==='archived';});
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Karar Günlüğü</h1><p class="sh-sub">Kararlarını kaydet, gözden geçir, ne öğrendiğini not et.</p></div>';
  h+='<button class="btn btn-p" onclick="djOpenForm()">'+ic('plus',13)+' Yeni Karar</button></div>';
  h+=(typeof wisdomUxTokensHtml==='function'?wisdomUxTokensHtml():''); // UX-R6: paylaşılan sunum-token bloğu (focus-visible + calm token + reduced-motion); İlkelerim ile tutarlı
  h+=(typeof wiCardHtml==='function'?wiCardHtml((all[0]?wiCtxFromDecision(all[0]):null)):''); // CROSS-K1: karar bağlamında tek İlgili Bilgelik (ikincil; karar birincil kalır, salt-okunur)
  if(!all.length){
    h+='<div class="card" style="padding:48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">'+ic('layers',32,'var(--t3)')+
       '<p style="font-weight:700;font-size:16px">Henüz karar eklemedin.</p>'+
       '<p style="font-size:13px;color:var(--t3);max-width:420px;line-height:1.6">Aldığın önemli kararları kaydet, zamanı gelince gözden geçir ve ne öğrendiğini not et.</p>'+
       '<button class="btn btn-p" onclick="djOpenForm()">'+ic('plus',13)+' İlk Kararını Ekle</button></div></div>';
    sh('pinner',h); return;
  }
  h+=djSectionHtml('İnceleme Zamanı Gelenler',due,'var(--orange)');
  h+=djSectionHtml('Açık Kararlar',open,'var(--blue)');
  h+=djSectionHtml('Sonuçlanan Kararlar',resolved,'var(--green)');
  h+='<button class="btn btn-s btn-sm" style="margin-top:4px" onclick="djToggleArchived()">'+(djShowArchived?'Arşivlenenleri Gizle':'Arşivlenenleri Göster ('+archived.length+')')+'</button>';
  if(djShowArchived)h+=djSectionHtml('Arşivlenenler',archived,'var(--t3)');
  h+='</div>';
  sh('pinner',h);
}
window.renderDecisions=renderDecisions;

function djSectionHtml(title,list,color){
  if(!list.length)return '';
  var h='<div style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:7px;margin-bottom:8px"><span style="font-weight:700;font-size:13px;color:'+color+'">'+title+'</span><span class="pill p-gray" style="font-size:10px">'+list.length+'</span></div><div class="card" style="overflow:hidden">';
  list.forEach(function(d){ h+=djRowHtml(d); });
  h+='</div></div>';
  return h;
}

function djRowHtml(dec){
  var id=U.esc(String(dec.id));
  var summary=(typeof _decShortTitle==='function')?_decShortTitle(dec.decision):String(dec.decision||'').slice(0,60);
  var relCount=(typeof getOutgoingRelations==='function')?getOutgoingRelations('decision',dec.id).length:0;
  var chosen=djChosenLabel(dec);
  var h='<div style="padding:11px 16px;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer" data-id="'+id+'" onclick="djOpenDetail(this.dataset.id)">';
  h+='<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">';
  h+='<div style="flex:1;min-width:0"><p style="font-weight:700;font-size:13.5px">'+U.esc(dec.title||summary)+'</p>';
  h+='<p style="font-size:12px;color:var(--t2);margin-top:2px">'+U.esc(summary)+'</p>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">';
  h+='<span class="pill p-gray" style="font-size:9.5px">'+djStatusLabel(dec.status)+'</span>';
  if(dec.confidence)h+='<span class="pill p-gray" style="font-size:9.5px">Güven: '+djConfidenceLabel(dec.confidence)+'</span>';
  if(chosen)h+='<span class="pill p-blue" style="font-size:9.5px">'+U.esc(chosen)+'</span>';
  if(relCount)h+='<span class="pill p-gray" style="font-size:9.5px">'+relCount+' ilişki</span>';
  if(dec.status==='resolved'&&dec.result)h+='<span class="pill p-green" style="font-size:9.5px">'+djResultLabel(dec.result)+'</span>';
  h+='</div></div>';
  h+='<div style="text-align:right;flex-shrink:0"><p style="font-size:10px;color:var(--t3)">Karar: '+_djDate(dec.decidedAt)+'</p><p style="font-size:10px;color:var(--t3)">İnceleme: '+_djDate(dec.reviewAt)+'</p></div>';
  h+='</div></div>';
  return h;
}
window.djRowHtml=djRowHtml;

/* ══ Yeni Karar / Düzenleme Formu ══
   Seçenekler pozisyonel tutulur (key her zaman index'ten türetilir) — silme/ekleme
   sırasında sabit "id" olmadığından, chosenOption'ı index kaydırarak KORUR (madde 12). */
var djFormOpts=[]; // [{text}]
var djFormChosenIdx=-1;
function djOptKeyForIndex(i){ return String.fromCharCode(65+i); }
function djOptAdd(){ djFormOpts.push({text:''}); djOptsRender(); }
function djOptText(idx,val){ if(djFormOpts[idx])djFormOpts[idx].text=val; }
function djOptDel(idx){
  if(idx<0||idx>=djFormOpts.length)return;
  djFormOpts.splice(idx,1);
  if(djFormChosenIdx===idx)djFormChosenIdx=-1;
  else if(djFormChosenIdx>idx)djFormChosenIdx--;
  djOptsRender();
}
window.djOptAdd=djOptAdd;window.djOptText=djOptText;window.djOptDel=djOptDel;
function djChosenOptionsHtml(){
  var h='<option value="">Seçilen seçenek yok</option>';
  djFormOpts.forEach(function(o,i){
    h+='<option value="'+i+'"'+(djFormChosenIdx===i?' selected':'')+'>'+djOptKeyForIndex(i)+' — '+U.esc(o.text||'(boş)')+'</option>';
  });
  return h;
}
function djSetChosenIdx(v){ djFormChosenIdx=(v===''||v==null)?-1:+v; }
window.djSetChosenIdx=djSetChosenIdx;
function djOptsRender(){
  var box=ge('dj_opts_box'); if(!box)return;
  var h='<p class="lbl" style="margin-bottom:4px">Seçenekler (opsiyonel)</p>';
  if(!djFormOpts.length){ h+='<p style="font-size:11px;color:var(--t3);margin-bottom:6px">Seçenek eklenmedi.</p>'; }
  else{
    djFormOpts.forEach(function(o,i){
      h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="font-size:11px;font-weight:700;color:var(--t3);width:14px">'+djOptKeyForIndex(i)+'</span>';
      h+='<input class="inp" style="flex:1;padding:6px 9px;font-size:12.5px" value="'+U.esc(o.text)+'" data-idx="'+i+'" oninput="djOptText(+this.dataset.idx,this.value)" placeholder="Seçenek...">';
      h+='<button type="button" class="btn btn-g btn-ic" style="width:24px;height:24px" data-idx="'+i+'" onclick="djOptDel(+this.dataset.idx)">'+ic('x',11,'var(--t3)')+'</button></div>';
    });
  }
  h+='<button type="button" class="btn btn-s btn-sm" onclick="djOptAdd()">'+ic('plus',11)+' Seçenek Ekle</button>';
  box.innerHTML=h;
  var sel=ge('dj_chosen'); if(sel)sel.innerHTML=djChosenOptionsHtml();
}
window.djOptsRender=djOptsRender;

/* Boş seçenek asla kaydedilmez; key'ler hayatta kalan seçeneklerden yeniden üretilir;
   chosenOption yalnız hayatta kalan bir key'e işaret ediyorsa dolu döner (madde 11/13). */
function djCollectOptions(){
  var out=[], chosenKey='';
  djFormOpts.forEach(function(o,i){
    var t=String(o.text||'').trim(); if(!t)return;
    var k=djOptKeyForIndex(out.length);
    if(i===djFormChosenIdx)chosenKey=k;
    out.push({key:k,text:t.slice(0,500)});
  });
  return {options:out,chosenOption:chosenKey};
}
window.djCollectOptions=djCollectOptions;

function djFormClose(){ sh('modal-root',''); djFormOpts=[]; djFormChosenIdx=-1; }
function djFormCancel(){ djFormClose(); }
window.djFormCancel=djFormCancel;

function djOpenForm(id){
  var dec=id?decisionById(id):null;
  djFormOpts=dec?(dec.options||[]).map(function(o){return {text:o.text};}):[];
  djFormChosenIdx=-1;
  if(dec&&dec.chosenOption){
    (dec.options||[]).forEach(function(o,i){ if(o.key===dec.chosenOption)djFormChosenIdx=i; });
  }
  var e=function(v){return v?U.esc(v):'';};
  var h='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h2 style="font-size:17px;font-weight:800">'+(dec?'Kararı Düzenle':'Yeni Karar')+'</h2><button class="btn btn-g btn-ic" style="width:30px;height:30px" onclick="djFormCancel()">'+ic('x',14)+'</button></div>';
  h+='<p class="lbl" style="margin-bottom:3px">Karar *</p>';
  h+='<textarea class="inp" id="dj_decision" rows="3" placeholder="Hangi kararı veriyorsun?" style="margin-bottom:8px">'+(dec?e(dec.decision):'')+'</textarea>';
  h+='<input class="inp" id="dj_title" placeholder="Kısa başlık (opsiyonel)" value="'+(dec?e(dec.title):'')+'" style="margin-bottom:8px">';
  h+='<textarea class="inp" id="dj_context" rows="2" placeholder="Bağlam (opsiyonel) — bu kararı hangi durumda veriyorsun?" style="margin-bottom:8px">'+(dec?e(dec.context):'')+'</textarea>';
  h+='<div id="dj_opts_box" style="margin-bottom:6px"></div>';
  h+='<div style="display:flex;gap:8px;margin-bottom:8px">';
  h+='<select class="inp" id="dj_chosen" style="flex:1" onchange="djSetChosenIdx(this.value)"></select>';
  h+='<select class="inp" id="dj_confidence" style="flex:1"><option value="">Güven seviyesi</option>'+
     DEC_CONFIDENCE.map(function(c){return '<option value="'+c+'"'+(dec&&dec.confidence===c?' selected':'')+'>'+djConfidenceLabel(c)+'</option>';}).join('')+'</select>';
  h+='</div>';
  h+='<textarea class="inp" id="dj_expected" rows="2" placeholder="Beklenen sonuç (opsiyonel)" style="margin-bottom:8px">'+(dec?e(dec.expectedOutcome):'')+'</textarea>';
  h+='<p class="lbl" style="margin-bottom:3px">İnceleme tarihi</p>';
  h+='<input class="inp" id="dj_review" type="date" value="'+(dec?djDateInput(dec.reviewAt):djDateInput(typeof _decDefaultReviewAt==='function'?_decDefaultReviewAt(_decNow()):''))+'" style="margin-bottom:8px">';
  h+='<input class="inp" id="dj_tags" placeholder="Etiketler (virgülle)" value="'+(dec&&dec.tags&&dec.tags.length?e(dec.tags.join(', ')):'')+'" style="margin-bottom:8px">';
  h+='<input class="inp" id="dj_evidence_link" placeholder="Kanıt bağlantısı (opsiyonel)" value="'+(dec?e(dec.evidenceLink):'')+'" style="margin-bottom:8px">';
  h+='<textarea class="inp" id="dj_evidence_note" rows="2" placeholder="Kanıt notu (opsiyonel)" style="margin-bottom:10px">'+(dec?e(dec.evidenceNote):'')+'</textarea>';
  h+='<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-g" onclick="djFormCancel()">İptal</button><button class="btn btn-p" data-id="'+(dec?e(dec.id):'')+'" onclick="djFormSave(this.dataset.id)">Kaydet</button></div>';
  showModal(h);
  djOptsRender();
  /* showModal yalnız html string'i DOM'a basar; tarayıcıda value/textarea içeriği HTML
     parse'ından otomatik gelir. Test harness'i (jsdom yok, bilinçli sıfır-bağımlılık
     kararı) bunu simüle etmediği için burada açıkça primeliyoruz — tarayıcıda zararsız
     (zaten gösterilenle aynı değeri tekrar yazar), harness'te ge()'in gerçek değeri
     görmesini sağlar (madde 16 "Mevcut karar doğru yüklenir"). */
  var _f=function(id,v){ var el=ge(id); if(el)el.value=v; };
  _f('dj_decision',dec?dec.decision:'');
  _f('dj_title',dec?(dec.title||''):'');
  _f('dj_context',dec?(dec.context||''):'');
  _f('dj_confidence',dec&&dec.confidence?dec.confidence:'');
  _f('dj_expected',dec?(dec.expectedOutcome||''):'');
  _f('dj_review',dec?djDateInput(dec.reviewAt):djDateInput(typeof _decDefaultReviewAt==='function'?_decDefaultReviewAt(_decNow()):''));
  _f('dj_tags',dec&&dec.tags&&dec.tags.length?dec.tags.join(', '):'');
  _f('dj_evidence_link',dec?(dec.evidenceLink||''):'');
  _f('dj_evidence_note',dec?(dec.evidenceNote||''):'');
}
window.djOpenForm=djOpenForm;

function djFormSave(id){
  var decEl=ge('dj_decision');
  var decisionText=(decEl.value||'').trim();
  if(!decisionText){ alert('Karar metni zorunlu!'); return; }
  var collected=djCollectOptions();
  var confEl=ge('dj_confidence');
  var confidence=(confEl&&confEl.value)?confEl.value:null;
  var vals={
    title:(ge('dj_title').value||'').trim(),
    decision:decisionText,
    context:(ge('dj_context').value||'').trim(),
    options:collected.options,
    chosenOption:collected.chosenOption,
    confidence:confidence,
    expectedOutcome:(ge('dj_expected').value||'').trim(),
    reviewAt:(ge('dj_review').value||'').trim(),
    tags:_djTags(ge('dj_tags').value),
    evidenceLink:(ge('dj_evidence_link').value||'').trim(),
    evidenceNote:(ge('dj_evidence_note').value||'').trim()
  };
  if(id){ decisionUpdate(id,vals); }
  else{ decisionCreate(vals); }
  if(typeof save==='function')save();
  djFormClose();
  if(typeof tab!=='undefined'&&tab==='decisions'&&typeof renderDecisions==='function')renderDecisions();
}
window.djFormSave=djFormSave;

/* ══ Karar Detay ══ */
function djOpenDetail(id){
  var dec=decisionById(id); if(!dec)return;
  var h='<div style="max-width:560px;background:var(--s);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;width:100%;max-height:88vh;display:flex;flex-direction:column">';
  h+='<div style="padding:16px 20px;border-bottom:1px solid var(--s2);display:flex;justify-content:space-between;align-items:flex-start;gap:10px">';
  h+='<div><p style="font-weight:800;font-size:16px">'+U.esc(dec.title||'')+'</p>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px"><span class="pill p-gray" style="font-size:9.5px">'+djStatusLabel(dec.status)+'</span>';
  if(dec.confidence)h+='<span class="pill p-gray" style="font-size:9.5px">Güven: '+djConfidenceLabel(dec.confidence)+'</span>';
  h+='</div></div>';
  h+='<button class="btn btn-g btn-ic" style="width:30px;height:30px" onclick="closeModal()">'+ic('x',14)+'</button></div>';
  h+='<div style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px">';
  h+='<div><p class="lbl" style="margin-bottom:3px">Karar</p><p style="font-size:13.5px;line-height:1.6">'+U.esc(dec.decision)+'</p></div>';
  if(dec.context)h+='<div><p class="lbl" style="margin-bottom:3px">Bağlam</p><p style="font-size:13px;color:var(--t2);line-height:1.6">'+U.esc(dec.context)+'</p></div>';
  if(dec.options&&dec.options.length){
    h+='<div><p class="lbl" style="margin-bottom:3px">Seçenekler</p>';
    dec.options.forEach(function(o){
      var chosen=o.key===dec.chosenOption;
      h+='<p style="font-size:12.5px;'+(chosen?'font-weight:700;color:var(--blue)':'color:var(--t2)')+'">'+U.esc(o.key)+' — '+U.esc(o.text)+(chosen?' ✓':'')+'</p>';
    });
    h+='</div>';
  }
  if(dec.expectedOutcome)h+='<div><p class="lbl" style="margin-bottom:3px">Beklenen sonuç</p><p style="font-size:13px;color:var(--t2)">'+U.esc(dec.expectedOutcome)+'</p></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><p class="lbl">Karar tarihi</p><p style="font-size:12.5px">'+_djDate(dec.decidedAt)+'</p></div><div><p class="lbl">İnceleme tarihi</p><p style="font-size:12.5px">'+_djDate(dec.reviewAt)+'</p></div></div>';
  if(dec.status==='resolved'){
    h+='<div style="padding:10px 12px;background:var(--gl);border-radius:9px"><p class="lbl" style="margin-bottom:3px">Sonuç</p><p style="font-size:13px;font-weight:700;color:var(--green)">'+djResultLabel(dec.result)+'</p>';
    if(dec.actualOutcome)h+='<p style="font-size:12.5px;color:var(--t2);margin-top:4px">'+U.esc(dec.actualOutcome)+'</p>';
    if(dec.lessonLearned)h+='<p style="font-size:12.5px;color:var(--t2);margin-top:4px"><strong>Ders:</strong> '+U.esc(dec.lessonLearned)+'</p>';
    h+='</div>';
  }
  if(dec.evidenceLink||dec.evidenceNote){
    h+='<div><p class="lbl" style="margin-bottom:3px">Kanıt</p>';
    if(dec.evidenceLink)h+='<p style="font-size:12px;color:var(--blue);word-break:break-all">'+U.esc(dec.evidenceLink)+'</p>';
    if(dec.evidenceNote)h+='<p style="font-size:12px;color:var(--t2)">'+U.esc(dec.evidenceNote)+'</p>';
    h+='</div>';
  }
  h+='<div id="dj_related_box">'+djRelatedHtml(dec.id)+'</div>';
  h+='</div>';
  h+='<div style="padding:12px 20px;border-top:1px solid var(--s2);display:flex;gap:6px;flex-wrap:wrap">';
  h+='<button class="btn btn-s btn-sm" data-id="'+U.esc(dec.id)+'" onclick="djOpenForm(this.dataset.id)">'+ic('edit',11)+' Düzenle</button>';
  if(dec.status==='open')h+='<button class="btn btn-p btn-sm" data-id="'+U.esc(dec.id)+'" onclick="djOpenReview(this.dataset.id)">'+ic('chk',11)+' Gözden Geçir</button>';
  if(dec.status!=='archived')h+='<button class="btn btn-s btn-sm" data-id="'+U.esc(dec.id)+'" onclick="djArchive(this.dataset.id)">Arşivle</button>';
  h+='<button class="btn btn-s btn-sm" style="color:var(--red);margin-left:auto" data-id="'+U.esc(dec.id)+'" onclick="djDelete(this.dataset.id)">'+ic('trash',11)+' Sil</button>';
  h+='</div></div>';
  showModal(h);
}
window.djOpenDetail=djOpenDetail;

/* ══ İlişkili Kayıt Seçici (Principle/WisdomQuote/Goal, used_in/inspired_by/related_to) ══
   derived_from BURADA seçilemez — yalnız review→ilke akışında (madde 7) programatik kurulur. */
var djPickerOpen=false, djPickerQuery='', djPickerType='', djPickerRelType='related_to', djPickerConfidence='medium';

function djRelatedHtml(decisionId){
  var rels=(typeof getRelatedEntities==='function')?getRelatedEntities('decision',decisionId):[];
  var h='<div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><p class="lbl">İlişkili Kayıtlar ('+rels.length+')</p>';
  h+='<button class="btn btn-g btn-sm" data-id="'+U.esc(decisionId)+'" onclick="djTogglePicker(this.dataset.id)">'+(djPickerOpen?'Kapat':'İlişki Ekle')+'</button></div>';
  if(!rels.length)h+='<p style="font-size:11.5px;color:var(--t3)">Henüz ilişkili kayıt yok.</p>';
  else{
    rels.forEach(function(r){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 9px;background:var(--s2);border-radius:7px;margin-bottom:4px"><span style="font-size:12px">'+U.esc(r.entity.label||'')+'</span><span class="pill p-gray" style="font-size:9px">'+djRelTypeLabel(r.relation.relationType)+'</span></div>';
    });
  }
  if(djPickerOpen)h+=djPickerHtml(decisionId);
  h+='</div>';
  return h;
}
window.djRelatedHtml=djRelatedHtml;

function djTogglePicker(decisionId){
  djPickerOpen=!djPickerOpen; djPickerQuery=''; djPickerType='';
  var box=ge('dj_related_box'); if(box)box.innerHTML=djRelatedHtml(decisionId);
}
window.djTogglePicker=djTogglePicker;
function djPickerSetQuery(decisionId,v){ djPickerQuery=v; var box=ge('dj_picker_results'); if(box)box.innerHTML=djPickerResultsHtml(decisionId); }
function djPickerSetType(decisionId,t){ djPickerType=t; var box=ge('dj_related_box'); if(box)box.innerHTML=djRelatedHtml(decisionId); }
function djPickerSetRelType(v){ djPickerRelType=v; }
function djPickerSetConfidence(v){ djPickerConfidence=v; }
window.djPickerSetQuery=djPickerSetQuery;window.djPickerSetType=djPickerSetType;
window.djPickerSetRelType=djPickerSetRelType;window.djPickerSetConfidence=djPickerSetConfidence;

function djPickerCandidates(){
  var q=String(djPickerQuery||'').toLocaleLowerCase('tr').trim();
  var out=[];
  if(!djPickerType||djPickerType==='principle'){
    (typeof pViewList==='function'?pViewList():[]).forEach(function(p){
      var label=String(p.title||p.statement||'');
      if(!q||label.toLocaleLowerCase('tr').indexOf(q)>=0)out.push({type:'principle',id:p.id,label:label.slice(0,80)});
    });
  }
  if(!djPickerType||djPickerType==='wisdomQuote'){
    (typeof wqList==='function'?wqList():[]).forEach(function(w){
      var label=String(w.quote||'');
      if(!q||label.toLocaleLowerCase('tr').indexOf(q)>=0)out.push({type:'wisdomQuote',id:w.id,label:label.slice(0,80)});
    });
  }
  if(!djPickerType||djPickerType==='goal'){
    (D.goals||[]).forEach(function(g){
      var label=String(g.title||'');
      if(!q||label.toLocaleLowerCase('tr').indexOf(q)>=0)out.push({type:'goal',id:g.id,label:label.slice(0,80)});
    });
  }
  return out.slice(0,20);
}
window.djPickerCandidates=djPickerCandidates;

function djPickerHtml(decisionId){
  var h='<div style="margin-top:8px;padding:10px 12px;background:var(--s2);border-radius:9px">';
  h+='<input class="inp" placeholder="Ara..." style="margin-bottom:6px" data-id="'+U.esc(decisionId)+'" oninput="djPickerSetQuery(this.dataset.id,this.value)">';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">';
  [['','Tümü'],['principle','İlke'],['wisdomQuote','Özlü Söz'],['goal','Hedef']].forEach(function(f){
    var a=djPickerType===f[0];
    h+='<button type="button" class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s)')+';color:'+(a?'#fff':'var(--t2)')+'" data-id="'+U.esc(decisionId)+'" data-t="'+f[0]+'" onclick="djPickerSetType(this.dataset.id,this.dataset.t)">'+f[1]+'</button>';
  });
  h+='</div>';
  h+='<div style="display:flex;gap:6px;margin-bottom:6px">';
  h+='<select class="inp" style="flex:1" onchange="djPickerSetRelType(this.value)"><option value="used_in">Kullanıldı</option><option value="inspired_by">İlham aldı</option><option value="related_to" selected>İlgili</option></select>';
  h+='<select class="inp" style="flex:1" onchange="djPickerSetConfidence(this.value)"><option value="low">Düşük</option><option value="medium" selected>Orta</option><option value="high">Yüksek</option></select>';
  h+='</div>';
  h+='<div id="dj_picker_results">'+djPickerResultsHtml(decisionId)+'</div></div>';
  return h;
}
function djPickerResultsHtml(decisionId){
  var cands=djPickerCandidates();
  var existing={};
  (typeof getOutgoingRelations==='function'?getOutgoingRelations('decision',decisionId):[]).forEach(function(r){ existing[r.targetType+'|'+r.targetId]=1; });
  if(!cands.length)return '<p style="font-size:11px;color:var(--t3)">Sonuç yok.</p>';
  var h='';
  cands.forEach(function(c){
    var already=!!existing[c.type+'|'+c.id];
    h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0"><span style="font-size:12px">'+U.esc(c.label)+'</span>';
    h+=already?'<span style="font-size:10px;color:var(--t3)">Bağlı</span>':'<button type="button" class="btn btn-g btn-sm" data-did="'+U.esc(decisionId)+'" data-t="'+c.type+'" data-id="'+U.esc(String(c.id))+'" onclick="djPickerAdd(this.dataset.did,this.dataset.t,this.dataset.id)">Ekle</button>';
    h+='</div>';
  });
  return h;
}
window.djPickerResultsHtml=djPickerResultsHtml;
function djPickerAdd(decisionId,targetType,targetId){
  relAdd({sourceType:'decision',sourceId:decisionId,targetType:targetType,targetId:targetId,relationType:djPickerRelType,confidence:djPickerConfidence});
  if(typeof save==='function')save();
  djPickerOpen=false;
  var box=ge('dj_related_box'); if(box)box.innerHTML=djRelatedHtml(decisionId);
}
window.djPickerAdd=djPickerAdd;

/* ══ Karar Gözden Geçirme ══ */
function djOpenReview(id){
  var dec=decisionById(id); if(!dec||dec.status!=='open')return;
  var h='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h2 style="font-size:17px;font-weight:800">Kararı Gözden Geçir</h2><button class="btn btn-g btn-ic" style="width:30px;height:30px" onclick="closeModal()">'+ic('x',14)+'</button></div>';
  h+='<p class="lbl" style="margin-bottom:3px">Beklenen sonuç</p><p style="font-size:12.5px;color:var(--t2);margin-bottom:8px">'+U.esc(dec.expectedOutcome||'—')+'</p>';
  h+='<textarea class="inp" id="dj_actual" rows="2" placeholder="Gerçekleşen sonuç" style="margin-bottom:8px">'+(dec.actualOutcome?U.esc(dec.actualOutcome):'')+'</textarea>';
  h+='<p class="lbl" style="margin-bottom:4px">Sonuç sınıflandırması</p><select class="inp" id="dj_result" style="margin-bottom:8px"><option value="">Seçiniz</option>'+
     DEC_RESULT.map(function(r){return '<option value="'+r+'">'+djResultLabel(r)+'</option>';}).join('')+'</select>';
  h+='<textarea class="inp" id="dj_lesson" rows="2" placeholder="Ne öğrendim?" style="margin-bottom:8px">'+(dec.lessonLearned?U.esc(dec.lessonLearned):'')+'</textarea>';
  h+='<input class="inp" id="dj_success_factors" placeholder="Başarı faktörleri (virgülle)" value="'+(dec.successFactors&&dec.successFactors.length?U.esc(dec.successFactors.join(', ')):'')+'" style="margin-bottom:8px">';
  h+='<p class="lbl" style="margin-bottom:3px">Yeni inceleme tarihi (açık bırakırsan)</p>';
  h+='<input class="inp" id="dj_new_review" type="date" value="'+djDateInput(typeof _decDefaultReviewAt==='function'?_decDefaultReviewAt(_decNow()):'')+'" style="margin-bottom:10px">';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button type="button" class="btn btn-s btn-sm" data-id="'+U.esc(dec.id)+'" onclick="djNewPrincipleFromReview(this.dataset.id)">Yeni İlke Oluştur</button><button type="button" class="btn btn-s btn-sm" data-id="'+U.esc(dec.id)+'" onclick="djTogglePrincipleLink(this.dataset.id)">Mevcut İlkeye Bağla</button></div>';
  h+='<div id="dj_review_link_box"></div>';
  h+='<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><button class="btn btn-g" data-id="'+U.esc(dec.id)+'" onclick="djReviewDefer(this.dataset.id)">Açık Bırak</button><button class="btn btn-p" data-id="'+U.esc(dec.id)+'" onclick="djReviewSubmit(this.dataset.id)">Sonuçlandır</button></div>';
  showModal(h);
  /* djOpenForm'daki gibi: harness'te ge() değerlerini prime et (madde: form alanları
     doğru yüklenir), tarayıcıda zararsız tekrar-yazım. */
  var _f=function(id,v){ var el=ge(id); if(el)el.value=v; };
  _f('dj_actual',dec.actualOutcome?dec.actualOutcome:'');
  _f('dj_lesson',dec.lessonLearned?dec.lessonLearned:'');
  _f('dj_success_factors',dec.successFactors&&dec.successFactors.length?dec.successFactors.join(', '):'');
  _f('dj_new_review',djDateInput(typeof _decDefaultReviewAt==='function'?_decDefaultReviewAt(_decNow()):''));
}
window.djOpenReview=djOpenReview;

function djReviewSubmit(id){
  var resultEl=ge('dj_result');
  var result=resultEl?resultEl.value:'';
  if(!result){ alert('Sonuç sınıflandırması seç, ya da "Açık Bırak" kullan.'); return; }
  var actual=(ge('dj_actual').value||'').trim();
  var lesson=(ge('dj_lesson').value||'').trim();
  var sf=_djTags(ge('dj_success_factors').value);
  decisionResolve(id,{actualOutcome:actual,result:result,lessonLearned:lesson,successFactors:sf});
  if(typeof save==='function')save();
  sh('modal-root','');
  djOpenDetail(id);
}
window.djReviewSubmit=djReviewSubmit;

function djReviewDefer(id){
  var newReview=(ge('dj_new_review').value||'').trim();
  if(newReview)decisionUpdate(id,{reviewAt:newReview});
  if(typeof save==='function')save();
  sh('modal-root','');
  djOpenDetail(id);
}
window.djReviewDefer=djReviewDefer;

/* ── Decision → Principle ──
   İlke KAYDEDİLDİKTEN SONRA (pFormSave'in genel _pAfterSave kancasıyla) derived_from
   relation kurulur. İptal edilirse (pFormCancel/closeModal) kanca temizlenir — relation
   ASLA oluşmaz (madde 7/31). */
function djNewPrincipleFromReview(decisionId){
  var dec=decisionById(decisionId); if(!dec)return;
  if(typeof openPrincipleForm!=='function')return;
  openPrincipleForm();
  var ta=ge('p_statement');
  if(ta){ ta.value=String(dec.lessonLearned||'').slice(0,1200); if(typeof pCaptureDraft==='function')pCaptureDraft(); }
  window._pAfterSave=function(principleRec){
    relAdd({sourceType:'decision',sourceId:dec.id,targetType:'principle',targetId:principleRec.id,relationType:'derived_from',confidence:'high'});
    if(typeof save==='function')save();
  };
}
window.djNewPrincipleFromReview=djNewPrincipleFromReview;

var djPrincipleLinkOpen=false, djPrincipleLinkQuery='';
function djTogglePrincipleLink(decisionId){
  djPrincipleLinkOpen=!djPrincipleLinkOpen; djPrincipleLinkQuery='';
  var box=ge('dj_review_link_box'); if(box)box.innerHTML=djPrincipleLinkOpen?djPrincipleLinkHtml(decisionId):'';
}
window.djTogglePrincipleLink=djTogglePrincipleLink;
function djPrincipleLinkSetQuery(decisionId,v){ djPrincipleLinkQuery=v; var box=ge('dj_principle_link_results'); if(box)box.innerHTML=djPrincipleLinkResultsHtml(decisionId); }
window.djPrincipleLinkSetQuery=djPrincipleLinkSetQuery;
function djPrincipleLinkHtml(decisionId){
  var h='<div style="margin-bottom:10px;padding:10px 12px;background:var(--s2);border-radius:9px">';
  h+='<input class="inp" placeholder="İlke ara..." style="margin-bottom:6px" data-id="'+U.esc(decisionId)+'" oninput="djPrincipleLinkSetQuery(this.dataset.id,this.value)">';
  h+='<div id="dj_principle_link_results">'+djPrincipleLinkResultsHtml(decisionId)+'</div></div>';
  return h;
}
function djPrincipleLinkResultsHtml(decisionId){
  var q=String(djPrincipleLinkQuery||'').toLocaleLowerCase('tr').trim();
  var list=(typeof pViewList==='function'?pViewList():[]).filter(function(p){
    var label=String(p.title||p.statement||'');
    return !q||label.toLocaleLowerCase('tr').indexOf(q)>=0;
  }).slice(0,20);
  if(!list.length)return '<p style="font-size:11px;color:var(--t3)">Sonuç yok.</p>';
  var h='';
  list.forEach(function(p){
    var label=String(p.title||p.statement||'').slice(0,80);
    h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0"><span style="font-size:12px">'+U.esc(label)+'</span><button type="button" class="btn btn-g btn-sm" data-did="'+U.esc(decisionId)+'" data-pid="'+U.esc(String(p.id))+'" onclick="djLinkExistingPrinciple(this.dataset.did,this.dataset.pid)">Bağla</button></div>';
  });
  return h;
}
window.djPrincipleLinkResultsHtml=djPrincipleLinkResultsHtml;
function djLinkExistingPrinciple(decisionId,principleId){
  relAdd({sourceType:'decision',sourceId:decisionId,targetType:'principle',targetId:principleId,relationType:'derived_from',confidence:'medium'});
  if(typeof save==='function')save();
  djPrincipleLinkOpen=false;
  var box=ge('dj_review_link_box'); if(box)box.innerHTML='';
}
window.djLinkExistingPrinciple=djLinkExistingPrinciple;

/* ══ Arşivleme / Silme ══ */
function djArchive(id){
  if(typeof decisionArchive!=='function')return;
  decisionArchive(id);
  if(typeof save==='function')save();
  sh('modal-root','');
  if(typeof tab!=='undefined'&&tab==='decisions'&&typeof renderDecisions==='function')renderDecisions();
}
window.djArchive=djArchive;

function djDelete(id){
  if(!confirm('Bu karar kalıcı olarak silinsin mi?'))return;
  decisionDelete(id);
  if(typeof save==='function')save();
  sh('modal-root','');
  if(typeof tab!=='undefined'&&tab==='decisions'&&typeof renderDecisions==='function')renderDecisions();
}
window.djDelete=djDelete;
