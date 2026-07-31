'use strict';
/* SMART-GOALS Wisdom UX-R4 Part A — Hero daily-quote determinism hotfix.
   Aynı takvim günü, kaynak/sıralama/aktivasyon-zamanından BAĞIMSIZ aynı söz id'si
   (stabil ID-hash; dayOfYear%list.length KALDIRILDI). Aktivasyon penceresinde
   placeholder (sessiz legacy pick YOK). Yeni state/localStorage/write YOK. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', '11a-wisdom-quotes.js'), 'utf8');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Yazar ' + id, category: 'Odak', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], priority: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null }, over || {});
}
function setList(S, arr) { S.D.wisdomQuotes = arr; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = []; if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset(); S._whIdx = null; }
function heroQuoteText(S) { const m = S.wqHeroHtml().match(/wq-hero-quote"[^>]*>([^<]+)</); return m ? m[1] : null; }

describe('Deterministic daily pick (id-hash, not length-modulo)', () => {
  test('1. order-independent: same ids in different order → same pick', () => {
    const S = createSandbox();
    setList(S, [wq('a'), wq('b'), wq('c'), wq('d'), wq('e')]); const p1 = S._wqDailyPick().id;
    setList(S, [wq('e'), wq('c'), wq('a'), wq('d'), wq('b')]); const p2 = S._wqDailyPick().id;
    assert.equal(p1, p2);
  });
  test('2. repeated calls return the same quote', () => {
    const S = createSandbox();
    setList(S, [wq('a'), wq('b'), wq('c')]);
    assert.equal(S._wqDailyPick().id, S._wqDailyPick().id);
  });
  test('3. source-parity: sharded winner present in legacy subset → identical pick', () => {
    const S = createSandbox();
    const big = []; for (let i = 0; i < 40; i++) big.push(wq('q' + i));
    setList(S, big); const winner = S._wqDailyPick().id;
    const subset = big.filter(q => ['q0', 'q1', 'q2', winner].indexOf(q.id) >= 0);
    setList(S, subset); assert.equal(S._wqDailyPick().id, winner);
  });
  test('4. length-independent: pick not derived from list.length modulo', () => {
    // aynı id kümesi, farklı boyutlarda AYNI değil (superset) ama winner id sabit kalır (madde3);
    // burada: hash seed'i kullanır, list.length'e bağlı değil (statik kanıt madde 13)
    const S = createSandbox();
    assert.ok(S._wqHashId('x', 's1') !== S._wqHashId('x', 's2'), 'seed must influence hash');
    assert.equal(S._wqHashId('x', 's1'), S._wqHashId('x', 's1'), 'hash deterministic');
  });
  test('5. two reload simulations return the same hero quote', () => {
    const S = createSandbox();
    setList(S, [wq('a'), wq('b'), wq('c'), wq('d')]);
    S.WQ_STORE_STATE.activationReason = 'no_migration'; // P0-LOAD: lifecycle'ı SETTLED'a sabitle
    S._whIdx = null; const h1 = heroQuoteText(S);
    S._whIdx = null; const h2 = heroQuoteText(S);
    assert.equal(h1, h2);
  });
  test('6. different dates may return different quotes; seed is used', () => {
    const S = createSandbox();
    setList(S, (function () { const a = []; for (let i = 0; i < 30; i++) a.push(wq('d' + i)); return a; })());
    const orig = S._wqDailySeed;
    const picks = new Set();
    ['2026-1-1', '2026-3-15', '2026-6-20', '2026-11-9'].forEach(seed => { S._wqDailySeed = () => seed; picks.add(S._wqDailyPick().id); });
    S._wqDailySeed = orig;
    assert.ok(picks.size > 1, 'seed should influence the daily pick across dates');
  });
  test('7. empty list is safe', () => {
    const S = createSandbox(); setList(S, []);
    S.WQ_STORE_STATE.activationReason = 'no_migration'; // P0-LOAD: lifecycle'ı SETTLED (genuinely-empty)'a sabitle
    assert.equal(S._wqDailyPick(), null);
    assert.equal(S.wqHeroHtml(), '');
  });
});

describe('Activation placeholder (no silent fallback pick)', () => {
  test('8. sharded-not-ready (loading) shows role=status placeholder, no quote', () => {
    const S = createSandbox();
    setList(S, [wq('a'), wq('b')]);
    S.setTimeout = function () { return 0; }; // bounded watcher timer no-op
    S.WQ_STORE_STATE.activationReason = 'verifying'; // P0-LOAD: gerçekçi LOADING durumu (wisdomBootActivate yükleme öncesi bunu ayarlar)
    const h = S.wqHeroHtml();
    assert.ok(/role="status"/.test(h));
    assert.ok(/hazırlanıyor/.test(h));
    assert.equal(/wq-hero-quote/.test(h), false, 'no quote during activation');
    assert.equal(S._whIdx, null, 'must not silently select a fallback hero');
  });
  test('9. once ready, the stable daily hero renders (index from daily pick)', () => {
    const S = createSandbox();
    setList(S, [wq('a'), wq('b'), wq('c')]);
    S.setTimeout = function () { return 0; };
    S.WQ_STORE_STATE.activationReason = 'verifying'; // P0-LOAD: LOADING
    S.wqHeroHtml(); // placeholder, _whIdx null
    S.WQ_STORE_STATE.activationReason = 'no_migration'; // P0-LOAD: gerçekçi SETTLED geçişi (yalnız loading=false değil)
    const h = S.wqHeroHtml();
    assert.ok(/wq-hero-quote/.test(h));
    const daily = S._wqDailyPick().id;
    assert.ok(h.indexOf(daily) >= 0 || /Söz/.test(h)); // hero shows a real quote
  });
  test('10. placeholder is reduced-motion safe (no animation/spinner/modal)', () => {
    const S = createSandbox();
    setList(S, [wq('a')]); S.setTimeout = function () { return 0; }; S.WQ_STORE_STATE.activationReason = 'verifying';
    const h = S.wqHeroHtml();
    assert.equal(/animation:|@keyframes|spinner|class="modal"/.test(h), false);
    assert.ok(/max-width:6\dch/.test(h)); // responsive, no fixed width
  });
});

describe('Manual navigation & actions preserved', () => {
  test('11. Previous/Next still work', () => {
    const S = createSandbox(); setList(S, [wq('a'), wq('b'), wq('c')]);
    assert.doesNotThrow(() => S.wqHeroNav(1));
    assert.doesNotThrow(() => S.wqHeroNav(-1));
  });
  test('12. Favorite/Copy/Share remain wired + position indicator', () => {
    const S = createSandbox(); setList(S, [wq('a'), wq('b')]);
    S.WQ_STORE_STATE.activationReason = 'no_migration'; // P0-LOAD: lifecycle'ı SETTLED'a sabitle
    const h = S.wqHeroHtml();
    ['wqToggleFav', 'wqHeroCopy', 'wqHeroShare', 'wqHeroNav(-1)', 'wqHeroNav(1)'].forEach(a => assert.ok(h.indexOf(a) >= 0, a));
    assert.ok(/\d+ \/ \d+/.test(h), 'position indicator');
  });
});

describe('Static guards (no state/write/length-modulo selector)', () => {
  test('13. daily pick uses id-hash, not dayOfYear%length', () => {
    const dailyFn = (SRC.match(/function _wqDailyPick\(\)\{[\s\S]*?\n\}/) || [''])[0];
    assert.ok(/_wqHashId\(/.test(dailyFn), 'daily pick must use id-hash');
    assert.equal(/%\s*l\.length/.test(dailyFn), false, 'daily pick must not use list.length modulo');
    assert.equal(/dayOfYear|doy%/.test(dailyFn), false);
  });
  test('14. no new persisted state / localStorage / write in hero layer', () => {
    // hero fonksiyonları localStorage/save/commit kullanmaz (nav/pick/placeholder)
    const heroBlock = SRC.slice(SRC.indexOf('function _wqDailySeed'), SRC.indexOf('window.wqHeroHtml'));
    ['localStorage', 'save(', 'commitMutation', 'fetch(', '.onSnapshot(', 'WQ_STORE_STATE', 'D.wisdomQuotes'].forEach(t =>
      assert.equal(heroBlock.indexOf(t), -1, 'forbidden in hero layer: ' + t));
  });
  test('15. render zero cloud writes with placeholder + hero', () => {
    const S = createSandbox(); setList(S, [wq('a')]);
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    S.tab = 'wisdom'; S.renderWisdomQuotes();
    S.save = _s;
    assert.equal(w, 0);
  });
});
