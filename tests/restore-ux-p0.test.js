'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function arr(n, prefix) { return Array.from({ length: n }, (_, i) => ({ id: prefix + i, v: 1 })); }
function basePayload(overrides) {
  return Object.assign({
    goals: [], todos: [], habits: [], quotes: [], kpis: [], journal: [],
    principles: [], coaching: [], sops: [], gtdInbox: [], questions: [],
    mybooks: [], challenges: [], vault: [], generalNotes: [], wisdomQuotes: [], logs: []
  }, overrides);
}
function preview(sbx, current, backup) {
  return sbx.buildRestorePreview(current, backup, { sourceRevision: 10, targetRevision: 5 });
}
function renderPreviewHtml(sbx, pv, uiOverrides) {
  sbx.RESTORE_UI.view = 'preview';
  sbx.RESTORE_UI.preview = pv;
  sbx.RESTORE_UI.suspect = { reasons: [] };
  sbx.RESTORE_UI.warnings = [];
  sbx.RESTORE_UI.accepted = false;
  sbx.RESTORE_UI.confirmText = '';
  Object.assign(sbx.RESTORE_UI, uiOverrides || {});
  sbx.renderRestoreModal();
  return sbx.window.__lastModalHtml || '';
}

describe('Kritik modül', () => {
  test('1. wisdomQuotes kritik modül olarak değerlendirilir', () => {
    const sbx = createSandbox();
    assert.ok(sbx.IMPACT_RULES.criticalModules.includes('wisdomQuotes'));
  });

  test('2. principles kritik modül olarak değerlendirilir', () => {
    const sbx = createSandbox();
    assert.ok(sbx.IMPACT_RULES.criticalModules.includes('principles'));
  });

  test('2b. generalNotes kritik modül olarak değerlendirilir (revizyon)', () => {
    const sbx = createSandbox();
    assert.ok(sbx.IMPACT_RULES.criticalModules.includes('generalNotes'));
    const current = basePayload({ generalNotes: arr(10, 'n') });
    const backup = basePayload({ generalNotes: arr(4, 'n') }); // %60 azalma
    const pv = preview(sbx, current, backup);
    assert.equal(pv.destructiveImpact, 'critical');
  });

  test('3. %49 azalma sert kapı açmaz', () => {
    const sbx = createSandbox();
    const current = basePayload({ wisdomQuotes: arr(100, 'w') });
    const backup = basePayload({ wisdomQuotes: arr(51, 'w') }); // 49 removed = %49
    const pv = preview(sbx, current, backup);
    assert.notEqual(pv.destructiveImpact, 'critical');
  });

  test('4. %50 azalma sert kapı açar', () => {
    const sbx = createSandbox();
    const current = basePayload({ wisdomQuotes: arr(100, 'w') });
    const backup = basePayload({ wisdomQuotes: arr(50, 'w') }); // 50 removed = %50
    const pv = preview(sbx, current, backup);
    assert.equal(pv.destructiveImpact, 'critical');
  });

  test('5. Kritik modüllerden yalnız birinin eşiği aşması tüm restore için kapıyı açar', () => {
    const sbx = createSandbox();
    const current = basePayload({ goals: arr(10, 'g'), wisdomQuotes: arr(100, 'w') });
    const backup = basePayload({ goals: arr(10, 'g'), wisdomQuotes: arr(40, 'w') }); // goals unchanged, wisdomQuotes -%60
    const pv = preview(sbx, current, backup);
    assert.equal(pv.destructiveImpact, 'critical');
  });
});

describe('Yumuşak uyarı', () => {
  test('6. Genel silinme %19 ise yumuşak uyarı yok', () => {
    const sbx = createSandbox();
    const current = basePayload({ quotes: arr(100, 'q') });
    const backup = basePayload({ quotes: arr(81, 'q') }); // 19 removed = %19
    const pv = preview(sbx, current, backup);
    assert.notEqual(pv.destructiveImpact, 'high');
    assert.notEqual(pv.destructiveImpact, 'critical');
    const html = renderPreviewHtml(sbx, pv);
    assert.ok(html.indexOf('önemli bir bölümünü kaldıracak') < 0);
  });

  test('7. %20 ise uyarı var', () => {
    const sbx = createSandbox();
    const current = basePayload({ quotes: arr(100, 'q') });
    const backup = basePayload({ quotes: arr(80, 'q') }); // 20 removed = %20
    const pv = preview(sbx, current, backup);
    assert.equal(pv.destructiveImpact, 'high');
    const html = renderPreviewHtml(sbx, pv);
    assert.ok(html.indexOf('önemli bir bölümünü kaldıracak') >= 0);
  });

  test('8. Uyarıda toplam silinecek/değişecek sayıları doğru', () => {
    const sbx = createSandbox();
    const current = basePayload({ quotes: arr(100, 'q') });
    const backup = basePayload({ quotes: arr(80, 'q') });
    const pv = preview(sbx, current, backup);
    const html = renderPreviewHtml(sbx, pv);
    assert.ok(html.indexOf('Silinecek toplam kayıt: ' + pv.totals.removed) >= 0);
    assert.ok(html.indexOf('Değişecek kayıt: ' + pv.totals.changed) >= 0);
  });
});

