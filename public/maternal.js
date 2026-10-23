// v42.6 - Maternal services queue (GET /api/maternal/queue). The call button
// calls the patient on the OPD board, then opens the right form: the official
// ANC record, the vaccination form, or the OPD form (PNC, family planning,
// cervical screening, safe abortion).
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en';
  const kind = new URLSearchParams(window.location.search).get('kind') === 'gynecology' ? 'gynecology' : 'midwife';
  let rows = [];
  let csrf = '';

  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  function render() {
    const query = $('queue-search').value.trim().toLocaleLowerCase();
    const shown = rows.filter((item) => !query || [item.fullName, item.caseNumber, item.healthId, String(item.number)].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
    $('queue-count').textContent = english() ? `${rows.length} patients` : `សរុប ${rows.length} នាក់`;
    $('queue-rows').innerHTML = shown.map((item) => `<tr data-service="${esc(item.departmentCode)}"><td><span class="queue-number">${esc(item.number)}</span></td>
      <td class="queue-patient"><strong data-patient-value>${esc(item.fullName)}</strong></td><td>${esc(item.sex || '—')}</td><td>${esc(item.age || '—')}</td>
      <td>${esc(item.phone || '—')}</td><td>${esc(item.healthId || '—')}</td><td>${esc(item.paymentType || '—')}</td><td>${esc(item.departmentNameKh || item.departmentCode)}</td>
      <td><a class="queue-action" data-patient="${esc(item.patientKey)}" data-queue-number="${esc(item.number)}" href="${esc(item.form)}">ហៅ</a></td></tr>`).join('')
      || `<tr><td colspan="9">${english() ? 'No patient waiting.' : 'មិនមានអ្នកជំងឺរង់ចាំទេ។'}</td></tr>`;
  }

  async function load() {
    try {
      const response = await fetch(`/api/maternal/queue?kind=${kind}&date=${encodeURIComponent($('queue-date').value)}`, { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || String(response.status));
      rows = data.patients || [];
      $('queue-status').textContent = '';
      render();
    } catch (error) { $('queue-status').textContent = error.message; }
  }

  async function call(patientKey, queueNumber) {
    if (!csrf) csrf = (await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }).then((r) => r.json())).csrfToken;
    const response = await fetch('/api/queue/call', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ service: 'OPD', counter: $('opd-counter').value, patientKey, queueNumber }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || String(response.status));
  }

  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a.queue-action');
    if (!link) return;
    event.preventDefault();
    link.setAttribute('aria-disabled', 'true');
    try { await call(link.dataset.patient, Number(link.dataset.queueNumber || 0)); } catch (error) { $('queue-status').textContent = error.message; }
    window.location.assign(link.href);
  });

  if (kind === 'gynecology') { $('maternal-title').textContent = 'រំលូតកូនដោយសុវត្ថិភាព'; document.title = ['រំលូតកូនដោយសុវត្ថិភាព', 'Borkeo EMR'].join(' · '); }
  $('queue-date').value = today();
  $('queue-date').onchange = load;
  $('queue-search').oninput = render;
  $('queue-refresh').onclick = load;
  load();
  setInterval(load, 10000);
})();
