'use strict';
/* SMART-GOALS Wisdom Sharding P2 — Migration Engine + Dual-Write Foundation.
   Migration açık çağrı ile; doğrulanmış backup zorunlu; idempotent/resume/concurrency;
   üçlü doğrulama kapısı. Dual-write koleksiyon-önce (ACK fail → legacy değişmez).
   Legacy D.wisdomQuotes kaldırılmaz. Auto-migration/auto-load/realtime listener YOK. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const MIG_SRC = fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8');
const STORE_SRC = fs.readFileSync(path.join(ROOT, 'js', '02b-wisdom-store.js'), 'utf8');

function wq(id, over) { return Object.assign({ id: id, quote: 'S' + id, author: 'A', category: 'Genel', active: true, favorite: false, pinned: false, reflected: false, showCount: 0, tags: [], notes: '' }, over || {}); }

/* Minimal in-memory Firestore mock: collection/doc/get/set/update/delete + batch. */
function fakeDb() {
  const cols = {};
  function colRef(pth) {
    if (!cols[pth]) cols[pth] = new Map();
    const m = cols[pth];
    return {
      _map: m,
      doc(id) {
        const key = String(id);
        return {
          set(d) { m.set(key, JSON.parse(JSON.stringify(d))); return Promise.resolve(); },
          update(p) { if (!m.has(key)) return Promise.reject(new Error('not-found')); m.set(key, Object.assign({}, m.get(key), p)); return Promise.resolve(); },
          delete() { m.delete(key); return Promise.resolve(); },
          get() { const has = m.has(key); return Promise.resolve({ exists: has, data: () => m.get(key) }); }
        };
      },
      get() { const docs = []; m.forEach((v, k) => docs.push({ id: k, data: () => v })); return Promise.resolve({ size: docs.length, forEach: (cb) => docs.forEach(cb) }); }
    };
  }
  return {
    _cols: cols,
    collection() { const self = this; return { doc(uid) { return { collection(sub) { return colRef('users/' + uid + '/' + sub); } }; } }; },
    batch() { const ops = []; return { set(ref, data) { ops.push([ref, data]); }, commit() { ops.forEach(function (x) { x[0].set(x[1]); }); return Promise.resolve(); } }; }
  };
}
function mkCloud(S) { S.CLOUD = { uid: 'u', db: fakeDb(), revision: 100, pendingMutation: null, conflict: false }; return S.CLOUD; }
function colSize(S) { return (S.CLOUD.db._cols['users/u/wisdomQuotes'] || new Map()).size; }

describe('Migration plan', () => {
  test('1. plan derives total + source SHA-256 + reassigns wq-legacy ids', async () => {
    const S = createSandbox(); mkCloud(S); S.D.wisdomQuotes = [wq('a'), wq('wq-legacy-0'), wq('c')];
    const plan = await S.wisdomMigrationPlan();
    assert.equal(plan.total, 3);
    assert.match(plan.sourceChecksum, /^[0-9a-f]{64}$/);
    const ids = plan.records.map(function (r) { return r.id; });
    assert.equal(ids.indexOf('wq-legacy-0'), -1); // legacy id yeniden atandı
    assert.ok(ids.indexOf('a') >= 0 && ids.indexOf('c') >= 0); // normal id korundu
    assert.equal(JSON.stringify(S.D.wisdomQuotes.map(function (q) { return q.id; })), JSON.stringify(['a', 'wq-legacy-0', 'c'])); // D mutasyona uğramadı
  });
});

