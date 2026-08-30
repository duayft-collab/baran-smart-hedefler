'use strict';
/* COACHING LEGACY READ BOUNDEDNESS CLOSEOUT.

   The write path has obeyed one rule since P5-4: the coaching client has no
   local cache, so a call settles only when the server answers, and a call that
   never answers becomes a truthful failure. The read path never did — the
   module even claimed "Reads — always bounded" while five of them could hang
   for ever.

   Boundedness is the smaller half. The dangerous half is meaning:

     · a read that timed out is NOT "no note"
     · a read that timed out is NOT "session not found"
     · a query that timed out is NOT "you have no sessions"
     · an enumeration that timed out is NOT "this session has no children",
       which is the difference between a purge and an orphaning
     · a collision check that timed out is NOT "nothing is there",
       which is the difference between a restore and an overwrite

   Purge and restore therefore fail CLOSED. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const SRC27 = F('27-coaching-session-store.js');
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }

/* The fake can stop answering for chosen paths — the only way to tell a
   bounded read from an unbounded one is to never answer it. */
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
        store.__reads = (store.__reads || 0) + 1;
        return Promise.resolve({
          exists: Object.prototype.hasOwnProperty.call(store, p), data() { return store[p]; },
          ref: docRef(p), metadata: { hasPendingWrites: false }
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
        if (!(p in store)) return Promise.reject(new Error('not-found'));
        const next = JSON.parse(JSON.stringify(store[p]));
        Object.keys(d).forEach(k => setPath(next, k, d[k]));
        store[p] = next;
        return Promise.resolve();
      },
      delete() {
        if (hung(p)) return dead();
        store.__deletes = (store.__deletes || []).concat(p);
        delete store[p];
        return Promise.resolve();
      },
      collection(n) { return colRef(p + '/' + n); }
    };
  }
  function colRef(p) {
    const q = { limit: 1000, order: null };
    const api = {
      _path: p,
      doc(id) { return docRef(p + '/' + id); },
      orderBy(f, d) { q.order = { f, d }; return api; },
      limit(n) { q.limit = n; return api; },
      get() {
        if (hung(p)) return dead();
        store.__reads = (store.__reads || 0) + 1;
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
const DEADLINE = 200;
function ready(sb) {
  sb.setInterval = () => 0; sb.clearInterval = () => { }; sb.gotoTab = t => { sb.tab = t; };
  sb.CLOUD.uid = 'OWNER1';
  sb.CLOUD.user = { uid: 'OWNER1', email: 'o@x.com', isAnonymous: false };
  sb.COACHING_CLIENT.db = fakeDb();
  sb.COACHING_CLIENT.ready = true; sb.COACHING_CLIENT.authedUid = 'OWNER1';
  sb.COACHING_CLIENT.persistent = false;
  sb.coachingClientEnsure = () => Promise.resolve(sb.COACHING_CLIENT);
  sb.COACHING_WRITE_TIMEOUT_MS = DEADLINE;
  sb.COACHING.enabled = true;
  return sb;
}
const dbOf = sb => sb.COACHING_CLIENT.db;
const P = (id, col) => 'users/OWNER1/coachingSessions/' + id + (col ? '/' + col : '');
const kids = (sb, id, col) => Object.keys(dbOf(sb)._store).filter(k => k.indexOf(P(id, col) + '/') === 0);
async function activeSession(sb) {
  const r = await sb.coachingSessionCreate({ context: 'adult', purpose: 'Delegasyon', relationLabel: 'A' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const p = await sb.coachingSessionPatch(r.session, { lifecycle: 'active' }, { type: 'update' });
  return p.session;
}
/* a bounded call settles; an unbounded one never would */
async function within(ms, p) {
  const r = await Promise.race([Promise.resolve(p),
  new Promise(res => setTimeout(() => res('__NEVER_SETTLED__'), ms))]);
  assert.notEqual(r, '__NEVER_SETTLED__', 'the call never settled — it is not bounded');
  return r;
}
const CONTROLLED = ['connection_required', 'read_failed', 'storage_unavailable', 'delete_failed'];

/* ── LOAD NOTE ─────────────────────────────────────────────────────────────── */
describe('A. coachingLoadNote', () => {
  test('A1. a dead read settles inside the deadline', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingSaveNote(s, 'kanonik not');
    dbOf(sb)._store.__hangPaths = ['/notes/'];
    const r = await within(DEADLINE * 12, sb.coachingLoadNote(s.id));
    assert.equal(r.ok, false, JSON.stringify(r));
  });
  test('A2. a timeout is never reported as "there is no note"', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingSaveNote(s, 'bu not gerçekten var');
    dbOf(sb)._store.__hangPaths = ['/notes/'];
    const r = await within(DEADLINE * 12, sb.coachingLoadNote(s.id));
    assert.equal(r.ok, false);
    assert.equal(r.note, undefined, 'a failed read must not hand back a null note as if it were an answer');
    assert.ok(CONTROLLED.indexOf(r.error) >= 0, r.error);
  });
  test('A3. reconnecting returns the canonical note', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingSaveNote(s, 'kanonik not');
    dbOf(sb)._store.__hangPaths = ['/notes/'];
    await within(DEADLINE * 12, sb.coachingLoadNote(s.id));
    dbOf(sb)._store.__hangPaths = [];
    const r = await sb.coachingLoadNote(s.id);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.note.body, 'kanonik not');
  });
  test('A4. a genuinely absent note is still distinguishable from a failure', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    const r = await sb.coachingLoadNote(s.id);
    assert.equal(r.ok, true);
    assert.equal(r.note, null, 'no note is a real answer, and it is not an error');
  });
});

