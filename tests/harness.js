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
  const capturedAlerts = [];
  // P0-3: lazily-created mutable stub elements, shared by ge()/document.getElementById()/sh(),
  // so decision-journal-ui form functions (which read ge('field_id').value like real DOM code)
  // can be driven from tests without a real DOM. Does not change behavior for any prior
  // suite: none of them ever call ge()/getElementById() with an id expecting a real value.
  const elements = {};
  function getEl(id) {
    if (!Object.prototype.hasOwnProperty.call(elements, id)) {
      elements[id] = { id, value: '', checked: false, textContent: '', innerHTML: '', className: '',
        dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
        focus() {}, addEventListener() {}, appendChild() {}, querySelectorAll() { return []; } };
    }
    return elements[id];
  }
  let confirmReturn = true;
  const sandbox = {
    console,
    localStorage,
    // Real WebCrypto + text codecs so SHA-256 helpers (sha256Hex / wisdomStoreChecksum)
    // run against the same algorithm the backup verification uses. Additive: no prior
    // suite references crypto/TextEncoder, so behavior is unchanged for them.
    crypto: require('crypto').webcrypto,
    TextEncoder,
    TextDecoder,
    navigator: { onLine: true },
    confirm(msg) { return typeof sandbox.window.__confirmImpl === 'function' ? sandbox.window.__confirmImpl(msg) : confirmReturn; },
    alert(msg) { capturedAlerts.push(msg); },
    document: {
      createElement() { return { style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }; },
      getElementById(id) { return getEl(id); },
      body: { appendChild() {}, removeChild() {} },
      addEventListener() {}
    },
    // firebase stub: only Blob/FieldValue paths are touched inside functions we don't call in these tests
    firebase: {
      firestore: {
        Blob: undefined,
        FieldValue: {
          serverTimestamp() { return null; },
          /* increment sentinel — a fake db recognises it and applies the delta,
             so tests exercise the real atomic counter path rather than a
             read-modify-write stand-in that would hide lost updates */
          increment(n) { return { __inc: n }; }
        }
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
    ge(id) { return getEl(id); },
    sh(id, html) { const e = getEl(id); e.innerHTML = html; },
    snap() {},
    save() {},
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
  run(src('js/01b-identity.js'), '01b-identity.js');
  run(src('js/03-auth.js'), '03-auth.js');
  run(src('js/02-sync.js'), '02-sync.js');
  run(src('js/02b-wisdom-store.js'), '02b-wisdom-store.js');
  run(src('js/02c-wisdom-migration.js'), '02c-wisdom-migration.js');
  run(src('js/02d-wisdom-restore.js'), '02d-wisdom-restore.js');
  run(src('js/04-backup.js'), '04-backup.js');
  run(src('js/05-diff.js'), '05-diff.js');
  run(src('js/06-restore-engine.js'), '06-restore-engine.js');
  run(src('js/07-smart-coach.js'), '07-smart-coach.js');
  run(src('js/11a-wisdom-quotes.js'), '11a-wisdom-quotes.js');
  run(src('js/11c-wisdom-io.js'), '11c-wisdom-io.js');
  run(src('js/11b-wisdom-display.js'), '11b-wisdom-display.js');
  run(src('js/11d-principles.js'), '11d-principles.js');
  run(src('js/11g-wisdom-migration.js'), '11g-wisdom-migration.js');
  run(src('js/11h-relations.js'), '11h-relations.js');
  run(src('js/11i-decision-journal.js'), '11i-decision-journal.js');
  run(src('js/11j-decision-journal-ui.js'), '11j-decision-journal-ui.js');
  run(src('js/11k-relations-ui.js'), '11k-relations-ui.js');
  run(src('js/11l-goal-io.js'), '11l-goal-io.js');
  run(src('js/11m-goal-checkins.js'), '11m-goal-checkins.js');
  run(src('js/11n-goals-dashboard.js'), '11n-goals-dashboard.js');
  run(src('js/11o-goal-dependencies.js'), '11o-goal-dependencies.js');
  run(src('js/11p-goal-okr.js'), '11p-goal-okr.js');
  run(src('js/11q-wisdom-experience.js'), '11q-wisdom-experience.js');
  run(src('js/11r-goal-analytics.js'), '11r-goal-analytics.js');
  run(src('js/11s-wisdom-stats.js'), '11s-wisdom-stats.js');
  run(src('js/11t-wisdom-runtime-health.js'), '11t-wisdom-runtime-health.js');
  run(src('js/11u-wisdom-learning-center.js'), '11u-wisdom-learning-center.js');
  run(src('js/11v-wisdom-collections.js'), '11v-wisdom-collections.js');
  run(src('js/11w-wisdom-coach.js'), '11w-wisdom-coach.js');
  run(src('js/11x-wisdom-insight-analytics.js'), '11x-wisdom-insight-analytics.js');
  run(src('js/11y-wisdom-executive-review.js'), '11y-wisdom-executive-review.js');
  run(src('js/12a-wisdom-workspace.js'), '12a-wisdom-workspace.js');
  run(src('js/12b-wisdom-executive-intelligence.js'), '12b-wisdom-executive-intelligence.js');
  run(src('js/12c-wisdom-knowledge-os.js'), '12c-wisdom-knowledge-os.js');
  run(src('js/13-wisdom-integration.js'), '13-wisdom-integration.js');
  run(src('js/14-execution-engine.js'), '14-execution-engine.js');
  run(src('js/16-execution-os.js'), '16-execution-os.js');
  run(src('js/15-daily-workspace.js'), '15-daily-workspace.js');

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

  /* COACHING-P1: domain/privacy foundation. Loaded LAST so it cannot influence the
     load order any existing suite depends on. Side-effect free apart from registering
     the canonical 'coachingSession' relation resolver. */
  run(src('js/17-coaching-domain.js'), '17-coaching-domain.js');
  run(src('js/17b-coaching-client.js'), '17b-coaching-client.js');
  run(src('js/18-coaching-ethics.js'), '18-coaching-ethics.js');
  run(src('js/19-coaching-safeguard.js'), '19-coaching-safeguard.js');
  run(src('js/20-coaching-interventions.js'), '20-coaching-interventions.js');
  run(src('js/21-coaching-question-bank.js'), '21-coaching-question-bank.js');
  run(src('js/22-coaching-quality.js'), '22-coaching-quality.js');
  run(src('js/23-coaching-suggest.js'), '23-coaching-suggest.js');
  run(src('js/24-coaching-approaches.js'), '24-coaching-approaches.js');
  run(src('js/25-coaching-router.js'), '25-coaching-router.js');
  run(src('js/26-coaching-archive.js'), '26-coaching-archive.js');
  run(src('js/27-coaching-session-store.js'), '27-coaching-session-store.js');
  run(src('js/28-coaching-workspace.js'), '28-coaching-workspace.js');
  run(src('js/29-coaching-live.js'), '29-coaching-live.js');
  run(src('js/30-coaching-mirror.js'), '30-coaching-mirror.js');
  run(src('js/31-coaching-practice.js'), '31-coaching-practice.js');
  run(src('js/32-coaching-mirror-ui.js'), '32-coaching-mirror-ui.js');
  run(src('js/33-academy-domain.js'), '33-academy-domain.js');
  run(src('js/34-academy-units-core.js'), '34-academy-units-core.js');
  run(src('js/35-academy-units-craft.js'), '35-academy-units-craft.js');
  run(src('js/36-academy-engine.js'), '36-academy-engine.js');
  run(src('js/37-academy-store.js'), '37-academy-store.js');
  run(src('js/38-academy-ui.js'), '38-academy-ui.js');
  run(src('js/39-books-domain.js'), '39-books-domain.js');
  run(src('js/40-books-catalogue.js'), '40-books-catalogue.js');
  run(src('js/41-books-engine.js'), '41-books-engine.js');
  run(src('js/42-books-store.js'), '42-books-store.js');
  run(src('js/43-books-ui.js'), '43-books-ui.js');
  run(src('js/44-sim-domain.js'), '44-sim-domain.js');
  run(src('js/45-sim-scenarios.js'), '45-sim-scenarios.js');
  run(src('js/46-sim-engine.js'), '46-sim-engine.js');
  run(src('js/47-sim-debrief.js'), '47-sim-debrief.js');
  run(src('js/48-sim-store.js'), '48-sim-store.js');
  run(src('js/49-sim-ui.js'), '49-sim-ui.js');

  sandbox.__getCapturedModals = () => capturedModals;
  sandbox.__getCapturedAlerts = () => capturedAlerts;
  sandbox.__getElements = () => elements;
  sandbox.__setConfirm = (fn) => { sandbox.window.__confirmImpl = fn; };
  return sandbox;
}

module.exports = { createSandbox };
