'use strict';
/* QUOTES-CONSOLIDATION-P1 Step 4 — remove the legacy "Öz Sözler" UI + dead code, while
   keeping D.quotes as a hidden compatibility field for old backups + migration history.
   Nav/route/form/CRUD checks are static (those files aren't executed by the harness);
   compatibility checks run against the real modules in the sandbox. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const readCode = (rel) => stripComments(readSrc(rel));

describe('Navigation and route', () => {
  test('1. "Öz Sözler" is absent from navigation (NAV has no id:\'quotes\')', () => {
    const ui = readCode('js/08-ui-core.js');
    assert.equal(/id:'quotes'/.test(ui), false);
    assert.equal(ui.indexOf("l:'Öz Sözler'"), -1);
  });
  test('2. mobile navigation uses the same single NAV source (no separate legacy mobile menu)', () => {
    const ui = readSrc('js/08-ui-core.js');
    assert.equal((ui.match(/var NAV\s*=/g) || []).length, 1); // one nav definition, desktop+mobile share it
    assert.equal(/id:'quotes'/.test(stripComments(ui)), false);
  });
  test('3. "Özlü Sözler" (id:\'wisdom\') remains present', () => {
    const ui = readCode('js/08-ui-core.js');
    assert.ok(/id:'wisdom'/.test(ui));
    assert.ok(ui.indexOf("l:'Özlü Sözler'") >= 0);
  });
  test('4. legacy quotes route redirects to wisdom', () => {
    const boot = readCode('js/12-render-boot.js');
    const m = boot.match(/quotes:\s*function\s*\([^)]*\)\s*\{[^}]*\}/);
    assert.ok(m, 'no quotes route mapping found');
    assert.ok(/wisdom/.test(m[0]), 'quotes route does not redirect to wisdom');
  });
  test('5. legacy quotes route no longer renders the old generic screen', () => {
    const boot = readCode('js/12-render-boot.js');
    const m = boot.match(/quotes:\s*function\s*\([^)]*\)\s*\{[^}]*\}/);
    assert.equal(/renderGenericList\(['"]quotes['"]\)/.test(m[0]), false);
  });
});

describe('Rendering', () => {
  test('6. renderGenericList has no quotes config branch', () => {
    const g = readCode('js/09-goals.js');
    assert.equal(/quotes:\s*\{\s*t:\s*'Öz Sözler'/.test(g), false);
  });
  test('7. legacy "Anın Sözü" block is removed', () => {
    const g = readCode('js/09-goals.js');
    assert.equal(/type===['"]quotes['"]/.test(g), false);
    assert.equal(g.indexOf('Anin Sözu'), -1);
  });
  test('8. other generic lists still configured (journal/coaching/vault/questions)', () => {
    const g = readCode('js/09-goals.js');
    ['journal', 'coaching', 'vault', 'questions'].forEach(k => {
      assert.ok(new RegExp(k + ':\\s*\\{').test(g), 'generic list config lost: ' + k);
    });
  });
  test('9. dashboard quote still wired through wisdomQuotes adapter (rndQuote)', () => {
    const ui = readCode('js/08-ui-core.js');
    assert.ok(/rndQuote\(\)/.test(ui));
    assert.equal(/D\.quotes/.test(ui), false);
  });
});

describe('CRUD removal', () => {
  test('10. FDEFS has no quote form definition', () => {
    const ui = readCode('js/08-ui-core.js');
    assert.equal(/quote:\s*\['text:Söz/.test(ui), false);
  });
  test('11. FTITLES has no quote title', () => {
    const ui = readCode('js/08-ui-core.js');
    const m = ui.match(/var FTITLES\s*=\s*\{[^}]*\}/);
    assert.ok(m);
    assert.equal(/quote:/.test(m[0]), false);
  });
  test('12. submitForm km map has no quote entry (no legacy create path)', () => {
    const ui = readCode('js/08-ui-core.js');
    // any km map in this file must not contain quote:'quotes'
    assert.equal(/quote:\s*'quotes'/.test(ui), false);
  });
  test('13. no legacy quote update path exists (openForm/submit quote removed)', () => {
    const ui = readCode('js/08-ui-core.js');
    assert.equal(/openForm\(['"]quote['"]\)/.test(ui + readCode('js/09-goals.js')), false);
  });
  test('14. del km map has no quote entry (no legacy delete path)', () => {
    const sc = readCode('js/07-smart-coach.js');
    assert.equal(/quote:\s*'quotes'/.test(sc), false);
  });
  test('15. Wisdom Quotes CRUD remains functional (create + delete)', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [];
    const rec = sbx.normalizeWisdomQuote({ id: 'wq-x', quote: 'hello', author: 'A' }, 0);
    sbx.D.wisdomQuotes.push(rec);
    assert.equal(sbx.wqList().length, 1);
    assert.ok(sbx.wqById('wq-x'));
    sbx.D.wisdomQuotes = sbx.wqList().filter(w => String(w.id) !== 'wq-x');
    assert.equal(sbx.wqList().length, 0);
  });
});

describe('Compatibility (D.quotes preserved as hidden field)', () => {
  function oldPayload(quotes) {
    return { goals: [], todos: [], habits: [], quotes: quotes || [], kpis: [], journal: [],
      wisdomQuotes: [], principles: [], generalNotes: [], relations: [], decisions: [], logs: [] };
  }
  test('16. D.quotes remains available in state', () => {
    const sbx = createSandbox();
    assert.ok(Array.isArray(sbx.D.quotes));
    assert.ok(sbx.D.quotes.length > 0); // INIT seeds preserved
  });
  test('17. migration dry-run still returns zero-write when already migrated', () => {
    const sbx = createSandbox();
    // simulate a completed migration: wisdomQuotes already holds every ozs-<id> record
    sbx.D.wisdomQuotes = sbx.D.quotes.map(q => sbx.migBuildRecord(q, '2020-01-01T00:00:00.000Z')).filter(Boolean);
    const dry = sbx.migDryRun();
    assert.equal(dry.addCount, 0);
    assert.equal(dry.duplicateCount, sbx.D.quotes.length);
  });
  test('18. backup countRecords still includes legacy quotes', () => {
    const sbx = createSandbox();
    const c = sbx.countRecords(oldPayload([{ id: 1 }, { id: 2 }, { id: 3 }]));
    assert.equal(c.quotes, 3);
  });
  test('19. DIFF_SCHEMA still compares legacy quotes', () => {
    const sbx = createSandbox();
    const hasQuotes = sbx.DIFF_SCHEMA.arrays.some(a => a.field === 'quotes');
    assert.ok(hasQuotes);
  });
  test('20. restore preview still displays legacy quote differences', () => {
    const sbx = createSandbox();
    const current = oldPayload([{ id: 1, text: 'a', author: 'x', cat: 'c' }]);
    const backup = oldPayload([]);
    const pv = sbx.buildRestorePreview(current, backup, { sourceRevision: 1, targetRevision: 0 });
    assert.ok(pv.perModule.quotes);
    assert.equal(pv.perModule.quotes.removed, 1);
  });
  test('21. old backup payload containing only quotes loads safely', () => {
    const sbx = createSandbox();
    const state = sbx.buildStateFromPayload({ quotes: [{ id: 9, text: 'legacy', author: 'me', cat: 'k' }] });
    assert.equal(state.quotes.length, 1);
    assert.equal(state.quotes[0].text, 'legacy');
    assert.ok(Array.isArray(state.wisdomQuotes)); // other collections still present
  });
});

describe('Static dead-code guard', () => {
  // Active UI files must not reintroduce legacy Quotes functionality. Compatibility-only
  // references (migration/backup/restore/state) live in a tightly-scoped allowlist.
  const PATTERNS = [
    /id:'quotes'/,
    /renderGenericList\(['"]quotes['"]\)/,
    /openForm\(['"]quote['"]\)/,
    /FTITLES[^\n]*quote:/,
    /quote:\s*\['text:Söz/,      // FDEFS.quote
    /quote:\s*'quotes'/          // km.quote (create/delete)
  ];
  // Files allowed to reference D.quotes for compatibility (documented).
  const DQUOTES_ALLOW = new Set([
    'js/11g-wisdom-migration.js', // migration compatibility
    'js/11c-wisdom-io.js'         // backup/io comment
  ]);
  test('22. no active UI file reintroduces legacy Quotes UI/CRUD', () => {
    const jsDir = path.join(ROOT, 'js');
    const offenders = [];
    for (const f of fs.readdirSync(jsDir)) {
      if (!f.endsWith('.js')) continue;
      const code = stripComments(fs.readFileSync(path.join(jsDir, f), 'utf8'));
      for (const p of PATTERNS) if (p.test(code)) offenders.push(f + ' :: ' + p);
    }
    assert.deepEqual(offenders, [], 'legacy Quotes UI leaked: ' + offenders.join(', '));
  });
  test('22b. D.quotes read only from documented compatibility files', () => {
    const jsDir = path.join(ROOT, 'js');
    const offenders = [];
    for (const f of fs.readdirSync(jsDir)) {
      if (!f.endsWith('.js')) continue;
      const rel = 'js/' + f;
      if (DQUOTES_ALLOW.has(rel)) continue;
      if (/D\.quotes/.test(stripComments(fs.readFileSync(path.join(jsDir, f), 'utf8')))) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], 'D.quotes leaked into: ' + offenders.join(', '));
  });
});
