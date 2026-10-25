import crypto from 'node:crypto';

function normalizeService(value) {
  const service = String(value || '').trim().toUpperCase();
  if (!['TRIAGE','OPD'].includes(service)) throw new Error('Queue service must be TRIAGE or OPD.');
  return service;
}

function normalizeCounter(value) {
  const counter = String(value || '').trim();
  if (!/^[0-9]{1,2}$/.test(counter)) throw new Error('Counter must be a number such as 1 or 2.');
  const n = Number(counter);
  if (n < 1 || n > 99) throw new Error('Counter must be between 1 and 99.');
  return String(n);
}

function jsonRecord(row) {
  try { return JSON.parse(row?.record_json || '{}'); } catch { return {}; }
}

export function ensureQueueBoardSchema(database) {
  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS queue_board_calls (
      id TEXT PRIMARY KEY,
      service TEXT NOT NULL CHECK (service IN ('TRIAGE','OPD')),
      counter TEXT NOT NULL,
      patient_key TEXT NOT NULL,
      queue_number INTEGER NOT NULL CHECK (queue_number > 0),
      called_at INTEGER NOT NULL,
      called_by TEXT NOT NULL REFERENCES users(id),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
    ) STRICT;
    CREATE INDEX IF NOT EXISTS queue_board_active_idx ON queue_board_calls(service, active, called_at DESC);
    CREATE TABLE IF NOT EXISTS queue_board_skips (
      id TEXT PRIMARY KEY,
      service TEXT NOT NULL CHECK (service IN ('TRIAGE','OPD')),
      patient_key TEXT NOT NULL,
      queue_number INTEGER NOT NULL CHECK (queue_number > 0),
      skipped_at INTEGER NOT NULL,
      skipped_by TEXT NOT NULL REFERENCES users(id),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      UNIQUE(service, patient_key)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS queue_board_skip_idx ON queue_board_skips(service, active, skipped_at DESC);
  `);
}

function clearActiveSkip(database, service, patientKey) {
  database.sqlite.prepare('UPDATE queue_board_skips SET active=0 WHERE service=? AND patient_key=? AND active=1').run(service, patientKey);
}

export function callQueuePatient(database, { service, counter, patientKey, userId, queueNumber: requestedQueueNumber, now = Date.now() }) {
  const normalizedService = normalizeService(service);
  const normalizedCounter = normalizeCounter(counter);
  const patient = database.findPatient(patientKey);
  if (!patient) throw new Error('Patient was not found.');
  let patientData = jsonRecord(patient);
  if (normalizedService === 'TRIAGE') {
    if (patientData['system:triageStatus'] === 'COMPLETED' || patient.service_mode) throw new Error('This patient has already completed Triage.');
  } else {
    if (patientData['system:triageStatus'] !== 'COMPLETED') throw new Error('Patient must complete Triage before being called to OPD.');
    if (String(patient.service_mode || '').toLowerCase() !== 'opd') throw new Error('Only OPD patients can be called to the OPD board.');
    if (!['OPD_PARACLINIC_ORDERING','PARACLINIC_REVIEW_PENDING','DOCTOR_READY','IN_CONSULTATION'].includes(patientData['system:workflowStage'])) throw new Error('OPD patient is not yet ready for the OPD queue.');
  }
  let queueNumber = Number(requestedQueueNumber || 0);
  if (!Number.isInteger(queueNumber) || queueNumber < 1) queueNumber = 0;
  if (!queueNumber) queueNumber = Number(patientData['system:registrationQueueNumber'] || patientData['scope:registration:id:registration_queue_number'] || 0);
  if (!Number.isInteger(queueNumber) || queueNumber < 1) {
    const row = database.sqlite.prepare('SELECT queue_number FROM opd_queue_entries WHERE patient_key=?').get(patientKey);
    queueNumber = Number(row?.queue_number || 0);
  }
  if (!Number.isInteger(queueNumber) || queueNumber < 1) throw new Error('This patient does not have a valid queue number.');
  database.sqlite.prepare('UPDATE queue_board_calls SET active=0 WHERE service=? AND counter=? AND active=1').run(normalizedService, normalizedCounter);
  clearActiveSkip(database, normalizedService, patientKey);
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO queue_board_calls
    (id,service,counter,patient_key,queue_number,called_at,called_by,active) VALUES (?,?,?,?,?,?,?,1)`)
    .run(id, normalizedService, normalizedCounter, patientKey, queueNumber, now, userId);
  return getActiveQueueCall(database, normalizedService);
}

export function skipQueuePatient(database, { service, patientKey, userId, queueNumber, now = Date.now() }) {
  const normalizedService = normalizeService(service);
  const patient = database.findPatient(patientKey);
  if (!patient) throw new Error('Patient was not found.');
  const data = jsonRecord(patient);
  let number = Number(queueNumber || data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0);
  if (!Number.isInteger(number) || number < 1) {
    // Older records can have a valid active call without a saved registration number.
    const call = database.sqlite.prepare(`SELECT queue_number FROM queue_board_calls
      WHERE service=? AND patient_key=? AND active=1 ORDER BY called_at DESC LIMIT 1`)
      .get(normalizedService, patientKey);
    number = Number(call?.queue_number || 0);
  }
  if (!Number.isInteger(number) || number < 1) throw new Error('This patient does not have a valid queue number.');
  const current = database.sqlite.prepare('SELECT id FROM queue_board_skips WHERE service=? AND patient_key=?').get(normalizedService, patientKey);
  if (current) {
    database.sqlite.prepare('UPDATE queue_board_skips SET queue_number=?, skipped_at=?, skipped_by=?, active=1 WHERE id=?')
      .run(number, now, userId, current.id);
  } else {
    database.sqlite.prepare(`INSERT INTO queue_board_skips
      (id,service,patient_key,queue_number,skipped_at,skipped_by,active) VALUES (?,?,?,?,?,?,1)`)
      .run(crypto.randomUUID(), normalizedService, patientKey, number, now, userId);
  }
  database.sqlite.prepare('UPDATE queue_board_calls SET active=0 WHERE service=? AND patient_key=? AND active=1').run(normalizedService, patientKey);
  return { service: normalizedService, patientKey, queueNumber: number, skippedAt: now };
}

