'use strict';
/* PERSONAL IDENTITY LAYER (PIL) V3 (hardened) — P0 tests.
   Guarantees: module-scoped permissions, organization-ready resolution chain,
   master feature flag (default OFF = byte-identical legacy), FAIL-CLOSED
   ownership, dynamic data-driven registry, complete audit trail, and a
   data-only production enrollment flow. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function withUser(sb, uid, email){
  sb.CLOUD.uid = uid;
  sb.CLOUD.user = { uid: uid, email: email || null, isAnonymous:false };
}
function memberEntry(overrides){
  return Object.assign({
    ownerUid:'OWNER1', ownerEmail:'owner@x.com', organizationId:null, role:'editor', status:'active',
    permissions:{ wisdom:{read:true,write:true,delete:false,import:true,restore:false,backup:false},
                  goals:{read:true,write:false,delete:false} }
  }, overrides||{});
}
/* fake db: getMap resolves reads; captures set/update writes for assertions. */
function fakeDb(getMap){
  const writes = [];
  const db = { _writes:writes, collection(name){ return { doc(id){ const key=name+'/'+id; return {
    get(){ const has = getMap && Object.prototype.hasOwnProperty.call(getMap,key);
           return Promise.resolve({ exists:!!has, data(){ return has?getMap[key]:undefined; } }); },
    set(d){ writes.push({op:'set',path:key,data:d}); return Promise.resolve(); },
    update(d){ writes.push({op:'update',path:key,data:d}); return Promise.resolve(); }
  }; } }; } };
  return db;
}

/* ── Flag OFF (default): byte-identical legacy self-ownership ──────────────── */
describe('Flag OFF (default): legacy self-context', () => {
  test('default flag is false', () => {
    assert.equal(createSandbox().IDENTITY.sharingEnabled, false);
  });
  test('personalOwnerUid() === CLOUD.uid; full rights; entry ignored', () => {
    const sb = createSandbox(); withUser(sb, 'LOGIN_A', 'a@x.com');
    sb.CLOUD.personalEntry = memberEntry();           // present but ignored while off
    assert.equal(sb.personalOwnerUid(), 'LOGIN_A');
    assert.equal(sb.personalContext().isOwner, true);
    assert.equal(sb.personalCan('wisdom','delete'), true);
    assert.equal(sb.personalWriteMeta('create'), null);
  });
  test('pilResolveOnAuth performs NO registry fetch when off', async () => {
    const sb = createSandbox(); withUser(sb, 'LOGIN_A');
    let fetched = false;
    sb.CLOUD.db = { collection(){ fetched = true; return { doc(){ return { get(){ return Promise.resolve({exists:false}); } }; } }; } };
    assert.equal(await sb.pilResolveOnAuth(sb.CLOUD.user), null);
    assert.equal(fetched, false);
  });
  test('path builders resolve to CLOUD.uid when off', () => {
    const sb = createSandbox(); withUser(sb, 'LOGIN_A');
    const seen = [];
    sb.CLOUD.db = { collection(){ return { doc(id){ seen.push(id); return { collection(){ return { doc(){ return {}; } }; } }; } }; } };
    sb.wisdomStoreCol(); sb.stateRef();
    assert.ok(seen.includes('LOGIN_A') && !seen.includes('OWNER1'));
  });
});

