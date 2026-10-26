// v42.6 - Maternal services seen by the midwife (Registration -> Triage ->
// Cashier -> Midwife; vaccination is free and goes straight to the midwife):
// ANC with the official Ministry of Health ANC record (one record per
// pregnancy, linked to the Health ID), PNC, family planning, cervical cancer
// screening and vaccination. Safe abortion goes to the Gynecology ward.
// Everything here is additive: new tables only; old ANC forms are not changed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { ancStatus, DEFAULT_OPTIONS, gestationalAge, datingEdd } from '../public/anc-engine.mjs';
import { signatureSnapshot } from './esign.mjs';
import { createSystemMessage } from './messages.mjs';
import { listStock, syncMedicineStock } from './stock.mjs';
import { sameMedicineUnit } from './medicine-units.mjs';
import { medicineCatalogue } from './medicine-catalogue.mjs';
import { listOpdQueue, opdLocalDate } from './opd-queue.mjs';
import { cleanAncSupplemental } from './anc-legacy.mjs';

const readJson = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
let cachedChart = null, cachedSchedule = null, cachedLabels = null;
export const ancColourChart = () => (cachedChart ||= readJson('./catalogues/anc-color-chart.json'));
export const ancVisitSchedule = () => (cachedSchedule ||= readJson('./catalogues/anc-visit-schedule.json'));
export const ancRecordLabels = () => (cachedLabels ||= readJson('./catalogues/anc-record-labels.json'));

// Owner defaults (server/clinical-options.json "maternal"), read at each use so a change applies after saving the file.
export function maternalOptions() {
  let options = {};
  try { options = readJsonFresh('./clinical-options.json').maternal || {}; } catch { options = {}; }
  return {
    ...DEFAULT_OPTIONS,
    paidServiceCodes: ['anc', 'pnc', 'family-planning', 'cervix-screening'],
    freeServiceCodes: ['vaccination'],
    gynecologyOutpatientCodes: ['safe-abortion'],
    midwifeLabTests: ['HBSAG'],
    midwifeImaging: ['ULTRASOUND'],
    midwifeMedicines: ['Ferrous salt', 'Ferrous salt + folic acid', 'Folic acid', 'Mebendazole', 'Calcium'],
    ironPrescriptionMedicine: 'Ferrous salt + folic acid',
    tetanusVaccineName: 'Tetanus toxoid vaccine',
    taskCloseReasons: ['មិនមានតេស្ត', 'អ្នកជំងឺបដិសេធ', 'ធ្វើរួចនៅកន្លែងផ្សេង', 'ផ្សេងៗ'],
    cervicalResultWard: 'gynecology',
    cervicalResultRole: 'DOCTOR',
    referralSignRoles: ['DOCTOR', 'CHIEF_WARD'],
    referralSignWards: ['obstetric', 'gynecology'],
    ...options,
  };
}

function readJsonFresh(file) {
  return JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
}

const parse = (value) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
const role = (session) => String(session?.activeRole || session?.active_role || session?.role || '').toUpperCase();
const staffName = (session) => session?.display_name || session?.displayName || session?.username || '';
const code = (row) => String(row?.department_code || '').toLowerCase();

export function isMaternalService(row, options = maternalOptions()) {
  return String(row?.service_mode || '').toLowerCase() === 'opd'
    && [...options.paidServiceCodes, ...options.freeServiceCodes].includes(code(row));
}
export const isFreeMaternalService = (row, options = maternalOptions()) => String(row?.service_mode || '').toLowerCase() === 'opd' && options.freeServiceCodes.includes(code(row));
export const isGynecologyOutpatient = (row, options = maternalOptions()) => String(row?.service_mode || '').toLowerCase() === 'opd' && options.gynecologyOutpatientCodes.includes(code(row));
// Seen by the midwife or the Gynecology ward, not by the OPD doctor.
export const isNotOpdDoctorPatient = (row) => isMaternalService(row) || isGynecologyOutpatient(row);

