/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 8e: KİTAPLIK UI

   Two screens: the library and one book. No covers, no stars, no bestseller
   badges, no carousels, no "12 books this year" — none of which would tell a
   coach anything true about their coaching. The library shows what is in hand,
   what is next, and at most three explainable suggestions.

   The reflection box follows the rule the close form and the Academy both
   arrived at: a refused write may never destroy what the coach typed.
   ══════════════════════════════════════════════════════════════════════════ */

var BOOKS_UI = { view:'home', bookId:null, records:[], observations:[],
  recommendations:[], filter:null, error:null, notice:null,
  reflectDraft:null, busy:false };

function _bue(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _buHead(title, sub, right){
  return (typeof coachingSectionHead==='function')
    ? coachingSectionHead(title, sub, right||'') : '<h2>'+_bue(title)+'</h2>';
}
function _buNotices(){
  var h = '';
  if(BOOKS_UI.error && typeof coachingBanner==='function') h += coachingBanner('error', BOOKS_UI.error);
  if(BOOKS_UI.notice && typeof coachingBanner==='function') h += coachingBanner('info', BOOKS_UI.notice);
  return h;
}
var _BU_CARD = 'class="card" style="padding:16px 18px;margin-bottom:12px"';
var _BU_MUTED = 'style="font-size:11.5px;color:var(--t3)"';

function _buAuthors(b){ return b.authors.join(', '); }
function _buStatePill(state){
  if(!state) return '';
  var c = (state==='READ'||state==='APPLYING') ? 'p-green' : (state==='REVISIT' ? 'p-orange' : 'p-blue');
  return '<span class="pill '+c+'" style="font-size:10px">'+_bue(BOOK_STATE_LABEL[state]||state)+'</span>';
}
function _buGradePill(b){
  var grades = (typeof COACHING_EVIDENCE_GRADES!=='undefined') ? COACHING_EVIDENCE_GRADES : {};
  var c = (b.evidenceGrade==='A') ? 'p-green' : (b.evidenceGrade==='D' ? 'p-red' : 'p-gray');
  return '<span class="pill '+c+'" style="font-size:10px" title="'+_bue(grades[b.evidenceGrade]||'')+'">Kanıt '+
    _bue(b.evidenceGrade)+'</span>';
}
function _buRow(id, state){
  var b = book(id); if(!b) return '';
  return '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:8px" '+
    'onclick="booksOpen(\''+_bue(id)+'\')">'+
    '<span style="font-weight:600">'+_bue(b.title)+'</span> '+
    '<span '+_BU_MUTED+'>· '+_bue(_buAuthors(b))+'</span> '+_buStatePill(state)+'</button>';
}

/* ── LIBRARY ──────────────────────────────────────────────────────────────── */
async function booksLoadLibrary(){
  BOOKS_UI.busy = true;
  var r = await booksLoadRecords();
  if(r.ok){ BOOKS_UI.records = r.records; BOOKS_UI.error = null; }
  else {
    /* a failed read is not an empty library: keep whatever is already loaded */
    if(!Array.isArray(BOOKS_UI.records)) BOOKS_UI.records = [];
    BOOKS_UI.error = (typeof coachingErrorText==='function')
      ? coachingErrorText(r.error, r.reason) : 'Yüklenemedi.';
  }
  BOOKS_UI.observations = [];
  if(typeof coachingListSessions==='function' && typeof coachingLoadObservations==='function'){
    var s = await coachingListSessions({limit:12});
    if(s.ok){
      for(var i=0;i<s.sessions.length && i<12;i++){
        var o = await coachingLoadObservations(s.sessions[i].id);
        if(o.ok) BOOKS_UI.observations = BOOKS_UI.observations.concat(o.observations);
      }
    }
  }
  BOOKS_UI.recommendations = booksRecommend(booksContext(), BOOKS_UI.records);
  BOOKS_UI.busy = false;
}
window.booksLoadLibrary = booksLoadLibrary;

/* What the engine is allowed to know: structured state only. */
function booksContext(){
  var academyRecords = BOOKS_UI.records;
  var activePractice = (typeof coachingActivePractice==='function')
    ? coachingActivePractice(academyRecords) : null;
  var unitId = null, pathId = null;
  if(typeof ACADEMY_UI!=='undefined' && ACADEMY_UI.unitId) unitId = ACADEMY_UI.unitId;
  if(typeof ACADEMY_UI!=='undefined' && ACADEMY_UI.pathId) pathId = ACADEMY_UI.pathId;
  if(!unitId && typeof academyStateMap==='function'){
    var st = academyStateMap(academyRecords);
    var inProgress = (typeof ACADEMY_UNIT_ORDER!=='undefined' ? ACADEMY_UNIT_ORDER : [])
      .filter(function(id){ return st[id]==='IN_PROGRESS' || st[id]==='PRACTICING'; });
    if(inProgress.length) unitId = inProgress[0];
  }
  var codes = {};
  (BOOKS_UI.observations||[]).forEach(function(o){
    if(!o || !o.code) return;
    if(!codes[o.code]) codes[o.code] = { code:o.code, category:o.category||null,
      type:o.observationType||'NEUTRAL', sessions:{} };
    if(o.sessionId) codes[o.code].sessions[o.sessionId] = true;
  });
  var list = Object.keys(codes).map(function(k){
    var e = codes[k];
    e.sessionCount = Object.keys(e.sessions).length || 1;
    delete e.sessions; return e;
  });
  return { academyUnitId:unitId, pathId:pathId, activePractice:activePractice, observationCodes:list };
}
window.booksContext = booksContext;

function renderBooksLibrary(){
  BOOKS_UI.view = 'home';
  var recs = BOOKS_UI.records;
  var shelves = booksShelves(recs);
  var states = booksStateMap(recs);
  var h = '<div class="fade" style="max-width:780px">';
  h += _buHead('Kitaplık', 'Okumak yetmez — okuduğunu bir sonraki görüşmede dene, sonra aynaya bak.');
  h += _buNotices();

  var primary = booksPrimary(recs);
  if(primary){
    h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>ŞİMDİ OKUYORUM</p>'+
      '<p style="font-size:15px;font-weight:600;margin-top:6px">'+_bue(primary.title)+'</p>'+
      '<p '+_BU_MUTED+'>'+_bue(_buAuthors(primary))+'</p>'+
      '<button class="btn btn-p btn-s" style="margin-top:10px" onclick="booksOpen(\''+_bue(primary.bookId)+'\')">Aç</button></div>';
  }
  var advice = booksLoadAdvice(recs);
  if(!advice.ok) h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>'+_bue(advice.text)+'</p></div>';

  if(BOOKS_UI.recommendations.length){
    h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>SANA ÖNERİLEN</p>';
    BOOKS_UI.recommendations.forEach(function(r){
      var b = book(r.bookId);
      h += '<div style="padding:10px 0;border-bottom:1px solid var(--s2)">'+
        '<p style="font-size:14px;font-weight:600">'+_bue(r.title)+'</p>'+
        '<p '+_BU_MUTED+'>'+_bue(_buAuthors(b))+' · '+_bue(r.reason)+'</p>'+
        '<details style="margin-top:5px"><summary style="font-size:11.5px;color:var(--blue);cursor:pointer">Neden bunu öneriyor?</summary>'+
        '<p '+_BU_MUTED+' style="margin-top:5px">'+_bue(r.why)+'</p></details>'+
        '<div style="display:flex;gap:8px;margin-top:8px">'+
        '<button class="btn btn-s" onclick="booksOpen(\''+_bue(r.bookId)+'\')">Aç</button>'+
        '<button class="btn btn-s" onclick="booksDismiss(\''+_bue(r.bookId)+'\')">Şimdi değil</button>'+
        '</div></div>';
    });
    h += '</div>';
  }

  [['READING','Şimdi okuyorum'],['SAVED','Sonra oku'],['APPLYING','Uyguluyorum'],
   ['READ','Okuduklarım'],['REVISIT','Tekrar bak']].forEach(function(pair){
    if(!shelves[pair[0]].length) return;
    h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>'+_bue(pair[1].toUpperCase())+'</p>';
    shelves[pair[0]].forEach(function(id){ h += _buRow(id, states[id]); });
    h += '</div>';
  });

  h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>TÜM KİTAPLIK</p>';
  BOOK_CATEGORIES.forEach(function(cat){
    var list = booksByCategory(cat);
    if(!list.length) return;
    h += '<details style="margin-top:10px"><summary style="font-size:12.5px;font-weight:600;cursor:pointer">'+
      _bue(BOOK_CATEGORY_LABEL[cat]||cat)+' <span '+_BU_MUTED+'>('+list.length+')</span></summary>';
    list.forEach(function(b){ h += _buRow(b.bookId, states[b.bookId]); });
    h += '</details>';
  });
  h += '</div>';

  h += '<p '+_BU_MUTED+'>'+_bue(BOOKS_DISCLAIMER)+'</p>';
  h += '</div>';
  sh('pinner', h);
}
window.renderBooksLibrary = renderBooksLibrary;

/* ── ONE BOOK ─────────────────────────────────────────────────────────────── */
function booksOpen(bookId){
  if(!book(bookId)) return;
  if(BOOKS_UI.reflectDraft && BOOKS_UI.reflectDraft.bookId!==bookId) BOOKS_UI.reflectDraft = null;
  BOOKS_UI.bookId = bookId; BOOKS_UI.view = 'book';
  BOOKS_UI.error = null; BOOKS_UI.notice = null;
  renderBooksDetail();
}
window.booksOpen = booksOpen;

function _buLines(title, list){
  if(!list || !list.length) return '';
  var h = title ? '<p style="font-size:12px;font-weight:600;margin-top:12px">'+_bue(title)+'</p>' : '';
  h += '<ul style="margin:6px 0 0 16px">';
  list.forEach(function(x){ h += '<li style="font-size:12.5px;line-height:1.65;margin-bottom:4px">'+_bue(x)+'</li>'; });
  return h+'</ul>';
}

function renderBooksDetail(){
  var b = book(BOOKS_UI.bookId);
  if(!b){ renderBooksLibrary(); return; }
  BOOKS_UI.view = 'book';
  var state = booksStateOf(BOOKS_UI.records, b.bookId);
  var h = '<div class="fade" style="max-width:760px">';
  h += _buHead(b.title, (b.subtitle||_buAuthors(b)),
    '<button class="btn btn-s" onclick="booksBackLibrary()">Geri</button>');
  h += _buNotices();
  h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">'+
    '<span class="pill p-gray" style="font-size:10px">'+_bue(BOOK_CATEGORY_LABEL[b.category]||b.category)+'</span>'+
    '<span class="pill p-gray" style="font-size:10px">'+_bue(BOOK_AUDIENCE_LABEL[b.audienceLevel]||'')+'</span>'+
    _buGradePill(b)+_buStatePill(state)+'</div>';

  h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>NEDEN OKUMALI</p>'+
    '<p style="font-size:13px;margin-top:6px">'+_bue(b.whyRead)+'</p>'+
    '<p '+_BU_MUTED+' style="margin-top:6px">'+_bue(_buAuthors(b))+'</p>'+
    _buLines('Neyi geliştirmene yardım eder', b.whatItHelpsWith)+'</div>';

  h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>NEYE DİKKAT</p>'+
    '<p style="font-size:12.5px;margin-top:6px">'+_bue(b.evidenceNotes)+'</p>'+
    _buLines('Bu kitabın kanıtlamadığı şeyler', b.whatItDoesNotProve)+
    _buLines('Uyarılar', b.cautions)+
    _buLines('Ne zaman bu kitap değil', b.whenNotToChooseIt)+'</div>';

  if(b.academyUnitTags.length && typeof academyUnit==='function'){
    h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>AKADEMİ BAĞLANTISI</p>';
    b.academyUnitTags.forEach(function(uid){
      var u = academyUnit(uid); if(!u) return;
      h += '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:8px" '+
        'onclick="booksGotoUnit(\''+_bue(uid)+'\')">'+_bue(u.title)+'</button>';
    });
    h += '</div>';
  }

  if(b.applicationPrompts.length){
    h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>OKUDUKTAN SONRA DENE</p>';
    h += _buLines('', b.applicationPrompts);
    if(b.practiceIds.length)
      h += '<button class="btn btn-p btn-s" style="margin-top:10px" onclick="booksAdopt(\''+_bue(b.bookId)+'\')">Bir sonraki görüşmede bunu dene</button>'+
        '<p '+_BU_MUTED+' style="margin-top:8px">Aynı anda tek bir kasıtlı pratik tutulur.</p>';
    h += '</div>';
  }

  var refl = booksReflectionFor(BOOKS_UI.records, b.bookId);
  var draft = (BOOKS_UI.reflectDraft && BOOKS_UI.reflectDraft.bookId===b.bookId)
    ? BOOKS_UI.reflectDraft.body : null;
  h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>DÜŞÜN</p>'+
    _buLines('', b.reflectionPrompts)+
    '<textarea class="inp" id="books_reflect" rows="3" placeholder="Kısa ve yalnız sana açık." '+
    'style="margin-top:8px">'+_bue(draft!=null ? draft : (refl?refl.body:''))+'</textarea>'+
    '<button class="btn btn-s" style="margin-top:8px" onclick="booksSaveReflectionNow()">Kaydet</button></div>';

  h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>DURUM</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">';
  BOOK_STATES.forEach(function(s){
    var on = (state===s);
    h += '<button class="btn btn-s"'+(on?' style="border-color:var(--blue)"':'')+
      ' onclick="booksSetState(\''+_bue(b.bookId)+'\',\''+s+'\')">'+_bue(BOOK_STATE_LABEL[s])+'</button>';
  });
  h += '</div><p '+_BU_MUTED+' style="margin-top:8px">Bir kitabı bitirmek onu uyguladığın anlamına gelmez.</p></div>';

  if(b.relatedBooks.length){
    h += '<div '+_BU_CARD+'><p '+_BU_MUTED+'>İLGİLİ KİTAPLAR</p>';
    b.relatedBooks.forEach(function(id){ h += _buRow(id, booksStateOf(BOOKS_UI.records, id)); });
    h += '</div>';
  }

  h += '<details '+_BU_CARD+'><summary style="font-size:12px;cursor:pointer">Kaynak ve künye</summary>'+
    '<p '+_BU_MUTED+' style="margin-top:8px">'+_bue(b.title)+(b.subtitle?' — '+_bue(b.subtitle):'')+'<br>'+
    _bue(_buAuthors(b))+'<br>'+
    (b.publisher?_bue(b.publisher)+', ':'')+(b.publicationYear?b.publicationYear:'')+
    (b.editionNote?' ('+_bue(b.editionNote)+')':'')+
    (b.isbn13?'<br>ISBN '+_bue(b.isbn13):'')+'</p>'+
    '<p '+_BU_MUTED+' style="margin-top:6px">Künye '+(b.metadataVerified?'doğrulandı':'doğrulanmadı')+
    (b.verifiedAt?' ('+_bue(b.verifiedAt)+')':'')+'.</p>'+
    '<p '+_BU_MUTED+' style="margin-top:6px">'+_bue(BOOKS_DISCLAIMER)+'</p></details>';
  h += '</div>';
  sh('pinner', h);
}
window.renderBooksDetail = renderBooksDetail;

/* ── ACTIONS ──────────────────────────────────────────────────────────────── */
function booksBackLibrary(){
  BOOKS_UI.view='home'; BOOKS_UI.error=null; BOOKS_UI.notice=null; renderBooksLibrary();
}
window.booksBackLibrary = booksBackLibrary;

function booksGotoUnit(unitId){
  if(typeof academyOpenUnit!=='function' || typeof gotoTab!=='function') return;
  gotoTab('academy');
  academyOpenUnit(unitId);
}
window.booksGotoUnit = booksGotoUnit;

function _buUpsert(rec){
  if(!rec) return;
  var i = -1;
  for(var k=0;k<BOOKS_UI.records.length;k++){
    if(BOOKS_UI.records[k] && BOOKS_UI.records[k].id===rec.id){ i = k; break; } }
  if(i>=0) BOOKS_UI.records[i] = rec; else BOOKS_UI.records.push(rec);
}
function _buErr(res){
  return (typeof coachingErrorText==='function')
    ? coachingErrorText(res.error, res.reason) : 'Kaydedilemedi.';
}

async function booksSetState(bookId, state){
  var from = booksStateOf(BOOKS_UI.records, bookId);
  if(!booksCanTransition(from, state)){
    BOOKS_UI.notice = 'Bu geçiş yapılamaz.'; renderBooksDetail(); return;
  }
  var res = await booksSaveState(bookId, state);
  if(!res.ok){ BOOKS_UI.error = _buErr(res); renderBooksDetail(); return; }
  _buUpsert(res.record);
  BOOKS_UI.error = null; BOOKS_UI.notice = null;
  renderBooksDetail();
}
window.booksSetState = booksSetState;

async function booksAdopt(bookId){
  BOOKS_UI.error = null;
  var res = await booksAdoptPractice(bookId);
  if(!res.ok){ BOOKS_UI.error = _buErr(res); renderBooksDetail(); return; }
  _buUpsert(res.practice); _buUpsert(res.bookState);
  BOOKS_UI.notice = 'Bir sonraki görüşmen için kasıtlı pratiğin ayarlandı.';
  renderBooksDetail();
}
window.booksAdopt = booksAdopt;

async function booksSaveReflectionNow(){
  var el = ge('books_reflect');
  var text = el ? (el.value||'') : '';
  /* capture BEFORE anything can refuse it — every path out re-renders */
  BOOKS_UI.reflectDraft = { bookId: BOOKS_UI.bookId, body: text };
  if(!String(text).trim()){ BOOKS_UI.notice = 'Yazacak bir şey yok.'; renderBooksDetail(); return; }
  var res = await booksSaveReflection(BOOKS_UI.bookId, text);
  if(!res.ok){ BOOKS_UI.error = _buErr(res); renderBooksDetail(); return; }  /* draft kept */
  _buUpsert(res.record);
  BOOKS_UI.reflectDraft = null;
  BOOKS_UI.error = null; BOOKS_UI.notice = 'Yansıman kaydedildi. Yalnız sana açık.';
  renderBooksDetail();
}
window.booksSaveReflectionNow = booksSaveReflectionNow;

async function booksDismiss(bookId){
  BOOKS_UI.recommendations = BOOKS_UI.recommendations.filter(function(r){ return r.bookId!==bookId; });
  var res = await booksDismissRecommendation(bookId);
  if(res.ok) _buUpsert(res.record);
  BOOKS_UI.notice = 'Bu öneri şimdilik gizlendi.';
  renderBooksLibrary();
}
window.booksDismiss = booksDismiss;

if(typeof window!=='undefined'){ window.BOOKS_UI=BOOKS_UI; }
