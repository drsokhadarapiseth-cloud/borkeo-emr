'use strict';
(async function(){
  const session=window.emrSession||await fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.json());
  const role=session?.user?.activeRole;
  if(!['NURSE','MIDWIFE','ADMIN','VICE_DIRECTOR'].includes(role))return;
  const csrf=session.csrfToken||'';
  const host=document.getElementById('sub_nursing');if(!host)return;
  let patient=null,services=[],timer=null;
  const panel=document.createElement('section');panel.className='ward-service-panel no-print';
  panel.innerHTML=`<header><div><h2>ការថែទាំក្នុងវួដ និងការបង់ប្រាក់</h2><p>ថ្លៃសេវាថែទាំក្នុងវួដ និងការសម្របសម្រួល Paraclinic សម្រាប់វិក្កយបត្រ IPD បច្ចុប្បន្ន</p></div><span data-ward></span></header>
    <div class="ward-service-grid"><section class="ward-service-column"><h3>ថ្លៃសេវាថែទាំក្នុងវួដ</h3>
      <div class="ward-service-entry"><select data-service aria-label="ជ្រើសរើសសេវាថែទាំក្នុងវួដ"><option value="">ជ្រើសរើសសេវា…</option></select><input data-qty type="number" min="1" step="1" value="1" aria-label="ចំនួន"><button type="button" data-add data-new-patient-invoice disabled>ជ្រើសប្រភេទបង់ប្រាក់ និងសេវា</button></div>
      <div data-preview class="ward-service-preview"></div><p data-special-note class="ward-service-hint" hidden></p><div data-status role="status"></div>
      <section class="ward-service-charge-list" data-charges></section>
      <div class="ward-cashier-send"><button type="button" data-send-cashier disabled>បញ្ជូនវិក្កយបត្រទៅបេឡា</button><span data-cashier-queue-status role="status"></span></div>
    </section><section class="ward-service-column"><section class="ward-paraclinic-workflow"><h3>ការបញ្ជាតេស្តមន្ទីរពិសោធន៍ និងរូបភាពវេជ្ជសាស្ត្រ</h3><div data-orders>សូមបើកអ្នកជំងឺសម្រាកព្យាបាល (IPD) ដើម្បីមើលការបញ្ជា។</div></section>
    </section></div>`;
  host.prepend(panel);
  const select=panel.querySelector('[data-service]'),qty=panel.querySelector('[data-qty]'),preview=panel.querySelector('[data-preview]'),specialNote=panel.querySelector('[data-special-note]'),status=panel.querySelector('[data-status]'),chargesHost=panel.querySelector('[data-charges]'),addButton=panel.querySelector('[data-add]');
  const sendCashierButton=panel.querySelector('[data-send-cashier]'),cashierQueueStatus=panel.querySelector('[data-cashier-queue-status]');
  const ordersHost=panel.querySelector('[data-orders]');
  const money=(v,c)=>c==='USD'?`US$${Number(v).toFixed(2)}`:`${Math.round(Number(v)).toLocaleString()}៛`;
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  async function api(url,opt={}){opt.credentials='same-origin';opt.headers={...(opt.headers||{}),...(opt.method&&opt.method!=='GET'?{'X-CSRF-Token':csrf}:{})};const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d;}
  function eligible(){return Boolean(patient?.patientKey&&String(patient.serviceMode||'').toLowerCase()==='ipd');}
  function activeWard(){return String(session.user.activeWard?.code||patient?.departmentCode||'').toLowerCase();}
  function selectedService(){return services.find(item=>item.code===select.value)||null;}
  function servicePriority(service){const ward=activeWard();return service.departmentCode===ward||(['medicine','pediatric'].includes(ward)&&['IPD_OVER_7_DAYS_DAILY','IPD_OVER_7_DAYS_DAILY_REFERRAL'].includes(service.code));}
  function renderPreview(){const service=selectedService();preview.textContent=service?`${service.nameKh||service.nameEn} · ${service.code} · ${money(service.defaultAmount,service.currency)} / ${service.unitLabel}`:'';addButton.disabled=!eligible();}
  function renderServices(){
    const selected=select.value;
    const available=services.filter(service=>service.code!=='GO_REFERRAL_OR_DELIVERY_LETTER');
    const primary=available.filter(servicePriority),other=available.filter(service=>!servicePriority(service));
    const makeOptions=rows=>rows.map(service=>`<option value="${esc(service.code)}">${esc(service.category?.labelKh||service.category?.labelEn||service.categoryCode)} · ${esc(service.nameKh||service.nameEn)} · ${money(service.defaultAmount,service.currency)}</option>`).join('');
    select.innerHTML=`<option value="">ជ្រើសរើសសេវា…</option>${primary.length?`<optgroup label="${esc(session.user.activeWard?.nameKh||session.user.activeWard?.nameEn||'ផ្នែកនេះ')}">${makeOptions(primary)}</optgroup>`:''}<optgroup label="ថ្លៃសេវាសកម្មផ្សេងៗទាំងអស់">${makeOptions(other)}</optgroup>`;
    if(services.some(service=>service.code===selected))select.value=selected;
    const icuHasFee=services.some(service=>service.code==='IPD_ICU_WARD_FEE'&&service.active&&Number(service.defaultAmount)>0);
    specialNote.hidden=!(activeWard()==='icu'&&!icuHasFee||activeWard()==='gyneco-obstetric');
    specialNote.textContent=activeWard()==='icu'&&!icuHasFee?'មិនទាន់មានតម្លៃសេវា ICU នៅឡើយទេ។ Admin ត្រូវកំណត់ និងបើកដំណើរការតម្លៃ ICU នៅក្នុង Service Fees។':activeWard()==='gyneco-obstetric'?'លិខិតបញ្ជូន ឬសំបុត្រសម្រាល គឺឥតគិតថ្លៃសម្រាប់អ្នកជំងឺសម្រាកព្យាបាល ហើយមិនបង្ហាញជាសេវាត្រូវបង់ប្រាក់ទេ។':'';
    renderPreview();
  }
  function renderCharges(charges=[]){
    chargesHost.innerHTML=charges.length?`<h3>ថ្លៃសេវាលើវិក្កយបត្របច្ចុប្បន្ន</h3><ul class="ward-service-charge-list-items">${charges.map(charge=>`<li><span><strong>${esc(charge.description||charge.serviceCode||'ថ្លៃសេវា')}</strong><small>${esc(charge.serviceCode||'')} · ${esc(charge.quantity)} × ${money(Number(charge.amount||0)/Math.max(1,Number(charge.quantity||1)),charge.currency)}</small></span><strong>${money(charge.amount,charge.currency)}</strong><button type="button" data-remove-charge="${esc(charge.id)}">លុបថ្លៃសេវា</button></li>`).join('')}</ul>`:'<p>មិនមានការគិតថ្លៃលើវិក្កយបត្របច្ចុប្បន្នទេ។</p>';
    chargesHost.querySelectorAll('[data-remove-charge]').forEach(button=>button.addEventListener('click',()=>void removeCharge(button.dataset.removeCharge,button)));
  }
  async function loadCharges(){if(!eligible()){renderCharges([]);sendCashierButton.disabled=true;cashierQueueStatus.textContent='';return;}try{const d=await api(`/api/finance/ward-charges?patientKey=${encodeURIComponent(patient.patientKey)}`);renderCharges(d.charges||[]);sendCashierButton.disabled=!(d.balance>0&&(d.charges||[]).length)&&!d.cashierQueueRequested;sendCashierButton.disabled=sendCashierButton.disabled||Boolean(d.cashierQueueRequested);sendCashierButton.textContent=d.cashierQueueRequested?'បានបញ្ជូនទៅបេឡា':'បញ្ជូនវិក្កយបត្រទៅបេឡា';cashierQueueStatus.textContent=d.cashierQueueRequested?'បេឡាមានវិក្កយបត្រនេះក្នុងជួររង់ចាំទូទាត់ប្រាក់។':d.balance>0?'បញ្ជូនបន្ទាប់ពីផ្នែកបានបញ្ចប់ការថែទាំ និងបញ្ចូលថ្លៃសេវារួចរាល់។':'គ្មានសមតុល្យត្រូវទូទាត់សម្រាប់បញ្ជូនទេ។';}catch(error){chargesHost.textContent=error.message;}}
  async function removeCharge(chargeId,button){const reason=prompt('ហេតុអ្វីបានជាត្រូវលុបថ្លៃសេវានេះ? ការកែតម្រូវនេះនឹងត្រូវរក្សាទុកក្នុងប្រវត្តិសវនកម្ម។');if(!reason?.trim())return;button.disabled=true;status.textContent='';try{const d=await api('/api/finance/ward-charge-void',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:patient.patientKey,chargeId,reason:reason.trim()})});renderCharges(d.charges||[]);status.textContent='បានលុបថ្លៃសេវា។ ប្រវត្តិវិក្កយបត្រត្រូវបានរក្សាទុក។';}catch(error){status.textContent=error.message;button.disabled=false;}}
  function feeStateLabel(fee){if(fee.paymentState==='PAID')return 'បានបង់ប្រាក់';if(fee.paymentState==='FREE')return fee.waiverStatus==='APPROVED'?'ឥតគិតថ្លៃ (បានអនុម័ត)':'មិនគិតថ្លៃ';if(fee.waiverStatus==='PENDING')return 'រង់ចាំការអនុម័តពី Admin/ប្រធាន';if(fee.waiverStatus==='REJECTED')return 'ការស្នើសុំមិនត្រូវបានអនុម័ត · ត្រូវបង់ប្រាក់';return fee.nurseInformedAt?'បានជូនដំណឹងអ្នកជំងឺ · ត្រូវបង់ប្រាក់':'មិនទាន់បង់ប្រាក់';}
  function renderOrders(orders=[],fees=[]){
    const visible=(orders||[]).filter(order=>!['CANCELLED','PAYMENT_PENDING'].includes(order.status));
    if(!eligible()){ordersHost.textContent='សូមបើកអ្នកជំងឺសម្រាកព្យាបាល (IPD) ដើម្បីមើលការបញ្ជា។';return;}
    const cards=visible.map(order=>{
      const wf=order.request?.wardWorkflow||{},stage=String(wf.stage||'').toUpperCase();
      const imagingLabel=({ULTRASOUND:'អេកូសាស្ត្រ (Ultrasound)',XRAY:'ថតកាំរស្មីអ៊ិច (X-ray)',CT:'ស្កេនស៊ីធី (CT)',MRI:'អិមអរអាយ (MRI)'})[order.modality]||order.modality;
      let action='';
      if(order.modality==='LAB'){
        if(order.status==='ORDERED')action='<button data-order-action="WARD_RECEIVED">ទទួលការបញ្ជា</button>';
        else if(order.status==='WARD_RECEIVED')action='<button data-order-action="COLLECTED">បានយកសំណាក</button>';
        else if(order.status==='COLLECTED')action='<button data-order-action="SENT_TO_LAB">បញ្ជូនសំណាកទៅមន្ទីរពិសោធន៍</button>';
        else if(order.status==='REJECTED')action='<button data-order-action="COLLECTED">យកសំណាកជំនួសឡើងវិញ</button>';
      }else if(!stage)action='<button data-order-action="RECEIVED_ORDER">ទទួលការបញ្ជា</button>';
      else if(stage==='RECEIVED_ORDER')action=`<button data-order-action="PATIENT_SENT_TO_IMAGING">បញ្ជូនអ្នកជំងឺទៅថត ${esc(imagingLabel)}</button>`;
      const related=fees.filter(fee=>fee.orderId===order.id);
      const orderedItems=order.modality==='LAB'?(order.request?.items||[]).map(item=>item.code).filter(Boolean).join(', '):(order.request?.examination||order.request?.bodyArea||'');
      const stageText=order.modality==='LAB'?esc(order.status):stage==='PATIENT_SENT_TO_IMAGING'?'អ្នកជំងឺត្រូវបានបញ្ជូនទៅថតរូបភាពវេជ្ជសាស្ត្រ':stage==='RECEIVED_ORDER'?'ផ្នែកបានទទួលការបញ្ជារួច':'រង់ចាំផ្នែកទទួលការបញ្ជា';
      return `<article class="ward-order-card" data-order-id="${esc(order.id)}"><div><strong>${esc(order.accessionNumber)} · ${esc(imagingLabel)}</strong><small>${esc(orderedItems)}</small><small>${esc(order.requesterName||'')} · ${new Date(order.createdAt).toLocaleString()}</small><small>${order.request?.chargeMode==='FREE'?'ការបញ្ជារបស់វេជ្ជបណ្ឌិត · ឥតគិតថ្លៃ · ':''}${stageText}</small></div>${action}</article>${related.map(fee=>renderFee(fee)).join('')}`;
    }).join('');
    const orphanFees=fees.filter(fee=>!visible.some(order=>order.id===fee.orderId)).map(renderFee).join('');
    ordersHost.innerHTML=(cards+orphanFees)||'<p>មិនមានការបញ្ជាតេស្តមន្ទីរពិសោធន៍ ឬរូបភាពវេជ្ជសាស្ត្រសម្រាប់អ្នកជំងឺនេះទេ។</p>';
    ordersHost.querySelectorAll('[data-order-action]').forEach(button=>button.addEventListener('click',()=>void updateOrderStage(button)));
    ordersHost.querySelectorAll('[data-fee-informed]').forEach(button=>button.addEventListener('click',()=>void markFeeInformed(button.dataset.feeInformed)));
    ordersHost.querySelectorAll('[data-fee-waiver]').forEach(button=>button.addEventListener('click',()=>void requestFeeWaiver(button.dataset.feeWaiver)));
  }
  function renderFee(fee){
    const amount=fee.currency==='USD'?money(fee.amountMinor/100,'USD'):money(fee.amountMinor,'KHR');
    let actions='';
    if(fee.paymentState==='NOT_PAID'&&fee.waiverStatus!=='PENDING'&&fee.waiverStatus!=='APPROVED'&&!fee.chargeVoidedAt)actions=`<button data-fee-informed="${esc(fee.id)}">អ្នកជំងឺយល់ព្រមបង់ប្រាក់</button><button class="request-waiver" data-fee-waiver="${esc(fee.id)}">ស្នើសុំការលើកលែងថ្លៃសេវា</button>`;
    return `<article class="ward-fee-alert"><div><strong>${esc(fee.description)} · ${amount}</strong><small>${esc(fee.accessionNumber)} · ${esc(fee.serviceCode)} · ${esc(feeStateLabel(fee))}</small>${fee.waiverStatus==='PENDING'?`<small>មូលហេតុ៖ ${esc(fee.waiverReason)}</small>`:''}</div>${actions}</article>`;
  }
  async function loadParaclinic(){
    if(!eligible()){renderOrders([],[]);return;}
    try{const [ordersData,feesData]=await Promise.all([api(`/api/paraclinic/orders?patientKey=${encodeURIComponent(patient.patientKey)}`),api(`/api/paraclinic/fees?patientKey=${encodeURIComponent(patient.patientKey)}`)]);renderOrders(ordersData.orders||[],feesData.fees||[]);}
    catch(error){ordersHost.textContent=error.message;}
  }
  async function updateOrderStage(button){
    const card=button.closest('[data-order-id]'),orderId=card?.dataset.orderId,action=button.dataset.orderAction;if(!orderId)return;
    button.disabled=true;
    try{
      let body;
      if(action==='RECEIVED_ORDER')body={request:{wardWorkflow:{stage:'RECEIVED_ORDER'}}};
      else if(action==='PATIENT_SENT_TO_IMAGING')body={request:{wardWorkflow:{stage:'PATIENT_SENT_TO_IMAGING'}}};
      else body={status:action,...(action==='COLLECTED'?{collectedAt:Date.now()}:{})};
      await api(`/api/paraclinic/orders/${orderId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});await loadParaclinic();
    }catch(error){button.disabled=false;alert(error.message);}
  }
  async function markFeeInformed(id){if(!confirm('បញ្ជាក់ថាអ្នកបានពន្យល់ពីថ្លៃបន្ថែមនេះ ហើយអ្នកជំងឺយល់ព្រមបង់ប្រាក់?'))return;try{await api(`/api/paraclinic/fees/${id}/patient-informed`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await loadParaclinic();}catch(error){alert(error.message);}}
  async function requestFeeWaiver(id){const reason=prompt('ហេតុអ្វីបានជាអ្នកជំងឺមិនអាចបង់ថ្លៃនេះបាន? តម្រូវឱ្យមានការអនុម័តពី Admin ឬប្រធាន។');if(!reason?.trim())return;try{await api(`/api/paraclinic/fees/${id}/waiver-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:reason.trim()})});await loadParaclinic();}catch(error){alert(error.message);}}
  function setPatient(value){patient=value||null;addButton.dataset.newPatientInvoice=patient?.patientKey||'';addButton.dataset.patientName=patient?.fullName||'';select.disabled=!eligible();qty.disabled=!eligible();renderPreview();void loadCharges();void loadParaclinic();}
  async function load(){const d=await api('/api/finance/ward-services');services=d.services||[];panel.querySelector('[data-ward]').textContent=session.user.activeWard?.nameKh||session.user.activeWard?.nameEn||d.ward||'';renderServices();}
  select.addEventListener('change',renderPreview);
  select.hidden=true;qty.hidden=true;preview.hidden=true;
  addButton.dataset.languageExclude='';const feeLabel=()=>addButton.textContent='ជ្រើសប្រភេទបង់ប្រាក់ និងសេវា';feeLabel();window.addEventListener('borkeo-language-change',feeLabel);
  window.addEventListener('staff-invoice-created',event=>{if(event.detail.patientKey===patient?.patientKey)void loadCharges();});
  window.addEventListener('focus',()=>void load());
  sendCashierButton.addEventListener('click',async()=>{if(!eligible())return;sendCashierButton.disabled=true;cashierQueueStatus.textContent='';try{const d=await api('/api/finance/send-to-cashier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:patient.patientKey})});sendCashierButton.textContent='បានបញ្ជូនទៅបេឡា';cashierQueueStatus.textContent=`វិក្កយបត្រ ${d.invoice?.invoiceNo||''} ត្រូវបានបញ្ជូនទៅជួររង់ចាំទូទាត់ប្រាក់។`;}catch(error){cashierQueueStatus.textContent=error.message;sendCashierButton.disabled=false;}});
  document.addEventListener('emr:patient-loaded',event=>setPatient(event.detail?.patient));document.addEventListener('emr:patient-saved',event=>setPatient(event.detail?.patient));setPatient(window.getLoadedEmrPatient?.()||null);await load();
  timer=setInterval(()=>{void load();void loadCharges();void loadParaclinic();},15000);window.addEventListener('beforeunload',()=>clearInterval(timer));
})().catch(console.error);
