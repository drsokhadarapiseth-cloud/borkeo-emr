// v41.2 - Medication safety on the medical record page.
// 1. Medication Administration Record (MAR): the dose cells of the existing
//    nursing medicine chart (EMR.html, renderNursingMedicationDoseCell) open a
//    form - Given / Held / Refused, time, reason or note, nurse signature - saved
//    on the server (/api/medication-administrations). Before v41.2 a "given"
//    tick lived only in the open page and was lost on reopening.
// 2. Prescribing warnings for doctors: allergy (structured allergy record),
//    duplicate medicine in the same prescription, interaction and maximum dose
//    (admin tables, empty until approved). Continuing needs an override reason,
//    saved and audited (/api/prescribing-overrides).
// Every control added here is data-emr-transient (never saved with the record).
'use strict';
(function () {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';
  // Approved Khmer, or a highlighted English placeholder (public/new-text.js).
  const label = (key, en, kh) => (english() ? escapeHtml(en) : kh ? escapeHtml(kh) : window.newTextHtml ? window.newTextHtml(key, en) : escapeHtml(en));
  const plain = (key, en, kh) => (english() ? en : kh || (window.newText ? window.newText(key, en) : en));
  const role = () => String(window.emrSession?.user?.activeRole || '').toUpperCase();
  const patientKey = () => window.getLoadedEmrPatient?.()?.patientKey || '';

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

  const pad = (n) => String(n).padStart(2, '0');
  const localInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const showTime = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  // ===================== 1. Medication Administration Record =====================
  const STATUS = {
    given: { en: 'Given', kh: 'បានផ្តល់' },
    held: { en: 'Held', kh: 'ផ្អាក' },
    refused: { en: 'Refused', kh: 'បដិសេធ' },
  };
  const statusLabel = (status) => label('', STATUS[status]?.en || status, STATUS[status]?.kh);
  const statusPlain = (status) => plain('', STATUS[status]?.en || status, STATUS[status]?.kh);
  let administrations = [];
  let loadedFor = '';
  const canRecord = () => ['NURSE', 'MIDWIFE'].includes(role());
  const active = () => administrations.filter((entry) => !entry.voidedAt);
  const entryFor = (orderKey, scheduledAt) => active().find((entry) => entry.orderKey === orderKey && entry.scheduledAt === scheduledAt);

  async function loadAdministrations() {
    const key = patientKey();
    if (!key || !document.getElementById('sub_nursing')) return;
    try {
      administrations = (await api(`/api/medication-administrations?patientKey=${encodeURIComponent(key)}`)).administrations || [];
      loadedFor = key;
    } catch { administrations = []; }
    decorateAll();
  }

  // Shows the saved status on a dose cell drawn by the existing chart.
  function decorateCell(cell) {
    cell.classList.remove('mar-held', 'mar-refused', 'mar-recorded');
    cell.querySelector('.mar-status-badge')?.remove();
    const orderKey = cell.closest('tr[data-medication-key]')?.dataset.medicationKey;
    const scheduledAt = cell.dataset.scheduledAt;
    const entry = orderKey && scheduledAt ? entryFor(orderKey, scheduledAt) : null;
    if (!entry) { delete cell.dataset.marId; return; }
    cell.dataset.marId = entry.id;
    cell.dataset.actualAt = entry.administeredAt;
    cell.classList.add('mar-recorded');
    cell.classList.toggle('nursing-med-given', entry.status === 'given');
    const checkbox = cell.querySelector('.nursing-med-dose-check');
    const time = cell.querySelector('.nursing-med-dose-time');
    if (time) time.textContent = showTime(entry.administeredAt).slice(6);
    if (entry.status === 'given') {
      if (checkbox) checkbox.checked = true;
    } else {
      cell.classList.add(`mar-${entry.status}`);
      const badge = document.createElement('span');
      badge.className = 'mar-status-badge';
      badge.innerHTML = statusLabel(entry.status);
      if (checkbox) checkbox.replaceWith(badge); else cell.appendChild(badge);
    }
    cell.title = [statusPlain(entry.status), showTime(entry.administeredAt), entry.recordedBy, entry.note].filter(Boolean).join(' · ');
  }

  function decorateAll() {
    document.querySelectorAll('#sub_nursing td.nursing-med-time-cell[data-scheduled-at]').forEach(decorateCell);
    renderLogs();
  }

  // Re-apply after the existing chart redraws its cells.
  function wrapChart() {
    for (const name of ['syncNursingMedicationTable', 'refreshNursingMedicationScheduleLanguage']) {
      const original = window[name];
      if (typeof original !== 'function' || original.marWrapped) continue;
      const wrapped = function (...args) { const result = original.apply(this, args); decorateAll(); return result; };
      wrapped.marWrapped = true;
      window[name] = wrapped;
    }
  }

  // The full list under the chart: every entry, corrections included.
  function renderLogs() {
    if (!patientKey() || loadedFor !== patientKey()) return;
    document.querySelectorAll('#sub_nursing .nursing-form-pane').forEach((pane) => {
      const chart = Array.from(pane.querySelectorAll('.vital-tbl')).find((table) => table.querySelector('td.nursing-med-time-cell'));
      if (!chart) return;
      let log = pane.querySelector('.mar-log');
      if (!log) {
        log = document.createElement('section');
        log.className = 'mar-log';
        chart.insertAdjacentElement('afterend', log);
      }
      const rows = administrations.slice().sort((a, b) => String(a.administeredAt).localeCompare(String(b.administeredAt))).map((entry) => `
        <tr class="${entry.voidedAt ? 'mar-voided' : ''}">
          <td>${escapeHtml(showTime(entry.administeredAt))}</td>
          <td><strong>${escapeHtml(entry.medicine)}</strong>${entry.dose ? `<br><span class="mar-dose">${escapeHtml(entry.dose)}</span>` : ''}</td>
          <td><span class="mar-status mar-status-${escapeHtml(entry.status)}">${statusLabel(entry.status)}</span></td>
          <td>${escapeHtml(entry.note)}${entry.voidedAt ? `<div class="mar-void-note">${label('mar.corrected', 'Corrected:')} ${escapeHtml(entry.voidReason || '')} · ${escapeHtml(entry.voidedBy || '')}</div>` : ''}</td>
          <td class="mar-sign">${entry.signature?.signatureDataUrl ? `<img src="${escapeHtml(entry.signature.signatureDataUrl)}" alt="">` : ''}<span>${escapeHtml(entry.recordedBy)}</span></td>
          <td class="no-print">${!entry.voidedAt && canRecord() ? `<button type="button" class="mar-button secondary" data-mar-correct="${escapeHtml(entry.id)}">${label('mar.correct', 'Correct')}</button>` : ''}</td>
        </tr>`).join('');
      log.innerHTML = `
        <h4 class="mar-log-title">${label('', 'Medication Administration Record', 'កំណត់ត្រាការផ្តល់ឱសថ')}</h4>
        ${rows ? `<div class="mar-table-wrap"><table class="mar-table">
          <thead><tr><th>${label('', 'Time', 'ម៉ោង')}</th><th>${label('mar.medicine', 'Medicine and dose')}</th><th>${label('mar.status', 'Status')}</th>
          <th>${label('mar.note', 'Reason / note')}</th><th>${label('', 'Nurse signature', 'ហត្ថលេខាគិលានុបដ្ឋាក')}</th><th class="no-print"></th></tr></thead>
          <tbody>${rows}</tbody></table></div>` : `<p class="mar-empty">${label('mar.empty', 'No dose recorded yet. Click a dose in the chart to record it.')}</p>`}`;
    });
  }

  let signaturePromise = null;
  const mySignature = () => (signaturePromise ||= api('/api/esignature/me').then((r) => r.signature).catch(() => null));

  function dialogShell(id) {
    let dialog = document.getElementById(id);
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = id;
      dialog.className = 'mar-dialog';
      document.body.appendChild(dialog);
    }
    return dialog;
  }

  // Record a dose, or correct an existing entry (void with a reason, then record again).
  async function openDoseDialog(cell, existing) {
    const row = cell.closest('tr[data-medication-key]');
    const order = row?._nursingMedicationOrder;
    if (!row || !order) return;
    const dialog = dialogShell('mar-dose-dialog');
    const signature = await mySignature();
    const scheduled = cell.dataset.scheduledAt;
    const now = new Date();
    dialog.innerHTML = `
      <form method="dialog" class="mar-form">
        <h3>${label('', 'Medication Administration Record', 'កំណត់ត្រាការផ្តល់ឱសថ')}</h3>
        <p class="mar-order"><strong>${escapeHtml(order.name)}</strong> ${escapeHtml(order.dose || '')} ${escapeHtml(String(order.route || '').replace(/^other_/, '').toUpperCase())}<br>
          <span>${label('mar.planned', 'Planned:')} ${escapeHtml(showTime(scheduled))}</span></p>
        ${existing ? `<p class="mar-existing">${statusLabel(existing.status)} · ${escapeHtml(showTime(existing.administeredAt))} · ${escapeHtml(existing.recordedBy)}</p>` : ''}
        <fieldset class="mar-status-choice">
          ${['given', 'held', 'refused'].map((status) => `<label><input type="radio" name="mar-status" value="${status}" data-emr-transient${(existing ? existing.status : 'given') === status ? ' checked' : ''}> ${statusLabel(status)}</label>`).join('')}
        </fieldset>
        <label class="mar-field"><span>${label('', 'Time', 'ម៉ោង')}</span>
          <input type="datetime-local" name="mar-time" data-emr-transient value="${localInputValue(existing ? new Date(existing.administeredAt) : now)}" max="${localInputValue(new Date(now.getTime() + 5 * 60000))}" required></label>
        <label class="mar-field"><span>${label('mar.note', 'Reason / note')}</span>
          <textarea name="mar-note" data-emr-transient maxlength="1000">${escapeHtml(existing?.note || '')}</textarea></label>
        ${existing ? `<label class="mar-field"><span>${label('mar.correctionReason', 'Reason for correction')}</span>
          <input type="text" name="mar-correction" data-emr-transient maxlength="500" required></label>` : ''}
        <div class="mar-signature"><span>${label('', 'Nurse signature', 'ហត្ថលេខាគិលានុបដ្ឋាក')}</span>
          ${signature?.signatureDataUrl ? `<img src="${escapeHtml(signature.signatureDataUrl)}" alt="">` : ''}<strong>${escapeHtml(signature?.signerName || window.emrSession?.user?.displayName || '')}</strong></div>
        <p class="mar-message" role="status"></p>
        <div class="mar-actions">
          <button type="button" class="mar-button secondary" data-mar-cancel>${label('clinical.cancel', 'Cancel')}</button>
          <button type="submit" class="mar-button" data-mar-save>${label('clinical.save', 'Save')}</button>
        </div>
      </form>`;
    const form = dialog.querySelector('form');
    const message = dialog.querySelector('.mar-message');
    dialog.querySelector('[data-mar-cancel]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = form.querySelector('input[name="mar-status"]:checked')?.value;
      const time = form.elements['mar-time'].value;
      const note = form.elements['mar-note'].value.trim();
      if (status !== 'given' && !note) { message.textContent = plain('mar.reasonRequired', 'Write the reason when a dose is held or refused.'); return; }
      if (!time) return;
      const save = dialog.querySelector('[data-mar-save]');
      save.disabled = true;
      try {
        if (existing) {
          const reason = form.elements['mar-correction'].value.trim();
          if (!reason) { message.textContent = plain('mar.correctionRequired', 'Write the reason for the correction.'); save.disabled = false; return; }
          await api(`/api/medication-administrations/${existing.id}/void`, { patientKey: patientKey(), reason });
        }
        const result = await api('/api/medication-administrations', {
          patientKey: patientKey(), orderKey: row.dataset.medicationKey, medicine: order.name, dose: order.dose || '', route: String(order.route || '').replace(/^other_/, '').toUpperCase(),
          scheduledAt: scheduled, status, administeredAt: new Date(time).toISOString(), note,
        });
        administrations = result.administrations || [];
        dialog.close();
        decorateAll();
        // Open-ended orders get their next doses, as with the old tick (EMR.html).
        if (status === 'given' && !existing) window.extendOpenEndedNursingMedicationSchedule?.(row, cell);
      } catch (error) {
        message.textContent = error.message;
        save.disabled = false;
        if (existing) loadAdministrations();
      }
    });
    dialog.showModal();
  }

  // The chart's tick box and double-click now open the form (capture phase,
  // before the chart's own handlers, which kept the tick only in the page).
  document.addEventListener('click', (event) => {
    const checkbox = event.target.closest?.('#sub_nursing .nursing-med-dose-check');
    if (checkbox) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const cell = checkbox.closest('td.nursing-med-time-cell');
      if (!canRecord()) { window.alert(plain('mar.nurseOnly', 'Only nurses and midwives record medicine given.')); return; }
      if (cell && !cell.dataset.marId) openDoseDialog(cell, null);
      return;
    }
    const badge = event.target.closest?.('#sub_nursing td.nursing-med-time-cell[data-mar-id]');
    if (badge && canRecord() && event.detail >= 1 && event.target.closest('.mar-status-badge')) {
      openDoseDialog(badge, administrations.find((entry) => entry.id === badge.dataset.marId));
    }
    const correct = event.target.closest?.('[data-mar-correct]');
    if (correct) {
      const entry = administrations.find((item) => item.id === correct.dataset.marCorrect);
      const cell = entry && Array.from(document.querySelectorAll('#sub_nursing td.nursing-med-time-cell[data-mar-id]')).find((c) => c.dataset.marId === entry.id);
      if (cell) openDoseDialog(cell, entry);
      else if (entry) openCorrectionOnly(entry);
    }
  }, true);
  document.addEventListener('dblclick', (event) => {
    const cell = event.target.closest?.('#sub_nursing td.nursing-med-time-cell[data-mar-id]');
    if (!cell) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (canRecord()) openDoseDialog(cell, administrations.find((entry) => entry.id === cell.dataset.marId));
  }, true);

  // An entry whose dose is no longer on the chart can still be corrected (voided with a reason).
  function openCorrectionOnly(entry) {
    const reason = window.prompt(plain('mar.correctionReason', 'Reason for correction'));
    if (!reason || !reason.trim()) return;
    api(`/api/medication-administrations/${entry.id}/void`, { patientKey: patientKey(), reason: reason.trim() })
      .then((result) => { administrations = result.administrations || []; decorateAll(); })
      .catch((error) => window.alert(error.message));
  }

  // ===================== 2. Prescribing warnings (doctors, midwives) =====================
  // v42.5: the discharge medicines are checked too, and the dose, unit and
  // schedule boxes start the check (the hidden slot fields never fire it).
  const NAME = '.rx-name, .prx-name, .mrx-name, .mprx-name, .orx-name, #emr-discharge-rx-body [data-med="name"]';
  const DOSE = '.rx-dose, .prx-dose, .mrx-dose, .mprx-dose, .orx-dose, .rx-unit, .prx-unit, .mrx-unit, .mprx-unit, .orx-unit, .med-schedule-type, .med-q-hours, '
    + '#emr-discharge-rx-body [data-med="doseAmount"], #emr-discharge-rx-body [data-med="unit"], #emr-discharge-rx-body [data-med="scheduleType"]';
  const GROUPS = [['#rx_tbody', '#rx_protocol_tbody'], ['#mon_rx_tbody', '#mon_rx_protocol_tbody'], ['#opd_rx_tbody'], ['#emr-discharge-rx-body']];
  const PRESCRIBERS = ['DOCTOR', 'MIDWIFE'];
  let safetyTables = null;
  let tablesPromise = null;
  const pendingOverrides = [];
  const reportedUnconverted = new Set();

  const normalize = (value) => String(value || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // v42.3: old Khmer unit labels (public/medicine-units.js) count as mg, mL, mcg, g, IU.
  const canonicalUnit = (value) => window.BorkeoMedicineUnits?.canonical(value) ?? value;
  const firstWord = (value) => normalize(value).split(' ')[0] || '';
  // Same medicine: the first word (generic name) matches, at least 4 letters.
  const sameMedicine = (a, b) => { const x = firstWord(a); return x.length >= 4 && x === firstWord(b); };
  // A table or allergy entry names this medicine.
  const names = (medicine, entry) => {
    const m = normalize(medicine); const e = normalize(entry);
    if (!m || e.length < 3) return false;
    return m === e || m.includes(e) || (firstWord(m).length >= 4 && e.includes(firstWord(m)));
  };
  const number = (value) => { const n = parseFloat(String(value || '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  function loadTables() {
    if (safetyTables) return Promise.resolve(safetyTables);
    if (!tablesPromise) {
      tablesPromise = api('/api/drug-safety')
        .then((result) => { safetyTables = result; return result; })
        .catch(() => { tablesPromise = null; return { interactions: [], maxDoses: [] }; });
    }
    return tablesPromise;
  }

  function groupRows(row) {
    const group = GROUPS.find((selectors) => selectors.some((selector) => row.closest(selector)));
    if (!group) return [];
    return group.flatMap((selector) => Array.from(document.querySelectorAll(`${selector} tr`))).filter((tr) => tr.querySelector(NAME));
  }

  // Number of medicine, unit and doses per day of one prescription row.
  function rowInfo(row) {
    const nameInput = row.querySelector(NAME);
    if (nameInput?.matches('[data-med="name"]')) {
      const value = (key) => row.querySelector(`[data-med="${key}"]`)?.value || '';
      return { nameInput, quantity: value('doseAmount'), unit: value('unit'),
        frequency: window.BorkeoDoseCheck?.frequencyOf(value('scheduleType')) || 0 };
    }
    const prefix = (/\b(rx|prx|mrx|mprx|orx)-name\b/.exec(nameInput?.className || '') || [])[1] || 'rx';
    const field = (suffix) => row.querySelector(`.${prefix}-${suffix}`);
    let frequency = 0;
    try { frequency = Number(window.getMedicationDailyFrequency?.(row)) || 0; } catch { frequency = 0; }
    return { nameInput, prefix, quantity: field('dose')?.value || '', unit: field('unit')?.value || '', frequency };
  }

  // Legacy rule (entered by hand, by name): number of medicine as typed.
  function rowDoses(row) {
    const info = rowInfo(row);
    const value = (suffix) => number(row.querySelector(`.${info.prefix}-${suffix}`)?.value);
    const slots = info.prefix ? ['m', 'a', 'e', 'n'].map(value) : [];
    const single = number(info.quantity) || Math.max(0, ...slots);
    const perDay = info.frequency ? single * info.frequency : slots.reduce((sum, n) => sum + n, 0);
    return { perDose: single, perDay, unit: normalize(canonicalUnit(info.unit)) };
  }

  // Weight from Triage (latest in the record): kg or null.
  function weightKg() {
    for (const id of ['p2_weight', 'opd_weight', 'ipd_weight']) {
      const value = parseFloat(String(document.getElementById(id)?.value || '').replace(',', '.'));
      if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
  }

  // The Essential Medicines List line of a row (chosen now, or saved label / CMS code).
  function catalogueItem(info) {
    const medicine = window.BorkeoMedicine;
    if (!medicine?.ready?.()) { medicine?.ensureData?.(); return null; }
    return medicine.lookup(info.nameInput.value, info.nameInput.dataset.cmsCode);
  }

  const doseLabel = {
    perDose: () => plain('', 'Per dose:', 'ក្នុងមួយដង៖'),
    perDay: () => plain('', 'Per day:', 'ក្នុងមួយថ្ងៃ៖'),
    maximum: () => plain('', 'maximum', 'អតិបរមា'),
    child: () => plain('', 'Child', 'កុមារ'),
    weight: () => plain('', 'Enter the weight to check the dose', 'បញ្ចូលទម្ងន់ ដើម្បីពិនិត្យកម្រិតថ្នាំ'),
    protocol: () => plain('', 'Protocol:', 'តាមពិធីសារ៖'),
  };

  // v42.5: maximum dose of an approved Essential Medicines List line.
  // Returns { warning (red, needs a reason), note (orange or guidance text) }.
  function doseCheck(row) {
    const info = rowInfo(row);
    const item = info.nameInput ? catalogueItem(info) : null;
    if (!item || !window.BorkeoDoseCheck) return {};
    const limit = (safetyTables?.maxDoses || []).find((rule) => rule.doseKey && rule.doseKey === item.doseKey && rule.status === 'approved');
    if (!limit) return {};
    const context = window.BorkeoMedicine.patientContext?.() || null;
    const child = context ? window.BorkeoMedicine.isChild(context) === true : false;
    const result = window.BorkeoDoseCheck.evaluate(limit, item, info.quantity, info.unit, info.frequency, { child, weightKg: weightKg() });
    if (result.level === 'weight') return { note: doseLabel.weight() };
    if (result.level === 'guide') return { note: result.note ? `${doseLabel.protocol()} ${result.note}` : '' };
    if (result.level === 'unconverted') {
      const key = `${item.doseKey}|${item.label}|${info.unit}`;
      if (!reportedUnconverted.has(key)) {
        reportedUnconverted.add(key);
        api('/api/drug-safety/unconverted', { doseKey: item.doseKey, label: item.label, unit: info.unit }).catch(() => {});
      }
      return {};
    }
    if (result.level !== 'red') return {};
    const unit = result.unit || '';
    const parts = [];
    if (result.child) parts.push(`${doseLabel.child()} · ${result.weightKg} kg`);
    if (result.overDose) parts.push(`${doseLabel.perDose()} ${result.perDose} ${unit} (${doseLabel.maximum()} ${result.maxPerDose} ${unit})`);
    if (result.overDay) parts.push(`${doseLabel.perDay()} ${result.perDay} ${unit} (${doseLabel.maximum()} ${result.maxPerDay} ${unit})`);
    return { warning: { kind: 'max-dose', detail: parts.join(' · ') } };
  }

  // Orange note under the medicine name (weight needed, protocol guidance).
  function showDoseNote(row, text) {
    const nameInput = row.querySelector(NAME);
    if (!nameInput) return;
    let note = nameInput.parentNode?.querySelector('.medication-dose-note');
    if (!text) { note?.remove(); return; }
    if (!note) {
      note = document.createElement('span');
      note.className = 'medication-dose-note no-print';
      note.setAttribute('data-emr-transient', '');
      nameInput.insertAdjacentElement('afterend', note);
    }
    note.textContent = `⚠ ${text}`;
  }

  function warningsFor(row) {
    const medicine = row.querySelector(NAME)?.value?.trim();
    if (!medicine) { showDoseNote(row, ''); return []; }
    const warnings = [];
    for (const allergy of window.EmrClinicalSummary?.get()?.summary?.allergies || []) {
      if (names(medicine, allergy.substance)) warnings.push({ kind: 'allergy', detail: `${allergy.substance}${allergy.reaction ? ` (${allergy.reaction})` : ''}` });
    }
    const others = groupRows(row).filter((tr) => tr !== row).map((tr) => tr.querySelector(NAME).value.trim()).filter(Boolean);
    for (const other of others) if (sameMedicine(medicine, other)) warnings.push({ kind: 'duplicate', detail: other });
    for (const rule of safetyTables?.interactions || []) {
      for (const other of others) {
        if ((names(medicine, rule.drugA) && names(other, rule.drugB)) || (names(medicine, rule.drugB) && names(other, rule.drugA))) {
          warnings.push({ kind: 'interaction', detail: `${other}${rule.severity ? ` · ${rule.severity}` : ''}${rule.note ? ` · ${rule.note}` : ''}` });
        }
      }
    }
    const check = doseCheck(row);
    showDoseNote(row, check.note || '');
    if (check.warning) warnings.push(check.warning);
    // Lines entered by hand before v42.5 (no dose key), when approved.
    const doses = rowDoses(row);
    for (const rule of safetyTables?.maxDoses || []) {
      if (rule.doseKey || (rule.status && rule.status !== 'approved')) continue;
      if (!names(medicine, rule.drug)) continue;
      if (rule.unit && doses.unit && normalize(canonicalUnit(rule.unit)) !== doses.unit) continue;
      if (rule.maxPerDose && doses.perDose > rule.maxPerDose) warnings.push({ kind: 'max-dose', detail: `${doses.perDose} > ${rule.maxPerDose} ${rule.unit}`.trim() });
      if (rule.maxPerDay && doses.perDay > rule.maxPerDay) warnings.push({ kind: 'max-dose', detail: `${doses.perDay} / 24h > ${rule.maxPerDay} ${rule.unit}`.trim() });
    }
    return warnings;
  }

  const WARNING_TITLE = {
    allergy: () => label('', 'Allergy warning when prescribing', 'ការព្រមានប្រតិកម្មអាលែកហ្ស៊ីពេលចេញវេជ្ជបញ្ជា'),
    duplicate: () => label('', 'Duplicate drug warning', 'ការព្រមានឱសថស្ទួន'),
    interaction: () => label('safety.interaction', 'Drug interaction warning'),
    'max-dose': () => label('safety.maxDose', 'Maximum dose warning'),
  };

  function askOverride(row, field, medicine, warnings) {
    const dialog = dialogShell('safety-warning-dialog');
    dialog.innerHTML = `
      <form method="dialog" class="mar-form safety-form">
        <h3>${escapeHtml(medicine)}</h3>
        <ul class="safety-list">${warnings.map((w) => `<li class="safety-${w.kind}"><strong>${WARNING_TITLE[w.kind]()}</strong><br>${escapeHtml(w.detail)}</li>`).join('')}</ul>
        <label class="mar-field"><span>${label('', 'Override reason', 'មូលហេតុបន្តទោះមានការព្រមាន')}</span>
          <textarea name="safety-reason" data-emr-transient maxlength="1000" required></textarea></label>
        <p class="mar-message" role="status"></p>
        <div class="mar-actions">
          <button type="button" class="mar-button secondary" data-safety-cancel>${label('safety.remove', 'Do not prescribe')}</button>
          <button type="submit" class="mar-button danger" data-safety-continue>${label('safety.continue', 'Continue with this medicine')}</button>
        </div>
      </form>`;
    const form = dialog.querySelector('form');
    const ack = JSON.stringify(warnings);
    const nameInput = row.querySelector(NAME) || field;
    dialog.querySelector('[data-safety-cancel]').addEventListener('click', () => {
      nameInput.value = '';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      dialog.close();
      nameInput.focus();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const reason = form.elements['safety-reason'].value.trim();
      if (!reason) { dialog.querySelector('.mar-message').textContent = plain('safety.reasonRequired', 'Write the override reason to continue.'); return; }
      const entry = { medicine, warnings, reason };
      row.dataset.safetyAck = ack;
      // v42.5: the reason above a maximum dose is saved with the prescription line.
      if (warnings.some((warning) => warning.kind === 'max-dose')) nameInput.dataset.doseReason = reason;
      dialog.close();
      // Back to the row: the number of medicine when it is still empty.
      const quantity = row.querySelector('[data-med="doseAmount"], .rx-dose, .prx-dose, .mrx-dose, .mprx-dose, .orx-dose');
      if (quantity && !quantity.value) quantity.focus();
      if (patientKey()) await api('/api/prescribing-overrides', { patientKey: patientKey(), ...entry }).catch(() => pendingOverrides.push(entry));
      else pendingOverrides.push(entry);
    });
    dialog.addEventListener('cancel', (event) => event.preventDefault(), { once: true });
    dialog.showModal();
  }

  const isPrescriber = () => PRESCRIBERS.includes(role());

  async function checkPrescription(field) {
    if (!isPrescriber()) return;
    const row = field.closest('tr');
    if (!row?.querySelector(NAME)) return;
    await loadTables();
    const warnings = warningsFor(row);
    // Back under the maximum: the reason written for the higher dose no longer applies.
    if (safetyTables && window.BorkeoMedicine?.ready?.() && !warnings.some((warning) => warning.kind === 'max-dose')) delete row.querySelector(NAME).dataset.doseReason;
    if (!warnings.length) { delete row.dataset.safetyAck; return; }
    if (row.dataset.safetyAck === JSON.stringify(warnings)) return;
    askOverride(row, field, row.querySelector(NAME).value.trim(), warnings);
  }

  // v42.5: checked again on save. A line above the maximum dose without the
  // written reason cannot be saved: returns the message (and opens the warning
  // of the first such line), or '' when saving may go on.
  function validateDoses(rowSelector) {
    if (!isPrescriber() || !safetyTables) return '';
    let first = null;
    document.querySelectorAll(rowSelector).forEach((row) => {
      if (first || !row.querySelector(NAME)?.value?.trim()) return;
      const check = doseCheck(row);
      showDoseNote(row, check.note || '');
      if (check.warning && !row.querySelector(NAME).dataset.doseReason) first = { row, warning: check.warning };
    });
    if (!first) return '';
    const nameInput = first.row.querySelector(NAME);
    askOverride(first.row, nameInput, nameInput.value.trim(), [first.warning]);
    return plain('', 'Write the reason to continue above the maximum dose.', 'សូមសរសេរមូលហេតុ ដើម្បីបន្តលើសកម្រិតថ្នាំអតិបរមា។');
  }

  document.addEventListener('change', (event) => {
    const field = event.target.closest?.(`${NAME}, ${DOSE}`);
    if (field && (field.closest('#page3') || field.closest('#emr-discharge-rx-body'))) checkPrescription(field);
  });

  // A new record gets its key on the first save; overrides made before are sent then.
  document.addEventListener('emr:patient-saved', () => {
    const key = patientKey();
    if (!key) return;
    for (const entry of pendingOverrides.splice(0)) api('/api/prescribing-overrides', { patientKey: key, ...entry }).catch(() => {});
  });

  document.addEventListener('emr:patient-loaded', () => window.setTimeout(() => {
    wrapChart();
    loadAdministrations();
    // Prescribers: the approved limits and the medicine list are ready before the first save.
    if (isPrescriber()) { loadTables(); window.BorkeoMedicine?.ensureData?.(); }
  }, 0));
  window.addEventListener('borkeo-language-change', decorateAll);
  wrapChart();
  window.EmrMedicationSafety = { loadAdministrations, warningsFor, validateDoses, decorateAll, administrations: () => administrations };
})();
