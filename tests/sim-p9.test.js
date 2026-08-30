'use strict';
/* COACHING MASTERY OS — PHASE 9 (deterministic simulator foundation).

   What this suite defends:
     · The product never claims to be AI. The only registered generator is
       DETERMINISTIC and the UI says so.
     · One generator boundary — a future server-side model replaces exactly
       that, and nothing else in the phase has to move.
     · The engine reads declared intent and counted structure, never meaning,
       and every debrief finding is traceable to one of those.
     · Safety outranks the generator absolutely.
     · Silence is a first-class intervention, not an empty message.
     · Hidden dynamics are never shown before a practice.
     · No score, no ICF level, no fake precision.
     · Practice evidence NEVER reaches the real Coach Mirror.
     · Personal state stays private and every call is bounded. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const F = n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8');
const FILES = ['44-sim-domain.js', '45-sim-scenarios.js', '46-sim-engine.js',
  '47-sim-debrief.js', '48-sim-store.js', '49-sim-ui.js'];
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function code(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); }
function exec(src) { return code(src).replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"/g, "''"); }

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
        if (!(p in store)) return Promise.reject(new Error('nf'));
        const next = JSON.parse(JSON.stringify(store[p]));
        Object.keys(d).forEach(dotted => {
          const parts = dotted.split('.'); let cur = next;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          const leaf = parts[parts.length - 1], v = d[dotted];
          if (v && typeof v === 'object' && typeof v.__inc === 'number') cur[leaf] = (Number(cur[leaf]) || 0) + v.__inc;
          else cur[leaf] = JSON.parse(JSON.stringify(v));
        });
        store[p] = next; return Promise.resolve();
      },
      delete() { if (hung(p)) return dead(); delete store[p]; return Promise.resolve(); },
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

/* drive a whole practice deterministically */
function play(sb, scenarioId, moves, seed) {
  const s = sb.simBuildSession(scenarioId, { sessionId: 'test1', seed: seed || 'test1' });
  moves.forEach(m => {
    const r = sb.simCoachTurn(s, m[0], m[1]);
    if (!r.ok) return;
    s.turns = s.turns.concat([r.coachTurn, r.clientTurn]);
    s.state = r.state;
    if (r.safetyStop) s.boundaryHandled = true;
    if (r.boundaryReached) s.boundaryReached = true;
  });
  return s;
}
const Q = t => [t, 'SORU'], R = t => [t, 'YANSITMA'], SIL = () => ['', 'SESSIZLIK'],
  ADV = t => [t, 'BILGI_IZIN'], CH = t => [t, 'MEYDAN_OKUMA'];

/* ── HONESTY ───────────────────────────────────────────────────────────────── */
describe('A. The product does not claim to be something it is not', () => {
  test('A1. only the deterministic generator is registered', () => {
    const sb = createSandbox();
    assert.deepEqual(Object.keys(sb.SIM_GENERATOR_IMPL), ['DETERMINISTIC']);
    assert.equal(sb.simGeneratorType(), 'DETERMINISTIC');
    assert.equal(sb.SIM_ACTIVE_GENERATOR, 'DETERMINISTIC');
  });
  test('A2. the disclaimer says responses are authored, not generated', () => {
    const sb = createSandbox();
    assert.match(sb.SIM_DISCLAIMER, /yapay zekâ tarafından üretilmez/);
    assert.match(sb.SIM_DISCLAIMER, /gerçek değildir/);
    assert.match(sb.SIM_PRIVACY_REMINDER, /Gerçek danışan bilgisi/);
  });
  test('A3. no AI branding anywhere in the phase', () => {
    const sb = createSandbox();
    assert.equal(sb.simAiClaimAudit().ok, true);
    FILES.forEach(n => {
      const src = code(F(n)).replace(/SIM_FORBIDDEN_AI_CLAIMS\s*=[^;]+;/, '');
      assert.equal(/\bAI Coach\b|\bAI Client\b|\bGPT\b|\bLLM\b/i.test(src), false, n);
    });
  });
  test('A4. no provider, no key, no external call', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/fetch\(|XMLHttpRequest|WebSocket|EventSource/.test(e), false, n);
      assert.equal(/openai|anthropic|gemini|api[_-]?key|Bearer/i.test(e), false, n);
    });
  });
});

