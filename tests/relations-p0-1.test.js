'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

describe('A. Şema ve varsayılan', () => {
  test('1. Eski payload\'da relations yoksa [] oluşur', () => {
    const sbx = createSandbox();
    const state = sbx.buildStateFromPayload({});
    assert.deepEqual(JSON.parse(JSON.stringify(state.relations)), []);
  });
  test('2. Yeni relation geçerli varsayılanlarla oluşur', () => {
    const sbx = createSandbox();
    const res = sbx.relAdd({ sourceType: 'wisdomQuote', sourceId: 'w1', targetType: 'principle', targetId: 'p1' });
    assert.equal(res.ok, true);
    assert.equal(res.relation.relationType, 'related_to');
    assert.equal(res.relation.confidence, 'medium');
    assert.ok(res.relation.id);
    assert.ok(res.relation.createdAt);
    assert.ok(res.relation.updatedAt);
  });
  test('3. Geçersiz relationType reddedilir', () => {
    const sbx = createSandbox();
    const res = sbx.relAdd({ sourceType: 'wisdomQuote', sourceId: 'w1', targetType: 'principle', targetId: 'p1', relationType: 'bogus' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'INVALID_RELATION_TYPE');
  });
  test('4. Geçersiz confidence reddedilir', () => {
    const sbx = createSandbox();
    const res = sbx.relAdd({ sourceType: 'wisdomQuote', sourceId: 'w1', targetType: 'principle', targetId: 'p1', confidence: 'super-high' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'INVALID_CONFIDENCE');
  });
});

describe('B. Duplicate', () => {
  function base() { return { sourceType: 'wisdomQuote', sourceId: 'w1', targetType: 'principle', targetId: 'p1', relationType: 'used_in' }; }
  test('5. Aynı duplicate anahtarı ikinci kayıt oluşturmaz', () => {
    const sbx = createSandbox();
    sbx.relAdd(base());
    sbx.relAdd(base());
    assert.equal(sbx.relList().length, 1);
  });
  test('6. Aynı anahtar note günceller', () => {
    const sbx = createSandbox();
    sbx.relAdd(base());
    const res = sbx.relAdd(Object.assign({}, base(), { note: 'güncellendi' }));
    assert.equal(res.created, false);
    assert.equal(res.relation.note, 'güncellendi');
  });
  test('7. Aynı anahtar confidence günceller', () => {
    const sbx = createSandbox();
    sbx.relAdd(base());
    const res = sbx.relAdd(Object.assign({}, base(), { confidence: 'high' }));
    assert.equal(res.relation.confidence, 'high');
  });
  test('8. Farklı relationType ayrı kayıt oluşturur', () => {
    const sbx = createSandbox();
    sbx.relAdd(base());
    sbx.relAdd(Object.assign({}, base(), { relationType: 'derived_from' }));
    assert.equal(sbx.relList().length, 2);
  });
  test('9. Ters yön ayrı kayıt sayılır', () => {
    const sbx = createSandbox();
    sbx.relAdd(base());
    sbx.relAdd({ sourceType: 'principle', sourceId: 'p1', targetType: 'wisdomQuote', targetId: 'w1', relationType: 'used_in' });
    assert.equal(sbx.relList().length, 2);
  });
});

describe('C. Okuma', () => {
  test('10. outgoing doğru çalışır', () => {
    const sbx = createSandbox();
    sbx.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'principle', targetId: 'p1', relationType: 'used_in' });
    sbx.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'goal', targetId: 'g1', relationType: 'related_to' });
    sbx.relAdd({ sourceType: 'decision', sourceId: 'd2', targetType: 'principle', targetId: 'p2', relationType: 'used_in' });
    const out = sbx.getOutgoingRelations('decision', 'd1');
    assert.equal(out.length, 2);
  });
  test('11. incoming doğru çalışır', () => {
    const sbx = createSandbox();
    sbx.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'principle', targetId: 'p1', relationType: 'used_in' });
    sbx.relAdd({ sourceType: 'decision', sourceId: 'd2', targetType: 'principle', targetId: 'p1', relationType: 'used_in' });
    const inc = sbx.getIncomingRelations('principle', 'p1');
    assert.equal(inc.length, 2);
  });
  test('12. ilgili entity resolver ile çözülür', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [{ id: 'w1', quote: 'Test sözü', author: 'X' }];
    sbx.relAdd({ sourceType: 'principle', sourceId: 'p1', targetType: 'wisdomQuote', targetId: 'w1', relationType: 'inspired_by' });
    const related = sbx.getRelatedEntities('principle', 'p1');
    assert.equal(related.length, 1);
    assert.equal(related[0].entity.label, 'Test sözü');
  });
  test('13. bozuk targetId güvenli atlanır (getRelatedEntities filtrelenir)', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [];
    sbx.relAdd({ sourceType: 'principle', sourceId: 'p1', targetType: 'wisdomQuote', targetId: 'nonexistent', relationType: 'inspired_by' });
    const related = sbx.getRelatedEntities('principle', 'p1');
    assert.equal(related.length, 0);
    // ama ham ilişki listesi (raw) hâlâ mevcut -- veri kaybı yok
    assert.equal(sbx.getOutgoingRelations('principle', 'p1').length, 1);
  });
  test('14. bilinmeyen targetType UI/runtime çökertmez', () => {
    const sbx = createSandbox();
    assert.doesNotThrow(() => {
      const r = sbx.relResolve('never_registered_type', 'x');
      assert.equal(r, null);
    });
  });
});

