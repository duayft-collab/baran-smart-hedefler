'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const { createSandbox } = require('./harness.js');

function modalHtml(sbx) { return sbx.window.__lastModalHtml || ''; }
function pinnerHtml(sbx) { return sbx.__getElements()['pinner'] ? sbx.__getElements()['pinner'].innerHTML : ''; }

describe('Navigasyon', () => {
  test('1. Karar Günlüğü navigasyonda görünür (NAV kaynak metni)', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../js/08-ui-core.js', 'utf8');
    assert.ok(src.indexOf("id:'decisions'") >= 0);
    assert.ok(src.indexOf('Karar Günlüğü') >= 0);
  });
  test('2. Açıldığında doğru ekran render edilir (renderDecisions -> pinner)', () => {
    const sbx = createSandbox();
    sbx.renderDecisions();
    assert.ok(pinnerHtml(sbx).indexOf('Karar Günlüğü') >= 0);
    // pages map bağlantısı statik olarak kaynakta doğrulanır (12-render-boot.js boot kodu
    // çalıştırılamaz — gerçek initCloud/render zincirini tetikler)
    const fs = require('fs');
    const boot = fs.readFileSync(__dirname + '/../js/12-render-boot.js', 'utf8');
    assert.ok(boot.indexOf('decisions:renderDecisions') >= 0);
  });
});

describe('Liste', () => {
  test('3. Açık kararlar doğru listelenir', () => {
    const sbx = createSandbox();
    sbx.decisionCreate({ decision: 'Açık karar', reviewAt: '2999-01-01' });
    sbx.renderDecisions();
    assert.ok(pinnerHtml(sbx).indexOf('Açık Kararlar') >= 0);
    assert.ok(pinnerHtml(sbx).indexOf('Açık karar') >= 0);
  });
  test('4. Review zamanı gelenler ayrı listelenir', () => {
    const sbx = createSandbox();
    sbx.decisionCreate({ decision: 'Gecikmiş karar', reviewAt: '2000-01-01' });
    sbx.renderDecisions();
    const html = pinnerHtml(sbx);
    assert.ok(html.indexOf('İnceleme Zamanı Gelenler') >= 0);
    assert.ok(html.indexOf('Gecikmiş karar') >= 0);
    assert.ok(html.indexOf('Açık Kararlar') < 0); // yalnız due bölümünde, açık bölümde tekrar YOK
  });
  test('5. Sonuçlananlar doğru listelenir', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Çözülecek karar' });
    sbx.decisionResolve(c.decision.id, { result: 'as_expected' });
    sbx.renderDecisions();
    const html = pinnerHtml(sbx);
    assert.ok(html.indexOf('Sonuçlanan Kararlar') >= 0);
    assert.ok(html.indexOf('Beklendiği gibi') >= 0);
  });
  test('6. Arşivlenenler varsayılan görünümde gizlidir', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Arşivlenecek karar' });
    sbx.decisionArchive(c.decision.id);
    sbx.renderDecisions();
    assert.ok(pinnerHtml(sbx).indexOf('Arşivlenecek karar') < 0);
    assert.ok(pinnerHtml(sbx).indexOf('Arşivlenenleri Göster') >= 0);
    sbx.djToggleArchived();
    assert.ok(pinnerHtml(sbx).indexOf('Arşivlenecek karar') >= 0);
  });
  test('7. Boş durumda doğru empty-state görünür', () => {
    const sbx = createSandbox();
    sbx.renderDecisions();
    assert.ok(pinnerHtml(sbx).indexOf('Henüz karar eklemedin') >= 0);
  });
});

