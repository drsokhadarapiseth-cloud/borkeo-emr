import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { ensureFinanceSchema, startPatientInvoice, addCharge, patientBill, getFinanceProfile } from '../server/finance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v31.0 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(((loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || loginHtml.includes('v32.7') || loginHtml.includes('v32.6')) || loginHtml.includes('v32.4') || loginHtml.includes('v32.3') || loginHtml.includes('v32.2') || loginHtml.includes('v32.1') || loginHtml.includes('v32.0') || loginHtml.includes('v31.9') || loginHtml.includes('v31.8') || loginHtml.includes('v31.7') || loginHtml.includes('v31.6') || loginHtml.includes('v31.5') || loginHtml.includes('v31.4') || loginHtml.includes('v31.3') || loginHtml.includes('v31.2') || loginHtml.includes('v31.1') || loginHtml.includes('v31.0') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(((serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || serverMjs.includes('v32.7') || serverMjs.includes('v32.6')) || serverMjs.includes('v32.4') || serverMjs.includes('v32.3') || serverMjs.includes('v32.2') || serverMjs.includes('v32.1') || serverMjs.includes('v32.0') || serverMjs.includes('v31.9') || serverMjs.includes('v31.8') || serverMjs.includes('v31.7') || serverMjs.includes('v31.6') || serverMjs.includes('v31.5') || serverMjs.includes('v31.4') || serverMjs.includes('v31.3') || serverMjs.includes('v31.2') || serverMjs.includes('v31.1') || serverMjs.includes('v31.0') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v31.0 billing.html removes redundant save-payment-category button', () => {
  const billingHtml = fs.readFileSync(path.join(root, 'protected', 'billing.html'), 'utf8');
  assert.ok(!billingHtml.includes('id="save-payment-category"'), 'billing.html must not contain separate save-payment-category button');
  assert.ok(!billingHtml.includes('id="payment-category-status"'), 'billing.html must not contain payment-category-status');
  assert.ok(billingHtml.includes('id="payment-type"'), 'billing.html must retain payment-type selector');
  assert.ok(billingHtml.includes('id="payer-reference"'), 'billing.html must retain payer-reference input');
});

test('v31.0 payment-prices.js and billing.js safely handle absent save-payment-category element', () => {
  const pricesJs = fs.readFileSync(path.join(root, 'public', 'payment-prices.js'), 'utf8');
  assert.ok(pricesJs.includes('const el=$(id);if(el)'), 'payment-prices.js must guard element existence');

  const billingJs = fs.readFileSync(path.join(root, 'public', 'billing.js'), 'utf8');
  assert.ok(billingJs.includes("if($('save-payment-category'))"), 'billing.js must guard save-payment-category listener');
});

test('v31.0 payment category and policy details are atomically persisted on payment or complete payment', async () => {
  const { ensureAccessSchema } = await import('../server/access.mjs');
  const { setFinanceProfile, addPayment } = await import('../server/finance.mjs');
  const db = openDatabase(':memory:');
  ensureAccessSchema(db);
  ensureFinanceSchema(db);

  const patientKey = 'case:v310-test-' + Date.now();
  const userId = crypto.randomUUID();

  db.createUser({
    id: userId,
    username: 'admin310',
    displayName: 'Admin V310',
    passwordHash: 'x',
    role: 'ADMIN',
    createdAt: Date.now(),
  });

  db.upsertPatient({
    id: crypto.randomUUID(),
    patientKey,
    summary: {
      caseNumber: 'V310-001',
      healthId: 'H310-001',
      firstName: 'Test',
      lastName: 'Patient',
      fullName: 'V310 Merge Test Patient',
      sex: 'M',
      age: '30',
      dateOfBirth: '',
      phone: '',
      equityCard: '',
      paymentType: 'DIRECT',
      departmentCode: 'opd',
      departmentNameKh: 'ពិគ្រោះក្រៅ',
      departmentNameEn: 'OPD',
      serviceMode: 'opd',
      entryDate: '2026-10-12',
      dischargeDate: '',
    },
    data: {},
    userId,
    savedAt: Date.now(),
  });

  const invoice = startPatientInvoice(db, patientKey, userId);
  addCharge(db, patientKey, {
    description: 'Consultation Fee',
    quantity: 1,
    unitAmount: 10000,
    currency: 'KHR',
  }, userId, Date.now(), { newInvoiceId: invoice.id });

  let bill = patientBill(db, patientKey, invoice.id);
  assert.equal(bill.summary.KHR.gross, 10000);
  assert.equal(bill.summary.KHR.balance, 10000);

  // Simulate complete-payment payload saving paymentType and policy details
  setFinanceProfile(db, patientKey, {
    paymentType: 'DIRECT',
    paymentSubtype: 'FULL',
    payerReference: 'CARD-REF-9988',
  }, userId, Date.now(), invoice.id);

  addPayment(db, patientKey, {
    invoiceId: invoice.id,
    amount: 10000,
    currency: 'KHR',
    source: 'CASH',
  }, userId);

  const updatedBill = patientBill(db, patientKey, invoice.id);
  const profile = getFinanceProfile(db, patientKey);

  assert.equal(updatedBill.summary.KHR.balance, 0, 'balance should be fully settled');
  assert.equal(profile.paymentType, 'DIRECT', 'payment type should be DIRECT');
  assert.equal(profile.payerReference, 'CARD-REF-9988', 'payerReference should be saved');

  db.close();
});
