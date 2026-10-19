'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function when(ms){if(!ms)return '—';const d=new Date(Number(ms));return d.toLocaleDateString('km-KH')+' '+d.toLocaleTimeString('km-KH',{hour:'2-digit',minute:'2-digit'});}
  let waiting=[]; let completed=[]; let skipped=[];
  function filterRows(rows){const q=$('triage-search').value.trim().toLowerCase();return rows.filter(p=>!q||`${p.fullName} ${p.caseNumber} ${p.healthId}`.toLowerCase().includes(q));}
  function normalizeSexKh(s){
    const str=String(s??'').trim(), u=str.toUpperCase();
    if(u==='M'||u==='MALE'||u==='BOY'||str==='ប្រុស')return 'ប្រុស';
    if(u==='F'||u==='FEMALE'||u==='GIRL'||str==='ស្រី')return 'ស្រី';
    return str||'—';
  }
  function rowHtml(p,i,done){
    const action=done
      ? `<a class="triage-open triage-readonly" href="/emr?patient=${encodeURIComponent(p.patientKey)}&view=triage">មើលទ្រីយ៉ា</a>`
      : `<a class="triage-open" data-queue-number="${esc(p.queueNumber||i+1)}" href="/emr?patient=${encodeURIComponent(p.patientKey)}&view=triage">បំពេញទ្រីយ៉ា</a>`;
    return `<tr><td>${esc(p.queueNumber||i+1)}</td><td>${esc(when(p.registeredAt||p.createdAt||p.skippedAt))}</td><td class="patient-cell"><strong>${esc(p.fullName||'—')}</strong></td><td>${esc(p.healthId||p.caseNumber||'—')}</td><td>${esc(normalizeSexKh(p.sex))}</td><td>${esc(p.age||'—')}</td><td>${action}</td></tr>`;
  }
  function skippedRow(p){
    return `<tr><td>${esc(p.queueNumber)}</td><td>${esc(when(p.skippedAt))}</td><td class="patient-cell"><strong>${esc(p.fullName||'—')}</strong></td><td>${esc(p.healthId||p.caseNumber||'—')}</td><td>${esc(normalizeSexKh(p.sex))}</td><td>${esc(p.age||'—')}</td><td><a class="triage-open" data-queue-number="${esc(p.queueNumber)}" href="/emr?patient=${encodeURIComponent(p.patientKey)}&view=triage">បំពេញទ្រីយ៉ា</a></td></tr>`;
  }
  function render(){
    const a=filterRows(waiting), c=filterRows(skipped);
    $('triage-count').textContent=String(a.length);
    if($('triage-skipped-count')) $('triage-skipped-count').textContent=String(c.length);
    $('triage-body-waiting').innerHTML=a.map((p,i)=>rowHtml(p,i,false)).join('')||'<tr><td colspan="7" class="empty">មិនមានអ្នកជំងឺរង់ចាំទ្រីយ៉ាទេ។</td></tr>';
    if($('triage-body-skipped')) $('triage-body-skipped').innerHTML=c.map(skippedRow).join('')||'<tr><td colspan="7" class="empty">មិនមានអ្នកជំងឺបានរំលងទេ។</td></tr>';
  }
  function getCounter(){
    return window.sessionStorage.getItem('borkeo-counter-number') || window.emrCounterNumber || document.getElementById('session-counter')?.value || '1';
  }
  async function load(){
    try{
      $('triage-status').textContent='កំពុងទាញបញ្ជី…';
      const r=await fetch(`/api/triage/queue?counter=${encodeURIComponent(getCounter())}`,{credentials:'same-origin',cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'មិនអាចទាញបញ្ជីបានទេ។');
      waiting=d.waiting||d.patients||[]; completed=d.completed||[]; skipped=d.skipped||[];
      $('triage-status').textContent=''; render();
    }catch(e){$('triage-status').textContent=e.message;}
  }
  async function csrfToken(){return (await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json())).csrfToken;}
  async function callPatient(patientKey,queueNumber){
    const token=await csrfToken();
    const response=await fetch('/api/queue/call',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({service:'TRIAGE',counter:getCounter(),patientKey,queueNumber})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'Unable to call patient.');
  }
  async function skipPatient(patientKey,queueNumber){
    const token=await csrfToken();
    const response=await fetch('/api/queue/skip',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({service:'TRIAGE',counter:getCounter(),patientKey,queueNumber})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'Unable to skip patient.');
  }
  document.addEventListener('click', async event=>{
    const link=event.target.closest('a.triage-open:not(.triage-readonly)');
    const skip=event.target.closest('button.queue-skip');
    if(link){
      event.preventDefault(); link.setAttribute('aria-disabled','true');
      try{await callPatient(new URL(link.href).searchParams.get('patient'),Number(link.dataset.queueNumber||0)); window.location.assign(link.href);}
      catch(error){window.alert(error.message);link.removeAttribute('aria-disabled');}
    }
    if(skip){
      skip.disabled=true;
      try{await skipPatient(skip.dataset.patient,Number(skip.dataset.queueNumber||0));await load();}
      catch(error){window.alert(error.message);skip.disabled=false;}
    }
  });
  window.addEventListener('emr-counter-changed',()=>load());
  $('triage-search').addEventListener('input',render);$('triage-refresh').addEventListener('click',load);load();setInterval(load,10000);
})();
