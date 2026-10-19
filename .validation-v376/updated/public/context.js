'use strict';
(async function(){
  const roleSelect=document.getElementById('context-role');
  const wardSelect=document.getElementById('context-ward');
  const wardLabel=document.getElementById('ward-label');
  const status=document.getElementById('context-status');
  const form=document.getElementById('context-form');
  let session=null;
  const roleLabels={ADMIN:'អ្នកគ្រប់គ្រងប្រព័ន្ធ',REGISTRATION:'ចុះឈ្មោះ',TRIAGE:'ផ្នែកទ្រីយ៉ា',DOCTOR:'វេជ្ជបណ្ឌិត',NURSE:'គិលានុបដ្ឋាក',MIDWIFE:'ឆ្មប',LAB:'មន្ទីរពិសោធន៍',IMAGING:'រូបភាពវេជ្ជសាស្ត្រ',PHARMACY:'ឱសថស្ថាន',ACCOUNTANT:'គណនេយ្យករ',CLERK:'បេឡា',DIRECTOR:'នាយកមន្ទីរពេទ្យ',CHIEF_WARD:'ប្រធានផ្នែក',WARD_HEAD:'នាយសាល'};
  function setStatus(text){status.textContent=text||'';}
  function landingPath(user){const role=String(user?.activeRole||'').toUpperCase();if(['CLERK','ACCOUNTANT'].includes(role))return '/billing';if(role==='LAB')return '/lab';if(role==='IMAGING')return '/imaging';if(role==='TRIAGE')return '/triage';if(role==='REGISTRATION')return '/emr?view=register';if(['WARD_HEAD','CHIEF_WARD'].includes(role))return '/ward-medicines';return '/home';}
  function wardRequired(role){return ['DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD'].includes(role)}
  function wardAllowed(role,code){if(role==='MIDWIFE')return code==='obstetric';if(role==='NURSE')return code!=='obstetric';if((role==='CHIEF_WARD'||role==='WARD_HEAD'))return code!=='opd';return true}
  function renderWards(){
    const role=roleSelect.value;const needed=wardRequired(role);wardSelect.hidden=!needed;wardLabel.hidden=!needed;wardSelect.required=needed;
    const available=(session?.user?.wards||[]).filter(w=>wardAllowed(role,w.code));
    wardSelect.innerHTML='<option value="">ជ្រើសរើសផ្នែក</option>'+available.map(w=>`<option value="${w.code}">${w.nameKh||w.nameEn||w.code}</option>`).join('');
    if(needed&&available.length===1)wardSelect.value=available[0].code;
  }
  try{
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!response.ok){location.replace('/login');return}
    session=await response.json();
    roleSelect.innerHTML=(session.user.roles||[]).map(role=>`<option value="${role}">${roleLabels[role]||role}</option>`).join('');
    if(session.user.activeRole) roleSelect.value=session.user.activeRole;
    renderWards();
    if(session.user.activeWard?.code) wardSelect.value=session.user.activeWard.code;
  }catch(error){setStatus(error.message)}
  roleSelect.addEventListener('change',renderWards);
  form.addEventListener('submit',async e=>{
    e.preventDefault();setStatus('');
    const button=form.querySelector('button[type=submit]');button.disabled=true;
    try{
      const response=await fetch('/api/auth/context',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify({role:roleSelect.value,wardCode:wardSelect.hidden?'':wardSelect.value})});
      const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'មិនអាចជ្រើសរើសតួនាទី និងផ្នែកការងារបានទេ។');location.replace(landingPath(result.user));
    }catch(error){setStatus(error.message);button.disabled=false}
  });
  document.getElementById('context-logout')?.addEventListener('click',async()=>{try{if(session)await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':session.csrfToken}})}finally{location.replace('/login')}});
})();
