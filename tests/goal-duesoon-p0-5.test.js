'use strict';
/* SMART-GOALS FAZ 1 · P0-5 — Due Soon (DERIVED from deadline, visual planning ONLY).
   No new data model, no write, no migration. Calendar-day math (no hour/timezone drift).
   Thresholds: overdue<0, today=0, tomorrow=1, this_week 2-7, due_soon 8-30, future>30, none.
   Done goals show NO due badge. MUST NOT affect SMART/quality/progress/checkpoint/health/priority/planning/lifecycle. */
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

// Build a YYYY-MM-DD string offset by N calendar days from a base local date.
function iso(y, m, d) { return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }

describe('goalDaysRemaining (calendar-day, timezone-safe)', () => {
  test('1. no deadline → null', () => {
    assert.equal(S.goalDaysRemaining({}), null);
    assert.equal(S.goalDaysRemaining({ deadline: '' }), null);
  });
  test('2. same calendar day → 0 regardless of time-of-day', () => {
    assert.equal(S.goalDaysRemaining({ deadline: '2026-06-15' }, new Date(2026, 5, 15, 23, 59)), 0);
    assert.equal(S.goalDaysRemaining({ deadline: '2026-06-15' }, new Date(2026, 5, 15, 0, 1)), 0);
  });
  test('3. tomorrow → 1 (even at 00:01 today)', () => {
    assert.equal(S.goalDaysRemaining({ deadline: '2026-06-16' }, new Date(2026, 5, 15, 0, 1)), 1);
  });
  test('4. leap year 29 Feb', () => {
    assert.equal(S.goalDaysRemaining({ deadline: '2028-02-29' }, new Date(2028, 1, 28, 12, 0)), 1);
    assert.equal(S.goalDaysRemaining({ deadline: '2028-03-01' }, new Date(2028, 1, 29, 12, 0)), 1);
  });
  test('5. year boundary 31 Dec → 1 Jan', () => {
    assert.equal(S.goalDaysRemaining({ deadline: '2027-01-01' }, new Date(2026, 11, 31, 23, 30)), 1);
  });
  test('6. 365+ remaining and overdue', () => {
    assert.equal(S.goalDaysRemaining({ deadline: '2027-07-20' }, new Date(2026, 5, 15)), 400);
    assert.equal(S.goalDaysRemaining({ deadline: '2025-05-11' }, new Date(2026, 5, 15)), -400);
  });
});

describe('goalDueState thresholds', () => {
  const now = new Date(2026, 5, 15, 10, 0); // 15 Jun 2026
  function g(deadline, status) { return { deadline: deadline, status: status || 'active' }; }
  test('7. overdue / today / tomorrow', () => {
    assert.equal(S.goalDueState(g('2026-06-10'), now), 'overdue');
    assert.equal(S.goalDueState(g('2026-06-15'), now), 'today');
    assert.equal(S.goalDueState(g('2026-06-16'), now), 'tomorrow');
  });
  test('8. this_week boundaries (2..7)', () => {
    assert.equal(S.goalDueState(g('2026-06-17'), now), 'this_week'); // 2
    assert.equal(S.goalDueState(g('2026-06-22'), now), 'this_week'); // 7
  });
  test('9. due_soon boundaries (8..30)', () => {
    assert.equal(S.goalDueState(g('2026-06-23'), now), 'due_soon'); // 8
    assert.equal(S.goalDueState(g('2026-07-15'), now), 'due_soon'); // 30
  });
  test('10. future (>30) and none', () => {
    assert.equal(S.goalDueState(g('2026-07-16'), now), 'future'); // 31
    assert.equal(S.goalDueState(g(''), now), 'none');
    assert.equal(S.goalDueState({}, now), 'none');
  });
  test('11. done goal → state done (badge suppressed) even if overdue', () => {
    assert.equal(S.goalDueState(g('2026-06-01', 'done'), now), 'done');
  });
});

