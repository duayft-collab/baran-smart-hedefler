/* ══════════════════════════════════════════════════════════════════════════
   SMART-GOALS Phase 2 P2 — GOAL IMPORT / EXPORT
   JSON = kayıpsız (envelope + bare-array kabul) · CSV = bilinçli lossy ·
   zorunlu önizleme · satır validasyonu · append/merge/replace · replace öncesi
   DOĞRULANMIŞ before_import yedek · ACK-gated başarı · SG-SYNC-P0 korumaları aynen.
   İKİNCİ save/sync/backup/relations motoru AÇMAZ — mevcutları çağırır.
   Harness-güvenli: üst-seviye DOM/timer YOK. CSV helper'ları Wisdom regresyonundan
   kaçınmak için izole DUPLİKE edildi (paylaşım yok).
   ══════════════════════════════════════════════════════════════════════════ */

var GOAL_IO_VERSION=1;
var GOAL_CSV_FIELDS=['title','description','category','deadline','year','quarter','priority',
  'health_status','confidence','metric_target','metric_current','metric_start','metric_unit','metric_direction','status','notes'];
var GOAL_KNOWN_FIELDS=['id','title','desc','cat','frog','deadline','measurable','metric','steps',
  'notes','notesMeta','status','completedAt','createdAt','planning','health','priority','intel','quarter'];
var GOAL_IMPORT={items:null,stats:null,mode:null};

function _gioToast(msg,err){ var f=(typeof toast==='function')?toast:((typeof wqToast==='function')?wqToast:null); if(f)f(msg,err); }

/* ── ID üreteci: numeric (uygulama +coercion bekler), güvenli tamsayı aralığında,
   bağlam-tuzlu (iki sekme/bağlam çakışmaz) + hedef havuzuna karşı çakışma kontrolü.
   Row-index veya legacy-tarzı deterministik fallback KULLANILMAZ. ── */
var _GIO_SALT=Math.floor(Math.random()*0xfff);
var _gioSeq=Math.floor(Math.random()*0xfff);
function goalNewId(existing){
  var id,guard=0;
  do{ _gioSeq=(_gioSeq+1)&0xfff; id=Date.now()*4096+((_GIO_SALT+_gioSeq)&0xfff); guard++; }
  while(existing&&existing[id]&&guard<200000);
  return id;
}

/* ── CSV (izole duplike; Wisdom 11c ile paylaşım YOK) ── */
function _gcGuard(s){ if(s.length===0)return s; var fr=s.charAt(0); if(fr==='\t'||fr==='\r')return "'"+s;
  var t=s.replace(/^ +/,''),c=t.charAt(0); if(c==='='||c==='+'||c==='-'||c==='@')return "'"+s; return s; }
