// v41.3 - Consents, surgery, anaesthesia and transfusion forms.
// One entry per patient, form type and date (owner's rule: the same date uses
// the same form; another date gets a new form). Every save keeps the previous
// version in perioperative_form_revisions; nothing is deleted.
// Staff sign with their e-signature (signature slots); the patient or the
// representative signs on screen, by a thumbprint photo, or by a fingerprint
// scanner when one is connected (public/periop-forms.js).
import crypto from 'node:crypto';
import { signatureSnapshot } from './esign.mjs';

export const PERIOP_FORM_TYPES = [
  'procedureConsent', 'anaesthesiaConsent', 'transfusionConsent', 'refusal',
  'preopChecklist', 'operativeNote', 'anaesthesiaRecord', 'postopOrders', 'transfusionRecord',
  // v41.4: on the mother's record; the newborn record holds one section per baby.
  'newbornRecord', 'postnatalCare',
];
// Staff signature slots per form (who signs with their e-signature).
export const PERIOP_SIGNATURE_SLOTS = {
  procedureConsent: ['doctor'],
  anaesthesiaConsent: ['anaesthetist'],
  transfusionConsent: ['doctor'],
  refusal: ['doctor'],
  preopChecklist: ['surgeon', 'anaesthetist', 'nurse'],
  operativeNote: ['surgeon'],
  anaesthesiaRecord: ['anaesthetist'],
  postopOrders: ['doctor'],
  transfusionRecord: ['nurse', 'checker'],
  newbornRecord: ['midwife', 'doctor'],
  postnatalCare: ['midwife'],
};
// Forms with a patient / representative signature.
export const PERIOP_PATIENT_SIGNED = new Set(['procedureConsent', 'anaesthesiaConsent', 'transfusionConsent', 'refusal']);
export const PERIOP_WRITE_ROLES = new Set(['DOCTOR', 'NURSE', 'MIDWIFE', 'CHIEF_WARD']);
const MAX_IMAGE = 400_000; // characters of a data URL (signature drawing or thumbprint photo)

