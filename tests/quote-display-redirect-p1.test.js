'use strict';
/* QUOTES-CONSOLIDATION-P1 Step 3 — all runtime quote DISPLAY must source from D.wisdomQuotes,
   never legacy D.quotes. rndQuote/quoteWidget (01-state.js) are the single chokepoint; the
   dashboard had one inline D.quotes read (08-ui-core.js). Legacy CRUD list, migration source,
   and backup/diff support for D.quotes are intentionally preserved (Step 4 handles removal). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Strip block and line comments so the guard flags real code reads, not prose mentions.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const readCode = (rel) => stripComments(readSrc(rel));

// Seed a sandbox with a POISON legacy quote and known wisdom quotes, then exercise display fns.
function seed(sbx) {
  sbx.D.quotes = [{ id: 1, text: 'POISON_LEGACY_QUOTE', author: 'LegacyAuthor', cat: 'Odak' }];
  sbx.D.wisdomQuotes = [
    { id: 'w1', quote: 'Active wisdom one', author: 'Alpha', category: 'Odak', active: true },
    { id: 'w2', quote: 'Inactive wisdom', author: 'Beta', category: 'Odak', active: false },
    { id: 'w3', quote: 'Active no-cat', author: '', category: '', active: true }
  ];
}

describe('Adapter + source', () => {
  test('1. no active display helper reads D.quotes (source scan of 01-state.js)', () => {
    const src = readCode('js/01-state.js');
    // rndQuote/quoteWidget region must not literally read D.quotes anymore
    assert.equal(/D\.quotes/.test(src), false, '01-state.js still references D.quotes');
  });

  test('2. rndQuote sources from D.wisdomQuotes, never D.quotes poison', () => {
    const sbx = createSandbox();
    seed(sbx);
    for (let i = 0; i < 40; i++) {
      const r = sbx.rndQuote('Odak');
      assert.ok(r, 'rndQuote returned null with active wisdom present');
      assert.notEqual(r.text, 'POISON_LEGACY_QUOTE');
      assert.equal(r.text, 'Active wisdom one'); // only active + category match
    }
  });

  test('3. quoteWidget renders wisdom text, never the legacy poison', () => {
    const sbx = createSandbox();
    seed(sbx);
    const html = sbx.quoteWidget('Odak', 'var(--blue)');
    assert.ok(html.indexOf('Active wisdom one') >= 0);
    assert.equal(html.indexOf('POISON_LEGACY_QUOTE'), -1);
  });

  test('4. Dashboard no longer reads D.quotes (source scan of 08-ui-core.js)', () => {
    const src = readCode('js/08-ui-core.js');
    assert.equal(/D\.quotes/.test(src), false, '08-ui-core.js still references D.quotes');
    // and it still wires a quote via the chokepoint
    assert.ok(/rndQuote\(/.test(src), 'dashboard no longer calls rndQuote');
  });

  test('5. Legacy/backup/migration code may still read D.quotes (11g preserved)', () => {
    const mig = readCode('js/11g-wisdom-migration.js');
    assert.ok(/D\.quotes/.test(mig), 'migration source no longer reads D.quotes (should be preserved)');
  });
});

describe('Display behavior', () => {
  test('6. active wisdom quote renders', () => {
    const sbx = createSandbox();
    seed(sbx);
    assert.ok(sbx.getActiveWisdomQuotes().some(w => w.id === 'w1'));
    assert.ok(sbx.quoteWidget('Odak').length > 0);
  });

  test('7. inactive wisdom quote excluded', () => {
    const sbx = createSandbox();
    seed(sbx);
    const active = sbx.getActiveWisdomQuotes();
    assert.equal(active.some(w => w.id === 'w2'), false);
    for (let i = 0; i < 40; i++) {
      assert.notEqual(sbx.rndQuote('Odak').text, 'Inactive wisdom');
    }
  });

  test('8. missing author is safe', () => {
    const sbx = createSandbox();
    seed(sbx);
    sbx.D.wisdomQuotes = [{ id: 'w3', quote: 'No author here', category: 'Odak', active: true }];
    const r = sbx.rndQuote('Odak');
    assert.equal(r.author, '');
    assert.doesNotThrow(() => sbx.quoteWidget('Odak'));
    assert.ok(sbx.quoteWidget('Odak').indexOf('No author here') >= 0);
  });

  test('9. empty wisdomQuotes does not crash and does NOT fall back to D.quotes', () => {
    const sbx = createSandbox();
    sbx.D.quotes = [{ id: 1, text: 'POISON_LEGACY_QUOTE', author: 'x', cat: 'Odak' }];
    sbx.D.wisdomQuotes = [];
    assert.equal(sbx.rndQuote(), null);
    assert.equal(sbx.rndQuote('Odak'), null);
    assert.equal(sbx.quoteWidget('Odak'), ''); // neutral empty, no crash
    assert.equal(sbx.getActiveWisdomQuotes().length, 0);
  });

  test('10. HTML-sensitive content is escaped', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [{ id: 'x', quote: '<script>alert(1)</script>', author: '<b>a</b>', category: 'Odak', active: true }];
    const html = sbx.quoteWidget('Odak');
    assert.equal(html.indexOf('<script>alert(1)</script>'), -1);
    assert.ok(html.indexOf('&lt;script&gt;') >= 0);
  });

  test('11. rndQuote returns only a wisdom-sourced record', () => {
    const sbx = createSandbox();
    seed(sbx);
    const r = sbx.rndQuote('Odak');
    assert.equal(r._source, 'wisdomQuotes');
    assert.ok(sbx.D.wisdomQuotes.some(w => String(w.id) === String(r.id)));
  });

  test('12. existing quote widget markup remains compatible (italic quote + author line)', () => {
    const sbx = createSandbox();
    seed(sbx);
    const html = sbx.quoteWidget('Odak', 'var(--blue)');
    assert.ok(html.indexOf('font-style:italic') >= 0);   // same card structure
    assert.ok(html.indexOf('Alpha') >= 0);               // author rendered
  });
});

describe('Static guard', () => {
  // Active UI/display files must not read legacy D.quotes. Allowed only in documented
  // migration / backup-io locations.
  const ALLOWLIST = new Set([
    'js/11g-wisdom-migration.js', // MIGRATION SOURCE
    'js/11c-wisdom-io.js'         // BACKUP/IO (comment reference only)
  ]);
  test('13. no active display/UI file references D.quotes outside the documented allowlist', () => {
    const jsDir = path.join(ROOT, 'js');
    const offenders = [];
    for (const f of fs.readdirSync(jsDir)) {
      if (!f.endsWith('.js')) continue;
      const rel = 'js/' + f;
      if (ALLOWLIST.has(rel)) continue;
      if (/D\.quotes/.test(stripComments(fs.readFileSync(path.join(jsDir, f), 'utf8')))) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], 'D.quotes leaked into: ' + offenders.join(', '));
  });
});

describe('Screen wiring (call-site preserved through chokepoint)', () => {
  // Every screen still calls quoteWidget; the redirect is transitive through the single
  // wisdom-sourced chokepoint, so no per-screen D.quotes read remains.
  test('14. dashboard/goals/tasks/habits/routines/library/SMART/KPI/deepwork still call quoteWidget or rndQuote', () => {
    const ui = readCode('js/08-ui-core.js');
    const goals = readCode('js/09-goals.js');
    assert.ok(/rndQuote\(/.test(ui));               // dashboard
    assert.ok(/quoteWidget\(/.test(ui));            // KPI + goals list header
    assert.ok(/quoteWidget\(/.test(goals));         // tasks/habits/routines/library/SMART/deepwork
    // none of these read literal D.quotes
    assert.equal(/D\.quotes/.test(ui), false);
    assert.equal(/D\.quotes/.test(goals), false);
  });
});
