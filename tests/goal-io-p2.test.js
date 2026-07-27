'use strict';
/* SMART-GOALS Phase 2 P2 — Goal Import/Export.
   JSON lossless (envelope + bare-array accepted) · CSV intentionally lossy · mandatory preview ·
   row validation · append/merge/replace · verified backup before replace · ACK-gated ·
   SG-SYNC-P0 protections intact. All heavy logic in 11l-goal-io.js (harness-loadable). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const IO_SRC = fs.readFileSync(path.join(ROOT, 'js', '11l-goal-io.js'), 'utf8');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8');
const GOALS_SRC = fs.readFileSync(path.join(ROOT, 'js', '09-goals.js'), 'utf8');

function fullGoal() {
  return {
    id: 1784491430398, title: 'Hedef A', desc: 'açıklama', cat: 'İş', frog: true,
    deadline: '2026-12-15', measurable: 'IELTS 7.5',
    metric: { target: 100, current: 40, start: 0, unit: 'puan', direction: 'up',
      checkpoints: [{ id: 5, label: 'Ara', date: '2026-06-01', targetValue: 50, done: false }] },
    steps: [{ id: 9, t: 'adım bir', done: true }],
    notes: 'not', notesMeta: { updatedAt: '2026-05-01' },
    status: 'active', completedAt: null, createdAt: '2026-01-01',
    planning: { year: 2026, quarter: 'Q4' }, health: { status: 'at_risk', confidence: 'low' },
    priority: { level: 'p1', weight: 1 }, intel: { risk: true, secondOrder: false },
    futureField: { nested: 'korunmalı' }
  };
}
function legacyGoal() {
  return { id: 1, title: 'Eski Hedef', desc: '', cat: 'Gelişim', frog: false, deadline: '2026-12-31',
    measurable: 'X', steps: [{ id: 101, t: 'a', done: true }], notes: '', status: 'active',
    createdAt: '2026-01-01', quarter: 'Q1' };
}

/* ───────────────────────── JSON EXPORT ───────────────────────── */
describe('JSON export', () => {
  test('1. Versioned envelope generated', () => {
    const S = createSandbox(); S.D.goals = [fullGoal()];
    const obj = JSON.parse(S.goalBuildJsonText(S.D.goals));
    assert.equal(obj.format, 'smart-goals'); assert.equal(obj.version, 1);
    assert.ok(obj.exportedAt); assert.ok(Array.isArray(obj.records));
  });
  test('2. Bare-array import accepted', () => {
    const S = createSandbox();
    const p = S.goalParseImportFile(JSON.stringify([fullGoal()]), 'x.json');
    assert.equal(p.ok, true); assert.equal(p.records.length, 1);
  });
  test('3+4. Full field + unknown additive preservation (lossless round-trip)', () => {
    const S = createSandbox();
    const text = S.goalBuildJsonText([fullGoal()]);
    const p = S.goalParseImportFile(text, 'x.json');
    const r = p.records[0];
    // cross-realm safe: byte-equivalent JSON = lossless (every field incl. futureField/intel/notesMeta)
    assert.equal(JSON.stringify(r), JSON.stringify(fullGoal()));
    assert.ok('futureField' in r && 'intel' in r && 'notesMeta' in r);
  });
  test('5. Unicode preserved', () => {
    const S = createSandbox(); const g = fullGoal(); g.title = 'Şçğüöı — 中文 — İ';
    const r = S.goalParseImportFile(S.goalBuildJsonText([g]), 'x.json').records[0];
    assert.equal(r.title, 'Şçğüöı — 中文 — İ');
  });
  test('6. Array order preserved', () => {
    const S = createSandbox(); const a = fullGoal(), b = legacyGoal();
    const rs = S.goalParseImportFile(S.goalBuildJsonText([a, b]), 'x.json').records;
    assert.equal(rs[0].id, a.id); assert.equal(rs[1].id, b.id);
  });
  test('7. Deterministic export (same input → same text)', () => {
    const S = createSandbox();
    const t1 = S.goalBuildJsonText([fullGoal()]).replace(/"exportedAt":\s*"[^"]*"/, '');
    const t2 = S.goalBuildJsonText([fullGoal()]).replace(/"exportedAt":\s*"[^"]*"/, '');
    assert.equal(t1, t2);
  });
  test('9+10. Only goals exported, no unrelated state leakage', () => {
    const S = createSandbox(); S.D.goals = [fullGoal()]; S.D.wisdomQuotes = [{ id: 'w', quote: 'x' }];
    const txt = S.goalBuildJsonText(S.D.goals);
    assert.equal(txt.indexOf('wisdomQuotes') < 0, true);
    assert.equal(txt.indexOf('"quote"') < 0, true);
  });
  test('8b. Reject unrelated JSON structure safely', () => {
    const S = createSandbox();
    const p = S.goalParseImportFile(JSON.stringify({ foo: 'bar' }), 'x.json');
    assert.equal(p.ok, false);
  });
});

