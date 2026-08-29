/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 5c: NEW SESSION + LIVE WORKSPACE
   The screen a coach actually keeps open during a conversation.

   It is deliberately quiet. One note area, one recommended lens, at most three
   moves. No score, no badge, no methodology picker, no library to browse while
   someone is talking — the library exists, but it is secondary and closed by
   default.

   "Soru sorma, bekle" is a first-class recommendation here. Silence and
   reflection compete with questions on equal terms, because the Phase 3 ranker
   already treats them that way.

   Typing never writes. Notes save on a debounce and on explicit save, and the
   save indicator only claims success after persistence returns.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_LIVE_VERSION = 1;
var COACHING_NOTE_DEBOUNCE_MS = 2500;
var _clNoteTimer = null;

/* Structured context the coach can toggle mid-session. Compact on purpose:
   these are observations a coach already makes, not a form to fill in. */
var COACHING_CTX_CHIPS = [
  ['clarity','high','Hedef netleşti'],
  ['ambivalence','high','Kararsızlık var'],
  ['valuesConflict','high','Değer çatışması'],
  ['readinessForAction','high','Eyleme hazır'],
  ['assumptionExplorationNeeded','high','Varsayım incelensin'],
  ['strengthsOpportunity','high','Güçlü yön fırsatı'],
  ['behaviourChangeNeed','high','Süreklilik sorunu'],
  ['leadershipContext','yes','Liderlik konusu'],
  ['careerContext','yes','Kariyer konusu'],
  ['meaningIdentityContext','yes','Anlam / kimlik']
];

/* ══ NEW SESSION ══ */
function coachingStartNew(){
  COACHING_UI.view = 'new'; COACHING_UI.error = null; COACHING_UI.notice = null;
  COACHING_UI.draft = { context:'adult', relationLabel:'', purpose:'', consent:'unknown' };
  renderCoachingNew();
}
window.coachingStartNew = coachingStartNew;

function coachingSetDraftContext(ctx){
  COACHING_UI.draft.context = ctx;
  if(!(typeof coachingContextIsMinor==='function' && coachingContextIsMinor(ctx))) COACHING_UI.draft.consent = 'unknown';
  renderCoachingNew();
}
window.coachingSetDraftContext = coachingSetDraftContext;
function coachingSetConsent(v){ COACHING_UI.draft.consent = v; renderCoachingNew(); }
window.coachingSetConsent = coachingSetConsent;

