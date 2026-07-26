'use strict';
/* QUOTES-CONSOLIDATION-P1 Step 5E — Import Safety and Data-Quality Guards.
   Test-first. Covers:
   (A) pure, non-destructive Turkish text-quality validator during import preview,
   (B) mandatory verified `before_import` backup before destructive `replace` import,
   (C) CSV lossy / JSON lossless guidance,
   (D) regression protection for persistence, preview, duplicate detection, JSON/CSV.
   No production quote record is modified; no real cloud write happens (createBackup/save stubbed). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const IO_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', '11c-wisdom-io.js'), 'utf8');

/* Build a preview `stats` object from raw rows via the real analyzer, then park it in WQ_IMPORT. */
function primeImport(sbx, rows, fmt) {
  const stats = sbx.wqImportAnalyze(rows, fmt || 'json');
  sbx.WQ_IMPORT.stats = stats;
  return stats;
}
/* Instrument save/snap/createBackup so tests can observe mutation ordering without real IO. */
function instrument(sbx, backupImpl) {
  const calls = { save: 0, snap: 0, backup: [] };
  sbx.save = () => { calls.save++; };
  sbx.snap = () => { calls.snap++; };
  sbx.createBackup = async (reason, options) => {
    calls.backup.push({ reason, options, dLenAtCall: (sbx.D.wisdomQuotes || []).length });
    return backupImpl ? backupImpl(reason, options) : { id: 'bk-ok', reason };
  };
  return calls;
}

/* ─────────────────────────── A. Text Quality ─────────────────────────── */
describe('Turkish import text-quality validator', () => {
  test('1. valid Turkish text passes (no quality findings)', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Disiplin, özgürlüğün bedelidir.', 'tr');
    assert.equal(f.length, 0, 'clean Turkish must produce no findings: ' + JSON.stringify(f));
  });
  test('2. valid English text passes without a Turkish warning', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Discipline makes today hard but tomorrow easy.', 'en');
    assert.equal(f.some(x => x.code === 'POSSIBLE_TR_DIACRITIC_LOSS'), false,
      'English must not be flagged as Turkish diacritic loss');
  });
  test('2b. English with unspecified language still not flagged as TR loss', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Losers fear rejection. Winners fear regret.', '');
    assert.equal(f.some(x => x.code === 'POSSIBLE_TR_DIACRITIC_LOSS'), false);
  });
  test('3. Turkish ASCII-loss candidate produces POSSIBLE_TR_DIACRITIC_LOSS', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Baslangiclar gurus gerektirir; bitis kararliliik.', 'tr');
    assert.ok(f.some(x => x.code === 'POSSIBLE_TR_DIACRITIC_LOSS' && x.severity === 'warning'),
      'expected TR diacritic-loss warning: ' + JSON.stringify(f));
  });
  test('4. mixed Cyrillic character produces MIXED_ALPHABET', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Disiplin özgurluktur ве guventir.', 'tr'); // "ве" cyrillic
    assert.ok(f.some(x => x.code === 'MIXED_ALPHABET'), 'expected mixed-alphabet: ' + JSON.stringify(f));
  });
  test('5. mixed Arabic character produces MIXED_ALPHABET', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Sabir güzeldir ﷲ rahmet.', 'tr');
    assert.ok(f.some(x => x.code === 'MIXED_ALPHABET'), 'expected mixed-alphabet: ' + JSON.stringify(f));
  });
  test('6. Unicode replacement char blocks (error severity)', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Bozuk � metin', 'tr');
    assert.ok(f.some(x => x.code === 'UNICODE_REPLACEMENT_CHAR' && x.severity === 'error'));
  });
  test('7. forbidden control character blocks (error severity)', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Kontrolkarakter', 'tr');
    assert.ok(f.some(x => x.code === 'CONTROL_CHARACTER' && x.severity === 'error'));
  });
  test('8. repeated internal whitespace warns', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('Iki   bosluk arasi', 'tr');
    assert.ok(f.some(x => x.code === 'INTERNAL_WHITESPACE' && x.severity === 'warning'));
  });
  test('9. leading/trailing whitespace warns', () => {
    const s = createSandbox();
    const f = s.wqTextQuality('  kenar boslugu  ', 'tr');
    assert.ok(f.some(x => x.code === 'EDGE_WHITESPACE' && x.severity === 'warning'));
  });
  test('10. validator never rewrites the imported text', () => {
    const s = createSandbox();
    const raw = { quote: 'Baslangiclar gurus gerektirir', author: 'Anon', language: 'tr' };
    const res = s.wqValidateImportRow(raw, 1);
    assert.ok(res.quote, 'row should still be importable');
    assert.equal(res.quote.quote, 'Baslangiclar gurus gerektirir',
      'text must be preserved verbatim (only trim/clip by normalize), never auto-corrected');
  });
  test('10b. blocking finding routes to errors and skips the row', () => {
    const s = createSandbox();
    const res = s.wqValidateImportRow({ quote: 'x�y', language: 'tr' }, 1);
    assert.equal(res.quote, null, 'row with replacement char must not be applied');
    assert.ok(res.errors.some(e => e.code === 'UNICODE_REPLACEMENT_CHAR'));
  });
  test('10c. TR-loss warning surfaces in analyzer preview but still imports', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = [];
    const stats = s.wqImportAnalyze([{ quote: 'Baslangiclar gurus gerektirir', author: 'Anon', language: 'tr' }], 'json');
    assert.equal(stats.newCount, 1, 'the row must still be importable (non-blocking)');
    assert.ok(stats.warnings.some(w => w.code === 'POSSIBLE_TR_DIACRITIC_LOSS'), 'TR warning missing from preview');
    assert.ok(stats.trIssues >= 1, 'stats.trIssues should count the TR quality concern');
  });
});

