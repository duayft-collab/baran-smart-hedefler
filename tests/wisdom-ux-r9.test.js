'use strict';
/* SMART-GOALS Wisdom UX-R9 — Reading Mode + Command Navigation Polish.
   Distraction-free Reading Mode (module-local, no persistence), grouped command
   menu with full keyboard nav, shared destination header, typographic reading
   position indicator. Presentation+navigation only; 0 write/data/listener. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Y', category: 'Odak', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 1, tags: [], priority: 3,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', lastShownAt: null }, over || {});
}
function boot(S, quotes) {
  S.D.wisdomQuotes = quotes || [wq('a', { quote: 'liderlik' }), wq('b', { quote: 'satış' }), wq('c')];
  S.D.goals = [{ id: 1, title: 'liderlik', status: 'active' }]; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  S.tab = 'wisdom';
}
function pin(S) { return S.__getElements()['pinner'].innerHTML; }

describe('Reading position indicator (hero)', () => {
  test('1. typographic position indicator with accessible label + reading-mode entry', () => {
    const S = createSandbox(); boot(S);
    const h = S.wqHeroHtml();
    assert.ok(/role="status" aria-label="Okuma konumu"[^>]*>\d+ \/ \d+/.test(h));
    assert.ok(/wisdomEnterReading\(\)/.test(h)); // hero action row Reading Mode entry
    assert.equal(/progress|<progress/.test(h), false); // no progress bar
  });
});

describe('Distraction-free Reading Mode', () => {
  test('2. opens from hero AND from command menu destination', () => {
    const S = createSandbox(); boot(S);
    assert.ok(/wisdomEnterReading/.test(S.wqHeroHtml())); // hero entry
    assert.ok(S.WISDOM_DESTS.some(d => d[0] === 'readingmode')); // menu destination
    S.wisdomGoDest('readingmode');
    assert.ok(/Okuma Modundan Çık/.test(pin(S))); // reading mode active
  });
  test('3. reading mode hides search/library/summary; shows only quote + actions + exit', () => {
    const S = createSandbox(); boot(S);
    S.wisdomEnterReading();
    const h = pin(S);
    assert.ok(/wq-hero-quote/.test(h)); // quote
    ['wqHeroNav(-1)', 'wqHeroNav(1)', 'wqToggleFav', 'wqHeroCopy', 'wqHeroShare', 'wisdomExitReading'].forEach(a => assert.ok(h.indexOf(a) >= 0, a));
    assert.equal(/id="wq_search"/.test(h), false); // search hidden
    assert.equal(/id="wq_list"/.test(h), false); // library hidden
    assert.equal(/söz &middot;|söz ·/.test(h), false); // summary hidden
  });
  test('4. Esc exits reading mode; returns to reading screen', () => {
    const S = createSandbox(); boot(S);
    S.wisdomEnterReading();
    assert.ok(/wisdom_readmode/.test(pin(S)));
    S.wisdomReadingKey({ key: 'Escape' });
    const h = pin(S);
    assert.ok(/Günün Bilgeliği/.test(h) && /id="wq_search"/.test(h)); // back on reading screen
  });
  test('5. Previous/Next work in reading mode; no localStorage/cloud write', () => {
    const S = createSandbox(); boot(S);
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    S.wisdomEnterReading();
    assert.doesNotThrow(() => S.wqHeroNav(1));
    assert.doesNotThrow(() => S.wqHeroNav(-1));
    S.save = _s;
    assert.equal(w, 0);
    assert.equal(S.localStorage.getItem('wisdom_reading'), null); // no persistence
  });
  test('6. reading mode reduced-motion safe (wq-cmd fade, no fullscreen API)', () => {
    const S = createSandbox(); boot(S);
    S.wisdomEnterReading();
    const h = pin(S);
    assert.ok(/class="fade wq-cmd"/.test(h)); // reduced-motion covered by .wq-cmd rule
    assert.equal(/requestFullscreen|webkitRequestFullscreen/.test(h), false); // no fullscreen API
  });
});

describe('Command menu grouping + keyboard navigation', () => {
  test('7. destinations grouped under 3 quiet labels (labels not selectable)', () => {
    const S = createSandbox(); boot(S);
    S.wisdomOpenMenu();
    const h = pin(S);
    ['Okuma', 'Keşfet', 'Gelişmiş'].forEach(g => assert.ok(h.indexOf('>' + g + '<') >= 0, g));
    assert.equal((h.match(/role="presentation"/g) || []).length, 3); // group labels
    assert.equal((h.match(/role="menuitem"/g) || []).length, S.WISDOM_DESTS.length); // all dests selectable
  });
  test('8. open focuses first item; ArrowDown/Up/Home/End move active index', () => {
    const S = createSandbox(); boot(S);
    S.wisdomOpenMenu();
    assert.ok(/id="wisdom_menuitem_0"[^>]*aria-selected="true"/.test(pin(S)));
    S.wisdomMenuKey({ key: 'ArrowDown', preventDefault() {} });
    assert.ok(/id="wisdom_menuitem_1"[^>]*aria-selected="true"/.test(pin(S)));
    S.wisdomMenuKey({ key: 'Home', preventDefault() {} });
    assert.ok(/id="wisdom_menuitem_0"[^>]*aria-selected="true"/.test(pin(S)));
    S.wisdomMenuKey({ key: 'End', preventDefault() {} });
    const n = S.WISDOM_DESTS.length;
    assert.ok(new RegExp('id="wisdom_menuitem_' + (n - 1) + '"[^>]*aria-selected="true"').test(pin(S)));
    S.wisdomMenuKey({ key: 'ArrowUp', preventDefault() {} });
    assert.ok(new RegExp('id="wisdom_menuitem_' + (n - 2) + '"[^>]*aria-selected="true"').test(pin(S)));
  });
  test('9. Enter opens active destination; Escape closes menu', () => {
    const S = createSandbox(); boot(S);
    S.wisdomOpenMenu();
    // move to coach (find its flat index)
    const items = ['reading', 'readingmode', 'search', 'collections', 'coach'];
    for (let i = 0; i < items.length - 1; i++) S.wisdomMenuKey({ key: 'ArrowDown', preventDefault() {} });
    S.wisdomMenuKey({ key: 'Enter', preventDefault() {} });
    assert.ok(/Bilgi Koçu/.test(pin(S))); // coach destination opened
    // reopen + escape
    S.wisdomOpenMenu();
    S.wisdomMenuKey({ key: 'Escape' });
    assert.equal(/id="wisdom_cmd"/.test(pin(S)), false);
  });
  test('10. active menu item has visible focus outline + roving tabindex', () => {
    const S = createSandbox(); boot(S);
    S.wisdomOpenMenu();
    const h = pin(S);
    assert.ok(/id="wisdom_menuitem_0"[^>]*tabindex="0"/.test(h));
    assert.ok(/id="wisdom_menuitem_1"[^>]*tabindex="-1"/.test(h));
    assert.ok(/id="wisdom_menuitem_0"[^>]*outline:2px solid var\(--blue\)/.test(h));
  });
});

describe('Destination consistency', () => {
  test('11. shared calm header: title + description + single back', () => {
    const S = createSandbox(); boot(S);
    S.wisdomGoDest('coach');
    const h = pin(S);
    assert.ok(/Koç/.test(h)); // title
    assert.ok(/Bağlamsal öneriler/.test(h)); // one-line description
    assert.equal((h.match(/Okumaya Dön/g) || []).length, 1); // single back action
  });
  test('12. back preserves reading hero index and search query', () => {
    const S = createSandbox(); boot(S);
    S.renderWisdomQuotes();
    S.wqSetQuery ? S.wqSetQuery('lider') : (S.wqQuery = 'lider');
    S.wqHeroNav(1); const idxBefore = S._whIdx;
    S.wisdomGoDest('statistics'); // into a destination
    S.wisdomBackToReading();
    const h = pin(S);
    assert.equal(S._whIdx, idxBefore, 'hero index preserved');
    assert.ok(h.indexOf('lider') >= 0, 'search query preserved');
    assert.equal(/id="wisdom_cmd"/.test(h), false); // menu closed
  });
  test('13. all P4–P12 destinations remain reachable', () => {
    const cases = [['coach', 'Bilgi Koçu'], ['workspace', 'Bilgi Çalışma Alanı'], ['execreview', 'Yönetici İncelemesi'],
      ['execintel', 'Yönetici Brifingi'], ['knowledgeos', 'Kurumsal Bilgi Haritası'], ['settings', 'Yönetici İçgörü Merkezi']];
    cases.forEach(([d, m]) => { const S = createSandbox(); boot(S); S.wisdomGoDest(d); assert.ok(pin(S).indexOf(m) >= 0, d + '→' + m); });
  });
});

describe('Guards & regression', () => {
  test('14. default reading screen still minimal (no panels, menu entry present)', () => {
    const S = createSandbox(); boot(S);
    const h = (S.renderWisdomQuotes(), pin(S));
    assert.ok(/Günün Bilgeliği/.test(h) && /id="wq_list"/.test(h));
    assert.equal(/wisdom_tools/.test(h), false);
    assert.ok(/wisdomOpenMenu\(\)/.test(h));
    ['Bilgi Koçu', 'Bilgi Çalışma Alanı'].forEach(p => assert.equal(h.indexOf(p), -1));
  });
  test('15. no new persistent state / listener / network in nav+reading layer', () => {
    const fs = require('fs'); const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', '11a-wisdom-quotes.js'), 'utf8');
    const seg = src.slice(src.indexOf('function wisdomCommandMenuHtml'), src.indexOf('function renderWisdomDest'));
    ['localStorage', 'save(', 'commitMutation', 'fetch(', '.onSnapshot(', 'setInterval', 'addEventListener', 'requestFullscreen', 'WQ_STORE_STATE', 'D.wisdomQuotes']
      .forEach(t => assert.equal(seg.indexOf(t), -1, 'forbidden in nav/reading layer: ' + t));
  });
  test('16. file under 900 lines', () => {
    const fs = require('fs'); const path = require('path');
    assert.ok(fs.readFileSync(path.join(__dirname, '..', 'js', '11a-wisdom-quotes.js'), 'utf8').split('\n').length < 900);
  });
});
