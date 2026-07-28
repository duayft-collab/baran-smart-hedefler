'use strict';
/* SMART-GOALS Wisdom R11 — Architecture Cleanup & V1.0 Stabilization.
   REFACTOR/STABILIZE faz: kullanıcı-perspektifinden davranış byte-birebir aynı.
   Bu test V1.0 kararlı yüzeyi KİLİTLER: ölü kod yok, tek render pipeline, tek back
   davranışı, tek komut-menüsü, entegrasyon gevşek bağlı, 0 write. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC_11A = fs.readFileSync(path.join(ROOT, 'js', '11a-wisdom-quotes.js'), 'utf8');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Y', category: 'Odak', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 1, tags: [], priority: 3,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', lastShownAt: null }, over || {});
}
function boot(S) {
  S.D.wisdomQuotes = [wq('a', { quote: 'liderlik' }), wq('b'), wq('c')];
  S.D.goals = []; S.D.decisions = []; S.D.principles = []; S.D.relations = [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  S.tab = 'wisdom';
}
function pin(S) { S.renderWisdomQuotes(); return S.__getElements()['pinner'].innerHTML; }

describe('No dead code / removed-feature symbols', () => {
  test('1. UX-R8-removed symbols fully gone (no lingering tools panel)', () => {
    assert.equal(/wisdomToolsHtml|WISDOM_TOOLS_OPEN/.test(SRC_11A), false);
  });
  test('2. no deprecated hero alias (renamed wqHero* in P6)', () => {
    // 11a must not define/reference the collided legacy name
    assert.equal(/function wisdomHeroHtml/.test(SRC_11A), false);
    assert.ok(/function wqHeroHtml/.test(SRC_11A));
  });
});

describe('Single clean render pipeline', () => {
  test('3. one entry renderWisdomQuotes routes to 3 modes (reading/dest/reading-mode)', () => {
    assert.equal((SRC_11A.match(/function renderWisdomQuotes\(/g) || []).length, 1);
    assert.ok(/_wisdomReading\)\{ renderWisdomReadingMode\(\); return; \}/.test(SRC_11A));
    assert.ok(/_wisdomDest\)\{ renderWisdomDest\(\); return; \}/.test(SRC_11A));
  });
  test('4. render output is deterministic/stable (same state → identical DOM)', () => {
    const S = createSandbox(); boot(S);
    assert.equal(pin(S), pin(S));
  });
  test('5. list render is a single dedicated path (#wq_list via _wqRenderList)', () => {
    assert.equal((SRC_11A.match(/function _wqRenderList\(/g) || []).length, 1);
    assert.ok(/id="wq_list"/.test(SRC_11A));
  });
});

describe('Single navigation philosophy', () => {
  test('6. one back behavior (wisdomBackToReading) + one command-menu entry', () => {
    assert.equal((SRC_11A.match(/function wisdomBackToReading\(/g) || []).length, 1);
    assert.equal((SRC_11A.match(/function wisdomOpenMenu\(/g) || []).length, 1);
    assert.equal((SRC_11A.match(/function wisdomCommandMenuHtml\(/g) || []).length, 1);
  });
  test('7. destinations single-sourced (WISDOM_DESTS 13 + WISDOM_DEST_GROUPS 3)', () => {
    const S = createSandbox(); boot(S);
    assert.equal(S.WISDOM_DESTS.length, 13);
    // groups cover exactly the destinations, no duplicates
    const S2 = createSandbox(); boot(S2); S2.wisdomOpenMenu();
    const h = S2.__getElements()['pinner'].innerHTML;
    assert.equal((h.match(/role="presentation"/g) || []).length, 3);
    assert.equal((h.match(/role="menuitem"/g) || []).length, 13);
  });
});

describe('Integration layer is decoupled (K1 lives in 13, not 11a)', () => {
  test('8. 11a code does not call the integration layer (doc comment may mention it)', () => {
    const code = SRC_11A.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); // yorumları soy
    assert.equal(/wiCardHtml\s*\(|wiRecommend\s*\(|wiCtxFrom/.test(code), false);
  });
});

describe('Behavior byte-identical (zero write / read-only presentation)', () => {
  test('9. all three render modes perform zero cloud writes', () => {
    const S = createSandbox(); boot(S);
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    pin(S);                       // reading
    S.wisdomGoDest('coach'); S.renderWisdomQuotes();   // destination
    S.wisdomBackToReading();
    S.wisdomEnterReading(); S.renderWisdomQuotes();    // reading mode
    S.wisdomExitReading();
    S.save = _s;
    assert.equal(w, 0);
  });
  test('10. core CRUD + render API intact (no functionality removed)', () => {
    const S = createSandbox();
    ['openWqForm', 'wqToggleFav', 'wqTogglePin', 'wqDelete', 'wqFormSave', 'renderWisdomQuotes',
     'wqHeroHtml', 'wisdomCommandMenuHtml', 'wisdomReadingModeHtml', 'normalizeWisdomQuote'].forEach(fn =>
      assert.equal(typeof S[fn], 'function', fn));
  });
});

describe('Documentation (V1.0 architecture map present)', () => {
  test('11. architecture doc block documents pipeline/nav/menu/hero/integration', () => {
    ['WISDOM V1.0 STABLE', 'RENDER PIPELINE', 'NAVİGASYON', 'KOMUT MENÜSÜ', 'HERO SEÇİMİ', 'ENTEGRASYON KATMANI', 'DOKUNULMAZ']
      .forEach(m => assert.ok(SRC_11A.indexOf(m) >= 0, 'missing doc: ' + m));
  });
});
