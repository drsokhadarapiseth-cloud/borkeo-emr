'use strict';

(function enforceRoleSpecificClinicalUi() {
  let user = null;

  function activeRole() { const role=String(user?.activeRole || '').toUpperCase(); return role==='CHIEF_WARD'?'DOCTOR':role; }
  function activeWard() { return String(user?.activeWard?.code || '').toLowerCase(); }

  function hide(node, value = true) {
    if (!node) return;
    node.hidden = value;
    node.classList.toggle('emr-permission-hidden', value);
  }

  function setReadonly(root, readonly) {
    if (!root) return;
    if(window.EmrEncounterEditor?.isReadOnly(root))readonly=true;
    if (root.classList.contains('emr-permission-readonly') !== readonly) {
      root.classList.toggle('emr-permission-readonly', readonly);
    }
    root.querySelectorAll('input, select, textarea').forEach(control => {
      if (control.closest('.no-print')?.classList.contains('emr-permission-nav')) return;
      if (control.closest('[data-permission-scope="paraclinic"]')) return;
      if (control.dataset.permissionKeepEnabled === 'true') return;
      if (control.disabled !== readonly) control.disabled = readonly;
    });
    root.querySelectorAll('[contenteditable]').forEach(control => {
      if (readonly) {
        if (!control.hasAttribute('data-original-contenteditable')) {
          control.setAttribute('data-original-contenteditable', control.getAttribute('contenteditable') || 'true');
        }
        if (control.getAttribute('contenteditable') !== 'false') control.setAttribute('contenteditable', 'false');
      } else if (control.hasAttribute('data-original-contenteditable')) {
        const orig = control.getAttribute('data-original-contenteditable');
        if (control.getAttribute('contenteditable') !== orig) control.setAttribute('contenteditable', orig);
        control.removeAttribute('data-original-contenteditable');
      }
    });
    root.querySelectorAll('button').forEach(button => {
      if (button.closest('[data-permission-scope="paraclinic"]')) return;
      const text = `${button.id || ''} ${button.className || ''} ${button.textContent || ''}`.toLowerCase();
      const saveLike = /save|រក្សា|submit|បញ្ជូន|discharge|បញ្ចេញ|transfer|administer|given/.test(text);
      if (saveLike && !button.closest('.inner-tabs,.nursing-section-tabs,.midwife-workflow-nav')) {
        if (button.disabled !== readonly) button.disabled = readonly;
      }
    });
  }

  function roleMayOpenClinical(role) {
    return ['ADMIN','VICE_DIRECTOR','DIRECTOR','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE'].includes(role);
  }

  function applyTopLevel(role) {
    const b1 = document.getElementById('btn_page1');
    const b2 = document.getElementById('btn_page2');
    if (role === 'REGISTRATION') {
      document.documentElement.classList.add('registration-user');
      document.documentElement.setAttribute('data-user-role', 'REGISTRATION');
      if (document.body) document.body.classList.add('registration-user');
      hide(b1,false); hide(b2,true); hide(b3,true);
      hide(document.querySelector('.step-wrapper'),false);
      hide(document.querySelector('.dashboard-header'),false);
      hide(document.getElementById('emr-persistent-patient-banner'),true);
      hide(document.getElementById('emr-chart-tabs-wrapper'),true);
      hide(document.getElementById('emr-summary-dashboard-panel'),true);
      hide(document.getElementById('emr-consultation-workspace'),true);
      hide(document.querySelector('.emr-breadcrumbs-container'),true);
    }
    else if (role === 'TRIAGE') {
      document.documentElement.classList.add('triage-restricted');
      document.documentElement.classList.remove('bed-direct-opd', 'bed-direct-medical', 'bed-direct-nursing', 'bed-direct-daily', 'bed-direct-discharge');
      document.documentElement.classList.add('bed-direct-view', 'bed-direct-triage');
      hide(b1,true); hide(b2,false); hide(b3,true);
      hide(document.querySelector('.step-wrapper'),true);
      hide(document.querySelector('.dashboard-header'),false);
      const p1 = document.getElementById('page1');
      const p3 = document.getElementById('page3');
      if (p1) { p1.classList.remove('active'); p1.hidden = true; }
      if (p3) { p3.classList.remove('active'); p3.hidden = true; }
      const p2 = document.getElementById('page2');
      if (p2) { p2.classList.add('active'); p2.hidden = false; }
      window.switchPage?.(2);
    }
    else if (['NURSE','MIDWIFE'].includes(role)) {
      // Nursing users work from a ward bed and need only the Nursing Process
      // form. Do not expose Registration, Triage, OPD or the physician record.
      hide(b1,true); hide(b2,true); hide(b3,false);
      hide(document.querySelector('.step-wrapper'),true);
      ['btn_sub_opd','btn_sub_ipd'].forEach(id => hide(document.getElementById(id),true));
      hide(document.getElementById('btn_sub_nursing'),false);
      window.switchPage?.(3);
      window.switchOpdTab?.('nursing');
    }
    else if (['DOCTOR','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) {
      document.documentElement.classList.remove('registration-user', 'on-registration-page', 'triage-restricted');
      if (document.body) document.body.classList.remove('registration-user');
      hide(b1,false); hide(b2,false); hide(b3,false);
      hide(document.querySelector('.step-wrapper'),false);
      hide(document.querySelector('.dashboard-header'),false);
      hide(document.getElementById('emr-persistent-patient-banner'),false);
      hide(document.getElementById('emr-chart-tabs-wrapper'),false);
      hide(document.getElementById('emr-summary-dashboard-panel'),false);
      hide(document.getElementById('emr-consultation-workspace'),false);
      hide(document.querySelector('.emr-breadcrumbs-container'),false);
    }
  }

  function applyReadPermissions(role) {
    const registration = document.getElementById('page1');
    const triage = document.getElementById('page2');
    const loadedPatient = window.getLoadedEmrPatient?.() || null;
    const isEditMode = new URLSearchParams(location.search).get('edit') === '1';
    const isTriageView = new URLSearchParams(location.search).get('view') === 'triage';
    const completedTriage = role === 'TRIAGE' && loadedPatient?.triageStatus === 'COMPLETED' && !isEditMode;
    const requestedView = new URLSearchParams(location.search).get('view') || '';
    const prePaymentParaclinicReview = requestedView === 'opd-paraclinic';
    const opdStage = String(loadedPatient?.workflowStage || '');
    const opdLockedForCashier = role === 'DOCTOR' && String(loadedPatient?.serviceMode || '').toLowerCase() === 'opd' && !['DOCTOR_READY','IN_CONSULTATION'].includes(opdStage);
    const outpatient = document.getElementById('sub_opd');
    const medical = document.getElementById('sub_ipd');
    const nursing = document.getElementById('sub_nursing');
    const daily = document.getElementById('emr-daily-view');
    const discharge = document.getElementById('emr-discharge-view');

    setReadonly(registration, !['ADMIN','VICE_DIRECTOR','DIRECTOR','REGISTRATION'].includes(role));
    // Triage is freely editable without permission or read-only locking
    setReadonly(triage, false);
    if (triage) triage.classList.remove('emr-permission-readonly');
    const triageSaveBar = document.querySelector('#page2 .emr-save-bar');
    if (triageSaveBar) triageSaveBar.removeAttribute('hidden');
    const triageSaveBtn = document.getElementById('triage_save_btn');
    if (triageSaveBtn) {
      triageSaveBtn.removeAttribute('hidden');
      if (typeof window.updateTriageSaveButtonState === 'function') {
        window.updateTriageSaveButtonState();
      }
    }
    if (role === 'TRIAGE') {
      const nextBtn = document.querySelector('#page2 .btn-next');
      if (nextBtn) hide(nextBtn, true);
    }
    setReadonly(outpatient, !['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR'].includes(role) || prePaymentParaclinicReview || opdLockedForCashier);
    setReadonly(medical, !['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR'].includes(role));
    setReadonly(daily, !['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR','NURSE','MIDWIFE'].includes(role));
    setReadonly(discharge, !['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR'].includes(role));
    setReadonly(nursing, !['ADMIN','VICE_DIRECTOR','DIRECTOR','NURSE','MIDWIFE'].includes(role));
  }

  function configureDailyVitalEntry(role) {
    const daily = document.getElementById('emr-daily-view');
    if (!daily) return;
    const vitalOnly = role === 'NURSE' || role === 'MIDWIFE';
    daily.classList.toggle('emr-daily-vitals-only', vitalOnly);
    if (!vitalOnly) return;

    const vitalIds = new Set([
      'mon_input_date', 'mon_input_temp', 'mon_input_bp_sys', 'mon_input_bp_dia',
      'mon_input_pulse', 'mon_input_resp', 'mon_input_spo2',
    ]);

    // Nurses/Midwives may record repeated vital signs, but may not write the
    // physician's evolution/follow-up, diagnosis/conclusion, or treatment.
    ['mon_input_evol', 'mon_input_conclusion'].forEach(id => {
      const field = document.getElementById(id);
      if (!field) return;
      field.disabled = true;
      const block = field.closest('div[style*="margin-bottom"]') || field.parentElement;
      if (block) block.hidden = true;
    });
    const treatmentTable = document.getElementById('mon_rx_table');
    const treatmentBlock = treatmentTable?.closest('div[style*="margin-bottom"]');
    if (treatmentBlock) treatmentBlock.hidden = true;
    document.getElementById('mon_protocol_rx_container')?.setAttribute('hidden', '');

    vitalIds.forEach(id => {
      const control = document.getElementById(id);
      if (control) control.disabled = false;
    });
    daily.querySelectorAll('.daily-entry-save,.daily-entry-reset').forEach(button => { button.disabled = false; });

    // Existing doctor notes remain visible, but nurses cannot edit/copy/delete
    // those physician-authored daily records from this screen.
    daily.querySelectorAll('#daily_monitoring_feed button,[onclick]').forEach(control => {
      const action = String(control.getAttribute('onclick') || '').toLowerCase();
      if (/editmonitoringrecord|deletemonitoringrecord|copymonitoringrecord|opendischargefromfollowup/.test(action)) {
        control.hidden = true;
        control.disabled = true;
      }
    });
    daily.querySelectorAll('#daily_monitoring_feed input, #daily_monitoring_feed select, #daily_monitoring_feed textarea')
      .forEach(control => { control.disabled = true; });
  }

  function applyNursingRole(role) {
    const general = document.getElementById('nursing_general');
    const maternity = document.getElementById('nursing_maternity');
    const selector = document.getElementById('nursing_process_selector');
    const obstetric = activeWard() === 'obstetric';

    if (['NURSE','MIDWIFE'].includes(role)) {
      ['btn_sub_opd','btn_sub_ipd'].forEach(id => hide(document.getElementById(id),true));
      hide(document.getElementById('btn_sub_nursing'),false);
      document.querySelectorAll('#sub_nursing .nursing-section-tabs [data-nursing-section="rights"], #sub_nursing .nursing-section-tabs [data-nursing-section="agreement"]')
        .forEach(button => hide(button,true));
      hide(document.getElementById('sub_rights'),true);
      hide(document.getElementById('sub_agreement'),true);
      window.switchNursingSection?.('care');
    }

    if (role === 'NURSE') {
      hide(maternity, true);
      hide(general, false);
      if (selector) { selector.value = 'general'; selector.disabled = true; selector.closest('.nursing-form-selector-wrap, .nursing-form-selector, label')?.classList.add('emr-permission-hidden'); }
      if (typeof window.switchNursingForm === 'function') window.switchNursingForm('general');
    } else if (role === 'MIDWIFE') {
      hide(general, true);
      hide(maternity, false);
      if (selector) { selector.value = 'maternity'; selector.disabled = true; selector.closest('.nursing-form-selector-wrap, .nursing-form-selector, label')?.classList.add('emr-permission-hidden'); }
      if (typeof window.switchNursingForm === 'function') window.switchNursingForm('maternity');
    } else if (['ADMIN','VICE_DIRECTOR'].includes(role) || role === 'DIRECTOR') {
      if (selector) { selector.disabled = false; selector.closest('.nursing-form-selector-wrap, .nursing-form-selector, label')?.classList.remove('emr-permission-hidden'); }
      // Keep both forms available for an administrator.
    }

    // Safety rule agreed for Borkeo EMR: Obstetric is Midwife; every other ward is Nurse.
    if (role === 'NURSE' && obstetric) {
      document.body.dataset.permissionWarning = 'Nurse role cannot use the Obstetric midwife workflow.';
    }
    if (role === 'MIDWIFE' && !obstetric) {
      document.body.dataset.permissionWarning = 'Midwife role is limited to the Obstetric ward.';
    }
  }

  function wrapSwitchPage(role) {
    if (window.__emrPermissionSwitchWrapped || typeof window.switchPage !== 'function') return;
    const original = window.switchPage;
    window.switchPage = function guardedSwitchPage(pageNumber) {
      if (role === 'TRIAGE' && Number(pageNumber) !== 2) return false;
      const allowed = ['ADMIN','VICE_DIRECTOR'].includes(role) || role === 'DIRECTOR'
        || (role === 'REGISTRATION' && Number(pageNumber) === 1)
        || (role === 'TRIAGE' && Number(pageNumber) === 2)
        || (['DOCTOR','NURSE','MIDWIFE'].includes(role) && [1,2,3].includes(Number(pageNumber)));
      if (!allowed) return false;
      const res = original.apply(this, arguments);
      if (Number(pageNumber) === 2 && typeof window.updateTriageSaveButtonState === 'function') {
        window.updateTriageSaveButtonState();
      }
      return res;
    };
    window.__emrPermissionSwitchWrapped = true;
  }

  function apply() {
    const role = activeRole();
    if (!role) return;
    if (!roleMayOpenClinical(role)) {
      window.location.replace('/home');
      return;
    }
    applyTopLevel(role);
    applyReadPermissions(role);
    configureDailyVitalEntry(role);
    applyNursingRole(role);
    window.EmrEncounterEditor?.apply();
    wrapSwitchPage(role);
    if (role === 'TRIAGE') {
      const action = document.querySelector('#page2 .action-bar .btn-next');
      if (action) hide(action, true);
    }

    // Triage staff opening a patient should land on Triage.
    const queryPatient = new URLSearchParams(location.search).get('patient');
    if (role === 'TRIAGE' && queryPatient && typeof window.switchPage === 'function') {
      window.switchPage(2);
    }
  }

  let bootstrapped = false;
  let observer = null;
  function bootstrap(session) {
    user = session?.user || null;
    apply();
    if (bootstrapped) return;
    bootstrapped = true;

    observer = new MutationObserver(mutations => {
      let shouldApply = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.closest?.('svg, .nursing-chart-overlay, .request-badge, .badge, .emr-daily-vital-chart') ||
                node.matches?.('svg, .nursing-chart-overlay, .request-badge, .badge, .emr-daily-vital-chart')) {
              continue;
            }
            if (node.matches?.('input, select, textarea, button, [contenteditable]') ||
                node.querySelector?.('input, select, textarea, button, [contenteditable]')) {
              shouldApply = true;
              break;
            }
          }
        }
        if (shouldApply) break;
      }
      if (!shouldApply) return;
      observer.disconnect();
      try {
        applyReadPermissions(activeRole());
        configureDailyVitalEntry(activeRole());
      } finally {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('emr:patient-loaded', () => {
      applyReadPermissions(activeRole());
      applyNursingRole(activeRole());
    });
  }

  if (window.emrSession) bootstrap(window.emrSession);
  window.addEventListener('emr-session-ready', event => bootstrap(event.detail));
})();
