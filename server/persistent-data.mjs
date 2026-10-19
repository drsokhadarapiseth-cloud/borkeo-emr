import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function quoteSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function tableExists(sqlite, name) {
  return Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function versionTuple(filePath) {
  const matches = [...String(filePath).matchAll(/v(\d+)\.(\d+)\.(\d+)/gi)];
  if (!matches.length) return [0, 0, 0];
  const m = matches[matches.length - 1];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareVersion(left, right) {
  const a = versionTuple(left);
  const b = versionTuple(right);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return b[i] - a[i];
  }
  return 0;
}

function databaseStats(filePath) {
  try {
    const sqlite = new DatabaseSync(filePath, { readOnly: true });
    let patientCount = 0;
    let latestPatientUpdate = 0;
    if (tableExists(sqlite, 'patient_records')) {
      const row = sqlite.prepare('SELECT COUNT(*) count, COALESCE(MAX(updated_at),0) latest FROM patient_records').get();
      patientCount = Number(row?.count || 0);
      latestPatientUpdate = Number(row?.latest || 0);
    }
    const userCount = tableExists(sqlite, 'users')
      ? Number(sqlite.prepare('SELECT COUNT(*) count FROM users').get()?.count || 0) : 0;
    sqlite.close();
    return { valid: true, patientCount, latestPatientUpdate, userCount, mtimeMs: fs.statSync(filePath).mtimeMs };
  } catch {
    return { valid: false, patientCount: 0, latestPatientUpdate: 0, userCount: 0, mtimeMs: 0 };
  }
}

function walkForDatabases(root, targetPath, results, depth = 0, maximumDepth = 4) {
  if (!root || depth > maximumDepth || !fs.existsSync(root)) return;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'Borkeo_EMR_Data') continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isFile()) {
      if (!/\.sqlite$/i.test(entry.name)) continue;
      if (path.resolve(fullPath) === path.resolve(targetPath)) continue;
      if (!/emr-development\.sqlite$/i.test(entry.name) && !/borkeo.*\.sqlite$/i.test(entry.name)) continue;
      results.add(path.resolve(fullPath));
      continue;
    }
    if (!entry.isDirectory()) continue;
    const interesting = depth === 0 || /borkeo|emr|release|data/i.test(entry.name);
    if (interesting) walkForDatabases(fullPath, targetPath, results, depth + 1, maximumDepth);
  }
}

export function discoverLegacyDatabases(projectRoot, targetPath, extraRoots = []) {
  const results = new Set();
  const localSeed = path.join(projectRoot, 'data', 'emr-development.sqlite');
  if (fs.existsSync(localSeed) && path.resolve(localSeed) !== path.resolve(targetPath)) results.add(path.resolve(localSeed));

  const roots = [
    path.dirname(projectRoot),
    path.join(os.homedir(), 'Desktop'),
    ...extraRoots,
  ];
  for (const root of new Set(roots.map(value => value && path.resolve(value)).filter(Boolean))) {
    walkForDatabases(root, targetPath, results);
  }
  return [...results].map(filePath => ({ path: filePath, ...databaseStats(filePath) })).filter(item => item.valid);
}

function safeVacuumCopy(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) return false;
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    source.exec(`VACUUM INTO ${quoteSqlString(targetPath)}`);
    return true;
  } finally {
    source.close();
  }
}

export function preparePersistentDatabase({ projectRoot, targetPath, extraRoots = [] }) {
  if (!targetPath || targetPath === ':memory:') return { created: false, sourcePath: '', candidates: [] };
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const candidates = discoverLegacyDatabases(projectRoot, targetPath, extraRoots);
  if (fs.existsSync(targetPath)) return { created: false, sourcePath: '', candidates };

  const localSeed = path.resolve(path.join(projectRoot, 'data', 'emr-development.sqlite'));
  const previous = candidates.filter(item => path.resolve(item.path) !== localSeed);
  previous.sort((a, b) => compareVersion(a.path, b.path) || b.latestPatientUpdate - a.latestPatientUpdate || b.patientCount - a.patientCount || b.mtimeMs - a.mtimeMs);
  const localCandidate = candidates.find(item => path.resolve(item.path) === localSeed);
  const source = previous[0] || localCandidate || null;
  if (!source) return { created: false, sourcePath: '', candidates };
  safeVacuumCopy(source.path, targetPath);
  return { created: true, sourcePath: source.path, candidates };
}

function userMapper(source, target, fallbackId) {
  const sourceUsers = tableExists(source, 'users')
    ? new Map(source.prepare('SELECT id,username FROM users').all().map(row => [row.id, row.username]))
    : new Map();
  const targetById = new Set(target.prepare('SELECT id FROM users').all().map(row => row.id));
  const targetByName = new Map(target.prepare('SELECT id,username FROM users').all().map(row => [String(row.username).toLowerCase(), row.id]));
  return sourceId => {
    if (sourceId && targetById.has(sourceId)) return sourceId;
    const username = sourceUsers.get(sourceId);
    if (username) {
      const mapped = targetByName.get(String(username).toLowerCase());
      if (mapped) return mapped;
    }
    return fallbackId;
  };
}

