function applyTheme(){
  document.body.className=dark?'dark':'';
  var btn=ge('theme-btn');
  if(btn)btn.innerHTML=dark?ic('sun',15):ic('moon',15);
}
function toggleDark(){dark=!dark;localStorage.setItem('fu7_t',dark?'1':'');applyTheme();}
window.toggleDark=toggleDark;

function updateClock(){
  var now=new Date();
  var qe=ge('top-q'),we=ge('top-w'),ce=ge('top-cl');
  if(qe)qe.textContent=U.quarter(now)+' Çeyrek';
  if(we)we.textContent='Hafta '+U.isoWeek(now);
  if(ce)ce.textContent=now.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})+' · '+now.toLocaleTimeString('tr-TR');
}
setInterval(updateClock,1000);

var NAV=[
  {sec:'secMain',items:[{id:'dashboard',l:'Dashboard',i:'dash'},{id:'kpi',l:'KPI & Metrikler',i:'kpi'},{id:'challenges',l:'90-Gün Mücadelesi',i:'trophy'}]},
  {sec:'secMethod',items:[{id:'smart',l:'SMART Hedef Motoru',i:'tgt'},{id:'onething',l:'ONE Thing',i:'zap'},{id:'frog',l:'Eat That Frog',i:'flame'},{id:'timeblock',l:'Zaman Bloklama',i:'ci'},{id:'weeklyreview',l:'Haftalık Review',i:'ref'},{id:'gtd',l:'GTD Inbox',i:'arc'}]},
  {sec:'secProd',items:[{id:'goals',l:'Hedefler',i:'tgt'},{id:'todos',l:'Yapılacaklar',i:'csq'},{id:'habits',l:'Alışkanlıklar',i:'star'},{id:'routines',l:'Rutinler',i:'ref'}]},
  {sec:'secBook',items:[{id:'library',l:'Kitap Kütüphanesi',i:'bk'},{id:'mybooks',l:'Okuma Listesi',i:'layers'},{id:'readingplan',l:'Okuma Planları',i:'bk'}]},
  {sec:'secKnow',items:[{id:'generalnotes',l:'Genel Notlar',i:'pen'},{id:'restore',l:'Yedekler / Geri Yükleme',i:'arc'},{id:'quotes',l:'Öz Sözler',i:'qt'},{id:'journal',l:'Günlük',i:'pen'},{id:'principles',l:'Prensipler',i:'sh'},{id:'coaching',l:'Koçluk',i:'us'},{id:'vault',l:'Bilgi Kasası',i:'arc'}]},
  {sec:'secSys',items:[{id:'deepwork',l:'Derin Çalışma',i:'brain'},{id:'sop',l:'SOP Şablonları',i:'layers'},{id:'tools',l:'Odak Araçları',i:'hp'}]},
];

function renderNav(){
  var h='';
  for(var g=0;g<NAV.length;g++){
    h+='<p class="nsec">'+L(NAV[g].sec)+'</p>';
    for(var n=0;n<NAV[g].items.length;n++){
      var it=NAV[g].items[n],on=tab===it.id?' on':'';
      h+='<button class="nb'+on+'" data-tab="'+it.id+'" onclick="gotoTab(this.dataset.tab)"><span class="ni">'+ic(it.i,13)+'</span>'+L(it.l)+'</button>';
    }
  }
  sh('nav-root',h);
  var b='<div class="div"></div>';
  b+='<button class="nb'+(tab==='history'?' on':'')+'" data-tab="history" onclick="gotoTab(this.dataset.tab)"><span class="ni">'+ic('act',13)+'</span>'+L('history')+'</button>';
  b+='<button class="nb" onclick="undo()" style="opacity:'+(hist.length?1:0.35)+'"><span class="ni">'+ic('undo',13)+'</span>'+L('undo')+(hist.length?' ('+hist.length+')':'')+'</button>';
  b+='<button class="nb" data-fn="dl" onclick="U.dl(D,&quot;FocusUp_Backup.json&quot;)"><span class="ni">'+ic('dl',13)+'</span>'+L('backup')+'</button>';
  sh('nav-bot',b);
}

function showModal(html){
  sh('modal-root','<div class="ov" id="ov"><div class="mbox fade">'+html+'</div></div>');
  var ov=ge('ov');
  if(ov)ov.addEventListener('click',function(e){if(e.target.id==='ov')closeModal();});
}
function closeModal(){
  /* FAZ-4.1 + FAZ-6: dirty not taslaginda kapatma korumasi (Kapat butonu + scrim). */
  if(typeof rstMaybeCancelSession==='function')rstMaybeCancelSession(); // D9: scrim ile kapatinca restore oturumunu guvenle iptal et
  if(typeof gnCaptureDraft==='function')gnCaptureDraft();
  if(typeof gnDraftDirty==='function'&&gnDraftDirty()&&!confirm('Kaydedilmemiş not değişiklikleri var. Kapatılsın mı?'))return;
  if(typeof noteDraftDirty==='function'&&noteDraftDirty()&&!confirm('Kaydedilmemiş not değişiklikleri var. Kapatılsın mı?'))return;
  if(typeof gnClearDraft==='function')gnClearDraft();
  if(typeof clearNoteDraft==='function')clearNoteDraft();noteEditGid=null;
  sh('modal-root','');
}
window.closeModal=closeModal;

var FDEFS={
  goal:['title:Hedef:text:1','cat:Kategori:sel:0:İş|Kişisel|Sağlık|Finans|Gelişim|İlişki|Eğitim|Diğer','quarter:Çeyrek:sel:0:Q1|Q2|Q3|Q4','deadline:Deadline:date:0','measurable:Başarı kriteri:text:0','desc:Tanim:ta:0'],
  todo:['text:Görev:text:1','priority:Onem:sel:0:normal|high|urgent','category:Kategori:sel:0:İş|Kişisel|Aile|Finans|Gelişim','end:Bitis:date:0'],
  kpi:['name:KPI adi:text:1','unit:Birim:text:0','target:Hedef:text:1','current:Mevcut:text:0','cat:Kategori:sel:0:İş|Sağlık|Gelişim|Finans'],
  habit:['name:Alışkanlık adi:text:1','color:Renk:sel:0:blue|green|orange|purple|red'],
  quote:['text:Söz:ta:1','author:Kaynak:text:0','cat:Kategori:text:0'],
  journal:['cat:Kategori:text:0','text:İçerik:ta:1'],
  principle:['type:Tur:text:0','text:İçerik:ta:1'],
  coaching:['title:Başlık:text:1','cat:Kategori:text:0','text:İçerik:ta:1'],
  vault:['title:Başlık:text:1','cat:Kategori:text:0','text:İçerik:ta:1'],
  question:['text:Soru:ta:1'],
  sop:['title:Başlık:text:1'],
  routine:['t:Rutin adi:text:1','period:Periyot:sel:0:daily|weekly|monthly|quarterly|yearly'],
  gtd:['text:Fikir/Görev:ta:1'],
};
var FTITLES={goal:'Hedef',todo:'Görev',kpi:'KPI',habit:'Alışkanlık',quote:'Söz',journal:'Günlük',principle:'Prensip',coaching:'Koçluk',vault:'Not',question:'Soru',sop:'SOP',routine:'Rutin',gtd:'GTD Notu'};

