import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve('.');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('v43.8: Patient list deduplicates patients sharing the same Health ID', () => {
  const patientListJs = read('public/patient-list.js');

  // The directory chooses the latest encounter before applying filters.
  assert.ok(
    patientListJs.includes('function latestPatients(rows)') &&
    patientListJs.includes('const grouped = new Map();') &&
    patientListJs.includes('triageToday ? patients : latestPatients(patients)'),
    'filteredPatients must deduplicate multiple rows with same Health ID'
  );
});

test('v43.8: Patient list pencil button triggers modal with edit info and add record options', () => {
  const patientListJs = read('public/patient-list.js');

  // Verify modal creation on edit button
  assert.ok(
    patientListJs.includes('patient-edit-choice-dialog'),
    'patient-list.js must open patient-edit-choice-dialog modal'
  );
  assert.ok(
    patientListJs.includes('data-action-edit-info') &&
    patientListJs.includes('data-action-add-record') &&
    patientListJs.includes('data-action-cancel'),
    'modal must have edit-info, add-record, and cancel actions'
  );
  assert.ok(
    patientListJs.includes('newVisitFrom='),
    'add-record action must link to new visit registration'
  );
});

test('v43.8: Navigation supports return to patient list after viewing or editing patient', () => {
  const patientListJs = read('public/patient-list.js');
  const appShellJs = read('public/app-shell.js');

  // Verify viewHref and editHref include from=patient-list
  assert.ok(
    patientListJs.includes("from:'patient-list'"),
    'view and edit URLs from patient list must pass from=patient-list'
  );

  // Verify app-shell provides breadcrumbs and return navigation to patient list
  assert.ok(
    appShellJs.includes("/patient-list") &&
    appShellJs.includes("params.get('from') === 'patient-list'"),
    'app-shell must render breadcrumb or return button back to patient list'
  );
});
