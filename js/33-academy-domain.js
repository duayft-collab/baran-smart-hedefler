/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 7a: ACADEMY DOMAIN

   The Academy teaches the coach to use — and eventually to stop needing —
   the rest of this system. It owns no coaching knowledge of its own: every
   competency, intervention, approach, anti-pattern, practice and mirror
   category it names is a REFERENCE to the canonical authority that already
   defines it. A duplicated definition would drift, and a drifted definition
   would teach the wrong thing.

   What this module owns: the shape of a learning unit, the learning-state
   machine, the canonical paths, and an integrity check that refuses to let a
   unit point at something that does not exist.

   Reading is not mastery. Completion is not competence. Nothing here produces
   a score, a level, or a credential claim.
   ══════════════════════════════════════════════════════════════════════════ */

var ACADEMY_VERSION = 1;

/* Where a unit sits in the arc of becoming competent. Not a difficulty score. */
var ACADEMY_LEVELS = ['FOUNDATION','CORE','CRAFT','METHOD','ADVANCED','CONTEXT'];
var ACADEMY_LEVEL_LABEL = {
  FOUNDATION:'Temel', CORE:'Konuşma Becerileri', CRAFT:'Görüşme Ustalığı',
  METHOD:'Yöntem Esnekliği', ADVANCED:'İleri Uygulama', CONTEXT:'Özel Bağlamlar' };

/* Learning state. Deliberately small, deliberately honest.
   APPLIED means "tried on purpose in a real session" — never "mastered".
   There is no MASTERED state: this system does not certify anyone. */
var ACADEMY_STATES = ['NOT_STARTED','IN_PROGRESS','REVIEWED','PRACTICING','APPLIED','REVISIT'];
var ACADEMY_STATE_LABEL = {
  NOT_STARTED:'Başlanmadı', IN_PROGRESS:'Sürüyor', REVIEWED:'Okundu',
  PRACTICING:'Pratikte', APPLIED:'Gerçek görüşmede denendi', REVISIT:'Tekrar bak' };
/* A coach may move around their own learning freely; the only thing the
   machine refuses is inventing progress on the coach's behalf. */
var ACADEMY_TRANSITIONS = {
  NOT_STARTED:['IN_PROGRESS','REVIEWED','REVISIT'],
  IN_PROGRESS:['REVIEWED','PRACTICING','REVISIT','NOT_STARTED'],
  REVIEWED:['PRACTICING','APPLIED','REVISIT','IN_PROGRESS'],
  PRACTICING:['APPLIED','REVIEWED','REVISIT'],
  APPLIED:['REVISIT','PRACTICING','REVIEWED'],
  REVISIT:['IN_PROGRESS','REVIEWED','PRACTICING']
};

/* Evidence grades are NOT redefined here — the Phase 4 registry is the
   authority. Academy only borrows the vocabulary. */
function academyEvidenceGrades(){
  return (typeof COACHING_EVIDENCE_GRADES!=='undefined') ? COACHING_EVIDENCE_GRADES : {};
}

/* ── Listening Lab ──
   An educational observation framework: layers a coach can learn to hear.
   It is taught, never inferred. Nothing in this system reads a private note
   or a transcript to decide which layer was present — there is no transcript,
   and the note is not evidence. */
var ACADEMY_LISTENING_LAYERS = [
  {key:'FACTS',         label:'Olgular',        prompt:'Ne oldu?'},
  {key:'EMOTION',       label:'Duygu',          prompt:'Ne hissediliyor?'},
  {key:'VALUES',        label:'Değerler',       prompt:'Neye önem veriliyor?'},
  {key:'ASSUMPTIONS',   label:'Varsayımlar',    prompt:'Hangi inanç yorumu şekillendiriyor?'},
  {key:'NEEDS',         label:'İhtiyaçlar',     prompt:'Neye ihtiyaç olabilir?'},
  {key:'CONTRADICTIONS',label:'Çelişkiler',     prompt:'Ne birbirini tutmuyor?'},
  {key:'ENERGY',        label:'Enerji değişimi',prompt:'Enerji nerede yükseliyor, nerede düşüyor?'},
  {key:'CHANGE_TALK',   label:'Değişim dili',   prompt:'Hangi ifade değişime doğru hareket gösteriyor?'},
  {key:'SUSTAIN_TALK',  label:'Koruma dili',    prompt:'Hangi ifade olduğu gibi kalma gerekçesi taşıyor?'},
  {key:'UNSPOKEN',      label:'Söylenmeyen',    prompt:'Kesinlik iddia etmeden nazikçe açılabilecek ne var?'}
];
var ACADEMY_LISTENING_KEYS = ACADEMY_LISTENING_LAYERS.map(function(l){ return l.key; });

