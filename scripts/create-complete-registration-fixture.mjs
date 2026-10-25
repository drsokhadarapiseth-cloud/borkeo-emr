// Synthetic fixtures only. This command never accepts a database destination.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { ensureFinanceSchema } from '../server/finance.mjs';
import { ensureDemoAccounts } from '../server/demo-accounts.mjs';
import { resetAndSeedThirtyTriagePatients, thirtyBorkeoProfiles } from './seed-v301-thirty-triage-patients.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function registrationEntryDate(now = Date.now()) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid fixture entry date.');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function syntheticPatientId(entryDate, sequence) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || !Number.isInteger(sequence) || sequence < 1 || sequence > 999) throw new Error('Invalid synthetic patient ID components.');
  const parsed = Date.parse(`${entryDate}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== entryDate) throw new Error('Invalid synthetic patient ID date.');
  return `160201-${entryDate.replaceAll('-', '')}-${String(sequence).padStart(3, '0')}`;
}

export function buildCompleteRegistrationPatients(now = Date.now()) {
  const date = registrationEntryDate(now);
  const html = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');
  const options = fragment => [...fragment.matchAll(/<option\b[^>]*value="([^"]+)"/g)].map(match => match[1]);
  const relations = options(html.match(/<select[^>]*id="web_caregiver_relation"[^>]*>([\s\S]*?)<\/select>/)[1]);
  const occupations = options(html.match(/<select[^>]*onchange="syncOccupationField\(this\)"[^>]*>([\s\S]*?)<\/select>/)[1]);
  const district = JSON.parse(fs.readFileSync(path.join(root, 'data/gazetteer/provinces/ratanak_kiri.json'), 'utf8')).find(item => item.code === '1603');
  const addresses = district.communes.flatMap(commune => commune.villages.map(village => ({ commune, village })));
  const templates = openDatabase(':memory:');
  try {
    // The legacy reset helper is restricted to this newly created in-memory DB.
    resetAndSeedThirtyTriagePatients(templates, now);
    const rows = templates.sqlite.prepare('SELECT * FROM patient_records ORDER BY case_number').all();
    return rows.map((row, index) => {
      const profile = thirtyBorkeoProfiles[index];
      const data = JSON.parse(row.record_json);
      for (const key of Object.keys(data)) if (key.startsWith('scope:registration:auto:') || key.startsWith('scope:triage:') || key === 'system:triageAssessedAt') delete data[key];
      const id = syntheticPatientId(date, index + 1);
      const address = addresses[index % addresses.length];
      const birthDate = `${Number(date.slice(0, 4)) - profile.age}-01-01`;
      const at = Date.parse(`${date}T08:00:00+07:00`) + index * 60_000;
      const registration = {
        web_adm_no: id, web_health_id: id, web_date: date, web_time: `08:${String(index).padStart(2, '0')}`,
        web_dob: birthDate, web_age: String(profile.age),
        web_province_code: '16', web_district: district.local, web_district_code: district.code,
        web_commune: address.commune.local, web_commune_code: address.commune.code,
        web_village: address.village.local, web_village_code: address.village.code,
        web_coverage_in_od: true, web_coverage_out_od: false, web_coverage_area: 'in_od',
        other_id_yes: false, other_id_no: true,
        web_caregiver_name: profile.father, web_caregiver_phone: profile.phone,
        web_caregiver_relation: relations[0], web_caregiver_sex_male: true, web_caregiver_sex_female: false,
      };
      for (const [key, value] of Object.entries(registration)) data[`scope:registration:id:${key}`] = value;
      // Current unnamed registration controls, verified against the rendered form.
      data['scope:registration:auto:21'] = profile.father;
      data['scope:registration:auto:22'] = profile.mother;
      for (let i = 0; i < 4; i++) data[`scope:registration:auto:${32 + i}`] = i === (profile.marital === 1 ? 0 : 1);
      data['scope:registration:auto:37'] = occupations.find(value => value === profile.occupation) || occupations.find(value => value.startsWith(profile.occupation)) || occupations[0];
      data['scope:registration:auto:38'] = false;
      data['scope:registration:auto:39'] = true;
      data['system:syntheticRegistrationFixture'] = true;
      data['system:registrationQueueNumber'] = String(index + 1);
      data['system:registeredAt'] = at;
      return {
        id: crypto.randomUUID(), patientKey: `case:${id}`, data, savedAt: at,
        summary: { caseNumber: id, healthId: id, fullName: profile.fullName,
          firstName: data['scope:registration:id:web_first_name'], lastName: data['scope:registration:id:web_last_name'],
          sex: profile.sex, age: String(profile.age), dateOfBirth: birthDate, phone: profile.phone,
          equityCard: '', paymentType: 'DIRECT', departmentCode: '', departmentNameKh: '', departmentNameEn: '',
          serviceMode: '', entryDate: date, dischargeDate: '' },
      };
    });
  } finally { templates.close(); }
}

export function createCompleteRegistrationFixture({ now = Date.now() } = {}) {
  const patients = buildCompleteRegistrationPatients(now);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-synthetic-registration-'));
  const databasePath = path.join(directory, 'registration-fixture.sqlite');
  const database = openDatabase(databasePath);
  try {
    ensureAccessSchema(database); ensureFinanceSchema(database); ensureDemoAccounts(database, now);
    const userId = database.findUser('registration').id;
    database.sqlite.exec('BEGIN');
    try {
      for (const patient of patients) database.upsertPatient({ ...patient, userId });
      database.sqlite.exec('COMMIT');
    } catch (error) { database.sqlite.exec('ROLLBACK'); throw error; }
  } finally { database.close(); }
  const manifest = { syntheticOnly: true, count: patients.length, entryDate: registrationEntryDate(now), idFormat: '160201-YYYYMMDD-###', databasePath };
  fs.writeFileSync(path.join(directory, 'FIXTURE.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { directory, ...manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('No destination arguments accepted. Fixtures always use a new temporary directory.');
  console.log(JSON.stringify(createCompleteRegistrationFixture(), null, 2));
}
