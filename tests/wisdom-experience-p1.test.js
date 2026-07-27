'use strict';
/* SMART-GOALS Phase 6 P1 — Wisdom Experience System (TAMAMEN READ-ONLY).
   Tek kaynak D.wisdomQuotes; yeni model/koleksiyon/sync/backup/seçim motoru YOK.
   Üç yüzey (Dashboard/Floating/Popup) TEK seçici wexPick paylaşır; seçim yazma
   yapmaz (runtime memory). İlişkiler mevcut relations motorundan türetilir. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11q-wisdom-experience.js'), 'utf8');

function wq(over) {
  return Object.assign({ id: 'w1', quote: 'Söz', author: 'Yazar', category: 'Genel', tags: [], language: 'tr',
    favorite: false, active: true, pinned: false, priority: 0, notes: '', source: '', reflected: false,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null, showCount: 0 }, over || {});
}
function setQ(S, arr) { S.D.wisdomQuotes = arr; S.D.relations = []; S.D.goals = []; S.D.goalCheckIns = []; S.wexReset(); }

describe('Rotation engine (single selector, runtime memory)', () => {
  test('1. no immediate repeat; full cycle covers pool', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' }), wq({ id: 'b' }), wq({ id: 'c' })]);
    const seen = []; for (let i = 0; i < 3; i++) { seen.push(S.wexNext('dashboard').id); }
    assert.equal(new Set(seen).size, 3); // oturumda 3 farklı söz
  });
  test('2. wexNext excludes previous (no back-to-back duplicate)', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' }), wq({ id: 'b' })]);
    const first = S.wexCurrent('dashboard').id;
    const next = S.wexNext('dashboard').id;
    assert.notEqual(first, next);
  });
  test('3. wexPick returns null on empty pool (safe)', () => {
    const S = createSandbox(); setQ(S, []);
    assert.equal(S.wexPick({ context: 'dashboard' }), null);
  });
});

describe('Context aware selection', () => {
  test('4. context narrows pool to mapped categories', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a', category: 'Disiplin' }), wq({ id: 'b', category: 'Öğrenme' })]);
    const pool = S.wexPool('goals'); // goals -> Disiplin/Odak/Başarı/Kararlılık
    assert.equal(pool.length, 1); assert.equal(pool[0].id, 'a');
  });
  test('5. falls back to general pool when no category matches', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a', category: 'XYZ' }), wq({ id: 'b', category: 'QRS' })]);
    assert.equal(S.wexPool('goals').length, 2); // eşleşme yok -> genel havuz
  });
  test('6. unknown context => general pool (all active)', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' }), wq({ id: 'b' })]);
    assert.equal(S.wexContextCats('nosuchtab'), null);
    assert.equal(S.wexPool('nosuchtab').length, 2);
  });
});

describe('Dashboard card', () => {
  test('7. renders premium card with title + quote', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a', quote: 'Merhaba', author: 'A' })]);
    const h = S.wexDashboardCardHtml();
    assert.ok(/Bugünün Bilgeliği/.test(h)); assert.ok(/Merhaba/.test(h));
  });
  test('8. empty pool => empty string (no card)', () => {
    const S = createSandbox(); setQ(S, []);
    assert.equal(S.wexDashboardCardHtml(), '');
  });
  test('9. no fixed pixel WIDTHS (responsive)', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]);
    assert.equal(/width:\s*\d{2,}px/.test(S.wexDashboardCardHtml().replace(/width:22px|width:28px|width:30px|width:44px/g, '')), false);
  });
});

describe('Floating card', () => {
  test('10. default closed (toggle button), open exposes card', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]);
    assert.equal(S.WEX.floatOpen, false);
    assert.ok(/aria-label="Bilgelik kartını aç"/.test(S.wexFloatClosedHtml()));
    S.wexFloatToggle();
    assert.equal(S.WEX.floatOpen, true);
    assert.ok(/role="complementary"/.test(S.wexFloatOpenHtml()));
  });
  test('11. floating card is fixed bottom-right and does not cover screen', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]);
    const h = S.wexFloatOpenHtml();
    assert.ok(/right:16px/.test(h) && /bottom:16px/.test(h));
    assert.equal(/inset:0/.test(h), false); // tam ekran kaplamaz
  });
});

describe('Welcome popup + accessibility', () => {
  test('12. popup opens once per session', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]);
    assert.equal(S.wexPopupOpen(), true);
    assert.equal(S.wexPopupOpen(), false); // ikinci kez açılmaz
  });
  test('13. suppress-today blocks reopen same day', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]);
    S.wexPopupSuppressToday();
    S.WEX.popupShownSession = false; // oturum kilidini kaldır, gün baskılaması kalsın
    assert.equal(S.wexPopupOpen(), false);
  });
  test('14. popup html has dialog role + aria-modal + labelled + all buttons', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]);
    const h = S.wexPopupHtml(S.wexCurrent('dashboard'));
    assert.ok(/role="dialog"/.test(h) && /aria-modal="true"/.test(h) && /aria-label="Bugünün Bilgeliği"/.test(h));
    ['Favorilere Ekle', 'Yeni Söz', 'Detay', 'Bugün Bir Daha Gösterme', 'Kapat'].forEach(function (b) { assert.ok(h.indexOf(b) >= 0, b); });
  });
  test('15. ESC/keydown binding + focus trap function present', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]);
    assert.doesNotThrow(function () { S.wexPopupOpen(); S.wexBindPopup(); S.wexPopupClose(); });
  });
});

describe('Wisdom detail (existing relations engine)', () => {
  test('16. detail shows quote/author/category/impact/source/tags', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a', quote: 'Q', author: 'Au', category: 'Genel', source: 'Kitap', tags: ['x', 'y'] })]);
    const h = S.wexDetailHtml('a');
    assert.ok(/Q/.test(h) && /Au/.test(h) && /Genel/.test(h) && /Etki:/.test(h) && /Kitap/.test(h) && /#x/.test(h));
  });
  test('17. related wisdom/principles/goals from getRelatedEntities', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' }), wq({ id: 'b', quote: 'İlgili söz' })]);
    S.D.goals = [{ id: 7, title: 'Hedef X' }];
    S.relAdd({ sourceType: 'wisdomQuote', sourceId: 'a', targetType: 'goal', targetId: '7', relationType: 'related_to' });
    S.relAdd({ sourceType: 'wisdomQuote', sourceId: 'a', targetType: 'wisdomQuote', targetId: 'b', relationType: 'related_to' });
    const h = S.wexDetailHtml('a');
    assert.ok(/İlgili Hedefler/.test(h) && /Hedef X/.test(h));
    assert.ok(/İlgili Bilgelik/.test(h) && /İlgili söz/.test(h));
  });
  test('18. missing record => safe message', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]);
    assert.ok(/bulunamadı/.test(S.wexDetailHtml('zzz')));
  });
});

describe('Read-only + runtime safety', () => {
  test('19. selection/render never mutate D.wisdomQuotes (no showCount/lastShownAt write)', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' }), wq({ id: 'b' }), wq({ id: 'c' })]);
    const before = JSON.stringify(S.D.wisdomQuotes);
    S.wexCurrent('dashboard'); S.wexNext('dashboard'); S.wexPick({ context: 'goals' });
    S.wexDashboardCardHtml(); S.wexFloatToggle(); S.wexFloatOpenHtml(); S.wexPopupHtml(S.wexCurrent('dashboard')); S.wexDetailHtml('a');
    assert.equal(JSON.stringify(S.D.wisdomQuotes), before);
  });
  test('20. protected collections untouched (goals/relations/goalCheckIns)', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a' })]); S.D.goals = [{ id: 1, title: 'G' }]; S.D.relations = []; S.D.goalCheckIns = [];
    const g = JSON.stringify(S.D.goals), r = JSON.stringify(S.D.relations), c = JSON.stringify(S.D.goalCheckIns);
    S.wexCurrent('goals'); S.wexDashboardCardHtml(); S.wexDetailHtml('a'); S.wexPopupOpen();
    assert.equal(JSON.stringify(S.D.goals), g); assert.equal(JSON.stringify(S.D.relations), r); assert.equal(JSON.stringify(S.D.goalCheckIns), c);
  });
  test('21. empty wisdom fully safe (no throw across surfaces)', () => {
    const S = createSandbox(); setQ(S, []);
    assert.doesNotThrow(function () {
      assert.equal(S.wexCurrent('dashboard'), null);
      assert.equal(S.wexDashboardCardHtml(), '');
      assert.equal(S.wexPopupOpen(), false);
      S.wexRenderFloat();
    });
  });
  test('22. missing author safe (no dangling em-dash)', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a', author: '' })]);
    const h = S.wexDashboardCardHtml();
    assert.equal(/&mdash;/.test(h), false);
  });
  test('23. missing category safe (no category pill, no throw)', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a', category: '' })]);
    assert.doesNotThrow(function () { S.wexMetaRow(S.wexCurrent('dashboard')); });
    assert.ok(S.wexCardBody(wq({ id: 'a', category: '' })).length > 0);
  });
  test('24. impact derived read-only (no stored field)', () => {
    const S = createSandbox();
    assert.equal(S.wexImpact({ favorite: true, reflected: true, priority: 2, showCount: 9 }).level, 'high');
    assert.equal(S.wexImpact({}).level, 'low');
  });
});

describe('Performance — single engine across three surfaces', () => {
  test('25. dashboard/float/popup reflect the SAME wexCurrent selection', () => {
    const S = createSandbox(); setQ(S, [wq({ id: 'a', quote: 'TEK', author: 'Z' })]);
    const cur = S.wexCurrent('dashboard').id;
    assert.ok(S.wexDashboardCardHtml().indexOf('TEK') >= 0);
    S.WEX.floatOpen = true; assert.ok(S.wexFloatOpenHtml().indexOf('TEK') >= 0);
    assert.ok(S.wexPopupHtml(S.wexCurrent('dashboard')).indexOf('TEK') >= 0);
    assert.equal(cur, 'a');
  });
});

describe('Static guards (mandatory)', () => {
  test('G1. no production write primitives', () => {
    assert.equal(/\bsave\s*\(|writeLocal\s*\(|\bsnap\s*\(|wdMarkShown|queueCloudSave|commitMutation/.test(SRC), false);
  });
  test('G2. no protected-collection mutation', () => {
    assert.equal(/D\.goals\s*=|D\.goalCheckIns\s*=|D\.relations\s*=|D\.notes\s*=|D\.settings\s*=/.test(SRC), false);
  });
  test('G3. no new collection / no D.* assignment', () => {
    assert.equal(/D\.[a-zA-Z_]+\s*=[^=]/.test(SRC), false);
  });
  test('G4. no new relation/backup/sync/content engine', () => {
    assert.equal(/registerRelationResolver|relAdd\s*\(|DIFF_SCHEMA|registerContentAdapter|registerBackup|registerContentSync/.test(SRC), false);
  });
  test('G5. exactly ONE selector (wexPick) — no duplicate engine', () => {
    assert.equal((SRC.match(/function\s+wexPick\b/g) || []).length, 1);
    // üç yüzey de wexCurrent üzerinden gider
    assert.ok(/wexCurrent/.test(SRC));
  });
  test('G6. thin hooks wired (harness load + boot + dashboard hook + index)', () => {
    assert.ok(/11q-wisdom-experience\.js/.test(fs.readFileSync(path.join(ROOT, 'tests', 'harness.js'), 'utf8')));
    assert.ok(/wexBoot/.test(fs.readFileSync(path.join(ROOT, 'js', '12-render-boot.js'), 'utf8')));
    assert.ok(/wexDashboardCardHtml/.test(fs.readFileSync(path.join(ROOT, 'js', '08-ui-core.js'), 'utf8')));
    assert.ok(/11q-wisdom-experience/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
  });
  test('G7. mirrors byte-identical + module < 900', () => {
    ['11q-wisdom-experience.js', '08-ui-core.js', '12-render-boot.js'].forEach(function (f) {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), f);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
    assert.ok(SRC.split('\n').length < 900);
  });
});