/* ── FAIL-CLOSED ownership (flag ON) ──────────────────────────────────────── */
describe('Fail-closed ownership (flag ON)', () => {
  function on(sb){ sb.IDENTITY.sharingEnabled = true; }
  test('not enrolled (no entry) → DENIED, owner null, no self fallback', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_A', 'a@x.com');
    sb.CLOUD.personalEntry = null;
    const c = sb.personalContext();
    assert.equal(c.denied, true);
    assert.equal(c.deniedReason, 'not_enrolled');
    assert.equal(sb.personalOwnerUid(), null);          // NOT LOGIN_A
    assert.equal(sb.personalCan('wisdom','read'), false);
  });
  test('revoked/suspended member → DENIED', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry({status:'revoked'});
    assert.equal(sb.personalContext().denied, true);
    assert.equal(sb.personalOwnerUid(), null);
  });
  test('corrupted permissions → DENIED', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry({permissions:'not-an-object'});
    assert.equal(sb.personalContext().deniedReason, 'corrupt_permissions');
  });
  test('inactive owner → DENIED (owner-active flag false)', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry();
    sb.CLOUD.personalOwnerActive = false;
    assert.equal(sb.personalContext().deniedReason, 'owner_inactive');
    assert.equal(sb.personalOwnerUid(), null);
  });
  test('no ownerUid in entry → DENIED', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry({ownerUid:null});
    assert.equal(sb.personalContext().deniedReason, 'no_owner');
  });
  test('denied write meta is null (nothing to attribute)', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = null;
    assert.equal(sb.personalWriteMeta('create'), null);
  });
});

/* ── Resolution chain: valid member / owner (flag ON) ─────────────────────── */
describe('Resolution chain (flag ON)', () => {
  function on(sb){ sb.IDENTITY.sharingEnabled = true; }
  test('active member resolves to canonical owner', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B', 'b@x.com');
    sb.CLOUD.personalEntry = memberEntry();
    const c = sb.personalContext();
    assert.equal(c.ownerUid, 'OWNER1');
    assert.equal(c.isMember, true);
    assert.equal(sb.personalOwnerUid(), 'OWNER1');
  });
  test('organizationId surfaced (org layer additive, not a redesign)', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry({organizationId:'ORG-42'});
    assert.equal(sb.personalContext().organizationId, 'ORG-42');
  });
  test('self-owner (login===owner) keeps full rights', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'OWNER1', 'owner@x.com');
    sb.CLOUD.personalEntry = memberEntry({ownerUid:'OWNER1', role:'owner', permissions:null});
    assert.equal(sb.personalContext().isOwner, true);
    assert.equal(sb.personalCan('goals','delete'), true);
  });
  test('path builders resolve to OWNER for a member', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry();
    const seen = [];
    sb.CLOUD.db = { collection(){ return { doc(id){ seen.push(id); return { collection(){ return { doc(){ return {}; } }; } }; } }; } };
    sb.wisdomStoreCol(); sb.stateRef();
    assert.ok(seen.includes('OWNER1') && !seen.includes('LOGIN_B'));
  });
});

/* ── Module-scoped permissions ────────────────────────────────────────────── */
describe('Module-scoped permissions', () => {
  function on(sb){ sb.IDENTITY.sharingEnabled = true; }
  test('capability evaluated per module', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry();
    assert.equal(sb.personalCan('wisdom','write'), true);
    assert.equal(sb.personalCan('wisdom','delete'), false);
    assert.equal(sb.personalCan('goals','write'), false);
    assert.equal(sb.personalCan('notes','write'), false);   // module absent → deny
    assert.equal(sb.personalCan('wisdom','frobnicate'), false);
  });
  test('role presets: viewer read-only, editor writes but cannot restore', () => {
    const sb = createSandbox();
    const v = sb.pilPermissionsFromRole('viewer', ['wisdom']);
    assert.equal(v.wisdom.read, true); assert.equal(v.wisdom.write, false);
    const e = sb.pilPermissionsFromRole('editor', ['wisdom','goals']);
    assert.equal(e.wisdom.write, true); assert.equal(e.wisdom.restore, false); assert.equal(e.goals.write, true);
  });
  test('wisdomDualSet is FORBIDDEN without wisdom.write (no write attempted)', async () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry({ permissions:{ wisdom:{read:true,write:false,delete:false} } });
    sb._wisdomStoreSeed([{id:'q1',quote:'x',author:'y'}], true);
    let wrote = false;
    sb.CLOUD.db = { collection(){ return { doc(){ return { set(){ wrote = true; return Promise.resolve(); } }; } }; } };
    const r = await sb.wisdomDualSet({id:'q2',quote:'z',author:'w'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'forbidden'); assert.equal(wrote, false);
  });
});

