// v42.6 - Vaccination by the midwife (/vaccination?patient=...). The vaccine is
// chosen from the medicine list lines marked vaccine; each dose is deducted from
// stock (reference VACCINATION:<id>); the same vaccine and dose number twice
// asks for a confirmation; the tetanus vaccine of a pregnant woman also shows
// in her ANC record. History per Health ID and a printable vaccination card.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en';
  const t = (key, en) => (english() ? en : (window.newText ? window.newText(key, en) : en));
  const params = new URLSearchParams(window.location.search);
  const patientKey = params.get('patient') || '';
  let data = null;
  let canWrite = false;

  async function api(path, body) {
    let headers = {};
    if (body) {
      const me = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }).then((r) => r.json());
      headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
    }
    const response = await fetch(path, body ? { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(body) } : { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || String(response.status)), { body: result, status: response.status });
    return result;
  }

  const defaultQuantity = (item) => { const match = /(\d+(?:[.,]\d+)?)\s*(mL|IU)\b/i.exec(String(item?.strength || '')); return match ? match[1].replace(',', '.') : '1'; };

  function renderForm() {
    if (!canWrite) { $('vac-form-host').innerHTML = ''; return; }
    const wantTetanus = params.get('vaccine') === 'tt';
    const options = data.vaccines.map((item) => `<option value="${esc(item.id)}"${wantTetanus && /tetanus/i.test(item.name) ? ' selected' : ''}>${esc(item.label)}</option>`).join('');
    $('vac-form-host').innerHTML = `<h2>${esc(t('vac.newDose', 'Record a dose'))}</h2>
      <form id="vac-form" class="anc-visit-grid wide">
        <label>${esc(t('vac.vaccine', 'Vaccine'))} <select name="vaccineId" required><option value=""></option>${options}</select></label>
        <label>${esc(t('vac.dose', 'Dose number'))} <input class="anc-field tiny" name="doseNumber" type="number" min="1" max="10" required></label>
        <label>${esc(t('vac.date', 'Date given'))} <input class="anc-field" name="givenDate" type="date" value="${esc(data.today)}" required></label>
        <label>${esc(t('vac.quantity', 'Quantity'))} <input class="anc-field tiny" name="quantity" inputmode="decimal"> <span id="vac-unit"></span></label>
        <label>${esc(t('vac.batch', 'Batch number'))} <input class="anc-field" name="batchNumber" maxlength="80"></label>
        <label>${esc(t('vac.site', 'Injection site'))} <input class="anc-field" name="injectionSite" maxlength="80"></label>
        <label>${esc(t('vac.next', 'Next appointment'))} <input class="anc-field" name="nextAppointment" type="date"></label>
        <label>${esc(t('vac.reaction', 'Reaction'))} <input class="anc-field wide" name="reaction" maxlength="500"></label>
        <div class="anc-actions"><button type="submit">${esc(t('drugSafety.save', 'Save'))}</button></div>
      </form>`;
    const form = $('vac-form');
    const sync = () => {
      const item = data.vaccines.find((line) => String(line.id) === form.elements.vaccineId.value);
      $('vac-unit').textContent = item?.unit || '';
      form.elements.quantity.value = item ? defaultQuantity(item) : '';
      const given = data.history.filter((entry) => item && entry.vaccineName === item.name).map((entry) => entry.doseNumber);
      form.elements.doseNumber.value = item ? String(given.length ? Math.max(...given) + 1 : 1) : '';
    };
    form.elements.vaccineId.addEventListener('change', sync);
    if (form.elements.vaccineId.value) sync();
    form.addEventListener('submit', (event) => { event.preventDefault(); save(form, false); });
  }

  async function save(form, confirmDuplicate) {
    const body = Object.fromEntries(new FormData(form).entries());
    const item = data.vaccines.find((line) => String(line.id) === body.vaccineId);
    try {
      const result = await api('/api/vaccinations', { patientKey, ...body, unit: item?.unit || '', confirmDuplicate });
      data.history = result.history;
      $('vac-status').textContent = t('anc.saved', 'Saved.');
      renderHistory();
      form.reset();
      form.elements.givenDate.value = data.today;
    } catch (error) {
      if (error.body?.duplicate && window.confirm(`${t('vac.duplicate', 'This vaccine and dose number were already given. Record it again?')}`)) return save(form, true);
      $('vac-status').textContent = error.message;
    }
  }

  function renderHistory() {
    const p = data.patient;
    $('vac-patient').innerHTML = `<div class="anc-summary-line"><strong>${esc(p.fullName)}</strong> · ${esc(p.healthId || '')} · ${esc(p.sex || '')} · ${esc(p.age || '')}</div>`;
    $('vac-history').innerHTML = `<h2>${esc(t('vac.card', 'Vaccination card'))}</h2>
      <div class="anc-table-wrap"><table class="anc-table"><thead><tr>
        <th>${esc(t('vac.vaccine', 'Vaccine'))}</th><th>${esc(t('vac.dose', 'Dose number'))}</th><th>${esc(t('vac.date', 'Date given'))}</th>
        <th>${esc(t('vac.batch', 'Batch number'))}</th><th>${esc(t('vac.site', 'Injection site'))}</th><th>${esc(t('vac.next', 'Next appointment'))}</th>
        <th>${esc(t('vac.reaction', 'Reaction'))}</th><th>${esc(t('vac.by', 'Given by'))}</th></tr></thead>
      <tbody>${data.history.map((entry) => `<tr><td>${esc(entry.vaccineName)}</td><td>${esc(entry.doseNumber)}</td><td>${esc(entry.givenDate)}</td><td>${esc(entry.batchNumber)}</td>
        <td>${esc(entry.injectionSite)}</td><td>${esc(entry.nextAppointment)}</td><td>${esc(entry.reaction)}</td><td>${esc(entry.givenBy)}</td></tr>`).join('') || '<tr><td colspan="8">—</td></tr>'}</tbody></table></div>
      <div class="anc-actions no-print"><button type="button" class="secondary" id="vac-print">${esc(t('form.print', 'Print'))}</button></div>`;
    $('vac-print').addEventListener('click', () => window.print());
  }

  async function load() {
    try {
      data = await api(`/api/vaccinations?patientKey=${encodeURIComponent(patientKey)}`);
      const role = String((await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }).then((r) => r.json())).user?.activeRole || '').toUpperCase();
      canWrite = role === 'MIDWIFE';
      renderForm();
      renderHistory();
    } catch (error) { $('vac-status').textContent = error.message; }
  }
  load();
})();
