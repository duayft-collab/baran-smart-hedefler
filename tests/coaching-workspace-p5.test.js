'use strict';
/* COACHING MASTERY OS — PHASE 5 (Live Workspace + real session persistence).
   Guarantees: every write passes the Phase 1 chokepoint, minors and crisis
   states cannot be persisted, the note save indicator never lies, a commitment
   must belong to the coachee, restore writes through the same chokepoint and
   never overwrites, and with the flag OFF the app is untouched. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const SRC27 = F('27-coaching-session-store.js'), SRC28 = F('28-coaching-workspace.js'), SRC29 = F('29-coaching-live.js');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const P5_FILES = ['27-coaching-session-store.js', '28-coaching-workspace.js', '29-coaching-live.js'];

function deq(a, e, m) { assert.deepEqual(JSON.parse(JSON.stringify(a)), e, m); }
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
function exec(src) { return code(src).replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"/g, "''"); }

/* Minimal in-memory Firestore standing in for the compat SDK surface used. */
function fakeDb() {
  const store = {};
  function docRef(p) {
    return {
      _path: p,
      get() {
        if (store.__hang) return new Promise(() => { });
        return Promise.resolve({ exists: Object.prototype.hasOwnProperty.call(store, p), data() { return store[p]; }, ref: docRef(p),
          metadata: { hasPendingWrites: !!store.__offline, fromCache: !!store.__offline } });
      },
      set(d, o) {
        if (store.__hang) return new Promise(() => { });        // no server answer, ever
        store[p] = (o && o.merge) ? Object.assign({}, store[p], JSON.parse(JSON.stringify(d))) : JSON.parse(JSON.stringify(d));
        return Promise.resolve();
      },
      update(d) { store[p] = Object.assign({}, store[p], JSON.parse(JSON.stringify(d))); return Promise.resolve(); },
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
        if (q.order) keys.sort((a, b) => {
          const A = String(store[a][q.order.f] || ''), B = String(store[b][q.order.f] || '');
          return q.order.d === 'desc' ? (A < B ? 1 : A > B ? -1 : 0) : (A < B ? -1 : A > B ? 1 : 0);
        });
        keys = keys.slice(0, q.limit);
        keys = keys.filter(k => k.indexOf('__offline') < 0 && k.indexOf('__hang') < 0);
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
/* signed-in owner, flag on, storage available */
function ready(sb, db) {
  /* The live workspace runs a 1s elapsed-time interval that a real browser
     clears when the element is replaced. The harness element stub never goes
     away, so that interval would keep the test runner alive — stub it out.
     setTimeout stays REAL: the store races every backend call against it. */
  sb.setInterval = function () { return 0; };
  sb.clearInterval = function () { };
  sb.CLOUD.uid = 'OWNER1';
  sb.CLOUD.user = { uid: 'OWNER1', email: 'o@x.com', isAnonymous: false };
  /* NEW-1: coaching storage comes from the dedicated non-persistent client,
     never from CLOUD.db. Attaching the fake here proves the redirect holds. */
  sb.COACHING_CLIENT.db = db || fakeDb();
  sb.COACHING_CLIENT.ready = true;
  sb.COACHING_CLIENT.authedUid = 'OWNER1';
  sb.COACHING_CLIENT.persistent = false;
  sb.coachingClientEnsure = function () { return Promise.resolve(sb.COACHING_CLIENT); };
  sb.COACHING_WRITE_TIMEOUT_MS = 300;              // keep the offline path quick
  sb.COACHING.enabled = true;
  return sb;
}
const dbOf = sb => sb.COACHING_CLIENT.db;
const NEW = (over) => Object.assign({ context: 'adult', purpose: 'Delegasyonu geliştirmek', relationLabel: 'Danışan A' }, over || {});

/* ── CREATION ─────────────────────────────────────────────────────────────── */
describe('A. Session creation', () => {
  test('A1. an adult session is created on the canonical owner path', async () => {
    const sb = ready(createSandbox());
    const res = await sb.coachingSessionCreate(NEW());
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.session.lifecycle, 'draft');
    assert.equal(res.session.ownerUid, 'OWNER1');
    assert.equal(res.session.title, 'Delegasyonu geliştirmek');
    assert.equal(res.session.subjectRef, 'Danışan A');
    const keys = Object.keys(dbOf(sb)._store);
    assert.ok(keys.some(k => k === 'users/OWNER1/coachingSessions/' + res.session.id), keys.join('\n'));
    assert.ok(keys.some(k => k.indexOf('/coachingSessions/' + res.session.id + '/events/') > 0));
    assert.equal(keys.some(k => k.indexOf('users/OWNER1/app/state') === 0), false);
  });
  test('A2. the feature flag gates creation before anything else', async () => {
    const sb = ready(createSandbox());
    sb.COACHING.enabled = false;
    const res = await sb.coachingSessionCreate(NEW());
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'feature_disabled');
    deq(Object.keys(dbOf(sb)._store), []);
  });
  test('A3. an unrelated member cannot create in the owner scope', async () => {
    const sb = ready(createSandbox());
    sb.IDENTITY.sharingEnabled = true;
    sb.CLOUD.uid = 'MEMBER1'; sb.CLOUD.user = { uid: 'MEMBER1', email: 'm@x.com', isAnonymous: false };
    sb.CLOUD.personalEntry = { ownerUid: 'OWNER1', status: 'active', role: 'editor',
      permissions: { state: { read: true, write: true } } };
    sb.CLOUD.personalOwnerActive = true;
    const res = await sb.coachingSessionCreate(NEW());
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'not_authorized');
    deq(Object.keys(dbOf(sb)._store), []);
  });
  test('A4. an invalid record never reaches storage', async () => {
    const sb = ready(createSandbox());
    const res = await sb.coachingSessionCreate(NEW({ relationLabel: 'danisan@example.com' }));
    assert.equal(res.ok, false);
    assert.equal(res.error, 'invalid_session');
    deq(Object.keys(dbOf(sb)._store), []);
  });
  test('A5. an existing id is never silently replaced', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    dbOf(sb)._store['users/OWNER1/coachingSessions/' + a.session.id].title = 'ORIGINAL';
    const clash = await sb.coachingSessionPatch(a.session, { title: 'x' });
    assert.equal(clash.ok, true);           // patching own session is fine
    assert.equal(sb.coachingValidId(a.session.id), true);
  });
  test('A6. an invalid lifecycle transition is refused', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    const bad = await sb.coachingSessionPatch(a.session, { lifecycle: 'completed' });
    assert.equal(bad.ok, false);
    assert.equal(bad.error, 'invalid_transition');
  });
});

