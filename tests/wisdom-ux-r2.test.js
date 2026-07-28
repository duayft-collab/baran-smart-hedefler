'use strict';
/* SMART-GOALS Wisdom UX-R2 — Premium Reading Polish (PRESENTATION-ONLY).
   Responsive clamp tipografi + :focus-visible/hover + prefers-reduced-motion-korumalı
   ≤150ms prev/next geçişi + ≥36px dokunma hedefi. Yalnız 11a sunum; yeni işlev/veri/
   state/listener/write YOK. */
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
  S.tab = 'wisdom';
  S.renderWisdomQuotes();
  return S.__getElements()['pinner'].innerHTML;
}
function heroOf(S) {
  S.D.wisdomQuotes = [wq('a')];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
  return S.wqHeroHtml();
}

describe('Typography (responsive, hierarchy)', () => {
  test('1. quote uses responsive clamp() sizing', () => {
    const S = createSandbox();
    assert.ok(/font-size:clamp\(\d+px,[^,]+,\d+px\)/.test(heroOf(S)));
  });
  test('2. quote remains larger than author and metadata', () => {
    const S = createSandbox();
    const h = heroOf(S);
    const min = Number((h.match(/font-size:clamp\((\d+)px/) || [])[1] || 0);
    const author = Number((h.match(/font-size:(\d+)px;font-weight:600;color:var\(--blue\)/) || [])[1] || 99);
    const meta = Number((h.match(/font-size:(\d+(?:\.\d+)?)px;letter-spacing:\.22em/) || [])[1] || 99);
    assert.ok(min >= 18);
    assert.ok(author < min, 'author < quote');
    assert.ok(meta < author, 'metadata < author');
  });
  test('3. centered 60-70ch reading measure preserved', () => {
    const S = createSandbox();
    const h = heroOf(S);
    assert.ok(/max-width:6\dch/.test(h));
    assert.ok(/margin:[^;"]*auto/.test(h));
  });
});

describe('Motion (subtle, reduced-motion safe)', () => {
  test('4. single fade transition ≤150ms, opacity only', () => {
    const S = createSandbox();
    const style = S.wqUxStyleHtml();
    assert.ok(/@keyframes wqHeroFade\{from\{opacity:[.\d]+\}to\{opacity:1\}\}/.test(style), 'opacity-only fade');
    assert.ok(/animation:wqHeroFade 140ms/.test(style));
    // hiçbir süre >150ms olmamalı
    const durations = (style.match(/(\d+)ms/g) || []).map(x => Number(x.replace('ms', '')));
    durations.forEach(d => assert.ok(d <= 150, 'duration >150ms: ' + d));
  });
  test('5. prefers-reduced-motion disables motion', () => {
    const S = createSandbox();
    const style = S.wqUxStyleHtml();
    assert.ok(/@media \(prefers-reduced-motion: no-preference\)/.test(style));
    assert.ok(/@media \(prefers-reduced-motion: reduce\)\{\.wq-hero\{animation:none\}\}/.test(style));
  });
  test('6. no animation elsewhere (only .wq-hero animates)', () => {
    const S = createSandbox();
    const style = S.wqUxStyleHtml();
    const anims = style.match(/animation:/g) || [];
    // biri wq-hero fade, biri reduce'da none → 2 animation bildirimi, ikisi de .wq-hero
    assert.ok(anims.length <= 2);
    assert.equal(/animation:[^;]*wqHeroFade/.test(style.replace(/\.wq-hero\{animation:wqHeroFade[^}]*\}/, '')), false);
  });
});

describe('Interaction quality (focus-visible, touch targets, hover)', () => {
  test('7. :focus-visible styling exists on hero buttons', () => {
    const S = createSandbox();
    assert.ok(/\.wq-hero-btn:focus-visible\{outline:[^}]+\}/.test(S.wqUxStyleHtml()));
  });
  test('8. restrained hover feedback (no keyboard focus ring removed)', () => {
    const S = createSandbox();
    const style = S.wqUxStyleHtml();
    assert.ok(/\.wq-hero-btn:hover\{background:/.test(style));
    assert.equal(/outline:\s*(none|0)/.test(style), false, 'must not remove focus ring');
  });
  test('9. touch targets ≥36px', () => {
    const S = createSandbox();
    const h = heroOf(S);
    assert.ok(/min-height:36px/.test(S.wqUxStyleHtml()));
    // ikon butonları 36px
    assert.ok(/width:36px;height:36px/.test(h));
  });
  test('10. all aria-labels preserved', () => {
    const S = createSandbox();
    const h = heroOf(S);
    ['Önceki söz', 'Sonraki söz', 'Favori', 'Kopyala', 'Paylaş'].forEach(a => assert.ok(h.indexOf('aria-label="' + a + '"') >= 0, a));
  });
  test('11. style block injected once on screen render', () => {
    const S = createSandbox();
    const h = screenOf(S);
    assert.equal((h.match(/id="wq-ux-style"/g) || []).length, 1);
  });
});

describe('Reading comfort (long quotes, no clipping/overflow)', () => {
  test('12. long quote: no fixed height, no truncation, word-break wraps', () => {
    const S = createSandbox();
    S.D.wisdomQuotes = [wq('long', { quote: 'Bu çok uzun bir söz. '.repeat(40) })];
    S.wisdomStoreReset();
    const h = S.wqHeroHtml();
    const qStyle = (h.match(/class="wq-hero-quote" style="([^"]*)"/) || [])[1] || '';
    assert.ok(qStyle, 'quote element present');
    assert.equal(/height:\s*\d+px/.test(qStyle), false, 'no fixed height on quote');
    assert.equal(/text-overflow:\s*ellipsis/.test(qStyle), false, 'no truncation');
    assert.equal(/(-webkit-line-clamp|overflow:\s*hidden)/.test(qStyle), false);
    assert.ok(/word-break:break-word/.test(qStyle));
    assert.ok(h.indexOf('Bu çok uzun bir söz.') >= 0); // tam metin, kırpma yok
  });
  test('13. responsive: no fixed large px width (ch/clamp based)', () => {
    const S = createSandbox();
    const stripped = heroOf(S).replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{3,}px/.test(stripped)); // sabit büyük genişlik yok
  });
});

describe('Color restraint & contrast', () => {
  test('14. single accent (blue) in default hero; neutral metadata tokens', () => {
    const S = createSandbox();
    const h = heroOf(S);
    // yazar accent var(--blue); yok gradient/rainbow
    assert.ok(/color:var\(--blue\)/.test(h));
    assert.equal(/linear-gradient|rainbow/.test(h), false);
    // metadata design-system token'ları (hardcoded düşük-kontrast hex yok)
    assert.equal(/color:#[0-9a-fA-F]{3,6}/.test(h), false, 'no hardcoded colors in hero');
  });
});

describe('Regression & guards', () => {
  test('15. borderless hero + typographic summary + tools collapsed preserved', () => {
    const S = createSandbox();
    const h = screenOf(S);
    assert.equal(/id="wisdom_hero"[^>]*border:/.test(h), false); // borderless
    assert.equal((h.match(/min-width:90px/g) || []).length, 0); // no stat cards
    assert.ok(/<details id="wisdom_tools"/.test(h) && !/<details id="wisdom_tools" open/.test(h));
    assert.ok(h.indexOf('Bilgi Koçu') >= 0); // P6–P12 content still present
  });
  test('16. render performs zero cloud writes', () => {
    const S = createSandbox();
    let writes = 0; const _s = S.save; S.save = function () { writes++; return _s && _s.apply(this, arguments); };
    screenOf(S);
    S.save = _s;
    assert.equal(writes, 0);
  });
  test('17. no new state/listener/network in the polish layer', () => {
    const fs = require('fs'); const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', '11a-wisdom-quotes.js'), 'utf8');
    // yeni listener/network/AI yok (UX katmanı sunum)
    assert.equal(/addEventListener\s*\(\s*['"]scroll/.test(src), false);
    ['fetch(', 'XMLHttpRequest', 'WebSocket', '.onSnapshot('].forEach(t => assert.equal(src.indexOf(t), -1, t));
  });
});
