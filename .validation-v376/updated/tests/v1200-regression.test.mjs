import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.mjs';
import { seedDemoPatients } from '../scripts/seed-demo-patients.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

test('v12.0 seeds 10 initial demo patients with sex and all-new case type', () => {
  const database = openDatabase(':memory:');
  seedDemoPatients(database);
  const db = database.sqlite;
  try {
    const rows = db.prepare('SELECT case_number, health_id, sex, full_name, service_mode, record_json FROM patient_records ORDER BY created_at').all();
    const demos = rows.filter(row => {
      try { return JSON.parse(row.record_json || '{}')['system:demoPatient'] === 'true'; } catch { return false; }
    });
    assert.equal(demos.length, 10);
    for (const row of demos) {
      const data = JSON.parse(row.record_json || '{}');
      assert.ok(row.full_name);
      assert.ok(row.sex);
      assert.equal(row.service_mode, '');
      assert.equal(data['system:caseType'], 'new');
      assert.equal(data['scope:registration:id:emr_pmrs_case_new'], true);
      assert.equal(data['scope:registration:id:emr_pmrs_case_old'], false);
      assert.equal(data['system:triageStatus'], 'WAITING');
    }
  } finally { database.close(); }
});

test('v12.0 OPD form explicitly maps stored triage vitals', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'emr-patient-record.js'), 'utf8');
  assert.match(source, /scope:triage:id:p2_temp/);
  assert.match(source, /scope:triage:id:p2_bp_sys/);
  assert.match(source, /scope:triage:id:p2_bp_dia/);
  assert.match(source, /scope:triage:id:p2_pulse/);
  assert.match(source, /scope:triage:id:p2_resp/);
  assert.match(source, /'opd_temp'/);
  assert.match(source, /'opd_bp_sys'/);
  assert.match(source, /'opd_pulse'/);
});

test('v12.0 medicine type-ahead includes common oral and parenteral drugs', () => {
  const html = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');
  assert.match(html, /<datalist id="meds_list">/);
  assert.match(html, /Paracetamol 500 mg/);
  assert.match(html, /Ceftriaxone 1 g injection/);
  assert.match(html, /Hyoscine butylbromide 20 mg\/mL injection/);
  assert.match(html, /Enoxaparin 40 mg\/0\.4 mL injection/);
  assert.match(html, /list="meds_list" autocomplete="off"/);
});

test('v12.0 follow-up future date setting is Admin/Vice-Director-only and server validated', () => {
  const server = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, 'public', 'emr-inpatient-workflow.js'), 'utf8');
  assert.match(server, /pathname === '\/api\/system-settings\/followup'/);
  assert.match(server, /!\['ADMIN','VICE_DIRECTOR'\]\.includes\(sessionRole\(session\)\)/);
  assert.match(server, /Daily follow-up date\/time cannot be later/);
  assert.match(workflow, /allowFutureFollowup/);
  assert.match(workflow, /Allow future date\/time for testing/);
});

test('v12.0 discharge summary is stored as deterministic structured data', () => {
  const server = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, 'public', 'emr-inpatient-workflow.js'), 'utf8');
  assert.match(server, /RULE_BASED_EMR_SUMMARY/);
  assert.match(server, /system:ipdDischargeSummary/);
  assert.match(server, /Paraclinic findings/);
  assert.match(server, /Evolution/);
  assert.match(workflow, /Previous Patient Records/);
  assert.match(workflow, /Only previous OPD\/IPD encounters are shown/);
});
