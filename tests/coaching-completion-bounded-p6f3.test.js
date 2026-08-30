'use strict';
/* POST-PHASE-6 FIX 3 — BOUNDED COMPLETION WRITES.

   P5-4 established one rule for the whole coaching stack: the dedicated
   coaching client has no local cache, so a write settles only when the server
   answers, and a call that never answers must become a truthful failure rather
   than an eternal "Kaydediliyor…". coachingCompleteSession did not obey it —
   the commitment and the reflection were written with a bare .set(), and the
   confirm-read behind every patch was unbounded too. Offline, closing a
   session hung for ever.

   What must hold now:
     · every network call the completion path makes is raced against the deadline
     · a completion that does not land is NOT shown as completed
     · the coach's typed words survive the failure
     · pressing retry again converges on exactly ONE logical completion —
       one commitment, one reflection, one SESSION_COMPLETED, no inflated
       counters, one mirror. */
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

/* A fake Firestore that can stop answering for chosen paths — the only way to
   tell a bounded write from an unbounded one is to never answer it. */
function fakeDb() {
  const store = {};
  const dead = () => new Promise(() => { });
  const hung = p => store.__hang || (store.__hangPaths || []).some(s => p.indexOf(s) >= 0);
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
        if (hung(p)) return dead();
        return Promise.resolve({
          exists: Object.prototype.hasOwnProperty.call(store, p), data() { return store[p]; }, ref: docRef(p),
          metadata: { hasPendingWrites: !!store.__offline, fromCache: !!store.__offline }
        });
      },
      set(d, o) {
        if (hung(p)) return dead();
        store.__writes = (store.__writes || []).concat(p);
        store[p] = (o && o.merge) ? Object.assign({}, store[p], JSON.parse(JSON.stringify(d))) : JSON.parse(JSON.stringify(d));
        return Promise.resolve();
      },
      update(d) {
        if (hung(p)) return dead();
        if (!Object.prototype.hasOwnProperty.call(store, p)) return Promise.reject(new Error('not-found'));
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
    const q = { limit: 1000 };
    const api = {
      _path: p,
      doc(id) { return docRef(p + '/' + id); },
      orderBy() { return api; },
      limit(n) { q.limit = n; return api; },
      get() {
        if (hung(p)) return dead();
        const pre = p + '/';
        const keys = Object.keys(store).filter(k => k.indexOf(pre) === 0 && k.slice(pre.length).indexOf('/') < 0).slice(0, q.limit);
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
const DEADLINE = 200;
function ready(sb, db) {
  sb.setInterval = function () { return 0; };
  sb.clearInterval = function () { };
  sb.gotoTab = function (t) { sb.tab = t; };
  sb.CLOUD.uid = 'OWNER1';
  sb.CLOUD.user = { uid: 'OWNER1', email: 'o@x.com', isAnonymous: false };
  sb.COACHING_CLIENT.db = db || fakeDb();
  sb.COACHING_CLIENT.ready = true;
  sb.COACHING_CLIENT.authedUid = 'OWNER1';
  sb.COACHING_CLIENT.persistent = false;
  sb.coachingClientEnsure = function () { return Promise.resolve(sb.COACHING_CLIENT); };
  sb.COACHING_WRITE_TIMEOUT_MS = DEADLINE;
  sb.COACHING.enabled = true;
  return sb;
}
const dbOf = sb => sb.COACHING_CLIENT.db;
const NEW = over => Object.assign({ context: 'adult', purpose: 'Delegasyonu geliştirmek', relationLabel: 'Danışan A' }, over || {});
const P = (id, col) => 'users/OWNER1/coachingSessions/' + id + (col ? '/' + col : '');
const kids = (sb, id, col) => Object.keys(dbOf(sb)._store).filter(k => k.indexOf(P(id, col) + '/') === 0);
const stored = (sb, id) => dbOf(sb)._store[P(id)];
const eventsOfType = (sb, id, t) => kids(sb, id, 'events').filter(k => dbOf(sb)._store[k].type === t);
async function activeSession(sb) {
  const r = await sb.coachingSessionCreate(NEW());
  assert.equal(r.ok, true, JSON.stringify(r));
  const p = await sb.coachingSessionPatch(r.session, { lifecycle: 'active' }, { type: 'update' });
  assert.equal(p.ok, true, JSON.stringify(p));
  return p.session;
}
const OUTCOME = {
  insight: 'Kendi önceliğini kendisi adlandırdı.',
  reflection: 'İki kez çözüm önerme dürtüsünü tuttum.',
  coachSuggestion: 'Belki haftalık bir gözden geçirme.',
  commitment: { source: 'coachee', text: 'Salı günü iki görevi devredeceğim.' }
};
/* a call that is bounded settles; an unbounded one never would */
async function within(ms, p) {
  let done = false;
  const r = await Promise.race([Promise.resolve(p).then(v => { done = true; return v; }),
  new Promise(res => setTimeout(() => res('__NEVER_SETTLED__'), ms))]);
  assert.notEqual(r, '__NEVER_SETTLED__', 'the call never settled — it is not bounded');
  assert.equal(done, true);
  return r;
}

/* ── EVERY COMPLETION WRITE IS BOUNDED ─────────────────────────────────────── */
describe('A. No completion write can hang for ever', () => {
  test('A1. a dead commitment write fails inside the deadline', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['/commitments/'];
    const res = await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
    assert.equal(res.ok, false, JSON.stringify(res));
  });
  test('A2. a dead reflection write fails inside the deadline', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['/reflections/'];
    const res = await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
    assert.equal(res.ok, false, JSON.stringify(res));
  });
  test('A3. a dead lifecycle write fails inside the deadline', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = [P(s.id)];        // the session document itself
    const res = await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
    assert.equal(res.ok, false, JSON.stringify(res));
  });
  test('A4. a dead confirm-read cannot hang a write that already landed', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    /* the set() answers; only the read-back behind coachingWriteConfirmed dies */
    const ref = dbOf(sb).collection('users').doc('OWNER1').collection('coachingSessions').doc(s.id);
    const realGet = ref.get;
    const confirmed = await within(DEADLINE * 12, sb.coachingWriteConfirmed({ get: () => new Promise(() => { }) }));
    assert.equal(confirmed, false, 'no answer means unconfirmed, never a claim of success');
    assert.equal(typeof realGet, 'function');
  });
  test('A5. a fully dead backend still ends the completion attempt', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hang = true;
    const res = await within(DEADLINE * 20, sb.coachingCompleteSession(s, OUTCOME));
    assert.equal(res.ok, false);
  });
  test('A6. no bare .set(/.get( survives in the completion path', () => {
    const src = code(SRC27);
    const body = src.slice(src.indexOf('async function coachingCompleteSession'),
      src.indexOf('async function coachingCancelSession'));
    assert.ok(body.length > 200);
    const bare = body.split('\n').filter(l => /\.(set|get|update)\(/.test(l) && l.indexOf('_csvRace') < 0);
    assert.deepEqual(bare, [], 'unbounded call left in coachingCompleteSession:\n' + bare.join('\n'));
    /* and the shared confirm-read is bounded too */
    const conf = src.slice(src.indexOf('async function coachingWriteConfirmed'), src.indexOf('function coachingSessionDoc'));
    assert.ok(/_csvRace/.test(conf), 'coachingWriteConfirmed must race its read against the deadline');
  });
});

