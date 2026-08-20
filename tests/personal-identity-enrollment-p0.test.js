'use strict';
/* PIL — MEMBER ENROLLMENT FLOW (P0). Enrolls a second login as a member of the
   canonical owner. Fail-closed, admin/owner-gated, full audit, no silent overwrite,
   and the member uid must come from a REAL authenticated login (never derived from
   an email). Sharing stays OFF throughout — enrollment writes data only; it does not
   flip the flag or change runtime behavior. RED-first. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function withUser(sb, uid, email){ sb.CLOUD.uid = uid; sb.CLOUD.user = { uid:uid, email:email||null, isAnonymous:false }; }
/* stateful fake db: get reflects prior set/update so read-back verification works. */
function statefulDb(seed){
  const store = Object.assign({}, seed||{});
  const writes = [];
  return { _store:store, _writes:writes, collection(name){ return { doc(id){ const key=name+'/'+id; return {
    get(){ const has = Object.prototype.hasOwnProperty.call(store,key); return Promise.resolve({exists:!!has, data(){ return has?store[key]:undefined; }}); },
    set(d){ store[key] = Object.assign({}, d); writes.push({op:'set',path:key,data:d}); return Promise.resolve(); },
    update(d){ store[key] = Object.assign({}, store[key]||{}, d); writes.push({op:'update',path:key,data:d}); return Promise.resolve(); }
  }; } }; } };
}
const OWNER = 'OWNER1';
function ownerSeed(overrides){ return { ['ownershipMap/'+OWNER]: Object.assign({ownerUid:OWNER, role:'owner', status:'active', organizationId:null}, overrides||{}) }; }

/* ── Capture real login identity (the only source of a member uid) ─────────── */
describe('pilCaptureLoginIdentity', () => {
  test('returns the authenticated uid + email (never derived)', () => {
    const sb = createSandbox(); withUser(sb, 'REAL_UID_123', 'duayft@gmail.com');
    const r = sb.pilCaptureLoginIdentity();
    assert.equal(r.ok, true);
    assert.equal(r.uid, 'REAL_UID_123');
    assert.equal(r.email, 'duayft@gmail.com');
    assert.equal(r.isAnonymous, false);
  });
  test('fails closed when not authenticated', () => {
    const sb = createSandbox(); sb.CLOUD.user = null; sb.CLOUD.uid = null;
    assert.equal(sb.pilCaptureLoginIdentity().ok, false);
  });
});

/* ── Member enrollment orchestration ──────────────────────────────────────── */
describe('pilEnrollMember (happy path)', () => {
  test('enrolls a member of an active owner with role-derived permissions + audit', async () => {
    const sb = createSandbox(); withUser(sb, OWNER, 'owner@x.com');
    sb.CLOUD.db = statefulDb(ownerSeed());
    const r = await sb.pilEnrollMember('DUAYFT_UID', {ownerUid:OWNER, role:'editor'});
    assert.equal(r.ok, true);
    const w = sb.CLOUD.db._writes.find(x => x.path==='ownershipMap/DUAYFT_UID' && x.op==='set');
    assert.ok(w, 'member doc written');
    assert.equal(w.data.ownerUid, OWNER);
    assert.equal(w.data.role, 'editor');
    assert.equal(w.data.status, 'active');
    assert.equal(w.data.permissions.wisdom.write, true);
    assert.equal(w.data.permissions.wisdom.restore, false);          // editor cannot restore
    assert.equal(w.data.createdBy, OWNER);                            // acting owner/admin recorded
    assert.ok(typeof w.data.createdAt === 'number' && typeof w.data.updatedAt === 'number');
  });
  test('ownerUid defaults to the current login (canonical owner)', async () => {
    const sb = createSandbox(); withUser(sb, OWNER, 'owner@x.com');
    sb.CLOUD.db = statefulDb(ownerSeed());
    const r = await sb.pilEnrollMember('MEM2', {role:'viewer'});
    assert.equal(r.ok, true);
    assert.equal(r.ownerUid, OWNER);
  });
});

