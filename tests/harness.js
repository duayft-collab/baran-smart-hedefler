'use strict';
/* RESTORE-UX-P0 test harness.
   Loads REAL, unmodified (except by our own edits) production source files into a
   Node vm sandbox with minimal browser stubs, so tests exercise actual app logic
   rather than a reimplementation. No files are written to; this is read-execute only. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
function src(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function extractLines(text, fromLine, toLine) {
  const lines = text.split('\n');
  return lines.slice(fromLine - 1, toLine).join('\n');
}

function createSandbox() {
  const store = {};
  const localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const capturedModals = [];
  const sandbox = {
    console,
    localStorage,
    navigator: { onLine: true },
    document: {
      createElement() { return { style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }; },
      getElementById() { return null; },
      body: { appendChild() {}, removeChild() {} },
      addEventListener() {}
    },
    // firebase stub: only Blob/FieldValue paths are touched inside functions we don't call in these tests
    firebase: {
      firestore: {
        Blob: undefined,
        FieldValue: { serverTimestamp() { return null; } }
      }
    },
    requestAnimationFrame(fn) { fn(); },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    // UI stubs — production render functions call these; we capture what matters
    ge() { return null; },
    sh() {},
    showModal(html) { capturedModals.push(html); sandbox.window.__lastModalHtml = html; },
    closeModal() {},
    render() {},
    renderAdminSystemStatusBar() {},
    tab: 'restore'
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  function run(code, filename) {
    vm.runInContext(code, sandbox, { filename });
  }

  // Load order matters: config -> state -> auth (canonicalStringify/BACKUP) -> backup -> diff -> restore UI bits
  run(src('js/00-config.js'), '00-config.js');
  run(src('js/01-state.js'), '01-state.js');
  run(src('js/03-auth.js'), '03-auth.js');
  run(src('js/04-backup.js'), '04-backup.js');
  run(src('js/05-diff.js'), '05-diff.js');
  run(src('js/06-restore-engine.js'), '06-restore-engine.js');
  run(src('js/11a-wisdom-quotes.js'), '11a-wisdom-quotes.js');
  run(src('js/11d-principles.js'), '11d-principles.js');
  run(src('js/11h-relations.js'), '11h-relations.js');

  // 10-general-notes.js: extract only the RESTORE_UI / rstRisk block (rest of the file
  // is unrelated "Genel Notlar" feature code with its own DOM-heavy dependencies).
  const gnText = src('js/10-general-notes.js');
  const startMarker = 'var RESTORE_UI=';
  const startIdx = gnText.indexOf(startMarker);
  if (startIdx < 0) throw new Error('RESTORE_UI block not found in 10-general-notes.js');
  const afterStart = gnText.slice(startIdx);
  const endMarker = '\nfunction rstRisk(pv){';
  const endFnIdx = afterStart.indexOf(endMarker);
  if (endFnIdx < 0) throw new Error('rstRisk not found in 10-general-notes.js');
  const afterFnStart = afterStart.slice(endFnIdx + 1); // start at "function rstRisk"
  const closeIdx = afterFnStart.indexOf('\n}\n');
  if (closeIdx < 0) throw new Error('rstRisk end not found');
  const restoreUiBlock = afterStart.slice(0, endFnIdx + 1) + afterFnStart.slice(0, closeIdx + 2);
  run(restoreUiBlock, '10-general-notes.js (RESTORE_UI slice)');

  run(src('js/11-restore-ui.js'), '11-restore-ui.js');

  sandbox.__getCapturedModals = () => capturedModals;
  return sandbox;
}

module.exports = { createSandbox };
