/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 5b: WORKSPACE SHELL
   Presentation labels, Coaching home, session history and the privacy panel.

   Internal enum values never reach the screen: STOP_AND_REFER, INTERVENTION_USED
   and MOTIVATIONAL_INTERVIEWING are engine vocabulary, and the coach reads
   Turkish. Everything user-facing goes through the label maps below.

   Nothing here renders unless the feature flag is on. With the flag OFF the
   navigation entry is never injected and no route is reachable, so the app is
   byte-for-byte the app it was before.

   Read-only view for anything already completed: a finished session is history,
   not a document to keep editing.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_UI_VERSION = 1;

/* ── Presentation labels (engine value → what a human reads) ── */
var COACHING_L_CONTEXT = { self:'Kendim', adult:'Yetişkin', executive:'Yönetici', youth:'Ergen', child:'Çocuk' };
var COACHING_L_LIFECYCLE = { draft:'Taslak', active:'Devam ediyor', completed:'Tamamlandı',
  cancelled:'İptal edildi', archived:'Arşivlendi' };
var COACHING_L_DECISION = { allow:'Uygun', allow_with_note:'Not ile devam', pause:'Durakla',
  stop_and_refer:'Durdur ve yönlendir' };
var COACHING_L_TYPE = { OPEN_QUESTION:'Açık soru', REFLECTION:'Yansıtma', PARAPHRASE:'Yeniden ifade',
  SUMMARY:'Özet', AFFIRMATION:'Onaylama', SILENCE:'Sessizlik', OBSERVATION:'Gözlem',
  CHALLENGE:'Nazik meydan okuma', REFRAME:'Yeniden çerçeveleme', SCALING:'Ölçekleme',
  PERMISSION_BASED_INFORMATION:'İzinli bilgi', ACTION_COMMITMENT:'Eylem taahhüdü' };
var COACHING_L_CONSENT = { unknown:'Henüz yok', not_required:'Gerekli değil', granted:'Alındı',
  declined:'Verilmedi', withdrawn:'Geri çekildi' };
var COACHING_L_STAGE = { OPENING:'Açılış', CONTRACTING:'Sözleşme', EXPLORING:'Keşif', DEEPENING:'Derinleşme',
  AWARENESS:'Farkındalık', OPTIONS:'Seçenekler', COMMITMENT:'Taahhüt', CLOSING:'Kapanış', FOLLOW_UP:'İzleme' };
function coachingLabel(map, key, fallback){
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : (fallback!=null ? fallback : '');
}
function coachingApproachLabel(id){
  var a = (typeof coachingApproach==='function') ? coachingApproach(id) : null;
  return a ? (a.title || a.shortTitle) : '';
}

/* ── Runtime UI state. Memory only: no localStorage coaching database. ── */
var COACHING_UI = { view:'home', session:null, note:'', noteDirty:false, saving:false, savePending:false,
  mirror:null, practice:null, activePractice:null, practiceAsk:false, devRecords:[], devSessions:[], devCross:null, devObservations:[],
  error:null, notice:null, sessions:[], ctx:{}, routed:null, moves:[], usedIds:[],
  recentMoves:[], startedAt:null, timer:null, libraryOpen:false, libraryFilter:{},
  draft:{ context:'adult', relationLabel:'', purpose:'', consent:'unknown' },
  /* what the coach has typed into the close form, kept in memory only so a
     refused completion can be re-rendered without destroying their words */
  closeForm:null, closeFocus:null, busy:false };