function renderCoachingNew(){
  var d = COACHING_UI.draft;
  var minor = (typeof coachingContextIsMinor==='function') && coachingContextIsMinor(d.context);
  var h = '<div class="fade" style="max-width:640px">';
  h += coachingSectionHead('Yeni Görüşme', 'Başlamak için gereken en az bilgi.',
    '<button class="btn btn-s" onclick="coachingBackHome()">Vazgeç</button>');
  if(COACHING_UI.error) h += coachingBanner('error', COACHING_UI.error, COACHING_UI.notice);

  h += '<div class="card" style="padding:18px 20px;margin-bottom:14px">';
  h += '<p class="lbl" style="margin-bottom:8px" id="coach_ctx_label">Kiminle çalışıyorsun?</p>';
  h += '<div role="group" aria-labelledby="coach_ctx_label" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px">';
  ['self','adult','executive','youth','child'].forEach(function(c){
    var on = d.context===c;
    h += '<button type="button" class="btn '+(on?'btn-p':'btn-s')+' btn-sm" aria-pressed="'+(on?'true':'false')+'" '+
      'data-c="'+c+'" onclick="coachingSetDraftContext(this.dataset.c)">'+
      _cue(coachingLabel(COACHING_L_CONTEXT,c,c))+'</button>';
  });
  h += '</div>';

  h += '<div style="margin-bottom:14px"><label class="lbl" for="coach_rel" style="display:block;margin-bottom:4px">İlişki etiketi</label>'+
    '<input class="inp" id="coach_rel" type="text" maxlength="64" value="'+_cue(d.relationLabel)+'" '+
    'placeholder="Danışan A · Ekip arkadaşım · Kızım" aria-describedby="coach_rel_help">'+
    '<p id="coach_rel_help" style="font-size:11px;color:var(--t3);margin-top:5px">'+
    'Tanımlayıcı bilgi isteme. Ad soyad, e-posta veya telefon gerekmiyor ve saklanmamalı.</p></div>';

  h += '<div style="margin-bottom:4px"><label class="lbl" for="coach_purpose" style="display:block;margin-bottom:4px">Amaç</label>'+
    '<input class="inp" id="coach_purpose" type="text" maxlength="140" value="'+_cue(d.purpose)+'" '+
    'placeholder="Delegasyonu geliştirmek · Bir kararı netleştirmek"></div>';
  h += '</div>';

  if(minor){
    var consentOk = d.consent==='granted' || d.consent==='not_required';
    h += '<div class="card" style="padding:16px 18px;margin-bottom:14px;border-left:3px solid '+(consentOk?'var(--green)':'var(--orange)')+'">'+
      '<p style="font-weight:700;font-size:13px;margin-bottom:6px">Veli / vasi durumu</p>'+
      '<p style="font-size:12.5px;color:var(--t2);line-height:1.7;margin-bottom:12px">'+
      'Çocuk ve ergenle çalışırken koruma sorumluluğu her şeyin önünde gelir. Bu bir formalite değil: '+
      'onay bilgisi kayıtlı olmadan görüşme başlatılamaz.</p>'+
      '<div role="group" style="display:flex;gap:7px;flex-wrap:wrap">';
    [['granted','Onay alındı'],['not_required','Gerekli değil'],['unknown','Henüz yok']].forEach(function(o){
      var on = d.consent===o[0];
      h += '<button type="button" class="btn '+(on?'btn-p':'btn-s')+' btn-sm" aria-pressed="'+(on?'true':'false')+'" '+
        'data-v="'+o[0]+'" onclick="coachingSetConsent(this.dataset.v)">'+_cue(o[1])+'</button>';
    });
    h += '</div>';
    if(!consentOk) h += '<p style="font-size:12px;color:var(--orange);margin-top:11px">'+
      'Onay durumu netleşene kadar bu görüşme açılmaz. Atlanabilir bir adım değil.</p>';
    h += '</div>';
  }

  h += '<button class="btn btn-p" style="width:100%;height:42px" onclick="coachingCreateFromDraft()">Görüşmeyi Başlat</button>';
  h += '</div>';
  sh('pinner', h);
  var el = ge('coach_rel'); if(el && el.focus) try{ el.focus(); }catch(e){}
}
window.renderCoachingNew = renderCoachingNew;

async function coachingCreateFromDraft(){
  var d = COACHING_UI.draft;
  d.relationLabel = (ge('coach_rel')||{}).value || '';
  d.purpose = (ge('coach_purpose')||{}).value || '';
  COACHING_UI.error = null; COACHING_UI.notice = null;
  if(!String(d.purpose).trim()){ COACHING_UI.error = 'Kısa bir amaç yaz; görüşmenin yönü buradan geliyor.'; renderCoachingNew(); return; }
  if(String(d.relationLabel).indexOf('@')>=0){ COACHING_UI.error = 'E-posta adresi etiket olarak kullanılamaz.'; renderCoachingNew(); return; }

  var safeguard = { guardianConsent:{ state:d.consent } };
  var res = await coachingSessionCreate({ context:d.context, purpose:d.purpose,
    relationLabel:d.relationLabel, safeguard:safeguard });
  if(!res.ok){
    COACHING_UI.error = coachingErrorText(res.error, res.reason);
    COACHING_UI.notice = (res.decision && res.decision!=='allow')
      ? coachingLabel(COACHING_L_DECISION, res.decision, '') : null;
    renderCoachingNew(); return;
  }
  COACHING_UI.session = res.session;
  COACHING_UI.note = ''; COACHING_UI.noteDirty = false;
  COACHING_UI.ctx = {}; COACHING_UI.moves = []; COACHING_UI.recentMoves = []; COACHING_UI.usedIds = [];
  COACHING_UI.startedAt = Date.now();
  await coachingSessionPatch(COACHING_UI.session, {lifecycle:'active'}, {type:'activate'})
    .then(function(r){ if(r.ok) COACHING_UI.session = r.session; });
  if(typeof gotoTab==='function') gotoTab('coachsession');
}
window.coachingCreateFromDraft = coachingCreateFromDraft;