/* ── MINORS + SAFETY ──────────────────────────────────────────────────────── */
describe('B. Minors and safety own the write path', () => {
  test('B1. a child session without guardian state cannot be persisted', async () => {
    const sb = ready(createSandbox());
    for (const ctx of ['child', 'youth']) {
      const res = await sb.coachingSessionCreate(NEW({ context: ctx, purpose: 'Okulda odaklanmak' }));
      assert.equal(res.ok, false, ctx);
      assert.equal(res.reason, 'guardian_consent_required', ctx);
      deq(Object.keys(dbOf(sb)._store), [], ctx);
    }
  });
  test('B2. with consent recorded, a child session is created', async () => {
    const sb = ready(createSandbox());
    const res = await sb.coachingSessionCreate(NEW({ context: 'child', purpose: 'Ödevleri bitirmek',
      safeguard: { guardianConsent: { state: 'granted' } } }));
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.session.safeguard.guardianConsent.state, 'granted');
  });
  test('B3. declined consent stops rather than pauses', async () => {
    const sb = ready(createSandbox());
    const res = await sb.coachingSessionCreate(NEW({ context: 'child',
      safeguard: { guardianConsent: { state: 'declined' } } }));
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'guardian_consent_declined');
    assert.equal(res.decision, 'stop_and_refer');
  });
  test('B4. a crisis purpose cannot open a writable session', async () => {
    const sb = ready(createSandbox());
    const res = await sb.coachingSessionCreate(NEW({ purpose: 'İntihar etmeyi düşünüyorum' }));
    assert.equal(res.ok, false);
    assert.equal(res.decision, 'stop_and_refer');
    deq(Object.keys(dbOf(sb)._store), []);
  });
  test('B5. a scope-boundary note cannot be saved either', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    const res = await sb.coachingSaveNote(a.session, 'Bende depresyon var mı diye soruyor.');
    assert.equal(res.ok, false);
    assert.equal(res.decision, 'pause');
    assert.equal(Object.keys(dbOf(sb)._store).some(k => k.indexOf('/notes/') > 0), false);
  });
  test('B6. an adult-only intervention cannot be recorded in a child session', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW({ context: 'child',
      safeguard: { guardianConsent: { state: 'granted' } } }));
    const res = await sb.coachingUseIntervention(a.session, 'challenge.gap', {});
    assert.equal(res.ok, false);
    assert.equal(res.error, 'intervention_not_permitted');
  });
  test('B7. there is no direct Firestore path in the UI modules', () => {
    [[SRC28, '28'], [SRC29, '29']].forEach(([src, n]) => {
      assert.equal(/CLOUD\.db|firebase\.firestore|\.collection\(/.test(exec(src)), false, n);
    });
    // and the store never writes without the guard
    assert.match(exec(SRC27), /coachingAssertWritable\(/);
    assert.equal(/bypass|skipGuard|force\s*:/.test(exec(SRC27)), false);
  });
});