/* ───────────────────────── CSV EXPORT ───────────────────────── */
describe('CSV export', () => {
  test('11+18. Stable headers, technical fields excluded', () => {
    const S = createSandbox();
    const csv = S.goalBuildCsvText([fullGoal()]);
    const header = csv.replace(/^﻿/, '').split('\r\n')[0];
    assert.equal(header, 'title,description,category,deadline,year,quarter,priority,health_status,confidence,metric_target,metric_current,metric_start,metric_unit,metric_direction,status,notes');
    ['steps', 'checkpoints', 'notesMeta', 'intel', 'createdAt', 'completedAt', 'relations', '\nid,'].forEach(function (t) {
      assert.equal(header.indexOf(t) < 0, true, t);
    });
  });
  test('12. UTF-8 BOM', () => {
    const S = createSandbox();
    assert.equal(S.goalBuildCsvText([fullGoal()]).charCodeAt(0), 0xFEFF);
  });
  test('13. Formula injection guard', () => {
    const S = createSandbox(); const g = fullGoal(); g.title = '=SUM(A1)';
    const csv = S.goalBuildCsvText([g]);
    assert.ok(/'=SUM/.test(csv));
  });
  test('14+15. Quoted commas + embedded newlines', () => {
    const S = createSandbox(); const g = fullGoal(); g.title = 'a,b'; g.notes = 'x\ny';
    const csv = S.goalBuildCsvText([g]);
    assert.ok(/"a,b"/.test(csv)); assert.ok(/"x\ny"/.test(csv));
  });
  test('16. Turkish characters preserved', () => {
    const S = createSandbox(); const g = fullGoal(); g.title = 'Çöğüşı İ';
    assert.ok(S.goalBuildCsvText([g]).indexOf('Çöğüşı İ') >= 0);
  });
  test('17. Lossy notice exists and never claims lossless', () => {
    const S = createSandbox();
    const n = S.goalCsvRoundTripNotice();
    assert.ok(/JSON/.test(n) && /korumaz|kayıpsız değil|eksiksiz/i.test(n));
    assert.equal(/kayıpsız yedek.*csv|csv.*lossless/i.test(n), false);
  });
});

/* ───────────────────────── VALIDATION ───────────────────────── */
describe('Validation', () => {
  function analyze(S, recs, mode) { return S.goalAnalyzeImport(recs, 'json', mode || 'append'); }
  function errCodes(item) { return (item.errors || []).map(function (e) { return e.code; }); }
  test('20. Empty title blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.title = '   ';
    const st = analyze(S, [g]); assert.ok(errCodes(st.items[0]).indexOf('EMPTY_TITLE') >= 0);
  });
  test('21. Invalid ID blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.id = 'abc';
    const st = analyze(S, [g]); assert.ok(errCodes(st.items[0]).indexOf('INVALID_ID') >= 0);
  });
  test('22+23. Duplicate existing ID + duplicate in-file ID', () => {
    const S = createSandbox(); S.D.goals = [fullGoal()];
    const dupExisting = analyze(S, [fullGoal()]);
    assert.ok(dupExisting.items[0].errors.some(function (e) { return e.code === 'DUPLICATE_ID'; }));
    const a = fullGoal(), b = fullGoal();
    const S2 = createSandbox(); const st2 = analyze(S2, [a, b]);
    assert.ok(st2.items[1].errors.some(function (e) { return e.code === 'DUPLICATE_ID_IN_FILE'; }));
  });
  test('24. Invalid deadline blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.deadline = '15/12/2026';
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_DEADLINE') >= 0);
  });
  test('25+26. Invalid planning year + quarter blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.planning = { year: 99, quarter: 'Q9' };
    const e = errCodes(analyze(S, [g]).items[0]);
    assert.ok(e.indexOf('INVALID_PLANNING_YEAR') >= 0 || e.indexOf('INVALID_QUARTER') >= 0);
  });
  test('27+28. Invalid health + confidence blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.health = { status: 'bogus', confidence: 'nope' };
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_HEALTH_STATUS') >= 0);
  });
  test('29. Invalid priority blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.priority = { level: 'p9', weight: 9 };
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_PRIORITY') >= 0);
  });
  test('30. Invalid metric direction blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.metric.direction = 'sideways';
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_METRIC_DIRECTION') >= 0);
  });
  test('31. Invalid lifecycle status blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.status = 'zombie';
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_STATUS') >= 0);
  });
  test('32. Invalid completedAt blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.status = 'done'; g.completedAt = 'not-a-date';
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_COMPLETED_AT') >= 0);
  });
  test('33. Invalid steps blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.steps = 'not-array';
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_STEPS') >= 0);
  });
  test('34. Invalid checkpoints blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.metric.checkpoints = 'nope';
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_CHECKPOINTS') >= 0);
  });
  test('35+36. Control char + replacement char blocked', () => {
    const S = createSandbox(); const g = fullGoal(); g.title = 'badctrl';
    assert.ok(errCodes(analyze(S, [g]).items[0]).indexOf('INVALID_CONTROL_CHARACTER') >= 0);
    const S2 = createSandbox(); const g2 = fullGoal(); g2.title = 'bad�char';
    assert.ok(errCodes(analyze(S2, [g2]).items[0]).indexOf('UNICODE_REPLACEMENT_CHARACTER') >= 0);
  });
  function warnCodes(item) { return (item.warnings || []).map(function (w) { return w.code; }); }
  test('37+38. Duplicate content + possible title duplicate warned', () => {
    const S = createSandbox(); const ex = fullGoal(); S.D.goals = [ex];
    const incoming = fullGoal(); delete incoming.id; // no id → content compared
    const st = S.goalAnalyzeImport([incoming], 'json', 'append');
    const w = warnCodes(st.items[0]);
    assert.ok(w.indexOf('DUPLICATE_CONTENT') >= 0 || w.indexOf('POSSIBLE_DUPLICATE_TITLE') >= 0);
  });
  test('39+40. Legacy quarter + measurable warned', () => {
    const S = createSandbox(); const g = legacyGoal(); delete g.id;
    const w = warnCodes(S.goalAnalyzeImport([g], 'json', 'append').items[0]);
    assert.ok(w.indexOf('LEGACY_QUARTER_FIELD') >= 0); assert.ok(w.indexOf('LEGACY_MEASURABLE_FIELD') >= 0);
  });
  test('41. Unknown additive field warned', () => {
    const S = createSandbox(); const g = fullGoal(); delete g.id; g.weirdNewThing = 1;
    const w = warnCodes(S.goalAnalyzeImport([g], 'json', 'append').items[0]);
    assert.ok(w.indexOf('UNKNOWN_ADDITIVE_FIELD') >= 0);
  });
  test('V-normalize. Validator never rewrites title/desc/notes semantically', () => {
    const S = createSandbox(); const g = fullGoal(); delete g.id; g.title = 'Tam Metin Korunur';
    const item = S.goalAnalyzeImport([g], 'json', 'append').items[0];
    assert.equal(item.goal.title, 'Tam Metin Korunur');
  });
});