/* ── Audit stamps for shared member writes ────────────────────────────────── */
describe('Audit stamps (shared member writes)', () => {
  function on(sb){ sb.IDENTITY.sharingEnabled = true; }
  test('create → createdBy/updatedBy + timestamps', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B', 'b@x.com');
    sb.CLOUD.personalEntry = memberEntry();
    const m = sb.personalWriteMeta('create');
    assert.equal(m.createdBy, 'LOGIN_B'); assert.equal(m.createdByEmail, 'b@x.com');
    assert.equal(m.updatedBy, 'LOGIN_B'); assert.ok(typeof m.createdAt === 'number');
  });
  test('delete → deletedBy/deletedAt', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B', 'b@x.com');
    sb.CLOUD.personalEntry = memberEntry();
    const m = sb.personalWriteMeta('delete');
    assert.equal(m.deletedBy, 'LOGIN_B'); assert.ok(typeof m.deletedAt === 'number');
  });
  test('owner on own data → no cross-identity stamp (null)', () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'OWNER1', 'owner@x.com');
    sb.CLOUD.personalEntry = memberEntry({ownerUid:'OWNER1', permissions:null});
    assert.equal(sb.personalWriteMeta('create'), null);
  });
});

/* ── Registry resolve-on-auth (flag ON) + login-audit stamp ───────────────── */
describe('pilResolveOnAuth (flag ON)', () => {
  function on(sb){ sb.IDENTITY.sharingEnabled = true; }
  test('member: fetches entry + owner entry, caches, resolves to owner', async () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B', 'b@x.com');
    sb.CLOUD.db = fakeDb({
      'ownershipMap/LOGIN_B': memberEntry(),
      'ownershipMap/OWNER1': {ownerUid:'OWNER1', role:'owner', status:'active'}
    });
    const e = await sb.pilResolveOnAuth(sb.CLOUD.user);
    assert.equal(e.ownerUid, 'OWNER1');
    assert.equal(sb.CLOUD.personalOwnerActive, true);
    assert.equal(sb.personalOwnerUid(), 'OWNER1');
  });
  test('inactive owner entry → owner-active false → context denied', async () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_B');
    sb.CLOUD.db = fakeDb({
      'ownershipMap/LOGIN_B': memberEntry(),
      'ownershipMap/OWNER1': {ownerUid:'OWNER1', role:'owner', status:'suspended'}
    });
    await sb.pilResolveOnAuth(sb.CLOUD.user);
    assert.equal(sb.CLOUD.personalOwnerActive, false);
    assert.equal(sb.personalContext().deniedReason, 'owner_inactive');
  });
  test('absent mapping → null; context denied (not self)', async () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_C', 'c@x.com');
    sb.CLOUD.db = fakeDb({});
    assert.equal(await sb.pilResolveOnAuth(sb.CLOUD.user), null);
    assert.equal(sb.personalContext().denied, true);
    assert.equal(sb.personalOwnerUid(), null);
  });
  test('read error → fail-closed (denied)', async () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'LOGIN_D', 'd@x.com');
    sb.CLOUD.db = { collection(){ return { doc(){ return { get(){ return Promise.reject(new Error('denied')); } }; } }; } };
    assert.equal(await sb.pilResolveOnAuth(sb.CLOUD.user), null);
    assert.equal(sb.personalContext().denied, true);
    assert.equal(sb.CLOUD.personalResolveReason, 'read_error');
  });
  test('stamps lastLoginAt + lastOwnerResolutionAt on own doc', async () => {
    const sb = createSandbox(); on(sb); withUser(sb, 'OWNER1', 'owner@x.com');
    sb.CLOUD.db = fakeDb({ 'ownershipMap/OWNER1': {ownerUid:'OWNER1', role:'owner', status:'active'} });
    await sb.pilResolveOnAuth(sb.CLOUD.user);
    const stamp = sb.CLOUD.db._writes.find(w => w.op==='update' && w.path==='ownershipMap/OWNER1');
    assert.ok(stamp, 'resolution stamp written');
    assert.deepEqual(Object.keys(stamp.data).sort(), ['lastLoginAt','lastOwnerResolutionAt']);
  });
});