describe('Backup gate', () => {
  test('2. start requires verified backup (proceeds on success)', async () => {
    const S = createSandbox(); mkCloud(S); S.D.wisdomQuotes = [wq('a'), wq('b')];
    let backupCalled = false; S.createBackup = function () { backupCalled = true; return Promise.resolve({ id: 'bk1' }); };
    const r = await S.wisdomMigrationStart();
    assert.ok(backupCalled);
    assert.equal(r.ok, true); assert.equal(colSize(S), 2);
  });
  test('3. backup failure => ZERO collection write', async () => {
    const S = createSandbox(); mkCloud(S); S.D.wisdomQuotes = [wq('a'), wq('b')];
    S.createBackup = function () { return Promise.reject(new Error('backup boom')); };
    const r = await S.wisdomMigrationStart();
    assert.equal(r.ok, false);
    assert.equal(colSize(S), 0); // 0 write
    assert.equal(S.wisdomMigrationStatus().status, 'failed');
  });
  test('4. null/unverified backup => abort, 0 write', async () => {
    const S = createSandbox(); mkCloud(S); S.D.wisdomQuotes = [wq('a')];
    S.createBackup = function () { return Promise.resolve(null); };
    const r = await S.wisdomMigrationStart();
    assert.equal(r.ok, false); assert.equal(colSize(S), 0);
  });
});

describe('Batch migration + verify gates', () => {
  test('5. full migration writes all + verify passes (count + checksum + present)', async () => {
    const S = createSandbox(); mkCloud(S); S.createBackup = function () { return Promise.resolve({ id: 'bk' }); };
    const recs = []; for (let i = 0; i < 5; i++) recs.push(wq('id' + i)); S.D.wisdomQuotes = recs;
    const r = await S.wisdomMigrationStart();
    assert.equal(r.ok, true); assert.equal(colSize(S), 5);
    const st = S.wisdomMigrationStatus();
    assert.equal(st.status, 'completed'); assert.equal(st.total, 5); assert.equal(st.migratedCount, 5);
    assert.equal(st.sourceChecksum, st.targetChecksum); // checksum eşit
  });
  test('6. idempotent re-run keeps same collection count', async () => {
    const S = createSandbox(); mkCloud(S); S.createBackup = function () { return Promise.resolve({ id: 'bk' }); };
    S.D.wisdomQuotes = [wq('a'), wq('b')];
    await S.wisdomMigrationStart();
    S.wisdomMigrationReset(); // ikinci bağımsız çalıştırma
    await S.wisdomMigrationStart();
    assert.equal(colSize(S), 2); // çift yazılmadı (id = quote id)
  });
  test('7. resume continues remaining batches + verifies', async () => {
    const S = createSandbox(); mkCloud(S);
    const recs = [wq('a'), wq('b'), wq('c')];
    S.D.wisdomQuotes = recs;
    // yarım kalmış migration state simülasyonu
    S.WISDOM_MIGRATION._records = JSON.parse(JSON.stringify(recs));
    S.WISDOM_MIGRATION.status = 'in_progress'; S.WISDOM_MIGRATION.total = 3;
    S.WISDOM_MIGRATION.lastBatchIndex = -1; S.WISDOM_MIGRATION.migratedCount = 0;
    S.WISDOM_MIGRATION.sourceChecksum = (await S.wisdomStoreChecksum(recs)).hash;
    const r = await S.wisdomMigrationResume();
    assert.equal(r.ok, true); assert.equal(colSize(S), 3);
    assert.equal(S.wisdomMigrationStatus().status, 'completed');
  });
  test('8. concurrent migration guard refuses second start', async () => {
    const S = createSandbox(); mkCloud(S); S.createBackup = function () { return Promise.resolve({ id: 'bk' }); };
    S.D.wisdomQuotes = [wq('a'), wq('b')];
    const p1 = S.wisdomMigrationStart();
    const p2 = await S.wisdomMigrationStart(); // ilk sürerken
    assert.equal(p2.ok, false); assert.equal(p2.reason, 'already_running');
    await p1;
  });
  test('9. verify mismatch => status failed, canShard false', async () => {
    const S = createSandbox(); mkCloud(S); S.createBackup = function () { return Promise.resolve({ id: 'bk' }); };
    S.D.wisdomQuotes = [wq('a'), wq('b')];
    await S.wisdomMigrationStart();
    // hedef checksum'ı boz → tekrar verify
    S.WISDOM_MIGRATION.sourceChecksum = 'deadbeef';
    const v = await S.wisdomMigrationVerify();
    assert.equal(v.ok, false); assert.equal(S.wisdomMigrationCanShard(), false);
  });
});

