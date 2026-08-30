/* ══════════════════════════════════════════════════════════════════════════
   COACHING MASTERY OS — PHASE 9f: PRATİK YAP UI

   Three screens: choose, practise, debrief. No score while the coach is in
   the conversation, no meters, no confetti, no robot. The point is to stay
   present with a difficult person who happens not to exist.

   The screen says plainly what this is: authored scenario responses, not a
   model. Overstating it would teach the coach to trust something that is not
   there.

   The typed turn follows the rule the close form, the Academy and the Books
   reflection all arrived at: a refused write never destroys what was typed.
   ══════════════════════════════════════════════════════════════════════════ */

var SIM_UI = { view:'home', session:null, records:[], scenarioId:null,
  intent:'SORU', hint:null, debrief:null, error:null, notice:null,
  turnDraft:null, reflectDraft:null, busy:false };

function _sue(s){ return (typeof U!=='undefined'&&U.esc)?U.esc(String(s==null?'':s)):String(s==null?'':s); }
function _suHead(t,sub,right){
  return (typeof coachingSectionHead==='function') ? coachingSectionHead(t,sub,right||'') : '<h2>'+_sue(t)+'</h2>';
}
function _suNotices(){
  var h='';
  if(SIM_UI.error && typeof coachingBanner==='function') h += coachingBanner('error', SIM_UI.error);
  if(SIM_UI.notice && typeof coachingBanner==='function') h += coachingBanner('info', SIM_UI.notice);
  return h;
}
var _SU_CARD='class="card" style="padding:16px 18px;margin-bottom:12px"';
var _SU_MUTED='style="font-size:11.5px;color:var(--t3)"';

/* ── HOME ─────────────────────────────────────────────────────────────────── */
async function simLoadHome(){
  SIM_UI.busy = true;
  var r = await simLoadRecords();
  if(r.ok){ SIM_UI.records = r.records; SIM_UI.error = null; }
  else {
    if(!Array.isArray(SIM_UI.records)) SIM_UI.records = [];
    SIM_UI.error = (typeof coachingErrorText==='function') ? coachingErrorText(r.error, r.reason) : 'Yüklenemedi.';
  }
  SIM_UI.busy = false;
}
window.simLoadHome = simLoadHome;

/* One recommendation, and it says where it came from. */
function simRecommendScenario(records){
  var active = (typeof coachingActivePractice==='function') ? coachingActivePractice(records) : null;
  if(active && active.code){
    var byPractice = SIM_SCENARIO_ORDER.map(simScenario).filter(function(s){
      return s.practiceIds.indexOf(active.code)>=0 && s.safetyPolicy==='ORDINARY'; });
    if(byPractice.length) return { scenario:byPractice[0],
      why:'Şu anda "'+_sue(active.title||active.code)+'" pratiği üzerinde çalıştığın için.' };
  }
  var unitId = (typeof ACADEMY_UI!=='undefined' && ACADEMY_UI.unitId) ? ACADEMY_UI.unitId : null;
  if(!unitId && typeof academyStateMap==='function'){
    var st = academyStateMap(records);
    unitId = (typeof ACADEMY_UNIT_ORDER!=='undefined' ? ACADEMY_UNIT_ORDER : [])
      .filter(function(id){ return st[id]==='IN_PROGRESS' || st[id]==='PRACTICING'; })[0] || null;
  }
  if(unitId){
    var byUnit = SIM_SCENARIO_ORDER.map(simScenario).filter(function(s){
      return s.academyUnitTags.indexOf(unitId)>=0 && s.safetyPolicy==='ORDINARY'; });
    var u = (typeof academyUnit==='function') ? academyUnit(unitId) : null;
    if(byUnit.length) return { scenario:byUnit[0],
      why:'Akademi\'de "'+_sue(u?u.title:unitId)+'" çalışmasını sürdürdüğün için.' };
  }
  var foundation = SIM_SCENARIO_ORDER.map(simScenario).filter(function(s){
    return s.difficulty==='FOUNDATION' && s.safetyPolicy==='ORDINARY'; })[0];
  return foundation ? { scenario:foundation,
    why:'Henüz aktif bir pratik veya çalışma yok; temel bir senaryoyla başlamanı öneriyoruz.' } : null;
}
window.simRecommendScenario = simRecommendScenario;

