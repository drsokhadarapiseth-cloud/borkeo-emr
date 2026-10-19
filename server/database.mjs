import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const USER_ROLES = Object.freeze([
  'ADMIN', 'REGISTRATION', 'TRIAGE', 'DOCTOR', 'NURSE', 'MIDWIFE',
  'LAB', 'IMAGING', 'PHARMACY', 'ACCOUNTANT', 'CLERK', 'DIRECTOR', 'VICE_DIRECTOR', 'CHIEF_WARD', 'WARD_HEAD',
]);

const LEGACY_STORAGE_ROLES = new Set(['ADMIN','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','LAB','IMAGING','PHARMACY']);
function storageRole(role) {
  const normalized = String(role || '').toUpperCase();
  return LEGACY_STORAGE_ROLES.has(normalized) ? normalized : 'REGISTRATION';
}

export const CLINICAL_FORM_TYPES = Object.freeze([
  'anc', 'pnc', 'spacing', 'abortion', 'safe', 'cervix',
]);

export function openDatabase(databasePath) {
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL; PRAGMA cache_size = -32000; PRAGMA temp_store = MEMORY;');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN (${USER_ROLES.map(role => `'${role}'`).join(',')})),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
      must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1)),
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0 CHECK (totp_enabled IN (0,1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS login_limits (
      limit_key TEXT PRIMARY KEY,
      failures INTEGER NOT NULL,
      window_started_at INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      subject_username TEXT,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      occurred_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS audit_user_idx ON audit_events(user_id, occurred_at);
    CREATE INDEX IF NOT EXISTS audit_action_idx ON audit_events(action, occurred_at);
    CREATE TABLE IF NOT EXISTS clinical_form_records (
      id TEXT PRIMARY KEY,
      patient_key TEXT NOT NULL,
      form_type TEXT NOT NULL CHECK (form_type IN (${CLINICAL_FORM_TYPES.map(type => `'${type}'`).join(',')})),
      patient_json TEXT NOT NULL DEFAULT '{}',
      form_data_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(patient_key, form_type)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS clinical_form_patient_idx
      ON clinical_form_records(patient_key, form_type);
    CREATE TABLE IF NOT EXISTS patient_records (
      id TEXT PRIMARY KEY,
      patient_key TEXT NOT NULL UNIQUE,
      case_number TEXT NOT NULL DEFAULT '',
      health_id TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      full_name TEXT NOT NULL DEFAULT '',
      sex TEXT NOT NULL DEFAULT '',
      age TEXT NOT NULL DEFAULT '',
      date_of_birth TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      equity_card TEXT NOT NULL DEFAULT '',
      payment_type TEXT NOT NULL DEFAULT '',
      department_code TEXT NOT NULL DEFAULT '',
      department_name_kh TEXT NOT NULL DEFAULT '',
      department_name_en TEXT NOT NULL DEFAULT '',
      service_mode TEXT NOT NULL DEFAULT '' CHECK (service_mode IN ('', 'opd', 'ipd')),
      entry_date TEXT NOT NULL DEFAULT '',
      discharge_date TEXT NOT NULL DEFAULT '',
      record_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS patient_records_dates_idx
      ON patient_records(entry_date, discharge_date);
    CREATE INDEX IF NOT EXISTS patient_records_department_idx
      ON patient_records(department_code, service_mode);
    CREATE TABLE IF NOT EXISTS hospital_state (
      state_key TEXT PRIMARY KEY,
      state_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      updated_by TEXT NOT NULL REFERENCES users(id),
      updated_at INTEGER NOT NULL
    ) STRICT;
  `);

  const ensureColumn = (table, column, definition) => {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  ensureColumn('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'totp_secret', 'TEXT');
  ensureColumn('users', 'totp_enabled', 'INTEGER NOT NULL DEFAULT 0');

  const statements = {
    insertUser: sqlite.prepare(`INSERT INTO users
      (id, username, display_name, password_hash, role, is_active, must_change_password, totp_secret, totp_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`),
    findUser: sqlite.prepare('SELECT * FROM users WHERE username = ?'),
    updateLastLogin: sqlite.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?'),
    insertSession: sqlite.prepare(`INSERT INTO sessions
      (token_hash, user_id, csrf_token, created_at, expires_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)`),
    findSession: sqlite.prepare(`SELECT s.token_hash, s.csrf_token, s.expires_at, s.last_seen_at,
      u.id AS user_id, u.username, u.display_name, u.role, u.is_active, u.must_change_password
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`),
    touchSession: sqlite.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?'),
    deleteSession: sqlite.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteExpiredSessions: sqlite.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    insertAudit: sqlite.prepare(`INSERT INTO audit_events
      (id, user_id, subject_username, action, ip_address, user_agent, details_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    findLimit: sqlite.prepare('SELECT * FROM login_limits WHERE limit_key = ?'),
    upsertLimit: sqlite.prepare(`INSERT INTO login_limits
      (limit_key, failures, window_started_at, blocked_until) VALUES (?, ?, ?, ?)
      ON CONFLICT(limit_key) DO UPDATE SET failures=excluded.failures,
      window_started_at=excluded.window_started_at, blocked_until=excluded.blocked_until`),
    deleteLimit: sqlite.prepare('DELETE FROM login_limits WHERE limit_key = ?'),
    findClinicalForm: sqlite.prepare(`SELECT id, patient_key, form_type, patient_json,
      form_data_json, version, created_by, updated_by, created_at, updated_at
      FROM clinical_form_records WHERE patient_key = ? AND form_type = ?`),
    upsertClinicalForm: sqlite.prepare(`INSERT INTO clinical_form_records
      (id, patient_key, form_type, patient_json, form_data_json, version,
       created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(patient_key, form_type) DO UPDATE SET
        patient_json = excluded.patient_json,
        form_data_json = excluded.form_data_json,
        version = clinical_form_records.version + 1,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
      RETURNING id, patient_key, form_type, patient_json, form_data_json,
        version, created_by, updated_by, created_at, updated_at`),
    listPatients: sqlite.prepare(`SELECT id, patient_key, case_number, health_id,
      first_name, last_name, full_name, sex, age, date_of_birth, phone,
      equity_card, payment_type, department_code, department_name_kh,
      department_name_en, service_mode, entry_date, discharge_date,
      record_json, version, created_at, updated_at
      FROM patient_records
      ORDER BY CASE WHEN entry_date = '' THEN 1 ELSE 0 END, entry_date DESC, updated_at DESC`),
    listPatientSummaries: sqlite.prepare(`SELECT id, patient_key, case_number, health_id,
      first_name, last_name, full_name, sex, age, date_of_birth, phone,
      equity_card, payment_type, department_code, department_name_kh,
      department_name_en, service_mode, entry_date, discharge_date,
      version, created_at, updated_at, record_json,
      json_extract(record_json, '$."system:registrationQueueNumber"') as queue_num_1,
      json_extract(record_json, '$."scope:registration:id:registration_queue_number"') as queue_num_2,
      json_extract(record_json, '$."system:admissionStatus"') as admission_status,
      json_extract(record_json, '$."system:triageStatus"') as triage_status,
      json_extract(record_json, '$."system:triageCompletedAt"') as triage_completed_at
      FROM patient_records
      ORDER BY CASE WHEN entry_date = '' THEN 1 ELSE 0 END, entry_date DESC, updated_at DESC`),
    listPatientListSummaries: sqlite.prepare(`SELECT id, patient_key, case_number, health_id,
      first_name, last_name, full_name, sex, age, date_of_birth, phone,
      equity_card, payment_type, department_code, department_name_kh,
      department_name_en, service_mode, entry_date, discharge_date,
      version, created_at, updated_at,
      json_remove(record_json, '$."scope:registration:id:web_patient_photo"',
        '$."scope:registration:id:patient_photo"', '$."system:patientPhoto"') AS record_json,
      json_extract(record_json, '$."system:registrationQueueNumber"') as queue_num_1,
      json_extract(record_json, '$."scope:registration:id:registration_queue_number"') as queue_num_2,
      json_extract(record_json, '$."system:admissionStatus"') as admission_status,
      json_extract(record_json, '$."system:triageStatus"') as triage_status,
      json_extract(record_json, '$."system:triageCompletedAt"') as triage_completed_at
      FROM patient_records
      ORDER BY CASE WHEN entry_date = '' THEN 1 ELSE 0 END, entry_date DESC, updated_at DESC`),
    findPatient: sqlite.prepare(`SELECT id, patient_key, case_number, health_id,
      first_name, last_name, full_name, sex, age, date_of_birth, phone,
      equity_card, payment_type, department_code, department_name_kh,
      department_name_en, service_mode, entry_date, discharge_date,
      record_json, version, created_at, updated_at
      FROM patient_records WHERE patient_key = ?`),
    upsertPatient: sqlite.prepare(`INSERT INTO patient_records
      (id, patient_key, case_number, health_id, first_name, last_name, full_name,
       sex, age, date_of_birth, phone, equity_card, payment_type,
       department_code, department_name_kh, department_name_en, service_mode,
       entry_date, discharge_date, record_json, version,
       created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(patient_key) DO UPDATE SET
        case_number = excluded.case_number,
        health_id = excluded.health_id,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        full_name = excluded.full_name,
        sex = excluded.sex,
        age = excluded.age,
        date_of_birth = excluded.date_of_birth,
        phone = excluded.phone,
        equity_card = excluded.equity_card,
        payment_type = excluded.payment_type,
        department_code = excluded.department_code,
        department_name_kh = excluded.department_name_kh,
        department_name_en = excluded.department_name_en,
        service_mode = excluded.service_mode,
        entry_date = excluded.entry_date,
        discharge_date = excluded.discharge_date,
        record_json = excluded.record_json,
        version = patient_records.version + 1,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
      RETURNING id, patient_key, case_number, health_id, first_name, last_name,
        full_name, sex, age, date_of_birth, phone, equity_card, payment_type,
        department_code, department_name_kh, department_name_en, service_mode,
        entry_date, discharge_date, record_json, version, created_at, updated_at`),
    updatePatientDates: sqlite.prepare(`UPDATE patient_records SET
      entry_date = ?, discharge_date = ?, version = version + 1,
      updated_by = ?, updated_at = ?
      WHERE patient_key = ?
      RETURNING id, patient_key, case_number, health_id, first_name, last_name,
        full_name, sex, age, date_of_birth, phone, equity_card, payment_type,
        department_code, department_name_kh, department_name_en, service_mode,
        entry_date, discharge_date, record_json, version, created_at, updated_at`),
    updatePatientAdmission: sqlite.prepare(`UPDATE patient_records SET
      department_code = ?, department_name_kh = ?, department_name_en = ?,
      service_mode = ?, discharge_date = ?, record_json = ?,
      version = version + 1, updated_by = ?, updated_at = ?
      WHERE patient_key = ?
      RETURNING id, patient_key, case_number, health_id, first_name, last_name,
        full_name, sex, age, date_of_birth, phone, equity_card, payment_type,
        department_code, department_name_kh, department_name_en, service_mode,
        entry_date, discharge_date, record_json, version, created_at, updated_at`),
    findHospitalState: sqlite.prepare(`SELECT state_key, state_json, version, updated_at
      FROM hospital_state WHERE state_key = ?`),
    upsertHospitalState: sqlite.prepare(`INSERT INTO hospital_state
      (state_key, state_json, version, updated_by, updated_at)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(state_key) DO UPDATE SET
        state_json = excluded.state_json,
        version = hospital_state.version + 1,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
      RETURNING state_key, state_json, version, updated_at`),
  };

  return {
    sqlite,
    createUser(user) {
      statements.insertUser.run(
        user.id, user.username, user.displayName, user.passwordHash, storageRole(user.role),
        user.mustChangePassword ? 1 : 0, user.totpSecret ?? null, user.totpEnabled ? 1 : 0,
        user.createdAt, user.createdAt,
      );
    },
    setUserMustChangePassword(userId, mustChange) {
      sqlite.prepare('UPDATE users SET must_change_password = ?, updated_at = ? WHERE id = ?')
        .run(mustChange ? 1 : 0, Date.now(), userId);
    },
    setUserTotp(userId, secret, enabled) {
      sqlite.prepare('UPDATE users SET totp_secret = ?, totp_enabled = ?, updated_at = ? WHERE id = ?')
        .run(secret, enabled ? 1 : 0, Date.now(), userId);
    },
    findUser(username) { return statements.findUser.get(username) ?? null; },
    markLogin(userId, now) { statements.updateLastLogin.run(now, now, userId); },
    createSession(session) {
      statements.insertSession.run(
        session.tokenHash, session.userId, session.csrfToken,
        session.createdAt, session.expiresAt, session.createdAt,
      );
    },
    findSession(hash) { return statements.findSession.get(hash) ?? null; },
    touchSession(hash, now) { statements.touchSession.run(now, hash); },
    deleteSession(hash) { statements.deleteSession.run(hash); },
    deleteExpiredSessions(now) { statements.deleteExpiredSessions.run(now); },
    audit(event) {
      statements.insertAudit.run(
        event.id, event.userId ?? null, event.subjectUsername ?? null, event.action,
        event.ipAddress ?? null, event.userAgent ?? null,
        JSON.stringify(event.details ?? {}), event.occurredAt,
      );
    },
    loginLimitStatus(key, now, windowMs) {
      const row = statements.findLimit.get(key);
      if (!row) return { blocked: false, retryAfterMs: 0 };
      if (row.blocked_until > now) return { blocked: true, retryAfterMs: row.blocked_until - now };
      if (now - row.window_started_at >= windowMs) {
        statements.deleteLimit.run(key);
        return { blocked: false, retryAfterMs: 0 };
      }
      return { blocked: false, retryAfterMs: 0 };
    },
    recordLoginFailure(key, now, windowMs, maxAttempts) {
      const previous = statements.findLimit.get(key);
      const inWindow = previous && now - previous.window_started_at < windowMs;
      const failures = inWindow ? previous.failures + 1 : 1;
      const started = inWindow ? previous.window_started_at : now;
      const blockedUntil = failures >= maxAttempts ? now + windowMs : 0;
      statements.upsertLimit.run(key, failures, started, blockedUntil);
    },
    clearLoginLimit(key) { statements.deleteLimit.run(key); },
    findClinicalForm(patientKey, formType) {
      return statements.findClinicalForm.get(patientKey, formType) ?? null;
    },
    upsertClinicalForm(record) {
      return statements.upsertClinicalForm.get(
        record.id, record.patientKey, record.formType,
        JSON.stringify(record.patient), JSON.stringify(record.data),
        record.userId, record.userId, record.savedAt, record.savedAt,
      );
    },
    listPatients() { return statements.listPatients.all(); },
    listPatientSummaries({ omitPhotos = false } = {}) {
      return (omitPhotos ? statements.listPatientListSummaries : statements.listPatientSummaries).all();
    },
    findPatient(patientKey) { return statements.findPatient.get(patientKey) ?? null; },
    upsertPatient(record) {
      const summary = record.summary;
      return statements.upsertPatient.get(
        record.id, record.patientKey, summary.caseNumber, summary.healthId,
        summary.firstName, summary.lastName, summary.fullName, summary.sex,
        summary.age, summary.dateOfBirth, summary.phone, summary.equityCard,
        summary.paymentType, summary.departmentCode, summary.departmentNameKh,
        summary.departmentNameEn, summary.serviceMode, summary.entryDate,
        summary.dischargeDate, JSON.stringify(record.data), record.userId,
        record.userId, record.savedAt, record.savedAt,
      );
    },
    updatePatientDates(record) {
      return statements.updatePatientDates.get(
        record.entryDate, record.dischargeDate, record.userId,
        record.savedAt, record.patientKey,
      ) ?? null;
    },
    updatePatientAdmission(record) {
      return statements.updatePatientAdmission.get(
        record.departmentCode, record.departmentNameKh, record.departmentNameEn,
        record.serviceMode, record.dischargeDate, JSON.stringify(record.data),
        record.userId, record.savedAt, record.patientKey,
      ) ?? null;
    },
    findHospitalState(stateKey = 'main') {
      return statements.findHospitalState.get(stateKey) ?? null;
    },
    upsertHospitalState(record) {
      return statements.upsertHospitalState.get(
        record.stateKey, JSON.stringify(record.state), record.userId, record.savedAt,
      );
    },
    checkIntegrity() {
      const rows = sqlite.prepare('PRAGMA integrity_check').all();
      const fkRows = sqlite.prepare('PRAGMA foreign_key_check').all();
      const errors = [];
      for (const row of rows) {
        const val = row.integrity_check || Object.values(row)[0];
        if (val !== 'ok') errors.push(`Integrity error: ${val}`);
      }
      for (const fk of fkRows) {
        errors.push(`Foreign key violation in table ${fk.table || fk.from || 'unknown'}`);
      }
      return { ok: errors.length === 0, errors };
    },
    backup(options = {}) {
      const now = new Date();
      const timestampStr = now.toISOString().replace(/[:.]/g, '-');
      const defaultDir = path.resolve(process.cwd(), 'data', 'backups');
      const backupDir = options.backupDirectory || defaultDir;
      fs.mkdirSync(backupDir, { recursive: true });
      const filename = options.filename || `borkeo-emr-backup-${timestampStr}.sqlite`;
      const targetPath = path.join(backupDir, filename);
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      const sqlitePath = targetPath.replace(/\\/g, '/');
      sqlite.exec(`VACUUM INTO '${sqlitePath}'`);
      return { ok: true, filepath: targetPath, filename, sizeBytes: fs.statSync(targetPath).size };
    },
    close() { sqlite.close(); },
  };
}
