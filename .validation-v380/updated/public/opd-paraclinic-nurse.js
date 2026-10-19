'use strict';

(function opdNurseHandoffs(){
  const list=document.getElementById('handoff-list');
  const status=document.getElementById('queue-status');
  const count=document.getElementById('queue-count');
  let csrf='';
  let busy=false;
  let started=false;
  let timer=0;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const modalityName=order=>order.modality==='LAB'?'Laboratory':order.modality==='XRAY'?'X-ray':order.modality==='CT'?'CT':order.modality==='MRI'?'MRI':'Ultrasound';
  function details(order){
    const request=order.request||{};
    if(order.modality==='LAB')return (request.items||[]).map(item=>esc(item.code)+(item.urgent?' · Urgent':'')).join(', ')||'Laboratory tests';
    return [request.examination,request.clinicalIndication,request.question&&`Question: ${request.question}`].filter(Boolean).map(esc).join('\n')||'Imaging request';
  }
  function nextAction(order){
    const stage=order.request?.opdHandoff?.stage;
    if(stage==='WAITING_NURSE'&&order.modality==='LAB')return ['COLLECT','ប្រមូលសំណាក'];
    if(stage==='WAITING_NURSE')return ['SEND','បញ្ជូនទៅរូបភាពវេជ្ជសាស្ត្រ'];
    if(stage==='NURSE_RECEIVED'&&order.modality==='LAB')return ['COLLECT','Mark sample collected'];
    if(stage==='NURSE_RECEIVED')return ['SEND','Send request to Imaging'];
    if(stage==='SAMPLE_COLLECTED')return ['SEND','បញ្ជូនសំណាកទៅមន្ទីរពិសោធន៍'];
    return ['', 'Waiting'];
  }
  function render(items){
    count.textContent=`${items.length} request${items.length===1?'':'s'} waiting for OPD nurse`;
    if(!items.length){list.innerHTML='<div class="empty-queue"><strong>No paraclinic handoffs are waiting.</strong><p>New OPD doctor requests routed to the nurse will appear here.</p></div>';return;}
    list.innerHTML=items.map(({order,patient})=>{
      const [action,label]=nextAction(order);
      const charge=String(order.request?.chargeMode||'PAID').toUpperCase();
      return `<article class="handoff-card" data-order="${esc(order.id)}"><div class="handoff-card-head"><div><h2>${esc(patient.fullName||patient.caseNumber||'Patient')} <small>· ${esc(modalityName(order))}</small></h2><small>${esc(order.accessionNumber)} · ${new Date(order.createdAt).toLocaleString()}</small></div><div class="handoff-tags"><span class="handoff-tag">${esc(order.modality==='LAB'?'Collect sample':'Coordinate imaging')}</span><span class="handoff-tag ${charge==='FREE'?'free':'paid'}">${charge==='FREE'?'Free of charge':'Paid or cleared'}</span>${order.priority==='URGENT'?'<span class="handoff-tag urgent">Urgent</span>':''}</div></div><div class="handoff-patient"><span><small>Case number</small>${esc(patient.caseNumber||'—')}</span><span><small>Health ID</small>${esc(patient.healthId||'—')}</span><span><small>Sex</small>${esc(patient.sex||'—')}</span><span><small>Age</small>${esc(patient.age||'—')}</span></div><div class="handoff-detail">${details(order)}</div><div class="handoff-next"><p>${order.modality==='LAB'?'Collect the specimen, then send it to Laboratory.':'Coordinate the Imaging visit and send the request to Imaging.'}</p><button class="handoff-action" type="button" data-action="${action}" data-id="${esc(order.id)}" ${busy?'disabled':''}>${label}</button></div></article>`;
    }).join('');
  }
  async function load(){
    try{
      const response=await fetch('/api/opd/nurse-paraclinic-orders',{credentials:'same-origin',cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Unable to load OPD handoffs.');
      status.classList.remove('error');status.textContent=`Updated ${new Date().toLocaleTimeString()}`;render(data.orders||[]);
    }catch(error){status.classList.add('error');status.textContent=error.message;}
  }
  async function act(button){
    if(busy)return;
    busy=true;list.querySelectorAll('button').forEach(item=>item.disabled=true);
    try{
      const response=await fetch(`/api/opd/nurse-paraclinic-orders/${encodeURIComponent(button.dataset.id)}/action`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({action:button.dataset.action})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Unable to update this handoff.');
      status.classList.remove('error');
      status.textContent=data.stage==='SENT_TO_DEPARTMENT'?'Sent to Laboratory or Imaging.':`Request updated: ${data.stage.replaceAll('_',' ').toLowerCase()}.`;
      await load();
    }catch(error){status.classList.add('error');status.textContent=error.message;}
    finally{busy=false;list.querySelectorAll('button').forEach(item=>item.disabled=false);}
  }
  document.getElementById('refresh-queue').addEventListener('click',()=>void load());
  list.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button)void act(button);});
  function initialize(user){
    if(started)return;
    if(user?.activeRole!=='NURSE'||user?.activeWard?.code!=='opd'){status.classList.add('error');status.textContent='Sign in with an OPD nurse account to use this queue.';list.replaceChildren();count.textContent='Access unavailable';return;}
    started=true;
    void fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(response=>response.json()).then(me=>{csrf=me.csrfToken||'';void load();timer=window.setInterval(()=>{if(!document.hidden)load();},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});});
  }
  window.addEventListener('emr-session-ready',event=>initialize(event.detail?.user));
  if(window.emrSession?.user)initialize(window.emrSession.user);
})();
