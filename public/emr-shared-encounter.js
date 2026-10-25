'use strict';
(function sharedEncounter() {
  const pairs = { opd_weight: 'p2_weight', opd_height: 'p2_height', opd_temp: 'p2_temp', opd_bp_sys: 'p2_bp_sys', opd_bp_dia: 'p2_bp_dia', opd_pulse: 'p2_pulse', opd_resp: 'p2_resp', opd_spo2: 'p2_spo2' };
  const dirty = new Map();
  let home = null, sharedHost = null, ready = false;
  const isOpd = () => ['opd', 'opd-paraclinic'].includes(document.body.dataset.encounterView);
  const doctor = () => ['DOCTOR', 'CHIEF_WARD', 'WARD_HEAD', 'ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(window.emrSession?.user?.activeRole);
  const writable = () => ready && document.body.dataset.encounterView === 'opd' && doctor() && window.EmrEncounterEditor?.canWrite() === true &&
    (['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(window.emrSession?.user?.activeRole) || ['DOCTOR_READY', 'IN_CONSULTATION'].includes(window.getLoadedEmrPatient?.()?.workflowStage));
  function apply() {
    if (!window.getLoadedEmrPatient?.()) return;
    const widget = document.getElementById('chief_complaint_tag_box');
    const dropdown = document.getElementById('chief_complaint_dropdown');
    if (widget && dropdown) {
      if (!home) { home = document.createComment('shared chief complaint home'); widget.before(home); }
      if (isOpd()) {
        const subjective = document.querySelector('#sub_opd [data-soap-record-box="s"]');
        if (subjective && !sharedHost) {
          sharedHost = document.createElement('div'); sharedHost.className = 'opd-shared-complaint';
          const label = document.createElement('label'); label.textContent = 'សញ្ញាតម្អូញចម្បង'; label.htmlFor = widget.id;
          const printed = document.createElement('span'); printed.className = 'opd-shared-complaint-print';
          sharedHost.append(label, printed); subjective.querySelector('.emr-soap-header')?.after(sharedHost);
        }
        if (sharedHost && widget.parentElement !== sharedHost) sharedHost.append(widget, dropdown);
      } else if (home.parentElement && widget.parentElement === sharedHost) home.after(widget, dropdown);
    }
    const resp = document.getElementById('opd_resp');
    if (resp && !document.getElementById('opd_spo2')) {
      const label = document.createElement('label'); label.textContent = ' SpO2 ';
      const input = document.createElement('input'); input.id = 'opd_spo2'; input.type = 'text'; input.className = 'fill-blank';
      input.setAttribute('data-emr-transient', ''); input.setAttribute('data-emr-no-auto-index', ''); input.style.width = '60px';
      label.append(input); resp.parentElement.append(label);
    }
    for (const [targetId, sourceId] of Object.entries(pairs)) {
      const target = document.getElementById(targetId), source = document.getElementById(sourceId);
      if (!target || !source) continue;
      target.dataset.sharedTriageId = sourceId;
      target.readOnly = !writable();
      if (!dirty.has(sourceId)) target.value = source.value;
      if (!target.dataset.sharedBound) {
        target.dataset.sharedBound = '1';
        target.addEventListener('input', () => {
          if (!writable()) return;
          source.value = target.value; dirty.set(sourceId, target.value);
          source.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
    }
    window.BorkeoChiefComplaint?.syncFromInput();
    syncPrint();
  }
  function syncPrint() {
    const printed = sharedHost?.querySelector('.opd-shared-complaint-print');
    if (printed) printed.textContent = document.getElementById('pmrs_chief_complaint')?.value || '';
  }
  document.addEventListener('input', event => {
    if (writable() && ['pmrs_chief_complaint', 'pmrs_chief_complaint_items'].includes(event.target.id)) dirty.set(event.target.id, event.target.value);
    if (event.target.id === 'pmrs_chief_complaint') syncPrint();
  });
  window.EmrSharedEncounter = {
    chiefEditable: () => isOpd() ? writable() : undefined,
    changes: () => {
      if (!writable() || !dirty.size) return undefined;
      const patch = Object.fromEntries(dirty);
      if (dirty.has('pmrs_chief_complaint')) patch.pmrs_chief_complaint_items = document.getElementById('pmrs_chief_complaint_items')?.value || '[]';
      return patch;
    },
    apply,
  };
  document.addEventListener('emr:patient-loading', () => { ready = false; dirty.clear(); apply(); });
  for (const event of ['emr:patient-loaded', 'emr:patient-saved']) document.addEventListener(event, () => { ready = true; dirty.clear(); setTimeout(apply, 0); });
  window.addEventListener('emr-session-ready', () => setTimeout(apply, 0));
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(changes => { if (changes.some(change => change.oldValue !== document.body.dataset.encounterView)) setTimeout(apply, 0); })
      .observe(document.body, { attributes: true, attributeOldValue: true, attributeFilter: ['data-encounter-view'] });
  });
})();
