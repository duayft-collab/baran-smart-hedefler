'use strict';
/* QUOTES-CONSOLIDATION-P1 Step 5B — compact Wisdom Quote cards:
   default card = indicators + quote + author + primary actions (Favorite/Pin/Edit);
   secondary metadata (source/tags/notes/language/priority/updated/state) and secondary
   actions (Reflected/Active-Inactive/Delete) live inside a native <details>.
   No data/CRUD-logic/ContentEngine change; existing CRUD functions reused. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function cardHtml(sbx, quotes) {
  sbx.D.wisdomQuotes = quotes;
  sbx.wqQuery = ''; sbx.wqFilterMode = 'all'; sbx.wqCat = ''; sbx.wqLang = '';
  // P0-LOAD: bu test paketi wisdom sharding'den önce yazıldı — CLOUD/aktivasyon hiç
  // kurulmaz. Lifecycle'ı gerçekçi bir SETTLED durumuna sabitle (aksi halde yeni
  // RC-3 koruması "henüz ayarlanmadı" diyip iskelet gösterir, kart içeriği asla oluşmaz).
  sbx.WQ_STORE_STATE.activationReason = 'no_migration';
  sbx._wqRenderList();
  const el = sbx.__getElements()['wq_list'];
  return el ? el.innerHTML : '';
}
const FULL = {
  id: 'w1', quote: 'Görünür özlü söz', author: 'Yazar A', category: 'Odak',
  active: true, favorite: true, pinned: true, reflected: true, priority: 4,
  language: 'en', source: 'Kitap X', tags: ['odak', 'disiplin'], notes: '', updatedAt: '2026-07-25T10:00:00.000Z'
};

describe('Card structure', () => {
  test('1-3. quote, author, category always visible', () => {
    const h = cardHtml(createSandbox(), [FULL]);
    assert.ok(h.indexOf('Görünür özlü söz') >= 0);
    assert.ok(h.indexOf('Yazar A') >= 0);
    assert.ok(h.indexOf('Odak') >= 0);
  });
  test('4-6. favorite / pinned / reflected indicators visible when active', () => {
    const h = cardHtml(createSandbox(), [FULL]);
    const head = h.split('<details')[0]; // indicators live before the details section
    assert.ok(head.indexOf('★') >= 0, 'favorite indicator missing');
    assert.ok(head.indexOf('Sabit') >= 0, 'pinned indicator missing');
    assert.ok(head.indexOf('💡') >= 0 || head.indexOf('Düşündürdü') >= 0, 'reflected indicator missing');
  });
  test('7. secondary metadata is inside a collapsed <details> by default', () => {
    const h = cardHtml(createSandbox(), [FULL]);
    assert.ok(/<details/i.test(h), 'no <details> in card');
    assert.equal(/<details[^>]*\bopen\b/i.test(h), false, 'details open by default');
    // source/tags live inside details, not in the always-visible head
    const head = h.split('<details')[0];
    assert.equal(head.indexOf('Kitap X'), -1, 'source should not be in the always-visible head');
    assert.equal(head.indexOf('#odak'), -1, 'tags should not be in the always-visible head');
  });
  test('8. secondary metadata present inside the details section', () => {
    const h = cardHtml(createSandbox(), [FULL]);
    const details = h.slice(h.indexOf('<details'));
    assert.ok(details.indexOf('Kitap X') >= 0, 'source missing from details');
    assert.ok(details.indexOf('#odak') >= 0, 'tags missing from details');
    assert.ok(details.indexOf('Güncellenme') >= 0, 'updated date missing from details');
  });
  test('9. expand/collapse is native (no save/sync/write wired to the card details)', () => {
    const h = cardHtml(createSandbox(), [FULL]);
    assert.equal(/<summary[^>]*onclick/i.test(h), false);
    assert.equal(/ontoggle/i.test(h), false);
  });
});

describe('Actions', () => {
  test('10-12. primary actions Favorite/Pin/Edit are in the always-visible head', () => {
    const h = cardHtml(createSandbox(), [FULL]);
    const head = h.split('<details')[0];
    assert.ok(/wqToggleFav\(/.test(head), 'favorite action not primary');
    assert.ok(/wqTogglePin\(/.test(head), 'pin action not primary');
    assert.ok(/openWqForm\(/.test(head), 'edit action not primary');
  });
  test('13-15. secondary actions Reflected/Active-Inactive/Delete are inside details', () => {
    const h = cardHtml(createSandbox(), [FULL]);
    const details = h.slice(h.indexOf('<details'));
    assert.ok(/wqToggleReflect\(/.test(details), 'reflected action not in details');
    assert.ok(/wqToggleActive\(/.test(details), 'active toggle not in details');
    assert.ok(/wqDelete\(/.test(details), 'delete not in details');
    // delete must NOT sit in the primary action row
    const head = h.split('<details')[0];
    assert.equal(/wqDelete\(/.test(head), false, 'delete must not be beside primary actions');
  });
  test('16. delete still requires confirmation (wqDelete uses confirm)', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(__dirname + '/../js/11a-wisdom-quotes.js', 'utf8');
    assert.ok(/function wqDelete\([^)]*\)\{[^}]*confirm\(/.test(src.replace(/\n/g, '')), 'wqDelete lost its confirm');
  });
  test('17. existing CRUD functions reused (no new write path)', () => {
    const sbx = createSandbox();
    ['wqToggleFav', 'wqTogglePin', 'wqToggleReflect', 'wqToggleActive', 'openWqForm', 'wqDelete']
      .forEach(fn => assert.equal(typeof sbx[fn], 'function', 'missing ' + fn));
  });
  test('18. each action wired exactly once per card (no duplicate write path)', () => {
    const h = cardHtml(createSandbox(), [FULL]);
    assert.equal((h.match(/wqToggleFav\(/g) || []).length, 1);
    assert.equal((h.match(/wqTogglePin\(/g) || []).length, 1);
    assert.equal((h.match(/wqDelete\(/g) || []).length, 1);
    assert.equal((h.match(/wqToggleActive\(/g) || []).length, 1);
    assert.equal((h.match(/wqToggleReflect\(/g) || []).length, 1);
  });
});

describe('Long content', () => {
  test('19. long quote remains fully readable (not clamped)', () => {
    const long = 'Uzun '.repeat(60).trim();
    const h = cardHtml(createSandbox(), [{ id: 'l1', quote: long, author: 'X', category: 'Odak', active: true }]);
    assert.ok(h.indexOf(long) >= 0, 'long quote content was truncated');
    assert.equal(/note-clamp|line-clamp|-webkit-line-clamp/.test(h), false, 'a fixed clamp was applied');
  });
  test('20. HTML-sensitive quote content stays escaped', () => {
    const h = cardHtml(createSandbox(), [{ id: 'x', quote: '<script>alert(1)</script>', author: '<b>a</b>', category: 'Odak', active: true }]);
    assert.equal(h.indexOf('<script>alert(1)</script>'), -1);
    assert.ok(h.indexOf('&lt;script&gt;') >= 0);
  });
  test('22. no separate show-more control for the quote text (quote always full)', () => {
    const h = cardHtml(createSandbox(), [{ id: 's', quote: 'Kısa söz', author: 'A', category: 'Odak', active: true }]);
    assert.equal(/Devamını göster|Show more|Daha fazla/.test(h), false);
  });
});

describe('Regression (screen still wired)', () => {
  test('23-25. search + status + category filters still on the screen', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [FULL];
    sbx.tab = 'wisdom'; sbx.renderWisdomQuotes();
    const screen = sbx.__getElements()['pinner'].innerHTML;
    assert.ok(/wqSetQuery\(/.test(screen));
    assert.ok(/wqSetFilter\(/.test(screen));
    assert.ok(/wqSetCat\(/.test(screen));
  });
  test('27-28. display panel collapsed + primary summary present (UX-R1.5: typographic, no cards)', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [FULL];
    sbx.tab = 'wisdom'; sbx.renderWisdomQuotes();
    const screen = sbx.__getElements()['pinner'].innerHTML;
    // UX-R1.5: kartlı 4-box → ince tipografik özet satırı (kutu yok)
    assert.equal((screen.match(/min-width:90px/g) || []).length, 0);
    const region = screen.split('wq_search')[0];
    ['söz', 'favori', 'aktif', 'sabit'].forEach(l => assert.ok(region.indexOf(l) >= 0, l));
    // UX-R8: gösterim ayar paneli (<details class="card">) komut-menüsü 'settings' destination'ında
    sbx.tab = 'wisdom'; sbx.wisdomGoDest('settings');
    assert.ok(/<details class="card"/.test(sbx.__getElements()['pinner'].innerHTML), 'display panel in settings dest');
    sbx.wisdomBackToReading();
  });
  test('29. dashboard quote still sources from wisdomQuotes', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [FULL];
    const r = sbx.rndQuote();
    assert.ok(r && r._source === 'wisdomQuotes');
  });
});