/* Scope boundary vocabulary — the Phase 2 safety authority decides what is
   actually unsafe at runtime; Academy only teaches the three zones. */
var ACADEMY_SCOPE_ZONES = ['GREEN','AMBER','RED'];
var ACADEMY_SCOPE_LABEL = { GREEN:'Koçluk alanı', AMBER:'Duraklat ve netleştir', RED:'Koçluğu durdur ve yönlendir' };

var ACADEMY_DISCLAIMER =
  'Bu bir gelişim programıdır; resmî ICF eğitimi, akredite koç eğitimi veya ' +
  'yeterlilik değerlendirmesi değildir. Burada seviye, puan veya kredensiyel kararı verilmez.';

/* ── Bounded strings: curriculum is application content, but a unit that
      grows without limit becomes a wall of text, which is the failure mode
      this phase exists to avoid. ── */
var ACADEMY_LIMITS = { title:90, shortTitle:40, line:320, moment:240, why:320 };
function _acStr(v,max){ return String(v==null?'':v).slice(0, max||ACADEMY_LIMITS.line); }
function _acList(v,max,lim){
  if(!Array.isArray(v)) return [];
  return v.slice(0, max||12).map(function(x){ return _acStr(x, lim); });
}
function _acIds(v,max){
  if(!Array.isArray(v)) return [];
  return v.slice(0, max||16).map(function(x){ return _acStr(x,64); });
}

var ACADEMY_UNITS = {};
var ACADEMY_UNIT_ORDER = [];

/* One learning unit. Every tag list is a pointer into a canonical registry;
   academyIntegrity() proves those pointers resolve. */
function academyRegisterUnit(unitId, def){
  def = def || {};
  var u = {
    unitId: _acStr(unitId,64),
    version: Number(def.version)||1,
    title: _acStr(def.title, ACADEMY_LIMITS.title),
    shortTitle: _acStr(def.shortTitle || def.title, ACADEMY_LIMITS.shortTitle),
    purpose: _acStr(def.purpose, ACADEMY_LIMITS.line),
    level: ACADEMY_LEVELS.indexOf(def.level)>=0 ? def.level : 'FOUNDATION',
    domain: _acStr(def.domain,64),
    /* references, never definitions */
    competencyTags: _acIds(def.competencyTags, 6),
    approachTags: _acIds(def.approachTags, 6),
    interventionTags: _acIds(def.interventionTags, 8),
    antiPatternTags: _acIds(def.antiPatternTags, 8),
    contextTags: _acIds(def.contextTags, 6),
    prerequisites: _acIds(def.prerequisites, 4),
    practiceIds: _acIds(def.practiceIds, 3),
    mirrorLinks: _acIds(def.mirrorLinks, 6),
    /* teaching body */
    objectives: _acList(def.objectives, 5),
    principles: _acList(def.principles, 8),
    goodPractice: _acList(def.goodPractice, 8),
    weakPractice: _acList(def.weakPractice, 8),
    moments: (Array.isArray(def.moments)?def.moments:[]).slice(0,4).map(function(m){
      return { weak:_acStr(m.weak, ACADEMY_LIMITS.moment),
               better:_acStr(m.better, ACADEMY_LIMITS.moment),
               why:_acStr(m.why, ACADEMY_LIMITS.why) };
    }),
    reflectionPrompts: _acList(def.reflectionPrompts, 4),
    realSessionApplication: _acList(def.realSessionApplication, 4),
    listeningLayers: _acIds(def.listeningLayers, 10),
    scopeZone: ACADEMY_SCOPE_ZONES.indexOf(def.scopeZone)>=0 ? def.scopeZone : null,
    evidenceGrade: ['A','B','C','D'].indexOf(def.evidenceGrade)>=0 ? def.evidenceGrade : 'C',
    sourceRefs: _acIds(def.sourceRefs, 6),
    depth: ['KISA','ORTA','DERIN'].indexOf(def.depth)>=0 ? def.depth : 'ORTA',
    status: def.status==='draft' ? 'draft' : 'published'
  };
  ACADEMY_UNITS[u.unitId] = u;
  if(ACADEMY_UNIT_ORDER.indexOf(u.unitId)<0) ACADEMY_UNIT_ORDER.push(u.unitId);
  return u;
}
function academyUnit(unitId){ return ACADEMY_UNITS[unitId] || null; }
function academyUnitsByLevel(level){
  return ACADEMY_UNIT_ORDER.map(academyUnit).filter(function(u){ return u && u.level===level; });
}

