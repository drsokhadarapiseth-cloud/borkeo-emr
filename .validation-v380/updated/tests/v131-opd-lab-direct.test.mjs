import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { createOrder, ensureParaclinicSchema, updateOrder } from '../server/paraclinic.mjs';

function createUser(database, username, role) {
  const id = crypto.randomUUID();
  database.createUser({ id, username, displayName: username, role, passwordHash: 'test', createdAt: Date.now() });
  return id;
}

function createOpdPatient(database, patientKey) {
  database.upsertPatient({
    id: crypto.randomUUID(),
    patientKey,
    userId: createUser(database, 'registration.v131', 'REGISTRATION'),
    savedAt: Date.now(),
    summary: {
      caseNumber: patientKey, healthId: 'H-131', firstName: 'OPD', lastName: 'Patient', fullName: 'OPD Patient',
      sex: 'Female', age: '30', dateOfBirth: '1996-01-01', phone: '', equityCard: '', paymentType: 'CASH',
      departmentCode: 'opd', departmentNameKh: 'ពិគ្រោះក្រៅ', departmentNameEn: 'OPD', serviceMode: 'opd', entryDate: '2026-09-21', dischargeDate: ''
    },
    data: JSON.stringify({ 'system:workflowStage': 'DOCTOR_READY', 'system:triageStatus': 'COMPLETED' }),
  });
}

test('v13.2 OPD laboratory request can be received, sampled, tested, and released directly by laboratory staff', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    ensureParaclinicSchema(database);
    createOpdPatient(database, 'OPD-LAB-131');
    const doctorId = createUser(database, 'doctor.v131', 'DOCTOR');
    const labId = createUser(database, 'lab.v131', 'LAB');
    const order = createOrder(database, {
      patientKey: 'OPD-LAB-131', modality: 'LAB', priority: 'ROUTINE',
      request: { items: [{ code: 'HGB', urgent: false }] }, userId: doctorId, role: 'DOCTOR', ward: 'opd',
    });
    assert.equal(order.status, 'ORDERED');

    const processing = updateOrder(database, order.id, {
      status: 'PROCESSING', performed: true,
      result: { items: [{ code: 'HGB', value: 140, unit: 'g/L' }] },
    }, { userId: labId, role: 'LAB' });
    assert.equal(processing.status, 'PROCESSING');
    assert.equal(processing.receiverName, 'lab.v131');
    assert.equal(processing.collectorName, 'lab.v131');
    assert.ok(processing.receivedAt);
    assert.ok(processing.collectedAt);

    const released = updateOrder(database, order.id, {
      status: 'PROCESSING', performed: true,
      result: { items: [{ code: 'HGB', value: 140, unit: 'g/L' }] },
      release: true,
    }, { userId: labId, role: 'LAB' });
    assert.equal(released.status, 'RESULT_AVAILABLE');
    assert.ok(released.releasedAt);
    assert.equal(released.result.items[0].value, 140);
  } finally {
    database.close();
  }
});
