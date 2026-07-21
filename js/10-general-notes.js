function normalizeGeneralNote(n,i){
  if(n==null)return null;
  if(typeof n==='string')n={title:n};
  if(typeof n!=='object')return null;
  var title=String(n.title==null?'':n.title).slice(0,120);
  var content=String(n.content==null?'':n.content).replace(/\r\n?/g,'\n').slice(0,20000);
  if(!title.trim()&&!content.trim())return null;                       // tamamen bos -> at
  return {id:(n.id!=null&&n.id!=='')?String(n.id):('gn-legacy-'+(i||0)),
    title:title,content:content,pinned:!!n.pinned,archived:!!n.archived,
    createdAt:Number(n.createdAt)||0,updatedAt:Number(n.updatedAt)||Number(n.createdAt)||0};
}
function normalizeGeneralNotes(list){return (Array.isArray(list)?list:[]).map(normalizeGeneralNote).filter(Boolean);}
function sortGeneralNotes(list){return list.slice().sort(function(a,b){
  if(!!b.pinned!==!!a.pinned)return (b.pinned?1:0)-(a.pinned?1:0);      // sabitler once
  if((b.updatedAt||0)!==(a.updatedAt||0))return (b.updatedAt||0)-(a.updatedAt||0); // guncellenme desc
  if((b.createdAt||0)!==(a.createdAt||0))return (b.createdAt||0)-(a.createdAt||0); // olusturma desc
  return String(a.id).localeCompare(String(b.id));});}                  // esitse id
function filterGeneralNotes(list,query,view){
  var out=normalizeGeneralNotes(list);
  if(view==='archive')out=out.filter(function(n){return n.archived;});
  else if(view==='pinned')out=out.filter(function(n){return n.pinned&&!n.archived;});
  else out=out.filter(function(n){return !n.archived;});               // 'all': arsivliler gizli
  var q=String(query||'').trim();
  if(q){var lq=q.toLocaleLowerCase('tr');out=out.filter(function(n){
    return (n.title||'').toLocaleLowerCase('tr').indexOf(lq)>=0||
      richTextToPlainText(n.content||'').toLocaleLowerCase('tr').indexOf(lq)>=0;});}
  return sortGeneralNotes(out);
}
window.normalizeGeneralNotes=normalizeGeneralNotes;window.filterGeneralNotes=filterGeneralNotes;window.sortGeneralNotes=sortGeneralNotes;window.newGeneralNoteId=newGeneralNoteId;

/* Dirty taslak korumasi — yalniz bellekte; autosave/localStorage YOK. */
var GENERAL_NOTE_DRAFT={open:false,noteId:null,title:'',content:'',originalTitle:'',originalContent:'',dirty:false};
function gnCaptureDraft(){
  if(!GENERAL_NOTE_DRAFT.open)return;
  var ti=ge('gn_title'),co=ge('gn_content');
  if(ti)GENERAL_NOTE_DRAFT.title=ti.value;if(co)GENERAL_NOTE_DRAFT.content=co.value;
  GENERAL_NOTE_DRAFT.dirty=(GENERAL_NOTE_DRAFT.title!==GENERAL_NOTE_DRAFT.originalTitle)||(GENERAL_NOTE_DRAFT.content!==GENERAL_NOTE_DRAFT.originalContent);
}
function gnClearDraft(){GENERAL_NOTE_DRAFT={open:false,noteId:null,title:'',content:'',originalTitle:'',originalContent:'',dirty:false};}
function gnDraftDirty(){return GENERAL_NOTE_DRAFT.open&&GENERAL_NOTE_DRAFT.dirty;}
window.gnCaptureDraft=gnCaptureDraft;window.gnClearDraft=gnClearDraft;window.gnDraftDirty=gnDraftDirty;

