'use strict';
/* COACHING MASTERY OS — PHASE 7 (Academy + ICF-aligned competency development).

   Guarantees this suite defends:
     · Academy references canonical authorities and never restates them, so a
       curriculum tag that stops resolving is a test failure, not a silent lie.
     · Reading is not mastery: no state means "mastered", and nothing but a
       coach action moves a unit forward.
     · Recommendations are deterministic and explainable, and speak at the
       confidence the evidence supports — one session is never a verdict.
     · Nothing here claims an ICF credential, level, or score.
     · Child/youth and coaching-vs-therapy teaching never tells a coach to
       keep coaching past a stop condition.
     · Academy invents no storage: same private collection, same non-persistent
       client, same bounded network policy. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const FILES = ['33-academy-domain.js', '34-academy-units-core.js', '35-academy-units-craft.js',
  '36-academy-engine.js', '37-academy-store.js', '38-academy-ui.js'];
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
function exec(src) { return code(src).replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"/g, "''"); }
const deq = (a, e, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), e, m);

function fakeDb() {
  const store = {};
  const dead = () => new Promise(() => { });
  const hung = p => store.__hang || (store.__hangPaths || []).some(s => p.indexOf(s) >= 0);
  function docRef(p) {
    return {
      _path: p,
      get() { return hung(p) ? dead() : Promise.resolve({ exists: p in store, data() { return store[p]; }, ref: docRef(p), metadata: { hasPendingWrites: false } }); },
      set(d, o) { if (hung(p)) return dead(); store[p] = (o && o.merge) ? Object.assign({}, store[p], JSON.parse(JSON.stringify(d))) : JSON.parse(JSON.stringify(d)); return Promise.resolve(); },
      update(d) {
        if (hung(p)) return dead();
        if (!(p in store)) return Promise.reject(new Error('not-found'));
        const next = JSON.parse(JSON.stringify(store[p]));
        Object.keys(d).forEach(dotted => {
          const parts = dotted.split('.');
          let cur = next;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          const leaf = parts[parts.length - 1], v = d[dotted];
          if (v && typeof v === 'object' && typeof v.__inc === 'number') cur[leaf] = (Number(cur[leaf]) || 0) + v.__inc;
          else cur[leaf] = JSON.parse(JSON.stringify(v));
        });
        store[p] = next;
        return Promise.resolve();
      },
      delete() { delete store[p]; return Promise.resolve(); },
      collection(n) { return colRef(p + '/' + n); }
    };
  }
  function colRef(p) {
    const q = { limit: 1000 };
    const api = {
      _path: p, doc(id) { return docRef(p + '/' + id); }, orderBy() { return api; },
      limit(n) { q.limit = n; return api; },
      get() {
        if (hung(p)) return dead();
        const pre = p + '/';
        const keys = Object.keys(store).filter(k => k.indexOf(pre) === 0 && k.slice(pre.length).indexOf('/') < 0).slice(0, q.limit);
        return Promise.resolve({ size: keys.length, forEach(cb) { keys.forEach(k => cb({ id: k.slice(pre.length), data() { return store[k]; }, ref: docRef(k) })); } });
      }
    };
    return api;
  }
  return { _store: store, collection(n) { return colRef(n); } };
}
function ready(sb) {
  sb.setInterval = () => 0; sb.clearInterval = () => { }; sb.gotoTab = t => { sb.tab = t; };
  sb.CLOUD.uid = 'OWNER1';
  sb.CLOUD.user = { uid: 'OWNER1', email: 'o@x.com', isAnonymous: false };
  sb.COACHING_CLIENT.db = fakeDb();
  sb.COACHING_CLIENT.ready = true; sb.COACHING_CLIENT.authedUid = 'OWNER1';
  sb.COACHING_CLIENT.persistent = false;
  sb.coachingClientEnsure = () => Promise.resolve(sb.COACHING_CLIENT);
  sb.COACHING_WRITE_TIMEOUT_MS = 200;
  sb.COACHING.enabled = true;
  return sb;
}
const dbOf = sb => sb.COACHING_CLIENT.db;
const devKeys = sb => Object.keys(dbOf(sb)._store).filter(k => k.indexOf('coachingDevelopment/') > 0);
const obs = (code, type, sessionId, category) => ({ code, observationType: type, sessionId, category: category || null });

/* ── CURRICULUM ────────────────────────────────────────────────────────────── */
describe('A. Curriculum references, never restates', () => {
  test('A1. every reference resolves against its canonical registry', () => {
    const sb = createSandbox();
    const r = sb.academyIntegrity();
    assert.equal(r.ok, true, (r.errors || []).join('\n'));
    assert.ok(r.units >= 20, 'a real curriculum, not a stub: ' + r.units);
    assert.equal(r.paths, 7);
  });
  test('A2. unit ids are unique and stable', () => {
    const sb = createSandbox();
    const ids = sb.ACADEMY_UNIT_ORDER;
    assert.equal(new Set(ids).size, ids.length);
    ids.forEach(id => assert.match(id, /^[A-Z][A-Z0-9_]+$/, id));
  });
  test('A3. no prerequisite cycle and no forward reference', () => {
    const sb = createSandbox();
    const seen = {};
    sb.ACADEMY_UNIT_ORDER.forEach(id => {
      sb.academyUnit(id).prerequisites.forEach(p => {
        assert.ok(seen[p], id + ' requires ' + p + ' which is not defined before it');
      });
      seen[id] = true;
    });
  });
  test('A4. Academy defines no competency, intervention or anti-pattern of its own', () => {
    /* a second definition would drift from the authority and teach the wrong thing */
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/COACHING_ANTIPATTERNS\s*\[[^\]]*\]\s*=/.test(e), false, n);
      assert.equal(/COACHING_INTERVENTIONS\s*\[[^\]]*\]\s*=/.test(e), false, n);
      assert.equal(/coachingRegisterIntervention|coachingRegisterApproach|coachingRegisterSource/.test(e), false, n);
      assert.equal(/COACHING_EVIDENCE_GRADES\s*=/.test(e), false, n);
    });
  });
  test('A5. every unit teaches observable behaviour, not sentiment', () => {
    const sb = createSandbox();
    sb.ACADEMY_UNIT_ORDER.forEach(id => {
      const u = sb.academyUnit(id);
      assert.ok(u.objectives.length >= 1, id);
      assert.ok(u.principles.length >= 3, id + ' needs real principles');
      assert.ok(u.goodPractice.length >= 3, id);
      assert.ok(u.weakPractice.length >= 3, id);
      assert.ok(u.realSessionApplication.length >= 1, id + ' must reach a real session');
      assert.ok(u.reflectionPrompts.length >= 1, id);
    });
  });
  test('A6. every weak/better pair explains why', () => {
    const sb = createSandbox();
    let pairs = 0;
    sb.ACADEMY_UNIT_ORDER.forEach(id => {
      sb.academyUnit(id).moments.forEach(m => {
        pairs++;
        assert.ok(m.weak.length > 5 && m.better.length > 5, id);
        assert.ok(m.why.length > 40, id + ': a pair without reasoning is a script, not teaching');
      });
    });
    assert.ok(pairs >= 15, 'expected a real body of examples, got ' + pairs);
  });
  test('A7. evidence grades are valid and popularity never upgrades one', () => {
    const sb = createSandbox();
    const grades = sb.academyEvidenceGrades();
    assert.ok(Object.keys(grades).length >= 4);
    sb.ACADEMY_UNIT_ORDER.forEach(id => {
      const u = sb.academyUnit(id);
      assert.ok(['A', 'B', 'C', 'D'].indexOf(u.evidenceGrade) >= 0, id);
      if (u.sourceRefs.length) assert.ok(u.sourceRefs.every(s => sb.coachingSource(s)), id);
    });
  });
  test('A8. an unverified source stays unverified', () => {
    const sb = createSandbox();
    const ref = sb.coachingSource('icf.referral');
    assert.equal(ref.verified, false, 'Y1 must not be silently upgraded by Phase 7');
    /* and no unit leans on it */
    sb.ACADEMY_UNIT_ORDER.forEach(id => {
      assert.equal(sb.academyUnit(id).sourceRefs.indexOf('icf.referral'), -1, id);
    });
  });
  test('A9. anti-patterns are linked by canonical id', () => {
    const sb = createSandbox();
    const linked = new Set();
    sb.ACADEMY_UNIT_ORDER.forEach(id => sb.academyUnit(id).antiPatternTags.forEach(t => linked.add(t)));
    assert.ok(linked.size >= 8, 'expected broad anti-pattern coverage, got ' + linked.size);
    linked.forEach(t => assert.ok(sb.COACHING_ANTIPATTERNS[t], t));
  });
  test('A10. the Listening Lab is taught, never inferred', () => {
    const sb = createSandbox();
    assert.equal(sb.ACADEMY_LISTENING_KEYS.length, 10);
    ['FACTS', 'EMOTION', 'VALUES', 'ASSUMPTIONS', 'NEEDS', 'CONTRADICTIONS', 'ENERGY',
      'CHANGE_TALK', 'SUSTAIN_TALK', 'UNSPOKEN'].forEach(k =>
        assert.ok(sb.ACADEMY_LISTENING_KEYS.indexOf(k) >= 0, k));
    /* no layer is ever inferred from note or transcript text: the engine and
       the curriculum never reach for either (the UI may show the coach the
       reflection they themselves typed, which is not evidence) */
    ['33-academy-domain.js', '34-academy-units-core.js', '35-academy-units-craft.js',
      '36-academy-engine.js'].forEach(n => {
        const e = exec(F(n));
        assert.equal(/noteText|transcript|\bnote\b/.test(e), false, n);
      });
  });
});

