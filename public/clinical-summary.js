// v41.0 - Medical record editors for the long-term clinical summary:
// - structured allergy record in the IPD Subjective box (slot "structured-allergy");
// - active problem list in the OPD and IPD Assessment boxes (slot "problem-list").
// (Nursing form name / age / sex / code: setAutofillTarget in emr-inpatient-workflow.js.)
// Data and labels come from the nonvisual provider below.
// Every control added here carries data-emr-transient, so it is never saved
// with the record and never shifts the position keys of existing fields.
'use strict';
(function clinicalSummaryProvider() {
  const patient = () => window.getLoadedEmrPatient?.() || null;
  const key = () => patient()?.patientKey || '';
  const role = () => String(window.emrSession?.user?.activeRole || '').toUpperCase();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const khmer = {
    'clinical.remove': 'ដកចេញ', 'clinical.removeReason': 'មូលហេតុនៃការដកចេញ',
    'clinical.confirmRemove': 'បញ្ជាក់ការដកចេញ', 'clinical.removeReasonRequired': 'សូមបញ្ចូលមូលហេតុនៃការដកចេញ។',
    'clinical.unsaved': 'សូមរក្សាទុកកំណត់ត្រាអ្នកជំងឺជាមុនសិន។',
    'clinical.requestError': 'មិនអាចផ្ទៀងផ្ទាត់ព័ត៌មានបាន។ សូមព្យាយាមម្ដងទៀត។',
    'clinical.allergy.type': 'ប្រភេទ', 'clinical.allergy.none': 'មិនទាន់មានកំណត់ត្រាក្នុងបញ្ជីអាលែកហ្ស៊ីនេះទេ។',
    'clinical.allergy.add': 'បន្ថែមប្រតិកម្មអាលែកហ្ស៊ី', 'clinical.allergy.substanceRequired': 'សូមបញ្ចូលសារធាតុ។',
    'clinical.problem.name': 'បញ្ហាសុខភាព', 'clinical.problem.none': 'មិនមានបញ្ហាសុខភាពដែលបានកត់ត្រាថាកំពុងបន្តមានទេ។',
    'clinical.problem.resolved': 'បញ្ហាសុខភាពដែលបានដោះស្រាយ', 'clinical.problem.resolve': 'សម្គាល់ថាបានដោះស្រាយ',
    'clinical.problem.reactivate': 'កំណត់ជាសកម្មឡើងវិញ', 'clinical.problem.add': 'បន្ថែមបញ្ហាសុខភាព',
    'clinical.problem.required': 'សូមបញ្ចូលបញ្ហាសុខភាព។',
    'allergyType.drug': 'ថ្នាំ', 'allergyType.food': 'អាហារ', 'allergyType.other': 'ផ្សេងទៀត',
    'severity.mild': 'ស្រាល', 'severity.moderate': 'មធ្យម', 'severity.severe': 'ធ្ងន់ធ្ងរ',
    'severity.life-threatening': 'គំរាមកំហែងដល់ជីវិត', 'severity.unknown': 'មិនទាន់ដឹង',
  };
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';
  const plainLabel = (name, en, kh) => english() ? en : kh || khmer[name] || window.BORKEO_NEW_TEXT_KH?.[name] || 'មិនអាចបង្ហាញព័ត៌មានបាន';
  let revision = 0;
  let state = { patientKey: '', summary: null, status: 'idle', revision };
  let pending = null;
  const unavailable = () => ({ patientKey: key(), summary: null, status: 'idle', revision });
  const get = () => state.patientKey === key() ? state : unavailable();
  const notify = () => document.dispatchEvent(new CustomEvent('emr:clinical-summary', { detail: get() }));
  const valid = data => Array.isArray(data?.allergies) && Array.isArray(data?.problems)
    && Array.isArray(data?.options?.allergyTypes) && Array.isArray(data?.options?.allergySeverities)
    && ['allergy', 'none', 'not-recorded'].includes(data?.allergyAlert?.state)
    && Array.isArray(data.allergyAlert.items)
    && !(data.allergies.length && data.allergyAlert.state !== 'allergy');
  const matches = (patientKey, token) => key() === patientKey && revision === token;
  const safeError = () => plainLabel('clinical.requestError', 'Information cannot be verified. Please try again.');

  function refresh() {
    const patientKey = key(), token = ++revision;
    state = { patientKey, summary: null, status: patientKey ? 'loading' : 'idle', revision: token };
    pending = null;
    notify();
    if (!patientKey) return Promise.resolve(get());
    const request = (async () => {
      try {
        const response = await fetch(`/api/clinical-summary?patientKey=${encodeURIComponent(patientKey)}`, { credentials: 'same-origin', cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !valid(data)) throw new Error('Unavailable summary');
        if (matches(patientKey, token)) state = { patientKey, summary: data, status: 'ready', revision: token };
      } catch {
        if (matches(patientKey, token)) state = { patientKey, summary: null, status: 'error', revision: token };
      }
      if (matches(patientKey, token)) { pending = null; notify(); }
      return get();
    })();
    pending = request;
    return request;
  }

  async function post(path, body, expected) {
    const current = get();
    if (role() !== 'DOCTOR' || current.status !== 'ready' || !key()
        || expected?.patientKey !== key() || expected?.revision !== revision
        || !/^(?:allergies(?:\/[0-9a-f-]{36}\/remove)?|problems(?:\/[0-9a-f-]{36}\/status)?)$/.test(path)) {
      return { ok: false, error: safeError() };
    }
    const patientKey = key(), token = revision;
    state = { ...current, status: 'saving' };
    notify();
    try {
      const response = await fetch(`/api/clinical-summary/${path}`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.emrSession?.csrfToken || '' },
        body: JSON.stringify({ ...body, patientKey }),
      });
      const data = await response.json();
      if (!matches(patientKey, token)) return { ok: false, stale: true, error: safeError() };
      if (!response.ok || !valid(data)) throw new Error('Unavailable summary');
      // A fresh revision also invalidates handlers retained from a previous render.
      state = { patientKey, summary: data, status: 'ready', revision: ++revision };
      pending = null;
      notify();
      return { ok: true };
    } catch {
      if (matches(patientKey, token)) {
        state = { patientKey, summary: null, status: 'error', revision: ++revision };
        notify();
      }
      return { ok: false, error: safeError() };
    }
  }

  window.EmrClinicalSummary = {
    patient, get, refresh, ready: () => pending || Promise.resolve(get()), post,
    canWrite: () => role() === 'DOCTOR' && get().status === 'ready',
    allergyState: () => get().status === 'ready' ? get().summary.allergyAlert : { state: 'unknown', items: [], freeText: '', ticked: false },
    plainLabel, label: (name, en, kh) => escape(plainLabel(name, en, kh)),
    plainOptionLabel: (group, code) => plainLabel(`${group}.${code}`, code),
    optionLabel: (group, code) => escape(plainLabel(`${group}.${code}`, code)),
  };
  document.addEventListener('emr:patient-loaded', refresh);
  document.addEventListener('emr:patient-saved', refresh);
  document.addEventListener('emr:new-registration-ready', refresh);
  window.addEventListener('emr-session-ready', refresh);
  // Editors below must be installed before a synchronous loading notification.
  window.setTimeout(refresh, 0);
})();
(function () {
  const api = () => window.EmrClinicalSummary;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = (key, en, kh) => api()?.label(key, en, kh) ?? escapeHtml(en);
  const plain = (key, en, kh) => api()?.plainLabel(key, en, kh) ?? en;
  const optionLabel = (group, code) => api()?.optionLabel(group, code) ?? escapeHtml(code);
  const plainOption = (group, code) => api()?.plainOptionLabel(group, code) ?? code;
  const unavailableMessage = () => api()?.patient()?.patientKey
    ? label('clinical.requestError', 'Information cannot be verified. Please try again.')
    : label('clinical.unsaved', 'Please save the patient record first.');
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  // The add / remove forms follow the record: shown to doctors while the record can be edited.
  const canEdit = (slot) => Boolean(api()?.canWrite()) && !window.EmrEncounterEditor?.isReadOnly?.(slot);

  // Read-only encounter status from the existing authorized summary API.
  // No new orders, risk calculations or resuscitation editing are introduced.
  function recordedStatusHtml(summary) {
    const recorded = summary?.resuscitation?.status;
    const value = recorded === 'dnr' ? 'DNR'
      : recorded === 'full' ? label('', 'Full resuscitation', 'សង្គ្រោះជីវិតពេញលេញ')
        : !summary ? unavailableMessage() : label('', 'Not recorded', 'មិនបានបញ្ជាក់');
    const severe = (summary?.allergies || []).filter(entry => ['severe', 'life-threatening'].includes(entry.severity));
    return `<section data-clinical-recorded-status class="clinical-summary-card" aria-live="polite">
      <h4>${label('', 'Resuscitation status', 'ស្ថានភាពការសង្គ្រោះជីវិត')}</h4>
      <p data-clinical-resuscitation${recorded === 'dnr' ? ' class="clinical-recorded-warning" role="alert"' : ''}>${value}</p>
      ${recorded === 'dnr' || severe.length ? `<h4>${label('', 'Risk flags', 'សញ្ញាហានិភ័យ')}</h4>
        <ul data-clinical-recorded-risks class="clinical-recorded-warning">${recorded === 'dnr' ? '<li>DNR</li>' : ''}${severe.map(entry => `<li>${escapeHtml(entry.substance)} (${optionLabel('severity', entry.severity)})</li>`).join('')}</ul>` : ''}
    </section>`;
  }

  function current() {
    const state = api()?.get();
    const patient = api()?.patient();
    if (!state || !patient || state.patientKey !== patient.patientKey) return null;
    return state.summary;
  }

  function message(slot, text) {
    const box = slot.querySelector('[data-clinical-message]');
    if (box) box.textContent = text || '';
  }

  async function submit(slot, button, path, body) {
    if (!canEdit(slot) || !slot.contains(button)) return;
    const expected = { patientKey: slot.dataset.summaryPatientKey, revision: Number(slot.dataset.summaryRevision) };
    button.disabled = true;
    message(slot, '');
    const result = await api().post(path, body, expected);
    if (!result.ok && slot.dataset.summaryPatientKey === expected.patientKey && Number(slot.dataset.summaryRevision) === expected.revision) {
      button.disabled = false;
      message(slot, result.error);
    }
    // On success the summary event re-renders every slot.
  }

  // ---- Structured allergy record (IPD S box)
  function renderAllergies(slot, summary) {
    const editable = canEdit(slot);
    const allergies = summary?.allergies || [];
    const options = summary?.options || { allergyTypes: [], allergySeverities: [] };
    const rows = allergies.map((a) => `<tr>
        <td>${optionLabel('allergyType', a.allergyType)}</td>
        <td><strong>${escapeHtml(a.substance)}</strong></td>
        <td>${escapeHtml(a.reaction || '—')}</td>
        <td>${a.severity ? optionLabel('severity', a.severity) : '—'}</td>
        <td>${escapeHtml(a.notedOn || '—')}</td>
        <td>${escapeHtml(a.recordedBy || '—')}</td>
        ${editable ? `<td class="clinical-actions">
          <button type="button" class="clinical-button secondary" data-allergy-remove="${escapeHtml(a.id)}">${label('clinical.remove', 'Remove')}</button>
          <span class="clinical-remove-form" data-required-island data-allergy-remove-form="${escapeHtml(a.id)}" hidden>
            <input type="text" data-emr-transient maxlength="300" data-allergy-remove-reason aria-label="${escapeHtml(plain('clinical.removeReason', 'Reason for removing'))}" placeholder="${escapeHtml(plain('clinical.removeReason', 'Reason for removing'))}">
            <button type="button" class="clinical-button danger" data-allergy-remove-confirm="${escapeHtml(a.id)}">${label('clinical.confirmRemove', 'Confirm remove')}</button>
          </span>
        </td>` : ''}
      </tr>`).join('');
    slot.innerHTML = recordedStatusHtml(summary) + `
      <div class="clinical-summary-card clinical-allergy-card">
        <h4 class="clinical-summary-title">${label('', 'Structured allergy record', 'កំណត់ត្រាប្រតិកម្មអាលែកហ្ស៊ី')}</h4>
        ${!summary ? `<p class="clinical-empty">${unavailableMessage()}</p>` : rows ? `<div class="clinical-table-wrap"><table class="clinical-table">
          <thead><tr>
            <th>${label('clinical.allergy.type', 'Type')}</th><th>${label('', 'Substance', 'សារធាតុ')}</th><th>${label('', 'Reaction', 'ប្រតិកម្ម')}</th>
            <th>${label('', 'Severity', 'កម្រិតធ្ងន់ធ្ងរ')}</th><th>${label('', 'Date', 'កាលបរិច្ឆេទ')}</th><th>${label('', 'Recorded by', 'អ្នកកត់ត្រា')}</th>${editable ? '<th></th>' : ''}
        </tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="clinical-empty">${label('clinical.allergy.none', 'No entries have been recorded in this allergy list yet.')}</p>`}
        ${summary && editable ? `<div class="clinical-add-form" data-required-island data-allergy-add-form>
          <label><span>${label('clinical.allergy.type', 'Type')}</span>
            <select data-emr-transient data-allergy-field="allergyType">${options.allergyTypes.map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(plainOption('allergyType', code))}</option>`).join('')}</select></label>
          <label class="wide"><span>${label('', 'Substance', 'សារធាតុ')}</span>
            <input type="text" data-emr-transient data-allergy-field="substance" maxlength="200" required></label>
          <label class="wide"><span>${label('', 'Reaction', 'ប្រតិកម្ម')}</span>
            <input type="text" data-emr-transient data-allergy-field="reaction" maxlength="500"></label>
          <label><span>${label('', 'Severity', 'កម្រិតធ្ងន់ធ្ងរ')}</span>
            <select data-emr-transient data-allergy-field="severity"><option value=""></option>${options.allergySeverities.map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(plainOption('severity', code))}</option>`).join('')}</select></label>
          <label><span>${label('', 'Date', 'កាលបរិច្ឆេទ')}</span>
            <input type="date" data-emr-transient data-allergy-field="notedOn" value="${today()}" max="${today()}"></label>
          <button type="button" class="clinical-button" data-allergy-add>${label('clinical.allergy.add', 'Add allergy')}</button>
        </div>` : ''}
        <p class="clinical-message" data-clinical-message role="status"></p>
      </div>`;
    slot.querySelector('[data-allergy-add]')?.addEventListener('click', (event) => {
      const value = (name) => slot.querySelector(`[data-allergy-field="${name}"]`)?.value.trim() || '';
      if (!value('substance')) { message(slot, plain('clinical.allergy.substanceRequired', 'Enter the substance.')); slot.querySelector('[data-allergy-field="substance"]')?.focus(); return; }
      submit(slot, event.currentTarget, 'allergies', {
        allergyType: value('allergyType'), substance: value('substance'), reaction: value('reaction'), severity: value('severity'), notedOn: value('notedOn'),
      });
    });
    slot.querySelectorAll('[data-allergy-remove]').forEach((button) => button.addEventListener('click', () => {
      const form = slot.querySelector(`[data-allergy-remove-form="${CSS.escape(button.dataset.allergyRemove)}"]`);
      if (!form) return;
      form.hidden = false;
      button.hidden = true;
      form.querySelector('input')?.focus();
    }));
    slot.querySelectorAll('[data-allergy-remove-confirm]').forEach((button) => button.addEventListener('click', () => {
      const reason = button.parentElement.querySelector('[data-allergy-remove-reason]')?.value.trim() || '';
      if (!reason) { message(slot, plain('clinical.removeReasonRequired', 'Enter the reason for removing.')); return; }
      submit(slot, button, `allergies/${button.dataset.allergyRemoveConfirm}/remove`, { reason });
    }));
  }

  // ---- Active problem list (OPD and IPD A boxes)
  function renderProblems(slot, summary) {
    const editable = canEdit(slot);
    const problems = summary?.problems || [];
    const active = problems.filter((p) => p.status === 'active');
    const resolved = problems.filter((p) => p.status === 'resolved');
    const item = (p, nextStatus, buttonKey, buttonText) => `<li>
        <span class="clinical-problem-text"><strong>${escapeHtml(p.problem)}</strong>${p.icd10 ? ` <span class="clinical-code">${escapeHtml(p.icd10)}</span>` : ''}${p.notedOn ? ` · ${escapeHtml(p.notedOn)}` : ''} · ${escapeHtml(p.recordedBy || '')}</span>
        ${editable ? `<button type="button" class="clinical-button secondary" data-problem-status="${escapeHtml(p.id)}" data-next-status="${nextStatus}">${label(buttonKey, buttonText)}</button>` : ''}
      </li>`;
    slot.innerHTML = `
      <div class="clinical-summary-card clinical-problem-card">
        <h4 class="clinical-summary-title">${label('', 'Active problem list', 'បញ្ជីបញ្ហាសុខភាពកំពុងជួបប្រទះ')}</h4>
        ${!summary ? `<p class="clinical-empty">${unavailableMessage()}</p>`
          : active.length ? `<ul class="clinical-problem-list">${active.map((p) => item(p, 'resolved', 'clinical.problem.resolve', 'Mark resolved')).join('')}</ul>`
            : `<p class="clinical-empty">${label('clinical.problem.none', 'No health problems are recorded as ongoing.')}</p>`}
        ${resolved.length ? `<details class="clinical-resolved"><summary>${label('clinical.problem.resolved', 'Resolved problems')} (${resolved.length})</summary>
          <ul class="clinical-problem-list">${resolved.map((p) => item(p, 'active', 'clinical.problem.reactivate', 'Make active again')).join('')}</ul></details>` : ''}
        ${summary && editable ? `<div class="clinical-add-form" data-required-island data-problem-add-form>
          <label class="wide"><span>${label('clinical.problem.name', 'Problem')}</span>
            <input type="text" data-emr-transient data-problem-field="problem" maxlength="300" required></label>
          <label><span>ICD-10</span>
            <input type="text" data-emr-transient data-problem-field="icd10" maxlength="20" pattern="[A-Za-z][0-9]{2}(\\.[0-9A-Za-z]{1,4})?" placeholder="E11"></label>
          <label><span>${label('', 'Date', 'កាលបរិច្ឆេទ')}</span>
            <input type="date" data-emr-transient data-problem-field="notedOn" max="${today()}"></label>
          <button type="button" class="clinical-button" data-problem-add>${label('clinical.problem.add', 'Add problem')}</button>
        </div>` : ''}
        <p class="clinical-message" data-clinical-message role="status"></p>
      </div>`;
    slot.querySelector('[data-problem-add]')?.addEventListener('click', (event) => {
      const value = (name) => slot.querySelector(`[data-problem-field="${name}"]`)?.value.trim() || '';
      if (!value('problem')) { message(slot, plain('clinical.problem.required', 'Enter the problem.')); slot.querySelector('[data-problem-field="problem"]')?.focus(); return; }
      submit(slot, event.currentTarget, 'problems', { problem: value('problem'), icd10: value('icd10'), notedOn: value('notedOn') });
    });
    slot.querySelectorAll('[data-problem-status]').forEach((button) => button.addEventListener('click', () => {
      submit(slot, button, `problems/${button.dataset.problemStatus}/status`, { status: button.dataset.nextStatus });
    }));
  }

  function renderSlots() {
    const summary = current();
    document.querySelectorAll('[data-soap-slot="structured-allergy"], [data-soap-slot="problem-list"]').forEach(slot => {
      slot.dataset.summaryPatientKey = api()?.get().patientKey || '';
      slot.dataset.summaryRevision = String(api()?.get().revision || 0);
    });
    document.querySelectorAll('[data-soap-slot="structured-allergy"]').forEach((slot) => {
      slot.hidden = false;
      slot.classList.add('clinical-summary-slot');
      renderAllergies(slot, summary);
    });
    document.querySelectorAll('[data-soap-slot="problem-list"]').forEach((slot) => {
      slot.hidden = false;
      slot.classList.add('clinical-summary-slot');
      renderProblems(slot, summary);
    });
    if (api()?.patient()?.patientKey && !['ready', 'saving'].includes(api()?.get().status)) {
      document.querySelectorAll('[data-soap-slot="structured-allergy"], [data-soap-slot="problem-list"]').forEach(slot => {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = plain('', 'Reload', 'ផ្ទុកឡើងវិញ');
        retry.addEventListener('click', () => api()?.refresh());
        slot.append(retry);
      });
    }
  }

  function refresh() {
    renderSlots();
  }

  document.addEventListener('emr:clinical-summary', refresh);
  // Runs after the record values are restored on load and after a save.
  document.addEventListener('emr:patient-loaded', () => window.setTimeout(refresh, 0));
  window.addEventListener('emr-session-ready', renderSlots);
  window.addEventListener('borkeo-language-change', refresh);
  // The record edit / view switch changes whether the add forms are shown.
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-editor-toggle], [data-editor-cancel]')) window.setTimeout(renderSlots, 50);
  });
  window.EmrClinicalSummaryEditors = { refresh };
})();
