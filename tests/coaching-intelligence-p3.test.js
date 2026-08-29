'use strict';
/* COACHING MASTERY OS — PHASE 3 (Question & Intervention Intelligence) tests.
   Guarantees: one canonical registry where a question is an intervention
   subtype, a curated original seed library that survives its own analyzer,
   explainable anti-pattern detection, a deterministic ranking engine that can
   say "not another question", and Phase 2 safety that no move can slip past. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const SRC20 = F('20-coaching-interventions.js'), SRC21 = F('21-coaching-question-bank.js');
const SRC22 = F('22-coaching-quality.js'), SRC23 = F('23-coaching-suggest.js');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const P3_FILES = ['20-coaching-interventions.js', '21-coaching-question-bank.js',
  '22-coaching-quality.js', '23-coaching-suggest.js'];

function deq(a, e, m) { assert.deepEqual(JSON.parse(JSON.stringify(a)), e, m); }
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
const CANON_TYPES = ['OPEN_QUESTION', 'REFLECTION', 'PARAPHRASE', 'SUMMARY', 'AFFIRMATION', 'SILENCE',
  'OBSERVATION', 'CHALLENGE', 'REFRAME', 'SCALING', 'PERMISSION_BASED_INFORMATION', 'ACTION_COMMITMENT'];

/* ── REGISTRY ─────────────────────────────────────────────────────────────── */
describe('R. Canonical intervention registry', () => {
  test('R1. all twelve canonical move types exist and each is exercisable', () => {
    const sb = createSandbox();
    deq(sb.coachingInterventionTypeKeys().slice().sort(), CANON_TYPES.slice().sort());
    const byType = sb.coachingInterventionStats().byType;
    CANON_TYPES.forEach(t => assert.ok(byType[t] >= 1, 'no instance of ' + t));
    assert.equal(sb.coachingTypeIsQuestion('OPEN_QUESTION'), true);
    CANON_TYPES.filter(t => t !== 'OPEN_QUESTION').forEach(t =>
      assert.equal(sb.coachingTypeIsQuestion(t), false, t));
  });
  test('R2. a question is an intervention subtype, not a parallel system', () => {
    const sb = createSandbox();
    const q = sb.coachingIntervention('q.goal.define');
    const r = sb.coachingIntervention('reflect.mirror');
    assert.equal(q.type, 'OPEN_QUESTION');
    assert.equal(q.isQuestion, true);
    assert.equal(r.isQuestion, false);
    deq(Object.keys(q).sort(), Object.keys(r).sort());   // one schema for both
    assert.equal(/QUESTION_REGISTRY|questionBank\s*=|QUESTIONS\s*=\s*\{/.test(code(SRC21)), false);
  });
  test('R3. ids are unique and duplicates are refused', () => {
    const sb = createSandbox();
    const ids = sb.coachingInterventionIds();
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(sb.coachingRegisterIntervention({ id: 'q.goal.define', type: 'SILENCE' }).error, 'DUPLICATE_ID:q.goal.define');
  });
  test('R4. invalid records are refused with a specific reason', () => {
    const sb = createSandbox();
    const bad = (d, e) => assert.equal(sb.coachingRegisterIntervention(d).error, e, e);
    bad({ id: 'X', type: 'SILENCE' }, 'INVALID_INTERVENTION_ID');
    bad({ id: 'a.b', type: 'TELEPATHY' }, 'INVALID_TYPE');
    bad({ id: 'a.b', type: 'OPEN_QUESTION', purpose: 'VIBES', text: 't' }, 'INVALID_PURPOSE');
    bad({ id: 'a.b', type: 'OPEN_QUESTION', purpose: 'GOAL', text: '' }, 'EMPTY_QUESTION_TEXT');
    bad({ id: 'a.b', type: 'SILENCE', conversationStages: ['GROW'] }, 'INVALID_STAGE:GROW');
    bad({ id: 'a.b', type: 'SILENCE', applicableContexts: ['patient'] }, 'INVALID_CONTEXT:patient');
    bad({ id: 'a.b', type: 'SILENCE', applicableContexts: 'child', minorSafe: false }, 'MINOR_CONTEXT_WITHOUT_MINOR_SAFE');
    bad({ id: 'a.b', type: 'OPEN_QUESTION', purpose: 'GOAL', text: 't', evidenceGrade: 'A' }, 'QUESTION_CANNOT_CLAIM_EVIDENCE_GRADE');
    bad({ id: 'a.b', type: 'SILENCE', evidenceGrade: 'Z' }, 'INVALID_EVIDENCE_GRADE');
  });
  test('R5. the stage model is methodology-neutral', () => {
    const sb = createSandbox();
    deq(sb.COACHING_STAGES, ['OPENING', 'CONTRACTING', 'EXPLORING', 'DEEPENING', 'AWARENESS',
      'OPTIONS', 'COMMITMENT', 'CLOSING', 'FOLLOW_UP']);
    assert.equal(/\bGROW\b|solution.focused|motivational.interview|socratic/i.test(code(SRC20) + code(SRC21) + code(SRC23)), false);
    // Phase 3 declares the field and never fills it; Phase 4 owns the tagging
    ['20-coaching-interventions.js', '21-coaching-question-bank.js'].forEach(f =>
      assert.equal(/compatibleApproaches\s*(\.push|=\s*\[['"])/.test(code(F(f))), false, f));
    assert.ok(sb.coachingInterventionList().some(x => x.compatibleApproaches.length > 0));
  });
  test('R6. every registration passes through the Phase 2 policy mechanism', () => {
    const sb = createSandbox();
    const policies = sb.coachingSafeguardSelfCheck().interventionPolicies;
    sb.coachingInterventionIds().forEach(id => assert.ok(policies.indexOf(id) >= 0, 'no policy for ' + id));
    assert.equal(policies.length, sb.coachingInterventionIds().length);
    assert.match(code(SRC20), /coachingRegisterInterventionPolicy\(/);
  });
  test('R7. an unregistered intervention still fails closed for a minor', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingInterventionAllowed('never.registered', 'child').allowed, false);
    assert.equal(sb.coachingInterventionAllowed('never.registered', 'youth').allowed, false);
    assert.equal(sb.coachingInterventionAllowed('challenge.gap', 'child').allowed, false);
    assert.equal(sb.coachingInterventionAllowed('challenge.gap', 'adult').allowed, true);
  });
});

/* ── QUESTIONS ────────────────────────────────────────────────────────────── */
describe('Q. Seed question library', () => {
  test('Q1. a curated seed set of the intended size loaded without rejection', () => {
    const sb = createSandbox();
    const s = sb.coachingQuestionBankStats();
    assert.ok(s.total >= 100 && s.total <= 150, 'total=' + s.total);
    deq(s.load.rejected, []);
    assert.equal(s.load.registered, s.total);
  });
  test('Q2. every purpose in the taxonomy is covered', () => {
    const sb = createSandbox();
    const byPurpose = sb.coachingQuestionBankStats().byPurpose;
    sb.COACHING_PURPOSES.forEach(p => assert.ok(byPurpose[p] >= 1, 'no question for ' + p));
    assert.equal(sb.COACHING_PURPOSES.length, 21);
    assert.equal(new Set(sb.COACHING_PURPOSES).size, 21);
  });
  test('Q3. wording integrity: non-empty, unique, single language, sane length', () => {
    const sb = createSandbox();
    const qs = sb.coachingInterventionList().filter(x => x.isQuestion);
    const seen = new Set();
    qs.forEach(q => {
      assert.ok(q.text.trim().length > 5, q.id);
      assert.equal(q.language, 'tr', q.id);
      assert.ok(q.text.length <= 120, q.id + ' too long');
      assert.equal(seen.has(q.text), false, 'duplicate wording: ' + q.text);
      seen.add(q.text);
      assert.ok(q.conversationStages.length >= 1, q.id);
      assert.ok(q.applicableContexts.length >= 1, q.id);
      assert.ok([1, 2, 3].indexOf(q.depth) >= 0, q.id);
    });
  });
  test('Q4. no question claims evidence or attribution of its own', () => {
    const sb = createSandbox();
    sb.coachingInterventionList().filter(x => x.isQuestion).forEach(q => {
      assert.equal(q.sourceBasis.grade, null, q.id);
      assert.ok(q.sourceBasis.typeGrade, q.id);           // the grade lives on the TYPE
      ['author', 'book', 'attribution', 'quote'].forEach(k => assert.equal(k in q, false, q.id + '.' + k));
    });
    assert.equal(/©|all rights reserved/i.test(code(SRC21)), false);
  });
  test('Q5. every question that reaches a minor is declared minor-safe', () => {
    const sb = createSandbox();
    sb.coachingInterventionList().forEach(x => {
      const touchesMinor = x.applicableContexts.indexOf('child') >= 0 || x.applicableContexts.indexOf('youth') >= 0;
      if (touchesMinor) assert.equal(x.minorSafe, true, x.id);
    });
  });
  test('Q6. age adaptation is conceptual, not mechanical simplification', () => {
    const sb = createSandbox();
    const s = sb.coachingQuestionBankStats();
    assert.ok(s.conceptsWithVariants >= 8, 'variants=' + s.conceptsWithVariants);
    ['perspective_shift', 'goal_picture', 'possibility_unblocked', 'action_first_step', 'closure_summary']
      .forEach(c => {
        const v = sb.coachingConceptVariants(c);
        assert.ok(v.length >= 2, c);
        const texts = v.map(x => x.text);
        assert.equal(new Set(texts).size, texts.length, c + ' variants must be genuinely different');
        // a child variant is rewritten, not a truncated adult sentence
        const child = v.find(x => x.applicableContexts.indexOf('child') >= 0);
        const adult = v.find(x => x.applicableContexts.indexOf('adult') >= 0);
        if (child && adult) assert.equal(adult.text.indexOf(child.text.replace('?', '')) >= 0, false, c);
      });
  });
  test('Q7. THE BANK SURVIVES ITS OWN ANALYZER in every context it claims', () => {
    const sb = createSandbox();
    const bad = [];
    sb.coachingInterventionList().filter(x => x.isQuestion).forEach(q => {
      q.applicableContexts.forEach(c => {
        const r = sb.coachingAnalyzeQuestion(q.text, { context: c, depth: q.depth });
        if (r.quality !== 'strong') bad.push(q.id + '/' + c + ':' + r.reasonCodes.join('|'));
      });
    });
    deq(bad, []);
  });
});

/* ── QUALITY ──────────────────────────────────────────────────────────────── */
describe('A. Question quality analysis', () => {
  const CASES = [
    ['Sence de bu en iyisi değil mi?', 'LEADING_QUESTION'],
    ['Bunu daha önce denedin mi?', 'ADVICE_IN_DISGUISE'],
    ['Neden onunla konuşmuyorsun?', 'ADVICE_IN_DISGUISE'],
    ['Ne hissediyorsun ve bundan sonra ne yapacaksın?', 'STACKED_QUESTIONS'],
    ['Ne düşünüyorsun? Peki ya ekibin?', 'STACKED_QUESTIONS'],
    ['Bence sen bu işi bırakmalısın.', 'COACH_AGENDA'],
    ['Neden böyle oldu, niye kimse söylemedi?', 'WHY_BOMBARDMENT'],
    ['Merak etme, hallederiz.', 'RESCUING'],
    ['Burada yanlış yapmışsın.', 'JUDGMENT'],
    ['Bunu mu yapacaksın yoksa şunu mu?', 'FALSE_CHOICE'],
    ['Bence sende depresyon var.', 'DIAGNOSIS_LANGUAGE'],
    ['Hemen bir plan yapalım.', 'PREMATURE_SOLUTION']
  ];
  test('A1. each anti-pattern is detected with its reason code', () => {
    const sb = createSandbox();
    CASES.forEach(([text, code]) => {
      const r = sb.coachingAnalyzeQuestion(text);
      assert.ok(r.reasonCodes.indexOf(code) >= 0, text + ' -> ' + r.reasonCodes.join('|'));
      assert.notEqual(r.quality, 'strong', text);
    });
  });
  test('A2. a clean open question is not falsely penalized', () => {
    const sb = createSandbox();
    ['Bu konuda senin için asıl önemli olan ne?',
     'İlk adım ne olacak?',
     'Bunun somut bir örneğini anlatır mısın?',   // request form, not a closed question
     'Şu an durum tam olarak nerede?'].forEach(t => {
      const r = sb.coachingAnalyzeQuestion(t);
      assert.equal(r.quality, 'strong', t + ' -> ' + r.reasonCodes.join('|'));
      deq(r.reasonCodes, [], t);
    });
  });
  test('A3. closed questions are flagged, request forms are not', () => {
    const sb = createSandbox();
    assert.ok(sb.coachingAnalyzeQuestion('Bu iyi bir fikir mi?').reasonCodes.indexOf('CLOSED_WHEN_OPEN_PREFERRED') >= 0);
    assert.equal(sb.coachingAnalyzeQuestion('Bunu biraz açar mısın?').reasonCodes.indexOf('CLOSED_WHEN_OPEN_PREFERRED'), -1);
  });
  test('A4. age-inappropriate abstraction fires only in minor contexts', () => {
    const sb = createSandbox();
    const t = 'Bu durumdaki içsel motivasyon ve varsayım katmanını nasıl değerlendiriyorsun?';
    assert.ok(sb.coachingAnalyzeQuestion(t, { context: 'child' }).reasonCodes.indexOf('AGE_INAPPROPRIATE_ABSTRACTION') >= 0);
    assert.ok(sb.coachingAnalyzeQuestion(t, { context: 'youth' }).reasonCodes.indexOf('AGE_INAPPROPRIATE_ABSTRACTION') >= 0);
    assert.equal(sb.coachingAnalyzeQuestion(t, { context: 'adult' }).reasonCodes.indexOf('AGE_INAPPROPRIATE_ABSTRACTION'), -1);
    assert.ok(sb.coachingAnalyzeQuestion('Kısa soru?', { context: 'child', depth: 3 }).reasonCodes.indexOf('AGE_INAPPROPRIATE_ABSTRACTION') >= 0);
  });
  test('A5. an over-complex question is flagged as low severity, not condemned', () => {
    const sb = createSandbox();
    const long = 'Bu konuda ki durumu ancak tüm paydaşların beklentileri ve geçmiş deneyimlerin ' +
      'birikimi ile birlikte ele aldığımızda ragmen nasıl bir sonuca varabileceğini düşünüyorsun?';
    const r = sb.coachingAnalyzeQuestion(long);
    assert.ok(r.reasonCodes.indexOf('OVERCOMPLEX_QUESTION') >= 0);
    assert.equal(r.quality, 'acceptable');
  });
  test('A6. results are explainable, never a bare score', () => {
    const sb = createSandbox();
    const r = sb.coachingAnalyzeQuestion('Sence de bu en iyisi değil mi?');
    assert.ok(Array.isArray(r.reasonCodes));
    assert.ok(r.findings.length >= 1);
    r.findings.forEach(f => {
      assert.ok(f.label && f.saferAlternative && f.detectionLimits, f.code);
      assert.ok(['low', 'medium', 'high'].indexOf(f.severity) >= 0);
    });
    assert.equal('score' in r, false);
    assert.equal(/%/.test(JSON.stringify(r)), false);
  });
  test('A7. analysis is deterministic', () => {
    const sb = createSandbox();
    const first = JSON.stringify(sb.coachingAnalyzeQuestion('Neden böyle oldu, niye kimse söylemedi?'));
    for (let i = 0; i < 30; i++)
      assert.equal(JSON.stringify(sb.coachingAnalyzeQuestion('Neden böyle oldu, niye kimse söylemedi?')), first);
  });
  test('A8. the interrogation pattern is a sequence finding, not an utterance one', () => {
    const sb = createSandbox();
    const seq = sb.coachingAnalyzeSequence([{ type: 'OPEN_QUESTION' }, { type: 'OPEN_QUESTION' }, { type: 'OPEN_QUESTION' }]);
    assert.equal(seq.questionRun, 3);
    assert.ok(seq.reasonCodes.indexOf('INTERROGATION') >= 0);
    const ok = sb.coachingAnalyzeSequence([{ type: 'OPEN_QUESTION' }, { type: 'REFLECTION' }, { type: 'OPEN_QUESTION' }]);
    deq(ok.reasonCodes, []);
  });
});

/* ── ANTI-PATTERN REGISTRY ────────────────────────────────────────────────── */
describe('P. Anti-pattern registry', () => {
  const REQUIRED = ['LEADING_QUESTION', 'ADVICE_IN_DISGUISE', 'INTERROGATION', 'PREMATURE_SOLUTION',
    'COACH_AGENDA', 'WHY_BOMBARDMENT', 'RESCUING', 'JUDGMENT', 'STACKED_QUESTIONS', 'FALSE_CHOICE',
    'DIAGNOSIS_LANGUAGE', 'OVERCOMPLEX_QUESTION', 'AGE_INAPPROPRIATE_ABSTRACTION'];
  test('P1. every required anti-pattern is registered', () => {
    const sb = createSandbox();
    REQUIRED.forEach(c => assert.ok(sb.coachingAntiPattern(c), c));
  });
  test('P2. each entry explains itself and offers a safer alternative', () => {
    const sb = createSandbox();
    sb.coachingAntiPatternCodes().forEach(c => {
      const a = sb.coachingAntiPattern(c);
      assert.ok(a.label && a.label.length > 3, c + '.label');
      ['what', 'why', 'saferAlternative', 'detectionLimits'].forEach(k =>
        assert.ok(a[k] && a[k].length > 15, c + '.' + k));
      assert.ok(['low', 'medium', 'high'].indexOf(a.severity) >= 0, c);
    });
  });
  test('P3. the registry is developmental, not shaming', () => {
    const sb = createSandbox();
    const all = JSON.stringify(sb.COACHING_ANTIPATTERNS);
    assert.equal(/kötü koç|başarısız|beceriksiz|utan/i.test(all), false);
    // every entry states what it cannot see
    sb.coachingAntiPatternCodes().forEach(c =>
      assert.ok(/kaçır|göremez|bilemez|yakalay|dayan|ayırt|işaretleyeb|sayım|saymaz|kalıp|bağlam/i.test(sb.coachingAntiPattern(c).detectionLimits), c));
  });
});

/* ── RANKING ──────────────────────────────────────────────────────────────── */
describe('S. Suggestion engine', () => {
  const sess = (sb, ctx, consent) => sb.coachingBuildSession({
    context: ctx || 'adult',
    safeguard: consent ? { guardianConsent: { state: 'granted' } } : undefined
  }, { now: '2026-08-29T09:00:00.000Z', id: 'coa_p3-1' }).session;

  test('S1. at most three suggestions, each explained', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({ context: 'adult', stage: 'EXPLORING' });
    assert.ok(r.suggestions.length > 0 && r.suggestions.length <= 3);
    assert.equal(sb.COACHING_SUGGEST_MAX, 3);
    r.suggestions.forEach(s => {
      assert.ok(s.whyNow && s.whyNow.length > 15, s.intervention.id);
      assert.ok(s.intervention.typeLabel);
      assert.ok(s.purpose);
      assert.ok(s.safety);
      assert.equal(/%|\bscore\b/i.test(s.whyNow), false);
    });
  });
  test('S2. ranking is deterministic and stable', () => {
    const sb = createSandbox();
    const q = { context: 'adult', stage: 'DEEPENING', purpose: 'ASSUMPTION' };
    const first = JSON.stringify(sb.coachingSuggestMoves(q).suggestions.map(s => s.intervention.id));
    for (let i = 0; i < 25; i++)
      assert.equal(JSON.stringify(sb.coachingSuggestMoves(q).suggestions.map(s => s.intervention.id)), first);
  });
  test('S3. suggestions are stage-sensitive', () => {
    const sb = createSandbox();
    const contracting = sb.coachingSuggestMoves({ context: 'adult', stage: 'CONTRACTING' });
    const commitment = sb.coachingSuggestMoves({ context: 'adult', stage: 'COMMITMENT' });
    assert.ok(contracting.suggestions.every(s => sb.coachingIntervention(s.intervention.id).conversationStages.indexOf('CONTRACTING') >= 0));
    assert.ok(commitment.suggestions.every(s => sb.coachingIntervention(s.intervention.id).conversationStages.indexOf('COMMITMENT') >= 0));
    assert.notEqual(JSON.stringify(contracting.suggestions.map(s => s.intervention.id)),
      JSON.stringify(commitment.suggestions.map(s => s.intervention.id)));
  });
  test('S4. suggestions are purpose-sensitive', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({ context: 'adult', stage: 'AWARENESS', purpose: 'ASSUMPTION' });
    assert.equal(r.suggestions[0].intervention.purpose, 'ASSUMPTION');
  });
  test('S5. after two questions a space-making move outranks another question', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({
      context: 'adult', stage: 'DEEPENING',
      recentMoves: [{ type: 'OPEN_QUESTION' }, { type: 'OPEN_QUESTION' }]
    });
    assert.ok(sb.COACHING_SPACE_TYPES.indexOf(r.suggestions[0].intervention.type) >= 0,
      'got ' + r.suggestions[0].intervention.type);
    assert.match(r.suggestions[0].whyNow, /soruydu/);
  });
  test('S6. after a realization, silence or reflection leads', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({ context: 'adult', stage: 'AWARENESS', significantRealization: true });
    assert.ok(['SILENCE', 'REFLECTION'].indexOf(r.suggestions[0].intervention.type) >= 0,
      'got ' + r.suggestions[0].intervention.type);
    assert.match(r.suggestions[0].whyNow, /farkındalık/);
  });
  test('S7. a challenge is not stacked on a challenge', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({
      context: 'adult', stage: 'AWARENESS', recentMoves: [{ type: 'CHALLENGE' }]
    });
    assert.equal(r.suggestions.some(s => s.intervention.type === 'CHALLENGE'), false);
  });
  test('S8. an already-used move is pushed down', () => {
    const sb = createSandbox();
    const base = sb.coachingSuggestMoves({ context: 'adult', stage: 'COMMITMENT' });
    const topId = base.suggestions[0].intervention.id;
    const after = sb.coachingSuggestMoves({ context: 'adult', stage: 'COMMITMENT', usedIds: [topId] });
    assert.notEqual(after.suggestions[0].intervention.id, topId);
  });
  test('S9. a stop_and_refer returns no coaching moves at all', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({
      session: sess(sb, 'adult'), event: { type: 'note', text: 'İntihar etmeyi düşünüyorum.' },
      context: 'adult', stage: 'DEEPENING'
    });
    assert.equal(r.allowed, false);
    deq(r.suggestions, []);
    assert.equal(r.safety.decision, 'stop_and_refer');
    assert.ok(r.notes.length >= 1);
  });
  test('S10. a pause restricts the pool to low-risk, no-permission moves', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({
      session: sess(sb, 'adult'), event: { type: 'note', text: 'Bende depresyon var mı?' },
      context: 'adult', stage: 'AWARENESS'
    });
    assert.equal(r.allowed, true);
    assert.equal(r.safety.decision, 'pause');
    r.suggestions.forEach(s => {
      assert.equal(s.intervention.riskLevel, 'low', s.intervention.id);
      assert.equal(s.intervention.requiresPermission, false, s.intervention.id);
    });
    assert.ok(r.notes.join(' ').indexOf('duraklama') >= 0);
  });
  test('S11. a child never sees an adult-only or unregistered move', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({ context: 'child', stage: 'EXPLORING' });
    assert.ok(r.suggestions.length > 0);
    r.suggestions.forEach(s => {
      const x = sb.coachingIntervention(s.intervention.id);
      assert.equal(x.minorSafe, true, x.id);
      assert.ok(x.applicableContexts.indexOf('child') >= 0, x.id);
      assert.equal(sb.coachingInterventionAllowed(x.id, 'child').allowed, true, x.id);
    });
    const ids = r.suggestions.map(s => s.intervention.id);
    ['challenge.gap', 'challenge.standard', 'observe.pattern'].forEach(id => assert.equal(ids.indexOf(id), -1, id));
  });
  test('S12. a minor without guardian consent gets no moves', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({
      session: sess(sb, 'child'), event: { type: 'note', text: 'merhaba' }, context: 'child', stage: 'EXPLORING'
    });
    assert.equal(r.safety.reasonCode, 'guardian_consent_required');
    assert.equal(r.safety.decision, 'pause');
  });
  test('S13. each suggestion offers a different-type alternative', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({ context: 'adult', stage: 'DEEPENING' });
    r.suggestions.forEach(s => {
      if (s.alternative) assert.notEqual(s.alternative.type, s.intervention.type, s.intervention.id);
    });
  });
  test('S14. the engine warns when the conversation is becoming an interrogation', () => {
    const sb = createSandbox();
    const r = sb.coachingSuggestMoves({
      context: 'adult', stage: 'EXPLORING',
      recentMoves: [{ type: 'OPEN_QUESTION' }, { type: 'OPEN_QUESTION' }, { type: 'OPEN_QUESTION' }]
    });
    assert.ok(r.notes.join(' ').indexOf('sorgu') >= 0);
  });
});

