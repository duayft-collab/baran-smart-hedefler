'use strict';
/* COACHING MASTERY OS — PHASE 6 (Coach Mirror + deliberate practice).
   Guarantees: observations come only from structured evidence, never from a
   transcript or the private note; one session never becomes a claim about the
   coach; there is no single score; strengths are found as readily as gaps; a
   safe stop is never a failure; one practice at a time; and disagreement is
   stored without deleting the observation or changing a rule. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const SRC30 = F('30-coaching-mirror.js'), SRC31 = F('31-coaching-practice.js'), SRC32 = F('32-coaching-mirror-ui.js');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const P6_FILES = ['30-coaching-mirror.js', '31-coaching-practice.js', '32-coaching-mirror-ui.js'];

function deq(a, e, m) { assert.deepEqual(JSON.parse(JSON.stringify(a)), e, m); }
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
function exec(src) { return code(src).replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"/g, "''"); }

const sess = (sb, over) => sb.coachingBuildSession(Object.assign({ context: 'adult', title: 'x' }, over || {}),
  { now: '2026-08-30T09:00:00.000Z', id: 'coa_m6-1' }).session;
let evSeq = 0;
const used = (type, over) => Object.assign({ type: 'INTERVENTION_USED', interventionType: type,
  at: '2026-08-30T09:' + ('0' + (evSeq++ % 60)).slice(-2) + ':00.000Z' }, over || {});
const codesOf = m => m.observations.map(o => o.code);

/* ── OBSERVATION MODEL ─────────────────────────────────────────────────────── */
describe('A. Observation model', () => {
  test('A1. every observation carries its layer, evidence and provenance', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    assert.ok(m.observations.length > 0);
    m.observations.forEach(o => {
      ['id', 'sessionId', 'code', 'category', 'evidenceLayer', 'observationType', 'title', 'description',
       'evidenceText', 'evidenceRefs', 'confidence', 'developmentDirection', 'competencyTags',
       'icfArea', 'createdAt', 'sourceVersion'].forEach(k => assert.ok(k in o, o.code + '.' + k));
      assert.ok(sb.COACHING_EVIDENCE_LAYERS.indexOf(o.evidenceLayer) >= 0, o.code);
      assert.ok(sb.COACHING_MIRROR_CATEGORIES.indexOf(o.category) >= 0, o.code);
      assert.ok(sb.COACHING_OBSERVATION_TYPES.indexOf(o.observationType) >= 0, o.code);
      assert.ok(sb.COACHING_MIRROR_CONFIDENCE.indexOf(o.confidence) >= 0, o.code);
      assert.ok(o.evidenceRefs.length >= 1, o.code);
      assert.ok(o.evidenceText.length > 10, o.code);
    });
  });
  test('A2. the mirror reads structured events only — free text is never evidence', () => {
    const sb = createSandbox();
    const c = sb.coachingBuildMirrorContext(sess(sb, { title: 'GIZLI AMAC' }),
      [used('OPEN_QUESTION'), { type: 'COACH_NOTE_UPDATED', at: '2026-08-30T09:10:00.000Z' }]);
    const j = JSON.stringify(c);
    assert.equal(j.indexOf('GIZLI AMAC'), -1);
    assert.equal('note' in c, false);
    assert.equal('body' in c, false);
    // and nothing in the engine reaches for note text
    assert.equal(/getUserMedia|MediaRecorder|SpeechRecognition|\.body\b|noteText|\.text\b/.test(exec(SRC30)), false);
  });
  test('A3. an event that is not structured evidence contributes nothing', () => {
    const sb = createSandbox();
    const c = sb.coachingBuildMirrorContext(sess(sb), [{ type: 'MIRROR_GENERATED' }, { type: 'SESSION_STARTED' }]);
    assert.equal(c.moveCount, 0);
    deq(c.boundaryHeld, []);
  });
  test('A3b. the mirror does not shadow the router\'s confidence vocabulary', () => {
    const sb = createSandbox();
    deq(sb.COACHING_CONFIDENCE, ['LOW', 'MEDIUM', 'HIGH']);            // Phase 4 router
    deq(sb.COACHING_MIRROR_CONFIDENCE, ['SINIRLI_KANIT', 'OLUSAN_ORUNTU', 'DAHA_GUCLU_ORUNTU']);
    assert.equal(sb.coachingRouteApproaches({ personContext: 'adult', ambivalence: 'high',
      readinessForAction: 'low', conversationStage: 'EXPLORING' }).approaches[0].confidenceBand, 'MEDIUM');
  });
  test('A4. there is no single quality score anywhere', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    const j = JSON.stringify(m);
    assert.equal(/"score"|\/100|\/10\b|%\d|PCC|MCC|\bACC\b/.test(j), false);
    assert.equal(sb.coachingMirrorSelfCheck().singleScore, false);
    assert.equal(/score\s*[:=]|rating\s*[:=]\s*\d/.test(exec(SRC30)), false);
  });
});

