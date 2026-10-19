import {PAYMENT_CATEGORIES,NSSF_SUBTYPES,majorPaymentCategory,ensurePaymentPolicySchema,paymentSettings,payerTariffCatalog,requireConcessionApproval,concessionMetadata} from './payment-policy.mjs';
import crypto from 'node:crypto';

export const PAYMENT_TYPES = Object.freeze([{code:'NOT_PAID',labelKh:'សូមជ្រើសរើសប្រភេទការទូទាត់',labelEn:'Select payment category'},...PAYMENT_CATEGORIES]);
export const DIRECT_PAYMENT_TYPES = Object.freeze([
  { code: 'FULL', labelKh: 'បង់ពេញថ្លៃ', labelEn: 'Pay in full' },
  { code: 'DISCOUNT', labelKh: 'បញ្ចុះតម្លៃ', labelEn: 'Discount' },
  { code: 'FULL_WAIVER', labelKh: 'លើកលែងការបង់ប្រាក់', labelEn: 'Payment exemption' },
]);
export const HEF_TYPES = Object.freeze([
  { code: 'EQUITY', labelKh: 'បណ្ណមូលនិធិសមធម៌', labelEn: 'Health Equity Fund Card' },
  { code: 'VULNERABLE', labelKh: 'បណ្ណងាយរងហានីភ័យ', labelEn: 'Vulnerable Card' },
]);
export const PAYMENT_PURPOSES = Object.freeze([
  { code: 'PATIENT_CARE', labelKh: 'ការព្យាបាលអ្នកជំងឺ', labelEn: 'Patient care' },
  { code: 'AMBULANCE_REFERRAL', labelKh: 'ថ្លៃបញ្ជូនអ្នកជំងឺដោយរថយន្តសង្គ្រោះ', labelEn: 'Ambulance referral' },
]);
const LEGACY_PAYMENT_TYPES = ['CASH','NSSF','HEF','EXEMPT','DISCOUNT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE'];
export const PAYMENT_TYPE_SET = new Set([...PAYMENT_TYPES.map(item => item.code), ...LEGACY_PAYMENT_TYPES]);
const DIRECT_PAYMENT_TYPE_SET = new Set(DIRECT_PAYMENT_TYPES.map(item => item.code));
const LEGACY_DIRECT_PAYMENT_TYPE_SET = new Set([...DIRECT_PAYMENT_TYPE_SET, 'PARTIAL_WAIVER']);
const HEF_TYPE_SET = new Set(HEF_TYPES.map(item => item.code));
const PAYMENT_PURPOSE_SET = new Set(PAYMENT_PURPOSES.map(item => item.code));
export const FINANCE_CURRENCIES = Object.freeze(['KHR', 'USD']);
const CURRENCY_SET = new Set(FINANCE_CURRENCIES);
const PAYMENT_SOURCES = new Set(['CASH', 'NSSF', 'HEF', 'OTHER']);


export const SERVICE_CATEGORIES = Object.freeze([
  { code:'REGISTRATION', labelKh:'ចុះឈ្មោះ', labelEn:'Registration' },
  { code:'CONSULTATION', labelKh:'ផ្នែកពិគ្រោះជំងឺក្រៅ (OPD)', labelEn:'Outpatient (OPD)' },
  { code:'BED', labelKh:'ផ្នែកជំងឺសម្រាកពេទ្យ', labelEn:'Inpatient' },
  { code:'LAB', labelKh:'ផ្នែកមន្ទីរពិសោធន៍', labelEn:'Laboratory' },
  { code:'IMAGING', labelKh:'ផ្នែករូបភាពវេជ្ជសាស្ត្រ', labelEn:'Medical Imaging' },
  { code:'PROCEDURE', labelKh:'សេវាព្យាបាល / នីតិវិធី', labelEn:'Procedure' },
  { code:'SURGERY', labelKh:'ផ្នែកវះកាត់ និងលាងរបួស', labelEn:'Surgery and Wound Care' },
  { code:'OBSTETRIC', labelKh:'ផ្នែកសម្ភព និងរោគស្ត្រី (GO)', labelEn:'Obstetrics and Gynecology (GO)' },
  { code:'EMERGENCY', labelKh:'ផ្នែកសង្គ្រោះបន្ទាន់ (REA)', labelEn:'Emergency (REA)' },
  { code:'DENTAL', labelKh:'ផ្នែកជំងឺមាត់ធ្មេញ', labelEn:'Dental' },
  { code:'EYE_CARE', labelKh:'មណ្ឌលថែទាំភ្នែក', labelEn:'Eyes Care Facility' },
  { code:'MEDICINE', labelKh:'ឱសថ', labelEn:'Medicine / Pharmacy' },
  { code:'AMBULANCE', labelKh:'រថយន្តសង្គ្រោះ', labelEn:'Ambulance' },
  { code:'DOCUMENT', labelKh:'ឯកសារ / វិញ្ញាបនបត្រ', labelEn:'Document / Certificate' },
  { code:'OTHER', labelKh:'សេវាផ្សេងៗ', labelEn:'Other' },
]);
const SERVICE_CATEGORY_SET = new Set(SERVICE_CATEGORIES.map(item => item.code));

export const DEFAULT_SERVICE_CATALOG = Object.freeze([
  ['REGISTRATION','REGISTRATION','ចុះឈ្មោះអ្នកជំងឺ','Patient registration'],
  ['OPD_CONSULT','CONSULTATION','ពិគ្រោះក្រៅ','OPD consultation'],
  ['EMERGENCY_CONSULT','CONSULTATION','ពិគ្រោះសង្គ្រោះបន្ទាន់','Emergency consultation'],
  ['IPD_BED_DAY','BED','ថ្លៃគ្រែសម្រាកពេទ្យ / ថ្ងៃ','IPD bed / day'],
  ['ICU_BED_DAY','BED','ថ្លៃគ្រែ ICU / ថ្ងៃ','ICU bed / day'],
  ['NCU_BED_DAY','BED','ថ្លៃគ្រែ NCU / ថ្ងៃ','NCU bed / day'],
  ['LAB_SERVICE','LAB','សេវាមន្ទីរពិសោធន៍','Laboratory service'],
  ['XRAY','IMAGING','ថតកាំរស្មីអ៊ិច','X-Ray'],
  ['ULTRASOUND','IMAGING','អេកូសាស្ត្រ','Ultrasound'],
  ['CT_SCAN','IMAGING','CT Scan','CT Scan'],
  ['MRI','IMAGING','MRI','MRI'],
  ['ECG','IMAGING','វាស់ចង្វាក់បេះដូង (ECG)','ECG examination'],
  ['EEG','IMAGING','វាស់រលកខួរក្បាល (EEG)','EEG examination'],
  ['ECHOCARDIOLOGY','IMAGING','ពិនិត្យអេកូបេះដូង','Echocardiology'],
  ['FIBROSCOPY','IMAGING','ឆ្លុះក្រពះពោះវៀន (Fibroscopy)','Fibroscopy (Upper GI)'],
  ['COLOSCOPY','IMAGING','ឆ្លុះពោះវៀនធំ (Coloscopy)','Coloscopy (Colonoscopy)'],
  ['OTOSCOPY','IMAGING','ឆ្លុះត្រចៀក (Otoscopy)','Otoscopy'],
  ['RHINOSCOPY','IMAGING','ឆ្លុះច្រមុះ (Rhinoscopy)','Rhinoscopy'],
  ['BRONCHOSCOPY','IMAGING','ឆ្លុះទងសួត (Bronchoscopy)','Bronchoscopy'],
  ['LARYNGOSCOPY','IMAGING','ឆ្លុះបំពង់សំឡេង (Laryngoscopy)','Laryngoscopy'],
  ['INJECTION','PROCEDURE','ចាក់ថ្នាំ','Injection'],
  ['DRESSING','PROCEDURE','លាង / បង់របួស','Dressing / Wound care'],
  ['NEBULIZATION','PROCEDURE','បាញ់ថ្នាំសួត','Nebulization'],
  ['MINOR_PROCEDURE','PROCEDURE','នីតិវិធីតូច','Minor procedure'],
  ['MINOR_SURGERY','SURGERY','វះកាត់តូច','Minor surgery'],
  ['MAJOR_SURGERY','SURGERY','វះកាត់ធំ','Major surgery'],
  ['NORMAL_DELIVERY','OBSTETRIC','សម្រាលកូនធម្មតា','Normal delivery'],
  ['CAESAREAN','OBSTETRIC','វះកាត់សម្រាលកូន','Caesarean section'],
  ['MEDICINE','MEDICINE','ថ្លៃឱសថ','Medicines / Pharmacy'],
  ['AMBULANCE_REFERRAL','AMBULANCE','ថ្លៃបញ្ជូនដោយរថយន្តសង្គ្រោះ','Ambulance referral'],
  ['MEDICAL_CERTIFICATE','DOCUMENT','វិញ្ញាបនបត្រវេជ្ជសាស្ត្រ','Medical certificate'],
  ['OTHER_SERVICE','OTHER','សេវាផ្សេងៗ','Other service'],
]);

export const FINANCE_DEPARTMENTS = Object.freeze([
  { code:'ALL', labelKh:'គ្រប់ផ្នែក', labelEn:'All departments' },
  { code:'opd', labelKh:'ផ្នែកពិគ្រោះក្រៅ', labelEn:'OPD' },
  { code:'emergency', labelKh:'ផ្នែកសង្គ្រោះបន្ទាន់', labelEn:'Emergency' },
  { code:'medicine', labelKh:'ផ្នែកជំងឺទូទៅ', labelEn:'Medicine' },
  { code:'icu', labelKh:'ផ្នែកសង្គ្រោះបន្ទាន់កម្រិតធ្ងន់', labelEn:'ICU' },
  { code:'surgery', labelKh:'ផ្នែកវះកាត់', labelEn:'Surgery' },
  { code:'pediatric', labelKh:'ផ្នែកជំងឺកុមារ', labelEn:'Pediatric' },
  { code:'tb', labelKh:'ផ្នែកជំងឺរបេង', labelEn:'Tuberculosis' },
  { code:'gyneco-obstetric', labelKh:'ផ្នែករោគស្ត្រី និងសម្ភព', labelEn:'Gynecology–Obstetric' },
  { code:'lab', labelKh:'មន្ទីរពិសោធន៍', labelEn:'Laboratory' },
  { code:'imaging', labelKh:'រូបភាពវេជ្ជសាស្ត្រ', labelEn:'Imaging' },
]);
const FINANCE_DEPARTMENT_SET = new Set(FINANCE_DEPARTMENTS.map(item => item.code));

function text(value, max = 300, required = false, label = 'Field') {
  const result = String(value ?? '').trim();
  if (required && !result) throw new Error(`${label} is required.`);
  if (result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`${label} is invalid.`);
  return result;
}

function currency(value) {
  const result = String(value || 'KHR').toUpperCase();
  if (!CURRENCY_SET.has(result)) throw new Error('Currency must be KHR or USD.');
  return result;
}

export function moneyToMinor(value, selectedCurrency) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) throw new Error('Amount is invalid.');
  return selectedCurrency === 'KHR' ? Math.round(number) : Math.round(number * 100);
}

function minorToMoney(value, selectedCurrency) {
  return selectedCurrency === 'KHR' ? Number(value || 0) : Number(value || 0) / 100;
}

function hasColumn(sqlite, table, column) {
  return sqlite.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column);
}

