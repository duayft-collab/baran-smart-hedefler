'use strict';
/* COACHING MASTERY OS — PHASE 4 (Approach Library + Context Router) tests.
   Guarantees: ten approaches under one schema bridged into the Phase 1 registry
   (not a second methodology store), honest three-part evidence grading, a
   deterministic router that recommends at most three approaches with readable
   reasons and no fake precision, deliberate compatibleApproaches tagging over
   the SAME 164 canonical interventions, and Phase 2 safety that still wins. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const SRC24 = F('24-coaching-approaches.js'), SRC25 = F('25-coaching-router.js');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const P4_FILES = ['24-coaching-approaches.js', '25-coaching-router.js', '26-coaching-archive.js'];
const CANON = ['GROW', 'SOLUTION_FOCUSED', 'MOTIVATIONAL_INTERVIEWING', 'SOCRATIC_GUIDED_DISCOVERY',
  'STRENGTHS_BASED', 'VALUES_BASED', 'BEHAVIOUR_CHANGE', 'DEVELOPMENTAL_EXECUTIVE',
  'CAREER_COACHING', 'NARRATIVE_REFLECTIVE'];

function deq(a, e, m) { assert.deepEqual(JSON.parse(JSON.stringify(a)), e, m); }
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
const route = (sb, i) => sb.coachingRouteApproaches(i);
const ids = r => (r.approaches || []).map(a => a.approachId);
const sess = (sb, ctx, consent) => sb.coachingBuildSession({
  context: ctx || 'adult',
  safeguard: consent ? { guardianConsent: { state: 'granted' } } : undefined
}, { now: '2026-08-29T09:00:00.000Z', id: 'coa_p4-1' }).session;

/* ── REGISTRY ─────────────────────────────────────────────────────────────── */
describe('A. Approach registry', () => {
  test('A1. the ten canonical approaches exist under one schema', () => {
    const sb = createSandbox();
    deq(sb.coachingApproachIds(), CANON.slice().sort());
    const keys = Object.keys(sb.coachingApproach('GROW')).sort();
    CANON.forEach(id => deq(Object.keys(sb.coachingApproach(id)).sort(), keys, id));
    ['id', 'title', 'shortTitle', 'description', 'bestFor', 'notBestFor', 'applicableContexts',
     'compatibleStages', 'compatiblePurposes', 'preferredInterventionTypes', 'cautionInterventionTypes',
     'contraindications', 'minorPolicy', 'evidenceGrade', 'evidenceBasis', 'professionalSourceIds',
     'corePrinciples', 'coachStance', 'active', 'order'].forEach(k => assert.ok(keys.indexOf(k) >= 0, k));
  });
  test('A2. there is no second methodology store — Phase 4 fills the Phase 1 registry', () => {
    const sb = createSandbox();
    deq(sb.coachingApproachKeys(), CANON.slice().sort());        // Phase 1 registry == Phase 4 ids
    deq(sb.coachingApproachIds(), CANON.slice().sort());
    CANON.forEach(id => assert.equal(sb.coachingValidApproach(id), true, id));
    assert.equal(sb.coachingBuildSession({ context: 'adult', approach: 'GROW' }).session.approach, 'GROW');
    assert.match(code(SRC24), /coachingRegisterApproach\(/);
  });
  test('A3. approach and context namespaces still cannot collide', () => {
    const sb = createSandbox();
    CANON.forEach(id => assert.equal(sb.coachingValidContext(id), false, id));
    assert.equal(sb.coachingRegisterApproach('child').error, 'APPROACH_SHADOWS_CONTEXT');
  });
  test('A4. invalid approach definitions are refused with a reason', () => {
    const sb = createSandbox();
    const base = { id: 'TEST_ONE', minorPolicy: 'permitted', evidence: {
      coachingGenerally: { grade: 'B', note: 'yeterince uzun bir gerekçe metni burada' },
      underlyingPrinciple: { grade: 'B', note: 'yeterince uzun bir gerekçe metni burada' },
      namedMethodology: { grade: 'C', note: 'yeterince uzun bir gerekçe metni burada' },
      caution: 'yeterince uzun bir uyarı metni burada durur' } };
    const bad = (over, err) => assert.equal(sb.coachingRegisterApproachDef(Object.assign({}, base, over)).error, err, err);
    bad({ id: 'lower' }, 'INVALID_APPROACH_ID');
    bad({ id: 'GROW' }, 'DUPLICATE_APPROACH:GROW');
    bad({ minorPolicy: 'maybe' }, 'INVALID_MINOR_POLICY');
    bad({ compatibleStages: ['G'] }, 'INVALID_STAGE:G');
    bad({ compatiblePurposes: ['VIBES'] }, 'INVALID_PURPOSE:VIBES');
    bad({ preferredInterventionTypes: ['TELEPATHY'] }, 'INVALID_TYPE:TELEPATHY');
    bad({ professionalSourceIds: ['nope'] }, 'UNKNOWN_SOURCE:nope');
  });
  test('A5. every approach names verifiable professional sources', () => {
    const sb = createSandbox();
    sb.coachingApproachList().forEach(a => {
      assert.ok(a.professionalSourceIds.length >= 1, a.id);
      a.professionalSourceIds.forEach(s => assert.ok(sb.coachingSource(s), a.id + ' -> ' + s));
      assert.ok(a.description.length > 40, a.id);
      assert.ok(a.bestFor.length >= 3 && a.notBestFor.length >= 2, a.id);
      assert.ok(a.corePrinciples.length >= 3 && a.coachStance.length > 10, a.id);
    });
    assert.equal(/©|all rights reserved/i.test(SRC24), false);
  });
});

/* ── EVIDENCE ─────────────────────────────────────────────────────────────── */
describe('B. Evidence discipline', () => {
  test('B1. three claims are kept apart and each is justified', () => {
    const sb = createSandbox();
    sb.coachingApproachList().forEach(a => {
      const e = a.evidenceBasis;
      ['coachingGenerally', 'underlyingPrinciple', 'namedMethodology'].forEach(k => {
        assert.ok(sb.coachingValidGrade(e[k].grade), a.id + '.' + k);
        assert.ok(e[k].note.length >= 20, a.id + '.' + k);
      });
      assert.ok(e.caution.length >= 20, a.id);
      assert.equal(a.evidenceGrade, e.namedMethodology.grade, a.id);
    });
  });
  test('B2. NO named methodology is graded A — popularity is not evidence', () => {
    const sb = createSandbox();
    sb.coachingApproachList().forEach(a =>
      assert.notEqual(a.evidenceBasis.namedMethodology.grade, 'A', a.id));
    const bad = sb.coachingRegisterApproachDef({ id: 'TEST_A', minorPolicy: 'permitted', evidence: {
      coachingGenerally: { grade: 'A', note: 'yeterince uzun bir gerekçe metni burada' },
      underlyingPrinciple: { grade: 'A', note: 'yeterince uzun bir gerekçe metni burada' },
      namedMethodology: { grade: 'A', note: 'yeterince uzun bir gerekçe metni burada' },
      caution: 'yeterince uzun bir uyarı metni burada durur' } });
    assert.equal(bad.error, 'NAMED_METHODOLOGY_CANNOT_BE_GRADE_A');
  });
  test('B3. therapy provenance is flagged rather than borrowed as proof', () => {
    const sb = createSandbox();
    assert.match(sb.coachingApproach('SOLUTION_FOCUSED').evidenceBasis.caution, /terapi|Terapi/);
    assert.match(sb.coachingApproach('NARRATIVE_REFLECTIVE').evidenceBasis.caution, /[Tt]erapi/);
    assert.match(sb.coachingSource('sfbt.origin').note, /THERAPY/);
    assert.match(sb.coachingSource('narrative.practice').note, /THERAPY/);
    assert.match(sb.coachingSource('cbt.guided_discovery').note, /CLINICAL/);
  });
  test('B4. no fabricated scientific certainty anywhere in the library', () => {
    assert.equal(/bilimsel olarak kanıtlan|scientifically proven|herkes için işe yarar|kesin sonuç/i.test(SRC24), false);
    assert.equal(/%\d/.test(SRC24 + SRC25), false);
  });
  test('B5. MI is documented as a stance, never as persuasion', () => {
    const sb = createSandbox();
    const mi = sb.coachingApproach('MOTIVATIONAL_INTERVIEWING');
    assert.match(mi.evidenceBasis.caution, /ikna/);
    assert.ok(mi.contraindications.some(c => /ikna/.test(c)));
    assert.equal(mi.evidenceBasis.underlyingPrinciple.grade, 'A');
    assert.equal(mi.evidenceBasis.namedMethodology.grade, 'B');
  });
  test('B6. values work is never a personality diagnosis', () => {
    const sb = createSandbox();
    const v = sb.coachingApproach('VALUES_BASED');
    assert.match(v.evidenceBasis.caution, /teşhis|DEĞİLDİR/i);
    assert.ok(v.contraindications.some(c => /gerçek değerin|profil/.test(c)));
  });
});

/* ── TAGGING / PHASE 3 INTEGRATION ────────────────────────────────────────── */
describe('C. compatibleApproaches over the canonical registry', () => {
  test('C1. the same 164 interventions are reused — no approach-specific copies', () => {
    const sb = createSandbox();
    const st = sb.coachingInterventionStats();
    assert.equal(st.total, 164);
    assert.equal(st.questions, 144);
    assert.equal(sb.coachingIntervention('q.goal.define').id, 'q.goal.define');
    assert.equal(/COACHING_QUESTION|questionBank|_ROWS\s*=|text\s*:\s*'[^']{20,}/.test(code(SRC24)), false);
  });
  test('C2. tagging is deliberate, not "every method on every question"', () => {
    const sb = createSandbox();
    const s = sb.coachingApproachStats();
    assert.ok(s.avgPerIntervention <= 3, 'avg=' + s.avgPerIntervention);
    assert.ok(s.maxPerIntervention <= 7, 'max=' + s.maxPerIntervention);
    assert.ok(s.untagged > 0, 'some generic moves should belong to no single approach');
    sb.coachingInterventionList().forEach(x =>
      assert.notEqual(x.compatibleApproaches.length, CANON.length, x.id + ' tagged with everything'));
  });
  test('C3. tagging is deterministic and idempotent', () => {
    const sb = createSandbox();
    const before = JSON.stringify(sb.coachingInterventionList().map(x => x.compatibleApproaches));
    sb.coachingApplyApproachTags(); sb.coachingApplyApproachTags();
    assert.equal(JSON.stringify(sb.coachingInterventionList().map(x => x.compatibleApproaches)), before);
  });
  test('C4. Phase 3 modules do not populate approach tags themselves', () => {
    ['20-coaching-interventions.js', '21-coaching-question-bank.js', '23-coaching-suggest.js'].forEach(f => {
      const c = code(F(f));
      assert.equal(/compatibleApproaches\s*(\.push|=\s*\[['"])/.test(c), false, f);
    });
    assert.match(code(SRC24), /compatibleApproaches\.push/);
  });
  test('C5. an approach barred for minors never tags a minor-only move', () => {
    const sb = createSandbox();
    sb.coachingInterventionList().forEach(x => {
      const minorOnly = x.applicableContexts.length &&
        x.applicableContexts.every(c => c === 'child' || c === 'youth');
      if (minorOnly) assert.equal(x.compatibleApproaches.indexOf('DEVELOPMENTAL_EXECUTIVE'), -1, x.id);
    });
  });
  test('C6. an approach lens changes ranking without bypassing it', () => {
    const sb = createSandbox();
    const plain = sb.coachingSuggestMoves({ context: 'adult', stage: 'COMMITMENT' });
    const withBc = sb.coachingSuggestMoves({ context: 'adult', stage: 'COMMITMENT', approach: 'BEHAVIOUR_CHANGE' });
    assert.notEqual(JSON.stringify(plain.suggestions.map(s => s.intervention.id)),
      JSON.stringify(withBc.suggestions.map(s => s.intervention.id)));
    assert.equal(withBc.approach, 'BEHAVIOUR_CHANGE');
    assert.ok(withBc.suggestions.some(s => s.whyNow.indexOf('BEHAVIOUR_CHANGE') >= 0));
    assert.equal(sb.coachingSuggestMoves({ context: 'adult', stage: 'COMMITMENT', approach: 'NOPE' }).approach, null);
  });
  test('C7. an approach cannot force an unsafe or child-unsafe move through', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({ context: 'child', stage: 'AWARENESS', approach: 'DEVELOPMENTAL_EXECUTIVE' });
    r.suggestions.forEach(s => {
      const x = sb.coachingIntervention(s.intervention.id);
      assert.equal(x.minorSafe, true, x.id);
      assert.ok(x.applicableContexts.indexOf('child') >= 0, x.id);
    });
    assert.equal(r.suggestions.some(s => s.intervention.type === 'CHALLENGE'), false);
  });
  test('C8. Phase 3 diversity rules survive an approach preference', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({
      context: 'adult', stage: 'DEEPENING', approach: 'GROW',
      recentMoves: [{ type: 'OPEN_QUESTION' }, { type: 'OPEN_QUESTION' }]
    });
    assert.ok(sb.COACHING_SPACE_TYPES.indexOf(r.suggestions[0].intervention.type) >= 0,
      'got ' + r.suggestions[0].intervention.type);
  });
});

/* ── ROUTER ───────────────────────────────────────────────────────────────── */
describe('D. Context router', () => {
  test('D1. at most three approaches, usually one primary plus one secondary', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'adult', ambivalence: 'high', valuesConflict: 'high',
      careerContext: 'yes', meaningIdentityContext: 'yes', strengthsOpportunity: 'high',
      behaviourChangeNeed: 'high', leadershipContext: 'yes', clarity: 'high', readinessForAction: 'high' });
    assert.ok(r.approaches.length <= 3, r.approaches.length);
    assert.equal(sb.COACHING_ROUTER_MAX, 3);
    assert.equal(r.approaches[0].role, 'primary');
    if (r.approaches[1]) assert.equal(r.approaches[1].role, 'secondary');
  });
  test('D2. deterministic across repeated calls', () => {
    const sb = createSandbox();
    const q = { personContext: 'adult', ambivalence: 'high', readinessForAction: 'low', conversationStage: 'EXPLORING' };
    const first = JSON.stringify(route(sb, q));
    for (let i = 0; i < 25; i++) assert.equal(JSON.stringify(route(sb, q)), first);
  });
  test('D3. explainable output with honest confidence bands, no fake precision', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'adult', ambivalence: 'high', readinessForAction: 'low',
      currentPurpose: 'OWNERSHIP', conversationStage: 'EXPLORING', clarity: 'low' });
    r.approaches.forEach(a => {
      ['approachId', 'title', 'whyNow', 'confidenceBand', 'suitablePurposes',
       'preferredInterventionTypes', 'cautions', 'safetyStatus'].forEach(k => assert.ok(a[k] !== undefined, k));
      assert.ok(sb.COACHING_CONFIDENCE.indexOf(a.confidenceBand) >= 0, a.confidenceBand);
      assert.ok(a.whyNow.length > 20);
      assert.equal(/%|\bscore\b|\bpuan\b/i.test(a.whyNow), false);
      assert.ok(a.evidenceCaution.length > 20);
    });
    assert.equal(/\d+(\.\d+)?%/.test(JSON.stringify(r)), false);
  });
  test('D4. confidence never rises as you go down the list', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'executive', clarity: 'high', readinessForAction: 'high',
      leadershipContext: 'yes', coachingGoalType: 'performance', conversationStage: 'OPTIONS' });
    const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    for (let i = 1; i < r.approaches.length; i++)
      assert.ok(rank[r.approaches[i].confidenceBand] <= rank[r.approaches[i - 1].confidenceBand]);
  });
  test('D5. unknown stays unknown — no context invents no recommendation', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'adult' });
    deq(r.approaches, []);
    assert.ok(r.notes.join(' ').indexOf('uydurulmaz') >= 0);
    assert.equal(r.knownSignals, 0);
    const junk = route(sb, { personContext: 'adult', ambivalence: 'banana', clarity: 42, careerContext: {} });
    assert.equal(junk.knownSignals, 0);
    assert.equal(junk.allowed, true);
  });
  test('D6. thin context is never reported as high confidence', () => {
    const sb = createSandbox();
    route(sb, { personContext: 'adult', ambivalence: 'high' }).approaches
      .forEach(a => assert.notEqual(a.confidenceBand, 'HIGH', a.approachId));
  });
  test('D7. staying in one frame too long is penalised', () => {
    const sb = createSandbox();
    const q = { personContext: 'adult', ambivalence: 'high', readinessForAction: 'low', conversationStage: 'EXPLORING' };
    const fresh = route(sb, q);
    const stuck = route(sb, Object.assign({}, q, {
      recentApproaches: ['MOTIVATIONAL_INTERVIEWING', 'MOTIVATIONAL_INTERVIEWING', 'MOTIVATIONAL_INTERVIEWING'] }));
    assert.equal(fresh.approaches[0].approachId, 'MOTIVATIONAL_INTERVIEWING');
    assert.ok(stuck.approaches.some(a => /tek çerçevede/.test(a.whyNow)) ||
      stuck.approaches[0].approachId !== 'MOTIVATIONAL_INTERVIEWING');
  });
});

