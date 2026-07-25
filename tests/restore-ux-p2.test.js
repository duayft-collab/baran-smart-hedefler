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
function preview(sbx, current, backup, opts) {
  return sbx.buildRestorePreview(current, backup, Object.assign({ sourceRevision: 10, targetRevision: 5 }, opts || {}));
}
function renderResultHtml(sbx, report, pv, uiOverrides) {
  sbx.RESTORE_UI.view = 'result';
  sbx.RESTORE_UI.report = report;
  sbx.RESTORE_UI.preview = pv || null;
  sbx.RESTORE_UI.resultShowAll = false;
  Object.assign(sbx.RESTORE_UI, uiOverrides || {});
  sbx.renderRestoreModal();
  return sbx.window.__lastModalHtml || '';
}
function mixedPreview(sbx) {
  const current = basePayload({
    wisdomQuotes: arr(22, 'w'), principles: arr(3, 'p'), goals: arr(18, 'g'),
    generalNotes: arr(6, 'n'), todos: arr(4, 't')
  });
  const backup = basePayload({
    wisdomQuotes: arr(122, 'w'), principles: arr(5, 'p'), goals: arr(17, 'g').concat(arr(1,'gextra')).slice(0,17),
    generalNotes: arr(6, 'n'), todos: arr(4, 't')
  });
  return preview(sbx, current, backup);
}

describe('RESTORE-UX-P2: Restore sonuç özeti', () => {
  test('1. committed outcome\'da modül özeti görünür', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'committed', safeguardBackupId: 'sg-1' }, pv);
    assert.ok(html.indexOf('Modül Değişiklikleri') >= 0);
  });
  test('2. failed outcome\'da modül özeti görünmez', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'failed' }, pv);
    assert.ok(html.indexOf('Modül Değişiklikleri') < 0);
  });
  test('3. cancelled outcome\'da başarı özeti görünmez', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'cancelled' }, pv);
    assert.ok(html.indexOf('Modül Değişiklikleri') < 0);
    assert.ok(html.indexOf('Geri Yükleme Tamamlandı') < 0);
  });
  test('4. wisdomQuotes üst sırada görünür', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'committed' }, pv, { resultShowAll: true });
    const iW = html.indexOf('Özlü Sözler'), iP = html.indexOf('İlkeler'), iG = html.indexOf('Hedefler'), iN = html.indexOf('Genel Notlar');
    assert.ok(iW >= 0 && iW < iP && iP < iG && iG < iN, 'sıra: wisdomQuotes < principles < goals < generalNotes');
  });
  test('5. principles/goals/generalNotes doğru sırada (P0 sırasının devamı)', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'committed' }, pv, { resultShowAll: true });
    const iN = html.indexOf('Genel Notlar'), iT = html.indexOf('Görevler');
    assert.ok(iN >= 0 && iT >= 0 && iN < iT, 'generalNotes todos\'tan önce');
  });
  test('6. Önceki ve sonraki sayılar doğru gösterilir', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'committed' }, pv);
    assert.ok(html.indexOf('22') >= 0 && html.indexOf('122') >= 0);
  });
  test('7. Ekleme/silme/değiştirme değerleri doğru gösterilir', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const mt = pv.perModule.wisdomQuotes;
    const html = renderResultHtml(sbx, { outcome: 'committed' }, pv);
    assert.ok(html.indexOf('+' + mt.added) >= 0);
    assert.ok(html.indexOf('−' + mt.removed) >= 0 || html.indexOf('-' + mt.removed) >= 0);
  });
  test('8. Sıfır fark yanlış veri olarak gösterilmez (N → N)', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx); // generalNotes: 6->6, sıfır fark
    const html = renderResultHtml(sbx, { outcome: 'committed' }, pv, { resultShowAll: true });
    assert.ok(html.indexOf('Genel Notlar') >= 0);
    const idx = html.indexOf('Genel Notlar');
    const snippet = html.slice(idx, idx + 300);
    assert.ok(snippet.indexOf('6 → 6') >= 0);
  });
  test('9. Çok modüllü sonuç ekranı taşmaz (varsayılan: yalnız değişenler)', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'committed' }, pv); // resultShowAll: false (varsayılan)
    // generalNotes ve todos DEĞİŞMEDİ -> kompakt modda görünmemeli
    assert.ok(html.indexOf('Genel Notlar') < 0);
    assert.ok(html.indexOf('Görevler') < 0);
    // wisdomQuotes/principles/goals DEĞİŞTİ -> görünmeli
    assert.ok(html.indexOf('Özlü Sözler') >= 0);
  });
  test('10. "Tüm modülleri göster" aç/kapa çalışır', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const htmlCompact = renderResultHtml(sbx, { outcome: 'committed' }, pv, { resultShowAll: false });
    assert.ok(htmlCompact.indexOf('rstToggleResultShowAll()') >= 0);
    assert.ok(htmlCompact.indexOf('Genel Notlar') < 0);
    const htmlFull = renderResultHtml(sbx, { outcome: 'committed' }, pv, { resultShowAll: true });
    assert.ok(htmlFull.indexOf('Genel Notlar') >= 0);
  });
  test('11. "Bu Restore\'u Geri Al" butonu bozulmaz', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'committed', safeguardBackupId: 'sg-42' }, pv);
    assert.ok(html.indexOf('rstUndoLastRestore()') >= 0);
  });
  test('12. safeguardBackupId davranışı korunur (yoksa buton yok)', () => {
    const sbx = createSandbox();
    const pv = mixedPreview(sbx);
    const html = renderResultHtml(sbx, { outcome: 'committed', safeguardBackupId: null }, pv);
    assert.ok(html.indexOf('rstUndoLastRestore()') < 0);
  });
  test('12b. preview yoksa (RESTORE_UI.preview null) sahte özet üretilmez', () => {
    const sbx = createSandbox();
    const html = renderResultHtml(sbx, { outcome: 'committed' }, null);
    assert.ok(html.indexOf('Modül Değişiklikleri') < 0);
  });
});

