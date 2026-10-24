import { canAccessPatient, sessionRole, sessionWard, MATERNAL_OPD_CODES, GYNECOLOGY_OPD_CODES } from './access.mjs';

export const RECORD_MANAGEMENT = ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'];
export const isOpdHistoryReader = session => ['DOCTOR','CHIEF_WARD'].includes(sessionRole(session)) && sessionWard(session) === 'opd';
const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
const deny = message => { throw Object.assign(new Error(message), { status: 403 }); };

export function ensureEncounterAccessSchema(db) {
  db.sqlite.exec(`CREATE TABLE IF NOT EXISTS encounter_corrections (
    request_id TEXT PRIMARY KEY,patient_key TEXT NOT NULL,scope TEXT NOT NULL,
    requested_by TEXT NOT NULL,version INTEGER NOT NULL,used_at INTEGER
  ) STRICT;
  CREATE TABLE IF NOT EXISTS pharmacy_prescriptions (
    id TEXT PRIMARY KEY,
    patient_key TEXT,
    dispensed_at INTEGER
  );`);
}

export function encounterClosed(db, patient) {
  const data = parse(patient?.record_json);
  let received = false;
  try {
    received = Boolean(patient && db.sqlite.prepare('SELECT 1 FROM pharmacy_prescriptions WHERE patient_key=? AND dispensed_at IS NOT NULL LIMIT 1').get(patient.patient_key));
  } catch {
    received = false;
  }
  return {
    received: received || Boolean(data['system:opdDischarge']?.dispensedAt),
    discharged: Boolean(patient?.service_mode === 'ipd' && (patient.discharge_date || data['system:admissionStatus'] === 'discharged' || data['system:discharge']?.dischargeAt) ||
      patient?.service_mode === 'opd' && (received || data['system:opdDischarge']?.dispensedAt)),
  };
}

export function correctionGrant(db, actor, patient, scope) {
  return db.sqlite.prepare(`SELECT c.request_id FROM encounter_corrections c JOIN workflow_requests r ON r.id=c.request_id
    WHERE c.patient_key=? AND c.scope=? AND c.requested_by=? AND c.version=? AND c.used_at IS NULL AND r.status='APPROVED'
    ORDER BY r.reviewed_at DESC LIMIT 1`).get(patient.patient_key, scope, actor.user_id || actor.userId, patient.version)?.request_id || '';
}

export function encounterAccess(db, session, patient, requestedScope = '') {
  const role = sessionRole(session), ward = sessionWard(session);
  const management = RECORD_MANAGEMENT.includes(role);
  // v42.6: the midwife writes the OPD forms of the maternal services (PNC, family
  // planning, cervical screening); the Gynecology ward sees safe-abortion outpatients.
  const service = String(patient?.department_code || '').toLowerCase();
  const maternalMidwife = role === 'MIDWIFE' && patient?.service_mode === 'opd' && MATERNAL_OPD_CODES.has(service);
  const gynecologyOutpatient = ['DOCTOR','CHIEF_WARD'].includes(role) && ward === 'gynecology' && patient?.service_mode === 'opd' && GYNECOLOGY_OPD_CODES.has(service);
  let view = role === 'REGISTRATION' ? 'register' : role === 'TRIAGE' ? 'triage' :
    maternalMidwife || gynecologyOutpatient ? 'opd' :
    ['NURSE','MIDWIFE'].includes(role) ? 'nursing' : ward === 'opd' ? 'opd' : 'medical';
  const ownScope = view === 'register' ? 'registration' : view === 'triage' ? 'triage' : view === 'nursing' ? 'nursing' : 'medical';
  const scope = management ? (requestedScope || 'medical') : ownScope;
  if (management && requestedScope) view = { registration:'register',triage:'triage',nursing:'nursing',medical:patient?.service_mode === 'opd' ? 'opd' : 'medical' }[scope] || 'medical';
  const clinical = ['DOCTOR','CHIEF_WARD','NURSE','MIDWIFE'].includes(role);
  const permitted = management || ['REGISTRATION','TRIAGE'].includes(role) || clinical;
  const validScope = !requestedScope || ['registration','triage','medical','nursing'].includes(requestedScope);
  const canView = validScope && permitted && (!patient || canAccessPatient(db, session, patient));
  const state = encounterClosed(db, patient);
  const mismatch = clinical && patient && ['DOCTOR','CHIEF_WARD'].includes(role) && !gynecologyOutpatient &&
    (ward === 'opd' ? patient.service_mode !== 'opd' : patient.service_mode !== 'ipd');
  const clinicalScope = scope === 'medical' || scope === 'nursing';
  const grant = patient && clinicalScope && state.discharged ? correctionGrant(db, session, patient, scope) : '';
  const locked = scope === 'triage' && state.discharged || clinicalScope &&
    (state.discharged && !grant || patient?.service_mode === 'opd' && state.received && !grant);
  return { view, scope, canView: canView && !mismatch, canEdit: canView && !mismatch && !locked,
    requiresApproval: canView && !mismatch && clinicalScope && state.discharged && !grant,
    received: state.received, discharged: state.discharged, correctionId: grant,
    message: scope === 'triage' && state.discharged ? 'អ្នកជំងឺបានចេញពីពេទ្យ។ មិនអាចកែប្រែព័ត៌មានទ្រីយ៉ាបានទេ។' : mismatch ? 'អ្នកអាចកែប្រែតែកំណត់ត្រាក្នុងផ្នែករបស់អ្នកប៉ុណ្ណោះ។' :
      state.received && patient?.service_mode === 'opd' && clinicalScope ? 'អ្នកជំងឺបានទទួលឱសថរួចហើយ។ កំណត់ត្រាត្រូវបានបិទការកែប្រែ។' :
      state.discharged && clinicalScope && !grant ? 'អ្នកជំងឺបានចេញពីពេទ្យ។ សូមស្នើសុំការអនុម័តពីគណៈគ្រប់គ្រងមុនកែប្រែ។' : '' };
}

export function assertEncounterWrite(db, session, patient, scope) {
  const access = encounterAccess(db, session, patient, scope);
  if (!access.canEdit || (!RECORD_MANAGEMENT.includes(sessionRole(session)) && scope && scope !== access.scope)) deny(access.message || 'អ្នកមិនមានសិទ្ធិកែប្រែទម្រង់នេះទេ។');
  return access;
}

export function consumeCorrection(db, access) {
  if (!access?.correctionId) return;
  const result = db.sqlite.prepare('UPDATE encounter_corrections SET used_at=? WHERE request_id=? AND used_at IS NULL').run(Date.now(), access.correctionId);
  if (!result.changes) deny('ការអនុម័តនេះត្រូវបានប្រើរួចហើយ។ សូមស្នើសុំឡើងវិញ។');
  db.sqlite.prepare("UPDATE workflow_requests SET status='APPLIED' WHERE id=? AND status='APPROVED'").run(access.correctionId);
}
