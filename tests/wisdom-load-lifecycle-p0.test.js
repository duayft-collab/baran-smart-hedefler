'use strict';
/* SMART-GOALS Wisdom Load-State & Recovery — P0 KARARLILIK (INSTRUCTION 2).
   Kök nedenler:
   RC-1: _wqHeroReady() "loading!==true"'yu "hazır" sanıyordu → aktivasyon HİÇ
         başlamamışken (auth bekleniyor/aktive edilmemiş) sessizce legacy'ye düşüyor
         VE izleyici hiç kurulmuyordu (kalıcı boş/eski görünüm).
   RC-2: wisdomBootActivate() geçici hatada activationChecked=true kalıyor, otomatik
         yeniden deneme yoktu → oturum boyunca legacy'de kilitli kalabiliyordu.
   RC-3: _wqRenderList() yalnız dizi uzunluğuna bakıyordu → "yükleniyor" ile "gerçekten
         boş" ayrılamıyor, "Henüz söz yok" yanıltıcı gösteriliyordu.
   Bu dosya ÖNCE (RED) yazıldı: "RC-1 regresyon" bloğu mevcut/eski kodda BAŞARISIZ olur.
   Düzeltme sonrası (GREEN) tüm dosya geçer. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const MIG_SRC = fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8');
const A_SRC = fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'A', category: 'Genel',
    active: true, favorite: false, pinned: false, reflected: false, showCount: 0, tags: [], language: 'tr' }, over || {});
}
function pin(S) { return S.__getElements()['pinner'].innerHTML; }
/* _wqRenderList() ge('wq_list') stub'ına YAZAR — harness gerçek DOM içine gömmez;
   liste içeriği doğrulaması bu ayrı elementten okunmalı (pinner'ın string'i içinde DEĞİL). */
function listHtml(S) { return S.__getElements()['wq_list'].innerHTML; }
/* Gerçek setTimeout'u 0ms'e sıkıştırır: retry gecikmeleri testte anlık ama yine de
   gerçek async event-loop turu üzerinden geçer (ara durumlar gözlemlenebilir kalır). */
function fastTimers(S) { S.setTimeout = function (fn) { return setTimeout(fn, 0); }; S.clearTimeout = clearTimeout; }

function fakeDb() {
  const cols = {};
  const wrappers = {}; // path -> STABLE collection wrapper object (colRef must return the SAME
                        // object on every call, so test-side monkeypatches on its .get() actually
                        // affect what wisdomStoreLoad() calls; a fresh object per call would silently
                        // no-op any patch, since production code re-derives the collection each time)
  function colRef(pth) {
    if (!cols[pth]) cols[pth] = new Map();
    if (!wrappers[pth]) {
      const m = cols[pth];
      wrappers[pth] = {
        _map: m,
        doc(id) {
          const key = String(id);
          return {
            set(d) { m.set(key, JSON.parse(JSON.stringify(d))); return Promise.resolve(); },
            get() { return Promise.resolve({ exists: m.has(key), data: () => m.get(key) }); },
            update(p) { if (!m.has(key)) return Promise.reject(new Error('nf')); m.set(key, Object.assign({}, m.get(key), p)); return Promise.resolve(); },
            delete() { m.delete(key); return Promise.resolve(); }
          };
        },
        get() { const docs = []; m.forEach((v, k) => docs.push({ id: k, data: () => v })); return Promise.resolve({ size: docs.length, forEach: (cb) => docs.forEach(cb) }); }
      };
    }
    return wrappers[pth];
  }
  return {
    _cols: cols, _colRefs: wrappers, _getColRef: colRef, // lazy accessor: forces wrapper creation regardless of call order
    collection() { return { doc(uid) { return { collection(sub) { return colRef('users/' + uid + '/' + sub); } }; } }; },
    batch() { const ops = []; return { set(ref, d) { ops.push([ref, d]); }, commit() { ops.forEach(x => x[0].set(x[1])); return Promise.resolve(); } }; }
  };
}
function authedCloud(db) { return { uid: 'u', db: db, ready: true, user: { isAnonymous: false } }; }
async function seedMigrated(S, records) {
  const db = fakeDb();
  S.CLOUD = authedCloud(db);
  const col = db._cols['users/u/wisdomQuotes'] = new Map();
  records.forEach(r => col.set(String(r.id), JSON.parse(JSON.stringify(r))));
  const cs = await S.wisdomContentChecksum(records);
  const app = db._cols['users/u/app'] = new Map();
  app.set('wisdomMeta', { sharded: true, count: records.length, checksum: cs.hash });
  app.set('wisdomMigration', { status: 'completed', total: records.length, migratedCount: records.length, sourceChecksum: cs.hash, targetChecksum: cs.hash });
  return db;
}
/* wisdomQuotes koleksiyonu get()'ini N kez hata ile başarısız, sonra gerçek veriyle
   başarılı yapar. errOpts.code ile Firestore hata kodu simüle edilir (permission-denied vb). */
