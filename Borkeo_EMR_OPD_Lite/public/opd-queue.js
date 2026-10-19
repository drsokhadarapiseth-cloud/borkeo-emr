'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={WAITING:'មិនទាន់ពិនិត្យ',IN_CONSULTATION:'កំពុងពិគ្រោះ',SENT_TO_PHARMACY:'បានបញ្ជូនវេជ្ជបញ្ជា',RECEIVED:'បានទទួលឱសថ'};
  let rows=[];let skipped=[];let activeRole='';
  async function loadSession(){try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(r.ok){const d=await r.json();activeRole=String(d.user?.activeRole||'').toUpperCase();}}catch{}}
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function action(item){
    if(activeRole!=='DOCTOR') return '<span class="queue-action queue-readonly">មិនមានសកម្មភាព</span>';
    if(item.transferredToIpdAt) return `<span class="transfer-ipd-done">បានបញ្ជូនទៅ IPD · ${esc(item.transferredToIpdWardNameKh||item.transferredToIpdWardCode||'')}</span>`;
    if(['OPD_PARACLINIC_ORDERING','PARACLINIC_REVIEW_PENDING'].includes(item.workflowStage)) return `<a class="queue-action" data-queue-number="${esc(item.number)}" href="/emr?patient=${encodeURIComponent(item.patientKey)}&view=opd-paraclinic">ពិនិត្យ Paraclinic</a><button type="button" class="queue-skip" data-patient="${esc(item.patientKey)}" data-queue-number="${esc(item.number)}">រំលង</button>`;
    if(item.workflowStage==='PARACLINIC_RESULTS_PENDING') return '<span class="queue-action queue-readonly">រង់ចាំលទ្ធផល Lab / Imaging</span>';
    if(['DOCTOR_READY','IN_CONSULTATION'].includes(item.workflowStage)) return `<a class="queue-action" data-queue-number="${esc(item.number)}" href="/emr?patient=${encodeURIComponent(item.patientKey)}&view=opd">បើកទម្រង់ OPD</a><button type="button" class="queue-skip" data-patient="${esc(item.patientKey)}" data-queue-number="${esc(item.number)}">រំលង</button>`;
    return '<span class="queue-action queue-readonly">រង់ចាំ Cashier</span>';
  }
  function render(){
    const query=$('queue-search').value.trim().toLocaleLowerCase();
    const shown=rows.filter(item=>!query||[item.fullName,item.caseNumber,item.healthId,String(item.number)].some(value=>String(value||'').toLocaleLowerCase().includes(query)));
    const late=skipped.filter(item=>!query||[item.fullName,item.caseNumber,item.healthId,String(item.queueNumber)].some(value=>String(value||'').toLocaleLowerCase().includes(query)));
    $('queue-count').textContent=`រង់ចាំ ${rows.filter(item=>item.status==='WAITING'&&!item.transferredToIpdAt).length} នាក់ · សរុប ${rows.length} នាក់`;
    $('queue-rows').innerHTML=shown.map(item=>`<tr><td><span class="queue-number">${esc(item.number)}</span></td><td class="queue-patient"><strong data-patient-value>${esc(item.fullName)}</strong></td><td>${esc(item.sex||'—')}</td><td>${esc(item.age||'—')}</td><td>${esc(item.phone||'—')}</td><td>${esc(item.healthId||'—')}</td><td>${esc(item.equityCard||'—')}</td><td>${esc(item.paymentType||'—')}</td><td>${esc(item.departmentNameKh||item.departmentCode||'OPD')}</td><td>${action(item)}</td></tr>`).join('')||'<tr><td colspan="10">មិនមានអ្នកជំងឺរង់ចាំ OPD ទេ។</td></tr>';
    if($('skipped-rows')) $('skipped-rows').innerHTML=late.map(item=>`<tr><td><span class="queue-number">${esc(item.queueNumber)}</span></td><td>${esc(new Date(item.skippedAt).toLocaleString())}</td><td class="queue-patient"><strong>${esc(item.fullName)}</strong></td><td>${esc(item.healthId||'—')}</td><td>${esc(item.sex||'—')}</td><td>${esc(item.age||'—')}</td><td>${esc(item.phone||'—')}</td><td>${esc(item.equityCard||'—')}</td><td>${esc(item.paymentType||'—')}</td><td>${esc(item.serviceMode||'OPD')}</td><td>${esc(item.departmentNameKh||item.departmentCode||'OPD')}</td><td><span class="queue-status WAITING">មកយឺត</span></td><td><a class="queue-action" data-queue-number="${esc(item.queueNumber)}" href="/emr?patient=${encodeURIComponent(item.patientKey)}&view=opd">ហៅ</a></td></tr>`).join('')||'<tr><td colspan="12">មិនមានអ្នកជំងឺមកយឺតទេ។</td></tr>';
  }
  async function load(){try{const response=await fetch(`/api/opd/queue?date=${encodeURIComponent($('queue-date').value)}&counter=${encodeURIComponent($('opd-counter').value)}`,{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'មិនអាចទាញបញ្ជីបាន');rows=data.patients||[];skipped=data.skipped||[];$('queue-status').textContent='';render();}catch(error){$('queue-status').textContent=error.message;}}
  async function callPatient(patientKey,queueNumber){const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());const response=await fetch('/api/queue/call',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify({service:'OPD',counter:$('opd-counter').value,patientKey,queueNumber})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Unable to call patient.');}
  async function skipPatient(patientKey,queueNumber){const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());const response=await fetch('/api/queue/skip',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify({service:'OPD',counter:$('opd-counter').value,patientKey,queueNumber})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Unable to skip patient.');}
  document.addEventListener('click',async event=>{
    const link=event.target.closest('a.queue-action');const skip=event.target.closest('button.queue-skip');
    if(link&&activeRole==='DOCTOR'){
      event.preventDefault();link.setAttribute('aria-disabled','true');
      try{const key=new URL(link.href).searchParams.get('patient');const item=[...rows,...skipped.map(x=>({patientKey:x.patientKey,number:x.queueNumber}))].find(row=>row.patientKey===key);await callPatient(key,Number(link.dataset.queueNumber||item?.number||0));window.location.assign(link.href);}catch(error){window.alert(error.message);link.removeAttribute('aria-disabled');}
    }
    if(skip&&activeRole==='DOCTOR'){
      skip.disabled=true;try{await skipPatient(skip.dataset.patient,Number(skip.dataset.queueNumber||0));await load();}catch(error){window.alert(error.message);skip.disabled=false;}
    }
  });
  const savedCounter=window.sessionStorage.getItem('borkeo-counter-number');if(savedCounter&&$('opd-counter').querySelector(`option[value="${savedCounter}"]`))$('opd-counter').value=savedCounter;
  $('opd-counter').onchange=()=>{window.sessionStorage.setItem('borkeo-counter-number',$('opd-counter').value);window.dispatchEvent(new CustomEvent('emr-counter-changed',{detail:$('opd-counter').value}));};
  window.addEventListener('emr-counter-changed',event=>{const counter=String(event.detail||'1');if($('opd-counter').querySelector(`option[value="${counter}"]`))$('opd-counter').value=counter;load();});
  $('queue-date').value=today();void loadSession().then(load);$('queue-date').onchange=load;$('queue-search').oninput=render;$('queue-refresh').onclick=load;setInterval(load,10000);
})();