function _gcEsc(v){ var s=_gcGuard((v==null)?'':String(v)); if(/[",\n\r]/.test(s))return '"'+s.replace(/"/g,'""')+'"'; return s; }
function _gcDeguard(s){ s=String(s==null?'':s); if(s.charAt(0)!=="'")return s; var rest=s.slice(1),fr=rest.charAt(0);
  if(fr==='\t'||fr==='\r')return rest; var t=rest.replace(/^ +/,''),c=t.charAt(0);
  if(c==='='||c==='+'||c==='-'||c==='@')return rest; return s; }
function _gcSerialize(rows){ var out=[GOAL_CSV_FIELDS.join(',')];
  (rows||[]).forEach(function(r){ out.push(GOAL_CSV_FIELDS.map(function(f){return _gcEsc(r[f]);}).join(',')); });
  return out.join('\r\n'); }
function _gcParse(text){ var s=String(text||''); if(s.charCodeAt(0)===0xFEFF)s=s.slice(1);
  var rows=[],row=[],field='',i=0,inQ=false,n=s.length;
  function ef(){row.push(field);field='';} function er(){ef();rows.push(row);row=[];}
  while(i<n){ var c=s[i];
    if(inQ){ if(c==='"'){ if(s[i+1]==='"'){field+='"';i+=2;continue;} inQ=false;i++;continue; } field+=c;i++;continue; }
    if(c==='"'){inQ=true;i++;continue;} if(c===','){ef();i++;continue;}
    if(c==='\r'){ if(s[i+1]==='\n')i++; er();i++;continue; } if(c==='\n'){er();i++;continue;} field+=c;i++; }
  if(field!==''||row.length)er();
  rows=rows.filter(function(r){return !(r.length===1&&r[0]==='');});
  if(!rows.length)return {header:[],rows:[]};
  var header=rows[0].map(function(h){return String(h||'').trim().toLowerCase();});
  return {header:header,rows:rows.slice(1).map(function(r){var o={};header.forEach(function(h,idx){o[h]=r[idx]!=null?r[idx]:'';});return o;})}; }

/* ── EXPORT ── */
function goalBuildJsonText(list){
  return JSON.stringify({format:'smart-goals',version:GOAL_IO_VERSION,exportedAt:_gioNowIso(),records:(list||[])},null,2);
}
function _gioNowIso(){ try{return new Date().toISOString();}catch(e){return String(Date.now());} }
/* Bir goal → düz CSV satırı (dual-read okuyucular; teknik/nested alanlar KASITEN düşer). */
function goalToCsvRow(g){
  var m=(g&&g.metric&&typeof g.metric==='object')?g.metric:{};
  return {title:g.title, description:g.desc, category:g.cat, deadline:g.deadline||'',
    year:(typeof goalYear==='function'?goalYear(g):(g.planning&&g.planning.year)||''),
    quarter:(typeof goalQuarter==='function'?goalQuarter(g):(g.planning&&g.planning.quarter)||g.quarter||''),
    priority:(typeof goalPriority==='function'?goalPriority(g):(g.priority&&g.priority.level)||''),
    health_status:(typeof goalHealthStatus==='function'?goalHealthStatus(g):(g.health&&g.health.status)||''),
    confidence:(typeof goalConfidence==='function'?goalConfidence(g):(g.health&&g.health.confidence)||''),
    metric_target:(m.target!=null?m.target:''), metric_current:(m.current!=null?m.current:''),
    metric_start:(m.start!=null?m.start:''), metric_unit:m.unit||'', metric_direction:m.direction||'',
    status:g.status||'active', notes:g.notes||''};
}
function goalBuildCsvText(list){ return '﻿'+_gcSerialize((list||[]).map(goalToCsvRow)); }
function goalCsvRoundTripNotice(){
  return 'CSV içerik düzenleme ve temel aktarım içindir. ID, geçmiş, adımlar, kilometre taşları, '+
         'teknik metadata ve bazı durum alanlarını eksiksiz korumaz. Kayıpsız yedek ve tam round-trip için JSON kullanın.';
}
function goalExportJSON(){ var l=(D.goals||[]); if(!l.length){_gioToast('Dışa aktarılacak hedef yok',true);return;}
  _gioDownload(goalBuildJsonText(l),'smart-goals-'+_gioStamp()+'.json','application/json');
  _gioToast(l.length+' hedef JSON olarak indirildi (kayıpsız tam yedek)'); }
function goalExportCSV(){ var l=(D.goals||[]); if(!l.length){_gioToast('Dışa aktarılacak hedef yok',true);return;}
  _gioDownload(goalBuildCsvText(l),'smart-goals-'+_gioStamp()+'.csv','text/csv;charset=utf-8');
  _gioToast(l.length+' hedef CSV olarak indirildi — bazı alanlar korunmaz; JSON tam korur.',true); }
function _gioDownload(text,fn,mime){ if(typeof document==='undefined')return;
  var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:mime})); a.download=fn;
  document.body.appendChild(a); a.click(); setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(a.href);},100); }
function _gioStamp(){ var d=new Date(),p=function(x){return ('0'+x).slice(-2);}; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }

