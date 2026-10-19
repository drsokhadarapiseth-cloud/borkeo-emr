'use strict';
(function () {
  let csrf = '';
  let orders = [];
  let feeServices = [];
  let selected = null;
  let modality = '';
  let statusFilter = '';
  let detailDirty = false;
  const DIRTY_MESSAGE = 'Automatic refresh is paused while results are being edited. Save a draft or release the report first.';
  const patientCache = new Map();
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  async function json(url, options = {}) {
    options.credentials = 'same-origin';
    options.headers = { ...(options.headers || {}), ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}) };
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The request failed');
    return data;
  }

  async function patient(key) {
    if (patientCache.has(key)) return patientCache.get(key);
    try {
      const data = await json(`/api/patient-record?patientKey=${encodeURIComponent(key)}`);
      patientCache.set(key, data.patient);
      return data.patient;
    } catch { return null; }
  }

  function examName(order) { return order.request?.examination || order.request?.bodyArea || order.request?.study || order.modality; }
  function dateText(value) { return value ? new Date(value).toLocaleString('en-GB') : '—'; }

  function setStatus(message, tone = '') {
    const node = el('imaging-status');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('info', tone === 'info');
  }

  function setDirty(flag) {
    detailDirty = Boolean(flag);
    setStatus(detailDirty ? DIRTY_MESSAGE : '', detailDirty ? 'info' : '');
  }

  function shouldPauseRefresh() {
    const active = document.activeElement;
    return detailDirty || Boolean(active?.closest?.('#imaging-detail'));
  }

  function confirmDiscard(message) {
    return !detailDirty || confirm(message || 'There are unsaved results. Discard these changes?');
  }

  function priorityLabel(priority) { return priority === 'URGENT' ? 'Urgent' : 'Routine'; }
  function statusLabel(status) {
    return ({ ORDERED:'Waiting', SCHEDULED:'Scheduled', PERFORMED:'Performed', PROCESSING:'Report in Progress', RESULT_AVAILABLE:'Result Sent', CANCELLED:'Cancelled' })[status] || status;
  }
  function modalityLabel(value) {
    return ({
      ULTRASOUND:'Ultrasound', XRAY:'X-Ray', CT:'CT Scan', MRI:'MRI',
      ECG:'ECG', EEG:'EEG', ECHOCARDIOLOGY:'Echocardiology',
      FIBROSCOPY:'Fibroscopy', COLOSCOPY:'Coloscopy',
      OTOSCOPY:'Otoscopy', RHINOSCOPY:'Rhinoscopy',
      BRONCHOSCOPY:'Bronchoscopy', LARYNGOSCOPY:'Laryngoscopy'
    })[value] || value;
  }

  const SPECIALTY_GROUPS = [
    { code: 'RADIOLOGY', name: 'Radiology', fullName: 'General Radiology', modalities: ['ULTRASOUND', 'XRAY', 'CT', 'MRI'] },
    { code: 'CARDIOLOGY', name: 'Cardiology', fullName: 'Cardiology', modalities: ['ECG', 'ECHOCARDIOLOGY'] },
    { code: 'NEUROLOGY', name: 'Neurology', fullName: 'Neurology', modalities: ['EEG'] },
    { code: 'GASTROENTEROLOGY', name: 'Endoscopy', fullName: 'Endoscopy & GI', modalities: ['FIBROSCOPY', 'COLOSCOPY'] },
    { code: 'ENT', name: 'ENT', fullName: 'ENT', modalities: ['OTOSCOPY', 'RHINOSCOPY', 'LARYNGOSCOPY'] },
    { code: 'PULMONOLOGY', name: 'Pulmonology', fullName: 'Pulmonology', modalities: ['BRONCHOSCOPY'] },
  ];

  let userSubtypes = [];
  let groupFilter = '';

  function getModalityGroup(mod) {
    const g = SPECIALTY_GROUPS.find(grp => grp.modalities.includes(mod));
    return g ? (g.fullName || g.name) : 'Imaging';
  }

  function closeAllGroupDropdowns() {
    document.querySelectorAll('.group-dropdown-menu').forEach(menu => {
      menu.hidden = true;
    });
    document.querySelectorAll('.group-dropdown-btn').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function renderGroupsBar() {
    const container = el('imaging-groups-bar');
    if (!container) return;
    const allowed = userSubtypes.length ? new Set(userSubtypes) : null;
    const availableGroups = SPECIALTY_GROUPS.map(g => ({
      ...g,
      modalities: g.modalities.filter(m => !allowed || allowed.has(m))
    })).filter(g => g.modalities.length > 0);

    const isAllActive = !groupFilter && !modality;
    let html = `<button type="button" class="group-btn-all ${isAllActive ? 'active' : ''}" data-action="all" data-language-exclude>All</button>`;

    availableGroups.forEach(g => {
      const isGroupActive = (groupFilter === g.code) || (modality && g.modalities.includes(modality));
      html += `<div class="group-dropdown" data-group-code="${esc(g.code)}" data-language-exclude>
        <button type="button" class="group-dropdown-btn ${isGroupActive ? 'active' : ''}" data-group-toggle="${esc(g.code)}" aria-haspopup="true" aria-expanded="false" data-language-exclude>
          <span data-language-exclude>${esc(g.name)}</span>
          <span class="group-dropdown-caret" data-language-exclude>▾</span>
        </button>
        <div class="group-dropdown-menu" id="menu-${esc(g.code)}" data-language-exclude hidden>
          <button type="button" class="group-menu-item group-menu-all ${groupFilter === g.code && !modality ? 'active' : ''}" data-group="${esc(g.code)}" data-modality="" data-language-exclude>
            <span data-language-exclude>All ${esc(g.fullName || g.name)}</span>
          </button>
          ${g.modalities.map(m => `
            <button type="button" class="group-menu-item ${modality === m ? 'active' : ''}" data-group="${esc(g.code)}" data-modality="${esc(m)}" data-language-exclude>
              <span data-language-exclude>${esc(modalityLabel(m))}</span>
              ${modality === m ? '<span class="check-mark" data-language-exclude>✓</span>' : ''}
            </button>
          `).join('')}
        </div>
      </div>`;
    });
    container.innerHTML = html;
  }

  function requestValueLabel(value) {
    const map = {
      Yes:'Yes', No:'No', Unknown:'Unknown', 'Not applicable':'Not applicable',
      'Radiology to decide':'Radiology to decide',
      'Without contrast':'Without contrast',
      'With contrast':'With contrast',
      PAID:'Paid at Cashier', FREE:'Free of charge'
    };
    return map[value] || value;
  }

  function safetyWarnings(order) {
    const request = order.request || {};
    const warnings = [];
    if (['XRAY', 'CT'].includes(order.modality) && request.pregnancyPossibility === 'Yes') warnings.push('Pregnant or possibly pregnant');
    if (order.modality === 'CT' && request.contrastAllergy === 'Yes') warnings.push('History of contrast allergy');
    if (order.modality === 'CT' && request.renalRisk === 'Yes') warnings.push('Renal risk; check kidney function');
    if (order.modality === 'MRI' && request.pacemaker === 'Yes') warnings.push('Pacemaker or ICD present');
    if (order.modality === 'MRI' && request.metalImplant === 'Yes') warnings.push('Metal implant or foreign body present');
    if (order.modality === 'MRI' && request.pregnancyPossibility === 'Yes') warnings.push('Pregnant or possibly pregnant');
    if (order.modality === 'MRI' && request.claustrophobia === 'Yes') warnings.push('Claustrophobia');
    return warnings;
  }

  async function load(options = {}) {
    const force = options.force === true;
    if (!force && shouldPauseRefresh()) return;
    const me = await json('/api/auth/me');
    csrf = me.csrfToken;
    userSubtypes = Array.isArray(me.user?.imagingSubtypes) ? me.user.imagingSubtypes : [];
    const manageBtn = el('imaging-catalog-manage');
    if (manageBtn) manageBtn.hidden = !['IMAGING','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(me.user?.activeRole);
    renderGroupsBar();
    if(['IMAGING','ADMIN','VICE_DIRECTOR'].includes(me.user?.activeRole)){
      try{feeServices=(await json('/api/paraclinic/fee-services?modality=IMAGING')).services||[];}catch{feeServices=[];}
    }
    const response = await json('/api/paraclinic/orders');
    const allowed = userSubtypes.length ? new Set(userSubtypes) : null;
    orders = response.orders.filter(order => order.modality !== 'LAB' && (!allowed || allowed.has(order.modality)));
    await Promise.all(orders.slice(0, 120).map(order => patient(order.patientKey)));
    renderList();
    if (!detailDirty) setStatus('');
    if (selected) {
      selected = orders.find(order => order.id === selected.id) || (await json('/api/paraclinic/orders/' + selected.id)).order;
      await patient(selected.patientKey);
      renderDetail();
    }
  }

  function renderList() {
    const query = el('imaging-search').value.trim().toLowerCase();
    const list = orders.filter(order => {
      let groupMatch = true;
      if (groupFilter) {
        const grp = SPECIALTY_GROUPS.find(g => g.code === groupFilter);
        groupMatch = grp ? grp.modalities.includes(order.modality) : true;
      }
      const modalityMatch = !modality || order.modality === modality;
      const statusMatch = !statusFilter || (statusFilter === 'URGENT' ? order.priority === 'URGENT' : order.status === statusFilter);
      const person = patientCache.get(order.patientKey) || {};
      const text = `${person.fullName || ''} ${person.caseNumber || ''} ${examName(order)} ${order.patientKey} ${order.accessionNumber || ''} ${getModalityGroup(order.modality)}`.toLowerCase();
      return groupMatch && modalityMatch && statusMatch && (!query || text.includes(query));
    });
    el('imaging-worklist').innerHTML = list.map(order => {
      const person = patientCache.get(order.patientKey) || {};
      const warnings = safetyWarnings(order);
      const groupName = getModalityGroup(order.modality);
      const feeBadge=order.request?.chargeMode==='FREE'?'<span class="badge">Free of charge</span>':order.request?.chargeMode==='PAID'?'<span class="badge">Paid at Cashier</span>':'';
      return `<article class="work-card ${order.priority === 'URGENT' ? 'urgent' : ''} ${warnings.length ? 'safety' : ''} ${selected?.id === order.id ? 'active' : ''}" data-id="${order.id}">
        <strong data-patient-value>${esc(person.fullName || person.caseNumber || order.patientKey)}</strong>
        <small class="accession">${esc(order.accessionNumber || '')}</small>
        <small><span class="badge group-badge">${esc(groupName)}</span> <strong>${esc(modalityLabel(order.modality))}</strong> · ${esc(examName(order))}</small>
        <small>${esc(person.departmentNameEn || person.departmentCode || '')} ${person.currentBedLabel ? `• Bed ${esc(person.currentBedLabel)}` : ''}</small>
        <small>${dateText(order.createdAt)} · ${esc(order.requesterName || '')}</small>
        <span class="badge ${order.priority === 'URGENT' ? 'urgent' : ''}">${priorityLabel(order.priority)}</span> <span class="badge">${esc(statusLabel(order.status))}</span>
        ${feeBadge}
        ${warnings.length ? '<span class="badge safety">Safety Review</span>' : ''}
      </article>`;
    }).join('') || '<div class="empty">No imaging orders.</div>';
  }

  function requestText(request) {
    const labels = {
      examination: 'Examination', projection: 'Projection', contrast: 'Contrast', clinicalIndication: 'Clinical Indication', history: 'Relevant History', question: 'Specific Question', chargeMode:'Charge Mode',
      pregnancyPossibility: 'Pregnancy Status', contrastAllergy: 'Allergy to contrast', allergyDetail: 'Allergy Details', renalRisk: 'Renal Risk', latestCreatinine: 'Latest Creatinine', latestEgfr: 'Latest eGFR',
      pacemaker: 'Pacemaker/ICD', metalImplant: 'Metal Implant or Foreign Body', implantDetail: 'Metal Implant Details', claustrophobia: 'Claustrophobia', sedationNeeded: 'Consider Sedation',
      lmp: 'Last Menstrual Period', gestationalAge: 'Gestational Age', preparation: 'Preparation or Special Instructions', scheduledLocal: 'Scheduled Time',
    };
    return Object.entries(request || {})
      .filter(([, value]) => value !== '' && value !== false && value !== null && value !== undefined)
      .map(([key, value]) => `${labels[key] || key}: ${Array.isArray(value) ? value.map(requestValueLabel).join(', ') : requestValueLabel(value)}`).join('\n');
  }

  function requestHtml(request) {
    const labels = {
      examination: 'Examination', projection: 'Projection', contrast: 'Contrast', clinicalIndication: 'Clinical Indication', history: 'Relevant History', question: 'Specific Question', chargeMode:'Charge Mode',
      pregnancyPossibility: 'Pregnancy Status', contrastAllergy: 'Allergy to contrast', allergyDetail: 'Allergy Details', renalRisk: 'Renal Risk', latestCreatinine: 'Latest Creatinine', latestEgfr: 'Latest eGFR',
      pacemaker: 'Pacemaker/ICD', metalImplant: 'Metal Implant or Foreign Body', implantDetail: 'Metal Implant Details', claustrophobia: 'Claustrophobia', sedationNeeded: 'Consider Sedation',
      lmp: 'Last Menstrual Period', gestationalAge: 'Gestational Age', preparation: 'Preparation or Special Instructions', scheduledLocal: 'Scheduled Time',
    };
    return Object.entries(request || {}).filter(([,value])=>value!==''&&value!==false&&value!=null).map(([key,value])=>`<div><strong>${esc(labels[key]||key)}</strong>: <span data-language-exclude>${esc(Array.isArray(value)?value.map(requestValueLabel).join(', '):requestValueLabel(value))}</span></div>`).join('');
  }

  function formatStructuredDetailsForPrint(order, result = {}) {
    const rows = [];
    if (result.rhythm) rows.push(`<b>Rhythm:</b> ${esc(result.rhythm)}`);
    if (result.heartRate) rows.push(`<b>Heart Rate:</b> ${esc(result.heartRate)} bpm`);
    if (result.prInterval) rows.push(`<b>PR Interval:</b> ${esc(result.prInterval)}`);
    if (result.qrs) rows.push(`<b>QRS Axis & Duration:</b> ${esc(result.qrs)}`);
    if (result.qtc) rows.push(`<b>QT/QTc:</b> ${esc(result.qtc)}`);
    if (result.sttChanges) rows.push(`<b>ST-T Wave:</b> ${esc(result.sttChanges)}`);
    
    if (result.background) rows.push(`<b>Background Rhythm:</b> ${esc(result.background)}`);
    if (result.symmetry) rows.push(`<b>Symmetry:</b> ${esc(result.symmetry)}`);
    if (result.reactivity) rows.push(`<b>Reactivity:</b> ${esc(result.reactivity)}`);
    if (result.epileptiform) rows.push(`<b>Paroxysmal Activity:</b> ${esc(result.epileptiform)}`);

    if (result.lvFunction) rows.push(`<b>LV Function:</b> ${esc(result.lvFunction)}`);
    if (result.chambers) rows.push(`<b>Chambers:</b> ${esc(result.chambers)}`);
    if (result.wallMotion) rows.push(`<b>Wall Motion:</b> ${esc(result.wallMotion)}`);
    if (result.valves) rows.push(`<b>Valves:</b> ${esc(result.valves)}`);
    if (result.pericardium) rows.push(`<b>Pericardium:</b> ${esc(result.pericardium)}`);

    if (result.esophagus) rows.push(`<b>Esophagus & Z-Line:</b> ${esc(result.esophagus)}`);
    if (result.stomach) rows.push(`<b>Stomach:</b> ${esc(result.stomach)}`);
    if (result.duodenum) rows.push(`<b>Duodenum:</b> ${esc(result.duodenum)}`);
    if (result.biopsy) rows.push(`<b>Biopsy:</b> ${esc(result.biopsy)}`);

    if (result.bowelPrepScore) rows.push(`<b>Bowel Prep:</b> ${esc(result.bowelPrepScore)}`);
    if (result.extent) rows.push(`<b>Extent:</b> ${esc(result.extent)}`);
    if (result.mucosa) rows.push(`<b>Mucosa:</b> ${esc(result.mucosa)}`);
    if (result.polyps) rows.push(`<b>Polyps/Lesions:</b> ${esc(result.polyps)}`);

    if (result.eac) rows.push(`<b>EAC:</b> ${esc(result.eac)}`);
    if (result.tm) rows.push(`<b>Tympanic Membrane:</b> ${esc(result.tm)}`);
    if (result.middleEar) rows.push(`<b>Middle Ear:</b> ${esc(result.middleEar)}`);

    if (result.septum) rows.push(`<b>Septum:</b> ${esc(result.septum)}`);
    if (result.turbinates) rows.push(`<b>Turbinates:</b> ${esc(result.turbinates)}`);
    if (result.meatus) rows.push(`<b>Meatus:</b> ${esc(result.meatus)}`);

    if (result.larynx) rows.push(`<b>Larynx:</b> ${esc(result.larynx)}`);
    if (result.trachea) rows.push(`<b>Trachea/Carina:</b> ${esc(result.trachea)}`);
    if (result.bronchialTree) rows.push(`<b>Bronchial Tree:</b> ${esc(result.bronchialTree)}`);
    if (result.sampling) rows.push(`<b>Sampling:</b> ${esc(result.sampling)}`);

    if (result.epiglottis) rows.push(`<b>Epiglottis:</b> ${esc(result.epiglottis)}`);
    if (result.vocalCords) rows.push(`<b>Vocal Cords:</b> ${esc(result.vocalCords)}`);
    if (result.closure) rows.push(`<b>Glottic Closure:</b> ${esc(result.closure)}`);

    if (!rows.length) return '';
    return `<section class="imaging-print-result"><h2>Diagnostic Parameters</h2><div class="print-params-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 16px;margin-top:6px;">${rows.map(r => `<div>${r}</div>`).join('')}</div></section>`;
  }

  function imagingPrintReportHtml(person, order, result=order.result||{}) {
    const patientId=person.caseNumber||person.healthId||order.patientKey;
    const department=person.currentWardNameEn||person.departmentNameEn||person.currentWardCode||person.departmentCode||'—';
    const diagnosis=person.diagnosisIcd10||person.diagnosis||'—';
    const reportSection=(title,value)=>`<section class="imaging-print-result"><h2>${title}</h2><div>${esc(value||'—')}</div></section>`;
    return `<article class="imaging-print-report">
      <header class="imaging-print-letterhead">
        <div class="imaging-print-national-text"><div>Kingdom of Cambodia</div><div>Nation Religion King</div><img src="/emr-assets/Tacteing-6.png" alt=""></div>
        <img class="imaging-print-logo" src="/api/organization/logo" alt="Borkeo Referral Hospital">
        <h1>Medical Imaging & Diagnostic Report</h1>
      </header>
      <div class="imaging-print-patient-grid">
        <div><b>Patient ID:</b> ${esc(patientId)}</div><div><b>Department:</b> ${esc(department)}</div>
        <div><b>Patient name:</b> ${esc(person.fullName||person.caseNumber||order.patientKey)}</div><div><b>Sex, age:</b> ${esc(person.sex||'—')} · ${esc(person.age||'—')}</div>
        <div class="imaging-print-diagnosis"><b>Diagnosis:</b> ${esc(diagnosis)}</div>
      </div>
      <div class="imaging-print-band"><strong>${esc(modalityLabel(order.modality))}</strong><span>${esc(examName(order))}</span><span>Accession: <b>${esc(order.accessionNumber||'—')}</b></span><span>Requesting doctor: <b>${esc(order.requesterName||'—')}</b></span><span>Ordered: ${esc(dateText(order.createdAt))}</span></div>
      <section class="imaging-print-request"><h2>Examination details</h2><div>${esc(requestText(order.request)||'—')}</div></section>
      ${formatStructuredDetailsForPrint(order, result)}
      ${reportSection('Findings',result.findings)}
      ${reportSection('Impression / Conclusion',result.conclusion)}
      ${reportSection('Recommendation',result.recommendation)}
      <footer class="imaging-print-signatures"><span>Performed by<br><b>${esc(order.performerName||'')}</b><br>${esc(dateText(order.performedAt))}</span><span>Verified by<br><b>${esc(order.validatorName||'')}</b><br>${esc(dateText(order.releasedAt))}</span></footer>
    </article>`;
  }

  function renderModalitySpecificForm(order, result = {}) {
    const mod = order.modality;
    const disabled = order.releasedAt ? 'disabled' : '';
    if (mod === 'ECG') {
      return `<div class="report-grid structured-ecg">
        <label>Rhythm<input id="img-ecg-rhythm" ${disabled} value="${esc(result.rhythm || 'Sinus Rhythm')}"></label>
        <label>Heart Rate (bpm)<input id="img-ecg-hr" type="number" ${disabled} value="${esc(result.heartRate || '')}"></label>
        <label>PR Interval (ms)<input id="img-ecg-pr" ${disabled} value="${esc(result.prInterval || '')}"></label>
        <label>QRS Axis & Duration<input id="img-ecg-qrs" ${disabled} value="${esc(result.qrs || '')}"></label>
        <label>QT / QTc (ms)<input id="img-ecg-qtc" ${disabled} value="${esc(result.qtc || '')}"></label>
        <label>ST-T Wave Changes<input id="img-ecg-stt" ${disabled} value="${esc(result.sttChanges || 'No acute ST-T changes')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    if (mod === 'EEG') {
      return `<div class="report-grid structured-eeg">
        <label>Background Rhythm<input id="img-eeg-bg" ${disabled} value="${esc(result.background || 'Posterior dominant alpha rhythm')}"></label>
        <label>Symmetry & Amplitude<input id="img-eeg-symm" ${disabled} value="${esc(result.symmetry || 'Symmetric')}"></label>
        <label>Hyperventilation / Photic Drive<input id="img-eeg-react" ${disabled} value="${esc(result.reactivity || 'Normal reactivity')}"></label>
        <label>Epileptiform / Abnormal Activity<input id="img-eeg-abnormal" ${disabled} value="${esc(result.epileptiform || 'None observed')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    if (mod === 'ECHOCARDIOLOGY') {
      return `<div class="report-grid structured-echo">
        <label>Left Ventricle (LVEDD / LVESD / EF %)<input id="img-echo-lv" ${disabled} value="${esc(result.lvFunction || '')}"></label>
        <label>Chamber Dimensions (LA / RV / RA)<input id="img-echo-chambers" ${disabled} value="${esc(result.chambers || 'Normal chamber dimensions')}"></label>
        <label>Wall Motion Abnormalities<input id="img-echo-wall" ${disabled} value="${esc(result.wallMotion || 'No regional wall motion abnormality')}"></label>
        <label>Valvular Morphology & Function<input id="img-echo-valves" ${disabled} value="${esc(result.valves || 'Normal valve leaflets and flow')}"></label>
        <label>Pericardium / Inferior Vena Cava<input id="img-echo-pericardium" ${disabled} value="${esc(result.pericardium || 'No pericardial effusion, IVC normal')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    if (mod === 'FIBROSCOPY') {
      return `<div class="report-grid structured-fibro">
        <label>Esophagus & Z-Line<input id="img-fibro-eso" ${disabled} value="${esc(result.esophagus || 'Mucosa smooth, Z-line regular')}"></label>
        <label>Stomach (Cardia / Fundus / Body / Antrum)<input id="img-fibro-stom" ${disabled} value="${esc(result.stomach || 'Mucosa pink, folds distensible, no ulcer')}"></label>
        <label>Pylorus & Duodenum (Bulb / D2)<input id="img-fibro-duo" ${disabled} value="${esc(result.duodenum || 'Pylorus patent, bulb & D2 normal')}"></label>
        <label>Biopsy / CLO Test<input id="img-fibro-biopsy" ${disabled} value="${esc(result.biopsy || 'No biopsy taken')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    if (mod === 'COLOSCOPY') {
      return `<div class="report-grid structured-colo">
        <label>Bowel Prep Quality (Boston Score)<input id="img-colo-prep" ${disabled} value="${esc(result.bowelPrepScore || 'Adequate')}"></label>
        <label>Extent of Intubation<input id="img-colo-extent" ${disabled} value="${esc(result.extent || 'Cecum reached, IC valve identified')}"></label>
        <label>Mucosa & Vascular Pattern<input id="img-colo-mucosa" ${disabled} value="${esc(result.mucosa || 'Normal colonic mucosa throughout')}"></label>
        <label>Polyps / Lesions / Intervention<input id="img-colo-polyps" ${disabled} value="${esc(result.polyps || 'No polyps or mass lesions')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    if (mod === 'OTOSCOPY') {
      return `<div class="report-grid structured-oto">
        <label>External Auditory Canal (EAC)<input id="img-oto-eac" ${disabled} value="${esc(result.eac || 'Patent, clean, no inflammation')}"></label>
        <label>Tympanic Membrane (TM)<input id="img-oto-tm" ${disabled} value="${esc(result.tm || 'Intact, translucent, normal cone of light')}"></label>
        <label>Middle Ear Status<input id="img-oto-middle" ${disabled} value="${esc(result.middleEar || 'Aerated, no effusion')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    if (mod === 'RHINOSCOPY') {
      return `<div class="report-grid structured-rhino">
        <label>Nasal Septum<input id="img-rhino-septum" ${disabled} value="${esc(result.septum || 'Straight midline, no spur')}"></label>
        <label>Turbinates & Mucosa<input id="img-rhino-turbinates" ${disabled} value="${esc(result.turbinates || 'Normal pink mucosa, no hypertrophy')}"></label>
        <label>Meatus & Post-Nasal Space<input id="img-rhino-meatus" ${disabled} value="${esc(result.meatus || 'Middle meatus clear, nasopharynx normal')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    if (mod === 'BRONCHOSCOPY') {
      return `<div class="report-grid structured-broncho">
        <label>Larynx & Vocal Cords<input id="img-broncho-larynx" ${disabled} value="${esc(result.larynx || 'Vocal cords mobile, subglottis clear')}"></label>
        <label>Trachea & Carina<input id="img-broncho-trachea" ${disabled} value="${esc(result.trachea || 'Trachea normal, carina sharp and mobile')}"></label>
        <label>Bronchial Tree (Right & Left)<input id="img-broncho-tree" ${disabled} value="${esc(result.bronchialTree || 'Lobar and segmental bronchi patent')}"></label>
        <label>Secretions & Sampling<input id="img-broncho-samples" ${disabled} value="${esc(result.sampling || 'Minimal clear secretions, no biopsy')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    if (mod === 'LARYNGOSCOPY') {
      return `<div class="report-grid structured-laryngo">
        <label>Epiglottis & Supraglottis<input id="img-laryngo-epi" ${disabled} value="${esc(result.epiglottis || 'Normal appearance, no edema')}"></label>
        <label>True & False Vocal Cords<input id="img-laryngo-cords" ${disabled} value="${esc(result.vocalCords || 'Symmetric, smooth edges, fully mobile')}"></label>
        <label>Glottic Closure & Subglottis<input id="img-laryngo-closure" ${disabled} value="${esc(result.closure || 'Complete glottic closure on phonation')}"></label>
        <label class="grid-span-all">Detailed Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label>
        <label class="grid-span-all">Impression / Conclusion<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label>
        <label class="grid-span-all">Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label>
      </div>`;
    }
    return `<div class="report-grid"><label>Findings<textarea id="img-findings" ${disabled}>${esc(result.findings || '')}</textarea></label><label>Impression<textarea id="img-conclusion" ${disabled}>${esc(result.conclusion || '')}</textarea></label><label>Recommendation<textarea id="img-recommendation" ${disabled}>${esc(result.recommendation || '')}</textarea></label></div>`;
  }

  function renderDetail() {
    if (!selected) { el('imaging-detail').innerHTML = '<div class="empty">Select an imaging order.</div>'; return; }
    const person = patientCache.get(selected.patientKey) || {};
    const result = selected.result || {};
    const warnings = safetyWarnings(selected);
    const ipdFeeEntry=String(person.serviceMode||'').toLowerCase()==='ipd'?`<section class="extra-paraclinic-fee"><h3>Add an extra Imaging fee</h3><p>This adds the selected fee to the active IPD invoice and alerts the ward nurse.</p><div><select data-extra-fee data-ui-language><option data-ui-language value="">Choose an active imaging fee…</option>${feeServices.map(item=>`<option value="${esc(item.code)}">${esc(item.nameEn||item.code)} · ${Number(item.defaultAmount).toLocaleString('en-GB')} ${item.currency}</option>`).join('')}</select><input data-extra-fee-qty type="number" min="1" step="1" value="1" aria-label="Quantity"><button type="button" data-add-extra-fee ${feeServices.length?'':'disabled'}>Add fee</button></div><small data-extra-fee-status>${feeServices.length?'':'Ask Admin to activate Imaging fee items in the service-fee catalog.'}</small></section>`:'';
    let actions = '';
    if (!selected.releasedAt && selected.status !== 'CANCELLED') {
      if (selected.status === 'ORDERED') actions += '<button data-schedule>Schedule</button>';
      if (['ORDERED', 'SCHEDULED'].includes(selected.status)) actions += '<button data-performed>Mark Performed</button>';
      actions += '<button data-save>Save Draft</button><button class="primary" data-release>Verify and Release Report</button>';
    }
    el('imaging-detail').innerHTML = `${imagingPrintReportHtml(person,selected)}
      <div class="detail-head"><div><h2 data-patient-value>${esc(person.fullName || person.caseNumber || selected.patientKey)}</h2>
        <p><strong>${esc(selected.accessionNumber || '')}</strong><br>${esc(modalityLabel(selected.modality))} · ${esc(examName(selected))}<br>${esc(person.departmentNameEn || person.departmentCode || '')} ${person.currentBedLabel ? `· Bed ${esc(person.currentBedLabel)}` : ''}<br>Ordered by ${esc(selected.requesterName || '')} · ${dateText(selected.createdAt)}</p>
      </div><div><span class="badge ${selected.priority === 'URGENT' ? 'urgent' : ''}">${priorityLabel(selected.priority)}</span> <span class="badge">${esc(statusLabel(selected.status))}</span></div></div>
      ${warnings.length ? `<div class="safety-banner"><strong>Safety Review Required:</strong><ul>${warnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
      ${selected.scheduledAt ? `<div class="schedule-banner">Scheduled: ${dateText(selected.scheduledAt)}</div>` : ''}
      ${selected.performedAt ? `<div class="performed-banner">Performed: ${dateText(selected.performedAt)}${selected.performerName ? ` by ${esc(selected.performerName)}` : ''}</div>` : ''}
      ${selected.releasedAt ? `<div class="released">Report released ${dateText(selected.releasedAt)} by ${esc(selected.validatorName || '')}</div>` : ''}
      <div class="request-box">${requestHtml(selected.request)}</div>
      ${renderModalitySpecificForm(selected, result)}
      <div class="detail-actions">${actions}<button data-print>Print</button><button data-refresh>Refresh</button></div>
      ${ipdFeeEntry}
      <section class="attachments"><h3>Images and Reports</h3><div class="attachment-list">${(selected.attachments || []).map(attachment => `<a data-language-exclude href="/api/paraclinic/attachments/${attachment.id}" target="_blank">${esc(attachment.filename)}</a>`).join('') || '<span>No attachments.</span>'}</div>${selected.releasedAt ? '' : '<input type="file" id="imaging-files" multiple accept="application/pdf,image/jpeg,image/png"><button data-upload>Attach Files</button>'}</section>`;

    el('imaging-detail').querySelectorAll('input, textarea, select').forEach(field => {
      if (field.disabled || field.closest('.extra-paraclinic-fee') || field.id === 'imaging-files') return;
      field.addEventListener('input', () => setDirty(true));
      field.addEventListener('change', () => setDirty(true));
    });

    el('imaging-detail').querySelector('[data-schedule]')?.addEventListener('click', scheduleStudy);
    el('imaging-detail').querySelector('[data-performed]')?.addEventListener('click', () => setStage('PERFORMED'));
    el('imaging-detail').querySelector('[data-save]')?.addEventListener('click', () => save(false));
    el('imaging-detail').querySelector('[data-release]')?.addEventListener('click', () => save(true));
    el('imaging-detail').querySelector('[data-refresh]')?.addEventListener('click', async () => {
      if (!confirmDiscard('Refreshing now will discard unsaved results. Continue?')) return;
      setDirty(false);
      await load({ force: true });
      renderDetail();
    });
    el('imaging-detail').querySelector('[data-print]')?.addEventListener('click', async () => {
      const printReport=el('imaging-detail').querySelector('.imaging-print-report');
      if(printReport)printReport.outerHTML=imagingPrintReportHtml(person,selected,reportResult());
      await window.printEmrReport({selectors:['.imaging-print-report'],title:'Imaging report'});
    });
    el('imaging-detail').querySelector('[data-upload]')?.addEventListener('click', upload);
    el('imaging-detail').querySelector('[data-add-extra-fee]')?.addEventListener('click', addExtraFee);
  }

  function reportResult() {
    const r = { findings: el('img-findings')?.value || '', conclusion: el('img-conclusion')?.value || '', recommendation: el('img-recommendation')?.value || '' };
    if (el('img-ecg-rhythm')) r.rhythm = el('img-ecg-rhythm').value;
    if (el('img-ecg-hr')) r.heartRate = el('img-ecg-hr').value;
    if (el('img-ecg-pr')) r.prInterval = el('img-ecg-pr').value;
    if (el('img-ecg-qrs')) r.qrs = el('img-ecg-qrs').value;
    if (el('img-ecg-qtc')) r.qtc = el('img-ecg-qtc').value;
    if (el('img-ecg-stt')) r.sttChanges = el('img-ecg-stt').value;

    if (el('img-eeg-bg')) r.background = el('img-eeg-bg').value;
    if (el('img-eeg-symm')) r.symmetry = el('img-eeg-symm').value;
    if (el('img-eeg-react')) r.reactivity = el('img-eeg-react').value;
    if (el('img-eeg-abnormal')) r.epileptiform = el('img-eeg-abnormal').value;

    if (el('img-echo-lv')) r.lvFunction = el('img-echo-lv').value;
    if (el('img-echo-chambers')) r.chambers = el('img-echo-chambers').value;
    if (el('img-echo-wall')) r.wallMotion = el('img-echo-wall').value;
    if (el('img-echo-valves')) r.valves = el('img-echo-valves').value;
    if (el('img-echo-pericardium')) r.pericardium = el('img-echo-pericardium').value;

    if (el('img-fibro-eso')) r.esophagus = el('img-fibro-eso').value;
    if (el('img-fibro-stom')) r.stomach = el('img-fibro-stom').value;
    if (el('img-fibro-duo')) r.duodenum = el('img-fibro-duo').value;
    if (el('img-fibro-biopsy')) r.biopsy = el('img-fibro-biopsy').value;

    if (el('img-colo-prep')) r.bowelPrepScore = el('img-colo-prep').value;
    if (el('img-colo-extent')) r.extent = el('img-colo-extent').value;
    if (el('img-colo-mucosa')) r.mucosa = el('img-colo-mucosa').value;
    if (el('img-colo-polyps')) r.polyps = el('img-colo-polyps').value;

    if (el('img-oto-eac')) r.eac = el('img-oto-eac').value;
    if (el('img-oto-tm')) r.tm = el('img-oto-tm').value;
    if (el('img-oto-middle')) r.middleEar = el('img-oto-middle').value;

    if (el('img-rhino-septum')) r.septum = el('img-rhino-septum').value;
    if (el('img-rhino-turbinates')) r.turbinates = el('img-rhino-turbinates').value;
    if (el('img-rhino-meatus')) r.meatus = el('img-rhino-meatus').value;

    if (el('img-broncho-larynx')) r.larynx = el('img-broncho-larynx').value;
    if (el('img-broncho-trachea')) r.trachea = el('img-broncho-trachea').value;
    if (el('img-broncho-tree')) r.bronchialTree = el('img-broncho-tree').value;
    if (el('img-broncho-samples')) r.sampling = el('img-broncho-samples').value;

    if (el('img-laryngo-epi')) r.epiglottis = el('img-laryngo-epi').value;
    if (el('img-laryngo-cords')) r.vocalCords = el('img-laryngo-cords').value;
    if (el('img-laryngo-closure')) r.closure = el('img-laryngo-closure').value;
    return r;
  }

  async function scheduleStudy() {
    if (detailDirty && !confirm('Scheduling now will discard unsaved results. Continue?')) return;
    const suggested = new Date(Date.now() + 30 * 60 * 1000);
    const pad = value => String(value).padStart(2, '0');
    const defaultLocal = `${suggested.getFullYear()}-${pad(suggested.getMonth() + 1)}-${pad(suggested.getDate())}T${pad(suggested.getHours())}:${pad(suggested.getMinutes())}`;
    const input = prompt('Scheduled Date and Time (YYYY-MM-DDTHH:MM):', selected.request?.scheduledLocal || defaultLocal);
    if (input === null) return;
    const parsed = new Date(input);
    if (!input.trim() || Number.isNaN(parsed.getTime())) { alert('Enter a valid date and time.'); return; }
    try {
      const data = await json(`/api/paraclinic/orders/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SCHEDULED', scheduledAt: parsed.getTime(), request: { scheduledLocal: input.trim() } }),
      });
      selected = data.order; setDirty(false); await load({ force: true }); renderDetail();
    } catch (error) { alert(error.message); }
  }

  async function setStage(status) {
    if (detailDirty && !confirm('Changing status will discard unsaved results. Continue?')) return;
    try {
      const data = await json(`/api/paraclinic/orders/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, performed: status === 'PERFORMED' }),
      });
      selected = data.order; setDirty(false); await load({ force: true }); renderDetail();
    } catch (error) { alert(error.message); }
  }

  async function save(release) {
    const result = reportResult();
    if (release && !String(result.conclusion || '').trim() && !confirm('The impression is blank. Release this report?')) return;
    try {
      const data = await json(`/api/paraclinic/orders/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PROCESSING', performed: true, result, release }),
      });
      selected = data.order; setDirty(false); await load({ force: true }); renderDetail();
    } catch (error) { alert(error.message); }
  }

  async function upload() {
    const files = [...el('imaging-files').files];
    const draft = reportResult();
    const hadDraft = detailDirty;
    for (const file of files) {
      const response = await fetch(`/api/paraclinic/orders/${selected.id}/attachments`, {
        method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf, 'X-File-Name': file.name, 'Content-Type': file.type }, body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { alert(data.error || 'Upload failed'); return; }
    }
    await load({ force: true });
    if (selected && !selected.releasedAt && hadDraft) {
      selected = { ...selected, result: { ...(selected.result || {}), ...draft } };
      renderDetail();
      setDirty(true);
    } else {
      renderDetail();
    }
  }

  el('imaging-worklist').addEventListener('click', event => {
    const card = event.target.closest('[data-id]'); if (!card) return;
    if (selected?.id !== card.dataset.id && !confirmDiscard('Opening another order will discard unsaved results. Continue?')) return;
    setDirty(false);
    selected = orders.find(order => order.id === card.dataset.id); renderList(); renderDetail();
  });
  const groupsBar = el('imaging-groups-bar');
  if (groupsBar) {
    groupsBar.addEventListener('click', event => {
      const allBtn = event.target.closest('[data-action="all"]');
      if (allBtn) {
        groupFilter = '';
        modality = '';
        closeAllGroupDropdowns();
        renderGroupsBar();
        renderList();
        return;
      }

      const toggleBtn = event.target.closest('[data-group-toggle]');
      if (toggleBtn) {
        const groupCode = toggleBtn.dataset.groupToggle;
        const menu = el(`menu-${groupCode}`);
        const wasHidden = menu ? menu.hidden : true;
        closeAllGroupDropdowns();
        if (menu && wasHidden) {
          menu.hidden = false;
          toggleBtn.setAttribute('aria-expanded', 'true');
        }
        return;
      }

      const menuItem = event.target.closest('.group-menu-item');
      if (menuItem) {
        const targetGroup = menuItem.dataset.group || '';
        const targetMod = menuItem.dataset.modality || '';
        if (targetMod) {
          modality = targetMod;
          groupFilter = '';
        } else if (targetGroup) {
          groupFilter = targetGroup;
          modality = '';
        } else {
          groupFilter = '';
          modality = '';
        }
        closeAllGroupDropdowns();
        renderGroupsBar();
        renderList();
        return;
      }
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('.group-dropdown')) {
        closeAllGroupDropdowns();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeAllGroupDropdowns();
      }
    });
  }

  document.querySelector('.img-status-tabs')?.addEventListener('click', event => {
    const button = event.target.closest('[data-status]'); if (!button) return;
    statusFilter = button.dataset.status || '';
    document.querySelectorAll('[data-status]').forEach(item => item.classList.toggle('active', item === button));
    renderList();
  });
  el('imaging-search')?.addEventListener('input', renderList);
  el('imaging-refresh')?.addEventListener('click', async () => {
    if (!confirmDiscard('Refreshing now will discard unsaved results. Continue?')) return;
    setDirty(false);
    await load({ force: true });
  });

  async function openImagingCatalogManager() {
    try {
      const data = await json('/api/imaging-catalog');
      const modalities = data.modalities || [];
      const overlay = document.createElement('div');
      overlay.className = 'paraclinic-modal';
      overlay.innerHTML = `<div class="paraclinic-modal-card" style="width:min(680px,96vw)">
        <div class="paraclinic-modal-head">
          <div>
            <h2 style="font-size:17px;color:#185368;margin:0;">គ្រប់គ្រងសេវារូបភាពវេជ្ជសាស្ត្រ / Manage Imaging Services</h2>
            <small style="color:#567885;">បិទ ឬបើកសេវាដែលមន្ទីរពេទ្យអាចផ្តល់ជូន។ សេវាដែលបានបិទ នឹងមិនបង្ហាញក្នុងទម្រង់ស្នើសុំឡើយ។</small>
          </div>
          <button type="button" data-close style="border:0;background:transparent;font-size:24px;cursor:pointer;">×</button>
        </div>
        <form style="margin-top:14px;">
          <div style="display:flex;flex-direction:column;gap:8px;max-height:450px;overflow-y:auto;padding:4px;">
            ${modalities.map(m => `
              <label style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border:1px solid #d4e7ef;border-radius:10px;background:${m.active ? '#fff' : '#f9fafb'};cursor:pointer;">
                <div>
                  <strong style="color:#184f63;font-size:13px;">${esc(m.nameKh)} (${esc(m.nameEn)})</strong>
                  <small style="display:block;color:#678996;font-size:11px;margin-top:2px;">Group: ${esc(m.groupId)} · Code: ${esc(m.code)}</small>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <input type="checkbox" name="active_${esc(m.code)}" value="1" ${m.active ? 'checked' : ''} style="width:18px;height:18px;accent-color:#0c7fa6;cursor:pointer;">
                  <span style="font-size:12px;font-weight:700;color:${m.active ? '#15803d' : '#991b1b'}">${m.active ? 'Active' : 'Inactive'}</span>
                </div>
              </label>
            `).join('')}
          </div>
          <div class="paraclinic-submit" style="margin-top:14px;">
            <button type="button" data-close style="border:1px solid #c5dbe4;background:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;">បោះបង់ / Cancel</button>
            <button type="submit" class="primary" style="background:#0c7fa6;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">រក្សាទុក / Save Changes</button>
          </div>
        </form>
      </div>`;
      document.body.appendChild(overlay);
      const close = () => overlay.remove();
      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
      overlay.querySelector('form').addEventListener('submit', async event => {
        event.preventDefault();
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'កំពុងរក្សាទុក...';
        try {
          for (const m of modalities) {
            const input = event.target.querySelector(`[name="active_${CSS.escape(m.code)}"]`);
            const newActive = Boolean(input && input.checked);
            if (newActive !== m.active) {
              await json(`/api/imaging-catalog/${encodeURIComponent(m.code)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: newActive })
              });
            }
          }
          close();
          alert('បានកែប្រែសេវារូបភាពដោយជោគជ័យ / Imaging services updated successfully.');
          await load({ force: true });
        } catch (err) {
          alert(err.message);
          submitBtn.disabled = false;
          submitBtn.textContent = 'រក្សាទុក / Save Changes';
        }
      });
    } catch (err) {
      alert(err.message);
    }
  }
  el('imaging-catalog-manage')?.addEventListener('click', openImagingCatalogManager);
  window.addEventListener('beforeunload', event => {
    if (!detailDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  const initialModality = new URLSearchParams(location.search).get('modality');
  if (initialModality) {
    modality = initialModality.toUpperCase();
  }

  load({ force: true }).catch(error => { setStatus(error.message); });
  setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load().catch(() => {}); });
})();