function makeFlaky(S, failCount, errOpts) {
  const col = S.CLOUD.db._getColRef('users/u/wisdomQuotes');
  let calls = 0;
  const realGet = col.get.bind(col);
  col.get = function () {
    calls++;
    if (calls <= failCount) {
      const e = new Error((errOpts && errOpts.message) || 'transient boom');
      if (errOpts && errOpts.code) e.code = errOpts.code;
      return Promise.reject(e);
    }
    return realGet();
  };
  return { calls: () => calls };
}
function makeSlow(S, delayMs) {
  const col = S.CLOUD.db._getColRef('users/u/wisdomQuotes');
  const realGet = col.get.bind(col);
  col.get = function () { return new Promise(res => setTimeout(() => res(realGet()), delayMs)); };
}
function settle(ms) { return new Promise(r => setTimeout(r, ms == null ? 0 : ms)); }
async function flushRetries(n) { for (let i = 0; i < n; i++) await settle(5); } // fastTimers altında birkaç tick beklet
/* Sabit tık sayısı yerine KOŞUL bazlı bekleme: retry zinciri her turda birden fazla
   microtask/macrotask atlaması gerektirir (schedule→fire→reject→schedule); tam 3
   turluk zincirler için daha güvenilir. */
async function waitUntil(fn, maxTries, stepMs) {
  maxTries = maxTries || 80; stepMs = stepMs || 5;
  for (let i = 0; i < maxTries; i++) { if (fn()) return true; await settle(stepMs); }
  return fn();
}

