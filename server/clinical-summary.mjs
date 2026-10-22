// v41.0 - Long-term clinical summary shown in the patient banner:
// structured allergy record, active problem list and resuscitation status.
// Allergies and problems follow the patient across visits (by Health ID when
// there is one); resuscitation status belongs to the encounter. Nothing is
// deleted: removing an allergy or resolving a problem keeps the row with who
// and when.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const optionsFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'clinical-options.json');

export function clinicalOptions() {
  const parsed = JSON.parse(fs.readFileSync(optionsFile, 'utf8'));
  const list = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  return {
    allergyTypes: list(parsed.allergyTypes), allergySeverities: list(parsed.allergySeverities), resuscitationStatuses: list(parsed.resuscitationStatuses),
    // v41.3: WHO Surgical Safety Checklist sections and items (translation keys).
    whoChecklist: (Array.isArray(parsed.whoChecklist) ? parsed.whoChecklist : [])
      .map((group) => ({ section: String(group?.section || ''), items: list(group?.items) })).filter((group) => group.section && group.items.length),
    // v41.4: immediate newborn care items and birth vaccines (translation keys).
    newbornCare: list(parsed.newbornCare),
    birthVaccines: list(parsed.birthVaccines),
    // v41.6: critical result escalation (minutes without acknowledgement, ward roles told).
    criticalEscalation: {
      minutes: Number.isFinite(parsed.criticalEscalation?.minutes) && parsed.criticalEscalation.minutes > 0 ? parsed.criticalEscalation.minutes : 30,
      roles: list(parsed.criticalEscalation?.roles).length ? list(parsed.criticalEscalation.roles) : ['DOCTOR', 'CHIEF_WARD'],
    },
    // v41.6: Early Warning Score table (NEWS2, owner's choice), checked by a doctor.
    earlyWarning: parsed.earlyWarning && typeof parsed.earlyWarning === 'object' ? parsed.earlyWarning : null,
  };
}

// v41.1 - Display rules by age and sex (ages in completed years; limits inclusive).
// Hiding a section never deletes its saved values.
export function displayRules() {
  const rules = JSON.parse(fs.readFileSync(optionsFile, 'utf8')).displayRules || {};
  const age = (value) => (Number.isFinite(value) && value >= 0 && value <= 130 ? value : null);
  return {
    immunizationMaxAge: age(rules.immunizationMaxAge),
    substanceUseMinAge: age(rules.substanceUseMinAge),
    paediatricMaxAge: age(rules.paediatricMaxAge),
    headCircumferenceMaxAge: age(rules.headCircumferenceMaxAge),
    tetanusFemaleMinAge: age(rules.tetanusFemaleMinAge),
    tetanusFemaleMaxAge: age(rules.tetanusFemaleMaxAge),
    tetanusWhenPregnant: rules.tetanusWhenPregnant === true,
    obgynFemaleMinAge: age(rules.obgynFemaleMinAge),
    obgynYoungerWhenPregnant: rules.obgynYoungerWhenPregnant === true,
    obstetricWardCodes: Array.isArray(rules.obstetricWardCodes) ? rules.obstetricWardCodes.map(String).filter(Boolean) : [],
  };
}

// Who may change the long-term clinical summary (doctors; reading follows record access).
export const CLINICAL_SUMMARY_WRITE_ROLES = new Set(['DOCTOR']);