/* ── PARSE (read-only) ── */
function goalFromCsvRow(o){
  var g=function(k){return _gcDeguard(o[k]!=null?o[k]:'');};
  var rec={title:g('title'),desc:g('description'),cat:g('category'),deadline:g('deadline'),
    status:g('status')||'active',notes:g('notes')};
  var yr=g('year'),q=g('quarter'); if(yr!==''||q!==''){var yn=parseInt(yr,10);rec.planning={year:(!isNaN(yn)?yn:yr),quarter:q||'Q1'};}
  var pl=g('priority'); if(pl!=='')rec.priority={level:pl,weight:({p1:1,p2:2,p3:3}[pl]||2)};
  var hs=g('health_status'),cf=g('confidence'); if(hs!==''||cf!=='')rec.health={status:hs||'on_track',confidence:cf||'medium'};
  var mt=g('metric_target');
  if(mt!==''){ rec.metric={target:_gioNum(mt),current:_gioNum(g('metric_current')),start:_gioNum(g('metric_start')),
    unit:g('metric_unit'),direction:g('metric_direction')||'up'}; }
  return rec;
}
function _gioNum(v){ var n=parseFloat(_gcDeguard(v)); return isNaN(n)?0:n; }
function goalParseImportFile(text,filename){
  var t=String(text||'').replace(/^﻿/,'').trim();
  if(t==='')return {ok:false,error:'Dosya boş.'};
  var isJson=/\.json$/i.test(filename||'')||t[0]==='['||t[0]==='{';
  if(isJson){
    var j; try{ j=JSON.parse(t); }catch(e){ return {ok:false,error:'Geçersiz JSON: '+(e.message||'')}; }
    if(Array.isArray(j))return {ok:true,records:j,fmt:'json'};
    if(j&&Array.isArray(j.records))return {ok:true,records:j.records,fmt:'json',envelope:{format:j.format,version:j.version}};
    return {ok:false,error:'Tanınmayan JSON yapısı (dizi veya {records:[...]} bekleniyor).'};
  }
  var p; try{ p=_gcParse(text); }catch(e){ return {ok:false,error:'Geçersiz CSV'}; }
  if(!p.header.length||p.header.indexOf('title')<0)return {ok:false,error:'CSV başlığı geçersiz (title sütunu gerekli).'};
  return {ok:true,records:p.rows.map(goalFromCsvRow),fmt:'csv'};
}

