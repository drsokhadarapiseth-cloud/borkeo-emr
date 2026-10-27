'use strict';
(function(){
  const t=(kh,en)=>window.getBorkeoLanguage?.()==='en'?en:kh;
  const names={1:()=>t('រួចរាល់','Ready'),2:()=>t('បរាជ័យ','Failed'),3:()=>t('រង់ចាំការកែបន្ថែម','Pending'),5:()=>t('កំពុងដំណើរការ','Processing')};
  let timer,generation=0,lastKey='',enabled=false;
  function outcome(patient){
    if(!enabled)return;
    const root=document.getElementById(patient?.serviceMode==='ipd'?'sub_ipd':'sub_opd');if(!root)return;
    let select=document.getElementById('npca_outcome');
    if(!select){const label=document.createElement('label');label.textContent=t('លទ្ធផលព្យាបាលសម្រាប់ NPCA','Clinical outcome for NPCA');select=document.createElement('select');select.id='npca_outcome';select.dataset.emrNoAutoIndex='';select.dataset.emrStorageKey='scope:medical:id:npca_outcome';select.dataset.emrStorageScope='medical';
      for(const [value,kh,en]of [['','-- ជ្រើស --','-- Choose --'],['Unchanged','គ្មានការធូរស្រាល','Unchanged'],['Recovered','ជាសះស្បើយ','Recovered'],['Improved','ធូរស្រាល','Improved'],['Deceased','ស្លាប់','Deceased'],['Hopeless','អស់សង្ឃឹម','Hopeless'],['Home treatment','បន្ត​ព្យាបាល​នៅ​ផ្ទះ','Home treatment']]){const option=document.createElement('option');option.value=value;option.textContent=t(kh,en);select.appendChild(option);}label.appendChild(select);root.appendChild(label);}
    select.value=patient?.data?.['scope:medical:id:npca_outcome']||'';
    select.disabled=!['DOCTOR','CHIEF_WARD','ADMIN'].includes(window.emrSession?.user?.activeRole);
    let referral=document.getElementById('npca-referral-fields');
    if(!referral){referral=document.createElement('details');referral.id='npca-referral-fields';const summary=document.createElement('summary');summary.textContent=t('ព័ត៌មានបញ្ជូនសម្រាប់ NPCA','Referral information for NPCA');referral.appendChild(summary);
      for(const [key,kh,en]of [['number','លេខយោងបញ្ជូន','Referral number'],['transport','មធ្យោបាយបញ្ជូន','Transportation'],['phone','លេខទូរស័ព្ទវេជ្ជបណ្ឌិតបញ្ជូន','Referring doctor phone'],['facility_name','ឈ្មោះមូលដ្ឋានទទួល','Receiving facility name'],['facility_code','កូដមូលដ្ឋានទទួល','Receiving facility code'],['facility_type','ប្រភេទមូលដ្ឋានទទួល','Receiving facility type'],['document_url','តំណលិខិតបញ្ជូន','Referral document URL']]){
        const label=document.createElement('label'),input=document.createElement('input');label.textContent=t(kh,en);input.id='npca_referral_'+key;input.dataset.emrNoAutoIndex='';input.dataset.emrStorageKey='scope:medical:id:'+input.id;input.dataset.emrStorageScope='medical';input.disabled=!['DOCTOR','CHIEF_WARD','MIDWIFE','ADMIN'].includes(window.emrSession?.user?.activeRole);label.appendChild(input);referral.appendChild(label);
      }root.appendChild(referral);
    }
    for(const input of referral.querySelectorAll('input'))input.value=patient?.data?.[input.dataset.emrStorageKey]||'';
    window.EmrEncounterEditor?.apply();
  }
  async function refresh(force=false){
    const patient=window.getLoadedEmrPatient?.();
    const key=patient?.patientKey||document.querySelector('#patient-results .patient-card.active')?.dataset.key||new URLSearchParams(location.search).get('patient');
    if(!key||(!force&&key===lastKey))return;lastKey=key;const current=++generation;
    try{const r=await fetch('/api/npca/badge?patientKey='+encodeURIComponent(key),{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const data=await r.json();if(current!==generation)return;
      let badge=document.getElementById('npca-patient-badge');if(!badge){badge=document.createElement('span');badge.id='npca-patient-badge';badge.className='npca-badge';badge.setAttribute('role','status');(document.querySelector('#patient-summary,[data-session-host],.dashboard-header')||document.body).appendChild(badge);}
      badge.textContent=data.status?'NPCA: '+names[data.status]?.():'';
    }catch{}
  }
  async function setup(){
    try{const r=await fetch('/api/npca/availability',{credentials:'same-origin'});if(!r.ok)return;const availability=await r.json();enabled=availability.enabled;
      // v48.1: practice mode on a test hosting - always visible, never printed.
      if(availability.practice&&!document.getElementById('npca-practice-banner')){const banner=document.createElement('div');banner.id='npca-practice-banner';banner.setAttribute('role','note');banner.textContent=t('កំពុងហាត់សមនឹង NPCA៖ គ្មានទិន្នន័យត្រូវបានបញ្ជូនទៅ NPCA ពិតទេ។','NPCA practice: nothing is sent to the real NPCA.');
        banner.style.cssText='position:fixed;left:12px;bottom:12px;z-index:2147483000;padding:6px 12px;border-radius:6px;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;font-size:13px;font-weight:600;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.12)';
        if(!document.getElementById('npca-practice-print')){const style=document.createElement('style');style.id='npca-practice-print';style.textContent='@media print{#npca-practice-banner{display:none!important}}';document.head.appendChild(style);}
        document.body.appendChild(banner);}
      const lookup=document.getElementById('npca-lookup-button');if(lookup)lookup.disabled=!availability.enabled;
      const role=window.emrSession?.user?.activeRole;
      if(['ADMIN','DIRECTOR','ACCOUNTANT','CLERK'].includes(role)&&!document.getElementById('npca-status-link')){const a=document.createElement('a');a.id='npca-status-link';a.href=role==='ADMIN'?'/admin/npca':'/npca';a.textContent=t('ការបញ្ជូនទិន្នន័យ NPCA','NPCA submissions');(document.querySelector('[data-session-host],.session-bar,.dashboard-header')||document.body).appendChild(a);}
      if(availability.enabled)outcome(window.getLoadedEmrPatient?.());
      await refresh(true);
    }catch{}
  }
  document.addEventListener('emr:patient-loaded',e=>{outcome(e.detail?.patient);void refresh(true);});
  document.addEventListener('emr:patient-saved',()=>void refresh(true));
  document.addEventListener('click',e=>{if(e.target.closest?.('#patient-results .patient-card')){clearTimeout(timer);timer=setTimeout(()=>void refresh(),100);}});
  const finder=document.getElementById('patient-results');if(finder)new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),100);}).observe(finder,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('focus',()=>void refresh(true));
  window.addEventListener('emr-session-ready',setup);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else void setup();
})();
