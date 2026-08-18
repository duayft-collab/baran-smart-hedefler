'use strict';
/* SMART-GOALS Wisdom Import — SHARDED WRITE-PATH FIX (INSTRUCTION 3, P0).
   Kök neden: okuma yolu sharded (wqList→WQ_STORE) ama yazma yolu (_wqCommitImport)
   yalnız legacy D.wisdomQuotes'a yazıyordu → sharded modda içe aktarılan sözler
   GÖRÜNMÜYOR (sessiz kısmi import). Düzeltme: sharded modda import wisdomStoreBatchWrite
   ile koleksiyona yazar, WQ_STORE cache güncellenir, legacy mirror + save + meta-count
   senkronu + yazma-sonrası görünürlük doğrulaması. replace sharded modda BLOKE (0 yazma).
   Bu dosya ÖNCE (RED) yazıldı; düzeltme öncesi çoğu test BAŞARISIZ olur. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const IO_SRC = fs.readFileSync(path.join(ROOT, 'js', '11c-wisdom-io.js'), 'utf8');
const ATTACHED = '/Users/baran/Downloads/peynirimi-kim-kapti-15-soz-import.json';

function wq(id, over) {
  return Object.assign({ id: id, quote: 'S' + id, author: 'Y', category: 'Genel',
    active: true, favorite: false, pinned: false, reflected: false, showCount: 0, tags: [], language: 'tr' }, over || {});
}
/* Stable-wrapper fake Firestore (test-side monkeypatch fidelity: colRef must return the
   SAME object each call so batch/get patches actually affect production reads/writes). */
function fakeDb() {
  const cols = {}; const wrappers = {};
  function colRef(pth) {
    if (!cols[pth]) cols[pth] = new Map();
    if (!wrappers[pth]) {
      const m = cols[pth];
      wrappers[pth] = { _map: m,
        doc(id) { const key = String(id); return {
            set(d) { m.set(key, JSON.parse(JSON.stringify(d))); return Promise.resolve(); },
            get() { return Promise.resolve({ exists: m.has(key), data: () => m.get(key) }); },
            update(p) { if (!m.has(key)) return Promise.reject(new Error('nf')); m.set(key, Object.assign({}, m.get(key), p)); return Promise.resolve(); },
            delete() { m.delete(key); return Promise.resolve(); } }; },
        get() { const docs = []; m.forEach((v, k) => docs.push({ id: k, data: () => v })); return Promise.resolve({ size: docs.length, forEach: (cb) => docs.forEach(cb) }); } };
    }
    return wrappers[pth];
  }
  return { _cols: cols, _getColRef: colRef,
    collection() { return { doc(uid) { return { collection(sub) { return colRef('users/' + uid + '/' + sub); } }; } }; },
    batch() { const ops = []; return { set(ref, d) { ops.push([ref, d]); }, commit() { ops.forEach(x => x[0].set(x[1])); return Promise.resolve(); } }; }
  };
}
/* Sharded sandbox: collection cache + WQ_STORE seeded + sharded flag on; legacy fallback empty. */
function shardedSandbox(existing) {
  const S = createSandbox();
  const db = fakeDb();
  S.CLOUD = { uid: 'u', db: db, ready: true, user: { isAnonymous: false }, revision: 100, pendingMutation: null, conflict: false };
  const col = db._cols['users/u/wisdomQuotes'] = new Map();
  existing.forEach(r => col.set(String(r.id), JSON.parse(JSON.stringify(r))));
  db._cols['users/u/app'] = new Map();
  db._cols['users/u/app'].set('wisdomMeta', { sharded: true, count: existing.length });
  db._cols['users/u/app'].set('wisdomMigration', { status: 'completed', total: existing.length, migratedCount: existing.length });
  S._wisdomStoreSeed(existing, true);            // WQ_STORE cache + sharded=true + loaded=true
  S.WQ_STORE_STATE.metaCount = existing.length;
  S.D.wisdomQuotes = [];                          // legacy fallback (small/empty)
  S.setInterval = function () { return 0; };      // ACK poller no-op
  S.setTimeout = function (fn) { return 0; };
  S.render = function () {}; S.closeModal = function () {};
  return { S, db };
}
function analyzeAndStage(S, rows, fmt) { const st = S.wqImportAnalyze(rows, fmt || 'json'); S.WQ_IMPORT.stats = st; return st; }
function attachedRows() { return JSON.parse(fs.readFileSync(ATTACHED, 'utf8')); }

