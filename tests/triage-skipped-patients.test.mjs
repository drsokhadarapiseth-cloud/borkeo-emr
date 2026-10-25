import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmrServer } from '../server/server.mjs';
import { resetAndSeedThirtyTriagePatients } from '../scripts/seed-v301-thirty-triage-patients.mjs';
import { skipQueuePatient, listSkippedQueue, callQueuePatient } from '../server/queue-board.mjs';

test('skipped triage includes blank discharge dates, excludes discharged patients, and supports recall', () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', nodeEnv: 'test', npca: { enabled: false } });
  const db = app.database;
  try {
    resetAndSeedThirtyTriagePatients(db);
    const keys = db.sqlite.prepare('SELECT patient_key FROM patient_records ORDER BY patient_key LIMIT 3').all().map(row => row.patient_key);
    const userId = db.findUser('triage').id;
    const dates = ['', '  ', '2026-10-25'];
    keys.forEach((key, index) => {
      db.sqlite.prepare('UPDATE patient_records SET discharge_date=? WHERE patient_key=?').run(dates[index], key);
      skipQueuePatient(db, { service: 'TRIAGE', patientKey: key, userId, queueNumber: index + 1 });
    });
    assert.deepEqual(listSkippedQueue(db, 'TRIAGE').map(item => item.patientKey).sort(), keys.slice(0, 2).sort());
    const record = db.findPatient(keys[1]).record_json;
    callQueuePatient(db, { service: 'TRIAGE', counter: '1', patientKey: keys[1], userId, queueNumber: 2 });
    assert.deepEqual(listSkippedQueue(db, 'TRIAGE').map(item => item.patientKey), [keys[0]]);
    assert.equal(db.findPatient(keys[1]).record_json, record, 'recall preserves the saved triage record');
  } finally { db.close(); }
});
