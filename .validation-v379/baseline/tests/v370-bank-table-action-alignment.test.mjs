import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('v37.0 - Version metadata consistency across package.json, login.html, server.mjs and templates', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '37.0.0');

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v37\.0/);

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v37\.0/);

  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('/public/emr-patient-record.js?v=3700'));
  assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3700'));

  const patientListHtml = fs.readFileSync(path.join(ROOT, 'protected', 'patient-list.html'), 'utf8');
  assert.ok(patientListHtml.includes('/public/patient-list.js?v=3700'));

  const triageHtml = fs.readFileSync(path.join(ROOT, 'protected', 'triage.html'), 'utf8');
  assert.ok(triageHtml.includes('/public/patient-list.js?v=3700'));

  const hfHtml = fs.readFileSync(path.join(ROOT, 'protected', 'health-facility.html'), 'utf8');
  assert.ok(hfHtml.includes('/public/health-facility.js?v=3700'));
});

test('v37.0 - public/health-facility.js aligns action buttons in banking table', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'health-facility.js'), 'utf8');

  // Verify action cell has dedicated container class
  assert.ok(js.includes("actions.className='hf-table-actions-cell'"), 'Actions cell must have class hf-table-actions-cell');

  // Verify buttons use matching class structure
  assert.ok(js.includes("'hf-table-btn hf-table-edit'"), 'Edit button must use hf-table-btn hf-table-edit');
  assert.ok(js.includes("'hf-table-btn hf-table-delete'"), 'Delete button must use hf-table-btn hf-table-delete');

  // Verify button labels are pure Khmer in default mode
  assert.ok(js.includes("txt('កែ','Edit')"), 'Edit button must use localized Khmer text');
  assert.ok(js.includes("txt('លុប','Remove')"), 'Delete button must use localized Khmer text');
});

test('v37.0 - public/health-facility.css styles table action buttons with clean alignment', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public', 'health-facility.css'), 'utf8');

  // Verify actions cell flex alignment
  assert.ok(css.includes('.hf-table-actions-cell'), 'CSS must define .hf-table-actions-cell');
  assert.ok(css.includes('display: inline-flex'), 'Actions cell must be flex container');
  assert.ok(css.includes('align-items: center'), 'Actions cell must align items center');
  assert.ok(css.includes('justify-content: center'), 'Actions cell must justify content center');

  // Verify button unified dimensions and zero margin
  assert.ok(css.includes('.hf-table-btn'), 'CSS must define .hf-table-btn');
  assert.ok(css.includes('margin: 0 !important'), 'Table action buttons must have zero margin to prevent misalignment');
  assert.ok(css.includes('height: 34px !important'), 'Table action buttons must have consistent 34px height');

  // Verify edit and delete outline styles
  assert.ok(css.includes('.hf-table-edit'), 'CSS must define .hf-table-edit');
  assert.ok(css.includes('.hf-table-delete'), 'CSS must define .hf-table-delete');
});
