'use strict';
/* SMART-GOALS Phase 3 P1 — Check-in History.
   Tek kaynak: D.goalCheckIns[] (goal'a GÖMÜLMEZ). Goal varsayılan byte-identical.
   Metric/health/confidence sessiz güncellenmez. Backup/restore additive+geriye-uyumlu.
   Tüm ağır mantık 11m-goal-checkins.js (harness-yüklü). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const CI_SRC = fs.readFileSync(path.join(ROOT, 'js', '11m-goal-checkins.js'), 'utf8');
const GOALS_SRC = fs.readFileSync(path.join(ROOT, 'js', '09-goals.js'), 'utf8');
const BACKUP_SRC = fs.readFileSync(path.join(ROOT, 'js', '04-backup.js'), 'utf8');

function goal(over) {
  return Object.assign({ id: 1, title: 'Hedef', cat: 'İş', steps: [], status: 'active',
    metric: { target: 100, current: 40, start: 0, unit: 'p', direction: 'up' },
    health: { status: 'at_risk', confidence: 'low' }, priority: { level: 'p1', weight: 1 },
    planning: { year: 2026, quarter: 'Q4' }, deadline: '2026-12-01', completedAt: null }, over || {});
}
function baseCI(over) {
  return Object.assign({ goalId: 1, checkInDate: '2026-07-01', note: 'ilerleme' }, over || {});
}
function seed(S) { S.D.goals = [goal()]; S.D.goalCheckIns = []; S.save = function () { S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; }; }

/* ───────────── MODEL ───────────── */
describe('Model & validation', () => {
  function errs(S, input) { return (S.validateGoalCheckIn(input).errors || []).map(function (e) { return e.code; }); }
  test('1. valid accepted', () => { const S = createSandbox(); seed(S); assert.equal(S.validateGoalCheckIn(baseCI()).errors.length, 0); });
  test('2. missing goalId rejected', () => { const S = createSandbox(); seed(S); assert.ok(errs(S, baseCI({ goalId: '' })).indexOf('MISSING_GOAL_ID') >= 0); });
  test('3. goal not found rejected', () => { const S = createSandbox(); seed(S); assert.ok(errs(S, baseCI({ goalId: 999 })).indexOf('GOAL_NOT_FOUND') >= 0); });
  test('4. missing date rejected', () => { const S = createSandbox(); seed(S); assert.ok(errs(S, baseCI({ checkInDate: '' })).indexOf('MISSING_CHECKIN_DATE') >= 0); });
  test('5. invalid date rejected', () => { const S = createSandbox(); seed(S); assert.ok(errs(S, baseCI({ checkInDate: '01/07/2026' })).indexOf('INVALID_CHECKIN_DATE') >= 0); });
  test('6. invalid metricValue rejected', () => { const S = createSandbox(); seed(S); assert.ok(errs(S, baseCI({ metricValue: 'abc' })).indexOf('INVALID_METRIC_VALUE') >= 0); });
  test('7. invalid progress rejected', () => { const S = createSandbox(); seed(S); assert.ok(errs(S, baseCI({ progressPct: 150 })).indexOf('INVALID_PROGRESS') >= 0); });
  test('8. invalid health rejected', () => { const S = createSandbox(); seed(S); assert.ok(errs(S, baseCI({ healthStatus: 'zzz' })).indexOf('INVALID_HEALTH_STATUS') >= 0); });
  test('9. invalid confidence rejected', () => { const S = createSandbox(); seed(S); assert.ok(errs(S, baseCI({ confidence: 'zzz' })).indexOf('INVALID_CONFIDENCE') >= 0); });
  test('10. duplicate id rejected', () => { const S = createSandbox(); seed(S); S.D.goalCheckIns = [{ id: 'ci-x', goalId: '1' }]; assert.ok(errs(S, baseCI({ id: 'ci-x' })).indexOf('DUPLICATE_CHECKIN_ID') >= 0); });
  test('11. unknown additive preserved', () => { const S = createSandbox(); seed(S); const r = S.validateGoalCheckIn(baseCI({ weirdX: 5 })).record; assert.equal(r.weirdX, 5); });
  test('12+13. numeric & string goalId resolve', () => { const S = createSandbox(); seed(S); assert.equal(S.validateGoalCheckIn(baseCI({ goalId: 1 })).errors.length, 0); assert.equal(S.validateGoalCheckIn(baseCI({ goalId: '1' })).errors.length, 0); });
  test('empty checkin rejected; single-field allowed', () => {
    const S = createSandbox(); seed(S);
    assert.ok(errs(S, { goalId: 1, checkInDate: '2026-07-01', note: '', blockers: '', nextAction: '' }).indexOf('EMPTY_CHECKIN') >= 0);
    ['note', 'blockers', 'nextAction'].forEach(function (f) { const i = { goalId: 1, checkInDate: '2026-07-01' }; i[f] = 'x'; assert.equal(S.validateGoalCheckIn(i).errors.length, 0, f); });
    assert.equal(S.validateGoalCheckIn({ goalId: 1, checkInDate: '2026-07-01', metricValue: 50 }).errors.length, 0);
    assert.equal(S.validateGoalCheckIn({ goalId: 1, checkInDate: '2026-07-01', progressPct: 50 }).errors.length, 0);
  });
  test('control char + replacement char blocked', () => {
    const S = createSandbox(); seed(S);
    assert.ok(errs(S, baseCI({ note: 'ab' })).indexOf('CONTROL_CHARACTER') >= 0);
    assert.ok(errs(S, baseCI({ note: 'a�b' })).indexOf('UNICODE_REPLACEMENT_CHARACTER') >= 0);
  });
  test('id format ci- + collision resistant across contexts', () => {
    const S1 = createSandbox(); const S2 = createSandbox();
    assert.ok(/^ci-/.test(S1.newGoalCheckInId({})));
    const a = {}; for (let i = 0; i < 30; i++) a[S1.newGoalCheckInId(a)] = 1;
    let c = 0; for (let i = 0; i < 30; i++) { if (a[S2.newGoalCheckInId({})]) c++; }
    assert.equal(c, 0);
  });
});

