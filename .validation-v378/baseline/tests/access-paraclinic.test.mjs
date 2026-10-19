import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { openDatabase } from '../server/database.mjs';
import {
  ensureAccessSchema, getUserAccess, roleWardAllowed, setUserAccess, validContexts,
} from '../server/access.mjs';
import {
  acknowledgeCritical, createLabTest, createOrder, ensureParaclinicSchema, findLabTest, getOrder, labCatalog, normalizeLabResults, updateLabTest, updateOrder,
} from '../server/paraclinic.mjs';

function createUser(database, username, role = 'DOCTOR') {
  const id = crypto.randomUUID();
  database.createUser({
    id,
    username,
    displayName: username,
    role,
    passwordHash: 'not-used-in-unit-test',
    createdAt: Date.now(),
  });
  return id;
}

test('multi-role/multi-ward assignments produce only valid working contexts', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    const id = createUser(database, 'multi.role');
    setUserAccess(database, id, ['DOCTOR', 'NURSE', 'MIDWIFE'], ['medicine', 'emergency', 'obstetric']);
    const access = getUserAccess(database, id);
    assert.deepEqual(access.roles, ['DOCTOR', 'MIDWIFE', 'NURSE']);
    assert.deepEqual(access.wards, ['emergency', 'medicine', 'obstetric']);
    const contexts = validContexts(access);
    assert.ok(contexts.some(item => item.role === 'DOCTOR' && item.wardCode === 'obstetric'));
    assert.ok(contexts.some(item => item.role === 'MIDWIFE' && item.wardCode === 'obstetric'));
    assert.ok(!contexts.some(item => item.role === 'MIDWIFE' && item.wardCode === 'medicine'));
    assert.ok(contexts.some(item => item.role === 'NURSE' && item.wardCode === 'medicine'));
    assert.ok(!contexts.some(item => item.role === 'NURSE' && item.wardCode === 'obstetric'));
    assert.equal(roleWardAllowed('MIDWIFE', 'obstetric'), true);
    assert.equal(roleWardAllowed('MIDWIFE', 'medicine'), false);
    assert.equal(roleWardAllowed('NURSE', 'obstetric'), false);
  } finally {
    database.close();
  }
});

test('ward-requiring roles cannot be assigned without a compatible ward', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    const id = createUser(database, 'invalid.midwife', 'MIDWIFE');
    assert.throws(() => setUserAccess(database, id, ['MIDWIFE'], ['medicine']), /compatible ward/i);
  } finally {
    database.close();
  }
});

test('laboratory unit selection converts reference ranges and preserves a standardized value', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    ensureParaclinicSchema(database);
    const creatinine = findLabTest(database, 'CREAT');
    assert.equal(creatinine.baseUnit, 'µmol/L');
    assert.ok(creatinine.units.some(item => item.unit === 'mg/dL'));

    const normalized = normalizeLabResults(database, {
      items: [{ code: 'CREAT', value: 1.0, unit: 'mg/dL' }],
    }, {age:40,sex:'M'}).items[0];
    assert.equal(normalized.baseValue, 88.4);
    assert.equal(normalized.baseUnit, 'µmol/L');
    assert.equal(normalized.unit, 'mg/dL');
    assert.ok(Math.abs(normalized.referenceLow - (53 / 88.4)) < 0.00001);
    assert.ok(Math.abs(normalized.referenceHigh - (97 / 88.4)) < 0.00001);
    assert.equal(normalized.flag, '');

    const low = normalizeLabResults(database, {
      items: [{ code: 'K', value: 2.8, unit: 'mmol/L' }],
    }, {age:40,sex:'M'}).items[0];
    assert.equal(low.flag, 'LOW');
    assert.equal(low.referenceLow, 3.7);
    assert.equal(low.referenceHigh, 5.2);

    assert.throws(() => normalizeLabResults(database, {
      items: [{ code: 'CREAT', value: 1, unit: 'mmol/L' }],
    }), /not approved/i);
  } finally {
    database.close();
  }
});

test('lab reference and critical limits remain configurable by the hospital laboratory', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    ensureParaclinicSchema(database);
    const updated = updateLabTest(database, 'K', {
      referenceLow: 3.4,
      referenceHigh: 5.2,
      criticalLow: 2.5,
      criticalHigh: 6.5,
      referenceNote: 'Verified locally for the active analyzer and reagent lot.',
    });
    assert.equal(updated.referenceLow, 3.4);
    assert.equal(updated.referenceHigh, 5.2);
    assert.equal(updated.criticalLow, 2.5);
    assert.equal(updated.criticalHigh, 6.5);

    const critical = normalizeLabResults(database, {
      items: [{ code: 'K', value: 2.4, unit: 'mmol/L' }],
    }).items[0];
    assert.equal(critical.flag, 'CRITICAL_LOW');
  } finally {
    database.close();
  }
});