// ═══════════════════════════════════════════════════════════════════════════
describe('Root cause: sharded read vs legacy write mismatch', () => {
  test('1. BEFORE-fix symptom is gone: sharded append becomes visible via wqList()', async () => {
    const { S } = shardedSandbox([wq('sh1'), wq('sh2')]);
    assert.equal(S.wisdomStoreIsSharded(), true);
    const before = S.wqList().length; // 2 (sharded)
    analyzeAndStage(S, [wq('new1', { quote: 'Yeni söz bir' }), wq('new2', { quote: 'Yeni söz iki' })]);
    await S.wqImportApply('skip');
    const after = S.wqList().length;
    assert.equal(after, before + 2, 'imported quotes must be visible through the sharded read path');
    assert.ok(S.wqList().some(q => q.quote === 'Yeni söz bir'));
  });
  test('2. imported records land in the sharded collection + WQ_STORE cache (not only legacy)', async () => {
    const { S, db } = shardedSandbox([wq('sh1')]);
    analyzeAndStage(S, [wq('new1', { quote: 'Bulut sözü' })]);
    await S.wqImportApply('all');
    const col = db._cols['users/u/wisdomQuotes'];
    // collection now has 2 docs, WQ_STORE cache has 2, and the new quote is present
    assert.equal(col.size, 2, 'sharded collection must receive the write');
    assert.equal(S.WQ_STORE.size, 2, 'WQ_STORE cache must reflect the write');
    assert.ok(Array.from(col.values()).some(q => q.quote === 'Bulut sözü'));
  });
});

describe('Attached file (peynirimi-kim-kapti, 30 records)', () => {
  test('3. all 30 attached records import successfully and become visible (sharded)', async () => {
    const { S } = shardedSandbox([wq('sh1'), wq('sh2'), wq('sh3')]);
    const rows = attachedRows();
    assert.equal(rows.length, 30);
    const st = analyzeAndStage(S, rows, 'json');
    assert.equal(st.valid, 30); assert.equal(st.invalidCount, 0); assert.equal(st.newCount, 30);
    const before = S.wqList().length; // 3
    const res = await S.wqImportApply('skip');
    assert.ok(res && res.ok, 'import must report success');
    assert.equal(res.added, 30);
    assert.equal(S.wqList().length, before + 30, 'all 30 visible after import');
    assert.ok(S.wqById('ozs-5123') && S.wqById('ozs-5124'), 'specific attached ids present + reachable');
  });
});

describe('Non-sharded path unchanged', () => {
  test('4. legacy (non-sharded) append still writes to D.wisdomQuotes + one save()', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = [wq('l1')]; S.wisdomStoreReset(); // sharded=false
    assert.equal(S.wisdomStoreIsSharded(), false);
    let saved = 0; S.save = function () { saved++; }; S.setInterval = function () { return 0; }; S.render = function () {}; S.closeModal = function () {};
    const st = S.wqImportAnalyze([wq('n1', { quote: 'Legacy yeni' })], 'json'); S.WQ_IMPORT.stats = st;
    const added = S.wqImportApply('skip');
    assert.equal(added, 1);
    assert.equal(saved, 1, 'exactly one save() on legacy path (unchanged)');
    assert.ok(S.D.wisdomQuotes.some(q => q.quote === 'Legacy yeni'));
  });
});

