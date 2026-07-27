'use strict';
/* SMART-GOALS Wisdom Sharding P2.2 — Backup Reason Hotfix.
   Migration backup nedeni 'before_migration' (geçerli BACKUP_REASONS). Backup gate
   başarısızsa 0 koleksiyon/manifest/meta write + özel UX metni. Backup güvenlik kapısı
   gevşetilmedi; BACKUP_REASONS genişletilmedi. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const MIG_SRC = fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8');

function wq(id, over) { return Object.assign({ id: id, quote: 'S' + id, author: 'A', active: true, tags: [] }, over || {}); }
function fakeDb() {
  const cols = {};
  function colRef(pth) {
    if (!cols[pth]) cols[pth] = new Map();
    const m = cols[pth];
    return {
      _map: m,
      doc(id) { const k = String(id); return {
        set(d) { m.set(k, JSON.parse(JSON.stringify(d))); return Promise.resolve(); },
        get() { return Promise.resolve({ exists: m.has(k), data: () => m.get(k) }); },
        update(p) { if (!m.has(k)) return Promise.reject(new Error('nf')); m.set(k, Object.assign({}, m.get(k), p)); return Promise.resolve(); },
        delete() { m.delete(k); return Promise.resolve(); } }; },
      get() { const d = []; m.forEach((v, k) => d.push({ id: k, data: () => v })); return Promise.resolve({ size: d.length, forEach: (cb) => d.forEach(cb) }); }
    };
  }
  return {
    _cols: cols,
    collection() { return { doc(uid) { return { collection(sub) { return colRef('users/' + uid + '/' + sub); } }; } }; },
    batch() { const ops = []; return { set(r, d) { ops.push([r, d]); }, commit() { ops.forEach(x => x[0].set(x[1])); return Promise.resolve(); } }; }
  };
}
function mkCloud(S) { S.CLOUD = { uid: 'u', db: fakeDb(), revision: 100, pendingMutation: null, conflict: false }; return S.CLOUD; }
function appCol(S) { return S.CLOUD.db._cols['users/u/app']; }
function wqCol(S) { return S.CLOUD.db._cols['users/u/wisdomQuotes']; }

describe('Backup reason source', () => {
  test('1. valid reason before_migration present; old invalid reason absent', () => {
    assert.match(MIG_SRC, /createBackup\('before_migration'/);
    assert.equal(/before_shard_migration/.test(MIG_SRC), false);
  });
  test('2. BACKUP_REASONS not modified (still valid list in 03-auth)', () => {
    const auth = fs.readFileSync(path.join(ROOT, 'js', '03-auth.js'), 'utf8');
    assert.match(auth, /BACKUP_REASONS=\[[^\]]*'before_migration'[^\]]*\]/);
    assert.equal(/before_shard_migration/.test(auth), false); // allowlist genişletilmedi
  });
});

describe('Backup gate behavior', () => {
  test('3. backup failure => reason backup_failed, 0 collection + 0 manifest/meta write', async () => {
    const S = createSandbox(); mkCloud(S); S.D.wisdomQuotes = [wq('a'), wq('b')];
    S.createBackup = function () { return Promise.reject(new Error('Geçersiz yedek nedeni: x')); };
    const r = await S.wisdomMigrationStart();
    assert.equal(r.ok, false); assert.equal(r.reason, 'backup_failed');
    assert.equal(S.wisdomMigrationStatus().status, 'failed');
    assert.equal(S.wisdomMigrationStatus().error, 'backup_failed');
    assert.equal((wqCol(S) || new Map()).size, 0); // 0 koleksiyon write
    assert.equal(appCol(S), undefined); // wisdomMeta / wisdomMigration yazılmadı
  });
  test('4. null/unverified backup => backup_failed, 0 write', async () => {
    const S = createSandbox(); mkCloud(S); S.D.wisdomQuotes = [wq('a')];
    S.createBackup = function () { return Promise.resolve(null); };
    const r = await S.wisdomMigrationStart();
    assert.equal(r.reason, 'backup_failed');
    assert.equal((wqCol(S) || new Map()).size, 0);
    assert.equal(appCol(S), undefined);
  });
  test('5. backup success => proceeds to batch stage (collection written)', async () => {
    const S = createSandbox(); mkCloud(S); S.D.wisdomQuotes = [wq('a'), wq('b'), wq('c')];
    S.createBackup = function (reason) { assert.equal(reason, 'before_migration'); return Promise.resolve({ id: 'bk' }); };
    const r = await S.wisdomMigrationStart();
    assert.equal(r.ok, true);
    assert.equal(wqCol(S).size, 3); // batch aşamasına geçti
    assert.equal(S.wisdomMigrationStatus().status, 'completed');
  });
});

describe('UX status line (backup gate text)', () => {
  test('6. backup_failed => explicit user text', () => {
    const S = createSandbox();
    S.wisdomMigrationReset(); S.wisdomStoreReset();
    S.WISDOM_MIGRATION.status = 'failed'; S.WISDOM_MIGRATION.error = 'backup_failed';
    const h = S.wisdomStatusLineHtml();
    assert.match(h, /Güvenli yedek oluşturulamadı\. Taşıma başlatılmadı\./);
    assert.ok(/<svg/.test(h) && /role="status"/.test(h)); // ikon + a11y
    assert.equal(/width:\s*\d{2,}px/.test(h), false); // sabit genişlik yok
    assert.equal(/showModal|class="ov"/.test(h), false); // modal yok
  });
  test('7. other failure keeps generic text (not backup text)', () => {
    const S = createSandbox(); S.wisdomStoreReset();
    S.WISDOM_MIGRATION.status = 'failed'; S.WISDOM_MIGRATION.error = 'verify_mismatch';
    const h = S.wisdomStatusLineHtml();
    assert.match(h, /Senkronizasyon tamamlanamadı/);
    assert.equal(/Güvenli yedek oluşturulamadı/.test(h), false);
  });
  test('8. hidden in normal legacy (idle)', () => {
    const S = createSandbox(); S.wisdomMigrationReset(); S.wisdomStoreReset();
    assert.equal(S.wisdomStatusLineHtml(), '');
  });
});
