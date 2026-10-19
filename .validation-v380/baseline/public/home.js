'use strict';
(async function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c)=>c==='KHR'?`${Math.round(Number(v||0)).toLocaleString()} ៛`:`$${Number(v||0).toFixed(2)}`;

  async function api(url){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'សំណើមិនបានជោគជ័យ');
    return j;
  }

  function ymd(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function metricCard(labelKh, value, extra='', klass=''){
    return `
      <article class="report-metric-card ${klass}" title="${esc(labelKh)}">
        <div class="metric-details">
          <span class="metric-label" title="${esc(labelKh)}">${esc(labelKh)}</span>
          <strong class="metric-value">${esc(value)}</strong>
          ${extra?`<small class="metric-extra" title="${esc(extra)}">${extra}</small>`:''}
        </div>
      </article>
    `;
  }

  function renderWardChart(wardDistribution=[]){
    const box=$('ward-chart-container');
    if(!box)return;
    if(!wardDistribution.length){
      box.innerHTML='<p class="chart-empty">មិនទាន់មានទិន្នន័យអ្នកជំងឺតាមផ្នែកទេ។</p>';
      return;
    }
    const maxVal=Math.max(...wardDistribution.map(w=>w.count), 1);
    const bars=wardDistribution.map(w=>{
      const pct=Math.round((w.count/maxVal)*100);
      return `
        <div class="chart-bar-row">
          <span class="bar-label">${esc(w.nameKh||w.nameEn||w.code)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="bar-value"><strong>${w.count}</strong> នាក់</span>
        </div>
      `;
    }).join('');
    box.innerHTML=`<div class="bar-chart-list">${bars}</div>`;
  }

  function renderDemographicsChart(analytics={}){
    const box=$('demographics-chart-container');
    if(!box)return;
    const gender=analytics.gender||{male:0,female:0,other:0};
    const totalG=Math.max(gender.male+gender.female+gender.other, 1);
    const malePct=Math.round((gender.male/totalG)*100);
    const femalePct=Math.round((gender.female/totalG)*100);

    const payment=analytics.paymentDistribution||[];
    const payRows=payment.slice(0,5).map(p=>`
      <div class="demo-tag">
        <span class="demo-dot"></span>
        <span class="demo-name">${esc(p.label)}</span>
        <strong>${p.count}</strong>
      </div>
    `).join('');

    box.innerHTML=`
      <div class="demographics-wrap">
        <div class="gender-split">
          <div class="gender-bar">
            <div class="gender-seg male" style="width:${malePct}%;" title="ប្រុស: ${gender.male}">ប្រុស ${malePct}%</div>
            <div class="gender-seg female" style="width:${femalePct}%;" title="ស្រី: ${gender.female}">ស្រី ${femalePct}%</div>
          </div>
          <div class="gender-legend">
            <span>ប្រុស: <strong>${gender.male}</strong> នាក់</span>
            <span>ស្រី: <strong>${gender.female}</strong> នាក់</span>
          </div>
        </div>
        <div class="payment-demo-list">
          ${payRows}
        </div>
      </div>
    `;
  }

  function renderTopDiagnoses(diagnoses=[]){
    const box=$('top-diagnoses-list');
    if(!box)return;
    if(!diagnoses.length){
      box.innerHTML='<p class="chart-empty">មិនទាន់មានទិន្នន័យរោគវិនិច្ឆ័យទេ។</p>';
      return;
    }
    box.innerHTML=diagnoses.map(d=>`
      <div class="diagnosis-row">
        <span class="diag-rank">${String(d.rank).padStart(2, '0')}</span>
        <div class="diag-info">
          <div class="diag-head">
            <strong class="diag-name">${esc(d.diagnosis)}</strong>
            ${d.icd10?`<span class="diag-icd">ICD-10: ${esc(d.icd10)}</span>`:''}
            <span class="diag-count">${d.count} ករណី</span>
          </div>
          <div class="diag-progress-track">
            <div class="diag-progress-bar" style="width: ${d.percentage}%;"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  async function loadDashboard(){
    const dateInput=$('report-date');
    if(!dateInput)return;
    const date=dateInput.value||ymd(new Date());
    dateInput.value=date;
    try{
      const d=await api('/api/reports/daily?date='+encodeURIComponent(date));

      // 7 Top Summary Metrics (Clean & Professional)
      const ambulanceIncome=d.ambulanceReferralIncome||{KHR:0,USD:0};
      $('report-summary').innerHTML=[
        metricCard('សម្រាកពេទ្យសរុប', d.totalAdmissions??0, '', 'admissions-card'),
        metricCard('ផ្ទេរជំងឺក្នុងមន្ទីរពេទ្យ', d.internalTransfers??0, '', 'transfers-card'),
        metricCard('បញ្ជូនចូល', d.hcReferrals??0, 'មកខ្លួនឯង', 'hc-referral-card'),
        metricCard('បញ្ជូនចូល', d.hcAmbulance??0, 'រថយន្ត HC', 'hc-ambulance-card'),
        metricCard('បញ្ជូនចូល', d.rhAmbulance??0, 'រថយន្ត RH', 'rh-ambulance-card'),
        metricCard('បញ្ជូនចេញ', d.externalProvincialTransfers??0, 'មន្ទីរពេទ្យខេត្ត', 'provincial-card'),
        metricCard('ចំណូលរថយន្តសរុប', money(ambulanceIncome.KHR,'KHR'), ambulanceIncome.USD?money(ambulanceIncome.USD,'USD'):'', 'ambulance-income-card'),
      ].join('');

      // Ward Census Table (IPD)
      const ipdRowsHtml = (d.wards||[]).map(w=>`
        <tr>
          <td><strong>${esc(w.nameKh||w.nameEn||w.code)}</strong></td>
          <td>${w.restant}</td>
          <td>${w.newAdmissions}</td>
          <td><strong style="color:#087fa8">${w.current}</strong></td>
        </tr>
      `).join('')||'<tr><td colspan="4">មិនមានអ្នកជំងឺទេ។</td></tr>';
      
      if($('ward-report-body')) $('ward-report-body').innerHTML = ipdRowsHtml;
      if($('ipd-standalone-report-body')) $('ipd-standalone-report-body').innerHTML = ipdRowsHtml;

      // Refined OPD Report Table
      const opdIndicators = d.opdReport?.indicators || (Array.isArray(d.opdReport) ? d.opdReport : []);
      const opdRowsHtml = opdIndicators.map(r=>`
        <tr>
          <td style="font-weight:700; color:#0b89ae; width:45px;">${esc(r.no)}</td>
          <td><strong>${esc(r.label)}</strong></td>
          <td style="text-align:center; font-weight:800; color:#075f81;">${r.total}</td>
          <td style="text-align:center; font-weight:600; color:#2563eb;">${r.key==='anc'||r.key==='pnc'?'-':r.male}</td>
          <td style="text-align:center; font-weight:600; color:#e11d48;">${r.female}</td>
        </tr>
      `).join('')||'<tr><td colspan="5">មិនមានទិន្នន័យពិគ្រោះក្រៅទេ។</td></tr>';

      if($('opd-report-body')) $('opd-report-body').innerHTML = opdRowsHtml;

      // Payment Status Breakdown
      const p=d.paymentStatus||{};
      const items=[
        ['បានបង់ប្រាក់','Paid',p.paid,'paid'],
        ['មិនទាន់បង់ប្រាក់','Not Yet Paid',p.notPaid,'unpaid'],
        ['ប.ស.ស','NSSF',p.nssf,'nssf'],
        ['បណ្ណមូលនិធិសមធម៌','Health Equity Fund Card',p.hefEquity,'hef'],
        ['បណ្ណងាយរងហានិភ័យ','Vulnerable Card',p.hefVulnerable,'hef'],
        ['លើកលែង','Exempt',p.exempt,'exempt'],
        ['បញ្ចុះថ្លៃសេវា','Discount',p.discount,'discount'],
      ];
      const paymentHtml = items.map(([kh,en,value,klass])=>`
        <div class="payment-stat ${klass}">
          <span>${esc(kh)}</span>
          <strong>${Number(value||0)}</strong>
        </div>
      `).join('');

      if($('payment-report')) $('payment-report').innerHTML = paymentHtml;
      if($('ipd-payment-report')) $('ipd-payment-report').innerHTML = paymentHtml;

      // OPD specific payment status
      const opdP = d.opdReport?.paymentStatus || p;
      const opdPaymentItems=[
        ['បានបង់ប្រាក់','Paid',opdP.paid,'paid'],
        ['មិនទាន់បង់ប្រាក់','Not Yet Paid',opdP.notPaid,'unpaid'],
        ['ប.ស.ស','NSSF',opdP.nssf,'nssf'],
        ['បណ្ណមូលនិធិសមធម៌','Health Equity Fund Card',opdP.hefEquity,'hef'],
        ['បណ្ណងាយរងហានិភ័យ','Vulnerable Card',opdP.hefVulnerable,'hef'],
        ['លើកលែង','Exempt',opdP.exempt,'exempt'],
        ['បញ្ចុះថ្លៃសេវា','Discount',opdP.discount,'discount'],
      ];
      if($('opd-payment-report')) {
        $('opd-payment-report').innerHTML = opdPaymentItems.map(([kh,en,value,klass])=>`
          <div class="payment-stat ${klass}">
            <span>${esc(kh)}</span>
            <strong>${Number(value||0)}</strong>
          </div>
        `).join('');
      }

      // Patient Analytics & Top 10 Diagnoses
      const analytics=d.analytics||{};
      renderTopDiagnoses(analytics.topDiagnoses||[]);
      renderWardChart(analytics.wardDistribution||[]);
      renderDemographicsChart(analytics);

    }catch(err){
      console.error('Failed to load dashboard data:', err);
    }
  }

  // Event handlers
  const reportDate=$('report-date');
  if(reportDate){
    reportDate.value=ymd(new Date());
    reportDate.addEventListener('change',loadDashboard);
  }
  const todayBtn=$('report-today');
  if(todayBtn){
    todayBtn.addEventListener('click',()=>{
      if(reportDate)reportDate.value=ymd(new Date());
      loadDashboard();
    });
  }

  // Inbox notification polling for cashier and ward alerts
  async function checkInboxNotifications(){
    try{
      const data=await api('/api/messages?box=inbox&limit=100');
      if(Array.isArray(data?.messages)){
        for(const msg of data.messages){
          if(msg.subject?.includes('Cashier payment completed') || msg.body?.includes('/ward-medicines')){
            // Notifies active sessions of cashier or ward medicine approvals
          }
        }
      }
    }catch{}
  }

  // Initial Load
  loadDashboard();
  checkInboxNotifications();
})();