describe('Duplicate handling', () => {
  test('5. unique imported ids kept; colliding/legacy ids reassigned (sharded)', async () => {
    const { S } = shardedSandbox([wq('ozs-5123', { quote: 'Var olan' })]); // collision with attached id
    analyzeAndStage(S, [wq('ozs-5123', { quote: 'Çakışan yeni' }), wq('ozs-9999', { quote: 'Benzersiz yeni' })]);
    await S.wqImportApply('all');
    // ozs-9999 kept; the colliding ozs-5123 import got a fresh id (both quotes present, no overwrite)
    assert.ok(S.wqById('ozs-9999'), 'unique id kept');
    assert.ok(S.wqList().some(q => q.quote === 'Var olan'), 'existing record not overwritten');
    assert.ok(S.wqList().some(q => q.quote === 'Çakışan yeni'), 'colliding import added under a fresh id');
  });
});

describe('Error handling: no false success, no silent partial', () => {
  test('6. batch-write failure → no false success, zero added, stage reported, legacy untouched', async () => {
    const { S, db } = shardedSandbox([wq('sh1')]);
    // force sharded batch commit to fail
    db.batch = function () { return { set() {}, commit() { return Promise.reject(new Error('cloud down')); } }; };
    analyzeAndStage(S, [wq('n1', { quote: 'Kayıp söz' })]);
    let toasts = []; S.wqToast = function (m, e) { toasts.push({ m: String(m), e: !!e }); };
    const res = await S.wqImportApply('skip');
    assert.ok(res && res.ok === false, 'must NOT report success');
    assert.equal(res.stage, 'batch_write');
    assert.equal(res.added, 0);
    assert.equal(S.wqList().length, 1, 'no records became visible');
    assert.equal(S.D.wisdomQuotes.length, 0, 'legacy array NOT touched on batch failure (no silent partial)');
    assert.ok(toasts.some(t => t.e), 'an error toast was shown');
    assert.equal(toasts.some(t => /içe aktarıldı/.test(t.m) && !t.e), false, 'no success toast');
  });
  test('7. meta-count synchronization failure is reported (records still visible, non-fatal)', async () => {
    const { S, db } = shardedSandbox([wq('sh1')]);
    let commits = 0;
    const realBatch = db.batch.bind(db);
    db.batch = function () {
      commits++;
      if (commits === 1) return realBatch();           // batch write succeeds
      return { set() {}, commit() { return Promise.reject(new Error('meta down')); } }; // meta sync fails
    };
    analyzeAndStage(S, [wq('n1', { quote: 'Söz meta' })]);
    const res = await S.wqImportApply('skip');
    assert.ok(res && res.ok, 'import itself succeeds (records written + visible)');
    assert.equal(res.metaSync, 'failed', 'meta-count failure surfaced in the result');
    assert.equal(S.wqList().length, 2, 'records still visible');
  });
  test('9. batch failure produces zero partial state across store/cache/legacy', async () => {
    const { S, db } = shardedSandbox([wq('sh1'), wq('sh2')]);
    db.batch = function () { return { set() {}, commit() { return Promise.reject(new Error('boom')); } }; };
    analyzeAndStage(S, [wq('a', { quote: 'A' }), wq('b', { quote: 'B' }), wq('c', { quote: 'C' })]);
    await S.wqImportApply('all');
    assert.equal(S.WQ_STORE.size, 2, 'cache unchanged');
    assert.equal(S.wqList().length, 2, 'visible unchanged');
    assert.equal(S.D.wisdomQuotes.length, 0, 'legacy unchanged');
  });
});