/* ══ LIVE WORKSPACE ══ */
function coachingCtxOn(key, value){ return COACHING_UI.ctx[key]===value; }
function coachingToggleCtx(key, value){
  if(COACHING_UI.ctx[key]===value) delete COACHING_UI.ctx[key];
  else COACHING_UI.ctx[key] = value;
  coachingRefreshMoves();
  var s = COACHING_UI.session;
  if(s) coachingRecordEvent(s, {type:'CONTEXT_UPDATED'});
}
window.coachingToggleCtx = coachingToggleCtx;
function coachingSetStage(v){ COACHING_UI.ctx.conversationStage = v || null; coachingRefreshMoves(); }
window.coachingSetStage = coachingSetStage;

/* Router + ranker in one pass. Pure computation; nothing is written. */
function coachingRefreshMoves(){
  var s = COACHING_UI.session;
  if(!s){ COACHING_UI.routed = null; COACHING_UI.moves = []; return; }
  var input = Object.assign({}, COACHING_UI.ctx, {
    session:s, event:{type:'note', text:COACHING_UI.note||''},
    personContext:s.context,
    guardianState:(s.safeguard&&s.safeguard.guardianConsent)?s.safeguard.guardianConsent.state:'unknown',
    conversationStage:COACHING_UI.ctx.conversationStage||null,
    recentMoves:COACHING_UI.recentMoves, usedIds:COACHING_UI.usedIds });
  var out = (typeof coachingRecommend==='function') ? coachingRecommend(input) : {approaches:[],moves:[]};
  COACHING_UI.routed = out;
  COACHING_UI.moves = out.moves || [];
  if(typeof tab!=='undefined' && tab==='coachsession') renderCoachingLive();
}
window.coachingRefreshMoves = coachingRefreshMoves;