function openForm(type){
  var defs=FDEFS[type]||[];
  var h='<div class="mh"><span style="font-weight:700;font-size:15px">'+(FTITLES[type]||type)+' Ekle</span><button class="btn btn-g btn-ic" onclick="closeModal()">'+ic('x',14)+'</button></div><div class="mb">';
  for(var i=0;i<defs.length;i++){
    var p=defs[i].split(':'),n=p[0],ph=p[1],tp=p[2],req=p[3]==='1',opts=(p[4]||'').split('|');
    h+='<div>';
    if(tp==='cb'){h+='<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="checkbox" class="cb" id="f_'+n+'"> '+ph+'</label>';}
    else if(tp==='sel'){h+='<p class="lbl" style="margin-bottom:3px">'+ph+'</p><select class="inp" id="f_'+n+'">';for(var o=0;o<opts.length;o++)h+='<option>'+opts[o]+'</option>';h+='</select>';}
    else if(tp==='ta'){h+='<p class="lbl" style="margin-bottom:3px">'+ph+'</p><textarea class="inp" id="f_'+n+'" rows="3"'+(req?' required':'')+'></textarea>';}
    else if(tp==='date'){h+='<p class="lbl" style="margin-bottom:3px">'+ph+'</p><input type="date" class="inp" id="f_'+n+'">';}
    else{h+='<p class="lbl" style="margin-bottom:3px">'+ph+'</p><input type="text" class="inp" id="f_'+n+'" placeholder="'+ph+'"'+(req?' required':'')+'>';}
    h+='</div>';
  }
  h+='</div><div class="mf"><button class="btn btn-s" style="flex:1" onclick="closeModal()">İptal</button><button class="btn btn-p" style="flex:2" data-type="'+type+'" onclick="submitForm(this.dataset.type)">Kaydet</button></div>';
  showModal(h);
}
window.openForm=openForm;

function submitForm(type){
  var defs=FDEFS[type]||[],vals={},ok=true;
  for(var i=0;i<defs.length;i++){
    var p=defs[i].split(':'),n=p[0],tp=p[2],req=p[3]==='1';
    var el=ge('f_'+n);if(!el)continue;
    vals[n]=tp==='cb'?el.checked:el.value;
    if(req&&!vals[n])ok=false;
  }
  if(!ok){alert(L('required'));return;}
  snap();var id=Date.now();
  if(type==='routine'){
    var per=vals.period||'daily';
    D.routines[per]=(D.routines[per]||[]).concat([{id:id,t:vals.t,last:null}]);
    log('Rutin eklendi');xp(10,'Rutin');closeModal();renderPage();return;
  }
  if(type==='sop'){D.sops=[{id:id,title:vals.title,steps:[]}].concat(D.sops||[]);log('SOP eklendi');closeModal();renderPage();return;}
  if(type==='gtd'){D.gtdInbox=[{id:id,text:vals.text,status:'inbox',addedAt:U.today()}].concat(D.gtdInbox||[]);log('GTD eklendi');closeModal();renderPage();return;}
  var km={goal:'goals',todo:'todos',kpi:'kpis',habit:'habits',quote:'quotes',journal:'journal',principle:'principles',coaching:'coaching',vault:'vault',question:'questions'};
  var item=Object.assign({id:id},vals);
  if(type==='goal'){item.frog=false;item.steps=[];item.notes='';item.status='active';item.createdAt=U.today();}
  if(type==='todo')item.done=false;
  if(type==='kpi'){item.target=parseFloat(vals.target)||0;item.current=parseFloat(vals.current)||0;item.hist=[parseFloat(vals.current)||0];}
  if(type==='journal')item.date=U.today();
  if(km[type])D[km[type]]=[item].concat(D[km[type]]||[]);
  log(type+' eklendi');xp(20,'Yeni '+type);closeModal();renderPage();
}
window.submitForm=submitForm;


function startTm(){
  if(tmInt)clearInterval(tmInt);tmOn=true;
  tmInt=setInterval(function(){
    tmLeft--;
    if(tmLeft<=0){tmLeft=0;tmOn=false;clearInterval(tmInt);tmInt=null;if(tmMode==='focus'){xp(50,'Pomodoro');D.stats.totalFocus=(D.stats.totalFocus||0)+25;save();}}
    renderTm();
  },1000);
}
function stopTm(){tmOn=false;if(tmInt){clearInterval(tmInt);tmInt=null;}renderTm();}
function resetTm(){stopTm();tmLeft=TDUR[tmMode];renderTm();}
function setTmMode(m){tmMode=m;tmLeft=TDUR[m];stopTm();}
window.setTmMode=setTmMode;

function renderTm(){
  var el=ge('timer-block');if(!el)return;
  var C=2*Math.PI*50,p=tmLeft/TDUR[tmMode],off=C*(1-p);
  var sc=tmMode==='focus'?'var(--blue)':'var(--green)';
  var modeLabels={focus:'Odak',short:'Kısa Mola',long:'Uzun Mola'};
  var h='<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px">';
  h+='<div style="display:flex;gap:4px">';
  ['focus','short','long'].forEach(function(m){
    var a=tmMode===m;
    h+='<button class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'" data-m="'+m+'" onclick="setTmMode(this.dataset.m);renderTm()">'+modeLabels[m]+'</button>';
  });
  h+='</div>';
  h+='<div style="position:relative;width:110px;height:110px">';
  h+='<svg viewBox="0 0 108 108" style="position:absolute;inset:0;width:100%;height:100%">';
  h+='<circle cx="54" cy="54" r="50" fill="none" stroke="var(--s2)" stroke-width="5"/>';
  h+='<circle cx="54" cy="54" r="50" fill="none" stroke="'+sc+'" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+off+'" style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1s linear"/>';
  h+='</svg>';
  h+='<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">';
  h+='<span style="font-size:26px;font-weight:800;letter-spacing:-1px;line-height:1">'+U.fmt(tmLeft)+'</span>';
  h+='<span style="font-size:9px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.06em">'+modeLabels[tmMode]+'</span>';
  h+='</div></div>';
  h+='<div style="display:flex;gap:7px">';
  if(tmOn){h+='<button class="btn btn-p" onclick="stopTm()">'+ic('pause',12)+' Durdur</button>';}
  else{h+='<button class="btn btn-p" onclick="startTm()">'+ic('play',12)+' Baslat</button>';}
  h+='<button class="btn btn-s btn-ic" onclick="resetTm()">'+ic('rst',13)+'</button>';
  h+='</div></div>';
  el.innerHTML=h;
}

