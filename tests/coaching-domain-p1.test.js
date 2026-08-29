'use strict';
/* COACHING MASTERY OS — PHASE 1 (Domain + Privacy Foundation) tests.
   Guarantees: canonical session schema + deterministic normalization, explicit
   lifecycle without hard delete, owner-only-by-default privacy, module-scoped
   PIL capability that generic state.read can NEVER grant, fail-closed owner
   resolution, a safety gate that cannot be bypassed, untouched legacy
   D.coaching, coaching data never entering app/state, a bounded session
   document, canonical relation reuse, and an explicit no-backup decision. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '17-coaching-domain.js'), 'utf8');
const SRC_PUB = fs.readFileSync(path.join(ROOT, 'public', 'js', '17-coaching-domain.js'), 'utf8');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BACKUP_SRC = fs.readFileSync(path.join(ROOT, 'js', '04-backup.js'), 'utf8');

const FIXED = { now: '2026-08-29T09:00:00.000Z', id: 'coa_test01-1' };

/* Values produced inside the vm sandbox have a different realm's prototypes, so
   deepStrictEqual would fail on structure-identical arrays/objects. Normalizing
   through JSON puts both sides in this realm and keeps the comparison strict. */
function deq(actual, expected, msg) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
}

function signedIn(sb, uid, email) {
  sb.CLOUD.uid = uid;
  sb.CLOUD.user = { uid: uid, email: email || null, isAnonymous: false };
}
function asMember(sb, loginUid, permissions, extra) {
  sb.IDENTITY.sharingEnabled = true;
  signedIn(sb, loginUid, loginUid + '@x.com');
  sb.CLOUD.personalEntry = Object.assign({
    ownerUid: 'OWNER1', ownerEmail: 'owner@x.com', organizationId: null,
    role: 'editor', status: 'active', permissions: permissions
  }, extra || {});
  sb.CLOUD.personalOwnerActive = true;
}
function allowGate(sb, decision) {
  sb.coachingInstallSafetyGate(function () { return { decision: decision || 'allow' }; });
}

/* ── A. Canonical session: schema, normalization, validation ──────────────── */
describe('A. Canonical session schema', () => {
  test('A1. empty input builds a valid canonical session with safe defaults', () => {
    const sb = createSandbox();
    const r = sb.coachingBuildSession({});
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    const s = r.session;
    assert.equal(s.schemaVersion, 1);
    assert.equal(s.context, 'self');
    assert.equal(s.lifecycle, 'draft');
    assert.equal(s.privacy, 'private');
    assert.ok(sb.coachingValidId(s.id));
    assert.match(s.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(s.updatedAt, s.createdAt);
  });
  test('A2. privacy default is PRIVATE and it is the only level in Phase 1', () => {
    const sb = createSandbox();
    assert.equal(sb.COACHING_PRIVACY_DEFAULT, 'private');
    deq(sb.COACHING_PRIVACY_LEVELS, ['private']);
    assert.equal(sb.coachingValidPrivacy('shared'), false);
    assert.equal(sb.coachingValidPrivacy('public'), false);
    // an attempt to request a broader level silently normalizes back to private
    assert.equal(sb.coachingBuildSession({ privacy: 'public' }).session.privacy, 'private');
  });
  test('A3. identifier format is validated', () => {
    const sb = createSandbox();
    assert.ok(sb.coachingValidId(sb.newCoachingSessionId()));
    ['', 'coa_', 'coa_abc', 'dec_abc-1', 'x', null, undefined, 42, {}].forEach(bad =>
      assert.equal(sb.coachingValidId(bad), false, String(bad)));
  });
  test('A4. ids are unique across rapid creation', () => {
    const sb = createSandbox();
    const ids = new Set();
    for (let i = 0; i < 200; i++) ids.add(sb.newCoachingSessionId());
    assert.equal(ids.size, 200);
  });
  test('A5. invalid timestamps are rejected by validation', () => {
    const sb = createSandbox();
    const base = sb.coachingBuildSession({}, FIXED).session;
    ['not-a-date', '2026-08-29', '', null, 12345].forEach(bad => {
      assert.ok(sb.coachingValidateSession(Object.assign({}, base, { createdAt: bad })).errors.includes('INVALID_CREATED_AT'), String(bad));
      assert.ok(sb.coachingValidateSession(Object.assign({}, base, { updatedAt: bad })).errors.includes('INVALID_UPDATED_AT'), String(bad));
    });
  });
  test('A6. updatedAt before createdAt is rejected', () => {
    const sb = createSandbox();
    const base = sb.coachingBuildSession({}, FIXED).session;
    const bad = Object.assign({}, base, { createdAt: '2026-08-29T10:00:00.000Z', updatedAt: '2026-08-29T09:00:00.000Z' });
    assert.ok(sb.coachingValidateSession(bad).errors.includes('UPDATED_BEFORE_CREATED'));
  });
  test('A7. invalid lifecycle / context / privacy are rejected by validation', () => {
    const sb = createSandbox();
    const base = sb.coachingBuildSession({}, FIXED).session;
    assert.ok(sb.coachingValidateSession(Object.assign({}, base, { lifecycle: 'deleted' })).errors.includes('INVALID_LIFECYCLE'));
    assert.ok(sb.coachingValidateSession(Object.assign({}, base, { context: 'therapy' })).errors.includes('INVALID_CONTEXT'));
    assert.ok(sb.coachingValidateSession(Object.assign({}, base, { privacy: 'org' })).errors.includes('INVALID_PRIVACY'));
    assert.ok(sb.coachingValidateSession(Object.assign({}, base, { id: 'nope' })).errors.includes('INVALID_ID'));
  });
  test('A8. schemaVersion: current accepted, forward version refused (no silent downgrade)', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingAcceptSchemaVersion(1), true);
    [0, -1, 2, 99, '1', 1.5, null, undefined, NaN, true].forEach(v =>
      assert.equal(sb.coachingAcceptSchemaVersion(v), false, String(v)));
  });
  test('A9. normalization is deterministic for identical input', () => {
    const sb = createSandbox();
    const input = { title: 'X', context: 'adult', tags: ['b', 'a', 'b'], counters: { notes: 3 } };
    const a = sb.coachingNormalizeSession(input, FIXED);
    const b = sb.coachingNormalizeSession(input, FIXED);
    assert.equal(sb.canonicalStringify(a), sb.canonicalStringify(b));
    assert.equal(a.id, FIXED.id);
  });
  test('A10. tag lists are deduped, trimmed and hard-capped', () => {
    const sb = createSandbox();
    const many = Array.from({ length: 60 }, (_, i) => 't' + i);
    const s = sb.coachingBuildSession({ tags: many.concat(many), competencyTags: many, approachTags: many }).session;
    assert.equal(s.tags.length, sb.COACHING_EMBEDDED_LIMITS.tags);
    assert.equal(s.competencyTags.length, sb.COACHING_EMBEDDED_LIMITS.competencyTags);
    assert.equal(s.approachTags.length, sb.COACHING_EMBEDDED_LIMITS.approachTags);
    assert.equal(new Set(s.tags).size, s.tags.length);
    deq(sb.coachingBuildSession({ tags: 'nope' }).session.tags, []);
  });
  test('A11. subjectRef must not be an email address', () => {
    const sb = createSandbox();
    const s = sb.coachingNormalizeSession({ subjectRef: 'danisan@example.com' }, FIXED);
    assert.ok(sb.coachingValidateSession(s).errors.includes('SUBJECT_REF_LOOKS_LIKE_EMAIL'));
    assert.equal(sb.coachingBuildSession({ subjectRef: 'danisan@example.com' }).ok, false);
    assert.equal(sb.coachingBuildSession({ subjectRef: 'K-01' }).ok, true);
  });
  test('A12. counters and review are normalized defensively', () => {
    const sb = createSandbox();
    const s = sb.coachingBuildSession({ counters: { notes: -3, transcript: 'x', attachments: 2.5, commitments: 4 }, review: { selfRating: 9 } }).session;
    assert.equal(s.counters.notes, 0);
    assert.equal(s.counters.transcript, 0);
    assert.equal(s.counters.attachments, 0);
    assert.equal(s.counters.commitments, 4);
    assert.equal(s.review.selfRating, null);
    assert.equal(sb.coachingBuildSession({ review: { selfRating: 4 } }).session.review.selfRating, 4);
  });
  test('A13. safeguard block defaults to the safe/clear state', () => {
    const sb = createSandbox();
    const s = sb.coachingBuildSession({ safeguard: { state: 'nonsense', severity: 'nonsense' } }).session;
    assert.equal(s.safeguard.state, 'clear');
    assert.equal(s.safeguard.severity, 'none');
    assert.equal(s.safeguard.referral, 'none');
    assert.equal(s.safeguard.reviewedAt, null);
    deq(s.safeguard.guardianConsent, { state: 'unknown', by: null, at: null });
    const g = sb.coachingBuildSession({ safeguard: { guardianConsent: { state: 'granted', by: 'veli', at: '2026-08-29T09:00:00.000Z' } } }).session;
    deq(g.safeguard.guardianConsent, { state: 'granted', by: 'veli', at: '2026-08-29T09:00:00.000Z' });
    assert.equal(sb.coachingBuildSession({ safeguard: { guardianConsent: { state: 'nope' } } }).session.safeguard.guardianConsent.state, 'unknown');
  });
});

