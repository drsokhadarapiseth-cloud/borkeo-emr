// Parse copied visible summary text only. Never interpret pasted HTML or execute it.
export const PMRS2_PASTE_FIELDS = [
  ['fullName', 'ឈ្មោះ', ['ឈ្មោះអ្នកជំងឺ', 'ឈ្មោះ', 'Patient name']],
  ['sex', 'ភេទ', ['ភេទ', 'Sex']],
  ['age', 'អាយុ', ['អាយុ', 'Age']],
  ['dob', 'ថ្ងៃខែឆ្នាំកំណើត', ['ថ្ងៃខែឆ្នាំកំណើត', 'ថ្ងៃកំណើត', 'Date of birth']],
  ['phone', 'លេខទូរស័ព្ទ', ['លេខទូរស័ព្ទ', 'Phone']],
  ['healthId', 'លេខបណ្ណសុខភាព', ['លេខបណ្ណសុខភាព', 'លេខប័ណ្ណសុខភាព', 'លេខបណ្ណសុខាភាព', 'Health ID']],
  ['caseNumber', 'លេខករណី', ['លេខករណី', 'Case number']],
  ['equityCard', 'លេខបណ្ណសមធម៌', ['លេខបណ្ណសមធម៌', 'Equity card']],
  ['street', 'អាសយដ្ឋាន', ['អាសយដ្ឋាន', 'Address']],
];
const ignored = ['ជនជាតិ', 'កាលបរិច្ឆេទចូល', 'កាលបរិច្ឆេទចុះឈ្មោះ', 'ប្រភេទសេវា', 'ផ្នែកចូល', 'ប្រភេទនៃការចូល', 'ប្រភេទការចូល', 'ប្រវត្តិវាស់វែងអ្នកជំងឺ', 'ប្រវត្តិវាស់វែងនៃអ្នកជំងឺ', 'ទម្ងន់', 'កម្ពស់', 'សីតុណ្ហភាព', 'ជីពចរ', 'ចង្វាក់បេះដូង', 'សម្ពាធឈាម', 'BMI', 'ឈ្មោះអ្នកកំដរ', 'លេខទូរស័ព្ទអ្នកកំដរ'];
const clean = value => String(value ?? '').normalize('NFC').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
const digits = value => value.replace(/[០-៩]/g, c => String(c.charCodeAt(0) - 0x17e0));
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parsePmrs2Text(raw) {
  if (typeof raw !== 'string' || raw.length > 30000) return { payload: {}, warnings: ['size'] };
  const text = raw.normalize('NFC').replace(/[\u200b-\u200d\ufeff]/g, '');
  const captions = new Map();
  for (const [key, , aliases] of PMRS2_PASTE_FIELDS) for (const alias of aliases) captions.set(alias, key);
  for (const alias of ignored) captions.set(alias, null);
  const pattern = [...captions.keys()].sort((a, b) => b.length - a.length).map(escape).join('|');
  const re = new RegExp('(?:^|\\s)(' + pattern + ')(?=[\\s:\\u17c8\\u17d6\\uff1a])[:\\u17c8\\u17d6\\uff1a\\s]*', 'gu');
  const matches = [...text.matchAll(re)];
  const payload = {}, warnings = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i], key = captions.get(match[1]);
    if (!key) continue;
    let value = clean(text.slice(match.index + match[0].length, matches[i + 1]?.index ?? text.length));
    if (!value) continue;
    // Never let a copied paragraph become an identifier or a patient name.
    if (value.length > (key === 'street' ? 500 : 200) || /[<>]/.test(value)) { warnings.push(key); continue; }
    if (key === 'sex') {
      if (/^(?:male|m)$/iu.test(value)) value = 'ប្រុស';
      if (/^(?:female|f)$/iu.test(value)) value = 'ស្រី';
      if (!['ប្រុស', 'ស្រី'].includes(value)) { warnings.push(key); continue; }
    }
    if (key === 'age') {
      const years = digits(value).match(/^(\d{1,3})(?:\s*(?:ឆ្នាំ|years?|yrs?))?$/iu);
      if (!years || Number(years[1]) > 130) { warnings.push(key); continue; }
      value = String(Number(years[1]));
    }
    if (key === 'dob') {
      const normalized = digits(value);
      const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const local = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      value = iso ? normalized : local ? `${local[3]}-${local[2]}-${local[1]}` : '';
      const date = new Date(value + 'T00:00:00Z');
      if (!value || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) { warnings.push(key); continue; }
    }
    if (payload[key] && payload[key] !== value) return { payload: {}, warnings: ['conflict'] };
    payload[key] = value;
  }
  return { payload, warnings };
}
