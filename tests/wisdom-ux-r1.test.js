'use strict';
/* SMART-GOALS Wisdom UX-R1 — Minimalist Experience & Information Architecture.
   Varsayılan ekran sakin: üstte "Günün Bilgeliği" hero (birincil odak) + kompakt
   özet + arama/filtre + kütüphane. Ağır analitik/araç panelleri (P4–P12) tek
   katlanabilir "Araçlar ve İçgörüler" bölümünde, varsayılan KAPALI. İçerik DOM'da
   kalır (işlev + regresyon korunur). Yeni veri/işlev/motor YOK. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Yazar ' + id, category: 'Odak', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], priority: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null }, over || {});
}
function screen(S, quotes) {
  S.D.wisdomQuotes = quotes || [wq('a'), wq('b'), wq('c')];
  S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  S.tab = 'wisdom';
  S.renderWisdomQuotes();
  return S.__getElements()['pinner'].innerHTML;
}

describe('Calm reading hero (primary focus)', () => {
  test('1. Günün Bilgeliği hero present with quote + author + actions', () => {
    const S = createSandbox();
    const h = screen(S, [wq('a', { quote: 'Odaklan ve devam et', author: 'X' })]);
    assert.ok(/Günün Bilgeliği/.test(h));
    assert.ok(/Odaklan ve devam et/.test(h));
    assert.ok(/wqHeroNav\(-1\)/.test(h) && /wqHeroNav\(1\)/.test(h)); // önceki/sonraki
    assert.ok(/wqToggleFav/.test(h)); // favori
    assert.ok(/wqHeroCopy/.test(h)); // kopyala
    assert.ok(/wqHeroShare/.test(h)); // paylaş
  });
  test('2. hero appears before the search input (top of screen)', () => {
    const S = createSandbox();
    const h = screen(S);
    assert.ok(h.indexOf('Günün Bilgeliği') >= 0);
    assert.ok(h.indexOf('Günün Bilgeliği') < h.indexOf('wq_search'), 'hero must precede search');
  });
  test('3. hero pick deterministic; nav wraps without throwing', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = [wq('a'), wq('b')]; S.wisdomStoreReset();
    const p1 = S.wqHeroHtml(), p2 = S.wqHeroHtml();
    assert.equal(p1, p2);
    assert.doesNotThrow(() => S.wqHeroNav(1));
    assert.doesNotThrow(() => S.wqHeroNav(-1));
  });
  test('4. hero accessibility: aria-labels on nav/actions', () => {
    const S = createSandbox();
    const h = screen(S);
    assert.ok(/aria-label="Önceki söz"/.test(h));
    assert.ok(/aria-label="Sonraki söz"/.test(h));
    assert.ok(/aria-label="Favori"/.test(h));
  });
  test('5. empty library → no hero, no crash', () => {
    const S = createSandbox();
    const h = screen(S, []);
    assert.equal(/Günün Bilgeliği/.test(h), false);
  });
});

describe('Secondary tools collapsed by default', () => {
  test('6. heavy panels live inside a collapsed <details id="wisdom_tools">', () => {
    const S = createSandbox();
    const h = screen(S);
    assert.ok(/<details id="wisdom_tools"/.test(h));
    // varsayılan KAPALI (open yok)
    assert.equal(/<details id="wisdom_tools" open/.test(h), false, 'tools must be collapsed by default');
    assert.ok(/Araçlar, Analitik ve İçgörüler/.test(h));
  });
  test('7. tools appear AFTER search (not dominating the top)', () => {
    const S = createSandbox();
    const h = screen(S);
    assert.ok(h.indexOf('wisdom_tools') > h.indexOf('wq_search'), 'tools must follow search');
    // ağır paneller aramadan sonra
    assert.ok(h.indexOf('Bilgi Çalışma Alanı') > h.indexOf('wq_search'));
  });
  test('8. panel content still present in DOM (functionality preserved)', () => {
    const S = createSandbox();
    const h = screen(S);
    ['Bilgi Çalışma Alanı', 'Bilgi Koçu', 'Yönetici İçgörü Merkezi', 'Yönetici İncelemesi', 'Bilgi Merkezi']
      .forEach(sec => assert.ok(h.indexOf(sec) >= 0, 'missing (should be inside tools): ' + sec));
  });
  test('9. open state persists across re-render via WISDOM_TOOLS_OPEN', () => {
    const S = createSandbox();
    screen(S);
    S.window.WISDOM_TOOLS_OPEN = true; // kullanıcı açtı
    S.renderWisdomQuotes();
    const h = S.__getElements()['pinner'].innerHTML;
    assert.ok(/<details id="wisdom_tools" open/.test(h), 'open state must survive re-render');
    // ontoggle senkron kancası mevcut
    assert.ok(/ontoggle="window\.WISDOM_TOOLS_OPEN=this\.open"/.test(h));
  });
});

describe('Information hierarchy & compact summary', () => {
  test('10. compact typographic summary before search (UX-R1.5: no dashboard cards)', () => {
    const S = createSandbox();
    const h = screen(S);
    assert.equal((h.match(/min-width:90px/g) || []).length, 0); // kartlı 4-box kaldırıldı
    const region = h.split('wq_search')[0];
    ['söz', 'favori', 'aktif', 'sabit'].forEach(l => assert.ok(region.indexOf(l) >= 0, l));
  });
  test('11. before-search region does NOT contain heavy dashboards (calm default)', () => {
    const S = createSandbox();
    const region = screen(S).split('wq_search')[0];
    assert.equal(region.indexOf('Bilgi Çalışma Alanı'), -1);
    assert.equal(region.indexOf('Yönetici İçgörü Merkezi'), -1);
    assert.equal(region.indexOf('Bilgi Koçu'), -1);
  });
  test('12. search + status filters + list still functional', () => {
    const S = createSandbox();
    const h = screen(S);
    assert.ok(/wqSetQuery\(/.test(h));
    ['Tümü', 'Favoriler', 'Aktif'].forEach(l => assert.ok(h.indexOf('>' + l + '<') >= 0, l));
    assert.ok(/id="wq_list"/.test(h));
  });
});

describe('Zero-write / functionality preserved', () => {
  test('13. render performs no cloud writes (hero/tools are read-only)', () => {
    const S = createSandbox();
    let writes = 0; const _s = S.save; S.save = function () { writes++; return _s && _s.apply(this, arguments); };
    screen(S);
    S.wqHeroHtml(); S.wisdomToolsHtml();
    S.save = _s;
    assert.equal(writes, 0);
  });
  test('14. hero copy/share use clipboard/share only (no cloud, no crash)', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = [wq('a')]; S.wisdomStoreReset();
    assert.doesNotThrow(() => S.wqHeroCopy('a'));
    assert.doesNotThrow(() => S.wqHeroShare('a'));
  });
  test('15. CRUD + prior render pipeline intact', () => {
    const S = createSandbox();
    ['openWqForm', 'wqToggleFav', 'wqTogglePin', 'wqDelete', 'renderWisdomQuotes', 'wqHeroHtml', 'wisdomToolsHtml']
      .forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
});