/* ── B. Lifecycle ─────────────────────────────────────────────────────────── */
describe('B. Lifecycle', () => {
  test('B1. canonical states, and hard delete is not one of them', () => {
    const sb = createSandbox();
    deq(sb.COACHING_LIFECYCLE, ['draft', 'active', 'completed', 'cancelled', 'archived']);
    assert.equal(sb.COACHING_LIFECYCLE.includes('deleted'), false);
    assert.equal(sb.COACHING_LIFECYCLE.includes('purged'), false);
    // an abandoned session is cancelled and kept, never hard-deleted
    assert.equal(sb.coachingCanTransition('active', 'cancelled'), true);
    assert.equal(sb.coachingCanTransition('cancelled', 'archived'), true);
    assert.equal(sb.coachingCanTransition('cancelled', 'active'), false);
  });
  test('B2. transition matrix is explicit', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingCanTransition('draft', 'active'), true);
    assert.equal(sb.coachingCanTransition('draft', 'archived'), true);
    assert.equal(sb.coachingCanTransition('draft', 'completed'), false);
    assert.equal(sb.coachingCanTransition('active', 'completed'), true);
    assert.equal(sb.coachingCanTransition('completed', 'active'), false);
    assert.equal(sb.coachingCanTransition('archived', 'active'), false);
    assert.equal(sb.coachingCanTransition('archived', 'archived'), false);
    assert.equal(sb.coachingCanTransition('draft', 'deleted'), false);
    assert.equal(sb.coachingIsTerminal('archived'), true);
    assert.equal(sb.coachingIsTerminal('completed'), false);
  });
  test('B3. applyTransition is pure: returns a new record, leaves the original intact', () => {
    const sb = createSandbox();
    const s = sb.coachingBuildSession({}, FIXED).session;
    const before = sb.canonicalStringify(s);
    const r = sb.coachingApplyTransition(s, 'active', { now: '2026-08-30T09:00:00.000Z', actor: 'U1' });
    assert.equal(r.ok, true);
    assert.equal(r.session.lifecycle, 'active');
    assert.equal(r.session.updatedBy, 'U1');
    assert.notEqual(r.session, s);
    assert.equal(sb.canonicalStringify(s), before);
  });
  test('B4. illegal transition is refused', () => {
    const sb = createSandbox();
    const s = sb.coachingBuildSession({}, FIXED).session;
    deq(sb.coachingApplyTransition(s, 'completed'), { ok: false, error: 'INVALID_TRANSITION' });
    deq(sb.coachingApplyTransition(null, 'active'), { ok: false, error: 'NOT_AN_OBJECT' });
  });
});

