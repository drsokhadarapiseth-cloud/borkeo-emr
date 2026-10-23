import { randomUUID } from 'node:crypto';
export function ensureNpcaSchema(database) {
  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS npca_submissions (
      id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, visit_code TEXT NOT NULL UNIQUE,
      payload_hash TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL DEFAULT '{}', status INTEGER NOT NULL DEFAULT 3 CHECK(status IN(5,3,2,1)),
      visit_ulid TEXT, message TEXT NOT NULL DEFAULT '', errors TEXT NOT NULL DEFAULT '[]',
      submitted_at INTEGER, checked_at INTEGER, attempt INTEGER NOT NULL DEFAULT 0, submitted_by TEXT,
      queue_state TEXT NOT NULL DEFAULT 'blocked', next_attempt_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL, completion_hash TEXT, last_http INTEGER, lease_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS npca_codes (category TEXT NOT NULL, local_value TEXT NOT NULL, npca_code TEXT NOT NULL,
      updated_by TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY(category,local_value));
    CREATE TABLE IF NOT EXISTS npca_beneficiaries (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, card_number TEXT NOT NULL,
      beneficiary TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS npca_patient_links (patient_key TEXT PRIMARY KEY, spid TEXT NOT NULL, patient_code TEXT,
      cards TEXT NOT NULL, payment_type TEXT NOT NULL, eligible INTEGER NOT NULL, verified_at INTEGER NOT NULL, verified_by TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS npca_due ON npca_submissions(queue_state,next_attempt_at);
    CREATE TABLE IF NOT EXISTS npca_worker_lock (id INTEGER PRIMARY KEY CHECK(id=1), lease_until INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO npca_worker_lock(id) VALUES (1);
  `);
}
export function npcaAudit(database, action, { actorId = null, patientKey, visitCode, status, httpStatus } = {}) {
  database.audit({ id: randomUUID(), userId: actorId, action: 'NPCA_' + action,
    details: { ...(patientKey ? { patientKey } : {}), ...(visitCode ? { visitCode } : {}), ...(status !== undefined ? { status } : {}), ...(httpStatus !== undefined ? { httpStatus } : {}) }, occurredAt: Date.now() });
}
export function listSubmissions(database) {
  return database.sqlite.prepare(`SELECT id,patient_key,visit_code,status,visit_ulid,message,errors,submitted_at,checked_at,attempt,queue_state,updated_at FROM npca_submissions ORDER BY updated_at DESC LIMIT 500`).all()
    .map(row => ({ ...row, errors: JSON.parse(row.errors) }));
}
