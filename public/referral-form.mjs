import {referralFields as labels,referralChecks as checks,REFERRAL_TITLE} from './referral-schema.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadStyle(){if(!document.querySelector('link[data-ref-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/public/referral-form.css?v=4940';link.dataset.refStyle='';document.head.append(link);return new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject})}return Promise.resolve()}
export function referralPageHtml(data={},signature=null){
 const f=(key,multi=false)=>`<label class="ref-line"><span>${esc(labels[key])}</span>${multi?`<textarea data-ref-field="${key}" aria-label="${esc(labels[key])}">${esc(data[key])}</textarea>`:`<input data-ref-field="${key}" aria-label="${esc(labels[key])}" value="${esc(data[key])}">`}</label>`;
 const c=key=>`<label class="ref-check"><input type="checkbox" data-ref-field="${key}" ${data[key]?'checked':''}>${esc(checks[key])}</label>`;
 const pair=(a,b)=>`<div class="ref-grid">${f(a)}${f(b)}</div>`;
 return `<article class="ref-page" aria-label="${REFERRAL_TITLE}">
 <header><div><img class="ref-logo" src="/public/logo-hospital.jpg" alt=""><h2>ក្រសួងសុខាភិបាល</h2>${f('province')}${f('district')}${f('facility')}</div><div><p class="ref-motto">ព្រះរាជាណាចក្រកម្ពុជា<br>ជាតិ សាសនា ព្រះមហាក្សត្រ</p><h1>${REFERRAL_TITLE}</h1></div><div>${f('number')}${f('patientId')}</div></header>
 <section class="ref-identity"><div class="ref-grid">${f('name')}${pair('sex','birth')}</div><div class="ref-grid">${pair('companion','phone')}${f('equity')}</div><div class="ref-grid ref-four">${['village','commune','districtAddress','provinceAddress'].map(k=>f(k)).join('')}</div></section>
 ${f('admission')}${f('complaint',true)}${f('history',true)}${f('exam',true)}
 <div class="ref-line">${f('results',true)}${c('noTests')}</div>${f('diagnosis',true)}
 <div class="ref-line">${f('treatment',true)}${c('noTreatment')}</div><div class="ref-line">${f('intervention')}${c('noIntervention')}</div>
 <div class="ref-grid ref-five">${['pulse','bp','respiration','temperature','spo2'].map(k=>f(k)).join('')}</div>${f('reason',true)}
 <section class="ref-special"><div class="ref-box ref-maternal"><h2>ស្ត្រីមានផ្ទៃពោះ ឬស្ត្រីទើបសម្រាលកូន</h2>${pair('gravida','parity')}${pair('miscarriage','gestation')}${f('edd')}${f('complications')}<div class="ref-line">${c('membraneYes')}${c('membraneNo')}${f('membrane')}</div>${f('fluid')}${f('steroid')}${f('dexamethasone')}${f('antibiotics')}</div>
 <div class="ref-children"><div class="ref-box"><h2>កុមារអាយុក្រោម ៥ ឆ្នាំ</h2>${pair('childWeight','childHeight')}${f('childNutrition')}${f('childArm')}${f('childSd')}${f('childEdema')}${f('childBreast')}${f('childFood')}</div><div class="ref-box"><h2>ទារកអាយុក្រោម ៦ សប្តាហ៍</h2>${f('newbornBirth')}${f('newbornGestation')}${f('newbornDelivery')}${f('newbornWeight')}</div></div></section>
 <div class="ref-line">${['maternalBook','childBook','patientBook','healthBook'].map(c).join('')}${f('otherDocuments')}</div>
 <section class="ref-sending"><div class="ref-box">${f('senderName')}${f('senderPhone')}${f('departure')}<div class="ref-signature">${signature?.signatureDataUrl?`<img src="${esc(signature.signatureDataUrl)}" alt="ហត្ថលេខាអ្នកបញ្ជូន"><span>${esc(signature.signerName)} · ${esc(new Date(signature.signedAt).toLocaleString('km-KH'))}</span>`:'ហត្ថលេខាអ្នកបញ្ជូន'}</div></div><div class="ref-box ref-receiving">${f('destination')}${f('receiverName')}${f('receiverPhone')}<div class="ref-line">${f('arrival')}${c('transport')}</div>${f('receiverSignature')}</div></section>
 </article>`;
}
export async function openReferralForm({patientKey}={}){
 if(document.querySelector('.referral-modal'))return;
 await loadStyle();let csrf=window.emrSession?.csrfToken||'';
 const api=async(path,body)=>{if(body&&!csrf)csrf=(await(await fetch('/api/auth/me')).json()).csrfToken;const response=await fetch(path,{credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});const result=await response.json();if(!response.ok)throw Error(result.error||'មិនអាចបើកទម្រង់បានទេ');return result};
 const loaded=await api('/api/referral-form?patientKey='+encodeURIComponent(patientKey));const capabilities=await api('/api/referral-capabilities');let stored=loaded.form,dirty=!stored,mode='NONE',drawn=false,signature=stored?.signature||null,busy=false;
 const overlay=document.createElement('section');overlay.className='referral-modal';overlay.dataset.emrTransient='';overlay.dataset.languageExclude='';if(loaded.canEdit)overlay.dataset.referralEditable='';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',REFERRAL_TITLE);
 overlay.innerHTML=`<div class="ref-toolbar"><strong>${REFERRAL_TITLE}</strong><button type="button" data-ref-save>រក្សាទុក</button><button type="button" data-ref-print>បោះពុម្ភលិខិតបញ្ជូន</button><button type="button" data-ref-esign>ប្រើហត្ថលេខាដែលបានរក្សាទុក</button><button type="button" data-ref-clear>លុបហត្ថលេខា</button><button type="button" data-ref-close>បិទ</button><div class="ref-status" role="status" aria-live="polite"></div></div><div class="ref-workspace">${referralPageHtml(stored?.data||loaded.defaults,signature)}</div><div class="ref-pad" hidden><label>ចុះហត្ថលេខាលើអេក្រង់</label><canvas width="960" height="260" aria-label="ផ្ទាំងចុះហត្ថលេខា"></canvas></div>`;
 overlay.querySelectorAll('.ref-toolbar button').forEach(button=>button.dataset.requiredBypass='');
 const prior=document.activeElement;document.body.append(overlay);const abort=new AbortController();
 const pad=overlay.querySelector('.ref-pad'),signArea=overlay.querySelector('.ref-signature');
 signArea.tabIndex=loaded.canEdit?0:-1;signArea.setAttribute('role','button');
 const openPad=()=>{if(loaded.canEdit&&!busy&&!['PENDING','ACCEPTED','REJECTED'].includes(transfer?.status)){pad.hidden=false;overlay.querySelector('canvas').tabIndex=0;overlay.querySelector('canvas').focus()}};
 signArea.onclick=openPad;signArea.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPad()}};
 const signatureActions=document.createElement('div');signatureActions.className='ref-sign-actions';
 for(const name of ['esign','clear'])signatureActions.append(overlay.querySelector('[data-ref-'+name+']'));
 const done=document.createElement('button');done.type='button';done.textContent='រួចរាល់';done.dataset.requiredBypass='';done.dataset.refSignatureDone='';done.onclick=()=>{pad.hidden=true;signArea.focus()};signatureActions.append(done);pad.append(signatureActions);
 const sendButton=document.createElement('button');sendButton.type='button';sendButton.dataset.refSend='';sendButton.dataset.requiredBypass='';sendButton.textContent='បញ្ជូន';overlay.querySelector('[data-ref-close]').before(sendButton);
 let transfer=null;sendButton.hidden=!capabilities.sender;
 const close=()=>{abort.abort();overlay.remove();prior?.focus?.()};overlay.querySelector('[data-ref-close]').onclick=close;
 const status=text=>overlay.querySelector('.ref-status').textContent=text;
 const canvas=overlay.querySelector('canvas'),context=canvas.getContext('2d');context.lineWidth=3;context.lineCap='round';context.strokeStyle='#163d66';
 let pointer=null;
 const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]};
 canvas.onpointerdown=e=>{if(!loaded.canEdit||busy)return;pointer=e.pointerId;canvas.setPointerCapture(pointer);context.beginPath();context.moveTo(...point(e));e.preventDefault()};
 canvas.onpointermove=e=>{if(pointer!==e.pointerId)return;context.lineTo(...point(e));context.stroke();drawn=true;mode='DRAWN';dirty=true;signature=null;renderSignature(canvas.toDataURL('image/png'));e.preventDefault()};
 canvas.onpointerup=canvas.onpointercancel=()=>{pointer=null};
 const renderSignature=url=>{const host=overlay.querySelector('.ref-signature');host.innerHTML=url?`<img src="${esc(url)}" alt="ហត្ថលេខាអ្នកបញ្ជូន">`:'ហត្ថលេខាអ្នកបញ្ជូន'};
 overlay.querySelector('[data-ref-clear]').onclick=()=>{context.clearRect(0,0,canvas.width,canvas.height);mode='NONE';signature=null;drawn=false;dirty=true;renderSignature('')};
 overlay.querySelector('[data-ref-esign]').onclick=()=>{if(!loaded.savedSignature?.hasSignature){status('មិនមានហត្ថលេខាដែលបានរក្សាទុកទេ សូមចុះហត្ថលេខាលើអេក្រង់');return}mode='SAVED';signature=null;dirty=true;renderSignature(loaded.savedSignature.signatureDataUrl)};
 const destination=overlay.querySelector('[data-ref-field=destination]');if(!stored&&destination)destination.value='មន្ទីរពេទ្យបង្អែកខេត្ត';
 const fields=()=>[...overlay.querySelectorAll('[data-ref-field]')];
 const read=()=>Object.fromEntries(fields().map(n=>[n.dataset.refField,n.type==='checkbox'?n.checked:n.value]));
 function fits(){let good=true;const measure=document.createElement('canvas').getContext('2d');for(const n of fields()){
  if(n.type==='checkbox')continue;const s=getComputedStyle(n);measure.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  const available=n.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);
  const bad=Boolean(n.value)&&(n.tagName==='TEXTAREA'?n.scrollHeight>n.clientHeight+1:measure.measureText(n.value).width>available+1);
  n.classList.toggle('ref-bad',bad);if(bad)good=false;
 }overlay.querySelector('[data-ref-print]').disabled=busy||!good||(!loaded.canEdit&&!stored?.signature);sendButton.disabled=busy||!loaded.canEdit||['PENDING','ACCEPTED','REJECTED'].includes(transfer?.status);return good}
 overlay.addEventListener('input',()=>{if(signature&&mode==='NONE'){signature=null;renderSignature('')}dirty=true;status(fits()?'':'អត្ថបទលើសទំហំសន្លឹក សូមសង្ខេបមុនបោះពុម្ព')});
 const save=async requireSignature=>{
  if(!loaded.canEdit)throw Error('មិនអាចកែប្រែទម្រង់នេះបានទេ');
  let chosenMode=mode,png=drawn?canvas.toDataURL('image/png'):'';
  if(requireSignature&&chosenMode==='NONE')throw Error('សូមចុះហត្ថលេខាមុនបោះពុម្ព');
  stored=(await api('/api/referral-form',{patientKey,revision:stored?.revision||0,data:read(),signatureMode:chosenMode,signatureDataUrl:png})).form;signature=stored.signature;dirty=false;mode='NONE';drawn=false;status('បានរក្សាទុកទម្រង់');return stored;
 };
 const run=async fn=>{if(busy)return;busy=true;const controls=[...overlay.querySelectorAll('input,textarea,button')].map(n=>[n,n.disabled]);controls.forEach(([n])=>n.disabled=true);try{await fn()}catch(error){status(error.message)}finally{busy=false;controls.forEach(([n,disabled])=>n.disabled=disabled);if(transfer)showTransfer();else fits()}};
 overlay.querySelector('[data-ref-save]').onclick=()=>run(()=>save(false));
 const showTransfer=()=>{if(transfer)status(transfer.status==='REJECTED'?'បដិសេធ'+(transfer.rejectionReason?' : '+transfer.rejectionReason:''):transfer.status==='ACCEPTED'?'បានទទួលអ្នកជំងឺ':transfer.status==='PENDING'?'បានបញ្ជូន កំពុងរង់ចាំទទួល':'មិនអាចបញ្ជូនបាន សូមព្យាយាមម្ដងទៀត');if(['PENDING','ACCEPTED','REJECTED'].includes(transfer?.status)){fields().forEach(n=>n.disabled=true);for(const name of ['save','esign','clear'])overlay.querySelector('[data-ref-'+name+']').disabled=true;pad.hidden=true;signArea.tabIndex=-1}fits()};
 sendButton.onclick=()=>run(async()=>{if((dirty||!stored?.signature)&&mode==='NONE')throw Error('សូមរក្សាទុក និងចុះហត្ថលេខាជាមុន');if(dirty||!stored?.signature)await save(true);transfer=(await api('/api/referral-send',{patientKey,revision:stored.revision})).transfer;showTransfer()});
 const refreshTransfer=async()=>{try{const result=await api('/api/referral-status?patientKey='+encodeURIComponent(patientKey));if(result.transfer){transfer=result.transfer;showTransfer();if(result.unavailable)status('មិនអាចផ្ទៀងផ្ទាត់ស្ថានភាពបាន')}}catch{}};
 void refreshTransfer();const poll=setInterval(()=>{if(!busy)void refreshTransfer()},10000);abort.signal.addEventListener('abort',()=>clearInterval(poll),{once:true});
 overlay.querySelector('[data-ref-print]').onclick=()=>run(async()=>{
  await document.fonts.ready;if(!fits())throw Error('អត្ថបទលើសទំហំសន្លឹក សូមសង្ខេបមុនបោះពុម្ព');
  if(dirty||!stored?.signature)await save(true);
  const approved=(await api('/api/referral-form/print',{patientKey,revision:stored.revision})).form;
  const temporary=document.createElement('div');temporary.innerHTML=referralPageHtml(approved.data,approved.signature);
  temporary.querySelectorAll('[data-ref-field]').forEach(n=>{const span=document.createElement('span');span.className=n.type==='checkbox'?'ref-check-mark':'ref-value';span.textContent=n.type==='checkbox'?(n.checked?'☑':'☐'):n.value;span.dataset.refPrintField=n.dataset.refField;n.replaceWith(span)});
  const frame=document.createElement('iframe');frame.className='ref-print-frame';frame.style.cssText='position:fixed;width:0;height:0;border:0';overlay.append(frame);const doc=frame.contentDocument;
  doc.open();doc.write(`<!doctype html><html lang="km"><head><meta charset="utf-8"><title>${REFERRAL_TITLE}</title><link rel="stylesheet" href="/public/referral-form.css"></head><body>${temporary.innerHTML}</body></html>`);doc.close();
  await new Promise(resolve=>{if(doc.readyState==='complete')resolve();else frame.onload=resolve});await doc.fonts.ready;
  await Promise.all([...doc.images].map(img=>img.decode?.().catch(()=>{})));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const page=doc.querySelector('.ref-page');if(page.scrollHeight>page.clientHeight+1||page.scrollWidth>page.clientWidth+1)throw Error('ទម្រង់មិនទាន់សមនឹងសន្លឹក A4 ទេ');
  const overflow=[...doc.querySelectorAll('.ref-value')].filter(n=>n.textContent&&(n.scrollHeight>n.clientHeight+1||n.scrollWidth>n.clientWidth+1));
  if(overflow.length){overflow.forEach(n=>fields().find(field=>field.dataset.refField===n.dataset.refPrintField)?.classList.add('ref-bad'));throw Error('អត្ថបទលើសទំហំសន្លឹក សូមសង្ខេបមុនបោះពុម្ព')}
  frame.dataset.ready='true';frame.contentWindow.focus();frame.contentWindow.print();
 });
 if(!loaded.canEdit){fields().forEach(n=>n.disabled=true);['save','esign','clear'].forEach(k=>overlay.querySelector('[data-ref-'+k+']').disabled=true);canvas.style.pointerEvents='none'}
 overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!pad.hidden){pad.hidden=true;signArea.focus()}else close();}if(event.key==='Tab'){const items=[...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')].filter(n=>n.checkVisibility());const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
 document.addEventListener('emr:patient-loaded',event=>{if(event.detail?.patient?.patientKey!==patientKey)close()},{signal:abort.signal});
 await document.fonts.ready;fits();overlay.querySelector('[data-ref-close]').focus();
}
function setupReferralButtons(){
 const role=window.emrSession?.user?.activeRole;if(!['DOCTOR','CHIEF_WARD'].includes(role)||new URLSearchParams(location.search).has('recordPage'))return;
 for(const id of ['sub_opd','sub_ipd']){const host=document.getElementById(id);if(!host||host.querySelector('[data-open-referral]'))continue;const box=document.createElement('div');box.className='no-print';box.dataset.emrTransient='';const button=document.createElement('button');button.type='button';button.className='btn-blue';button.dataset.openReferral='';button.dataset.requiredBypass='';button.textContent='បញ្ជូនទៅមន្ទីរពេទ្យបង្អែកខេត្ត';button.onclick=()=>openReferralForm({patientKey:window.getLoadedEmrPatient?.()?.patientKey}).catch(error=>alert(error.message));box.append(button);const ward=document.getElementById('web_opd_transfer_ward');if(id==='sub_opd'&&ward){const row=ward.closest('.p-row');row.hidden=true;row.after(box)}else host.append(box)}
}
if(typeof document!=='undefined'){
 document.addEventListener('DOMContentLoaded',setupReferralButtons);window.addEventListener('emr-session-ready',setupReferralButtons);document.addEventListener('emr:patient-loaded',setupReferralButtons);setupReferralButtons();
 window.addEventListener('click',event=>{
  if(location.pathname!=='/anc-record'||!['DOCTOR','CHIEF_WARD'].includes(window.emrSession?.user?.activeRole)||!event.target.closest?.('[data-action="print-referral"]'))return;
  event.preventDefault();event.stopImmediatePropagation();openReferralForm({patientKey:new URLSearchParams(location.search).get('patient')}).catch(error=>alert(error.message));
 },true);
}
