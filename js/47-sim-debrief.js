/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 9d: DETERMINISTIC DEBRIEF

   Everything here is derived from counted facts about the practice: declared
   intents, question marks, turn indexes, state transitions. Nothing is
   inferred about the coach as a person, and nothing claims to have understood
   what they meant — the engine cannot read language, so the debrief only says
   what it can point at.

   Every negative finding cites the turn it came from. "5. turda art arda üç
   soru sordun" is a fact the coach can check; "çok soru soruyorsun" is a
   judgement they cannot.

   This is PRACTICE feedback. It is deliberately a separate concept from the
   Coach Mirror, whose evidence comes from real sessions with real people, and
   nothing here is ever written into that stream.
   ══════════════════════════════════════════════════════════════════════════ */

var SIM_DEBRIEF_VERSION = 1;
var SIM_EVIDENCE_LAYERS = ['OBSERVED','INFERRED','SELF_REPORTED'];
var SIM_MAX_STRENGTHS = 3;
var SIM_MAX_NOTICE = 3;
var SIM_MAX_MISSED = 2;

var SIM_DEBRIEF_DISCLAIMER =
  'Bu bir pratik geri bildirimidir; gerçek görüşme kanıtı değildir ve Koç Aynası ' +
  'örüntülerine karışmaz. Puan, seviye veya yeterlilik kararı içermez.';

function _sdStr(v,max){ return String(v==null?'':v).slice(0, max||320); }

/* ── Counted facts ── */
function simTurnStats(session){
  var coachTurns = (session.turns||[]).filter(function(t){ return t.role==='coach'; });
  var byIntent = {};
  SIM_INTENTS.forEach(function(i){ byIntent[i] = 0; });
  var stacked = [], longTurns = [], consecutive = [], run = 0;
  coachTurns.forEach(function(t){
    var i = t.intent || 'DIGER';
    byIntent[i] = (byIntent[i]||0) + 1;
    if(t.signals && t.signals.stacked) stacked.push(t.index);
    if(t.signals && t.signals.longTurn) longTurns.push(t.index);
    if(i==='SORU'){ run++; if(run>=3) consecutive.push(t.index); }
    else run = 0;
  });
  return { coachTurnCount: coachTurns.length, byIntent: byIntent,
    stackedTurns: stacked, longTurns: longTurns, consecutiveQuestionTurns: consecutive,
    questionCount: byIntent.SORU, reflectionCount: byIntent.YANSITMA,
    silenceCount: byIntent.SESSIZLIK, adviceCount: byIntent.BILGI_IZIN,
    challengeCount: byIntent.MEYDAN_OKUMA, observationCount: byIntent.GOZLEM };
}

function _obs(layer, title, text, turns, refs){
  return { evidenceLayer: layer, title:_sdStr(title,120), text:_sdStr(text),
    turns: (turns||[]).slice(0,4),
    antiPatternId: (refs&&refs.antiPatternId) || null,
    academyUnitId: (refs&&refs.academyUnitId) || null,
    mirrorCategory: (refs&&refs.mirrorCategory) || null };
}

/* ── Strengths ── */
function _simStrengths(session, stats){
  var out = [], s = simScenario(session.scenarioId), st = session.state;
  if(stats.reflectionCount >= 2)
    out.push(_obs('OBSERVED','Yansıtmayı kullandın',
      stats.reflectionCount+' turda yansıtma seçtin; danışanın kendi sözünü duymasına alan açtın.',
      [], {academyUnitId:'CORE_REFLECTION', mirrorCategory:'REFLECTION'}));
  if(stats.silenceCount >= 1)
    out.push(_obs('OBSERVED','Alan bıraktın',
      stats.silenceCount+' kez bekledin. Sessizlik burada bir müdahaledir, boşluk değil.',
      [], {academyUnitId:'CORE_SILENCE', mirrorCategory:'SILENCE'}));
  if(st.depth==='DEEPENING')
    out.push(_obs('OBSERVED','Konuşma derinleşti',
      'Simülasyon yüzeyden derinleşme durumuna geçti.',
      [], {academyUnitId:'CRAFT_DEEPENING', mirrorCategory:'AWARENESS'}));
  if(st.ownership==='PRESERVED' && stats.coachTurnCount >= 3)
    out.push(_obs('OBSERVED','Sahiplik danışanda kaldı',
      'Bu pratikte kararı ve eylemi danışana bırakan bir akış izledin.',
      [], {academyUnitId:'FND_AGENCY', mirrorCategory:'CLIENT_AGENCY'}));
  if(st.engagement==='OPEN' || st.engagement==='ENGAGED')
    out.push(_obs('OBSERVED','Katılım arttı',
      'Simüle danışanın katılımı '+(SIM_ENGAGEMENT_LABEL[st.engagement]||st.engagement)+' düzeyine geldi.',
      [], {mirrorCategory:'LISTENING'}));
  if(s && s.safetyPolicy==='BOUNDARY_DRILL' && session.boundaryHandled)
    out.push(_obs('OBSERVED','Sınırı tanıdın',
      'Kapsam dışına çıkıldığını fark edip koçluğu sürdürmedin.',
      [], {academyUnitId:'CTX_SCOPE_BOUNDARY', mirrorCategory:'BOUNDARIES'}));
  return out.slice(0, SIM_MAX_STRENGTHS);
}