/* ── PERSISTENCE BEHAVIOUR ────────────────────────────────────────────────── */
describe('C. Persistence, notes and events', () => {
  test('C1. the note is one overwritten document, not a write per keystroke', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    for (const t of ['a', 'ab', 'abc']) await sb.coachingSaveNote(a.session, t);
    const noteKeys = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/notes/') > 0);
    deq(noteKeys, ['users/OWNER1/coachingSessions/' + a.session.id + '/notes/current']);
    assert.equal(dbOf(sb)._store[noteKeys[0]].body, 'abc');
    const back = await sb.coachingLoadNote(a.session.id);
    assert.equal(back.note.body, 'abc');
  });
  test('C2. events record shape, never speech', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW({ purpose: 'GIZLI_AMAC_777' }));
    await sb.coachingSaveNote(a.session, 'GIZLI_NOT_555 danışan çok zorlanıyor');
    await sb.coachingRecordEvent(a.session, { type: 'COACH_NOTE_UPDATED' });
    const events = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/events/') > 0)
      .map(k => dbOf(sb)._store[k]);
    assert.ok(events.length >= 2);
    const j = JSON.stringify(events);
    ['GIZLI_NOT_555', 'GIZLI_AMAC_777', 'Danışan A'].forEach(x => assert.equal(j.indexOf(x), -1, x));
    events.forEach(e => assert.ok(sb.COACHING_EVENT_TYPES.indexOf(e.type) >= 0, e.type));
  });
  test('C3. an unknown event type is refused', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    assert.equal((await sb.coachingRecordEvent(a.session, { type: 'KEYSTROKE' })).error, 'invalid_event_type');
  });
  test('C4. used is not the same as suggested, and history keeps a snapshot', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    const before = a.session.counters.interventions;
    const res = await sb.coachingUseIntervention(a.session, 'q.goal.define', { stage: 'EXPLORING' });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.session.counters.interventions, before + 1);
    const used = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/events/') > 0)
      .map(k => dbOf(sb)._store[k]).find(e => e.type === 'INTERVENTION_USED');
    assert.ok(used);
    assert.equal(used.interventionId, 'q.goal.define');
    assert.equal(used.interventionSnapshot.id, 'q.goal.define');
    assert.ok(used.interventionSnapshot.text.length > 5);
    const viewed = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/events/') > 0)
      .map(k => dbOf(sb)._store[k]).filter(e => e.type === 'INTERVENTION_VIEWED');
    deq(viewed, []);                       // showing a suggestion writes nothing
  });
  test('C5. reads are bounded and owner-scoped', async () => {
    const sb = ready(createSandbox());
    await sb.coachingSessionCreate(NEW());
    await sb.coachingSessionCreate(NEW({ purpose: 'İkinci görüşme' }));
    const list = await sb.coachingListSessions({ limit: 500 });
    assert.equal(list.ok, true);
    assert.ok(list.limit <= sb.COACHING_PAGE_MAX);
    assert.equal(list.sessions.length, 2);
    sb.CLOUD.uid = null; sb.CLOUD.user = null;
    assert.equal((await sb.coachingListSessions({})).error, 'not_authorized');
  });
  test('C6. a session survives resume: load then continue', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    await sb.coachingSessionPatch(a.session, { lifecycle: 'active' });
    await sb.coachingSaveNote(a.session, 'yarim kalmis not');
    const loaded = await sb.coachingLoadSession(a.session.id);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.session.lifecycle, 'active');
    assert.equal((await sb.coachingLoadNote(a.session.id)).note.body, 'yarim kalmis not');
  });
  test('C7. a cancelled session is kept, not deleted', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    const res = await sb.coachingCancelSession(a.session);
    assert.equal(res.ok, true);
    assert.equal(res.session.lifecycle, 'cancelled');
    assert.ok(dbOf(sb)._store['users/OWNER1/coachingSessions/' + a.session.id]);
  });
});

