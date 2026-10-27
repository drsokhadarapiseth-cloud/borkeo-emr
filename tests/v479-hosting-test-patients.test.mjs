// v47.9 - 30 complete test patients for a test hosting; refuses any database
// that holds a patient who is not a test patient. Temporary databases only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openDatabase } from '../server/database.mjs';
import { verifyPassword } from '../server/password.mjs';
import { buildHostingTestPatients, seedHostingTestPatients, isTestPatient } from '../scripts/seed-hosting-test-patients.mjs';

const temp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v479-')), 'emr.sqlite');
const reg = (patient, key) => patient.data[`scope:registration:id:${key}`];
const tri = (patient, key) => patient.data[`scope:triage:id:${key}`];

test('30 patients: ID format, photo, complete registration, mixed payment, triage measured and waiting', () => {
  const patients = buildHostingTestPatients(Date.parse('2026-10-26T03:00:00Z'));
  assert.equal(patients.length, 30);
  assert.deepEqual(patients.map((p) => p.summary.caseNumber), Array.from({ length: 30 }, (_, i) => `160201-20261026-${String(i + 1).padStart(3, '0')}`));
  for (const p of patients) {
    assert.equal(p.summary.healthId, p.summary.caseNumber);
    // v48.1: no photo.
    assert.equal(reg(p, 'web_patient_photo'), undefined);
    for (const key of ['web_first_name', 'web_last_name', 'web_dob', 'web_age', 'web_phone', 'web_nat', 'web_entry_type', 'web_street_address', 'web_village', 'web_commune', 'web_district', 'web_caregiver_name', 'web_caregiver_phone', 'web_caregiver_relation']) {
      assert.ok(String(reg(p, key) ?? '').trim(), `${p.summary.caseNumber} ${key}`);
    }
    for (const key of ['p2_temp', 'p2_bp_sys', 'p2_bp_dia', 'p2_pulse', 'p2_resp', 'p2_spo2', 'p2_weight', 'p2_height', 'pmrs_chief_complaint']) assert.ok(String(tri(p, key) ?? '').trim(), `${p.summary.caseNumber} ${key}`);
    assert.equal(tri(p, 'p2_other_dept'), '', 'the service is chosen by the nurse');
    assert.equal(p.data['system:workflowStage'], 'TRIAGE_WAITING');
    assert.equal(isTestPatient(JSON.stringify(p.data)), true);
    // A card number only when that payment applies; v48.1: the HEF / NSSF card check is saved (practice answers).
    if (reg(p, 'web_equity')) { assert.match(reg(p, 'web_equity'), /^\d{10}$/); assert.ok(reg(p, 'web_hef_verification')); }
    if (reg(p, 'web_nssf')) { assert.match(reg(p, 'web_nssf'), /^\d{10}$/); assert.ok(reg(p, 'web_nssf_verification')); }
    if (reg(p, 'other_id_yes')) assert.ok(reg(p, 'web_other_card_type') && reg(p, 'web_other_card_number') && reg(p, 'web_other_card_issuer'));
  }
  const count = (fn) => patients.filter(fn).length;
  assert.deepEqual([count((p) => reg(p, 'web_equity')), count((p) => reg(p, 'web_nssf')), count((p) => reg(p, 'other_id_yes'))], [12, 12, 6]);
  assert.equal(new Set(patients.map((p) => reg(p, 'web_entry_type'))).size, 3, 'all entry types');
  assert.ok(count((p) => Number(tri(p, 'p2_spo2')) < 94 || Number(tri(p, 'p2_temp')) >= 39 || Number(tri(p, 'p2_bp_sys')) >= 160) >= 3, 'some abnormal values for the alerts');
});

test('seeding replaces the earlier test patients and makes the 1234 accounts usable', async () => {
  const file = temp();
  await seedHostingTestPatients(file, { log: () => {} });
  const result = await seedHostingTestPatients(file, { log: () => {} });
  assert.equal(result.count, 30);
  const db = openDatabase(file);
  try {
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS c FROM patient_records').get().c, 30, 'replaced, not doubled');
    for (const username of ['Superuser', 'nurse_triage', 'doctor_opd', 'nurse_obstetric']) {
      const user = db.findUser(username);
      assert.ok(user, username);
      assert.equal(await verifyPassword('1234', user.password_hash), true, `${username} / 1234`);
    }
  } finally { db.close(); }
});

test('refuses a database with a real patient and changes nothing', async () => {
  const file = temp();
  await seedHostingTestPatients(file, { log: () => {} });
  const db = openDatabase(file);
  try {
    const userId = db.findUser('Superuser').id;
    db.upsertPatient({ id: 'real-1', patientKey: 'case:REAL-1', data: { 'scope:registration:id:web_first_name': 'Real' }, savedAt: Date.now(), userId,
      summary: { caseNumber: 'REAL-1', healthId: 'REAL-1', fullName: 'Real Patient', firstName: 'Real', lastName: 'Patient', sex: '', age: '', dateOfBirth: '', phone: '', equityCard: '', paymentType: '', departmentCode: '', departmentNameKh: '', departmentNameEn: '', serviceMode: '', entryDate: '', dischargeDate: '' } });
  } finally { db.close(); }
  await assert.rejects(seedHostingTestPatients(file, { log: () => {} }), /Refused: 1 patient\(s\)/);
  const after = openDatabase(file);
  try { assert.equal(after.sqlite.prepare('SELECT COUNT(*) AS c FROM patient_records').get().c, 31, 'nothing was changed'); } finally { after.close(); }
  await assert.rejects(seedHostingTestPatients(''), /Give the test database file/);
});
