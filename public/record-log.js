// v41.7 - Record view log viewer (GET /api/record-access-log; Admin and Directors).
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en';
  const labels = {
    'recordLog.intro': ['Who opened, printed or exported a patient record, and when.', 'កំណត់ត្រាអ្នកបើកមើលឯកសារ'],
    'recordLog.patient': ['Patient (code or name)', 'អ្នកជំងឺ (លេខកូដ ឬឈ្មោះ)'],
    'recordLog.user': ['Staff (username or name)', 'បុគ្គលិក (គណនី ឬឈ្មោះ)'],
    'recordLog.action': ['Action', 'សកម្មភាព'], 'recordLog.open': ['Opened', 'បើកមើល'],
    'recordLog.print': ['Printed', 'បោះពុម្ព'], 'recordLog.export': ['Exported', 'នាំចេញ'],
    'recordLog.document': ['Scanned document opened', 'បើកមើលឯកសារស្កេន'],
    'recordLog.from': ['From', 'ចាប់ពី'], 'recordLog.to': ['To', 'ដល់'], 'recordLog.search': ['Search', 'ស្វែងរក'],
    'recordLog.time': ['Time', 'កាលបរិច្ឆេទ និងម៉ោង'], 'recordLog.what': ['What', 'ព័ត៌មានលម្អិត'],
    'recordLog.empty': ['No entries for this search.', 'មិនទាន់មានទិន្នន័យ។'],
  };
  const t = (key, en) => escapeHtml(english() ? labels[key]?.[0] || en : labels[key]?.[1] || 'មិនអាចបង្ហាញព័ត៌មានបាន');
  const translate = () => document.querySelectorAll('[data-record-log-text]').forEach(node => {
    const key = node.dataset.recordLogText;
    if (labels[key]) node.textContent = labels[key][english() ? 0 : 1];
  });
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
    } catch {
      $('rl-table').innerHTML = '';
      $('ds-status').textContent = english() ? 'Information cannot be verified. Please try again.' : 'មិនអាចផ្ទៀងផ្ទាត់ព័ត៌មានបាន។ សូមព្យាយាមម្ដងទៀត។';
    }
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
  window.addEventListener('borkeo-language-change', () => { translate(); search(); });
  translate();
  search();
})();