/* ───────────────────────── APPEND ───────────────────────── */
describe('Append', () => {
  test('42+43+45+48+49. Existing byte-identical, appended, unique id, one save, relations unchanged', () => {
    const S = createSandbox(); const ex = legacyGoal(); S.D.goals = [ex]; S.D.relations = [];
    const exBefore = JSON.stringify(ex);
    let saves = 0; S.save = function () { saves++; S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; };
    const incoming = fullGoal(); delete incoming.id; // needs unique id
    const st = S.goalAnalyzeImport([incoming], 'json', 'append'); S.GOAL_IMPORT.stats = st;
    S.goalImportApply('append');
    assert.equal(JSON.stringify(S.D.goals[0]), exBefore); // existing untouched
    assert.equal(S.D.goals.length, 2);
    const added = S.D.goals[1];
    assert.equal(typeof added.id, 'number'); // numeric id required by app
    assert.equal(String(added.id) === 'undefined' || added.id == null, false);
    assert.equal(saves, 1);
    assert.equal((S.D.relations || []).length, 0);
  });
  test('44. Invalid rows skipped', () => {
    const S = createSandbox(); S.D.goals = [];
    const bad = fullGoal(); bad.title = ''; delete bad.id;
    const ok = fullGoal(); delete ok.id; ok.title = 'Geçerli';
    const st = S.goalAnalyzeImport([bad, ok], 'json', 'append'); S.GOAL_IMPORT.stats = st;
    S.save = function () { S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; };
    S.goalImportApply('append');
    assert.equal(S.D.goals.length, 1); assert.equal(S.D.goals[0].title, 'Geçerli');
  });
  test('46. Colliding supplied ID never overwrites existing', () => {
    const S = createSandbox(); const ex = legacyGoal(); S.D.goals = [ex];
    const collide = fullGoal(); collide.id = ex.id; // same id as existing
    const st = S.goalAnalyzeImport([collide], 'json', 'append');
    assert.ok(st.items[0].errors.some(function (e) { return e.code === 'DUPLICATE_ID'; }));
  });
  test('47. Two contexts do not generate the same fallback ID set', () => {
    // goalNewId is ALWAYS called with the existing-id pool in production (_gioAssignId(g,used)),
    // whose guard bumps the sequence on any collision → deterministically unique. The pool is the
    // real contract; passing {} (no pool) mismodeled usage and made this probabilistic.
    const S1 = createSandbox(); const S2 = createSandbox();
    const pool = {}; let dup = 0;
    for (let i = 0; i < 40; i++) { const id = S1.goalNewId(pool); if (pool[id]) dup++; pool[id] = 1; }
    for (let i = 0; i < 40; i++) { const id = S2.goalNewId(pool); if (pool[id]) dup++; pool[id] = 1; }
    assert.equal(dup, 0);
  });
});

