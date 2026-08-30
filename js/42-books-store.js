/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 8d: BOOKS PERSISTENCE

   No new storage architecture, for the third phase running. Personal reading
   state is coach-level development data, so it lives in the same owner-private
   coachingDevelopment collection, tagged by `kind`, reached through the same
   non-persistent client, covered by the same already-deployed rules. Hence no
   rules change in this phase either.

   Every call goes through the canonical bounded helpers, so a Books write can
   fail truthfully but cannot hang, and a failed read is never mistaken for an
   empty shelf. The catalogue is application content and is never copied into
   a user's record — only the bookId is stored.
   ══════════════════════════════════════════════════════════════════════════ */

var BOOKS_LOAD_LIMIT = 120;

function _bsFail(code){ return {ok:false, error:code}; }

async function booksSaveState(bookId, state, extra){
  if(typeof coachingSaveDevelopmentDoc!=='function') return _bsFail('storage_unavailable');
  var rec = booksBuildState(bookId, state, extra);
  if(!rec) return _bsFail('invalid_record');
  return await coachingSaveDevelopmentDoc(rec);
}

async function booksSaveReflection(bookId, text){
  if(typeof coachingSaveDevelopmentDoc!=='function') return _bsFail('storage_unavailable');
  var rec = booksBuildReflection(bookId, text);
  if(!rec) return _bsFail('invalid_record');
  return await coachingSaveDevelopmentDoc(rec);
}

/* One bounded read for the whole surface. The development collection already
   carries practices, mirror feedback and Academy state, and the engine wants
   the active practice too, so a single query serves every Books screen. */
async function booksLoadRecords(limit){
  if(typeof coachingLoadDevelopment!=='function') return _bsFail('storage_unavailable');
  var n = Math.min(Math.max(1, Number(limit)||BOOKS_LOAD_LIMIT), BOOKS_LOAD_LIMIT);
  var r = await coachingLoadDevelopment(null, n);
  if(!r.ok) return r;                       /* a failed read is not an empty shelf */
  return {ok:true, records: r.records || []};
}

/* Turning a book's application prompt into a real deliberate practice goes
   through the Phase 6 architecture. There is no Book practice tracker, and the
   one-active-practice rule stays where it already lives. */
async function booksAdoptPractice(bookId){
  var b = book(bookId);
  if(!b || !b.practiceIds.length) return _bsFail('no_practice');
  if(typeof coachingBuildPractice!=='function' || typeof coachingSaveDevelopmentDoc!=='function')
    return _bsFail('storage_unavailable');
  var rec = coachingBuildPractice(b.practiceIds[0]);
  if(!rec) return _bsFail('no_practice');
  var saved = await coachingSaveDevelopmentDoc(rec);
  if(!saved.ok) return saved;
  var st = await booksSaveState(bookId, 'APPLYING', {linkedPracticeId:rec.id});
  if(!st.ok) return st;
  return {ok:true, practice:rec, bookState:st.record};
}

async function booksDismissRecommendation(bookId){
  var current = booksBuildState(bookId, 'SAVED', {dismissedRecommendation:true});
  if(!current) return _bsFail('invalid_record');
  return await coachingSaveDevelopmentDoc(current);
}

/* Owner-scoped and kind-scoped: removes Books records only, never a practice,
   never Academy state, never a coaching session. */
async function booksPurge(records){
  if(typeof coachingPurgeDevelopment!=='function') return _bsFail('storage_unavailable');
  var ids = (records||[]).filter(function(r){
    return r && (r.kind===BOOK_DEV_KINDS.state || r.kind===BOOK_DEV_KINDS.reflection);
  }).map(function(r){ return r.id; });
  if(!ids.length) return {ok:true, purged:0};
  var res = await coachingPurgeDevelopment(ids);
  if(!res.ok) return res;
  return {ok:true, purged:ids.length};
}

if(typeof window!=='undefined'){
  window.BOOKS_LOAD_LIMIT=BOOKS_LOAD_LIMIT;
  window.booksSaveState=booksSaveState; window.booksSaveReflection=booksSaveReflection;
  window.booksLoadRecords=booksLoadRecords; window.booksAdoptPractice=booksAdoptPractice;
  window.booksDismissRecommendation=booksDismissRecommendation; window.booksPurge=booksPurge;
}
