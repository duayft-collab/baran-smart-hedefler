'use strict';
/* SMART-GOALS FAZ 1 · P0-3 — Goal health (status + confidence).
   Additive health:{status,confidence} SEPARATE from lifecycle status(active/done)+completedAt.
   Dual-read defaults (on_track / medium), no migration, no auto-write. Health must NOT affect
   SMART score, goal progress, checkpoint progress, or lifecycle. */
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

describe('Pure model: dual-read defaults', () => {
  test('1. old goal (no health) → status on_track', () => {
    assert.equal(S.goalHealthStatus({}), 'on_track');
    assert.equal(S.goalHealthStatus({ status: 'active' }), 'on_track');
  });
  test('2. old goal (no health) → confidence medium', () => {
    assert.equal(S.goalConfidence({}), 'medium');
  });
  test('3. explicit valid status read', () => {
    assert.equal(S.goalHealthStatus({ health: { status: 'at_risk', confidence: 'low' } }), 'at_risk');
  });
  test('4. explicit valid confidence read', () => {
    assert.equal(S.goalConfidence({ health: { status: 'at_risk', confidence: 'low' } }), 'low');
  });
  test('5. unknown status falls back safely', () => {
    assert.equal(S.goalHealthStatus({ health: { status: 'exploded' } }), 'on_track');
    assert.equal(S.goalHealthStatus({ health: { status: 42 } }), 'on_track');
  });
  test('6. unknown confidence falls back safely', () => {
    assert.equal(S.goalConfidence({ health: { confidence: 'ultra' } }), 'medium');
    assert.equal(S.goalConfidence({ health: {} }), 'medium');
  });
});

describe('Pure model: labels', () => {
  test('7. status + confidence labels correct', () => {
    assert.equal(S.goalHealthLabel({ health: { status: 'on_track' } }), 'Yolunda');
    assert.equal(S.goalHealthLabel({ health: { status: 'at_risk' } }), 'Riskte');
    assert.equal(S.goalHealthLabel({ health: { status: 'off_track' } }), 'Yolunda Değil');
    assert.equal(S.goalHealthLabel({ health: { status: 'paused' } }), 'Duraklatıldı');
    assert.equal(S.goalConfidenceLabel({ health: { confidence: 'high' } }), 'Yüksek');
    assert.equal(S.goalConfidenceLabel({ health: { confidence: 'medium' } }), 'Orta');
    assert.equal(S.goalConfidenceLabel({ health: { confidence: 'low' } }), 'Düşük');
  });
  test('7b. legacy/no-health labels fall back to defaults', () => {
    assert.equal(S.goalHealthLabel({}), 'Yolunda');
    assert.equal(S.goalConfidenceLabel({}), 'Orta');
  });
});

describe('Pure model: validateGoalHealth', () => {
  test('8. all valid combinations accepted', () => {
    assert.equal(S.validateGoalHealth({ status: 'on_track', confidence: 'high' }).ok, true);
    assert.equal(S.validateGoalHealth({ status: 'at_risk', confidence: 'medium' }).ok, true);
    assert.equal(S.validateGoalHealth({ status: 'off_track', confidence: 'low' }).ok, true);
    assert.equal(S.validateGoalHealth({ status: 'paused', confidence: 'medium' }).ok, true);
  });
  test('9. invalid/empty status rejected', () => {
    assert.equal(S.validateGoalHealth({ status: 'done', confidence: 'high' }).ok, false);
    assert.equal(S.validateGoalHealth({ status: '', confidence: 'high' }).ok, false);
  });
  test('10. invalid/empty confidence rejected', () => {
    assert.equal(S.validateGoalHealth({ status: 'on_track', confidence: 'x' }).ok, false);
    assert.equal(S.validateGoalHealth({ status: 'on_track', confidence: '' }).ok, false);
  });
  test('11. non-string inputs rejected', () => {
    assert.equal(S.validateGoalHealth({ status: 1, confidence: 2 }).ok, false);
    assert.equal(S.validateGoalHealth(null).ok, false);
    assert.equal(S.validateGoalHealth({}).ok, false);
  });
});

describe('Regression: health does NOT affect SMART/progress/milestone', () => {
  function goal(extra) {
    return Object.assign({
      title: 'Aylık geliri 100000 TL seviyesine çıkar',
      deadline: '2026-12-31',
      desc: 'Ailemin finansal özgürlüğü için kritik; her ay düzenli ölçeceğim.',
      metric: { target: 100000, current: 40000, start: 0, unit: 'TL', direction: 'up',
        checkpoints: [{ id: 'c1', label: '50K', done: true }, { id: 'c2', label: '75K', done: false }] },
      steps: [{ id: 's1', t: 'Plan', done: false }],
      status: 'active', planning: { year: 2026, quarter: 'Q1' }
    }, extra || {});
  }
  test('24. SMART score identical with/without health', () => {
    assert.equal(S.smartScore(goal({ health: { status: 'off_track', confidence: 'low' } })), S.smartScore(goal()));
  });
  test('25. goal progress identical with/without health', () => {
    assert.equal(S.goalProgress(goal({ health: { status: 'paused', confidence: 'low' } })), S.goalProgress(goal()));
  });
  test('26. checkpoint progress identical with/without health', () => {
    assert.equal(S.checkpointProgress(goal({ health: { status: 'at_risk', confidence: 'high' } })), S.checkpointProgress(goal()));
    assert.equal(S.checkpointProgress(goal()), 50);
  });
  test('28. planning dual-read unaffected by health', () => {
    assert.equal(S.goalPlanningLabel(goal({ health: { status: 'paused', confidence: 'low' } })), '2026 • Q1');
  });
});