/* ───────────── ADD ───────────── */
describe('Add flow', () => {
  test('default add mutates only goalCheckIns; goal byte-identical; one save', () => {
    const S = createSandbox(); seed(S);
    const gBefore = JSON.stringify(S.D.goals[0]);
    let snaps = 0, saves = 0; S.snap = function () { snaps++; }; S.save = function () { saves++; S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; };
    const res = S.submitGoalCheckIn(baseCI({ metricValue: 55 }));
    assert.equal(res.ok, true);
    assert.equal(S.D.goalCheckIns.length, 1);
    assert.equal(JSON.stringify(S.D.goals[0]), gBefore);
    assert.equal(snaps, 1); assert.equal(saves, 1);
  });
  test('note-only add persists', () => { const S = createSandbox(); seed(S); assert.equal(S.submitGoalCheckIn(baseCI({ note: 'sadece not' })).ok, true); assert.equal(S.D.goalCheckIns.length, 1); });
  test('empty add rejected (no mutation)', () => {
    const S = createSandbox(); seed(S);
    const res = S.submitGoalCheckIn({ goalId: 1, checkInDate: '2026-07-01', note: '', blockers: '', nextAction: '' });
    assert.equal(res.ok, false); assert.equal(S.D.goalCheckIns.length, 0);
  });
  test('createdAt/createdBy/updatedAt set; id assigned', () => {
    const S = createSandbox(); seed(S); S.CLOUD.uid = 'user-1';
    S.submitGoalCheckIn(baseCI());
    const c = S.D.goalCheckIns[0];
    assert.ok(/^ci-/.test(c.id)); assert.ok(c.createdAt); assert.ok(c.updatedAt); assert.equal(c.createdBy, 'user-1');
  });
});

