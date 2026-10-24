'use strict';

(function patientListApplication() {
  const copy = {
    kh: {
      system: 'ប្រព័ន្ធកំណត់ត្រាវេជ្ជសាស្ត្រអេឡិចត្រូនិក', title: 'បញ្ជីអ្នកជំងឺ',
      autosaveHint: 'កាលបរិច្ឆេទចេញបង្ហាញក្រោយឱសថស្ថានផ្ដល់ថ្នាំ OPD ឬគ្រូពេទ្យបញ្ចេញអ្នកជំងឺ IPD។', search: 'ស្វែងរកអ្នកជំងឺ',
      searchPlaceholder: 'ឈ្មោះ លេខករណី ឬលេខប័ណ្ណសុខភាព', entryDate: 'កាលបរិច្ឆេទចូល',
      dischargeDate: 'កាលបរិច្ឆេទចេញ', department: 'ផ្នែក', allDepartments: 'ផ្នែកទាំងអស់',
      reset: 'កំណត់ឡើងវិញ', number: 'ល.រ', patientName: 'ឈ្មោះអ្នកជំងឺ', sex: 'ភេទ', age: 'អាយុ',
      patientId: 'លេខបណ្ណសុខភាព', action: 'សកម្មភាព', open: 'មើលកំណត់ត្រា', edit: 'កែទិន្នន័យ', delete: 'លុប', total: 'សរុប', queue: 'លេខរៀង', payment: 'ការទូទាត់',
      newVisit:'ចុះឈ្មោះពិនិត្យថ្មី',addRecord:'បន្ថែមកំណត់ត្រាថ្មី',cancel:'បោះបង់',newRecordPrompt:'តើចង់បន្ថែមកំណត់ត្រាពិនិត្យថ្មីសម្រាប់អ្នកជំងឺនេះឬ?', summary:'មើលព័ត៌មានអ្នកជំងឺ', completedTitle:'អ្នកជំងឺបានបំពេញទ្រីយ៉ាថ្ងៃនេះ', completedHint:'បង្ហាញតែទ្រីយ៉ាដែលបានបញ្ចប់ថ្ងៃនេះ ចាប់ពីម៉ោង ០០:០០ តាមម៉ោងកម្ពុជា។', close:'បិទ',
      phone:'លេខទូរស័ព្ទ', equityCard:'លេខបណ្ណសមធម៌/ប.ស.ស', paymentType:'ប្រភេទនៃការបង់', allPayments:'គ្រប់ប្រភេទនៃការបង់',
      columns:'ការគ្រប់គ្រងជួរឈរ', pageSize:'ចំនួនក្នុងមួយទំព័រ', page:'ទំព័រទី', of:'នៃ', years:'ឆ្នាំ', months:'ខែ', days:'ថ្ងៃ',
      first:'ទំព័រដំបូង', previous:'ទំព័រមុន', next:'ទំព័របន្ទាប់', last:'ទំព័រចុងក្រោយ', closed:'ករណីព្យាបាលបានបិទ', unavailable:'មិនមានសិទ្ធិលុប',
      deleteConfirm:'តើត្រូវលុបទិន្នន័យអ្នកជំងឺនេះឬ?', deleted:'បានលុបទិន្នន័យអ្នកជំងឺ។',
      empty: 'មិនទាន់មានទិន្នន័យអ្នកជំងឺដែលត្រូវបង្ហាញទេ។', loading: 'កំពុងទាញទិន្នន័យ…',
      saved: 'បានរក្សាទុកកាលបរិច្ឆេទដោយស្វ័យប្រវត្តិ។', loadError: 'មិនអាចទាញបញ្ជីអ្នកជំងឺបានទេ។',
      saveError: 'មិនអាចរក្សាទុកកាលបរិច្ឆេទបានទេ។', unknown: 'មិនបានកំណត់',
    },
    en: {
      system: 'Electronic Medical Record System', title: 'Patient List',
      autosaveHint: 'Discharge dates appear after OPD pharmacy dispensing or the IPD discharge form is completed.', search: 'Search patients',
      searchPlaceholder: 'Name, case number, or Health ID', entryDate: 'Entry date', dischargeDate: 'Discharge date',
      department: 'Department', allDepartments: 'All departments', reset: 'Reset filters', number: 'No.',
      patientName: 'Patient name', sex: 'Sex', age: 'Age', patientId: 'Patient ID', action: 'Action',
      open: 'View record', edit: 'Edit data', delete: 'Delete', total: 'Total',
      newVisit:'New visit', addRecord:'Add new record',cancel:'Cancel',newRecordPrompt:'Add a new visit for this patient?', summary:'View patient details', completedTitle:'Triage completed today', completedHint:'Triage completed today from 00:00, Cambodia time.', close:'Close',
      phone:'Phone number', equityCard:'Equity/NSSF card number', paymentType:'Payment type', allPayments:'All payment types',
      columns:'Manage columns', pageSize:'Rows per page', page:'Page', of:'of', years:'years', months:'months', days:'days',
      first:'First page', previous:'Previous page', next:'Next page', last:'Last page', closed:'Clinical case is closed', unavailable:'Delete is unavailable',
      deleteConfirm:'Delete this patient record from the active database?', deleted:'Patient deleted.', empty: 'No patient records match the current filters.',
      loading: 'Loading patient records…', saved: 'Date saved automatically.',
      loadError: 'Unable to load the patient list.', saveError: 'Unable to save the date.', unknown: 'Not specified',
    },
  };

  let language = 'kh';
  const triageToday = Boolean(document.querySelector('[data-patient-list-mode="triage-today"]'));
  const patientsUrl = triageToday ? '/api/triage/queue?omitPhotos=1' : '/api/patients?includePayment=1&omitPhotos=1';
  let patients = [];
  let csrfToken = '';
  let activeRole = (() => { try { return String(window.emrSession?.user?.activeRole || window.sessionStorage?.getItem('borkeo-active-role') || '').toUpperCase(); } catch { return ''; } })();
  let admissionPanel = null;
  let currentPage = 1;
  const columnKeys=['number','patientName','sex','age','phone','patientId','equityCard','paymentType','department','entryDate','dischargeDate','action'];
  const hiddenColumns=new Set();

  const element = id => document.getElementById(id === 'patient-table-body' && triageToday ? 'triage-body-completed' : id);
  const text = key => copy[language][key] || key;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

  function showStatus(message, state = 'ok') {
    const status = element('list-status');
    status.textContent = message;
    status.dataset.state = state;
  }

  function patientDepartment(patient) {
    return language === 'kh'
      ? (patient.departmentNameKh || patient.departmentNameEn || text('unknown'))
      : (patient.departmentNameEn || patient.departmentNameKh || text('unknown'));
  }

  function localizedSex(value) {
    const normalized = String(value || '').toLowerCase();
    if (language === 'kh') {
      if (['ប្រុស','male','m'].includes(normalized)) return 'ប្រុស';
      if (['ស្រី','female','f'].includes(normalized)) return 'ស្រី';
      return value || text('unknown');
    }
    if (normalized === 'ប្រុស' || normalized === 'male' || normalized === 'm') return 'Male';
    if (normalized === 'ស្រី' || normalized === 'female' || normalized === 'f') return 'Female';
    return value || text('unknown');
  }

  function filteredPatients() {
    const query = element('patient-search').value.trim().toLocaleLowerCase();
    const entry = element('entry-filter').value;
    const discharge = element('discharge-filter').value;
    const department = element('department-filter').value;
    const payment = element('payment-filter').value;
    const list = patients.filter(patient => {
      const haystack = [patient.fullName, patient.firstName, patient.lastName, patient.caseNumber, patient.healthId, patient.phone, patient.equityCard]
        .join(' ').toLocaleLowerCase();
      return (!query || haystack.includes(query)) && (!entry || patient.entryDate === entry) &&
        (!discharge || patient.dischargeDate === discharge) &&
        (!department || patient.departmentCode === department) && (!payment || paymentTypeCode(patient) === payment);
    });
    if (triageToday) return list;
    const seen = new Set();
    const unique = [];
    for (const patient of list) {
      const id = String(patient.healthId || '').trim();
      const key = id ? `id:${id.toLowerCase()}` : `key:${patient.patientKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(patient);
    }
    return unique;
  }

  function renderDepartmentFilter() {
    const select = element('department-filter');
    const previous = select.value;
    const departments = new Map();
    patients.forEach(patient => {
      if (patient.departmentCode) departments.set(patient.departmentCode, patientDepartment(patient));
    });
    select.innerHTML = `<option value="">${escapeHtml(text('allDepartments'))}</option>` +
      [...departments.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) =>
        `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`).join('');
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function ensureAdmissionPanel() {
    if (admissionPanel) return admissionPanel;
    if (triageToday || !['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(activeRole)) return null;
    admissionPanel = document.createElement('section');
    admissionPanel.className = 'patient-panel';
    admissionPanel.id = 'pending-admission-approval-panel';
    admissionPanel.innerHTML = `<header class="panel-heading"><div><h2>Awaiting IPD Admission Approval</h2><p>${['ADMIN','VICE_DIRECTOR'].includes(activeRole) ? 'Admin approval list' : 'Director approval list'} · OPD patients do not require approval.</p></div></header><div id="approval-list" class="table-scroll"></div>`;
    document.querySelector('.patient-shell')?.insertBefore(admissionPanel, document.querySelector('.patient-panel'));
    return admissionPanel;
  }

  async function approveAdmission(patientKey) {
    const response = await fetch('/api/admission-approvals', {
      method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},
      body:JSON.stringify({patientKey}),
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(result.error || 'Unable to approve admission.');
    await loadAdmissionApprovals();
  }

  async function loadAdmissionApprovals() {
    const panel = ensureAdmissionPanel();
    if (!panel) return;
    const host = panel.querySelector('#approval-list');
    host.textContent = 'Loading…';
    try {
      const response = await fetch('/api/admission-approvals/pending', {credentials:'same-origin',cache:'no-store'});
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load approval list.');
      const rows = result.items || [];
      host.innerHTML = rows.length ? `<table><thead><tr><th>No.</th><th>Patient</th><th>Health ID</th><th>Ward</th><th>Entry</th><th>Action</th></tr></thead><tbody>${rows.map((item,index)=>`<tr><td>${index+1}</td><td><strong>${escapeHtml(item.fullName||'—')}</strong></td><td>${escapeHtml(item.healthId||'—')}</td><td>${escapeHtml(item.departmentNameKh||item.departmentNameEn||item.departmentCode||'—')}</td><td>${escapeHtml(item.entryDate||'—')}</td><td><a class="open-record" href="/emr?patient=${encodeURIComponent(item.patientKey)}&view=triage">View</a><button type="button" class="secondary-button" data-approve-admission="${escapeHtml(item.patientKey)}">Approve</button></td></tr>`).join('')}</tbody></table>` : '<div style="padding:18px">No IPD admissions are awaiting your approval.</div>';
      host.querySelectorAll('[data-approve-admission]').forEach(button => button.addEventListener('click', async () => {
        button.disabled = true;
        try { await approveAdmission(button.dataset.approveAdmission); } catch(error) { window.alert(error.message); button.disabled=false; }
      }));
    } catch(error) { host.innerHTML = `<div style="padding:18px;color:#b42318">${escapeHtml(error.message)}</div>`; }
  }

  function editAllowed(patient) {
    if (triageToday || patient.canOpenRecord === false) return false;
    if (activeRole === 'REGISTRATION') return true;
    return ['DOCTOR','NURSE','MIDWIFE','ADMIN','VICE_DIRECTOR'].includes(activeRole) && (patient.serviceMode === 'opd' || patient.serviceMode === 'ipd') && !patient.clinicalClosed;
  }

  function editView(patient) {
    if (triageToday) return 'triage';
    if (activeRole === 'REGISTRATION') return 'register';
    if (activeRole === 'TRIAGE') return 'triage';
    if (patient.serviceMode === 'opd') return 'opd';
    return 'medical';
  }

  function deleteAllowed(patient) {
    if (triageToday) return false;
    if (['ADMIN','VICE_DIRECTOR'].includes(activeRole)) return true;
    return activeRole === 'REGISTRATION' && !patient.triageCompletedAt && !patient.serviceMode;
  }

  function paymentLabel(patient) {
    const status = patient.paymentStatus || {};
    return language === 'kh'
      ? status.labelKh || status.labelEn || 'មិនទាន់បង់ប្រាក់'
      : status.labelEn || status.labelKh || 'Not yet paid';
  }

  function paymentTypeCode(patient) {
    return String(patient.paymentStatus?.paymentType || patient.paymentType || 'NOT_PAID').toUpperCase();
  }

  function paymentTypeLabel(code) {
    const labels={NOT_PAID:['មិនទាន់កំណត់','Not selected'],DIRECT:['បង់ប្រាក់ផ្ទាល់','Direct payment'],CASH:['សាច់ប្រាក់','Cash'],
      NSSF:['ប.ស.ស','NSSF'],NSSF_OUTSIDE:['ប.ស.ស ក្រៅប្រព័ន្ធ','NSSF outside system'],NSSF_WORKER:['ប.ស.ស កម្មករ-និយោជក','NSSF worker–employer'],NSSF_CIVIL:['ប.ស.ស មន្ត្រីរាជការ','NSSF civil servant'],
      HEF:['មូលនិធិសមធម៌','Health Equity Fund'],HEF_POOR:['មូលនិធិសមធម៌ក្រីក្រ','Health Equity Fund'],HEF_VULNERABLE:['មូលនិធិសមធម៌គ្រួសារងាយរងហានីភ័យ','Vulnerable Family Equity Fund'],
      EXEMPT:['លើកលែងការបង់ប្រាក់','Exempt'],DISCOUNT:['បញ្ចុះថ្លៃសេវា','Discount']};
    return labels[code]?.[language==='kh'?0:1] || code;
  }

  function paymentCategoryLabel(patient) {
    const status=patient.paymentStatus||{},code=paymentTypeCode(patient);
    if(code.startsWith('HEF')||String(status.code||'').startsWith('HEF'))return 'បណ្ណមូលនិធិសមធម៌';
    if(status.paymentSubtype==='FULL_WAIVER'||['EXEMPT','FULL_WAIVER'].includes(code)||status.code==='FULL_WAIVER')return 'អនុគ្រោះ';
    if(['DISCOUNT','PARTIAL_WAIVER'].includes(status.paymentSubtype)||code==='DISCOUNT'||Number(status.discountPercent)>0||Number(status.discountAmount)>0)return 'បញ្ចុះថ្លៃ';
    if(code.startsWith('NSSF'))return 'ប.ស.ស';
    if(code==='INSURANCE')return 'ធានារ៉ាប់រង';
    if(code==='NGO')return 'អង្គការ';
    return 'បង់ប្រាក់';
  }

  function renderPaymentFilter() {
    const select=element('payment-filter'),previous=select.value;
    const types=[...new Set(patients.map(paymentTypeCode))].sort();
    select.innerHTML=`<option value="">${escapeHtml(text('allPayments'))}</option>`+types.map(code=>`<option value="${escapeHtml(code)}">${escapeHtml(paymentTypeLabel(code))}</option>`).join('');
    if(types.includes(previous))select.value=previous;
  }

  function formatDate(value) {
    const match=String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
  }

  function dischargeTime(patient) {
    if(!patient.dischargeAt)return '';
    if(typeof patient.dischargeAt==='string' && patient.dischargeAt.includes('T'))return patient.dischargeAt.slice(11,16);
    return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Phnom_Penh',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(patient.dischargeAt));
  }

  function ageLabel(patient) {
    let value=String(patient.age || '').trim();
    if(!value && patient.dateOfBirth) {
      const dob = new Date(patient.dateOfBirth);
      if(!isNaN(dob.getTime())) {
        const ref = patient.entryDate ? new Date(patient.entryDate) : new Date();
        let years = ref.getFullYear() - dob.getFullYear();
        const m = ref.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) years--;
        if (years >= 0) value = String(years);
      }
    }
    if(!value)return '—';
    if(/^\d+(?:\.\d+)?$/.test(value))return `${value} ${text('years')}`;
    return language==='en' ? value.replace(/ឆ្នាំ/g,'years').replace(/ខែ/g,'months').replace(/ថ្ងៃ/g,'days')
      : value.replace(/years?/gi,'ឆ្នាំ').replace(/months?/gi,'ខែ').replace(/days?/gi,'ថ្ងៃ');
  }

  function renderColumns() {
    element('column-options').innerHTML=columnKeys.map(key=>`<label><input type="checkbox" data-column-toggle="${key}" ${hiddenColumns.has(key)?'':'checked'}><span>${escapeHtml(text(key))}</span></label>`).join('');
    applyColumns();
  }

  function applyColumns() {
    document.querySelectorAll('table [data-column]').forEach(cell=>{cell.hidden=hiddenColumns.has(cell.dataset.column);});
  }

  function renderPagination(count) {
    const size=Number(element('page-size').value)||10,pages=Math.max(1,Math.ceil(count/size));
    currentPage=Math.min(Math.max(1,currentPage),pages);
    const start=Math.max(1,Math.min(currentPage-2,pages-4)),end=Math.min(pages,start+4);
    const button=(page,label,title,disabled=false)=>`<button type="button" data-patient-page="${page}" aria-label="${escapeHtml(title)}" ${page===currentPage&&/^\d+$/.test(label)?'aria-current="page"':''} ${disabled?'disabled':''}>${label}</button>`;
    const numbered=[];for(let page=start;page<=end;page++)numbered.push(button(page,String(page),`${text('page')} ${page}`));
    element('patient-pagination').innerHTML=`<span>${text('page')} ${currentPage} ${text('of')} ${pages}</span>`+
      button(1,'«',text('first'),currentPage===1)+button(currentPage-1,'‹',text('previous'),currentPage===1)+numbered.join('')+
      button(currentPage+1,'›',text('next'),currentPage===pages)+button(pages,'»',text('last'),currentPage===pages);
    return size;
  }

  function renderTable() {
    const all=filteredPatients(),size=renderPagination(all.length);
    const offset=(currentPage-1)*size,visible=all.slice(offset,offset+size);
    element('patient-total').textContent=`${text('total')} ${all.length}`;
    if (triageToday) element('triage-completed-count').textContent=String(all.length);
    const body=element('patient-table-body');
    if(!visible.length){body.innerHTML=`<tr class="empty-row"><td colspan="12">${escapeHtml(text('empty'))}</td></tr>`;return;}
    body.innerHTML=visible.map((patient,index)=>{
      const isMgmt=['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(activeRole);
      const isCashier=['CLERK','ACCOUNTANT'].includes(activeRole);
      const access=patient.recordAccess||{};
      const viewHref=isCashier?'/billing?'+new URLSearchParams({patientKey:patient.patientKey,history:'1',from:'patient-list'}):
        isMgmt?'/record-viewer?'+new URLSearchParams({patient:patient.patientKey,from:'patient-list'}):
        '/emr?'+new URLSearchParams({patient:patient.patientKey,view:access.view||(activeRole==='REGISTRATION'?'register':activeRole==='TRIAGE'?'triage':'medical'),mode:'view',from:'patient-list'});
      const clinical=['REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD'].includes(activeRole);
      const eyeButton=(isMgmt||isCashier||clinical&&access.canView)
        ? `<a class="icon-action view" target="_blank" rel="noopener noreferrer" title="មើលព័ត៌មាន" aria-label="មើលព័ត៌មាន" href="${escapeHtml(viewHref)}">👁</a>`
        : `<button type="button" class="icon-action view" data-view-patient="${escapeHtml(patient.patientKey)}" title="មើលព័ត៌មានអ្នកជំងឺ" aria-label="មើលព័ត៌មានអ្នកជំងឺ">👁</button>`;
      const editButton=(isMgmt||clinical&&access.canView)
        ? `<button type="button" class="icon-action edit" title="${access.requiresApproval?'ស្នើសុំកែប្រែ':'កែប្រែព័ត៌មាន'}" aria-label="កែប្រែព័ត៌មាន" data-request-edit="${escapeHtml(patient.patientKey)}" ${!isMgmt&&!access.canEdit&&!access.requiresApproval?'disabled':''}>✎</button>` : '';
      const deleteButton=!isCashier?`<button type="button" class="icon-action delete" title="ស្នើសុំលុបកំណត់ត្រាពិនិត្យ" aria-label="ស្នើសុំលុបកំណត់ត្រាពិនិត្យ" data-action-delete="${escapeHtml(patient.patientKey)}">🗑</button>`:'';
      return `<tr data-patient-key="${escapeHtml(patient.patientKey)}">
        <td data-column="number">${offset+index+1}</td>
        <td data-column="patientName"><span class="patient-primary">${escapeHtml(patient.fullName || text('unknown'))}</span></td>
        <td data-column="sex">${escapeHtml(localizedSex(patient.sex))}</td>
        <td data-column="age" class="patient-age"><span class="age-badge" data-patient-value>${escapeHtml(ageLabel(patient))}</span></td>
        <td data-column="phone" class="patient-phone" data-patient-value>${escapeHtml(patient.phone || '')}</td>
        <td data-column="patientId">${!triageToday && ['REGISTRATION','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(activeRole) ? `<button type="button" class="patient-id-link" style="border:0!important;outline:0!important;background:transparent!important;padding:0!important;box-shadow:none!important;color:#087dff!important;font:inherit!important;font-weight:700!important;cursor:pointer;text-decoration:none!important;" data-new-record="${escapeHtml(patient.patientKey)}">${escapeHtml(patient.healthId || patient.patientKey)}</button>` : `<span class="health-id" data-patient-value>${escapeHtml(patient.healthId || '')}</span>`}</td>
        <td data-column="equityCard" data-patient-value>${escapeHtml(patient.equityCard || '')}</td>
        <td data-column="paymentType"><span class="patient-payment-category">${escapeHtml(paymentCategoryLabel(patient))}</span></td>
        <td data-column="department">${escapeHtml(patientDepartment(patient))}</td>
        <td data-column="entryDate" class="date-cell"><span data-patient-value>${escapeHtml(formatDate(patient.entryDate))}</span> <span class="entry-time">${escapeHtml(patient.entryTime || '')}</span></td>
        <td data-column="dischargeDate" class="date-cell"><span class="discharge-date" data-patient-value>${escapeHtml(formatDate(patient.dischargeDate))} ${escapeHtml(dischargeTime(patient))}</span><input type="date" data-discharge-date value="${escapeHtml(patient.dischargeDate)}" aria-label="${escapeHtml(text('dischargeDate'))}" readonly hidden></td>
        <td data-column="action"><div class="patient-actions">${eyeButton}${triageToday ? '' : editButton+deleteButton}</div></td>
      </tr>`;
    }).join('');
    applyColumns();
  }

  function translatePage() {
    document.documentElement.lang = language === 'kh' ? 'km' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = text(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = text(node.dataset.i18nPlaceholder); });
    renderDepartmentFilter();
    renderPaymentFilter();
    renderColumns();
    renderTable();
  }

  async function session() {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Authentication required');
    const result = await response.json();
    csrfToken = result.csrfToken;
    activeRole = String(result.user?.activeRole || '').toUpperCase();
    try { window.sessionStorage?.setItem('borkeo-active-role', activeRole); } catch {}
    ensureAdmissionPanel();
  }

  let patientRequestGeneration = 0;
  let refreshInFlight = false;
  let patientLoads = 0;
  let lastPatientSnapshot = null;

  async function loadPatients() {
    ++patientLoads;
    const generation = ++patientRequestGeneration;
    showStatus(text('loading'));
    try {
      const sessionPromise = session();
      const patientsPromise = fetch(patientsUrl, {
        credentials: 'same-origin', cache: 'no-store',
      });
      await sessionPromise;
      const response = await patientsPromise;
      if (!response.ok) throw new Error('សំណើមិនបានជោគជ័យ');
      const result = await response.json();
      if (generation !== patientRequestGeneration) return;
      patients = (triageToday ? result.completed : result.patients) || [];
      lastPatientSnapshot = JSON.stringify(patients);
      showStatus('');
      renderDepartmentFilter();
      renderPaymentFilter();
      renderTable();
      if (!triageToday && ['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(activeRole)) void loadAdmissionApprovals();
    } catch (error) {
      console.error(error);
      if (generation === patientRequestGeneration) showStatus(text('loadError'), 'error');
    } finally { --patientLoads; }
  }

  async function refreshPaymentStatuses() {
    if(patientLoads || refreshInFlight || document.hidden || document.activeElement?.matches('[data-date-field]'))return;
    refreshInFlight = true;
    const generation = ++patientRequestGeneration;
    try {
      const response=await fetch(patientsUrl,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)return;
      const result=await response.json();
      if(generation !== patientRequestGeneration || document.hidden || document.activeElement?.matches('[data-date-field]'))return;
      const nextPatients=(triageToday ? result.completed : result.patients) || [];
      const snapshot=JSON.stringify(nextPatients);
      if(snapshot === lastPatientSnapshot)return;
      patients=nextPatients;
      lastPatientSnapshot=snapshot;
      renderDepartmentFilter();renderPaymentFilter();renderTable();
    } catch(error){console.warn('Unable to refresh patient list.',error);}
    finally { refreshInFlight = false; }
  }

  async function updateDates(input) {
    const row = input.closest('[data-patient-key]');
    const patient = patients.find(item => item.patientKey === row?.dataset.patientKey);
    if (!patient) return;
    const entryDate = row.querySelector('[data-date-field="entryDate"]').value;
    const previousEntryDate = patient.entryDate;
    input.disabled = true;
    ++patientRequestGeneration; // Ignore a pre-edit poll that completes after this save.
    try {
      const response = await fetch('/api/patient-dates', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ patientKey: patient.patientKey, entryDate }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'សំណើមិនបានជោគជ័យ');
      Object.assign(patient, result.patient);
      lastPatientSnapshot = null;
      showStatus(text('saved'));
      renderTable();
      if (!triageToday && ['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(activeRole)) void loadAdmissionApprovals();
    } catch (error) {
      console.error(error);
      row.querySelector('[data-date-field="entryDate"]').value = previousEntryDate;
      showStatus(text('saveError'), 'error');
    } finally {
      input.disabled = false;
    }
  }

  function showPatientSummary(patientKey) {
    const patient = patients.find(item => item.patientKey === patientKey);
    if (!patient) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'patient-summary-dialog';
    const values = {patientName:patient.fullName, patientId:patient.healthId, sex:localizedSex(patient.sex),
      age:ageLabel(patient), phone:patient.phone, equityCard:patient.equityCard,
      paymentType:paymentTypeLabel(paymentTypeCode(patient)), department:patientDepartment(patient),
      entryDate:formatDate(patient.entryDate)+' '+(patient.entryTime || ''),
      dischargeDate:formatDate(patient.dischargeDate)+' '+dischargeTime(patient)};
    dialog.innerHTML = `<h2>${escapeHtml(text('summary'))}</h2><p>${escapeHtml(patient.caseNumber || '')}</p><dl>${Object.entries(values).map(([key,value]) => `<div><dt>${escapeHtml(text(key))}</dt><dd>${escapeHtml(value || '—')}</dd></div>`).join('')}</dl><button type="button">${escapeHtml(text('close'))}</button>`;
    document.body.append(dialog);
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  document.addEventListener('input', event => {
    if (triageToday && event.target.matches('#triage-search')) {element('patient-search').value=event.target.value;currentPage=1;renderTable();}
    if (event.target.matches('#patient-search, #entry-filter, #discharge-filter')) {currentPage=1;renderTable();}
  });
  document.addEventListener('change', event => {
    if (event.target.matches('#department-filter,#payment-filter,#page-size')) {currentPage=1;renderTable();}
    if(event.target.matches('[data-column-toggle]')) {const key=event.target.dataset.columnToggle;if(event.target.checked)hiddenColumns.delete(key);else hiddenColumns.add(key);applyColumns();}
    if (event.target.matches('[data-date-field]')) void updateDates(event.target);
  });
  function confirmNewRecord(patientKey) {
    const patient=patients.find(item=>item.patientKey===patientKey);
    if(!patient)return;
    const dialog=document.createElement('dialog');dialog.className='patient-new-record-dialog';dialog.dataset.languageExclude='';
    dialog.innerHTML=`<h2>${escapeHtml(text('newRecordPrompt'))}</h2><p>${escapeHtml(patient.fullName)} · ${escapeHtml(patient.healthId||'')}</p><div><button type="button" data-add-record>${escapeHtml(text('addRecord'))}</button><button type="button" data-cancel-record>${escapeHtml(text('cancel'))}</button></div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-add-record]').onclick=()=>{dialog.close();dialog.remove();window.location.assign(`/emr?view=register&newVisitFrom=${encodeURIComponent(patientKey)}`);};
    dialog.querySelector('[data-cancel-record]').onclick=()=>{dialog.close();dialog.remove();};
    dialog.addEventListener('cancel',()=>dialog.remove());dialog.showModal();
  }
  let mgmtChoiceModal = null;
  let mgmtHistoryModal = null;
  let mgmtHistorySequence = 0;

  function ensureMgmtChoiceModal() {
    if (mgmtChoiceModal) return mgmtChoiceModal;
    const dialog = document.createElement('dialog');
    dialog.id = 'mgmt-choice-dialog';
    dialog.dataset.languageExclude = '';
    dialog.setAttribute('aria-labelledby', 'mgmt-choice-title');
    dialog.className = 'patient-summary-dialog';
    dialog.style.maxWidth = '460px';
    dialog.style.padding = '22px';
    dialog.style.borderRadius = '12px';
    dialog.style.border = '1px solid #71c3d8';
    dialog.style.boxShadow = '0 12px 36px rgba(7, 92, 124, 0.22)';
    dialog.innerHTML = `
      <h3 id="mgmt-choice-title" style="margin:0 0 8px;font-size:18px;color:#075c7c;"></h3>
      <p id="mgmt-choice-desc" style="margin:0 0 18px;color:#557082;font-size:14px;"></p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button type="button" id="mgmt-choice-medical-btn" style="padding:11px 16px;background:#0b89ae;color:#fff;border:0;border-radius:7px;font-weight:bold;cursor:pointer;font-size:14px;text-align:center;"></button>
        <button type="button" id="mgmt-choice-history-btn" style="padding:11px 16px;background:#2ea44f;color:#fff;border:0;border-radius:7px;font-weight:bold;cursor:pointer;font-size:14px;text-align:center;"></button>
        <button type="button" id="mgmt-choice-cancel-btn" style="padding:9px 16px;background:#eef4f7;color:#334f5d;border:1px solid #c9dce4;border-radius:7px;cursor:pointer;font-size:14px;text-align:center;"></button>
      </div>
    `;
    document.body.appendChild(dialog);
    mgmtChoiceModal = dialog;
    return dialog;
  }

  function openMgmtChoice(patientKey, patientName, viewHref) {
    const dialog = ensureMgmtChoiceModal();
    const titleEl = dialog.querySelector('#mgmt-choice-title');
    const descEl = dialog.querySelector('#mgmt-choice-desc');
    const medicalBtn = dialog.querySelector('#mgmt-choice-medical-btn');
    const historyBtn = dialog.querySelector('#mgmt-choice-history-btn');
    const cancelBtn = dialog.querySelector('#mgmt-choice-cancel-btn');

    titleEl.textContent = language === 'kh' ? `ជម្រើសមើលទិន្នន័យ ៖ ${patientName}` : `View Options: ${patientName}`;
    descEl.textContent = language === 'kh' ? 'សូមជ្រើសរើសព័ត៌មានដែលលោកអ្នកចង់ពិនិត្យមើល ៖' : 'Please select what you would like to view:';
    medicalBtn.textContent = language === 'kh' ? 'មើលកំណត់ត្រាវេជ្ជសាស្ត្រ' : 'View Medical Record';
    historyBtn.textContent = language === 'kh' ? 'មើលកំណត់ហេតុផ្លាស់ប្តូរទិន្នន័យ' : 'View Data Change Log';
    cancelBtn.textContent = language === 'kh' ? 'បោះបង់' : 'Cancel';

    medicalBtn.onclick = () => {
      dialog.close();
      window.open(`/emr?patient=${encodeURIComponent(patientKey)}`, '_blank', 'noopener,noreferrer');
    };
    historyBtn.onclick = () => {
      dialog.close();
      openMgmtHistory(patientKey, patientName);
    };
    cancelBtn.onclick = () => {
      dialog.close();
    };

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function ensureMgmtHistoryModal() {
    if (mgmtHistoryModal) return mgmtHistoryModal;
    const dialog = document.createElement('dialog');
    dialog.id = 'mgmt-history-dialog';
    dialog.dataset.languageExclude = '';
    dialog.setAttribute('aria-labelledby', 'mgmt-history-title');
    dialog.className = 'patient-summary-dialog';
    dialog.style.width = 'min(960px, calc(100% - 24px))';
    dialog.style.maxWidth = '960px';
    dialog.style.maxHeight = '86vh';
    dialog.style.overflow = 'auto';
    dialog.style.padding = '22px';
    dialog.style.borderRadius = '12px';
    dialog.style.border = '1px solid #71c3d8';
    dialog.style.boxShadow = '0 12px 36px rgba(7, 92, 124, 0.22)';
    dialog.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #d4eaf1;padding-bottom:10px;">
        <div>
          <h3 id="mgmt-history-title" style="margin:0;font-size:18px;color:#075c7c;"></h3>
          <p id="mgmt-history-patient" style="margin:4px 0 0;color:#557082;font-size:13px;"></p>
        </div>
        <button type="button" id="mgmt-history-close-btn" style="padding:6px 14px;background:#64748b;color:#fff;border:0;border-radius:6px;cursor:pointer;font-size:13px;"></button>
      </div>
      <div id="mgmt-history-body" style="font-size:13px;color:#1e3a47;"></div>
    `;
    document.body.appendChild(dialog);
    mgmtHistoryModal = dialog;
    return dialog;
  }

  async function openMgmtHistory(patientKey, patientName) {
    const ticket = ++mgmtHistorySequence;
    const dialog = ensureMgmtHistoryModal();
    const titleEl = dialog.querySelector('#mgmt-history-title');
    const patientEl = dialog.querySelector('#mgmt-history-patient');
    const closeBtn = dialog.querySelector('#mgmt-history-close-btn');
    const bodyEl = dialog.querySelector('#mgmt-history-body');

    titleEl.textContent = language === 'kh' ? 'កំណត់ហេតុផ្លាស់ប្តូរទិន្នន័យអ្នកជំងឺ' : 'Patient Data Change Log';
    patientEl.textContent = `${language === 'kh' ? 'អ្នកជំងឺ ៖ ' : 'Patient: '} ${patientName} (${patientKey})`;
    closeBtn.textContent = language === 'kh' ? 'បិទ' : 'Close';
    closeBtn.onclick = () => dialog.close();

    bodyEl.innerHTML = `<div style="padding:24px;text-align:center;color:#66818c;">${language === 'kh' ? 'កំពុងទាញយកកំណត់ហេតុ...' : 'Loading change log...'}</div>`;

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    try {
      const response = await fetch(`/api/patient-editor-history?patientKey=${encodeURIComponent(patientKey)}`, {
        credentials: 'same-origin', cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to load history');
      const data = await response.json();
      if (ticket !== mgmtHistorySequence) return;
      const entries = Array.isArray(data.entries) ? data.entries : [];
      if (!entries.length) {
        bodyEl.innerHTML = `<div style="padding:24px;text-align:center;color:#66818c;">${language === 'kh' ? 'មិនទាន់មានកំណត់ហេតុនៃការផ្លាស់ប្តូរទិន្នន័យនៅឡើយទេ' : 'No data change history found.'}</div>`;
        return;
      }

      const sorted = [...entries].reverse();
      const rows = sorted.map((entry, idx) => {
        let timeStr = '';
        try {
          timeStr = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Phnom_Penh',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
          }).format(new Date(entry.savedAt));
        } catch {
          timeStr = String(entry.day || '');
        }

        const editor = `${escapeHtml(entry.editorName || '—')} (${escapeHtml(entry.role || 'STAFF')})`;
        let scopeLabel = entry.scope;
        if (entry.scope === 'medical') scopeLabel = language === 'kh' ? 'កំណត់ត្រាវេជ្ជសាស្ត្រ' : 'Medical Record';
        else if (entry.scope === 'nursing') scopeLabel = language === 'kh' ? 'ដំណើរការថែទាំ' : 'Nursing Process';
        else if (entry.scope === 'audit') scopeLabel = language === 'kh' ? 'សកម្មភាពទូទៅ' : 'Audit Action';
        else if (entry.scope === 'legacy') scopeLabel = language === 'kh' ? 'កំណត់ត្រាចាស់' : 'Legacy Save';

        let detailsHtml = '';
        if (Array.isArray(entry.notes) && entry.notes.length) {
          detailsHtml = `<ul style="margin:0;padding-left:18px;list-style-type:disc;">` +
            entry.notes.map(n => {
              const hasDifference = Object.prototype.hasOwnProperty.call(n,'before') && Object.prototype.hasOwnProperty.call(n,'after');
              const detail = hasDifference
                ? `<div><span>${language === 'kh' ? 'មុន' : 'Before'}: ${escapeHtml(n.before || '—')}</span><br><span>${language === 'kh' ? 'ក្រោយ' : 'After'}: ${escapeHtml(n.after || '—')}</span></div>`
                : `<span>${escapeHtml(n.text || '')}</span>`;
              return `<li style="margin-bottom:6px;overflow-wrap:anywhere;"><strong>${escapeHtml(n.label || n.field)}:</strong> ${detail}</li>`;
            }).join('') + `</ul>`;
        } else {
          detailsHtml = `<span style="color:#64748b;">${language === 'kh' ? 'កំណត់ត្រាចាស់នេះមិនបានកត់ព័ត៌មានលម្អិតនៃការកែប្រែទេ' : 'Specific field changes were not recorded for this historical entry.'}</span>`;
        }

        const bg = idx % 2 === 0 ? '#fff' : '#f8fbfd';
        return `
          <tr style="background:${bg};border-bottom:1px solid #e1eff5;">
            <td style="padding:9px 10px;white-space:nowrap;font-weight:600;color:#075c7c;vertical-align:top;">${escapeHtml(timeStr)}</td>
            <td style="padding:9px 10px;vertical-align:top;">${editor}</td>
            <td style="padding:9px 10px;white-space:nowrap;vertical-align:top;"><span style="display:inline-block;padding:2px 7px;border-radius:4px;background:#e2f2f7;color:#086382;font-size:12px;">${escapeHtml(scopeLabel)}</span></td>
            <td style="padding:9px 10px;vertical-align:top;">${detailsHtml}</td>
          </tr>
        `;
      }).join('');

      bodyEl.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;border:1px solid #d4eaf1;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#edf8f3;color:#075c7c;border-bottom:2px solid #36ad70;">
                <th style="padding:10px;text-align:left;white-space:nowrap;">${language === 'kh' ? 'កាលបរិច្ឆេទ & ម៉ោង' : 'Date & Time'}</th>
                <th style="padding:10px;text-align:left;white-space:nowrap;">${language === 'kh' ? 'អ្នកកែប្រែ' : 'Modified By'}</th>
                <th style="padding:10px;text-align:left;white-space:nowrap;">${language === 'kh' ? 'ផ្នែក' : 'Scope'}</th>
                <th style="padding:10px;text-align:left;">${language === 'kh' ? 'ព័ត៌មានលម្អិត' : 'Change Details'}</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      if (ticket !== mgmtHistorySequence) return;
      bodyEl.innerHTML = `<div style="padding:24px;text-align:center;color:#b91c1c;">${language === 'kh' ? 'មិនអាចទាញយកកំណត់ហេតុបានទេ។' : 'Failed to retrieve change log.'}</div>`;
    }
  }

  async function submitPatientRequest(kind,patient,scope=''){
    const reason=prompt(kind==='PATIENT_DELETE'?'សូមបញ្ចូលមូលហេតុស្នើសុំលុបកំណត់ត្រាពិនិត្យនេះទៅគណៈគ្រប់គ្រង។':'សូមបញ្ចូលមូលហេតុស្នើសុំកែប្រែកំណត់ត្រាក្រោយចេញពីពេទ្យ។','');
    if(!reason?.trim())return;
    try{const response=await fetch('/api/requests',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({kind,patientKey:patient.patientKey,reason:reason.trim(),payload:{scope}})});const result=await response.json();if(!response.ok)throw Error(result.error);showStatus('បានផ្ញើសំណើទៅគណៈគ្រប់គ្រង។ កំណត់ត្រានៅរក្សាដដែលរហូតដល់អនុម័ត។');}catch(error){alert(error.message)}
  }

  document.addEventListener('click', async event => {
    const mgmtViewBtn = event.target.closest('[data-mgmt-view]');
    if (mgmtViewBtn) {
      const patientKey = mgmtViewBtn.dataset.mgmtView;
      const viewHref = mgmtViewBtn.dataset.viewHref;
      const patientName = mgmtViewBtn.dataset.patientName || patientKey;
      openMgmtChoice(patientKey, patientName, viewHref);
      return;
    }
    const idButton=event.target.closest('[data-new-record]');
    if(idButton){confirmNewRecord(idButton.dataset.newRecord);return;}
    const summaryButton=event.target.closest('[data-view-patient]');
    if (summaryButton) showPatientSummary(summaryButton.dataset.viewPatient);
    const pageButton=event.target.closest('[data-patient-page]');
    if(pageButton && !pageButton.disabled){currentPage=Number(pageButton.dataset.patientPage);renderTable();}
    const openButton = event.target.closest('[data-open-patient]');
    if (openButton) window.location.href = `/emr?patient=${encodeURIComponent(openButton.dataset.openPatient)}`;
    const requestEditButton=event.target.closest('[data-request-edit]');
    if(requestEditButton){
      const patient=patients.find(item=>item.patientKey===requestEditButton.dataset.requestEdit);if(!patient)return;
      const access=patient.recordAccess||{};
      if(access.requiresApproval){await submitPatientRequest('PATIENT_EDIT',patient,access.scope);return;}

      const dialog=document.createElement('dialog');
      dialog.className='patient-summary-dialog patient-edit-choice-dialog';
      dialog.style.maxWidth='440px';
      dialog.style.padding='22px';
      dialog.style.borderRadius='12px';
      dialog.style.border='1px solid #71c3d8';
      dialog.style.boxShadow='0 12px 36px rgba(7, 92, 124, 0.22)';
      dialog.innerHTML=`
        <h2 style="margin:0 0 8px;font-size:16px;color:#075c7c;">${escapeHtml(patient.fullName || text('unknown'))}</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#475569;">${patient.healthId ? `${escapeHtml(text('patientId'))}: ${escapeHtml(patient.healthId)}` : ''}</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button type="button" data-action-edit-info style="padding:10px 14px;background:#0284c7;color:#fff;border:0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;text-align:center;"><span aria-hidden="true">✎</span> ${escapeHtml(text('edit'))}</button>
          <button type="button" data-action-add-record style="padding:10px 14px;background:#0d9488;color:#fff;border:0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;text-align:center;"><span aria-hidden="true">➕</span> ${escapeHtml(text('addRecord'))}</button>
          <button type="button" data-action-cancel style="padding:8px 14px;background:#64748b;color:#fff;border:0;border-radius:8px;font-size:13px;cursor:pointer;margin-top:4px;">${escapeHtml(text('cancel'))}</button>
        </div>
      `;
      dialog.querySelector('[data-action-edit-info]').onclick=()=>{
        dialog.close();
        dialog.remove();
        if(['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(activeRole)){
          const choices=[['register','ព័ត៌មានចុះឈ្មោះ'],['triage','ព័ត៌មានទ្រីយ៉ា'],[patient.serviceMode==='opd'?'opd':'medical','កំណត់ត្រាវេជ្ជសាស្ត្រ'],['nursing','ដំណើរការថែទាំ']];
          const subDialog=document.createElement('dialog');subDialog.className='patient-summary-dialog';
          subDialog.innerHTML='<h2>ជ្រើសរើសទម្រង់ដែលត្រូវកែប្រែ</h2>'+choices.map(([view,label])=>`<p><button type="button" data-edit-view="${view}">${label}</button></p>`).join('')+'<button type="button" data-cancel-edit>បោះបង់</button>';
          subDialog.onclick=event=>{const button=event.target.closest('[data-edit-view]');if(button)location.assign('/emr?'+new URLSearchParams({patient:patient.patientKey,view:button.dataset.editView,mode:'edit',from:'patient-list'}));if(event.target.closest('[data-cancel-edit]'))subDialog.close()};
          subDialog.addEventListener('close',()=>subDialog.remove());document.body.append(subDialog);subDialog.showModal();
        } else {
          try { sessionStorage.setItem('emr_from_patient_list', '1'); } catch (_) {}
          if(access.canEdit)location.assign('/emr?'+new URLSearchParams({patient:patient.patientKey,view:access.view,mode:'edit'}));
        }
      };
      dialog.querySelector('[data-action-add-record]').onclick=()=>{
        dialog.close();
        dialog.remove();
        location.assign(`/emr?view=register&newVisitFrom=${encodeURIComponent(patient.patientKey)}&from=patient-list`);
      };
      dialog.querySelector('[data-action-cancel]').onclick=()=>{
        dialog.close();
        dialog.remove();
      };
      dialog.addEventListener('close',()=>dialog.remove());
      document.body.append(dialog);
      dialog.showModal();
      return;
    }
    const deleteButton=event.target.closest('[data-action-delete]');
    if(deleteButton){const patient=patients.find(item=>item.patientKey===deleteButton.dataset.actionDelete);if(patient)await submitPatientRequest('PATIENT_DELETE',patient);return;}

  });
  element('reset-filters').addEventListener('click', () => {
    element('patient-search').value = '';
    element('entry-filter').value = '';
    element('discharge-filter').value = '';
    element('department-filter').value = '';
    element('payment-filter').value = '';
    currentPage=1;
    renderTable();
  });

  translatePage();
  window.addEventListener('borkeo-language-change', event => {
    language = event.detail?.language === 'en' ? 'en' : 'kh';
    translatePage();
  });
  void loadPatients();
  window.addEventListener('focus', () => void refreshPaymentStatuses());
  window.addEventListener('staff-invoice-created', () => void refreshPaymentStatuses());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshPaymentStatuses();
  });
  window.setInterval(() => { if (!document.hidden) void refreshPaymentStatuses(); }, triageToday ? 15000 : 30000);
})();