/* ── SESSION MIRROR ────────────────────────────────────────────────────────── */
describe('B. Session observations', () => {
  test('B1. question stacking is detected and offers a practice', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb),
      [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    const o = m.observations.find(x => x.code === 'QUESTION_STACKING');
    assert.ok(o, codesOf(m).join(','));
    assert.equal(o.observationType, 'WATCH');
    assert.equal(o.evidenceLayer, 'INFERRED');
    assert.match(o.description, /olabilir/);
    assert.equal(o.practiceSuggestion, 'PRACTICE_REFLECT_BEFORE_ASKING');
  });
  test('B2. a reflection between questions does not trip the same pattern', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb),
      [used('OPEN_QUESTION'), used('REFLECTION'), used('OPEN_QUESTION'), used('REFLECTION'), used('OPEN_QUESTION')]);
    assert.equal(codesOf(m).indexOf('QUESTION_STACKING'), -1);
    assert.equal(codesOf(m).indexOf('REFLECTION_SCARCITY'), -1);
  });
  test('B3. reflection scarcity needs both volume and an exploratory stage', () => {
    const sb = createSandbox();
    const few = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION', { stage: 'EXPLORING' })]);
    assert.equal(codesOf(few).indexOf('REFLECTION_SCARCITY'), -1, 'one move must not accuse');
    const many = sb.coachingSessionMirror(sess(sb), Array.from({ length: 5 },
      () => used('OPEN_QUESTION', { stage: 'EXPLORING' })));
    assert.ok(codesOf(many).indexOf('REFLECTION_SCARCITY') >= 0);
  });
  test('B4. silence avoidance requires the realization event to exist', () => {
    const sb = createSandbox();
    const without = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    assert.equal(codesOf(without).indexOf('SILENCE_AVOIDANCE'), -1);
    const withIt = sb.coachingSessionMirror(sess(sb),
      [used('REFLECTION'), { type: 'CONTEXT_UPDATED', contextKey: 'significantRealization' }, used('OPEN_QUESTION')]);
    assert.ok(codesOf(withIt).indexOf('SILENCE_AVOIDANCE') >= 0);
    const respected = sb.coachingSessionMirror(sess(sb),
      [used('REFLECTION'), { type: 'CONTEXT_UPDATED', contextKey: 'significantRealization' }, used('SILENCE')]);
    assert.equal(codesOf(respected).indexOf('SILENCE_AVOIDANCE'), -1);
  });
  test('B5. strengths are found, not only gaps', () => {
    const sb = createSandbox();
    const s = Object.assign(sess(sb), { lifecycle: 'completed', counters: Object.assign({}, sess(sb).counters, { commitments: 1 }) });
    const m = sb.coachingSessionMirror(s, [used('REFLECTION'), used('SUMMARY'), used('OPEN_QUESTION'), used('SILENCE')],
      { coacheeCommitment: true, insightRecorded: true, coachReflectionRecorded: true });
    ['CLIENT_AGENCY', 'STRONG_CLOSURE', 'SPACE_MAKING', 'REFLECTION_PRACTICE'].forEach(c =>
      assert.ok(codesOf(m).indexOf(c) >= 0, c + ' missing from ' + codesOf(m).join(',')));
    assert.ok(m.strengths.length >= 4);
  });
  test('B6. a coach-owned commitment attempt is observed, gently', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), { type: 'COMMITMENT_SOURCE_CORRECTED' }]);
    const o = m.observations.find(x => x.code === 'COACH_OWNED_ACTION_ATTEMPT');
    assert.ok(o);
    assert.equal(/başarısız|yanlış yaptın|hata ettin/i.test(o.description), false);
  });
  test('B7. with no evidence the mirror says so instead of inventing criticism', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), []);
    assert.equal(m.insufficientEvidence, true);
    deq(m.observations, []);
    assert.ok(m.note.length > 20);
  });
  test('B8. the compact summary stays bounded for cross-session reads', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    const sum = sb.coachingMirrorSummary(m);
    assert.equal(sum.version, 1);
    assert.ok(sum.codes.length <= 16);
    assert.ok(JSON.stringify(sum).length < 600);
    const norm = sb.coachingNormalizeSession({ context: 'adult', mirror: sum });
    assert.equal(norm.mirror.version, 1);
    assert.ok(sb.coachingValidateSession(norm).ok);
  });
});