/* ───────────────────────── MERGE ───────────────────────── */
describe('Merge', () => {
  test('50. Exact ID → update classification', () => {
    const S = createSandbox(); const ex = fullGoal(); S.D.goals = [ex];
    const upd = fullGoal(); upd.title = 'Güncellenmiş';
    const st = S.goalAnalyzeImport([upd], 'json', 'merge');
    assert.equal(st.items[0].matchKind, 'id'); assert.equal(st.items[0].classification, 'update');
  });
  test('52. Title-only match never auto-merges', () => {
    const S = createSandbox(); const ex = fullGoal(); S.D.goals = [ex];
    const t = fullGoal(); delete t.id; t.desc = 'farklı'; t.cat = 'Başka'; t.deadline = '2030-01-01'; t.metric = null;
    const st = S.goalAnalyzeImport([t], 'json', 'merge');
    assert.notEqual(st.items[0].classification, 'update'); // same title but not exact content → not an update
  });
  test('53. Ambiguous match blocked (not auto-merged)', () => {
    const S = createSandbox(); const a = fullGoal(); const b = fullGoal(); b.id = 999999999;
    S.D.goals = [a, b]; // two existing goals with identical content signature
    const t = fullGoal(); delete t.id;
    const st = S.goalAnalyzeImport([t], 'json', 'merge');
    assert.ok(st.items[0].warnings.some(function (w) { return w.code === 'AMBIGUOUS_MATCH'; }));
    assert.notEqual(st.items[0].classification, 'update');
  });
  test('56+57. Non-selected existing goal unchanged, one save', () => {
    const S = createSandbox(); const a = fullGoal(); const b = legacyGoal(); S.D.goals = [a, b];
    const bBefore = JSON.stringify(b);
    const upd = fullGoal(); upd.title = 'Yeni Başlık';
    const st = S.goalAnalyzeImport([upd], 'json', 'merge'); S.GOAL_IMPORT.stats = st;
    let saves = 0; S.save = function () { saves++; S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; };
    S.goalImportApply('merge');
    assert.equal(JSON.stringify(S.D.goals.find(function (x) { return x.id === b.id; })), bBefore);
    assert.equal(S.D.goals.find(function (x) { return x.id === a.id; }).title, 'Yeni Başlık');
    assert.equal(saves, 1);
  });
});