/* ── Paths ──
   A path guides an order of learning. It never locks a unit: a coach who
   wants unit 20 first may have unit 20 first. */
var ACADEMY_PATHS = {};
var ACADEMY_PATH_ORDER = [];
function academyRegisterPath(pathId, def){
  def = def || {};
  var p = {
    pathId: _acStr(pathId,64),
    title: _acStr(def.title, ACADEMY_LIMITS.title),
    purpose: _acStr(def.purpose, ACADEMY_LIMITS.line),
    unitIds: _acIds(def.unitIds, 14)
  };
  ACADEMY_PATHS[p.pathId] = p;
  if(ACADEMY_PATH_ORDER.indexOf(p.pathId)<0) ACADEMY_PATH_ORDER.push(p.pathId);
  return p;
}
function academyPath(pathId){ return ACADEMY_PATHS[pathId] || null; }
function academyPaths(){ return ACADEMY_PATH_ORDER.map(academyPath); }

/* ── Integrity ──
   The whole design rests on Academy referencing canonical authorities rather
   than restating them. That only holds if every reference resolves, so this
   is checked rather than trusted. */
function academyIntegrity(){
  var errors = [];
  var haveIntervention = (typeof COACHING_INTERVENTIONS!=='undefined') ? COACHING_INTERVENTIONS : null;
  var haveApproach = (typeof COACHING_APPROACHES!=='undefined') ? COACHING_APPROACHES : null;
  var haveAnti = (typeof COACHING_ANTIPATTERNS!=='undefined') ? COACHING_ANTIPATTERNS : null;
  var havePractice = (typeof COACHING_PRACTICES!=='undefined') ? COACHING_PRACTICES : null;
  var haveMirror = (typeof COACHING_MIRROR_CATEGORIES!=='undefined') ? COACHING_MIRROR_CATEGORIES : null;
  var haveCtx = (typeof COACHING_CONTEXTS!=='undefined') ? COACHING_CONTEXTS : null;
  var haveSource = (typeof coachingSource==='function') ? coachingSource : null;
  /* the competency vocabulary is the Mirror's ICF map — Academy may not coin one */
  var competencies = (typeof COACHING_ICF_AREA!=='undefined')
    ? Object.keys(COACHING_ICF_AREA).map(function(k){ return COACHING_ICF_AREA[k]; }) : null;

  ACADEMY_UNIT_ORDER.forEach(function(id){
    var u = ACADEMY_UNITS[id];
    if(!u.title) errors.push(id+': missing title');
    if(!u.purpose) errors.push(id+': missing purpose');
    if(!u.objectives.length) errors.push(id+': no learning objective');
    u.prerequisites.forEach(function(p){
      if(!ACADEMY_UNITS[p]) errors.push(id+': unknown prerequisite '+p);
      if(p===id) errors.push(id+': is its own prerequisite');
    });
    if(haveIntervention) u.interventionTags.forEach(function(t){
      if(!haveIntervention[t]) errors.push(id+': unknown intervention '+t); });
    if(haveApproach) u.approachTags.forEach(function(t){
      if(!haveApproach[t]) errors.push(id+': unknown approach '+t); });
    if(haveAnti) u.antiPatternTags.forEach(function(t){
      if(!haveAnti[t]) errors.push(id+': unknown anti-pattern '+t); });
    if(havePractice) u.practiceIds.forEach(function(t){
      if(!havePractice[t]) errors.push(id+': unknown practice '+t); });
    if(haveMirror) u.mirrorLinks.forEach(function(t){
      if(haveMirror.indexOf(t)<0) errors.push(id+': unknown mirror category '+t); });
    if(haveCtx) u.contextTags.forEach(function(t){
      if(!haveCtx[t]) errors.push(id+': unknown context '+t); });
    if(competencies) u.competencyTags.forEach(function(t){
      if(competencies.indexOf(t)<0) errors.push(id+': unknown competency '+t); });
    u.listeningLayers.forEach(function(t){
      if(ACADEMY_LISTENING_KEYS.indexOf(t)<0) errors.push(id+': unknown listening layer '+t); });
    if(haveSource) u.sourceRefs.forEach(function(t){
      if(!haveSource(t)) errors.push(id+': unknown source '+t); });
  });
  ACADEMY_PATH_ORDER.forEach(function(pid){
    var p = ACADEMY_PATHS[pid];
    if(!p.unitIds.length) errors.push(pid+': empty path');
    p.unitIds.forEach(function(uid){
      if(!ACADEMY_UNITS[uid]) errors.push(pid+': unknown unit '+uid); });
  });
  return { ok: errors.length===0, errors: errors,
    units: ACADEMY_UNIT_ORDER.length, paths: ACADEMY_PATH_ORDER.length };
}

