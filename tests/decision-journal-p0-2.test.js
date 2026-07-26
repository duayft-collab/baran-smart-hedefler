'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('./harness.js');

describe('CRUD', () => {
  test('1. decisionCreate geçerli varsayılanlarla oluşturur', () => {
    const sbx = createSandbox();
    const res = sbx.decisionCreate({ decision: 'Yeni ERP arama motorunu değiştireceğiz.' });
    assert.equal(res.ok, true);
    assert.equal(res.decision.status, 'open');
    assert.ok(res.decision.id);
    assert.ok(res.decision.decidedAt);
    assert.ok(res.decision.reviewAt);
    assert.equal(res.decision.result, null);
    assert.equal(res.decision.resolvedAt, null);
  });
  test('2. decisionCreate boş decision reddeder', () => {
    const sbx = createSandbox();
    const res = sbx.decisionCreate({ decision: '   ' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'EMPTY_DECISION');
  });
  test('3. decisionUpdate alanları günceller', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar A' });
    const upd = sbx.decisionUpdate(c.decision.id, { title: 'Yeni başlık', evidenceLink: 'https://x.com' });
    assert.equal(upd.ok, true);
    assert.equal(upd.decision.title, 'Yeni başlık');
    assert.equal(upd.decision.evidenceLink, 'https://x.com');
  });
  test('4. decisionResolve status=resolved yapar, resolvedAt setler', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar B' });
    const res = sbx.decisionResolve(c.decision.id, { actualOutcome: 'İyi gitti', result: 'as_expected', lessonLearned: 'Ders X' });
    assert.equal(res.ok, true);
    assert.equal(res.decision.status, 'resolved');
    assert.ok(res.decision.resolvedAt);
    assert.equal(res.decision.result, 'as_expected');
  });
  test('5. decisionResolve geçersiz result reddeder', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar C' });
    const res = sbx.decisionResolve(c.decision.id, { result: 'bogus' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'INVALID_RESULT');
  });
  test('6. decisionDelete siler', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar D' });
    const del = sbx.decisionDelete(c.decision.id);
    assert.equal(del.ok, true);
    assert.equal(del.deleted, true);
    assert.equal(sbx.decisionById(c.decision.id), null);
  });
  test('7. decisionDelete olmayan id için no-op', () => {
    const sbx = createSandbox();
    const del = sbx.decisionDelete('never-existed');
    assert.equal(del.ok, true);
    assert.equal(del.deleted, false);
  });
});

describe('reviewAt / review_due (hesaplanan, saklanmayan)', () => {
  test('8. Geçmiş reviewAt + open -> review_due sayılır', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar E', reviewAt: '2000-01-01T00:00:00.000Z' });
    const due = sbx.decisionsReviewDue();
    assert.equal(due.length, 1);
    assert.equal(due[0].id, c.decision.id);
  });
  test('9. resolved kararlar review_due\'da görünmez', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar F', reviewAt: '2000-01-01T00:00:00.000Z' });
    sbx.decisionResolve(c.decision.id, { result: 'as_expected' });
    assert.equal(sbx.decisionsReviewDue().length, 0);
  });
});

describe('Relations entegrasyonu', () => {
  test('10. decision -> principle used_in ilişkisi kurulabilir', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar G' });
    const rel = sbx.relAdd({ sourceType: 'decision', sourceId: c.decision.id, targetType: 'principle', targetId: 'p1', relationType: 'used_in' });
    assert.equal(rel.ok, true);
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id).length, 1);
  });
  test('11. Aynı decision ilişkisi duplicate oluşturmaz', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar H' });
    const args = { sourceType: 'decision', sourceId: c.decision.id, targetType: 'principle', targetId: 'p1', relationType: 'used_in' };
    sbx.relAdd(args);
    sbx.relAdd(args);
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id).length, 1);
  });
  test('12. principle -> decision derived_from (ters yön) backlink ile bulunur', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar I' });
    sbx.relAdd({ sourceType: 'principle', sourceId: 'p1', targetType: 'decision', targetId: c.decision.id, relationType: 'derived_from' });
    const inc = sbx.getIncomingRelations('decision', c.decision.id);
    assert.equal(inc.length, 1);
    assert.equal(inc[0].sourceType, 'principle');
  });
});