/* ── Production enrollment (data-only, complete audit) ─────────────────────── */
describe('Production enrollment', () => {
  test('pilBuildEnrollment carries full audit + derived permissions', () => {
    const sb = createSandbox(); withUser(sb, 'ADMIN1');
    const doc = sb.pilBuildEnrollment({loginUid:'NEW', ownerUid:'OWNER1', organizationId:'ORG-1', role:'editor'});
    assert.equal(doc.ownerUid, 'OWNER1');
    assert.equal(doc.organizationId, 'ORG-1');
    assert.equal(doc.status, 'active');
    assert.equal(doc.permissions.wisdom.write, true);
    assert.equal(doc.createdBy, 'ADMIN1'); assert.equal(doc.updatedBy, 'ADMIN1');
    assert.ok(typeof doc.createdAt === 'number' && typeof doc.updatedAt === 'number');
  });
  test('owner enrollment → self owner, permissions null', () => {
    const sb = createSandbox(); withUser(sb, 'OWNER1');
    const doc = sb.pilBuildEnrollment({loginUid:'OWNER1', ownerUid:'OWNER1', role:'owner'});
    assert.equal(doc.permissions, null);
    assert.equal(doc.role, 'owner');
  });
  test('pilEnroll writes ownershipMap doc (data-only, no UID in code)', async () => {
    const sb = createSandbox(); withUser(sb, 'ADMIN1');
    sb.CLOUD.db = fakeDb({});
    const r = await sb.pilEnroll('NEWLOGIN', {ownerUid:'OWNER1', role:'viewer'});
    assert.equal(r.ok, true);
    const w = sb.CLOUD.db._writes.find(x => x.path==='ownershipMap/NEWLOGIN' && x.op==='set');
    assert.ok(w); assert.equal(w.data.ownerUid, 'OWNER1'); assert.equal(w.data.permissions.wisdom.read, true);
  });
  test('pilEnroll refuses without ownerUid', async () => {
    const sb = createSandbox(); withUser(sb, 'ADMIN1'); sb.CLOUD.db = fakeDb({});
    const r = await sb.pilEnroll('NEWLOGIN', {role:'viewer'});
    assert.equal(r.ok, false); assert.equal(r.reason, 'no_owner');
  });
  test('pilRevoke soft-revokes with deletedBy/deletedAt (immediate access loss)', async () => {
    const sb = createSandbox(); withUser(sb, 'ADMIN1');
    sb.CLOUD.db = fakeDb({});
    const r = await sb.pilRevoke('MEMBERX');
    assert.equal(r.ok, true);
    const w = sb.CLOUD.db._writes.find(x => x.path==='ownershipMap/MEMBERX' && x.op==='update');
    assert.equal(w.data.status, 'revoked');
    assert.equal(w.data.deletedBy, 'ADMIN1'); assert.ok(typeof w.data.deletedAt === 'number');
    // and a revoked entry is denied by the engine
    withUser(sb, 'MEMBERX'); sb.IDENTITY.sharingEnabled = true;
    sb.CLOUD.personalEntry = memberEntry({status:'revoked'});
    assert.equal(sb.personalContext().denied, true);
  });
});

/* ── Instant rollback (flip flag back to false) ───────────────────────────── */
describe('Instant rollback', () => {
  test('ON→member owner, then OFF→login owner, full rights, no migration', () => {
    const sb = createSandbox(); withUser(sb, 'LOGIN_B');
    sb.CLOUD.personalEntry = memberEntry();
    sb.IDENTITY.sharingEnabled = true;
    assert.equal(sb.personalOwnerUid(), 'OWNER1');
    sb.IDENTITY.sharingEnabled = false;
    assert.equal(sb.personalOwnerUid(), 'LOGIN_B');
    assert.equal(sb.personalCan('wisdom','delete'), true);
  });
});
