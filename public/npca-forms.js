'use strict';
(function(){
  let definitions,pending,currentKey;
  const en=()=>window.getBorkeoLanguage?.()==='en',t=(kh,eng)=>en()?eng:kh;
  async function render(patient){
    if(!patient||!document.getElementById('sub_opd'))return;
    currentKey=patient.patientKey;
    if(!definitions){pending||=fetch('/api/npca/form-definitions',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).finally(()=>{pending=null;});definitions=await pending;}
    if(!definitions?.enabled||!definitions.sendForms||currentKey!==patient.patientKey)return;
    document.getElementById('npca-assessment-forms')?.remove();
    const dept=patient.departmentCode,ageDays=patient.dateOfBirth&&patient.entryDate?(Date.parse(patient.entryDate)-Date.parse(patient.dateOfBirth))/86400000:null;
    const chosen={'pnc':'ENTY-000001B2','family-planning':'ENTY-000016Z','safe-abortion':'ENTY-0000K1B','delivery':'ENTY-0000K15','newborn':'ENTY-00000A8C','child':'ENTY-00000A9M'}[dept]||(dept==='pediatric'&&ageDays!=null&&ageDays<=5*366?(ageDays<=28?'ENTY-00000A8C':'ENTY-00000A9M'):null);
    // Obstetric staff may need the delivery supplement; it does not declare a
    // delivery until they enter clinical values or save a newborn record.
    const codes=chosen?[chosen]:dept==='obstetric'?['ENTY-0000K15']:[];
    if(!codes.length)return;
    const section=document.createElement('section');section.id='npca-assessment-forms';
    const heading=document.createElement('h3');heading.textContent=t('ព័ត៌មានវាយតម្លៃបន្ថែមសម្រាប់ NPCA','Additional assessment for NPCA');section.appendChild(heading);
    const editable=['DOCTOR','CHIEF_WARD','MIDWIFE','ADMIN'].includes(window.emrSession?.user?.activeRole);
    for(const definition of definitions.forms.filter(f=>codes.includes(f.code))){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=en()?definition.name:definition.kh;details.appendChild(summary);
      for(const field of definition.fields){const key='scope:medical:id:npca_form_'+definition.code+'_'+field.name,label=document.createElement('label');label.textContent=en()?field.en||field.name:field.kh;
        const choices=definitions.values.filter(v=>v.set===(definitions.aliases[field.valueSet]||field.valueSet));
        const control=document.createElement(choices.length?'select':'input');control.disabled=!editable;control.dataset.emrNoAutoIndex='';control.dataset.emrStorageScope='medical';
        const multiple=field.type.startsWith('array');if(choices.length){if(multiple)control.multiple=true;else{const option=document.createElement('option');option.value='';option.textContent=t('-- ជ្រើស --','-- Choose --');control.appendChild(option);}for(const choice of choices){const option=document.createElement('option');option.value=choice.code;option.textContent=en()?choice.en:choice.kh;control.appendChild(option);}}
        else control.type=field.type==='number'?'number':field.type==='date'?'date':field.type==='datetime'?'datetime-local':'text';
        const saved=patient.data?.[key]??'';
        if(multiple){const hidden=document.createElement('input');hidden.type='hidden';hidden.dataset.emrNoAutoIndex='';hidden.dataset.emrStorageScope='medical';hidden.dataset.emrStorageKey=key;hidden.value=saved;control.dataset.emrTransient='';let selected=[];try{selected=JSON.parse(saved||'[]');}catch{}for(const option of control.options||[])option.selected=selected.includes(option.value);
          control.addEventListener('change',()=>{hidden.value=JSON.stringify(choices.length?[...control.selectedOptions].map(o=>o.value):control.value.split('\n').filter(Boolean));hidden.dispatchEvent(new Event('input',{bubbles:true}));});label.appendChild(hidden);
        }else{control.dataset.emrStorageKey=key;control.value=saved;}
        label.appendChild(control);details.appendChild(label);
      }section.appendChild(details);
    }
    (patient.serviceMode==='ipd'?document.getElementById('sub_ipd'):document.getElementById('sub_opd'))?.appendChild(section);
    window.EmrEncounterEditor?.apply();
  }
  document.addEventListener('emr:patient-loaded',event=>void render(event.detail?.patient));
  window.addEventListener('emr-session-ready',()=>void render(window.getLoadedEmrPatient?.()));
})();
