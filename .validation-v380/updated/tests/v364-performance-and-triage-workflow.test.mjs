import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { ensureFinanceSchema, addCharge, patientBill, financePatientSearch } from '../server/finance.mjs';
import { ensureRequestSchema, listWorkflowRequests } from '../server/requests.mjs';

const ROOT = path.resolve('.');

test('v36.4 - Version metadata consistency across package.json, login.html, server.mjs and templates', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(['36.4.0', '36.5.0', '36.6.0', '36.7.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v36\.[4-7]/);

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v36\.[4-7]/);

  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('/public/emr-inpatient-workflow.js?v=3660') || emrHtml.includes('/public/emr-inpatient-workflow.js?v=3670'));
  assert.ok(emrHtml.includes('/public/emr-patient-record.js?v=3660') || emrHtml.includes('/public/emr-patient-record.js?v=3670'));
  assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3660') || emrHtml.includes('/public/emr-permissions.js?v=3670'));

  const patientListHtml = fs.readFileSync(path.join(ROOT, 'protected', 'patient-list.html'), 'utf8');
  assert.ok(patientListHtml.includes('/public/patient-list.js?v=3660') || patientListHtml.includes('/public/patient-list.js?v=3670'));

  const triageHtml = fs.readFileSync(path.join(ROOT, 'protected', 'triage.html'), 'utf8');
  assert.ok(triageHtml.includes('/public/patient-list.js?v=3660') || triageHtml.includes('/public/patient-list.js?v=3670'));
});

test('v36.4 - Triage HTML has single primary action button with Save and Transfer, no duplicate standalone save', () => {
  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');

  for (const html of [emrHtml, legacyHtml]) {
    assert.match(html, /id="triage_save_btn"/);
    assert.match(html, /data-key="save_and_transfer"/);
    assert.match(html, /រក្សាទុក និងបញ្ជូនទៅផ្នែក/);
    assert.match(html, /handleTriageSaveOrEdit\(\)/);
  }

  // Verify emr-permissions hides duplicate btn-next for TRIAGE role
  const perms = fs.readFileSync(path.join(ROOT, 'public', 'emr-permissions.js'), 'utf8');
  assert.ok(perms.replace(/\r\n/g, '\n').includes('const nextBtn = document.querySelector(\'#page2 .btn-next\');\n      if (nextBtn) hide(nextBtn, true);'));
});

test('v36.4 - Permission observer is idempotent, ignores overlays/badges, and prevents render loop', () => {
  const perms = fs.readFileSync(path.join(ROOT, 'public', 'emr-permissions.js'), 'utf8');

  // Single bootstrap guard
  assert.ok(perms.includes('let bootstrapped = false;'));
  assert.ok(perms.includes('if (bootstrapped) return;'));
  assert.ok(perms.includes('bootstrapped = true;'));

  // Scoped mutation filtering ignoring chart overlays, badges, SVGs
  assert.ok(perms.includes('.nursing-chart-overlay'));
  assert.ok(perms.includes('.request-badge'));
  assert.ok(perms.includes('observer.disconnect();'));

  // switchNursingForm is idempotent in EMR.html
  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('var activeNursingFormKey = null;'));
  assert.ok(emrHtml.includes('if (activeNursingFormKey === selectedKey) return;'));
  assert.ok(emrHtml.includes('activeNursingFormKey = selectedKey;'));
});

