import { renderMedicineSheets } from './ward-medicine-table.js?v=1970';
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dateInput=$('report-date'), wardSelect=$('report-ward'), status=$('status'), printButton=$('print'), actionButton=$('workflow-action');
  let requestNumber=0, role='', csrf='', sessionUser=null, signing=false, currentStep=0,currentRevision=0,currentFingerprint='';
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const esc=value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const roleLabel={NURSE:'នាយសាល',MIDWIFE:'នាយសាល',CHIEF_WARD:'ប្រធានផ្នែក',DIRECTOR:'ប្រធានមន្ទីរពេទ្យ',PHARMACY:'ឱសថការី'};
  function setStatus(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
  function localReportReady(report){return ['director_signed','pharmacy_signed','handed_over','delivered'].includes(report.approval?.status);}
  function signerText(s){return s?.signedAt?`${esc(s.name||'')} · ${new Date(s.signedAt).toLocaleString()}`:'';}
  function fitHeaders(){for(const cell of document.querySelectorAll('.drug-heading')){const label=cell.querySelector('span');if(!label)continue;let size=12;label.style.fontSize=`${size}px`;while(label.offsetWidth>cell.clientWidth-2&&size>6)label.style.fontSize=`${--size}px`;}}
  function fitSheets(){fitHeaders();for(const frame of document.querySelectorAll('.sheet-frame')){const sheet=frame.querySelector('.report-sheet');if(!sheet)continue;const scale=Math.min(1,frame.clientWidth/sheet.offsetWidth);sheet.style.transform=`scale(${scale})`;frame.style.height=`${sheet.offsetHeight*scale}px`;}}
  window.addEventListener('beforeprint',fitHeaders);window.addEventListener('resize',fitSheets);
  function clearReport(){ $('report-sheets').replaceChildren(); printButton.disabled=true; actionButton.hidden=true; actionButton.disabled=false; }
  function render(report){
    const a=report.approval||{},step=a.nextStep;
    currentStep=step;currentRevision=a.revision;currentFingerprint=report.fingerprint||'';
    const allowed=step===1?role==='WARD_HEAD':step===2?['CHIEF_WARD','DOCTOR'].includes(role):step===3?['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role):step===6?['NURSE','MIDWIFE'].includes(role):[4,5].includes(step)&&role==='PHARMACY';
    const canSign=allowed&&report.matrix.patientCount>0&&dateInput.value<=today();
    $('report-sheets').innerHTML=renderMedicineSheets(report,{role,canSign});
    // This page disallows inline HTML styles. Apply the measured widths through
    // CSSOM so the browser and the isolated print copy keep the same columns.
    for(const sheet of $('report-sheets').querySelectorAll('[data-sheet-width]'))sheet.style.width=sheet.dataset.sheetWidth+'px';
    for(const column of $('report-sheets').querySelectorAll('col[data-column-width]'))column.style.width=column.dataset.columnWidth+'%';
    const messages={pending:'រង់ចាំហត្ថលេខា នាយសាល',nurse_signed:'រង់ចាំហត្ថលេខា ប្រធានផ្នែក',chief_signed:'រង់ចាំការអនុម័ត និងហត្ថលេខាអ្នកគ្រប់គ្រង',director_signed:'រង់ចាំហត្ថលេខាឱសថការី',pharmacy_signed:'រង់ចាំហត្ថលេខាអ្នកប្រគល់',handed_over:'រង់ចាំហត្ថលេខាអ្នកទទួល',delivered:'បានចុះហត្ថលេខាទាំង ៦ រួចរាល់',rejected:'បដិសេធ · សូមកែតម្រូវ និងចុះហត្ថលេខាឡើងវិញ'};
    $('approval-status').innerHTML=`<strong>${esc(a.legacyComplete?'បានប្រគល់ឱសថរួចរាល់តាមដំណើរការចាស់ / Completed under previous workflow':messages[a.status]||'')}</strong>${a.rejectionNote?`<p>${esc(a.rejectionNote)}</p>`:''}${step?`<p>ហត្ថលេខាបន្ទាប់ / Next signature: ${step}/6</p>`:''}${step===3&&['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role)?'<button type="button" class="danger" data-reject-medicine>បដិសេធ / Reject</button>':''}`;
    if(a.history?.length){const stages=['','នាយសាល','ប្រធានផ្នែក','អ្នកគ្រប់គ្រង','ឱសថការី','អ្នកប្រគល់','អ្នកទទួល'];$('approval-status').insertAdjacentHTML('beforeend',`<details><summary>ប្រវត្តិហត្ថលេខា / Signature history (${a.history.length})</summary><ol>${a.history.map(h=>`<li>${esc(h.action==='REJECTED'?'បដិសេធ / Rejected':stages[Number(h.action.split('_')[1])]||h.action)} · ${esc(h.actorName)} · ${esc(new Date(h.at).toLocaleString())}${h.note?`<p>${esc(h.note)}</p>`:''}</li>`).join('')}</ol></details>`);}
    actionButton.hidden=true;
    printButton.disabled=!localReportReady(report);fitSheets();document.fonts?.ready?.then(fitSheets);
  }
  async function signSelected(step=currentStep){
    if(signing)return;signing=true;
    document.querySelectorAll('[data-medicine-sign]').forEach(b=>b.disabled=true);
    try{
      const response=await fetch('/api/reports/ward-medicines/sign',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({date:dateInput.value,ward:wardSelect.value,step,revision:currentRevision,fingerprint:currentFingerprint})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Unable to sign the ward medicine list.');
      render(data.report);setStatus(`បានធ្វើបច្ចុប្បន្នភាពហត្ថលេខា៖ ${data.report.approval?.status||'pending'}`);await refreshDirectorPanel();window.dispatchEvent(new Event('emr-requests-changed'));
    }catch(error){setStatus(error.message,true);document.querySelectorAll('[data-medicine-sign]').forEach(b=>b.disabled=false);}finally{signing=false;}
  }
  async function refreshDirectorPanel(){
    const panel=$('director-medicine-panel');if(!['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role)){panel.hidden=true;return;}panel.hidden=false;
    try{const response=await fetch('/api/reports/ward-medicines/pending',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;const {items=[]}=await response.json();$('director-pending-count').textContent=String(items.length);const list=$('director-pending-list');list.replaceChildren();if(!items.length){list.textContent='មិនមានបញ្ជីឱសថរង់ចាំហត្ថលេខាទេ។';return;}for(const item of items){const button=document.createElement('button');button.type='button';button.textContent=`${item.wardNameKh} · ${item.date} · អ្នកជំងឺ ${item.patientCount} នាក់ · ឱសថ ${item.medicineCount} ប្រភេទ`;const note=document.createElement('small');note.textContent='បានចុះហត្ថលេខាដោយប្រធានផ្នែក · រង់ចាំប្រធានមន្ទីរពេទ្យ';button.append(note);button.onclick=()=>{dateInput.value=item.date;wardSelect.value=item.ward;void load();};list.append(button);}}
    catch{}
  }
  async function load(){
    const selectedDate=dateInput.value, selectedWard=wardSelect.value, current=++requestNumber;clearReport();
    if(!selectedDate||!selectedWard){setStatus('សូមជ្រើសរើសកាលបរិច្ឆេទ និងផ្នែក។',true);return;}
    $('refresh').disabled=true;setStatus('កំពុងទាញបញ្ជីឱសថប្រចាំថ្ងៃ…');
    try{const response=await fetch(`/api/reports/ward-medicines?date=${encodeURIComponent(selectedDate)}&ward=${encodeURIComponent(selectedWard)}`,{credentials:'same-origin',cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'មិនអាចទាញបញ្ជីឱសថបានទេ។');if(current!==requestNumber)return;wardSelect.replaceChildren();for(const ward of data.wards||[])wardSelect.add(new Option(ward.nameKh||ward.nameEn||ward.code,ward.code));wardSelect.value=selectedWard;render(data);setStatus(`${data.matrix.patientCount} អ្នកជំងឺ · ${data.matrix.columns.length} ប្រភេទឱសថ។`);}
    catch(error){if(current===requestNumber)setStatus(error.message,true);}finally{if(current===requestNumber)$('refresh').disabled=false;}
  }
  async function start(){
    const requested=new URLSearchParams(location.search);dateInput.value=/^\d{4}-\d{2}-\d{2}$/.test(requested.get('date')||'')?requested.get('date'):today();
    $('refresh').addEventListener('click',load);dateInput.addEventListener('change',load);wardSelect.addEventListener('change',load);actionButton.addEventListener('click',()=>void signSelected());printButton.addEventListener('click',()=>window.printEmrReport({selectors:['#report-sheets'],title:'Daily IPD drug list',orientation:'landscape'}));
    try{const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(response.status===401){location.replace('/login');return;}const session=await response.json();if(session.user?.needsContext){location.replace('/context');return;}sessionUser=session.user;csrf=session.csrfToken;role=String(session.user?.activeRole||'').toUpperCase();
      const activeWard=session.user?.activeWard?.code||'';const requestedWard=requested.get('ward');const global=['ADMIN','VICE_DIRECTOR','PHARMACY','DIRECTOR'].includes(role);const initialWard=global?(requestedWard||'medicine'):activeWard;if(!initialWard||initialWard==='opd'){setStatus('Select an inpatient ward.',true);return;}wardSelect.add(new Option(session.user?.activeWard?.nameKh||initialWard,initialWard));await document.fonts?.load('13px Battambang').catch(()=>{});await load();if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role)){void refreshDirectorPanel();setInterval(()=>void refreshDirectorPanel(),30000);}
    }catch(error){setStatus(error.message,true);}
  }
  $('report-sheets').addEventListener('click',event=>{const button=event.target.closest('[data-medicine-sign]');if(button)void signSelected(Number(button.dataset.medicineSign));});
  $('approval-status').addEventListener('click',event=>{if(!event.target.closest('[data-reject-medicine]'))return;const d=document.createElement('dialog');d.className='medicine-rejection';d.innerHTML='<form><h3>មតិកែតម្រូវ / Correction feedback</h3><textarea name="note" required maxlength="1000"></textarea><p role="alert"></p><button type="button" data-cancel>បោះបង់ / Cancel</button><button class="danger" type="submit">បដិសេធ / Reject</button></form>';document.body.append(d);d.showModal();d.onclose=()=>d.remove();d.querySelector('[data-cancel]').onclick=()=>d.close();d.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const response=await fetch('/api/reports/ward-medicines/reject',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({date:dateInput.value,ward:wardSelect.value,note:e.target.elements.note.value,revision:currentRevision,fingerprint:currentFingerprint})});const data=await response.json();if(!response.ok)throw Error(data.error);render(data.report);d.close();await refreshDirectorPanel();window.dispatchEvent(new Event('emr-requests-changed'));}catch(error){d.querySelector('p').textContent=error.message;button.disabled=false;}};});
  start();
})();
