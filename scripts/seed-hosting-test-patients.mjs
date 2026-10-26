// v47.9 - 30 complete synthetic patients for a TEST hosting (for example a
// GitHub Codespace): Registration fully filled, Triage measured and waiting for
// the service to be chosen. Usage, with the EMR stopped:
//   node scripts/seed-hosting-test-patients.mjs /workspaces/borkeo-data/emr.sqlite
// It refuses (and changes nothing) when the database holds any patient that is
// not a test patient, so it cannot touch a hospital database. It replaces the
// earlier test patients and makes the shared 1234 accounts usable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { ensureFinanceSchema } from '../server/finance.mjs';
import { ensureSuperuser, SUPERUSER_USERNAME } from '../server/superuser.mjs';
import { defaultWardAccountPlan, ensureDefaultWardUsers, DEFAULT_WARD_PASSWORD } from '../server/default-ward-users.mjs';
import { hashPassword } from '../server/password.mjs';
import { buildCompleteRegistrationPatients } from './create-complete-registration-fixture.mjs';
import { thirtyBorkeoProfiles } from './seed-v301-thirty-triage-patients.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKERS = ['system:syntheticHostingTest', 'system:syntheticRegistrationFixture', 'system:demoPatient'];
const parse = (value) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
export const isTestPatient = (recordJson) => {
  const data = parse(recordJson);
  return MARKERS.some((key) => data[key] === true || data[key] === 'true');
};
// Tables kept when the test patients are replaced (accounts, logins, settings, audit).
const KEEP = new Set(['users', 'sessions', 'login_limits', 'audit_events', 'hospital_state']);

// A few values outside the normal range, so the triage alerts can be seen.
const ABNORMAL = { 4: { spo2: '91', pulse: '112', resp: '26' }, 9: { bp_sys: '168', bp_dia: '106' }, 14: { temp: '39.4', pulse: '118' } };
const digits = (seed, length) => String(seed).padStart(length, '0').slice(-length);

export function buildHostingTestPatients(now = Date.now()) {
  const html = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');
  const entryTypes = [...html.match(/<select[^>]*id="web_entry_type"[^>]*>([\s\S]*?)<\/select>/)[1].matchAll(/<option\b[^>]*value="([^"]+)"/g)].map((match) => match[1]);
  return buildCompleteRegistrationPatients(now).map((patient, index) => {
    const profile = { ...thirtyBorkeoProfiles[index], ...(ABNORMAL[index] || {}) };
    const data = { ...patient.data };
    const summary = { ...patient.summary };
    const reg = (key, value) => { data[`scope:registration:id:${key}`] = value; };
    reg('web_street_address', `ផ្ទះលេខ ${12 + index * 3} ផ្លូវលេខ ${1 + (index % 7)}`);
    reg('web_entry_type', entryTypes[index % entryTypes.length]);
    // Payment: cash, HEF (equity card), NSSF, another card - the matching fields
    // are filled. The HEF / NSSF verification is left to the real check.
    const kind = index % 4;
    reg('web_equity', kind === 1 ? `16${digits(31000000 + index * 7919, 8)}` : '');
    reg('web_nssf', kind === 2 ? digits(820000000 + index * 104729, 10) : '');
    reg('other_id_yes', kind === 3);
    reg('other_id_no', kind !== 3);
    reg('web_other_card_type', kind === 3 ? '1. National ID Card number' : '');
    reg('web_other_card_number', kind === 3 ? `0${digits(10200000 + index * 3571, 8)}` : '');
    reg('web_other_card_issuer', kind === 3 ? 'ក្រសួងមហាផ្ទៃ' : '');
    summary.paymentType = kind === 2 ? 'NSSF' : kind === 1 ? 'Equity Fund' : summary.paymentType;
    summary.equityCard = data['scope:registration:id:web_equity'];
    // Triage measured (vital signs, weight, height, complaint), not yet sent to a service.
    const triage = { pmrs_chief_complaint: profile.complaint, p2_temp: profile.temp, p2_bp_sys: profile.bp_sys, p2_bp_dia: profile.bp_dia, p2_pulse: profile.pulse,
      p2_resp: profile.resp, p2_spo2: profile.spo2, p2_weight: profile.weight, p2_height: profile.height, p2_other_dept: '', p2_dept_opd: false, p2_dept_ipd: false, p2_ward: '' };
    for (const [key, value] of Object.entries(triage)) data[`scope:triage:id:${key}`] = value;
    data['system:workflowStage'] = 'TRIAGE_WAITING';
    data['system:triageStatus'] = 'WAITING';
    data['system:syntheticHostingTest'] = true;
    return { ...patient, data, summary };
  });
}

export async function seedHostingTestPatients(databasePath, { now = Date.now(), log = console.log } = {}) {
  if (!databasePath || databasePath === ':memory:') throw new Error('Give the test database file, for example /workspaces/borkeo-data/emr.sqlite');
  const file = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const database = openDatabase(file);
  try {
    const real = database.sqlite.prepare('SELECT patient_key, record_json FROM patient_records').all().filter((row) => !isTestPatient(row.record_json));
    if (real.length) {
      throw new Error(`Refused: ${real.length} patient(s) in ${file} are not test patients. Nothing was changed. `
        + `If this really is a test database, delete it first (rm -rf "${path.dirname(file)}") and run again.`);
    }
    ensureAccessSchema(database);
    ensureFinanceSchema(database);
    ensureSuperuser(database, now, { production: false });
    ensureDefaultWardUsers(database, now);
    // Accounts made by the old demo seed cannot log in: give them the shared 1234.
    const shared = await hashPassword(DEFAULT_WARD_PASSWORD);
    for (const account of defaultWardAccountPlan()) {
      database.sqlite.prepare("UPDATE users SET password_hash=?, is_active=1 WHERE username=? AND password_hash LIKE 'demo-disabled$%'").run(shared, account.username);
    }
    const patients = buildHostingTestPatients(now);
    const userId = database.findUser(SUPERUSER_USERNAME).id;
    // Every table linked to a patient (also ANC, vaccination, finance); messages lose only their patient rows.
    const tables = database.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name)
      .filter((name) => !KEEP.has(name))
      .map((name) => ({ name, columns: database.sqlite.prepare(`PRAGMA table_info("${name}")`).all().map((column) => column.name) }))
      .filter((table) => table.columns.some((column) => ['patient_key', 'pregnancy_id', 'invoice_id'].includes(column)));
    database.sqlite.exec('BEGIN');
    try {
      for (const { name, columns } of tables) {
        database.sqlite.prepare(columns.includes('patient_key') ? `DELETE FROM "${name}" WHERE COALESCE(patient_key, '') <> ''` : `DELETE FROM "${name}"`).run();
      }
      for (const patient of patients) database.upsertPatient({ ...patient, userId });
      database.sqlite.exec('COMMIT');
    } catch (error) { database.sqlite.exec('ROLLBACK'); throw error; }
    log(`Seeded ${patients.length} test patients (${patients[0].summary.caseNumber} ... ${patients[patients.length - 1].summary.caseNumber}) into ${file}.`);
    log('Start the EMR, then log in as Superuser or nurse_triage with 1234. The patients wait in the Triage list.');
    return { count: patients.length, file, ids: patients.map((patient) => patient.summary.caseNumber), clearedTables: tables.map((table) => table.name) };
  } finally { database.close(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  seedHostingTestPatients(process.argv[2]).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
