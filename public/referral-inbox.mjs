import {referralPageHtml} from './referral-form.mjs';
import {recordDocument} from './referral-record-viewer.mjs?v=5071';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const status=document.querySelector('[data-inbox-status]'),list=document.querySelector('[data-inbox-list]'),search=document.querySelector('[data-inbox-search]');let rows=[],busy=false,templatePromise,canReject=false;
const date=v=>v?String(v).slice(0,10):'—';
const safeError=e=>/[\u1780-\u17ff]/.test(e?.message||'')?e.message:'មិនអាចផ្ទុកទិន្នន័យបាន';
document.title=document.querySelector('h1').textContent;
const paymentLabel=code=>({DIRECT:'បង់ប្រាក់ផ្ទាល់',CASH:'សាច់ប្រាក់',EXEMPT:'លើកលែងការបង់ប្រាក់',DISCOUNT:'បញ្ចុះថ្លៃសេវា'}[code]||(/^NSSF/.test(code||'')?'ប.ស.ស':/^HEF/.test(code||'')?'មូលនិធិសមធម៌':/[\u1780-\u17ff]/.test(code||'')?code:'—'));
function render(){
 const query=(search?.value||'').trim().toLocaleLowerCase();
 const filtered=rows.filter(row=>[row.payload.patient.fullName,row.payload.patient.healthId,row.payload.patient.phone].some(value=>String(value||'').toLocaleLowerCase().includes(query)));
 list.innerHTML=`<div class="referred-table-scroll"><table class="referred-table"><thead><tr>${['ល.រ','ឈ្មោះអ្នកជំងឺ','ភេទ','អាយុ','លេខទូរស័ព្ទ','លេខបណ្ណសុខភាព','លេខបណ្ណសមធម៌','ប្រភេទការបង់ប្រាក់','ផ្នែក','កាលបរិច្ឆេទចូល','កាលបរិច្ឆេទចេញ','ស្ថានភាព','សកម្មភាព'].map(t=>'<th scope="col">'+t+'</th>').join('')}</tr></thead><tbody>${filtered.map((row,i)=>{const p=row.payload.patient;return `<tr data-incoming="${esc(row.id)}"><td>${i+1}</td><td><strong>${esc(p.fullName)}</strong></td>${[p.sex,p.age,p.phone,p.healthId,p.equityCard,paymentLabel(p.paymentType),p.departmentNameKh||p.departmentCode,date(p.entryDate),date(p.dischargeDate)].map(v=>'<td>'+esc(v||'—')+'</td>').join('')}<td>${row.status==='REJECTED'?'បដិសេធ':row.status==='ACCEPTED'?'បានទទួលអ្នកជំងឺ':'កំពុងរង់ចាំទទួល'}${row.rejectionReason?'<div class="referred-reason">'+esc(row.rejectionReason)+'</div>':''}</td><td class="referred-actions"><button type="button" data-inbox-view="${esc(row.id)}">មើល</button><button type="button" data-inbox-accept="${esc(row.id)}" ${row.status!=='PENDING'?'disabled':''}>ទទួលអ្នកជំងឺ</button>${canReject?'<button type="button" data-inbox-reject="'+esc(row.id)+'" '+(row.status!=='PENDING'?'disabled':'')+'>បដិសេធ</button>':''}</td></tr>`}).join('')||'<tr><td colspan="13">មិនមានលិខិតបញ្ជូនចូលទេ</td></tr>'}</tbody></table></div>`;
}
async function api(url){const response=await fetch(url,{cache:'no-store'});if(response.status===401){location.assign('/login');throw Error('មិនមានសិទ្ធិ')}const data=await response.json();if(!response.ok)throw Error(data.error);return data}
async function load(){if(busy)return;try{const data=await api('/api/referral-inbox');rows=data.referrals;canReject=data.canReject===true;render();status.textContent=''}catch(error){status.textContent=safeError(error)}}
document.querySelector('[data-inbox-refresh]').onclick=load;if(search)search.oninput=render;
async function review(row,trigger){
 const overlay=document.createElement('section');overlay.className='referral-modal referral-review';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','មើលកំណត់ត្រាអ្នកជំងឺ');
 overlay.innerHTML='<div class="ref-toolbar"><strong>'+esc(row.payload.patient.fullName)+'</strong><label>ជ្រើសរើសការមកពិនិត្យ <select data-review-visit></select></label><label>ជ្រើសរើសឯកសារ <select data-review-kind><option value="referral">លិខិតបញ្ជូន</option><option value="medical">កំណត់ត្រាវេជ្ជសាស្ត្រ</option><option value="opd">ទម្រង់ពិគ្រោះក្រៅ</option><option value="nursing">តារាងថែទាំ</option></select></label><button type="button" data-incoming-close>បិទ</button><p data-review-status role="status"></p></div><div class="ref-workspace"><section data-review-problems></section><div data-review-content></div></div>';
 const close=()=>{overlay.remove();trigger.focus()};overlay.querySelector('[data-incoming-close]').onclick=close;overlay.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const controls=[...overlay.querySelectorAll('button,select,iframe')];if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus()}}};document.body.append(overlay);overlay.querySelector('button').focus();
 const notice=overlay.querySelector('[data-review-status]'),selector=overlay.querySelector('[data-review-visit]'),kind=overlay.querySelector('[data-review-kind]'),content=overlay.querySelector('[data-review-content]'),problems=overlay.querySelector('[data-review-problems]');let visits=[],generation=0;
 const show=async()=>{
  const ticket=++generation,visit=visits[Number(selector.value)];content.replaceChildren();if(!visit)return;
  const clinical=visit.clinical||{};
  problems.innerHTML='<h2>បញ្ហាវេជ្ជសាស្ត្រ</h2><ul>'+(clinical.problems||[]).map(p=>'<li>'+esc(p.problem)+' · '+esc(p.status==='resolved'?'បញ្ហាសុខភាពដែលបានដោះស្រាយ':'កំពុងបន្តមាន')+'</li>').join('')+'</ul><h2>ប្រតិកម្មអាលែកហ្ស៊ី</h2><ul>'+(clinical.allergies||[]).map(a=>'<li>'+esc(a.substance)+' · '+esc(a.reaction)+'</li>').join('')+'</ul>';
  if(kind.value==='referral'){
   const form=visit.form;if(!form){content.textContent='មិនមានលិខិតបញ្ជូនសម្រាប់ការមកពិនិត្យនេះ';return}
   content.innerHTML=referralPageHtml(form.data,form.signature);content.querySelectorAll('input,textarea').forEach(n=>n.disabled=true);return;
  }
  if(!visit.patient.data){content.textContent='មិនអាចផ្ទុកកំណត់ត្រាសម្រាប់ការមកពិនិត្យនេះបាន';return}
  if((kind.value==='opd'&&visit.patient.serviceMode!=='opd')||(kind.value==='medical'&&visit.patient.serviceMode==='opd')){content.textContent='មិនមានទម្រង់នេះសម្រាប់ការមកពិនិត្យដែលបានជ្រើសរើស';return}
  try{
   templatePromise||=api('/api/referral-record-template').then(r=>r.html).catch(e=>{templatePromise=null;throw e});const template=await templatePromise;if(!overlay.isConnected||ticket!==generation)return;
   const frame=document.createElement('iframe');frame.className='referred-record-frame';frame.setAttribute('sandbox','allow-same-origin');frame.title=kind.selectedOptions[0].textContent;frame.srcdoc=recordDocument(template,visit,kind.value);content.append(frame);
  }catch(error){if(ticket===generation)content.textContent=safeError(error)}
 };
 selector.onchange=show;kind.onchange=show;
 try{
  notice.textContent='កំពុងផ្ទុក';const result=await api('/api/referral-history?id='+encodeURIComponent(row.id));if(!overlay.isConnected)return;visits=result.visits;
  selector.innerHTML=visits.map((visit,index)=>'<option value="'+index+'">'+esc(date(visit.patient.entryDate)+' → '+date(visit.patient.dischargeDate)+' · '+(visit.patient.departmentNameKh||visit.patient.departmentCode||'')+' · '+(visit.patient.caseNumber||visit.patient.healthId||''))+'</option>').join('');
  const referredVisit=visits.findIndex(visit=>visit.form?.id===row.payload.form?.id||(row.payload.patient.patientKey&&visit.patient.patientKey===row.payload.patient.patientKey));if(referredVisit>=0)selector.value=String(referredVisit);
  notice.textContent=result.unavailable?'មិនអាចភ្ជាប់មូលដ្ឋានសុខាភិបាលដើមបាន កំពុងបង្ហាញព័ត៌មានដែលបានបញ្ជូន':'';await show();
 }catch(error){notice.textContent=safeError(error)}
}
async function rejectReferral(row,trigger){
 const dialog=document.createElement('dialog');dialog.className='ref-reject-dialog';dialog.innerHTML='<form><h2>បដិសេធការបញ្ជូន</h2><label>មូលហេតុបដិសេធ<textarea data-reject-reason required maxlength="1000"></textarea></label><p role="status"></p><div><button type="submit" data-confirm-reject>បដិសេធ</button><button type="button" data-cancel-reject>បោះបង់</button></div></form>';
 const close=()=>{dialog.close();dialog.remove();trigger.focus()};dialog.querySelector('[data-cancel-reject]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});document.body.append(dialog);dialog.showModal();dialog.querySelector('textarea').focus();
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const reason=dialog.querySelector('textarea').value.trim();if(!reason)return;const button=dialog.querySelector('[data-confirm-reject]');button.disabled=true;try{const me=await(await fetch('/api/auth/me')).json();const response=await fetch('/api/referral-reject',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify({id:row.id,reason})});const result=await response.json();if(!response.ok)throw Error(result.error);close();await load()}catch(error){dialog.querySelector('[role=status]').textContent=safeError(error);button.disabled=false}};
}
list.onclick=async event=>{
 const view=event.target.closest('[data-inbox-view]'),accept=event.target.closest('[data-inbox-accept]'),reject=event.target.closest('[data-inbox-reject]');
 if(reject&&canReject){const row=rows.find(r=>r.id===reject.dataset.inboxReject);if(row)void rejectReferral(row,reject)}
 if(view){const row=rows.find(r=>r.id===view.dataset.inboxView);if(row)void review(row,view)}
 if(accept){busy=true;accept.disabled=true;let errorMessage='';try{const me=await(await fetch('/api/auth/me')).json();const r=await fetch('/api/referral-accept',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify({id:accept.dataset.inboxAccept})});const result=await r.json();if(!r.ok)throw Error(result.error)}catch(error){errorMessage=safeError(error)}finally{busy=false;await load();if(errorMessage)status.textContent=errorMessage}}
};
void load();setInterval(load,10000);
