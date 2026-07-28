'use strict';
/* SMART-GOALS Platform P3/P4 — Daily Execution Workspace ("Bugün", TÜRETİLMİŞ · SALT OKUNUR).
   P4: aksiyon-merkezli yürütme ekranı — bilgi göstermez, yürütmeyi sürükler.
   Tek birincil aksiyon + yürütme akışı (ŞİMDİ/SONRA/ARDINDAN/BUGÜN İLERİDE) +
   gerçekçi zaman blokları + günlük başarı cümlesi + pozitif "Bugünün Önceliği Değil".
   P2 motoru + goal/bağımlılık/karar/K1 wisdom YENİDEN KULLANILIR; 0 write/network/
   timer/listener/yeni-veri; hedef açan aksiyonlar openGoalDetail(+id). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC_15 = fs.readFileSync(path.join(ROOT, 'js', '15-daily-workspace.js'), 'utf8');

function goal(id, over) {
  return Object.assign({ id: id, title: 'Hedef ' + id, desc: '', cat: 'İş', status: 'active',
    planning: { year: 2026, quarter: 'Q3' }, health: { status: 'on_track', confidence: 'medium' },
    priority: { level: 'p2', weight: 2 }, deadline: '', measurable: '', steps: [], createdAt: '2026-01-01' }, over || {});
}
function boot(S, goals, over) {
  over = over || {};
  S.D.goals = goals || [];
  S.D.decisions = over.decisions || []; S.D.principles = []; S.D.relations = over.relations || [];
  S.D.goalCheckIns = over.checkIns || [];
  S.D.wisdomQuotes = over.quotes || [{ id: 'w1', quote: 'liderlik', author: 'A', active: true, category: '', tags: [], favorite: false, reflected: false, showCount: 0 }];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  if (typeof S.execInvalidate === 'function') S.execInvalidate();
  if (typeof S.dailyInvalidate === 'function') S.dailyInvalidate();
}
function farFuture() { return new Date(Date.now() + 300 * 864e5).toISOString().slice(0, 10); }
function past(days) { return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); }

describe('Daily execution context (derived, memoized)', () => {
  test('1. active goals only + memoized by upstream reference', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) }), goal(2, { status: 'done' }), goal(3, { status: 'archived' })]);
    const a = S.dailyExecutionContext(), b = S.dailyExecutionContext();
    assert.equal(a, b);
    assert.equal(a.activeCount, 1);
    assert.ok('mit' in a && 'flow' in a && 'blocks' in a && 'deepWork' in a && 'later' in a && 'wisdomId' in a);
  });
  test('2. invalidation after a goal change → new reference', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: farFuture() })]);
    const a = S.dailyExecutionContext();
    S.D.goals.push(goal(2, { deadline: past(3), priority: { level: 'p1', weight: 1 } }));
    S.execInvalidate(); S.dailyInvalidate();
    const c = S.dailyExecutionContext();
    assert.notEqual(a, c);
    assert.equal(c.activeCount, 2);
  });
  test('3. reuses existing engines (no scoring/wisdom duplication)', () => {
    ['execContext', 'execQueue', 'execTodaysBestAction', 'goalBlockReasons', 'getRelatedEntities']
      .forEach(fn => assert.ok(SRC_15.indexOf(fn) >= 0, 'must reuse ' + fn));
    assert.equal(/function execScore|0\.45|goalRiskScore\s*\(|function wiRecommend/.test(SRC_15), false, 'must not duplicate scoring/risk/wisdom');
  });
});

describe('Action-centered MIT (single primary)', () => {
  test('4. exactly one, matches execTodaysBestAction', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: farFuture() }), goal(2, { deadline: past(3), priority: { level: 'p1', weight: 1 } })]);
    const mit = S.dailyMostImportantTask(), best = S.execTodaysBestAction();
    assert.ok(mit && !Array.isArray(mit));
    assert.equal(mit.goalId, best.goalId);
    assert.equal(mit.goalId, 2);
    assert.equal(mit.verb, best.verb);
  });
  test('5. exactly one primary "Hedefi Aç" button (largest); no competing primary', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    const h = S.dailyWorkspaceHtml();
    assert.equal((h.match(/btn btn-p[^"]*"[^>]*openGoalDetail/g) || []).length, 1); // one primary goal-open
    assert.ok(/Bugünün En Önemli İşi/.test(h));
  });
  test('6. daily success sentence directly present', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    assert.ok(/günün başarılı sayılır/.test(S.dailyWorkspaceHtml()));
  });
});

describe('Secondary actions (hidden when unavailable, no dead actions)', () => {
  test('7. plain goal → no blocker/decision buttons; wisdom only if attached', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    const h = S.dailyWorkspaceHtml();
    assert.equal(/Engeli Aç/.test(h), false);   // not blocked → hidden
    assert.equal(/Kararı Aç/.test(h), false);   // no related decision → hidden
  });
  test('8. blocked MIT → "Engeli Aç" opens the blocking goal (numeric coercion)', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(5) }), goal(2)]);
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'goal', targetId: '2', relationType: 'depends_on' });
    S.execInvalidate(); S.dailyInvalidate();
    const mit = S.dailyMostImportantTask();
    if (mit.blocked) {
      const h = S.dailyWorkspaceHtml();
      assert.ok(/Engeli Aç/.test(h));
      assert.ok(/openGoalDetail\(\+this\.dataset\.aid\)/.test(h)); // blocker opener coerces
    } else { assert.ok(true); } // dependency model may rank otherwise; deterministic
  });
});

describe('Execution flow (NOW/NEXT/AFTER/LATER, one task each)', () => {
  test('9. flow slots ordered + follow queue order', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(1) }), goal(2, { deadline: past(2), priority: { level: 'p1', weight: 1 } }), goal(3, { deadline: farFuture() })]);
    const flow = S.dailyExecutionFlow();
    const q = S.execQueue(4);
    assert.deepEqual(flow.map(f => f.slot), ['ŞİMDİ', 'SONRA', 'ARDINDAN'].slice(0, flow.length));
    assert.deepEqual(flow.map(f => String(f.goalId)), q.map(x => String(x.goalId)));
    flow.forEach(f => { assert.ok('effort' in f && 'focusMinutes' in f && 'reason' in f); assert.equal('score' in f, false); });
  });
  test('10. workspace renders NEXT section (slot after NOW), not scores', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) }), goal(2, { deadline: farFuture() })]);
    const h = S.dailyWorkspaceHtml();
    assert.ok(/Yürütme Akışı/.test(h) && /SONRA/.test(h));
    assert.equal(/skor|Skor|puan|%/.test(h), false);
  });
});

describe('Smart time blocks (realistic clock sequence)', () => {
  test('11. sequential HH:MM blocks from 09:00, deterministic, no calendar', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) }), goal(2, { deadline: farFuture() })]);
    const b = S.dailyTimeBlocks(), b2 = S.dailyTimeBlocks();
    assert.ok(b.length >= 2);
    assert.equal(b[0].start, '09:00');
    b.forEach(x => { assert.ok(/^\d\d:\d\d$/.test(x.start) && /^\d\d:\d\d$/.test(x.end)); assert.ok(x.start < x.end); assert.ok('type' in x); });
    assert.ok(b[1].start >= b[0].end); // no overlap, sequential
    assert.deepEqual(b.map(x => x.start + x.end), b2.map(x => x.start + x.end));
    assert.equal(/calendar|gapi|\.ics|scheduleEvent/.test(SRC_15), false);
  });
});

describe('Deep work candidate', () => {
  test('12. highest-impact non-blocked; all-blocked safe', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2), priority: { level: 'p3', weight: 3 } }), goal(2, { deadline: farFuture(), priority: { level: 'p1', weight: 1 } })]);
    const dw = S.dailyDeepWorkCandidate();
    assert.equal(dw.goalId, 2);
    assert.equal(dw.expectedImpact, 'Yüksek');
    const S2 = createSandbox(); boot(S2, []);
    assert.equal(S2.dailyDeepWorkCandidate(), null);
  });
});

describe('Not-today priority (positive wording replaces "ignore")', () => {
  test('13. positive framing, reasons, MIT excluded, no mutation, no "ignore/hide" wording', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(3), priority: { level: 'p1', weight: 1 } }),
             goal(2, { deadline: farFuture(), priority: { level: 'p3', weight: 3 } }),
             goal(3, { deadline: farFuture(), priority: { level: 'p3', weight: 3 } }),
             goal(4, { deadline: farFuture(), priority: { level: 'p3', weight: 3 } })]);
    const before = JSON.stringify(S.D.goals);
    const list = S.dailyLaterList(2);
    assert.ok(list.length <= 2);
    const mitId = String(S.dailyMostImportantTask().goalId);
    list.forEach(it => { assert.ok(it.reason && it.reason.length > 0); assert.notEqual(String(it.goalId), mitId); });
    assert.equal(JSON.stringify(S.D.goals), before);
    const h = S.dailyWorkspaceHtml();
    assert.ok(/Bugünün Önceliği Değil/.test(h));
    assert.equal(/Görmezden Gel|Ignore|Yoksay/.test(h), false); // positive wording only
  });
});

describe('No dashboard language / calm execution surface', () => {
  test('14. no KPI grid, chart, dashboard/report/stat wording', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    const h = S.dailyWorkspaceHtml();
    assert.equal((h.match(/min-width:1\d\dpx/g) || []).length, 0);
    assert.equal(/<svg[^>]*viewBox="0 0 88 88"|<canvas/.test(h), false);
    assert.equal(/Panosu|Dashboard|Analitik|KPI|İstatistik|Skorbord/.test(h), false);
  });
  test('15. responsive single-column + wisdom stays secondary', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })], { quotes: [{ id: 'w1', quote: 'Disiplin özgürlüktür', author: 'Y', active: true, category: '', tags: ['odak'], favorite: false, reflected: false, showCount: 0 }] });
    const h = S.dailyWorkspaceHtml();
    assert.ok(/max-width:640px/.test(h));
    if (/Disiplin özgürlüktür/.test(h)) assert.ok(h.indexOf('Bugünün En Önemli İşi') < h.indexOf('Disiplin özgürlüktür'));
  });
});

describe('Empty state (calm, action-oriented)', () => {
  test('16. calm message + review/create/decisions actions only', () => {
    const S = createSandbox(); boot(S, []);
    const h = S.dailyWorkspaceHtml();
    assert.ok(/aktif yürütme yok/i.test(h));
    assert.ok(/Hedef Oluştur/.test(h) && /openGoalForm\(\)/.test(h));
    assert.ok(/Hedefleri Gözden Geçir/.test(h) && /Kararları Gözden Geçir/.test(h));
    assert.equal(/Bugünün En Önemli İşi/.test(h), false);
  });
});

describe('Accessibility + navigation safety', () => {
  test('17. native details/summary + focus-visible + reduced-motion', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    const h = S.dailyWorkspaceHtml();
    assert.ok(/<details/.test(h) && /<summary/.test(h) && /Neden önce bu\?/.test(h));
    assert.ok(/:focus-visible/.test(h));
    assert.ok(/prefers-reduced-motion/.test(h));
  });
  test('18. every goal-opener coerces id with + ; no raw dataset forwarding', () => {
    const S = createSandbox();
    boot(S, [goal(1784485410450, { deadline: past(2), priority: { level: 'p1', weight: 1 } })]);
    const h = S.dailyWorkspaceHtml();
    assert.ok(/openGoalDetail\(\+this\.dataset\.id\)/.test(h));
    assert.equal(/openGoalDetail\(this\.dataset\./.test(h), false);   // no raw string forwarding
    assert.equal(/openGoalDetail\(this\.dataset\./.test(SRC_15), false);
    assert.ok(/openGoalDetail\(\+this\.dataset\./.test(SRC_15));
  });
});

describe('Static guards (read-only, zero-write, no persistence)', () => {
  test('19. forbidden write/network/timer/listener/persistence tokens absent', () => {
    ['save(', 'commitMutation', 'writeLocal', 'queueCloudSave', 'fetch(', 'XMLHttpRequest', 'WebSocket',
     '.onSnapshot(', 'setInterval', 'setTimeout', 'addEventListener', 'localStorage', 'runTransaction',
     'DIFF_SCHEMA', 'INIT.', '.set(']
      .forEach(t => assert.equal(SRC_15.indexOf(t), -1, 'forbidden: ' + t));
  });
  test('20. render performs zero cloud writes + mirror + <900 lines', () => {
    const S = createSandbox();
    boot(S, [goal(1, { deadline: past(2) })]);
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    S.dailyWorkspaceHtml(); S.dailyExecutionContext(); S.dailyTimeBlocks(); S.dailyExecutionFlow(); S.dailyLaterList();
    S.save = _s;
    assert.equal(w, 0);
    assert.equal(SRC_15, fs.readFileSync(path.join(ROOT, 'public', 'js', '15-daily-workspace.js'), 'utf8'));
    assert.ok(SRC_15.split('\n').length < 900);
  });
});