/* ── ROUTING FIXTURES ─────────────────────────────────────────────────────── */
describe('E. Locked routing cases', () => {
  const sb0 = createSandbox();
  const CASES = [
    ['1 ambivalence → MI', { ambivalence: 'high', readinessForAction: 'low', conversationStage: 'EXPLORING' }, 'MOTIVATIONAL_INTERVIEWING', 0],
    ['2 clear performance goal → GROW', { personContext: 'executive', clarity: 'high', readinessForAction: 'high', leadershipContext: 'yes', coachingGoalType: 'performance', conversationStage: 'OPTIONS' }, 'GROW', null],
    ['2b same case surfaces Executive too', { personContext: 'executive', clarity: 'high', readinessForAction: 'high', leadershipContext: 'yes', coachingGoalType: 'performance', conversationStage: 'OPTIONS' }, 'DEVELOPMENTAL_EXECUTIVE', null],
    ['3 career + values conflict → Career', { careerContext: 'yes', valuesConflict: 'high', conversationStage: 'OPTIONS', currentPurpose: 'DECISION' }, 'CAREER_COACHING', 0],
    ['3b ...with Values as the lens', { careerContext: 'yes', valuesConflict: 'high', conversationStage: 'OPTIONS', currentPurpose: 'DECISION' }, 'VALUES_BASED', null],
    ['4 assumption → Socratic', { personContext: 'executive', assumptionExplorationNeeded: 'high', leadershipContext: 'yes', conversationStage: 'AWARENESS', currentPurpose: 'ASSUMPTION' }, 'SOCRATIC_GUIDED_DISCOVERY', 0],
    ['5 exceptions/resources → Strengths', { strengthsOpportunity: 'high', conversationStage: 'DEEPENING', currentPurpose: 'EXCEPTION' }, 'STRENGTHS_BASED', null],
    ['5b ...and Solution-Focused', { strengthsOpportunity: 'high', conversationStage: 'DEEPENING', currentPurpose: 'EXCEPTION' }, 'SOLUTION_FOCUSED', null],
    ['6 consistency → Behaviour Change', { behaviourChangeNeed: 'high', clarity: 'high', readinessForAction: 'high', ambivalence: 'low', conversationStage: 'COMMITMENT' }, 'BEHAVIOUR_CHANGE', 0],
    ['7 leadership + identity → Executive', { personContext: 'executive', leadershipContext: 'yes', meaningIdentityContext: 'yes', coachingGoalType: 'identity', conversationStage: 'DEEPENING' }, 'DEVELOPMENTAL_EXECUTIVE', 0],
    ['7b ...with Narrative alongside', { personContext: 'executive', leadershipContext: 'yes', meaningIdentityContext: 'yes', coachingGoalType: 'identity', conversationStage: 'DEEPENING' }, 'NARRATIVE_REFLECTIVE', null]
  ];
  CASES.forEach(([label, ctx, expected, atIndex]) => {
    test('E. ' + label, () => {
      const r = route(sb0, Object.assign({ personContext: 'adult' }, ctx));
      const got = ids(r);
      if (atIndex === null) assert.ok(got.indexOf(expected) >= 0, label + ' -> ' + got.join(','));
      else assert.equal(got[atIndex], expected, label + ' -> ' + got.join(','));
    });
  });
  test('E. hybrid pairing is explained', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'adult', careerContext: 'yes', valuesConflict: 'high',
      conversationStage: 'OPTIONS', currentPurpose: 'DECISION' });
    assert.ok(r.approaches.length >= 2);
    assert.ok(r.combination && r.combination.length > 20);
    assert.match(r.combination, /birincil/);
  });
});

