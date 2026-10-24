import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';
import { openDatabase } from '../server/database.mjs';

const root = projectRoot;

test('v12.0 Patient List exposes eye, edit and delete actions with contact, payment and discharge details', () => {
  const html = fs.readFileSync(path.join(root, 'protected/patient-list.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public/patient-list.js'), 'utf8');
  assert.match(html, /data-column="phone"/);
  assert.match(html, /data-column="dischargeDate"/);
  assert.match(html, /data-column="paymentType"/);
  assert.match(js, /icon-action view/);
  assert.match(js, /icon-action edit/);
  assert.match(js, /icon-action delete/);
  assert.match(js, /clinicalClosed/);
  assert.match(html, /patient-list\.js\?v=\d+/);
  assert.match(js, /includePayment=1/);
});

test('v12.0 Registration captures queue number and OPD/Triage surfaces it', () => {
  const emr = fs.readFileSync(path.join(root, 'protected/EMR.html'), 'utf8');
  const triage = fs.readFileSync(path.join(root, 'protected/triage.html'), 'utf8');
  const triageJs = fs.readFileSync(path.join(root, 'public/triage.js'), 'utf8');
  assert.doesNotMatch(emr, /id="registration_queue_number"/);
  assert.match(emr, /emr-patient-record\.js\?v=\d+/);
  assert.match(fs.readFileSync(path.join(root, 'public/emr-patient-record.js'), 'utf8'), /restorePatientSex/);
  assert.match(fs.readFileSync(path.join(root, 'server/server.mjs'), 'utf8'), /nextRegistrationQueueNumber/);
  assert.match(fs.readFileSync(path.join(root, 'public/emr-session.js'), 'utf8'), /queue-display\?service=TRIAGE/);
  assert.match(triageJs, /callPatient/);
  assert.match(triageJs, /borkeo-counter-number/);
});

test('v19.4 retains the TV display and removes the management dashboard', () => {
  const queueHtml = fs.readFileSync(path.join(root, 'protected/queue-display.html'), 'utf8');
  const homeHtml = fs.readFileSync(path.join(root, 'protected/home.html'), 'utf8');
  const homeJs = fs.readFileSync(path.join(root, 'public/home.js'), 'utf8');
  assert.match(queueHtml, /លេខរៀង/);
  assert.match(queueHtml, /current-counter/);
  assert.match(fs.readFileSync(path.join(root, 'public/emr-session.js'), 'utf8'), /ជ្រើសរើស Counter របស់អ្នក/);
  assert.doesNotMatch(homeHtml, /id="admin-dashboard"/);
  assert.match(homeHtml, /daily-report-panel/);
  assert.doesNotMatch(homeHtml, /Awaiting Admin Approval/);
  assert.doesNotMatch(homeHtml, /Awaiting Director Approval/);
  assert.doesNotMatch(homeJs, /pendingAdmin/);
});

test('v12.0 demo database retains 10 New Case demo patients with sex and queue numbers', () => {
  const db = openDatabase(path.join(root, 'data', 'demo.sqlite'));
  try {
    const rows = db.sqlite.prepare(`SELECT sex, record_json FROM patient_records
      WHERE patient_key LIKE 'case:BK-%' AND json_extract(record_json, '$."system:demoPatient"')='true' ORDER BY created_at`).all();
    assert.ok(rows.length >= 10);
    rows.slice(0, 10).forEach((row, index) => {
      const data = JSON.parse(row.record_json || '{}');
      assert.ok(row.sex);
      assert.equal(data['system:caseType'], 'new');
      assert.equal(Number(data['system:registrationQueueNumber']), index + 1);
    });
  } finally {
    db.close();
  }
});

