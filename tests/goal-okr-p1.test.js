'use strict';
/* SMART-GOALS Phase 5 P1 — OKR Foundation (TAMAMEN TÜRETİLMİŞ).
   Objective = mevcut goal kategorisi (cat) üst-grubu; write/model/şema değişikliği YOK.
   Progress/SMART/health bağlı goal'lardan türetilir (manuel alan yok). D'ye 0 mutasyon. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const OKR_SRC = fs.readFileSync(path.join(ROOT, 'js', '11p-goal-okr.js'), 'utf8');

function goalsOf(S, arr) { S.D.goals = arr; S.D.relations = []; S.D.goalCheckIns = []; }
function g(over) { return Object.assign({ id: 1, title: 'G', cat: 'İş', steps: [{ t: 'a', done: true }, { t: 'b', done: false }], status: 'active', deadline: '2027-01-01', health: { status: 'on_track', confidence: 'high' }, priority: { level: 'p2', weight: 2 }, planning: { year: 2026, quarter: 'Q1' } }, over || {}); }

describe('Objective grouping & rollups', () => {
  test('1. objectives = distinct categories; one goal one objective', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'İş' }), g({ id: 2, cat: 'İş' }), g({ id: 3, cat: 'Sağlık' })]);
    const o = S.okrObjectives();
    assert.equal(o.length, 2);
    const is = o.find(function (x) { return x.key === 'İş'; });
    assert.equal(is.goalCount, 2); assert.equal(is.goals.length, 2);
  });
  test('2. derived avg progress/smart/quality (no manual field)', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'X' }), g({ id: 2, cat: 'X' })]);
    const o = S.okrObjectives()[0];
    assert.ok(o.progress >= 0 && o.progress <= 100);
    assert.ok(typeof o.smart === 'number'); assert.ok(o.quality >= 0 && o.quality <= 100);
    // avg progress equals mean of member goalProgress
    const mean = Math.round((S.goalProgress(S.D.goals[0]) + S.goalProgress(S.D.goals[1])) / 2);
    assert.equal(o.progress, mean);
  });
  test('3. health/confidence rollups', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'X', health: { status: 'at_risk', confidence: 'low' } }), g({ id: 2, cat: 'X', health: { status: 'on_track', confidence: 'high' } })]);
    const o = S.okrObjectives()[0];
    assert.equal(o.health.at_risk, 1); assert.equal(o.health.on_track, 1);
    assert.equal(o.confidence.low, 1); assert.equal(o.confidence.high, 1);
  });
  test('4. status done when all member goals done', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'X', status: 'done' }), g({ id: 2, cat: 'X', status: 'done' })]);
    assert.equal(S.okrObjectives()[0].status, 'done');
    const S2 = createSandbox(); goalsOf(S2, [g({ id: 1, cat: 'X', status: 'done' }), g({ id: 2, cat: 'X', status: 'active' })]);
    assert.equal(S2.okrObjectives()[0].status, 'active');
  });
  test('5. risky when any at_risk/off_track member', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'X', health: { status: 'off_track', confidence: 'low' } }), g({ id: 2, cat: 'X' })]);
    assert.equal(S.okrObjectives()[0].risky, true);
    const S2 = createSandbox(); goalsOf(S2, [g({ id: 1, cat: 'Y' })]);
    assert.equal(S2.okrObjectives()[0].risky, false);
  });
  test('6. objectiveByKey returns detail with member goals', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'İş' }), g({ id: 2, cat: 'İş' })]);
    const d = S.okrObjectiveByKey('İş');
    assert.ok(d); assert.equal(d.goalCount, 2); assert.ok(Array.isArray(d.goals));
  });
});

describe('Dashboard stats', () => {
  test('7. counts: objectives, avg progress, risky, done, most critical', () => {
    const S = createSandbox();
    goalsOf(S, [g({ id: 1, cat: 'A', status: 'done' }), g({ id: 2, cat: 'A', status: 'done' }),
      g({ id: 3, cat: 'B', health: { status: 'off_track', confidence: 'low' } }), g({ id: 4, cat: 'C' })]);
    const s = S.okrDashboardStats();
    assert.equal(s.objectiveCount, 3);
    assert.ok(s.avgProgress >= 0 && s.avgProgress <= 100);
    assert.equal(s.doneCount, 1);   // A all done
    assert.equal(s.riskyCount, 1);  // B has off_track
    assert.ok(s.mostCritical);      // some objective flagged critical
  });
  test('8. empty state safe', () => {
    const S = createSandbox(); goalsOf(S, []);
    assert.doesNotThrow(function () { const s = S.okrDashboardStats(); assert.equal(s.objectiveCount, 0); assert.equal(s.avgProgress, 0); });
    assert.deepEqual(JSON.parse(JSON.stringify(S.okrObjectives())), []);
  });
});

describe('Filters', () => {
  function set(S) { goalsOf(S, [
    g({ id: 1, cat: 'İş', planning: { year: 2026, quarter: 'Q1' }, status: 'active', health: { status: 'on_track', confidence: 'high' }, priority: { level: 'p1' } }),
    g({ id: 2, cat: 'Sağlık', planning: { year: 2027, quarter: 'Q2' }, status: 'done', health: { status: 'at_risk', confidence: 'low' }, priority: { level: 'p3' } })]); return S; }
  test('9. year filter narrows objective set', () => { const S = set(createSandbox()); assert.equal(S.okrObjectives({ year: 2026 }).length, 1); });
  test('10. quarter filter', () => { const S = set(createSandbox()); assert.equal(S.okrObjectives({ quarter: 'Q2' }).length, 1); });
  test('11. status filter', () => { const S = set(createSandbox()); assert.equal(S.okrObjectives({ status: 'done' }).length, 1); });
  test('12. health filter', () => { const S = set(createSandbox()); assert.equal(S.okrObjectives({ health: 'at_risk' }).length, 1); });
  test('13. priority filter', () => { const S = set(createSandbox()); assert.equal(S.okrObjectives({ priority: 'p1' }).length, 1); });
  test('14. category filter', () => { const S = set(createSandbox()); assert.equal(S.okrObjectives({ cat: 'İş' }).length, 1); });
});

describe('UX', () => {
  test('15. dashboard html renders', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'İş' }), g({ id: 2, cat: 'Sağlık' })]);
    const h = S.okrDashboardHtml();
    assert.ok(/OKR|Objective|Hedef Kümeleri/.test(h));
    assert.ok(/İş/.test(h) && /Sağlık/.test(h));
    assert.equal(/width:\s*[5-9]\d\dpx/.test(h), false);
  });
  test('16. objective detail html renders member goals + averages', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'İş', title: 'Hedef Bir' })]);
    const h = S.okrObjectiveDetailHtml('İş');
    assert.ok(/Hedef Bir/.test(h)); assert.ok(/SMART|İlerleme|Kalite/.test(h));
  });
  test('17. dashboard empty state', () => {
    const S = createSandbox(); goalsOf(S, []);
    assert.ok(/Objective yok|Hedef yok|Henüz/.test(S.okrDashboardHtml()));
  });
});

describe('Static guards & regression', () => {
  test('G1. no writes / no new persisted collection / no manual progress field', () => {
    assert.equal(/D\.okr|D\.objectives|goal\.objective\s*=|function\s+save\b|snap\(\)/.test(OKR_SRC), false);
  });
  test('G2. derived-only: does not mutate D.goals/relations/goalCheckIns', () => {
    assert.equal(/D\.goals\s*=|D\.relations\s*=|D\.goalCheckIns\s*=/.test(OKR_SRC), false);
  });
  test('G3. does not touch backup/sync/io/relations engines', () => {
    assert.equal(/DIFF_SCHEMA|queueCloudSave|commitMutation|goalBuildJsonText|registerRelationResolver|relAdd\(/.test(OKR_SRC), false);
  });
  test('G4. no goal-model field added for mapping', () => {
    assert.equal(/g\.objective\s*=|goal\.objectiveId\s*=/.test(OKR_SRC), false);
  });
  test('G5. route + nav wired', () => {
    assert.ok(/renderOKR/.test(fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8')));
    assert.ok(/okr/.test(fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8')));
  });
  test('G6. aggregation zero mutation', () => {
    const S = createSandbox(); goalsOf(S, [g({ id: 1, cat: 'X' }), g({ id: 2, cat: 'Y' })]);
    const gb = JSON.stringify(S.D.goals);
    S.okrObjectives(); S.okrDashboardStats(); S.okrDashboardHtml(); S.okrObjectiveDetailHtml('X');
    assert.equal(JSON.stringify(S.D.goals), gb);
  });
  test('G7. mirrors byte-identical + module < 900', () => {
    ['11p-goal-okr.js', '08-ui-core.js', '12-render-boot.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(OKR_SRC.split('\n').length < 900);
  });
});