/* ── SAFETY ───────────────────────────────────────────────────────────────── */
describe('F. Safety still wins', () => {
  test('F1. stop_and_refer → zero approaches and zero moves', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'adult', ambivalence: 'high', safetyDecision: 'stop_and_refer' });
    assert.equal(r.allowed, false);
    deq(r.approaches, []);
    const full = sb.coachingRecommend({ session: sess(sb, 'adult'),
      event: { type: 'note', text: 'İntihar etmeyi düşünüyorum.' },
      personContext: 'adult', ambivalence: 'high', conversationStage: 'DEEPENING' });
    assert.equal(full.allowed, false);
    deq(full.approaches, []);
    deq(full.moves, []);
    assert.equal(full.safety.decision, 'stop_and_refer');
  });
  test('F2. a pause drops challenge- and reframe-led approaches', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'executive', leadershipContext: 'yes',
      meaningIdentityContext: 'yes', safetyDecision: 'pause', conversationStage: 'AWARENESS' });
    assert.equal(ids(r).indexOf('DEVELOPMENTAL_EXECUTIVE'), -1);
    assert.equal(ids(r).indexOf('NARRATIVE_REFLECTIVE'), -1);
    assert.ok(r.notes.join(' ').indexOf('duraklama') >= 0);
  });
  test('F3. a minor without a guardian state gets no approach at all', () => {
    const sb = createSandbox();
    ['child', 'youth'].forEach(ctx => {
      const r = route(sb, { personContext: ctx, strengthsOpportunity: 'high', conversationStage: 'EXPLORING' });
      assert.equal(r.allowed, false, ctx);
      deq(r.approaches, [], ctx);
      assert.ok(r.notes.join(' ').indexOf('veli') >= 0, ctx);
    });
    const withConsent = route(sb, { personContext: 'child', guardianState: 'granted',
      strengthsOpportunity: 'high', conversationStage: 'EXPLORING' });
    assert.equal(withConsent.allowed, true);
    assert.ok(withConsent.approaches.length >= 1);
  });
  test('F4. the guardian state is also read from the session record', () => {
    const sb = createSandbox();
    const blocked = route(sb, { session: sess(sb, 'child'), personContext: 'child', strengthsOpportunity: 'high' });
    assert.equal(blocked.allowed, false);
    const ok = route(sb, { session: sess(sb, 'child', true), personContext: 'child',
      strengthsOpportunity: 'high', conversationStage: 'EXPLORING' });
    assert.equal(ok.allowed, true);
  });
  test('F5. an approach barred for minors can never rank for a minor', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'youth', guardianState: 'granted', leadershipContext: 'yes',
      meaningIdentityContext: 'yes', conversationStage: 'DEEPENING' });
    assert.equal(ids(r).indexOf('DEVELOPMENTAL_EXECUTIVE'), -1);
    assert.equal(sb.coachingApproachAllowedForContext('DEVELOPMENTAL_EXECUTIVE', 'child'), false);
    assert.equal(sb.coachingApproachAllowedForContext('DEVELOPMENTAL_EXECUTIVE', 'adult'), true);
  });
  test('F6. minor routing carries an adaptation note, not just easier words', () => {
    const sb = createSandbox();
    const r = route(sb, { personContext: 'child', guardianState: 'granted',
      valuesConflict: 'high', conversationStage: 'DEEPENING' });
    assert.ok(r.approaches.some(a => /uyarlanmalı/.test(a.whyNow)));
    sb.coachingApproachList().forEach(a =>
      assert.ok(sb.COACHING_MINOR_POLICIES.indexOf(a.minorPolicy) >= 0, a.id));
  });
  test('F7. no safety bypass tokens and no diagnosis language', () => {
    [SRC24, SRC25].forEach((src, i) => {
      const c = code(src);
      assert.equal(/bypassSafety|skipSafety|forceApproach|ignoreSafety/.test(c), false, i);
      assert.equal(/depresyon|anksiyete|bipolar|teşhis koy|tanı koy/i.test(c), false, i);
    });
    assert.match(code(SRC25), /coachingSafetyEvaluate\(/);
  });
});