/* ── CONTEXT AWARENESS ─────────────────────────────────────────────────────── */
describe('C. Context changes what is fair to say', () => {
  test('C1. an executive session is not penalised for challenging early', () => {
    const sb = createSandbox();
    const ev = [used('CHALLENGE'), used('CHALLENGE')];
    assert.ok(codesOf(sb.coachingSessionMirror(sess(sb, { context: 'adult' }), ev)).indexOf('CHALLENGE_OVERUSE') >= 0);
    assert.equal(codesOf(sb.coachingSessionMirror(sess(sb, { context: 'executive' }), ev)).indexOf('CHALLENGE_OVERUSE'), -1);
  });
  test('C2. an action-oriented approach is not accused of rushing', () => {
    const sb = createSandbox();
    const ev = [used('ACTION_COMMITMENT')];
    assert.ok(codesOf(sb.coachingSessionMirror(sess(sb, { approach: 'MOTIVATIONAL_INTERVIEWING' }), ev)).indexOf('PREMATURE_ACTION') >= 0);
    assert.equal(codesOf(sb.coachingSessionMirror(sess(sb, { approach: 'GROW' }), ev)).indexOf('PREMATURE_ACTION'), -1);
    assert.equal(codesOf(sb.coachingSessionMirror(sess(sb, { approach: 'BEHAVIOUR_CHANGE' }), ev)).indexOf('PREMATURE_ACTION'), -1);
  });
  test('C3. holding a boundary is a strength, never a failure', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb),
      [used('OPEN_QUESTION'), { type: 'SAFETY_BOUNDARY_HELD', decision: 'pause', reasonCode: 'scope_boundary' }]);
    const o = m.observations.find(x => x.code === 'BOUNDARY_DISCIPLINE');
    assert.ok(o);
    assert.equal(o.observationType, 'STRENGTH');
    assert.match(o.description, /durdun/);
    // the reason code is kept out of the coach-facing sentence
    assert.equal(o.description.indexOf('scope_boundary'), -1);
    assert.equal(/eksik|başarısız|hata/i.test(o.description + o.title), false);
  });
});

