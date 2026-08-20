'use strict';
/* AUTH — LOGOUT & SWITCH-ACCOUNT FLOW (P0). A user-facing way to log out and switch
   Google accounts, with a fully clean logout (no stale PIL/Wisdom cache, listeners, or
   timers) so each account loads only its own data. RED-first. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function makeSandbox(uid, email){
  const sb = createSandbox();
  sb.CLOUD.uid = uid; sb.CLOUD.user = { uid:uid, email:email, isAnonymous:false };
  let signOutCalls = 0;
  sb.CLOUD.auth = { currentUser:{uid:uid, email:email, isAnonymous:false},
    signOut(){ signOutCalls++; this.currentUser = null; return Promise.resolve(); } };
  sb.CLOUD.__signOutCalls = () => signOutCalls;
  return sb;
}
function seedActiveSession(sb){
  sb._wisdomStoreSeed([{id:'q1',quote:'secret',author:'x'}], true);   // WQ_STORE populated + sharded
  sb.CLOUD.personalEntry = {ownerUid:'OWNER', role:'owner'};
  sb.CLOUD.personalOwnerActive = true;
  sb.CLOUD.personalResolveReason = 'resolved';
  sb.CLOUD.unsubDoc = function(){}; sb.CLOUD.listenerUid = sb.CLOUD.uid;    // fake realtime listener
  sb.CLOUD.retryTimer = setTimeout(function(){}, 100000);                  // pending timer
  sb.CLOUD.pendingMutation = {id:'m'};
}

describe('logoutAccount', () => {
  test('signs out and clears ALL runtime caches (PIL, Wisdom, listener, timers)', async () => {
    const sb = makeSandbox('A', 'a@x.com'); seedActiveSession(sb);
    const r = await sb.logoutAccount();
    assert.equal(r.ok, true);
    assert.equal(sb.CLOUD.__signOutCalls(), 1);
    assert.equal(sb.WQ_STORE.size, 0, 'wisdom cache cleared');
    assert.equal(sb.CLOUD.personalEntry, null, 'PIL cache cleared');
    assert.equal(sb.CLOUD.personalOwnerActive, null);
    assert.equal(sb.CLOUD.unsubDoc, null, 'realtime listener disposed');
    assert.equal(sb.CLOUD.retryTimer, null, 'pending timer cleared');
    assert.equal(sb.CLOUD.pendingMutation, null);
  });
  test('fails cleanly when auth is unavailable', async () => {
    const sb = createSandbox(); sb.CLOUD.auth = null;
    const r = await sb.logoutAccount();
    assert.equal(r.ok, false); assert.equal(r.reason, 'no_auth');
  });
});

describe('switchAccount', () => {
  test('logs out then re-starts Google sign-in (account chooser)', async () => {
    const sb = makeSandbox('A', 'a@x.com'); seedActiveSession(sb);
    let connectCalls = 0; sb.connectGoogle = function(){ connectCalls++; return Promise.resolve(); };
    const r = await sb.switchAccount();
    assert.equal(sb.CLOUD.__signOutCalls(), 1, 'logged out first');
    assert.equal(connectCalls, 1, 'sign-in restarted (chooser)');
    assert.equal(sb.WQ_STORE.size, 0);
  });
  test('repeated switching leaves no leaked listener', async () => {
    const sb = makeSandbox('A', 'a@x.com'); sb.connectGoogle = function(){ return Promise.resolve(); };
    sb.CLOUD.unsubDoc = function(){};
    await sb.switchAccount();
    sb.CLOUD.unsubDoc = function(){};              // simulate a listener from the next login
    await sb.switchAccount();
    assert.equal(sb.CLOUD.unsubDoc, null);
  });
});

describe('account isolation on switch (owner ⇄ member)', () => {
  test('owner → (logout) → member: no owner cache survives', async () => {
    const sb = makeSandbox('OWNER', 'owner@x.com');
    sb._wisdomStoreSeed([{id:'own1',quote:'owner-only',author:'x'}], true);
    sb.CLOUD.personalEntry = {ownerUid:'OWNER', role:'owner'};
    await sb.logoutAccount();
    assert.equal(sb.WQ_STORE.size, 0);
    assert.equal(sb.CLOUD.personalEntry, null);
  });
  test('member → (logout) → owner: no member cache survives', async () => {
    const sb = makeSandbox('MEMBER', 'duayft@gmail.com');
    sb._wisdomStoreSeed([{id:'m1',quote:'member-view',author:'x'}], true);
    sb.CLOUD.personalEntry = {ownerUid:'OWNER', role:'editor'};
    await sb.logoutAccount();
    assert.equal(sb.WQ_STORE.size, 0);
    assert.equal(sb.CLOUD.personalEntry, null);
  });
});

describe('signOut path (onAuthStateChanged null) also fully cleans', () => {
  test('handleAuthChange(null) clears PIL + Wisdom + listener + identity', () => {
    const sb = makeSandbox('A', 'a@x.com'); seedActiveSession(sb);
    sb.handleAuthChange(null);
    assert.equal(sb.WQ_STORE.size, 0);
    assert.equal(sb.CLOUD.personalEntry, null);
    assert.equal(sb.CLOUD.unsubDoc, null);
    assert.equal(sb.CLOUD.uid, null);
    assert.equal(sb.CLOUD.user, null);
  });
});

describe('user menu + auth button dispatcher', () => {
  test('menu HTML shows the signed-in email + switch + logout items', () => {
    const sb = makeSandbox('A', 'duayft@gmail.com');
    const html = sb.userMenuHtml();
    assert.ok(html.indexOf('duayft@gmail.com') >= 0, 'shows email');
    assert.ok(/switchAccount\(\)/.test(html), 'has switch action');
    assert.ok(/logoutAccount\(\)/.test(html), 'has logout action');
  });
  test('auth-button click opens menu when signed in, else starts sign-in', () => {
    const sb = makeSandbox('A', 'a@x.com');
    let toggles = 0, connects = 0;
    sb.toggleUserMenu = function(){ toggles++; };
    sb.connectGoogle = function(){ connects++; return Promise.resolve(); };
    sb.onAuthButtonClick();
    assert.equal(toggles, 1); assert.equal(connects, 0);   // signed in → menu
    sb.CLOUD.user = null; sb.CLOUD.uid = null;
    sb.onAuthButtonClick();
    assert.equal(connects, 1);                             // signed out → sign-in
  });
});
