'use strict';
/* SMART-GOALS Dashboard P1 — TAMAMEN TÜRETİLMİŞ (yeni veri modeli/write YOK).
   Aggregatörler saf; mevcut reader'lardan (smartScore/qualityIndex/goalProgress/goalDueState/
   goalHealth/Confidence/Priority/Year/Quarter + goalCheckInTrend) türetir. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const DASH_SRC = fs.readFileSync(path.join(ROOT, 'js', '11n-goals-dashboard.js'), 'utf8');
const GOALS_SRC = fs.readFileSync(path.join(ROOT, 'js', '09-goals.js'), 'utf8');

function G(over) {
  return Object.assign({ id: 1, title: 'G', cat: 'İş', steps: [{ t: 'a', done: true }, { t: 'b', done: false }],
    status: 'active', deadline: '2027-01-01', health: { status: 'on_track', confidence: 'high' },
    priority: { level: 'p2', weight: 2 }, planning: { year: 2026, quarter: 'Q1' } }, over || {});
}
function seed(S, goals, checkins) { S.D.goals = goals || []; S.D.goalCheckIns = checkins || []; S.D.relations = []; }

describe('Aggregation', () => {
  test('1. totals/active/done', () => {
    const S = createSandbox(); seed(S, [G(), G({ id: 2, status: 'done' }), G({ id: 3 })]);
    const s = S.goalsDashboardStats(S.D.goals);
    assert.equal(s.total, 3); assert.equal(s.active, 2); assert.equal(s.done, 1);
  });
  test('2. overdue + dueSoon by goalDueState', () => {
    const S = createSandbox();
    seed(S, [G({ id: 1, deadline: '2020-01-01' }), G({ id: 2, deadline: '2099-01-01' }), G({ id: 3, deadline: '' })]);
    const s = S.goalsDashboardStats(S.D.goals);
    assert.equal(s.overdue, 1); // 2020 past
    assert.ok(s.dueSoon >= 0);
  });
  test('3. atRisk = at_risk|off_track', () => {
    const S = createSandbox();
    seed(S, [G({ id: 1, health: { status: 'at_risk', confidence: 'low' } }), G({ id: 2, health: { status: 'off_track', confidence: 'low' } }), G({ id: 3, health: { status: 'on_track', confidence: 'high' } })]);
    const s = S.goalsDashboardStats(S.D.goals); assert.equal(s.atRisk, 2);
  });
  test('4. priority/health/confidence breakdowns', () => {
    const S = createSandbox();
    seed(S, [G({ id: 1, priority: { level: 'p1' }, health: { status: 'on_track', confidence: 'high' } }),
      G({ id: 2, priority: { level: 'p1' }, health: { status: 'paused', confidence: 'low' } }),
      G({ id: 3, priority: { level: 'p3' }, health: { status: 'on_track', confidence: 'medium' } })]);
    const s = S.goalsDashboardStats(S.D.goals);
    assert.equal(s.priority.p1, 2); assert.equal(s.priority.p3, 1);
    assert.equal(s.health.on_track, 2); assert.equal(s.health.paused, 1);
    assert.equal(s.confidence.high, 1); assert.equal(s.confidence.low, 1); assert.equal(s.confidence.medium, 1);
  });
  test('5. averages (smart/quality/progress) present & sane', () => {
    const S = createSandbox(); seed(S, [G(), G({ id: 2 })]);
    const s = S.goalsDashboardStats(S.D.goals);
    assert.ok(s.avg.progress >= 0 && s.avg.progress <= 100);
    assert.ok(typeof s.avg.smart === 'number'); assert.ok(s.avg.quality >= 0 && s.avg.quality <= 100);
  });
  test('6. byCategory aggregation', () => {
    const S = createSandbox();
    seed(S, [G({ id: 1, cat: 'İş' }), G({ id: 2, cat: 'İş' }), G({ id: 3, cat: 'Sağlık' })]);
    const s = S.goalsDashboardStats(S.D.goals);
    const isc = s.byCategory.find(function (c) { return c.cat === 'İş'; });
    assert.equal(isc.count, 2); assert.ok(isc.avgProgress >= 0 && isc.avgProgress <= 100);
    assert.equal(s.byCategory.find(function (c) { return c.cat === 'Sağlık'; }).count, 1);
  });
  test('7. check-in trend summary', () => {
    const S = createSandbox();
    seed(S, [G({ id: 1 }), G({ id: 2 })], [
      { id: 'ci-1', goalId: '1', checkInDate: '2026-07-01', metricValue: 10, createdAt: 'a' },
      { id: 'ci-2', goalId: '1', checkInDate: '2026-07-05', metricValue: 20, createdAt: 'b' }]);
    const s = S.goalsDashboardStats(S.D.goals);
    assert.equal(s.checkInTrend.improving, 1); // goal1 improving
    assert.equal(s.checkInTrend.none, 1); // goal2 no checkins
  });
});

describe('Filters', () => {
  function set(S) { seed(S, [
    G({ id: 1, planning: { year: 2026, quarter: 'Q1' }, cat: 'İş', status: 'active', health: { status: 'on_track', confidence: 'high' }, priority: { level: 'p1' } }),
    G({ id: 2, planning: { year: 2027, quarter: 'Q2' }, cat: 'Sağlık', status: 'done', health: { status: 'at_risk', confidence: 'low' }, priority: { level: 'p2' } })]); return S; }
  test('8. year filter', () => { const S = set(createSandbox()); assert.equal(S.goalsDashboardStats(S.D.goals, { year: 2026 }).total, 1); });
  test('9. quarter filter', () => { const S = set(createSandbox()); assert.equal(S.goalsDashboardStats(S.D.goals, { quarter: 'Q2' }).total, 1); });
  test('10. category filter', () => { const S = set(createSandbox()); assert.equal(S.goalsDashboardStats(S.D.goals, { cat: 'İş' }).total, 1); });
  test('11. status filter', () => { const S = set(createSandbox()); assert.equal(S.goalsDashboardStats(S.D.goals, { status: 'done' }).total, 1); });
  test('12. health filter', () => { const S = set(createSandbox()); assert.equal(S.goalsDashboardStats(S.D.goals, { health: 'at_risk' }).total, 1); });
  test('13. priority filter', () => { const S = set(createSandbox()); assert.equal(S.goalsDashboardStats(S.D.goals, { priority: 'p1' }).total, 1); });
});

describe('Empty & legacy safety', () => {
  test('14. empty goals → zeroed stats, no throw', () => {
    const S = createSandbox(); seed(S, []);
    assert.doesNotThrow(function () { const s = S.goalsDashboardStats(S.D.goals); assert.equal(s.total, 0); assert.equal(s.avg.progress, 0); assert.equal(s.byCategory.length, 0); });
  });
  test('15. legacy goal (no planning/health/priority) → dual-read defaults', () => {
    const S = createSandbox();
    seed(S, [{ id: 9, title: 'L', cat: 'Gelişim', steps: [], status: 'active', quarter: 'Q3', deadline: '2026-12-31' }]);
    const s = S.goalsDashboardStats(S.D.goals);
    assert.equal(s.total, 1); assert.equal(s.health.on_track, 1); assert.equal(s.confidence.medium, 1); assert.equal(s.priority.p2, 1);
  });
  test('16. dashboard html renders empty state', () => {
    const S = createSandbox(); seed(S, []);
    const h = S.goalsDashboardHtml();
    assert.ok(/Hedef Panosu|Pano/.test(h));
    assert.ok(/Toplam/.test(h));
  });
  test('17. dashboard html renders cards + no wide fixed px', () => {
    const S = createSandbox(); seed(S, [G(), G({ id: 2, status: 'done' })]);
    const h = S.goalsDashboardHtml();
    assert.ok(/Aktif/.test(h) && /Tamamlanan/.test(h) && /Geciken/.test(h) && /Riskli/.test(h));
    assert.equal(/width:\s*[5-9]\d\dpx/.test(h), false);
  });
});

describe('Static guards & regression', () => {
  test('G1. no writes / no new persisted collection', () => {
    assert.equal(/D\.goalDashboard|goal\.dashboard|function\s+save\b|snap\(\)/.test(DASH_SRC), false);
  });
  test('G2. derived-only: does not mutate D.goals / D.goalCheckIns / D.relations', () => {
    assert.equal(/D\.goals\s*=|D\.goalCheckIns\s*=|D\.relations\s*=/.test(DASH_SRC), false);
  });
  test('G3. does not touch backup/sync/io engines', () => {
    assert.equal(/DIFF_SCHEMA|queueCloudSave|commitMutation|goalBuildJsonText|registerRelationResolver/.test(DASH_SRC), false);
  });
  test('G4. route wired', () => { assert.ok(/renderGoalsDashboard/.test(fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8'))); });
  test('G5. nav item present', () => { assert.ok(/goalsdash/.test(fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8'))); });
  test('G6. mirrors byte-identical', () => {
    ['11n-goals-dashboard.js', '08-ui-core.js', '12-render-boot.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
  });
  test('G7. module < 900 lines', () => { assert.ok(DASH_SRC.split('\n').length < 900); });
  test('G8. aggregation causes zero mutation', () => {
    const S = createSandbox(); seed(S, [G(), G({ id: 2 })], [{ id: 'ci-1', goalId: '1', checkInDate: '2026-07-01', createdAt: 'a' }]);
    const gb = JSON.stringify(S.D.goals), cb = JSON.stringify(S.D.goalCheckIns), rb = JSON.stringify(S.D.relations);
    S.goalsDashboardStats(S.D.goals); S.goalsDashboardHtml();
    assert.equal(JSON.stringify(S.D.goals), gb); assert.equal(JSON.stringify(S.D.goalCheckIns), cb); assert.equal(JSON.stringify(S.D.relations), rb);
  });
  test('G9. 09-goals unchanged except wiring (no dashboard aggregation logic embedded)', () => {
    assert.equal(/goalsDashboardStats/.test(GOALS_SRC), false);
  });
});