/* ── C. Context registry (WHO) vs approach registry (HOW) ─────────────────── */
describe('C. Context and approach registries', () => {
  test('C1. the canonical five contexts exist', () => {
    const sb = createSandbox();
    deq(sb.coachingContextKeys(), ['adult', 'child', 'executive', 'self', 'youth']);
  });
  test('C2. child and youth carry minor safeguarding properties structurally', () => {
    const sb = createSandbox();
    ['child', 'youth'].forEach(k => {
      const c = sb.coachingContext(k);
      assert.equal(c.minor, true, k);
      assert.equal(c.guardianConsentRequired, true, k);
      assert.equal(c.heightenedSafeguarding, true, k);
      assert.equal(sb.coachingContextIsMinor(k), true, k);
    });
    ['self', 'adult', 'executive'].forEach(k => assert.equal(sb.coachingContextIsMinor(k), false, k));
  });
  test('C3. future contexts can be added without touching the canonical five', () => {
    const sb = createSandbox();
    ['career', 'leadership', 'employee', 'entrepreneur', 'parent', 'family'].forEach(k =>
      assert.equal(sb.coachingRegisterContext(k, { label: k }).ok, true, k));
    ['self', 'adult', 'youth', 'child', 'executive'].forEach(k =>
      assert.equal(sb.coachingValidContext(k), true, k));
    assert.equal(sb.coachingValidContext('career'), true);
    assert.equal(sb.coachingBuildSession({ context: 'career' }).session.context, 'career');
  });
  test('C4. invalid context keys are refused', () => {
    const sb = createSandbox();
    ['', 'A', 'Career', '1x', 'a', 'with space', 'with-dash', null, 5, 'x'.repeat(40)].forEach(k =>
      assert.equal(sb.coachingRegisterContext(k).ok, false, String(k)));
  });
  test('C5. Phase 1 declares the approach registry but ships no content into it', () => {
    const sb = createSandbox();
    // the module under test contributes nothing; Phase 4 fills the same registry
    assert.equal(/coachingRegisterApproach\('/.test(SRC), false);
    assert.equal(sb.coachingValidApproach('grow'), false);          // lower-case is not an id
    assert.equal(sb.coachingBuildSession({ approach: 'grow' }).session.approach, null);
    assert.equal(sb.coachingValidApproach('GROW'), true);           // filled by Phase 4
    assert.equal(sb.coachingBuildSession({ approach: 'GROW' }).session.approach, 'GROW');
  });
  test('C6. context and methodology are separate namespaces and cannot shadow', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingValidApproach('self'), false);        // a context is not an approach
    assert.equal(sb.coachingRegisterApproach('child').error, 'APPROACH_SHADOWS_CONTEXT');
    assert.equal(sb.coachingRegisterApproach('grow', { label: 'GROW' }).ok, true);
    assert.equal(sb.coachingValidContext('grow'), false);          // an approach is not a context
    assert.equal(sb.coachingBuildSession({ approach: 'grow' }).session.approach, 'grow');
  });
});