/* ── VALIDATION ── */
var GOAL_ERR_TR={
  EMPTY_TITLE:'Başlık boş olamaz.', INVALID_ID:'Geçersiz hedef ID (sayısal olmalı).',
  DUPLICATE_ID:'Bu ID zaten mevcut bir hedefe ait.', DUPLICATE_ID_IN_FILE:'Aynı ID dosyada tekrar ediyor.',
  INVALID_DEADLINE:'Geçersiz tarih (YYYY-AA-GG bekleniyor).', INVALID_PLANNING_YEAR:'Geçersiz planlama yılı.',
  INVALID_QUARTER:'Geçersiz çeyrek (Q1–Q4).', INVALID_HEALTH_STATUS:'Geçersiz durum.',
  INVALID_CONFIDENCE:'Geçersiz güven düzeyi.', INVALID_PRIORITY:'Geçersiz öncelik (P1/P2/P3).',
  INVALID_METRIC_DIRECTION:'Geçersiz metrik yönü (up/down).', INVALID_STATUS:'Geçersiz yaşam döngüsü durumu.',
  INVALID_COMPLETED_AT:'Geçersiz tamamlanma tarihi.', INVALID_STEPS:'Adımlar dizi olmalı.',
  INVALID_CHECKPOINTS:'Kilometre taşları dizi olmalı.', INVALID_CONTROL_CHARACTER:'Metinde kontrol karakteri var.',
  UNICODE_REPLACEMENT_CHARACTER:'Metinde bozuk Unicode (�) var.', INVALID_JSON_RECORD:'Geçersiz kayıt (nesne bekleniyor).',
  DUPLICATE_CONTENT:'Aynı içerikli hedef zaten mevcut.', POSSIBLE_DUPLICATE_TITLE:'Aynı başlık mevcut olabilir.',
  MISSING_DEADLINE:'Tarih yok.', MISSING_METRIC:'Ölçüt (metric) yok.', NO_STEPS_OR_CHECKPOINTS:'Adım/kilometre taşı yok.',
  LEGACY_MEASURABLE_FIELD:'Eski "measurable" alanı.', LEGACY_QUARTER_FIELD:'Eski üst-seviye "quarter" alanı.',
  TITLE_EDGE_WHITESPACE:'Başlıkta baş/son boşluk.', DESCRIPTION_INTERNAL_WHITESPACE:'Açıklamada çift boşluk.',
  UNKNOWN_ADDITIVE_FIELD:'Bilinmeyen ek alan (korunur).', COMPLETED_WITHOUT_COMPLETED_AT:'Tamamlandı ama tarih yok.',
  ACTIVE_WITH_COMPLETED_AT:'Aktif ama tamamlanma tarihi var.', PLANNING_DEADLINE_MISMATCH:'Planlama yılı ile tarih yılı farklı.',
  AMBIGUOUS_MATCH:'Birden çok olası eşleşme; otomatik birleştirilmez.', RELATIONS_AFFECTED:'Bu işlem ilişkileri etkiler.',
  ORPHAN_RELATIONS_POSSIBLE:'Bu işlem ilişkileri sahipsiz bırakabilir.'
};
function _gioErr(rn,field,code){ return {rowNumber:rn,field:field,code:code,message:GOAL_ERR_TR[code]||code}; }
function _gioIsDate(s){ return /^\d{4}-\d{2}-\d{2}/.test(String(s||''))&&!isNaN(new Date(s).getTime()); }
function _gioCtrl(s){ return /[ --]/.test(String(s||'')); }
function _gioRepl(s){ return String(s||'').indexOf('�')>=0; }
function _gioNorm(s){ return String(s==null?'':s).toLocaleLowerCase('tr').replace(/\s+/g,' ').trim(); }
function goalContentSig(g){
  var m=(g&&g.metric&&typeof g.metric==='object')?('m:'+[g.metric.target,g.metric.unit,g.metric.direction].join('~')):'';
  return [_gioNorm(g&&g.title),_gioNorm(g&&g.desc),_gioNorm(g&&g.cat),String((g&&g.deadline)||''),m].join('|');
}
function goalValidateImportRow(raw,rowNumber){
  var errors=[],warnings=[];
  function e(f,c){errors.push(_gioErr(rowNumber,f,c));} function w(f,c){warnings.push(_gioErr(rowNumber,f,c));}
  if(!raw||typeof raw!=='object'||Array.isArray(raw)){ e('record','INVALID_JSON_RECORD'); return {errors:errors,warnings:warnings,goal:null}; }
  var title=String(raw.title==null?'':raw.title);
  if(!title.trim())e('title','EMPTY_TITLE');
  if(title!==title.trim()&&title.trim())w('title','TITLE_EDGE_WHITESPACE');
  if(_gioCtrl(title)||_gioCtrl(raw.desc)||_gioCtrl(raw.notes))e('title','INVALID_CONTROL_CHARACTER');
  if(_gioRepl(title)||_gioRepl(raw.desc)||_gioRepl(raw.notes))e('title','UNICODE_REPLACEMENT_CHARACTER');
  // id (numeric zorunlu)
  var idNum=null;
  if(raw.id!=null&&raw.id!==''){ if(typeof raw.id==='number'&&isFinite(raw.id))idNum=raw.id;
    else if(typeof raw.id==='string'&&/^\d+$/.test(raw.id))idNum=parseInt(raw.id,10); else e('id','INVALID_ID'); }
  // deadline
  if(raw.deadline!=null&&raw.deadline!==''){ if(!_gioIsDate(raw.deadline))e('deadline','INVALID_DEADLINE'); } else w('deadline','MISSING_DEADLINE');
  // planning
  if(raw.planning!=null){ var vp=(typeof validatePlanning==='function')?validatePlanning(raw.planning.year,raw.planning.quarter):{ok:true};
    if(!vp.ok){ var ys=String(raw.planning&&raw.planning.year); if(!/^\d{4}$/.test(ys))e('planning','INVALID_PLANNING_YEAR'); else e('planning','INVALID_QUARTER'); } }
  // health
  if(raw.health!=null){ var vh=(typeof validateGoalHealth==='function')?validateGoalHealth(raw.health):{ok:true};
    if(!vh.ok){ if(typeof GOAL_HEALTH_STATUSES!=='undefined'&&GOAL_HEALTH_STATUSES.indexOf(raw.health.status)<0)e('health','INVALID_HEALTH_STATUS'); else e('health','INVALID_CONFIDENCE'); } }
  // priority
  if(raw.priority!=null){ var vpr=(typeof validateGoalPriority==='function')?validateGoalPriority(raw.priority):{ok:true}; if(!vpr.ok)e('priority','INVALID_PRIORITY'); }
  // metric
  if(raw.metric!=null){ if(typeof raw.metric!=='object'||Array.isArray(raw.metric))e('metric','INVALID_CHECKPOINTS');
    else{ if(raw.metric.direction!=null&&raw.metric.direction!==''&&['up','down'].indexOf(raw.metric.direction)<0)e('metric','INVALID_METRIC_DIRECTION');
      if(raw.metric.checkpoints!=null&&!Array.isArray(raw.metric.checkpoints))e('metric','INVALID_CHECKPOINTS'); } }
  else w('metric','MISSING_METRIC');
  // status / completedAt
  if(raw.status!=null&&['active','done'].indexOf(raw.status)<0)e('status','INVALID_STATUS');
  if(raw.completedAt!=null&&raw.completedAt!==''){ if(!_gioIsDate(raw.completedAt))e('completedAt','INVALID_COMPLETED_AT'); }
  if(raw.status==='done'&&(raw.completedAt==null||raw.completedAt===''))w('completedAt','COMPLETED_WITHOUT_COMPLETED_AT');
  if(raw.status==='active'&&raw.completedAt)w('completedAt','ACTIVE_WITH_COMPLETED_AT');
  // steps
  if(raw.steps!=null&&!Array.isArray(raw.steps))e('steps','INVALID_STEPS');
  var hasSteps=Array.isArray(raw.steps)&&raw.steps.length;
  var hasCps=raw.metric&&Array.isArray(raw.metric.checkpoints)&&raw.metric.checkpoints.length;
  if(!hasSteps&&!hasCps)w('steps','NO_STEPS_OR_CHECKPOINTS');
  // legacy + unknown + whitespace
  if(raw.measurable!=null&&raw.measurable!=='')w('measurable','LEGACY_MEASURABLE_FIELD');
  if(raw.quarter!=null&&raw.quarter!=='')w('quarter','LEGACY_QUARTER_FIELD');
  if(/\S {2,}\S/.test(String(raw.desc||'')))w('desc','DESCRIPTION_INTERNAL_WHITESPACE');
  Object.keys(raw).forEach(function(k){ if(GOAL_KNOWN_FIELDS.indexOf(k)<0)w(k,'UNKNOWN_ADDITIVE_FIELD'); });
  // planning vs deadline year
  if(raw.planning&&raw.planning.year&&raw.deadline&&_gioIsDate(raw.deadline)){
    var dy=new Date(raw.deadline).getFullYear(); if(String(dy)!==String(raw.planning.year))w('planning','PLANNING_DEADLINE_MISMATCH'); }
  // normalized goal (unknown/legacy alanlar KORUNUR; içerik yeniden yazılmaz; id numeric'e çevrilir)
  var goal=null;
  if(!errors.length){ goal={}; Object.keys(raw).forEach(function(k){goal[k]=raw[k];}); if(idNum!=null)goal.id=idNum; }
  return {errors:errors,warnings:warnings,goal:goal,idNum:idNum};
}

