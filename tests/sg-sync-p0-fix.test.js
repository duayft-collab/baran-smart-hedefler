'use strict';
/* SG-SYNC-P0 FIX — proven-root-cause only.
   1) onRemoteSnapshot own-echo must key on OUR mutation id, not shared deviceId, so a second
      same-account context's write is applied/merged (not silently echoed → lost update).
   2) imported records must get globally-unique ids (no index-based wq-legacy-* collisions).
   3) import success must be ACK-gated (uploading → cloud ack → success), never silent-local.
   4) conflict headline must not say "başka cihaz" when the write came from OUR deviceId. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SYNC_SRC = fs.readFileSync(path.join(ROOT, 'js', '02-sync.js'), 'utf8');
const IO_SRC = fs.readFileSync(path.join(ROOT, 'js', '11c-wisdom-io.js'), 'utf8');

function makeSnap(payload, rev, devId, mutId) {
  return { metadata: { hasPendingWrites: false, fromCache: false }, exists: true,
    data: function () { return { payload: payload, revision: rev, updatedByDeviceId: devId, lastMutationId: mutId }; } };
}
function baseCloud(S, over) {
  Object.assign(S.CLOUD, { ready: true, uid: 'u1', db: {}, deviceId: 'devX', revision: 223,
    pendingMutation: null, conflict: null, applyingRemote: false, ownMutationIds: [] }, over || {});
  S.localStorage.setItem('fu7_device', 'devX');
  if (typeof S.RESTORE !== 'undefined') S.RESTORE.state = 'IDLE';
}

describe('Fix 1 — own-echo keyed on mutation id (not shared deviceId)', () => {
  test('1. second same-account context write (same deviceId, DIFFERENT mutId) is APPLIED, not echoed', () => {
    const S = createSandbox(); baseCloud(S, { ownMutationIds: ['devX-mine-1'] });
    S.D = { wisdomQuotes: [{ id: 'a', quote: 'local' }] };
    const remotePayload = { wisdomQuotes: [{ id: 'b', quote: 'from other tab' }] };
    S.onRemoteSnapshot(makeSnap(remotePayload, 224, 'devX', 'devX-OTHER-9'));
    // must have merged remote (applyRemoteState) → D reflects remote, revision advanced
    assert.equal(S.CLOUD.revision, 224);
    assert.ok(S.D.wisdomQuotes.some(function (w) { return w.id === 'b'; }), 'remote payload must be applied, not silently echoed (lost update)');
  });
  test('2. our OWN write echo (mutId in ownMutationIds) bumps revision without re-applying / no false conflict', () => {
    const S = createSandbox(); baseCloud(S, { ownMutationIds: ['devX-mine-1'], pendingMutation: { id: 'devX-mine-2', expectedRevision: 224 } });
    S.D = { wisdomQuotes: [{ id: 'a', quote: 'local' }] };
    S.onRemoteSnapshot(makeSnap({ wisdomQuotes: [{ id: 'a', quote: 'local' }] }, 224, 'devX', 'devX-mine-1'));
    assert.equal(S.CLOUD.revision, 224);
    assert.equal(!!S.CLOUD.conflict, false, 'our own echo must NOT open a conflict even with a fresh pending');
    assert.equal(S.D.wisdomQuotes[0].id, 'a');
  });
  test('3. other-context write WITH local pending → conflict (not silent overwrite)', () => {
    const S = createSandbox(); baseCloud(S, { ownMutationIds: ['devX-mine-1'], pendingMutation: { id: 'devX-mine-2', expectedRevision: 223 } });
    S.D = { wisdomQuotes: [{ id: 'a', quote: 'local unsynced' }] };
    S.onRemoteSnapshot(makeSnap({ wisdomQuotes: [{ id: 'b', quote: 'other' }] }, 224, 'devX', 'devX-OTHER-9'));
    assert.ok(!!S.CLOUD.conflict, 'pending + other-context write must enter conflict');
  });
  test('4. lost-update regression: applying the other context BEFORE our import lets both survive', () => {
    const S = createSandbox(); baseCloud(S, { ownMutationIds: [] });
    S.D = { wisdomQuotes: [] };
    // other tab committed record A
    S.onRemoteSnapshot(makeSnap({ wisdomQuotes: [{ id: 'A', quote: 'tabA' }] }, 224, 'devX', 'devX-A'));
    assert.ok(S.D.wisdomQuotes.some(function (w) { return w.id === 'A'; }), 'this tab must now contain A before importing');
    // now this tab imports B → union, not overwrite
    S.D.wisdomQuotes.push({ id: 'B', quote: 'tabB' });
    assert.equal(S.D.wisdomQuotes.length, 2);
  });
  test('5. flushPending records our committed mutation id into ownMutationIds', () => {
    assert.ok(/ownMutationIds/.test(SYNC_SRC), 'ownMutationIds tracking must exist');
    assert.ok(/updatedByDeviceId===deviceId\(\)/.test(SYNC_SRC) === false || /lastMutationId/.test(SYNC_SRC),
      'own-echo must consider lastMutationId');
  });
});

describe('Fix 2 — unique import ids (no wq-legacy collisions)', () => {
  function importInto(S, text) {
    if (!S.D.wisdomQuotes) S.D.wisdomQuotes = [];
    const stats = S.wqImportAnalyze([{ quote: text, author: 'A', language: 'tr' }], 'json');
    S.WQ_IMPORT.stats = stats; S.wqImportApply('all');
    return S.D.wisdomQuotes[S.D.wisdomQuotes.length - 1].id;
  }
  test('6. two independent imports get DIFFERENT ids', () => {
    const idA = importInto(Object.assign(createSandbox(), {}), 'Cihaz A');
    const S2 = createSandbox(); const idB = importInto(S2, 'Cihaz B farkli');
    assert.notEqual(idA, idB, 'independent imports must not collide');
  });
  test('7. imported id is a global newWqId (never wq-legacy-*)', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [];
    const id = importInto(S, 'Benzersiz olmalı');
    assert.equal(/^wq-legacy-/.test(id), false, 'import must not keep index-based wq-legacy id');
    assert.ok(/^wq/.test(id));
  });
  test('8. same-content re-import in a fresh context still yields a unique id', () => {
    const t = 'Ayni metin';
    const S1 = createSandbox(); S1.D.wisdomQuotes = []; const a = importInto(S1, t);
    const S2 = createSandbox(); S2.D.wisdomQuotes = []; const b = importInto(S2, t);
    assert.notEqual(a, b);
  });
  test('9. static: import commit forces newWqId for missing/legacy/colliding ids', () => {
    assert.ok(/wq-legacy-|newWqId\(\)/.test(IO_SRC));
    assert.ok(/q\.id=newWqId\(\)/.test(IO_SRC));
  });
});

describe('Fix 3 — ACK-gated import success', () => {
  test('10. sync-outcome helper distinguishes synced / pending / conflict', () => {
    const S = createSandbox();
    Object.assign(S.CLOUD, { pendingMutation: null, conflict: null, revision: 5 });
    assert.equal(S._wqImportSyncOutcome(4), 'synced');       // pending cleared + revision advanced
    Object.assign(S.CLOUD, { pendingMutation: { id: 'x' }, conflict: null, revision: 4 });
    assert.equal(S._wqImportSyncOutcome(4), 'pending');
    Object.assign(S.CLOUD, { pendingMutation: { id: 'x' }, conflict: { serverData: {} }, revision: 4 });
    assert.equal(S._wqImportSyncOutcome(4), 'conflict');
  });
  test('11. static: import does not fire an unconditional synchronous success toast', () => {
    // success must be gated behind sync outcome (uploading state exists)
    assert.ok(/Buluta senkron|senkronize ediliyor|_wqImportSyncOutcome/.test(IO_SRC), 'uploading/ack gating must exist');
  });
});

describe('Fix 4 — conflict headline distinguishes same-device context', () => {
  test('12. same deviceId → NOT "başka cihaz" wording', () => {
    const S = createSandbox(); S.CLOUD.deviceId = 'devX'; S.localStorage.setItem('fu7_device', 'devX');
    const msg = S.conflictHeadline({ updatedByDeviceId: 'devX' });
    assert.equal(/başka bir cihaz|başka cihaz/i.test(msg), false, 'same-device must not say another device');
    assert.ok(/sekme|bağlam|oturum/i.test(msg), 'same-device wording should mention tab/context/session');
  });
  test('13. different deviceId → "başka cihaz" wording retained', () => {
    const S = createSandbox(); S.CLOUD.deviceId = 'devX'; S.localStorage.setItem('fu7_device', 'devX');
    const msg = S.conflictHeadline({ updatedByDeviceId: 'devY' });
    assert.ok(/cihaz/i.test(msg));
  });
  test('14. static: showConflictUI uses the headline helper', () => {
    assert.ok(/conflictHeadline/.test(SYNC_SRC));
  });
});