/* ── D. Privacy + PIL authorization ───────────────────────────────────────── */
describe('D. Privacy and PIL authorization', () => {
  test('D1. owner (sharing OFF) resolves to its own uid and is fully capable', () => {
    const sb = createSandbox(); signedIn(sb, 'U1');
    assert.equal(sb.IDENTITY.sharingEnabled, false);
    assert.equal(sb.coachingResolveOwner(), 'U1');
    assert.equal(sb.coachingCan('read'), true);
    assert.equal(sb.coachingCan('write'), true);
    deq(sb.coachingAssertReadable(), { allowed: true, ownerUid: 'U1' });
  });
  test('D2. unauthenticated is denied and resolves no owner', () => {
    const sb = createSandbox();
    sb.CLOUD.uid = null; sb.CLOUD.user = null;
    assert.equal(sb.coachingResolveOwner(), null);
    assert.equal(sb.coachingCan('read'), false);
    deq(sb.coachingAssertReadable(), { allowed: false, reason: 'owner_unresolved' });
    assert.equal(sb.coachingSessionsCol(), null);
  });
  test('D3. GENERIC state.read does NOT grant coaching access (core privacy rule)', () => {
    const sb = createSandbox();
    asMember(sb, 'MEMBER1', {
      state: { read: true, write: true, delete: true, import: true, restore: true, backup: true },
      goals: { read: true, write: true }, wisdom: { read: true, write: true }
    });
    assert.equal(sb.personalCan('state', 'read'), true);   // the member really can read app/state
    assert.equal(sb.coachingCan('read'), false);            // ...and still gains nothing here
    assert.equal(sb.coachingCan('write'), false);
    deq(sb.coachingAssertReadable(), { allowed: false, reason: 'not_authorized' });
  });
  test('D4. no default role preset can ever grant coaching', () => {
    const sb = createSandbox();
    assert.equal(sb.PIL_MODULES.includes('coaching'), false);
    Object.keys(sb.PIL_ROLE_PRESETS).forEach(role => {
      const perms = sb.pilPermissionsFromRole(role);
      assert.equal(Object.prototype.hasOwnProperty.call(perms, 'coaching'), false, role);
    });
    ['owner', 'manager', 'editor', 'viewer'].forEach(role => {
      const sb2 = createSandbox();
      asMember(sb2, 'M_' + role, sb2.pilPermissionsFromRole(role));
      assert.equal(sb2.coachingCan('read'), false, role);
    });
  });
  test('D5. an explicitly granted member gets exactly the granted capabilities', () => {
    const sb = createSandbox();
    asMember(sb, 'MEMBER1', { state: { read: true }, coaching: { read: true } });
    assert.equal(sb.coachingCan('read'), true);
    assert.equal(sb.coachingCan('write'), false);
    assert.equal(sb.coachingCan('delete'), false);
    assert.equal(sb.coachingCan('backup'), false);
  });
  test('D6. unknown capability verbs are refused', () => {
    const sb = createSandbox(); signedIn(sb, 'U1');
    ['admin', 'share', 'export', '', null].forEach(c => assert.equal(sb.coachingCan(c), false, String(c)));
  });
  test('D7. revoked / inactive member is denied (fail-closed)', () => {
    ['revoked', 'disabled', 'pending'].forEach(st => {
      const sb = createSandbox();
      asMember(sb, 'MEMBER1', { coaching: { read: true, write: true } }, { status: st });
      assert.equal(sb.coachingResolveOwner(), null, st);
      assert.equal(sb.coachingCan('read'), false, st);
    });
  });
  test('D8. inactive owner denies the member (fail-closed)', () => {
    const sb = createSandbox();
    asMember(sb, 'MEMBER1', { coaching: { read: true } });
    sb.CLOUD.personalOwnerActive = false;
    assert.equal(sb.coachingResolveOwner(), null);
    assert.equal(sb.coachingCan('read'), false);
  });
  test('D9. not enrolled while sharing is ON is denied — no login-uid fallback', () => {
    const sb = createSandbox();
    sb.IDENTITY.sharingEnabled = true; signedIn(sb, 'STRANGER');
    sb.CLOUD.personalEntry = null;
    assert.equal(sb.coachingResolveOwner(), null);
    assert.notEqual(sb.coachingResolveOwner(), 'STRANGER');
    assert.equal(sb.coachingCan('read'), false);
  });
  test('D10. corrupt permissions deny instead of degrading open', () => {
    [null, {}, [], 'yes', 7, { coaching: 'yes' }, { coaching: [] }].forEach(p => {
      const sb = createSandbox();
      asMember(sb, 'MEMBER1', p);
      assert.equal(sb.coachingCan('read'), false, JSON.stringify(p));
    });
  });
  test('D11. a member writes into the OWNER scope, never its own login scope', () => {
    const sb = createSandbox();
    asMember(sb, 'MEMBER1', { coaching: { read: true, write: true } });
    sb.COACHING.enabled = true; allowGate(sb);
    const g = sb.coachingAssertWritable('write');
    assert.equal(g.allowed, true);
    assert.equal(g.ownerUid, 'OWNER1');
    assert.notEqual(g.ownerUid, 'MEMBER1');
    assert.equal(sb.coachingRootPath(g.ownerUid), 'users/OWNER1/coachingSessions');
  });
  test('D12. cross-owner reach is impossible through the resolved path', () => {
    const sb = createSandbox();
    asMember(sb, 'MEMBER1', { coaching: { read: true } });
    const writes = [];
    /* NEW-1: the handle comes from the dedicated non-persistent coaching client,
       never from the app-wide persistent CLOUD.db. */
    sb.CLOUD.db = { collection() { throw new Error('coaching must not use the persistent instance'); } };
    sb.COACHING_CLIENT.db = { collection(n) { return { doc(id) { return { collection(c) { writes.push(n + '/' + id + '/' + c); return { __path: n + '/' + id + '/' + c }; } }; } }; } };
    sb.COACHING_CLIENT.ready = true;
    const col = sb.coachingSessionsCol();
    assert.equal(col.__path, 'users/OWNER1/coachingSessions');
    assert.equal(writes.some(p => p.indexOf('MEMBER1') >= 0), false);
    assert.equal(writes.some(p => p.indexOf('OWNER2') >= 0), false);
  });
  test('D13. PIL itself was not modified by this phase', () => {
    const sb = createSandbox();
    deq(sb.PIL_MODULES, ['wisdom', 'goals', 'principles', 'notes', 'decisions', 'relations', 'state', 'archive']);
    deq(sb.PIL_CAPS, ['read', 'write', 'delete', 'import', 'restore', 'backup']);
  });
});