/* ── ARCHITECTURE ──────────────────────────────────────────────────────────── */
describe('B. Scenarios and the generator boundary', () => {
  test('B1. every reference resolves and all seven contexts are covered', () => {
    const sb = createSandbox();
    const r = sb.simIntegrity();
    assert.equal(r.ok, true, (r.errors || []).join('\n'));
    assert.ok(r.scenarios >= 10 && r.scenarios <= 16, 'curated: ' + r.scenarios);
    assert.equal(r.contexts, 7);
  });
  test('B2. hidden dynamics are never in the briefing', () => {
    const sb = createSandbox();
    sb.SIM_SCENARIO_ORDER.forEach(id => {
      const b = sb.simBriefing(id);
      assert.equal('hiddenDynamics' in b, false, id);
      assert.equal('responses' in b, false, id);
      const s = sb.simScenario(id);
      assert.equal(JSON.stringify(b).indexOf(s.hiddenDynamics[0]), -1, id);
    });
  });
  test('B3. a crisis never hides inside an ordinary scenario', () => {
    const sb = createSandbox();
    sb.SIM_SCENARIO_ORDER.forEach(id => {
      const s = sb.simScenario(id);
      if (s.safetyPolicy === 'ORDINARY') assert.equal(s.boundaryTrigger, null, id);
      else assert.ok(s.boundaryTrigger, id + ' drill without a trigger');
    });
    const drills = sb.SIM_SCENARIO_ORDER.filter(id => sb.simScenario(id).safetyPolicy === 'BOUNDARY_DRILL');
    assert.ok(drills.length >= 1 && drills.length <= 3, 'a few marked drills, not many: ' + drills.length);
  });
  test('B4. a future generator plugs into the same boundary', () => {
    const sb = createSandbox();
    let received = null;
    assert.equal(sb.simRegisterGenerator('SERVER_SIDE_AI', ctx => { received = ctx; return { text: 'x' }; }), true);
    assert.equal(sb.simRegisterGenerator('SOMETHING_ELSE', () => ({})), false, 'unknown types refused');
    /* the contract a model would receive: scenario truth and state, nothing personal */
    const s = sb.simBuildSession('ADU_PRIORITY', { sessionId: 'c1', seed: 'c1' });
    const ctx = sb.simBuildGeneratorContext(s, sb.simStructuralSignals('x?', 'SORU'));
    ['scenarioId', 'context', 'hiddenDynamics', 'state', 'turnIndex', 'signals', 'seed', 'safetyPolicy']
      .forEach(k => assert.ok(k in ctx, 'missing ' + k));
    assert.equal(/coachingSessions|realClient|note/.test(JSON.stringify(ctx)), false);
    assert.equal(typeof received, 'object');
  });
  test('B5. UI code never picks a response string itself', () => {
    const ui = exec(F('49-sim-ui.js'));
    assert.equal(/\.responses\b/.test(ui), false, 'the UI must go through the generator');
    assert.ok(/simCoachTurn/.test(code(F('49-sim-ui.js'))));
  });
});

