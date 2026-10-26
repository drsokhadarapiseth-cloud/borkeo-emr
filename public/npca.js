'use strict';
(async function(){
  const en=()=>window.getBorkeoLanguage?.()==='en', t=(kh,eng)=>en()?eng:kh;
  const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusNames={5:['កំពុងដំណើរការ','Processing'],3:['រង់ចាំការកែបន្ថែម','Pending'],2:['បរាជ័យ','Failed'],1:['រួចរាល់','Ready']};
  const statusName=n=>t(...(statusNames[n]||statusNames[3]));
  const failureReason=errors=>Array.isArray(errors)?errors.map(e=>typeof e==='string'?e:en()?e.messageEn||e.messageKh:e.messageKh||'').filter(Boolean).join('\n'):
    typeof errors==='string'?errors:errors?.remote||errors?.errors||'';
  let csrf='',canSubmit=false;
  async function api(path,body,method='POST'){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...(body?{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||t('សូមពិនិត្យព័ត៌មានដែលត្រូវកែ។','Review the validation problems.')),{data:d});return d;}
  function showReview(data){
    $('npca-issues').replaceChildren();
    for(const error of data.errors||[]){const li=document.createElement('li'),a=document.createElement('a');a.textContent=en()?error.messageEn||error.messageKh:error.messageKh||t('សូមពិនិត្យព័ត៌មាន។','Review the details.');
      a.href=error.screen==='billing'?'/billing':error.screen==='anc'?'/anc-record?patient='+encodeURIComponent(data.patientKey):'/emr?patient='+encodeURIComponent(data.patientKey)+'&view='+({registration:'register',triage:'triage',daily:'daily',discharge:'discharge'}[error.screen]||'medical');li.appendChild(a);$('npca-issues').appendChild(li);}
    $('npca-detail').textContent=JSON.stringify(data.payload||data,null,2);if(!$('npca-review').open)$('npca-review').showModal();
  }
  async function load(){try{
    $('npca-refresh').textContent=t('ទាញទិន្នន័យ','Refresh');
    document.querySelector('h1').textContent=t('ការបញ្ជូនទិន្នន័យ NPCA','NPCA submissions');$('npca-payload-title').textContent=t('ទិន្នន័យសម្រាប់ពិនិត្យមុនបញ្ជូន','Payload for review');
    $('npca-head').innerHTML='<tr>'+[t('លេខករណី','Visit'),t('ស្ថានភាព','Status'),t('ព័ត៌មាន','Details'),t('សកម្មភាព','Actions')].map(s=>'<th>'+s+'</th>').join('')+'</tr>';
    const [data,candidates]=await Promise.all([api('/api/npca/submissions'),api('/api/npca/candidates')]);
    const rows=candidates.patients.map(p=>({...p,...data.submissions.find(s=>s.patient_key===p.patient_key)}));
    for(const s of data.submissions)if(!rows.some(r=>r.patient_key===s.patient_key))rows.push(s);
    $('npca-rows').innerHTML=rows.map(r=>`<tr><td><a href="/emr?patient=${encodeURIComponent(r.patient_key)}">${esc(r.case_number||r.visit_code)}</a></td><td>${esc(r.status?statusName(r.status):t('មិនទាន់បញ្ជូន','Not submitted'))}</td><td>${esc(r.message||'')}<pre>${esc(failureReason(r.errors))}</pre></td><td><button type="button" data-review="${esc(r.patient_key)}">${t('ពិនិត្យ','Review')}</button>${canSubmit&&![1,5].includes(r.status)?`<button type="button" data-submit="${esc(r.patient_key)}">${t('បញ្ជូន','Submit')}</button>`:''}</td></tr>`).join('');
    $('npca-status').textContent='';
  }catch(e){$('npca-status').textContent=e.message;}}
  try{const session=await api('/api/auth/me');csrf=session.csrfToken;canSubmit=['ADMIN','ACCOUNTANT','CLERK'].includes(session.user?.activeRole);
    if(location.pathname==='/admin/npca'){const s=await api('/api/npca/settings');$('npca-settings').hidden=false;$('npca-settings').textContent=[t('ការតភ្ជាប់៖ ','Connection: ')+(s.enabled?t('បើក','Enabled'):t('បិទ','Disabled')),t('អាសយដ្ឋាន៖ ','Address: ')+s.baseUrl,t('កូដមូលដ្ឋាន៖ ','Facility code: ')+s.facilityCode,t('ពេលទទួលសោចុងក្រោយ៖ ','Last token time: ')+(s.lastTokenAt?new Date(s.lastTokenAt).toLocaleString():t('មិនទាន់មាន','None'))].join('\n');$('npca-test').hidden=!s.canManage;$('npca-test').textContent=t('សាកល្បងការតភ្ជាប់','Test connection');
      if(s.canManage){$('npca-mappings').hidden=false;$('npca-map-title').textContent=t('ផ្គូផ្គងកូដដែល NPCA បានបញ្ជាក់','NPCA-confirmed code mappings');$('npca-map-save').textContent=t('រក្សាទុក','Save');}}
    $('npca-test').onclick=async()=>{try{await api('/api/npca/test',{});location.reload();}catch(e){$('npca-status').textContent=e.message;}};
    $('npca-map-save').onclick=async()=>{try{await api('/api/npca/mappings',{category:$('npca-map-category').value,localValue:$('npca-map-local').value.trim(),code:$('npca-map-code').value.trim()},'PUT');$('npca-status').textContent=t('បានរក្សាទុក','Saved');}catch(e){$('npca-status').textContent=e.message;}};
    $('npca-rows').onclick=async event=>{const button=event.target.closest('button');if(!button)return;const key=button.dataset.review||button.dataset.submit;if(!key)return;button.disabled=true;
      try{if(button.dataset.review)showReview({...await api('/api/npca/review?patientKey='+encodeURIComponent(key)),patientKey:key});else{await api('/api/npca/submit',{patientKey:key});await load();}}
      catch(error){if(error.data?.errors)showReview({...error.data,patientKey:key});else $('npca-status').textContent=error.message;}finally{button.disabled=false;}};
    // v48.0: one status check for every visit in a date range (NPCA guide 4.4).
    if(canSubmit){const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10),from=new Date(Date.now()+7*3600000-30*86400000).toISOString().slice(0,10);
      $('npca-range').hidden=false;$('npca-range-title').textContent=t('ពិនិត្យស្ថានភាពតាមកាលបរិច្ឆេទ','Check status by date');
      $('npca-range-by-label').textContent=t('តាម','By');$('npca-range-by').options[0].textContent=t('ថ្ងៃចេញ','Discharge date');$('npca-range-by').options[1].textContent=t('ថ្ងៃចូល','Admission date');
      $('npca-range-from-label').textContent=t('ពីថ្ងៃ','From');$('npca-range-to-label').textContent=t('ដល់ថ្ងៃ','To');$('npca-range-check').textContent=t('ពិនិត្យស្ថានភាព','Check status');
      $('npca-range-from').value=from;$('npca-range-to').value=today;
      $('npca-range-check').onclick=async()=>{const button=$('npca-range-check');button.disabled=true;
        try{const r=await api('/api/npca/check-processed',{from:$('npca-range-from').value,to:$('npca-range-to').value,by:$('npca-range-by').value});await load();
          $('npca-status').textContent=t('ចំនួនករណីដែលបានពិនិត្យ៖ ','Visits checked: ')+r.checked+'  '+t('ចំនួនដែលបានធ្វើបច្ចុប្បន្នភាព៖ ','Updated: ')+r.updated;}
        catch(e){$('npca-status').textContent=e.message;}finally{button.disabled=false;}};}
    $('npca-refresh').onclick=load;await load();
  }catch(e){$('npca-status').textContent=e.message;}
})();