/* ── ICF HONESTY ───────────────────────────────────────────────────────────── */
describe('B. ICF alignment stays developmental', () => {
  test('B1. no unit claims a level, score or credential', () => {
    const sb = createSandbox();
    deq(sb.academyClaimAudit(), { ok: true, hits: [] });
  });
  test('B2. no ACC/PCC/MCC or pass-fail language anywhere in Phase 7', () => {
    FILES.forEach(n => {
      /* strip comments and the forbidden-claim guard itself — the guard has to
         contain the words in order to reject them */
      const src = code(F(n)).replace(/ACADEMY_FORBIDDEN_CLAIMS\s*=[^;]+;/, '');
      assert.equal(/\bACC\b|\bPCC\b|\bMCC\b/.test(src), false, n);
      assert.equal(/geçti\/kaldı|pass\s*\/\s*fail/i.test(src), false, n);
    });
  });
  test('B3. the disclaimer denies exactly the things it must', () => {
    const sb = createSandbox();
    const d = sb.ACADEMY_DISCLAIMER;
    ['resmî ICF', 'akredite', 'değerlendirme'].forEach(w =>
      assert.ok(d.indexOf(w) >= 0, 'disclaimer must mention ' + w));
  });
  test('B4. competency vocabulary comes from the Mirror map', () => {
    const sb = createSandbox();
    const canon = Object.keys(sb.COACHING_ICF_AREA).map(k => sb.COACHING_ICF_AREA[k]);
    sb.ACADEMY_UNIT_ORDER.forEach(id => {
      sb.academyUnit(id).competencyTags.forEach(t =>
        assert.ok(canon.indexOf(t) >= 0, id + ' coined a competency: ' + t));
    });
  });
});