/* ── CROSS-SESSION THRESHOLDS ──────────────────────────────────────────────── */
describe('D. One session never describes a coach', () => {
  const mk = (i, codes, approach) => ({ id: 'coa_x' + i + '-1', approach: approach || 'GROW', context: 'adult',
    lifecycle: 'completed', mirror: { version: 1, codes: codes, strengths: 0, watch: codes.length, generatedAt: '2026-08-30T09:00:00.000Z' } });
  test('D1. one or two sessions produce no pattern claim', () => {
    const sb = createSandbox();
    [1, 2].forEach(n => {
      const r = sb.coachingCrossSessionMirror(Array.from({ length: n }, (_, i) => mk(i, ['QUESTION_STACKING'])));
      deq(r.observations, [], n + ' sessions');
      assert.ok(r.note.length > 10);
    });
    deq(sb.coachingCrossSessionMirror([]).observations, []);
    assert.match(sb.coachingCrossSessionMirror([]).note, /Henüz/);
  });
  test('D2. three sessions may produce a cautious emerging pattern', () => {
    const sb = createSandbox();
    const r = sb.coachingCrossSessionMirror([0, 1, 2].map(i => mk(i, ['QUESTION_STACKING'])));
    const o = r.observations.find(x => x.code === 'QUESTION_STACKING');
    assert.ok(o);
    assert.equal(o.confidence, 'OLUSAN_ORUNTU');
    assert.match(o.description, /olabilir/);
    assert.match(o.evidenceText, /Son 3 uygun görüşmenin 3/);
    assert.equal(/\bSen hep\b|her zaman/.test(o.description), false);
  });
  test('D3. ten sessions allow stronger wording, still without certainty', () => {
    const sb = createSandbox();
    const r = sb.coachingCrossSessionMirror(Array.from({ length: 10 }, (_, i) => mk(i, ['QUESTION_STACKING'])));
    const o = r.observations.find(x => x.code === 'QUESTION_STACKING');
    assert.equal(o.confidence, 'DAHA_GUCLU_ORUNTU');
    assert.match(o.description, /olabilir/);
  });
  test('D4. a code below the ratio is not promoted to a pattern', () => {
    const sb = createSandbox();
    const list = [mk(0, ['QUESTION_STACKING']), mk(1, []), mk(2, []), mk(3, []), mk(4, [])];
    assert.equal(sb.coachingCrossSessionMirror(list).observations.some(o => o.code === 'QUESTION_STACKING'), false);
  });
  test('D5. method rigidity needs history; flexibility is a strength', () => {
    const sb = createSandbox();
    const rigid = sb.coachingCrossSessionMirror([0, 1, 2].map(i => mk(i, [], 'GROW')));
    assert.ok(rigid.observations.some(o => o.code === 'METHOD_RIGIDITY'));
    const flexible = sb.coachingCrossSessionMirror([mk(0, [], 'GROW'), mk(1, [], 'VALUES_BASED'), mk(2, [], 'MOTIVATIONAL_INTERVIEWING')]);
    const f = flexible.observations.find(o => o.code === 'APPROACH_FLEXIBILITY');
    assert.ok(f);
    assert.equal(f.observationType, 'STRENGTH');
    assert.equal(sb.coachingCrossSessionMirror([mk(0, [], 'GROW')]).observations.length, 0);
  });
  test('D6. change over time is described, never claimed as caused', () => {
    const sb = createSandbox();
    const list = [mk(0, ['QUESTION_STACKING']), mk(1, ['QUESTION_STACKING']), mk(2, []), mk(3, [])];
    const t = sb.coachingMirrorTrend(list, 'QUESTION_STACKING');
    assert.ok(t);
    assert.equal(t.direction, 'azaldı');
    assert.match(t.text, /Bir değişim görülüyor/);
    assert.equal(/%|sayesinde|FocusUp .* geliştirdi/i.test(t.text), false);
    assert.equal(sb.coachingMirrorTrend(list.slice(0, 3), 'QUESTION_STACKING'), null);
  });
});