/* ───────────── METRIC OPT-IN ───────────── */
describe('Metric opt-in', () => {
  test('default does not change metric.current', () => {
    const S = createSandbox(); seed(S);
    S.submitGoalCheckIn(baseCI({ metricValue: 77 }));
    assert.equal(S.D.goals[0].metric.current, 40);
  });
  test('opt-in without confirm does not change metric', () => {
    const S = createSandbox(); seed(S); S.__setConfirm(function () { return false; });
    S.submitGoalCheckIn(baseCI({ metricValue: 77 }), { updateMetric: true });
    assert.equal(S.D.goals[0].metric.current, 40);
  });
  test('opt-in with confirm changes only metric.current', () => {
    const S = createSandbox(); seed(S); S.__setConfirm(function () { return true; });
    const g0 = Object.assign({}, S.D.goals[0]); const otherBefore = JSON.stringify(Object.assign({}, g0, { metric: null }));
    S.submitGoalCheckIn(baseCI({ metricValue: 77 }), { updateMetric: true });
    const g = S.D.goals[0];
    assert.equal(g.metric.current, 77);
    assert.equal(g.metric.target, 100); assert.equal(g.metric.direction, 'up'); // rest of metric unchanged
    assert.equal(JSON.stringify(Object.assign({}, g, { metric: null })), otherBefore); // non-metric fields unchanged
  });
  test('opt-in but no metric model → goal untouched + record still saved', () => {
    const S = createSandbox(); S.D.goals = [goal({ metric: null })]; S.D.goalCheckIns = [];
    S.save = function () { S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; }; S.__setConfirm(function () { return true; });
    const gBefore = JSON.stringify(S.D.goals[0]);
    const res = S.submitGoalCheckIn(baseCI({ metricValue: 5 }), { updateMetric: true });
    assert.equal(JSON.stringify(S.D.goals[0]), gBefore); // no metric model fabricated
    assert.equal(res.ok, true); assert.equal(S.D.goalCheckIns.length, 1);
  });
  test('health/confidence never silently update goal', () => {
    const S = createSandbox(); seed(S);
    S.submitGoalCheckIn(baseCI({ healthStatus: 'on_track', confidence: 'high' }));
    assert.equal(S.D.goals[0].health.status, 'at_risk'); assert.equal(S.D.goals[0].health.confidence, 'low');
    assert.equal(S.D.goalCheckIns[0].healthStatus, 'on_track'); // snapshot stored on the checkin
  });
});

/* ───────────── EDIT ───────────── */
describe('Edit flow', () => {
  function withOne(S) { seed(S); S.CLOUD.uid = 'u1'; S.submitGoalCheckIn(baseCI({ note: 'ilk', weirdX: 9 })); return S.D.goalCheckIns[0]; }
  test('edit preserves createdAt/createdBy/unknown, changes updatedAt, goal unchanged, one save', () => {
    const S = createSandbox(); const c = withOne(S);
    const gBefore = JSON.stringify(S.D.goals[0]); const createdAt = c.createdAt; const createdBy = c.createdBy;
    let saves = 0; S.save = function () { saves++; S.CLOUD.revision++; };
    const res = S.submitGoalCheckIn({ id: c.id, goalId: 1, checkInDate: c.checkInDate, note: 'düzenlendi' });
    const c2 = S.goalCheckInById(c.id);
    assert.equal(res.ok, true); assert.equal(c2.note, 'düzenlendi');
    assert.equal(c2.createdAt, createdAt); assert.equal(c2.createdBy, createdBy);
    assert.equal(c2.weirdX, 9); // unknown preserved
    assert.equal(JSON.stringify(S.D.goals[0]), gBefore);
    assert.equal(S.D.goalCheckIns.length, 1); assert.equal(saves, 1);
  });
});

/* ───────────── DELETE ───────────── */
describe('Delete flow', () => {
  test('delete removes only checkin; goal byte-identical; confirm; one save', () => {
    const S = createSandbox(); seed(S); S.submitGoalCheckIn(baseCI());
    const id = S.D.goalCheckIns[0].id; const gBefore = JSON.stringify(S.D.goals[0]);
    let confirmed = 0; S.__setConfirm(function () { confirmed++; return true; });
    let saves = 0; S.save = function () { saves++; S.CLOUD.revision++; };
    S.deleteGoalCheckIn(id);
    assert.equal(S.D.goalCheckIns.length, 0); assert.equal(JSON.stringify(S.D.goals[0]), gBefore);
    assert.ok(confirmed >= 1); assert.equal(saves, 1);
  });
  test('delete cancel keeps checkin', () => {
    const S = createSandbox(); seed(S); S.submitGoalCheckIn(baseCI()); S.__setConfirm(function () { return false; });
    S.deleteGoalCheckIn(S.D.goalCheckIns[0].id); assert.equal(S.D.goalCheckIns.length, 1);
  });
  test('delete missing id safe no-op', () => { const S = createSandbox(); seed(S); assert.doesNotThrow(function () { S.deleteGoalCheckIn('nope'); }); });
});

