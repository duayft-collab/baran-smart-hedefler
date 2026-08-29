'use strict';
/* POST-PHASE-6 PRODUCTION FIXES.
   Two verified live defects, and the invariants that must hold afterwards:

   1. COUNTERS. A counter states how many canonical records a session HAS —
      not how many write attempts were made. Live, a session with 10 event
      documents and 1 note reported {events:2, notes:0}, because only
      intervention-use maintained the count. Counters now have exactly ONE
      authority and are applied atomically, so concurrent writes cannot lose
      an update and an overwritten single-document note cannot inflate.

   2. REJECTED COMPLETION. Validation must be able to refuse a completion
      without destroying what the coach typed. The rule stays authoritative;
      the words stay on screen. In memory only — no localStorage, no
      sessionStorage, no IndexedDB, no app-state fallback. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const SRC27 = F('27-coaching-session-store.js'), SRC29 = F('29-coaching-live.js');
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
function exec(src) { return code(src).replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"/g, "''"); }

/* A fake Firestore that honours what the real one honours: dotted field paths
   address nested fields, and an increment sentinel is applied as a delta.
   A shallow-merge stub would pass even a broken implementation. */
function fakeDb() {
  const store = {};
  const setPath = (obj, dotted, val) => {
    const parts = String(dotted).split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const leaf = parts[parts.length - 1];
    if (val && typeof val === 'object' && typeof val.__inc === 'number') cur[leaf] = (Number(cur[leaf]) || 0) + val.__inc;
    else cur[leaf] = JSON.parse(JSON.stringify(val));
  };
  function docRef(p) {
    return {
      _path: p,
      get() {
        if (store.__hang) return new Promise(() => { });
        return Promise.resolve({
          exists: Object.prototype.hasOwnProperty.call(store, p), data() { return store[p]; }, ref: docRef(p),
          metadata: { hasPendingWrites: !!store.__offline, fromCache: !!store.__offline }
        });
      },
      set(d, o) {
        if (store.__hang) return new Promise(() => { });
        if (store.__reject) return Promise.reject(new Error('unavailable'));
        store[p] = (o && o.merge) ? Object.assign({}, store[p], JSON.parse(JSON.stringify(d))) : JSON.parse(JSON.stringify(d));
        return Promise.resolve();
      },
      update(d) {
        if (store.__hang) return new Promise(() => { });
        if (!Object.prototype.hasOwnProperty.call(store, p)) return Promise.reject(new Error('not-found'));
        store.__updates = (store.__updates || 0) + 1;
        const next = JSON.parse(JSON.stringify(store[p]));
        Object.keys(d).forEach(k => setPath(next, k, d[k]));
        store[p] = next;
        return Promise.resolve();
      },
      delete() { delete store[p]; return Promise.resolve(); },
      collection(n) { return colRef(p + '/' + n); }
    };
  }
  function colRef(p) {
    const q = { order: null, limit: 1000 };
    const api = {
      _path: p,
      doc(id) { return docRef(p + '/' + id); },
      orderBy(f, d) { q.order = { f, d }; return api; },
      limit(n) { q.limit = n; return api; },
      get() {
        const pre = p + '/';
        let keys = Object.keys(store).filter(k => k.indexOf(pre) === 0 && k.slice(pre.length).indexOf('/') < 0);
        keys = keys.slice(0, q.limit);
        return Promise.resolve({
          size: keys.length,
          forEach(cb) { keys.forEach(k => cb({ id: k.slice(pre.length), data() { return store[k]; }, ref: docRef(k) })); }
        });
      }
    };
    return api;
  }
  return { _store: store, collection(n) { return colRef(n); } };
}
function ready(sb, db) {
  sb.setInterval = function () { return 0; };
  sb.clearInterval = function () { };
  sb.CLOUD.uid = 'OWNER1';
  sb.CLOUD.user = { uid: 'OWNER1', email: 'o@x.com', isAnonymous: false };
  sb.COACHING_CLIENT.db = db || fakeDb();
  sb.COACHING_CLIENT.ready = true;
  sb.COACHING_CLIENT.authedUid = 'OWNER1';
  sb.COACHING_CLIENT.persistent = false;
  sb.coachingClientEnsure = function () { return Promise.resolve(sb.COACHING_CLIENT); };
  sb.COACHING_WRITE_TIMEOUT_MS = 300;
  sb.COACHING.enabled = true;
  return sb;
}
const dbOf = sb => sb.COACHING_CLIENT.db;
const NEW = over => Object.assign({ context: 'adult', purpose: 'Delegasyonu geliştirmek', relationLabel: 'Danışan A' }, over || {});
/* how many canonical child records actually exist */
const childCount = (sb, id, col) => Object.keys(dbOf(sb)._store)
  .filter(k => k.indexOf('users/OWNER1/coachingSessions/' + id + '/' + col + '/') === 0).length;