export function ensurePeriopSchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS perioperative_forms (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, form_type TEXT NOT NULL, form_date TEXT NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}', patient_sign_json TEXT NOT NULL DEFAULT '{}', signatures_json TEXT NOT NULL DEFAULT '{}',
    revision INTEGER NOT NULL DEFAULT 1,
    created_by_id TEXT NOT NULL, created_by_name TEXT NOT NULL, created_at INTEGER NOT NULL,
    updated_by_id TEXT NOT NULL, updated_by_name TEXT NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE(patient_key, form_type, form_date)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS perioperative_form_revisions (
    id TEXT PRIMARY KEY, form_id TEXT NOT NULL, revision INTEGER NOT NULL,
    data_json TEXT NOT NULL, patient_sign_json TEXT NOT NULL, signatures_json TEXT NOT NULL,
    saved_by_name TEXT NOT NULL, saved_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS perioperative_forms_patient_idx ON perioperative_forms(patient_key, form_type, form_date);`);
}

const parse = (text) => { try { return JSON.parse(text || '{}'); } catch { return {}; } };
const staffName = (session) => session.display_name || session.username || '';

function formFromRow(row) {
  return {
    id: row.id, formType: row.form_type, formDate: row.form_date, data: parse(row.data_json),
    patientSign: parse(row.patient_sign_json), signatures: parse(row.signatures_json), revision: row.revision,
    createdBy: row.created_by_name, createdAt: row.created_at, updatedBy: row.updated_by_name, updatedAt: row.updated_at,
  };
}

export function listPeriopForms(database, patientKey) {
  return database.sqlite.prepare('SELECT * FROM perioperative_forms WHERE patient_key=? ORDER BY form_date DESC, form_type').all(patientKey).map(formFromRow);
}

function day(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error('Date is invalid.');
  return text;
}

// Form fields: a flat object of short texts, numbers and booleans (the form layout lives in the page).
function cleanData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const result = {};
  for (const [key, value] of Object.entries(data).slice(0, 200)) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,60}$/.test(key)) throw new Error('Form field is invalid.');
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) result[key] = value;
    else if (typeof value === 'string') {
      if (value.length > 5000) throw new Error('A form field is too long.');
      result[key] = value;
    }
  }
  return result;
}

function image(value, label) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length > MAX_IMAGE || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(text)) throw new Error(`${label} is invalid.`);
  return text;
}

// Patient / representative signature: drawn signature, thumbprint photo, or scanner image.
function cleanPatientSign(sign) {
  if (!sign || typeof sign !== 'object') return {};
  const method = String(sign.method || '');
  if (!['', 'drawn', 'thumbprint', 'scanner', 'paper'].includes(method)) throw new Error('Signature method is invalid.');
  return {
    method,
    image: image(sign.image, 'Signature'),
    signerType: ['patient', 'representative'].includes(sign.signerType) ? sign.signerType : '',
    signerName: String(sign.signerName || '').slice(0, 200),
    relationship: String(sign.relationship || '').slice(0, 100),
    witnessName: String(sign.witnessName || '').slice(0, 200),
    signedAt: method && method !== 'paper' ? (Number(sign.signedAt) || Date.now()) : null,
  };
}

// Saves (creates or updates) the form of this type and date.
export function savePeriopForm(database, patientKey, session, body) {
  const formType = String(body?.formType || '');
  if (!PERIOP_FORM_TYPES.includes(formType)) throw new Error('Form type is invalid.');
  const formDate = day(body?.formDate);
  const data = cleanData(body?.data);
  const patientSign = PERIOP_PATIENT_SIGNED.has(formType) ? cleanPatientSign(body?.patientSign) : {};
  const now = Date.now();
  const existing = database.sqlite.prepare('SELECT * FROM perioperative_forms WHERE patient_key=? AND form_type=? AND form_date=?').get(patientKey, formType, formDate);
  if (existing) {
    if (body?.revision !== undefined && Number(body.revision) !== existing.revision) {
      const error = new Error('This form was changed by someone else. Reopen it before saving.'); error.status = 409; throw error;
    }
    // A patient signature, once given, can only be replaced by a new one, never removed.
    const previousSign = parse(existing.patient_sign_json);
    const sign = previousSign.method && !patientSign.method ? previousSign : patientSign;
    database.sqlite.prepare('INSERT INTO perioperative_form_revisions (id,form_id,revision,data_json,patient_sign_json,signatures_json,saved_by_name,saved_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), existing.id, existing.revision, existing.data_json, existing.patient_sign_json, existing.signatures_json, existing.updated_by_name, existing.updated_at);
    database.sqlite.prepare('UPDATE perioperative_forms SET data_json=?, patient_sign_json=?, revision=revision+1, updated_by_id=?, updated_by_name=?, updated_at=? WHERE id=?')
      .run(JSON.stringify(data), JSON.stringify(sign), session.user_id, staffName(session), now, existing.id);
    return existing.id;
  }
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO perioperative_forms (id,patient_key,form_type,form_date,data_json,patient_sign_json,signatures_json,revision,created_by_id,created_by_name,created_at,updated_by_id,updated_by_name,updated_at)
    VALUES (?,?,?,?,?,?,'{}',1,?,?,?,?,?,?)`).run(id, patientKey, formType, formDate, JSON.stringify(data), JSON.stringify(patientSign),
    session.user_id, staffName(session), now, session.user_id, staffName(session), now);
  return id;
}

// The signed-in staff member signs one slot with their own e-signature.
export function signPeriopForm(database, patientKey, session, formId, slot) {
  const row = database.sqlite.prepare('SELECT * FROM perioperative_forms WHERE id=? AND patient_key=?').get(String(formId || ''), patientKey);
  if (!row) return false;
  if (!(PERIOP_SIGNATURE_SLOTS[row.form_type] || []).includes(slot)) throw new Error('Signature slot is invalid.');
  const signatures = parse(row.signatures_json);
  const role = String(session.activeRole || session.active_role || '').toUpperCase();
  // revision: the form version that was signed; a later save shows "changed after signing".
  signatures[slot] = { ...signatureSnapshot(database, { ...session, active_role: role }, Date.now()), signedAt: Date.now(), revision: row.revision + 1 };
  database.sqlite.prepare('INSERT INTO perioperative_form_revisions (id,form_id,revision,data_json,patient_sign_json,signatures_json,saved_by_name,saved_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(crypto.randomUUID(), row.id, row.revision, row.data_json, row.patient_sign_json, row.signatures_json, row.updated_by_name, row.updated_at);
  database.sqlite.prepare('UPDATE perioperative_forms SET signatures_json=?, revision=revision+1, updated_by_id=?, updated_by_name=?, updated_at=? WHERE id=?')
    .run(JSON.stringify(signatures), session.user_id, staffName(session), Date.now(), row.id);
  return true;
}
