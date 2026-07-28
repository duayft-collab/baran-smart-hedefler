'use strict';
/* SMART-GOALS Wisdom Sharding P3b — Activation Gate Hotfix.
   Aktivasyon kapısı COUNT-tabanlı (checksum kapıda değil, yalnız warning+self-heal).
   İçerik checksum'ı volatile alanları (showCount/lastShownAt/updatedAt…) hariç tutar.
   Legacy fallback: koleksiyon yok / count=0 / load error / count mismatch. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const MIG_SRC = fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8');
const STORE_SRC = fs.readFileSync(path.join(ROOT, 'js', '02b-wisdom-store.js'), 'utf8');

function wq(id, over) { return Object.assign({ id: id, quote: 'S' + id, author: 'A', active: true, tags: [], showCount: 0, lastShownAt: null, updatedAt: '2026-01-01T00:00:00.000Z' }, over || {}); }
function fakeDb() {
  const cols = {};
  function colRef(pth) {
    if (!cols[pth]) cols[pth] = new Map(); const m = cols[pth];
    return { _map: m,
      doc(id) { const k = String(id); return {
        set(d) { m.set(k, Object.assign({}, m.get(k), JSON.parse(JSON.stringify(d)))); return Promise.resolve(); },
        get() { return Promise.resolve({ exists: m.has(k), data: () => m.get(k) }); },
        update(p) { if (!m.has(k)) return Promise.reject(new Error('nf')); m.set(k, Object.assign({}, m.get(k), p)); return Promise.resolve(); },
        delete() { m.delete(k); return Promise.resolve(); } }; },
      get() { const d = []; m.forEach((v, k) => d.push({ id: k, data: () => v })); return Promise.resolve({ size: d.length, forEach: (cb) => d.forEach(cb) }); } };
  }
  return { _cols: cols,
    collection() { return { doc(uid) { return { collection(sub) { return colRef('users/' + uid + '/' + sub); } }; } }; },
    batch() { const ops = []; return { set(r, d) { ops.push([r, d]); }, commit() { ops.forEach(x => x[0].set(x[1])); return Promise.resolve(); } }; } };
}
function authed(db) { return { uid: 'u', db: db, ready: true, user: { isAnonymous: false }, revision: 100, pendingMutation: null, conflict: false }; }
async function seed(S, records, metaChecksumMode) {
  const db = fakeDb(); S.CLOUD = authed(db);
  const col = db._cols['users/u/wisdomQuotes'] = new Map();
  records.forEach(r => col.set(String(r.id), JSON.parse(JSON.stringify(r))));
  const content = (await S.wisdomContentChecksum(records)).hash;
  const chk = metaChecksumMode === 'stale' ? 'deadbeefstale' : content;
  const app = db._cols['users/u/app'] = new Map();
  app.set('wisdomMeta', { sharded: true, count: records.length, checksum: chk });
  app.set('wisdomMigration', { status: 'completed', total: records.length, migratedCount: records.length, sourceChecksum: chk, targetChecksum: chk });
  return { db, content };
}

describe('Content checksum (volatile-excluded)', () => {
  test('1. volatile fields do not change content checksum', async () => {
    const S = createSandbox();
    const a = [wq('x', { showCount: 0, lastShownAt: null, updatedAt: '2026-01-01T00:00:00.000Z' })];
    const b = [wq('x', { showCount: 99, lastShownAt: '2026-07-28T00:00:00.000Z', updatedAt: '2026-07-28T00:00:00.000Z' })];
    const ca = await S.wisdomContentChecksum(a);
    const cb = await S.wisdomContentChecksum(b);
    assert.equal(ca.hash, cb.hash); // volatile değişimi checksum'ı değiştirmez
  });
  test('2. content change DOES change checksum', async () => {
    const S = createSandbox();
    const ca = await S.wisdomContentChecksum([wq('x', { quote: 'A' })]);
    const cb = await S.wisdomContentChecksum([wq('x', { quote: 'B' })]);
    assert.notEqual(ca.hash, cb.hash);
  });
  test('3. WISDOM_VOLATILE_FIELDS covers required set', () => {
    const S = createSandbox();
    ['showCount', 'lastShownAt', 'updatedAt', 'lastViewedAt', 'lastPopupAt', 'lastRotationAt'].forEach(function (f) {
      assert.ok(S.WISDOM_VOLATILE_FIELDS.indexOf(f) >= 0, f);
    });
  });
});

describe('Count-based activation gate', () => {
  test('4. count matches + checksum matches => ready', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    await seed(S, [wq('a'), wq('b')], 'match');
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, true); assert.equal(S.wisdomStoreIsSharded(), true);
    assert.equal(S.WQ_STORE_STATE.activationReason, 'ready');
  });
  test('5. count matches + checksum STALE => activate anyway (metadata_update)', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    await seed(S, [wq('a'), wq('b'), wq('c')], 'stale');
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, true); assert.equal(r.checksumOk, false);
    assert.equal(S.wisdomStoreIsSharded(), true);           // checksum BLOKE ETMEZ
    assert.equal(S.wqList().length, 3);                     // koleksiyondan
  });
  test('6. volatile drift (showCount) does NOT even warn (content checksum stable)', async () => {
    const S = createSandbox();
    const recs = [wq('a'), wq('b')];
    await seed(S, recs, 'match');
    // koleksiyondaki bir kaydın volatile alanını değiştir (display marking simülasyonu)
    S.CLOUD.db._cols['users/u/wisdomQuotes'].get('a').showCount = 42;
    S.CLOUD.db._cols['users/u/wisdomQuotes'].get('a').lastShownAt = '2026-07-28T00:00:00.000Z';
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, true); assert.equal(r.checksumOk, true); // volatile hariç → checksum hâlâ eşleşir
    assert.equal(S.WQ_STORE_STATE.activationReason, 'ready');
  });
});

describe('Self-heal', () => {
  test('7. stale checksum triggers single meta+manifest self-heal write', async () => {
    const S = createSandbox();
    const { db, content } = await seed(S, [wq('a'), wq('b')], 'stale');
    await S.wisdomBootActivate();
    // meta.checksum content-checksum'a şifalandı
    const meta = db._cols['users/u/app'].get('wisdomMeta');
    assert.equal(meta.checksum, content);
    const mig = db._cols['users/u/app'].get('wisdomMigration');
    assert.equal(mig.sourceChecksum, content); assert.equal(mig.targetChecksum, content);
    assert.equal(S.WQ_STORE_STATE._selfHealed, true);
  });
  test('8. matching checksum does NOT self-heal (no write)', async () => {
    const S = createSandbox();
    await seed(S, [wq('a')], 'match');
    await S.wisdomBootActivate();
    assert.notEqual(S.WQ_STORE_STATE._selfHealed, true); // yazma yok
  });
});

describe('Legacy fallback preserved', () => {
  test('9. no migration docs => legacy', async () => {
    const S = createSandbox(); S.CLOUD = authed(fakeDb()); S.D.wisdomQuotes = [wq('a')];
    const r = await S.wisdomBootActivate();
    assert.equal(r.reason, 'no_migration'); assert.equal(S.wisdomStoreIsSharded(), false);
    assert.equal(S.wqList().length, 1);
  });
  test('10. empty collection => legacy (empty_cache)', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seed(S, [], 'match'); // meta.count 0
    const r = await S.wisdomBootActivate();
    assert.equal(S.wisdomStoreIsSharded(), false);
    assert.ok(['empty_cache', 'count_mismatch'].indexOf(r.reason) >= 0);
  });
  test('11. count mismatch => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seed(S, [wq('a'), wq('b')], 'match');
    S.CLOUD.db._cols['users/u/wisdomQuotes'].delete('b'); // koleksiyon 1, meta 2
    const r = await S.wisdomBootActivate();
    assert.equal(r.reason, 'count_mismatch'); assert.equal(S.wisdomStoreIsSharded(), false);
  });
  test('12. load error => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seed(S, [wq('a')], 'match');
    const orig = S.CLOUD.db.collection.bind(S.CLOUD.db);
    S.CLOUD.db.collection = function () { return { doc() { return { collection(sub) { if (sub === 'wisdomQuotes') return { get() { return Promise.reject(new Error('boom')); } }; return orig().doc('u').collection(sub); } }; } }; };
    const r = await S.wisdomBootActivate();
    assert.equal(S.wisdomStoreIsSharded(), false);
    assert.ok(['load_failed', 'error'].indexOf(r.reason) >= 0);
  });
});

describe('UX status line (P3b states)', () => {
  test('13. new activation texts', () => {
    const S = createSandbox();
    S.WQ_STORE_STATE.activationReason = 'checking'; assert.match(S.wisdomStatusLineHtml(), /Bulut arşivi hazırlanıyor/);
    S.WQ_STORE_STATE.activationReason = 'verifying'; assert.match(S.wisdomStatusLineHtml(), /Bulut doğrulanıyor/);
    S.WQ_STORE_STATE.activationReason = 'metadata_update'; assert.match(S.wisdomStatusLineHtml(), /Metadata güncelleniyor/);
    S.WQ_STORE_STATE.activationReason = 'ready'; S.WQ_STORE_STATE.activationReady = true; assert.match(S.wisdomStatusLineHtml(), /Bulut arşivi hazır/);
    S.WQ_STORE_STATE.activationReady = false; S.WQ_STORE_STATE.activationReason = 'load_failed'; assert.match(S.wisdomStatusLineHtml(), /Yerel arşiv kullanılıyor/);
  });
  test('14. status line icon + role + no fixed width + no modal', () => {
    const S = createSandbox(); S.WQ_STORE_STATE.activationReason = 'metadata_update';
    const h = S.wisdomStatusLineHtml();
    assert.ok(/<svg/.test(h) && /role="status"/.test(h));
    assert.equal(/width:\s*\d{2,}px/.test(h.replace(/(min|max)-width:\s*\d+px/g, '')), false);
    assert.equal(/showModal|class="ov"/.test(h), false);
  });
});

describe('Static guards', () => {
  test('G1. activation gate is count-based (no checksum equality block)', () => {
    const fn = MIG_SRC.slice(MIG_SRC.indexOf('function wisdomBootActivate('), MIG_SRC.indexOf('window.wisdomBootActivate='));
    // checksum karşılaştırması var ama BLOKE eden 'checksum_mismatch' reason'ı YOK
    assert.equal(/checksum_mismatch/.test(fn), false);
    assert.match(fn, /WQ_STORE\.size!==m\.count/); // count kapısı
    assert.match(fn, /wisdomContentChecksum\(\)/); // içerik checksum warning
  });
  test('G2. self-heal only on mismatch + once + no realtime listener', () => {
    assert.match(MIG_SRC, /_wexSelfHealMeta/);
    assert.match(MIG_SRC, /_selfHealed/);
    assert.equal(/onSnapshot\s*\(|\.subscribe\s*\(/.test(MIG_SRC), false);
  });
  test('G3. content checksum excludes volatile in store', () => {
    assert.match(STORE_SRC, /WISDOM_VOLATILE_FIELDS/);
    assert.match(STORE_SRC, /_wqStripVolatile/);
  });
  test('G4. mirror byte-identical + module < 900', () => {
    ['02b-wisdom-store.js', '02c-wisdom-migration.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(MIG_SRC.split('\n').length < 900);
  });
});
