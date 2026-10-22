'use strict';

(function inpatientBedWorkflow() {
  const BUILD_VERSION = document.querySelector('meta[name="borkeo-version"]')?.content || '18.3';
  const parameters = new URLSearchParams(window.location.search);
  const requestedView = parameters.get('view') || '';
  const requestedCare = parameters.get('care') || '';
  const requestedRoomCode = parameters.get('roomCode') || '';
  let currentPatient = null;
  let csrfToken = '';
  let followupDatePolicy = { allowFuture: false };
  let restoringDailyRecords = false;
  let originalSaveDailyMonitoring = null;

  const copy = {
    khmer: {
      back: 'ត្រឡប់ទៅផែនទីគ្រែ', opdBack: 'ត្រឡប់ទៅបញ្ជីរង់ចាំ OPD', opd: 'ទម្រង់ពិគ្រោះក្រៅ OPD', medical: 'កំណត់ត្រាអ្នកជំងឺ',
      daily: 'ការតាមដានប្រចាំថ្ងៃ', nursing: 'ដំណើរការថែទាំ', discharge: 'បញ្ចេញអ្នកជំងឺ',
      register: 'ចុះឈ្មោះ', triage: 'វាយតម្លៃជំងឺ',
      dailyEntryTitle: 'បញ្ចូលការតាមដានប្រចាំថ្ងៃ', newDaily: 'កំណត់ត្រាថ្មី',
      savedDaily: 'កំណត់ត្រាតាមដានដែលបានរក្សាទុក',
      name: 'ឈ្មោះអ្នកជំងឺ', sex: 'ភេទ', age: 'អាយុ', patientId: 'លេខបណ្ណសុខភាព',
      entry: 'ថ្ងៃ និងម៉ោងចូល', ward: 'ផ្នែក', room: 'បន្ទប់', bed: 'គ្រែ', unknown: 'មិនបានកំណត់',
      saveDaily: 'រក្សាទុកការតាមដាន', saveMedical: 'រក្សាទុក និងបញ្ចប់កំណត់ត្រាវេជ្ជសាស្ត្រ',
      medicalComplete: 'កំណត់ត្រាវេជ្ជសាស្ត្របានបញ្ចប់។ អាចបើកការតាមដានប្រចាំថ្ងៃបាន។',
      dailyLocked: 'មិនអាចបើកការតាមដានប្រចាំថ្ងៃបានទេ',
      dailyLockedHelp: 'សូមបំពេញ និងរក្សាទុកកំណត់ត្រាវេជ្ជសាស្ត្រ IPD ជាមុនសិន។',
      openMedical: 'បើកកំណត់ត្រាវេជ្ជសាស្ត្រ', dischargeTitle: 'ទម្រង់បញ្ចេញអ្នកជំងឺ',
      dischargeWard: 'ផ្នែកបញ្ចេញ', admissionDiagnosis: 'រោគវិនិច្ឆ័យពេលចូល',
      admissionIcd10: 'កូដរោគវិនិច្ឆ័យពេលចូល ICD10', admissionAt: 'កាលបរិច្ឆេទ និងម៉ោងចូល',
      dischargeDiagnosis: 'រោគវិនិច្ឆ័យពេលចេញ', dischargeIcd10: 'កូដរោគវិនិច្ឆ័យពេលចេញ ICD10',
      // v41.6 (approved Khmer, RULE 2)
      patientInstructions: 'ការណែនាំសម្រាប់អ្នកជំងឺ', dischargeSummary: 'សេចក្តីសង្ខេបពេលចេញពីមន្ទីរពេទ្យ',
      dischargeMedications: 'ឱសថពេលចេញពីមន្ទីរពេទ្យ', mainDiagnosis: 'រោគវិនិច្ឆ័យចម្បង', secondaryDiagnoses: 'រោគវិនិច្ឆ័យបន្ទាប់បន្សំ',
      dischargeAt: 'កាលបរិច្ឆេទ និងម៉ោងចេញ', outcome: 'លទ្ធផលការព្យាបាល',
      dischargeStatus: 'ស្ថានភាពបញ្ចេញ', followUp: 'កាលបរិច្ឆេទតាមដានបន្ទាប់', deceased: 'ស្លាប់',
      choose: 'សូមជ្រើសរើស', recovered: 'ជាសះស្បើយ', improved: 'ធូរស្រាល',
      unchanged: 'មិនធូរស្រាល', referred: 'បញ្ជូនបន្ត', died: 'ស្លាប់',
      ordered: 'បញ្ចេញតាមការបញ្ជារបស់គ្រូពេទ្យ', againstAdvice: 'ចេញផ្ទុយពីការណែនាំ',
      absconded: 'ចេញដោយមិនបានជូនដំណឹង', saveDischarge: 'រក្សាទុក និងបញ្ចេញអ្នកជំងឺ',
      dischargeRequired: 'សូមបំពេញថ្ងៃម៉ោងចេញ រោគវិនិច្ឆ័យពេលចេញ លទ្ធផល និងស្ថានភាពបញ្ចេញ។',
      dischargeSaved: 'បានរក្សាទុកការបញ្ចេញអ្នកជំងឺ និងដោះគ្រែរួចរាល់។',
      saveError: 'មិនអាចរក្សាទុកបានទេ៖ ', treatment: 'ការព្យាបាល',
      generalCare: 'ដំណើរការថែទាំ — គិលានុបដ្ឋាក', obstetricCare: 'ដំណើរការថែទាំ — ឆ្មប',
      paymentStatus: 'ស្ថានភាពទូទាត់', referralDestination: 'គោលដៅបញ្ជូនបន្ត',
      provincialHospital: 'មន្ទីរពេទ្យខេត្ត', otherDestination: 'មន្ទីរពេទ្យ/កន្លែងផ្សេង',
      referralDestinationName: 'ឈ្មោះកន្លែងបញ្ជូន', referralTransport: 'មធ្យោបាយបញ្ជូន',
      ambulance: 'រថយន្តសង្គ្រោះ', otherTransport: 'ផ្សេងៗ',
    },
    english: {
      back: 'Return to Bed Map', opdBack: 'Return to OPD Queue', opd: 'OPD Form', medical: 'Patient Record', daily: 'Daily Follow-up',
      register: 'Register', triage: 'Triage',
      dailyEntryTitle: 'Daily Follow-up Form', newDaily: 'New Follow-up',
      savedDaily: 'Saved Follow-up Records',
      nursing: 'Nursing Process', discharge: 'Discharge Patient', name: 'Patient name', sex: 'Sex', age: 'Age',
      patientId: 'Patient ID', entry: 'Entry date and time', ward: 'Ward', room: 'Room', bed: 'Bed',
      unknown: 'Not specified', saveDaily: 'Save Daily Follow-up',
      saveMedical: 'Save & Complete Medical Record',
      medicalComplete: 'Medical Record completed. Daily Follow-up is now available.',
      dailyLocked: 'Daily Follow-up is locked',
      dailyLockedHelp: 'Complete and save the IPD Medical Record first.', openMedical: 'Open Medical Record',
      dischargeTitle: 'Patient Discharge Form', dischargeWard: 'Discharging ward',
      admissionDiagnosis: 'Admission diagnosis', admissionIcd10: 'Admission diagnosis ICD10',
      admissionAt: 'Admission date and time', dischargeDiagnosis: 'Discharge diagnosis',
      dischargeIcd10: 'Discharge diagnosis ICD10', dischargeAt: 'Discharge date and time',
      patientInstructions: 'Patient instructions', dischargeSummary: 'Printable discharge summary',
      dischargeMedications: 'Discharge medications', mainDiagnosis: 'Main diagnosis', secondaryDiagnoses: 'Secondary diagnoses',
      outcome: 'Treatment outcome', dischargeStatus: 'Discharge status', followUp: 'Next follow-up date',
      deceased: 'Deceased', choose: 'Please select', recovered: 'Recovered', improved: 'Improved',
      unchanged: 'Not improved', referred: 'Referred', died: 'Died', ordered: 'Discharged by medical order',
      againstAdvice: 'Left against medical advice', absconded: 'Left without notification',
      saveDischarge: 'Save & Discharge Patient',
      dischargeRequired: 'Complete discharge date/time, diagnosis, outcome, and discharge status.',
      dischargeSaved: 'Discharge saved and the bed has been released.', saveError: 'Unable to save: ',
      treatment: 'Treatment', generalCare: 'Nursing Process — Nurse',
      obstetricCare: 'Nursing Process — Midwife',
      paymentStatus: 'Payment Status', referralDestination: 'Referral destination',
      provincialHospital: 'Provincial Hospital', otherDestination: 'Other hospital / destination',
      referralDestinationName: 'Referral destination name', referralTransport: 'Referral transport',
      ambulance: 'Ambulance', otherTransport: 'Other',
    },
  };

  function language() {
    return 'khmer';
  }

  function text(key) {
    return copy[language()][key] || copy.khmer[key] || key;
  }

  function value(id) {
    return String(document.getElementById(id)?.value || '').trim();
  }

  function setValue(id, nextValue, overwrite = true) {
    const control = document.getElementById(id);
    if (!control || (!overwrite && control.value)) return;
    control.value = nextValue || '';
  }

  function formatEntry(patient) {
    const storedTime = patient?.data?.['id:web_time'] || value('web_time');
    return [patient?.entryDate || value('web_date'), storedTime].filter(Boolean).join(' ');
  }

  function queryOrPatient(parameterName, patientField) {
    return parameters.get(parameterName) || currentPatient?.[patientField] || '';
  }

  function localized(primaryKh, primaryEn) {
    return primaryKh || primaryEn;
  }

  function createPatientContext() {
    const context = document.createElement('section');
    context.id = 'inpatient-patient-context';
    context.className = 'inpatient-patient-context no-print';
    context.innerHTML = `
      <div id="patient-payment-status-banner" class="patient-payment-status-banner payment-NOT_PAID" aria-live="polite">
        <span data-iw-key="paymentStatus"></span><strong id="patient-payment-status-text">មិនទាន់បង់ប្រាក់</strong>
      </div>`;
    return context;
  }

  function createViewToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'inpatient-view-toolbar';
    toolbar.className = 'inpatient-view-toolbar no-print';
    toolbar.innerHTML = `
      <a id="inpatient-back-link" class="inpatient-back-link" href="/departments">
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span data-iw-key="back"></span>
      </a>
      <div class="inpatient-view-heading"><h2 id="inpatient-view-title"></h2></div>`;
    return toolbar;
  }

  function createWorkspaceNavigation() {
    const navigation = document.createElement('section');
    navigation.id = 'patient-record-workspace-navigation';
    navigation.className = 'patient-record-workspace-navigation';
    navigation.append(createViewToolbar());
    navigation.append(createPatientContext());
    const firstPage = document.getElementById('page1');
    firstPage?.parentElement?.insertBefore(navigation, firstPage);
    return navigation;
  }

  function localDateTimeInputValue(date = new Date()) {
    const value = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return value.toISOString().slice(0, 16);
  }

  function applyFollowupDateInputPolicy() {
    const dateInput = document.getElementById('mon_input_date');
    if (!dateInput) return;
    const maxNow = localDateTimeInputValue(new Date());
    if (followupDatePolicy.allowFuture) {
      dateInput.removeAttribute('max');
      dateInput.title = 'Future date/time is allowed by the administrator for testing.';
    } else {
      dateInput.max = maxNow;
      dateInput.title = 'Date/time cannot be later than the current date/time.';
      if (dateInput.value && dateInput.value > maxNow) dateInput.value = maxNow;
    }
    const notice = document.getElementById('followup-date-policy-notice');
    if (notice) notice.textContent = followupDatePolicy.allowFuture
      ? 'Future date/time is enabled for testing by the administrator.'
      : 'Future date/time is restricted. The date/time cannot exceed now.';
  }

  async function loadFollowupDatePolicy() {
    try {
      const response = await fetch('/api/system-settings/followup', { credentials:'same-origin', cache:'no-store' });
      if (!response.ok) return;
      const result = await response.json().catch(() => ({}));
      followupDatePolicy.allowFuture = result.allowFutureFollowup === true;
      const control = document.getElementById('allow-future-followup');
      if (control) control.checked = followupDatePolicy.allowFuture;
      applyFollowupDateInputPolicy();
    } catch {}
  }

  async function saveFollowupDatePolicy(allowFuture) {
    const control = document.getElementById('allow-future-followup');
    if (control) control.disabled = true;
    try {
      const response = await fetch('/api/system-settings/followup', {
        method:'PUT', credentials:'same-origin',
        headers:{'Content-Type':'application/json','X-CSRF-Token': await getCsrfToken()},
        body: JSON.stringify({ allowFutureFollowup: allowFuture === true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to save follow-up date policy.');
      followupDatePolicy.allowFuture = result.allowFutureFollowup === true;
      applyFollowupDateInputPolicy();
    } catch (error) {
      if (control) control.checked = followupDatePolicy.allowFuture;
      window.alert(error.message);
    } finally {
      if (control) control.disabled = false;
    }
  }

  function createFollowupDatePolicyPanel() {
    const role = String(window.emrSession?.user?.activeRole || '').toUpperCase();
    if (!['ADMIN','VICE_DIRECTOR'].includes(role) || document.getElementById('followup-date-policy-panel')) return null;
    const panel = document.createElement('section');
    panel.id = 'followup-date-policy-panel';
    panel.className = 'followup-date-policy-panel no-print';
    panel.innerHTML = `
      <div><strong>Follow-up date/time setting</strong><p id="followup-date-policy-notice">Future date/time is restricted. The date/time cannot exceed now.</p></div>
      <label><input type="checkbox" id="allow-future-followup"> Allow future date/time for testing</label>`;
    panel.querySelector('#allow-future-followup').addEventListener('change', event => {
      void saveFollowupDatePolicy(event.target.checked);
    });
    return panel;
  }

  function ensureFollowupDatePolicyPanel() {
    if (document.getElementById('followup-date-policy-panel')) return;
    const panel = createFollowupDatePolicyPanel();
    const daily = document.getElementById('emr-daily-view');
    if (panel && daily) {
      daily.prepend(panel);
      applyFollowupDateInputPolicy();
    }
  }

  function prepareDailyEntryForm(scrollToForm = false) {
    window.resetMonForm?.();
    const now = new Date();
    const dateInput = document.getElementById('mon_input_date');
    if (dateInput) dateInput.value = localDateTimeInputValue(now);
    document.querySelectorAll('#mon_rx_tbody .med-effective-at').forEach(input => {
      input.value = dateInput?.value || '';
    });
    applyFollowupDateInputPolicy();
    window.evaluateMonitoringVitalStates?.();
    if (scrollToForm) {
      document.getElementById('mon_modal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function embedDailyEntryForm() {
    const form = document.getElementById('mon_modal');
    if (!form) return null;
    form.classList.remove('modal-overlay');
    form.classList.add('daily-followup-entry-form', 'active');

    const heading = form.querySelector('.modal-header h3');
    if (heading) {
      heading.innerHTML = '<i class="fa-regular fa-pen-to-square" aria-hidden="true"></i> <span data-iw-key="dailyEntryTitle"></span>';
    }
    const close = form.querySelector('.close-btn');
    if (close) close.hidden = true;

    const reset = form.querySelector('.modal-actions .btn-orange');
    if (reset) {
      reset.removeAttribute('onclick');
      reset.classList.add('daily-entry-reset');
      reset.innerHTML = '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> <span data-iw-key="newDaily"></span>';
      reset.addEventListener('click', () => prepareDailyEntryForm(true));
    }
    const save = form.querySelector('.modal-actions .btn-green');
    if (save) {
      save.classList.add('daily-entry-save');
      save.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> <span data-iw-key="saveDaily"></span>';
    }
    return form;
  }

  function createDailyView() {
    const feed = document.getElementById('daily_monitoring_feed');
    if (!feed) return null;
    const oldToolbar = feed.previousElementSibling;
    const oldDivider = oldToolbar?.previousElementSibling;
    const daily = document.createElement('div');
    daily.id = 'emr-daily-view';
    daily.className = 'sub-tab inpatient-standalone-view';
    const policyPanel = createFollowupDatePolicyPanel();
    if (policyPanel) daily.append(policyPanel);

    const lock = document.createElement('section');
    lock.id = 'daily-followup-lock';
    lock.className = 'daily-followup-lock no-print';
    lock.hidden = false;
    lock.innerHTML = `
      <i class="fa-solid fa-lock" aria-hidden="true"></i>
      <div><h3 data-iw-key="dailyLocked"></h3><p data-iw-key="dailyLockedHelp"></p></div>
      <a class="btn-blue" id="open-medical-record" href="#"><span data-iw-key="openMedical"></span></a>`;

    const content = document.createElement('div');
    content.id = 'daily-followup-content';
    content.hidden = true;
    const entryForm = embedDailyEntryForm();
    if (entryForm) content.append(entryForm);
    if (oldDivider) content.append(oldDivider);
    if (oldToolbar) {
      oldToolbar.querySelector('[onclick="openMonModal()"]')?.remove();
      const savedHeading = oldToolbar.querySelector('h3');
      if (savedHeading) savedHeading.dataset.iwKey = 'savedDaily';
      content.append(oldToolbar);
    }
    content.append(feed);

    const saveBar = document.createElement('div');
    saveBar.className = 'emr-save-bar no-print';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn-blue';
    save.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span data-iw-key="saveDaily"></span>';
    save.addEventListener('click', () => void window.saveDailyMonitoring?.());
    saveBar.append(save);
    content.prepend(saveBar);
    daily.append(lock, content);
    document.getElementById('page3')?.append(daily);
    if (entryForm) prepareDailyEntryForm(false);
    return daily;
  }

  function createDischargeView() {
    const discharge = document.createElement('div');
    discharge.id = 'emr-discharge-view';
    discharge.className = 'sub-tab inpatient-standalone-view';
    discharge.innerHTML = `
      <section class="discharge-form" aria-labelledby="discharge-form-title">
        <h2 id="discharge-form-title" data-iw-key="dischargeTitle"></h2>
        <div class="discharge-form-grid">
          <label><span data-iw-key="dischargeWard"></span><input id="emr_discharge_department" type="text" readonly></label>
          <label><span data-iw-key="admissionAt"></span><input id="emr_discharge_admission_at" type="datetime-local" readonly></label>
          <label><span data-iw-key="admissionIcd10"></span><input id="emr_discharge_admission_icd10" type="text" readonly></label>
          <label class="wide"><span data-iw-key="admissionDiagnosis"></span><textarea id="emr_discharge_admission_diagnosis" readonly></textarea></label>
          <label><span><span data-iw-key="dischargeAt"></span> *</span><input id="emr_discharge_datetime" type="datetime-local" required></label>
          <label><span data-iw-key="dischargeIcd10"></span><input id="emr_discharge_icd10" type="text"></label>
          <!-- v41.6: main / secondary ICD-10 (emr-diagnoses.js, kind "discharge"); the field above holds the main code. -->
          <div class="wide"><input type="hidden" id="emr_discharge_diagnoses" value="[]"><div class="emr-diagnosis-list" data-diagnosis-editor="discharge"></div></div>
          <label class="wide"><span><span data-iw-key="dischargeDiagnosis"></span> *</span><textarea id="emr_discharge_diagnosis" required></textarea></label>
          <label><span><span data-iw-key="outcome"></span> *</span><select id="emr_discharge_outcome" required>
            <option value="" data-iw-key="choose"></option><option value="recovered" data-iw-key="recovered"></option>
            <option value="improved" data-iw-key="improved"></option><option value="unchanged" data-iw-key="unchanged"></option>
            <option value="referred" data-iw-key="referred"></option><option value="died" data-iw-key="died"></option>
          </select></label>
          <label><span><span data-iw-key="dischargeStatus"></span> *</span><select id="emr_discharge_status" required>
            <option value="" data-iw-key="choose"></option><option value="ordered" data-iw-key="ordered"></option>
            <option value="against-advice" data-iw-key="againstAdvice"></option>
            <option value="absconded" data-iw-key="absconded"></option><option value="referred" data-iw-key="referred"></option>
            <option value="died" data-iw-key="died"></option>
          </select></label>
          <label><span data-iw-key="followUp"></span><input id="emr_discharge_followup" type="date"></label>
          <label class="discharge-checkbox"><input id="emr_discharge_deceased" type="checkbox"><span data-iw-key="deceased"></span></label>
          <label class="wide"><span data-iw-key="patientInstructions"></span><textarea id="emr_discharge_instructions" maxlength="4000"></textarea></label>
          <label data-referral-only hidden><span data-iw-key="referralDestination"></span><select id="emr_referral_destination_type">
            <option value="" data-iw-key="choose"></option><option value="PROVINCIAL_HOSPITAL" data-iw-key="provincialHospital"></option><option value="OTHER" data-iw-key="otherDestination"></option>
          </select></label>
          <label data-referral-only hidden><span data-iw-key="referralDestinationName"></span><input id="emr_referral_destination_name" type="text" maxlength="240"></label>
          <label data-referral-only hidden><span data-iw-key="referralTransport"></span><select id="emr_referral_transport">
            <option value="" data-iw-key="choose"></option><option value="AMBULANCE" data-iw-key="ambulance"></option><option value="OTHER" data-iw-key="otherTransport"></option>
          </select></label>
        </div>
        <section class="discharge-prescription" aria-labelledby="emr-discharge-rx-title" style="margin:16px 0;">
          <h3 id="emr-discharge-rx-title">វេជ្ជបញ្ជាពេលចេញ</h3>
          <p id="emr-discharge-rx-source" role="status">ថ្នាំចម្លងពីការតាមដានចុងក្រោយ។ សូមពិនិត្យ និងកែសម្រួលមុនបញ្ចេញអ្នកជំងឺ។</p>
          <div class="responsive-table-scroll" style="overflow-x:auto;">
            <table class="rx-new-table" id="emr-discharge-rx-table" style="min-width:1080px;width:100%;">
              <thead><tr><th>ឈ្មោះថ្នាំ</th><th>ផ្លូវប្រើ</th><th>កម្រិត / ឯកតា</th><th>BID / TID / QID</th>
                <th>ព្រឹក</th><th>ថ្ងៃ</th><th>ល្ងាច</th><th>យប់</th><th>ថ្ងៃ / សរុប</th><th>សម្គាល់</th><th class="no-print"></th></tr></thead>
              <tbody id="emr-discharge-rx-body"></tbody>
            </table>
          </div>
          <button id="emr-discharge-add-rx" type="button" class="btn-blue no-print" style="margin-top:8px;">+ បន្ថែមថ្នាំ</button>
        </section>
        <div class="discharge-actions no-print">
          <span id="emr-discharge-status" role="status" aria-live="polite"></span>
          <!-- id without "discharge": printing stays possible in view mode (emr-encounter-editor.js isAction). -->
          <button id="emr-summary-print-button" type="button" class="btn-blue" hidden>
            <i class="fa-solid fa-print" aria-hidden="true"></i><span data-iw-key="dischargeSummary"></span>
          </button>
          <button id="emr-save-discharge" type="button" class="btn-blue">
            <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span data-iw-key="saveDischarge"></span>
          </button>
        </div>
      </section>`;
    discharge.querySelector('#emr-save-discharge').addEventListener('click', saveDischarge);
    discharge.querySelector('#emr_discharge_status').addEventListener('change', updateReferralFields);
    discharge.querySelector('#emr_discharge_outcome').addEventListener('change', updateReferralFields);
    discharge.querySelector('#emr_referral_destination_type').addEventListener('change', updateReferralFields);
    discharge.querySelector('#emr-discharge-add-rx').addEventListener('click', () => addDischargeMedicineRow());
    discharge.querySelector('#emr-summary-print-button').addEventListener('click', printDischargeSummary);
    document.getElementById('page3')?.append(discharge);
    window.mountEmrDiagnosisEditor?.('discharge', discharge.querySelector('[data-diagnosis-editor="discharge"]'));
    return discharge;
  }

  function updateReferralFields() {
    const referred = value('emr_discharge_status') === 'referred' || value('emr_discharge_outcome') === 'referred';
    document.querySelectorAll('[data-referral-only]').forEach(node => { node.hidden = !referred; });
    const destinationName = document.getElementById('emr_referral_destination_name');
    if (destinationName) {
      const needsName = referred && value('emr_referral_destination_type') === 'OTHER';
      destinationName.required = needsName;
      destinationName.closest('label').hidden = !needsName;
    }
  }

  function ensurePaymentStatusBanner() {
    let banner = document.getElementById('patient-payment-status-banner');
    if (banner) return banner;
    banner = document.createElement('div');
    banner.id = 'patient-payment-status-banner';
    banner.className = 'patient-payment-status-banner payment-NOT_PAID no-print';
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = '<span>ស្ថានភាពទូទាត់</span><strong id="patient-payment-status-text">មិនទាន់បង់ប្រាក់</strong>';
    const medical = document.getElementById('sub_ipd') || document.getElementById('sub_opd');
    if (medical) medical.prepend(banner);
    return banner;
  }

  async function loadPaymentStatus(patientKey) {
    const banner = ensurePaymentStatusBanner();
    const label = document.getElementById('patient-payment-status-text');
    if (!banner || !label || !patientKey) return;
    try {
      const response = await fetch(`/api/finance/payment-status?patientKey=${encodeURIComponent(patientKey)}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('មិនអាចទាញស្ថានភាពទូទាត់បានទេ');
      const data = await response.json();
      const status = data.status || {};
      label.textContent = status.labelKh || 'មិនទាន់បង់ប្រាក់';
      banner.className = `patient-payment-status-banner payment-${status.code || 'NOT_PAID'}`;
      banner.dataset.paymentCode = status.code || 'NOT_PAID';
    } catch {
      label.textContent = 'មិនទាន់បង់ប្រាក់';
      banner.className = 'patient-payment-status-banner payment-NOT_PAID';
    }
  }

  function setPatientContext(patient, { labelsOnly = false } = {}) {
    currentPatient = patient;
    const values = {
      name: patient.fullName || text('unknown'),
      sex: patient.sex || text('unknown'),
      age: patient.age || text('unknown'),
      patientId: patient.caseNumber || patient.healthId || patient.patientKey,
      entry: formatEntry(patient) || text('unknown'),
      ward: localized(
        queryOrPatient('wardNameKh', 'departmentNameKh'),
        queryOrPatient('wardNameEn', 'departmentNameEn'),
      ) || text('unknown'),
      room: localized(
        queryOrPatient('roomNameKh', 'currentRoomNameKh'),
        queryOrPatient('roomNameEn', 'currentRoomNameEn'),
      ) || text('unknown'),
      bed: queryOrPatient('bedLabel', 'currentBedLabel') || text('unknown'),
    };
    Object.entries(values).forEach(([key, nextValue]) => {
      const node = document.querySelector(`[data-patient-context="${key}"]`);
      if (node && node.textContent !== nextValue) node.textContent = nextValue;
    });
    if (labelsOnly) return;
    fillPatientIdentityForms(patient, values);
    fillDischargeForm(patient);
    applyNursingCare(patient);
    updateDailyGate(patient);
    ensureOpdDispositionPanel(patient);
    void loadPaymentStatus(patient.patientKey);
  }

  function ensureOpdDispositionPanel(patient = currentPatient) {
    const host = document.getElementById('sub_opd');
    if (!host) return;
    let panel = document.getElementById('opd-disposition-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'opd-disposition-panel';
      panel.className = 'opd-disposition-panel no-print';
      panel.innerHTML = `
        <div class="opd-disposition-copy"><strong>បញ្ជូនអ្នកជំងឺបន្ទាប់ពីពិគ្រោះក្រៅ</strong><span>ជ្រើសរើសផ្នែកសម្រាក IPD ឬបញ្ជូនទៅមន្ទីរពេទ្យខេត្ត។</span><span id="opd-disposition-status" role="status" aria-live="polite"></span></div>
        <div class="opd-disposition-buttons"><button type="button" id="opd-open-ipd-transfer">បញ្ជូនទៅសម្រាក IPD</button><button type="button" id="opd-open-provincial-referral">បញ្ជូនទៅមន្ទីរពេទ្យខេត្ត</button></div>
        <dialog id="opd-ipd-transfer-dialog"><form method="dialog"><h2>បញ្ជូនទៅសម្រាក IPD</h2><p id="opd-ipd-transfer-patient"></p><label>ជ្រើសរើសផ្នែកសម្រាក<select id="opd-ipd-transfer-ward" required></select></label><p id="opd-ipd-transfer-error" role="status"></p><div class="opd-disposition-dialog-actions"><button type="button" data-close-ipd-transfer>បោះបង់</button><button type="button" id="opd-confirm-ipd-transfer">បញ្ជូនទៅ IPD</button></div></form></dialog>
        <dialog id="opd-provincial-referral-dialog"><form method="dialog"><h2>បញ្ជូនទៅមន្ទីរពេទ្យខេត្ត</h2><label>រោគវិនិច្ឆ័យ និងមូលហេតុបញ្ជូន<textarea id="opd-referral-diagnosis" maxlength="2000" required></textarea></label><label>ថ្ងៃ និងម៉ោងបញ្ជូន<input id="opd-referral-datetime" type="datetime-local" required></label><label>មធ្យោបាយបញ្ជូន<select id="opd-referral-transport"><option value="">មិនបានកំណត់</option><option value="AMBULANCE">រថយន្តសង្គ្រោះ</option><option value="OTHER">មធ្យោបាយផ្សេង</option></select></label><p id="opd-provincial-referral-error" role="status"></p><div class="opd-disposition-dialog-actions"><button type="button" data-close-provincial-referral>បោះបង់</button><button type="button" id="opd-confirm-provincial-referral">រក្សាទុក និងបញ្ជូន</button></div></form></dialog>`;
      host.prepend(panel);
      panel.querySelector('#opd-open-ipd-transfer').addEventListener('click', () => { void openOpdIpdTransfer(); });
      panel.querySelector('#opd-open-provincial-referral').addEventListener('click', openProvincialReferral);
      panel.querySelector('[data-close-ipd-transfer]').addEventListener('click', () => panel.querySelector('#opd-ipd-transfer-dialog').close());
      panel.querySelector('[data-close-provincial-referral]').addEventListener('click', () => panel.querySelector('#opd-provincial-referral-dialog').close());
      panel.querySelector('#opd-confirm-ipd-transfer').addEventListener('click', event => { void confirmOpdIpdTransfer(event.currentTarget); });
      panel.querySelector('#opd-confirm-provincial-referral').addEventListener('click', event => { void confirmProvincialReferral(event.currentTarget); });
    }
    const user = window.emrSession?.user || {};
    const isOpdDoctor = String(user.activeRole || '').toUpperCase() === 'DOCTOR' && String(user.activeWard?.code || '').toLowerCase() === 'opd';
    const activeOpdCase = String(patient?.serviceMode || '').toLowerCase() === 'opd' && patient?.admissionStatus !== 'discharged';
    panel.hidden = !isOpdDoctor || !activeOpdCase;
  }

  async function openOpdIpdTransfer() {
    if (!currentPatient?.patientKey) return;
    const dialog = document.getElementById('opd-ipd-transfer-dialog');
    const select = document.getElementById('opd-ipd-transfer-ward');
    const error = document.getElementById('opd-ipd-transfer-error');
    error.textContent = '';
    try {
      const response = await fetch('/api/opd/ipd-wards', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'មិនអាចទាញបញ្ជីផ្នែក IPD បានទេ។');
      select.replaceChildren(new Option('— សូមជ្រើសរើសផ្នែក —', ''), ...((data.wards || []).map(ward => new Option(`${ward.nameKh} · ${ward.nameEn}`, ward.code))));
      document.getElementById('opd-ipd-transfer-patient').textContent = `${currentPatient.fullName || ''} · ${currentPatient.caseNumber || currentPatient.healthId || ''}`;
      dialog.showModal();
    } catch (errorValue) { error.textContent = errorValue.message; }
  }

  async function confirmOpdIpdTransfer(button) {
    if (!currentPatient?.patientKey) return;
    const wardCode = value('opd-ipd-transfer-ward');
    const error = document.getElementById('opd-ipd-transfer-error');
    if (!wardCode) { error.textContent = 'សូមជ្រើសរើសផ្នែកសម្រាក។'; return; }
    button.disabled = true; error.textContent = '';
    try {
      if (typeof window.savePatientRecord === 'function' && await window.savePatientRecord() === false) return;
      const response = await fetch('/api/opd/transfer-to-ipd', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
        body: JSON.stringify({ patientKey: currentPatient.patientKey, wardCode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'មិនអាចបញ្ជូនអ្នកជំងឺបានទេ។');
      document.getElementById('opd-ipd-transfer-dialog').close();
      window.alert(`បានបញ្ជូនអ្នកជំងឺទៅ ${result.ward?.nameKh || wardCode}។ ផ្នែកទទួលបានការជូនដំណឹងហើយ។`);
      window.location.assign('/opd-queue');
    } catch (errorValue) { error.textContent = errorValue.message; }
    finally { button.disabled = false; }
  }

  function openProvincialReferral() {
    if (!currentPatient?.patientKey) return;
    const dialog = document.getElementById('opd-provincial-referral-dialog');
    const dateTime = document.getElementById('opd-referral-datetime');
    dateTime.value = localDateTimeInputValue();
    dateTime.max = dateTime.value;
    document.getElementById('opd-referral-diagnosis').value = currentPatient.diagnosis || '';
    document.getElementById('opd-referral-transport').value = '';
    document.getElementById('opd-provincial-referral-error').textContent = '';
    dialog.showModal();
  }

  async function confirmProvincialReferral(button) {
    if (!currentPatient?.patientKey) return;
    const diagnosis = value('opd-referral-diagnosis');
    const dischargeAt = value('opd-referral-datetime');
    const transport = value('opd-referral-transport');
    const error = document.getElementById('opd-provincial-referral-error');
    if (!diagnosis || !dischargeAt) { error.textContent = 'សូមបំពេញរោគវិនិច្ឆ័យ និងថ្ងៃម៉ោងបញ្ជូន។'; return; }
    if (new Date(dischargeAt).getTime() > Date.now()) { error.textContent = 'មិនអាចកត់ត្រាថ្ងៃម៉ោងបញ្ជូននៅពេលអនាគតបានទេ។'; return; }
    button.disabled = true; error.textContent = '';
    try {
      if (typeof window.savePatientRecord === 'function' && await window.savePatientRecord() === false) return;
      const response = await fetch('/api/patient-admission', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
        body: JSON.stringify({ patientKey: currentPatient.patientKey, action: 'discharge',
          dischargeDate: dischargeAt.slice(0, 10), dischargeDepartment: currentPatient.departmentNameKh || 'ពិគ្រោះក្រៅ',
          dischargeDiagnosis: diagnosis, dischargeAt, outcome: 'referred', status: 'referred',
          referralDestinationType: 'PROVINCIAL_HOSPITAL', referralDestinationName: 'មន្ទីរពេទ្យខេត្ត',
          referralTransport: transport, followUpDate: '', deceased: false }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'មិនអាចរក្សាទុកការបញ្ជូនបានទេ។');
      document.getElementById('opd-provincial-referral-dialog').close();
      setPatientContext(result.patient);
      window.alert('បានរក្សាទុកការបញ្ជូនទៅមន្ទីរពេទ្យខេត្តក្នុងប្រវត្តិអ្នកជំងឺ។');
      window.location.assign('/opd-queue');
    } catch (errorValue) { error.textContent = errorValue.message; }
    finally { button.disabled = false; }
  }

  // v41.0: identity fields (name, age, sex, code...) come from the patient, but a
  // saved typed value that differs is never overwritten: it is kept and the
  // patient value is shown next to it. A value filled here earlier still follows
  // the patient when it changes.
  function setAutofillTarget(target, nextValue) {
    if (!target) return;
    const normalized = nextValue || '';
    const current = String(('value' in target ? target.value : target.textContent) || '').trim();
    const ownFill = target.dataset.patientAutofillValue !== undefined && current === target.dataset.patientAutofillValue;
    clearAutofillDifference(target);
    if (current && !ownFill && current !== normalized.trim()) {
      if (normalized.trim()) showAutofillDifference(target, normalized.trim());
      return;
    }
    if ('value' in target) target.value = normalized;
    else target.textContent = normalized;
    target.dataset.patientAutofilled = 'true';
    target.dataset.patientAutofillValue = normalized.trim();
  }

  function clearAutofillDifference(target) {
    target.classList.remove('nursing-banner-differs');
    if (target.nextElementSibling?.hasAttribute('data-banner-differs')) target.nextElementSibling.remove();
  }

  function showAutofillDifference(target, patientValue) {
    target.classList.add('nursing-banner-differs');
    const note = document.createElement('span');
    note.className = 'nursing-banner-differs-note no-print';
    note.dataset.bannerDiffers = '';
    const english = window.getBorkeoLanguage?.() === 'en';
    note.innerHTML = english || !window.newTextHtml ? 'Banner:' : window.newTextHtml('nursing.bannerValue', 'Banner:');
    note.append(` ${patientValue}`);
    target.insertAdjacentElement('afterend', note);
  }

  function rowTargets(row) {
    if (!row) return [];
    return Array.from(row.querySelectorAll(
      'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"], .flex-line, .dot-line',
    ));
  }

  function fillIdentityRows(rows, identity) {
    const identityRow = rowTargets(rows[0]);
    setAutofillTarget(identityRow[0], identity.name);
    setAutofillTarget(identityRow[1], identity.age);
    setAutofillTarget(identityRow[2], identity.sex);

    const recordRow = rowTargets(rows[1]);
    setAutofillTarget(recordRow[0], identity.patientId);
    setAutofillTarget(recordRow[1], identity.entryTime);

    const locationRow = rowTargets(rows[2]);
    setAutofillTarget(locationRow[0], identity.ward);
    setAutofillTarget(locationRow[1], identity.room);
    setAutofillTarget(locationRow[2], identity.bed);
  }

  function fillPatientIdentityForms(patient, contextValues) {
    const storedTime = patient?.data?.['id:web_time'] || value('web_time');
    const identity = {
      ...contextValues,
      patientId: patient.caseNumber || patient.healthId || patient.patientKey || '',
      entryDate: patient.entryDate || patient?.data?.['id:web_date'] || value('web_date'),
      entryTime: storedTime,
    };

    document.querySelectorAll('.patient-id-card').forEach(card => {
      fillIdentityRows(Array.from(card.querySelectorAll('.field-row, .row-flex')), identity);
    });

    const firstNursePage = document.querySelector('.nurse-clinical-assessment-page[data-nurse-assessment-page="1"]');
    if (firstNursePage) {
      const rows = Array.from(firstNursePage.querySelectorAll('.row-flex'));
      fillIdentityRows(rows, identity);
      const admissionRow = rowTargets(rows[3]);
      setAutofillTarget(admissionRow[0], identity.entryDate);
      setAutofillTarget(admissionRow[1], identity.entryTime);
    }
  }

  function latestSavedFollowUp(patient) {
    let records;
    try { records = JSON.parse(patient?.data?.['system:dailyMonitoringRecords'] || '[]'); }
    catch { return null; }
    if (!Array.isArray(records)) return null;
    const validDateTime = raw => {
      const value = String(raw || '').replace(' ', 'T');
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return false;
      const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
      return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10) &&
        Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 &&
        (value.length === 16 || Number(value.slice(17, 19)) < 60);
    };
    return records.filter(record => record && validDateTime(record.dtVal))
      .sort((a, b) => String(a.dtVal).localeCompare(String(b.dtVal))).at(-1) || null;
  }

  const dischargeRxParts = {
    bid: ['m', 'e'], tid: ['m', 'a', 'e'], qid: ['m', 'a', 'e', 'n'],
    qd_m: ['m'], qd_a: ['a'], qd_e: ['e'], qd_n: ['n'],
  };

  function addDischargeMedicineRow(med = {}) {
    const body = document.getElementById('emr-discharge-rx-body');
    if (!body) return;
    const row = document.createElement('tr');
    row._preservedMedication = med;
    row.innerHTML = `
      <td><input data-med="name" type="text" aria-label="ឈ្មោះថ្នាំ" style="min-width:150px;width:100%;"></td>
      <td><select data-med="route" aria-label="ផ្លូវប្រើ" style="min-width:125px;width:100%;"></select></td>
      <td><input data-med="doseAmount" type="number" step="0.1" min="0" aria-label="កម្រិតថ្នាំ" style="width:55px;">
        <input data-med="unit" type="text" aria-label="ឯកតា" style="width:85px;"></td>
      <td><select data-med="scheduleType" aria-label="ពេលប្រើថ្នាំ"><option value="">ជ្រើសរើស</option>
        <option value="qd_m">QD ព្រឹក</option><option value="qd_a">QD ថ្ងៃ</option><option value="qd_e">QD ល្ងាច</option>
        <option value="qd_n">QD យប់</option><option value="bid">BID</option><option value="tid">TID</option>
        <option value="qid">QID</option><option value="qh">qH</option><option value="protocol">ពិធីសារ</option></select></td>
      <td><input data-med="m" type="number" step="0.1" min="0" aria-label="ព្រឹក" style="width:50px;"></td>
      <td><input data-med="a" type="number" step="0.1" min="0" aria-label="ថ្ងៃ" style="width:50px;"></td>
      <td><input data-med="e" type="number" step="0.1" min="0" aria-label="ល្ងាច" style="width:50px;"></td>
      <td><input data-med="n" type="number" step="0.1" min="0" aria-label="យប់" style="width:50px;"></td>
      <td><input data-med="d" type="number" step="1" min="0" aria-label="ចំនួនថ្ងៃ" style="width:48px;">
        <input data-med="total" type="text" aria-label="សរុប" style="width:54px;"></td>
      <td><input data-med="note" type="text" aria-label="សម្គាល់" style="min-width:100px;width:100%;"></td>
      <td><button type="button" class="btn-red no-print" aria-label="លុបថ្នាំ">−</button></td>`;
    body.append(row);
    const input = key => row.querySelector(`[data-med="${key}"]`);
    const routes = window.getMedicationRouteDefinitions?.() || [
      { value: 'po', khmer: 'លេប (PO)' }, { value: 'other_iv', khmer: 'ចាក់តាមសរសៃឈាម (IV)' },
      { value: 'other_im', khmer: 'ចាក់សាច់ដុំ (IM)' },
    ];
    input('route').add(new Option('ជ្រើសផ្លូវប្រើ', ''));
    routes.forEach(route => input('route').add(new Option(route.khmer, route.value)));
    const storedRoute = String(med.route || '');
    if (!routes.some(route => route.value === storedRoute)) input('route').add(new Option(`${storedRoute} (ពិនិត្យ)`, storedRoute));
    input('route').value = storedRoute;
    for (const key of ['name', 'unit', 'doseAmount', 'scheduleType', 'm', 'a', 'e', 'n', 'd', 'total', 'note']) {
      if (med[key] !== null && med[key] !== undefined) input(key).value = String(med[key]);
    }
    if (med.scheduleType && !Array.from(input('scheduleType').options).some(opt => opt.value === med.scheduleType)) {
      input('scheduleType').add(new Option(`${med.scheduleType} (ពិនិត្យ)`, med.scheduleType));
      input('scheduleType').value = med.scheduleType;
    }
    if (!['m','a','e','n'].some(key => med[key] !== null && med[key] !== undefined)) {
      const selected = dischargeRxParts[med.scheduleType] || [];
      for (const key of ['m','a','e','n']) input(key).value = selected.includes(key) ? (med.doseAmount || '') : '0';
    }
    input('scheduleType').addEventListener('change', () => {
      const selected = dischargeRxParts[input('scheduleType').value];
      for (const key of ['m','a','e','n']) input(key).value = selected
        ? (selected.includes(key) ? input('doseAmount').value : '0') : '';
    });
    row.querySelector('button.btn-red').addEventListener('click', () => row.remove());
  }

  function collectDischargeMedications() {
    return Array.from(document.querySelectorAll('#emr-discharge-rx-body tr')).map(row => {
      const read = key => String(row.querySelector(`[data-med="${key}"]`)?.value || '').trim();
      return {
        ...(row._preservedMedication || {}),
        ...Object.fromEntries(['name','route','unit','doseAmount','scheduleType','m','a','e','n','d','total','note']
          .map(key => [key, read(key)])),
      };
    }).filter(med => med.name);
  }

  function fillDischargePrescription(patient) {
    const body = document.getElementById('emr-discharge-rx-body');
    if (!body || body.dataset.patientKey === patient.patientKey) return;
    body.dataset.patientKey = patient.patientKey;
    body.replaceChildren();
    const last = latestSavedFollowUp(patient);
    const saved = patient.discharge || patient.data?.['system:discharge'];
    const selected = Array.isArray(saved?.medications) ? saved.medications
      : Array.isArray(last?.medications) ? last.medications : [];
    selected.forEach(addDischargeMedicineRow);
    const description = document.getElementById('emr-discharge-rx-source');
    if (description) description.textContent = last
      ? `ចម្លងថ្នាំពីការតាមដានចុងក្រោយ (${String(last.dtVal).replace('T', ' ')}); សូមពិនិត្យ និងកែសម្រួលមុនបញ្ចេញអ្នកជំងឺ។`
      : 'គ្មានកំណត់ត្រាតាមដានដែលមានថ្ងៃម៉ោងទេ។ បញ្ចូលថ្នាំពេលចេញដោយដៃ និងពិនិត្យមុនរក្សាទុក។';
  }

  function fillDischargeForm(patient) {
    if (!document.getElementById('emr-discharge-view')) return;
    const data = patient.data || {};
    const admissionDate = patient.entryDate || data['scope:registration:id:web_date'] || data['id:web_date'] || '';
    const admissionTime = data['scope:registration:id:web_time'] || data['id:web_time'] || '';
    setValue('emr_discharge_department', localized(patient.departmentNameKh, patient.departmentNameEn));
    const saved = patient.discharge || data['system:discharge'] || {};
    setValue('emr_discharge_admission_at', saved.admissionAt ||
      (admissionDate && admissionTime ? `${admissionDate}T${admissionTime}` : ''));
    setValue('emr_discharge_admission_diagnosis', saved.admissionDiagnosis ||
      data['scope:medical:id:emr_pmrs_ipd_diagnosis'] || data['scope:registration:id:web_diag_in'] || data['id:web_diag_in'] || '');
    setValue('emr_discharge_admission_icd10', saved.admissionIcd10 ||
      data['scope:medical:id:emr_pmrs_ipd_icd10'] || data['id:web_diag_in_icd10'] || '');
    // The doctor must enter the real discharge date and time. Never default it
    // to the current time merely because the discharge page was opened.
    setValue('emr_discharge_datetime', saved.dischargeAt || '', true);
    setValue('emr_discharge_diagnosis', saved.dischargeDiagnosis || '');
    setValue('emr_discharge_icd10', saved.dischargeIcd10 || '');
    setValue('emr_discharge_instructions', saved.patientInstructions || '');
    // Saved main / secondary list; a discharge saved before v41.6 keeps its single code as the main one.
    window.restoreEmrDiagnoses?.('discharge', Array.isArray(saved.dischargeDiagnoses) ? saved.dischargeDiagnoses : '');
    const summaryButton = document.getElementById('emr-summary-print-button');
    if (summaryButton) summaryButton.hidden = !saved.dischargeAt;
    setValue('emr_discharge_outcome', saved.outcome || '');
    setValue('emr_discharge_status', saved.status || '');
    setValue('emr_discharge_followup', saved.followUpDate || '');
    setValue('emr_referral_destination_type', saved.referralDestinationType || '');
    setValue('emr_referral_destination_name', saved.referralDestinationName || '');
    setValue('emr_referral_transport', saved.referralTransport || '');
    updateReferralFields();
    const deceased = document.getElementById('emr_discharge_deceased');
    if (deceased) deceased.checked = saved.deceased === true;
    fillDischargePrescription(patient);
  }

  function updateDailyGate(patient) {
    const lock = document.getElementById('daily-followup-lock');
    const content = document.getElementById('daily-followup-content');
    if (!lock || !content) return;
    const role = String(window.emrSession?.user?.activeRole || '').toUpperCase();
    const vitalEntryRole = role === 'NURSE' || role === 'MIDWIFE';
    const completed = vitalEntryRole || patient?.medicalRecordCompleted === true ||
      patient?.data?.['system:medicalRecordCompleted'] === true ||
      patient?.data?.['system:medicalRecordCompleted'] === 'true';
    lock.hidden = completed;
    content.hidden = !completed;
    const link = document.getElementById('open-medical-record');
    if (link) {
      const next = new URL(window.location.href);
      next.searchParams.set('view', 'medical');
      link.href = next.pathname + next.search;
    }
  }

  function applyNursingCare(patient) {
    if (requestedView !== 'nursing') return;

    // FINAL RULE: Obstetric ward only -> Midwife. Every other ward -> Nurse.
    // New bed links provide roomCode and room names, so the role is derived from
    // the actual bed/ward rather than from the parent department. The care query
    // parameter is used only for backward compatibility with older saved links.
    const routedRoomName = `${parameters.get('roomNameKh') || ''} ${parameters.get('roomNameEn') || ''}`.trim();
    const hasRoutedRoom = Boolean(requestedRoomCode || routedRoomName);
    const isObstetricWard = String(requestedRoomCode).trim().toLowerCase() === 'obstetric' ||
      /បន្ទប់សម្ភព|obstetric ward|maternity ward/i.test(routedRoomName);
    const care = hasRoutedRoom
      ? (isObstetricWard ? 'obstetric' : 'nurse')
      : (requestedCare === 'obstetric' ? 'obstetric' : 'nurse');
    const formName = care === 'obstetric' ? 'maternity' : 'general';
    window.switchNursingForm?.(formName);

    // Do not let a bed-based Nursing Documents action expose the other role.
    // Patient Rights and Agreement remain available as the two auxiliary tabs
    // created inside #sub_nursing by emr-patient-record.js.
    const selector = document.getElementById('nursing_process_selector');
    if (selector) {
      selector.value = formName;
      selector.closest('.nursing-process-selector')?.setAttribute('hidden', '');
      selector.disabled = true;
    }
    document.querySelectorAll('#sub_nursing .nursing-form-pane').forEach(pane => {
      const allowed = pane.id === (formName === 'maternity' ? 'nursing_maternity' : 'nursing_general');
      pane.classList.toggle('active', allowed);
      pane.hidden = !allowed;
      pane.setAttribute('aria-hidden', String(!allowed));
    });
    const heading = document.querySelector('#sub_nursing .nursing-process-heading span');
    if (heading) heading.textContent = text(care === 'obstetric' ? 'obstetricCare' : 'generalCare');
  }

  async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    if (window.emrSession?.csrfToken) {
      csrfToken = window.emrSession.csrfToken;
      return csrfToken;
    }
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Authentication required.');
    csrfToken = (await response.json()).csrfToken;
    return csrfToken;
  }

  async function saveDischarge() {
    if (!currentPatient) return;
    const dischargeAt = value('emr_discharge_datetime');
    const dischargeDiagnosis = value('emr_discharge_diagnosis');
    const outcome = value('emr_discharge_outcome');
    const status = value('emr_discharge_status');
    if (!dischargeAt || !dischargeDiagnosis || !outcome || !status) {
      window.alert(text('dischargeRequired'));
      return;
    }
    const statusNode = document.getElementById('emr-discharge-status');
    const button = document.getElementById('emr-save-discharge');
    button.disabled = true;
    statusNode.textContent = text('saveDaily');
    try {
      const response = await fetch('/api/patient-admission', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
        body: JSON.stringify({
          patientKey: currentPatient.patientKey, action: 'discharge',
          dischargeDate: dischargeAt.slice(0, 10),
          dischargeDepartment: value('emr_discharge_department'),
          admissionDiagnosis: value('emr_discharge_admission_diagnosis'),
          admissionIcd10: value('emr_discharge_admission_icd10'),
          admissionAt: value('emr_discharge_admission_at'),
          dischargeDiagnosis, dischargeIcd10: value('emr_discharge_icd10'), dischargeAt,
          dischargeDiagnoses: window.collectEmrDiagnoses?.('discharge') || [],
          patientInstructions: value('emr_discharge_instructions'),
          outcome, status, followUpDate: value('emr_discharge_followup'),
          deceased: document.getElementById('emr_discharge_deceased')?.checked === true,
          referralDestinationType: value('emr_referral_destination_type'),
          referralDestinationName: value('emr_referral_destination_name'),
          referralTransport: value('emr_referral_transport'),
          medications: collectDischargeMedications(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unknown error');
      setPatientContext(result.patient);
      statusNode.dataset.state = 'saved';
      statusNode.textContent = text('dischargeSaved');
      document.dispatchEvent(new CustomEvent('emr:patient-saved', { detail: { patient: result.patient } }));
    } catch (error) {
      statusNode.dataset.state = 'error';
      statusNode.textContent = text('saveError') + error.message;
      button.disabled = false;
    }
  }

  // v41.6: printable discharge summary, built only from the SAVED discharge
  // (never from unsaved changes on the screen).
  function printDischargeSummary() {
    const patient = currentPatient || {};
    const saved = patient.discharge || patient.data?.['system:discharge'] || {};
    if (!saved.dischargeAt) return;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const lang = language() === 'english' ? 'en' : 'km';
    const row = (key, val) => (val ? `<tr><th>${esc(text(key))}</th><td>${esc(val).replace(/\n/g, '<br>')}</td></tr>` : '');
    const list = Array.isArray(saved.dischargeDiagnoses) && saved.dischargeDiagnoses.length ? saved.dischargeDiagnoses
      : (saved.dischargeIcd10 ? [{ icd10: saved.dischargeIcd10, text: '', main: true }] : []);
    const main = list.find((d) => d.main) || list[0];
    const secondary = list.filter((d) => d !== main);
    const option = (key) => (key ? text(key === 'against-advice' ? 'againstAdvice' : key) : '');
    const meds = Array.isArray(saved.medications) ? saved.medications : [];
    const letterhead = window.EmrLetterhead?.renderLetterhead({ lang, title: text('dischargeSummary') }) || `<h2>${esc(text('dischargeSummary'))}</h2>`;
    const grid = window.EmrLetterhead?.renderPatientGrid({ lang, caseId: patient.caseNumber || patient.healthId || '', department: saved.department || '',
      fullName: patient.fullName || '', sex: patient.sex || '', age: patient.age || '', diagnosis: saved.dischargeDiagnosis || '' }) || '';
    let layout = document.getElementById('discharge-summary-print-layout');
    if (!layout) { layout = document.createElement('div'); layout.id = 'discharge-summary-print-layout'; document.body.appendChild(layout); }
    layout.innerHTML = `<div class="discharge-summary-sheet">${letterhead}${grid}
      <table class="discharge-summary-table">
        ${row('admissionAt', String(saved.admissionAt || '').replace('T', ' '))}${row('dischargeAt', String(saved.dischargeAt || '').replace('T', ' '))}
        ${row('admissionDiagnosis', [saved.admissionIcd10, saved.admissionDiagnosis].filter(Boolean).join(' · '))}
        ${row('mainDiagnosis', main ? [main.icd10, main.text].filter(Boolean).join(' · ') : '')}
        ${row('secondaryDiagnoses', secondary.map((d) => [d.icd10, d.text].filter(Boolean).join(' · ')).join('\n'))}
        ${row('dischargeDiagnosis', saved.dischargeDiagnosis)}
        ${row('outcome', option(saved.outcome))}${row('dischargeStatus', option(saved.status))}
        ${row('followUp', saved.followUpDate)}${row('patientInstructions', saved.patientInstructions)}
      </table>
      ${meds.length ? `<h4>${esc(text('dischargeMedications'))}</h4><table class="discharge-summary-table"><tbody>${meds.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc([m.doseAmount, m.unit, m.route].filter(Boolean).join(' '))}</td><td>${esc([m.m, m.a, m.e, m.n].map((x) => x || '0').join('-'))}</td><td>${esc([m.d, m.total].filter(Boolean).join(' / '))}</td><td>${esc(m.note || '')}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="discharge-summary-sign"><div></div><div class="discharge-summary-sign-line"></div></div>
    </div>`;
    return window.printEmrReport?.({ selectors: ['#discharge-summary-print-layout'], classes: ['print-discharge-summary'], title: text('dischargeSummary') });
  }
  window.printDischargeSummary = printDischargeSummary;

  function restoreDailyMonitoringRecords(records) {
    const feed = document.getElementById('daily_monitoring_feed');
    if (!feed || typeof originalSaveDailyMonitoring !== 'function') return;
    feed.innerHTML = '';
    restoringDailyRecords = true;
    records.slice().reverse().forEach(record => {
      window.resetMonForm?.();
      const fields = {
        mon_input_date: record.dtVal, mon_input_temp: record.temp,
        mon_input_bp_sys: record.bp_sys, mon_input_bp_dia: record.bp_dia,
        mon_input_pulse: record.pulse, mon_input_resp: record.resp,
        mon_input_spo2: record.spo2, mon_input_evol: record.evol,
        mon_input_conclusion: record.conclusion,
      };
      Object.entries(fields).forEach(([id, fieldValue]) => setValue(id, fieldValue || ''));
      window.populateMonitoringTreatmentForm?.(record);
      // v40.9: rebuild the card from the saved note itself, unchanged.
      originalSaveDailyMonitoring(record);
    });
    restoringDailyRecords = false;
    if (document.getElementById('mon_modal')?.classList.contains('daily-followup-entry-form')) {
      prepareDailyEntryForm(false);
    }
    window.scheduleNursingChartRender?.();
  }

  function connectDailyPersistence() {
    if (typeof window.openMonModal === 'function') {
      const originalOpen = window.openMonModal;
      window.openMonModal = function openEmbeddedDailyFollowup() {
        originalOpen();
        if (document.getElementById('mon_modal')?.classList.contains('daily-followup-entry-form')) {
          window.setTimeout(() => {
            document.getElementById('mon_modal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 0);
        }
      };
    }
    if (typeof window.saveDailyMonitoring === 'function') {
      originalSaveDailyMonitoring = window.saveDailyMonitoring;
      window.saveDailyMonitoring = function saveAndPersistDailyMonitoring(restoreRecord) {
        const result = originalSaveDailyMonitoring(restoreRecord);
        if (result === false) return false;
        if (!restoringDailyRecords) {
          window.setTimeout(() => {
            Promise.resolve(window.savePatientRecord?.()).then(saved => {
              if (saved !== false && document.getElementById('mon_modal')?.classList.contains('daily-followup-entry-form')) {
                prepareDailyEntryForm(false);
              }
            });
          }, 0);
        }
        return result;
      };
    }
    if (typeof window.deleteMonitoringRecord === 'function') {
      const originalDelete = window.deleteMonitoringRecord;
      window.deleteMonitoringRecord = function deleteAndPersistDailyMonitoring(button) {
        originalDelete(button);
        if (!restoringDailyRecords) window.setTimeout(() => void window.savePatientRecord?.(), 0);
      };
    }
    window.restoreDailyMonitoringRecords = restoreDailyMonitoringRecords;
  }

  window.openDischargeFromFollowUp = async function openDischargeFromFollowUp(button) {
    const role = String(window.emrSession?.user?.activeRole || '').toUpperCase();
    if (!['DOCTOR', 'ADMIN','VICE_DIRECTOR'].includes(role)) return;
    if (!currentPatient?.patientKey) {
      window.alert('សូមបើកកំណត់ត្រាអ្នកជំងឺជាមុនសិន។');
      return;
    }
    if (button) button.disabled = true;
    try {
      if (typeof window.savePatientRecord === 'function' && await window.savePatientRecord() === false) return;
      const url = new URL(window.location.href);
      url.searchParams.set('patient', currentPatient.patientKey);
      url.searchParams.set('view', 'discharge');
      window.location.assign(url.href);
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  };

  function showOnlyPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
      page.classList.toggle('active', page.id === pageId);
    });
  }

  function setupTriageFastEntry(options = {}) {
    if (requestedView !== 'triage') return;
    const page = document.getElementById('page2');
    if (!page) return;

    // Clinical checkboxes remain clickable/touchable, but the Tab key skips them
    // so the nurse can move rapidly through vital-sign typing fields only.
    page.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(control => {
      control.tabIndex = -1;
    });

    const vitalOrder = [
      'p2_spo2',
      'p2_pulse',
      'p2_temp',
      'p2_bp_sys',
      'p2_bp_dia',
      'p2_resp',
      'p2_weight',
      'p2_height',
    ];
    vitalOrder.forEach((id, index) => {
      const control = document.getElementById(id);
      if (!control) return;
      control.tabIndex = index + 1;
      control.autocomplete = 'off';
      control.dataset.triageVitalOrder = String(index + 1);
    });

    const first = document.getElementById('p2_spo2');
    if (first && options.focus !== false) {
      window.setTimeout(() => {
        if (!document.body.contains(first)) return;
        first.focus({ preventScroll: true });
        first.select?.();
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, Number(options.delay || 120));
    }
  }

  function activateRequestedPanel() {
    if (!requestedView) return;
    const activeRole = String(window.emrSession?.user?.activeRole || window.sessionStorage?.getItem('borkeo-active-role') || '').toUpperCase();
    if (requestedView === 'triage' || activeRole === 'TRIAGE') {
      setupTriageFastEntry({ focus: false });
      return;
    }
    if (requestedView === 'opd' || requestedView === 'opd-paraclinic') window.switchOpdTab?.('opd');
    if (requestedView === 'medical') window.switchOpdTab?.('ipd');
    if (requestedView === 'medical') document.getElementById('shared_rx_block')?.removeAttribute('hidden');
    if (requestedView === 'nursing') window.switchOpdTab?.('nursing');
    const target = {
      opd: document.getElementById('sub_opd'), 'opd-paraclinic': document.getElementById('sub_opd'), medical: document.getElementById('sub_ipd'), daily: document.getElementById('emr-daily-view'),
      nursing: document.getElementById('sub_nursing'), discharge: document.getElementById('emr-discharge-view'),
    }[requestedView] || document.getElementById('sub_ipd');
    document.querySelectorAll('#page3 > .sub-tab').forEach(panel => {
      const isTarget = panel === target;
      panel.classList.toggle('active', isTarget);
      panel.hidden = !isTarget;
      panel.setAttribute('aria-hidden', String(!isTarget));
    });
    if (target) {
      target.hidden = false;
      target.removeAttribute('aria-hidden');
      target.classList.add('active');
    }
    if (requestedView === 'nursing') {
      window.switchOpdTab?.('nursing');
      window.switchNursingSection?.('care');
      applyNursingCare(currentPatient || {});
      const selector = document.getElementById('nursing_process_selector');
      const form = selector && selector.value ? selector.value : 'general';
      window.switchNursingForm?.(form);
      window.scheduleNursingChartRender?.();
    }
  }

  function showRequestedView() {
    const isOpdParaclinic = new URLSearchParams(location.search).get('view') === 'opd-paraclinic';
    document.documentElement.classList.toggle('opd-paraclinic-review', isOpdParaclinic);
    if (!requestedView) return;
    // Registration is the first workflow step, not a bed/clinical direct view.
    // Do not inject the bed-map back link or a second Register heading there.
    if (requestedView === 'register' || requestedView === 'registration') return;
    document.documentElement.classList.add('bed-direct-view', `bed-direct-${requestedView}`);
    document.documentElement.dataset.directClinicalView = requestedView;
    document.body.dataset.clinicalView = requestedView;
    document.querySelector('.dashboard-header')?.setAttribute('hidden', '');
    document.querySelector('.step-wrapper')?.setAttribute('hidden', '');

    const activeRole = String(window.emrSession?.user?.activeRole || window.sessionStorage?.getItem('borkeo-active-role') || '').toUpperCase();
    if (requestedView === 'triage' || activeRole === 'TRIAGE') {
      showOnlyPage('page2');
      setupTriageFastEntry();
      return;
    }

    document.querySelector('#page3 > .inner-tabs')?.setAttribute('hidden', '');
    createWorkspaceNavigation();
    createPatientSummaryDrawer();
    showOnlyPage('page3');
    activateRequestedPanel();
    const back = document.getElementById('inpatient-back-link');
    const wardCode = parameters.get('department');
    if (back && (requestedView === 'opd' || requestedView === 'opd-paraclinic')) { back.href = '/opd-queue'; back.querySelector('span')?.setAttribute('data-iw-key','opdBack'); }
    else if (back && wardCode) back.href = `/departments?ward=${encodeURIComponent(wardCode)}`;
  }

  function summaryEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function summaryValue(value) {
    if (value === true) return '✓';
    if (value === false || value === null || value === undefined) return '';
    return String(value).trim();
  }

  function buildSummaryLabelMap() {
    const map = new Map();
    document.querySelectorAll('[data-emr-storage-key]').forEach(control => {
      const key = control.dataset.emrStorageKey;
      if (!key) return;
      const labelHost = control.closest('.input-group, .form-group, .modern-grid > div, td, .opd-field, .ipd-field, .opd-section, .opd-checkbox-grid') || control.parentElement;
      const label = labelHost?.querySelector?.('label, .label-text, [data-key], .opd-section-title, strong');
      const raw = label?.textContent || control.getAttribute('aria-label') || control.id || key;
      map.set(key, String(raw).replace(/\s+/g, ' ').trim());
    });
    return map;
  }

  function readRecordField(data, id) {
    const scopes = ['registration','triage','medical','nursing'];
    for (const scope of scopes) {
      const key = `scope:${scope}:id:${id}`;
      if (Object.prototype.hasOwnProperty.call(data || {}, key)) return summaryValue(data[key]);
    }
    return '';
  }

  function parseJsonArray(raw) {
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function parseStoredObject(raw) {
    if (!raw) return null;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  }

  function medicationSummary(raw) {
    const rows = parseJsonArray(raw);
    return rows.map(row => {
      const name = row.name || row.medicine || row.medication || row.drug || '';
      const dose = row.doseAmount || row.dose || row.strength || '';
      const unit = row.unit || '';
      const schedule = row.scheduleType || row.schedule || row.frequency || row.timing || '';
      const route = row.route || '';
      const days = row.d || row.days || row.duration || '';
      return [name, dose && unit ? `${dose} ${unit}` : dose, route, schedule, days ? `${days}d` : ''].filter(Boolean).join(' · ');
    }).filter(Boolean);
  }

  function dischargeSummary(record) {
    return parseStoredObject(record?.data?.['system:ipdDischargeSummary']);
  }

  function paraclinicSummary(orders) {
    return (Array.isArray(orders) ? orders : []).map(order => {
      const result = order.result || {};
      const textParts = [];
      if (order.modality) textParts.push(order.modality);
      if (order.request?.examination) textParts.push(order.request.examination);
      if (result.findings) textParts.push(result.findings);
      if (result.conclusion) textParts.push(result.conclusion);
      if (Array.isArray(result.items) && result.items.length) {
        textParts.push(result.items.map(item => `${item.name || item.code || ''}: ${[item.value, item.unit].filter(Boolean).join(' ')}${item.flag ? ` [${item.flag}]` : ''}${item.comment ? ` (${item.comment})` : ''}`).join('; '));
      }
      return textParts.filter(Boolean).join(' — ');
    }).filter(Boolean);
  }

  function encounterSummaryFacts(record) {
    const data = record?.data || {};
    const mode = String(record.serviceMode || '').toLowerCase();
    const summary = dischargeSummary(record);
    const facts = [];
    const add = (section, label, value, priority=50) => {
      const clean = summaryValue(value);
      if (!clean) return;
      facts.push({ section, label, value: clean, priority });
    };
    if (mode === 'opd') {
      add('OPD', 'Reason for visit', readRecordField(data, 'pmrs_chief_complaint') || readRecordField(data, 'scope:triage:id:pmrs_chief_complaint'), 1);
      add('OPD', 'Diagnosis', record.diagnosis || readRecordField(data, 'emr_pmrs_opd_diagnosis') || readRecordField(data, 'diag_input'), 2);
      const meds = medicationSummary(data['system:opdMedications']);
      add('OPD', 'Treatment', meds.length ? meds.join(' | ') : readRecordField(data, 'opd_treatment'), 3);
      return facts.sort((a,b)=>a.priority-b.priority);
    }
    if (mode === 'ipd') {
      const admission = summary?.admission || {};
      add('IPD Admission', 'Admission reason', admission.chiefComplaint || readRecordField(data, 'pmrs_chief_complaint') || readRecordField(data, 'ipd_history_present_illness'), 1);
      add('IPD Admission', 'Admission diagnosis', admission.diagnosis || record.diagnosis || readRecordField(data, 'emr_pmrs_ipd_diagnosis') || readRecordField(data, 'diag_input'), 2);
      if (summary?.paraclinic?.length) {
        const tests = summary.paraclinic.flatMap(order => {
          const rows = [];
          if (order.modality) rows.push(order.modality);
          if (order.requested) rows.push(order.requested);
          if (order.findings) rows.push(order.findings);
          if (order.items?.length) rows.push(order.items.map(item => `${item.name}: ${[item.value,item.unit].filter(Boolean).join(' ')}${item.flag ? ` [${item.flag}]` : ''}`).join('; '));
          if (order.recommendation) rows.push(order.recommendation);
          return rows.filter(Boolean).join(' — ');
        });
        add('IPD Course', 'Paraclinic findings', tests.join(' || '), 10);
      } else {
        const fallback = paraclinicSummary(record.paraclinicOrders);
        if (fallback.length) add('IPD Course', 'Paraclinic findings', fallback.join(' || '), 10);
        add('IPD Course', 'Investigations requested', readRecordField(data, 'inv_list') || readRecordField(data, 'ipd_investigations'), 11);
      }
      const treatment = summary?.treatment?.all?.length ? summary.treatment.all : [
        ...medicationSummary(data['system:initialIpdMedications']),
        ...parseJsonArray(data['system:dailyMonitoringRecords']).flatMap(day => medicationSummary(day?.medications)),
      ];
      add('IPD Course', 'Treatment', [...new Set(treatment)].join(' | '), 20);
      if (summary?.evolution?.length) {
        add('IPD Course', 'Evolution', summary.evolution.map((entry,index) => {
          const heading = entry.date || `Day ${index+1}`;
          return `${heading}: ${[entry.vitals,entry.progress,entry.conclusion,entry.medications?.length ? `Treatment: ${entry.medications.join('; ')}` : ''].filter(Boolean).join(' | ')}`;
        }).join(' || '), 30);
      } else {
        const daily = parseJsonArray(data['system:dailyMonitoringRecords']);
        add('IPD Course', 'Evolution', daily.map((entry,index)=>`${entry.dtVal || `Day ${index+1}`}: ${[entry.evol,entry.conclusion].filter(Boolean).join(' | ')}`).filter(Boolean).join(' || '), 30);
      }
      const discharge = summary?.discharge || data['system:discharge'] || {};
      add('IPD Discharge', 'Discharge diagnosis', discharge.diagnosis || discharge.dischargeDiagnosis, 1);
      add('IPD Discharge', 'Outcome', discharge.outcome, 2);
      add('IPD Discharge', 'Status', discharge.status || discharge.dischargeStatus, 3);
      add('IPD Discharge', 'Next follow-up', discharge.followUpDate || discharge.followUp, 4);
    }
    return facts.sort((a,b)=>a.priority-b.priority);
  }

  // Compatibility alias retained for UI tests and integrations that refer to the
  // deterministic summary facts helper by its earlier name.
  function importantFacts(record) {
    return encounterSummaryFacts(record);
  }

  function encounterSummaryHtml(record) {
    const facts = encounterSummaryFacts(record);
    const mode = String(record.serviceMode || '').toUpperCase() || 'ENCOUNTER';
    const dept = record.departmentNameEn || record.departmentNameKh || '—';
    const date = record.entryDate || (record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '—');
    const chips = [
      `${mode} · ${dept}`,
      record.caseNumber ? `Case ${record.caseNumber}` : '',
      record.dischargeDate ? `Discharged ${record.dischargeDate}` : ''
    ].filter(Boolean);
    const sections = {};
    facts.forEach(f => { (sections[f.section] ||= []).push(f); });
    const summary = dischargeSummary(record);
    return `<article class="patient-summary-encounter">
      <header><div><span class="patient-summary-date">${summaryEscape(date)}</span><strong>${summaryEscape(record.fullName || 'Patient')}</strong></div><div class="patient-summary-chips">${chips.map(c=>`<span>${summaryEscape(c)}</span>`).join('')}</div></header>
      ${mode === 'IPD' && summary?.text ? `<div class="patient-summary-generated-note"><strong>Discharge summary</strong><div>${summaryEscape(summary.text)}</div></div>` : ''}
      <div class="patient-summary-grid">${Object.entries(sections).map(([section,rows])=>`<section><h4>${summaryEscape(section)}</h4>${rows.map(row=>`<div class="patient-summary-row"><b>${summaryEscape(row.label)}</b><span>${summaryEscape(row.value)}</span></div>`).join('')}</section>`).join('')}</div>
    </article>`;
  }

  async function enrichHistoricalParaclinic(records) {
    return Promise.all(records.map(async record => {
      try {
        const response = await fetch(`/api/paraclinic/orders?patientKey=${encodeURIComponent(record.patientKey)}`, { credentials:'same-origin', cache:'no-store' });
        if (!response.ok) return { ...record, paraclinicOrders: [] };
        const result = await response.json().catch(()=>({}));
        return { ...record, paraclinicOrders: Array.isArray(result.orders) ? result.orders : [] };
      } catch {
        return { ...record, paraclinicOrders: [] };
      }
    }));
  }

  function createPatientSummaryDrawer() {
    if (!['opd','medical'].includes(requestedView)) return;
    if (document.getElementById('patient-summary-drawer')) return;
    const tab = document.createElement('button');
    tab.type='button'; tab.id='patient-summary-tab'; tab.className='patient-summary-tab';
    tab.setAttribute('aria-expanded','false'); tab.innerHTML='<i class="fa-solid fa-clock-rotate-left"></i><span>Previous Records</span>';
    const drawer = document.createElement('aside');
    drawer.id='patient-summary-drawer'; drawer.className='patient-summary-drawer'; drawer.setAttribute('aria-hidden','true');
    drawer.innerHTML='<header><div><h3>Previous Patient Records</h3><p>Only previous OPD/IPD encounters are shown. The current encounter is excluded.</p></div><button type="button" data-summary-close aria-label="Close">×</button></header><div class="patient-summary-body"><div class="patient-summary-loading">Loading…</div></div>';
    document.body.append(tab,drawer);
    const close=()=>{drawer.classList.remove('open');tab.classList.remove('open');tab.setAttribute('aria-expanded','false');drawer.setAttribute('aria-hidden','true');};
    const open=async()=>{
      drawer.classList.add('open'); tab.classList.add('open'); tab.setAttribute('aria-expanded','true'); drawer.setAttribute('aria-hidden','false');
      const body=drawer.querySelector('.patient-summary-body');
      const patientKey=currentPatient?.patientKey || parameters.get('patient') || '';
      if (!patientKey) { body.innerHTML='<div class="patient-summary-empty">No patient selected.</div>'; return; }
      body.innerHTML='<div class="patient-summary-loading">Loading previous records…</div>';
      try {
        const response=await fetch(`/api/patient-history?patientKey=${encodeURIComponent(patientKey)}`,{credentials:'same-origin',cache:'no-store'});
        const result=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(result.error||'Unable to load previous patient records.');
        const rows=(result.history||[]).filter(record => record.patientKey !== patientKey && ['opd','ipd'].includes(String(record.serviceMode||'').toLowerCase()));
        const oldRows=await enrichHistoricalParaclinic(rows);
        const patient=result.history?.[0] || currentPatient || {};
        body.innerHTML=`<section class="patient-summary-demographics"><div><b>${summaryEscape(patient.fullName||currentPatient?.fullName||'—')}</b><span>${summaryEscape(patient.sex||currentPatient?.sex||'—')} · ${summaryEscape(patient.age||currentPatient?.age||'—')}</span></div><div><span>Health ID</span><b>${summaryEscape(patient.healthId||currentPatient?.healthId||'—')}</b></div><div><span>Current case</span><b>${summaryEscape(currentPatient?.caseNumber||patient.caseNumber||'—')}</b></div></section>${oldRows.length ? oldRows.map(encounterSummaryHtml).join('') : '<div class="patient-summary-empty">No previous OPD/IPD records for this patient.</div>'}`;
      } catch(error) { body.innerHTML=`<div class="patient-summary-error">${summaryEscape(error.message)}</div>`; }
    };
    tab.addEventListener('click',()=>{ if(drawer.classList.contains('open')) close(); else void open(); });
    drawer.querySelector('[data-summary-close]').addEventListener('click',close);
  }

  function initializeWrappingTextareas() {
    const fit = textarea => {
      if (!(textarea instanceof HTMLTextAreaElement) || textarea.hasAttribute('data-fixed-height')) return;
      textarea.classList.add('emr-auto-grow-textarea');
      textarea.style.height = 'auto';
      const minHeight = Number.parseFloat(getComputedStyle(textarea).minHeight) || 0;
      textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
    };
    const scan = root => {
      if (root instanceof HTMLTextAreaElement) fit(root);
      root.querySelectorAll?.('textarea:not([data-fixed-height])').forEach(fit);
    };
    scan(document);
    document.addEventListener('input', event => {
      if (event.target instanceof HTMLTextAreaElement) fit(event.target);
    });
    document.addEventListener('focusin', event => {
      if (event.target instanceof HTMLTextAreaElement) fit(event.target);
    });
    window.addEventListener('resize', () => scan(document));
    new MutationObserver(records => records.forEach(record => {
      record.addedNodes.forEach(node => { if (node.nodeType === Node.ELEMENT_NODE) scan(node); });
    })).observe(document.body, { childList: true, subtree: true });
  }

  function refreshLanguage() {
    document.querySelectorAll('[data-iw-key]').forEach(node => {
      node.textContent = text(node.dataset.iwKey);
    });
    const title = document.getElementById('inpatient-view-title');
    if (title) title.textContent = text(requestedView || 'medical');
    if (currentPatient) setPatientContext(currentPatient, { labelsOnly: true });
    document.querySelectorAll('#mon_modal label').forEach(label => {
      if (label.querySelector('.fa-capsules')) label.lastChild.textContent = ` ${text('treatment')}`;
    });
  }

  function customizeMedicalSaveButton() {
    if (requestedView !== 'medical') return;
    const button = document.querySelector('#sub_ipd .emr-save-button span');
    if (button) button.textContent = text('saveMedical');
  }

  function initialize() {
    document.documentElement.dataset.emrBuild = BUILD_VERSION;
    initializeWrappingTextareas();
    ensureOpdDispositionPanel();
    document.querySelector('[data-key="tab_rx"]')?.closest('.step-item')?.remove();
    document.querySelector('[data-key="tab_discharge"]')?.closest('.step-item')?.remove();
    document.getElementById('shared_rx_block')?.setAttribute('hidden', '');
    document.body.classList.add('icon-only-step-highlight');
    createDailyView();
    createDischargeView();
    void loadFollowupDatePolicy();
    connectDailyPersistence();
    showRequestedView();
    refreshLanguage();
    window.setTimeout(customizeMedicalSaveButton, 0);
    // emr-patient-record initializes after this script and may choose the IPD
    // panel from registration data. Re-apply an explicit bed action afterward.
    window.setTimeout(activateRequestedPanel, 0);

    document.addEventListener('emr:patient-loaded', event => {
      setPatientContext(event.detail.patient);
      activateRequestedPanel();
      window.setTimeout(activateRequestedPanel, 0);
      if (requestedView === 'triage') setupTriageFastEntry({ delay: 80 });
    });
    window.addEventListener('emr-session-ready', () => {
      ensureOpdDispositionPanel();
      ensureFollowupDatePolicyPanel();
      void loadFollowupDatePolicy();
      if (requestedView === 'daily') updateDailyGate(currentPatient || {});
    });

    document.addEventListener('emr:patient-saved', event => {
      setPatientContext(event.detail.patient);
      if (requestedView === 'medical') {
        const status = document.getElementById('emr-record-status');
        if (status) status.textContent = text('medicalComplete');
      }
    });
    // Both language controls use one event. Do not refill clinical forms or reopen tabs.
    let languageRefreshPending = false;
    const scheduleLanguageRefresh = () => {
      if (languageRefreshPending) return;
      languageRefreshPending = true;
      window.setTimeout(() => { languageRefreshPending = false; refreshLanguage(); }, 0);
    };
    document.getElementById('langBtn')?.addEventListener('click', () => {
      if (typeof window.setBorkeoLanguage !== 'function') scheduleLanguageRefresh();
    });
    window.addEventListener('borkeo-language-change', scheduleLanguageRefresh);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
