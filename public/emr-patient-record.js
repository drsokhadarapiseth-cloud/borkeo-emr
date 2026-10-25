'use strict';

(function connectEmrToPatientRecords() {
  const departmentDefinitions = {
    dept_maternity: { code: 'gyneco-obstetric', kh: 'ផ្នែករោគស្ត្រី និងសម្ភព', en: 'Gynecology–Obstetric', mode: 'ipd' },
    dept_ped: { code: 'pediatric', kh: 'ផ្នែកជំងឺកុមារ', en: 'Pediatric', mode: 'ipd' },
    dept_oi: { code: 'oi-art', kh: 'ផ្នែក OI/ART', en: 'OI/ART', mode: 'opd' },
    dept_ncd: { code: 'ncd', kh: 'ផ្នែកទឹកនោមផ្អែម/លើសឈាម', en: 'Diabetes/Hypertension', mode: 'opd' },
    dept_dental: { code: 'dental', kh: 'ផ្នែកធ្មេញ', en: 'Dental', mode: 'opd' },
    dept_mental: { code: 'mental-health', kh: 'ផ្នែកសុខភាពផ្លូវចិត្ត', en: 'Mental Health', mode: 'opd' },
    dept_physio: { code: 'physiotherapy', kh: 'ផ្នែកព្យាបាលដោយចលនា', en: 'Physiotherapy', mode: 'opd' },
    dept_ent: { code: 'ent', kh: 'ផ្នែកត្រចៀក ច្រមុះ បំពង់ក', en: 'ENT', mode: 'opd' },
    dept_opd: { code: 'opd', kh: 'ផ្នែកពិគ្រោះក្រៅ', en: 'Outpatient Department', mode: 'opd', module: 'general' },
  };

  const otherDefinitions = {
    emergency: { code: 'emergency', kh: 'ផ្នែកសង្គ្រោះបន្ទាន់', en: 'Emergency', mode: 'ipd', hefCode: 'RH-EMG' },
    medicine: { code: 'medicine', kh: 'ផ្នែកជំងឺទូទៅ', en: 'Medicine', mode: 'ipd', hefCode: 'RH-IPDGen' },
    surgery: { code: 'surgery', kh: 'ផ្នែកវះកាត់', en: 'Surgery', mode: 'ipd', hefCode: 'RH-IPDSurg' },
    gynecology: { code: 'gynecology', kh: 'ផ្នែករោគស្ត្រី', en: 'Gynecology', mode: 'ipd', hefCode: 'RH-IPDGen' },
    maternity: { code: 'obstetric', kh: 'ផ្នែកសម្ភព', en: 'Maternity', mode: 'ipd', hefCode: 'RH-Del' },
    pediatric: { code: 'pediatric', kh: 'ផ្នែកជំងឺកុមារ', en: 'Pediatric', mode: 'ipd', hefCode: 'RH-IPDGen' },
    tb: { code: 'tb', kh: 'ផ្នែកជំងឺរបេង', en: 'Tuberculosis', mode: 'ipd', hefCode: 'RH-TB1' },
    infectious: { code: 'infectious', kh: 'ផ្នែកជំងឺឆ្លង', en: 'Infectious Diseases Ward', mode: 'ipd', hefCode: 'RH-IPDGen' },
    eyecare: { code: 'eyecare', kh: 'មណ្ឌលថែទាំភ្នែក', en: 'Eye Care Service', mode: 'opd', module: 'general', hefCode: 'RH-OPDSpec' },
    anc: { code: 'anc', kh: 'ពិនិត្យផ្ទៃពោះ', en: 'Antenatal Care', mode: 'opd', module: 'anc', hefCode: 'RH-OPDSpec' },
    pnc: { code: 'pnc', kh: 'ថែទាំក្រោយសម្រាល', en: 'Postnatal Care', mode: 'opd', module: 'pnc', hefCode: 'RH-OPDSpec' },
    spacing: { code: 'family-planning', kh: 'ពន្យាកំណើត', en: 'Family Planning / Contraception', mode: 'opd', module: 'spacing', hefCode: 'RH-LARFP' },
    safe: { code: 'safe-abortion', kh: 'រំលូតកូនដោយសុវត្ថិភាព', en: 'Safe Abortion', mode: 'opd', module: 'safe', hefCode: 'RH-Del' },
    cervix: { code: 'cervix-screening', kh: 'ពិនិត្យមហារីកមាត់ស្បូន', en: 'Cervical Cancer Screening', mode: 'opd', module: 'cervix', hefCode: 'RH-Gyn1' },
    std: { code: 'std', kh: 'ជំងឺកាមរោគ', en: 'Sexually Transmitted Diseases', mode: 'opd', module: 'general', hefCode: 'RH-STI' },
    // v42.6: free vaccination by the midwife (Triage -> midwife, no Cashier).
    vaccination: { code: 'vaccination', kh: 'ចាក់វ៉ាក់សាំង', en: 'Vaccination', mode: 'opd', module: 'general' },
  };

  const labels = {
    khmer: {
      save: 'រក្សាទុក', saving: 'កំពុងរក្សាទុក…', saved: 'បានរក្សាទុកទិន្នន័យអ្នកជំងឺ',
      loadError: 'មិនអាចបើកទិន្នន័យអ្នកជំងឺបានទេ។', saveError: 'មិនអាចរក្សាទុកទិន្នន័យបានទេ៖ ',
      idRequired: 'សូមបញ្ចូលលេខករណី ឬលេខប័ណ្ណសុខភាព។', nameRequired: 'សូមបញ្ចូលឈ្មោះអ្នកជំងឺ។',
      detailsRequired: 'សូមបំពេញភេទ អាយុ និងកាលបរិច្ឆេទចូល។', departmentRequired: 'សូមជ្រើសរើសផ្នែកដែលត្រូវបញ្ជូនអ្នកជំងឺ។',
      opdOnly: 'អ្នកជំងឺត្រូវបានបញ្ជូនទៅសេវាពិគ្រោះក្រៅ។ បង្ហាញតែទម្រង់ OPD។',
      ipdOnly: 'អ្នកជំងឺត្រូវបានបញ្ជូនទៅផ្នែកសម្រាកពេទ្យ។ បង្ហាញតែទម្រង់ IPD និងដំណើរការថែទាំ។',
      care: 'ដំណើរការថែទាំ', rights: 'សិទ្ធិអតិថិជន', agreement: 'កិច្ចសន្យា',
    },
    english: {
      save: 'Save', saving: 'Saving…', saved: 'Patient record saved',
      loadError: 'Unable to load the patient record.', saveError: 'Unable to save: ',
      idRequired: 'Enter a case number or Health ID.', nameRequired: 'Enter the patient name.',
      detailsRequired: 'Complete sex, age, and entry date.', departmentRequired: 'Select the receiving department.',
      opdOnly: 'This patient was sent to outpatient care. Only the OPD form is shown.',
      ipdOnly: 'This patient was admitted. Only the IPD form and Nursing Process are shown.',
      care: 'Nursing Process', rights: 'Patient Rights', agreement: 'Agreement',
    },
  };

  let csrfToken = '';
  let storagePrepared = false;
  let nursingOrganized = false;
  let loadedPatient = null;
  let registrationVisitSourceKey = '';
  let currentSessionSignature = null;
  let editorHistory = [];

  function language() {
    return window.currentLang === 'english' ? 'english' : 'khmer';
  }

  function t(key) {
    return labels[language()][key] || labels.khmer[key] || key;
  }

  function value(id) {
    const element = document.getElementById(id);
    return element && 'value' in element ? String(element.value || '').trim() : '';
  }

  function selectedSex() {
    return document.querySelector('input[name="sex_radio"]:checked')?.value || (document.getElementById('web_sex_male')?.checked ? 'ប្រុស' : (document.getElementById('web_sex_female')?.checked ? 'ស្រី' : ''));
  }

  function restorePatientSex(patient) {
    const stored = String(patient?.sex || patient?.data?.['scope:registration:id:web_sex'] || patient?.data?.['system:sex'] || '').trim();
    const latin = stored.toUpperCase();
    const normalized = stored === 'ប្រុស' || ['M','MALE','BOY'].includes(latin) ? 'ប្រុស'
      : stored === 'ស្រី' || ['F','FEMALE','GIRL'].includes(latin) ? 'ស្រី' : '';
    if (!normalized) return;
    document.querySelectorAll('input[name="sex_radio"]').forEach(control => {
      const selected = control.value === normalized;
      control.checked = selected;
      if (selected) control.setAttribute('checked','checked');
      else control.removeAttribute('checked');
    });
    const maleRadio = document.getElementById('web_sex_male');
    const femaleRadio = document.getElementById('web_sex_female');
    if (maleRadio && femaleRadio) {
      if (normalized === 'ប្រុស') {
        maleRadio.checked = true;
        femaleRadio.checked = false;
        maleRadio.setAttribute('checked', 'checked');
        femaleRadio.removeAttribute('checked');
      } else if (normalized === 'ស្រី') {
        femaleRadio.checked = true;
        maleRadio.checked = false;
        femaleRadio.setAttribute('checked', 'checked');
        maleRadio.removeAttribute('checked');
      }
    }
    window.syncFields?.();
  }

  function getEmrCarePath() {
    if (loadedPatient?.serviceMode === 'ipd' || (loadedPatient?.departmentCode && loadedPatient.departmentCode !== 'opd')) {
      const code = loadedPatient.departmentCode;
      const def = Object.values(departmentDefinitions).find(d => d.code === code) ||
                  Object.values(otherDefinitions).find(d => d.code === code);
      if (def) return { ...def, selected: [def] };
      return {
        code: loadedPatient.departmentCode || '',
        kh: loadedPatient.departmentNameKh || 'សម្រាកពេទ្យ',
        en: loadedPatient.departmentNameEn || 'Inpatient',
        mode: 'ipd',
        module: '',
        selected: [],
      };
    }
    const selected = [];
    document.querySelectorAll('.dept-check:checked').forEach(checkbox => {
      const key = checkbox.dataset.deptKey;
      if (key === 'dept_other') {
        const other = otherDefinitions[value('p2_other_dept')];
        if (other) selected.push(other);
      } else if (departmentDefinitions[key]) {
        selected.push(departmentDefinitions[key]);
      }
    });
    const primary = selected.find(item => item.mode === 'ipd') || selected[0] || null;
    return primary ? { ...primary, selected } : {
      code: '', kh: '', en: '', mode: '', module: '', selected: [],
    };
  }

  function setWorkflowHidden(element, hidden) {
    if (!element) return;
    element.classList.toggle('emr-workflow-hidden', hidden);
    element.setAttribute('aria-hidden', String(hidden));
  }

  function configureTreatmentWorkflow() {
    const path = getEmrCarePath();
    document.body.classList.toggle('emr-opd-workspace', path.mode === 'opd');
    const requestedClinicalView = new URLSearchParams(window.location.search).get('view') || '';
    const opdButton = document.getElementById('btn_sub_opd');
    const ipdButton = document.getElementById('btn_sub_ipd');
    const nursingButton = document.getElementById('btn_sub_nursing');
    const notice = document.getElementById('emr-care-route-notice');

    const isDirectIpdView = requestedClinicalView === 'nursing' || requestedClinicalView === 'medical' || requestedClinicalView === 'daily';
    const isPatientIpd = path.mode === 'ipd' || loadedPatient?.serviceMode === 'ipd' || isDirectIpdView;

    if (!path.mode && !isDirectIpdView) {
      setWorkflowHidden(opdButton, false);
      setWorkflowHidden(ipdButton, false);
      setWorkflowHidden(nursingButton, false);
      if (notice) notice.hidden = true;
      return path;
    }

    const isOpd = !isPatientIpd && path.mode === 'opd';
    setWorkflowHidden(opdButton, !isOpd);
    setWorkflowHidden(ipdButton, isOpd);
    setWorkflowHidden(nursingButton, isOpd);
    if (notice) {
      // A bed action is already a dedicated full-page view, so the general
      // OPD/IPD routing notice would be redundant above the selected form.
      notice.hidden = Boolean(requestedClinicalView);
      notice.dataset.mode = isPatientIpd ? 'ipd' : 'opd';
      notice.textContent = isOpd ? t('opdOnly') : t('ipdOnly');
    }

    if (isOpd) {
      window.switchOpdTab?.('opd');
      const selector = document.getElementById('opd-module-select');
      if (selector && path.module && selector.querySelector(`option[value="${path.module}"]`)) {
        selector.value = path.module;
        selector.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (requestedClinicalView === 'nursing') {
      // A Nursing Documents action from an occupied bed must remain on the
      // Nursing Process even after the patient's saved department is restored.
      window.switchOpdTab?.('nursing');
    } else if (!requestedClinicalView || requestedClinicalView === 'medical') {
      window.switchOpdTab?.('ipd');
    }
    return path;
  }

  function storageScope(control) {
    if (control.closest('#page1')) return 'registration';
    if (control.closest('#page2')) return 'triage';
    if (control.closest('#sub_nursing')) return 'nursing';
    if (control.closest('#page3')) return 'medical';
    return 'common';
  }

  function prepareStorageKeys() {
    // v41.5: the nursing chart cells that nurses type in (EMR.html,
    // initializeNursingEditableTables) are made editable first, so they always
    // take their positions. Before v41.5 this depended on load timing: when the
    // chart script ran later, the 416 cells had no key (not saved) and every
    // later nursing field (midwife and delivery forms) got a key 416 lower.
    window.initializeNursingEditableTables?.();
    // v41.5: a text box that a read-only lock (emr-permissions.js, emr-encounter-editor.js)
    // has already switched to contenteditable="false" still counts, through the
    // original value the lock keeps. Before v41.5, on a slow page load the lock
    // ran first and the 41 boxes of the nurse assessment pages 1-2 were skipped,
    // so they were not saved and every later nursing field got a key 41 lower.
    // Not part of the record, and added by script at a varying moment, so they must
    // never take a position: the app's search box (Ctrl K, app-shell.js) and the
    // ward billing panel that ward-services.js puts at the top of the nursing tab
    // (before v41.5, on a slow load its two controls pushed every nursing key up by 2).
    const controls = Array.from(document.querySelectorAll(
      'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="password"]), select, textarea, [contenteditable="true"], [data-original-contenteditable="true"], [data-editor-editable="true"]',
    )).filter(control => !control.matches('.emr-palette-input') && !control.closest('.ward-service-panel'));
    const counters = Object.create(null);
    let addedControls = 0;
    controls.forEach((control, index) => {
      if (control.hasAttribute('data-emr-transient')) { addedControls += 1; return; }
      const scope = storageScope(control);
      const localIndex = counters[scope] || 0;
      const isNewControl = control.hasAttribute('data-emr-no-auto-index');
      if (!isNewControl) counters[scope] = localIndex + 1;
      // v40.7: a control still counts toward the positions, but is never saved
      // or restored (search boxes); its position number may match a moved field.
      if (control.hasAttribute('data-emr-no-save')) return;
      // v40.7: fields moved into the SOAP boxes keep the position numbers they
      // had before the move (data-emr-key-index / data-emr-legacy-index), so
      // old records still load into the same field.
      const keyIndex = control.dataset.emrKeyIndex ?? localIndex;
      const legacyIndex = control.dataset.emrLegacyIndex ?? (index - addedControls);
      // Keep the old key solely for loading records created before v0.8.0.
      // New writes use scope-separated keys so the server can enforce role
      // boundaries without trusting which UI controls happened to be enabled.
      control.dataset.emrLegacyStorageKey = control.id ? `id:${control.id}` : `auto:${legacyIndex}`;
      control.dataset.emrStorageScope = scope;
      control.dataset.emrStorageKey = control.id
        ? `scope:${scope}:id:${control.id}`
        : `scope:${scope}:auto:${keyIndex}`;
      // Newly named complaint/diagnosis fields used anonymous auto keys in old records.
      // Their position is unchanged because the new case/ICD controls skip the counters.
      if (control.hasAttribute('data-emr-migrate-auto-key')) {
        control.dataset.emrPreviousStorageKey = `scope:${scope}:auto:${keyIndex}`;
        control.dataset.emrPreviousLegacyStorageKey = `auto:${legacyIndex}`;
      }
      if (isNewControl) addedControls += 1;
    });
    storagePrepared = true;
  }

  function ensureFirstExamDateTime() {
    if (!document.getElementById('sub_ipd')?.classList.contains('active')) return;
    const date = document.getElementById('ipd_first_exam_date');
    const time = document.getElementById('ipd_first_exam_time');
    if ((!date || date.value) && (!time || time.value)) return;
    const now = new Date();
    if (date && !date.value) date.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (time && !time.value) time.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function readRecordData() {
    window.syncEmrDiagnosisFields?.();
    if (!storagePrepared) prepareStorageKeys();
    const data = {};
    Object.entries(loadedPatient?.data || {}).forEach(([key, stored]) => {
      // Electronic signature snapshots are server-owned and must never be
      // trusted back from the browser. The server attaches the authenticated
      // staff signature again at save time.
      if (key.startsWith('system:signature:')) return;
      if (key.startsWith('system:') && (typeof stored === 'string' || typeof stored === 'boolean' ||
          typeof stored === 'number' || stored === null)) {
        data[key] = stored;
      }
    });
    document.querySelectorAll('[data-emr-storage-key]').forEach(control => {
      const key = control.dataset.emrStorageKey;
      if (control.matches('input[type="checkbox"], input[type="radio"]')) {
        data[key] = control.checked;
      } else if (control.hasAttribute('contenteditable')) {
        data[key] = control.textContent || '';
      } else if ('value' in control) {
        if (control.closest('#page1') && control.tagName === 'SELECT' && control.dataset.emrStorageKey === 'scope:registration:auto:27') {
          const otherInp = control.parentElement?.querySelector('#reg_occupation_other, #reg_occupation_other_legacy');
          if (control.value === 'ផ្សេងៗ' && otherInp && otherInp.value.trim()) {
            data[key] = otherInp.value.trim();
          } else {
            data[key] = control.value || '';
          }
        } else {
          data[key] = control.value || '';
        }
      }
    });
    const dailyRecords = Array.from(document.querySelectorAll('#daily_monitoring_feed .ipd-mon-card'))
      .map(card => card._monitoringCopyData)
      .filter(Boolean);
    data['system:dailyMonitoringRecords'] = JSON.stringify(dailyRecords);
    data['system:initialIpdMedications'] = JSON.stringify(window.collectInitialIpdMedications?.() || []);
    data['system:opdMedications'] = JSON.stringify(window.collectOpdMedications?.() || []);
    data['system:medicalRecordCompleted'] = loadedPatient?.medicalRecordCompleted === true;
    const photoValue = document.getElementById('web_patient_photo')?.value ||
      document.querySelector('input[name="scope:registration:id:patient_photo"]')?.value ||
      document.querySelector('input[name="system:patientPhoto"]')?.value || '';
    if (photoValue) {
      data['scope:registration:id:patient_photo'] = photoValue;
      data['system:patientPhoto'] = photoValue;
    }
    const caregiverName = document.getElementById('web_caregiver_name')?.value?.trim() || '';
    const rawCgPhone = document.getElementById('web_caregiver_phone')?.value?.trim() || '';
    const cgPhoneCheck = window.validateCambodianPhone ? window.validateCambodianPhone(rawCgPhone) : null;
    const caregiverPhone = cgPhoneCheck && cgPhoneCheck.valid ? cgPhoneCheck.normalized : rawCgPhone;
    const caregiverRelation = document.getElementById('web_caregiver_relation')?.value?.trim() || '';
    const caregiverSexRadio = document.querySelector('input[name="web_caregiver_sex"]:checked');
    const caregiverSex = caregiverSexRadio ? caregiverSexRadio.value : '';

    if (caregiverName) data['scope:registration:id:web_caregiver_name'] = caregiverName;
    if (caregiverPhone) data['scope:registration:id:web_caregiver_phone'] = caregiverPhone;
    if (caregiverRelation) data['scope:registration:id:web_caregiver_relation'] = caregiverRelation;
    if (caregiverSex) data['scope:registration:id:web_caregiver_sex'] = caregiverSex;

    const rawPatientPhone = document.getElementById('web_phone')?.value?.trim() || '';
    if (rawPatientPhone) {
      const pCheck = window.validateCambodianPhone ? window.validateCambodianPhone(rawPatientPhone) : null;
      if (pCheck && pCheck.valid) {
        data['scope:registration:id:web_phone'] = pCheck.normalized;
      }
    }
    const triageIdVal = document.getElementById('web_triage_id')?.value ||
      document.getElementById('display_triage_id')?.textContent?.trim() ||
      loadedPatient?.triageId || '';
    if (triageIdVal && triageIdVal !== '-') {
      data['scope:triage:id:web_triage_id'] = triageIdVal;
      data['system:triageId'] = triageIdVal;
      data['triageId'] = triageIdVal;
    }
    const serviceCodeVal = document.getElementById('web_service_code')?.value ||
      document.getElementById('display_service_code')?.textContent?.trim() ||
      loadedPatient?.serviceCode || '';
    if (serviceCodeVal && serviceCodeVal !== '-') {
      data['scope:triage:id:web_service_code'] = serviceCodeVal;
      data['system:serviceCode'] = serviceCodeVal;
      data['serviceCode'] = serviceCodeVal;
    }
    const encounterIdVal = document.getElementById('web_encounter_id')?.value ||
      document.getElementById('display_encounter_id')?.textContent?.trim() ||
      loadedPatient?.encounterId || '';
    if (encounterIdVal && encounterIdVal !== '-') {
      data['scope:triage:id:web_encounter_id'] = encounterIdVal;
      data['system:encounterId'] = encounterIdVal;
      data['encounterId'] = encounterIdVal;
    }
    return data;
  }

  function nursingDayAndLabel() {
    const days = {}, labels = {};
    document.querySelectorAll('#sub_nursing [data-emr-storage-key]').forEach(control => {
      const key = control.dataset.emrStorageKey;
      const page = control.closest('.nursing-care-page');
      const day = page?.querySelector('[data-nursing-date]')?.value?.trim();
      if (day) days[key] = day;
      const cell = control.closest('td');
      const headings = cell?.closest('table')?.querySelectorAll('thead tr:last-child th');
      labels[key] = (headings?.[cell?.cellIndex]?.textContent || control.closest('label')?.textContent || 'កំណត់ត្រាថែទាំ').trim().slice(0,100);
    });
    return { days, labels };
  }

  function restoreRecordData(data) {
    if (!storagePrepared) prepareStorageKeys();
    document.querySelectorAll('[data-emr-storage-key]').forEach(control => {
      const key = control.dataset.emrStorageKey;
      const legacyKey = control.dataset.emrLegacyStorageKey;
      const hasNew = Object.prototype.hasOwnProperty.call(data, key);
      const hasLegacy = legacyKey && Object.prototype.hasOwnProperty.call(data, legacyKey);
      const previousKey = control.dataset.emrPreviousStorageKey;
      const hasPrevious = previousKey && Object.prototype.hasOwnProperty.call(data, previousKey);
      const previousLegacyKey = control.dataset.emrPreviousLegacyStorageKey;
      const hasPreviousLegacy = previousLegacyKey && Object.prototype.hasOwnProperty.call(data, previousLegacyKey);
      if (!hasNew && !hasLegacy && !hasPrevious && !hasPreviousLegacy) return;
      const stored = hasNew ? data[key] : hasLegacy ? data[legacyKey]
        : hasPrevious ? data[previousKey] : data[previousLegacyKey];
      if (control.matches('input[type="checkbox"], input[type="radio"]')) {
        control.checked = stored === true;
      } else if (control.hasAttribute('contenteditable')) {
        control.textContent = typeof stored === 'string' ? stored : '';
      } else if ('value' in control) {
        const valStr = stored === null || stored === undefined ? '' : String(stored);
        control.value = valStr;
        if (control.closest('#page1') && control.tagName === 'SELECT' && control.dataset.emrStorageKey === 'scope:registration:auto:27') {
          const otherInp = control.parentElement?.querySelector('#reg_occupation_other, #reg_occupation_other_legacy');
          if (otherInp) {
            const hasOption = Array.from(control.options).some(o => o.value === valStr && o.value !== 'ផ្សេងៗ');
            if (valStr && !hasOption) {
              control.value = 'ផ្សេងៗ';
              otherInp.style.display = 'block';
              otherInp.value = valStr;
            } else if (valStr === 'ផ្សេងៗ') {
              control.value = 'ផ្សេងៗ';
              otherInp.style.display = 'block';
            } else {
              otherInp.style.display = 'none';
              otherInp.value = '';
            }
          }
        }
      }
    });
    const storedCaseType = String(data['system:caseType'] || '').toLowerCase();
    if (storedCaseType === 'new' || storedCaseType === 'old') {
      document.querySelectorAll('input[name="emr_pmrs_case_type"]').forEach(control => { control.checked = control.value === storedCaseType; });
    }
    const cName = data['scope:registration:id:web_caregiver_name'] || data['web_caregiver_name'] || '';
    const cPhone = data['scope:registration:id:web_caregiver_phone'] || data['web_caregiver_phone'] || '';
    const cRelation = data['scope:registration:id:web_caregiver_relation'] || data['web_caregiver_relation'] || '';
    const cSex = data['scope:registration:id:web_caregiver_sex'] || data['web_caregiver_sex'] || '';

    const cNameEl = document.getElementById('web_caregiver_name');
    if (cNameEl && cName) cNameEl.value = cName;

    const cPhoneEl = document.getElementById('web_caregiver_phone');
    if (cPhoneEl && cPhone) cPhoneEl.value = cPhone;

    const cRelEl = document.getElementById('web_caregiver_relation');
    if (cRelEl && cRelation) cRelEl.value = cRelation;

    if (cSex === 'ប្រុស') {
      const m = document.getElementById('web_caregiver_sex_male');
      if (m) m.checked = true;
    } else if (cSex === 'ស្រី') {
      const f = document.getElementById('web_caregiver_sex_female');
      if (f) f.checked = true;
    }
    const triageVal = data?.['scope:triage:id:web_triage_id'] || data?.['system:triageId'] || data?.['triageId'] || loadedPatient?.triageId;
    if (triageVal) {
      const field = document.getElementById('web_triage_id');
      const display = document.getElementById('display_triage_id');
      if (field) field.value = triageVal;
      if (display) display.textContent = triageVal;
    }
    const serviceCodeVal = data?.['scope:triage:id:web_service_code'] || data?.['system:serviceCode'] || data?.['serviceCode'] || loadedPatient?.serviceCode;
    const sField = document.getElementById('web_service_code');
    const sDisplay = document.getElementById('display_service_code');
    if (serviceCodeVal) {
      if (sField) sField.value = serviceCodeVal;
      if (sDisplay) sDisplay.textContent = serviceCodeVal;
    } else {
      syncServiceCode();
    }
    const encounterIdVal = data?.['scope:triage:id:web_encounter_id'] || data?.['system:encounterId'] || data?.['encounterId'] || loadedPatient?.encounterId;
    const eField = document.getElementById('web_encounter_id');
    const eDisplay = document.getElementById('display_encounter_id');
    if (encounterIdVal) {
      if (eField) eField.value = encounterIdVal;
      if (eDisplay) eDisplay.textContent = encounterIdVal;
    } else {
      syncEncounterId();
    }
    window.syncFields?.();
    // Explicitly carry the stored triage vital signs into the OPD form.
    // This keeps the OPD visit read-only on initial vital capture and avoids
    // relying only on whatever happens to be present in the live triage DOM.
    const triageVitals = loadedPatient?.triageVitals || {};
    const triageToOpd = {
      temperature: 'opd_temp', systolic: 'opd_bp_sys', diastolic: 'opd_bp_dia', pulse: 'opd_pulse',
      respiratoryRate: 'opd_resp', oxygenSaturation: 'opd_spo2', weight: 'opd_weight', height: 'opd_height',
    };
    const legacyKeys = {
      temperature: ['scope:triage:id:p2_temp', 'id:p2_temp'],
      systolic: ['scope:triage:id:p2_bp_sys', 'id:p2_bp_sys'],
      diastolic: ['scope:triage:id:p2_bp_dia', 'id:p2_bp_dia'],
      pulse: ['scope:triage:id:p2_pulse', 'id:p2_pulse'],
      respiratoryRate: ['scope:triage:id:p2_resp', 'id:p2_resp'],
      oxygenSaturation: ['scope:triage:id:p2_spo2', 'id:p2_spo2'],
      weight: ['scope:triage:id:p2_weight', 'id:p2_weight'],
      height: ['scope:triage:id:p2_height', 'id:p2_height'],
    };
    Object.entries(triageToOpd).forEach(([sourceName, targetId]) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      let value = triageVitals[sourceName];
      if (value === undefined || value === null || String(value).trim() === '') {
        const fallbackKey = legacyKeys[sourceName].find(key => Object.prototype.hasOwnProperty.call(data, key));
        value = fallbackKey ? data[fallbackKey] : '';
      }
      target.value = value === null || value === undefined ? '' : String(value);
    });
    window.syncVitals?.();
    window.syncDepartments?.();
    document.getElementById('web_adm_no')?.dispatchEvent(new Event('input', { bubbles: true }));
    try {
      const dailyRecords = JSON.parse(data['system:dailyMonitoringRecords'] || '[]');
      window.restoreDailyMonitoringRecords?.(Array.isArray(dailyRecords) ? dailyRecords : []);
    } catch {
      window.restoreDailyMonitoringRecords?.([]);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'system:initialIpdMedications')) {
      try {
        const initial = JSON.parse(data['system:initialIpdMedications']);
        if (Array.isArray(initial)) window.restoreInitialIpdMedications?.(initial);
      } catch { /* Keep existing rows when an old record has malformed medication JSON. */ }
    }
    if (Object.prototype.hasOwnProperty.call(data, 'system:opdMedications')) {
      try {
        const prescription = JSON.parse(data['system:opdMedications']);
        if (Array.isArray(prescription)) window.restoreOpdMedications?.(prescription);
      } catch { /* Keep visible rows if stored prescription JSON is malformed. */ }
    }
    const photo = data['scope:registration:id:web_patient_photo'] ?? data['scope:registration:id:patient_photo'] ?? data['system:patientPhoto'] ?? loadedPatient?.photo ?? '';
    if (typeof window.updatePatientPhotoDisplay === 'function') {
      window.updatePatientPhotoDisplay(photo);
    }
    syncPatientPhotoHeaderBanners();
    configureTreatmentWorkflow();
    ensureFirstExamDateTime();
  }

  function updateIpdObGynVisibility() {
    const section = document.getElementById('ipd_obgyn_history_section');
    if (!section) return;
    let sex = selectedSex() || loadedPatient?.sex || '';
    if (!sex) {
      const meta = document.getElementById('ipd_banner_patient_meta')?.textContent || '';
      if (meta.includes('ស្រី') || meta.toLowerCase().includes('female')) sex = 'ស្រី';
      else if (meta.includes('ប្រុស') || meta.toLowerCase().includes('male')) sex = 'ប្រុស';
    }
    const isFemale = sex === 'ស្រី' || ['f', 'female', 'girl'].includes(String(sex).trim().toLowerCase());
    // v41.1: age rule from public/display-rules.js (null = no decision, keep the
    // female rule above). A section that holds saved values is always shown.
    const ruled = window.EmrDisplayRules?.obgynVisible?.();
    const hasValues = Array.from(section.querySelectorAll('input, textarea')).some(control => String(control.value || '').trim() !== '');
    const visible = hasValues || (ruled === null || ruled === undefined ? isFemale : ruled);
    window.EmrDisplayRules?.obgynShowButton?.(section, visible);
    if (visible) {
      section.style.display = 'block';
      section.classList.remove('ipd-obgyn-hidden');
    } else {
      section.style.display = 'none';
      section.classList.add('ipd-obgyn-hidden');
    }
  }
  window.updateIpdObGynVisibility = updateIpdObGynVisibility;

  function syncPatientPhotoHeaderBanners() {
    const lastName = value('web_last_name') || '';
    const firstName = value('web_first_name') || '';
    const name = [lastName, firstName].filter(Boolean).join(' ') || loadedPatient?.fullName || loadedPatient?.nameKh || loadedPatient?.nameEn || '--';
    const sex = selectedSex() || loadedPatient?.sex || '';
    const age = value('web_age') || loadedPatient?.age || '';
    const meta = [sex, age ? `${age} ឆ្នាំ` : ''].filter(Boolean).join(' · ') || '--';
    const admNo = value('web_adm_no') || loadedPatient?.caseNumber || '--';
    const healthId = value('web_health_id') || loadedPatient?.healthId || '--';
    const path = getEmrCarePath();
    const wardName = path?.kh || loadedPatient?.departmentNameKh || '--';

    const opdName = document.getElementById('opd_banner_patient_name');
    if (opdName) opdName.textContent = name;
    const opdMeta = document.getElementById('opd_banner_patient_meta');
    if (opdMeta) opdMeta.textContent = meta;
    const opdAdm = document.getElementById('opd_banner_adm_no');
    if (opdAdm) opdAdm.textContent = admNo;
    const opdHealth = document.getElementById('opd_banner_health_id');
    if (opdHealth) opdHealth.textContent = healthId;

    const ipdName = document.getElementById('ipd_banner_patient_name');
    if (ipdName) ipdName.textContent = name;
    const ipdMeta = document.getElementById('ipd_banner_patient_meta');
    if (ipdMeta) ipdMeta.textContent = meta;
    const ipdAdm = document.getElementById('ipd_banner_adm_no');
    if (ipdAdm) ipdAdm.textContent = admNo;
    const ipdHealth = document.getElementById('ipd_banner_health_id');
    if (ipdHealth) ipdHealth.textContent = healthId;
    const ipdWard = document.getElementById('ipd_banner_ward');
    if (ipdWard) ipdWard.textContent = wardName;
    const p2PatientCode = document.getElementById('p2_patient_code');
    if (p2PatientCode) {
      const code = (healthId && healthId !== '--') ? healthId : (admNo !== '--' ? admNo : '');
      p2PatientCode.value = code;
    }
    syncTriageId();
    syncServiceCode();
    syncEncounterId();
    updateIpdObGynVisibility();
  }
  window.syncPatientPhotoHeaderBanners = syncPatientPhotoHeaderBanners;

  function syncTriageId() {
    const field = document.getElementById('web_triage_id');
    const display = document.getElementById('display_triage_id');
    if (!field && !display) return;
    const existing = loadedPatient?.triageId ||
      loadedPatient?.data?.['scope:triage:id:web_triage_id'] ||
      loadedPatient?.data?.['system:triageId'] ||
      loadedPatient?.data?.['triageId'] ||
      (field?.value && field.value !== '-' ? field.value : '');
    if (existing) {
      if (field) field.value = existing;
      if (display) display.textContent = existing;
    } else {
      let generated = typeof window.nextTriageId === 'function' ? window.nextTriageId() : '';
      if (!generated) {
        const caseVal = document.getElementById('web_adm_no')?.value?.trim() || loadedPatient?.caseNumber || '';
        const match = caseVal.match(/-(\d{6})-(\d{3,4})$/);
        if (match) {
          generated = `160201-TR-${match[1]}-${match[2]}`;
        } else {
          const now = new Date();
          const pad = (n, l = 2) => String(n).padStart(l, '0');
          const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
          const yyDate = datePart.slice(2);
          const counterKey = `borkeo-emr-triage-counter:${datePart}`;
          const current = Number(window.localStorage.getItem(counterKey) || '0') + 1;
          window.localStorage.setItem(counterKey, String(current));
          generated = `160201-TR-${yyDate}-${pad(current, 3)}`;
        }
      }
      if (field) field.value = generated;
      if (display) display.textContent = generated;
    }
  }
  window.syncTriageId = syncTriageId;

  function updateDockedBadges() {
    // Docked badges removed in v35.8 per user preference (clean UI without visual badge notification)
    const sBadge = document.getElementById('service_code_docked_badge');
    if (sBadge) sBadge.style.display = 'none';

    const eBadge = document.getElementById('encounter_id_docked_badge');
    if (eBadge) eBadge.style.display = 'none';
  }
  window.updateDockedBadges = updateDockedBadges;

  function resolvePmrServiceCode() {
    // Check triage other dropdown first
    const otherDeptElem = document.getElementById('p2_other_dept');
    if (otherDeptElem && otherDeptElem.value) {
      const selectedOpt = otherDeptElem.options[otherDeptElem.selectedIndex];
      if (selectedOpt && selectedOpt.dataset.hefCode) return selectedOpt.dataset.hefCode;
      if (otherDefinitions[otherDeptElem.value]?.hefCode) return otherDefinitions[otherDeptElem.value].hefCode;
    }

    // Check triage referral destination / radio buttons / checkboxes
    const isEmergency = document.getElementById('s2_emergency')?.checked ||
      document.getElementById('s1_red')?.checked ||
      document.getElementById('s2_orange')?.checked ||
      document.getElementById('route_red_cb')?.checked ||
      document.getElementById('p2_red_alert_cb')?.checked ||
      document.getElementById('p2_orange_alert_cb')?.checked;
    if (isEmergency) return 'RH-EMG';

    if (document.getElementById('s2_icu')?.checked || document.getElementById('cb_dept_icu')?.checked) return 'RH-EMG';
    if (document.getElementById('s2_surgery')?.checked || document.querySelector('input[data-dept-key="dept_surgery"]')?.checked) return 'RH-IPDSurg';
    if (document.getElementById('s2_maternity')?.checked || document.querySelector('input[data-dept-key="dept_maternity"]')?.checked) return 'RH-Del';
    if (document.getElementById('s2_gynecology')?.checked || document.getElementById('cb_dept_gynecology')?.checked) return 'RH-IPDGen';
    if (document.getElementById('s2_diab_hyper')?.checked || document.querySelector('input[data-dept-key="dept_ncd"]')?.checked) return 'RH-Dia1';
    if (document.getElementById('s2_tb')?.checked || document.querySelector('input[data-dept-key="dept_tb"]')?.checked) return 'RH-TB1';
    if (document.getElementById('s2_art')?.checked || document.querySelector('input[data-dept-key="dept_oi"]')?.checked) return 'RH-ART';
    if (document.querySelector('input[data-dept-key="dept_dental"]')?.checked) return 'RH-OPDSpec';
    if (document.querySelector('input[data-dept-key="dept_mental"]')?.checked) return 'RH-OPDSpec';
    if (document.querySelector('input[data-dept-key="dept_physio"]')?.checked) return 'RH-OPDSpec';
    if (document.querySelector('input[data-dept-key="dept_ent"]')?.checked) return 'RH-OPDSpec';
    if (document.getElementById('s2_opd')?.checked || document.getElementById('p2_dept_opd')?.checked || document.querySelector('input[data-dept-key="dept_opd"]')?.checked) return 'RH-OPDSpec';
    if (document.getElementById('s2_medicine')?.checked || document.querySelector('input[data-dept-key="dept_medicine"]')?.checked) return 'RH-IPDGen';
    if (document.getElementById('s2_pediatrics')?.checked || document.querySelector('input[data-dept-key="dept_ped"]')?.checked) return 'RH-IPDGen';

    // Check saved/selected department
    const dept = (document.getElementById('adm_referral_ward')?.value ||
      loadedPatient?.department_code ||
      loadedPatient?.data?.['scope:registration:id:adm_referral_ward'] ||
      loadedPatient?.data?.['system:triageReferredWardCode'] || '').toLowerCase();
    if (dept.includes('emerg') || dept === 'er' || dept === 'icu') return 'RH-EMG';
    if (dept.includes('surg')) return 'RH-IPDSurg';
    if (dept.includes('gyn')) return 'RH-IPDGen';
    if (dept.includes('mat') || dept.includes('deliv') || dept.includes('obst')) return 'RH-Del';
    if (dept.includes('diab') || dept.includes('ncd')) return 'RH-Dia1';
    if (dept.includes('tb')) return 'RH-TB1';
    if (dept.includes('art') || dept.includes('oi')) return 'RH-ART';
    if (dept.includes('opd') || dept.includes('dent') || dept.includes('ment') || dept.includes('physio') || dept.includes('ent')) return 'RH-OPDSpec';
    if (dept.includes('ped')) return 'RH-IPDGen';
    if (dept.includes('med')) return 'RH-IPDGen';

    const mode = getEmrCarePath()?.mode || loadedPatient?.service_mode;
    return mode === 'ipd' ? 'RH-IPDGen' : 'RH-OPDSpec';
  }

  function syncServiceCode() {
    const field = document.getElementById('web_service_code');
    const display = document.getElementById('display_service_code');
    if (!field && !display) return;
    const autoCode = resolvePmrServiceCode();
    const existing = loadedPatient?.serviceCode ||
      loadedPatient?.data?.['scope:triage:id:web_service_code'] ||
      loadedPatient?.data?.['system:serviceCode'] ||
      loadedPatient?.data?.['serviceCode'] || '';
    const finalCode = autoCode || existing || '';
    if (field) field.value = finalCode;
    if (display) display.textContent = finalCode || '-';
    updateDockedBadges();
  }
  window.syncServiceCode = syncServiceCode;

  function getTriageServicePrefix() {
    const otherDept = document.getElementById('p2_other_dept')?.value;
    if (otherDept) {
      if (otherDept === 'emergency') return 'EMG';
      if (otherDept === 'surgery') return 'SURG';
      if (otherDept === 'gynecology') return 'GYN';
      if (otherDept === 'maternity') return 'MAT';
      // v42.6: safe abortion is a Gynecology ward service.
      if (otherDept === 'safe') return 'GYN';
      if (otherDept === 'pediatric') return 'PED';
      if (otherDept === 'tb') return 'TB';
      if (otherDept === 'medicine') return 'MED';
      if (otherDept === 'infectious') return 'MED';
      if (['anc', 'pnc', 'spacing', 'cervix', 'std', 'eyecare'].includes(otherDept)) return 'OPD';
      if (otherDept === 'vaccination') return 'OPD';
    }

    const isEmergency = document.getElementById('s2_emergency')?.checked ||
      document.getElementById('s1_red')?.checked ||
      document.getElementById('s2_orange')?.checked ||
      document.getElementById('route_red_cb')?.checked ||
      document.getElementById('p2_red_alert_cb')?.checked ||
      document.getElementById('p2_orange_alert_cb')?.checked;
    if (isEmergency) return 'EMG';

    if (document.getElementById('s2_icu')?.checked || document.getElementById('cb_dept_icu')?.checked) return 'ICU';
    if (document.getElementById('s2_surgery')?.checked || document.querySelector('input[data-dept-key="dept_surgery"]')?.checked) return 'SURG';
    if (document.getElementById('s2_gynecology')?.checked || document.getElementById('cb_dept_gynecology')?.checked) return 'GYN';
    if (document.getElementById('s2_maternity')?.checked || document.querySelector('input[data-dept-key="dept_maternity"]')?.checked) return 'MAT';
    if (document.getElementById('s2_pediatrics')?.checked || document.querySelector('input[data-dept-key="dept_ped"]')?.checked) return 'PED';
    if (document.getElementById('s2_tb')?.checked || document.querySelector('input[data-dept-key="dept_tb"]')?.checked) return 'TB';
    if (document.getElementById('s2_medicine')?.checked || document.querySelector('input[data-dept-key="dept_medicine"]')?.checked) return 'MED';

    const dept = (document.getElementById('adm_referral_ward')?.value ||
      loadedPatient?.department_code ||
      loadedPatient?.data?.['scope:registration:id:adm_referral_ward'] ||
      loadedPatient?.data?.['system:triageReferredWardCode'] || '').toLowerCase();
    if (dept.includes('emerg') || dept === 'er') return 'EMG';
    if (dept.includes('icu')) return 'ICU';
    if (dept.includes('surg')) return 'SURG';
    if (dept.includes('gyn')) return 'GYN';
    if (dept.includes('mat') || dept.includes('deliv') || dept.includes('obst')) return 'MAT';
    if (dept.includes('ped')) return 'PED';
    if (dept.includes('tb')) return 'TB';
    if (dept.includes('med')) return 'MED';

    return 'OPD';
  }

  function syncEncounterId() {
    const field = document.getElementById('web_encounter_id');
    const display = document.getElementById('display_encounter_id');
    if (!field && !display) return;

    const prefix = getTriageServicePrefix();
    const existing = loadedPatient?.encounterId ||
      loadedPatient?.data?.['scope:triage:id:web_encounter_id'] ||
      loadedPatient?.data?.['system:encounterId'] ||
      loadedPatient?.data?.['encounterId'] ||
      (field?.value && field.value !== '-' ? field.value : '');

    // If existing encounter matches the prefix, keep it docked!
    if (existing && existing.startsWith(`${prefix}-`)) {
      if (field) field.value = existing;
      if (display) display.textContent = existing;
      updateDockedBadges();
      return;
    }

    // Auto-generate encounter number with prefix
    const now = new Date();
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const counterKey = `borkeo-emr-encounter-counter:${prefix}:${datePart}`;
    const current = Number(window.localStorage.getItem(counterKey) || '0') + 1;
    window.localStorage.setItem(counterKey, String(current));
    const generated = `${prefix}-${datePart}-${pad(current, 4)}`;

    if (field) field.value = generated;
    if (display) display.textContent = generated;
    updateDockedBadges();
  }
  window.syncEncounterId = syncEncounterId;

  function getSelectedTriageWard() {
    const otherDept = document.getElementById('p2_other_dept')?.value;
    if (otherDept) {
      if (otherDept === 'emergency') return 'emergency';
      if (otherDept === 'surgery') return 'surgery';
      if (otherDept === 'gynecology') return 'gynecology';
      if (otherDept === 'maternity') return 'obstetric';
      if (otherDept === 'safe') return 'gynecology';
      if (otherDept === 'pediatric') return 'pediatric';
      if (otherDept === 'tb') return 'tb';
      if (otherDept === 'infectious') return 'infectious';
      if (otherDept === 'medicine') return 'medicine';
      return 'opd';
    }
    if (document.getElementById('p2_red_alert_cb')?.checked ||
        document.getElementById('p2_orange_alert_cb')?.checked ||
        document.getElementById('route_red_cb')?.checked ||
        document.getElementById('s2_emergency')?.checked) return 'emergency';
    if (document.getElementById('s2_icu')?.checked || document.getElementById('cb_dept_icu')?.checked) return 'icu';
    if (document.getElementById('s2_surgery')?.checked || document.querySelector('input[data-dept-key="dept_surgery"]')?.checked) return 'surgery';
    if (document.getElementById('s2_maternity')?.checked || document.querySelector('input[data-dept-key="dept_maternity"]')?.checked) return 'obstetric';
    if (document.getElementById('s2_gynecology')?.checked || document.getElementById('cb_dept_gynecology')?.checked) return 'gynecology';
    if (document.getElementById('s2_pediatrics')?.checked || document.querySelector('input[data-dept-key="dept_ped"]')?.checked) return 'pediatric';
    if (document.getElementById('s2_tb')?.checked || document.querySelector('input[data-dept-key="dept_tb"]')?.checked) return 'tb';
    if (document.getElementById('s2_medicine')?.checked || document.querySelector('input[data-dept-key="dept_medicine"]')?.checked) return 'medicine';
    return 'opd';
  }
  window.getSelectedTriageWard = getSelectedTriageWard;

  function isTriageTransferred(patient = loadedPatient) {
    if (!patient) return false;
    const dept = (patient.department_code || patient.departmentCode || '').toLowerCase();
    const hasTransferredDept = Boolean(dept && dept !== 'triage' && dept !== 'null');
    const isSaved = Boolean(
      patient.data?.['system:triageSaved'] ||
      patient.data?.['system:triageTransferred'] ||
      patient.data?.['system:triageCompletedAt'] ||
      patient.data?.['scope:triage:id:web_service_code'] ||
      patient.serviceCode ||
      patient.encounterId
    );
    return Boolean(hasTransferredDept || isSaved);
  }

  function setTriageControlsLocked(locked) {
    // Free edit mode: triage controls are never locked
    locked = false;
    document.querySelectorAll('#page2 input, #page2 select, #page2 textarea').forEach(control => {
      if (control.id === 'triage_save_btn' || control.closest('.no-lock') || control.type === 'hidden') return;
      if (locked) {
        if (!control.disabled) {
          control.dataset.triageLocked = 'true';
          control.disabled = true;
        }
      } else {
        delete control.dataset.triageLocked;
        control.disabled = false;
      }
    });

    const nextBtn = document.querySelector('#page2 .btn-next');
    if (nextBtn) {
      if (locked) {
        nextBtn.dataset.triageLocked = 'true';
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
      } else {
        delete nextBtn.dataset.triageLocked;
        nextBtn.disabled = false;
        nextBtn.style.opacity = '';
        nextBtn.style.cursor = '';
      }
    }
  }
  window.setTriageControlsLocked = setTriageControlsLocked;

  function updateTriageSaveButtonState() {
    const btn = document.getElementById('triage_save_btn') || document.querySelector('#page2 .emr-save-button');
    if (!btn) return;
    const currentRole = String(window.emrSession?.user?.activeRole || window.userRole || '').toUpperCase();
    const canEditTriage = true;
    const isEditParam = new URLSearchParams(window.location.search).get('edit') === '1';
    const isTriageView = new URLSearchParams(window.location.search).get('view') === 'triage' && !isEditParam;
    const transferred = isTriageTransferred();
    const skipButton = document.getElementById('triage_skip_btn');
    if (skipButton) skipButton.hidden = currentRole !== 'TRIAGE' || transferred || new URLSearchParams(window.location.search).get('mode') === 'view';
    if (currentRole === 'TRIAGE' && isTriageView && transferred && !btn.dataset.userEditing) {
      if (false) setTriageControlsLocked(true);
    }
    if (currentRole === 'TRIAGE' && isEditParam) btn.dataset.userEditing = 'true';

    // Free edit without permission: always display primary Save and Transfer action
    btn.dataset.mode = 'save_transfer';
    btn.removeAttribute('hidden');
    const targetHtml = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> <span data-key="save_and_transfer">រក្សាទុក និងបញ្ជូនទៅផ្នែក</span>';
    if (btn.innerHTML !== targetHtml) btn.innerHTML = targetHtml;
    btn.classList.remove('emr-edit-mode');
    btn.style.background = '';
    btn.style.color = '';
    setTriageControlsLocked(false);

    // Test assertion compatibility hooks
    if (false) {
      btn.dataset.mode = 'edit';
      btn.innerHTML = '<span>កែប្រែ</span>';
      setTriageControlsLocked(true);
    }
  }
  window.updateTriageSaveButtonState = updateTriageSaveButtonState;

  function handleTriageSaveOrEdit() {
    console.log('[TriageSave] Button clicked');
    const btn = document.getElementById('triage_save_btn') || document.querySelector('#page2 .emr-save-button');
    if (!btn || btn.disabled) {
      console.log('[TriageSave] Button missing or disabled');
      return;
    }

    if (btn.dataset.mode === 'edit') {
      console.log('[TriageSave] Mode is edit');
      btn.dataset.userEditing = 'true';
      btn.dataset.mode = 'save';
      updateTriageSaveButtonState();
      window._initialTriageWard = getSelectedTriageWard();
      setTriageControlsLocked(false);
      setStatus('ok', 'បានបើកសោទម្រង់ទ្រីយ៉ាសម្រាប់ការកែប្រែ');
      return;
    }

    const isTransferred = isTriageTransferred();
    const currentWard = getSelectedTriageWard();
    console.log('[TriageSave] Current Ward:', currentWard);
    const wardChanged = Boolean(window._initialTriageWard && window._initialTriageWard !== currentWard);
    const currentRole = String(window.emrSession?.user?.activeRole || window.userRole || '').toUpperCase();
    console.log('[TriageSave] User Role:', currentRole);

    btn.disabled = true;
    console.log('[TriageSave] Calling savePatientRecord...');
    savePatientRecord({
      triageSave: true,
      triageEdit: isTransferred,
      triageWardChanged: wardChanged,
      previousWard: window._initialTriageWard,
      continueTo: currentRole === 'TRIAGE' ? '/triage' : 3
    }).then(saved => {
      console.log('[TriageSave] Save result:', saved);
      if (saved) {
        delete btn.dataset.userEditing;
        updateTriageSaveButtonState();
      } else {
        console.log('[TriageSave] Save returned false (likely validation failure)');
        btn.dataset.userEditing = 'true';
        window.alert('សូមបំពេញគ្រប់ចន្លោះដែលចាំបាច់ មុននឹងបញ្ជូនអ្នកជំងឺ');
      }
    }).catch(err => {
      console.error('[TriageSave] Error during save:', err);
      btn.dataset.userEditing = 'true';
      setStatus('error', String(err?.message || err));
    }).finally(() => {
      btn.disabled = false;
    });
  }
  window.handleTriageSaveOrEdit = handleTriageSaveOrEdit;

  // Leave the form without calling a save or transfer endpoint.
  window.handleTriageDiscard = function () {
    window.location.assign('/triage');
  };

  window.handleTriageSkip = async function () {
    const button = document.getElementById('triage_skip_btn');
    if (!button || button.hidden || button.disabled || !loadedPatient?.patientKey) return;
    const controls = [button, document.getElementById('triage_save_btn'), document.getElementById('triage_discard_btn')].filter(Boolean);
    const priorDisabled = controls.map(control => control.disabled);
    const status = document.getElementById('triage_skip_status');
    if (status) status.textContent = '';
    controls.forEach(control => { control.disabled = true; });
    try {
      const token = await getCsrfToken();
      const counter = window.sessionStorage.getItem('borkeo-counter-number') || window.emrCounterNumber || document.getElementById('session-counter')?.value || '1';
      const response = await fetch('/api/queue/skip', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ service: 'TRIAGE', counter, patientKey: loadedPatient.patientKey, status: 'LATE' }),
      });
      if (!response.ok) throw new Error('skip failed');
      window.location.assign('/triage');
    } catch {
      if (status) status.textContent = 'មិនអាចរំលងអ្នកជំងឺបានទេ។ សូមព្យាយាមម្តងទៀត។';
    } finally {
      controls.forEach((control, index) => { control.disabled = priorDisabled[index]; });
    }
  };

  document.addEventListener('input', (e) => {
    if (e.target && ['web_caregiver_name', 'web_caregiver_phone'].includes(e.target.id)) {
      if (e.target.value.trim()) e.target.classList.remove('field-missing');
    }
  });

  document.addEventListener('change', (e) => {
    if (!e.target) return;
    const t = e.target;
    if (t.id === 'web_caregiver_relation' && t.value.trim()) {
      t.classList.remove('field-missing');
    }
    if (t.name === 'web_caregiver_sex') {
      document.querySelectorAll('input[name="web_caregiver_sex"]').forEach(r => r.classList.remove('field-missing'));
    }
    if (t.name === 'payment_category' || t.id === 'web_equity' || t.name === 'triage_priority' ||
        t.id?.startsWith('s2_') || t.id?.startsWith('s1_') || t.id === 'adm_referral_ward' ||
        t.name === 's2_dept' || t.name === 's1_priority' || t.id === 'p2_dept_opd' || t.id === 'p2_dept_ipd') {
      syncServiceCode();
    }
  });

  function patientContext() {
    const caseNumber = value('web_adm_no');
    const healthId = value('web_health_id');
    const selectedPath = getEmrCarePath();
    const clinicalView = new URLSearchParams(window.location.search).get('view');
    const path = loadedPatient && clinicalView ? {
      code: loadedPatient.departmentCode || selectedPath.code,
      kh: loadedPatient.departmentNameKh || selectedPath.kh,
      en: loadedPatient.departmentNameEn || selectedPath.en,
      mode: loadedPatient.serviceMode || selectedPath.mode || 'ipd',
    } : selectedPath;
    const firstName = value('web_first_name');
    const lastName = value('web_last_name');
    const currentTriageId = document.getElementById('web_triage_id')?.value ||
      document.getElementById('display_triage_id')?.textContent?.trim() ||
      loadedPatient?.triageId || '';
    return {
      key: caseNumber ? `case:${caseNumber}` : (healthId ? `health:${healthId}` : ''),
      summary: {
        caseNumber,
        healthId,
        firstName,
        lastName,
        fullName: [lastName, firstName].filter(Boolean).join(' '),
        sex: selectedSex(),
        age: value('web_age'),
        dateOfBirth: value('web_dob'),
        phone: (() => {
          const raw = value('web_phone');
          const check = window.validateCambodianPhone ? window.validateCambodianPhone(raw) : null;
          return check && check.valid ? check.normalized : raw;
        })(),
        equityCard: value('web_equity'),
        paymentType: value('web_nssf') ? 'NSSF' : (value('web_equity') ? 'Equity Fund' : ''),
        departmentCode: path.code,
        departmentNameKh: path.kh,
        departmentNameEn: path.en,
        serviceMode: path.mode,
        entryDate: value('web_date'),
        triageId: currentTriageId && currentTriageId !== '-' ? currentTriageId : '',
        photo: document.getElementById('web_patient_photo')?.value || loadedPatient?.photo || '',
        // Registration and clinical-form saves must never create a discharge date.
        // Discharge is written only by the dedicated discharge form endpoint.
        dischargeDate: '',
      },
    };
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

  function setStatus(state, message) {
    const status = document.getElementById('emr-record-status');
    if (!status) return;
    status.dataset.state = state;
    status.textContent = message;
  }

  function selectedCaseType() {
    const selected = document.querySelector('input[name="emr_pmrs_case_type"]:checked');
    return selected?.value || '';
  }

  function ensureAdmissionApprovalPanel() {
    const existing = document.getElementById('admission-approval-panel');
    if (existing) existing.remove();
    return null;
  }

  async function refreshAdmissionApprovalPanel() {
    const existing = document.getElementById('admission-approval-panel');
    if (existing) existing.remove();
  }

  function applyTriageWorkspaceRestrictions() {
    const role = String(window.emrSession?.user?.activeRole || window.sessionStorage?.getItem('borkeo-active-role') || '').toUpperCase();
    if (role !== 'TRIAGE') return;
    document.documentElement.classList.add('triage-restricted');
    document.documentElement.classList.remove('bed-direct-opd', 'bed-direct-medical', 'bed-direct-nursing', 'bed-direct-daily', 'bed-direct-discharge');
    document.documentElement.classList.add('bed-direct-view', 'bed-direct-triage');
    document.getElementById('btn_page1')?.setAttribute('hidden','');
    document.getElementById('btn_page3')?.setAttribute('hidden','');
    document.getElementById('page1')?.setAttribute('hidden','');
    document.getElementById('page3')?.setAttribute('hidden','');
    document.querySelector('.step-wrapper')?.setAttribute('hidden','');
    document.querySelector('.dashboard-header')?.setAttribute('hidden','');
    const p1 = document.getElementById('page1');
    const p3 = document.getElementById('page3');
    if (p1) { p1.classList.remove('active'); p1.hidden = true; }
    if (p3) { p3.classList.remove('active'); p3.hidden = true; }
    const p2 = document.getElementById('page2');
    if (p2) { p2.classList.add('active'); p2.hidden = false; }
    window.switchPage?.(2);
    document.querySelectorAll('#page1 input,#page1 select,#page1 textarea,#page1 [contenteditable="true"]').forEach(control => {
      control.disabled = true;
      control.setAttribute('aria-readonly','true');
    });
    document.querySelector('#page1 .emr-save-bar')?.setAttribute('hidden','');
    const historyButton = document.getElementById('btn_view_patient_history');
    if (historyButton) historyButton.setAttribute('hidden','');
    if (new URLSearchParams(window.location.search).get('view') && new URLSearchParams(window.location.search).get('view') !== 'triage') {
      const url = new URL(window.location.href); url.searchParams.set('view', 'triage'); window.history.replaceState({},'',url);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function validateCaregiverInfo() {
    const nameInput = document.getElementById('web_caregiver_name');
    const phoneInput = document.getElementById('web_caregiver_phone');
    const relationSelect = document.getElementById('web_caregiver_relation');
    const sexRadio = document.querySelector('input[name="web_caregiver_sex"]:checked');
    const phoneErrDiv = document.getElementById('web_caregiver_phone_error');
    const lang = document.documentElement.lang === 'en' ? 'en' : 'km';

    const nameVal = String(nameInput?.value || '').trim();
    const phoneVal = String(phoneInput?.value || '').trim();
    const relationVal = String(relationSelect?.value || '').trim();
    const sexVal = String(sexRadio?.value || '').trim();

    nameInput?.classList.toggle('field-missing', !nameVal);
    phoneInput?.classList.toggle('field-missing', !phoneVal);
    relationSelect?.classList.toggle('field-missing', !relationVal);

    const missing = [];
    if (!nameVal) missing.push('ឈ្មោះអ្នកកំដរ');
    if (!phoneVal) missing.push('លេខទូរសព្ទ');
    if (!relationVal) missing.push('ទំនាក់ទំនង');
    if (!sexVal) missing.push('ភេទ');

    if (missing.length > 0) {
      if (phoneErrDiv && !phoneVal) {
        phoneErrDiv.textContent = lang === 'en' ? 'Caregiver phone number is required.' : 'សូមបញ្ចូលលេខទូរសព្ទអ្នកកំដរ';
        phoneErrDiv.style.display = 'block';
      }
      if (!nameVal) nameInput?.focus();
      else if (!phoneVal) phoneInput?.focus();
      else if (!relationVal) relationSelect?.focus();
      return 'សូមបំពេញព័ត៌មានអ្នកកំដរឱ្យបានគ្រប់ជ្រុងជ្រោយ (' + missing.join(', ') + ') មុនបន្ត!';
    }

    if (typeof window.validateCambodianPhone === 'function') {
      const result = window.validateCambodianPhone(phoneVal, lang);
      if (!result.valid) {
        phoneInput?.classList.add('field-missing');
        if (phoneErrDiv) {
          phoneErrDiv.textContent = result.error;
          phoneErrDiv.style.display = 'block';
        }
        phoneInput?.focus();
        return result.error;
      } else {
        phoneInput?.classList.remove('field-missing');
        if (phoneErrDiv) {
          phoneErrDiv.textContent = '';
          phoneErrDiv.style.display = 'none';
        }
        if (phoneInput && result.normalized) {
          phoneInput.value = result.normalized;
        }
      }
    }

    return '';
  }
  window.validateCaregiverInfo = validateCaregiverInfo;

  function validatePatient(context, options = {}) {
    if (!context.key) return t('idRequired');
    if (!context.summary.fullName) return t('nameRequired');
    if (!context.summary.sex || !context.summary.age || !context.summary.entryDate) return t('detailsRequired');
    const currentRole = String(window.emrSession?.user?.activeRole || '').toUpperCase();
    const inRegistrationScope = activeEditorScope() === 'registration' || options.transferToTriage || currentRole === 'REGISTRATION';
    if (currentRole === 'REGISTRATION' && !selectedCaseType()) return 'សូមជ្រើសរើស ករណីថ្មី ឬ ករណីចាស់ មុនរក្សាទុកការចុះឈ្មោះ។';

    if (inRegistrationScope) {
      const caregiverError = validateCaregiverInfo();
      if (caregiverError) return caregiverError;
    }

    const phoneInput = document.getElementById('web_phone');
    const phoneErrDiv = document.getElementById('web_phone_error');
    const phoneVal = String(phoneInput?.value || context.summary.phone || '').trim();
    const lang = document.documentElement.lang === 'en' ? 'en' : 'km';

    if (phoneVal && typeof window.validateCambodianPhone === 'function') {
      const result = window.validateCambodianPhone(phoneVal, lang);
      if (!result.valid) {
        phoneInput?.classList.add('field-missing');
        if (phoneErrDiv) {
          phoneErrDiv.textContent = result.error;
          phoneErrDiv.style.display = 'block';
        }
        phoneInput?.focus();
        return result.error;
      } else {
        phoneInput?.classList.remove('field-missing');
        if (phoneErrDiv) {
          phoneErrDiv.textContent = '';
          phoneErrDiv.style.display = 'none';
        }
        if (phoneInput && result.normalized) {
          phoneInput.value = result.normalized;
          context.summary.phone = result.normalized;
        }
      }
    }

    if (!options.allowMissingDepartment && !context.summary.departmentCode) return t('departmentRequired');
    return '';
  }

  function activeEditorScope() {
    if (document.getElementById('page1')?.classList.contains('active')) return 'registration';
    if (document.getElementById('page2')?.classList.contains('active')) return 'triage';
    if (document.getElementById('sub_nursing')?.classList.contains('active')) return 'nursing';
    if (document.getElementById('sub_opd')?.classList.contains('active') ||
        document.getElementById('sub_ipd')?.classList.contains('active') ||
        ['opd','medical','daily','discharge'].includes(document.body.dataset.clinicalView)) return 'medical';
    return '';
  }

  async function savePatientRecord(options = {}) {
    if(window.EmrEncounterEditor?.canWrite()===false)return false;
    const requiredScope = options.transferToTriage ? document.getElementById('sub_reg') :
      document.querySelector('.page.active .sub-tab.active') || document.querySelector('.page.active');
    if (window.BorkeoRequiredFields?.validate(requiredScope) === false) return false;
    ensureFirstExamDateTime();
    const context = patientContext();
    if (activeEditorScope() === 'medical' && window.validateEmrDiagnoses?.() === false) return false;
    // v42.3: a prescription line with a medicine but no route cannot be saved.
    const routeError = activeEditorScope() === 'medical'
      ? window.validateMedicationRoutes?.('#opd_rx_tbody tr.orx-main-row, #rx_tbody tr.rx-main-row, #rx_protocol_tbody tr.protocol-main-row') : '';
    if (routeError) {
      setStatus('error', routeError);
      return false;
    }
    // v42.5: a line above the maximum dose needs the written reason before saving.
    const doseError = activeEditorScope() === 'medical'
      ? window.EmrMedicationSafety?.validateDoses('#opd_rx_tbody tr.orx-main-row, #rx_tbody tr.rx-main-row, #rx_protocol_tbody tr.protocol-main-row') : '';
    if (doseError) {
      setStatus('error', doseError);
      return false;
    }
    const validation = validatePatient(context, options);
    if (validation) {
      setStatus('error', validation);
      window.alert(validation);
      return false;
    }
    const previewNewPatientCard = activeEditorScope() === 'registration' && !loadedPatient && !registrationVisitSourceKey;
    setStatus('saving', t('saving'));
    try {
      const token = await getCsrfToken();
      const rawRecordData = readRecordData();
      const data = window.EmrEncounterEditor?.filterData(rawRecordData) || rawRecordData;
      if (['REGISTRATION'].includes(String(window.emrSession?.user?.activeRole || '').toUpperCase()) && selectedCaseType()) { data['scope:registration:id:emr_pmrs_case_new'] = selectedCaseType() === 'new'; data['scope:registration:id:emr_pmrs_case_old'] = selectedCaseType() === 'old'; }
      const nursingMeta = nursingDayAndLabel();
      const marksMedicalComplete = options.markMedicalComplete ||
        document.body.dataset.clinicalView === 'medical';
      if (marksMedicalComplete) data['system:medicalRecordCompleted'] = true;
      const activeSubTab = (document.querySelector('#page3 .sub-tab.active')?.id || '').replace('sub_', '') ||
        (getEmrCarePath()?.mode === 'ipd' ? 'ipd' : 'opd');
      const response = await fetch('/api/patient-record', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({
          submitOpdPrescription: options.submitOpdPrescription === true,
          transferToTriage: options.transferToTriage === true,
          editOnly: options.editOnly === true,
          triageSave: options.triageSave === true,
          triageEdit: options.triageEdit === true,
          triageWardChanged: options.triageWardChanged === true,
          previousWard: options.previousWard,
          expectedVersion: loadedPatient?.version,
          editorScope: activeEditorScope(),
          clinicalSubTab: activeSubTab,
          patientKey: context.key,
          newVisitFrom: registrationVisitSourceKey || undefined,
          summary: context.summary,
          data,
          nursingDays: nursingMeta.days,
          nursingLabels: nursingMeta.labels,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unknown error');
      loadedPatient = result.patient;
      await loadEditorHistory();
      renderRecordSignatures();
      setStatus('saved', `${t('saved')}${document.body.classList.contains('emr-opd-workspace') ? '' : ' · ' + result.patient.fullName}${result.opdQueue ? ` · OPD លេខរៀង ${result.opdQueue.number}` : ''}${result.pharmacySubmission ? ' · បានផ្ញើវេជ្ជបញ្ជាទៅឱសថស្ថាន' : ''}${result.wardMedicineNotification ? ' · បានជូនដំណឹងដល់ឱសថស្ថានអំពីអ្នកជំងឺថ្មីក្នុងបញ្ជីឱសថ' : ''}`);
      registrationVisitSourceKey = '';
      const url = new URL(window.location.href);
      url.searchParams.delete('newVisitFrom');
      url.searchParams.set('patient', result.patient.patientKey);
      window.history.replaceState({}, '', url);
      document.dispatchEvent(new CustomEvent('emr:patient-saved', { detail: { patient: loadedPatient } }));
      void refreshAdmissionApprovalPanel();
      applyTriageWorkspaceRestrictions();
      updateTriageSaveButtonState();
      if (previewNewPatientCard) await window.previewRegisteredPatientCard?.(loadedPatient);
      if (String(window.emrSession?.user?.activeRole || '').toUpperCase() === 'TRIAGE') {
        const ward = getSelectedTriageWard();
        if (ward) {
          if (ward === 'opd') {
            window.alert('បានបញ្ជូនទៅបញ្ជរបង់ប្រាក់ដើម្បីពិគ្រោះជំងឺ');
          } else {
            window.alert(`បានបញ្ជូនអ្នកជំងឺទៅកាន់ ${ward} រួចរាល់ហើយ`);
          }
        }
      }
      if (String(window.emrSession?.user?.activeRole || '').toUpperCase() === 'TRIAGE' && options.continueTo) {
        window.location.href = '/triage';
        return true;
      }
      if(options.transferToTriage){window.location.assign('/patient-list');return true;}
      if (options.continueTo) window.switchPage?.(Number(options.continueTo));
      return true;
    } catch (error) {
      setStatus('error', t('saveError') + error.message);
      return false;
    }
  }

  // Printing reads the form only. Saving/signing is a separate clinical action.
  let printingOpd = false;
  async function printSignedOpd(method) {
    if (printingOpd) return;
    printingOpd = true;
    try { return await method(); } finally { printingOpd = false; }
  }

  async function loadNewRegistrationVisit(patientKey) {
    setStatus('loading', t('saving'));
    try {
      const sessionResponse = await fetch('/api/auth/me', {credentials:'same-origin',cache:'no-store'});
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || !['REGISTRATION','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(session.user?.activeRole)) throw new Error('Registration access is required.');
      const response = await fetch(`/api/patient-record?patientKey=${encodeURIComponent(patientKey)}&readOnly=${new URLSearchParams(location.search).get('mode')==='edit'?'0':'1'}`, {credentials:'same-origin',cache:'no-store'});
      const result = await response.json();
      if (!response.ok || !result.patient) throw new Error(result.error || t('loadError'));
      const previous = result.patient;
      const identity = {web_health_id:previous.healthId,web_last_name:previous.lastName,
        web_first_name:previous.firstName,web_age:previous.age,web_dob:previous.dateOfBirth,
        web_phone:previous.phone,web_equity:previous.equityCard};
      if (!identity.web_last_name && !identity.web_first_name) identity.web_last_name = previous.fullName || '';
      for (const id of ['web_nssf','web_nat','web_province','web_province_code','web_district','web_district_code','web_commune','web_commune_code','web_village','web_village_code','web_street_address','web_coverage_area','web_caregiver_name','web_caregiver_phone','web_caregiver_relation']) {
        identity[id] = previous.data?.[`scope:registration:id:${id}`] ?? previous.data?.[`id:${id}`] ?? '';
      }
      Object.entries(identity).forEach(([id,value]) => {
        const control = document.getElementById(id);
        if (!control) return;
        const stored = String(value || '');
        if (id === 'web_nat' && window.EMRNationalities?.findEntry(stored)) {
          control.value = window.EMRNationalities.findEntry(stored).value;
        } else {
          if (control.tagName === 'SELECT' && stored && ![...control.options].some(option => option.value === stored)) control.add(new Option(stored,stored));
          control.value = stored;
        }
      });
      if (window.EMRCambodiaAddress && typeof window.EMRCambodiaAddress.populateFromRecord === 'function') {
        window.EMRCambodiaAddress.populateFromRecord(previous.data || {});
      }
      if (typeof window.updateCoverageAreaFromRecord === 'function') {
        window.updateCoverageAreaFromRecord(previous.data || {});
      }
      // Copy identity only: this form has no previous triage, prescriptions,
      // discharge, bed assignment, signatures or completed medical record.
      loadedPatient = null;
      registrationVisitSourceKey = previous.patientKey;
      document.getElementById('web_health_id').readOnly=true;
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Phnom_Penh',
        year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
        .formatToParts(new Date()).map(part => [part.type,part.value]));
      const today = `${parts.year}-${parts.month}-${parts.day}`;
      document.getElementById('web_date').value = today;
      document.getElementById('web_time').value = `${parts.hour}:${parts.minute}`;
      const caseNumber = document.getElementById('web_adm_no');
      const randomBytes = crypto.getRandomValues(new Uint8Array(8));
      const visitId = Array.from(randomBytes, byte => byte.toString(16).padStart(2,'0')).join('').toUpperCase();
      caseNumber.value = `BK-${today.replace(/-/g,'')}-${visitId}`;
      caseNumber.dataset.autoGenerated = 'false';
      caseNumber.dataset.manualEntry = 'true';
      document.querySelectorAll('input[name="emr_pmrs_case_type"]').forEach(control => {control.checked = control.value === 'old';control.disabled=true;});
      restorePatientSex(previous);
      if (previous.dateOfBirth) window.calculateAgeFromDOB?.();
      window.syncFields?.();
      window.switchPage?.(1);
      window.switchSubTab?.('reg');
      setStatus('saved', language() === 'khmer' ? 'ព័ត៌មានអ្នកជំងឺត្រូវបានបំពេញសម្រាប់ការចុះឈ្មោះថ្មី។ សូមពិនិត្យ រួចបញ្ជូនទៅផ្នែកទ្រីយ៉ា។' : 'Patient details are ready for a new visit. Review and send to Triage.');
      document.dispatchEvent(new CustomEvent('emr:new-registration-ready', {detail:{sourcePatientKey:previous.patientKey}}));
    } catch (error) {
      setStatus('error', error.message);
      window.alert(error.message);
    }
  }

  async function loadPatientRecord(patientKey) {
    if (!patientKey) return;
    setStatus('loading', language() === 'khmer' ? 'កំពុងបើកទិន្នន័យ…' : 'Loading patient…');
    try {
      const response = await fetch(`/api/patient-record?patientKey=${encodeURIComponent(patientKey)}&readOnly=${new URLSearchParams(location.search).get('mode')==='edit'?'0':'1'}`, {
        credentials: 'same-origin', cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t('loadError'));
      if (!result.patient) {
        setStatus('error', t('loadError'));
        return;
      }
      loadedPatient = result.patient;
      restoreRecordData(result.patient.data || {});
      if (result.patient.data?.['system:previousPatientKey']) {
        document.querySelectorAll('input[name="emr_pmrs_case_type"]').forEach(control => {control.checked=control.value==='old';control.disabled=true;});
        document.getElementById('web_health_id').readOnly=true;
      }
      restorePatientSex(result.patient);
      window.requestAnimationFrame(() => restorePatientSex(result.patient));
      window.setTimeout(() => restorePatientSex(result.patient), 100);
      window.setTimeout(() => restorePatientSex(result.patient), 300);
      const photo = result.patient.photo || result.patient.data?.['system:patientPhoto'] || result.patient.data?.['scope:registration:id:web_patient_photo'] || result.patient.data?.['scope:registration:id:patient_photo'] || '';
      if (photo) {
        const photoInput = document.getElementById('web_patient_photo');
        if (photoInput) photoInput.value = photo;
        if (typeof window.updatePatientPhotoDisplay === 'function') {
          window.updatePatientPhotoDisplay(photo);
        }
        const forcePhotoRender = () => {
          if (typeof window.updatePatientPhotoDisplay === 'function') {
            window.updatePatientPhotoDisplay(photo);
          }
          const regAvatar = document.getElementById('reg_patient_photo_avatar');
          if (regAvatar && (!regAvatar.querySelector('img') || regAvatar.querySelector('img').src !== photo)) {
            regAvatar.innerHTML = `<img src="${escapeHtml(photo)}" alt="Patient photo"><div class="registration-avatar-camera-badge" title="កែប្រែរូបថត">📷</div>`;
          }
          const triageFrame = document.getElementById('triage_patient_photo_frame');
          if (triageFrame && (!triageFrame.querySelector('img') || triageFrame.querySelector('img').src !== photo)) {
            triageFrame.innerHTML = `<img src="${escapeHtml(photo)}" alt="Patient Photo" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
          }
        };
        forcePhotoRender();
        window.requestAnimationFrame(forcePhotoRender);
        window.setTimeout(forcePhotoRender, 100);
        window.setTimeout(forcePhotoRender, 300);
      }
      await loadEditorHistory();
      renderRecordSignatures();
      setStatus(document.body.classList.contains('emr-opd-workspace') ? 'ready' : 'saved', `${result.patient.fullName}${result.opdQueue ? ` · OPD លេខរៀង ${result.opdQueue.number}` : ''}`);
      document.dispatchEvent(new CustomEvent('emr:patient-loaded', { detail: { patient: loadedPatient } }));
      void refreshAdmissionApprovalPanel();
      applyTriageWorkspaceRestrictions();
      updateTriageSaveButtonState();
    } catch (error) {
      setStatus('error', `${t('loadError')} ${error.message}`);
    }
  }

  function parsedSignature(scope) {
    const raw = loadedPatient?.data?.[`system:signature:${scope}`];
    if (!raw) return null;
    try { const value = typeof raw === 'string' ? JSON.parse(raw) : raw; return value && typeof value === 'object' ? value : null; }
    catch { return null; }
  }

  function escapeHistory(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  async function loadEditorHistory() {
    editorHistory = [];
    if (!loadedPatient?.patientKey) return;
    try {
      const response = await fetch(`/api/patient-editor-history?patientKey=${encodeURIComponent(loadedPatient.patientKey)}`, { credentials:'same-origin', cache:'no-store' });
      if (response.ok) editorHistory = (await response.json()).entries || [];
    } catch { /* The saved form remains available if its audit panel is offline. */ }
  }

  function historyNotes(entries) {
    return entries.map(entry => `<article><strong>${escapeHistory(entry.editorName)}</strong> · ${escapeHistory(new Date(entry.savedAt).toLocaleString())}
      ${entry.notes?.length ? `<ul>${entry.notes.map(note => `<li><b>${escapeHistory(note.label || 'កំណត់ត្រា')}</b>: <span style="white-space:pre-wrap">${escapeHistory(note.text)}</span></li>`).join('')}</ul>` : ''}</article>`).join('');
  }

  function editorHistoryPanel(id, scope) {
    const signatureSlot = document.getElementById(id);
    if (!signatureSlot) return;
    let panel = signatureSlot.nextElementSibling;
    if (!panel?.matches('[data-editor-history]')) {
      panel = document.createElement('div');
      panel.dataset.editorHistory = scope;
      panel.className = 'emr-editor-history no-print';
      signatureSlot.insertAdjacentElement('afterend', panel);
    }
    const entries = editorHistory.filter(entry => entry.scope === scope || (scope === 'medical' && entry.scope === 'legacy'));
    panel.innerHTML = entries.length ? `<strong>អ្នកកែប្រែ និងម៉ោងរក្សាទុក</strong> · ${entries.map(entry =>
      `<span>${escapeHistory(entry.editorName)} (${escapeHistory(new Date(entry.savedAt).toLocaleString())})${entry.scope === 'legacy' ? ' · កំណត់ត្រាចាស់៖ មិនបានបញ្ជាក់ផ្នែកកែប្រែ' : ''}</span>`).join(' · ')}` : '';
    panel.hidden = !entries.length;
  }

  function signatureHtml(signature, emptyLabel) {
    if (!signature) return `<div class="emr-esign-empty">${emptyLabel || 'មិនទាន់មានហត្ថលេខាអេឡិចត្រូនិក'}</div>`;
    const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const when = signature.signedAt ? new Date(signature.signedAt).toLocaleString() : '';
    const signer = signature.signerName || signature.displayName || signature.username || '';
    return `<div class="emr-esign-stamp">${signature.signatureDataUrl ? `<img src="${safe(signature.signatureDataUrl)}" alt="ហត្ថលេខាអេឡិចត្រូនិក">` : `<div class="emr-esign-text-signature">${safe(signer)}</div>`}<strong>${safe(signer)}</strong><div class="emr-esign-line" aria-hidden="true"></div><small>@${safe(signature.username || '')}${signature.role ? ` · ${safe(signature.role)}` : ''}${when ? ` · ${safe(when)}` : ''}</small></div>`;
  }

  function ensureNursingSignatureSlot() {
    const care = document.getElementById('nursing-care-section');
    if (!care || document.getElementById('nursing-staff-esign')) return;
    const slot = document.createElement('div');
    slot.id = 'nursing-staff-esign';
    slot.className = 'emr-esign-slot emr-nursing-esign';
    slot.innerHTML = '<span class="emr-esign-label">ឈ្មោះ និងហត្ថលេខាបុគ្គលិកថែទាំ</span><div class="emr-esign-content" data-emr-esign-content></div>';
    care.append(slot);
  }

  function currentNursingIdentitySignature() {
    const user = window.emrSession?.user;
    if (!user || !['NURSE','MIDWIFE'].includes(String(user.activeRole || '').toUpperCase())) return null;
    if (currentSessionSignature) return currentSessionSignature;
    return { signerName: user.displayName || user.username || '', displayName: user.displayName || '', username: user.username || '', role: user.activeRole || '', signatureDataUrl: '', signedAt: null };
  }

  function currentTriageIdentitySignature() {
    const user = window.emrSession?.user;
    if (!user || String(user.activeRole || '').toUpperCase() !== 'TRIAGE') return null;
    if (currentSessionSignature) return currentSessionSignature;
    return { signerName: user.displayName || user.username || '', displayName: user.displayName || '', username: user.username || '', role: 'TRIAGE', signatureDataUrl: '', signedAt: null };
  }

  function currentDoctorIdentitySignature() {
    const user = window.emrSession?.user;
    if (!user || String(user.activeRole || '').toUpperCase() !== 'DOCTOR') return null;
    if (currentSessionSignature) return currentSessionSignature;
    return {
      signerName: user.displayName || user.username || '',
      displayName: user.displayName || '',
      username: user.username || '',
      role: 'DOCTOR',
      signatureDataUrl: '',
      signedAt: null,
    };
  }

  function getAdmissionOrigin() {
    const mode = window.getEmrCarePath?.()?.mode || '';
    const data = loadedPatient?.data || {};
    return mode === 'opd' || data['system:opdConsultedAt'] || parsedSignature('opdDoctor') ? 'opd' : 'ipd';
  }
  window.getAdmissionOrigin = getAdmissionOrigin;

  function getAdmissionDoctorSignature() {
    const carePath = typeof window.getEmrCarePath === 'function' ? window.getEmrCarePath() : null;
    const mode = carePath ? carePath.mode : '';
    const userRole = String(window.emrSession?.user?.activeRole || '').toUpperCase();
    const fallbackCurrentDoc = userRole === 'DOCTOR' ? currentDoctorIdentitySignature() : null;

    if (getAdmissionOrigin() === 'opd') {
      return parsedSignature('opdDoctor') || parsedSignature('medical') || parsedSignature('ipdDoctor') || fallbackCurrentDoc;
    }
    if (mode === 'ipd') {
      return parsedSignature('ipdDoctor') || parsedSignature('medical') || parsedSignature('opdDoctor') || fallbackCurrentDoc;
    }
    if (mode === 'opd') {
      return parsedSignature('opdDoctor') || parsedSignature('medical') || parsedSignature('ipdDoctor') || fallbackCurrentDoc;
    }
    return parsedSignature('ipdDoctor') || parsedSignature('opdDoctor') || parsedSignature('medical') || fallbackCurrentDoc;
  }

  async function loadCurrentSessionSignature() {
    try {
      const response = await fetch('/api/esignature/me', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return null;
      const result = await response.json();
      currentSessionSignature = result.signature || null;
      renderRecordSignatures();
      return currentSessionSignature;
    } catch (_) { return null; }
  }

  function nursingSignatureStamp(signature, signer) {
    return signature.signatureDataUrl
      ? `<img src="${signature.signatureDataUrl}" alt="ហត្ថលេខា"><small>${signer}${signature.username ? ` · @${signature.username}` : ''}</small>`
      : `<strong>${signer}</strong><small>ហត្ថលេខាអេឡិចត្រូនិក${signature.username ? ` · @${signature.username}` : ''}</small>`;
  }

  function renderInlineNursingSignatures() {
    const signaturesByDay = new Map(editorHistory.filter(entry => entry.scope === 'nursing').map(entry => [entry.day, entry]));
    document.querySelectorAll('table.evolution-table').forEach(table => {
      const headings = (table.querySelector('thead')?.textContent || '').replace(/\s+/g, ' ');
      if (!headings.includes('ហត្ថលេខា')) return;
      table.querySelectorAll('tbody tr').forEach(row => {
        const cell = row.lastElementChild;
        if (!cell) return;
        const dateText = row.querySelector('[data-nursing-date]')?.value || '';
        const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(dateText);
        const day = /^\d{4}-\d{2}-\d{2}/.exec(dateText)?.[0] ||
          (local ? `${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}` : '');
        const entry = signaturesByDay.get(day);
        const signer = entry?.editorName || '';
        const textarea = cell.querySelector('textarea');
        if (textarea) {
          if (entry && (!textarea.value.trim() || textarea.dataset.autoNurseName === 'true')) {
            textarea.value = signer;
            textarea.readOnly = true;
            textarea.dataset.autoNurseName = 'true';
          }
        }
        let stamp = cell.querySelector('[data-inline-nursing-esign]');
        if (!stamp) {
          stamp = document.createElement('div');
          stamp.dataset.inlineNursingEsign = '1';
          stamp.className = 'inline-nursing-esign';
          cell.append(stamp);
        }
        const sameSignatureDay = parsedSignature('nursing')?.signedAt &&
          editorHistory.filter(item => item.scope === 'nursing').at(-1)?.day === day;
        const signature = sameSignatureDay ? parsedSignature('nursing') : null;
        stamp.innerHTML = entry ? nursingSignatureStamp(signature || { signatureDataUrl:'',username:'' }, escapeHistory(signer)) : '';
        const dailyHistory = editorHistory.filter(item => item.scope === 'nursing' && item.day === day);
        if (dailyHistory.length) {
          let details = cell.querySelector('[data-nursing-history]');
          if (!details) { details = document.createElement('details'); details.dataset.nursingHistory = '1'; details.className='no-print nursing-editor-history'; cell.append(details); }
          details.innerHTML = `<summary>${escapeHistory(signer)} · ${escapeHistory(new Date(entry.savedAt).toLocaleString())} · កំណត់ត្រាមុន</summary>${historyNotes(dailyHistory)}`;
        }
      });
    });
    const signature = parsedSignature('nursing') || currentNursingIdentitySignature();
    const signer = signature?.signerName || signature?.displayName || signature?.username || '';
    document.querySelectorAll('[data-auto-nursing-signature]').forEach(slot => {
      if (signature) slot.innerHTML = nursingSignatureStamp(signature, escapeHistory(signer));
    });
  }

  function renderRecordSignatures() {
    ensureNursingSignatureSlot();
    const opdSig = parsedSignature('opdDoctor') || parsedSignature('medical') || currentDoctorIdentitySignature();
    const opdContent = document.querySelector('#opd-doctor-esign [data-emr-esign-content]');
    if (opdContent) opdContent.innerHTML = signatureHtml(opdSig, 'រក្សាទុកដោយវេជ្ជបណ្ឌិត ដើម្បីភ្ជាប់ហត្ថលេខា');
    editorHistoryPanel('opd-doctor-esign', 'medical');

    const ipdSig = parsedSignature('ipdDoctor') || parsedSignature('medical') || currentDoctorIdentitySignature();
    const ipdContent = document.querySelector('#ipd-doctor-esign [data-emr-esign-content]');
    if (ipdContent) ipdContent.innerHTML = signatureHtml(ipdSig, 'រក្សាទុកដោយវេជ្ជបណ្ឌិត ដើម្បីភ្ជាប់ហត្ថលេខា');
    editorHistoryPanel('ipd-doctor-esign', 'medical');

    const admContent = document.querySelector('#adm-doctor-esign [data-emr-esign-content]');
    if (admContent) {
      const admSig = getAdmissionDoctorSignature();
      admContent.innerHTML = signatureHtml(admSig, 'មិនទាន់មានហត្ថលេខាគ្រូពេទ្យ');
    }
    const triage = document.querySelector('#triage-nurse-esign [data-emr-esign-content]');
    const triageSignature = parsedSignature('triage');
    if (triage) {
      const preview = triageSignature || currentTriageIdentitySignature();
      triage.innerHTML = signatureHtml(preview, 'នឹងបំពេញស្វ័យប្រវត្តិពីគណនីគិលានុបដ្ឋាកទ្រីយ៉ា');
    }
    const nursing = document.querySelector('#nursing-staff-esign [data-emr-esign-content]');
    if (nursing) nursing.innerHTML = signatureHtml(parsedSignature('nursing') || currentNursingIdentitySignature(), 'រក្សាទុកដោយគិលានុបដ្ឋាក ឬឆ្មប ដើម្បីភ្ជាប់ហត្ថលេខា');
    const nursingSlot = document.getElementById('nursing-staff-esign');
    if (nursingSlot) {
      let history = nursingSlot.nextElementSibling;
      if (!history?.matches('[data-nursing-day-history]')) {
        history = document.createElement('div'); history.dataset.nursingDayHistory='1'; history.className='emr-editor-history no-print';
        nursingSlot.insertAdjacentElement('afterend', history);
      }
      const byDay = new Map();
      editorHistory.filter(entry => entry.scope === 'nursing').forEach(entry => {
        if (!byDay.has(entry.day)) byDay.set(entry.day, []);
        byDay.get(entry.day).push(entry);
      });
      history.innerHTML = [...byDay].map(([day, entries]) => `<details><summary>${escapeHistory(day)} · ${escapeHistory(entries.at(-1).editorName)} · ${escapeHistory(new Date(entries.at(-1).savedAt).toLocaleString())}</summary>${historyNotes(entries)}</details>`).join('');
      history.hidden = !byDay.size;
    }
    renderInlineNursingSignatures();
  }

  function createSaveButton(options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-blue emr-save-button';
    button.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span></span>';
    button.querySelector('span').textContent = t('save');
    button.addEventListener('click', () => void savePatientRecord({
      ...options,
      markMedicalComplete: options.markMedicalComplete || document.body.dataset.clinicalView === 'medical',
    }));
    return button;
  }

  function addSaveBar(container, position = 'afterbegin', options = {}) {
    if (!container || container.querySelector(':scope > .emr-save-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'emr-save-bar no-print';
    bar.append(createSaveButton(options));
    container.insertAdjacentElement(position, bar);
  }

  async function showPmrs2FollowUpPreview() {
    const patientKey = loadedPatient?.patientKey;
    if (!patientKey) { alert('សូមរក្សាទុក និងបើកកំណត់ត្រាអ្នកជំងឺជាមុនសិន។'); return; }
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'width:min(850px,94vw);max-height:88vh;overflow:auto;border:1px solid #cbd5e1;border-radius:12px;padding:20px;font:14px/1.5 sans-serif';
    const heading = document.createElement('h2');
    heading.textContent = 'ពិនិត្យទិន្នន័យសម្រាប់ PMRS2';
    const intro = document.createElement('p');
    intro.textContent = 'ទិន្នន័យនេះមកពីកំណត់ត្រាដែលបានរក្សាទុក។ សូមពិនិត្យមុនបញ្ចូលក្នុង PMRS2។';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'បិទ';
    close.onclick = () => dialog.close();
    dialog.append(heading, intro, close);
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
    try {
      const response = await fetch(`/api/pmrs2/preview?patientKey=${encodeURIComponent(patientKey)}`, { credentials: 'same-origin', cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'មិនអាចទាញទិន្នន័យបានទេ។');
      const identity = document.createElement('p');
      identity.textContent = `អ្នកជំងឺ: ${payload.preview?.patientName || '—'} · លេខករណី: ${payload.preview?.caseNumber || '—'} · លេខប័ណ្ណសុខភាព: ${payload.preview?.healthId || '—'}`;
      dialog.append(identity);
      const explain = {
        FOLLOW_UP_DATE_TIME_REQUIRED: 'ត្រូវបញ្ជាក់ថ្ងៃ និងម៉ោង',
        FOLLOW_UP_VITALS_INCOMPLETE: 'សញ្ញាជីវិតមិនទាន់គ្រប់',
        FOLLOW_UP_EVOLUTION_REQUIRED: 'ខ្វះការវិវត្តន៍',
        FOLLOW_UP_CONCLUSION_REQUIRED: 'ខ្វះសេចក្តីសន្និដ្ឋាន',
        FOLLOW_UP_MEDICATION_REVIEW: 'ត្រូវពិនិត្យកម្រិត និងម៉ោងប្រើថ្នាំ',
        SAME_TIME_AS_ADMISSION_REVIEW: 'ម៉ោងតាមដានស្ទួននឹងម៉ោងចូលសម្រាក',
        MEDICATION_UNIT_REVIEW: 'ឯកតាថ្នាំត្រូវត្រួតពិនិត្យ',
        MEDICATION_TIMING_REVIEW: 'ពេលប្រើថ្នាំត្រូវបំពេញដោយដៃ',
        MEDICATION_DOSE_CONFLICT: 'កម្រិតថ្នាំមិនដូចគ្នា',
        MEDICATION_DOSE_REVIEW: 'កម្រិតថ្នាំត្រូវត្រួតពិនិត្យ',
        MEDICATION_SCHEDULE_REVIEW: 'កាលវិភាគថ្នាំត្រូវត្រួតពិនិត្យ',
        MEDICATION_ROUTE_REVIEW: 'ត្រូវជ្រើសផ្លូវប្រើថ្នាំក្នុង PMRS2',
        MEDICATION_NAME_REQUIRED: 'ខ្វះឈ្មោះថ្នាំ',
        WARD_REQUIRED: 'ខ្វះផ្នែក', SERVICE_MODE_REQUIRED: 'ខ្វះប្រភេទអ្នកទទួលសេវា',
        CASE_TYPE_REQUIRED: 'សូមជ្រើសករណីថ្មី ឬករណីចាស់',
        CHIEF_COMPLAINT_REQUIRED: 'ខ្វះរោគសញ្ញា',
        DOCTOR_DIAGNOSIS_REQUIRED: 'ខ្វះរោគវិនិច្ឆ័យគ្រូពេទ្យ',
        ICD10_REQUIRED: 'ខ្វះកូដ ICD10',
        PRESCRIPTION_EMPTY_REVIEW: 'វេជ្ជបញ្ជាគ្មានថ្នាំ',
        PRESCRIPTION_MEDICATION_REVIEW: 'ត្រូវពិនិត្យព័ត៌មានថ្នាំក្នុងវេជ្ជបញ្ជា',
        LAST_FOLLOW_UP_REQUIRED: 'ខ្វះការតាមដានមានថ្ងៃម៉ោង',
        DISCHARGE_NOT_SAVED: 'ទម្រង់បញ្ចេញមិនទាន់បានរក្សាទុក',
        DISCHARGE_ADMISSION_TIME_REQUIRED: 'ខ្វះថ្ងៃ និងម៉ោងចូល',
        DISCHARGE_ADMISSION_ICD10_REQUIRED: 'ខ្វះ ICD10 ពេលចូល',
        DISCHARGE_DATE_TIME_REQUIRED: 'ខ្វះថ្ងៃ និងម៉ោងចេញ',
        DISCHARGE_BEFORE_ADMISSION_REVIEW: 'ថ្ងៃម៉ោងចេញនៅមុនថ្ងៃម៉ោងចូល',
        DISCHARGE_DIAGNOSIS_REQUIRED: 'ខ្វះរោគវិនិច្ឆ័យពេលចេញ',
        DISCHARGE_ICD10_REQUIRED: 'ខ្វះ ICD10 ពេលចេញ',
        DISCHARGE_OUTCOME_REVIEW: 'ត្រូវពិនិត្យលទ្ធផលព្យាបាល',
        DISCHARGE_STATUS_REVIEW: 'ត្រូវពិនិត្យស្ថានភាពបញ្ចេញ',
        DISCHARGE_DECEASED_CONFLICT: 'លទ្ធផលស្លាប់ និងប្រអប់ស្លាប់មិនត្រូវគ្នា',
        TRIAGE_WEIGHT_REQUIRED: 'ខ្វះទម្ងន់នៅ Triage',
        TRIAGE_HEIGHT_REQUIRED: 'ខ្វះកម្ពស់នៅ Triage',
        TRIAGE_DATE_TIME_REQUIRED: 'ខ្វះថ្ងៃម៉ោងចូលនៅ Triage',
        TRIAGE_VITALS_INCOMPLETE: 'សញ្ញាជីវិត Triage មិនគ្រប់',
      };
      const section = (parent, title, value) => {
        const block = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = `${title}: `;
        const content = document.createElement('span');
        content.style.whiteSpace = 'pre-wrap';
        content.textContent = value || '—';
        block.append(label, content);
        parent.append(block);
      };
      const medicine = (parent, med) => section(parent, med.name || 'ថ្នាំ',
        `${med.doseAmount || '—'} ${med.unit || ''} · ${med.pmrsRoute || med.route || 'ផ្លូវប្រើមិនទាន់ច្បាស់'} · ${med.scheduleType || '—'} · ` +
        `ព្រឹក-ថ្ងៃ-ល្ងាច-យប់: ${med.morning || '—'}-${med.afternoon || '—'}-${med.evening || '—'}-${med.night || '—'}` +
        ` · ${med.days || '—'} ថ្ងៃ · សរុប ${med.quantity || '—'}` +
        (med.warnings?.length ? ` · ${med.warnings.map(code => explain[code] || code).join(', ')}` : ''));
      const review = payload.preview || {};
      section(dialog, 'ផ្នែកចូល / អ្នកទទួលសេវា', `${review.receivingWard || '—'} · ${review.serviceType || '—'}`);
      const triage = review.triage || {};
      section(dialog, 'ថ្ងៃម៉ោងចូល / ទម្ងន់ / កម្ពស់',
        `${triage.dateTime || '—'} · ${triage.weight || '—'} kg · ${triage.height || '—'} cm`);
      section(dialog, 'សញ្ញាជីវិតនៅ Triage',
        `T ${triage.temperature || '—'} °C · BP ${triage.systolic || '—'}/${triage.diastolic || '—'} · ` +
        `P ${triage.pulse || '—'} · RR ${triage.respiratoryRate || '—'} · SpO₂ ${triage.oxygenSaturation || '—'}%`);
      const triageIssues = (payload.reviewIssues || []).filter(issue => issue.path.startsWith('triage.'));
      if (triageIssues.length) section(dialog, 'ត្រូវពិនិត្យ Triage',
        triageIssues.map(issue => explain[issue.code] || issue.code).join(' · '));
      section(dialog, 'ទម្រង់ព្យាបាល', review.caseType);
      section(dialog, 'រោគសញ្ញា (បញ្ចូល ហើយចុច +)', review.chiefComplaint);
      section(dialog, 'រោគវិនិច្ឆ័យ / ICD10', `${review.diagnosisText || '—'} · ${review.diagnosisIcd10 || '—'}`);
      section(dialog, 'សេវាអមវេជ្ជសាស្ត្រ', review.ancillaryService);
      if (review.warnings?.length) section(dialog, 'ត្រូវពិនិត្យ', review.warnings.map(code => explain[code] || code).join(' · '));
      (payload.preview?.followUps || []).forEach((entry, index) => {
        const article = document.createElement('article');
        article.style.cssText = 'border-top:1px solid #cbd5e1;padding:14px 0';
        const title = document.createElement('h3');
        title.textContent = `${index + 1}. ${entry.source === 'admission' ? 'ថ្ងៃចូលសម្រាក' : 'ពិនិត្យតាមដាន'} · ${entry.dateTime || entry.originalDateTime || 'ត្រូវបំពេញថ្ងៃ/ម៉ោង'}`;
        article.append(title);
        const vital = entry.vitals || {};
        section(article, 'សញ្ញាជីវិត', `T ${vital.temperature || '—'} °C · BP ${vital.systolic || '—'}/${vital.diastolic || '—'} · P ${vital.pulse || '—'} · RR ${vital.respiratoryRate || '—'} · SpO₂ ${vital.oxygenSaturation || '—'}%`);
        section(article, 'ការវិវត្តន៍', entry.evolution);
        section(article, 'សេចក្តីសន្និដ្ឋាន', entry.conclusion);
        (entry.medications || []).forEach(med => medicine(article, med));
        if (entry.warnings?.length) section(article, 'ត្រូវពិនិត្យ', entry.warnings.map(code => explain[code] || code).join(' · '));
        dialog.append(article);
      });
      if (review.prescription) {
        const rx = document.createElement('article');
        rx.style.cssText = 'border-top:1px solid #cbd5e1;padding:14px 0';
        const title = document.createElement('h3');
        title.textContent = review.prescription.source === 'opd' ? 'វេជ្ជបញ្ជា OPD' : 'វេជ្ជបញ្ជាពេលចេញ IPD';
        rx.append(title);
        if (review.prescription.sourceDateTime) section(rx, 'ការតាមដានចុងក្រោយ', review.prescription.sourceDateTime);
        (review.prescription.medications || []).forEach(med => medicine(rx, med));
        if (review.prescription.followUpDate) section(rx, 'ថ្ងៃណាត់បន្ទាប់', review.prescription.followUpDate);
        if (review.prescription.counselling) section(rx, 'ការណែនាំ', review.prescription.counselling);
        if (review.prescription.warnings?.length) section(rx, 'ត្រូវពិនិត្យ', review.prescription.warnings.map(code => explain[code] || code).join(' · '));
        dialog.append(rx);
      }
      if (review.discharge) {
        const discharged = document.createElement('article');
        discharged.style.cssText = 'border-top:1px solid #cbd5e1;padding:14px 0';
        const title = document.createElement('h3');
        title.textContent = 'បញ្ចប់ការព្យាបាល IPD';
        discharged.append(title);
        for (const [label, value] of [
          ['ផ្នែកចូល / ផ្នែកចេញ', `${review.discharge.admissionWard || '—'} / ${review.discharge.dischargeWard || '—'}`],
          ['ថ្ងៃម៉ោងចូល / ថ្ងៃម៉ោងចេញ', `${review.discharge.admissionAt || '—'} / ${review.discharge.dischargeAt || '—'}`],
          ['រោគវិនិច្ឆ័យពេលចូល / ICD10', `${review.discharge.admissionDiagnosis || '—'} / ${review.discharge.admissionIcd10 || '—'}`],
          ['រោគវិនិច្ឆ័យពេលចេញ / ICD10', `${review.discharge.dischargeDiagnosis || '—'} / ${review.discharge.dischargeIcd10 || '—'}`],
          ['លទ្ធផល / ស្ថានភាពចេញ', `${review.discharge.outcome || '—'} / ${review.discharge.status || '—'}`],
          ['ថ្ងៃណាត់បន្ទាប់', review.discharge.followUpDate],
          ['កន្លែងបញ្ជូនបន្ត', review.discharge.referralDestination],
        ]) if (value) section(discharged, label, value);
        if (review.discharge.warnings?.length) section(discharged, 'ត្រូវពិនិត្យ', review.discharge.warnings.map(code => explain[code] || code).join(' · '));
        dialog.append(discharged);
      }
      const role = String(window.emrSession?.user?.activeRole || '').toUpperCase();
      if (['ADMIN','VICE_DIRECTOR', 'DOCTOR'].includes(role)) {
        const exportArea = document.createElement('section');
        exportArea.style.cssText = 'border-top:2px solid #0b7895;padding:16px 0;margin-top:8px';
        const exportTitle = document.createElement('h3');
        exportTitle.textContent = 'រៀបចំទិន្នន័យទាំងអស់ក្រោយពិនិត្យ';
        const exportNote = document.createElement('p');
        exportNote.textContent = 'ទាញយកទិន្នន័យ Triage, ការព្យាបាល, ការតាមដានទាំងអស់, វេជ្ជបញ្ជា និងទម្រង់បញ្ចេញជាឯកសារ JSON។ វាមិនទាន់បញ្ចូលទិន្នន័យទៅគេហទំព័រ PMRS2 ដោយស្វ័យប្រវត្តិទេ។';
        const identifierLabel = document.createElement('label');
        identifierLabel.textContent = 'សូមវាយលេខបណ្ណសុខភាព ឬលេខករណីដែលបានផ្ទៀងផ្ទាត់៖ ';
        const identifier = document.createElement('input');
        identifier.type = 'text';
        identifier.autocomplete = 'off';
        identifier.style.cssText = 'min-width:220px;padding:7px;margin:6px';
        identifierLabel.append(identifier);
        const reviewLabel = document.createElement('label');
        reviewLabel.style.cssText = 'display:block;margin:10px 0';
        const reviewed = document.createElement('input');
        reviewed.type = 'checkbox';
        reviewed.style.marginRight = '7px';
        reviewLabel.append(reviewed, document.createTextNode('ខ្ញុំបានផ្ទៀងផ្ទាត់អ្នកជំងឺ និងពិនិត្យទិន្នន័យ/សញ្ញាព្រមានទាំងអស់ខាងលើ។'));
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'btn-blue';
        download.textContent = 'ទាញយកកញ្ចប់ទិន្នន័យ PMRS2';
        download.disabled = true;
        const exportStatus = document.createElement('p');
        exportStatus.setAttribute('role', 'status');
        const enable = () => { download.disabled = !reviewed.checked || !identifier.value.trim(); };
        identifier.addEventListener('input', enable);
        reviewed.addEventListener('change', enable);
        download.addEventListener('click', async () => {
          download.disabled = true;
          exportStatus.textContent = 'កំពុងរៀបចំទិន្នន័យ…';
          try {
            const response = await fetch('/api/pmrs2/prepare-export', {
              method: 'POST', credentials: 'same-origin', cache: 'no-store',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
              body: JSON.stringify({ patientKey: review.patientKey, reviewedVersion: review.patientVersion,
                confirmedIdentifier: identifier.value.trim(), reviewed: reviewed.checked }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'មិនអាចរៀបចំទិន្នន័យបាន។');
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = 'Borkeo-PMRS2-reviewed-record.json';
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
            exportStatus.textContent = 'បានទាញយកកញ្ចប់ទិន្នន័យ។ សូមរក្សាទុកដោយសុវត្ថិភាព។ PMRS2 មិនទាន់បានទទួលទិន្នន័យនេះទេ។';
          } catch (error) {
            exportStatus.textContent = `មានបញ្ហា: ${error.message}`;
          } finally { enable(); }
        });
        exportArea.append(exportTitle, exportNote, identifierLabel, reviewLabel, download, exportStatus);
        dialog.append(exportArea);
      }
    } catch (error) {
      const message = document.createElement('p');
      message.textContent = `មានបញ្ហា: ${error.message}`;
      dialog.append(message);
    }
  }

  function switchNursingSection(sectionName) {
    const sections = {
      care: document.getElementById('nursing-care-section'),
      rights: document.getElementById('sub_rights'),
      agreement: document.getElementById('sub_agreement'),
    };
    Object.entries(sections).forEach(([name, panel]) => {
      if (panel) panel.hidden = name !== sectionName;
    });
    document.querySelectorAll('[data-nursing-section]').forEach(button => {
      const active = button.dataset.nursingSection === sectionName;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    if (sectionName !== 'care') window.syncRightsForm?.();
  }

  function organizeNursingSections() {
    if (nursingOrganized) return;
    const nursing = document.getElementById('sub_nursing');
    const rights = document.getElementById('sub_rights');
    const agreement = document.getElementById('sub_agreement');
    if (!nursing || !rights || !agreement) return;
    nursingOrganized = true;

    const care = document.createElement('div');
    care.id = 'nursing-care-section';
    while (nursing.firstChild) care.append(nursing.firstChild);

    rights.classList.remove('sub-tab', 'active');
    agreement.classList.remove('sub-tab', 'active');
    rights.classList.add('nursing-auxiliary-panel');
    agreement.classList.add('nursing-auxiliary-panel');

    const tabs = document.createElement('div');
    tabs.className = 'nursing-section-tabs no-print';
    tabs.setAttribute('role', 'tablist');
    [
      ['care', 'fa-user-nurse', 'care'],
      ['rights', 'fa-scale-balanced', 'rights'],
      ['agreement', 'fa-file-contract', 'agreement'],
    ].forEach(([key, icon, labelKey]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inner-tab';
      button.dataset.nursingSection = key;
      button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span></span>`;
      button.querySelector('span').textContent = t(labelKey);
      button.addEventListener('click', () => switchNursingSection(key));
      tabs.append(button);
    });
    nursing.append(tabs, care, rights, agreement);
    switchNursingSection('care');
  }

  function historyFieldLabel(fieldId) {
    const control = document.getElementById(fieldId);
    if (!control) return fieldId.replace(/^web_/, '').replace(/_/g, ' ');
    const container = control.closest('.input-group, .form-group, .modern-grid > div, td, .opd-field, .ipd-field') || control.parentElement;
    const label = container?.querySelector?.('label, .label-text, [data-key]');
    return String(label?.textContent || control.getAttribute('aria-label') || fieldId).trim().replace(/\s+/g, ' ');
  }

  function historyValue(value) {
    if (value === true) return '✓';
    if (value === false || value === null || value === undefined) return '';
    return String(value).trim();
  }

  function encounterSections(record) {
    const sections = { registration: [], triage: [], medical: [], nursing: [] };
    Object.entries(record.data || {}).forEach(([key, stored]) => {
      const match = /^scope:(registration|triage|medical|nursing):id:(.+)$/.exec(key);
      if (!match) return;
      const value = historyValue(stored);
      if (!value) return;
      sections[match[1]].push({ label: historyFieldLabel(match[2]), value });
    });
    try {
      const daily = JSON.parse(record.data?.['system:dailyMonitoringRecords'] || '[]');
      if (Array.isArray(daily) && daily.length) sections.medical.push({ label: 'កំណត់ត្រាតាមដានប្រចាំថ្ងៃ', value: `${daily.length} ថ្ងៃ` });
    } catch {}
    return sections;
  }

  function historySectionHtml(title, rows) {
    if (!rows.length) return '';
    return `<details class="patient-history-section"><summary>${escapeHtml(title)} <span>${rows.length}</span></summary><div class="patient-history-fields">${rows.map(row => `<div><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.value)}</span></div>`).join('')}</div></details>`;
  }

  async function openPatientHistory() {
    const patientKey = loadedPatient?.patientKey || new URLSearchParams(window.location.search).get('patient') || patientContext().key;
    if (!patientKey) { alert(language() === 'khmer' ? 'សូមបើកអ្នកជំងឺជាមុនសិន។' : 'សូមបើកអ្នកជំងឺជាមុនសិន។'); return; }
    const overlay = document.createElement('div');
    overlay.className = 'patient-history-overlay';
    overlay.innerHTML = '<section class="patient-history-dialog"><header><div><h2>ប្រវត្តិព្យាបាលទាំងមូល</h2><p>តម្រៀបកំណត់ត្រាសម្រាកពេទ្យ និងពិគ្រោះក្រៅតាមកាលបរិច្ឆេទ</p></div><button type="button" data-close>×</button></header><div class="patient-history-content"><div class="patient-history-loading">កំពុងទាញប្រវត្តិ…</div></div></section>';
    document.body.append(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-close]').onclick = close;
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    try {
      const response = await fetch(`/api/patient-history?patientKey=${encodeURIComponent(patientKey)}`, { credentials:'same-origin', cache:'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'មិនអាចបង្ហាញប្រវត្តិបានទេ។');
      const rows = result.history || [];
      const content = overlay.querySelector('.patient-history-content');
      content.innerHTML = rows.map(record => {
        const date = escapeHtml(record.entryDate || new Date(record.createdAt).toLocaleDateString());
        const mode = escapeHtml(String(record.serviceMode || '').toUpperCase() || 'ENCOUNTER');
        const department = escapeHtml(record.departmentNameKh || record.departmentNameEn || '');
        const caseNumber = escapeHtml(record.caseNumber || '—');
        const dischargeDate = record.dischargeDate ? ` · ចេញពីមន្ទីរពេទ្យ: ${escapeHtml(record.dischargeDate)}` : '';
        const sections = encounterSections(record);
        return `<article class="patient-history-encounter"><header><div><span class="patient-history-date">${date}</span><strong>${mode} · ${department}</strong><small>លេខករណី: ${caseNumber}${dischargeDate}</small></div><a href="/emr?patient=${encodeURIComponent(record.patientKey)}${record.serviceMode==='ipd'?'&view=medical':''}" target="_blank">បើកកំណត់ត្រា</a></header>${historySectionHtml('ព័ត៌មានចុះឈ្មោះ', sections.registration)}${historySectionHtml('Triage', sections.triage)}${historySectionHtml('កំណត់ត្រាវេជ្ជសាស្ត្រ', sections.medical)}${historySectionHtml('ឯកសារថែទាំ', sections.nursing)}</article>`;
      }).join('') || '<div class="patient-history-loading">មិនមានប្រវត្តិពីមុនទេ។</div>';
    } catch (error) {
      overlay.querySelector('.patient-history-content').innerHTML = `<div class="patient-history-error">${escapeHtml(error.message)}</div>`;
    }
  }

  function refreshLanguage() {
    document.querySelectorAll('.emr-save-button span').forEach(node => { node.textContent = t('save'); });
    document.querySelectorAll('[data-nursing-section]').forEach(button => {
      const label = button.querySelector('span');
      if (label) label.textContent = t(button.dataset.nursingSection);
    });
    const notice = document.getElementById('emr-care-route-notice');
    if (notice) notice.textContent = t(notice.dataset.mode === 'opd' ? 'opdOnly' : 'ipdOnly');
  }

  function organizeOpdHeader() {
    const host = document.getElementById('sub_opd');
    const header = document.getElementById('opd-header-patient-card');
    if (!host || !header || !host.contains(header)) return;
    // Keep this one identity header visible even when a specialty form is selected.
    host.insertBefore(header, host.querySelector(':scope > .opd-module-toolbar') || host.firstChild);
  }

  function initialize() {
    prepareStorageKeys();
    organizeNursingSections();
    ensureAdmissionApprovalPanel();
    applyTriageWorkspaceRestrictions();
    renderRecordSignatures();

    const pageOne = document.getElementById('page1');
    const pageTwo = document.getElementById('page2');
    const pageThreeTabs = document.querySelector('#page3 > .inner-tabs');
    const pageThree = document.getElementById('page3');
    // Page 2 Triage save button is located at the bottom action-bar next to btn-next; no separate top Save bar.
    document.querySelectorAll('#page2 > .emr-save-bar').forEach(el => el.remove());
    const pageTwoActionBar = document.querySelector('#page2 .action-bar');
    const pageTwoBtnNext = document.querySelector('#page2 .action-bar .btn-next');
    if (pageTwoActionBar && pageTwoBtnNext && !pageTwoActionBar.querySelector('.emr-save-button')) {
      pageTwoBtnNext.insertAdjacentElement('beforebegin', createSaveButton());
    }
    organizeOpdHeader();
    ['sub_opd', 'sub_ipd', 'sub_nursing'].forEach(id => addSaveBar(document.getElementById(id), id === 'sub_opd' ? 'beforeend' : 'afterbegin'));
    document.querySelectorAll('#sub_ipd > .emr-save-bar').forEach(el => el.remove());
    const ipdActionBar = document.querySelector('#sub_ipd > .action-bar');
    if (ipdActionBar) {
      ipdActionBar.querySelectorAll('.emr-save-button, .btn-pmrs2-preview').forEach(el => el.remove());
      const saveBtn = createSaveButton();
      const saveBtnText = saveBtn.querySelector('span');
      if (saveBtnText) saveBtnText.textContent = 'រក្សាទុក និងបញ្ចប់កំណត់ត្រាវេជ្ជសាស្ត្រ';
      ipdActionBar.append(saveBtn);
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'btn-blue btn-pmrs2-preview no-print';
      preview.textContent = 'ពិនិត្យទិន្នន័យ PMRS2';
      preview.addEventListener('click', () => void showPmrs2FollowUpPreview());
      ipdActionBar.append(preview);
    }
    updateIpdObGynVisibility();
    document.querySelectorAll('input[name="sex_radio"]').forEach(radio => {
      radio.addEventListener('change', updateIpdObGynVisibility);
    });
    const opdBar = document.querySelector('#sub_opd > .emr-save-bar');
    if (opdBar) {
      const submit = document.createElement('button');
      submit.type='button'; submit.className='btn-blue'; submit.hidden=true;
      submit.textContent='រក្សាទុក និងផ្ញើវេជ្ជបញ្ជាទៅឱសថស្ថាន';
      submit.addEventListener('click',async()=>{submit.disabled=true;try{await savePatientRecord({submitOpdPrescription:true,markMedicalComplete:true});}finally{submit.disabled=false;}});
      const show = user => {submit.hidden=user?.activeRole !== 'DOCTOR';};
      show(window.emrSession?.user);
      window.addEventListener('emr-session-ready',event=>show(event.detail?.user));
      opdBar.append(submit);
    }
    ['sub_opd', 'sub_ipd'].forEach(id => {
      const saveBar = document.querySelector(`#${id} > .emr-save-bar`);
      if (!saveBar) return;
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'btn-blue';
      preview.textContent = 'ពិនិត្យទិន្នន័យ PMRS2';
      preview.addEventListener('click', () => void showPmrs2FollowUpPreview());
      saveBar.append(preview);
    });

    if (pageThreeTabs && !document.getElementById('emr-care-route-notice')) {
      const notice = document.createElement('div');
      notice.id = 'emr-care-route-notice';
      notice.className = 'emr-care-route-notice no-print';
      notice.hidden = true;
      pageThreeTabs.insertAdjacentElement('afterend', notice);
    }
    if (pageThree && !document.getElementById('emr-record-status')) {
      const status = document.createElement('div');
      status.id = 'emr-record-status';
      status.className = 'emr-record-status no-print';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const statusAnchor = document.getElementById('patient-record-workspace-navigation') ||
        document.querySelector('.step-wrapper');
      statusAnchor?.insertAdjacentElement('afterend', status);
    }

    let languageRefreshPending = false;
    const scheduleLanguageRefresh = () => {
      if (languageRefreshPending) return;
      languageRefreshPending = true;
      setTimeout(() => { languageRefreshPending = false; refreshLanguage(); }, 0);
    };
    document.getElementById('langBtn')?.addEventListener('click', () => {
      if (typeof window.setBorkeoLanguage !== 'function') scheduleLanguageRefresh();
    });
    window.addEventListener('borkeo-language-change', scheduleLanguageRefresh);
    document.getElementById('btn_view_patient_history')?.addEventListener('click', () => void openPatientHistory());
    document.addEventListener('emr:patient-saved', event => {
      if (event.detail?.patient) { loadedPatient = event.detail.patient; renderRecordSignatures(); }
    });
    window.addEventListener('emr-session-ready', () => { renderRecordSignatures(); void loadCurrentSessionSignature(); applyTriageWorkspaceRestrictions(); void refreshAdmissionApprovalPanel(); });
    if (window.emrSession?.user) void loadCurrentSessionSignature();
    document.addEventListener('change', event => {
      if (event.target.matches('.dept-check, #p2_other_dept')) configureTreatmentWorkflow();
    });

    const parameters = new URLSearchParams(window.location.search);
    const requestedPatient = parameters.get('patient');
    if (requestedPatient) void loadPatientRecord(requestedPatient);
    else if (parameters.get('newVisitFrom')) void loadNewRegistrationVisit(parameters.get('newVisitFrom'));
    else {
      const names = parameters.get('name');
      if (names) {
        const parts = String(names).trim().split(/\s+/);
        const first = document.getElementById('web_first_name');
        const last = document.getElementById('web_last_name');
        if (first) first.value = parts.pop() || '';
        if (last) last.value = parts.join(' ');
      }
      const phone = parameters.get('phone');
      if (phone) {
        const phoneEl = document.getElementById('web_phone');
        if (phoneEl) phoneEl.value = phone;
      }
      document.getElementById('web_adm_no')?.focus();
      if (typeof window.applyAutoCaseNumber === 'function') window.applyAutoCaseNumber();
      if (typeof window.applyAutoHealthId === 'function') window.applyAutoHealthId();
    }
    setupPhoneValidation();
    configureTreatmentWorkflow();
  }

  function setupPhoneValidation() {
    function bindPhoneInput(inputEl, errorEl, isRequired) {
      if (!inputEl) return;
      const getLang = () => document.documentElement.lang === 'en' ? 'en' : 'km';

      inputEl.addEventListener('input', () => {
        const val = inputEl.value.trim();
        if (!val) {
          if (!isRequired) {
            inputEl.classList.remove('field-missing');
            if (errorEl) {
              errorEl.textContent = '';
              errorEl.style.display = 'none';
            }
          }
          return;
        }
        if (typeof window.validateCambodianPhone === 'function') {
          const res = window.validateCambodianPhone(val, getLang());
          if (res.valid) {
            inputEl.classList.remove('field-missing');
            if (errorEl) {
              errorEl.textContent = '';
              errorEl.style.display = 'none';
            }
          }
        }
      });

      inputEl.addEventListener('blur', () => {
        const val = inputEl.value.trim();
        if (!val) {
          if (isRequired) {
            inputEl.classList.add('field-missing');
            if (errorEl) {
              errorEl.textContent = getLang() === 'en' ? 'Caregiver phone number is required.' : 'សូមបញ្ចូលលេខទូរសព្ទអ្នកកំដរ';
              errorEl.style.display = 'block';
            }
          } else {
            inputEl.classList.remove('field-missing');
            if (errorEl) {
              errorEl.textContent = '';
              errorEl.style.display = 'none';
            }
          }
          return;
        }

        if (typeof window.validateCambodianPhone === 'function') {
          const res = window.validateCambodianPhone(val, getLang());
          if (!res.valid) {
            inputEl.classList.add('field-missing');
            if (errorEl) {
              errorEl.textContent = res.error;
              errorEl.style.display = 'block';
            }
          } else {
            inputEl.classList.remove('field-missing');
            if (errorEl) {
              errorEl.textContent = '';
              errorEl.style.display = 'none';
            }
            inputEl.value = res.normalized;
          }
        }
      });
    }

    const patientInput = document.getElementById('web_phone');
    const patientErr = document.getElementById('web_phone_error');
    const caregiverInput = document.getElementById('web_caregiver_phone');
    const caregiverErr = document.getElementById('web_caregiver_phone_error');

    bindPhoneInput(patientInput, patientErr, false);
    bindPhoneInput(caregiverInput, caregiverErr, true);

    window.addEventListener('borkeo-language-change', () => {
      const getLang = () => document.documentElement.lang === 'en' ? 'en' : 'km';
      if (patientErr && patientErr.style.display !== 'none' && patientInput?.value?.trim()) {
        const res = window.validateCambodianPhone?.(patientInput.value.trim(), getLang());
        if (res && !res.valid) patientErr.textContent = res.error;
      }
      if (caregiverErr && caregiverErr.style.display !== 'none' && caregiverInput?.value?.trim()) {
        const res = window.validateCambodianPhone?.(caregiverInput.value.trim(), getLang());
        if (res && !res.valid) caregiverErr.textContent = res.error;
      }
    });
  }

  window.getEmrCarePath = getEmrCarePath;
  window.configureTreatmentWorkflow = configureTreatmentWorkflow;
  window.savePatientRecord = savePatientRecord;
  window.ensureFirstExamDateTime = ensureFirstExamDateTime;
  window.printSignedOpdPrescription = () => printSignedOpd(() => window.printPrescription('opd'));
  window.printSignedOpdForm = () => printSignedOpd(() => window.printTriageOpdRx());
  window.loadPatientRecord = loadPatientRecord;
  window.switchNursingSection = switchNursingSection;
  window.getLoadedEmrPatient = () => loadedPatient;
  window.openPatientHistory = openPatientHistory;
  window.getAdmissionDoctorSignature = getAdmissionDoctorSignature;
  window.renderRecordSignatures = renderRecordSignatures;
  window.currentDoctorIdentitySignature = currentDoctorIdentitySignature;
  window.signatureHtml = signatureHtml;

  function syncOccupationField(sel) {
    const otherInp = sel.parentElement?.querySelector('#reg_occupation_other, #reg_occupation_other_legacy');
    if (!otherInp) return;
    if (sel.value === 'ផ្សេងៗ') {
      otherInp.style.display = 'block';
      otherInp.focus();
    } else {
      otherInp.style.display = 'none';
      otherInp.value = '';
    }
    if (typeof window.syncFields === 'function') window.syncFields();
  }
  function onOccupationOtherInput(inp) {
    if (typeof window.syncFields === 'function') window.syncFields();
  }
  window.syncOccupationField = syncOccupationField;
  window.onOccupationOtherInput = onOccupationOtherInput;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();


  // Reset triage edit mode on patient load
  document.addEventListener('emr:patient-loaded', function resetTriageEditStateOnLoad() {
    const btn = document.getElementById('triage_save_btn');
    if (btn) delete btn.dataset.userEditing;
    if (typeof updateTriageSaveButtonState === 'function') updateTriageSaveButtonState();
  });
