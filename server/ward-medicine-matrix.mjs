import { canonicalMedicineUnit } from './medicine-units.mjs';

const round = value => Math.round((value + Number.EPSILON) * 1e6) / 1e6;

function number(value) {
  const text = String(value ?? '').trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const result = Number(text);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

export function medicineRequestQuantity(medicine) {
  // The EMR total is the quantity to supply for this order, including duration.
  // It is not the per-dose amount or a count of administrations already given.
  if (String(medicine.total ?? '').trim() !== '') return number(medicine.total);
  const days = number(medicine.days ?? medicine.d);
  if (days === null || days <= 0) return null;
  const slots = ['m','a','e','n'].map(key => number(medicine[key]));
  if (slots.every(value => value !== null)) return round(slots.reduce((sum,value) => sum + value,0) * days);
  // Partial time slots and hourly/protocol orders cannot be inferred reliably.
  if (['m','a','e','n'].some(key => String(medicine[key] ?? '').trim() !== '')) return null;
  const frequency = {bid:2,tid:3,qid:4,qd_m:1,qd_a:1,qd_e:1,qd_n:1}[String(medicine.scheduleType || '').toLowerCase()];
  const dose = number(medicine.doseAmount);
  return frequency && dose !== null ? round(dose * frequency * days) : null;
}

function normalize(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
}

function unitKey(value) {
  // v42.3: old Khmer unit labels count as mg, mL, mcg, g and IU.
  const unit = normalize(canonicalMedicineUnit(value));
  const aliases = {tablet:'គ្រាប់',tablets:'គ្រាប់',tab:'គ្រាប់',tabs:'គ្រាប់',
    capsule:'កាប់ស៊ុល',capsules:'កាប់ស៊ុល',cap:'កាប់ស៊ុល',
    ampoule:'អំពូល',ampoules:'អំពូល',amp:'អំពូល',ampul:'អំពូល'};
  return aliases[unit] || unit;
}

export function buildMedicineMatrix(patients) {
  const columns = [];
  const byKey = new Map();
  const rows = [];
  for (const patient of patients) {
    if (!patient.medications?.length) continue;
    const cells = new Map();
    for (const medicine of patient.medications) {
      const normalizedName = normalize(medicine.name).replace(/(\d)\s+(mg|mcg|g|ml|iu)\b/g,'$1$2');
      if (!normalizedName) continue;
      // Keep strengths/formulations in the name, and never sum incompatible units.
      const unit = unitKey(medicine.unit);
      const key = JSON.stringify([normalizedName,unit]);
      if (!byKey.has(key)) {
        const column = {key,name:medicine.name.trim(),unit:medicine.unit || '',normalizedName};
        byKey.set(key,column);
        columns.push(column);
      }
      const quantity = medicineRequestQuantity(medicine);
      const cell = cells.get(key) || {quantity:0,incomplete:false};
      cell.quantity = round(cell.quantity + (quantity ?? 0));
      cell.incomplete ||= quantity === null;
      cells.set(key,cell);
    }
    if (cells.size) rows.push({patientKey:patient.patientKey,bedLabel:patient.bedLabel,
      fullName:patient.fullName,diagnosis:patient.diagnosis,cells});
  }
  for (const column of columns) {
    const differentUnits = columns.some(other => other.normalizedName === column.normalizedName && other.key !== column.key);
    column.label = column.name + (differentUnits ? ` (${column.unit || '?'})` : '');
    delete column.normalizedName;
  }
  const totals = columns.map(column => {
    const cells = rows.map(row => row.cells.get(column.key)).filter(Boolean);
    return {quantity:round(cells.reduce((sum,cell) => sum + cell.quantity,0)),incomplete:cells.some(cell => cell.incomplete)};
  });
  return {columns,rows:rows.map(row => ({...row,cells:columns.map(column => row.cells.get(column.key) || null)})),
    totals,patientCount:rows.length,unresolvedCount:rows.reduce((sum,row) => sum + [...row.cells.values()].filter(cell => cell.incomplete).length,0)};
}