/* ── What to notice — every item points at a turn or a counted fact ── */
function _simNotice(session, stats){
  var out = [], st = session.state;
  if(stats.stackedTurns.length)
    out.push(_obs('OBSERVED','Üst üste soru',
      stats.stackedTurns.map(function(i){ return i+'. tur'; }).join(', ')+
      ': tek turda birden fazla soru sordun. Danışan genellikle yalnız sonuncusuna cevap verir.',
      stats.stackedTurns, {antiPatternId:'STACKED_QUESTIONS', academyUnitId:'CORE_QUESTIONS',
        mirrorCategory:'QUESTIONING'}));
  if(stats.consecutiveQuestionTurns.length)
    out.push(_obs('OBSERVED','Art arda sorular',
      stats.consecutiveQuestionTurns[0]+'. turdan itibaren üç veya daha fazla soruyu peş peşe sordun.',
      stats.consecutiveQuestionTurns, {antiPatternId:'INTERROGATION',
        academyUnitId:'CORE_LISTENING', mirrorCategory:'QUESTIONING'}));
  if(stats.adviceCount >= 2)
    out.push(_obs('OBSERVED','Öneri ağırlığı',
      stats.adviceCount+' turda öneri/bilgi seçtin. Öneri kötü değildir; danışanın düşünmesinin yerine geçtiğinde zarar verir.',
      [], {antiPatternId:'ADVICE_IN_DISGUISE', academyUnitId:'CORE_NO_ADVICE',
        mirrorCategory:'CLIENT_AGENCY'}));
  if(st.ownership!=='PRESERVED')
    out.push(_obs('OBSERVED','Sahiplik kaydı',
      'Simülasyon sonunda sahiplik durumu: '+(SIM_OWNERSHIP_LABEL[st.ownership]||st.ownership)+'.',
      [], {antiPatternId:'RESCUING', academyUnitId:'FND_AGENCY', mirrorCategory:'CLIENT_AGENCY'}));
  if(stats.silenceCount === 0 && stats.coachTurnCount >= 4)
    out.push(_obs('OBSERVED','Hiç beklemedin',
      'Bu pratikte hiç alan bırakmadın. Sessizlik çoğu zaman düşünmenin kendisidir.',
      [], {academyUnitId:'CORE_SILENCE', mirrorCategory:'SILENCE'}));
  if(stats.reflectionCount === 0 && stats.questionCount >= 3)
    out.push(_obs('OBSERVED','Yansıtma yok',
      'Yalnız soru sordun; hiç yansıtma seçmedin. Duyduğunu göstermeden dinlediğini gösteremezsin.',
      [], {academyUnitId:'CORE_REFLECTION', mirrorCategory:'REFLECTION'}));
  if(stats.challengeCount >= 2 && session.state.engagement==='GUARDED')
    out.push(_obs('INFERRED','Erken meydan okuma olabilir',
      'Birden fazla meydan okuma sonrasında simüle danışan temkinli hâle geldi. Bu bir yorumdur, kesinlik değil.',
      [], {academyUnitId:'CORE_CHALLENGE', mirrorCategory:'CHALLENGE'}));
  return out.slice(0, SIM_MAX_NOTICE);
}

function _simMissed(session, stats){
  var out = [];
  var s = simScenario(session.scenarioId);
  if(s && s.safetyPolicy==='BOUNDARY_DRILL' && !session.boundaryHandled)
    out.push(_obs('OBSERVED','Sınır fark edilmedi',
      'Bu bir sınır tanıma alıştırmasıydı ve kapsam dışına çıkıldığı hâlde koçluk sürdürüldü. Doğru hamle durup onaylı yönlendirme yolunu izlemektir.',
      [], {academyUnitId:'CTX_SCOPE_BOUNDARY', mirrorCategory:'BOUNDARIES'}));
  if(stats.coachTurnCount >= 4 && session.state.depth==='SURFACE')
    out.push(_obs('INFERRED','Yüzeyde kalındı',
      'Konuşma yüzey düzeyinde kaldı. Danışanın en güçlü kelimesine dönmek derinleştirebilirdi.',
      [], {academyUnitId:'CRAFT_DEEPENING', mirrorCategory:'AWARENESS'}));
  return out.slice(0, SIM_MAX_MISSED);
}

