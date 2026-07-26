'use strict';
/* SMART-GOALS FAZ 1 · P0-2 — Year + Quarter model.
   Replaces the ambiguous quarter-only field with planning:{year,quarter} while keeping
   FULL backward compatibility via dual-read (planning → legacy quarter → derived).
   Additive, no production migration, no automatic legacy rewrite. Quarter stays purely
   informational — SMART/progress/milestone behavior is unchanged. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const S = createSandbox();
const UI_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', '08-ui-core.js'), 'utf8');
const GOALS_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', '09-goals.js'), 'utf8');
const THIS_YEAR = new Date().getFullYear();

describe('Dual-read: goalYear', () => {
  test('1. planning.year is used when present', () => {
    assert.equal(S.goalYear({ planning: { year: 2029, quarter: 'Q1' }, deadline: '2031-01-01' }), 2029);
  });
  test('2. falls back to deadline year', () => {
    assert.equal(S.goalYear({ quarter: 'Q2', deadline: '2027-05-01' }), 2027);
  });
  test('3. falls back to current year when no planning/deadline', () => {
    assert.equal(S.goalYear({ quarter: 'Q2' }), THIS_YEAR);
    assert.equal(S.goalYear({}), THIS_YEAR);
  });
});

describe('Dual-read: goalQuarter', () => {
  test('4. planning.quarter overrides legacy quarter', () => {
    assert.equal(S.goalQuarter({ planning: { year: 2026, quarter: 'Q3' }, quarter: 'Q1' }), 'Q3');
  });
  test('5. legacy quarter still read', () => {
    assert.equal(S.goalQuarter({ quarter: 'Q2' }), 'Q2');
  });
  test('6. empty when neither present or invalid', () => {
    assert.equal(S.goalQuarter({}), '');
    assert.equal(S.goalQuarter({ quarter: 'X9' }), '');
  });
});

describe('validatePlanning', () => {
  test('7. non-numeric year rejected', () => {
    assert.equal(S.validatePlanning('abcd', 'Q1').ok, false);
  });
  test('8. empty year rejected', () => {
    assert.equal(S.validatePlanning('', 'Q1').ok, false);
  });
  test('9. out-of-range year rejected', () => {
    assert.equal(S.validatePlanning('1500', 'Q1').ok, false);
    assert.equal(S.validatePlanning('3000', 'Q1').ok, false);
  });
  test('10. non-4-digit year rejected', () => {
    assert.equal(S.validatePlanning('202', 'Q1').ok, false);
    assert.equal(S.validatePlanning('20260', 'Q1').ok, false);
  });
  test('11. empty/invalid quarter rejected', () => {
    assert.equal(S.validatePlanning('2026', '').ok, false);
    assert.equal(S.validatePlanning('2026', 'Q9').ok, false);
  });
  test('12. valid values accepted', () => {
    assert.equal(S.validatePlanning('2026', 'Q1').ok, true);
    assert.equal(S.validatePlanning('2030', 'Q4').ok, true);
    assert.equal(S.validatePlanning(2026, 'Q2').ok, true);
  });
});

describe('goalPlanningLabel', () => {
  test('13. planning goal renders "YYYY • Qn"', () => {
    assert.equal(S.goalPlanningLabel({ planning: { year: 2026, quarter: 'Q2' } }), '2026 • Q2');
  });
  test('14. legacy goal renders derived year + quarter', () => {
    assert.equal(S.goalPlanningLabel({ quarter: 'Q2', deadline: '2027-05-01' }), '2027 • Q2');
  });
  test('15. no quarter → year only', () => {
    assert.equal(S.goalPlanningLabel({ planning: { year: 2026 } }), '2026');
    assert.equal(S.goalPlanningLabel({ deadline: '2028-01-01' }), '2028');
  });
});

describe('SMART / progress / milestone unchanged (quarter is informational)', () => {
  function goal(extra) {
    return Object.assign({
      title: 'Aylık geliri 100000 TL seviyesine çıkar',
      deadline: '2026-12-31',
      desc: 'Ailemin finansal özgürlüğü için kritik; her ay düzenli ölçeceğim.',
      metric: { target: 100000, current: 40000, start: 0, unit: 'TL', direction: 'up' },
      steps: [{ id: 's1', t: 'Plan', done: false }]
    }, extra || {});
  }
  test('16. SMART score identical with/without planning', () => {
    const legacy = goal({ quarter: 'Q1' });
    const planned = goal({ planning: { year: 2026, quarter: 'Q1' } });
    assert.equal(S.smartScore(planned), S.smartScore(legacy));
  });
  test('17. progress identical with/without planning', () => {
    const legacy = goal({ quarter: 'Q1' });
    const planned = goal({ planning: { year: 2026, quarter: 'Q1' } });
    assert.equal(S.goalProgress(planned), S.goalProgress(legacy));
  });
  test('18. milestone progress unaffected by planning', () => {
    const g = goal({ planning: { year: 2026, quarter: 'Q1' },
      metric: { target: 100000, current: 40000, start: 0, unit: 'TL', direction: 'up',
        checkpoints: [{ id: 'c1', label: '50K', done: true }, { id: 'c2', label: '75K', done: false }] } });
    assert.equal(S.checkpointProgress(g), 50);
  });
});

describe('UI wiring (static guards)', () => {
  test('19. form has year input + quarter select, initialized via dual-read', () => {
    assert.ok(/id="gf_year"/.test(UI_SRC), 'year input missing');
    assert.ok(/id="gf_q"/.test(UI_SRC), 'quarter select missing');
    assert.ok(/goalYear\(g\)/.test(UI_SRC), 'year not initialized via goalYear');
    assert.ok(/goalQuarter\(g\)/.test(UI_SRC), 'quarter not initialized via goalQuarter');
  });
  test('20. goalFromForm builds planning (not a top-level legacy quarter field)', () => {
    assert.ok(/planning:planning/.test(UI_SRC), 'goalFromForm should return planning');
    // old TOP-LEVEL return field ended with `||'Q1',` (comma → sibling of deadline);
    // the new planning object ends with `||'Q1'}` (inside the object). Ensure no top-level one remains.
    assert.equal(/\|\|'Q1',/.test(UI_SRC), false, 'goalFromForm must not return a top-level legacy quarter field');
    assert.ok(/quarter:\(ge\('gf_q'\)&&ge\('gf_q'\)\.value\)\|\|'Q1'\}/.test(UI_SRC), 'quarter should live inside the planning object');
  });
  test('21. submitGoalEdit writes planning, does not rewrite legacy quarter', () => {
    assert.ok(/planning:d\.planning/.test(UI_SRC), 'edit should persist planning');
    assert.equal(/\bquarter:d\.quarter\b/.test(UI_SRC), false, 'edit must not rewrite legacy quarter');
  });
  test('22. submit validates planning before saving', () => {
    assert.ok(/validatePlanning/.test(UI_SRC), 'submit must validate planning');
  });
  test('23. list/grid/detail render via goalPlanningLabel; filter via goalQuarter', () => {
    assert.ok(/goalPlanningLabel\(g\)/.test(UI_SRC), 'render should use goalPlanningLabel (ui-core)');
    assert.ok(/goalQuarter\(g\)===gFilter/.test(UI_SRC), 'filter should use goalQuarter dual-read');
    assert.ok(/goalPlanningLabel\(g\)/.test(GOALS_SRC), 'detail should use goalPlanningLabel');
  });
});
