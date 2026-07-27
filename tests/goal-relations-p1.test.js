'use strict';
/* SMART-GOALS Phase 2 P1 — Goals ↔ Relations.
   ONE relations engine (D.relations via 11h). Goal records never carry relation data.
   Engine hardening (self-link, new relation types) in 11h; generic Goal relations UI in 11k
   (harness-loadable: pure functions returning HTML strings + wiring, no top-level DOM/timers). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const RELH_SRC = fs.readFileSync(path.join(ROOT, 'js', '11h-relations.js'), 'utf8');
const RELK_SRC = fs.readFileSync(path.join(ROOT, 'js', '11k-relations-ui.js'), 'utf8');
const GOALS_SRC = fs.readFileSync(path.join(ROOT, 'js', '09-goals.js'), 'utf8');

function seedEntities(S) {
  S.D.goals = [{ id: 1, title: 'Hedef A', steps: [], cat: 'İş' }, { id: 2, title: 'Hedef B', steps: [] }];
  S.D.decisions = [{ id: 'd1', title: 'Tedarikçi kararı', decision: '...', status: 'open' }];
  S.D.principles = [{ id: 'p1', title: 'Disiplin', statement: 'Uzun ilke' }];
  S.D.wisdomQuotes = [{ id: 'w1', quote: 'Kısa söz', author: 'X' }];
  S.D.generalNotes = [{ id: 'n1', title: 'Bir not', content: 'içerik' }];
  S.D.todos = [{ id: 10, text: 'Bir görev', done: false }];
}

/* ───────────────────────── ENGINE ───────────────────────── */
describe('Engine — resolvers, guards, direction', () => {
  test('1. Goal resolver works', () => {
    const S = createSandbox(); seedEntities(S);
    const r = S.relResolve('goal', 1); assert.ok(r); assert.equal(r.label, 'Hedef A');
  });
  test('2. Decision resolver works', () => {
    const S = createSandbox(); seedEntities(S);
    const r = S.relResolve('decision', 'd1'); assert.ok(r); assert.equal(r.label, 'Tedarikçi kararı');
  });
  test('3. Principle resolver works', () => {
    const S = createSandbox(); seedEntities(S);
    const r = S.relResolve('principle', 'p1'); assert.ok(r); assert.equal(r.label, 'Disiplin');
  });
  test('4. Wisdom Quote resolver works', () => {
    const S = createSandbox(); seedEntities(S);
    const r = S.relResolve('wisdomQuote', 'w1'); assert.ok(r); assert.equal(r.label, 'Kısa söz');
  });
  test('5. General Note resolver works', () => {
    const S = createSandbox(); seedEntities(S);
    const r = S.relResolve('generalNote', 'n1'); assert.ok(r); assert.equal(r.label, 'Bir not');
  });
  test('6. Task resolver works', () => {
    const S = createSandbox(); seedEntities(S);
    const r = S.relResolve('task', 10); assert.ok(r); assert.equal(r.label, 'Bir görev');
  });
  test('7. Unknown type resolves to null safely', () => {
    const S = createSandbox();
    assert.doesNotThrow(() => { assert.equal(S.relResolve('spaceship', 'x'), null); });
  });
  test('8. Empty source ID is rejected', () => {
    const S = createSandbox();
    const res = S.relAdd({ sourceType: 'goal', sourceId: '', targetType: 'decision', targetId: 'd1' });
    assert.equal(res.ok, false);
  });
  test('9. Empty target ID is rejected', () => {
    const S = createSandbox();
    const res = S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: '' });
    assert.equal(res.ok, false);
  });
  test('10. Invalid source rejected at picker-add (unresolvable)', () => {
    const S = createSandbox(); seedEntities(S);
    const res = S.relPickerAdd('goal', '999', 'decision', 'd1');
    assert.equal(res.ok, false);
  });
  test('11. Invalid target rejected at picker-add (unresolvable)', () => {
    const S = createSandbox(); seedEntities(S);
    const res = S.relPickerAdd('goal', '1', 'decision', 'ghost');
    assert.equal(res.ok, false);
  });
  test('12. Self-link is rejected by relAdd (engine)', () => {
    const S = createSandbox();
    const res = S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'goal', targetId: '1', relationType: 'related_to' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'SELF_LINK');
  });
  test('13. Duplicate relation is rejected (no second row)', () => {
    const S = createSandbox();
    const base = { sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'supports' };
    S.relAdd(base); S.relAdd(base);
    assert.equal(S.relList().length, 1);
  });
  test('14. Directional relation remains directional (no auto-reverse)', () => {
    const S = createSandbox();
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'principle', targetId: 'p1', relationType: 'supports' });
    assert.equal(S.getOutgoingRelations('goal', '1').length, 1);
    assert.equal(S.getIncomingRelations('goal', '1').length, 0);
    assert.equal(S.relList().length, 1);
  });
  test('15. related_to renders symmetrically', () => {
    const S = createSandbox();
    assert.equal(S.relDirectionLabel('related_to', 'outgoing'), S.relDirectionLabel('related_to', 'incoming'));
    assert.equal(S.relDirectionLabel('related_to', 'outgoing'), 'İlgili');
  });
  test('16. Incoming relation discoverable without reverse record', () => {
    const S = createSandbox();
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'goal', targetId: '2', relationType: 'blocks' });
    assert.equal(S.getIncomingRelations('goal', '2').length, 1);
    assert.equal(S.relList().length, 1); // no duplicate reverse record
  });
  test('17. Relation deletion removes only the relation', () => {
    const S = createSandbox(); seedEntities(S);
    const r = S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'supports' });
    S.relDelete(r.relation.id);
    assert.equal(S.relList().length, 0);
    assert.equal(S.D.goals.length, 2); assert.equal(S.D.decisions.length, 1); // entities intact
  });
  test('18. Deleting an absent relation is safe', () => {
    const S = createSandbox();
    assert.doesNotThrow(() => { const d = S.relDelete('nope'); assert.equal(d.deleted, false); });
  });
  test('19. Orphan relation remains removable (row preserved)', () => {
    const S = createSandbox(); seedEntities(S);
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'supports' });
    S.D.decisions = []; // target deleted → orphan
    const rows = S.relRowsForDisplay('goal', '1');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].available, false); // preserved but unavailable (getRelatedEntities would drop it)
  });
  test('20. Resolver never throws (bad resolver record)', () => {
    const S = createSandbox();
    assert.doesNotThrow(() => { S.relResolve('goal', undefined); S.relResolve('task', null); });
  });
  test('20b. New relation types accepted; unknown still rejected', () => {
    const S = createSandbox(); seedEntities(S);
    ['supports', 'depends_on', 'blocks', 'related_to', 'inspired_by'].forEach(function (rt, i) {
      const res = S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'principle', targetId: 'p1', relationType: rt });
      assert.equal(res.ok, true, rt);
    });
    assert.equal(S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'principle', targetId: 'p1', relationType: 'bogus' }).ok, false);
  });
});

