/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 8a: BOOKS DOMAIN

   A reading system, not a bookshelf. A book earns its place by serving a
   development goal, and every entry has to answer why it is here, which
   capability it supports, what it does NOT prove, and when it is the wrong
   choice. Fame is not a reason and popularity is not evidence.

   Like the Academy, this module references canonical authorities rather than
   restating them: competencies, approaches, interventions, Academy units,
   practices and paths are all pointers, checked by booksIntegrity().

   Copyright: this catalogue stores bibliographic facts and ORIGINAL writing
   about a book. It never stores the book. There are no chapter summaries, no
   excerpts and no substitute for reading — the guard below is enforced.
   ══════════════════════════════════════════════════════════════════════════ */

var BOOKS_VERSION = 1;

var BOOK_CATEGORIES = ['FOUNDATION','SKILL','ADVANCED','SCIENCE','CONTEXT','CAREER'];
var BOOK_CATEGORY_LABEL = {
  FOUNDATION:'Temel', SKILL:'Beceri', ADVANCED:'İleri',
  SCIENCE:'Kanıt ve bilim', CONTEXT:'Özel bağlam', CAREER:'Kariyer' };

var BOOK_AUDIENCE = ['BASLANGIC','GELISEN','ILERI'];
var BOOK_AUDIENCE_LABEL = { BASLANGIC:'Başlangıç', GELISEN:'Gelişen', ILERI:'İleri' };

/* Reading state. "Read" is not a competence claim, so there is no MASTERED
   and no state a machine may set on the coach's behalf. */
var BOOK_STATES = ['SAVED','READING','READ','APPLYING','REVISIT'];
var BOOK_STATE_LABEL = {
  SAVED:'Sonra oku', READING:'Şimdi okuyorum', READ:'Okudum',
  APPLYING:'Uyguluyorum', REVISIT:'Tekrar bak' };
var BOOK_TRANSITIONS = {
  SAVED:['READING','READ','REVISIT'],
  READING:['READ','SAVED','REVISIT','APPLYING'],
  READ:['APPLYING','REVISIT','READING'],
  APPLYING:['READ','REVISIT'],
  REVISIT:['READING','READ','APPLYING']
};

/* Reading is not the metric. One book at a time, with a short queue. */
var BOOK_PRIMARY_LIMIT = 1;
var BOOK_QUEUE_LIMIT = 2;
var BOOK_MAX_RECOMMENDATIONS = 3;
var BOOK_REFLECTION_MAX = 600;

var BOOKS_DISCLAIMER =
  'Bu kitaplık kitabın yerini almaz; okumaya yön verir. Burada bölüm özeti, ' +
  'alıntı derlemesi veya kitabın içeriğinin kopyası bulunmaz.';

var BOOK_LIMITS = { title:140, subtitle:160, line:320, author:80 };
function _bkStr(v,max){ return String(v==null?'':v).slice(0, max||BOOK_LIMITS.line); }
function _bkList(v,max,lim){
  if(!Array.isArray(v)) return [];
  return v.slice(0, max||10).map(function(x){ return _bkStr(x, lim); });
}
function _bkIds(v,max){
  if(!Array.isArray(v)) return [];
  return v.slice(0, max||12).map(function(x){ return _bkStr(x,64); });
}

var BOOKS = {};
var BOOK_ORDER = [];

/* Bibliographic facts are asserted only when they were actually checked.
   `metadataVerified:false` is an honest state, exactly as it is in the Phase 2
   source registry — a book whose facts cannot be established is excluded
   rather than guessed at. */
