'use strict';
(function encounterEditor() {
  if (location.pathname !== '/emr') return;
  const query = new URLSearchParams(location.search);
  const report = query.get('recordPage');
  const existing = Boolean(query.get('patient')) && !query.get('newVisitFrom');
  let editing = !existing, access = null, root = null, bar = null, pending = false;
  let requestedEdit = query.get('mode') === 'edit' || query.get('edit') === '1';
  const disabled = new WeakMap();
  const role = () => window.emrSession?.user?.activeRole || '';
  const manager = () => ['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role());
  const scopeFor = view => view === 'register' ? 'registration' : view === 'triage' ? 'triage' : view === 'nursing' ? 'nursing' : 'medical';
  const roots = { register:'page1',triage:'page2',opd:'sub_opd','opd-paraclinic':'sub_opd',medical:'sub_ipd',nursing:'sub_nursing',daily:'emr-daily-view',discharge:'emr-discharge-view' };
  function view() {
    if (manager()) return report || query.get('view') || 'medical';
    if(access?.view==='medical' && ['daily','discharge'].includes(query.get('view')))return query.get('view');
    return access?.view || query.get('view') || (role() === 'REGISTRATION' ? 'register' : role() === 'TRIAGE' ? 'triage' : ['NURSE','MIDWIFE'].includes(role()) ? 'nursing' : window.emrSession?.user?.activeWard?.code === 'opd' ? 'opd' : 'medical');
  }
  function isAction(button) {
    if (/^(បោះពុម្ព|មើល|print\b|preview\b)/i.test((button.innerText||'').trim())) return false;
    return /រក្សាទុក|បញ្ជូន|ផ្ញើ|អនុម័ត|បញ្ចេញ|លុប|save|submit|transfer|discharge|delete|administer/i.test([button.textContent,button.id,button.className,button.getAttribute('onclick')].join(' '));
  }
  function message(text) { const node=bar?.querySelector('[data-editor-status]'); if(node && node.textContent!==text)node.textContent=text; }
  function apply() {
    pending=false;
    if (!role()) return;
    const current=view();
    const next=document.getElementById(roots[current] || 'sub_ipd');
    if(!next)return;
    root=next;
    document.body.dataset.encounterView=current;
    if(report)document.body.dataset.recordPage=report;
    const page=root.closest('.page') || root;
    document.querySelectorAll('.page').forEach(item=>{item.hidden=item!==page;item.classList.toggle('active',item===page)});
    if(page.id==='page3')document.querySelectorAll('#page3 > .sub-tab').forEach(panel=>{panel.hidden=panel!==root;panel.classList.toggle('active',panel===root)});
    if(!bar && !report){
      bar=document.createElement('div');bar.className='emr-encounter-toolbar no-print';bar.dataset.emrTransient='';
      bar.innerHTML='<button type="button" data-editor-toggle data-required-bypass></button><button type="button" data-editor-cancel data-required-bypass>បោះបង់ការកែប្រែ</button><button type="button" data-editor-print data-required-bypass>បោះពុម្ព</button><span data-editor-status role="status"></span>';
      page.before(bar);
      bar.querySelector('[data-editor-toggle]').onclick=toggle;
      bar.querySelector('[data-editor-cancel]').onclick=()=>{if(confirm('តើបោះបង់ការកែប្រែដែលមិនទាន់រក្សាទុកឬ?')){const url=new URL(location.href);url.searchParams.set('mode','view');url.searchParams.delete('edit');location.assign(url)}};
      bar.querySelector('[data-editor-print]').onclick=()=>window.printEmrReport?.({selectors:['#'+root.id],title:document.title});
    }
    const locked=report || !editing;
    root.querySelectorAll('input,select,textarea,button').forEach(field=>{
      if(field.tagName==='BUTTON' && !isAction(field))return;
      if(locked){if(!disabled.has(field)||!field.disabled)disabled.set(field,field.disabled);if(!field.disabled)field.disabled=true;}
      else if(disabled.has(field)){field.disabled=disabled.get(field);disabled.delete(field);}
    });
    root.querySelectorAll('[contenteditable]').forEach(field=>{if(locked && field.contentEditable!=='false'){field.dataset.editorEditable=field.contentEditable;field.contentEditable='false'}else if(!locked&&field.dataset.editorEditable){field.contentEditable=field.dataset.editorEditable;delete field.dataset.editorEditable}});
    if(bar){
      const toggleButton=bar.querySelector('[data-editor-toggle]');
      const label=editing?'រក្សាទុក':access?.requiresApproval?'ស្នើសុំកែប្រែ':'កែប្រែព័ត៌មាន';
      if(toggleButton.textContent!==label)toggleButton.textContent=label;
      toggleButton.disabled=existing && !access || Boolean(access && !access.canEdit && !access.requiresApproval);
      bar.querySelector('[data-editor-cancel]').hidden=!editing || !existing;
      if(!editing && !bar.querySelector('[data-editor-status]').textContent)message(access?.message||'កំពុងមើលព័ត៌មាន។ មិនអាចកែប្រែបានទេ។');
    }
    inspectFrames();
    if(report && window.parent!==window){
      window.parent.postMessage({type:'emr-record-height',page:report,height:Math.max(document.body.scrollHeight,500)},location.origin);
    }
  }
  function schedule(){if(!pending){pending=true;setTimeout(apply,0)}}
  async function refresh() {
    const patient=window.getLoadedEmrPatient?.();if(!patient?.patientKey)return;
    const response=await fetch('/api/encounter-access?'+new URLSearchParams({patientKey:patient.patientKey,scope:scopeFor(view())}),{cache:'no-store',credentials:'same-origin'});
    const result=await response.json();if(!response.ok)throw Error(result.error||'មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិបានទេ។');
    access=result.access;
    if(requestedEdit && access.canEdit && !report){editing=true;requestedEdit=false;}
    if(!access.canEdit){editing=false;if(access.message)message(access.message);}
    apply();return access;
  }
  async function toggle(){
    const button=bar.querySelector('[data-editor-toggle]');button.disabled=true;
    try{
      if(!editing){
        const current=await refresh();
        if(current?.requiresApproval){
          const reason=prompt('សូមបញ្ចូលមូលហេតុនៃការស្នើសុំកែប្រែកំណត់ត្រាក្រោយចេញពីពេទ្យ។','');if(!reason?.trim())return;
          const me=window.emrSession || await (await fetch('/api/auth/me')).json();
          const response=await fetch('/api/requests',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify({kind:'PATIENT_EDIT',patientKey:window.getLoadedEmrPatient().patientKey,reason:reason.trim(),payload:{scope:scopeFor(view())}})});
          const result=await response.json();if(!response.ok)throw Error(result.error);
          message('បានផ្ញើសំណើទៅគណៈគ្រប់គ្រង។ បន្ទាប់ពីអនុម័ត សូមចុចកែប្រែម្តងទៀត។');return;
        }
        if(!current?.canEdit)return;editing=true;apply();message('អាចកែប្រែព័ត៌មាន និងរក្សាទុកនៅទំព័រនេះ។');return;
      }
      if(window.BorkeoRequiredFields?.validate(root)===false)return;
      const saved=await window.savePatientRecord?.({editOnly:true});
      if(saved){editing=false;await refresh();message('បានរក្សាទុកព័ត៌មាន។')}
    }catch(error){message(error.message)}finally{button.disabled=false;apply()}
  }
  const observedFrames=new WeakSet();
  function inspectFrames(){root?.querySelectorAll('iframe').forEach(frame=>{
    const install=()=>{try{const doc=frame.contentDocument;if(!doc)return;
      doc.querySelectorAll('input,select,textarea,button').forEach(field=>{
        if(field.tagName==='BUTTON'&&!isAction(field))return;
        if(!editing||report){if(!disabled.has(field))disabled.set(field,field.disabled);field.disabled=true;}
        else if(disabled.has(field)){field.disabled=disabled.get(field);disabled.delete(field);}
      });
      if(observedFrames.has(doc))return;observedFrames.add(doc);
      new MutationObserver(schedule).observe(doc.body,{childList:true,subtree:true});
      doc.defaultView.addEventListener('click',event=>{if(!editing||report){const action=event.target.closest('button,[role="button"]');if(action&&isAction(action)){event.preventDefault();event.stopImmediatePropagation()}}},true);
      doc.defaultView.addEventListener('beforeinput',event=>{if(!editing||report){event.preventDefault();event.stopImmediatePropagation()}},true);
    }catch{}};install();if(!frame.dataset.encounterBound){frame.dataset.encounterBound='1';frame.addEventListener('load',install)}
  })}
  function filterData(data){
    if(!root)return data;
    const prior=window.getLoadedEmrPatient?.()?.data||{};
    const keys=new Set([...root.querySelectorAll('[data-emr-storage-key]')].map(field=>field.dataset.emrStorageKey));
    const system=view()==='nursing'?/^system:(?:nurs|midwife)/:view()==='opd'?/^system:(?:opdMedications|medicalRecordCompleted)/:
      ['medical','daily'].includes(view())?/^system:(?:initialIpdMedications|dailyMonitoringRecords|doctorDailyMedicineOrders|medicalRecordCompleted)/:view()==='triage'?/^(?:system:)?(?:triageId|serviceCode|encounterId)$/:/^$/;
    return Object.fromEntries(Object.entries(data).flatMap(([key,value])=>keys.has(key)||system.test(key)?[[key,value]]:
      key.startsWith('system:signature:')?[]:Object.hasOwn(prior,key)?[[key,prior[key]]]:[]));
  }
  window.EmrEncounterEditor={apply:schedule,isReadOnly:element=>Boolean(existing && (!editing||report) && root && (element===root||root.contains(element))),canWrite:()=>!report&&editing,filterData};
  window.addEventListener('click',event=>{
    const action=event.target.closest?.('button,input[type="button"],[role="button"]');
    if((report||!editing)&&action&&!action.closest('.emr-encounter-toolbar')&&isAction(action)){event.preventDefault();event.stopImmediatePropagation();message('សូមចុចកែប្រែព័ត៌មានជាមុន។')}
    if((report||!editing)&&event.target.matches?.('input[type="checkbox"],input[type="radio"],select')){event.preventDefault();event.stopImmediatePropagation()}
  },true);
  window.addEventListener('submit',event=>{if(report||!editing){event.preventDefault();event.stopImmediatePropagation()}},true);
  window.addEventListener('beforeinput',event=>{if(report||!editing){event.preventDefault();event.stopImmediatePropagation()}},true);
  document.addEventListener('emr:patient-loaded',()=>{access=window.getLoadedEmrPatient?.()?.recordAccess||null;editing=false;refresh().catch(error=>message(error.message));schedule()});
  document.addEventListener('emr:patient-saved',()=>{editing=false;refresh().catch(error=>message(error.message))});
  window.addEventListener('emr-session-ready',schedule);
  window.addEventListener('focus',()=>{if(existing)refresh().catch(error=>message(error.message))});
  document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length))schedule()}).observe(document.body,{childList:true,subtree:true});schedule()},{once:true});
  if(document.readyState!=='loading')schedule();
})();