const stored = (sb, id) => dbOf(sb)._store['users/OWNER1/coachingSessions/' + id];
async function newSession(sb, over) {
  const r = await sb.coachingSessionCreate(NEW(over));
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.session;
}

/* ── EVENT COUNTER ─────────────────────────────────────────────────────────── */
describe('A. Event counter semantics', () => {
  test('A1. a generic event increments the event counter exactly once', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const before = Number(stored(sb, s.id).counters.events) || 0;
    const r = await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED', contextKey: 'clarity' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(stored(sb, s.id).counters.events, before + 1);
    assert.equal(stored(sb, s.id).counters.events, childCount(sb, s.id, 'events'));
  });
  test('A2. intervention-used counts once as an event and once as an intervention', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const id = Object.keys(sb.COACHING_INTERVENTIONS)[0];
    const before = Number(stored(sb, s.id).counters.events) || 0;
    const r = await sb.coachingUseIntervention(s, id, {});
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(stored(sb, s.id).counters.events, before + 1, 'event counted exactly once, not twice');
    assert.equal(stored(sb, s.id).counters.interventions, 1);
    assert.equal(stored(sb, s.id).counters.events, childCount(sb, s.id, 'events'));
  });
  test('A3. every Phase 6 event type is counted', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const p6 = ['SAFETY_BOUNDARY_HELD', 'COMMITMENT_SOURCE_CORRECTED', 'MIRROR_GENERATED',
      'PRACTICE_ACCEPTED', 'PRACTICE_SKIPPED', 'PRACTICE_REPORTED', 'OBSERVATION_DISPUTED'];
    p6.forEach(t => assert.ok(sb.COACHING_EVENT_TYPES.indexOf(t) >= 0, t));
    const before = Number(stored(sb, s.id).counters.events) || 0;
    for (const t of p6) assert.equal((await sb.coachingRecordEvent(s, { type: t })).ok, true, t);
    assert.equal(stored(sb, s.id).counters.events, before + p6.length);
    assert.equal(stored(sb, s.id).counters.events, childCount(sb, s.id, 'events'));
  });
  test('A4. a rejected event type writes nothing and counts nothing', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const before = Number(stored(sb, s.id).counters.events) || 0;
    const n = childCount(sb, s.id, 'events');
    const r = await sb.coachingRecordEvent(s, { type: 'NOT_A_REAL_EVENT' });
    assert.equal(r.ok, false);
    assert.equal(stored(sb, s.id).counters.events, before);
    assert.equal(childCount(sb, s.id, 'events'), n);
  });
  test('A5. a failed event write does not increment the counter', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const before = Number(stored(sb, s.id).counters.events) || 0;
    dbOf(sb)._store.__hang = true;                       // no server answer, ever
    const r = await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED' });
    delete dbOf(sb)._store.__hang;
    assert.equal(r.ok, false);
    assert.equal(stored(sb, s.id).counters.events, before, 'a write that never landed must not count');
  });
  test('A6. counters survive a concurrent burst — no lost updates', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const before = Number(stored(sb, s.id).counters.events) || 0;
    /* every call starts from the same in-memory session on purpose: a
       read-modify-write implementation loses updates here, an atomic one does not */
    await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map(() => sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED' })));
    assert.equal(stored(sb, s.id).counters.events, before + 8);
    assert.equal(stored(sb, s.id).counters.events, childCount(sb, s.id, 'events'));
  });
});

