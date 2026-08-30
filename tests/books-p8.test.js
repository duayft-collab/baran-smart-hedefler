'use strict';
/* COACHING MASTERY OS — PHASE 8 (Books + Learning Paths).

   What this suite defends:
     · The catalogue references canonical authorities and never restates them.
     · Every bibliographic fact is marked verified, or the book is not here.
     · Evidence grades describe evidence, not popularity: bestsellers are C.
     · The catalogue describes books; it never becomes one.
     · Reading is not competence — no MASTERED, nothing a machine may set.
     · Recommendations are deterministic, capped, and explainable, and are
       driven by structured state only: never a note, reflection or transcript.
     · Reading extends the Phase 7 paths rather than forking a second system,
       and adopting a practice reuses the Phase 6 tracker.
     · Youth/child and therapy-scope cautions are present and honest.
     · Personal state stays private and every call is bounded. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const FILES = ['39-books-domain.js', '40-books-catalogue.js', '41-books-engine.js',
  '42-books-store.js', '43-books-ui.js'];
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
function exec(src) { return code(src).replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"/g, "''"); }

function fakeDb() {
  const store = {};
  const dead = () => new Promise(() => { });
  const hung = p => store.__hang || (store.__hangPaths || []).some(s => p.indexOf(s) >= 0);
  function docRef(p) {
    return {
      _path: p,
      get() { return hung(p) ? dead() : Promise.resolve({ exists: p in store, data() { return store[p]; }, ref: docRef(p), metadata: { hasPendingWrites: false } }); },
      set(d, o) { if (hung(p)) return dead(); store[p] = (o && o.merge) ? Object.assign({}, store[p], JSON.parse(JSON.stringify(d))) : JSON.parse(JSON.stringify(d)); return Promise.resolve(); },
      update(d) {
        /* dotted paths and the increment sentinel, exactly as the real backend
           handles them — a shallow merge would let a broken counter pass */
        if (hung(p)) return dead();
        if (!(p in store)) return Promise.reject(new Error('nf'));
        const next = JSON.parse(JSON.stringify(store[p]));
        Object.keys(d).forEach(dotted => {
          const parts = dotted.split('.');
          let cur = next;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          const leaf = parts[parts.length - 1], v = d[dotted];
          if (v && typeof v === 'object' && typeof v.__inc === 'number') cur[leaf] = (Number(cur[leaf]) || 0) + v.__inc;
          else cur[leaf] = JSON.parse(JSON.stringify(v));
        });
        store[p] = next;
        return Promise.resolve();
      },
      delete() { if (hung(p)) return dead(); delete store[p]; return Promise.resolve(); },
      collection(n) { return colRef(p + '/' + n); }
    };
  }
  function colRef(p) {
    const q = { limit: 1000 };
    const api = {
      _path: p, doc(id) { return docRef(p + '/' + id); }, orderBy() { return api; },
      limit(n) { q.limit = n; return api; },
      get() {
        if (hung(p)) return dead();
        const pre = p + '/';
        const keys = Object.keys(store).filter(k => k.indexOf(pre) === 0 && k.slice(pre.length).indexOf('/') < 0).slice(0, q.limit);
        return Promise.resolve({ size: keys.length, forEach(cb) { keys.forEach(k => cb({ id: k.slice(pre.length), data() { return store[k]; }, ref: docRef(k) })); } });
      }
    };
    return api;
  }
  return { _store: store, collection(n) { return colRef(n); } };
}
function ready(sb) {
  sb.setInterval = () => 0; sb.clearInterval = () => { }; sb.gotoTab = t => { sb.tab = t; };
  sb.CLOUD.uid = 'OWNER1';
  sb.CLOUD.user = { uid: 'OWNER1', email: 'o@x.com', isAnonymous: false };
  sb.COACHING_CLIENT.db = fakeDb();
  sb.COACHING_CLIENT.ready = true; sb.COACHING_CLIENT.authedUid = 'OWNER1';
  sb.COACHING_CLIENT.persistent = false;
  sb.coachingClientEnsure = () => Promise.resolve(sb.COACHING_CLIENT);
  sb.COACHING_WRITE_TIMEOUT_MS = 200;
  sb.COACHING.enabled = true;
  return sb;
}
const dbOf = sb => sb.COACHING_CLIENT.db;
const devKeys = sb => Object.keys(dbOf(sb)._store).filter(k => k.indexOf('coachingDevelopment/') > 0);
const obs = (code, sessionCount, type, category) => ({ code, sessionCount, type: type || 'WATCH', category: category || null });

