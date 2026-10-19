'use strict';
(async function () {
  const referenceTools = await import('/public/lab-reference.mjs?v=2030');
  let csrf = '';
  let orders = [];
  let catalog = [];
  let feeServices = [];
  let selected = null;
  let historicalRelease = 0;
  let filter = new URLSearchParams(window.location.search).get('filter') || '';
  if (filter) {
    document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item.dataset.filter === filter));
  }
  let currentRole = '';
  let detailDirty = false;
  let catalogManagerOpen = false;
  const patientCache = new Map();

  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  async function json(url, options = {}) {
    options.credentials = 'same-origin';
    options.headers = {
      ...(options.headers || {}),
      ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
    };
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
    } catch {
      return null;
    }
  }

  function test(code) { return catalog.find(item => item.code === code); }

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
      ORDERED:'Ordered by doctor / OPD to Laboratory',
      WARD_RECEIVED:'Received by ward',
      COLLECTED:'Specimen collected',
      SENT_TO_LAB:'Sent to Laboratory',
      RECEIVED:'Received by Laboratory',
      PROCESSING:'Testing in progress',
      RESULT_AVAILABLE:'Results sent to ward',
      WARD_SEEN:'Viewed by ward',
      REJECTED:'Specimen rejected',
      CANCELLED:'Cancelled',
    })[status] || status;
  }


  function priorityLabel(priority) {
    return priority === 'URGENT' ? 'Urgent' : 'Routine';
  }

  function categoryLabel(category) { return category || 'Other'; }

  function flagLabel(flag) {
    return '';
  }

  function groupByCategory(rows) {
    const groups = new Map();
    for (const row of rows || []) {
      const category = (selected?.releasedAt ? resolvedTest(row.code, resultMap().get(row.code) || {}) : test(row.code))?.category || 'Other';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(row);
    }
    return groups;
  }

  function requestedGroupHtml(requested) {
    const groups = groupByCategory(requested);
    return [...groups].map(([category, rows]) => `<section class="request-group"><h4 data-language-exclude>${esc(categoryLabel(category))}</h4><div class="request-tests">${rows.map(item => {
      const catalogItem = test(item.code);
      const label = shortTestName(catalogItem) || item.code;
      const full = catalogItem?.name && catalogItem.name !== label ? ` title="${esc(catalogItem.name)}"` : '';
      return `<span data-language-exclude class="test-chip ${item.urgent ? 'urgent' : ''}"${full}>${item.urgent ? '★ ' : ''}${esc(label)}</span>`;
    }).join('')}</div></section>`).join('');
  }

  function unitOptions(item, selectedUnit) {
    const units = item?.units?.length ? item.units.map(value => value.unit) : [item?.baseUnit || ''];
    return [...new Set(units.filter(Boolean))]
      .map(unit => `<option ${unit === selectedUnit ? 'selected' : ''}>${esc(unit)}</option>`).join('');
  }

  function toBase(value, unit, item) {
    return value === '' || value == null ? null : referenceTools.convertValue(value, unit, item.baseUnit, item);
  }
  function fromBase(value, unit, item) {
    return value == null ? null : referenceTools.convertValue(value, item.baseUnit, unit, item);
  }
  function localFlag(value, unit, item) {
    return item.resultType === 'TEXT' ? '' : referenceTools.resultFlag(value, unit, item);
  }
  function resolvedTest(code, result = {}) {
    const item = test(code) || { code, name: result.name || code, category: 'Other', units: [], baseUnit: result.unit || '', resultType: result.unit ? 'NUMERIC' : 'TEXT' };
    if (selected?.releasedAt) return referenceTools.snapshotLimits(result, item);
    return referenceTools.clinicalLimits(item, patientCache.get(selected?.patientKey) || {}, selected?.collectedAt || selected?.createdAt || Date.now());
  }
  function criticalText(item, unit) {
    const low = fromBase(item.criticalLow, unit, item), high = fromBase(item.criticalHigh, unit, item);
    const inclusive = item.referenceConfig?.criticalInclusive;
    return [low == null ? '' : `${inclusive ? '≤' : '<'} ${formatNumberClean(low)}`, high == null ? '' : `${inclusive ? '≥' : '>'} ${formatNumberClean(high)}`].filter(Boolean).join(' / ') + (low != null || high != null ? ` ${unit}` : 'Not configured');
  }
  function referenceText(low, high, unit, item) {
    if (low == null && high == null) return 'Not configured';
    if (low == null && item.referenceConfig?.referenceHighExclusive) return `< ${formatNumberClean(high)} ${unit}`;
    if (high == null && item.referenceConfig?.referenceLowExclusive) return `> ${formatNumberClean(low)} ${unit}`;
    return formatRangeText(low, high, unit);
  }
  function rangeNote(item) {
    return [item.referenceContext, item.criticalContext, item.referenceNote, item.referenceConfig?.reviewed ? 'Locally reviewed' : 'Local review required'].filter(Boolean).join(' · ');
  }

  function displayDate(value) {
    return value ? new Date(value).toLocaleString('en-GB') : '—';
  }

  function setStatus(message, tone = '') {
    const node = el('lab-status');
    if (!node) return;
    node.textContent = message || '';
    node.className = tone ? tone : '';
  }

  function setDirty(flag, message = '') {
    detailDirty = Boolean(flag);
    if (detailDirty) {
      setStatus(message || 'Automatic refresh is paused while entering results. Save or refresh when finished.', 'info');
      return;
    }
    if (el('lab-status')?.textContent === 'Automatic refresh is paused while entering results. Save or refresh when finished.' ||
        el('lab-status')?.textContent === message) {
      setStatus('');
    } else if (!message) {
      setStatus('');
    }
  }

  function shouldPauseRefresh() {
    const active = document.activeElement;
    return detailDirty || catalogManagerOpen || Boolean(active?.closest?.('#lab-detail, .lab-catalog-modal'));
  }

  async function load(options = {}) {
    const force = options.force === true;
    if (!force && shouldPauseRefresh()) return;
    const me = await json('/api/auth/me');
    csrf = me.csrfToken;
    currentRole = me.user?.activeRole || '';
    if(['LAB','ADMIN','VICE_DIRECTOR'].includes(currentRole)){
      try{feeServices=(await json('/api/paraclinic/fee-services?modality=LAB')).services||[];}catch{feeServices=[];}
    }
    const manage = el('lab-catalog-manage');
    if (manage) manage.hidden = !['ADMIN','VICE_DIRECTOR','DIRECTOR','LAB'].includes(currentRole);
    const catalogResponse = await json('/api/lab-catalog');
    catalog = catalogResponse.tests;
    const orderResponse = await json('/api/paraclinic/orders?modality=LAB');
    orders = orderResponse.orders;
    await Promise.all(orders.slice(0, 120).map(order => patient(order.patientKey)));
    renderList();
    if (!detailDirty) setStatus('');
    if (selected) {
      selected = orders.find(order => order.id === selected.id) || (await json('/api/paraclinic/orders/' + selected.id)).order;
      await patient(selected.patientKey);
      renderDetail();
    }
  }

  function orderSearchText(order) {
    const person = patientCache.get(order.patientKey) || {};
    const names = (order.request?.items || []).map(item => test(item.code)?.name || item.code).join(' ');
    return `${person.fullName || ''} ${person.caseNumber || ''} ${person.healthId || ''} ${order.patientKey} ${order.accessionNumber || ''} ${names}`.toLowerCase();
  }

  function renderList() {
    const query = el('lab-search').value.trim().toLowerCase();
    const list = orders.filter(order => {
      const statusMatch = !filter || (filter === 'URGENT' ? order.priority === 'URGENT' : (filter === 'RESULT_AVAILABLE' ? ['RESULT_AVAILABLE','WARD_SEEN'].includes(order.status) : order.status === filter));
      return statusMatch && (!query || orderSearchText(order).includes(query));
    });
    el('lab-worklist').innerHTML = list.map(order => {
      const person = patientCache.get(order.patientKey) || {};
      const feeBadge=order.request?.chargeMode==='FREE'?'<span class="badge">Free of charge</span>':order.request?.chargeMode==='PAID'?'<span class="badge">Paid at Cashier</span>':'';
      return `<article class="work-card ${order.priority === 'URGENT' ? 'urgent' : ''} ${order.hasCritical ? 'critical' : ''} ${selected?.id === order.id ? 'active' : ''}" data-id="${esc(order.id)}">
        <strong data-patient-value>${esc(person.fullName || person.caseNumber || order.patientKey)}</strong>
        <small class="accession">${esc(order.accessionNumber || '')}</small>
        <small>${esc(person.departmentNameEn || person.departmentCode || '')} ${person.currentBedLabel ? `• Bed ${esc(person.currentBedLabel)}` : ''}</small>
        <small>${new Date(order.createdAt).toLocaleString('en-GB')} · ${esc(order.requesterName || '')}</small>
        <span class="badge ${order.priority === 'URGENT' ? 'urgent' : ''}">${priorityLabel(order.priority)}</span>
        <span class="badge">${esc(statusLabel(order.status))}</span>
        ${feeBadge}
        ${order.hasCritical ? '<span class="badge critical">Critical Result</span>' : ''}
      </article>`;
    }).join('') || '<div class="empty-state">No laboratory orders.</div>';
  }

  function resultMap() {
    const archived = selected?.reportVersions?.find(v => v.releasedAt === historicalRelease);
    return new Map(((archived?.result || selected?.result)?.items || []).map(item => [item.code, item]));
  }

  function expandedRequested(items) {
    const rows = [];
    const byCode = new Map();
    for (const item of items || []) {
      const parent = test(item.code);
      const codes = parent?.resultType === 'PANEL' && Array.isArray(parent.components) && parent.components.length
        ? parent.components : [item.code];
      for (const code of codes) {
        const existing = byCode.get(code);
        if (existing) {
          existing.urgent = existing.urgent || item.urgent;
          continue;
        }
        const row = { code, urgent: item.urgent === true, panel: codes.length > 1 ? (parent?.name || item.code) : '' };
        byCode.set(code, row);
        rows.push(row);
      }
    }
    return rows;
  }

  function workflowTimeline(order) {
    const person = patientCache.get(order.patientKey) || {};
    const isOpd = String(person.serviceMode || '').toLowerCase() === 'opd';
    const entries = isOpd ? [
      ['1. Requesting doctor', order.createdAt, order.requesterName],
      ['2. Laboratory receives patient', order.receivedAt, order.receiverName],
      ['3. Laboratory collects specimen', order.collectedAt, order.collectorName],
      ['4. Testing in progress', order.performedAt, order.performerName],
      ['5. Results sent to doctor OPD', order.releasedAt, order.validatorName],
    ] : [
      ['1. Requesting doctor', order.createdAt, order.requesterName],
      ['2. Received by ward', order.wardReceivedAt, order.wardReceiverName],
      ['3. Specimen collected', order.collectedAt, order.collectorName],
      ['4. Sent to Laboratory', order.sentToLabAt, order.senderName],
      ['5. Received by Laboratory', order.receivedAt, order.receiverName],
      ['6. Results sent to ward', order.releasedAt, order.validatorName],
      ['7. Viewed by ward', order.wardSeenAt, order.wardSeenName],
    ];
    return `<div class="workflow-timeline">${entries.map(([label, time, by]) => `<div class="timeline-step ${time ? 'done' : ''}"><strong>${label}</strong><span>${time ? esc(displayDate(time)) : 'Waiting'}</span>${time && by ? `<small>${esc(by)}</small>` : ''}</div>`).join('')}</div>`;
  }

  function renderDetail() {
    if (!selected) {
      el('lab-detail').innerHTML = '<div class="empty-state">Select a laboratory order.</div>';
      return;
    }
    const person = patientCache.get(selected.patientKey) || {};
    const map = resultMap();
    const requested = selected.request?.items || [];
    const requestedRows = expandedRequested(requested);
    const expanded = selected.releasedAt ? [...map.values()].map(result => ({ ...requestedRows.find(row => row.code === result.code), code: result.code })) : requestedRows;
    const rejected = selected.status === 'REJECTED';
    const released = Boolean(selected.releasedAt);
    const ipdFeeEntry=String(person.serviceMode||'').toLowerCase()==='ipd'?`<section class="extra-paraclinic-fee"><h3>Add an extra Laboratory fee</h3><p>This adds the selected fee to the active IPD invoice and alerts the ward nurse.</p><div><select data-extra-fee data-ui-language><option data-ui-language value="">Choose an active lab fee…</option>${feeServices.map(item=>`<option value="${esc(item.code)}">${esc(item.nameEn||item.code)} · ${Number(item.defaultAmount).toLocaleString('en-GB')} ${item.currency}</option>`).join('')}</select><input data-extra-fee-qty type="number" min="1" step="1" value="1" aria-label="Quantity"><button type="button" data-add-extra-fee ${feeServices.length?'':'disabled'}>Add fee</button></div><small data-extra-fee-status>${feeServices.length?'':'Ask Admin to activate Laboratory fee items in the service-fee catalog.'}</small></section>`:'';

    function rowHtml(item) {
      const result = map.get(item.code) || {};
      const catalogItem = resolvedTest(item.code, result);
      const isText = catalogItem.resultType === 'TEXT';
      const unit = isText ? '' : (result.unit || catalogItem.baseUnit || catalogItem.units?.[0]?.unit || '');
      const low = isText ? null : fromBase(catalogItem.referenceLow, unit, catalogItem);
      const high = isText ? null : fromBase(catalogItem.referenceHigh, unit, catalogItem);
      const flag = isText ? '' : (released ? result.flag || '' : localFlag(result.value, unit, catalogItem));
      const label = shortTestName(catalogItem);
      const longName = label !== catalogItem.name ? `<div data-language-exclude class="reference">${esc(catalogItem.name)}</div>` : '';
      const resultInput = isText
        ? `<input data-value type="text" list="lab-qualitative-values" value="${esc(result.value ?? '')}" ${released || rejected ? 'disabled' : ''}>`
        : `<input data-value type="number" step="any" value="${esc(result.value ?? '')}" ${released || rejected ? 'disabled' : ''}>`;
      const unitCell = isText
        ? '<span class="reference">—</span>'
        : `<select data-unit ${released || rejected ? 'disabled' : ''}>${unitOptions(catalogItem, unit)}</select>`;
      const reference = isText ? 'Qualitative result' : referenceText(low, high, unit, catalogItem);
      return `<tr data-code="${esc(item.code)}" data-result-type="${esc(catalogItem.resultType || '')}">
        <td><strong data-language-exclude>${item.urgent ? '★ ' : ''}${esc(label)}</strong>${longName}${item.panel ? `<div data-language-exclude class="reference">Panel: ${esc(item.panel)}</div>` : ''}<div data-language-exclude class="reference">${catalogItem.loincCode ? `LOINC ${esc(catalogItem.loincCode)} · ` : ''}${esc(catalogItem.specimen || '')}</div></td>
        <td>${resultInput}</td><td>${unitCell}</td><td class="reference"><span data-reference>${esc(reference)}</span>${isText ? '' : `<small data-critical>Critical: ${esc(criticalText(catalogItem, unit))}</small><small>${esc(rangeNote(catalogItem))}</small>`}</td>
        <td class="flag ${esc(flag)}" data-flag>${esc(flagLabel(flag))}</td>
        <td><input data-comment value="${esc(result.comment || '')}" ${released || rejected ? 'disabled' : ''}></td>
      </tr>`;
    }

    const groupedRows = groupByCategory(expanded);
    const resultGroupsHtml = [...groupedRows].map(([category, rows]) => `<section class="lab-result-group">
      <header><h3 data-language-exclude>${esc(categoryLabel(category))}</h3><span>${rows.length} Test</span></header>
      <div class="result-table-wrap"><table class="result-table"><thead><tr><th>Test</th><th>Result</th><th>Unit</th><th>Reference Interval</th><th>Flag</th><th>Note</th></tr></thead><tbody>${rows.map(rowHtml).join('')}</tbody></table></div>
    </section>`).join('');

    const diffCodes = new Set(['NEUT','LYMPH','MONO','EOS','BASO']);
    const cbcOrder = ['WBC','RBC','HGB','HCT','MCV','MCH','MCHC','PLT','RDW','NEUT','LYMPH','MONO','EOS','BASO','MPV'];
    function printableRows(category, sourceRows) {
      const panelRows = sourceRows.some(row => row.panel);
      const rows = [...sourceRows];
      if (category === 'Hematology' && panelRows) {
        rows.sort((a,b) => (cbcOrder.indexOf(a.code)<0?999:cbcOrder.indexOf(a.code)) - (cbcOrder.indexOf(b.code)<0?999:cbcOrder.indexOf(b.code)));
      }
      let diffHeadingAdded = false;
      const output = [];
      if (panelRows && category === 'Hematology') output.push('<tr class="lab-print-subheading"><th colspan="5">COMPLETE BLOOD COUNT</th></tr>');
      for (const row of rows) {
        if (panelRows && category === 'Hematology' && diffCodes.has(row.code) && !diffHeadingAdded) {
          output.push('<tr class="lab-print-subheading"><th colspan="5">Differential White Cell Count</th></tr>');
          diffHeadingAdded = true;
        }
        const result = map.get(row.code) || {};
        const item = resolvedTest(row.code, result);
        const unit = item.resultType === 'TEXT' ? '' : (result.unit || item.baseUnit || item.units?.[0]?.unit || '');
        const low = item.resultType === 'TEXT' ? null : fromBase(item.referenceLow,unit,item);
        const high = item.resultType === 'TEXT' ? null : fromBase(item.referenceHigh,unit,item);
        const flag = released ? result.flag || '' : localFlag(result.value,unit,item);
        const flagText = '';
        const reference = item.resultType === 'TEXT' ? 'Qualitative result' : referenceText(low, high, unit, item);
        output.push(`<tr data-print-code="${esc(row.code)}"><td><span class="lab-print-test-name">${esc(item.name || row.code)}</span><small>${esc(row.code)}</small></td><td class="lab-print-result ${flag ? 'abnormal-result' : ''}">${esc(result.value ?? '')}</td><td class="lab-print-flag ${esc(flag)}">${flagText}</td><td>${esc(unit)}</td><td>${esc(reference)}${item.resultType === 'TEXT' ? '' : `<small>Critical: ${esc(criticalText(item, unit))}</small>`}</td></tr>`);
      }
      return output.join('');
    }
    const labPrintGroups = [...groupedRows].map(([category, rows]) => {
      const firstTest = resolvedTest(rows[0]?.code, map.get(rows[0]?.code) || {});
      const specimen = /EDTA whole blood/i.test(firstTest.specimen || '') ? 'Blood-EDTA' : (firstTest.specimen || '—');
      return `<section class="lab-print-group" data-lab-category="${esc(category)}">
        <div class="lab-print-specimen"><strong>${esc(category.toUpperCase())}</strong><span>${esc(specimen)}</span><span>Specimen No: <b>${esc(selected.accessionNumber || '')}</b></span><span>Requesting doctor: <b>${esc(selected.requesterName || '—')}</b></span><span>Collected: ${esc(displayDate(selected.collectedAt))}</span><span>Received: ${esc(displayDate(selected.receivedAt))}</span></div>
        <table class="lab-print-results"><thead><tr><th>Test Name</th><th>Result</th><th>Flag</th><th>Unit</th><th>Reference Interval</th></tr></thead><tbody>${printableRows(category,rows)}</tbody></table>
      </section>`;
    });
    const printPageGroups=[];
    let currentPrintGroups=[];let currentPrintRows=0;
    for(const group of labPrintGroups){
      const rowCount=group.match(/<tr\b/g)?.length||1;
      const estimatedRows=Math.max(1,rowCount-1)+3;
      if(currentPrintGroups.length&&(currentPrintGroups.length>=3||currentPrintRows+estimatedRows>35)){
        printPageGroups.push(currentPrintGroups);currentPrintGroups=[];currentPrintRows=0;
      }
      currentPrintGroups.push(group);currentPrintRows+=estimatedRows;
    }
    if(currentPrintGroups.length)printPageGroups.push(currentPrintGroups);
    const caseId=person.caseNumber||person.healthId||selected.patientKey;
    const department=person.currentWardNameEn||person.departmentNameEn||person.currentWardCode||person.departmentCode||'—';
    const diagnosis=person.diagnosisIcd10||person.diagnosis||'—';
    const labPrintPages=printPageGroups.map((groups,index)=>`<section class="lab-print-page">
      <header class="lab-print-letterhead">
        <div class="lab-print-national-heading">
          <div class="lab-print-national-text">
            <div>Kingdom of Cambodia</div>
            <div>Nation Religion King</div>
            <img class="lab-print-tacteing" src="/emr-assets/Tacteing-6.png" alt="">
          </div>
          <img class="lab-print-logo" src="/api/organization/logo" alt="Borkeo Referral Hospital">
        </div>
        <h1>Laboratory of Borkeo Referral Hospital</h1>
        <h2 class="lab-print-report-title"><span>Laboratory Results</span><span class="lab-print-copy">${index+1}/${printPageGroups.length}</span></h2>
      </header>
      <div class="lab-print-patient-grid">
        <div><b>Patient ID:</b> ${esc(caseId)}</div><div><b>Ward:</b> ${esc(department)}</div>
        <div><b>Patient name:</b> <span data-patient-value>${esc(person.fullName || person.caseNumber || selected.patientKey)}</span></div><div><b>Sex, age:</b> ${esc(person.sex || '—')} · ${esc(person.age || '—')}</div>
        <div class="lab-print-diagnosis"><b>Diagnosis:</b> ${esc(diagnosis)}</div>
      </div>
      ${groups.join('')}
      <footer class="lab-print-signatures"><span>Collected by<br><b>${esc(selected.collectorName || '')}</b><br>${esc(displayDate(selected.collectedAt))}</span><span>Verified by<br><b>${esc((historicalRelease ? selected.reportVersions?.find(v => v.releasedAt === historicalRelease)?.validatorName : selected.validatorName) || '')}</b><br>${esc(displayDate(historicalRelease || selected.releasedAt))}</span></footer>
      <div class="lab-print-footer">Results must be interpreted by a doctor in the patient’s clinical context.</div>
    </section>`).join('');

    let workflowActions = '';
    const isOpdOrder = String(person.serviceMode || '').toLowerCase() === 'opd';
    if (!released && !rejected) {
      if (selected.status === 'ORDERED' && isOpdOrder) {
        workflowActions += '<div class="direct-opd-lab-note"><strong>OPD direct laboratory workflow:</strong> Patient comes directly to the laboratory. The laboratory technician collects the specimen here, performs the test, and enters the result.</div>';
        workflowActions += '<button data-save>Start Testing and Save Draft</button><button class="primary" data-release>Verify Result and Send to Doctor OPD</button><button class="danger" data-reject>Reject Specimen</button>';
      }
      if (selected.status === 'SENT_TO_LAB') workflowActions += '<button class="primary" data-received>Receive Specimen</button><button class="danger" data-reject>Reject Specimen</button>';
      if (['RECEIVED','PROCESSING'].includes(selected.status)) workflowActions += '<button data-save>Save Draft</button><button class="primary" data-release>Verify and Send to Ward</button><button class="danger" data-reject>Reject Specimen</button>';
    }

    el('lab-detail').innerHTML = `
      <div class="detail-head"><div><h2 data-patient-value>${esc(person.fullName || person.caseNumber || selected.patientKey)}</h2>
        <div class="detail-meta"><strong>${esc(selected.accessionNumber || '')}</strong><br>${esc(person.caseNumber || '')} · ${esc(person.departmentNameEn || person.departmentCode || '')} ${person.currentBedLabel ? `· Bed ${esc(person.currentBedLabel)}` : ''}<br>Ordered by ${esc(selected.requesterName || '')} · ${displayDate(selected.createdAt)}</div>
      </div><div><span class="badge ${selected.priority === 'URGENT' ? 'urgent' : ''}">${priorityLabel(selected.priority)}</span><span class="badge">${esc(statusLabel(selected.status))}</span>${selected.hasCritical ? '<span class="badge critical">Critical</span>' : ''}</div></div>
      ${workflowTimeline(selected)}
      ${released && selected.reportVersions?.length > 1 ? `<label class="lab-report-version">Released report <select data-report-version><option value="0">Latest release</option>${selected.reportVersions.filter(v => v.releasedAt !== selected.releasedAt).map(v => `<option value="${v.releasedAt}" ${v.releasedAt === historicalRelease ? 'selected' : ''}>Original release: ${esc(displayDate(v.releasedAt))}</option>`).join('')}</select></label>` : ''}
      ${historicalRelease ? `<p class="released-banner">Archived report: ${esc(displayDate(historicalRelease))}. Original results and limits.</p>` : ''}
      ${released ? `<div class="released-banner">Results sent to ward ${displayDate(selected.releasedAt)} by ${esc(selected.validatorName || '')}${selected.wardSeenAt ? `<br><strong>Seen by ward:</strong> ${displayDate(selected.wardSeenAt)} by ${esc(selected.wardSeenName || '')}` : ''}</div>` : ''}
      ${rejected ? `<div class="rejected-banner"><strong>Specimen rejected:</strong> ${esc(selected.rejectionReason || 'No reason recorded.')}<br><small>${esc(selected.rejectorName || '')} · ${displayDate(selected.rejectedAt)}</small></div>` : ''}
      ${selected.hasCritical ? `<div class="critical-banner"><strong>Critical laboratory results.</strong> ${selected.criticalAckAt ? `Acknowledged by ${esc(selected.criticalAckName || '')} at ${displayDate(selected.criticalAckAt)}${selected.criticalAckNote ? ` — ${esc(selected.criticalAckNote)}` : ''}` : 'Awaiting doctor acknowledgement.'}</div>` : ''}
      <div class="warning">Reference intervals may be adjusted. The laboratory must validate them against its equipment, methods and hospital policy before use.</div>
      <section class="requested-by-group"><h3>Ordered Tests by Group</h3>${requestedGroupHtml(requested)}</section>
      <datalist id="lab-qualitative-values"><option value="Negative"><option value="Positive"><option value="Non-reactive"><option value="Reactive"><option value="Not detected"><option value="Detected"><option value="No growth"><option value="Growth"></datalist>
      <div class="lab-print-pages">${labPrintPages}</div>
      <div class="lab-result-groups">${resultGroupsHtml || '<p>No test results.</p>'}</div>
      <div class="detail-actions">${workflowActions}<button data-print>Print</button><button data-refresh>Refresh</button></div>
      ${ipdFeeEntry}
      <section class="attachments"><h3>Attachments</h3><div class="attachment-list">${(selected.attachments || []).map(attachment => `<a data-language-exclude href="/api/paraclinic/attachments/${attachment.id}" target="_blank">${esc(attachment.filename)}</a>`).join('') || '<span>No attachments.</span>'}</div>${released || rejected || !['RECEIVED','PROCESSING'].includes(selected.status) ? '' : '<input type="file" id="lab-files" multiple accept="application/pdf,image/jpeg,image/png"><button data-upload>Attach Files</button>'}</section>`;
    attachDetailHandlers();
  }

  function collectResult() {
    return {
      items: [...el('lab-detail').querySelectorAll('tr[data-code]')].map(row => ({
        code: row.dataset.code,
        value: row.querySelector('[data-value]').value,
        unit: row.querySelector('[data-unit]')?.value || '',
        comment: row.querySelector('[data-comment]').value,
      })),
    };
  }

  function refreshRow(row) {
    if (selected?.releasedAt) return;
    if (row.dataset.resultType === 'TEXT') {
      const flagCell = row.querySelector('[data-flag]');
      flagCell.textContent = '';
      flagCell.className = 'flag';
      row.querySelector('[data-value]')?.classList.remove('abnormal-result');
      return;
    }
    const item = resolvedTest(row.dataset.code, resultMap().get(row.dataset.code) || {});
    const value = row.querySelector('[data-value]').value;
    const unit = row.querySelector('[data-unit]')?.value || '';
    const low = fromBase(item.referenceLow, unit, item);
    const high = fromBase(item.referenceHigh, unit, item);
    row.querySelector('[data-reference]').textContent = referenceText(low, high, unit, item);
    row.querySelector('[data-critical]').textContent = 'Critical: ' + criticalText(item, unit);
    const flag = localFlag(value, unit, item);
    const cell = row.querySelector('[data-flag]');
    cell.textContent = flagLabel(flag);
    cell.className = `flag ${flag}`;
    row.querySelector('[data-value]').classList.toggle('abnormal-result', Boolean(flag));
  }

  function attachDetailHandlers() {
    el('lab-detail').querySelector('[data-report-version]')?.addEventListener('change', event => { historicalRelease = Number(event.target.value); renderDetail(); });
    el('lab-detail').querySelectorAll('tr[data-code]').forEach(row => {
      refreshRow(row);
      row.addEventListener('input', event => { if (event.target.matches('[data-unit]')) return; setDirty(true, 'Automatic refresh is paused while entering results. Save or refresh when finished.'); refreshRow(row); });
      const unitSelect = row.querySelector('[data-unit]');
      let previousUnit = unitSelect?.value;
      unitSelect?.addEventListener('change', () => {
        try {
          const item = resolvedTest(row.dataset.code, resultMap().get(row.dataset.code) || {});
          const input = row.querySelector('[data-value]');
          const converted = referenceTools.convertValue(input.value, previousUnit, unitSelect.value, item);
          input.value = converted === '' || converted == null ? '' : Number(converted.toPrecision(12));
          previousUnit = unitSelect.value;
          setDirty(true, 'Unit, result and limits converted together. Save when finished.');
          refreshRow(row);
        } catch (error) { unitSelect.value = previousUnit; setStatus(error.message, 'error'); }
      });
      row.querySelector('[data-comment]')?.addEventListener('input', () => setDirty(true, 'Automatic refresh is paused while entering results. Save or refresh when finished.'));
    });
    el('lab-detail').querySelector('[data-received]')?.addEventListener('click', () => setStage('RECEIVED'));
    el('lab-detail').querySelector('[data-reject]')?.addEventListener('click', rejectSpecimen);
    el('lab-detail').querySelector('[data-save]')?.addEventListener('click', () => save(false));
    el('lab-detail').querySelector('[data-release]')?.addEventListener('click', () => save(true));
    el('lab-detail').querySelector('[data-refresh]')?.addEventListener('click', async () => {
      if (detailDirty && !confirm('Refresh now and discard unsaved changes?')) return;
      setDirty(false);
      await load({ force: true });
      renderDetail();
    });
    el('lab-detail').querySelector('[data-print]')?.addEventListener('click', async () => {
      // Copy current editor values into the print snapshot only; do not save the order.
      const printRows = [...el('lab-detail').querySelectorAll('tr[data-print-code]')];
      for (const row of el('lab-detail').querySelectorAll('tr[data-code]')) {
        const target = printRows.find(item => item.dataset.printCode === row.dataset.code);
        if (!target) continue;
        const cells = target.querySelectorAll('td');
        cells[1].textContent = row.querySelector('[data-value]')?.value || '';
        cells[3].textContent = row.querySelector('[data-unit]')?.value || '';
        cells[4].textContent = [row.querySelector('[data-reference]')?.textContent, row.querySelector('[data-critical]')?.textContent].filter(Boolean).join(' · ');
        const flag = row.querySelector('[data-flag]');
        const code = ['CRITICAL_HIGH','CRITICAL_LOW','HIGH','LOW'].find(code => flag?.classList.contains(code)) || '';
        cells[1].classList.toggle('abnormal-result', Boolean(code));
        cells[2].textContent = '';
        cells[2].className = 'lab-print-flag ' + code;
      }
      await window.printEmrReport({selectors:['.lab-print-pages'],title:'Laboratory results'});
    });
    el('lab-detail').querySelector('[data-upload]')?.addEventListener('click', upload);
    el('lab-detail').querySelector('[data-add-extra-fee]')?.addEventListener('click', addExtraFee);
  }

  async function addExtraFee(event){
    const button=event.currentTarget,form=button.closest('.extra-paraclinic-fee'),serviceCode=form?.querySelector('[data-extra-fee]')?.value,quantity=Number(form?.querySelector('[data-extra-fee-qty]')?.value||1),message=form?.querySelector('[data-extra-fee-status]');
    if(!selected||!serviceCode||quantity<1)return;
    button.disabled=true;if(message)message.textContent='Adding fee…';
    try{const data=await json(`/api/paraclinic/orders/${selected.id}/fees`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceCode,quantity})});if(message)message.textContent=`Added ${data.fee.description} (${data.fee.amount} ${data.fee.currency}) to invoice ${data.charge.invoiceId}. Ward nurse notified.`;form.querySelector('[data-extra-fee]').value='';}
    catch(error){if(message)message.textContent=error.message;}
    finally{button.disabled=false;}
  }

  async function setStage(status) {
    try {
      const data = await json(`/api/paraclinic/orders/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      selected = data.order;
      setDirty(false);
      await load({ force: true });
      renderDetail();
    } catch (error) { alert(error.message); }
  }

  async function rejectSpecimen() {
    const reason = prompt('Specimen rejection reason (required):', '');
    if (reason === null) return;
    if (!reason.trim()) { alert('Enter the reason for rejecting the specimen.'); return; }
    try {
      const data = await json(`/api/paraclinic/orders/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason.trim() }),
      });
      selected = data.order;
      setDirty(false);
      await load({ force: true });
      renderDetail();
    } catch (error) { alert(error.message); }
  }

  async function save(release) {
    try {
      const result = collectResult();
      if (release) {
        const blanks = result.items.filter(item => String(item.value ?? '').trim() === '');
        if (blanks.length && !confirm(`${blanks.length} Some results are blank. Send them anyway?`)) return;
        const previewCritical = [...el('lab-detail').querySelectorAll('.flag.CRITICAL_LOW,.flag.CRITICAL_HIGH')].length > 0;
        if (previewCritical && !confirm('This result is critical. Verify and send it now?')) return;
      }
      const data = await json(`/api/paraclinic/orders/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PROCESSING', performed: true, result, release }),
      });
      selected = data.order;
      setDirty(false);
      await load({ force: true });
      renderDetail();
    } catch (error) { alert(error.message); }
  }

  async function upload() {
    const files = [...document.getElementById('lab-files').files];
    for (const file of files) {
      const response = await fetch(`/api/paraclinic/orders/${selected.id}/attachments`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'X-CSRF-Token': csrf, 'X-File-Name': file.name, 'Content-Type': file.type }, body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { alert(data.error || 'Upload failed'); return; }
    }
    await load({ force: true });
    renderDetail();
  }

  function parseUnitLines(text, baseUnit) {
    const rows = String(text || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(value => value.trim());
      const unit = parts[0] || '';
      const factor = parts[1] === '' || parts[1] === undefined ? 1 : Number(parts[1]);
      const offset = parts[2] === '' || parts[2] === undefined ? 0 : Number(parts[2]);
      if (!unit || !Number.isFinite(factor) || factor <= 0 || !Number.isFinite(offset)) throw new Error(`Invalid unit conversion: ${line}`);
      return { unit, factorToBase: factor, offsetToBase: offset };
    });
    if (baseUnit && !rows.some(item => item.unit === baseUnit)) rows.unshift({ unit: baseUnit, factorToBase: 1, offsetToBase: 0 });
    return rows;
  }

  function unitLines(item) { return (item?.units || []).map(row => `${row.unit} | ${row.factorToBase ?? 1} | ${row.offsetToBase ?? 0}`).join('\n'); }
  function numberOrBlank(value) { return value === null || value === undefined ? '' : value; }

  function formatNumberClean(val) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return '';
    const num = Number(val);
    const rounded = Number(num.toPrecision(5));
    return Number.isInteger(rounded) ? String(rounded) : String(Number(rounded.toFixed(4)));
  }

  function formatRangeText(low, high, unit = '') {
    const lowStr = formatNumberClean(low);
    const highStr = formatNumberClean(high);
    if (lowStr && highStr) return `${lowStr} – ${highStr} ${unit}`.trim();
    if (lowStr) return `≥ ${lowStr} ${unit}`.trim();
    if (highStr) return `≤ ${highStr} ${unit}`.trim();
    return '';
  }

  function openCatalogManager() {
    if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','LAB'].includes(currentRole)) return;
    const canCreateDelete = ['ADMIN','VICE_DIRECTOR'].includes(currentRole);
    const rangesOnly = currentRole === 'LAB';
    const overlay = document.createElement('div');
    overlay.className = 'lab-catalog-modal';
    overlay.lang = 'en';
    overlay.innerHTML = `<div class="lab-catalog-card"><header><div><h2>Manage Laboratory Test Catalog</h2><p>Configure tests, reference intervals and units validated by the hospital.</p></div><button type="button" data-close>×</button></header><div class="lab-catalog-layout"><aside><div class="catalog-tools"><input data-catalog-search placeholder="Search tests, codes or categories"><button type="button" data-new>+ New Test</button></div><div data-catalog-list></div></aside><form data-catalog-form><input type="hidden" name="editing"><div class="catalog-grid"><label>Test Code<input name="code" required pattern="[A-Za-z0-9_]{2,40}" maxlength="40"></label><label>Test Name<input name="name" required maxlength="160"></label><label>Category<input name="category" required maxlength="120"></label><label>LOINC Code<input name="loincCode" maxlength="40"></label><label>Specimen<input name="specimen" maxlength="120"></label><label>Base Unit<input name="baseUnit" maxlength="40" list="lab-base-units"><datalist id="lab-base-units"></datalist></label><label>Reference Low<input name="referenceLow" type="number" step="any"></label><label>Reference High<input name="referenceHigh" type="number" step="any"></label><label>Critical Low<input name="criticalLow" type="number" step="any"></label><label>Critical High<input name="criticalHigh" type="number" step="any"></label></div><label>Allowed Units and Conversion to Base Unit <small>(One line: unit | factor | offset)</small><textarea name="units" rows="6" spellcheck="false"></textarea></label><label>Reference Note<textarea name="referenceNote" rows="3"></textarea></label><details class="lab-reference-profiles"><summary>Age and sex ranges</summary><p>JSON arrays. Ages are years; min is inclusive and max exclusive. Optional sex: M or F; minDays / maxDays use a known date of birth. First matching rule applies. An empty array uses the scalar limits above.</p><label>Reference rules<textarea name="referenceRules" rows="7" spellcheck="false"></textarea></label><label>Critical rules<textarea name="criticalRules" rows="5" spellcheck="false"></textarea></label></details><label class="catalog-active"><input name="referenceLowExclusive" type="checkbox"> Lower reference limit is exclusive (&gt;)</label><label class="catalog-active"><input name="referenceHighExclusive" type="checkbox"> Upper reference limit is exclusive (&lt;)</label><label class="catalog-active"><input name="criticalInclusive" type="checkbox"> Critical alerts include the threshold (≤ / ≥)</label><label class="catalog-active"><input name="locallyReviewed" type="checkbox"> Reviewed against our local method and approved critical-alert policy</label><div data-reference-sources class="lab-reference-sources"></div><label class="catalog-active"><input name="active" type="checkbox" checked> Active and available to order</label><div class="catalog-status" data-catalog-status></div><div class="catalog-actions"><button type="button" class="danger-btn" data-form-delete style="display:none;margin-right:auto">Delete Test</button><button type="button" data-clear>Clear</button><button type="submit" class="primary">Save Test</button></div></form></div></div>`;
    document.body.append(overlay);
    const form = overlay.querySelector('[data-catalog-form]');
    const list = overlay.querySelector('[data-catalog-list]');
    const search = overlay.querySelector('[data-catalog-search]');
    const status = overlay.querySelector('[data-catalog-status]');
    const formDeleteBtn = overlay.querySelector('[data-form-delete]');
    const collapsedCategories = new Set();
    let editingDefinition = null;
    if (!canCreateDelete) overlay.querySelector('[data-new]').hidden = true;
    if (rangesOnly) for (const key of ['name','category','loincCode','specimen']) form.elements[key].disabled = true;
    function fillReferenceFields(item) {
      form.elements.referenceRules.value = JSON.stringify(item.referenceConfig?.referenceRules || [], null, 2);
      form.elements.criticalRules.value = JSON.stringify(item.referenceConfig?.criticalRules || [], null, 2);
      form.elements.criticalInclusive.checked = item.referenceConfig?.criticalInclusive === true;
      form.elements.referenceHighExclusive.checked = item.referenceConfig?.referenceHighExclusive === true;
      form.elements.referenceLowExclusive.checked = item.referenceConfig?.referenceLowExclusive === true;
      form.elements.locallyReviewed.checked = item.referenceConfig?.reviewed === true;
      overlay.querySelector('#lab-base-units').innerHTML = (item.units || []).map(r => `<option value="${esc(r.unit)}"></option>`).join('');
      overlay.querySelector('[data-reference-sources]').innerHTML = ['reference','critical'].map(kind => {
        const source = item.referenceConfig?.[kind + 'Source'] || 'Not configured';
        return `<p>${kind === 'reference' ? 'Reference' : 'Critical'} source: ${/^https:\/\//.test(source) ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Published source</a>` : esc(source)}</p>`;
      }).join('');
    }
    for (const kind of ['reference','critical']) for (const side of ['Low','High']) form.elements[kind+side].addEventListener('input', () => {
      form.elements[kind+'Rules'].value = '[]'; form.elements.locallyReviewed.checked = false;
      if (kind === 'reference') { form.elements.referenceHighExclusive.checked = false; form.elements.referenceLowExclusive.checked = false; }
      status.textContent = 'Scalar limits selected; age/sex rules cleared for this range. Review before saving.';
    });
    for (const key of ['units','referenceNote','referenceRules','criticalRules','criticalInclusive','referenceHighExclusive','referenceLowExclusive']) form.elements[key].addEventListener('input', () => { form.elements.locallyReviewed.checked = false; });
    function parseRules(name) {
      const rules = JSON.parse(form.elements[name].value || '[]');
      if (!Array.isArray(rules)) throw new Error('Age and sex rules must be JSON arrays.');
      return rules;
    }
    form.elements.baseUnit.addEventListener('change', () => {
      if (!editingDefinition || form.elements.baseUnit.value.trim() === editingDefinition.baseUnit) return;
      try {
        const current = { ...editingDefinition, units: parseUnitLines(form.elements.units.value, editingDefinition.baseUnit), referenceConfig: { ...editingDefinition.referenceConfig, reviewed: form.elements.locallyReviewed.checked, referenceRules: parseRules('referenceRules'), criticalRules: parseRules('criticalRules') } };
        for (const key of referenceTools.LIMIT_KEYS) current[key] = form.elements[key].value === '' ? null : Number(form.elements[key].value);
        const converted = referenceTools.rebaseTest(current, form.elements.baseUnit.value.trim());
        for (const key of referenceTools.LIMIT_KEYS) form.elements[key].value = numberOrBlank(converted[key]);
        form.elements.units.value = unitLines(converted);
        fillReferenceFields(converted);
        editingDefinition = converted;
        status.textContent = 'Base unit and all limits converted. Review before saving.';
      } catch (error) { form.elements.baseUnit.value = editingDefinition.baseUnit; status.textContent = error.message; }
    });
    catalogManagerOpen = true;
    const close = () => { catalogManagerOpen = false; overlay.remove(); };
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });

    function clear() {
      form.reset(); editingDefinition = null; form.elements.editing.value = ''; form.elements.code.disabled = rangesOnly; form.elements.active.checked = true;
      fillReferenceFields({});
      if (formDeleteBtn) formDeleteBtn.style.display = 'none';
      status.textContent = '';
      list.querySelectorAll('.catalog-item-row').forEach(row => row.classList.remove('active'));
    }
    function fill(item) {
      editingDefinition = item; fillReferenceFields(item);
      form.elements.editing.value = item.code; form.elements.code.value = item.code; form.elements.code.disabled = true;
      form.elements.name.value = item.name || ''; form.elements.category.value = categoryLabel(item.category) || ''; form.elements.loincCode.value = item.loincCode || '';
      form.elements.specimen.value = item.specimen || ''; form.elements.baseUnit.value = item.baseUnit || '';
      form.elements.referenceLow.value = numberOrBlank(item.referenceLow); form.elements.referenceHigh.value = numberOrBlank(item.referenceHigh);
      form.elements.criticalLow.value = numberOrBlank(item.criticalLow); form.elements.criticalHigh.value = numberOrBlank(item.criticalHigh);
      form.elements.units.value = unitLines(item); form.elements.referenceNote.value = item.referenceNote || ''; form.elements.active.checked = item.active !== false;
      if (formDeleteBtn) formDeleteBtn.style.display = canCreateDelete ? 'inline-flex' : 'none';
      status.textContent = '';
      list.querySelectorAll('.catalog-item-row').forEach(row => row.classList.toggle('active', row.dataset.code === item.code));
    }
    async function deleteTestByCode(code) {
      if (!code || !canCreateDelete) return;
      if (!confirm(`Are you sure you want to delete laboratory test "${code}"?`)) return;
      status.textContent = 'Deleting…';
      try {
        await json(`/api/lab-catalog/${encodeURIComponent(code)}`, { method: 'DELETE' });
        status.textContent = `Test "${code}" deleted successfully.`;
        catalog = (await json('/api/lab-catalog')).tests;
        if (form.elements.editing.value === code) clear();
        render();
      } catch (error) { status.textContent = error.message; }
    }
    function render() {
      const query = search.value.trim().toLowerCase();
      const currentCode = form.elements.editing.value;
      const rows = catalog.filter(item => !query || `${item.code} ${item.name} ${item.category} ${item.loincCode || ''}`.toLowerCase().includes(query));
      if (!rows.length) {
        list.innerHTML = '<p class="empty-hint" style="padding:12px;color:#78909a">No tests found.</p>';
        return;
      }
      const groups = new Map();
      rows.forEach(item => {
        const cat = item.category || 'Other / Special';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(item);
      });
      list.innerHTML = [...groups].map(([cat, items]) => {
        const isCollapsed = !query && collapsedCategories.has(cat);
        return `<div class="catalog-group ${isCollapsed ? 'collapsed' : ''}" data-group="${esc(cat)}">
          <button type="button" class="catalog-group-header" data-toggle-group="${esc(cat)}">
            <span class="group-chevron">${isCollapsed ? '▶' : '▼'}</span>
            <span class="group-title" data-language-exclude>${esc(categoryLabel(cat))}</span>
            <span class="group-badge">${items.length}</span>
          </button>
          <div class="catalog-group-items">
            ${items.map(item => `<div class="catalog-item-row ${item.active ? '' : 'inactive'} ${item.code === currentCode ? 'active' : ''}" data-code="${esc(item.code)}">
              <button type="button" class="catalog-item-btn" data-select-code="${esc(item.code)}">
                <strong data-language-exclude>${esc(item.code)} · ${esc(item.name)}${item.active ? '' : ' <span style="color:#b91c1c;font-size:11px;font-weight:700;">(Inactive)</span>'}</strong>
                <small data-language-exclude>${item.baseUnit ? `Unit: ${esc(item.baseUnit)}` : 'Qualitative'}${item.loincCode ? ` · LOINC ${esc(item.loincCode)}` : ''}</small>
              </button>
              ${canCreateDelete ? `<button type="button" class="catalog-item-delete" data-delete-code="${esc(item.code)}" title="Delete test ${esc(item.code)}">🗑️</button>` : ''}
            </div>`).join('')}
          </div>
        </div>`;
      }).join('');
    }
    list.addEventListener('click', event => {
      const deleteBtn = event.target.closest('[data-delete-code]');
      if (deleteBtn) {
        event.stopPropagation();
        deleteTestByCode(deleteBtn.dataset.deleteCode);
        return;
      }
      const toggleBtn = event.target.closest('[data-toggle-group]');
      if (toggleBtn) {
        const cat = toggleBtn.dataset.toggleGroup;
        if (collapsedCategories.has(cat)) collapsedCategories.delete(cat);
        else collapsedCategories.add(cat);
        const groupEl = toggleBtn.closest('.catalog-group');
        if (groupEl) {
          const isCollapsed = collapsedCategories.has(cat);
          groupEl.classList.toggle('collapsed', isCollapsed);
          const chevron = groupEl.querySelector('.group-chevron');
          if (chevron) chevron.textContent = isCollapsed ? '▶' : '▼';
        }
        return;
      }
      const selectBtn = event.target.closest('[data-code]');
      if (selectBtn) {
        const code = selectBtn.dataset.code;
        const item = catalog.find(row => row.code === code);
        if (item) fill(item);
      }
    });
    if (formDeleteBtn) {
      formDeleteBtn.addEventListener('click', () => {
        const code = form.elements.editing.value;
        if (code) deleteTestByCode(code);
      });
    }
    search.addEventListener('input', render);
    overlay.querySelector('[data-new]').addEventListener('click', clear);
    overlay.querySelector('[data-clear]').addEventListener('click', clear);
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        const editing = form.elements.editing.value;
        const baseUnit = form.elements.baseUnit.value.trim();
        const body = {
          code: (editing || form.elements.code.value).trim().toUpperCase(), name: form.elements.name.value.trim(), category: form.elements.category.value.trim(),
          loincCode: form.elements.loincCode.value.trim(), specimen: form.elements.specimen.value.trim(), baseUnit,
          units: parseUnitLines(form.elements.units.value, baseUnit), referenceLow: form.elements.referenceLow.value,
          referenceHigh: form.elements.referenceHigh.value, criticalLow: form.elements.criticalLow.value, criticalHigh: form.elements.criticalHigh.value,
          referenceNote: form.elements.referenceNote.value.trim(), active: form.elements.active.checked,
          referenceRules: parseRules('referenceRules'), criticalRules: parseRules('criticalRules'),
          criticalInclusive: form.elements.criticalInclusive.checked, referenceHighExclusive: form.elements.referenceHighExclusive.checked, referenceLowExclusive: form.elements.referenceLowExclusive.checked, locallyReviewed: form.elements.locallyReviewed.checked,
        };
        if (!editing && !canCreateDelete) throw new Error('Select an existing test to edit.');
        if (rangesOnly) for (const key of ['code','name','category','loincCode','specimen','active']) delete body[key];
        const data = await json(editing ? `/api/lab-catalog/${encodeURIComponent(editing)}` : '/api/lab-catalog', {
          method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        status.textContent = 'Saved successfully.';
        catalog = (await json('/api/lab-catalog')).tests;
        render(); fill(data.test);
      } catch (error) { status.textContent = error.message; }
    });
    render(); clear();
  }

  el('lab-catalog-manage')?.addEventListener('click', openCatalogManager);
  el('lab-worklist').addEventListener('click', event => {
    const card = event.target.closest('[data-id]'); if (!card) return;
    if (detailDirty && selected?.id !== card.dataset.id && !confirm('There are unsaved laboratory results. Open another order and discard these changes?')) return;
    setDirty(false);
    historicalRelease = 0;
    selected = orders.find(order => order.id === card.dataset.id); renderList(); renderDetail();
  });
  document.querySelector('.status-tabs').addEventListener('click', event => {
    const matBtn = event.target.closest('.tab-materials, #lab-materials-tab');
    if (matBtn) {
      window.location.assign('/lab/materials');
      return;
    }
    const button = event.target.closest('[data-filter]'); if (!button) return;
    filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button)); renderList();
  });
  el('lab-search').addEventListener('input', renderList);
  el('lab-refresh').addEventListener('click', async () => {
    if (detailDirty && !confirm('Refresh now and discard unsaved results?')) return;
    setDirty(false);
    await load({ force: true });
  });
  load({ force: true }).catch(error => { setStatus(error.message); });
  setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load().catch(() => {}); });
})().catch(error => { const node = document.getElementById('lab-status'); if (node) node.textContent = error.message; });