test('v19.4 keeps cashier-first OPD handoffs and the bilingual support and print updates', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(packageJson.version, /^[0-9]+\.[0-9]+\./);
  const login = fs.readFileSync(path.join(root, 'public/login.html'), 'utf8');
  assert.match(login, /v[0-9]+\.[0-9]+/);
  assert.doesNotMatch(login, /v14\.9/);
  if (fs.existsSync(path.join(root, 'START_DEMO.cmd'))) {
    const launcher = fs.readFileSync(path.join(root, 'START_DEMO.cmd'), 'utf8');
    assert.match(launcher, /else if exist server\\server\.mjs/);
    assert.match(launcher, /package\.json is missing/i);
  }
  const workflowCss = fs.readFileSync(path.join(root, 'public', 'emr-inpatient-workflow.css'), 'utf8');
  assert.match(workflowCss, /patient-summary-tab span\{writing-mode:vertical-rl/);
  assert.match(workflowCss, /\.emr-auto-grow-textarea/);
  const workflowJs = fs.readFileSync(path.join(root, 'public', 'emr-inpatient-workflow.js'), 'utf8');
  assert.match(workflowJs, /function initializeWrappingTextareas\(\)/);
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');
  assert.match(emrHtml, /function prepareMedicationRowsForPrint\(\)/);
  assert.match(emrHtml, /print-empty-medication-row/);
  assert.match(emrHtml, /ward-services\.js\?v=16200/);
  const wardFees = fs.readFileSync(path.join(root, 'public', 'ward-services.js'), 'utf8');
  assert.match(wardFees, /ward-charge-void/);
  assert.match(wardFees, /current IPD invoice|វិក្កយបត្រ IPD បច្ចុប្បន្ន/);
  assert.match(wardFees, /option value="">ជ្រើសរើសសេវា/);
  assert.match(fs.readFileSync(path.join(root, 'server', 'finance.mjs'), 'utf8'), /AMBULANCE_TRANSFER_IN_0_5KM/);
  assert.match(wardFees, /PATIENT_SENT_TO_IMAGING/);
  const serverSource = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.match(serverSource, /startPatientInvoice\(database,patientKey,session\.user_id,savedAt\)/);
  assert.match(workflowCss, /\.patient-summary-tab, \.patient-summary-drawer/);
  const home = fs.readFileSync(path.join(root, 'protected/home.html'), 'utf8');
  const homeJs = fs.readFileSync(path.join(root, 'public/home.js'), 'utf8');
  const sessionJs = fs.readFileSync(path.join(root, 'public/emr-session.js'), 'utf8');
  assert.match(home, /home\.js\?v=1970/);
  assert.match(homeJs, /\/api\/messages\?box=inbox&limit=100/);
  assert.match(homeJs, /Cashier payment completed/);
  assert.match(homeJs, /\/ward-medicines/);
  assert.match(sessionJs, /const opdDoctor = role === 'DOCTOR' && user\.activeWard\?\.code === 'opd'/);
  assert.match(sessionJs, /if \(!opdDoctor && \['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR','NURSE','MIDWIFE'\]/);
  assert.match(sessionJs, /if \(\['NURSE','MIDWIFE'\]\.includes\(role\)\) return/);
  assert.match(sessionJs, /\['\/departments','គ្រប់គ្រងផ្នែក និងគ្រែ'\]/);
  const messageJs = fs.readFileSync(path.join(root, 'public/messages.js'), 'utf8');
  assert.match(messageJs, /function wardAssignmentUrl\(message\)/);
  assert.match(messageJs, /assignBed:'1'/);
  const departmentJs = fs.readFileSync(path.join(root, 'public/departments.js'), 'utf8');
  assert.match(departmentJs, /nursingDocuments: 'ដំណើរការថែទាំ'/);
  assert.match(departmentJs, /nextNursingBedId = item\.bed\.id/);
  const permissionJs = fs.readFileSync(path.join(root, 'public/emr-permissions.js'), 'utf8');
  assert.match(permissionJs, /hide\(document\.querySelector\('\.step-wrapper'\),true\)/);
  assert.match(permissionJs, /window\.switchOpdTab\?\.\('nursing'\)/);
  assert.match(permissionJs, /btn_sub_ipd/);
  const medicineTable = fs.readFileSync(path.join(root, 'public/ward-medicine-table.js'), 'utf8');
  const signerCaptions = ['ប្រធានមន្ទីរពេទ្យ','ឱសថការី','អ្នកប្រគល់','ប្រធានផ្នែក','អ្នកទទួល','នាយសាល'];
  assert.ok(signerCaptions.every((caption,index) => medicineTable.indexOf(caption) >= 0 &&
    (index === 0 || medicineTable.indexOf(caption) > medicineTable.indexOf(signerCaptions[index-1]))));
  const medicineScript = fs.readFileSync(path.join(root, 'public/ward-medicines.js'), 'utf8');
  assert.match(medicineScript, /step===2\?\['CHIEF_WARD','DOCTOR'\]/);
  const labScript = fs.readFileSync(path.join(root, 'public/lab.js'), 'utf8');
  const labCss = fs.readFileSync(path.join(root, 'public/lab.css'), 'utf8');
  assert.match(labScript, /labPrintGroups/);
  assert.match(labScript, /currentPrintGroups\.length>=3/);
  assert.match(labScript, /lab-print-group/);
  assert.doesNotMatch(labScript, /lab-print-hospital/);
  assert.match(labScript, /Differential White Cell Count/);
  assert.match(labCss, /@page\{size:A4 portrait/);
  assert.match(labCss, /break-after:page/);
  assert.match(labCss, /\.lab-print-group\{break-inside:avoid;page-break-inside:avoid/);
  const queueHtml = fs.readFileSync(path.join(root, 'protected/opd-queue.html'), 'utf8');
  const queueJs = fs.readFileSync(path.join(root, 'public/opd-queue.js'), 'utf8');
  assert.doesNotMatch(queueJs, /\/api\/opd\/transfer-to-ipd/);
  assert.doesNotMatch(queueHtml, /ipd-transfer-dialog|data-transfer-ipd/);
  const transferPage = fs.readFileSync(path.join(root, 'protected/ipd-transfer.html'), 'utf8');
  const transferJs = fs.readFileSync(path.join(root, 'public/ipd-transfer.js'), 'utf8');
  assert.match(transferPage, /បញ្ជូនអ្នកជំងឺទៅ IPD/);
  assert.match(transferJs, /\/api\/opd\/transfer-to-ipd/);
  assert.match(transferJs, /\/api\/opd\/ipd-wards/);
  assert.match(home, /daily-report-panel/);
  assert.match(fs.readFileSync(path.join(root, 'protected/organization-branding.html'), 'utf8'), /nameKh/);
  assert.match(fs.readFileSync(path.join(root, 'public/organization-branding-admin.js'), 'utf8'), /X-CSRF-Token/);
  assert.match(fs.readFileSync(path.join(root, 'server/access.mjs'), 'utf8'), /'\/admin\/organization'.+return \['ADMIN','DIRECTOR','VICE_DIRECTOR'\]\.includes\(role\)/);
  assert.match(fs.readFileSync(path.join(root, 'public/report-print.js'), 'utf8'), /api\/organization\/branding/);
  const triage = fs.readFileSync(path.join(root, 'protected/triage.html'), 'utf8');
  assert.doesNotMatch(triage, /ផ្ទាំងបង្ហាញ TV ទ្រីយ៉ា/);
  const workflow = fs.readFileSync(path.join(root, 'public/emr-inpatient-workflow.js'), 'utf8');
  assert.match(workflow, /opd-open-ipd-transfer/);
  assert.match(workflow, /opd-open-provincial-referral/);
  assert.match(workflow, /referralDestinationType: 'PROVINCIAL_HOSPITAL'/);
  const server = fs.readFileSync(path.join(root, 'server/server.mjs'), 'utf8');
  assert.match(server, /notifyOpdDoctorsPaymentCompleted/);
  assert.match(server, /system:opdPreConsultParaclinicAt/);
  assert.match(server, /opdPreConsultInvoiceId/);
  assert.match(server, /system:opdConsultationInvoiceId/);
  const nurseQueue = fs.readFileSync(path.join(root, 'public/opd-paraclinic-nurse.js'), 'utf8');
  assert.match(nurseQueue, /WAITING_NURSE.*?COLLECT/s);
  assert.match(nurseQueue, /SAMPLE_COLLECTED.*?SEND/s);
  assert.match(server, /OPD_PATIENT_TRANSFERRED_TO_IPD/);
});

test('v13.0 demo patients contain complete registration data and real names', () => {
  const db = openDatabase(path.join(root, 'data', 'demo.sqlite'));
  try {
    const rows = db.sqlite.prepare(`SELECT first_name,last_name,sex,age,date_of_birth,phone,record_json
      FROM patient_records
      WHERE patient_key LIKE 'case:BK-%' AND json_extract(record_json, '$."system:demoPatient"')='true'
      ORDER BY case_number`).all();
    assert.ok(rows.length >= 10);
    for (const row of rows) {
      assert.ok(row.first_name.trim());
      assert.ok(row.last_name.trim());
      assert.ok(row.sex.trim());
      assert.ok(row.age.trim());
      assert.ok(row.date_of_birth.trim());
      assert.ok(row.phone.trim());
      assert.doesNotMatch(`${row.first_name} ${row.last_name}`, /^(demo|test|patient)\s*\d*$/i);
      const data = JSON.parse(row.record_json || '{}');
      const requiredKeys = [
        'scope:registration:id:web_adm_no',
        'scope:registration:id:web_health_id',
        'scope:registration:id:web_first_name',
        'scope:registration:id:web_last_name',
        'scope:registration:id:web_dob',
        'scope:registration:id:web_age',
        'scope:registration:id:web_phone',
        'scope:registration:id:web_entry_type',
        'scope:registration:id:web_district',
        'scope:registration:id:web_commune',
        'scope:registration:id:web_village',
        'scope:registration:id:web_nat',
        'scope:registration:auto:7',
        'scope:registration:auto:8',
        'scope:registration:auto:11',
        'scope:registration:auto:27',
        'system:caseType',
      ];
      for (const key of requiredKeys) assert.ok(String(data[key] ?? '').trim(), `Missing ${key}`);
      assert.equal(data['system:caseType'], 'new');
      assert.equal(data['scope:registration:id:emr_pmrs_case_new'], true);
      assert.equal(data['scope:registration:id:emr_pmrs_case_old'], false);
      assert.equal(data['scope:registration:id:web_nssf'], '');
      assert.equal(data['scope:registration:id:web_equity'], '');
    }
    const sexCounts = rows.reduce((counts,row)=>(counts[row.sex]=(counts[row.sex]||0)+1,counts),{});
    assert.ok(sexCounts['ប្រុស'] >= 5);
    assert.ok(sexCounts['ស្រី'] >= 5);
    const cashProfiles = db.sqlite.prepare(`SELECT COUNT(*) AS count FROM patient_finance_profiles p
      JOIN patient_records r ON r.patient_key=p.patient_key
      WHERE r.patient_key LIKE 'case:BK-%' AND json_extract(r.record_json, '$."system:demoPatient"')='true'
        AND p.payment_type='DIRECT' AND p.payment_subtype='FULL'`).get();
    assert.ok(cashProfiles.count >= 10);
  } finally {
    db.close();
  }
});
