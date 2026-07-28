'use strict';
/* SMART-GOALS Wisdom P11 — Executive Intelligence & Strategic Decision Center
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK). Tek kaynak wqList/wqById + P4–P8/P10.
   Priority / risks / opportunities / confidence / brief / focus / heatmap /
   memoization / erişilebilirlik / statik guard / regresyon. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '12b-wisdom-executive-intelligence.js'), 'utf8');
const SRC_PUB = fs.readFileSync(path.join(ROOT, 'public', 'js', '12b-wisdom-executive-intelligence.js'), 'utf8');

const DAY = 864e5;
function iso(o) { return new Date(Date.now() - o * DAY).toISOString(); }
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
  ['wiaInvalidate', 'werInvalidate', 'wwsInvalidate', 'weiInvalidate'].forEach(fn => { if (typeof S[fn] === 'function') S[fn](); });
}

describe('Snapshot & Memoization', () => {
  test('1. weiSnapshot memoized by signature (same ref)', () => {
    const S = createSandbox(); setup(S, [wq('a', { showCount: 1 })]);
    assert.equal(S.weiSnapshot(), S.weiSnapshot());
  });
  test('2. reuses derived layers (bounded wqList reads)', () => {
    const S = createSandbox(); setup(S, [wq('a', { showCount: 1 })]);
    S.weiSnapshot();
    let calls = 0; const orig = S.wqList; S.wqList = function () { calls++; return orig(); };
    S.weiSnapshot(); // cache
    assert.ok(calls <= 1, 'cached snapshot ≤1 okuma, oldu: ' + calls);
  });
});

describe('Executive Priority', () => {
  test('3. ranks up to 10, deterministic, with reasons', () => {
    const S = createSandbox();
    const qs = [];
    for (let i = 0; i < 15; i++) qs.push(wq('q' + i, { quote: 'liderlik ' + i, priority: (i % 5) + 1, favorite: i % 2 === 0 }));
    setup(S, qs, { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    const p1 = S.weiExecutivePriority();
    const p2 = S.weiExecutivePriority();
    assert.ok(p1.length <= 10);
    assert.deepEqual(p1.map(x => x.id), p2.map(x => x.id));
    assert.ok(p1[0].score >= p1[p1.length - 1].score);
    p1.forEach(x => { assert.ok('quote' in x && Array.isArray(x.reasons)); });
  });
  test('4. unreflected + unread flagged as needing attention', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik', showCount: 0, reflected: false })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    const p = S.weiExecutivePriority();
    assert.ok(p.length >= 1);
    assert.ok(p[0].reasons.some(r => /Okunmadı|yansıtılmadı/.test(r)));
  });
});

describe('Strategic Risks', () => {
  test('5. low reflection + weak category + ignored decision detected with severity', () => {
    const S = createSandbox();
    setup(S, [wq('a', { category: 'Liderlik', showCount: 0 }), wq('b', { category: 'Satış', showCount: 0 })],
      { decisions: [{ id: 'd1', title: 'karar', status: 'open' }] });
    const r = S.weiStrategicRisks();
    assert.ok(r.some(x => x.type === 'low_reflection'));
    assert.ok(r.some(x => x.type === 'ignored_decision' && x.severity === 'Critical'));
    // Critical önce
    if (r.length > 1) assert.ok(['Critical', 'High', 'Medium', 'Low'].indexOf(r[0].severity) <= ['Critical', 'High', 'Medium', 'Low'].indexOf(r[1].severity));
  });
  test('6. empty-safe', () => {
    const S = createSandbox(); setup(S, [wq('a', { showCount: 1, reflected: true })]);
    assert.ok(Array.isArray(S.weiStrategicRisks()));
  });
});

describe('Strategic Opportunities', () => {
  test('7. high-value unread + neglected favorites', () => {
    const S = createSandbox();
    setup(S, [wq('a', { priority: 5, showCount: 0 }), wq('b', { favorite: true, showCount: 0 })]);
    const o = S.weiStrategicOpportunities();
    assert.ok(o.some(x => x.type === 'high_value_unread'));
    assert.ok(o.some(x => x.type === 'neglected_favorite'));
  });
});

describe('Decision Confidence', () => {
  test('8. 0-100, rises with linked+read wisdom', () => {
    const S = createSandbox();
    const dec = { id: 'd1', title: 'karar', status: 'open' };
    setup(S, [wq('a', { showCount: 3, reflected: true })], { decisions: [dec], principles: [{ id: 'p1', statement: 's', status: 'active' }] });
    const bare = S.weiDecisionConfidence(dec);
    S.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'wisdomQuote', targetId: 'a', relationType: 'related_to' });
    S.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'principle', targetId: 'p1', relationType: 'related_to' });
    S.weiInvalidate();
    const linked = S.weiDecisionConfidence(dec);
    assert.ok(linked > bare);
    assert.ok(linked >= 0 && linked <= 100);
  });
});

describe('Executive Brief & Focus & Heatmap', () => {
  test('9. brief has all sections', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1 })], { decisions: [{ id: 'd1', title: 'x', status: 'open' }] });
    const b = S.weiExecutiveBrief();
    ['biggestProgress', 'biggestRisk', 'biggestOpportunity', 'recommendedNextAction', 'recommendedWisdom', 'executiveHealth'].forEach(k => assert.ok(k in b, k));
  });
  test('10. focus today/week/month arrays', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik', showCount: 0 })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    const f = S.weiExecutiveFocus();
    assert.ok(Array.isArray(f.today) && Array.isArray(f.week) && Array.isArray(f.month));
    assert.ok(f.today.length <= 5 && f.week.length <= 5);
  });
  test('11. heatmap rows (life areas) × levels, derived', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'kendim üzerine' })], { principles: [{ id: 'p1', statement: 's', lifeArea: 'myself', status: 'active' }] });
    const hm = S.weiHeatmap();
    assert.equal(hm.levels.length, 4);
    assert.ok(hm.rows.length >= 1);
    hm.rows.forEach(r => { assert.ok('area' in r && 'level' in r); assert.ok(r.level >= 0 && r.level <= 3); });
  });
});

describe('Source Fallback Parity', () => {
  test('12. identical brief for sharded vs legacy (same data)', () => {
    const arr = [wq('a', { showCount: 2, reflected: true, category: 'Liderlik' })];
    const L = createSandbox(); setup(L, arr.map(x => Object.assign({}, x)));
    const legacy = L.weiExecutiveBrief();
    const Sd = createSandbox(); setup(Sd, []);
    Sd.wqList = () => arr.map(x => Object.assign({}, x));
    Sd.wqById = (id) => arr.map(x => Object.assign({}, x)).find(x => String(x.id) === String(id)) || null;
    Sd.wisdomReadSource = () => 'sharded';
    ['wiaInvalidate', 'werInvalidate', 'weiInvalidate'].forEach(fn => Sd[fn]());
    const sharded = Sd.weiExecutiveBrief();
    assert.equal(JSON.stringify(sharded), JSON.stringify(legacy));
  });
});

describe('Dashboard UI — accessibility, responsive, print', () => {
  test('13. dashboard renders KPI + brief + risks + opportunities + heatmap', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik', showCount: 1 })],
      { goals: [{ id: 1, title: 'liderlik', status: 'active' }], decisions: [{ id: 'd1', title: 'x', status: 'open' }] });
    const h = S.weiDashboardHtml();
    ['Yönetici Brifingi', 'Yönetici Öncelikleri', 'Stratejik Riskler', 'Stratejik Fırsatlar', 'Yönetici Isı Haritası'].forEach(sec => assert.ok(h.indexOf(sec) >= 0, sec));
  });
  test('14. accessibility + responsive + print', () => {
    const S = createSandbox(); setup(S, [wq('a', { showCount: 1 })]);
    const h = S.weiDashboardHtml();
    assert.ok(/role="table"/.test(h));
    assert.ok(/aria-label/.test(h));
    assert.ok(/@media print/.test(h));
    assert.ok(/position:sticky/.test(h)); // sticky özet
    assert.ok(/max-width:100%/.test(h));
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped));
  });
  test('15. productivity shortcuts delegate to P10 workspace', () => {
    const S = createSandbox(); setup(S, [wq('a', { showCount: 1 })]);
    const h = S.weiDashboardHtml();
    assert.ok(/wwsGo\(/.test(h));
    assert.ok(/wwsToggleFocus\(\)/.test(h));
  });
  test('16. empty library → graceful message', () => {
    const S = createSandbox(); setup(S, []);
    const h = S.weiDashboardHtml();
    assert.ok(/yeterli bilgi yok/.test(h));
  });
});

describe('Integration & Regression', () => {
  test('17. P10 workspace exposes intel section rendering weiDashboardHtml', () => {
    const S = createSandbox(); setup(S, [wq('a', { showCount: 1 })]);
    assert.ok(S.WWS_NAV.some(n => n[0] === 'intel'));
    S.wwsGo('intel');
    const h = S.wwsWorkspaceHtml();
    assert.ok(/id="wws_nav_intel" aria-selected="true"/.test(h));
    assert.ok(/Yönetici Brifingi/.test(h)); // 12b rendered inside workspace
  });
  test('18. P10 Ctrl shortcuts unchanged (Ctrl+2 → coach)', () => {
    const S = createSandbox(); setup(S, [wq('a', { showCount: 1 })]);
    S.wwsKey({ ctrlKey: true, key: '2', preventDefault() {} });
    const h = S.wwsWorkspaceHtml();
    assert.ok(/id="wws_nav_coach" aria-selected="true"/.test(h));
  });
  test('19. prior derived layers intact (P4–P10)', () => {
    const S = createSandbox();
    ['wlcLearningSectionHtml', 'wkgKnowledgeCenterHtml', 'wcoCoachPanelHtml',
     'wiaExecutiveInsightCenterHtml', 'werExecutiveWorkspaceHtml', 'wwsWorkspaceHtml'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
});

describe('Static Guards (0-write, 0-network, derived-only)', () => {
  const forbidden = [
    [/\bsave\s*\(/, 'save('], [/\bsnap\s*\(/, 'snap('], [/commitMutation/, 'commitMutation'],
    [/queueCloudSave/, 'queueCloudSave'], [/createBackup/, 'createBackup'],
    [/\bfetch\s*\(/, 'fetch('], [/\.onSnapshot\s*\(/, '.onSnapshot('], [/XMLHttpRequest/, 'XMLHttpRequest'], [/WebSocket/, 'WebSocket'],
    [/WQ_STORE/, 'WQ_STORE'], [/D\.wisdomQuotes/, 'D.wisdomQuotes'],
    [/DIFF_SCHEMA/, 'DIFF_SCHEMA'], [/wisdomStoreList\s*\(/, 'wisdomStoreList('],
    [/runTransaction/, 'runTransaction'], [/\.set\s*\(/, '.set('], [/INIT\./, 'INIT.']
  ];
  test('20. no forbidden write/network/collection tokens', () => {
    forbidden.forEach(([re, name]) => assert.ok(!re.test(SRC), 'forbidden: ' + name));
  });
  test('21. reads via wqList/wqById', () => {
    assert.ok(/wqList\s*\(/.test(SRC));
    assert.ok(/wqById\s*\(/.test(SRC));
  });
  test('22. mirror byte-identity js ↔ public/js', () => { assert.equal(SRC, SRC_PUB); });
  test('23. file under 900 lines', () => { assert.ok(SRC.split('\n').length < 900); });
});