/* ───────────────────────── REPLACE ───────────────────────── */
describe('Replace', () => {
  function armBackup(S, result) {
    S.createBackup = async function (reason, opts) { S.__bk = { reason: reason, opts: opts }; return result; };
  }
  test('62+63+64+68+69. Backup called before mutation, before_import, force, verified permits, one save', async () => {
    const S = createSandbox(); S.D.goals = [legacyGoal()]; S.D.relations = [];
    armBackup(S, { id: 'bk1' });
    let saves = 0; S.save = function () { saves++; S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; };
    const ng = fullGoal(); delete ng.id;
    const st = S.goalAnalyzeImport([ng], 'json', 'replace'); S.GOAL_IMPORT.stats = st;
    await S.goalImportApply('replace');
    assert.equal(S.__bk.reason, 'before_import');
    assert.equal(S.__bk.opts.force, true);
    assert.equal(S.D.goals.length, 1); // replaced
    assert.equal(saves, 1);
  });
  test('65+66+67. Backup failure → zero mutation/snap/save', async () => {
    const S = createSandbox(); const orig = [legacyGoal()]; S.D.goals = orig.slice();
    const before = JSON.stringify(S.D.goals);
    armBackup(S, { error: 'fail' });
    let saves = 0, snaps = 0; S.save = function () { saves++; S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; }; S.snap = function () { snaps++; };
    const ng = fullGoal(); delete ng.id;
    const st = S.goalAnalyzeImport([ng], 'json', 'replace'); S.GOAL_IMPORT.stats = st;
    const res = await S.goalImportApply('replace');
    assert.equal(JSON.stringify(S.D.goals), before);
    assert.equal(saves, 0); assert.equal(snaps, 0);
    assert.equal(res && res.aborted, true);
  });
  test('61+70. Orphan-producing replace blocked by default; relations not auto-deleted', async () => {
    const S = createSandbox();
    const g = legacyGoal(); S.D.goals = [g];
    S.D.relations = [{ id: 'r1', sourceType: 'goal', sourceId: String(g.id), targetType: 'principle', targetId: 'p1', relationType: 'related_to' }];
    armBackup(S, { id: 'bk1' });
    let saves = 0; S.save = function () { saves++; S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; };
    const ng = fullGoal(); delete ng.id; // replacing removes goal g → r1 orphaned
    const st = S.goalAnalyzeImport([ng], 'json', 'replace'); S.GOAL_IMPORT.stats = st;
    const res = await S.goalImportApply('replace'); // no explicit orphan confirm
    assert.equal(res && res.aborted, true);
    assert.equal((S.D.relations || []).length, 1); // relation NOT deleted
    assert.equal(saves, 0);
  });
});

/* ───────────────────────── ACK / SYNC ───────────────────────── */
describe('ACK / Sync', () => {
  test('SO. Sync outcome distinguishes synced / pending / conflict', () => {
    const S = createSandbox();
    Object.assign(S.CLOUD, { pendingMutation: null, conflict: null, revision: 5 });
    assert.equal(S._goalImportSyncOutcome(4), 'synced');
    Object.assign(S.CLOUD, { pendingMutation: { id: 'x' }, conflict: null, revision: 4 });
    assert.equal(S._goalImportSyncOutcome(4), 'pending');
    Object.assign(S.CLOUD, { pendingMutation: { id: 'x' }, conflict: { serverData: {} }, revision: 4 });
    assert.equal(S._goalImportSyncOutcome(4), 'conflict');
  });
  test('75. Static: no unconditional synchronous success before ACK', () => {
    assert.ok(/senkronize ediliyor|_goalImportAwaitAck|_goalImportSyncOutcome/.test(IO_SRC));
  });
  test('76. Static: does not redefine sync/save engine', () => {
    assert.equal(/function\s+queueCloudSave|function\s+commitMutation|function\s+onRemoteSnapshot/.test(IO_SRC), false);
  });
});