describe('pilEnrollMember (fail-closed)', () => {
  test('owner has no active self-entry → refused', async () => {
    const sb = createSandbox(); withUser(sb, OWNER);
    sb.CLOUD.db = statefulDb({});                                    // owner NOT enrolled
    const r = await sb.pilEnrollMember('MEM', {ownerUid:OWNER, role:'viewer'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'owner_not_enrolled');
  });
  test('owner entry inactive → refused', async () => {
    const sb = createSandbox(); withUser(sb, OWNER);
    sb.CLOUD.db = statefulDb(ownerSeed({status:'suspended'}));
    const r = await sb.pilEnrollMember('MEM', {ownerUid:OWNER, role:'viewer'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'owner_not_enrolled');
  });
  test('empty/invalid member uid → refused', async () => {
    const sb = createSandbox(); withUser(sb, OWNER); sb.CLOUD.db = statefulDb(ownerSeed());
    assert.equal((await sb.pilEnrollMember('', {role:'viewer'})).reason, 'invalid_member_uid');
    assert.equal((await sb.pilEnrollMember(null, {role:'viewer'})).reason, 'invalid_member_uid');
  });
  test('member uid that looks like an email → refused (never derive uid from email)', async () => {
    const sb = createSandbox(); withUser(sb, OWNER); sb.CLOUD.db = statefulDb(ownerSeed());
    const r = await sb.pilEnrollMember('duayft@gmail.com', {role:'viewer'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'uid_looks_like_email');
  });
  test('member === owner → refused (use owner enrollment)', async () => {
    const sb = createSandbox(); withUser(sb, OWNER); sb.CLOUD.db = statefulDb(ownerSeed());
    const r = await sb.pilEnrollMember(OWNER, {ownerUid:OWNER, role:'owner'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'member_is_owner');
  });
  test('unknown role → refused', async () => {
    const sb = createSandbox(); withUser(sb, OWNER); sb.CLOUD.db = statefulDb(ownerSeed());
    const r = await sb.pilEnrollMember('MEM', {role:'superadmin'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'unknown_role');
  });
  test('no db → refused', async () => {
    const sb = createSandbox(); withUser(sb, OWNER); sb.CLOUD.db = null;
    const r = await sb.pilEnrollMember('MEM', {role:'viewer'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'no_db');
  });
});

describe('pilEnrollMember (no silent overwrite)', () => {
  test('existing entry without allowReenroll → conflict, no write', async () => {
    const sb = createSandbox(); withUser(sb, OWNER);
    sb.CLOUD.db = statefulDb(Object.assign(ownerSeed(), {
      'ownershipMap/MEM': {ownerUid:OWNER, role:'viewer', status:'active'}
    }));
    const before = sb.CLOUD.db._writes.length;
    const r = await sb.pilEnrollMember('MEM', {role:'editor'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'already_enrolled');
    assert.equal(sb.CLOUD.db._writes.length, before);                // no overwrite
  });
  test('existing entry WITH allowReenroll → updates', async () => {
    const sb = createSandbox(); withUser(sb, OWNER);
    sb.CLOUD.db = statefulDb(Object.assign(ownerSeed(), {
      'ownershipMap/MEM': {ownerUid:OWNER, role:'viewer', status:'active'}
    }));
    const r = await sb.pilEnrollMember('MEM', {role:'editor', allowReenroll:true});
    assert.equal(r.ok, true);
    assert.equal(sb.CLOUD.db._store['ownershipMap/MEM'].role, 'editor');
  });
});

describe('pilEnrollMember does not change runtime behavior / flag stays off', () => {
  test('flag remains false and owner context unaffected after enrolling a member', async () => {
    const sb = createSandbox(); withUser(sb, OWNER, 'owner@x.com');
    sb.CLOUD.db = statefulDb(ownerSeed());
    assert.equal(sb.IDENTITY.sharingEnabled, false);
    await sb.pilEnrollMember('DUAYFT_UID', {role:'editor'});
    assert.equal(sb.IDENTITY.sharingEnabled, false);                 // enrollment never flips the flag
    const c = sb.personalContext();                                  // owner, flag off → self, unchanged
    assert.equal(c.isOwner, true);
    assert.equal(sb.personalOwnerUid(), OWNER);
  });
});