/* ───────────── TREND / QUERY ───────────── */
describe('Trend & queries', () => {
  function withTwo(S, a, b) { seed(S); S.D.goalCheckIns = [
    Object.assign({ id: 'ci-1', goalId: '1', checkInDate: '2026-07-01', createdAt: '2026-07-01T00:00:00Z' }, a),
    Object.assign({ id: 'ci-2', goalId: '1', checkInDate: '2026-07-05', createdAt: '2026-07-05T00:00:00Z' }, b) ]; }
  test('latest & previous correct (date DESC)', () => {
    const S = createSandbox(); withTwo(S, { metricValue: 10 }, { metricValue: 20 });
    assert.equal(S.latestGoalCheckIn('1').id, 'ci-2'); assert.equal(S.previousGoalCheckIn('1').id, 'ci-1');
  });
  test('up direction improving/declining', () => {
    const S = createSandbox(); withTwo(S, { metricValue: 10 }, { metricValue: 20 });
    assert.equal(S.goalCheckInTrend('1').state, 'improving');
    const S2 = createSandbox(); withTwo(S2, { metricValue: 20 }, { metricValue: 10 });
    assert.equal(S2.goalCheckInTrend('1').state, 'declining');
  });
  test('down direction improving when metric decreases', () => {
    const S = createSandbox(); S.D.goals = [goal({ metric: { target: 0, current: 50, start: 100, unit: 'kg', direction: 'down' } })];
    S.D.goalCheckIns = [{ id: 'ci-1', goalId: '1', checkInDate: '2026-07-01', metricValue: 80, createdAt: 'a' }, { id: 'ci-2', goalId: '1', checkInDate: '2026-07-05', metricValue: 60, createdAt: 'b' }];
    assert.equal(S.goalCheckInTrend('1').state, 'improving');
  });
  test('stable & unknown', () => {
    const S = createSandbox(); withTwo(S, { progressPct: 50 }, { progressPct: 50 });
    assert.equal(S.goalCheckInTrend('1').state, 'stable');
    const S2 = createSandbox(); seed(S2); assert.equal(S2.goalCheckInTrend('1').state, 'unknown');
  });
  test('metric & progress deltas correct', () => {
    const S = createSandbox(); withTwo(S, { metricValue: 10, progressPct: 10 }, { metricValue: 25, progressPct: 30 });
    const t = S.goalCheckInTrend('1'); assert.equal(t.metricDelta, 15); assert.equal(t.progressDelta, 20);
  });
  test('goalCheckInProgress respects direction + clamp', () => {
    const S = createSandbox();
    assert.equal(S.goalCheckInProgress(goal(), 50), 50); // up 0..100 → 50
    assert.equal(S.goalCheckInProgress(goal({ metric: { target: 0, start: 100, current: 0, direction: 'down' } }), 75), 25);
    assert.equal(S.goalCheckInProgress(goal({ metric: null }), 5), null);
    assert.ok(S.goalCheckInProgress(goal(), 999) <= 100);
  });
});

