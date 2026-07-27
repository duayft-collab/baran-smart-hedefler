'use strict';
/* SMART-GOALS Phase 7 P1 — Goal Analytics & Insights (TAMAMEN TÜRETİLMİŞ).
   Tek kaynaklar D.goals/D.goalCheckIns/D.relations; hepsi salt-okunur.
   Velocity/momentum/consistency/risk/forecast/stale/insights runtime türetim; 0 mutasyon. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11r-goal-analytics.js'), 'utf8');

const NOW = new Date('2026-07-27T00:00:00.000Z');
function g(over) { return Object.assign({ id: 1, title: 'G', cat: 'İş', status: 'active', deadline: '2026-12-31', steps: [], health: { status: 'on_track', confidence: 'high' }, planning: { year: 2026, quarter: 'Q3' }, createdAt: '2026-01-01T00:00:00.000Z' }, over || {}); }
function ci(gid, date, pct, over) { return Object.assign({ id: 'c' + gid + '-' + date, goalId: String(gid), checkInDate: date, createdAt: date + 'T00:00:00.000Z', progressPct: pct }, over || {}); }
function setup(S, goals, checks) { S.D.goals = goals; S.D.goalCheckIns = checks || []; S.D.relations = []; }

describe('Velocity / Momentum / Consistency', () => {
  test('1. velocity = progress %/day across first↔last check-in', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-11', 30)]);
    assert.equal(S.goalVelocity(1, NOW), 2); // (30-10)/10 = 2
  });
  test('2. velocity 0 with <2 data points', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 })], [ci(1, '2026-07-01', 10)]);
    assert.equal(S.goalVelocity(1, NOW), 0);
  });
  test('3. momentum improving/declining from last two check-ins', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-11', 40)]);
    assert.equal(S.goalMomentum(1).state, 'improving'); assert.ok(S.goalMomentum(1).score > 0);
    const S2 = createSandbox(); setup(S2, [g({ id: 1 })], [ci(1, '2026-07-01', 40), ci(1, '2026-07-11', 20)]);
    assert.equal(S2.goalMomentum(1).state, 'declining'); assert.ok(S2.goalMomentum(1).score < 0);
  });
  test('4. consistency higher for regular intervals', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-08', 20), ci(1, '2026-07-15', 30)]);
    assert.equal(S.goalConsistency(1), 100); // eşit 7g aralık
    const S2 = createSandbox(); setup(S2, [g({ id: 1 })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-02', 20), ci(1, '2026-07-30', 30)]);
    assert.ok(S2.goalConsistency(1) < 100);
  });
});

describe('Stale / age / frequency', () => {
  test('5. last check-in age in calendar days', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 })], [ci(1, '2026-07-20', 50)]);
    assert.equal(S.goalLastCheckInAge(1, NOW), 7);
  });
  test('6. stale falls back to createdAt when no check-ins', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, createdAt: '2026-07-01T00:00:00.000Z' })], []);
    assert.equal(S.goalLastCheckInAge(1, NOW), null);
    assert.equal(S.goalStaleDays(1, NOW), 26);
  });
  test('7. goalStaleGoals filters > threshold, sorted desc', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, createdAt: '2026-01-01T00:00:00.000Z' }), g({ id: 2, createdAt: '2026-07-25T00:00:00.000Z' })], []);
    const st = S.goalStaleGoals(30, NOW);
    assert.equal(st.length, 1); assert.equal(String(st[0].goal.id), '1');
  });
  test('8. check-in frequency = avg interval', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-11', 20), ci(1, '2026-07-21', 30)]);
    assert.equal(S.goalCheckInFrequency(1), 10);
  });
});

describe('Risk / Forecast / Stall', () => {
  test('9. risk 0 for done / 100% goals', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, status: 'done' })], []);
    assert.equal(S.goalRiskScore(1, NOW), 0);
  });
  test('10. risk rises with off_track + overdue + stale', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, status: 'active', deadline: '2026-01-01', health: { status: 'off_track', confidence: 'low' }, createdAt: '2026-01-01T00:00:00.000Z' })], []);
    assert.ok(S.goalRiskScore(1, NOW) >= 60);
  });
  test('11. forecast reaches deadline when velocity sufficient', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, deadline: '2026-12-31' })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-21', 60)]);
    const f = S.goalForecast(1, NOW);
    assert.ok(f.velocity > 0); assert.equal(f.willMakeDeadline, true); assert.ok(f.daysToComplete > 0);
  });
  test('12. forecast stalled when velocity <= 0', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 })], [ci(1, '2026-07-01', 40), ci(1, '2026-07-11', 40)]);
    assert.equal(S.goalForecast(1, NOW).state, 'stalled');
  });
  test('13. forecast at_risk when too slow for deadline', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, deadline: '2026-07-30' })], [ci(1, '2026-06-01', 10), ci(1, '2026-07-01', 12)]);
    const f = S.goalForecast(1, NOW);
    assert.equal(f.willMakeDeadline, false); assert.equal(f.state, 'at_risk');
  });
  test('14. stall tendency detects stale + flat', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, createdAt: '2026-01-01T00:00:00.000Z' })], [ci(1, '2026-01-01', 20), ci(1, '2026-05-01', 20)]);
    assert.equal(S.goalStallTendency(1, NOW).stalled, true);
  });
});

describe('goalAnalytics / stats / insights', () => {
  test('15. goalAnalytics returns per-active-goal object', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 }), g({ id: 2, status: 'done' })], []);
    const A = S.goalAnalytics(NOW);
    assert.equal(A.length, 1); // yalnız aktif
    assert.ok('velocity' in A[0] && 'risk' in A[0] && 'forecast' in A[0] && 'momentum' in A[0]);
  });
  test('16. dashboard stats: risky/fastest/slowest/noCheckIn/upcoming/willSucceed/willDelay', () => {
    const S = createSandbox();
    setup(S, [
      g({ id: 1, deadline: '2026-12-31' }),
      g({ id: 2, deadline: '2026-07-29' }),
      g({ id: 3, deadline: '2026-01-01', health: { status: 'off_track', confidence: 'low' }, createdAt: '2026-01-01T00:00:00.000Z' })
    ], [ci(1, '2026-07-01', 10), ci(1, '2026-07-21', 70), ci(2, '2026-07-01', 5), ci(2, '2026-07-21', 8)]);
    const s = S.analyticsDashboardStats(NOW);
    assert.equal(s.total, 3);
    assert.ok(s.risky.length >= 1);
    assert.ok(s.fastest.length >= 1 && s.fastest[0].velocity > 0);
    assert.ok(s.noCheckIn.some(function (a) { return String(a.id) === '3'; }));
    assert.ok(s.upcoming.some(function (a) { return String(a.id) === '2'; }));
  });
  test('17. insights: no-progress / deadline / improving', () => {
    const S = createSandbox();
    setup(S, [g({ id: 1, createdAt: '2026-01-01T00:00:00.000Z' })], []); // hiç ilerleme
    assert.ok(S.goalInsights(null, NOW).some(function (i) { return i.type === 'no_progress'; }));
    const S2 = createSandbox(); setup(S2, [g({ id: 1 })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-11', 40), ci(1, '2026-07-21', 70)]);
    assert.ok(S2.goalInsights(1, NOW).some(function (i) { return i.type === 'improving'; }));
  });
  test('18. insight: deadline_near for due_soon window', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, deadline: '2026-08-10' })], [ci(1, '2026-07-20', 50)]);
    assert.ok(S.goalInsights(1, NOW).some(function (i) { return i.type === 'deadline_near'; }));
  });
});

describe('UX render (inline SVG + progBar only)', () => {
  test('19. dashboard html renders sections', () => {
    const S = createSandbox(); setup(S, [g({ id: 1, title: 'Hedef A' })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-21', 40)]);
    const h = S.analyticsDashboardHtml(NOW);
    assert.ok(/Analitik/.test(h) && /Riskli Hedefler/.test(h) && /Hedef A/.test(h));
  });
  test('20. empty state safe', () => {
    const S = createSandbox(); setup(S, [], []);
    assert.ok(/Aktif hedef yok/.test(S.analyticsDashboardHtml(NOW)));
  });
  test('21. sparkline is inline svg, no chart lib', () => {
    const S = createSandbox(); setup(S, [g({ id: 1 })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-11', 30)]);
    const sp = S.analyticsSparkline(1);
    assert.ok(/<svg/.test(sp) && /<path/.test(sp));
    assert.equal(/Chart|chart\.js|canvas/.test(sp), false);
  });
});

describe('Read-only + static guards', () => {
  test('22. never mutates D.goals/goalCheckIns/relations', () => {
    const S = createSandbox();
    setup(S, [g({ id: 1 }), g({ id: 2 })], [ci(1, '2026-07-01', 10), ci(1, '2026-07-11', 40)]);
    const bg = JSON.stringify(S.D.goals), bc = JSON.stringify(S.D.goalCheckIns), br = JSON.stringify(S.D.relations);
    S.goalAnalytics(NOW); S.analyticsDashboardStats(NOW); S.analyticsDashboardHtml(NOW); S.goalInsights(null, NOW);
    S.goalVelocity(1, NOW); S.goalRiskScore(1, NOW); S.goalForecast(1, NOW); S.goalStaleGoals(30, NOW);
    assert.equal(JSON.stringify(S.D.goals), bg); assert.equal(JSON.stringify(S.D.goalCheckIns), bc); assert.equal(JSON.stringify(S.D.relations), br);
  });
  test('G1. no production write primitives', () => {
    assert.equal(/\bsave\s*\(|writeLocal\s*\(|\bsnap\s*\(|queueCloudSave|commitMutation/.test(SRC), false);
  });
  test('G2. no source mutation of D.goals/goalCheckIns/relations', () => {
    assert.equal(/D\.goals\s*=|D\.goalCheckIns\s*=|D\.relations\s*=/.test(SRC), false);
  });
  test('G3. no new collection / no D.* assignment', () => {
    assert.equal(/D\.[a-zA-Z_]+\s*=[^=]/.test(SRC), false);
  });
  test('G4. no new sync/backup/relation/content engine', () => {
    assert.equal(/DIFF_SCHEMA|registerContentAdapter|registerRelationResolver|relAdd\s*\(|registerBackup/.test(SRC), false);
  });
  test('G5. no chart library, only inline svg + progBar', () => {
    assert.equal(/Chart\.js|chartjs|<canvas|d3\.|highcharts/i.test(SRC), false);
    assert.ok(/<svg/.test(SRC) && /progBar/.test(SRC));
  });
  test('G6. thin hooks wired (harness + route + nav + index)', () => {
    assert.ok(/11r-goal-analytics\.js/.test(fs.readFileSync(path.join(ROOT, 'tests', 'harness.js'), 'utf8')));
    assert.ok(/analytics:renderAnalytics/.test(fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8')));
    assert.ok(/analytics/.test(fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8')));
    assert.ok(/11r-goal-analytics/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
  });
  test('G7. mirrors byte-identical + module < 900', () => {
    ['11r-goal-analytics.js', '08-ui-core.js', '12-render-boot.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(SRC.split('\n').length < 900);
  });
});