function coachingUiReset(){
  if(COACHING_UI.timer){ clearInterval(COACHING_UI.timer); COACHING_UI.timer = null; }
  COACHING_UI = { view:'home', session:null, note:'', noteDirty:false, saving:false, savePending:false,
    mirror:null, practice:null, activePractice:null, practiceAsk:false, devRecords:[], devSessions:[], devCross:null, devObservations:[],
    error:null, notice:null, sessions:[], ctx:{}, routed:null, moves:[], usedIds:[],
    recentMoves:[], startedAt:null, timer:null, libraryOpen:false, libraryFilter:{},
    draft:{ context:'adult', relationLabel:'', purpose:'', consent:'unknown' },
  /* what the coach has typed into the close form, kept in memory only so a
     refused completion can be re-rendered without destroying their words */
  closeForm:null, closeFocus:null, busy:false };
}
function _cue(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _cuIc(n,sz,cl){ return (typeof ic==='function')?ic(n,sz||14,cl):''; }
function _cuDate(iso){
  if(!iso) return '';
  try{ var d=new Date(iso); return d.toLocaleDateString('tr-TR',{day:'numeric',month:'short',year:'numeric'}); }
  catch(e){ return String(iso).slice(0,10); }
}
function coachingElapsed(startedAt, now){
  if(startedAt==null || isNaN(Number(startedAt))) return '00:00';   // 0 is a valid start
  var ms = (now||Date.now()) - startedAt;
  if(ms<0) ms = 0;
  var m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
  return ('0'+m).slice(-2)+':'+('0'+s).slice(-2);
}
/* Errors reach the coach as plain sentences; codes never leak to the screen. */
var COACHING_L_ERROR = {
  blocked:'Bu adım şu an güvenli değil. Aşağıdaki yönlendirmeye bak.',
  not_authorized:'Bu işlem için yetkin yok.',
  owner_unresolved:'Hesap doğrulanamadı. Yeniden giriş yapmayı dene.',
  storage_unavailable:'Bağlantı hazır değil. Birazdan tekrar dene.',
  write_failed:'Kaydedilemedi. Notun ekranda duruyor; tekrar dene.',
  connection_required:'Kaydedilemedi — bağlantıyı kontrol edip tekrar deneyin. Notun ekranda duruyor.',
  write_pending:'Kaydedilemedi — bağlantıyı kontrol edip tekrar deneyin. Notun ekranda duruyor.',
  read_failed:'Okunamadı. Birazdan tekrar dene.',
  not_found:'Görüşme bulunamadı.',
  id_conflict:'Bu görüşme zaten var.',
  invalid_session:'Görüşme bilgileri eksik veya geçersiz.',
  invalid_transition:'Bu geçiş yapılamaz.',
  commitment_source_required:'Eylemin kime ait olduğu belirtilmeli.',
  commitment_must_be_coachee_owned:'Eylem danışanın kendi cümlesi olmalı; koç önerisi taahhüt yerine geçmez.',
  confirmation_required:'Devam etmek için onay gerekiyor.',
  intervention_not_permitted:'Bu hamle bu bağlamda uygun değil.',
  unknown_intervention:'Bu hamle bulunamadı.'
};
function coachingErrorText(code, reason){
  if(reason && Object.prototype.hasOwnProperty.call(COACHING_L_ERROR, reason)) return COACHING_L_ERROR[reason];
  if(Object.prototype.hasOwnProperty.call(COACHING_L_ERROR, code)) return COACHING_L_ERROR[code];
  return 'Beklenmeyen bir durum oluştu. Tekrar dene.';
}

/* ── Rendering helpers shared with the live workspace ── */
function coachingBanner(kind, text, detail){
  var c = kind==='error' ? 'var(--red)' : kind==='warn' ? 'var(--orange)' : 'var(--blue)';
  var bg = kind==='error' ? 'var(--rl)' : kind==='warn' ? 'var(--ol)' : 'var(--bl)';
  return '<div role="status" style="display:flex;gap:9px;align-items:flex-start;padding:11px 14px;border-radius:11px;'+
    'background:'+bg+';border:1px solid '+c+';margin-bottom:14px">'+
    '<span style="flex-shrink:0;margin-top:1px">'+_cuIc(kind==='error'?'x':'info',14,c)+'</span>'+
    '<div><p style="font-size:12.5px;font-weight:600;color:var(--t)">'+_cue(text)+'</p>'+
    (detail?'<p style="font-size:11.5px;color:var(--t2);margin-top:3px">'+_cue(detail)+'</p>':'')+'</div></div>';
}
function coachingSectionHead(title, sub, action){
  return '<div class="sh"><div><h1 class="sh-t">'+_cue(title)+'</h1>'+
    (sub?'<p class="sh-sub">'+_cue(sub)+'</p>':'')+'</div>'+(action||'')+'</div>';
}
function coachingStatusPill(lifecycle){
  var m = { draft:'p-gray', active:'p-blue', completed:'p-green', cancelled:'p-orange', archived:'p-gray' };
  return '<span class="pill '+(m[lifecycle]||'p-gray')+'" style="font-size:10px">'+
    _cue(coachingLabel(COACHING_L_LIFECYCLE, lifecycle, lifecycle))+'</span>';
}

/* ══ COACHING HOME ══ Start, continue, look back. Not a metrics dashboard. ══ */
async function coachingLoadHome(){
  COACHING_UI.busy = true;
  var res = await coachingListSessions({limit:12});
  if(typeof coachingLoadDevelopment==='function'){
    var d = await coachingLoadDevelopment(null, 50);
    COACHING_UI.devRecords = d.ok ? d.records : [];
    COACHING_UI.activePractice = (typeof coachingActivePractice==='function') ? coachingActivePractice(COACHING_UI.devRecords) : null;
  }
  COACHING_UI.busy = false;
  if(res.ok){ COACHING_UI.sessions = res.sessions; COACHING_UI.error = null; }
  else {
    /* A failed query says nothing about how many sessions exist. Keep whatever
       was already loaded and show the failure alongside it; replacing it with
       an empty list would tell a coach with real history that they have none. */
    if(!Array.isArray(COACHING_UI.sessions)) COACHING_UI.sessions = [];
    COACHING_UI.error = coachingErrorText(res.error);
  }
  if(typeof tab!=='undefined' && tab==='coachhome') renderCoachingHome();
}
function renderCoachingHome(){
  COACHING_UI.view = 'home';
  var h = '<div class="fade">';
  h += coachingSectionHead('Koçluk', 'Sakin bir çalışma alanı — konuşmayı sen yönetirsin.',
    '<button class="btn btn-p" onclick="coachingStartNew()">'+_cuIc('plus',13)+' Yeni Görüşme</button>');
  if(COACHING_UI.error) h += coachingBanner('error', COACHING_UI.error);

  var open = COACHING_UI.sessions.filter(function(s){ return s.lifecycle==='draft'||s.lifecycle==='active'; });
  if(open.length){
    var s = open[0];
    h += '<div class="card" style="padding:16px 18px;margin-bottom:16px;border-left:3px solid var(--blue)">'+
      '<p style="font-size:10.5px;font-weight:700;color:var(--blue);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Devam eden görüşme</p>'+
      '<p style="font-weight:700;font-size:14px;margin-bottom:2px">'+_cue(s.title||'Başlıksız')+'</p>'+
      '<p style="font-size:12px;color:var(--t2)">'+_cue(s.subjectRef||'—')+' · '+
      _cue(coachingLabel(COACHING_L_CONTEXT, s.context, s.context))+' · '+_cuDate(s.createdAt)+'</p>'+
      '<div style="display:flex;gap:7px;margin-top:11px">'+
      '<button class="btn btn-p btn-sm" data-id="'+_cue(s.id)+'" onclick="coachingResume(this.dataset.id)">Devam Et</button>'+
      '<button class="btn btn-g btn-sm" data-id="'+_cue(s.id)+'" onclick="coachingCancelFromHome(this.dataset.id)">İptal Et</button>'+
      '</div></div>';
  }

  var past = COACHING_UI.sessions.filter(function(s){ return s.lifecycle!=='draft'&&s.lifecycle!=='active'; });
  h += '<p style="font-weight:700;font-size:13px;margin:18px 0 10px">Son Görüşmeler</p>';
  if(COACHING_UI.busy) h += '<div class="card" style="padding:28px;text-align:center;color:var(--t2);font-size:12.5px">Yükleniyor…</div>';
  else if(!past.length) h += '<div class="card" style="padding:40px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">'+
    _cuIc('us',28,'var(--t3)')+'<p style="font-weight:600;font-size:14px">Henüz tamamlanmış görüşme yok</p>'+
    '<p style="font-size:12px;color:var(--t2);max-width:320px">İlk görüşmeni başlat; burada yalnız tarih, etiket ve amaç görünür.</p></div>';
  else {
    h += '<div class="card" style="overflow:hidden"><table class="tbl"><thead><tr>'+
      '<th style="padding-left:16px">Tarih</th><th>Kim</th><th>Amaç</th><th>Durum</th><th style="width:70px"></th>'+
      '</tr></thead><tbody>';
    past.forEach(function(s){
      h += '<tr><td style="padding-left:16px;font-size:12px;color:var(--t2);white-space:nowrap">'+_cuDate(s.createdAt)+'</td>'+
        '<td><p style="font-size:12.5px;font-weight:600">'+_cue(s.subjectRef||'—')+'</p>'+
        '<p style="font-size:10.5px;color:var(--t3)">'+_cue(coachingLabel(COACHING_L_CONTEXT,s.context,s.context))+'</p></td>'+
        '<td style="font-size:12.5px">'+_cue(s.title||'—')+'</td>'+
        '<td>'+coachingStatusPill(s.lifecycle)+'</td>'+
        '<td><button class="btn btn-g btn-sm" data-id="'+_cue(s.id)+'" onclick="coachingOpenPast(this.dataset.id)">Aç</button></td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '<div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
    '<button class="btn btn-s btn-sm" onclick="gotoTab(\'coachdev\')">'+_cuIc('kpi',12,'var(--t2)')+' Gelişimim</button>'+
    (COACHING_UI.activePractice?('<span style="font-size:11.5px;color:var(--t3)">Aktif pratiğin: '+
      _cue(COACHING_UI.activePractice.title)+'</span>'):'')+'</div>';
  h += '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">'+
    (coachingLegacyCount()?('<button class="btn btn-g btn-sm" onclick="gotoTab(\'coaching\')">'+
      _cuIc('arc',12,'var(--t3)')+' Eski koçluk notlarım ('+coachingLegacyCount()+')</button>'):'')+
    '<button class="btn btn-g btn-sm" onclick="coachingOpenPrivacy()">'+_cuIc('sh',12,'var(--t3)')+' Gizlilik ve Dışa Aktarma</button></div>';
  h += '</div>';
  sh('pinner', h);
}
window.renderCoachingHome = renderCoachingHome;

async function coachingResume(id){
  var res = await coachingLoadSession(id);
  if(!res.ok){ COACHING_UI.error = coachingErrorText(res.error); renderCoachingHome(); return; }
  var n = await coachingLoadNote(id);
  if(!n.ok){
    /* Opening the workspace with a blank note would be worse than not opening
       it: the next autosave would overwrite the real note with nothing. */
    COACHING_UI.error = coachingErrorText(n.error, n.reason);
    renderCoachingHome(); return;
  }
  COACHING_UI.session = res.session;
  COACHING_UI.startedAt = Date.now();
  COACHING_UI.note = n.note ? String(n.note.body||'') : '';
  COACHING_UI.noteDirty = false;
  COACHING_UI.error = null;
  if(typeof gotoTab==='function') gotoTab('coachsession');
}
window.coachingResume = coachingResume;
async function coachingCancelFromHome(id){
  var res = await coachingLoadSession(id);
  if(!res.ok){ COACHING_UI.error = coachingErrorText(res.error); renderCoachingHome(); return; }
  var out = await coachingCancelSession(res.session);
  COACHING_UI.notice = out.ok ? 'Görüşme iptal edildi. Kaydı duruyor.' : null;
  COACHING_UI.error = out.ok ? null : coachingErrorText(out.error, out.reason);
  await coachingLoadHome();
}
window.coachingCancelFromHome = coachingCancelFromHome;

/* ══ PAST SESSION — read-oriented. History is not a form. ══ */
async function coachingOpenPast(id){
  var res = await coachingLoadSession(id);
  if(!res.ok){ COACHING_UI.error = coachingErrorText(res.error); renderCoachingHome(); return; }
  COACHING_UI.session = res.session;
  COACHING_UI.view = 'past';
  renderCoachingPast();
}
window.coachingOpenPast = coachingOpenPast;
function renderCoachingPast(){
  var s = COACHING_UI.session || {};
  var h = '<div class="fade">';
  h += coachingSectionHead(s.title || 'Görüşme',
    _cue(s.subjectRef||'—')+' · '+coachingLabel(COACHING_L_CONTEXT, s.context, s.context)+' · '+_cuDate(s.createdAt),
    '<button class="btn btn-s" onclick="coachingBackHome()">Geri</button>');
  h += '<div class="card" style="padding:16px 18px;margin-bottom:14px">'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+coachingStatusPill(s.lifecycle)+
    (s.approach?'<span class="pill p-blue" style="font-size:10px">'+_cue(coachingApproachLabel(s.approach))+'</span>':'')+
    '</div>';
  var c = s.counters || {};
  h += '<div style="display:flex;gap:18px;margin-top:14px;flex-wrap:wrap">'+
    ['interventions','commitments','reflections','events'].map(function(k){
      var lbl = {interventions:'Hamle', commitments:'Taahhüt', reflections:'Yansıma', events:'Olay'}[k];
      return '<div><p style="font-size:19px;font-weight:700">'+(Number(c[k])||0)+'</p>'+
        '<p style="font-size:10.5px;color:var(--t3)">'+lbl+'</p></div>';
    }).join('')+'</div>';
  h += '<p style="font-size:11.5px;color:var(--t3);margin-top:16px">'+
    'Görüşme notları ve taahhütler burada özet olarak gösterilmez; ayrıntı yalnız senin cihazında ve talebinle açılır.</p>';
  h += '</div>';
  h += '<p style="font-size:11.5px;color:var(--t3)">Tamamlanmış görüşme salt okunur tutulur. Bir düzeltme gerekiyorsa yeni bir görüşme aç.</p>';
  h += '</div>';
  sh('pinner', h);
}
function coachingBackHome(){ COACHING_UI.session = null; COACHING_UI.view='home'; coachingLoadHome(); renderCoachingHome(); }
window.coachingBackHome = coachingBackHome;

/* ══ PRIVACY / EXPORT — deliberately away from the live conversation ══ */
function coachingOpenPrivacy(){ COACHING_UI.view = 'privacy'; renderCoachingPrivacy(); }
window.coachingOpenPrivacy = coachingOpenPrivacy;
function renderCoachingPrivacy(){
  var p = (typeof coachingExportPolicy==='function') ? coachingExportPolicy() : {};
  var h = '<div class="fade">';
  h += coachingSectionHead('Gizlilik ve Dışa Aktarma',
    'Koçluk verisi genel yedeğe hiçbir zaman karışmaz.',
    '<button class="btn btn-s" onclick="coachingBackHome()">Geri</button>');
  if(COACHING_UI.error) h += coachingBanner('error', COACHING_UI.error);
  if(COACHING_UI.notice) h += coachingBanner('info', COACHING_UI.notice);
  h += '<div class="card" style="padding:16px 18px;margin-bottom:14px">'+
    '<p style="font-weight:700;font-size:13px;margin-bottom:8px">Ne dahil, ne değil</p>'+
    '<ul style="font-size:12.5px;color:var(--t2);line-height:1.9;padding-left:18px">'+
    '<li><b>Yalnız özet</b> — bağlam, durum, sayaçlar ve ay bilgisi. Ad, etiket veya not yok.</li>'+
    '<li><b>Kimliksizleştirilmiş</b> — öğrenme için türetilmiş gözlem; kişiye geri götürmez.</li>'+
    '<li><b>Tam dışa aktarım</b> — sahibindeki her şey; <b>parola zorunludur</b>, şifresiz yapılamaz.</li>'+
    '<li><b>Transkript hiçbir kapsamda dışa aktarılmaz.</b></li></ul></div>';
  h += '<div class="card" style="padding:16px 18px">'+
    '<p style="font-weight:700;font-size:13px;margin-bottom:10px">Dışa aktar</p>'+
    '<div><p class="lbl" style="margin-bottom:4px">Kapsam</p>'+
    '<select class="inp" id="coach_export_scope" style="margin-bottom:10px">'+
    '<option value="metadata_only">Yalnız özet (önerilen)</option>'+
    '<option value="deidentified_derived">Kimliksizleştirilmiş türev</option>'+
    '<option value="full_owner_export">Tam dışa aktarım (şifreli)</option></select></div>'+
    '<div><p class="lbl" style="margin-bottom:4px">Parola (yalnız tam dışa aktarım için)</p>'+
    '<input class="inp" id="coach_export_pass" type="password" autocomplete="new-password" '+
    'placeholder="Parolayı bir yerde sakla — kaybolursa dosya açılamaz" style="margin-bottom:12px"></div>'+
    '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;cursor:pointer;margin-bottom:12px">'+
    '<input type="checkbox" class="cb" id="coach_export_consent"> '+
    '<span>Bu dışa aktarımı bilerek istiyorum ve dosyanın sorumluluğunu alıyorum.</span></label>'+
    '<button class="btn btn-p" id="coach_export_btn" onclick="coachingRunExport()">Dosyayı Oluştur</button>'+
    '<p style="font-size:11px;color:var(--t3);margin-top:10px">Parola hiçbir yerde saklanmaz ve ekrana yazılmaz.</p>'+
    '</div>';
  h += '</div>';
  sh('pinner', h);
}
async function coachingRunExport(){
  var scope = (ge('coach_export_scope')||{}).value || 'metadata_only';
  var pass = (ge('coach_export_pass')||{}).value || '';
  var consent = !!((ge('coach_export_consent')||{}).checked);
  COACHING_UI.error = null; COACHING_UI.notice = null;
  var list = await coachingListSessions({limit:100});
  if(!list.ok){ COACHING_UI.error = coachingErrorText(list.error); renderCoachingPrivacy(); return; }
  var res = await coachingBuildExport(list.sessions, {scope:scope, explicitConsent:consent, passphrase:pass||undefined});
  if(!res.ok){
    COACHING_UI.error = res.error==='explicit_user_action_required' ? 'Devam etmek için onay kutusunu işaretle.'
      : res.error==='passphrase_required_for_this_scope' ? 'Tam dışa aktarım için parola zorunlu.'
      : coachingErrorText(res.error);
    renderCoachingPrivacy(); return;
  }
  if(typeof U!=='undefined' && U.dl) U.dl(res.envelope, 'FocusUp_Kocluk_'+scope+'.json');
  COACHING_UI.notice = 'Dosya oluşturuldu ('+res.envelope.recordCount+' kayıt, '+
    (res.envelope.encrypted?'şifreli':'şifresiz — kişisel içerik yok')+').';
  var pf = ge('coach_export_pass'); if(pf) pf.value = '';
  renderCoachingPrivacy();
}
window.coachingRunExport = coachingRunExport;

function coachingWorkspaceSelfCheck(){
  return { version:COACHING_UI_VERSION, enabled:(typeof coachingEnabled==='function')?coachingEnabled():false,
    view:COACHING_UI.view, labelMaps:['context','lifecycle','decision','type','consent','stage'],
    navInjected:!!coachingWorkspaceSelfCheck._nav };
}

/* ── Navigation: injected ONLY when the flag is on. Flag OFF → nothing. ── */
(function(){
  if(typeof coachingEnabled!=='function' || !coachingEnabled()) return;
  if(typeof NAV==='undefined' || !Array.isArray(NAV)) return;
  for(var i=0;i<NAV.length;i++){
    if(NAV[i].sec!=='secKnow') continue;
    var items = NAV[i].items;
    /* One Koçluk destination, not two competing ones. The professional
       workspace REPLACES the legacy entry in the menu; the legacy route and
       D.coaching records stay exactly where they are and remain reachable
       from the workspace as an archive. */
    for(var j=0;j<items.length;j++){
      if(items[j].id==='coaching'){ items[j] = {id:'coachhome', l:'Koçluk', i:'us'}; coachingWorkspaceSelfCheck._nav = true; break; }
    }
    if(!coachingWorkspaceSelfCheck._nav){ items.push({id:'coachhome', l:'Koçluk', i:'us'}); coachingWorkspaceSelfCheck._nav = true; }
    /* Phase 7: Akademi is a real destination, added once, right after Koçluk.
       Only live surfaces appear here — nothing is listed to fill the menu. */
    if(!coachingWorkspaceSelfCheck._navAcademy){
      var hasAcademy = false;
      for(var a=0;a<items.length;a++){ if(items[a].id==='academy'){ hasAcademy = true; break; } }
      if(!hasAcademy){
        var at = -1;
        for(var b=0;b<items.length;b++){ if(items[b].id==='coachhome'){ at = b; break; } }
        var entry = {id:'academy', l:'Akademi', i:'bk'};
        if(at>=0) items.splice(at+1, 0, entry); else items.push(entry);
      }
      coachingWorkspaceSelfCheck._navAcademy = true;
    }
    break;
  }
})();

if(typeof window!=='undefined'){
  window.COACHING_UI_VERSION=COACHING_UI_VERSION; window.COACHING_UI=COACHING_UI;
  window.COACHING_L_CONTEXT=COACHING_L_CONTEXT; window.COACHING_L_LIFECYCLE=COACHING_L_LIFECYCLE;
  window.COACHING_L_DECISION=COACHING_L_DECISION; window.COACHING_L_TYPE=COACHING_L_TYPE;
  window.COACHING_L_CONSENT=COACHING_L_CONSENT; window.COACHING_L_STAGE=COACHING_L_STAGE;
  window.COACHING_L_ERROR=COACHING_L_ERROR;
  window.coachingLabel=coachingLabel; window.coachingApproachLabel=coachingApproachLabel;
  window.coachingErrorText=coachingErrorText; window.coachingElapsed=coachingElapsed;
  window.coachingBanner=coachingBanner; window.coachingSectionHead=coachingSectionHead;
  window.coachingStatusPill=coachingStatusPill; window.coachingUiReset=coachingUiReset;
  window.coachingLoadHome=coachingLoadHome; window.renderCoachingPast=renderCoachingPast;
  window.renderCoachingPrivacy=renderCoachingPrivacy;
  window.coachingWorkspaceSelfCheck=coachingWorkspaceSelfCheck;
}
