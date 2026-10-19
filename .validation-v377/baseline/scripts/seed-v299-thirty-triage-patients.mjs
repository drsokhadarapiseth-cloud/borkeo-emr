import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { ensureDemoAccounts } from '../server/demo-accounts.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { ensureFinanceSchema } from '../server/finance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const photoDir = path.resolve(__dirname, '..', 'data', 'demo-photos');

function loadDemoPhotos() {
  const photos = {
    male_young: '',
    male_mid: '',
    male_elder: '',
    female_young: '',
    female_mid: '',
    female_elder: ''
  };
  try {
    const youngMale = path.join(photoDir, 'cambodian_young_male_20s_1791706893757.jpg');
    const midMale = path.join(photoDir, 'cambodian_male_portrait_30s_1791706775030.jpg');
    const elderMale = path.join(photoDir, 'cambodian_elderly_portrait_50s_1791706809830.jpg');
    const youngFemale = path.join(photoDir, 'cambodian_female_portrait_20s_1791706791489.jpg');
    const midFemale = path.join(photoDir, 'cambodian_female_portrait_40s_1791706826736.jpg');
    const elderFemale = path.join(photoDir, 'cambodian_elderly_woman_60s_1791706910767.jpg');

    if (fs.existsSync(youngMale)) photos.male_young = 'data:image/jpeg;base64,' + fs.readFileSync(youngMale).toString('base64');
    if (fs.existsSync(midMale)) photos.male_mid = 'data:image/jpeg;base64,' + fs.readFileSync(midMale).toString('base64');
    if (fs.existsSync(elderMale)) photos.male_elder = 'data:image/jpeg;base64,' + fs.readFileSync(elderMale).toString('base64');
    if (fs.existsSync(youngFemale)) photos.female_young = 'data:image/jpeg;base64,' + fs.readFileSync(youngFemale).toString('base64');
    if (fs.existsSync(midFemale)) photos.female_mid = 'data:image/jpeg;base64,' + fs.readFileSync(midFemale).toString('base64');
    if (fs.existsSync(elderFemale)) photos.female_elder = 'data:image/jpeg;base64,' + fs.readFileSync(elderFemale).toString('base64');
  } catch (err) {
    console.warn('Could not load all demo photos:', err.message);
  }
  return photos;
}

function getPhotoForProfile(photos, profile) {
  if (profile.sex === 'M') {
    if (profile.age < 30) return photos.male_young || photos.male_mid;
    if (profile.age >= 50) return photos.male_elder || photos.male_mid;
    return photos.male_mid;
  } else {
    if (profile.age < 30) return photos.female_young || photos.female_mid;
    if (profile.age >= 50) return photos.female_elder || photos.female_mid;
    return photos.female_mid;
  }
}

