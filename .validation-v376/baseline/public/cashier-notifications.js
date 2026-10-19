'use strict';
(async()=>{
 const session=window.emrSession||(await (await fetch('/api/auth/me',{credentials:'same-origin'})).json());
 const user=session.user;if(!['CLERK','ACCOUNTANT','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(user?.activeRole))return;
 const manager=['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(user.activeRole),csrf=session.csrfToken;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={PENDING:'រង់ចាំការអនុម័ត',APPROVED:'បានអនុម័ត',REJECTED:'មិនអនុម័ត',APPLIED:'បានកែរួច',STALE:'ត្រូវស្នើឡើងវិញ'};
 let data={payments:[],requests:[]},busy=false;
 async function api(url,options={}){const r=await fetch(url,{...options,credentials:'same-origin',headers:{...(options.headers||{}),...(options.method?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})}}),d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;}
 const notifications=window.emrNotifications;if(!notifications)return;
 const dialog=document.createElement('section');dialog.className='cashier-alert-dialog';dialog.innerHTML='<header><h2>ការជូនដំណឹងបេឡា</h2></header><div data-alert-content></div><p data-alert-status role="status"></p>';
 notifications.register('cashier',dialog,refresh);
 const date=v=>v?new Date(v).toLocaleString():'';
 function render(){
  const drafts=new Map([...dialog.querySelectorAll('[data-request-id]')].map(card=>[card.dataset.requestId,{note:card.querySelector('[data-review-note]')?.value||'',open:card.querySelector('details')?.open||false}]));
  const pending=data.requests.filter((r,index)=>manager?r.status==='PENDING':data.requests.findIndex(item=>item.invoiceId===r.invoiceId)===index&&['PENDING','APPROVED','REJECTED'].includes(r.status));
  const count=data.payments.length+pending.filter(r=>manager?r.status==='PENDING':r.status==='APPROVED').length;
  notifications.setCount('cashier',count);
  const payments=data.payments.map(p=>`<article class="cashier-alert-card"><h3>សំណើបង់ប្រាក់ពីផ្នែក</h3><p><strong>${esc(p.patientName)}</strong> · ${esc(p.invoiceNo)}</p><p>${esc(p.senderName)} · ${esc(window.getBorkeoLanguage?.()==='en'?p.wardNameEn:p.wardNameKh)} · ${esc(date(p.sentAt))}</p><button type="button" data-open-payment="${esc(p.invoiceId)}">បើកវិក្កយបត្រ</button></article>`).join('');
  const requests=pending.map(r=>`<article class="cashier-alert-card" data-request-id="${esc(r.id)}"><h3>សំណើកែវិក្កយបត្រ</h3><p><strong>${esc(r.patientName)}</strong> · ${esc(r.invoiceNo)} · ${esc(labels[r.status])}</p><p>${esc(r.requestedByName)} · ${esc(date(r.requestedAt))}</p><p>${esc(r.reason)}</p>${r.reviewNote?`<p>${esc(r.reviewNote)}</p>`:''}${manager?`<details><summary>ព័ត៌មានលម្អិតវិក្កយបត្រ</summary><div class="cashier-alert-table"><table><thead><tr><th>សេវា</th><th>ចំនួន</th><th>តម្លៃរាយ</th><th>សរុប</th></tr></thead><tbody>${r.before.charges.filter(c=>!c.voidedAt).map(c=>`<tr><td>${esc(c.description)}</td><td>${esc(c.quantity)}</td><td>${esc(c.unitAmount)} ${esc(c.currency)}</td><td>${esc(c.amount)} ${esc(c.currency)}</td></tr>`).join('')}</tbody></table></div></details><label>កំណត់សម្គាល់<input data-review-note maxlength="1000"></label><div class="cashier-review-actions"><button type="button" data-review="approve">អនុម័តការកែ</button><button type="button" data-review="reject">បដិសេធការកែ</button></div>`:`<button type="button" data-open-history="${esc(r.patientKey)}">មើលវិក្កយបត្រ</button>`}</article>`).join('');
  dialog.querySelector('[data-alert-content]').innerHTML=payments+requests||'<p>មិនមានការជូនដំណឹងបេឡាទេ។</p>';
  dialog.querySelectorAll('[data-request-id]').forEach(card=>{const draft=drafts.get(card.dataset.requestId);if(!draft)return;const input=card.querySelector('[data-review-note]'),details=card.querySelector('details');if(input)input.value=draft.note;if(details)details.open=draft.open;});
 }
 async function refresh(){if(busy)return;busy=true;try{data=await api('/api/finance/cashier-alerts');render();}catch(e){if(notifications.panel.open)dialog.querySelector('[data-alert-status]').textContent=e.message;}finally{busy=false;}}
 dialog.addEventListener('click',async event=>{
  const payment=event.target.closest('[data-open-payment]');if(payment){const p=data.payments.find(p=>p.invoiceId===payment.dataset.openPayment);if(p){notifications.close();if(window.openCashierPaymentInvoice)await window.openCashierPaymentInvoice(p.patientKey,p.invoiceId);else location.assign('/billing?'+new URLSearchParams({patientKey:p.patientKey,invoiceId:p.invoiceId}));}return;}
  const history=event.target.closest('[data-open-history]');if(history){notifications.close();if(window.openCashierInvoiceHistory)await window.openCashierInvoiceHistory(history.dataset.openHistory);else location.assign('/billing?'+new URLSearchParams({historyPatient:history.dataset.openHistory}));return;}
  const review=event.target.closest('[data-review]');if(!review||review.disabled)return;
  const card=review.closest('[data-request-id]'),buttons=card.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
  try{await api('/api/finance/invoice-edit-requests/'+card.dataset.requestId+'/review',{method:'POST',body:JSON.stringify({approved:review.dataset.review==='approve',note:card.querySelector('[data-review-note]').value})});await refresh();}
  catch(e){dialog.querySelector('[data-alert-status]').textContent=e.message;buttons.forEach(b=>b.disabled=false);}
 });
 window.addEventListener('cashier-alerts-refresh',()=>void refresh());window.addEventListener('focus',()=>void refresh());
 await refresh();setInterval(()=>{if(!document.hidden)void refresh();},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
})().catch(console.error);
