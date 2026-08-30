/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 8c: BOOKS ENGINE

   Reading state and recommendations.

   The recommendation engine is the Academy's, applied to books: deterministic,
   capped, and able to say why in the coach's own language. Its inputs are the
   active Academy path and unit, the active deliberate practice, structured
   Mirror observation CODES, and the coach's own reading state. It never reads
   a private note, a reflection or a transcript — there is no model here.

   It also refuses to be a feed. One primary book at a time, a queue of two,
   and no urgency: a coach who is reading three books is applying none.
   ══════════════════════════════════════════════════════════════════════════ */

var BOOK_DEV_KINDS = { state:'book_state', reflection:'book_reflection' };

function _beStr(v,max){ return String(v==null?'':v).slice(0, max||240); }
function _beNow(){ try{ return new Date().toISOString(); }catch(e){ return String(Date.now()); } }

function booksCanTransition(from, to){
  if(BOOK_STATES.indexOf(to)<0) return false;
  if(!from || from===to) return BOOK_STATES.indexOf(to)>=0;
  return (BOOK_TRANSITIONS[from]||[]).indexOf(to)>=0;
}
/* One record per book, at a stable address, so a retry overwrites rather than
   duplicating — the lesson the completion path and the Academy both taught. */
function booksBuildState(bookId, state, extra){
  extra = extra || {};
  var b = book(bookId);
  if(!b) return null;
  if(BOOK_STATES.indexOf(state)<0) return null;
  return {
    id: 'bks_'+b.bookId.replace(/[^A-Za-z0-9_.-]/g,'_'),
    kind: BOOK_DEV_KINDS.state,
    bookId: b.bookId,
    state: state,
    linkedPracticeId: extra.linkedPracticeId ? _beStr(extra.linkedPracticeId,64) : null,
    dismissedRecommendation: extra.dismissedRecommendation===true,
    updatedAt: _beNow()
  };
}
function booksBuildReflection(bookId, text){
  var b = book(bookId);
  var body = _beStr(text, BOOK_REFLECTION_MAX);
  if(!b || !body.trim()) return null;
  return { id: 'bkr_'+b.bookId.replace(/[^A-Za-z0-9_.-]/g,'_'),
    kind: BOOK_DEV_KINDS.reflection, bookId: b.bookId, body: body, updatedAt: _beNow() };
}
function booksStateOf(records, bookId){
  var list = (records||[]).filter(function(r){
    return r && r.kind===BOOK_DEV_KINDS.state && r.bookId===bookId; });
  if(!list.length) return null;                    /* null = never touched */
  list.sort(function(a,b){ return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return BOOK_STATES.indexOf(list[0].state)>=0 ? list[0].state : null;
}
function booksStateMap(records){
  var out = {};
  BOOK_ORDER.forEach(function(id){ out[id] = booksStateOf(records, id); });
  return out;
}
function booksReflectionFor(records, bookId){
  var list = (records||[]).filter(function(r){
    return r && r.kind===BOOK_DEV_KINDS.reflection && r.bookId===bookId; });
  list.sort(function(a,b){ return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return list[0] || null;
}
function booksDismissed(records){
  return (records||[]).filter(function(r){
    return r && r.kind===BOOK_DEV_KINDS.state && r.dismissedRecommendation===true;
  }).map(function(r){ return r.bookId; });
}

/* ── Shelves ──
   Deliberately small numbers. Counting books read is not a measure of
   anything, so the library counts nothing. */
function booksShelves(records){
  var map = booksStateMap(records);
  var out = { READING:[], SAVED:[], READ:[], APPLYING:[], REVISIT:[] };
  BOOK_ORDER.forEach(function(id){
    var s = map[id];
    if(s && out[s]) out[s].push(id);
  });
  return out;
}
function booksPrimary(records){
  var sh = booksShelves(records);
  return sh.READING.length ? book(sh.READING[0]) : null;
}
/* A gentle guard rather than a hard block: the coach is an adult. */
function booksLoadAdvice(records){
  var sh = booksShelves(records);
  if(sh.READING.length > BOOK_PRIMARY_LIMIT)
    return { ok:false, code:'too_many_reading',
      text:'Aynı anda birden fazla kitap okuyorsun. Fikirleri uygulamak için bir tanesini öne almak genelde daha iyi sonuç verir.' };
  if(sh.SAVED.length > BOOK_QUEUE_LIMIT)
    return { ok:false, code:'queue_long',
      text:'Sıradaki kitap listen uzuyor. Okumak, uygulamanın yerine geçmez.' };
  return { ok:true };
}

/* ── Recommendations ──
   Priority order is fixed and explicit, so the same inputs always produce the
   same list and every item can name the reason it appeared. */
function booksRecommend(context, records, opts){
  opts = opts || {};
  context = context || {};
  var states = booksStateMap(records);
  var dismissed = {};
  booksDismissed(records).forEach(function(id){ dismissed[id] = true; });
  (opts.dismissed||[]).forEach(function(id){ dismissed[id] = true; });

  var out = [], seen = {};
  function push(bookId, reason, why, weight, band){
    if(!bookId || seen[bookId] || dismissed[bookId]) return;
    var b = book(bookId);
    if(!b || b.status!=='published') return;
    /* already read or in hand: not a recommendation */
    var st = states[bookId];
    if(st==='READ' || st==='READING' || st==='APPLYING') return;
    seen[bookId] = true;
    out.push({ bookId:bookId, title:b.title, authors:b.authors.slice(),
      evidenceGrade:b.evidenceGrade, reason:reason, why:why, weight:weight,
      confidence:band||'SINIRLI_KANIT' });
  }

  /* 1. the unit the coach is actually working on */
  if(context.academyUnitId){
    var u = (typeof academyUnit==='function') ? academyUnit(context.academyUnitId) : null;
    booksForAcademyUnit(context.academyUnitId).forEach(function(b){
      push(b.bookId, 'Şu an çalıştığın Akademi ünitesiyle ilgili.',
        '"'+_beStr(u?u.title:context.academyUnitId,80)+'" çalışmasını sürdürdüğün için bu kitabı öneriyoruz.',
        100, 'SINIRLI_KANIT');
    });
  }

  /* 2. the active deliberate practice */
  var ap = context.activePractice;
  if(ap && ap.code){
    BOOK_ORDER.forEach(function(id){
      var b = book(id);
      if(b.practiceIds.indexOf(ap.code)>=0)
        push(id, 'Aktif pratiğinle ilgili.',
          'Şu an "'+_beStr(ap.title||ap.code,80)+'" pratiği üzerinde çalıştığın için bu kitabı öneriyoruz.',
          90, 'SINIRLI_KANIT');
    });
  }

  /* 3. repeated structured Mirror evidence — same thresholds as everywhere */
  var watch = (context.observationCodes||[]).slice()
    .sort(function(a,b){
      if(b.sessionCount!==a.sessionCount) return b.sessionCount-a.sessionCount;
      return String(a.code).localeCompare(String(b.code));
    });
  watch.forEach(function(e){
    if(e.type && e.type!=='WATCH') return;
    var lang = (typeof academyEvidenceLanguage==='function')
      ? academyEvidenceLanguage(e.sessionCount) : {band:'SINIRLI_KANIT'};
    var unitId = (typeof ACADEMY_CODE_UNIT!=='undefined') ? ACADEMY_CODE_UNIT[e.code] : null;
    if(!unitId && typeof ACADEMY_CATEGORY_UNIT!=='undefined') unitId = ACADEMY_CATEGORY_UNIT[e.category];
    if(!unitId) return;
    booksForAcademyUnit(unitId).forEach(function(b){
      push(b.bookId, 'Son görüşmelerindeki yapılandırılmış gözlemlerle ilgili.',
        (e.sessionCount>1
          ? 'Yapılandırılmış "'+_beStr(e.code,48)+'" gözlemi '+e.sessionCount+' görüşmede kaydedildiği için'
          : 'Bu görüşmede "'+_beStr(e.code,48)+'" gözlemi kaydedildiği için')+
        ' bu kitabı öneriyoruz.',
        60 + (Number(e.sessionCount)||1), lang.band);
    });
  });

  /* 4. the path being walked */
  if(context.pathId){
    var p = (typeof academyPath==='function') ? academyPath(context.pathId) : null;
    booksForPath(context.pathId).forEach(function(b){
      push(b.bookId, 'İzlediğin öğrenme yolunda.',
        '"'+_beStr(p?p.title:context.pathId,80)+'" yolunda ilerlediğin için bu kitabı öneriyoruz.',
        40, 'SINIRLI_KANIT');
    });
  }

  /* 5. nothing to go on: the foundation, and say plainly that is why */
  if(!out.length){
    booksForPath('PATH_FOUNDATION').forEach(function(b){
      push(b.bookId, 'Başlangıç için.',
        'Henüz bir öğrenme hedefin veya görüşme kanıtın yok; profesyonel temelden başlamanı öneriyoruz.',
        10, 'SINIRLI_KANIT');
    });
  }
  out.sort(function(a,b){
    if(b.weight!==a.weight) return b.weight-a.weight;
    return String(a.bookId).localeCompare(String(b.bookId));
  });
  return out.slice(0, BOOK_MAX_RECOMMENDATIONS);
}

/* ── The loop, stated honestly ──
   A book never gets causal credit. What can truthfully be said is what
   happened alongside what, and that the coach may want to look. */
function booksMirrorNote(bookId, records, observationCodes){
  var b = book(bookId);
  if(!b) return null;
  var st = booksStateOf(records, bookId);
  if(st!=='READ' && st!=='APPLYING') return null;
  var related = (observationCodes||[]).filter(function(e){
    var unitId = (typeof ACADEMY_CODE_UNIT!=='undefined') ? ACADEMY_CODE_UNIT[e.code] : null;
    return unitId && b.academyUnitTags.indexOf(unitId)>=0;
  });
  if(!related.length) return null;
  return { bookId:bookId, codes:related.map(function(e){ return e.code; }),
    text:'Bu kitabı okurken ilgili alanda gözlemler kaydedildi. Bu bir neden-sonuç değildir; ' +
         'Gelişimim ekranında bu gözlemlere bakmak isteyebilirsin.' };
}

if(typeof window!=='undefined'){
  window.BOOK_DEV_KINDS=BOOK_DEV_KINDS;
  window.booksCanTransition=booksCanTransition; window.booksBuildState=booksBuildState;
  window.booksBuildReflection=booksBuildReflection; window.booksStateOf=booksStateOf;
  window.booksStateMap=booksStateMap; window.booksReflectionFor=booksReflectionFor;
  window.booksDismissed=booksDismissed; window.booksShelves=booksShelves;
  window.booksPrimary=booksPrimary; window.booksLoadAdvice=booksLoadAdvice;
  window.booksRecommend=booksRecommend; window.booksMirrorNote=booksMirrorNote;
}