function renderCoachingLive(){
  var s = COACHING_UI.session;
  if(!s){
    sh('pinner','<div class="fade">'+coachingSectionHead('Görüşme','Açık bir görüşme yok.',
      '<button class="btn btn-p" onclick="coachingBackHome()">Koçluk Ana Sayfası</button>')+'</div>');
    return;
  }
  COACHING_UI.view = 'live';
  if(!COACHING_UI.routed) { coachingRefreshMoves(); return; }
  var r = COACHING_UI.routed || {};
  var safety = r.safety || {decision:'allow'};
  var blocked = r.allowed===false;

  var h = '<div class="fade">';
  /* top bar */
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:16px;flex-wrap:wrap">'+
    '<div><h1 class="sh-t" style="margin-bottom:2px">'+_cue(s.title||'Görüşme')+'</h1>'+
    '<p class="sh-sub">'+_cue(s.subjectRef||'—')+' · '+_cue(coachingLabel(COACHING_L_CONTEXT,s.context,s.context))+'</p></div>'+
    '<div style="display:flex;gap:8px;align-items:center">'+
    '<span id="coach_elapsed" style="font-size:13px;font-variant-numeric:tabular-nums;color:var(--t2)">'+
    _cue(coachingElapsed(COACHING_UI.startedAt))+'</span>'+
    coachingStatusPill(s.lifecycle)+
    '<span id="coach_save" style="font-size:11px;color:'+(COACHING_UI.savePending?'var(--orange)':'var(--t3)')+'">'+
    _cue(COACHING_UI.saving?'Kaydediliyor…':(COACHING_UI.savePending?'Kaydedilemedi — bağlantı yok'
      :(COACHING_UI.noteDirty?'Kaydedilmedi':'Kayıtlı')))+'</span>'+
    '</div></div>';

  if(COACHING_UI.error) h += coachingBanner('error', COACHING_UI.error);
  if(blocked || safety.decision==='stop_and_refer'){
    h += coachingBanner('error','Bu konu koçluğun uygun kapsamı dışında olabilir.',
      (safety.rationale||'')+' '+(r.notes&&r.notes.length?r.notes[0]:''));
  } else if(safety.decision==='pause'){
    h += coachingBanner('warn','Burada durup kapsamı gözden geçir.', safety.rationale||'');
  }

  h += '<div class="g2c" style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start">';

  /* main note area */
  h += '<div class="card" style="padding:16px 18px">'+
    '<label class="lbl" for="coach_note" style="display:block;margin-bottom:6px">Şu an duyduğum</label>'+
    '<textarea class="inp" id="coach_note" rows="14" oninput="coachingNoteInput()" '+
    'aria-describedby="coach_note_help" style="resize:vertical;line-height:1.7;font-size:13.5px">'+
    _cue(COACHING_UI.note)+'</textarea>'+
    '<p id="coach_note_help" style="font-size:11px;color:var(--t3);margin-top:7px">'+
    'Bu senin çalışma notun — teşhis değil. Gerekmeyen hassas ayrıntıyı yazma.</p>'+
    '<div style="display:flex;gap:7px;margin-top:12px;flex-wrap:wrap">'+
    '<button class="btn '+(COACHING_UI.savePending?'btn-p':'btn-s')+' btn-sm" onclick="coachingSaveNow()">'+
    (COACHING_UI.savePending?'Tekrar Dene':'Kaydet')+'</button>'+
    '<button class="btn btn-p btn-sm" onclick="coachingOpenClose()">Görüşmeyi Kapat</button>'+
    '<button class="btn btn-g btn-sm" style="margin-left:auto" onclick="coachingCancelLive()">İptal</button>'+
    '</div></div>';

  /* assistance column */
  h += '<div>';
  if(!blocked){
    var ap = (r.approaches&&r.approaches.length) ? r.approaches[0] : null;
    if(ap){
      h += '<div class="card" style="padding:13px 15px;margin-bottom:12px;background:var(--bl);border:1px solid var(--s2)">'+
        '<p style="font-size:10.5px;font-weight:700;color:var(--blue);letter-spacing:.08em;text-transform:uppercase">Önerilen yaklaşım</p>'+
        '<p style="font-weight:700;font-size:13.5px;margin:3px 0 4px">'+_cue(ap.title)+'</p>'+
        '<p style="font-size:12px;color:var(--t2);line-height:1.6">'+_cue(ap.whyNow)+'</p>';
      if(r.approaches.length>1)
        h += '<details style="margin-top:7px"><summary style="cursor:pointer;font-size:11px;font-weight:700;color:var(--blue)">Başka mercek</summary>'+
          r.approaches.slice(1).map(function(a){
            return '<p style="font-size:11.5px;color:var(--t2);margin-top:5px"><b>'+_cue(a.title)+'</b> — '+_cue(a.whyNow)+'</p>';
          }).join('')+'</details>';
      h += '</div>';
    }
    h += '<div class="card" style="padding:13px 15px;margin-bottom:12px">'+
      '<p style="font-weight:700;font-size:12.5px;margin-bottom:9px">Sıradaki hamle</p>';
    if(!COACHING_UI.moves.length) h += '<p style="font-size:12px;color:var(--t3)">Şimdilik öneri yok. Dinlemeye devam et.</p>';
    COACHING_UI.moves.forEach(function(m){
      var x = m.intervention;
      h += '<div style="padding:10px 0;border-top:1px solid var(--s2)">'+
        '<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t2)">'+
        _cue(coachingLabel(COACHING_L_TYPE, x.type, x.type))+'</span>'+
        '<p style="font-size:13px;line-height:1.6;margin:6px 0 4px;color:var(--t)">'+
        _cue(x.text || x.title)+'</p>'+
        '<details><summary style="cursor:pointer;font-size:11px;color:var(--blue);font-weight:600">Neden şimdi?</summary>'+
        '<p style="font-size:11.5px;color:var(--t2);line-height:1.6;margin-top:4px">'+_cue(m.whyNow)+'</p></details>'+
        '<button class="btn btn-g btn-sm" style="margin-top:8px" data-id="'+_cue(x.id)+'" '+
        'onclick="coachingMarkUsed(this.dataset.id)">Kullandım</button>'+
        '</div>';
    });
    h += '</div>';
  }

  /* compact structured context */
  h += '<div class="card" style="padding:13px 15px">'+
    '<p style="font-weight:700;font-size:12.5px;margin-bottom:9px">Şu an ne görüyorsun?</p>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  COACHING_CTX_CHIPS.forEach(function(c){
    var on = coachingCtxOn(c[0], c[1]);
    h += '<button type="button" class="btn '+(on?'btn-p':'btn-g')+' btn-sm" aria-pressed="'+(on?'true':'false')+'" '+
      'data-k="'+c[0]+'" data-v="'+c[1]+'" onclick="coachingToggleCtx(this.dataset.k,this.dataset.v)" '+
      'style="font-size:11px">'+_cue(c[2])+'</button>';
  });
  h += '</div>';
  h += '<div style="margin-top:11px"><label class="lbl" for="coach_stage" style="display:block;margin-bottom:4px">Aşama</label>'+
    '<select class="inp" id="coach_stage" onchange="coachingSetStage(this.value)" style="font-size:12px">'+
    '<option value="">Belirtme</option>';
  COACHING_STAGES.forEach(function(st){
    h += '<option value="'+st+'"'+(COACHING_UI.ctx.conversationStage===st?' selected':'')+'>'+
      _cue(coachingLabel(COACHING_L_STAGE, st, st))+'</option>';
  });
  h += '</select></div>';
  h += '<button class="btn btn-g btn-sm" style="margin-top:11px;width:100%" onclick="coachingToggleLibrary()">'+
    (COACHING_UI.libraryOpen?'Kütüphaneyi kapat':'Kütüphane')+'</button>';
  h += '</div>';
  h += '</div></div>';

  if(COACHING_UI.libraryOpen) h += coachingLibraryHtml();
  h += '</div>';
  sh('pinner', h);
  coachingStartTimer();
}
window.renderCoachingLive = renderCoachingLive;

