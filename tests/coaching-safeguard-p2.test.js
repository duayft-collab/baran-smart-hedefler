'use strict';
/* COACHING MASTERY OS — PHASE 2 (Ethics / Boundaries / Safeguarding) tests.
   Guarantees: ordinary coaching stays frictionless, boundary and safety
   situations escalate deterministically with stable reason codes, minors are
   protected structurally rather than cosmetically, the gate cannot be bypassed
   by owner / admin / feature flag / direct helper, decisions never leak the
   screened text or name a condition, and confidentiality stays private by
   default with learning fed only by de-identified derivations. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC17 = fs.readFileSync(path.join(ROOT, 'js', '17-coaching-domain.js'), 'utf8');
const SRC18 = fs.readFileSync(path.join(ROOT, 'js', '18-coaching-ethics.js'), 'utf8');
const SRC19 = fs.readFileSync(path.join(ROOT, 'js', '19-coaching-safeguard.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FIXED = { now: '2026-08-29T09:00:00.000Z', id: 'coa_test01-1' };

function deq(a, e, m) { assert.deepEqual(JSON.parse(JSON.stringify(a)), e, m); }
/* Assertions about CODE must not be tripped by prose in the documentation
   headers, so comments are stripped before those regexes run. */
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
const C17 = code(SRC17), C18 = code(SRC18), C19 = code(SRC19);
/* Executable code only: comments AND string literals removed, so prose that
   merely contains a token is not mistaken for code that uses it. */
