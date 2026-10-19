import crypto from 'node:crypto';
import { USER_ROLES } from './database.mjs';

export const WARDS = Object.freeze([
  { code: 'emergency', nameKh: 'ផ្នែកសង្គ្រោះបន្ទាន់', nameEn: 'Emergency' },
  { code: 'icu', nameKh: 'ផ្នែកសង្គ្រោះបន្ទាន់កម្រិតធ្ងន់', nameEn: 'ICU' },
  { code: 'medicine', nameKh: 'ផ្នែកជំងឺទូទៅ', nameEn: 'Medicine' },
  { code: 'surgery', nameKh: 'ផ្នែកវះកាត់', nameEn: 'Surgery' },
  { code: 'pediatric', nameKh: 'ផ្នែកជំងឺកុមារ', nameEn: 'Pediatric' },
  { code: 'gynecology', nameKh: 'ផ្នែករោគស្ត្រី', nameEn: 'Gynecology' },
  { code: 'obstetric', nameKh: 'ផ្នែកសម្ភព', nameEn: 'Obstetric' },
  { code: 'tb', nameKh: 'ផ្នែកជំងឺរបេង', nameEn: 'Tuberculosis (TB)' },
  { code: 'ncu', nameKh: 'ផ្នែកទារកទើបកើត', nameEn: 'NCU' },
  { code: 'opd', nameKh: 'ផ្នែកពិគ្រោះក្រៅ', nameEn: 'Outpatient' },
]);

export const ROLES = USER_ROLES;
const ROLE_SET = new Set(USER_ROLES);
const WARD_SET = new Set(WARDS.map(item => item.code));
const WARD_REQUIRED = new Set(['DOCTOR', 'NURSE', 'MIDWIFE', 'CHIEF_WARD', 'WARD_HEAD']);

export const DEFAULT_ROLE_LABELS = Object.freeze({
  ADMIN: 'អ្នកគ្រប់គ្រងប្រព័ន្ធ',
  REGISTRATION: 'ចុះឈ្មោះ',
  TRIAGE: 'ផ្នែកទ្រីយ៉ា',
  DOCTOR: 'វេជ្ជបណ្ឌិត',
  NURSE: 'គិលានុបដ្ឋាក',
  MIDWIFE: 'ឆ្មប',
  LAB: 'មន្ទីរពិសោធន៍',
  IMAGING: 'រូបភាពវេជ្ជសាស្ត្រ',
  PHARMACY: 'ឱសថស្ថាន',
  ACCOUNTANT: 'គណនេយ្យករ',
  CLERK: 'បេឡា',
  DIRECTOR: 'នាយកមន្ទីរពេទ្យ',
  VICE_DIRECTOR: 'អនុប្រធានមន្ទីរពេទ្យ',
  CHIEF_WARD: 'ប្រធានផ្នែក',
  WARD_HEAD: 'នាយសាល',
});

export const IMAGING_GROUPS = Object.freeze([
  { id: 'RADIOLOGY', code: 'RADIOLOGY', nameKh: 'វិទ្យុសកម្មទូទៅ', nameEn: 'General Radiology', subtypes: ['XRAY', 'ULTRASOUND', 'CT', 'MRI'] },
  { id: 'CARDIOLOGY', code: 'CARDIOLOGY', nameKh: 'ឯកទេសបេះដូង', nameEn: 'Cardiology', subtypes: ['ECG', 'ECHOCARDIOLOGY'] },
  { id: 'NEUROLOGY', code: 'NEUROLOGY', nameKh: 'ឯកទេសប្រព័ន្ធប្រសាទ', nameEn: 'Neurology', subtypes: ['EEG'] },
  { id: 'GASTROENTEROLOGY', code: 'GASTROENTEROLOGY', nameKh: 'ឯកទេសក្រពះពោះវៀន', nameEn: 'Gastroenterology / Endoscopy', subtypes: ['FIBROSCOPY', 'COLOSCOPY'] },
  { id: 'ENT', code: 'ENT', nameKh: 'ឯកទេសត្រចៀក ច្រមុះ បំពង់ក', nameEn: 'ENT / Otorhinolaryngology', subtypes: ['OTOSCOPY', 'RHINOSCOPY', 'LARYNGOSCOPY'] },
  { id: 'PULMONOLOGY', code: 'PULMONOLOGY', nameKh: 'ឯកទេសផ្លូវដង្ហើម', nameEn: 'Pulmonology', subtypes: ['BRONCHOSCOPY'] },
]);

