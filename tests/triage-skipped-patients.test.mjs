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

test('skip reuses the same patient and service active call when an older record has no saved queue number', () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', nodeEnv: 'test', npca: { enabled: false } });
  const db = app.database;
  try {
    resetAndSeedThirtyTriagePatients(db);
    const keys = db.sqlite.prepare('SELECT patient_key FROM patient_records ORDER BY patient_key LIMIT 3').all().map(row => row.patient_key);
    const userId = db.findUser('triage').id;
    keys.forEach(key => {
      const data = JSON.parse(db.findPatient(key).record_json);
      delete data['system:registrationQueueNumber'];
      delete data['scope:registration:id:registration_queue_number'];
      db.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(data), key);
    });
    const before = db.findPatient(keys[0]).record_json;
    callQueuePatient(db, { service: 'TRIAGE', counter: '1', patientKey: keys[0], userId, queueNumber: 73 });
    const skipped = skipQueuePatient(db, { service: 'TRIAGE', patientKey: keys[0], userId });
    assert.equal(skipped.queueNumber, 73);
    assert.equal(listSkippedQueue(db, 'TRIAGE').find(row => row.patientKey === keys[0]).queueNumber, 73);
    assert.equal(db.findPatient(keys[0]).record_json, before, 'fallback does not rewrite clinical or registration fields');
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM queue_board_calls WHERE patient_key=? AND active=1').get(keys[0]).n, 0);

    // The fallback must not borrow another patient, an inactive call, or another service.
    callQueuePatient(db, { service: 'TRIAGE', counter: '1', patientKey: keys[1], userId, queueNumber: 74 });
    db.sqlite.prepare('UPDATE queue_board_calls SET active=0 WHERE patient_key=?').run(keys[1]);
    callQueuePatient(db, { service: 'TRIAGE', counter: '2', patientKey: keys[2], userId, queueNumber: 75 });
    assert.throws(() => skipQueuePatient(db, { service: 'TRIAGE', patientKey: keys[1], userId }), /valid queue number/);
    db.sqlite.prepare("UPDATE queue_board_calls SET service='OPD',active=1 WHERE patient_key=?").run(keys[1]);
    assert.throws(() => skipQueuePatient(db, { service: 'TRIAGE', patientKey: keys[1], userId }), /valid queue number/);
    assert.equal(listSkippedQueue(db, 'TRIAGE').some(row => row.patientKey === keys[1]), false);
  } finally { db.close(); }
});