/* ── A FAILURE IS NEVER A COMPLETION ───────────────────────────────────────── */
describe('B. A failed completion never claims success', () => {
  ['/commitments/', '/reflections/'].forEach(dead => {
    test('B1. ' + dead + ' failure leaves the session active and stores nothing', async () => {
      const sb = ready(createSandbox());
      const s = await activeSession(sb);
      dbOf(sb)._store.__hangPaths = [dead];
      const res = await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
      assert.equal(res.ok, false);
      assert.equal(stored(sb, s.id).lifecycle, 'active', 'lifecycle must not claim completion');
      assert.equal(eventsOfType(sb, s.id, 'SESSION_COMPLETED').length, 0);
      assert.equal(stored(sb, s.id).mirror.version, 0);
    });
  });
  test('B2. the failure is a controlled code, not a raw backend error', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['/commitments/'];
    const res = await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
    assert.ok(['connection_required', 'write_failed'].indexOf(res.error) >= 0, JSON.stringify(res));
    assert.ok(sb.COACHING_L_ERROR[res.error], 'the code must map to calm human wording');
    assert.equal(/Firebase|firestore|permission-denied|deadline/i.test(JSON.stringify(res)), false);
  });
  test('B3. a lifecycle failure does not leave a completed-looking session', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = [P(s.id)];
    const res = await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
    assert.equal(res.ok, false);
    assert.equal(stored(sb, s.id).lifecycle, 'active');
  });
});