function renderSimHome(){
  SIM_UI.view = 'home';
  var recs = SIM_UI.records;
  var h = '<div class="fade" style="max-width:780px">';
  h += _suHead('Pratik Yap', 'Gerçek danışan olmadan, güvenli bir ortamda koçluk pratiği.');
  h += _suNotices();
  h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>'+_sue(SIM_DISCLAIMER)+'</p></div>';

  var active = (typeof coachingActivePractice==='function') ? coachingActivePractice(recs) : null;
  if(active)
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>ŞU ANDA ÇALIŞTIĞIN</p>'+
      '<p style="font-size:14px;font-weight:600;margin-top:6px">'+_sue(active.title||active.code)+'</p>'+
      '<p '+_SU_MUTED+'>'+_sue(active.instruction||'')+'</p></div>';

  var rec = simRecommendScenario(recs);
  if(rec)
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>ÖNERİLEN SENARYO</p>'+
      '<p style="font-size:15px;font-weight:600;margin-top:6px">'+_sue(rec.scenario.title)+'</p>'+
      '<p '+_SU_MUTED+'>'+_sue(rec.scenario.developmentGoal)+'</p>'+
      '<details style="margin-top:6px"><summary style="font-size:11.5px;color:var(--blue);cursor:pointer">Neden bunu öneriyor?</summary>'+
      '<p '+_SU_MUTED+' style="margin-top:5px">'+_sue(rec.why)+'</p></details>'+
      '<button class="btn btn-p btn-s" style="margin-top:10px" onclick="simOpenBriefing(\''+_sue(rec.scenario.scenarioId)+'\')">Başla</button></div>';

  h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>SENARYOLAR</p>';
  SIM_CONTEXTS.forEach(function(ctx){
    var list = simScenariosByContext(ctx);
    if(!list.length) return;
    h += '<details style="margin-top:10px"><summary style="font-size:12.5px;font-weight:600;cursor:pointer">'+
      _sue(SIM_CONTEXT_LABEL[ctx]||ctx)+' <span '+_SU_MUTED+'>('+list.length+')</span></summary>';
    list.forEach(function(s){
      h += '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:8px" '+
        'onclick="simOpenBriefing(\''+_sue(s.scenarioId)+'\')">'+
        '<span style="font-weight:600">'+_sue(s.title)+'</span> '+
        '<span '+_SU_MUTED+'>· '+_sue(SIM_DIFFICULTY_LABEL[s.difficulty])+'</span>'+
        (s.safetyPolicy==='BOUNDARY_DRILL'
          ? ' <span class="pill p-orange" style="font-size:9.5px">sınır alıştırması</span>' : '')+
        '</button>';
    });
    h += '</details>';
  });
  h += '</div>';

  var past = simSessionsFrom(recs).slice(0,5);
  if(past.length){
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>SON PRATİKLER</p>';
    past.forEach(function(p){
      var s = simScenario(p.scenarioId);
      h += '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:8px" '+
        'onclick="simOpenPast(\''+_sue(p.id)+'\')">'+_sue(s?s.title:p.scenarioId)+
        ' <span '+_SU_MUTED+'>· '+_sue((p.status==='COMPLETED')?'tamamlandı':'yarım')+'</span></button>';
    });
    h += '</div>';
  }
  h += '</div>';
  sh('pinner', h);
}
window.renderSimHome = renderSimHome;

/* ── BRIEFING — what the coach may know before starting ──────────────────── */
function simOpenBriefing(scenarioId){
  if(!simScenario(scenarioId)) return;
  SIM_UI.scenarioId = scenarioId; SIM_UI.view = 'briefing';
  SIM_UI.error = null; SIM_UI.notice = null;
  renderSimBriefing();
}
window.simOpenBriefing = simOpenBriefing;

