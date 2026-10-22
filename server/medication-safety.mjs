// v41.2 - Medication safety:
// - Medication Administration Record (MAR): one row per dose a nurse or
//   midwife records (given / held / refused) with the time, a reason or note,
//   and the recorder's e-signature snapshot. Rows are never deleted: a
//   correction voids the row with a reason, then a new row is recorded.
// - Prescribing warning overrides: the reason a doctor gives to continue past
//   an allergy, duplicate, interaction or maximum-dose warning (audited).
// - Drug interaction and maximum-dose tables: edited by administrators only and
//   empty until a doctor-approved list is entered (docs/clinical-review.md).
import crypto from 'node:crypto';
import { signatureSnapshot } from './esign.mjs';

export const MAR_WRITE_ROLES = new Set(['NURSE', 'MIDWIFE']);
export const MAR_STATUSES = ['given', 'held', 'refused'];
export const OVERRIDE_ROLES = new Set(['DOCTOR']);
export const DRUG_SAFETY_EDIT_ROLES = new Set(['ADMIN']);
export const DRUG_SAFETY_VIEW_ROLES = new Set(['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'DOCTOR', 'PHARMACY']);
export const WARNING_KINDS = ['allergy', 'duplicate', 'interaction', 'max-dose'];

export function ensureMedicationSafetySchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS medication_administrations (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, order_key TEXT NOT NULL,
    medicine TEXT NOT NULL, dose TEXT NOT NULL DEFAULT '', route TEXT NOT NULL DEFAULT '',
    scheduled_at TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('given','held','refused')),
    administered_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
    recorded_by_id TEXT NOT NULL, recorded_by_name TEXT NOT NULL, recorded_role TEXT NOT NULL,
    signature_json TEXT NOT NULL DEFAULT '{}', recorded_at INTEGER NOT NULL,
    voided_at INTEGER, voided_by_id TEXT, voided_by_name TEXT, void_reason TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS medication_administrations_patient_idx ON medication_administrations(patient_key, voided_at);
  CREATE TABLE IF NOT EXISTS prescribing_overrides (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, medicine TEXT NOT NULL,
    warnings_json TEXT NOT NULL, reason TEXT NOT NULL,
    recorded_by_id TEXT NOT NULL, recorded_by_name TEXT NOT NULL, recorded_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS prescribing_overrides_patient_idx ON prescribing_overrides(patient_key, recorded_at);
  CREATE TABLE IF NOT EXISTS drug_interactions (
    id TEXT PRIMARY KEY, drug_a TEXT NOT NULL, drug_b TEXT NOT NULL, severity TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '', updated_by_name TEXT NOT NULL, updated_at INTEGER NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS drug_max_doses (
    id TEXT PRIMARY KEY, drug TEXT NOT NULL, max_per_dose REAL, max_per_day REAL, unit TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '', updated_by_name TEXT NOT NULL, updated_at INTEGER NOT NULL
  ) STRICT;`);
}

function text(value, max, label, required = false) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new Error(`${label} is required.`);
  if (result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw new Error(`${label} is invalid.`);
  return result;
}

function isoTime(value, label, required = false) {
  const result = text(value, 40, label, required);
  if (result && Number.isNaN(Date.parse(result))) throw new Error(`${label} is invalid.`);
  return result ? new Date(result).toISOString() : '';
}

function amount(value, label) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0 || result > 1e6) throw new Error(`${label} is invalid.`);
  return result;
}

const staffName = (session) => session.display_name || session.username || '';

const administrationFromRow = (row) => ({
  id: row.id, orderKey: row.order_key, medicine: row.medicine, dose: row.dose, route: row.route,
  scheduledAt: row.scheduled_at, status: row.status, administeredAt: row.administered_at, note: row.note,
  recordedBy: row.recorded_by_name, recordedRole: row.recorded_role, recordedAt: row.recorded_at,
  signature: (() => { try { return JSON.parse(row.signature_json || '{}'); } catch { return {}; } })(),
  voidedAt: row.voided_at, voidedBy: row.voided_by_name, voidReason: row.void_reason,
});

export function listAdministrations(database, patientKey) {
  return database.sqlite.prepare('SELECT * FROM medication_administrations WHERE patient_key=? ORDER BY administered_at, recorded_at')
    .all(patientKey).map(administrationFromRow);
}

// Records one dose. One active row per order and scheduled time: recording the
// same dose again needs the old row to be voided first (a correction).
export function recordAdministration(database, patientKey, session, body) {
  const values = {
    orderKey: text(body?.orderKey, 300, 'Order', true),
    medicine: text(body?.medicine, 300, 'Medicine', true),
    dose: text(body?.dose, 200, 'Dose'),
    route: text(body?.route, 60, 'Route'),
    scheduledAt: isoTime(body?.scheduledAt, 'Scheduled time'),
    status: text(body?.status, 20, 'Status', true),
    administeredAt: isoTime(body?.administeredAt, 'Time', true),
    note: text(body?.note, 1000, 'Note'),
  };
  if (!MAR_STATUSES.includes(values.status)) throw new Error('Status is invalid.');
  if (values.status !== 'given' && !values.note) throw new Error('A reason is required when a dose is held or refused.');
  if (Date.parse(values.administeredAt) > Date.now() + 5 * 60 * 1000) throw new Error('The time cannot be in the future.');
  if (values.scheduledAt) {
    const active = database.sqlite.prepare('SELECT id FROM medication_administrations WHERE patient_key=? AND order_key=? AND scheduled_at=? AND voided_at IS NULL')
      .get(patientKey, values.orderKey, values.scheduledAt);
    if (active) { const error = new Error('This dose is already recorded. Correct the existing entry instead.'); error.status = 409; throw error; }
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  const role = String(session.activeRole || session.active_role || session.role || '').toUpperCase();
  const signature = signatureSnapshot(database, { ...session, active_role: role }, now);
  database.sqlite.prepare(`INSERT INTO medication_administrations (id,patient_key,order_key,medicine,dose,route,scheduled_at,status,administered_at,note,recorded_by_id,recorded_by_name,recorded_role,signature_json,recorded_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, patientKey, values.orderKey, values.medicine, values.dose, values.route, values.scheduledAt,
    values.status, values.administeredAt, values.note, session.user_id, staffName(session), role, JSON.stringify(signature), now);
  return { id, ...values };
}

export function voidAdministration(database, patientKey, session, id, reason) {
  const why = text(reason, 500, 'Reason', true);
  const result = database.sqlite.prepare(`UPDATE medication_administrations SET voided_at=?, voided_by_id=?, voided_by_name=?, void_reason=?
    WHERE id=? AND patient_key=? AND voided_at IS NULL`).run(Date.now(), session.user_id, staffName(session), why, String(id || ''), patientKey);
  return result.changes === 1;
}

export function recordOverride(database, patientKey, session, body) {
  const medicine = text(body?.medicine, 300, 'Medicine', true);
  const reason = text(body?.reason, 1000, 'Override reason', true);
  const warnings = Array.isArray(body?.warnings) ? body.warnings.slice(0, 20).map((warning) => ({
    kind: text(warning?.kind, 20, 'Warning'),
    detail: text(warning?.detail, 500, 'Warning detail'),
  })) : [];
  if (!warnings.length || warnings.some((warning) => !WARNING_KINDS.includes(warning.kind))) throw new Error('Warning is invalid.');
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO prescribing_overrides (id,patient_key,medicine,warnings_json,reason,recorded_by_id,recorded_by_name,recorded_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(id, patientKey, medicine, JSON.stringify(warnings), reason, session.user_id, staffName(session), Date.now());
  return { id, medicine, warnings, reason };
}

export function drugSafetyTables(database) {
  return {
    interactions: database.sqlite.prepare('SELECT * FROM drug_interactions ORDER BY drug_a, drug_b').all().map((row) => ({
      id: row.id, drugA: row.drug_a, drugB: row.drug_b, severity: row.severity, note: row.note, updatedBy: row.updated_by_name, updatedAt: row.updated_at,
    })),
    maxDoses: database.sqlite.prepare('SELECT * FROM drug_max_doses ORDER BY drug').all().map((row) => ({
      id: row.id, drug: row.drug, maxPerDose: row.max_per_dose, maxPerDay: row.max_per_day, unit: row.unit, note: row.note, updatedBy: row.updated_by_name, updatedAt: row.updated_at,
    })),
  };
}

export function addInteraction(database, session, body) {
  const values = {
    drugA: text(body?.drugA, 200, 'Medicine A', true), drugB: text(body?.drugB, 200, 'Medicine B', true),
    severity: text(body?.severity, 60, 'Severity'), note: text(body?.note, 1000, 'Note'),
  };
  if (values.drugA.toLowerCase() === values.drugB.toLowerCase()) throw new Error('Choose two different medicines.');
  const id = crypto.randomUUID();
  database.sqlite.prepare('INSERT INTO drug_interactions (id,drug_a,drug_b,severity,note,updated_by_name,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, values.drugA, values.drugB, values.severity, values.note, staffName(session), Date.now());
  return { id, ...values };
}

export function addMaxDose(database, session, body) {
  const values = {
    drug: text(body?.drug, 200, 'Medicine', true),
    maxPerDose: amount(body?.maxPerDose, 'Maximum per dose'), maxPerDay: amount(body?.maxPerDay, 'Maximum per day'),
    unit: text(body?.unit, 40, 'Unit'), note: text(body?.note, 1000, 'Note'),
  };
  if (values.maxPerDose === null && values.maxPerDay === null) throw new Error('Enter a maximum per dose or per day.');
  const id = crypto.randomUUID();
  database.sqlite.prepare('INSERT INTO drug_max_doses (id,drug,max_per_dose,max_per_day,unit,note,updated_by_name,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, values.drug, values.maxPerDose, values.maxPerDay, values.unit, values.note, staffName(session), Date.now());
  return { id, ...values };
}

export function removeDrugSafetyRow(database, table, id) {
  const name = table === 'interactions' ? 'drug_interactions' : table === 'max-doses' ? 'drug_max_doses' : '';
  if (!name) return false;
  return database.sqlite.prepare(`DELETE FROM ${name} WHERE id=?`).run(String(id || '')).changes === 1;
}
