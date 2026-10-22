// v41.7 - Scanned documents attached to the patient record (/api/patient-documents).
// PDF / JPG / PNG up to 10 MB; the server checks the real file type. A button
// next to the forms button (.periop-launcher) opens the list. Opening a file is
// logged in the record view log; removing keeps the file and needs a reason.
// Every control here is data-emr-transient (never saved with the record).
'use strict';
(function () {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';
  const label = (key, en, kh) => (english() ? escapeHtml(en) : kh ? escapeHtml(kh) : window.newTextHtml ? window.newTextHtml(key, en) : escapeHtml(en));
  const plain = (key, en, kh) => (english() ? en : kh || (window.newText ? window.newText(key, en) : en));
  const TITLE = { en: 'Attach scanned documents', kh: 'ភ្ជាប់ឯកសារស្កេន' }; // approved Khmer (RULE 2)
  const CATEGORIES = { referral: 'Referral letter', lab: 'Laboratory result', imaging: 'Imaging report', consent: 'Signed consent', identity: 'Identity document', other: 'Other' };
  const patientKey = () => window.getLoadedEmrPatient?.()?.patientKey || '';
  let documents = [];
  let canUpload = false;

  async function load() {
    const key = patientKey();
    if (!key) return;
    try {
      const response = await fetch(`/api/patient-documents?patientKey=${encodeURIComponent(key)}`, { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      documents = response.ok ? result.documents || [] : [];
      canUpload = response.ok && result.canUpload === true;
    } catch { documents = []; }
    render();
    labelButtons();
  }

  function dialog() {
    let node = document.getElementById('patient-documents-dialog');
    if (!node) {
      node = document.createElement('dialog');
      node.id = 'patient-documents-dialog';
      node.className = 'docs-dialog';
      document.body.appendChild(node);
    }
    return node;
  }

  const size = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

  function render() {
    const node = document.getElementById('patient-documents-dialog');
    if (!node?.open) return;
    const active = documents.filter((d) => !d.removedAt);
    const removed = documents.filter((d) => d.removedAt);
    const row = (d) => `<tr class="${d.removedAt ? 'docs-removed' : ''}">
        <td><strong>${escapeHtml(d.title)}</strong><br><span class="docs-file">${escapeHtml(d.filename)} · ${escapeHtml(size(d.sizeBytes))}</span></td>
        <td>${label(`docs.category.${d.category}`, CATEGORIES[d.category] || d.category)}</td>
        <td>${escapeHtml(new Date(d.uploadedAt).toLocaleString())}<br>${escapeHtml(d.uploadedBy)}</td>
        <td class="docs-actions">${d.removedAt ? `${label('docs.removed', 'Removed:')} ${escapeHtml(d.removeReason || '')} · ${escapeHtml(d.removedBy || '')}`
          : `<a class="docs-button" href="/api/patient-documents/${escapeHtml(d.id)}/file" target="_blank" rel="noopener">${label('docs.view', 'Open')}</a>
             ${canUpload ? `<button type="button" class="docs-button" data-docs-remove="${escapeHtml(d.id)}">${label('docs.remove', 'Remove')}</button>` : ''}`}</td>
      </tr>`;
    node.innerHTML = `<div class="docs-body">
      <header class="docs-head"><h3>${label('', TITLE.en, TITLE.kh)}</h3>
        <button type="button" class="docs-button" data-docs-close>${label('forms.close', 'Close')}</button></header>
      ${canUpload ? `<form class="docs-upload" data-docs-upload>
        <label class="docs-field wide"><span>${label('docs.title', 'Title')}</span><input type="text" data-emr-transient name="title" maxlength="200" required></label>
        <label class="docs-field"><span>${label('docs.category', 'Kind of document')}</span><select data-emr-transient name="category">
          ${Object.keys(CATEGORIES).map((c) => `<option value="${c}">${escapeHtml(plain(`docs.category.${c}`, CATEGORIES[c]))}</option>`).join('')}</select></label>
        <label class="docs-field wide"><span>${label('docs.file', 'File (PDF, JPG or PNG, up to 10 MB)')}</span>
          <input type="file" data-emr-transient name="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required></label>
        <button type="submit" class="docs-button primary">${label('docs.upload', 'Attach')}</button>
      </form>` : ''}
      <p class="docs-message" role="status"></p>
      ${active.length || removed.length ? `<div class="docs-table-wrap"><table class="docs-table"><tbody>${active.map(row).join('')}${removed.map(row).join('')}</tbody></table></div>`
        : `<p class="docs-empty">${label('docs.empty', 'No scanned documents yet.')}</p>`}
    </div>`;
    node.querySelector('[data-docs-close]').addEventListener('click', () => node.close());
    node.querySelector('[data-docs-upload]')?.addEventListener('submit', upload);
    node.querySelectorAll('[data-docs-remove]').forEach((button) => button.addEventListener('click', () => remove(button.dataset.docsRemove)));
  }

  const message = (text) => { const box = document.querySelector('#patient-documents-dialog .docs-message'); if (box) box.textContent = text || ''; };

  async function upload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.file.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { message(plain('docs.tooLarge', 'The file is larger than 10 MB.')); return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const query = new URLSearchParams({ patientKey: patientKey(), title: form.elements.title.value.trim(), category: form.elements.category.value });
    try {
      const response = await fetch(`/api/patient-documents?${query}`, {
        method: 'POST', credentials: 'same-origin', body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name), 'X-CSRF-Token': window.emrSession?.csrfToken || '' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || String(response.status));
      documents = result.documents || documents;
      render();
      message(plain('forms.savedMessage', 'Saved.'));
    } catch (error) { button.disabled = false; message(error.message); }
    labelButtons();
  }

  async function remove(id) {
    const reason = window.prompt(plain('docs.removeReason', 'Reason for removing'));
    if (!reason || !reason.trim()) return;
    try {
      const response = await fetch(`/api/patient-documents/${id}/remove`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.emrSession?.csrfToken || '' },
        body: JSON.stringify({ patientKey: patientKey(), reason: reason.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || String(response.status));
      documents = result.documents || documents;
      render();
    } catch (error) { message(error.message); }
    labelButtons();
  }

  // A button next to the forms button in the OPD, IPD and nursing records.
  function ensureButtons() {
    document.querySelectorAll('.periop-launcher').forEach((bar) => {
      if (bar.querySelector('[data-docs-open]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'periop-button';
      button.dataset.docsOpen = '';
      bar.appendChild(button);
    });
    labelButtons();
  }
  function labelButtons() {
    const count = documents.filter((d) => !d.removedAt).length;
    document.querySelectorAll('[data-docs-open]').forEach((button) => {
      button.innerHTML = `<i class="fa-solid fa-paperclip" aria-hidden="true"></i> ${label('', TITLE.en, TITLE.kh)}${count ? ` (${count})` : ''}`;
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-docs-open]')) return;
    const node = dialog();
    if (!node.open) node.showModal();
    render();
    load();
  });
  // The forms buttons are drawn after the record loads (periop-forms.js).
  document.addEventListener('emr:patient-loaded', () => window.setTimeout(() => { ensureButtons(); load(); }, 50));
  window.addEventListener('borkeo-language-change', () => { labelButtons(); render(); });
  window.EmrPatientDocuments = { load, ensureButtons };
})();
