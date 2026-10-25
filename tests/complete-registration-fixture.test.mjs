import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { buildCompleteRegistrationPatients, createCompleteRegistrationFixture, registrationEntryDate, syntheticPatientId } from '../scripts/create-complete-registration-fixture.mjs';

test('synthetic registration IDs follow the entry date in Cambodia and three-digit daily queue', () => {
  assert.equal(registrationEntryDate(Date.parse('2026-10-24T18:00:00Z')), '2026-10-25');
  assert.equal(syntheticPatientId('2026-10-25', 1), '160201-20261025-001');
  assert.equal(syntheticPatientId('2026-10-26', 1), '160201-20261026-001');
  assert.throws(() => syntheticPatientId('20261025', 1));
  assert.throws(() => syntheticPatientId('2026-02-30', 1));
  assert.throws(() => syntheticPatientId('2026-10-25', 0));
  assert.throws(() => syntheticPatientId('2026-10-25', 1000));
});

test('30 complete synthetic registrations use unique matching IDs and valid linked address fields', () => {
  const rows = buildCompleteRegistrationPatients(Date.parse('2026-10-24T18:00:00Z'));
  assert.equal(rows.length, 30);
  assert.equal(new Set(rows.map(row => row.patientKey)).size, 30);
  rows.forEach((row, index) => {
    const id = `160201-20261025-${String(index + 1).padStart(3, '0')}`;
    assert.equal(row.summary.healthId, id);
    assert.equal(row.summary.caseNumber, id);
    assert.equal(row.patientKey, `case:${id}`);
    assert.equal(row.data['system:registrationQueueNumber'], String(index + 1));
    assert.equal(row.data['system:syntheticRegistrationFixture'], true);
    for (const name of ['web_first_name', 'web_last_name', 'web_age', 'web_phone', 'web_caregiver_name', 'web_caregiver_phone', 'web_caregiver_relation', 'web_province', 'web_district', 'web_commune', 'web_village']) {
      assert.ok(String(row.data[`scope:registration:id:${name}`] || '').trim(), `${id}: ${name}`);
    }
    const data = row.data;
    assert.notEqual(data['scope:registration:id:web_sex_male'], data['scope:registration:id:web_sex_female']);
    assert.ok(Number(row.summary.age) > 0);
    assert.ok(data['scope:registration:id:web_village_code'].startsWith(data['scope:registration:id:web_commune_code']));
    assert.ok(data['scope:registration:id:web_commune_code'].startsWith(data['scope:registration:id:web_district_code']));
    assert.equal(data['system:triageStatus'], 'WAITING');
    assert.equal(Object.keys(data).some(key => key.startsWith('scope:triage:')), false);
  });
});

test('fixture generation always creates a separate new database', () => {
  const result = createCompleteRegistrationFixture({ now: Date.parse('2026-10-25T03:00:00Z') });
  assert.match(result.directory, /borkeo-synthetic-registration-/);
  assert.equal(result.syntheticOnly, true);
  const db = new DatabaseSync(result.databasePath, { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM patient_records').get().n, 30);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM patient_records WHERE health_id LIKE '160201-20261025-%'").get().n, 30);
  } finally { db.close(); }
});