describe('Form', () => {
  test('8. Karar alanı zorunludur', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    sbx.ge('dj_decision').value = '   ';
    sbx.djFormSave('');
    assert.equal(sbx.D.decisions.length, 0);
    assert.ok(sbx.__getCapturedAlerts().length >= 1);
  });
  test('9. decidedAt otomatik oluşur', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    sbx.ge('dj_decision').value = 'Yeni bir karar metni';
    sbx.djFormSave('');
    assert.equal(sbx.D.decisions.length, 1);
    assert.ok(sbx.D.decisions[0].decidedAt);
  });
  test('10. reviewAt varsayılan +30 gündür (form alanı önceden dolu gelir)', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    const val = sbx.ge('dj_review').value; // YYYY-MM-DD
    const days = Math.round((new Date(val) - new Date(sbx._decNow().slice(0, 10))) / 86400000);
    assert.ok(days >= 29 && days <= 31);
  });
  test('11. Seçenek key\'leri otomatik oluşur', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    sbx.djOptAdd(); sbx.djOptText(0, 'Seçenek A metni');
    sbx.djOptAdd(); sbx.djOptText(1, 'Seçenek B metni');
    const collected = sbx.djCollectOptions();
    assert.deepEqual(JSON.parse(JSON.stringify(collected.options.map(o => o.key))), ['A', 'B']);
  });
  test('12. Seçili seçenek silinirse chosenOption temizlenir', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    sbx.djOptAdd(); sbx.djOptText(0, 'A metni');
    sbx.djOptAdd(); sbx.djOptText(1, 'B metni');
    sbx.djSetChosenIdx('1'); // B seçili
    sbx.djOptDel(1); // B silindi
    const collected = sbx.djCollectOptions();
    assert.equal(collected.chosenOption, '');
  });
  test('12b. Seçili olmayan daha önceki seçenek silinirse seçim doğru kayan indexe işaret eder', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    sbx.djOptAdd(); sbx.djOptText(0, 'A metni');
    sbx.djOptAdd(); sbx.djOptText(1, 'B metni');
    sbx.djSetChosenIdx('1'); // B seçili
    sbx.djOptDel(0); // A silindi, B artık index 0 -> key A
    const collected = sbx.djCollectOptions();
    assert.equal(collected.chosenOption, 'A');
    assert.equal(collected.options[0].text, 'B metni');
  });
  test('13. Geçersiz chosenOption kaydedilmez (boş seçenek filtrelenince chosenOption de temizlenir)', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    sbx.djOptAdd(); sbx.djOptText(0, '   '); // boş -> filtrelenecek
    sbx.djSetChosenIdx('0');
    const collected = sbx.djCollectOptions();
    assert.equal(collected.options.length, 0);
    assert.equal(collected.chosenOption, '');
  });
  test('14. Cancel write yapmaz', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    sbx.ge('dj_decision').value = 'Yazılmayacak karar';
    sbx.djFormCancel();
    assert.equal(sbx.D.decisions.length, 0);
  });
  test('15. Save yalnız bir kez kayıt oluşturur', () => {
    const sbx = createSandbox();
    sbx.djOpenForm();
    sbx.ge('dj_decision').value = 'Tek kayıt';
    sbx.djFormSave('');
    assert.equal(sbx.D.decisions.length, 1);
  });
});

describe('Düzenleme', () => {
  test('16. Mevcut karar doğru yüklenir', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Orijinal karar', title: 'Başlık X' });
    sbx.djOpenForm(c.decision.id);
    assert.equal(sbx.ge('dj_decision').value, 'Orijinal karar');
    assert.equal(sbx.ge('dj_title').value, 'Başlık X');
  });
  test('17. Güncelleme duplicate oluşturmaz', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Düzenlenecek karar' });
    sbx.djOpenForm(c.decision.id);
    sbx.ge('dj_title').value = 'Güncellenmiş başlık';
    sbx.djFormSave(c.decision.id);
    assert.equal(sbx.D.decisions.length, 1);
    assert.equal(sbx.D.decisions[0].title, 'Güncellenmiş başlık');
  });
  test('18. decisionUpdate status/resolvedAt değiştirmez', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Durumu sabit kalacak karar' });
    sbx.djOpenForm(c.decision.id);
    sbx.ge('dj_title').value = 'Yeni başlık';
    sbx.djFormSave(c.decision.id);
    assert.equal(sbx.D.decisions[0].status, 'open');
    assert.equal(sbx.D.decisions[0].resolvedAt, null);
  });
});

