import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { validPatientPhoto } from '../server/patient-photo.mjs';
import {
  isPatientDischarged,
  assertCashierInvoiceWritable,
  applyDirectInvoiceEdit,
  ensureInvoiceEditSchema,
} from '../server/invoice-edits.mjs';
import { ensureFinanceSchema, addCharge } from '../server/finance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v30.7 version consistency in package.json and login.html', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(loginHtml.includes('v30.7') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(serverMjs.includes('v30.7') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v30.7 patient photo validator accepts valid photos and rejects corrupted ones', () => {
  // Valid tiny 1x1 PNG base64
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal(validPatientPhoto(validPng), true, 'Valid PNG should pass validation');
  assert.equal(validPatientPhoto(''), true, 'Empty string should pass validation for photo removal');
  assert.equal(validPatientPhoto('invalid-data'), false, 'Non-data-URI string should fail validation');
  assert.equal(validPatientPhoto('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), false, 'GIF format should be rejected');
});

test('v30.7 cashier invoice direct edit vs discharge lock logic in disposable database', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v307-test-'));
  const testDbFile = path.join(tmpDir, 'test.sqlite');
  const db = openDatabase(testDbFile);

  try {
    ensureFinanceSchema(db);
    ensureInvoiceEditSchema(db);

    const now = Date.now();
    db.createUser({ id: 'u-cashier', username: 'cashier1', displayName: 'Cashier User', passwordHash: 'hash', role: 'CLERK', createdAt: now });
    db.createUser({ id: 'u-admin', username: 'admin1', displayName: 'Admin User', passwordHash: 'hash', role: 'ADMIN', createdAt: now });

    // 1. Create active undischarged OPD patient
    const activeKey = 'patient-active-001';
    db.upsertPatient({
      id: 'rec-001',
      patientKey: activeKey,
      userId: 'u-admin',
      savedAt: now,
      summary: {
        caseNumber: 'CASE-001',
        healthId: 'HID-001',
        firstName: 'Piseth',
        lastName: 'Sok',
        fullName: 'Sok Piseth',
        sex: 'M',
        age: '28',
        dateOfBirth: '1998-05-10',
        phone: '012345678',
        equityCard: '',
        paymentType: 'DIRECT',
        departmentCode: 'OPD',
        departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
        departmentNameEn: 'Outpatient Department',
        serviceMode: 'opd',
        entryDate: '2026-10-11',
        dischargeDate: '',
      },
      data: { 'system:workflowStage': 'OPD_CONSULT' },
    });

    assert.equal(isPatientDischarged(db, activeKey), false, 'Active patient must not be discharged');
    assert.doesNotThrow(() => {
      assertCashierInvoiceWritable(db, activeKey, 'inv-1', 'CLERK');
    }, 'Writable assertion should succeed for undischarged patient');

    // Add a charge to create an invoice with active charge
    const charge = addCharge(
      db,
      activeKey,
      {
        description: 'ពិគ្រោះជំងឺទូទៅ (Consultation)',
        quantity: 1,
        unitAmount: 20000,
        currency: 'KHR',
        category: 'Consultation',
      },
      'u-cashier'
    );

    const invoiceId = charge.invoiceId;
    const chargeId = charge.id;

    // Direct edit without permission should succeed!
    const editResult = applyDirectInvoiceEdit(
      db,
      { userId: 'u-cashier', role: 'CLERK' },
      activeKey,
      invoiceId,
      {
        charges: [
          {
            id: chargeId,
            description: 'ពិគ្រោះជំងឺទូទៅពិសេស (Special Consultation)',
            quantity: 2,
            unitAmount: 25000,
            note: 'Updated by cashier',
          },
        ],
      }
    );

    assert.equal(editResult.invoiceId, invoiceId);
    const updatedCharge = db.sqlite.prepare('SELECT * FROM finance_charges WHERE id=?').get(chargeId);
    assert.equal(updatedCharge.quantity, 2);
    assert.equal(updatedCharge.amount_minor, 50000);
    assert.equal(updatedCharge.description, 'ពិគ្រោះជំងឺទូទៅពិសេស (Special Consultation)');

    // 2. Now discharge the patient (case closed)
    db.sqlite.prepare(`UPDATE patient_records SET discharge_date='2026-10-11T12:00:00.000Z', record_json=? WHERE patient_key=?`).run(
      JSON.stringify({
        'system:admissionStatus': 'discharged',
        'system:discharge': { summary: 'Completed treatment' },
      }),
      activeKey
    );

    assert.equal(isPatientDischarged(db, activeKey), true, 'Discharged patient must be detected as discharged');

    // Attempting writable check or direct edit must now fail with 403 (case closed)
    assert.throws(
      () => {
        assertCashierInvoiceWritable(db, activeKey, invoiceId, 'CLERK');
      },
      /Patient is discharged \(case closed\)/,
      'assertCashierInvoiceWritable must throw for discharged patient'
    );

    assert.throws(
      () => {
        applyDirectInvoiceEdit(
          db,
          { userId: 'u-cashier', role: 'CLERK' },
          activeKey,
          invoiceId,
          {
            charges: [
              {
                id: chargeId,
                description: 'Attempted edit after discharge',
                quantity: 1,
                unitAmount: 10000,
              },
            ],
          }
        );
      },
      /Patient is discharged \(case closed\)/,
      'applyDirectInvoiceEdit must be rejected when patient is discharged'
    );
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v30.7 UI files contain auto-apply photo and cashier invoice history requirements', () => {
  const billingJs = fs.readFileSync(path.join(root, 'public', 'billing.js'), 'utf8');
  assert.ok(billingJs.includes('openCashierInvoiceHistory'), 'billing.js must expose openCashierInvoiceHistory');
  assert.ok(billingJs.includes('history-date-filter'), 'billing.js must filter history by date');
  assert.ok(billingJs.includes('data-direct-edit'), 'billing.js must support direct editing when not discharged');
  assert.ok(billingJs.includes('invoice-discharged-badge'), 'billing.js must show discharged lock badge');

  const photoJs = fs.readFileSync(path.join(root, 'public', 'patient-photo.js'), 'utf8');
  assert.ok(photoJs.includes('persistPatientPhotoIfLoaded'), 'patient-photo.js must auto-persist photo');
  assert.ok(photoJs.includes('ថតម្តងទៀត'), 'patient-photo.js must have clean Khmer label');
  assert.ok(photoJs.includes('បោះបង់'), 'patient-photo.js must have clean Khmer label');
  assert.ok(!photoJs.includes('(Retake)'), 'patient-photo.js must not contain bracketed English (Retake)');
  assert.ok(!photoJs.includes('(Apply Photo)'), 'patient-photo.js must not contain bracketed English (Apply Photo)');

  const billingHtml = fs.readFileSync(path.join(root, 'protected', 'billing.html'), 'utf8');
  assert.ok(billingHtml.includes('id="payment-register-date"'), 'billing.html must contain payment-register-date');
  assert.ok(billingHtml.includes('id="invoice-history-dialog"'), 'billing.html must contain invoice-history-dialog');
  assert.ok(billingHtml.includes('id="history-date-filter"'), 'billing.html must contain history-date-filter');
});

test('v30.7 demo patient data integrity preserved in data/demo.sqlite', () => {
  const demoDbPath = path.join(root, 'data', 'demo.sqlite');
  if (fs.existsSync(demoDbPath)) {
    const db = openDatabase(demoDbPath);
    try {
      const count = db.sqlite.prepare('SELECT COUNT(*) as n FROM patient_records').get().n;
      assert.ok(count >= 30, `demo.sqlite must preserve all patient records (found ${count})`);
    } finally {
      db.close();
    }
  }
});