/* ── NOTE COUNTER ──────────────────────────────────────────────────────────── */
describe('B. Note counter semantics', () => {
  test('B1. the first persisted note takes the count from 0 to 1', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    assert.equal(stored(sb, s.id).counters.notes, 0);
    const r = await sb.coachingSaveNote(s, 'ilk not');
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(stored(sb, s.id).counters.notes, 1);
  });
  test('B2. overwriting notes/current keeps the count at 1 — autosave is not a record', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    for (let i = 0; i < 7; i++) assert.equal((await sb.coachingSaveNote(s, 'sürüm ' + i)).ok, true);
    assert.equal(stored(sb, s.id).counters.notes, 1, 'one canonical note document, not seven');
    assert.equal(childCount(sb, s.id, 'notes'), 1);
  });
  test('B3. a failed note write does not alter the count', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    dbOf(sb)._store.__hang = true;
    const r = await sb.coachingSaveNote(s, 'ulaşmayan not');
    delete dbOf(sb)._store.__hang;
    assert.equal(r.ok, false);
    assert.equal(stored(sb, s.id).counters.notes, 0);
  });
  test('B4. a note refused by the safety gate is never counted', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const r = await sb.coachingSaveNote(s, 'kendime zarar vermeyi düşünüyorum');
    assert.equal(r.ok, false);
    assert.equal(r.error, 'blocked');
    assert.equal(stored(sb, s.id).counters.notes, 0);
  });
});

/* ── ONE AUTHORITY ─────────────────────────────────────────────────────────── */
describe('C. A single counter authority', () => {
  test('C1. counters are not writable through the generic session patch', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED' });
    const truth = stored(sb, s.id).counters.events;
    assert.ok(truth >= 1);
    const r = await sb.coachingSessionPatch(s, { counters: { events: 999, notes: 999 } }, { type: 'update' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(stored(sb, s.id).counters.events, truth, 'a patch must never rewrite counters');
  });
  test('C2. an unrelated patch built from a stale session cannot clobber counters', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const stale = JSON.parse(JSON.stringify(s));                 // captured before these events
    const before = Number(stored(sb, s.id).counters.events) || 0;
    for (let i = 0; i < 4; i++) await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED' });
    assert.equal(stored(sb, s.id).counters.events, before + 4);
    await sb.coachingSessionPatch(stale, { safeguard: s.safeguard }, { type: 'update' });
    assert.equal(stored(sb, s.id).counters.events, before + 4, 'stale in-memory counters must not reach the document');
    assert.equal(stored(sb, s.id).counters.events, childCount(sb, s.id, 'events'));
  });
  test('C3. the in-memory session stays truthful after a counted write', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED' });
    assert.equal(s.counters.events, stored(sb, s.id).counters.events);
  });
  test('C4. completion counts the commitment and the reflection once each', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    await sb.coachingSessionPatch(s, { lifecycle: 'active' }, { type: 'update' });
    s.lifecycle = 'active';
    const r = await sb.coachingCompleteSession(s, {
      insight: 'netleşti', reflection: 'kendi yansımam',
      commitment: { source: 'coachee', text: 'Salı günü devredeceğim.' }
    });
    assert.equal(r.ok, true, JSON.stringify(r));
    const c = stored(sb, s.id).counters;
    assert.equal(c.commitments, 1);
    assert.equal(c.reflections, 1);
    assert.equal(c.commitments, childCount(sb, s.id, 'commitments'));
    assert.equal(c.reflections, childCount(sb, s.id, 'reflections'));
    assert.equal(c.events, childCount(sb, s.id, 'events'), 'completion events are counted too');
  });
  test('C5. saving observations sets the observation count to what was persisted', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    const obs = [0, 1, 2].map(i => ({ id: 'obs_x-' + i, code: 'C' + i, sessionId: s.id }));
    const r = await sb.coachingSaveObservations(s, obs, { version: 1, codes: ['C0'], strengths: 1, watch: 0 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(stored(sb, s.id).counters.observations, 3);
    assert.equal(stored(sb, s.id).counters.observations, childCount(sb, s.id, 'observations'));
    /* re-running the mirror replaces rather than accumulates */
    await sb.coachingSaveObservations(s, obs, { version: 1, codes: ['C0'], strengths: 1, watch: 0 });
    assert.equal(stored(sb, s.id).counters.observations, 3);
  });
  test('C6. every counter in a completed session matches its real child count', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    await sb.coachingSessionPatch(s, { lifecycle: 'active' }, { type: 'update' });
    s.lifecycle = 'active';
    await sb.coachingSaveNote(s, 'çalışma notu');
    await sb.coachingUseIntervention(s, Object.keys(sb.COACHING_INTERVENTIONS)[0], {});
    await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED', contextKey: 'clarity' });
    await sb.coachingCompleteSession(s, { insight: 'x', reflection: 'y', commitment: { source: 'coachee', text: 'z' } });
    const c = stored(sb, s.id).counters;
    ['events', 'notes', 'commitments', 'reflections'].forEach(k => {
      assert.equal(c[k], childCount(sb, s.id, k), k + ': counter says ' + c[k] + ', reality is ' + childCount(sb, s.id, k));
    });
  });
});

