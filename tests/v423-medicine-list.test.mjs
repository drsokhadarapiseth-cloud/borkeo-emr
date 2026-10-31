// v42.3 - Medicine names from the Cambodia Essential Medicines List (10th edition,
// 2023-2024) in every prescription form; units written as international units;
// blank number of medicine and route; 3 starting rows; CMS code saved.
// The browser behaviour is also checked in tests/v425-medicine-list-browser.mjs (v42.5).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { openDatabase } from '../server/database.mjs';
import { ensureStockSchema, addStockItem, listStock, syncMedicineStock } from '../server/stock.mjs';
import { canonicalMedicineUnit, sameMedicineUnit } from '../server/medicine-units.mjs';
import { buildMedicineMatrix } from '../server/ward-medicine-matrix.mjs';
import { checkAgainstBaseline } from '../scripts/khmer-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Line endings differ between checkouts (CRLF on Windows); compare with LF.
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const catalogue = JSON.parse(read('server/catalogues/medicines-eml-2024.json'));
const html = read('protected/EMR.html');
// Unit labels written before v42.3 (now mg, mL, mcg, g, IU).
const OLD_UNIT_LABELS = ['ម.ក្រ', 'ម.ល', 'ម៉ៃក្រូក្រាម', 'ក្រាម', 'UI'];

function browserScripts() {
  const context = vm.createContext({ console });
  vm.runInContext(read('public/medicine-units.js'), context);
  vm.runInContext(read('public/medicine-autocomplete.js'), context);
  context.BorkeoMedicine.load(JSON.parse(JSON.stringify(catalogue)));
  return context;
}

test('the catalogue has 704 medicines, each with a label and a unit', () => {
  assert.equal(catalogue.length, 704);
  for (const item of catalogue) {
    assert.ok(item.label && item.unit && item.name, `item ${item.id}`);
    const expected = [item.code, item.name, item.form, item.strength].filter(Boolean).join('-');
    assert.equal(item.label, expected, `label of item ${item.id} is CMS code-Name-Form-Strength`);
  }
  assert.equal(catalogue.find(item => item.label.startsWith('AA0410')).label, 'AA0410, AA0411-Paracetamol-Tablet-500 mg');
  assert.ok(catalogue.some(item => !item.code && item.label === 'Isoflurane-Inhalation'), 'a medicine without a CMS code is shown without it');
});

test('search: "par" finds Paracetamol, "AA04" finds the AA04 codes, "amox" finds Amoxicillin', () => {
  const { BorkeoMedicine } = browserScripts();
  assert.deepEqual(Array.from(BorkeoMedicine.search('p')), [], 'search starts after 2 letters');
  assert.ok(BorkeoMedicine.search('par').some(item => item.name.startsWith('Paracetamol')));
  const codes = BorkeoMedicine.search('AA04', 50);
  assert.ok(codes.length >= 10);
  assert.ok(codes.every(item => item.code.startsWith('AA04')));
  assert.ok(BorkeoMedicine.search('amox').length > 0);
  assert.ok(BorkeoMedicine.search('amox').every(item => item.name.startsWith('Amoxicillin')));
  assert.ok(BorkeoMedicine.search('paracetamol tablet').every(item => /tablet/i.test(item.form)), 'name and form both match');
  assert.ok(BorkeoMedicine.search('fentanyl 50').some(item => /50 micrograms/.test(item.strength)), 'strength matches');
});

test('choosing a medicine sets the unit by the owner rules (international units untranslated)', () => {
  const { BorkeoMedicine } = browserScripts();
  const unitOf = id => BorkeoMedicine.optionUnit(catalogue.find(item => item.id === id));
  assert.equal(unitOf(22), 'គ្រាប់', 'Midazolam tablet');
  assert.equal(unitOf(21), 'mL', 'Midazolam oral liquid');
  assert.equal(unitOf(5), 'mg', 'Ketamine injection 50 mg');
  assert.equal(unitOf(44), 'mcg', 'Fentanyl injection 50 micrograms');
  assert.equal(unitOf(172), 'IU', 'Benzathine benzylpenicillin 1.2 million IU');
  assert.equal(unitOf(292), 'g', 'Clotrimazole cream');
  assert.equal(unitOf(643), 'បាញ់', 'inhaler: puff');
  assert.equal(unitOf(41), 'ដុំ', 'transdermal patch: piece');
  const allowed = new Set(['mg', 'mL', 'mcg', 'g', 'IU', 'mmol', 'គ្រាប់', 'កញ្ចប់', 'ដំណក់', 'បាញ់', 'ដុំ']);
  for (const item of catalogue) assert.ok(allowed.has(BorkeoMedicine.optionUnit(item)), `${item.label}: ${item.unit}`);
  for (const item of catalogue.filter(entry => entry.route === 'INJ')) {
    assert.ok(!['អំពូល', 'ផ្លាកុង'].includes(BorkeoMedicine.optionUnit(item)), 'injections are never in ampoules');
  }
});

