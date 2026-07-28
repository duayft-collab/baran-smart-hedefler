'use strict';
/* SMART-GOALS Wisdom Sharding P1 — Store + Dual-Read Foundation.
   Ayrı koleksiyon altyapısı + runtime cache + salt-okunur dual-read. Bu fazda
   migration/import/boot bağlantısı ve production yazma YOK. Legacy D.wisdomQuotes
   otoriter kalır; sharded bayrağı yalnız testte/ P2'de açılır. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const STORE_SRC = fs.readFileSync(path.join(ROOT, 'js', '02b-wisdom-store.js'), 'utf8');

function wq(id, over) { return Object.assign({ id: id, quote: 'S' + id, author: 'A', category: 'Genel', active: true, favorite: false, tags: [], showCount: 0 }, over || {}); }

describe('Dual-read routing (wqList / wqById)', () => {
  test('1. legacy fallback when not sharded', () => {
    const S = createSandbox(); S.wisdomStoreReset(); S.D.wisdomQuotes = [wq('a'), wq('b')];
    assert.equal(S.wisdomStoreIsSharded(), false);
    assert.equal(S.wqList().length, 2);
    assert.equal(S.wqById('a').quote, 'Sa');
  });
  test('2. sharded reads from collection cache', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    S._wisdomStoreSeed([wq('x'), wq('y'), wq('z')], true);
    assert.equal(S.wisdomStoreIsSharded(), true);
    assert.equal(S.wqList().length, 3); // koleksiyon, legacy değil
    assert.ok(S.wqById('x')); assert.equal(S.wqById('legacy'), null);
  });
  test('3. wqById resolves by id from active store', () => {
    const S = createSandbox(); S._wisdomStoreSeed([wq('k', { quote: 'bulundu' })], true);
    assert.equal(S.wqById('k').quote, 'bulundu');
  });
});

describe('Fallback safety', () => {
  test('4. empty collection => not sharded => legacy', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    S._wisdomStoreSeed([], true); // boş
    assert.equal(S.wisdomStoreIsSharded(), false);
    assert.equal(S.wqList().length, 1); // legacy
  });
  test('5. not-loaded => legacy even if sharded flag set', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a'), wq('b')];
    S.wisdomStoreReset(); S.wisdomStoreSetSharded(true); // loaded=false
    assert.equal(S.wisdomStoreIsSharded(), false);
    assert.equal(S.wqList().length, 2);
  });
  test('6. load with no db => safe {ok:false,no_db}, stays legacy', async () => {
    const S = createSandbox(); S.CLOUD.db = null; S.D.wisdomQuotes = [wq('a')];
    const r = await S.wisdomStoreLoad();
    assert.equal(r.ok, false); assert.equal(r.reason, 'no_db');
    assert.equal(S.wisdomStoreIsSharded(), false); assert.equal(S.wqList().length, 1);
  });
  test('7. firestore error => fallback, error captured', async () => {
    const S = createSandbox();
    S.CLOUD = { uid: 'u', db: { collection: () => ({ doc: () => ({ collection: () => ({ get: () => Promise.reject(new Error('boom')) }) }) }) } };
    S.D.wisdomQuotes = [wq('a')];
    const r = await S.wisdomStoreLoad();
    assert.equal(r.ok, false); assert.equal(r.reason, 'error');
    assert.equal(S.wisdomStoreStatus().error, 'boom');
    assert.equal(S.wisdomStoreIsSharded(), false); assert.equal(S.wqList().length, 1);
  });
  test('8. successful load populates cache (unknown fields preserved)', async () => {
    const docs = [{ id: 'a', quote: 'Q', mysteryField: 42, nested: { keep: true } }];
    const S = createSandbox();
    S.CLOUD = { uid: 'u', db: { collection: () => ({ doc: () => ({ collection: () => ({ get: () => Promise.resolve({ forEach: (cb) => docs.forEach(d => cb({ id: d.id, data: () => d })) }) }) }) }) } };
    const r = await S.wisdomStoreLoad();
    assert.equal(r.ok, true); assert.equal(r.count, 1);
    assert.equal(S.wisdomStoreById('a').mysteryField, 42);
    assert.equal(S.wisdomStoreById('a').nested.keep, true);
  });
});

describe('Store primitives (implemented, unwired) + checksum', () => {
  test('9. checksum is SHA-256, deterministic + order-independent', async () => {
    const S = createSandbox();
    const c1 = await S.wisdomStoreChecksum([wq('a'), wq('b')]);
    const c2 = await S.wisdomStoreChecksum([wq('b'), wq('a')]);
    assert.equal(c1.hash, c2.hash); assert.equal(c1.count, 2);
    assert.match(c1.hash, /^[0-9a-f]{64}$/); // SHA-256 hex (64 nibble)
    const c3 = await S.wisdomStoreChecksum([wq('a'), wq('b', { quote: 'değişti' })]);
    assert.notEqual(c1.hash, c3.hash);
    // backup standardı ile birebir aynı algoritma
    const direct = await S.sha256Hex('deneme');
    assert.match(direct, /^[0-9a-f]{64}$/);
  });
  test('10. status reflects full runtime state fields', () => {
    const S = createSandbox(); S._wisdomStoreSeed([wq('a'), wq('b')], true);
    const st = S.wisdomStoreStatus();
    ['loaded', 'loading', 'sharded', 'error', 'count', 'checksum', 'lastLoadAt'].forEach(function (k) {
      assert.ok(Object.prototype.hasOwnProperty.call(st, k), 'missing ' + k);
    });
    assert.equal(st.loaded, true); assert.equal(st.sharded, true); assert.equal(st.cacheSize, 2);
  });
  test('11. batch write commits in lots and updates cache', async () => {
    const commits = [];
    const S = createSandbox();
    const col = { doc: (id) => ({ _id: id }) };
    S.CLOUD = { uid: 'u', db: {
      collection: () => ({ doc: () => ({ collection: () => col }) }),
      batch: () => ({ _ops: 0, set(ref) { this._ops++; }, commit() { commits.push(this._ops); return Promise.resolve(); } })
    } };
    S.wisdomStoreReset();
    const recs = []; for (let i = 0; i < 460; i++) recs.push(wq('id' + i));
    const r = await S.wisdomStoreBatchWrite(recs);
    assert.equal(r.ok, true); assert.equal(r.written, 460); assert.equal(r.lots, 2); // 450 + 10
    assert.deepEqual(commits, [S.WISDOM_BATCH_SIZE, 460 - S.WISDOM_BATCH_SIZE]);
    assert.equal(S.WQ_STORE.size, 460);
  });
  test('11b. batch size is a named constant (450) driving lot math', () => {
    const S = createSandbox();
    assert.equal(S.WISDOM_BATCH_SIZE, 450);
    // kaynak sabit üzerinden bölüyor (sabit sayı gömülü değil)
    assert.match(STORE_SRC, /const WISDOM_BATCH_SIZE\s*=\s*450/);
    assert.match(STORE_SRC, /i\s*\+=\s*WISDOM_BATCH_SIZE/);
  });
  test('11c. load sets lastLoadAt + checksum (runtime only)', async () => {
    const docs = [{ id: 'a', quote: 'Q' }];
    const S = createSandbox();
    S.CLOUD = { uid: 'u', db: { collection: () => ({ doc: () => ({ collection: () => ({ get: () => Promise.resolve({ forEach: (cb) => docs.forEach(d => cb({ id: d.id, data: () => d })) }) }) }) }) } };
    const r = await S.wisdomStoreLoad();
    assert.equal(r.ok, true);
    assert.match(r.checksum, /^[0-9a-f]{64}$/);
    assert.ok(S.WQ_STORE_STATE.lastLoadAt > 0);
    assert.equal(S.WQ_STORE_STATE.loading, false);
  });
  test('12. write primitive guards missing id', async () => {
    const S = createSandbox(); S.CLOUD.db = null;
    assert.equal((await S.wisdomStoreSet({ quote: 'x' })).error, 'MISSING_ID');
    assert.equal((await S.wisdomStoreSet(wq('a'))).error, 'NO_DB');
  });
});

describe('Read-only / no-mutation guarantees', () => {
  test('13. dual-read never mutates D.wisdomQuotes (byte-identical)', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a'), wq('b')];
    const before = JSON.stringify(S.D.wisdomQuotes);
    S._wisdomStoreSeed([wq('x')], true);
    S.wqList(); S.wqById('x'); S.wisdomStoreList(); await S.wisdomStoreChecksum(); S.wisdomStoreStatus();
    assert.equal(JSON.stringify(S.D.wisdomQuotes), before);
  });
  test('14. revision + sync state untouched by store reads', () => {
    const S = createSandbox(); S.CLOUD.revision = 262; S.CLOUD.pendingMutation = null;
    S._wisdomStoreSeed([wq('x')], true);
    S.wqList(); S.wqById('x'); S.wisdomStoreLoad();
    assert.equal(S.CLOUD.revision, 262); assert.equal(S.CLOUD.pendingMutation, null);
  });
  test('15. display engine + relations resolver route through dual-read', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy', { active: true })];
    S._wisdomStoreSeed([wq('s1', { active: true }), wq('s2', { active: false })], true);
    // display motoru (11b) wqList/wqById üzerinden
    assert.equal(S.wdActiveList().length, 1); // yalnız aktif s1, koleksiyondan
    assert.ok(S.wdById('s1')); assert.equal(S.wdById('legacy'), null);
    // relations resolver (11h) wqById üzerinden
    assert.ok(S.RELATION_RESOLVERS.wisdomQuote.byId('s1'));
    assert.equal(S.RELATION_RESOLVERS.wisdomQuote.byId('legacy'), null);
  });
  test('16. wisdom experience (11q) reads via same entry (wdActiveList)', () => {
    const S = createSandbox(); S.D.wisdomQuotes = []; S.D.relations = []; S.D.goals = []; S.D.goalCheckIns = [];
    S._wisdomStoreSeed([wq('e1', { active: true, category: 'Genel' })], true); S.wexReset();
    const cur = S.wexCurrent('dashboard');
    assert.ok(cur); assert.equal(cur.id, 'e1'); // koleksiyondan seçildi
  });
});

describe('Static guards (mandatory)', () => {
  test('G1. no production write wired (no boot/CRUD/import call of store writes)', () => {
    const files = ['js/11a-wisdom-quotes.js', 'js/11b-wisdom-display.js', 'js/12-render-boot.js', 'js/11c-wisdom-io.js', 'js/11q-wisdom-experience.js'];
    files.forEach(function (f) {
      const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
      assert.equal(/wisdomStoreSet\s*\(|wisdomStoreUpdate\s*\(|wisdomStoreDelete\s*\(|wisdomStoreBatchWrite\s*\(|wisdomStoreLoad\s*\(|wisdomStoreSetSharded\s*\(/.test(t), false, f);
    });
  });
  test('G2. no migration / import linkage in store (no such calls)', () => {
    assert.equal(/_wqCommitImport\s*\(|wqImportApply\s*\(|wqImportAnalyze\s*\(|migrat[a-zA-Z]*\s*\(/.test(STORE_SRC), false);
  });
  test('G3. store never auto-invokes on load / no boot side effect', () => {
    // sadece tanımlar; üst-seviye çağrı yok (fonksiyon gövdeleri hariç kabaca)
    assert.equal(/^\s*wisdomStoreLoad\s*\(\s*\)\s*;/m.test(STORE_SRC), false);
    assert.equal(/^\s*wisdomStoreBatchWrite\s*\(/m.test(STORE_SRC), false);
  });
  test('G3b. no boot auto-load (wisdomStoreLoad unwired from startup/render/auth)', () => {
    ['js/12-render-boot.js', 'js/03-auth.js', 'js/02-sync.js', 'js/08-ui-core.js', 'js/11a-wisdom-quotes.js', 'js/11b-wisdom-display.js', 'js/11q-wisdom-experience.js'].forEach(function (f) {
      assert.equal(/wisdomStoreLoad\s*\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), false, f);
    });
  });
  test('G3c. Firestore realtime listener = 0 in store (no listener API calls)', () => {
    assert.equal(/onSnapshot\s*\(|addSnapshotListener\s*\(|\.subscribe\s*\(/.test(STORE_SRC), false);
  });
  test('G4. no legacy removal / no state-doc sync engine (P2 dual-write is gated)', () => {
    // Wholesale legacy silme veya state-doc sync motoru YOK. (P2 dual-write per-record
    // legacy yazması wisdomStoreIsSharded() ardında gated; wholesale removal değil.)
    assert.equal(/delete\s+D\.wisdomQuotes|queueCloudSave\s*\(|commitMutation\s*\(|stateRef\s*\(/.test(STORE_SRC), false);
    // dual-write yolları sharded kapısıyla korunur
    ['wisdomDualApply', 'wisdomDualSet', 'wisdomDualDelete'].forEach(function (fn) {
      const body = STORE_SRC.slice(STORE_SRC.indexOf('function ' + fn));
      assert.match(body.slice(0, 160), /wisdomStoreIsSharded\(\)/, fn + ' must be gated');
    });
  });
  test('G5. no second selector / single cache (one WQ_STORE Map)', () => {
    assert.equal((STORE_SRC.match(/new Map\(/g) || []).length, 1);
    // 11a hâlâ tek wqList/wqById tanımı
    const a = fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8');
    assert.equal((a.match(/function\s+wqList\b/g) || []).length, 1);
    assert.equal((a.match(/function\s+wqById\b/g) || []).length, 1);
  });
  test('G6. protected files untouched by grep signature (rules/firebase/sync/backup/restore/io/experience)', () => {
    // 02b, 11a, 11b harici wisdom-store bağlantısı yok
    // NOT: 04-backup.js P2'de sharded rehydrate için wisdomStore* okur (izinli); listeden çıkarıldı.
    // NOT: 06-restore/11-restore P3c'de sharded restore için genişledi (izinli); listeden çıkarıldı.
    ['js/02-sync.js', 'js/11c-wisdom-io.js', 'js/11q-wisdom-experience.js'].forEach(function (f) {
      assert.equal(/wisdomStore|WQ_STORE/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), false, f);
    });
  });
  test('G7. mirrors byte-identical + module < 900 + wired', () => {
    ['02b-wisdom-store.js', '11a-wisdom-quotes.js', '11b-wisdom-display.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(/02b-wisdom-store\.js/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
    assert.ok(/02b-wisdom-store\.js/.test(fs.readFileSync(path.join(ROOT, 'tests', 'harness.js'), 'utf8')));
    assert.ok(STORE_SRC.split('\n').length < 900);
  });
});
