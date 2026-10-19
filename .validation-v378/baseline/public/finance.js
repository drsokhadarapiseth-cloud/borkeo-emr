'use strict';
(async function(){
  let role='';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c)=>c==='KHR'?`${Math.round(Number(v||0)).toLocaleString()} ៛`:`$${Number(v||0).toFixed(2)}`;
  async function api(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'សំណើមិនបានជោគជ័យ');return j}
  function ym(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function addMonth(delta){const [y,m]=$('month').value.split('-').map(Number);$('month').value=ym(new Date(y,m-1+delta,1));loadMonthViews()}

  function getActiveRange(){
    const activePill = document.querySelector('.period-pill.active');
    const mode = activePill ? (activePill.dataset.period || 'month') : ($('period-type') ? $('period-type').value : 'month');
    const now = new Date();
    const curYear = now.getFullYear();
    let query = '';
    let label = '';
    let isMonth = false;

    if (mode === 'month') {
      const m = $('month').value || ym(now);
      query = `month=${encodeURIComponent(m)}`;
      const [y, mon] = m.split('-').map(Number);
      label = `ខែ ${String(mon).padStart(2,'0')}/${y}`;
      isMonth = true;
    } else if (mode === 'trimester') {
      const y = Number($('trimester-year').value || curYear);
      const q = Number($('trimester-select').value || 1);
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = q * 3;
      const start = `${y}-${String(startMonth).padStart(2,'0')}-01`;
      const lastDay = new Date(y, endMonth, 0).getDate();
      const end = `${y}-${String(endMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      query = `startDate=${start}&endDate=${end}`;
      label = `ត្រីមាសទី ${q} ឆ្នាំ ${y}`;
    } else if (mode === 'semester') {
      const y = Number($('semester-year').value || curYear);
      const s = Number($('semester-select').value || 1);
      const startMonth = (s - 1) * 6 + 1;
      const endMonth = s * 6;
      const start = `${y}-${String(startMonth).padStart(2,'0')}-01`;
      const lastDay = new Date(y, endMonth, 0).getDate();
      const end = `${y}-${String(endMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      query = `startDate=${start}&endDate=${end}`;
      label = `ឆមាសទី ${s} ឆ្នាំ ${y}`;
    } else if (mode === 'year') {
      const y = Number($('year-select').value || curYear);
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      query = `startDate=${start}&endDate=${end}`;
      label = `ប្រចាំឆ្នាំ ${y}`;
    } else if (mode === 'custom') {
      const start = $('custom-start-date').value || ymd(new Date(curYear, now.getMonth(), 1));
      const end = $('custom-end-date').value || ymd(now);
      query = `startDate=${start}&endDate=${end}`;
      label = `ពី ${start} ដល់ ${end}`;
    }
    return { mode, query, label, isMonth };
  }

  function totals(data, range){
    const incK = data.totals.income.KHR || 0, incU = data.totals.income.USD || 0;
    const expK = data.totals.expense.KHR || 0, expU = data.totals.expense.USD || 0;
    const netK = data.totals.net.KHR || 0, netU = data.totals.net.USD || 0;
    const isNetPositive = netK >= 0;

    if ($('cashflow-sub')) $('cashflow-sub').textContent = `តារាងទិន្នន័យចំណូល ចំណាយ និងសមតុល្យសាច់ប្រាក់សុទ្ធ (${range.label})`;
    if ($('service-report-title')) $('service-report-title').textContent = `របាយការណ៍ចំណូលតាមផ្នែក និងសេវា (${range.label})`;

    $('month-totals').innerHTML = `
      <article class="exec-card income-exec-card">
        <div class="exec-header">
          <span class="exec-tag">ចំណូលសរុប (Total Revenue)</span>
          <span class="exec-icon">📈</span>
        </div>
        <div class="exec-main">
          <div class="exec-amount khr positive">${money(incK, 'KHR')}</div>
          <div class="exec-sub usd">${money(incU, 'USD')}</div>
        </div>
        <div class="exec-footer">ចំណូលពីការបង់ប្រាក់អ្នកជំងឺ និងសេវាវេជ្ជសាស្ត្រ (${esc(range.label)})</div>
      </article>

      <article class="exec-card expense-exec-card">
        <div class="exec-header">
          <span class="exec-tag">ចំណាយសរុប (Total Expenses)</span>
          <span class="exec-icon">📉</span>
        </div>
        <div class="exec-main">
          <div class="exec-amount khr negative">${money(expK, 'KHR')}</div>
          <div class="exec-sub usd">${money(expU, 'USD')}</div>
        </div>
        <div class="exec-footer">ចំណាយប្រតិបត្តិការ សម្ភារៈ និងឱសថ (${esc(range.label)})</div>
      </article>

      <article class="exec-card net-exec-card ${isNetPositive ? 'surplus' : 'deficit'}">
        <div class="exec-header">
          <span class="exec-tag">សមតុល្យសាច់ប្រាក់សុទ្ធ (Net Cash Balance)</span>
          <span class="exec-badge ${isNetPositive ? 'badge-pos' : 'badge-neg'}">${isNetPositive ? 'ចំណេញ / Surplus' : 'ខាត / Deficit'}</span>
        </div>
        <div class="exec-main">
          <div class="exec-amount khr ${isNetPositive ? 'positive' : 'negative'}">${money(netK, 'KHR')}</div>
          <div class="exec-sub usd ${netU >= 0 ? 'positive' : 'negative'}">${money(netU, 'USD')}</div>
        </div>
        <div class="exec-footer">សមតុល្យចំណូលដកចំណាយ (${esc(range.label)})</div>
      </article>
    `;
  }

  function renderCalendar(data){
    const [y,m]=data.month.split('-').map(Number),first=new Date(y,m-1,1),daysIn=new Date(y,m,0).getDate(),map=Object.fromEntries(data.days.map(d=>[d.date,d]));let html='';
    for(let i=0;i<first.getDay();i++)html+='<div class="blank"></div>';
    const todayKey=ymd(new Date());
    for(let day=1;day<=daysIn;day++){
      const key=`${data.month}-${String(day).padStart(2,'0')}`,d=map[key]||{income:{KHR:0,USD:0},expense:{KHR:0,USD:0},net:{KHR:0,USD:0}};
      const hasActivity = d.income.KHR > 0 || d.expense.KHR > 0 || d.income.USD > 0 || d.expense.USD > 0;
      html+=`<article class="day ${key===todayKey?'today':''} ${hasActivity?'has-activity':''}" data-date="${key}">
        <div class="day-head">
          <span class="number">${day}</span>
          ${key===todayKey?'<span class="today-chip">ថ្ងៃនេះ</span>':''}
        </div>
        ${d.income.KHR > 0 ? `<div class="day-stat inc"><span>ចំណូល:</span> <b>+${money(d.income.KHR,'KHR')}</b></div>` : ''}
        ${d.expense.KHR > 0 ? `<div class="day-stat exp"><span>ចំណាយ:</span> <b>-${money(d.expense.KHR,'KHR')}</b></div>` : ''}
        ${hasActivity ? `<div class="day-stat net ${(d.net.KHR>=0)?'pos':'neg'}"><span>សមតុល្យ:</span> <b>${money(d.net.KHR,'KHR')}</b></div>` : '<div class="no-activity">—</div>'}
      </article>`;
    }
    $('calendar').innerHTML=html;
  }

  function renderPeriodDaysList(data){
    const container = $('period-days-grid');
    if (!container) return;
    const days = (data.days || []).filter(d => (d.income?.KHR > 0 || d.expense?.KHR > 0 || d.income?.USD > 0 || d.expense?.USD > 0));
    if (!days.length) {
      container.innerHTML = `<div class="period-empty-notice">មិនមានប្រតិបត្តិការហិរញ្ញវត្ថុក្នុងកាលបរិច្ឆេទនេះទេ។</div>`;
      return;
    }
    container.innerHTML = days.map(d => {
      const netK = d.net?.KHR || 0;
      const hasIncome = (d.income?.KHR > 0 || d.income?.USD > 0);
      const hasExpense = (d.expense?.KHR > 0 || d.expense?.USD > 0);
      return `<article class="period-day-card" data-date="${esc(d.date)}">
        <div class="day-card-head">
          <span>📅 ${esc(d.date)}</span>
          <span class="day-view-hint">🔍 លម្អិត</span>
        </div>
        ${hasIncome ? `<div class="day-stat inc"><span>ចំណូល:</span> <b>+${money(d.income.KHR,'KHR')}</b></div>` : ''}
        ${hasExpense ? `<div class="day-stat exp"><span>ចំណាយ:</span> <b>-${money(d.expense.KHR,'KHR')}</b></div>` : ''}
        <div class="day-stat net ${(netK >= 0)?'pos':'neg'}">
          <span>សមតុល្យ:</span> <b>${money(netK,'KHR')}</b>
        </div>
      </article>`;
    }).join('');
  }

  function renderDaysOrCalendar(data, range){
    if (range.isMonth) {
      if ($('month-calendar-view')) $('month-calendar-view').hidden = false;
      if ($('period-days-view')) $('period-days-view').hidden = true;
      if ($('period-summary-title')) $('period-summary-title').textContent = 'ប្រតិទិនលំហូរសាច់ប្រាក់ប្រចាំថ្ងៃ';
      if ($('period-summary-subtitle')) $('period-summary-subtitle').textContent = 'ចុចលើថ្ងៃនីមួយៗ ដើម្បីពិនិត្យមើលប្រតិបត្តិការចំណូល និងចំណាយលម្អិត';
      renderCalendar(data);
    } else {
      if ($('month-calendar-view')) $('month-calendar-view').hidden = true;
      if ($('period-days-view')) $('period-days-view').hidden = false;
      if ($('period-summary-title')) $('period-summary-title').textContent = `ប្រតិបត្តិការហិរញ្ញវត្ថុប្រចាំថ្ងៃ (${range.label})`;
      if ($('period-summary-subtitle')) $('period-summary-subtitle').textContent = 'ជ្រើសរើសថ្ងៃនីមួយៗខាងក្រោម ដើម្បីពិនិត្យមើលចំណូល និងចំណាយលម្អិត';
      renderPeriodDaysList(data);
    }
  }

  async function loadCashflow(range){
    const d=await api('/api/finance/cashflow?' + range.query);
    totals(d, range);
    renderDaysOrCalendar(d, range);
  }

  async function loadMonthlyServiceReport(range){
    const d=await api('/api/finance/monthly-service-report?' + range.query);
    $('monthly-service-summary').innerHTML=`
      <article class="kpi-card total-kpi">
        <div class="kpi-meta">
          <span class="kpi-title">ចំណូលសរុបតាមសេវា (Total Verified Revenue)</span>
          <span class="kpi-badge">ចំណូលជាក់ស្តែង</span>
        </div>
        <div class="kpi-values">
          <strong class="kpi-value khr">${money(d.totals.KHR,'KHR')}</strong>
          <small class="kpi-value usd">${money(d.totals.USD,'USD')}</small>
        </div>
      </article>
      <article class="kpi-card ambulance-kpi">
        <div class="kpi-meta">
          <span class="kpi-title">សេវារថយន្តសង្គ្រោះបន្ទាន់ (Ambulance Service)</span>
          <span class="kpi-badge amb-badge">🚑 សង្គ្រោះបន្ទាន់</span>
        </div>
        <div class="kpi-values">
          <strong class="kpi-value khr">${money(d.ambulance.KHR,'KHR')}</strong>
          <small class="kpi-value usd">${money(d.ambulance.USD,'USD')}</small>
        </div>
      </article>
    `;

    if ($('monthly-category-body')) {
      const categories = d.categories || [];
      let catTotalReceipts = 0, catTotalKhr = 0, catTotalUsd = 0;
      categories.forEach(r => {
        catTotalReceipts += Number(r.receiptCount || 0);
        catTotalKhr += Number(r.totals?.KHR || 0);
        catTotalUsd += Number(r.totals?.USD || 0);
      });
      $('monthly-category-body').innerHTML = categories.map(row => {
        const isAmb = row.code === 'AMBULANCE';
        return `<tr class="${isAmb ? 'ambulance-row' : ''}">
          <td><strong class="cat-label">${esc(row.labelKh || row.labelEn)}</strong></td>
          <td class="num-cell"><span class="receipt-pill">${row.receiptCount}</span></td>
          <td class="num-cell amount-khr">${money(row.totals.KHR, 'KHR')}</td>
          <td class="num-cell amount-usd">${money(row.totals.USD, 'USD')}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="4" class="empty-cell">មិនមានចំណូលក្នុងខែនេះទេ។</td></tr>';

      const catFoot = $('monthly-category-foot');
      if (catFoot) {
        catFoot.innerHTML = `<tr>
          <th>សរុបទាំងអស់ (Grand Total)</th>
          <th class="num-cell"><span class="receipt-pill total-pill">${catTotalReceipts}</span></th>
          <th class="num-cell amount-khr total-khr">${money(catTotalKhr, 'KHR')}</th>
          <th class="num-cell amount-usd total-usd">${money(catTotalUsd, 'USD')}</th>
        </tr>`;
      }
    }

    const categoryName = code => d.categories?.find(x => x.code === code);
    const services = d.services || [];
    let srvTotalReceipts = 0, srvTotalKhr = 0, srvTotalUsd = 0;
    services.forEach(r => {
      srvTotalReceipts += Number(r.receiptCount || 0);
      srvTotalKhr += Number(r.totals?.KHR || 0);
      srvTotalUsd += Number(r.totals?.USD || 0);
    });

    $('monthly-service-body').innerHTML = services.map(row => {
      const cat = categoryName(row.categoryCode) || { labelKh: row.categoryCode, labelEn: row.categoryCode };
      const isAmb = row.categoryCode === 'AMBULANCE';
      return `<tr class="${isAmb ? 'ambulance-row' : ''}">
        <td><strong class="service-name">${esc(row.nameKh || row.nameEn)}</strong></td>
        <td><span class="dept-tag">${esc(cat.labelKh || cat.labelEn)}</span></td>
        <td class="num-cell"><span class="receipt-pill">${row.receiptCount}</span></td>
        <td class="num-cell amount-khr">${money(row.totals.KHR, 'KHR')}</td>
        <td class="num-cell amount-usd">${money(row.totals.USD, 'USD')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="empty-cell">មិនមានទិន្នន័យចំណូលតាមសេវាទេ។</td></tr>';

    const srvFoot = $('monthly-service-foot');
    if (srvFoot) {
      srvFoot.innerHTML = `<tr>
        <th colspan="2">សរុបទាំងអស់ (Grand Total)</th>
        <th class="num-cell"><span class="receipt-pill total-pill">${srvTotalReceipts}</span></th>
        <th class="num-cell amount-khr total-khr">${money(srvTotalKhr, 'KHR')}</th>
        <th class="num-cell amount-usd total-usd">${money(srvTotalUsd, 'USD')}</th>
      </tr>`;
    }
  }

  async function loadMonthViews(){
    const range = getActiveRange();
    await Promise.all([loadCashflow(range), loadMonthlyServiceReport(range)]);
  }

  async function day(date){
    const d=await api('/api/finance/cashflow-day?date='+date);
    $('day-title').textContent = `កាលបរិច្ឆេទ ${date}`;
    $('day-income').innerHTML=d.payments.map(x=>`
      <div class="txn-card inc-card">
        <div class="txn-info">
          <strong class="txn-title">${esc(x.patientName||x.caseNumber||'អ្នកជំងឺ')}</strong>
          <span class="txn-details">${esc(x.source)} · ${esc(x.purpose||'PATIENT_CARE')}</span>
          <time class="txn-time">🕒 ${new Date(x.receivedAt).toLocaleTimeString('km-KH', {hour:'2-digit', minute:'2-digit'})}</time>
        </div>
        <div class="txn-value positive">+${money(x.amount,x.currency)}</div>
      </div>`).join('')||'<div class="empty-txn">មិនមានចំណូលក្នុងថ្ងៃនេះទេ។</div>';

    $('day-expenses').innerHTML=d.expenses.map(x=>`
      <div class="txn-card exp-card">
        <div class="txn-info">
          <strong class="txn-title">${esc(x.category)}</strong>
          <span class="txn-details">${esc(x.description)}</span>
          <time class="txn-time">🕒 ${new Date(x.spentAt).toLocaleTimeString('km-KH', {hour:'2-digit', minute:'2-digit'})}</time>
        </div>
        <div class="txn-value negative">-${money(x.amount,x.currency)}</div>
      </div>`).join('')||'<div class="empty-txn">មិនមានចំណាយក្នុងថ្ងៃនេះទេ។</div>';
    $('day-panel').hidden=false;
  }

  function initPeriodControls(){
    const now = new Date();
    const curYear = now.getFullYear();
    const years = [curYear - 2, curYear - 1, curYear, curYear + 1];

    const fillYears = selectId => {
      const el = $(selectId);
      if (el) {
        el.innerHTML = years.map(y => `<option value="${y}" ${y===curYear?'selected':''}>ឆ្នាំ ${y}</option>`).join('');
      }
    };
    fillYears('trimester-year');
    fillYears('semester-year');
    fillYears('year-select');

    if ($('trimester-select')) $('trimester-select').value = String(Math.floor(now.getMonth() / 3) + 1);
    if ($('semester-select')) $('semester-select').value = String(Math.floor(now.getMonth() / 6) + 1);
    if ($('custom-start-date')) $('custom-start-date').value = ymd(new Date(curYear, now.getMonth(), 1));
    if ($('custom-end-date')) $('custom-end-date').value = ymd(now);

    document.querySelectorAll('.period-pill').forEach(pill => {
      pill.onclick = () => {
        document.querySelectorAll('.period-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const m = pill.dataset.period;
        ['month', 'trimester', 'semester', 'year', 'custom'].forEach(type => {
          const grp = $('controls-' + type);
          if (grp) grp.hidden = (type !== m);
        });
        loadMonthViews();
      };
    });

    if ($('trimester-year')) $('trimester-year').onchange = loadMonthViews;
    if ($('trimester-select')) $('trimester-select').onchange = loadMonthViews;
    if ($('semester-year')) $('semester-year').onchange = loadMonthViews;
    if ($('semester-select')) $('semester-select').onchange = loadMonthViews;
    if ($('year-select')) $('year-select').onchange = loadMonthViews;
    if ($('apply-custom-range')) $('apply-custom-range').onclick = loadMonthViews;
  }

  const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok){location.replace('/login');return}const s=await r.json();role=s.user.activeRole;if(!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)){location.replace('/home');return}
  const now=new Date();$('month').value=ym(now);
  initPeriodControls();

  $('prev-month').onclick=()=>addMonth(-1);$('next-month').onclick=()=>addMonth(1);$('today').onclick=()=>{$('month').value=ym(new Date());loadMonthViews()};$('month').onchange=loadMonthViews;
  $('calendar').onclick=e=>{const item=e.target.closest('[data-date]');if(item){day(item.dataset.date).catch(err=>alert(err.message))}};
  const periodGrid = $('period-days-grid');
  if (periodGrid) {
    periodGrid.onclick = e => {
      const item = e.target.closest('[data-date]');
      if (item) day(item.dataset.date).catch(err=>alert(err.message));
    };
  }
  $('close-day').onclick=()=>{$('day-panel').hidden=true};
  window.addEventListener('keydown', e=>{ if(e.key==='Escape') $('day-panel').hidden=true; });
  $('print-month-report').onclick=()=>{
    const range = getActiveRange();
    window.printEmrReport({
      selectors:['#month-totals','.monthly-service-panel', range.isMonth ? '.calendar-panel' : '#period-days-view'],
      title:'របាយការណ៍ហិរញ្ញវត្ថុ '+range.label,
      separatePages:false
    });
  };
  await loadMonthViews();
})().catch(err=>{console.error(err);alert(err.message)});
