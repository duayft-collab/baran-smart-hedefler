'use strict';
/* COACHING MASTERY OS — B3: privacy-safe coaching export / restore.
   Guarantees: coaching material never joins the legacy plaintext D backup,
   export is scoped and only happens when the owner asks, a full export is
   refused unless it is encrypted, restore validates without persisting, and
   deletion never runs on its own. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC26 = fs.readFileSync(path.join(ROOT, 'js', '26-coaching-archive.js'), 'utf8');
function deq(a, e, m) { assert.deepEqual(JSON.parse(JSON.stringify(a)), e, m); }
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
/* Executable code only: comments AND string literals removed, so a note that
   merely NAMES the chokepoint is not mistaken for a call to it. */
function exec(src) { return code(src).replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"/g, "''"); }

function owner(sb) {
  sb.CLOUD.uid = 'OWNER1';
  sb.CLOUD.user = { uid: 'OWNER1', email: 'o@x.com', isAnonymous: false };
  return sb;
}
function session(sb) {
  return sb.coachingBuildSession({
    context: 'child', title: 'Okul kaygısı görüşmesi', subjectRef: 'K-01',
    tags: ['okul'], competencyTags: ['listening'], counters: { notes: 3, reflections: 2 },
    safeguard: { guardianConsent: { state: 'granted', by: 'veli', at: '2026-08-29T09:00:00.000Z' } }
  }, { now: '2026-08-29T09:00:00.000Z', id: 'coa_b3-1', ownerUid: 'OWNER1' }).session;
}
const PASS = 'dogru-parola-1234';

describe('B3-1. Policy: coaching never joins the legacy backup', () => {
  test('1. the legacy D paths stay closed for ever', () => {
    const sb = createSandbox();
    const p = sb.coachingExportPolicy();
    assert.equal(p.includedInLegacyStateBackup, false);
    assert.equal(p.includedInLocalJsonExport, false);
    assert.equal(p.registeredInDiffSchema, false);
    assert.equal(p.automaticExport, false);
    assert.equal(p.requiresExplicitUserAction, true);
    assert.equal(sb.COACHING_BACKUP_POLICY.includedInStateBackup, false);
    assert.equal(sb.COACHING_BACKUP_POLICY.includedInLocalJsonExport, false);
    assert.equal(sb.COACHING_BACKUP_POLICY.channel, 'coachingExport');
    const fields = sb.DIFF_SCHEMA.arrays.map(a => a.field).concat(sb.DIFF_SCHEMA.objects, sb.DIFF_SCHEMA.scalars);
    assert.equal(fields.some(f => /coachingSession|coachingExport/i.test(f)), false);
    assert.equal(/coachingSession|coachingExport|COACHING_EXPORT/.test(fs.readFileSync(path.join(ROOT, 'js', '04-backup.js'), 'utf8')), false);
  });
  test('2. scopes, default and the encryption requirement are declared', () => {
    const sb = createSandbox();
    deq(sb.COACHING_EXPORT_SCOPES, ['metadata_only', 'deidentified_derived', 'full_owner_export']);
    assert.equal(sb.COACHING_EXPORT_DEFAULT_SCOPE, 'metadata_only');
    deq(sb.COACHING_ENCRYPTION_REQUIRED_SCOPES, ['full_owner_export']);
    assert.equal(sb.coachingExportPolicy().transcriptsIncluded, false);
    assert.equal(sb.coachingExportPolicy().restorePersists, false);
  });
  test('3. an unknown scope falls back to the safest one', () => {
    const sb = createSandbox();
    assert.equal(sb.coachingExportPlan('everything', { explicitConsent: true }).scope, 'metadata_only');
    assert.equal(sb.coachingExportPlan().scope, 'metadata_only');
  });
});

describe('B3-2. Redaction', () => {
  test('4. metadata_only carries nothing personal', () => {
    const sb = createSandbox();
    const r = sb.coachingRedactSession(session(sb), 'metadata_only');
    const j = JSON.stringify(r);
    ['K-01', 'Okul kaygısı', 'coa_b3-1', 'okul', '2026-08-29T'].forEach(x =>
      assert.equal(j.indexOf(x), -1, x));
    assert.equal(r.period, '2026-08');
    assert.equal(r.context, 'child');
    assert.equal(r.counters.notes, 3);
    assert.equal(r.id, undefined);
    assert.equal(r.title, undefined);
    assert.equal(r.subjectRef, undefined);
  });
  test('5. deidentified_derived reuses the Phase 2 derivation', () => {
    const sb = createSandbox();
    const r = sb.coachingRedactSession(session(sb), 'deidentified_derived');
    assert.equal(r.kind, 'derived_observation');
    assert.equal(r.minorContext, true);
    assert.equal(JSON.stringify(r).indexOf('K-01'), -1);
    assert.equal(r.id, undefined);
  });
  test('6. full_owner_export keeps what the owner already holds', () => {
    const sb = createSandbox();
    const r = sb.coachingRedactSession(session(sb), 'full_owner_export');
    assert.equal(r.id, 'coa_b3-1');
    assert.equal(r.subjectRef, 'K-01');
    assert.equal(r.title, 'Okul kaygısı görüşmesi');
    assert.equal(r.safeguard.guardianConsent.state, 'granted');
  });
  test('7. redaction never mutates the source session', () => {
    const sb = createSandbox();
    const s = session(sb);
    const before = sb.canonicalStringify(s);
    ['metadata_only', 'deidentified_derived', 'full_owner_export'].forEach(sc => sb.coachingRedactSession(s, sc));
    assert.equal(sb.canonicalStringify(s), before);
  });
});

describe('B3-3. Export gating', () => {
  test('8. nothing exports without an explicit user action', async () => {
    const sb = owner(createSandbox());
    const r = await sb.coachingBuildExport([session(sb)], { scope: 'metadata_only' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'explicit_user_action_required');
  });
  test('9. a full export is REFUSED without encryption', async () => {
    const sb = owner(createSandbox());
    const r = await sb.coachingBuildExport([session(sb)], { scope: 'full_owner_export', explicitConsent: true });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'passphrase_required_for_this_scope');
    assert.equal(sb.coachingExportPlan('full_owner_export', { explicitConsent: true }).blocked,
      'passphrase_required_for_this_scope');
  });
  test('10. export requires the owner and the backup capability', async () => {
    const sb = createSandbox();                       // not signed in
    const r = await sb.coachingBuildExport([], { scope: 'metadata_only', explicitConsent: true });
    assert.equal(r.ok, false);
    assert.ok(['owner_unresolved', 'not_authorized'].indexOf(r.error) >= 0, r.error);
    const sb2 = createSandbox();
    sb2.IDENTITY.sharingEnabled = true;
    sb2.CLOUD.uid = 'MEMBER1'; sb2.CLOUD.user = { uid: 'MEMBER1', email: 'm@x.com', isAnonymous: false };
    sb2.CLOUD.personalEntry = { ownerUid: 'OWNER1', status: 'active', role: 'editor',
      permissions: { state: { read: true, write: true } } };
    sb2.CLOUD.personalOwnerActive = true;
    const r2 = await sb2.coachingBuildExport([], { scope: 'metadata_only', explicitConsent: true });
    assert.equal(r2.ok, false);
    assert.equal(r2.error, 'not_authorized');
  });
});

describe('B3-4. Encryption and round-trip', () => {
  test('11. a full export is encrypted and leaks nothing in the envelope', async () => {
    const sb = owner(createSandbox());
    const r = await sb.coachingBuildExport([session(sb)], {
      scope: 'full_owner_export', explicitConsent: true, passphrase: PASS, now: '2026-08-29T10:00:00.000Z' });
    assert.equal(r.ok, true, r.error);
    const e = r.envelope;
    assert.equal(e.encrypted, true);
    assert.equal(e.encryption.alg, 'AES-GCM-256');
    assert.equal(e.encryption.kdf, 'PBKDF2-SHA256');
    assert.ok(e.encryption.iterations >= 100000);
    assert.ok(e.encryption.salt && e.encryption.iv && e.ciphertext);
    assert.equal(e.data, null);
    const j = JSON.stringify(e);
    ['K-01', 'Okul kaygısı', PASS].forEach(x => assert.equal(j.indexOf(x), -1, x));
    assert.equal(e.recordCount, 1);
    assert.ok(e.payloadSha256 && e.payloadSha256.length === 64);
  });
  test('12. the same content encrypts differently every time (fresh salt and iv)', async () => {
    const sb = owner(createSandbox());
    const opts = { scope: 'full_owner_export', explicitConsent: true, passphrase: PASS, now: '2026-08-29T10:00:00.000Z' };
    const a = await sb.coachingBuildExport([session(sb)], opts);
    const b = await sb.coachingBuildExport([session(sb)], opts);
    assert.notEqual(a.envelope.ciphertext, b.envelope.ciphertext);
    assert.notEqual(a.envelope.encryption.salt, b.envelope.encryption.salt);
    assert.equal(a.envelope.payloadSha256, b.envelope.payloadSha256);   // same content
  });
  test('13. round-trip with the right passphrase returns the records', async () => {
    const sb = owner(createSandbox());
    const built = await sb.coachingBuildExport([session(sb)], {
      scope: 'full_owner_export', explicitConsent: true, passphrase: PASS });
    const opened = await sb.coachingOpenExport(built.envelope, { passphrase: PASS });
    assert.equal(opened.ok, true, opened.error);
    assert.equal(opened.count, 1);
    assert.equal(opened.records[0].subjectRef, 'K-01');
    assert.equal(opened.scope, 'full_owner_export');
  });
  test('14. a wrong or missing passphrase fails closed', async () => {
    const sb = owner(createSandbox());
    const built = await sb.coachingBuildExport([session(sb)], {
      scope: 'full_owner_export', explicitConsent: true, passphrase: PASS });
    assert.equal((await sb.coachingOpenExport(built.envelope, {})).error, 'passphrase_required');
    assert.equal((await sb.coachingOpenExport(built.envelope, { passphrase: 'yanlis' })).error, 'decrypt_failed');
  });
  test('15. tampering is detected', async () => {
    const sb = owner(createSandbox());
    const built = await sb.coachingBuildExport([session(sb)], { scope: 'metadata_only', explicitConsent: true });
    assert.equal(built.envelope.encrypted, false);          // nothing personal in this scope
    const tampered = JSON.parse(JSON.stringify(built.envelope));
    tampered.data.records[0].counters.notes = 999;
    assert.equal((await sb.coachingOpenExport(tampered, {})).error, 'checksum_mismatch');
    const foreign = JSON.parse(JSON.stringify(built.envelope));
    foreign.ownerUid = 'OWNER2';
    assert.equal((await sb.coachingOpenExport(foreign, {})).error, 'owner_mismatch');
    assert.equal((await sb.coachingOpenExport({ format: 'nope' }, {})).error, 'unknown_format');
    assert.equal((await sb.coachingOpenExport(null, {})).error, 'invalid_envelope');
  });
});

describe('B3-5. Restore validates but never persists', () => {
  test('16. opening an export writes nothing anywhere', async () => {
    const sb = owner(createSandbox());
    const before = sb.canonicalStringify(sb.D);
    const built = await sb.coachingBuildExport([session(sb)], { scope: 'metadata_only', explicitConsent: true });
    const opened = await sb.coachingOpenExport(built.envelope, {});
    assert.equal(opened.ok, true);
    assert.equal(opened.persisted, false);
    assert.match(opened.note, /Faz 5/);
    assert.equal(sb.coachingStoreCount(), 0);
    assert.equal(sb.canonicalStringify(sb.D), before);
    assert.equal(sb.D.coachingSessions, undefined);
  });
  test('17. writing still has to pass the Phase 1 chokepoint', () => {
    const sb = owner(createSandbox());
    assert.equal(sb.coachingAssertWritable('write').allowed, false);
    assert.equal(sb.coachingAssertWritable('write').reason, 'feature_disabled');
    assert.equal(/coachingAssertWritable\(|coachingSessionsCol\(|\w\.set\(|\.doc\(|\.collection\(/.test(exec(SRC26)), false);
  });
});

describe('B3-6. Audit and deletion lifecycle', () => {
  test('18. the audit record carries shape, never content', async () => {
    const sb = owner(createSandbox());
    const built = await sb.coachingBuildExport([session(sb)], {
      scope: 'full_owner_export', explicitConsent: true, passphrase: PASS, now: '2026-08-29T10:00:00.000Z' });
    const a = built.audit;
    assert.equal(a.event, 'coaching_export');
    assert.equal(a.scope, 'full_owner_export');
    assert.equal(a.recordCount, 1);
    assert.equal(a.encrypted, true);
    assert.equal(a.explicitConsent, true);
    assert.equal(a.requestedBy, 'OWNER1');
    ['K-01', 'Okul kaygısı', PASS].forEach(x => assert.equal(JSON.stringify(a).indexOf(x), -1, x));
  });
  test('19. deletion is never automatic and follows a stated retention', () => {
    const sb = createSandbox();
    const s = session(sb);
    const fresh = sb.coachingDeletionPlan(s, '2026-08-30T00:00:00.000Z');
    assert.equal(fresh.archived, false);
    assert.equal(fresh.purgeEligible, false);
    assert.equal(fresh.requiresOwnerConfirmation, true);
    assert.equal(fresh.requiresCapability, 'delete');
    const archived = Object.assign({}, s, { lifecycle: 'archived', updatedAt: '2024-01-01T00:00:00.000Z' });
    const old = sb.coachingDeletionPlan(archived, '2026-08-30T00:00:00.000Z');
    assert.equal(old.archived, true);
    assert.equal(old.purgeEligible, true);
    assert.ok(old.ageDays > 365);
    deq(old.childCollectionsPurgedFirst, ['notes', 'interventions', 'reflections', 'observations', 'commitments', 'transcript', 'attachments']);
    assert.equal(sb.COACHING_PURGE_AFTER_DAYS, 365);
  });
});

describe('B3-7. Static guards', () => {
  test('20. the module performs no network, AI, storage or DOM work', () => {
    const c = code(SRC26);
    [[/fetch\s*\(/, 'fetch'], [/XMLHttpRequest|WebSocket|EventSource/, 'socket'], [/localStorage/, 'storage'],
     [/setTimeout|setInterval/, 'timer'], [/openai|anthropic|gemini|apiKey/i, 'ai'],
     [/\bD\.\w+\s*=[^=]/, 'payload write'], [/INIT\.\w/, 'payload field'], [/document\.|innerHTML/, 'dom'],
     [/console\./, 'logging']
    ].forEach(([re, name]) => assert.equal(re.test(c), false, name));
  });
  test('21. the passphrase is never stored on the envelope or the audit', async () => {
    const sb = owner(createSandbox());
    const built = await sb.coachingBuildExport([session(sb)], {
      scope: 'full_owner_export', explicitConsent: true, passphrase: PASS });
    assert.equal(JSON.stringify(built).indexOf(PASS), -1);
    assert.equal(/passphrase\s*:\s*(envelope|rec|out)/.test(code(SRC26)), false);
  });
  test('22. mirror byte-identical and under the size limit', () => {
    assert.equal(SRC26, fs.readFileSync(path.join(ROOT, 'public', 'js', '26-coaching-archive.js'), 'utf8'));
    assert.ok(SRC26.split('\n').length < 900);
  });
});