/* ── SIMULATION ────────────────────────────────────────────────────────────── */
describe('C. The simulation reacts to how the coach works', () => {
  test('C1. the same seed replays exactly', () => {
    const sb = createSandbox();
    const a = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()], 'seed-1');
    const b = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()], 'seed-1');
    assert.deepEqual(a.turns.map(t => t.text), b.turns.map(t => t.text));
  });
  test('C2. reflection deepens where the scenario supports it', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY', [R('Koşuyorsun dedin.'), R('Yorgunsun.')]);
    assert.notEqual(s.state.depth, 'SURFACE', JSON.stringify(s.state));
  });
  test('C3. silence is a first-class intervention, not an empty turn', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_DONT_KNOW', [R('Kafan karışık.'), SIL(), SIL()]);
    const silent = s.turns.filter(t => t.role === 'coach' && t.intent === 'SESSIZLIK');
    assert.equal(silent.length, 2);
    assert.equal(s.state.silenceUsed, 2);
    /* it produced real client turns rather than being skipped */
    assert.ok(s.turns.filter(t => t.role === 'client').length >= 3);
    /* and an empty turn without the silence intent is refused */
    const s2 = sb.simBuildSession('ADU_PRIORITY', { sessionId: 'e1', seed: 'e1' });
    assert.equal(sb.simCoachTurn(s2, '', 'SORU').error, 'empty_turn');
  });
  test('C4. advice can move ownership away from the client', () => {
    const sb = createSandbox();
    const s = play(sb, 'EXE_DELEGATION', [ADV('Şunu yapmalısın.'), ADV('Bir de bunu dene.')]);
    assert.notEqual(s.state.ownership, 'PRESERVED', JSON.stringify(s.state));
    assert.equal(s.state.adviceUsed, 2);
  });
  test('C5. piling questions on costs engagement', () => {
    const sb = createSandbox();
    const before = sb.simInitialState(sb.simScenario('ADU_PRIORITY')).engagement;
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), Q('b?'), Q('c?'), Q('d?')]);
    assert.equal(s.state.consecutiveQuestions >= 3, true);
    assert.ok(sb.SIM_ENGAGEMENT.indexOf(s.state.engagement) <= sb.SIM_ENGAGEMENT.indexOf(before),
      'engagement should not rise under interrogation');
  });
  test('C6. youth and child start guarded and stay distinct from adult', () => {
    const sb = createSandbox();
    assert.equal(sb.simInitialState(sb.simScenario('YOU_SHORT_ANSWERS')).engagement, 'GUARDED');
    assert.equal(sb.simInitialState(sb.simScenario('CHI_FOCUS')).engagement, 'GUARDED');
    assert.equal(sb.simInitialState(sb.simScenario('ADU_PRIORITY')).engagement, 'NEUTRAL');
    const child = play(sb, 'CHI_FOCUS', [Q('Dün ne oldu?')]);
    const reply = child.turns[child.turns.length - 1].text;
    assert.ok(reply.length < 200, 'a child turn should be short: ' + reply);
  });
  test('C7. the turn cap holds and ending needs a real conversation', () => {
    const sb = createSandbox();
    const s = sb.simBuildSession('ADU_PRIORITY', { sessionId: 'cap', seed: 'cap' });
    assert.equal(sb.simCanEnd(s), false, 'cannot end before it started');
    for (let i = 0; i < sb.SIM_TURN_CAP; i++) {
      const r = sb.simCoachTurn(s, 'soru ' + i + '?', 'SORU');
      assert.equal(r.ok, true, 'turn ' + i);
      s.turns = s.turns.concat([r.coachTurn, r.clientTurn]); s.state = r.state;
    }
    assert.equal(sb.simCoachTurn(s, 'bir tane daha?', 'SORU').error, 'turn_cap_reached');
    assert.equal(sb.simCanEnd(s), true);
  });
  test('C8. a hint teaches judgement, never a line to copy', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), Q('b?')]);
    const hint = sb.simHint(s);
    assert.ok(hint.length > 10);
    assert.equal(/^["“]/.test(hint), false, 'a hint must not be a quoted script: ' + hint);
    assert.match(hint, /düşün|yansıt|bırak|acele/);
  });
});