describe('Static guards: form + save (08-ui-core)', () => {
  test('12/13/14. form has health + confidence selects, initialized via dual-read helpers', () => {
    assert.ok(/id="gf_health"/.test(UI_SRC), 'health select missing');
    assert.ok(/id="gf_conf"/.test(UI_SRC), 'confidence select missing');
    assert.ok(/goalHealthStatus\(g\)/.test(UI_SRC), 'health not initialized via goalHealthStatus');
    assert.ok(/goalConfidence\(g\)/.test(UI_SRC), 'confidence not initialized via goalConfidence');
  });
  test('15. goalFromForm returns a health object read from form controls', () => {
    assert.ok(/health:health/.test(UI_SRC), 'goalFromForm should return health');
    assert.ok(/ge\('gf_health'\)/.test(UI_SRC) && /ge\('gf_conf'\)/.test(UI_SRC), 'health read from form controls');
  });
  test('16. health only materialized at save (read from DOM, not a persistent side-effect)', () => {
    // health values come from ge('gf_health') at goalFromForm time; cancel never calls save
    assert.ok(/var health=\{status:\(ge\('gf_health'\)/.test(UI_SRC));
  });
  test('17/32. submitGoalEdit writes health but NOT lifecycle status/completedAt', () => {
    assert.ok(/health:d\.health/.test(UI_SRC), 'edit must persist health');
    // extract ONLY the edit Object.assign picked-fields (var upd=Object.assign({},g,{ ... });)
    const at = UI_SRC.indexOf('var upd=Object.assign({},g,{', UI_SRC.indexOf('function submitGoalEdit'));
    const updBlock = UI_SRC.slice(at, UI_SRC.indexOf('});', at) + 3);
    assert.ok(/health:d\.health/.test(updBlock), 'edit upd must include health');
    assert.equal(/status:/.test(updBlock), false, 'edit upd must not set lifecycle status');
    assert.equal(/completedAt/.test(updBlock), false, 'edit upd must not touch completedAt');
  });
  test('18/19. edit preserves planning/steps/metric handling (unchanged)', () => {
    assert.ok(/planning:d\.planning/.test(UI_SRC));
    assert.ok(/steps:d\.steps/.test(UI_SRC));
  });
  test('22b. submit validates health via validateGoalHealth', () => {
    assert.ok(/validateGoalHealth/.test(UI_SRC), 'submit must validate health');
  });
});

describe('Static guards: rendering (list/grid/detail)', () => {
  test('20. list/grid card renders health', () => {
    assert.ok(/goalHealthBadge\(g\)/.test(UI_SRC) || /goalHealthLabel\(g\)/.test(UI_SRC), 'list/grid should render health');
  });
  test('21. detail shows health status AND confidence', () => {
    assert.ok(/goalHealthLabel\(g\)/.test(GOALS_SRC), 'detail should show status label');
    assert.ok(/goalConfidenceLabel\(g\)/.test(GOALS_SRC), 'detail should show confidence label');
  });
  test('22/23. compact text labels exist (not color-only)', () => {
    // the badge outputs the Turkish text label + a "Güven:" prefix, not color alone
    assert.ok(/Güven/.test(UI_SRC) || /Güven/.test(GOALS_SRC), 'confidence prefix text missing');
  });
});

describe('Static guards: engine does not read health (07)', () => {
  function body(fnName) {
    const i = ENGINE_SRC.indexOf('function ' + fnName);
    if (i < 0) return '';
    return ENGINE_SRC.slice(i, i + 700);
  }
  test('32b. smartAnalyze / goalProgress / checkpointProgress / metricPct do not read health', () => {
    ['smartAnalyze', 'goalProgress', 'goalPct', 'metricPct', 'checkpointProgress'].forEach(fn => {
      assert.equal(/\.health\b/.test(body(fn)), false, fn + ' must not read .health');
    });
  });
});

describe('Mirror integrity', () => {
  test('31. js and public/js are byte-identical for touched files', () => {
    ['07-smart-coach.js', '08-ui-core.js', '09-goals.js'].forEach(f => {
      const a = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
      const b = fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8');
      assert.equal(a, b, f + ' mirror differs');
    });
  });
});