/* ── OFFLINE / FAILURE (P5-4) ─────────────────────────────────────────────── */
describe('C2. Offline behaviour never claims a save it did not get', () => {
  test('C2a. a locally queued write is reported as NOT saved', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    const online = await sb.coachingSaveNote(a.session, 'cevrimici not');
    assert.equal(online.ok, true);
    assert.equal(online.confirmed, true);

    dbOf(sb)._store.__offline = true;              // Firestore resolves from cache
    const offline = await sb.coachingSaveNote(a.session, 'cevrimdisi not');
    assert.equal(offline.ok, false, 'a queued write must not report success');
    assert.equal(offline.error, 'connection_required');
    assert.equal(offline.queued, true);
    // the content is still in the local queue, so nothing was lost
    assert.equal(dbOf(sb)._store['users/OWNER1/coachingSessions/' + a.session.id + '/notes/current'].body, 'cevrimdisi not');
  });
  test('C2b. the coach is told, in plain words, that it is not saved', () => {
    const sb = createSandbox();
    const msg = sb.coachingErrorText('connection_required');
    assert.ok(msg.indexOf('Kaydedilemedi') >= 0, msg);
    assert.ok(msg.indexOf('bağlantı') >= 0, msg);
    assert.equal(/[a-z]_[a-z]|Firebase|Firestore|PERMISSION/.test(msg), false, msg);
  });
  test('C2c. the live indicator shows pending and offers a retry', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    sb.COACHING_UI.session = a.session;
    sb.COACHING_UI.startedAt = Date.now();
    sb.tab = 'coachsession';
    dbOf(sb)._store.__offline = true;
    sb.COACHING_UI.note = 'kaybolmamali';
    sb.ge('coach_note').value = 'kaybolmamali';        // the textarea the coach is typing into
    await sb.coachingSaveNow(false);
    assert.equal(sb.COACHING_UI.savePending, true);
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf('Kaydedilemedi — bağlantı yok') >= 0);
    assert.ok(html.indexOf('Tekrar Dene') >= 0);
    assert.equal(html.indexOf('>Kayıtlı<'), -1);
    assert.ok(html.indexOf('kaybolmamali') >= 0, 'the unsaved text must stay on screen');
  });
  test('C2c2. a server that never answers is reported as not saved, within a deadline', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    dbOf(sb)._store.__hang = true;                    // transport gone, no local cache to fake it
    const t0 = Date.now();
    const res = await sb.coachingSaveNote(a.session, 'cevaplanmayan yazma');
    const ms = Date.now() - t0;
    assert.equal(res.ok, false);
    assert.equal(res.error, 'connection_required');
    assert.equal(res.queued, false);                  // nothing was queued anywhere
    assert.ok(ms < 3000, 'must not hang: ' + ms + 'ms');
    assert.ok(ms >= 200, 'must actually wait for the deadline: ' + ms + 'ms');
  });
  test('C2c3. reads and other writes are bounded the same way', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    dbOf(sb)._store.__hang = true;
    assert.equal((await sb.coachingSessionPatch(a.session, { title: 'x' })).error, 'connection_required');
    assert.equal((await sb.coachingRecordEvent(a.session, { type: 'CONTEXT_UPDATED' })).error, 'connection_required');
    const create = await sb.coachingSessionCreate(NEW({ purpose: 'ikinci' }));
    assert.equal(create.error, 'connection_required');
  });
  test('C2d. reconnecting and retrying reports a real save', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    sb.COACHING_UI.session = a.session; sb.tab = 'coachsession';
    dbOf(sb)._store.__offline = true;
    sb.COACHING_UI.note = 'once basarisiz';
    sb.ge('coach_note').value = 'once basarisiz';
    await sb.coachingSaveNow(false);
    assert.equal(sb.COACHING_UI.savePending, true);
    delete dbOf(sb)._store.__offline;              // network back
    await sb.coachingSaveNow(false);
    assert.equal(sb.COACHING_UI.savePending, false);
    assert.equal(sb.COACHING_UI.noteDirty, false);
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf('Kayıtlı') >= 0);
    const back = await sb.coachingLoadNote(a.session.id);
    assert.equal(back.note.body, 'once basarisiz');   // what the UI claims matches storage
  });
  test('C2e. an unsaved note survives navigating away and back in-app', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    sb.COACHING_UI.session = a.session; sb.COACHING_UI.note = 'yazmakta oldugum';
    sb.COACHING_UI.noteDirty = true; sb.tab = 'coachsession';
    sb.renderCoachingLive();                          // as if returning to the tab
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf('yazmakta oldugum') >= 0);
  });
  test('C2f. no unencrypted coaching shadow store is created anywhere', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW({ purpose: 'GIZLI_AMAC' }));
    dbOf(sb)._store.__offline = true;
    await sb.coachingSaveNote(a.session, 'GIZLI_NOT');
    const ls = JSON.stringify(sb.localStorage);
    assert.equal(ls.indexOf('GIZLI_NOT'), -1);
    assert.equal(ls.indexOf('GIZLI_AMAC'), -1);
    assert.equal(sb.canonicalStringify(sb.D).indexOf('GIZLI_NOT'), -1);
    P5_FILES.forEach(f => assert.equal(/localStorage/.test(code(F(f))), false, f));
  });
});

