import fs from 'node:fs';
export const standards = JSON.parse(fs.readFileSync(new URL('./standards.json', import.meta.url), 'utf8'));
export const referenceSheets = standards.workbooks['external_standard_data_references_v1.4.xlsx'];
export const structureSheets = standards.workbooks['external_standard_data_structure_v1.4.xlsx'];
export const clinicalSheets = standards.workbooks['clinical_data_form_v1.4.xlsx'];
const norm = s => String(s ?? '').trim().toLocaleLowerCase();
const lists = new Map();
function add(category, code, ...aliases) {
  if (!code) return;
  if (!lists.has(category)) lists.set(category, new Map());
  for (const alias of [code,...aliases].filter(Boolean)) lists.get(category).set(norm(alias), code);
}
for (const row of referenceSheets['Standard Lookup'].slice(1)) {
  const category = {sex:'sex','Marital Status':'marital','Admission Types':'admission','Visit Types':'visit','Discharge Type':'discharge','Visit Outcomes':'outcome','Payment Type':'payment','Diagnosis Types':'diagnosis'}[row[1]];
  if (category && /^(?:F|M|MAST-|ADTY-|VITY-|DITY-|VIOU-|PATY-|DIAGT-)/.test(row[3] || '')) add(category, row[3], row[4], row[5]);
}
for (const row of referenceSheets['Payment Type'].slice(1)) add('payment',row[0],row[4]);
for (const row of referenceSheets.Nationalities.slice(1)) add('nationality',row[0],row[1]);
for (const row of referenceSheets['Form Values'].slice(1)) add('form:' + row[0],row[1],row[2],row[3]);
for (const [category,sheet] of [['history','Medical Histories'],['physical','Phyiscal Examination'],['vital','Vital signs']])
  for (const row of referenceSheets[sheet].slice(1)) add(category,row[0],row[1]);
const aliases = {
  sex: { male:'M',female:'F' },
  marital: {single:'Single',married:'Married',widowed:'Widowed',divorced:'Divorced'},
  visit: {opd:'OPD',ipd:'IPD'},
  payment: { HEF_POOR:'PATY-0000N09',HEF_EQUITY:'PATY-0000N09',HEF_VULNERABLE:'PATY-00003LD',HEF_VULNERABLE_FAMILY:'PATY-00003LD',NSSF_WORKER:'PATY-0000G3E',NSSF_CIVIL:'PATY-00B003F',NSSF:'PATY-000K010',CASH:'PATY-00T001A',DISCOUNT:'PATY-0000H08',EXEMPT:'PATY-0J0000C',FULL_WAIVER:'PATY-0J0000C' },
  nationality: { 'ខ្មែរ':'KHM',Cambodian:'KHM' },
};
export function codeValues(category) { return [...new Set(lists.get(category)?.values() || [])]; }
export function mapCode(category, value, database) {
  const key=String(value ?? '').trim();
  const override=database?.sqlite.prepare('SELECT npca_code FROM npca_codes WHERE category=? AND local_value=?').get(category,key)?.npca_code;
  if (override) return validCode(category,override) ? override : null;
  const alias=Object.entries(aliases[category]||{}).find(([name])=>norm(name)===norm(key))?.[1] || key;
  return lists.get(category)?.get(norm(alias)) || null;
}
export function validCode(category, value) { return codeValues(category).includes(value); }
export function mappedService(database, localValue) {
  return database?.sqlite.prepare("SELECT npca_code FROM npca_codes WHERE category='service' AND local_value=?").get(String(localValue))?.npca_code || null;
}
export const formDefinitions = (() => {
  const forms = new Map(); let current;
  for (const row of structureSheets['Form Structure'].slice(1)) {
    if (row[0]?.startsWith('ENTY-')) { current = { code:row[0],name:row[1],kh:row[2],fields:[] };forms.set(current.code,current); }
    if (current && row[3]) current.fields.push({name:row[3],type:norm(row[4]),kh:row[5],en:row[6],required:['required','yes'].includes(norm(row[7])),valueSet:row[8] || ''});
  }
  return forms;
})();
export function formValueSet(name){return ({'Birht Control Type':'Birth Control Type','Presentations':'Presentation','Delivery Types':'Delivery Type','Contraceptive Method Type':'Type Of Contraceptive Method Received','Newborn Examination Result':'Newborn Examination Results','Child Examination Result':'Child Examination Results'})[name]||name;}
export const modelDefinitions = (() => {
  const models = []; let current;
  for (const row of structureSheets['API Objects']) {
    if (row[0] && /object|array/i.test(row[3] || '')) { current={name:row[0],fields:[]};models.push(current); }
    else if (current && !row[0] && row[1]) current.fields.push({name:row[1],kh:row[2],type:norm(row[3]),required:norm(row[5])==='required',condition:row[7]||'',standard:row[6]||''});
  }
  return models;
})();
export function setCodeOverride(database, category, localValue, code, actorId) {
  if (!localValue || typeof localValue!=='string' || localValue.length>200 || (category!=='service' && !validCode(category,code)) || (category==='service' && !/^[A-Za-z0-9._-]{1,100}$/.test(code))) throw new Error('កូដ NPCA មិនត្រឹមត្រូវ។');
  database.sqlite.prepare(`INSERT INTO npca_codes VALUES (?,?,?,?,?) ON CONFLICT(category,local_value) DO UPDATE SET npca_code=excluded.npca_code,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).run(category,localValue,code,actorId,Date.now());
}