/* ── ANALYZE ── */
function goalAnalyzeImport(rawList,fmt,mode){
  mode=mode||'append';
  var base=(fmt==='csv')?2:1;
  var existing=D.goals||[];
  var existIds={}; existing.forEach(function(g){existIds[g.id]=g;});
  var sigMap={}; existing.forEach(function(g){var s=goalContentSig(g);(sigMap[s]=sigMap[s]||[]).push(g);});
  var titleMap={}; existing.forEach(function(g){(titleMap[_gioNorm(g.title)]=titleMap[_gioNorm(g.title)]||[]).push(g);});
  var seenFileIds={};
  var items=[],newCount=0,updateCount=0,dupExisting=0,dupInFile=0,invalid=0,warnCount=0;
  (Array.isArray(rawList)?rawList:[]).forEach(function(raw,i){
    var rn=i+base;
    var v=goalValidateImportRow(raw,rn);
    var item={rowNumber:rn,goal:v.goal,errors:v.errors.slice(),warnings:v.warnings.slice(),matchKind:null,classification:'new',existing:null};
    if(v.idNum!=null){
      if(seenFileIds[v.idNum]){ item.errors.push(_gioErr(rn,'id','DUPLICATE_ID_IN_FILE')); }
      seenFileIds[v.idNum]=1;
      if(existIds[v.idNum]){
        if(mode==='merge'){ item.matchKind='id'; item.classification='update'; item.existing=existIds[v.idNum]; }
        else { item.errors.push(_gioErr(rn,'id','DUPLICATE_ID')); }
      }
    } else if(v.goal){
      var sig=goalContentSig(v.goal), sm=sigMap[sig]||[], tm=titleMap[_gioNorm(v.goal.title)]||[];
      if(mode==='merge'){
        if(sm.length===1){ item.matchKind='content'; item.classification='update'; item.existing=sm[0]; }
        else if(sm.length>1){ item.warnings.push(_gioErr(rn,'record','AMBIGUOUS_MATCH')); }
        else if(tm.length){ item.warnings.push(_gioErr(rn,'title','POSSIBLE_DUPLICATE_TITLE')); }
      } else {
        if(sm.length){ item.warnings.push(_gioErr(rn,'record','DUPLICATE_CONTENT')); dupExisting++; }
        else if(tm.length){ item.warnings.push(_gioErr(rn,'title','POSSIBLE_DUPLICATE_TITLE')); }
      }
    }
    if(item.errors.length){ item.classification='invalid'; invalid++; }
    else if(item.classification==='update')updateCount++;
    else newCount++;
    warnCount+=item.warnings.length;
    items.push(item);
  });
  // relations impact (replace: mevcut hedefler kaldırılacağından goal-ilişkileri sahipsiz kalır)
  var relImpact=goalRelationsImpact(mode);
  return {total:(Array.isArray(rawList)?rawList.length:0),parsed:items.length,valid:items.length-invalid,
    newCount:newCount,updateCount:updateCount,dupExisting:dupExisting,dupInFile:Object.keys(seenFileIds).length&&0,
    invalid:invalid,warnCount:warnCount,items:items,mode:mode,fmt:fmt,
    relationsAffected:relImpact.affected,orphanPossible:relImpact.orphan};
}
/* Relations etkisi. append/merge → hedef silinmez → 0. replace → tüm mevcut goal-ilişkileri sahipsiz. */
function goalRelationsImpact(mode){
  var rels=(typeof D!=='undefined'&&Array.isArray(D.relations))?D.relations:[];
  if(mode!=='replace')return {affected:0,orphan:0};
  var affected=rels.filter(function(r){return r.sourceType==='goal'||r.targetType==='goal';}).length;
  return {affected:affected,orphan:affected};
}

