// Required entries carried forward from the old ANC form. Never invent defaults.
export const ANC_REQUIRED_FIELDS = Object.freeze([
  ['record', 'identity.gravida'], ['record', 'lmp'], ['record', 'heightCm'],
  ['visit', 'weight'], ['visit', 'bp'], ['visit', 'pulse'], ['visit', 'temperature'], ['visit', 'spo2'],
  ['visit', 'complaint'], ['visit', 'fer'],
  ...['32', '34', '37', '41', '43', '44', '49', '51'].map(key => ['visit', `legacyDetails.${key}`]),
]);
export function missingAncFields(record = {}, visit = {}) {
  return ANC_REQUIRED_FIELDS.filter(([scope, path]) => {
    const value = path.split('.').reduce((node, key) => node?.[key], scope === 'record' ? record : visit);
    return !['string', 'number'].includes(typeof value) || !String(value).trim();
  });
}
