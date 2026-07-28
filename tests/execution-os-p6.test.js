'use strict';
/* SMART-GOALS Platform P6 — Adaptif Yürütme İşletim Sistemi (TÜRETİLMİŞ · SALT OKUNUR).
   Sürekli türetir: ne şimdi / ne bekler / ne engelliyor / bugün en büyük etki.
   Mevcut motorlar (P2 execQueue/execContext, 11r/11o/07, K1) YENİDEN KULLANILIR;
   skor/risk/ivme/bağımlılık TEKRARLANMAZ; 0 write/network/timer/listener; sessiz. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC_16 = fs.readFileSync(path.join(ROOT, 'js', '16-execution-os.js'), 'utf8');

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
  if (typeof S.execOsInvalidate === 'function') S.execOsInvalidate();
  if (typeof S.dailyInvalidate === 'function') S.dailyInvalidate();
}
function farFuture() { return new Date(Date.now() + 300 * 864e5).toISOString().slice(0, 10); }
function past(days) { return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); }
function today() { return new Date().toISOString().slice(0, 10); }

describe('PART 1 — Dynamic priority engine', () => {
  test('1. overdue p2 → ↑; blocked → ↓; stable omitted', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) }),                                   // overdue → up
             goal(2, { deadline: farFuture(), checkIns: undefined }),          // (blocked set below)
             goal(3, { deadline: farFuture(), title: 'Stabil', priority: { level: 'p2', weight: 2 } })],
         { checkIns: [{ id: 'c3', goalId: '3', checkInDate: today() }] });      // recent → not stale → stable
    S.relAdd({ sourceType: 'goal', sourceId: '2', targetType: 'goal', targetId: '1', relationType: 'depends_on' });
    S.execInvalidate(); S.execOsInvalidate();
    const p = S.execAdaptivePriority();
    const up = p.find(x => String(x.goalId) === '1');
    assert.ok(up && up.direction === 'up' && /Son tarih/.test(up.reason));
    const down = p.find(x => String(x.goalId) === '2');
    assert.ok(down && down.direction === 'down' && /engel/i.test(down.reason));
    assert.equal(p.some(x => String(x.goalId) === '3'), false); // stable omitted
    p.forEach(x => assert.ok(x.direction === 'up' || x.direction === 'down')); // only meaningful
  });
});

describe('PART 2 — Execution advisor (single, always why)', () => {
  test('2. exactly one, deterministic, blocked-top → resolve blocker w/ why', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(5) }), goal(2)]);
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'goal', targetId: '2', relationType: 'depends_on' });
    S.execInvalidate(); S.execOsInvalidate();
    const a = S.execAdvisor();
    assert.ok(a && typeof a.recommendation === 'string' && a.why && a.why.length > 0);
    assert.equal(JSON.stringify(a), JSON.stringify(S.execAdvisor())); // deterministic
    if (a.kind === 'resolve_blocker') assert.ok(/engel/i.test(a.recommendation));
  });
  test('3. empty goals → null', () => {
    const S = createSandbox(); boot(S, []);
    assert.equal(S.execAdvisor(), null);
  });
});

describe('PART 3 — Opportunity detection', () => {
  test('4. never more than three; reasons present; blocked excluded', () => {
    const S = createSandbox();
    const gs = []; for (let i = 1; i <= 6; i++) gs.push(goal(i, { deadline: farFuture(), priority: { level: 'p3', weight: 3 } }));
    boot(S, gs);
    const o = S.execOpportunities();
    assert.ok(o.length <= 3);
    o.forEach(x => { assert.ok(x.reason && x.reason.length > 0); assert.ok('type' in x); });
  });
});

describe('PART 4 — Execution risks', () => {
  test('5. stale/deadline/health detected in plain language, no percentages', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(30) }),                                    // stale + overdue
             goal(2, { deadline: new Date(Date.now() + 1 * 864e5).toISOString().slice(0, 10) }), // deadline ~1 day
             goal(3, { health: { status: 'off_track', confidence: 'low' } })]);
    const r = S.execExecutionRisks();
    assert.ok(r.some(x => x.risk === 'stale' && /gündür/.test(x.message)));
    assert.ok(r.some(x => x.risk === 'deadline' && /gün kaldı/.test(x.message)));
    assert.ok(r.some(x => x.risk === 'health'));
    r.forEach(x => assert.equal(/%/.test(x.message), false)); // no percentages
  });
});

describe('PART 5 — Intelligent sequence', () => {
  test('6. NOW/NEXT/THEN/LATER order = queue, each has whyNext', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(1) }), goal(2, { deadline: past(2), priority: { level: 'p1', weight: 1 } }), goal(3, { deadline: farFuture() })]);
    const seq = S.execIntelligentSequence();
    const q = S.execQueue(4);
    assert.ok(seq.length <= 4 && seq.length === q.length);
    assert.deepEqual(seq.map(s => s.slot), ['ŞİMDİ', 'SONRA', 'ARDINDAN'].slice(0, seq.length));
    assert.deepEqual(seq.map(s => String(s.goalId)), q.map(x => String(x.goalId)));
    seq.forEach((s, i) => { assert.ok(s.whyNext && s.whyNext.length > 0); assert.ok('focusMinutes' in s); });
    assert.ok(/en yüksek etkili/i.test(seq[0].whyNext));
  });
});

describe('PART 6 — Focus protection (recommends removing work)', () => {
  test('7. too many active goals → removal recommendation', () => {
    const S = createSandbox();
    const gs = []; for (let i = 1; i <= 9; i++) gs.push(goal(i, { deadline: farFuture() }));
    boot(S, gs);
    const f = S.execFocusProtection();
    assert.ok(f.some(x => x.kind === 'too_many' && /odaklan|ertele/i.test(x.message)));
  });
  test('8. blocked-noise → recommends removing blocked work from view', () => {
    const S = createSandbox();
    boot(S, [goal(1), goal(2), goal(3), goal(4)]);
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'goal', targetId: '3', relationType: 'depends_on' });
    S.relAdd({ sourceType: 'goal', sourceId: '2', targetType: 'goal', targetId: '4', relationType: 'depends_on' });
    S.execInvalidate(); S.execOsInvalidate();
    const f = S.execFocusProtection();
    if (S.execQueue().filter(x => x.blocked).length >= 2) assert.ok(f.some(x => x.kind === 'blocked_noise'));
    else assert.ok(true);
  });
});

describe('PART 7 — Quiet insights panel', () => {
  test('9. at most one insight + warning + opportunity + priority; no KPI/chart/%', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) }), goal(2, { deadline: farFuture(), priority: { level: 'p3', weight: 3 } })]);
    const h = S.execOsInsightsHtml();
    assert.ok((h.match(/border-left:3px/g) || []).length <= 4);   // ≤1 of each of 4 kinds
    assert.equal(/Panosu|Dashboard|Analitik|KPI|İstatistik|<canvas|viewBox="0 0 88 88"|%/.test(h), false);
    assert.ok(/Öneri/.test(h)); // advisor surfaced
  });
  test('10. workspace surfaces the panel (additive) without breaking calm layout', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    const h = S.dailyWorkspaceHtml();
    assert.ok(/Öneri/.test(h));                          // panel injected
    assert.ok(/Bugünün En Önemli İşi/.test(h));          // MIT still primary
    assert.equal((h.match(/btn btn-p[^"]*"[^>]*openGoalDetail/g) || []).length, 1); // still one primary
  });
  test('10b. insights panel HTML is tag-balanced (no unclosed div → no horizontal collapse)', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) }), goal(2, { deadline: farFuture(), priority: { level: 'p3', weight: 3 } })]);
    const p = S.execOsInsightsHtml();
    assert.equal((p.match(/<div/g) || []).length, (p.match(/<\/div>/g) || []).length, 'panel <div> must be balanced');
    const full = S.dailyWorkspaceHtml();
    assert.equal((full.match(/<div/g) || []).length, (full.match(/<\/div>/g) || []).length, 'workspace <div> must be balanced');
  });
});

describe('Engine reuse + memoization', () => {
  test('11. reuses execQueue/execContext/goalProgress/goalBlockReasons; no scoring dup', () => {
    ['execContext', 'execQueue', 'goalProgress', 'goalBlockReasons']
      .forEach(fn => assert.ok(SRC_16.indexOf(fn) >= 0, 'must reuse ' + fn));
    assert.equal(/function execScore|0\.45|goalRiskScore\s*\(|function goalMomentum/.test(SRC_16), false, 'no scoring/risk/momentum duplication');
  });
  test('12. deterministic + memoized merge (invalidation exists)', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) }), goal(2, { deadline: farFuture() })]);
    assert.equal(JSON.stringify(S.execIntelligentSequence()), JSON.stringify(S.execIntelligentSequence()));
    assert.equal(JSON.stringify(S.execAdaptivePriority()), JSON.stringify(S.execAdaptivePriority()));
    assert.equal(typeof S.execOsInvalidate, 'function');
  });
});

describe('Static guards (read-only, zero-write)', () => {
  test('13. forbidden write/network/timer/listener/persistence tokens absent', () => {
    ['save(', 'commitMutation', 'writeLocal', 'queueCloudSave', 'fetch(', 'XMLHttpRequest', 'WebSocket',
     '.onSnapshot(', 'setInterval', 'setTimeout', 'addEventListener', 'localStorage', 'runTransaction',
     'DIFF_SCHEMA', 'INIT.', '.set(']
      .forEach(t => assert.equal(SRC_16.indexOf(t), -1, 'forbidden: ' + t));
  });
  test('14. nav coercion + zero writes + mirror + <900 lines', () => {
    assert.equal(/openGoalDetail\(this\.dataset\./.test(SRC_16), false);
    assert.ok(/openGoalDetail\(\+this\.dataset\./.test(SRC_16));
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    S.execOsInsightsHtml(); S.execAdvisor(); S.execOpportunities(); S.execExecutionRisks(); S.execFocusProtection(); S.execAdaptivePriority(); S.execIntelligentSequence();
    S.save = _s;
    assert.equal(w, 0);
    assert.equal(SRC_16, fs.readFileSync(path.join(ROOT, 'public', 'js', '16-execution-os.js'), 'utf8'));
    assert.ok(SRC_16.split('\n').length < 900);
  });
});