/* ── CATALOGUE ─────────────────────────────────────────────────────────────── */
describe('A. The catalogue is curated, referenced and verified', () => {
  test('A1. every reference resolves', () => {
    const sb = createSandbox();
    const r = sb.booksIntegrity();
    assert.equal(r.ok, true, (r.errors || []).join('\n'));
    assert.ok(r.books >= 15 && r.books <= 40, 'curated, not bloated: ' + r.books);
    assert.equal(r.readingLists, 7, 'one reading list per Phase 7 path');
  });
  test('A2. book ids are unique and every book has an author and a year', () => {
    const sb = createSandbox();
    assert.equal(new Set(sb.BOOK_ORDER).size, sb.BOOK_ORDER.length);
    sb.BOOK_ORDER.forEach(id => {
      const b = sb.book(id);
      assert.ok(b.authors.length >= 1, id);
      assert.ok(b.title.length > 2, id);
      assert.equal(typeof b.publicationYear, 'number', id + ' has no year');
      assert.ok(b.publicationYear > 1900 && b.publicationYear <= 2026, id + ': ' + b.publicationYear);
    });
  });
  test('A3. nothing unverified is allowed to be recommended', () => {
    const sb = createSandbox();
    sb.BOOK_ORDER.forEach(id => {
      const b = sb.book(id);
      assert.equal(b.metadataVerified, true, id + ': a book we could not establish must be excluded, not guessed at');
      assert.ok(b.verifiedAt, id);
      assert.ok(b.publisher, id);
    });
  });
  test('A4. every book answers why it is here and what it does not prove', () => {
    const sb = createSandbox();
    sb.BOOK_ORDER.forEach(id => {
      const b = sb.book(id);
      assert.ok(b.whyRead.length > 30, id);
      assert.ok(b.whatItHelpsWith.length >= 3, id);
      assert.ok(b.whatItDoesNotProve.length >= 1, id + ' claims nothing is out of scope');
      assert.ok(b.whenNotToChooseIt.length >= 1, id + ' is never the wrong book?');
      assert.ok(b.evidenceNotes.length > 30, id + ': a grade without a reason');
      assert.ok(b.reflectionPrompts.length >= 1, id);
    });
  });
  test('A5. evidence describes evidence, not fame', () => {
    const sb = createSandbox();
    const grades = {};
    sb.BOOK_ORDER.forEach(id => { const g = sb.book(id).evidenceGrade; grades[g] = (grades[g] || 0) + 1; });
    /* a catalogue where everything is an A is a catalogue that is not grading */
    assert.ok((grades.C || 0) >= 3, 'no practitioner-tool grades at all: ' + JSON.stringify(grades));
    assert.ok((grades.A || 0) >= 1, JSON.stringify(grades));
    assert.ok((grades.A || 0) <= 4, 'too many A grades to be credible: ' + JSON.stringify(grades));
    /* the two biggest sellers here are not treated as evidence */
    ['clear.atomic', 'coaching.habit'].forEach(id => {
      const b = sb.book(id);
      assert.equal(b.evidenceGrade, 'C', id + ' must not be upgraded by popularity');
      assert.match(b.evidenceNotes, /kanıt değildir|ölçülmemiştir|sınırlıdır/);
    });
  });
  test('A6. the catalogue defines no coaching concept of its own', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/coachingRegisterIntervention|coachingRegisterApproach|coachingRegisterSource|academyRegisterUnit/.test(e), false, n);
      assert.equal(/COACHING_EVIDENCE_GRADES\s*=|ACADEMY_PATHS\s*=/.test(e), false, n);
    });
  });
  test('A7. no NLP-style material is smuggled in as a foundation', () => {
    const sb = createSandbox();
    sb.BOOK_ORDER.forEach(id => {
      const b = sb.book(id);
      const text = JSON.stringify(b);
      if (/NLP|Neuro-Linguistic|Neuro Linguistic/i.test(text))
        assert.notEqual(b.category, 'FOUNDATION', id + ': weak-evidence material must not be foundational');
    });
  });
});

