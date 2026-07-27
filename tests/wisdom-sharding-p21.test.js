'use strict';
/* SMART-GOALS Wisdom Sharding P2.1 — Boot Read-Transition Activation.
   Migration tamamlanıp doğrulandıysa boot'ta sharded read'i GATED aktive eder.
   Kapı geçmezse legacy fallback. Auth öncesi/ikinci çağrı no-op. Realtime listener yok,
   migration yok, write yok, throw yok. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const MIG_SRC = fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8');

function wq(id, over) { return Object.assign({ id: id, quote: 'S' + id, author: 'A', category: 'Genel', active: true, favorite: false, showCount: 0, tags: [] }, over || {}); }

/* Fake db that can host wisdomQuotes collection + app/{wisdomMeta,wisdomMigration} docs. */
function fakeDb(seed) {
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
          get() { return Promise.resolve({ exists: m.has(key), data: () => m.get(key) }); },
          update(p) { if (!m.has(key)) return Promise.reject(new Error('nf')); m.set(key, Object.assign({}, m.get(key), p)); return Promise.resolve(); },
          delete() { m.delete(key); return Promise.resolve(); }
        };
      },
      get() { const docs = []; m.forEach((v, k) => docs.push({ id: k, data: () => v })); return Promise.resolve({ size: docs.length, forEach: (cb) => docs.forEach(cb) }); }
    };
  }
  const db = {
    _cols: cols,
    collection() { return { doc(uid) { return { collection(sub) { return colRef('users/' + uid + '/' + sub); } }; } }; },
    batch() { const ops = []; return { set(ref, d) { ops.push([ref, d]); }, commit() { ops.forEach(x => x[0].set(x[1])); return Promise.resolve(); } }; }
  };
  if (seed) seed(cols);
  return db;
}
function authedCloud(db) { return { uid: 'u', db: db, ready: true, user: { isAnonymous: false }, revision: 100, pendingMutation: null, conflict: false }; }

/* Migrated collection + consistent meta/manifest for the happy path. */
async function seedMigrated(S, records) {
  const db = fakeDb();
  S.CLOUD = authedCloud(db);
  // koleksiyona kayıtları koy
  const col = db._cols['users/u/wisdomQuotes'] = new Map();
  records.forEach(r => col.set(String(r.id), JSON.parse(JSON.stringify(r))));
  const cs = await S.wisdomStoreChecksum(records);
  const app = db._cols['users/u/app'] = new Map();
  app.set('wisdomMeta', { sharded: true, count: records.length, checksum: cs.hash });
  app.set('wisdomMigration', { status: 'completed', total: records.length, migratedCount: records.length, sourceChecksum: cs.hash, targetChecksum: cs.hash });
  return { db, checksum: cs.hash };
}