function enterDW(mins){
  var inp=ge('dw-task-inp');var task=inp?inp.value:'Derin Çalışma';
  dwLeft=mins*60;dwOn=false;if(dwInt){clearInterval(dwInt);dwInt=null;}
  var te=ge('dw-title'),tme=ge('dw-time'),btne=ge('dw-btn');
  if(te)te.textContent=task||'Derin Çalışma Oturumu';
  if(tme)tme.textContent=U.fmt(dwLeft);if(btne)btne.textContent='Baslat';
  var ov=ge('dw-ov');if(ov)ov.classList.add('show');
}
function dwToggle(){
  if(!dwOn){
    dwOn=true;var btn=ge('dw-btn');if(btn)btn.textContent='Durdur';
    dwInt=setInterval(function(){
      dwLeft--;var tme=ge('dw-time');if(tme)tme.textContent=U.fmt(dwLeft);
      if(dwLeft<=0){dwOn=false;clearInterval(dwInt);dwInt=null;D.deepWorkSessions=(D.deepWorkSessions||0)+1;xp(75,'Deep Work');save();exitDW();alert('Deep Work tamamlandı! +75 XP');}
    },1000);
  }else{dwOn=false;clearInterval(dwInt);dwInt=null;var btn2=ge('dw-btn');if(btn2)btn2.textContent='Devam';}
}
function exitDW(){dwOn=false;if(dwInt){clearInterval(dwInt);dwInt=null;}var ov=ge('dw-ov');if(ov)ov.classList.remove('show');}
document.addEventListener('keydown',function(e){if(e.key==='Escape')exitDW();});
window.enterDW=enterDW;window.dwToggle=dwToggle;window.exitDW=exitDW;

function toggleSound(url){
  if(audio&&D.activeSound===url){audio.pause();audio=null;D.activeSound=null;save();renderPage();}
  else{
    if(audio)audio.pause();
    try{audio=new Audio(url);audio.loop=true;audio.volume=D.vol;audio.play().catch(function(){});}catch(e){}
    D.activeSound=url;save();renderPage();
  }
}
function setVol(v){D.vol=parseFloat(v);if(audio)audio.volume=D.vol;var vp=ge('vol-pct');if(vp)vp.textContent=Math.round(D.vol*100)+'%';save();}
window.toggleSound=toggleSound;window.setVol=setVol;