describe('Review', () => {
  test('19. Sonuç formu doğru açılır', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Gözden geçirilecek karar', expectedOutcome: 'İyi sonuç bekliyorum' });
    sbx.djOpenReview(c.decision.id);
    assert.ok(modalHtml(sbx).indexOf('Kararı Gözden Geçir') >= 0);
    assert.ok(modalHtml(sbx).indexOf('İyi sonuç bekliyorum') >= 0);
  });
  test('20. Sonuç netse decisionResolve() çağrılır', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Sonuçlanacak karar' });
    sbx.djOpenReview(c.decision.id);
    sbx.ge('dj_result').value = 'better_than_expected';
    sbx.ge('dj_actual').value = 'Beklenenden iyi gitti';
    sbx.djReviewSubmit(c.decision.id);
    assert.equal(sbx.D.decisions[0].status, 'resolved');
    assert.equal(sbx.D.decisions[0].result, 'better_than_expected');
    assert.ok(sbx.D.decisions[0].resolvedAt);
  });
  test('21. Sonuç net değilse status open kalır (Açık Bırak)', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Açık kalacak karar' });
    sbx.djOpenReview(c.decision.id);
    sbx.djReviewDefer(c.decision.id);
    assert.equal(sbx.D.decisions[0].status, 'open');
    assert.equal(sbx.D.decisions[0].resolvedAt, null);
  });
  test('21b. Sonuç seçilmeden Sonuçlandır denenirse reddedilir, status değişmez', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Yanlışlıkla sonuçlandırılmayacak karar' });
    sbx.djOpenReview(c.decision.id);
    sbx.djReviewSubmit(c.decision.id);
    assert.equal(sbx.D.decisions[0].status, 'open');
    assert.ok(sbx.__getCapturedAlerts().length >= 1);
  });
  test('22. Review tarihi ertelenebilir', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Ertelenecek karar', reviewAt: '2020-01-01' });
    sbx.djOpenReview(c.decision.id);
    sbx.ge('dj_new_review').value = '2030-01-01';
    sbx.djReviewDefer(c.decision.id);
    assert.equal(sbx.D.decisions[0].reviewAt, '2030-01-01');
  });
  test('23. successFactors[] doğru kaydedilir', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Faktörlü karar' });
    sbx.djOpenReview(c.decision.id);
    sbx.ge('dj_result').value = 'as_expected';
    sbx.ge('dj_success_factors').value = 'Disiplin, Zamanlama';
    sbx.djReviewSubmit(c.decision.id);
    assert.deepEqual(JSON.parse(JSON.stringify(sbx.D.decisions[0].successFactors)), ['Disiplin', 'Zamanlama']);
  });
  test('24. Result sınıflandırması doğru map edilir', () => {
    const sbx = createSandbox();
    assert.equal(sbx.djResultLabel('worse_than_expected'), 'Beklentiden kötü');
    assert.equal(sbx.djResultLabel('inconclusive'), 'Sonuç belirsiz');
  });
});