/* ── LEARNING STATE ────────────────────────────────────────────────────────── */
describe('C. Learning state is honest about what it knows', () => {
  test('C1. there is no MASTERED state', () => {
    const sb = createSandbox();
    assert.equal(sb.ACADEMY_STATES.indexOf('MASTERED'), -1);
    FILES.forEach(n => assert.equal(/MASTERED|ustalaştı|uzmanlaştı/.test(code(F(n))), false, n));
  });
  test('C2. an unknown state is refused', () => {
    const sb = createSandbox();
    assert.equal(sb.academyCanTransition('REVIEWED', 'MASTERED'), false);
    assert.equal(sb.academyBuildUnitState('FND_ETHICS', 'MASTERED'), null);
    assert.equal(sb.academyBuildUnitState('NOT_A_UNIT', 'REVIEWED'), null);
  });
  test('C3. a unit with no record reads as NOT_STARTED', () => {
    const sb = createSandbox();
    assert.equal(sb.academyUnitStateOf([], 'FND_ETHICS'), 'NOT_STARTED');
    assert.equal(sb.academyProgress([]).started, 0);
  });
  test('C4. the state record stores an id, never the curriculum text', () => {
    const sb = createSandbox();
    const rec = sb.academyBuildUnitState('CORE_QUESTIONS', 'REVIEWED');
    const j = JSON.stringify(rec);
    assert.ok(j.indexOf('CORE_QUESTIONS') >= 0);
    assert.equal(j.indexOf(sb.academyUnit('CORE_QUESTIONS').principles[0]), -1,
      'curriculum text must never be copied into user data');
    assert.equal(rec.id, 'acu_CORE_QUESTIONS', 'stable id so a re-save overwrites');
  });
  test('C5. a self-report is marked as a claim, not a measurement', () => {
    const sb = createSandbox();
    const rec = sb.academyBuildUnitState('CORE_SILENCE', 'APPLIED', { appliedSelfReport: 'EVET' });
    assert.equal(rec.appliedSelfReport, 'EVET');
    assert.equal(rec.selfReported, true);
  });
  test('C6. reflections are optional and bounded', () => {
    const sb = createSandbox();
    assert.equal(sb.academyBuildReflection('CORE_SILENCE', '   '), null);
    const long = sb.academyBuildReflection('CORE_SILENCE', 'x'.repeat(5000));
    assert.ok(long.body.length <= sb.ACADEMY_REFLECTION_MAX);
  });
});