/* ── RETRY CONVERGES ON ONE COMPLETION ─────────────────────────────────────── */
describe('C. Retry is idempotent', () => {
  async function failThenRetry(sb, deadPath) {
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = [deadPath];
    const first = await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
    assert.equal(first.ok, false, 'the first attempt must fail');
    dbOf(sb)._store.__hangPaths = [];                       // reconnect
    const second = await sb.coachingCompleteSession(s, OUTCOME);
    assert.equal(second.ok, true, JSON.stringify(second));
    return s;
  }
  ['/commitments/', '/reflections/'].forEach(dead => {
    test('C1. retry after ' + dead + ' failure yields exactly one of everything', async () => {
      const sb = ready(createSandbox());
      const s = await failThenRetry(sb, dead);
      assert.equal(kids(sb, s.id, 'commitments').length, 1, 'one commitment, not two');
      assert.equal(kids(sb, s.id, 'reflections').length, 1, 'one reflection, not two');
      assert.equal(eventsOfType(sb, s.id, 'SESSION_COMPLETED').length, 1);
      assert.equal(eventsOfType(sb, s.id, 'ACTION_COMMITTED').length, 1);
      assert.equal(stored(sb, s.id).lifecycle, 'completed');
      const c = stored(sb, s.id).counters;
      assert.equal(c.commitments, 1, 'counter must not inflate on retry');
      assert.equal(c.reflections, 1);
      assert.equal(c.commitments, kids(sb, s.id, 'commitments').length);
      assert.equal(c.reflections, kids(sb, s.id, 'reflections').length);
      assert.equal(c.events, kids(sb, s.id, 'events').length);
    });
  });
  test('C2. pressing retry many times still leaves one logical completion', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['/commitments/'];
    for (let i = 0; i < 3; i++) {
      const r = await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
      assert.equal(r.ok, false);
    }
    dbOf(sb)._store.__hangPaths = [];
    assert.equal((await sb.coachingCompleteSession(s, OUTCOME)).ok, true);
    assert.equal(kids(sb, s.id, 'commitments').length, 1);
    assert.equal(kids(sb, s.id, 'reflections').length, 1);
    assert.equal(eventsOfType(sb, s.id, 'SESSION_COMPLETED').length, 1);
    assert.equal(stored(sb, s.id).counters.commitments, 1);
  });
  test('C3. a second completion of an already-completed session is refused', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    const first = await sb.coachingCompleteSession(s, OUTCOME);
    assert.equal(first.ok, true);
    const again = await sb.coachingCompleteSession(first.session, OUTCOME);
    assert.equal(again.ok, false);
    assert.equal(again.error, 'invalid_transition');
    assert.equal(kids(sb, s.id, 'commitments').length, 1);
  });
  test('C4. the retried completion stores the words that were typed', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['/reflections/'];
    await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
    dbOf(sb)._store.__hangPaths = [];
    await sb.coachingCompleteSession(s, OUTCOME);
    const st = dbOf(sb)._store;
    const c = st[kids(sb, s.id, 'commitments')[0]], r = st[kids(sb, s.id, 'reflections')[0]];
    assert.equal(c.text, OUTCOME.commitment.text);
    assert.equal(c.source, 'coachee');
    assert.equal(r.insight, OUTCOME.insight);
    assert.equal(r.coachReflection, OUTCOME.reflection);
    assert.equal(r.coachSuggestion, OUTCOME.coachSuggestion);
  });
  test('C5. the mirror is generated once across a failure and a retry', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['/commitments/'];
    await within(DEADLINE * 12, sb.coachingCompleteSession(s, OUTCOME));
    dbOf(sb)._store.__hangPaths = [];
    const done = await sb.coachingCompleteSession(s, OUTCOME);
    const gen = await sb.coachingGenerateMirror(done.session,
      { coacheeCommitment: true, insightRecorded: true, coachReflectionRecorded: true });
    assert.equal(gen.ok, true, JSON.stringify(gen));
    assert.equal(eventsOfType(sb, s.id, 'MIRROR_GENERATED').length, 1);
    const obs = kids(sb, s.id, 'observations');
    assert.equal(stored(sb, s.id).counters.observations, obs.length);
  });
});