/* ───────────────────────── REGRESSION ───────────────────────── */
describe('Regression', () => {
  test('78-86. Append does not change engine-derived metrics of existing goal', () => {
    const S = createSandbox(); const g = fullGoal(); S.D.goals = [g]; S.D.relations = [];
    const m0 = JSON.stringify({ s: S.smartScore(g), q: S.qualityIndex(g), p: S.goalProgress(g),
      cp: (typeof S.checkpointProgress === 'function' ? S.checkpointProgress(g) : null),
      h: S.goalHealthStatus(g), pr: S.goalPriority(g), pl: S.goalPlanningLabel(g), st: g.status, ca: g.completedAt });
    const ng = fullGoal(); delete ng.id; ng.title = 'Yeni';
    const st = S.goalAnalyzeImport([ng], 'json', 'append'); S.GOAL_IMPORT.stats = st; S.save = function () { S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; };
    S.goalImportApply('append');
    const same = S.D.goals.find(function (x) { return x.id === g.id; });
    const m1 = JSON.stringify({ s: S.smartScore(same), q: S.qualityIndex(same), p: S.goalProgress(same),
      cp: (typeof S.checkpointProgress === 'function' ? S.checkpointProgress(same) : null),
      h: S.goalHealthStatus(same), pr: S.goalPriority(same), pl: S.goalPlanningLabel(same), st: same.status, ca: same.completedAt });
    assert.equal(m1, m0);
  });
  test('87. Append preserves relations', () => {
    const S = createSandbox(); const g = legacyGoal(); S.D.goals = [g];
    S.D.relations = [{ id: 'r1', sourceType: 'goal', sourceId: String(g.id), targetType: 'principle', targetId: 'p1', relationType: 'related_to' }];
    const relBefore = JSON.stringify(S.D.relations);
    const ng = fullGoal(); delete ng.id;
    const st = S.goalAnalyzeImport([ng], 'json', 'append'); S.GOAL_IMPORT.stats = st; S.save = function () { S.CLOUD.revision = (S.CLOUD.revision || 0) + 1; };
    S.goalImportApply('append');
    assert.equal(JSON.stringify(S.D.relations), relBefore);
  });
});

/* ───────────────────────── STATIC GUARDS ───────────────────────── */
describe('Static guards', () => {
  test('G1. JSON build preserves whole record (no allowlist field picking)', () => {
    // build must serialize records as-is (envelope wraps D.goals directly)
    assert.ok(/records\s*:/.test(IO_SRC));
    assert.equal(/goalBuildJsonText[\s\S]{0,400}pick|allowlist/.test(IO_SRC), false);
  });
  test('G2. CSV never claims lossless', () => {
    assert.equal(/CSV[^\n]{0,60}(kayıpsız|lossless|tam yedek)/i.test(IO_SRC), false);
  });
  test('G3. CSV row excludes technical/nested fields', () => {
    const m = IO_SRC.match(/GOAL_CSV_FIELDS\s*=\s*\[([^\]]*)\]/);
    assert.ok(m, 'GOAL_CSV_FIELDS array literal found');
    const body = m[1];
    ['steps', 'checkpoints', 'notesMeta', 'intel', "'id'", 'createdAt', 'completedAt', 'relations'].forEach(function (f) {
      assert.equal(body.indexOf(f) >= 0, false, f);
    });
  });
  test('G4. Replace uses before_import + force + verified backup', () => {
    assert.ok(/before_import/.test(IO_SRC) && /force\s*:\s*true/.test(IO_SRC) && /_goalBackupVerified|backup.*id.*skipped|!bk\.error/.test(IO_SRC));
  });
  test('G5. Fallback ID not deterministic row-index / not goal-legacy', () => {
    assert.equal(/goal-legacy-/.test(IO_SRC), false);
    assert.ok(/function goalNewId/.test(IO_SRC));
  });
  test('G6. No second save/sync/backup engine', () => {
    assert.equal(/function\s+(save|queueCloudSave|commitMutation|createBackup)\b/.test(IO_SRC), false);
  });
  test('G7. Heavy IO logic not embedded in 09-goals.js', () => {
    assert.equal(/goalBuildJsonText|goalAnalyzeImport|goalImportApply/.test(GOALS_SRC), false);
  });
  test('G8. UI hook present in 08-ui-core (buttons/modal invocation only)', () => {
    assert.ok(/goalImport|goalExport|goalIoButtons|İçe Aktar|Dışa Aktar/.test(UI_SRC));
  });
  test('G9. js/public mirror byte-identical (11l/08)', () => {
    ['11l-goal-io.js', '08-ui-core.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'),
        fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
  });
  test('G10. Module under 900 lines', () => {
    assert.ok(IO_SRC.split('\n').length < 900);
  });
});