test('laboratory catalog supports panels, qualitative results and safe custom tests', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    ensureParaclinicSchema(database);

    const cbc = findLabTest(database, 'CBC');
    assert.equal(cbc.resultType, 'PANEL');
    assert.deepEqual(cbc.components, ['HGB','HCT','RBC','MCV','MCH','MCHC','RDW','WBC','NEUT','LYMPH','MONO','EOS','BASO','PLT','MPV']);
    const hemoglobin = findLabTest(database, 'HGB');
    assert.equal(hemoglobin.baseUnit, 'g/dL');
    assert.equal(hemoglobin.referenceLow, null);
    assert.equal(hemoglobin.referenceHigh, null);
    assert.ok(hemoglobin.units.some(item => item.unit === 'g/L' && item.factorToBase === 0.1));

    const hiv = findLabTest(database, 'HIV');
    assert.equal(hiv.resultType, 'TEXT');
    const qualitative = normalizeLabResults(database, {
      items: [{ code: 'HIV', value: 'Non-reactive', unit: '' }],
    }).items[0];
    assert.equal(qualitative.value, 'Non-reactive');
    assert.equal(qualitative.baseValue, null);
    assert.equal(qualitative.flag, '');

    const custom = createLabTest(database, {
      code: 'FERRITIN_LOCAL', name: 'Ferritin', category: 'Clinical Chemistry', specimen: 'Serum',
      baseUnit: 'ng/mL', units: [{ unit: 'ng/mL', factorToBase: 1, offsetToBase: 0 }],
      referenceLow: 20, referenceHigh: 250, referenceNote: 'Hospital-verified interval.',
    });
    assert.equal(custom.name, 'Ferritin');
    assert.ok(labCatalog(database).some(item => item.code === 'FERRITIN_LOCAL'));

    assert.throws(() => updateLabTest(database, 'FERRITIN_LOCAL', {
      referenceLow: 300, referenceHigh: 200,
    }), /Reference low cannot exceed reference high/);
  } finally {
    database.close();
  }
});

test('legacy hemoglobin catalog migrates to g/dL while keeping old g/L entries valid', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    ensureParaclinicSchema(database);
    database.sqlite.prepare("UPDATE lab_catalog SET base_unit='g/L',units_json=?,reference_low=120,reference_high=170,reference_note='International starter interval; verify locally.',reference_config_json='{}' WHERE code='HGB'")
      .run(JSON.stringify([{unit:'g/L',factorToBase:1,offsetToBase:0},{unit:'g/dL',factorToBase:10,offsetToBase:0}]));
    database.sqlite.prepare("DELETE FROM lab_reference_migrations WHERE code='HGB'").run();
    ensureParaclinicSchema(database);
    const hemoglobin = findLabTest(database, 'HGB');
    assert.equal(hemoglobin.baseUnit, 'g/dL');
    assert.equal(hemoglobin.referenceLow, null);
    assert.equal(hemoglobin.referenceHigh, null);
    const oldUnitResult = normalizeLabResults(database, { items:[{code:'HGB',value:140,unit:'g/L'}] }).items[0];
    assert.equal(oldUnitResult.value, 140);
    assert.equal(oldUnitResult.baseValue, 14);
    assert.equal(oldUnitResult.flag, '');
  } finally {
    database.close();
  }
});


test('paraclinic orders follow doctor → ward → collection → lab specimen workflow timestamps', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    ensureParaclinicSchema(database);
    const doctorId = createUser(database, 'doctor.workflow', 'DOCTOR');
    const nurseId = createUser(database, 'nurse.workflow', 'NURSE');
    const labId = createUser(database, 'lab.workflow', 'LAB');
    const order = createOrder(database, {
      patientKey: 'PAT-1', modality: 'LAB', priority: 'ROUTINE',
      request: { items: [{ code: 'K', urgent: false }] }, userId: doctorId, role: 'DOCTOR', ward: 'medicine',
    });
    assert.match(order.accessionNumber, /^LAB-\d{8}-[A-F0-9]{6}$/);
    const wardReceived = updateOrder(database, order.id, { status: 'WARD_RECEIVED' }, { userId: nurseId, role: 'NURSE' });
    assert.equal(wardReceived.status, 'WARD_RECEIVED');
    assert.ok(wardReceived.wardReceivedAt);
    assert.equal(wardReceived.wardReceiverName, 'nurse.workflow');
    const chosenCollectionTime = Date.now() - 60_000;
    const collected = updateOrder(database, order.id, { status: 'COLLECTED', collectedAt: chosenCollectionTime }, { userId: nurseId, role: 'NURSE' });
    assert.equal(collected.status, 'COLLECTED');
    assert.equal(collected.collectedAt, chosenCollectionTime);
    assert.equal(collected.collectorName, 'nurse.workflow');
    const sent = updateOrder(database, order.id, { status: 'SENT_TO_LAB' }, { userId: nurseId, role: 'NURSE' });
    assert.equal(sent.status, 'SENT_TO_LAB');
    assert.ok(sent.sentToLabAt);
    assert.equal(sent.senderName, 'nurse.workflow');
    const received = updateOrder(database, order.id, { status: 'RECEIVED' }, { userId: labId, role: 'LAB' });
    assert.equal(received.status, 'RECEIVED');
    assert.ok(received.receivedAt);
    assert.equal(received.receiverName, 'lab.workflow');
  } finally {
    database.close();
  }
});

