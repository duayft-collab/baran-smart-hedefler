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

describe('RESTORE-UX-P1: Tek-tık geri al', () => {
  function resultUI(sbx, overrides) {
    sbx.RESTORE_UI.view = 'result';
    sbx.RESTORE_UI.report = Object.assign({ outcome: 'committed', safeguardBackupId: 'sg-123' }, overrides);
    sbx.renderRestoreModal();
    return sbx.window.__lastModalHtml || '';
  }
  test('P1-1. safeguardBackupId varsa "Geri Al" butonu görünür', () => {
    const sbx = createSandbox();
    const html = resultUI(sbx);
    assert.ok(html.indexOf('rstUndoLastRestore()') >= 0);
  });
  test('P1-2. safeguardBackupId yoksa buton görünmez', () => {
    const sbx = createSandbox();
    const html = resultUI(sbx, { safeguardBackupId: null });
    assert.ok(html.indexOf('rstUndoLastRestore()') < 0);
  });
  test('P1-3. outcome committed değilse buton görünmez', () => {
    const sbx = createSandbox();
    const html = resultUI(sbx, { outcome: 'failed' });
    assert.ok(html.indexOf('rstUndoLastRestore()') < 0);
  });
  test('P1-4. rstUndoLastRestore doğru backupId ile rstOpenPreview çağırır', () => {
    const sbx = createSandbox();
    let calledWith = null;
    sbx.rstOpenPreview = function (id) { calledWith = id; };
    sbx.RESTORE_UI.report = { outcome: 'committed', safeguardBackupId: 'sg-999' };
    sbx.rstUndoLastRestore();
    assert.equal(calledWith, 'sg-999');
  });
});

describe('RESTORE-UX-P1: Mutlak sayı ve revizyon karşılaştırması', () => {
  test('P1-5. Kritik modül etkilendiğinde "Şu an/Restore" karşılaştırması görünür', () => {
    const sbx = createSandbox();
    const current = basePayload({ wisdomQuotes: arr(122, 'w') });
    const backup = basePayload({ wisdomQuotes: arr(22, 'w') });
    const pv = preview(sbx, current, backup);
    const html = renderPreviewHtml(sbx, pv);
    assert.ok(html.indexOf('Şu an') >= 0);
    assert.ok(html.indexOf('122') >= 0);
    assert.ok(html.indexOf('22') >= 0);
  });
  test('P1-6. Hiçbir kritik modül etkilenmemişse karşılaştırma bloğu boş kalır', () => {
    const sbx = createSandbox();
    const current = basePayload({ quotes: arr(10, 'q') });
    const backup = basePayload({ quotes: arr(9, 'q') });
    const pv = preview(sbx, current, backup);
    const html = renderPreviewHtml(sbx, pv);
    assert.ok(html.indexOf('Karşılaştırma') < 0);
  });
  test('P1-7. Revizyon karşılaştırması gösterilir', () => {
    const sbx = createSandbox();
    const current = basePayload({ todos: arr(3, 't') });
    const backup = basePayload({ todos: arr(2, 't') });
    const pv = preview(sbx, current, backup, { sourceRevision: 205, targetRevision: 198 });
    const html = renderPreviewHtml(sbx, pv);
    assert.ok(html.indexOf('205') >= 0);
    assert.ok(html.indexOf('198') >= 0);
  });
});

describe('RESTORE-UX-P1: Backup sağlık rozeti', () => {
  test('P1-8. healthStatus varsa rozet gösterilir', () => {
    const sbx = createSandbox();
    const html = sbx.rstHealthBadge({ plainSha256: 'a', blobSha256: 'b', healthStatus: 'Healthy' });
    assert.ok(html.indexOf('Healthy') >= 0);
  });
  test('P1-9. checksum alanı yoksa Legacy gösterilir', () => {
    const sbx = createSandbox();
    const html = sbx.rstHealthBadge({});
    assert.ok(html.indexOf('Legacy') >= 0);
  });
  test('P1-10. checksum var ama hiç doğrulanmamışsa "Doğrulanmadı" gösterilir', () => {
    const sbx = createSandbox();
    const html = sbx.rstHealthBadge({ plainSha256: 'a', blobSha256: 'b' });
    assert.ok(html.indexOf('Doğrulanmadı') >= 0);
  });
  test('P1-11. rstHealthBadge senkron çalışır (yeni verifyBackup/network çağrısı yok)', () => {
    const sbx = createSandbox();
    assert.equal(typeof sbx.rstHealthBadge, 'function');
    assert.ok(!/^async/.test(sbx.rstHealthBadge.toString().trim()));
  });
});