/* ── COPYRIGHT ─────────────────────────────────────────────────────────────── */
describe('B. The catalogue describes books, it does not become one', () => {
  test('B1. the copyright audit is clean', () => {
    const sb = createSandbox();
    const r = sb.booksCopyrightAudit();
    assert.equal(r.ok, true, (r.hits || []).join('\n'));
  });
  test('B2. no chapter structure, summary substitute or long excerpt', () => {
    const sb = createSandbox();
    sb.BOOK_ORDER.forEach(id => {
      const b = sb.book(id);
      const j = JSON.stringify(b);
      assert.equal(/bölüm\s*\d|chapter\s*\d|özet:|summary:/i.test(j), false, id);
      /* nothing long enough to stand in for reading it */
      [b.whyRead, b.evidenceNotes].concat(b.whatItHelpsWith, b.cautions).forEach(l =>
        assert.ok(l.length <= 400, id + ': overlong prose'));
    });
  });
  test('B3. the disclaimer says the catalogue is not a substitute', () => {
    const sb = createSandbox();
    assert.match(sb.BOOKS_DISCLAIMER, /yerini almaz/);
    assert.match(sb.BOOKS_DISCLAIMER, /özet|alıntı/);
  });
});

/* ── STATE ─────────────────────────────────────────────────────────────────── */
describe('C. Reading state claims nothing about competence', () => {
  test('C1. there is no MASTERED state anywhere', () => {
    const sb = createSandbox();
    assert.equal(sb.BOOK_STATES.indexOf('MASTERED'), -1);
    FILES.forEach(n => assert.equal(/MASTERED|EXPERT|CERTIFIED/.test(code(F(n))), false, n));
  });
  test('C2. an unknown state or book is refused', () => {
    const sb = createSandbox();
    assert.equal(sb.booksBuildState('mi.4e', 'MASTERED'), null);
    assert.equal(sb.booksBuildState('not.a.book', 'READ'), null);
    assert.equal(sb.booksCanTransition('READ', 'MASTERED'), false);
  });
  test('C3. an untouched book has no state', () => {
    const sb = createSandbox();
    assert.equal(sb.booksStateOf([], 'mi.4e'), null);
  });
  test('C4. the record stores an id, never the catalogue entry', () => {
    const sb = createSandbox();
    const rec = sb.booksBuildState('mi.4e', 'READING');
    const j = JSON.stringify(rec);
    assert.ok(j.indexOf('mi.4e') >= 0);
    assert.equal(j.indexOf(sb.book('mi.4e').whyRead), -1, 'catalogue text must never reach user data');
    assert.equal(j.indexOf(sb.book('mi.4e').title), -1);
    assert.equal(rec.id, 'bks_mi.4e', 'stable address so a retry overwrites');
  });
  test('C5. reflections are optional, bounded and stably addressed', () => {
    const sb = createSandbox();
    assert.equal(sb.booksBuildReflection('mi.4e', '   '), null);
    const long = sb.booksBuildReflection('mi.4e', 'x'.repeat(5000));
    assert.ok(long.body.length <= sb.BOOK_REFLECTION_MAX);
    assert.equal(long.id, 'bkr_mi.4e');
  });
  test('C6. reading load is advised, never enforced by deleting choices', () => {
    const sb = createSandbox();
    const recs = ['mi.4e', 'co.active'].map(id => sb.booksBuildState(id, 'READING'));
    const advice = sb.booksLoadAdvice(recs);
    assert.equal(advice.ok, false);
    assert.match(advice.text, /bir tanesini/);
    assert.equal(sb.booksShelves(recs).READING.length, 2, 'the coach keeps both; they are only advised');
  });
});

