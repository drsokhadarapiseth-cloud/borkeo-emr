import crypto from 'node:crypto';

const routes = new Set([
  'po', 'iv_fluid', 'antibiotic_iv', 'antibiotic_im', 'other_iv', 'other_im',
  'subcutaneous', 'topical', 'drops', 'inhaled', 'vaginal', 'rectal', 'sublingual',
]);
const units = new Set([
  'គ្រាប់', 'កាប់ស៊ុល', 'អំពូល', 'ផ្លាកុង', 'ដប', 'ទីប', 'កញ្ចប់',
  'ដំណក់', 'គ្រាប់សុល', 'បន្ទះ', 'បាញ់', 'ស្លាបព្រា', 'ម.ល', 'ម.ក្រ',
  'ក្រាម', 'លីត្រ', 'UI', 'mEq', 'mmol', 'ឯកតា',
]);

export const normalizePmrsId = value => String(value || '').replace(/[\s-]/g, '').toLowerCase();

function readString(value, max, label) {
  const text = String(value ?? '').trim();
  if (text.length > max || /[\u0000-\u001f\u007f]/.test(text)) throw new Error(`${label} is invalid.`);
  return text;
}

function numberString(value, label, min = 0, max = 99) {
  const raw = String(value ?? '').trim();
  if (!/^(?:\d+)(?:\.\d{1,3})?$/.test(raw)) throw new Error(`${label} requires a number.`);
  const amount = Number(raw);
  if (amount < min || amount > max) throw new Error(`${label} is outside the supported range.`);
  return String(amount);
}

function localDateTime(value) {
  const text = readString(value, 20, 'Record date').replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) throw new Error('Enter the date and time of this PMRS2 record.');
  const date = new Date(`${text.slice(0,10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== text.slice(0,10) ||
      Number(text.slice(11,13)) > 23 || Number(text.slice(14,16)) > 59) {
    throw new Error('Record date or time is invalid.');
  }
  return text;
}

function schedule(slots) {
  const keys = ['m','a','e','n'].filter(key => Number(slots[key]) > 0).join('');
  const positive = Object.values(slots).map(Number).filter(amount => amount > 0);
  if (!positive.length) throw new Error('A medicine must have at least one scheduled dose.');
  if (positive.some(amount => amount !== positive[0])) {
    throw new Error('Different amounts per time need manual entry in the EMR treatment form.');
  }
  const codes = {
    m:'qd_m', a:'qd_a', e:'qd_e', n:'qd_n', me:'bid', mae:'tid', maen:'qid',
  };
  if (!codes[keys]) throw new Error('This time pattern needs manual review in the EMR treatment form.');
  return { scheduleType:codes[keys], doseAmount:String(positive[0]) };
}

export function preparePmrsMedicineImport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Import information is invalid.');
  const sourcePid = readString(input.sourcePid, 120, 'PMRS2 patient ID');
  const sourceVisit = readString(input.sourceVisit, 160, 'PMRS2 visit ID');
  if (!sourcePid || !sourceVisit) throw new Error('Open a PMRS2 visit with a patient ID and visit ID.');
  const target = readString(input.target, 12, 'Import target');
  if (!['daily','admission','opd'].includes(target)) throw new Error('Choose where the EMR should store the medicine.');
  const recordAt = localDateTime(input.recordAt);
  if (!Array.isArray(input.medications) || !input.medications.length || input.medications.length > 60) {
    throw new Error('Choose 1–60 PMRS2 medicines for import.');
  }
  const indexes = new Set();
  const medications = input.medications.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Medicine ${index+1} is invalid.`);
    const rowIndex = Number(row.sourceRowIndex);
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > 500 || indexes.has(rowIndex)) {
      throw new Error('PMRS2 row numbers must be unique and valid.');
    }
    indexes.add(rowIndex);
    const name = readString(row.name, 240, 'Medicine name');
    const route = readString(row.route, 40, 'Medicine route');
    const unit = readString(row.unit, 40, 'Medicine unit');
    if (!name || !routes.has(route)) throw new Error(`Medicine ${index+1}: check its name and route.`);
    if (!units.has(unit)) throw new Error(`Medicine ${index+1}: select its EMR unit.`);
    const slots = Object.fromEntries(['m','a','e','n'].map(key =>
      [key, numberString(row[key], `Medicine ${index+1} ${key}`)]));
    const d = numberString(row.d, `Medicine ${index+1} duration`, 1, 90);
    const { scheduleType, doseAmount } = schedule(slots);
    const amount = Object.values(slots).reduce((sum, part) => sum + Number(part), 0);
    const total = String(Math.round(amount * Number(d) * 1_000) / 1_000);
    const sourceKey = crypto.createHash('sha256')
      .update(JSON.stringify([normalizePmrsId(sourcePid),sourceVisit,target,recordAt,rowIndex])).digest('hex');
    const fingerprint = crypto.createHash('sha256')
      .update(JSON.stringify({ name, route, unit, slots, d })).digest('hex');
    return {
      sourceKey, fingerprint,
      medication: { name, route, unit, ...slots, d, total, doseAmount, scheduleType,
        timingMode:'scheduled', effectiveAt:recordAt, note:'', pmrsImportKey:sourceKey },
    };
  });
  return { sourcePid, sourceVisit, target, recordAt, medications };
}