/* ── One practice, chosen from what actually happened ── */
function _simPractice(session, stats){
  var st = session.state;
  if(stats.silenceCount === 0 && stats.coachTurnCount >= 4) return 'PRACTICE_HOLD_SILENCE';
  if(stats.reflectionCount === 0 && stats.questionCount >= 2) return 'PRACTICE_REFLECT_BEFORE_ASKING';
  if(stats.adviceCount >= 2) return 'PRACTICE_ELICIT_BEFORE_INFORM';
  if(st.ownership !== 'PRESERVED') return 'PRACTICE_CLIENT_OWNS_ACTION';
  if(stats.challengeCount >= 2) return 'PRACTICE_SPACE_AFTER_CHALLENGE';
  var s = simScenario(session.scenarioId);
  return (s && s.practiceIds.length) ? s.practiceIds[0] : 'PRACTICE_AWARENESS_BEFORE_ASKING';
}

function simBuildDebrief(session){
  if(!session) return null;
  var s = simScenario(session.scenarioId);
  if(!s) return null;
  var stats = simTurnStats(session);
  var strengths = _simStrengths(session, stats);
  var notice = _simNotice(session, stats);
  var missed = _simMissed(session, stats);
  var practiceCode = _simPractice(session, stats);
  if(typeof COACHING_PRACTICES!=='undefined' && !COACHING_PRACTICES[practiceCode])
    practiceCode = s.practiceIds[0] || 'PRACTICE_HOLD_SILENCE';

  /* Academy links come from what was observed, then from the scenario */
  var units = [];
  strengths.concat(notice, missed).forEach(function(o){
    if(o.academyUnitId && units.indexOf(o.academyUnitId)<0) units.push(o.academyUnitId); });
  s.academyUnitTags.forEach(function(u){ if(units.indexOf(u)<0) units.push(u); });
  units = units.filter(function(u){ return typeof academyUnit!=='function' || academyUnit(u); }).slice(0,2);

  /* books only where they add something — practice and Academy outrank them */
  var books = (s.bookTags||[]).filter(function(b){
    return typeof book!=='function' || book(b); }).slice(0, notice.length ? 2 : 1);

  var icfAreas = [];
  strengths.concat(notice).forEach(function(o){
    if(!o.mirrorCategory) return;
    var a = (typeof COACHING_ICF_AREA!=='undefined') ? COACHING_ICF_AREA[o.mirrorCategory] : null;
    if(a && icfAreas.indexOf(a)<0) icfAreas.push(a);
  });

  return {
    id: 'dbf_'+session.id,                 /* stable: one debrief per session */
    version: SIM_DEBRIEF_VERSION,
    sessionId: session.id, scenarioId: session.scenarioId,
    generatorType: session.generatorType || SIM_ACTIVE_GENERATOR,
    stats: stats,
    finalState: Object.assign({}, session.state),
    strengths: strengths, notice: notice, missed: missed,
    interventionMix: stats.byIntent,
    practiceCode: practiceCode,
    academyUnitIds: units, bookIds: books,
    icfAreas: icfAreas.slice(0,3),
    disclaimer: SIM_DEBRIEF_DISCLAIMER,
    createdAt: (function(){ try{ return new Date().toISOString(); }catch(e){ return ''; } })()
  };
}

/* Enforced, not merely intended: nothing in a debrief may look like a score
   or a credential claim. */
var SIM_FORBIDDEN_DEBRIEF = /\b\d{1,3}\s*\/\s*100\b|\b(ACC|PCC|MCC)\b|puan[ıi]n|skor|yüzde \d|%\s*\d/;
function simDebriefAudit(debrief){
  if(!debrief) return {ok:false, hits:['no debrief']};
  var body = JSON.stringify({s:debrief.strengths, n:debrief.notice, m:debrief.missed,
    i:debrief.icfAreas});
  var hits = [];
  if(SIM_FORBIDDEN_DEBRIEF.test(body)) hits.push('score-or-credential language');
  if(debrief.strengths.length > SIM_MAX_STRENGTHS) hits.push('too many strengths');
  if(debrief.notice.length > SIM_MAX_NOTICE) hits.push('too many notices');
  debrief.strengths.concat(debrief.notice, debrief.missed).forEach(function(o){
    if(SIM_EVIDENCE_LAYERS.indexOf(o.evidenceLayer)<0) hits.push('bad evidence layer');
  });
  return { ok: hits.length===0, hits: hits };
}

if(typeof window!=='undefined'){
  window.SIM_DEBRIEF_VERSION=SIM_DEBRIEF_VERSION; window.SIM_EVIDENCE_LAYERS=SIM_EVIDENCE_LAYERS;
  window.SIM_MAX_STRENGTHS=SIM_MAX_STRENGTHS; window.SIM_MAX_NOTICE=SIM_MAX_NOTICE;
  window.SIM_DEBRIEF_DISCLAIMER=SIM_DEBRIEF_DISCLAIMER;
  window.simTurnStats=simTurnStats; window.simBuildDebrief=simBuildDebrief;
  window.simDebriefAudit=simDebriefAudit;
}
