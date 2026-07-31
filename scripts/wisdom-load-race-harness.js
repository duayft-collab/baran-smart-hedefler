'use strict';
/* SMART-GOALS Wisdom Load-State — P0 KARARLILIK. 2500-run race-condition harness
   (INSTRUCTION 2, mandatory before completion). Standalone script — NOT part of the
   regular `node --test` suite (would slow every run); invoke manually:
     node scripts/wisdom-load-race-harness.js
   Covers: 500 cold starts, 500 auth-delay, 500 slow-Firestore-load, 500 repeated-
   navigation, 500 multi-tab. Target: 0 false-empty renders, 0 permanently-stuck
   loading, 0 duplicate activation chains, 0 uncaught errors. */
const path = require('path');
const { createSandbox } = require(path.join(__dirname, '..', 'tests', 'harness.js'));

function wq(id, over) {
  return Object.assign({ id: id, quote: 'S' + id, author: 'A', category: 'Genel',
    active: true, favorite: false, pinned: false, reflected: false, showCount: 0, tags: [], language: 'tr' }, over || {});
}
function fakeDb() {
  const cols = {}; const wrappers = {};
  function colRef(pth) {
    if (!cols[pth]) cols[pth] = new Map();
    if (!wrappers[pth]) {
      const m = cols[pth];
      wrappers[pth] = { _map: m,
        doc(id) { const key = String(id); return {
            set(d) { m.set(key, JSON.parse(JSON.stringify(d))); return Promise.resolve(); },
            get() { return Promise.resolve({ exists: m.has(key), data: () => m.get(key) }); },
            update(p) { if (!m.has(key)) return Promise.reject(new Error('nf')); m.set(key, Object.assign({}, m.get(key), p)); return Promise.resolve(); },
            delete() { m.delete(key); return Promise.resolve(); } }; },
        get() { const docs = []; m.forEach((v, k) => docs.push({ id: k, data: () => v })); return Promise.resolve({ size: docs.length, forEach: (cb) => docs.forEach(cb) }); } };
    }
    return wrappers[pth];
  }
  return { _cols: cols, _colRefs: wrappers, _getColRef: colRef,
    collection() { return { doc(uid) { return { collection(sub) { return colRef('users/' + uid + '/' + sub); } }; } }; },
    batch() { const ops = []; return { set(ref, d) { ops.push([ref, d]); }, commit() { ops.forEach(x => x[0].set(x[1])); return Promise.resolve(); } }; }
  };
}
function authedCloud(db) { return { uid: 'u', db: db, ready: true, user: { isAnonymous: false } }; }
async function seedMigrated(S, db, records) {
  S.CLOUD = authedCloud(db);
  const col = db._cols['users/u/wisdomQuotes'] = new Map();
  records.forEach(r => col.set(String(r.id), JSON.parse(JSON.stringify(r))));
  const cs = await S.wisdomContentChecksum(records);
  const app = db._cols['users/u/app'] = new Map();
  app.set('wisdomMeta', { sharded: true, count: records.length, checksum: cs.hash });
  app.set('wisdomMigration', { status: 'completed', total: records.length, migratedCount: records.length, sourceChecksum: cs.hash, targetChecksum: cs.hash });
}
function fastTimers(S) { S.setTimeout = function (fn) { return setTimeout(fn, 0); }; }
function settle(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitUntil(fn, maxTries, stepMs) {
  maxTries = maxTries || 200; stepMs = stepMs || 3;
  for (let i = 0; i < maxTries; i++) { if (fn()) return true; await settle(stepMs); }
  return fn();
}
function boot(S, quotes) {
  S.D.wisdomQuotes = quotes || []; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
  S.wisdomStoreReset(); S.tab = 'wisdom';
}
function listHtml(S) { const el = S.__getElements()['wq_list']; return el ? el.innerHTML : ''; }
function isFalseEmpty(S) {
  // "Henüz söz yok" gösterildi ama lifecycle SETTLED değil (unresolved sırasında yanlış-boş)
  const st = S.wqLifecycleState();
  const settled = st === 'ready' || st === 'empty' || st === 'settled_legacy';
  return /Henüz söz yok/.test(listHtml(S)) && !settled;
}

const counters = { falseEmpty: 0, stuckLoading: 0, duplicateChain: 0, uncaughtErrors: 0, ok: 0, total: 0 };
const failures = [];

async function runColdStart(i) {
  const S = createSandbox(); fastTimers(S);
  boot(S, []); // aktivasyon hiç tetiklenmedi (IDLE)
  S.renderWisdomQuotes();
  if (isFalseEmpty(S)) { counters.falseEmpty++; failures.push('cold#' + i + ' false-empty at IDLE'); }
  // sonra ayarlan + yerleş
  const db = fakeDb();
  await seedMigrated(S, db, [wq('a' + i), wq('b' + i)]);
  await S.wisdomBootActivate();
  const settled = await waitUntil(() => S.wisdomStoreIsSharded());
  if (!settled) { counters.stuckLoading++; failures.push('cold#' + i + ' never settled'); }
}

async function runAuthDelay(i) {
  const S = createSandbox(); fastTimers(S);
  boot(S, []);
  S.renderWisdomQuotes();
  if (isFalseEmpty(S)) { counters.falseEmpty++; failures.push('authdelay#' + i + ' false-empty pre-auth'); }
  await settle(1 + (i % 4)); // gecikmiş auth simülasyonu
  const db = fakeDb();
  await seedMigrated(S, db, [wq('x' + i)]);
  const r = await S.wisdomBootActivate();
  const settled = await waitUntil(() => S.wqLifecycleState() === 'ready' || S.wqLifecycleState() === 'error');
  if (!settled) { counters.stuckLoading++; failures.push('authdelay#' + i + ' stuck reason=' + JSON.stringify(r)); }
}

async function runSlowLoad(i) {
  const S = createSandbox(); fastTimers(S);
  const db = fakeDb();
  await seedMigrated(S, db, [wq('s' + i)]);
  const col = db._getColRef('users/u/wisdomQuotes');
  const realGet = col.get.bind(col);
  col.get = function () { return new Promise(res => setTimeout(() => res(realGet()), 1 + (i % 5))); };
  boot(S, []);
  S.CLOUD = authedCloud(db); // seedMigrated already set this; re-assert after boot() reset D only
  S.renderWisdomQuotes();
  if (isFalseEmpty(S)) { counters.falseEmpty++; failures.push('slow#' + i + ' false-empty during fetch'); }
  const p = S.wisdomBootActivate();
  const settled = await waitUntil(() => S.wisdomStoreIsSharded());
  await p;
  if (!settled) { counters.stuckLoading++; failures.push('slow#' + i + ' never settled'); }
}

async function runRepeatedNav(i) {
  const S = createSandbox(); fastTimers(S);
  boot(S, []);
  let scheduled = 0; const origSetTimeout = S.setTimeout;
  S.setTimeout = function (fn, ms) { scheduled++; return origSetTimeout(fn, ms); };
  for (let n = 0; n < 6; n++) { S.renderWisdomQuotes(); if (isFalseEmpty(S)) { counters.falseEmpty++; failures.push('nav#' + i + ' false-empty on repeat ' + n); } }
  if (scheduled > 1) { counters.duplicateChain++; failures.push('nav#' + i + ' duplicate watcher chain: ' + scheduled); }
  const db = fakeDb();
  await seedMigrated(S, db, [wq('n' + i)]);
  await S.wisdomBootActivate();
  const settled = await waitUntil(() => S.wisdomStoreIsSharded());
  if (!settled) { counters.stuckLoading++; failures.push('nav#' + i + ' never settled'); }
}

async function runMultiTab(i) {
  const db = fakeDb();
  const S1 = createSandbox(); fastTimers(S1);
  await seedMigrated(S1, db, [wq('m' + i), wq('m' + i + 'b')]);
  const S2 = createSandbox(); fastTimers(S2); S2.CLOUD = authedCloud(db);
  boot(S1, []); S1.CLOUD = authedCloud(db);
  boot(S2, []);
  S1.renderWisdomQuotes(); S2.renderWisdomQuotes();
  if (isFalseEmpty(S1)) { counters.falseEmpty++; failures.push('tab#' + i + ' S1 false-empty'); }
  if (isFalseEmpty(S2)) { counters.falseEmpty++; failures.push('tab#' + i + ' S2 false-empty'); }
  const [r1, r2] = await Promise.all([S1.wisdomBootActivate(), S2.wisdomBootActivate()]);
  const s1ok = await waitUntil(() => S1.wisdomStoreIsSharded());
  const s2ok = await waitUntil(() => S2.wisdomStoreIsSharded());
  if (!s1ok || !s2ok) { counters.stuckLoading++; failures.push('tab#' + i + ' one tab never settled: ' + JSON.stringify({ r1, r2 })); }
}

/* WQ_RACE_N ortam değişkeni ile hızlı duman-testi için sayı küçültülebilir; varsayılan
   500 = zorunlu tam 2500-koşu (5×500) senaryosu. */
const N = process.env.WQ_RACE_N ? parseInt(process.env.WQ_RACE_N, 10) : 500;
const SCENARIOS = [
  { name: 'cold-start', fn: runColdStart, n: N },
  { name: 'auth-delay', fn: runAuthDelay, n: N },
  { name: 'slow-load', fn: runSlowLoad, n: N },
  { name: 'repeated-nav', fn: runRepeatedNav, n: N },
  { name: 'multi-tab', fn: runMultiTab, n: N }
];

async function main() {
  const t0 = Date.now();
  for (const sc of SCENARIOS) {
    const st0 = Date.now();
    for (let i = 0; i < sc.n; i++) {
      counters.total++;
      try { await sc.fn(i); counters.ok++; }
      catch (e) { counters.uncaughtErrors++; failures.push(sc.name + '#' + i + ' UNCAUGHT: ' + (e && e.stack || e)); }
    }
    console.log('[' + sc.name + '] ' + sc.n + ' runs in ' + (Date.now() - st0) + 'ms');
  }
  console.log('\n=== WISDOM LOAD RACE HARNESS RESULT ===');
  console.log('total runs        :', counters.total);
  console.log('ok                :', counters.ok);
  console.log('false-empty       :', counters.falseEmpty);
  console.log('stuck loading     :', counters.stuckLoading);
  console.log('duplicate chains  :', counters.duplicateChain);
  console.log('uncaught errors   :', counters.uncaughtErrors);
  console.log('elapsed ms        :', Date.now() - t0);
  if (failures.length) {
    console.log('\n--- first 30 failures ---');
    failures.slice(0, 30).forEach(f => console.log(f));
  }
  const pass = counters.falseEmpty === 0 && counters.stuckLoading === 0 && counters.duplicateChain === 0 && counters.uncaughtErrors === 0;
  console.log('\nFINAL:', pass ? 'PASS — 0/0/0/0 across all 2500 runs' : 'FAIL — see counters above');
  process.exit(pass ? 0 : 1);
}
main();
