'use strict';
(async()=>{
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const parse=v=>{if(typeof v!=='string')return v||{};try{return JSON.parse(v||'{}')}catch{return v}},date=t=>t?new Date(t).toLocaleString():'';
 const titles={ADMISSION:'លិខិតអនុញ្ញាតសម្រាកពេទ្យ',DISCHARGE:'លិខិតចេញពីមន្ទីរពេទ្យ',MEDICINE:'បណ្ណស្នើសុំឱសថ',FEE:'ស្នើសុំលើកលែងសេវា',PATIENT_EDIT:'សំណើកែប្រែទិន្នន័យអ្នកជំងឺ',PATIENT_DELETE:'សំណើលុបអ្នកជំងឺចេញពីបញ្ជី'};
 const statuses={PENDING:'រង់ចាំ',APPROVED:'អនុម័ត',REJECTED:'បដិសេធ',APPLIED:'បានអនុវត្ត',PREPARING:'កំពុងរៀបចំ'};
 let session,items=[],kind=new URLSearchParams(location.search).get('kind')||'ADMISSION',detail=null,documentPage=0,feedbackAction=null,feeInvoices=[],feePatients=[],busy=false;
 const selectedIds=new Set();

 async function api(path,body){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to complete the request.');return data;}
 const manager=()=>['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(session?.user?.activeRole),cashier=()=>['CLERK','ACCOUNTANT'].includes(session?.user?.activeRole);
 function tabs(){const allowed=cashier()?['FEE']:session.user.activeRole==='PHARMACY'?['MEDICINE']:Object.keys(titles);if(!allowed.includes(kind))kind=allowed[0];$('request-tabs').innerHTML=allowed.map(k=>`<button type="button" data-kind="${k}" aria-selected="${kind===k}">${titles[k]} <span class="request-badge" data-request-kind="${k}">${items.filter(x=>x.kind===k&&x.status==='PENDING').length}</span></button>`).join('');$('request-new').hidden=kind!=='FEE'||session.user.activeRole==='PHARMACY';}

 function updateBulkApproveButton(){
  const btn=$('request-bulk-approve');
  if(!btn)return;
  const countSpan=$('request-selected-count');
  if(manager()&&selectedIds.size>0){
   btn.style.display='inline-flex';
   if(countSpan)countSpan.textContent=selectedIds.size;
  }else{
   btn.style.display='none';
   if(countSpan)countSpan.textContent='0';
  }
 }

 function render(){
  tabs();
  const search=$('request-search').value.toLowerCase(),status=$('request-status').value;
  const rows=items.filter(x=>x.kind===kind&&(status==='ALL'||x.status===status||(status==='APPROVED'&&x.status==='APPLIED'))&&`${x.patientName} ${x.patientKey||''} ${x.sourceWard}`.toLowerCase().includes(search));

  const visiblePendingIds=new Set(rows.filter(x=>x.status==='PENDING').map(x=>x.id));
  for(const id of selectedIds){
   if(!visiblePendingIds.has(id))selectedIds.delete(id);
  }

  const selectAllCheckbox=$('request-select-all');
  if(selectAllCheckbox){
   selectAllCheckbox.checked=visiblePendingIds.size>0&&selectedIds.size===visiblePendingIds.size;
   selectAllCheckbox.indeterminate=selectedIds.size>0&&selectedIds.size<visiblePendingIds.size;
  }
  updateBulkApproveButton();

  $('request-list').innerHTML=rows.map(x=>{
   const isPending=x.status==='PENDING';
   const isMgr=manager();
   const checkboxTd=isMgr&&isPending
    ? `<td style="text-align:center;"><input type="checkbox" class="request-item-select" data-id="${esc(x.id)}" data-revision="${x.revision}" ${selectedIds.has(x.id)?'checked':''}></td>`
    : `<td style="text-align:center;"><span style="color:#94a3b8;">—</span></td>`;

   let actionTd='';
   if(x.kind==='MEDICINE'){
    actionTd=`<a class="request-link" href="/ward-medicines?${new URLSearchParams({ward:x.ward,date:x.date})}">មើល និងចុះហត្ថលេខា</a>`;
   }else{
    const viewBtn=`<button type="button" data-view="${esc(x.id)}" style="background:#0284c7;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-weight:600;cursor:pointer;">មើល</button>`;
    const quickApproveBtn=isMgr&&isPending
     ? `<button type="button" data-quick-approve="${esc(x.id)}" data-revision="${x.revision}" class="success" style="background:#059669;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-weight:600;cursor:pointer;margin-left:6px;">អនុម័ត</button>`
     : '';
    actionTd=`<div style="display:inline-flex;align-items:center;">${viewBtn}${quickApproveBtn}</div>`;
   }

   return `<tr>
    ${checkboxTd}
    <td><strong>${esc(x.patientName||'—')}</strong><small>${esc(x.caseNumber||x.patientKey||x.date||'')}</small></td>
    <td>${esc(x.department||x.sourceWard||'—')}</td>
    <td>${esc(date(x.submittedAt))}</td>
    <td><span class="request-status-badge status-${esc(x.status)}">${esc(statuses[x.status]||x.status)}</span></td>
    <td>${actionTd}</td>
   </tr>`;
  }).join('')||'<tr><td colspan="6" style="text-align:center;padding:18px;color:#64748b;">មិនមានសំណើ</td></tr>';
 }

 async function refresh(){if(busy)return;busy=true;try{items=(await api('/api/requests')).items||[];render();window.dispatchEvent(new Event('emr-requests-changed'));}catch(e){$('request-notice').textContent=e.message;}finally{busy=false;}}
 const simpleLabels={full_name:'ឈ្មោះ',health_id:'លេខប័ណ្ណសុខភាព',case_number:'លេខករណី',sex:'ភេទ',age:'អាយុ',phone:'លេខទូរស័ព្ទ',entry_date:'ថ្ងៃចូល',discharge_date:'ថ្ងៃចេញ',department_name_kh:'ផ្នែក',dtVal:'កាលបរិច្ឆេទ',date:'កាលបរិច្ឆេទ',name:'ឈ្មោះ',diagnosis:'រោគវិនិច្ឆ័យ',note:'កំណត់សម្គាល់',medications:'ឱសថ',temp:'សីតុណ្ហភាព',bp_sys:'សម្ពាធឈាមលើ',bp_dia:'សម្ពាធឈាមក្រោម',pulse:'ជីពចរ',resp:'ចង្វាក់ដង្ហើម',spo2:'SpO₂',dischargeAt:'ពេលចេញ',status:'ស្ថានភាព',reason:'មូលហេតុ'};
 let labelDocument;
 async function loadLabels(){if(labelDocument)return;try{const response=await fetch('/emr',{credentials:'same-origin'});if(response.ok)labelDocument=new DOMParser().parseFromString(await response.text(),'text/html');}catch{}}
 function label(key){const id=key.split(':').at(-1),control=labelDocument?.getElementById(id),container=control?.closest('.input-group,.form-group,.modern-grid>div,td,.opd-field,.ipd-field')||control?.parentElement;const text=labelDocument?.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent||container?.querySelector('label,.label-text,[data-key]')?.textContent||control?.getAttribute('aria-label');return text?.trim().replace(/\s+/g,' ')||simpleLabels[key]||simpleLabels[id]||id.replace(/^web_|^p[1-9]_/, '').replace(/_/g,' ');}
 function values(data){if(Array.isArray(data))return data.map((x,i)=>`<article class="record-block"><strong>${i+1}</strong>${values(x)}</article>`).join('');if(data&&typeof data==='object'){return `<dl class="record-values">${Object.entries(data).filter(([k,v])=>v!==''&&v!==null&&v!==undefined&&!k.includes('signatureDataUrl')&&!['userId','updatedBy','createdBy'].includes(k)).map(([k,v])=>`<dt>${esc(label(k))}</dt><dd>${typeof v==='object'?values(v):esc(v===true||v==='true'?'បាទ/ចាស':v===false||v==='false'?'ទេ':String(v))}</dd>`).join('')}</dl>`;}return `<p>${esc(data)}</p>`;}
 function signature(s){if(!s||!Object.keys(s).length)return '';const image=/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.signatureDataUrl||'')?`<img src="${esc(s.signatureDataUrl)}" alt="ហត្ថលេខា">`:'';return `<div class="record-signature">${image}<p>${esc(s.name||s.signerName||s.displayName||'')}<br>${esc(date(s.signedAt))}</p></div>`;}
 const pages=['ទ្រីយ៉ា','ការចូលសម្រាក','កំណត់ត្រាវេជ្ជសាស្ត្រ','ការថែទាំ','លិខិតចេញ'];

 function getClinicalPages(r, data){
  if(r.kind==='DISCHARGE')return pages;
  const hasOpd=Object.keys(data).some(k=>k.startsWith('scope:opd:')||k.startsWith('opd_')||k==='system:transferredWard'||k==='id:web_opd_transfer_ward');
  if(hasOpd)return ['ទ្រីយ៉ា','ពិគ្រោះក្រៅ (OPD)','ការចូលសម្រាក'];
  return ['ទ្រីយ៉ា','ការចូលសម្រាក'];
 }

 function renderTriageDoc(p, data){
  const get=(k,alt='')=>data[`scope:triage:id:${k}`]||data[`id:${k}`]||data[k]||p[k]||alt;
  const temp=get('p2_temp'),bpSys=get('p2_bp_sys'),bpDia=get('p2_bp_dia'),pulse=get('p2_pulse'),resp=get('p2_resp'),spo2=get('p2_spo2'),weight=get('p2_weight'),height=get('p2_height'),chief=get('p2_chief_complaint')||get('chief_complaint'),dept=p.department_name_kh||get('print_refer')||get('department')||'—';
  const nurseSig=parse(data['system:signature:triage']);
  return `<div class="structured-form-container" style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:22px;margin:16px 0;">
    <div style="text-align:center;border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:16px;">
      <h3 style="margin:0 0 4px 0;color:#0f172a;font-size:18px;">ទម្រង់វាយតម្លៃអ្នកជំងឺដំបូង (ទ្រីយ៉ា)</h3>
      <p style="margin:0;color:#64748b;font-size:13px;">មន្ទីរសុខាភិបាលខេត្តរតនគិរី · មន្ទីរពេទ្យបង្អែកបរកែវ</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;background:#f8fafc;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
      <div><strong style="color:#475569;">ឈ្មោះ ៖</strong> <span style="font-size:15px;font-weight:bold;color:#0f172a;">${esc(p.full_name||'—')}</span></div>
      <div><strong style="color:#475569;">ភេទ ៖</strong> <span>${esc(p.sex||'—')}</span></div>
      <div><strong style="color:#475569;">អាយុ ៖</strong> <span>${esc(p.age||'—')}</span></div>
      <div><strong style="color:#475569;">លេខករណី ៖</strong> <span>${esc(p.case_number||'—')}</span></div>
      <div><strong style="color:#475569;">លេខទូរស័ព្ទ ៖</strong> <span>${esc(p.phone||'—')}</span></div>
      <div><strong style="color:#475569;">ថ្ងៃចូល ៖</strong> <span>${esc(p.entry_date||'—')}</span></div>
    </div>
    <h4 style="margin:16px 0 8px 0;color:#0369a1;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">សញ្ញាជីវិត (Vital Signs)</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px;">
      <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:8px 12px;border-radius:6px;text-align:center;"><small style="color:#0369a1;font-weight:bold;">សីតុណ្ហភាព</small><div style="font-size:16px;font-weight:bold;color:#0c4a6e;">${esc(temp?temp+' °C':'—')}</div></div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:8px 12px;border-radius:6px;text-align:center;"><small style="color:#0369a1;font-weight:bold;">សម្ពាធឈាម</small><div style="font-size:16px;font-weight:bold;color:#0c4a6e;">${esc(bpSys||bpDia?(bpSys||'-')+'/'+(bpDia||'-')+' mmHg':'—')}</div></div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:8px 12px;border-radius:6px;text-align:center;"><small style="color:#0369a1;font-weight:bold;">ជីពចរ</small><div style="font-size:16px;font-weight:bold;color:#0c4a6e;">${esc(pulse?pulse+' /mn':'—')}</div></div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:8px 12px;border-radius:6px;text-align:center;"><small style="color:#0369a1;font-weight:bold;">ចង្វាក់ដង្ហើម</small><div style="font-size:16px;font-weight:bold;color:#0c4a6e;">${esc(resp?resp+' /mn':'—')}</div></div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:8px 12px;border-radius:6px;text-align:center;"><small style="color:#0369a1;font-weight:bold;">SpO₂</small><div style="font-size:16px;font-weight:bold;color:#0c4a6e;">${esc(spo2?spo2+' %':'—')}</div></div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:8px 12px;border-radius:6px;text-align:center;"><small style="color:#0369a1;font-weight:bold;">ទម្ងន់ / កម្ពស់</small><div style="font-size:16px;font-weight:bold;color:#0c4a6e;">${esc((weight?weight+'kg':'')+(weight&&height?' / ':'')+(height?height+'cm':'')||'—')}</div></div>
    </div>
    <div style="margin-bottom:16px;">
      <h4 style="margin:0 0 6px 0;color:#0369a1;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">សញ្ញាតម្អូញចម្បង និងការវាយតម្លៃ</h4>
      <div style="background:#fafafa;border:1px solid #e2e8f0;padding:12px;border-radius:6px;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 6px 0;"><strong>សញ្ញាតម្អូញចម្បង ៖</strong> ${esc(chief||'—')}</p>
        <p style="margin:0;"><strong>បញ្ជូនទៅផ្នែក ៖</strong> <span style="font-weight:bold;color:#0284c7;">${esc(dept)}</span></p>
      </div>
    </div>
    ${signature(nurseSig)}
  </div>`;
 }

 function renderOpdDoc(p, data){
  const get=(k,alt='')=>data[`scope:opd:id:${k}`]||data[`id:${k}`]||data[k]||alt;
  const chief=get('opd_complaint')||get('p2_chief_complaint'),hpi=get('opd_hpi'),exam=get('opd_exam'),diag=get('diag_input')||get('emr_pmrs_opd_diagnosis')||data['system:diagnosis']||'—';
  let diagList=[];
  try{const raw=data['emr_opd_diagnoses']||data['scope:opd:id:emr_opd_diagnoses'];if(raw)diagList=typeof raw==='string'?JSON.parse(raw):raw;}catch(_){}
  const rx=get('opd_treatment'),transferWard=get('web_opd_transfer_ward')||data['system:transferredWard']||'—';
  const doctorSig=parse(data['system:signature:opd'])||parse(data['system:signature:doctor']);
  return `<div class="structured-form-container" style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:22px;margin:16px 0;">
    <div style="text-align:center;border-bottom:2px solid #059669;padding-bottom:12px;margin-bottom:16px;">
      <h3 style="margin:0 0 4px 0;color:#0f172a;font-size:18px;">សំណុំបែបបទស្តីពីការពិនិត្យជំងឺក្រៅ (OPD Form)</h3>
      <p style="margin:0;color:#64748b;font-size:13px;">មន្ទីរសុខាភិបាលខេត្តរតនគិរី · មន្ទីរពេទ្យបង្អែកបរកែវ</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;background:#f0fdf4;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
      <div><strong style="color:#166534;">ឈ្មោះអ្នកជំងឺ ៖</strong> <span style="font-size:15px;font-weight:bold;color:#0f172a;">${esc(p.full_name||'—')}</span></div>
      <div><strong style="color:#166534;">ភេទ / អាយុ ៖</strong> <span>${esc((p.sex||'—')+' / '+(p.age||'—'))}</span></div>
      <div><strong style="color:#166534;">លេខករណី ៖</strong> <span>${esc(p.case_number||'—')}</span></div>
      <div><strong style="color:#166534;">ផ្ទេរទៅសម្រាកពេទ្យផ្នែក ៖</strong> <span style="font-weight:bold;color:#059669;">${esc(transferWard)}</span></div>
    </div>
    <div style="display:grid;gap:14px;margin-bottom:16px;">
      <div style="background:#fafafa;border:1px solid #e2e8f0;padding:12px;border-radius:6px;">
        <h4 style="margin:0 0 6px 0;color:#166534;">I. ប្រវត្តិជំងឺ (History)</h4>
        <p style="margin:0 0 6px 0;"><strong>សញ្ញាតម្អូញ ៖</strong> ${esc(chief||'—')}</p>
        <p style="margin:0;"><strong>ប្រវត្តិជំងឺបច្ចុប្បន្ន ៖</strong> ${esc(hpi||'—')}</p>
      </div>
      <div style="background:#fafafa;border:1px solid #e2e8f0;padding:12px;border-radius:6px;">
        <h4 style="margin:0 0 6px 0;color:#166534;">II. ពិនិត្យរាងកាយ (Physical Examination)</h4>
        <p style="margin:0;">${esc(exam||'—')}</p>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px;border-radius:6px;">
        <h4 style="margin:0 0 6px 0;color:#166534;">III. រោគវិនិច្ឆ័យ (Diagnosis)</h4>
        <div style="font-size:15px;font-weight:bold;color:#0f172a;margin-bottom:6px;">រោគវិនិច្ឆ័យចម្បង (ICD-10) ៖ <span style="color:#059669;">${esc(diag)}</span></div>
        ${Array.isArray(diagList)&&diagList.length>1?`<ul style="margin:4px 0 0 18px;padding:0;color:#334155;">${diagList.map(d=>`<li>${esc(d.icd10?'['+d.icd10+'] ': '')}${esc(d.text||'')}</li>`).join('')}</ul>`:''}
      </div>
      ${rx?`<div style="background:#fafafa;border:1px solid #e2e8f0;padding:12px;border-radius:6px;"><h4 style="margin:0 0 6px 0;color:#166534;">IV. ការព្យាបាល / វេជ្ជបញ្ជា (Treatment / Prescription)</h4><p style="margin:0;">${esc(rx)}</p></div>`:''}
    </div>
    ${signature(doctorSig)}
  </div>`;
 }

 function renderAdmissionDoc(p, data){
  const get=(k,alt='')=>data[`scope:registration:id:${k}`]||data[`id:${k}`]||data[k]||p[k]||alt;
  const diag=data['id:print_diag_in']||data['print_diag_in']||data['system:diagnosis']||data['scope:opd:id:diag_input']||'—';
  const ward=data['id:print_refer']||data['print_refer']||p.department_name_kh||data['system:transferredWard']||'—';
  const entryDate=p.entry_date||data['id:web_date']||'',entryTime=data['id:web_time']||'';
  const docSig=parse(data['system:signature:admission_doctor'])||parse(data['system:signature:medical'])||parse(data['system:signature:doctor']);
  return `<div class="structured-form-container" style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:22px;margin:16px 0;">
    <div style="text-align:center;border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:16px;">
      <h3 style="margin:0 0 4px 0;color:#0f172a;font-size:18px;">លិខិតអនុញ្ញាតចូលសម្រាកពេទ្យ</h3>
      <p style="margin:0;color:#64748b;font-size:13px;">ព្រះរាជាណាចក្រកម្ពុជា · ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;background:#f8fafc;padding:14px;border-radius:8px;margin-bottom:16px;">
      <div><strong style="color:#475569;">បានអនុញ្ញាតឱ្យអ្នកជំងឺឈ្មោះ ៖</strong> <span style="font-size:15px;font-weight:bold;color:#0f172a;">${esc(p.full_name||'—')}</span></div>
      <div><strong style="color:#475569;">ភេទ ៖</strong> <span>${esc(p.sex||'—')}</span></div>
      <div><strong style="color:#475569;">អាយុ ៖</strong> <span>${esc(p.age||'—')}</span></div>
      <div><strong style="color:#475569;">សញ្ជាតិ / ជនជាតិ ៖</strong> <span>${esc(window.EMRNationalities?.formatLabel(get('web_nat','ខ្មែរ')) || get('web_nat','ខ្មែរ'))}</span></div>
      <div><strong style="color:#475569;">លេខទូរស័ព្ទ ៖</strong> <span>${esc(p.phone||'—')}</span></div>
      <div><strong style="color:#475569;">អាសយដ្ឋាន ៖</strong> <span>${esc([get('web_street_address',''),get('web_village',''),get('web_commune',''),get('web_district',''),get('web_province','')].filter(Boolean).join(', ')||'ខេត្តរតនគិរី')}</span></div>
    </div>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:14px;border-radius:8px;margin-bottom:16px;">
      <div style="margin-bottom:8px;"><strong>រោគវិនិច្ឆ័យនៅពេលចូលសម្រាកព្យាបាល ៖</strong> <span style="font-size:15px;font-weight:bold;color:#0369a1;">${esc(diag)}</span></div>
      <div style="margin-bottom:8px;"><strong>បញ្ជូនទៅផ្នែក ៖</strong> <span style="font-size:15px;font-weight:bold;color:#0284c7;">${esc(ward)}</span></div>
      <div><strong>វេលាចូល ៖</strong> <span>${esc(entryDate?'ថ្ងៃ '+entryDate:'')} ${esc(entryTime?'ម៉ោង '+entryTime:'')}</span></div>
    </div>
    ${signature(docSig)}
  </div>`;
 }

 function recordPage(){
  const r=detail.request,p=r.snapshot||{},data=parse(p.record_json)||{};
  if(r.kind==='ADMISSION'){
    const hasOpd=Object.keys(data).some(k=>k.startsWith('scope:opd:')||k.startsWith('opd_')||k==='system:transferredWard'||k==='id:web_opd_transfer_ward');
    if(documentPage===0)return renderTriageDoc(p,data);
    if(hasOpd){
      if(documentPage===1)return renderOpdDoc(p,data);
      if(documentPage===2)return renderAdmissionDoc(p,data);
    } else {
      if(documentPage===1)return renderAdmissionDoc(p,data);
    }
  }
  const scope=documentPage===0?'triage':documentPage===1?'registration':documentPage===2?'medical':documentPage===3?'nursing':'discharge';
  const fields=Object.fromEntries(Object.entries(data).filter(([k])=>k.startsWith(`scope:${scope}:`)&&!/signature|version|dirty|lock/i.test(k)));
  let html='';
  if(documentPage===1)html+=values(Object.fromEntries(['full_name','health_id','case_number','sex','age','phone','entry_date','discharge_date','department_name_kh'].map(k=>[k,p[k]])));
  html+=values(fields);
  if(documentPage===0)html+=signature(parse(data['system:signature:triage']));
  if(documentPage===1){const opd=Object.fromEntries(Object.entries(data).filter(([k])=>k.startsWith('scope:opd:')));if(Object.keys(opd).length)html+='<h4>ការបញ្ជូនពី OPD</h4>'+values(opd);}
  if(documentPage===2){for(const [key,title] of [['system:initialIpdMedications','ឱសថដំបូង'],['system:doctorDailyMedicineOrders','វេជ្ជបញ្ជាប្រចាំថ្ងៃ'],['system:dailyMonitoringRecords','តាមដានប្រចាំថ្ងៃ']]){const records=parse(data[key]);if(Array.isArray(records)&&records.length)html+=`<h4>${title}</h4>${values(records)}`;}html+=signature(parse(data['system:signature:medical']));}
  if(documentPage===3){for(const [key,value] of Object.entries(data)){if(key.startsWith('system:')&&/nurs|midwife|obstetric|care|monitor/i.test(key)&&!key.includes('signature')&&key!=='system:dailyMonitoringRecords')html+=`<h4>${esc(label(key))}</h4>${values(parse(value))}`;}const entries=(detail.editorHistory||[]).filter(x=>x.scope==='nursing'&&x.savedAt<=Number(r.snapshot?.updated_at||r.submittedAt));for(const h of entries)html+=`<article class="record-block"><h4>${esc(h.editorName)} · ${esc(h.day)}</h4>${(h.notes||[]).map(n=>`<p><strong>${esc(n.label||label(n.field))}</strong><br>${esc(n.text)}</p>`).join('')}</article>`;}
  if(documentPage===4){html+=values(parse(data['system:discharge']));html+=values(parse(data['system:ipdDischargeSummary']));html+=signature(parse(data['system:signature:discharge']));}
  for(const form of detail.clinicalForms||[]){const type=String(form.form_type);if((documentPage===3&&/nurs|obstetric|midwife/i.test(type))||(documentPage===2&&/medical|follow/i.test(type)))html+=`<article class="record-block"><h4>${esc(label(type))}</h4>${values(parse(form.form_data_json))}</article>`;}
  return html||'<p>មិនទាន់មានទិន្នន័យ</p>';
 }

 function renderDetail(){
  const r=detail.request;
  const clinical=['ADMISSION','DISCHARGE'].includes(r.kind);
  const dataSnapshot=parse(r.snapshot?.record_json)||{};
  const hasOpd=Object.keys(dataSnapshot).some(k=>k.startsWith('scope:opd:'));

  const statusBg=r.status==='PENDING'?'background:#fef3c7;color:#92400e;border:1px solid #fde68a;'
    : r.status==='APPROVED'?'background:#dcfce7;color:#166534;border:1px solid #bbf7d0;'
    : 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;';
  const statusIcon=r.status==='PENDING'?'⏳ ':r.status==='APPROVED'?'✔ ':'✖ ';
  const statusText=statusIcon+(statuses[r.status]||r.status);

  let html=`<article class="request-document" style="border:1px solid #cbd5e1;border-radius:14px;padding:24px;background:#fff;box-shadow:0 10px 25px -5px rgba(0,0,0,0.08);">
    <div class="executive-header" style="background:linear-gradient(135deg,#0c4a6e,#0284c7);color:#fff;border-radius:12px;padding:20px;box-shadow:0 4px 16px rgba(12,74,110,0.25);margin-bottom:18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:12px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="/public/logo-hospital.jpg" alt="Logo" style="width:48px;height:48px;border-radius:50%;background:#fff;padding:2px;object-fit:cover;">
          <div>
            <div style="font-size:15px;font-weight:bold;letter-spacing:0.5px;">មន្ទីរសុខាភិបាលខេត្តរតនគិរី · មន្ទីរពេទ្យបង្អែកបរកែវ</div>
            <div style="font-size:12px;opacity:0.85;">Borkeo Referral Hospital · Executive Management Review</div>
          </div>
        </div>
        <div style="text-align:right;">
          <span style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:12.5px;font-weight:bold;${statusBg}">${statusText}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <h3 style="margin:0;font-size:20px;font-weight:bold;color:#fff;">${esc(titles[r.kind]||r.kind)}</h3>
        <div style="font-size:14px;color:#e0f2fe;"><strong>${esc(r.patientName||r.snapshot?.full_name||'')}</strong> · លេខករណី ៖ ${esc(r.caseNumber||r.patientKey||'')}</div>
      </div>
    </div>

    <div class="executive-actions-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;padding:12px 16px;border-radius:10px;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">`;

  if(manager()&&r.status==='PENDING'){
   html+=`<button type="button" data-approve class="success" style="background:#059669;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-weight:bold;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 4px rgba(5,150,105,0.25);">✔ អនុម័ត និងចុះហត្ថលេខា</button><button type="button" data-reject class="danger" style="background:#fff;color:#dc2626;border:1px solid #f87171;padding:9px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">✖ បដិសេធ</button>`;
  }
  if(r.status==='REJECTED'&&r.kind==='DISCHARGE'&&session.user.activeRole==='DOCTOR')html+='<button type="button" data-correct-discharge>កែលិខិតចេញ និងផ្ញើឡើងវិញ</button>';
  if(!manager()&&r.status==='REJECTED'&&r.kind==='FEE')html+='<button type="button" data-correct-fee>កែសំណើសេវា</button>';
  if(!manager()&&r.status==='REJECTED'&&r.kind==='ADMISSION'&&!r.id.startsWith('legacy-'))html+=`<a class="request-link" href="/emr?${new URLSearchParams({patient:r.patientKey,view:session.user.activeRole==='TRIAGE'?'triage':session.user.activeRole==='DOCTOR'?'medical':'nursing'})}">កែតម្រូវទម្រង់</a><button type="button" data-resubmit>ផ្ញើស្នើឡើងវិញ</button>`;
  if(r.kind==='FEE'&&r.status==='APPROVED'&&(cashier()||manager())&&!r.id.startsWith('legacy-'))html+='<button type="button" data-apply class="success" style="background:#059669;color:#fff;padding:9px 16px;border-radius:8px;font-weight:bold;border:none;cursor:pointer;">អនុវត្តការលើកលែង</button>';

  html+=`</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">`;
  if(r.patientKey){
   const viewMode=r.kind==='DISCHARGE'?'discharge':(hasOpd?'opd':'triage');
   html+=`<a class="request-link" target="_blank" href="/emr?${new URLSearchParams({patient:r.patientKey,view:viewMode})}" style="background:#0284c7;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px;">↗ បើកកំណត់ត្រា EMR ពេញលេញ ➔</a>`;
  }
  html+=`<button type="button" data-close-detail style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-weight:600;cursor:pointer;">✕ បិទ</button></div></div>`;

  html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;background:#f8fafc;border:1px solid #e2e8f0;padding:14px 18px;border-radius:10px;margin-bottom:16px;">
    <div><small style="color:#64748b;display:block;">អ្នកជំងឺ</small><strong style="font-size:16px;color:#0f172a;">${esc(r.patientName||r.snapshot?.full_name||'—')}</strong></div>
    <div><small style="color:#64748b;display:block;">ភេទ / អាយុ</small><span>${esc(r.snapshot?.sex||'—')} / ${esc(r.snapshot?.age||'—')}</span></div>
    <div><small style="color:#64748b;display:block;">ផ្នែក / វួដ</small><span style="font-weight:600;color:#0369a1;">${esc(r.department||r.sourceWard||'—')}</span></div>
    <div><small style="color:#64748b;display:block;">ស្នើដោយ</small><span>${esc(r.sourceRole||'')} (${esc(r.submittedBy||'')})</span></div>
    <div><small style="color:#64748b;display:block;">កាលបរិច្ឆេទស្នើ</small><span>${esc(date(r.submittedAt))}</span></div>
  </div>`;

  if(r.reason){
   html+=`<div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:5px solid #2563eb;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
     <strong style="color:#1e40af;">មូលហេតុនៃការស្នើសុំ ៖</strong> <span style="color:#1e293b;font-size:14.5px;">${esc(r.reason)}</span>
   </div>`;
  }

  if(r.kind==='PATIENT_DELETE'){
   html+=`<div style="background:#fef2f2;border:1px solid #fecaca;border-left:5px solid #dc2626;padding:14px 18px;border-radius:8px;margin-bottom:16px;">
     <h4 style="margin:0 0 6px 0;color:#991b1b;font-size:16px;">⚠️ សេចក្តីជូនដំណឹងអំពីការលុបទិន្នន័យ</h4>
     <p style="margin:0;color:#7f1d1d;font-size:14px;">ការអនុម័តសំណើនេះ នឹងលុបទិន្នន័យអ្នកជំងឺ (${esc(r.patientName)}) ចេញពីបញ្ជីប្រព័ន្ធ EMR ទាំងស្រុង។ សូមពិនិត្យឱ្យបានច្បាស់លាស់មុនពេលចុះហត្ថលេខាអនុម័ត។</p>
   </div>`;
  }

  if(clinical){
    const available=getClinicalPages(r,dataSnapshot);
    if(documentPage>=available.length)documentPage=0;
    html+=`<div style="margin:16px 0 10px 0;">
      <nav class="request-pages" style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px 0;">${available.map((p,i)=>`<button type="button" data-page="${i}" style="padding:7px 16px;border-radius:20px;border:1px solid ${documentPage===i?'#0284c7':'#cbd5e1'};background:${documentPage===i?'#0284c7':'#fff'};color:${documentPage===i?'#fff':'#334155'};font-weight:600;cursor:pointer;">${i+1}. ${p}</button>`).join('')}</nav>
      <p class="request-page-status" style="margin:0 0 8px 0;color:#64748b;font-size:13px;">មើលទិន្នន័យ · ${documentPage+1}/${available.length}</p>
    </div>
    ${recordPage()}
    <div class="request-actions" style="margin-top:16px;display:flex;gap:10px;">
      <button type="button" data-page="${Math.max(0,documentPage-1)}" ${documentPage===0?'disabled':''}>ថយក្រោយ</button>
      <button type="button" data-page="${Math.min(available.length-1,documentPage+1)}" ${documentPage===available.length-1?'disabled':''}>បន្ទាប់</button>
    </div>`;
  }
  else if(r.kind==='FEE'){
    const payload=r.payload||{};
    html+=payload.items?`<p style="font-size:15px;font-weight:bold;margin:12px 0;">${payload.mode==='FIXED'?`${esc(payload.amount)} ${esc(payload.currency)}`:`${esc(payload.percent)}%`} · វិក្កយបត្រ #${esc(payload.invoiceNo||'')}</p><div class="request-table-wrap"><table class="request-table"><thead><tr><th>សេវា</th><th>តម្លៃដើម</th><th>តម្លៃលើកលែង</th></tr></thead><tbody>${payload.items.map(x=>`<tr><td>${esc(x.description)}</td><td>${esc(x.currency==='USD'?Number(x.originalMinor)/100:x.originalMinor)} ${esc(x.currency)}</td><td>${esc(x.currency==='USD'?Number(x.amountMinor)/100:x.amountMinor)} ${esc(x.currency)}</td></tr>`).join('')}</tbody></table></div>`:values(r.charges||payload);
  }
  else if(r.kind==='PATIENT_EDIT'){
    html+=`<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:8px;margin:12px 0;">
      <h4 style="margin:0 0 8px 0;color:#0f172a;">ទិន្នន័យបច្ចុប្បន្នរបស់អ្នកជំងឺ</h4>
      <p><strong>ឈ្មោះ ៖</strong> ${esc(r.patientName)} | <strong>លេខករណី ៖</strong> ${esc(r.caseNumber)}</p>
      <p><strong>ផ្នែក ៖</strong> ${esc(r.department||'—')} | <strong>ថ្ងៃចូល ៖</strong> ${esc(r.snapshot?.entry_date||'—')}</p>
    </div>`;
  }

  html+=signature(r.signature);
  if(r.reviewNote)html+=`<div style="background:#f8fafc;border-left:4px solid #64748b;padding:10px 14px;border-radius:0 8px 8px 0;margin:12px 0;"><strong>មតិកែតម្រូវ/ការអនុម័ត ៖</strong> ${esc(r.reviewNote)}</div>`;

  html+='<div class="request-actions" style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:16px;display:flex;gap:10px;flex-wrap:wrap;">';
  if(manager()&&r.status==='PENDING'){html+='<button type="button" data-approve class="success" style="background:#059669;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">✔ អនុម័ត និងចុះហត្ថលេខា</button><button type="button" data-reject class="danger" style="background:#fff;color:#dc2626;border:1px solid #f87171;padding:9px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">✖ បដិសេធ</button>';}
  html+='<button type="button" data-close-detail style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:9px 16px;border-radius:8px;font-weight:600;cursor:pointer;">បិទ</button></div>';

  if(r.history?.length)html+=`<details class="request-review-history" style="margin-top:20px;"><summary style="font-weight:600;cursor:pointer;">ប្រវត្តិការអនុម័ត (${r.history.length})</summary>${r.history.map(h=>`<article class="record-block" style="background:#fafafa;margin-top:8px;"><strong>${esc(statuses[h.decision]||h.decision)} · កែប្រែទី${h.revision} · ${esc(date(h.at))}</strong><p>${esc(h.note)}</p>${signature(h.signature)}</article>`).join('')}</details>`;
  html+='</article>';
  $('request-detail').innerHTML=html;
  $('request-detail').hidden=false;
 }

 async function open(id){
  try{
    const r=items.find(x=>x.id===id);
    if(r&&r.kind==='ADMISSION'&&r.patientKey){
      let req=r;
      if(!r.snapshot){
        try{const fetched=await api('/api/requests/'+encodeURIComponent(id));if(fetched?.request)req=fetched.request;}catch{}
      }
      const dataSnapshot=parse(req.snapshot?.record_json)||{};
      const hasOpd=Object.keys(dataSnapshot).some(k=>k.startsWith('scope:opd:')||k.startsWith('opd_')||k==='system:transferredWard'||k==='id:web_opd_transfer_ward');
      const targetView=hasOpd?'opd':'triage';
      window.location.href=`/emr?patient=${encodeURIComponent(req.patientKey)}&view=${targetView}&reviewRequest=${encodeURIComponent(req.id)}&revision=${encodeURIComponent(req.revision||1)}`;
      return;
    }
    if(id.startsWith('legacy-'))detail={request:r};
    else detail=await api('/api/requests/'+encodeURIComponent(id));
    documentPage=0;
    await loadLabels();
    renderDetail();
    $('request-detail').focus();
    $('request-detail').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){$('request-notice').textContent=e.message;}
 }
 async function review(approved,note='',targetReq=null){const r=targetReq||detail?.request;if(!r)return;let path,body={approved,note,revision:r.revision};if(r.id.startsWith('legacy-fee:'))path='/api/paraclinic/fees/'+encodeURIComponent(r.id.slice(11))+'/waiver-review';else if(r.id.startsWith('legacy-cash:'))path='/api/finance/concessions/'+encodeURIComponent(r.id.slice(12))+'/review';else path='/api/requests/'+encodeURIComponent(r.id)+'/review';await api(path,body);if(detail?.request?.id===r.id)$('request-detail').hidden=true;await refresh();}
 function rejection(){feedbackAction=()=>review(false,$('feedback-note').value.trim());$('feedback-note').value='';$('feedback-error').textContent='';$('request-feedback').showModal();}
 async function feeInvoicesLoad(){const key=$('fee-patient').value;feeInvoices=(await api('/api/requests/invoices?'+new URLSearchParams({patientKey:key}))).invoices.filter(x=>!x.closedAt);$('fee-invoice').innerHTML=feeInvoices.map(x=>`<option value="${esc(x.id)}">${esc(x.invoiceNo)}</option>`).join('');feeServices();}
 function feeServices(){const inv=feeInvoices.find(x=>x.id===$('fee-invoice').value);$('fee-services').innerHTML=(inv?.bill?.charges||[]).filter(x=>!x.voidedAt).map(x=>`<label class="fee-service"><input type="checkbox" value="${esc(x.id)}">${esc(x.description)} · ${esc(x.amount)} ${esc(x.currency)}</label>`).join('')||'<p>មិនមានសេវា</p>';}
 function correctDischarge(){const r=detail.request,data=parse(r.snapshot?.record_json)||{},discharge=parse(data['system:discharge'])||{};const dialog=document.createElement('dialog');dialog.innerHTML=`<form><h3>កែលិខិតចេញ</h3><p>អ្នកជំងឺនៅតែចេញពីមន្ទីរពេទ្យ និងគ្រែនៅតែទំនេរ។</p><label>រោគវិនិច្ឆ័យពេលចេញ<textarea name="dischargeDiagnosis" required maxlength="2000">${esc(discharge.dischargeDiagnosis||'')}</textarea></label><label>ICD-10<input name="dischargeIcd10" maxlength="80" value="${esc(discharge.dischargeIcd10||'')}"></label><label>លទ្ធផល<input name="outcome" required maxlength="160" value="${esc(discharge.outcome||'')}"></label><label>ថ្ងៃណាត់ជួប<input name="followUpDate" type="date" value="${esc(discharge.followUpDate||'')}"></label><p data-error role="alert"></p><div class="request-actions"><button type="button" data-cancel>បោះបង់</button><button type="submit">កែ និងផ្ញើឡើងវិញ</button></div></form>`;document.querySelector('.request-panel').append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;try{const body=Object.fromEntries(['dischargeDiagnosis','dischargeIcd10','outcome','followUpDate'].map(k=>[k,event.target.elements[k].value]));body.revision=r.revision;await api(`/api/requests/${r.id}/correct`,body);dialog.close();$('request-detail').hidden=true;await refresh();}catch(e){dialog.querySelector('[data-error]').textContent=e.message;button.disabled=false;}};}
 async function newFee(){try{feePatients=(await api(cashier()?'/api/finance/patients':'/api/patients')).patients||[];$('fee-patient').innerHTML=feePatients.map(p=>`<option value="${esc(p.patientKey)}">${esc(p.fullName)} · ${esc(p.healthId||p.caseNumber||'')}</option>`).join('');const selected=detail?.request?.patientKey||new URLSearchParams(location.search).get('patientKey');if(selected&&feePatients.some(p=>p.patientKey===selected))$('fee-patient').value=selected;await feeInvoicesLoad();$('fee-error').textContent='';$('fee-dialog').showModal();}catch(e){$('request-notice').textContent=e.message;}}
 try{session=await api('/api/auth/me');if(['WARD_HEAD','CHIEF_WARD','PHARMACY'].includes(session.user?.activeRole)){kind='MEDICINE';$('request-status').value='ALL';}if(!session.user){location.replace('/login');return;}if(session.user.needsContext){location.replace('/context');return;}}catch{location.replace('/login');return;}
 $('request-tabs').onclick=e=>{const b=e.target.closest('[data-kind]');if(b){kind=b.dataset.kind;$('request-detail').hidden=true;render();}};
 
 $('request-select-all').onchange=e=>{
  const checked=e.target.checked;
  document.querySelectorAll('.request-item-select').forEach(cb=>{
   cb.checked=checked;
   if(checked)selectedIds.add(cb.dataset.id);
   else selectedIds.delete(cb.dataset.id);
  });
  updateBulkApproveButton();
 };

 $('request-list').onchange=e=>{
  if(e.target.matches('.request-item-select')){
   const id=e.target.dataset.id;
   if(e.target.checked)selectedIds.add(id);
   else selectedIds.delete(id);
   const allCbs=[...document.querySelectorAll('.request-item-select')];
   const allChecked=allCbs.length>0&&allCbs.every(cb=>cb.checked);
   const someChecked=allCbs.some(cb=>cb.checked);
   const selectAllCheckbox=$('request-select-all');
   if(selectAllCheckbox){
    selectAllCheckbox.checked=allChecked;
    selectAllCheckbox.indeterminate=!allChecked&&someChecked;
   }
   updateBulkApproveButton();
  }
 };

 const bulkApproveBtn=$('request-bulk-approve');
 if(bulkApproveBtn){
  bulkApproveBtn.onclick=async()=>{
   if(!selectedIds.size)return;
   if(!window.confirm(`តើអ្នកពិតជាចង់អនុម័តសំណើទាំង ${selectedIds.size} នេះមែនទេ?`))return;
   bulkApproveBtn.disabled=true;
   try{
    const reviews=Array.from(selectedIds).map(id=>{
     const item=items.find(x=>x.id===id);
     return {id,revision:item?.revision};
    });
    await api('/api/requests/bulk-review',{reviews,note:'Bulk approved by Management'});
    selectedIds.clear();
    updateBulkApproveButton();
    await refresh();
    $('request-notice').textContent=`បានអនុម័តសំណើចំនួន ${reviews.length} ដោយជោគជ័យ។`;
   }catch(err){
    $('request-notice').textContent=err.message;
   }finally{
    bulkApproveBtn.disabled=false;
   }
  };
 }

 $('request-list').onclick=e=>{
  const quickBtn=e.target.closest('[data-quick-approve]');
  if(quickBtn){
   const id=quickBtn.dataset.quickApprove;
   const revision=Number(quickBtn.dataset.revision||1);
   quickBtn.disabled=true;
   review(true,'Quick approved by Management',{id,revision}).catch(err=>{
    $('request-notice').textContent=err.message;
    quickBtn.disabled=false;
   });
   return;
  }
  const b=e.target.closest('[data-view]');
  if(b)void open(b.dataset.view);
 };

 $('request-status').onchange=render;
 $('request-search').oninput=render;
 $('request-refresh').onclick=refresh;
 $('request-new').onclick=newFee;
 $('request-detail').onclick=async e=>{
  const b=e.target.closest('button');
  if(!b)return;
  if(b.dataset.page!==undefined){documentPage=Number(b.dataset.page);renderDetail();return;}
  if(b.hasAttribute('data-close-detail')){$('request-detail').hidden=true;return;}
  if(b.hasAttribute('data-correct-discharge')){correctDischarge();return;}
  if(b.hasAttribute('data-correct-fee')){void newFee();return;}
  if(b.hasAttribute('data-reject')){rejection();return;}
  b.disabled=true;
  try{
   if(b.hasAttribute('data-approve'))await review(true);
   if(b.hasAttribute('data-resubmit')){await api(`/api/requests/${detail.request.id}/resubmit`,{reason:detail.request.reason});$('request-detail').hidden=true;await refresh();}
   if(b.hasAttribute('data-apply')){await api(`/api/requests/${detail.request.id}/apply`,{});$('request-detail').hidden=true;await refresh();}
  }catch(err){$('request-notice').textContent=err.message;b.disabled=false;}
 };
 $('feedback-send').onclick=async()=>{if(!$('feedback-note').value.trim()){$('feedback-error').textContent='សូមបញ្ចូលមូលហេតុ';return;}$('feedback-send').disabled=true;try{await feedbackAction();$('request-feedback').close();}catch(e){$('feedback-error').textContent=e.message;}finally{$('feedback-send').disabled=false;}};
 $('fee-mode').onchange=()=>{$('fee-percent-wrap').hidden=$('fee-mode').value==='FIXED';$('fee-amount-wrap').hidden=$('fee-mode').value!=='FIXED';};
 $('fee-patient').onchange=()=>void feeInvoicesLoad().catch(e=>{$('fee-error').textContent=e.message;});
 $('fee-invoice').onchange=feeServices;
 $('fee-cancel').onclick=()=> $('fee-dialog').close();
 $('fee-form').onsubmit=async e=>{
  e.preventDefault();
  const selected=[...$('fee-services').querySelectorAll('input:checked')].map(x=>({chargeId:x.value}));
  if(!selected.length){$('fee-error').textContent='ជ្រើសរើសសេវា';return;}
  const button=e.target.querySelector('[type=submit]');button.disabled=true;
  try{
   await api('/api/requests',{kind:'FEE',patientKey:$('fee-patient').value,reason:$('fee-reason').value,payload:{invoiceId:$('fee-invoice').value,percent:Number($('fee-percent').value),mode:$('fee-mode').value,amount:Number($('fee-amount').value),currency:$('fee-currency').value,items:selected}});
   $('fee-dialog').close();kind='FEE';await refresh();
  }catch(error){$('fee-error').textContent=error.message;}finally{button.disabled=false;}
 };
 await refresh();setInterval(()=>{if(!document.hidden)void refresh();},15000);window.addEventListener('focus',refresh);
})().catch(console.error);
