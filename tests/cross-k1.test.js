'use strict';
/* SMART-GOALS Cross-Module Knowledge Integration K1 (TÜRETİLMİŞ · SALT OKUNUR).
   Wisdom iş yaparken yüzeye çıkar: tek "İlgili Bilgelik" kartı (Hedef/Karar/İlke).
   wqList/wcoRecommend/relations yeniden kullanılır; 0 write/data/listener. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC_13 = fs.readFileSync(path.join(ROOT, 'js', '13-wisdom-integration.js'), 'utf8');
const SRC_09 = fs.readFileSync(path.join(ROOT, 'js', '09-goals.js'), 'utf8');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Yazar', category: '', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], priority: 3,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', lastShownAt: null }, over || {});
}
function seed(S, quotes) {
  S.D.wisdomQuotes = quotes || [wq('a', { quote: 'liderlik disiplin gerektirir', tags: ['liderlik'], category: 'Liderlik' }), wq('b', { quote: 'bahçe çiçek' })];
  S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
}

describe('Contextual recommendation (derived, read-only)', () => {
  test('1. token overlap: goal ctx surfaces the matching quote', () => {
    const S = createSandbox(); seed(S);
    const recs = S.wiRecommend(S.wiCtxFromGoal({ id: 1, title: 'liderlik gelişimi', cat: 'Liderlik', tags: [] }), 2);
    assert.ok(recs.length >= 1);
    assert.equal(recs[0].id, 'a'); // liderlik quote wins
    assert.ok(recs[0].reason);
  });
  test('2. explicit relations take priority', () => {
    const S = createSandbox(); seed(S);
    S.D.goals = [{ id: 7, title: 'x' }];
    S.relAdd({ sourceType: 'goal', sourceId: '7', targetType: 'wisdomQuote', targetId: 'b', relationType: 'related_to' });
    const recs = S.wiRecommend(S.wiCtxFromGoal({ id: '7', title: 'liderlik', cat: '', tags: [] }), 2);
    assert.equal(recs[0].id, 'b'); // related first
    assert.equal(recs[0].reason, 'İlişkilendirilmiş');
  });
  test('3. no context → reuses coach recommendation (no duplicate engine)', () => {
    const S = createSandbox(); seed(S, [wq('a', { quote: 'liderlik' })]);
    S.D.goals = [{ id: 1, title: 'liderlik', status: 'active' }];
    const recs = S.wiRecommend(null, 2);
    assert.ok(recs.length >= 1 && recs[0].id);
  });
  test('4. deterministic + empty-safe', () => {
    const S = createSandbox(); seed(S);
    const c = S.wiCtxFromGoal({ id: 1, title: 'liderlik', cat: 'Liderlik', tags: [] });
    assert.deepEqual(S.wiRecommend(c, 2).map(r => r.id), S.wiRecommend(c, 2).map(r => r.id));
    S.D.wisdomQuotes = []; S.wisdomStoreReset();
    assert.equal(S.wiRecommend(c, 2).length, 0);
  });
  test('5. ctx builders derive from existing fields only', () => {
    const S = createSandbox();
    assert.equal(S.wiCtxFromGoal({ id: 1, title: 't', cat: 'C', tags: ['x'] }).type, 'goal');
    assert.equal(S.wiCtxFromDecision({ id: 'd', title: 't', decision: 'x' }).type, 'decision');
    assert.equal(S.wiCtxFromPrinciple({ id: 'p', statement: 's', lifeArea: 'myself' }).type, 'principle');
  });
});

describe('Card + navigation', () => {
  test('6. wiCardHtml renders one small "İlgili Bilgelik" card + open + second suggestion', () => {
    const S = createSandbox(); seed(S);
    const h = S.wiCardHtml(S.wiCtxFromGoal({ id: 1, title: 'liderlik', cat: 'Liderlik', tags: [] }));
    assert.ok(/İlgili Bilgelik/.test(h));
    assert.ok(/liderlik disiplin/.test(h)); // quote
    assert.ok(/wiOpen\(/.test(h)); // open action
    assert.ok(/Başka öneri/.test(h)); // expandable second suggestion
    // secondary: not a dashboard/KPI/gradient
    assert.equal(/linear-gradient|min-width:1\d\dpx/.test(h), false);
  });
  test('7. empty library → no card (invisible until useful)', () => {
    const S = createSandbox(); seed(S, []);
    assert.equal(S.wiCardHtml(S.wiCtxFromGoal({ id: 1, title: 'x', cat: '', tags: [] })), '');
  });
  test('8. wiOpen reuses existing navigation (gotoTab + openWqForm)', () => {
    const S = createSandbox(); seed(S);
    let tab = null, opened = null, closed = false;
    S.gotoTab = (t) => { tab = t; }; S.openWqForm = (id) => { opened = id; }; S.closeModal = () => { closed = true; };
    S.wiOpen('a');
    assert.equal(tab, 'wisdom'); assert.equal(opened, 'a'); assert.equal(closed, true);
  });
});

describe('Integration into working screens (additive, workflows preserved)', () => {
  test('9. Decision Journal screen surfaces one İlgili Bilgelik (secondary)', () => {
    const S = createSandbox(); seed(S);
    S.D.decisions = [{ id: 'd1', title: 'liderlik kararı', decision: 'x', status: 'open', tags: ['liderlik'] }];
    S.tab = 'decisions'; S.renderDecisions();
    const h = S.__getElements()['pinner'].innerHTML;
    assert.ok(/Karar Günlüğü/.test(h)); // workflow primary intact
    assert.ok(/Yeni Karar/.test(h)); // actions intact
    assert.ok(/İlgili Bilgelik/.test(h)); // wisdom surfaced
  });
  test('10. Principles screen surfaces one supporting quote (secondary)', () => {
    const S = createSandbox(); seed(S);
    S.D.principles = [{ id: 'p1', title: 'Disiplin', statement: 'liderlik disiplin', lifeArea: 'myself', status: 'active', tags: [] }];
    S.tab = 'principles'; S.renderPrinciples();
    const h = S.__getElements()['pinner'].innerHTML;
    assert.ok(/İlkelerim/.test(h)); // workflow primary intact
    assert.ok(/İlgili Bilgelik/.test(h));
  });
  test('11. Goal detail integration present in source (entity-specific, additive)', () => {
    assert.ok(/id="goal_wisdom_box"/.test(SRC_09));
    assert.ok(/wiCardHtml\(wiCtxFromGoal\(g\)\)/.test(SRC_09));
  });
});

describe('Static guards (read-only, zero-write)', () => {
  test('12. no write/network/new-data-model tokens in the integration module', () => {
    ['save(', 'commitMutation', 'snap(', 'createBackup', 'fetch(', '.onSnapshot(', 'setInterval', 'addEventListener',
     'localStorage', 'INIT.', 'DIFF_SCHEMA', 'WQ_STORE', 'D.wisdomQuotes =', '.set(', 'runTransaction']
      .forEach(t => assert.equal(SRC_13.indexOf(t), -1, 'forbidden: ' + t));
  });
  test('13. reads via wqList/wqById; reuses wcoRecommend + getRelatedEntities', () => {
    assert.ok(/wqList\s*\(/.test(SRC_13) && /wqById\s*\(/.test(SRC_13));
    assert.ok(/wcoRecommend/.test(SRC_13) && /getRelatedEntities/.test(SRC_13));
  });
  test('14. card render performs zero cloud writes', () => {
    const S = createSandbox(); seed(S);
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    S.wiCardHtml(S.wiCtxFromGoal({ id: 1, title: 'liderlik', cat: 'Liderlik', tags: [] }));
    S.tab = 'decisions'; S.D.decisions = [{ id: 'd1', title: 't', decision: 'x', status: 'open' }]; S.renderDecisions();
    S.save = _s;
    assert.equal(w, 0);
  });
  test('15. mirror byte-identity + file under 900 lines', () => {
    const pub = fs.readFileSync(path.join(ROOT, 'public', 'js', '13-wisdom-integration.js'), 'utf8');
    assert.equal(SRC_13, pub);
    assert.ok(SRC_13.split('\n').length < 900);
  });
});