/* ─────────────────────── B. Replace-mode backup ─────────────────────── */
describe('Replace-mode mandatory verified backup', () => {
  function primeReplace(s) {
    s.D.wisdomQuotes = [{ id: 'old1', quote: 'Eski söz', author: 'X', category: '', tags: [], language: 'tr', priority: 0, favorite: false, pinned: false, active: true, reflected: false, source: '', notes: '', createdAt: 'x', updatedAt: 'x', lastShownAt: null, showCount: 0 }];
    primeImport(s, [{ quote: 'Yeni söz', author: 'Y', language: 'tr' }], 'json');
  }
  test('11. replace creates a before_import backup BEFORE any mutation', async () => {
    const s = createSandbox();
    primeReplace(s);
    const calls = instrument(s);
    await s.wqImportApply('replace');
    assert.equal(calls.backup.length, 1, 'exactly one backup expected');
    assert.equal(calls.backup[0].reason, 'before_import');
    assert.equal(calls.backup[0].dLenAtCall, 1, 'library must still be intact (1) at backup time');
  });
  test('12. replace backup uses force:true and a label', async () => {
    const s = createSandbox();
    primeReplace(s);
    const calls = instrument(s);
    await s.wqImportApply('replace');
    assert.equal(calls.backup[0].options.force, true);
    assert.ok(String(calls.backup[0].options.label || '').length > 0, 'label required');
  });
  test('13. backup verification failure (skipped/no id) aborts — zero mutation, zero save', async () => {
    const s = createSandbox();
    primeReplace(s);
    const calls = instrument(s, () => ({ skipped: true }));
    const r = await s.wqImportApply('replace');
    assert.equal(s.D.wisdomQuotes.length, 1, 'library must be unchanged');
    assert.equal(s.D.wisdomQuotes[0].id, 'old1');
    assert.equal(calls.save, 0, 'no save on unverified backup');
    assert.ok(r && r.aborted, 'apply should report aborted');
  });
  test('14. backup creation failure (throw) aborts — zero mutation, zero save', async () => {
    const s = createSandbox();
    primeReplace(s);
    const calls = instrument(s, () => { throw new Error('network'); });
    const r = await s.wqImportApply('replace');
    assert.equal(s.D.wisdomQuotes.length, 1);
    assert.equal(calls.save, 0);
    assert.ok(r && r.aborted);
  });
  test('15. failed backup causes zero snap as well (no partial state)', async () => {
    const s = createSandbox();
    primeReplace(s);
    const calls = instrument(s, () => ({ id: null }));
    await s.wqImportApply('replace');
    assert.equal(calls.snap, 0, 'no snapshot taken when backup unverified');
    assert.equal(s.D.wisdomQuotes.length, 1);
  });
  test('16. successful replace performs exactly one save and swaps content', async () => {
    const s = createSandbox();
    primeReplace(s);
    const calls = instrument(s, () => ({ id: 'bk-1' }));
    await s.wqImportApply('replace');
    assert.equal(calls.save, 1, 'exactly one save cycle');
    assert.equal(s.D.wisdomQuotes.length, 1);
    assert.equal(s.D.wisdomQuotes[0].quote, 'Yeni söz', 'library replaced with imported content');
  });
  test('17. append (all) preserves existing behavior — save once, NO forced backup', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = [];
    primeImport(s, [{ quote: 'Ek söz', author: 'Z', language: 'tr' }], 'json');
    const calls = instrument(s);
    s.wqImportApply('all');
    assert.equal(calls.backup.length, 0, 'append must not force a persistent backup');
    assert.equal(calls.save, 1);
    assert.equal(s.D.wisdomQuotes.length, 1);
  });
  test('17b. append (skip) preserves existing behavior — save once, NO forced backup', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = [];
    primeImport(s, [{ quote: 'Atla söz', author: 'Z', language: 'tr' }], 'json');
    const calls = instrument(s);
    s.wqImportApply('skip');
    assert.equal(calls.backup.length, 0);
    assert.equal(calls.save, 1);
  });
});