export const IMAGING_SUBTYPES = Object.freeze([
  'XRAY', 'ULTRASOUND', 'CT', 'MRI',
  'ECG', 'ECHOCARDIOLOGY', 'EEG',
  'FIBROSCOPY', 'COLOSCOPY',
  'OTOSCOPY', 'RHINOSCOPY', 'LARYNGOSCOPY',
  'BRONCHOSCOPY'
]);

export const IMAGING_SUBTYPE_DETAILS = Object.freeze([
  { code: 'XRAY', group: 'RADIOLOGY', nameKh: 'កាំរស្មីអ៊ិច', nameEn: 'X-Ray' },
  { code: 'ULTRASOUND', group: 'RADIOLOGY', nameKh: 'អេកូសាស្ត្រ', nameEn: 'Ultrasound' },
  { code: 'CT', group: 'RADIOLOGY', nameKh: 'ស៊ីធីស្កេន (CT)', nameEn: 'CT Scan' },
  { code: 'MRI', group: 'RADIOLOGY', nameKh: 'អឹមអរអាយ (MRI)', nameEn: 'MRI' },
  { code: 'ECG', group: 'CARDIOLOGY', nameKh: 'វាស់ចង្វាក់បេះដូង (ECG)', nameEn: 'ECG' },
  { code: 'ECHOCARDIOLOGY', group: 'CARDIOLOGY', nameKh: 'អេកូបេះដូង', nameEn: 'Echocardiology' },
  { code: 'EEG', group: 'NEUROLOGY', nameKh: 'វាស់រលកខួរក្បាល (EEG)', nameEn: 'EEG' },
  { code: 'FIBROSCOPY', group: 'GASTROENTEROLOGY', nameKh: 'ឆ្លុះក្រពះពោះវៀន (Fibroscopy)', nameEn: 'Fibroscopy (Upper GI)' },
  { code: 'COLOSCOPY', group: 'GASTROENTEROLOGY', nameKh: 'ឆ្លុះពោះវៀនធំ (Coloscopy)', nameEn: 'Coloscopy (Colonoscopy)' },
  { code: 'OTOSCOPY', group: 'ENT', nameKh: 'ឆ្លុះត្រចៀក (Otoscopy)', nameEn: 'Otoscopy' },
  { code: 'RHINOSCOPY', group: 'ENT', nameKh: 'ឆ្លុះច្រមុះ (Rhinoscopy)', nameEn: 'Rhinoscopy' },
  { code: 'LARYNGOSCOPY', group: 'ENT', nameKh: 'ឆ្លុះបំពង់សំឡេង (Laryngoscopy)', nameEn: 'Laryngoscopy' },
  { code: 'BRONCHOSCOPY', group: 'PULMONOLOGY', nameKh: 'ឆ្លុះទងសួត (Bronchoscopy)', nameEn: 'Bronchoscopy' },
]);

export const IMAGING_SUBTYPE_CODES = IMAGING_SUBTYPES;


