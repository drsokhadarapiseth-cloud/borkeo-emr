export const SHARED_TRIAGE_FIELDS = Object.freeze([
  'p2_weight', 'p2_height', 'p2_temp', 'p2_bp_sys', 'p2_bp_dia', 'p2_pulse', 'p2_resp', 'p2_spo2',
  'pmrs_chief_complaint', 'pmrs_chief_complaint_items',
]);
// Called only after the route has checked encounter identity, role, version and edit access.
export function mergeSharedEncounterFields(data, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Invalid shared encounter fields.');
  const result = { ...data };
  for (const [id, value] of Object.entries(patch)) {
    if (!SHARED_TRIAGE_FIELDS.includes(id) || typeof value !== 'string' || value.length > 16000) throw new Error('Invalid shared encounter field.');
    result[`scope:triage:id:${id}`] = value;
  }
  return result;
}