describe('Legacy fallback (gate not passed)', () => {
  test('1. no meta/manifest => legacy (no_migration)', async () => {
    const S = createSandbox(); S.CLOUD = authedCloud(fakeDb()); S.D.wisdomQuotes = [wq('a')];
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, false); assert.equal(S.wisdomStoreIsSharded(), false);
    assert.equal(S.wqList().length, 1);
  });
  test('2. meta.sharded false => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seedMigrated(S, [wq('a')]);
    S.CLOUD.db._cols['users/u/app'].get('wisdomMeta').sharded = false;
    const r = await S.wisdomBootActivate();
    assert.equal(r.reason, 'gate_failed'); assert.equal(S.wisdomStoreIsSharded(), false);
  });
  test('3. migration not completed => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seedMigrated(S, [wq('a')]);
    S.CLOUD.db._cols['users/u/app'].get('wisdomMigration').status = 'in_progress';
    assert.equal((await S.wisdomBootActivate()).reason, 'gate_failed');
    assert.equal(S.wisdomStoreIsSharded(), false);
  });
  test('4. count mismatch (meta vs manifest) => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seedMigrated(S, [wq('a'), wq('b')]);
    S.CLOUD.db._cols['users/u/app'].get('wisdomMeta').count = 99;
    assert.equal((await S.wisdomBootActivate()).reason, 'gate_failed');
    assert.equal(S.wisdomStoreIsSharded(), false);
  });
  test('5. checksum mismatch => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seedMigrated(S, [wq('a')]);
    S.CLOUD.db._cols['users/u/app'].get('wisdomMeta').checksum = 'deadbeef';
    assert.equal((await S.wisdomBootActivate()).reason, 'gate_failed');
    assert.equal(S.wisdomStoreIsSharded(), false);
  });
  test('6. post-load count mismatch (collection drifted) => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a'), wq('b')];
    await seedMigrated(S, [wq('a'), wq('b')]);
    // meta/manifest tutarlı ama koleksiyondan bir kayıt sil → yükleme sonrası count uyuşmaz
    S.CLOUD.db._cols['users/u/wisdomQuotes'].delete('b');
    const r = await S.wisdomBootActivate();
    assert.equal(r.reason, 'count_mismatch'); assert.equal(S.wisdomStoreIsSharded(), false);
  });
  test('7. collection load error => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seedMigrated(S, [wq('a')]);
    // wisdomQuotes koleksiyon get() hata fırlatsın
    const col = S.CLOUD.db._cols['users/u/wisdomQuotes'];
    col.get = undefined; // colRef fonksiyonu yeniden; get çağrısı patlar → catch
    // Basit: CLOUD.db.collection zincirini boz
    const orig = S.CLOUD.db.collection;
    S.CLOUD.db.collection = function () { return { doc() { return { collection(sub) { if (sub === 'wisdomQuotes') return { get() { return Promise.reject(new Error('load boom')); } }; return orig.call(S.CLOUD.db).doc('u').collection(sub); } }; } }; };
    const r = await S.wisdomBootActivate();
    assert.equal(S.wisdomStoreIsSharded(), false);
    assert.ok(r.reason === 'load_failed' || r.reason === 'error');
  });
  test('8. empty collection => legacy', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    await seedMigrated(S, []); // 0 kayıt; meta.count 0
    const r = await S.wisdomBootActivate();
    assert.equal(S.wisdomStoreIsSharded(), false);
    assert.ok(['empty_cache', 'gate_failed'].indexOf(r.reason) >= 0);
  });
});

describe('Happy path activation', () => {
  test('9. all gates pass => sharded active, cache read', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacyOnly')];
    await seedMigrated(S, [wq('a'), wq('b'), wq('c')]);
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, true);
    assert.equal(S.wisdomStoreIsSharded(), true);
    assert.equal(S.WQ_STORE_STATE.activationReady, true);
    assert.equal(S.WQ_STORE_STATE.activationReason, 'ready');
    assert.equal(S.wqList().length, 3); // koleksiyondan
    assert.ok(S.wqById('a'));
    assert.equal(S.wqById('legacyOnly'), null);
  });
  test('10. legacy D.wisdomQuotes preserved (byte-identical) after activation', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('x'), wq('y')];
    const before = JSON.stringify(S.D.wisdomQuotes);
    await seedMigrated(S, [wq('x'), wq('y')]);
    await S.wisdomBootActivate();
    assert.equal(JSON.stringify(S.D.wisdomQuotes), before);
  });
});

describe('Idempotency / auth guards', () => {
  test('11. second boot call is no-op (activationChecked)', async () => {
    const S = createSandbox();
    await seedMigrated(S, [wq('a')]);
    await S.wisdomBootActivate();
    const r2 = await S.wisdomBootActivate();
    assert.equal(r2.reason, 'already_checked');
  });
  test('12. before auth => no-op, not marked checked (retryable)', async () => {
    const S = createSandbox(); S.CLOUD = { db: null, uid: null };
    const r = await S.wisdomBootActivate();
    assert.equal(r.reason, 'no_auth');
    assert.equal(S.WQ_STORE_STATE.activationChecked, false); // işaretlenmedi → tekrar denenebilir
  });
});