/* ── E. Safety gate (Phase 2 seam) ────────────────────────────────────────── */
describe('E. Safety gate cannot be bypassed', () => {
  test('E1. no gate installed → denied, decision "pause"', () => {
    const sb = createSandbox();
    sb.COACHING_SAFETY.gate = null;                       // Phase 2 installs one at load
    assert.equal(sb.coachingSafetyGateInstalled(), false);
    deq(sb.coachingSafetyCheck(null, {}), { allowed: false, decision: 'pause', reason: 'safety_layer_absent' });
  });
  test('E2. a fully authorized owner with the flag ON still cannot write without the gate', () => {
    const sb = createSandbox(); signedIn(sb, 'U1');
    sb.COACHING_SAFETY.gate = null;                       // simulate the layer being absent
    sb.COACHING.enabled = true;
    const g = sb.coachingAssertWritable('write');
    assert.equal(g.allowed, false);
    assert.equal(g.reason, 'safety_layer_absent');
  });
  test('E3. a throwing gate denies', () => {
    const sb = createSandbox();
    sb.coachingInstallSafetyGate(function () { throw new Error('boom'); });
    deq(sb.coachingSafetyCheck(null, {}), { allowed: false, decision: 'pause', reason: 'safety_gate_error' });
  });
  test('E4. a gate returning an unknown shape denies', () => {
    [null, undefined, 'allow', {}, { decision: 'yes' }, { decision: true }, []].forEach(bad => {
      const sb = createSandbox();
      sb.coachingInstallSafetyGate(function () { return bad; });
      assert.equal(sb.coachingSafetyCheck(null, {}).allowed, false, JSON.stringify(bad));
      assert.equal(sb.coachingSafetyCheck(null, {}).reason, 'safety_gate_invalid_result');
    });
  });
  test('E5. stop_and_refer and pause deny; allow and allow_with_note permit', () => {
    const map = { allow: true, allow_with_note: true, pause: false, stop_and_refer: false };
    Object.keys(map).forEach(d => {
      const sb = createSandbox(); allowGate(sb, d);
      assert.equal(sb.coachingSafetyCheck(null, {}).allowed, map[d], d);
      assert.equal(sb.coachingSafetyCheck(null, {}).decision, d, d);
    });
  });
  test('E6. installing a non-function gate is refused', () => {
    const sb = createSandbox();
    sb.COACHING_SAFETY.gate = null;
    deq(sb.coachingInstallSafetyGate('x'), { ok: false, error: 'INVALID_GATE' });
    assert.equal(sb.coachingSafetyGateInstalled(), false);
  });
  test('E7. safety vocabulary is declared but no rule library ships', () => {
    const sb = createSandbox();
    deq(sb.COACHING_SAFEGUARD_SEVERITY, ['none', 'watch', 'concern', 'urgent']);
    deq(sb.COACHING_SAFEGUARD_STATE, ['clear', 'flagged', 'escalated', 'referred', 'closed']);
    deq(sb.COACHING_REFERRAL_STATE, ['none', 'suggested', 'made', 'declined', 'confirmed']);
    deq(sb.COACHING_SAFETY_DECISION, ['allow', 'allow_with_note', 'pause', 'stop_and_refer']);
    assert.equal(sb.COACHING_BOUNDARY_CATEGORIES.length, 6);
    // vocabulary only: no diagnostic terms, no condition list
    // vocabulary only: no rule records, no condition library, no scoring engine
    assert.equal(/when:\s*function|severity:'|priority:\s*[0-9]/.test(SRC), false);
    assert.equal(/COACHING_(RULES|TRIGGERS|SIGNALS|CONDITIONS)\s*=/.test(SRC), false);
    sb.COACHING_BOUNDARY_CATEGORIES.forEach(c => assert.equal(typeof c, 'string', String(c)));
  });
});

/* ── F. Feature flag ──────────────────────────────────────────────────────── */
describe('F. Feature flag', () => {
  test('F1. default is OFF', () => {
    assert.equal(createSandbox().COACHING.enabled, false);
    assert.match(SRC, /var COACHING = \{ enabled:false \}/);
  });
  test('F2. OFF denies every write, even for a fully capable owner with a gate', () => {
    const sb = createSandbox(); signedIn(sb, 'U1'); allowGate(sb);
    deq(sb.coachingAssertWritable('write'), { allowed: false, reason: 'feature_disabled' });
  });
  test('F3. flag ON is not authorization — an ungranted member is still denied', () => {
    const sb = createSandbox();
    asMember(sb, 'MEMBER1', { state: { read: true, write: true } });
    sb.COACHING.enabled = true; allowGate(sb);
    deq(sb.coachingAssertWritable('write'), { allowed: false, reason: 'not_authorized' });
  });
  test('F4. denial order is flag → owner → capability → safety', () => {
    const sb = createSandbox();
    sb.CLOUD.uid = null; sb.CLOUD.user = null;
    assert.equal(sb.coachingAssertWritable('write').reason, 'feature_disabled');
    sb.COACHING.enabled = true;
    assert.equal(sb.coachingAssertWritable('write').reason, 'owner_unresolved');
    signedIn(sb, 'U1');
    sb.COACHING_SAFETY.gate = null;
    assert.equal(sb.coachingAssertWritable('write').reason, 'safety_layer_absent');
  });
  test('F5. exercising the whole public surface while OFF leaves D byte-identical', () => {
    const sb = createSandbox(); signedIn(sb, 'U1');
    const before = sb.canonicalStringify(sb.D);
    sb.coachingSelfCheck();
    sb.coachingBuildSession({ title: 'x', context: 'child', tags: ['a'] });
    sb.coachingLegacyArchive();
    sb.coachingLegacyCount();
    sb.coachingAssertWritable('write');
    sb.coachingAssertReadable();
    sb.coachingSafetyCheck(null, {});
    sb.coachingBackupProvider();
    sb.coachingRootPath('U1');
    sb.coachingStoreList();
    assert.equal(sb.canonicalStringify(sb.D), before);
  });
});

/* ── G. Legacy D.coaching compatibility ───────────────────────────────────── */
describe('G. Legacy D.coaching stays untouched', () => {
  test('G1. the legacy array and its seed record survive unchanged', () => {
    const sb = createSandbox();
    const before = sb.canonicalStringify(sb.D.coaching);
    sb.coachingLegacyArchive(); sb.coachingLegacyCount(); sb.coachingSelfCheck();
    assert.equal(sb.canonicalStringify(sb.D.coaching), before);
    assert.equal(sb.D.coaching.length, 1);
    assert.equal(sb.D.coaching[0].id, 101);
    assert.equal(sb.D.coaching[0].title, 'OKR Sistemi');
  });
  test('G2. the archive adapter returns copies — callers cannot reach into D', () => {
    const sb = createSandbox();
    const a = sb.coachingLegacyArchive();
    assert.equal(a.length, 1);
    assert.equal(a[0].readOnly, true);
    assert.equal(a[0].source, 'legacy');
    assert.equal(a[0].schemaVersion, 0);
    a[0].title = 'HACKED'; a[0].text = 'HACKED'; a.push({ id: 999 });
    assert.equal(sb.D.coaching[0].title, 'OKR Sistemi');
    assert.equal(sb.D.coaching.length, 1);
  });
  test('G3. reading legacy data never creates the field when it is absent', () => {
    const sb = createSandbox();
    delete sb.D.coaching;
    deq(sb.coachingLegacyRaw(), []);
    deq(sb.coachingLegacyArchive(), []);
    assert.equal(sb.coachingLegacyCount(), 0);
    assert.equal(Object.prototype.hasOwnProperty.call(sb.D, 'coaching'), false);
  });
  test('G4. legacy lookup by id works and is read-only', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingLegacyById(101).title, 'OKR Sistemi');
    assert.equal(sb.coachingLegacyById('101').title, 'OKR Sistemi');
    assert.equal(sb.coachingLegacyById(999), null);
  });
  test('G5. no migration and no dual-write: the new store is empty', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingStoreCount(), 0);
    deq(sb.coachingStoreList(), []);
    assert.equal(sb.coachingStoreById(101), null);
    assert.equal(/function\s+\w*[Mm]igrat|migrateCoaching|dualWrite/.test(SRC), false);
  });
  test('G6. the legacy screen wiring is unchanged', () => {
    const boot = fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8');
    assert.match(boot, /coaching:function\(\)\{renderGenericList\('coaching'\);\}/);
    const ui = fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8');
    assert.match(ui, /\{id:'coaching',l:'Koçluk',i:'us'\}/);
  });
});

