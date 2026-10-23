'use strict';
(function(){
  const $=id=>document.getElementById(id), en=()=>window.getBorkeoLanguage?.()==='en',t=(kh,eng)=>en()?eng:kh;
  let generation=0;
  async function search(){
    const role=window.emrSession?.user?.activeRole;if(!['REGISTRATION','ADMIN'].includes(role))return;
    const card=($('web_equity')?.value||$('web_nssf')?.value||'').trim();const current=++generation;
    const status=$('npca-registration-status'),results=$('npca-beneficiaries');results.replaceChildren();$('npca_selection').value='';
    try{
      const session=await fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.json());
      const r=await fetch('/api/npca/beneficiaries',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify({cardNumber:card,patientKey:window.getLoadedEmrPatient?.()?.patientKey})});const d=await r.json();if(current!==generation)return;if(!r.ok)throw Error(d.error);
      status.textContent=d.beneficiaries.length?t('សូមជ្រើសរើសសមាជិកគ្រួសារ','Choose the household member'):t('រកមិនឃើញអ្នកមានសិទ្ធិទេ។ កុំទាមទារប្រាក់ HEF ឬ NSSF សម្រាប់ករណីនេះ។','No beneficiary found. Do not claim this visit under HEF or NSSF.');
      for(const p of d.beneficiaries){const b=document.createElement('button');b.type='button';b.dataset.emrTransient='';b.textContent=[p.surname,p.name,p.sex,p.birthdate,JSON.stringify(p.benefitCards),p.eligible?t('មានសិទ្ធិ','Eligible'):t('គ្មានសិទ្ធិ','Not eligible'),p.dead?t('ស្លាប់','Deceased'):''].filter(Boolean).join(' · ');b.disabled=!p.eligible;
        b.onclick=()=>{if(current!==generation)return;$('npca_selection').value=p.selectionId;status.textContent=t('បានជ្រើសរើស។ សូមពិនិត្យអត្តសញ្ញាណអ្នកជំងឺ ហើយរក្សាទុកការចុះឈ្មោះ។','Selected. Check patient identity and save registration.');results.replaceChildren();};results.appendChild(b);}
    }catch(e){if(current===generation)status.textContent=e.message;}
  }
  $('npca-lookup-button')?.addEventListener('click',search);
  for(const id of ['web_equity','web_nssf','web_health_id'])$(id)?.addEventListener('input',()=>{generation++;$('npca_selection').value='';$('npca-beneficiaries').replaceChildren();});
  document.addEventListener('emr:patient-loaded',()=>{generation++;$('npca_selection').value='';$('npca-beneficiaries').replaceChildren();});
  document.addEventListener('emr:patient-saved',()=>{generation++;$('npca_selection').value='';$('npca-beneficiaries').replaceChildren();});
})();