describe('Sharded replace is blocked (zero writes)', () => {
  test('8. replace under sharding → blocked before any write, clear message, 0 writes', async () => {
    const { S, db } = shardedSandbox([wq('sh1'), wq('sh2')]);
    analyzeAndStage(S, [wq('n1', { quote: 'Yeni' })]);
    let toasts = []; S.wqToast = function (m, e) { toasts.push({ m: String(m), e: !!e }); };
    let backups = 0; S.createBackup = function () { backups++; return Promise.resolve({ id: 'b1' }); };
    const res = await S.wqImportApply('replace');
    assert.ok(res && res.aborted, 'replace must abort');
    assert.equal(res.reason, 'sharded_replace_blocked');
    assert.equal(S.WQ_STORE.size, 2, 'no sharded write');
    assert.equal(S.D.wisdomQuotes.length, 0, 'no legacy write (no silent fallback)');
    assert.equal(db._cols['users/u/wisdomQuotes'].size, 2, 'collection untouched');
    assert.equal(backups, 0, 'no backup taken (blocked before any side effect)');
    assert.ok(toasts.some(t => /korumalı|ayrı|desteklenmiyor|migrasyon|geçiş/i.test(t.m)), 'clear explanatory message');
  });
});

describe('Legacy mirror dedup (INSTRUCTION 7 — no hidden duplicates)', () => {
  test('L1. mirror does NOT duplicate content already present in legacy as orphans (id differs)', async () => {
    // Simulate the production state: legacy already holds an orphan of the imported content
    // (left by the historical buggy import) under a DIFFERENT id than what we import.
    const { S } = shardedSandbox([wq('sh1')]);
    S.D.wisdomQuotes = [{ id: 'ozs-orphan', quote: 'Bulut sözü', author: 'Y', category: 'Genel', active: true, language: 'tr' }];
    analyzeAndStage(S, [wq('new1', { quote: 'Bulut sözü', author: 'Y' })]); // same content as the orphan
    await S.wqImportApply('all');
    const norm = s => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
    const legCopies = S.D.wisdomQuotes.filter(q => norm(q.quote) === norm('Bulut sözü') && norm(q.author) === norm('Y')).length;
    assert.equal(legCopies, 1, 'legacy must keep a single copy of the content (no mirror duplicate)');
    // sharded store still received the record (visible)
    assert.ok(S.wqList().some(q => q.quote === 'Bulut sözü'), 'record visible in sharded store');
  });
  test('L2. mirror does NOT duplicate by id already present in legacy', async () => {
    const { S } = shardedSandbox([wq('sh1')]);
    S.D.wisdomQuotes = [{ id: 'dup-id', quote: 'Eski içerik', author: 'Z', category: 'Genel', active: true, language: 'tr' }];
    analyzeAndStage(S, [wq('dup-id', { quote: 'Yeni içerik farklı', author: 'Q' })]);
    await S.wqImportApply('all');
    const idCopies = S.D.wisdomQuotes.filter(q => String(q.id) === 'dup-id').length;
    assert.equal(idCopies, 1, 'legacy must not hold two records with the same id');
  });
  test('L3. clean legacy: mirror still adds new records (regression guard)', async () => {
    const { S } = shardedSandbox([wq('sh1')]);
    S.D.wisdomQuotes = []; // clean legacy
    analyzeAndStage(S, [wq('n1', { quote: 'Tamamen yeni' }), wq('n2', { quote: 'Bir diğeri' })]);
    await S.wqImportApply('all');
    assert.equal(S.D.wisdomQuotes.length, 2, 'clean legacy still receives the mirror');
  });
});

describe('Single-flight: repeated submit does not double-write', () => {
  test('10. two concurrent wqImportApply calls do not create duplicate writes', async () => {
    const { S } = shardedSandbox([wq('sh1')]);
    analyzeAndStage(S, [wq('n1', { quote: 'Tek sefer' })]);
    const p1 = S.wqImportApply('skip');
    const p2 = S.wqImportApply('skip'); // fired before p1 resolves
    await Promise.all([p1, p2]);
    const count = S.wqList().filter(q => q.quote === 'Tek sefer').length;
    assert.equal(count, 1, 'imported record must appear exactly once');
  });
});

