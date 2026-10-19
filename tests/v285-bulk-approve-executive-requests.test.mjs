import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import {
  ensureRequestSchema, submitWorkflowRequest, getWorkflowRequest,
  bulkReviewWorkflowRequests, listWorkflowRequests
} from '../server/requests.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('v28.5 requests schema supports PATIENT_EDIT, PATIENT_DELETE, and bulk approval workflow', () => {
  const db = openDatabase(':memory:');
  try {
    ensureRequestSchema(db);

    // Create a test user and patient
    db.createUser({ id: 'u1', username: 'director', displayName: 'Director General', role: 'DIRECTOR', passwordHash: 'hash', createdAt: Date.now() });
    db.createUser({ id: 'u2', username: 'doctor1', displayName: 'Dr. Sok', role: 'DOCTOR', passwordHash: 'hash', createdAt: Date.now() });
    db.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS admission_approvals (patient_key TEXT PRIMARY KEY, approved_by TEXT, approved_at INTEGER, approver_role TEXT, approved_name TEXT);
      CREATE TABLE IF NOT EXISTS queue_board_calls (patient_key TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS opd_queue_entries (patient_key TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS patient_editor_history (patient_key TEXT PRIMARY KEY);
    `);

    db.upsertPatient({
      id: 'p1',
      patientKey: 'case:test-101',
      userId: 'u2',
      savedAt: Date.now(),
      summary: {
        caseNumber: 'OPD-101',
        healthId: 'H-101',
        fullName: 'Meas Sokha',
        firstName: 'Sokha',
        lastName: 'Meas',
        sex: 'ស្រី',
        age: '28',
        dateOfBirth: '1995-05-10',
        phone: '012345678',
        equityCard: '',
        paymentType: 'CASH',
        departmentCode: 'general_medicine',
        departmentNameKh: 'ជំងឺទូទៅ',
        departmentNameEn: 'General Medicine',
        serviceMode: 'ipd',
        entryDate: '2026-10-10',
        dischargeDate: '2026-10-11'
      },
      data: { 'scope:general_medicine:id:history': 'ក្អក ក្តៅខ្លួន' }
    });

    db.upsertPatient({
      id: 'p2',
      patientKey: 'case:test-102',
      userId: 'u2',
      savedAt: Date.now(),
      summary: {
        caseNumber: 'OPD-102',
        healthId: 'H-102',
        fullName: 'Chan Dara',
        firstName: 'Dara',
        lastName: 'Chan',
        sex: 'ប្រុស',
        age: '35',
        dateOfBirth: '1990-01-01',
        phone: '098765432',
        equityCard: '',
        paymentType: 'CASH',
        departmentCode: 'general_medicine',
        departmentNameKh: 'ជំងឺទូទៅ',
        departmentNameEn: 'General Medicine',
        serviceMode: 'ipd',
        entryDate: '2026-10-10',
        dischargeDate: ''
      },
      data: { 'scope:general_medicine:id:history': 'ឈឺក្បាល' }
    });

    const docActor = { userId: 'u2', role: 'DOCTOR', wardCode: 'general_medicine', name: 'Dr. Sok' };
    const directorActor = { userId: 'u1', role: 'DIRECTOR', wardCode: '', name: 'Director General' };

    // 1. Submit PATIENT_EDIT request
    const editReq = submitWorkflowRequest(db, {
      kind: 'PATIENT_EDIT',
      patientKey: 'case:test-101',
      reason: 'កែប្រែរោគវិនិច្ឆ័យ ICD-10 ឱ្យបានត្រឹមត្រូវ'
    }, docActor);
    assert.equal(editReq.kind, 'PATIENT_EDIT');
    assert.equal(editReq.status, 'PENDING');
    assert.equal(editReq.reason, 'កែប្រែរោគវិនិច្ឆ័យ ICD-10 ឱ្យបានត្រឹមត្រូវ');

    // 2. Submit PATIENT_DELETE request
    const delReq = submitWorkflowRequest(db, {
      kind: 'PATIENT_DELETE',
      patientKey: 'case:test-102',
      reason: 'ចុះឈ្មោះស្ទួនគ្នា ចង់លុបចេញពីបញ្ជី'
    }, docActor);
    assert.equal(delReq.kind, 'PATIENT_DELETE');
    assert.equal(delReq.status, 'PENDING');

    // 3. Perform bulk approval by Director
    const approvedIds = bulkReviewWorkflowRequests(db, {
      reviews: [
        { id: editReq.id, revision: editReq.revision },
        { id: delReq.id, revision: delReq.revision }
      ],
      note: 'Bulk approved by Director'
    }, directorActor);

    assert.equal(approvedIds.length, 2);

    // Verify status updated
    const afterEdit = getWorkflowRequest(db, editReq.id, directorActor);
    assert.equal(afterEdit.status, 'APPROVED');

    const afterDel = getWorkflowRequest(db, delReq.id, directorActor);
    assert.equal(afterDel.status, 'APPROVED');

    // Verify patient 102 was deleted from patient_records
    const p102 = db.findPatient('case:test-102');
    assert.equal(p102, null, 'Deleted patient should no longer exist in patient_records');

    // Patient 101 should still exist
    const p101 = db.findPatient('case:test-101');
    assert.ok(p101, 'Patient 101 must remain intact');
  } finally {
    db.sqlite.close();
  }
});

test('v28.5 requests.html and requests.js have bulk approve button, select-all, and executive review', () => {
  const reqHtml = fs.readFileSync(path.join(projectRoot, 'protected/requests.html'), 'utf8');
  assert.match(reqHtml, /id="request-bulk-approve"/);
  assert.match(reqHtml, /id="request-select-all"/);

  const reqJs = fs.readFileSync(path.join(projectRoot, 'public/requests.js'), 'utf8');
  assert.match(reqJs, /PATIENT_EDIT:\s*'សំណើកែប្រែទិន្នន័យអ្នកជំងឺ'/);
  assert.match(reqJs, /PATIENT_DELETE:\s*'សំណើលុបអ្នកជំងឺចេញពីបញ្ជី'/);
  assert.match(reqJs, /class="executive-header"/);
  assert.match(reqJs, /class="executive-actions-bar"/);
  assert.match(reqJs, /data-quick-approve/);
  assert.match(reqJs, /\/api\/requests\/bulk-review/);
});

test('v28.5 patient-list.js action buttons: eye opens OPD form for view & print, pencil requests edit, delete requests delete', () => {
  const patientListJs = fs.readFileSync(path.join(projectRoot, 'public/patient-list.js'), 'utf8');
  assert.match(patientListJs, /title="មើលព័ត៌មាន"/);
  assert.match(patientListJs, /data-request-edit/);
  assert.match(patientListJs, /data-action-delete/);
  assert.match(patientListJs, /'PATIENT_EDIT'/);
  assert.match(patientListJs, /'PATIENT_DELETE'/);
});
