'use strict';
/* SMART-GOALS Phase 4 P1 — Goal Dependencies (türetilmiş katman, mevcut D.relations üzerine).
   Yeni ilişki motoru/koleksiyon YOK; goal'a dependency alanı GÖMÜLMEZ. Cycle/self/dup/deleted
   engellenir; critical path saf türetim. Tüm ağır mantık 11o-goal-dependencies.js (harness-yüklü). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const DEP_SRC = fs.readFileSync(path.join(ROOT, 'js', '11o-goal-dependencies.js'), 'utf8');
const GOALS_SRC = fs.readFileSync(path.join(ROOT, 'js', '09-goals.js'), 'utf8');

function goals(S, n) { S.D.goals = []; for (let i = 1; i <= (n || 3); i++) S.D.goals.push({ id: i, title: 'G' + i, cat: 'İş', steps: [], status: 'active' }); S.D.relations = []; S.save = function () { S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; }; }
function rel(S, a, b, t) { S.relAdd({ sourceType: 'goal', sourceId: String(a), targetType: 'goal', targetId: String(b), relationType: t }); }

describe('Derived queries', () => {
  test('1. waitingFor / blocking / supporting / blockedBy', () => {
    const S = createSandbox(); goals(S, 4);
    rel(S, 1, 2, 'depends_on'); // 1 waits for 2
    rel(S, 1, 3, 'blocks');     // 1 blocks 3
    rel(S, 1, 4, 'supports');   // 1 supports 4
    rel(S, 5 - 5 + 2, 1, 'blocks'); // goal2 blocks 1 → 1 blockedBy 2 (incoming blocks)
    const d = S.goalDependencies(1);
    assert.equal(d.waitingFor.length, 1); assert.equal(String(d.waitingFor[0].id), '2');
    assert.equal(d.blocking.length, 1); assert.equal(String(d.blocking[0].id), '3');
    assert.equal(d.supporting.length, 1); assert.equal(String(d.supporting[0].id), '4');
    assert.ok(d.blockedBy.some(function (x) { return String(x.id) === '2'; })); // incoming blocks OR undone depends_on
    assert.ok(d.count >= 3);
  });
  test('2. dependency count', () => {
    const S = createSandbox(); goals(S, 3); rel(S, 1, 2, 'depends_on'); rel(S, 1, 3, 'blocks');
    assert.equal(S.goalDependencies(1).count, 2);
  });
});

describe('Validation', () => {
  test('3. self dependency rejected', () => {
    const S = createSandbox(); goals(S, 2);
    assert.equal(S.canAddGoalDependency(1, 1, 'depends_on').ok, false);
  });
  test('4. invalid type rejected', () => {
    const S = createSandbox(); goals(S, 2);
    assert.equal(S.canAddGoalDependency(1, 2, 'related_to').ok, false);
    assert.equal(S.canAddGoalDependency(1, 2, 'bogus').ok, false);
  });
  test('5. deleted/missing target rejected', () => {
    const S = createSandbox(); goals(S, 2);
    assert.equal(S.canAddGoalDependency(1, 999, 'depends_on').ok, false);
  });
  test('6. duplicate rejected', () => {
    const S = createSandbox(); goals(S, 2); rel(S, 1, 2, 'depends_on');
    assert.equal(S.canAddGoalDependency(1, 2, 'depends_on').ok, false);
  });
  test('7. circular dependency rejected (A→B→C→A)', () => {
    const S = createSandbox(); goals(S, 3);
    rel(S, 1, 2, 'depends_on'); rel(S, 2, 3, 'depends_on');
    assert.equal(S.canAddGoalDependency(3, 1, 'depends_on').ok, false); // 3→1 closes cycle
    assert.ok(/CIRC/i.test(S.canAddGoalDependency(3, 1, 'depends_on').error));
  });
  test('8. blocks-type circular rejected', () => {
    const S = createSandbox(); goals(S, 2);
    rel(S, 1, 2, 'depends_on'); // 1 waits for 2
    // 1 blocks 2 → 2 waits for 1 → cycle 1→2→1
    assert.equal(S.canAddGoalDependency(1, 2, 'blocks').ok, false);
  });
  test('9. valid non-cyclic accepted', () => {
    const S = createSandbox(); goals(S, 3); rel(S, 1, 2, 'depends_on');
    assert.equal(S.canAddGoalDependency(2, 3, 'depends_on').ok, true);
  });
  test('10. cycle detection is bounded on pre-existing cyclic data (no hang)', () => {
    const S = createSandbox(); goals(S, 3);
    // force a cycle directly into relations (bypassing guard) then ensure queries/path don't hang
    rel(S, 1, 2, 'depends_on'); rel(S, 2, 3, 'depends_on'); rel(S, 3, 1, 'depends_on');
    assert.doesNotThrow(function () { S.goalDependencies(1); S.criticalPath(); S.dependencyDepth(1); S.blockedGoalCount(); });
  });
});

describe('Add / Remove', () => {
  test('11. addGoalDependency → relAdd + one save; goal byte-identical', () => {
    const S = createSandbox(); goals(S, 2);
    const g1 = JSON.stringify(S.D.goals[0]);
    let saves = 0; S.save = function () { saves++; S.CLOUD.revision++; };
    const res = S.addGoalDependency(1, 2, 'depends_on');
    assert.equal(res.ok, true);
    assert.equal(S.D.relations.length, 1);
    assert.equal(S.D.relations[0].relationType, 'depends_on');
    assert.equal(JSON.stringify(S.D.goals[0]), g1); // goal untouched
    assert.equal(saves, 1);
  });
  test('12. addGoalDependency rejects cycle (no relation created)', () => {
    const S = createSandbox(); goals(S, 3); rel(S, 1, 2, 'depends_on'); rel(S, 2, 3, 'depends_on');
    const before = S.D.relations.length;
    const res = S.addGoalDependency(3, 1, 'depends_on');
    assert.equal(res.ok, false); assert.equal(S.D.relations.length, before);
  });
  test('13. removeGoalDependency → relDelete only; goals unchanged', () => {
    const S = createSandbox(); goals(S, 2); const r = S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'goal', targetId: '2', relationType: 'depends_on' });
    const gs = JSON.stringify(S.D.goals);
    S.removeGoalDependency(r.relation.id, 1);
    assert.equal(S.D.relations.length, 0); assert.equal(JSON.stringify(S.D.goals), gs);
  });
});

describe('Critical path & blocking', () => {
  test('14. criticalPath longest chain', () => {
    const S = createSandbox(); goals(S, 4);
    rel(S, 1, 2, 'depends_on'); rel(S, 2, 3, 'depends_on'); rel(S, 3, 4, 'depends_on');
    const cp = S.criticalPath();
    assert.ok(cp.length >= 4);
  });
  test('15. dependencyDepth', () => {
    const S = createSandbox(); goals(S, 3); rel(S, 1, 2, 'depends_on'); rel(S, 2, 3, 'depends_on');
    assert.equal(S.dependencyDepth(1), 2);
    assert.equal(S.dependencyDepth(3), 0);
  });
  test('16. blocked completion: goal waiting on undone goal is blocked, reason shown', () => {
    const S = createSandbox(); goals(S, 2); rel(S, 1, 2, 'depends_on'); // 1 waits for 2 (active)
    assert.equal(S.goalIsBlocked(1), true);
    const reasons = S.goalBlockReasons(1);
    assert.ok(reasons.length >= 1);
    // once goal2 done → not blocked by it
    S.D.goals[1].status = 'done';
    assert.equal(S.goalIsBlocked(1), false);
  });
  test('17. blockedGoalCount', () => {
    const S = createSandbox(); goals(S, 3); rel(S, 1, 2, 'depends_on'); rel(S, 3, 2, 'depends_on');
    assert.equal(S.blockedGoalCount(), 2); // 1 and 3 wait on active 2
  });
});

describe('Badges & filters', () => {
  test('18. badge reflects hasDeps / blocked', () => {
    const S = createSandbox(); goals(S, 2); rel(S, 1, 2, 'depends_on');
    const b = S.goalDependencyBadge(S.D.goals[0]);
    assert.ok(/Bağımlı|Engelli|Bağımlılık/.test(b)); // text present (not color-only)
    assert.equal(S.goalDependencyBadge(S.D.goals[1]) === '' || !/Engelli/.test(S.goalDependencyBadge(S.D.goals[1])), true);
  });
  test('19. filters: blocked / blockingOthers / hasDeps / independent', () => {
    const S = createSandbox(); goals(S, 3); rel(S, 1, 2, 'depends_on'); // 1 waits 2; 3 independent
    assert.equal(S.goalMatchesDependencyFilter(1, 'blocked'), true);
    assert.equal(S.goalMatchesDependencyFilter(2, 'blockingOthers'), true); // 2 is depended-on by 1
    assert.equal(S.goalMatchesDependencyFilter(1, 'hasDeps'), true);
    assert.equal(S.goalMatchesDependencyFilter(3, 'independent'), true);
    assert.equal(S.goalMatchesDependencyFilter(1, 'independent'), false);
  });
});

describe('UX', () => {
  test('20. panel renders sub-sections + empty state + add wiring', () => {
    const S = createSandbox(); goals(S, 3); rel(S, 1, 2, 'depends_on'); rel(S, 1, 3, 'blocks');
    const h = S.goalDependencyPanelHtml(1);
    assert.ok(/Bağımlılıklar/.test(h));
    assert.ok(/Beklediği/.test(h) && /Engellediği/.test(h) && /Desteklediği/.test(h) && /Engelleyenler/.test(h));
    assert.ok(/G2/.test(h) && /G3/.test(h));
    assert.ok(/removeGoalDependency/.test(h) && /openGoalDependencyPicker|addGoalDependency|Bağımlılık Ekle/.test(h));
    assert.equal(/width:\s*[5-9]\d\dpx/.test(h), false);
  });
  test('21. panel empty state', () => {
    const S = createSandbox(); goals(S, 1);
    assert.ok(/Bağımlılık yok|Henüz/.test(S.goalDependencyPanelHtml(1)));
  });
});

describe('Regression & static guards', () => {
  test('22. queries cause zero mutation', () => {
    const S = createSandbox(); goals(S, 3); rel(S, 1, 2, 'depends_on');
    const g = JSON.stringify(S.D.goals), r = JSON.stringify(S.D.relations);
    S.goalDependencies(1); S.criticalPath(); S.goalDependencyPanelHtml(1); S.blockedGoalCount();
    assert.equal(JSON.stringify(S.D.goals), g); assert.equal(JSON.stringify(S.D.relations), r);
  });
  test('23. G1 no goal.dependencies embed / no second collection', () => {
    assert.equal(/goal\.dependencies\s*=|D\.goalDeps\b|D\.dependencies\b/.test(DEP_SRC + GOALS_SRC), false);
  });
  test('24. G2 no second relation/sync/save engine', () => {
    assert.equal(/function\s+relAdd\b|function\s+relDelete\b|REL_TYPES\s*=|function\s+(save|queueCloudSave|commitMutation)\b/.test(DEP_SRC), false);
  });
  test('25. G3 uses existing relation engine (relAdd/relDelete/getOutgoingRelations)', () => {
    assert.ok(/relAdd\(/.test(DEP_SRC) && /relDelete\(/.test(DEP_SRC) && /getOutgoingRelations|getIncomingRelations/.test(DEP_SRC));
  });
  test('26. mirrors byte-identical (11o/09/08) + module < 900', () => {
    ['11o-goal-dependencies.js', '09-goals.js', '08-ui-core.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(DEP_SRC.split('\n').length < 900);
  });
  test('27. openGoalDetail wires dependency panel', () => { assert.ok(/goalDependencyPanelHtml/.test(GOALS_SRC)); });
});