/* ── H. Storage separation and bounded documents ──────────────────────────── */
describe('H. Storage separation', () => {
  test('H1. coaching data has no field in the app/state payload', () => {
    const sb = createSandbox();
    Object.keys(sb.INIT).forEach(k => assert.equal(/coachingSession/i.test(k), false, k));
    assert.equal(sb.INIT.coachingSessions, undefined);
    assert.equal(sb.D.coachingSessions, undefined);
    assert.equal(sb.coachingSelfCheck().inPayload, false);
    const rebuilt = sb.buildStateFromPayload(JSON.parse(JSON.stringify(sb.D)));
    assert.equal(rebuilt.coachingSessions, undefined);
  });
  test('H2. paths are deterministic and owner-scoped', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingRootPath('U1'), 'users/U1/coachingSessions');
    assert.equal(sb.coachingSessionPath('U1', 'coa_a-1'), 'users/U1/coachingSessions/coa_a-1');
    assert.equal(sb.coachingChildPath('U1', 'coa_a-1', 'notes'), 'users/U1/coachingSessions/coa_a-1/notes');
    assert.equal(sb.coachingRootPath(null), null);
    assert.equal(sb.coachingSessionPath('U1', 'bad-id'), null);
    assert.equal(sb.coachingChildPath('U1', 'coa_a-1', 'anything'), null);
    assert.equal(sb.coachingChildPath('U1', 'coa_a-1', '__proto__'), null);
  });
  test('H3. unbounded content is modelled as child collections, never embedded', () => {
    const sb = createSandbox();
    deq(sb.COACHING_CHILD_COLLECTIONS,
      ['notes', 'interventions', 'reflections', 'observations', 'commitments', 'events', 'transcript', 'attachments']);
    const s = sb.coachingBuildSession({}, FIXED).session;
    sb.COACHING_CHILD_COLLECTIONS.forEach(k =>
      assert.equal(Object.prototype.hasOwnProperty.call(s, k), false, k));
    sb.COACHING_CHILD_COLLECTIONS.forEach(k => {
      const bad = Object.assign({}, s); bad[k] = [{ text: 'x' }];
      assert.ok(sb.coachingValidateSession(bad).errors.includes('EMBEDDED_CHILD_COLLECTION:' + k), k);
    });
  });
  test('H4. the session document keeps only bounded counters for child content', () => {
    const sb = createSandbox();
    const s = sb.coachingBuildSession({}, FIXED).session;
    sb.COACHING_CHILD_COLLECTIONS.forEach(k => assert.equal(s.counters[k], 0, k));
    assert.equal(sb.canonicalStringify(s).length < 2000, true);
  });
  test('H5. collection reads are bounded by contract', () => {
    const sb = createSandbox();
    assert.equal(typeof sb.COACHING_PAGE_MAX, 'number');
    assert.ok(sb.COACHING_PAGE_MAX > 0 && sb.COACHING_PAGE_MAX <= 100);
  });
  test('H6. the module performs no Firestore or network I/O', () => {
    [[/fetch\s*\(/, 'fetch'], [/XMLHttpRequest/, 'xhr'], [/WebSocket/, 'ws'], [/EventSource/, 'sse'],
     [/onSnapshot/, 'listener'], [/runTransaction/, 'transaction'], [/\.batch\s*\(/, 'batch'],
     [/queueCloudSave|commitMutation|writeLocal/, 'sync write'], [/firebase\.firestore\.FieldValue/, 'fieldvalue'],
     [/openai|anthropic|gemini|api_key|apiKey/i, 'ai provider'],
     [/\bD\.\w+\s*=[^=]/, 'payload write'], [/INIT\.\w/, 'payload field'],
     [/setInterval|setTimeout/, 'timer'], [/localStorage/, 'local persistence']
    ].forEach(([re, name]) => assert.equal(re.test(SRC), false, 'forbidden: ' + name));
  });
});