// 30 realistic Cambodian patient profiles
export const thirtyProfiles = [
  { fullName: 'សុខ ពិសិដ្ឋ', sex: 'M', age: 34, phone: '012 345 601', father: 'សុខ វិរៈ', mother: 'ឈុន ស្រីនាង', commune: 'អូរជ្រៅ', village: 'ភូមិ១', marital: 1, occupation: 'កសិករ', complaint: 'ក្តៅខ្លួនខ្លាំង និងក្អក', temp: '38.5', bp_sys: '120', bp_dia: '80', pulse: '88', resp: '20', spo2: '97', weight: '64', height: '168' },
  { fullName: 'ចាន់ ដារ៉ា', sex: 'M', age: 28, phone: '012 345 602', father: 'ចាន់ វ៉ាន់ណេត', mother: 'សុភា ចាន់', commune: 'បរកែវ', village: 'ភូមិ២', marital: 0, occupation: 'កម្មករ', complaint: 'ឈឺក្បាលខ្លាំង និងវិលមុខ', temp: '36.8', bp_sys: '130', bp_dia: '85', pulse: '76', resp: '18', spo2: '99', weight: '68', height: '172' },
  { fullName: 'គឹម ស្រីពៅ', sex: 'F', age: 24, phone: '012 345 603', father: 'គឹម សុគន្ធា', mother: 'ឈា រិន', commune: 'ដំណាក់ចំណង', village: 'ភូមិ៣', marital: 1, occupation: 'មេផ្ទះ', complaint: 'ចុកពោះផ្នែកខាងក្រោម', temp: '37.0', bp_sys: '110', bp_dia: '70', pulse: '82', resp: '18', spo2: '98', weight: '52', height: '158' },
  { fullName: 'លី វណ្ណារិទ្ធ', sex: 'M', age: 45, phone: '012 345 604', father: 'លី ឆាយ', mother: 'ភាព សុឃីម', commune: 'ទួលស្នួល', village: 'ភូមិ៤', marital: 1, occupation: 'កសិករ', complaint: 'ឈឺទ្រូង និងហត់', temp: '36.6', bp_sys: '140', bp_dia: '90', pulse: '92', resp: '22', spo2: '96', weight: '72', height: '169' },
  { fullName: 'មាស សុភ័ក្ត្រ', sex: 'F', age: 31, phone: '012 345 605', father: 'មាស ចាន់', mother: 'កែវ ធីតា', commune: 'ចំការស្រែ', village: 'ភូមិ៥', marital: 1, occupation: 'អាជីវករ', complaint: 'រាគ និងក្អួតច្រើនដង', temp: '37.4', bp_sys: '105', bp_dia: '65', pulse: '86', resp: '19', spo2: '98', weight: '54', height: '160' },
  { fullName: 'ហេង ស្រីលក្ខណ៍', sex: 'F', age: 19, phone: '012 345 606', father: 'ហេង សុវណ្ណ', mother: 'រតនា ភា', commune: 'អូរជ្រៅ', village: 'ភូមិ២', marital: 0, occupation: 'សិស្ស', complaint: 'ក្តៅខ្លួន ឈឺបំពង់ក', temp: '38.2', bp_sys: '115', bp_dia: '75', pulse: '84', resp: '18', spo2: '98', weight: '48', height: '156' },
  { fullName: 'ឈុន វុទ្ធី', sex: 'M', age: 52, phone: '012 345 607', father: 'ឈុន ស៊ុន', mother: 'យិន សាវ៉ាង', commune: 'បរកែវ', village: 'ភូមិ៣', marital: 1, occupation: 'កសិករ', complaint: 'ឈឺសន្លាក់ជង្គង់ទាំងសងខាង', temp: '36.7', bp_sys: '125', bp_dia: '80', pulse: '74', resp: '17', spo2: '99', weight: '66', height: '167' },
  { fullName: 'ពេជ្រ ម្លិះ', sex: 'F', age: 29, phone: '012 345 608', father: 'ពេជ្រ រស្មី', mother: 'រីណា សុខ', commune: 'ដំណាក់ចំណង', village: 'ភូមិ៤', marital: 1, occupation: 'កម្មករ', complaint: 'រលាកភ្លើងស្រាលលើដៃ', temp: '36.9', bp_sys: '118', bp_dia: '78', pulse: '80', resp: '18', spo2: '99', weight: '55', height: '162' },
  { fullName: 'ទូច ម៉ូនីកា', sex: 'F', age: 26, phone: '012 345 609', father: 'ទូច សុខ', mother: 'ម៉ៅ វណ្ណា', commune: 'ទួលស្នួល', village: 'ភូមិ៥', marital: 0, occupation: 'បុគ្គលិក', complaint: 'ចុកពោះផ្នែកស្តាំក្រោម', temp: '37.8', bp_sys: '112', bp_dia: '72', pulse: '88', resp: '20', spo2: '98', weight: '50', height: '159' },
  { fullName: 'ខេម វិរៈ', sex: 'M', age: 39, phone: '012 345 610', father: 'ខេម សុវណ្ណ', mother: 'រ័ត្ន ស្រីម៉ៅ', commune: 'ចំការស្រែ', village: 'ភូមិ១', marital: 1, occupation: 'អ្នករត់ម៉ូតូឌុប', complaint: 'គ្រោះថ្នាក់ចរាចរណ៍របួសជើង', temp: '36.8', bp_sys: '135', bp_dia: '85', pulse: '90', resp: '20', spo2: '98', weight: '65', height: '170' },
  { fullName: 'លីម ស្រីនិច', sex: 'F', age: 42, phone: '012 345 611', father: 'លីម វុធ', mother: 'ខៀវ ស្រីរ័ត្ន', commune: 'អូរជ្រៅ', village: 'ភូមិ៣', marital: 1, occupation: 'កសិករ', complaint: 'ក្អកមានកំហាកយូរថ្ងៃ', temp: '37.5', bp_sys: '122', bp_dia: '80', pulse: '82', resp: '19', spo2: '97', weight: '56', height: '161' },
  { fullName: 'រ័ត្ន រស្មី', sex: 'M', age: 23, phone: '012 345 612', father: 'រ័ត្ន សម្បត្តិ', mother: 'លី ដានី', commune: 'បរកែវ', village: 'ភូមិ៤', marital: 0, occupation: 'កម្មករ', complaint: 'ឈឺធ្មេញ និងហើមថ្ពាល់', temp: '37.2', bp_sys: '118', bp_dia: '76', pulse: '78', resp: '18', spo2: '99', weight: '61', height: '171' },
  { fullName: 'ញ៉ាង សុគន្ធា', sex: 'F', age: 35, phone: '012 345 613', father: 'ញ៉ាង គីមហេង', mother: 'វ៉ាន់ សុគន្ធ', commune: 'ដំណាក់ចំណង', village: 'ភូមិ៥', marital: 1, occupation: 'មេផ្ទះ', complaint: 'ចាញ់កូន ក្អួតចង្អោរខ្លាំង', temp: '36.7', bp_sys: '100', bp_dia: '65', pulse: '86', resp: '18', spo2: '99', weight: '49', height: '155' },
  { fullName: 'ហ៊ូ ចាន់ណា', sex: 'F', age: 48, phone: '012 345 614', father: 'ហ៊ូ គង់', mother: 'សេង ណារី', commune: 'ទួលស្នួល', village: 'ភូមិ១', marital: 1, occupation: 'កសិករ', complaint: 'លើសសម្ពាធឈាម វិលមុខ', temp: '36.6', bp_sys: '160', bp_dia: '95', pulse: '84', resp: '18', spo2: '98', weight: '63', height: '157' },
  { fullName: 'ឈា ភក្តី', sex: 'M', age: 37, phone: '012 345 615', father: 'ឈា សុផល', mother: 'អ៊ុំ ម៉ាលី', commune: 'ចំការស្រែ', village: 'ភូមិ២', marital: 1, occupation: 'ជាងឈើ', complaint: 'ឈឺចង្កេះរាលដល់ជើង', temp: '36.8', bp_sys: '124', bp_dia: '82', pulse: '76', resp: '17', spo2: '99', weight: '70', height: '173' },
  { fullName: 'វង្ស ស្រីមុំ', sex: 'F', age: 50, phone: '012 345 616', father: 'វង្ស សារ៉ាត់', mother: 'ស៊ន វ៉ានី', commune: 'អូរជ្រៅ', village: 'ភូមិ៤', marital: 1, occupation: 'អាជីវករ', complaint: 'នោមញឹក និងស្រេកទឹកខ្លាំង', temp: '36.9', bp_sys: '130', bp_dia: '82', pulse: '80', resp: '18', spo2: '98', weight: '60', height: '158' },
  { fullName: 'ស៊ុន វិសាល', sex: 'M', age: 27, phone: '012 345 617', father: 'ស៊ុន ហេង', mother: 'គង់ ស្រីមុំ', commune: 'បរកែវ', village: 'ភូមិ៥', marital: 0, occupation: 'គ្រូបង្រៀន', complaint: 'ក្តៅខ្លួន ញាក់ញ័រ និងឈឺសាច់ដុំ', temp: '38.9', bp_sys: '115', bp_dia: '75', pulse: '96', resp: '21', spo2: '97', weight: '65', height: '172' },
  { fullName: 'ម៉ៅ បុប្ផា', sex: 'F', age: 33, phone: '012 345 618', father: 'ម៉ៅ សុខា', mother: 'ទេព ធីតា', commune: 'ដំណាក់ចំណង', village: 'ភូមិ១', marital: 1, occupation: 'កសិករ', complaint: 'ឈឺក្បាលប្រកាំងចំហៀង', temp: '36.8', bp_sys: '118', bp_dia: '78', pulse: '75', resp: '18', spo2: '99', weight: '53', height: '160' },
  { fullName: 'កែវ សុវណ្ណ', sex: 'M', age: 60, phone: '012 345 619', father: 'កែវ ណាត', mother: 'ជិន សុខុម', commune: 'ទួលស្នួល', village: 'ភូមិ២', marital: 1, occupation: 'កសិករ', complaint: 'ក្អកមានឈាមបន្តិចបន្តួច', temp: '37.3', bp_sys: '138', bp_dia: '86', pulse: '84', resp: '20', spo2: '96', weight: '58', height: '165' },
  { fullName: 'ពៅ រដ្ឋា', sex: 'M', age: 21, phone: '012 345 620', father: 'ពៅ វិជ្ជា', mother: 'ហុង ស្រីពៅ', commune: 'ចំការស្រែ', village: 'ភូមិ៣', marital: 0, occupation: 'កម្មករ', complaint: 'រលាកក្រពះ ចុកទ្រូង', temp: '36.7', bp_sys: '120', bp_dia: '78', pulse: '76', resp: '18', spo2: '99', weight: '62', height: '169' },
  { fullName: 'ទិត្យ វណ្ណា', sex: 'M', age: 46, phone: '012 345 621', father: 'ទិត្យ គង់', mother: 'មាស សុខា', commune: 'អូរជ្រៅ', village: 'ភូមិ៥', marital: 1, occupation: 'កសិករ', complaint: 'ពិបាកដកដង្ហើមពេលយប់', temp: '36.8', bp_sys: '142', bp_dia: '88', pulse: '88', resp: '22', spo2: '95', weight: '71', height: '168' },
  { fullName: 'សេង ធារ៉ា', sex: 'F', age: 38, phone: '012 345 622', father: 'សេង វុទ្ធី', mother: 'គឹម ហៀង', commune: 'បរកែវ', village: 'ភូមិ១', marital: 1, occupation: 'កម្មករ', complaint: 'ឈឺសន្លាក់ដៃជើង', temp: '37.1', bp_sys: '116', bp_dia: '76', pulse: '80', resp: '18', spo2: '98', weight: '55', height: '159' },
  { fullName: 'នួន សម្បត្តិ', sex: 'M', age: 54, phone: '012 345 623', father: 'នួន ហេង', mother: 'លីម សុផល', commune: 'ដំណាក់ចំណង', village: 'ភូមិ២', marital: 1, occupation: 'កសិករ', complaint: 'ស្ពឹកដៃជើងទាំងសងខាង', temp: '36.6', bp_sys: '132', bp_dia: '84', pulse: '78', resp: '18', spo2: '98', weight: '67', height: '166' },
  { fullName: 'អ៊ុក សុធា', sex: 'M', age: 29, phone: '012 345 624', father: 'អ៊ុក សុខ', mother: 'ចាន់ ផល្លា', commune: 'ទួលស្នួល', village: 'ភូមិ៣', marital: 0, occupation: 'អ្នកបើកបរ', complaint: 'គ្រេចកជើង និងហើម', temp: '36.8', bp_sys: '125', bp_dia: '80', pulse: '82', resp: '18', spo2: '99', weight: '69', height: '174' },
  { fullName: 'ព្រំ ចាន់ឌី', sex: 'F', age: 25, phone: '012 345 625', father: 'ព្រំ ធារ៉ា', mother: 'អ៊ុំ សារ៉ុម', commune: 'ចំការស្រែ', village: 'ភូមិ៤', marital: 1, occupation: 'មេផ្ទះ', complaint: 'ឈឺពោះ ធ្លាក់ឈាមតិចតួច', temp: '37.0', bp_sys: '108', bp_dia: '68', pulse: '84', resp: '19', spo2: '99', weight: '51', height: '157' },
  { fullName: 'ម៉ម សុវត្ថិ', sex: 'M', age: 36, phone: '012 345 626', father: 'ម៉ម សាន', mother: 'កែវ ណារ៉េត', commune: 'អូរជ្រៅ', village: 'ភូមិ១', marital: 1, occupation: 'កម្មករ', complaint: 'របួសដៃមុតកញ្ចក់', temp: '36.7', bp_sys: '128', bp_dia: '82', pulse: '85', resp: '18', spo2: '99', weight: '64', height: '170' },
  { fullName: 'ហុង សុខលី', sex: 'F', age: 44, phone: '012 345 627', father: 'ហុង គង់', mother: 'ស៊ុន ស្រីអូន', commune: 'បរកែវ', village: 'ភូមិ២', marital: 1, occupation: 'អាជីវករ', complaint: 'ចុកដើមទ្រូង ដង្ហក់', temp: '36.9', bp_sys: '136', bp_dia: '88', pulse: '90', resp: '21', spo2: '97', weight: '62', height: '161' },
  { fullName: 'អ៊ុំ រតនៈ', sex: 'M', age: 30, phone: '012 345 628', father: 'អ៊ុំ វិសាល', mother: 'ម៉េង សុខា', commune: 'ដំណាក់ចំណង', village: 'ភូមិ៣', marital: 0, occupation: 'កសិករ', complaint: 'ពុលចំណីអាហារ ក្អួតចង្អោរ', temp: '37.6', bp_sys: '114', bp_dia: '74', pulse: '88', resp: '19', spo2: '98', weight: '66', height: '171' },
  { fullName: 'ទេព ស្រីមាស', sex: 'F', age: 22, phone: '012 345 629', father: 'ទេព សុវណ្ណ', mother: 'យន់ ធីតា', commune: 'ទួលស្នួល', village: 'ភូមិ៤', marital: 0, occupation: 'សិស្ស', complaint: 'ក្តៅខ្លួន ឈឺក្បាលខ្លាំង', temp: '38.4', bp_sys: '112', bp_dia: '70', pulse: '92', resp: '20', spo2: '98', weight: '47', height: '156' },
  { fullName: 'ឡុង វិបុល', sex: 'M', age: 58, phone: '012 345 630', father: 'ឡុង ណារិទ្ធ', mother: 'ឈុន សារ៉េត', commune: 'ចំការស្រែ', village: 'ភូមិ៥', marital: 1, occupation: 'កសិករ', complaint: 'ឈឺសន្លាក់ឆ្អឹង និងហើមជើង', temp: '36.8', bp_sys: '144', bp_dia: '90', pulse: '80', resp: '18', spo2: '96', weight: '68', height: '167' },
];

