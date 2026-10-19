'use strict';
(async function(){
  let csrf='',role='';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c)=>c==='KHR'?`${Math.round(Number(v||0)).toLocaleString()} ៛`:`$${Number(v||0).toFixed(2)}`;
  async function api(url,opt={}){opt.credentials='same-origin';opt.headers={...(opt.headers||{}),...(opt.method&&opt.method!=='GET'?{'X-CSRF-Token':csrf}:{})};const r=await fetch(url,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'សំណើមិនបានជោគជ័យ');return j}
  function status(msg,ok=false){$('expense-status').textContent=msg||'';$('expense-status').className='status'+(ok?' ok':'')}
  async function load(){const d=await api('/api/finance/expenses');$('expenses-body').innerHTML=(d.expenses||[]).map(x=>`<tr class="${x.voidedAt?'voided':''}"><td>${new Date(x.spentAt).toLocaleString()}</td><td>${esc(x.category)}</td><td>${esc(x.description)}</td><td>${money(x.amount,x.currency)}</td><td>${esc(x.reference||'')}</td><td>${esc(x.createdByName||'')}</td><td>${!x.voidedAt&&role!=='DIRECTOR'?`<button class="void-btn" data-id="${x.id}">លុប</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7">មិនទាន់មានចំណាយទេ។</td></tr>'}
  const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!me.ok){location.replace('/login');return}const session=await me.json();csrf=session.csrfToken;role=session.user.activeRole;if(!['ADMIN','VICE_DIRECTOR','DIRECTOR','ACCOUNTANT'].includes(role)){location.replace('/home');return}if(role==='DIRECTOR')$('expense-form').hidden=true;
  $('expense-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/finance/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:$('expense-category').value,description:$('expense-description').value,amount:Number($('expense-amount').value),currency:$('expense-currency').value,reference:$('expense-reference').value,note:$('expense-note').value})});e.target.reset();status('បានកត់ត្រាចំណាយរួចរាល់។',true);await load()}catch(err){status(err.message)}});
  $('expenses-body').addEventListener('click',async e=>{const b=e.target.closest('[data-id]');if(!b)return;const reason=prompt('មូលហេតុនៃការលុប ឬកែតម្រូវ:');if(!reason)return;try{await api('/api/finance/void',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'expense',id:b.dataset.id,reason})});await load()}catch(err){alert(err.message)}});
  $('expense-refresh').addEventListener('click',()=>load().catch(err=>alert(err.message)));
  await load();
})().catch(err=>{console.error(err);alert(err.message)});