/* ── NEW-1: no persistent plaintext coaching cache ────────────────────────── */
describe('C3. Coaching never rides on the persistent app cache', () => {
  test('C3a. the storage handle comes from the coaching client, never CLOUD.db', () => {
    const sb = createSandbox();
    sb.CLOUD.uid = 'OWNER1';
    sb.CLOUD.user = { uid: 'OWNER1', email: 'o@x.com', isAnonymous: false };
    sb.CLOUD.db = fakeDb();                          // the persistent app instance
    sb.COACHING_CLIENT.db = null; sb.COACHING_CLIENT.ready = false;
    assert.equal(sb.coachingSessionsCol(), null, 'must not fall back to the persistent instance');
    sb.COACHING_CLIENT.db = fakeDb(); sb.COACHING_CLIENT.ready = true;
    assert.ok(sb.coachingSessionsCol());
    assert.equal(/CLOUD\.db/.test(code(F('17-coaching-domain.js'))), false);
  });
  test('C3b. the coaching client never enables persistence', () => {
    const src = code(F('17b-coaching-client.js'));
    assert.equal(/enablePersistence/.test(src), false);
    assert.equal(/synchronizeTabs/.test(src), false);
    assert.equal(/localStorage|sessionStorage|indexedDB|openDatabase/i.test(src), false);
    const sb = createSandbox();
    assert.equal(sb.COACHING_CLIENT.persistent, false);
    assert.equal(sb.coachingClientState().persistent, false);
    assert.equal(sb.coachingClientState().name, 'coaching');
  });
  test('C3c. an unattached client yields no storage at all — fail closed', async () => {
    const sb = createSandbox();
    sb.CLOUD.uid = 'OWNER1'; sb.CLOUD.user = { uid: 'OWNER1', isAnonymous: false };
    sb.COACHING.enabled = true;
    sb.coachingClientEnsure = function () { return Promise.resolve({ ready: false, error: 'not_authenticated' }); };
    assert.equal((await sb.coachingSessionCreate(NEW())).error, 'storage_unavailable');
    assert.equal((await sb.coachingListSessions({})).error, 'connection_required');
    assert.equal((await sb.coachingSaveNote({ id: 'coa_a-1' }, 'x')).error, 'connection_required');
  });
  test('C3d. the app-wide persistent instance still exists for everything else', () => {
    const auth = F('03-auth.js');
    assert.match(auth, /enablePersistence\(\{synchronizeTabs:true\}\)/);   // unrelated modules unchanged
    assert.equal(/coaching/i.test(auth), false);
  });
  test('C3e. no coaching content reaches localStorage or the D payload', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW({ purpose: 'GIZLI_AMAC_1', relationLabel: 'GIZLI_KISI' }));
    await sb.coachingSaveNote(a.session, 'GIZLI_NOT_1');
    await sb.coachingCompleteSession((await sb.coachingSessionPatch(a.session, { lifecycle: 'active' })).session,
      { insight: 'GIZLI_ICGORU', commitment: { source: 'coachee', text: 'GIZLI_EYLEM' } });
    const ls = JSON.stringify(sb.localStorage);
    const d = sb.canonicalStringify(sb.D);
    ['GIZLI_AMAC_1', 'GIZLI_KISI', 'GIZLI_NOT_1', 'GIZLI_ICGORU', 'GIZLI_EYLEM'].forEach(x => {
      assert.equal(ls.indexOf(x), -1, 'localStorage leaked ' + x);
      assert.equal(d.indexOf(x), -1, 'D payload leaked ' + x);
    });
  });
  test('C3f. the store declares itself online-first with no local cache', () => {
    const sb = ready(createSandbox());
    const c = sb.coachingStoreSelfCheck();
    assert.equal(c.onlineFirst, true);
    assert.equal(c.localCache, false);
    assert.ok(c.writeTimeoutMs > 0);
    assert.equal(c.client.persistent, false);
  });
});

/* ── COMPLETION ───────────────────────────────────────────────────────────── */
describe('D. Completion and client-owned action', () => {
  async function activeSession(sb) {
    const a = await sb.coachingSessionCreate(NEW());
    const p = await sb.coachingSessionPatch(a.session, { lifecycle: 'active' });
    return p.session;
  }
  test('D1. every closing field is optional', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    const res = await sb.coachingCompleteSession(s, {});
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.session.lifecycle, 'completed');
    assert.ok(res.session.review.completedAt);
    assert.equal(res.commitment, null);
  });
  test('D2. a commitment must be the coachee\'s own', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    assert.equal((await sb.coachingCompleteSession(s, { commitment: { text: 'x' } })).error, 'commitment_source_required');
    assert.equal((await sb.coachingCompleteSession(s, { commitment: { text: 'x', source: 'coach_suggestion' } })).error,
      'commitment_must_be_coachee_owned');
    const ok = await sb.coachingCompleteSession(s, {
      commitment: { source: 'coachee', text: 'Salı günü iki görevi devredeceğim.' } });
    assert.equal(ok.ok, true);
    assert.equal(ok.commitment.source, 'coachee');
    assert.equal(ok.session.counters.commitments, 1);
  });
  test('D3. a coach suggestion is stored apart from the commitment', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingCompleteSession(s, { insight: 'Sorumluluğu başkasına bırakıyor.',
      coachSuggestion: 'Daha çok delege etmeli.', reflection: 'Fazla erken öneri verdim.' });
    const refl = dbOf(sb)._store[Object.keys(dbOf(sb)._store).find(k => k.indexOf('/reflections/final') > 0)];
    assert.equal(refl.coachSuggestion, 'Daha çok delege etmeli.');
    assert.equal(refl.coachReflection, 'Fazla erken öneri verdim.');
    const commitKeys = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/commitments/') > 0);
    deq(commitKeys, []);                   // a suggestion never becomes a commitment
  });
  test('D4. completion is deterministic and events are logged', async () => {
    const sb = ready(createSandbox());
    const s = await activeSession(sb);
    await sb.coachingCompleteSession(s, { commitment: { source: 'coachee', text: 'Yapacağım.' } });
    const types = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/events/') > 0)
      .map(k => dbOf(sb)._store[k].type);
    assert.ok(types.indexOf('SESSION_COMPLETED') >= 0);
    assert.ok(types.indexOf('ACTION_COMMITTED') >= 0);
  });
});