/* ── RECOMMENDATIONS ───────────────────────────────────────────────────────── */
describe('D. Recommendations are deterministic and explainable', () => {
  const evOf = (sb, list, records, practice) => sb.academyGatherEvidence(list, records || [], practice || null);
  test('D1. the same evidence always yields the same list', () => {
    const sb = createSandbox();
    const list = [obs('QUESTION_STACKING', 'WATCH', 's1'), obs('LOW_REFLECTION', 'WATCH', 's2')];
    const a = sb.academyRecommend(evOf(sb, list), []);
    const b = sb.academyRecommend(evOf(sb, list), []);
    deq(a, JSON.parse(JSON.stringify(b)));
  });
  test('D2. never more than three', () => {
    const sb = createSandbox();
    const many = ['QUESTION_STACKING', 'LOW_REFLECTION', 'SILENCE_AVOIDANCE', 'ADVICE_RISK',
      'PREMATURE_ACTION', 'WEAK_CLOSURE'].map((c, i) => obs(c, 'WATCH', 's' + i));
    const r = sb.academyRecommend(evOf(sb, many), []);
    assert.ok(r.length <= sb.ACADEMY_MAX_RECOMMENDATIONS, r.length);
    assert.equal(sb.ACADEMY_MAX_RECOMMENDATIONS, 3);
  });
  test('D3. every recommendation explains itself', () => {
    const sb = createSandbox();
    const r = sb.academyRecommend(evOf(sb, [obs('QUESTION_STACKING', 'WATCH', 's1')]), []);
    assert.ok(r.length >= 1);
    r.forEach(x => {
      assert.ok(x.why.length > 20, 'no explanation: ' + JSON.stringify(x));
      assert.ok(x.reason.length > 5);
      assert.ok(sb.academyUnit(x.unitId), x.unitId);
    });
  });
  test('D4. one session speaks cautiously; ten speaks of a pattern', () => {
    const sb = createSandbox();
    const one = sb.academyRecommend(evOf(sb, [obs('QUESTION_STACKING', 'WATCH', 's1')]), []);
    assert.equal(one[0].confidence, 'SINIRLI_KANIT');
    assert.ok(one[0].why.indexOf('Bu görüşmede') >= 0, one[0].why);

    const three = sb.academyRecommend(evOf(sb,
      ['a', 'b', 'c'].map(s => obs('QUESTION_STACKING', 'WATCH', s))), []);
    assert.equal(three[0].confidence, 'OLUSAN_ORUNTU');

    const ten = sb.academyRecommend(evOf(sb,
      Array.from({ length: 10 }, (_, i) => obs('QUESTION_STACKING', 'WATCH', 's' + i))), []);
    assert.equal(ten[0].confidence, 'DAHA_GUCLU_ORUNTU');
  });
  test('D5. sparse evidence never becomes a label about the person', () => {
    const sb = createSandbox();
    const r = sb.academyRecommend(evOf(sb, [obs('QUESTION_STACKING', 'WATCH', 's1')]), []);
    const text = JSON.stringify(r);
    assert.equal(/kötü bir koç|zayıf koç|yetersizsin|kişiliğin|her zaman|hep böyle/i.test(text), false, text);
  });
  test('D6. a strength can drive a recommendation too', () => {
    const sb = createSandbox();
    const r = sb.academyRecommend(evOf(sb, [obs('CLIENT_AGENCY', 'STRENGTH', 's1')]), []);
    assert.ok(r.length >= 1);
    assert.ok(r.some(x => /Güçlü olduğun/.test(x.reason)), JSON.stringify(r));
  });
  test('D7. the active deliberate practice outranks everything', () => {
    const sb = createSandbox();
    const practice = sb.coachingBuildPractice('PRACTICE_HOLD_SILENCE');
    const r = sb.academyRecommend(evOf(sb, [obs('QUESTION_STACKING', 'WATCH', 's1')], [], practice), []);
    assert.equal(r[0].unitId, 'CORE_SILENCE', JSON.stringify(r));
    assert.ok(r[0].why.indexOf('Aktif pratiğin') >= 0);
  });
  test('D8. a disputed observation stops driving recommendations', () => {
    const sb = createSandbox();
    const o = { code: 'QUESTION_STACKING', observationType: 'WATCH', sessionId: 's1', category: 'QUESTIONING' };
    const feedback = [{ kind: 'feedback', observationCode: 'QUESTION_STACKING', id: 'fb1' }];
    const ev = sb.academyGatherEvidence([o], feedback, null);
    assert.equal(ev.codes.length, 0, 'the coach said this is not what happened');
    const r = sb.academyRecommend(ev, feedback);
    assert.equal(r.every(x => x.unitId !== 'CORE_QUESTIONS'), true, JSON.stringify(r));
  });
  test('D9. with no evidence it teaches the beginning and says so', () => {
    const sb = createSandbox();
    const r = sb.academyRecommend(sb.academyGatherEvidence([], [], null), []);
    assert.equal(r.length, 1);
    assert.ok(r[0].why.indexOf('Henüz görüşme kanıtı yok') >= 0, r[0].why);
    assert.equal(sb.academyUnit(r[0].unitId).level, 'FOUNDATION');
  });
  test('D10. a dismissed unit stops being offered', () => {
    const sb = createSandbox();
    const ev = sb.academyGatherEvidence([obs('QUESTION_STACKING', 'WATCH', 's1')], [], null);
    const first = sb.academyRecommend(ev, [])[0];
    const after = sb.academyRecommend(ev, [], { dismissed: [first.unitId] });
    assert.equal(after.every(x => x.unitId !== first.unitId), true);
  });
  test('D11. nothing in the engine calls a model or the network', () => {
    const e = exec(F('36-academy-engine.js'));
    assert.equal(/fetch\(|XMLHttpRequest|WebSocket|openai|anthropic|embedding|vector/i.test(e), false);
  });
});

/* ── KNOWLEDGE CHECKS ──────────────────────────────────────────────────────── */
describe('E. Knowledge checks teach, they do not grade', () => {
  test('E1. every check has exactly one stronger option and reasons for all', () => {
    const sb = createSandbox();
    const ids = Object.keys(sb.ACADEMY_CHECKS);
    assert.ok(ids.length >= 3, ids.length);
    ids.forEach(id => {
      const c = sb.academyCheck(id);
      assert.ok(sb.academyUnit(c.unitId), id + ' points at no unit');
      assert.ok(c.options.length >= 3, id);
      assert.equal(c.options.filter(o => o.best).length, 1, id);
      c.options.forEach(o => assert.ok(o.why.length > 30, id + '/' + o.key + ' has no reasoning'));
    });
  });
  test('E2. answering returns reasoning, never a score', () => {
    const sb = createSandbox();
    const r = sb.academyAnswerCheck('CHK_ADVICE', 'B');
    assert.ok(r.explanation.length > 30);
    assert.ok(r.bestExplanation.length > 30);
    assert.equal('score' in r, false);
    assert.equal('passed' in r, false);
    assert.equal('correct' in r, false, 'a wrong answer is a learning opportunity, not a failure state');
  });
  test('E3. the safety check never rewards continuing to coach', () => {
    const sb = createSandbox();
    const c = sb.academyCheck('CHK_SCOPE');
    const best = c.options.filter(o => o.best)[0];
    assert.ok(/durdur/i.test(best.text), best.text);
    c.options.filter(o => !o.best).forEach(o =>
      assert.equal(/^.*devam.*$/i.test(o.why) && !/değildir|meşrulaştır|güvenli değil/i.test(o.why), false, o.why));
  });
});

/* ── SAFETY ────────────────────────────────────────────────────────────────── */
describe('F. Safety education is correct', () => {
  test('F1. child/youth coaching is not simplified adult coaching', () => {
    const sb = createSandbox();
    const u = sb.academyUnit('CTX_YOUTH_CHILD');
    assert.ok(u);
    const body = u.principles.join(' ') + u.goodPractice.join(' ') + u.weakPractice.join(' ');
    assert.ok(/veli|rıza/i.test(body), 'guardian consent must be taught');
    assert.ok(/güvenlik/i.test(body), 'safeguarding must be taught');
    assert.ok(/güç farkı/i.test(body), 'power imbalance must be taught');
    assert.ok(/gelişimsel|yaşa uygun/i.test(body), 'developmental appropriateness must be taught');
    assert.ok(u.contextTags.indexOf('child') >= 0 && u.contextTags.indexOf('youth') >= 0);
  });
  test('F2. no unit teaches coaching past a stop condition', () => {
    const sb = createSandbox();
    sb.ACADEMY_UNIT_ORDER.forEach(id => {
      const u = sb.academyUnit(id);
      u.goodPractice.forEach(g => {
        assert.equal(/kırmızı.*devam|devam et.*kriz|koçluğa devam/i.test(g), false, id + ': ' + g);
      });
    });
    const scope = sb.academyUnit('CTX_SCOPE_BOUNDARY');
    assert.ok(scope.weakPractice.some(w => /devam etmek/i.test(w)),
      'continuing past the boundary must be named as weak practice');
  });
  test('F3. the coaching/therapy boundary is first-class and non-diagnostic', () => {
    const sb = createSandbox();
    const u = sb.academyUnit('CTX_SCOPE_BOUNDARY');
    assert.equal(u.scopeZone, 'RED');
    const body = u.principles.join(' ');
    ['YEŞİL', 'SARI', 'KIRMIZI'].forEach(z => assert.ok(body.indexOf(z) >= 0, 'zone ' + z));
    assert.ok(/teşhis koymaz/i.test(body), 'must state the coach does not diagnose');
    assert.ok(/tedavi değildir/i.test(body), 'coaching must not be presented as treatment');
    assert.ok(u.antiPatternTags.indexOf('DIAGNOSIS_LANGUAGE') >= 0);
  });
  test('F4. Academy never re-implements the safety gate', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/coachingInstallSafetyGate|COACHING_SAFETY_SIGNALS\s*=/.test(e), false, n);
    });
  });
});