describe('D. Resolver', () => {
  test('15. wisdomQuote resolver doğru label döndürür', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [{ id: 'w1', quote: 'Kısa bir söz', author: 'Y' }];
    const r = sbx.relResolve('wisdomQuote', 'w1');
    assert.ok(r);
    assert.equal(r.label, 'Kısa bir söz');
  });
  test('16. principle resolver doğru label döndürür', () => {
    const sbx = createSandbox();
    sbx.D.principles = [{ id: 'p1', title: 'Disiplin', statement: 'Uzun ilke metni' }];
    const r = sbx.relResolve('principle', 'p1');
    assert.ok(r);
    assert.equal(r.label, 'Disiplin');
  });
  test('17. goal resolver doğru label döndürür', () => {
    const sbx = createSandbox();
    sbx.D.goals = [{ id: 1, title: 'Hedef A' }];
    const r = sbx.relResolve('goal', 1);
    assert.ok(r);
    assert.equal(r.label, 'Hedef A');
  });
  test('18. silinmiş/yok kayıt null döndürür', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [];
    assert.equal(sbx.relResolve('wisdomQuote', 'ghost'), null);
  });
});

describe('E. CRUD', () => {
  test('19. relation eklenir', () => {
    const sbx = createSandbox();
    const res = sbx.relAdd({ sourceType: 'a', sourceId: '1', targetType: 'b', targetId: '2' });
    assert.equal(res.created, true);
    assert.equal(sbx.relList().length, 1);
  });
  test('20. relation güncellenir', () => {
    const sbx = createSandbox();
    const res = sbx.relAdd({ sourceType: 'a', sourceId: '1', targetType: 'b', targetId: '2' });
    const upd = sbx.relUpdate(res.relation.id, { note: 'yeni not', confidence: 'low' });
    assert.equal(upd.ok, true);
    assert.equal(upd.relation.note, 'yeni not');
    assert.equal(upd.relation.confidence, 'low');
  });
  test('21. relation silinir', () => {
    const sbx = createSandbox();
    const res = sbx.relAdd({ sourceType: 'a', sourceId: '1', targetType: 'b', targetId: '2' });
    const del = sbx.relDelete(res.relation.id);
    assert.equal(del.ok, true);
    assert.equal(del.deleted, true);
    assert.equal(sbx.relList().length, 0);
  });
  test('22. olmayan relation silme güvenli no-op olur', () => {
    const sbx = createSandbox();
    const del = sbx.relDelete('never-existed');
    assert.equal(del.ok, true);
    assert.equal(del.deleted, false);
  });
});