describe('Success reporting completeness', () => {
  test('11. success result carries count + skipped + target + visible', async () => {
    const { S } = shardedSandbox([wq('sh1', { quote: 'Aynı söz', author: 'Y' })]);
    // one duplicate (same quote+author) + one new → skip mode skips the dup
    analyzeAndStage(S, [wq('d1', { quote: 'Aynı söz', author: 'Y' }), wq('n1', { quote: 'Farklı söz' })]);
    const res = await S.wqImportApply('skip');
    assert.ok(res.ok);
    assert.equal(res.added, 1);
    assert.equal(res.skipped, 1);
    assert.equal(res.target, 'sharded');
    assert.equal(res.visible, S.wqList().length);
  });
});

describe('Import hygiene: attribution-conflict warning (INSTRUCTION 8 Phase 3)', () => {
  function boot(S, existing) { S.D.wisdomQuotes = existing; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = []; S.wisdomStoreReset(); }
  test('A1. same quote text + DIFFERENT author → non-blocking ATTRIBUTION_CONFLICT warning (still importable)', () => {
    const S = createSandbox();
    boot(S, [wq('e1', { quote: 'Cesaret ilk adım', author: 'Yanlış Çeviri Metni' })]);
    const st = S.wqImportAnalyze([wq('n1', { quote: 'Cesaret ilk adım', author: 'Spencer Johnson' })], 'json');
    assert.equal(st.invalidCount, 0, 'not blocking');
    assert.equal(st.newCount, 1, 'still counted as new/importable');
    const conflict = st.warnings.find(w => w.code === 'ATTRIBUTION_CONFLICT');
    assert.ok(conflict, 'attribution-conflict warning present');
    assert.ok(/Yanlış Çeviri Metni/.test(conflict.rawValuePreview) && /Spencer Johnson/.test(conflict.rawValuePreview), 'shows existing + incoming author');
  });
  test('A2. same quote text + SAME author → DUPLICATE_CONTENT (not attribution conflict)', () => {
    const S = createSandbox();
    boot(S, [wq('e1', { quote: 'Aynı söz', author: 'Aynı Yazar' })]);
    const st = S.wqImportAnalyze([wq('n1', { quote: 'Aynı söz', author: 'Aynı Yazar' })], 'json');
    assert.equal(st.dupExisting, 1);
    assert.equal(st.warnings.some(w => w.code === 'ATTRIBUTION_CONFLICT'), false);
  });
  test('A3. unique quote text → no attribution warning', () => {
    const S = createSandbox();
    boot(S, [wq('e1', { quote: 'Tamamen farklı', author: 'X' })]);
    const st = S.wqImportAnalyze([wq('n1', { quote: 'Bambaşka bir söz', author: 'Y' })], 'json');
    assert.equal(st.warnings.some(w => w.code === 'ATTRIBUTION_CONFLICT'), false);
  });
});

describe('Static guards', () => {
  test('12. import commit reuses sharded write primitives (no new write engine)', () => {
    assert.ok(/wisdomStoreBatchWrite\s*\(/.test(IO_SRC), 'must reuse wisdomStoreBatchWrite');
    assert.ok(/wisdomSyncMetaCount|wisdomImportSyncMeta/.test(IO_SRC), 'must sync meta count');
    assert.ok(/wisdomStoreIsSharded\s*\(/.test(IO_SRC), 'must branch on sharded state');
  });
  test('13. mirror byte-identical + module < 900 lines', () => {
    const a = fs.readFileSync(path.join(ROOT, 'js', '11c-wisdom-io.js'), 'utf8');
    const b = fs.readFileSync(path.join(ROOT, 'public', 'js', '11c-wisdom-io.js'), 'utf8');
    assert.equal(a, b, '11c mirror');
    assert.ok(a.split('\n').length < 900, '11c < 900');
  });
});
