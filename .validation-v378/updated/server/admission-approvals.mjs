function roleLabel(role) {
  return ['ADMIN','VICE_DIRECTOR'].includes(role) ? 'Admin' : 'Director';
}

export function ensureAdmissionApprovalSchema(database) {
  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admission_approvals (
      patient_key TEXT NOT NULL,
      approver_role TEXT NOT NULL CHECK (approver_role IN ('ADMIN','DIRECTOR')),
      approved_by TEXT NOT NULL REFERENCES users(id),
      approved_name TEXT NOT NULL DEFAULT '',
      approved_at INTEGER NOT NULL,
      PRIMARY KEY (patient_key, approver_role)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS admission_approvals_role_idx
      ON admission_approvals(approver_role, approved_at DESC);
  `);
}

function rowToApproval(row) {
  if (!row) return null;
  return {
    role: row.approver_role,
    roleLabel: roleLabel(row.approver_role),
    approved: true,
    approvedBy: row.approved_by,
    approvedName: row.approved_name,
    approvedAt: row.approved_at,
  };
}

export function admissionApprovalFor(database, patientKey) {
  const rows = database.sqlite.prepare(`SELECT patient_key, approver_role, approved_by, approved_name, approved_at
    FROM admission_approvals WHERE patient_key=? ORDER BY approver_role`).all(patientKey);
  const map = new Map(rows.map(row => [row.approver_role, rowToApproval(row)]));
  return {
    patientKey,
    admin: map.get('ADMIN') || { role:'ADMIN', roleLabel:'Admin', approved:false },
    director: map.get('DIRECTOR') || { role:'DIRECTOR', roleLabel:'Director', approved:false },
    complete: Boolean(rows.length),
    singleApproval: true,
  };
}

function patientSummary(row) {
  return {
    patientKey: row.patient_key,
    caseNumber: row.case_number,
    healthId: row.health_id,
    fullName: row.full_name,
    sex: row.sex,
    age: row.age,
    departmentCode: row.department_code,
    departmentNameKh: row.department_name_kh,
    departmentNameEn: row.department_name_en,
    serviceMode: row.service_mode,
    entryDate: row.entry_date,
    dischargeDate: row.discharge_date,
  };
}

export function listPendingAdmissionApprovals(database, approverRole) {
  const role = approverRole === 'VICE_DIRECTOR' ? 'ADMIN' : String(approverRole || '').toUpperCase();
  if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) throw new Error('Only Admin or Director can view the approval list.');
  const rows = database.sqlite.prepare(`SELECT p.*
    FROM patient_records p
    LEFT JOIN admission_approvals a
      ON a.patient_key=p.patient_key
    WHERE p.service_mode='ipd' AND COALESCE(p.discharge_date,'')='' AND a.patient_key IS NULL
    ORDER BY CASE WHEN p.entry_date='' THEN 1 ELSE 0 END, p.entry_date ASC, p.created_at ASC`).all();
  return rows.map(row => ({ ...patientSummary(row), approval: admissionApprovalFor(database, row.patient_key) }));
}

export function approveAdmission(database, patientKey, role, userId) {
  const approverRole = role === 'VICE_DIRECTOR' ? 'ADMIN' : String(role || '').toUpperCase();
  if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(approverRole)) throw new Error('Only Admin or Director can approve an admission.');
  const patient = database.findPatient(patientKey);
  if (!patient) throw new Error('Patient was not found.');
  if (patient.service_mode !== 'ipd') throw new Error('Only IPD patients require admission approval.');
  const existing = database.sqlite.prepare('SELECT patient_key FROM admission_approvals WHERE patient_key=?').get(patientKey);
  if (existing) return admissionApprovalFor(database, patientKey);
  const displayName = database.sqlite.prepare('SELECT display_name FROM users WHERE id=?').get(userId)?.display_name || '';
  const now = Date.now();
  database.sqlite.prepare(`INSERT INTO admission_approvals
    (patient_key, approver_role, approved_by, approved_name, approved_at) VALUES (?,?,?,?,?)`)
    .run(patientKey, approverRole, userId, displayName, now);
  return admissionApprovalFor(database, patientKey);
}