function coachingStartTimer(){
  if(COACHING_UI.timer) clearInterval(COACHING_UI.timer);
  COACHING_UI.timer = setInterval(function(){
    var el = ge('coach_elapsed');
    if(!el){ clearInterval(COACHING_UI.timer); COACHING_UI.timer = null; return; }
    el.textContent = coachingElapsed(COACHING_UI.startedAt);
  }, 1000);
}
function _clSetSaveText(t){ var el = ge('coach_save'); if(el) el.textContent = t; }

/* Typing never writes. It marks dirty and schedules one debounced save. */
function coachingNoteInput(){
  var el = ge('coach_note'); if(!el) return;
  COACHING_UI.note = el.value;
  COACHING_UI.noteDirty = true;
  _clSetSaveText('Kaydedilmedi');
  if(_clNoteTimer) clearTimeout(_clNoteTimer);
  _clNoteTimer = setTimeout(function(){ coachingSaveNow(true); }, COACHING_NOTE_DEBOUNCE_MS);
}
window.coachingNoteInput = coachingNoteInput;

async function coachingSaveNow(silent){
  if(_clNoteTimer){ clearTimeout(_clNoteTimer); _clNoteTimer = null; }
  var s = COACHING_UI.session; if(!s) return {ok:false};
  var el = ge('coach_note'); if(el) COACHING_UI.note = el.value;
  COACHING_UI.saving = true; _clSetSaveText('Kaydediliyor…');
  var res = await coachingSaveNote(s, COACHING_UI.note);
  COACHING_UI.saving = false;
  if(res.ok){
    COACHING_UI.noteDirty = false; COACHING_UI.savePending = false; COACHING_UI.error = null;
    /* said only after the SERVER confirmed — a locally queued write is not saved */
    _clSetSaveText('Kayıtlı');
    coachingRecordEvent(s, {type:'COACH_NOTE_UPDATED'});
    if(!silent) renderCoachingLive();
  }else{
    COACHING_UI.savePending = (res.error==='connection_required' || res.error==='write_pending');
    COACHING_UI.error = coachingErrorText(res.error, res.reason);
    _clSetSaveText(COACHING_UI.savePending?'Kaydedilemedi — bağlantı yok':'Kaydedilemedi');
    renderCoachingLive();
  }
  return res;
}
window.coachingSaveNow = coachingSaveNow;

async function coachingMarkUsed(id){
  var s = COACHING_UI.session; if(!s) return;
  var x = (typeof coachingIntervention==='function') ? coachingIntervention(id) : null;
  var res = await coachingUseIntervention(s, id,
    {stage:COACHING_UI.ctx.conversationStage, approachId:(COACHING_UI.routed&&COACHING_UI.routed.approaches&&COACHING_UI.routed.approaches[0])?COACHING_UI.routed.approaches[0].approachId:null});
  if(res.ok){
    COACHING_UI.session = res.session;
    COACHING_UI.usedIds = COACHING_UI.usedIds.concat([id]);
    if(x) COACHING_UI.recentMoves = COACHING_UI.recentMoves.concat([{type:x.type, purpose:x.purpose}]).slice(-8);
    COACHING_UI.error = null;
  }else COACHING_UI.error = coachingErrorText(res.error, res.reason);
  coachingRefreshMoves();
}
window.coachingMarkUsed = coachingMarkUsed;

