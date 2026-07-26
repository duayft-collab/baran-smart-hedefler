'use strict';
/* SMART-GOALS FAZ 1 · P0-4 — Goal priority (planning attribute, informational ONLY).
   Additive priority:{level:'p1'|'p2'|'p3', weight:1|2|3}. Dual-read default p2/weight 2.
   MUST NOT affect SMART/quality/progress/checkpoint/completion/lifecycle/health/planning/metrics. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const S = createSandbox();
const ROOT = path.join(__dirname, '..');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8');
const GOALS_SRC = fs.readFileSync(path.join(ROOT, 'js', '09-goals.js'), 'utf8');
const ENGINE_SRC = fs.readFileSync(path.join(ROOT, 'js', '07-smart-coach.js'), 'utf8');

describe('Pure: goalPriority dual-read', () => {
  test('1. no priority → p2', () => {
    assert.equal(S.goalPriority({}), 'p2');
    assert.equal(S.goalPriority({ priority: {} }), 'p2');
  });
  test('2. explicit valid level read', () => {
    assert.equal(S.goalPriority({ priority: { level: 'p1', weight: 1 } }), 'p1');
    assert.equal(S.goalPriority({ priority: { level: 'p3' } }), 'p3');
  });
  test('3. invalid/unknown level → p2', () => {
    assert.equal(S.goalPriority({ priority: { level: 'urgent' } }), 'p2');
    assert.equal(S.goalPriority({ priority: { level: 5 } }), 'p2');
  });
});

describe('Pure: weight + labels', () => {
  test('4. weight derived from level; default 2', () => {
    assert.equal(S.goalPriorityWeight({ priority: { level: 'p1' } }), 1);
    assert.equal(S.goalPriorityWeight({ priority: { level: 'p2' } }), 2);
    assert.equal(S.goalPriorityWeight({ priority: { level: 'p3' } }), 3);
    assert.equal(S.goalPriorityWeight({}), 2);
  });
  test('5. labels correct', () => {
    assert.equal(S.goalPriorityLabel({ priority: { level: 'p1' } }), 'P1 — Kritik');
    assert.equal(S.goalPriorityLabel({ priority: { level: 'p2' } }), 'P2 — Normal');
    assert.equal(S.goalPriorityLabel({ priority: { level: 'p3' } }), 'P3 — Düşük');
    assert.equal(S.goalPriorityLabel({}), 'P2 — Normal');
  });
});

describe('Pure: validateGoalPriority', () => {
  test('6. accepts p1/p2/p3', () => {
    assert.equal(S.validateGoalPriority({ level: 'p1' }).ok, true);
    assert.equal(S.validateGoalPriority({ level: 'p2' }).ok, true);
    assert.equal(S.validateGoalPriority({ level: 'p3' }).ok, true);
  });
  test('7. rejects empty/unknown/non-string', () => {
    assert.equal(S.validateGoalPriority({ level: '' }).ok, false);
    assert.equal(S.validateGoalPriority({ level: 'p9' }).ok, false);
    assert.equal(S.validateGoalPriority({ level: 1 }).ok, false);
    assert.equal(S.validateGoalPriority(null).ok, false);
    assert.equal(S.validateGoalPriority({}).ok, false);
  });
});

describe('Regression: priority does not affect engine/planning/health/lifecycle', () => {
  function goal(extra) {
    return Object.assign({
      title: 'Aylık geliri 100000 TL seviyesine çıkar', deadline: '2026-12-31',
      desc: 'Ailemin finansal özgürlüğü için kritik; her ay düzenli ölçeceğim.',
      metric: { target: 100000, current: 40000, start: 0, unit: 'TL', direction: 'up',
        checkpoints: [{ id: 'c1', label: '50K', done: true }, { id: 'c2', label: '75K', done: false }] },
      steps: [{ id: 's1', t: 'Plan', done: false }], status: 'active',
      planning: { year: 2026, quarter: 'Q1' }, health: { status: 'at_risk', confidence: 'low' }
    }, extra || {});
  }
  test('8. SMART unchanged', () => {
    assert.equal(S.smartScore(goal({ priority: { level: 'p1', weight: 1 } })), S.smartScore(goal()));
  });
  test('9. progress unchanged', () => {
    assert.equal(S.goalProgress(goal({ priority: { level: 'p1' } })), S.goalProgress(goal()));
  });
  test('10. checkpoint progress unchanged', () => {
    assert.equal(S.checkpointProgress(goal({ priority: { level: 'p3' } })), 50);
  });
  test('11. planning unchanged', () => {
    assert.equal(S.goalPlanningLabel(goal({ priority: { level: 'p1' } })), '2026 • Q1');
  });
  test('12. health unchanged', () => {
    assert.equal(S.goalHealthStatus(goal({ priority: { level: 'p1' } })), 'at_risk');
  });
});

describe('Static guards: form + save', () => {
  test('13. form has priority select initialized via goalPriority', () => {
    assert.ok(/id="gf_priority"/.test(UI_SRC), 'priority select missing');
    assert.ok(/goalPriority\(g\)/.test(UI_SRC), 'priority not initialized via goalPriority');
  });
  test('14. goalFromForm builds priority', () => {
    assert.ok(/priority:priority/.test(UI_SRC) || /priority:\{level:/.test(UI_SRC), 'goalFromForm should return priority');
    assert.ok(/ge\('gf_priority'\)/.test(UI_SRC), 'priority read from control');
  });
  test('15. submitGoalEdit writes priority, NOT lifecycle status/completedAt', () => {
    assert.ok(/priority:d\.priority/.test(UI_SRC), 'edit must persist priority');
    const at = UI_SRC.indexOf('var upd=Object.assign({},g,{', UI_SRC.indexOf('function submitGoalEdit'));
    const updBlock = UI_SRC.slice(at, UI_SRC.indexOf('});', at) + 3);
    assert.ok(/priority:d\.priority/.test(updBlock));
    assert.equal(/status:/.test(updBlock), false, 'edit upd must not set lifecycle status');
    assert.equal(/completedAt/.test(updBlock), false, 'edit upd must not touch completedAt');
  });
  test('16. submit validates via validateGoalPriority', () => {
    assert.ok(/validateGoalPriority/.test(UI_SRC));
  });
});

describe('Static guards: rendering', () => {
  test('17. list/grid card renders priority', () => {
    assert.ok(/goalPriorityBadge\(g\)/.test(UI_SRC) || /goalPriority\(g\)/.test(UI_SRC), 'cards should render priority');
    assert.ok(/Öncelik/.test(UI_SRC), 'readable "Öncelik" text');
  });
  test('18. detail shows priority (with health + planning)', () => {
    assert.ok(/goalPriorityLabel\(g\)/.test(GOALS_SRC), 'detail should show priority label');
    assert.ok(/goalHealthLabel\(g\)/.test(GOALS_SRC) && /goalPlanningLabel\(g\)/.test(GOALS_SRC), 'detail keeps health + planning');
  });
});

describe('Static guards: engine does not read priority', () => {
  function body(fn) { const i = ENGINE_SRC.indexOf('function ' + fn); return i < 0 ? '' : ENGINE_SRC.slice(i, i + 700); }
  test('19. smartAnalyze/qualityIndex/goalProgress/goalPct/metricPct/checkpointProgress do not read .priority', () => {
    ['smartAnalyze', 'qualityIndex', 'goalProgress', 'goalPct', 'metricPct', 'checkpointProgress'].forEach(fn => {
      assert.equal(/\.priority\b/.test(body(fn)), false, fn + ' must not read .priority');
    });
  });
});

describe('Mirror integrity', () => {
  test('20. js and public/js byte-identical for touched files', () => {
    ['07-smart-coach.js', '08-ui-core.js', '09-goals.js'].forEach(f => {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f + ' mirror differs');
    });
  });
});
