/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 7f: ACADEMY UI

   Four calm screens: home, a learning unit, a path, and the ICF development
   view. One screen, one purpose. No dashboards, no metric walls, no badges,
   no percentages pretending to measure competence.

   Progressive disclosure does the heavy lifting: a unit opens with what to
   learn, and the sources, evidence grade and full principle list stay folded
   until asked for.
   ══════════════════════════════════════════════════════════════════════════ */

var ACADEMY_UI = { view:'home', unitId:null, pathId:null, records:[], observations:[],
  recommendations:[], checkId:null, checkAnswer:null, error:null, notice:null,
  /* what the coach has typed into the reflection box but not yet saved.
     Memory only, one unit at a time: a refused write must never destroy it. */
  reflectDraft:null, busy:false };

function _aue(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _auHead(title, sub, right){
  return (typeof coachingSectionHead==='function')
    ? coachingSectionHead(title, sub, right||'')
    : '<h2>'+_aue(title)+'</h2><p>'+_aue(sub)+'</p>';
}
function _auBanner(kind, text){
  return (typeof coachingBanner==='function') ? coachingBanner(kind, text)
    : '<div class="card">'+_aue(text)+'</div>';
}
function _auNotices(){
  var h = '';
  if(ACADEMY_UI.error) h += _auBanner('error', ACADEMY_UI.error);
  if(ACADEMY_UI.notice) h += _auBanner('info', ACADEMY_UI.notice);
  return h;
}
var _AU_CARD = 'class="card" style="padding:16px 18px;margin-bottom:12px"';
var _AU_MUTED = 'style="font-size:11.5px;color:var(--t3)"';

function _auStatePill(state){
  var l = ACADEMY_STATE_LABEL[state] || state;
  if(state==='NOT_STARTED') return '';
  var c = (state==='APPLIED') ? 'p-green' : (state==='REVISIT' ? 'p-orange' : 'p-blue');
  return '<span class="pill '+c+'" style="font-size:10px">'+_aue(l)+'</span>';
}

/* ── HOME ─────────────────────────────────────────────────────────────────── */
async function academyLoadHome(){
  ACADEMY_UI.busy = true;
  var r = await academyLoadRecords();
  if(r.ok){ ACADEMY_UI.records = r.records; ACADEMY_UI.error = null; }
  else { ACADEMY_UI.records = []; ACADEMY_UI.error = (typeof coachingErrorText==='function')
    ? coachingErrorText(r.error, r.reason) : 'Yüklenemedi.'; }
  /* observations are the mirror's, read through the mirror's own bounded API */
  ACADEMY_UI.observations = [];
  if(typeof coachingListSessions==='function' && typeof coachingLoadObservations==='function'){
    var s = await coachingListSessions({limit:12});
    if(s.ok){
      for(var i=0;i<s.sessions.length && i<12;i++){
        var o = await coachingLoadObservations(s.sessions[i].id);
        if(o.ok) ACADEMY_UI.observations = ACADEMY_UI.observations.concat(o.observations);
      }
    }
  }
  var active = (typeof coachingActivePractice==='function')
    ? coachingActivePractice(ACADEMY_UI.records) : null;
  var ev = academyGatherEvidence(ACADEMY_UI.observations, ACADEMY_UI.records, active);
  ACADEMY_UI.recommendations = academyRecommend(ev, ACADEMY_UI.records);
  ACADEMY_UI.busy = false;
}

function renderAcademyHome(){
  ACADEMY_UI.view = 'home';
  var recs = ACADEMY_UI.records;
  var states = academyStateMap(recs);
  var prog = academyProgress(recs);
  var h = '<div class="fade" style="max-width:780px">';
  h += _auHead('Akademi', 'Okumak yetmez — öğren, dene, gerçek görüşmede uygula, sonra aynaya bak.');
  h += _auNotices();

  /* continue where the coach actually is */
  var current = ACADEMY_UNIT_ORDER.filter(function(id){
    return states[id]==='IN_PROGRESS' || states[id]==='PRACTICING'; })[0];
  if(current){
    var cu = academyUnit(current);
    h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>DEVAM EDİYORSUN</p>'+
      '<p style="font-size:15px;font-weight:600;margin-top:6px">'+_aue(cu.title)+'</p>'+
      '<p '+_AU_MUTED+' >'+_aue(cu.purpose)+'</p>'+
      '<button class="btn btn-p btn-s" style="margin-top:10px" onclick="academyOpenUnit(\''+_aue(cu.unitId)+'\')">Devam et</button></div>';
  }

  /* at most three, each one able to say why it is here */
  if(ACADEMY_UI.recommendations.length){
    h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>SANA ÖNERİLEN</p>';
    ACADEMY_UI.recommendations.forEach(function(r){
      h += '<div style="padding:10px 0;border-bottom:1px solid var(--s2)">'+
        '<p style="font-size:14px;font-weight:600">'+_aue(r.title)+'</p>'+
        '<p '+_AU_MUTED+'>'+_aue(r.reason)+'</p>'+
        '<details style="margin-top:5px"><summary style="font-size:11.5px;color:var(--blue);cursor:pointer">Neden bunu öneriyor?</summary>'+
        '<p '+_AU_MUTED+' style="margin-top:5px">'+_aue(r.why)+'</p></details>'+
        '<div style="display:flex;gap:8px;margin-top:8px">'+
        '<button class="btn btn-s" onclick="academyOpenUnit(\''+_aue(r.unitId)+'\')">Aç</button>'+
        '<button class="btn btn-s" onclick="academyDismiss(\''+_aue(r.unitId)+'\')">Şimdi değil</button>'+
        '</div></div>';
    });
    h += '</div>';
  }

  h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>ÖĞRENME YOLLARI</p>';
  academyPaths().forEach(function(p){
    var done = p.unitIds.filter(function(id){ return states[id]!=='NOT_STARTED'; }).length;
    h += '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:8px" '+
      'onclick="academyOpenPath(\''+_aue(p.pathId)+'\')">'+
      '<span style="font-weight:600">'+_aue(p.title)+'</span> '+
      '<span '+_AU_MUTED+'>· '+done+'/'+p.unitIds.length+' ünitede ilerleme</span></button>';
  });
  h += '</div>';

  h += '<div '+_AU_CARD+'>'+
    '<p '+_AU_MUTED+'>'+prog.total+' ünite · '+prog.started+' başlandı · '+prog.applied+' gerçek görüşmede denendi</p>'+
    '<p '+_AU_MUTED+' style="margin-top:6px">Burada yüzde yok: denemek, bilmekten daha çok şey anlatır.</p>'+
    '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+
    '<button class="btn btn-s" onclick="academyOpenIcf()">ICF gelişim alanları</button>'+
    '<button class="btn btn-s" onclick="gotoTab(\'coachdev\')">Gelişimim</button></div></div>';

  h += '<p '+_AU_MUTED+'>'+_aue(ACADEMY_DISCLAIMER)+'</p>';
  h += '</div>';
  sh('pinner', h);
}
window.renderAcademyHome = renderAcademyHome;

/* ── UNIT ─────────────────────────────────────────────────────────────────── */
function academyOpenUnit(unitId){
  if(!academyUnit(unitId)) return;
  if(ACADEMY_UI.reflectDraft && ACADEMY_UI.reflectDraft.unitId!==unitId) ACADEMY_UI.reflectDraft = null;
  ACADEMY_UI.unitId = unitId; ACADEMY_UI.view = 'unit';
  ACADEMY_UI.checkId = null; ACADEMY_UI.checkAnswer = null;
  ACADEMY_UI.error = null; ACADEMY_UI.notice = null;
  var st = academyUnitStateOf(ACADEMY_UI.records, unitId);
  if(st==='NOT_STARTED') academySetState(unitId, 'IN_PROGRESS', true);
  renderAcademyUnit();
}
window.academyOpenUnit = academyOpenUnit;

function _auLines(title, list, bullet){
  if(!list || !list.length) return '';
  var h = '<p style="font-size:12px;font-weight:600;margin-top:12px">'+_aue(title)+'</p><ul style="margin:6px 0 0 16px">';
  list.forEach(function(x){ h += '<li style="font-size:12.5px;line-height:1.65;margin-bottom:4px">'+(bullet||'')+_aue(x)+'</li>'; });
  return h+'</ul>';
}

function renderAcademyUnit(){
  var u = academyUnit(ACADEMY_UI.unitId);
  if(!u){ renderAcademyHome(); return; }
  ACADEMY_UI.view = 'unit';
  var state = academyUnitStateOf(ACADEMY_UI.records, u.unitId);
  var h = '<div class="fade" style="max-width:760px">';
  h += _auHead(u.title, u.purpose,
    '<button class="btn btn-s" onclick="academyBackHome()">Geri</button>');
  h += _auNotices();
  h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">'+
    '<span class="pill p-gray" style="font-size:10px">'+_aue(ACADEMY_LEVEL_LABEL[u.level]||u.level)+'</span>'+
    _auStatePill(state)+'</div>';

  /* ÖĞREN */
  h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>ÖĞREN</p>';
  h += _auLines('Bu çalışmada', u.objectives);
  h += _auLines('İlkeler', u.principles);
  h += '</div>';

  /* FARK ET — what stronger and weaker practice look like, then the pairs */
  if(u.moments.length || u.goodPractice.length || u.weakPractice.length){
    h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>FARK ET</p>';
    h += _auLines('Güçlü uygulama', u.goodPractice);
    h += _auLines('Zayıf uygulama', u.weakPractice);
    u.moments.forEach(function(m){
      h += '<div style="padding:10px 0;border-top:1px solid var(--s2)">'+
        '<p style="font-size:12.5px"><span class="pill p-orange" style="font-size:10px">Zayıf</span> '+_aue(m.weak)+'</p>'+
        '<p style="font-size:12.5px;margin-top:6px"><span class="pill p-green" style="font-size:10px">Daha güçlü</span> '+_aue(m.better)+'</p>'+
        '<p '+_AU_MUTED+' style="margin-top:6px">'+_aue(m.why)+'</p></div>';
    });
    if(u.moments.length) h += '<p '+_AU_MUTED+' style="margin-top:8px">Bunlar örnektir, kalıp değil. Bir görüşmede güçlü olan cümle başka bir görüşmede yanlış olabilir.</p>';
    h += '</div>';
  }

  /* DENE — the canonical Phase 6 practice, not a second tracker */
  if(u.practiceIds.length){
    var pd = (typeof coachingPracticeDef==='function') ? coachingPracticeDef(u.practiceIds[0]) : null;
    h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>DENE</p>'+
      '<p style="font-size:13px;margin-top:6px">'+_aue(pd?pd.instruction:u.realSessionApplication[0]||'')+'</p>'+
      '<button class="btn btn-p btn-s" style="margin-top:10px" onclick="academyAdopt(\''+_aue(u.unitId)+'\')">Bir sonraki görüşmede bunu dene</button>'+
      '<p '+_AU_MUTED+' style="margin-top:8px">Aynı anda tek bir kasıtlı pratik tutulur.</p></div>';
  }

  /* DÜŞÜN — private, optional, short */
  var refl = academyReflectionFor(ACADEMY_UI.records, u.unitId);
  var draft = (ACADEMY_UI.reflectDraft && ACADEMY_UI.reflectDraft.unitId===u.unitId)
    ? ACADEMY_UI.reflectDraft.body : null;
  var reflectValue = (draft!=null) ? draft : (refl ? refl.body : '');
  h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>DÜŞÜN</p>';
  h += _auLines('', u.reflectionPrompts);
  h += '<textarea class="inp" id="academy_reflect" rows="3" placeholder="Kısa ve yalnız sana açık."'+
    ' style="margin-top:8px">'+_aue(reflectValue)+'</textarea>'+
    '<button class="btn btn-s" style="margin-top:8px" onclick="academySaveReflectionNow()">Kaydet</button></div>';

  /* GERÇEK GÖRÜŞMEDE UYGULA */
  if(u.realSessionApplication.length){
    h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>GERÇEK GÖRÜŞMEDE UYGULA</p>';
    h += _auLines('', u.realSessionApplication);
    h += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+
      '<button class="btn btn-s" onclick="academyReportApplied(\''+_aue(u.unitId)+'\',\'EVET\')">Denedim</button>'+
      '<button class="btn btn-s" onclick="academyReportApplied(\''+_aue(u.unitId)+'\',\'KISMEN\')">Kısmen</button>'+
      '<button class="btn btn-s" onclick="academyReportApplied(\''+_aue(u.unitId)+'\',\'HAYIR\')">Henüz değil</button></div>'+
      '<p '+_AU_MUTED+' style="margin-top:8px">Bu senin kendi bildirimindir; bir ölçüm değildir ve ustalık anlamına gelmez.</p></div>';
  }

  /* AYNA */
  if(u.mirrorLinks.length){
    h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>AYNA İLE BAĞLANTISI</p>'+
      '<p style="font-size:12.5px;margin-top:6px">Bu çalışma şu gözlem alanlarıyla ilişkili: '+
      _aue(u.mirrorLinks.map(function(c){ return (typeof COACHING_ICF_AREA!=='undefined' && COACHING_ICF_AREA[c])||c; })
        .filter(function(v,i,a){ return a.indexOf(v)===i; }).join(' · '))+'</p>'+
      '<button class="btn btn-s" style="margin-top:10px" onclick="gotoTab(\'coachdev\')">Gelişimim</button></div>';
  }

  /* knowledge check */
  var checks = academyChecksFor(u.unitId);
  if(checks.length) h += _auRenderCheck(checks[0]);

  /* sources folded away by default */
  h += '<details '+_AU_CARD.replace('class="card" ','class="card" ')+'><summary style="font-size:12px;cursor:pointer">Kaynaklar ve kanıt düzeyi</summary>'+
    '<p '+_AU_MUTED+' style="margin-top:8px">Kanıt düzeyi: '+_aue(u.evidenceGrade)+' — '+
    _aue((academyEvidenceGrades()||{})[u.evidenceGrade]||'')+'</p>';
  if(u.sourceRefs.length && typeof coachingSource==='function'){
    h += '<ul style="margin:8px 0 0 16px">';
    u.sourceRefs.forEach(function(sid){
      var s = coachingSource(sid);
      if(!s) return;
      h += '<li '+_AU_MUTED+' style="margin-bottom:4px">'+_aue(s.title)+' — '+_aue(s.issuingBody)+
        (s.verified ? '' : ' <span class="pill p-orange" style="font-size:9.5px">doğrulanmadı</span>')+'</li>';
    });
    h += '</ul>';
  }
  h += '<p '+_AU_MUTED+' style="margin-top:8px">'+_aue(ACADEMY_DISCLAIMER)+'</p></details>';
  h += '</div>';
  sh('pinner', h);
}
window.renderAcademyUnit = renderAcademyUnit;

function _auRenderCheck(c){
  var h = '<div '+_AU_CARD+'><p '+_AU_MUTED+'>KENDİNİ DENE</p>'+
    '<p style="font-size:12.5px;margin-top:6px">'+_aue(c.scenario)+'</p>'+
    '<p style="font-size:13px;font-weight:600;margin-top:8px">'+_aue(c.question)+'</p>';
  var ans = (ACADEMY_UI.checkId===c.checkId) ? ACADEMY_UI.checkAnswer : null;
  c.options.forEach(function(o){
    var picked = ans && ans.chosen && ans.chosen.key===o.key;
    h += '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:8px'+
      (picked?';border-color:var(--blue)':'')+'" '+
      'onclick="academyAnswer(\''+_aue(c.checkId)+'\',\''+o.key+'\')">'+_aue(o.text)+'</button>';
    if(ans) h += '<p '+_AU_MUTED+' style="margin:6px 0 0 6px">'+
      (o.best?'<span class="pill p-green" style="font-size:9.5px">daha güçlü</span> ':'')+_aue(o.why)+'</p>';
  });
  if(ans) h += '<p '+_AU_MUTED+' style="margin-top:10px">Burada puan yoktur. Yanlış seçenek de bir öğrenme fırsatıdır.</p>';
  return h+'</div>';
}

/* ── PATH ─────────────────────────────────────────────────────────────────── */
function academyOpenPath(pathId){
  if(!academyPath(pathId)) return;
  ACADEMY_UI.pathId = pathId; ACADEMY_UI.view = 'path';
  ACADEMY_UI.error = null; ACADEMY_UI.notice = null;
  renderAcademyPath();
}
window.academyOpenPath = academyOpenPath;

function renderAcademyPath(){
  var p = academyPath(ACADEMY_UI.pathId);
  if(!p){ renderAcademyHome(); return; }
  ACADEMY_UI.view = 'path';
  var states = academyStateMap(ACADEMY_UI.records);
  var h = '<div class="fade" style="max-width:720px">';
  h += _auHead(p.title, p.purpose, '<button class="btn btn-s" onclick="academyBackHome()">Geri</button>');
  h += _auNotices();
  h += '<div '+_AU_CARD+'>';
  p.unitIds.forEach(function(id){
    var u = academyUnit(id); if(!u) return;
    h += '<div style="padding:10px 0;border-bottom:1px solid var(--s2)">'+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
      '<span style="font-size:13.5px;font-weight:600">'+_aue(u.title)+'</span>'+_auStatePill(states[id])+'</div>'+
      '<p '+_AU_MUTED+' style="margin-top:4px">'+_aue(u.purpose)+'</p>'+
      '<button class="btn btn-s" style="margin-top:8px" onclick="academyOpenUnit(\''+_aue(id)+'\')">Aç</button></div>';
  });
  h += '<p '+_AU_MUTED+' style="margin-top:10px">Yol bir sıra önerir; kilit değildir. İstediğin üniteden başlayabilirsin.</p>';
  h += '</div></div>';
  sh('pinner', h);
}
window.renderAcademyPath = renderAcademyPath;

/* ── ICF DEVELOPMENT VIEW ─────────────────────────────────────────────────── */
function academyOpenIcf(){ ACADEMY_UI.view='icf'; ACADEMY_UI.error=null; renderAcademyIcf(); }
window.academyOpenIcf = academyOpenIcf;

function renderAcademyIcf(){
  ACADEMY_UI.view = 'icf';
  var areas = {};
  ACADEMY_UNIT_ORDER.forEach(function(id){
    var u = academyUnit(id);
    u.competencyTags.forEach(function(t){ (areas[t] = areas[t] || []).push(u); });
  });
  var h = '<div class="fade" style="max-width:760px">';
  h += _auHead('ICF gelişim alanları', 'Yetkinlik alanları, gözlemlenebilir davranışlar ve ilgili çalışmalar.',
    '<button class="btn btn-s" onclick="academyBackHome()">Geri</button>');
  h += _auNotices();
  Object.keys(areas).forEach(function(area){
    h += '<div '+_AU_CARD+'><p style="font-size:14px;font-weight:600">'+_aue(area)+'</p>';
    var behaviours = [];
    areas[area].forEach(function(u){ behaviours = behaviours.concat(u.goodPractice.slice(0,2)); });
    h += _auLines('Gözlemlenebilir davranışlar', behaviours.slice(0,5));
    h += '<p style="font-size:12px;font-weight:600;margin-top:12px">İlgili çalışmalar</p>';
    areas[area].forEach(function(u){
      h += '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:6px" '+
        'onclick="academyOpenUnit(\''+_aue(u.unitId)+'\')">'+_aue(u.title)+'</button>';
    });
    h += '</div>';
  });
  h += '<div '+_AU_CARD+'><p '+_AU_MUTED+'>'+
    _aue((typeof COACHING_ICF_DISCLAIMER!=='undefined')?COACHING_ICF_DISCLAIMER:'')+'</p>'+
    '<p '+_AU_MUTED+' style="margin-top:6px">'+_aue(ACADEMY_DISCLAIMER)+'</p></div>';
  h += '</div>';
  sh('pinner', h);
}
window.renderAcademyIcf = renderAcademyIcf;

/* ── ACTIONS ──────────────────────────────────────────────────────────────── */
function academyBackHome(){ ACADEMY_UI.view='home'; ACADEMY_UI.error=null; ACADEMY_UI.notice=null; renderAcademyHome(); }
window.academyBackHome = academyBackHome;

function _auUpsert(rec){
  if(!rec) return;
  var i = -1;
  for(var k=0;k<ACADEMY_UI.records.length;k++){
    if(ACADEMY_UI.records[k] && ACADEMY_UI.records[k].id===rec.id){ i = k; break; } }
  if(i>=0) ACADEMY_UI.records[i] = rec; else ACADEMY_UI.records.push(rec);
}

async function academySetState(unitId, state, silent){
  var from = academyUnitStateOf(ACADEMY_UI.records, unitId);
  if(!academyCanTransition(from, state)) return;
  var res = await academySaveUnitState(unitId, state);
  if(!res.ok){
    ACADEMY_UI.error = (typeof coachingErrorText==='function')
      ? coachingErrorText(res.error, res.reason) : 'Kaydedilemedi.';
    if(!silent) renderAcademyUnit();
    return;
  }
  _auUpsert(res.record);
  ACADEMY_UI.error = null;
  if(!silent) renderAcademyUnit();
}
window.academySetState = academySetState;

async function academyAdopt(unitId){
  ACADEMY_UI.error = null;
  var res = await academyAdoptPractice(unitId);
  if(!res.ok){
    ACADEMY_UI.error = (typeof coachingErrorText==='function')
      ? coachingErrorText(res.error, res.reason) : 'Kaydedilemedi.';
    renderAcademyUnit(); return;
  }
  _auUpsert(res.practice); _auUpsert(res.unitState);
  ACADEMY_UI.notice = 'Bir sonraki görüşmen için kasıtlı pratiğin ayarlandı.';
  renderAcademyUnit();
}
window.academyAdopt = academyAdopt;

async function academySaveReflectionNow(){
  var el = ge('academy_reflect');
  var text = el ? (el.value||'') : '';
  /* capture BEFORE the write can fail — every path out of here re-renders,
     and a re-render draws the draft, not the DOM */
  ACADEMY_UI.reflectDraft = { unitId: ACADEMY_UI.unitId, body: text };
  if(!String(text).trim()){ ACADEMY_UI.notice='Yazacak bir şey yok.'; renderAcademyUnit(); return; }
  var res = await academySaveReflection(ACADEMY_UI.unitId, text);
  if(!res.ok){
    ACADEMY_UI.error = (typeof coachingErrorText==='function')
      ? coachingErrorText(res.error, res.reason) : 'Kaydedilemedi.';
    renderAcademyUnit(); return;              /* draft kept: the words stay */
  }
  _auUpsert(res.record);
  ACADEMY_UI.reflectDraft = null;             /* stored — the draft is done */
  ACADEMY_UI.error = null; ACADEMY_UI.notice = 'Yansıman kaydedildi. Yalnız sana açık.';
  renderAcademyUnit();
}
window.academySaveReflectionNow = academySaveReflectionNow;

async function academyReportApplied(unitId, answer){
  ACADEMY_UI.error = null;
  var from = academyUnitStateOf(ACADEMY_UI.records, unitId);
  var target = (answer==='HAYIR') ? 'REVISIT' : 'APPLIED';
  if(!academyCanTransition(from, target)) target = from;
  var res = await academySaveUnitState(unitId, target, {appliedSelfReport:answer});
  if(!res.ok){
    ACADEMY_UI.error = (typeof coachingErrorText==='function')
      ? coachingErrorText(res.error, res.reason) : 'Kaydedilemedi.';
    renderAcademyUnit(); return;
  }
  _auUpsert(res.record);
  ACADEMY_UI.notice = (answer==='HAYIR')
    ? 'Not aldık. Hazır olduğunda tekrar bakarsın.'
    : 'Kendi bildirimin kaydedildi — denemek, ustalık demek değildir.';
  renderAcademyUnit();
}
window.academyReportApplied = academyReportApplied;

function academyAnswer(checkId, key){
  ACADEMY_UI.checkId = checkId;
  ACADEMY_UI.checkAnswer = academyAnswerCheck(checkId, key);
  renderAcademyUnit();
}
window.academyAnswer = academyAnswer;

async function academyDismiss(unitId){
  ACADEMY_UI.recommendations = ACADEMY_UI.recommendations.filter(function(r){ return r.unitId!==unitId; });
  ACADEMY_UI.notice = 'Bu öneri şimdilik gizlendi.';
  renderAcademyHome();
}
window.academyDismiss = academyDismiss;

if(typeof window!=='undefined'){
  window.ACADEMY_UI=ACADEMY_UI; window.academyLoadHome=academyLoadHome;
}