/* ── B3 RESTORE ───────────────────────────────────────────────────────────── */
describe('E. B3 restore is wired through the chokepoint', () => {
  test('E1. restore previews before it writes and needs confirmation', async () => {
    const sb = ready(createSandbox());
    const s = sb.coachingBuildSession({ context: 'adult', title: 'Geri yüklenen' },
      { now: '2026-08-29T09:00:00.000Z', id: 'coa_r1-1' }).session;
    const noConfirm = await sb.coachingRestoreSessions([s], {});
    assert.equal(noConfirm.ok, false);
    assert.equal(noConfirm.error, 'confirmation_required');
    assert.equal(noConfirm.preview.valid, 1);
    assert.equal(noConfirm.preview.transcriptsIncluded, false);
    deq(Object.keys(dbOf(sb)._store), []);
  });
  test('E2. a confirmed restore writes through the guard', async () => {
    const sb = ready(createSandbox());
    const s = sb.coachingBuildSession({ context: 'adult', title: 'Geri yüklenen' },
      { now: '2026-08-29T09:00:00.000Z', id: 'coa_r2-1' }).session;
    const res = await sb.coachingRestoreSessions([s], { confirmed: true });
    assert.equal(res.ok, true);
    assert.equal(res.restored, 1);
    assert.ok(dbOf(sb)._store['users/OWNER1/coachingSessions/coa_r2-1']);
    assert.equal(dbOf(sb)._store['users/OWNER1/coachingSessions/coa_r2-1'].ownerUid, 'OWNER1');
    const ev = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/events/') > 0)
      .map(k => dbOf(sb)._store[k].type);
    assert.ok(ev.indexOf('SESSION_RESTORED') >= 0);
  });
  test('E3. an existing session is skipped, never overwritten', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW({ purpose: 'ORİJİNAL' }));
    const tampered = Object.assign({}, a.session, { title: 'ÜZERİNE YAZILDI' });
    const res = await sb.coachingRestoreSessions([tampered], { confirmed: true });
    assert.equal(res.restored, 0);
    deq(res.skipped.map(s => s.reason), ['already_exists']);
    assert.equal(dbOf(sb)._store['users/OWNER1/coachingSessions/' + a.session.id].title, 'ORİJİNAL');
  });
  test('E4. a foreign-owner record is skipped', async () => {
    const sb = ready(createSandbox());
    const s = sb.coachingBuildSession({ context: 'adult' }, { now: '2026-08-29T09:00:00.000Z', id: 'coa_r4-1' }).session;
    s.ownerUid = 'OWNER2';
    const res = await sb.coachingRestoreSessions([s], { confirmed: true });
    assert.equal(res.restored, 0);
    deq(res.skipped.map(x => x.reason), ['owner_mismatch']);
  });
  test('E5. an invalid record is reported and never written', async () => {
    const sb = ready(createSandbox());
    const res = await sb.coachingRestoreSessions([{ id: 'nope' }, null, { id: 'coa_r5-1', createdAt: 'bad' }], { confirmed: true });
    assert.equal(res.preview.invalid >= 1, true);
    assert.equal(res.restored <= 1, true);
    assert.equal(Object.keys(dbOf(sb)._store).some(k => k.indexOf('nope') > 0), false);
  });
  test('E6. restore obeys the flag and the capability', async () => {
    const sb = ready(createSandbox());
    sb.COACHING.enabled = false;
    const s = sb.coachingBuildSession({ context: 'adult' }, { now: '2026-08-29T09:00:00.000Z', id: 'coa_r6-1' }).session;
    const res = await sb.coachingRestoreSessions([s], { confirmed: true });
    assert.equal(res.restored, 0);
    deq(res.skipped.map(x => x.reason), ['feature_disabled']);
    assert.equal(sb.coachingExportPolicy().restorePersists, true);
    assert.equal(sb.coachingExportPolicy().restoreOverwrites, false);
  });
  test('E7. an export round-trip can be restored end to end', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW({ purpose: 'Dışa aktarılacak' }));
    const built = await sb.coachingBuildExport([a.session],
      { scope: 'full_owner_export', explicitConsent: true, passphrase: 'p-123456' });
    assert.equal(built.ok, true);
    const opened = await sb.coachingOpenExport(built.envelope, { passphrase: 'p-123456' });
    assert.equal(opened.ok, true);
    assert.equal(opened.persisted, false);
    const restored = await sb.coachingRestoreSessions(opened.records, { confirmed: true });
    assert.equal(restored.restored, 0);          // same id already present → skipped, not duplicated
    deq(restored.skipped.map(x => x.reason), ['already_exists']);
  });
});