function addColumnIfMissing(sqlite, table, column, definition) {
  if (!hasColumn(sqlite, table, column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function profileSchemaNeedsUpgrade(sqlite) {
  const row = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='patient_finance_profiles'").get();
  return row && !String(row.sql || '').includes('NOT_PAID');
}

function upgradeProfileSchema(sqlite) {
  if (!profileSchemaNeedsUpgrade(sqlite)) return;
  sqlite.exec(`
    CREATE TABLE patient_finance_profiles_v091 (
      patient_key TEXT PRIMARY KEY,
      payment_type TEXT NOT NULL DEFAULT 'NOT_PAID' CHECK (payment_type IN ('NOT_PAID','CASH','NSSF','HEF','EXEMPT','DISCOUNT')),
      hef_type TEXT NOT NULL DEFAULT '' CHECK (hef_type IN ('','EQUITY','VULNERABLE')),
      discount_percent REAL NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
      payer_reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO patient_finance_profiles_v091
      (patient_key,payment_type,hef_type,discount_percent,payer_reference,note,updated_by,created_at,updated_at)
    SELECT patient_key,payment_type,
      CASE WHEN payment_type='HEF' THEN 'EQUITY' ELSE '' END,
      discount_percent,payer_reference,note,updated_by,created_at,updated_at
    FROM patient_finance_profiles;
    DROP TABLE patient_finance_profiles;
    ALTER TABLE patient_finance_profiles_v091 RENAME TO patient_finance_profiles;
  `);
}

function profileSchemaNeedsV141(sqlite) {
  const row = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='patient_finance_profiles'").get();
  const sql = String(row?.sql || '');
  return Boolean(row) && (!sql.includes("'DIRECT'") || !hasColumn(sqlite, 'patient_finance_profiles', 'payment_subtype'));
}

function upgradeProfileSchemaV141(sqlite) {
  if (!profileSchemaNeedsV141(sqlite)) return;
  sqlite.exec(`
    CREATE TABLE patient_finance_profiles_v141 (
      patient_key TEXT PRIMARY KEY,
      payment_type TEXT NOT NULL DEFAULT 'NOT_PAID' CHECK (payment_type IN ('NOT_PAID','DIRECT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE','CASH','NSSF','HEF','EXEMPT','DISCOUNT')),
      payment_subtype TEXT NOT NULL DEFAULT '' CHECK (payment_subtype IN ('','FULL','DISCOUNT','PARTIAL_WAIVER','FULL_WAIVER')),
      hef_type TEXT NOT NULL DEFAULT '' CHECK (hef_type IN ('','EQUITY','VULNERABLE')),
      discount_percent REAL NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
      payer_reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO patient_finance_profiles_v141
      (patient_key,payment_type,payment_subtype,hef_type,discount_percent,payer_reference,note,updated_by,created_at,updated_at)
    SELECT patient_key,payment_type,'',hef_type,discount_percent,payer_reference,note,updated_by,created_at,updated_at
    FROM patient_finance_profiles;
    DROP TABLE patient_finance_profiles;
    ALTER TABLE patient_finance_profiles_v141 RENAME TO patient_finance_profiles;
  `);
}

function dateKeyFromMs(ms) {
  const d = new Date(Number(ms));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseMonth(value) {
  const month = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Month is invalid.');
  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error('Month is invalid.');
  const start = new Date(year, monthNumber - 1, 1, 0, 0, 0, 0).getTime();
  const end = new Date(year, monthNumber, 1, 0, 0, 0, 0).getTime();
  return { month, start, end };
}

function parsePeriodRange(options = {}) {
  let { month, startDate, endDate } = options;
  if (startDate && endDate) {
    const sStr = String(startDate).trim();
    const eStr = String(endDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sStr) || !/^\d{4}-\d{2}-\d{2}$/.test(eStr)) {
      throw new Error('Date range is invalid.');
    }
    const [sy, sm, sd] = sStr.split('-').map(Number);
    const [ey, em, ed] = eStr.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime();
    const end = new Date(ey, em - 1, ed + 1, 0, 0, 0, 0).getTime();
    if (start >= end) throw new Error('Start date must be before or equal to end date.');
    return { label: `${sStr} ដល់ ${eStr}`, startDate: sStr, endDate: eStr, start, end };
  }
  if (month) {
    const parsed = parseMonth(month);
    return { label: parsed.month, month: parsed.month, start: parsed.start, end: parsed.end };
  }
  throw new Error('Either month or startDate and endDate is required.');
}

export function ensureFinanceSchema(database) {
  const sqlite = database.sqlite;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS patient_finance_profiles (
      patient_key TEXT PRIMARY KEY,
      payment_type TEXT NOT NULL DEFAULT 'NOT_PAID' CHECK (payment_type IN ('NOT_PAID','DIRECT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE','CASH','NSSF','HEF','EXEMPT','DISCOUNT')),
      payment_subtype TEXT NOT NULL DEFAULT '' CHECK (payment_subtype IN ('','FULL','DISCOUNT','PARTIAL_WAIVER','FULL_WAIVER')),
      hef_type TEXT NOT NULL DEFAULT '' CHECK (hef_type IN ('','EQUITY','VULNERABLE')),
      discount_percent REAL NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
      payer_reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
  `);
  upgradeProfileSchema(sqlite);
  upgradeProfileSchemaV141(sqlite);
  if (!hasColumn(sqlite, 'patient_finance_profiles', 'hef_type')) {
    addColumnIfMissing(sqlite, 'patient_finance_profiles', 'hef_type', "TEXT NOT NULL DEFAULT ''");
  }
  addColumnIfMissing(sqlite, 'patient_finance_profiles', 'discount_amount_minor', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'patient_finance_profiles', 'discount_currency', "TEXT NOT NULL DEFAULT 'KHR'");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_charges (
      id TEXT PRIMARY KEY,
      patient_key TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      quantity REAL NOT NULL CHECK (quantity > 0),
      unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      currency TEXT NOT NULL CHECK (currency IN ('KHR','USD')),
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      voided_by TEXT REFERENCES users(id),
      voided_at INTEGER,
      void_reason TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE INDEX IF NOT EXISTS finance_charges_patient_idx ON finance_charges(patient_key, created_at);
    CREATE TABLE IF NOT EXISTS finance_payments (
      id TEXT PRIMARY KEY,
      patient_key TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('CASH','NSSF','HEF','OTHER')),
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
      currency TEXT NOT NULL CHECK (currency IN ('KHR','USD')),
      purpose TEXT NOT NULL DEFAULT 'PATIENT_CARE',
      reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      received_by TEXT NOT NULL REFERENCES users(id),
      received_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      voided_by TEXT REFERENCES users(id),
      voided_at INTEGER,
      void_reason TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE INDEX IF NOT EXISTS finance_payments_patient_idx ON finance_payments(patient_key, received_at);
    CREATE INDEX IF NOT EXISTS finance_payments_date_idx ON finance_payments(received_at, currency);
    CREATE TABLE IF NOT EXISTS finance_expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
      currency TEXT NOT NULL CHECK (currency IN ('KHR','USD')),
      reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      spent_at INTEGER NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      voided_by TEXT REFERENCES users(id),
      voided_at INTEGER,
      void_reason TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE INDEX IF NOT EXISTS finance_expenses_date_idx ON finance_expenses(spent_at, currency);
  `);
  addColumnIfMissing(sqlite, 'finance_payments', 'purpose', "TEXT NOT NULL DEFAULT 'PATIENT_CARE'");
  addColumnIfMissing(sqlite, 'finance_payments', 'receipt_no', 'TEXT');
  addColumnIfMissing(sqlite, 'finance_payments', 'service_code', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'finance_payments', 'category_code', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'finance_payments', 'cashier_name_snapshot', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'finance_charges', 'service_code', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'finance_charges', 'source_key', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'finance_charges', 'invoice_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'finance_payments', 'invoice_id', "TEXT NOT NULL DEFAULT ''");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_invoices (
      id TEXT PRIMARY KEY,
      patient_key TEXT NOT NULL,
      invoice_no TEXT NOT NULL UNIQUE,
      created_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL,
      closed_at INTEGER,
      payment_type TEXT NOT NULL DEFAULT 'NOT_PAID',
      payment_subtype TEXT NOT NULL DEFAULT '',
      hef_type TEXT NOT NULL DEFAULT '',
      discount_percent REAL NOT NULL DEFAULT 0,
      discount_amount_minor INTEGER NOT NULL DEFAULT 0,
      discount_currency TEXT NOT NULL DEFAULT 'KHR',
      payer_reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE INDEX IF NOT EXISTS finance_invoices_patient_idx ON finance_invoices(patient_key,created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS finance_charges_source_key_idx ON finance_charges(source_key) WHERE source_key<>'';
    CREATE UNIQUE INDEX IF NOT EXISTS finance_payments_receipt_no_idx ON finance_payments(receipt_no) WHERE receipt_no IS NOT NULL;
    CREATE TABLE IF NOT EXISTS finance_payment_attachments (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL REFERENCES finance_payments(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      uploaded_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS finance_payment_attachments_payment_idx ON finance_payment_attachments(payment_id, uploaded_at);
    CREATE TABLE IF NOT EXISTS finance_service_catalog (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      category_code TEXT NOT NULL,
      name_kh TEXT NOT NULL,
      name_en TEXT NOT NULL,
      default_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (default_amount_minor >= 0),
      currency TEXT NOT NULL DEFAULT 'KHR' CHECK (currency IN ('KHR','USD')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS finance_service_catalog_category_idx ON finance_service_catalog(category_code, active, sort_order, name_en);
    CREATE TABLE IF NOT EXISTS finance_catalog_migrations (
      code TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    ) STRICT;
  `);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS finance_charges_invoice_idx ON finance_charges(invoice_id,created_at);
    CREATE INDEX IF NOT EXISTS finance_payments_invoice_idx ON finance_payments(invoice_id,received_at);`);
  // Preserve each patient's existing billing history as their first invoice.
  const legacyPatients = sqlite.prepare(`SELECT patient_key,MIN(created_at) created_at FROM finance_charges GROUP BY patient_key
    UNION SELECT patient_key,MIN(created_at) created_at FROM finance_payments GROUP BY patient_key`).all();
  for (const row of legacyPatients) {
    let invoice=sqlite.prepare('SELECT * FROM finance_invoices WHERE patient_key=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(row.patient_key);
    if(!invoice){
      const profile = sqlite.prepare('SELECT * FROM patient_finance_profiles WHERE patient_key=?').get(row.patient_key);
      const id = crypto.randomUUID();
      const date = new Date(Number(row.created_at || Date.now()));
      const prefix = `INV-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-`;
      const count = sqlite.prepare('SELECT COUNT(*) count FROM finance_invoices WHERE invoice_no LIKE ?').get(`${prefix}%`).count;
      const invoiceNo = `${prefix}${String(Number(count)+1).padStart(4,'0')}`;
      sqlite.prepare(`INSERT INTO finance_invoices
        (id,patient_key,invoice_no,created_at,payment_type,payment_subtype,hef_type,discount_percent,discount_amount_minor,discount_currency,payer_reference,note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,row.patient_key,invoiceNo,Number(row.created_at||Date.now()),profile?.payment_type||'NOT_PAID',profile?.payment_subtype||'',profile?.hef_type||'',profile?.discount_percent||0,profile?.discount_amount_minor||0,profile?.discount_currency||'KHR',profile?.payer_reference||'',profile?.note||'');
      invoice={id};
    }
    sqlite.prepare("UPDATE finance_charges SET invoice_id=? WHERE patient_key=? AND invoice_id='' ").run(invoice.id,row.patient_key);
    sqlite.prepare("UPDATE finance_payments SET invoice_id=? WHERE patient_key=? AND invoice_id='' ").run(invoice.id,row.patient_key);
  }
  addColumnIfMissing(sqlite, 'finance_service_catalog', 'department_code', "TEXT NOT NULL DEFAULT 'ALL'");
  addColumnIfMissing(sqlite, 'finance_service_catalog', 'unit_label', "TEXT NOT NULL DEFAULT 'service'");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_exchange_rates (
      id TEXT PRIMARY KEY,
      khr_per_usd REAL NOT NULL CHECK (khr_per_usd > 0),
      status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
      proposed_by TEXT NOT NULL REFERENCES users(id),
      proposed_at INTEGER NOT NULL,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at INTEGER,
      review_note TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE INDEX IF NOT EXISTS finance_exchange_rates_status_idx ON finance_exchange_rates(status,proposed_at DESC);
  `);
  const serviceCount = sqlite.prepare('SELECT COUNT(*) count FROM finance_service_catalog').get().count;
  if (!serviceCount) {
    const now = Date.now();
    const insertService = sqlite.prepare(`INSERT OR IGNORE INTO finance_service_catalog
      (id,code,category_code,name_kh,name_en,default_amount_minor,currency,active,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    DEFAULT_SERVICE_CATALOG.forEach((row, index) => insertService.run(
      crypto.randomUUID(), row[0], row[1], row[2], row[3], 0, 'KHR', 1, index + 1, now, now,
    ));
  }
  sqlite.prepare("UPDATE finance_service_catalog SET default_amount_minor=5000,currency='KHR',department_code='opd' WHERE code='OPD_CONSULT' AND default_amount_minor=0").run();
  sqlite.prepare("UPDATE finance_service_catalog SET default_amount_minor=11500,currency='USD',department_code='imaging' WHERE code='CT_SCAN' AND default_amount_minor=0").run();
  sqlite.prepare("UPDATE finance_service_catalog SET default_amount_minor=15000,currency='USD',department_code='imaging' WHERE code='MRI' AND default_amount_minor=0").run();
  sqlite.prepare("UPDATE finance_service_catalog SET department_code='imaging' WHERE code IN ('XRAY','ULTRASOUND') AND department_code='ALL'").run();
  sqlite.prepare("UPDATE finance_service_catalog SET department_code='lab' WHERE code='LAB_SERVICE' AND department_code='ALL'").run();
  const officialFeeSchedule=[
    // I. Outpatient
    ['OPD_REFERRAL','CONSULTATION','ពិគ្រោះក្រៅ មានលិខិតបញ្ជូនពីមណ្ឌលសុខភាព','OPD consultation with health-centre referral',3000,'KHR','opd','visit'],
    ['OPD_CONSULT','CONSULTATION','ពិគ្រោះក្រៅ គ្មានលិខិតបញ្ជូនពីមណ្ឌលសុខភាព','OPD consultation without health-centre referral',5000,'KHR','opd','visit'],
    // II. Inpatient fees specified by the supplied list
    ['IPD_CHILD_UNDER_7_DAYS','BED','ជំងឺកុមារ សម្រាកក្រោម ៧ថ្ងៃ','Pediatric inpatient stay under 7 days',80000,'KHR','pediatric','admission'],
    ['IPD_OVER_7_DAYS_DAILY','BED','ជំងឺទូទៅ សម្រាកលើស ៧ថ្ងៃ៖ ៥,០០០៛ ក្នុងមួយថ្ងៃ','General inpatient stay over 7 days: 5,000 KHR per day',5000,'KHR','ALL','day after day 7'],
    ['IPD_OVER_7_DAYS_DAILY_REFERRAL','BED','ជំងឺទូទៅ សម្រាកលើស ៧ថ្ងៃ៖ ៤,៥០០៛ ក្នុងមួយថ្ងៃ (បញ្ចុះ ១០% មានលិខិតបញ្ជូនពី HC)','General inpatient stay over 7 days: 4,500 KHR per day (10% discount with health-centre referral)',4500,'KHR','ALL','day after day 7'],
    // III. Gynecology and obstetric services
    ['GO_NORMAL_DELIVERY_OR_WOMENS_DISEASE','OBSTETRIC','សម្រាលកូនធម្មតា ឬ ជំងឺស្ត្រី','Normal delivery or women’s disease',80000,'KHR','gyneco-obstetric','case'],
    ['GO_INTERVENTION_DELIVERY','OBSTETRIC','សម្រាលកូនដោយអន្តរាគមន៍','Delivery with intervention',100000,'KHR','gyneco-obstetric','case'],
    ['GO_IUD','OBSTETRIC','ពន្យារកំណើត ដាក់កងក្នុងស្បូន','Contraception: IUD insertion',60000,'KHR','gyneco-obstetric','case'],
    ['GO_TUBAL_LIGATION','OBSTETRIC','វះកាត់ចងដៃស្បូន','Tubal ligation surgery',300000,'KHR','gyneco-obstetric','case'],
    ['GO_SUBDERMAL_IMPLANT','OBSTETRIC','ដាក់កងក្រោមស្បែក','Subdermal contraceptive implant',60000,'KHR','gyneco-obstetric','case'],
    ['GO_REFERRAL_OR_DELIVERY_LETTER','OBSTETRIC','លិខិតបញ្ជូន ឬ លិខិតសម្រាលកូន (អ្នកជំងឺសម្រាកពេទ្យមិនគិតថ្លៃ)','Referral or delivery letter (free for inpatients)',20000,'KHR','gyneco-obstetric','document'],
    ['GO_CERVIX_EXAM','OBSTETRIC','ពិនិត្យមាត់ស្បូន','Cervix examination',20000,'KHR','gyneco-obstetric','exam'],
    ['GO_STI_EXAM','OBSTETRIC','ពិនិត្យកាមរោគ','STI examination',20000,'KHR','gyneco-obstetric','exam'],
    ['GO_VACUUM_ABORTION','OBSTETRIC','រំលូតដោយបូម','Vacuum abortion',120000,'KHR','gyneco-obstetric','case'],
    ['GO_MEDICAL_ABORTION','OBSTETRIC','រំលូតដោយប្រើថ្នាំ','Medical abortion',100000,'KHR','gyneco-obstetric','case'],
    ['GO_GENITAL_WART_TREATMENT','OBSTETRIC','ព្យាបាលសិរមាន់','Genital wart treatment',40000,'KHR','gyneco-obstetric','case'],
    ['GO_SUSPICIOUS_CELLS_TREATMENT','OBSTETRIC','ព្យាបាលកោសិកាសង្ស័យមហារីក','Treatment of suspicious cancer cells',60000,'KHR','gyneco-obstetric','case'],
    ['GO_CERVICAL_CANCER_SCREEN','OBSTETRIC','ពិនិត្យរកកោសិកាមហារីកមាត់ស្បូន','Cervical cancer cell screening',40000,'KHR','gyneco-obstetric','test'],
    // IV. Emergency
    ['REA_24_HOUR_EMERGENCY','EMERGENCY','សង្គ្រោះបន្ទាន់ ១ថ្ងៃ / ២៤ម៉ោង','Emergency care per 24 hours',120000,'KHR','emergency','24 hours'],
    // V. Medical imaging
    ['XRAY_SINGLE_PLATE','IMAGING','ថតកាំរស្មីអ៊ិច ១ប៉ុស្ត (លើកលែងករណីរបេង)','X-ray, one plate (except tuberculosis cases)',20000,'KHR','imaging','plate'],
    ['ULTRASOUND','IMAGING','ពិនិត្យអេកូសាស្ត្រ','Ultrasound examination',15000,'KHR','imaging','exam'],
    ['CT_SCAN','IMAGING','ពិនិត្យ CT Scan','CT Scan examination',0,'KHR','imaging','exam'],
    ['MRI','IMAGING','ពិនិត្យ MRI','MRI examination',0,'KHR','imaging','exam'],
    ['ECG','IMAGING','វាស់ចង្វាក់បេះដូងដោយម៉ាស៊ីន ECG','ECG examination',0,'KHR','imaging','exam'],
    ['EEG','IMAGING','វាស់រលកខួរក្បាល EEG','EEG examination',0,'KHR','imaging','exam'],
    ['ECHOCARDIOLOGY','IMAGING','ពិនិត្យអេកូបេះដូង Echocardiology','Echocardiology examination',0,'KHR','imaging','exam'],
    ['FIBROSCOPY','IMAGING','ឆ្លុះក្រពះពោះវៀន Fibroscopy','Fibroscopy (Upper GI)',0,'KHR','imaging','exam'],
    ['COLOSCOPY','IMAGING','ឆ្លុះពោះវៀនធំ Coloscopy','Coloscopy (Colonoscopy)',0,'KHR','imaging','exam'],
    ['OTOSCOPY','IMAGING','ឆ្លុះត្រចៀក Otoscopy','Otoscopy (Ear Endoscopy)',0,'KHR','imaging','exam'],
    ['RHINOSCOPY','IMAGING','ឆ្លុះច្រមុះ Rhinoscopy','Rhinoscopy (Nasal Endoscopy)',0,'KHR','imaging','exam'],
    ['BRONCHOSCOPY','IMAGING','ឆ្លុះទងសួត Bronchoscopy','Bronchoscopy (Airway Endoscopy)',0,'KHR','imaging','exam'],
    ['LARYNGOSCOPY','IMAGING','ឆ្លុះបំពង់សំឡេង Laryngoscopy','Laryngoscopy',0,'KHR','imaging','exam'],
    // VI. Surgery and wound care
    ['MAJOR_SURGERY','SURGERY','វះកាត់ធំ','Major surgery',600000,'KHR','surgery','case'],
    ['MEDIUM_SURGERY','SURGERY','វះកាត់មធ្យម','Medium surgery',400000,'KHR','surgery','case'],
    ['PHYSICAL_EXAMINATION','PROCEDURE','ពិនិត្យកាយសម្បទា','Physical examination',40000,'KHR','ALL','exam'],
    ['MINOR_SURGERY_OUTPATIENT','SURGERY','វះកាត់តូច មិនដេកពេទ្យ','Minor outpatient surgery',50000,'KHR','surgery','case'],
    ['WOUND_CLEANING_OUTPATIENT','SURGERY','លាងរបួស មិនដេកពេទ្យ','Outpatient wound cleaning',10000,'KHR','ALL','case'],
    ['MINOR_SURGERY_INPATIENT','SURGERY','វះកាត់តូច ដេររបួស ដេកពេទ្យ','Minor inpatient surgery with suturing',120000,'KHR','surgery','case'],
    ['SPLINT_OUTPATIENT','SURGERY','រុំផ្លាត មិនដេកពេទ្យ','Outpatient splint / bandage',60000,'KHR','surgery','case'],
    ['SPLINT_TRACTION','SURGERY','រុំផ្លាត និងទាញតម្រង់ឆ្អឹង','Splint and bone traction',120000,'KHR','surgery','case'],
    ['GASTRIC_LAVAGE_INPATIENT','PROCEDURE','លាងក្រពះ និងសម្រាកពេទ្យ','Gastric lavage with inpatient stay',120000,'KHR','ALL','case'],
    // VII–VIII. Laboratory
    ['MALARIA','LAB','ពិនិត្យជំងឺគ្រុនចាញ់','Malaria test',0,'KHR','lab','test'],
    ['CBC','LAB','រូបមន្តឈាម','Complete blood count',8000,'KHR','lab','test'],
    ['STOOL_TEST','LAB','ពិនិត្យលាមក','Stool test',5000,'KHR','lab','test'],
    ['GLUCOSE','LAB','កម្រិតជាតិស្ករក្នុងឈាម','Blood glucose',5000,'KHR','lab','test'],
    ['TRIGLYCERIDE','LAB','Triglycerid','Triglyceride',8000,'KHR','lab','test'],
    ['URINE_TEST','LAB','ទឹកនោម','Urine test',5000,'KHR','lab','test'],
    ['TYPHOID_TEST','LAB','គ្រុនពោះវៀន','Typhoid test',5000,'KHR','lab','test'],
    ['VIRAL_MARKERS','LAB','ថ្លើម (HBs Ag-HCV-HBs Ac)','Liver tests (HBs Ag-HCV-HBs Ac)',20000,'KHR','lab','panel'],
    ['CHOLESTEROL','LAB','Cholesterol','Cholesterol',8000,'KHR','lab','test'],
    ['URIC_ACID','LAB','Uric Acid','Uric Acid',8000,'KHR','lab','test'],
    ['DENGUE_NS1','LAB','ពិនិត្យគ្រុនឈាម (NS1)','Dengue NS1',30000,'KHR','lab','test'],
    ['HBA1C','LAB','ពិនិត្យ HbA1C','HbA1C test',30000,'KHR','lab','test'],
    ['UREA','LAB','Urea','Urea',8000,'KHR','lab','test'],
    ['CREAT','LAB','Creatinine','Creatinine',8000,'KHR','lab','test'],
    ['AST','LAB','AST/GOT','AST/GOT',8000,'KHR','lab','test'],
    ['ALT','LAB','ALT/GPT','ALT/GPT',8000,'KHR','lab','test'],
    ['IONOGRAM','LAB','Ionogram','Ionogram',20000,'KHR','lab','test'],
    ['CA','LAB','Ca','Calcium',10000,'KHR','lab','test'],
    ['TP','LAB','TP','Total protein',15000,'KHR','lab','test'],
    ['INR','LAB','TCA/INR','TCA/INR',15000,'KHR','lab','test'],
    ['BILIRUBIN_DIRECT','LAB','Billirubine direct','Direct bilirubin',15000,'KHR','lab','test'],
    ['BILIRUBIN_INDIRECT','LAB','Bilirubine indirect','Indirect bilirubin',15000,'KHR','lab','test'],
    ['CRP','LAB','CRP','CRP',20000,'KHR','lab','test'],
    // IX. Dental
    ['DENTAL_EXAM','DENTAL','ពិគ្រោះជំងឺធ្មេញ','Dental consultation',5000,'KHR','opd','visit'],
    ['DENTAL_NORMAL_EXTRACTION','DENTAL','ដកធ្មេញធម្មតា (ធ្មេញព្រៃ)','Simple tooth extraction (deciduous tooth)',10000,'KHR','opd','tooth'],
    ['DENTAL_COMPLEX_EXTRACTION','DENTAL','ដកធ្មេញមិនធម្មតា (ធ្មេញស្រុក)','Complex tooth extraction (permanent tooth)',20000,'KHR','opd','tooth'],
    ['DENTAL_ROOT_EXTRACTION_FILL','DENTAL','ដកធ្មេញយកសរសៃ និងបិទប៉ះ','Tooth extraction with root and filling',50000,'KHR','opd','tooth'],
    ['DENTAL_CLEANING','DENTAL','សម្អាតធ្មេញ','Dental cleaning',20000,'KHR','opd','visit'],
    ['DENTAL_SURGERY','DENTAL','វះកាត់ធ្មេញ','Dental surgery',40000,'KHR','opd','case'],
    ['DENTAL_XRAY_OPD','DENTAL','ថតធ្មេញ (សម្រាប់ពិគ្រោះជំងឺក្រៅ)','Dental X-ray (OPD consultation)',20000,'KHR','opd','exam'],
    ['DENTAL_FILLING','DENTAL','ប៉ះធ្មេញ','Dental filling',20000,'KHR','opd','tooth'],
    // X. Ambulance
    ['AMBULANCE_0_5KM','AMBULANCE','រថយន្តសង្គ្រោះ ០–៥ គ.ម','Ambulance 0–5 km',30000,'KHR','ALL','trip'],
    ['AMBULANCE_6_15KM','AMBULANCE','រថយន្តសង្គ្រោះ ៦–១៥ គ.ម','Ambulance 6–15 km',60000,'KHR','ALL','trip'],
    ['AMBULANCE_15_25KM','AMBULANCE','រថយន្តសង្គ្រោះ ១៥–២៥ គ.ម','Ambulance 15–25 km',90000,'KHR','ALL','trip'],
    ['AMBULANCE_25_50KM','AMBULANCE','រថយន្តសង្គ្រោះ ២៥–៥០ គ.ម','Ambulance 25–50 km',120000,'KHR','ALL','trip'],
    ['AMBULANCE_OVER_50KM','AMBULANCE','រថយន្តសង្គ្រោះ ចាប់ពី ៥០ គ.ម៖ គិតក្នុង ១ គ.ម','Ambulance from 50 km: fee per kilometre',3000,'KHR','ALL','km after 50'],
    ['AMBULANCE_VIETNAM','AMBULANCE','បញ្ជូនអ្នកជំងឺទៅប្រទេសវៀតណាម','Patient transport to Vietnam',800000,'KHR','ALL','trip'],
    // Eye Care Facility, transcribed and confirmed by the user
    ['EYE_CONSULT_EXAM_TREAT','EYE_CARE','ពិគ្រោះ ពិនិត្យ និងព្យាបាលជំងឺភ្នែក','Eye consultation, examination and treatment',10000,'KHR','opd','visit'],
    ['EYE_VISION_TEST','EYE_CARE','វាស់គំហើញភ្នែក','Vision test',5000,'KHR','opd','test'],
    ['EYE_FOREIGN_BODY_REMOVAL','EYE_CARE','យកសម្រាមចេញពីភ្នែក','Removal of foreign body from eye',25000,'KHR','opd','procedure'],
    ['EYE_LACRIMAL_IRRIGATION','EYE_CARE','លាងថង់ទឹកភ្នែក','Lacrimal sac irrigation',25000,'KHR','opd','procedure'],
    ['EYE_PREMADE_GLASSES','EYE_CARE','វ៉ែនតាដែលមានលេខស្រាប់','Ready-made prescription glasses',40000,'KHR','opd','pair'],
    ['EYE_BASIC_GLASSES','EYE_CARE','កាត់កញ្ចក់វ៉ែនតា និងដងធម្មតា','Basic prescription lenses and frame',60000,'KHR','opd','pair'],
    ['EYE_MEDIUM_GLASSES','EYE_CARE','កាត់កញ្ចក់វ៉ែនតា និងដងមធ្យម','Medium-quality prescription lenses and frame',100000,'KHR','opd','pair'],
    ['EYE_PREMIUM_GLASSES','EYE_CARE','កាត់កញ្ចក់វ៉ែនតា និងដងល្អ','Good-quality prescription lenses and frame',140000,'KHR','opd','pair'],
    ['EYE_PROGRESSIVE_GLASSES','EYE_CARE','កាត់កញ្ចក់វ៉ែនតា និងដងល្អ (កញ្ចក់ Progressive)','Good-quality lenses and frame (Progressive lenses)',180000,'KHR','opd','pair'],
    ['EYE_MINOR_SURGERY','EYE_CARE','វះកាត់តូចភ្នែក','Minor eye surgery',50000,'KHR','opd','case'],
  ];
  if (!sqlite.prepare("SELECT 1 FROM finance_catalog_migrations WHERE code='OFFICIAL_FEES_V146' ").get()) {
    const now=Date.now();
    const currentCodes=officialFeeSchedule.map(fee=>fee[0]);
    const legacyCodes=DEFAULT_SERVICE_CATALOG.map(row=>row[0]);
    const placeholders=values=>values.map(()=>'?').join(',');
    sqlite.prepare(`UPDATE finance_service_catalog SET active=0,updated_at=?
      WHERE (sort_order>=100 OR code IN (${placeholders(legacyCodes)})) AND code NOT IN (${placeholders(currentCodes)})`)
      .run(now,...legacyCodes,...currentCodes);
    const upsertFee=sqlite.prepare(`INSERT INTO finance_service_catalog
      (id,code,category_code,name_kh,name_en,default_amount_minor,currency,active,sort_order,created_at,updated_at,department_code,unit_label)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(code) DO UPDATE SET category_code=excluded.category_code,name_kh=excluded.name_kh,name_en=excluded.name_en,
        default_amount_minor=excluded.default_amount_minor,currency=excluded.currency,active=1,sort_order=excluded.sort_order,
        updated_at=excluded.updated_at,department_code=excluded.department_code,unit_label=excluded.unit_label`);
    officialFeeSchedule.forEach((fee,index)=>upsertFee.run(crypto.randomUUID(),fee[0],fee[1],fee[2],fee[3],fee[4],fee[5],1,100+index,now,now,fee[6],fee[7]));
    sqlite.prepare('INSERT INTO finance_catalog_migrations (code,applied_at) VALUES (?,?)').run('OFFICIAL_FEES_V146',now);
  }
  if (!sqlite.prepare("SELECT 1 FROM finance_catalog_migrations WHERE code='OFFICIAL_FEES_V149'").get()) {
    const now=Date.now();
    // Keep the old code for invoice/catalog history, but prevent the incorrect service from new invoices.
    sqlite.prepare("UPDATE finance_service_catalog SET active=0,updated_at=? WHERE code='GO_SYPHILIS_TREATMENT'").run(now);
    sqlite.prepare(`INSERT INTO finance_service_catalog
      (id,code,category_code,name_kh,name_en,default_amount_minor,currency,active,sort_order,created_at,updated_at,department_code,unit_label)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(code) DO UPDATE SET category_code=excluded.category_code,name_kh=excluded.name_kh,name_en=excluded.name_en,
        default_amount_minor=excluded.default_amount_minor,currency=excluded.currency,active=1,
        updated_at=excluded.updated_at,department_code=excluded.department_code,unit_label=excluded.unit_label`)
      .run(crypto.randomUUID(),'GO_GENITAL_WART_TREATMENT','OBSTETRIC','ព្យាបាលសិរមាន់','Genital wart treatment',40000,'KHR',1,115,now,now,'gyneco-obstetric','case');
    sqlite.prepare('INSERT INTO finance_catalog_migrations (code,applied_at) VALUES (?,?)').run('OFFICIAL_FEES_V149',now);
  }
  if (!sqlite.prepare("SELECT 1 FROM finance_catalog_migrations WHERE code='OFFICIAL_FEES_V162'").get()) {
    const now=Date.now();
    const wardFees=[
      ['IPD_MEDICINE_WARD_FEE','BED','សម្រាកពេទ្យផ្នែកជំងឺទូទៅ','Medicine ward inpatient fee',80000,'KHR','medicine','admission'],
      ['IPD_ICU_WARD_FEE','BED','សម្រាកព្យាបាលនៅ ICU (កំណត់តម្លៃដោយ Admin)','ICU inpatient fee (price set by Admin)',0,'KHR','icu','admission'],
      ['AMBULANCE_TRANSFER_IN_0_5KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចូល · ០–៥ គ.ម','Ambulance transfer in · 0–5 km',30000,'KHR','ALL','trip'],
      ['AMBULANCE_TRANSFER_IN_6_15KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចូល · ៦–១៥ គ.ម','Ambulance transfer in · 6–15 km',60000,'KHR','ALL','trip'],
      ['AMBULANCE_TRANSFER_IN_15_25KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចូល · ១៥–២៥ គ.ម','Ambulance transfer in · 15–25 km',90000,'KHR','ALL','trip'],
      ['AMBULANCE_TRANSFER_IN_25_50KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចូល · ២៥–៥០ គ.ម','Ambulance transfer in · 25–50 km',120000,'KHR','ALL','trip'],
      ['AMBULANCE_TRANSFER_IN_OVER_50KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចូល · លើស ៥០ គ.ម','Ambulance transfer in · over 50 km',3000,'KHR','ALL','per km after 50 km'],
      ['AMBULANCE_TRANSFER_OUT_0_5KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចេញ · ០–៥ គ.ម','Ambulance transfer out · 0–5 km',30000,'KHR','ALL','trip'],
      ['AMBULANCE_TRANSFER_OUT_6_15KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចេញ · ៦–១៥ គ.ម','Ambulance transfer out · 6–15 km',60000,'KHR','ALL','trip'],
      ['AMBULANCE_TRANSFER_OUT_15_25KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចេញ · ១៥–២៥ គ.ម','Ambulance transfer out · 15–25 km',90000,'KHR','ALL','trip'],
      ['AMBULANCE_TRANSFER_OUT_25_50KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចេញ · ២៥–៥០ គ.ម','Ambulance transfer out · 25–50 km',120000,'KHR','ALL','trip'],
      ['AMBULANCE_TRANSFER_OUT_OVER_50KM','AMBULANCE','រថយន្តសង្គ្រោះបញ្ជូនចេញ · លើស ៥០ គ.ម','Ambulance transfer out · over 50 km',3000,'KHR','ALL','per km after 50 km'],
    ];
    const upsert=sqlite.prepare(`INSERT INTO finance_service_catalog
      (id,code,category_code,name_kh,name_en,default_amount_minor,currency,active,sort_order,created_at,updated_at,department_code,unit_label)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(code) DO NOTHING`);
    wardFees.forEach((fee,index)=>upsert.run(crypto.randomUUID(),fee[0],fee[1],fee[2],fee[3],fee[4],fee[5],fee[0]==='IPD_ICU_WARD_FEE'?0:1,300+index,now,now,fee[6],fee[7]));
    // This existing official pediatric tariff is used as the pediatric ward
    // admission fee; its stable code keeps prior invoices and references intact.
    sqlite.prepare("UPDATE finance_service_catalog SET name_kh='សម្រាកពេទ្យផ្នែកកុមារ',name_en='Pediatric ward inpatient fee',department_code='pediatric',unit_label='admission',updated_at=? WHERE code='IPD_CHILD_UNDER_7_DAYS'").run(now);
    sqlite.prepare('INSERT INTO finance_catalog_migrations (code,applied_at) VALUES (?,?)').run('OFFICIAL_FEES_V162',now);
  }
  if (!sqlite.prepare("SELECT 1 FROM finance_exchange_rates WHERE status='APPROVED' LIMIT 1").get()) {
    const admin=sqlite.prepare("SELECT id FROM users WHERE role='ADMIN' ORDER BY created_at LIMIT 1").get();
    if (admin) sqlite.prepare(`INSERT INTO finance_exchange_rates (id,khr_per_usd,status,proposed_by,proposed_at,reviewed_by,reviewed_at,review_note)
      VALUES (?,?, 'APPROVED',?,?,?,?,?)`).run(crypto.randomUUID(),4000,admin.id,Date.now(),admin.id,Date.now(),'Initial exchange rate');
  }
  ensurePaymentPolicySchema(database);
}

function profileFromRow(row) {
  if (!row) return null;
  return {
    patientKey: row.patient_key,
    paymentType: row.payment_type,
    paymentSubtype: row.payment_subtype || '',
    nssfSubtype:row.nssf_subtype||({NSSF_CIVIL:'CIVIL',NSSF_WORKER:'FORMAL',NSSF_OUTSIDE:'INFORMAL'})[row.payment_type]||'',
    payerName:row.payer_name||'', approvalId:row.concession_approval_id||'',
    coverageRequired:row.coverage_required===1,coverageAt:row.coverage_at||null,
    hefType: row.hef_type || '',
    discountPercent: Number(row.discount_percent || 0),
    discountAmount: minorToMoney(row.discount_amount_minor || 0, row.discount_currency || 'KHR'),
    discountCurrency: row.discount_currency || 'KHR',
    payerReference: row.payer_reference || '',
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getFinanceProfile(database, patientKey) {
  return profileFromRow(database.sqlite.prepare('SELECT * FROM patient_finance_profiles WHERE patient_key=?').get(patientKey));
}

function invoiceFromRow(row) {
  if (!row) return null;
  return {
    id:row.id, patientKey:row.patient_key, invoiceNo:row.invoice_no,
    createdAt:Number(row.created_at), closedAt:row.closed_at==null?null:Number(row.closed_at),
    coverageRequired:row.coverage_required===1,coverageAt:row.coverage_at||null,
  };
}

function getInvoiceRow(database, patientKey, invoiceId='') {
  const sqlite=database.sqlite;
  if (invoiceId) return sqlite.prepare('SELECT * FROM finance_invoices WHERE patient_key=? AND id=?').get(patientKey,invoiceId)||null;
  return sqlite.prepare('SELECT * FROM finance_invoices WHERE patient_key=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(patientKey)||null;
}

function invoiceProfile(database, patientKey, invoiceId) {
  const row=invoiceId?getInvoiceRow(database,patientKey,invoiceId):null;
  return row?profileFromRow({
    patient_key:patientKey,payment_type:row.payment_type,payment_subtype:row.payment_subtype,hef_type:row.hef_type,
    nssf_subtype:row.nssf_subtype,payer_name:row.payer_name,concession_approval_id:row.concession_approval_id,coverage_required:row.coverage_required,coverage_at:row.coverage_at,discount_percent:row.discount_percent,discount_amount_minor:row.discount_amount_minor,discount_currency:row.discount_currency,
    payer_reference:row.payer_reference,note:row.note,created_at:row.created_at,updated_at:row.created_at,
  }):(getFinanceProfile(database,patientKey)||defaultProfile(patientKey,database.findPatient(patientKey)));
}

function nextInvoiceNo(database, now) {
  const date=new Date(now), prefix=`INV-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-`;
  let n=Number(database.sqlite.prepare('SELECT COUNT(*) count FROM finance_invoices WHERE invoice_no LIKE ?').get(`${prefix}%`).count)+1;
  let value=`${prefix}${String(n).padStart(4,'0')}`;
  while(database.sqlite.prepare('SELECT 1 FROM finance_invoices WHERE invoice_no=?').get(value)){n++;value=`${prefix}${String(n).padStart(4,'0')}`;}
  return value;
}

function createInvoice(database, patientKey, actorId, now) {
  const prior=getInvoiceRow(database,patientKey);
  const priorProfile=prior?invoiceProfile(database,patientKey,prior.id):(getFinanceProfile(database,patientKey)||defaultProfile(patientKey,database.findPatient(patientKey)));
  const insurer=['NSSF','HEF','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE','INSURANCE','NGO'].includes(priorProfile.paymentType);
  const profile=!prior||insurer?priorProfile:{...priorProfile,paymentType:priorProfile.paymentType==='NOT_PAID'?'NOT_PAID':'DIRECT',paymentSubtype:'FULL',discountPercent:0,discountAmount:0,discountCurrency:'KHR',payerReference:'',note:''};
  const id=crypto.randomUUID();
  const amount=moneyToMinor(profile.discountAmount||0,profile.discountCurrency||'KHR');
  database.sqlite.prepare(`INSERT INTO finance_invoices
    (id,patient_key,invoice_no,created_by,created_at,payment_type,payment_subtype,hef_type,discount_percent,discount_amount_minor,discount_currency,payer_reference,note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,patientKey,nextInvoiceNo(database,now),actorId||null,now,profile.paymentType,profile.paymentSubtype||'',profile.hefType||'',profile.discountPercent||0,amount,profile.discountCurrency||'KHR',profile.payerReference||'',profile.note||'');
  database.sqlite.prepare('UPDATE finance_invoices SET nssf_subtype=?,payer_name=?,coverage_required=? WHERE id=?').run(profile.nssfSubtype||'',profile.payerName||'',['HEF','NSSF','INSURANCE','NGO'].includes(profile.paymentType)?1:0,id);
  return database.sqlite.prepare('SELECT * FROM finance_invoices WHERE id=?').get(id);
}

function ensureOpenInvoice(database, patientKey, actorId, now=Date.now()) {
  let row=getInvoiceRow(database,patientKey);
  if(row&&!row.closed_at){
    const bill=patientBill(database,patientKey,row.id);
    const gross=Number(bill?.summary?.KHR?.gross||0)+Number(bill?.summary?.USD?.gross||0);
    const balance=Number(bill?.summary?.KHR?.balance||0)+Number(bill?.summary?.USD?.balance||0);
    if(gross>0&&balance<=0){database.sqlite.prepare('UPDATE finance_invoices SET closed_at=? WHERE id=?').run(now,row.id);row=getInvoiceRow(database,patientKey);}
  }
  if(!row||row.closed_at) row=createInvoice(database,patientKey,actorId,now);
  return row;
}

// Start an independent invoice for a new care encounter (for example an OPD
// patient newly admitted to IPD). Earlier encounter invoices and receipts stay
// attached to their original invoice.
export function startPatientInvoice(database, patientKey, actorId, now=Date.now()) {
  if (!database.findPatient(patientKey)) throw new Error('Patient was not found.');
  invalidatePaymentStatusCache(patientKey);
  return invoiceFromRow(createInvoice(database,patientKey,actorId,now));
}

export function listPatientInvoices(database, patientKey) {
  return database.sqlite.prepare('SELECT * FROM finance_invoices WHERE patient_key=? ORDER BY created_at DESC,rowid DESC').all(patientKey).map(row=>{
    const bill=patientBill(database,patientKey,row.id);
    const summary=bill?.summary||{KHR:emptyCurrencySummary(),USD:emptyCurrencySummary()};
    const balance=Number(summary.KHR.balance||0)+Number(summary.USD.balance||0);
    const gross=Number(summary.KHR.gross||0)+Number(summary.USD.gross||0);
    return {...invoiceFromRow(row),gross,balance,amounts:{KHR:{gross:Number(summary.KHR.gross||0),balance:Number(summary.KHR.balance||0)},USD:{gross:Number(summary.USD.gross||0),balance:Number(summary.USD.balance||0)}},status:row.coverage_at?'COVERED':gross===0?'EMPTY':balance<=0?'PAID':'UNPAID'};
  });
}

export function patientPaymentHistory(database, patientKey) {
  const rows=database.sqlite.prepare(`SELECT p.*,u.display_name received_by_name,i.invoice_no
    FROM finance_payments p LEFT JOIN users u ON u.id=p.received_by
    LEFT JOIN finance_invoices i ON i.id=p.invoice_id
    WHERE p.patient_key=? ORDER BY p.received_at DESC,p.created_at DESC`).all(patientKey).map(row=>({...paymentFromRow(row),invoiceNo:row.invoice_no||''}));
  const attachments=database.sqlite.prepare(`SELECT a.id,a.payment_id,a.filename,a.content_type,a.uploaded_at
    FROM finance_payment_attachments a JOIN finance_payments p ON p.id=a.payment_id
    WHERE p.patient_key=? ORDER BY a.uploaded_at`).all(patientKey);
  const byPayment=new Map();
  for(const row of attachments){const list=byPayment.get(row.payment_id)||[];list.push({id:row.id,filename:row.filename,contentType:row.content_type,uploadedAt:row.uploaded_at});byPayment.set(row.payment_id,list)}
  rows.forEach(payment=>{payment.attachments=byPayment.get(payment.id)||[]});
  return rows;
}

function defaultProfile(patientKey, patient) {
  const existing = String(patient?.payment_type || '').trim().toUpperCase();
  const mapped = PAYMENT_TYPE_SET.has(existing)
    ? existing
    : (existing === 'EQUITY FUND' ? 'HEF' : 'NOT_PAID');
  return {
    patientKey,
    paymentType: mapped,
    paymentSubtype: '',
    hefType: mapped === 'HEF' ? 'EQUITY' : '',
    discountPercent: 0,
    discountAmount: 0,
    discountCurrency: 'KHR',
    payerReference: '',
    note: '',
    createdAt: null,
    updatedAt: null,
  };
}

export function setFinanceProfile(database, patientKey, values, actorId, now = Date.now(), invoiceId='') {
  if(invoiceId&&!getInvoiceRow(database,patientKey,invoiceId))throw new Error('Invoice was not found for this patient.');
  let paymentType = String(values?.paymentType || 'NOT_PAID').toUpperCase();
  if(paymentType==='EXEMPT'){paymentType='DIRECT';values={...values,paymentSubtype:'FULL_WAIVER'};}
  const profileInvoiceId=invoiceId||((getInvoiceRow(database,patientKey)?.closed_at==null)?getInvoiceRow(database,patientKey)?.id:'')||'';
  if (!PAYMENT_TYPE_SET.has(paymentType)) throw new Error('Payment type is invalid.');
  let discountPercent = Number(values?.discountPercent ?? 0);
  if (!Number.isFinite(discountPercent)) discountPercent = 0;
  let discountCurrency = currency(values?.discountCurrency || 'KHR');
  let discountAmountMinor = moneyToMinor(values?.discountAmount ?? 0, discountCurrency);
  let paymentSubtype = String(values?.paymentSubtype || values?.directType || '').toUpperCase();
  if (paymentType === 'DIRECT') {
    if (!paymentSubtype) paymentSubtype = 'FULL';
    if (!LEGACY_DIRECT_PAYMENT_TYPE_SET.has(paymentSubtype)) throw new Error('Direct payment option is invalid.');
  } else {
    paymentSubtype = '';
    discountAmountMinor = 0;
    discountCurrency = 'KHR';
  }
  const percentageAdjustment = paymentType === 'DISCOUNT' ||
    (paymentType === 'DIRECT' && ['DISCOUNT','PARTIAL_WAIVER'].includes(paymentSubtype) && discountPercent > 0);
  if (!percentageAdjustment) discountPercent = 0;
  if (!(paymentType === 'DIRECT' && paymentSubtype === 'DISCOUNT')) discountAmountMinor = 0;
  if (discountPercent < 0 || discountPercent > 100) throw new Error('Discount must be between 0% and 100%.');
  let hefType = String(values?.hefType || '').toUpperCase();
  if (paymentType === 'HEF') {
    if (!hefType) hefType = 'EQUITY';
    if (!HEF_TYPE_SET.has(hefType)) throw new Error('HEF card type is invalid.');
  } else {
    hefType = '';
  }
  const payerReference = text(values?.payerReference, 180, false, 'Payer reference');
  const nssfSubtype=paymentType==='NSSF'?String(values?.nssfSubtype||getFinanceProfile(database,patientKey)?.nssfSubtype||'').toUpperCase():'';
  if(nssfSubtype&&!NSSF_SUBTYPES.some(x=>x.code===nssfSubtype))throw Error('Invalid NSSF subtype.');
  const payerName=['INSURANCE','NGO'].includes(paymentType)?text(values?.payerName,180,true,'Insurance / organization name'):'';
  let note = text(values?.note, 1000, false, 'Payment note'),approvalId='';
  if(paymentType==='DIRECT'&&paymentSubtype==='FULL_WAIVER'){
    const approval=requireConcessionApproval(database,patientKey,profileInvoiceId,values);approvalId=approval.id;note=approval.reason;
  }
  if(paymentType==='DISCOUNT'||paymentType==='DIRECT'&&['DISCOUNT','PARTIAL_WAIVER'].includes(paymentSubtype)){
    const currentProfile=profileInvoiceId?database.sqlite.prepare('SELECT discount_percent,discount_amount_minor FROM finance_invoices WHERE id=?').get(profileInvoiceId):null;

    const gross=database.sqlite.prepare('SELECT currency,SUM(amount_minor) total FROM finance_charges WHERE invoice_id=? AND voided_at IS NULL GROUP BY currency').all(profileInvoiceId);
    const target=gross.find(r=>r.currency===discountCurrency),other=gross.some(r=>r.currency!==discountCurrency&&r.total>0);
    if(discountPercent>=100||discountAmountMinor>0&&target&&discountAmountMinor>=target.total&&!other)throw Error('Use the approved full exemption option for a complete waiver.');
    if(gross.length&&gross.every(r=>Math.max(0,r.total-Math.min(r.total,(r.currency===discountCurrency?discountAmountMinor:0)||Math.round(r.total*discountPercent/100)))===0))throw Error('Use the approved full exemption option for a complete waiver.');
    if((discountPercent>0||discountAmountMinor>0)&&(!currentProfile||Number(currentProfile.discount_percent)!==discountPercent||Number(currentProfile.discount_amount_minor)!==discountAmountMinor))throw Error('Discounts require an approved service request. Open Requests and submit the selected services for approval.');
  }
  database.sqlite.prepare(`INSERT INTO patient_finance_profiles
    (patient_key,payment_type,payment_subtype,hef_type,discount_percent,discount_amount_minor,discount_currency,payer_reference,note,updated_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(patient_key) DO UPDATE SET payment_type=excluded.payment_type,
      payment_subtype=excluded.payment_subtype,hef_type=excluded.hef_type,discount_percent=excluded.discount_percent,payer_reference=excluded.payer_reference,
      discount_amount_minor=excluded.discount_amount_minor,discount_currency=excluded.discount_currency,
      note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).run(
    patientKey, paymentType, paymentSubtype, hefType, discountPercent, discountAmountMinor, discountCurrency, payerReference, note, actorId, now, now,
  );
  database.sqlite.prepare('UPDATE patient_records SET payment_type=?, updated_by=?, updated_at=? WHERE patient_key=?')
    .run(paymentType, actorId, now, patientKey);
  database.sqlite.prepare('UPDATE patient_finance_profiles SET nssf_subtype=?,payer_name=?,concession_approval_id=?,coverage_required=? WHERE patient_key=?').run(nssfSubtype,payerName,approvalId,['HEF','NSSF','INSURANCE','NGO'].includes(paymentType)?1:0,patientKey);
  if(profileInvoiceId){
    database.sqlite.prepare(`UPDATE finance_invoices SET payment_type=?,payment_subtype=?,hef_type=?,discount_percent=?,discount_amount_minor=?,discount_currency=?,payer_reference=?,note=? WHERE id=?`)
      .run(paymentType,paymentSubtype,hefType,discountPercent,discountAmountMinor,discountCurrency,payerReference,note,profileInvoiceId);
  }
  if(profileInvoiceId)database.sqlite.prepare('UPDATE finance_invoices SET nssf_subtype=?,payer_name=?,concession_approval_id=?,coverage_required=?,coverage_at=NULL,coverage_by=NULL WHERE id=?').run(nssfSubtype,payerName,approvalId,['HEF','NSSF','INSURANCE','NGO'].includes(paymentType)?1:0,profileInvoiceId);
  if(approvalId)database.sqlite.prepare("UPDATE finance_concession_requests SET status='APPLIED',applied_at=? WHERE id=?").run(now,approvalId);
  invalidatePaymentStatusCache(patientKey);
  return getFinanceProfile(database, patientKey);
}

function chargeFromRow(row, database = null) {
  let catItem = null;
  if (database) {
    try {
      if (row.service_code) {
        catItem = database.sqlite.prepare('SELECT name_kh, name_en, category_code FROM finance_service_catalog WHERE code=? LIMIT 1').get(row.service_code);
      }
      if (!catItem && row.description) {
        catItem = database.sqlite.prepare('SELECT name_kh, name_en, category_code FROM finance_service_catalog WHERE name_en=? OR name_kh=? LIMIT 1').get(row.description, row.description);
      }
    } catch (_) {}
  }
  const descriptionKh = catItem?.name_kh || (row.description === 'OPD consultation without health-centre referral' ? 'ពិគ្រោះក្រៅ គ្មានលិខិតបញ្ជូនពីមណ្ឌលសុខភាព' : null) || row.description;
  const descriptionEn = catItem?.name_en || (row.description === 'ពិគ្រោះក្រៅ គ្មានលិខិតបញ្ជូនពីមណ្ឌលសុខភាព' ? 'OPD consultation without health-centre referral' : null) || row.description;
  const categoryKh = (row.category === 'Outpatient (OPD)' ? 'ផ្នែកពិគ្រោះក្រៅ (OPD)' : (row.category === 'Inpatient' ? 'សម្រាកពេទ្យ' : (row.category === 'CONSULTATION' ? 'ពិគ្រោះជំងឺ' : row.category)));
  const categoryEn = (row.category === 'ផ្នែកពិគ្រោះក្រៅ (OPD)' || row.category === 'ពិគ្រោះក្រៅ') ? 'Outpatient (OPD)' : row.category;
  return {
    id: row.id, patientKey: row.patient_key, invoiceId:row.invoice_id||'', serviceCode: row.service_code || '', sourceKey:row.source_key||'', tariffPayer:row.tariff_payer||'DIRECT',pmrsCode:row.pmrs_code||'',tariffFacility:row.tariff_facility||'',tariffRevision:row.tariff_revision||0, category: row.category, description: row.description,
    descriptionKh, descriptionEn, categoryKh, categoryEn,
    quantity: Number(row.quantity), unitAmount: minorToMoney(row.unit_amount_minor, row.currency),
    amount: minorToMoney(row.amount_minor, row.currency), currency: row.currency, note: row.note,
    createdBy: row.created_by, createdByName: row.created_by_name || '', createdAt: row.created_at,
    voidedAt: row.voided_at || null, voidReason: row.void_reason || '',
  };
}

function paymentFromRow(row) {
  return {
    id: row.id, patientKey: row.patient_key, invoiceId:row.invoice_id||'', invoiceNo:row.invoice_no||'', receiptNo: row.receipt_no || '', source: row.source, purpose: row.purpose || 'PATIENT_CARE',
    serviceCode: row.service_code || '', categoryCode: row.category_code || '',
    amount: minorToMoney(row.amount_minor, row.currency), currency: row.currency,
    reference: row.reference, note: row.note, receivedBy: row.received_by,
    receivedByName: row.cashier_name_snapshot || row.received_by_name || '', receivedAt: row.received_at,
    voidedAt: row.voided_at || null, voidReason: row.void_reason || '',
  };
}

function expenseFromRow(row) {
  return {
    id: row.id, category: row.category, description: row.description,
    amount: minorToMoney(row.amount_minor, row.currency), currency: row.currency,
    reference: row.reference, note: row.note, spentAt: row.spent_at,
    createdBy: row.created_by, createdByName: row.created_by_name || '', createdAt: row.created_at,
    voidedAt: row.voided_at || null, voidReason: row.void_reason || '',
  };
}

export function serviceCatalog(database, { includeInactive = false } = {}) {
  const rows = database.sqlite.prepare(`SELECT * FROM finance_service_catalog
    ${includeInactive ? '' : 'WHERE active=1'} ORDER BY category_code, sort_order, name_en COLLATE NOCASE`).all();
  return rows.map(row => ({
    id: row.id, code: row.code, categoryCode: row.category_code,
    category: SERVICE_CATEGORIES.find(item => item.code === row.category_code) || { code:row.category_code, labelKh:row.category_code, labelEn:row.category_code },
    nameKh: row.name_kh, nameEn: row.name_en, departmentCode:row.department_code||'ALL', unitLabel:row.unit_label||'service',
    defaultAmount: minorToMoney(row.default_amount_minor, row.currency), currency: row.currency,
    active: row.active === 1, sortOrder: Number(row.sort_order || 0),
  }));
}

export function setServiceCatalogItem(database, values, now = Date.now()) {
  const code = text(values?.code, 40, true, 'Service code').toUpperCase().replace(/[^A-Z0-9_]/g,'_');
  const editingCode = values?.editingCode ? String(values.editingCode).toUpperCase() : null;
  if (editingCode && editingCode !== code) database.sqlite.prepare('UPDATE finance_service_catalog SET code=? WHERE code=?').run(code, editingCode);
  const categoryCode = String(values?.categoryCode || 'OTHER').toUpperCase();
  if (!SERVICE_CATEGORY_SET.has(categoryCode)) throw new Error('Service category is invalid.');
  const selectedCurrency = currency(values?.currency || 'KHR');
  const amountMinor = moneyToMinor(values?.defaultAmount ?? 0, selectedCurrency);
  const active = values?.active === false ? 0 : 1;
  const sortOrder = Number.isFinite(Number(values?.sortOrder)) ? Math.trunc(Number(values.sortOrder)) : 0;
  const departmentCode = String(values?.departmentCode || 'ALL').toLowerCase()==='all' ? 'ALL' : String(values?.departmentCode || '').toLowerCase();
  if (!FINANCE_DEPARTMENT_SET.has(departmentCode)) throw new Error('Service department is invalid.');
  const unitLabel = text(values?.unitLabel || 'service',60,true,'Service unit');
  const existing = database.sqlite.prepare('SELECT id,created_at FROM finance_service_catalog WHERE code=?').get(code);
  const id = existing?.id || crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO finance_service_catalog
    (id,code,category_code,name_kh,name_en,default_amount_minor,currency,active,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(code) DO UPDATE SET category_code=excluded.category_code,name_kh=excluded.name_kh,name_en=excluded.name_en,
      default_amount_minor=excluded.default_amount_minor,currency=excluded.currency,active=excluded.active,sort_order=excluded.sort_order,updated_at=excluded.updated_at`).run(
      id, code, categoryCode, text(values?.nameKh,160,true,'Khmer service name'), text(values?.nameEn,160,true,'English service name'),
      amountMinor, selectedCurrency, active, sortOrder, existing?.created_at || now, now,
    );
  database.sqlite.prepare('UPDATE finance_service_catalog SET department_code=?,unit_label=? WHERE code=?').run(departmentCode,unitLabel,code);
  return serviceCatalog(database, { includeInactive:true }).find(item => item.code === code);
}

export function addCharge(database, patientKey, values, actorId, now = Date.now(), {newInvoiceId=''} = {}) {
  let catalogItem = null;
  const tariffPayer=majorPaymentCategory(values?.tariffPaymentType||'DIRECT');
  const serviceCode = String(values?.serviceCode || '').trim().toUpperCase();
  if(serviceCode)catalogItem=(tariffPayer==='DIRECT'?serviceCatalog(database,{includeInactive:true}):payerTariffCatalog(database,tariffPayer)).find(item=>item.code===serviceCode)||null;
  if(tariffPayer!=='DIRECT'){
    if(!catalogItem||!catalogItem.active||!catalogItem.available)throw Error('The selected payer tariff is not configured or available.');
    if(tariffPayer==='HEF'&&!paymentSettings(database).configured)throw Error('Admin must confirm the hospital level before using HEF rates.');
    // Sponsored rates are resolved on the server; ignore client amount/currency overrides.
    values={...values,currency:catalogItem.currency,unitAmount:catalogItem.defaultAmount,description:catalogItem.nameKh,note:values?.note||''};
  }
  const selectedCurrency = currency(values?.currency || catalogItem?.currency || 'KHR');
  const quantity = Number(values?.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) throw new Error('Quantity is invalid.');
  const providedAmount = values?.unitAmount;
  const unitAmount = (providedAmount === '' || providedAmount === undefined || providedAmount === null)
    ? (catalogItem?.defaultAmount ?? 0) : providedAmount;
  const unitAmountMinor = moneyToMinor(unitAmount, selectedCurrency);
  const amountMinor = Math.round(quantity * unitAmountMinor);
  const category = text(values?.category || catalogItem?.category?.labelKh || catalogItem?.category?.labelEn || 'Other', 120);
  const description = text(values?.description || catalogItem?.nameKh || catalogItem?.nameEn, 300, true, 'Description');
  const id = crypto.randomUUID();
  const sourceKey = text(values?.sourceKey,180,false,'Charge source');
  if (sourceKey) {
    const existing=database.sqlite.prepare('SELECT c.*,u.display_name created_by_name FROM finance_charges c LEFT JOIN users u ON u.id=c.created_by WHERE c.source_key=?').get(sourceKey);
    if (existing) return chargeFromRow(existing, database);
  }
  // Internal batch creation pins all selected fees to its freshly created invoice.
  const invoice=newInvoiceId?getInvoiceRow(database,patientKey,newInvoiceId):ensureOpenInvoice(database,patientKey,actorId,now);
  if(!invoice||invoice.closed_at)throw new Error('New invoice is unavailable or already closed.');
  database.sqlite.prepare(`INSERT INTO finance_charges
    (id,patient_key,invoice_id,service_code,source_key,category,description,quantity,unit_amount_minor,amount_minor,currency,note,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, patientKey, invoice.id, serviceCode, sourceKey, category, description, quantity,
    unitAmountMinor, amountMinor, selectedCurrency, text(values?.note, 1000), actorId, now,
  );
  database.sqlite.prepare('UPDATE finance_charges SET tariff_payer=?,pmrs_code=?,tariff_facility=?,tariff_revision=? WHERE id=?').run(tariffPayer,catalogItem?.pmrsCode||'',catalogItem?.facilityLevel||'',catalogItem?.revision||0,id);
  invalidatePaymentStatusCache(patientKey);
  return chargeFromRow(database.sqlite.prepare(`SELECT c.*,u.display_name created_by_name FROM finance_charges c
    LEFT JOIN users u ON u.id=c.created_by WHERE c.id=?`).get(id), database);
}

export function voidChargeBySource(database, sourceKey, actorId, reason='Clinical request cancelled', now=Date.now()) {
  const res = database.sqlite.prepare(`UPDATE finance_charges SET voided_by=?,voided_at=?,void_reason=? WHERE source_key LIKE ? AND voided_at IS NULL`)
    .run(actorId,now,text(reason,500,true,'Void reason'),`${String(sourceKey||'')}%`).changes;
  invalidatePaymentStatusCache();
  return res;
}

export function exchangeRateState(database) {
  const rows=database.sqlite.prepare(`SELECT r.*,p.display_name proposed_by_name,v.display_name reviewed_by_name FROM finance_exchange_rates r
    LEFT JOIN users p ON p.id=r.proposed_by LEFT JOIN users v ON v.id=r.reviewed_by ORDER BY r.proposed_at DESC`).all();
  const map=row=>row?{id:row.id,khrPerUsd:Number(row.khr_per_usd),status:row.status,proposedBy:row.proposed_by,proposedByName:row.proposed_by_name||'',proposedAt:row.proposed_at,reviewedBy:row.reviewed_by||'',reviewedByName:row.reviewed_by_name||'',reviewedAt:row.reviewed_at||null,reviewNote:row.review_note||''}:null;
  return {active:map(rows.find(row=>row.status==='APPROVED')||null),requests:rows.slice(0,50).map(map)};
}

export function proposeExchangeRate(database, khrPerUsd, actorId, now=Date.now()) {
  const rate=Number(khrPerUsd);
  if(!Number.isFinite(rate)||rate<1000||rate>10000) throw new Error('Exchange rate must be between 1,000 and 10,000 KHR per USD.');
  const id=crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO finance_exchange_rates (id,khr_per_usd,status,proposed_by,proposed_at) VALUES (?,?,'PENDING',?,?)`).run(id,rate,actorId,now);
  return exchangeRateState(database).requests.find(item=>item.id===id);
}

export function reviewExchangeRate(database,id,approved,note,actorId,now=Date.now()) {
  const row=database.sqlite.prepare("SELECT * FROM finance_exchange_rates WHERE id=? AND status='PENDING'").get(id);
  if(!row) throw new Error('Pending exchange-rate request was not found.');
  if(approved) database.sqlite.prepare("UPDATE finance_exchange_rates SET status='REJECTED',reviewed_by=?,reviewed_at=?,review_note='Superseded by a newer approved rate' WHERE status='APPROVED'").run(actorId,now);
  database.sqlite.prepare('UPDATE finance_exchange_rates SET status=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=?').run(approved?'APPROVED':'REJECTED',actorId,now,text(note,500),id);
  return exchangeRateState(database);
}

function receiptNumber(database, now) {
  const date = new Date(now);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth()+1).padStart(2,'0');
  const dd = String(date.getDate()).padStart(2,'0');
  const prefix = `RCPT-${yyyy}${mm}${dd}-`;
  const count = database.sqlite.prepare(`SELECT COUNT(*) count FROM finance_payments WHERE receipt_no LIKE ?`).get(`${prefix}%`).count;
  return `${prefix}${String(Number(count)+1).padStart(4,'0')}`;
}

export function addPayment(database, patientKey, values, actorId, now = Date.now()) {
  const selectedCurrency = currency(values?.currency);
  const source = String(values?.source || 'CASH').toUpperCase();
  if (!PAYMENT_SOURCES.has(source)) throw new Error('Payment source is invalid.');
  const purpose = String(values?.purpose || 'PATIENT_CARE').toUpperCase();
  if (!PAYMENT_PURPOSE_SET.has(purpose)) throw new Error('Payment purpose is invalid.');
  let serviceCode = String(values?.serviceCode || '').trim().toUpperCase();
  let categoryCode = String(values?.categoryCode || '').trim().toUpperCase();
  if (serviceCode) {
    const catalogItem = serviceCatalog(database, { includeInactive:true }).find(item => item.code === serviceCode);
    if (!catalogItem) throw new Error('Payment service is invalid.');
    categoryCode = catalogItem.categoryCode;
  }
  if (categoryCode && categoryCode !== 'GENERAL' && !SERVICE_CATEGORY_SET.has(categoryCode)) throw new Error('Payment service category is invalid.');
  if (purpose === 'AMBULANCE_REFERRAL' && !serviceCode) {
    serviceCode = 'AMBULANCE_REFERRAL';
    categoryCode = 'AMBULANCE';
  }
  const amountMinor = moneyToMinor(values?.amount, selectedCurrency);
  if (amountMinor <= 0) throw new Error('Payment amount must be greater than zero.');
  const receivedAt = values?.receivedAt !== undefined && values?.receivedAt !== null && values?.receivedAt !== '' ? Number(values.receivedAt) : now;
  if (!Number.isFinite(receivedAt)) throw new Error('Payment date is invalid.');
  if (receivedAt > now) throw new Error('Payment date cannot be in the future.');
  const id = crypto.randomUUID();
  const receiptNo = receiptNumber(database, receivedAt);
  const cashier = database.sqlite.prepare('SELECT display_name FROM users WHERE id=?').get(actorId);
  const cashierNameSnapshot = text(cashier?.display_name || '', 160);
  let invoice=values?.invoiceId?getInvoiceRow(database,patientKey,String(values.invoiceId)):null;
  if(values?.invoiceId&&!invoice)throw new Error('Invoice was not found for this patient.');
  if(!invoice)invoice=ensureOpenInvoice(database,patientKey,actorId,now);
  if(invoice.coverage_required&&majorPaymentCategory(invoice.payment_type)!=='DIRECT'&&source==='CASH')throw Error('Sponsored coverage is a payer receivable, not a cash receipt.');
  database.sqlite.prepare(`INSERT INTO finance_payments
    (id,patient_key,invoice_id,source,amount_minor,currency,purpose,receipt_no,service_code,category_code,reference,note,received_by,cashier_name_snapshot,received_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, patientKey, invoice.id, source, amountMinor, selectedCurrency, purpose, receiptNo, serviceCode, categoryCode,
    text(values?.reference,180), text(values?.note,1000), actorId, cashierNameSnapshot, receivedAt, now,
  );
  invalidatePaymentStatusCache(patientKey);
  return paymentFromRow(database.sqlite.prepare(`SELECT p.*,u.display_name received_by_name FROM finance_payments p
    LEFT JOIN users u ON u.id=p.received_by WHERE p.id=?`).get(id));
}

export function addExpense(database, values, actorId, now = Date.now()) {
  const selectedCurrency = currency(values?.currency);
  const amountMinor = moneyToMinor(values?.amount, selectedCurrency);
  if (amountMinor <= 0) throw new Error('Expense amount must be greater than zero.');
  const spentAt = values?.spentAt ? Number(values.spentAt) : now;
  if (!Number.isFinite(spentAt)) throw new Error('Expense date is invalid.');
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO finance_expenses
    (id,category,description,amount_minor,currency,reference,note,spent_at,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, text(values?.category,120,true,'Expense category'), text(values?.description,300,true,'Expense description'),
    amountMinor, selectedCurrency, text(values?.reference,180), text(values?.note,1000), spentAt, actorId, now,
  );
  return expenseFromRow(database.sqlite.prepare(`SELECT e.*,u.display_name created_by_name FROM finance_expenses e
    LEFT JOIN users u ON u.id=e.created_by WHERE e.id=?`).get(id));
}

export function addPaymentAttachment(database, paymentId, values) {
  const payment = database.sqlite.prepare('SELECT id,patient_key FROM finance_payments WHERE id=?').get(paymentId);
  if (!payment) return null;
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO finance_payment_attachments
    (id,payment_id,filename,content_type,storage_path,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?)`).run(
      id, paymentId, text(values?.filename,220,true,'Filename'), text(values?.contentType,120,true,'Content type'),
      text(values?.storagePath,1000,true,'Storage path'), values.userId, Date.now(),
    );
  return { id, paymentId, patientKey:payment.patient_key, filename:values.filename, contentType:values.contentType };
}

export function getPaymentAttachment(database, id) {
  return database.sqlite.prepare(`SELECT a.*,p.patient_key FROM finance_payment_attachments a
    JOIN finance_payments p ON p.id=a.payment_id WHERE a.id=?`).get(id) || null;
}

export function getFinancePayment(database, id) {
  return database.sqlite.prepare('SELECT * FROM finance_payments WHERE id=?').get(id) || null;
}

export function voidFinanceItem(database, kind, id, reason, actorId, now = Date.now(), {unpaidOnly=false} = {}) {
  const table = kind === 'charge' ? 'finance_charges' : kind === 'payment' ? 'finance_payments' : kind === 'expense' ? 'finance_expenses' : '';
  if (!table) throw new Error('Finance item type is invalid.');
  if (kind === 'charge' && unpaidOnly) {
    const charge=database.sqlite.prepare('SELECT * FROM finance_charges WHERE id=? AND voided_at IS NULL').get(id);
    if (!charge) return false;
    const bill=patientBill(database,charge.patient_key,charge.invoice_id||'');
    if ((bill?.payments||[]).some(payment=>!payment.voidedAt) || bill?.invoice?.closedAt || Number(bill?.summary?.[charge.currency]?.balance||0)<=0) {
      throw new Error('Only unpaid services can be deleted. This invoice has already been paid or settled.');
    }
  }
  const info = database.sqlite.prepare(`UPDATE ${table} SET voided_by=?,voided_at=?,void_reason=? WHERE id=? AND voided_at IS NULL`)
    .run(actorId, now, text(reason,500,true,'Void reason'), id);
  if (!info.changes) return false;
  invalidatePaymentStatusCache();
  return true;
}

function emptyCurrencySummary() {
  return { gross: 0, discount: 0, waived: 0, patientDue: 0, payerDue: 0, paid: 0, balance: 0 };
}

export function patientBill(database, patientKey, requestedInvoiceId='', options = {}) {
  const patient = database.findPatient(patientKey);
  if (!patient) return null;
  const invoice=getInvoiceRow(database,patientKey,requestedInvoiceId);
  if(requestedInvoiceId&&!invoice)return null;
  const invoiceId=invoice?.id||'';
  const profile = invoiceId?invoiceProfile(database,patientKey,invoiceId):(getFinanceProfile(database, patientKey) || defaultProfile(patientKey, patient));
  const invoiceFilter=invoiceId?' AND c.invoice_id=?':'';
  const paymentFilter=invoiceId?' AND p.invoice_id=?':'';
  const charges = database.sqlite.prepare(`SELECT c.*,u.display_name created_by_name FROM finance_charges c
    LEFT JOIN users u ON u.id=c.created_by WHERE c.patient_key=?${invoiceFilter} ORDER BY c.created_at DESC`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey])).map(r => chargeFromRow(r, database));
  const payments = database.sqlite.prepare(`SELECT p.*,u.display_name received_by_name FROM finance_payments p
    LEFT JOIN users u ON u.id=p.received_by WHERE p.patient_key=?${paymentFilter} ORDER BY p.received_at DESC`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey])).map(paymentFromRow);
  const skipAttachments = Boolean(options?.skipAttachments);
  const attachmentRows = skipAttachments ? [] : database.sqlite.prepare(`SELECT id,payment_id,filename,content_type,uploaded_at FROM finance_payment_attachments
    WHERE payment_id IN (SELECT id FROM finance_payments WHERE patient_key=?${invoiceId?' AND invoice_id=?':''}) ORDER BY uploaded_at`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey]));
  const attachmentsByPayment = new Map();
  attachmentRows.forEach(row => {
    const list = attachmentsByPayment.get(row.payment_id) || [];
    list.push({ id:row.id, filename:row.filename, contentType:row.content_type, uploadedAt:row.uploaded_at });
    attachmentsByPayment.set(row.payment_id,list);
  });
  payments.forEach(item => { item.attachments = attachmentsByPayment.get(item.id) || []; });
  const summary = { KHR: emptyCurrencySummary(), USD: emptyCurrencySummary() };
  const activeCharges = database.sqlite.prepare(`SELECT currency,SUM(amount_minor) total FROM finance_charges
    WHERE patient_key=? AND voided_at IS NULL${invoiceId?' AND invoice_id=?':''} GROUP BY currency`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey]));
  const activePayments = database.sqlite.prepare(`SELECT currency,SUM(amount_minor) total FROM finance_payments
    WHERE patient_key=? AND voided_at IS NULL${invoiceId?' AND invoice_id=?':''} GROUP BY currency`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey]));
  activeCharges.forEach(row => { summary[row.currency].gross = minorToMoney(row.total,row.currency); });
  activePayments.forEach(row => { summary[row.currency].paid = minorToMoney(row.total,row.currency); });
  for (const curr of FINANCE_CURRENCIES) {
    const s = summary[curr];
    if (profile.paymentType === 'EXEMPT' || (profile.paymentType === 'DIRECT' && profile.paymentSubtype === 'FULL_WAIVER')) {
      s.waived = s.gross; s.patientDue = 0; s.payerDue = 0;
    } else if (profile.paymentType === 'DIRECT' && profile.paymentSubtype === 'DISCOUNT' && profile.discountAmount > 0) {
      const adjustment = curr === profile.discountCurrency ? Math.min(s.gross, profile.discountAmount) : 0;
      s.discount = adjustment;
      s.patientDue = Math.max(0, s.gross - adjustment);
    } else if (profile.paymentType === 'DISCOUNT' ||
      (profile.paymentType === 'DIRECT' && ['DISCOUNT','PARTIAL_WAIVER'].includes(profile.paymentSubtype))) {
      const adjustment = Math.round(s.gross * profile.discountPercent * (curr === 'USD' ? 100 : 1) / 100) / (curr === 'USD' ? 100 : 1);
      if (profile.paymentSubtype === 'PARTIAL_WAIVER') s.waived = adjustment;
      else s.discount = adjustment;
      s.patientDue = Math.max(0, s.gross - adjustment);
    } else if (['NSSF','HEF','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE','INSURANCE','NGO'].includes(profile.paymentType)) {
      s.patientDue = 0; s.payerDue = s.gross;
    } else {
      // CASH and NOT_PAID are both patient responsibility. The payment-type
      // badge records whether cash has been classified as paid yet.
      s.patientDue = s.gross;
    }
    if(database.sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name='finance_service_concessions'").get()){
      const reductions=database.sqlite.prepare(`SELECT COALESCE(SUM(a.amount_minor),0) total,COALESCE(SUM(CASE WHEN a.kind='FULL' THEN a.amount_minor ELSE 0 END),0) waived FROM finance_service_concessions a JOIN finance_charges c ON c.id=a.charge_id WHERE c.patient_key=? AND c.currency=? AND c.voided_at IS NULL ${invoiceId?'AND c.invoice_id=?':''}`).get(...(invoiceId?[patientKey,curr,invoiceId]:[patientKey,curr]));
      const adjustment=Math.min(s.patientDue,minorToMoney(reductions.total,curr));const waived=Math.min(adjustment,minorToMoney(reductions.waived,curr));s.waived+=waived;s.discount+=adjustment-waived;s.patientDue=Math.max(0,s.patientDue-adjustment);
    }
    const target = s.patientDue + s.payerDue;
    s.balance = Math.max(0, target - s.paid);
  }
  return {
    patient: {
      patientKey: patient.patient_key, caseNumber: patient.case_number, healthId: patient.health_id,
      fullName: patient.full_name, sex: patient.sex, age: patient.age, phone: patient.phone || '', departmentCode: patient.department_code,
      departmentNameEn: patient.department_name_en, departmentNameKh: patient.department_name_kh,
      serviceMode: patient.service_mode, entryDate: patient.entry_date,
    },
    serviceConcessions:database.sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name='finance_service_concessions'").get()?database.sqlite.prepare(`SELECT a.request_id requestId,a.charge_id chargeId,a.amount_minor amountMinor,a.kind,a.applied_at appliedAt,c.description,c.currency,r.reason,r.signature_json signatureJson FROM finance_service_concessions a JOIN finance_charges c ON c.id=a.charge_id JOIN workflow_requests r ON r.id=a.request_id WHERE c.patient_key=? ${invoiceId?'AND c.invoice_id=?':''} AND c.voided_at IS NULL`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey])):[],
    profile:{...profile,concession:concessionMetadata(database,profile.approvalId)}, invoice:invoiceFromRow(invoice), charges, payments, summary,
  };
}

const paymentStatusCache = new Map();

export function invalidatePaymentStatusCache(patientKey = '') {
  if (patientKey) paymentStatusCache.delete(patientKey);
  else paymentStatusCache.clear();
}

function calculatePaymentStatusForPatient(database, patientKey, invoiceId='') {
  const patient = database.findPatient(patientKey);
  if (!patient) return null;
  const bill = patientBill(database, patientKey,invoiceId);
  const profile = bill.profile;
  const base = {
    patientKey,
    paymentType: profile.paymentType,
    paymentSubtype: profile.paymentSubtype || '',
    hefType: profile.hefType || '',
    discountPercent: profile.discountPercent || 0,
    discountAmount: profile.discountAmount || 0,
    discountCurrency: profile.discountCurrency || 'KHR',
    payerReference: profile.payerReference || '',
    balances: {
      KHR: bill.summary.KHR.balance,
      USD: bill.summary.USD.balance,
    },
  };
  if(profile.coverageRequired&&!profile.coverageAt&&majorPaymentCategory(profile.paymentType)!=='DIRECT')return {...base,code:'COVERAGE_PENDING',labelKh:'រង់ចាំផ្ទៀងផ្ទាត់ការធានាចំណាយ',labelEn:'Coverage review pending'};
  if(['INSURANCE','NGO'].includes(profile.paymentType))return {...base,code:profile.paymentType,labelKh:profile.paymentType==='INSURANCE'?'ធានារ៉ាប់រងបានផ្ទៀងផ្ទាត់':'អង្គការបានផ្ទៀងផ្ទាត់',labelEn:profile.paymentType==='INSURANCE'?'Insurance verified':'Organization coverage verified'};
  // Cash/not-yet-paid patients are only marked PAID after real receipts settle
  // every outstanding currency balance. Selecting a cash payment profile alone
  // must never turn the patient green/paid.
  if (profile.paymentType === 'CASH' || profile.paymentType === 'NOT_PAID' ||
    (profile.paymentType === 'DIRECT' && profile.paymentSubtype !== 'FULL_WAIVER')) {
    const grossTotal = Number(bill.summary.KHR.gross || 0) + Number(bill.summary.USD.gross || 0);
    const paidTotal = Number(bill.summary.KHR.paid || 0) + Number(bill.summary.USD.paid || 0);
    const allSettled = Number(bill.summary.KHR.balance || 0) <= 0 && Number(bill.summary.USD.balance || 0) <= 0;
    if(grossTotal>0&&paidTotal===0&&allSettled&&Number(bill.summary.KHR.waived||0)+Number(bill.summary.USD.waived||0)>=grossTotal)return {...base,code:'FULL_WAIVER',labelKh:'អនុគ្រោះទាំងស្រុង',labelEn:'Approved full waiver'};
    if (grossTotal > 0 && paidTotal > 0 && allSettled) {
      return { ...base, code: 'PAID', labelKh: 'បានបង់ប្រាក់', labelEn: 'Paid' };
    }
    if (paidTotal > 0) {
      return { ...base, code: 'PARTIAL', labelKh: 'មិនទាន់បង់គ្រប់', labelEn: 'Partially paid' };
    }
    return { ...base, code: 'NOT_PAID', labelKh: 'មិនទាន់បង់ប្រាក់', labelEn: 'Not Yet Paid' };
  }
  if (profile.paymentType === 'NSSF_OUTSIDE') return { ...base, code: 'NSSF_OUTSIDE', labelKh: 'បង់ដោយ ប.ស.ស ក្រៅប្រព័ន្ធ', labelEn: 'NSSF outside system' };
  if (profile.paymentType === 'NSSF_WORKER') return { ...base, code: 'NSSF_WORKER', labelKh: 'បង់ដោយ ប.ស.ស កម្មករ-នយោជក់', labelEn: 'NSSF worker–employer' };
  if (profile.paymentType === 'NSSF_CIVIL') return { ...base, code: 'NSSF_CIVIL', labelKh: 'បង់ដោយ ប.ស.ស មន្ត្រីរាជការ', labelEn: 'NSSF civil servant' };
  if (profile.paymentType === 'HEF_POOR') return { ...base, code: 'HEF_POOR', labelKh: 'បង់ដោយមូលនិធិសមធម៌ក្រីក្រ', labelEn: 'Health Equity Fund' };
  if (profile.paymentType === 'HEF_VULNERABLE') return { ...base, code: 'HEF_VULNERABLE_FAMILY', labelKh: 'បង់ដោយមូលនិធិសមធម៌គ្រួសារងាយរងហានីភ័យ', labelEn: 'Vulnerable Family Equity Fund' };
  if (profile.paymentType === 'DIRECT' && profile.paymentSubtype === 'FULL_WAIVER') return { ...base, code: 'FULL_WAIVER', labelKh: 'អនុគ្រោះទាំងស្រុង', labelEn: 'Full waiver' };
  if (profile.paymentType === 'NSSF') return { ...base, code: 'NSSF', labelKh: 'ប.ស.ស', labelEn: 'NSSF' };
  if (profile.paymentType === 'HEF') {
    if (profile.hefType === 'VULNERABLE') return { ...base, code: 'HEF_VULNERABLE', labelKh: 'បណ្ណងាយរងហានីភ័យ', labelEn: 'Vulnerable Card' };
    return { ...base, code: 'HEF_EQUITY', labelKh: 'បណ្ណមូលនិធិសមធម៌', labelEn: 'Health Equity Fund Card' };
  }
  if (profile.paymentType === 'EXEMPT') return { ...base, code: 'EXEMPT', labelKh: 'លើកលែង', labelEn: 'Exempt' };
  if (profile.paymentType === 'DISCOUNT') return { ...base, code: 'DISCOUNT', labelKh: `បញ្ចុះថ្លៃសេវា ${profile.discountPercent || 0}%`, labelEn: `Discount ${profile.discountPercent || 0}%` };
  return { ...base, code: 'NOT_PAID', labelKh: 'មិនទាន់បង់ប្រាក់', labelEn: 'Not Yet Paid' };
}

export function paymentStatusForPatient(database, patientKey, invoiceId='') {
  if (!invoiceId && paymentStatusCache.has(patientKey)) {
    return paymentStatusCache.get(patientKey);
  }
  const result = calculatePaymentStatusForPatient(database, patientKey, invoiceId);
  if (!invoiceId && result) {
    paymentStatusCache.set(patientKey, result);
  }
  return result;
}

export function financePatientSearch(database, query = '', { view = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const patients = database.listPatientSummaries().filter(row => {
    if (!q) return true;
    return [row.full_name,row.case_number,row.health_id,row.phone,row.department_name_en,row.department_name_kh]
      .some(value => String(value || '').toLowerCase().includes(q));
  }).slice(0,200).map(row => {
    let data = {};
    try { data = JSON.parse(row.record_json || '{}'); } catch {}
    let bill = patientBill(database, row.patient_key, '', { skipAttachments: true });
    const storedQueue=data['system:cashierQueueRequest'];
    const hasRequestTable=database.sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='finance_cashier_requests'").get();
    const requests=hasRequestTable?database.sqlite.prepare('SELECT invoice_id invoiceId,sent_at sentAt,source FROM finance_cashier_requests WHERE patient_key=? ORDER BY sent_at DESC,rowid DESC').all(row.patient_key):[];
    if(storedQueue?.invoiceId&&!requests.some(r=>r.invoiceId===storedQueue.invoiceId))requests.unshift(storedQueue);
    const pending=requests.map(queue=>({queue,bill:patientBill(database,row.patient_key,queue.invoiceId, { skipAttachments: true })})).find(item=>item.bill?.invoice&&!item.bill.invoice.closedAt&&Number(item.bill.summary.KHR.balance||0)+Number(item.bill.summary.USD.balance||0)>0);
    if(view==='queue'&&pending)bill=pending.bill;
    const status = paymentStatusForPatient(database,row.patient_key,bill?.invoice?.id||'');
    const balance = Number(bill?.summary?.KHR?.balance || 0) + Number(bill?.summary?.USD?.balance || 0);
    const queue = view==='queue'&&pending ? pending.queue : storedQueue;
    const workflowStage = String(data['system:workflowStage'] || '');
    const explicitQueue = Boolean(queue && (!queue.invoiceId || queue.invoiceId === bill?.invoice?.id) && balance > 0);
    const paraclinicQueue = workflowStage === 'CASHIER_PENDING_PARACLINIC' && balance > 0;
    // Keep the payment date aligned with the invoice whose status is shown.
    // Otherwise a newly opened, unpaid invoice would misleadingly inherit the
    // date from a previously paid OPD/IPD invoice.
    const latestPayment = database.sqlite.prepare(`SELECT MAX(received_at) AS received_at FROM finance_payments
      WHERE patient_key=? AND voided_at IS NULL${bill?.invoice?.id ? ' AND invoice_id=?' : ''}`)
      .get(...(bill?.invoice?.id ? [row.patient_key,bill.invoice.id] : [row.patient_key]))?.received_at || (bill?.invoice?.closedAt || null);
    return {
      patientKey: row.patient_key, caseNumber: row.case_number, healthId: row.health_id,
      fullName: row.full_name, sex: row.sex, age: row.age, phone: row.phone,
      departmentNameEn: row.department_name_en, departmentNameKh: row.department_name_kh,
      serviceMode: row.service_mode, entryDate: row.entry_date, exitDate: row.discharge_date || '',
      registrationNumber: Number(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0) || null,
      paymentDate: latestPayment, paymentType: status?.paymentType || 'NOT_PAID',
      workflowStage,
      cashierQueueReady: explicitQueue, cashierInvoiceId:bill?.invoice?.id||'',
      cashierQueueSource: explicitQueue ? (queue?.source || '') : '',
      cashierQueueSentAt: explicitQueue ? (Number(queue?.sentAt || 0) || null) : null,
      cashierBalance: balance,
      paraclinicPaymentPending: paraclinicQueue,
      paymentStatus: status,
    };
  });
  return view === 'queue' ? patients.filter(patient => patient.cashierQueueReady) : patients;
}

export function listExpenses(database, limit = 200) {
  return database.sqlite.prepare(`SELECT e.*,u.display_name created_by_name FROM finance_expenses e
    LEFT JOIN users u ON u.id=e.created_by ORDER BY e.spent_at DESC LIMIT ?`).all(Math.min(500,Math.max(1,Number(limit)||200))).map(expenseFromRow);
}

function ensureDay(days, key) {
  if (!days[key]) days[key] = { date: key, income: { KHR: 0, USD: 0 }, expense: { KHR: 0, USD: 0 }, net: { KHR: 0, USD: 0 } };
  return days[key];
}

export function cashflowRange(database, rangeOptions) {
  const range = typeof rangeOptions === 'string' ? parsePeriodRange({ month: rangeOptions }) : parsePeriodRange(rangeOptions);
  const days = {};
  const incomeRows = database.sqlite.prepare(`SELECT received_at,currency,amount_minor FROM finance_payments
    WHERE voided_at IS NULL AND received_at>=? AND received_at<? ORDER BY received_at`).all(range.start,range.end);
  const expenseRows = database.sqlite.prepare(`SELECT spent_at,currency,amount_minor FROM finance_expenses
    WHERE voided_at IS NULL AND spent_at>=? AND spent_at<? ORDER BY spent_at`).all(range.start,range.end);
  for (const row of incomeRows) {
    const day = ensureDay(days,dateKeyFromMs(row.received_at));
    day.income[row.currency] += minorToMoney(row.amount_minor,row.currency);
  }
  for (const row of expenseRows) {
    const day = ensureDay(days,dateKeyFromMs(row.spent_at));
    day.expense[row.currency] += minorToMoney(row.amount_minor,row.currency);
  }
  const totals = { income:{KHR:0,USD:0}, expense:{KHR:0,USD:0}, net:{KHR:0,USD:0} };
  Object.values(days).forEach(day => {
    for (const curr of FINANCE_CURRENCIES) {
      day.net[curr] = day.income[curr] - day.expense[curr];
      totals.income[curr] += day.income[curr];
      totals.expense[curr] += day.expense[curr];
      totals.net[curr] += day.net[curr];
    }
  });
  return {
    month: range.month || '',
    startDate: range.startDate || '',
    endDate: range.endDate || '',
    label: range.label,
    days: Object.values(days).sort((a,b)=>a.date.localeCompare(b.date)),
    totals
  };
}

export function cashflowMonth(database, monthValue) {
  return cashflowRange(database, { month: monthValue });
}

export function serviceRevenueRange(database, rangeOptions) {
  const range = typeof rangeOptions === 'string' ? parsePeriodRange({ month: rangeOptions }) : parsePeriodRange(rangeOptions);
  const rows = database.sqlite.prepare(`SELECT p.currency,p.amount_minor,p.service_code,p.category_code,p.purpose,
      s.name_kh service_name_kh,s.name_en service_name_en,s.category_code catalog_category
    FROM finance_payments p
    LEFT JOIN finance_service_catalog s ON s.code=p.service_code
    WHERE p.voided_at IS NULL AND p.received_at>=? AND p.received_at<?
    ORDER BY p.received_at`).all(range.start,range.end);
  const categoryMap = new Map();
  const serviceMap = new Map();
  const total = { KHR:0, USD:0 };
  const categoryOrder = new Map(SERVICE_CATEGORIES.map((item,index)=>[item.code,index]));
  const general = { code:'GENERAL', labelKh:'មិនបានបែងចែក', labelEn:'General / Unallocated' };
  const categoryInfo = code => SERVICE_CATEGORIES.find(item=>item.code===code) || (code==='GENERAL' ? general : { code, labelKh:code, labelEn:code });
  for (const row of rows) {
    let categoryCode = String(row.category_code || row.catalog_category || '').toUpperCase();
    let serviceCode = String(row.service_code || '').toUpperCase();
    if (row.purpose === 'AMBULANCE_REFERRAL' && !categoryCode) categoryCode = 'AMBULANCE';
    if (row.purpose === 'AMBULANCE_REFERRAL' && !serviceCode) serviceCode = 'AMBULANCE_REFERRAL';
    if (!categoryCode) categoryCode = 'GENERAL';
    if (!serviceCode) serviceCode = 'GENERAL';
    const amount = minorToMoney(row.amount_minor,row.currency);
    total[row.currency] += amount;
    if (!categoryMap.has(categoryCode)) {
      const info=categoryInfo(categoryCode);
      categoryMap.set(categoryCode,{ code:categoryCode,labelKh:info.labelKh,labelEn:info.labelEn,receiptCount:0,totals:{KHR:0,USD:0} });
    }
    const cat=categoryMap.get(categoryCode); cat.receiptCount += 1; cat.totals[row.currency] += amount;
    const serviceKey=`${categoryCode}|${serviceCode}`;
    if (!serviceMap.has(serviceKey)) {
      const fallback = serviceCode === 'GENERAL' ? { nameKh:'មិនបានបែងចែកសេវា',nameEn:'General / Unallocated' }
        : serviceCode === 'AMBULANCE_REFERRAL' ? { nameKh:'ថ្លៃបញ្ជូនដោយរថយន្តសង្គ្រោះ',nameEn:'Ambulance referral' }
        : { nameKh:serviceCode,nameEn:serviceCode };
      serviceMap.set(serviceKey,{ categoryCode,serviceCode,nameKh:row.service_name_kh||fallback.nameKh,nameEn:row.service_name_en||fallback.nameEn,receiptCount:0,totals:{KHR:0,USD:0} });
    }
    const svc=serviceMap.get(serviceKey); svc.receiptCount += 1; svc.totals[row.currency] += amount;
  }
  const categories=[...categoryMap.values()].sort((a,b)=>(categoryOrder.get(a.code)??999)-(categoryOrder.get(b.code)??999)||a.labelEn.localeCompare(b.labelEn));
  const services=[...serviceMap.values()].sort((a,b)=>(categoryOrder.get(a.categoryCode)??999)-(categoryOrder.get(b.categoryCode)??999)||a.nameEn.localeCompare(b.nameEn));
  const ambulance = categories.find(item=>item.code==='AMBULANCE')?.totals || {KHR:0,USD:0};
  return {
    month: range.month || '',
    startDate: range.startDate || '',
    endDate: range.endDate || '',
    label: range.label,
    totals: total,
    ambulance,
    categories,
    services
  };
}

export function monthlyServiceRevenue(database, monthValue) {
  return serviceRevenueRange(database, { month: monthValue });
}

export function cashflowDayDetails(database, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))) throw new Error('Date is invalid.');
  const [year,month,day] = date.split('-').map(Number);
  const start = new Date(year,month-1,day,0,0,0,0).getTime();
  const end = new Date(year,month-1,day+1,0,0,0,0).getTime();
  const payments = database.sqlite.prepare(`SELECT p.*,u.display_name received_by_name,pr.full_name patient_name,pr.case_number
    FROM finance_payments p LEFT JOIN users u ON u.id=p.received_by LEFT JOIN patient_records pr ON pr.patient_key=p.patient_key
    WHERE p.voided_at IS NULL AND p.received_at>=? AND p.received_at<? ORDER BY p.received_at DESC`).all(start,end).map(row => ({...paymentFromRow(row), patientName:row.patient_name||'', caseNumber:row.case_number||''}));
  const expenses = database.sqlite.prepare(`SELECT e.*,u.display_name created_by_name FROM finance_expenses e
    LEFT JOIN users u ON u.id=e.created_by WHERE e.voided_at IS NULL AND e.spent_at>=? AND e.spent_at<? ORDER BY e.spent_at DESC`).all(start,end).map(expenseFromRow);
  return { date, payments, expenses };
}

export function ambulanceReferralIncome(database, start, end) {
  const totals = { KHR: 0, USD: 0 };
  const rows = database.sqlite.prepare(`SELECT currency,SUM(amount_minor) total FROM finance_payments
    WHERE voided_at IS NULL AND purpose='AMBULANCE_REFERRAL' AND received_at>=? AND received_at<? GROUP BY currency`).all(start,end);
  rows.forEach(row => { totals[row.currency] = minorToMoney(row.total,row.currency); });
  return totals;
}