/* ── RECOMMENDATIONS ───────────────────────────────────────────────────────── */
describe('D. Recommendations are deterministic and explainable', () => {
  test('D1. the same context always yields the same list', () => {
    const sb = createSandbox();
    const ctx = { academyUnitId: 'CORE_LISTENING' };
    assert.deepEqual(JSON.parse(JSON.stringify(sb.booksRecommend(ctx, []))),
      JSON.parse(JSON.stringify(sb.booksRecommend(ctx, []))));
  });
  test('D2. never more than three', () => {
    const sb = createSandbox();
    const r = sb.booksRecommend({
      academyUnitId: 'CORE_LISTENING', pathId: 'PATH_LISTENING',
      observationCodes: [obs('QUESTION_STACKING', 4), obs('LOW_REFLECTION', 3), obs('SILENCE_AVOIDANCE', 2)]
    }, []);
    assert.ok(r.length <= sb.BOOK_MAX_RECOMMENDATIONS, r.length);
    assert.equal(sb.BOOK_MAX_RECOMMENDATIONS, 3);
  });
  test('D3. every recommendation explains itself', () => {
    const sb = createSandbox();
    sb.booksRecommend({ academyUnitId: 'CORE_SILENCE' }, []).forEach(r => {
      assert.ok(r.why.length > 20, JSON.stringify(r));
      assert.ok(r.reason.length > 5);
      assert.ok(sb.book(r.bookId), r.bookId);
    });
  });
  test('D4. the active Academy unit outranks the path', () => {
    const sb = createSandbox();
    const r = sb.booksRecommend({ academyUnitId: 'CORE_SILENCE', pathId: 'PATH_FOUNDATION' }, []);
    assert.equal(r[0].bookId, 'kline.time', JSON.stringify(r));
    assert.match(r[0].why, /çalışmasını sürdürdüğün/);
  });
  test('D5. the active deliberate practice is honoured', () => {
    const sb = createSandbox();
    const practice = sb.coachingBuildPractice('PRACTICE_HOLD_SILENCE');
    const r = sb.booksRecommend({ activePractice: practice }, []);
    assert.ok(r.some(x => x.bookId === 'kline.time'), JSON.stringify(r));
    assert.ok(r.some(x => /Aktif pratiğin|pratiği üzerinde/.test(x.why)));
  });
  test('D6. structured Mirror evidence speaks at the right confidence', () => {
    const sb = createSandbox();
    const one = sb.booksRecommend({ observationCodes: [obs('QUESTION_STACKING', 1)] }, []);
    assert.ok(one.length >= 1);
    assert.match(one[0].why, /Bu görüşmede/);
    const many = sb.booksRecommend({ observationCodes: [obs('QUESTION_STACKING', 4)] }, []);
    assert.match(many[0].why, /4 görüşmede/);
  });
  test('D7. an already-read book is not recommended again', () => {
    const sb = createSandbox();
    const ctx = { academyUnitId: 'CORE_SILENCE' };
    assert.ok(sb.booksRecommend(ctx, []).some(r => r.bookId === 'kline.time'));
    const read = [sb.booksBuildState('kline.time', 'READ')];
    assert.equal(sb.booksRecommend(ctx, read).some(r => r.bookId === 'kline.time'), false);
  });
  test('D8. a dismissed book stops being offered', () => {
    const sb = createSandbox();
    const ctx = { academyUnitId: 'CORE_SILENCE' };
    const dismissed = [sb.booksBuildState('kline.time', 'SAVED', { dismissedRecommendation: true })];
    assert.equal(sb.booksRecommend(ctx, dismissed).some(r => r.bookId === 'kline.time'), false);
  });
  test('D9. with no signal it offers the foundation and says so', () => {
    const sb = createSandbox();
    const r = sb.booksRecommend({}, []);
    assert.ok(r.length >= 1 && r.length <= 3);
    assert.match(r[0].why, /Henüz bir öğrenme hedefin veya görüşme kanıtın yok/);
    r.forEach(x => assert.equal(sb.book(x.bookId).category, 'FOUNDATION'));
  });
  test('D10. nothing reads a note, a reflection or a transcript', () => {
    const e = exec(F('41-books-engine.js'));
    assert.equal(/\.body\b|noteText|transcript|reflection[A-Za-z]*\s*\./i.test(e), false);
    assert.equal(/fetch\(|XMLHttpRequest|openai|anthropic|embedding|vector/i.test(e), false);
  });
  test('D11. a book never receives causal credit', () => {
    const sb = createSandbox();
    const recs = [sb.booksBuildState('kline.time', 'READ')];
    const note = sb.booksMirrorNote('kline.time', recs, [obs('SILENCE_AVOIDANCE', 2)]);
    assert.ok(note);
    assert.match(note.text, /neden-sonuç değildir/);
    assert.equal(/geliştirdi|sayesinde|iyileştirdi/.test(note.text), false, note.text);
  });
});

/* ── PATHS AND PRACTICE ────────────────────────────────────────────────────── */
describe('E. Reading extends Phase 7, it does not fork it', () => {
  test('E1. every reading list belongs to a real Academy path', () => {
    const sb = createSandbox();
    Object.keys(sb.BOOK_PATH_READING).forEach(pid => {
      assert.ok(sb.academyPath(pid), pid + ' is not an Academy path');
    });
    assert.equal(Object.keys(sb.BOOK_PATH_READING).length, sb.ACADEMY_PATH_ORDER.length);
  });
  test('E2. reading lists stay short enough to actually be read', () => {
    const sb = createSandbox();
    Object.keys(sb.BOOK_PATH_READING).forEach(pid => {
      const n = sb.booksForPath(pid).length;
      assert.ok(n >= 1 && n <= 4, pid + ' recommends ' + n + ' books');
    });
  });
  test('E3. Books declares no path or practice authority of its own', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/academyRegisterPath|coachingRegisterPractice|COACHING_PRACTICES\s*=/.test(e), false, n);
    });
  });
  test('E4. adopting a practice reuses the Phase 6 record', async () => {
    const sb = ready(createSandbox());
    const r = await sb.booksAdoptPractice('kline.time');
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.practice.kind, 'practice');
    assert.equal(r.practice.code, 'PRACTICE_HOLD_SILENCE');
    assert.equal(r.bookState.state, 'APPLYING');
    assert.ok(/coachingBuildPractice/.test(code(F('42-books-store.js'))));
  });
});

