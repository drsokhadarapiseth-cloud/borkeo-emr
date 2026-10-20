'use strict';

(function hospitalMapApplication() {
  const BUILD_VERSION = document.querySelector('meta[name="borkeo-version"]')?.content || '18.3';
  const copy = {
    kh: {
      system: 'ប្រព័ន្ធកំណត់ត្រាវេជ្ជសាស្ត្រអេឡិចត្រូនិក',
      title: 'ផែនទីផ្នែក និងការចូលសម្រាកពេទ្យ', mapHeading: 'គ្រប់គ្រងផ្នែក និងគ្រែ',
      mapHint: 'ជ្រើសរើសផ្នែក ដើម្បីមើលតែគ្រែ និងអ្នកជំងឺរង់ចាំរបស់ផ្នែកនោះ។',
      refresh: 'ទាញឡើងវិញ', addDepartment: '+ បន្ថែមផ្នែក', saveMap: 'រក្សាទុក',
      pending: 'អ្នកជំងឺរង់ចាំចូលសម្រាក', addRoom: '+ បន្ទប់', addBed: '+ គ្រែ',
      editRoom: 'កែបន្ទប់', editBedNumber: 'កែលេខគ្រែ', addRoomPrompt: 'បន្ថែមបន្ទប់',
      free: 'ទំនេរ', occupied: 'មានអ្នកជំងឺ', noRooms: 'មិនទាន់មានបន្ទប់។',
      noPending: 'មិនមានអ្នកជំងឺរង់ចាំសម្រាប់ផ្នែកនេះទេ។', selectBed: 'ជ្រើសរើសគ្រែ',
      assign: 'ដាក់គ្រែ', selectPatient: 'ជ្រើសរើសអ្នកជំងឺ', cancel: 'បោះបង់', save: 'រក្សាទុក',
      wardLabel: 'ផ្នែក', gynecologyLabel: 'រោគស្ត្រី', obstetricLabel: 'សម្ភព',
      bedCountLabel: 'ចំនួនគ្រែ', wardEditRestricted: 'អ្នកអាចកែបានតែផ្នែករបស់អ្នក។',
      dischargeBeforeReduceBed: 'ផ្ទេរ ឬចេញអ្នកជំងឺមុនកាត់បន្ថយគ្រែ។',
      bedNumberPrompt: 'លេខគ្រែ', duplicateBedNumber: 'លេខគ្រែនេះមានរួចហើយ។',
      noBeds: 'មិនមានគ្រែទំនេរក្នុងផ្នែកនេះ',
      loading: 'កំពុងទាញផែនទី និងអ្នកជំងឺ…', dirty: 'មានការផ្លាស់ប្ដូរមិនទាន់រក្សាទុក។',
      saving: 'កំពុងរក្សាទុក…', saved: 'បានរក្សាទុក។',
      loadError: 'មិនអាចទាញផែនទីមន្ទីរពេទ្យបានទេ។', saveError: 'មិនអាចរក្សាទុកបានទេ។',
      actionError: 'មិនអាចកែប្រែការចូលសម្រាករបស់អ្នកជំងឺបានទេ។',
      deptKh: 'ឈ្មោះផ្នែកជាភាសាខ្មែរ', deptEn: 'Department name in English',
      roomKh: 'ឈ្មោះបន្ទប់ជាភាសាខ្មែរ', roomEn: 'Room name in English',
      discard: 'មានការផ្លាស់ប្ដូរមិនទាន់រក្សាទុក។ តើទាញទិន្នន័យឡើងវិញទេ?', unknown: 'មិនបានកំណត់',
      chooseWard: 'ជ្រើសរើសផ្នែក', allWards: 'ផ្នែកទាំងអស់', chooseAction: 'ជ្រើសរើសឯកសារ ឬការងារ',
      medicalRecord: 'កំណត់ត្រាវេជ្ជសាស្ត្រ', dailyFollowup: 'ការតាមដានប្រចាំថ្ងៃ',
      nursingDocuments: 'ដំណើរការថែទាំ', dischargePatient: 'បញ្ចេញអ្នកជំងឺ',
      transferWard: 'បញ្ជូនទៅផ្នែក', open: 'បើក', transferTo: 'ជ្រើសរើសផ្នែកទទួល',
      transfer: 'បញ្ជូន', medicalIncomplete: 'ត្រូវបំពេញ និងរក្សាទុកកំណត់ត្រាវេជ្ជសាស្ត្រជាមុនសិន។',
      transferComplete: 'បានបញ្ជូនអ្នកជំងឺទៅផ្នែកថ្មី។', assignedComplete: 'បានដាក់អ្នកជំងឺលើគ្រែ។',
      tbRule: 'អ្នកជំងឺរបេងអាចដាក់បានតែលើគ្រែក្នុងផ្នែកជំងឺរបេង។',
      transferBedTitle: 'ផ្លាស់ប្តូរបន្ទប់ និងគ្រែអ្នកជំងឺ',
      transferBedHint: 'ប្តូរអ្នកជំងឺទៅបន្ទប់ ឬគ្រែផ្សេងទៀតក្នុងផ្នែកនេះ',
      currentLocation: 'ទីតាំងបច្ចុប្បន្ន',
      targetRoom: 'បន្ទប់គោលដៅ',
      targetBed: 'គ្រែគោលដៅ',
      transferConfirm: 'ប្តូរគ្រែ',
      noFreeBedsInRoom: 'គ្មានគ្រែទំនេរក្នុងបន្ទប់នេះទេ',
      internalTransferSuccess: 'បានប្តូរអ្នកជំងឺទៅបន្ទប់ និងគ្រែថ្មីរួចរាល់។',
    },
    en: {
      system: 'Electronic Medical Record System', title: 'Department & Admissions Map',
      mapHeading: 'Ward & Bed Management', mapHint: 'Choose a ward to see only its beds and waiting patients.',
      refresh: 'Refresh', addDepartment: '+ New Department', saveMap: 'Save', pending: 'Pending Admissions',
      addRoom: '+ Room', addBed: '+ Bed', editRoom: 'Edit room', editBedNumber: 'Edit number',
      addRoomPrompt: 'Add room', free: 'Free', occupied: 'Occupied', noRooms: 'No rooms yet.',
      noPending: 'No patients are waiting for this ward.', selectBed: 'Select a bed', assign: 'Assign',
      selectPatient: 'Select patient', cancel: 'Cancel', save: 'Save', wardLabel: 'Ward',
      gynecologyLabel: 'Gynecology', obstetricLabel: 'Obstetric', bedCountLabel: 'Number of beds',
      wardEditRestricted: 'Only your assigned ward can be edited.',
      dischargeBeforeReduceBed: 'Move or discharge patients before reducing occupied capacity.',
      bedNumberPrompt: 'Bed number', duplicateBedNumber: 'Duplicate bed number.',
      noBeds: 'No free beds in this ward', loading: 'Loading map and patients…',
      dirty: 'There are unsaved changes.', saving: 'Saving…', saved: 'Hospital map saved.',
      loadError: 'Unable to load the hospital map.', saveError: 'Unable to save the hospital map.',
      actionError: 'Unable to update the patient admission.', deptKh: 'Department name in Khmer',
      deptEn: 'Department name in English', roomKh: 'Room name in Khmer', roomEn: 'Room name in English',
      discard: 'There are unsaved changes. Refresh and discard them?', unknown: 'Not specified',
      chooseWard: 'Choose ward', allWards: 'All wards', chooseAction: 'Choose record or action',
      medicalRecord: 'Medical Record', dailyFollowup: 'Daily Follow-up', nursingDocuments: 'Nursing Process',
      dischargePatient: 'Discharge Patient', transferWard: 'Transfer to Ward', open: 'Open',
      transferTo: 'Choose receiving ward', transfer: 'Transfer',
      medicalIncomplete: 'Complete and save the Medical Record before opening Daily Follow-up.',
      transferComplete: 'Patient transferred to the new ward.', assignedComplete: 'Patient assigned to bed.',
      tbRule: 'A TB admission can only be assigned to a bed in the TB ward.',
      transferBedTitle: 'Transfer Patient Room & Bed',
      transferBedHint: 'Move patient to another room or bed in this department',
      currentLocation: 'Current Location',
      targetRoom: 'Target Room',
      targetBed: 'Target Bed',
      transferConfirm: 'Transfer Bed',
      noFreeBedsInRoom: 'No free beds in this room',
      internalTransferSuccess: 'Patient transferred to the new room and bed.',
    },
  };

  const requiredDepartments = [
    { code: 'emergency', nameKh: 'ផ្នែកសង្គ្រោះបន្ទាន់', nameEn: 'Emergency', rooms: [['emergency', 'បន្ទប់សង្គ្រោះ', 'Emergency Room', 'nurse']] },
    { code: 'medicine', nameKh: 'ផ្នែកជំងឺទូទៅ', nameEn: 'Medicine', rooms: [['medical', 'បន្ទប់វេជ្ជសាស្ត្រ', 'Medical Ward', 'nurse']] },
    { code: 'surgery', nameKh: 'ផ្នែកវះកាត់', nameEn: 'Surgery', rooms: [['surgical', 'បន្ទប់វះកាត់', 'Surgical Ward', 'nurse']] },
    { code: 'pediatric', nameKh: 'ផ្នែកជំងឺកុមារ', nameEn: 'Pediatric', rooms: [['pediatric', 'បន្ទប់កុមារ', 'Pediatric Ward', 'nurse']] },
    {
      code: 'gyneco-obstetric', nameKh: 'ផ្នែករោគស្ត្រី និងសម្ភព', nameEn: 'Gynecology–Obstetric',
      rooms: [
        ['gynecology', 'បន្ទប់រោគស្ត្រី', 'Gynecology Ward', 'nurse'],
        ['obstetric', 'បន្ទប់សម្ភព', 'Obstetric Ward', 'obstetric'],
      ],
    },
    { code: 'tb', nameKh: 'ផ្នែកជំងឺរបេង', nameEn: 'Tuberculosis (TB)', rooms: [['tb', 'បន្ទប់ជំងឺរបេង', 'TB Ward', 'nurse']] },
    { code: 'icu', nameKh: 'ផ្នែកសង្គ្រោះបន្ទាន់កម្រិតធ្ងន់', nameEn: 'ICU', rooms: [['icu', 'បន្ទប់ ICU', 'ICU Room', 'nurse']] },
    { code: 'ncu', nameKh: 'ផ្នែកទារកទើបកើត', nameEn: 'NCU', rooms: [['ncu', 'បន្ទប់ NCU', 'NCU Room', 'nurse']] },
  ];

  let language = 'kh';
  const parameters = new URLSearchParams(window.location.search);
  let csrfToken = '';
  let stateVersion = 0;
  let dirty = false;
  let patients = [];
  let departments = [];
  let selectedWard = parameters.get('ward') || '';
  let activeWorkWard = '';
  let activeRole = '';
  const requestedPatientKey = parameters.get('patient') || '';
  const focusAssignment = parameters.get('assignBed') === '1';
  let nextNursingBedId = '';
  let focusedAssignment = false;
  const expandedBeds = new Set();
  document.documentElement.dataset.emrBuild = BUILD_VERSION;

  const element = id => document.getElementById(id);
  const text = key => copy[language][key] || key;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
  const newId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

  function defaultRoom(departmentCode, definition) {
    const [roomCode, nameKh, nameEn, careType] = definition;
    return {
      id: `room-${departmentCode}-${roomCode}`, code: roomCode, nameKh, nameEn, careType,
      beds: Array.from({ length: 4 }, (_, bedIndex) => ({
        id: `bed-${departmentCode}-${roomCode}-${bedIndex + 1}`,
        label: String(bedIndex + 1), patientKey: '',
      })),
    };
  }

  function makeRequiredDepartment(definition) {
    return {
      id: `department-${definition.code}`, code: definition.code,
      nameKh: definition.nameKh, nameEn: definition.nameEn,
      rooms: definition.rooms.map(room => defaultRoom(definition.code, room)),
    };
  }

  function makeDefaultDepartments() {
    return requiredDepartments.map(makeRequiredDepartment);
  }

  function localName(item) {
    return language === 'kh' ? (item.nameKh || item.nameEn) : (item.nameEn || item.nameKh);
  }

  function showStatus(message, state = 'ok') {
    const status = element('map-status');
    status.textContent = message;
    status.dataset.state = state;
  }

  function markDirty() {
    dirty = true;
    showStatus(text('dirty'), 'dirty');
  }

  function roomInWorkWard(department, room) {
    if (!activeWorkWard) return true;
    if (activeWorkWard === 'gynecology' || activeWorkWard === 'obstetric') {
      return department.code === 'gyneco-obstetric' && room.code === activeWorkWard;
    }
    return department.code === activeWorkWard || room.code === activeWorkWard;
  }

  function allBeds() {
    const result = [];
    departments.forEach(department => department.rooms.forEach(room => {
      if (!roomInWorkWard(department, room)) return;
      room.beds.forEach(bed => result.push({ department, room, bed }));
    }));
    return result;
  }

  function assignedPatientKeys() {
    return new Set(allBeds().map(item => item.bed.patientKey).filter(Boolean));
  }

  function activePatient(patient) {
    return patient.serviceMode === 'ipd' && !patient.dischargeDate && patient.admissionStatus !== 'discharged';
  }

  function patientFor(patientKey) {
    return patients.find(item => item.patientKey === patientKey);
  }

  function patientName(patientKey) {
    const patient = patientFor(patientKey);
    return patient?.fullName || patient?.caseNumber || patientKey;
  }

  function paymentShort(status) {
    const code = String(status?.code || 'NOT_PAID');
    if (code === 'PAID') return 'បង់';
    if (code === 'PARTIAL') return 'បង់ខ្លះ';
    if (code === 'NSSF') return 'ប.ស.ស';
    if (code === 'HEF_EQUITY') return 'មូលនិធិ';
    if (code === 'HEF_VULNERABLE') return 'ងាយរងហានិភ័យ';
    if (code === 'EXEMPT') return 'លើកលែង';
    if (code === 'DISCOUNT') return `បញ្ចុះ ${Number(status?.discountPercent || 0)}%`;
    return 'មិនទាន់បង់';
  }

  function patientBedMeta(patient) {
    if (!patient) return '';
    const diagnosis = patient.diagnosisIcd10 || patient.diagnosis || '—';
    const address = patient.address || [patient.village, patient.commune, patient.district, patient.province].filter(Boolean).join(', ') || '—';
    return `<div class="bed-meta-grid">
      <span>${escapeHtml(language === 'kh' ? 'ភេទ' : 'Sex')} <b>${escapeHtml(patient.sex || '—')}</b></span>
      <span>${escapeHtml(language === 'kh' ? 'អាយុ' : 'Age')} <b>${escapeHtml(patient.age || '—')}</b></span>
      <span class="wide">${escapeHtml(language === 'kh' ? 'អាសយដ្ឋាន' : 'Address')} <b>${escapeHtml(address)}</b></span>
      <span class="wide">${escapeHtml(language === 'kh' ? 'រោគវិនិច្ឆ័យ' : 'Diagnosis')} <b>${escapeHtml(diagnosis)}</b></span>
      <span>${escapeHtml(language === 'kh' ? 'ចូល' : 'Entry')} <b>${escapeHtml(patient.entryDate || '—')}</b></span>
      <span>${escapeHtml(language === 'kh' ? 'បង់ប្រាក់' : 'Payment')} <b class="payment-short payment-${escapeHtml(patient.paymentStatus?.code || 'NOT_PAID')}">${escapeHtml(paymentShort(patient.paymentStatus))}</b></span>
    </div>`;
  }

  function patientAvatarHtml(patient, name) {
    const photo = patient?.photo || patient?.data?.['system:patientPhoto'] || patient?.data?.['scope:registration:id:web_patient_photo'] || patient?.data?.['scope:registration:id:patient_photo'] || '';
    if (photo) {
      return `<div class="bed-patient-avatar"><img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" class="bed-patient-avatar-img"></div>`;
    }
    return `<div class="bed-patient-avatar bed-patient-avatar-empty" title="${escapeHtml(language === 'kh' ? 'គ្មានរូបថត' : 'No photo')}"><svg viewBox="0 0 24 24" width="42" height="42" fill="currentColor" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`;
  }


  function filteredDepartments() {
    const visible = selectedWard ? departments.filter(department => department.code === selectedWard) : departments;
    if (!activeWorkWard) return visible;
    return visible.map(department => ({
      ...department,
      rooms: department.rooms.filter(room => roomInWorkWard(department, room)),
    })).filter(department => department.rooms.length || department.code === activeWorkWard);
  }

  function bedOptions(patient) {
    const targetCode = patient.departmentCode;
    return allBeds()
      .filter(item => !item.bed.patientKey && item.department.code === targetCode)
      .map(item => ({
        value: item.bed.id,
        label: `${localName(item.room)} · ${language === 'kh' ? 'គ្រែ' : 'Bed'} ${item.bed.label}`,
      }));
  }

  function patientActionOptions(patient, selectedAction = '') {
    const dailyDisabled = patient.medicalRecordCompleted ? '' : ' disabled';
    const option = (value, label, disabled = '') => `<option value="${value}"${selectedAction === value ? ' selected' : ''}${disabled}>${escapeHtml(label)}</option>`;
    return `${option('', text('chooseAction'))}` +
      option('medical', text('medicalRecord')) +
      option('daily', `${text('dailyFollowup')}${dailyDisabled ? ' — 🔒' : ''}`, dailyDisabled) +
      option('nursing', text('nursingDocuments')) +
      option('discharge', text('dischargePatient')) +
      option('transfer', text('transferWard'));
  }

  function transferWardOptions(currentDepartmentCode) {
    return departments.filter(department => department.code !== currentDepartmentCode)
      .map(department => `<option value="${escapeHtml(department.code)}">${escapeHtml(localName(department))}</option>`)
      .join('');
  }

  function renderMap() {
    element('hospital-map').innerHTML = filteredDepartments().map(department => `
      <article class="department-card" data-department-id="${escapeHtml(department.id)}">
        <header>
          <h3>${escapeHtml(localName(department))}</h3>
          <button type="button" class="button small" data-add-room="${escapeHtml(department.id)}">${escapeHtml(text('addRoom'))}</button>
        </header>
        <div class="room-list">
          ${department.rooms.length ? department.rooms.map(room => `
            <section class="room" data-room-id="${escapeHtml(room.id)}">
              <header><span>${escapeHtml(localName(room))}</span><button type="button" class="button small secondary" data-add-bed="${escapeHtml(room.id)}">${escapeHtml(text('addBed'))}</button><button type="button" class="button small" data-edit-room="${escapeHtml(room.id)}">${escapeHtml(text('editRoom'))}</button></header>
              <div class="bed-grid">
                ${room.beds.map(bed => {
                  const pName = bed.patientKey ? patientName(bed.patientKey) : '';
                  const fontSizeStyle = pName.length > 18 ? 'font-size:9.5px;letter-spacing:-0.4px;' : (pName.length > 13 ? 'font-size:10.5px;letter-spacing:-0.3px;' : (pName.length > 9 ? 'font-size:11.5px;' : ''));
                  return `<div class="bed ${bed.patientKey ? 'occupied' : ''}" data-bed-id="${escapeHtml(bed.id)}">
                    ${bed.patientKey
                      ? `<button type="button" class="bed-summary" data-toggle-bed-details="${escapeHtml(bed.id)}" title="${escapeHtml(pName)}">
                           <span class="bed-picture" aria-hidden="true"><svg viewBox="0 0 64 48"><path d="M6 8h5v22h47v-14h-22v11h-25v-2h20v-12h-17v9h-3v-14zM6 30h52v14h-5v-9h-42v9h-5z"/></svg></span><span class="bed-summary-copy"><strong>${language === 'kh' ? 'គ្រែ' : 'Bed'} ${escapeHtml(bed.label)}</strong><span class="bed-patient" data-patient-value style="${fontSizeStyle}">${escapeHtml(pName)}</span></span>
                         </button>`
                      : `<button type="button" class="bed-summary" data-toggle-bed-details="${escapeHtml(bed.id)}">
                           <span class="bed-picture" aria-hidden="true"><svg viewBox="0 0 64 48"><path d="M6 8h5v22h47v-14h-22v11h-25v-2h20v-12h-17v9h-3v-14zM6 30h52v14h-5v-9h-42v9h-5z"/></svg></span><span class="bed-summary-copy"><strong>${language === 'kh' ? 'គ្រែ' : 'Bed'} ${escapeHtml(bed.label)}</strong><span class="bed-state">${escapeHtml(text('free'))}</span></span>
                         </button>`}
                  </div>`;
                }).join('')}
              </div>
            </section>`).join('') : `<p class="empty-room">${escapeHtml(text('noRooms'))}</p>`}
        </div>
      </article>`).join('');
  }

  function pendingPatients() {
    const assigned = assignedPatientKeys();
    return patients
      .filter(patient => activePatient(patient) && !assigned.has(patient.patientKey))
      .filter(patient => !patient.triageStatus || (patient.triageStatus === 'COMPLETED' && ['WARD_WAITING','CASHIER_PENDING_IPD'].includes(patient.workflowStage)))
      .filter(patient => !selectedWard || patient.departmentCode === selectedWard)
      .sort((left, right) => Number(left.triageCompletedAt || left.registeredAt || left.createdAt) - Number(right.triageCompletedAt || right.registeredAt || right.createdAt));
  }

  function pendingPatientCard(patient) {
    const options = bedOptions(patient);
    const department = departments.find(item => item.code === patient.departmentCode);
    const departmentName = department ? localName(department) : (language === 'kh'
      ? (patient.departmentNameKh || patient.departmentNameEn)
      : (patient.departmentNameEn || patient.departmentNameKh));
    const openHref = `/emr?patient=${encodeURIComponent(patient.patientKey)}${['NURSE','MIDWIFE'].includes(activeRole) ? '&view=nursing' : '&view=medical'}`;
    const openLabel = language === 'kh' ? 'បើកឯកសារ' : 'Open Record';
    return `<article class="pending-card ${focusAssignment && !focusedAssignment && patient.patientKey === requestedPatientKey ? 'assignment-focus' : ''}" data-pending-patient="${escapeHtml(patient.patientKey)}">
      <strong data-patient-value>${escapeHtml(patient.fullName || text('unknown'))}</strong>
      <small>${escapeHtml(patient.caseNumber || patient.healthId || patient.patientKey)} · ${escapeHtml(departmentName || text('unknown'))}</small>
      <div class="pending-mini-meta"><span>${escapeHtml(patient.sex || '—')}</span><span>${escapeHtml(patient.age || '—')}</span><span>${escapeHtml(patient.diagnosisIcd10 || patient.diagnosis || '—')}</span><span class="payment-short payment-${escapeHtml(patient.paymentStatus?.code || 'NOT_PAID')}">${escapeHtml(paymentShort(patient.paymentStatus))}</span></div>
      <div class="assign-row" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <a href="${openHref}" class="button small secondary" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;" title="${escapeHtml(openLabel)}">👁 ${escapeHtml(openLabel)}</a>
        <select aria-label="${escapeHtml(text('selectBed'))}" ${options.length ? '' : 'disabled'} style="flex:1;min-width:120px;">
          <option value="">${escapeHtml(options.length ? text('selectBed') : text('noBeds'))}</option>
          ${options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
        </select>
        <button type="button" class="button small" data-assign-patient="${escapeHtml(patient.patientKey)}" ${options.length ? '' : 'disabled'}>${escapeHtml(text('assign'))}</button>
      </div>
    </article>`;
  }

  function renderPending() {
    const management=['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(activeRole);
    document.querySelector('.admission-sidebar').hidden=management;
    document.querySelector('.map-layout').classList.toggle('management-map',management);
    if(management){element('pending-admissions').replaceChildren();return;}
    const pending = pendingPatients();
    element('pending-count').textContent = String(pending.length);
    const container = element('pending-admissions');
    if (!pending.length) {
      container.innerHTML = `<p class="empty-pending">${escapeHtml(text('noPending'))}</p>`;
      return;
    }
    if (selectedWard) {
      container.innerHTML = pending.map(pendingPatientCard).join('');
      return;
    }
    const groups = new Map();
    pending.forEach(patient => {
      if (!groups.has(patient.departmentCode)) groups.set(patient.departmentCode, []);
      groups.get(patient.departmentCode).push(patient);
    });
    container.innerHTML = [...groups.entries()].map(([code, group]) => {
      const department = departments.find(item => item.code === code);
      return `<section class="pending-group"><h3>${escapeHtml(department ? localName(department) : code)}</h3>${group.map(pendingPatientCard).join('')}</section>`;
    }).join('');
  }

  function renderWardFilter() {
    const select = element('ward-filter');
    const previous = selectedWard;
    if (activeWorkWard) {
      const departmentCode = ['gynecology','obstetric'].includes(activeWorkWard) ? 'gyneco-obstetric' : activeWorkWard;
      const department = departments.find(item => item.code === departmentCode);
      const room = department?.rooms.find(item => item.code === activeWorkWard);
      const label = room ? localName(room) : (department ? localName(department) : activeWorkWard);
      select.innerHTML = `<option value="${escapeHtml(departmentCode)}">${escapeHtml(label)}</option>`;
      select.value = departmentCode;
      select.disabled = true;
      selectedWard = departmentCode;
      return;
    }
    select.disabled = false;
    select.innerHTML = `<option value="">${escapeHtml(text('allWards'))}</option>` + departments
      .map(department => `<option value="${escapeHtml(department.code)}">${escapeHtml(localName(department))}</option>`)
      .join('');
    select.value = departments.some(department => department.code === previous) ? previous : '';
    selectedWard = select.value;
  }

  function renderAll() {
    renderWardFilter();
    renderMap();
    renderPending();
    focusRequestedAssignment();
  }

  function focusRequestedAssignment() {
    if (!focusAssignment || focusedAssignment || !requestedPatientKey) return;
    const card = document.querySelector(`[data-pending-patient="${CSS.escape(requestedPatientKey)}"]`);
    if (!card) return;
    focusedAssignment = true;
    card.classList.add('assignment-focus');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const bedSelect = card.querySelector('select');
    if (bedSelect && !bedSelect.disabled) bedSelect.focus({ preventScroll: true });
  }

  function translatePage() {
    document.documentElement.lang = language === 'kh' ? 'km' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = text(node.dataset.i18n); });
    if (dirty) showStatus(text('dirty'), 'dirty');
    renderAll();
  }

  function normalizeState(value) {
    const source = value && Array.isArray(value.departments) ? value.departments : makeDefaultDepartments();
    const normalized = source.filter(department => department && typeof department === 'object').map(department => ({
      id: String(department.id || newId('department')),
      code: String(department.code || newId('custom')),
      nameKh: String(department.nameKh || ''), nameEn: String(department.nameEn || ''),
      rooms: Array.isArray(department.rooms) ? department.rooms.map(room => ({
        id: String(room.id || newId('room')), code: String(room.code || ''),
        nameKh: String(room.nameKh || ''), nameEn: String(room.nameEn || ''),
        careType: String(room.careType || (/សម្ភព|obstetric|maternity/i.test(`${room.nameKh || ''} ${room.nameEn || ''}`) ? 'obstetric' : 'nurse')),
        beds: Array.isArray(room.beds) ? room.beds.map((bed, index) => ({
          id: String(bed.id || newId('bed')), label: String(bed.label || index + 1), patientKey: String(bed.patientKey || ''),
        })) : [],
      })) : [],
    }));
    requiredDepartments.forEach(definition => {
      const department = normalized.find(item => item.code === definition.code);
      if (!department) {
        normalized.push(makeRequiredDepartment(definition));
        return;
      }
      definition.rooms.forEach(roomDefinition => {
        const [roomCode, , , careType] = roomDefinition;
        if (department.rooms.some(room => room.code === roomCode)) return;
        const legacyRoom = department.rooms.find(room => {
          if (room.code) return false;
          if (definition.rooms.length === 1) return true;
          const name = `${room.nameKh} ${room.nameEn}`;
          if (roomCode === 'gynecology') return /រោគស្ត្រី|gyn/i.test(name);
          if (roomCode === 'obstetric') return /សម្ភព|obstetric|maternity/i.test(name);
          return false;
        });
        if (legacyRoom) {
          legacyRoom.code = roomCode;
          legacyRoom.careType = careType;
        } else {
          department.rooms.push(defaultRoom(definition.code, roomDefinition));
        }
      });
    });
    return normalized;
  }

  function removeStaleAssignments() {
    allBeds().forEach(item => {
      if (!item.bed.patientKey) return;
      const patient = patientFor(item.bed.patientKey);
      if (!patient || !activePatient(patient) || patient.departmentCode !== item.department.code) {
        item.bed.patientKey = '';
      }
    });
  }

  async function loadMap(force = false) {
    if (dirty && !force && !window.confirm(text('discard'))) return;
    showStatus(text('loading'));
    try {
      const [sessionResponse, stateResponse, patientsResponse] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/hospital-state', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/patients?includePayment=1', { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      if (!sessionResponse.ok || !stateResponse.ok || !patientsResponse.ok) throw new Error('សំណើមិនបានជោគជ័យ');
      const sessionData = await sessionResponse.json();
      csrfToken = sessionData.csrfToken;
      activeRole = String(sessionData.user?.activeRole || '').toUpperCase();
      activeWorkWard = ['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(activeRole)?'':String(sessionData.user?.activeWard?.code || '').toLowerCase();
      element('add-department-button').hidden=!['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(activeRole);
      if (activeWorkWard) selectedWard = ['gynecology','obstetric'].includes(activeWorkWard) ? 'gyneco-obstetric' : activeWorkWard;
      else if (['gynecology','obstetric'].includes(selectedWard)) selectedWard = 'gyneco-obstetric';
      const savedState = await stateResponse.json();
      patients = (await patientsResponse.json()).patients || [];
      departments = normalizeState(savedState.state);
      stateVersion = savedState.version || 0;
      dirty = false;
      removeStaleAssignments();
      if (!dirty) showStatus('');
      renderAll();
    } catch (error) {
      console.error(error);
      showStatus(text('loadError'), 'error');
    }
  }

  async function saveMap() {
    showStatus(text('saving'));
    element('save-map-button').disabled = true;
    try {
      const response = await fetch('/api/hospital-state', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ state: { departments }, expectedVersion:stateVersion }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'សំណើមិនបានជោគជ័យ');
      stateVersion = result.version;
      dirty = false;
      showStatus(`${text('saved')} v${stateVersion}`);
      return true;
    } catch (error) {
      console.error(error);
      showStatus(error.message||text('saveError'), 'error');
      return false;
    } finally {
      element('save-map-button').disabled = false;
    }
  }

  async function updateAdmission(patientKey, update) {
    const response = await fetch('/api/patient-admission', {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ patientKey, ...update }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || text('actionError'));
    const index = patients.findIndex(patient => patient.patientKey === patientKey);
    if (index >= 0) patients[index] = result.patient;
    return result.patient;
  }

  function addDepartment() {
    const nameKh = window.prompt(text('deptKh'))?.trim();
    if (!nameKh) return;
    const nameEn = window.prompt(text('deptEn'))?.trim() || nameKh;
    const baseCode = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `custom-${departments.length + 1}`;
    const existing = new Set(departments.map(department => department.code));
    let code = baseCode;
    let suffix = 2;
    while (existing.has(code)) code = `${baseCode}-${suffix++}`;
    departments.push({ id: newId('department'), code, nameKh, nameEn, rooms: [] });
    markDirty();
    renderAll();
  }

  function editRoom(departmentId,roomId='') {
    const department=departments.find(d=>d.id===departmentId);if(!department)return;
    const room=department.rooms.find(r=>r.id===roomId);
    const dialog=document.createElement('dialog');dialog.className='room-editor';
    const zone=room?.code||activeWorkWard||department.code;
    dialog.innerHTML=`<form><h3>${escapeHtml(room ? text('editRoom') : text('addRoomPrompt'))}</h3><label>${escapeHtml(text('roomKh'))}<input name="nameKh" value="${escapeHtml(room?.nameKh||'')}" required maxlength="120"></label><label>${escapeHtml(text('roomEn'))}<input name="nameEn" value="${escapeHtml(room?.nameEn||'')}" maxlength="120"></label>${department.code==='gyneco-obstetric'?`<label>${escapeHtml(text('wardLabel'))}<select name="zone"><option value="gynecology" ${zone==='gynecology'?'selected':''}>${escapeHtml(text('gynecologyLabel'))}</option><option value="obstetric" ${zone==='obstetric'?'selected':''}>${escapeHtml(text('obstetricLabel'))}</option></select></label>`:''}<label>${escapeHtml(text('bedCountLabel'))}<input type="number" name="count" min="0" max="200" required value="${room?.beds.length||0}"></label><p data-error role="alert"></p><div class="toolbar-actions"><button type="button" data-cancel>${escapeHtml(text('cancel'))}</button><button type="submit">${escapeHtml(text('save'))}</button></div></form>`;
    document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
    dialog.querySelector('form').onsubmit=event=>{event.preventDefault();const form=event.target,count=Number(form.elements.count.value),code=form.elements.zone?.value||zone,beds=[...(room?.beds||[])];if(!Number.isInteger(count)||count<0||count>200)return;
      if(activeWorkWard&&code!==activeWorkWard&&department.code==='gyneco-obstetric'){dialog.querySelector('[data-error]').textContent=text('wardEditRestricted');return;}
      if(beds.filter(b=>b.patientKey).length>count){dialog.querySelector('[data-error]').textContent=text('dischargeBeforeReduceBed');return;}
      while(beds.length>count){const index=beds.findLastIndex(b=>!b.patientKey);beds.splice(index,1);}let n=Math.max(0,...beds.map(b=>Number(b.label)||0))+1;while(beds.length<count)beds.push({id:newId('bed'),label:String(n++),patientKey:''});
      const updated={id:room?.id||newId('room'),code,nameKh:form.elements.nameKh.value.trim(),nameEn:form.elements.nameEn.value.trim()||form.elements.nameKh.value.trim(),careType:code==='obstetric'?'obstetric':room?.careType||'nurse',beds};if(room)Object.assign(room,updated);else department.rooms.push(updated);markDirty();renderAll();dialog.close();};
  }
  function openBedTransferDialog(item) {
    const department = item.department;
    const currentRoom = item.room;
    const currentBed = item.bed;
    const patient = patientFor(currentBed.patientKey);
    const pName = patientName(currentBed.patientKey);

    const dialog = document.createElement('dialog');
    dialog.className = 'bed-transfer-dialog';

    const availableRooms = department.rooms.filter(room => roomInWorkWard(department, room));

    function getFreeBedsForRoom(roomId) {
      const room = department.rooms.find(r => r.id === roomId);
      if (!room) return [];
      return room.beds.filter(b => !b.patientKey && b.id !== currentBed.id);
    }

    const currentRoomName = localName(currentRoom);
    const deptName = localName(department);

    dialog.innerHTML = `
      <form class="bed-transfer-form">
        <header class="bed-transfer-header">
          <div class="bed-transfer-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M19 7h-8v6h8V7zm2-2H9c-1.1 0-2 .9-2 2v8H4V9H2v11h2v-3h16v3h2v-9c0-1.1-.9-2-2-2zM4 14V9h3v5H4z"/>
            </svg>
          </div>
          <div>
            <h3 style="margin:0 0 4px;font-size:18px;color:#075f81;">${escapeHtml(text('transferBedTitle'))}</h3>
            <p style="margin:0;font-size:12px;color:#557988;">${escapeHtml(text('transferBedHint'))} · <strong>${escapeHtml(deptName)}</strong></p>
          </div>
        </header>

        <section class="bed-transfer-patient-card has-patient-avatar">
          ${patientAvatarHtml(patient, pName)}
          <div class="bed-transfer-patient-details">
            <div class="bed-transfer-meta-row">
              <div class="meta-item">
                <span class="meta-label">${escapeHtml(language === 'kh' ? 'អ្នកជំងឺ' : 'Patient')}</span>
                <strong class="meta-value patient-highlight">${escapeHtml(pName)}</strong>
              </div>
              <div class="meta-item">
                <span class="meta-label">${escapeHtml(language === 'kh' ? 'ភេទ / អាយុ' : 'Sex / Age')}</span>
                <span class="meta-value">${escapeHtml(patient?.sex || '—')} / ${escapeHtml(patient?.age || '—')}</span>
              </div>
            </div>
            <div class="bed-transfer-meta-row">
              <div class="meta-item">
                <span class="meta-label">${escapeHtml(text('currentLocation'))}</span>
                <span class="meta-value current-loc">${escapeHtml(currentRoomName)} — ${language === 'kh' ? 'គ្រែ' : 'Bed'} <b>${escapeHtml(currentBed.label)}</b></span>
              </div>
              <div class="meta-item">
                <span class="meta-label">${escapeHtml(language === 'kh' ? 'រោគវិនិច្ឆ័យ' : 'Diagnosis')}</span>
                <span class="meta-value">${escapeHtml(patient?.diagnosisIcd10 || patient?.diagnosis || '—')}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="bed-transfer-selection-card">
          <div class="form-group">
            <label for="transfer-target-room">
              <span class="label-title">${escapeHtml(text('targetRoom'))}</span>
            </label>
            <select id="transfer-target-room" name="targetRoomId" class="dialog-select" required>
              ${availableRooms.map(r => `<option value="${escapeHtml(r.id)}" ${r.id === currentRoom.id ? 'selected' : ''}>${escapeHtml(localName(r))}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="transfer-target-bed">
              <span class="label-title">${escapeHtml(text('targetBed'))}</span>
            </label>
            <select id="transfer-target-bed" name="targetBedId" class="dialog-select" required></select>
            <div id="transfer-bed-note" class="transfer-note" role="status"></div>
          </div>
        </section>

        <div class="dialog-actions">
          <button type="button" class="button secondary" data-cancel>${escapeHtml(text('cancel'))}</button>
          <button type="submit" class="button success" id="transfer-submit-btn">${escapeHtml(text('transferConfirm'))}</button>
        </div>
      </form>
    `;

    document.body.append(dialog);
    dialog.showModal();

    const roomSelect = dialog.querySelector('#transfer-target-room');
    const bedSelect = dialog.querySelector('#transfer-target-bed');
    const noteEl = dialog.querySelector('#transfer-bed-note');
    const submitBtn = dialog.querySelector('#transfer-submit-btn');

    function updateBeds() {
      const selectedRoomId = roomSelect.value;
      const freeBeds = getFreeBedsForRoom(selectedRoomId);
      bedSelect.innerHTML = '';
      if (freeBeds.length === 0) {
        bedSelect.innerHTML = `<option value="" disabled selected>${escapeHtml(text('noFreeBedsInRoom'))}</option>`;
        bedSelect.disabled = true;
        submitBtn.disabled = true;
        noteEl.textContent = text('noFreeBedsInRoom');
        noteEl.dataset.state = 'warning';
      } else {
        bedSelect.disabled = false;
        submitBtn.disabled = false;
        noteEl.textContent = '';
        noteEl.dataset.state = '';
        freeBeds.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = `${language === 'kh' ? 'គ្រែ' : 'Bed'} ${b.label}`;
          bedSelect.appendChild(opt);
        });
      }
    }

    roomSelect.addEventListener('change', updateBeds);
    updateBeds();

    dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    dialog.onclose = () => dialog.remove();

    dialog.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const targetRoomId = roomSelect.value;
      const targetBedId = bedSelect.value;
      if (!targetBedId) return;

      const targetRoom = department.rooms.find(r => r.id === targetRoomId);
      const targetBed = targetRoom?.beds.find(b => b.id === targetBedId);

      if (!targetBed || targetBed.patientKey) {
        alert(text('duplicateBedNumber') || 'Bed is not available');
        return;
      }

      submitBtn.disabled = true;

      // Transfer patient internally
      targetBed.patientKey = currentBed.patientKey;
      currentBed.patientKey = '';

      markDirty();
      renderAll();
      dialog.close();

      await saveMap();
      showStatus(language === 'kh'
        ? `បានប្តូរអ្នកជំងឺទៅបន្ទប់ ${localName(targetRoom)} គ្រែ ${targetBed.label} រួចរាល់។`
        : `Transferred patient to ${localName(targetRoom)} Bed ${targetBed.label}.`);
    };
  }

  function editBedNumber(bedId) {
    const item = allBeds().find(i => i.bed.id === bedId);
    if (!item) return;
    if (item.bed.patientKey) {
      openBedTransferDialog(item);
      return;
    }
    const label = window.prompt(text('bedNumberPrompt'), item.bed.label)?.trim();
    if (!label) return;
    if (item.room.beds.some(b => b.id !== bedId && b.label === label)) {
      window.alert(text('duplicateBedNumber'));
      return;
    }
    item.bed.label = label.slice(0, 30);
    markDirty();
    renderAll();
  }

  function addBed(roomId) {
    const room = departments.flatMap(department => department.rooms).find(item => item.id === roomId);
    if (!room) return;
    let number=Math.max(0,...room.beds.map(b=>Number(b.label)||0))+1;while(room.beds.some(b=>b.label===String(number)))number++;room.beds.push({ id: newId('bed'), label: String(number), patientKey: '' });
    markDirty();
    renderAll();
  }

  function bedCareRoute(item) {
    // FINAL RULE: only the Obstetric ward uses the Midwife nursing process.
    // Every other ward -- including Gynecology, Emergency, ICU, Medicine,
    // Pediatric, Surgery, TB, NCU, and future/custom wards -- uses Nurse.
    const roomCode = String(item?.room?.code || '').trim().toLowerCase();
    const roomName = `${item?.room?.nameKh || ''} ${item?.room?.nameEn || ''}`.trim();
    const isObstetricWard = roomCode === 'obstetric' || /បន្ទប់សម្ភព|obstetric ward|maternity ward/i.test(roomName);
    return isObstetricWard ? 'obstetric' : 'nurse';
  }

  function actionUrl(view, item, patient) {
    const parameters = new URLSearchParams({ patient: patient.patientKey, view });
    parameters.set('department', item.department.code);
    parameters.set('wardNameKh', item.department.nameKh || '');
    parameters.set('wardNameEn', item.department.nameEn || '');
    parameters.set('room', item.room.id);
    parameters.set('roomCode', item.room.code || '');
    parameters.set('roomNameKh', item.room.nameKh || '');
    parameters.set('roomNameEn', item.room.nameEn || '');
    parameters.set('bed', item.bed.id);
    parameters.set('bedLabel', item.bed.label || '');
    parameters.set('care', bedCareRoute(item));
    if (['nursing', 'medical', 'daily'].includes(view)) {
      parameters.set('edit', '1');
    }
    return `/emr?${parameters.toString()}`;
  }

  function openBedModal(bedId) {
    const item = allBeds().find(i => i.bed.id === bedId);
    if (!item) return;
    const department = item.department;
    const room = item.room;
    const bed = item.bed;
    const patient = bed.patientKey ? patientFor(bed.patientKey) : null;
    const pName = bed.patientKey ? patientName(bed.patientKey) : '';

    const dialog = document.createElement('dialog');
    dialog.className = 'bed-transfer-dialog bed-modal-window';

    const currentRoomName = localName(room);
    const deptName = localName(department);

    if (bed.patientKey && patient) {
      const diagnosis = patient.diagnosisIcd10 || patient.diagnosis || '—';
      const address = patient.address || [patient.village, patient.commune, patient.district, patient.province].filter(Boolean).join(', ') || '—';
      dialog.innerHTML = `
        <div class="bed-transfer-form">
          <header class="bed-transfer-header">
            <div class="bed-transfer-header-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M19 7h-8v6h8V7zm2-2H9c-1.1 0-2 .9-2 2v8H4V9H2v11h2v-3h16v3h2v-9c0-1.1-.9-2-2-2zM4 14V9h3v5H4z"/>
              </svg>
            </div>
            <div>
              <h3 style="margin:0 0 4px;font-size:18px;color:#075f81;">${escapeHtml(deptName)} · ${escapeHtml(currentRoomName)} — ${language === 'kh' ? 'គ្រែ' : 'Bed'} ${escapeHtml(bed.label)}</h3>
              <p style="margin:0;font-size:12px;color:#557988;"><span class="bed-state" style="color:#a32920;font-weight:900;">${escapeHtml(text('occupied'))}</span></p>
            </div>
          </header>

          <section class="bed-transfer-patient-card has-patient-avatar">
            ${patientAvatarHtml(patient, pName)}
            <div class="bed-transfer-patient-details">
              <div class="bed-transfer-meta-row">
                <div class="meta-item">
                  <span class="meta-label">${escapeHtml(language === 'kh' ? 'អ្នកជំងឺ' : 'Patient')}</span>
                  <strong class="meta-value patient-highlight">${escapeHtml(pName)}</strong>
                </div>
                <div class="meta-item">
                  <span class="meta-label">${escapeHtml(language === 'kh' ? 'ភេទ / អាយុ' : 'Sex / Age')}</span>
                  <span class="meta-value">${escapeHtml(patient.sex || '—')} / ${escapeHtml(patient.age || '—')}</span>
                </div>
              </div>
              <div class="bed-transfer-meta-row">
                <div class="meta-item">
                  <span class="meta-label">${escapeHtml(language === 'kh' ? 'អាសយដ្ឋាន' : 'Address')}</span>
                  <span class="meta-value">${escapeHtml(address)}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">${escapeHtml(language === 'kh' ? 'រោគវិនិច្ឆ័យ' : 'Diagnosis')}</span>
                  <span class="meta-value">${escapeHtml(diagnosis)}</span>
                </div>
              </div>
              <div class="bed-transfer-meta-row">
                <div class="meta-item">
                  <span class="meta-label">${escapeHtml(language === 'kh' ? 'ចូលសម្រាក' : 'Entry Date')}</span>
                  <span class="meta-value">${escapeHtml(patient.entryDate || '—')}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">${escapeHtml(language === 'kh' ? 'ស្ថានភាពបង់ប្រាក់' : 'Payment Status')}</span>
                  <span class="meta-value"><b class="payment-short payment-${escapeHtml(patient.paymentStatus?.code || 'NOT_PAID')}">${escapeHtml(paymentShort(patient.paymentStatus))}</b></span>
                </div>
              </div>
            </div>
          </section>

          <section class="bed-transfer-selection-card">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <span class="label-title">${escapeHtml(language === 'kh' ? 'គ្រប់គ្រងគ្រែ និងការងារអ្នកជំងឺ' : 'Bed & Patient Actions')}</span>
              <button type="button" class="button small secondary" data-modal-edit-bed="${escapeHtml(bed.id)}">${escapeHtml(text('editBedNumber'))}</button>
            </div>

            <div class="bed-actions" style="margin-top:8px;" ${['WARD_HEAD','CHIEF_WARD'].includes(activeRole)?'hidden':''}>
              <div class="patient-action-row" style="display:grid;grid-template-columns:1fr auto;gap:8px;">
                <select data-bed-action class="dialog-select" style="min-height:38px;font-size:13px;" aria-label="${escapeHtml(text('chooseAction'))}">${patientActionOptions(patient, bed.id === nextNursingBedId ? 'nursing' : '')}</select>
                <button type="button" class="button small" data-open-bed-action="${escapeHtml(bed.id)}">${escapeHtml(text('open'))}</button>
              </div>
              <div class="transfer-row" data-transfer-panel hidden style="margin-top:8px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                <select data-transfer-ward class="dialog-select" style="min-height:38px;font-size:13px;" aria-label="${escapeHtml(text('transferTo'))}">
                  <option value="">${escapeHtml(text('transferTo'))}</option>
                  ${transferWardOptions(department.code)}
                </select>
                <button type="button" class="button small" data-transfer-patient="${escapeHtml(bed.id)}">${escapeHtml(text('transfer'))}</button>
              </div>
            </div>
          </section>

          <div class="dialog-actions">
            <button type="button" class="button secondary" data-close-modal>${escapeHtml(text('cancel'))}</button>
          </div>
        </div>
      `;
    } else {
      dialog.innerHTML = `
        <div class="bed-transfer-form">
          <header class="bed-transfer-header">
            <div class="bed-transfer-header-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M19 7h-8v6h8V7zm2-2H9c-1.1 0-2 .9-2 2v8H4V9H2v11h2v-3h16v3h2v-9c0-1.1-.9-2-2-2zM4 14V9h3v5H4z"/>
              </svg>
            </div>
            <div>
              <h3 style="margin:0 0 4px;font-size:18px;color:#075f81;">${escapeHtml(deptName)} · ${escapeHtml(currentRoomName)} — ${language === 'kh' ? 'គ្រែ' : 'Bed'} ${escapeHtml(bed.label)}</h3>
              <p style="margin:0;font-size:12px;color:#557988;"><span class="bed-state" style="color:#087fa8;font-weight:900;">${escapeHtml(text('free'))}</span></p>
            </div>
          </header>

          <section class="bed-transfer-selection-card">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <span class="label-title">${escapeHtml(text('bedNumberPrompt'))}</span>
              <button type="button" class="button small secondary" data-modal-edit-bed="${escapeHtml(bed.id)}">${escapeHtml(text('editBedNumber'))}</button>
            </div>

            ${!['ADMIN','DIRECTOR','VICE_DIRECTOR','WARD_HEAD','CHIEF_WARD'].includes(activeRole) ? `
              <div style="margin-top:12px;" class="bed-details">
                <label class="label-title" style="display:block;margin-bottom:6px;">${escapeHtml(text('selectPatient'))}</label>
                <div class="assign-row" style="display:grid;grid-template-columns:1fr auto;gap:8px;">
                  <select data-free-patient class="dialog-select" style="min-height:38px;font-size:13px;">
                    <option value="">${escapeHtml(text('selectPatient'))}</option>
                    ${pendingPatients().filter(p=>p.departmentCode===department.code).map(p=>`<option value="${escapeHtml(p.patientKey)}">${escapeHtml(p.fullName)}</option>`).join('')}
                  </select>
                  <button class="button success small" type="button" data-assign-free="${escapeHtml(bed.id)}">${escapeHtml(text('assign'))}</button>
                </div>
              </div>` : ''}
          </section>

          <div class="dialog-actions">
            <button type="button" class="button secondary" data-close-modal>${escapeHtml(text('cancel'))}</button>
          </div>
        </div>
      `;
    }

    document.body.append(dialog);
    dialog.showModal();

    dialog.querySelectorAll('[data-close-modal]').forEach(b => b.onclick = () => dialog.close());
    const modalEditBedBtn = dialog.querySelector('[data-modal-edit-bed]');
    if (modalEditBedBtn) {
      modalEditBedBtn.onclick = () => {
        dialog.close();
        editBedNumber(bed.id);
      };
    }
    dialog.onclose = () => dialog.remove();
  }

  function openBedAction(button) {
    const item = allBeds().find(candidate => candidate.bed.id === button.dataset.openBedAction);
    if (!item?.bed.patientKey) return;
    const patient = patientFor(item.bed.patientKey);
    const select = button.closest('.bed-actions, .bed-transfer-selection-card')?.querySelector('[data-bed-action]');
    const action = select?.value;
    if (!patient || !action) return;
    if (action === 'transfer') {
      button.closest('.bed-actions, .bed-transfer-selection-card').querySelector('[data-transfer-panel]').hidden = false;
      return;
    }
    if (action === 'daily' && !patient.medicalRecordCompleted) {
      window.alert(text('medicalIncomplete'));
      return;
    }
    window.location.href = actionUrl(action, item, patient);
  }

  async function assignPatient(button) {
    const card = button.closest('[data-pending-patient]');
    const bedId = button.dataset.assignFree||card?.querySelector('select')?.value;
    const item = allBeds().find(candidate => candidate.bed.id === bedId);
    const patientKey = button.dataset.assignPatient||button.closest('.bed-details, .bed-transfer-selection-card')?.querySelector('[data-free-patient]')?.value;
    const patient = patientFor(patientKey);
    if (!item || item.bed.patientKey || !patient) return;
    if (patient.departmentCode === 'tb' && item.department.code !== 'tb') {
      window.alert(text('tbRule'));
      return;
    }
    button.disabled = true;
    try {
      if (dirty) await saveMap().catch(() => false);
      await updateAdmission(patientKey, {
        action: 'assign', departmentCode: item.department.code,
        departmentNameKh: item.department.nameKh, departmentNameEn: item.department.nameEn,
        roomCode: ['gynecology','obstetric'].includes(item.room.code) ? item.room.code : item.department.code, roomId: item.room.id, roomNameKh: item.room.nameKh, roomNameEn: item.room.nameEn,
        bedId: item.bed.id, bedLabel: item.bed.label, careType: item.room.careType || 'nurse',
      });
      expandedBeds.add(item.bed.id);
      nextNursingBedId = item.bed.id;
      document.querySelectorAll('.bed-modal-window').forEach(d => d.close());
      await loadMap(true);
      showStatus(text('assignedComplete'));
      renderAll();
    } catch (error) {
      console.error(error);
      showStatus(`${text('actionError')} ${error.message}`, 'error');
      button.disabled = false;
    }
  }

  async function transferPatient(button) {
    const item = allBeds().find(candidate => candidate.bed.id === button.dataset.transferPatient);
    if (!item?.bed.patientKey) return;
    const panel = button.closest('[data-transfer-panel]');
    const targetCode = panel?.querySelector('[data-transfer-ward]')?.value;
    const target = departments.find(department => department.code === targetCode);
    if (!target) return;
    const patientKey = item.bed.patientKey;
    button.disabled = true;
    try {
      await updateAdmission(patientKey, {
        action: 'transfer', departmentCode: target.code,
        departmentNameKh: target.nameKh, departmentNameEn: target.nameEn,
      });
      item.bed.patientKey = '';
      markDirty();
      const latest=await fetch('/api/hospital-state',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());stateVersion=latest.version;departments=normalizeState(latest.state);dirty=false;
      selectedWard = target.code;
      showStatus(text('transferComplete'));
      document.querySelectorAll('.bed-modal-window').forEach(d => d.close());
      renderAll();
    } catch (error) {
      console.error(error);
      showStatus(`${text('actionError')} ${error.message}`, 'error');
      button.disabled = false;
    }
  }

  element('ward-filter').addEventListener('change', event => {
    if (activeWorkWard) return;
    selectedWard = event.target.value;
    renderMap();
    renderPending();
  });
  element('refresh-button').addEventListener('click', () => void loadMap());
  element('add-department-button').addEventListener('click', addDepartment);
  element('save-map-button').addEventListener('click', () => void saveMap());
  document.addEventListener('click', event => {
    const roomButton = event.target.closest('[data-add-room]');
    const bedButton = event.target.closest('[data-add-bed]');
    const toggleBedButton = event.target.closest('[data-toggle-bed-details]');
    const actionButton = event.target.closest('[data-open-bed-action]');
    const assignButton = event.target.closest('[data-assign-patient]');
    const transferButton = event.target.closest('[data-transfer-patient]');
    const editRoomButton=event.target.closest('[data-edit-room]'),editBedButton=event.target.closest('[data-edit-bed]'),freeAssignButton=event.target.closest('[data-assign-free]');
    if(editRoomButton){const d=departments.find(d=>d.rooms.some(r=>r.id===editRoomButton.dataset.editRoom));editRoom(d.id,editRoomButton.dataset.editRoom);}
    else if(editBedButton)editBedNumber(editBedButton.dataset.editBed);
    else if(freeAssignButton)void assignPatient(freeAssignButton);
    else if (roomButton) addRoom(roomButton.dataset.addRoom);
    else if (bedButton) addBed(bedButton.dataset.addBed);
    else if (toggleBedButton) {
      const bedId = toggleBedButton.dataset.toggleBedDetails;
      openBedModal(bedId);
    }
    else if (actionButton) openBedAction(actionButton);
    else if (assignButton) void assignPatient(assignButton);
    else if (transferButton) void transferPatient(transferButton);
  });
  window.addEventListener('beforeunload', event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  translatePage();
  window.addEventListener('borkeo-language-change', event => {
    language = event.detail?.language === 'en' ? 'en' : 'kh';
    translatePage();
  });
  void loadMap(true);
})();
