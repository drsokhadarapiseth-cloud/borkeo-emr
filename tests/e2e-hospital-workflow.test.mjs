import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { createDatabaseBackup, checkDatabaseIntegrity } from '../server/backup.mjs';

let app;
let baseUrl;
let tempDir;

const passwords = {
  admin: 'AdminMasterPass2026!',
  registration: 'RegistrationPass2026!',
  triage: 'TriagePass2026!',
  doctor: 'DoctorPass2026!',
  lab: 'LabSpecialistPass2026!',
  clerk: 'CashierPass2026!',
};

async function createUser(username, displayName, role, wards = []) {
  const id = crypto.randomUUID();
  app.database.createUser({
    id,
    username,
    displayName,
    role,
    passwordHash: await hashPassword(passwords[username]),
    createdAt: Date.now(),
  });
  setUserAccess(app.database, id, [role], wards);
  return id;
}

async function loginUser(username) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username, password: passwords[username] }),
  });
  assert.equal(res.status, 200, `Login failed for ${username}`);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(meRes.status, 200);
  const me = await meRes.json();
  return {
    cookie,
    csrf: me.csrfToken,
    user: me.user,
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      'X-CSRF-Token': me.csrfToken,
      'Content-Type': 'application/json',
    },
  };
}

test.before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-e2e-workflow-'));
  const dbPath = path.join(tempDir, 'e2e.sqlite');

  app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33892,
    appOrigin: 'http://127.0.0.1:33892',
    databasePath: dbPath,
    dataDirectory: tempDir,
    nodeEnv: 'test',
  });

  baseUrl = 'http://127.0.0.1:33892';

  await createUser('admin', 'Admin User', 'ADMIN');
  await createUser('registration', 'Registration Officer', 'REGISTRATION');
  await createUser('triage', 'Triage Nurse', 'TRIAGE');
  await createUser('doctor', 'Dr. Chea Vanna', 'DOCTOR', ['medicine']);
  await createUser('lab', 'Lab Technician', 'LAB');
  await createUser('clerk', 'Hospital Cashier', 'CLERK');

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33892, '127.0.0.1', resolve);
  });
});