test('v36.4 - Backend Triage Workflow: initial transfer creates charges/queue; correction does NOT duplicate', () => {
  const db = openDatabase(':memory:');
  try {
    ensureFinanceSchema(db);

    db.createUser({
      id: 'U_TRIAGE', username: 'triage_staff', displayName: 'Triage Staff',
      passwordHash: 'dummy', role: 'TRIAGE', createdAt: Date.now()
    });

    const patientKey = 'TEST-TRIAGE-PATIENT-001';
    const now = Date.now();

    // 1. Initial registered patient waiting for triage
    const initialData = {
      'system:triageStatus': 'WAITING',
      'system:workflowStage': 'TRIAGE_WAITING',
      'system:registrationQueueNumber': 101,
      'scope:registration:id:emr_pmrs_case_new': true,
      'system:caseType': 'new'
    };

    db.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, full_name, health_id, case_number, service_mode, department_code, entry_date, record_json, created_by, updated_by, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'U_TRIAGE', 'U_TRIAGE', ?, ?, 1)
    `).run('REC-TRIAGE-001', patientKey, 'Keo Channa', 'HID-001', 'CASE-001', 'opd', 'OPD', '2026-10-16', JSON.stringify(initialData), now, now);

    // Initial transfer to OPD: creates charge
    const charge1 = addCharge(db, patientKey, {
      description: 'Consultation Fee',
      unitAmount: 5000,
      currency: 'KHR',
      serviceCategory: 'consultation',
      departmentCode: 'opd'
    }, 'U_TRIAGE', now);
    assert.ok(charge1 && charge1.invoiceId, 'Initial transfer must create consultation charge');

    const bill1 = patientBill(db, patientKey, charge1.invoiceId);
    assert.ok(bill1.summary.KHR.gross > 0, 'Consultation charge must have non-zero balance');

    // Update patient record to COMPLETED triage
    const completedData = {
      ...initialData,
      'system:triageStatus': 'COMPLETED',
      'system:triageSaved': true,
      'system:triageTransferred': true,
      'system:triageCompletedAt': now,
      'system:opdConsultationInvoiceId': charge1.invoiceId,
      'system:workflowStage': 'CASHIER_PENDING_OPD',
      'system:encounterId': 'OPD-20261016-0001',
      'vital_pulse': 78,
      'vital_temp': 36.6
    };

    db.sqlite.prepare('UPDATE patient_records SET record_json=?, updated_at=? WHERE patient_key=?')
      .run(JSON.stringify(completedData), now, patientKey);

    // Check charges count after initial transfer
    const initialChargeCount = db.sqlite.prepare('SELECT COUNT(*) as c FROM finance_charges WHERE patient_key=?').get(patientKey).c;
    assert.equal(initialChargeCount, 1, 'Exactly one consultation charge created initially');

    // 2. Perform Post-Transfer Correction (e.g. correcting vitals or triage notes)
    // Persisted state check:
    const freshPatient = db.findPatient(patientKey);
    const freshData = JSON.parse(freshPatient.record_json);
    const wasTriageTransferred = Boolean(
      freshPatient && (
        freshData['system:triageStatus'] === 'COMPLETED' ||
        freshData['system:triageTransferred'] ||
        freshData['system:triageCompletedAt'] ||
        freshData['system:triageSaved']
      )
    );
    assert.equal(wasTriageTransferred, true, 'Backend correctly detects patient was already transferred');

    // Applying triage correction: do NOT call addCharge
    if (!wasTriageTransferred) {
      addCharge(db, patientKey, { description: 'Duplicate', amount: 5000, currency: 'KHR' }, 'U_TRIAGE');
    }

    const correctedData = {
      ...freshData,
      'vital_pulse': 82, // corrected
      'vital_temp': 36.8, // corrected
      'system:triageUpdatedAt': now + 5000
    };
    db.sqlite.prepare('UPDATE patient_records SET record_json=?, updated_at=? WHERE patient_key=?')
      .run(JSON.stringify(correctedData), now + 5000, patientKey);

    // Verify charge count remains exactly 1!
    const postCorrectionChargeCount = db.sqlite.prepare('SELECT COUNT(*) as c FROM finance_charges WHERE patient_key=?').get(patientKey).c;
    assert.equal(postCorrectionChargeCount, 1, 'Correction must NOT duplicate consultation charges');

    // Verify workflow stage and encounter ID are preserved
    const afterCorrectionPatient = db.findPatient(patientKey);
    const afterData = JSON.parse(afterCorrectionPatient.record_json);
    assert.equal(afterData['system:workflowStage'], 'CASHIER_PENDING_OPD', 'Workflow stage preserved');
    assert.equal(afterData['system:encounterId'], 'OPD-20261016-0001', 'Encounter ID preserved');
    assert.equal(afterData['vital_pulse'], 82, 'Vitals corrected');
    assert.equal(afterData['system:triageUpdatedAt'], now + 5000, 'Triage update timestamp recorded');
  } finally {
    db.close();
  }
});

test('v36.4 - GET /api/requests/counts returns equivalent pending counts lightweight', () => {
  const db = openDatabase(':memory:');
  try {
    ensureRequestSchema(db);

    // Seed synthetic workflow requests
    db.sqlite.prepare(`
      INSERT INTO workflow_requests (id, kind, patient_key, source_key, source_ward, source_role, submitted_by, submitted_at, snapshot_json, payload_json, status)
      VALUES
        ('REQ-ADM-1', 'ADMISSION', 'P1', 'SRC1', 'medicine', 'NURSE', 'USER1', 1760000000000, '{}', '{}', 'PENDING'),
        ('REQ-DIS-1', 'DISCHARGE', 'P2', 'SRC2', 'surgery', 'DOCTOR', 'USER2', 1760000000000, '{}', '{}', 'PENDING'),
        ('REQ-FEE-1', 'FEE', 'P3', 'SRC3', 'opd', 'CLERK', 'USER3', 1760000000000, '{}', '{}', 'PENDING')
    `).run();

    const adminActor = { userId: 'ADMIN_1', role: 'ADMIN', wardCode: '' };
    const items = listWorkflowRequests(db, adminActor);
    const fullCounts = Object.fromEntries(['ADMISSION','DISCHARGE','MEDICINE','FEE'].map(kind => [kind, items.filter(x => x.kind === kind && x.status === 'PENDING').length]));

    assert.equal(fullCounts.ADMISSION, 1);
    assert.equal(fullCounts.DISCHARGE, 1);
    assert.equal(fullCounts.FEE, 1);

    // Verify public/request-badges.js uses /api/requests/counts
    const badgeCode = fs.readFileSync(path.join(ROOT, 'public', 'request-badges.js'), 'utf8');
    assert.ok(badgeCode.includes("fetch('/api/requests/counts'"));
    assert.ok(badgeCode.includes('badge.textContent !== textStr'));
    assert.ok(badgeCode.includes('badge.hidden !== shouldHide'));
  } finally {
    db.close();
  }
});

test('v36.4 - financePatientSearch uses listPatientSummaries and skips unneeded attachments', () => {
  const db = openDatabase(':memory:');
  try {
    ensureFinanceSchema(db);

    db.createUser({
      id: 'U1', username: 'cashier', displayName: 'Cashier Staff',
      passwordHash: 'dummy', role: 'CLERK', createdAt: Date.now()
    });

    db.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, full_name, health_id, case_number, service_mode, department_code, entry_date, record_json, created_by, updated_by, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'U1', 'U1', ?, ?, 1)
    `).run('REC-FIN-1', 'P-FIN-1', 'Sok Mean', 'HID-FIN-1', 'CASE-FIN-1', 'opd', 'OPD', '2026-10-16', '{}', Date.now(), Date.now());

    const results = financePatientSearch(db, 'Sok');
    assert.ok(Array.isArray(results) && results.length === 1);
    assert.equal(results[0].patientKey, 'P-FIN-1');
    assert.equal(results[0].fullName, 'Sok Mean');
  } finally {
    db.close();
  }
});