test('unit selects show mg, mL, mcg, g and IU, never the old Khmer labels; one new piece unit', () => {
  const selects = [...html.matchAll(/<select class="rx-select [^"]*-unit"[^>]*>([\s\S]*?)<\/select>/g)].map(match => match[1]);
  assert.equal(selects.length, 3, 'two row templates and the daily-note starter row');
  for (const options of selects) {
    for (const unit of ['mg', 'mL', 'mcg', 'g', 'IU', 'ដុំ']) assert.match(options, new RegExp(`<option value="${unit}">${unit}</option>`));
    for (const old of OLD_UNIT_LABELS) assert.equal(options.includes(old), false, old);
    const values = [...options.matchAll(/value="([^"]*)"/g)].map(match => match[1]);
    assert.equal(new Set(values).size, values.length, 'no duplicate units');
  }
  assert.match(html, /"mg": \{ khmer: "mg", english: "mg" \}/, 'the unit is not translated in either language');
  assert.match(html, /"IU": \{ khmer: "IU", english: "IU" \}/);
});

test('an old line saved with the Khmer mg label opens as mg, and stock still matches it', () => {
  const { BorkeoMedicineUnits } = browserScripts();
  for (const [old, unit] of [['ម.ក្រ', 'mg'], ['ម.ល', 'mL'], ['ម៉ៃក្រូក្រាម', 'mcg'], ['ក្រាម', 'g'], ['UI', 'IU'], ['គ្រាប់', 'គ្រាប់']]) {
    assert.equal(BorkeoMedicineUnits.canonical(old), unit);
    assert.equal(canonicalMedicineUnit(old), unit);
  }
  assert.ok(sameMedicineUnit('ម.ក្រ', 'mg') && !sameMedicineUnit('mg', 'mL'));
  assert.match(html, /put\('\.' \+ prefix \+ '-' \+ part, part === 'dose' \? med\.doseAmount : \(part === 'unit' && med\.unit \? medicationUnitValue\(med\.unit\)/);

  const db = openDatabase(':memory:');
  try {
    ensureStockSchema(db);
    addStockItem(db, 'medicine', { name: 'Diazepam injection', unit: 'ម.ក្រ', quantity: 100 }, 'pharmacist');
    addStockItem(db, 'medicine', { name: 'Morphine injection', unit: 'mg', quantity: 100 }, 'pharmacist');
    syncMedicineStock(db, 'IPD:new-unit', [{ name: 'Diazepam injection', unit: 'mg', total: 10 }], 'doctor');
    syncMedicineStock(db, 'IPD:old-unit', [{ name: 'Morphine injection', unit: 'ម.ក្រ', total: 5 }], 'doctor');
    const balance = name => listStock(db, 'medicine').find(item => item.name === name).balance;
    assert.equal(balance('Diazepam injection'), 90);
    assert.equal(balance('Morphine injection'), 95);
    assert.throws(() => syncMedicineStock(db, 'IPD:wrong', [{ name: 'Morphine injection', unit: 'mL', total: 1 }], 'doctor'), /Stock unit does not match/);
  } finally { db.sqlite.close(); }

  const matrix = buildMedicineMatrix([{ patientKey: 'a', medications: [{ name: 'Diazepam 10 mg', unit: 'ម.ក្រ', total: '2' }, { name: 'Diazepam 10 mg', unit: 'mg', total: '3' }] }]);
  assert.equal(matrix.columns.length, 1, 'ward medicine report: old and new unit forms are one column');
  const safety = read('public/medication-safety.js');
  assert.match(safety, /normalize\(canonicalUnit\(rule\.unit\)\) !== doses\.unit/, 'maximum dose compares the same unit');
});

test('number of medicine and route are blank in a new row; there is no default PO', () => {
  assert.equal((html.match(/class="rx-num-input \$\{prefix\}-dose" value="" oninput/g) || []).length, 2);
  assert.doesNotMatch(html, /-dose" value="1" placeholder="1"/);
  assert.match(html, /<td><select class="rx-select \$\{prefix\}-route"><option value="" selected>-- ជ្រើស --<\/option>/);
  for (const prefix of ['orx', 'rx', 'mrx']) {
    assert.match(html, new RegExp(`populateMedicationRouteSelect\\(tr\\.querySelector\\('\\.${prefix}-route'\\), ''\\);`));
    assert.doesNotMatch(html, new RegExp(`populateMedicationRouteSelect\\(tr\\.querySelector\\('\\.${prefix}-route'\\), 'po'\\);`));
  }
  const populate = html.slice(html.indexOf('function populateMedicationRouteSelect'), html.indexOf('function medicationUnitValue'));
  assert.match(populate, /blankRoute\.value = '';/);
  assert.match(populate, /if \(!noRoute && !getMedicationRouteDefinitions\(\)/, 'an empty route never shows the unverified option');
  assert.doesNotMatch(read('public/medicine-autocomplete.js'), /-route|\.route\b|data-med="route"/, 'choosing a medicine never fills the route');
  // Old saved lines keep their route; lines saved without one stay PO, as before.
  assert.equal((html.match(/populateMedicationRouteSelect\(route, med\.route \|\| 'po'\)/g) || []).length, 3);
  assert.match(html, /populateMedicationRouteSelect\(routeField, med\.route \|\| 'po'\)/);
});

test('a row with a medicine but no route cannot be saved; empty rows are ignored', () => {
  const validate = html.slice(html.indexOf('window.validateMedicationRoutes = function'), html.indexOf("document.addEventListener('change', function (event) {\n            var route = event.target;"));
  assert.match(validate, /'សូមជ្រើសរើសផ្លូវប្រើថ្នាំ'/);
  assert.match(validate, /var missing = Boolean\(name && normalizeNursingCellText\(name\.value\)\) && !normalizeNursingCellText\(route\.value\);/);
  assert.match(read('public/emr-patient-record.js'), /window\.validateMedicationRoutes\?\.\('#opd_rx_tbody tr\.orx-main-row, #rx_tbody tr\.rx-main-row, #rx_protocol_tbody tr\.protocol-main-row'\)/);
  assert.match(html, /if \(!restoring && window\.validateMedicationRoutes\('#mon_rx_tbody tr\.mrx-main-row, #mon_rx_protocol_tbody tr\.protocol-main-row'\)\) return false;/);
  const workflow = read('public/emr-inpatient-workflow.js');
  assert.match(workflow, /const missing = Boolean\(name\) && !route\.value;/);
  assert.match(workflow, /const routeError = dischargeRouteError\(\);/);
});

test('each prescription table starts with 3 rows; saved records keep every line', () => {
  assert.match(html, /\/\/ v42\.3: each prescription table starts with 3 rows\.\n\s+for \(var i = 0; i < 3; i\+\+\) \{\n\s+addOpdRxRow\(true\);/);
  assert.match(html, /for \(var i = 0; i < 3; i\+\+\) \{\n\s+addRxRow\(true\);/);
  assert.match(html, /for \(var i = 0; i < 2; i\+\+\) \{\n\s+addMonRxRow\(true\);\n\s+\}\n\s+reserveMonitoringKeyPositions\(2\);/);
  assert.match(html, /length < 3\) addRxRow\(true\);/);
  assert.match(html, /length < 3\) addOpdRxRow\(true\);/);
  assert.doesNotMatch(html, /i < 5; i\+\+|length < 5\) add/);
  assert.match(html, /medications\.slice\(0, 150\)\.forEach/, 'restores all saved lines (up to 150)');
  // Two hidden placeholder rows keep the record storage positions of the old
  // daily-note rows 4 and 5, so no saved key changes.
  const reserve = html.slice(html.indexOf('function reserveMonitoringKeyPositions'), html.indexOf('function evaluateMonitoringVitalStates'));
  assert.match(reserve, /control\.setAttribute\('data-emr-no-save', ''\);/);
  assert.match(reserve, /row\.classList\.remove\('mrx-main-row'\);/);
});

test('no NaN in the total when the number of medicine is empty', () => {
  assert.match(html, /var dose = parseFloat\(getMedicationDoseAmount\(mainRow\)\) \|\| 0;/);
  // v42.5: an empty number of medicine leaves the total empty (not 0, never NaN).
  assert.match(html, /totalField\.value = total && isFinite\(total\) \? String\(Math\.round\(total \* 100\) \/ 100\) : '';/);
  assert.match(html, /var dose = getMedicationDoseAmount\(mainRow\) \|\| '0';/, 'legacy dose fields get 0, not NaN');
});

test('Khmer check accepts only the five international units as replacements of old unit labels', () => {
  const item = text => ({ text, file: 'x', line: 1 });
  const approved = [{ before: 'ម.ក្រ (mg)', after: 'mg' }, { before: 'លេប', after: 'tablet' }];
  assert.deepEqual(checkAgainstBaseline({ baseline: [item('ម.ក្រ (mg)')], current: [], approvedChanges: approved, approvedNew: new Set() }), []);
  assert.equal(checkAgainstBaseline({ baseline: [item('លេប')], current: [], approvedChanges: approved, approvedNew: new Set() }).length, 1);
});

test('catalogue, script and styles are served; the catalogue needs a login; CMS code is saved; free text and old lines stay', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const login = async username => {
    const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: app.config.appOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    assert.equal(response.status, 200);
    const Cookie = response.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
    return { Cookie, Origin: app.config.appOrigin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
  };
  try {
    assert.equal((await fetch(origin + '/api/medicines/catalogue')).status, 401, 'login needed');
    const doctor = await login('doctor_medicine');
    const served = await fetch(origin + '/api/medicines/catalogue', { headers: doctor });
    assert.equal(served.status, 200);
    const body = await served.json();
    assert.equal(body.count, 704);
    assert.equal(body.items.length, 704);
    for (const [file, type] of [['medicine-autocomplete.js', 'javascript'], ['medicine-autocomplete.css', 'css'], ['medicine-units.js', 'javascript']]) {
      const response = await fetch(`${origin}/public/${file}`);
      assert.equal(response.status, 200, file);
      assert.match(response.headers.get('content-type'), new RegExp(type));
    }
    const page = await (await fetch(origin + '/emr?view=medical', { headers: doctor })).text();
    assert.match(page, /\/public\/medicine-autocomplete\.js/);
    assert.match(page, /\/public\/medicine-autocomplete\.css/);
    assert.match(page, /\/public\/medicine-units\.js/);

    // Saved medication lines: cmsCode is additive; old lines and free text unchanged.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(new Date());
    const oldLine = { rowType: 'regularRow', name: 'Paracetamol 500 mg', route: 'po', unit: 'ម.ក្រ', m: '1', a: '0', e: '1', n: '0', d: '5', total: '10', note: '', doseAmount: '1', scheduleType: 'bid' };
    const chosen = { ...oldLine, name: 'AA0040-Amoxicillin-powder for suspension (oral liquid)-125 mg (as trihydrate)/5 mL', unit: 'mL', doseAmount: '', cmsCode: 'AA0040' };
    const freeText = { ...oldLine, name: 'Synthetic medicine not in the list', unit: 'គ្រាប់' };
    const medications = [oldLine, chosen, freeText];
    const saved = await fetch(origin + '/api/patient-record', { method: 'PUT', headers: doctor, body: JSON.stringify({
      patientKey: 'case:V423-1', editorScope: 'medical',
      summary: { caseNumber: 'V423-1', healthId: '', firstName: 'Synthetic', lastName: 'Medicine', fullName: 'Synthetic Medicine', sex: 'ប្រុស', age: '30', departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: today },
      data: { 'scope:medical:id:ipd_first_exam_date': today, 'system:initialIpdMedications': JSON.stringify(medications) },
    }) });
    assert.equal(saved.status, 200, await saved.clone().text());
    const stored = JSON.parse(app.database.findPatient('case:V423-1').record_json)['system:initialIpdMedications'];
    assert.deepEqual(JSON.parse(stored), medications, 'saved exactly: old line unchanged, cmsCode kept, free text kept');
    assert.equal('cmsCode' in JSON.parse(stored)[0], false, 'an old line gets no cmsCode');

    // The ward medicine report reads the long names and both unit forms.
    const director = await login('director');
    const report = await (await fetch(`${origin}/api/reports/ward-medicines?ward=medicine&date=${today}`, { headers: director })).json();
    assert.equal(report.matrix.patientCount, 1);
    assert.ok(report.matrix.columns.some(column => column.name.startsWith('AA0040-Amoxicillin')));
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});

test('collectors add cmsCode only for a chosen list medicine; the discharge save keeps it', () => {
  assert.match(html, /var cmsCode = medicationCmsCode\(row, prefix\);\n\s+if \(cmsCode\) order\.cmsCode = cmsCode;/);
  assert.match(html, /var cmsCode = medicationCmsCode\(row, 'orx'\);\n\s+if \(cmsCode\) order\.cmsCode = cmsCode;/);
  assert.match(html, /if \(cmsCode\) medication\.cmsCode = cmsCode;/);
  assert.match(read('server/server.mjs'), /\.\.\.\(read\('cmsCode', 40\) \? \{ cmsCode: read\('cmsCode', 40\) \} : \{\}\),/);
  assert.match(read('server/server.mjs'), /name: read\('name', 600\)/, 'long list names (up to 515 characters) can be discharged');
  const search = read('public/medicine-autocomplete.js');
  assert.match(search, /delete target\.dataset\.cmsCode;/, 'typing by hand makes the line free text');
  assert.match(search, /input\.dataset\.cmsCode = m\.code \|\| '';/);
  assert.doesNotMatch(search, /<style|createElement\('style'\)/, 'no inline style tag (Content-Security-Policy)');
  assert.match(search, /'រកមិនឃើញឱសថ'/);
});