function recoverPatientsFromSource(target, sourcePath, fallbackId) {
  let source;
  try { source = new DatabaseSync(sourcePath, { readOnly: true }); } catch { return { patients: 0, forms: 0 }; }
  try {
    if (!tableExists(source, 'patient_records')) return { patients: 0, forms: 0 };
    const mapUser = userMapper(source, target, fallbackId);
    const targetPatient = target.prepare('SELECT updated_at FROM patient_records WHERE patient_key=?');
    const insertPatient = target.prepare(`INSERT INTO patient_records
      (id,patient_key,case_number,health_id,first_name,last_name,full_name,sex,age,date_of_birth,phone,equity_card,payment_type,
       department_code,department_name_kh,department_name_en,service_mode,entry_date,discharge_date,record_json,version,
       created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(patient_key) DO UPDATE SET
        case_number=excluded.case_number, health_id=excluded.health_id, first_name=excluded.first_name, last_name=excluded.last_name,
        full_name=excluded.full_name, sex=excluded.sex, age=excluded.age, date_of_birth=excluded.date_of_birth, phone=excluded.phone,
        equity_card=excluded.equity_card, payment_type=excluded.payment_type, department_code=excluded.department_code,
        department_name_kh=excluded.department_name_kh, department_name_en=excluded.department_name_en,
        service_mode=excluded.service_mode, entry_date=excluded.entry_date, discharge_date=excluded.discharge_date,
        record_json=excluded.record_json, version=MAX(patient_records.version,excluded.version), updated_by=excluded.updated_by,
        updated_at=excluded.updated_at
      WHERE excluded.updated_at > patient_records.updated_at`);
    let recoveredPatients = 0;
    const rows = source.prepare('SELECT * FROM patient_records').all();
    for (const row of rows) {
      const existing = targetPatient.get(row.patient_key);
      if (existing && Number(existing.updated_at || 0) >= Number(row.updated_at || 0)) continue;
      insertPatient.run(
        row.id, row.patient_key, row.case_number || '', row.health_id || '', row.first_name || '', row.last_name || '', row.full_name || '',
        row.sex || '', row.age || '', row.date_of_birth || '', row.phone || '', row.equity_card || '', row.payment_type || '',
        row.department_code || '', row.department_name_kh || '', row.department_name_en || '', row.service_mode || '', row.entry_date || '',
        row.discharge_date || '', row.record_json || '{}', Number(row.version || 1), mapUser(row.created_by), mapUser(row.updated_by),
        Number(row.created_at || Date.now()), Number(row.updated_at || row.created_at || Date.now()),
      );
      recoveredPatients += 1;
    }

    let recoveredForms = 0;
    if (tableExists(source, 'clinical_form_records')) {
      const existingForm = target.prepare('SELECT updated_at FROM clinical_form_records WHERE patient_key=? AND form_type=?');
      const upsertForm = target.prepare(`INSERT INTO clinical_form_records
        (id,patient_key,form_type,patient_json,form_data_json,version,created_by,updated_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(patient_key,form_type) DO UPDATE SET
          patient_json=excluded.patient_json, form_data_json=excluded.form_data_json,
          version=MAX(clinical_form_records.version,excluded.version), updated_by=excluded.updated_by, updated_at=excluded.updated_at
        WHERE excluded.updated_at > clinical_form_records.updated_at`);
      for (const row of source.prepare('SELECT * FROM clinical_form_records').all()) {
        const existing = existingForm.get(row.patient_key, row.form_type);
        if (existing && Number(existing.updated_at || 0) >= Number(row.updated_at || 0)) continue;
        upsertForm.run(row.id, row.patient_key, row.form_type, row.patient_json || '{}', row.form_data_json || '{}', Number(row.version || 1),
          mapUser(row.created_by), mapUser(row.updated_by), Number(row.created_at || Date.now()), Number(row.updated_at || row.created_at || Date.now()));
        recoveredForms += 1;
      }
    }
    return { patients: recoveredPatients, forms: recoveredForms };
  } catch {
    return { patients: 0, forms: 0 };
  } finally {
    source.close();
  }
}

export function recoverLegacyPatientData(database, { projectRoot, targetPath, candidates = null, extraRoots = [] }) {
  if (!targetPath || targetPath === ':memory:') return { patients: 0, forms: 0, sources: 0 };
  const sourceList = candidates || discoverLegacyDatabases(projectRoot, targetPath, extraRoots);
  const fallback = database.sqlite.prepare("SELECT id FROM users WHERE username='admin' COLLATE NOCASE LIMIT 1").get()?.id
    || database.sqlite.prepare('SELECT id FROM users ORDER BY created_at LIMIT 1').get()?.id;
  if (!fallback) return { patients: 0, forms: 0, sources: 0 };

  let patients = 0;
  let forms = 0;
  let sources = 0;
  for (const source of sourceList) {
    if (!source.valid || path.resolve(source.path) === path.resolve(targetPath)) continue;
    const result = recoverPatientsFromSource(database.sqlite, source.path, fallback);
    if (result.patients || result.forms) sources += 1;
    patients += result.patients;
    forms += result.forms;
  }
  return { patients, forms, sources };
}

export function createDailyBackup(database, targetPath, keep = 14) {
  if (!targetPath || targetPath === ':memory:' || !fs.existsSync(targetPath)) return '';
  const backupDirectory = path.join(path.dirname(targetPath), 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const backupPath = path.join(backupDirectory, `emr-backup-${day}.sqlite`);
  if (!fs.existsSync(backupPath)) database.sqlite.exec(`VACUUM INTO ${quoteSqlString(backupPath)}`);
  const backups = fs.readdirSync(backupDirectory).filter(name => /^emr-backup-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)).sort().reverse();
  for (const old of backups.slice(keep)) fs.rmSync(path.join(backupDirectory, old), { force: true });
  return backupPath;
}