async function coachingCancelLive(){
  var s = COACHING_UI.session; if(!s) return;
  var res = await coachingCancelSession(s);
  if(!res.ok){ COACHING_UI.error = coachingErrorText(res.error, res.reason); renderCoachingLive(); return; }
  coachingUiReset();
  if(typeof gotoTab==='function') gotoTab('coachhome');
  coachingLoadHome();
}
window.coachingCancelLive = coachingCancelLive;

/* ══ SECONDARY: intervention library ══ closed by default, never the main act */
function coachingToggleLibrary(){ COACHING_UI.libraryOpen = !COACHING_UI.libraryOpen; renderCoachingLive(); }
window.coachingToggleLibrary = coachingToggleLibrary;
function coachingSetLibraryFilter(k, v){ COACHING_UI.libraryFilter[k] = v || null; renderCoachingLive(); }
window.coachingSetLibraryFilter = coachingSetLibraryFilter;
function coachingLibraryHtml(){
  var s = COACHING_UI.session || {};
  var f = COACHING_UI.libraryFilter || {};
  var list = (typeof coachingInterventionList==='function') ? coachingInterventionList() : [];
  list = list.filter(function(x){
    if(x.applicableContexts.indexOf(s.context)<0) return false;
    if(typeof coachingInterventionAllowed==='function' && !coachingInterventionAllowed(x.id, s.context).allowed) return false;
    if(f.type && x.type!==f.type) return false;
    if(f.purpose && x.purpose!==f.purpose) return false;
    return true;
  }).slice(0, 40);
  var h = '<div class="card" style="padding:15px 17px;margin-top:16px">'+
    '<p style="font-weight:700;font-size:13px;margin-bottom:10px">Kütüphane</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
    '<select class="inp" style="width:auto;font-size:12px" onchange="coachingSetLibraryFilter(\'type\',this.value)">'+
    '<option value="">Tüm hamle türleri</option>';
  coachingInterventionTypeKeys().forEach(function(t){
    h += '<option value="'+t+'"'+(f.type===t?' selected':'')+'>'+_cue(coachingLabel(COACHING_L_TYPE,t,t))+'</option>';
  });
  h += '</select><select class="inp" style="width:auto;font-size:12px" onchange="coachingSetLibraryFilter(\'purpose\',this.value)">'+
    '<option value="">Tüm amaçlar</option>';
  COACHING_PURPOSES.forEach(function(p){
    h += '<option value="'+p+'"'+(f.purpose===p?' selected':'')+'>'+_cue(p)+'</option>';
  });
  h += '</select></div>';
  if(!list.length) h += '<p style="font-size:12px;color:var(--t3)">Bu filtrede uygun hamle yok.</p>';
  list.forEach(function(x){
    h += '<div style="padding:8px 0;border-top:1px solid var(--s2);display:flex;gap:10px;align-items:flex-start">'+
      '<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3);flex-shrink:0">'+
      _cue(coachingLabel(COACHING_L_TYPE,x.type,x.type))+'</span>'+
      '<p style="font-size:12.5px;line-height:1.55;flex:1">'+_cue(x.text||x.title)+'</p>'+
      '<button class="btn btn-g btn-sm" data-id="'+_cue(x.id)+'" onclick="coachingMarkUsed(this.dataset.id)">Kullandım</button>'+
      '</div>';
  });
  h += '<p style="font-size:11px;color:var(--t3);margin-top:10px">En fazla 40 kayıt gösterilir. Konuşma sırasında asıl yer önerilerdir.</p>';
  return h+'</div>';
}