/* ─────────────────────── GOAL DETAIL / UI ─────────────────────── */
describe('Goal Detail — panel & picker', () => {
  function withRel(S) {
    seedEntities(S);
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'supports' });
    S.relAdd({ sourceType: 'principle', sourceId: 'p1', targetType: 'goal', targetId: '1', relationType: 'inspired_by' }); // incoming
  }
  test('21. No-relations empty state renders', () => {
    const S = createSandbox(); seedEntities(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(/İlişkili Kayıtlar/.test(h));
    assert.ok(/İlişki Ekle/.test(h));
  });
  test('22. Outgoing relations render', () => {
    const S = createSandbox(); withRel(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(h.indexOf('Tedarikçi kararı') >= 0);
  });
  test('23. Incoming relations render', () => {
    const S = createSandbox(); withRel(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(h.indexOf('Disiplin') >= 0);
  });
  test('24. Target type label renders', () => {
    const S = createSandbox(); withRel(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(/Karar/.test(h) && /İlke/.test(h));
  });
  test('25. Target title renders', () => {
    const S = createSandbox(); withRel(S);
    assert.ok(S.entityRelationsPanelHtml('goal', 1).indexOf('Tedarikçi kararı') >= 0);
  });
  test('26. Relation type label renders', () => {
    const S = createSandbox(); withRel(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(/Destekler|destekler/.test(h));
  });
  test('27. Direction text renders (incoming distinct from outgoing)', () => {
    const S = createSandbox();
    assert.notEqual(S.relDirectionLabel('supports', 'outgoing'), S.relDirectionLabel('supports', 'incoming'));
    assert.ok(/Bu hedef/.test(S.relDirectionLabel('supports', 'incoming')));
  });
  test('28. Exact open action is wired', () => {
    const S = createSandbox(); withRel(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(/openRelatedEntity\(/.test(h));
  });
  test('29. Remove action is wired', () => {
    const S = createSandbox(); withRel(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(/relRemove\(/.test(h));
  });
  test('30. Orphan row renders safely', () => {
    const S = createSandbox(); withRel(S);
    S.D.decisions = [];
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(/erişilebilir değil/.test(h));
  });
  test('31. Orphan open action is disabled (no openRelatedEntity for orphan target)', () => {
    const S = createSandbox(); seedEntities(S);
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'supports' });
    S.D.decisions = [];
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.equal(/openRelatedEntity\(&#39;decision&#39;|openRelatedEntity\('decision'/.test(h), false);
  });
  test('32. Picker excludes self Goal', () => {
    const S = createSandbox(); seedEntities(S);
    const cands = S.relPickerCandidates('goal', 1);
    assert.equal(cands.some(function (c) { return c.type === 'goal' && String(c.id) === '1'; }), false);
    assert.equal(cands.some(function (c) { return c.type === 'goal' && String(c.id) === '2'; }), true);
  });
  test('33. Picker marks duplicates', () => {
    const S = createSandbox(); seedEntities(S);
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'related_to' });
    S._relPickerSetType('goal', 1, 'decision');
    const h = S.relPickerResultsHtml('goal', 1);
    assert.ok(/Bağlı/.test(h));
  });
  test('34. Picker filters by entity type', () => {
    const S = createSandbox(); seedEntities(S);
    S._relPickerSetType('goal', 1, 'principle');
    const cands = S.relPickerCandidates('goal', 1);
    assert.ok(cands.length > 0 && cands.every(function (c) { return c.type === 'principle'; }));
  });
  test('35. Picker search is Turkish case-insensitive', () => {
    const S = createSandbox(); seedEntities(S);
    S._relPickerSetType('goal', 1, 'principle');
    S._relPickerSetQuery('goal', 1, 'DİSİPLİN');
    const cands = S.relPickerCandidates('goal', 1);
    assert.ok(cands.some(function (c) { return c.id === 'p1'; }));
  });
  test('36. Mobile-safe structure exists (no fixed wide px / overflow guard)', () => {
    const S = createSandbox(); seedEntities(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.equal(/width:\s*[5-9]\d\dpx/.test(h), false); // no hard wide fixed width
  });
  test('37. Picker exposes accessible search input', () => {
    const S = createSandbox(); seedEntities(S);
    const h = S.relPickerHtml('goal', 1);
    assert.ok(/Ara/.test(h) && /input/.test(h));
  });
});

/* ─────────────────────── REGRESSION ─────────────────────── */
describe('Regression — Goal & engine integrity', () => {
  function goal(S) { return S.D.goals.find(function (g) { return g.id === 1; }); }
  test('38. Goal record byte-identical after relation add', () => {
    const S = createSandbox(); seedEntities(S);
    const before = JSON.stringify(goal(S));
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'supports' });
    assert.equal(JSON.stringify(goal(S)), before);
  });
  test('39. Goal record byte-identical after relation removal', () => {
    const S = createSandbox(); seedEntities(S);
    const r = S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'supports' });
    const before = JSON.stringify(goal(S));
    S.relDelete(r.relation.id);
    assert.equal(JSON.stringify(goal(S)), before);
  });
  test('40-48. SMART/quality/progress/checkpoint/health/priority/planning/lifecycle unchanged', () => {
    const S = createSandbox();
    S.D.goals = [{ id: 1, title: 'G', cat: 'İş', steps: [{ t: 'a', done: true }, { t: 'b', done: false }],
      status: 'active', deadline: '2026-12-01', health: { status: 'at_risk', confidence: 'low' },
      priority: { level: 'p1', weight: 1 }, planning: { year: 2026, quarter: 'Q4' }, completedAt: null }];
    const g = S.D.goals[0];
    const snapM = () => JSON.stringify({
      smart: S.smartScore(g), quality: S.qualityIndex(g), progress: S.goalProgress(g),
      cp: (typeof S.checkpointProgress === 'function' ? S.checkpointProgress(g) : null),
      health: S.goalHealthStatus(g), priority: S.goalPriority(g), planning: S.goalPlanningLabel(g),
      status: g.status, completedAt: g.completedAt
    });
    const before = snapM();
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'principle', targetId: 'p1', relationType: 'supports' });
    S.relDelete(S.relList()[0].id);
    assert.equal(snapM(), before);
  });
  test('49. Target record byte-identical after relation removal', () => {
    const S = createSandbox(); seedEntities(S);
    const before = JSON.stringify(S.D.decisions[0]);
    const r = S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'decision', targetId: 'd1', relationType: 'supports' });
    S.relDelete(r.relation.id);
    assert.equal(JSON.stringify(S.D.decisions[0]), before);
  });
  test('51. Existing Decision Journal relations remain functional', () => {
    const S = createSandbox(); seedEntities(S);
    const res = S.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'principle', targetId: 'p1', relationType: 'used_in' });
    assert.equal(res.ok, true);
    assert.equal(S.getRelatedEntities('decision', 'd1').length, 1);
  });
});