/* ── SAFETY ────────────────────────────────────────────────────────────────── */
describe('D. Safety outranks the generator', () => {
  test('D1. a RED utterance stops the simulation regardless of scenario', () => {
    const sb = createSandbox();
    const s = sb.simBuildSession('ADU_PRIORITY', { sessionId: 'sf', seed: 'sf' });
    const r = sb.simCoachTurn(s, 'kendime zarar vermeyi düşünüyorum', 'SORU');
    assert.equal(r.ok, true);
    assert.equal(r.safetyStop, true, 'the Phase 2 gate must stop this');
    assert.equal(r.clientTurn.text, '', 'no generated reply after a stop');
    assert.equal(r.clientTurn.safetyStop, true);
  });
  test('D2. the boundary drills are reachable and marked', () => {
    const sb = createSandbox();
    ['BND_SCOPE_ADULT', 'BND_SCOPE_YOUTH'].forEach(id => {
      const s = sb.simScenario(id);
      assert.ok(s, id);
      assert.equal(s.safetyPolicy, 'BOUNDARY_DRILL');
      assert.match(s.visibleContext, /SINIR ALIŞTIRMASI/);
      assert.ok(s.academyUnitTags.indexOf('CTX_SCOPE_BOUNDARY') >= 0
        || s.academyUnitTags.indexOf('CTX_YOUTH_CHILD') >= 0, id);
    });
  });
  test('D3. coaching on through a boundary drill is named as a miss', () => {
    const sb = createSandbox();
    const s = play(sb, 'BND_SCOPE_ADULT', [Q('Hedefin ne olsun?'), Q('Ne zaman başlarsın?')]);
    s.boundaryHandled = false;
    const d = sb.simBuildDebrief(s);
    assert.ok(d.missed.some(m => /Sınır fark edilmedi/.test(m.title)), JSON.stringify(d.missed));
  });
  test('D4. handling the boundary is recognised as a strength', () => {
    const sb = createSandbox();
    const s = play(sb, 'BND_SCOPE_ADULT', [R('Bunu duymak önemli.')]);
    s.boundaryHandled = true;
    const d = sb.simBuildDebrief(s);
    assert.ok(d.strengths.some(x => /Sınırı tanıdın/.test(x.title)), JSON.stringify(d.strengths));
  });
  test('D5. the simulator re-implements no safety rule', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/COACHING_SAFETY_SIGNALS\s*=|coachingInstallSafetyGate/.test(e), false, n);
    });
    assert.ok(/coachingSafetyEvaluate/.test(code(F('46-sim-engine.js'))));
  });
  test('D6. no diagnosis or treatment language in any scenario', () => {
    const sb = createSandbox();
    sb.SIM_SCENARIO_ORDER.forEach(id => {
      const j = JSON.stringify(sb.simScenario(id));
      assert.equal(/tedavi et|teşhis koy|terapi uygula/i.test(j), false, id);
    });
  });
});

/* ── DEBRIEF ───────────────────────────────────────────────────────────────── */
describe('E. The debrief points at what it counted', () => {
  test('E1. a stacked question names the exact turn', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY', [Q('Ne zaman? Kiminle? Nasıl?'), R('Anladım.'), R('Peki.')]);
    const d = sb.simBuildDebrief(s);
    const hit = d.notice.filter(n => n.antiPatternId === 'STACKED_QUESTIONS')[0];
    assert.ok(hit, JSON.stringify(d.notice));
    assert.ok(hit.turns.length >= 1, 'must cite a turn');
    assert.match(hit.text, /tur/);
  });
  test('E2. every finding carries an evidence layer', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), ADV('şunu yap'), ADV('bunu da')]);
    const d = sb.simBuildDebrief(s);
    d.strengths.concat(d.notice, d.missed).forEach(o =>
      assert.ok(sb.SIM_EVIDENCE_LAYERS.indexOf(o.evidenceLayer) >= 0, JSON.stringify(o)));
    assert.equal(sb.simDebriefAudit(d).ok, true, JSON.stringify(sb.simDebriefAudit(d)));
  });
  test('E3. no score, no percentage, no ICF level', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL(), CH('c')]);
    const d = sb.simBuildDebrief(s);
    const j = JSON.stringify(d);
    assert.equal(/\b\d{1,3}\s*\/\s*100\b|\bACC\b|\bPCC\b|\bMCC\b|%\s*\d|yüzde \d/.test(j), false, j.slice(0, 300));
    assert.equal('score' in d, false);
    assert.match(d.disclaimer, /puan/i);
  });
  test('E4. findings are bounded', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY',
      [Q('a? b?'), Q('c? d?'), Q('e?'), Q('f?'), ADV('g'), ADV('h'), CH('i'), CH('j')]);
    const d = sb.simBuildDebrief(s);
    assert.ok(d.strengths.length <= sb.SIM_MAX_STRENGTHS);
    assert.ok(d.notice.length <= sb.SIM_MAX_NOTICE);
    assert.ok(d.academyUnitIds.length <= 2);
    assert.ok(d.bookIds.length <= 2, 'books never dominate');
  });
  test('E5. one practice, and it comes from what happened', () => {
    const sb = createSandbox();
    const noSilence = play(sb, 'ADU_PRIORITY', [Q('a?'), Q('b?'), R('c'), Q('d?'), Q('e?')]);
    assert.equal(sb.simBuildDebrief(noSilence).practiceCode, 'PRACTICE_HOLD_SILENCE');
    const advice = play(sb, 'EXE_DELEGATION', [SIL(), ADV('x'), ADV('y'), R('z')]);
    assert.equal(sb.simBuildDebrief(advice).practiceCode, 'PRACTICE_ELICIT_BEFORE_INFORM');
    const sb2 = createSandbox();
    assert.ok(sb2.COACHING_PRACTICES[sb.simBuildDebrief(noSilence).practiceCode], 'canonical code');
  });
  test('E6. the intervention mix is reported without judgement', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()]);
    const d = sb.simBuildDebrief(s);
    assert.equal(d.interventionMix.SORU, 1);
    assert.equal(d.interventionMix.YANSITMA, 1);
    assert.equal(d.interventionMix.SESSIZLIK, 1);
  });
  test('E7. the debrief claims no semantic understanding', () => {
    const e = exec(F('47-sim-debrief.js'));
    assert.equal(/sentiment|semantic|empati ölçüm|niyet analiz/i.test(e), false);
    /* every notice is driven by a counted stat or a state value */
    assert.ok(/simTurnStats/.test(code(F('47-sim-debrief.js'))));
  });
  test('E8. one debrief id per session, so a retry converges', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()]);
    assert.equal(sb.simBuildDebrief(s).id, sb.simBuildDebrief(s).id);
    assert.equal(sb.simBuildDebrief(s).id, 'dbf_' + s.id);
  });
});

