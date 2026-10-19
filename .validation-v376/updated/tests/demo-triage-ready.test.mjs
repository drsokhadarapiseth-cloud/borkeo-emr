import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { projectRoot } from '../server/config.mjs';
import { seedDemoPatients } from '../scripts/seed-demo-patients.mjs';

test('the ten freshly seeded demo patients are waiting in Triage with all required sample measurements', () => {
  const db = openDatabase(':memory:');
  seedDemoPatients(db);
  try {
    const patients = db.sqlite.prepare('SELECT * FROM patient_records').all()
      .filter(row => JSON.parse(row.record_json)['system:demoPatient'] === 'true');
    assert.equal(patients.length, 10);
    for (const row of patients) {
      const data = JSON.parse(row.record_json);
      assert.equal(data['system:triageStatus'], 'WAITING');
      assert.equal(data['system:workflowStage'], 'TRIAGE_WAITING');
      assert.ok(!data['system:triageCompletedAt']);
      for (const field of ['p2_temp', 'p2_bp_sys', 'p2_bp_dia', 'p2_pulse', 'p2_resp', 'p2_spo2', 'p2_weight', 'p2_height']) {
        assert.ok(Number(data[`scope:triage:id:${field}`]) > 0, `${row.full_name}: missing ${field}`);
      }
      assert.equal(db.sqlite.prepare('SELECT payment_type FROM patient_finance_profiles WHERE patient_key=?').get(row.patient_key).payment_type, 'DIRECT');
    }
  } finally { db.close(); }
});

test('demo restarts preserve entered values and completed assessments without duplicating patients', () => {
  const db = openDatabase(':memory:');
  try {
    seedDemoPatients(db);
    const rows = db.sqlite.prepare('SELECT patient_key, record_json FROM patient_records ORDER BY full_name').all();
    const complete = JSON.parse(rows[0].record_json);
    complete['system:triageStatus'] = 'COMPLETED';
    complete['system:workflowStage'] = 'WARD_WAITING';
    complete['scope:triage:id:p2_temp'] = '38.3';
    delete complete['scope:triage:id:p2_weight'];
    db.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(complete), rows[0].patient_key);
    const waiting = JSON.parse(rows[1].record_json);
    waiting['scope:triage:id:p2_pulse'] = '95';
    waiting['scope:triage:id:p2_height'] = '';
    db.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(waiting), rows[1].patient_key);
    const reseed = seedDemoPatients(db);
    assert.equal(reseed.created, 0);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM patient_records').get().n, 10);
    const preserved = JSON.parse(db.findPatient(rows[0].patient_key).record_json);
    assert.equal(preserved['system:triageStatus'], 'COMPLETED');
    assert.equal(preserved['system:workflowStage'], 'WARD_WAITING');
    assert.equal(preserved['scope:triage:id:p2_temp'], '38.3');
    assert.equal(preserved['scope:triage:id:p2_weight'], undefined);
    const refreshed = JSON.parse(db.findPatient(rows[1].patient_key).record_json);
    assert.equal(refreshed['scope:triage:id:p2_pulse'], '95');
    assert.ok(Number(refreshed['scope:triage:id:p2_height']) > 0);
  } finally { db.close(); }
});
