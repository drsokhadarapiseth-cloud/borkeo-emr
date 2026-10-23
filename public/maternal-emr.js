// v42.6 - Maternal services on the medical record page (EMR.html):
// - the old ANC form (#sub_anc) is read-only (inert); the official ANC record
//   (/anc-record) replaces it;
// - the midwife's medicine search shows only the medicines of the maternal
//   services (public/medicine-autocomplete.js BorkeoMedicineAllowedNames);
// - cervical screening: the midwife sends the result to the Gynecology ward
//   doctors' inbox (POST /api/maternal/cervix-result); the doctor's
//   acknowledgement completes the message.
// The send button carries data-required-bypass: its label contains ផ្ញើ, so
// emr-required-fields.js would otherwise read it as a record save and validate
// every required field of the whole OPD tab before the click. This panel saves
// nothing into the record (its fields are data-emr-transient); it checks its own
// result field in sendCervix, and the server checks the role.
'use strict';
(function () {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en';
  const t = (key, en) => (english() ? en : (window.newText ? window.newText(key, en) : en));
  const role = () => String(window.emrSession?.user?.activeRole || '').toUpperCase();
  const patient = () => window.getLoadedEmrPatient?.() || null;
  let options = null;

  async function loadOptions() {
    if (options) return options;
    const response = await fetch('/api/maternal/config', { credentials: 'same-origin', cache: 'no-store' });
    options = response.ok ? (await response.json()).options : {};
    return options;
  }

  // The old ANC form opens read-only (saved values stay visible).
  function oldAncReadOnly() {
    const panel = document.getElementById('sub_anc');
    if (!panel || panel.dataset.readOnly === '1') return;
    panel.dataset.readOnly = '1';
    // inert: nothing can be typed or ticked, and the saved values are still read
    // and saved unchanged with the record (disabled controls could be skipped).
    panel.inert = true;
    panel.setAttribute('data-anc-old-readonly', '');
    const notice = document.createElement('p');
    notice.className = 'anc-old-notice no-print';
    const key = patient()?.patientKey || new URLSearchParams(window.location.search).get('patient') || '';
    notice.innerHTML = `${esc(t('anc.oldForm', 'Old ANC form (read only). Use the official ANC record.'))} ${key ? `<a href="/anc-record?patient=${encodeURIComponent(key)}">${esc(t('anc.open', 'Open the ANC record'))}</a>` : ''}`;
    panel.insertAdjacentElement('beforebegin', notice);
  }

  async function midwifeMedicines() {
    const current = patient();
    const service = String(current?.departmentCode || '').toLowerCase();
    if (role() !== 'MIDWIFE' || current?.serviceMode !== 'opd') { delete window.BorkeoMedicineAllowedNames; return; }
    const settings = await loadOptions();
    if (![...(settings.paidServiceCodes || []), ...(settings.freeServiceCodes || [])].includes(service)) return;
    const names = (settings.midwifeMedicines || []).map((name) => name.toLowerCase());
    window.BorkeoMedicineAllowedNames = () => names;
  }

  // Cervical screening result panel for the midwife.
  function cervixPanel() {
    const current = patient();
    if (role() !== 'MIDWIFE' || String(current?.departmentCode || '').toLowerCase() !== 'cervix-screening') return;
    const host = document.getElementById('opd-specialty-panels') || document.getElementById('sub_opd');
    if (!host || document.getElementById('cervix-result-panel')) return;
    const panel = document.createElement('section');
    panel.id = 'cervix-result-panel';
    panel.className = 'cervix-result-panel no-print';
    const results = [['negative', t('cervix.negative', 'VIA negative')], ['positive', t('cervix.positive', 'VIA positive')], ['suspect', t('cervix.suspect', 'Suspected cancer')]];
    panel.innerHTML = `<h3>${esc(t('cervix.title', 'Screening result for the Gynecology doctor'))}</h3>
      <label>${esc(t('cervix.result', 'Result'))} <select id="cervix-result" data-emr-transient><option value=""></option>${results.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}</select></label>
      <label>${esc(t('cervix.note', 'Note'))} <input id="cervix-note" type="text" maxlength="500" data-emr-transient></label>
      <button type="button" id="cervix-send" data-required-bypass>${esc(t('cervix.send', 'Send to the Gynecology doctors'))}</button>
      <span id="cervix-status" role="status"></span>`;
    host.prepend(panel);
    panel.querySelector('#cervix-send').addEventListener('click', sendCervix);
  }

  async function sendCervix() {
    const select = document.getElementById('cervix-result');
    const status = document.getElementById('cervix-status');
    if (!select?.value) { status.textContent = t('cervix.choose', 'Choose the result.'); return; }
    try {
      const me = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }).then((r) => r.json());
      const response = await fetch('/api/maternal/cervix-result', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken },
        body: JSON.stringify({ patientKey: patient()?.patientKey, result: select.selectedOptions[0].textContent, note: document.getElementById('cervix-note').value }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || String(response.status));
      status.textContent = t('cervix.sent', 'Sent to the Gynecology doctors.');
      select.dataset.sent = select.value;
    } catch (error) { status.textContent = error.message; }
  }

  // Saving the record also sends a chosen result that was not sent yet.
  document.addEventListener('emr:patient-saved', () => {
    const select = document.getElementById('cervix-result');
    if (select?.value && select.dataset.sent !== select.value) sendCervix();
  });

  function apply() {
    oldAncReadOnly();
    midwifeMedicines().catch(() => {});
    cervixPanel();
  }
  document.addEventListener('emr:patient-loaded', () => window.setTimeout(apply, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', oldAncReadOnly, { once: true });
  else oldAncReadOnly();
  window.EmrMaternal = { apply, oldAncReadOnly, sendCervix };
})();
