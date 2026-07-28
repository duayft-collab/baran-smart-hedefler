'use strict';
/* SMART-GOALS Wisdom P12 — Enterprise Knowledge OS (Cross-Module Knowledge Fabric)
   (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK). Mevcut D.relations + resolver'lar
   üzerinden çapraz-modül bilgi ağı. Module map / entity web / knowledge flow /
   most-connected / orphans / coverage + statik guard + regresyon. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '12c-wisdom-knowledge-os.js'), 'utf8');
const SRC_PUB = fs.readFileSync(path.join(ROOT, 'public', 'js', '12c-wisdom-knowledge-os.js'), 'utf8');
const SRC_11H = fs.readFileSync(path.join(ROOT, 'js', '11h-relations.js'), 'utf8');
const SRC_11K = fs.readFileSync(path.join(ROOT, 'js', '11k-relations-ui.js'), 'utf8');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Yazar', category: '', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], priority: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null }, over || {});
}
function setup(S, quotes, opts) {
  opts = opts || {};
  S.D.wisdomQuotes = quotes || [];
  S.D.goals = opts.goals || [];
  S.D.decisions = opts.decisions || [];
  S.D.principles = opts.principles || [];
  S.D.generalNotes = opts.generalNotes || [];
  S.D.todos = opts.todos || [];
  S.D.relations = [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  ['wwsInvalidate', 'wkosInvalidate'].forEach(fn => { if (typeof S[fn] === 'function') S[fn](); });
  (opts.links || []).forEach(l => S.relAdd({ sourceType: l[0], sourceId: l[1], targetType: l[2], targetId: l[3], relationType: l[4] || 'related_to' }));
  if (typeof S.wkosInvalidate === 'function') S.wkosInvalidate();
}

describe('Module Map', () => {
  test('1. relation counts per entity-type pair from D.relations', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'g', status: 'active' }], decisions: [{ id: 'd1', title: 'x', status: 'open' }],
      links: [['wisdomQuote', 'a', 'goal', '1'], ['wisdomQuote', 'a', 'decision', 'd1']] });
    const mm = S.wkosModuleMap();
    assert.equal(mm.totalLinks, 2);
    assert.equal(mm.matrix.wisdomQuote.goal, 1);
    assert.equal(mm.matrix.goal.wisdomQuote, 1); // simetrik
    assert.equal(mm.matrix.wisdomQuote.decision, 1);
    assert.equal(mm.typeTotals.wisdomQuote, 2);
  });
  test('2. book/mybook normalized to book', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { links: [['wisdomQuote', 'a', 'mybook', 'b1']] });
    const mm = S.wkosModuleMap();
    assert.equal(mm.matrix.wisdomQuote.book, 1);
  });
});

describe('Entity Web', () => {
  test('3. groups related entities by module, deterministic', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'g', status: 'active' }], principles: [{ id: 'p1', statement: 's', status: 'active' }],
      links: [['wisdomQuote', 'a', 'goal', '1'], ['wisdomQuote', 'a', 'principle', 'p1']] });
    const web = S.wkosEntityWeb('wisdomQuote', 'a');
    assert.ok(web.byModule.goal && web.byModule.goal.length === 1);
    assert.ok(web.byModule.principle && web.byModule.principle.length === 1);
    assert.equal(web.total, 2);
  });
  test('4. orphaned/unresolvable references safe (book has no resolver)', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { links: [['wisdomQuote', 'a', 'mybook', 'b1']] });
    assert.doesNotThrow(() => S.wkosEntityWeb('wisdomQuote', 'a'));
    const web = S.wkosEntityWeb('wisdomQuote', 'a');
    assert.ok(!web.byModule.book); // resolver yok → gruba girmez (orphan-safe)
  });
});

describe('Knowledge Flow', () => {
  test('5. wisdom → principle → decision → goal chain', () => {
    const S = createSandbox();
    setup(S, [wq('a')], {
      goals: [{ id: 1, title: 'g', status: 'active' }], decisions: [{ id: 'd1', title: 'karar', status: 'open' }], principles: [{ id: 'p1', statement: 's', status: 'active' }],
      links: [['wisdomQuote', 'a', 'principle', 'p1'], ['wisdomQuote', 'a', 'decision', 'd1'], ['decision', 'd1', 'goal', '1']]
    });
    const fl = S.wkosKnowledgeFlow('a');
    assert.ok(fl.wisdom && fl.wisdom.id === 'a');
    assert.ok(fl.principle && String(fl.principle.id) === 'p1');
    assert.ok(fl.decision && String(fl.decision.id) === 'd1');
    assert.ok(fl.goal && String(fl.goal.id) === '1');
  });
  test('6. null-safe for missing wisdom', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    assert.equal(S.wkosKnowledgeFlow('zzz'), null);
  });
});

describe('Most Connected', () => {
  test('7. ranked by degree, deterministic tie-break', () => {
    const S = createSandbox();
    setup(S, [wq('a'), wq('b')], { goals: [{ id: 1, title: 'g', status: 'active' }],
      links: [['wisdomQuote', 'a', 'goal', '1'], ['wisdomQuote', 'a', 'decision', 'd1'], ['wisdomQuote', 'b', 'goal', '1']] });
    const mc = S.wkosMostConnected(10);
    assert.equal(mc[0].id, 'a'); // degree 2
    assert.ok(mc[0].degree >= mc[1].degree);
    // deterministik
    assert.deepEqual(S.wkosMostConnected(10).map(x => x.type + ':' + x.id), mc.map(x => x.type + ':' + x.id));
  });
  test('8. limit respected', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'g', status: 'active' }], links: [['wisdomQuote', 'a', 'goal', '1']] });
    assert.ok(S.wkosMostConnected(1).length <= 1);
  });
});

describe('Orphans & Coverage', () => {
  test('9. detects high-value unlinked wisdom + unlinked goals/decisions', () => {
    const S = createSandbox();
    setup(S, [wq('a', { favorite: true }), wq('b', { showCount: 5 })],
      { goals: [{ id: 1, title: 'g', status: 'active' }], decisions: [{ id: 'd1', title: 'x', status: 'open' }] });
    const o = S.wkosOrphans();
    assert.ok(o.wisdom.some(x => x.id === 'a')); // favorite, unlinked
    assert.ok(o.goals.some(x => String(x.id) === '1'));
    assert.ok(o.decisions.some(x => String(x.id) === 'd1'));
  });
  test('10. coverage math (goals/decisions/principles with wisdom link)', () => {
    const S = createSandbox();
    setup(S, [wq('a')], {
      goals: [{ id: 1, title: 'g1', status: 'active' }, { id: 2, title: 'g2', status: 'active' }],
      decisions: [{ id: 'd1', title: 'x', status: 'open' }],
      principles: [{ id: 'p1', statement: 's', status: 'active' }],
      links: [['wisdomQuote', 'a', 'goal', '1'], ['wisdomQuote', 'a', 'decision', 'd1']]
    });
    const c = S.wkosCoverage();
    assert.equal(c.goals.linked, 1); assert.equal(c.goals.total, 2); assert.equal(c.goals.pct, 50);
    assert.equal(c.decisions.pct, 100);
    assert.equal(c.principles.pct, 0);
  });
});

describe('Source Fallback Parity', () => {
  test('11. identical module map for sharded vs legacy (same data)', () => {
    const arr = [wq('a')];
    const linksSetup = { goals: [{ id: 1, title: 'g', status: 'active' }], links: [['wisdomQuote', 'a', 'goal', '1']] };
    const L = createSandbox(); setup(L, arr.map(x => Object.assign({}, x)), linksSetup);
    const legacy = L.wkosModuleMap();
    const Sd = createSandbox(); setup(Sd, [], linksSetup);
    Sd.wqList = () => arr.map(x => Object.assign({}, x));
    Sd.wqById = (id) => arr.map(x => Object.assign({}, x)).find(x => String(x.id) === String(id)) || null;
    Sd.wisdomReadSource = () => 'sharded';
    Sd.wkosInvalidate();
    const sharded = Sd.wkosModuleMap();
    assert.equal(JSON.stringify(sharded.matrix), JSON.stringify(legacy.matrix));
  });
});

describe('Cross-Navigation (existing openers only)', () => {
  test('12. wkosOpen dispatches existing opener', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    let opened = null; S.openGoalDetail = (id) => { opened = id; };
    S.wkosOpen('goal', '1');
    assert.equal(opened, '1');
  });
  test('13. no new opener function names introduced', () => {
    // yalnız mevcut açıcılar KOS_OPENER içinde
    const allowed = ['openWqForm', 'openGoalDetail', 'djOpenDetail', 'openPrincipleForm', 'openGeneralNoteForm', 'openTaskById'];
    const found = SRC.match(/'(open[A-Za-z]+|djOpenDetail)'/g) || [];
    found.forEach(f => { const name = f.replace(/'/g, ''); assert.ok(allowed.indexOf(name) >= 0, 'unexpected opener: ' + name); });
  });
});

describe('UI — accessibility & responsive', () => {
  test('14. panel renders matrix + coverage + most-connected + orphans', () => {
    const S = createSandbox();
    setup(S, [wq('a', { favorite: true })], { goals: [{ id: 1, title: 'g', status: 'active' }], links: [['wisdomQuote', 'a', 'goal', '1']] });
    const h = S.wkosKnowledgeOsHtml();
    ['Kurumsal Bilgi Haritası', 'Bilgi Kapsamı', 'Çapraz-Modül Matrisi', 'En Bağlı Bilgi', 'Bağlanmamış Fırsatlar'].forEach(sec => assert.ok(h.indexOf(sec) >= 0, sec));
  });
  test('15. accessibility + responsive', () => {
    const S = createSandbox(); setup(S, [wq('a')], { goals: [{ id: 1, title: 'g', status: 'active' }], links: [['wisdomQuote', 'a', 'goal', '1']] });
    const h = S.wkosKnowledgeOsHtml();
    assert.ok(/role="table"/.test(h));
    assert.ok(/role="status"/.test(h));
    assert.ok(/<h2/.test(h) && /<h3/.test(h)); // semantik başlıklar
    assert.ok(/max-width:100%/.test(h));
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped));
  });
  test('16. empty library → empty panel', () => {
    const S = createSandbox(); setup(S, []);
    assert.equal(S.wkosKnowledgeOsHtml(), '');
  });
});

describe('Integration & Regression', () => {
  test('17. P10 workspace exposes kos section rendering wkosKnowledgeOsHtml', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'g', status: 'active' }], links: [['wisdomQuote', 'a', 'goal', '1']] });
    assert.ok(S.WWS_NAV.some(n => n[0] === 'kos'));
    S.wwsGo('kos');
    const h = S.wwsWorkspaceHtml();
    assert.ok(/id="wws_nav_kos" aria-selected="true"/.test(h));
    assert.ok(/Kurumsal Bilgi Haritası/.test(h));
  });
  test('18. P10/P11 preserved (intel present, Ctrl+2 → coach)', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    assert.ok(S.WWS_NAV.some(n => n[0] === 'intel'));
    S.wwsKey({ ctrlKey: true, key: '2', preventDefault() {} });
    const h = S.wwsWorkspaceHtml();
    assert.ok(/id="wws_nav_coach" aria-selected="true"/.test(h));
  });
  test('19. prior derived layers intact (P4–P11)', () => {
    const S = createSandbox();
    ['wlcLearningSectionHtml', 'wkgKnowledgeCenterHtml', 'wcoCoachPanelHtml', 'wiaExecutiveInsightCenterHtml',
     'werExecutiveWorkspaceHtml', 'wwsWorkspaceHtml', 'weiDashboardHtml'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
  test('20. relation engine untouched (getRelatedEntities/RELATION_RESOLVERS reused)', () => {
    const S = createSandbox();
    assert.equal(typeof S.getRelatedEntities, 'function');
    assert.equal(typeof S.RELATION_RESOLVERS, 'object');
  });
});

describe('Static Guards (0-write, 0-network, derived-only, engine unchanged)', () => {
  const forbidden = [
    [/\bsave\s*\(/, 'save('], [/\bsnap\s*\(/, 'snap('], [/commitMutation/, 'commitMutation'],
    [/queueCloudSave/, 'queueCloudSave'], [/createBackup/, 'createBackup'], [/relAdd\s*\(/, 'relAdd('], [/relDelete\s*\(/, 'relDelete('],
    [/\bfetch\s*\(/, 'fetch('], [/\.onSnapshot\s*\(/, '.onSnapshot('], [/XMLHttpRequest/, 'XMLHttpRequest'], [/WebSocket/, 'WebSocket'],
    [/WQ_STORE/, 'WQ_STORE'], [/D\.wisdomQuotes\s*=/, 'D.wisdomQuotes='],
    [/DIFF_SCHEMA/, 'DIFF_SCHEMA'], [/wisdomStoreList\s*\(/, 'wisdomStoreList('],
    [/runTransaction/, 'runTransaction'], [/\.set\s*\(/, '.set('], [/INIT\./, 'INIT.'], [/registerRelationResolver/, 'registerRelationResolver']
  ];
  test('21. no forbidden write/network/mutation tokens', () => {
    forbidden.forEach(([re, name]) => assert.ok(!re.test(SRC), 'forbidden: ' + name));
  });
  test('22. reads via wqList/wqById + reuses getRelatedEntities', () => {
    assert.ok(/wqList\s*\(/.test(SRC));
    assert.ok(/wqById\s*\(/.test(SRC));
    assert.ok(/getRelatedEntities/.test(SRC));
  });
  test('23. relation engine files unchanged in this phase (11h/11k markers)', () => {
    assert.ok(/registerRelationResolver\('wisdomQuote'/.test(SRC_11H));
    assert.ok(/registerRelationResolver\('task'/.test(SRC_11K));
  });
  test('24. mirror byte-identity js ↔ public/js', () => { assert.equal(SRC, SRC_PUB); });
  test('25. file under 900 lines', () => { assert.ok(SRC.split('\n').length < 900); });
});