function renderDashboard(){
  var today=U.today();
  var xpv=D.stats.xp||0,lvl=D.stats.level||1,xpInLvl=xpv%500;
  var otDone=D.oneThing&&D.oneThing.date===today&&D.oneThing.task;
  var urgentTodos=D.todos.filter(function(t){return !t.done&&t.priority==='urgent';});
  var habitsToday=(D.habits||[]).filter(function(h){return(h.checkins||[]).indexOf(today)>=0;}).length;
  var totalHabits=(D.habits||[]).length;
  var tbDone=D.timeblocks&&D.timeblocks[today]&&D.timeblocks[today].length>0;
  var rqDone=D.weeklyReview&&D.weeklyReview.updatedAt===today;
  var frog=urgentTodos[0]||D.todos.find(function(t){return !t.done;});
  var rq=D.quotes.length?D.quotes[Math.floor(Math.random()*D.quotes.length)]:null;

  var h='<div class="fade">';

  /* System status bar */
  var sysItems=[
    {label:'ONE Thing',done:!!otDone,icon:'&#9889;',tab:'onething'},
    {label:'Kurbaga',done:urgentTodos.length===0&&D.todos.some(function(t){return t.done;}),icon:'&#128056;',tab:'frog'},
    {label:'Alışkanlık',done:habitsToday>=totalHabits&&totalHabits>0,icon:'&#128260;',tab:'habits'},
    {label:'Zaman Blok',done:!!tbDone,icon:'&#128197;',tab:'timeblock'},
    {label:'Review',done:!!rqDone,icon:'&#9989;',tab:'weeklyreview'},
  ];
  h+='<div class="card" style="margin-bottom:16px;padding:14px 18px">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><p style="font-weight:700;font-size:13px">Sistem Durumu</p><span style="font-size:11px;color:var(--t2)">'+today+'</span></div>';
  h+='<div class="g5">';
  for(var si=0;si<sysItems.length;si++){
    var s=sysItems[si];
    var bg=s.done?'var(--gl)':'var(--s2)';
    var tc=s.done?'var(--green)':'var(--t2)';
    h+='<div data-tab="'+s.tab+'" onclick="gotoTab(this.dataset.tab)" style="display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 6px;border-radius:10px;background:'+bg+';cursor:pointer">';
    h+='<span style="font-size:20px">'+s.icon+'</span>';
    h+='<span style="font-size:10px;font-weight:600;color:'+tc+'">'+s.label+'</span>';
    h+='<span style="font-size:9px;color:'+tc+'">'+(s.done?'&#10003; Tamam':'Bekliyor')+'</span></div>';
  }
  h+='</div></div>';

  /* Stats */
  h+='<div class="g4" style="margin-bottom:16px">';
  h+=statCard('Seviye',lvl,'zap','var(--blue)');
  h+=statCard('XP',xpv,'star','var(--purple)');
  h+=statCard('Odak Saati',(D.stats.totalFocus||0)+'dk','brain','var(--green)');
  h+=statCard('Deep Work',D.deepWorkSessions||0,'hp','var(--orange)');
  h+='</div>';

  /* XP bar */
  h+='<div class="card cp" style="padding-top:12px;padding-bottom:12px;margin-bottom:16px">';
  h+='<div style="display:flex;justify-content:space-between;margin-bottom:7px"><span style="font-weight:600;font-size:13px">Seviye '+lvl+'</span><span style="font-size:12px;color:var(--t2)">'+xpInLvl+' / 500 XP</span></div>';
  h+=progBar(xpInLvl/5);h+='</div>';

  /* ONE Thing prompt */
  if(!otDone){
    h+='<div style="margin-bottom:16px;padding:14px 18px;border-radius:12px;background:var(--bl);border-left:4px solid var(--blue);display:flex;align-items:center;justify-content:space-between;gap:12px">';
    h+='<div><p style="font-weight:700;font-size:14px;margin-bottom:3px">&#9889; ONE Thing secilmedi!</p>';
    h+='<p style="font-size:12px;color:var(--t2)">&ldquo;Bugün yaparsam her seyi kolaylastiracak TEK sey ne?&rdquo;</p></div>';
    h+='<button class="btn btn-p" data-tab="onething" onclick="gotoTab(this.dataset.tab)">Şimdi Seç</button></div>';
  }

  /* Timer + Frog + KPI */
  h+='<div class="g3" style="margin-bottom:16px">';
  h+='<div class="card" id="timer-block"></div>';
  h+='<div class="card cp" style="background:linear-gradient(135deg,#1a3a2e,#0d2d1e);display:flex;flex-direction:column;gap:10px">';
  h+='<span style="font-size:22px">&#128056;</span>';
  h+='<p style="font-weight:700;font-size:15px;color:#a7f3d0">Kurbağayı Ye!</p>';
  h+='<p style="font-size:12.5px;color:#6ee7b7;line-height:1.6;flex:1">'+(frog?U.esc(frog.text):'Tüm görevler tamam!')+'</p>';
  h+='<button class="btn" style="background:rgba(255,255,255,.15);color:#fff;align-self:flex-start;font-size:12px" data-tab="todos" onclick="gotoTab(this.dataset.tab)">Göreve Git &#8594;</button></div>';
  if(D.kpis&&D.kpis.length){
    h+='<div class="card cp"><p class="lbl" style="margin-bottom:8px">KPI Özet</p>';
    D.kpis.slice(0,3).forEach(function(k){
      var kp=pct(k.current,k.target);
      var kc=kp>=80?'var(--green)':kp>=50?'var(--orange)':'var(--red)';
      h+='<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="font-weight:500">'+U.esc(k.name.slice(0,20))+'</span><span style="font-weight:700;color:'+kc+'">'+kp+'%</span></div>'+progBar(kp)+'</div>';
    });
    h+='</div>';
  }else{
    h+='<div class="card cp" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center">'+ic('kpi',28,'var(--t3)')+'<p style="font-size:12px;color:var(--t2)">KPI ekle</p><button class="btn btn-s btn-sm" data-tab="kpi" onclick="gotoTab(this.dataset.tab)">KPI Paneli</button></div>';
  }
  h+='</div>';

  /* Scratch + Quote */
  h+='<div class="g2">';
  h+='<div class="scratch"><p class="lbl" style="color:#7a6000;margin-bottom:7px">&#9999; Karalama</p>';
  h+='<textarea class="inp" id="scratch-area" rows="4" placeholder="Aklına geleni yaz..." style="background:transparent;border:none;padding:0;font-size:13px;box-shadow:none">'+U.esc(D.scratch||'')+'</textarea></div>';
  if(rq){
    h+='<div class="card cp" style="text-align:center;display:flex;flex-direction:column;justify-content:center">';
    h+='<p style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">&#10024; Günün Sözu</p>';
    h+='<p style="font-size:14px;font-style:italic;line-height:1.75">&ldquo;'+U.esc(rq.text)+'&rdquo;</p>';
    if(rq.author)h+='<p style="margin-top:8px;font-size:11px;font-weight:700;color:var(--blue)">&mdash; '+U.esc(rq.author)+'</p>';
    if(rq.cat)h+='<span class="pill p-blue" style="font-size:9px;margin-top:8px;align-self:center">'+U.esc(rq.cat)+'</span>';
    h+='</div>';
  }
  h+='</div></div>';
  sh('pinner',h);
  renderTm();
  var sa=ge('scratch-area');
  if(sa)sa.addEventListener('input',function(){D.scratch=sa.value;save();});
}


function renderKPI(){
  var kpis=D.kpis||[];
  var reached=kpis.filter(function(k){return pct(k.current,k.target)>=100;}).length;
  var critical=kpis.filter(function(k){return pct(k.current,k.target)<50;}).length;
  var avg=kpis.length?Math.round(kpis.reduce(function(a,k){return a+pct(k.current,k.target);},0)/kpis.length):0;
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">KPI & Metrikler</h1><p class="sh-sub">&ldquo;Ölçemedin seyi gelistiremezsin.&rdquo; &mdash; Peter Drucker</p></div><button class="btn btn-p" data-type="kpi" onclick="openForm(this.dataset.type)">'+ic('plus',13)+' KPI Ekle</button></div>';
  h+=quoteWidget('Yönetim','var(--blue)');
  h+='<div class="g4" style="margin-bottom:16px">';
  h+=statCard('Toplam',kpis.length,'kpi','var(--blue)');
  h+=statCard('Hedefe Ulasan',reached,'chk','var(--green)');
  h+=statCard('Kritik',critical,'flame','var(--red)');
  h+=statCard('Ort. Başarı',avg+'%','star','var(--orange)');
  h+='</div>';
  h+='<div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th style="padding-left:16px">Metrik</th><th>Kategori</th><th style="text-align:center">Mevcut</th><th style="text-align:center">Hedef</th><th>İlerleme</th><th style="width:80px"></th></tr></thead><tbody>';
  kpis.forEach(function(k){
    var p2=pct(k.current,k.target);
    var c=p2>=100?'var(--green)':p2>=60?'var(--orange)':'var(--red)';
    h+='<tr><td style="padding-left:16px"><p style="font-weight:600">'+U.esc(k.name)+'</p>'+(k.unit?'<p style="font-size:11px;color:var(--t3)">'+U.esc(k.unit)+'</p>':'')+'</td>';
    h+='<td><span class="pill p-blue" style="font-size:10px">'+U.esc(k.cat||'')+'</span></td>';
    h+='<td style="text-align:center;font-weight:700;font-size:15px;color:'+c+'">'+k.current+'</td>';
    h+='<td style="text-align:center;font-size:12px;color:var(--t2)">'+k.target+'</td>';
    h+='<td style="min-width:120px"><div style="display:flex;align-items:center;gap:7px">'+progBar(p2)+'<span style="font-size:11px;font-weight:700;color:'+c+';min-width:28px">'+p2+'%</span></div></td>';
    h+='<td><div style="display:flex;gap:4px"><button class="btn btn-g btn-ic" style="width:26px;height:26px" data-kid="'+k.id+'" onclick="updateKPI(+this.dataset.kid)">'+ic('edit',12,'var(--t3)')+'</button><button class="btn btn-g btn-ic" style="width:26px;height:26px" data-kid="'+k.id+'" data-dtype="kpi" onclick="del(+this.dataset.kid,this.dataset.dtype)">'+ic('trash',12,'var(--t3)')+'</button></div></td></tr>';
  });
  if(!kpis.length)h+='<tr><td colspan="6"><div class="empty">'+ic('kpi',28,'var(--t3)')+'<p>Henüz KPI eklenmedi</p></div></td></tr>';
  h+='</tbody></table></div></div>';
  sh('pinner',h);
}
function updateKPI(id){
  var k=(D.kpis||[]).find(function(x){return x.id===id;});if(!k)return;
  var v=prompt('Yeni deger ('+k.unit+'):',k.current);if(v===null)return;
  snap();D.kpis=D.kpis.map(function(x){return x.id===id?Object.assign({},x,{current:parseFloat(v)||0,hist:(x.hist||[]).concat([parseFloat(v)||0])}):x;});
  xp(5,'KPI güncellendi');save();renderPage();
}
window.updateKPI=updateKPI;



