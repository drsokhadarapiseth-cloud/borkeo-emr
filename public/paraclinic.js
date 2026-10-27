'use strict';
// Paraclinic
(function () {
  const panels = [];
  let patient = null;
  let catalog = null;
  let csrf = '';
  let user = null;
  let timer = null;
  let currentOrders = [];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  const SHORT_LABEL_CODES = new Set([
    'MCV','MCH','MCHC','RDW','MPV','HGB','HCT','RBC','WBC','PLT','NEUT','LYMPH','RETIC',
    'PT','INR','APTT','FIB','DDIMER','BUN','CREAT','HBA1C','AST','ALT','ALP','GGT','TBIL','DBIL',
    'CHOL','TG','HDL','LDL','TROP_I','TROP_T','CKMB','BNP','TSH','FT4','FT3','BHCG','FSH','LH',
    'AFP','CEA','CA125','CA199','CA153','PSA','CRP','RF','ASO','HBSAG','HCV','RPR','TPHA'
  ]);

  function shortTestName(item) {
    if (!item) return '';
    if (SHORT_LABEL_CODES.has(item.code) && String(item.name || '').length > 12) return item.code;
    return item.name || item.code;
  }

  function statusLabel(status) {
    return ({
      PAYMENT_PENDING:'Waiting for Cashier Payment', ORDERED:'Ordered', WARD_RECEIVED:'Received by ward',
      COLLECTED:'Specimen Collected', SENT_TO_LAB:'Sent to Laboratory',
      RECEIVED:'Laboratory Received', PROCESSING:'Testing in Progress',
      RESULT_AVAILABLE:'Result Released to Ward', WARD_SEEN:'Ward Seen',
      REJECTED:'Specimen Rejected', CANCELLED:'Cancelled'
    })[status] || status;
  }

  function isWardNursingRole() { return ['NURSE','MIDWIFE'].includes(user?.activeRole); }
  function canOrder() { return ['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(user?.activeRole); }
  const DUPLICATE_BLOCKED_STATUSES = new Set(['PAYMENT_PENDING','ORDERED','WARD_RECEIVED','COLLECTED','SENT_TO_LAB','RECEIVED','PROCESSING','RESULT_AVAILABLE','WARD_SEEN','SCHEDULED','PERFORMED']);
  function activeOrdersForPatient() { return (currentOrders || []).filter(order => DUPLICATE_BLOCKED_STATUSES.has(order.status)); }
  function hasExistingLabTest(code) {
    const target=String(code||'').toUpperCase();
    return activeOrdersForPatient().some(order => order.modality === 'LAB' && (order.request?.items || []).some(item => String(item?.code||'').toUpperCase() === target));
  }
  function hasExistingImaging(modality, examination) {
    const target=String(examination||'').trim().replace(/\s+/g,' ').toUpperCase();
    return Boolean(target) && activeOrdersForPatient().some(order => order.modality === modality && String(order.request?.examination || order.request?.bodyArea || '').trim().replace(/\s+/g,' ').toUpperCase() === target);
  }

  function priorityLabel(priority) { return priority === 'URGENT' ? 'Urgent' : 'Routine'; }
  function modalityLabel(value) {
    return ({
      LAB: 'Laboratory',
      ULTRASOUND: 'Ultrasound',
      XRAY: 'X-ray',
      CT: 'CT',
      MRI: 'MRI',
      ECG: 'ECG',
      EEG: 'EEG',
      ECHOCARDIOLOGY: 'Echocardiology',
      FIBROSCOPY: 'Fibroscopy',
      COLOSCOPY: 'Coloscopy',
      OTOSCOPY: 'Otoscopy',
      RHINOSCOPY: 'Rhinoscopy',
      BRONCHOSCOPY: 'Bronchoscopy',
      LARYNGOSCOPY: 'Laryngoscopy'
    })[value] || value;
  }
  function categoryLabel(category) {
    return ({
      'Hematology':'Hematology', 'Coagulation':'Coagulation', 'Clinical Chemistry':'Clinical Chemistry',
      'Renal Function':'Renal Function', 'Electrolytes':'Electrolytes', 'Liver Function':'Liver Function',
      'Lipid Profile':'Lipid Profile', 'Cardiac Markers':'Cardiac Markers', 'Hormones':'Hormones',
      'Endocrinology / Hormones':'Endocrinology / Hormones', 'Tumor Markers':'Tumor Markers',
      'Immunology / Serology':'Immunology / Serology', 'Serology / Immunology':'Serology / Immunology',
      'RDT':'RDT / Rapid Tests', 'Microbiology':'Microbiology', 'Parasitology':'Parasitology',
      'Urinalysis':'Urinalysis', 'Stool Examination':'Stool Examination', 'Molecular / PCR':'Molecular / PCR',
      'Blood Bank / Transfusion':'Blood Bank / Transfusion', 'Other / Special':'Other / Special'
    })[category] || category || 'Other';
  }
  function flagLabel(flag) { return ({ LOW:'Low', HIGH:'High', CRITICAL_LOW:'Critical Low', CRITICAL_HIGH:'Critical High' })[flag] || ''; }

  function groupLabItems(items) {
    const groups = new Map();
    for (const item of items || []) {
      const labTest = catalog?.find(test => test.code === item.code);
      const category = labTest?.category || 'Other';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push({ ...item, labTest });
    }
    return groups;
  }

  function localDateTimeValue(timestamp = Date.now()) {
    const date = new Date(timestamp);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  async function json(url, options = {}) {
    options.credentials = 'same-origin';
    options.headers = {
      ...(options.headers || {}),
      ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
    };
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function canUse() { return ['DOCTOR', 'ADMIN','VICE_DIRECTOR', 'NURSE', 'MIDWIFE'].includes(user?.activeRole); }
  function isPrePaymentOpdReview() { return new URLSearchParams(window.location.search).get('view') === 'opd-paraclinic' && (user?.activeRole === 'DOCTOR'); }
  function needsOpdFeeChoice(context) {
    return context === 'opd' && String(patient?.serviceMode || patient?.summary?.serviceMode || '').toLowerCase() === 'opd'
      && (user?.activeRole === 'DOCTOR');
  }
  function opdFeeChoice(context) {
    if (!needsOpdFeeChoice(context)) return '';
    const english = document.documentElement.lang === 'en';
    return `<fieldset class="opd-fee-choice"><legend>${english ? 'Paraclinic fee' : 'តម្លៃសេវាពិនិត្យអមគ្លីនិក'}</legend>
      <label><input type="radio" name="chargeMode" value="PAID" checked> ${english ? 'Pay using the invoice at Cashier' : 'បង់ប្រាក់តាមវិក្កយបត្រនៅបេឡា'}</label>
      <label><input type="radio" name="chargeMode" value="FREE"> ${english ? 'Free of charge' : 'ឥតគិតថ្លៃ'}</label>
    </fieldset>`;
  }
  function opdSubmitActions(context) {
    const english = document.documentElement.lang === 'en';
    return needsOpdFeeChoice(context)
      ? `<button class="primary" type="submit" data-route="DIRECT">${english ? 'Send to Cashier' : 'បញ្ជូនទៅបេឡា'}</button><button type="submit" data-route="NURSE">${english ? 'Send to Nurse' : 'បញ្ជូនទៅគិលានុបដ្ឋាក'}</button>`
      : `<button class="primary" type="submit">${english ? 'Send Order to Department' : 'បញ្ជូនសំណើទៅផ្នែក'}</button>`;
  }
  function setup() {
    if (panels.length || !canUse()) return;
    const contexts = isWardNursingRole() ? ['nursing'] : ['opd', 'ipd'];
    for (const context of contexts) {
      const host = document.getElementById(`sub_${context}`);
      if (!host) continue;
      // Keep the original clinical form at full width: no split wrappers.
      const panel = document.createElement('section');
      panel.className = 'paraclinic-inline no-print';
      panel.dataset.permissionScope = 'paraclinic';
      panel.dataset.languageExclude = '';
      panel.dataset.context = context;
      panel.innerHTML = `<header><strong>ការស្នើសុំ និងលទ្ធផល Paraclinic</strong>${canOrder() ? `
        <div class="paraclinic-header-actions" style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn-blue" data-request-lab>+ ស្នើសុំមន្ទីរពិសោធន៍ (Lab)</button>
          <button type="button" class="btn-secondary" data-request-imaging>+ ស្នើសុំរូបភាព (Imaging)</button>
          <button type="button" class="btn-secondary" data-request-paraclinic style="display:none;">+ ស្នើសុំ Paraclinic</button>
        </div>` : ''}</header>
        <div data-summary role="status" aria-live="polite"></div>
        <details class="paraclinic-recent"><summary>សំណើ និងលទ្ធផល</summary><div data-recent></div></details>`;
      const investigation = document.getElementById(context === 'opd' ? 'inv_list' : 'ipd_investigations');
      if (context !== 'nursing' && investigation && host.contains(investigation)) investigation.parentElement.insertAdjacentElement('afterend', panel);
      else host.prepend(panel);
      panels.push(panel);
      panel.querySelector('[data-request-lab]')?.addEventListener('click', () => {
        if (!patient?.patientKey) { alert('សូមបើកអ្នកជំងឺជាមុន'); return; }
        openLabOrder(context, patient.patientKey);
      });
      panel.querySelector('[data-request-imaging]')?.addEventListener('click', () => {
        if (!patient?.patientKey) { alert('សូមបើកអ្នកជំងឺជាមុន'); return; }
        openRequestChooser(context, 'imaging');
      });
      panel.querySelector('[data-request-paraclinic]')?.addEventListener('click', () => openRequestChooser(context));
      panel.querySelector('[data-recent]').addEventListener('click', async event => {
        const printButton = event.target.closest('[data-print-order]');
        if (printButton) {
          event.stopPropagation();
          const orderId = printButton.dataset.printOrder;
          try {
            const orderData = currentOrders.find(o => o.id === orderId) || (await json(`/api/paraclinic/orders/${encodeURIComponent(orderId)}`)).order;
            printOrderRequisition(orderData);
          } catch (err) {
            alert(err.message);
          }
          return;
        }
        const deleteButton=event.target.closest('[data-delete-order]');
        if(deleteButton){
          event.stopPropagation();
          if(!confirm('Delete this paraclinic request?')) return;
          try{ const result=await json(`/api/paraclinic/orders/${encodeURIComponent(deleteButton.dataset.deleteOrder)}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({opdInvestigationText:document.getElementById('inv_list')?.value||''})}); applyInvestigationText(result.investigationText,context); await refresh(); }
          catch(error){ alert(error.message); }
          return;
        }
        const item = event.target.closest('[data-order-id]');
        if (item) openResult(item.dataset.orderId);
      });
    }
    refresh();
    timer = setInterval(() => { if (!document.hidden) refresh(); }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }

  async function openRequestChooser(context, initialBranch = 'imaging') {
    if (!patient?.patientKey) { alert('សូមបើកអ្នកជំងឺជាមុន'); return; }
    try { await refresh(); } catch (error) { alert(error.message); return; }

    if (initialBranch === 'lab') {
      return openLabOrder(context, patient.patientKey);
    }

    let imagingList = [];
    try {
      const data = await json('/api/imaging-catalog');
      imagingList = (data.modalities || []).filter(m => m.active !== false);
    } catch {
      imagingList = [
        { code: 'ULTRASOUND', groupId: 'RADIOLOGY', nameEn: 'Ultrasound', nameKh: 'អេកូសាស្ត្រ' },
        { code: 'XRAY', groupId: 'RADIOLOGY', nameEn: 'X-Ray', nameKh: 'កាំរស្មីអ៊ិច' },
        { code: 'CT', groupId: 'RADIOLOGY', nameEn: 'CT Scan', nameKh: 'ស៊ីធីស្កេន (CT)' },
        { code: 'MRI', groupId: 'RADIOLOGY', nameEn: 'MRI', nameKh: 'អឹមអរអាយ (MRI)' },
        { code: 'ECG', groupId: 'CARDIOLOGY', nameEn: 'ECG', nameKh: 'វាស់ចង្វាក់បេះដូង (ECG)' },
        { code: 'ECHOCARDIOLOGY', groupId: 'CARDIOLOGY', nameEn: 'Echocardiology', nameKh: 'អេកូបេះដូង' },
        { code: 'EEG', groupId: 'NEUROLOGY', nameEn: 'EEG', nameKh: 'វាស់រលកខួរក្បាល (EEG)' },
        { code: 'FIBROSCOPY', groupId: 'GASTROENTEROLOGY', nameEn: 'Fibroscopy', nameKh: 'ឆ្លុះក្រពះពោះវៀន (Fibroscopy)' },
        { code: 'COLOSCOPY', groupId: 'GASTROENTEROLOGY', nameEn: 'Coloscopy', nameKh: 'ឆ្លុះពោះវៀនធំ (Coloscopy)' },
        { code: 'OTOSCOPY', groupId: 'ENT', nameEn: 'Otoscopy', nameKh: 'ឆ្លុះត្រចៀក (Otoscopy)' },
        { code: 'RHINOSCOPY', groupId: 'ENT', nameEn: 'Rhinoscopy', nameKh: 'ឆ្លុះច្រមុះ (Rhinoscopy)' },
        { code: 'LARYNGOSCOPY', groupId: 'ENT', nameEn: 'Laryngoscopy', nameKh: 'ឆ្លុះបំពង់សំឡេង (Laryngoscopy)' },
        { code: 'BRONCHOSCOPY', groupId: 'PULMONOLOGY', nameEn: 'Bronchoscopy', nameKh: 'ឆ្លុះទងសួត (Bronchoscopy)' },
      ];
    }

    // Keep the catalog's clinical groups; a single native button opens each form.
    const groupLabels = [
  {
    "id": "RADIOLOGY",
    "nameKh": "វិទ្យុសកម្មទូទៅ",
    "nameEn": "General Radiology"
  },
  {
    "id": "CARDIOLOGY",
    "nameKh": "ឯកទេសបេះដូង",
    "nameEn": "Cardiology"
  },
  {
    "id": "NEUROLOGY",
    "nameKh": "ឯកទេសប្រព័ន្ធប្រសាទ",
    "nameEn": "Neurology"
  },
  {
    "id": "GASTROENTEROLOGY",
    "nameKh": "ឯកទេសក្រពះពោះវៀន",
    "nameEn": "Gastroenterology / Endoscopy"
  },
  {
    "id": "ENT",
    "nameKh": "ឯកទេសត្រចៀក ច្រមុះ បំពង់ក",
    "nameEn": "ENT / Otorhinolaryngology"
  },
  {
    "id": "PULMONOLOGY",
    "nameKh": "ឯកទេសផ្លូវដង្ហើម",
    "nameEn": "Pulmonology"
  }
];
    const english = document.documentElement.lang === 'en';
    const grouped = new Map(groupLabels.map(group => [group.id, { ...group, items: [] }]));
    for (const item of imagingList) {
      const id = item.groupId || 'OTHER';
      if (!grouped.has(id)) grouped.set(id, { id, nameKh: id, nameEn: id, items: [] });
      grouped.get(id).items.push(item);
    }
    const label = item => english ? (item.nameEn || item.nameKh || item.code) : (item.nameKh || item.nameEn || item.code).replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, '').trim();
    const view = modal(english ? 'Imaging' : "រូបភាពវេជ្ជសាស្ត្រ", `<div class="paraclinic-choice-tabs" role="tablist">
      <button type="button" role="tab" aria-selected="false" data-branch="lab" data-order="LAB">${english ? 'Laboratory' : "មន្ទីរពិសោធន៍"}</button>
      <button type="button" role="tab" aria-selected="true" data-branch="imaging" disabled>${english ? 'Imaging' : "រូបភាពវេជ្ជសាស្ត្រ"}</button>
      </div><div class="imaging-order-groups">
      ${[...grouped.values()].filter(group => group.items.length).map(group => `
        <section class="imaging-order-group" aria-labelledby="imaging-group-${esc(group.id)}">
          <h3 id="imaging-group-${esc(group.id)}">${esc(english ? group.nameEn : group.nameKh)}</h3>
          <div class="imaging-order-tests">${group.items.map(item => `
            <button type="button" class="imaging-test-name" data-order="${esc(item.code)}">${esc(label(item))}</button>
          `).join('')}</div>
        </section>`).join('')}
      </div>`);

    view.body.querySelectorAll('[data-order]').forEach(button => button.addEventListener('click', async () => {
      const modality = button.dataset.order;
      view.close();
      try { await openOrder(modality, context); } catch (error) { alert(error.message); }
    }));
  }

  function pendingOrder(order) {
    return !order.releasedAt && !['CANCELLED','WARD_SEEN','RESULT_AVAILABLE'].includes(order.status);
  }

  function appointmentLabel(order) {
    if (order.modality === 'LAB') return '';
    const confirmed = Number(order.scheduledAt);
    if (confirmed && Number.isFinite(confirmed)) return `ម៉ោងណាត់: ${new Date(confirmed).toLocaleString('en-GB')} (Appointment)`;
    return order.request?.preferredAppointmentLocal ? `ម៉ោងស្នើសុំ: ${order.request.preferredAppointmentLocal} (not confirmed)` : '';
  }

  function pendingBanner(orders) {
    const pending = orders.filter(pendingOrder);
    return `<section class="paraclinic-pending-banner"><strong>រង់ចាំតេស្ត: ${pending.length}</strong>${pending.map(order => {
      const name = order.modality === 'LAB' ? labRequestName(order) : (order.request?.examination || order.modality);
      return `<div><span>${esc(modalityLabel(order.modality))} · ${esc(name)}</span><small>${esc(statusLabel(order.status))}${appointmentLabel(order) ? ` · ${esc(appointmentLabel(order))}` : ''}</small></div>`;
    }).join('')}${pending.length ? '' : '<small>មិនមានតេស្តកំពុងរង់ចាំ</small>'}</section>`;
  }

  function setPatient(value) {
    patient = value;
    currentOrders = [];
    if (panels.length) refresh();
  }

  function labRequestName(order) {
    const items = order.request?.items || [];
    if (!items.length) return 'Laboratory';
    const groups = groupLabItems(items);
    return [...groups].map(([category, rows]) => {
      const labels = rows.map(row => shortTestName(row.labTest) || row.code);
      return `${categoryLabel(category)}: ${labels.join(', ')}`;
    }).join(' • ');
  }

  let refreshRequest = null;
  const renderedOrderSnapshots = new WeakMap();
  async function refresh() {
    if (!patient?.patientKey || !panels.length) return;
    const requestedPatient = patient;
    const requestedKey = patient.patientKey;
    if (refreshRequest?.patient === requestedPatient) {
      refreshRequest.again = true;
      return refreshRequest.promise;
    }
    const request = { patient: requestedPatient, again: false };
    refreshRequest = request;
    request.promise = (async () => {
    try {
      const data = await json(`/api/paraclinic/orders?patientKey=${encodeURIComponent(requestedKey)}`);
      const allOrders = data.orders || [];
      if (!catalog && allOrders.some(order => order.modality === 'LAB')) await getCatalog();
      if (patient !== requestedPatient || patient?.patientKey !== requestedKey) return;
      if (isPrePaymentOpdReview()) currentOrders = allOrders.filter(order => order.status === 'PAYMENT_PENDING');
      else currentOrders = isWardNursingRole() ? allOrders.filter(order => order.modality === 'LAB') : allOrders;
      const newCount = isWardNursingRole()
        ? currentOrders.filter(order => order.releasedAt && !order.wardSeenAt).length
        : currentOrders.filter(order => order.releasedAt && !order.reviewedAt).length;
      const criticalCount = currentOrders.filter(order => order.hasCritical && !order.criticalAckAt).length;
      const rejectedCount = currentOrders.filter(order => order.modality === 'LAB' && order.status === 'REJECTED').length;
      const snapshot = JSON.stringify([requestedKey, currentOrders, user?.id, user?.activeRole, window.getBorkeoLanguage?.()]);
      for (const panel of panels) {
        if (renderedOrderSnapshots.get(panel) === snapshot) continue;
        const summary = panel.querySelector('[data-summary]');
        summary.innerHTML = `${pendingBanner(currentOrders)}${rejectedCount ? `<span class="panel-count rejected">${rejectedCount} Rejected</span>` : ''}${newCount ? `<span class="panel-count new">${newCount} New</span>` : ''}${criticalCount ? `<span class="panel-count critical">${criticalCount} Critical</span>` : ''}${!newCount && !criticalCount && !rejectedCount ? '<span class="panel-count">មិនមានការជូនដំណឹងថ្មី</span>' : ''}`;
        const box = panel.querySelector('[data-recent]');
        box.innerHTML = currentOrders.map(order => {
        const name = order.modality === 'LAB' ? labRequestName(order) : (order.request?.examination || order.request?.bodyArea || order.modality);
        const chargeBadge=order.request?.chargeMode==='FREE'
          ? '<span class="paraclinic-badge free">Free of charge</span>'
          : order.status==='PAYMENT_PENDING' ? '<span class="paraclinic-badge new">Waiting Cashier</span>'
          : order.request?.chargeMode==='PAID' ? '<span class="paraclinic-badge">Paid</span>' : '';
        return `<div class="paraclinic-order ${order.hasCritical && !order.criticalAckAt ? 'critical-order' : ''} ${order.status === 'REJECTED' ? 'rejected-order' : ''}" data-order-id="${esc(order.id)}">
          <div class="paraclinic-order-head">
            <strong>${esc(modalityLabel(order.modality))} · ${esc(name)}</strong>
            <button type="button" class="btn-print-order-inline" data-print-order="${esc(order.id)}" title="បោះពុម្ពប័ណ្ណស្នើសុំ">🖨️ បោះពុម្ព</button>
          </div>
          <small>${esc(order.accessionNumber || '')} · ${new Date(order.createdAt).toLocaleString('en-GB')}</small>
          <span class="paraclinic-badge ${order.priority === 'URGENT' ? 'urgent' : ''}">${priorityLabel(order.priority)}</span> <span class="paraclinic-badge">${esc(statusLabel(order.status))}</span> ${chargeBadge}${appointmentLabel(order) ? `<small class="paraclinic-appointment">${esc(appointmentLabel(order))}</small>` : ''}
          ${order.status === 'REJECTED' ? '<span class="paraclinic-badge rejected">Specimen Rejected</span>' : ''}
          ${order.releasedAt && !order.reviewedAt ? '<span class="paraclinic-badge new">New Result</span>' : ''}
          ${order.hasCritical && !order.criticalAckAt ? '<span class="paraclinic-badge critical">Critical</span>' : ''}
          ${['PAYMENT_PENDING','ORDERED'].includes(order.status) && (['ADMIN','VICE_DIRECTOR'].includes(user?.activeRole) || (user?.activeRole === 'DOCTOR' && order.requestedBy === user?.id)) ? `<button type="button" class="delete-paraclinic" data-delete-order="${esc(order.id)}">Delete</button>` : ''}
        </div>`;
        }).join('') || '<div class="paraclinic-order"><small>No orders yet.</small></div>';
        renderedOrderSnapshots.set(panel, snapshot);
      }
    } catch (error) { console.warn(error); }
    finally {
      if (refreshRequest === request) refreshRequest = null;
      if (request.again && patient === requestedPatient && !document.hidden) void refresh();
    }
    })();
    return request.promise;
  }

  function modal(title, body, customCardClass = '') {
    const overlay = document.createElement('div');
    overlay.className = 'paraclinic-modal';
    overlay.dataset.languageExclude = '';
    overlay.lang = 'km';
    const previousFocus = document.activeElement;
    overlay.innerHTML = `<div class="paraclinic-modal-card ${esc(customCardClass)}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><div class="paraclinic-modal-head"><h2>${esc(title)}</h2><button type="button">×</button></div><div class="paraclinic-modal-body">${body}</div></div>`;
    document.body.append(overlay);
    const close = () => { overlay.remove(); previousFocus?.focus?.(); };
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const controls = [...overlay.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    overlay.querySelector('[role="dialog"]').focus();
    overlay.querySelector('.paraclinic-modal-head button').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    return { overlay, body: overlay.querySelector('.paraclinic-modal-body'), close };
  }

  async function getCatalog() {
    if (catalog) return catalog;
    catalog = (await json('/api/lab-catalog')).tests;
    return catalog;
  }

  function yesNoUnknown(name, label) {
    return `<label>${label}<select name="${name}"><option value="Unknown">Unknown</option><option value="No">No</option><option value="Yes">Yes</option><option value="Not applicable">Not applicable</option></select></label>`;
  }

  function appendSelection(modality, request, context, orderPatientKey) {
    if (patient?.patientKey !== orderPatientKey) return;
    const field = document.getElementById(context === 'opd' ? 'inv_list' : 'ipd_investigations');
    if (!field) return;
    const chosen = modality === 'LAB'
      ? (request.items || []).map(item => {
          const test = catalog?.find(entry => entry.code === item.code);
          return test ? `${shortTestName(test)} (${item.code})` : item.code;
        }).join(', ')
      : [request.examination, modality === 'XRAY' ? request.projection : '',
          ['CT', 'MRI'].includes(modality) && request.contrast !== 'Radiology to decide' ? request.contrast : '']
          .filter(Boolean).join(' · ');
    if (!chosen) return;
    const line = `- ${modalityLabel(modality)}: ${chosen}`;
    field.value = [field.value.trimEnd(), line].filter(Boolean).join('\n');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyInvestigationText(value, context) {
    if (typeof value !== 'string' || context !== 'opd') return false;
    const field = document.getElementById('inv_list');
    if (!field) return false;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles:true }));
    field.dispatchEvent(new Event('change', { bubbles:true }));
    return true;
  }

  async function openOrder(modality, context = 'ipd') {
    if (!canOrder()) { alert('Only doctors or system administrators can create laboratory or medical imaging orders.'); return; }
    if (!patient?.patientKey) { alert('Please open a patient record first.'); return; }
    const orderPatientKey = patient.patientKey;
    if (modality === 'LAB') return openLabOrder(context, orderPatientKey);
    const lists = {
      ULTRASOUND: ['Abdomen', 'Pelvis', 'Liver and Biliary Tract', 'Kidneys and Urinary Tract', 'Obstetric', 'Gynecology', 'Thyroid', 'Breast', 'Soft Tissue', 'Vascular Doppler', 'Other'],
      XRAY: ['Chest', 'Abdomen', 'Pelvis', 'Skull', 'Spine', 'Thoracic Spine', 'Lumbar Spine', 'Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand', 'Hip', 'Femur', 'Knee', 'Lower Leg', 'Ankle', 'Foot', 'Other'],
      CT: ['CT Brain', 'CT Chest', 'CT Abdomen', 'CT Pelvis', 'CT Chest, Abdomen and Pelvis', 'CT Angiography', 'CT Kidneys, Ureters and Bladder', 'Other'],
      MRI: ['MRI Brain', 'MRI Spine', 'MRI Knee', 'MRI Shoulder', 'MRI Pelvis', 'MRI Abdomen', 'MRCP', 'Other'],
      ECG: ['Standard 12-Lead ECG', 'Rhythm Strip (Lead II)', 'Pediatric ECG', 'Emergency ECG for Chest Pain', 'Post-Cardioversion ECG', 'Other'],
      EEG: ['Routine Video EEG (20-30 min)', 'Sleep-Deprived EEG', 'Pediatric EEG', 'Emergency Bedside EEG', 'Other'],
      ECHOCARDIOLOGY: ['Transthoracic Echocardiogram (TTE)', 'Color Doppler Echocardiogram', 'Pediatric Echocardiogram', 'Focused Cardiac Ultrasound (FoCUS)', 'Other'],
      FIBROSCOPY: ['Esophagogastroduodenoscopy (EGD)', 'Diagnostic Upper GI Endoscopy', 'Emergency Endoscopy (GI Bleeding)', 'Upper GI Endoscopy with Biopsy', 'Other'],
      COLOSCOPY: ['Diagnostic Colonoscopy', 'Full Colonoscopy to Cecum', 'Sigmoidoscopy', 'Colonoscopy with Biopsy / Polypectomy', 'Other'],
      OTOSCOPY: ['Bilateral Ear Endoscopy', 'Right Ear Endoscopy', 'Left Ear Endoscopy', 'Micro-Otoscopy with Foreign Body/Debris Removal', 'Other'],
      RHINOSCOPY: ['Diagnostic Rigid Nasal Endoscopy', 'Anterior Rhinoscopy', 'Flexible Nasal Endoscopy', 'Post-Nasal Space Assessment', 'Other'],
      BRONCHOSCOPY: ['Diagnostic Fiberoptic Bronchoscopy', 'Bronchoscopy with Bronchoalveolar Lavage (BAL)', 'Bronchoscopy with Endobronchial Biopsy', 'Emergency Airway Inspection', 'Other'],
      LARYNGOSCOPY: ['Flexible Fiberoptic Laryngoscopy', 'Indirect Laryngoscopy', 'Direct Rigid Laryngoscopy', 'Vocal Cord Assessment / Stroboscopy', 'Other'],
    };
    let extra = '';
    if (modality === 'XRAY') {
      extra = `<div class="form-two"><label>Projection<select name="projection"><option>PA</option><option>AP</option><option>Lateral</option><option>AP + Lateral</option><option>Other</option></select></label>${yesNoUnknown('pregnancyPossibility', 'Pregnant or possibly pregnant')}</div>`;
    } else if (modality === 'ULTRASOUND') {
      extra = `<div class="form-two"><label>Last Menstrual Period (if applicable)<input name="lmp" type="date"></label><label>Gestational Age (if applicable)<input name="gestationalAge" placeholder="e.g. 24+3 weeks"></label></div><label>Preparation or Special Instructions<input name="preparation" placeholder="e.g. fasting or full bladder"></label>`;
    } else if (modality === 'CT') {
      extra = `<label>Contrast<select name="contrast"><option value="Radiology to decide">Radiology to decide</option><option value="Without contrast">Without contrast</option><option value="With contrast">With contrast</option></select></label>
        <div class="form-two">${yesNoUnknown('pregnancyPossibility', 'Pregnant or possibly pregnant')}${yesNoUnknown('contrastAllergy', 'Contrast allergy')}${yesNoUnknown('renalRisk', 'Renal disease or renal risk')}<label>Latest Creatinine<input name="latestCreatinine" placeholder="Enter reviewed creatinine if relevant"></label><label>Latest eGFR<input name="latestEgfr" placeholder="if available"></label></div>
        <label>Contrast or Allergy Information<textarea name="allergyDetail"></textarea></label>`;
    } else if (modality === 'MRI') {
      extra = `<label>Contrast<select name="contrast"><option value="Radiology to decide">Radiology to decide</option><option value="Without contrast">Without contrast</option><option value="With contrast">With contrast</option></select></label>
        <div class="form-two">${yesNoUnknown('pregnancyPossibility', 'Pregnant or possibly pregnant')}${yesNoUnknown('pacemaker', 'Pacemaker/ICD')}${yesNoUnknown('metalImplant', 'Metal Implant or Foreign Body')}${yesNoUnknown('claustrophobia', 'Claustrophobia')}${yesNoUnknown('sedationNeeded', 'Sedation May Be Required')}</div>
        <label>Metal Implant Details<textarea name="implantDetail"></textarea></label>`;
    } else if (modality === 'ECG') {
      extra = `<div class="form-two"><label>Position<select name="position"><option>Supine</option><option>Semi-recumbent</option><option>Sitting</option></select></label><label>Cardiac Symptoms During Exam<input name="symptoms" placeholder="e.g. Chest pain, palpitations, dyspnea"></label></div>`;
    } else if (modality === 'EEG') {
      extra = `<div class="form-two"><label>Event Type<input name="eventType" placeholder="e.g. Seizure, syncope, altered mental status"></label><label>Current Antiepileptic Drugs<input name="medications" placeholder="e.g. Levetiracetam, Valproate"></label></div>`;
    } else if (modality === 'ECHOCARDIOLOGY') {
      extra = `<div class="form-two"><label>Indication Type<select name="echoIndication"><option>Heart Failure / Reduced EF</option><option>Valvular Heart Disease</option><option>Cardiac Murmur</option><option>Hypertension / LVH</option><option>Pericardial Effusion</option><option>Other</option></select></label><label>Recent Blood Pressure<input name="recentBp" placeholder="e.g. 130/80 mmHg"></label></div>`;
    } else if (modality === 'FIBROSCOPY') {
      extra = `<div class="form-two">${yesNoUnknown('fasting6h', 'Fasted >= 6 hours')}${yesNoUnknown('anticoagulant', 'Anticoagulant / Antiplatelet use')}</div><label>Previous Gastric/Esophageal Surgery<input name="priorSurgery" placeholder="e.g. None, Billroth II, Sleeve"></label>`;
    } else if (modality === 'COLOSCOPY') {
      extra = `<div class="form-two"><label>Bowel Preparation Status<select name="bowelPrep"><option>Adequate / Clear</option><option>Fair</option><option>Poor / Inadequate</option></select></label>${yesNoUnknown('anticoagulant', 'Anticoagulant / Antiplatelet use')}</div>`;
    } else if (modality === 'OTOSCOPY') {
      extra = `<div class="form-two"><label>Side<select name="side"><option>Bilateral</option><option>Right Ear Only</option><option>Left Ear Only</option></select></label><label>Primary Ear Symptom<input name="symptoms" placeholder="e.g. Otalgia, discharge, hearing loss"></label></div>`;
    } else if (modality === 'RHINOSCOPY') {
      extra = `<div class="form-two"><label>Side<select name="side"><option>Bilateral</option><option>Right Cavity Only</option><option>Left Cavity Only</option></select></label><label>Primary Nasal Symptom<input name="symptoms" placeholder="e.g. Obstruction, epistaxis, polyps"></label></div>`;
    } else if (modality === 'BRONCHOSCOPY') {
      extra = `<div class="form-two"><label>Oxygen Saturation (SpO2)<input name="spo2" placeholder="e.g. 96% on RA"></label>${yesNoUnknown('intubated', 'Patient is Intubated')}</div>`;
    } else if (modality === 'LARYNGOSCOPY') {
      extra = `<div class="form-two"><label>Primary Voice / Throat Symptom<input name="symptoms" placeholder="e.g. Dysphonia, stridor, hoarseness"></label><label>Duration of Symptoms<input name="duration" placeholder="e.g. 2 weeks, 3 months"></label></div>`;
    }
    const view = modal(`ស្នើសុំ ${modalityLabel(modality)}`, `<form class="paraclinic-form">
      <div class="priority-row"><strong>Priority:</strong><label><input type="radio" name="priority" value="ROUTINE" checked> Routine</label><label><input type="radio" name="priority" value="URGENT"> បន្ទាន់</label></div>
      <label>Examination<select name="examination">${lists[modality].map(item => `<option>${esc(item)}</option>`).join('')}</select></label>${extra}
      <label>ម៉ោងស្នើសុំ<input type="datetime-local" name="preferredAppointmentLocal"></label><small>សេវារូបភាពកំណត់ម៉ោងណាត់ ហើយម៉ោងនឹងបង្ហាញលើទម្រង់អ្នកជំងឺ</small><label>Clinical Indication<textarea name="clinicalIndication" required></textarea></label><label>Relevant History<textarea name="history"></textarea></label><label>Specific Question for Radiology<textarea name="question"></textarea></label>${opdFeeChoice(context)}
      <div class="paraclinic-submit"><button type="button" data-cancel>បោះបង់</button>${opdSubmitActions(context)}</div></form>`);
    const form = view.body.querySelector('form');
    view.body.querySelector('[data-cancel]').addEventListener('click', view.close);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const request = {};
      for (const [key, value] of formData.entries()) if (!['priority','chargeMode','handoffMode'].includes(key)) request[key] = value;
      if (hasExistingImaging(modality, request.examination)) { alert(`This ${modalityLabel(modality)} examination is already ordered for this visit. Delete the previous request first if you want to order it again.`); return; }
      try {
        const result=await json('/api/paraclinic/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientKey: orderPatientKey, modality, priority: formData.get('priority'), chargeMode:formData.get('chargeMode')||'', handoffMode:event.submitter?.dataset.route||'DIRECT', opdInvestigationText:document.getElementById('inv_list')?.value||'', request }),
        });
        if(!applyInvestigationText(result.investigationText,context)) appendSelection(modality, request, context, orderPatientKey);
        view.close(); refresh();
        if(result.cashierPaymentRequired) alert('បានបញ្ជូនទៅបញ្ជរបង់ប្រាក់');
        else if(result.nurseHandoffRequired) alert('Order sent to the OPD nurse. The nurse will collect the sample or coordinate the Imaging visit.');
        else if(result.chargeMode==='FREE') alert('Paraclinic order marked free of charge and sent directly to the department.');
      } catch (error) { alert(error.message); }
    });
  }

  function resolvePatientDemographics(source = patient) {
    const p = source || {};
    const data = p.data || {};
    const current = !source || source === patient;
    const field = (id) => current ? String(document.getElementById(id)?.value || '').trim() : '';
    const saved = (id) => data['scope:registration:id:' + id] || data['id:' + id] || '';
    const name = p.fullName || p.name || [field('web_last_name'),field('web_first_name')].filter(Boolean).join(' ') || '—';
    const age = p.age || saved('web_age') || field('web_age') || '—';
    const dob = p.dateOfBirth || p.dob || saved('web_dob') || field('web_dob') || '—';
    const sexVal = String(p.sex || saved('web_sex') || (current ? document.querySelector('input[name="web_gender"]:checked')?.value : '') || '').toLowerCase();
    const isFemale = ['female','ស្រី','f'].includes(sexVal);
    const isMale = ['male','ប្រុស','m'].includes(sexVal);
    const village = p.village || saved('web_village') || field('web_village') || '—';
    const commune = p.commune || saved('web_commune') || field('web_commune') || '—';
    const district = p.district || saved('web_district') || field('web_district') || '—';
    const province = p.province || saved('web_province') || field('web_province') || '—';
    const diag = (current ? (p.serviceMode === 'ipd' ? document.getElementById('emr_pmrs_ipd_diagnosis')?.value : document.getElementById('emr_pmrs_opd_diagnosis')?.value) : '') || p.diagnosis || '';
    const phone = p.phone || saved('web_phone') || field('web_phone') || '';
    const pmrs = p.healthId || p.mrn || p.pmrsCode || p.caseNumber || field('web_health_id') || '';
    const ward = p.currentWardNameKh || p.departmentNameKh || p.departmentNameEn || p.currentWardCode || p.departmentCode || '';
    return { name, age, dob, isFemale, isMale, village, commune, district, province, diag, phone, pmrs, ward };
  }

  function requisitionSignatureHtml(signature, requesterName = '') {
    const name = signature?.signerName || signature?.displayName || requesterName;
    const image = signature?.signatureDataUrl || '';
    const validImage = /^data:image\/(png|jpeg|webp);base64,/.test(image);
    return `<div class="doctor-signature-stamp">${validImage ? `<img src="${esc(image)}" alt="ហត្ថលេខា" style="max-width:160px;height:54px;object-fit:contain">` : ''}<strong>${esc(name)}</strong>${signature?.signedAt ? `<small class="signed-badge">បានចុះហត្ថលេខាអេឡិចត្រូនិច / Signed: ${esc(new Date(signature.signedAt).toLocaleString('en-GB'))}</small>` : '<small>សេចក្ដីព្រាង / Draft; no saved signature snapshot</small>'}</div>`;
  }

  function printHtmlContent(htmlContent) {
    let iframe = document.getElementById('borkeo-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'borkeo-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(htmlContent);
          w.document.close();
          w.focus();
          w.print();
        }
      }
    }, 450);
  }

  function generateLabRequestPrintHtml({ order = null, checkedCodes = new Set(), clinicalDiagnosis = '', priority = 'ROUTINE', customDoctor = '', labCode = '', urgentCodes = new Set() } = {}) {
    const demo = resolvePatientDemographics(order?.request?.patientSnapshot || patient);
    if (order) {
      (order.request?.items || []).forEach(item => {
        checkedCodes.add(item.code);
        if (item.urgent) urgentCodes.add(item.code);
      });
      if (order.priority === 'URGENT') priority = 'URGENT';
      clinicalDiagnosis = clinicalDiagnosis || order.request?.clinicalInfo || '';
      customDoctor = customDoctor || order.requesterName || '';
      labCode = labCode || order.accessionNumber || '';
    }
    const doctorName = customDoctor || user?.displayName || user?.name || user?.username || 'គ្រូពេទ្យពិនិត្យ';
    const diagText = clinicalDiagnosis || demo.diag || '';
    const hasAnyUrgent = priority === 'URGENT' || urgentCodes.size > 0;

    const rawPmrs = String(demo.pmrs || '').replace(/[^0-9A-Za-z]/g, '');
    const digits = rawPmrs.padEnd(10, ' ').slice(0, 10).split('');
    const pmrsBoxesHtml = digits.map(d => `<span class="print-pmrs-box">${esc(d.trim())}</span>`).join('');

    const chk = code => checkedCodes.has(code) ? '<span class="print-chk checked"></span>' : '<span class="print-chk"></span>';
    const star = code => urgentCodes.has(code) ? '<span style="color:#dc2626;font-weight:800;font-size:11px;margin-left:4px;">★ បន្ទាន់</span>' : '';

    const standardCodes = new Set([
      'CBC','RETIC','MALARIA_SMEAR','ESR','BLOOD_FILM','BLOOD_GROUP',
      'COAG_PROFILE','PT','INR','APTT','HBSAG','HBV_RDT','HCV','HIV',
      'RPR','TPHA','ASO','CRP','H_PYLORI_RDT','DENGUE_NS1','UA','PREG_RDT',
      'STOOL_EXAM','GLU','CA','URIC','UREA','CREAT','ELECTROLYTE_PROFILE',
      'TBIL','AST','ALT','GGT','ALP','TP','ALB','CHOL','HDL','LDL','TG',
      'AMYLASE','LIPASE'
    ]);
    // ALT has no standalone checkbox on the fixed paper form.
    if (!checkedCodes.has('AST')) standardCodes.delete('ALT');
    const otherItems = [...checkedCodes].filter(c => !standardCodes.has(c));
    const otherGroups = new Map();
    for (const code of otherItems) {
      const item = catalog?.find(test => test.code === code) || order?.request?.items?.find(test => test.code === code) || { code };
      const group = item.category || 'Other / Special';
      const name = String(item.name || code).replace(/\s*\([^)]*\)/g, '').trim() || code;
      if (!otherGroups.has(group)) otherGroups.set(group, []);
      otherGroups.get(group).push({ code, name });
    }
    const now = new Date(order?.createdAt || Date.now());
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    return `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="utf-8">
  <title>Laboratory Request Form — មន្ទីរពេទ្យបង្អែក បរកែវ</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    @font-face {
      font-family: 'Moul';
      src: url('/public/fonts/Moul-Khmer.woff2') format('woff2');
      unicode-range: U+1780-17FF, U+19E0-19FF, U+200C-200D, U+25CC;
    }
    @font-face {
      font-family: 'Moul';
      src: url('/public/fonts/Moul-Latin.woff2') format('woff2');
      unicode-range: U+0000-00FF;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Khmer OS Battambang", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.32;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .print-sheet {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }
    .print-header {
      display: grid;
      grid-template-columns: 210px 1fr 220px;
      align-items: center;
      gap: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #000;
    }
    .print-logo-block {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
    }
    .print-logo {
      width: 52px;
      height: 52px;
      object-fit: contain;
      border-radius: 50%;
    }
    .print-moul {
      font-family: 'Moul', 'Khmer OS Muol Light', serif;
      font-size: 13.5px;
      color: #000;
      line-height: 1.4;
    }
    .print-title-block {
      text-align: center;
    }
    .print-title-kh {
      font-size: 16px;
      font-weight: 800;
    }
    .print-title-en {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .03em;
    }
    .print-codes-block {
      text-align: right;
      font-size: 10.5px;
    }
    .print-pmrs-boxes {
      display: inline-flex;
      gap: 2px;
      margin-top: 3px;
    }
    .print-pmrs-box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 18px;
      border: 1px solid #000;
      font-size: 10px;
      font-weight: 700;
    }
    .print-patient-box {
      border: 1.5px solid #000;
      padding: 5px 8px;
      margin: 6px 0;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .print-patient-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 10px;
    }
    .print-line-val {
      font-weight: 700;
      border-bottom: 1px dotted #333;
      padding: 0 4px;
      min-width: 50px;
    }
    .print-urgent-box {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 6px;
      font-weight: 800;
      margin-left: auto;
    }
    .print-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border: 1.5px solid #000;
      margin-bottom: 6px;
    }
    .print-col {
      padding: 4px 6px;
      font-size: 10.5px;
    }
    .print-col:not(:last-child) {
      border-right: 1.5px solid #000;
    }
    .print-col-head {
      background: #e5e7eb;
      font-weight: 800;
      text-align: center;
      padding: 2px 0;
      border: 1px solid #000;
      margin-bottom: 3px;
      font-size: 11px;
    }
    .print-col-subhead {
      background: #f3f4f6;
      font-weight: 800;
      padding: 2px 4px;
      margin: 5px 0 3px;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      font-size: 10px;
    }
    .print-specimen {
      font-size: 9.5px;
      font-weight: 800;
      margin: 2px 0;
    }
    .print-specimen.purple { color: #581c87; }
    .print-specimen.red { color: #991b1b; }
    .print-specimen.green { color: #166534; }
    .print-chk-row {
      display: flex;
      align-items: center;
      gap: 5px;
      margin: 2px 0;
      line-height: 1.25;
      white-space: nowrap;
    }
    .print-chk {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      min-width: 12px;
      border: 1px solid #000;
      font-size: 10px;
      font-weight: 900;
      line-height: 1;
      margin-top: 1px;
    }
    .print-chk.checked::after {
      content: "✓";
      color: #000;
    }
    .print-other-tests {margin:8px 0;font-size:10.5px}
    .print-other-tests h3 {margin:6px 0 3px;padding:3px 5px;background:#f3f4f6;border-bottom:1px solid #000;font-size:11px;break-after:avoid;page-break-after:avoid}
    .print-other-tests .print-chk-row {break-inside:avoid;page-break-inside:avoid;overflow-wrap:anywhere}
    .print-footer {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 1.5px solid #000;
      padding: 6px 8px;
      font-size: 10.5px;
      gap: 8px;
    }
    .print-footer-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  </style>
</head>
<body>
  <div class="print-sheet">
    <div class="print-header">
      <div class="print-logo-block">
        <img src="/public/logo-hospital.jpg" alt="Logo" class="print-logo">
        <div class="print-moul">មន្ទីរពេទ្យបង្អែក បរកែវ</div>
      </div>
      <div class="print-title-block">
        <div class="print-title-kh">ប័ណ្ណស្នើសុំវិភាគតេស្តមន្ទីរពិសោធន៍</div>
        <div class="print-title-en">Laboratory Request Form</div>
      </div>
      <div class="print-codes-block">
        <div>លេខកូដមន្ទីរពិសោធន៍: <strong>${esc(labCode || '___________')}</strong></div>
        <div>PMRS CODE</div>
        <div class="print-pmrs-boxes">${pmrsBoxesHtml}</div>
      </div>
    </div>

    <div class="print-patient-box">
      <div class="print-patient-row">
        <span>ឈ្មោះអ្នកជំងឺ:</span> <span class="print-line-val" style="min-width:140px;">${esc(demo.name)}</span>
        <span>អាយុ:</span> <span class="print-line-val">${esc(demo.age)}</span>
        <span>ថ្ងៃខែឆ្នាំកំណើត:</span> <span class="print-line-val">${esc(demo.dob)}</span>
        <span>ភេទ:</span>
        <span><span class="print-chk ${demo.isFemale ? 'checked' : ''}"></span> ស្រី</span>
        <span><span class="print-chk ${demo.isMale ? 'checked' : ''}"></span> ប្រុស</span>
      </div>
      <div class="print-patient-row">
        <span>អាសយដ្ឋានអ្នកជំងឺ ភូមិ:</span> <span class="print-line-val">${esc(demo.village)}</span>
        <span>ឃុំ:</span> <span class="print-line-val">${esc(demo.commune)}</span>
        <span>ស្រុក:</span> <span class="print-line-val">${esc(demo.district)}</span>
        <span>ខេត្ត:</span> <span class="print-line-val">${esc(demo.province)}</span>
      </div>
      <div class="print-patient-row">
        <span>ផ្នែក:</span> <span class="print-line-val">${esc(demo.ward || '—')}</span>
        <span>រោគវិនិច្ឆ័យ:</span> <span class="print-line-val" style="flex:1;">${esc(diagText)}</span>
      </div>
      <div class="print-patient-row">
        <span>កាលបរិច្ឆេទស្រង់វត្ថុវិភាគ:</span> <span class="print-line-val">${esc(dateStr)}</span>
        <span>ម៉ោង:</span> <span class="print-line-val">${esc(timeStr)}</span>
        <span>ឈ្មោះអ្នកស្រង់:</span> <span class="print-line-val">${esc(doctorName)}</span>
        <span>ទូរស័ព្ទ:</span> <span class="print-line-val">${esc(demo.phone)}</span>
        ${hasAnyUrgent ? '<div class="print-urgent-box" style="border:1.5px solid #dc2626;color:#dc2626;background:#fef2f2;">★ បន្ទាន់ (Urgent)</div>' : '<div class="print-urgent-box" style="border:1px solid #94a3b8;color:#475569;">ធម្មតា (Routine)</div>'}
      </div>
    </div>

    <div class="print-grid">
      <!-- Col 1 -->
      <div class="print-col">
        <div class="print-col-head">HEMATOLOGY</div>
        <div class="print-specimen purple">SPECIMEN: Purple/blue top tube</div>
        <div class="print-chk-row">${chk('CBC')} <strong>Complete Blood Count (CBC)</strong> ${star('CBC')}</div>

        <div class="print-col-subhead">OTHER HEMATOLOGY TESTS</div>
        <div class="print-chk-row">${chk('RETIC')} Reticulocyte ${star('RETIC')}</div>
        <div class="print-chk-row">${chk('MALARIA_SMEAR')} Malaria ( D1, D2, C1, C1 ) ${star('MALARIA_SMEAR')}</div>
        <div class="print-chk-row">${chk('ESR')} ESR/VS ${star('ESR')}</div>
        <div class="print-chk-row">${chk('BLOOD_FILM')} Blood cell morphology ${star('BLOOD_FILM')}</div>
      </div>

      <!-- Col 2 -->
      <div class="print-col">
        <div class="print-col-head">HEMATO- IMMUNOLOGY</div>
        <div class="print-specimen purple">SPECIMEN: Purple/blue top tube</div>
        <div class="print-chk-row">${chk('BLOOD_GROUP')} ABO and Rh blood group ${star('BLOOD_GROUP')}</div>

        <div class="print-col-subhead">HEMOSTASIS</div>
        <div class="print-specimen">SPECIMEN: Direct bleed lab staff</div>
        <div class="print-chk-row">${chk('COAG_PROFILE')} Bleeding Time (Ts) ${star('COAG_PROFILE')}</div>
        <div class="print-chk-row">${chk('COAG_PROFILE')} Clotting Time (Tc) ${star('COAG_PROFILE')}</div>
        <div class="print-specimen green">SPECIMEN: Green top tube</div>
        <div class="print-chk-row">${chk('PT')} PT (Prothrombin Time) ${star('PT')}</div>
        <div class="print-chk-row">${chk('INR')} INR (International Normalized Ratio) ${star('INR')}</div>
        <div class="print-chk-row">${chk('APTT')} aPTT (Activated partial thromboplastin time) ${star('APTT')}</div>

        <div class="print-col-subhead">SERO- IMMUNOLOGY</div>
        <div class="print-specimen red">SPECIMEN: Red top tube</div>
        <div class="print-chk-row">${chk('HBSAG')} HBs antigen ${star('HBSAG')}</div>
        <div class="print-chk-row">${chk('HBV_RDT')} HBs antibody ${star('HBV_RDT')}</div>
        <div class="print-chk-row">${chk('HCV')} HCV antibody ${star('HCV')}</div>
        <div class="print-chk-row">${chk('HIV')} HIV antibody (screening) ${star('HIV')}</div>
        <div class="print-chk-row">${chk('RPR')} Syphilis RPR antibody ${star('RPR')}</div>
        <div class="print-chk-row">${chk('TPHA')} Syphilis TPHA antibody ${star('TPHA')}</div>
        <div class="print-chk-row">${chk('ASO')} ASO (antistreptolysin-o) ${star('ASO')}</div>
        <div class="print-chk-row">${chk('CRP')} CRP (C-Reactive Protein) semi qt ${star('CRP')}</div>
        <div class="print-chk-row">${chk('CRP')} CRP test quantitative ${star('CRP')}</div>
        <div class="print-chk-row">${chk('H_PYLORI_RDT')} H.Pylori antibody ${star('H_PYLORI_RDT')}</div>
        <div class="print-chk-row">${chk('DENGUE_NS1')} Dengue NS1Ag/IgM/IgG ${star('DENGUE_NS1')}</div>

        <div class="print-col-subhead">URINE & STOOL ANALYSIS</div>
        <div class="print-chk-row">${chk('UA')} Chemistry (pH, Protein, Glucose) ${star('UA')}</div>
        <div class="print-chk-row">${chk('UA')} Sediment ${star('UA')}</div>
        <div class="print-chk-row">${chk('PREG_RDT')} Pregnancy test ${star('PREG_RDT')}</div>
        <div class="print-chk-row">${chk('STOOL_EXAM')} Stool Microscopy ${star('STOOL_EXAM')}</div>
      </div>

      <!-- Col 3 -->
      <div class="print-col">
        <div class="print-col-head">BIOCHEMISTRY</div>
        <div class="print-specimen red">SPECIMEN: Red top tube</div>
        <div class="print-chk-row">${chk('GLU')} Glucose (fasting/Random) ${star('GLU')}</div>
        <div class="print-chk-row">${chk('CA')} Calcium ${star('CA')}</div>
        <div class="print-chk-row">${chk('URIC')} Uric acid ${star('URIC')}</div>

        <div class="print-col-subhead">Renal Function</div>
        <div class="print-chk-row">${chk('UREA')} Urea ${star('UREA')}</div>
        <div class="print-chk-row">${chk('CREAT')} Creatinine ${star('CREAT')}</div>
        <div class="print-chk-row">${chk('ELECTROLYTE_PROFILE')} Electrolytes (Na+, K+, Cl-) ${star('ELECTROLYTE_PROFILE')}</div>

        <div class="print-col-subhead">Liver Function</div>
        <div class="print-chk-row">${chk('TBIL')} Bilirubin Direct & Total ${star('TBIL')}</div>
        <div class="print-chk-row">${chk('AST')} Transaminase (AST/GOT, ALT/GPT) ${star('AST')}</div>
        <div class="print-chk-row">${chk('GGT')} Gamma GT ${star('GGT')}</div>
        <div class="print-chk-row">${chk('ALP')} PAL (Phosphatase alkaline) ${star('ALP')}</div>
        <div class="print-chk-row">${chk('TP')} Total protein ${star('TP')}</div>
        <div class="print-chk-row">${chk('ALB')} Albumin ${star('ALB')}</div>

        <div class="print-col-subhead">Lipid Profile</div>
        <div class="print-chk-row">${chk('CHOL')} Cholesterol ${star('CHOL')}</div>
        <div class="print-chk-row">${chk('HDL')} HDL Cholesterol ${star('HDL')}</div>
        <div class="print-chk-row">${chk('LDL')} LDL Cholesterol ${star('LDL')}</div>
        <div class="print-chk-row">${chk('TG')} Triglycerides ${star('TG')}</div>

        <div class="print-col-subhead">Pancreatic enzyme</div>
        <div class="print-chk-row">${chk('AMYLASE')} Amylase ${star('AMYLASE')}</div>
        <div class="print-chk-row">${chk('LIPASE')} Lipase ${star('LIPASE')}</div>

        ${otherItems.length ? '' : '<div class="print-col-subhead">Other test</div><div class="print-chk-row"><span class="print-chk"></span> ___________________________</div>'}
      </div>
    </div>

    ${otherGroups.size ? `<section class="print-other-tests">${[...otherGroups].sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => `
      <section class="print-other-group"><h3>${esc(group)}</h3>
        ${items.sort((a, b) => a.name.localeCompare(b.name)).map(item => `<div class="print-chk-row" data-extra-print-code="${esc(item.code)}"><span class="print-chk checked"></span><span>${esc(item.name)}</span>${star(item.code)}</div>`).join('')}
      </section>`).join('')}</section>` : ''}

    <div class="print-footer">
      <div class="print-footer-cell">
        <div>លក្ខណៈវត្ថុវិភាគ ត្រឹមត្រូវ [ ] អាចទទួលយកបាន [ ] បដិសេធ [ ]</div>
        <div>កាលបរិច្ឆេទទទួលវត្ថុវិភាគ ............ ម៉ោង ............</div>
        <div>ហត្ថលេខា និង ឈ្មោះអ្នកទទួល .................................................</div>
      </div>
      <div class="print-footer-cell" style="text-align:right;">
        <div>កាលបរិច្ឆេទស្នើសុំ ថ្ងៃទី ${now.getDate()} ខែ ${now.getMonth() + 1} ឆ្នាំ ${now.getFullYear()}</div>
        <div style="margin-top:6px;">ហត្ថលេខា និង ឈ្មោះគ្រូពេទ្យ:</div>
        ${requisitionSignatureHtml(order?.request?.requesterSignature, doctorName)}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  function generateImagingRequestPrintHtml(order) {
    const demo = resolvePatientDemographics(order?.request?.patientSnapshot || patient);
    const now = new Date(order?.createdAt || Date.now());
    const dateStr = now.toLocaleDateString('en-GB');
    const doctorName = order.requesterName || user?.displayName || user?.name || user?.username || 'គ្រូពេទ្យពិនិត្យ';
    return `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="utf-8">
  <title>Medical Imaging Request — មន្ទីរពេទ្យបង្អែក បរកែវ</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    @font-face { font-family: 'Moul'; src: url('/public/fonts/Moul-Khmer.woff2') format('woff2'); }
    body { font-family: "Khmer OS Battambang", Arial, sans-serif; font-size: 12px; line-height: 1.45; color: #000; padding: 0; margin: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
    .moul-title { font-family: 'Moul', serif; font-size: 16px; margin-top: 4px; }
    .box { border: 1.5px solid #000; padding: 10px 14px; margin-bottom: 14px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 6px; }
    .val { font-weight: 700; border-bottom: 1px dotted #333; padding: 0 4px; }
    .details { border: 1.5px solid #000; padding: 12px 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src="/public/logo-hospital.jpg" style="height:55px;width:55px;border-radius:50%;object-fit:contain;">
      <div class="moul-title">មន្ទីរពេទ្យបង្អែក បរកែវ</div>
    </div>
    <div style="text-align:right;">
      <h2 style="margin:0;font-size:17px;">ប័ណ្ណស្នើសុំរូបភាពវេជ្ជសាស្ត្រ</h2>
      <div style="font-weight:700;font-size:13px;">Medical Imaging Request Form</div>
      <div style="font-size:11px;margin-top:4px;">No: ${esc(order.accessionNumber || '')} · ${esc(order.priority || 'ROUTINE')}</div>
    </div>
  </div>
  <div class="box">
    <div class="row">
      <span>ឈ្មោះអ្នកជំងឺ: <strong class="val">${esc(demo.name)}</strong></span>
      <span>អាយុ: <span class="val">${esc(demo.age)}</span></span>
      <span>ភេទ: <span class="val">${esc(demo.isFemale ? 'ស្រី' : demo.isMale ? 'ប្រុស' : '—')}</span></span>
      <span>ផ្នែក: <span class="val">${esc(demo.ward || '—')}</span></span>
    </div>
    <div class="row">
      <span>អាសយដ្ឋាន: <span class="val">${esc(`${demo.village}, ${demo.commune}, ${demo.district}, ${demo.province}`)}</span></span>
      <span>ទូរស័ព្ទ: <span class="val">${esc(demo.phone)}</span></span>
    </div>
    <div class="row">
      <span>រោគវិនិច្ឆ័យ: <span class="val" style="flex:1;">${esc(order.request?.clinicalIndication || demo.diag || '—')}</span></span>
    </div>
  </div>
  <div class="details">
    <h3 style="margin:0 0 10px;border-bottom:1px solid #ccc;padding-bottom:4px;">ព័ត៌មានសំណើ</h3>
    <div style="font-size:14px;margin-bottom:8px;"><strong>ផ្នែក:</strong> ${esc(modalityLabel(order.modality))} [${esc(order.modality)}]</div>
    <div style="font-size:14px;margin-bottom:8px;"><strong>ការពិនិត្យ:</strong> ${esc(order.request?.examination || order.request?.bodyArea || '—')}</div>
    ${order.request?.projection ? `<div><strong>Projection:</strong> ${esc(order.request.projection)}</div>` : ''}
    ${order.request?.contrast ? `<div><strong>Contrast:</strong> ${esc(order.request.contrast)}</div>` : ''}
    ${order.request?.clinicalIndication ? `<div style="margin-top:8px;"><strong>Clinical Indication:</strong> ${esc(order.request.clinicalIndication)}</div>` : ''}
    ${order.request?.history ? `<div><strong>Relevant History:</strong> ${esc(order.request.history)}</div>` : ''}
    ${order.request?.question ? `<div><strong>Question for Radiology:</strong> ${esc(order.request.question)}</div>` : ''}
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:30px;padding:0 20px;">
    <div>
      <div>កាលបរិច្ឆេទស្នើសុំ: ${esc(dateStr)}</div>
    </div>
    <div style="text-align:right;">
      <div>ហត្ថលេខា និង ឈ្មោះគ្រូពេទ្យ:</div>
      ${requisitionSignatureHtml(order.request?.requesterSignature, doctorName)}
    </div>
  </div>
</body>
</html>`;
  }

  function printOrderRequisition(order) {
    if (!order) return;
    if (order.modality === 'LAB') {
      const html = generateLabRequestPrintHtml({ order });
      printHtmlContent(html);
    } else {
      const html = generateImagingRequestPrintHtml(order);
      printHtmlContent(html);
    }
  }

  async function openLabOrder(context, orderPatientKey) {
    const rawTests = await getCatalog();
    const tests = rawTests.filter(test => test.active !== false);
    const english = document.documentElement.lang === 'en';
    const otherTestName = item => String(item.name || item.code).replace(/\s*\([^)]*\)/g, '').trim();
    const otherGroups = new Map();
    for (const item of tests) {
      const group = item.category || 'Other / Special';
      if (!otherGroups.has(group)) otherGroups.set(group, []);
      otherGroups.get(group).push(item);
    }
    const demo = resolvePatientDemographics();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const doctorName = user?.displayName || user?.name || user?.username || 'គ្រូពេទ្យពិនិត្យ';
    const wardName = context === 'opd' ? 'ផ្នែកពិគ្រោះជំងឺក្រៅ (OPD)' : (demo.ward || '—');

    const rawPmrs = String(demo.pmrs || '').replace(/[^0-9A-Za-z]/g, '');
    const digits = rawPmrs.padEnd(10, ' ').slice(0, 10).split('');
    const pmrsBoxesHtml = digits.map(d => `<span class="pmrs-box">${esc(d.trim())}</span>`).join('');

    const activeCodes = new Set(tests.map(test => test.code));
    function testRow(code, name, extraAttrs = '') {
      if (!activeCodes.has(code)) return '';
      const duplicate = hasExistingLabTest(code);
      const extra = /data-extra-test="([^"]+)"/.exec(extraAttrs)?.[1];
      if (extra && !activeCodes.has(extra)) return '';
      const disabled = duplicate ? 'disabled' : '';
      return `<div class="test-check-row">
        <label class="test-label">
          <input type="checkbox" value="${esc(code)}" data-paper-test ${extraAttrs} ${disabled}>
          <span>${esc(name)}</span>
        </label>
        <button type="button" class="test-star-urgent" data-star-code="${esc(code)}" ${disabled} title="បន្ទាន់ (Urgent)">☆</button>
      </div>`;
    }

    const formHtml = `<form class="paraclinic-form borkeo-lab-paper-form">
      <!-- Hidden compatibility anchors for existing tests -->
      <div style="display:none;" data-cat-select="__all__" data-active-category-title></div>

      <!-- Header of Paper Requisition Sheet -->
      <div class="lab-paper-header">
        <div class="lab-paper-logo-block">
          <img src="/public/logo-hospital.jpg" alt="Logo" class="lab-paper-logo">
          <div class="hospital-name-moul">មន្ទីរពេទ្យបង្អែក បរកែវ</div>
        </div>
        <div class="lab-paper-title-block">
          <div class="lab-paper-title-kh">ប័ណ្ណស្នើសុំវិភាគតេស្តមន្ទីរពិសោធន៍</div>
          <div class="lab-paper-title-en">Laboratory Request Form</div>
        </div>
        <div class="lab-paper-codes-block">
          <div class="lab-code-row">
            <span>លេខកូដមន្ទីរពិសោធន៍:</span>
            <input type="text" name="labCode" class="paper-input-box" placeholder="Lab Code">
          </div>
          <div class="pmrs-code-row">
            <span>PMRS CODE:</span>
            <div class="pmrs-boxes">${pmrsBoxesHtml}</div>
          </div>
        </div>
      </div>

      <!-- Patient Information Bar -->
      <div class="lab-paper-patient-card">
        <div class="patient-line-1">
          <span class="lbl">ឈ្មោះអ្នកជំងឺ:</span> <strong class="val name-val">${esc(demo.name)}</strong>
          <span class="lbl">អាយុ:</span> <span class="val age-val">${esc(demo.age)}</span>
          <span class="lbl">ថ្ងៃខែឆ្នាំកំណើត:</span> <span class="val dob-val">${esc(demo.dob)}</span>
          <span class="lbl">ភេទ:</span>
          <label class="check-inline"><input type="checkbox" disabled ${demo.isFemale ? 'checked' : ''}> ស្រី</label>
          <label class="check-inline"><input type="checkbox" disabled ${demo.isMale ? 'checked' : ''}> ប្រុស</label>
        </div>
        <div class="patient-line-2">
          <span class="lbl">អាសយដ្ឋានអ្នកជំងឺ:</span>
          <span>ភូមិ</span> <span class="val">${esc(demo.village)}</span>
          <span>ឃុំ</span> <span class="val">${esc(demo.commune)}</span>
          <span>ស្រុក</span> <span class="val">${esc(demo.district)}</span>
          <span>ខេត្ត</span> <span class="val">${esc(demo.province)}</span>
        </div>
        <div class="patient-line-3">
          <span class="lbl">ផ្នែក:</span> <span class="val dept-val">${esc(wardName)}</span>
          <span class="lbl">រោគវិនិច្ឆ័យ:</span> <input type="text" name="clinicalDiagnosis" class="paper-line-input diag-val" value="${esc(demo.diag)}" placeholder="បញ្ចូលរោគវិនិច្ឆ័យ">
        </div>
        <div class="patient-line-4">
          <span class="lbl">កាលបរិច្ឆេទស្រង់វត្ថុវិភាគ:</span> <span class="val">${esc(dateStr)}</span>
          <span class="lbl">ម៉ោង:</span> <span class="val">${esc(timeStr)}</span>
          <span class="lbl">ឈ្មោះអ្នកស្រង់:</span> <span class="val">${esc(doctorName)}</span>
          <span class="lbl">ទូរស័ព្ទ:</span> <span class="val">${esc(demo.phone)}</span>
        </div>
      </div>

      <!-- Authentic 3-Column Checklist Grid Matching Hospital Paper Form -->
      <div class="lab-paper-grid">
        <!-- Col 1: HEMATOLOGY -->
        <div class="lab-col col-1">
          <div class="col-head">HEMATOLOGY</div>
          <div class="specimen-tag purple">SPECIMEN: Purple/blue top tube</div>
          ${testRow('CBC', 'Complete Blood Count (CBC)')}

          <div class="col-subhead">OTHER HEMATOLOGY TESTS</div>
          ${testRow('RETIC', 'Reticulocyte')}
          ${testRow('MALARIA_SMEAR', 'Malaria ( D1, D2, C1, C1 )')}
          ${testRow('ESR', 'ESR/VS')}
          ${testRow('BLOOD_FILM', 'Blood cell morphology')}
        </div>

        <!-- Col 2: HEMATO- IMMUNOLOGY / HEMOSTASIS / SERO- IMMUNOLOGY / URINE & STOOL -->
        <div class="lab-col col-2">
          <div class="col-head">HEMATO- IMMUNOLOGY</div>
          <div class="specimen-tag purple">SPECIMEN: Purple/blue top tube</div>
          ${testRow('BLOOD_GROUP', 'ABO and Rh blood group')}

          <div class="col-subhead">HEMOSTASIS</div>
          <div class="specimen-tag text-dark">SPECIMEN: Direct bleed lab staff</div>
          ${testRow('COAG_PROFILE', 'Bleeding Time (Ts)')}
          ${testRow('COAG_PROFILE', 'Clotting Time (Tc)')}
          <div class="specimen-tag green">SPECIMEN: Green top tube</div>
          ${testRow('PT', 'PT (Prothrombin Time)')}
          ${testRow('INR', 'INR (International Normalized Ratio)')}
          ${testRow('APTT', 'aPTT (Activated partial thromboplastin time)')}

          <div class="col-subhead">SERO- IMMUNOLOGY</div>
          <div class="specimen-tag red">SPECIMEN: Red top tube</div>
          ${testRow('HBSAG', 'HBs antigen')}
          ${testRow('HBV_RDT', 'HBs antibody')}
          ${testRow('HCV', 'HCV antibody')}
          ${testRow('HIV', 'HIV antibody (screening)')}
          ${testRow('RPR', 'Syphilis RPR antibody')}
          ${testRow('TPHA', 'Syphilis TPHA antibody')}
          ${testRow('ASO', 'ASO (antistreptolysin-o)')}
          ${testRow('CRP', 'CRP (C-Reactive Protein) semi qt')}
          ${testRow('CRP', 'CRP test quantitative')}
          ${testRow('H_PYLORI_RDT', 'H.Pylori antibody')}
          ${testRow('DENGUE_NS1', 'Dengue NS1Ag/IgM/IgG')}

          <div class="col-subhead">URINE & STOOL ANALYSIS</div>
          ${testRow('UA', 'Chemistry (pH, Protein, Glucose)')}
          ${testRow('UA', 'Sediment')}
          ${testRow('PREG_RDT', 'Pregnancy test')}
          ${testRow('STOOL_EXAM', 'Stool Microscopy')}
        </div>

        <!-- Col 3: BIOCHEMISTRY -->
        <div class="lab-col col-3">
          <div class="col-head">BIOCHEMISTRY</div>
          <div class="specimen-tag red">SPECIMEN: Red top tube</div>
          ${testRow('GLU', 'Glucose (fasting/Random)')}
          ${testRow('CA', 'Calcium')}
          ${testRow('URIC', 'Uric acid')}

          <div class="col-subhead">Renal Function</div>
          ${testRow('UREA', 'Urea')}
          ${testRow('CREAT', 'Creatinine')}
          ${testRow('ELECTROLYTE_PROFILE', 'Electrolytes (Na+, K+, Cl-)')}

          <div class="col-subhead">Liver Function</div>
          ${testRow('TBIL', 'Bilirubin Direct & Total')}
          ${testRow('AST', 'Transaminase (AST/GOT, ALT/GPT)', 'data-extra-test="ALT"')}
          ${testRow('GGT', 'Gamma GT')}
          ${testRow('ALP', 'PAL (Phosphatase alkaline)')}
          ${testRow('TP', 'Total protein')}
          ${testRow('ALB', 'Albumin')}

          <div class="col-subhead">Lipid Profile</div>
          ${testRow('CHOL', 'Cholesterol')}
          ${testRow('HDL', 'HDL Cholesterol')}
          ${testRow('LDL', 'LDL Cholesterol')}
          ${testRow('TG', 'Triglycerides')}

          <div class="col-subhead">Pancreatic enzyme</div>
          ${testRow('AMYLASE', 'Amylase')}
          ${testRow('LIPASE', 'Lipase')}

        </div>
      </div>

      <section class="other-test-picker">
        <details data-other-picker>
          <summary>${english ? 'Choose additional tests' : 'ជ្រើសរើសតេស្តបន្ថែម'}</summary>
          <label class="other-test-search">${english ? 'Search tests' : 'ស្វែងរកតេស្ត'}<input type="search" data-other-search autocomplete="off"></label>
          <div class="other-test-groups">
            ${[...otherGroups].sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => `
              <fieldset class="other-test-group"><legend>${esc(group)}</legend>
                ${items.sort((a, b) => otherTestName(a).localeCompare(otherTestName(b))).map(item => `
                  <label class="other-test-option"><input type="checkbox" data-other-pick value="${esc(item.code)}" ${hasExistingLabTest(item.code) ? 'disabled' : ''}><span>${esc(otherTestName(item))}</span></label>
                `).join('')}
              </fieldset>`).join('')}
          </div>
          <div class="other-test-add"><button type="button" data-add-other>${english ? 'Add selected tests' : 'បន្ថែមតេស្តដែលបានជ្រើសរើស'}</button><output data-other-count aria-live="polite">0</output></div>
        </details>
        <div data-other-tests-container></div>
      </section>

      <!-- Footer matching paper sheet -->
      <div class="lab-paper-footer">
        <div class="footer-box">
          <div>លក្ខណៈវត្ថុវិភាគ ត្រឹមត្រូវ [ ] អាចទទួលយកបាន [ ] បដិសេធ [ ]</div>
          <div>កាលបរិច្ឆេទទទួលវត្ថុវិភាគ ............ ម៉ោង ............</div>
          <div>ហត្ថលេខា និង ឈ្មោះអ្នកទទួល .................................................</div>
        </div>
        <div class="footer-box" style="text-align:right;">
          <div>កាលបរិច្ឆេទស្នើសុំ ថ្ងៃទី ${now.getDate()} ខែ ${now.getMonth() + 1} ឆ្នាំ ${now.getFullYear()}</div>
          <div style="margin-top:6px;">ហត្ថលេខា និង ឈ្មោះគ្រូពេទ្យ:</div>
          ${requisitionSignatureHtml(null, doctorName)}
        </div>
      </div>

      ${opdFeeChoice(context)}

      <div class="lab-paper-actions-bar">
        <div class="actions-left">
          <button type="button" class="btn-paper-print" data-preview-print>🖨️ បោះពុម្ពប័ណ្ណស្នើសុំ</button>
        </div>
        <div class="actions-right">
          <button type="button" data-cancel>បោះបង់</button>
          ${opdSubmitActions(context)}
        </div>
      </div>
    </form>`;

    const view = modal('ប័ណ្ណស្នើសុំវិភាគតេស្តមន្ទីរពិសោធន៍ (Laboratory Request Form)', formHtml, 'borkeo-lab-paper-modal');
    const form = view.body.querySelector('form');
    view.body.querySelector('[data-cancel]').addEventListener('click', view.close);

    view.body.querySelectorAll('.test-star-urgent').forEach(starBtn => {
      starBtn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        const rowEl = starBtn.closest('.test-check-row');
        const chkBox = rowEl?.querySelector('[data-paper-test]');
        const isActive = starBtn.classList.toggle('active');
        starBtn.textContent = isActive ? '★' : '☆';
        if (isActive && chkBox && !chkBox.checked) {
          chkBox.checked = true;
          chkBox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    const otherContainer = view.body.querySelector('[data-other-tests-container]');
    const otherPicks = [...view.body.querySelectorAll('[data-other-pick]')];
    const updateOtherCount = () => {
      const count = otherPicks.filter(input => input.checked && !input.disabled).length;
      view.body.querySelector('[data-other-count]').value = String(count);
      view.body.querySelector('[data-add-other]').disabled = !count;
    };
    otherPicks.forEach(input => input.addEventListener('change', updateOtherCount));
    updateOtherCount();
    view.body.querySelector('[data-other-search]').addEventListener('input', event => {
      const term = event.target.value.trim().toLowerCase();
      view.body.querySelectorAll('.other-test-group').forEach(group => {
        group.querySelectorAll('.other-test-option').forEach(option => {
          const code = option.querySelector('input').value;
          option.hidden = !`${group.querySelector('legend').textContent} ${option.textContent} ${code}`.toLowerCase().includes(term);
        });
        group.hidden = ![...group.querySelectorAll('.other-test-option')].some(option => !option.hidden);
      });
    });
    const addOtherTest = code => {
      const existing = [...view.body.querySelectorAll('[data-paper-test]')].find(input => input.value === code && !input.dataset.extraTest);
      if (existing) {
        if (!existing.disabled) {
          existing.checked = true;
          existing.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      const testObj = tests.find(t => t.code === code);
      if (!testObj || hasExistingLabTest(code)) return;
      const label = otherTestName(testObj);
      const rowEl = document.createElement('div');
      rowEl.className = 'test-check-row';
      rowEl.innerHTML = `<label class="test-label"><input type="checkbox" value="${esc(code)}" data-paper-test checked><span>${esc(label)}</span></label><button type="button" class="test-star-urgent" data-star-code="${esc(code)}" title="បន្ទាន់">☆</button><button type="button" data-remove-other aria-label="${esc(english ? 'Remove' : 'ដកចេញ')} ${esc(label)}">×</button>`;
      rowEl.querySelector('[data-remove-other]').addEventListener('click', () => rowEl.remove());
      rowEl.querySelector('.test-star-urgent').addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        const btn = rowEl.querySelector('.test-star-urgent');
        const active = btn.classList.toggle('active');
        btn.textContent = active ? '★' : '☆';
      });
      otherContainer.appendChild(rowEl);
    };
    view.body.querySelector('[data-add-other]').addEventListener('click', () => {
      otherPicks.filter(input => input.checked && !input.disabled).forEach(input => {
        addOtherTest(input.value);
        input.checked = false;
      });
      updateOtherCount();
      view.body.querySelector('[data-other-picker]').open = false;
    });

    const getSelectedItems = () => {
      const checkedBoxes = [...view.body.querySelectorAll('[data-paper-test]:checked')];
      const urgentCodes = new Set(
        [...view.body.querySelectorAll('.test-star-urgent.active')].map(b => b.dataset.starCode)
      );
      const set = new Set();
      checkedBoxes.forEach(cb => {
        set.add(cb.value);
        if (cb.dataset.extraTest) set.add(cb.dataset.extraTest);
      });
      const items = [...set].map(code => ({
        code,
        urgent: urgentCodes.has(code)
      }));
      const isUrgent = items.some(i => i.urgent);
      return {
        codes: set,
        urgentCodes,
        items,
        isUrgent
      };
    };

    // Immediate Print Requisition Form Preview button
    view.body.querySelector('[data-preview-print]')?.addEventListener('click', () => {
      const { codes, urgentCodes, isUrgent } = getSelectedItems();
      const labCodeVal = form.elements.labCode?.value || '';
      const diagVal = form.elements.clinicalDiagnosis?.value || '';
      const printHtml = generateLabRequestPrintHtml({
        checkedCodes: codes,
        urgentCodes,
        clinicalDiagnosis: diagVal,
        priority: isUrgent ? 'URGENT' : 'ROUTINE',
        labCode: labCodeVal,
        customDoctor: doctorName
      });
      printHtmlContent(printHtml);
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const { items, isUrgent } = getSelectedItems();
      if (!items.length) {
        alert('សូមជ្រើសរើសតេស្តមន្ទីរពិសោធន៍យ៉ាងហោចណាស់មួយ');
        return;
      }
      const formData = new FormData(form);
      const priority = isUrgent ? 'URGENT' : (formData.get('priority') || 'ROUTINE');
      const clinicalDiagnosis = form.elements.clinicalDiagnosis?.value || '';
      const labCodeVal = form.elements.labCode?.value || '';

      try {
        const result = await json('/api/paraclinic/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientKey: orderPatientKey,
            modality: 'LAB',
            priority,
            chargeMode: formData.get('chargeMode') || '',
            handoffMode: event.submitter?.dataset.route || 'DIRECT',
            opdInvestigationText: document.getElementById('inv_list')?.value || '',
            request: {
              clinicalInfo: clinicalDiagnosis,
              diagnosis: clinicalDiagnosis,
              labCode: labCodeVal,
              items
            }
          }),
        });

        if (!applyInvestigationText(result.investigationText, context)) {
          appendSelection('LAB', { items }, context, orderPatientKey);
        }

        view.close();
        refresh();

        if (confirm('សំណើបានបញ្ជូនជោគជ័យ! តើលោកអ្នកចង់បោះពុម្ពប័ណ្ណស្នើសុំផ្លូវការឥឡូវនេះដែរឬទេ?')) {
          printOrderRequisition(result.order || {
            modality: 'LAB',
            priority,
            accessionNumber: result.accessionNumber,
            requesterName: doctorName,
            request: { clinicalInfo: clinicalDiagnosis, items }
          });
        }

        if (result.cashierPaymentRequired) alert('បានបញ្ជូនទៅបញ្ជរបង់ប្រាក់');
        else if (result.nurseHandoffRequired) alert('Order sent to the OPD nurse. The nurse will collect the sample and send it to Laboratory.');
        else if (result.chargeMode === 'FREE') alert('Paraclinic order marked free of charge and sent directly to Laboratory.');
      } catch (error) {
        alert(error.message);
      }
    });
  }

  function labWorkflowHtml(order) {
    const steps = [
      ['Doctor Ordered', order.createdAt, order.requesterName],
      ['Ward Received', order.wardReceivedAt, order.wardReceiverName],
      ['Specimen Collected', order.collectedAt, order.collectorName],
      ['Sent to Laboratory', order.sentToLabAt, order.senderName],
      ['Laboratory Received', order.receivedAt, order.receiverName],
      ['Result Released to Ward', order.releasedAt, order.validatorName],
      ['Ward Seen', order.wardSeenAt, order.wardSeenName],
    ];
    return `<div class="ward-lab-timeline">${steps.map(([name,time,by]) => `<div class="ward-lab-step ${time ? 'done' : ''}"><strong>${esc(name)}</strong><span>${time ? new Date(time).toLocaleString('en-GB') : 'Pending'}</span>${time && by ? `<small>${esc(by)}</small>` : ''}</div>`).join('')}</div>`;
  }

  function resultRows(order) {
    const groups = groupLabItems(order.result?.items || []);
    return [...groups].map(([category, rows]) => `<section class="ward-result-group"><h3>${esc(categoryLabel(category))}</h3>${rows.map(({labTest,...result}) => {
      const short = shortTestName(labTest) || result.name || result.code;
      const full = labTest?.name && short !== labTest.name ? `<small>${esc(labTest.name)}</small>` : '';
      const flag = result.flag;
      const flagText = flag === 'LOW' ? '▼ Low' : flag === 'HIGH' ? '▲ High' : flag === 'CRITICAL_LOW' ? '⚠️▼ Crit Low' : flag === 'CRITICAL_HIGH' ? '⚠️▲ Crit High' : '';
      const flagBadge = flagText ? `<span class="lab-flag-badge flag-${esc(flag.toLowerCase())}">${esc(flagText)}</span>` : '';
      return `<div class="result-item">
        <strong>${esc(short)}${full}</strong><span class="result-value ${result.flag ? 'abnormal-result' : ''}">${esc(result.value ?? '')} ${esc(result.unit || '')}</span>
        ${flagBadge}
        <span>${result.referenceLow !== null && result.referenceLow !== undefined ? `${esc(result.referenceLow)}–${esc(result.referenceHigh ?? '')}` : ''}</span>
        </div>`;
    }).join('')}</section>`).join('');
  }

  async function updateLabWardStage(order, status, extra = {}) {
    await json(`/api/paraclinic/orders/${order.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...extra }),
    });
    await refresh();
  }

  function openCollectionDialog(order, replacement = false) {
    const view = modal(replacement ? 'Recollect Specimen' : 'Collect Specimen', `<form class="paraclinic-form">
      <div class="collection-alert ${replacement ? 'danger' : ''}">${replacement ? `<strong>Previous specimen was rejected:</strong> ${esc(order.rejectionReason || '')}` : 'Select the specimen collection date and time. The current time is pre-filled.'}</div>
      <label>Specimen Collection Date and Time<input type="datetime-local" name="collectedLocal" value="${localDateTimeValue()}" required></label>
      <div class="paraclinic-submit"><button type="button" data-cancel>Cancel</button><button type="submit" class="primary">Confirm Specimen Collection</button></div>
    </form>`);
    const form = view.body.querySelector('form');
    view.body.querySelector('[data-cancel]').addEventListener('click', view.close);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const value = form.elements.collectedLocal.value;
      const collectedAt = new Date(value).getTime();
      if (!Number.isFinite(collectedAt)) { alert('Please select a valid specimen collection date and time.'); return; }
      try {
        await updateLabWardStage(order, 'COLLECTED', { collectedAt });
        view.close();
      } catch (error) { alert(error.message); }
    });
  }

  async function openResult(id) {
    try {
      const order = (await json(`/api/paraclinic/orders/${id}`)).order;
      if (order.modality === 'LAB') await getCatalog();
      let content = `<div class="result-meta"><strong>${esc(order.accessionNumber || '')}</strong><span>${esc(priorityLabel(order.priority))} · ${esc(statusLabel(order.status))}</span></div>`;
      if (order.modality === 'LAB') content += labWorkflowHtml(order);
      if (order.status === 'REJECTED') content += `<div class="result-rejected"><strong>Specimen Rejected:</strong> ${esc(order.rejectionReason || 'No reason recorded.')}<br><small>${order.rejectedAt ? new Date(order.rejectedAt).toLocaleString('en-GB') : ''} ${order.rejectorName ? `· ${esc(order.rejectorName)}` : ''}</small></div>`;
      if (order.modality === 'LAB') {
        const orderedGroups = groupLabItems(order.request?.items || []);
        content += `<section class="ward-order-groups"><h3>Ordered Tests</h3>${[...orderedGroups].map(([category, rows]) => `<div class="ward-order-group"><strong>${esc(categoryLabel(category))}</strong><div>${rows.map(row => `<span class="test-chip ${row.urgent ? 'urgent' : ''}" title="${esc(row.labTest?.name || row.code)}">${row.urgent ? '★ ' : ''}${esc(shortTestName(row.labTest) || row.code)}</span>`).join('')}</div></div>`).join('')}</section>`;
        content += `<div class="ward-result-groups">${resultRows(order) || '<p>No released results yet.</p>'}</div>`;
        if (order.hasCritical) {
          content += `<div class="result-critical"><strong>Critical Laboratory Result</strong><br>${order.criticalAckAt ? `Acknowledged by ${esc(order.criticalAckName || '')} at ${new Date(order.criticalAckAt).toLocaleString('en-GB')}${order.criticalAckNote ? ` — ${esc(order.criticalAckNote)}` : ''}` : 'Doctor acknowledgment required.'}</div>`;
        }
      } else {
        content += `<h3>Findings</h3><p>${esc(order.result?.findings || '—')}</p><h3>Conclusion</h3><p>${esc(order.result?.conclusion || '—')}</p><h3>Recommendation</h3><p>${esc(order.result?.recommendation || '—')}</p>`;
      }
      content += `<div class="paraclinic-attachments"><h3>Attachments</h3>${(order.attachments || []).map(attachment => `<a href="/api/paraclinic/attachments/${attachment.id}" target="_blank">${esc(attachment.filename)}</a>`).join('') || '<p>None.</p>'}</div>`;

      if (order.modality === 'LAB' && isWardNursingRole()) {
        if (order.status === 'ORDERED') content += '<div class="paraclinic-submit"><button class="primary" data-ward-receive>Receive Doctor Order</button></div>';
        if (order.status === 'WARD_RECEIVED') content += '<div class="paraclinic-submit"><button class="primary" data-collect>Collect Specimen</button></div>';
        if (order.status === 'COLLECTED') content += '<div class="paraclinic-submit"><button class="primary" data-send-lab>Send Specimen to Laboratory</button></div>';
        if (order.status === 'REJECTED') content += '<div class="paraclinic-submit"><button class="critical-action" data-recollect>Recollect Specimen</button></div>';
        if (order.status === 'RESULT_AVAILABLE' && !order.wardSeenAt) content += '<div class="paraclinic-submit"><button class="primary" data-ward-seen>Ward Mark as Seen</button></div>';
      }
      if (order.hasCritical && order.releasedAt && !order.criticalAckAt && (['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(user?.activeRole))) content += '<div class="paraclinic-submit"><button class="critical-action" data-critical-ack>Acknowledge Critical Result</button></div>';
      if (order.releasedAt && !order.reviewedAt && (['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(user?.activeRole))) content += '<div class="paraclinic-submit"><button class="primary" data-review>Confirm Seen</button></div>';
      content += seenNotes(order);
      if (order.wardSeenAt) content += `<p class="ward-seen-note"><strong>Ward Seen:</strong> ${new Date(order.wardSeenAt).toLocaleString('en-GB')} by ${esc(order.wardSeenName || '')}</p>`;
      content += `<div class="paraclinic-print-actions" style="margin:14px 0;padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong style="color:#0369a1;">ប័ណ្ណស្នើសុំផ្លូវការ</strong>
          <small style="display:block;color:#64748b;">អាចបោះពុម្ពប័ណ្ណស្នើសុំឡើងវិញគ្រប់ពេលវេលា ទោះបីជាសំណើត្រូវបានបិទ ឬចេញលទ្ធផលហើយក៏ដោយ</small>
        </div>
        <button type="button" class="btn-blue" data-modal-print-requisition style="font-weight:700;padding:8px 16px;">🖨️ បោះពុម្ពប័ណ្ណស្នើសុំ</button>
      </div>`;

      const view = modal(`${order.releasedAt ? 'Result' : 'Request'} ${modalityLabel(order.modality)}`, content);
      view.body.querySelector('[data-modal-print-requisition]')?.addEventListener('click', () => {
        printOrderRequisition(order);
      });
      // Opening a released report counts as seen only after the first explicit
      // acknowledgment. Worklists, background polling and printing never stamp it.
      if (order.releasedAt && order.reviewedAt && (['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(user?.activeRole))) {
        json(`/api/paraclinic/orders/${order.id}/view`, {method:'POST'}).then(result => {
          view.body.querySelector('[data-result-seen]')?.replaceWith(seenNotesElement(result.order));
        }).catch(error => {
          const note=view.body.querySelector('[data-result-seen]');
          if (note) {const warning=document.createElement('p');warning.textContent=`Unable to record this result view: ${error.message}`;note.append(warning);}
        });
      }
      view.body.querySelector('[data-ward-receive]')?.addEventListener('click', async () => {
        try { await updateLabWardStage(order, 'WARD_RECEIVED'); view.close(); } catch (error) { alert(error.message); }
      });
      view.body.querySelector('[data-collect]')?.addEventListener('click', () => { view.close(); openCollectionDialog(order, false); });
      view.body.querySelector('[data-recollect]')?.addEventListener('click', () => { view.close(); openCollectionDialog(order, true); });
      view.body.querySelector('[data-send-lab]')?.addEventListener('click', async () => {
        if (!confirm('Send this collected specimen to the laboratory now?')) return;
        try { await updateLabWardStage(order, 'SENT_TO_LAB'); view.close(); } catch (error) { alert(error.message); }
      });
      view.body.querySelectorAll('[data-ward-seen]').forEach(button => button.addEventListener('click', async () => {
        try { await updateLabWardStage(order, 'WARD_SEEN'); view.close(); } catch (error) { alert(error.message); }
      }));
      view.body.querySelector('[data-critical-ack]')?.addEventListener('click', async () => {
        const note = prompt('Critical result acknowledgment note (optional):', '') ?? '';
        await json(`/api/paraclinic/orders/${order.id}/critical-ack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
        view.close(); await refresh();
      });
      view.body.querySelector('[data-review]')?.addEventListener('click', async () => {
        const button=view.body.querySelector('[data-review]');button.disabled=true;
        try {
          const result=await json(`/api/paraclinic/orders/${order.id}/review`, { method: 'POST' });
          view.body.querySelector('[data-result-seen]')?.replaceWith(seenNotesElement(result.order));
          button.remove();await refresh();
        } catch(error) {button.disabled=false;alert(error.message);}
      });
    } catch (error) { alert(error.message); }
  }

  function seenNotes(order) {
    const views=order.seenBy?.length ? order.seenBy : order.reviewedAt
      ? [{doctorName:order.reviewerName,seenAt:order.reviewedAt}] : [];
    return `<section data-result-seen class="result-seen-history">${views.map(item =>
      `<p><strong>Seen by</strong> <span data-language-exclude>${esc(item.doctorName || '')}</span> <strong>at</strong> <time>${new Date(item.seenAt).toLocaleString('en-GB')}</time></p>`).join('')}</section>`;
  }

  function seenNotesElement(order) {
    const host=document.createElement('div');host.innerHTML=seenNotes(order);return host.firstElementChild;
  }

  function bootstrap(session) {
    user = session?.user;
    csrf = session?.csrfToken || csrf;
    if (canUse()) setup();
  }

  if (window.emrSession) bootstrap(window.emrSession);
  window.addEventListener('emr-session-ready', event => bootstrap(event.detail));
  document.addEventListener('emr:patient-loaded', event => setPatient(event.detail?.patient));
  document.addEventListener('emr:patient-saved', event => setPatient(event.detail?.patient));
  document.addEventListener('DOMContentLoaded', () => { const loaded = window.getLoadedEmrPatient?.(); if (loaded) setPatient(loaded); });
  window.addEventListener('beforeunload', () => { if (timer) clearInterval(timer); });
})();