/* ── THE COACH'S WORDS SURVIVE THE TIMEOUT ─────────────────────────────────── */
const pinner = sb => (sb.__getElements().pinner || {}).innerHTML || '';
function unesc(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function mountDom(sb) {
  const els = sb.__getElements();
  const realSh = sb.sh;
  sb.sh = function (id, html) {
    realSh(id, html);
    if (id !== 'pinner') return;
    let m;
    const ta = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g;
    while ((m = ta.exec(html))) {
      const idm = /id="([^"]+)"/.exec(m[1]);
      if (idm) { delete els[idm[1]]; sb.ge(idm[1]).value = unesc(m[2]); }
    }
    const inp = /<input\b([^>]*)>/g;
    while ((m = inp.exec(html))) {
      const idm = /id="([^"]+)"/.exec(m[1]);
      if (!idm) continue;
      delete els[idm[1]];
      sb.ge(idm[1]).checked = /\bchecked\b/.test(m[1]);
    }
  };
  return sb;
}
const TYPED = {
  insight: 'Kendi önceliğini kendisi adlandırdı.',
  commit: 'Salı günü iki görevi devredeceğim.',
  suggestion: 'Belki haftalık bir gözden geçirme.',
  reflect: 'İki kez çözüm önerme dürtüsünü tuttum.'
};
function typeInto(sb) {
  sb.ge('coach_insight').value = TYPED.insight;
  sb.ge('coach_commit').value = TYPED.commit;
  sb.ge('coach_commit_owned').checked = true;
  sb.ge('coach_suggestion').value = TYPED.suggestion;
  sb.ge('coach_reflect').value = TYPED.reflect;
}
const fields = sb => ({
  insight: (sb.ge('coach_insight') || {}).value || '',
  commit: (sb.ge('coach_commit') || {}).value || '',
  owned: !!((sb.ge('coach_commit_owned') || {}).checked),
  suggestion: (sb.ge('coach_suggestion') || {}).value || '',
  reflect: (sb.ge('coach_reflect') || {}).value || ''
});
describe('D. A timed-out completion keeps the form and offers another go', () => {
  async function openClose(sb) {
    mountDom(sb);
    const s = await activeSession(sb);
    sb.COACHING_UI.session = s;
    sb.coachingOpenClose();
    typeInto(sb);
    return s;
  }
  test('D1. every typed field is still there after the timeout', async () => {
    const sb = ready(createSandbox());
    const s = await openClose(sb);
    dbOf(sb)._store.__hangPaths = ['/commitments/'];
    await within(DEADLINE * 20, sb.coachingSubmitClose());
    const f = fields(sb);
    assert.equal(f.insight, TYPED.insight);
    assert.equal(f.commit, TYPED.commit);
    assert.equal(f.suggestion, TYPED.suggestion);
    assert.equal(f.reflect, TYPED.reflect);
    assert.equal(f.owned, true);
    assert.equal(stored(sb, s.id).lifecycle, 'active');
  });
  test('D2. the coach is told it did not save, in plain words', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    dbOf(sb)._store.__hangPaths = ['/commitments/'];
    await within(DEADLINE * 20, sb.coachingSubmitClose());
    const msg = String(sb.COACHING_UI.error || '');
    assert.ok(msg.indexOf('Kaydedilemedi') >= 0, msg);
    assert.equal(/connection_required|write_failed|undefined|Firebase/i.test(msg), false, msg);
    assert.ok(pinner(sb).indexOf('coach_insight') >= 0, 'the close form is still on screen');
    assert.notEqual(sb.tab, 'coachmirror', 'it must not navigate away as if it had worked');
  });
  test('D3. no spinner is left running', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    dbOf(sb)._store.__hangPaths = ['/reflections/'];
    await within(DEADLINE * 20, sb.coachingSubmitClose());
    assert.notEqual(sb.COACHING_UI.busy, true);
    assert.notEqual(sb.COACHING_UI.saving, true);
  });
  test('D5. the screen and the view flag agree after a failure', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    sb.COACHING_UI.noteDirty = true;                  // there is something to flush
    dbOf(sb)._store.__hang = true;                    // a real outage kills the note flush too
    await within(DEADLINE * 20, sb.coachingSubmitClose());
    delete dbOf(sb)._store.__hang;
    assert.ok(pinner(sb).indexOf('coach_insight') >= 0, 'the close form is painted');
    assert.equal(sb.COACHING_UI.view, 'close',
      'the view flag must match what is on screen, or the next repaint throws the coach back to the live view');
  });
  test('D6. a clean note does not burn a second deadline before completing', async () => {
    const sb = ready(createSandbox());
    const s = await openClose(sb);
    sb.COACHING_UI.noteDirty = false;                 // nothing typed since the last save
    const before = (dbOf(sb)._store.__writes || []).filter(w => w.indexOf('/notes/') >= 0).length;
    dbOf(sb)._store.__hangPaths = ['/commitments/'];
    await within(DEADLINE * 20, sb.coachingSubmitClose());
    const after = (dbOf(sb)._store.__writes || []).filter(w => w.indexOf('/notes/') >= 0).length;
    assert.equal(after, before, 'there was nothing to flush — do not spend a deadline on it');
    assert.equal(stored(sb, s.id).lifecycle, 'active');
  });
  test('D7. a dirty note is still flushed before completion', async () => {
    const sb = ready(createSandbox());
    await openClose(sb);
    sb.ge('coach_note').value = 'kaydedilmemis not';
    sb.COACHING_UI.note = 'kaydedilmemis not';
    sb.COACHING_UI.noteDirty = true;
    await within(DEADLINE * 20, sb.coachingSubmitClose());
    assert.ok((dbOf(sb)._store.__writes || []).some(w => w.indexOf('/notes/current') >= 0),
      'unsaved note text must not be dropped on the way out');
  });
  test('D4. submitting again after reconnect completes it, once', async () => {
    const sb = ready(createSandbox());
    const s = await openClose(sb);
    dbOf(sb)._store.__hangPaths = ['/commitments/'];
    await within(DEADLINE * 20, sb.coachingSubmitClose());
    assert.ok(sb.COACHING_UI.error);
    dbOf(sb)._store.__hangPaths = [];
    await sb.coachingSubmitClose();
    assert.equal(sb.COACHING_UI.error, null, 'the retry succeeded');
    assert.equal(stored(sb, s.id).lifecycle, 'completed');
    assert.equal(kids(sb, s.id, 'commitments').length, 1);
    assert.equal(kids(sb, s.id, 'reflections').length, 1);
    assert.equal(eventsOfType(sb, s.id, 'SESSION_COMPLETED').length, 1);
    const st = dbOf(sb)._store;
    assert.equal(st[kids(sb, s.id, 'commitments')[0]].text, TYPED.commit);
    assert.equal(st[kids(sb, s.id, 'reflections')[0]].insight, TYPED.insight);
    assert.equal(sb.COACHING_UI.closeForm, null, 'the draft is released only on success');
  });
});

