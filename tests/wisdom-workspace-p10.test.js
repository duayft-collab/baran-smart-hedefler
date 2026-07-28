'use strict';
/* SMART-GOALS Wisdom P10 — Unified Knowledge Workspace & Productivity Hub
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK). P4–P8 panellerini tek workspace'te
   birleştirir (yeniden kullanır, silmez). Navigasyon / snapshot / arama / çapraz
   gezinme / timeline / odak / kısayol / erişilebilirlik / statik guard. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '12a-wisdom-workspace.js'), 'utf8');
const SRC_PUB = fs.readFileSync(path.join(ROOT, 'public', 'js', '12a-wisdom-workspace.js'), 'utf8');

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
  if (typeof S.wiaInvalidate === 'function') S.wiaInvalidate();
  if (typeof S.werInvalidate === 'function') S.werInvalidate();
  if (typeof S.wwsInvalidate === 'function') S.wwsInvalidate();
}

describe('Session Snapshot', () => {
  test('1. snapshot has all required fields, derived', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 2, reflected: true })],
      { goals: [{ id: 1, title: 'Hedefim', status: 'active' }], decisions: [{ id: 'd1', title: 'Kararım', status: 'open' }], principles: [{ id: 'p1', statement: 'İlkem', status: 'active' }] });
    const s = S.wwsSessionSnapshot();
    ['currentGoal', 'currentDecision', 'currentPrinciple', 'coachStatus', 'learningMomentum',
     'knowledgeScore', 'decisionReadiness', 'reflectionStreak', 'runtimeHealth', 'source'].forEach(k => assert.ok(k in s, k));
    assert.equal(s.currentGoal, 'Hedefim');
  });
  test('2. snapshot memoized by signature (same ref)', () => {
    const S = createSandbox();
    setup(S, [wq('a')]);
    assert.equal(S.wwsSessionSnapshot(), S.wwsSessionSnapshot());
  });
});

describe('Unified Search', () => {
  test('3. searches quotes/authors/categories/tags/goals/decisions/principles', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik önemli', author: 'Atatürk', category: 'Liderlik', tags: ['odak'] })],
      { goals: [{ id: 1, title: 'liderlik hedefi', status: 'active' }], decisions: [{ id: 'd1', title: 'liderlik kararı', status: 'open' }], principles: [{ id: 'p1', statement: 'liderlik ilkesi', status: 'active' }] });
    const r = S.wwsSearch('liderlik');
    const types = r.map(x => x.type);
    ['wisdomQuote', 'category', 'goal', 'decision', 'principle'].forEach(t => assert.ok(types.indexOf(t) >= 0, t));
  });
  test('4. deterministic ordering + dedup', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'odak', category: 'Odak' }), wq('b', { quote: 'odak yine' })]);
    const r1 = S.wwsSearch('odak').map(x => x.type + ':' + x.id);
    const r2 = S.wwsSearch('odak').map(x => x.type + ':' + x.id);
    assert.deepEqual(r1, r2);
    assert.equal(new Set(r1).size, r1.length); // dedup
  });
  test('5. empty query → empty results', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    assert.equal(S.wwsSearch('').length, 0);
  });
  test('6. index memoized (search does not rescan when unchanged)', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'odak' })]);
    S.wwsSearch('odak');
    let calls = 0; const orig = S.wqList; S.wqList = function () { calls++; return orig(); };
    S.wwsSearch('başka');
    assert.ok(calls <= 1, 'index memoized, wqList çağrısı: ' + calls);
  });
});

describe('Timeline & Quick Actions', () => {
  test('7. timeline groups today/week/month', () => {
    const S = createSandbox();
    setup(S, [wq('a', { reflected: true, updatedAt: iso(0) }),
             wq('b', { favorite: true, updatedAt: iso(3) }),
             wq('c', { updatedAt: iso(20) })]);
    const t = S.wwsTimeline();
    assert.ok('today' in t && 'week' in t && 'month' in t);
  });
  test('8. quick actions present', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    const a = S.wwsQuickActions();
    assert.ok(a.length >= 5);
    a.forEach(x => { assert.ok(x.label && x.action); });
  });
});

describe('Workspace Navigation & Sections', () => {
  test('9. workspace renders vertical tablist with 9 sections', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    const h = S.wwsWorkspaceHtml();
    assert.ok(/role="tablist"/.test(h));
    assert.ok(/aria-orientation="vertical"/.test(h));
    S.WWS_NAV.forEach(n => assert.ok(h.indexOf('wws_nav_' + n[0]) >= 0, n[0]));
  });
  test('10. only one active section renders (default dashboard)', () => {
    const S = createSandbox(); setup(S, [wq('a', { showCount: 1 })]);
    const h = S.wwsWorkspaceHtml();
    assert.ok(/id="wws_main"/.test(h));
    assert.ok(/role="tabpanel"/.test(h));
    assert.ok(/Hızlı Aksiyonlar/.test(h)); // dashboard içeriği
  });
  test('11. section switch reuses existing panel fns (coach section)', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik' })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    S.wwsGo('coach');
    const h = S.wwsWorkspaceHtml();
    assert.ok(/aria-selected="true"/.test(h));
    assert.ok(/Bilgi Koçu/.test(h)); // P6 reused
  });
  test('12. sidebar synchronized with context', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'Hedefim', status: 'active' }] });
    const h = S.wwsSidebarHtml();
    assert.ok(/Bağlam/.test(h));
    assert.ok(/Hedefim/.test(h));
  });
  test('13. empty library → empty workspace', () => {
    const S = createSandbox(); setup(S, []);
    assert.equal(S.wwsWorkspaceHtml(), '');
  });
});

describe('Cross-Navigation & Keyboard Shortcuts', () => {
  test('14. cross-nav dispatches existing openers', () => {
    const S = createSandbox();
    setup(S, [wq('a')]);
    let opened = null; S.openWqForm = (id) => { opened = id; };
    S.wwsOpenEntity('wisdomQuote', 'a');
    assert.equal(opened, 'a');
  });
  test('15. Ctrl+number shortcut switches section', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    S.wwsKey({ ctrlKey: true, key: '2', preventDefault() {} }); // 2 → coach
    const h = S.wwsWorkspaceHtml();
    assert.ok(/id="wws_nav_coach" aria-selected="true"/.test(h));
  });
  test('16. non-ctrl key ignored', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    S.wwsGo('dashboard');
    S.wwsKey({ ctrlKey: false, key: '3' });
    const h = S.wwsWorkspaceHtml();
    assert.ok(/id="wws_nav_dashboard" aria-selected="true"/.test(h));
  });
});

describe('Focus Mode', () => {
  test('17. focus mode shows quote + reflection + next, hides nav', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik' })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    S.wwsToggleFocus();
    const h = S.wwsWorkspaceHtml();
    assert.ok(/Odak Modu/.test(h));
    assert.ok(!/role="tablist"/.test(h)); // nav gizli
    assert.ok(/Bunu düşündüm/.test(h));
    assert.ok(/Sonraki Öneri/.test(h));
  });
});

describe('Source Fallback Parity', () => {
  test('18. identical snapshot for sharded vs legacy (same data)', () => {
    const arr = [wq('a', { showCount: 2, reflected: true })];
    const L = createSandbox(); setup(L, arr.map(x => Object.assign({}, x)));
    const legacy = L.wwsSessionSnapshot();
    const Sd = createSandbox(); setup(Sd, []);
    Sd.wqList = () => arr.map(x => Object.assign({}, x));
    Sd.wqById = (id) => arr.map(x => Object.assign({}, x)).find(x => String(x.id) === String(id)) || null;
    Sd.wisdomReadSource = () => 'legacy';
    Sd.wiaInvalidate(); Sd.werInvalidate(); Sd.wwsInvalidate();
    const sharded = Sd.wwsSessionSnapshot();
    // runtimeHealth objesi vm-context farkı → alan-bazlı JSON kıyas dışında karşılaştır
    ['currentGoal', 'coachStatus', 'knowledgeScore', 'reflectionStreak', 'learningMomentum', 'decisionReadiness'].forEach(k => {
      assert.equal(JSON.stringify(sharded[k]), JSON.stringify(legacy[k]), k);
    });
  });
});

describe('Accessibility & Responsive', () => {
  test('19. tablist/tab/tabpanel roles + tabindex + aria-selected', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    const h = S.wwsWorkspaceHtml();
    assert.ok(/role="tablist"/.test(h));
    assert.ok(/role="tab"/.test(h));
    assert.ok(/role="tabpanel"/.test(h));
    assert.ok(/tabindex/.test(h));
    assert.ok(/aria-selected/.test(h));
    assert.ok(/aria-label/.test(h));
  });
  test('20. responsive: max-width:100%, no fixed large px width', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    const h = S.wwsWorkspaceHtml();
    assert.ok(/max-width:100%/.test(h));
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped));
  });
});

describe('Integration & Regression', () => {
  test('21. renderWisdomQuotes injects workspace + keeps P4–P8 panels', () => {
    const S = createSandbox();
    setup(S, [wq('a', { showCount: 1, quote: 'liderlik' })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    S.tab = 'wisdom';
    assert.doesNotThrow(() => S.renderWisdomQuotes());
    const html = S.__getElements().pinner.innerHTML;
    assert.ok(/Bilgi Çalışma Alanı/.test(html)); // P10
    assert.ok(/Bilgi Koçu/.test(html)); // P6 intact
    assert.ok(/Yönetici İçgörü Merkezi/.test(html)); // P7 intact
    assert.ok(/Yönetici İncelemesi/.test(html)); // P8 intact
  });
  test('22. prior derived layers intact (P4/P5/P6/P7/P8)', () => {
    const S = createSandbox();
    ['wlcLearningSectionHtml', 'wkgKnowledgeCenterHtml', 'wcoCoachPanelHtml',
     'wiaExecutiveInsightCenterHtml', 'werExecutiveWorkspaceHtml'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
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
  test('23. no forbidden write/network/collection tokens', () => {
    forbidden.forEach(([re, name]) => assert.ok(!re.test(SRC), 'forbidden: ' + name));
  });
  test('24. reads via wqList/wqById', () => {
    assert.ok(/wqList\s*\(/.test(SRC));
    assert.ok(/wqById\s*\(/.test(SRC));
  });
  test('25. mirror byte-identity js ↔ public/js', () => { assert.equal(SRC, SRC_PUB); });
  test('26. file under 900 lines', () => { assert.ok(SRC.split('\n').length < 900); });
});