/* ── SEPARATION, PRIVACY, NETWORK ──────────────────────────────────────────── */
describe('F. Practice never contaminates the real Mirror', () => {
  test('F1. a saved practice writes nothing to coachingSessions', async () => {
    const sb = ready(createSandbox());
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()]);
    s.status = 'COMPLETED'; s.debrief = sb.simBuildDebrief(s);
    const res = await sb.simSaveSession(s);
    assert.equal(res.ok, true, JSON.stringify(res));
    const keys = Object.keys(dbOf(sb)._store);
    assert.equal(keys.some(k => k.indexOf('coachingSessions') >= 0), false,
      'a simulation must never look like a real session');
    assert.equal(keys.length, 1);
    assert.ok(keys[0].indexOf('users/OWNER1/coachingDevelopment/') === 0, keys[0]);
    assert.equal(dbOf(sb)._store[keys[0]].kind, 'practice_session');
  });
  test('F2. the real Mirror is unaffected by practice records', async () => {
    const sb = ready(createSandbox());
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()]);
    s.status = 'COMPLETED'; s.debrief = sb.simBuildDebrief(s);
    await sb.simSaveSession(s);
    const list = await sb.coachingListSessions({ limit: 20 });
    assert.equal(list.ok, true);
    assert.equal(list.sessions.length, 0, 'no real session was created');
    const cross = sb.coachingCrossSessionMirror([]);
    assert.equal((cross.observations || []).length, 0);
  });
  test('F3. the store writes no observation and no mirror', () => {
    const e = exec(F('48-sim-store.js'));
    assert.equal(/coachingSaveObservations|coachingSessionCreate|coachingSessionPatch/.test(e), false);
    assert.equal(/coachingSessionsCol|coachingChildDoc/.test(e), false);
  });
  test('F4. the debrief calls itself practice feedback', () => {
    const sb = createSandbox();
    assert.match(sb.SIM_DEBRIEF_DISCLAIMER, /pratik geri bildirimidir/);
    assert.match(sb.SIM_DEBRIEF_DISCLAIMER, /Koç Aynası/);
  });
  test('F5. every simulator call is bounded', async () => {
    const sb = ready(createSandbox());
    dbOf(sb)._store.__hang = true;
    const t0 = Date.now();
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()]);
    s.status = 'COMPLETED'; s.debrief = sb.simBuildDebrief(s);
    const w = await sb.simSaveSession(s);
    const r = await sb.simLoadRecords();
    assert.ok(Date.now() - t0 < 5000, 'a call hung');
    assert.equal(w.ok, false);
    assert.equal(r.ok, false);
    assert.equal(r.records, undefined, 'a failed read is not "no practice"');
  });
  test('F6. stored turns are capped and carry no scenario text copy', async () => {
    const sb = ready(createSandbox());
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b')]);
    const rec = sb.simSessionRecord(s);
    assert.ok(rec.turns.length <= sb.SIM_STORED_TURN_CAP);
    assert.equal(JSON.stringify(rec).indexOf(sb.simScenario('ADU_PRIORITY').hiddenDynamics[0]), -1,
      'hidden dynamics must not be persisted into user data');
    assert.equal(rec.id, s.id, 'stable id so a retry overwrites');
  });
  test('F7. no browser storage, no app state, no second client', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/localStorage|sessionStorage|indexedDB|openDatabase/.test(e), false, n);
      assert.equal(/enablePersistence|firebase\.initializeApp|CLOUD\.db/.test(e), false, n);
      assert.equal(/\bD\.(practice|simulator|sim)\b/.test(e), false, n);
    });
  });
  test('F8. purge removes practice records only', async () => {
    const sb = ready(createSandbox());
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()]);
    s.status = 'COMPLETED'; s.debrief = sb.simBuildDebrief(s);
    await sb.simSaveSession(s);
    await sb.simSaveReflection(s.id, 'not');
    await sb.coachingSaveDevelopmentDoc(sb.coachingBuildPractice('PRACTICE_HOLD_SILENCE'));
    await sb.academySaveUnitState('FND_ETHICS', 'REVIEWED');
    assert.equal(devKeys(sb).length, 4);
    const load = await sb.simLoadRecords();
    const res = await sb.simPurge(load.records);
    assert.equal(res.purged, 2);
    const left = devKeys(sb).map(k => dbOf(sb)._store[k].kind).sort();
    assert.deepEqual(left, ['academy_unit', 'practice']);
  });
});

