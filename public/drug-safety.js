// v41.2 - Drug interaction and maximum-dose tables (GET /api/drug-safety;
// administrators add and delete rows). The prescribing warnings read them.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en';
  const t = (key, en) => (english() || !window.newTextHtml ? escapeHtml(en) : window.newTextHtml(key, en));
  let tables = { interactions: [], maxDoses: [], canEdit: false };

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

  function render() {
    const empty = (cols) => `<tr><td colspan="${cols}" class="ds-empty">${t('drugSafety.empty', 'No entries yet.')}</td></tr>`;
    const del = (table, id) => (tables.canEdit ? `<td><button type="button" class="ds-delete" data-delete="${table}" data-id="${escapeHtml(id)}">${t('drugSafety.delete', 'Delete')}</button></td>` : '');
    $('ds-interactions').innerHTML = `<thead><tr><th>${t('drugSafety.drugA', 'Medicine A')}</th><th>${t('drugSafety.drugB', 'Medicine B')}</th><th>${t('drugSafety.severity', 'Severity')}</th><th>${t('drugSafety.note', 'Note')}</th>${tables.canEdit ? '<th></th>' : ''}</tr></thead>
      <tbody>${tables.interactions.map((row) => `<tr><td>${escapeHtml(row.drugA)}</td><td>${escapeHtml(row.drugB)}</td><td>${escapeHtml(row.severity)}</td><td>${escapeHtml(row.note)}</td>${del('interactions', row.id)}</tr>`).join('') || empty(5)}</tbody>`;
    $('ds-max-doses').innerHTML = `<thead><tr><th>${t('drugSafety.drug', 'Medicine')}</th><th>${t('drugSafety.maxPerDose', 'Maximum per dose')}</th><th>${t('drugSafety.maxPerDay', 'Maximum per day')}</th><th>${t('drugSafety.unit', 'Unit')}</th><th>${t('drugSafety.note', 'Note')}</th>${tables.canEdit ? '<th></th>' : ''}</tr></thead>
      <tbody>${tables.maxDoses.map((row) => `<tr><td>${escapeHtml(row.drug)}</td><td>${escapeHtml(row.maxPerDose ?? '')}</td><td>${escapeHtml(row.maxPerDay ?? '')}</td><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.note)}</td>${del('max-doses', row.id)}</tr>`).join('') || empty(6)}</tbody>`;
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

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-delete]');
    if (button) run(() => api(`/api/drug-safety/${button.dataset.delete}/${button.dataset.id}/delete`, {}));
  });
  bindForm($('ds-interaction-form'), '/api/drug-safety/interactions');
  bindForm($('ds-max-form'), '/api/drug-safety/max-doses');
  run(() => api('/api/drug-safety'));
})();
