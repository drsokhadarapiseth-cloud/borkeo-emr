import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { ensureEditorHistorySchema, saveEditorHistory, listEditorHistory } from '../server/editor-history.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v30.8 cashier header removes duplicate print buttons and enforces 1-line layout', () => {
  const billingHtml = fs.readFileSync(path.join(root, 'protected', 'billing.html'), 'utf8');
  // Top head actions bar must not contain print-bill or print-bill-en
  assert.ok(!billingHtml.includes('id="print-bill"'), 'Top print-bill button must be removed from billing.html');
  assert.ok(!billingHtml.includes('id="print-bill-en"'), 'Top print-bill-en button must be removed from billing.html');
  // Bottom invoice action buttons must remain intact
  assert.ok(billingHtml.includes('id="print-invoice"'), 'Bottom print-invoice button must remain intact');
  assert.ok(billingHtml.includes('id="print-invoice-en"'), 'Bottom print-invoice-en button must remain intact');

  const billingCss = fs.readFileSync(path.join(root, 'public', 'billing.css'), 'utf8');
  assert.ok(billingCss.includes('white-space:nowrap!important') || billingCss.includes('white-space: nowrap !important'), 'billing.css must enforce single-line nowrap on header buttons');
  assert.ok(billingCss.includes('flex-shrink:0') || billingCss.includes('flex-shrink: 0;'), 'billing.css must prevent shrinking/wrapping on header elements');
});

test('v30.8 ICD-10 search dropdown style and formatting', () => {
  const icdCss = fs.readFileSync(path.join(root, 'public', 'emr-icd10.css'), 'utf8');
  assert.ok(icdCss.includes('border:0!important'), 'ICD-10 buttons must have no border boxes');
  assert.ok(icdCss.includes('#2ea44f!important'), 'ICD-10 buttons must highlight in green (#2ea44f) on hover/selected');
  assert.ok(icdCss.includes('color:#fff!important'), 'ICD-10 buttons must have white text on hover/selected');

  const icdJs = fs.readFileSync(path.join(root, 'public', 'emr-icd10.js'), 'utf8');
  assert.ok(icdJs.includes("item.code + ' - ' + desc"), 'ICD-10 js must format items cleanly as code - description');
});

test('v30.8 cashier eye icon redirects to billing history and server route redirect', () => {
  const patientListJs = fs.readFileSync(path.join(root, 'public', 'patient-list.js'), 'utf8');
  assert.ok(/\[\s*'CLERK'\s*,\s*'ACCOUNTANT'\s*\]\.includes\(activeRole\)/.test(patientListJs), 'patient-list.js must detect cashier roles');
  assert.ok(patientListJs.includes('/billing?') && patientListJs.includes('patientKey') && patientListJs.includes('history'), 'patient-list.js must route cashier to billing page with history');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(serverMjs.includes("['CLERK', 'ACCOUNTANT'].includes"), 'server.mjs /emr route must check for cashier roles');
  assert.ok(serverMjs.includes('/billing?patientKey='), 'server.mjs /emr route must redirect cashier to /billing');
});

test('v30.8 management choice modal and change log audit display (no icons in view)', () => {
  const patientListJs = fs.readFileSync(path.join(root, 'public', 'patient-list.js'), 'utf8');
  assert.ok(patientListJs.includes('openMgmtChoice'), 'patient-list.js must implement management choice modal');
  assert.ok(patientListJs.includes('openMgmtHistory'), 'patient-list.js must implement change log modal');
  assert.ok(patientListJs.includes('មើលកំណត់ត្រាវេជ្ជសាស្ត្រ'), 'choice modal must have Khmer option to view medical record');
  assert.ok(patientListJs.includes('មើលកំណត់ហេតុផ្លាស់ប្តូរទិន្នន័យ'), 'choice modal must have Khmer option to view data change log');

  // Verify no emojis or icons in the choice button text
  assert.ok(!patientListJs.includes('👁 មើលកំណត់ត្រាវេជ្ជសាស្ត្រ'), 'Choice buttons must NOT include emojis or icons');
  assert.ok(!patientListJs.includes('📄 មើលកំណត់ត្រាវេជ្ជសាស្ត្រ'), 'Choice buttons must NOT include emojis or icons');
  assert.ok(!patientListJs.includes('🔍 មើលកំណត់ហេតុផ្លាស់ប្តូរទិន្នន័យ'), 'Choice buttons must NOT include emojis or icons');
});

test('v30.8 editor history records medical edits and returns complete audit log', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v308-test-'));
  const testDbFile = path.join(tmpDir, 'test.sqlite');
  const db = openDatabase(testDbFile);

  try {
    ensureEditorHistorySchema(db);

    const now = Date.now();
    const patientKey = 'BK-TEST-2026-001';

    // 1. Initial doctor save
    saveEditorHistory(db, {
      patientKey,
      role: 'DOCTOR',
      editorScope: 'medical',
      userId: 'u-doc-1',
      editorName: 'Dr. Chhany',
      savedAt: now,
      existingData: {},
      data: {
        'emr_pmrs_opd_diagnosis': 'Acute Pharyngitis',
        'system:signature:medical': '{"signed":true}'
      }
    });

    let history = listEditorHistory(db, patientKey);
    assert.equal(history.length, 1, 'Should have 1 recorded edit history item');
    assert.equal(history[0].editorName, 'Dr. Chhany');
    assert.equal(history[0].role, 'DOCTOR');
    assert.equal(history[0].scope, 'medical');
    assert.ok(history[0].notes.some(n => n.field === 'emr_pmrs_opd_diagnosis' && n.text === 'Acute Pharyngitis'), 'Should capture changed medical field');

    // 2. Doctor updates diagnosis
    saveEditorHistory(db, {
      patientKey,
      role: 'DOCTOR',
      editorScope: 'medical',
      userId: 'u-doc-1',
      editorName: 'Dr. Chhany',
      savedAt: now + 5000,
      existingData: {
        'emr_pmrs_opd_diagnosis': 'Acute Pharyngitis'
      },
      data: {
        'emr_pmrs_opd_diagnosis': 'Streptococcal pharyngitis (J02.0)'
      }
    });

    history = listEditorHistory(db, patientKey);
    assert.equal(history.length, 2, 'Should have 2 recorded history entries');
    assert.ok(history[1].notes.some(n => n.field === 'emr_pmrs_opd_diagnosis' && n.text.includes('Streptococcal')), 'Should record updated diagnosis detail');
  } finally {
    db.sqlite.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v30.8 prescription print card number handles NSSF, Equity, and other payment types', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('id="prx_card_wrap_1"'), 'EMR.html must have card wrapper for prescription copy 1');
  assert.ok(emrHtml.includes('id="prx_card_wrap_2"'), 'EMR.html must have card wrapper for prescription copy 2');
  assert.ok(emrHtml.includes('id="prx_card_label_1"'), 'EMR.html must have card label for prescription copy 1');
  assert.ok(emrHtml.includes('id="prx_card_label_2"'), 'EMR.html must have card label for prescription copy 2');
  assert.ok(emrHtml.includes("isEquity"), 'EMR.html must check for equity payment type');
  assert.ok(emrHtml.includes("isNssf"), 'EMR.html must check for NSSF payment type');
});