/* ── SAFETY ────────────────────────────────────────────────────────────────── */
describe('F. Safety cautions are present and honest', () => {
  test('F1. the child/youth book carries developmental and guardian caution', () => {
    const sb = createSandbox();
    const b = sb.book('siegel.wholebrain');
    assert.ok(b);
    assert.equal(b.scopeZone, 'AMBER');
    const j = b.cautions.join(' ') + b.whenNotToChooseIt.join(' ');
    assert.match(j, /veli rızası|koruma/);
    assert.ok(b.contextTags.indexOf('child') >= 0);
    assert.match(b.evidenceNotes, /basitleştirilmiştir|ölçülmemiştir/);
  });
  test('F2. the trauma book is scope awareness, never treatment training', () => {
    const sb = createSandbox();
    const b = sb.book('vanderkolk.score');
    assert.equal(b.evidenceGrade, 'D', 'not a coaching foundation');
    assert.equal(b.scopeZone, 'RED');
    assert.match(b.whyRead, /kapsam farkındalığı/);
    assert.match(b.cautions.join(' '), /tedavi öğretmez/);
    assert.match(b.whatItDoesNotProve.join(' '), /travmayla çalışabileceğini/);
  });
  test('F3. no book teaches coaching a clinical condition', () => {
    const sb = createSandbox();
    sb.BOOK_ORDER.forEach(id => {
      const b = sb.book(id);
      const j = (b.whyRead + b.whatItHelpsWith.join(' ') + b.applicationPrompts.join(' ')).toLowerCase();
      assert.equal(/travmayı koçlukla|depresyonu koçlukla|kaygıyı koçlukla|tedavi et/.test(j), false, id);
    });
  });
  test('F4. a D grade is explained as scope, not as a bad book', () => {
    const sb = createSandbox();
    const b = sb.book('vanderkolk.score');
    assert.match(b.evidenceNotes, /kitabın kalitesini değil/);
  });
});