export function resetAndSeedThirtyTriagePatients(database, now = Date.now()) {
  ensureAccessSchema(database);
  ensureFinanceSchema(database);
  ensureDemoAccounts(database, now);
  const registration = database.findUser('registration') || { id: 'user:registration' };
  const photos = loadDemoPhotos();

  // 1. CLEAR ALL PREVIOUS PATIENT DATA, INVOICES, DIAGNOSES, ADMISSIONS, QUEUES
  const patientRelatedTables = [
    'patient_records',
    'patient_finance_profiles',
    'clinical_form_records',
    'admission_approvals',
    'ward_medicine_approvals',
    'ward_medicine_pending',
    'paraclinic_orders',
    'paraclinic_attachments',
    'paraclinic_extra_fees',
    'paraclinic_result_views',
    'finance_charges',
    'finance_invoices',
    'finance_payments',
    'finance_payment_attachments',
    'finance_cashier_requests',
    'finance_invoice_edit_requests',
    'finance_concession_requests',
    'finance_service_concessions',
    'patient_movement_events',
    'pharmacy_prescriptions',
    'pharmacy_discharge_dispensing',
    'opd_queue_entries',
    'queue_board_calls',
    'queue_board_skips',
    'patient_appointments',
    'patient_editor_history',
    'workflow_requests',
    'workflow_legacy_reviews',
    'request_decisions'
  ];

  database.sqlite.exec('BEGIN TRANSACTION;');
  try {
    for (const tbl of patientRelatedTables) {
      try { database.sqlite.exec(`DELETE FROM ${tbl};`); } catch (err) { /* ignore missing tables */ }
    }

    const baseDate = new Date(now);
    const dateStr = baseDate.toISOString().slice(0, 10);

    for (let i = 0; i < thirtyProfiles.length; i++) {
      const p = thirtyProfiles[i];
      const caseNumber = `BK-${dateStr.replaceAll('-', '')}-${String(1001 + i).padStart(4, '0')}`;
      const healthId = `BK-ID-${dateStr.replaceAll('-', '')}-${String(i + 1).padStart(2, '0')}`;
      const patientKey = `case:${caseNumber}`;
      const [lastName, firstName] = p.fullName.split(' ');
      const sexKh = p.sex === 'M' ? 'ប្រុស' : 'ស្រី';
      const timeStr = `${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((10 + (i * 7)) % 60).padStart(2, '0')}`;
      const dobStr = `${new Date(now).getFullYear() - p.age}-05-15`;
      const patientPhoto = getPhotoForProfile(photos, p);

      const recordJson = {
        'system:caseType': 'new',
        'system:demoPatient': 'true',
        'system:registrationQueueNumber': String(i + 1),
        'system:registeredAt': now - (thirtyProfiles.length - i) * 60000,
        // Registration form fields
        'scope:registration:id:emr_pmrs_case_new': true,
        'scope:registration:id:emr_pmrs_case_old': false,
        'scope:registration:id:web_adm_no': caseNumber,
        'scope:registration:id:web_health_id': healthId,
        'scope:registration:id:web_first_name': firstName,
        'scope:registration:id:web_last_name': lastName,
        'scope:registration:id:web_dob': dobStr,
        'scope:registration:id:web_age': String(p.age),
        'scope:registration:id:web_phone': p.phone,
        'scope:registration:id:web_date': dateStr,
        'scope:registration:id:web_time': timeStr,
        'scope:registration:id:web_entry_type': 'មកដោយខ្លួនឯង',
        'scope:registration:id:web_nat': 'ខ្មែរ',
        'scope:registration:id:web_nssf': '',
        'scope:registration:id:web_equity': '',
        'scope:registration:id:web_district': 'បរកែវ',
        'scope:registration:id:web_commune': p.commune,
        'scope:registration:id:web_village': p.village,
        'scope:registration:id:web_patient_photo': patientPhoto,
        'system:patientPhoto': patientPhoto,
        'scope:registration:auto:7': p.father,
        'scope:registration:auto:8': p.mother,
        'scope:registration:auto:11': 'រតនគិរី',
        'scope:registration:auto:17': p.sex === 'M',
        'scope:registration:auto:18': p.sex === 'F',
        'scope:registration:auto:22': p.marital === 1,
        'scope:registration:auto:23': p.marital === 0,
        'scope:registration:auto:27': p.occupation,
        // Triage status: registered & vitals filled, waiting for ward selection
        'system:workflowStage': 'TRIAGE_WAITING',
        'system:triageStatus': 'WAITING',
        'system:triageAssessedAt': now - (thirtyProfiles.length - i) * 50000,
        'scope:triage:id:pmrs_chief_complaint': p.complaint,
        'scope:triage:id:p2_temp': p.temp,
        'scope:triage:id:p2_bp_sys': p.bp_sys,
        'scope:triage:id:p2_bp_dia': p.bp_dia,
        'scope:triage:id:p2_pulse': p.pulse,
        'scope:triage:id:p2_resp': p.resp,
        'scope:triage:id:p2_spo2': p.spo2,
        'scope:triage:id:p2_weight': p.weight,
        'scope:triage:id:p2_height': p.height,
        // Ward remains unassigned so clinician/triage selects it
        'scope:triage:id:p2_dept_opd': false,
        'scope:triage:id:p2_dept_ipd': false,
        'scope:triage:id:p2_ward': '',
      };

      const summary = {
        caseNumber,
        healthId,
        firstName,
        lastName,
        fullName: p.fullName,
        sex: sexKh,
        age: String(p.age),
        dateOfBirth: dobStr,
        phone: p.phone,
        equityCard: '',
        paymentType: 'DIRECT',
        departmentCode: '',
        departmentNameKh: '',
        departmentNameEn: '',
        serviceMode: '',
        entryDate: dateStr,
        dischargeDate: '',
      };

      database.upsertPatient({
        id: crypto.randomUUID(),
        patientKey,
        summary,
        data: recordJson,
        userId: registration.id,
        savedAt: now - (thirtyProfiles.length - i) * 60000,
      });

      database.sqlite.prepare(
        "INSERT OR IGNORE INTO patient_finance_profiles (patient_key, payment_type, payment_subtype, hef_type, discount_percent, discount_amount_minor, discount_currency, payer_reference, note, updated_by, created_at, updated_at) VALUES (?, 'DIRECT', 'FULL', '', 0, 0, 'KHR', '', 'Clean v30.0 registration/triage', ?, ?, ?)"
      ).run(patientKey, registration.id, now, now);
    }

    database.sqlite.exec('COMMIT;');
    return { success: true, count: thirtyProfiles.length };
  } catch (error) {
    database.sqlite.exec('ROLLBACK;');
    throw error;
  }
}