function booksRegister(bookId, def){
  def = def || {};
  var b = {
    bookId: _bkStr(bookId,64),
    version: Number(def.version)||1,
    title: _bkStr(def.title, BOOK_LIMITS.title),
    subtitle: def.subtitle ? _bkStr(def.subtitle, BOOK_LIMITS.subtitle) : null,
    authors: _bkList(def.authors, 6, BOOK_LIMITS.author),
    publicationYear: (typeof def.publicationYear==='number') ? def.publicationYear : null,
    editionNote: def.editionNote ? _bkStr(def.editionNote,80) : null,
    publisher: def.publisher ? _bkStr(def.publisher,80) : null,
    isbn13: def.isbn13 ? _bkStr(def.isbn13,20) : null,
    metadataVerified: def.metadataVerified===true,
    verifiedAt: def.verifiedAt ? _bkStr(def.verifiedAt,32) : null,
    verificationBasis: def.verificationBasis ? _bkStr(def.verificationBasis,80) : null,
    category: BOOK_CATEGORIES.indexOf(def.category)>=0 ? def.category : 'SKILL',
    audienceLevel: BOOK_AUDIENCE.indexOf(def.audienceLevel)>=0 ? def.audienceLevel : 'GELISEN',
    /* references, never definitions */
    competencyTags: _bkIds(def.competencyTags, 6),
    approachTags: _bkIds(def.approachTags, 6),
    interventionTags: _bkIds(def.interventionTags, 6),
    academyUnitTags: _bkIds(def.academyUnitTags, 6),
    contextTags: _bkIds(def.contextTags, 6),
    practiceIds: _bkIds(def.practiceIds, 3),
    mirrorLinks: _bkIds(def.mirrorLinks, 6),
    /* original writing about the book */
    whyRead: _bkStr(def.whyRead, BOOK_LIMITS.line),
    whatItHelpsWith: _bkList(def.whatItHelpsWith, 6),
    whatItDoesNotProve: _bkList(def.whatItDoesNotProve, 4),
    whenNotToChooseIt: _bkList(def.whenNotToChooseIt, 3),
    cautions: _bkList(def.cautions, 4),
    reflectionPrompts: _bkList(def.reflectionPrompts, 4),
    applicationPrompts: _bkList(def.applicationPrompts, 3),
    relatedBooks: _bkIds(def.relatedBooks, 4),
    evidenceGrade: ['A','B','C','D'].indexOf(def.evidenceGrade)>=0 ? def.evidenceGrade : 'C',
    evidenceNotes: _bkStr(def.evidenceNotes, BOOK_LIMITS.line),
    sourceRefs: _bkIds(def.sourceRefs, 4),
    scopeZone: (typeof ACADEMY_SCOPE_ZONES!=='undefined' && ACADEMY_SCOPE_ZONES.indexOf(def.scopeZone)>=0)
      ? def.scopeZone : null,
    status: def.status==='draft' ? 'draft' : 'published'
  };
  BOOKS[b.bookId] = b;
  if(BOOK_ORDER.indexOf(b.bookId)<0) BOOK_ORDER.push(b.bookId);
  return b;
}
function book(bookId){ return BOOKS[bookId] || null; }
function booksByCategory(cat){
  return BOOK_ORDER.map(book).filter(function(b){ return b && b.category===cat; });
}
function booksForAcademyUnit(unitId){
  return BOOK_ORDER.map(book).filter(function(b){ return b && b.academyUnitTags.indexOf(unitId)>=0; });
}

/* ── Reading sequences ──
   Phase 7 owns the learning paths. This is a mapping FROM those paths to
   books, not a second path system: an unknown pathId is an integrity error. */
var BOOK_PATH_READING = {};
function booksRegisterReading(pathId, bookIds){
  BOOK_PATH_READING[_bkStr(pathId,64)] = _bkIds(bookIds, 6);
  return BOOK_PATH_READING[pathId];
}
function booksForPath(pathId){
  return (BOOK_PATH_READING[pathId] || []).map(book).filter(Boolean);
}

/* ── Integrity ──
   Same contract as the Academy: every reference must resolve, or the build
   fails rather than the product quietly teaching something wrong. */
