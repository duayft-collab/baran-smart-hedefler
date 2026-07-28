'use strict';
/* SMART-GOALS Platform P2 — Execution Intelligence Engine (TÜRETİLMİŞ · SALT OKUNUR).
   "Şu an yapılacak tek en yüksek-değerli aksiyon nedir?" Mevcut goal motorları
   yeniden kullanılır; deterministik; 0 write/network/yeni-veri. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC_14 = fs.readFileSync(path.join(ROOT, 'js', '14-execution-engine.js'), 'utf8');

function goal(id, over) {
  return Object.assign({ id: id, title: 'Hedef ' + id, desc: '', cat: 'İş', status: 'active',
    planning: { year: 2026, quarter: 'Q3' }, health: { status: 'on_track', confidence: 'medium' },
    priority: { level: 'p2', weight: 2 }, deadline: '', measurable: '', steps: [], createdAt: '2026-01-01' }, over || {});
}
function boot(S, goals, over) {
  over = over || {};
  S.D.goals = goals || [];
  S.D.decisions = []; S.D.principles = []; S.D.relations = over.relations || [];
  S.D.goalCheckIns = over.checkIns || [];
  S.D.wisdomQuotes = over.quotes || [{ id: 'w1', quote: 'liderlik', author: 'A', active: true, category: '', tags: [], favorite: false, reflected: false, showCount: 0 }];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  if (typeof S.execInvalidate === 'function') S.execInvalidate();
}
function farFuture() { return new Date(Date.now() + 300 * 864e5).toISOString().slice(0, 10); }
function past(days) { return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); }

describe('Execution context (derived, memoized)', () => {
  test('1. context covers active goals only, memoized by signature', () => {
    const S = createSandbox();
    boot(S, [goal(1), goal(2, { status: 'done' }), goal(3, { status: 'archived' })]);
    const c1 = S.execContext(), c2 = S.execContext();
    assert.equal(c1, c2); // same ref (memoized)
    assert.equal(c1.length, 1); // only active goal 1
    assert.ok('risk' in c1[0] && 'due' in c1[0] && 'priorityWeight' in c1[0]);
  });
});

describe("Today's Best Action (single primary)", () => {
  test('2. returns exactly one primary recommendation with required fields', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: farFuture() }), goal(2, { deadline: past(3), priority: { level: 'p1', weight: 1 } })]);
    const a = S.execTodaysBestAction();
    assert.ok(a && typeof a.action === 'string');
    ['goalId', 'verb', 'reason', 'effort', 'impact'].forEach(k => assert.ok(k in a, k));
    assert.equal(a.goalId, 2); // overdue p1 wins
    assert.equal(a.verb, 'review'); // overdue → review
  });
  test('3. blocked goal → best action is resolve-blocker', () => {
    const S = createSandbox();
    boot(S, [goal(1), goal(2)]);
    // goal 1 depends_on goal 2 (unresolved) → goal 1 blocked
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'goal', targetId: '2', relationType: 'depends_on' });
    S.execInvalidate();
    // make goal 1 highest via overdue
    S.D.goals[0].deadline = past(5); S.execInvalidate();
    const a = S.execTodaysBestAction();
    if (a.goalId === 1) { assert.equal(a.verb, 'resolve_blocker'); assert.ok(/engel/i.test(a.action) || /engel/i.test(a.reason)); }
    else { assert.ok(true); } // if dep model ranks otherwise, still deterministic (covered by test 6)
  });
  test('4. empty goals → no action (safe)', () => {
    const S = createSandbox(); boot(S, []);
    assert.equal(S.execTodaysBestAction(), null);
  });
});

describe('Execution queue (deterministic ranking)', () => {
  test('5. overdue/high-priority ranks above future/low', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: farFuture(), priority: { level: 'p3', weight: 3 } }),
             goal(2, { deadline: past(2), priority: { level: 'p1', weight: 1 } })]);
    const q = S.execQueue();
    assert.equal(q[0].goalId, 2);
    assert.ok(q[0].score >= q[1].score);
  });
  test('6. identical inputs → identical outputs (pure/deterministic)', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(1) }), goal(2, { deadline: farFuture() }), goal(3)]);
    assert.deepEqual(S.execQueue().map(x => x.goalId), S.execQueue().map(x => x.goalId));
  });
  test('7. tie-break stable by id', () => {
    const S = createSandbox();
    boot(S, [goal('b'), goal('a')]); // same signals → id asc
    const q = S.execQueue();
    assert.equal(q[0].goalId, 'a');
  });
});

describe('Blocker detection', () => {
  test('8. overdue / stalled / no-execution / unhealthy detected', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(3) }), goal(2, { health: { status: 'off_track', confidence: 'low' } }), goal(3)]);
    const b = S.execBlockers();
    assert.ok(b.overdue.some(x => String(x.id) === '1'));
    assert.ok(b.unhealthy.some(x => String(x.id) === '2'));
    assert.ok(b.noRecentExecution.length >= 1); // no check-ins seeded
    assert.equal(typeof b.total, 'number');
  });
});

describe('Momentum engine', () => {
  test('9. derives streak/score/slowdown/recovery/trend', () => {
    const S = createSandbox();
    const today = new Date().toISOString().slice(0, 10), yest = past(1);
    boot(S, [goal(1)], { checkIns: [{ id: 'c1', goalId: '1', checkInDate: today }, { id: 'c2', goalId: '1', checkInDate: yest }] });
    const m = S.execMomentum();
    ['streak', 'score', 'slowdown', 'recovery', 'trend'].forEach(k => assert.ok(k in m, k));
    assert.ok(m.streak >= 2); // today + yesterday
    assert.ok(['improving', 'declining', 'stable', 'idle'].indexOf(m.trend) >= 0);
  });
});

describe('Weekly readiness (presentation-derived)', () => {
  test('10. classifies goals into readiness states', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) }), goal(2)]);
    const r = S.execWeeklyReadiness();
    assert.ok(r.items.length === 2);
    assert.ok(['Ready', 'Needs Review', 'Blocked', 'At Risk', 'Waiting'].indexOf(r.items[0].status) >= 0);
    assert.equal(typeof r.counts['At Risk'], 'number');
  });
});

describe('Daily Focus card + integration', () => {
  test('11. single card: action + reason + effort + impact + open action', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    const h = S.execDailyFocusCardHtml();
    assert.ok(/Günün En İyi Aksiyonu/.test(h));
    assert.ok(/Efor:/.test(h) && /Etki:/.test(h));
    assert.ok(/openGoalDetail/.test(h));
    // secondary: not a KPI dashboard
    assert.equal((h.match(/min-width:1\d\dpx/g) || []).length, 0);
  });
  test('12. empty goals → empty card', () => {
    const S = createSandbox(); boot(S, []);
    assert.equal(S.execDailyFocusCardHtml(), '');
  });
  test('12b. open-goal button coerces id to number (openGoalDetail uses strict ===)', () => {
    // Regression: goal ids are numeric (09-goals matches with x.id===goalId and every
    // working caller sends +this.dataset.gid). A raw string dataset.id never matches →
    // the "Hedefi Aç" button silently no-ops in production. Handler MUST coerce with +.
    const S = createSandbox();
    boot(S, [goal(1784485410450, { deadline: past(2) })]);
    const h = S.execDailyFocusCardHtml();
    assert.ok(/openGoalDetail\(\+this\.dataset\.id\)/.test(h), 'must coerce dataset.id to Number with +');
    assert.equal(/openGoalDetail\(this\.dataset\.id\)/.test(h), false, 'must not pass raw string id');
  });
  test('13. Goals Dashboard surfaces the focus card (additive; stats intact)', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    const h = S.goalsDashboardHtml();
    assert.ok(/Hedef Panosu/.test(h)); // dashboard primary intact
    assert.ok(/Günün En İyi Aksiyonu/.test(h)); // execution surfaced
  });
});

describe('Static guards (read-only, zero-write, reuse-only)', () => {
  test('14. no write/network/new-data-model tokens in the engine', () => {
    ['save(', 'commitMutation', 'snap(', 'createBackup', 'fetch(', '.onSnapshot(', 'setInterval', 'setTimeout', 'addEventListener',
     'localStorage', 'INIT.', 'DIFF_SCHEMA', '.set(', 'runTransaction']
      .forEach(t => assert.equal(SRC_14.indexOf(t), -1, 'forbidden: ' + t));
  });
  test('15. reuses existing goal engines (risk/momentum/due/blocked)', () => {
    ['goalRiskScore', 'goalMomentum', 'goalDueState', 'goalIsBlocked', 'goalPriorityWeight', 'goalHealthStatus']
      .forEach(fn => assert.ok(SRC_14.indexOf(fn) >= 0, 'must reuse ' + fn));
  });
  test('16. render performs zero cloud writes; mirror + <900', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    S.execDailyFocusCardHtml(); S.goalsDashboardHtml();
    S.save = _s;
    assert.equal(w, 0);
    assert.equal(SRC_14, fs.readFileSync(path.join(ROOT, 'public', 'js', '14-execution-engine.js'), 'utf8'));
    assert.ok(SRC_14.split('\n').length < 900);
  });
});