/* ── I. Relations reuse the canonical registry ────────────────────────────── */
describe('I. Relations', () => {
  test('I1. exactly one new resolver is registered, on the canonical registry', () => {
    const sb = createSandbox();
    assert.equal(sb.COACHING_RELATION_TYPE, 'coachingSession');
    assert.equal(typeof sb.RELATION_RESOLVERS.coachingSession.byId, 'function');
    assert.equal(typeof sb.RELATION_RESOLVERS.coachingSession.label, 'function');
    ['wisdomQuote', 'principle', 'goal', 'decision'].forEach(t =>
      assert.equal(typeof sb.RELATION_RESOLVERS[t].byId, 'function', t));
    assert.equal(/RELATION_RESOLVERS\s*=|function relAdd|REL_TYPES\s*=/.test(SRC), false); // no second system
  });
  test('I2. a coachingSession relation goes through relAdd and stores IDs only', () => {
    const sb = createSandbox();
    const r = sb.relAdd({ sourceType: 'coachingSession', sourceId: 'coa_a-1', targetType: 'goal', targetId: 1, relationType: 'related_to' });
    assert.equal(r.ok, true);
    const rec = r.relation;
    assert.deepEqual(Object.keys(rec).sort(),
      ['confidence', 'createdAt', 'id', 'note', 'relationType', 'sourceId', 'sourceType', 'targetId', 'targetType', 'updatedAt']);
    assert.equal(rec.sourceId, 'coa_a-1');
    assert.equal(rec.note, '');
    assert.equal(sb.D.relations.length, 1);
  });
  test('I3. relation validation refuses malformed links', () => {
    const sb = createSandbox();
    const ok = sb.coachingValidateRelation({ sourceType: 'coachingSession', sourceId: 'coa_a-1', targetType: 'goal', targetId: 1 });
    assert.equal(ok.ok, true);
    assert.equal(ok.relation.relationType, 'related_to');
    assert.equal(sb.coachingValidateRelation({ sourceType: 'goal', sourceId: 'coa_a-1', targetType: 'goal', targetId: 1 }).error, 'INVALID_SOURCE_TYPE');
    assert.equal(sb.coachingValidateRelation({ sourceType: 'coachingSession', sourceId: 'x', targetType: 'goal', targetId: 1 }).error, 'INVALID_SOURCE_ID');
    assert.equal(sb.coachingValidateRelation({ sourceType: 'coachingSession', sourceId: 'coa_a-1', targetType: 'todo', targetId: 1 }).error, 'INVALID_TARGET_TYPE');
    assert.equal(sb.coachingValidateRelation({ sourceType: 'coachingSession', sourceId: 'coa_a-1', targetType: 'goal', targetId: '' }).error, 'MISSING_TARGET_ID');
    assert.equal(sb.coachingValidateRelation({ sourceType: 'coachingSession', sourceId: 'coa_a-1', targetType: 'goal', targetId: 1, relationType: 'nope' }).error, 'INVALID_RELATION_TYPE');
    assert.equal(sb.coachingValidateRelation({ sourceType: 'coachingSession', sourceId: 'coa_a-1', targetType: 'goal', targetId: 1, note: 'x'.repeat(400) }).error, 'NOTE_TOO_LONG');
    assert.equal(sb.coachingValidateRelation(null).error, 'INVALID_SOURCE_TYPE');
  });
  test('I4. the resolver label leaks no coachee identity or session content', () => {
    const sb = createSandbox();
    const s = sb.coachingBuildSession({ context: 'child', subjectRef: 'K-01', title: 'gizli baslik' }, FIXED).session;
    const label = sb.coachingRelationLabel(s);
    assert.equal(label, 'Koçluk Oturumu · Çocuk · 2026-08-29');
    assert.equal(label.includes('K-01'), false);
    assert.equal(label.includes('gizli'), false);
    assert.equal(sb.coachingRelationLabel(null), '');
  });
  test('I5. an unresolvable session relation is skipped, never thrown', () => {
    const sb = createSandbox();
    sb.relAdd({ sourceType: 'coachingSession', sourceId: 'coa_a-1', targetType: 'goal', targetId: 1 });
    const fromGoal = sb.getRelatedEntities('goal', 1);
    assert.equal(Array.isArray(fromGoal), true);
    assert.equal(fromGoal.some(x => x.entity && x.entity.type === 'coachingSession'), false);
    assert.equal(sb.relResolve('coachingSession', 'coa_a-1'), null);
  });
});

/* ── J. Backup / restore: explicit exclusion ──────────────────────────────── */
describe('J. Backup decision', () => {
  test('J1. no false registration in DIFF_SCHEMA', () => {
    const sb = createSandbox();
    const fields = sb.DIFF_SCHEMA.arrays.map(a => a.field)
      .concat(sb.DIFF_SCHEMA.objects, sb.DIFF_SCHEMA.scalars);
    assert.equal(fields.some(f => /coachingSession/i.test(f)), false);
    assert.equal(fields.includes('coaching'), true);   // the LEGACY field stays registered
  });
  test('J2. the backup module was not modified for coaching', () => {
    assert.equal(/coachingSession|COACHING_/.test(BACKUP_SRC), false);
  });
  test('J3. the provider states the exclusion explicitly and carries the conditions', () => {
    const sb = createSandbox();
    const p = sb.coachingBackupProvider();
    assert.equal(p.included, false);
    assert.equal(p.count, 0);
    deq(p.records, []);
    assert.equal(p.policy.reason, 'excluded_by_design_use_scoped_export');
    assert.equal(p.policy.channel, 'coachingExport');
    assert.equal(p.policy.includedInStateBackup, false);
    assert.equal(p.policy.includedInLocalJsonExport, false);
    assert.equal(p.policy.registeredInDiffSchema, false);
    assert.equal(p.policy.requiredBeforeInclusion.length, 3);
  });
  test('J4. the plain local JSON export cannot contain coaching sessions', () => {
    const sb = createSandbox();
    // U.dl serializes D only, and coaching sessions are not in D
    assert.equal(/coachingSessions/.test(sb.canonicalStringify(sb.D)), false);
  });
});