/* ── PRACTICE ──────────────────────────────────────────────────────────────── */
describe('E. One deliberate practice at a time', () => {
  const watchMirror = sb => sb.coachingSessionMirror(sess(sb),
    [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
  test('E1. a watch observation yields exactly one practice', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestPractice(watchMirror(sb), []);
    assert.ok(r.practice);
    assert.equal(r.practice.status, 'ACTIVE');
    assert.equal(r.practice.kind, 'practice');
    assert.ok(r.practice.instruction.length > 20);
    assert.ok(r.practice.why.length > 20);
    assert.ok(r.practice.sourceObservationIds.length >= 1);
  });
  test('E2. an existing active practice blocks a second one', () => {
    const sb = createSandbox();
    const first = sb.coachingSuggestPractice(watchMirror(sb), []).practice;
    const second = sb.coachingSuggestPractice(watchMirror(sb), [first]);
    assert.equal(second.practice, null);
    assert.equal(second.reason, 'already_active');
    assert.equal(second.active.id, first.id);
  });
  test('E3. accept, change and skip are all available and none is punished', () => {
    const sb = createSandbox();
    const p = sb.coachingSuggestPractice(watchMirror(sb), []).practice;
    assert.equal(sb.coachingSetPracticeStatus(p, 'SKIPPED').status, 'SKIPPED');
    assert.ok(sb.coachingSetPracticeStatus(p, 'SKIPPED').completedAt);
    assert.equal(sb.coachingSetPracticeStatus(p, 'COMPLETED').status, 'COMPLETED');
    assert.equal(sb.coachingSetPracticeStatus(p, 'NOPE'), null);
    assert.equal(/ceza|başarısız|kaçırdın|streak|puan/i.test(JSON.stringify(sb.COACHING_PRACTICES)), false);
  });
  test('E4. the self-report is recorded as self-reported, not as proof', () => {
    const sb = createSandbox();
    const p = sb.coachingSuggestPractice(watchMirror(sb), []).practice;
    const r = sb.coachingReportPractice(p, 'KISMEN', 'coa_m6-1');
    assert.equal(r.ok, true);
    assert.equal(r.selfReported, true);
    assert.equal(r.practice.reports[0].outcome, 'KISMEN');
    assert.equal(r.practice.evidenceWindow[0], 'coa_m6-1');
    assert.equal(sb.coachingReportPractice(p, 'MAYBE').ok, false);
  });
  test('E5. a reminder appears once and only where it is relevant', () => {
    const sb = createSandbox();
    const generic = sb.coachingBuildPractice('PRACTICE_REFLECT_BEFORE_ASKING', []);
    assert.ok(sb.coachingPracticeReminder(generic, { context: 'child' }));
    const adultOnly = sb.coachingBuildPractice('PRACTICE_SPACE_AFTER_CHALLENGE', []);
    assert.ok(sb.coachingPracticeReminder(adultOnly, { context: 'executive' }));
    assert.equal(sb.coachingPracticeReminder(adultOnly, { context: 'child' }), null);
    assert.equal(sb.coachingPracticeReminder(sb.coachingSetPracticeStatus(generic, 'COMPLETED'), { context: 'adult' }), null);
    assert.equal(sb.coachingPracticeReminder(null, { context: 'adult' }), null);
  });
  test('E6. no gamification anywhere in the phase', () => {
    [SRC30, SRC31, SRC32].forEach((s, i) =>
      assert.equal(/\bXP\b|streak|rozet|madalya|trophy|leaderboard|seviye atla|level up/i.test(code(s)), false, 'module ' + i));
    assert.equal(createSandbox().coachingPracticeSelfCheck().gamification, false);
  });
});

/* ── ICF ───────────────────────────────────────────────────────────────────── */
describe('F. ICF is a direction, not a verdict', () => {
  test('F1. every category maps to a development area', () => {
    const sb = createSandbox();
    sb.COACHING_MIRROR_CATEGORIES.forEach(c => assert.ok(sb.COACHING_ICF_AREA[c], c));
  });
  test('F2. no level, pass or score is ever claimed', () => {
    const sb = createSandbox();
    const view = sb.coachingIcfDevelopmentView(
      sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]).observations);
    const j = JSON.stringify(view);
    assert.equal(/\bACC\b|\bPCC\b|\bMCC\b|geçti|başarılı oldu|sertifika|%\d/.test(j), false);
    assert.match(view.disclaimer, /resmî bir ICF değerlendirmesi değildir/);
    [SRC30, SRC32].forEach((s, i) => assert.equal(/PCC|MCC|\bACC\b/.test(code(s)), false, 'module ' + i));
  });
  test('F3. areas carry their evidence window', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    const view = sb.coachingIcfDevelopmentView(m.observations);
    const withEvidence = view.areas.filter(a => a.evidenceCount > 0);
    assert.ok(withEvidence.length >= 1);
    withEvidence.forEach(a => { assert.ok(a.area); assert.ok(a.categories.length >= 1); });
  });
});

