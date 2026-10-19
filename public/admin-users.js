'use strict';
(function(){
  let csrf='';let users=[];let roles=[];let wards=[];let auditEvents=[];let signatures=[];let demoMode=false;let readOnly=false;
  let imagingSubtypesList=[];let imagingSubtypeDetailsList=[];let imagingGroupsList=[];
  const ALL_IMAGING_SUBTYPES = [
    { code: 'ULTRASOUND', nameKh: 'អេកូសាស្ត្រ', nameEn: 'Ultrasound' },
    { code: 'XRAY', nameKh: 'កាំរស្មីអ៊ិច', nameEn: 'X-Ray' },
    { code: 'ECG', nameKh: 'វាស់ចង្វាក់បេះដូង (ECG)', nameEn: 'ECG' },
    { code: 'CT', nameKh: 'ស៊ីធីស្កេន (CT)', nameEn: 'CT Scan' },
    { code: 'MRI', nameKh: 'អឹមអរអាយ (MRI)', nameEn: 'MRI' },
    { code: 'ECHOCARDIOLOGY', nameKh: 'អេកូបេះដូង', nameEn: 'Echocardiology' },
    { code: 'EEG', nameKh: 'វាស់រលកខួរក្បាល (EEG)', nameEn: 'EEG' },
    { code: 'FIBROSCOPY', nameKh: 'ឆ្លុះក្រពះពោះវៀន', nameEn: 'Fibroscopy' },
    { code: 'COLOSCOPY', nameKh: 'ឆ្លុះពោះវៀនធំ', nameEn: 'Colonoscopy' },
    { code: 'OTOSCOPY', nameKh: 'ឆ្លុះត្រចៀក', nameEn: 'Otoscopy' },
    { code: 'RHINOSCOPY', nameKh: 'ឆ្លុះច្រមុះ', nameEn: 'Rhinoscopy' },
    { code: 'LARYNGOSCOPY', nameKh: 'ឆ្លុះបំពង់សំឡេង', nameEn: 'Laryngoscopy' },
    { code: 'BRONCHOSCOPY', nameKh: 'ឆ្លុះទងសួត', nameEn: 'Bronchoscopy' },
  ];

  const el=id=>document.getElementById(id);const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let labels={ADMIN:'អ្នកគ្រប់គ្រងប្រព័ន្ធ',REGISTRATION:'ចុះឈ្មោះ',TRIAGE:'ផ្នែកទ្រីយ៉ា',DOCTOR:'វេជ្ជបណ្ឌិត',NURSE:'គិលានុបដ្ឋាក',MIDWIFE:'ឆ្មប',LAB:'មន្ទីរពិសោធន៍',IMAGING:'រូបភាពវេជ្ជសាស្ត្រ',PHARMACY:'ឱសថស្ថាន',ACCOUNTANT:'គណនេយ្យករ',CLERK:'បេឡា',DIRECTOR:'នាយកមន្ទីរពេទ្យ',VICE_DIRECTOR:'អនុប្រធានមន្ទីរពេទ្យ',CHIEF_WARD:'ប្រធានផ្នែក',WARD_HEAD:'នាយសាល'};
  function status(text,ok=false){el('form-status').textContent=text||'';el('form-status').className='status'+(ok?' ok':'')}
  async function api(url,options={}){options.credentials='same-origin';options.headers={...(options.headers||{}),...(options.method&&options.method!=='GET'?{'X-CSRF-Token':csrf}:{})};const r=await fetch(url,options);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'សំណើមិនបានជោគជ័យ');return j}
  
  function renderImagingSubtypes(checkedSubtypes = []){
    const container = el('imaging-groups-container');
    if (!container) return;
    const checkedSet = new Set(Array.isArray(checkedSubtypes) ? checkedSubtypes : []);
    const items = (imagingSubtypeDetailsList && imagingSubtypeDetailsList.length) ? imagingSubtypeDetailsList : ALL_IMAGING_SUBTYPES;
    container.innerHTML = `
      <div class="direct-modality-grid">
        ${items.map(st => `
          <label class="modality-item-card">
            <input type="checkbox" name="imagingSubtypes" value="${escape(st.code)}" ${checkedSet.has(st.code) ? 'checked' : ''}>
            <span class="modality-title">${escape(st.nameKh)}</span>
            <small class="modality-en">(${escape(st.nameEn || st.code)})</small>
          </label>
        `).join('')}
      </div>
    `;
  }

  function renderOptions(selectedRole='',selectedWard=''){
    const currentCheckedRoles=new Set([...document.querySelectorAll('[name=roles]:checked')].map(x=>x.value));
    if(selectedRole)currentCheckedRoles.add(selectedRole);
    el('role-options').innerHTML=roles.map(r=>{
      const isImaging = r === 'IMAGING';
      const roleHtml = `<label><input type="checkbox" name="roles" value="${r}" ${currentCheckedRoles.has(r)?'checked':''}> ${labels[r]||r}</label>`;
      if (!isImaging) return roleHtml;
      return `${roleHtml}
      <div id="imaging-subtypes-nested" class="nested-subtypes-panel" ${currentCheckedRoles.has('IMAGING')?'':'hidden'}>
        <div class="nested-subtypes-head">
          <span>ឯកទេសរូបភាពវេជ្ជសាស្ត្រ និងរោគវិនិច្ឆ័យ (Specialist Branches)</span>
          <button type="button" id="btn-toggle-all-subtypes" class="btn-subtle">ជ្រើសរើសទាំងអស់</button>
        </div>
        <div id="imaging-groups-container" class="imaging-groups-list"></div>
      </div>`;
    }).join('');
    
    const currentCheckedWards=new Set([...document.querySelectorAll('[name=wards]:checked')].map(x=>x.value));
    if(selectedWard)currentCheckedWards.add(selectedWard);
    el('ward-options').innerHTML=wards.map(w=>`<label><input type="checkbox" name="wards" value="${escape(w.code)}" ${currentCheckedWards.has(w.code)?'checked':''}> ${escape(w.nameKh||w.nameEn||w.code)}</label>`).join('');

    const imagingCheckbox = document.querySelector('[name=roles][value=IMAGING]');
    const nestedPanel = el('imaging-subtypes-nested');
    if (imagingCheckbox && nestedPanel) {
      imagingCheckbox.addEventListener('change', () => {
        nestedPanel.hidden = !imagingCheckbox.checked;
      });
    }
    renderImagingSubtypes();
    bindToggleAllSubtypes();
  }

  function bindToggleAllSubtypes(){
    el('btn-toggle-all-subtypes')?.addEventListener('click', () => {
      const boxes = document.querySelectorAll('[name=imagingSubtypes]');
      const allChecked = [...boxes].every(b => b.checked);
      boxes.forEach(b => b.checked = !allChecked);
    });
  }
  function renderUsers(){const q=el('user-search').value.trim().toLowerCase();el('users-list').innerHTML=users.filter(u=>!q||`${u.displayName} ${u.username}`.toLowerCase().includes(q)).map(u=>`<article class="user-card ${u.isActive?'':'inactive'}"><div><h3>${escape(u.displayName)} <small>@${escape(u.username)}</small></h3><div class="meta">${u.isActive?'សកម្ម':'បិទប្រើ'}${u.lastLoginAt?` · ចូលប្រើចុងក្រោយ ${new Date(u.lastLoginAt).toLocaleString()}`:''}</div><div class="chips">${u.roles.map(r=>`<span class="chip">${escape(labels[r]||r)}</span>`).join('')}${u.wards.map(w=>`<span class="chip">${escape(w)}</span>`).join('')}</div></div>${readOnly?'':`<div class="user-actions"><button data-edit="${u.id}" class="secondary">កែប្រែ</button>${demoMode?'':`<button data-reset="${u.id}" class="secondary">កំណត់ពាក្យសម្ងាត់ថ្មី</button>`}</div>`}</article>`).join('')||'<p>រកមិនឃើញគណនីទេ។</p>'}

  function renderAudit(){const box=el('audit-list');if(!box)return;box.innerHTML=auditEvents.map(event=>{const d=event.details||{};const context=[d.activeRole,d.activeWard].filter(Boolean).join(' • ');const actor=event.actorName||event.actorUsername||'ប្រព័ន្ធ';return `<article class="audit-row"><div><strong>${escape(event.action)}</strong><small>${escape(actor)}${context?` · ${escape(context)}`:''}${event.subjectUsername?` · គណនី @${escape(event.subjectUsername)}`:''}</small></div><time>${new Date(event.occurredAt).toLocaleString()}</time></article>`}).join('')||'<p>មិនទាន់មានកំណត់ហេតុសកម្មភាពទេ។</p>'}
  async function loadAudit(){try{const data=await api('/api/admin/audit');auditEvents=data.events||[];renderAudit()}catch(err){const box=el('audit-list');if(box)box.textContent=err.message}}

  function signatureFor(userId){return signatures.find(item=>item.userId===userId)||null}
  function renderESignatures(){const body=el('esign-list');if(!body)return;body.innerHTML=users.map(u=>{const s=signatureFor(u.id);const rolesText=(u.roles||[]).map(r=>labels[r]||r).join(' • ');return `<tr><td><strong>${escape(u.displayName)}</strong></td><td>@${escape(u.username)}</td><td>${escape(rolesText||'—')}</td><td>${s?.hasSignature?`<img class="esign-preview" src="${escape(s.signatureDataUrl)}" alt="ហត្ថលេខា ${escape(s.signerName||u.displayName)}">`:'<span class="esign-empty">មិនទាន់មាន</span>'}</td><td>${s?.hasSignature?`<span class="esign-ready">បានកំណត់</span><small>${s.updatedAt?new Date(s.updatedAt).toLocaleString():''}</small>`:'<span class="esign-missing">មិនទាន់កំណត់</span>'}</td><td><button type="button" class="secondary" data-esign="${u.id}">${s?.hasSignature?'កែហត្ថលេខា':'បង្កើតហត្ថលេខា'}</button></td></tr>`}).join('')}
  async function loadESignatures(){const data=await api('/api/admin/esignatures');signatures=data.signatures||[];renderESignatures()}

  function openESignEditor(userId){const user=users.find(item=>item.id===userId);if(!user)return;const existing=signatureFor(userId);const overlay=document.createElement('div');overlay.className='esign-overlay';overlay.innerHTML=`<section class="esign-dialog"><header><div><h2>ហត្ថលេខាអេឡិចត្រូនិក</h2><p>${escape(user.displayName)} · @${escape(user.username)}</p></div><button type="button" data-close>×</button></header><label>ឈ្មោះបង្ហាញជាមួយហត្ថលេខា<input data-signer-name maxlength="120" value="${escape(existing?.signerName||user.displayName)}"></label><div class="esign-canvas-wrap"><canvas width="560" height="150" aria-label="ផ្ទាំងគូរហត្ថលេខា"></canvas></div><div class="esign-editor-actions"><button type="button" class="secondary" data-name-sign>បង្កើតពីឈ្មោះ</button><button type="button" class="secondary" data-clear-sign>សម្អាត</button><button type="button" class="primary" data-save-sign>រក្សាទុកហត្ថលេខា</button></div><p class="esign-help">អាចគូរដោយកណ្ដុរ ប៊ិច ឬ Touch។ ហត្ថលេខានេះនឹងត្រូវភ្ជាប់ជាមួយឈ្មោះគណនីនៅពេលបុគ្គលិករក្សាទុកឯកសារ។</p><div class="status" data-esign-status></div></section>`;document.body.append(overlay);const canvas=overlay.querySelector('canvas');const ctx=canvas.getContext('2d');ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#075f81';let drawing=false;let hasInk=false;function clearCanvas(){ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false}function point(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height}}canvas.addEventListener('pointerdown',event=>{drawing=true;hasInk=true;canvas.setPointerCapture(event.pointerId);const p=point(event);ctx.beginPath();ctx.moveTo(p.x,p.y)});canvas.addEventListener('pointermove',event=>{if(!drawing)return;const p=point(event);ctx.lineTo(p.x,p.y);ctx.stroke()});['pointerup','pointercancel','pointerleave'].forEach(name=>canvas.addEventListener(name,()=>{drawing=false}));const close=()=>overlay.remove();overlay.querySelector('[data-close]').onclick=close;overlay.addEventListener('click',event=>{if(event.target===overlay)close()});overlay.querySelector('[data-clear-sign]').onclick=clearCanvas;overlay.querySelector('[data-name-sign]').onclick=()=>{clearCanvas();const name=overlay.querySelector('[data-signer-name]').value.trim()||user.displayName;ctx.fillStyle='#075f81';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 34px "Khmer OS Battambang", "Noto Sans Khmer", sans-serif';ctx.fillText(name,canvas.width/2,canvas.height/2);hasInk=true};if(existing?.signatureDataUrl){const img=new Image();img.onload=()=>{clearCanvas();ctx.drawImage(img,0,0,canvas.width,canvas.height);hasInk=true};img.src=existing.signatureDataUrl}overlay.querySelector('[data-save-sign]').onclick=async()=>{const statusNode=overlay.querySelector('[data-esign-status]');statusNode.textContent='';const signerName=overlay.querySelector('[data-signer-name]').value.trim();if(!signerName){statusNode.textContent='សូមបញ្ចូលឈ្មោះ។';return}if(!hasInk){statusNode.textContent='សូមគូរ ឬបង្កើតហត្ថលេខាពីឈ្មោះ។';return}try{const result=await api(`/api/admin/esignatures/${userId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({signerName,signatureDataUrl:canvas.toDataURL('image/png')})});const index=signatures.findIndex(item=>item.userId===userId);if(index>=0)signatures[index]=result.signature;else signatures.push(result.signature);renderESignatures();await loadAudit();close()}catch(err){statusNode.textContent=err.message}}}

  function openAddRoleDialog(){
    const overlay=document.createElement('div');
    overlay.className='custom-modal-overlay';
    overlay.innerHTML=`
      <div class="custom-modal-dialog">
        <header>
          <h2>បន្ថែមតួនាទីថ្មី (Add Role)</h2>
          <button type="button" data-close>×</button>
        </header>
        <form id="add-role-form">
          <label>កូដតួនាទី (Role Code - ជាអក្សរឡាតាំងធំ ឧ. DENTIST)<input name="code" placeholder="ឧ. PHYSIOTHERAPIST" required pattern="[A-Za-z0-9_]{2,40}"></label>
          <label>ឈ្មោះតួនាទីជាភាសាខ្មែរ (Khmer Label)<input name="labelKh" placeholder="ឧ. អ្នកព្យាបាលចលនា" required maxlength="100"></label>
          <label>ឈ្មោះជាភាសាអង់គ្លេស (English Name - ស្រេចចិត្ត)<input name="labelEn" placeholder="ឧ. Physiotherapist" maxlength="100"></label>
          <div class="status" id="add-role-status"></div>
          <div class="custom-modal-actions">
            <button type="button" class="secondary" data-close>បោះបង់</button>
            <button type="submit" class="primary">រក្សាទុកតួនាទី</button>
          </div>
        </form>
      </div>
    `;
    document.body.append(overlay);
    const close=()=>overlay.remove();
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    const form=overlay.querySelector('#add-role-form');
    form.onsubmit=async e=>{
      e.preventDefault();
      const code=form.elements.code.value.trim().toUpperCase();
      const labelKh=form.elements.labelKh.value.trim();
      const labelEn=form.elements.labelEn.value.trim();
      const st=overlay.querySelector('#add-role-status');
      st.textContent='';
      try{
        const res=await api('/api/admin/roles',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({code,labelKh,labelEn})
        });
        roles=res.roles||roles;
        labels=res.roleLabels||labels;
        renderOptions(code,'');
        await loadAudit();
        close();
      }catch(err){
        st.textContent=err.message;
      }
    };
  }

  function openAddWardDialog(){
    const overlay=document.createElement('div');
    overlay.className='custom-modal-overlay';
    overlay.innerHTML=`
      <div class="custom-modal-dialog">
        <header>
          <h2>បន្ថែមផ្នែក / សេវាថ្មី (Add Service/Ward)</h2>
          <button type="button" data-close>×</button>
        </header>
        <form id="add-ward-form">
          <label>កូដផ្នែក/សេវា (Ward Code - ឧ. cardiology)<input name="code" placeholder="ឧ. cardiology" required pattern="[a-zA-Z0-9_-]{2,40}"></label>
          <label>ឈ្មោះផ្នែកជាភាសាខ្មែរ (Khmer Name)<input name="nameKh" placeholder="ឧ. ផ្នែកជំងឺបេះដូង" required maxlength="100"></label>
          <label>ឈ្មោះជាភាសាអង់គ្លេស (English Name)<input name="nameEn" placeholder="ឧ. Cardiology" maxlength="100"></label>
          <div class="status" id="add-ward-status"></div>
          <div class="custom-modal-actions">
            <button type="button" class="secondary" data-close>បោះបង់</button>
            <button type="submit" class="primary">រក្សាទុកផ្នែក/សេវា</button>
          </div>
        </form>
      </div>
    `;
    document.body.append(overlay);
    const close=()=>overlay.remove();
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    const form=overlay.querySelector('#add-ward-form');
    form.onsubmit=async e=>{
      e.preventDefault();
      const code=form.elements.code.value.trim().toLowerCase();
      const nameKh=form.elements.nameKh.value.trim();
      const nameEn=form.elements.nameEn.value.trim();
      const st=overlay.querySelector('#add-ward-status');
      st.textContent='';
      try{
        const res=await api('/api/admin/wards',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({code,nameKh,nameEn})
        });
        wards=res.wards||wards;
        renderOptions('',code);
        await loadAudit();
        close();
      }catch(err){
        st.textContent=err.message;
      }
    };
  }

  function clear(){el('user-form').reset();el('edit-user-id').value='';el('username').disabled=false;el('password-label').hidden=demoMode;el('password').required=!demoMode;el('is-active').checked=true;el('form-title').textContent='បង្កើតគណនីថ្មី';if(el('imaging-subtypes-nested'))el('imaging-subtypes-nested').hidden=true;renderImagingSubtypes([]);status('')}
  function edit(id){const u=users.find(x=>x.id===id);if(!u)return;el('edit-user-id').value=u.id;el('display-name').value=u.displayName;el('username').value=u.username;el('username').disabled=true;el('password-label').hidden=true;el('password').required=false;el('is-active').checked=u.isActive;document.querySelectorAll('[name=roles]').forEach(x=>x.checked=u.roles.includes(x.value));document.querySelectorAll('[name=wards]').forEach(x=>x.checked=u.wards.includes(x.value));const hasImaging=(u.roles||[]).includes('IMAGING');if(el('imaging-subtypes-nested'))el('imaging-subtypes-nested').hidden=!hasImaging;renderImagingSubtypes(u.imagingSubtypes||[]);el('form-title').textContent='កែប្រែគណនី';scrollTo({top:0,behavior:'smooth'})}
  async function load(){const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!me.ok){location.replace('/login');return}const m=await me.json();csrf=m.csrfToken;demoMode=m.demoMode===true;readOnly=m.user.activeRole==='DIRECTOR';if(!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(m.user.activeRole)){location.replace('/home');return}const data=await api('/api/admin/users');users=data.users;roles=data.roles;labels={...labels,...(data.roleLabels||{})};wards=data.wards;imagingSubtypesList=data.imagingSubtypes||[];imagingSubtypeDetailsList=data.imagingSubtypeDetails||[];imagingGroupsList=data.imagingGroups||[];renderOptions();renderUsers();clear();if(readOnly){el('user-form').hidden=true;const editor=el('esign-editor');if(editor)editor.hidden=true;const note=document.createElement('p');note.textContent='មើលព័ត៌មានប៉ុណ្ណោះ · នាយកមន្ទីរពេទ្យ';el('users-list').before(note)}await Promise.all([loadAudit(),loadESignatures()])}
  el('user-form').addEventListener('submit',async e=>{e.preventDefault();status('');const id=el('edit-user-id').value;const selectedRoles=[...document.querySelectorAll('[name=roles]:checked')].map(x=>x.value);const selectedWards=[...document.querySelectorAll('[name=wards]:checked')].map(x=>x.value);const selectedSubtypes=selectedRoles.includes('IMAGING')?[...document.querySelectorAll('[name=imagingSubtypes]:checked')].map(x=>x.value):[];try{if(id){await api(`/api/admin/users/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:el('display-name').value,roles:selectedRoles,wards:selectedWards,imagingSubtypes:selectedSubtypes,isActive:el('is-active').checked})})}else{await api('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:el('display-name').value,username:el('username').value,...(demoMode?{}:{password:el('password').value}),roles:selectedRoles,wards:selectedWards,imagingSubtypes:selectedSubtypes})})}status('បានរក្សាទុករួចរាល់។',true);const d=await api('/api/admin/users');users=d.users;renderUsers();clear();await Promise.all([loadAudit(),loadESignatures()])}catch(err){status(err.message)}});
  el('cancel-edit').addEventListener('click',clear);el('user-search').addEventListener('input',renderUsers);el('users-list').addEventListener('click',async e=>{const editId=e.target.dataset.edit;if(editId){edit(editId);return}const resetId=e.target.dataset.reset;if(resetId){const p=prompt('បញ្ចូលពាក្យសម្ងាត់បណ្តោះអាសន្ន (យ៉ាងតិច 12 តួអក្សរ):');if(!p)return;try{await api(`/api/admin/users/${resetId}/reset-password`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:p})});alert('បានកំណត់ពាក្យសម្ងាត់ថ្មី។ អ្នកប្រើត្រូវចូលប្រើម្តងទៀត។')}catch(err){alert(err.message)}}});
  el('audit-refresh')?.addEventListener('click',loadAudit);el('esign-refresh')?.addEventListener('click',loadESignatures);el('esign-list')?.addEventListener('click',event=>{const button=event.target.closest('[data-esign]');if(button)openESignEditor(button.dataset.esign)});
  el('btn-add-role')?.addEventListener('click',openAddRoleDialog);
  el('btn-add-ward')?.addEventListener('click',openAddWardDialog);
  load().catch(err=>status(err.message));
})();