function booksIntegrity(){
  var errors = [];
  var haveIntervention = (typeof COACHING_INTERVENTIONS!=='undefined') ? COACHING_INTERVENTIONS : null;
  var haveApproach = (typeof COACHING_APPROACHES!=='undefined') ? COACHING_APPROACHES : null;
  var havePractice = (typeof COACHING_PRACTICES!=='undefined') ? COACHING_PRACTICES : null;
  var haveMirror = (typeof COACHING_MIRROR_CATEGORIES!=='undefined') ? COACHING_MIRROR_CATEGORIES : null;
  var haveCtx = (typeof COACHING_CONTEXTS!=='undefined') ? COACHING_CONTEXTS : null;
  var haveUnit = (typeof academyUnit==='function') ? academyUnit : null;
  var havePath = (typeof academyPath==='function') ? academyPath : null;
  var haveSource = (typeof coachingSource==='function') ? coachingSource : null;
  var competencies = (typeof COACHING_ICF_AREA!=='undefined')
    ? Object.keys(COACHING_ICF_AREA).map(function(k){ return COACHING_ICF_AREA[k]; }) : null;

  BOOK_ORDER.forEach(function(id){
    var b = BOOKS[id];
    if(!b.title) errors.push(id+': missing title');
    if(!b.authors.length) errors.push(id+': missing author');
    if(!b.whyRead) errors.push(id+': missing whyRead');
    if(!b.whatItHelpsWith.length) errors.push(id+': missing whatItHelpsWith');
    if(!b.evidenceNotes) errors.push(id+': evidence grade without a reason');
    /* a book we could not establish has no business being recommended */
    if(!b.metadataVerified) errors.push(id+': unverified bibliographic metadata');
    if(b.metadataVerified && !b.publicationYear) errors.push(id+': verified but no year');
    if(haveUnit) b.academyUnitTags.forEach(function(t){
      if(!haveUnit(t)) errors.push(id+': unknown academy unit '+t); });
    if(haveIntervention) b.interventionTags.forEach(function(t){
      if(!haveIntervention[t]) errors.push(id+': unknown intervention '+t); });
    if(haveApproach) b.approachTags.forEach(function(t){
      if(!haveApproach[t]) errors.push(id+': unknown approach '+t); });
    if(havePractice) b.practiceIds.forEach(function(t){
      if(!havePractice[t]) errors.push(id+': unknown practice '+t); });
    if(haveMirror) b.mirrorLinks.forEach(function(t){
      if(haveMirror.indexOf(t)<0) errors.push(id+': unknown mirror category '+t); });
    if(haveCtx) b.contextTags.forEach(function(t){
      if(!haveCtx[t]) errors.push(id+': unknown context '+t); });
    if(competencies) b.competencyTags.forEach(function(t){
      if(competencies.indexOf(t)<0) errors.push(id+': unknown competency '+t); });
    if(haveSource) b.sourceRefs.forEach(function(t){
      if(!haveSource(t)) errors.push(id+': unknown source '+t); });
    b.relatedBooks.forEach(function(t){
      if(!BOOKS[t]) errors.push(id+': unknown related book '+t);
      if(t===id) errors.push(id+': related to itself'); });
  });
  Object.keys(BOOK_PATH_READING).forEach(function(pid){
    if(havePath && !havePath(pid)) errors.push(pid+': reading list for an unknown Academy path');
    BOOK_PATH_READING[pid].forEach(function(bid){
      if(!BOOKS[bid]) errors.push(pid+': unknown book '+bid); });
  });
  return { ok: errors.length===0, errors: errors,
    books: BOOK_ORDER.length, readingLists: Object.keys(BOOK_PATH_READING).length };
}

/* ── Copyright guard ──
   The catalogue may describe a book. It may not become the book. Long prose
   in a field meant for a one-line reason is the shape a smuggled summary
   takes, so the length limits are the enforcement. */
var BOOK_COPYRIGHT_MAX = { whyRead:320, line:320 };
function booksCopyrightAudit(){
  var hits = [];
  BOOK_ORDER.forEach(function(id){
    var b = BOOKS[id];
    if(b.whyRead.length > BOOK_COPYRIGHT_MAX.whyRead) hits.push(id+': whyRead too long');
    b.whatItHelpsWith.concat(b.whatItDoesNotProve, b.cautions, b.reflectionPrompts,
      b.applicationPrompts, b.whenNotToChooseIt).forEach(function(l){
        if(l.length > BOOK_COPYRIGHT_MAX.line) hits.push(id+': line too long');
      });
    /* nothing that looks like reproduced structure */
    if(/bölüm\s*\d|chapter\s*\d|1\. bölüm|özet:/i.test(JSON.stringify(b))) hits.push(id+': chapter-like structure');
  });
  return { ok: hits.length===0, hits: hits };
}

if(typeof window!=='undefined'){
  window.BOOKS_VERSION=BOOKS_VERSION; window.BOOK_CATEGORIES=BOOK_CATEGORIES;
  window.BOOK_CATEGORY_LABEL=BOOK_CATEGORY_LABEL; window.BOOK_AUDIENCE=BOOK_AUDIENCE;
  window.BOOK_AUDIENCE_LABEL=BOOK_AUDIENCE_LABEL; window.BOOK_STATES=BOOK_STATES;
  window.BOOK_STATE_LABEL=BOOK_STATE_LABEL; window.BOOK_TRANSITIONS=BOOK_TRANSITIONS;
  window.BOOK_PRIMARY_LIMIT=BOOK_PRIMARY_LIMIT; window.BOOK_QUEUE_LIMIT=BOOK_QUEUE_LIMIT;
  window.BOOK_MAX_RECOMMENDATIONS=BOOK_MAX_RECOMMENDATIONS;
  window.BOOK_REFLECTION_MAX=BOOK_REFLECTION_MAX; window.BOOKS_DISCLAIMER=BOOKS_DISCLAIMER;
  window.BOOKS=BOOKS; window.BOOK_ORDER=BOOK_ORDER; window.BOOK_PATH_READING=BOOK_PATH_READING;
  window.booksRegister=booksRegister; window.book=book; window.booksByCategory=booksByCategory;
  window.booksForAcademyUnit=booksForAcademyUnit; window.booksRegisterReading=booksRegisterReading;
  window.booksForPath=booksForPath; window.booksIntegrity=booksIntegrity;
  window.booksCopyrightAudit=booksCopyrightAudit;
}
