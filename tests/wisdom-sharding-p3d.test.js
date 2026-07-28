'use strict';
/* SMART-GOALS Wisdom Sharding P3d — Legacy Read Optimization + Resilience Layer.
   Sharded = primary; legacy = pasif fallback (yalnız kapı-sonrası hata). Runtime health
   (source/fallbackReason/count/lastFallbackAt/lastSuccessfulRead) + rozet + sağlık kartı.
   0 write, 0 listener, yeni koleksiyon yok. Normal çalışmada legacy okunmaz (tek cache). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11t-wisdom-runtime-health.js'), 'utf8');

function wq(id, over) { return Object.assign({ id: id, quote: 'S' + id, author: 'A', active: true, tags: [] }, over || {}); }

describe('Runtime health functions', () => {
  test('1. primary available + read source sharded when sharded active', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    S._wisdomStoreSeed([wq('a'), wq('b')], true);
    S.WQ_STORE_STATE.source = 'sharded'; S.WQ_STORE_STATE.lastSuccessfulRead = Date.now();
    assert.equal(S.wisdomPrimaryAvailable(), true);
    assert.equal(S.wisdomReadSource(), 'sharded');
    assert.equal(S.wisdomShouldFallback(), false);
    assert.equal(S.wisdomFallbackReason(), null);
  });
  test('2. fallback active when not sharded + fallbackReason set', () => {
    const S = createSandbox(); S.wisdomStoreReset(); S.D.wisdomQuotes = [wq('a')];
    S.WQ_STORE_STATE.fallbackReason = 'load_failed'; S.WQ_STORE_STATE.fallbackCount = 2;
    assert.equal(S.wisdomPrimaryAvailable(), false);
    assert.equal(S.wisdomReadSource(), 'legacy');
    assert.equal(S.wisdomShouldFallback(), true);
    assert.equal(S.wisdomFallbackReason(), 'load_failed');
  });
  test('3. pre-migration legacy (no fallbackReason) is NOT a fallback', () => {
    const S = createSandbox(); S.wisdomStoreReset(); S.D.wisdomQuotes = [wq('a')];
    assert.equal(S.wisdomShouldFallback(), false); // migration yok → fallback değil
    assert.equal(S.wisdomSourceBadgeHtml(), ''); // rozet yok
  });
  test('4. wisdomRuntimeHealth + wisdomFallbackMetrics shape', () => {
    const S = createSandbox(); S._wisdomStoreSeed([wq('a')], true); S.WQ_STORE_STATE.source = 'sharded';
    const h = S.wisdomRuntimeHealth();
    ['source', 'primaryAvailable', 'fallback', 'fallbackReason', 'fallbackCount', 'lastFallbackAt', 'lastSuccessfulRead', 'cacheSize'].forEach(function (k) {
      assert.ok(Object.prototype.hasOwnProperty.call(h, k), k);
    });
    assert.equal(h.cacheSize, 1);
    const m = S.wisdomFallbackMetrics();
    assert.ok('count' in m && 'lastAt' in m && 'reason' in m);
  });
});

describe('Fallback recording on activation (via boot activate)', () => {
  function fakeDb() {
    const cols = {};
    function colRef(pth) { if (!cols[pth]) cols[pth] = new Map(); const m = cols[pth];
      return { _map: m, doc(id) { const k = String(id); return { set(d) { m.set(k, Object.assign({}, m.get(k), JSON.parse(JSON.stringify(d)))); return Promise.resolve(); }, get() { return Promise.resolve({ exists: m.has(k), data: () => m.get(k) }); }, update(p) { if (!m.has(k)) return Promise.reject(new Error('nf')); m.set(k, Object.assign({}, m.get(k), p)); return Promise.resolve(); }, delete() { m.delete(k); return Promise.resolve(); } }; },
        get() { const d = []; m.forEach((v, k) => d.push({ id: k, data: () => v })); return Promise.resolve({ size: d.length, forEach: (cb) => d.forEach(cb) }); } }; }
    return { _cols: cols, collection() { return { doc(uid) { return { collection(sub) { return colRef('users/' + uid + '/' + sub); } }; } }; }, batch() { const o = []; return { set(r, d) { o.push(['s', r, d]); }, delete(r) { o.push(['d', r]); }, commit() { o.forEach(x => x[0] === 's' ? x[1].set(x[2]) : x[1].delete()); return Promise.resolve(); } }; } };
  }
  async function seedMigrated(S, records, metaCount) {
    const db = fakeDb(); S.CLOUD = { uid: 'u', db, ready: true, user: { isAnonymous: false }, revision: 100 };
    const col = db._cols['users/u/wisdomQuotes'] = new Map(); records.forEach(r => col.set(String(r.id), JSON.parse(JSON.stringify(r))));
    const cs = (await S.wisdomContentChecksum(records)).hash;
    const app = db._cols['users/u/app'] = new Map();
    app.set('wisdomMeta', { sharded: true, count: metaCount == null ? records.length : metaCount, checksum: cs });
    app.set('wisdomMigration', { status: 'completed', total: records.length, migratedCount: records.length, sourceChecksum: cs, targetChecksum: cs });
    return db;
  }
  test('5. successful activation => source sharded + lastSuccessfulRead', async () => {
    const S = createSandbox(); await seedMigrated(S, [wq('a'), wq('b')]);
    await S.wisdomBootActivate();
    assert.equal(S.WQ_STORE_STATE.source, 'sharded');
    assert.ok(S.WQ_STORE_STATE.lastSuccessfulRead > 0);
    assert.equal(S.wisdomShouldFallback(), false);
  });
  test('6. GENUINE failure (empty collection) => FALLBACK recorded (legacy, reason, count++)', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    await seedMigrated(S, [], 0); // boş koleksiyon → empty_cache (gerçek fallback; P3b-2: count drift artık fallback DEĞİL)
    const r = await S.wisdomBootActivate();
    assert.equal(r.reason, 'empty_cache');
    assert.equal(S.WQ_STORE_STATE.source, 'legacy');
    assert.equal(S.WQ_STORE_STATE.fallbackReason, 'empty_cache');
    assert.equal(S.WQ_STORE_STATE.fallbackCount, 1);
    assert.ok(S.WQ_STORE_STATE.lastFallbackAt > 0);
    assert.equal(S.wisdomShouldFallback(), true);
    assert.equal(S.wqList().length, 1); // legacy fallback okundu
  });
});

describe('UI: source badge', () => {
  test('7. primary => "Bulut Arşivi" badge (subtle, role=status)', () => {
    const S = createSandbox(); S._wisdomStoreSeed([wq('a')], true);
    const b = S.wisdomSourceBadgeHtml();
    assert.match(b, /Bulut Arşivi/); assert.match(b, /role="status"/); assert.match(b, /<svg/);
    assert.equal(/Yerel Güvenlik/.test(b), false);
  });
  test('8. fallback => "Yerel Güvenlik Arşivi" badge + tooltip', () => {
    const S = createSandbox(); S.wisdomStoreReset(); S.WQ_STORE_STATE.fallbackReason = 'load_failed';
    const b = S.wisdomSourceBadgeHtml();
    assert.match(b, /Yerel Güvenlik Arşivi/);
    assert.match(b, /title="Bulut arşivi geçici olarak kullanılamadığı için güvenlik kopyası kullanılmaktadır\."/);
    assert.match(b, /role="status"/);
  });
  test('9. badge responsive (no fixed width) + no popup/toast', () => {
    const S = createSandbox(); S.WQ_STORE_STATE.fallbackReason = 'error';
    const b = S.wisdomSourceBadgeHtml();
    assert.equal(/width:\s*\d{2,}px/.test(b.replace(/(min|max)-width:\s*\d+px/g, '')), false);
    assert.equal(/showModal|class="ov"|toast/i.test(b), false);
  });
});

describe('UI: archive health card', () => {
  test('10. health card shows source / cache / fallback count / times', () => {
    const S = createSandbox(); S._wisdomStoreSeed([wq('a'), wq('b'), wq('c')], true); S.WQ_STORE_STATE.source = 'sharded'; S.WQ_STORE_STATE.lastSuccessfulRead = Date.now();
    const h = S.wisdomArchiveHealthCardHtml();
    assert.match(h, /Arşiv Durumu/); assert.match(h, /Kaynak/); assert.match(h, /Bulut \(Sharded\)/);
    assert.match(h, /Cache/); assert.match(h, />3</); assert.match(h, /Fallback Sayısı/);
    assert.match(h, /Son Başarılı Okuma/); assert.match(h, /Son Fallback/);
    assert.equal(/width:\s*\d{2,}px/.test(h.replace(/(min|max)-width:\s*\d+px/g, '')), false);
  });
  test('11. injected into stats panel + header badge into wisdom screen', () => {
    const a = fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8');
    const st = fs.readFileSync(path.join(ROOT, 'js', '11s-wisdom-stats.js'), 'utf8');
    assert.match(a, /wisdomSourceBadgeHtml/);
    assert.match(st, /wisdomArchiveHealthCardHtml/);
  });
});

describe('Performance & read-only', () => {
  test('12. sharded mode: wqList returns cache (single source, no legacy scan)', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('L1'), wq('L2'), wq('L3')];
    S._wisdomStoreSeed([wq('s1'), wq('s2')], true);
    assert.equal(S.wqList().length, 2); // sharded cache, legacy 3 taranmadı
    assert.equal(S.wqList() === S.D.wisdomQuotes, false);
  });
  test('13. health functions never mutate D or store', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')]; S._wisdomStoreSeed([wq('x')], true);
    const bd = JSON.stringify(S.D.wisdomQuotes); const bs = S.WQ_STORE.size;
    S.wisdomRuntimeHealth(); S.wisdomReadSource(); S.wisdomShouldFallback(); S.wisdomSourceBadgeHtml(); S.wisdomArchiveHealthCardHtml(); S.wisdomFallbackMetrics();
    assert.equal(JSON.stringify(S.D.wisdomQuotes), bd); assert.equal(S.WQ_STORE.size, bs);
  });
});

describe('Static guards', () => {
  test('G1. no write / no listener / no new collection', () => {
    assert.equal(/\bsave\s*\(|writeLocal\s*\(|\bsnap\s*\(|D\.[a-zA-Z_]+\s*=[^=]|onSnapshot\s*\(|\.subscribe\s*\(|\.set\s*\(|\.batch\s*\(/.test(SRC), false);
  });
  test('G2. reads only WQ_STORE_STATE / wisdomStoreIsSharded (no legacy scan in health)', () => {
    assert.match(SRC, /wisdomStoreIsSharded\(\)/);
    assert.equal(/D\.wisdomQuotes/.test(SRC), false); // sağlık modülü legacy diziyi taramaz
  });
  test('G3. fallback recorded only post-gate in 02c (real fallback)', () => {
    const mig = fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8');
    // P3b-2: count_mismatch artık fallback değil (self-heal). Gerçek fallback'ler:
    assert.match(mig, /_wexFallback\('load_failed'\)/);
    assert.match(mig, /_wexFallback\('empty_cache'\)/);
    assert.equal(/_wexFallback\('count_mismatch'\)/.test(mig), false); // count_mismatch fallback KALDIRILDI
    // no_migration/gate_failed dallarında fallback YOK
    const noMig = mig.slice(mig.indexOf("activationReason='no_migration'"), mig.indexOf("activationReason='no_migration'") + 90);
    assert.equal(/_wexFallback/.test(noMig), false);
  });
  test('G4. mirror byte-identical + module < 900', () => {
    ['11t-wisdom-runtime-health.js', '02b-wisdom-store.js', '02c-wisdom-migration.js', '11a-wisdom-quotes.js', '11s-wisdom-stats.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(SRC.split('\n').length < 900);
  });
});
