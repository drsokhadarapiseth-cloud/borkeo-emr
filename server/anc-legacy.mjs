import fs from 'node:fs';
export const legacyAncFields = Object.freeze(JSON.parse(fs.readFileSync(new URL('./catalogues/anc-legacy-fields.json', import.meta.url), 'utf8')));
export const ANC_SUPPLEMENTAL_FIELDS = Object.freeze([32, 34, 43, 44, 45, 47, 49, 51, 52, 53, 54].map(String));
// Only the selected encounter; never migrate another pregnancy by Health ID.
export function readLegacyAnc(row) {
  let stored = {};
  try { stored = JSON.parse(row.record_json || '{}'); } catch { /* empty form */ }
  const entries = [];
  for (const field of legacyAncFields) {
    const value = Object.hasOwn(stored, field.key) ? stored[field.key] : stored[field.legacyKey];
    if (field.type === 'radio') {
      if (value === true || value === 'true') entries.push({ label: field.label, value: field.option });
    } else if (value !== undefined && value !== null && String(value).trim()) entries.push({ label: field.label, value: String(value) });
  }
  return { patientKey: row.patient_key, caseNumber: row.case_number, date: row.entry_date, entries };
}
export function cleanAncSupplemental(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw new Error('Invalid ANC encounter details.');
  return Object.fromEntries(Object.entries(details).map(([key, value]) => {
    if (!ANC_SUPPLEMENTAL_FIELDS.includes(key) || typeof value !== 'string' || value.length > 2000) throw new Error('Invalid ANC encounter detail.');
    return [key, value];
  }));
}