describe('UX status line (read-transition)', () => {
  test('13. legacy (no activation, idle) => hidden', () => {
    const S = createSandbox(); S.wisdomStoreReset(); S.wisdomMigrationReset();
    assert.equal(S.wisdomStatusLineHtml(), '');
  });
  test('14. read-transition texts by activationReason', () => {
    const S = createSandbox();
    S.WQ_STORE_STATE.activationReason = 'checking';
    assert.match(S.wisdomStatusLineHtml(), /Bulut arşivi kontrol ediliyor/);
    S.WQ_STORE_STATE.activationReason = 'verifying';
    assert.match(S.wisdomStatusLineHtml(), /Bulut arşivi doğrulanıyor/);
    S.WQ_STORE_STATE.activationReason = 'ready'; S.WQ_STORE_STATE.activationReady = true;
    assert.match(S.wisdomStatusLineHtml(), /Bulut arşivi kullanıma hazır/);
    S.WQ_STORE_STATE.activationReady = false; S.WQ_STORE_STATE.activationReason = 'checksum_mismatch';
    assert.match(S.wisdomStatusLineHtml(), /Bulut arşivi doğrulanamadı, yerel veri kullanılıyor/);
  });
  test('15. normal legacy activation reasons stay hidden (no_migration/no_auth)', () => {
    const S = createSandbox(); S.wisdomStoreReset();
    S.WQ_STORE_STATE.activationReason = 'no_migration';
    assert.equal(S.wisdomStatusLineHtml(), '');
    S.WQ_STORE_STATE.activationReason = 'no_auth';
    assert.equal(S.wisdomStatusLineHtml(), '');
  });
  test('16. status line icon + explicit text, no fixed width, no modal', () => {
    const S = createSandbox(); S.WQ_STORE_STATE.activationReason = 'checking';
    const h = S.wisdomStatusLineHtml();
    assert.ok(/<svg/.test(h) && /kontrol ediliyor/.test(h) && /role="status"/.test(h));
    assert.equal(/width:\s*\d{2,}px/.test(h), false);
    assert.equal(/showModal|class="ov"/.test(h), false);
  });
});

describe('Regression through activated store', () => {
  test('17. relations resolver + display + rndQuote read sharded cache', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy', { active: true })]; S.D.relations = [];
    await seedMigrated(S, [wq('s1', { active: true }), wq('s2', { active: false })]);
    await S.wisdomBootActivate();
    assert.equal(S.wisdomStoreIsSharded(), true);
    assert.equal(S.wdActiveList().length, 1); // display
    assert.ok(S.RELATION_RESOLVERS.wisdomQuote.byId('s1')); // relations
    assert.equal(S.RELATION_RESOLVERS.wisdomQuote.byId('legacy'), null);
    assert.equal(S.getActiveWisdomQuotes().length, 1); // rndQuote source
  });
  test('18. activation performs no D mutation / no migration write', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')]; S.D.goals = [{ id: 1 }];
    const g = JSON.stringify(S.D.goals);
    const { db } = await seedMigrated(S, [wq('a')]);
    const migDocBefore = JSON.stringify(db._cols['users/u/app'].get('wisdomMigration'));
    await S.wisdomBootActivate();
    assert.equal(JSON.stringify(S.D.goals), g); // korumalı koleksiyon
    // aktivasyon manifesti DEĞİŞTİRMEZ (write yok)
    assert.equal(JSON.stringify(db._cols['users/u/app'].get('wisdomMigration')), migDocBefore);
  });
});

describe('Static guards (mandatory)', () => {
  test('G1. boot hook present but gated (12-render-boot calls only WhenReady wrapper)', () => {
    const boot = fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8');
    assert.ok(/wisdomBootActivateWhenReady\(\)/.test(boot));
    assert.equal(/wisdomStoreLoad\s*\(|wisdomStoreSetSharded\s*\(|wisdomMigrationStart\s*\(/.test(boot), false); // doğrudan değil
  });
  test('G2. activation is gated: wisdomStoreLoad only after triple gate; setSharded only after post-load verify', () => {
    const fn = MIG_SRC.slice(MIG_SRC.indexOf('function wisdomBootActivate('), MIG_SRC.indexOf('window.wisdomBootActivate='));
    // gate ifadesi wisdomStoreLoad çağrısından ÖNCE gelir
    assert.ok(fn.indexOf('m.sharded===true') < fn.indexOf('wisdomStoreLoad('));
    // checksum doğrulaması wisdomStoreSetSharded'dan ÖNCE
    assert.ok(fn.indexOf('cs.hash!==m.checksum') < fn.indexOf('wisdomStoreSetSharded(true)'));
  });
  test('G3. no realtime listener / no migration start / no write in activation', () => {
    const fn = MIG_SRC.slice(MIG_SRC.indexOf('function wisdomBootActivate('), MIG_SRC.indexOf('/* Bounded'));
    assert.equal(/onSnapshot\s*\(|\.subscribe\s*\(|wisdomMigrationStart\s*\(|\.set\s*\(|\.update\s*\(|\.delete\s*\(/.test(fn), false);
  });
  test('G4. mirrors byte-identical + module < 900', () => {
    ['02b-wisdom-store.js', '02c-wisdom-migration.js', '12-render-boot.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(MIG_SRC.split('\n').length < 900);
  });
});
