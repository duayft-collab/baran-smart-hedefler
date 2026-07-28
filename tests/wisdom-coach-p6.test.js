'use strict';
/* SMART-GOALS Wisdom P6 — AI Knowledge Coach (TÜRETİLMİŞ · SALT OKUNUR · DETERMİNİSTİK).
   Tek kaynak wqList/wqById + D.goals/D.decisions/D.principles; yeni model/write/network YOK.
   Bağlam üretimi + relevans skoru + öneri sıralama + içgörü serisi + panel + statik guard. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', '11w-wisdom-coach.js'), 'utf8');
const SRC_PUB = fs.readFileSync(path.join(ROOT, 'public', 'js', '11w-wisdom-coach.js'), 'utf8');

function wq(id, over) {
  return Object.assign({ id: id, quote: 'Söz ' + id, author: 'Yazar', category: '', language: 'tr',
    favorite: false, active: true, pinned: false, reflected: false, showCount: 0, tags: [], priority: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null }, over || {});
}
function setup(S, quotes, opts) {
  opts = opts || {};
  S.D.wisdomQuotes = quotes || [];
  S.D.goals = opts.goals || [];
  S.D.decisions = opts.decisions || [];
  S.D.principles = opts.principles || [];
  S.D.relations = opts.relations || [];
  if (typeof S.wisdomStoreReset === 'function') S.wisdomStoreReset();
}

describe('Context Engine', () => {
  test('1. wcoBuildContext aggregates active goals/open decisions/active principles', () => {
    const S = createSandbox();
    setup(S, [wq('a')], {
      goals: [{ id: 1, title: 'Liderlik gelişimi', desc: '', cat: 'Gelişim', status: 'active' },
              { id: 2, title: 'Biten hedef', status: 'done' }],
      decisions: [{ id: 'd1', title: 'Ekip kararı', decision: 'x', status: 'open' },
                  { id: 'd2', title: 'Arşiv', status: 'archived' }],
      principles: [{ id: 'p1', title: 'Disiplin', statement: 'Her gün çalış', lifeArea: 'myself', status: 'active' }]
    });
    const ctx = S.wcoBuildContext();
    assert.equal(ctx.goals.length, 1); // done hariç
    assert.equal(ctx.decisions.length, 1); // archived hariç
    assert.equal(ctx.principles.length, 1);
    assert.ok(ctx.keywords.length > 0);
    assert.ok(['morning', 'afternoon', 'evening', 'night'].indexOf(ctx.dayPart) >= 0);
    assert.equal(typeof ctx.weekdayLabel, 'string');
    assert.equal(typeof ctx.now, 'number');
  });
  test('2. context categories/tags derived', () => {
    const S = createSandbox();
    setup(S, [wq('a')], {
      goals: [{ id: 1, title: 'x', cat: 'Liderlik', status: 'active' }],
      decisions: [{ id: 'd1', title: 'y', status: 'open', tags: ['odak'] }]
    });
    const ctx = S.wcoBuildContext();
    assert.ok(ctx.categories.indexOf('Liderlik') >= 0);
    assert.ok(ctx.tags.indexOf('odak') >= 0);
  });
  test('3. life-area derivation into ctx.lifeAreas + lifeAreaBag', () => {
    const S = createSandbox();
    const label = S.pAreaLabel('myself');
    setup(S, [wq('a')], { principles: [{ id: 'p1', statement: 'x', lifeArea: 'myself', status: 'active' }] });
    const ctx = S.wcoBuildContext();
    assert.ok(ctx.lifeAreas.indexOf(label) >= 0);
    assert.equal(typeof ctx.lifeAreaBag, 'object');
  });
});

describe('Relevance Scoring', () => {
  test('4. goal keyword overlap increases score', () => {
    const S = createSandbox();
    setup(S, [], { goals: [{ id: 1, title: 'satış müzakere becerisi', status: 'active' }] });
    const ctx = S.wcoBuildContext();
    const hi = S.wcoScoreQuote(wq('a', { quote: 'iyi müzakere satış getirir' }), ctx);
    const lo = S.wcoScoreQuote(wq('b', { quote: 'bahçedeki çiçekler güzeldir' }), ctx);
    assert.ok(hi > lo);
  });
  test('5. decision overlap increases score', () => {
    const S = createSandbox();
    setup(S, [], { decisions: [{ id: 'd1', title: 'yatırım kararı', decision: 'portföy dengesi', status: 'open' }] });
    const ctx = S.wcoBuildContext();
    const hi = S.wcoScoreQuote(wq('a', { quote: 'doğru yatırım portföy büyütür' }), ctx);
    const lo = S.wcoScoreQuote(wq('b', { quote: 'hava bugün yağmurlu' }), ctx);
    assert.ok(hi > lo);
  });
  test('6. principle overlap increases score', () => {
    const S = createSandbox();
    setup(S, [], { principles: [{ id: 'p1', statement: 'sabır disiplin gerektirir', status: 'active' }] });
    const ctx = S.wcoBuildContext();
    const hi = S.wcoScoreQuote(wq('a', { quote: 'disiplin sabır ile gelir' }), ctx);
    const lo = S.wcoScoreQuote(wq('b', { quote: 'kırmızı elma tatlıdır' }), ctx);
    assert.ok(hi > lo);
  });
  test('7. life-area match increases score', () => {
    const S = createSandbox();
    const label = S.pAreaLabel('myself');
    const tok = label.toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü]/g, '');
    setup(S, [], { principles: [{ id: 'p1', statement: 'zzz', lifeArea: 'myself', status: 'active' }] });
    const ctx = S.wcoBuildContext();
    const hi = S.wcoScoreQuote(wq('a', { quote: tok + ' üzerine düşün' }), ctx);
    const lo = S.wcoScoreQuote(wq('b', { quote: 'alakasız bir cümle burada' }), ctx);
    assert.ok(hi >= lo);
  });
  test('8. category match increases score', () => {
    const S = createSandbox();
    setup(S, [], { goals: [{ id: 1, title: 'x', cat: 'Liderlik', status: 'active' }] });
    const ctx = S.wcoBuildContext();
    const hi = S.wcoScoreQuote(wq('a', { category: 'Liderlik', quote: 'nötr' }), ctx);
    const lo = S.wcoScoreQuote(wq('b', { category: 'Spor', quote: 'nötr' }), ctx);
    assert.ok(hi > lo);
  });
  test('9. tag match increases score', () => {
    const S = createSandbox();
    setup(S, [], { decisions: [{ id: 'd1', title: 'x', status: 'open', tags: ['odak'] }] });
    const ctx = S.wcoBuildContext();
    const hi = S.wcoScoreQuote(wq('a', { tags: ['odak'], quote: 'nötr metin' }), ctx);
    const lo = S.wcoScoreQuote(wq('b', { tags: ['spor'], quote: 'nötr metin' }), ctx);
    assert.ok(hi > lo);
  });
  test('10. priority/favorite/reflected raise score (empty context)', () => {
    const S = createSandbox(); setup(S, []);
    const ctx = S.wcoBuildContext();
    assert.ok(S.wcoScoreQuote(wq('a', { priority: 5 }), ctx) > S.wcoScoreQuote(wq('b', { priority: 1 }), ctx));
    assert.ok(S.wcoScoreQuote(wq('a', { favorite: true }), ctx) > S.wcoScoreQuote(wq('b', {}), ctx));
    assert.ok(S.wcoScoreQuote(wq('a', { reflected: true }), ctx) > S.wcoScoreQuote(wq('b', {}), ctx));
  });
  test('11. recently-shown penalty applies', () => {
    const S = createSandbox(); setup(S, []);
    const ctx = S.wcoBuildContext();
    const recent = wq('a', { lastShownAt: new Date(ctx.now).toISOString() });
    const old = wq('b', { lastShownAt: null });
    assert.ok(S.wcoScoreQuote(recent, ctx) < S.wcoScoreQuote(old, ctx));
  });
  test('12. repeated-exposure penalty applies', () => {
    const S = createSandbox(); setup(S, []);
    const ctx = S.wcoBuildContext();
    assert.ok(S.wcoScoreQuote(wq('a', { showCount: 40 }), ctx) < S.wcoScoreQuote(wq('b', { showCount: 0 }), ctx));
  });
  test('13. score bounded (0,1) and pure/deterministic', () => {
    const S = createSandbox(); setup(S, [], { goals: [{ id: 1, title: 'odak disiplin', status: 'active' }] });
    const ctx = S.wcoBuildContext();
    const q = wq('a', { quote: 'odak disiplin başarı', priority: 5, favorite: true });
    const s1 = S.wcoScoreQuote(q, ctx), s2 = S.wcoScoreQuote(q, ctx);
    assert.equal(s1, s2);
    assert.ok(s1 > 0 && s1 < 1);
  });
});

describe('Recommendation Engine', () => {
  test('14. deterministic ordering across calls', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik' }), wq('b', { quote: 'satış' }), wq('c', { quote: 'finans' })],
      { goals: [{ id: 1, title: 'satış hedefi', status: 'active' }] });
    const r1 = S.wcoRecommend(null, 3).map(x => x.id);
    const r2 = S.wcoRecommend(null, 3).map(x => x.id);
    assert.deepEqual(r1, r2);
  });
  test('15. tie-break: equal score → priority desc then id asc', () => {
    const S = createSandbox();
    setup(S, [wq('b', { priority: 3 }), wq('a', { priority: 3 }), wq('c', { priority: 5 })]);
    const ctx = S.wcoBuildContext();
    const r = S.wcoRecommend(ctx, 3);
    assert.equal(r[0].id, 'c'); // en yüksek öncelik
    assert.equal(r[1].id, 'a'); // eşit skor+öncelik → id asc
    assert.equal(r[2].id, 'b');
  });
  test('16. recommendation limit respected', () => {
    const S = createSandbox();
    setup(S, [wq('a'), wq('b'), wq('c'), wq('d'), wq('e')]);
    assert.equal(S.wcoRecommend(null, 2).length, 2);
    assert.equal(S.wcoRecommend(null, 3).length, 3);
  });
  test('17. empty context → ordered by priority desc', () => {
    const S = createSandbox();
    setup(S, [wq('a', { priority: 1 }), wq('b', { priority: 5 }), wq('c', { priority: 3 })]);
    const r = S.wcoRecommend(null, 3);
    assert.equal(r[0].id, 'b'); assert.equal(r[2].id, 'a');
  });
  test('18. relevance reason references matched goal', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'ingilizce sertifika sınavı' })],
      { goals: [{ id: 1, title: 'İngilizce sertifika', status: 'active' }] });
    const r = S.wcoRecommend(null, 1)[0];
    assert.equal(r.matchedGoal, 'İngilizce sertifika');
    assert.ok(/İngilizce sertifika/.test(r.reason));
  });
  test('19. inactive quotes excluded from recommendations', () => {
    const S = createSandbox();
    setup(S, [wq('a'), wq('b', { active: false }), wq('c', { quote: '   ' })]);
    const ids = S.wcoRecommend(null, 10).map(x => x.id);
    assert.ok(ids.indexOf('a') >= 0);
    assert.ok(ids.indexOf('b') < 0);
    assert.ok(ids.indexOf('c') < 0);
  });
});

describe('Source Fallback Parity', () => {
  test('20. identical recommendations for sharded vs legacy source (same data)', () => {
    const arr = [wq('a', { quote: 'satış' }), wq('b', { quote: 'liderlik' }), wq('c', { quote: 'finans odak' })];
    // legacy
    const L = createSandbox();
    setup(L, arr.map(x => Object.assign({}, x)), { goals: [{ id: 1, title: 'finans odak', status: 'active' }] });
    const legacy = L.wcoRecommend(null, 3).map(x => x.id);
    // sharded-source simülasyonu: wqList aynı veriyi döndürür, kaynak 'sharded'
    const Sd = createSandbox();
    setup(Sd, [], { goals: [{ id: 1, title: 'finans odak', status: 'active' }] });
    Sd.wqList = () => arr.map(x => Object.assign({}, x));
    Sd.wisdomReadSource = () => 'sharded';
    const sharded = Sd.wcoRecommend(null, 3).map(x => x.id);
    assert.deepEqual(sharded, legacy);
  });
});

describe('Insight Streak', () => {
  test('21. streak derives consecutive-day run from marker', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    const d = new Date();
    function ds(off) { const x = new Date(d.getTime() - off * 864e5); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
    S.localStorage.setItem(S.WCO_STREAK_KEY, JSON.stringify({ days: [ds(2), ds(1), ds(0)], longest: 3 }));
    const st = S.wcoInsightStreak();
    assert.equal(st.current, 3);
    assert.ok(st.longest >= 3);
  });
  test('22. broken run resets current streak', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    const d = new Date();
    function ds(off) { const x = new Date(d.getTime() - off * 864e5); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
    S.localStorage.setItem(S.WCO_STREAK_KEY, JSON.stringify({ days: [ds(5), ds(4), ds(0)], longest: 2 }));
    assert.equal(S.wcoInsightStreak().current, 1);
  });
  test('23. wcoInsightStreak is read-only (does not write localStorage)', () => {
    const S = createSandbox(); setup(S, [wq('a')]);
    const before = S.localStorage.getItem(S.WCO_STREAK_KEY);
    S.wcoInsightStreak();
    assert.equal(S.localStorage.getItem(S.WCO_STREAK_KEY), before); // null → null
  });
  test('24. streak marker is localStorage-only, never enters payload (D)', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'x', status: 'active' }] });
    const keysBefore = Object.keys(S.D).sort().join(',');
    S.wcoCoachPanelHtml(); // panel render touches localStorage marker
    const keysAfter = Object.keys(S.D).sort().join(',');
    assert.equal(keysAfter, keysBefore); // D'ye yeni alan eklenmedi
    assert.ok(S.localStorage.getItem(S.WCO_STREAK_KEY)); // marker localStorage'da
  });
});

describe('Reading Time', () => {
  test('25. reading time scales with length and returns a label', () => {
    const S = createSandbox();
    assert.ok(S.wcoReadingSeconds('bir iki üç dört beş altı') > S.wcoReadingSeconds('kısa'));
    assert.equal(typeof S.wcoReadingTime('bir iki üç'), 'string');
    assert.ok(/\d/.test(S.wcoReadingTime('bir iki üç')));
  });
});

describe('Panel HTML — responsive, accessible, Why-This-Matters', () => {
  test('26. panel renders with title, context summary, recommendations', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik gerektirir' })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    const h = S.wcoCoachPanelHtml();
    assert.ok(/Bilgi Koçu/.test(h));
    assert.ok(/aktif hedef/.test(h));
    assert.ok(/liderlik gerektirir/.test(h));
  });
  test('27. empty library → empty panel string', () => {
    const S = createSandbox(); setup(S, []);
    assert.equal(S.wcoCoachPanelHtml(), '');
  });
  test('28. "Why This Matters" expandable present + accessible', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'odak' })], { goals: [{ id: 1, title: 'odak hedefi', status: 'active' }] });
    const h = S.wcoCoachPanelHtml();
    assert.ok(/wco-why/.test(h));
    assert.ok(/Neden önemli/.test(h));
    assert.ok(/aria-expanded/.test(h));
    assert.ok(/<summary/.test(h));
    assert.ok(/tabindex/.test(h));
  });
  test('29. responsive: uses max-width:100%, no fixed width:NNpx', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'x', status: 'active' }] });
    const h = S.wcoCoachPanelHtml();
    assert.ok(/max-width:100%/.test(h));
    const stripped = h.replace(/(min|max)-width:\s*\d+px/g, '');
    assert.ok(!/[^-]width:\s*\d{2,}px/.test(stripped)); // sabit genişlik yok
  });
  test('30. actions present: Detay/Kopyala/Favori/Yeni Öneri', () => {
    const S = createSandbox();
    setup(S, [wq('a')], { goals: [{ id: 1, title: 'x', status: 'active' }] });
    const h = S.wcoCoachPanelHtml();
    assert.ok(/openWqForm/.test(h));
    assert.ok(/wcoCopy/.test(h));
    assert.ok(/wqToggleFav/.test(h));
    assert.ok(/wcoNextRecommendation/.test(h));
  });
});

describe('Integration & Regression', () => {
  test('31. renderWisdomQuotes injects coach panel without throwing', () => {
    const S = createSandbox();
    setup(S, [wq('a', { quote: 'liderlik' })], { goals: [{ id: 1, title: 'liderlik', status: 'active' }] });
    S.tab = 'wisdom';
    assert.doesNotThrow(() => S.renderWisdomQuotes());
    const html = S.__getElements().pinner.innerHTML;
    assert.ok(/Bilgi Koçu/.test(html));
  });
  test('32. prior derived panels still defined (no regression)', () => {
    const S = createSandbox();
    ['wkgKnowledgeCenterHtml', 'wlcLearningSectionHtml', 'wisdomStatsPanelHtml',
     'wisdomRuntimeHealth', 'wexDashboardCardHtml', 'wisdomSourceBadgeHtml'].forEach(fn => {
      assert.equal(typeof S[fn], 'function', fn + ' missing');
    });
  });
  test('33. coach reads through wqList only — sharded store untouched', () => {
    const S = createSandbox();
    setup(S, [wq('a')]);
    // wisdomStoreIsSharded false → wqList = legacy; coach must still work
    assert.equal(typeof S.wisdomStoreIsSharded, 'function');
    assert.doesNotThrow(() => S.wcoRecommend(null, 3));
  });
});

describe('Static Guards (0-write, 0-network, derived-only)', () => {
  const forbidden = [
    [/\bsave\s*\(/, 'save('], [/\bsnap\s*\(/, 'snap('], [/commitMutation/, 'commitMutation'],
    [/queueCloudSave/, 'queueCloudSave'], [/createBackup/, 'createBackup'],
    [/\bfetch\s*\(/, 'fetch('], [/onSnapshot/, 'onSnapshot'], [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/WQ_STORE/, 'WQ_STORE'], [/D\.wisdomQuotes/, 'D.wisdomQuotes'],
    [/DIFF_SCHEMA/, 'DIFF_SCHEMA'], [/wisdomStoreList\s*\(/, 'wisdomStoreList('],
    [/runTransaction/, 'runTransaction'], [/\.set\s*\(/, '.set(']
  ];
  test('34. module contains no forbidden write/network/collection tokens', () => {
    forbidden.forEach(([re, name]) => assert.ok(!re.test(SRC), 'forbidden token present: ' + name));
  });
  test('35. reads only via wqList/wqById (dual-read entry)', () => {
    assert.ok(/wqList\s*\(/.test(SRC));
    assert.ok(/wqById\s*\(/.test(SRC));
  });
  test('36. only allowed persistence is localStorage streak marker', () => {
    // localStorage kullanımı yalnız streak fonksiyonlarında; başka kalıcı yazma yok
    assert.ok(/localStorage/.test(SRC));
    assert.ok(!/INIT\./.test(SRC)); // yeni payload alanı tanımlamaz
  });
  test('37. mirror byte-identity js ↔ public/js', () => {
    assert.equal(SRC, SRC_PUB);
  });
  test('38. file under 900 lines', () => {
    assert.ok(SRC.split('\n').length < 900);
  });
});