/* ── PERSISTENCE, PRIVACY, NETWORK ─────────────────────────────────────────── */
describe('G. Books invents no storage and leaks nothing', () => {
  test('G1. state lands in the private development collection', async () => {
    const sb = ready(createSandbox());
    const r = await sb.booksSaveState('mi.4e', 'READING');
    assert.equal(r.ok, true, JSON.stringify(r));
    const keys = devKeys(sb);
    assert.equal(keys.length, 1);
    assert.ok(keys[0].indexOf('users/OWNER1/coachingDevelopment/') === 0, keys[0]);
    assert.equal(Object.keys(dbOf(sb)._store).some(k => k.indexOf('app/state') >= 0), false);
  });
  test('G2. a reflection is private and copies no catalogue text', async () => {
    const sb = ready(createSandbox());
    await sb.booksSaveReflection('mi.4e', 'Kararsızlıkta ikna etme dürtümü fark ettim.');
    const rec = dbOf(sb)._store[devKeys(sb)[0]];
    assert.equal(rec.kind, 'book_reflection');
    assert.equal(rec.body, 'Kararsızlıkta ikna etme dürtümü fark ettim.');
    assert.equal(JSON.stringify(rec).indexOf(sb.book('mi.4e').whyRead), -1);
  });
  test('G3. every Books call is bounded', async () => {
    const sb = ready(createSandbox());
    dbOf(sb)._store.__hang = true;
    const t0 = Date.now();
    const w = await sb.booksSaveState('mi.4e', 'READING');
    const r = await sb.booksLoadRecords();
    assert.ok(Date.now() - t0 < 5000, 'a call hung');
    assert.equal(w.ok, false);
    assert.equal(r.ok, false);
    assert.equal(r.records, undefined, 'a failed read is not an empty library');
  });
  test('G4. a failed save persists nothing and claims nothing', async () => {
    const sb = ready(createSandbox());
    dbOf(sb)._store.__hang = true;
    const r = await sb.booksSaveReflection('mi.4e', 'kaydedilmeyecek');
    assert.equal(r.ok, false);
    assert.equal(devKeys(sb).length, 0);
  });
  test('G5. retrying a save converges on one record per book', async () => {
    const sb = ready(createSandbox());
    await sb.booksSaveReflection('mi.4e', 'aynı düşünce');
    await sb.booksSaveReflection('mi.4e', 'aynı düşünce');
    await sb.booksSaveState('mi.4e', 'READING');
    await sb.booksSaveState('mi.4e', 'READ');
    const kinds = devKeys(sb).map(k => dbOf(sb)._store[k].kind).sort();
    assert.deepEqual(kinds, ['book_reflection', 'book_state']);
  });
  test('G6. no browser storage, no app state, no second client', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/localStorage|sessionStorage|indexedDB|openDatabase/.test(e), false, n);
      assert.equal(/enablePersistence|firebase\.initializeApp|CLOUD\.db/.test(e), false, n);
      assert.equal(/\bD\.(books|library|reading)\b/.test(e), false, n);
    });
  });
  test('G7. purge removes Books records only', async () => {
    const sb = ready(createSandbox());
    await sb.booksSaveState('mi.4e', 'READING');
    await sb.booksSaveReflection('mi.4e', 'not');
    await sb.coachingSaveDevelopmentDoc(sb.coachingBuildPractice('PRACTICE_HOLD_SILENCE'));
    await sb.academySaveUnitState('FND_ETHICS', 'REVIEWED');
    assert.equal(devKeys(sb).length, 4);
    const load = await sb.booksLoadRecords();
    const res = await sb.booksPurge(load.records);
    assert.equal(res.ok, true);
    assert.equal(res.purged, 2);
    const left = devKeys(sb).map(k => dbOf(sb)._store[k].kind).sort();
    assert.deepEqual(left, ['academy_unit', 'practice'], 'practice and Academy state must survive');
  });
});