function setGView(){localStorage.setItem('gview',gView);}
function renderGoals(){
  var all=D.goals||[];
  var goals=fil(all,['title','desc','cat']);
  if(gFilter!=='all'){
    if(gFilter==='active')goals=goals.filter(function(g){return g.status!=='done';});
    else if(gFilter==='done')goals=goals.filter(function(g){return g.status==='done';});
    else goals=goals.filter(function(g){return g.quarter===gFilter;});
  }
  var doneCount=all.filter(function(g){return g.status==='done';}).length;
  var avgP=all.length?Math.round(all.reduce(function(a,g){return a+goalProgress(g);},0)/all.length):0;
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Hedefler</h1><p class="sh-sub">Brian Tracy SMART sistemi</p></div>';
  h+=quoteWidget('Hedef','var(--purple)');
  h+='<div style="display:flex;gap:7px;align-items:center"><div style="display:flex;gap:3px;background:var(--s2);border-radius:8px;padding:3px">';
  [{v:'grid',l:'Grid'},{v:'list',l:'Liste'}].forEach(function(vv){
    var a=gView===vv.v;
    h+='<button class="btn btn-sm" style="padding:4px 10px;background:'+(a?'var(--s)':'transparent')+';color:'+(a?'var(--t)':'var(--t2)')+'" data-v="'+vv.v+'" onclick="gView=this.dataset.v;setGView();renderPage()">'+vv.l+'</button>';
  });
  h+='</div><button class="btn btn-p" onclick="openGoalForm()">'+ic('plus',13)+' Hedef Ekle</button></div></div>';
  h+='<div class="g5" style="margin-bottom:16px">';
  h+=statCard('Toplam',all.length,'tgt','var(--blue)');
  h+=statCard('Aktif',all.length-doneCount,'zap','var(--orange)');
  h+=statCard('Tamamlandı',doneCount,'chk','var(--green)');
  h+=statCard('Kurbaga',all.filter(function(g){return g.frog;}).length,'flame','var(--red)');
  h+=statCard('Ort. İlerleme',avgP+'%','kpi',avgP>=60?'var(--green)':'var(--orange)');
  h+='</div>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">';
  [{f:'all',l:'Tumu'},{f:'active',l:'Aktif'},{f:'done',l:'Bitti'},{f:'Q1',l:'Q1'},{f:'Q2',l:'Q2'},{f:'Q3',l:'Q3'},{f:'Q4',l:'Q4'}].forEach(function(fi){
    h+='<button class="btn btn-sm" style="background:'+(gFilter===fi.f?'var(--blue)':'var(--s2)')+';color:'+(gFilter===fi.f?'#fff':'var(--t2)')+'" data-f="'+fi.f+'" onclick="gFilter=this.dataset.f;renderPage()">'+fi.l+'</button>';
  });
  h+='</div>';
  if(!goals.length){h+='<div class="card" style="padding:48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px"><div style="width:52px;height:52px;border-radius:14px;background:var(--bl);display:flex;align-items:center;justify-content:center">'+ic('tgt',26,'var(--blue)')+'</div><p style="font-weight:700;font-size:16px">Henüz hedef yok</p><button class="btn btn-p" onclick="openGoalForm()">'+ic('plus',13)+' Ilk Hedefi Ekle</button></div></div>';sh('pinner',h);return;}

  if(gView==='list'){
    h+='<div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th style="padding-left:16px">Hedef</th><th>Kat</th><th>Çeyrek</th><th>Deadline</th><th>İlerleme</th><th style="width:40px"></th></tr></thead><tbody>';
    goals.forEach(function(g){
      var p4=goalProgress(g),pc2=p4>=100?'var(--green)':p4>=60?'var(--blue)':p4>=30?'var(--orange)':'var(--red)';
      var dl=g.deadline?Math.ceil((new Date(g.deadline)-new Date())/864e5):null;
      var dlc=dl===null?'var(--t3)':dl<0?'var(--red)':dl<14?'var(--orange)':'var(--t2)';
      var cc=GOAL_CC[g.cat||'Diğer']||'var(--t3)';
      h+='<tr style="cursor:pointer" data-gid="'+g.id+'" onclick="openGoalDetail(+this.dataset.gid)">';
      h+='<td style="padding-left:16px"><div style="display:flex;align-items:center;gap:7px">'+(g.frog?'<span style="font-size:14px">&#128056;</span>':'')+'<div><p style="font-weight:600;font-size:13px">'+U.esc(g.title)+'</p>'+(g.measurable?'<p style="font-size:10.5px;color:var(--t2)">'+U.esc(g.measurable)+'</p>':'')+'</div></div></td>';
      h+='<td><span class="pill" style="background:'+(GOAL_CB[g.cat||'Diğer']||'var(--s2)')+';color:'+cc+';font-size:10px">'+U.esc(g.cat||'Diğer')+'</span></td>';
      h+='<td><span class="pill p-blue" style="font-size:10px">'+g.quarter+'</span></td>';
      h+='<td style="font-size:11.5px;color:'+dlc+'">'+(dl===null?'&mdash;':dl<0?'Gecti':dl+'g')+'</td>';
      h+='<td style="min-width:120px"><div style="display:flex;align-items:center;gap:7px">'+progBar(p4)+'<span style="font-size:11px;font-weight:700;color:'+pc2+';min-width:28px">'+p4+'%</span></div></td>';
      h+='<td><button class="btn btn-g btn-ic" style="width:26px;height:26px" data-gid="'+g.id+'" data-dtype="goal" onclick="event.stopPropagation();del(+this.dataset.gid,this.dataset.dtype)">'+ic('trash',12,'var(--t3)')+'</button></td></tr>';
    });
    h+='</tbody></table></div>';
  }else{
    h+='<div class="ga">';
    goals.forEach(function(g){
      var p5=goalProgress(g),pc3=p5>=100?'var(--green)':p5>=60?'var(--blue)':p5>=30?'var(--orange)':'var(--red)';
      var dl2=g.deadline?Math.ceil((new Date(g.deadline)-new Date())/864e5):null;
      var dlc2=dl2===null?'var(--t3)':dl2<0?'var(--red)':dl2<7?'var(--orange)':'var(--t2)';
      var cc4=GOAL_CC[g.cat||'Diğer']||'var(--t3)';
      var cbg2=GOAL_CB[g.cat||'Diğer']||'var(--s2)';
      h+='<div class="card" style="display:flex;flex-direction:column;overflow:hidden;cursor:pointer" data-gid="'+g.id+'" onclick="openGoalDetail(+this.dataset.gid)">';
      h+='<div style="height:3px;background:'+cc4+'"></div><div style="padding:15px 17px;display:flex;flex-direction:column;gap:10px;flex:1">';
      h+='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px"><div style="flex:1">';
      h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px">'+(g.frog?'<span style="font-size:14px">&#128056;</span>':'')+'<span class="pill" style="background:'+cbg2+';color:'+cc4+';font-size:10px">'+U.esc(g.cat||'Diğer')+'</span><span class="pill p-blue" style="font-size:10px">'+g.quarter+'</span>'+(g.status==='done'?'<span class="pill p-green" style="font-size:9px">&#10003; Bitti</span>':'')+'</div>';
      h+='<p style="font-weight:700;font-size:14px;line-height:1.3">'+U.esc(g.title)+'</p></div>';
      h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px;flex-shrink:0" data-gid="'+g.id+'" data-dtype="goal" onclick="event.stopPropagation();del(+this.dataset.gid,this.dataset.dtype)">'+ic('trash',12,'var(--t3)')+'</button></div>';
      if(g.measurable)h+='<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--s2);border-radius:8px">'+ic('kpi',13,'var(--t2)')+'<span style="font-size:12px;font-weight:600">'+U.esc(g.measurable)+'</span></div>';
      if(g.steps&&g.steps.length){
        var doneS=g.steps.filter(function(s){return s.done;}).length;
        h+=g.steps.slice(0,3).map(function(s){return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><input type="checkbox" class="cb" style="pointer-events:none" '+(s.done?'checked':'')+'><span style="font-size:12px;text-decoration:'+(s.done?'line-through':'none')+';color:'+(s.done?'var(--t3)':'var(--t)')+'">'+U.esc(s.t)+'</span></div>';}).join('');
        if(g.steps.length>3)h+='<p style="font-size:11px;color:var(--t3);padding-left:24px">+ '+(g.steps.length-3)+' daha</p>';
        h+='<div style="display:flex;justify-content:space-between;margin:7px 0 4px;font-size:12px"><span style="color:var(--t2)">'+doneS+'/'+g.steps.length+'</span><span style="font-weight:700;color:'+pc3+'">'+p5+'%</span></div>'+progBar(p5);
      }else{
        var mmG=readMetric(g);
        if(mmG.structured)h+='<div style="display:flex;justify-content:space-between;align-items:baseline;margin:2px 0 4px;font-size:12px"><span style="color:var(--t2)">'+mmG.current+' / '+mmG.target+' '+U.esc(mmG.unit)+'</span><span style="font-weight:700;color:'+pc3+'">'+p5+'%</span></div>'+progBar(p5);
      }
      if(dl2!==null)h+='<div style="display:flex;align-items:center;gap:5px;padding-top:5px;border-top:1px solid rgba(0,0,0,.05)"><span style="font-size:11px;color:'+dlc2+';font-weight:500">'+(dl2<0?'Deadline gecti!':dl2===0?'Bugün son gun!':dl2+' gun kaldi')+'</span></div>';
      h+='</div></div>';
    });
    h+='</div>';
  }
  h+='</div>';
  sh('pinner',h);
}

/* Form hem OLUSTURMA hem DUZENLEME icin. editId verilirse mevcut hedef doldurulur. */
function openGoalForm(editId){
  // FAZ-4.2: dirty not taslagi varsa ONCE onay — confirm alinmadan HICBIR state/modal mutasyonu YOK.
  if(typeof confirmDiscardNoteDraft==='function'&&!confirmDiscardNoteDraft())return;
  var g=editId?((D.goals||[]).find(function(x){return x.id===editId;})||{}):{};
  var m=g.metric||{};
  gfStepsInit(g);
  var v=function(x){return U.esc(x||'');};
  var catOpts=GOAL_CATS.map(function(c){return '<option value="'+c+'"'+((g.cat||'')===c?' selected':'')+'>'+c+'</option>';}).join('');
  var qOpts=['Q1','Q2','Q3','Q4'].map(function(q){return '<option'+((g.quarter||'')===q?' selected':'')+'>'+q+'</option>';}).join('');
  var dirUp=(m.direction||'up')!=='down';
  var h='<div class="mh"><span style="font-weight:700;font-size:15px">'+(editId?'Hedefi Düzenle':'Yeni Hedef')+'</span><button class="btn btn-g btn-ic" onclick="closeModal()">'+ic('x',14)+'</button></div>';
  h+='<div class="mb"><div style="padding:10px 12px;background:var(--bl);border-radius:9px;margin-bottom:2px"><p style="font-size:12px;font-weight:700;color:var(--blue)">SMART Prensipleri</p><p style="font-size:11px;color:var(--t2);margin-top:2px">Spesifik, Ölçülebilir, Ulaşılabilir, Anlamlı, Zamanlı</p></div>';
  h+='<div id="gf_coach" style="margin-bottom:4px"></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">';
  h+='<div style="grid-column:1/-1"><p class="lbl" style="margin-bottom:3px">Hedef *</p><input class="inp" id="gf_title" oninput="goalFormLive()" placeholder="Net ve somut hedef yaz..." value="'+v(g.title)+'"></div>';
  h+='<div><p class="lbl" style="margin-bottom:3px">Kategori</p><select class="inp" id="gf_cat">'+catOpts+'</select></div>';
  h+='<div><p class="lbl" style="margin-bottom:3px">Çeyrek</p><select class="inp" id="gf_q">'+qOpts+'</select></div>';
  h+='<div style="grid-column:1/-1"><p class="lbl" style="margin-bottom:3px">Deadline</p><input type="date" class="inp" id="gf_dl" oninput="goalFormLive()" value="'+v(g.deadline)+'"></div>';
  // Sayisal olcut (metric)
  h+='<div style="grid-column:1/-1;padding:10px 12px;background:var(--s2);border-radius:9px"><p class="lbl" style="margin-bottom:6px">Ölçülebilir Hedef</p><div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px">';
  h+='<input class="inp" id="gf_mt" type="number" step="any" oninput="goalFormLive()" placeholder="Hedef" value="'+(typeof m.target==='number'?m.target:'')+'">';
  h+='<input class="inp" id="gf_mc" type="number" step="any" placeholder="Mevcut" value="'+(typeof m.current==='number'?m.current:'')+'">';
  h+='<input class="inp" id="gf_mu" oninput="goalFormLive()" placeholder="Birim" value="'+v(m.unit)+'">';
  h+='<select class="inp" id="gf_mdir"><option value="up"'+(dirUp?' selected':'')+'>Artan</option><option value="down"'+(!dirUp?' selected':'')+'>Azalan</option></select>';
  h+='</div><p style="font-size:10.5px;color:var(--t3);margin-top:4px">Örn: Hedef 100000, Mevcut 37500, Birim USD → otomatik %37</p></div>';
  h+='<div style="grid-column:1/-1"><p class="lbl" style="margin-bottom:3px">Başarı Kriteri (opsiyonel metin)</p><input class="inp" id="gf_m" oninput="goalFormLive()" placeholder="orn: IELTS 7.5, 100K TL, 10kg" value="'+v(g.measurable)+'"></div>';
  h+='<div style="grid-column:1/-1"><p class="lbl" style="margin-bottom:3px">Neden önemli?</p>'+rtBar('gf_desc')+'<textarea class="inp" id="gf_desc" rows="3" oninput="goalFormLive()" placeholder="Zorlandığında seni ayakta tutacak sebep... (**kalın**, *italik*, - liste)">'+v(g.desc)+'</textarea></div>';
  h+='<div style="grid-column:1/-1"><p class="lbl" style="margin-bottom:3px">Aksiyon Adımları</p><div id="gf_steps"></div></div>';
  h+='<div style="grid-column:1/-1"><label style="display:flex;align-items:center;gap:9px;cursor:pointer;padding:10px 12px;background:var(--rl);border-radius:9px"><input type="checkbox" class="cb" id="gf_frog"'+(g.frog?' checked':'')+'> <span style="font-size:13px;font-weight:500">&#128056; En kritik hedefim (Kurbağa)</span></label></div>';
  h+='</div></div>';
  var action=editId?('submitGoalEdit('+editId+')'):'submitGoalForm()';
  h+='<div class="mf"><button class="btn btn-s" style="flex:1" onclick="closeModal()">İptal</button><button class="btn btn-p" style="flex:2" onclick="'+action+'">'+ic('chk',13)+' Kaydet</button></div>';
  showModal(h);
  gfStepsRender();
  goalFormLive();
}
window.openGoalForm=openGoalForm;
window.openGoalEdit=function(id){openGoalForm(id);};

/* ── FAZ-3: Form step editoru (calisma kopyasi; payload'a save'e kadar dokunmaz) ── */
var gfSteps=[];
function gfStepsInit(g){gfSteps=normalizeGoalSteps(g||{}).map(function(s){return {id:s.id,t:s.t,done:s.done};});}
function gfStepIdx(sid){for(var i=0;i<gfSteps.length;i++)if(String(gfSteps[i].id)===String(sid))return i;return -1;}
function gfStepText(sid,val){var i=gfStepIdx(sid);if(i>=0){gfSteps[i].t=String(val).slice(0,500);goalFormLive();}}
function gfStepDone(sid){var i=gfStepIdx(sid);if(i>=0){gfSteps[i].done=!gfSteps[i].done;goalFormLive();}}
function gfStepDel(sid){var i=gfStepIdx(sid);if(i>=0){gfSteps.splice(i,1);gfStepsRender();goalFormLive();}}
function gfStepMove(sid,dir){var i=gfStepIdx(sid),j=i+dir;if(i>=0&&j>=0&&j<gfSteps.length){var t=gfSteps[i];gfSteps[i]=gfSteps[j];gfSteps[j]=t;gfStepsRender();}}
function gfStepAdd(){gfSteps.push({id:newStepId(),t:'',done:false});gfStepsRender();var el=ge('gf_steps');if(el){var ins=el.querySelectorAll('input.inp');if(ins.length)ins[ins.length-1].focus();}}
window.gfStepText=gfStepText;window.gfStepDone=gfStepDone;window.gfStepDel=gfStepDel;window.gfStepMove=gfStepMove;window.gfStepAdd=gfStepAdd;
function gfStepsRender(){
  var box=ge('gf_steps');if(!box)return;var h='';
  if(!gfSteps.length){h+='<div style="padding:11px;border:2px dashed var(--s3);border-radius:9px;text-align:center;color:var(--t3);font-size:12px">İlk aksiyon adımını ekle</div>';}
  else{gfSteps.forEach(function(s,i){var sid=U.esc(String(s.id));
    h+='<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">';
    h+='<input type="checkbox" class="cb" '+(s.done?'checked':'')+' data-sid="'+sid+'" onchange="gfStepDone(this.dataset.sid)" aria-label="Tamamlandı">';
    h+='<input class="inp" style="flex:1;padding:7px 9px;font-size:12.5px" value="'+U.esc(s.t)+'" data-sid="'+sid+'" oninput="gfStepText(this.dataset.sid,this.value)" placeholder="Aksiyon adımı...">';
    h+='<button type="button" class="btn btn-g btn-ic" style="width:24px;height:24px" data-sid="'+sid+'" onclick="gfStepMove(this.dataset.sid,-1)"'+(i===0?' disabled':'')+' aria-label="Yukarı taşı">&#8593;</button>';
    h+='<button type="button" class="btn btn-g btn-ic" style="width:24px;height:24px" data-sid="'+sid+'" onclick="gfStepMove(this.dataset.sid,1)"'+(i===gfSteps.length-1?' disabled':'')+' aria-label="Aşağı taşı">&#8595;</button>';
    h+='<button type="button" class="btn btn-g btn-ic" style="width:24px;height:24px" data-sid="'+sid+'" onclick="gfStepDel(this.dataset.sid)" aria-label="Sil">'+ic('x',11,'var(--t3)')+'</button>';
    h+='</div>';});}
  h+='<button type="button" class="btn btn-s btn-sm" style="margin-top:3px" onclick="gfStepAdd()">'+ic('plus',11)+' Adım Ekle</button>';
  box.innerHTML=h;
}
window.gfStepsRender=gfStepsRender;

/* ── FAZ-3: Zengin metin toolbar (textarea'ya markdown ekler; contenteditable yok) ── */
function rtInsert(taId,before,after,linePrefix){
  var ta=ge(taId);if(!ta)return;
  var s=ta.selectionStart,e=ta.selectionEnd,val=ta.value;
  if(linePrefix){
    var ls=val.lastIndexOf('\n',s-1)+1;
    ta.value=val.slice(0,ls)+linePrefix+val.slice(ls);
    ta.focus();ta.selectionStart=ta.selectionEnd=s+linePrefix.length;
  }else{
    var sel=val.slice(s,e)||'metin';
    ta.value=val.slice(0,s)+before+sel+after+val.slice(e);
    ta.focus();ta.selectionStart=s+before.length;ta.selectionEnd=s+before.length+sel.length;
  }
  if(taId==='gf_desc')goalFormLive();
  var pv=ge(taId+'_prev');if(pv)pv.innerHTML=renderRichText(ta.value);
}
window.rtInsert=rtInsert;
function rtBar(taId){
  var b=function(vis,aria,bef,aft,lp,st){return '<button type="button" class="btn btn-g btn-sm" style="padding:3px 8px;'+(st||'')+'" aria-label="'+aria+'" title="'+aria+'" onclick="rtInsert(\''+taId+'\',\''+bef+'\',\''+aft+'\','+(lp?'\''+lp+'\'':'null')+')">'+vis+'</button>';};
  return '<div style="display:flex;gap:3px;margin-bottom:4px;flex-wrap:wrap">'+
    b('B','Kalın','**','**',null,'font-weight:800')+b('I','İtalik','*','*',null,'font-style:italic')+
    b('&bull; Liste','Madde listesi','','','- ')+b('1. Liste','Numaralı liste','','','1. ')+b('[ ] Liste','Yapılacak listesi','','','[ ] ')+'</div>';
}

/* Formdan gecici bir hedef nesnesi kur (canli analiz + kaydetme icin ortak). */
function goalFromForm(existing){
  var mt=ge('gf_mt')&&ge('gf_mt').value, mc=ge('gf_mc')&&ge('gf_mc').value;
  var metric=null;
  if(mt!==''&&mt!==undefined&&!isNaN(parseFloat(mt))){
    metric={target:parseFloat(mt),current:mc!==''&&!isNaN(parseFloat(mc))?parseFloat(mc):0,
      start:existing&&existing.metric?Number(existing.metric.start||0):0,
      unit:(ge('gf_mu')&&ge('gf_mu').value)||'',
      direction:(ge('gf_mdir')&&ge('gf_mdir').value)||'up'};
    if(existing&&existing.metric&&existing.metric.checkpoints)metric.checkpoints=existing.metric.checkpoints;
  }
  return {title:(ge('gf_title')&&ge('gf_title').value.trim())||'',
    desc:(ge('gf_desc')&&ge('gf_desc').value)||'',
    cat:(ge('gf_cat')&&ge('gf_cat').value)||'Gelişim',
    quarter:(ge('gf_q')&&ge('gf_q').value)||'Q1',
    deadline:(ge('gf_dl')&&ge('gf_dl').value)||'',
    measurable:(ge('gf_m')&&ge('gf_m').value)||'',
    frog:!!(ge('gf_frog')&&ge('gf_frog').checked),
    metric:metric,
    steps:collectValidSteps(gfSteps).steps};
}
/* Canli Goal Coach + Quality Index formda gosterir. */
function goalFormLive(){
  var box=ge('gf_coach');if(!box)return;
  var draft=goalFromForm();
  if(!draft.title){box.innerHTML='';return;}
  var qi=qualityIndex(draft),tips=goalCoach(draft);
  var bc=qi.score>=70?'var(--green)':qi.score>=50?'var(--orange)':'var(--red)';
  var h='<div style="display:flex;align-items:center;gap:8px;padding:8px 11px;background:var(--s2);border-radius:9px">';
  h+='<div style="width:38px;height:38px;border-radius:9px;background:'+bc+';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:15px;font-weight:800;color:#fff;line-height:1">'+qi.score+'</span><span style="font-size:7px;color:rgba(255,255,255,.85)">/100</span></div>';
  h+='<div style="flex:1"><p style="font-size:11px;font-weight:700;color:'+bc+'">Kalite: '+qi.band+'</p>';
  if(tips.length)h+='<p style="font-size:10.5px;color:var(--t2);line-height:1.45">'+U.esc(tips[0])+'</p>';
  else h+='<p style="font-size:10.5px;color:var(--green)">Güçlü hedef — hazır.</p>';
  h+='</div></div>';
  box.innerHTML=h;
}
window.goalFormLive=goalFormLive;

function submitGoalForm(){
  var d=goalFromForm();
  if(!d.title){alert('Hedef başlığı zorunlu!');return;}
  snap();
  var goal=Object.assign({id:Date.now(),notes:'',status:'active',createdAt:U.today()},d);
  if(!goal.metric)delete goal.metric;
  D.goals=[goal].concat(D.goals||[]);
  xp(25,'Yeni hedef');save();closeModal();renderPage();
}
window.submitGoalForm=submitGoalForm;

/* DUZENLEME — mevcut hedefi gunceller (adim/not/status/id KORUNUR). */
function submitGoalEdit(goalId){
  var cur=(D.goals||[]).find(function(x){return x.id===goalId;});if(!cur)return;
  var d=goalFromForm(cur);
  if(!d.title){alert('Hedef başlığı zorunlu!');return;}
  snap();
  D.goals=D.goals.map(function(g){
    if(g.id!==goalId)return g;
    var upd=Object.assign({},g,{title:d.title,desc:d.desc,cat:d.cat,quarter:d.quarter,
      deadline:d.deadline,measurable:d.measurable,frog:d.frog,steps:d.steps});
    if(d.metric)upd.metric=d.metric;else delete upd.metric;
    return upd;
  });
  save();closeModal();
  if(openGId===goalId)openGoalDetail(goalId);else renderPage();
}
window.submitGoalEdit=submitGoalEdit;