/* ══ CLOSE ══ short, mostly optional, and the action belongs to the coachee ══ */
function coachingOpenClose(){ COACHING_UI.view = 'close'; renderCoachingClose(); }
window.coachingOpenClose = coachingOpenClose;
function renderCoachingClose(){
  var s = COACHING_UI.session || {};
  var h = '<div class="fade" style="max-width:640px">';
  h += coachingSectionHead('Görüşmeyi Kapat', _cue(s.title||''),
    '<button class="btn btn-s" onclick="coachingBackToLive()">Geri</button>');
  if(COACHING_UI.error) h += coachingBanner('error', COACHING_UI.error);
  h += '<div class="card" style="padding:18px 20px;margin-bottom:14px">'+
    '<label class="lbl" for="coach_insight" style="display:block;margin-bottom:4px">Ne netleşti?</label>'+
    '<textarea class="inp" id="coach_insight" rows="2" placeholder="Danışan için bugün neyin değiştiği"></textarea>'+
    '<p style="font-size:11px;color:var(--t3);margin:5px 0 16px">İsteğe bağlı.</p>'+

    '<label class="lbl" for="coach_commit" style="display:block;margin-bottom:4px">Danışanın kendi eylemi</label>'+
    '<textarea class="inp" id="coach_commit" rows="2" placeholder="Salı günü toplantıda iki görevi devredeceğim."></textarea>'+
    '<p style="font-size:11px;color:var(--t3);margin:5px 0 8px">'+
    'Danışanın kendi cümlesiyle yaz. Senin önerin buraya taahhüt olarak geçmez.</p>'+
    '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;cursor:pointer;margin-bottom:16px">'+
    '<input type="checkbox" class="cb" id="coach_commit_owned"> '+
    '<span>Bu eylemi danışan kendisi seçti.</span></label>'+

    '<label class="lbl" for="coach_suggestion" style="display:block;margin-bottom:4px">Senin önerin (ayrı tutulur)</label>'+
    '<textarea class="inp" id="coach_suggestion" rows="2" placeholder="Taahhüt değil, kendi notun"></textarea>'+
    '<p style="font-size:11px;color:var(--t3);margin:5px 0 16px">İsteğe bağlı. Danışanın taahhüdüyle karıştırılmaz.</p>'+

    '<label class="lbl" for="coach_reflect" style="display:block;margin-bottom:4px">Kendi yansımam</label>'+
    '<textarea class="inp" id="coach_reflect" rows="2" placeholder="Ne işe yaradı? Nerede acele ettim?"></textarea>'+
    '<p style="font-size:11px;color:var(--t3);margin-top:5px">İsteğe bağlı. Yalnız sana açık.</p>'+
    '</div>';
  h += '<button class="btn btn-p" style="width:100%;height:42px" onclick="coachingSubmitClose()">Görüşmeyi Tamamla</button>';
  h += '</div>';
  sh('pinner', h);
}
window.renderCoachingClose = renderCoachingClose;
function coachingBackToLive(){ COACHING_UI.view='live'; COACHING_UI.error=null; renderCoachingLive(); }
window.coachingBackToLive = coachingBackToLive;

async function coachingSubmitClose(){
  var s = COACHING_UI.session; if(!s) return;
  var commitText = (ge('coach_commit')||{}).value || '';
  var owned = !!((ge('coach_commit_owned')||{}).checked);
  COACHING_UI.error = null;
  if(String(commitText).trim() && !owned){
    COACHING_UI.error = COACHING_L_ERROR.commitment_must_be_coachee_owned;
    renderCoachingClose(); return;
  }
  await coachingSaveNow(true);
  var outcome = {
    insight:(ge('coach_insight')||{}).value || '',
    reflection:(ge('coach_reflect')||{}).value || '',
    coachSuggestion:(ge('coach_suggestion')||{}).value || ''
  };
  if(String(commitText).trim()) outcome.commitment = { source:'coachee', text:commitText };
  var res = await coachingCompleteSession(s, outcome);
  if(!res.ok){ COACHING_UI.error = coachingErrorText(res.error, res.reason); renderCoachingClose(); return; }
  coachingUiReset();
  COACHING_UI.notice = 'Görüşme tamamlandı.';
  if(typeof gotoTab==='function') gotoTab('coachhome');
  coachingLoadHome();
}
window.coachingSubmitClose = coachingSubmitClose;

function coachingLiveSelfCheck(){
  return { version:COACHING_LIVE_VERSION, debounceMs:COACHING_NOTE_DEBOUNCE_MS,
    chips:COACHING_CTX_CHIPS.map(function(c){ return c[0]; }), view:COACHING_UI.view,
    maxMoves:(typeof COACHING_SUGGEST_MAX!=='undefined')?COACHING_SUGGEST_MAX:null };
}

if(typeof window!=='undefined'){
  window.COACHING_LIVE_VERSION=COACHING_LIVE_VERSION;
  window.COACHING_NOTE_DEBOUNCE_MS=COACHING_NOTE_DEBOUNCE_MS;
  window.COACHING_CTX_CHIPS=COACHING_CTX_CHIPS;
  window.coachingCtxOn=coachingCtxOn; window.coachingLibraryHtml=coachingLibraryHtml;
  window.coachingLiveSelfCheck=coachingLiveSelfCheck;
}