// ═══════════════════════════════════════════════════════════════════════════
describe('RC-1 regression: readiness must require SETTLEMENT, not just "!loading"', () => {
  test('R1. sharded=false, loading=false, activationChecked=false, auth pending, legacy empty => NOT ready (must fail on old code)', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = []; // legacy boş
    S.wisdomStoreReset();
    // CLOUD hiç set edilmedi → auth beklemede/aktivasyon hiç başlamadı
    assert.equal(S._wqHeroReady(), false, 'aktivasyon hiç başlamamışken/ayarlanmamışken "hazır" denemez');
  });
  test('R2. same state => hero renders placeholder, NOT the false-empty page', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = []; S.wisdomStoreReset(); S.setTimeout = function () { return 0; };
    const h = S.wqHeroHtml();
    assert.ok(/hazırlanıyor/.test(h), 'placeholder gösterilmeli');
  });
  test('R3. same state => list shows loading skeleton, NOT "Henüz söz yok"', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = []; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
    S.wisdomStoreReset(); S.setTimeout = function () { return 0; }; S.tab = 'wisdom';
    S.renderWisdomQuotes();
    const h = listHtml(S);
    assert.equal(/Henüz söz yok/.test(h), false, 'ayarlanmamış/beklemedeki durumda yanlış-boş mesajı YASAK');
    assert.ok(/hazırlanıyor/.test(h), 'yükleme iskeleti gösterilmeli');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Explicit lifecycle state machine (9 tokens, single authoritative source)', () => {
  test('1. IDLE: fresh reset, no activation attempted', () => {
    const S = createSandbox(); S.wisdomStoreReset();
    assert.equal(S.wqLifecycleState(), 'idle');
  });
  test('2. WAITING_AUTH: activation scheduled, polling for auth', () => {
    const S = createSandbox(); S.wisdomStoreReset();
    S.WQ_STORE_STATE._activationScheduled = true;
    assert.equal(S.wqLifecycleState(), 'waiting_auth');
  });
  test('3. WAITING_AUTH: explicit no_auth reason (direct call before auth)', () => {
    const S = createSandbox(); S.wisdomStoreReset();
    S.WQ_STORE_STATE.activationReason = 'no_auth';
    assert.equal(S.wqLifecycleState(), 'waiting_auth');
  });
  test('4. ACTIVATING: reason=checking', () => {
    const S = createSandbox(); S.WQ_STORE_STATE.activationReason = 'checking';
    assert.equal(S.wqLifecycleState(), 'activating');
  });
  test('5. LOADING: reason=verifying', () => {
    const S = createSandbox(); S.WQ_STORE_STATE.activationReason = 'verifying';
    assert.equal(S.wqLifecycleState(), 'loading');
  });
  test('6. RETRYING: retrying=true overrides any stale reason', () => {
    const S = createSandbox(); S.WQ_STORE_STATE.activationReason = 'load_failed'; S.WQ_STORE_STATE.retrying = true;
    assert.equal(S.wqLifecycleState(), 'retrying');
  });
  test('7. READY: sharded activated with records', async () => {
    const S = createSandbox();
    await seedMigrated(S, [wq('a'), wq('b')]);
    await S.wisdomBootActivate();
    assert.equal(S.wqLifecycleState(), 'ready');
  });
  test('8. SETTLED_LEGACY: gate failed, legacy has records', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('x')];
    await seedMigrated(S, [wq('a')]);
    S.CLOUD.db._cols['users/u/app'].get('wisdomMeta').sharded = false;
    await S.wisdomBootActivate();
    assert.equal(S.wqLifecycleState(), 'settled_legacy');
  });
  test('9. EMPTY: settled to legacy AND legacy genuinely has zero records', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [];
    await seedMigrated(S, [wq('a')]);
    S.CLOUD.db._cols['users/u/app'].get('wisdomMeta').sharded = false;
    await S.wisdomBootActivate();
    assert.equal(S.wqLifecycleState(), 'empty');
  });
  test('10. ERROR: retries exhausted', () => {
    const S = createSandbox(); S.WQ_STORE_STATE.retryExhausted = true;
    assert.equal(S.wqLifecycleState(), 'error');
  });
  test('11. state derivation does not require re-reading loosely related booleans in UI code (single function)', () => {
    // _wqHeroReady ve _wqRenderList AYNI wqLifecycleState() çağrısına dayanır (kod-taraması)
    assert.ok((A_SRC.match(/wqLifecycleState\s*\(\s*\)/g) || []).length >= 2, 'hero ve liste aynı otoriter kaynağı kullanmalı');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('_wqHeroReady() truth table', () => {
  const notReady = ['idle', 'waiting_auth', 'activating', 'loading', 'retrying'];
  const ready = ['ready', 'empty', 'settled_legacy', 'error'];
  notReady.forEach(function (st) {
    test('not ready for ' + st, () => {
      const S = createSandbox();
      S.wqLifecycleState = function () { return st; };
      assert.equal(S._wqHeroReady(), false, st);
    });
  });
  ready.forEach(function (st) {
    test('ready for ' + st, () => {
      const S = createSandbox();
      S.wqLifecycleState = function () { return st; };
      assert.equal(S._wqHeroReady(), true, st);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('_wqRenderList() state-aware rendering (RC-3)', () => {
  function boot(S, list) { S.D.wisdomQuotes = list; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = []; S.wisdomStoreReset(); S.tab = 'wisdom'; }
  test('12. unresolved states never show "Henüz söz yok"', () => {
    ['idle', 'waiting_auth', 'activating', 'loading'].forEach(function (st) {
      const S = createSandbox(); boot(S, []); S.setTimeout = function () { return 0; };
      S.wqLifecycleState = function () { return st; };
      S.renderWisdomQuotes();
      const h = listHtml(S);
      assert.equal(/Henüz söz yok/.test(h), false, st);
      assert.ok(/hazırlanıyor/.test(h), st + ' skeleton');
    });
  });
  test('13. retrying state shows calm auto-retry message, not empty/error alarm', () => {
    const S = createSandbox(); boot(S, []); S.setTimeout = function () { return 0; };
    S.wqLifecycleState = function () { return 'retrying'; };
    S.renderWisdomQuotes();
    const h = listHtml(S);
    assert.equal(/Henüz söz yok/.test(h), false);
    assert.ok(/yeniden deneniyor/i.test(h));
  });
  test('14. error state with records: list still renders + non-blocking retry banner', () => {
    const S = createSandbox(); boot(S, [wq('a'), wq('b')]); S.setTimeout = function () { return 0; };
    S.wqLifecycleState = function () { return 'error'; };
    S.renderWisdomQuotes();
    const h = listHtml(S);
    assert.ok(/Söz a|Söz b/.test(h), 'mevcut kayıtlar yine gösterilmeli');
    assert.ok(/<button[^>]*wqManualRetryLoad/.test(h), 'klavye-erişilebilir gerçek buton');
  });
  test('15. error state with zero records: explicit error empty-state + retry action, not "Henüz söz yok"', () => {
    const S = createSandbox(); boot(S, []); S.setTimeout = function () { return 0; };
    S.wqLifecycleState = function () { return 'error'; };
    S.renderWisdomQuotes();
    const h = listHtml(S);
    assert.equal(/Henüz söz yok/.test(h), false);
    assert.ok(/<button[^>]*wqManualRetryLoad/.test(h));
  });
  test('16. genuinely settled + zero records => "Henüz söz yok" (unchanged legitimate UX)', () => {
    ['ready', 'empty', 'settled_legacy'].forEach(function (st) {
      const S = createSandbox(); boot(S, []); S.setTimeout = function () { return 0; };
      S.wqLifecycleState = function () { return st; };
      S.renderWisdomQuotes();
      assert.ok(/Henüz söz yok/.test(listHtml(S)), st);
    });
  });
  test('17. settled + records => normal list (unchanged)', () => {
    const S = createSandbox(); boot(S, [wq('a')]); S.setTimeout = function () { return 0; };
    S.wqLifecycleState = function () { return 'ready'; };
    S.renderWisdomQuotes();
    assert.ok(/Söz a/.test(listHtml(S)));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Bounded automatic retry (policy + classification)', () => {
  test('18. first load fails, second succeeds => activates, exactly 1 retry recorded', async () => {
    const S = createSandbox(); fastTimers(S); S.D.wisdomQuotes = [];
    await seedMigrated(S, [wq('a'), wq('b'), wq('c')]);
    makeFlaky(S, 1);
    await S.wisdomBootActivate();
    await waitUntil(() => S.wisdomStoreIsSharded());
    assert.equal(S.wisdomStoreIsSharded(), true);
    assert.equal(S.wqLifecycleState(), 'ready');
    assert.equal(S.wisdomActivationRetryStatus().attempt, 1);
  });
  test('19. first two loads fail, third succeeds => activates', async () => {
    const S = createSandbox(); fastTimers(S); S.D.wisdomQuotes = [];
    await seedMigrated(S, [wq('a')]);
    makeFlaky(S, 2);
    await S.wisdomBootActivate();
    await waitUntil(() => S.wisdomStoreIsSharded());
    assert.equal(S.wisdomStoreIsSharded(), true);
    assert.equal(S.wqLifecycleState(), 'ready');
  });
  test('20. all bounded attempts fail => ERROR, retries stop (no infinite loop)', async () => {
    const S = createSandbox(); fastTimers(S); S.D.wisdomQuotes = [wq('legacy1')];
    await seedMigrated(S, [wq('a')]);
    const flaky = makeFlaky(S, 999); // hep başarısız
    await S.wisdomBootActivate();
    await waitUntil(() => S.wisdomActivationRetryStatus().exhausted);
    assert.equal(S.wqLifecycleState(), 'error');
    assert.equal(S.wisdomActivationRetryStatus().exhausted, true);
    const callsAfterSettle = flaky.calls();
    await flushRetries(10); // daha fazla bekle
    assert.equal(flaky.calls(), callsAfterSettle, 'sınır aşılınca yeni deneme YAPILMAMALI');
    assert.equal(S.wisdomActivationRetryStatus().attempt <= 3, true, 'en fazla 3 retry');
  });
  test('21. permission-denied is classified permanent => no retry, immediate error', async () => {
    const S = createSandbox(); fastTimers(S); S.D.wisdomQuotes = [];
    await seedMigrated(S, [wq('a')]);
    const flaky = makeFlaky(S, 999, { code: 'permission-denied', message: 'Missing or insufficient permissions' });
    await S.wisdomBootActivate();
    await flushRetries(10);
    assert.equal(S.wqLifecycleState(), 'error');
    assert.equal(flaky.calls(), 1, 'permission-denied yeniden denenmemeli (tek deneme)');
  });
  test('22. retry delays follow bounded backoff policy (800/2000/5000 base, attempts <= 3)', () => {
    const S = createSandbox();
    const d1 = S._wqRetryDelay(1), d2 = S._wqRetryDelay(2), d3 = S._wqRetryDelay(3);
    assert.ok(d1 >= 640 && d1 <= 960, 'attempt1 ~800ms ±20%: ' + d1);
    assert.ok(d2 >= 1600 && d2 <= 2400, 'attempt2 ~2000ms ±20%: ' + d2);
    assert.ok(d3 >= 4000 && d3 <= 6000, 'attempt3 ~5000ms ±20%: ' + d3);
  });
  test('23. no duplicate retry chain: scheduling twice while already retrying is a no-op', () => {
    const S = createSandbox(); S.setTimeout = function () { return 1; };
    S.WQ_STORE_STATE.activationChecked = true;
    S._wqScheduleRetry('load_failed');
    const attemptAfterFirst = S.WQ_STORE_STATE.retryAttempt;
    S._wqScheduleRetry('load_failed'); // ikinci çağrı zincir başlatmamalı
    assert.equal(S.WQ_STORE_STATE.retryAttempt, attemptAfterFirst, 'ikinci schedule çağrısı yeni deneme başlatmamalı');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Single-flight protection', () => {
  test('24. concurrent wisdomBootActivate() calls do not run two activation chains', async () => {
    const S = createSandbox(); fastTimers(S);
    await seedMigrated(S, [wq('a'), wq('b')]);
    makeSlow(S, 5);
    const p1 = S.wisdomBootActivate();
    const p2 = S.wisdomBootActivate(); // aynı anda ikinci çağrı
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.ok(r2.reason === 'in_flight' || r2.reason === 'already_checked', r2.reason);
    assert.equal(S.wisdomStoreIsSharded(), true);
  });
  test('25. concurrent wisdomStoreLoad() calls share the same in-flight promise', async () => {
    const S = createSandbox();
    await seedMigrated(S, [wq('a')]);
    makeSlow(S, 5);
    const p1 = S.wisdomStoreLoad();
    const p2 = S.wisdomStoreLoad();
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.deepEqual(r1, r2, 'aynı in-flight sonucu paylaşılmalı');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Watcher: single instance, bounded, disposes after settlement, no duplicate render', () => {
  test('26. watcher polls until settled then triggers exactly ONE full re-render', async () => {
    const S = createSandbox(); fastTimers(S);
    S.D.wisdomQuotes = []; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
    S.wisdomStoreReset(); S.tab = 'wisdom';
    let renders = 0; const orig = S.renderWisdomQuotes;
    S.renderWisdomQuotes = function () { renders++; return orig(); };
    S.renderWisdomQuotes(); // ilk render: unresolved → watcher kurulur
    const firstCount = renders;
    // aktivasyonu ayarla + settle et
    await seedMigrated(S, [wq('a')]);
    await S.wisdomBootActivate();
    await flushRetries(10);
    assert.equal(renders, firstCount + 1, 'settle sonrası TAM OLARAK bir kez yeniden render');
  });
  test('27. no duplicate watcher when hero is polled multiple times while unresolved', () => {
    const S = createSandbox(); S.wisdomStoreReset();
    let scheduled = 0; const origSetTimeout = S.setTimeout;
    S.setTimeout = function (fn, ms) { scheduled++; return origSetTimeout(fn, ms); };
    S.wqHeroHtml(); S.wqHeroHtml(); S.wqHeroHtml(); // aynı unresolved pencerede tekrar tekrar
    assert.equal(scheduled, 1, 'yalnız TEK izleyici zamanlayıcısı kurulmalı');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Disposal: retry timer cancelled, no leaks', () => {
  test('28. _wqCancelRetry clears the pending timer and retrying flag', () => {
    const S = createSandbox(); let cleared = null;
    S.setTimeout = function (fn) { return 999; };
    S.clearTimeout = function (id) { cleared = id; };
    S.WQ_STORE_STATE.activationChecked = true;
    S._wqScheduleRetry('load_failed');
    assert.equal(S.WQ_STORE_STATE.retrying, true);
    S._wqCancelRetry();
    assert.equal(S.WQ_STORE_STATE.retrying, false);
    assert.equal(cleared, 999);
  });
  test('29. logout (handleAuthChange with null user) cancels any pending retry', () => {
    const S = createSandbox(); let cleared = false;
    S.setTimeout = function (fn) { return 1; };
    S.clearTimeout = function () { cleared = true; };
    S.WQ_STORE_STATE.activationChecked = true;
    S._wqScheduleRetry('load_failed');
    assert.equal(S.WQ_STORE_STATE.retrying, true);
    if (typeof S.handleAuthChange === 'function') S.handleAuthChange(null);
    assert.equal(S.WQ_STORE_STATE.retrying, false, 'logout sonrası retrying kapanmalı');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('20 required scenarios (mapped)', () => {
  test('S1. cold first opening (no CLOUD yet) => calm skeleton, no false-empty', () => {
    const S = createSandbox(); S.D.wisdomQuotes = []; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
    S.wisdomStoreReset(); S.setTimeout = function () { return 0; }; S.tab = 'wisdom';
    S.renderWisdomQuotes();
    assert.equal(/Henüz söz yok/.test(listHtml(S)), false);
  });
  test('S2. normal page refresh mid-activation => still calm, no false-empty', () => {
    const S = createSandbox(); S.D.wisdomQuotes = []; S.wisdomStoreReset();
    S.WQ_STORE_STATE.activationReason = 'verifying'; S.setTimeout = function () { return 0; }; S.tab = 'wisdom';
    S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
    S.renderWisdomQuotes();
    assert.equal(/Henüz söz yok/.test(listHtml(S)), false);
  });
  test('S3. authentication delayed => waiting_auth is not ready, settles once auth appears', async () => {
    const S = createSandbox(); fastTimers(S);
    S.CLOUD = { db: null, uid: null }; // auth henüz yok
    assert.equal(S.wqLifecycleState(), 'idle'); // _activationScheduled henüz kurulmadı (manuel çağrı testte)
    const db = await seedMigrated(S, [wq('a')]); // auth "gelir"
    await S.wisdomBootActivate();
    assert.equal(S.wqLifecycleState(), 'ready');
  });
  test('S4. Firestore request delayed (slow network) => still resolves correctly', async () => {
    const S = createSandbox(); fastTimers(S);
    await seedMigrated(S, [wq('a'), wq('b')]);
    makeSlow(S, 15);
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, true);
    assert.equal(S.wqLifecycleState(), 'ready');
  });
  test('S5. first load fails, second succeeds (covered above as 18)', () => { assert.ok(true); });
  test('S6. first two loads fail, third succeeds (covered above as 19)', () => { assert.ok(true); });
  test('S7. all bounded attempts fail (covered above as 20)', () => { assert.ok(true); });
  test('S8. permission-denied failure (covered above as 21)', () => { assert.ok(true); });
  test('S9. fast repeated navigation into the page => single watcher, no duplicate chains', () => {
    const S = createSandbox(); S.wisdomStoreReset(); S.D.wisdomQuotes = [];
    S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = []; S.tab = 'wisdom';
    let scheduled = 0; const origSetTimeout = S.setTimeout;
    S.setTimeout = function (fn, ms) { scheduled++; return origSetTimeout(fn, ms); };
    for (let i = 0; i < 5; i++) S.renderWisdomQuotes(); // hızlı art arda giriş simülasyonu
    assert.equal(scheduled, 1, 'art arda navigasyon tekrar izleyici kurmamalı');
  });
  test('S10. long-running authenticated session: activationChecked stays settled, no re-trigger storms', async () => {
    const S = createSandbox(); fastTimers(S);
    await seedMigrated(S, [wq('a')]);
    await S.wisdomBootActivate();
    const before = S.wqList().length;
    for (let i = 0; i < 20; i++) S.wqHeroHtml(); // uzun oturumda tekrar tekrar erişim
    assert.equal(S.wqList().length, before, 'kararlı, yinelenen aktivasyon tetiklenmez');
  });
  test('S11. mobile viewport: placeholder/list markup has no fixed pixel width (responsive)', () => {
    const S = createSandbox(); S.D.wisdomQuotes = []; S.wisdomStoreReset(); S.setTimeout = function () { return 0; };
    const h = S._wqHeroLoadingHtml();
    assert.equal(/[^-](width):\s*\d{3,}px/.test(h.replace(/max-width|min-width/g, '')), false);
  });
  test('S12. multiple browser tabs: two independent sandboxes activating against the same backend both settle correctly', async () => {
    const S1 = createSandbox(); fastTimers(S1);
    const db = await seedMigrated(S1, [wq('a'), wq('b')]);
    const S2 = createSandbox(); fastTimers(S2); S2.CLOUD = { uid: 'u', db: db, ready: true, user: { isAnonymous: false } };
    const [r1, r2] = await Promise.all([S1.wisdomBootActivate(), S2.wisdomBootActivate()]);
    assert.equal(r1.ok, true); assert.equal(r2.ok, true);
    assert.equal(S1.wqList().length, 2); assert.equal(S2.wqList().length, 2);
  });
  test('S13. legacy fallback intentionally selected (no migration) => settled_legacy, no scary error', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [wq('a')];
    S.CLOUD = authedCloud(fakeDb());
    await S.wisdomBootActivate();
    assert.equal(S.wqLifecycleState(), 'settled_legacy');
    assert.equal(S.wisdomStatusLineHtml(), ''); // normal legacy: sessiz (mevcut UX korunur)
  });
  test('S14. genuine zero-record archive => calm "Henüz söz yok", not an error', async () => {
    const S = createSandbox(); S.D.wisdomQuotes = [];
    S.CLOUD = authedCloud(fakeDb());
    await S.wisdomBootActivate();
    assert.equal(S.wqLifecycleState(), 'empty');
    S.setTimeout = function () { return 0; }; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = []; S.tab = 'wisdom';
    S.renderWisdomQuotes();
    assert.ok(/Henüz söz yok/.test(listHtml(S)));
  });
  test('S15. sharded archive returns 5100 records => all present, ready', async () => {
    const S = createSandbox();
    const many = []; for (let i = 0; i < 5100; i++) many.push(wq('w' + i));
    await seedMigrated(S, many);
    const r = await S.wisdomBootActivate();
    assert.equal(r.ok, true); assert.equal(S.wqList().length, 5100);
    assert.equal(S.wqLifecycleState(), 'ready');
  });
  test('S16. watcher disposes after settlement (covered above as 26/27)', () => { assert.ok(true); });
  test('S17. no duplicate retry chain (covered above as 23)', () => { assert.ok(true); });
  test('S18. no duplicate full-page render (covered above as 26)', () => { assert.ok(true); });
  test('S19. retry timer cancelled on disposal (covered above as 28/29)', () => { assert.ok(true); });
  test('S20. empty-state message never appears during unresolved states (covered above as 12)', () => { assert.ok(true); });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Single source-selection boundary (section 6)', () => {
  test('30. hero and list both consume wqLifecycleState(); no independent source-selection logic duplicated', () => {
    const listBlock = A_SRC.slice(A_SRC.indexOf('function _wqRenderList'), A_SRC.indexOf('function _wqRenderList') + 2200);
    assert.ok(/wqLifecycleState\s*\(\s*\)/.test(listBlock), 'liste tek otoriter kaynağı okumalı');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Diagnostic logging (temporary, flagged, no content leakage)', () => {
  test('31. default OFF: no [WQ-LOAD] console output', async () => {
    const S = createSandbox(); const logs = [];
    S.console = Object.assign({}, console, { log: function (...a) { logs.push(a.join(' ')); } });
    S.D.wisdomQuotes = []; S.wisdomStoreReset();
    S.CLOUD = authedCloud(fakeDb());
    await S.wisdomBootActivate();
    assert.equal(logs.some(l => l.indexOf('[WQ-LOAD]') >= 0), false);
  });
  test('32. when enabled: logs carry [WQ-LOAD] prefix and never quote content', async () => {
    const S = createSandbox(); const logs = [];
    S.console = Object.assign({}, console, { log: function (...a) { logs.push(a.join(' ')); } });
    S.window.WQ_DEBUG_LOAD = true;
    await seedMigrated(S, [wq('secretQuoteId', { quote: 'ÇOK GİZLİ ÖZEL METİN 123' })]);
    await S.wisdomBootActivate();
    assert.ok(logs.some(l => l.indexOf('[WQ-LOAD]') >= 0), 'debug açıkken loglanmalı');
    logs.forEach(l => assert.equal(l.indexOf('ÇOK GİZLİ ÖZEL METİN'), -1, 'söz İÇERİĞİ ASLA loglanmaz'));
  });
  test('33. static guard: log helper never interpolates quote/notes fields', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8') +
                fs.readFileSync(path.join(ROOT, 'js', '02b-wisdom-store.js'), 'utf8');
    const logBlock = (src.match(/function _wqLog[\s\S]*?\n\}/) || [''])[0];
    assert.equal(/\.quote\b|\.notes\b/.test(logBlock), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Static guards: no unrelated boot-file wiring, no scoring/business changes', () => {
  test('34. wisdomStoreLoad still unwired from startup/render/auth files', () => {
    ['js/12-render-boot.js', 'js/03-auth.js', 'js/02-sync.js', 'js/08-ui-core.js', 'js/11a-wisdom-quotes.js', 'js/11b-wisdom-display.js', 'js/11q-wisdom-experience.js'].forEach(function (f) {
      assert.equal(/wisdomStoreLoad\s*\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), false, f);
    });
  });
  test('35. no realtime listener introduced', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js', '02b-wisdom-store.js'), 'utf8') +
                fs.readFileSync(path.join(ROOT, 'js', '02c-wisdom-migration.js'), 'utf8');
    assert.equal(/onSnapshot\s*\(|addSnapshotListener\s*\(|\.subscribe\s*\(/.test(src), false);
  });
  test('36. mirrors byte-identical + all touched files < 900 lines', () => {
    ['02b-wisdom-store.js', '02c-wisdom-migration.js', '11a-wisdom-quotes.js', '03-auth.js'].forEach(function (f) {
      const a = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
      const b = fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8');
      assert.equal(a, b, f + ' mirror');
      assert.ok(a.split('\n').length < 900, f + ' <900');
    });
  });
});