function renderSimBriefing(){
  var b = simBriefing(SIM_UI.scenarioId);
  if(!b){ renderSimHome(); return; }
  SIM_UI.view = 'briefing';
  var h = '<div class="fade" style="max-width:700px">';
  h += _suHead(b.title, SIM_CONTEXT_LABEL[b.context]+' · '+SIM_DIFFICULTY_LABEL[b.difficulty],
    '<button class="btn btn-s" onclick="simBackHome()">Geri</button>');
  h += _suNotices();
  if(b.safetyPolicy==='BOUNDARY_DRILL')
    h += '<div '+_SU_CARD+'><p style="font-size:12.5px;font-weight:600">Sınır tanıma alıştırması</p>'+
      '<p '+_SU_MUTED+' style="margin-top:6px">Bu senaryoda amaç koçluğu sürdürmek değil, kapsam dışına çıkıldığını fark edip durmaktır.</p></div>';
  h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>DURUM</p>'+
    '<p style="font-size:13px;margin-top:6px">'+_sue(b.visibleContext)+'</p>'+
    '<p '+_SU_MUTED+' style="margin-top:8px">'+_sue(b.clientProfile)+'</p></div>';
  h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>BU PRATİKTE ÇALIŞACAĞIN ŞEY</p>'+
    '<p style="font-size:13px;margin-top:6px">'+_sue(b.developmentGoal)+'</p></div>';
  h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>'+_sue(SIM_PRIVACY_REMINDER)+' '+_sue(SIM_DISCLAIMER)+'</p></div>';
  h += '<button class="btn btn-p" style="width:100%;height:42px" onclick="simStart()">Pratiği Başlat</button>';
  h += '</div>';
  sh('pinner', h);
}
window.renderSimBriefing = renderSimBriefing;

function simStart(){
  var s = simBuildSession(SIM_UI.scenarioId, {});
  if(!s){ SIM_UI.error='Senaryo bulunamadı.'; renderSimHome(); return; }
  var active = (typeof coachingActivePractice==='function') ? coachingActivePractice(SIM_UI.records) : null;
  if(active) s.focusPracticeId = active.id || null;
  SIM_UI.session = s; SIM_UI.view = 'live'; SIM_UI.intent = 'SORU';
  SIM_UI.hint = null; SIM_UI.turnDraft = null; SIM_UI.error = null; SIM_UI.notice = null;
  renderSimLive();
}
window.simStart = simStart;