var gnQuery='',gnView='all',gnExpanded={};
function _gnDate(ts){if(!ts)return '';try{var d=new Date(ts);return d.getDate()+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}catch(e){return '';}}
function gnSetQuery(v){gnQuery=v;renderGeneralNotesList();}
function gnSetView(v){gnView=v;renderPage();}
window.gnSetQuery=gnSetQuery;window.gnSetView=gnSetView;
function openGeneralNoteForm(noteId){
  var n=noteId?normalizeGeneralNotes(D.generalNotes).find(function(x){return String(x.id)===String(noteId);}):null;
  GENERAL_NOTE_DRAFT={open:true,noteId:noteId||null,title:(n&&n.title)||'',content:(n&&n.content)||'',
    originalTitle:(n&&n.title)||'',originalContent:(n&&n.content)||'',dirty:false};
  var h='<div class="mh"><span style="font-weight:700;font-size:15px">'+(noteId?'Notu Düzenle':'Yeni Genel Not')+'</span><button class="btn btn-g btn-ic" onclick="gnFormCancel()">'+ic('x',14)+'</button></div>';
  h+='<div class="mb">';
  h+='<p class="lbl" style="margin-bottom:3px">Başlık</p><input class="inp" id="gn_title" maxlength="120" oninput="gnCaptureDraft()" placeholder="Not başlığı..." value="'+U.esc(GENERAL_NOTE_DRAFT.title)+'">';
  h+='<p class="lbl" style="margin:9px 0 3px">İçerik</p>'+rtBar('gn_content');
  h+='<textarea class="inp" id="gn_content" rows="7" oninput="gnCaptureDraft()" placeholder="Düşüncelerini yaz... (**kalın**, *italik*, - liste, 1. numaralı, [ ] yapılacak)">'+U.esc(GENERAL_NOTE_DRAFT.content)+'</textarea>';
  h+='</div>';
  h+='<div class="mf"><button class="btn btn-s" style="flex:1" onclick="gnFormCancel()">İptal</button><button class="btn btn-p" style="flex:2" onclick="gnFormSave()">'+ic('chk',13)+' Kaydet</button></div>';
  showModal(h);var t=ge('gn_title');if(t){t.focus();t.selectionStart=t.selectionEnd=t.value.length;}
}
window.openGeneralNoteForm=openGeneralNoteForm;
function gnFormCancel(){
  gnCaptureDraft();
  if(gnDraftDirty()&&!confirm('Kaydedilmemiş not değişiklikleri var. Kapatılsın mı?'))return;
  gnClearDraft();closeModal();
}
window.gnFormCancel=gnFormCancel;
function gnFormSave(){
  gnCaptureDraft();
  var title=(GENERAL_NOTE_DRAFT.title||'').trim().slice(0,120);
  if(!title){alert('Not başlığı zorunlu!');return;}
  var content=String(GENERAL_NOTE_DRAFT.content||'').replace(/\r\n?/g,'\n').slice(0,20000);
  var now=Date.now(),id=GENERAL_NOTE_DRAFT.noteId;
  snap();
  if(id){
    D.generalNotes=(D.generalNotes||[]).map(function(x){return String(x.id)===String(id)?Object.assign({},x,{title:title,content:content,updatedAt:now}):x;});
  }else{
    D.generalNotes=[{id:newGeneralNoteId(),title:title,content:content,pinned:false,archived:false,createdAt:now,updatedAt:now}].concat(D.generalNotes||[]);
  }
  gnClearDraft();save();closeModal();renderPage();
}
window.gnFormSave=gnFormSave;
function gnPin(id){snap();D.generalNotes=(D.generalNotes||[]).map(function(n){return String(n.id)===String(id)?Object.assign({},n,{pinned:!n.pinned}):n;});save();renderPage();}
function gnArchive(id){snap();D.generalNotes=(D.generalNotes||[]).map(function(n){return String(n.id)===String(id)?Object.assign({},n,{archived:!n.archived}):n;});save();renderPage();}
function gnDelete(id){if(!confirm('Bu genel not kalıcı olarak silinsin mi?'))return;snap();D.generalNotes=(D.generalNotes||[]).filter(function(n){return String(n.id)!==String(id);});save();renderPage();}
function gnToggleExpand(id){gnExpanded[id]=!gnExpanded[id];renderGeneralNotesList();}
window.gnPin=gnPin;window.gnArchive=gnArchive;window.gnDelete=gnDelete;window.gnToggleExpand=gnToggleExpand;
function renderGeneralNotes(){
  var h='<div class="fade"><div class="sh"><div><h1 class="sh-t">Genel Notlar</h1><p class="sh-sub">Hedeflerden bağımsız düşüncelerini, fikirlerini ve bilgilerini burada tut.</p></div>';
  h+='<button class="btn btn-p" onclick="openGeneralNoteForm()">'+ic('plus',13)+' Yeni Not</button></div>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">';
  h+='<input class="inp" id="gn_search" style="max-width:280px" placeholder="Notlarda ara..." value="'+U.esc(gnQuery)+'" oninput="gnSetQuery(this.value)">';
  h+='<div style="display:flex;gap:4px">';
  [['all','Tümü'],['pinned','Sabitlenenler'],['archive','Arşiv']].forEach(function(f){var a=gnView===f[0];
    h+='<button class="btn btn-sm" style="background:'+(a?'var(--blue)':'var(--s2)')+';color:'+(a?'#fff':'var(--t2)')+'" data-v="'+f[0]+'" onclick="gnSetView(this.dataset.v)">'+f[1]+'</button>';});
  h+='</div></div>';
  h+='<div id="gn_list"></div></div>';
  sh('pinner',h);
  renderGeneralNotesList();
}
window.renderGeneralNotes=renderGeneralNotes;
function renderGeneralNotesList(){
  var box=ge('gn_list');if(!box)return;
  var list=filterGeneralNotes(D.generalNotes,gnQuery,gnView);
  var h='';
  if(gnQuery.trim())h+='<p style="font-size:11px;color:var(--t3);margin-bottom:8px">'+list.length+' sonuç</p>';
  if(!list.length){
    var msg=gnQuery.trim()?'Aramaya uygun not bulunamadı.':(gnView==='archive'?'Arşivde not yok.':(gnView==='pinned'?'Sabitlenmiş not yok.':'Henüz genel not yok.'));
    h+='<div class="card" style="padding:44px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">'+ic('pen',30,'var(--t3)')+'<p style="font-weight:700;font-size:15px">'+msg+'</p>'+((gnView==='all'&&!gnQuery.trim())?'<button class="btn btn-p" onclick="openGeneralNoteForm()">'+ic('plus',13)+' İlk notunu ekle</button>':'')+'</div>';
    box.innerHTML=h;return;
  }
  h+='<div style="display:flex;flex-direction:column;gap:10px">';
  list.forEach(function(n){
    var long=noteIsLong(n.content),exp=!!gnExpanded[n.id],sid=U.esc(String(n.id));
    h+='<div class="card" style="padding:14px 16px">';
    h+='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">';
    h+='<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+(n.pinned?'<span class="pill p-blue" style="font-size:9px">Sabit</span>':'')+(n.archived?'<span class="pill" style="font-size:9px;background:var(--s2);color:var(--t3)">Arşiv</span>':'')+'<p style="font-weight:700;font-size:14px;word-break:break-word">'+U.esc(n.title)+'</p></div></div>';
    h+='<div style="display:flex;gap:3px;flex-shrink:0">';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="'+(n.pinned?'Sabitlemeyi kaldır':'Sabitle')+'" aria-label="'+(n.pinned?'Sabitlemeyi kaldır':'Sabitle')+'" data-id="'+sid+'" onclick="gnPin(this.dataset.id)">'+ic('star',12,n.pinned?'var(--blue)':'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="Düzenle" aria-label="Düzenle" data-id="'+sid+'" onclick="openGeneralNoteForm(this.dataset.id)">'+ic('edit',12,'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="'+(n.archived?'Arşivden çıkar':'Arşivle')+'" aria-label="'+(n.archived?'Arşivden çıkar':'Arşivle')+'" data-id="'+sid+'" onclick="gnArchive(this.dataset.id)">'+ic('arc',12,'var(--t3)')+'</button>';
    h+='<button class="btn btn-g btn-ic" style="width:26px;height:26px" title="Sil" aria-label="Sil" data-id="'+sid+'" onclick="gnDelete(this.dataset.id)">'+ic('trash',12,'var(--t3)')+'</button>';
    h+='</div></div>';
    if(!isRichTextEmpty(n.content))h+='<div class="rt'+(long&&!exp?' note-clamp':'')+'" style="font-size:12.5px;line-height:1.55;color:var(--t2)">'+renderRichText(n.content)+'</div>';
    if(long)h+='<button class="btn btn-g btn-sm" style="margin-top:5px" data-id="'+sid+'" onclick="gnToggleExpand(this.dataset.id)">'+(exp?'Daralt':'Devamını Göster')+'</button>';
    if(n.updatedAt)h+='<p style="font-size:10px;color:var(--t3);margin-top:6px">Güncellenme: '+U.esc(_gnDate(n.updatedAt))+'</p>';
    h+='</div>';
  });
  h+='</div>';
  box.innerHTML=h;
}
window.renderGeneralNotesList=renderGeneralNotesList;

