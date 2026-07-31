'use strict';
/* SMART-GOALS Wisdom UX-R1.5 — Radical Simplification & Premium Information Architecture.
   Söz ürünün kendisidir: kitap-okuyucu hero (kartsız/kenarlıksız, 64ch merkezli okuma
   ölçüsü, büyük tipografi), dashboard kartları tipografiye çevrildi, ağır paneller katlı.
   Yalnız 11a sunum katmanı; yeni veri/işlev/motor YOK. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Yazar ' + id, category: 'Odak', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], priority: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null }, over || {});
}
function screenOf(S, quotes) {
  S.D.wisdomQuotes = quotes || [wq('a'), wq('b'), wq('c')];
  S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  S.WQ_STORE_STATE.activationReason = 'no_migration'; // P0-LOAD: lifecycle'ı SETTLED'a sabitle
  S.tab = 'wisdom';
  S.renderWisdomQuotes();
  return S.__getElements()['pinner'].innerHTML;
}
function heroOf(S, over) {
  S.D.wisdomQuotes = [wq('a', over)];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  S.WQ_STORE_STATE.activationReason = 'no_migration';
  return S.wqHeroHtml();
}

describe('Premium book-like hero (the quote is the product)', () => {
  test('1. hero is borderless — no card class/border (not a dashboard box)', () => {
    const S = createSandbox();
    const h = heroOf(S);
    assert.ok(/id="wisdom_hero"/.test(h));
    assert.equal(/id="wisdom_hero"[^>]*class="card"/.test(h), false, 'hero must not be a boxed card');
    assert.equal(/id="wisdom_hero"[^>]*border:/.test(h), false, 'hero must be borderless');
  });
  test('2. centered reading measure ~60-70ch', () => {
    const S = createSandbox();
    const h = heroOf(S);
    assert.ok(/max-width:6\dch/.test(h), 'hero should use a ch-based reading measure');
    assert.ok(/margin:[^;"]*auto/.test(h), 'hero should be horizontally centered');
  });
  test('3. large responsive quote typography dominates (clamp, larger than author)', () => {
    const S = createSandbox();
    const h = heroOf(S);
    // UX-R2: responsive clamp() sizing
    const m = h.match(/font-size:clamp\((\d+)px,[^,]+,(\d+)px\);line-height:1\.62/);
    assert.ok(m, 'quote should use clamp() responsive sizing');
    assert.ok(Number(m[1]) >= 18 && Number(m[2]) >= 24, 'quote clamp range: ' + (m && m[0]));
    const authorSize = Number((h.match(/font-size:(\d+)px;font-weight:600;color:var\(--blue\)/) || [])[1] || 99);
    assert.ok(authorSize < Number(m[1]), 'author must be smaller than quote min');
  });
  test('4. category shown as quiet text, not a pill, in the hero', () => {
    const S = createSandbox();
    const h = heroOf(S);
    assert.ok(/Günün Bilgeliği/.test(h));
    assert.ok(h.indexOf('Odak') >= 0);
    assert.equal(/class="pill"/.test(h), false, 'category must not be a pill in the hero');
  });
  test('5. hero actions present (prev/fav/copy/share/next) + aria-labels', () => {
    const S = createSandbox();
    const h = heroOf(S);
    ['wqHeroNav(-1)', 'wqToggleFav', 'wqHeroCopy', 'wqHeroShare', 'wqHeroNav(1)'].forEach(a => assert.ok(h.indexOf(a) >= 0, a));
    ['Önceki söz', 'Sonraki söz', 'Favori'].forEach(a => assert.ok(h.indexOf('aria-label="' + a + '"') >= 0, a));
  });
});

describe('Dashboard feeling removed', () => {
  test('6. no boxed stat cards (min-width:90px) anywhere on default screen', () => {
    const S = createSandbox();
    assert.equal((screenOf(S).match(/min-width:90px/g) || []).length, 0);
  });
  test('7. compact typographic summary line before search', () => {
    const S = createSandbox();
    const region = screenOf(S).split('wq_search')[0];
    ['söz', 'favori', 'aktif', 'sabit'].forEach(l => assert.ok(region.indexOf(l) >= 0, l));
  });
  test('8. before-search region has no heavy dashboards (calm, reading-first)', () => {
    const S = createSandbox();
    const region = screenOf(S).split('wq_search')[0];
    ['Bilgi Çalışma Alanı', 'Yönetici İçgörü Merkezi', 'Bilgi Koçu', 'Kurumsal Bilgi Haritası']
      .forEach(sec => assert.equal(region.indexOf(sec), -1, sec + ' should be collapsed/secondary'));
  });
  test('9. heavy panels not on default screen; reachable via command menu (UX-R8)', () => {
    const S = createSandbox();
    const h = screenOf(S);
    assert.equal(/wisdom_tools/.test(h), false); // tools section removed
    assert.ok(/wisdomOpenMenu\(\)/.test(h)); // menu entry present
    assert.equal(h.indexOf('Bilgi Koçu'), -1); // panel not on default reading screen
  });
});

describe('Reading hierarchy & functionality preserved', () => {
  test('10. hero precedes search (reading order)', () => {
    const S = createSandbox();
    const h = screenOf(S);
    assert.ok(h.indexOf('wisdom_hero') < h.indexOf('wq_search'));
    assert.ok(h.indexOf('Günün Bilgeliği') < h.indexOf('wq_search'));
  });
  test('11. search + status filters + library list intact', () => {
    const S = createSandbox();
    const h = screenOf(S);
    assert.ok(/wqSetQuery\(/.test(h));
    assert.ok(/id="wq_list"/.test(h));
    ['Tümü', 'Favoriler'].forEach(l => assert.ok(h.indexOf('>' + l + '<') >= 0, l));
  });
  test('12. responsive: no fixed large px width in hero (ch-based)', () => {
    const S = createSandbox();
    const h = heroOf(S);
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped));
  });
  test('13. render performs zero cloud writes', () => {
    const S = createSandbox();
    let writes = 0; const _s = S.save; S.save = function () { writes++; return _s && _s.apply(this, arguments); };
    screenOf(S);
    S.save = _s;
    assert.equal(writes, 0);
  });
  test('14. CRUD + hero + tools pipeline intact', () => {
    const S = createSandbox();
    ['openWqForm', 'wqToggleFav', 'wqDelete', 'wqHeroHtml', 'wisdomCommandMenuHtml', 'renderWisdomQuotes']
      .forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
  test('15. empty library → no hero, no crash', () => {
    const S = createSandbox();
    assert.equal(/Günün Bilgeliği/.test(screenOf(S, [])), false);
  });
});
