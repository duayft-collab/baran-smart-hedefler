'use strict';
/* SMART-GOALS Wisdom Sharding P3b-2 — Count-Drift Recovery Hotfix.
   Dual-write add/delete meta.count'u senkronlar; boot'ta count farkı BLOKE ETMEZ →
   koleksiyon otorite, aktive + self-heal. Gerçek fallback (load/empty/error) korunur. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const MIG_SRC = fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8');
const STORE_SRC = fs.readFileSync(path.join(ROOT, 'js', '02b-wisdom-store.js'), 'utf8');

function wq(id, over) { return Object.assign({ id: id, quote: 'S' + id, author: 'A', active: true, tags: [], showCount: 0 }, over || {}); }
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
    batch() { const o = []; return { set(r, d) { o.push(['s', r, d]); }, delete(r) { o.push(['d', r]); }, commit() { o.forEach(x => x[0] === 's' ? x[1].set(x[2]) : x[1].delete()); return Promise.resolve(); } }; } };
}
function authed(db) { return { uid: 'u', db, ready: false, user: { isAnonymous: false }, revision: 100, pendingMutation: null, conflict: false }; }
function appMeta(S) { return (S.CLOUD.db._cols['users/u/app'] || new Map()).get('wisdomMeta'); }
function appMig(S) { return (S.CLOUD.db._cols['users/u/app'] || new Map()).get('wisdomMigration'); }
async function seed(S, records) {
  const db = fakeDb(); S.CLOUD = authed(db);
  const col = db._cols['users/u/wisdomQuotes'] = new Map(); records.forEach(r => col.set(String(r.id), JSON.parse(JSON.stringify(r))));
  const cs = (await S.wisdomContentChecksum(records)).hash;
  const app = db._cols['users/u/app'] = new Map();
  app.set('wisdomMeta', { sharded: true, count: records.length, checksum: cs });
  app.set('wisdomMigration', { status: 'completed', total: records.length, migratedCount: records.length, sourceChecksum: cs, targetChecksum: cs });
  return db;
}

describe('Dual-write count synchronization', () => {
  test('1. sharded add updates meta.count + manifest total', async () => {
    const S = createSandbox(); const db = await seed(S, [wq('a'), wq('b')]);
    S._wisdomStoreSeed([wq('a'), wq('b')], true); S.WQ_STORE_STATE.metaCount = 2; S.D.wisdomQuotes = [wq('a'), wq('b')];
    const r = await S.wisdomDualSet(wq('c', { quote: 'yeni' }));
    assert.equal(r.ok, true);
    assert.equal(appMeta(S).count, 3); // meta senkronlandı
    assert.equal(appMig(S).total, 3);
    assert.equal(S.WQ_STORE_STATE.metaCount, 3);
  });
  test('2. sharded delete updates meta.count', async () => {
    const S = createSandbox(); await seed(S, [wq('a'), wq('b')]);
    S.CLOUD.db._cols['users/u/wisdomQuotes'] = new Map([['a', wq('a')], ['b', wq('b')]]);
    S._wisdomStoreSeed([wq('a'), wq('b')], true); S.WQ_STORE_STATE.metaCount = 2; S.D.wisdomQuotes = [wq('a'), wq('b')];
    await S.wisdomDualDelete('a');
    assert.equal(appMeta(S).count, 1); assert.equal(S.WQ_STORE_STATE.metaCount, 1);
  });
  test('3. edit (no count change) => no meta.count write', async () => {
    const S = createSandbox(); await seed(S, [wq('a')]);
    S.CLOUD.db._cols['users/u/wisdomQuotes'] = new Map([['a', wq('a')]]);
    S._wisdomStoreSeed([wq('a')], true); S.WQ_STORE_STATE.metaCount = 1; S.D.wisdomQuotes = [wq('a')];
    await S.wisdomDualApply('a', { favorite: true });
    assert.equal(appMeta(S).count, 1); // değişmedi
  });
  test('4. failed collection write => metadata unchanged', async () => {
    const S = createSandbox(); await seed(S, [wq('a')]);
    S._wisdomStoreSeed([wq('a')], true); S.WQ_STORE_STATE.metaCount = 1; S.D.wisdomQuotes = [wq('a')];
    const before = appMeta(S).count;
    const r = await S.wisdomDualApply('zzz', { favorite: true }); // yok → collection_failed
    assert.equal(r.ok, false);
    assert.equal(appMeta(S).count, before);
  });
  test('5. not sharded => wisdomSyncMetaCount no-op', async () => {
    const S = createSandbox(); await seed(S, [wq('a')]); S.wisdomStoreReset();
    const before = appMeta(S).count;
    S.wisdomSyncMetaCount();
    assert.equal(appMeta(S).count, before);
  });
});

describe('Boot count self-heal', () => {
  test('6. stale count (collection valid) => ACTIVATES + self-heals count', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    const db = await seed(S, [wq('a'), wq('b'), wq('c')]);
    db._cols['users/u/app'].get('wisdomMeta').count = 5098; // bayat
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, true); assert.equal(r.countOk, false);
    assert.equal(S.wisdomStoreIsSharded(), true);       // count farkı BLOKE ETMEZ
    assert.equal(S.wqList().length, 3);                 // koleksiyon otorite
    assert.equal(appMeta(S).count, 3);                  // self-heal
    assert.equal(appMig(S).total, 3);
    assert.equal(S.WQ_STORE_STATE._selfHealed, true);
  });
  test('7. count AND checksum both fixed in one self-heal write', async () => {
    const S = createSandbox();
    const db = await seed(S, [wq('a'), wq('b')]);
    db._cols['users/u/app'].get('wisdomMeta').count = 999;
    db._cols['users/u/app'].get('wisdomMeta').checksum = 'stalechk';
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, true); assert.equal(r.countOk, false); assert.equal(r.checksumOk, false);
    assert.equal(appMeta(S).count, 2); assert.notEqual(appMeta(S).checksum, 'stalechk');
    assert.equal(S.WQ_STORE_STATE._selfHealed, true);
  });
  test('8. all matching => NO self-heal write', async () => {
    const S = createSandbox(); await seed(S, [wq('a')]);
    await S.wisdomBootActivate();
    assert.notEqual(S.WQ_STORE_STATE._selfHealed, true);
    assert.equal(S.WQ_STORE_STATE.activationReason, 'ready');
  });
  test('9. second boot (same session) performs no reconciliation write', async () => {
    const S = createSandbox(); const db = await seed(S, [wq('a'), wq('b')]);
    db._cols['users/u/app'].get('wisdomMeta').count = 50;
    await S.wisdomBootActivate();
    assert.equal(S.WQ_STORE_STATE._selfHealed, true);
    // ikinci çağrı: already_checked → hiçbir yeni yazma
    const r2 = await S.wisdomBootActivate();
    assert.equal(r2.reason, 'already_checked');
  });
});

describe('Genuine fallback preserved', () => {
  test('10. empty collection => legacy fallback', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seed(S, []);
    const r = await S.wisdomBootActivate();
    assert.equal(r.reason, 'empty_cache'); assert.equal(S.wisdomStoreIsSharded(), false);
    assert.equal(S.WQ_STORE_STATE.fallbackReason, 'empty_cache');
  });
  test('11. load error => legacy fallback', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seed(S, [wq('a')]);
    const orig = S.CLOUD.db.collection.bind(S.CLOUD.db);
    S.CLOUD.db.collection = function () { return { doc() { return { collection(sub) { if (sub === 'wisdomQuotes') return { get() { return Promise.reject(new Error('boom')); } }; return orig().doc('u').collection(sub); } }; } }; };
    const r = await S.wisdomBootActivate();
    assert.equal(S.wisdomStoreIsSharded(), false);
    assert.ok(['load_failed', 'error'].indexOf(r.reason) >= 0);
    assert.ok(S.wisdomShouldFallback());
  });
  test('12. gate not passed (sharded false) => legacy, no fallback flag', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    const db = await seed(S, [wq('a')]); db._cols['users/u/app'].get('wisdomMeta').sharded = false;
    const r = await S.wisdomBootActivate();
    assert.equal(r.reason, 'gate_failed'); assert.equal(S.wisdomStoreIsSharded(), false);
  });
});

describe('Static guards', () => {
  test('G1. dual-write add/delete call meta.count sync in store', () => {
    const dualSet = STORE_SRC.slice(STORE_SRC.indexOf('function wisdomDualSet('), STORE_SRC.indexOf('function wisdomDualDelete('));
    const dualDel = STORE_SRC.slice(STORE_SRC.indexOf('function wisdomDualDelete('), STORE_SRC.indexOf('window.wisdomDualApply='));
    assert.match(dualSet, /wisdomSyncMetaCount\(\)/);
    assert.match(dualDel, /wisdomSyncMetaCount\(\)/);
  });
  test('G2. count no longer a hard fallback (no count_mismatch fallback in activation)', () => {
    assert.equal(/_wexFallback\('count_mismatch'\)/.test(MIG_SRC), false);
    assert.match(MIG_SRC, /_wexFallback\('load_failed'\)/);
    assert.match(MIG_SRC, /_wexFallback\('empty_cache'\)/);
  });
  test('G3. sync/self-heal add no listener + no legacy delete (migration batch is separate/legit)', () => {
    // wisdomSyncMetaCount + _wexSelfHealMeta yalnız meta/manifest yazar; listener/legacy-delete yok.
    const sync = MIG_SRC.slice(MIG_SRC.indexOf('function wisdomSyncMetaCount('), MIG_SRC.indexOf('function wisdomSyncMetaCount(') + 500);
    const heal = MIG_SRC.slice(MIG_SRC.indexOf('function _wexSelfHealMeta('), MIG_SRC.indexOf('function _wexSelfHealMeta(') + 700);
    assert.equal(/onSnapshot\s*\(|\.subscribe\s*\(|delete\s+D\.wisdomQuotes|wisdomStoreBatchWrite\s*\(/.test(sync + heal), false);
  });
  test('G4. single read entry preserved (wqList/wqById)', () => {
    const a = fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8');
    assert.equal((a.match(/function\s+wqList\b/g) || []).length, 1);
    assert.equal((a.match(/function\s+wqById\b/g) || []).length, 1);
  });
  test('G5. mirror byte-identical', () => {
    ['02b-wisdom-store.js', '02c-wisdom-migration.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
  });
});