/* ── K. Gate document, mirror and static guards ───────────────────────────── */
describe('K. Gate, mirror and static guards', () => {
  test('K1. mirror byte-identity js ↔ public/js', () => {
    assert.equal(SRC, SRC_PUB);
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
  });
  test('K2. module is under the 900-line limit', () => {
    assert.ok(SRC.split('\n').length < 900, String(SRC.split('\n').length));
  });
  test('K3. the module is wired into the page exactly once', () => {
    const hits = INDEX.match(/17-coaching-domain\.js/g) || [];
    assert.equal(hits.length, 1);
    assert.match(INDEX, /<script src="js\/17-coaching-domain\.js\?v=[^"]+"><\/script>/);
  });
  test('K4. loading the module has no top-level side effect beyond the resolver', () => {
    // the only statement outside a declaration/export block is the guarded registration
    assert.match(SRC, /if\(typeof registerRelationResolver==='function'\)\{\s*\n\s*registerRelationResolver\(COACHING_RELATION_TYPE/);
    assert.equal(/^\s*(render|save|initCloud|wdBoot|wexBoot)\s*\(/m.test(SRC), false);
  });
  test('K6. the app shell is not cached, so a deploy is visible immediately', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
    const headers = cfg.hosting.headers || [];
    const shell = headers.filter(h => h.source === '/index.html' || h.source === '/');
    assert.equal(shell.length, 2, 'both / and /index.html must be covered');
    shell.forEach(h => {
      const cc = h.headers.find(x => x.key === 'Cache-Control');
      assert.ok(cc, h.source);
      assert.match(cc.value, /no-store/, h.source);
      assert.match(cc.value, /must-revalidate/, h.source);
    });
    // versioned assets keep their own caching — the fix is scoped to the shell
    assert.equal(headers.some(h => /\.js|\.css|\*\*/.test(h.source)), false);
  });

  test('K5. RELEASE-LIVE-1 exists and documents only real tooling', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs', 'constitution', 'RELEASE-LIVE-1.md'), 'utf8');
    ['node --check', "node --test 'tests/*.test.js'", 'diff -rq js public/js', '900'].forEach(t =>
      assert.ok(doc.includes(t), t));
    // must not claim tooling this repo does not have
    assert.equal(fs.existsSync(path.join(ROOT, 'package.json')), false);
    assert.ok(doc.includes('bunların hiçbiri yoktur'));
    assert.equal(/^\s*(npm|npx|vitest|eslint|tsc)\b/m.test(doc), false);
  });
});

/* ── L. Firestore rules ───────────────────────────────────────────────────── */
describe('L. Firestore rules', () => {
  test('L1. coaching sessions and their child collections are explicitly covered', () => {
    assert.match(RULES, /match \/coachingSessions\/\{sessionId\}/);
    assert.match(RULES, /match \/\{childCollection\}\/\{childDoc\}/);
    const block = RULES.slice(RULES.indexOf('match /coachingSessions/'));
    ['read', 'write', 'delete'].forEach(cap =>
      assert.ok(block.includes("pilCoachingCan(request.auth.uid, userId, '" + cap + "')"), cap));
    assert.equal((block.match(/pilCoachingCan/g) || []).length, 6); // 3 doc + 3 child
  });
  test('L2. the coaching predicate is fail-closed and uses safe key access', () => {
    assert.match(RULES, /function pilCoachingCan\(caller, owner, cap\)/);
    assert.match(RULES, /permissions\.get\('coaching', \{\}\)\.get\(cap, false\) == true/);
    assert.match(RULES, /permissions is map/);
    assert.match(RULES, /caller == owner/);
  });
  test('L3. coaching is never reachable through the generic state capability', () => {
    const block = RULES.slice(RULES.indexOf('match /coachingSessions/'));
    assert.equal(/'state'/.test(block), false);
    assert.equal(/pilCan\(/.test(block), false);
  });
  test('L4. every coaching rule requires authentication', () => {
    const block = RULES.slice(RULES.indexOf('match /coachingSessions/'));
    const allows = block.split('\n').filter(l => /allow /.test(l));
    assert.equal(allows.length, 6);
    allows.forEach(l => assert.match(l, /request\.auth != null/));
  });
  test('L5. no public, unauthenticated or always-true access was introduced', () => {
    assert.equal(/allow[^;]*:\s*if\s+true/.test(RULES), false);
    assert.equal(/allow\s+read,\s*write;\s*$/m.test(RULES), false);
    assert.equal(/request\.auth\s*==\s*null/.test(RULES), false);
  });
  test('L6. pre-existing rules were preserved verbatim', () => {
    ['match /ownershipMap/{loginUid}', 'match /app/state', 'match /app/wisdomMeta',
     'match /app/wisdomMigration', 'match /wisdomQuotes/{doc}', 'match /backups/{doc=**}',
     'match /{document=**}'].forEach(m => assert.ok(RULES.includes(m), m));
    assert.match(RULES, /allow read, write: if request\.auth != null && request\.auth\.uid == userId;/);
  });
});

/* ── M. Self-check contract ───────────────────────────────────────────────── */
describe('M. Self-check', () => {
  test('M1. reports the Phase 1 invariants', () => {
    const sb = createSandbox(); signedIn(sb, 'U1');
    const c = sb.coachingSelfCheck();
    assert.equal(c.schemaVersion, 1);
    assert.equal(c.featureEnabled, false);
    assert.equal(c.safetyGateInstalled, true);   // Phase 2 installs the real gate at load
    assert.equal(c.writable, false);            // ...and the flag being OFF still denies
    assert.equal(c.privacyDefault, 'private');
    assert.equal(c.storeCount, 0);
    assert.equal(c.legacyCount, 1);
    assert.equal(c.inPayload, false);
    assert.equal(c.approaches.length, 10);                 // filled by Phase 4, same registry
    assert.equal(c.backup.includedInStateBackup, false);
  });
  test('M2. self-check is pure', () => {
    const sb = createSandbox(); signedIn(sb, 'U1');
    const before = sb.canonicalStringify(sb.D);
    assert.equal(sb.canonicalStringify(sb.coachingSelfCheck()), sb.canonicalStringify(sb.coachingSelfCheck()));
    assert.equal(sb.canonicalStringify(sb.D), before);
  });
});