/* ── PRIVACY / SAFETY / LEGACY / STATIC ───────────────────────────────────── */
describe('X. Privacy, safety, legacy and static guards', () => {
  test('X1. the whole engine leaves D byte-identical and persists nothing', () => {
    const sb = createSandbox();
    const before = sb.canonicalStringify(sb.D);
    sb.coachingSuggestMoves({ context: 'adult', stage: 'EXPLORING' });
    sb.coachingAnalyzeQuestion('Sence de öyle değil mi?');
    sb.coachingAnalyzeSequence([{ type: 'OPEN_QUESTION' }]);
    sb.coachingQuestionBankStats(); sb.coachingInterventionsSelfCheck(); sb.coachingSuggestSelfCheck();
    assert.equal(sb.canonicalStringify(sb.D), before);
    assert.equal(sb.coachingStoreCount(), 0);
    assert.equal(sb.D.coachingSessions, undefined);
  });
  test('X2. no network, AI, storage, timers or payload writes in any Phase 3 module', () => {
    [[SRC20, '20'], [SRC21, '21'], [SRC22, '22'], [SRC23, '23']].forEach(([src, n]) => {
      const c = code(src);
      [[/fetch\s*\(/, 'fetch'], [/XMLHttpRequest|WebSocket|EventSource/, 'socket'], [/localStorage/, 'storage'],
       [/setTimeout|setInterval/, 'timer'], [/openai|anthropic|gemini|apiKey|prompt\s*\(/i, 'ai'],
       [/\bD\.\w+\s*=[^=]/, 'payload write'], [/INIT\.\w/, 'payload field'], [/CLOUD\.db/, 'firestore'],
       [/\bsave\s*\(\)/, 'save'], [/document\.|innerHTML/, 'dom']
      ].forEach(([re, name]) => assert.equal(re.test(c), false, n + ': ' + name));
    });
  });
  test('X3. a suggestion never echoes the screened text', () => {
    const sb = createSandbox();
    const secret = 'GIZLI_SIR_98765';
    const r = sb.coachingSuggestMoves({
      session: sb.coachingBuildSession({ context: 'adult' }).session,
      event: { type: 'note', text: 'Bende depresyon var mı? ' + secret },
      context: 'adult', stage: 'AWARENESS'
    });
    assert.equal(JSON.stringify(r).indexOf(secret), -1);
  });
  test('X4. no bypass: the safety layer runs before ranking and cannot be skipped', () => {
    assert.match(code(SRC23), /coachingSafetyEvaluate\(/);
    assert.match(code(SRC23), /coachingInterventionAllowed\(/);
    assert.equal(/bypassSafety|skipSafety|force\s*:/.test(code(SRC23)), false);
  });
  test('X5. the legacy Koçluk screen and its data are untouched', () => {
    const sb = createSandbox();
    assert.equal(sb.D.coaching.length, 1);
    assert.equal(sb.D.coaching[0].title, 'OKR Sistemi');
    assert.equal(sb.D.questions.length, 1);            // the legacy question field is not repurposed
    assert.equal(sb.D.questions[0].id, 1);
    const ui = fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8');
    const boot = fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8');
    assert.equal((ui.match(/\{id:'coaching'/g) || []).length, 1);
    assert.equal(/COACHING_|intervention|antiPattern/i.test(ui + boot), false);
  });
  test('X6. no new navigation entry or route was added', () => {
    const sb = createSandbox();
    const ui = fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8');
    const navBlock = ui.slice(ui.indexOf('var NAV=['), ui.indexOf('function renderNav'));
    assert.equal((navBlock.match(/\{id:'/g) || []).length, 31);   // unchanged nav size
    const boot = fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8');
    const routes = boot.slice(boot.indexOf('var pages={'), boot.indexOf('var fn=pages[tab]'));
    assert.equal(/coachingSuggest|coachingIntervention|interventions:|suggest:|antipattern/i.test(routes), false);
    assert.match(routes, /questions:function\(\)\{renderGenericList\('questions'\);\}/);  // the legacy route, unchanged
    assert.equal(sb.COACHING.enabled, true);   // live since Phase 5
  });
  test('X7. mirrors byte-identical, modules under the size limit, wired once', () => {
    P3_FILES.forEach(f => {
      const a = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
      assert.equal(a, fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
      assert.ok(a.split('\n').length < 900, f + ' ' + a.split('\n').length);
      assert.equal((INDEX.match(new RegExp(f.replace(/\./g, '\\.'), 'g')) || []).length, 1, f);
    });
    assert.equal(INDEX, fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    // load order: registry -> bank -> quality -> suggest
    let prev = -1;
    P3_FILES.forEach(f => { const i = INDEX.indexOf(f); assert.ok(i > prev, f); prev = i; });
  });
  test('X8. evidence grading sits on the type, with an explicit disclaimer', () => {
    const sb = createSandbox();
    deq(Object.keys(sb.COACHING_EVIDENCE_GRADES).sort(), ['A', 'B', 'C', 'D']);
    Object.keys(sb.COACHING_INTERVENTION_TYPES).forEach(t => {
      const e = sb.COACHING_INTERVENTION_TYPES[t].evidence;
      assert.ok(sb.coachingValidGrade(e.grade), t);
      assert.match(e.note, /kanıtlanmış sayılmaz|HAMLE TÜRÜ/);
    });
    assert.equal(Object.keys(sb.COACHING_INTERVENTION_TYPES).some(t =>
      sb.COACHING_INTERVENTION_TYPES[t].evidence.grade === 'D'), false);  // nothing unsuitable shipped
  });
});