function exec(src) { return code(src).replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"/g, "''"); }
const X18 = exec(SRC18), X19 = exec(SRC19);
function sess(sb, over) {
  const r = sb.coachingBuildSession(Object.assign({ context: 'adult' }, over || {}), FIXED);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.session;
}
function consented(sb, ctx) {
  return sess(sb, { context: ctx, safeguard: { guardianConsent: { state: 'granted', by: 'veli', at: FIXED.now } } });
}
function ev(text, over) { return Object.assign({ type: 'note', text: text }, over || {}); }
function decide(sb, session, text, over) { return sb.coachingSafetyEvaluate(session, ev(text, over)); }

/* ── N. Ordinary coaching must stay invisible ─────────────────────────────── */
describe('N. Normal adult coaching is frictionless', () => {
  const ORDINARY = [
    'Delegasyonumu geliştirmek istiyorum.',
    'Ekibimin performansını nasıl artırırım?',
    'İki iş teklifi arasında karar vermem gerekiyor.',
    'Bu çeyrek için üç net hedef belirlemek istiyorum.',
    'Toplantılarda zaman öldürmek yerine gündeme sadık kalmak istiyorum.',
    'Telefon bağımlısıyım, ekran süremi azaltmak istiyorum.',
    'Yetkisini istismar eden bir yöneticiyle nasıl konuşmalıyım?',
    'Sabah rutinimi kurmakta zorlanıyorum.',
    'I want to improve my delegation.',
    'How do I give better feedback to my team?',
    ''
  ];
  test('N1. ordinary goal / leadership / decision coaching returns ALLOW', () => {
    const sb = createSandbox();
    const s = sess(sb);
    ORDINARY.forEach(t => {
      const d = decide(sb, s, t);
      assert.equal(d.decision, 'allow', JSON.stringify({ t, d: d.decision, r: d.reasonCode }));
      assert.equal(d.reasonCode, 'ok_low_risk', t);
      assert.equal(d.severity, 'none', t);
      assert.equal(d.requiresConfirmation, false, t);
      deq(d.signals, [], t);
      assert.equal(d.referralGuidance, null, t);
    });
  });
  test('N2. an ALLOW carries no medical framing and no ceremony', () => {
    const sb = createSandbox();
    const d = decide(sb, sess(sb), 'Delegasyonumu geliştirmek istiyorum.');
    assert.equal(d.nextAction, 'continue');
    deq(d.categories, []);
    assert.equal(/hastalık|teşhis|tanı|terapi|klinik/i.test(d.rationale), false);
    deq(d.basis.standards, []);
    deq(d.principleIds, ['policy.quiet_when_safe']);
  });
  test('N3. the gate agrees with the evaluation and permits ordinary work', () => {
    const sb = createSandbox();
    const s = sess(sb);
    const g = sb.coachingSafetyCheck(s, ev('Delegasyonumu geliştirmek istiyorum.'));
    assert.equal(g.allowed, true);
    assert.equal(g.decision, 'allow');
    assert.equal(g.decision, decide(sb, s, 'Delegasyonumu geliştirmek istiyorum.').decision);
  });
});

/* ── B. Boundary handling ─────────────────────────────────────────────────── */
describe('B. Coaching-vs-therapy boundary', () => {
  const CASES = [
    ['Bende depresyon var mı sence?', 'pause', 'scope_boundary', 'diagnosis_request'],
    ['Do I have depression?', 'pause', 'scope_boundary', 'diagnosis_request'],
    ['Bana terapi yap lütfen.', 'pause', 'scope_boundary', 'treatment_request'],
    ['İlacımı bırakmalı mıyım?', 'pause', 'scope_boundary', 'medication_question'],
    ['Çocukluk travmam üzerinde çalışmak istiyorum.', 'pause', 'scope_boundary', 'trauma_clinical'],
    ['Alkol bağımlısıyım.', 'pause', 'scope_boundary', 'addiction_dependency'],
    ['Her gün ağlıyorum ve yataktan çıkamıyorum.', 'pause', 'clinical_risk_indication', 'severe_distress'],
    ['Bu konuda yetkin değilim.', 'pause', 'competence_limit', 'competence_limit'],
    ['İntihar etmeyi düşünüyorum.', 'stop_and_refer', 'immediate_safety_concern', 'self_harm_suicide'],
    ['kendimi oldurmek istiyorum', 'stop_and_refer', 'immediate_safety_concern', 'self_harm_suicide'],
    ['I think about suicide.', 'stop_and_refer', 'immediate_safety_concern', 'self_harm_suicide'],
    ['Onu öldüreceğim.', 'stop_and_refer', 'immediate_safety_concern', 'harm_to_others'],
    ['Sesler duyuyorum.', 'stop_and_refer', 'clinical_risk_indication', 'severe_disorientation'],
    ['Eşim beni dövüyor.', 'stop_and_refer', 'safeguarding_concern', 'abuse_disclosure'],
    ['Aramızda kalsın, kimseye söyleme.', 'allow_with_note', 'confidentiality_note', 'confidentiality_concern'],
    ['Kendi çalışanıma koçluk yapıyorum.', 'allow_with_note', 'dual_relationship_note', 'dual_relationship']
  ];
  test('B1. each boundary case yields the expected decision, reason and signal', () => {
    const sb = createSandbox();
    const s = sess(sb);
    CASES.forEach(([text, decision, reason, signal]) => {
      const d = decide(sb, s, text);
      assert.equal(d.decision, decision, text + ' -> ' + d.decision);
      assert.equal(d.reasonCode, reason, text + ' -> ' + d.reasonCode);
      assert.ok(d.signals.some(x => x.code === signal), text + ' missing ' + signal);
    });
  });
  test('B2. a stop_and_refer always carries referral guidance and confirmation', () => {
    const sb = createSandbox();
    const d = decide(sb, sess(sb), 'İntihar etmeyi düşünüyorum.');
    assert.equal(d.requiresConfirmation, true);
    assert.equal(d.nextAction, 'stop_and_refer_to_appropriate_professional');
    assert.ok(d.referralGuidance && d.referralGuidance.length > 10);
    assert.equal(d.severity, 'urgent');
    // no invented emergency number
    assert.equal(/\b\d{3,4}\b/.test(d.referralGuidance), false);
  });
  test('B3. the most serious signal wins when several fire', () => {
    const sb = createSandbox();
    const d = decide(sb, sess(sb), 'Aramızda kalsın ama intihar etmeyi düşünüyorum.');
    assert.equal(d.decision, 'stop_and_refer');
    assert.ok(d.signals.length >= 2);
    assert.equal(d.signals[0].code, 'self_harm_suicide');
    assert.ok(d.categories.indexOf('confidentiality') >= 0);
  });
  test('B4. the app never names a condition — only the scope of coaching', () => {
    const sb = createSandbox();
    const s = sess(sb);
    CASES.concat([['Delegasyon', 'allow', 'ok_low_risk', null]]).forEach(([text]) => {
      const r = decide(sb, s, text).rationale;
      assert.equal(/depresyon|anksiyete|bipolar|otizm|şizofren|hastalığın|teşhis(in)?\b|tanın\b|sende .* var/i.test(r), false, text + ' -> ' + r);
    });
  });
  test('B5. every boundary category is represented by at least one signal', () => {
    const sb = createSandbox();
    const covered = {};
    sb.COACHING_SIGNALS.forEach(x => { covered[x.category] = 1; });
    sb.COACHING_BOUNDARY_CATEGORIES.forEach(c => assert.ok(covered[c], 'uncovered category: ' + c));
  });
});

/* ── M. Minors ────────────────────────────────────────────────────────────── */
describe('M. Child and youth safeguarding is structural', () => {
  test('M1. a minor session without guardian consent pauses', () => {
    const sb = createSandbox();
    ['child', 'youth'].forEach(ctx => {
      const d = decide(sb, sess(sb, { context: ctx }), 'Okulda daha iyi olmak istiyorum.');
      assert.equal(d.decision, 'pause', ctx);
      assert.equal(d.reasonCode, 'guardian_consent_required', ctx);
      assert.equal(d.minorContext, true, ctx);
      deq(d.categories, ['safeguarding'], ctx);
    });
  });
  test('M2. declined or withdrawn consent stops the session', () => {
    const sb = createSandbox();
    ['declined', 'withdrawn'].forEach(st => {
      const s = sess(sb, { context: 'child', safeguard: { guardianConsent: { state: st } } });
      const d = decide(sb, s, 'Okulda daha iyi olmak istiyorum.');
      assert.equal(d.decision, 'stop_and_refer', st);
      assert.equal(d.reasonCode, 'guardian_consent_declined', st);
    });
  });
  test('M3. with valid baseline safeguards ordinary child coaching proceeds', () => {
    const sb = createSandbox();
    const d = decide(sb, consented(sb, 'child'), 'Ödevlerimi zamanında bitirmek istiyorum.');
    assert.equal(d.decision, 'allow');
    assert.equal(d.reasonCode, 'ok_low_risk');
    assert.equal(d.minorContext, true);
  });
  test('M4. a draft may exist before consent; anything beyond it may not', () => {
    const sb = createSandbox();
    const s = sess(sb, { context: 'child' });
    assert.equal(sb.coachingSafetyEvaluate(s, { type: 'draft', text: '' }).decision, 'allow');
    assert.equal(sb.coachingSafetyEvaluate(s, { type: 'note', text: '' }).decision, 'pause');
  });
  test('M5. child / youth / adult are NOT wording variants — same input, different outcome', () => {
    const sb = createSandbox();
    const text = 'Her gün ağlıyorum ve yataktan çıkamıyorum.';
    const adult = decide(sb, sess(sb, { context: 'adult' }), text);
    const child = decide(sb, consented(sb, 'child'), text);
    const youth = decide(sb, consented(sb, 'youth'), text);
    assert.equal(adult.decision, 'pause');
    assert.equal(child.decision, 'stop_and_refer');
    assert.equal(youth.decision, 'stop_and_refer');
    assert.equal(child.reasonCode, 'minor_safeguarding_escalation');
    assert.equal(child.severity, 'urgent');
    assert.ok(child.principleIds.indexOf('minor.best_interests') >= 0);
  });
  test('M6. a safeguarding signal in a minor context always stops', () => {
    const sb = createSandbox();
    const d = decide(sb, consented(sb, 'child'), 'Babam beni dövüyor.');
    assert.equal(d.decision, 'stop_and_refer');
    assert.equal(d.severity, 'urgent');
    assert.equal(d.reasonCode, 'safeguarding_concern');
    assert.ok(d.principleIds.indexOf('minor.best_interests') >= 0);
  });
  test('M7. low-severity notes are NOT escalated for minors (no blanket paranoia)', () => {
    const sb = createSandbox();
    const d = decide(sb, consented(sb, 'child'), 'Aramızda kalsın.');
    assert.equal(d.decision, 'allow_with_note');
    assert.equal(d.reasonCode, 'confidentiality_note');
  });
  test('M8. an adult-style intervention cannot silently run in a child context', () => {
    const sb = createSandbox();
    sb.coachingRegisterInterventionPolicy('hard_confrontation', { allowedContexts: ['adult', 'executive'], minorSafe: false });
    sb.coachingRegisterInterventionPolicy('playful_scaling', { minorSafe: true });
    assert.equal(sb.coachingInterventionAllowed('hard_confrontation', 'adult').allowed, true);
    assert.equal(sb.coachingInterventionAllowed('hard_confrontation', 'child').allowed, false);
    assert.equal(sb.coachingInterventionAllowed('playful_scaling', 'child').allowed, true);
    // unregistered: fail-safe for minors, permissive for adults so later phases are not blocked
    assert.equal(sb.coachingInterventionAllowed('brand_new_thing', 'child').allowed, false);
    assert.equal(sb.coachingInterventionAllowed('brand_new_thing', 'adult').allowed, true);
    const d = sb.coachingSafetyEvaluate(consented(sb, 'child'), { type: 'intervention', text: 'ok', intervention: 'hard_confrontation' });
    assert.equal(d.decision, 'stop_and_refer');
    assert.equal(d.reasonCode, 'intervention_not_permitted_in_context');
  });
  test('M9. minor contexts declare guardian consent and heightened safeguarding', () => {
    const sb = createSandbox();
    ['child', 'youth'].forEach(k => {
      const c = sb.coachingContext(k);
      assert.equal(c.guardianConsentRequired, true, k);
      assert.equal(c.heightenedSafeguarding, true, k);
    });
    deq(sb.COACHING_CONSENT_STATE, ['unknown', 'not_required', 'granted', 'declined', 'withdrawn']);
  });
});

/* ── S. No bypass ─────────────────────────────────────────────────────────── */
describe('S. The safety gate cannot be bypassed', () => {
  function ownerReady(sb) {
    sb.CLOUD.uid = 'U1'; sb.CLOUD.user = { uid: 'U1', email: 'u@x.com', isAnonymous: false };
    sb.COACHING.enabled = true;
    return sb;
  }
  test('S1. the real gate is installed at load and it is ours', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingSafetyGateInstalled(), true);
    assert.equal(sb.coachingSafeguardSelfCheck().gateIsOurs, true);
  });
  test('S2. the owner cannot bypass a stop_and_refer', () => {
    const sb = ownerReady(createSandbox());
    const s = sess(sb);
    const g = sb.coachingAssertWritable('write', s, ev('İntihar etmeyi düşünüyorum.'));
    assert.equal(g.allowed, false);
    assert.equal(g.decision, 'stop_and_refer');
    assert.equal(g.reason, 'immediate_safety_concern');
  });
  test('S3. a minor without consent cannot be written even by the owner', () => {
    const sb = ownerReady(createSandbox());
    const g = sb.coachingAssertWritable('write', sess(sb, { context: 'child' }), ev('merhaba'));
    assert.equal(g.allowed, false);
    assert.equal(g.reason, 'guardian_consent_required');
  });
  test('S4. the feature flag does not skip the gate — it only gates earlier', () => {
    const sb = ownerReady(createSandbox());
    const s = sess(sb);
    assert.equal(sb.coachingAssertWritable('write', s, ev('Delegasyon.')).allowed, true);
    sb.COACHING.enabled = false;
    assert.equal(sb.coachingAssertWritable('write', s, ev('Delegasyon.')).reason, 'feature_disabled');
  });
  test('S5. no admin escape hatch exists anywhere in the coaching modules', () => {
    [C17, C18, C19].forEach((src, i) =>
      assert.equal(/isCurrentUserAdmin|claims\.admin|token\.admin|ADMIN_UI|resolveCurrentAdminClaim/.test(src), false, 'module ' + i));
  });
  test('S6. there is no direct storage helper that could skip the chokepoint', () => {
    [C17, C18, C19].forEach((src, i) => {
      assert.equal(/coachingPersist|coachingCreateSession|coachingSaveSession|coachingWriteSession/.test(src), false, 'module ' + i);
      assert.equal(/\w\.set\(|\w\.add\(|\w\.update\(|\w\.delete\(|writeBatch|runTransaction/.test(src), false, 'module ' + i);
    });
    // the single Firestore handle is a read-only reference builder in 17
    assert.equal((C17.match(/CLOUD\.db\.collection/g) || []).length, 1);
    assert.equal(/CLOUD\.db/.test(C18 + C19), false);
  });
  test('S7. an invalid or throwing gate still fails closed', () => {
    const sb = ownerReady(createSandbox());
    sb.coachingInstallSafetyGate(function () { return { decision: 'definitely_fine' }; });
    assert.equal(sb.coachingAssertWritable('write', sess(sb), ev('x')).reason, 'safety_gate_invalid_result');
    sb.coachingInstallSafetyGate(function () { throw new Error('x'); });
    assert.equal(sb.coachingAssertWritable('write', sess(sb), ev('x')).reason, 'safety_gate_error');
  });
  test('S8. authorization still precedes the gate', () => {
    const sb = createSandbox();
    sb.IDENTITY.sharingEnabled = true;
    sb.CLOUD.uid = 'MEMBER1'; sb.CLOUD.user = { uid: 'MEMBER1', email: 'm@x.com', isAnonymous: false };
    sb.CLOUD.personalEntry = { ownerUid: 'OWNER1', status: 'active', role: 'editor', permissions: { state: { read: true, write: true } } };
    sb.CLOUD.personalOwnerActive = true;
    sb.COACHING.enabled = true;
    assert.equal(sb.coachingAssertWritable('write', sess(sb), ev('Delegasyon.')).reason, 'not_authorized');
  });
});

/* ── P. Privacy ───────────────────────────────────────────────────────────── */
describe('P. Privacy of safety decisions and derived learning', () => {
  test('P1. a decision never echoes the screened text', () => {
    const sb = createSandbox();
    const secret = 'GIZLI_ANAHTAR_12345 Ayşe Yılmaz 0555';
    const d = decide(sb, sess(sb), 'İntihar etmeyi düşünüyorum. ' + secret);
    const json = JSON.stringify(d);
    assert.equal(json.indexOf('GIZLI_ANAHTAR_12345'), -1);
    assert.equal(json.indexOf('Ayşe'), -1);
    assert.equal(json.indexOf('0555'), -1);
    assert.equal(/intihar/i.test(json), false);
  });
  test('P2. a decision carries no subjectRef, title or session id', () => {
    const sb = createSandbox();
    const s = sess(sb, { subjectRef: 'K-01', title: 'gizli baslik' });
    const json = JSON.stringify(decide(sb, s, 'Aramızda kalsın.'));
    ['K-01', 'gizli baslik', s.id].forEach(x => assert.equal(json.indexOf(x), -1, x));
  });
  test('P3. derived observations are de-identified: shape without story', () => {
    const sb = createSandbox();
    const s = sess(sb, { context: 'child', subjectRef: 'K-01', title: 'gizli', tags: ['aile'] });
    const o = sb.coachingDeriveObservation(s, decide(sb, s, 'Aramızda kalsın.'));
    const json = JSON.stringify(o);
    ['K-01', 'gizli', s.id, 'aile', FIXED.now].forEach(x => assert.equal(json.indexOf(x), -1, x));
    assert.equal(o.period, '2026-08');          // month only, never the exact date
    assert.equal(o.context, 'child');
    assert.equal(o.minorContext, true);
    assert.equal(o.id, undefined);
    assert.equal(o.subjectRef, undefined);
    assert.equal(o.title, undefined);
    assert.equal(o.notes, undefined);
  });
  test('P4. learning purposes may never touch identifiable material', () => {
    const sb = createSandbox();
    const s = sess(sb);
    sb.COACHING_DERIVED_ONLY_PURPOSES.forEach(p => {
      const r = sb.coachingDisclosureAllowed(p, s);
      assert.equal(r.allowed, false, p);
      assert.equal(r.reason, 'requires_deidentified_derivation', p);
      assert.equal(r.deidentificationRequired, true, p);
    });
    ['ai_training', 'academy_content', 'coach_dna', 'examples', 'analytics', 'anonymous_metrics']
      .forEach(p => assert.ok(sb.COACHING_DERIVED_ONLY_PURPOSES.indexOf(p) >= 0, p));
  });
  test('P5. sharing and export need an explicit decision; export has no safe channel yet', () => {
    const sb = createSandbox();
    const s = sess(sb);
    assert.equal(sb.coachingDisclosureAllowed('explicit_share', s).allowed, false);
    assert.equal(sb.coachingDisclosureAllowed('explicit_share', s).reason, 'explicit_consent_required');
    assert.equal(sb.coachingDisclosureAllowed('explicit_share', s, { explicitConsent: true }).allowed, true);
    assert.equal(sb.coachingDisclosureAllowed('export', s, { explicitConsent: true }).allowed, false);
    assert.equal(sb.coachingDisclosureAllowed('export', s, { explicitConsent: true }).reason, 'no_privacy_safe_export_channel');
    assert.equal(sb.coachingDisclosureAllowed('export', s, { explicitConsent: true, scopedExport: true }).allowed, true);
    assert.equal(sb.coachingDisclosureAllowed('nonsense', s).reason, 'unknown_purpose');
  });
  test('P6. the owner reviewing their own practice stays allowed', () => {
    const sb = createSandbox();
    ['owner_view', 'coach_review'].forEach(p =>
      assert.equal(sb.coachingDisclosureAllowed(p, sess(sb)).allowed, true, p));
  });
  test('P7. B3 still holds: no automatic broad backup or export', () => {
    const sb = createSandbox();
    // B3 is closed by a dedicated scoped channel — the legacy D paths stay shut.
    assert.equal(sb.COACHING_BACKUP_POLICY.reason, 'excluded_by_design_use_scoped_export');
    assert.equal(sb.COACHING_BACKUP_POLICY.channel, 'coachingExport');
    assert.equal(sb.COACHING_BACKUP_POLICY.includedInStateBackup, false);
    assert.equal(sb.COACHING_BACKUP_POLICY.includedInLocalJsonExport, false);
    assert.equal(sb.coachingBackupProvider().included, false);
    const fields = sb.DIFF_SCHEMA.arrays.map(a => a.field).concat(sb.DIFF_SCHEMA.objects, sb.DIFF_SCHEMA.scalars);
    assert.equal(fields.some(f => /coachingSession/i.test(f)), false);
  });
  test('P8. a coachee email still cannot be stored as a subject reference', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingBuildSession({ subjectRef: 'danisan@example.com' }).ok, false);
  });
});

/* ── Q. Determinism and quality ───────────────────────────────────────────── */
describe('Q. Deterministic, stable, fail-safe', () => {
  test('Q1. identical input yields byte-identical decisions', () => {
    const sb = createSandbox();
    const s = sess(sb);
    const first = JSON.stringify(decide(sb, s, 'Her gün ağlıyorum.'));
    for (let i = 0; i < 50; i++) assert.equal(JSON.stringify(decide(sb, s, 'Her gün ağlıyorum.')), first);
  });
  test('Q2. every emitted reason code is in the stable registry', () => {
    const sb = createSandbox();
    const inputs = ['Delegasyon.', 'Bende depresyon var mı?', 'İntihar etmeyi düşünüyorum.', 'Eşim beni dövüyor.',
      'Aramızda kalsın.', 'Sesler duyuyorum.', 'Bu konuda yetkin değilim.', 'Alkol bağımlısıyım.'];
    const contexts = ['self', 'adult', 'executive'];
    contexts.forEach(c => inputs.forEach(t =>
      assert.ok(sb.coachingValidReasonCode(decide(sb, sess(sb, { context: c }), t).reasonCode), c + '/' + t)));
    ['guardian_consent_required', 'guardian_consent_declined', 'intervention_not_permitted_in_context',
     'minor_safeguarding_escalation', 'insufficient_context', 'unknown_context']
      .forEach(c => assert.ok(sb.coachingValidReasonCode(c), c));
  });
  test('Q3. every reason code has a rationale', () => {
    const sb = createSandbox();
    sb.COACHING_REASON_CODES.forEach(c => assert.ok(new RegExp('\\b' + c + ':').test(SRC19), 'no rationale for ' + c));
  });
  test('Q4. an unknown or malformed situation fails safe', () => {
    const sb = createSandbox();
    [[null, null], [undefined, {}], [{}, null], ['x', 'y'], [[], []]].forEach(([a, b]) => {
      const d = sb.coachingSafetyEvaluate(a, b);
      assert.equal(d.decision, 'pause', JSON.stringify([a, b]));
      assert.ok(['insufficient_context', 'unknown_context'].indexOf(d.reasonCode) >= 0);
    });
    const bad = Object.assign({}, sess(sb), { context: 'therapy_patient' });
    const d2 = sb.coachingSafetyEvaluate(bad, ev('merhaba'));
    assert.equal(d2.decision, 'pause');
    assert.equal(d2.reasonCode, 'unknown_context');
  });
  test('Q5. a decision is never only a colour or a score', () => {
    const sb = createSandbox();
    const d = decide(sb, sess(sb), 'Bende depresyon var mı?');
    ['decision', 'reasonCode', 'severity', 'rationale', 'context', 'nextAction', 'requiresConfirmation', 'basis', 'principleIds']
      .forEach(k => assert.ok(d[k] !== undefined && d[k] !== '', 'missing ' + k));
    assert.ok(d.rationale.length > 15);
    assert.ok(d.basis.standards.length + d.basis.policies.length > 0);
    assert.ok(d.basis.sourceIds.length > 0);
  });
  test('Q6. decision and severity ordering is monotone', () => {
    const sb = createSandbox();
    const s = sess(sb);
    const rank = { allow: 0, allow_with_note: 1, pause: 2, stop_and_refer: 3 };
    const ladder = ['Delegasyon.', 'Aramızda kalsın.', 'Bende depresyon var mı?', 'İntihar etmeyi düşünüyorum.'];
    let prev = -1;
    ladder.forEach(t => { const r = rank[decide(sb, s, t).decision]; assert.ok(r > prev, t); prev = r; });
  });
});

/* ── E. Professional source registry ──────────────────────────────────────── */
describe('E. Professional sources and derived principles', () => {
  test('E1. sources carry metadata only — no reproduced text', () => {
    const sb = createSandbox();
    assert.ok(sb.coachingSourceIds().length >= 5);
    sb.coachingSourceIds().forEach(id => {
      const s = sb.coachingSource(id);
      ['sourceId', 'title', 'issuingBody', 'sourceType', 'officialUrl', 'publicationDate', 'revisionDate',
       'version', 'verified', 'verifiedAt', 'verificationBasis', 'unverifiedFields',
       'supersedes', 'supersededBy', 'scope', 'note'].forEach(k => assert.ok(k in s, id + '.' + k));
      assert.equal(s.sourceId, id);
      assert.equal('text' in s, false, id);
      assert.equal('fullText' in s, false, id);
      assert.ok(s.title.length < 120, id);
      assert.ok(s.note.length < 260, id);
      if (s.sourceType !== null) assert.ok(sb.COACHING_SOURCE_TYPES.indexOf(s.sourceType) >= 0, id);
      if (s.verified) { assert.ok(s.verifiedAt, id); assert.ok(s.verificationBasis, id); }
    });
    ['icf.ethics', 'icf.competencies', 'icf.referral', 'emcc.ac.ethics', 'un.crc', 'kcs.standards']
      .forEach(id => assert.ok(sb.coachingSource(id), id));
    assert.equal(sb.coachingRegisterSource('x.y', { sourceType: 'made_up' }).error, 'INVALID_SOURCE_TYPE');
  });
  test('E1b. Y1: the verifiable sources are verified with a stated basis', () => {
    const sb = createSandbox();
    const icf = sb.coachingSource('icf.ethics');
    assert.equal(icf.verified, true);
    assert.equal(icf.version, '2025');
    assert.match(icf.officialUrl, /^https:\/\/coachingfederation\.org\/.*code-of-ethics-2025\.pdf$/);
    assert.equal(icf.supersedes, '2020 edition');
    const comp = sb.coachingSource('icf.competencies');
    assert.equal(comp.verified, true);
    assert.equal(comp.version, '2025');
    assert.equal(comp.sourceType, 'competency_framework');
    const emcc = sb.coachingSource('emcc.ac.ethics');
    assert.equal(emcc.verified, true);
    assert.equal(emcc.version, '4');
    assert.equal(emcc.publicationDate, '2026-02-15');
    assert.equal(emcc.revisionDate, '2025');
    assert.match(emcc.verificationBasis, /first_party_announcement_read/);
    assert.equal(/2016/.test(JSON.stringify(emcc)), false);   // no stale edition kept as current
    const crc = sb.coachingSource('un.crc');
    assert.equal(crc.verified, true);
    assert.equal(crc.publicationDate, '1989-11-20');
    assert.match(crc.verificationBasis, /1990-09-02/);
    const kcs = sb.coachingSource('kcs.standards');
    assert.equal(kcs.verified, true);
    assert.equal(kcs.sourceType, 'safeguarding_standards');
    assert.equal(kcs.version, null);                          // edition deliberately not asserted
    assert.ok(kcs.unverifiedFields.indexOf('version') >= 0);
    assert.equal(/\blaw\b/i.test(kcs.note), false || kcs.note.indexOf('NOT law') >= 0);
  });
  test('E2. the ICF referral resource stays honestly unresolved (never fabricated)', () => {
    const sb = createSandbox();
    const pending = sb.coachingSourcesNeedingVerification().map(p => p.sourceId);
    assert.ok(pending.indexOf('icf.referral') >= 0);
    // Y1: every source the owner verified stays verified; Phase 4 framework
    // provenance records are honestly unverified rather than dressed up.
    ['icf.ethics', 'icf.competencies', 'emcc.ac.ethics', 'un.crc', 'kcs.standards']
      .forEach(id => assert.equal(pending.indexOf(id), -1, id));
    const ref = sb.coachingSource('icf.referral');
    assert.equal(ref.verified, false);
    assert.equal(ref.officialUrl, null);
    assert.equal(ref.version, null);
    assert.equal(ref.publicationDate, null);
    assert.equal(ref.verificationBasis, null);
    ['officialUrl', 'version', 'publicationDate'].forEach(f => assert.ok(ref.unverifiedFields.indexOf(f) >= 0, f));
    // and no URL of any kind was slipped into the record as if it governed
    assert.equal(JSON.stringify(ref).indexOf('http'), -1);
  });
  test('E3. PROFESSIONAL STANDARD and PRODUCT POLICY are never blended', () => {
    const sb = createSandbox();
    const standards = sb.coachingPrinciplesOfKind('PROFESSIONAL_STANDARD');
    const policies = sb.coachingPrinciplesOfKind('FOCUSUP_PRODUCT_POLICY');
    assert.ok(standards.length >= 5);
    assert.ok(policies.length >= 4);
    assert.equal(standards.filter(id => policies.indexOf(id) >= 0).length, 0);
    standards.forEach(id => assert.ok(sb.coachingPrinciple(id).sourceIds.length > 0, id + ' has no source'));
    policies.forEach(id => assert.equal(sb.coachingPrinciple(id).kind, 'FOCUSUP_PRODUCT_POLICY', id));
  });
  test('E4. a standard cannot be registered without a source; unknown sources are refused', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingRegisterPrinciple('x.y', { kind: 'PROFESSIONAL_STANDARD', statement: 's' }).error, 'STANDARD_WITHOUT_SOURCE');
    assert.equal(sb.coachingRegisterPrinciple('x.y', { kind: 'PROFESSIONAL_STANDARD', sourceIds: ['nope'], statement: 's' }).error, 'UNKNOWN_SOURCE:nope');
    assert.equal(sb.coachingRegisterPrinciple('x.y', { kind: 'SOMETHING', statement: 's' }).error, 'INVALID_PRINCIPLE_KIND');
    assert.equal(sb.coachingRegisterPrinciple('BAD ID', { kind: 'FOCUSUP_PRODUCT_POLICY' }).error, 'INVALID_PRINCIPLE_ID');
    assert.equal(sb.coachingRegisterPrinciple('x.policy', { kind: 'FOCUSUP_PRODUCT_POLICY', statement: 's' }).ok, true);
  });
  test('E5. every decision names the standards and policies it rests on', () => {
    const sb = createSandbox();
    const d = decide(sb, sess(sb), 'İntihar etmeyi düşünüyorum.');
    assert.ok(d.basis.standards.indexOf('scope.not_therapy') >= 0);
    assert.ok(d.basis.policies.indexOf('policy.fail_safe') >= 0);
    assert.ok(d.basis.sourceIds.indexOf('icf.ethics') >= 0);
    d.basis.standards.forEach(id => assert.equal(sb.coachingPrinciple(id).kind, 'PROFESSIONAL_STANDARD', id));
    d.basis.policies.forEach(id => assert.equal(sb.coachingPrinciple(id).kind, 'FOCUSUP_PRODUCT_POLICY', id));
  });
  test('E6. the ethics self-check reports the whole contract', () => {
    const sb = createSandbox();
    const c = sb.coachingEthicsSelfCheck();
    assert.equal(c.ethicsVersion, 1);
    assert.ok(c.standards.length >= 5);
    assert.ok(c.policies.length >= 4);
    assert.ok(c.needsVerification.length > 0);
    deq(c.consentPurposes, ['explicit_share', 'export']);
  });
});

