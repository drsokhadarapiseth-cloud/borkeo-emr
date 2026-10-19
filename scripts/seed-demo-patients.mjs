import crypto from 'node:crypto';
import { openDatabase } from '../server/database.mjs';
import { ensureDemoAccounts } from '../server/demo-accounts.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { ensureFinanceSchema } from '../server/finance.mjs';

const profiles = [
  { fullName:'សុខ ដារ៉ា', sex:'M', age:32, phone:'010 555 100', father:'សុខ វិរៈ', mother:'ឈុន ស្រីនាង', commune:'អូរជ្រៅ', village:'ភូមិ១', marital:0, occupation:'កសិករ', otherId:0, disability:0, nssf:'', equity:'', entry:'មកដោយខ្លួនឯង', complaint:'Fever and cough' },
  { fullName:'ខេម រ័ត្ន', sex:'F', age:27, phone:'011 555 101', father:'ខេម សុវណ្ណ', mother:'រ័ត្ន ស្រីម៉ៅ', commune:'បរកែវ', village:'ភូមិ២', marital:1, occupation:'កម្មករ', otherId:0, disability:0, nssf:'', equity:'', entry:'មកដោយខ្លួនឯង', complaint:'Headache' },
  { fullName:'ចាន់ សុភា', sex:'F', age:41, phone:'012 555 102', father:'ចាន់ វ៉ាន់ណេត', mother:'សុភា ចាន់', commune:'ដំណាក់ចំណង', village:'ភូមិ៣', marital:1, occupation:'កសិករ', otherId:0, disability:0, nssf:'', equity:'', entry:'មកដោយខ្លួនឯង', complaint:'Abdominal pain' },
  { fullName:'លី សុខា', sex:'M', age:56, phone:'013 555 103', father:'លី ឆាយ', mother:'ភាព សុឃីម', commune:'ទួលស្នួល', village:'ភូមិ៤', marital:1, occupation:'កសិករ', otherId:1, disability:0, nssf:'', equity:'', entry:'បញ្ជូនមកពីមណ្ឌលសុខភាព', complaint:'Shortness of breath' },
  { fullName:'ញ៉ាង វ៉ាន់', sex:'F', age:36, phone:'014 555 104', father:'ញ៉ាង គីមហេង', mother:'វ៉ាន់ សុគន្ធ', commune:'ចំការស្រែ', village:'ភូមិ៥', marital:1, occupation:'កម្មករ', otherId:0, disability:0, nssf:'', equity:'', entry:'មកដោយខ្លួនឯង', complaint:'Back pain' },
  { fullName:'គឹម មុនី', sex:'M', age:22, phone:'015 555 105', father:'គឹម សុគន្ធា', mother:'ឈា រិន', commune:'អូរជ្រៅ', village:'ភូមិ២', marital:0, occupation:'កម្មករ', otherId:0, disability:0, nssf:'', equity:'', entry:'មកដោយខ្លួនឯង', complaint:'Sore throat' },
  { fullName:'ពេជ្រ រីណា', sex:'F', age:18, phone:'016 555 106', father:'ពេជ្រ រស្មី', mother:'រីណា សុខ', commune:'បរកែវ', village:'ភូមិ៣', marital:0, occupation:'កសិករ', otherId:0, disability:0, nssf:'', equity:'', entry:'មកដោយខ្លួនឯង', complaint:'Fever' },
  { fullName:'ទូច សុវណ្ណ', sex:'M', age:63, phone:'017 555 107', father:'ទូច សុខ', mother:'មាស ចាន់', commune:'ដំណាក់ចំណង', village:'ភូមិ៤', marital:1, occupation:'កសិករ', otherId:1, disability:0, nssf:'', equity:'', entry:'បញ្ជូនមកពីមណ្ឌលសុខភាព', complaint:'Joint pain' },
  { fullName:'លីម ខៀវ', sex:'F', age:49, phone:'018 555 108', father:'លីម វុធ', mother:'ខៀវ ស្រីរ័ត្ន', commune:'ទួលស្នួល', village:'ភូមិ៥', marital:1, occupation:'កម្មករ', otherId:0, disability:0, nssf:'', equity:'', entry:'មកតាមការណាត់របស់គ្រូពេទ្យ', complaint:'Dizziness' },
  { fullName:'ហេង រតនា', sex:'M', age:70, phone:'019 555 109', father:'ហេង សុវណ្ណ', mother:'រតនា ភា', commune:'ចំការស្រែ', village:'ភូមិ១', marital:1, occupation:'កសិករ', otherId:1, disability:0, nssf:'', equity:'', entry:'បញ្ជូនមកពីមណ្ឌលសុខភាព', complaint:'Leg swelling' },
];