/* ── WIRING, UI, REGRESSION ────────────────────────────────────────────────── */
describe('H. Wiring, UI and regression', () => {
  test('H1. every module is loaded once with a cache-bust tag', () => {
    FILES.forEach(n => {
      assert.equal(INDEX.split('js/' + n + '?v=').length - 1, 1, n);
      assert.match(INDEX, new RegExp('js/' + n.replace(/\./g, '\\.') + '\\?v=2026\\.08-books-[a-z0-9]+'), n);
    });
  });
  test('H2. the books route exists and one nav entry is added', () => {
    assert.match(code(F('12-render-boot.js')), /books\s*:\s*function/);
    const nav = code(F('28-coaching-workspace.js'));
    assert.match(nav, /id\s*:\s*'books'/);
    assert.match(nav, /_navBooks/);
  });
  test('H3. public mirrors stay byte-identical', () => {
    FILES.concat(['12-render-boot.js', '28-coaching-workspace.js']).forEach(n => {
      assert.equal(F(n), fs.readFileSync(path.join(ROOT, 'public', 'js', n), 'utf8'), n);
    });
    assert.equal(INDEX, fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
  });
  test('H4. every module stays under the size limit', () => {
    FILES.forEach(n => assert.ok(F(n).split('\n').length < 900, n + ' ' + F(n).split('\n').length));
  });
  test('H5. the library renders with no reading history', () => {
    const sb = ready(createSandbox());
    sb.BOOKS_UI.records = [];
    sb.BOOKS_UI.recommendations = sb.booksRecommend({}, []);
    sb.renderBooksLibrary();
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf('Kitaplık') >= 0);
    assert.ok(html.indexOf('TÜM KİTAPLIK') >= 0);
    assert.ok(html.indexOf(sb.BOOKS_DISCLAIMER) >= 0);
    assert.equal(/\d+ kitap okudun|bu yıl \d+|seri|streak/i.test(html), false, 'no reading metrics');
  });
  test('H6. a book screen shows why, caution, links, practice and source', () => {
    const sb = ready(createSandbox());
    sb.BOOKS_UI.records = [];
    sb.BOOKS_UI.bookId = 'mi.4e';
    sb.renderBooksDetail();
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    ['NEDEN OKUMALI', 'NEYE DİKKAT', 'AKADEMİ BAĞLANTISI', 'OKUDUKTAN SONRA DENE',
      'DÜŞÜN', 'DURUM', 'Kaynak ve künye'].forEach(s =>
        assert.ok(html.indexOf(s) >= 0, 'missing: ' + s));
    const b = sb.book('mi.4e');
    assert.ok(html.indexOf(b.whyRead) >= 0);
    assert.ok(html.indexOf(b.evidenceNotes) >= 0);
    assert.ok(html.indexOf(b.isbn13) >= 0, 'bibliographic detail must be available');
  });
  test('H7. a failed reflection save keeps what the coach typed', async () => {
    const sb = ready(createSandbox());
    sb.BOOKS_UI.records = [];
    sb.booksOpen('mi.4e');
    const TYPED = 'Bunu bir sonraki görüşmede denemek istiyorum.';
    sb.ge('books_reflect').value = TYPED;
    dbOf(sb)._store.__hang = true;
    await sb.booksSaveReflectionNow();
    delete dbOf(sb)._store.__hang;
    assert.ok(sb.BOOKS_UI.error);
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf(TYPED) >= 0, 'the unsaved reflection was wiped');
    assert.equal(devKeys(sb).length, 0);
  });
  test('H8. a draft never leaks into another book', async () => {
    const sb = ready(createSandbox());
    sb.BOOKS_UI.records = [];
    sb.booksOpen('mi.4e');
    sb.ge('books_reflect').value = 'sadece MI icin';
    dbOf(sb)._store.__hang = true;
    await sb.booksSaveReflectionNow();
    delete dbOf(sb)._store.__hang;
    sb.booksOpen('co.active');
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.equal(html.indexOf('sadece MI icin'), -1);
  });
  test('H9. no ecommerce or gamification surface', () => {
    FILES.forEach(n => {
      const src = code(F(n));
      assert.equal(/\bXP\b|streak|rozet|badge|yıldız|rating|bestseller|satın al|affiliate/i.test(src), false, n);
    });
  });
  test('H10. Phase 5, 6 and 7 still work', async () => {
    const sb = ready(createSandbox());
    const c = await sb.coachingSessionCreate({ context: 'adult', purpose: 'x', relationLabel: 'A' });
    const p = await sb.coachingSessionPatch(c.session, { lifecycle: 'active' }, { type: 'update' });
    const done = await sb.coachingCompleteSession(p.session,
      { insight: 'i', reflection: 'r', commitment: { source: 'coachee', text: 't' } });
    assert.equal(done.ok, true, JSON.stringify(done));
    const gen = await sb.coachingGenerateMirror(done.session,
      { coacheeCommitment: true, insightRecorded: true, coachReflectionRecorded: true });
    assert.equal(gen.ok, true);
    assert.equal(sb.academyIntegrity().ok, true);
    const st = dbOf(sb)._store['users/OWNER1/coachingSessions/' + c.session.id];
    const events = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/events/') > 0).length;
    assert.equal(st.counters.events, events, 'counters still correct');
    assert.equal(Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/commitments/') > 0).length, 1);
  });
  test('H11. no AI, audio or transcript surface was introduced', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/getUserMedia|MediaRecorder|SpeechRecognition|whisper|embedding/i.test(e), false, n);
    });
  });
});