// ---------------------------------------------------------------- schema
export function ensureMaternalSchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS anc_pregnancies (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, health_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('open','delivered','referred','closed')),
    record_json TEXT NOT NULL DEFAULT '{}', colour TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
    opened_at INTEGER NOT NULL, opened_by_id TEXT NOT NULL, opened_by_name TEXT NOT NULL,
    closed_at INTEGER, closed_by_name TEXT, close_reason TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS anc_pregnancies_health_idx ON anc_pregnancies(health_id, status);
  CREATE INDEX IF NOT EXISTS anc_pregnancies_patient_idx ON anc_pregnancies(patient_key, status);
  CREATE TABLE IF NOT EXISTS anc_visits (
    id TEXT PRIMARY KEY, pregnancy_id TEXT NOT NULL, patient_key TEXT NOT NULL, visit_date TEXT NOT NULL,
    ga_weeks REAL, schedule_visit INTEGER, data_json TEXT NOT NULL DEFAULT '{}', colour TEXT NOT NULL DEFAULT '',
    referred INTEGER NOT NULL DEFAULT 0, referral_json TEXT NOT NULL DEFAULT '{}',
    created_by_id TEXT NOT NULL, created_by_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE(pregnancy_id, patient_key, visit_date)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS anc_colour_history (
    id TEXT PRIMARY KEY, pregnancy_id TEXT NOT NULL, colour TEXT NOT NULL, reasons_json TEXT NOT NULL DEFAULT '[]',
    changed_at INTEGER NOT NULL, changed_by_name TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS vaccinations (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, health_id TEXT NOT NULL DEFAULT '', pregnancy_id TEXT NOT NULL DEFAULT '',
    vaccine_name TEXT NOT NULL, vaccine_label TEXT NOT NULL, cms_code TEXT NOT NULL DEFAULT '', dose_number INTEGER NOT NULL,
    given_date TEXT NOT NULL, batch_number TEXT NOT NULL DEFAULT '', injection_site TEXT NOT NULL DEFAULT '',
    next_appointment TEXT NOT NULL DEFAULT '', reaction TEXT NOT NULL DEFAULT '', quantity REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT '',
    stock_deducted INTEGER NOT NULL DEFAULT 0, given_by_id TEXT NOT NULL, given_by_name TEXT NOT NULL, created_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS vaccinations_health_idx ON vaccinations(health_id, given_date);
  CREATE TABLE IF NOT EXISTS cervical_screening_results (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, result TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', message_id TEXT NOT NULL DEFAULT '',
    recorded_by_id TEXT NOT NULL, recorded_by_name TEXT NOT NULL, recorded_at INTEGER NOT NULL
  ) STRICT;`);
}

// ---------------------------------------------------------------- access
// The midwife works in the Obstetric ward; she sees the maternal OPD services.
// Gynecology doctors see the safe-abortion outpatients.
export function canUseMaternalPatient(session, row, sessionWard) {
  const r = role(session);
  if (['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(r)) return true;
  if (r === 'MIDWIFE') return isMaternalService(row);
  if (['DOCTOR', 'CHIEF_WARD'].includes(r) && sessionWard === 'gynecology') return isGynecologyOutpatient(row);
  return false;
}

export function canSignReferral(session, sessionWard, options = maternalOptions()) {
  return options.referralSignRoles.includes(role(session)) && options.referralSignWards.includes(String(sessionWard || ''));
}

// ---------------------------------------------------------------- queue
// Today's midwife (or Gynecology outpatient) queue: paid services after the
// Cashier, vaccination at once (free).
export function maternalQueue(database, { date = opdLocalDate(), kind = 'midwife', paymentConfirmed }) {
  const options = maternalOptions();
  return listOpdQueue(database, date).filter((item) => {
    if (!['WAITING', 'IN_CONSULTATION'].includes(item.status) || item.transferredToIpdAt) return false;
    const row = database.findPatient(item.patientKey);
    if (!row || row.discharge_date) return false;
    if (kind === 'gynecology') return isGynecologyOutpatient(row, options) && paymentConfirmed(row);
    if (!isMaternalService(row, options)) return false;
    return isFreeMaternalService(row, options) || paymentConfirmed(row);
  }).map((item) => ({ ...item, form: formFor(item.departmentCode, item.patientKey) }));
}

export function formFor(departmentCode, patientKey) {
  const key = encodeURIComponent(patientKey);
  if (departmentCode === 'anc') return `/anc-record?patient=${key}`;
  if (departmentCode === 'vaccination') return `/vaccination?patient=${key}`;
  return `/emr?patient=${key}&view=opd`;
}

// ---------------------------------------------------------------- pregnancy record
function pregnancyFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, patientKey: row.patient_key, healthId: row.health_id, status: row.status, record: parse(row.record_json),
    colour: row.colour, version: row.version, openedAt: row.opened_at, openedBy: row.opened_by_name,
    closedAt: row.closed_at, closedBy: row.closed_by_name || '', closeReason: row.close_reason,
  };
}

// Patient keys of the same person (same Health ID): every visit of a pregnancy.
function samePersonKeys(database, row) {
  const keys = new Set([row.patient_key]);
  if (row.health_id) for (const other of database.sqlite.prepare('SELECT patient_key FROM patient_records WHERE health_id=?').all(row.health_id)) keys.add(other.patient_key);
  return [...keys];
}

export function findPregnancy(database, row, { openOnly = false } = {}) {
  if (!openOnly) {
    const linked = database.sqlite.prepare(`SELECT p.* FROM anc_pregnancies p
      WHERE p.patient_key=? OR EXISTS (SELECT 1 FROM anc_visits v WHERE v.pregnancy_id=p.id AND v.patient_key=?)
      ORDER BY p.opened_at DESC LIMIT 1`).get(row.patient_key, row.patient_key);
    if (linked) return pregnancyFromRow(linked);
  }
  const keys = samePersonKeys(database, row);
  const marks = keys.map(() => '?').join(',');
  const statusSql = openOnly ? "AND status='open'" : '';
  const found = database.sqlite.prepare(`SELECT * FROM anc_pregnancies WHERE (patient_key IN (${marks}) ${row.health_id ? 'OR health_id=?' : ''}) ${statusSql}
    ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, opened_at DESC LIMIT 1`).get(...keys, ...(row.health_id ? [row.health_id] : []));
  return pregnancyFromRow(found);
}

export function getPregnancy(database, id) {
  return pregnancyFromRow(database.sqlite.prepare('SELECT * FROM anc_pregnancies WHERE id=?').get(String(id || '')));
}

// Values imported from Registration and from the Triage of this visit.
export function importedValues(row) {
  const data = parse(row.record_json);
  const value = (key) => String(data[`scope:triage:id:${key}`] ?? data[`id:${key}`] ?? '').trim();
  const bpSys = value('p2_bp_sys'), bpDia = value('p2_bp_dia');
  return {
    name: row.full_name || '', dateOfBirth: row.date_of_birth || String(data['scope:registration:id:web_dob'] || ''), age: row.age || '',
    weightKg: value('p2_weight'), heightCm: value('p2_height'), bp: bpSys && bpDia ? `${bpSys}/${bpDia}` : '',
    pulse: value('p2_pulse'), temperature: value('p2_temp'), spo2: value('p2_spo2'),
  };
}

export function openPregnancy(database, row, session, today = opdLocalDate()) {
  const existing = findPregnancy(database, row, { openOnly: true });
  if (existing) return { pregnancy: existing, created: false };
  const imported = importedValues(row);
  const now = Date.now();
  const record = {
    identity: { name: imported.name, dateOfBirth: imported.dateOfBirth, age: imported.age, gravida: '', births: '', miscarriages: '', abortions: '' },
    heightCm: imported.heightCm, imported: { ...imported, at: today, patientKey: row.patient_key },
    previous: [], labs: [], ultrasounds: [], ticks: {}, tasks: {}, history: {},
  };
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO anc_pregnancies (id,patient_key,health_id,status,record_json,colour,version,opened_at,opened_by_id,opened_by_name,updated_at)
    VALUES (?,?,?,'open',?,'',1,?,?,?,?)`).run(id, row.patient_key, row.health_id || '', JSON.stringify(record), now, session.user_id, staffName(session), now);
  return { pregnancy: getPregnancy(database, id), created: true };
}

export function listVisits(database, pregnancyId) {
  return database.sqlite.prepare('SELECT * FROM anc_visits WHERE pregnancy_id=? ORDER BY visit_date, created_at').all(pregnancyId).map((row) => ({
    id: row.id, patientKey: row.patient_key, date: row.visit_date, gaWeeks: row.ga_weeks, scheduleVisit: row.schedule_visit,
    ...parse(row.data_json), colour: row.colour, referred: Boolean(row.referred), referral: parse(row.referral_json),
    createdBy: row.created_by_name, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

export function colourHistory(database, pregnancyId) {
  return database.sqlite.prepare('SELECT * FROM anc_colour_history WHERE pregnancy_id=? ORDER BY changed_at').all(pregnancyId).map((row) => ({
    colour: row.colour, reasons: parse(row.reasons_json), changedAt: row.changed_at, changedBy: row.changed_by_name,
  }));
}

// Tetanus vaccines of this pregnancy (visit table "Vaccination").
export function pregnancyVaccinations(database, pregnancy) {
  return database.sqlite.prepare('SELECT * FROM vaccinations WHERE pregnancy_id=? ORDER BY given_date').all(pregnancy.id).map(vaccinationFromRow);
}

// Released Laboratory and Imaging results count like the typed ones (colour, tasks).
export function recordWithResults(database, pregnancy) {
  const row = database.findPatient(pregnancy.patientKey);
  const released = row ? releasedResults(database, row) : { labs: [], ultrasounds: [] };
  return { ...pregnancy.record, labs: [...released.labs, ...(pregnancy.record.labs || [])], ultrasounds: [...released.ultrasounds, ...(pregnancy.record.ultrasounds || [])] };
}

export function statusFor(database, pregnancy, today = opdLocalDate()) {
  const visits = listVisits(database, pregnancy.id);
  return ancStatus({ chart: ancColourChart(), schedule: ancVisitSchedule(), record: recordWithResults(database, pregnancy), visits, today, options: maternalOptions(),
    vaccinations: pregnancyVaccinations(database, pregnancy) });
}

// Allowed medicines of the midwife (by list name), e.g. iron + folic acid.
export function midwifeMedicineAllowed(name, options = maternalOptions()) {
  const value = String(name || '').toLowerCase().replace(/^[a-z]{2}\d{4}(?:,\s*[a-z]{2}\d{4})*-/, '');
  return options.midwifeMedicines.some((allowed) => value === allowed.toLowerCase() || value.startsWith(`${allowed.toLowerCase()}-`));
}

// Recompute the colour; keep the history of every change (date, reasons, who).
function refreshColour(database, pregnancyId, session, today) {
  const pregnancy = getPregnancy(database, pregnancyId);
  const status = statusFor(database, pregnancy, today);
  if (status.colour !== pregnancy.colour) {
    database.sqlite.prepare('UPDATE anc_pregnancies SET colour=? WHERE id=?').run(status.colour, pregnancyId);
    database.sqlite.prepare('INSERT INTO anc_colour_history (id,pregnancy_id,colour,reasons_json,changed_at,changed_by_name) VALUES (?,?,?,?,?,?)')
      .run(crypto.randomUUID(), pregnancyId, status.colour, JSON.stringify(status.reasons.map((reason) => ({ key: reason.key, level: reason.level, kh: reason.kh }))), Date.now(), staffName(session));
  }
  return status;
}

const RECORD_KEYS = ['identity', 'lmp', 'ultrasoundEdd', 'ultrasoundDate', 'heightCm', 'prePregnancyWeightKg', 'prePregnancyWeightSource',
  'history', 'previous', 'labs', 'ultrasounds', 'ticks', 'imported'];

export function saveRecord(database, pregnancyId, session, body, today = opdLocalDate()) {
  const pregnancy = getPregnancy(database, pregnancyId);
  if (!pregnancy) return null;
  if (pregnancy.status !== 'open') throw Object.assign(new Error('This ANC record is closed.'), { status: 409 });
  if (body?.expectedVersion !== undefined && Number(body.expectedVersion) !== pregnancy.version) throw Object.assign(new Error('The ANC record was changed by someone else. Reload it.'), { status: 409 });
  const incoming = body?.record && typeof body.record === 'object' ? body.record : {};
  const record = { ...pregnancy.record };
  for (const key of RECORD_KEYS) if (Object.prototype.hasOwnProperty.call(incoming, key)) record[key] = incoming[key];
  const text = JSON.stringify(record);
  if (text.length > 400_000) throw new Error('The ANC record is too large.');
  database.sqlite.prepare('UPDATE anc_pregnancies SET record_json=?, version=version+1, updated_at=? WHERE id=?').run(text, Date.now(), pregnancyId);
  refreshColour(database, pregnancyId, session, today);
  return getPregnancy(database, pregnancyId);
}

const VISIT_KEYS = ['uh', 'fp', 'fhr', 'bp', 'pulse', 'temperature', 'spo2', 'weight', 'wp', 'proteinuria', 'glucosuria', 'varices', 'fer',
  'complaint', 'diagnosis', 'appointment', 'rapid', 'imported', 'notScheduled', 'legacyDetails', 'educationDone'];

// One visit per patient record (this day's encounter); the midwife name comes from the login.
export function saveVisit(database, pregnancyId, row, session, body, today = opdLocalDate()) {
  const pregnancy = getPregnancy(database, pregnancyId);
  if (!pregnancy) return null;
  if (pregnancy.status !== 'open') throw Object.assign(new Error('This ANC record is closed.'), { status: 409 });
  const status = statusFor(database, pregnancy, today);
  const data = {};
  for (const key of VISIT_KEYS) if (body?.visit && Object.prototype.hasOwnProperty.call(body.visit, key)) data[key] = body.visit[key];
  if (data.legacyDetails !== undefined) data.legacyDetails = cleanAncSupplemental(data.legacyDetails);
  data.staffName = staffName(session);
  const now = Date.now();
  const existing = database.sqlite.prepare('SELECT id FROM anc_visits WHERE pregnancy_id=? AND patient_key=? AND visit_date=?').get(pregnancyId, row.patient_key, today);
  if (existing) {
    database.sqlite.prepare('UPDATE anc_visits SET data_json=?, ga_weeks=?, schedule_visit=?, updated_at=? WHERE id=?')
      .run(JSON.stringify(data), status.ga ? status.ga.weeks : null, status.visit?.visit ?? null, now, existing.id);
  } else {
    database.sqlite.prepare(`INSERT INTO anc_visits (id,pregnancy_id,patient_key,visit_date,ga_weeks,schedule_visit,data_json,colour,created_by_id,created_by_name,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(), pregnancyId, row.patient_key, today, status.ga ? status.ga.weeks : null,
      status.visit?.visit ?? null, JSON.stringify(data), '', session.user_id, staffName(session), now, now);
  }
  const after = refreshColour(database, pregnancyId, session, today);
  database.sqlite.prepare('UPDATE anc_visits SET colour=? WHERE pregnancy_id=? AND patient_key=? AND visit_date=?').run(after.colour, pregnancyId, row.patient_key, today);
  return after;
}

// Task of the schedule: done, or closed undone with a reason (other: text).
export function updateTask(database, pregnancyId, session, body, options = maternalOptions()) {
  const pregnancy = getPregnancy(database, pregnancyId);
  if (!pregnancy) return null;
  const key = String(body?.key || '');
  if (!/^\d+:(records|lab|exam|ultrasound|care):\d+$/.test(key)) throw new Error('Task is invalid.');
  const action = String(body?.action || '');
  const tasks = { ...(pregnancy.record.tasks || {}) };
  if (action === 'reopen') delete tasks[key];
  else if (action === 'done') tasks[key] = { status: 'done', at: Date.now(), by: staffName(session) };
  else if (action === 'close') {
    const reason = String(body?.reason || '').trim();
    const other = options.taskCloseReasons[options.taskCloseReasons.length - 1];
    const reasonText = String(body?.reasonText || '').trim().slice(0, 500);
    if (!options.taskCloseReasons.includes(reason)) throw Object.assign(new Error('Choose the reason the task is not done.'), { code: 'reason-required' });
    if (reason === other && !reasonText) throw Object.assign(new Error('Write the reason.'), { code: 'reason-required' });
    tasks[key] = { status: 'closed', reason, reasonText, at: Date.now(), by: staffName(session) };
  } else throw new Error('Task action is invalid.');
  const record = { ...pregnancy.record, tasks };
  database.sqlite.prepare('UPDATE anc_pregnancies SET record_json=?, version=version+1, updated_at=? WHERE id=?').run(JSON.stringify(record), Date.now(), pregnancyId);
  return getPregnancy(database, pregnancyId);
}

// Red: the midwife asks for the referral to the provincial hospital (CPA3);
// a doctor of the Obstetric or Gynecology ward signs it.
export function requestReferral(database, pregnancyId, row, session, body, today = opdLocalDate()) {
  const pregnancy = getPregnancy(database, pregnancyId);
  if (!pregnancy) return null;
  const status = statusFor(database, pregnancy, today);
  if (status.colour !== 'red') throw Object.assign(new Error('Only a red pregnancy is referred to CPA3.'), { status: 409 });
  let visit = database.sqlite.prepare('SELECT * FROM anc_visits WHERE pregnancy_id=? ORDER BY visit_date DESC, created_at DESC LIMIT 1').get(pregnancyId);
  if (!visit) { saveVisit(database, pregnancyId, row, session, { visit: {} }, today); visit = database.sqlite.prepare('SELECT * FROM anc_visits WHERE pregnancy_id=? ORDER BY visit_date DESC LIMIT 1').get(pregnancyId); }
  const referral = {
    requestedAt: Date.now(), requestedBy: staffName(session), destination: 'CPA3',
    reasons: status.reasons.filter((reason) => reason.level === 'red').map((reason) => reason.kh),
    note: String(body?.note || '').slice(0, 2000), treatment: String(body?.treatment || '').slice(0, 2000), signed: null,
  };
  database.sqlite.prepare('UPDATE anc_visits SET referral_json=?, updated_at=? WHERE id=?').run(JSON.stringify(referral), Date.now(), visit.id);
  const message = createSystemMessage(database, {
    senderUserId: session.user_id, senderRole: role(session), senderWardCode: 'obstetric',
    destinationType: 'WARD', destinationCode: 'obstetric', destinationRole: 'DOCTOR',
    subject: `ANC · CPA3 · ${row.full_name || row.patient_key}`,
    body: `${row.full_name || ''} · ${row.health_id || row.case_number || ''} · /anc-record?patient=${encodeURIComponent(row.patient_key)}`,
    patientKey: row.patient_key,
  });
  return { visitId: visit.id, referral, messageId: message?.id || '' };
}

export function signReferral(database, pregnancyId, session, now = Date.now()) {
  const visit = database.sqlite.prepare("SELECT * FROM anc_visits WHERE pregnancy_id=? AND referral_json LIKE '%requestedAt%' ORDER BY visit_date DESC, created_at DESC LIMIT 1").get(pregnancyId);
  if (!visit) throw Object.assign(new Error('No referral is waiting for a signature.'), { status: 404 });
  const referral = parse(visit.referral_json);
  referral.signed = { ...signatureSnapshot(database, session, now), signedAt: now, signerRole: role(session) };
  database.sqlite.prepare('UPDATE anc_visits SET referral_json=?, referred=1, updated_at=? WHERE id=?').run(JSON.stringify(referral), now, visit.id);
  database.sqlite.prepare("UPDATE anc_pregnancies SET status='referred', closed_at=?, closed_by_name=?, close_reason='CPA3', updated_at=? WHERE id=?")
    .run(now, staffName(session), now, pregnancyId);
  return { visitId: visit.id, referral };
}

export function closePregnancy(database, pregnancyId, session, body) {
  const status = String(body?.status || '');
  if (!['delivered', 'closed'].includes(status)) throw new Error('Choose delivered or closed.');
  const reason = String(body?.reason || '').trim().slice(0, 500);
  if (status === 'closed' && !reason) throw new Error('Write the reason.');
  const result = database.sqlite.prepare("UPDATE anc_pregnancies SET status=?, closed_at=?, closed_by_name=?, close_reason=?, updated_at=? WHERE id=? AND status='open'")
    .run(status, Date.now(), staffName(session), reason, Date.now(), String(pregnancyId || ''));
  return result.changes === 1 ? getPregnancy(database, pregnancyId) : null;
}

// Released Laboratory results and Imaging reports of this person for the record tables.
// v47.8 - ANC orders are sent once per visit. A test (Laboratory code,
// ULTRASOUND, or a request to a doctor) counts as sent when it was sent today
// for this woman (any of her encounters), or when an earlier order of it still
// waits for its result. [{ code, kind: 'lab' | 'imaging' | 'doctor', date, pending }]
export function ancSentOrders(database, row, today = opdLocalDate()) {
  const keys = samePersonKeys(database, row);
  const marks = keys.map(() => '?').join(',');
  const sent = [];
  let orders = [];
  try {
    orders = database.sqlite.prepare(`SELECT modality, request_json, created_at, released_at FROM paraclinic_orders WHERE patient_key IN (${marks}) AND cancelled_at IS NULL`).all(...keys);
  } catch { orders = []; }
  for (const order of orders) {
    const date = opdLocalDate(Number(order.created_at));
    const pending = !order.released_at;
    if (!pending && date !== today) continue;
    const lab = order.modality === 'LAB';
    const codes = lab ? (parse(order.request_json).items || []).map((item) => String(item?.code || '').toUpperCase()) : [String(order.modality || '').toUpperCase()];
    for (const code of codes.filter(Boolean)) sent.push({ code, kind: lab ? 'lab' : 'imaging', date, pending });
  }
  let messages = [];
  try {
    messages = database.sqlite.prepare(`SELECT subject, created_at FROM staff_messages WHERE patient_key IN (${marks}) AND subject LIKE 'ANC · %' AND created_at >= ?`).all(...keys, Date.now() - 2 * 86400000);
  } catch { messages = []; }
  for (const message of messages) {
    const date = opdLocalDate(Number(message.created_at));
    const code = String(message.subject).split(' · ')[1] || '';
    if (date === today && code) sent.push({ code: code.toUpperCase(), kind: 'doctor', date, pending: false });
  }
  return sent;
}
export const ancOrderAlreadySent = (database, row, codes) => {
  const sent = ancSentOrders(database, row);
  return codes.map((code) => String(code || '').toUpperCase()).some((code) => sent.some((item) => item.code === code));
};

export function releasedResults(database, row) {
  const keys = samePersonKeys(database, row);
  const marks = keys.map(() => '?').join(',');
  let orders = [];
  try {
    orders = database.sqlite.prepare(`SELECT * FROM paraclinic_orders WHERE patient_key IN (${marks}) AND released_at IS NOT NULL AND cancelled_at IS NULL ORDER BY released_at`).all(...keys);
  } catch { orders = []; }
  const labs = [], ultrasounds = [];
  const LAB_FIELDS = { HIV: 'hiv', HIV_RDT: 'hiv', SYPHILIS_RDT: 'syphilis', VDRL: 'syphilis', RPR: 'syphilis', TPHA: 'syphilis', HBSAG: 'hbsag', HBV_RDT: 'hbsag', HCV: 'hcv', HCV_RDT: 'hcv', BLOOD_GROUP: 'group', HGB: 'hb', HCT: 'hct', PLT: 'plt', OGTT: 'glucose', GTT: 'glucose', GLU: 'glucose' };
  for (const order of orders) {
    const result = parse(order.result_json);
    const date = new Date(Number(order.released_at || order.updated_at || Date.now())).toISOString().slice(0, 10);
    if (order.modality === 'LAB') {
      const column = { date, source: 'lab', orderId: order.id };
      for (const item of result.items || []) {
        const field = LAB_FIELDS[String(item.code || '').toUpperCase()];
        if (field) column[field] = String(item.value ?? item.result ?? '');
        if (String(item.code || '').toUpperCase() === 'CBC') {
          for (const sub of item.components || item.parameters || []) {
            const name = String(sub.code || sub.name || '').toUpperCase();
            if (/^(HB|HGB)/.test(name)) column.hb = String(sub.value ?? '');
            if (/^(HCT|HEMATOCRIT)/.test(name)) column.hct = String(sub.value ?? '');
            if (/^PLT/.test(name)) column.plt = String(sub.value ?? '');
          }
        }
      }
      if (Object.keys(column).length > 3) labs.push(column);
    } else if (order.modality === 'ULTRASOUND') {
      const report = result.report || result;
      ultrasounds.push({ date, source: 'imaging', orderId: order.id, ga: report.ga || '', presentation: report.presentation || '', bpd: report.bpd || '',
        placenta: report.placenta || '', afi: report.afi || '', weight: report.weight || report.efw || '', edd: report.edd || '',
        other: String(report.conclusion || report.impression || report.findings || '').slice(0, 300) });
    }
  }
  return { labs, ultrasounds };
}

// ---------------------------------------------------------------- vaccination
function vaccinationFromRow(row) {
  return {
    id: row.id, patientKey: row.patient_key, healthId: row.health_id, pregnancyId: row.pregnancy_id, vaccineName: row.vaccine_name,
    vaccineLabel: row.vaccine_label, cmsCode: row.cms_code, doseNumber: row.dose_number, givenDate: row.given_date,
    batchNumber: row.batch_number, injectionSite: row.injection_site, nextAppointment: row.next_appointment, reaction: row.reaction,
    quantity: row.quantity, unit: row.unit, stockDeducted: Boolean(row.stock_deducted), givenBy: row.given_by_name, createdAt: row.created_at,
  };
}

export const vaccineLines = () => medicineCatalogue().items.filter((item) => item.vaccine);

export function vaccinationHistory(database, row) {
  const keys = samePersonKeys(database, row);
  const marks = keys.map(() => '?').join(',');
  return database.sqlite.prepare(`SELECT * FROM vaccinations WHERE patient_key IN (${marks}) ${row.health_id ? 'OR health_id=?' : ''} ORDER BY given_date, created_at`)
    .all(...keys, ...(row.health_id ? [row.health_id] : [])).map(vaccinationFromRow);
}

// Dose quantity from the strength ("0.5 mL in ..."): the amount given each time.
function defaultQuantity(item) {
  const match = /(\d+(?:[.,]\d+)?)\s*(mL|IU)\b/i.exec(String(item?.strength || ''));
  return match ? Number(match[1].replace(',', '.')) : 1;
}

export function recordVaccination(database, row, session, body, options = maternalOptions()) {
  const item = vaccineLines().find((line) => String(line.id) === String(body?.vaccineId));
  if (!item) throw new Error('Choose a vaccine from the list.');
  const doseNumber = Number(body?.doseNumber);
  if (!Number.isInteger(doseNumber) || doseNumber < 1 || doseNumber > 10) throw new Error('Dose number is invalid.');
  const givenDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.givenDate || '')) ? body.givenDate : opdLocalDate();
  const history = vaccinationHistory(database, row);
  if (history.some((entry) => entry.vaccineName === item.name && entry.doseNumber === doseNumber) && body?.confirmDuplicate !== true) {
    throw Object.assign(new Error('This vaccine and dose number were already given.'), { status: 409, duplicate: true });
  }
  const quantity = Number(body?.quantity) > 0 ? Number(body.quantity) : defaultQuantity(item);
  const unit = String(body?.unit || item.unit || '').slice(0, 20);
  const pregnancy = item.name === options.tetanusVaccineName ? findPregnancy(database, row, { openOnly: true }) : null;
  const id = crypto.randomUUID();
  const text = (value, max) => String(value || '').trim().slice(0, max);
  // Stock: the line of the medicine list (label) or the medicine name, same unit.
  const stockItem = listStock(database, 'medicine').find((entry) => [item.label, item.name].some((name) => entry.name.toLowerCase() === name.toLowerCase()) && sameMedicineUnit(entry.unit, unit));
  database.sqlite.prepare(`INSERT INTO vaccinations (id,patient_key,health_id,pregnancy_id,vaccine_name,vaccine_label,cms_code,dose_number,given_date,batch_number,injection_site,next_appointment,reaction,quantity,unit,stock_deducted,given_by_id,given_by_name,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, row.patient_key, row.health_id || '', pregnancy?.id || '', item.name, item.label, item.code || '',
    doseNumber, givenDate, text(body?.batchNumber, 80), text(body?.injectionSite, 80), /^\d{4}-\d{2}-\d{2}$/.test(String(body?.nextAppointment || '')) ? body.nextAppointment : '',
    text(body?.reaction, 500), quantity, unit, stockItem ? 1 : 0, session.user_id, staffName(session), Date.now());
  if (stockItem) syncMedicineStock(database, `VACCINATION:${id}`, [{ name: stockItem.name, unit: stockItem.unit, total: quantity }], session.user_id);
  return { vaccination: vaccinationFromRow(database.sqlite.prepare('SELECT * FROM vaccinations WHERE id=?').get(id)), pregnancyId: pregnancy?.id || '' };
}

// ---------------------------------------------------------------- cervical screening
// The midwife's result goes to the Gynecology doctors' inbox (existing staff
// messages); the doctor's acknowledgement completes it.
export function sendCervicalResult(database, row, session, body, options = maternalOptions()) {
  const result = String(body?.result || '').trim().slice(0, 200);
  if (!result) throw new Error('Enter the screening result.');
  const note = String(body?.note || '').trim().slice(0, 2000);
  const message = createSystemMessage(database, {
    senderUserId: session.user_id, senderRole: role(session), senderWardCode: 'obstetric',
    destinationType: 'WARD', destinationCode: options.cervicalResultWard, destinationRole: options.cervicalResultRole,
    subject: ['ពិនិត្យមហារីកមាត់ស្បូន', row.full_name || row.patient_key].join(' · '),
    body: `${row.full_name || ''} · ${row.health_id || row.case_number || ''}\n${result}${note ? `\n${note}` : ''}\n/emr?patient=${encodeURIComponent(row.patient_key)}`,
    patientKey: row.patient_key,
  });
  const id = crypto.randomUUID();
  database.sqlite.prepare('INSERT INTO cervical_screening_results (id,patient_key,result,note,message_id,recorded_by_id,recorded_by_name,recorded_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, row.patient_key, result, note, message?.id || '', session.user_id, staffName(session), Date.now());
  return { id, messageId: message?.id || '' };
}

export { gestationalAge, datingEdd };