/* ── PERSISTENCE, PRIVACY, NETWORK ─────────────────────────────────────────── */
describe('G. Academy invents no storage and leaks nothing', () => {
  test('G1. learning state lands in the private development collection', async () => {
    const sb = ready(createSandbox());
    const r = await sb.academySaveUnitState('FND_ETHICS', 'REVIEWED');
    assert.equal(r.ok, true, JSON.stringify(r));
    const keys = devKeys(sb);
    assert.equal(keys.length, 1, keys.join('\n'));
    assert.ok(keys[0].indexOf('users/OWNER1/coachingDevelopment/') === 0, keys[0]);
    assert.equal(Object.keys(dbOf(sb)._store).some(k => k.indexOf('app/state') >= 0), false);
  });
  test('G2. a reflection is owner-private and stores no curriculum copy', async () => {
    const sb = ready(createSandbox());
    const r = await sb.academySaveReflection('CORE_SILENCE', 'Sessizlik bana zor geliyor.');
    assert.equal(r.ok, true);
    const rec = dbOf(sb)._store[devKeys(sb)[0]];
    assert.equal(rec.kind, 'academy_reflection');
    assert.equal(rec.body, 'Sessizlik bana zor geliyor.');
    assert.equal(JSON.stringify(rec).indexOf(sb.academyUnit('CORE_SILENCE').principles[0]), -1);
  });
  test('G3. adopting a practice reuses the Phase 6 architecture', async () => {
    const sb = ready(createSandbox());
    const r = await sb.academyAdoptPractice('CORE_SILENCE');
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.practice.kind, 'practice', 'must be a canonical practice record');
    assert.equal(r.practice.code, 'PRACTICE_HOLD_SILENCE');
    assert.equal(r.unitState.state, 'PRACTICING');
    /* the one-active-practice rule still lives in Phase 6, not here */
    const e = exec(F('37-academy-store.js'));
    assert.equal(/ACTIVE.*status|activePractice\s*=/.test(e), false);
    assert.ok(/coachingBuildPractice/.test(code(F('37-academy-store.js'))));
  });
  test('G4. every Academy network call is bounded', async () => {
    const sb = ready(createSandbox());
    dbOf(sb)._store.__hang = true;
    const t0 = Date.now();
    const w = await sb.academySaveUnitState('FND_ETHICS', 'REVIEWED');
    const r = await sb.academyLoadRecords();
    assert.ok(Date.now() - t0 < 5000, 'a call hung');
    assert.equal(w.ok, false);
    assert.equal(r.ok, false);
    assert.ok(['connection_required', 'write_failed', 'read_failed'].indexOf(w.error) >= 0, w.error);
  });
  test('G5. a failed save never claims success', async () => {
    const sb = ready(createSandbox());
    dbOf(sb)._store.__hang = true;
    const r = await sb.academySaveReflection('CORE_SILENCE', 'kaydedilmeyecek');
    assert.equal(r.ok, false);
    assert.equal(devKeys(sb).length, 0);
  });
  test('G5b. a failed reflection save keeps what the coach typed', async () => {
    /* same rule as the Phase 6 close form: validation or connection failure
       may refuse the write, but it may never destroy unsaved words */
    const sb = ready(createSandbox());
    sb.ACADEMY_UI.records = [];
    sb.academyOpenUnit('CORE_SILENCE');
    const TYPED = 'Sessizlik bana zor geliyor ve bunu kaydetmek istiyorum.';
    sb.ge('academy_reflect').value = TYPED;
    dbOf(sb)._store.__hang = true;
    await sb.academySaveReflectionNow();
    delete dbOf(sb)._store.__hang;
    assert.ok(sb.ACADEMY_UI.error, 'the coach must be told it did not save');
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf(TYPED) >= 0, 'the unsaved reflection was wiped from the screen');
    assert.equal(devKeys(sb).length, 0, 'nothing was persisted');
  });
  test('G5c. a saved reflection clears the draft and survives a re-render', async () => {
    const sb = ready(createSandbox());
    sb.ACADEMY_UI.records = [];
    sb.academyOpenUnit('CORE_SILENCE');
    sb.ge('academy_reflect').value = 'kaydedilecek';
    await sb.academySaveReflectionNow();
    assert.equal(sb.ACADEMY_UI.error, null);
    sb.renderAcademyUnit();
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf('kaydedilecek') >= 0);
  });
  test('G5e. retrying a reflection converges on one record per unit', async () => {
    /* a queued offline write can still land; a retry must overwrite it rather
       than leave the coach with two copies of the same thought */
    const sb = ready(createSandbox());
    sb.ACADEMY_UI.records = [];
    sb.academyOpenUnit('CORE_LISTENING');
    const TXT = 'Aynı düşünce, iki kez kaydedilmemeli.';
    sb.ge('academy_reflect').value = TXT;
    await sb.academySaveReflectionNow();
    sb.ge('academy_reflect').value = TXT;
    await sb.academySaveReflectionNow();
    const reflections = devKeys(sb).map(k => dbOf(sb)._store[k])
      .filter(r => r.kind === 'academy_reflection');
    assert.equal(reflections.length, 1, 'one reflection per unit, not one per attempt');
    assert.equal(reflections[0].body, TXT);
    assert.equal(reflections[0].id, 'acr_CORE_LISTENING', 'stable address');
  });
  test('G5d. a draft never leaks into another unit', async () => {
    const sb = ready(createSandbox());
    sb.ACADEMY_UI.records = [];
    sb.academyOpenUnit('CORE_SILENCE');
    sb.ge('academy_reflect').value = 'sadece sessizlik icin';
    dbOf(sb)._store.__hang = true;
    await sb.academySaveReflectionNow();
    delete dbOf(sb)._store.__hang;
    sb.academyOpenUnit('CORE_QUESTIONS');
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.equal(html.indexOf('sadece sessizlik icin'), -1, 'a draft belongs to one unit');
  });
  test('G6. no browser storage, no app state, no second client', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/localStorage|sessionStorage|indexedDB|openDatabase/.test(e), false, n);
      assert.equal(/enablePersistence|firebase\.initializeApp|CLOUD\.db/.test(e), false, n);
      assert.equal(/\bD\.(academy|learning|units)\b/.test(e), false, n);
    });
  });
  test('G7. purge removes Academy records only', async () => {
    const sb = ready(createSandbox());
    await sb.academySaveUnitState('FND_ETHICS', 'REVIEWED');
    await sb.academySaveReflection('CORE_SILENCE', 'not');
    const practice = sb.coachingBuildPractice('PRACTICE_HOLD_SILENCE');
    await sb.coachingSaveDevelopmentDoc(practice);
    assert.equal(devKeys(sb).length, 3);
    const load = await sb.academyLoadRecords();
    const res = await sb.academyPurge(load.records);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.purged, 2, 'only the two Academy records');
    const left = devKeys(sb).map(k => dbOf(sb)._store[k].kind);
    deq(left, ['practice'], 'the deliberate practice must survive');
  });
});

