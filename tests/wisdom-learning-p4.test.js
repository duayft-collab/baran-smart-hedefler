'use strict';
/* WISDOM P4 — Professional Knowledge & Learning Center (TÜRETİLMİŞ, SALT OKUNUR).
   Tek kaynak wqList/relations; yeni koleksiyon/write/migration/restore/listener YOK. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11u-wisdom-learning-center.js'), 'utf8');

const NOW = new Date('2026-07-28T12:00:00.000Z');
function wq(id, over) { return Object.assign({ id: id, quote: 'Söz ' + id + ' hakkında birkaç kelime', author: 'Yazar', category: 'Disiplin', language: 'tr', favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], notes: '', source: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null }, over || {}); }
function setQ(S, arr) { S.D.wisdomQuotes = arr; S.D.relations = []; S.D.goals = []; S.wisdomStoreReset(); }

describe('Reading time & categories', () => {
  test('1. reading time derived from word count', () => {
    const S = createSandbox();
    const rt = S.wlcReadingTime(wq('a', { quote: 'iki kelime' }));
    assert.ok(rt.seconds >= 3); assert.match(rt.label, /sn|dk/);
  });
  test('2. categories: fixed list + counts, byCategory filters', () => {
    const S = createSandbox(); setQ(S, [wq('a', { category: 'Disiplin' }), wq('b', { category: 'Liderlik' }), wq('c', { category: 'Disiplin' })]);
    const cats = S.wlcCategories();
    assert.ok(cats.some(c => c.category === 'Disiplin' && c.count === 2));
    assert.ok(S.WLC_CATEGORIES.length >= 20);
    assert.equal(S.wlcByCategory('Disiplin').length, 2);
  });
});

describe('Weekly theme & teaching of day', () => {
  test('3. weekly theme deterministic + label', () => {
    const S = createSandbox(); setQ(S, [wq('a')]);
    const t1 = S.wlcWeeklyTheme(NOW); const t2 = S.wlcWeeklyTheme(NOW);
    assert.equal(t1.theme, t2.theme); assert.match(t1.label, /Haftası$/);
    assert.ok(S.WLC_CATEGORIES.indexOf(t1.theme) >= 0);
  });
  test('4. teaching of day: quote + explanation + action + relations', () => {
    const S = createSandbox(); setQ(S, [wq('a'), wq('b')]); S.D.goals = [{ id: 7, title: 'Hedef X' }];
    S.relAdd({ sourceType: 'wisdomQuote', sourceId: 'a', targetType: 'goal', targetId: '7', relationType: 'related_to' });
    const t = S.wlcTeachingOfDay(NOW);
    assert.ok(t.quote && t.explanation && t.actionSuggestion);
    // deterministik: aynı gün aynı söz
    assert.equal(S.wlcTeachingOfDay(NOW).quote.id, t.quote.id);
  });
  test('5. empty pool => teaching null, section empty', () => {
    const S = createSandbox(); setQ(S, []);
    assert.equal(S.wlcTeachingOfDay(NOW), null);
    assert.equal(S.wlcLearningSectionHtml(NOW), '');
  });
});

describe('Map & progress', () => {
  test('6. map buckets: mostRead/mostFavorited/newest/recentlyUpdated', () => {
    const S = createSandbox(); setQ(S, [
      wq('a', { showCount: 10, favorite: true, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z' }),
      wq('b', { showCount: 2, createdAt: '2026-07-25T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z' })]);
    const m = S.wlcMap(NOW);
    assert.equal(m.mostRead[0].id, 'a'); assert.ok(m.mostFavorited.some(q => q.id === 'a'));
    assert.equal(m.newest[0].id, 'b'); assert.equal(m.recentlyUpdated[0].id, 'a');
  });
  test('7. progress: week/month read, favorites, completed, unread', () => {
    const S = createSandbox(); setQ(S, [
      wq('a', { lastShownAt: '2026-07-28T08:00:00.000Z', favorite: true }),
      wq('b', { lastShownAt: '2026-07-10T00:00:00.000Z', reflected: true }),
      wq('c', { lastShownAt: null })]);
    const p = S.wlcProgress(NOW);
    assert.equal(p.thisWeek, 1); assert.equal(p.thisMonth, 2); assert.equal(p.favorites, 1);
    assert.equal(p.completed, 1); assert.equal(p.unread, 1);
  });
});

describe('Related content & search', () => {
  test('8. related: same author/category/tag + goals', () => {
    const S = createSandbox(); setQ(S, [
      wq('a', { author: 'X', category: 'Disiplin', tags: ['odak'] }),
      wq('b', { author: 'X', category: 'Liderlik', tags: [] }),
      wq('c', { author: 'Y', category: 'Disiplin', tags: ['odak'] })]);
    const r = S.wlcRelated('a');
    assert.ok(r.sameAuthor.some(q => q.id === 'b'));
    assert.ok(r.sameCategory.some(q => q.id === 'c'));
    assert.ok(r.sameTag.some(q => q.id === 'c'));
  });
  test('9. smart search over quote/author/tag/category/source', () => {
    const S = createSandbox(); setQ(S, [
      wq('a', { quote: 'disiplin köprüdür', author: 'Rohn' }),
      wq('b', { quote: 'başka', author: 'X', tags: ['satış'] })]);
    assert.equal(S.wlcSearch('köprü').length, 1);
    assert.equal(S.wlcSearch('rohn').length, 1);
    assert.equal(S.wlcSearch('satış').length, 1);
    assert.equal(S.wlcSearch('').length, 2);
  });
});

describe('Dashboard & HTML', () => {
  test('10. dashboard cards + learning score', () => {
    const S = createSandbox(); setQ(S, [wq('a', { favorite: true, showCount: 3, reflected: true }), wq('b')]);
    const c = S.wlcDashboardCards(NOW);
    assert.equal(c.total, 2); assert.ok(c.activeCategories >= 1); assert.ok(c.activeAuthors >= 1);
    assert.ok(c.learningScore >= 0 && c.learningScore <= 100); assert.match(c.weeklyTheme, /Haftası/);
  });
  test('11. teaching card + dashboard html render (no chart)', () => {
    const S = createSandbox(); setQ(S, [wq('a', { quote: 'Test sözü', author: 'Z' })]);
    const tc = S.wlcTeachingCardHtml(NOW);
    assert.match(tc, /Günün Öğretisi/); assert.match(tc, /Test sözü/);
    const dh = S.wlcDashboardHtml(NOW);
    assert.match(dh, /Toplam Söz/); assert.match(dh, /Öğrenme Skoru/);
    assert.equal(/<canvas|Chart\.js|d3\./i.test(tc + dh), false); // grafik yok
  });
  test('12. learning section renders + responsive + accessible details', () => {
    const S = createSandbox(); setQ(S, [wq('a'), wq('b', { category: 'Liderlik' })]);
    const h = S.wlcLearningSectionHtml(NOW);
    assert.match(h, /Öğrenme Merkezi/); assert.match(h, /Öğrenme İlerlemesi/); assert.match(h, /Kategoriler/);
    assert.match(h, /<summary/); // klavye erişilebilir katlanır
    assert.equal(/width:\s*\d{2,}px/.test(h.replace(/(min|max)-width:\s*\d+px/g, '')), false); // sabit genişlik yok
  });
});

describe('Read-only & guards', () => {
  test('13. never mutates D / store (read-only derived)', () => {
    const S = createSandbox(); setQ(S, [wq('a'), wq('b')]); S.D.relations = [];
    const bd = JSON.stringify(S.D.wisdomQuotes), br = JSON.stringify(S.D.relations);
    S.wlcTeachingOfDay(NOW); S.wlcMap(NOW); S.wlcProgress(NOW); S.wlcRelated('a'); S.wlcSearch('a'); S.wlcDashboardCards(NOW); S.wlcLearningSectionHtml(NOW);
    assert.equal(JSON.stringify(S.D.wisdomQuotes), bd); assert.equal(JSON.stringify(S.D.relations), br);
  });
  test('14. reads via wqList (sharded cache when sharded)', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    S._wisdomStoreSeed([wq('s1'), wq('s2', { favorite: true })], true);
    assert.equal(S.wlcProgress(NOW).total, 2); // koleksiyondan, legacy değil
  });
  test('G1. no write / no listener / no new collection / no sharding-migration-restore calls', () => {
    assert.equal(/\bsave\s*\(|writeLocal\s*\(|\bsnap\s*\(|D\.wisdomQuotes\s*=|onSnapshot\s*\(|\.subscribe\s*\(|wisdomMigrationStart\s*\(|wisdomShardedRestore\s*\(|wisdomStoreSet\s*\(|wisdomStoreBatchWrite\s*\(|\.batch\s*\(|createBackup\s*\(/.test(SRC), false);
  });
  test('G2. reuses wqList + relations (no second selector)', () => {
    assert.match(SRC, /wqList/); assert.match(SRC, /getRelatedEntities/);
  });
  test('G3. wired: harness + index + 11a injection', () => {
    assert.match(fs.readFileSync(path.join(ROOT, 'tests', 'harness.js'), 'utf8'), /11u-wisdom-learning-center/);
    assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /11u-wisdom-learning-center/);
    assert.match(fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8'), /wlcLearningSectionHtml/);
  });
  test('G4. mirror byte-identical + module < 900', () => {
    ['11u-wisdom-learning-center.js', '11a-wisdom-quotes.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(SRC.split('\n').length < 900);
  });
});