describe('Dangling relation güvenliği', () => {
  test('13. Silinmiş decision\'a işaret eden ilişki çökme yaratmaz, sessizce atlanır', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar J' });
    sbx.relAdd({ sourceType: 'principle', sourceId: 'p1', targetType: 'decision', targetId: c.decision.id, relationType: 'derived_from' });
    sbx.decisionDelete(c.decision.id);
    assert.doesNotThrow(() => {
      const related = sbx.getRelatedEntities('principle', 'p1');
      assert.equal(related.length, 0); // hedef silindiği için filtrelendi
    });
    // ham ilişki verisi kaybolmadı
    assert.equal(sbx.getIncomingRelations('decision', c.decision.id).length, 1);
  });
});

describe('Backup / Restore', () => {
  function payloadWith(decisions) {
    return {
      goals: [], todos: [], habits: [], quotes: [], kpis: [], journal: [],
      principles: [], coaching: [], sops: [], gtdInbox: [], questions: [],
      mybooks: [], challenges: [], vault: [], generalNotes: [], wisdomQuotes: [], logs: [],
      relations: [], decisions: decisions || []
    };
  }
  test('14. countRecords decisions sayısını içerir', () => {
    const sbx = createSandbox();
    const c = sbx.countRecords(payloadWith([{ id: 'd1' }, { id: 'd2' }]));
    assert.equal(c.decisions, 2);
  });
  test('15. DIFF_SCHEMA decisions değişimini hesaplar', () => {
    const sbx = createSandbox();
    const current = payloadWith([{ id: 'd1', decision: 'x', status: 'open', createdAt: '1', updatedAt: '1' }]);
    const backup = payloadWith([]);
    const pv = sbx.buildRestorePreview(current, backup, { sourceRevision: 1, targetRevision: 0 });
    assert.ok(pv.perModule.decisions);
    assert.equal(pv.perModule.decisions.removed, 1);
  });
  test('16. decisions kritik modül DEĞİL', () => {
    const sbx = createSandbox();
    assert.ok(sbx.IMPACT_RULES.criticalModules.indexOf('decisions') < 0);
  });
});

describe('State uyumluluğu', () => {
  test('17. Eski payload\'da decisions yoksa [] oluşur', () => {
    const sbx = createSandbox();
    const state = sbx.buildStateFromPayload({});
    assert.deepEqual(JSON.parse(JSON.stringify(state.decisions)), []);
  });
});

describe('Resolver', () => {
  test('18. decision resolver RELATION_RESOLVERS\'da kayıtlı', () => {
    const sbx = createSandbox();
    assert.ok(Object.prototype.hasOwnProperty.call(sbx.RELATION_RESOLVERS, 'decision'));
  });
  test('19. decision resolver doğru label döndürür', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Karar K', title: 'Özel Başlık' });
    const r = sbx.relResolve('decision', c.decision.id);
    assert.ok(r);
    assert.equal(r.label, 'Özel Başlık');
  });
  test('20. silinmiş decision için resolver null döner', () => {
    const sbx = createSandbox();
    assert.equal(sbx.relResolve('decision', 'ghost-id'), null);
  });
});

describe('Regresyon — dokunulmaması gereken dosyalar', () => {
  function assertUnchanged(files) {
    const { execSync } = require('node:child_process');
    const diff = execSync('git diff --stat -- ' + files.join(' '), { cwd: __dirname + '/..' }).toString();
    assert.equal(diff.trim(), '');
  }
  test('21. Restore Engine / Restore UI dokunulmadı', () => {
    assertUnchanged(['js/06-restore-engine.js', 'js/11-restore-ui.js', 'public/js/06-restore-engine.js', 'public/js/11-restore-ui.js']);
  });
  test('22. General Notes / Wisdom UI dokunulmadı', () => {
    // 11d-principles.js P0-3'te BİLİNÇLİ olarak dokunuldu (genel _pAfterSave kancası,
    // 2 satır) — decision-journal-p0-3.test.js'in kendi regresyon/relations testleri
    // bu değişikliğin davranışı bozmadığını doğruluyor (bkz. testler 30/31/40).
    // 11a/11b QUOTES-CONSOLIDATION-P1 Step 5A'da BİLİNÇLİ değişti (kompakt UX); wisdom-ux-p0-step5a
    // testleri davranışın korunduğunu doğrular. 11c QUOTES-CONSOLIDATION-P1 Step 5E'de BİLİNÇLİ
    // değişti (import güvenlik korumaları); wisdom-io-safety-p1-step5e testleri davranışı doğrular.
    // 11f/11g dokunulmadı.
    assertUnchanged(['js/11f-principles-display.js', 'js/11g-wisdom-migration.js']);
  });
  test('23. 11h-relations.js dokunulmadı (yeni resolver ayrı dosyada kaydedildi)', () => {
    assertUnchanged(['js/11h-relations.js', 'public/js/11h-relations.js']);
  });
});