export function buildRegistrationData({ profile, caseNumber, healthId, date, time, existingData, queueNumber }) {
  const sexKh = profile.sex === 'M' ? 'ប្រុស' : 'ស្រី';
  const data = { ...(existingData || {}) };

  // Keep the demo patients as realistic, fully populated new registration records.
  Object.assign(data, {
    'system:caseType': 'new',
    'system:demoPatient': 'true',
    'system:registrationQueueNumber': String(queueNumber),
    'system:registeredAt': data['system:registeredAt'] || Date.now(),
    'scope:registration:id:emr_pmrs_case_new': true,
    'scope:registration:id:emr_pmrs_case_old': false,
    'scope:registration:id:web_adm_no': caseNumber,
    'scope:registration:id:web_first_name': profile.fullName.split(/\s+/, 2)[1],
    'scope:registration:id:web_last_name': profile.fullName.split(/\s+/, 2)[0],
    'scope:registration:id:web_health_id': healthId,
    'scope:registration:id:web_age': String(profile.age),
    'scope:registration:id:web_dob': `${new Date(date).getFullYear() - profile.age}-06-15`,
    'scope:registration:id:web_phone': profile.phone,
    'scope:registration:id:web_date': date,
    'scope:registration:id:web_time': time,
    'scope:registration:id:web_entry_type': profile.entry,
    'scope:registration:id:web_nat': 'ខ្មែរ',
    'scope:registration:id:web_nssf': profile.nssf,
    'scope:registration:id:web_equity': profile.equity,
    'scope:registration:id:web_district': 'បរកែវ',
    'scope:registration:id:web_commune': profile.commune,
    'scope:registration:id:web_village': profile.village,
    'scope:registration:id:web_diag_in': profile.complaint,
    'scope:registration:id:web_refer': profile.entry === 'បញ្ជូនមកពីមណ្ឌលសុខភាព' ? 'ផ្នែកពិគ្រោះក្រៅ' : '',
    'scope:registration:auto:7': profile.father,
    'scope:registration:auto:8': profile.mother,
    'scope:registration:auto:11': 'រតនគិរី',
    'scope:registration:auto:17': profile.sex === 'M',
    'scope:registration:auto:18': profile.sex === 'F',
    'scope:registration:auto:22': profile.marital === 0,
    'scope:registration:auto:23': profile.marital === 1,
    'scope:registration:auto:24': profile.marital === 2,
    'scope:registration:auto:25': profile.marital === 3,
    'scope:registration:auto:27': profile.occupation,
    'scope:registration:auto:28': profile.otherId === 1,
    'scope:registration:auto:29': profile.otherId === 0,
    'scope:registration:auto:30': profile.disability === 1,
    'scope:registration:auto:31': profile.disability === 0,
  });

  // Make sure no prior run leaves an invalid/bypassed name in the stored record.
  const first = String(data['scope:registration:id:web_first_name'] || '').trim();
  const last = String(data['scope:registration:id:web_last_name'] || '').trim();
  if (!first || !last) throw new Error(`Demo patient ${queueNumber} is missing a first or last name.`);
  if (/^(demo|test|patient)\s*\d*$/i.test(`${last} ${first}`.trim())) {
    throw new Error(`Demo patient ${queueNumber} has a placeholder name.`);
  }
  data['system:workflowStage'] = data['system:workflowStage'] || 'TRIAGE_WAITING';
  data['system:triageStatus'] = data['system:triageStatus'] || 'WAITING';
  // Prefill only simulated, unfinished Triage records. Keep entered values and
  // completed assessments intact when the demo server starts again.
  if (data['system:triageStatus'] !== 'COMPLETED') {
    const sampleVitals = {
      p2_temp: '36.8', p2_bp_sys: '120', p2_bp_dia: '80',
      p2_pulse: '78', p2_resp: '18', p2_spo2: '98',
      p2_weight: profile.sex === 'M' ? '65' : '55',
      p2_height: profile.sex === 'M' ? '170' : '160',
    };
    for (const [field, value] of Object.entries(sampleVitals)) {
      const key = `scope:triage:id:${field}`;
      if (data[key] === undefined || data[key] === null || String(data[key]).trim() === '') data[key] = value;
    }
  }
  return data;
}