function parseArray(value, label) {
  if (!value) return [];
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${label} cannot be read.`); }
  if (!Array.isArray(parsed)) throw new Error(`${label} has an invalid structure.`);
  return parsed;
}

export function applyPmrsMedicineImport(existingData, prepared, patient) {
  if (!normalizePmrsId(patient?.healthId) ||
      normalizePmrsId(patient.healthId) !== normalizePmrsId(prepared.sourcePid)) {
    throw new Error('PMRS2 patient ID does not match the EMR Health ID.');
  }
  if (prepared.target === 'opd' && patient.serviceMode !== 'opd' ||
      prepared.target !== 'opd' && patient.serviceMode !== 'ipd') {
    throw new Error('PMRS2 treatment type and EMR service type do not match.');
  }
  const data = { ...existingData };
  const ledger = parseArray(data['system:pmrs2ImportLedger'], 'PMRS2 import history');
  if (ledger.length > 1_000) throw new Error('Import history is full. Contact the EMR administrator.');
  const prior = new Map(ledger.map(item => [item.sourceKey,item]));
  const pending = [];
  let skipped = 0;
  for (const row of prepared.medications) {
    const saved = prior.get(row.sourceKey);
    if (saved) {
      if (saved.fingerprint !== row.fingerprint) throw new Error('A previously imported PMRS2 medicine has changed. Review it manually in the EMR.');
      skipped += 1;
      continue;
    }
    pending.push(row);
  }
  if (!pending.length) return { data, added:0, skipped };
  const meds = pending.map(item => item.medication);
  if (prepared.target === 'admission') {
    const existing = parseArray(data['system:initialIpdMedications'], 'Admission medicines');
    if (existing.length + meds.length > 150) throw new Error('Too many admission medicines.');
    data['system:initialIpdMedications'] = JSON.stringify([...existing,...meds]);
  } else if (prepared.target === 'opd') {
    const existing = parseArray(data['system:opdMedications'], 'OPD medicines');
    if (existing.length + meds.length > 150) throw new Error('Too many OPD medicines.');
    data['system:opdMedications'] = JSON.stringify([...existing,...meds]);
  } else {
    const existing = parseArray(data['system:dailyMonitoringRecords'], 'Daily follow-ups');
    if (existing.length > 500) throw new Error('Too many daily follow-ups.');
    const matches = existing.filter(row => row && row.dtVal === prepared.recordAt);
    if (matches.length > 1) throw new Error('Several EMR follow-ups have the same date and time. Review them manually.');
    let followUp = matches[0];
    if (!followUp) {
      followUp = { dtVal:prepared.recordAt, temp:'',bp_sys:'',bp_dia:'',pulse:'',resp:'',spo2:'',
        evol:'',conclusion:'', medications:[] };
      existing.push(followUp);
    }
    if (!Array.isArray(followUp.medications) || followUp.medications.length + meds.length > 150) {
      throw new Error('Too many medicines on this daily follow-up.');
    }
    followUp.medications = [...followUp.medications,...meds];
    data['system:dailyMonitoringRecords'] = JSON.stringify(existing);
  }
  data['system:pmrs2ImportLedger'] = JSON.stringify([
    ...ledger,...pending.map(row => ({sourceKey:row.sourceKey,fingerprint:row.fingerprint,
      importedAt:new Date().toISOString()})),
  ]);
  for (const key of ['system:dailyMonitoringRecords','system:initialIpdMedications','system:opdMedications']) {
    const limit = key === 'system:dailyMonitoringRecords' ? 500_000 : 150_000;
    if (typeof data[key] === 'string' && data[key].length > limit) throw new Error('The saved medicine list is too large.');
  }
  if (data['system:pmrs2ImportLedger'].length > 20_000) throw new Error('Import history is too large.');
  return { data, added:pending.length, skipped };
}