export function clearQueueSkip(database, service, patientKey) {
  const normalizedService = normalizeService(service);
  database.sqlite.prepare('UPDATE queue_board_skips SET active=0 WHERE service=? AND patient_key=? AND active=1').run(normalizedService, patientKey);
}

export function listSkippedQueue(database, service) {
  const normalizedService = normalizeService(service);
  return database.sqlite.prepare(`SELECT s.*, p.full_name, p.health_id, p.case_number, p.sex, p.age
    FROM queue_board_skips s JOIN patient_records p ON p.patient_key=s.patient_key
    WHERE s.service=? AND s.active=1 AND (p.discharge_date IS NULL OR TRIM(p.discharge_date)='')
    ORDER BY s.skipped_at, s.queue_number`).all(normalizedService).map(row => ({
      id: row.id, service: row.service, patientKey: row.patient_key, queueNumber: row.queue_number,
      fullName: row.full_name, healthId: row.health_id, caseNumber: row.case_number, sex: row.sex, age: row.age,
      skippedAt: row.skipped_at,
    }));
}

export function getQueueDisplayRows(database, service, limit = 4) {
  const normalizedService = normalizeService(service);
  const activeCalls = listActiveQueueCalls(database).filter(call => call.service === normalizedService);
  const activePatientKeys = new Set(activeCalls.map(call => call.patientKey));
  const skippedPatientKeys = new Set(listSkippedQueue(database, normalizedService).map(item => item.patientKey));
  if (normalizedService === 'TRIAGE') {
    return database.sqlite.prepare(`SELECT patient_key, full_name, health_id, case_number, sex, age, record_json
      FROM patient_records WHERE discharge_date IS NULL ORDER BY created_at, patient_key`).all()
      .map(row => ({ row, data: jsonRecord(row) }))
      .filter(({ row, data }) => {
        const waiting = data['system:triageStatus'] === 'WAITING' || (!data['system:triageStatus'] && !row.department_code && !row.service_mode);
        return waiting && !activePatientKeys.has(row.patient_key) && !skippedPatientKeys.has(row.patient_key);
      })
      .map(({ row, data }) => ({
        patientKey: row.patient_key,
        queueNumber: Number(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0) || null,
        fullName: row.full_name, healthId: row.health_id, caseNumber: row.case_number, sex: row.sex, age: row.age,
        place: 'Triage',
        registeredAt: Number(data['system:registeredAt'] || row.created_at),
      }))
      .filter(row => row.queueNumber)
      .sort((a,b) => a.queueNumber-b.queueNumber || a.registeredAt-b.registeredAt)
      .slice(0, limit);
  }
  const rows = database.sqlite.prepare(`SELECT q.patient_key,q.queue_number,q.referred_at,p.full_name,p.health_id,p.case_number,p.sex,p.age
    FROM opd_queue_entries q JOIN patient_records p ON p.patient_key=q.patient_key
    WHERE q.queue_date=? AND q.status IN ('WAITING','IN_CONSULTATION') AND p.discharge_date IS NULL
    ORDER BY q.queue_number`).all(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  return rows.filter(row => !activePatientKeys.has(row.patient_key) && !skippedPatientKeys.has(row.patient_key)).slice(0, limit).map(row => ({
    patientKey: row.patient_key, queueNumber: row.queue_number, fullName: row.full_name, healthId: row.health_id,
    caseNumber: row.case_number, sex: row.sex, age: row.age, place: 'OPD', registeredAt: row.referred_at,
  }));
}

export function getActiveQueueCall(database, service) {
  const normalizedService = normalizeService(service);
  const row = database.sqlite.prepare(`SELECT c.*, p.full_name, p.health_id, p.case_number
    FROM queue_board_calls c JOIN patient_records p ON p.patient_key=c.patient_key
    WHERE c.service=? AND c.active=1 ORDER BY c.called_at DESC LIMIT 1`).get(normalizedService);
  if (!row) return null;
  return {
    id: row.id, service: row.service, counter: row.counter, patientKey: row.patient_key, queueNumber: row.queue_number,
    fullName: row.full_name, healthId: row.health_id, caseNumber: row.case_number, calledAt: row.called_at,
  };
}

export function listActiveQueueCalls(database) {
  return database.sqlite.prepare(`SELECT c.*, p.full_name, p.health_id, p.case_number
    FROM queue_board_calls c JOIN patient_records p ON p.patient_key=c.patient_key
    WHERE c.active=1 ORDER BY c.called_at DESC, c.service, CAST(c.counter AS INTEGER)`).all().map(row => ({
      id: row.id, service: row.service, counter: row.counter, patientKey: row.patient_key,
      queueNumber: row.queue_number, fullName: row.full_name, healthId: row.health_id, caseNumber: row.case_number, calledAt: row.called_at,
    }));
}

export function clearQueueCall(database, service, userId) {
  const normalizedService = normalizeService(service);
  database.sqlite.prepare('UPDATE queue_board_calls SET active=0 WHERE service=? AND active=1').run(normalizedService);
  return { service: normalizedService, cleared: true, clearedBy: userId };
}
