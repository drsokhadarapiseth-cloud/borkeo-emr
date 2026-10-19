'use strict';
(async function(){
  let csrf='',role='',cashierUserId='',selectedPaymentStatus=null,currentKey='',currentBill=null,paymentInProgress=false,patients=[],paymentTypes=[],directPaymentTypes=[],hefTypes=[],paymentPurposes=[],invoiceList=[],paymentHistory=[];
  let serviceCategories=[],cashierServiceCategories=[],services=[],serviceDepartments=[],exchangeState=null;
  const $=id=>document.getElementById(id);
  const major=type=>String(type||'').startsWith('HEF')?'HEF':String(type||'').startsWith('NSSF')?'NSSF':['INSURANCE','NGO'].includes(type)?type:'DIRECT';
  const en=()=>window.getBorkeoLanguage?.()==='en';
  const label=item=>en()?(item?.labelEn||item?.nameEn||item?.labelKh||item?.nameKh):(item?.labelKh||item?.nameKh||item?.labelEn||item?.nameEn);
  const payer=()=>$('payment-type').value||'DIRECT';
  const policy=()=>({nssfSubtype:$('nssf-subtype').value,payerName:$('payer-name').value,payerReference:$('payer-reference').value});
  window.cashierPaymentContext=()=>({patientKey:currentKey,bill:currentBill,role});
  window.reloadCashierPatient=()=>currentKey?openPatient(currentKey,currentBill?.invoice?.id||''):Promise.resolve();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c)=>c==='KHR'?`${Math.round(Number(v||0)).toLocaleString()} ៛`:`$${Number(v||0).toFixed(2)}`;
  const dateKey=value=>{const d=value instanceof Date?value:new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  function localDateTimeValue(value=new Date()){const d=value,pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`}
  function setPaymentDateTimeNow(){const input=$('payment-datetime');input.max=localDateTimeValue();input.value=input.max}
  function selectedPaymentTimestamp(){const value=$('payment-datetime').value;if(!value)throw new Error('សូមជ្រើសកាលបរិច្ឆេទ និងម៉ោងបង់ប្រាក់។');const timestamp=new Date(value).getTime();if(!Number.isFinite(timestamp))throw new Error('កាលបរិច្ឆេទ និងម៉ោងបង់ប្រាក់មិនត្រឹមត្រូវទេ។');if(timestamp>Date.now())throw new Error('មិនអាចកត់ត្រាការទូទាត់នៅពេលអនាគតបានទេ។');return timestamp}
  async function api(url,opt={}){opt.credentials='same-origin';opt.headers={...(opt.headers||{}),...(opt.method&&opt.method!=='GET'?{'X-CSRF-Token':csrf}:{})};const r=await fetch(url,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'សំណើមិនបានជោគជ័យ');return j}
  function setStatus(id,msg,ok=false){const e=$(id);if(!e)return;e.textContent=msg||'';e.className='status'+(ok?' ok':'')}
  function paymentStatusLabel(status){if(!status)return 'មិនទាន់បង់ប្រាក់';return status.labelKh||status.labelEn||''}
  function isPaidStatus(status){return ['PAID','NSSF','HEF_EQUITY','HEF_VULNERABLE','EXEMPT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE_FAMILY','FULL_WAIVER','INSURANCE','NGO'].includes(status?.code)}
  function sourceLabel(source){return ({CASH:'សាច់ប្រាក់',NSSF:'ប.ស.ស',HEF:'បណ្ណមូលនិធិសមធម៌',OTHER:'ផ្សេងៗ'})[source]||source}
  function paymentProfileLabel(profile,lang='km'){
    if(!profile)return lang==='en'?'Not configured':'មិនទាន់កំណត់ការទូទាត់';
    const typeObj=paymentTypes.find(x=>x.code===major(profile.paymentType));
    const main=lang==='en'?(typeObj?.labelEn||typeObj?.labelKh||profile.paymentType||'Direct Cash'):(label(typeObj)||profile.paymentType||'មិនទាន់កំណត់ការទូទាត់');
    if(major(profile.paymentType)!=='DIRECT')return [main,profile.payerName,profile.nssfSubtype,profile.coverageAt?(lang==='en'?'Coverage confirmed':'បានផ្ទៀងផ្ទាត់ការធានា'):''].filter(Boolean).join(' · ');
    const detailObj=directPaymentTypes.find(x=>x.code===profile.paymentSubtype);
    const detail=lang==='en'?(detailObj?.labelEn||detailObj?.labelKh||''):(detailObj?.labelKh||'');
    return detail?`${main} · ${detail}`:main;
  }

  function serviceLabel(payment, isEn=false){
    if(payment.serviceCode){
      const service=services.find(s=>s.code===payment.serviceCode);
      return (isEn ? service?.nameEn : service?.nameKh) || service?.nameKh || service?.nameEn || payment.serviceCode;
    }
    if(payment.categoryCode){
      const category=serviceCategories.find(c=>c.code===payment.categoryCode);
      return (isEn ? category?.labelEn : category?.labelKh) || category?.labelKh || category?.labelEn || payment.categoryCode;
    }
    return isEn ? 'Patient payment' : (paymentPurposes.find(p=>p.code===payment.purpose)?.labelKh||payment.purpose||'ការទូទាត់អ្នកជំងឺ');
  }

  function chargeServiceLabel(x, isEn=false){
    const s = x.serviceCode ? services.find(item=>item.code===x.serviceCode) : null;
    if(isEn){
      return x.descriptionEn || s?.nameEn || x.description || '—';
    }
    return x.descriptionKh || s?.nameKh || (s?.nameEn === x.description ? s.nameKh : null) || (x.description === 'OPD consultation without health-centre referral' ? 'ពិគ្រោះក្រៅ គ្មានលិខិតបញ្ជូនពីមណ្ឌលសុខភាព' : null) || x.description || '—';
  }

  function chargeCategoryLabel(x, isEn=false, patientDeptKh='', patientDeptEn=''){
    if(isEn){
      if(x.categoryEn) return x.categoryEn;
      if(x.category === 'ផ្នែកពិគ្រោះក្រៅ (OPD)' || x.category === 'ពិគ្រោះក្រៅ') return 'Outpatient (OPD)';
      return patientDeptEn || x.category || '—';
    }
    if(x.categoryKh) return x.categoryKh;
    if(x.category === 'Outpatient (OPD)') return 'ផ្នែកពិគ្រោះក្រៅ (OPD)';
    if(x.category === 'Inpatient') return 'សម្រាកពេទ្យ';
    if(x.category === 'CONSULTATION') return 'ពិគ្រោះជំងឺ';
    return patientDeptKh || x.category || '—';
  }

  function receiptHtml(payment,bill=currentBill,lang='km'){
    const isEn=lang==='en';
    const patient=bill?.patient||{};
    const summary=bill?.summary?.[payment.currency]||{gross:0,discount:0,waived:0,paid:0,balance:0};
    const paymentDate=new Date(payment.receivedAt);
    const dateText=paymentDate.toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    const cashier=payment.receivedByName||'—';
    const hospitalLogo=`${location.origin}/api/organization/logo`;
    const receiptNo=payment.receiptNo||'—';
    const sex=patient.sex||'—';
    const age=patient.ageText||patient.age||'—';
    const phone=patient.phone||'—';
    const paymentType=paymentProfileLabel(bill?.profile,lang)||sourceLabel(payment.source);
    const discountTotal=Number(summary.discount||0)+Number(summary.waived||0);
    const grossTotal=Number(summary.gross||0);
    const amountDue=Math.max(0,grossTotal-discountTotal);
    const charges=(bill?.charges||[]).filter(x=>!x.voidedAt && x.currency===payment.currency);
    const displayCharges=charges.length?charges:[{
      createdAt:payment.receivedAt,
      description:serviceLabel(payment,isEn),
      category:isEn?(patient.departmentNameEn||patient.departmentNameKh||''):(patient.departmentNameKh||patient.departmentNameEn||''),
      quantity:1,
      amount:payment.amount,
      currency:payment.currency,
      serviceCode:payment.serviceCode||''
    }];
    const rows=displayCharges.map((x,i)=>{
      const qty=Number(x.quantity)>0?Number(x.quantity):1;
      const unit=Number(x.amount||0)/qty;
      const invoiceNo=receiptNo;
      const dept=chargeCategoryLabel(x,isEn,patient.departmentNameKh,patient.departmentNameEn);
      const desc=chargeServiceLabel(x,isEn);
      return `<tr>
        <td>${i+1}</td>
        <td class="invoice-no">${esc(invoiceNo)}</td>
        <td>${esc(dept)}</td>
        <td class="text-left">${esc(desc)}${x.serviceCode?`<br><small>${esc(x.pmrsCode||x.serviceCode)}${x.tariffFacility?' · '+esc(x.tariffFacility):''}</small>`:''}</td>
        <td>${esc(qty)}</td>
        <td class="text-right">${esc(money(unit,x.currency))}</td>
        <td class="text-right">${esc(money(x.amount,x.currency))}</td>
      </tr>`;
    }).join('') + Array.from({length:Math.max(0,3-displayCharges.length)},()=>'<tr class="empty-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    return `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>វិក្កយបត្របង់ប្រាក់ - Borkeo Referral Hospital</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Moul&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${location.origin}/public/receipt.css?v=1750">
</head>
<body>
  <div class="print-toolbar"><button id="receipt-print-button" type="button">បោះពុម្ពវិក្កយបត្រ</button></div>
  <div class="invoice-container">
    <div class="header">
      <div class="header-logo"><img src="${hospitalLogo}" alt="Hospital Logo"></div>
      <div class="header-text">
        <h1 class="invoice-moul">មន្ទីរពេទ្យបង្អែក បរកែវ</h1>
        <h2>Borkeo Referral Hospital</h2>
        <h3 class="invoice-moul">វិក្កយបត្របង់ប្រាក់</h3>
      </div>
      <div class="header-barcode">
        
        <span>${esc(receiptNo)}</span>
      </div>
    </div>

    <div class="patient-info">
      <div>ឈ្មោះ: <strong>${esc(patient.fullName||'—')}</strong></div>
      <div>ភេទ: <strong>${esc(sex)}</strong> &nbsp;&nbsp; អាយុ: <strong>${esc(age)}</strong></div>
      <div>សញ្ជាតិ: <strong>—</strong></div>

      <div>លេខបណ្ណសុខភាព: <strong>${esc(patient.healthId||'—')}</strong></div>
      <div>លេខទូរស័ព្ទ: <strong>${esc(phone)}</strong></div>
      <div>ប្រភេទបង់ប្រាក់: <strong>${esc(paymentType)}</strong>${bill?.profile?.concession?`<small>${esc(bill.profile.concession.reason)} · ${esc(bill.profile.concession.approvedByName)} · ${esc(new Date(bill.profile.concession.approvedAt).toLocaleString())}</small>`:''}</div>

      <div class="patient-date">កាលបរិច្ឆេទ: <strong>${esc(dateText)}</strong></div>
    </div>

    <table class="invoice-table">
      <colgroup><col class="col-index"><col class="col-invoice"><col class="col-department"><col class="col-service"><col class="col-quantity"><col class="col-unit"><col class="col-total"></colgroup>
      <thead>
        <tr>
          <th>ល.រ</th>
          <th>លេខវិក្កយបត្រ</th>
          <th>ផ្នែក</th>
          <th>សេវា</th>
          <th>ចំនួន</th>
          <th>តម្លៃរាយ</th>
          <th>តម្លៃសរុប</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="middle-section">
      <div class="disclaimer">
        <u>បញ្ជាក់:</u> មុនចាកចេញសូមអតិថិជនមេត្តាពិនិត្យមើលលើវិក្កយបត្រ<br>
        ហើយយើងខ្ញុំមិនទទួលខុសត្រូវក្រោយពេលចាកចេញទេ។
      </div>
      <div class="small-totals">
        <table>
          <tr><td class="text-right">សរុប</td><td class="text-right">${esc(money(grossTotal,payment.currency))}</td></tr>
          <tr><td class="text-right">តម្លៃលើកលែង</td><td class="text-right">${esc(money(discountTotal,payment.currency))}</td></tr>
          <tr><td class="text-right">តម្លៃដែលត្រូវបង់</td><td class="text-right"><strong>${esc(money(amountDue,payment.currency))}</strong></td></tr>
        </table>
      </div>
    </div>

    <div class="signatures">
      <div class="signature-box">
        អ្នកបង់ប្រាក់
        <div class="signature-line"></div>
        <span class="signature-name">&nbsp;</span>
      </div>
      <div class="signature-box">
        អ្នកទទួលប្រាក់: <strong>${esc(cashier)}</strong>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  function invoiceHtml(bill=currentBill,lang='km'){
    const isEn=lang==='en';
    const patient=bill?.patient||{};
    const charges=(bill?.charges||[]).filter(x=>!x.voidedAt);
    const payment=(bill?.payments||[]).filter(x=>!x.voidedAt).sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt))[0];
    const paymentCurrency=payment?.currency||'KHR';
    const receiptNo=bill?.invoice?.invoiceNo||patient.caseNumber||'—';
    const dateText=new Date(payment?.receivedAt||Date.now()).toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    const profile=bill?.profile||{};
    const paymentType=paymentProfileLabel(profile,lang)||(isEn?'Cash':'សាច់ប្រាក់');
    const summary=bill?.summary?.[paymentCurrency]||{gross:0,discount:0,waived:0,paid:0,balance:0};
    const chargeRows=charges.map((x,i)=>{
      const dept=chargeCategoryLabel(x,isEn,patient.departmentNameKh,patient.departmentNameEn);
      const desc=chargeServiceLabel(x,isEn);
      return `<tr><td>${i+1}</td><td class="invoice-no">${esc(receiptNo)}</td><td>${esc(dept)}</td><td class="text-left">${esc(desc)}${x.serviceCode?`<br><small>${esc(x.pmrsCode||x.serviceCode)}${x.tariffFacility?' · '+esc(x.tariffFacility):''}</small>`:''}</td><td>${esc(x.quantity)}</td><td class="text-right">${esc(money(Number(x.amount||0)/Math.max(1,Number(x.quantity||1)),x.currency))}</td><td class="text-right">${esc(money(x.amount,x.currency))}</td></tr>`;
    }).join('');
    const emptyNotice=isEn?'No services recorded in this invoice':'មិនទាន់មានសេវាក្នុងវិក្កយបត្រ';
    const rows=charges.length?chargeRows+Array.from({length:Math.max(0,3-charges.length)},()=>'<tr class="empty-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join(''):`<tr><td colspan="7">${emptyNotice}</td></tr>`;
    const totals=activeBillCurrencies(bill).map(c=>{
      const s=bill?.summary?.[c]||{};
      const due=Math.max(0,Number(s.gross||0)-Number(s.discount||0)-Number(s.waived||0));
      const lblGross=isEn?`Gross Total ${c}`:`សរុប ${c}`;
      const lblDiscount=isEn?`Discount / Waiver ${c}`:`តម្លៃលើកលែង ${c}`;
      const lblDue=isEn?`Net Amount Due ${c}`:`ត្រូវបង់ ${c}`;
      return `<tr><td class="text-right">${lblGross}</td><td class="text-right">${esc(money(s.gross||0,c))}</td></tr><tr><td class="text-right">${lblDiscount}</td><td class="text-right">${esc(money(Number(s.discount||0)+Number(s.waived||0),c))}</td></tr><tr><td class="text-right">${lblDue}</td><td class="text-right"><strong>${esc(money(due,c))}</strong></td></tr>`;
    }).join('')||(isEn?'<tr><td class="text-right" colspan="2">No charges recorded</td></tr>':'<tr><td class="text-right" colspan="2">មិនទាន់មានថ្លៃសេវា</td></tr>');
    const docTitle=isEn?'Patient Invoice - Borkeo Referral Hospital':'វិក្កយបត្របង់ប្រាក់ - Borkeo Referral Hospital';
    const btnPrint=isEn?'Print Invoice':'បោះពុម្ពវិក្កយបត្រ';
    const headingKh='មន្ទីរពេទ្យបង្អែក បរកែវ';
    const headingEn='Borkeo Referral Hospital';
    const invoiceTitleHtml=isEn?'<h3>OFFICIAL INVOICE</h3>':'<h3 class="invoice-moul">វិក្កយបត្របង់ប្រាក់</h3>';
    const lblName=isEn?'Name:':'ឈ្មោះ:';
    const lblSex=isEn?'Sex:':'ភេទ:';
    const lblAge=isEn?'Age:':'អាយុ:';
    const lblNat=isEn?'Nationality:':'សញ្ជាតិ:';
    const lblHealthId=isEn?'Health ID:':'លេខបណ្ណសុខភាព:';
    const lblPhone=isEn?'Phone:':'លេខទូរស័ព្ទ:';
    const lblPayType=isEn?'Payment Type:':'ប្រភេទបង់ប្រាក់:';
    const lblDate=isEn?'Date:':'កាលបរិច្ឆេទ:';
    const thNo=isEn?'No.':'ល.រ';
    const thInvNo=isEn?'Invoice No.':'លេខវិក្កយបត្រ';
    const thDept=isEn?'Department':'ផ្នែក';
    const thService=isEn?'Service':'សេវា';
    const thQty=isEn?'Qty':'ចំនួន';
    const thPrice=isEn?'Unit Price':'តម្លៃរាយ';
    const thTotal=isEn?'Total Amount':'តម្លៃសរុប';
    const disclaimer=isEn?'<u>Notice:</u> Please check your invoice carefully before leaving.<br>The hospital is not responsible for discrepancies after departure.':'<u>បញ្ជាក់:</u> មុនចាកចេញសូមអតិថិជនមេត្តាពិនិត្យមើលលើវិក្កយបត្រ<br>ហើយយើងខ្ញុំមិនទទួលខុសត្រូវក្រោយពេលចាកចេញទេ។';
    const sigPayer=isEn?'Payer Signature':'អ្នកបង់ប្រាក់';
    const sigCashier=isEn?'Cashier:':'អ្នកទទួលប្រាក់:';
    return `<!DOCTYPE html><html lang="${isEn?'en':'km'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${docTitle}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Moul&display=swap" rel="stylesheet"><link rel="stylesheet" href="${location.origin}/public/receipt.css?v=1750"></head><body><div class="print-toolbar"><button id="receipt-print-button" type="button">${btnPrint}</button></div><div class="invoice-container"><div class="header"><div class="header-logo"><img src="${location.origin}/api/organization/logo" alt="Hospital Logo"></div><div class="header-text"><h1 class="invoice-moul" data-organization-name="kh">${headingKh}</h1><h2 data-organization-name="en">${headingEn}</h2>${invoiceTitleHtml}</div><div class="header-barcode"><span>${esc(receiptNo)}</span></div></div><div class="patient-info"><div>${lblName} <strong>${esc(patient.fullName||'—')}</strong></div><div>${lblSex} <strong>${esc(patient.sex||'—')}</strong> &nbsp;&nbsp; ${lblAge} <strong>${esc(patient.ageText||patient.age||'—')}</strong></div><div>${lblNat} <strong>—</strong></div><div>${lblHealthId} <strong>${esc(patient.healthId||'—')}</strong></div><div>${lblPhone} <strong>${esc(patient.phone||'—')}</strong></div><div>${lblPayType} <strong>${esc(paymentType)}</strong>${bill?.profile?.concession?`<small>${esc(bill.profile.concession.reason)} · ${esc(bill.profile.concession.approvedByName)} · ${esc(new Date(bill.profile.concession.approvedAt).toLocaleString())}</small>`:''}</div><div class="patient-date">${lblDate} <strong>${esc(dateText)}</strong></div></div><table class="invoice-table"><colgroup><col class="col-index"><col class="col-invoice"><col class="col-department"><col class="col-service"><col class="col-quantity"><col class="col-unit"><col class="col-total"></colgroup><thead><tr><th>${thNo}</th><th>${thInvNo}</th><th>${thDept}</th><th>${thService}</th><th>${thQty}</th><th>${thPrice}</th><th>${thTotal}</th></tr></thead><tbody>${rows}</tbody></table><div class="middle-section"><div class="disclaimer">${disclaimer}</div><div class="small-totals"><table>${totals}</table></div></div><div class="signatures"><div class="signature-box">${sigPayer}<div class="signature-line"></div><span class="signature-name">&nbsp;</span></div><div class="signature-box">${sigCashier} <strong>${esc(payment?.receivedByName||'—')}</strong><div class="signature-line"></div></div></div></div></body></html>`;
  }

  // An invoice's entry date is independent of when its payments were received.
  function invoiceEntryDate(invoice){
    if(!invoice || !Number.isFinite(Number(invoice.createdAt)))return '';
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Number(invoice.createdAt)));
  }

  function paymentHistoryHtml(items,bills,entryDate){
    // Reuse the exact individual receipt template, including service quantities,
    // unit prices, discounts and cashier signatures. Never use a generic payment row.
    const documents=items.map(payment=>new DOMParser().parseFromString(receiptHtml(payment,bills.get(payment.invoiceId)),'text/html'));
    const sections=documents.map((doc,index)=>{
      const container=doc.querySelector('.invoice-container');
      container.id='combined-receipt-'+index;
      const invoice=invoiceList.find(item=>item.id===items[index].invoiceId);
      const note=doc.createElement('p');note.className='combined-receipt-reference';
      note.textContent=`វិក្កយបត្រ: ${invoice?.invoiceNo||items[index].invoiceNo||'—'} · ថ្ងៃបញ្ចូល: ${entryDate}`;
      container.querySelector('.patient-info').before(note);
      return container.outerHTML;
    });
    const totals=['KHR','USD'].filter(c=>items.some(item=>item.currency===c)).map(c=>{
      const total=items.filter(item=>item.currency===c).reduce((sum,item)=>sum+Number(item.amount||0),0);
      return `<div>សរុបប្រាក់ដែលបានទទួល ${c}: <strong>${esc(money(total,c))}</strong></div>`;
    }).join('');
    const heading=`<div class="combined-receipt-summary"><h3 class="invoice-moul">បង្កាន់ដៃសរុប</h3><p>ថ្ងៃបញ្ចូលវិក្កយបត្រ: ${esc(entryDate)} · ចំនួនបង្កាន់ដៃ: ${items.length}</p>${totals}</div>`;
    sections[0]=sections[0].replace(/(<div[^>]*class="invoice-container"[^>]*>)/,'$1'+heading);
    return `<!DOCTYPE html><html lang="km"><head>${documents[0].head.innerHTML}<style>html body.emr-report-print.combined-receipts .emr-print-root{overflow:visible!important}</style></head><body class="combined-receipts">${sections.join('')}</body></html>`;
  }

  function openPaymentHistoryPrint(){
    if(!currentBill){alert('សូមជ្រើសអ្នកជំងឺជាមុន។');return}
    const paidInvoices=new Set(paymentHistory.filter(item=>!item.voidedAt).map(item=>item.invoiceId));
    const dates=[...new Set(invoiceList.filter(item=>paidInvoices.has(item.id)).map(invoiceEntryDate).filter(Boolean))].sort().reverse();
    $('history-print-date').innerHTML=dates.map(day=>`<option value="${esc(day)}">${esc(day)}</option>`).join('');
    const selectedDate=invoiceEntryDate(currentBill.invoice);
    if(dates.includes(selectedDate))$('history-print-date').value=selectedDate;
    setStatus('payment-history-print-status',dates.length?'':'មិនទាន់មានបង្កាន់ដៃដែលមានសុពលភាពទេ។');
    $('confirm-payment-history-print').disabled=!dates.length;
    $('payment-history-print-dialog').showModal();
  }

  async function confirmPaymentHistoryPrint(){
    const day=$('history-print-date').value;
    const ids=new Set(invoiceList.filter(invoice=>invoiceEntryDate(invoice)===day).map(invoice=>invoice.id));
    const items=paymentHistory.filter(payment=>!payment.voidedAt&&ids.has(payment.invoiceId));
    if(!day||!items.length){setStatus('payment-history-print-status','មិនមានបង្កាន់ដៃសម្រាប់ថ្ងៃបញ្ចូលនេះទេ។');return}
    const patientKey=currentKey,button=$('confirm-payment-history-print');button.disabled=true;
    try{
      const bills=new Map();
      await Promise.all([...new Set(items.map(item=>item.invoiceId))].map(async id=>{
        const response=await api('/api/finance/patient?patientKey='+encodeURIComponent(patientKey)+'&invoiceId='+encodeURIComponent(id));
        bills.set(id,response.bill);
      }));
      const html=paymentHistoryHtml(items,bills,day);
      $('payment-history-print-dialog').close();
      await window.previewEmrHtml(html,'Combined receipts',{
        selectors:items.map((_,index)=>'#combined-receipt-'+index),separatePages:true
      });
    }catch(error){setStatus('payment-history-print-status',error.message);}
    finally{button.disabled=false;}
  }
  function printInvoice(lang='km'){
    if(!currentBill){alert('សូមជ្រើសអ្នកជំងឺជាមុន។');return}
    return window.previewEmrHtml(invoiceHtml(currentBill,lang),'Invoice');
  }

  async function printReceipt(paymentId,lang='km'){
    let payment=paymentHistory.find(item=>item.id===paymentId)||currentBill?.payments?.find(item=>item.id===paymentId);
    if(!payment){alert('រកមិនឃើញបង្កាន់ដៃនេះទេ។');return}
    const patientKey=currentKey;
    let bill=currentBill;
    let html;
    try {
      if(payment.invoiceId&&payment.invoiceId!==currentBill?.invoice?.id){
        const response=await api('/api/finance/patient?patientKey='+encodeURIComponent(patientKey)+'&invoiceId='+encodeURIComponent(payment.invoiceId));
        bill=response.bill;
      }
      html=receiptHtml(payment,bill,lang);
    } catch(error){alert(error.message);return;}
    return window.previewEmrHtml(html,'Payment receipt');
  }


  function printLatestReceipt(){
    if(!currentBill){alert('សូមជ្រើសអ្នកជំងឺជាមុន។');return}
    const payment=(currentBill.payments||[]).filter(item=>!item.voidedAt).sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt))[0];
    if(!payment){
      alert('មិនទាន់មានការទូទាត់ទេ។ សូមកត់ត្រាការទូទាត់មុនពេលបោះពុម្ពបង្កាន់ដៃ។');
      return;
    }
    printReceipt(payment.id);
  }

  let serviceLoad=0;
  async function loadServices(type=payer()){
    const seq=++serviceLoad,d=await api('/api/finance/services?paymentType='+encodeURIComponent(type));if(seq!==serviceLoad)return;
    serviceCategories=d.categories||[];services=d.services||[];serviceDepartments=d.departments||[];
    const usedCategories=new Set(services.filter(s=>s.active!==false).map(s=>s.categoryCode));
    cashierServiceCategories=serviceCategories.filter(category=>usedCategories.has(category.code));
    fillServiceCategories();
    fillPaymentServiceCategories();
  }

  async function loadExchange(){exchangeState=await api('/api/finance/exchange-rates');renderExchange();}
  function renderExchange(){const active=exchangeState?.active;$('exchange-active').textContent=active?`អត្រាបច្ចុប្បន្ន៖ 1 USD = ${Number(active.khrPerUsd).toLocaleString()} ៛`:'មិនទាន់មានអត្រាដែលបានអនុម័ត';$('exchange-proposal').hidden=!['ACCOUNTANT','CLERK'].includes(role);const pending=(exchangeState?.requests||[]).filter(x=>x.status==='PENDING');$('exchange-requests').innerHTML=pending.map(x=>`<div class="exchange-request"><span><strong>1 USD = ${Number(x.khrPerUsd).toLocaleString()} ៛</strong><small>${esc(x.proposedByName)} · ${new Date(x.proposedAt).toLocaleString()}</small></span>${['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)?`<button type="button" data-rate-review="${x.id}" data-approved="true">អនុម័ត</button><button type="button" class="reject" data-rate-review="${x.id}" data-approved="false">បដិសេធ</button>`:'<em>រង់ចាំការអនុម័ត</em>'}</div>`).join('');}
  function fillServiceCategories(){
    const current=$('service-category').value;
    $('service-category').innerHTML=cashierServiceCategories.map(x=>`<option value="${esc(x.code)}">${esc(label(x))}</option>`).join('');
    if(cashierServiceCategories.some(x=>x.code===current))$('service-category').value=current;
    renderServiceOptions();
  }
  function servicesForCategory(){return services.filter(s=>s.active!==false&&s.categoryCode===$('service-category').value)}
  function fillPaymentServiceCategories(){
    const current=$('payment-service-category').value;
    $('payment-service-category').innerHTML=`<option value="GENERAL">ទូទៅ</option>`+cashierServiceCategories.map(x=>`<option value="${esc(x.code)}">${esc(label(x))}</option>`).join('');
    if(current&&['GENERAL',...cashierServiceCategories.map(x=>x.code)].includes(current))$('payment-service-category').value=current;
    renderPaymentServiceOptions();
  }
  function renderPaymentServiceOptions(){
    const category=$('payment-service-category').value;
    if(category==='GENERAL'){$('payment-service-select').innerHTML='<option value="">វិក្កយបត្រទូទៅ</option>';return}
    const list=services.filter(s=>s.active!==false&&s.categoryCode===category);
    $('payment-service-select').innerHTML='<option value="">សរុបតាមផ្នែក</option>'+list.map(s=>`<option value="${esc(s.code)}">${esc(label(s))}</option>`).join('');
  }
  function renderServiceOptions(preferred=''){
    const list=servicesForCategory();
    $('service-select').innerHTML=list.map(s=>`<option value="${esc(s.code)}">${esc(label(s))}</option>`).join('');
    if(preferred&&list.some(s=>s.code===preferred))$('service-select').value=preferred;
    syncSelectedService();
  }
  function selectedService(){return services.find(s=>s.code===$('service-select').value)||null}
  function syncSelectedService(){
    const s=selectedService();
    if(!s){$('selected-service').innerHTML='មិនមានសេវាក្នុងប្រភេទនេះទេ។';return}
    const rate=Number(exchangeState?.active?.khrPerUsd||0);
    const converted=payer()==='DIRECT'&&s.currency==='USD'&&rate>0;
    $('charge-price').readOnly=payer()!=='DIRECT';$('charge-currency').disabled=payer()!=='DIRECT';
    $('charge-price').value=converted?Number(s.defaultAmount||0)*rate:Number(s.defaultAmount||0);
    $('charge-currency').value=converted?'KHR':(s.currency||'KHR');
    const conversion=converted?` = ${money(Number(s.defaultAmount||0)*rate,'KHR')} (1 USD = ${rate.toLocaleString()} ៛)`:'';
    $('selected-service').innerHTML=`<strong>${esc(label(s))}</strong> · ${esc(s.category?.labelKh||s.category?.labelEn||'')}<br>តម្លៃលំនាំដើម: ${money(s.defaultAmount,s.currency)}${conversion}${Number(s.defaultAmount||0)===0?' · <em>សូមបញ្ចូលតម្លៃ</em>':''}`;
  }
  async function search(){
    const q=$('patient-search').value.trim();
    const d=await api('/api/finance/patients?view=queue&q='+encodeURIComponent(q));
    patients=d.patients||[];
    patients.sort((a,b)=>Number(Boolean(b.paraclinicPaymentPending))-Number(Boolean(a.paraclinicPaymentPending)));
    $('patient-results').innerHTML=patients.map(p=>{const paid=isPaidStatus(p.paymentStatus);return `<button class="patient-card ${p.patientKey===currentKey?'active':''} ${p.paraclinicPaymentPending?'needs-paraclinic-payment':''}" data-key="${esc(p.patientKey)}" data-invoice-id="${esc(p.cashierInvoiceId||'')}"><strong>${esc(p.fullName||'(គ្មានឈ្មោះ)')}</strong><span>${esc(p.caseNumber||p.healthId)} · ${esc(p.departmentNameKh||p.departmentNameEn||'')}</span>${p.paraclinicPaymentPending?'<span class="paraclinic-cashier-flag">Paraclinic order · cashier payment required</span>':''}<span class="patient-payment-status" data-paid="${paid}">${paid?'✓ ':''}${esc(paymentStatusLabel(p.paymentStatus))}</span></button>`}).join('')||'<p>No ward-sent invoices are waiting for payment.</p>';
  }
  function registerDate(value){if(!value)return '—';const date=typeof value==='number'?new Date(value):new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('en-GB')}
  function registerPaymentDate(patient){if(patient.paymentDate)return new Date(Number(patient.paymentDate)).toLocaleString('en-GB');return ['NOT_PAID','PARTIAL'].includes(patient.paymentStatus?.code)?'Pending payment':'—'}
  async function searchPaymentRegister(){
    const q=$('payment-register-search').value.trim();
    const dateFilter=$('payment-register-date')?.value||'';
    const d=await api('/api/finance/patients?view=register&q='+encodeURIComponent(q));
    let rows=d.patients||[];
    if(dateFilter){
      rows=rows.filter(p=>{
        const entry=p.entryDate?String(p.entryDate).slice(0,10):'';
        const exit=p.exitDate?String(p.exitDate).slice(0,10):'';
        const pay=p.paymentDate?paymentDay(p.paymentDate):'';
        return entry===dateFilter||exit===dateFilter||pay===dateFilter;
      });
    }
    $('payment-register-body').innerHTML=rows.map((p,index)=>`<tr><td>${esc(p.registrationNumber||index+1)}</td><td><strong>${esc(p.caseNumber||p.healthId||'—')}</strong>${p.healthId&&p.caseNumber?`<br><small>${esc(p.healthId)}</small>`:''}</td><td>${esc(p.fullName||'—')}</td><td>${esc(p.sex||'—')}</td><td>${esc(p.age||'—')}</td><td>${esc(registerDate(p.entryDate))}</td><td>${esc(registerDate(p.exitDate))}</td><td>${esc(registerPaymentDate(p))}</td><td><span class="register-status ${isPaidStatus(p.paymentStatus)?'paid':'pending'}">${esc(paymentStatusLabel(p.paymentStatus))}</span></td><td><button type="button" class="invoice-view-icon" data-view-invoices="${esc(p.patientKey)}" title="មើលវិក្កយបត្រ" aria-label="មើលវិក្កយបត្រ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C7 5 3 9 1 12c2 3 6 7 11 7s9-4 11-7c-2-3-6-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg></button></td></tr>`).join('')||'<tr><td colspan="10">មិនមានអ្នកជំងឺត្រូវគ្នានឹងការស្វែងរក ឬកាលបរិច្ឆេទនេះទេ។</td></tr>';
  }
  function fillPaymentOptions(){
    $('payment-type').innerHTML=paymentTypes.map(x=>`<option value="${x.code}">${esc(label(x))}</option>`).join('');
    $('direct-payment-type').innerHTML=directPaymentTypes.map(x=>`<option value="${x.code}">${esc(label(x))}</option>`).join('');
    $('payment-purpose').innerHTML=paymentPurposes.map(x=>`<option value="${x.code}">${esc(label(x))}</option>`).join('');
  }
  function paymentSourceForType(type){if(type==='DIRECT'||type==='NOT_PAID'||type==='CASH')return 'CASH';if(String(type).startsWith('NSSF'))return 'NSSF';if(String(type).startsWith('HEF'))return 'HEF';return 'OTHER'}
  function activeBillCurrencies(bill=currentBill){return ['KHR','USD'].filter(c=>{const s=bill?.summary?.[c]||{};return Number(s.gross||0)>0||Number(s.paid||0)>0})}
  function previewCurrency(currencyCode){
    const s=currentBill?.summary?.[currencyCode]||{gross:0,paid:0};
    const mode=$('adjustment-mode')?.value||'FULL';
    let adjustment=0,patientDue=Number(s.gross||0);
    if(payer()!=='DIRECT')return {gross:Number(s.gross||0),adjustment:0,paid:Number(s.paid||0),balance:Math.max(0,Number(s.gross||0)-Number(s.paid||0))};
    if(mode==='FULL_WAIVER'){adjustment=patientDue;patientDue=0}
    else if(mode==='FIXED_DISCOUNT'&&$('adjustment-currency').value===currencyCode){adjustment=Math.min(patientDue,Math.max(0,Number($('adjustment-amount').value||0)));patientDue=Math.max(0,patientDue-adjustment)}
    else if(mode==='PERCENT_DISCOUNT'||mode==='PARTIAL_WAIVER'){adjustment=Math.round(patientDue*Math.min(100,Math.max(0,Number($('adjustment-percent').value||0)))/100*(currencyCode==='USD'?100:1))/(currencyCode==='USD'?100:1);patientDue=Math.max(0,patientDue-adjustment)}
    return {gross:Number(s.gross||0),adjustment,paid:Number(s.paid||0),balance:Math.max(0,patientDue-Number(s.paid||0))};
  }
  function renderPaymentPreview(){
    if(!currentBill)return;
    const currencies=activeBillCurrencies();
    $('payment-total-strip').innerHTML=currencies.map(c=>{const p=previewCurrency(c);return `<div><span>${c}</span><b>${money(p.gross,c)}</b><small>បញ្ចុះ/លើកលែង ${money(p.adjustment,c)}</small><strong>ត្រូវបង់ ${money(p.balance,c)}</strong></div>`}).join('')||'<div class="no-balance">មិនទាន់មានថ្លៃសេវា</div>';
    const balances=currencies.map(currency=>({currency,amount:previewCurrency(currency).balance})).filter(x=>x.amount>0);
    const covered=payer()!=='DIRECT',locked=Boolean(currentBill.invoice?.closedAt);
    if(covered){
      $('payment-total-strip').innerHTML=currencies.map(c=>`<div><span>${c}</span><b>${money(currentBill.summary[c].gross,c)}</b><strong>${en()?'Payer receivable':'អ្នកធានាត្រូវបង់'} ${money(currentBill.summary[c].payerDue||currentBill.summary[c].gross,c)}</strong></div>`).join('');
      $('balance-shortcuts').innerHTML=currencies.length&&!locked?`<button type="button" class="balance-button" data-complete-payment ${paymentInProgress?'disabled':''}>${en()?'Confirm coverage':'ផ្ទៀងផ្ទាត់ការធានាចំណាយ'}</button>`:`<span class="status ok">${en()?'Coverage confirmed':'បានផ្ទៀងផ្ទាត់ការធានា'}</span>`;return;
    }
    $('balance-shortcuts').innerHTML=currencies.length&&!locked?`<button type="button" class="balance-button" data-complete-payment ${paymentInProgress?'disabled':''}>${en()?'Pay':'បង់ប្រាក់'}</button><small>${balances.map(x=>money(x.amount,x.currency)).join(' + ')}</small>`:`<span class="status ok">${en()?'No outstanding balance':'មិនមានសមតុល្យត្រូវបង់'}</span>`;
  }

  function toggleProfile(){
    const type=$('payment-type').value;
    $('direct-wrap').hidden=true;$('discount-wrap').hidden=true;$('discount-currency-wrap').hidden=true;
    document.querySelector('.fee-adjustment').hidden=type!=='DIRECT';
    $('nssf-subtype-wrap').hidden=type!=='NSSF';$('payer-name-wrap').hidden=!['INSURANCE','NGO'].includes(type);
    renderPaymentPreview();
  }

  function syncAdjustmentFields(profile=currentBill?.profile||{}){
    const subtype=profile.paymentSubtype||'FULL';
    let mode='FULL';
    if(subtype==='FULL_WAIVER'||profile.paymentType==='EXEMPT')mode='FULL_WAIVER';
    else if(subtype==='PARTIAL_WAIVER')mode='PERCENT_DISCOUNT';
    else if(subtype==='DISCOUNT')mode=Number(profile.discountAmount||0)>0?'FIXED_DISCOUNT':'PERCENT_DISCOUNT';
    $('adjustment-mode').value=mode;
    $('adjustment-amount').value=profile.discountAmount||0;
    $('adjustment-currency').value=profile.discountCurrency||'KHR';
    $('adjustment-percent').value=profile.discountPercent||0;
    toggleAdjustmentFields();
  }
  function toggleAdjustmentFields(){
    const mode=$('adjustment-mode').value;
    $('adjustment-amount-wrap').hidden=mode!=='FIXED_DISCOUNT';
    $('adjustment-currency-wrap').hidden=mode!=='FIXED_DISCOUNT';
    $('adjustment-percent-wrap').hidden=!['PERCENT_DISCOUNT','PARTIAL_WAIVER'].includes(mode);
    $('cash-waiver-panel').hidden=mode!=='FULL_WAIVER';
    renderPaymentPreview();
  }
  function renderBill(){
    const b=currentBill,p=b.patient;
    $('new-patient-invoice').dataset.newPatientInvoice=currentKey;
    $('new-patient-invoice').dataset.patientName=p.fullName||'';
    $('empty-state').hidden=true;$('bill-workspace').hidden=false;
    $('patient-name').textContent=p.fullName||'(គ្មានឈ្មោះ)';
    $('patient-meta').textContent=[p.caseNumber||p.healthId,p.departmentNameKh||p.departmentNameEn,p.serviceMode?.toUpperCase()].filter(Boolean).join(' · ');
    const picker=$('invoice-picker');
    picker.innerHTML=invoiceList.map(item=>{const amount=['KHR','USD'].filter(c=>Number(item.amounts?.[c]?.gross||0)>0).map(c=>money(item.amounts[c].gross,c)).join(' + ')||'—';return `<option value="${esc(item.id)}">${esc(item.invoiceNo)} · ${item.status==='COVERED'?'បានផ្ទៀងផ្ទាត់ការធានា':item.status==='PAID'?'បានបង់':item.status==='UNPAID'?'មិនទាន់បង់':'ទទេ'} · ${esc(amount)}</option>`}).join('');
    picker.value=b.invoice?.id||'';
    fillPaymentOptions();
    $('payment-type').value=major(b.profile.paymentType);
    $('nssf-subtype').value=b.profile.nssfSubtype||'';$('payer-name').value=b.profile.payerName||'';
    if(!directPaymentTypes.some(x=>x.code===b.profile.paymentSubtype)&&b.profile.paymentSubtype)$('direct-payment-type').insertAdjacentHTML('beforeend',`<option value="${esc(b.profile.paymentSubtype)}">${esc(b.profile.paymentSubtype)} (ទិន្នន័យចាស់)</option>`);
    $('direct-payment-type').value=b.profile.paymentSubtype||'FULL';
    $('discount-amount').value=b.profile.discountAmount||0;
    $('discount-currency').value=b.profile.discountCurrency||'KHR';
    $('payer-reference').value=b.profile.payerReference||'';
    $('profile-note').value=b.profile.note||'';
    syncAdjustmentFields(b.profile);
    toggleProfile();
    const locked=Boolean(b.invoice?.closedAt)||(Number(b.summary?.KHR?.gross||0)+Number(b.summary?.USD?.gross||0)>0&&Number(b.summary?.KHR?.balance||0)+Number(b.summary?.USD?.balance||0)<=0);
    const status=selectedPaymentStatus||patients.find(x=>x.patientKey===currentKey)?.paymentStatus;
    const statusLabel=paymentStatusLabel(status||{labelKh:b.profile.paymentType,labelEn:''});
    $('patient-payment-badge').textContent=statusLabel;
    $('patient-payment-badge').className='payment-badge '+(isPaidStatus(status)?'payment-paid':'payment-not-paid');
    renderPaymentPreview();
    const activeCharges=(b.charges||[]).filter(x=>!x.voidedAt);
    $('charges-body').innerHTML=activeCharges.map(x=>{
      const summary=b.summary?.[x.currency]||{};
      const profile=b.profile||{};
      const fullWaiver=profile.paymentType==='EXEMPT'||(profile.paymentType==='DIRECT'&&profile.paymentSubtype==='FULL_WAIVER');
      const paid=Number(summary.paid||0)>0&&Number(summary.balance||0)<=0;
      const partial=Number(summary.paid||0)>0&&Number(summary.balance||0)>0;
      const fullyAdjusted=Number(summary.balance||0)<=0&&Number(summary.paid||0)<=0&&(Number(summary.discount||0)>0||Number(summary.waived||0)>0);
      const state=b.profile.coverageAt?{className:'settled',label:en()?'Coverage confirmed':'បានផ្ទៀងផ្ទាត់ការធានា'}:fullWaiver?{className:'waived',label:'អនុគ្រោះទាំងស្រុង'}:paid?{className:'settled',label:'បានទូទាត់'}:fullyAdjusted?{className:'waived',label:'មិនត្រូវបង់ប្រាក់'}:partial?{className:'partial',label:'បានបង់មួយផ្នែក'}:{className:'pending',label:'មិនទាន់បង់'};
      const settled=fullWaiver||paid||fullyAdjusted;
      const canDelete=false;
      const desc=chargeServiceLabel(x,false);
      const dept=chargeCategoryLabel(x,false,p.departmentNameKh,p.departmentNameEn);
      return `<tr><td><strong>${esc(desc)}</strong>${x.pmrsCode?`<small>${esc(x.pmrsCode)} · ${esc(x.tariffFacility)}</small>`:''}${x.note?`<small class="charge-note">${esc(x.note)}</small>`:''}</td><td>${esc(dept)}</td><td>${esc(x.quantity)}</td><td>${money(Number(x.amount||0)/Math.max(1,Number(x.quantity||1)),x.currency)}</td><td><strong>${money(x.amount,x.currency)}</strong></td><td><span class="charge-state ${state.className}">${state.label}</span></td><td></td></tr>`
    }).join('')||'<tr><td colspan="7" class="empty-charges">មិនទាន់មានសេវាទេ។ សូមបន្ថែមសេវាខាងលើ។</td></tr>';
    let support=document.getElementById('invoice-service-concessions');if(!support){support=document.createElement('section');support.id='invoice-service-concessions';$('invoice-totals').after(support);}
    support.innerHTML=`${(b.serviceConcessions||[]).map(x=>{const sig=(()=>{try{return JSON.parse(x.signatureJson||'{}')}catch{return {}}})();return `<p>ការលើកលែងបានអនុម័ត / Approved concession: <strong>${esc(x.description)}</strong> · ${money(x.currency==='USD'?x.amountMinor/100:x.amountMinor,x.currency)}<br><small>${esc(x.reason)} · ${esc(sig.name||'')} · ${esc(sig.signedAt?new Date(sig.signedAt).toLocaleString():'')}</small></p>`;}).join('')}<a class="button" href="/requests?${new URLSearchParams({kind:'FEE',patientKey:currentKey})}">ស្នើលើកលែង ឬបញ្ចុះថ្លៃ / Request concession</a>`;
    $('invoice-totals').innerHTML=activeBillCurrencies(b).map(c=>{const s=b.summary?.[c]||{};return `<div><span>សរុប ${c}</span><strong>${money(s.gross||0,c)}</strong><small>បានបង់ ${money(s.paid||0,c)} · នៅសល់ ${money(s.balance||0,c)}</small></div>`}).join('')||'<div class="no-balance">មិនទាន់មានថ្លៃសេវា</div>';
    $('payments-body').innerHTML=paymentHistory.map(x=>{
      const attachments=(x.attachments||[]).map(a=>`<a href="/api/finance/payment-attachments/${a.id}" target="_blank">${esc(a.filename)}</a>`).join('');
      return `<tr class="${x.voidedAt?'voided':''}"><td>${esc(x.invoiceNo||'—')}</td><td><span class="receipt-no">${esc(x.receiptNo||'—')}</span><br><small>${esc(x.reference||'')}</small></td><td>${new Date(x.receivedAt).toLocaleString()}</td><td>${esc(sourceLabel(x.source))}<br><small>${esc(paymentPurposes.find(p=>p.code===x.purpose)?.labelKh||x.purpose||'')}</small>${x.serviceCode?`<br><small>${esc(services.find(s=>s.code===x.serviceCode)?.nameKh||x.serviceCode)}</small>`:(x.categoryCode?`<br><small>${esc(serviceCategories.find(c=>c.code===x.categoryCode)?.labelKh||x.categoryCode)}</small>`:'')}<br><small class="cashier-name">បេឡាករ៖ ${esc(x.receivedByName||'—')}</small></td><td>${money(x.amount,x.currency)}</td><td><div class="attachment-links">${attachments||'—'}</div></td><td><div class="receipt-actions">${x.voidedAt?`<span class="void-label">បានកែតម្រូវ${x.voidReason?`<br><small>${esc(x.voidReason)}</small>`:''}</span>`:''}<button class="receipt-print-btn" type="button" data-print-receipt="${x.id}">បោះពុម្ពបង្កាន់ដៃ</button></div></td></tr>`;
    }).join('')||'<tr><td colspan="7">មិនទាន់មានប្រវត្តិការទូទាត់ទេ។</td></tr>';
    window.dispatchEvent(new CustomEvent('cashier:bill-loaded',{detail:{patientKey:currentKey,bill:b}}));
    if(['CLERK','ACCOUNTANT'].includes(role))document.querySelectorAll('#bill-workspace .cashier-command-panel input,#bill-workspace .cashier-command-panel select,#bill-workspace .cashier-command-panel button').forEach(control=>{control.disabled=locked&&!control.closest('#charge-form')});
  }
  async function openPatient(key,invoiceId=''){
    currentKey=key;const d=await api('/api/finance/patient?patientKey='+encodeURIComponent(key)+(invoiceId?'&invoiceId='+encodeURIComponent(invoiceId):''));
    currentBill=d.bill;selectedPaymentStatus=d.paymentStatus||null;invoiceList=d.invoices||[];paymentHistory=d.paymentHistory||[];paymentTypes=d.paymentTypes||[];directPaymentTypes=d.directPaymentTypes||[];hefTypes=d.hefTypes||[];paymentPurposes=d.paymentPurposes||[];
    await search();renderBill();await loadServices(major(currentBill.profile.paymentType));window.dispatchEvent(new Event('cashier-alerts-refresh'));
  }
  window.openCashierPaymentInvoice=(key,invoiceId)=>{showBillingTab('billing');return openPatient(key,invoiceId);};
  async function voidItem(kind,id){
    const reason=prompt('មូលហេតុនៃការលុប ឬកែតម្រូវ:');if(!reason)return;
    const patientKey=currentKey,invoiceId=currentBill?.invoice?.id||'';
    await api('/api/finance/void',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,reason})});
    if(patientKey===currentKey)await openPatient(patientKey,invoiceId);
  }
  async function uploadPaymentFiles(paymentId,files){
    for(const file of files){
      const response=await fetch(`/api/finance/payments/${paymentId}/attachments`,{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf,'X-File-Name':file.name,'Content-Type':file.type},body:file});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`មិនអាចភ្ជាប់ឯកសារ ${file.name} បានទេ`);
    }
  }
  async function recordPayment({amount,currency,quick=false,sourceOverride=''}){
    if(!currentKey)return;
    const files=[...($('payment-files')?.files||[])];
    const source=sourceOverride||paymentSourceForType($('payment-type').value);
    const payload={patientKey:currentKey,invoiceId:currentBill?.invoice?.id||'',source,purpose:$('payment-purpose').value,categoryCode:$('payment-service-category').value,serviceCode:$('payment-service-select').value,amount:Number(amount),currency,reference:$('payment-reference').value,note:$('payment-note').value,receivedAt:selectedPaymentTimestamp()};
    const d=await api('/api/finance/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(files.length)await uploadPaymentFiles(d.payment.id,files);
    await openPatient(currentKey,d.payment?.invoiceId||'');
    if($('payment-files'))$('payment-files').value='';
    if($('payment-reference'))$('payment-reference').value='';
    if($('payment-note'))$('payment-note').value='';
    setPaymentDateTimeNow();
    setStatus(quick?'quick-payment-status':'payment-status',`បានទទួលប្រាក់ · ${d.payment.receiptNo||''} · បេឡាករ៖ ${d.payment.receivedByName||'—'}`,true);
    return d;
  }
  async function completeFullBalance(button){
    if(!currentKey||!currentBill||paymentInProgress)return;
    if(payer()==='DIRECT'&&$('adjustment-mode').value==='FULL_WAIVER'&&!window.cashierWaiverApproval){setStatus('quick-payment-status',en()?'Request approval before applying the full exemption.':'សូមស្នើ និងទទួលការអនុម័តជាមុន។');return}
    paymentInProgress=true;button.disabled=true;
    try{
      const mode=payer()==='DIRECT'?$('adjustment-mode').value:'FULL';
      const paymentSubtype=({FULL:'FULL',FIXED_DISCOUNT:'DISCOUNT',PERCENT_DISCOUNT:'DISCOUNT',PARTIAL_WAIVER:'PARTIAL_WAIVER',FULL_WAIVER:'FULL_WAIVER'})[mode]||'FULL';
      const discountAmount=mode==='FIXED_DISCOUNT'?Number($('adjustment-amount').value||0):0;
      const discountPercent=['PERCENT_DISCOUNT','PARTIAL_WAIVER'].includes(mode)?Number($('adjustment-percent').value||0):0;
      const files=[...($('payment-files')?.files||[])];
      const result=await api('/api/finance/complete-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:currentKey,invoiceId:currentBill?.invoice?.id||'',paymentType:payer(),...policy(),approvalId:window.cashierWaiverApproval||'',paymentSubtype,discountAmount,discountPercent,discountCurrency:$('adjustment-currency').value,payerReference:$('payer-reference').value,note:$('profile-note').value,source:'CASH',purpose:$('payment-purpose').value,categoryCode:$('payment-service-category').value,serviceCode:$('payment-service-select').value,reference:$('payment-reference').value,paymentNote:$('payment-note').value,receivedAt:selectedPaymentTimestamp()})});
      if(files.length&&result.payments?.length){
        try{await uploadPaymentFiles(result.payments[result.payments.length-1].id,files)}
        catch(error){setStatus('quick-payment-status',`ប្រាក់បានទូទាត់ ប៉ុន្តែឯកសារភ្ជាប់មិនបានរក្សាទុក៖ ${error.message}`)}
      }
      await openPatient(currentKey,result.bill?.invoice?.id||'');
      if($('payment-files'))$('payment-files').value='';
      if($('payment-reference'))$('payment-reference').value='';
      if($('payment-note'))$('payment-note').value='';
      setPaymentDateTimeNow();
      const paid=isPaidStatus(result.paymentStatus);
      const waiver=result.paymentStatus?.code==='FULL_WAIVER';
      const totals=(result.payments||[]).map(payment=>money(payment.amount,payment.currency)).join(' + ');
      if(!files.length||!result.payments?.length||isPaidStatus(result.paymentStatus))setStatus('quick-payment-status',waiver?'បានលើកលែងទាំងស្រុង · ស្ថានភាពអ្នកជំងឺបានធ្វើបច្ចុប្បន្នភាព។':paid?(totals?`បានបង់ប្រាក់រួច · ${totals}`:'អ្នកជំងឺបានបង់ប្រាក់រួច។'):'បានរក្សាទុកការកែតម្រូវ ប៉ុន្តែនៅមានសមតុល្យត្រូវបង់។',paid||waiver);
      setStatus('adjustment-status',payer()!=='DIRECT'?(en()?'Coverage confirmed; recorded as a payer receivable.':'បានផ្ទៀងផ្ទាត់ការធានា និងកត់ត្រាប្រាក់ត្រូវទទួលពីអ្នកធានា។'):'បានរក្សាទុកការកែតម្រូវតាមប៊ូតុងបង់ប្រាក់។',true);
    }catch(error){setStatus('quick-payment-status',`មិនអាចរក្សាទុក ឬទូទាត់បានទេ៖ ${error.message}`)}
    finally{paymentInProgress=false;const activeButton=$('balance-shortcuts').querySelector('[data-complete-payment]');if(activeButton)activeButton.disabled=false}
  }

  function showBillingTab(tab){
    const price=tab==='prices',register=tab==='register';
    $('billing-workspace-view').hidden=price||register;$('payment-register-view').hidden=!register;$('price-list-view').hidden=!price;
    $('billing-tab-button').classList.toggle('active',!price&&!register);$('billing-tab-button').setAttribute('aria-selected',String(!price&&!register));
    $('payment-register-tab-button').classList.toggle('active',register);$('payment-register-tab-button').setAttribute('aria-selected',String(register));
    $('price-list-tab-button').classList.toggle('active',price);$('price-list-tab-button').setAttribute('aria-selected',String(price));
    if(price)loadServices('DIRECT').then(renderServiceCatalog).catch(console.error);else if(!register)loadServices().catch(console.error);
  }
  function renderServiceCatalog(){
    const list=$('service-catalog-list');if(!list)return;
    const groups=[
      {code:'CONSULTATION',title:'I · ផ្នែកពិគ្រោះជំងឺក្រៅ (OPD)',codes:['CONSULTATION']},
      {code:'BED',title:'II · ផ្នែកជំងឺសម្រាកពេទ្យ',codes:['BED']},
      {code:'OBSTETRIC',title:'III · ផ្នែកសម្ភព និងរោគស្ត្រី (GO)',codes:['OBSTETRIC']},
      {code:'EMERGENCY',title:'IV · ផ្នែកសង្គ្រោះបន្ទាន់ (REA)',codes:['EMERGENCY']},
      {code:'IMAGING',title:'V · ផ្នែករូបភាពវេជ្ជសាស្ត្រ',codes:['IMAGING']},
      {code:'SURGERY',title:'VI · ផ្នែកវះកាត់ និងថែទាំរបួស',codes:['SURGERY','PROCEDURE']},
      {code:'LAB',title:'VII · ផ្នែកមន្ទីរពិសោធន៍',codes:['LAB']},
      {code:'DENTAL',title:'VIII · ផ្នែកជំងឺមាត់ធ្មេញ',codes:['DENTAL']},
      {code:'EYE_CARE',title:'IX · ផ្នែកថែទាំភ្នែក',codes:['EYE_CARE']},
      {code:'AMBULANCE',title:'X · ផ្នែករថយន្តសង្គ្រោះ',codes:['AMBULANCE']},
    ];
    const known=new Set(groups.flatMap(group=>group.codes));
    const remaining=[...new Set(services.map(service=>service.categoryCode).filter(code=>!known.has(code)))].sort();
    remaining.forEach((code,index)=>groups.push({code,title:`XI${remaining.length>1?`-${index+1}`:''} · ${esc(services.find(service=>service.categoryCode===code)?.category?.labelKh||code)}`,codes:[code]}));
    let number=0;
    const renderRow=s=>{number++;const name=esc(label(s));return `<div class="service-row"><label class="service-row-active"><input type="checkbox" data-service-active="${esc(s.code)}" aria-label="ស្ថានភាពសកម្ម ${name}" ${s.active?'checked':''}><span>${number} · ${s.active?'សកម្ម':'អសកម្ម'}</span></label><div class="service-row-code"><strong>${esc(s.code)}</strong><br><small>${esc(s.departmentCode||'ALL')}</small></div><div class="service-row-name">${name}</div><div class="service-row-price">${money(s.defaultAmount,s.currency)}<small>${esc(s.currency)}</small></div><div class="service-row-actions"><button type="button" class="service-icon-button" title="កែប្រែ" aria-label="កែប្រែ ${name}" data-edit-service="${esc(s.code)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5Zm16.7-9.8a.93.93 0 0 0 0-1.3l-2.1-2.1a.93.93 0 0 0 0-1.3l-1.7 1.7 3.4 3.4 1.7-1.7Z"/></svg></button>${s.active?`<button type="button" class="service-icon-button delete" title="លុបចេញពីបញ្ជីបេឡា" aria-label="លុប ${name}" data-delete-service="${esc(s.code)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/></svg></button>`:''}</div></div>`};
    const rows=[];const used=new Set();
    for(const group of groups){const items=services.filter(service=>group.codes.includes(service.categoryCode)).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)||String(a.nameKh||a.code).localeCompare(String(b.nameKh||b.code),'km'));if(!items.length)continue;items.forEach(item=>used.add(item.code));rows.push(`<div class="service-category-divider" style="display:flex;justify-content:space-between;align-items:center;"><span>${group.title}</span><button type="button" class="secondary-button" style="padding:4px 12px; font-size:13px; font-weight:bold; border-radius:14px; cursor:pointer; background:#e9f7fb; color:#075f81; border:none;" title="បន្ថែមសេវាថ្មី" aria-label="បន្ថែមសេវាថ្មី ${esc(group.title)}" data-add-service-category="${esc(group.codes[0])}">បន្ថែមសេវា ${group.title}</button></div>`,...items.map(renderRow))}
    services.filter(service=>!used.has(service.code)).sort((a,b)=>String(a.categoryCode).localeCompare(String(b.categoryCode))||Number(a.sortOrder||0)-Number(b.sortOrder||0)).forEach(renderRow);
    const heading=`<div class="service-row service-row-heading"><span>${en()?'Status':'ស្ថានភាព'}</span><span>${en()?'Service code / department':'កូដសេវា / ផ្នែក'}</span><span>${en()?'Service name':'ឈ្មោះសេវា'}</span><span class="service-row-price">${en()?'Price':'តម្លៃ'}</span><span class="service-row-actions">${en()?'Actions':'សកម្មភាព'}</span></div>`;
    list.innerHTML=rows.length?heading+rows.join(''):'<p class="service-catalog-empty">មិនទាន់មានសេវាក្នុងបញ្ជី។</p>';
  }
  function resetServiceEditor(categoryCode=''){const form=$('service-catalog-editor');form.reset();form.elements.editing.value='';form.elements.code.disabled=false;if(typeof categoryCode==='string'&&categoryCode)form.elements.categoryCode.value=categoryCode;form.elements.active.checked=true;$('price-list-status').textContent='';$('price-list-status').className='status';$('service-editor-dialog').showModal()}
  function fillServiceEditor(service){const form=$('service-catalog-editor');form.elements.editing.value=service.code;form.elements.code.value=service.code;form.elements.code.disabled=false;form.elements.categoryCode.value=service.categoryCode;form.elements.departmentCode.value=service.departmentCode||'ALL';form.elements.unitLabel.value=service.unitLabel||'service';form.elements.nameKh.value=service.nameKh||service.nameEn||'';form.elements.nameEn.value=service.nameEn||service.nameKh||'';form.elements.defaultAmount.value=service.defaultAmount;form.elements.currency.value=service.currency;form.elements.sortOrder.value=service.sortOrder||0;form.elements.active.checked=Boolean(service.active);$('price-list-status').textContent=`កំពុងកែប្រែ៖ ${service.code}`;$('price-list-status').className='status';$('service-editor-dialog').showModal()}
  function openServiceManager(){if(['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role))showBillingTab('prices')}
  function setupServiceCatalog(){
    const form=$('service-catalog-editor');
    form.elements.categoryCode.innerHTML=serviceCategories.map(c=>`<option value="${esc(c.code)}">${esc(c.labelKh||c.labelEn)}</option>`).join('');
    form.elements.departmentCode.innerHTML=serviceDepartments.map(d=>`<option value="${esc(d.code)}">${esc(d.labelKh||d.labelEn)}</option>`).join('');
    $('price-list-tab-button').hidden=!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role);
    $('billing-tab-button').addEventListener('click',()=>showBillingTab('billing'));
    $('payment-register-tab-button').addEventListener('click',()=>{showBillingTab('register');searchPaymentRegister().catch(error=>console.error(error))});
    $('price-list-tab-button').addEventListener('click',openServiceManager);
    $('price-list-reset').addEventListener('click',()=>$('service-editor-dialog').close());
    $('close-service-editor').addEventListener('click',()=>$('service-editor-dialog').close());
    $('service-catalog-list').addEventListener('change',async e=>{const checkbox=e.target.closest('[data-service-active]');if(!checkbox)return;const service=services.find(item=>item.code===checkbox.dataset.serviceActive);if(!service)return;const wasActive=service.active;checkbox.disabled=true;try{await api('/api/finance/services',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...service,active:checkbox.checked})});await loadServices('DIRECT');renderServiceCatalog();$('price-list-status').textContent=`បានប្ដូរស្ថានភាព ${service.code}។`;$('price-list-status').className='status ok'}catch(error){checkbox.checked=wasActive;$('price-list-status').textContent=error.message;$('price-list-status').className='status'}finally{checkbox.disabled=false}});
    $('service-catalog-list').addEventListener('click',async e=>{const add=e.target.closest('[data-add-service-category]');if(add){resetServiceEditor(add.dataset.addServiceCategory);return}const edit=e.target.closest('[data-edit-service]');if(edit){const service=services.find(item=>item.code===edit.dataset.editService);if(service)fillServiceEditor(service);return}const remove=e.target.closest('[data-delete-service]');if(!remove)return;const service=services.find(item=>item.code===remove.dataset.deleteService);if(!service||!confirm(`លុប “${service.nameKh||service.code}” ចេញពីបញ្ជីទាំងស្រុង? ប្រវត្តិវិក្កយបត្រចាស់នឹងនៅដដែល។`))return;const status=$('price-list-status');try{await api('/api/finance/services?code='+encodeURIComponent(service.code),{method:'DELETE'});await loadServices('DIRECT');renderServiceCatalog();if(form.elements.editing.value===service.code)resetServiceEditor('');status.textContent='បានលុបសេវាចេញពីបញ្ជី។';status.className='status ok'}catch(error){status.textContent=error.message;status.className='status'}});
    form.addEventListener('submit',async e=>{e.preventDefault();const status=$('price-list-status');status.textContent='';try{const body={editingCode:form.elements.editing.value,code:(form.elements.code.value).trim().toUpperCase(),categoryCode:form.elements.categoryCode.value,departmentCode:form.elements.departmentCode.value,unitLabel:form.elements.unitLabel.value,nameKh:form.elements.nameKh.value.trim(),nameEn:(form.elements.nameEn.value||form.elements.nameKh.value).trim(),defaultAmount:Number(form.elements.defaultAmount.value||0),currency:form.elements.currency.value,sortOrder:Number(form.elements.sortOrder.value||0),active:form.elements.active.checked};await api('/api/finance/services',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});await loadServices('DIRECT');$('service-editor-dialog').close();renderServiceCatalog();}catch(error){status.textContent=error.message;status.className='status'}});
  }

  let historyPatient='',historyData=null;
  const correctionLabels={PENDING:'រង់ចាំការអនុម័ត',APPROVED:'បានអនុម័ត',REJECTED:'មិនអនុម័ត',APPLIED:'បានកែរួច',STALE:'ត្រូវស្នើឡើងវិញ'};
  const paymentDay=at=>at?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at)):'';
  async function updateCashierBanner(){
    const name=$('cashier-hospital-name');if(!name)return;
    const branding=window.organizationBranding||await api('/api/organization/branding');
    const english=window.getBorkeoLanguage?.()==='en';
    name.textContent=english?branding.nameEn:branding.nameKh;name.classList.toggle('hospital-name-en',english);
  }
  window.addEventListener('borkeo-language-change',()=>{void updateCashierBanner();if(currentBill){const value=$('payment-type').value;fillPaymentOptions();$('payment-type').value=value;renderPaymentPreview();void loadServices();}});
  void updateCashierBanner();
  async function openInvoiceHistory(patientKey, date = ''){
    const samePatient=historyPatient===patientKey;
    historyPatient=patientKey;
    if(date && $('history-date-filter')) $('history-date-filter').value = date;
    $('invoice-history-status').textContent='';
    if(!$('invoice-history-dialog').open)$('invoice-history-dialog').showModal();
    if(!samePatient)$('invoice-history-content').textContent='កំពុងផ្ទុកបញ្ជី…';
    try{const data=await api('/api/finance/invoice-history?patientKey='+encodeURIComponent(patientKey));if(historyPatient!==patientKey)return;historyData=data;renderInvoiceHistory();}
    catch(error){$('invoice-history-status').textContent=error.message;}
  }
  window.openCashierInvoiceHistory=openInvoiceHistory;
  function renderInvoiceHistory(){
    let lastDay='';
    const filterDate=$('history-date-filter')?.value||'';
    const allInvoices=historyData?.invoices||[];
    const invoices=filterDate?allInvoices.filter(entry=>{
      const invDate=invoiceEntryDate(entry.invoice);
      const payDate=paymentDay(entry.paymentAt);
      return invDate===filterDate||payDate===filterDate;
    }):allInvoices;
    const oldCards=[...document.querySelectorAll('.invoice-history-card')],openIds=new Set(oldCards.filter(card=>card.open).map(card=>card.dataset.historyInvoice));
    const filterNotice=filterDate?`<p style="font-weight:700;color:#0369a1;margin:0 0 10px 0;">បង្ហាញវិក្កយបត្រថ្ងៃ ${esc(filterDate)} (${invoices.length}/${allInvoices.length})</p>`:'';
    $('invoice-history-content').innerHTML=filterNotice+(invoices.map((entry,index)=>{
      const {invoice,bill}=entry,day=paymentDay(entry.paymentAt||bill.profile.coverageAt)||'មិនទាន់បង់';
      const group=day!==lastDay?`<h3 class="invoice-payment-day">${esc(day)}</h3>`:'';lastDay=day;
      const isDischarged=Boolean(historyData.discharged||entry.discharged);
      const dischargedBadge=isDischarged?`<span class="invoice-discharged-badge">🔒 អ្នកជំងឺបានចេញពីពេទ្យ (ករណីត្រូវបានបិទ)</span>`:'';
      const approved=(historyData.requests||[]).find(request=>request.invoiceId===invoice.id&&request.requestedBy===cashierUserId&&request.status==='APPROVED'&&request.operation!=='VOID');
      const editButton=entry.cancelled?'<span>វិក្កយបត្រនេះបានលុបតាមការអនុម័ត។</span>':
        (approved?`<button type="button" data-approved-edit="${esc(invoice.id)}" data-request-id="${esc(approved.id)}">កែវិក្កយបត្រតាមការអនុម័ត</button>`:
        `<button type="button" data-request-invoice="${esc(invoice.id)}" data-operation="CORRECT">ស្នើសុំកែវិក្កយបត្រ</button>`)+
        `<button type="button" data-request-invoice="${esc(invoice.id)}" data-operation="VOID">ស្នើសុំលុបវិក្កយបត្រ</button>`;

      const rows=bill.charges.filter(c=>!c.voidedAt).map(c=>`<tr><td>${esc(chargeServiceLabel(c,false))}</td><td>${esc(c.quantity)}</td><td>${money(c.unitAmount,c.currency)}</td><td>${money(c.amount,c.currency)}</td></tr>`).join('');
      const receipts=bill.payments.filter(p=>!p.voidedAt).map(p=>`<button type="button" data-history-receipt="${esc(p.id)}" data-invoice-id="${esc(invoice.id)}">បោះពុម្ពបង្កាន់ដៃ · ${esc(p.receiptNo)}</button>`).join('');
      const totals=activeBillCurrencies(bill).map(c=>{const s=bill.summary[c],credit=Math.max(0,Number(s.paid||0)-Math.max(0,Number(s.gross||0)-Number(s.discount||0)-Number(s.waived||0)));return `<p>${esc(c)} · សរុប ${money(s.gross,c)} · បានបង់ ${money(s.paid,c)} · នៅសល់ ${money(s.balance,c)}${credit>0?` · លើសបង់ ${money(credit,c)}`:''}</p>`}).join('');
      const statusText=bill.profile.coverageAt?'បានផ្ទៀងផ្ទាត់ការធានា':entry.locked?'បានទូទាត់':'មិនទាន់បង់';
      return `${group}<details class="invoice-history-card" data-history-invoice="${esc(invoice.id)}" ${(oldCards.length?openIds.has(invoice.id):index===0)?'open':''}><summary><strong>${esc(invoice.invoiceNo)}</strong> · ${esc(bill.patient.fullName)} · ${statusText} ${dischargedBadge}</summary><p>ថ្ងៃបញ្ចូលវិក្កយបត្រ: ${esc(invoiceEntryDate(invoice))} · ថ្ងៃបង់ប្រាក់ចុងក្រោយ: ${esc(paymentDay(entry.paymentAt)||'—')}</p><div class="table-wrap"><table><thead><tr><th>សេវា</th><th>ចំនួន</th><th>តម្លៃរាយ</th><th>សរុប</th></tr></thead><tbody>${rows}</tbody></table></div>${totals}<div class="invoice-history-actions"><button type="button" data-history-print="${esc(invoice.id)}">បោះពុម្ពវិក្កយបត្រ</button>${receipts}${editButton}</div><div data-correction-panel></div></details>`;
    }).join('')||'<p>មិនមានវិក្កយបត្រត្រូវគ្នានឹងកាលបរិច្ឆេទនេះទេ។</p>');
  }
  $('close-invoice-history').onclick=()=>{$('invoice-history-dialog').close();historyPatient='';};
  $('payment-register-body').addEventListener('click',event=>{
    const view=event.target.closest('[data-view-invoices]');
    if(view)void openInvoiceHistory(view.dataset.viewInvoices,$('payment-register-date')?.value||'');
  });
  $('history-date-filter')?.addEventListener('change',()=>renderInvoiceHistory());
  $('history-date-all')?.addEventListener('click',()=>{if($('history-date-filter'))$('history-date-filter').value='';renderInvoiceHistory();});
  $('payment-register-date')?.addEventListener('change',()=>searchPaymentRegister().catch(console.error));
  $('payment-register-reset-date')?.addEventListener('click',()=>{if($('payment-register-date'))$('payment-register-date').value='';searchPaymentRegister().catch(console.error);});
  $('invoice-history-content').addEventListener('click',async event=>{
    const print=event.target.closest('[data-history-print]');
    if(print){const entry=historyData.invoices.find(e=>e.invoice.id===print.dataset.historyPrint);if(entry)await window.previewEmrHtml(invoiceHtml(entry.bill,'km'),'Invoice');return;}
    const printEn=event.target.closest('[data-history-print-en]');
    if(printEn){const entry=historyData.invoices.find(e=>e.invoice.id===printEn.dataset.historyPrintEn);if(entry)await window.previewEmrHtml(invoiceHtml(entry.bill,'en'),'Invoice');return;}
    const receipt=event.target.closest('[data-history-receipt]');
    if(receipt){const entry=historyData.invoices.find(e=>e.invoice.id===receipt.dataset.invoiceId),payment=entry?.bill.payments.find(p=>p.id===receipt.dataset.historyReceipt);if(payment)await window.previewEmrHtml(receiptHtml(payment,entry.bill),'Payment receipt');return;}
    const requestButton=event.target.closest('[data-request-invoice]');
    if(requestButton){
      const reason=prompt(requestButton.dataset.operation==='VOID'?'សូមបញ្ចូលមូលហេតុស្នើសុំលុបវិក្កយបត្រទៅគណៈគ្រប់គ្រង។':'សូមបញ្ចូលមូលហេតុស្នើសុំកែវិក្កយបត្រ។','');if(!reason?.trim())return;
      try{await api('/api/finance/invoice-edit-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:historyPatient,invoiceId:requestButton.dataset.requestInvoice,reason:reason.trim(),operation:requestButton.dataset.operation})});
        window.dispatchEvent(new Event('cashier-alerts-refresh'));await openInvoiceHistory(historyPatient);$('invoice-history-status').textContent='បានផ្ញើសំណើទៅគណៈគ្រប់គ្រង។';}catch(error){$('invoice-history-status').textContent=error.message}return;
    }
    const approvedEdit=event.target.closest('[data-approved-edit]');
    if(approvedEdit){
      const entry=(historyData?.invoices||[]).find(item=>item.invoice.id===approvedEdit.dataset.approvedEdit);if(!entry)return;
      const rows=entry.bill.charges.filter(c=>!c.voidedAt).map(c=>`<tr data-edit-charge="${esc(c.id)}"><td><input data-field="description" value="${esc(c.description)}" maxlength="300" required></td><td><input data-field="quantity" type="number" value="${esc(c.quantity)}" min="0.01" max="100000" step="any" required></td><td><input data-field="unitAmount" type="number" value="${esc(c.unitAmount)}" min="0" max="1000000000" step="${c.currency==='KHR'?'1':'.01'}" required> ${esc(c.currency)}</td><td><input data-field="note" value="${esc(c.note)}" maxlength="1000"></td></tr>`).join('');
      approvedEdit.closest('details').querySelector('[data-correction-panel]').innerHTML=`<form data-approved-edit-form="${esc(approvedEdit.dataset.requestId)}"><h4>កែប្រែវិក្កយបត្រតាមការអនុម័ត</h4><div class="table-wrap"><table><thead><tr><th>សេវា</th><th>ចំនួន</th><th>តម្លៃរាយ</th><th>កំណត់សម្គាល់</th></tr></thead><tbody>${rows}</tbody></table></div><button type="submit">រក្សាទុកការកែប្រែ</button><button type="button" data-cancel-edit>បោះបង់</button></form>`;
      return;
    }
    const cancelEdit=event.target.closest('[data-cancel-edit]');
    if(cancelEdit){
      const panel=cancelEdit.closest('[data-correction-panel]');
      if(panel)panel.innerHTML='';
      return;
    }
  });
  $('invoice-history-content').addEventListener('submit',async event=>{
    const form=event.target;event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
    try{
      if(form.dataset.approvedEditForm){
        const charges=[...form.querySelectorAll('[data-edit-charge]')].map(row=>({id:row.dataset.editCharge,...Object.fromEntries([...row.querySelectorAll('[data-field]')].map(field=>[field.dataset.field,field.value]))}));
        await api('/api/finance/invoice-edit-requests/'+form.dataset.approvedEditForm+'/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:historyPatient,charges})});
        await search();await searchPaymentRegister();if(currentKey===historyPatient)await openPatient(currentKey,currentBill?.invoice?.id||'');
      }
      window.dispatchEvent(new Event('cashier-alerts-refresh'));await openInvoiceHistory(historyPatient);
    }catch(error){$('invoice-history-status').textContent=error.message;button.disabled=false;}
  });
  window.addEventListener('staff-invoice-created',event=>{if(event.detail.patientKey===currentKey)void openPatient(currentKey,event.detail.invoiceId);else void search();});
  window.addEventListener('focus',()=>{if(historyPatient&&$('invoice-history-dialog').open&&!$('invoice-history-content form'))void openInvoiceHistory(historyPatient);});

  const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!me.ok){location.replace('/login');return}const session=await me.json();csrf=session.csrfToken;role=session.user.activeRole;cashierUserId=session.user.id;if(!['ADMIN','DIRECTOR','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)){location.replace('/home');return}
  await loadServices();
  setupServiceCatalog();
  await loadExchange();
  $('exchange-proposal').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/finance/exchange-rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({khrPerUsd:Number($('exchange-rate').value)})});$('exchange-rate').value='';await loadExchange();setStatus('exchange-status','បានផ្ញើសំណើអត្រាប្តូរប្រាក់។',true)}catch(err){setStatus('exchange-status',err.message)}});
  $('exchange-requests').addEventListener('click',async e=>{const b=e.target.closest('[data-rate-review]');if(!b)return;try{await api(`/api/finance/exchange-rates/${b.dataset.rateReview}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approved:b.dataset.approved==='true'})});await loadExchange();setStatus('exchange-status','បានពិនិត្យអត្រាប្តូរប្រាក់។',true)}catch(err){setStatus('exchange-status',err.message)}});
  $('patient-search').addEventListener('input',()=>{clearTimeout(window.__billSearch);window.__billSearch=setTimeout(()=>search().catch(console.error),200)});
  $('cashier-queue-refresh').addEventListener('click',()=>search().catch(console.error));
  $('payment-register-search').addEventListener('input',()=>{clearTimeout(window.__registerSearch);window.__registerSearch=setTimeout(()=>searchPaymentRegister().catch(console.error),200)});
  $('patient-results').addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(b)openPatient(b.dataset.key,b.dataset.invoiceId||'').catch(err=>alert(err.message))});
  $('service-category').addEventListener('change',()=>renderServiceOptions());$('service-select').addEventListener('change',syncSelectedService);
  $('payment-service-category').addEventListener('change',()=>{renderPaymentServiceOptions();if($('payment-service-category').value==='AMBULANCE')$('payment-purpose').value='AMBULANCE_REFERRAL'});
  $('payment-service-select').addEventListener('change',()=>{if($('payment-service-select').value==='AMBULANCE_REFERRAL')$('payment-purpose').value='AMBULANCE_REFERRAL'});
  $('payment-type').addEventListener('change',async()=>{toggleProfile();if(currentKey&&currentBill?.invoice?.id){try{await api('/api/finance/patient',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:currentKey,invoiceId:currentBill.invoice.id,paymentType:payer(),paymentSubtype:'FULL',...policy()})});}catch(_){}}loadServices().catch(e=>setStatus('charge-status',e.message));});
  if($('save-payment-category'))$('save-payment-category').onclick=async()=>{try{const d=await api('/api/finance/patient',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:currentKey,invoiceId:currentBill?.invoice?.id,paymentType:payer(),paymentSubtype:'FULL',...policy()})});await openPatient(currentKey,currentBill.invoice.id);setStatus('payment-category-status',en()?'Payment category saved.':'បានរក្សាទុកប្រភេទបង់ប្រាក់។',true);}catch(e){setStatus('payment-category-status',e.message)}};
  $('direct-payment-type').addEventListener('change',toggleProfile);
  $('adjustment-mode').addEventListener('change',toggleAdjustmentFields);
  $('adjustment-percent').addEventListener('input',renderPaymentPreview);
  $('adjustment-amount').addEventListener('input',renderPaymentPreview);
  $('adjustment-currency').addEventListener('change',renderPaymentPreview);
  $('discount-amount').addEventListener('input',renderPaymentPreview);
  $('discount-currency').addEventListener('change',renderPaymentPreview);
  $('balance-shortcuts').addEventListener('click',e=>{const b=e.target.closest('[data-complete-payment]');if(b)completeFullBalance(b)});
  $('invoice-picker').addEventListener('change',e=>{if(currentKey&&e.target.value)openPatient(currentKey,e.target.value).catch(err=>alert(err.message))});
  $('charge-form').addEventListener('submit',async e=>{e.preventDefault();if(!currentKey)return;const s=selectedService();if(!s)return;try{const d=await api('/api/finance/charges',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:currentKey,serviceCode:s.code,tariffPaymentType:payer(),...policy(),invoiceId:currentBill?.invoice?.id,category:(s.category?.labelKh||s.category?.labelEn||''),description:(s.nameKh||s.nameEn||s.code),quantity:Number($('charge-quantity').value),unitAmount:Number($('charge-price').value),currency:$('charge-currency').value,note:$('charge-note').value})});currentBill=d.bill;selectedPaymentStatus=null;invoiceList=d.invoices||invoiceList;await search();renderBill();window.dispatchEvent(new Event('cashier-alerts-refresh'));$('charge-quantity').value=1;$('charge-note').value='';syncSelectedService();setStatus('charge-status','បានបន្ថែមសេវា។',true)}catch(err){setStatus('charge-status',err.message)}});
  $('payment-form').addEventListener('submit',e=>e.preventDefault());
  document.body.addEventListener('click',e=>{const print=e.target.closest('[data-print-receipt]');if(print){printReceipt(print.dataset.printReceipt);return}const b=e.target.closest('.void-btn');if(b)voidItem(b.dataset.kind,b.dataset.id).catch(err=>alert(err.message))});
  $('print-invoice')?.addEventListener('click',()=>printInvoice('km'));
  $('print-invoice-en')?.addEventListener('click',()=>printInvoice('en'));
  $('print-payment-history')?.addEventListener('click',openPaymentHistoryPrint);
  $('close-payment-history-dialog')?.addEventListener('click',()=>$('payment-history-print-dialog').close());
  $('cancel-payment-history-print')?.addEventListener('click',()=>$('payment-history-print-dialog').close());
  $('confirm-payment-history-print')?.addEventListener('click',confirmPaymentHistoryPrint);
  setPaymentDateTimeNow();
  window.dispatchEvent(new Event('cashier:ready'));
  await search();
  const target=new URLSearchParams(location.search);if(target.get('patientKey'))await openPatient(target.get('patientKey'),target.get('invoiceId')||'');
  if(target.get('historyPatient') || (target.get('patientKey') && target.get('history')==='1')) await openInvoiceHistory(target.get('historyPatient')||target.get('patientKey'));
  window.setInterval(()=>{search().catch(()=>{});if(!$('payment-register-view')?.hidden)searchPaymentRegister().catch(()=>{});if(historyPatient&&$('invoice-history-dialog').open&&!$('invoice-history-content form'))openInvoiceHistory(historyPatient).catch(()=>{});},15000);
})().catch(err=>{console.error(err);alert(err.message)});