/* ── NOTHING ELSE MOVED ────────────────────────────────────────────────────── */
describe('E. Privacy and Phase 6 behaviour are unchanged', () => {
  test('E1. no browser storage and no app-state fallback appeared', () => {
    [SRC27, SRC29].forEach(src => {
      const e = exec(src);
      assert.equal(/localStorage|sessionStorage|indexedDB|openDatabase/.test(e), false);
      assert.equal(/enablePersistence/.test(e), false);
    });
  });
  test('E2. there is still exactly one deadline mechanism', () => {
    const e = exec(SRC27);
    assert.equal(/setTimeout/.test(e.replace(/function _csvRace[\s\S]*?\n\}/, '')), false,
      'a second timeout mechanism would split the policy');
  });
  test('E3. counter and note semantics from fix 2 still hold', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    for (let i = 0; i < 5; i++) assert.equal((await sb.coachingSaveNote(s, 'sürüm ' + i)).ok, true);
    await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED' });
    assert.equal(stored(sb, s.id).counters.notes, 1);
    assert.equal(stored(sb, s.id).counters.events, kids(sb, s.id, 'events').length);
  });
  test('E4. the coachee-ownership rule is still authoritative', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    const r = await sb.coachingCompleteSession(s, { commitment: { source: 'coach_suggestion', text: 'Şunu yap.' } });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'commitment_must_be_coachee_owned');
    assert.equal(stored(sb, s.id).lifecycle, 'active');
  });
  test('E5. both changed modules stay under the size limit', () => {
    ['27-coaching-session-store.js', '29-coaching-live.js'].forEach(n => {
      assert.ok(F(n).split('\n').length < 900, n);
    });
  });
});
