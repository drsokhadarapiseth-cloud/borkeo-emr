// v41.7 - Record view log and scanned documents.
// - record_access_log: every opening, printing, export and document view of a
//   patient record (who, role, ward, when, what, IP). Repeated openings of the
//   same record by the same person within two minutes count once (pages reload
//   the record several times while they open).
// - patient_documents: scanned PDF / JPG / PNG files attached to a patient
//   record. The file type is checked from its first bytes, the size is
//   limited, files are kept outside the public folders, and removal keeps the
//   file and the row (who, when, why).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RECORD_LOG_VIEW_ROLES = new Set(['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']);
export const DOCUMENT_WRITE_ROLES = new Set(['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'DOCTOR', 'CHIEF_WARD', 'WARD_HEAD', 'NURSE', 'MIDWIFE', 'REGISTRATION']);
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_CATEGORIES = ['referral', 'lab', 'imaging', 'consent', 'identity', 'other'];
export const RECORD_ACTIONS = ['open', 'print', 'export', 'document'];
const OPEN_REPEAT_MS = 2 * 60_000;

export function ensureRecordAccessSchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS record_access_log (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, patient_name TEXT NOT NULL DEFAULT '',
    user_id TEXT, username TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '', ward_code TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '', occurred_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS record_access_patient_idx ON record_access_log(patient_key, occurred_at);
  CREATE INDEX IF NOT EXISTS record_access_user_idx ON record_access_log(user_id, occurred_at);
  CREATE INDEX IF NOT EXISTS record_access_time_idx ON record_access_log(occurred_at);
  CREATE TABLE IF NOT EXISTS patient_documents (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other',
    filename TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
    storage_path TEXT NOT NULL, uploaded_by_id TEXT NOT NULL, uploaded_by_name TEXT NOT NULL, uploaded_at INTEGER NOT NULL,
    removed_at INTEGER, removed_by_id TEXT, removed_by_name TEXT, remove_reason TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS patient_documents_patient_idx ON patient_documents(patient_key, uploaded_at);`);
}

const clip = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

// ip: the address string already computed by the server (requestIp).
export function logRecordAccess(database, { session, role = '', ward = '', patient, action, detail = '', ip = '', userAgent = '', now = Date.now() }) {
  if (!RECORD_ACTIONS.includes(action) || !patient?.patient_key) return false;
  const what = clip(detail, 200);
  if (action === 'open') {
    const recent = database.sqlite.prepare(`SELECT id FROM record_access_log WHERE patient_key=? AND user_id IS ? AND action='open' AND detail=? AND occurred_at>? LIMIT 1`)
      .get(patient.patient_key, session?.user_id ?? null, what, now - OPEN_REPEAT_MS);
    if (recent) return false;
  }
  database.sqlite.prepare(`INSERT INTO record_access_log (id,patient_key,patient_name,user_id,username,display_name,role,ward_code,action,detail,ip_address,user_agent,occurred_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(), patient.patient_key, clip(patient.full_name, 200), session?.user_id ?? null,
    clip(session?.username, 120), clip(session?.display_name, 200), clip(role, 40), clip(ward, 80), action, what, clip(ip, 80), clip(userAgent, 300), now);
  return true;
}

// Filters: patient (key or part of the name), user (part of username / name), action, from / to (YYYY-MM-DD).
export function listRecordAccess(database, filters = {}) {
  const where = [];
  const args = [];
  const patient = clip(filters.patient, 120);
  if (patient) { where.push('(patient_key = ? OR patient_key LIKE ? OR patient_name LIKE ?)'); args.push(patient, `%${patient}%`, `%${patient}%`); }
  const user = clip(filters.user, 120);
  if (user) { where.push('(username LIKE ? OR display_name LIKE ?)'); args.push(`%${user}%`, `%${user}%`); }
  if (RECORD_ACTIONS.includes(filters.action)) { where.push('action = ?'); args.push(filters.action); }
  const day = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? Date.parse(`${value}T00:00:00`) : null);
  const from = day(filters.from);
  const to = day(filters.to);
  if (from !== null && !Number.isNaN(from)) { where.push('occurred_at >= ?'); args.push(from); }
  if (to !== null && !Number.isNaN(to)) { where.push('occurred_at < ?'); args.push(to + 86_400_000); }
  const limit = Math.min(Math.max(Number(filters.limit) || 200, 1), 1000);
  return database.sqlite.prepare(`SELECT * FROM record_access_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY occurred_at DESC LIMIT ?`)
    .all(...args, limit).map((row) => ({
      id: row.id, patientKey: row.patient_key, patientName: row.patient_name, username: row.username, displayName: row.display_name,
      role: row.role, ward: row.ward_code, action: row.action, detail: row.detail, ip: row.ip_address, at: row.occurred_at,
    }));
}

// ---------------- Scanned documents ----------------
const SIGNATURES = [
  { type: 'application/pdf', extension: '.pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { type: 'image/jpeg', extension: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', extension: '.png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
];

export function documentKind(bytes, declaredType) {
  const kind = SIGNATURES.find((item) => item.test(bytes));
  if (!kind) return null;
  // The declared type must agree with the content (a renamed file is refused).
  if (declaredType && String(declaredType).toLowerCase() !== kind.type) return null;
  return kind;
}

const documentFromRow = (row) => ({
  id: row.id, title: row.title, category: row.category, filename: row.filename, contentType: row.content_type, sizeBytes: row.size_bytes,
  uploadedBy: row.uploaded_by_name, uploadedAt: row.uploaded_at, removedAt: row.removed_at, removedBy: row.removed_by_name, removeReason: row.remove_reason,
});

export function listDocuments(database, patientKey) {
  return database.sqlite.prepare('SELECT * FROM patient_documents WHERE patient_key=? ORDER BY uploaded_at DESC').all(patientKey).map(documentFromRow);
}

export function getDocument(database, id) {
  return database.sqlite.prepare('SELECT * FROM patient_documents WHERE id=?').get(String(id || '')) || null;
}

export function addDocument(database, { uploadRoot, patientKey, session, bytes, declaredType, filename, title, category }) {
  if (!bytes?.length) throw new Error('The file is empty.');
  if (bytes.length > DOCUMENT_MAX_BYTES) { const error = new Error('The file is larger than 10 MB.'); error.status = 413; throw error; }
  const kind = documentKind(bytes, declaredType);
  if (!kind) { const error = new Error('Only PDF, JPG and PNG files are accepted.'); error.status = 415; throw error; }
  const cleanTitle = clip(title, 200);
  if (!cleanTitle) throw new Error('A title is required.');
  const cleanCategory = DOCUMENT_CATEGORIES.includes(category) ? category : 'other';
  const id = crypto.randomUUID();
  // Folder per patient (hashed key: no patient name or key in the path).
  const folder = path.join(uploadRoot, crypto.createHash('sha256').update(patientKey).digest('hex').slice(0, 24));
  fs.mkdirSync(folder, { recursive: true });
  const storagePath = path.join(folder, `${id}${kind.extension}`);
  fs.writeFileSync(storagePath, bytes, { flag: 'wx' });
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const safeName = clip(filename, 160).replace(/[\\/:*?"<>|]/g, '_') || `document${kind.extension}`;
  database.sqlite.prepare(`INSERT INTO patient_documents (id,patient_key,title,category,filename,content_type,size_bytes,sha256,storage_path,uploaded_by_id,uploaded_by_name,uploaded_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, patientKey, cleanTitle, cleanCategory, safeName, kind.type, bytes.length, sha256, storagePath,
    session.user_id, session.display_name || session.username || '', Date.now());
  return documentFromRow(getDocument(database, id));
}

export function removeDocument(database, { patientKey, id, session, reason }) {
  const why = clip(reason, 300);
  if (!why) throw new Error('A reason is required.');
  const result = database.sqlite.prepare(`UPDATE patient_documents SET removed_at=?, removed_by_id=?, removed_by_name=?, remove_reason=?
    WHERE id=? AND patient_key=? AND removed_at IS NULL`).run(Date.now(), session.user_id, session.display_name || session.username || '', why, String(id || ''), patientKey);
  return result.changes === 1;
}

// Logs from a route context (session, role, ward, IP, browser).
export function logFromContext(ctx, patient, action, detail = '') {
  try {
    const { session, request, database, requestIp } = ctx;
    if (!session) return false;
    let role = '';
    try { role = ctx.requireContext(session); } catch { role = ''; }
    return logRecordAccess(database, {
      session, role, ward: session.active_ward_code || '', patient, action, detail,
      ip: requestIp ? requestIp(request) : '', userAgent: String(request?.headers?.['user-agent'] || ''),
    });
  } catch { return false; } // logging never blocks the record
}