describe('Typed confirmation', () => {
  function criticalPreview(sbx) {
    const current = basePayload({ wisdomQuotes: arr(122, 'w') });
    const backup = basePayload({ wisdomQuotes: [] });
    return preview(sbx, current, backup);
  }

  test('9. Sert kapıda input görünür', () => {
    const sbx = createSandbox();
    const pv = criticalPreview(sbx);
    const html = renderPreviewHtml(sbx, pv, { accepted: true });
    assert.ok(html.indexOf('id="rst_confirm_text"') >= 0);
  });

  test('10. Boş inputta restore pasif', () => {
    const sbx = createSandbox();
    const pv = criticalPreview(sbx);
    const html = renderPreviewHtml(sbx, pv, { accepted: true, confirmText: '' });
    const btn = html.slice(html.indexOf('id="rst_go"') - 200, html.indexOf('id="rst_go"') + 50);
    assert.ok(btn.indexOf('disabled') >= 0);
  });

  test('11. Yanlış metinde restore pasif', () => {
    const sbx = createSandbox();
    const pv = criticalPreview(sbx);
    const html = renderPreviewHtml(sbx, pv, { accepted: true, confirmText: 'restore onayy' });
    const btn = html.slice(html.indexOf('id="rst_go"') - 200, html.indexOf('id="rst_go"') + 50);
    assert.ok(btn.indexOf('disabled') >= 0);
  });

  test('12. RESTORE ONAY doğru yazılınca aktif (case-insensitive, trim)', () => {
    const sbx = createSandbox();
    const pv = criticalPreview(sbx);
    ['RESTORE ONAY', 'restore onay', 'Restore Onay', '  RESTORE ONAY  '].forEach((txt) => {
      const html = renderPreviewHtml(sbx, pv, { accepted: true, confirmText: txt });
      const btn = html.slice(html.indexOf('id="rst_go"') - 200, html.indexOf('id="rst_go"') + 50);
      assert.ok(btn.indexOf('disabled') < 0, 'should accept: "' + txt + '"');
    });
  });

  test('13. Önizleme değişirse eski confirmation geçersizleşir (rstResetConfirmState)', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.confirmText = 'RESTORE ONAY';
    sbx.RESTORE_UI.accepted = true;
    sbx.rstResetConfirmState();
    assert.equal(sbx.RESTORE_UI.confirmText, '');
    assert.equal(sbx.RESTORE_UI.accepted, false);
  });

  test('14. Modal kapanıp açılınca confirmation temizlenir (rstCancel)', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.confirmText = 'RESTORE ONAY';
    sbx.RESTORE_UI.opId = null;
    sbx.rstCancel();
    assert.equal(sbx.RESTORE_UI.confirmText, '');
  });
});

