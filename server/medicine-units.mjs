// v42.3: medication units. The prescription forms now write mg, mL, mcg, g and
// IU (international units, never translated). Records saved before v42.3 hold
// the old Khmer labels. Both forms count as the same unit wherever a unit is
// compared (stock, ward medicine report columns); saved data is never rewritten.
const UNIT_ALIASES = Object.freeze({
  'ម.ក្រ': 'mg',
  'ម.ល': 'mL',
  'ml': 'mL',
  'ម៉ៃក្រូក្រាម': 'mcg',
  'µg': 'mcg',
  'ក្រាម': 'g',
  'ui': 'IU',
  'iu': 'IU',
});

export function canonicalMedicineUnit(value) {
  const unit = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  return UNIT_ALIASES[unit] || UNIT_ALIASES[unit.toLowerCase()] || unit;
}

export function sameMedicineUnit(left, right) {
  return canonicalMedicineUnit(left).toLowerCase() === canonicalMedicineUnit(right).toLowerCase();
}
