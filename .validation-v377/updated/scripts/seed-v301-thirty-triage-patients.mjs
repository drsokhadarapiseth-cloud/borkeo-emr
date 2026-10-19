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

// Load the 30 distinct AI-generated portrait photos
export function loadThirtyDemoPhotos() {
  const photos = [];
  for (let i = 1; i <= 30; i++) {
    const numStr = String(i).padStart(2, '0');
    const photoPath = path.join(photoDir, `patient_photo_${numStr}.jpg`);
    let dataUrl = '';
    try {
      if (fs.existsSync(photoPath)) {
        dataUrl = 'data:image/jpeg;base64,' + fs.readFileSync(photoPath).toString('base64');
      }
    } catch (err) {
      console.warn(`Could not load photo ${photoPath}:`, err.message);
    }
    photos.push(dataUrl);
  }
  return photos;
}

// 30 realistic Cambodian patient profiles with randomized authentic Borkeo gazetteer communes & villages
export const thirtyBorkeoProfiles = [
  { fullName: 'សុខ ពិសិដ្ឋ', sex: 'ប្រុស', age: 34, phone: '012 345 601', father: 'សុខ វិរៈ', mother: 'ឈុន ស្រីនាង', commune: 'កក់', communeCode: '160301', village: 'កក់', villageCode: '16030104', marital: 1, occupation: 'កសិករ', complaint: 'ក្តៅខ្លួនខ្លាំង និងក្អកស្ងួត ៣ថ្ងៃ', temp: '38.5', bp_sys: '120', bp_dia: '80', pulse: '88', resp: '20', spo2: '97', weight: '64', height: '168' },
  { fullName: 'ចាន់ ដារ៉ា', sex: 'ប្រុស', age: 28, phone: '012 345 602', father: 'ចាន់ វ៉ាន់ណេត', mother: 'សុភា ចាន់', commune: 'កិះចុង', communeCode: '160302', village: 'រវៀង', villageCode: '16030205', marital: 0, occupation: 'កម្មករ', complaint: 'ឈឺក្បាលខ្លាំង និងវិលមុខ', temp: '36.8', bp_sys: '130', bp_dia: '85', pulse: '76', resp: '18', spo2: '99', weight: '68', height: '172' },
  { fullName: 'គឹម ស្រីពៅ', sex: 'ស្រី', age: 24, phone: '012 345 603', father: 'គឹម សុគន្ធា', mother: 'ឈា រិន', commune: 'ឡាមិញ', communeCode: '160303', village: 'ត្រុំ', villageCode: '16030301', marital: 1, occupation: 'មេផ្ទះ', complaint: 'ចុកពោះផ្នែកខាងក្រោម រមួល', temp: '37.0', bp_sys: '110', bp_dia: '70', pulse: '82', resp: '18', spo2: '98', weight: '52', height: '158' },
  { fullName: 'លី វណ្ណារិទ្ធ', sex: 'ប្រុស', age: 45, phone: '012 345 604', father: 'លី ឆាយ', mother: 'ភាព សុឃីម', commune: 'លុងឃុង', communeCode: '160304', village: 'លុងឃុង', villageCode: '16030401', marital: 1, occupation: 'កសិករ', complaint: 'ឈឺទ្រូងខាងឆ្វេង និងហត់ដង្ហក់', temp: '36.6', bp_sys: '140', bp_dia: '90', pulse: '92', resp: '22', spo2: '96', weight: '72', height: '169' },
  { fullName: 'មាស សុភ័ក្ត្រ', sex: 'ស្រី', age: 31, phone: '012 345 605', father: 'មាស ចាន់', mother: 'កែវ ធីតា', commune: 'ស៊ើង', communeCode: '160305', village: 'យ៉ាសោម', villageCode: '16030501', marital: 1, occupation: 'អាជីវករ', complaint: 'រាគ និងក្អួតច្រើនដង ខ្សោះជាតិទឹក', temp: '37.4', bp_sys: '105', bp_dia: '65', pulse: '86', resp: '19', spo2: '98', weight: '54', height: '160' },
  { fullName: 'ហេង ស្រីលក្ខណ៍', sex: 'ស្រី', age: 19, phone: '012 345 606', father: 'ហេង សុវណ្ណ', mother: 'រតនា ភា', commune: 'ទីងចាក់', communeCode: '160306', village: 'ទូយ', villageCode: '16030601', marital: 0, occupation: 'សិស្ស', complaint: 'ក្តៅខ្លួន ឈឺក ពិបាកលេបអាហារ', temp: '38.2', bp_sys: '115', bp_dia: '75', pulse: '84', resp: '18', spo2: '98', weight: '48', height: '156' },
  { fullName: 'ឈុន វុទ្ធី', sex: 'ប្រុស', age: 52, phone: '012 345 607', father: 'ឈុន ស៊ុន', mother: 'យិន សាវ៉ាង', commune: 'កក់', communeCode: '160301', village: 'ដាល', villageCode: '16030102', marital: 1, occupation: 'កសិករ', complaint: 'ឈឺសន្លាក់ជង្គង់ទាំងសងខាង ហើម', temp: '36.7', bp_sys: '125', bp_dia: '80', pulse: '74', resp: '17', spo2: '99', weight: '66', height: '167' },
  { fullName: 'ពេជ្រ ម្លិះ', sex: 'ស្រី', age: 29, phone: '012 345 608', father: 'ពេជ្រ រស្មី', mother: 'រីណា សុខ', commune: 'កិះចុង', communeCode: '160302', village: 'កាំប្រាក់', villageCode: '16030206', marital: 1, occupation: 'កម្មករ', complaint: 'រលាកទឹកក្តៅស្រាលលើកំភួនដៃ', temp: '36.9', bp_sys: '118', bp_dia: '78', pulse: '80', resp: '18', spo2: '99', weight: '55', height: '162' },
  { fullName: 'ទូច ម៉ូនីកា', sex: 'ស្រី', age: 26, phone: '012 345 609', father: 'ទូច សុខ', mother: 'ម៉ៅ វណ្ណា', commune: 'ឡាមិញ', communeCode: '160303', village: 'ស៊ូ', villageCode: '16030302', marital: 0, occupation: 'បុគ្គលិក', complaint: 'ចុកពោះផ្នែកស្តាំក្រោម ឈឺចាក់ទៅក្រោយ', temp: '37.8', bp_sys: '112', bp_dia: '72', pulse: '88', resp: '20', spo2: '98', weight: '50', height: '159' },
  { fullName: 'ខេម វិរៈ', sex: 'ប្រុស', age: 39, phone: '012 345 610', father: 'ខេម សុវណ្ណ', mother: 'រ័ត្ន ស្រីម៉ៅ', commune: 'លុងឃុង', communeCode: '160304', village: 'ប៉ាអរ', villageCode: '16030402', marital: 1, occupation: 'អ្នករត់ម៉ូតូឌុប', complaint: 'គ្រោះថ្នាក់ចរាចរណ៍ ដាច់រលាត់ស្បែកជើង', temp: '36.8', bp_sys: '135', bp_dia: '85', pulse: '90', resp: '20', spo2: '98', weight: '65', height: '170' },
  { fullName: 'លីម ស្រីនិច', sex: 'ស្រី', age: 42, phone: '012 345 611', father: 'លីម វុធ', mother: 'ខៀវ ស្រីរ័ត្ន', commune: 'ស៊ើង', communeCode: '160305', village: 'ស៊ើង', villageCode: '16030502', marital: 1, occupation: 'កសិករ', complaint: 'ក្អកមានកំហាកយូរថ្ងៃ អស់កម្លាំង', temp: '37.5', bp_sys: '122', bp_dia: '80', pulse: '82', resp: '19', spo2: '97', weight: '56', height: '161' },
  { fullName: 'រ័ត្ន រស្មី', sex: 'ប្រុស', age: 23, phone: '012 345 612', father: 'រ័ត្ន សម្បត្តិ', mother: 'លី ដានី', commune: 'ទីងចាក់', communeCode: '160306', village: 'កប', villageCode: '16030602', marital: 0, occupation: 'កម្មករ', complaint: 'ឈឺធ្មេញថ្គាម និងហើមថ្ពាល់ខាងស្តាំ', temp: '37.2', bp_sys: '118', bp_dia: '76', pulse: '78', resp: '18', spo2: '99', weight: '61', height: '171' },
  { fullName: 'ញ៉ាង សុគន្ធា', sex: 'ស្រី', age: 35, phone: '012 345 613', father: 'ញ៉ាង គីមហេង', mother: 'វ៉ាន់ សុគន្ធ', commune: 'កក់', communeCode: '160301', village: 'យឺន', villageCode: '16030105', marital: 1, occupation: 'មេផ្ទះ', complaint: 'ចាញ់កូន មានផ្ទៃពោះ៣ខែ ក្អួតខ្លាំង', temp: '36.7', bp_sys: '100', bp_dia: '65', pulse: '86', resp: '18', spo2: '99', weight: '49', height: '155' },
  { fullName: 'ហ៊ូ ចាន់ណា', sex: 'ស្រី', age: 48, phone: '012 345 614', father: 'ហ៊ូ គង់', mother: 'សេង ណារី', commune: 'កិះចុង', communeCode: '160302', village: 'តាវ៉ាង', villageCode: '16030207', marital: 1, occupation: 'កសិករ', complaint: 'លើសសម្ពាធឈាម វិលមុខ និងធ្ងន់ក្បាល', temp: '36.6', bp_sys: '160', bp_dia: '95', pulse: '84', resp: '18', spo2: '98', weight: '63', height: '157' },
  { fullName: 'ឈា ភក្តី', sex: 'ប្រុស', age: 37, phone: '012 345 615', father: 'ឈា សុផល', mother: 'អ៊ុំ ម៉ាលី', commune: 'ឡាមិញ', communeCode: '160303', village: 'ញ៉ល', villageCode: '16030303', marital: 1, occupation: 'ជាងឈើ', complaint: 'ឈឺចង្កេះរាលដល់ជើង លើកធ្ងន់មិនរួច', temp: '36.8', bp_sys: '124', bp_dia: '82', pulse: '76', resp: '17', spo2: '99', weight: '70', height: '173' },
  { fullName: 'វង្ស ស្រីមុំ', sex: 'ស្រី', age: 50, phone: '012 345 616', father: 'វង្ស សារ៉ាត់', mother: 'ស៊ន វ៉ានី', commune: 'លុងឃុង', communeCode: '160304', village: 'ប៉ាយ៉ាង', villageCode: '16030403', marital: 1, occupation: 'អាជីវករ', complaint: 'នោមញឹក ស្រេកទឹកខ្លាំង ស្រកទម្ងន់', temp: '36.9', bp_sys: '130', bp_dia: '82', pulse: '80', resp: '18', spo2: '98', weight: '60', height: '158' },
  { fullName: 'ស៊ុន វិសាល', sex: 'ប្រុស', age: 27, phone: '012 345 617', father: 'ស៊ុន ហេង', mother: 'គង់ ស្រីមុំ', commune: 'ស៊ើង', communeCode: '160305', village: 'ចែត', villageCode: '16030503', marital: 0, occupation: 'គ្រូបង្រៀន', complaint: 'ក្តៅខ្លួនខ្លាំង ញាក់ញ័រ ឈឺសាច់ដុំ', temp: '38.9', bp_sys: '115', bp_dia: '75', pulse: '96', resp: '21', spo2: '97', weight: '65', height: '172' },
  { fullName: 'ម៉ៅ បុប្ផា', sex: 'ស្រី', age: 33, phone: '012 345 618', father: 'ម៉ៅ សុខា', mother: 'ទេព ធីតា', commune: 'ទីងចាក់', communeCode: '160306', village: 'លូត', villageCode: '16030603', marital: 1, occupation: 'កសិករ', complaint: 'ឈឺក្បាលប្រកាំងចំហៀង ចង្អោរ', temp: '36.8', bp_sys: '118', bp_dia: '78', pulse: '75', resp: '18', spo2: '99', weight: '53', height: '160' },
  { fullName: 'កែវ សុវណ្ណ', sex: 'ប្រុស', age: 60, phone: '012 345 619', father: 'កែវ ណាត', mother: 'ជិន សុខុម', commune: 'កក់', communeCode: '160301', village: 'ជ្រុង', villageCode: '16030106', marital: 1, occupation: 'កសិករ', complaint: 'ក្អកមានកំហាកលាយឈាម ហត់', temp: '37.3', bp_sys: '138', bp_dia: '86', pulse: '84', resp: '20', spo2: '96', weight: '58', height: '165' },
  { fullName: 'ពៅ រដ្ឋា', sex: 'ប្រុស', age: 21, phone: '012 345 620', father: 'ពៅ វិជ្ជា', mother: 'ហុង ស្រីពៅ', commune: 'កិះចុង', communeCode: '160302', village: 'បរមៀត', villageCode: '16030208', marital: 0, occupation: 'កម្មករ', complaint: 'រលាកក្រពះ ចុកទ្រូងផ្សា ឆ្អល់ពោះ', temp: '36.7', bp_sys: '120', bp_dia: '78', pulse: '76', resp: '18', spo2: '99', weight: '62', height: '169' },
  { fullName: 'ទិត្យ វណ្ណា', sex: 'ប្រុស', age: 46, phone: '012 345 621', father: 'ទិត្យ គង់', mother: 'មាស សុខា', commune: 'ឡាមិញ', communeCode: '160303', village: 'ខ្មាំង', villageCode: '16030304', marital: 1, occupation: 'កសិករ', complaint: 'ពិបាកដកដង្ហើមពេលយប់ ក្អកស្ងួត', temp: '36.8', bp_sys: '142', bp_dia: '88', pulse: '88', resp: '22', spo2: '95', weight: '71', height: '168' },
  { fullName: 'សេង ធារ៉ា', sex: 'ស្រី', age: 38, phone: '012 345 622', father: 'សេង វុទ្ធី', mother: 'គឹម ហៀង', commune: 'លុងឃុង', communeCode: '160304', village: 'ជ្រាក', villageCode: '16030404', marital: 1, occupation: 'កម្មករ', complaint: 'ឈឺសន្លាក់ដៃជើងទាំងសងខាង', temp: '37.1', bp_sys: '116', bp_dia: '76', pulse: '80', resp: '18', spo2: '98', weight: '55', height: '159' },
  { fullName: 'នួន សម្បត្តិ', sex: 'ប្រុស', age: 54, phone: '012 345 623', father: 'នួន ហេង', mother: 'លីម សុផល', commune: 'ស៊ើង', communeCode: '160305', village: 'គ្លិ', villageCode: '16030504', marital: 1, occupation: 'កសិករ', complaint: 'ស្ពឹកចុងដៃចុងជើង ដើរទ្រេត', temp: '36.6', bp_sys: '132', bp_dia: '84', pulse: '78', resp: '18', spo2: '98', weight: '67', height: '166' },
  { fullName: 'អ៊ុក សុធា', sex: 'ប្រុស', age: 29, phone: '012 345 624', father: 'អ៊ុក សុខ', mother: 'ចាន់ ផល្លា', commune: 'ទីងចាក់', communeCode: '160306', village: 'ប៉ាណល', villageCode: '16030604', marital: 0, occupation: 'អ្នកបើកបរ', complaint: 'គ្រេចកជើង និងហើមខ្លាំង ឈឺពេលដើរ', temp: '36.8', bp_sys: '125', bp_dia: '80', pulse: '82', resp: '18', spo2: '99', weight: '69', height: '174' },
  { fullName: 'ព្រំ ចាន់ឌី', sex: 'ស្រី', age: 25, phone: '012 345 625', father: 'ព្រំ ធារ៉ា', mother: 'អ៊ុំ សារ៉ុម', commune: 'កក់', communeCode: '160301', village: 'លើតូច', villageCode: '16030101', marital: 1, occupation: 'មេផ្ទះ', complaint: 'ឈឺពោះធ្លាក់ឈាមតិចតួច សង្ស័យរលូត', temp: '37.0', bp_sys: '108', bp_dia: '68', pulse: '84', resp: '19', spo2: '99', weight: '51', height: '157' },
  { fullName: 'ម៉ម សុវត្ថិ', sex: 'ប្រុស', age: 36, phone: '012 345 626', father: 'ម៉ម សាន', mother: 'កែវ ណារ៉េត', commune: 'កិះចុង', communeCode: '160302', village: 'អណ្តូងទឹក', villageCode: '16030209', marital: 1, occupation: 'កម្មករ', complaint: 'មុតកញ្ចក់លើបាតដៃ ហូរឈាម', temp: '36.7', bp_sys: '128', bp_dia: '82', pulse: '85', resp: '18', spo2: '99', weight: '64', height: '170' },
  { fullName: 'ហុង សុខលី', sex: 'ស្រី', age: 44, phone: '012 345 627', father: 'ហុង គង់', mother: 'ស៊ុន ស្រីអូន', commune: 'ឡាមិញ', communeCode: '160303', village: 'ភូមិមួយ', villageCode: '16030305', marital: 1, occupation: 'អាជីវករ', complaint: 'ចុកដើមទ្រូង ដង្ហក់ និងបែកញើសត្រជាក់', temp: '36.9', bp_sys: '136', bp_dia: '88', pulse: '90', resp: '21', spo2: '97', weight: '62', height: '161' },
  { fullName: 'អ៊ុំ រតនៈ', sex: 'ប្រុស', age: 30, phone: '012 345 628', father: 'អ៊ុំ វិសាល', mother: 'ម៉េង សុខា', commune: 'ស៊ើង', communeCode: '160305', village: 'យ៉ែម', villageCode: '16030505', marital: 0, occupation: 'កសិករ', complaint: 'ពុលចំណីអាហារ ក្អួតចង្អោរ និងរាគរូស', temp: '37.6', bp_sys: '114', bp_dia: '74', pulse: '88', resp: '19', spo2: '98', weight: '66', height: '171' },
  { fullName: 'ទេព ស្រីមាស', sex: 'ស្រី', age: 22, phone: '012 345 629', father: 'ទេព សុវណ្ណ', mother: 'យន់ ធីតា', commune: 'ស៊ើង', communeCode: '160305', village: 'ស្មាច់', villageCode: '16030506', marital: 0, occupation: 'សិស្ស', complaint: 'ក្តៅខ្លួន ឈឺក្បាលខ្លាំង និងចុកប្រឡង់ភ្នែក', temp: '38.4', bp_sys: '112', bp_dia: '70', pulse: '92', resp: '20', spo2: '98', weight: '47', height: '156' },
  { fullName: 'ឡុង វិបុល', sex: 'ប្រុស', age: 58, phone: '012 345 630', father: 'ឡុង ណារិទ្ធ', mother: 'ឈុន សារ៉េត', commune: 'កក់', communeCode: '160301', village: 'សាលា', villageCode: '16030102', marital: 1, occupation: 'កសិករ', complaint: 'ឈឺសន្លាក់ឆ្អឹង និងហើមជើងទាំងសងខាង', temp: '36.8', bp_sys: '144', bp_dia: '90', pulse: '80', resp: '18', spo2: '96', weight: '68', height: '167' },
];