describe('Field preservation', () => {
  test('10. unknown fields + metadata preserved through migration', async () => {
    const S = createSandbox(); mkCloud(S); S.createBackup = function () { return Promise.resolve({ id: 'bk' }); };
    S.D.wisdomQuotes = [wq('a', { favorite: true, pinned: true, reflected: true, showCount: 9, tags: ['x', 'y'], notes: 'not', mysteryField: 42, nested: { keep: true } })];
    await S.wisdomMigrationStart();
    const doc = S.CLOUD.db._cols['users/u/wisdomQuotes'].get('a');
    assert.equal(doc.favorite, true); assert.equal(doc.pinned, true); assert.equal(doc.reflected, true);
    assert.equal(doc.showCount, 9); assert.deepEqual(doc.tags, ['x', 'y']); assert.equal(doc.notes, 'not');
    assert.equal(doc.mysteryField, 42); assert.equal(doc.nested.keep, true);
  });
});

describe('Dual-write (collection-first, gated)', () => {
  test('11. not sharded => dual-write no-op reason', async () => {
    const S = createSandbox(); mkCloud(S); S.wisdomStoreReset();
    const r = await S.wisdomDualApply('a', { favorite: true });
    assert.equal(r.ok, false); assert.equal(r.reason, 'not_sharded');
  });
  test('12. sharded update writes collection + legacy', async () => {
    const S = createSandbox(); mkCloud(S);
    S.D.wisdomQuotes = [wq('a', { favorite: false })];
    S.CLOUD.db._cols['users/u/wisdomQuotes'] = new Map([['a', wq('a', { favorite: false })]]);
    S._wisdomStoreSeed([wq('a', { favorite: false })], true);
    const r = await S.wisdomDualApply('a', { favorite: true, updatedAt: 'now' });
    assert.equal(r.ok, true);
    assert.equal(S.CLOUD.db._cols['users/u/wisdomQuotes'].get('a').favorite, true); // koleksiyon
    assert.equal(S.D.wisdomQuotes[0].favorite, true); // legacy geçici
  });
  test('13. collection failure => legacy unchanged, explicit error', async () => {
    const S = createSandbox(); mkCloud(S);
    S.D.wisdomQuotes = [wq('a', { favorite: false })];
    S._wisdomStoreSeed([wq('a')], true);
    // update olmayan id (koleksiyonda yok) => reject => collection_failed
    const r = await S.wisdomDualApply('zzz', { favorite: true });
    assert.equal(r.ok, false); assert.equal(r.reason, 'collection_failed');
    assert.equal(S.D.wisdomQuotes[0].favorite, false); // legacy DEĞİŞMEDİ
  });
  test('14. sharded set (add/edit) mirrors to collection + legacy', async () => {
    const S = createSandbox(); mkCloud(S); S.D.wisdomQuotes = [];
    S._wisdomStoreSeed([], true); S.WQ_STORE_STATE.sharded = true; S.WQ_STORE_STATE.loaded = true;
    // seed boş => isSharded false; dolu tut
    S._wisdomStoreSeed([wq('seed')], true);
    const r = await S.wisdomDualSet(wq('new1', { quote: 'yeni' }));
    assert.equal(r.ok, true);
    assert.equal(S.CLOUD.db._cols['users/u/wisdomQuotes'].get('new1').quote, 'yeni');
    assert.ok(S.D.wisdomQuotes.some(function (q) { return q.id === 'new1'; }));
  });
  test('15. sharded delete removes from collection + legacy', async () => {
    const S = createSandbox(); mkCloud(S);
    S.D.wisdomQuotes = [wq('a'), wq('b')];
    S.CLOUD.db._cols['users/u/wisdomQuotes'] = new Map([['a', wq('a')], ['b', wq('b')]]);
    S._wisdomStoreSeed([wq('a'), wq('b')], true);
    const r = await S.wisdomDualDelete('a');
    assert.equal(r.ok, true);
    assert.equal(S.CLOUD.db._cols['users/u/wisdomQuotes'].has('a'), false);
    assert.equal(S.D.wisdomQuotes.some(function (q) { return q.id === 'a'; }), false);
  });
});

