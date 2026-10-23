// v41.2 - Drug interaction and maximum-dose tables (GET /api/drug-safety;
// administrators add and delete rows). The prescribing warnings read them.
// v42.5 - Maximum doses of the Essential Medicines List (adult and child, per
// kg): filters; the administrator edits a line (it goes back to draft); the
// Head of Pharmacy or the Director approves or rejects each line with one
// click (name and time saved). Only approved lines are used by the check.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en';
  const t = (key, en) => (english() || !window.newTextHtml ? escapeHtml(en) : window.newTextHtml(key, en));
  let tables = { interactions: [], maxDoses: [], unconverted: [], canEdit: false, canApprove: false };
  let editing = '';

  async function api(path, body) {
    const response = await fetch(path, body ? {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.emrSession?.csrfToken || '' },
      body: JSON.stringify(body),
    } : { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || String(response.status));
    return result;
  }

  const STATUS = {
    draft: () => t('drugSafety.statusDraft', 'Draft'),
    approved: () => t('drugSafety.statusApproved', 'Approved'),
    rejected: () => t('drugSafety.statusRejected', 'Rejected'),
  };
  const TYPE = {
    check: () => t('drugSafety.typeCheck', 'Checked'),
    protocol: () => t('drugSafety.typeProtocol', 'Protocol (guidance only)'),
    none: () => t('drugSafety.typeNone', 'No check'),
  };
  const num = (value) => (value === null || value === undefined ? '' : escapeHtml(value));
  const when = (ms) => { const d = new Date(ms); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(); };
  // Lines of the Essential Medicines List table have a dose key; the others were entered by hand.
  const listLines = () => tables.maxDoses.filter((row) => row.doseKey);
  const handLines = () => tables.maxDoses.filter((row) => !row.doseKey);

  function filtered() {
    const text = $('ds-filter-text').value.trim().toLowerCase();
    const status = $('ds-filter-status').value;
    const type = $('ds-filter-type').value;
    return listLines().filter((row) => (!status || row.status === status) && (!type || row.type === type)
      && (!text || `${row.drug} ${row.doseKey} ${row.component}`.toLowerCase().includes(text)));
  }

  const FIELDS = [
    ['adult', 'maxPerDose'], ['adult', 'maxPerDay'], ['adult', 'maxPerDosePerKg'], ['adult', 'maxPerDayPerKg'],
    ['child', 'maxPerDosePerKg'], ['child', 'maxPerDayPerKg'], ['child', 'maxPerDose'], ['child', 'maxPerDay'],
  ];

  function doseRow(row) {
    if (editing === row.id) {
      const input = (group, key) => `<input type="number" min="0" step="any" data-edit="${group}.${key}" value="${num(row[group][key])}">`;
      return `<tr class="ds-editing" data-row="${escapeHtml(row.id)}">
        <td><strong>${escapeHtml(row.drug)}</strong><br><small>${escapeHtml(row.route)}</small>
          <input data-edit="component" maxlength="200" value="${escapeHtml(row.component)}" placeholder="${escapeHtml(english() ? 'Component' : '')}"></td>
        <td><select data-edit="type">${['check', 'protocol', 'none'].map((type) => `<option value="${type}"${row.type === type ? ' selected' : ''}>${TYPE[type]()}</option>`).join('')}</select>
          <input data-edit="unit" maxlength="40" value="${escapeHtml(row.unit)}"></td>
        ${FIELDS.map(([group, key]) => `<td>${input(group, key)}</td>`).join('')}
        <td><textarea data-edit="note" maxlength="1000">${escapeHtml(row.note)}</textarea></td>
        <td>${STATUS[row.status]?.() || escapeHtml(row.status)}</td>
        <td class="ds-actions"><button type="button" data-save="${escapeHtml(row.id)}">${t('drugSafety.save', 'Save')}</button>
          <button type="button" class="ds-secondary" data-cancel>${t('drugSafety.cancel', 'Cancel')}</button></td></tr>`;
    }
    const review = row.approvedBy ? `<small>${escapeHtml(row.approvedBy)} · ${escapeHtml(when(row.approvedAt))}</small>` : '';
    const actions = [
      tables.canEdit ? `<button type="button" class="ds-secondary" data-edit-row="${escapeHtml(row.id)}">${t('drugSafety.edit', 'Edit')}</button>` : '',
      tables.canApprove && row.status !== 'approved' ? `<button type="button" data-review="approve" data-id="${escapeHtml(row.id)}">${t('drugSafety.approve', 'Approve')}</button>` : '',
      tables.canApprove && row.status !== 'rejected' ? `<button type="button" class="ds-reject" data-review="reject" data-id="${escapeHtml(row.id)}">${t('drugSafety.reject', 'Reject')}</button>` : '',
    ].join('');
    return `<tr data-row="${escapeHtml(row.id)}">
      <td><strong>${escapeHtml(row.drug)}</strong><br><small>${escapeHtml(row.route)}${row.component ? ` · ${escapeHtml(row.component)}` : ''}</small></td>
      <td>${TYPE[row.type]?.() || escapeHtml(row.type)}<br><small>${escapeHtml(row.unit)}</small></td>
      ${FIELDS.map(([group, key]) => `<td class="ds-num">${num(row[group][key])}</td>`).join('')}
      <td class="ds-note">${escapeHtml(row.note)}</td>
      <td><span class="ds-status ds-status-${escapeHtml(row.status)}">${STATUS[row.status]?.() || escapeHtml(row.status)}</span>${review ? `<br>${review}` : ''}</td>
      <td class="ds-actions">${actions}</td></tr>`;
  }

  function renderDoseTable() {
    const rows = filtered();
    $('ds-count').textContent = String(rows.length);
    const adult = t('drugSafety.adult', 'Adult'), child = t('drugSafety.child', 'Child');
    const perDose = t('drugSafety.perDose', 'per dose'), perDay = t('drugSafety.perDay', 'per day');
    const kgDose = t('drugSafety.perKgDose', 'per kg per dose'), kgDay = t('drugSafety.perKgDay', 'per kg per day');
    $('ds-dose-limits').innerHTML = `<thead>
        <tr><th rowspan="2">${t('drugSafety.drug', 'Medicine')}</th><th rowspan="2">${t('drugSafety.filterType', 'Check type')}</th>
          <th colspan="4">${adult}</th><th colspan="4">${child}</th>
          <th rowspan="2">${t('drugSafety.note', 'Note')}</th><th rowspan="2">${t('drugSafety.filterStatus', 'Status')}</th><th rowspan="2"></th></tr>
        <tr><th>${perDose}</th><th>${perDay}</th><th>${kgDose}</th><th>${kgDay}</th><th>${kgDose}</th><th>${kgDay}</th><th>${perDose}</th><th>${perDay}</th></tr>
      </thead><tbody>${rows.map(doseRow).join('') || `<tr><td colspan="13" class="ds-empty">${t('drugSafety.empty', 'No entries yet.')}</td></tr>`}</tbody>`;
  }

  function render() {
    const empty = (cols) => `<tr><td colspan="${cols}" class="ds-empty">${t('drugSafety.empty', 'No entries yet.')}</td></tr>`;
    const del = (table, id) => (tables.canEdit ? `<td><button type="button" class="ds-delete" data-delete="${table}" data-id="${escapeHtml(id)}">${t('drugSafety.delete', 'Delete')}</button></td>` : '');
    renderDoseTable();
    $('ds-unconverted').innerHTML = `<thead><tr><th>${t('drugSafety.drug', 'Medicine')}</th><th>${t('drugSafety.unit', 'Unit')}</th><th>${t('drugSafety.count', 'Times')}</th><th></th></tr></thead>
      <tbody>${(tables.unconverted || []).map((row) => `<tr><td>${escapeHtml(row.label)}<br><small>${escapeHtml(row.doseKey)}</small></td><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.count)}</td><td><small>${escapeHtml(row.lastBy)} · ${escapeHtml(when(row.lastAt))}</small></td></tr>`).join('') || empty(4)}</tbody>`;
    $('ds-interactions').innerHTML = `<thead><tr><th>${t('drugSafety.drugA', 'Medicine A')}</th><th>${t('drugSafety.drugB', 'Medicine B')}</th><th>${t('drugSafety.severity', 'Severity')}</th><th>${t('drugSafety.note', 'Note')}</th>${tables.canEdit ? '<th></th>' : ''}</tr></thead>
      <tbody>${tables.interactions.map((row) => `<tr><td>${escapeHtml(row.drugA)}</td><td>${escapeHtml(row.drugB)}</td><td>${escapeHtml(row.severity)}</td><td>${escapeHtml(row.note)}</td>${del('interactions', row.id)}</tr>`).join('') || empty(5)}</tbody>`;
    $('ds-max-doses').innerHTML = `<thead><tr><th>${t('drugSafety.drug', 'Medicine')}</th><th>${t('drugSafety.maxPerDose', 'Maximum per dose')}</th><th>${t('drugSafety.maxPerDay', 'Maximum per day')}</th><th>${t('drugSafety.unit', 'Unit')}</th><th>${t('drugSafety.note', 'Note')}</th><th>${t('drugSafety.filterStatus', 'Status')}</th>${tables.canEdit || tables.canApprove ? '<th></th>' : ''}</tr></thead>
      <tbody>${handLines().map((row) => `<tr><td>${escapeHtml(row.drug)}</td><td>${num(row.maxPerDose)}</td><td>${num(row.maxPerDay)}</td><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.note)}</td>
        <td><span class="ds-status ds-status-${escapeHtml(row.status)}">${STATUS[row.status]?.() || escapeHtml(row.status)}</span></td>
        ${tables.canEdit || tables.canApprove ? `<td class="ds-actions">${tables.canApprove && row.status !== 'approved' ? `<button type="button" data-review="approve" data-id="${escapeHtml(row.id)}">${t('drugSafety.approve', 'Approve')}</button>` : ''}${tables.canApprove && row.status !== 'rejected' ? `<button type="button" class="ds-reject" data-review="reject" data-id="${escapeHtml(row.id)}">${t('drugSafety.reject', 'Reject')}</button>` : ''}${tables.canEdit ? `<button type="button" class="ds-delete" data-delete="max-doses" data-id="${escapeHtml(row.id)}">${t('drugSafety.delete', 'Delete')}</button>` : ''}</td>` : ''}</tr>`).join('') || empty(7)}</tbody>`;
    $('ds-interaction-form').hidden = !tables.canEdit;
    $('ds-max-form').hidden = !tables.canEdit;
  }

  async function run(action) {
    $('ds-status').textContent = '';
    try { tables = await action(); render(); return true; } catch (error) { $('ds-status').textContent = error.message; return false; }
  }

  function bindForm(form, path) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(form).entries());
      if (await run(() => api(path, body))) form.reset();
    });
  }

  function editedValues(tr) {
    const value = (name) => tr.querySelector(`[data-edit="${name}"]`)?.value ?? '';
    const body = { type: value('type'), unit: value('unit'), note: value('note'), component: value('component'), adult: {}, child: {} };
    for (const [group, key] of FIELDS) body[group][key] = value(`${group}.${key}`);
    return body;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (!button) return;
    if (button.dataset.delete) run(() => api(`/api/drug-safety/${button.dataset.delete}/${button.dataset.id}/delete`, {}));
    else if (button.dataset.review) run(() => api(`/api/drug-safety/max-doses/${button.dataset.id}/${button.dataset.review}`, {}));
    else if (button.dataset.editRow) { editing = button.dataset.editRow; renderDoseTable(); }
    else if (button.hasAttribute('data-cancel')) { editing = ''; renderDoseTable(); }
    else if (button.dataset.save) {
      const tr = button.closest('tr');
      run(() => api(`/api/drug-safety/max-doses/${button.dataset.save}/update`, editedValues(tr))).then((ok) => { if (ok) { editing = ''; renderDoseTable(); } });
    }
  });
  for (const id of ['ds-filter-text', 'ds-filter-status', 'ds-filter-type']) $(id).addEventListener('input', renderDoseTable);
  bindForm($('ds-interaction-form'), '/api/drug-safety/interactions');
  bindForm($('ds-max-form'), '/api/drug-safety/max-doses');
  run(() => api('/api/drug-safety'));
})();