/* ── EXPORT ────────────────────────────────────────────────────────────────── */
describe('D. Export reports the same truth', () => {
  test('D1. the exported counters equal the real child counts', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    await sb.coachingSessionPatch(s, { lifecycle: 'active' }, { type: 'update' });
    s.lifecycle = 'active';
    await sb.coachingSaveNote(s, 'not');
    for (let i = 0; i < 3; i++) await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED' });
    const live = stored(sb, s.id);
    const row = sb.coachingRedactSession(live, 'full');
    assert.equal(row.counters.events, childCount(sb, s.id, 'events'));
    assert.equal(row.counters.notes, childCount(sb, s.id, 'notes'));
  });
});

/* ── REJECTED COMPLETION KEEPS WHAT WAS TYPED ──────────────────────────────── */
/* The harness keeps one mutable stub per element id forever, so a re-render
   would silently preserve `.value` and hide exactly the defect under test.
   A real browser replaces the nodes: the new controls carry only what the
   markup declares. Simulate that, or these tests prove nothing. */
const pinner = sb => (sb.__getElements().pinner || {}).innerHTML || '';
function unesc(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function mountDom(sb) {
  /* routing after a successful completion goes through the app shell, which
     this sandbox does not build — keep the tab switch, drop the chrome */
  sb.gotoTab = function (t) { sb.tab = t; if (t === 'coachmirror' && typeof sb.renderCoachingMirror === 'function') sb.renderCoachingMirror(); };
  const els = sb.__getElements();
  const realSh = sb.sh;
  sb.sh = function (id, html) {
    realSh(id, html);
    if (id !== 'pinner') return;
    /* every control the new markup declares becomes a fresh node */
    const ta = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g;
    let m;
    while ((m = ta.exec(html))) {
      const idm = /id="([^"]+)"/.exec(m[1]);
      if (idm) { delete els[idm[1]]; sb.ge(idm[1]).value = unesc(m[2]); }
    }
    const inp = /<input\b([^>]*)>/g;
    while ((m = inp.exec(html))) {
      const idm = /id="([^"]+)"/.exec(m[1]);
      if (!idm) continue;
      delete els[idm[1]];
      const el = sb.ge(idm[1]);
      el.checked = /\bchecked\b/.test(m[1]);
      const vm = /value="([^"]*)"/.exec(m[1]);
      el.value = vm ? unesc(vm[1]) : '';
    }
  };
  return sb;
}
function closeFields(sb) {
  return {
    insight: (sb.ge('coach_insight') || {}).value || '',
    commit: (sb.ge('coach_commit') || {}).value || '',
    owned: !!((sb.ge('coach_commit_owned') || {}).checked),
    suggestion: (sb.ge('coach_suggestion') || {}).value || '',
    reflect: (sb.ge('coach_reflect') || {}).value || ''
  };
}
function typeInto(sb, v) {
  sb.ge('coach_insight').value = v.insight;
  sb.ge('coach_commit').value = v.commit;
  sb.ge('coach_commit_owned').checked = !!v.owned;
  sb.ge('coach_suggestion').value = v.suggestion;
  sb.ge('coach_reflect').value = v.reflect;
}
const TYPED = {
  insight: 'Kendi önceliğini kendisi adlandırdı.',
  commit: 'Salı günü iki görevi devredeceğim.',
  owned: false,
  suggestion: 'Belki haftalık bir gözden geçirme.',
  reflect: 'İki kez çözüm önerme dürtüsünü tuttum.'
};
async function openClose(sb) {
  mountDom(sb);
  const s = await newSession(sb);
  await sb.coachingSessionPatch(s, { lifecycle: 'active' }, { type: 'update' });
  s.lifecycle = 'active';
  sb.COACHING_UI.session = s;
  sb.coachingOpenClose();
  return s;
}
describe('E. A refused completion never destroys what the coach typed', () => {
  test('E1. the ownership rule still refuses — it is not weakened', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    typeInto(sb, TYPED);
    await sb.coachingSubmitClose();
    assert.ok(sb.COACHING_UI.error, 'a commitment without coachee ownership must be refused');
    assert.equal(sb.COACHING_UI.session.lifecycle, 'active', 'nothing was completed');
  });
  test('E2. every typed field survives the refusal', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    typeInto(sb, TYPED);
    await sb.coachingSubmitClose();
    const after = closeFields(sb);
    assert.equal(after.insight, TYPED.insight);
    assert.equal(after.commit, TYPED.commit);
    assert.equal(after.suggestion, TYPED.suggestion);
    assert.equal(after.reflect, TYPED.reflect);
    assert.equal(after.owned, false, 'the invalid control keeps its invalid value for the coach to fix');
  });
  test('E3. the refusal is explained, without an internal error code', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    typeInto(sb, TYPED);
    await sb.coachingSubmitClose();
    const msg = String(sb.COACHING_UI.error || '');
    assert.ok(msg.length > 10);
    assert.equal(/commitment_must_be_coachee_owned|invalid_|_failed|undefined/.test(msg), false, msg);
    assert.ok(pinner(sb).indexOf('coach_insight') >= 0, 'the form is still on screen');
  });
  test('E4. correcting only the ownership control lets the same words through', async () => {
    const sb = ready(createSandbox());
    const s = await openClose(sb);
    typeInto(sb, TYPED);
    await sb.coachingSubmitClose();
    assert.ok(sb.COACHING_UI.error);
    sb.ge('coach_commit_owned').checked = true;              // fix only what was wrong
    await sb.coachingSubmitClose();
    assert.equal(sb.COACHING_UI.error, null, 'second submit succeeds');
    const st = stored(sb, s.id);
    assert.equal(st.lifecycle, 'completed');
    const store = dbOf(sb)._store;
    const ck = Object.keys(store).filter(k => k.indexOf('/coachingSessions/' + s.id + '/commitments/') > 0);
    const rk = Object.keys(store).filter(k => k.indexOf('/coachingSessions/' + s.id + '/reflections/') > 0);
    assert.equal(ck.length, 1);
    assert.equal(store[ck[0]].text, TYPED.commit, 'the words that were typed are the words that were stored');
    assert.equal(store[rk[0]].insight, TYPED.insight);
    assert.equal(store[rk[0]].coachReflection, TYPED.reflect);
    assert.equal(store[rk[0]].coachSuggestion, TYPED.suggestion);
  });
  test('E5. a storage refusal also preserves the form', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    typeInto(sb, Object.assign({}, TYPED, { owned: true }));
    dbOf(sb)._store.__reject = true;                     // the backend refuses the write
    await sb.coachingSubmitClose();
    delete dbOf(sb)._store.__reject;
    assert.ok(sb.COACHING_UI.error, 'the coach is told it did not save');
    const after = closeFields(sb);
    assert.equal(after.insight, TYPED.insight);
    assert.equal(after.commit, TYPED.commit);
    assert.equal(after.reflect, TYPED.reflect);
    assert.equal(after.owned, true);
  });
  test('E6. leaving the close view and returning keeps the draft', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    typeInto(sb, TYPED);
    await sb.coachingSubmitClose();
    sb.coachingBackToLive();
    sb.coachingOpenClose();
    assert.equal(closeFields(sb).insight, TYPED.insight);
  });
  test('E7. a completed session leaves no draft behind for the next one', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    typeInto(sb, Object.assign({}, TYPED, { owned: true }));
    await sb.coachingSubmitClose();
    assert.equal(sb.COACHING_UI.error, null);
    const s2 = await newSession(sb);
    sb.COACHING_UI.session = s2;
    sb.coachingOpenClose();
    const f = closeFields(sb);
    assert.equal(f.insight, '');
    assert.equal(f.commit, '');
    assert.equal(f.reflect, '');
    assert.equal(f.owned, false);
  });
  test('E8. the draft is escaped, never injected back as markup', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    typeInto(sb, Object.assign({}, TYPED, { insight: '</textarea><img src=x onerror=alert(1)>' }));
    await sb.coachingSubmitClose();
    const html = pinner(sb);
    assert.equal(html.indexOf('<img src=x'), -1, 'raw markup must never be echoed back');
    assert.ok(html.indexOf('&lt;') >= 0);
  });
  test('E9. the draft lives in memory only — no browser storage, no app state', () => {
    const sb = ready(createSandbox());
    const src = exec(SRC29);
    assert.equal(/localStorage|sessionStorage|indexedDB|openDatabase/.test(src), false);
    /* and it is not smuggled into the synced app state */
    assert.equal(/\bD\.(closeForm|coachClose|completion)\b/.test(src), false);
    assert.ok('closeForm' in sb.COACHING_UI, 'the draft is a UI-scoped field');
  });
});