/* A unit never claims a credential. Enforced, not merely intended. */
var ACADEMY_FORBIDDEN_CLAIMS = /\bACC\b|\bPCC\b|\bMCC\b|akredit|sertifika|kredensiyel|credential|puan[ıi]n|seviyen/i;
function academyClaimAudit(){
  var hits = [];
  ACADEMY_UNIT_ORDER.forEach(function(id){
    var u = ACADEMY_UNITS[id];
    var text = [u.title,u.purpose].concat(u.objectives,u.principles,u.goodPractice,
      u.weakPractice,u.reflectionPrompts,u.realSessionApplication).join(' ');
    if(ACADEMY_FORBIDDEN_CLAIMS.test(text)) hits.push(id);
  });
  return { ok: hits.length===0, hits: hits };
}

if(typeof window!=='undefined'){
  window.ACADEMY_VERSION=ACADEMY_VERSION; window.ACADEMY_LEVELS=ACADEMY_LEVELS;
  window.ACADEMY_LEVEL_LABEL=ACADEMY_LEVEL_LABEL; window.ACADEMY_STATES=ACADEMY_STATES;
  window.ACADEMY_STATE_LABEL=ACADEMY_STATE_LABEL; window.ACADEMY_TRANSITIONS=ACADEMY_TRANSITIONS;
  window.ACADEMY_LISTENING_LAYERS=ACADEMY_LISTENING_LAYERS; window.ACADEMY_LISTENING_KEYS=ACADEMY_LISTENING_KEYS;
  window.ACADEMY_SCOPE_ZONES=ACADEMY_SCOPE_ZONES; window.ACADEMY_SCOPE_LABEL=ACADEMY_SCOPE_LABEL;
  window.ACADEMY_DISCLAIMER=ACADEMY_DISCLAIMER; window.ACADEMY_LIMITS=ACADEMY_LIMITS;
  window.ACADEMY_UNITS=ACADEMY_UNITS; window.ACADEMY_UNIT_ORDER=ACADEMY_UNIT_ORDER;
  window.ACADEMY_PATHS=ACADEMY_PATHS; window.ACADEMY_PATH_ORDER=ACADEMY_PATH_ORDER;
  window.academyRegisterUnit=academyRegisterUnit; window.academyUnit=academyUnit;
  window.academyUnitsByLevel=academyUnitsByLevel; window.academyRegisterPath=academyRegisterPath;
  window.academyPath=academyPath; window.academyPaths=academyPaths;
  window.academyIntegrity=academyIntegrity; window.academyClaimAudit=academyClaimAudit;
  window.academyEvidenceGrades=academyEvidenceGrades;
}