/* ── SYNC OUTCOME / ACK (SG-SYNC-P0 deseni; motor DEĞİŞMEZ) ── */
function _goalImportSyncOutcome(revBefore){
  if(typeof CLOUD==='undefined')return 'synced';
  if(CLOUD.conflict)return 'conflict';
  if(CLOUD.pendingMutation)return 'pending';
  return 'synced';
}
function _goalImportAwaitAck(revBefore,successMsg){
  _gioToast('Buluta senkronize ediliyor…');
  if(typeof CLOUD==='undefined'){ _gioToast(successMsg); return; }
  var tries=0,max=34;
  var iv=setInterval(function(){ tries++;
    var out=_goalImportSyncOutcome(revBefore);
    if(out==='conflict'){ clearInterval(iv); _gioToast('İçe aktarma yerel olarak uygulandı ancak senkronizasyon çakışması oluştu.',true); return; }
    if(out==='synced'&&Number(CLOUD.revision||0)>revBefore){ clearInterval(iv); _gioToast(successMsg); return; }
    if(tries>=max){ clearInterval(iv); _gioToast('Hedefler yerel olarak kaydedildi; bulut senkronizasyonu bekleniyor (bağlantıyı kontrol edin).',true); }
  },300);
}

/* ── APPLY ── */
function _goalCommitImport(mode,st){
  if(typeof snap==='function')snap();
  var valid=st.items.filter(function(it){return !it.errors.length;});
  var existIds={}; (D.goals||[]).forEach(function(g){existIds[g.id]=1;});
  var revBefore=(typeof CLOUD!=='undefined')?Number(CLOUD.revision||0):0;
  if(mode==='replace'){
    var repl=[]; var pool={};
    valid.forEach(function(it){ var g=it.goal; if(g.id==null||pool[g.id]){g=_gioAssignId(g,pool);} pool[g.id]=1; repl.push(g); });
    D.goals=repl;
  } else if(mode==='merge'){
    valid.forEach(function(it){
      if(it.classification==='update'&&it.existing){
        var idx=-1; for(var k=0;k<D.goals.length;k++){if(D.goals[k].id===it.existing.id){idx=k;break;}}
        if(idx>=0){ var merged=Object.assign({},D.goals[idx]); var src=it.goal;
          Object.keys(src).forEach(function(key){ if(src[key]!==undefined)merged[key]=src[key]; }); merged.id=it.existing.id; D.goals[idx]=merged; }
      } else { var ng=it.goal; if(ng.id==null||existIds[ng.id])ng=_gioAssignId(ng,existIds); existIds[ng.id]=1; _gioFinalize(ng); D.goals.push(ng); }
    });
  } else { // append
    valid.forEach(function(it){ if(it.classification==='invalid')return; var ng=it.goal;
      if(ng.id==null){ ng=_gioAssignId(ng,existIds); } existIds[ng.id]=1; _gioFinalize(ng); D.goals.push(ng); });
  }
  var added=valid.length;
  GOAL_IMPORT.items=null; GOAL_IMPORT.stats=null;
  if(typeof closeModal==='function')closeModal();
  if(typeof save==='function')save();
  _goalImportAwaitAck(revBefore,added+' hedef içe aktarıldı ve buluta kaydedildi.');
  if(typeof render==='function')render();
  return {ok:true,added:added};
}
function _gioAssignId(g,used){ var c={}; Object.keys(g).forEach(function(k){c[k]=g[k];}); c.id=goalNewId(used); return c; }
/* Eksik zorunlu iskelet alanları (uygulamanın beklediği) — additive default, içerik uydurma YOK. */
function _gioFinalize(g){ if(g.status==null)g.status='active'; if(g.createdAt==null)g.createdAt=(typeof U!=='undefined'&&U.today)?U.today():_gioStamp();
  if(!Array.isArray(g.steps))g.steps=[]; if(g.notes==null)g.notes=''; if(g.frog==null)g.frog=false; return g; }