/* ── FULL CHAIN + STATIC ──────────────────────────────────────────────────── */
describe('G. Full chain, privacy and static guards', () => {
  test('G1. context → safety → approach → moves, in that order', () => {
    const sb = createSandbox();
    const r = sb.coachingRecommend({ session: sess(sb, 'adult'),
      event: { type: 'note', text: 'Spor yapmam gerektiğini biliyorum ama sürekli erteliyorum.' },
      personContext: 'adult', ambivalence: 'high', readinessForAction: 'low', conversationStage: 'EXPLORING' });
    assert.equal(r.approaches[0].approachId, 'MOTIVATIONAL_INTERVIEWING');
    assert.ok(r.moves.length > 0 && r.moves.length <= 3);
    assert.ok(r.moves.every(m => m.whyNow && m.whyNow.length > 10));
    assert.equal(r.safety.decision, 'allow');
  });
  test('G2. the whole chain leaves D byte-identical and persists nothing', () => {
    const sb = createSandbox();
    const before = sb.canonicalStringify(sb.D);
    sb.coachingRecommend({ personContext: 'adult', ambivalence: 'high', conversationStage: 'EXPLORING' });
    sb.coachingApproachesSelfCheck(); sb.coachingRouterSelfCheck(); sb.coachingApproachStats();
    assert.equal(sb.canonicalStringify(sb.D), before);
    assert.equal(sb.coachingStoreCount(), 0);
    assert.equal(sb.D.coachingSessions, undefined);
  });
  test('G3. no network, AI, storage, timers, DOM or payload writes', () => {
    P4_FILES.forEach(f => {
      const c = code(F(f));
      [[/fetch\s*\(/, 'fetch'], [/XMLHttpRequest|WebSocket|EventSource/, 'socket'], [/localStorage/, 'storage'],
       [/setTimeout|setInterval/, 'timer'], [/openai|anthropic|gemini|apiKey/i, 'ai'],
       [/\bD\.\w+\s*=[^=]/, 'payload write'], [/INIT\.\w/, 'payload field'],
       [/CLOUD\.db/, 'firestore'], [/document\.|innerHTML/, 'dom']
      ].forEach(([re, name]) => assert.equal(re.test(c), false, f + ': ' + name));
    });
  });
  test('G4. legacy screen and data untouched, no new navigation entry', () => {
    const sb = createSandbox();
    assert.equal(sb.D.coaching.length, 1);
    assert.equal(sb.D.coaching[0].title, 'OKR Sistemi');
    assert.equal(sb.D.questions.length, 1);
    assert.equal(sb.COACHING.enabled, true);   // live since Phase 5
    const ui = fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8');
    const navBlock = ui.slice(ui.indexOf('var NAV=['), ui.indexOf('function renderNav'));
    assert.equal((navBlock.match(/\{id:'/g) || []).length, 31);
    assert.equal(/approach|router|GROW/i.test(navBlock), false);
  });
  test('G5. mirrors byte-identical, size limits, wired once, in order', () => {
    P4_FILES.forEach(f => {
      const a = F(f);
      assert.equal(a, fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
      assert.ok(a.split('\n').length < 900, f);
      assert.equal((INDEX.match(new RegExp(f.replace(/\./g, '\\.'), 'g')) || []).length, 1, f);
    });
    assert.equal(INDEX, fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(INDEX.indexOf('23-coaching-suggest.js') < INDEX.indexOf('24-coaching-approaches.js'));
    assert.ok(INDEX.indexOf('24-coaching-approaches.js') < INDEX.indexOf('25-coaching-router.js'));
  });
  test('G6. every coaching module carries a cache-bust tag from the phase that changed it', () => {
    // Phase 4's own untouched modules still carry the p4 tag
    ['23-coaching-suggest.js', '24-coaching-approaches.js', '25-coaching-router.js'].forEach(f =>
      assert.match(INDEX, new RegExp(f.replace(/\./g, '\\.') + '\\?v=2026\\.08-coaching-p4'), f));
    // modules a later phase touched carry that phase's tag instead — the invariant
    // is that every coaching module has a valid one, not that it never moves
    ['18-coaching-ethics.js', '26-coaching-archive.js', '17-coaching-domain.js'].forEach(f =>
      assert.match(INDEX, new RegExp(f.replace(/\./g, '\\.') + '\\?v=2026\\.08-[a-z0-9-]+'), f));
    // no coaching module ships without a current-era tag (a later phase may
    // re-tag a module it changes, which is the point of the cache-bust gate)
    (INDEX.match(/js\/\d+[a-z]?-coaching-[^"]*/g) || []).forEach(src =>
      /* any current-era phase tag: a later phase re-tags a module it changes */
      assert.match(src, /\?v=2026\.08-[a-z]+-[a-z0-9]+/, src));
  });
});