/* ─────────────── TASK EXACT OPEN (gap closure) ─────────────── */
describe('Task exact open', () => {
  function seedTaskRel(S) {
    seedEntities(S);
    S.relAdd({ sourceType: 'goal', sourceId: '1', targetType: 'task', targetId: '10', relationType: 'related_to' });
  }
  test('T1. Valid Task ID resolves', () => {
    const S = createSandbox(); seedEntities(S);
    assert.equal(S.relResolve('task', 10).label, 'Bir görev');
  });
  test('T2. String Task ID resolves safely', () => {
    const S = createSandbox(); seedEntities(S);
    assert.equal(S.relResolve('task', '10').label, 'Bir görev');
  });
  test('T3. Missing Task returns null safely', () => {
    const S = createSandbox(); seedEntities(S);
    assert.equal(S.relResolve('task', 999), null);
  });
  test('T4. openRelatedEntity(task) dispatches to openTaskById', () => {
    const S = createSandbox(); seedTaskRel(S);
    let called = null; S.openTaskById = function (id) { called = id; return true; };
    S.openRelatedEntity('task', '10');
    assert.notEqual(called, null);
  });
  test('T5. Exact (real) Task id is passed to the adapter', () => {
    const S = createSandbox(); seedTaskRel(S);
    let called = null; S.openTaskById = function (id) { called = id; return true; };
    S.openRelatedEntity('task', '10');
    assert.equal(called, 10); // real numeric id from the resolved record, not the string
  });
  test('T6. relCanOpen(task) is true (button becomes enabled)', () => {
    const S = createSandbox();
    assert.equal(S.relCanOpen('task'), true);
  });
  test('T7. Opening a Task does not modify D.todos', () => {
    const S = createSandbox(); seedTaskRel(S);
    S.openTaskById = function () { return true; };
    const before = JSON.stringify(S.D.todos);
    S.openRelatedEntity('task', '10');
    assert.equal(JSON.stringify(S.D.todos), before);
  });
  test('T8. Opening a Task does not modify the Goal', () => {
    const S = createSandbox(); seedTaskRel(S);
    S.openTaskById = function () { return true; };
    const before = JSON.stringify(S.D.goals);
    S.openRelatedEntity('task', '10');
    assert.equal(JSON.stringify(S.D.goals), before);
  });
  test('T9. Opening a Task does not modify D.relations', () => {
    const S = createSandbox(); seedTaskRel(S);
    S.openTaskById = function () { return true; };
    const before = JSON.stringify(S.relList());
    S.openRelatedEntity('task', '10');
    assert.equal(JSON.stringify(S.relList()), before);
  });
  test('T10. Valid Task relation renders enabled "Aç"', () => {
    const S = createSandbox(); seedTaskRel(S);
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.ok(/data-t="task"/.test(h)); // enabled branch wires data-t + openRelatedEntity
  });
  test('T11. Orphan Task relation renders disabled "Aç"', () => {
    const S = createSandbox(); seedTaskRel(S);
    S.D.todos = []; // task deleted → orphan
    const h = S.entityRelationsPanelHtml('goal', 1);
    assert.equal(/data-t="task"/.test(h), false);
    assert.ok(/disabled/.test(h) && /erişilebilir değil/.test(h));
  });
  test('T12-16. Other supported types remain openable', () => {
    const S = createSandbox();
    ['goal', 'decision', 'principle', 'wisdomQuote', 'generalNote'].forEach(function (t) {
      assert.equal(S.relCanOpen(t), true, t);
    });
  });
});

