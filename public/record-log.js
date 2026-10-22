// v41.7 - Record view log viewer (GET /api/record-access-log; Admin and Directors).
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en';
  const t = (key, en) => (english() || !window.newTextHtml ? escapeHtml(en) : window.newTextHtml(key, en));
  const ACTIONS = { open: 'Opened', print: 'Printed', export: 'Exported', document: 'Scanned document opened' };

  async function search() {
    const form = $('rl-filters');
    const query = new URLSearchParams(Object.fromEntries(new FormData(form).entries()));
    $('ds-status').textContent = '';
    try {
      const response = await fetch(`/api/record-access-log?${query}`, { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || String(response.status));
      render(result.entries || []);
    } catch (error) { $('ds-status').textContent = error.message; }
  }

  function render(entries) {
    $('rl-table').innerHTML = `<thead><tr><th>${t('recordLog.time', 'Time')}</th><th>${t('recordLog.user', 'Staff (username or name)')}</th>
      <th>${t('recordLog.action', 'Action')}</th><th>${t('recordLog.patient', 'Patient (code or name)')}</th><th>${t('recordLog.what', 'What')}</th><th>IP</th></tr></thead>
      <tbody>${entries.map((e) => `<tr><td>${escapeHtml(new Date(e.at).toLocaleString())}</td>
        <td>${escapeHtml(e.displayName || e.username)}<br><small>${escapeHtml([e.username, e.role, e.ward].filter(Boolean).join(' · '))}</small></td>
        <td>${t(`recordLog.${e.action}`, ACTIONS[e.action] || e.action)}</td>
        <td>${escapeHtml(e.patientName)}<br><small>${escapeHtml(e.patientKey)}</small></td>
        <td>${escapeHtml(e.detail)}</td><td>${escapeHtml(e.ip)}</td></tr>`).join('')
        || `<tr><td colspan="6" class="ds-empty">${t('recordLog.empty', 'No entries for this search.')}</td></tr>`}</tbody>`;
  }

  $('rl-filters').addEventListener('submit', (event) => { event.preventDefault(); search(); });
  search();
})();