describe('F. Backup/restore', () => {
  function payloadWith(relations) {
    return {
      goals: [], todos: [], habits: [], quotes: [], kpis: [], journal: [],
      principles: [], coaching: [], sops: [], gtdInbox: [], questions: [],
      mybooks: [], challenges: [], vault: [], generalNotes: [], wisdomQuotes: [], logs: [],
      relations: relations || []
    };
  }
  test('23. DIFF_SCHEMA relations değişimini hesaplar', () => {
    const sbx = createSandbox();
    const current = payloadWith([{ id: 'r1', sourceType: 'a', sourceId: '1', targetType: 'b', targetId: '2', relationType: 'related_to', confidence: 'medium', note: '', createdAt: '1', updatedAt: '1' }]);
    const backup = payloadWith([]);
    const pv = sbx.buildRestorePreview(current, backup, { sourceRevision: 1, targetRevision: 0 });
    assert.ok(pv.perModule.relations);
    assert.equal(pv.perModule.relations.removed, 1);
  });
  test('24. countRecords relations sayısını içerir', () => {
    const sbx = createSandbox();
    const c = sbx.countRecords(payloadWith([{ id: 'r1' }, { id: 'r2' }]));
    assert.equal(c.relations, 2);
  });
  test('25. eski backup metadata relations eksikken bozulmaz', () => {
    const sbx = createSandbox();
    assert.equal(sbx.backupModuleCount({ goals: 3 }, 'relations'), null);
    assert.equal(sbx.backupModuleCount({ relations: 0 }, 'relations'), 0);
  });
  test('26. restore preview relations farkını gösterebilir (ekleme)', () => {
    const sbx = createSandbox();
    const current = payloadWith([]);
    const backup = payloadWith([{ id: 'r1', sourceType: 'a', sourceId: '1', targetType: 'b', targetId: '2', relationType: 'related_to', confidence: 'medium', note: '', createdAt: '1', updatedAt: '1' }]);
    const pv = sbx.buildRestorePreview(current, backup, { sourceRevision: 1, targetRevision: 2 });
    assert.equal(pv.perModule.relations.added, 1);
  });
  test('27. checksum/state round-trip relations\'ı kayıpsız korur', () => {
    const sbx = createSandbox();
    const payload = payloadWith([{ id: 'r1', sourceType: 'a', sourceId: '1', targetType: 'b', targetId: '2', relationType: 'used_in', confidence: 'high', note: 'x', createdAt: '1', updatedAt: '1' }]);
    const s1 = sbx.canonicalStringify(payload);
    const roundTripped = JSON.parse(JSON.stringify(payload));
    const s2 = sbx.canonicalStringify(roundTripped);
    assert.equal(s1, s2);
  });
  test('relations kritik modül DEĞİL (madde 12)', () => {
    const sbx = createSandbox();
    assert.ok(sbx.IMPACT_RULES.criticalModules.indexOf('relations') < 0);
  });
});

describe('G. Regresyon', () => {
  test('28. wisdomQuotes/principles/goals davranışı değişmez', () => {
    const sbx = createSandbox();
    sbx.D.wisdomQuotes = [{ id: 'w1', quote: 'x', author: 'y' }];
    sbx.D.principles = [{ id: 'p1', title: 't', statement: 's' }];
    assert.equal(sbx.wqById('w1').quote, 'x');
    assert.equal(sbx.pById('p1').title, 't');
  });
  test('29. ContentEngine (11e) dosyası hiç değişmedi', () => {
    const { execSync } = require('node:child_process');
    const diff = execSync('git diff --stat -- js/11e-content-display-core.js public/js/11e-content-display-core.js', { cwd: __dirname + '/..' }).toString();
    assert.equal(diff.trim(), '');
  });
  test('30a. Restore motoru dosyaları (06/11-restore-ui) bu fazda değişmedi', () => {
    const { execSync } = require('node:child_process');
    const diff = execSync('git diff --stat -- js/06-restore-engine.js js/11-restore-ui.js public/js/06-restore-engine.js public/js/11-restore-ui.js', { cwd: __dirname + '/..' }).toString();
    assert.equal(diff.trim(), '');
  });
});