describe('goalDueLabel', () => {
  const now = new Date(2026, 5, 15, 10, 0);
  function g(deadline, status) { return { deadline: deadline, status: status || 'active' }; }
  test('12. overdue shows ABSOLUTE days', () => {
    assert.equal(S.goalDueLabel(g('2026-06-07'), now), 'Gecikmiş · 8 Gün');
    assert.equal(S.goalDueLabel(g('2025-05-11'), now), 'Gecikmiş · 400 Gün');
  });
  test('13. today / tomorrow fixed text', () => {
    assert.equal(S.goalDueLabel(g('2026-06-15'), now), 'Bugün Son Gün');
    assert.equal(S.goalDueLabel(g('2026-06-16'), now), 'Yarın Son Gün');
  });
  test('14. this_week / due_soon with day count', () => {
    assert.equal(S.goalDueLabel(g('2026-06-19'), now), 'Bu Hafta · 4 Gün');
    assert.equal(S.goalDueLabel(g('2026-07-03'), now), 'Yaklaşıyor · 18 Gün');
  });
  test('15. future / none / done → empty label (no badge)', () => {
    assert.equal(S.goalDueLabel(g('2026-08-30'), now), '');
    assert.equal(S.goalDueLabel(g(''), now), '');
    assert.equal(S.goalDueLabel(g('2026-06-01', 'done'), now), '');
  });
  test('16. deadline removed → label disappears', () => {
    const withDl = g('2026-06-16');
    assert.equal(S.goalDueLabel(withDl, now), 'Yarın Son Gün');
    const removed = Object.assign({}, withDl, { deadline: '' });
    assert.equal(S.goalDueLabel(removed, now), '');
  });
});

describe('Regression: due does not affect engine/planning/health/priority', () => {
  function goal(extra) {
    return Object.assign({
      title: 'Aylık geliri 100000 TL seviyesine çıkar', deadline: '2026-12-31',
      desc: 'Ailemin finansal özgürlüğü için kritik; her ay düzenli ölçeceğim.',
      metric: { target: 100000, current: 40000, start: 0, unit: 'TL', direction: 'up',
        checkpoints: [{ id: 'c1', label: '50K', done: true }, { id: 'c2', label: '75K', done: false }] },
      steps: [{ id: 's1', t: 'Plan', done: false }], status: 'active',
      planning: { year: 2026, quarter: 'Q1' }, health: { status: 'at_risk', confidence: 'low' },
      priority: { level: 'p1', weight: 1 }
    }, extra || {});
  }
  test('17. computing due does not change SMART/quality/progress/checkpoint', () => {
    const g = goal();
    const smart = S.smartScore(g), q = S.qualityIndex(g).score, p = S.goalProgress(g), cp = S.checkpointProgress(g);
    S.goalDueState(g); S.goalDueLabel(g); S.goalDaysRemaining(g);
    assert.equal(S.smartScore(g), smart);
    assert.equal(S.qualityIndex(g).score, q);
    assert.equal(S.goalProgress(g), p);
    assert.equal(S.checkpointProgress(g), cp);
  });
  test('18. planning/health/priority unaffected', () => {
    const g = goal();
    assert.equal(S.goalPlanningLabel(g), '2026 • Q1');
    assert.equal(S.goalHealthStatus(g), 'at_risk');
    assert.equal(S.goalPriority(g), 'p1');
  });
});

describe('Static guards', () => {
  test('19. engine SMART/progress does not read due', () => {
    ['smartAnalyze', 'qualityIndex', 'goalProgress', 'goalPct', 'metricPct', 'checkpointProgress'].forEach(fn => {
      const i = ENGINE_SRC.indexOf('function ' + fn); const body = i < 0 ? '' : ENGINE_SRC.slice(i, i + 700);
      assert.equal(/goalDue|dueState|DaysRemaining/.test(body), false, fn + ' must not read due');
    });
  });
  test('20. no cached due state (recomputed each call)', () => {
    assert.equal(/_dueCache|dueStateCache/.test(ENGINE_SRC), false, 'due must not be cached');
  });
  test('21. due layer never rewrites deadline', () => {
    // no assignment to g.deadline / .deadline= inside the due helpers block
    const i = ENGINE_SRC.indexOf('function goalDaysRemaining');
    const block = ENGINE_SRC.slice(i, i + 1400);
    assert.equal(/\.deadline\s*=/.test(block), false, 'due helpers must not write deadline');
  });
  test('22. cards + detail render due badge/label', () => {
    assert.ok(/goalDueBadge\(g\)/.test(UI_SRC), 'cards should render goalDueBadge');
    assert.ok(/goalDueLabel\(g\)|goalDueBadge\(g\)/.test(GOALS_SRC), 'detail should render due');
  });
  test('23. done goals suppressed at source (state done → empty)', () => {
    assert.ok(/status===['"]done['"]/.test(ENGINE_SRC), 'done suppression present in engine');
  });
});

describe('Mirror integrity', () => {
  test('24. js and public/js byte-identical', () => {
    ['07-smart-coach.js', '08-ui-core.js', '09-goals.js'].forEach(f => {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f + ' mirror differs');
    });
  });
});