export function ensureClinicalSummarySchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS patient_allergies (
    id TEXT PRIMARY KEY, patient_ref TEXT NOT NULL, patient_key TEXT NOT NULL,
    allergy_type TEXT NOT NULL DEFAULT '', substance TEXT NOT NULL, reaction TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT '', noted_on TEXT NOT NULL DEFAULT '',
    recorded_by_id TEXT NOT NULL, recorded_by_name TEXT NOT NULL, recorded_role TEXT NOT NULL, created_at INTEGER NOT NULL,
    removed_at INTEGER, removed_by_id TEXT, removed_by_name TEXT, remove_reason TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS patient_allergies_ref_idx ON patient_allergies(patient_ref, removed_at);
  CREATE TABLE IF NOT EXISTS patient_problems (
    id TEXT PRIMARY KEY, patient_ref TEXT NOT NULL, patient_key TEXT NOT NULL,
    problem TEXT NOT NULL, icd10 TEXT NOT NULL DEFAULT '', noted_on TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','resolved')),
    recorded_by_id TEXT NOT NULL, recorded_by_name TEXT NOT NULL, created_at INTEGER NOT NULL,
    status_changed_at INTEGER, status_changed_by_id TEXT, status_changed_by_name TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS patient_problems_ref_idx ON patient_problems(patient_ref, status);
  CREATE TABLE IF NOT EXISTS patient_resuscitation_status (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, status TEXT NOT NULL,
    recorded_by_id TEXT NOT NULL, recorded_by_name TEXT NOT NULL, recorded_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS patient_resuscitation_key_idx ON patient_resuscitation_status(patient_key, recorded_at);`);
}

// Allergies and problems are kept per person: Health ID when known, otherwise the encounter.
export function patientRef(row) {
  const healthId = String(row?.health_id || '').trim();
  return healthId ? `health:${healthId}` : `key:${row?.patient_key || ''}`;
}

function text(value, max, label, required = false) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new Error(`${label} is required.`);
  if (result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`${label} is invalid.`);
  return result;
}

function day(value, label) {
  const result = text(value, 10, label);
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`)))) throw new Error(`${label} is invalid.`);
  return result;
}

function oneOf(value, allowed, label, required = false) {
  const result = text(value, 40, label, required);
  if (result && !allowed.includes(result)) throw new Error(`${label} is invalid.`);
  return result;
}

const editor = (session) => ({ id: session.user_id, name: session.display_name || session.username || '', role: String(session.activeRole || session.role || '') });

const allergyFromRow = (row) => ({
  id: row.id, allergyType: row.allergy_type, substance: row.substance, reaction: row.reaction, severity: row.severity,
  notedOn: row.noted_on, recordedBy: row.recorded_by_name, recordedAt: row.created_at,
});
const problemFromRow = (row) => ({
  id: row.id, problem: row.problem, icd10: row.icd10, notedOn: row.noted_on, status: row.status,
  recordedBy: row.recorded_by_name, recordedAt: row.created_at, statusChangedAt: row.status_changed_at, statusChangedBy: row.status_changed_by_name,
});

export function activeAllergies(database, row) {
  return database.sqlite.prepare(`SELECT * FROM patient_allergies WHERE patient_ref=? AND removed_at IS NULL ORDER BY created_at`)
    .all(patientRef(row)).map(allergyFromRow);
}

export function clinicalSummary(database, row) {
  const ref = patientRef(row);
  const problems = database.sqlite.prepare(`SELECT * FROM patient_problems WHERE patient_ref=? ORDER BY status='resolved', created_at`)
    .all(ref).map(problemFromRow);
  const resuscitation = database.sqlite.prepare(`SELECT * FROM patient_resuscitation_status WHERE patient_key=? ORDER BY recorded_at DESC LIMIT 1`)
    .get(row.patient_key);
  return {
    allergies: activeAllergies(database, row),
    problems,
    resuscitation: resuscitation ? { status: resuscitation.status, recordedBy: resuscitation.recorded_by_name, recordedAt: resuscitation.recorded_at } : null,
    options: clinicalOptions(),
  };
}

export function addAllergy(database, row, session, body) {
  const options = clinicalOptions();
  const by = editor(session);
  const values = {
    allergyType: oneOf(body?.allergyType, options.allergyTypes, 'Allergy type', true),
    substance: text(body?.substance, 200, 'Substance', true),
    reaction: text(body?.reaction, 500, 'Reaction'),
    severity: oneOf(body?.severity, options.allergySeverities, 'Severity'),
    notedOn: day(body?.notedOn, 'Date'),
  };
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO patient_allergies (id,patient_ref,patient_key,allergy_type,substance,reaction,severity,noted_on,recorded_by_id,recorded_by_name,recorded_role,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, patientRef(row), row.patient_key, values.allergyType, values.substance, values.reaction, values.severity, values.notedOn, by.id, by.name, by.role, Date.now());
  return { id, ...values };
}