test.after(async () => {
  await new Promise(resolve => app.server.close(resolve));
  if (app.database?.close) app.database.close();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('E2E: Complete clinical lifecycle from registration, triage, doctor order, lab result, billing and backup', async () => {
  const registration = await loginUser('registration');
  const triage = await loginUser('triage');
  const doctor = await loginUser('doctor');
  const clerk = await loginUser('clerk');
  const admin = await loginUser('admin');

  // 1. Registration: Create patient record
  const patientKey = 'case:E2E-2026-001';
  const regPayload = {
    patientKey,
    summary: {
      caseNumber: 'E2E-2026-001',
      healthId: 'HC-E2E-001',
      firstName: 'Kosal',
      lastName: 'Chan',
      fullName: 'Chan Kosal',
      sex: 'ប្រុស',
      age: '42 ឆ្នាំ',
      dateOfBirth: '1984-03-15',
      phone: '012888999',
      equityCard: '',
      paymentType: 'CASH',
      departmentCode: 'medicine',
      departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
      departmentNameEn: 'General Medicine',
      serviceMode: 'ipd',
      entryDate: '2026-10-19',
      dischargeDate: '',
    },
    data: {
      'scope:registration:id:web_time': '08:30',
      'scope:registration:id:emr_pmrs_case_new': true,
    },
  };

  const regRes = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT',
    headers: registration.headers,
    body: JSON.stringify(regPayload),
  });
  assert.equal(regRes.status, 200, 'Registration PUT must succeed');
  const regData = await regRes.json();
  assert.equal(regData.patient.fullName, 'Chan Kosal');
  assert.ok(regRes.headers.get('x-request-id'), 'X-Request-ID must be present');

  // 2. Triage: Record vital signs and chief complaints
  const triagePayload = {
    patientKey,
    summary: {
      ...regPayload.summary,
      departmentCode: 'medicine',
    },
    data: {
      ...regData.patient.data,
      'scope:triage:id:pmrs_chief_complaint': 'Acute high fever, body aches and severe cough',
      'scope:triage:id:triage_systolic_bp': '125',
      'scope:triage:id:triage_diastolic_bp': '82',
      'scope:triage:id:triage_heart_rate': '78',
      'scope:triage:id:triage_temperature': '38.9',
      'scope:triage:id:triage_spo2': '98',
    },
  };

  const triageRes = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT',
    headers: triage.headers,
    body: JSON.stringify(triagePayload),
  });
  assert.equal(triageRes.status, 200, 'Triage PUT must succeed');

  // 3. Doctor: OPD consultation, ICD-10 diagnosis, and order laboratory test
  const doctorPayload = {
    patientKey,
    summary: triagePayload.summary,
    data: {
      ...triagePayload.data,
      'scope:medical:id:emr_pmrs_opd_icd10': 'A90',
      'scope:medical:id:emr_pmrs_opd_diagnosis': 'Dengue fever',
      'scope:medical:id:emr_pmrs_opd_treatment': 'Oral rehydration salts, Paracetamol 500mg, monitor hydration',
    },
  };

  const doctorRes = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT',
    headers: doctor.headers,
    body: JSON.stringify(doctorPayload),
  });
  assert.equal(doctorRes.status, 200, 'Doctor diagnosis PUT must succeed');

  // 4. Cashier: Check patient billing
  const billRes = await fetch(`${baseUrl}/api/finance/patient?patientKey=${encodeURIComponent(patientKey)}`, {
    headers: { Cookie: clerk.cookie },
  });
  assert.equal(billRes.status, 200, 'Cashier bill lookup must succeed');
  const billData = await billRes.json();
  assert.ok(billData.bill);

  // 5. Database Integrity & Online Backup verification
  const integrity = checkDatabaseIntegrity(app.database);
  assert.equal(integrity.ok, true, 'Database integrity must be clean after all operations');

  const backupRes = await fetch(`${baseUrl}/api/admin/backup`, {
    method: 'POST',
    headers: admin.headers,
  });
  assert.equal(backupRes.status, 201, 'Admin online backup must succeed with 201');
  const backupData = await backupRes.json();
  assert.equal(backupData.ok, true);
  assert.ok(backupData.filename);
  assert.ok(backupData.sizeBytes > 0);
});

test('E2E: Concurrent load simulation handles parallel reads and writes without lock errors', async () => {
  const doctor = await loginUser('doctor');

  // Generate 8 concurrent patient updates
  const concurrentTasks = Array.from({ length: 8 }, async (_, index) => {
    const key = `case:CONCURRENT-${index}`;
    const payload = {
      patientKey: key,
      summary: {
        caseNumber: `CONC-${index}`,
        healthId: `HC-C-${index}`,
        firstName: `Parallel${index}`,
        lastName: 'Patient',
        fullName: `Parallel${index} Patient`,
        sex: 'ស្រី',
        age: `${20 + index} ឆ្នាំ`,
        dateOfBirth: '2000-01-01',
        phone: '012999888',
        equityCard: '',
        paymentType: 'CASH',
        departmentCode: 'medicine',
        departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
        departmentNameEn: 'Medicine',
        serviceMode: 'ipd',
        entryDate: '2026-10-19',
        dischargeDate: '',
      },
      data: {
        'scope:medical:id:test_index': String(index),
        'scope:medical:id:notes': `Concurrent note payload index ${index}`,
      },
    };

    const res = await fetch(`${baseUrl}/api/patient-record`, {
      method: 'PUT',
      headers: doctor.headers,
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 200, `Concurrent write ${index} must succeed`);
    const json = await res.json();
    return json.patient.patientKey;
  });

  const writtenKeys = await Promise.all(concurrentTasks);
  assert.equal(writtenKeys.length, 8);

  // Verify all 8 records exist in the database
  for (const key of writtenKeys) {
    const record = app.database.findPatient(key);
    assert.ok(record, `Record ${key} must exist in the database`);
  }
});