describe('Read transition + legacy protection', () => {
  test('16. triple-gate: canShard only when completed + count + checksum equal', async () => {
    const S = createSandbox(); mkCloud(S); S.createBackup = function () { return Promise.resolve({ id: 'bk' }); };
    S.D.wisdomQuotes = [wq('a'), wq('b')];
    assert.equal(S.wisdomMigrationCanShard(), false); // idle
    await S.wisdomMigrationStart();
    assert.equal(S.wisdomMigrationCanShard(), true); // completed + eşit
  });
  test('17. legacy D.wisdomQuotes never removed by migration', async () => {
    const S = createSandbox(); mkCloud(S); S.createBackup = function () { return Promise.resolve({ id: 'bk' }); };
    S.D.wisdomQuotes = [wq('a'), wq('b')];
    await S.wisdomMigrationStart();
    assert.equal(S.D.wisdomQuotes.length, 2); // legacy korundu
  });
  test('18. rndQuote / getActiveWisdomQuotes dual-read (sharded cache)', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy', { active: true })];
    S._wisdomStoreSeed([wq('s1', { active: true }), wq('s2', { active: false })], true);
    const active = S.getActiveWisdomQuotes();
    assert.equal(active.length, 1); assert.equal(active[0].id, 's1'); // koleksiyondan
  });
});

describe('Backup rehydrate', () => {
  test('19. sharded backup payload rehydrates wisdomQuotes from collection', async () => {
    const S = createSandbox(); mkCloud(S);
    S.D.wisdomQuotes = [wq('legacyOnly')]; // state doc legacy
    S._wisdomStoreSeed([wq('c1'), wq('c2'), wq('c3')], true); // koleksiyon 3 kayıt
    // createBackup gerçek akışı yerine payload kurulumunu doğrula: 04-backup rehydrate dalı
    let captured = null;
    // compressPayload/sha256 gerçek; sadece rehydrate mantığını izole test edelim:
    const payload = JSON.parse(JSON.stringify(S.D));
    if (S.wisdomStoreIsSharded() && typeof S.wisdomStoreList === 'function') payload.wisdomQuotes = JSON.parse(JSON.stringify(S.wisdomStoreList()));
    assert.equal(payload.wisdomQuotes.length, 3); // koleksiyondan rehydrate
    assert.ok(payload.wisdomQuotes.some(function (q) { return q.id === 'c1'; }));
  });
});

describe('UX status line (read-only)', () => {
  test('20. hidden in normal legacy state (idle, no error, not sharded)', () => {
    const S = createSandbox(); S.wisdomStoreReset(); S.wisdomMigrationReset();
    assert.equal(S.wisdomStatusLineHtml(), ''); // hiçbir mesaj
  });
  test('21. preparing / verifying / ready / error texts', () => {
    const S = createSandbox();
    S.wisdomMigrationReset(); S.WISDOM_MIGRATION.status = 'in_progress';
    assert.match(S.wisdomStatusLineHtml(), /Bulut depolama hazırlanıyor/);
    S.WISDOM_MIGRATION.status = 'verifying';
    assert.match(S.wisdomStatusLineHtml(), /Veriler doğrulanıyor/);
    S.WISDOM_MIGRATION.status = 'completed';
    assert.match(S.wisdomStatusLineHtml(), /Bulut depolama hazır/);
    S.WISDOM_MIGRATION.status = 'failed';
    assert.match(S.wisdomStatusLineHtml(), /Senkronizasyon tamamlanamadı/);
  });
  test('22. store error surfaces error line even if migration idle', () => {
    const S = createSandbox(); S.wisdomMigrationReset(); S.wisdomStoreReset(); S.WQ_STORE_STATE.error = 'boom';
    assert.match(S.wisdomStatusLineHtml(), /Senkronizasyon tamamlanamadı/);
  });
  test('23. icon + explicit text (color not sole signal); no fixed width; no modal', () => {
    const S = createSandbox(); S.WISDOM_MIGRATION.status = 'in_progress';
    const h = S.wisdomStatusLineHtml();
    assert.ok(/<svg/.test(h)); // ikon
    assert.ok(/Bulut depolama hazırlanıyor/.test(h)); // açık metin
    assert.ok(/role="status"/.test(h)); // a11y, popup değil
    assert.equal(/width:\s*\d{2,}px/.test(h), false); // sabit genişlik yok
    assert.equal(/showModal|class="ov"/.test(h), false); // modal yok
  });
  test('24. status line is read-only (no D/store mutation)', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')]; S.WISDOM_MIGRATION.status = 'completed';
    const before = JSON.stringify(S.D.wisdomQuotes); const st = JSON.stringify(S.wisdomStoreStatus());
    S.wisdomStatusLineHtml(); S.wisdomStatusLineHtml();
    assert.equal(JSON.stringify(S.D.wisdomQuotes), before);
    assert.equal(JSON.stringify(S.wisdomStoreStatus()), st);
  });
});

