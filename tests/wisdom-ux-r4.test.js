'use strict';
/* SMART-GOALS Wisdom UX-R4 Part B — Minimal Cross-Module UX Audit (CONSERVATIVE).
   Kardeş operasyonel ekranlar (İlkelerim/Karar Günlüğü/shared display) READ-ONLY
   denetlendi; regresyon riski nedeniyle bu fazda KOD DEĞİŞİKLİĞİ YAPILMADI (audit
   raporda). Davranış/alan/aksiyon/validasyon/write-yolu korundu. Wisdom loading
   placeholder eklendi (Part A). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'A', category: 'Odak', active: true,
    favorite: false, pinned: false, reflected: false, showCount: 0, tags: [], language: 'tr' }, over || {});
}

describe('Sibling operational screens unchanged (conservative)', () => {
  test('1. Principles / Decision / shared-display source files NOT modified this phase', () => {
    const diff = execSync('git diff --stat -- js/11d-principles.js js/11f-principles-display.js js/11i-decision-journal.js js/11j-decision-journal-ui.js js/11e-content-display-core.js public/js/11d-principles.js public/js/11f-principles-display.js public/js/11i-decision-journal.js public/js/11j-decision-journal-ui.js public/js/11e-content-display-core.js', { cwd: ROOT }).toString();
    assert.equal(diff.trim(), '', 'sibling screens must remain byte-unchanged in UX-R4');
  });
  test('2. Principles behavior/actions intact', () => {
    const S = createSandbox();
    ['pList', 'normalizePrinciple', 'openPrincipleForm'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
  test('3. Decision Journal behavior/actions intact', () => {
    const S = createSandbox();
    ['decList', 'decisionById', 'djOpenDetail'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
  test('4. shared content-display adapter intact (11f/11e unchanged: test 1)', () => {
    const S = createSandbox();
    assert.equal(typeof S.wisdomDisplayPanelHtml, 'function');
  });
});

describe('Wisdom loading-state UX (Part A placeholder)', () => {
  test('5. calm non-blocking placeholder: role=status, explicit text, no spinner/modal/toast', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = [wq('a')]; S.wisdomStoreReset(); S._whIdx = null;
    S.setTimeout = function () { return 0; };
    S.WQ_STORE_STATE.loading = true;
    const h = S.wqHeroHtml();
    assert.ok(/role="status"/.test(h) && /aria-live/.test(h));
    assert.ok(/Bilgelik arşivi hazırlanıyor/.test(h));
    assert.equal(/spinner|class="modal"|wqToast|dw-ov/.test(h), false);
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped)); // no fixed width, responsive
  });
});

describe('Regression & guards (whole Wisdom area preserved)', () => {
  test('6. default reading screen still calm (hero + summary + tools collapsed)', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = [wq('a'), wq('b'), wq('c')]; S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
    S.wisdomStoreReset(); S.tab = 'wisdom'; S.renderWisdomQuotes();
    const h = S.__getElements()['pinner'].innerHTML;
    assert.ok(/Günün Bilgeliği/.test(h));
    assert.equal((h.match(/min-width:90px/g) || []).length, 0);
    assert.ok(/<details id="wisdom_tools"/.test(h) && !/<details id="wisdom_tools" open/.test(h));
    assert.ok(h.indexOf('Bilgi Koçu') >= 0 && h.indexOf('Bilgi Çalışma Alanı') >= 0); // P6 + P10 tools içinde
  });
  test('7. focus-visible + reduced-motion tokens still present', () => {
    const S = createSandbox();
    const style = S.wqUxStyleHtml();
    assert.ok(/:focus-visible/.test(style));
    assert.ok(/prefers-reduced-motion/.test(style));
  });
  test('8. zero cloud writes on full render', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = [wq('a')]; S.wisdomStoreReset();
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    S.tab = 'wisdom'; S.renderWisdomQuotes();
    S.save = _s;
    assert.equal(w, 0);
  });
});