/* ─────────────────────── Preview / duplicate / errors ─────────────────────── */
describe('Preview, duplicate detection, row errors intact', () => {
  test('18. import preview still renders with a quality summary', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = [];
    const stats = primeImport(s, [{ quote: 'Önizleme sözü', author: 'A', language: 'tr' }], 'json');
    s.wqImportShowPreview(stats, 'json');
    const modals = s.__getCapturedModals();
    assert.ok(modals.length >= 1, 'preview modal missing');
    const html = modals[modals.length - 1];
    assert.ok(/İçe Aktarma Önizleme/.test(html), 'preview title missing');
    assert.ok(/Yedek/i.test(html), 'replace backup notice should appear in preview');
  });
  test('19. existing duplicate detection remains intact', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = [];
    s.wqImportApply; // no-op ref
    s.D.wisdomQuotes = s.normalizeWisdomQuotes([{ quote: 'Tekrarli söz', author: 'A' }]);
    const stats = s.wqImportAnalyze([{ quote: 'Tekrarli söz', author: 'A', language: 'tr' }], 'json');
    assert.ok(stats.warnings.some(w => w.code === 'DUPLICATE_CONTENT'), 'existing dup must be flagged');
    assert.equal(stats.dupExisting, 1);
  });
  test('20. existing row-level errors remain intact (empty quote)', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = [];
    const stats = s.wqImportAnalyze([{ quote: '', author: 'A' }], 'json');
    assert.ok(stats.errors.some(e => e.code === 'EMPTY_QUOTE' || e.code === 'REQUIRED_QUOTE'));
    assert.equal(stats.invalidCount, 1);
  });
});

/* ─────────────────────── C. CSV / JSON guidance ─────────────────────── */
describe('CSV/JSON round-trip guidance', () => {
  test('21. CSV notice states CSV is lossy for technical fields', () => {
    const s = createSandbox();
    const n = s.wqCsvRoundTripNotice();
    assert.ok(/CSV/.test(n));
    assert.ok(/KORUMAZ|korumaz|teknik alan/.test(n), 'notice must say CSV does not preserve technical fields');
    assert.equal(/CSV[^.]{0,30}(kayıpsız|lossless)/i.test(n), false, 'CSV must never be called lossless');
  });
  test('22. JSON is identified as the lossless format', () => {
    const s = createSandbox();
    const n = s.wqCsvRoundTripNotice();
    assert.ok(/JSON/.test(n));
    assert.ok(/kayıpsız/i.test(n), 'notice must recommend JSON as lossless');
  });
  test('23. JSON export remains lossless (all fields round-trip)', () => {
    const s = createSandbox();
    const rec = { id: 'w9', quote: 'Kayıpsız', author: 'A', category: 'Odak', tags: ['t1'], language: 'tr',
      priority: 3, favorite: true, pinned: false, active: true, reflected: true, source: 'Kitap',
      notes: 'n', createdAt: 'c', updatedAt: 'u', lastShownAt: null, showCount: 5 };
    s.D.wisdomQuotes = [rec];
    const txt = s.wqBuildJsonText(s.wqList());
    const back = JSON.parse(txt);
    assert.deepEqual(back, [rec], 'JSON export must preserve every field');
  });
  test('24. CSV export keeps UTF-8 BOM', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = [{ id: 'w1', quote: 'ğüşiöç', author: 'A', category: '', tags: [], language: 'tr', priority: 0, favorite: false, pinned: false, source: '', notes: '' }];
    const csv = s.wqBuildCsvText(s.wqList());
    assert.equal(csv.charCodeAt(0), 0xFEFF, 'CSV must start with BOM');
  });
  test('25. CSV formula-injection guard remains intact', () => {
    const s = createSandbox();
    assert.equal(s.wqCsvEscape('=1+1').charAt(0), "'", 'formula prefix must be guarded');
    assert.equal(s.wqCsvEscape('+A1').charAt(0), "'");
    assert.equal(s.wqCsvEscape('@cmd').charAt(0), "'");
  });
});