async function _goalReplaceWithBackup(st,opts){
  opts=opts||{};
  var impact=goalRelationsImpact('replace');
  if(impact.orphan>0&&!opts.confirmOrphans){ _gioToast(impact.orphan+' ilişki sahipsiz kalacağı için içe aktarma durduruldu (onay gerekli).',true);
    return {aborted:true,reason:'would_orphan_relations',orphan:impact.orphan}; }
  var bk;
  try{ bk=await createBackup('before_import',{force:true,label:'SMART Goals replace import safety backup'}); }
  catch(e){ _gioToast('Yedek alınamadı — içe aktarma iptal edildi (veri değişmedi).',true); return {aborted:true,reason:'backup_error'}; }
  if(!_goalBackupVerified(bk)){ _gioToast('Yedek doğrulanamadı — içe aktarma iptal edildi (veri değişmedi).',true); return {aborted:true,reason:'backup_unverified'}; }
  var r=_goalCommitImport('replace',st); r.backupId=bk.id; return r;
}
function _goalBackupVerified(bk){ return !!(bk&&bk.id&&!bk.skipped&&!bk.error); }

function goalImportApply(mode,opts){
  var st=GOAL_IMPORT.stats; if(!st||!st.items){ _gioToast('Önce dosya seçin.',true); return {ok:false}; }
  if(mode==='replace')return _goalReplaceWithBackup(st,opts);
  return _goalCommitImport(mode,st);
}

/* ── ERROR REPORT (read-only) ── */
var GOAL_ERR_REPORT_FIELDS=['row','title','decision','errors','warnings','existing_id','existing_title','relation_impact'];
function goalImportBuildErrorReport(st){
  var rows=(st&&st.items||[]).map(function(it){
    return {row:it.rowNumber,title:(it.goal&&it.goal.title)||'',decision:it.classification,
      errors:it.errors.map(function(e){return e.code;}).join('; '),
      warnings:it.warnings.map(function(w){return w.code;}).join('; '),
      existing_id:(it.existing&&it.existing.id)||'',existing_title:(it.existing&&it.existing.title)||'',
      relation_impact:''};
  });
  var out=[GOAL_ERR_REPORT_FIELDS.join(',')];
  rows.forEach(function(r){ out.push(GOAL_ERR_REPORT_FIELDS.map(function(f){return _gcEsc(r[f]);}).join(',')); });
  return '﻿'+out.join('\r\n');
}
function goalImportDownloadErrorReport(){ var st=GOAL_IMPORT.stats; if(!st)return;
  _gioDownload(goalImportBuildErrorReport(st),'smart-goals-import-report-'+_gioStamp()+'.csv','text/csv;charset=utf-8'); }