describe('Relations', () => {
  test('25. Principle bağlanır', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'İlkeye bağlanacak karar' });
    sbx.djPickerAdd(c.decision.id, 'principle', 'p-test-1');
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id).length, 1);
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id)[0].targetType, 'principle');
  });
  test('26. Wisdom Quote bağlanır', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Söze bağlanacak karar' });
    sbx.djPickerAdd(c.decision.id, 'wisdomQuote', 'wq-test-1');
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id)[0].targetType, 'wisdomQuote');
  });
  test('27. Goal bağlanır', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Hedefe bağlanacak karar' });
    sbx.djPickerAdd(c.decision.id, 'goal', 'g-test-1');
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id)[0].targetType, 'goal');
  });
  test('28. Duplicate relation oluşmaz', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Tekrar bağlanacak karar' });
    sbx.djPickerAdd(c.decision.id, 'principle', 'p-test-2');
    sbx.djPickerAdd(c.decision.id, 'principle', 'p-test-2');
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id).length, 1);
  });
  test('29. Bilinmeyen/dangling kayıt UI\'ı çökertmez', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Hayalet ilişkili karar' });
    sbx.relAdd({ sourceType: 'decision', sourceId: c.decision.id, targetType: 'principle', targetId: 'ghost-principle', relationType: 'related_to' });
    assert.doesNotThrow(() => { sbx.djOpenDetail(c.decision.id); });
    assert.ok(modalHtml(sbx).indexOf('İlişkili Kayıtlar (0)') >= 0); // dangling filtrelendi
  });
  test('30. Yeni ilke kaydedilince derived_from relation oluşur', () => {
    const sbx = createSandbox();
    const before = sbx.D.principles.length; // INIT örnek ilkeler dahil (91,92)
    const c = sbx.decisionCreate({ decision: 'Dersi ilkeye dönüşecek karar' });
    sbx.decisionResolve(c.decision.id, { result: 'as_expected', lessonLearned: 'Sabırlı ol.' });
    sbx.djNewPrincipleFromReview(c.decision.id);
    assert.equal(sbx.ge('p_statement').value, 'Sabırlı ol.');
    sbx.pFormSave('');
    const rels = sbx.getOutgoingRelations('decision', c.decision.id);
    assert.equal(rels.length, 1);
    assert.equal(rels[0].relationType, 'derived_from');
    assert.equal(rels[0].targetType, 'principle');
    assert.equal(sbx.D.principles.length, before + 1);
    assert.equal(sbx.D.principles[0].statement, 'Sabırlı ol.');
  });
  test('31. İlke kaydı iptal edilirse relation oluşmaz', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'İptal edilecek ders karar' });
    sbx.decisionResolve(c.decision.id, { result: 'as_expected', lessonLearned: 'Ders taslağı.' });
    sbx.djNewPrincipleFromReview(c.decision.id);
    sbx.pFormCancel();
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id).length, 0);
    // hayalet kanca sonraki alakasız bir ilke kaydında da ateşlenmemeli
    sbx.djOpenForm(); // decision formu kapalı senaryo, ayrı bir ilke akışı simülasyonu:
    sbx.openPrincipleForm();
    sbx.ge('p_statement').value = 'Alakasız yeni ilke.';
    sbx.pFormSave('');
    assert.equal(sbx.getOutgoingRelations('decision', c.decision.id).length, 0);
  });
});

describe('Arşiv / Silme', () => {
  test('32. Arşivlenen karar varsayılan listeden düşer', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Arşivlenecek karar 2' });
    sbx.tab = 'decisions';
    sbx.djArchive(c.decision.id);
    assert.equal(sbx.D.decisions[0].status, 'archived');
    assert.ok(pinnerHtml(sbx).indexOf('Arşivlenecek karar 2') < 0);
  });
  test('33. Silme confirmation olmadan gerçekleşmez', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Silinmeyecek karar' });
    sbx.__setConfirm(() => false);
    sbx.djDelete(c.decision.id);
    assert.equal(sbx.D.decisions.length, 1);
  });
  test('34. Silinen karar sonrası liste güncellenir', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Silinecek karar' });
    sbx.tab = 'decisions';
    sbx.__setConfirm(() => true);
    sbx.djDelete(c.decision.id);
    assert.equal(sbx.D.decisions.length, 0);
    assert.ok(pinnerHtml(sbx).indexOf('Silinecek karar') < 0);
  });
  test('35. Dangling relations UI\'ı çökertmez (decision silindikten sonra başka kayıt render edilir)', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Silinecek ve iz bırakacak karar' });
    sbx.relAdd({ sourceType: 'principle', sourceId: 'p-orphan', targetType: 'decision', targetId: c.decision.id, relationType: 'derived_from' });
    sbx.__setConfirm(() => true);
    sbx.djDelete(c.decision.id);
    assert.doesNotThrow(() => { sbx.getRelatedEntities('principle', 'p-orphan'); });
    assert.equal(sbx.getRelatedEntities('principle', 'p-orphan').length, 0);
  });
});