/* ── EXPLAINABILITY + DISAGREEMENT ─────────────────────────────────────────── */
describe('G. Explainable, and arguable', () => {
  test('G1. the basis is a readable sentence, not a reason code', () => {
    const sb = createSandbox();
    sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')])
      .observations.forEach(o => {
        assert.ok(o.evidenceText.length > 10, o.code);
        assert.equal(/[A-Z]{3,}_[A-Z]{3,}/.test(o.evidenceText), false, o.code + ': ' + o.evidenceText);
        assert.equal(/[a-z]+_[a-z]+/.test(o.evidenceText), false, o.code + ': ' + o.evidenceText);
      });
  });
  test('G2. disagreement is stored and changes nothing else', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    const o = m.observations[0];
    const before = JSON.stringify(sb.coachingMirrorRules().map(r => r.code));
    const fb = sb.coachingBuildFeedback(o, 'INTENTIONAL');
    assert.ok(fb);
    assert.equal(fb.kind, 'feedback');
    assert.equal(fb.observationCode, o.code);
    assert.equal(fb.reasonLabel, 'Bilerek yaptım');
    assert.equal(sb.coachingBuildFeedback(o, 'NONSENSE'), null);
    // the observation still exists and the rule library is untouched
    assert.equal(m.observations.length, sb.coachingSessionMirror(sess(sb),
      [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]).observations.length);
    assert.equal(JSON.stringify(sb.coachingMirrorRules().map(r => r.code)), before);
  });
  test('G3. calibration signals carry structure, never content', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    const fb = sb.coachingBuildFeedback(m.observations[0], 'CONTEXT_DIFFERENT');
    const p = sb.coachingSuggestPractice(m, []).practice;
    const sig = sb.coachingCalibrationSignals([fb, p], [sess(sb, { title: 'GIZLI', subjectRef: 'K-1' })]);
    const j = JSON.stringify(sig);
    ['GIZLI', 'K-1', 'coa_m6-1'].forEach(x => assert.equal(j.indexOf(x), -1, x));
    assert.equal(sig.disputedByReason.CONTEXT_DIFFERENT, 1);
    assert.equal(sig.practicesAccepted, 1);
  });
  test('G4. observations are deterministic for the same evidence', () => {
    const sb = createSandbox();
    const ev = [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')];
    const strip = m => JSON.stringify(m.observations.map(o => [o.code, o.description, o.evidenceText]));
    const first = strip(sb.coachingSessionMirror(sess(sb), ev));
    for (let i = 0; i < 20; i++) assert.equal(strip(sb.coachingSessionMirror(sess(sb), ev)), first);
  });
});