/* ─────────────────────── D. Regression ─────────────────────── */
describe('Regression', () => {
  test('26. Wisdom Quotes CRUD helpers remain functional', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = s.normalizeWisdomQuotes([{ quote: 'A', author: 'x' }]);
    assert.equal(typeof s.wqList, 'function');
    assert.equal(s.wqList().length, 1);
    assert.ok(s.wqById(s.wqList()[0].id));
  });
  test('27. compact cards still render a native <details>', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = [{ id: 'w1', quote: 'Kart', author: 'A', category: 'Odak', active: true, favorite: false, pinned: false, reflected: false, priority: 0, language: 'tr', source: '', tags: [], notes: '', updatedAt: 'x' }];
    s.wqQuery = ''; s.wqFilterMode = 'all'; s.wqCat = ''; s.wqLang = '';
    s._wqRenderList();
    const html = s.__getElements()['wq_list'].innerHTML;
    assert.ok(/<details/i.test(html));
  });
  test('28. display settings panel is collapsed by default', () => {
    const s = createSandbox();
    const h = s.wisdomDisplayPanelHtml();
    assert.ok(/<details/i.test(h));
    assert.equal(/<details[^>]*\bopen\b/i.test(h), false);
  });
  test('29. dashboard quote path still routes through wisdomQuotes', () => {
    const s = createSandbox();
    s.D.wisdomQuotes = s.normalizeWisdomQuotes([{ quote: 'Pano sözü', author: 'A' }]);
    const q = s.rndQuote();
    assert.ok(q && q._source === 'wisdomQuotes');
  });
  test('30. restore engine still present (restore tests unaffected)', () => {
    const s = createSandbox();
    assert.equal(typeof s.prepareRestore, 'function');
  });
  test('31. relations infrastructure still present', () => {
    const s = createSandbox();
    assert.equal(typeof s.relAdd, 'function');
    assert.equal(typeof s.relList, 'function');
  });
  test('32. decision journal infrastructure still present', () => {
    const s = createSandbox();
    assert.equal(typeof s.decisionCreate, 'function');
  });
  test('33. new Step 5E surface loads cleanly alongside prior modules', () => {
    const s = createSandbox();
    ['wqTextQuality', 'wqImportApply', 'wqCsvRoundTripNotice', 'wqBuildJsonText', 'wqBuildCsvText'].forEach(fn => {
      assert.equal(typeof s[fn], 'function', fn + ' missing');
    });
  });
});

/* ─────────────────────── Static source guards ─────────────────────── */
describe('Static guards (source-level)', () => {
  test('G1. replace path creates a before_import forced backup', () => {
    assert.ok(/createBackup\(\s*['"]before_import['"]/.test(IO_SRC), 'before_import backup call missing');
    assert.ok(/force\s*:\s*true/.test(IO_SRC));
  });
  test('G2. replace commit is gated behind backup verification', () => {
    assert.ok(/_wqBackupVerified/.test(IO_SRC), 'backup verification helper missing');
    // the destructive wipe must live in the commit helper, invoked only after verification
    assert.ok(/_wqCommitImport\(\s*['"]replace['"]/.test(IO_SRC), 'replace must go through gated commit helper');
  });
  test('G3. CSV is never described as lossless in source', () => {
    assert.equal(/csv[^\n]{0,30}(lossless|kayıpsız)/i.test(IO_SRC), false, 'CSV described as lossless');
  });
  test('G4. no automatic Turkish word-rewriting map introduced', () => {
    assert.equal(/TR_?FIX_?MAP|autoCorrect|autoFix|diacriticFix/i.test(IO_SRC), false,
      'validator must not auto-rewrite Turkish words');
  });
  test('G5. import still goes through the preview before applying', () => {
    assert.ok(/wqImportShowPreview/.test(IO_SRC));
    assert.ok(/function\s+wqImportOpen[\s\S]{0,600}wqImportShowPreview/.test(IO_SRC),
      'import open flow must reach the preview');
  });
});
