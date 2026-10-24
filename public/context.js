'use strict';
(async function(){
  const roleSelect=document.getElementById('context-role');
  const wardSelect=document.getElementById('context-ward');
  const wardLabel=document.getElementById('ward-label');
  const status=document.getElementById('context-status');
  const form=document.getElementById('context-form');
  const button=form.querySelector('button[type=submit]');
  const retry=document.getElementById('context-retry');
  let session=null;
  let busy=false;
  const esc=window.escapeHtml||(v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const roleLabels={ADMIN:'អ្នកគ្រប់គ្រងប្រព័ន្ធ',REGISTRATION:'ចុះឈ្មោះ',TRIAGE:'ផ្នែកទ្រីយ៉ា',DOCTOR:'វេជ្ជបណ្ឌិត',NURSE:'គិលានុបដ្ឋាក',MIDWIFE:'ឆ្មប',LAB:'មន្ទីរពិសោធន៍',IMAGING:'រូបភាពវេជ្ជសាស្ត្រ',PHARMACY:'ឱសថស្ថាន',ACCOUNTANT:'គណនេយ្យករ',CLERK:'បេឡា',DIRECTOR:'នាយកមន្ទីរពេទ្យ',VICE_DIRECTOR:'អនុប្រធានមន្ទីរពេទ្យ',CHIEF_WARD:'ប្រធានផ្នែក',WARD_HEAD:'នាយសាល'};
  // v42.1: the Superuser picks one of the 15 user types, in this order.
  const userTypeOrder=['ADMIN','DIRECTOR','VICE_DIRECTOR','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','LAB','IMAGING','PHARMACY','CLERK','ACCOUNTANT'];
  function setStatus(text){status.textContent=text||'';}
  function landingPath(user){const role=String(user?.activeRole||'').toUpperCase();if(['CLERK','ACCOUNTANT'].includes(role))return '/billing';if(role==='LAB')return '/lab';if(role==='IMAGING')return '/imaging';if(role==='TRIAGE')return '/triage';if(role==='REGISTRATION')return '/emr?view=register';if(['WARD_HEAD','CHIEF_WARD'].includes(role))return '/ward-medicines';return '/home';}
  function wardRequired(role){return ['DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD'].includes(role)}
  function wardAllowed(role,code){if(role==='MIDWIFE')return code==='obstetric';if(role==='NURSE')return code!=='obstetric';if((role==='CHIEF_WARD'||role==='WARD_HEAD'))return code!=='opd';return true}
  function renderWards(){
    const role=roleSelect.value;const needed=wardRequired(role);wardSelect.hidden=!needed;wardLabel.hidden=!needed;wardSelect.required=needed;
    const available=(session?.user?.wards||[]).filter(w=>wardAllowed(role,w.code));
    wardSelect.innerHTML='<option value="">ជ្រើសរើសផ្នែក</option>'+available.map(w=>`<option value="${esc(w.code)}">${esc(w.nameKh||w.nameEn||w.code)}</option>`).join('');
    if(needed&&available.length===1)wardSelect.value=available[0].code;
  }
  function failure(response){const error=new Error('context request failed');error.status=response.status;return error;}
  function showError(error){
    // Never render server exception text, proxy HTML or browser diagnostics.
    if(error.status===401){session=null;location.replace('/login');return;}
    setStatus([400,403].includes(error.status)
      ? 'មិនអាចជ្រើសរើសតួនាទី និងផ្នែកការងារបានទេ។'
      : 'មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ។ សូមផ្ទុកទំព័រឡើងវិញ។');
    if(retry)retry.hidden=false;
  }
  async function readSession(){
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw failure(response);
    const current=await response.json();
    if(!current.user||!current.csrfToken)throw new Error('invalid session response');
    return current;
  }
  async function loadSession(){
    if(busy)return;
    busy=true;button.disabled=true;session=null;
    if(retry){retry.hidden=true;retry.disabled=true;}
    setStatus('');
    try{
    session=await readSession();
    const roles=session.user.isSuperuser?userTypeOrder.filter(role=>(session.user.roles||[]).includes(role)):(session.user.roles||[]);
    roleSelect.innerHTML=roles.map(role=>`<option value="${esc(role)}">${esc(roleLabels[role]||role)}</option>`).join('');
    if(session.user.activeRole) roleSelect.value=session.user.activeRole;
    renderWards();
    if(session.user.activeWard?.code) wardSelect.value=session.user.activeWard.code;
    }catch(error){session=null;showError(error)}
    finally{busy=false;button.disabled=!session;if(retry)retry.disabled=false;}
  }
  if(retry)retry.addEventListener('click',loadSession);
  roleSelect.addEventListener('change',renderWards);
  form.addEventListener('submit',async e=>{
    e.preventDefault();setStatus('');
    if(busy||!session)return;
    if(!form.reportValidity())return;
    busy=true;button.disabled=true;if(retry)retry.hidden=true;
    try{
      // Refresh the cookie-bound token before the write, without retrying a
      // context mutation after an uncertain network outcome.
      const current=await readSession();
      if(current.user.id!==session.user.id||current.user.username!==session.user.username){session=null;throw failure({status:401});}
      session=current;
      const response=await fetch('/api/auth/context',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify({role:roleSelect.value,wardCode:wardSelect.hidden?'':wardSelect.value})});
      if(!response.ok)throw failure(response);
      const result=await response.json();if(!result.user)throw new Error('invalid context response');
      location.replace(result.landingPath||landingPath(result.user));
    }catch(error){showError(error)}finally{busy=false;button.disabled=!session;}
  });
  document.getElementById('context-logout')?.addEventListener('click',async()=>{try{if(session)await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':session.csrfToken}})}finally{location.replace('/login')}});
  await loadSession();
})();