export function removeAllergy(database, row, session, allergyId, reason) {
  const by = editor(session);
  const why = text(reason, 300, 'Reason', true);
  const result = database.sqlite.prepare(`UPDATE patient_allergies SET removed_at=?, removed_by_id=?, removed_by_name=?, remove_reason=?
    WHERE id=? AND patient_ref=? AND removed_at IS NULL`).run(Date.now(), by.id, by.name, why, String(allergyId || ''), patientRef(row));
  return result.changes === 1;
}

export function addProblem(database, row, session, body) {
  const by = editor(session);
  const values = {
    problem: text(body?.problem, 300, 'Problem', true),
    icd10: text(body?.icd10, 20, 'ICD-10').toUpperCase(),
    notedOn: day(body?.notedOn, 'Date'),
  };
  if (values.icd10 && !/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/.test(values.icd10)) throw new Error('ICD-10 is invalid.');
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO patient_problems (id,patient_ref,patient_key,problem,icd10,noted_on,status,recorded_by_id,recorded_by_name,created_at)
    VALUES (?,?,?,?,?,?,'active',?,?,?)`).run(id, patientRef(row), row.patient_key, values.problem, values.icd10, values.notedOn, by.id, by.name, Date.now());
  return { id, ...values, status: 'active' };
}

export function setProblemStatus(database, row, session, problemId, status) {
  const by = editor(session);
  const next = oneOf(status, ['active', 'resolved'], 'Status', true);
  const result = database.sqlite.prepare(`UPDATE patient_problems SET status=?, status_changed_at=?, status_changed_by_id=?, status_changed_by_name=?
    WHERE id=? AND patient_ref=? AND status<>?`).run(next, Date.now(), by.id, by.name, String(problemId || ''), patientRef(row), next);
  return result.changes === 1;
}

export function setResuscitationStatus(database, row, session, status) {
  const by = editor(session);
  const value = oneOf(status, clinicalOptions().resuscitationStatuses, 'Resuscitation status', true);
  database.sqlite.prepare(`INSERT INTO patient_resuscitation_status (id,patient_key,status,recorded_by_id,recorded_by_name,recorded_at) VALUES (?,?,?,?,?,?)`)
    .run(crypto.randomUUID(), row.patient_key, value, by.id, by.name, Date.now());
  return { status: value };
}

// The record's own drug-allergy fields (IPD past history): a tick box and a free
// text, saved under frozen position keys since v40.7.
export const RECORD_DRUG_ALLERGY_CHECK = 'scope:medical:auto:82';
export const RECORD_DRUG_ALLERGY_TEXT = 'scope:medical:auto:83';
// Words that mean "no allergy" (the Khmer word is the one the banner always used).
export const RECORD_NONE_WORDS = new Set(['គ្មាន', 'no', 'none', 'nil', 'nka', 'nkda', 'neg', 'negative', '-']);

// Summary used by the patient list (ward map bed popup) and the banner.
export function allergyAlert(allergies, data) {
  const freeText = String(data?.[RECORD_DRUG_ALLERGY_TEXT] || '').trim();
  const ticked = data?.[RECORD_DRUG_ALLERGY_CHECK] === true;
  const items = allergies.map((a) => ({ type: a.allergyType, substance: a.substance, severity: a.severity }));
  const freeTextIsNone = Boolean(freeText) && RECORD_NONE_WORDS.has(freeText.toLowerCase());
  const state = items.length || (freeText && !freeTextIsNone) || (ticked && !freeTextIsNone) ? 'allergy'
    : freeTextIsNone ? 'none' : 'not-recorded';
  return { state, items, freeText: freeTextIsNone ? '' : freeText, ticked };
}
