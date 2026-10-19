import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

let application;
let baseUrl;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-auth-test-'));
  application = createEmrServer({ demoMode: false,
    host: '127.0.0.1',
    port: 32197,
    appOrigin: 'http://127.0.0.1:32197',
    databasePath: path.join(temporaryDirectory, 'test.sqlite'),
    loginMaxAttempts: 5,
    loginWindowMinutes: 15,
  });
  const doctorId = crypto.randomUUID();
  application.database.createUser({
    id: doctorId,
    username: 'doctor.test',
    displayName: 'Test Doctor',
    role: 'DOCTOR',
    passwordHash: await hashPassword('A strong test password 2026!'),
    createdAt: Date.now(),
  });
  setUserAccess(application.database, doctorId, ['DOCTOR'], ['medicine', 'tb']);
  await new Promise((resolve, reject) => {
    application.server.once('error', reject);
    application.server.listen(32197, '127.0.0.1', resolve);
  });
  baseUrl = 'http://127.0.0.1:32197';
});

test.after(async () => {
  await new Promise(resolve => application.server.close(resolve));
  application.database.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('unauthenticated protected pages redirect to login', async () => {
  for (const pathname of ['/home', '/emr', '/patient-list', '/departments']) {
    const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
    assert.equal(response.status, 302, pathname);
    assert.equal(response.headers.get('location'), '/login', pathname);
  }
});

test('login rejects an invalid password without disclosing the account', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'doctor.test', password: 'incorrect password' }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'Invalid username or password.');
});