function addColumnIfMissing(sqlite, table, column, definition) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function ensureAccessSchema(database) {
  const sqlite = database.sqlite;
  addColumnIfMissing(sqlite, 'sessions', 'active_role', 'TEXT');
  addColumnIfMissing(sqlite, 'sessions', 'active_ward_code', 'TEXT');
  addColumnIfMissing(sqlite, 'sessions', 'active_ward_name', 'TEXT');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS custom_roles (
      code TEXT PRIMARY KEY,
      label_kh TEXT NOT NULL,
      label_en TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS custom_wards (
      code TEXT PRIMARY KEY,
      name_kh TEXT NOT NULL,
      name_en TEXT NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, role)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles(role, user_id);
    CREATE TABLE IF NOT EXISTS user_wards (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ward_code TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, ward_code)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS user_wards_ward_idx ON user_wards(ward_code, user_id);
    CREATE TABLE IF NOT EXISTS user_imaging_subtypes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subtype TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, subtype)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS user_imaging_subtypes_idx ON user_imaging_subtypes(subtype, user_id);
  `);
  const now = Date.now();
  const users = sqlite.prepare('SELECT id, role FROM users').all();
  const insert = sqlite.prepare('INSERT OR IGNORE INTO user_roles (user_id, role, created_at) VALUES (?, ?, ?)');
  const roleCount = sqlite.prepare('SELECT COUNT(*) AS count FROM user_roles WHERE user_id = ?');
  users.forEach(user => {
    if (roleCount.get(user.id).count === 0 && ROLE_SET.has(user.role)) insert.run(user.id, user.role, now);
  });
}

export function listAllRoles(database) {
  const list = [...USER_ROLES];
  if (database) {
    try {
      const custom = database.sqlite.prepare('SELECT code FROM custom_roles ORDER BY created_at').all();
      custom.forEach(r => { if (!list.includes(r.code)) list.push(r.code); });
    } catch {}
  }
  return list;
}

export function allRoleLabels(database) {
  const map = { ...DEFAULT_ROLE_LABELS };
  if (database) {
    try {
      const custom = database.sqlite.prepare('SELECT code, label_kh FROM custom_roles').all();
      custom.forEach(r => { map[r.code] = r.label_kh; });
    } catch {}
  }
  return map;
}

export function listAllWards(database) {
  const wards = [...WARDS];
  if (database) {
    try {
      const custom = database.sqlite.prepare('SELECT code, name_kh, name_en FROM custom_wards ORDER BY created_at').all();
      custom.forEach(w => {
        if (!wards.some(item => item.code === w.code)) {
          wards.push({ code: w.code, nameKh: w.name_kh, nameEn: w.name_en });
        }
      });
    } catch {}
  }
  return wards;
}

export function createCustomRole(database, { code, labelKh, labelEn = '' }) {
  const cleanCode = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const cleanLabelKh = String(labelKh || '').trim();
  const cleanLabelEn = String(labelEn || '').trim();
  if (cleanCode.length < 2) throw new Error('Role code must be at least 2 characters.');
  if (!cleanLabelKh) throw new Error('Khmer label is required.');
  database.sqlite.prepare(`
    INSERT INTO custom_roles (code, label_kh, label_en, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET label_kh = excluded.label_kh, label_en = excluded.label_en
  `).run(cleanCode, cleanLabelKh, cleanLabelEn, Date.now());
  return { code: cleanCode, labelKh: cleanLabelKh, labelEn: cleanLabelEn };
}

export function createCustomWard(database, { code, nameKh, nameEn = '' }) {
  const cleanCode = String(code || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const cleanNameKh = String(nameKh || '').trim();
  const cleanNameEn = String(nameEn || '').trim() || cleanCode;
  if (cleanCode.length < 2) throw new Error('Ward/Service code must be at least 2 characters.');
  if (!cleanNameKh) throw new Error('Khmer ward name is required.');
  database.sqlite.prepare(`
    INSERT INTO custom_wards (code, name_kh, name_en, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name_kh = excluded.name_kh, name_en = excluded.name_en
  `).run(cleanCode, cleanNameKh, cleanNameEn, Date.now());
  return { code: cleanCode, nameKh: cleanNameKh, nameEn: cleanNameEn };
}

function normalizeRoleList(roles, database) {
  if (!Array.isArray(roles)) return [];
  const known = new Set(listAllRoles(database));
  return [...new Set(roles.map(value => String(value || '').trim().toUpperCase()).filter(value => known.has(value) || ROLE_SET.has(value)))];
}

function normalizeWardList(wards, database) {
  if (!Array.isArray(wards)) return [];
  const known = new Set(listAllWards(database).map(w => w.code));
  return [...new Set(wards.map(value => String(value || '').trim().toLowerCase()).filter(value => known.has(value) || WARD_SET.has(value)))];
}

export function roleRequiresWard(role) {
  return WARD_REQUIRED.has(String(role || '').toUpperCase());
}

export function roleWardAllowed(role, wardCode, database) {
  role = String(role || '').toUpperCase();
  wardCode = String(wardCode || '').toLowerCase();
  if (!roleRequiresWard(role)) return !wardCode;
  const known = new Set(listAllWards(database).map(w => w.code));
  if (!known.has(wardCode) && !WARD_SET.has(wardCode)) return false;
  if (role === 'MIDWIFE') return wardCode === 'obstetric';
  if (role === 'NURSE') return wardCode !== 'obstetric';
  if (role === 'CHIEF_WARD' || role === 'WARD_HEAD') return wardCode !== 'opd';
  return true;
}

export function getUserImagingSubtypes(database, userId) {
  try {
    return database.sqlite.prepare('SELECT subtype FROM user_imaging_subtypes WHERE user_id = ? ORDER BY subtype').all(userId).map(row => row.subtype);
  } catch {
    return [];
  }
}

export function setUserImagingSubtypes(database, userId, subtypes, now = Date.now()) {
  const clean = Array.isArray(subtypes)
    ? [...new Set(subtypes.map(s => String(s || '').trim().toUpperCase()).filter(s => IMAGING_SUBTYPE_CODES.includes(s)))]
    : [];
  try {
    database.sqlite.prepare('DELETE FROM user_imaging_subtypes WHERE user_id = ?').run(userId);
    const insert = database.sqlite.prepare('INSERT INTO user_imaging_subtypes (user_id, subtype, created_at) VALUES (?, ?, ?)');
    clean.forEach(st => insert.run(userId, st, now));
  } catch {}
  return clean;
}

export function getUserAccess(database, userId) {
  const roles = database.sqlite.prepare('SELECT role FROM user_roles WHERE user_id = ? ORDER BY role').all(userId).map(row => row.role);
  const wards = database.sqlite.prepare('SELECT ward_code FROM user_wards WHERE user_id = ? ORDER BY ward_code').all(userId).map(row => row.ward_code);
  const imagingSubtypes = getUserImagingSubtypes(database, userId);
  return { roles, wards, imagingSubtypes };
}

export function setUserAccess(database, userId, roles, wards, now = Date.now(), imagingSubtypes = undefined) {
  const normalizedRoles = normalizeRoleList(roles, database);
  const normalizedWards = normalizeWardList(wards, database);
  if (!normalizedRoles.length) throw new Error('At least one role is required.');
  for (const role of normalizedRoles) {
    if (roleRequiresWard(role) && !normalizedWards.some(ward => roleWardAllowed(role, ward, database))) {
      throw new Error(`${role} requires at least one compatible ward assignment.`);
    }
  }
  const transaction = database.sqlite.exec.bind(database.sqlite);
  transaction('BEGIN IMMEDIATE');
  try {
    database.sqlite.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
    database.sqlite.prepare('DELETE FROM user_wards WHERE user_id = ?').run(userId);
    const insertRole = database.sqlite.prepare('INSERT INTO user_roles (user_id, role, created_at) VALUES (?, ?, ?)');
    const insertWard = database.sqlite.prepare('INSERT INTO user_wards (user_id, ward_code, created_at) VALUES (?, ?, ?)');
    normalizedRoles.forEach(role => insertRole.run(userId, role, now));
    normalizedWards.forEach(ward => insertWard.run(userId, ward, now));
    const legacyRole = normalizedRoles.find(role => ['ADMIN','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','LAB','IMAGING','PHARMACY'].includes(role)) || 'REGISTRATION';
    database.sqlite.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(legacyRole, now, userId);
    if (imagingSubtypes !== undefined) {
      database.sqlite.prepare('DELETE FROM user_imaging_subtypes WHERE user_id = ?').run(userId);
      const cleanSubtypes = Array.isArray(imagingSubtypes)
        ? [...new Set(imagingSubtypes.map(s => String(s || '').trim().toUpperCase()).filter(s => IMAGING_SUBTYPE_CODES.includes(s)))]
        : [];
      const insertSubtype = database.sqlite.prepare('INSERT INTO user_imaging_subtypes (user_id, subtype, created_at) VALUES (?, ?, ?)');
      cleanSubtypes.forEach(st => insertSubtype.run(userId, st, now));
    }
    database.sqlite.exec('COMMIT');
  } catch (error) {
    try { database.sqlite.exec('ROLLBACK'); } catch {}
    throw error;
  }
  return { roles: normalizedRoles, wards: normalizedWards, imagingSubtypes: getUserImagingSubtypes(database, userId) };
}

export function wardInfo(code, database) {
  const norm = String(code || '').trim().toLowerCase();
  const known = WARDS.find(item => item.code === norm);
  if (known) return known;
  if (database) {
    try {
      const row = database.sqlite.prepare('SELECT code, name_kh, name_en FROM custom_wards WHERE code = ?').get(norm);
      if (row) return { code: row.code, nameKh: row.name_kh, nameEn: row.name_en };
    } catch {}
  }
  return null;
}

export function validContexts(access) {
  const result = [];
  access.roles.forEach(role => {
    if (!roleRequiresWard(role)) {
      result.push({ role, wardCode: '', wardName: '' });
      return;
    }
    access.wards.forEach(wardCode => {
      if (!roleWardAllowed(role, wardCode)) return;
      const ward = wardInfo(wardCode);
      result.push({ role, wardCode, wardName: ward?.nameEn || wardCode });
    });
  });
  return result;
}

export function defaultContext(access) {
  const contexts = validContexts(access);
  // Multi-role administrators start in the admin dashboard and can use the
  // existing context switcher to visit any of their assigned wards.
  if (access.roles.includes('ADMIN')) return contexts.find(context => ['ADMIN','VICE_DIRECTOR'].includes(context.role)) || null;
  return contexts.length === 1 ? contexts[0] : null;
}

export function readSessionContext(database, tokenHash) {
  const row = database.sqlite.prepare(`SELECT active_role, active_ward_code, active_ward_name
    FROM sessions WHERE token_hash = ?`).get(tokenHash);
  return row || { active_role: null, active_ward_code: null, active_ward_name: null };
}

export function setSessionContext(database, tokenHash, userId, role, wardCode = '') {
  const access = getUserAccess(database, userId);
  const normalizedRole = String(role || '').trim().toUpperCase();
  const normalizedWard = String(wardCode || '').trim().toLowerCase();
  if (!access.roles.includes(normalizedRole)) throw new Error('This role is not assigned to this account.');
  if (roleRequiresWard(normalizedRole)) {
    if (!access.wards.includes(normalizedWard) || !roleWardAllowed(normalizedRole, normalizedWard)) {
      throw new Error('This ward is not available for the selected role.');
    }
  } else if (normalizedWard) {
    throw new Error('The selected role does not use a ward context.');
  }
  const ward = normalizedWard ? wardInfo(normalizedWard) : null;
  database.sqlite.prepare(`UPDATE sessions SET active_role = ?, active_ward_code = ?, active_ward_name = ?
    WHERE token_hash = ? AND user_id = ?`).run(
      normalizedRole, normalizedWard || null, ward?.nameEn || null, tokenHash, userId,
    );
  return { role: normalizedRole, wardCode: normalizedWard, wardName: ward?.nameEn || '' };
}

export function sessionRole(session) {
  return String(session?.active_role || '').toUpperCase();
}

export function sessionWard(session) {
  return String(session?.active_ward_code || '').toLowerCase();
}

export function buildIdentity(database, session) {
  const access = getUserAccess(database, session.user_id);
  const contexts = validContexts(access);
  const activeRole = sessionRole(session);
  const activeWardCode = sessionWard(session);
  const activeWard = wardInfo(activeWardCode);
  const contextValid = contexts.some(item => item.role === activeRole && item.wardCode === activeWardCode);
  return {
    id: session.user_id,
    username: session.username,
    displayName: session.display_name,
    roles: access.roles,
    wards: access.wards.map(code => wardInfo(code)).filter(Boolean),
    imagingSubtypes: access.imagingSubtypes,
    activeRole: contextValid ? activeRole : '',
    role: contextValid ? activeRole : '',
    activeWard: contextValid && activeWard ? activeWard : null,
    needsContext: !contextValid,
    contexts,
  };
}

export function listUsers(database) {
  return database.sqlite.prepare(`SELECT id, username, display_name, is_active, created_at, updated_at, last_login_at
    FROM users ORDER BY display_name COLLATE NOCASE, username COLLATE NOCASE`).all().map(row => {
      const access = getUserAccess(database, row.id);
      return {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        isActive: row.is_active === 1,
        roles: access.roles,
        wards: access.wards,
        imagingSubtypes: access.imagingSubtypes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at,
      };
    });
}

export function updateUserProfile(database, userId, values) {
  const user = database.sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const displayName = String(values.displayName ?? user.display_name).trim();
  if (!displayName || displayName.length > 100) throw new Error('Display name is invalid.');
  const isActive = values.isActive === undefined ? user.is_active : (values.isActive ? 1 : 0);
  const now = Date.now();
  database.sqlite.prepare('UPDATE users SET display_name = ?, is_active = ?, updated_at = ? WHERE id = ?')
    .run(displayName, isActive, now, userId);
  if (Array.isArray(values.roles) || Array.isArray(values.wards) || Array.isArray(values.imagingSubtypes)) {
    const current = getUserAccess(database, userId);
    setUserAccess(database, userId, values.roles ?? current.roles, values.wards ?? current.wards, now, values.imagingSubtypes ?? current.imagingSubtypes);
  }
  if (!isActive) database.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  return database.sqlite.prepare('SELECT id, username, display_name, is_active FROM users WHERE id = ?').get(userId);
}

export function patientWorkWard(row) {
  if (!row) return '';
  let data = {};
  try { data = JSON.parse(row.record_json || '{}'); } catch {}
  const transferred = String(data['system:transferredWard'] || data['scope:medical:id:opd-ipd-transfer-ward'] || data['id:web_opd_transfer_ward'] || '').toLowerCase();
  if (WARD_SET.has(transferred)) return transferred;
  const explicit = String(data['system:currentWardCode'] || '').toLowerCase();
  if (WARD_SET.has(explicit)) return explicit;
  if (String(row.department_code || '').toLowerCase() === 'gyneco-obstetric') {
    if (String(data['system:careType'] || '').toLowerCase() === 'obstetric') return 'obstetric';
    return 'gynecology';
  }
  const department = String(row.department_code || '').toLowerCase();
  if (WARD_SET.has(department)) return department;
  if (row.service_mode === 'opd') return 'opd';
  return department;
}

export function canAccessPatient(database, session, row) {
  const role = sessionRole(session);
  if (['ADMIN','VICE_DIRECTOR'].includes(role) || role === 'DIRECTOR' || role === 'LAB' || role === 'IMAGING' || role === 'PHARMACY') return true;
  if (['ACCOUNTANT','CLERK'].includes(role)) return false;
  if (!role) return false;
  if (!roleRequiresWard(role)) return true;
  const ward = sessionWard(session);
  if (!ward) return false;
  const patientWard = patientWorkWard(row);
  if (!patientWard) return true;
  if (patientWard === ward || (row.department_code === 'gyneco-obstetric' && ['gynecology', 'obstetric'].includes(ward) && !dataHasAssignedRoom(row))) return true;
  let data = {};
  try { data = JSON.parse(row.record_json || '{}'); } catch {}
  const transferred = String(data['system:transferredWard'] || data['scope:medical:id:opd-ipd-transfer-ward'] || data['id:web_opd_transfer_ward'] || '').toLowerCase();
  if (transferred === ward) return true;
  if (ward === 'opd') {
    if (row.service_mode === 'opd' || Boolean(data['system:opdEncounterAt'] || data['scope:medical:id:opd-ipd-transfer-ward'] || data['scope:medical:id:emr_pmrs_opd_diagnosis'] || data['system:transferredWard'] || data['scope:opd:id:opd_complaint'] || data['id:opd_complaint'])) {
      return true;
    }
  }
  return false;
}

function dataHasAssignedRoom(row) {
  try {
    const data = JSON.parse(row.record_json || '{}');
    return Boolean(data['system:currentRoomId'] || data['system:currentBedId']);
  } catch { return false; }
}

export function roleCanPage(role, pathname) {
  role = String(role || '').toUpperCase();
  if (['/admin/organization','/admin/interface','/admin/health-facility'].includes(pathname)) return ['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role);
  if (['ADMIN','VICE_DIRECTOR'].includes(role) || role === 'DIRECTOR') return true;
  if (pathname === '/requests') return ['REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','PHARMACY','LAB','IMAGING','CLERK','ACCOUNTANT'].includes(role);
  if (pathname === '/record-viewer') return ['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role);
  if (pathname === '/home' || pathname === '/context' || pathname === '/print-preview') return true;
  if (pathname === '/lab/materials') return role === 'LAB';
  if (pathname === '/pharmacy/medicines') return role === 'PHARMACY';
  if (pathname === '/lab') return role === 'LAB';
  if (pathname === '/imaging' || pathname === '/imaging/films') return role === 'IMAGING';
  if (pathname === '/admin/users') return false;
  if (pathname === '/billing') return ['ACCOUNTANT','CLERK','VICE_DIRECTOR'].includes(role);
  if (pathname === '/expenses') return role === 'ACCOUNTANT';
  if (pathname === '/finance') return role === 'DIRECTOR';
  if (pathname === '/triage') return role === 'TRIAGE';
  if (pathname === '/opd-queue') return ['TRIAGE','DOCTOR'].includes(role);
  if (pathname === '/opd-paraclinic-nurse') return role === 'NURSE';
  if (pathname === '/ipd-transfer') return role === 'DOCTOR';
  if (pathname === '/queue-display') return ['TRIAGE','DOCTOR','NURSE','MIDWIFE'].includes(role);
  if (pathname === '/pharmacy/opd') return role === 'PHARMACY';
  if (pathname === '/pharmacy/display') return role === 'PHARMACY';
  if (pathname === '/departments') return ['DOCTOR', 'NURSE', 'MIDWIFE', 'WARD_HEAD', 'CHIEF_WARD'].includes(role);
  if (pathname === '/patient-list') return ROLE_SET.has(role);
  if (pathname === '/pmrs-import') return role === 'DOCTOR';
  if (pathname === '/ward-medicines') return ['DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','PHARMACY','DIRECTOR'].includes(role);
  if (pathname === '/emr') return ['REGISTRATION', 'TRIAGE', 'DOCTOR', 'NURSE', 'MIDWIFE','CHIEF_WARD'].includes(role);
  return false;
}

export function newId() { return crypto.randomUUID(); }