/* ── LOAD SESSION ──────────────────────────────────────────────────────────── */
describe('B. coachingLoadSession', () => {
  test('B1. a dead read settles inside the deadline', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = [P(s.id)];
    const r = await within(DEADLINE * 12, sb.coachingLoadSession(s.id));
    assert.equal(r.ok, false);
  });
  test('B2. a timeout must never become not_found', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = [P(s.id)];
    const r = await within(DEADLINE * 12, sb.coachingLoadSession(s.id));
    assert.notEqual(r.error, 'not_found',
      'the session exists; saying it does not would invite the coach to recreate it');
    assert.ok(CONTROLLED.indexOf(r.error) >= 0, r.error);
  });
  test('B3. a genuinely missing session still reports not_found', async () => {
    const sb = ready(createSandbox());
    await activeSession(sb);
    const r = await sb.coachingLoadSession('coa_doesnotexist-1');
    assert.equal(r.ok, false);
    assert.equal(r.error, 'not_found');
  });
  test('B4. a failed read mutates nothing', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    const before = JSON.stringify(dbOf(sb)._store[P(s.id)]);
    dbOf(sb)._store.__hangPaths = [P(s.id)];
    await within(DEADLINE * 12, sb.coachingLoadSession(s.id));
    dbOf(sb)._store.__hangPaths = [];
    assert.equal(JSON.stringify(dbOf(sb)._store[P(s.id)]), before);
  });
});

/* ── LIST SESSIONS ─────────────────────────────────────────────────────────── */
describe('C. coachingListSessions', () => {
  test('C1. a dead query settles inside the deadline', async () => {
    const sb = ready(createSandbox());
    await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['users/OWNER1/coachingSessions'];
    const r = await within(DEADLINE * 12, sb.coachingListSessions({ limit: 10 }));
    assert.equal(r.ok, false);
  });
  test('C2. a timeout can never impersonate an empty history', async () => {
    const sb = ready(createSandbox());
    await activeSession(sb);
    await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['users/OWNER1/coachingSessions'];
    const r = await within(DEADLINE * 12, sb.coachingListSessions({ limit: 10 }));
    assert.equal(r.ok, false);
    assert.equal(r.sessions, undefined,
      'handing back [] would tell a coach with real sessions that they have none');
    assert.ok(CONTROLLED.indexOf(r.error) >= 0, r.error);
  });
  test('C3. a real empty history stays distinguishable', async () => {
    const sb = ready(createSandbox());
    const r = await sb.coachingListSessions({ limit: 10 });
    assert.equal(r.ok, true);
    /* sandbox arrays are cross-realm, so compare shape not identity */
    assert.equal(Array.isArray(r.sessions), true);
    assert.equal(r.sessions.length, 0);
  });
  test('C4. reconnecting lists the real sessions', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    dbOf(sb)._store.__hangPaths = ['users/OWNER1/coachingSessions'];
    await within(DEADLINE * 12, sb.coachingListSessions({ limit: 10 }));
    dbOf(sb)._store.__hangPaths = [];
    const r = await sb.coachingListSessions({ limit: 10 });
    assert.equal(r.ok, true);
    assert.equal(r.sessions.length, 1);
    assert.equal(r.sessions[0].id, s.id);
  });
});

