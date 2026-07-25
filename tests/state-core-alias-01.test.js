'use strict';
/* STATE-CORE-ALIAS-01 — loadData()/buildStateFromPayload() must not alias the shared
   module-level INIT. A payload missing a field previously shared INIT's array/object
   reference, so user edits cross-mutated INIT (persistence-integrity hole). These tests
   pin: (a) no returned field is reference-equal to INIT, (b) mutating the loaded state
   never touches INIT, (c) values are still identical to the old shallow-merge result. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

function canon(sbx, v) {
  // Use the app's own canonical serializer when present, else JSON.
  return typeof sbx.canonicalStringify === 'function'
    ? sbx.canonicalStringify(v)
    : JSON.stringify(v);
}

describe('STATE-CORE-ALIAS-01 — buildStateFromPayload', () => {
  test('1. field ABSENT from payload is not reference-equal to INIT', () => {
    const sbx = createSandbox();
    // payload has goals but deliberately omits quotes / wisdomQuotes / decisions / relations
    const payload = { goals: [{ id: 1, title: 'g' }] };
    const st = sbx.buildStateFromPayload(payload);
    assert.notEqual(st.quotes, sbx.INIT.quotes, 'quotes aliases INIT.quotes');
    assert.notEqual(st.wisdomQuotes, sbx.INIT.wisdomQuotes, 'wisdomQuotes aliases INIT');
    assert.notEqual(st.decisions, sbx.INIT.decisions, 'decisions aliases INIT');
    assert.notEqual(st.relations, sbx.INIT.relations, 'relations aliases INIT');
  });

  test('2. mutating an absent field does NOT mutate INIT', () => {
    const sbx = createSandbox();
    const initQuotesLenBefore = sbx.INIT.quotes.length;
    const st = sbx.buildStateFromPayload({ goals: [] }); // no quotes
    st.quotes.push({ id: 999999, text: 'injected', author: 'x', cat: 'y' });
    assert.equal(sbx.INIT.quotes.length, initQuotesLenBefore, 'INIT.quotes was mutated');
  });

  test('3. field PRESENT in payload wins over INIT (value + own reference)', () => {
    const sbx = createSandbox();
    const st = sbx.buildStateFromPayload({ quotes: [{ id: 7, text: 'p', author: 'a', cat: 'c' }] });
    assert.equal(st.quotes.length, 1);
    assert.equal(st.quotes[0].id, 7);
    assert.notEqual(st.quotes, sbx.INIT.quotes);
  });

  test('4. value-equivalent to old shallow-merge for a full payload (no behavior drift)', () => {
    const sbx = createSandbox();
    const payload = { goals: [{ id: 1, title: 'g' }], quotes: [{ id: 2, text: 't', author: 'a', cat: 'c' }] };
    const st = sbx.buildStateFromPayload(payload);
    // The expected value is Object.assign over INIT with the documented deep-merges.
    const INIT = sbx.INIT;
    const expected = Object.assign({}, INIT, payload, {
      routines: Object.assign({}, INIT.routines, payload.routines || {}),
      stats: Object.assign({}, INIT.stats, payload.stats || {}),
      compat: Object.assign({}, INIT.compat, payload.compat || {})
    });
    assert.equal(canon(sbx, st), canon(sbx, expected));
  });

  test('5. deep-merged nested object (routines) still merges, not aliases', () => {
    const sbx = createSandbox();
    const weeklyBefore = sbx.INIT.routines.weekly.length; // INIT ships seed routines
    const st = sbx.buildStateFromPayload({ routines: { daily: [{ id: 5, t: 'x', last: null }] } });
    assert.equal(st.routines.daily.length, 1);
    assert.notEqual(st.routines, sbx.INIT.routines);
    // weekly (absent in payload) came from INIT but must be an independent copy
    assert.notEqual(st.routines.weekly, sbx.INIT.routines.weekly);
    st.routines.weekly.push({ id: 1, t: 'z', last: null });
    assert.equal(sbx.INIT.routines.weekly.length, weeklyBefore, 'INIT.routines.weekly was mutated');
  });
});

describe('STATE-CORE-ALIAS-01 — loadData', () => {
  test('6. loadData from a payload missing quotes does not alias INIT.quotes', () => {
    const sbx = createSandbox();
    sbx.localStorage.setItem('fu7', JSON.stringify({ goals: [{ id: 1, title: 'g' }] }));
    const st = sbx.loadData();
    assert.notEqual(st.quotes, sbx.INIT.quotes);
    const before = sbx.INIT.quotes.length;
    st.quotes.push({ id: 42, text: 'a', author: 'b', cat: 'c' });
    assert.equal(sbx.INIT.quotes.length, before, 'INIT.quotes mutated via loadData result');
  });

  test('7. loadData with no localStorage returns a fresh INIT clone (unchanged behavior)', () => {
    const sbx = createSandbox();
    sbx.localStorage.removeItem('fu7');
    const st = sbx.loadData();
    assert.notEqual(st, sbx.INIT);
    assert.notEqual(st.quotes, sbx.INIT.quotes);
    assert.equal(canon(sbx, st), canon(sbx, sbx.INIT));
  });

  test('8. loadData preserves saved field values (payload wins)', () => {
    const sbx = createSandbox();
    sbx.localStorage.setItem('fu7', JSON.stringify({ quotes: [{ id: 9, text: 'saved', author: 'me', cat: 'k' }] }));
    const st = sbx.loadData();
    assert.equal(st.quotes.length, 1);
    assert.equal(st.quotes[0].text, 'saved');
  });
});