/* ───────────── GOAL DELETE GUARD ───────────── */
describe('Goal delete guard', () => {
  test('goal with checkins blocked; count exposed; no cascade', () => {
    const S = createSandbox(); seed(S); S.D.goalCheckIns = [{ id: 'ci-1', goalId: '1' }];
    assert.equal(S.goalHasCheckIns(1), true); assert.equal(S.goalCheckInCount(1), 1);
    const before = S.D.goals.length;
    S.deleteGoalWithCheckInGuard(1);
    assert.equal(S.D.goals.length, before); // not deleted
    assert.equal(S.D.goalCheckIns.length, 1); // not cascaded
  });
  test('goal without checkins deletes via original flow', () => {
    const S = createSandbox(); seed(S); S.__setConfirm(function () { return true; });
    S.save = function () {}; S.snap = function () {}; S.renderPage = function () {};
    S.deleteGoalWithCheckInGuard(1);
    assert.equal(S.D.goals.length, 0);
  });
  test('del decorator blocks goal+checkins but delegates others', () => {
    const S = createSandbox(); seed(S); S.D.goalCheckIns = [{ id: 'ci-1', goalId: '1' }]; S.__setConfirm(function () { return true; });
    S.save = function () {}; S.snap = function () {}; S.renderPage = function () {};
    S.del(1, 'goal'); assert.equal(S.D.goals.length, 1); // blocked
    S.D.todos = [{ id: 5, text: 't' }]; S.del(5, 'todo'); assert.equal((S.D.todos || []).length, 0); // delegated
  });
  test('orphanGoalCheckIns detects orphans safely', () => {
    const S = createSandbox(); seed(S); S.D.goalCheckIns = [{ id: 'ci-1', goalId: '1' }, { id: 'ci-2', goalId: '999' }];
    assert.doesNotThrow(function () { const o = S.orphanGoalCheckIns(); assert.equal(o.length, 1); assert.equal(o[0].id, 'ci-2'); });
  });
});

/* ───────────── UX ───────────── */
describe('Goal detail UX', () => {
  test('empty state + add wiring', () => { const S = createSandbox(); seed(S); const h = S.goalCheckInPanelHtml(1); assert.ok(/İlerleme Geçmişi/.test(h)); assert.ok(/Henüz ilerleme kaydı yok/.test(h)); assert.ok(/openGoalCheckInForm/.test(h)); });
  test('timeline newest-first + fields + edit/delete wiring + no wide fixed px', () => {
    const S = createSandbox(); seed(S);
    S.D.goalCheckIns = [{ id: 'ci-1', goalId: '1', checkInDate: '2026-07-01', metricValue: 10, healthStatus: 'at_risk', confidence: 'low', blockers: 'engel1', nextAction: 'aksiyon1', createdAt: 'a' },
      { id: 'ci-2', goalId: '1', checkInDate: '2026-07-05', metricValue: 20, note: 'not2', createdAt: 'b' }];
    const h = S.goalCheckInPanelHtml(1);
    assert.ok(h.indexOf('ci-2') < h.indexOf('ci-1') || h.indexOf('2026-07-05') < h.indexOf('2026-07-01')); // newest first
    assert.ok(/engel1/.test(h) && /aksiyon1/.test(h) && /not2/.test(h));
    assert.ok(/Riskte/.test(h)); // health label text (not color-only)
    assert.ok(/openGoalCheckInForm/.test(h) && /deleteGoalCheckIn/.test(h));
    assert.equal(/width:\s*[5-9]\d\dpx/.test(h), false);
  });
  test('openGoalDetail wires the checkin panel', () => { assert.ok(/goalCheckInPanelHtml/.test(GOALS_SRC)); });
});

/* ───────────── BACKUP/RESTORE ───────────── */
describe('Backup / restore compat', () => {
  function payload(gci) { return { goals: [], relations: [], goalCheckIns: gci || [] }; }
  test('old backup without goalCheckIns loads (count 0)', () => {
    const S = createSandbox(); assert.equal(S.countRecords({ goals: [] }).goalCheckIns, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(S.buildStateFromPayload({}).goalCheckIns || [])), []);
  });
  test('countRecords includes goalCheckIns', () => { const S = createSandbox(); assert.equal(S.countRecords(payload([{ id: 'ci-1' }, { id: 'ci-2' }])).goalCheckIns, 2); });
  test('DIFF_SCHEMA includes goalCheckIns identity id', () => {
    const S = createSandbox();
    assert.ok(S.DIFF_SCHEMA.arrays.some(function (a) { return a.field === 'goalCheckIns' && a.identity === 'id'; }));
  });
  test('restore preview diffs goalCheckIns by id', () => {
    const S = createSandbox();
    const cur = payload([{ id: 'ci-1', goalId: '1', note: 'a' }]);
    const bak = payload([]);
    const pv = S.buildRestorePreview(cur, bak, { sourceRevision: 1, targetRevision: 0 });
    assert.ok(pv.perModule.goalCheckIns); assert.equal(pv.perModule.goalCheckIns.removed, 1);
  });
  test('goalCheckIns not a critical module (no over-block)', () => { const S = createSandbox(); assert.equal(S.IMPACT_RULES.criticalModules.indexOf('goalCheckIns') < 0, true); });
});

