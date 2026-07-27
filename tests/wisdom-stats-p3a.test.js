'use strict';
/* SMART-GOALS Wisdom Sharding P3a — Wisdom Stats Panel (TÜRETİLMİŞ, SALT OKUNUR).
   Veri tek geçiş noktası wqList() üzerinden (sharded cache veya legacy). 0 write. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11s-wisdom-stats.js'), 'utf8');

const NOW = new Date('2026-07-28T12:00:00.000Z');
function wq(id, over) { return Object.assign({ id: id, quote: 'S' + id, author: 'A', category: 'Genel', language: 'tr', favorite: false, active: true, showCount: 0, tags: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null }, over || {}); }

describe('wisdomStats derivation', () => {
  test('1. total / favorites / distinct categories, authors, languages', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [
      wq('a', { favorite: true, category: 'İş', author: 'X', language: 'tr' }),
      wq('b', { category: 'İş', author: 'Y', language: 'en' }),
      wq('c', { favorite: true, category: 'Sağlık', author: 'X', language: 'tr' })];
    const s = S.wisdomStats(NOW);
    assert.equal(s.total, 3); assert.equal(s.favorites, 2);
    assert.equal(s.categories, 2); assert.equal(s.authors, 2); assert.equal(s.languages, 2);
  });
  test('2. today / week shown from lastShownAt', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [
      wq('a', { lastShownAt: '2026-07-28T09:00:00.000Z' }),  // bugün
      wq('b', { lastShownAt: '2026-07-25T09:00:00.000Z' }),  // bu hafta
      wq('c', { lastShownAt: '2026-06-01T09:00:00.000Z' }),  // eski
      wq('d', { lastShownAt: null })];
    const s = S.wisdomStats(NOW);
    assert.equal(s.todayShown, 1); assert.equal(s.weekShown, 2);
  });
  test('3. newest added / updated', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [
      wq('a', { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }),
      wq('b', { createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-27T00:00:00.000Z' })];
    const s = S.wisdomStats(NOW);
    assert.equal(s.newest.id, 'b'); assert.equal(s.newestUpdated.id, 'b');
    assert.match(s.newestAt, /20\.07\.2026/); assert.match(s.newestUpdatedAt, /27\.07\.2026/);
  });
  test('4. handles numeric timestamps too', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a', { createdAt: 1785000000000 })];
    assert.doesNotThrow(function () { S.wisdomStats(NOW); });
  });
});

describe('Panel HTML', () => {
  test('5. renders 9 stat cards with labels', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a'), wq('b')];
    const h = S.wisdomStatsPanelHtml(NOW);
    ['Toplam Söz', 'Favoriler', 'Kategori', 'Yazar', 'Dil', 'Bugün Okunan', 'Bu Hafta Gösterilen', 'Son Eklenen', 'Son Güncellenen'].forEach(function (l) {
      assert.ok(h.indexOf(l) >= 0, l);
    });
  });
  test('6. responsive: flex-wrap, no fixed pixel WIDTH', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    const h = S.wisdomStatsPanelHtml(NOW);
    assert.ok(/flex-wrap/.test(h));
    // min-width/max-width responsive; sabit bare width YOK
    assert.equal(/width:\s*\d{2,}px/.test(h.replace(/(min|max)-width:\s*\d+px/g, '')), false);
  });
  test('7. empty library => empty panel string', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [];
    assert.equal(S.wisdomStatsPanelHtml(NOW), '');
  });
  test('8. escapes author/quote in Son Eklenen sub', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a', { quote: '<script>x', createdAt: '2026-07-20T00:00:00.000Z' })];
    const h = S.wisdomStatsPanelHtml(NOW);
    assert.equal(/<script>x/.test(h), false); // ham enjeksiyon yok
  });
});

describe('Dual-read source + read-only', () => {
  test('9. reads sharded cache when sharded active', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    S._wisdomStoreSeed([wq('s1'), wq('s2', { favorite: true }), wq('s3')], true);
    const s = S.wisdomStats(NOW);
    assert.equal(s.total, 3); assert.equal(s.favorites, 1); // koleksiyondan, legacy değil
  });
  test('10. reads legacy when not sharded', () => {
    const S = createSandbox(); S.wisdomStoreReset(); S.D.wisdomQuotes = [wq('a'), wq('b')];
    assert.equal(S.wisdomStats(NOW).total, 2);
  });
  test('11. never mutates D or store (read-only)', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a'), wq('b')];
    const before = JSON.stringify(S.D.wisdomQuotes);
    S.wisdomStats(NOW); S.wisdomStatsPanelHtml(NOW);
    assert.equal(JSON.stringify(S.D.wisdomQuotes), before);
  });
});

describe('Static guards', () => {
  test('G1. no writes / no new collection', () => {
    assert.equal(/\bsave\s*\(|writeLocal\s*\(|\bsnap\s*\(|D\.[a-zA-Z_]+\s*=[^=]|wisdomStoreSet\s*\(|queueCloudSave/.test(SRC), false);
  });
  test('G2. reads via wqList single entry (no direct D.wisdomQuotes filter selector)', () => {
    assert.match(SRC, /wqList\(\)/);
  });
  test('G3. wired: harness + index + renderWisdomQuotes injection', () => {
    assert.ok(/11s-wisdom-stats\.js/.test(fs.readFileSync(path.join(ROOT, 'tests', 'harness.js'), 'utf8')));
    assert.ok(/11s-wisdom-stats/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
    assert.ok(/wisdomStatsPanelHtml/.test(fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8')));
  });
  test('G4. backup already rehydrates sharded collection (P2, retained)', () => {
    const backup = fs.readFileSync(path.join(ROOT, 'js', '04-backup.js'), 'utf8');
    assert.match(backup, /wisdomStoreIsSharded\(\)[\s\S]{0,120}wisdomStoreList\(\)/);
  });
  test('G5. mirror byte-identical + module < 900', () => {
    ['11s-wisdom-stats.js', '11a-wisdom-quotes.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(SRC.split('\n').length < 900);
  });
});