/* ── R / static ───────────────────────────────────────────────────────────── */
describe('R. No live UI, mirrors and static guards', () => {
  test('R1. no navigation entry, route or screen was added', () => {
    const ui = fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8');
    const boot = fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8');
    assert.equal(/coachingSession|COACHING_|safeguard/i.test(ui), false);
    assert.equal(/coachingSession|COACHING_|safeguard/i.test(boot), false);
    assert.equal((ui.match(/\{id:'coaching'/g) || []).length, 1);   // the legacy entry, unchanged
    [X18, X19].forEach((src, i) => {
      assert.equal(/renderPage|gotoTab|\bsh\(|innerHTML|document\./.test(src), false, 'module ' + i);
      assert.equal(/NAV\s*=|nav-root/.test(src), false, 'module ' + i);
    });
  });
  test('R2. no question bank, approach router, academy, simulator or mirror shipped', () => {
    const sb = createSandbox();
    // Phase 4 has since filled the approach registry Phase 1 declared — via the
    // SAME registry, not a second one. Phase 2 itself still ships none.
    assert.equal(sb.coachingApproachKeys().length, 10);
    assert.equal(/coachingRegisterApproachDef|coachingRegisterApproach\s*\(/.test(C18 + C19), false);
    // Phase 2 itself ships no interventions; every policy comes from the Phase 3 modules
    assert.equal(/coachingRegisterIntervention\s*\(/.test(C18 + C19), false);
    // the safeguard ENGINE stays methodology-free
    assert.equal(/GROW|solution.focused|motivational.interview|socratic/i.test(C19), false);
    // 18 now holds Phase 4 framework PROVENANCE in the shared source registry
    // (instruction: one source registry, not two) — metadata only, no content
    assert.ok(sb.coachingSource('whitmore.performance'));
    assert.ok(sb.coachingSource('mi.mint'));
    assert.equal(/compatiblePurposes|preferredInterventionTypes|tagPurposes|coachingRouteApproaches/.test(C18), false);
  });
  test('R3. the modules perform no I/O of any kind', () => {
    [[C18, '18'], [C19, '19']].forEach(([src, n]) => {
      [[/fetch\s*\(/, 'fetch'], [/XMLHttpRequest|WebSocket|EventSource/, 'socket'], [/localStorage/, 'storage'],
       [/setTimeout|setInterval/, 'timer'], [/openai|anthropic|gemini|apiKey/i, 'ai'],
       [/\bD\.\w+\s*=[^=]/, 'payload write'], [/INIT\.\w/, 'payload field'], [/save\s*\(\)/, 'save']
      ].forEach(([re, name]) => assert.equal(re.test(src), false, n + ': ' + name));
    });
  });
  test('R4. mirrors are byte-identical and modules stay under the size limit', () => {
    ['17-coaching-domain.js', '18-coaching-ethics.js', '19-coaching-safeguard.js'].forEach(f => {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'),
        fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
      assert.ok(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').split('\n').length < 900, f);
    });
    assert.equal(INDEX, fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
  });
  test('R5. both modules are wired into the page exactly once', () => {
    ['18-coaching-ethics.js', '19-coaching-safeguard.js'].forEach(f =>
      assert.equal((INDEX.match(new RegExp(f.replace('.', '\\.'), 'g')) || []).length, 1, f));
    assert.ok(INDEX.indexOf('17-coaching-domain.js') < INDEX.indexOf('18-coaching-ethics.js'));
    assert.ok(INDEX.indexOf('18-coaching-ethics.js') < INDEX.indexOf('19-coaching-safeguard.js'));
  });
  test('R6. the safeguard layer is documented as a net, not a guarantee', () => {
    assert.match(SRC19, /SAFETY NET, never a safety guarantee/);
    assert.match(SRC19, /not a diagnostic classifier/);
  });
});