describe('Regresyon', () => {
  function assertUnchanged(files) {
    const diff = execSync('git diff --stat -- ' + files.join(' '), { cwd: __dirname + '/..' }).toString();
    assert.equal(diff.trim(), '');
  }
  test('36. Relations testleri yeşil (relFind/relAdd davranışı bozulmadı)', () => {
    const sbx = createSandbox();
    const r1 = sbx.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'goal', targetId: 'g1', relationType: 'used_in' });
    const r2 = sbx.relAdd({ sourceType: 'decision', sourceId: 'd1', targetType: 'goal', targetId: 'g1', relationType: 'used_in' });
    assert.equal(r1.created, true);
    assert.equal(r2.created, false);
  });
  test('37. Restore P0/P1/P2 dosyaları dokunulmadı', () => {
    assertUnchanged(['js/06-restore-engine.js', 'js/11-restore-ui.js', 'js/10-general-notes.js',
      'public/js/06-restore-engine.js', 'public/js/11-restore-ui.js', 'public/js/10-general-notes.js']);
  });
  test('38. Decision Journal altyapı testleri yeşil (temel CRUD hâlâ çalışıyor)', () => {
    const sbx = createSandbox();
    const c = sbx.decisionCreate({ decision: 'Regresyon karar' });
    assert.equal(c.ok, true);
    assert.equal(sbx.decisionById(c.decision.id).id, c.decision.id);
  });
  test('39. Wisdom Quotes UI dosyaları dokunulmadı', () => {
    assertUnchanged(['js/11a-wisdom-quotes.js', 'js/11b-wisdom-display.js', 'js/11c-wisdom-io.js',
      'public/js/11a-wisdom-quotes.js', 'public/js/11b-wisdom-display.js', 'public/js/11c-wisdom-io.js']);
  });
  test('40. Principles UI bozulmaz (pFormSave hâlâ normal kayıt oluşturur, kanca yokken de)', () => {
    const sbx = createSandbox();
    const before = sbx.D.principles.length;
    sbx.openPrincipleForm();
    sbx.ge('p_statement').value = 'Bağımsız ilke kaydı.';
    sbx.pFormSave('');
    assert.equal(sbx.D.principles.length, before + 1);
    assert.equal(sbx.D.principles[0].statement, 'Bağımsız ilke kaydı.');
  });
  test('41. Goals render mantığı (goal/todo/habit/routine) davranışsal olarak korunur', () => {
    // 09-goals.js QUOTES-CONSOLIDATION-P1 Step 4'te BİLİNÇLİ değişti: renderGenericList'in
    // legacy 'quotes' dalı kaldırıldı (Goals'un kendi hedef/görev/alışkanlık mantığı DEĞİL).
    // Bu değişikliğin kapsamı legacy-quotes-removal-p1-step4.test.js'te doğrulanıyor (diğer
    // generic listeler + hedef render'ı korunur). Burada yalnız hedef mantığı fonksiyonlarının
    // hâlâ tanımlı olduğunu statik doğrularız.
    const fs = require('node:fs');
    const src = fs.readFileSync(__dirname + '/../js/09-goals.js', 'utf8');
    ['function openGoalDetail(', 'function renderTodos(', 'function renderHabits(',
     'function renderRoutines(', 'function renderGenericList('].forEach(function(sig){
      assert.ok(src.indexOf(sig) >= 0, 'goal-logic function lost: ' + sig);
    });
  });
});
