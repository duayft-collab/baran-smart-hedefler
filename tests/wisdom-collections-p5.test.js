'use strict';
/* WISDOM P5 — Knowledge Collections & Knowledge Graph (TÜRETİLMİŞ, SALT OKUNUR).
   Tek kaynak wqList/relations + P4 wlcRelated; yeni koleksiyon/write/listener YOK. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11v-wisdom-collections.js'), 'utf8');

function wq(id, over) { return Object.assign({ id: id, quote: 'Söz ' + id, author: 'A', category: 'Liderlik', language: 'tr', favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null }, over || {}); }
function setQ(S, arr) { S.D.wisdomQuotes = arr; S.D.relations = []; S.D.goals = []; S.wisdomStoreReset(); }

describe('Collections', () => {
  test('1. 20 preset collections defined', () => {
    const S = createSandbox();
    assert.equal(S.WKG_COLLECTIONS.length, 20);
  });
  test('2. collection derives total/favorites/mostPopular/relatedGoals', () => {
    const S = createSandbox(); setQ(S, [
      wq('a', { category: 'Liderlik', favorite: true, showCount: 5 }),
      wq('b', { category: 'Liderlik', showCount: 1 }),
      wq('c', { category: 'Satış' })]);
    const col = S.wkgCollection('Liderlik');
    assert.equal(col.total, 2); assert.equal(col.favorites, 1);
    assert.equal(col.mostPopular.id, 'a');
  });
  test('3. special collection "Hayatımı Değiştirenler" = favorite||reflected', () => {
    const S = createSandbox(); setQ(S, [wq('a', { favorite: true }), wq('b', { reflected: true }), wq('c')]);
    assert.equal(S.wkgCollection('Hayatımı Değiştirenler').total, 2);
  });
  test('4. keyword collection (Karar Verme) matches by quote text', () => {
    const S = createSandbox(); setQ(S, [wq('a', { quote: 'iyi karar hayatı değiştirir', category: 'X' }), wq('b', { quote: 'başka' })]);
    assert.ok(S.wkgCollectionItems('Karar Verme').some(q => q.id === 'a'));
  });
  test('5. wkgCollections returns summary array', () => {
    const S = createSandbox(); setQ(S, [wq('a', { category: 'Liderlik' })]);
    const arr = S.wkgCollections();
    assert.equal(arr.length, 20);
    assert.ok(arr.some(c => c.name === 'Liderlik' && c.total === 1));
  });
});

describe('Knowledge Graph & Chain', () => {
  test('6. graph: same author/category/tag + relations', () => {
    const S = createSandbox(); setQ(S, [
      wq('a', { author: 'X', category: 'Liderlik', tags: ['odak'] }),
      wq('b', { author: 'X', category: 'Satış' }),
      wq('c', { category: 'Liderlik', tags: ['odak'] })]);
    const g = S.wkgGraph('a');
    assert.ok(g.sameAuthor.some(q => q.id === 'b'));
    assert.ok(g.sameCategory.some(q => q.id === 'c'));
    assert.ok(Array.isArray(g.relatedGoals) && Array.isArray(g.relatedBooks));
  });
  test('7. chain: quote → relatedQuotes → book/goal/decision/note', () => {
    const S = createSandbox(); setQ(S, [wq('a', { category: 'Liderlik' }), wq('b', { category: 'Liderlik' })]);
    S.D.goals = [{ id: 7, title: 'Hedef' }];
    S.relAdd({ sourceType: 'wisdomQuote', sourceId: 'a', targetType: 'goal', targetId: '7', relationType: 'related_to' });
    const c = S.wkgChain('a');
    assert.ok(c.quote && Array.isArray(c.relatedQuotes));
    assert.ok(c.goal && c.goal.label === 'Hedef');
  });
  test('8. graph null-safe for missing id', () => {
    const S = createSandbox(); setQ(S, [wq('a')]);
    assert.equal(S.wkgGraph('zzz'), null);
    assert.equal(S.wkgChain('zzz'), null);
  });
});

describe('Expertise / Score / Radar', () => {
  test('9. expertise: 16 fields with total/score/density/favorites', () => {
    const S = createSandbox(); setQ(S, [wq('a', { category: 'Liderlik', favorite: true, showCount: 3 }), wq('b', { category: 'Finans' })]);
    const ex = S.wkgExpertise();
    assert.equal(ex.length, 16);
    const lead = ex.find(x => x.field === 'Liderlik');
    assert.equal(lead.total, 1); assert.ok(lead.expertiseScore >= 0 && lead.expertiseScore <= 100);
    assert.ok('density' in lead && 'favorites' in lead);
  });
  test('10. knowledge score 0..100 derived', () => {
    const S = createSandbox(); setQ(S, [wq('a', { favorite: true, showCount: 2, pinned: true, notes: 'n' }), wq('b')]);
    const s = S.wkgKnowledgeScore();
    assert.ok(s >= 0 && s <= 100);
    const S2 = createSandbox(); setQ(S2, []);
    assert.equal(S2.wkgKnowledgeScore(), 0);
  });
  test('11. radars: strongest/weakest/active category+author', () => {
    const S = createSandbox(); setQ(S, [
      wq('a', { category: 'Liderlik', favorite: true, reflected: true, showCount: 9, author: 'X' }),
      wq('b', { category: 'Finans', showCount: 0, author: 'Y' })]);
    const r = S.wkgRadars();
    assert.ok(['Liderlik', 'Finans'].indexOf(r.strongest) >= 0);
    assert.equal(r.mostActiveCategory, 'Liderlik');
    assert.equal(r.mostActiveAuthor, 'X');
  });
});

describe('Dashboard & UI', () => {
  test('12. dashboard cards: score/collections/expertise/graph/radar/density', () => {
    const S = createSandbox(); setQ(S, [wq('a', { category: 'Liderlik', showCount: 1 }), wq('b', { category: 'Finans' })]);
    const d = S.wkgDashboardCards();
    ['knowledgeScore', 'collections', 'expertiseAreas', 'graphNodes', 'radar', 'learningDensity'].forEach(function (k) {
      assert.ok(Object.prototype.hasOwnProperty.call(d, k), k);
    });
    assert.equal(d.graphNodes, 2);
  });
  test('13. Knowledge Center html: header + 4 summary cards + collapsible', () => {
    const S = createSandbox(); setQ(S, [wq('a', { category: 'Liderlik' }), wq('b', { category: 'Satış' })]);
    const h = S.wkgKnowledgeCenterHtml();
    assert.match(h, /Bilgi Merkezi/);
    ['Toplam Bilgi', 'Koleksiyon Sayısı', 'Uzmanlık Alanı', 'Knowledge Score'].forEach(function (l) { assert.ok(h.indexOf(l) >= 0, l); });
    assert.match(h, /<details/); // katlanır, klavye erişilebilir
    assert.equal(/<canvas|Chart\.js|d3\./i.test(h), false); // grafik yok
  });
  test('14. empty pool => empty knowledge center', () => {
    const S = createSandbox(); setQ(S, []);
    assert.equal(S.wkgKnowledgeCenterHtml(), '');
  });
  test('15. responsive: no fixed pixel WIDTH', () => {
    const S = createSandbox(); setQ(S, [wq('a')]);
    const h = S.wkgKnowledgeCenterHtml();
    assert.equal(/width:\s*\d{2,}px/.test(h.replace(/(min|max)-width:\s*\d+px/g, '')), false);
  });
});

describe('Read-only & guards', () => {
  test('16. never mutates D / store', () => {
    const S = createSandbox(); setQ(S, [wq('a'), wq('b')]);
    const bd = JSON.stringify(S.D.wisdomQuotes);
    S.wkgCollections(); S.wkgGraph('a'); S.wkgExpertise(); S.wkgRadars(); S.wkgKnowledgeScore(); S.wkgDashboardCards(); S.wkgKnowledgeCenterHtml();
    assert.equal(JSON.stringify(S.D.wisdomQuotes), bd);
  });
  test('17. reads sharded cache via wqList', () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('legacy')];
    S._wisdomStoreSeed([wq('s1', { category: 'Liderlik' }), wq('s2', { category: 'Liderlik' })], true);
    assert.equal(S.wkgDashboardCards().graphNodes, 2); // koleksiyondan
  });
  test('G1. no write / listener / new collection / sharding-migration-restore calls', () => {
    assert.equal(/\bsave\s*\(|writeLocal\s*\(|\bsnap\s*\(|D\.wisdomQuotes\s*=|onSnapshot\s*\(|\.subscribe\s*\(|wisdomMigrationStart\s*\(|wisdomShardedRestore\s*\(|wisdomStoreSet\s*\(|wisdomStoreBatchWrite\s*\(|\.batch\s*\(|createBackup\s*\(/.test(SRC), false);
  });
  test('G2. reuses wqList + relations + P4 wlcRelated (no second selector)', () => {
    assert.match(SRC, /wqList/); assert.match(SRC, /wlcRelated/);
  });
  test('G3. wired: harness + index + 11a injection', () => {
    assert.match(fs.readFileSync(path.join(ROOT, 'tests', 'harness.js'), 'utf8'), /11v-wisdom-collections/);
    assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /11v-wisdom-collections/);
    assert.match(fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8'), /wkgKnowledgeCenterHtml/);
  });
  test('G4. mirror byte-identical + module < 900', () => {
    ['11v-wisdom-collections.js', '11a-wisdom-quotes.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(SRC.split('\n').length < 900);
  });
});
