import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { paymentStatusForPatient, invalidatePaymentStatusCache, addCharge } from '../server/finance.mjs';

const ROOT = path.resolve('.');


test('v36.1 - In-memory paymentStatusCache eliminates repeated SQL queries and invalidates on financial mutations', async () => {
  const { ensureFinanceSchema } = await import('../server/finance.mjs');
  const db = openDatabase(':memory:');
  try {
    ensureFinanceSchema(db);
    db.createUser({ id: 'u1', username: 'admin', displayName: 'Admin', role: 'ADMIN', passwordHash: 'x', createdAt: Date.now() });
    const patientKey = 'PATIENT-CACHE-TEST-001';
    db.upsertPatient({
      id: 'p1', patientKey, userId: 'u1', savedAt: Date.now(),
      summary: {
        caseNumber: '160201-REG-261016-001', healthId: '160201-261016-001',
        firstName: 'Sok', lastName: 'Chan', fullName: 'Chan Sok', sex: 'M', age: '30',
        dateOfBirth: '1996-01-01', phone: '012345678', equityCard: '', paymentType: 'CASH',
        departmentCode: 'opd', departmentNameKh: 'ផ្នែកពិគ្រោះក្រៅ', departmentNameEn: 'OPD',
        serviceMode: 'opd', entryDate: '2026-10-16', dischargeDate: ''
      },
      data: {}
    });

    invalidatePaymentStatusCache(patientKey);

    // Initial calculation populates cache
    const status1 = paymentStatusForPatient(db, patientKey);
    assert.ok(status1);
    assert.equal(status1.patientKey, patientKey);
    assert.equal(status1.code, 'NOT_PAID');

    // Repeated call returns identical cached reference instantly
    const status2 = paymentStatusForPatient(db, patientKey);
    assert.equal(status1, status2, 'Should return cached payment status reference');

    // Invalidation clears cache
    invalidatePaymentStatusCache(patientKey);

    // Adding a charge automatically invalidates and recalculates
    addCharge(db, patientKey, {
      description: 'Consultation',
      unitAmount: 20000,
      quantity: 1,
      currency: 'KHR',
      category: 'CONSULTATION'
    }, 'u1');

    const status3 = paymentStatusForPatient(db, patientKey);
    assert.ok(status3);
    assert.equal(status3.balances.KHR, 20000);
  } finally {
    db.close();
  }
});

test('v36.1 - Client polling scripts are throttled to >= 15s and pause when tab is hidden', () => {
  const cashierJs = fs.readFileSync(path.join(ROOT, 'public', 'cashier-notifications.js'), 'utf8');
  assert.ok(cashierJs.includes('15000'));
  assert.ok(cashierJs.includes('!document.hidden'));

  const messagesJs = fs.readFileSync(path.join(ROOT, 'public', 'messages.js'), 'utf8');
  assert.ok(messagesJs.includes('15000'));
  assert.ok(messagesJs.includes('!document.hidden'));

  const approvalsJs = fs.readFileSync(path.join(ROOT, 'public', 'payment-approvals.js'), 'utf8');
  assert.ok(approvalsJs.includes('15000'));
  assert.ok(approvalsJs.includes('!document.hidden'));

  const paraclinicJs = fs.readFileSync(path.join(ROOT, 'public', 'paraclinic.js'), 'utf8');
  assert.ok(paraclinicJs.includes('15000'));
  assert.ok(paraclinicJs.includes('!document.hidden'));

  const nurseJs = fs.readFileSync(path.join(ROOT, 'public', 'opd-paraclinic-nurse.js'), 'utf8');
  assert.ok(nurseJs.includes('15000'));
  assert.ok(nurseJs.includes('!document.hidden'));

  const labJs = fs.readFileSync(path.join(ROOT, 'public', 'lab.js'), 'utf8');
  assert.ok(labJs.includes('15000'));
  assert.ok(labJs.includes('!document.hidden'));

  const imagingJs = fs.readFileSync(path.join(ROOT, 'public', 'imaging.js'), 'utf8');
  assert.ok(imagingJs.includes('15000'));
  assert.ok(imagingJs.includes('!document.hidden'));
});

test('v36.1 - EMR.html and login.html contain Khmer font preload and content-visibility optimization', () => {
  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('rel="preload" href="/public/fonts/Battambang-Regular.ttf"'));
  assert.ok(emrHtml.includes('content-visibility: hidden;'));

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.ok(loginHtml.includes('rel="preload" href="/public/fonts/Battambang-Regular.ttf"'));
});