/* ══════════════════════════════════════════════════════════════════════════
   D9 — GÜVENLİ RESTORE UI (yalnız arayüz; D6 motoru DEĞİŞMEZ)
   Mevcut API'ler: prepareRestore/confirmRestore/cancelRestore/executeRestore/
   verifyRestoreOutcome/getRestoreReport + BACKUP_API.listBackups/buildRestorePreview.
   Yeni restore mantıği/transaction/commitMutation/RESTORE_API DEĞİŞTİRİLMEZ.
   ══════════════════════════════════════════════════════════════════════════ */
var RESTORE_UI={backups:[],query:'',filter:'all',loading:false,loadError:false,loaded:false,
  opId:null,backupId:null,preview:null,suspect:null,warnings:[],view:'list',
  stage:null,progressTimer:null,report:null,busy:false,accepted:false,error:null};
var RESTORE_ERR_TR={AUTH_REQUIRED:'Oturum gerekli.',WRONG_USER:'Bu yedek bu hesaba ait değil.',
  RESTORE_BUSY:'Zaten bir geri yükleme sürüyor.',CONFLICT_ACTIVE:'Aktif veri çakışması var; önce çözün.',
  PENDING_MUTATION:'Bekleyen kaydedilmemiş değişiklik var.',OFFLINE:'Çevrimdışısınız.',
  BACKUP_NOT_FOUND:'Yedek bulunamadı.',BACKUP_CORRUPTED:'Yedek bozuk.',BACKUP_INCOMPLETE:'Yedek tamamlanmamış.',
  FUTURE_SCHEMA:'Yedek bu sürümden daha yeni.',UNSUPPORTED_SCHEMA:'Yedek şeması desteklenmiyor.',
  PREVIEW_STALE:'Önizleme güncelliğini yitirdi; tekrar deneyin.',NOT_CONFIRMED:'Önce onay gerekli.',
  SAFEGUARD_FAILED:'Güvenlik yedeği alınamadı; geri yükleme iptal edildi.',
  TRANSACTION_CONFLICT:'Sunucu sürümü değişmiş; geri yükleme uygulanmadı.',
  COMMIT_UNCERTAIN:'Sonuç belirsiz; veriye dokunulmadı, güvenlik yedeği korundu.',
  NOT_COMMITTED:'Geri yükleme uygulanmadı; veri değişmedi.',WRONG_OPERATION:'Geçersiz işlem.',
  INVALID_STATE:'Uygun aşamada değil.',PRECHECK_FAILED:'Ön kontrol başarısız.',
  PREPARE_FAILED:'Hazırlık başarısız.',EXECUTE_FAILED:'Geri yükleme başarısız.'};
function rstErrMsg(code){return RESTORE_ERR_TR[code]||'Beklenmeyen bir sorun oluştu.';}
function rstReasonLabel(r){return r==='manual'?'Manuel':(r==='daily'?'Otomatik':(String(r||'').indexOf('before_')===0?'Güvenlik':'Diğer'));}
function rstReasonPill(r){var c=r==='manual'?'p-blue':(r==='daily'?'p-green':(String(r||'').indexOf('before_')===0?'p-orange':''));return '<span class="pill '+c+'" style="font-size:9px">'+rstReasonLabel(r)+'</span>';}
function rstFmtBytes(b){b=Number(b||0);return b<1024?b+' B':(b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB');}
function rstRisk(pv){
  var imp=pv&&pv.destructiveImpact, conf=pv&&pv.confidence, warns=(pv&&pv.warnings&&pv.warnings.length)||0;
  if(imp==='critical')return {key:'red',bg:'var(--red)',label:'Yüksek Riskli (yıkıcı)'};
  if(imp==='high'||imp==='medium'||conf==='low'||warns)return {key:'yellow',bg:'var(--orange)',label:'Uyarılı'};
  return {key:'green',bg:'var(--green)',label:'Normal'};
}
/* ── Liste ── */