/* ── INTEGRATION, UI, REGRESSION ───────────────────────────────────────────── */
describe('G. Integration, UI and regression', () => {
  test('G1. adopting the debrief practice reuses the Phase 6 record', async () => {
    const sb = ready(createSandbox());
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), Q('b?'), Q('c?'), Q('d?')]);
    const d = sb.simBuildDebrief(s);
    const res = await sb.simAdoptPractice(d);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.practice.kind, 'practice');
    assert.equal(res.practice.status, 'ACTIVE');
    const e = exec(F('48-sim-store.js'));
    assert.equal(/SIM_PRACTICES|simPracticeDef/.test(e), false, 'no second tracker');
  });
  test('G2. Academy and Book links resolve', () => {
    const sb = createSandbox();
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()]);
    const d = sb.simBuildDebrief(s);
    d.academyUnitIds.forEach(u => assert.ok(sb.academyUnit(u), u));
    d.bookIds.forEach(b => assert.ok(sb.book(b), b));
  });
  test('G3. the scenario recommendation explains itself', () => {
    const sb = createSandbox();
    const cold = sb.simRecommendScenario([]);
    assert.ok(cold && cold.why.length > 20, JSON.stringify(cold));
    assert.equal(cold.scenario.safetyPolicy, 'ORDINARY', 'never open with a crisis drill');
    const practice = [sb.coachingBuildPractice('PRACTICE_HOLD_SILENCE')];
    const warm = sb.simRecommendScenario(practice);
    assert.match(warm.why, /pratiği üzerinde çalıştığın için/);
  });
  test('G4. modules are loaded once with a cache-bust tag', () => {
    FILES.forEach(n => {
      assert.equal(INDEX.split('js/' + n + '?v=').length - 1, 1, n);
      assert.match(INDEX, new RegExp('js/' + n.replace(/\./g, '\\.') + '\\?v=2026\\.08-sim-[a-z0-9]+'), n);
    });
  });
  test('G5. the practice route and one nav entry exist', () => {
    assert.match(code(F('12-render-boot.js')), /practice\s*:\s*function/);
    const nav = code(F('28-coaching-workspace.js'));
    assert.match(nav, /id\s*:\s*'practice'/);
    assert.match(nav, /_navPractice/);
  });
  test('G6. public mirrors are byte-identical and modules fit the size limit', () => {
    FILES.concat(['12-render-boot.js', '28-coaching-workspace.js']).forEach(n => {
      assert.equal(F(n), fs.readFileSync(path.join(ROOT, 'public', 'js', n), 'utf8'), n);
      assert.ok(F(n).split('\n').length < 900, n + ' ' + F(n).split('\n').length);
    });
    assert.equal(INDEX, fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));
  });
  test('G7. the live screen shows no score and states what this is', () => {
    const sb = ready(createSandbox());
    sb.SIM_UI.records = [];
    sb.simOpenBriefing('ADU_PRIORITY');
    sb.simStart();
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf('sim_input') >= 0);
    assert.ok(html.indexOf('Bekle / alan bırak') >= 0, 'silence must be a visible action');
    assert.equal(/%\s*\d|puan|skor|\bACC\b|\bPCC\b/.test(html), false);
    const home = (function () { sb.renderSimHome(); return (sb.__getElements().pinner || {}).innerHTML || ''; })();
    assert.ok(home.indexOf('yapay zekâ tarafından üretilmez') >= 0, 'the home screen must be honest');
  });
  test('G8. a failed practice save keeps the debrief on screen', async () => {
    const sb = ready(createSandbox());
    sb.SIM_UI.records = [];
    sb.simOpenBriefing('ADU_PRIORITY'); sb.simStart();
    ['a?', 'b', 'c'].forEach((t, i) => {
      const r = sb.simCoachTurn(sb.SIM_UI.session, t, i === 1 ? 'YANSITMA' : 'SORU');
      sb.SIM_UI.session.turns = sb.SIM_UI.session.turns.concat([r.coachTurn, r.clientTurn]);
      sb.SIM_UI.session.state = r.state;
    });
    dbOf(sb)._store.__hang = true;
    await sb.simEnd();
    delete dbOf(sb)._store.__hang;
    assert.ok(sb.SIM_UI.error, 'the coach is told it did not save');
    assert.ok(sb.SIM_UI.debrief, 'the debrief still stands');
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf('Pratik geri bildirimi') >= 0);
  });
  test('G9. a failed reflection save keeps what was typed', async () => {
    const sb = ready(createSandbox());
    sb.SIM_UI.records = [];
    const s = play(sb, 'ADU_PRIORITY', [Q('a?'), R('b'), SIL()]);
    sb.SIM_UI.debrief = sb.simBuildDebrief(s);
    sb.renderSimDebrief();
    const TYPED = 'Sessizliği daha erken kullanabilirdim.';
    sb.ge('sim_reflect').value = TYPED;
    dbOf(sb)._store.__hang = true;
    await sb.simSaveReflectionNow();
    delete dbOf(sb)._store.__hang;
    assert.ok(sb.SIM_UI.error);
    const html = (sb.__getElements().pinner || {}).innerHTML || '';
    assert.ok(html.indexOf(TYPED) >= 0, 'the unsaved reflection was wiped');
  });
  test('G10. Phases 5–8 still work', async () => {
    const sb = ready(createSandbox());
    const c = await sb.coachingSessionCreate({ context: 'adult', purpose: 'x', relationLabel: 'A' });
    const p = await sb.coachingSessionPatch(c.session, { lifecycle: 'active' }, { type: 'update' });
    const done = await sb.coachingCompleteSession(p.session,
      { insight: 'i', reflection: 'r', commitment: { source: 'coachee', text: 't' } });
    assert.equal(done.ok, true, JSON.stringify(done));
    const gen = await sb.coachingGenerateMirror(done.session,
      { coacheeCommitment: true, insightRecorded: true, coachReflectionRecorded: true });
    assert.equal(gen.ok, true);
    assert.equal(sb.academyIntegrity().ok, true);
    assert.equal(sb.booksIntegrity().ok, true);
    const st = dbOf(sb)._store['users/OWNER1/coachingSessions/' + c.session.id];
    const events = Object.keys(dbOf(sb)._store).filter(k => k.indexOf('/events/') > 0).length;
    assert.equal(st.counters.events, events);
  });
  test('G11. no audio, transcript or model surface was introduced', () => {
    FILES.forEach(n => {
      const e = exec(F(n));
      assert.equal(/getUserMedia|MediaRecorder|SpeechRecognition|whisper|embedding/i.test(e), false, n);
    });
  });
});
