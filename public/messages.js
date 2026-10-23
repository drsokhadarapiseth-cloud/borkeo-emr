'use strict';
(function(){
  const allowedRoles=new Set(['ADMIN','VICE_DIRECTOR','DIRECTOR','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','CLERK','ACCOUNTANT','LAB','IMAGING','PHARMACY']);
  let csrf='';let user=null;let inbox=[];let destinations=[];let history=false;let pendingCount=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanWardText=v=>String(v??'').replace(/វូដ|វួដ/g,'ផ្នែក');
  const isWardMedicineReady=m=>/^បញ្ជីឱសថ(?:ផ្នែក|វួដ)រួចរាល់ · [^·]+ · \d{4}-\d{2}-\d{2}$/.test(String(m?.subject||''));
  async function api(url,options={}){options.credentials='same-origin';options.headers={...(options.headers||{}),...(options.method&&options.method!=='GET'?{'X-CSRF-Token':csrf}:{})};const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'សំណើមិនបានជោគជ័យ');return d}
  function destinationLabel(m){if(m.destinationType==='PHARMACY')return 'ឱសថស្ថាន';if(m.destinationType==='LAB')return 'មន្ទីរពិសោធន៍';if(m.destinationType==='IMAGING')return 'រូបភាពវេជ្ជសាស្ត្រ';if(m.destinationType==='ADMIN')return 'អ្នកគ្រប់គ្រងប្រព័ន្ធ';if(m.destinationType==='DIRECTOR')return 'នាយកមន្ទីរពេទ្យ';const d=destinations.find(x=>x.type==='WARD'&&x.code===m.destinationCode);return d?(d.nameKh||d.nameEn):m.destinationCode}
  function sourceLabel(m){if(m.senderWardCode){const d=destinations.find(x=>x.type==='WARD'&&x.code===m.senderWardCode);return d?.nameKh||d?.nameEn||m.senderWardCode}return ({ADMIN:'អ្នកគ្រប់គ្រងប្រព័ន្ធ',DIRECTOR:'នាយកមន្ទីរពេទ្យ',REGISTRATION:'ចុះឈ្មោះ',TRIAGE:'ផ្នែកទ្រីយ៉ា',DOCTOR:'វេជ្ជបណ្ឌិត',NURSE:'គិលានុបដ្ឋាក',MIDWIFE:'ឆ្មប',CHIEF_WARD:'ប្រធានផ្នែក',PHARMACY:'ឱសថស្ថាន',LAB:'មន្ទីរពិសោធន៍',IMAGING:'រូបភាពវេជ្ជសាស្ត្រ'}[m.senderRole]||'បុគ្គលិក')}
  function roleTargetLabel(role){return ({DOCTOR:'វេជ្ជបណ្ឌិត',NURSE:'គិលានុបដ្ឋាក',MIDWIFE:'ឆ្មប',CHIEF_WARD:'ប្រធានផ្នែក'}[String(role||'').toUpperCase()]||'')}
  function activeWardLabel(){const code=user?.activeWard?.code||'';const d=destinations.find(x=>x.type==='WARD'&&x.code===code);return d?.nameKh||user?.activeWard?.nameKh||user?.activeWard?.nameEn||code}
  function inboxScopeText(){
    if(['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(user?.activeRole))return 'សាររួមសម្រាប់អ្នកគ្រប់គ្រង និងនាយក';
    if(user?.activeRole==='PHARMACY')return 'វេជ្ជបញ្ជា និងសារដែលផ្ញើមកឱសថស្ថាន';
    if(user?.activeRole==='LAB')return 'បង្ហាញតែសារដែលផ្ញើមកមន្ទីរពិសោធន៍';
    if(user?.activeRole==='IMAGING')return 'បង្ហាញតែសារដែលផ្ញើមកផ្នែករូបភាពវេជ្ជសាស្ត្រ';
    const ward=activeWardLabel();
    return ward?`បង្ហាញតែសារដែលផ្ញើមក ${ward}`:'បង្ហាញតែសារដែលផ្ញើមកតួនាទីរបស់អ្នក';
  }
  function fmt(t){return t?new Date(t).toLocaleString():''}
  function ensureStyles(){if(document.querySelector('link[data-emr-messages]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='/public/messages.css?v=1850';l.dataset.emrMessages='1';document.head.append(l)}
  function dialog(title,content){const overlay=document.createElement('div');overlay.className='emr-message-overlay';overlay.innerHTML=`<section class="emr-message-dialog"><header><h2>${esc(title)}</h2><button type="button" data-close>×</button></header><div class="emr-message-body">${content}</div></section>`;document.body.append(overlay);const close=()=>overlay.remove();overlay.querySelector('[data-close]').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};return overlay}
  async function markRead(message){if(message.readAt)return;try{const d=await api(`/api/messages/${message.id}/read`,{method:'POST'});message.readAt=d.readAt;render()}catch{}}
  function patientActionForMessage(message){
    if(!message.patientKey && !isWardMedicineReady(message))return '';
    const role=String(user?.activeRole||'').toUpperCase();
    if(role==='PHARMACY'&&isWardMedicineReady(message)){
      const match=message.subject.match(/^បញ្ជីឱសថ(?:ផ្នែក|វួដ)រួចរាល់ · ([^·]+) · (\d{4}-\d{2}-\d{2})$/);
      if(match){const ward=match[1].trim();const date=match[2];const params=new URLSearchParams({ward,date});return `<div class="emr-message-patient-action"><a href="/ward-medicines?${esc(params.toString())}">បើកបញ្ជីឱសថ</a></div>`;}
    }
    if(role==='PHARMACY'&&message.subject?.startsWith('អ្នកជំងឺថ្មីក្នុងបញ្ជីឱសថ · ')){
      const date=message.subject.match(/ · (\d{4}-\d{2}-\d{2})$/)?.[1];
      if(date&&message.senderWardCode){
        const params=new URLSearchParams({ward:message.senderWardCode,date});
        return `<div class="emr-message-patient-action"><a href="/ward-medicines?${esc(params.toString())}">បើកបញ្ជីឱសថ</a></div>`;
      }
    }
    const params=new URLSearchParams({patient:message.patientKey});
    let label='';
    if(role==='DOCTOR'){params.set('view',user?.activeWard?.code==='opd'?'opd':'medical');label='បើកកំណត់ត្រាវេជ្ជសាស្ត្រ'}
    else if(role==='NURSE'||role==='MIDWIFE'){
      params.set('view','nursing');
      const ward=String(user?.activeWard?.code||'').toLowerCase();
      params.set('care',role==='MIDWIFE'||ward==='obstetric'?'obstetric':'nurse');
      label=role==='MIDWIFE'?'បើកដំណើរការថែទាំឆ្មប':'បើកដំណើរការថែទាំ';
    }
    if(!label)return '';
    const queueLink=role==='DOCTOR' && user?.activeWard?.code==='opd' && message.destinationCode==='opd'
      ? '<a href="/opd-queue">បើកបញ្ជីរង់ចាំ OPD</a>' : '';
    return `<div class="emr-message-patient-action"><a href="/emr?${esc(params.toString())}">${esc(label)}</a>${queueLink}</div>`;
  }
  function isOpdReferral(message){return message.destinationType==='WARD'&&message.destinationCode==='opd'&&message.patientKey&&message.subject?.startsWith('OPD · លេខរៀង ')}
  function wardAssignmentUrl(message){
    const role=String(user?.activeRole||'').toUpperCase();
    const subject=String(message.subject||'');
    const body=String(message.body||'');
    const isAdmissionAlert=/^(New patient transferred from OPD|អ្នកជំងឺថ្មី|មានអ្នកជំងឺថ្មីពីតម្រៀប)/.test(subject)||/អ្នកជំងឺឈ្មោះ.*ត្រូវបានបញ្ជូន/.test(subject)||/អ្នកជំងឺឈ្មោះ.*ត្រូវបានបញ្ជូន/.test(body);
    if(!['NURSE','MIDWIFE'].includes(role)||!isAdmissionAlert||message.destinationType!=='WARD'||!message.patientKey)return '';
    const ward=String(user?.activeWard?.code||message.destinationCode||'').toLowerCase();
    if(message.destinationCode&&ward&&message.destinationCode!==ward)return '';
    return `/departments?${new URLSearchParams({ward,patient:message.patientKey,assignBed:'1'}).toString()}`;
  }
  function openMessage(message){window.emrNotifications?.close();const role=String(user?.activeRole||'').toUpperCase();const assignmentUrl=wardAssignmentUrl(message);if(assignmentUrl){void markRead(message).then(()=>{window.location.assign(assignmentUrl)});return;}if(isOpdReferral(message)){if(role==='TRIAGE'){openMessageDetail(message);return;}void markRead(message).then(()=>{window.location.assign(`/emr?patient=${encodeURIComponent(message.patientKey)}&view=opd`)});return;}if(message.prescriptionId){void openPrescription(message);return;}openMessageDetail(message)}
  function openMessageDetail(message){
    markRead(message);
    const links=(message.attachments||[]).map(a=>`<a target="_blank" href="/api/messages/attachments/${a.id}">📎 ${esc(a.filename)}</a>`).join('');
    const p=message.patientKey?`<p><strong>អ្នកជំងឺ:</strong> ${esc(message.patientKey)}</p>`:'';
    const completion=message.completedAt?`<p>${esc(message.completedByName)} · ${esc(fmt(message.completedAt))}</p>`:'<button type="button" data-complete>បញ្ចប់ការងារ</button><p data-complete-status></p>';
    const overlay=dialog('សារជូនដំណឹង',`<div class="emr-message-detail-meta">ពី ${esc(message.senderName)} · ${esc(sourceLabel(message))}<br>ទៅ ${esc(destinationLabel(message))} · ${esc(fmt(message.createdAt))}</div>${p}<div class="emr-message-detail-text" style="font-size:15px;line-height:1.6;font-weight:500;">${esc(cleanWardText(message.body || message.subject))}</div>${links?`<div class="emr-message-attachments">${links}</div>`:''}${patientActionForMessage(message)}${completion}<form data-reply class="emr-message-compose"><label>ឆ្លើយតបទៅផ្នែក / Reply<textarea name="body" required maxlength="5000"></textarea></label><button type="submit">ផ្ញើការឆ្លើយតប / Send reply</button><p data-reply-status role="status"></p></form>`);
    const reply=overlay.querySelector('[data-reply]');
    reply.onsubmit=async event=>{event.preventDefault();const send=reply.querySelector('button');send.disabled=true;try{await api(`/api/messages/${message.id}/reply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:reply.elements.body.value})});reply.reset();reply.querySelector('[data-reply-status]').textContent='បានផ្ញើការឆ្លើយតប';}catch(error){reply.querySelector('[data-reply-status]').textContent=error.message;}finally{send.disabled=false;}};
    const button=overlay.querySelector('[data-complete]');
    if(button)button.onclick=async()=>{button.disabled=true;try{await api(`/api/messages/${message.id}/complete`,{method:'POST'});overlay.remove();await refresh()}catch(error){overlay.querySelector('[data-complete-status]').textContent=error.message;button.disabled=false}};
  }

  async function openPrescription(message){
    const overlay=dialog('វេជ្ជបញ្ជា OPD','<p>កំពុងទាញវេជ្ជបញ្ជា…</p>');
    overlay.querySelector('.emr-message-dialog').classList.add('pharmacy-prescription-dialog');
    const dialogBox=overlay.querySelector('.emr-message-dialog');
    const content=overlay.querySelector('.emr-message-body');
    const actions=document.createElement('footer');
    actions.className='pharmacy-prescription-actions';
    actions.innerHTML='<label><input id="message-received-checkbox" type="checkbox"> បានផ្ដល់ថ្នាំរួចរាល់</label><span id="message-prescription-status" role="status"></span>';
    dialogBox.appendChild(actions);
    const checkbox=actions.querySelector('#message-received-checkbox');
    const status=actions.querySelector('#message-prescription-status');
    try{
      const {prescription:p}=await api(`/api/messages/${message.id}/prescription`);
      // v42.5: the same route labels as the prescription forms (public/medication-routes.js).
      const routes=Object.fromEntries((window.BorkeoMedicationRoutes?.definitions()||[]).map(route=>[route.value,route.khmer]));
      const medicines=p.medications.map((medicine,index)=>`<tr><td>${index+1}</td><td>${esc(medicine.name)}</td><td>${esc(routes[medicine.route]||medicine.route||'—')}</td><td>${esc(medicine.doseAmount||'—')} ${esc(medicine.unit||'')}</td><td>${esc((medicine.scheduleType||'—').toUpperCase())}</td><td>${[medicine.m,medicine.a,medicine.e,medicine.n].map(value=>esc(value||'0')).join(' - ')}</td><td>${esc(medicine.d||'—')}</td><td>${esc(medicine.total||'—')}</td><td>${esc(medicine.note||'—')}</td></tr>`).join('');
      const signature=/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.prescriber?.signatureDataUrl||'')
        ? `<img class="rx-signature" src="${esc(p.prescriber.signatureDataUrl)}" alt="ហត្ថលេខាវេជ្ជបណ្ឌិត">` : '';
      content.innerHTML=`${p.superseded?'<p class="superseded-note">មានវេជ្ជបញ្ជាថ្មីជំនួស។ សូមបើកវេជ្ជបញ្ជាចុងក្រោយ។</p>':''}
        <div class="prescription-meta"><strong>${esc(p.patient.fullName)}</strong> · ${esc(p.patient.healthId||p.patient.caseNumber||'—')}<br>វេជ្ជបណ្ឌិត៖ ${esc(p.prescriber?.signerName||p.prescriber?.displayName||'—')} · ${esc(new Date(p.submittedAt).toLocaleString())}${signature}</div>
        <div class="rx-wrap"><table class="pharmacy-prescription-table"><thead><tr><th>ល.រ.</th><th>ឱសថ</th><th>របៀបប្រើ</th><th>កម្រិត</th><th>ប្រេកង់</th><th>ព្រឹក - ថ្ងៃ - ល្ងាច - យប់</th><th>ថ្ងៃ</th><th>សរុប</th><th>សម្គាល់</th></tr></thead><tbody>${medicines}</tbody></table></div>`;
      const canConfirm=user?.activeRole==='PHARMACY' && !p.dispensedAt && !p.superseded;
      actions.hidden=!canConfirm;
      checkbox.checked=false;
      checkbox.disabled=!canConfirm;
      await markRead(message);
      checkbox.onchange=async()=>{
        if(!checkbox.checked||!canConfirm)return;
        checkbox.disabled=true;
        status.textContent='កំពុងរក្សាទុក…';
        try{
          await api(`/api/pharmacy/opd-prescriptions/${encodeURIComponent(p.id)}/received`,{method:'POST'});
          overlay.remove();
          await refresh();
        }catch(error){
          status.textContent=error.message;
          checkbox.disabled=false;
          checkbox.checked=false;
        }
      };
    }catch(error){content.textContent=error.message;actions.hidden=true;}
  }

  function render(){const host=document.getElementById('emr-message-center');if(!host)return;const direct=['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(user?.activeRole);const shown=inbox;const unread=shown.filter(m=>!m.readAt).length;window.emrNotifications?.setCount('messages',pendingCount);const adminSummary=host.querySelector('[data-admin-summary]');if(adminSummary)adminSummary.textContent=unread?`${unread} សារមិនទាន់អាន`:`${shown.length} សារផ្ទាល់`;const scope=host.querySelector('[data-scope]');if(scope)scope.textContent=inboxScopeText();const list=host.querySelector('[data-list]');list.innerHTML=shown.map(m=>`<article class="emr-message-row ${m.readAt?'':'unread'}" data-id="${m.id}" role="button" tabindex="0"><div class="emr-message-route"><span class="emr-message-source">ពី៖ ${esc(cleanWardText(sourceLabel(m)))}</span>${direct?`<span class="emr-message-destination">ទៅ៖ ${esc(cleanWardText(destinationLabel(m)))}</span>`:''}${m.destinationRole?`<span class="emr-message-role-target">សម្រាប់៖ ${esc(roleTargetLabel(m.destinationRole))}</span>`:''}</div><div><span class="emr-message-body-text" style="font-size:14px;font-weight:500;line-height:1.5;display:block;">${esc(cleanWardText(m.body || m.subject))}</span></div><small>${esc(fmt(m.createdAt))}${m.completedAt?`<br>${esc(m.completedByName)} · ${esc(fmt(m.completedAt))}`:''}</small></article>`).join('')||'<div class="emr-message-empty">មិនមានសារផ្ទាល់នៅឡើយទេ។</div>';list.querySelectorAll('[data-id]').forEach(row=>{row.onclick=()=>{const m=inbox.find(x=>x.id===row.dataset.id);if(m)openMessage(m)};row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();row.click();}};});
  }
  async function refresh(){try{const direct=['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(user?.activeRole);const messages=await api(`/api/messages?box=${direct?'direct':'inbox'}&limit=100&state=${history?'completed':'pending'}`);inbox=messages.messages||[];pendingCount=Number(messages.pendingCount)||0;render()}catch(e){console.warn(e)}}
  function compose(){window.emrNotifications?.close();const opts=destinations.map(d=>`<option value="${esc(d.type)}:${esc(d.code||'')}">${d.type==='WARD'?'ផ្នែក៖ ':''}${esc(d.nameKh||d.nameEn)}</option>`).join('');const currentPatient=new URLSearchParams(location.search).get('patient')||'';const overlay=dialog('ផ្ញើសារ',`<form class="emr-message-compose"><label>ផ្ញើទៅ<select name="destination" required>${opts}</select></label><label>ចំណងជើង<input name="subject" maxlength="180" required></label><label>សារ<textarea name="body" maxlength="5000" required></textarea></label><label>លេខបណ្ណសុខភាព (បើមាន)<input name="patientKey" value="${esc(currentPatient)}" maxlength="220"></label><label>ឯកសារភ្ជាប់<input name="files" type="file" multiple accept="application/pdf,image/jpeg,image/png,text/plain,.doc,.docx"></label><div class="emr-message-status" data-status></div><button type="submit">ផ្ញើសារ</button></form>`);const form=overlay.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const status=form.querySelector('[data-status]');status.textContent='';const [destinationType,destinationCode='']=form.elements.destination.value.split(':');const button=form.querySelector('button[type=submit]');button.disabled=true;try{const d=await api('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destinationType,destinationCode,subject:form.elements.subject.value,body:form.elements.body.value,patientKey:form.elements.patientKey.value})});for(const file of [...form.elements.files.files]){const r=await fetch(`/api/messages/${d.message.id}/attachments`,{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf,'X-File-Name':file.name,'Content-Type':file.type||'application/octet-stream'},body:file});if(!r.ok){const x=await r.json().catch(()=>({}));throw new Error(x.error||'បញ្ចូលឯកសារភ្ជាប់មិនបានជោគជ័យ')}}overlay.remove();await refresh()}catch(err){status.textContent=err.message;button.disabled=false}}}
  function build(){
    if(document.getElementById('emr-message-center'))return;
    if(!window.emrNotifications)return;
    ensureStyles();const direct=['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(user?.activeRole);
    const panel=document.createElement('section');panel.id='emr-message-center';panel.className='emr-message-center no-print';
    panel.innerHTML=`<header class="emr-message-head"><div><h2>${direct?'សារពីផ្នែកទៅអ្នកគ្រប់គ្រង និងនាយក':'សារ'}</h2><small data-scope>${esc(inboxScopeText())}</small></div><div class="emr-message-actions"><button type="button" data-history>ប្រវត្តិការបញ្ចប់</button><button type="button" data-refresh>ធ្វើបច្ចុប្បន្នភាព</button><button type="button" class="primary" data-compose>+ ផ្ញើសារ</button></div></header><div class="emr-message-list" data-list></div>`;
    window.emrNotifications.register('messages',panel,refresh);
    panel.querySelector('[data-refresh]').onclick=refresh;
    panel.querySelector('[data-history]').onclick=()=>{history=!history;panel.querySelector('[data-history]').textContent=history?'សាររង់ចាំ':'ប្រវត្តិការបញ្ចប់';void refresh()};
    panel.querySelector('[data-compose]').onclick=compose;
    void refresh();setInterval(()=>{if(!document.hidden)void refresh()},15000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});window.addEventListener('emr-messages-changed',refresh);
  }
  async function init(session){user=session?.user;if(!user||!allowedRoles.has(user.activeRole))return;csrf=session.csrfToken;try{destinations=(await api('/api/messages/destinations')).destinations||[]}catch{return}build()}
  if(window.emrSession)init(window.emrSession);window.addEventListener('emr-session-ready',e=>init(e.detail));
})();
