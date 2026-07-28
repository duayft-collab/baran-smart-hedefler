'use strict';
/* SMART-GOALS Wisdom P8 — Executive Review & Decision Intelligence
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK · YAZDIRILABİLİR). Tek kaynak
   wqList/wqById + P4/P5/P6/P7; tek memoize snapshot → O(1) sekme geçişi.
   Snapshot / decision readiness+intelligence / momentum / priority actions /
   sekmeli workspace / print / statik guard. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11y-wisdom-executive-review.js'), 'utf8');
const SRC_PUB = fs.readFileSync(path.join(ROOT, 'public', 'js', '11y-wisdom-executive-review.js'), 'utf8');

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
  if (typeof S.werInvalidate === 'function') S.werInvalidate();
}
function link(S, decId, targetType, targetId) {
  S.relAdd({ sourceType: 'decision', sourceId: decId, targetType: targetType, targetId: targetId, relationType: 'related_to' });
  S.werInvalidate();
}

describe('Executive Snapshot', () => {
  test('1. snapshot returns all required fields', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 2, reflected: true, category: 'Liderlik' })],
      { decisions: [{ id: 'd1', title: 'x', status: 'open' }] });
    const s = S.werBuildExecutiveSnapshot('week');
    ['periodLabel', 'knowledgeHealth', 'reflectionScore', 'learningMomentum', 'coachSuccess',
     'categoryBalance', 'strongestCategory', 'weakestCategory', 'mostImportantGap', 'topRecommendation',
     'openDecisionCount', 'decisionCoverage', 'suggestedWeeklyFocus'].forEach(k => assert.ok(k in s, k));
    assert.equal(s.openDecisionCount, 1);
  });
  test('2. period behavior: week/month/quarter/all reads windows', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1, lastShownAt: iso(3) }),
             wq('b', { showCount: 1, lastShownAt: iso(20) }),
             wq('c', { showCount: 1, lastShownAt: iso(80) })]);
    assert.equal(S.werBuildExecutiveSnapshot('week').periodReads, 1);
    assert.equal(S.werBuildExecutiveSnapshot('month').periodReads, 2);
    assert.equal(S.werBuildExecutiveSnapshot('quarter').periodReads, 3);
    assert.equal(S.werBuildExecutiveSnapshot('all').periodReads, 3);
    assert.equal(S.werBuildExecutiveSnapshot('quarter').periodLabel, 'Bu Çeyrek');
  });
});

describe('Decision Readiness & Intelligence', () => {
  test('3. readiness increases with linked knowledge', () => {
    const S = createSandbox();
    const dec = { id: 'd1', title: 'yatırım kararı', status: 'open' };
    setup(S, [wq('a', { reflected: true }), wq('b')], { decisions: [dec], principles: [{ id: 'p1', statement: 's', status: 'active' }], goals: [{ id: 1, title: 'g', status: 'active' }] });
    const bare = S.werDecisionReadiness(dec);
    link(S, 'd1', 'wisdomQuote', 'a');
    link(S, 'd1', 'principle', 'p1');
    link(S, 'd1', 'goal', '1');
    const linked = S.werDecisionReadiness(dec);
    assert.ok(linked > bare);
    assert.ok(linked >= 0 && linked <= 100);
  });
  test('4. decision intelligence maps related wisdom/goals/principles', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { decisions: [{ id: 'd1', title: 'karar', status: 'open' }], principles: [{ id: 'p1', statement: 's', status: 'active' }] });
    link(S, 'd1', 'wisdomQuote', 'a');
    link(S, 'd1', 'principle', 'p1');
    const di = S.werDecisionIntelligence();
    assert.equal(di.length, 1);
    assert.equal(di[0].relatedWisdom.length, 1);
    assert.equal(di[0].relatedPrinciples.length, 1);
    assert.ok(di[0].readinessScore >= 0);
    assert.ok(['Düşük Risk', 'Orta Risk', 'Yüksek Risk'].indexOf(di[0].decisionRiskLabel) >= 0);
  });
  test('5. unresolved gap detection', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { decisions: [{ id: 'd1', title: 'karar', status: 'open' }] });
    const di = S.werDecisionIntelligence();
    assert.equal(di[0].unresolvedGap, 'İlişkili söz yok');
  });
  test('6. empty decisions safe', () => {
    const S = createSandbox();
    setup(S, [wq('a')]);
    assert.deepEqual(S.werDecisionIntelligence(), []);
    assert.equal(S.werBuildExecutiveSnapshot('week').openDecisionCount, 0);
  });
});

describe('Learning Momentum', () => {
  test('7. momentum current/previous/change/trend', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1, lastShownAt: iso(1) }),
             wq('b', { showCount: 1, lastShownAt: iso(2) }),
             wq('c', { showCount: 1, lastShownAt: iso(10) })]);
    const m = S.werLearningMomentum();
    assert.ok('current' in m && 'previous' in m && 'change' in m);
    assert.ok(['improving', 'declining', 'stable'].indexOf(m.trend) >= 0);
    assert.equal(m.change, m.current - m.previous);
  });
});

describe('Priority Actions', () => {
  test('8. ranked, limited to 5, with required fields', () => {
    const S = createSandbox();
    setup(S, [wq('a', { priority: 5, showCount: 0, quote: 'liderlik' }),
             wq('b', { favorite: true, lastShownAt: iso(45), showCount: 1 }),
             wq('c', { category: 'Satış', showCount: 0 })],
      { goals: [{ id: 1, title: 'liderlik', status: 'active' }],
        decisions: [{ id: 'd1', title: 'karar', status: 'open' }] });
    const a = S.werPriorityActions();
    assert.ok(a.length <= 5);
    a.forEach(x => { ['title', 'reason', 'entity', 'open', 'priority'].forEach(k => assert.ok(k in x, k)); });
    for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].priority >= a[i].priority); // öncelik desc
  });
  test('9. deterministic + stable tie-break', () => {
    const S = createSandbox();
    setup(S, [wq('a', { priority: 5, showCount: 0 })], { goals: [{ id: 1, title: 'x', status: 'active' }] });
    assert.deepEqual(S.werPriorityActions().map(x => x.entity.id), S.werPriorityActions().map(x => x.entity.id));
  });
});

describe('Snapshot Memoization & O(1) tab switch', () => {
  test('10. werSnapshot memoized by signature (same ref)', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    const s1 = S.werSnapshot('week');
    const s2 = S.werSnapshot('week');
    assert.equal(s1, s2);
  });
  test('11. tab switch does not rescan library (bounded wqList on cached snapshot)', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    S.werSnapshot('week'); // ilk hesap
    let calls = 0; const orig = S.wqList; S.wqList = function () { calls++; return orig(); };
    S.werSnapshot('week'); // aynı imza → cache
    assert.ok(calls <= 1, 'cached snapshot en fazla imza için 1 okuma yapar, oldu: ' + calls);
  });
  test('12. period change invalidates snapshot', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1, lastShownAt: iso(2) })]);
    const wkRef = S.werSnapshot('week');
    const moRef = S.werSnapshot('month');
    assert.notEqual(wkRef, moRef);
  });
});

describe('Source Fallback Parity', () => {
  test('13. identical snapshot for sharded vs legacy (same data)', () => {
    const arr = [wq('a', { showCount: 2, reflected: true }), wq('b')];
    const L = createSandbox(); setup(L, arr.map(x => Object.assign({}, x)));
    const legacy = L.werBuildExecutiveSnapshot('all');
    const Sd = createSandbox(); setup(Sd, []);
    // sadık sharded simülasyonu: hem wqList hem wqById store üzerinden okur
    Sd.wqList = () => arr.map(x => Object.assign({}, x));
    Sd.wqById = (id) => arr.map(x => Object.assign({}, x)).find(x => String(x.id) === String(id)) || null;
    Sd.wisdomReadSource = () => 'sharded';
    Sd.wiaInvalidate(); Sd.werInvalidate();
    const sharded = Sd.werBuildExecutiveSnapshot('all');
    assert.equal(JSON.stringify(sharded), JSON.stringify(legacy));
  });
});

describe('Tabbed Workspace — accessibility & responsive', () => {
  test('14. workspace renders tablist with roles + aria-selected', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    const h = S.werExecutiveWorkspaceHtml();
    assert.ok(/role="tablist"/.test(h));
    assert.ok(/role="tab"/.test(h));
    assert.ok(/aria-selected/.test(h));
    assert.ok(/role="tabpanel"/.test(h));
    assert.ok(/tabindex/.test(h));
    assert.ok(/Yönetici İncelemesi/.test(h));
  });
  test('15. entry point is compact when closed, workspace when open', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    const closed = S.werEntryPointHtml();
    assert.ok(!/role="tablist"/.test(closed)); // kapalı: kompakt
    S.werToggleWorkspace();
    const open = S.werEntryPointHtml();
    assert.ok(/role="tablist"/.test(open)); // açık: workspace
  });
  test('16. keyboard nav moves active tab (ArrowRight)', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    S.werToggleWorkspace();
    S.werSetTab('overview');
    S.werTabKey({ key: 'ArrowRight' });
    const h = S.werExecutiveWorkspaceHtml();
    assert.ok(/id="wer_tab_decisions" aria-selected="true"/.test(h));
  });
  test('17. responsive: max-width:100%, no fixed large px width', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    S.werToggleWorkspace();
    const h = S.werExecutiveWorkspaceHtml();
    assert.ok(/max-width:100%/.test(h));
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped));
  });
  test('18. empty library → empty entry/workspace', () => {
    const S = createSandbox(); setup(S, []);
    assert.equal(S.werEntryPointHtml(), '');
    assert.equal(S.werExecutiveWorkspaceHtml(), '');
  });
});

describe('Executive Report & Print', () => {
  test('19. report contains all sections', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1, quote: 'liderlik' })],
      { decisions: [{ id: 'd1', title: 'x', status: 'open' }] });
    const h = S.werExecutiveReportHtml('week');
    ['Yönetici Özeti', 'Karar Hazırlığı', 'Öne Çıkan İçgörü', 'Bilgi Boşlukları', 'Öncelikli Aksiyonlar'].forEach(sec => assert.ok(h.indexOf(sec) >= 0, sec));
  });
  test('20. print isolation CSS present (@media print + report scope)', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    const h = S.werExecutiveReportHtml('week');
    assert.ok(/@media print/.test(h));
    assert.ok(/wer-report/.test(h));
    assert.ok(/visibility:hidden/.test(h));
  });
  test('21. werPrintReport uses window.print only (no network/download)', () => {
    const S = createSandbox();
    let printed = false; S.window.print = () => { printed = true; };
    S.werPrintReport();
    assert.equal(printed, true);
  });
});

describe('Integration & Regression', () => {
  test('22. renderWisdomQuotes injects entry point without throwing', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })]);
    S.tab = 'wisdom';
    assert.doesNotThrow(() => S.renderWisdomQuotes());
    const html = S.__getElements().pinner.innerHTML;
    assert.ok(/Yönetici İncelemesi/.test(html));
    assert.ok(/Bilgi Koçu/.test(html)); // P6 intact
    assert.ok(/Yönetici İçgörü Merkezi/.test(html)); // P7 intact
  });
  test('23. prior derived layers intact (P4/P5/P6/P7)', () => {
    const S = createSandbox();
    ['wlcLearningSectionHtml', 'wkgKnowledgeCenterHtml', 'wcoCoachPanelHtml',
     'wiaExecutiveInsightCenterHtml', 'wiaExecutiveDashboard', 'wcoRecommend'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
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
  test('24. no forbidden write/network/collection tokens', () => {
    forbidden.forEach(([re, name]) => assert.ok(!re.test(SRC), 'forbidden: ' + name));
  });
  test('25. reads via wqList/wqById; print via window.print', () => {
    assert.ok(/wqList\s*\(/.test(SRC));
    assert.ok(/window\.print/.test(SRC));
  });
  test('26. mirror byte-identity js ↔ public/js', () => { assert.equal(SRC, SRC_PUB); });
  test('27. file under 900 lines', () => { assert.ok(SRC.split('\n').length < 900); });
});