/* ───────────── REGRESSION ───────────── */
describe('Regression', () => {
  test('add does not change SMART/quality/progress/checkpoint/priority/planning/lifecycle', () => {
    const S = createSandbox(); seed(S); const g = S.D.goals[0];
    const m0 = JSON.stringify({ s: S.smartScore(g), q: S.qualityIndex(g), p: S.goalProgress(g), cp: (typeof S.checkpointProgress === 'function' ? S.checkpointProgress(g) : null), pr: S.goalPriority(g), pl: S.goalPlanningLabel(g), st: g.status, ca: g.completedAt });
    S.submitGoalCheckIn(baseCI({ metricValue: 60 }));
    const g2 = S.D.goals[0];
    const m1 = JSON.stringify({ s: S.smartScore(g2), q: S.qualityIndex(g2), p: S.goalProgress(g2), cp: (typeof S.checkpointProgress === 'function' ? S.checkpointProgress(g2) : null), pr: S.goalPriority(g2), pl: S.goalPlanningLabel(g2), st: g2.status, ca: g2.completedAt });
    assert.equal(m1, m0);
  });
  test('relations untouched by checkin ops', () => {
    const S = createSandbox(); seed(S); S.D.relations = [{ id: 'r1', sourceType: 'goal', sourceId: '1', targetType: 'principle', targetId: 'p1', relationType: 'related_to' }];
    const rb = JSON.stringify(S.D.relations);
    S.submitGoalCheckIn(baseCI()); S.deleteGoalCheckIn(S.D.goalCheckIns[0] && S.D.goalCheckIns[0].id);
    assert.equal(JSON.stringify(S.D.relations), rb);
  });
});

/* ───────────── STATIC GUARDS ───────────── */
describe('Static guards', () => {
  test('G1. no embedded goal.checkIns / goal.history / D.checkIns', () => {
    assert.equal(/goal\.checkIns\s*=|goal\.history\s*=|D\.checkIns\b|D\.goalHistory\b/.test(CI_SRC + GOALS_SRC), false);
  });
  test('G2. single collection D.goalCheckIns', () => { assert.ok(/D\.goalCheckIns/.test(CI_SRC)); assert.equal(/D\.checkIns2|D\.goalCheckins2/.test(CI_SRC), false); });
  test('G3. no second sync/save engine', () => { assert.equal(/function\s+(save|queueCloudSave|commitMutation|onRemoteSnapshot)\b/.test(CI_SRC), false); });
  test('G4. add default does not assign goal.metric.current unconditionally', () => {
    // metric write must be guarded behind an explicit opt-in + confirm
    assert.equal(/metric\.current\s*=/.test(CI_SRC) === true && /updateMetric|confirm/.test(CI_SRC) === false, false);
  });
  test('G5. does not modify relations engine', () => { assert.equal(/REL_TYPES\s*=|registerRelationResolver\s*\(/.test(CI_SRC), false); });
  test('G6. DIFF_SCHEMA change is additive (existing fields intact)', () => {
    ['goals', 'relations', 'decisions', 'wisdomQuotes', 'principles'].forEach(function (f) {
      assert.ok(new RegExp("field:'" + f + "'").test(BACKUP_SRC), f);
    });
    assert.ok(/field:'goalCheckIns'/.test(BACKUP_SRC));
  });
  test('G7. does not touch 11l goal-io', () => { assert.equal(/goalBuildJsonText|goalImportApply/.test(CI_SRC), false); });
  test('G8. success message gated (ACK)', () => { assert.ok(/senkronize ediliyor|_gciAwaitAck|AwaitAck/.test(CI_SRC)); });
  test('G9. js/public mirror byte-identical (11m/09/04/00/11-restore-ui/index)', () => {
    ['11m-goal-checkins.js', '09-goals.js', '04-backup.js', '00-config.js', '11-restore-ui.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
  });
  test('G10. module under 900 lines', () => { assert.ok(CI_SRC.split('\n').length < 900); });
});