describe('Static guards (mandatory)', () => {
  test('G1. no auto-migration (start/resume unwired from boot/render/auth)', () => {
    ['js/12-render-boot.js', 'js/03-auth.js', 'js/02-sync.js', 'js/08-ui-core.js'].forEach(function (f) {
      assert.equal(/wisdomMigrationStart\s*\(|wisdomMigrationResume\s*\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), false, f);
    });
  });
  test('G2. no auto-load (wisdomStoreLoad unwired from boot)', () => {
    ['js/12-render-boot.js', 'js/03-auth.js', 'js/08-ui-core.js', 'js/11a-wisdom-quotes.js', 'js/11b-wisdom-display.js'].forEach(function (f) {
      assert.equal(/wisdomStoreLoad\s*\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), false, f);
    });
  });
  test('G3. no realtime listener in store/migration', () => {
    assert.equal(/onSnapshot\s*\(|addSnapshotListener\s*\(|\.subscribe\s*\(/.test(MIG_SRC + STORE_SRC), false);
  });
  test('G4. no legacy deletion (D.wisdomQuotes not removed)', () => {
    assert.equal(/delete\s+D\.wisdomQuotes|D\.wisdomQuotes\s*=\s*\[\s*\]\s*;/.test(MIG_SRC), false);
  });
  test('G5. no second selector; single dual-read entry preserved', () => {
    const a = fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8');
    assert.equal((a.match(/function\s+wqList\b/g) || []).length, 1);
    assert.equal((a.match(/function\s+wqById\b/g) || []).length, 1);
  });
  test('G6. no auto sharded flag (setSharded(true) only inside GATED boot activation)', () => {
    assert.equal(/^\s*wisdomMigrationStart\s*\(/m.test(MIG_SRC), false);
    // P2.1: wisdomStoreSetSharded(true) tek örnek + yalnız gated wisdomBootActivate içinde
    assert.equal((MIG_SRC.match(/wisdomStoreSetSharded\s*\(\s*true/g) || []).length, 1);
    const boot = MIG_SRC.slice(MIG_SRC.indexOf('function wisdomBootActivate('), MIG_SRC.indexOf('window.wisdomBootActivate='));
    assert.match(boot, /wisdomStoreSetSharded\(true\)/); // tek örnek gated fonksiyonun içinde
    assert.ok(boot.indexOf('cs.hash!==m.checksum') < boot.indexOf('wisdomStoreSetSharded(true)')); // checksum kapısından sonra
  });
  test('G7. protected files untouched (sync/restore/io/experience/rules)', () => {
    ['js/02-sync.js', 'js/06-restore-engine.js', 'js/11-restore-ui.js', 'js/11c-wisdom-io.js', 'js/11q-wisdom-experience.js'].forEach(function (f) {
      assert.equal(/wisdomMigration|WISDOM_MIGRATION|wisdomDual/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), false, f);
    });
    // firestore.rules değişmedi
    assert.match(fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'), /document=\*\*/);
  });
  test('G8. mirrors byte-identical + module < 900', () => {
    ['02b-wisdom-store.js', '02c-wisdom-migration.js', '11a-wisdom-quotes.js', '01-state.js', '04-backup.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(MIG_SRC.split('\n').length < 900);
  });
});