describe('RESTORE-UX-P2: Backup filtreleri', () => {
  function mkBackups() {
    return [
      { id: '1', reason: 'manual', createdAtClient: 5 },
      { id: '2', reason: 'daily', createdAtClient: 4 },
      { id: '3', reason: 'before_restore', createdAtClient: 3 },
      { id: '4', reason: 'before_migration', createdAtClient: 2 },
      { id: '5', reason: 'before_import', createdAtClient: 1 },
      { id: '6', reason: 'before_conflict_overwrite', createdAtClient: 0 },
      { id: '7', reason: 'before_bulk_delete', createdAtClient: -1 },
      { id: '8', reason: 'some_future_reason', createdAtClient: -2 }
    ];
  }
  test('13. Tümü filtresi bütün kayıtları gösterir', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'all'; sbx.RESTORE_UI.query = '';
    assert.equal(sbx.rstFilteredBackups().length, 8);
  });
  test('14. Manuel filtresi doğru kayıtları gösterir', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'manual'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1); assert.equal(r[0].reason, 'manual');
  });
  test('15. Otomatik filtresi doğru kayıtları gösterir', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'daily'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1); assert.equal(r[0].reason, 'daily');
  });
  test('16. Restore öncesi filtresi before_restore kayıtlarını gösterir', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'before_restore'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1); assert.equal(r[0].reason, 'before_restore');
  });
  test('17. Migration öncesi filtresi gerçek reason değerini doğru eşler', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'before_migration'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1); assert.equal(r[0].reason, 'before_migration');
  });
  test('18. Import öncesi filtresi gerçek reason değerini doğru eşler', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'before_import'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1); assert.equal(r[0].reason, 'before_import');
  });
  test('19. Conflict overwrite filtresi gerçek reason değerini doğru eşler', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'before_conflict_overwrite'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1); assert.equal(r[0].reason, 'before_conflict_overwrite');
  });
  test('20. Acil filtresi doğru kayıtları gösterir (before_bulk_delete)', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'emergency'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1); assert.equal(r[0].reason, 'before_bulk_delete');
  });
  test('21. Bilinmeyen reason "Diğer" altında kaybolmadan görünür', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'other'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1); assert.equal(r[0].reason, 'some_future_reason');
  });
  test('22. Filtre sayıları doğru hesaplanır', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups();
    const counts = sbx.rstFilterCounts();
    assert.equal(counts.all, 8);
    assert.equal(counts.manual, 1);
    assert.equal(counts.daily, 1);
    assert.equal(counts.before_restore, 1);
    assert.equal(counts.before_migration, 1);
    assert.equal(counts.before_import, 1);
    assert.equal(counts.before_conflict_overwrite, 1);
    assert.equal(counts.emergency, 1);
    assert.equal(counts.other, 1);
  });
  test('23. Filtre değişince liste sırası bozulmaz', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups(); sbx.RESTORE_UI.filter = 'all'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].createdAtClient >= r[i].createdAtClient, 'sıra korunmalı');
  });
  test('24. Filtre değişince stale preview güvenli şekilde temizlenir', () => {
    const sbx = createSandbox();
    sbx.RESTORE_UI.backups = mkBackups();
    sbx.RESTORE_UI.opId = 'fake-op-1';
    sbx.RESTORE_UI.preview = { destructiveImpact: 'critical' };
    sbx.RESTORE_UI.accepted = true;
    let cancelledWith = null;
    sbx.cancelRestore = function (id) { cancelledWith = id; return { status: 'cancelled' }; };
    sbx.rstSetFilter('manual');
    assert.equal(cancelledWith, 'fake-op-1');
    assert.equal(sbx.RESTORE_UI.opId, null);
    assert.equal(sbx.RESTORE_UI.preview, null);
    assert.equal(sbx.RESTORE_UI.accepted, false);
    assert.equal(sbx.RESTORE_UI.filter, 'manual');
  });
  test('25. Backup sağlık rozeti filtreleme sonrası korunur', () => {
    const sbx = createSandbox();
    const backups = mkBackups().map(function (m) { return Object.assign({}, m, { plainSha256: 'a', blobSha256: 'b', healthStatus: 'Healthy' }); });
    sbx.RESTORE_UI.backups = backups; sbx.RESTORE_UI.filter = 'manual'; sbx.RESTORE_UI.query = '';
    const r = sbx.rstFilteredBackups();
    assert.equal(r.length, 1);
    assert.ok(sbx.rstHealthBadge(r[0]).indexOf('Healthy') >= 0);
  });
});