/* ── PREVIEW (modal) ── */
function goalImportShowPreview(st,fmt,mode){
  GOAL_IMPORT.stats=st; GOAL_IMPORT.mode=mode;
  if(typeof showModal!=='function')return;
  showModal(goalImportPreviewHtml(st,fmt,mode));
}
function goalImportPreviewHtml(st,fmt,mode){
  var esc=(typeof U!=='undefined'&&U.esc)?U.esc:function(x){return String(x==null?'':x);};
  var cards=[['Toplam',st.total],['Geçerli',st.valid],['Yeni',st.newCount],['Güncelleme',st.updateCount],
    ['Tekrar',st.dupExisting],['Uyarı',st.warnCount],['Engelleyici Hata',st.invalid],['Atlanan',st.invalid],
    ['Etkilenen İlişki',st.relationsAffected],['Olası Orphan',st.orphanPossible]];
  var h='<div class="mh"><span style="font-weight:700;font-size:15px">Hedef İçe Aktarma Önizleme</span><button class="btn btn-g btn-ic" onclick="goalImportCancel()">'+((typeof ic==='function')?ic('x',14):'x')+'</button></div><div class="mb">';
  h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
  cards.forEach(function(c){ h+='<div style="background:var(--s2);border-radius:8px;padding:6px 10px;font-size:11px"><b>'+c[1]+'</b> '+esc(c[0])+'</div>'; });
  h+='</div>';
  h+='<p style="font-size:11px;color:var(--t2);margin-bottom:8px">'+esc(goalCsvRoundTripNotice())+'</p>';
  h+='<div style="max-height:34vh;overflow-y:auto">';
  (st.items||[]).slice(0,200).forEach(function(it){
    var col=it.errors.length?'var(--red)':(it.classification==='update'?'var(--blue)':(it.warnings.length?'var(--orange)':'var(--t2)'));
    h+='<div style="border-bottom:1px solid var(--s2);padding:6px 0;font-size:12px"><span style="color:'+col+'">#'+it.rowNumber+' · '+esc((it.goal&&it.goal.title)||'—')+' · '+esc(it.classification)+'</span>';
    if(it.errors.length)h+='<div style="font-size:10px;color:var(--red)">'+esc(it.errors.map(function(e){return e.message;}).join(' | '))+'</div>';
    if(it.warnings.length)h+='<div style="font-size:10px;color:var(--orange)">'+esc(it.warnings.map(function(w){return w.message;}).join(' | '))+'</div>';
    h+='</div>';
  });
  h+='</div></div><div class="mf" style="flex-wrap:wrap;gap:6px">';
  h+='<button class="btn btn-s" onclick="goalImportCancel()">İptal</button>';
  h+='<button class="btn btn-s" onclick="goalImportDownloadErrorReport()">Hata Raporunu İndir</button>';
  h+='<button class="btn btn-p" onclick="goalImportApply(\'append\')">Append Uygula</button>';
  h+='<button class="btn btn-p" onclick="goalImportApply(\'merge\')">Merge Uygula</button>';
  h+='<button class="btn" style="background:var(--red);color:#fff" onclick="goalImportConfirmReplace()">Replace Uygula (yıkıcı)</button>';
  h+='</div>';
  return h;
}
function goalImportConfirmReplace(){
  var st=GOAL_IMPORT.stats; if(!st)return;
  var warn='TÜM mevcut hedefler silinip içe aktarılanlarla değiştirilecek.';
  if(st.orphanPossible>0)warn+='\n'+st.orphanPossible+' ilişki sahipsiz kalabilir.';
  warn+='\nÖnce güvenlik yedeği alınacak. Devam edilsin mi?';
  if(typeof confirm==='function'&&!confirm(warn))return;
  return goalImportApply('replace',{confirmOrphans:st.orphanPossible>0});
}
function goalImportCancel(){ GOAL_IMPORT.items=null; GOAL_IMPORT.stats=null; if(typeof closeModal==='function')closeModal(); }

/* Exports */
window.goalBuildJsonText=goalBuildJsonText; window.goalBuildCsvText=goalBuildCsvText; window.goalCsvRoundTripNotice=goalCsvRoundTripNotice;
window.goalToCsvRow=goalToCsvRow; window.goalFromCsvRow=goalFromCsvRow; window.goalParseImportFile=goalParseImportFile;
window.goalValidateImportRow=goalValidateImportRow; window.goalAnalyzeImport=goalAnalyzeImport; window.goalContentSig=goalContentSig;
window.goalRelationsImpact=goalRelationsImpact; window.goalNewId=goalNewId;
window.goalImportApply=goalImportApply; window.goalImportShowPreview=goalImportShowPreview; window.goalImportPreviewHtml=goalImportPreviewHtml;
window.goalImportConfirmReplace=goalImportConfirmReplace; window.goalImportCancel=goalImportCancel;
window.goalImportDownloadErrorReport=goalImportDownloadErrorReport; window.goalImportBuildErrorReport=goalImportBuildErrorReport;
window._goalImportSyncOutcome=_goalImportSyncOutcome; window._goalImportAwaitAck=_goalImportAwaitAck;
window.goalExportJSON=goalExportJSON; window.goalExportCSV=goalExportCSV; window.GOAL_IMPORT=GOAL_IMPORT; window.GOAL_CSV_FIELDS=GOAL_CSV_FIELDS;