test('rejected laboratory specimens alert the ward and can be recollected', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    ensureParaclinicSchema(database);
    const doctorId = createUser(database, 'doctor.reject', 'DOCTOR');
    const nurseId = createUser(database, 'nurse.reject', 'NURSE');
    const labId = createUser(database, 'lab.reject', 'LAB');
    const order = createOrder(database, {
      patientKey: 'PAT-R', modality: 'LAB', priority: 'URGENT',
      request: { items: [{ code: 'CBC', urgent: true }] }, userId: doctorId, role: 'DOCTOR', ward: 'medicine',
    });
    updateOrder(database, order.id, { status: 'WARD_RECEIVED' }, { userId: nurseId, role: 'NURSE' });
    updateOrder(database, order.id, { status: 'COLLECTED' }, { userId: nurseId, role: 'NURSE' });
    updateOrder(database, order.id, { status: 'SENT_TO_LAB' }, { userId: nurseId, role: 'NURSE' });
    const rejected = updateOrder(database, order.id, { status: 'REJECTED', rejectionReason: 'Clotted sample' }, { userId: labId, role: 'LAB' });
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.rejectionReason, 'Clotted sample');
    assert.equal(rejected.rejectorName, 'lab.reject');
    assert.ok(rejected.rejectedAt);
    const recollected = updateOrder(database, order.id, { status: 'COLLECTED' }, { userId: nurseId, role: 'NURSE' });
    assert.equal(recollected.status, 'COLLECTED');
    assert.equal(recollected.rejectionReason, '');
    assert.equal(recollected.rejectedAt, null);
  } finally {
    database.close();
  }
});

test('released critical lab result can be acknowledged by a doctor', () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    ensureParaclinicSchema(database);
    updateLabTest(database, 'K', { criticalLow: 2.5, criticalHigh: 6.5 });
    const doctorId = createUser(database, 'doctor.critical', 'DOCTOR');
    const labId = createUser(database, 'lab.critical', 'LAB');
    const order = createOrder(database, {
      patientKey: 'PAT-2', modality: 'LAB', priority: 'URGENT',
      request: { items: [{ code: 'K', urgent: true }] }, userId: doctorId, role: 'DOCTOR', ward: 'emergency',
    });
    const nurseId = createUser(database, 'nurse.critical', 'NURSE');
    updateOrder(database, order.id, { status: 'WARD_RECEIVED' }, { userId: nurseId, role: 'NURSE' });
    updateOrder(database, order.id, { status: 'COLLECTED' }, { userId: nurseId, role: 'NURSE' });
    updateOrder(database, order.id, { status: 'SENT_TO_LAB' }, { userId: nurseId, role: 'NURSE' });
    updateOrder(database, order.id, { status: 'RECEIVED' }, { userId: labId, role: 'LAB' });
    const released = updateOrder(database, order.id, {
      status: 'PROCESSING', performed: true,
      result: { items: [{ code: 'K', value: 2.4, unit: 'mmol/L' }] }, release: true,
    }, { userId: labId, role: 'LAB' });
    assert.equal(released.hasCritical, true);
    assert.equal(released.result.items[0].flag, 'CRITICAL_LOW');
    const acknowledged = acknowledgeCritical(database, order.id, doctorId, 'Seen and treatment started.');
    assert.ok(acknowledged.criticalAckAt);
    assert.equal(acknowledged.criticalAckName, 'doctor.critical');
    assert.equal(acknowledged.criticalAckNote, 'Seen and treatment started.');
    assert.equal(getOrder(database, order.id).hasCritical, true);
  } finally {
    database.close();
  }
});