/* ── LIVE ─────────────────────────────────────────────────────────────────── */
function renderSimLive(){
  var s = SIM_UI.session;
  if(!s){ renderSimHome(); return; }
  SIM_UI.view = 'live';
  var sc = simScenario(s.scenarioId);
  var h = '<div class="fade" style="max-width:720px">';
  h += _suHead(sc?sc.title:'Pratik', sc?sc.visibleContext:'',
    '<button class="btn btn-s" onclick="simAbandon()">Çık</button>');
  h += _suNotices();

  h += '<div '+_SU_CARD+' id="sim-convo">';
  s.turns.forEach(function(t){
    if(t.role==='client'){
      h += '<div style="margin-bottom:12px"><p '+_SU_MUTED+'>Danışan</p>'+
        '<p style="font-size:13px;line-height:1.7">'+_sue(t.text)+'</p></div>';
    } else {
      var lbl = SIM_INTENT_LABEL[t.intent]||'';
      h += '<div style="margin-bottom:12px;padding-left:12px;border-left:2px solid var(--s2)">'+
        '<p '+_SU_MUTED+'>Sen · '+_sue(lbl)+'</p>'+
        '<p style="font-size:13px;line-height:1.7">'+
        (t.intent==='SESSIZLIK' ? '<em '+_SU_MUTED+'>(bekledin, alan bıraktın)</em>' : _sue(t.text))+
        '</p></div>';
    }
  });
  h += '</div>';

  var draft = (SIM_UI.turnDraft!=null) ? SIM_UI.turnDraft : '';
  h += '<div '+_SU_CARD+'>'+
    '<p '+_SU_MUTED+'>NE YAPMAK İSTİYORSUN?</p>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
  SIM_INTENTS.filter(function(i){ return i!=='SESSIZLIK'; }).forEach(function(i){
    h += '<button class="btn btn-s"'+(SIM_UI.intent===i?' style="border-color:var(--blue)"':'')+
      ' onclick="simSetIntent(\''+i+'\')">'+_sue(SIM_INTENT_LABEL[i])+'</button>';
  });
  h += '</div>'+
    '<textarea class="inp" id="sim_input" rows="3" placeholder="Ne söylersin?" style="margin-top:10px">'+_sue(draft)+'</textarea>'+
    '<p '+_SU_MUTED+' style="margin-top:5px">'+_sue(SIM_PRIVACY_REMINDER)+'</p>'+
    '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+
    '<button class="btn btn-p btn-s" onclick="simSend()">Söyle</button>'+
    '<button class="btn btn-s" onclick="simSilence()">Bekle / alan bırak</button>'+
    '<button class="btn btn-s" onclick="simShowHint()">İpucu</button>'+
    (simCanEnd(s)?'<button class="btn btn-s" onclick="simEnd()">Pratiği bitir</button>':'')+
    '</div>';
  if(SIM_UI.hint) h += '<p '+_SU_MUTED+' style="margin-top:10px">'+_sue(SIM_UI.hint)+'</p>';
  h += '</div>';

  var used = s.turns.filter(function(t){ return t.role==='coach'; }).length;
  if(used >= SIM_TURN_CAP - 3)
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>Pratiğin sonuna yaklaşıyorsun ('+used+'/'+SIM_TURN_CAP+
      '). Kapatmayı düşünebilirsin — bir konuyu çözmek zorunda değilsin.</p></div>';
  h += '</div>';
  sh('pinner', h);
}
window.renderSimLive = renderSimLive;

function simSetIntent(i){
  if(SIM_INTENTS.indexOf(i)<0) return;
  var el = ge('sim_input'); if(el) SIM_UI.turnDraft = el.value||'';
  SIM_UI.intent = i; renderSimLive();
}
window.simSetIntent = simSetIntent;

function simShowHint(){
  var el = ge('sim_input'); if(el) SIM_UI.turnDraft = el.value||'';
  SIM_UI.hint = simHint(SIM_UI.session); renderSimLive();
}
window.simShowHint = simShowHint;

function _simAdvance(text, intent){
  var s = SIM_UI.session;
  var res = simCoachTurn(s, text, intent);
  if(!res.ok){
    SIM_UI.error = (res.error==='empty_turn') ? 'Bir şey yaz ya da "Bekle / alan bırak" seç.'
      : (res.error==='turn_cap_reached') ? 'Bu pratik için tur sınırına ulaştın. Bitirip geri bildirime bakabilirsin.'
      : 'Şu an devam edilemedi.';
    renderSimLive(); return false;
  }
  s.turns = s.turns.concat([res.coachTurn, res.clientTurn]);
  s.state = res.state;
  if(res.safetyStop){
    s.boundaryHandled = true;
    SIM_UI.notice = 'Güvenlik sınırı: bu noktada koçluk sürdürülmez. Doğru hamle durmak ve onaylı yönlendirme yolunu izlemektir.';
  }
  if(res.boundaryReached) s.boundaryReached = true;
  SIM_UI.turnDraft = null; SIM_UI.hint = null; SIM_UI.error = null;
  return true;
}

function simSend(){
  var el = ge('sim_input');
  var text = el ? (el.value||'') : '';
  SIM_UI.turnDraft = text;                     /* captured before anything can refuse it */
  if(_simAdvance(text, SIM_UI.intent)) renderSimLive();
}
window.simSend = simSend;

function simSilence(){
  var el = ge('sim_input'); if(el) SIM_UI.turnDraft = el.value||'';
  if(_simAdvance('', 'SESSIZLIK')){ SIM_UI.turnDraft = (ge('sim_input')||{}).value||null; renderSimLive(); }
}
window.simSilence = simSilence;

function simAbandon(){
  SIM_UI.session = null; SIM_UI.view='home'; SIM_UI.error=null;
  SIM_UI.notice = 'Pratik kaydedilmeden kapatıldı.';
  renderSimHome();
}
window.simAbandon = simAbandon;

/* ── DEBRIEF ──────────────────────────────────────────────────────────────── */
async function simEnd(){
  var s = SIM_UI.session;
  if(!s || !simCanEnd(s)) return;
  s.status = 'COMPLETED';
  s.completedAt = (function(){ try{ return new Date().toISOString(); }catch(e){ return ''; } })();
  var d = simBuildDebrief(s);
  s.debrief = d;
  SIM_UI.debrief = d;
  var res = await simSaveSession(s);
  if(!res.ok){
    SIM_UI.error = (typeof coachingErrorText==='function') ? coachingErrorText(res.error, res.reason) : 'Kaydedilemedi.';
    /* the practice is still on screen and the debrief still stands */
  } else {
    SIM_UI.error = null;
    var i=-1;
    for(var k=0;k<SIM_UI.records.length;k++){ if(SIM_UI.records[k].id===res.record.id){ i=k; break; } }
    if(i>=0) SIM_UI.records[i]=res.record; else SIM_UI.records.push(res.record);
  }
  SIM_UI.view = 'debrief';
  renderSimDebrief();
}
window.simEnd = simEnd;

function _suObs(list, tone){
  var h='';
  list.forEach(function(o){
    h += '<div style="padding:9px 0;border-top:1px solid var(--s2)">'+
      '<p style="font-size:13px;font-weight:600">'+_sue(o.title)+
      (o.evidenceLayer==='INFERRED' ? ' <span class="pill p-gray" style="font-size:9.5px">yorum</span>' : '')+'</p>'+
      '<p '+_SU_MUTED+' style="margin-top:4px">'+_sue(o.text)+'</p></div>';
  });
  return h;
}

function renderSimDebrief(){
  var d = SIM_UI.debrief;
  if(!d){ renderSimHome(); return; }
  SIM_UI.view = 'debrief';
  var sc = simScenario(d.scenarioId);
  var h = '<div class="fade" style="max-width:740px">';
  h += _suHead('Pratik geri bildirimi', sc?sc.title:'',
    '<button class="btn btn-s" onclick="simBackHome()">Kapat</button>');
  h += _suNotices();

  if(d.strengths.length)
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>GÜÇLÜ OLAN</p>'+_suObs(d.strengths)+'</div>';
  if(d.notice.length)
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>DİKKAT ET</p>'+_suObs(d.notice)+'</div>';
  if(d.missed.length)
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>KAÇIRILAN FIRSAT</p>'+_suObs(d.missed)+'</div>';

  h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>DANIŞAN SAHİPLİĞİ VE ALAN</p>'+
    '<p style="font-size:12.5px;margin-top:6px">Sahiplik: '+_sue(SIM_OWNERSHIP_LABEL[d.finalState.ownership])+
    ' · Katılım: '+_sue(SIM_ENGAGEMENT_LABEL[d.finalState.engagement])+
    ' · Derinlik: '+_sue(SIM_DEPTH_LABEL[d.finalState.depth])+'</p></div>';

  h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>MÜDAHALE DENGESİ</p><p style="font-size:12.5px;margin-top:6px">';
  h += SIM_INTENTS.filter(function(i){ return d.interventionMix[i]>0; }).map(function(i){
    return _sue(SIM_INTENT_LABEL[i])+': '+d.interventionMix[i]; }).join(' · ');
  h += '</p></div>';

  if(d.practiceCode){
    var pd = (typeof coachingPracticeDef==='function') ? coachingPracticeDef(d.practiceCode) : null;
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>SONRAKİ TEK PRATİK</p>'+
      '<p style="font-size:13.5px;font-weight:600;margin-top:6px">'+_sue(pd?pd.title:d.practiceCode)+'</p>'+
      '<p '+_SU_MUTED+'>'+_sue(pd?pd.instruction:'')+'</p>'+
      '<button class="btn btn-p btn-s" style="margin-top:10px" onclick="simAdopt()">Bunu pratiğim yap</button></div>';
  }
  if(d.academyUnitIds.length && typeof academyUnit==='function'){
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>AKADEMİ</p>';
    d.academyUnitIds.forEach(function(u){
      var un = academyUnit(u); if(!un) return;
      h += '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:8px" '+
        'onclick="simGotoUnit(\''+_sue(u)+'\')">'+_sue(un.title)+'</button>'; });
    h += '</div>';
  }
  if(d.bookIds.length && typeof book==='function'){
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>KİTAPLIK</p>';
    d.bookIds.forEach(function(b){
      var bk = book(b); if(!bk) return;
      h += '<button class="btn btn-s" style="display:block;width:100%;text-align:left;margin-top:8px" '+
        'onclick="simGotoBook(\''+_sue(b)+'\')">'+_sue(bk.title)+'</button>'; });
    h += '</div>';
  }
  if(d.icfAreas.length)
    h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>İLGİLİ GELİŞİM ALANLARI</p>'+
      '<p style="font-size:12.5px;margin-top:6px">'+_sue(d.icfAreas.join(' · '))+'</p>'+
      '<p '+_SU_MUTED+' style="margin-top:6px">'+
      _sue((typeof COACHING_ICF_DISCLAIMER!=='undefined')?COACHING_ICF_DISCLAIMER:'')+'</p></div>';

  var refl = SIM_UI.reflectDraft;
  h += '<div '+_SU_CARD+'><p '+_SU_MUTED+'>KENDİ YANSIMAN</p>'+
    '<textarea class="inp" id="sim_reflect" rows="3" placeholder="Ne fark ettin? Neyi farklı yapardın?" '+
    'style="margin-top:8px">'+_sue(refl!=null?refl:'')+'</textarea>'+
    '<button class="btn btn-s" style="margin-top:8px" onclick="simSaveReflectionNow()">Kaydet</button></div>';

  h += '<p '+_SU_MUTED+'>'+_sue(d.disclaimer)+'</p>';
  h += '</div>';
  sh('pinner', h);
}
window.renderSimDebrief = renderSimDebrief;

async function simAdopt(){
  var res = await simAdoptPractice(SIM_UI.debrief);
  if(!res.ok){
    SIM_UI.error = (typeof coachingErrorText==='function') ? coachingErrorText(res.error, res.reason) : 'Kaydedilemedi.';
    renderSimDebrief(); return;
  }
  SIM_UI.records.push(res.practice);
  SIM_UI.notice = 'Bir sonraki gerçek görüşmen için kasıtlı pratiğin ayarlandı.';
  SIM_UI.error = null;
  renderSimDebrief();
}
window.simAdopt = simAdopt;

async function simSaveReflectionNow(){
  var el = ge('sim_reflect');
  var text = el ? (el.value||'') : '';
  SIM_UI.reflectDraft = text;                  /* captured before the write */
  if(!String(text).trim()){ SIM_UI.notice='Yazacak bir şey yok.'; renderSimDebrief(); return; }
  var res = await simSaveReflection(SIM_UI.debrief.sessionId, text);
  if(!res.ok){
    SIM_UI.error = (typeof coachingErrorText==='function') ? coachingErrorText(res.error, res.reason) : 'Kaydedilemedi.';
    renderSimDebrief(); return;                /* draft kept */
  }
  SIM_UI.records.push(res.record);
  SIM_UI.reflectDraft = null; SIM_UI.error = null;
  SIM_UI.notice = 'Yansıman kaydedildi. Yalnız sana açık.';
  renderSimDebrief();
}
window.simSaveReflectionNow = simSaveReflectionNow;

function simOpenPast(sessionId){
  var rec = simSessionsFrom(SIM_UI.records).filter(function(r){ return r.id===sessionId; })[0];
  if(!rec || !rec.debrief){ SIM_UI.notice='Bu pratiğin geri bildirimi yok.'; renderSimHome(); return; }
  SIM_UI.debrief = rec.debrief; SIM_UI.reflectDraft = null;
  SIM_UI.view='debrief'; renderSimDebrief();
}
window.simOpenPast = simOpenPast;

function simBackHome(){
  SIM_UI.view='home'; SIM_UI.session=null; SIM_UI.error=null; SIM_UI.notice=null;
  renderSimHome();
}
window.simBackHome = simBackHome;

function simGotoUnit(u){
  if(typeof gotoTab!=='function' || typeof academyOpenUnit!=='function') return;
  gotoTab('academy'); academyOpenUnit(u);
}
window.simGotoUnit = simGotoUnit;
function simGotoBook(b){
  if(typeof gotoTab!=='function' || typeof booksOpen!=='function') return;
  gotoTab('books'); booksOpen(b);
}
window.simGotoBook = simGotoBook;

if(typeof window!=='undefined'){ window.SIM_UI=SIM_UI; }