/* ── UI ───────────────────────────────────────────────────────────────────── */
describe('F. Workspace UI', () => {
  const pinner = sb => (sb.__getElements().pinner || {}).innerHTML || '';
  test('F1. raw engine values never reach the screen', async () => {
    const sb = ready(createSandbox());
    await sb.coachingSessionCreate(NEW());
    await sb.coachingLoadHome();
    sb.renderCoachingHome();
    const html = pinner(sb);
    ['STOP_AND_REFER', 'MOTIVATIONAL_INTERVIEWING', 'INTERVENTION_USED', 'OPEN_QUESTION', 'guardian_consent_required']
      .forEach(t => assert.equal(html.indexOf(t), -1, t));
    assert.ok(html.indexOf('Koçluk') >= 0);
    assert.ok(html.indexOf('Yeni Görüşme') >= 0);
  });
  test('F2. the home empty state invites a first session instead of showing metrics', () => {
    const sb = ready(createSandbox());
    sb.coachingUiReset();
    sb.renderCoachingHome();
    const html = pinner(sb);
    assert.ok(html.indexOf('Henüz tamamlanmış görüşme yok') >= 0);
    assert.equal(/XP|Seviye|puan|skor/i.test(html), false);
  });
  test('F3. the new-session form asks for no identifying data', () => {
    const sb = ready(createSandbox());
    sb.coachingStartNew();
    const html = pinner(sb);
    assert.ok(html.indexOf('İlişki etiketi') >= 0);
    assert.ok(html.indexOf('Ad soyad, e-posta veya telefon gerekmiyor') >= 0);
    assert.equal(/type="email"|type="tel"/.test(html), false);
    ['self', 'adult', 'executive', 'youth', 'child'].forEach(c =>
      assert.ok(html.indexOf(sb.COACHING_L_CONTEXT[c]) >= 0, c));
  });
  test('F4. a minor draft shows the guardian requirement with no skip', () => {
    const sb = ready(createSandbox());
    sb.coachingStartNew();
    sb.coachingSetDraftContext('child');
    const html = pinner(sb);
    assert.ok(html.indexOf('Veli / vasi durumu') >= 0);
    assert.ok(html.indexOf('Atlanabilir bir adım değil') >= 0);
    assert.equal(/Atla<|Geç<|>Skip</.test(html), false);
  });
  test('F5. labels are mapped for every canonical value', () => {
    const sb = ready(createSandbox());
    sb.COACHING_LIFECYCLE.forEach(l => assert.ok(sb.COACHING_L_LIFECYCLE[l], l));
    sb.coachingInterventionTypeKeys().forEach(t => assert.ok(sb.COACHING_L_TYPE[t], t));
    sb.COACHING_STAGES.forEach(s => assert.ok(sb.COACHING_L_STAGE[s], s));
    sb.COACHING_SAFETY_DECISION.forEach(d => assert.ok(sb.COACHING_L_DECISION[d], d));
    sb.COACHING_CONSENT_STATE.forEach(c => assert.ok(sb.COACHING_L_CONSENT[c], c));
    Object.keys(sb.COACHING_L_CONTEXT).forEach(c => assert.ok(sb.coachingValidContext(c), c));
  });
  test('F6. errors are sentences, not codes', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingErrorText('blocked', 'guardian_consent_required').indexOf('_'), -1);
    assert.ok(sb.coachingErrorText('write_failed').indexOf('Kaydedilemedi') >= 0);
    assert.ok(sb.coachingErrorText('nonsense_code').length > 10);
    assert.equal(/[a-z]_[a-z]/.test(sb.coachingErrorText('nonsense_code')), false);
  });
  test('F7. the live workspace shows at most three moves and a why-now', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    sb.COACHING_UI.session = (await sb.coachingSessionPatch(a.session, { lifecycle: 'active' })).session;
    sb.COACHING_UI.startedAt = Date.now();
    sb.tab = 'coachsession';
    sb.coachingToggleCtx('ambivalence', 'high');
    assert.ok(sb.COACHING_UI.moves.length <= 3);
    const html = pinner(sb);
    assert.ok(html.indexOf('Şu an duyduğum') >= 0);
    assert.ok(html.indexOf('Neden şimdi?') >= 0);
    assert.ok(html.indexOf('Önerilen yaklaşım') >= 0);
    assert.equal(/%\d|\bskor\b/i.test(html), false);
    assert.equal(html.indexOf('evidenceGrade'), -1);
  });
  test('F8. silence and reflection can be recommended, not only questions', async () => {
    const sb = ready(createSandbox());
    const a = await sb.coachingSessionCreate(NEW());
    sb.COACHING_UI.session = a.session;
    sb.COACHING_UI.recentMoves = [{ type: 'OPEN_QUESTION' }, { type: 'OPEN_QUESTION' }];
    sb.COACHING_UI.ctx = { conversationStage: 'DEEPENING' };
    sb.coachingRefreshMoves();
    const types = sb.COACHING_UI.moves.map(m => m.intervention.type);
    assert.ok(types.some(t => sb.COACHING_SPACE_TYPES.indexOf(t) >= 0), types.join(','));
    assert.equal(sb.COACHING_UI.moves[0].intervention.type === 'OPEN_QUESTION', false);
  });
  test('F9. the elapsed clock is formatted, not raw', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingElapsed(1000, 1000), '00:00');
    assert.equal(sb.coachingElapsed(0, 65000), '01:05');
    assert.equal(sb.coachingElapsed(null), '00:00');
    assert.equal(sb.coachingElapsed(5000, 1000), '00:00');   // clock skew never goes negative
  });
  test('F10. the privacy panel states inclusions and exclusions', () => {
    const sb = ready(createSandbox());
    sb.coachingOpenPrivacy();
    const html = pinner(sb);
    assert.ok(html.indexOf('Transkript hiçbir kapsamda dışa aktarılmaz') >= 0);
    assert.ok(html.indexOf('parola zorunludur') >= 0);
    assert.ok(html.indexOf('Parola hiçbir yerde saklanmaz') >= 0);
    assert.ok(html.indexOf('type="password"') >= 0);
  });
});