/* ── NOTHING FROM PHASE 6 REGRESSED ────────────────────────────────────────── */
describe('F. Phase 6 still stands', () => {
  test('F1. the mirror still generates from a completed session', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    await sb.coachingSessionPatch(s, { lifecycle: 'active' }, { type: 'update' });
    s.lifecycle = 'active';
    await sb.coachingUseIntervention(s, Object.keys(sb.COACHING_INTERVENTIONS)[0], {});
    const done = await sb.coachingCompleteSession(s, { insight: 'x', reflection: 'y', commitment: { source: 'coachee', text: 'z' } });
    assert.equal(done.ok, true);
    const gen = await sb.coachingGenerateMirror(done.session, { coacheeCommitment: true, insightRecorded: true, coachReflectionRecorded: true });
    assert.equal(gen.ok, true, JSON.stringify(gen));
    assert.ok(gen.mirror.observations.length > 0);
  });
  test('F2. a coach suggestion is still never accepted as the commitment', async () => {
    const sb = ready(createSandbox());
    const s = await newSession(sb);
    await sb.coachingSessionPatch(s, { lifecycle: 'active' }, { type: 'update' });
    s.lifecycle = 'active';
    const r = await sb.coachingCompleteSession(s, { commitment: { source: 'coach_suggestion', text: 'Şunu yapmalısın.' } });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'commitment_must_be_coachee_owned');
  });
  test('F3. the store still reaches no network and no AI', () => {
    ['27-coaching-session-store.js', '29-coaching-live.js'].forEach(n => {
      const src = exec(F(n));
      assert.equal(/fetch\(|XMLHttpRequest|WebSocket|EventSource|api\.|openai|anthropic/i.test(src), false, n);
      assert.equal(/getUserMedia|MediaRecorder|SpeechRecognition/.test(src), false, n);
    });
  });
  test('F4. counter code has one home — the store, not the UI', () => {
    assert.equal(/counters\s*[.[]/.test(exec(SRC29)), false, 'the live view must not maintain counters');
    assert.ok(/coachingApplyCounters/.test(code(SRC27)));
  });
  test('F5. both changed modules stay under the module-size limit', () => {
    ['27-coaching-session-store.js', '29-coaching-live.js'].forEach(n => {
      assert.ok(F(n).split('\n').length < 900, n);
    });
  });
});
