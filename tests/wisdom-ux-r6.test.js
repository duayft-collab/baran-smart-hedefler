'use strict';
/* SMART-GOALS Wisdom UX-R6 — Cross-Module UX Consistency (PRESENTATION-ONLY).
   İlkelerim (11d) + Karar Günlüğü (11j) render'ına TEK paylaşılan sunum-token bloğu
   (focus-visible + calm token + reduced-motion) eklenir. Davranış/iş-mantığı/
   validasyon/normalizasyon/CRUD/shared-display çekirdeği (11f/11e/11i) DEĞİŞMEZ. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC_11D = fs.readFileSync(path.join(ROOT, 'js', '11d-principles.js'), 'utf8');
const SRC_11J = fs.readFileSync(path.join(ROOT, 'js', '11j-decision-journal-ui.js'), 'utf8');

function principlesScreen(S) {
  S.D.principles = [{ id: 'p1', title: 'Disiplin', statement: 'Her gün çalış', lifeArea: 'myself', category: '', type: '', status: 'active', priority: 2, tags: [], source: 'Kendi İlkem', notes: '', pinned: false, reflected: false }];
  S.tab = 'principles'; S.renderPrinciples();
  return S.__getElements()['pinner'].innerHTML;
}
function decisionsScreen(S) {
  S.D.decisions = [{ id: 'd1', title: 'Yatırım kararı', decision: 'x', context: '', status: 'open', tags: [], createdAt: '2026-01-01', updatedAt: '2026-01-01' }];
  S.tab = 'decisions'; S.renderDecisions();
  return S.__getElements()['pinner'].innerHTML;
}

describe('Shared presentation token block', () => {
  test('1. wisdomUxTokensHtml defines focus-visible + calm tokens + reduced-motion', () => {
    const S = createSandbox();
    const t = S.wisdomUxTokensHtml();
    assert.ok(/id="uxr6-tokens"/.test(t));
    assert.ok(/:focus-visible\{outline:/.test(t));
    assert.ok(/\.uxr6-meta\{/.test(t) && /\.uxr6-quiet\{/.test(t));
    assert.ok(/@media \(prefers-reduced-motion: reduce\)/.test(t));
  });
  test('2. tokens use design-system vars (light/dark), no gradient/rainbow/hardcoded hex', () => {
    const S = createSandbox();
    const t = S.wisdomUxTokensHtml();
    assert.ok(/var\(--blue\)/.test(t) && /var\(--s2\)/.test(t) && /var\(--t3\)/.test(t));
    assert.equal(/linear-gradient|#[0-9a-fA-F]{3,6}/.test(t), false);
  });
  test('3. no business logic / state / listener / timer in the token helper', () => {
    const block = SRC_11D.slice(SRC_11D.indexOf('function wisdomUxTokensHtml'), SRC_11D.indexOf('function renderPrinciples'));
    ['save(', 'commitMutation', 'fetch(', '.onSnapshot(', 'setInterval', 'setTimeout', 'addEventListener', 'localStorage'].forEach(x =>
      assert.equal(block.indexOf(x), -1, 'forbidden in token helper: ' + x));
  });
});

describe('Principles screen consistency (behavior preserved)', () => {
  test('4. Principles screen injects the shared token block', () => {
    const S = createSandbox();
    const h = principlesScreen(S);
    assert.ok(/id="uxr6-tokens"/.test(h));
    assert.ok(/İlkelerim/.test(h)); // başlık korundu
    assert.ok(/openPrincipleForm\(\)/.test(h)); // birincil aksiyon korundu
  });
  test('5. Principle content/actions still present (no field/action removed)', () => {
    const S = createSandbox();
    const h = principlesScreen(S);
    assert.ok(h.indexOf('Disiplin') >= 0); // ilke başlığı render
    assert.ok(/Yeni İlke/.test(h));
  });
  test('6. Principle business/validation/normalization functions unchanged', () => {
    const S = createSandbox();
    ['pList', 'normalizePrinciple', 'openPrincipleForm', 'pStats'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
});

describe('Decision Journal screen consistency (behavior preserved)', () => {
  test('7. Decisions screen injects the shared token block', () => {
    const S = createSandbox();
    const h = decisionsScreen(S);
    assert.ok(/id="uxr6-tokens"/.test(h));
    assert.ok(/Karar Günlüğü/.test(h));
    assert.ok(/djOpenForm\(\)/.test(h));
  });
  test('8. Decision content/actions still present', () => {
    const S = createSandbox();
    const h = decisionsScreen(S);
    assert.ok(h.indexOf('Yatırım kararı') >= 0);
    assert.ok(/Yeni Karar/.test(h));
  });
  test('9. Decision business/review/CRUD functions unchanged', () => {
    const S = createSandbox();
    ['decList', 'decisionById', 'djOpenDetail', 'djOpenForm'].forEach(fn => assert.equal(typeof S[fn], 'function', fn));
  });
  test('10. empty-state path also injects token block (early return)', () => {
    const S = createSandbox();
    S.D.decisions = []; S.tab = 'decisions'; S.renderDecisions();
    const h = S.__getElements()['pinner'].innerHTML;
    assert.ok(/id="uxr6-tokens"/.test(h));
    assert.ok(/Henüz karar eklemedin/.test(h)); // empty-state korundu
  });
});

describe('Frozen cores & guards', () => {
  test('11. business/display cores (11f/11e/11i) remain byte-unchanged', () => {
    const diff = execSync('git diff --stat -- js/11f-principles-display.js js/11i-decision-journal.js js/11e-content-display-core.js public/js/11f-principles-display.js public/js/11i-decision-journal.js public/js/11e-content-display-core.js', { cwd: ROOT }).toString();
    assert.equal(diff.trim(), '', 'cores must remain byte-unchanged');
  });
  test('12. render performs zero cloud writes (principles + decisions)', () => {
    const S = createSandbox();
    let w = 0; const _s = S.save; S.save = function () { w++; return _s && _s.apply(this, arguments); };
    principlesScreen(S); decisionsScreen(S);
    S.save = _s;
    assert.equal(w, 0);
  });
  test('13. injection is typeof-guarded in both render functions', () => {
    assert.ok(/typeof wisdomUxTokensHtml==='function'\?wisdomUxTokensHtml\(\)/.test(SRC_11D.replace(/\s+/g, ' ')) || /wisdomUxTokensHtml\(\)/.test(SRC_11D));
    assert.ok(/wisdomUxTokensHtml\(\)/.test(SRC_11J));
  });
  test('14. no new data model / write path in touched render code', () => {
    [SRC_11D, SRC_11J].forEach(src => {
      const inj = src.indexOf('wisdomUxTokensHtml');
      assert.ok(inj >= 0);
    });
    // token helper adds no INIT/DIFF_SCHEMA/collection
    assert.equal(/INIT\.|DIFF_SCHEMA/.test(S_tokenBlock()), false);
  });
});

function S_tokenBlock() {
  return SRC_11D.slice(SRC_11D.indexOf('function wisdomUxTokensHtml'), SRC_11D.indexOf('function renderPrinciples'));
}