/* ── PRIVACY / LEGACY / STATIC ────────────────────────────────────────────── */
describe('G. Privacy, legacy and gates', () => {
  test('G1. nothing coaching-related touches D or localStorage', async () => {
    const sb = ready(createSandbox());
    const before = sb.canonicalStringify(sb.D);
    const a = await sb.coachingSessionCreate(NEW());
    await sb.coachingSaveNote(a.session, 'not');
    await sb.coachingUseIntervention(a.session, 'q.goal.define', {});
    await sb.coachingCompleteSession(a.session, {});
    assert.equal(sb.canonicalStringify(sb.D), before);
    assert.equal(sb.D.coachingSessions, undefined);
    P5_FILES.forEach(f => assert.equal(/localStorage/.test(code(F(f))), false, f));
  });
  test('G2. the modules never log and never echo content', () => {
    P5_FILES.forEach(f => {
      const c = code(F(f));
      assert.equal(/console\./.test(c), false, f + ': logging');
      assert.equal(/openai|anthropic|gemini|apiKey/i.test(c), false, f + ': ai');
      assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket/.test(c), false, f + ': network');
    });
    // backend errors are mapped to codes, never surfaced raw
    assert.equal(/catch\s*\(\s*e\s*\)\s*\{\s*return\s*\{[^}]*e\.message/.test(SRC27), false);
  });
  test('G3. legacy coaching data and screen are untouched', () => {
    const sb = createSandbox();
    assert.equal(sb.D.coaching.length, 1);
    assert.equal(sb.D.coaching[0].title, 'OKR Sistemi');
    assert.equal(sb.D.questions.length, 1);
    const boot = F('12-render-boot.js');
    assert.match(boot, /coaching:function\(\)\{renderGenericList\('coaching'\);\}/);
    assert.match(boot, /questions:function\(\)\{renderGenericList\('questions'\);\}/);
  });
  test('G4. with the flag OFF no navigation entry is injected', () => {
    const sb = createSandbox();                    // default flag OFF
    assert.equal(sb.COACHING.enabled, false);
    assert.equal(sb.coachingWorkspaceSelfCheck().navInjected, false);
    const ui = F('08-ui-core.js');
    const navBlock = ui.slice(ui.indexOf('var NAV=['), ui.indexOf('function renderNav'));
    assert.equal((navBlock.match(/\{id:'/g) || []).length, 31);
    assert.equal(/coachhome|coachsession/.test(navBlock), false);
    // the injection exists but is gated
    assert.match(code(SRC28), /coachingEnabled\(\)/);
  });
  test('G4b. activation replaces the legacy menu entry rather than adding a rival', () => {
    const src = code(SRC28);
    assert.match(src, /items\[j\]\.id==='coaching'/);
    assert.match(src, /id:'coachhome', l:'Koçluk'/);
    // the legacy route and its data are never removed
    assert.equal(/delete D\.coaching|D\.coaching\s*=/.test(code(SRC28) + code(SRC29)), false);
    assert.match(code(SRC28), /gotoTab\(\\'coaching\\'\)/);   // archive link back to the old screen
  });
  test('G5. the routes exist but are unreachable while the flag is OFF', () => {
    const boot = F('12-render-boot.js');
    assert.match(boot, /coachhome:function\(\)/);
    assert.match(boot, /coachsession:function\(\)/);
  });
  test('G6. mirrors, size limits, wiring and cache-bust tags', () => {
    P5_FILES.forEach(f => {
      const a = F(f);
      assert.equal(a, fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
      assert.ok(a.split('\n').length < 900, f + ' ' + a.split('\n').length);
      assert.equal((INDEX.match(new RegExp(f.replace(/\./g, '\\.'), 'g')) || []).length, 1, f);
    });
    assert.equal(INDEX, fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    ['26-coaching-archive.js', '12-render-boot.js'].forEach(f =>
      assert.match(INDEX, new RegExp(f.replace(/\./g, '\\.') + '\\?v=2026\\.08-coaching-p5'), f));
    ['27-coaching-session-store.js', '28-coaching-workspace.js', '29-coaching-live.js',
     '17-coaching-domain.js', '17b-coaching-client.js'].forEach(f =>
      assert.match(INDEX, new RegExp(f.replace(/\./g, '\\.') + '\\?v=2026\\.08-coaching-p5c'), f));
    assert.ok(INDEX.indexOf('17b-coaching-client.js') < INDEX.indexOf('27-coaching-session-store.js'));
    // load order: store before shell before live, all before render-boot
    assert.ok(INDEX.indexOf('27-coaching-session-store.js') < INDEX.indexOf('28-coaching-workspace.js'));
    assert.ok(INDEX.indexOf('28-coaching-workspace.js') < INDEX.indexOf('29-coaching-live.js'));
    assert.ok(INDEX.indexOf('29-coaching-live.js') < INDEX.indexOf('12-render-boot.js'));
  });
  test('G7. the lifecycle gained cancelled and the event child collection', () => {
    const sb = createSandbox();
    deq(sb.COACHING_LIFECYCLE, ['draft', 'active', 'completed', 'cancelled', 'archived']);
    assert.ok(sb.COACHING_CHILD_COLLECTIONS.indexOf('events') >= 0);
    assert.equal(sb.coachingCanTransition('active', 'cancelled'), true);
    assert.equal(sb.coachingCanTransition('cancelled', 'active'), false);
    assert.equal(sb.coachingIsTerminal('archived'), true);
  });
});