export function seedDemoPatients(database, now = Date.now()) {
  ensureAccessSchema(database);
  ensureFinanceSchema(database);
  ensureDemoAccounts(database, now);
  const registration = database.findUser('registration');
  if (!registration) throw new Error('Demo registration account was not created.');

  const baseDate = new Date(now);
  const date = baseDate.toISOString().slice(0,10);
  let created = 0;
  let updated = 0;

  for (let i = 0; i < profiles.length; i += 1) {
    const profile = profiles[i];
    const [lastName, firstName] = profile.fullName.split(/\s+/, 2);
    const generatedCaseNumber = `BK-${date.replaceAll('-','')}-${String(1001+i).padStart(4,'0')}`;
    const generatedHealthId = `DEMO-${date.replaceAll('-','')}-${String(i+1).padStart(2,'0')}`;
    const generatedPatientKey = `case:${generatedCaseNumber}`;
    const candidates = database.sqlite.prepare('SELECT * FROM patient_records WHERE full_name=? ORDER BY created_at').all(profile.fullName);
    const demoExisting = candidates.find(row => {
      try { return JSON.parse(row.record_json || '{}')?.['system:demoPatient'] === 'true'; } catch { return false; }
    }) || null;
    const currentExisting = database.findPatient(generatedPatientKey);
    const existing = currentExisting || demoExisting;
    const caseNumber = existing?.case_number || generatedCaseNumber;
    const healthId = existing?.health_id || generatedHealthId;
    const patientKey = existing?.patient_key || generatedPatientKey;
    const currentData = existing ? JSON.parse(existing.record_json || '{}') : {};
    const time = currentData['scope:registration:id:web_time'] || `${String(8+i).padStart(2,'0')}:${String((10+i) % 60).padStart(2,'0')}`;
    const data = buildRegistrationData({ profile, caseNumber, healthId, date: currentData['scope:registration:id:web_date'] || date, time, existingData: currentData, queueNumber: i + 1 });
    const dob = data['scope:registration:id:web_dob'];
    const sexKh = profile.sex === 'M' ? 'ប្រុស' : 'ស្រី';
    const summary = {
      caseNumber, healthId,
      firstName: data['scope:registration:id:web_first_name'],
      lastName: data['scope:registration:id:web_last_name'],
      fullName: profile.fullName,
      sex: sexKh,
      age: String(profile.age),
      dateOfBirth: dob,
      phone: profile.phone,
      equityCard: profile.equity,
      paymentType: 'DIRECT',
      departmentCode: existing?.department_code || '',
      departmentNameKh: existing?.department_name_kh || '',
      departmentNameEn: existing?.department_name_en || '',
      serviceMode: existing?.service_mode || '',
      entryDate: data['scope:registration:id:web_date'],
      dischargeDate: existing?.discharge_date || '',
    };

    database.upsertPatient({
      id: existing?.id || crypto.randomUUID(),
      patientKey,
      summary,
      data,
      userId: registration.id,
      savedAt: existing?.updated_at || now + i,
    });
    database.sqlite.prepare(`INSERT INTO patient_finance_profiles
      (patient_key,payment_type,payment_subtype,hef_type,discount_percent,discount_amount_minor,discount_currency,payer_reference,note,updated_by,created_at,updated_at)
      VALUES (?,'DIRECT','FULL','',0,0,'KHR','','Simulated cash-payment profile',?,?,?)
      ON CONFLICT(patient_key) DO UPDATE SET payment_type='DIRECT',payment_subtype='FULL',hef_type='',discount_percent=0,
        discount_amount_minor=0,discount_currency='KHR',payer_reference='',note='Simulated cash-payment profile',updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
      .run(patientKey, registration.id, now + i, now + i);
    if (existing) updated += 1; else created += 1;
  }

  return { created, updated, count: profiles.length };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const dbPath = process.argv[2] || 'data/demo.sqlite';
  const database = openDatabase(dbPath);
  try {
    const { resetAndSeedThirtyTriagePatients } = await import('./seed-v301-thirty-triage-patients.mjs');
    const result = resetAndSeedThirtyTriagePatients(database);
    console.log(`Seeded ${result.count} Borkeo demo patients with complete registration, triage, and photos.`);
  } finally { database.close(); }
}
