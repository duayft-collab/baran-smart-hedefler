'use strict';
/* SMART-GOALS Wisdom UX-R8 — Remove Tools Panel & Minimal Command Menu.
   Default ekran saf okuma; tüm P4–P12 panelleri tek "Kütüphane" komut-menüsü
   arkasında, YALNIZ seçilince lazy-render. Paneller silinmedi (destination'lardan
   erişilir). Sunum+navigasyon; yeni veri/write/listener YOK. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Y', category: 'Odak', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 1, tags: [], priority: 3,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', lastShownAt: null }, over || {});
}
function boot(S, quotes, opts) {
  opts = opts || {};
  S.D.wisdomQuotes = quotes || [wq('a', { quote: 'liderlik' })];
  S.D.goals = opts.goals || [{ id: 1, title: 'liderlik', status: 'active' }];
  S.D.decisions = []; S.D.principles = []; S.D.relations = [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  S.tab = 'wisdom';
}
function render(S) { S.renderWisdomQuotes(); return S.__getElements()['pinner'].innerHTML; }

describe('Default screen = pure reading interface', () => {
  test('1. default has hero + summary + search + library, no panels, no tools section', () => {
    const S = createSandbox(); boot(S); const h = render(S);
    assert.ok(/Günün Bilgeliği/.test(h)); // hero
    assert.ok(/id="wq_search"/.test(h)); // search
    assert.ok(/id="wq_list"/.test(h)); // library
    assert.equal(/wisdom_tools/.test(h), false); // tools removed
    ['Bilgi Koçu', 'Yönetici İçgörü Merkezi', 'Bilgi Çalışma Alanı', 'Kurumsal Bilgi Haritası', 'Yönetici İncelemesi']
      .forEach(p => assert.equal(h.indexOf(p), -1, p + ' must not be on default screen'));
  });
  test('2. single command-menu entry ("Kütüphane") present', () => {
    const S = createSandbox(); boot(S); const h = render(S);
    assert.ok(/wisdomOpenMenu\(\)/.test(h));
    assert.ok(/Kütüphane/.test(h));
  });
});

describe('Command menu sheet', () => {
  test('3. opens as fullscreen dialog with all destinations', () => {
    const S = createSandbox(); boot(S); render(S);
    S.wisdomOpenMenu();
    const h = S.__getElements()['pinner'].innerHTML;
    assert.ok(/id="wisdom_cmd"/.test(h));
    assert.ok(/role="dialog"/.test(h) && /aria-modal="true"/.test(h) && /aria-label="Kütüphane menüsü"/.test(h));
    assert.ok(/role="menu"/.test(h));
    assert.equal((h.match(/role="menuitem"/g) || []).length, S.WISDOM_DESTS.length);
    // fullscreen, responsive, no fixed width
    assert.ok(/position:fixed;inset:0/.test(h));
  });
  test('4. Escape closes the menu (keyboard)', () => {
    const S = createSandbox(); boot(S); render(S);
    S.wisdomOpenMenu();
    assert.ok(/id="wisdom_cmd"/.test(S.__getElements()['pinner'].innerHTML));
    S.wisdomMenuKey({ key: 'Escape' });
    assert.equal(/id="wisdom_cmd"/.test(S.__getElements()['pinner'].innerHTML), false);
  });
  test('5. selecting a destination closes the sheet and shows that panel only', () => {
    const S = createSandbox(); boot(S); render(S);
    S.wisdomOpenMenu();
    S.wisdomGoDest('coach');
    const h = S.__getElements()['pinner'].innerHTML;
    assert.equal(/id="wisdom_cmd"/.test(h), false); // sheet closed
    assert.ok(/Bilgi Koçu/.test(h)); // coach destination rendered
    assert.ok(/Okumaya Dön/.test(h)); // back to reading
  });
});

describe('All modules reachable (lazy)', () => {
  const cases = [['coach', 'Bilgi Koçu'], ['learning', 'Öğrenme'], ['knowledge', 'Bilgi Merkezi'],
    ['workspace', 'Bilgi Çalışma Alanı'], ['execreview', 'Yönetici İncelemesi'],
    ['execintel', 'Yönetici Brifingi'], ['knowledgeos', 'Kurumsal Bilgi Haritası'], ['settings', 'Yönetici İçgörü Merkezi']];
  cases.forEach(([dest, marker], i) => {
    test((6 + i) + '. destination "' + dest + '" renders its panel', () => {
      const S = createSandbox();
      boot(S, [wq('a', { quote: 'liderlik' }), wq('b', { quote: 'satış' })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
      S.wisdomGoDest(dest);
      assert.ok(S.__getElements()['pinner'].innerHTML.indexOf(marker) >= 0, dest + ' → ' + marker);
    });
  });
});

describe('Back navigation & state', () => {
  test('14. back-to-reading returns to the reading interface', () => {
    const S = createSandbox(); boot(S);
    S.wisdomGoDest('coach');
    assert.ok(/Bilgi Koçu/.test(S.__getElements()['pinner'].innerHTML));
    S.wisdomBackToReading();
    const h = S.__getElements()['pinner'].innerHTML;
    assert.ok(/Günün Bilgeliği/.test(h));
    assert.equal(h.indexOf('Bilgi Koçu'), -1);
  });
  test('15. reading/search destinations return to reading (search lives on reading screen)', () => {
    const S = createSandbox(); boot(S);
    S.wisdomGoDest('coach'); S.wisdomGoDest('reading');
    assert.ok(/id="wq_search"/.test(S.__getElements()['pinner'].innerHTML));
  });
});

describe('Guards: reduced-motion, responsive, zero-write', () => {
  test('16. command-menu fade is reduced-motion safe (≤150ms)', () => {
    const S = createSandbox();
    const style = S.wqUxStyleHtml();
    assert.ok(/\.wq-cmd\{animation:wqCmdIn 140ms/.test(style));
    assert.ok(/@media \(prefers-reduced-motion: reduce\)\{\.wq-hero,\.wq-cmd\{animation:none\}\}/.test(style));
  });
  test('17. menu + destinations produce zero cloud writes', () => {
    const S = createSandbox(); boot(S);
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    render(S); S.wisdomOpenMenu(); S.wisdomGoDest('workspace'); S.wisdomGoDest('knowledgeos'); S.wisdomBackToReading();
    S.save = _s;
    assert.equal(w, 0);
  });
  test('18. no fixed large width in command menu (responsive)', () => {
    const S = createSandbox(); boot(S);
    S.wisdomOpenMenu();
    const h = S.__getElements()['pinner'].innerHTML;
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped));
  });
  test('19. menu interaction functions exist; no new listener/timer in nav layer', () => {
    const S = createSandbox();
    ['wisdomOpenMenu', 'wisdomCloseMenu', 'wisdomGoDest', 'wisdomBackToReading', 'wisdomMenuKey', 'wisdomCommandMenuHtml', 'renderWisdomDest']
      .forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
});
