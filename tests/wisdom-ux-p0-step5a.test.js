'use strict';
/* QUOTES-CONSOLIDATION-P1 Step 5A — P0 compact UX for the Wisdom Quotes screen:
   (1) display settings panel collapsible + collapsed by default,
   (2) only one (list) category filter visible on the screen (display-engine categories
       live inside the collapsed panel),
   (3) primary summary reduced to <=4 cards.
   No data/CRUD/ContentEngine/filtering-logic changes. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function seed(sbx) {
  sbx.D.wisdomQuotes = [
    { id: 'w1', quote: 'Q one', author: 'A', category: 'Odak', active: true, favorite: true, pinned: true, reflected: true, showCount: 3 },
    { id: 'w2', quote: 'Q two', author: 'B', category: 'Disiplin', active: true, favorite: false, pinned: false, reflected: false, showCount: 0 },
    { id: 'w3', quote: 'Q three', author: 'C', category: 'Odak', active: false, favorite: false, pinned: false, reflected: false, showCount: 0 }
  ];
}
function panelHtml(sbx) { return sbx.wisdomDisplayPanelHtml(); }
function screenHtml(sbx) {
  sbx.tab = 'wisdom';
  sbx.renderWisdomQuotes();
  const el = sbx.__getElements()['pinner'];
  return el ? el.innerHTML : '';
}

describe('Display settings panel — collapsible', () => {
  test('1. panel is collapsed by default (<details> without open)', () => {
    const sbx = createSandbox(); seed(sbx);
    const h = panelHtml(sbx);
    assert.ok(/<details/i.test(h), 'panel is not a <details> element');
    assert.equal(/<details[^>]*\bopen\b/i.test(h), false, 'panel is open by default');
  });
  test('2. panel uses a <summary> header (native expand/collapse control)', () => {
    const sbx = createSandbox(); seed(sbx);
    assert.ok(/<summary/i.test(panelHtml(sbx)));
  });
  test('3. collapse/expand is native (no JS toggle, no save/sync/write in the panel markup)', () => {
    const sbx = createSandbox(); seed(sbx);
    const h = stripComments(panelHtml(sbx));
    // the summary/details wrapper must not wire save/sync/write to open/close
    assert.equal(/<summary[^>]*onclick/i.test(h), false);
    assert.equal(/ontoggle/i.test(h), false);
  });
  test('4. all existing display settings remain inside the panel', () => {
    const sbx = createSandbox(); seed(sbx);
    const h = panelHtml(sbx);
    assert.ok(h.indexOf('Sıklık') >= 0, 'frequency control missing');
    assert.ok(/wdSet\(/.test(h), 'display setting setters missing');
    assert.ok(/wdToggleCat\(/.test(h), 'display-engine category controls missing');
    assert.ok(/wdToggleLang\(/.test(h), 'language controls missing');
    assert.ok(h.indexOf('Toplam gösterim') >= 0, 'secondary display stats missing');
  });
  test('5. wisdom display setters still functional (no logic change)', () => {
    const sbx = createSandbox(); seed(sbx);
    assert.equal(typeof sbx.wdSet, 'function');
    assert.equal(typeof sbx.wdToggleCat, 'function');
    assert.equal(typeof sbx.wdToggleLang, 'function');
  });
  test('6. Principles panel untouched (not shared — 11f unchanged)', () => {
    const { execSync } = require('node:child_process');
    const diff = execSync('git diff --stat -- js/11f-principles-display.js public/js/11f-principles-display.js',
      { cwd: ROOT }).toString();
    assert.equal(diff.trim(), '', '11f should not be modified');
    // Principles panel is a separate function in 11f (not the wisdom one we changed)
    assert.ok(/function principleDisplayPanelHtml\(/.test(readSrc('js/11f-principles-display.js')));
  });
});

describe('Category filter simplification', () => {
  test('7. display-engine category controls live inside the collapsed <details> panel', () => {
    const sbx = createSandbox(); seed(sbx);
    const h = panelHtml(sbx);
    // categories in the panel are wdToggleCat (display engine), inside the details element
    assert.ok(/<details[\s\S]*wdToggleCat\([\s\S]*<\/details>/i.test(h));
  });
  test('8. the list category filter is the screen-level one (wqSetCat), shown once', () => {
    const sbx = createSandbox(); seed(sbx);
    const screen = screenHtml(sbx);
    assert.ok(/wqSetCat\(/.test(screen), 'list category filter missing');
    // list filter and display-engine filter are distinct handlers (not merged)
    assert.ok(/wdToggleCat\(/.test(screen), 'display-engine categories should still exist inside panel');
  });
  test('9. list category filter does not touch display-engine settings', () => {
    const sbx = createSandbox(); seed(sbx);
    const before = JSON.stringify(sbx.wsGet().selectedCategories || []);
    sbx.wqSetCat('Odak'); // list filter
    assert.equal(JSON.stringify(sbx.wsGet().selectedCategories || []), before);
    assert.equal(sbx.wqCat, 'Odak');
  });
  test('10. display-engine category toggle does not change the list filter', () => {
    const sbx = createSandbox(); seed(sbx);
    const listBefore = sbx.wqCat;
    sbx.wdToggleCat('Disiplin');
    assert.equal(sbx.wqCat, listBefore);
    assert.ok((sbx.wsGet().selectedCategories || []).indexOf('Disiplin') >= 0);
  });
});

describe('Compact primary statistics', () => {
  test('11. main screen shows at most 4 primary summary cards', () => {
    const sbx = createSandbox(); seed(sbx);
    const screen = screenHtml(sbx);
    // count primary summary cards: the stat block uses min-width:90px cards
    const primaryCards = (screen.match(/min-width:90px/g) || []).length;
    assert.ok(primaryCards <= 4, 'more than 4 primary summary cards: ' + primaryCards);
    assert.equal(primaryCards, 4);
  });
  test('12. primary summary shows Total / Favorites / Active / Pinned (not Passive/Reflected)', () => {
    const sbx = createSandbox(); seed(sbx);
    const screen = screenHtml(sbx);
    // extract the primary stat block region (before the search input)
    const region = screen.split('wq_search')[0];
    ['Toplam', 'Favori', 'Aktif', 'Sabit'].forEach(l => assert.ok(region.indexOf('>' + l + '<') >= 0, 'missing primary stat: ' + l));
    assert.equal(region.indexOf('>Pasif<'), -1, 'Passive should not be a primary card');
    assert.equal(region.indexOf('>Beni düşündüren<'), -1, 'Reflected should not be a primary card');
  });
  test('13. statistics calculations unchanged (wqStats + wdStats)', () => {
    const sbx = createSandbox(); seed(sbx);
    const s = sbx.wqStats();
    assert.equal(s.total, 3);
    assert.equal(s.favorites, 1);
    assert.equal(s.active, 2);
    assert.equal(s.pinned, 1);
    assert.equal(s.passive, 1);   // still calculated, just not a primary card
    assert.equal(s.reflected, 1); // still calculated
    const w = sbx.wdStats();
    assert.equal(w.totalShows, 3);
    assert.equal(w.never, 2);
  });
  test('14. secondary display stats remain reachable inside the panel', () => {
    const sbx = createSandbox(); seed(sbx);
    const h = panelHtml(sbx);
    ['Toplam gösterim', 'Hiç gösterilmeyen', 'En çok', 'Favori oranı', 'Düşündüren oranı']
      .forEach(l => assert.ok(h.indexOf(l) >= 0, 'secondary stat missing from panel: ' + l));
  });
});

describe('Regression', () => {
  test('15. search + status filters still functional on the screen', () => {
    const sbx = createSandbox(); seed(sbx);
    const screen = screenHtml(sbx);
    assert.ok(/wqSetQuery\(/.test(screen));
    ['Tümü', 'Favoriler', 'Sabitlenenler', 'Aktif', 'Pasif', 'Beni düşündürenler']
      .forEach(l => assert.ok(screen.indexOf('>' + l + '<') >= 0, 'status filter missing: ' + l));
  });
  test('16. Wisdom Quotes CRUD helpers intact', () => {
    const sbx = createSandbox(); seed(sbx);
    ['wqFormSave', 'wqDelete', 'openWqForm', 'wqToggleFav', 'wqTogglePin'].forEach(fn =>
      assert.equal(typeof sbx[fn], 'function', 'missing ' + fn));
  });
});
