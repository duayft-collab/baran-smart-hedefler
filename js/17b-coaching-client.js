/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — NEW-1: A NON-PERSISTENT CLIENT FOR COACHING
   The rest of FocusUp runs on one Firestore instance with
   enablePersistence({synchronizeTabs:true}). That is right for goals, wisdom
   and app state: it makes the app usable on a bad connection. It is wrong for
   coaching, because it writes a plaintext copy of everything read or written
   into the browser's IndexedDB — and coaching notes are other people's words
   held in trust.

   So coaching gets its own Firestore client on the SAME Firebase project,
   with the SAME auth user, hitting the SAME paths under the SAME rules — but
   with NO local persistence. Nothing coaching-related is cached to disk.

   ── ONLINE-FIRST, ON PURPOSE ──
   Without a local cache a write only settles when the server answers, which is
   exactly the property we want: "Kayıtlı" can then mean what it says. Offline
   the write simply does not complete, the coach is told so, and the text stays
   on screen. There is no queue, no shadow database and no sync engine.

   ── FAIL CLOSED ──
   If this client cannot be built or its user cannot be attached, coaching gets
   NO storage handle at all. It never falls back to the persistent instance,
   because that fallback is the very thing this module exists to prevent.
   ══════════════════════════════════════════════════════════════════════════ */

var COACHING_CLIENT_NAME = 'coaching';
var COACHING_CLIENT = { app:null, db:null, ready:false, authedUid:null, error:null, persistent:false };

function _ccFirebase(){ return (typeof firebase!=='undefined' && firebase) ? firebase : null; }

/* Synchronous half: create the secondary app and its Firestore handle.
   enablePersistence() is deliberately NEVER called on it. */
function coachingClientInit(){
  if(COACHING_CLIENT.db) return COACHING_CLIENT;
  var fb = _ccFirebase();
  if(!fb || !fb.apps || !fb.apps.length){ COACHING_CLIENT.error = 'no_firebase'; return COACHING_CLIENT; }
  try{
    var primary = fb.app();
    var existing = null;
    for(var i=0;i<fb.apps.length;i++){ if(fb.apps[i].name===COACHING_CLIENT_NAME) existing = fb.apps[i]; }
    COACHING_CLIENT.app = existing || fb.initializeApp(primary.options, COACHING_CLIENT_NAME);
    COACHING_CLIENT.db = fb.firestore(COACHING_CLIENT.app);
    COACHING_CLIENT.persistent = false;
    COACHING_CLIENT.error = null;
  }catch(e){ COACHING_CLIENT.app = null; COACHING_CLIENT.db = null; COACHING_CLIENT.error = 'init_failed'; }
  return COACHING_CLIENT;
}

/* Asynchronous half: carry the already–signed-in user across to this client so
   the same Firestore Rules apply. No credential is handled here; the SDK moves
   the existing session. */
async function coachingClientEnsure(){
  var c = coachingClientInit();
  if(!c.db) return c;
  var fb = _ccFirebase();
  var user = null;
  try{ user = fb.auth().currentUser || null; }catch(e){ user = null; }
  if(!user){ c.ready = false; c.authedUid = null; c.error = 'not_authenticated'; return c; }
  if(c.ready && c.authedUid===user.uid) return c;
  try{
    var a = fb.auth(c.app);
    if(!a.currentUser || a.currentUser.uid!==user.uid) await a.updateCurrentUser(user);
    c.ready = !!(a.currentUser && a.currentUser.uid===user.uid);
    c.authedUid = c.ready ? user.uid : null;
    c.error = c.ready ? null : 'auth_sync_failed';
  }catch(e){ c.ready = false; c.authedUid = null; c.error = 'auth_sync_failed'; }
  return c;
}

/* The ONLY storage handle coaching is allowed to use. Never CLOUD.db. */
function coachingDb(){
  var c = COACHING_CLIENT;
  if(c.db && c.ready) return c.db;
  return null;
}
/* Test/verification seam: lets an offline probe drive the real client. */
function coachingClientState(){
  return { hasApp:!!COACHING_CLIENT.app, hasDb:!!COACHING_CLIENT.db, ready:COACHING_CLIENT.ready,
    persistent:COACHING_CLIENT.persistent, authedUid:COACHING_CLIENT.authedUid?'set':null,
    error:COACHING_CLIENT.error, name:COACHING_CLIENT_NAME };
}
function coachingClientReset(){
  COACHING_CLIENT.ready = false; COACHING_CLIENT.authedUid = null; COACHING_CLIENT.error = null;
}

if(typeof window!=='undefined'){
  window.COACHING_CLIENT_NAME=COACHING_CLIENT_NAME; window.COACHING_CLIENT=COACHING_CLIENT;
  window.coachingClientInit=coachingClientInit; window.coachingClientEnsure=coachingClientEnsure;
  window.coachingDb=coachingDb; window.coachingClientState=coachingClientState;
  window.coachingClientReset=coachingClientReset;
}