/* ── PRIVACY / EXPORT / STATIC ─────────────────────────────────────────────── */
describe('H. Privacy, export and gates', () => {
  test('H1. no transcript, microphone, speech or LLM anywhere in the phase', () => {
    P6_FILES.forEach(f => {
      const c = code(F(f));
      [[/getUserMedia|MediaRecorder|webkitSpeechRecognition|SpeechRecognition/, 'capture'],
       [/openai|anthropic|gemini|apiKey/i, 'ai'],
       [/fetch\s*\(|XMLHttpRequest|WebSocket/, 'network'],
       [/localStorage|sessionStorage|indexedDB/, 'storage'],
       [/\bD\.\w+\s*=[^=]/, 'payload write'], [/INIT\.\w/, 'payload field'],
       [/CLOUD\.db/, 'persistent instance'], [/console\./, 'logging']].forEach(([re, n]) =>
        assert.equal(re.test(c), false, f + ': ' + n));
    });
    const sc = createSandbox().coachingMirrorSelfCheck();
    assert.equal(sc.transcriptAnalysis, false);
    assert.equal(sc.privateNoteAnalysis, false);
  });
  test('H2. mirror data leaves D and localStorage untouched', () => {
    const sb = createSandbox();
    const before = sb.canonicalStringify(sb.D);
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    sb.coachingCrossSessionMirror([]); sb.coachingIcfDevelopmentView(m.observations);
    sb.coachingSuggestPractice(m, []); sb.coachingMirrorSelfCheck();
    assert.equal(sb.canonicalStringify(sb.D), before);
    assert.equal(JSON.stringify(sb.localStorage).indexOf('obs_'), -1);
  });
  test('H3. exports carry mirror shape at the right depth', () => {
    const sb = createSandbox();
    const s = Object.assign(sess(sb, { subjectRef: 'K-01' }),
      { mirror: { version: 1, codes: ['QUESTION_STACKING'], strengths: 1, watch: 1, generatedAt: '2026-08-30T09:00:00.000Z' } });
    const meta = sb.coachingRedactSession(s, 'metadata_only');
    assert.equal(meta.mirror.watch, 1);
    assert.equal('codes' in meta.mirror, false, 'metadata scope carries counts, not codes');
    assert.equal(JSON.stringify(meta).indexOf('K-01'), -1);
    const der = sb.coachingRedactSession(s, 'deidentified_derived');
    deq(der.mirrorCodes, ['QUESTION_STACKING']);
    assert.equal(JSON.stringify(der).indexOf('K-01'), -1);
    const full = sb.coachingRedactSession(s, 'full_owner_export');
    deq(full.mirror.codes, ['QUESTION_STACKING']);
    assert.equal(full.subjectRef, 'K-01');
  });
  test('H4. the export contract still refuses plaintext for the full scope', () => {
    const sb = createSandbox();
    assert.equal(sb.COACHING_EXPORT_VERSION, 2);
    const plan = sb.coachingExportPlan('full_owner_export', { explicitConsent: true });
    assert.equal(plan.blocked, 'passphrase_required_for_this_scope');
    assert.equal(plan.includes.developmentRecords, true);
    assert.equal(sb.coachingExportPlan('metadata_only', { explicitConsent: true }).includes.developmentRecords, false);
    assert.equal(sb.coachingExportPolicy().transcriptsIncluded, false);
  });
  test('H5. mirror storage uses the canonical chokepoint and the coaching client', () => {
    const store = code(F('27-coaching-session-store.js'));
    assert.match(store, /coachingSaveObservations/);
    assert.match(store, /coachingWriteGuard\('write', session, \{type:'mirror'\}\)/);
    assert.equal(/CLOUD\.db/.test(store), false);
    // the UI never writes directly
    P6_FILES.forEach(f => assert.equal(/\w\.set\(|\.collection\(/.test(exec(F(f))), false, f));
  });
  test('H6. legacy coaching is never mirrored', () => {
    const sb = createSandbox();
    assert.equal(sb.D.coaching.length, 1);
    assert.equal(sb.D.questions.length, 1);
    P6_FILES.forEach(f => assert.equal(/D\.coaching|D\.questions/.test(code(F(f))), false, f));
  });
  test('H7. mirrors, sizes, wiring and cache-bust tags', () => {
    P6_FILES.forEach(f => {
      const a = F(f);
      assert.equal(a, fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
      assert.ok(a.split('\n').length < 900, f);
      assert.equal((INDEX.match(new RegExp(f.replace(/\./g, '\\.'), 'g')) || []).length, 1, f);
      /* current-era tag, not this phase's: a later phase that changes a module
         is expected to re-tag it — that is what the cache-bust gate is for */
      assert.match(INDEX, new RegExp(f.replace(/\./g, '\\.') + '\\?v=2026\\.08-[a-z0-9-]+'), f);
    });
    assert.equal(INDEX, fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(INDEX.indexOf('30-coaching-mirror.js') < INDEX.indexOf('31-coaching-practice.js'));
    assert.ok(INDEX.indexOf('32-coaching-mirror-ui.js') < INDEX.indexOf('12-render-boot.js'));
    const boot = F('12-render-boot.js');
    assert.match(boot, /coachmirror:function\(\)/);
    assert.match(boot, /coachdev:function\(\)/);
  });
  test('H8. the development collection is owner-scoped and rule-protected', () => {
    const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    assert.match(rules, /match \/coachingDevelopment\/\{devDoc\}/);
    const block = rules.slice(rules.indexOf('match /coachingDevelopment/'));
    ['read', 'write', 'delete'].forEach(cap =>
      assert.ok(block.indexOf("pilCoachingCan(request.auth.uid, userId, '" + cap + "')") >= 0, cap));
    assert.equal(/'state'/.test(block.slice(0, block.indexOf('}'))), false);
  });
});

/* ── UI ────────────────────────────────────────────────────────────────────── */
describe('I. Mirror UI', () => {
  const pinner = sb => (sb.__getElements().pinner || {}).innerHTML || '';
  function withMirror(sb, mirror, practice) {
    sb.COACHING_UI.mirror = mirror; sb.COACHING_UI.practice = practice || null;
    sb.renderCoachingMirror(); return pinner(sb);
  }
  test('I1. three sections, no score, no raw enums', () => {
    const sb = createSandbox();
    const s = Object.assign(sess(sb), { lifecycle: 'completed' });
    const m = sb.coachingSessionMirror(s, [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('REFLECTION')],
      { coacheeCommitment: true, insightRecorded: true });
    const html = withMirror(sb, m, sb.coachingSuggestPractice(m, []).practice);
    assert.ok(html.indexOf('Görüşme Aynası') >= 0);
    assert.ok(html.indexOf('İyi yaptığın şey') >= 0);
    assert.ok(html.indexOf('Dikkat etmeye değer') >= 0);
    assert.ok(html.indexOf('Bir sonraki görüşmede dene') >= 0);
    assert.ok(html.indexOf('Neye dayanıyor?') >= 0);
    ['QUESTION_STACKING', 'OBSERVED', 'INFERRED', 'STRENGTH', 'WATCH', 'SINIRLI_KANIT', 'OPEN_QUESTION']
      .forEach(t => assert.equal(html.indexOf('>' + t + '<'), -1, t));
    assert.equal(/\d+\s*\/\s*100|%\d/.test(html), false);
  });
  test('I2. the ICF disclaimer is present and accept/change/skip are offered', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    const html = withMirror(sb, m, sb.coachingSuggestPractice(m, []).practice);
    assert.ok(html.indexOf('resmî bir ICF değerlendirmesi değildir') >= 0);
    ['Kabul et', 'Değiştir', 'Şimdi değil'].forEach(t => assert.ok(html.indexOf(t) >= 0, t));
    assert.ok(html.indexOf('Bu gözlem bana uymuyor') >= 0);
  });
  test('I3. insufficient evidence produces a sentence, not an empty accusation', () => {
    const sb = createSandbox();
    const html = withMirror(sb, sb.coachingSessionMirror(sess(sb), []), null);
    assert.ok(html.indexOf('yeterli yapılandırılmış kanıt yok') >= 0);
    assert.equal(html.indexOf('Dikkat etmeye değer'), -1);
  });
  test('I4. changing the practice cycles the catalogue without losing provenance', () => {
    const sb = createSandbox();
    const m = sb.coachingSessionMirror(sess(sb), [used('OPEN_QUESTION'), used('OPEN_QUESTION'), used('OPEN_QUESTION')]);
    sb.COACHING_UI.mirror = m;
    sb.COACHING_UI.practice = sb.coachingSuggestPractice(m, []).practice;
    const first = sb.COACHING_UI.practice.code;
    sb.coachingChangePractice();
    assert.notEqual(sb.COACHING_UI.practice.code, first);
    assert.ok(sb.COACHING_UI.practice.sourceObservationIds.length >= 1);
  });
  test('I5. the development view is calm and early states are honest', () => {
    const sb = createSandbox();
    sb.COACHING_UI.devCross = sb.coachingCrossSessionMirror([]);
    sb.COACHING_UI.activePractice = null;
    sb.renderCoachingDevelopment();
    const html = pinner(sb);
    assert.ok(html.indexOf('Gelişimim') >= 0);
    assert.ok(html.indexOf('Puan yok') >= 0);
    assert.ok(html.indexOf('Henüz değerlendirme için tamamlanmış görüşme yok') >= 0);
    assert.ok(html.indexOf('Şu an açık bir pratiğin yok') >= 0);
    assert.equal(/XP|Seviye \d|streak|rozet/i.test(html), false);
  });
  test('I6. the coach reflects before the mirror speaks', () => {
    const live = code(F('29-coaching-live.js'));
    const closeIdx = live.indexOf('coach_reflect');
    const mirrorIdx = live.indexOf('coachingGenerateMirror');
    assert.ok(closeIdx > 0 && mirrorIdx > closeIdx, 'the mirror must be generated after the reflection form');
    assert.match(live, /coachingGenerateMirror\(res\.session/);
    assert.equal(createSandbox().coachingMirrorUiSelfCheck().reflectionBeforeMirror, true);
  });
});