describe('Restore Önizleme', () => {
  function mixedPreview(sbx) {
    const current = basePayload({
      wisdomQuotes: arr(122, 'w'), principles: arr(17, 'p'),
      generalNotes: arr(5, 'n'), habits: arr(4, 'h')
    });
    const backup = basePayload({
      wisdomQuotes: arr(22, 'w'), principles: arr(17, 'p'),
      generalNotes: arr(4, 'n'), habits: arr(4, 'h')
    });
    return preview(sbx, current, backup);
  }

  test('15. wisdomQuotes satırı görünür', () => {
    const sbx = createSandbox();
    const html = renderPreviewHtml(sbx, mixedPreview(sbx));
    assert.ok(html.indexOf('Özlü Sözler') >= 0);
  });

  test('16. principles satırı görünür', () => {
    const sbx = createSandbox();
    const html = renderPreviewHtml(sbx, mixedPreview(sbx));
    assert.ok(html.indexOf('İlkeler') >= 0);
  });

  test('17. generalNotes satırı görünür', () => {
    const sbx = createSandbox();
    const html = renderPreviewHtml(sbx, mixedPreview(sbx));
    assert.ok(html.indexOf('Genel Notlar') >= 0);
  });

  test('18. Mevcut/yedek/eklenecek/silinecek/değişecek sayıları doğru', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderPreviewHtml(sbx, pv);
    const mt = pv.perModule.wisdomQuotes; // 122 current, 22 target -> removed 100
    assert.equal(mt.removed, 100);
    assert.ok(html.indexOf('122') >= 0); // current count somewhere in the row
    assert.ok(html.indexOf('22') >= 0);  // target count somewhere in the row
  });

  test('19b. Modül sırası: kritikler (wisdomQuotes, principles, goals) en üstte (revizyon)', () => {
    const sbx = createSandbox();
    // Yalnız wisdomQuotes/principles kritik eşiği aşacak şekilde değiştirildi; goals/todos/
    // habits/generalNotes/journal/logs SABİT (sıfır fark) tutuldu — aksi halde P1'in
    // "Karşılaştırma" bloğu araya girip saf modül-sırası testini bozar (o ayrı test edildi).
    const current = basePayload({
      wisdomQuotes: arr(5, 'w'), principles: arr(5, 'p'), goals: arr(5, 'g'),
      generalNotes: arr(5, 'n'), journal: arr(5, 'j'), logs: arr(5, 'l'),
      todos: arr(5, 't'), habits: arr(5, 'h')
    });
    const backup = basePayload({
      wisdomQuotes: arr(1, 'w'), principles: arr(1, 'p'), goals: arr(5, 'g'),
      generalNotes: arr(5, 'n'), journal: arr(5, 'j'), logs: arr(5, 'l'),
      todos: arr(5, 't'), habits: arr(5, 'h')
    });
    const pv = preview(sbx, current, backup);
    const html = renderPreviewHtml(sbx, pv);
    const iW = html.indexOf('Özlü Sözler'), iP = html.indexOf('İlkeler'), iG = html.indexOf('Hedefler');
    const iN = html.indexOf('Genel Notlar'), iT = html.indexOf('Görevler');
    assert.ok(iW >= 0 && iP >= 0 && iG >= 0 && iN >= 0 && iT >= 0);
    assert.ok(iW < iN, 'wisdomQuotes generalNotes\'tan önce olmalı');
    assert.ok(iP < iN, 'principles generalNotes\'tan önce olmalı');
    assert.ok(iG < iN, 'goals generalNotes\'tan önce olmalı');
    assert.ok(iN < iT, 'generalNotes todos\'tan önce olmalı');
  });

  test('19. Değişiklik olmayan modül yanlışlıkla kaybolmaz', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx); // habits identical in current/backup -> zero diff
    assert.deepEqual(JSON.parse(JSON.stringify(pv.perModule.habits)), { added: 0, removed: 0, changed: 0, unchanged: 4, uncertain: 0 });
    const html = renderPreviewHtml(sbx, pv);
    assert.ok(html.indexOf('Alışkanlıklar') >= 0);
    assert.ok(html.indexOf('Değişiklik yok') >= 0);
  });
});

describe('Backup kayıt sayımı', () => {
  test('20. Yeni backup wisdomQuotes sayısını içerir', () => {
    const sbx = createSandbox();
    const c = sbx.countRecords(basePayload({ wisdomQuotes: arr(5, 'w') }));
    assert.equal(c.wisdomQuotes, 5);
  });

  test('21. principles sayısını içerir', () => {
    const sbx = createSandbox();
    const c = sbx.countRecords(basePayload({ principles: arr(3, 'p') }));
    assert.equal(c.principles, 3);
  });

  test('22. generalNotes sayısını içerir', () => {
    const sbx = createSandbox();
    const c = sbx.countRecords(basePayload({ generalNotes: arr(2, 'n') }));
    assert.equal(c.generalNotes, 2);
  });

  test('23. Eski metadata eksikse yanlış 0 gösterilmez (backupModuleCount)', () => {
    const sbx = createSandbox();
    assert.equal(sbx.backupModuleCount({ goals: 3 }, 'wisdomQuotes'), null); // alan hiç yok -> Bilinmiyor
    assert.equal(sbx.backupModuleCount({ wisdomQuotes: 0 }, 'wisdomQuotes'), 0); // gerçek sıfır -> 0
  });
});

describe('Regresyon', () => {
  test('24. Restore öncesi safeguard backup hâlâ oluşur', () => {
    const sbx = createSandbox();
    assert.ok(sbx.executeRestore.toString().indexOf("createBackup('before_restore'") >= 0);
  });

  test('25. Checksum doğrulaması bozulmaz (canonicalStringify kararlı)', () => {
    const sbx = createSandbox();
    const a = sbx.canonicalStringify({ b: 1, a: 2 });
    const b = sbx.canonicalStringify({ a: 2, b: 1 });
    assert.equal(a, b);
  });

  test('26. Normal düşük-risk restore akışı değişmez', () => {
    const sbx = createSandbox();
    const current = basePayload({ todos: arr(5, 't') });
    const backup = basePayload({ todos: arr(5, 't').map((x, i) => i === 0 ? Object.assign({}, x, { v: 2 }) : x) });
    const pv = preview(sbx, current, backup);
    assert.notEqual(pv.destructiveImpact, 'critical');
    assert.notEqual(pv.destructiveImpact, 'high');
  });

  test('27. Preview stale davranışı korunur (TTL sabiti değişmedi)', () => {
    const sbx = createSandbox();
    assert.equal(sbx.RESTORE_PREVIEW_TTL_MS, 300000);
  });
});