/* ─────────────────────── STATIC GUARDS ─────────────────────── */
describe('Static guards', () => {
  test('G1. No relation data embedded into Goal objects', () => {
    assert.equal(/\bg\.relations\s*=|\.relatedRecords\s*=|goal\.relations\s*=/.test(GOALS_SRC + RELK_SRC), false);
  });
  test('G2. No second relation collection introduced', () => {
    assert.equal(/D\.goalRelations|D\.relationLinks|D\.goalLinks/.test(GOALS_SRC + RELK_SRC + RELH_SRC), false);
  });
  test('G3. No second relation CRUD engine (11k must not redefine relAdd/relDelete)', () => {
    assert.equal(/function\s+relAdd\b|function\s+relDelete\b/.test(RELK_SRC), false);
  });
  test('G4. relAdd enforces self-link rejection in the engine', () => {
    assert.ok(/SELF_LINK/.test(RELH_SRC));
    assert.ok(/sourceType===targetType|sourceType\s*===\s*targetType/.test(RELH_SRC));
  });
  test('G5. New relation types present in engine', () => {
    assert.ok(/supports/.test(RELH_SRC) && /depends_on/.test(RELH_SRC) && /blocks/.test(RELH_SRC));
  });
  test('G6. Goal detail reads relations via safe display helper (orphan-preserving)', () => {
    assert.ok(/relRowsForDisplay/.test(RELK_SRC));
  });
  test('G7. 11k does not touch backup/DIFF_SCHEMA', () => {
    assert.equal(/DIFF_SCHEMA|countRecords\s*=/.test(RELK_SRC), false);
  });
  test('G8. openGoalDetail wires the relations panel', () => {
    assert.ok(/entityRelationsPanelHtml/.test(GOALS_SRC));
  });
  test('G9. js/public mirror byte-identical (11h/11k/09)', () => {
    ['11h-relations.js', '11k-relations-ui.js', '09-goals.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'),
        fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
  });
  test('G10. Task open dispatches to an exact-record adapter (not generic list)', () => {
    assert.ok(/openTaskById/.test(RELK_SRC)); // 11k task branch calls the adapter
    assert.ok(/function openTaskById/.test(GOALS_SRC)); // adapter exists in the todo owner
    assert.ok(/todo-row-/.test(GOALS_SRC)); // exact task focused via row anchor (not list-only)
  });
  test('G11. Task adapter does not introduce a second Task renderer / save / schema change', () => {
    // adapter body: no save(), no D.todos mutation, no new renderer
    const m = GOALS_SRC.match(/function openTaskById[\s\S]*?\n\}/);
    assert.ok(m, 'openTaskById body found');
    const body = m[0];
    assert.equal(/\bsave\(/.test(body), false, 'adapter must not save');
    assert.equal(/D\.todos\s*=/.test(body), false, 'adapter must not mutate D.todos');
    assert.equal(/renderTodos/.test(RELK_SRC), false, '11k must not own a todo renderer');
  });
  test('G12. task is in the openable set (button enabled for valid tasks)', () => {
    assert.ok(/REL_OPENABLE\s*=\s*\[[^\]]*task/.test(RELK_SRC));
  });
});