export function resetAndSeedThirtyTriagePatients(database, now = Date.now()) {
  ensureAccessSchema(database);
  ensureFinanceSchema(database);
  ensureDemoAccounts(database, now);
  const registration = database.findUser('registration') || { id: 'user:registration' };
  const photos = loadThirtyDemoPhotos();

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

    for (let i = 0; i < thirtyBorkeoProfiles.length; i++) {
      const p = thirtyBorkeoProfiles[i];
      const caseNumber = `BK-${dateStr.replaceAll('-', '')}-${String(1001 + i).padStart(4, '0')}`;
      const healthId = `BK-ID-${dateStr.replaceAll('-', '')}-${String(i + 1).padStart(2, '0')}`;
      const patientKey = `case:${caseNumber}`;
      const [lastName, firstName] = p.fullName.split(' ');
      const sexKh = p.sex; // Strictly 'ប្រុស' or 'ស្រី'
      const timeStr = `${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((10 + (i * 7)) % 60).padStart(2, '0')}`;
      const dobStr = `${new Date(now).getFullYear() - p.age}-05-15`;
      const patientPhoto = photos[i] || '';

      const recordJson = {
        'system:caseType': 'new',
        'system:demoPatient': 'true',
        'system:registrationQueueNumber': String(i + 1),
        'system:registeredAt': now - (thirtyBorkeoProfiles.length - i) * 60000,
        // Complete Registration Form Fields
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
        // Address strictly in Ratanakiri, Borkeo district
        'scope:registration:id:web_province': 'រតនគិរី',
        'scope:registration:id:web_province_code': '16',
        'scope:registration:id:web_district': 'បរកែវ',
        'scope:registration:id:web_district_code': '1603',
        'scope:registration:id:web_commune': p.commune,
        'scope:registration:id:web_commune_code': p.communeCode,
        'scope:registration:id:web_village': p.village,
        'scope:registration:id:web_village_code': p.villageCode,
        'scope:registration:id:web_sex': sexKh,
        'scope:registration:id:web_sex_male': sexKh === 'ប្រុស',
        'scope:registration:id:web_sex_female': sexKh === 'ស្រី',
        // Distinct AI Portrait Photo
        'scope:registration:id:web_patient_photo': patientPhoto,
        'system:patientPhoto': patientPhoto,
        'scope:registration:auto:7': p.father,
        'scope:registration:auto:8': p.mother,
        'scope:registration:auto:11': 'រតនគិរី',
        'scope:registration:auto:14': sexKh === 'ប្រុស',
        'scope:registration:auto:15': sexKh === 'ស្រី',
        'scope:registration:auto:17': sexKh === 'ប្រុស',
        'scope:registration:auto:18': sexKh === 'ស្រី',
        'scope:registration:auto:22': p.marital === 1,
        'scope:registration:auto:23': p.marital === 0,
        'scope:registration:auto:27': p.occupation,
        // Complete Triage Assessment (WAITING for ward selection by doctor/nurse)
        'system:workflowStage': 'TRIAGE_WAITING',
        'system:triageStatus': 'WAITING',
        'system:triageAssessedAt': now - (thirtyBorkeoProfiles.length - i) * 50000,
        'scope:triage:id:pmrs_chief_complaint': p.complaint,
        'scope:triage:id:p2_temp': p.temp,
        'scope:triage:id:p2_bp_sys': p.bp_sys,
        'scope:triage:id:p2_bp_dia': p.bp_dia,
        'scope:triage:id:p2_pulse': p.pulse,
        'scope:triage:id:p2_resp': p.resp,
        'scope:triage:id:p2_spo2': p.spo2,
        'scope:triage:id:p2_weight': p.weight,
        'scope:triage:id:p2_height': p.height,
        // Ward remains unassigned so user/clinician chooses it individually
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
        savedAt: now - (thirtyBorkeoProfiles.length - i) * 60000,
      });

      database.sqlite.prepare(
        "INSERT OR IGNORE INTO patient_finance_profiles (patient_key, payment_type, payment_subtype, hef_type, discount_percent, discount_amount_minor, discount_currency, payer_reference, note, updated_by, created_at, updated_at) VALUES (?, 'DIRECT', 'FULL', '', 0, 0, 'KHR', '', 'Clean v30.1 registration/triage', ?, ?, ?)"
      ).run(patientKey, registration.id, now, now);
    }

    database.sqlite.exec('COMMIT;');
    return { success: true, count: thirtyBorkeoProfiles.length };
  } catch (error) {
    database.sqlite.exec('ROLLBACK;');
    throw error;
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const dbPath = process.argv[2] || 'data/demo.sqlite';
  const database = openDatabase(dbPath);
  try {
    const res = resetAndSeedThirtyTriagePatients(database);
    console.log(`Successfully reset database and seeded ${res.count} Borkeo patients!`);
  } finally {
    database.close();
  }
}
