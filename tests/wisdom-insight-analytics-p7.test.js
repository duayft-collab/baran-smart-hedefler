'use strict';
/* SMART-GOALS Wisdom P7 — Insight Analytics & Reflection Intelligence
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK). Tek kaynak wqList/wqById + P4/P5/P6.
   Engagement / gaps / follow-through / reflection prompt / weekly review /
   executive dashboard / timeline / recommendations + memoization + statik guard. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11x-wisdom-insight-analytics.js'), 'utf8');
const SRC_PUB = fs.readFileSync(path.join(ROOT, 'public', 'js', '11x-wisdom-insight-analytics.js'), 'utf8');

const DAY = 864e5;
function iso(offDays) { return new Date(Date.now() - offDays * DAY).toISOString(); }
function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Yazar', category: '', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], priority: 3,
    createdAt: iso(100), updatedAt: iso(100), lastShownAt: null }, over || {});
}
function setup(S, quotes, opts) {
  opts = opts || {};
  S.D.wisdomQuotes = quotes || [];
  S.D.goals = opts.goals || [];
  S.D.decisions = opts.decisions || [];
  S.D.principles = opts.principles || [];
  S.D.relations = opts.relations || [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  if (typeof S.wiaInvalidate === 'function') S.wiaInvalidate();
}

describe('Base & Memoization', () => {
  test('1. wiaBase single computation, memoized by signature', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 3 }), wq('b')]);
    const b1 = S.wiaBase();
    const b2 = S.wiaBase();
    assert.equal(b1, b2); // aynı referans → memoize
    assert.equal(b1.total, 2);
    assert.equal(b1.read, 1);
  });
  test('2. signature change (data mutation) recomputes', () => {
    const S = createSandbox();
    setup(S, [wq('a')]);
    const b1 = S.wiaBase();
    S.D.wisdomQuotes.push(wq('c', { showCount: 5 }));
    if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
    const b2 = S.wiaBase();
    assert.notEqual(b1, b2);
    assert.equal(b2.total, 2);
  });
  test('3. wqList call count independent of library size (no per-item scans)', () => {
    function count(n) {
      const S = createSandbox();
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(wq('q' + i, { showCount: i % 2, category: ['A', 'B', 'C'][i % 3] }));
      setup(S, arr, { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
      let calls = 0; const orig = S.wqList; S.wqList = function () { calls++; return orig(); };
      S.wiaInvalidate();
      S.wiaExecutiveDashboard();
      return calls;
    }
    const small = count(40), large = count(600);
    assert.equal(small, large); // çağrı N'den bağımsız → çift tarama yok, tek base + sabit P4/P5/P6 yeniden kullanımı
  });
});

describe('Module 1 — Engagement Analytics', () => {
  test('4. engagement math', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 2, reflected: true, favorite: true, category: 'Liderlik' }),
             wq('b', { showCount: 0, category: 'Satış' }),
             wq('c', { showCount: 1, lastShownAt: iso(2) }),
             wq('d', { showCount: 0 })]);
    const e = S.wiaEngagementStats();
    assert.equal(e.readCoverage, 50); // 2/4
    assert.equal(e.reflectionRate, 25); // 1/4
    assert.equal(e.favoriteRate, 25);
    assert.equal(e.untouched, 2);
    assert.equal(e.weeklyReads, 1); // yalnız c (iso2)
    assert.ok(e.activeCategories >= 2);
  });
  test('5. weekly vs monthly reads window', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1, lastShownAt: iso(3) }),
             wq('b', { showCount: 1, lastShownAt: iso(20) }),
             wq('c', { showCount: 1, lastShownAt: iso(60) })]);
    const e = S.wiaEngagementStats();
    assert.equal(e.weeklyReads, 1);
    assert.equal(e.monthlyReads, 2);
  });
});

describe('Module 2 — Learning Gaps', () => {
  test('6. detects never-visited categories, ranked', () => {
    const S = createSandbox();
    setup(S, [wq('a', { category: 'Liderlik', showCount: 0 }),
             wq('b', { category: 'Satış', showCount: 3 })]);
    const g = S.wiaLearningGaps();
    const cat = g.find(x => x.type === 'category_unvisited');
    assert.ok(cat);
    assert.ok(cat.items.indexOf('Liderlik') >= 0);
    assert.ok(cat.items.indexOf('Satış') < 0);
  });
  test('7. detects forgotten pinned + unrevisited favorites', () => {
    const S = createSandbox();
    setup(S, [wq('a', { pinned: true, lastShownAt: iso(40) }),
             wq('b', { favorite: true, showCount: 0 })]);
    const g = S.wiaLearningGaps();
    assert.ok(g.some(x => x.type === 'pinned_forgotten'));
    assert.ok(g.some(x => x.type === 'favorite_unrevisited'));
  });
  test('8. gaps sorted by priority desc', () => {
    const S = createSandbox();
    setup(S, [wq('a', { category: 'X', showCount: 0 }), wq('b', { favorite: true, showCount: 0 })]);
    const g = S.wiaLearningGaps();
    for (let i = 1; i < g.length; i++) assert.ok(g[i - 1].priority >= g[i].priority);
  });
});

describe('Module 3 — Follow Through', () => {
  test('9. funnel over coach recommendations', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 2, reflected: true, favorite: true }),
             wq('b', { showCount: 0 })],
      { goals: [{ id: 1, title: 'x', status: 'active' }] });
    const f = S.wiaFollowThrough();
    assert.ok(f.total >= 1);
    assert.ok(f.viewed >= 1);
    assert.ok(f.reflected >= 1);
    assert.equal(typeof f.reflectedRate, 'number');
  });
});

describe('Module 4 — Reflection Intelligence', () => {
  test('10. deterministic prompt for top recommendation', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik' })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    const p1 = S.wiaReflectionPrompt();
    const p2 = S.wiaReflectionPrompt();
    assert.ok(p1 && p1.prompt);
    assert.equal(p1.prompt, p2.prompt); // deterministik
    assert.ok(S.WIA_PROMPTS.indexOf(p1.prompt) >= 0);
  });
  test('11. null prompt when empty library', () => {
    const S = createSandbox(); setup(S, []);
    assert.equal(S.wiaReflectionPrompt(), null);
  });
});

describe('Module 5 — Weekly Review', () => {
  test('12. weekly review fields derived', () => {
    const S = createSandbox();
    setup(S, [wq('a', { category: 'Liderlik', showCount: 5, favorite: true }),
             wq('b', { category: 'Satış', showCount: 0 })]);
    const w = S.wiaWeeklyReview();
    ['topInsight', 'mostIgnoredArea', 'strongestCategory', 'weakestCategory', 'recommendedFocus', 'knowledgeMomentum'].forEach(k => assert.ok(k in w));
    assert.ok(['improving', 'stable', 'idle'].indexOf(w.knowledgeMomentum) >= 0);
  });
});

describe('Module 6 — Executive Dashboard', () => {
  test('13. eight dashboard cards, percentages bounded', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 2, reflected: true, category: 'Liderlik' })],
      { decisions: [{ id: 'd1', title: 'x', status: 'open' }] });
    const d = S.wiaExecutiveDashboard();
    ['knowledgeHealth', 'reflectionScore', 'learningMomentum', 'decisionCoverage',
     'categoryBalance', 'knowledgeScore', 'coachSuccess', 'weeklyFocus'].forEach(k => assert.ok(k in d));
    [d.knowledgeHealth, d.reflectionScore, d.decisionCoverage, d.categoryBalance, d.knowledgeScore, d.coachSuccess].forEach(v => {
      assert.ok(v >= 0 && v <= 100);
    });
  });
  test('14. decision coverage reflects related wisdom', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { decisions: [{ id: 'd1', title: 'x', status: 'open' }] });
    // ilişki yok → 0
    assert.equal(S.wiaExecutiveDashboard().decisionCoverage, 0);
    S.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'wisdomQuote', targetId: 'a', relationType: 'related_to' });
    S.wiaInvalidate();
    assert.equal(S.wiaExecutiveDashboard().decisionCoverage, 100);
  });
});

describe('Module 7 — Insight Timeline', () => {
  test('15. groups by Today/This Week/Earlier, sorted desc', () => {
    const S = createSandbox();
    setup(S, [wq('a', { reflected: true, updatedAt: iso(0) }),
             wq('b', { favorite: true, updatedAt: iso(3) }),
             wq('c', { pinned: true, updatedAt: iso(40) })]);
    const t = S.wiaTimeline();
    assert.ok(t.today.length >= 1);
    assert.ok(t.week.length >= 1);
    assert.ok(t.earlier.length >= 1);
    // desc ts within a group
    for (let i = 1; i < t.today.length; i++) assert.ok(t.today[i - 1].ts >= t.today[i].ts);
  });
});

describe('Module 8 — Personal Recommendations', () => {
  test('16. buckets: best5/needsReview/hiddenGems/forgottenFav/neverRead', () => {
    const S = createSandbox();
    setup(S, [wq('a', { favorite: true, lastShownAt: iso(45) }),
             wq('b', { priority: 5, showCount: 0 }),
             wq('c', { favorite: true, showCount: 0 }),
             wq('d', { showCount: 0 })]);
    const r = S.wiaRecommendations();
    assert.ok(Array.isArray(r.todaysBest5) && r.todaysBest5.length <= 5);
    assert.ok(r.needsReview.length >= 1); // a
    assert.ok(r.hiddenGems.length >= 1); // b
    assert.ok(r.forgottenFavorites.length >= 1); // c
    assert.ok(r.neverRead.length >= 1);
  });
  test('17. goal/decision alignment derived from coach matches', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'ingilizce sertifika' })],
      { goals: [{ id: 1, title: 'İngilizce sertifika', status: 'active' }] });
    const r = S.wiaRecommendations();
    assert.ok(r.goalAlignment.some(x => x.goal === 'İngilizce sertifika'));
  });
});

describe('Source Fallback Parity', () => {
  test('18. identical engagement for sharded vs legacy (same data)', () => {
    const arr = [wq('a', { showCount: 2, reflected: true }), wq('b', { showCount: 0 })];
    const L = createSandbox(); setup(L, arr.map(x => Object.assign({}, x)));
    const legacy = L.wiaEngagementStats();
    const Sd = createSandbox(); setup(Sd, []);
    Sd.wqList = () => arr.map(x => Object.assign({}, x));
    Sd.wisdomReadSource = () => 'sharded';
    Sd.wiaInvalidate();
    const sharded = Sd.wiaEngagementStats();
    // vm context'leri farklı prototiplere sahip → yapısal JSON eşitliği
    assert.equal(JSON.stringify(sharded), JSON.stringify(legacy));
  });
});

describe('Panel HTML — responsive, accessible', () => {
  test('19. renders Executive Insight Center with sections', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik', showCount: 1 })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    const h = S.wiaExecutiveInsightCenterHtml();
    assert.ok(/Yönetici İçgörü Merkezi/.test(h));
    assert.ok(/Bilgi Sağlığı/.test(h));
    assert.ok(/Haftalık Değerlendirme/.test(h));
    assert.ok(/Kişisel Öneriler/.test(h));
    assert.ok(/İçgörü Zaman Çizelgesi/.test(h));
  });
  test('20. empty library → empty panel', () => {
    const S = createSandbox(); setup(S, []);
    assert.equal(S.wiaExecutiveInsightCenterHtml(), '');
  });
  test('21. reflection prompt uses existing wqToggleReflect only', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'x', status: 'active' }] });
    const h = S.wiaExecutiveInsightCenterHtml();
    assert.ok(/wqToggleReflect/.test(h));
    assert.ok(/Bunu düşündüm/.test(h));
  });
  test('22. inline SVG sparkline present + responsive', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1, lastShownAt: iso(2) })]);
    const h = S.wiaExecutiveInsightCenterHtml();
    assert.ok(/<svg/.test(h));
    assert.ok(/role="img"/.test(h));
    assert.ok(/max-width:100%/.test(h));
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped)); // sabit büyük genişlik yok (svg width kısa)
  });
  test('23. accessibility: summary tabindex + aria label on svg', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    const h = S.wiaExecutiveInsightCenterHtml();
    assert.ok(/<summary/.test(h));
    assert.ok(/tabindex/.test(h));
    assert.ok(/aria-label/.test(h));
  });
});

describe('Integration & Regression', () => {
  test('24. renderWisdomQuotes injects insight center without throwing', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik', showCount: 1 })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    S.tab = 'wisdom';
    assert.doesNotThrow(() => S.renderWisdomQuotes());
    const html = S.__getElements().pinner.innerHTML;
    assert.ok(/Yönetici İçgörü Merkezi/.test(html));
    assert.ok(/Bilgi Koçu/.test(html)); // P6 hâlâ var
  });
  test('25. prior derived panels intact (P4/P5/P6)', () => {
    const S = createSandbox();
    ['wlcLearningSectionHtml', 'wkgKnowledgeCenterHtml', 'wcoCoachPanelHtml',
     'wcoRecommend', 'wkgKnowledgeScore', 'wkgRadars'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
});

describe('Static Guards (0-write, 0-network, derived-only)', () => {
  const forbidden = [
    [/\bsave\s*\(/, 'save('], [/\bsnap\s*\(/, 'snap('], [/commitMutation/, 'commitMutation'],
    [/queueCloudSave/, 'queueCloudSave'], [/createBackup/, 'createBackup'],
    [/\bfetch\s*\(/, 'fetch('], [/onSnapshot/, 'onSnapshot'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/WebSocket/, 'WebSocket'],
    [/WQ_STORE/, 'WQ_STORE'], [/D\.wisdomQuotes/, 'D.wisdomQuotes'],
    [/DIFF_SCHEMA/, 'DIFF_SCHEMA'], [/wisdomStoreList\s*\(/, 'wisdomStoreList('],
    [/runTransaction/, 'runTransaction'], [/\.set\s*\(/, '.set('], [/INIT\./, 'INIT.']
  ];
  test('26. no forbidden write/network/collection tokens', () => {
    forbidden.forEach(([re, name]) => assert.ok(!re.test(SRC), 'forbidden: ' + name));
  });
  test('27. reads via wqList/wqById; reflection via wqToggleReflect', () => {
    assert.ok(/wqList\s*\(/.test(SRC));
    assert.ok(/wqToggleReflect/.test(SRC));
  });
  test('28. mirror byte-identity js ↔ public/js', () => { assert.equal(SRC, SRC_PUB); });
  test('29. file under 900 lines', () => { assert.ok(SRC.split('\n').length < 900); });
});