test('authenticated session opens the dashboard and protected clinical pages', async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'doctor.test', password: 'A strong test password 2026!' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';', 1)[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i);

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  let identity = await me.json();
  assert.equal(identity.user.needsContext, true);
  assert.equal(identity.user.activeRole, '');
  assert.deepEqual(identity.user.roles, ['DOCTOR']);
  assert.ok(identity.csrfToken.length >= 40);

  const beforeContextRoot = await fetch(`${baseUrl}/`, {
    headers: { Cookie: cookie }, redirect: 'manual',
  });
  assert.equal(beforeContextRoot.status, 302);
  assert.equal(beforeContextRoot.headers.get('location'), '/context');

  const chooseMedicine = await fetch(`${baseUrl}/api/auth/context`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: baseUrl, 'Content-Type': 'application/json', 'X-CSRF-Token': identity.csrfToken },
    body: JSON.stringify({ role: 'DOCTOR', wardCode: 'medicine' }),
  });
  assert.equal(chooseMedicine.status, 200);
  identity = await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json();
  assert.equal(identity.user.role, 'DOCTOR');
  assert.equal(identity.user.activeWard.code, 'medicine');

  const root = await fetch(`${baseUrl}/`, {
    headers: { Cookie: cookie }, redirect: 'manual',
  });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), '/home');

  const protectedPageMarkers = new Map([
    ['/home', /របាយការណ៍មន្ទីរពេទ្យប្រចាំថ្ងៃ/],
    ['/emr', /Borkeo Referral Hospital EMR/],
    ['/patient-list', /បញ្ជីអ្នកជំងឺ/],
    ['/departments', /ផែនទីផ្នែក និងការចូលសម្រាកពេទ្យ/],
  ]);
  for (const [pathname, marker] of protectedPageMarkers) {
    const page = await fetch(`${baseUrl}${pathname}`, { headers: { Cookie: cookie } });
    assert.equal(page.status, 200, pathname);
    const html = await page.text();
    assert.match(html, marker, pathname);
    assert.match(html, /\/public\/emr-session\.(?:css|js)/, pathname);
    if (pathname === '/home') {
      assert.match(html, /daily-report-panel/);
      assert.match(html, /analytics-panel/);
      assert.doesNotMatch(html, /class="workflow-card"/);
    }
    if (pathname === '/emr') {
      assert.doesNotMatch(html, /<div class="breadcrumb"/);
      assert.match(html, /<option value="anc"[^>]*>ពិនិត្យផ្ទៃពោះ \(ANC\)<\/option>/);
      assert.match(html, /<option value="pnc"/);
      assert.match(html, /<option value="spacing"/);
      assert.match(html, /<option value="safe"/);
      assert.match(html, /<option value="cervix"/);
      assert.match(html, /<option value="std"/);
      assert.match(html, /\/public\/clinical-form-layout\.js/);
      assert.match(html, /\/public\/opd-clinical-storage\.js/);
      assert.match(html, /\/public\/emr-inpatient-workflow\.css\?v=\d+/);
      assert.match(html, /\/public\/emr-inpatient-workflow\.js\?v=\d+/);
      assert.match(html, /\/public\/emr-patient-record\.js\?v=\d+/);
      assert.match(html, /\/public\/paraclinic\.js\?v=\d+/);
      assert.match(html, /\/public\/emr-permissions\.js\?v=\d+/);
      assert.match(html, /bed-direct-view/);
      assert.match(html, /if \(!isDirectBedView\) \{[\s\S]*?switchPage\(1\);[\s\S]*?switchSubTab\('reg'\);/);
      assert.match(html, /if \(isDirectBedView && pageNumber !== 3\) return false;/);
      assert.match(html, /savePatientRecord\(\{ transferToTriage: true, allowMissingDepartment: true \}\)/);
      assert.match(html, /savePatientRecord\(\{ continueTo: 3 \}\)/);
      assert.match(html, /id="opd-payload-abortion"/);
      assert.match(html, /oceanThemeLink = '<link rel="stylesheet" href="\/public\/ocean-theme\.css">'/);
      assert.match(html, /exactly 10 divisions \(0\.1 °C each\)/);
      assert.doesNotMatch(html, /transparent 2\.7px/);
      assert.doesNotMatch(html, /< \/span>/);
      assert.doesNotMatch(html, /id="btn_sub_(?:anc|delivery|partograph)"/);
      assert.doesNotMatch(html, /class="step-text" data-key="tab_rx"/);
      assert.doesNotMatch(html, /class="step-text" data-key="tab_discharge"/);
      assert.match(html, /id="shared_rx_block"[^>]*hidden/);
      assert.match(html, /id="p2_entry_date" readonly/);
      assert.match(html, /id="p2_entry_time" readonly/);
      assert.match(html, /if \(p2EntryDate\) p2EntryDate\.value = dateIn/);
      assert.match(html, /if \(p2EntryTime\) p2EntryTime\.value = timeIn/);
      assert.match(html, /id="daily_monitoring_feed"/);
      assert.match(html, /id="mon_modal" class="modal-overlay"/);
      assert.match(html, /id="mon_input_evol"/);
      assert.match(html, /id="mon_input_conclusion"/);
      assert.match(html, /id="mon_rx_tbody"/);
      assert.match(html, /onclick="saveDailyMonitoring\(\)"/);
      assert.match(html, /function saveDailyMonitoring\(/);
      assert.match(html, /id="sub_nursing" class="sub-tab"/);
      assert.match(html, /id="nursing_process_selector"/);
      assert.match(html, /id="nursing_general" class="nursing-form-pane active"/);
      assert.match(html, /id="nursing_maternity" class="nursing-form-pane"/);
      assert.match(html, /class="nurse-clinical-assessment-pages"/);
      assert.match(html, /class="midwife-assessment-pages"/);
      assert.match(html, /class="nursing-care-pages" data-nursing-care-role="general"/);
      assert.match(html, /class="nursing-care-pages" data-nursing-care-role="maternity"/);
      assert.match(html, /bodyImage\.src = '\/public\/anatomy-position\.png'/);
      assert.match(html, /data-nursing-undo-canvas/);
      assert.doesNotMatch(html, /លេខសម្គាល់/);
    }
    if (pathname === '/patient-list') {
      assert.match(html, /id="entry-filter" type="date"/);
      assert.match(html, /id="discharge-filter" type="date"/);
      assert.doesNotMatch(html, /id="save-/);
      assert.match(html, /លេខបណ្ណសុខភាព/);
      assert.doesNotMatch(html, /លេខសម្គាល់/);
    }
    if (pathname === '/departments') {
      assert.match(html, /id="language-button"/);
      assert.match(html, /id="save-map-button"/);
      assert.match(html, /id="ward-filter"/);
      assert.doesNotMatch(html, /department-build-badge/);
    }
  }

  const publicAssetMarkers = new Map([
    ['/public/emr-session.js', /Switch Role\/Ward/],
    ['/public/emr-permissions.js', /enforceRoleSpecificClinicalUi/],
    ['/public/paraclinic.js', /Paraclinic/],
    ['/public/paraclinic-workspace.css', /same ocean visual language/],
    ['/public/ocean-theme.css', /--ocean-bg/],
    ['/public/home.css', /\.home-shell/],
    ['/public/opd-specialty-theme.js', /opd-ocean-theme/],
    ['/public/clinical-form-layout.js', /midwife-workflow-panel/],
    ['/public/opd-clinical-storage.js', /connectGynecologyFormsToPatientRecords/],
    ['/public/emr-patient-record.js', /configureTreatmentWorkflow/],
    ['/public/emr-inpatient-workflow.js', /inpatient-standalone-view/],
    ['/public/emr-inpatient-workflow.css', /\.inpatient-standalone-view/],
    ['/public/patient-list.js', /data-discharge-date/],
    ['/public/patient-list.css', /\.patient-page-banner/],
    ['/public/departments.js', /data-open-bed-action/],
    ['/public/departments.css', /\.department-page-banner/],
  ]);
  for (const [pathname, marker] of publicAssetMarkers) {
    const asset = await fetch(`${baseUrl}${pathname}`);
    assert.equal(asset.status, 200, pathname);
    assert.equal(asset.headers.get('cache-control'), 'no-store', `${pathname} must not use stale local-development assets`);
    assert.match(await asset.text(), marker, pathname);
  }

  const inpatientWorkflowSource = await (
    await fetch(`${baseUrl}/public/emr-inpatient-workflow.js`)
  ).text();
  assert.doesNotMatch(inpatientWorkflowSource, /patient-record-tabs/);
  assert.doesNotMatch(inpatientWorkflowSource, /activateRecordTab/);
  assert.match(inpatientWorkflowSource, /showOnlyPage\('page3'\)/);
  assert.match(inpatientWorkflowSource, /document\.getElementById\('emr-daily-view'\)/);
  assert.match(inpatientWorkflowSource, /function embedDailyEntryForm\(\)/);
  assert.match(inpatientWorkflowSource, /form\.classList\.remove\('modal-overlay'\)/);
  assert.match(inpatientWorkflowSource, /requestedView === 'medical'\) window\.switchOpdTab\?\.\('ipd'\)/);
  assert.match(inpatientWorkflowSource, /window\.switchOpdTab\?\.\('nursing'\)/);
  assert.match(inpatientWorkflowSource, /nursing: document\.getElementById\('sub_nursing'\), discharge: document\.getElementById\('emr-discharge-view'\)/);
  assert.match(inpatientWorkflowSource, /navigation\.append\(createPatientContext\(\)\)/);
  assert.match(inpatientWorkflowSource, /medical: 'Patient Record'/);
  assert.match(inpatientWorkflowSource, /nursing: 'Nursing Process'/);
  assert.match(inpatientWorkflowSource, /const hasRoutedRoom = Boolean\(requestedRoomCode \|\| routedRoomName\)/);
  assert.match(inpatientWorkflowSource, /hasRoutedRoom[\s\S]*isObstetricWard \? 'obstetric' : 'nurse'/);

  const departmentsSource = await (
    await fetch(`${baseUrl}/public/departments.js`)
  ).text();
  assert.doesNotMatch(departmentsSource, /recordTab/);
  assert.match(departmentsSource, /const action = select\?\.value/);
  assert.match(departmentsSource, /if \(action === 'transfer'\)/);
  assert.match(departmentsSource, /querySelector\('\[data-transfer-panel\]'\)\.hidden = false/);
  assert.match(departmentsSource, /window\.location\.href = actionUrl\(action, item, patient\)/);
  assert.match(departmentsSource, /roomCode === 'obstetric'/);
  assert.match(departmentsSource, /return isObstetricWard \? 'obstetric' : 'nurse'/);
  assert.match(departmentsSource, /parameters\.set\('roomCode', item\.room\.code \|\| ''\)/);

  const inpatientWorkflowCss = await (
    await fetch(`${baseUrl}/public/emr-inpatient-workflow.css`)
  ).text();
  assert.match(inpatientWorkflowCss, /\.daily-followup-entry-form > \.modal-content/);
  assert.match(inpatientWorkflowCss, /max-height: none/);

  const patientRecordSource = await (
    await fetch(`${baseUrl}/public/emr-patient-record.js`)
  ).text();
  assert.match(patientRecordSource, /requestedClinicalView === 'nursing'/);
  assert.match(patientRecordSource, /window\.switchOpdTab\?\.\('nursing'\)/);
  assert.match(patientRecordSource, /\['sub_opd', 'sub_ipd', 'sub_nursing'\]\.forEach/);
  assert.match(patientRecordSource, /nursing\.append\(tabs, care, rights, agreement\)/);
  assert.match(patientRecordSource, /notice\.hidden = Boolean\(requestedClinicalView\)/);

  const sessionSource = await (
    await fetch(`${baseUrl}/public/emr-session.js`)
  ).text();
  assert.match(sessionSource, /href==='\/emr'&&clinicalView/);

  const patientKey = 'case:TEST-0001';
  const emptyRecord = await fetch(
    `${baseUrl}/api/clinical-forms/anc?patientKey=${encodeURIComponent(patientKey)}`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(emptyRecord.status, 200);
  assert.equal((await emptyRecord.json()).record, null);

  const formTypes = ['anc', 'pnc', 'spacing', 'abortion', 'safe', 'cervix'];
  for (const [index, formType] of formTypes.entries()) {
    const save = await fetch(`${baseUrl}/api/clinical-forms/${formType}`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        Origin: baseUrl,
        'Content-Type': 'application/json',
        'X-CSRF-Token': identity.csrfToken,
      },
      body: JSON.stringify({
        patientKey,
        patient: { caseNumber: 'TEST-0001', firstName: 'Test', lastName: 'Patient' },
        data: { [`field:${index}`]: `value-${formType}`, consent: true },
      }),
    });
    assert.equal(save.status, 200, formType);
    const saved = await save.json();
    assert.equal(saved.record.formType, formType);
    assert.equal(saved.record.version, 1);

    const reload = await fetch(
      `${baseUrl}/api/clinical-forms/${formType}?patientKey=${encodeURIComponent(patientKey)}`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(reload.status, 200, formType);
    const reloaded = await reload.json();
    assert.equal(reloaded.record.data[`field:${index}`], `value-${formType}`);
  }

  const updateAnc = await fetch(`${baseUrl}/api/clinical-forms/anc`, {
    method: 'PUT',
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({ patientKey, patient: {}, data: { 'field:0': 'updated' } }),
  });
  assert.equal(updateAnc.status, 200);
  assert.equal((await updateAnc.json()).record.version, 2);

  const patientRecordSave = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT',
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      patientKey,
      summary: {
        caseNumber: 'TEST-0001', healthId: 'H-0001', firstName: 'Sokha', lastName: 'Test',
        fullName: 'Test Sokha', sex: 'ប្រុស', age: '34 ឆ្នាំ', phone: '012345678',
        departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
        departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: '2026-09-13',
        dischargeDate: '2026-09-13',
      },
      data: { 'id:web_adm_no': 'TEST-0001', 'id:web_first_name': 'Sokha' },
    }),
  });
  assert.equal(patientRecordSave.status, 200);
  const savedPatient = (await patientRecordSave.json()).patient;
  assert.equal(savedPatient.fullName, 'Test Sokha');
  assert.equal(savedPatient.departmentCode, 'medicine');
  assert.equal(savedPatient.entryDate, '2026-09-13');
  assert.equal(savedPatient.dischargeDate, '');
  assert.equal(savedPatient.medicalRecordCompleted, false);

  const completedMedicalRecordSave = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT',
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      patientKey,
      summary: {
        caseNumber: 'TEST-0001', healthId: 'H-0001', firstName: 'Sokha', lastName: 'Test',
        fullName: 'Test Sokha', sex: 'ប្រុស', age: '34 ឆ្នាំ', phone: '012345678',
        departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
        departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: '2026-09-13',
      },
      data: {
        'id:web_adm_no': 'TEST-0001', 'id:web_first_name': 'Sokha',
        'system:medicalRecordCompleted': true,
        'system:dailyMonitoringRecords': JSON.stringify([{ dtVal: '2026-09-13T08:00', evol: 'Stable' }]),
      },
    }),
  });
  assert.equal(completedMedicalRecordSave.status, 200);
  assert.equal((await completedMedicalRecordSave.json()).patient.medicalRecordCompleted, true);

  const patientRecordReload = await fetch(
    `${baseUrl}/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(patientRecordReload.status, 200);
  assert.equal((await patientRecordReload.json()).patient.data['id:web_first_name'], 'Sokha');

  const patientList = await fetch(`${baseUrl}/api/patients`, { headers: { Cookie: cookie } });
  assert.equal(patientList.status, 200);
  const listedPatients = (await patientList.json()).patients;
  assert.equal(listedPatients.length, 1);
  assert.equal(listedPatients[0].entryDate, '2026-09-13');
  assert.equal(listedPatients[0].data, undefined);
  assert.equal(listedPatients[0].medicalRecordCompleted, true);

  // Older builds could copy the registration date into discharge_date without
  // a discharge form. It must stay hidden and must not mark the patient discharged.
  application.database.sqlite
    .prepare('UPDATE patient_records SET discharge_date = ? WHERE patient_key = ?')
    .run('2026-09-13', patientKey);
  const legacyDateList = await fetch(`${baseUrl}/api/patients`, { headers: { Cookie: cookie } });
  assert.equal(legacyDateList.status, 200);
  const legacyDatePatient = (await legacyDateList.json()).patients[0];
  assert.equal(legacyDatePatient.dischargeDate, '');
  assert.notEqual(legacyDatePatient.admissionStatus, 'discharged');

  const rejectedWrongWardAssignment = await fetch(`${baseUrl}/api/patient-admission`, {
    method: 'PATCH',
    headers: {
      Cookie: cookie, Origin: baseUrl, 'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      patientKey, action: 'assign', departmentCode: 'tb',
      departmentNameKh: 'ផ្នែកជំងឺរបេង', departmentNameEn: 'Tuberculosis (TB)',
      roomId: 'tb-room', roomNameKh: 'បន្ទប់របេង', roomNameEn: 'TB Ward',
      bedId: 'tb-bed-1', bedLabel: '1', careType: 'nurse',
    }),
  });
  assert.equal(rejectedWrongWardAssignment.status, 400);

  const datesUpdate = await fetch(`${baseUrl}/api/patient-dates`, {
    method: 'PATCH',
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      patientKey, entryDate: '2026-09-12', dischargeDate: '2026-09-14',
    }),
  });
  assert.equal(datesUpdate.status, 200);
  const updatedDates = (await datesUpdate.json()).patient;
  assert.equal(updatedDates.entryDate, '2026-09-12');
  assert.equal(updatedDates.dischargeDate, '');

  const assignAdmission = await fetch(`${baseUrl}/api/patient-admission`, {
    method: 'PATCH',
    headers: {
      Cookie: cookie, Origin: baseUrl, 'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      patientKey, action: 'assign', departmentCode: 'medicine',
      departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine',
      roomId: 'medicine-room', roomNameKh: 'បន្ទប់វេជ្ជសាស្ត្រ', roomNameEn: 'Medical Ward',
      bedId: 'medicine-bed-1', bedLabel: '1', careType: 'nurse',
    }),
  });
  assert.equal(assignAdmission.status, 200);
  const assignedPatient = (await assignAdmission.json()).patient;
  assert.equal(assignedPatient.currentBedLabel, '1');
  assert.equal(assignedPatient.careType, 'nurse');
  assert.equal(assignedPatient.dischargeDate, '');

  const hospitalStateSave = await fetch(`${baseUrl}/api/hospital-state`, {
    method: 'PUT',
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      state: { departments: [{
        id: 'medicine', code: 'medicine', nameKh: 'ជំងឺទូទៅ', nameEn: 'Medicine',
        rooms: [{ id: 'medicine-room', nameKh: 'បន្ទប់', nameEn: 'Ward', beds: [
          { id: 'medicine-bed-1', label: '1', patientKey },
        ] }],
      }] },
    }),
  });
  assert.equal(hospitalStateSave.status, 200);
  assert.equal((await hospitalStateSave.json()).version, 1);

  const transferAdmission = await fetch(`${baseUrl}/api/patient-admission`, {
    method: 'PATCH',
    headers: {
      Cookie: cookie, Origin: baseUrl, 'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      patientKey, action: 'transfer', departmentCode: 'tb',
      departmentNameKh: 'ផ្នែកជំងឺរបេង', departmentNameEn: 'Tuberculosis (TB)',
    }),
  });
  assert.equal(transferAdmission.status, 200);
  const transferredPatient = (await transferAdmission.json()).patient;
  assert.equal(transferredPatient.departmentCode, 'tb');
  assert.equal(transferredPatient.admissionStatus, 'waiting-transfer');
  assert.equal(transferredPatient.currentBedId, '');

  const hospitalStateReload = await fetch(`${baseUrl}/api/hospital-state`, {
    headers: { Cookie: cookie },
  });
  assert.equal(hospitalStateReload.status, 200);
  const reloadedState = await hospitalStateReload.json();
  assert.equal(reloadedState.state.departments[0].nameEn, 'Medicine');
  assert.equal(reloadedState.state.departments[0].rooms[0].beds[0].patientKey, '');

  const chooseTb = await fetch(`${baseUrl}/api/auth/context`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: baseUrl, 'Content-Type': 'application/json', 'X-CSRF-Token': identity.csrfToken },
    body: JSON.stringify({ role: 'DOCTOR', wardCode: 'tb' }),
  });
  assert.equal(chooseTb.status, 200);
  identity = await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json();
  assert.equal(identity.user.activeWard.code, 'tb');

  const tbMapSave = await fetch(`${baseUrl}/api/hospital-state`, {
    method: 'PUT',
    headers: {
      Cookie: cookie, Origin: baseUrl, 'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      state: { departments: [{
        id: 'tb', code: 'tb', nameKh: 'ផ្នែកជំងឺរបេង', nameEn: 'Tuberculosis (TB)',
        rooms: [{ id: 'tb-room', nameKh: 'បន្ទប់របេង', nameEn: 'TB Ward', beds: [
          { id: 'tb-bed-1', label: '1', patientKey },
        ] }],
      }] },
    }),
  });
  assert.equal(tbMapSave.status, 200);

  const dischargeAdmission = await fetch(`${baseUrl}/api/patient-admission`, {
    method: 'PATCH',
    headers: {
      Cookie: cookie, Origin: baseUrl, 'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      patientKey, action: 'discharge', dischargeDate: '2026-09-15',
      dischargeDepartment: 'Tuberculosis (TB)', admissionDiagnosis: 'Pulmonary TB',
      admissionIcd10: 'A15.0', admissionAt: '2026-09-13T08:00',
      dischargeDiagnosis: 'Pulmonary TB\nImproved', dischargeIcd10: 'A15.0',
      dischargeAt: '2026-09-15T09:30', outcome: 'improved', status: 'ordered',
      followUpDate: '2026-09-22', deceased: false,
    }),
  });
  assert.equal(dischargeAdmission.status, 200);
  const dischargedPatient = (await dischargeAdmission.json()).patient;
  assert.equal(dischargedPatient.dischargeDate, '2026-09-15');
  assert.equal(dischargedPatient.admissionStatus, 'discharged');
  assert.equal(dischargedPatient.discharge.dischargeIcd10, 'A15.0');

  const postDischargeClinicalSave = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT',
    headers: {
      Cookie: cookie, Origin: baseUrl, 'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken,
    },
    body: JSON.stringify({
      patientKey,
      summary: {
        caseNumber: 'TEST-0001', healthId: 'H-0001', firstName: 'Sokha', lastName: 'Test',
        fullName: 'Test Sokha', sex: 'ប្រុស', age: '34 ឆ្នាំ', phone: '012345678',
        departmentCode: 'tb', departmentNameKh: 'ផ្នែកជំងឺរបេង',
        departmentNameEn: 'Tuberculosis (TB)', serviceMode: 'ipd', entryDate: '2026-09-12',
        dischargeDate: '',
      },
      data: { 'id:web_adm_no': 'TEST-0001', 'id:web_first_name': 'Sokha' },
    }),
  });
  assert.equal(postDischargeClinicalSave.status, 409);
  const postDischargePatient = (await (await fetch(`${baseUrl}/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`, {headers:{Cookie:cookie}})).json()).patient;
  assert.equal(postDischargePatient.dischargeDate, '2026-09-15');
  assert.equal(postDischargePatient.admissionStatus, 'discharged');
  assert.equal(postDischargePatient.discharge.dischargeAt, '2026-09-15T09:30');

  const mapAfterDischarge = await fetch(`${baseUrl}/api/hospital-state`, {
    headers: { Cookie: cookie },
  });
  assert.equal(mapAfterDischarge.status, 200);
  const dischargedState = await mapAfterDischarge.json();
  assert.equal(dischargedState.state.departments[0].rooms[0].beds[0].patientKey, '');

  const rejectedLogout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST', headers: { Cookie: cookie, Origin: baseUrl },
  });
  assert.equal(rejectedLogout.status, 403);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: baseUrl, 'X-CSRF-Token': identity.csrfToken },
  });
  assert.equal(logout.status, 200);

  const expired = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(expired.status, 401);
});

test('login throttling blocks repeated attempts and records audit events', async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ username: 'unknown.user', password: 'incorrect password' }),
    });
    assert.equal(response.status, 401);
  }
  const blocked = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'unknown.user', password: 'incorrect password' }),
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  const auditCount = application.database.sqlite
    .prepare('SELECT COUNT(*) AS total FROM audit_events')
    .get().total;
  assert.ok(auditCount >= 8);
});