/* ── PURGE: FAIL CLOSED ────────────────────────────────────────────────────── */
describe('D. coachingPurgeSession fails closed', () => {
  async function seeded(sb) {
    const s = await activeSession(sb);
    await sb.coachingSaveNote(s, 'not');
    await sb.coachingRecordEvent(s, { type: 'CONTEXT_UPDATED' });
    return s;
  }
  test('D1. an unanswered child enumeration aborts the purge', async () => {
    const sb = ready(createSandbox());
    const s = await seeded(sb);
    const childrenBefore = kids(sb, s.id, 'events').length + kids(sb, s.id, 'notes').length;
    assert.ok(childrenBefore >= 2);
    dbOf(sb)._store.__hangPaths = [P(s.id, 'events')];
    const r = await within(DEADLINE * 30, sb.coachingPurgeSession(s, { confirmed: true }));
    dbOf(sb)._store.__hangPaths = [];
    assert.equal(r.ok, false, 'an uncertain enumeration must never be treated as "no children"');
    assert.ok(CONTROLLED.indexOf(r.error) >= 0, r.error);
  });
  test('D2. nothing is deleted when the enumeration is uncertain', async () => {
    const sb = ready(createSandbox());
    const s = await seeded(sb);
    dbOf(sb)._store.__hangPaths = [P(s.id, 'events')];
    await within(DEADLINE * 30, sb.coachingPurgeSession(s, { confirmed: true }));
    dbOf(sb)._store.__hangPaths = [];
    assert.ok(dbOf(sb)._store[P(s.id)], 'the session document must survive');
    assert.ok(kids(sb, s.id, 'events').length >= 1, 'children must survive');
    assert.ok(kids(sb, s.id, 'notes').length >= 1);
    assert.equal((dbOf(sb)._store.__deletes || []).length, 0, 'no delete may be issued at all');
  });
  test('D3. the parent is never deleted while children may remain', async () => {
    const sb = ready(createSandbox());
    const s = await seeded(sb);
    /* let the first collections enumerate, then stop answering */
    dbOf(sb)._store.__hangPaths = [P(s.id, 'events')];
    await within(DEADLINE * 30, sb.coachingPurgeSession(s, { confirmed: true }));
    dbOf(sb)._store.__hangPaths = [];
    const orphaned = kids(sb, s.id, 'events').length > 0 && !dbOf(sb)._store[P(s.id)];
    assert.equal(orphaned, false, 'orphaned children are worse than an aborted purge');
  });
  test('D4. reconnecting purges cleanly', async () => {
    const sb = ready(createSandbox());
    const s = await seeded(sb);
    dbOf(sb)._store.__hangPaths = [P(s.id, 'events')];
    await within(DEADLINE * 30, sb.coachingPurgeSession(s, { confirmed: true }));
    dbOf(sb)._store.__hangPaths = [];
    const r = await sb.coachingPurgeSession(s, { confirmed: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(dbOf(sb)._store[P(s.id)], undefined);
    assert.equal(kids(sb, s.id, 'events').length, 0);
  });
  test('D5. the existing confirmation and authorization guards are unchanged', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    const r = await sb.coachingPurgeSession(s, {});
    assert.equal(r.ok, false);
    assert.equal(r.error, 'confirmation_required');
    assert.ok(dbOf(sb)._store[P(s.id)]);
  });
});

/* ── RESTORE: FAIL CLOSED ──────────────────────────────────────────────────── */
describe('E. coachingRestoreSessions fails closed', () => {
  const importable = sb => {
    const built = sb.coachingBuildSession({ context: 'adult', title: 'Geri yüklenen' },
      { now: '2026-08-30T09:00:00.000Z', id: 'coa_restore1-1' });
    return [built.session];
  };
  test('E1. an unanswered collision check aborts that record', async () => {
    const sb = ready(createSandbox());
    const recs = importable(sb);
    dbOf(sb)._store.__hangPaths = [P('coa_restore1-1')];
    const r = await within(DEADLINE * 20, sb.coachingRestoreSessions(recs, { confirmed: true }));
    dbOf(sb)._store.__hangPaths = [];
    assert.equal(r.restored, 0, 'an unanswered existence check is not permission to write');
    assert.equal(dbOf(sb)._store[P('coa_restore1-1')], undefined, 'nothing may be written');
  });
  test('E2. a timeout never counts as "the record is absent"', async () => {
    const sb = ready(createSandbox());
    const recs = importable(sb);
    dbOf(sb)._store.__hangPaths = [P('coa_restore1-1')];
    const r = await within(DEADLINE * 20, sb.coachingRestoreSessions(recs, { confirmed: true }));
    dbOf(sb)._store.__hangPaths = [];
    const noted = (r.failed || []).concat(r.skipped || []);
    assert.equal(noted.length, 1, JSON.stringify(r));
    assert.equal(/already_exists/.test(JSON.stringify(noted)), false,
      'it did not answer — claiming either presence or absence is a guess');
  });
  test('E3. an existing record is never overwritten by an uncertain restore', async () => {
    const sb = ready(createSandbox());
    const recs = importable(sb);
    const first = await sb.coachingRestoreSessions(recs, { confirmed: true });
    assert.equal(first.restored, 1, JSON.stringify(first));
    const stored = JSON.stringify(dbOf(sb)._store[P('coa_restore1-1')]);
    dbOf(sb)._store.__hangPaths = [P('coa_restore1-1')];
    const second = await within(DEADLINE * 20, sb.coachingRestoreSessions(recs, { confirmed: true }));
    dbOf(sb)._store.__hangPaths = [];
    assert.equal(second.restored, 0);
    assert.equal(JSON.stringify(dbOf(sb)._store[P('coa_restore1-1')]), stored, 'the stored record must be untouched');
  });
  test('E4. reconnecting restores, and collision semantics are unchanged', async () => {
    const sb = ready(createSandbox());
    const recs = importable(sb);
    dbOf(sb)._store.__hangPaths = [P('coa_restore1-1')];
    await within(DEADLINE * 20, sb.coachingRestoreSessions(recs, { confirmed: true }));
    dbOf(sb)._store.__hangPaths = [];
    const ok = await sb.coachingRestoreSessions(recs, { confirmed: true });
    assert.equal(ok.restored, 1, JSON.stringify(ok));
    const again = await sb.coachingRestoreSessions(recs, { confirmed: true });
    assert.equal(again.restored, 0);
    assert.equal(again.skipped[0].reason, 'already_exists', 'a real collision still reads as a collision');
  });
  test('E5. preview-before-write is unchanged', async () => {
    const sb = ready(createSandbox());
    const r = await sb.coachingRestoreSessions(importable(sb), {});
    assert.equal(r.ok, false);
    assert.equal(r.error, 'confirmation_required');
    assert.ok(r.preview);
    assert.equal((dbOf(sb)._store.__writes || []).length, 0);
  });
});

/* ── THE INVARIANT ─────────────────────────────────────────────────────────── */
describe('F. The boundedness invariant is now true and enforced', () => {
  test('F1. no Firestore call in the store escapes the deadline', () => {
    const src = code(SRC27);
    const offenders = src.split('\n').map((l, i) => ({ l, n: i + 1 }))
      .filter(x => /\.(get|set|update|delete)\s*\(/.test(x.l))
      /* the helper itself, and local/in-memory Map access, are not network calls */
      .filter(x => !/_csvRace/.test(x.l))
      .filter(x => !/COACHING_STORE\.get|\.get\(String|Map\(/.test(x.l))
      .map(x => x.n + ': ' + x.l.trim());
    assert.deepEqual(offenders, [], 'unbounded Firestore call(s):\n' + offenders.join('\n'));
  });
  test('F2. there is still exactly one deadline mechanism', () => {
    const src = code(SRC27);
    const withoutHelper = src.replace(/function _csvRace[\s\S]*?\n\}/, '');
    assert.equal(/setTimeout|setInterval/.test(withoutHelper), false,
      'a second timeout mechanism would split the policy');
  });
  test('F3. the "reads are bounded" claim is true rather than aspirational', () => {
    const src = SRC27;
    assert.match(src, /Reads[^\n]*bounded/i);
    /* and every exported read entry point races */
    ['coachingLoadNote', 'coachingLoadSession', 'coachingListSessions',
      'coachingLoadObservations', 'coachingLoadEvents', 'coachingLoadDevelopment'].forEach(fn => {
        const body = code(src).split('async function ' + fn)[1];
        assert.ok(body, fn + ' not found');
        const upToNext = body.split(/\nasync function |\nfunction /)[0];
        assert.ok(/_csvRace/.test(upToNext), fn + ' does not race its read');
      });
  });
  test('F4. a timeout is never mapped to not_found or to empty data', () => {
    const src = code(SRC27);
    assert.ok(/_csvReadError/.test(src), 'reads need their own controlled error mapping');
    /* the mapping function itself may only ever yield connection/read errors */
    const body = (src.split('function _csvReadError')[1] || '').split('\n')[0];
    assert.ok(body.length > 10, 'could not isolate _csvReadError');
    assert.equal(/not_found/.test(body), false, body);
    assert.match(body, /connection_required/);
    assert.match(body, /read_failed/);
    /* and not_found is reachable only after a settled read */
    const loadSession = code(src).split('async function coachingLoadSession')[1].split(/\nasync function /)[0];
    const notFoundLine = loadSession.split('\n').filter(l => /not_found/.test(l))[0] || '';
    assert.match(notFoundLine, /d\.exists|!d\b/, 'not_found must depend on an actual answer: ' + notFoundLine);
  });
  test('F5b. a synchronous SDK throw becomes a controlled failure, not a raw error', async () => {
    /* the SDK throws synchronously in real states (a terminated client does).
       That throw happens BEFORE _csvRace can race anything, so without a guard
       it escapes the store and reaches the UI as a raw FirebaseError. */
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    const db = dbOf(sb);
    const realCollection = db.collection;
    db.collection = function () { const e = new Error('The client has already been terminated.'); e.name = 'FirebaseError'; throw e; };
    const calls = {
      loadSession: () => sb.coachingLoadSession(s.id),
      loadNote: () => sb.coachingLoadNote(s.id),
      listSessions: () => sb.coachingListSessions({ limit: 5 }),
      loadEvents: () => sb.coachingLoadEvents(s.id, 10),
      loadDevelopment: () => sb.coachingLoadDevelopment(null, 10),
      saveNote: () => sb.coachingSaveNote(s, 'x'),
      purge: () => sb.coachingPurgeSession(s, { confirmed: true })
    };
    for (const name of Object.keys(calls)) {
      let threw = null, res = null;
      try { res = await calls[name](); } catch (e) { threw = e && e.name; }
      assert.equal(threw, null, name + ' let a raw ' + threw + ' escape');
      assert.equal(res.ok, false, name);
      assert.equal(/Firebase|terminated/i.test(JSON.stringify(res)), false, name + ': ' + JSON.stringify(res));
    }
    db.collection = realCollection;
  });
  test('F5. the module stays under the size limit', () => {
    assert.ok(SRC27.split('\n').length < 900, SRC27.split('\n').length);
  });
});

/* ── THE UI MUST NOT THROW AWAY WHAT IT ALREADY HAS ────────────────────────── */
describe('H. A failed refresh preserves loaded state', () => {
  test('H1. a failed session list does not erase the history already on screen', async () => {
    const sb = ready(createSandbox());
    await activeSession(sb);
    await sb.coachingLoadHome();
    assert.equal(sb.COACHING_UI.sessions.length, 1);
    dbOf(sb)._store.__hangPaths = ['users/OWNER1/coachingSessions'];
    await within(DEADLINE * 20, sb.coachingLoadHome());
    dbOf(sb)._store.__hangPaths = [];
    assert.ok(sb.COACHING_UI.error, 'the coach must be told the refresh failed');
    assert.equal(sb.COACHING_UI.sessions.length, 1,
      'a failed refresh must not tell a coach with sessions that they have none');
  });
  test('H2. a failed list on a first load still shows an empty, honest screen', async () => {
    const sb = ready(createSandbox());
    dbOf(sb)._store.__hangPaths = ['users/OWNER1/coachingSessions'];
    await within(DEADLINE * 20, sb.coachingLoadHome());
    dbOf(sb)._store.__hangPaths = [];
    assert.ok(sb.COACHING_UI.error);
    assert.equal(sb.COACHING_UI.sessions.length, 0);
  });
  test('H3. a failed note read never opens the workspace with a blank note', async () => {
    /* the danger is not the blank screen — it is the autosave that would then
       overwrite the real stored note with nothing */
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingSaveNote(s, 'gerçek çalışma notu');
    await sb.coachingLoadHome();
    dbOf(sb)._store.__hangPaths = ['/notes/'];
    await within(DEADLINE * 20, sb.coachingResume(s.id));
    dbOf(sb)._store.__hangPaths = [];
    assert.ok(sb.COACHING_UI.error, 'the failure must be surfaced');
    assert.notEqual(sb.tab, 'coachsession', 'do not enter the workspace on an unread note');
    assert.equal(sb.COACHING_UI.note, '', 'and no blank note is staged for saving');
    assert.equal(dbOf(sb)._store[P(s.id, 'notes') + '/current'].body, 'gerçek çalışma notu',
      'the stored note is untouched');
  });
  test('H4. resuming after reconnect loads the real note', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingSaveNote(s, 'gerçek çalışma notu');
    dbOf(sb)._store.__hangPaths = ['/notes/'];
    await within(DEADLINE * 20, sb.coachingResume(s.id));
    dbOf(sb)._store.__hangPaths = [];
    await sb.coachingResume(s.id);
    assert.equal(sb.COACHING_UI.error, null);
    assert.equal(sb.COACHING_UI.note, 'gerçek çalışma notu');
    assert.equal(sb.tab, 'coachsession');
  });
  test('H5. a failed list does not wipe the development view', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingCompleteSession(s, { insight: 'i', reflection: 'r' });
    await sb.coachingLoadDevelopmentView();
    const before = sb.COACHING_UI.devSessions.length;
    assert.ok(before >= 1);
    dbOf(sb)._store.__hangPaths = ['users/OWNER1/coachingSessions'];
    await within(DEADLINE * 20, sb.coachingLoadDevelopmentView());
    dbOf(sb)._store.__hangPaths = [];
    assert.equal(sb.COACHING_UI.devSessions.length, before,
      'Gelişimim must not report "no pattern" merely because a refresh failed');
    assert.ok(sb.COACHING_UI.error);
  });
});

/* ── NOTHING ELSE MOVED ────────────────────────────────────────────────────── */
describe('G. Phases 5, 6 and 7 still hold', () => {
  test('G1. a live session still completes and mirrors', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingUseIntervention(s, Object.keys(sb.COACHING_INTERVENTIONS)[0], {});
    const done = await sb.coachingCompleteSession(s,
      { insight: 'i', reflection: 'r', commitment: { source: 'coachee', text: 't' } });
    assert.equal(done.ok, true, JSON.stringify(done));
    const gen = await sb.coachingGenerateMirror(done.session,
      { coacheeCommitment: true, insightRecorded: true, coachReflectionRecorded: true });
    assert.equal(gen.ok, true);
    const st = dbOf(sb)._store[P(s.id)];
    assert.equal(st.counters.events, kids(sb, s.id, 'events').length, 'fix 2 counters still hold');
    assert.equal(kids(sb, s.id, 'commitments').length, 1, 'fix 3 idempotency still holds');
  });
  test('G2. Academy still reads and writes through the same bounded helpers', async () => {
    const sb = ready(createSandbox());
    const w = await sb.academySaveUnitState('FND_ETHICS', 'REVIEWED');
    assert.equal(w.ok, true);
    const r = await sb.academyLoadRecords();
    assert.equal(r.ok, true);
    assert.equal(r.records.length, 1);
    dbOf(sb)._store.__hang = true;
    const failed = await within(DEADLINE * 12, sb.academyLoadRecords());
    assert.equal(failed.ok, false);
  });
  test('G3. the coaching client still has no persistence', () => {
    const client = code(F('17b-coaching-client.js'));
    assert.equal(/enablePersistence/.test(client), false);
  });
});