describe('RESTORE-UX-P2: Regresyon', () => {
  test('26. P0 risk uyarıları bozulmaz', () => {
    const sbx = createSandbox();
    const current = basePayload({ quotes: arr(100, 'q') });
    const backup = basePayload({ quotes: arr(80, 'q') });
    const pv = preview(sbx, current, backup);
    assert.equal(pv.destructiveImpact, 'high');
  });
  test('27. Typed confirmation bozulmaz', () => {
    const sbx = createSandbox();
    const current = basePayload({ wisdomQuotes: arr(100, 'w') });
    const backup = basePayload({ wisdomQuotes: [] });
    const pv = preview(sbx, current, backup);
    sbx.RESTORE_UI.view = 'preview'; sbx.RESTORE_UI.preview = pv; sbx.RESTORE_UI.suspect = { reasons: [] };
    sbx.RESTORE_UI.warnings = []; sbx.RESTORE_UI.accepted = true; sbx.RESTORE_UI.confirmText = 'restore onay';
    sbx.renderRestoreModal();
    const html = sbx.window.__lastModalHtml || '';
    const btn = html.slice(html.indexOf('id="rst_go"') - 200, html.indexOf('id="rst_go"') + 50);
    assert.ok(btn.indexOf('disabled') < 0);
  });
  test('28. P1 geri alma kısayolu bozulmaz', () => {
    const sbx = createSandbox();
    let calledWith = null;
    sbx.rstOpenPreview = function (id) { calledWith = id; };
    sbx.RESTORE_UI.report = { outcome: 'committed', safeguardBackupId: 'sg-777' };
    sbx.rstUndoLastRestore();
    assert.equal(calledWith, 'sg-777');
  });
  test('29. Revizyon karşılaştırması bozulmaz', () => {
    const sbx = createSandbox();
    const current = basePayload({ todos: arr(3, 't') });
    const backup = basePayload({ todos: arr(2, 't') });
    const pv = preview(sbx, current, backup, { sourceRevision: 205, targetRevision: 198 });
    sbx.RESTORE_UI.view = 'preview'; sbx.RESTORE_UI.preview = pv; sbx.RESTORE_UI.suspect = { reasons: [] };
    sbx.RESTORE_UI.warnings = []; sbx.RESTORE_UI.accepted = false; sbx.RESTORE_UI.confirmText = '';
    sbx.renderRestoreModal();
    const html = sbx.window.__lastModalHtml || '';
    assert.ok(html.indexOf('205') >= 0 && html.indexOf('198') >= 0);
  });
  test('30. Mutlak sayı karşılaştırması (P1 "Karşılaştırma" bloğu) bozulmaz', () => {
    const sbx = createSandbox();
    const current = basePayload({ wisdomQuotes: arr(122, 'w') });
    const backup = basePayload({ wisdomQuotes: arr(22, 'w') });
    const pv = preview(sbx, current, backup);
    sbx.RESTORE_UI.view = 'preview'; sbx.RESTORE_UI.preview = pv; sbx.RESTORE_UI.suspect = { reasons: [] };
    sbx.RESTORE_UI.warnings = []; sbx.RESTORE_UI.accepted = false; sbx.RESTORE_UI.confirmText = '';
    sbx.renderRestoreModal();
    const html = sbx.window.__lastModalHtml || '';
    assert.ok(html.indexOf('Karşılaştırma') >= 0);
  });
  test('31. prepareRestore/cancelRestore akışı değişmez (fonksiyonlar hâlâ mevcut ve aynı imzada)', () => {
    const sbx = createSandbox();
    assert.equal(typeof sbx.prepareRestore, 'function');
    assert.equal(typeof sbx.cancelRestore, 'function');
    assert.equal(sbx.prepareRestore.length, 1);
    assert.equal(sbx.cancelRestore.length, 1);
  });
  test('32. confirmRestore/executeRestore motoruna yeni yol eklenmez (06-restore-engine.js değişmedi)', () => {
    const { execSync } = require('node:child_process');
    const diff = execSync('git diff --stat -- js/06-restore-engine.js public/js/06-restore-engine.js', { cwd: __dirname + '/..' }).toString();
    assert.equal(diff.trim(), '');
  });
});