/* ── WIRING AND REGRESSION ─────────────────────────────────────────────────── */
describe('H. Wiring, UI and regression', () => {
  test('H1. every Academy module is loaded once, with a cache-bust tag', () => {
    FILES.forEach(n => {
      const hits = INDEX.split('js/' + n + '?v=').length - 1;
      assert.equal(hits, 1, n + ' appears ' + hits + ' times');
      assert.match(INDEX, new RegExp('js/' + n.replace(/\./g, '\\.') + '\\?v=2026\\.08-academy-[a-z0-9]+'), n);
    });
  });
  test('H2. the academy route exists and one nav entry is added', () => {
    const boot = code(F('12-render-boot.js'));
    assert.match(boot, /academy\s*:\s*function/);
    const nav = code(F('28-coaching-workspace.js'));
    assert.match(nav, /id\s*:\s*'academy'/);
    /* added once, never duplicated */
    assert.match(nav, /_navAcademy/);
  });
  test('H3. the mirror and public copies stay byte-identical', () => {
    FILES.concat(['12-render-boot.js', '28-coaching-workspace.js']).forEach(n => {
      assert.equal(fs.readFileSync(path.join(ROOT, 'js', n), 'utf8'),
        fs.readFileSync(path.join(ROOT, 'public', 'js', n), 'utf8'), n);
    });
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
  });
  test('H4. every module stays under the size limit', () => {
    FILES.forEach(n => assert.ok(F(n).split('\n').length < 900, n + ' ' + F(n).split('\n').length));
  });
  test('H5. the home screen renders without any learning history', () => {
    const sb = ready(createSandbox());
    sb.ACADEMY_UI.records = [];
    sb.ACADEMY_UI.recommendations = sb.academyRecommend(sb.academyGatherEvidence([], [], null), []);
    sb.renderAcademyHome();
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf('Akademi') >= 0);
    assert.ok(html.indexOf('Öğrenme Yolları') >= 0 || html.indexOf('ÖĞRENME YOLLARI') >= 0);
    assert.equal(/%\s*\d|yüzde \d/.test(html), false, 'no fake progress percentage');
    assert.ok(html.indexOf(sb.ACADEMY_DISCLAIMER) >= 0);
  });
  test('H6. a unit renders every required section', () => {
    const sb = ready(createSandbox());
    sb.ACADEMY_UI.records = [];
    sb.ACADEMY_UI.unitId = 'CORE_SILENCE';
    sb.renderAcademyUnit();
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    ['ÖĞREN', 'FARK ET', 'DENE', 'DÜŞÜN', 'GERÇEK GÖRÜŞMEDE UYGULA', 'AYNA İLE BAĞLANTISI',
      'Kaynaklar ve kanıt düzeyi'].forEach(s =>
        assert.ok(html.indexOf(s) >= 0, 'missing section: ' + s));
    /* authored teaching content must actually reach the screen */
    const u = sb.academyUnit('CORE_SILENCE');
    assert.ok(html.indexOf('Güçlü uygulama') >= 0 && html.indexOf('Zayıf uygulama') >= 0);
    assert.ok(html.indexOf(u.goodPractice[0]) >= 0, 'goodPractice is never rendered');
    assert.ok(html.indexOf(u.weakPractice[0]) >= 0, 'weakPractice is never rendered');
    assert.ok(html.indexOf(u.objectives[0]) >= 0);
    assert.ok(html.indexOf(u.principles[0]) >= 0);
  });
  test('H7. the ICF view carries the developmental disclaimer and no score', () => {
    const sb = ready(createSandbox());
    sb.ACADEMY_UI.records = [];
    sb.renderAcademyIcf();
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf(sb.COACHING_ICF_DISCLAIMER) >= 0);
    assert.equal(/\bACC\b|\bPCC\b|\bMCC\b/.test(html), false);
    /* "puan" may appear only inside the sentence that denies scoring */
    const withoutDisclaimers = html.split(sb.COACHING_ICF_DISCLAIMER).join(' ')
      .split(sb.ACADEMY_DISCLAIMER).join(' ');
    assert.equal(/puan|seviyen|skor/i.test(withoutDisclaimers), false, 'a score claim outside the denial');
  });
  test('H8. no gamification anywhere in Phase 7', () => {
    FILES.forEach(n => {
      const src = code(F(n));
      assert.equal(/\bXP\b|rozet|badge|streak|liderlik tablosu|leaderboard|madalya|trophy/i.test(src), false, n);
    });
  });
  test('H9. Phase 6 and the live workspace still work', async () => {
    const sb = ready(createSandbox());
    const c = await sb.coachingSessionCreate({ context: 'adult', purpose: 'x', relationLabel: 'A' });
    assert.equal(c.ok, true, JSON.stringify(c));
    const p = await sb.coachingSessionPatch(c.session, { lifecycle: 'active' }, { type: 'update' });
    const done = await sb.coachingCompleteSession(p.session,
      { insight: 'i', reflection: 'r', commitment: { source: 'coachee', text: 't' } });
    assert.equal(done.ok, true, JSON.stringify(done));
    const gen = await sb.coachingGenerateMirror(done.session,
      { coacheeCommitment: true, insightRecorded: true, coachReflectionRecorded: true });
    assert.equal(gen.ok, true);
    assert.ok(gen.mirror.observations.length > 0);
    /* counters from fix 2 and boundedness from fix 3 still hold */
    const st = dbOf(sb)._store['users/OWNER1/coachingSessions/' + c.session.id];
    const events = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/events/') > 0).length;
    assert.equal(st.counters.events, events);
    assert.equal(st.counters.commitments, 1);
  });
  test('H10. no AI, audio or transcript surface was introduced', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/getUserMedia|MediaRecorder|SpeechRecognition|webkitSpeech|whisper/i.test(e), false, n);
    });
  });
});
