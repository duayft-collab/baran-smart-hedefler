'use strict';
/* SMART-GOALS FAZ 1 · P0 #1 — Milestone (checkpoint) editor.
   The SMART/Quality engine already READS metric.checkpoints (Achievable + Compound credit),
   but there was no way to create/validate them. This adds the pure engine layer:
   validateCheckpoint / collectValidCheckpoints / checkpointProgress / newCheckpointId,
   and proves the previously-unreachable engine credit becomes reachable — additive,
   backward-compatible, no change to existing metric/step progress semantics. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const S = createSandbox();
const UI_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', '08-ui-core.js'), 'utf8');
const GOALS_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', '09-goals.js'), 'utf8');

describe('Checkpoint validation (pure)', () => {
  test('1. empty label fails', () => {
    assert.equal(S.validateCheckpoint('', '', []).ok, false);
  });
  test('2. junk label fails', () => {
    assert.equal(S.validateCheckpoint('...', '', []).ok, false);
    assert.equal(S.validateCheckpoint('aaa', '', []).ok, false);
  });
  test('3. over-200 chars fails', () => {
    assert.equal(S.validateCheckpoint('x'.repeat(201), '', []).ok, false);
  });
  test('4. invalid date fails', () => {
    assert.equal(S.validateCheckpoint('İlk sürüm yayınla', 'not-a-date', []).ok, false);
  });
  test('5. duplicate label (case-insensitive) fails', () => {
    const existing = [{ id: 'cp1', label: 'Beta çıkışı' }];
    assert.equal(S.validateCheckpoint('beta çıkışı', '', existing).ok, false);
  });
  test('6. duplicate excludes self (edit)', () => {
    const existing = [{ id: 'cp1', label: 'Beta çıkışı' }];
    assert.equal(S.validateCheckpoint('Beta çıkışı', '', existing, 'cp1').ok, true);
  });
  test('7. valid label (with/without date) passes', () => {
    assert.equal(S.validateCheckpoint('Beta sürümünü yayınla', '', []).ok, true);
    assert.equal(S.validateCheckpoint('Beta sürümünü yayınla', '2026-09-01', []).ok, true);
  });
});

describe('collectValidCheckpoints (pure)', () => {
  test('8. drops empty/junk/duplicate, keeps valid, assigns ids', () => {
    const r = S.collectValidCheckpoints([
      { label: 'Beta yayınla' }, { label: '' }, { label: '...' },
      { label: 'beta yayınla' }, { label: 'Kullanıcı testleri' }
    ]);
    assert.equal(r.checkpoints.length, 2);
    assert.equal(r.dropped, 3);
    assert.ok(r.checkpoints.every(c => typeof c.id === 'string' && c.id.length > 0));
  });
  test('9. sorts by date, dateless last', () => {
    const r = S.collectValidCheckpoints([
      { label: 'C tarihsiz' }, { label: 'B eylül', date: '2026-09-01' }, { label: 'A mart', date: '2026-03-01' }
    ]);
    assert.equal(r.checkpoints.map(c => c.label).join('|'), 'A mart|B eylül|C tarihsiz');
  });
  test('10. clips >200, parses targetValue, drops invalid date', () => {
    const longLabel = 'Beta sürümünü yayınla ve geri bildirim topla '.repeat(6); // >200 real chars, not junk
    const r = S.collectValidCheckpoints([
      { label: longLabel, targetValue: '50', date: 'bad-date' }
    ]);
    assert.equal(r.checkpoints[0].label.length, 200);
    assert.equal(r.checkpoints[0].targetValue, 50);
    assert.equal('date' in r.checkpoints[0], false);
  });
  test('11. preserves done flag and existing id', () => {
    const r = S.collectValidCheckpoints([{ id: 'cp-keep', label: 'Bitti taşı', done: true }]);
    assert.equal(r.checkpoints[0].id, 'cp-keep');
    assert.equal(r.checkpoints[0].done, true);
  });
  test('12. empty/nullish input safe', () => {
    assert.equal(S.collectValidCheckpoints(null).checkpoints.length, 0);
    assert.equal(S.collectValidCheckpoints([]).checkpoints.length, 0);
  });
});

describe('checkpointProgress (pure)', () => {
  test('13. null when no checkpoints', () => {
    assert.equal(S.checkpointProgress({}), null);
    assert.equal(S.checkpointProgress({ metric: {} }), null);
    assert.equal(S.checkpointProgress({ metric: { checkpoints: [] } }), null);
  });
  test('14. percent of done checkpoints', () => {
    const g = { metric: { checkpoints: [{ done: true }, { done: false }, { done: true }, { done: false }] } };
    assert.equal(S.checkpointProgress(g), 50);
  });
});

describe('newCheckpointId (pure)', () => {
  test('15. unique cp-prefixed string ids', () => {
    const a = S.newCheckpointId(), b = S.newCheckpointId();
    assert.equal(typeof a, 'string');
    assert.ok(/^cp/.test(a));
    assert.notEqual(a, b);
  });
});

describe('Engine credit becomes reachable (integration)', () => {
  // A goal with title + structured metric + deadline + strong why, but NO steps.
  function baseGoal(extra) {
    return Object.assign({
      title: 'Aylık geliri 100000 TL seviyesine çıkar',
      deadline: '2026-12-31',
      desc: 'Ailemin finansal güvenliği ve özgürlüğü için kritik; her ay ölçeceğim.',
      metric: { target: 100000, current: 40000, start: 0, unit: 'TL', direction: 'up' },
      steps: []
    }, extra || {});
  }
  test('16. without steps AND without checkpoints → Achievable FAILS (baseline)', () => {
    const sa = S.smartAnalyze(baseGoal());
    assert.equal(sa.A.pass, false, 'no action plan should fail Achievable');
  });
  test('17. adding checkpoints makes Achievable PASS (engine credit reachable)', () => {
    const g = baseGoal({ metric: { target: 100000, current: 40000, start: 0, unit: 'TL', direction: 'up',
      checkpoints: [{ id: 'c1', label: '50K TL', done: true }, { id: 'c2', label: '75K TL', done: false }] } });
    const sa = S.smartAnalyze(g);
    assert.equal(sa.A.pass, true, 'checkpoints should satisfy Achievable');
  });
  test('18. checkpoints raise Quality Index vs no-plan baseline', () => {
    const base = S.qualityIndex(baseGoal()).score;
    const withCp = S.qualityIndex(baseGoal({ metric: { target: 100000, current: 40000, start: 0, unit: 'TL', direction: 'up',
      checkpoints: [{ id: 'c1', label: '50K TL', done: true }, { id: 'c2', label: '75K TL', done: false }] } })).score;
    assert.ok(withCp > base, `checkpoints should raise quality (${base} -> ${withCp})`);
  });
});

describe('Backward compatibility', () => {
  test('19. goal without checkpoints: progress semantics unchanged', () => {
    // metric-only goal progress unaffected by the new checkpoint layer
    const g = { metric: { target: 100, current: 25, start: 0, direction: 'up' }, steps: [] };
    assert.equal(S.checkpointProgress(g), null);
    assert.equal(S.goalProgress(g), 25); // existing metric% path preserved
  });
  test('20. step-based goal still computes step %', () => {
    const g = { steps: [{ id: 's1', t: 'a', done: true }, { id: 's2', t: 'b', done: false }] };
    assert.equal(S.goalProgress(g), 50);
    assert.equal(S.checkpointProgress(g), null);
  });
});

describe('UI wiring (static guards)', () => {
  test('21. form initializes + renders the checkpoint editor', () => {
    assert.ok(/gfCpInit\(g\)/.test(UI_SRC), 'gfCpInit not called in openGoalForm');
    assert.ok(/gfCpRender\(\)/.test(UI_SRC), 'gfCpRender not called');
    assert.ok(/id="gf_cps"/.test(UI_SRC), 'checkpoint editor container missing from form');
  });
  test('22. goalFromForm builds metric.checkpoints from the working copy', () => {
    assert.ok(/collectValidCheckpoints\(gfCheckpoints\)/.test(UI_SRC), 'checkpoints not collected from working copy');
    assert.ok(/metric\.checkpoints\s*=\s*cps/.test(UI_SRC), 'checkpoints not attached to metric');
  });
  test('23. old blind checkpoint-preservation line is gone (replaced by working copy)', () => {
    assert.equal(/if\(existing&&existing\.metric&&existing\.metric\.checkpoints\)metric\.checkpoints=existing\.metric\.checkpoints;/.test(UI_SRC), false,
      'stale checkpoint preservation should be replaced by the working-copy path');
  });
  test('24. detail view shows milestones and wires toggle', () => {
    assert.ok(/Kilometre Taşları/.test(GOALS_SRC), 'milestone section missing from detail');
    assert.ok(/function toggleCheckpoint/.test(GOALS_SRC), 'toggleCheckpoint missing');
    assert.ok(/checkpointProgress\(g\)/.test(GOALS_SRC), 'detail does not use checkpointProgress');
  });
  test('25. toggleCheckpoint only flips done, preserves other checkpoint fields', () => {
    // structural: uses Object.assign to flip done, keeps metric via spread
    assert.ok(/done:!c\.done/.test(GOALS_SRC), 'toggle should invert done');
    assert.ok(/Object\.assign\(\{\},g\.metric,\{checkpoints:/.test(GOALS_SRC), 'toggle should preserve metric fields');
  });
});
