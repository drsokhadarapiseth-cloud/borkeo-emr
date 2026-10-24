// v42.5 - Medicine list (two-step search, patient filter, units, routes) and the
// maximum dose check (adult and paediatric, approved lines only).
// The browser behaviour is also checked in tests/v425-medicine-list-browser.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { openDatabase } from '../server/database.mjs';
import { ensureStockSchema, addStockItem, listStock, syncMedicineStock } from '../server/stock.mjs';
import { ensureMedicationSafetySchema, drugSafetyTables, reviewMaxDose, seedDoseLimits, updateMaxDose } from '../server/medication-safety.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const catalogue = JSON.parse(read('server/catalogues/medicines-eml-2024.json'));
const draft = JSON.parse(read('server/catalogues/dose-limits-draft.json'));
const html = read('protected/EMR.html');
const line = label => catalogue.find(item => item.label === label);

function browser() {
  const context = vm.createContext({ console });
  for (const file of ['public/medicine-units.js', 'public/medication-routes.js', 'public/medicine-autocomplete.js', 'public/medicine-dose-check.js']) vm.runInContext(read(file), context);
  context.BorkeoMedicine.load(JSON.parse(JSON.stringify(catalogue)));
  return context;
}

// Patients of the filter tests (age in years, age in days, sex, ward/service codes).
const ADULT = { ageYears: 40, ageDays: 14600, sex: 'male', wards: ['medicine'], services: ['medicine'] };
const CHILD5 = { ageYears: 5, ageDays: 1826, sex: 'female', wards: ['opd'], services: ['opd'] };
const UNKNOWN = { ageYears: null, ageDays: null, sex: '', wards: [], services: [] };
const approved = doseKey => ({ ...draft.items.find(item => item.doseKey === doseKey), status: 'approved' });

test('the catalogue has 704 lines and 339 medicine names; the dose table covers every dose key', () => {
  assert.equal(catalogue.length, 704);
  assert.equal(new Set(catalogue.map(item => item.name.toLowerCase())).size, 339);
  assert.equal(draft.items.length, 395);
  const keys = new Set(draft.items.map(item => item.doseKey));
  assert.ok(catalogue.every(item => keys.has(item.doseKey)));
});

test('step 1 shows each name once: "par" is only Paracetamol; "acetam" and "cotrim" find the other names', () => {
  const { BorkeoMedicine } = browser();
  const names = query => Array.from(BorkeoMedicine.searchNames(query, null)).map(entry => entry.name);
  assert.deepEqual(names('p'), [], 'search starts after 2 letters');
  assert.deepEqual(names('par'), ['Paracetamol']);
  assert.deepEqual(names('para'), ['Paracetamol']);
  assert.ok(names('acetam').includes('Paracetamol'));
  assert.ok(names('cotrim').includes('Sulfamethoxazole + trimethoprim'));
  assert.ok(names('AA04').includes('Paracetamol'), 'a CMS code finds the name');
  // Step 2: the forms of one name as "CMS code · Form · Strength".
  const forms = Array.from(BorkeoMedicine.formsFor('Paracetamol', ADULT)).map(BorkeoMedicine.formLine);
  assert.ok(forms.includes('AA0411 · Tablet · 500 mg'));
  assert.ok(forms.includes('Suppository · 100 mg'), 'no code when the list has none');
});

test('a full CMS code jumps to its line; a single allowed form is chosen automatically', () => {
  const { BorkeoMedicine } = browser();
  assert.equal(BorkeoMedicine.exactCode('AA0410')[0].label, 'AA0410-Paracetamol-Tablet-250 mg');
  assert.equal(BorkeoMedicine.exactCode('aa0410')[0].label, 'AA0410-Paracetamol-Tablet-250 mg');
  assert.deepEqual(Array.from(BorkeoMedicine.exactCode('AA04')), [], 'only a full code jumps');
  const neonate = { ageYears: 0, ageDays: 10, sex: 'male', wards: ['ncu'], services: [] };
  assert.equal(BorkeoMedicine.formsFor('Caffeine citrate', neonate).length, 1);
  const source = read('public/medicine-autocomplete.js');
  assert.match(source, /if \(res\.length === 1 && !lines\) \{ choose\(res\[0\], input\); return; \}/);
  assert.match(source, /e\.key === 'Backspace' && active\.step === 2/, 'Backspace from step 2 returns to the names');
  assert.match(source, /'រកមិនឃើញឱសថ'/);
});

test('filter by patient: child and adult lines; unknown age shows everything', () => {
  const { BorkeoMedicine } = browser();
  const childOnly = line('AA0413-Paracetamol-Oral liquid-125 mg/ 5mL [c]');
  const adultOnly = line('AA0410, AA0411-Paracetamol-Tablet-500 mg');
  const forChildren = line('Ibuprofen-Oral Liquid-100 mg/5ml = 20 mg/ml [c]');
  assert.ok(childOnly.child && !childOnly.adult && adultOnly.adult && !adultOnly.child);
  assert.equal(BorkeoMedicine.allowed(childOnly, CHILD5), true, '5-year-old: child line shown');
  assert.equal(BorkeoMedicine.allowed(adultOnly, CHILD5), false, '5-year-old: adult-only line hidden');
  assert.match(forChildren.notes.join(' '), /Indicated for children/);
  assert.equal(BorkeoMedicine.allowed(forChildren, ADULT), false, '40-year-old: "Indicated for children" hidden');
  assert.ok(catalogue.every(item => BorkeoMedicine.allowed(item, UNKNOWN)), 'unknown age: all shown');
  assert.equal(BorkeoMedicine.isChild({ ...UNKNOWN, wards: ['pediatric'] }), true, 'Pediatric ward counts as a child');
  // Lines with an age or weight limit are shown with the orange note.
  const atenolol = line('AA0080-Atenolol-Tablet-50 mg');
  assert.equal(BorkeoMedicine.allowed(atenolol, { ...ADULT, ageYears: 70 }), true);
  assert.deepEqual(Array.from(BorkeoMedicine.notesFor(atenolol)), ['Not older than 60 years'], 'the note already says the limit: shown once');
  const diclofenac = Array.from(BorkeoMedicine.notesFor(line('AA0170-Diclofenac-Tablet-50 mg (potassium salt)')));
  assert.equal(diclofenac.length, 1);
  assert.ok(diclofenac[0].startsWith('កុមារ៖') && diclofenac[0].endsWith(' Children > 6 months'), 'Khmer children prefix');
});

test('women-only and newborn-only lines: oxytocin and caffeine citrate', () => {
  const { BorkeoMedicine } = browser();
  const oxytocin = line('AB0440-Oxytocin-Injection-10 IU in 1-mL in ampoule');
  const caffeine = line('Caffeine citrate-Injection-20 mg/ mL');
  assert.equal(BorkeoMedicine.allowed(oxytocin, ADULT), false, 'never for a male patient');
  assert.equal(BorkeoMedicine.allowed(oxytocin, { ...CHILD5, ageYears: 12 }), false, '12-year-old girl, not pregnant');
  assert.equal(BorkeoMedicine.allowed(oxytocin, { ...CHILD5, ageYears: 14, wards: ['obstetric'] }), true, '14-year-old in the Obstetric ward');
  assert.equal(BorkeoMedicine.allowed(oxytocin, { ...CHILD5, ageYears: 13, pregnant: true }), true, 'pregnant (EDD recorded)');
  assert.equal(BorkeoMedicine.allowed(oxytocin, { ...CHILD5, ageYears: 30, sex: 'female' }), true, 'woman of 30');
  assert.deepEqual(Array.from(BorkeoMedicine.searchNames('oxyt', ADULT)), [], 'a male never sees the name');
  assert.equal(BorkeoMedicine.allowed(caffeine, { ageYears: 0, ageDays: 10, sex: 'male', wards: [] }), true, 'under 28 days');
  assert.equal(BorkeoMedicine.allowed(caffeine, { ageYears: 0, ageDays: 40, sex: 'male', wards: [] }), false, '40 days');
  assert.equal(BorkeoMedicine.allowed(caffeine, { ageYears: 1, ageDays: 400, sex: 'male', wards: ['ncu'] }), true, 'NCU');
  assert.equal(BorkeoMedicine.allowed(caffeine, CHILD5), false);
});

test('units: tablet, oral liquid, injection mg, micrograms, IU, cream; an old mg line still matches stock', () => {
  const { BorkeoMedicine, BorkeoMedicineUnits } = browser();
  const unit = label => BorkeoMedicine.optionUnit(line(label));
  assert.equal(unit('AA0411-Paracetamol-Tablet-500 mg'), 'គ្រាប់');
  assert.equal(unit('AA0413-Paracetamol-Oral liquid-125 mg/ 5mL [c]'), 'mL');
  assert.equal(unit('AB0341-Paracetamol-Injection IV-150 mg/mL in 2 -mL ampoule'), 'mg');
  assert.equal(BorkeoMedicine.optionUnit(catalogue.find(item => /micrograms/.test(item.strength) && item.route === 'INJ')), 'mcg');
  assert.equal(unit('AB0440-Oxytocin-Injection-10 IU in 1-mL in ampoule'), 'IU');
  assert.equal(BorkeoMedicine.optionUnit(catalogue.find(item => /cream/i.test(item.form))), 'g');
  assert.equal(BorkeoMedicineUnits.canonical('ម.ក្រ'), 'mg', 'an old line opens as mg');
  const db = openDatabase(':memory:');
  try {
    ensureStockSchema(db);
    addStockItem(db, 'medicine', { name: 'Synthetic diazepam injection', unit: 'ម.ក្រ', quantity: 50 }, 'pharmacist');
    syncMedicineStock(db, 'IPD:v425', [{ name: 'Synthetic diazepam injection', unit: 'mg', total: 10 }], 'doctor');
    assert.equal(listStock(db, 'medicine').find(item => item.name === 'Synthetic diazepam injection').balance, 40);
  } finally { db.sqlite.close(); }
});

test('routes: a new line offers IV, IM, SC and the simple routes; old values open unchanged as IV / IM', () => {
  const { BorkeoMedicationRoutes } = browser();
  const all = Array.from(BorkeoMedicationRoutes.definitions());
  const offered = all.filter(route => !route.legacy).map(route => route.khmer);
  assert.deepEqual(offered, ['ចាក់សរសៃ (IV)', 'ចាក់សាច់ដុំ (IM)', 'ចាក់ក្រោមស្បែក (SC)', 'លេប (PO)', 'លាប', 'បន្តក់', 'ស្រូប', 'តាមទ្វារមាស', 'តាមទ្វារធំ (PR)', 'ក្រោមអណ្តាត (SL)']);
  for (const old of ['iv_fluid', 'antibiotic_iv', 'antibiotic_im', 'injection_unspecified']) assert.ok(all.some(route => route.value === old && route.legacy), old);
  assert.equal(BorkeoMedicationRoutes.label('iv_fluid'), 'ចាក់សរសៃ (IV)');
  assert.equal(BorkeoMedicationRoutes.label('antibiotic_iv'), 'ចាក់សរសៃ (IV)');
  assert.equal(BorkeoMedicationRoutes.label('antibiotic_im'), 'ចាក់សាច់ដុំ (IM)');
  assert.equal(BorkeoMedicationRoutes.label('po'), 'លេប (PO)');
  assert.equal(BorkeoMedicationRoutes.label('other_iv', 'english'), 'Intravenous (IV)');
  // The select shows an old value only on the saved line that uses it; a new row starts blank.
  const populate = html.slice(html.indexOf('function populateMedicationRouteSelect'), html.indexOf('function medicationUnitValue'));
  assert.match(populate, /if \(definition\.legacy && definition\.value !== selected\) return;/);
  assert.match(populate, /blankRoute\.value = '';/);
  for (const prefix of ['orx', 'rx', 'mrx']) assert.match(html, new RegExp(`populateMedicationRouteSelect\\(tr\\.querySelector\\('\\.${prefix}-route'\\), ''\\);`));
  assert.equal((html.match(/populateMedicationRouteSelect\(route, med\.route \|\| 'po'\)/g) || []).length, 3, 'an old PO line opens as PO');
  assert.match(read('public/emr-inpatient-workflow.js'), /routes\.filter\(route => !route\.legacy \|\| route\.value === storedRoute\)/);
  assert.match(read('public/emr-inpatient-workflow.js'), /if \(storedRoute && !routes\.some/, 'a blank discharge route has no "check" option');
  for (const file of ['public/messages.js', 'public/pharmacy-opd.js']) assert.match(read(file), /window\.BorkeoMedicationRoutes\?\.definitions\(\)/, file);
  // Nursing chart order: old values keep 1 (IV fluid) and 2 (antibiotic); new IV lines from list group 25 and ATC J01 too.
  assert.match(html, /if \(item && route === 'other_iv' && \/\^25\\\.\/\.test\(item\.group \|\| ''\)\) return 1;/);
  assert.match(html, /if \(item && \/\^J01\/\.test\(item\.atc \|\| ''\)\) return 2;/);
});

test('a new row: dose, route and total blank; a medicine without a route cannot be saved; 3 rows', () => {
  assert.equal((html.match(/class="rx-num-input \$\{prefix\}-dose" value="" oninput/g) || []).length, 2);
  assert.match(html, /totalField\.value = total && isFinite\(total\) \? String\(Math\.round\(total \* 100\) \/ 100\) : '';/);
  assert.doesNotMatch(html, /rx-total-view" readonly value="0"/);
  assert.match(html, /var missing = Boolean\(name && normalizeNursingCellText\(name\.value\)\) && !normalizeNursingCellText\(route\.value\);/);
  assert.match(html, /for \(var i = 0; i < 3; i\+\+\) \{\n\s+addOpdRxRow\(true\);/);
  assert.match(html, /length < 3\) addRxRow\(true\);/);
  assert.doesNotMatch(read('public/medicine-autocomplete.js'), /-route|\.route\b|data-med="route"/, 'choosing a medicine never fills the route');
});

test('dose check: adult paracetamol, child by weight, no weight, draft lines', () => {
  const { BorkeoDoseCheck } = browser();
  const tablet500 = line('AA0411-Paracetamol-Tablet-500 mg');
  const tablet250 = line('AA0410-Paracetamol-Tablet-250 mg');
  const limit = approved('paracetamol|ORAL');
  const adult = BorkeoDoseCheck.evaluate(limit, tablet500, '4', 'គ្រាប់', 3, { child: false, weightKg: 70 });
  assert.deepEqual([adult.level, adult.perDose, adult.perDay, adult.maxPerDose], ['red', 2000, 6000, 1000], '4 x 500 mg TID: 2 g per dose, 6 g per day');
  assert.equal(BorkeoDoseCheck.evaluate(limit, tablet500, '2', 'គ្រាប់', 4, { child: false, weightKg: 70 }).level, 'ok', '2 x 500 mg QID');
  const child = BorkeoDoseCheck.evaluate(limit, tablet250, '1', 'គ្រាប់', 3, { child: true, weightKg: 10 });
  assert.deepEqual([child.level, child.perDose, child.maxPerDose], ['red', 250, 150], 'child 10 kg: 250 mg above 150 mg');
  assert.equal(BorkeoDoseCheck.evaluate(limit, tablet250, '1', 'គ្រាប់', 3, { child: true, weightKg: null }).level, 'weight', 'no weight: orange note');
  assert.equal(BorkeoDoseCheck.evaluate({ ...limit, status: 'draft' }, tablet500, '4', 'គ្រាប់', 3, { child: false }).level, 'none', 'draft line: no alert');
  assert.equal(BorkeoDoseCheck.evaluate({ ...limit, status: 'rejected' }, tablet500, '4', 'គ្រាប់', 3, { child: false }).level, 'none');
  // Conversions: mL x mg per mL; mg as typed; combinations by component; not convertible -> no alert.
  const syrup = line('AA0413-Paracetamol-Oral liquid-125 mg/ 5mL [c]');
  assert.equal(BorkeoDoseCheck.doseInLimitUnit(syrup, '10', 'mL', limit), 250);
  assert.equal(BorkeoDoseCheck.doseInLimitUnit(tablet500, '1', 'g', limit), 1000);
  const cotrim = line('AA0480-Sulfamethoxazole + trimethoprim-Tablet-400 mg + 80 mg') || catalogue.find(item => item.name === 'Sulfamethoxazole + trimethoprim' && item.strength === '400 mg + 80 mg');
  assert.equal(BorkeoDoseCheck.doseInLimitUnit(cotrim, '2', 'គ្រាប់', approved('sulfamethoxazole + trimethoprim|ORAL')), 160, 'trimethoprim component');
  assert.equal(BorkeoDoseCheck.evaluate(limit, tablet500, '1', 'ដប', 3, { child: false }).level, 'unconverted');
  assert.equal(BorkeoDoseCheck.evaluate(approved('halothane|INH'), line('AD0100-Halothane-Inhalation'), '1', 'mL', 1, {}).level, 'guide', 'protocol: guidance only');
  assert.equal(BorkeoDoseCheck.frequencyOf('qh', '6'), 4);
});

test('the dose check is wired to every prescription form and checked again on save', () => {
  const safety = read('public/medication-safety.js');
  assert.match(safety, /const PRESCRIBERS = \['DOCTOR', 'MIDWIFE'\];/);
  assert.match(safety, /rule\.doseKey && rule\.doseKey === item\.doseKey && rule\.status === 'approved'/, 'only approved lines');
  assert.match(safety, /'បញ្ចូលទម្ងន់ ដើម្បីពិនិត្យកម្រិតថ្នាំ'/);
  assert.match(safety, /nameInput\.dataset\.doseReason = reason;/, 'the reason stays with the line');
  assert.match(read('public/emr-patient-record.js'), /window\.EmrMedicationSafety\?\.validateDoses\('#opd_rx_tbody tr\.orx-main-row, #rx_tbody tr\.rx-main-row, #rx_protocol_tbody tr\.protocol-main-row'\)/);
  assert.match(html, /window\.EmrMedicationSafety\.validateDoses\('#mon_rx_tbody tr\.mrx-main-row, #mon_rx_protocol_tbody tr\.protocol-main-row'\)/);
  assert.match(read('public/emr-inpatient-workflow.js'), /window\.EmrMedicationSafety\?\.validateDoses\('#emr-discharge-rx-body tr'\)/);
  for (const pattern of [/if \(doseReason\) order\.doseOverrideReason = doseReason;/, /if \(doseReason\) medication\.doseOverrideReason = doseReason;/]) assert.match(html, pattern);
  assert.match(read('public/emr-inpatient-workflow.js'), /if \(doseReason\) med\.doseOverrideReason = doseReason;/);
  assert.doesNotMatch(read('public/medicine-dose-check.js') + read('public/medicine-autocomplete.js'), /<style|createElement\('style'\)/, 'no inline style tag');
});

test('dose table storage: drafts loaded once; an edited, approved or rejected line is never overwritten', () => {
  const db = openDatabase(':memory:');
  try {
    ensureMedicationSafetySchema(db);
    let rows = drugSafetyTables(db).maxDoses;
    assert.equal(rows.length, 395);
    assert.ok(rows.every(row => row.status === 'draft'));
    const paracetamol = rows.find(row => row.doseKey === 'paracetamol|ORAL');
    const admin = { user_id: 'a', display_name: 'Synthetic Admin' };
    const edited = updateMaxDose(db, admin, paracetamol.id, { adult: { maxPerDose: 1000, maxPerDay: 3000 }, child: { maxPerDosePerKg: 15, maxPerDayPerKg: 60, maxPerDose: 1000, maxPerDay: 4000 }, unit: 'mg', note: 'Synthetic note' });
    assert.deepEqual([edited.status, edited.adult.maxPerDay, edited.adult.maxPerDosePerKg], ['draft', 3000, null]);
    const ok = reviewMaxDose(db, { user_id: 'p', display_name: 'Synthetic Pharmacist' }, paracetamol.id, 'approve');
    assert.deepEqual([ok.status, ok.approvedBy], ['approved', 'Synthetic Pharmacist']);
    assert.ok(ok.approvedAt > 0);
    const halothane = rows.find(row => row.doseKey === 'halothane|INH');
    assert.equal(reviewMaxDose(db, { user_id: 'd', display_name: 'Synthetic Director' }, halothane.id, 'reject').status, 'rejected');
    assert.equal(seedDoseLimits(db), 0, 'loading the draft again adds nothing');
    ensureMedicationSafetySchema(db);
    rows = drugSafetyTables(db).maxDoses;
    assert.equal(rows.length, 395);
    const again = rows.find(row => row.doseKey === 'paracetamol|ORAL');
    assert.deepEqual([again.status, again.adult.maxPerDay, again.note], ['approved', 3000, 'Synthetic note']);
    assert.equal(rows.find(row => row.doseKey === 'halothane|INH').status, 'rejected');
    // A line of the list is rejected, not deleted.
    const removed = db.sqlite.prepare('DELETE FROM drug_max_doses WHERE id=? AND dose_key IS NULL').run(again.id).changes;
    assert.equal(removed, 0);
  } finally { db.sqlite.close(); }
});

test('server: catalogue needs a login; files served; approve by pharmacy and director; overrides need a reason; lines saved', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const login = async username => {
    const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: app.config.appOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    assert.equal(response.status, 200, username);
    const Cookie = response.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
    return { Cookie, Origin: app.config.appOrigin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
  };
  const post = (headers, url, body) => fetch(origin + url, { method: 'POST', headers, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(origin + '/api/medicines/catalogue')).status, 401, 'login needed');
    const doctor = await login('doctor_medicine');
    const body = await (await fetch(origin + '/api/medicines/catalogue?v=42.5.0', { headers: doctor })).json();
    assert.equal(body.items.length, 704);
    for (const file of ['medicine-autocomplete.js', 'medicine-autocomplete.css', 'medicine-dose-check.js', 'medication-routes.js', 'medicine-units.js']) {
      assert.equal((await fetch(`${origin}/public/${file}`)).status, 200, file);
    }
    const page = await (await fetch(origin + '/emr?view=medical', { headers: doctor })).text();
    for (const file of ['medicine-autocomplete.js', 'medicine-dose-check.js', 'medication-routes.js']) assert.match(page, new RegExp(`/public/${file.replace('.', '\\.')}`));

    // Approval: only the Head of Pharmacy or the Director; the administrator edits.
    const tables = await (await fetch(origin + '/api/drug-safety', { headers: doctor })).json();
    const line = tables.maxDoses.find(row => row.doseKey === 'paracetamol|ORAL');
    assert.equal(line.status, 'draft');
    assert.equal((await post(doctor, `/api/drug-safety/max-doses/${line.id}/approve`, {})).status, 403);
    const admin = await login('admin');
    assert.equal((await post(admin, `/api/drug-safety/max-doses/${line.id}/approve`, {})).status, 403, 'the administrator edits, does not approve');
    const pharmacy = await login('pharmacy');
    const afterApprove = await (await post(pharmacy, `/api/drug-safety/max-doses/${line.id}/approve`, {})).json();
    assert.equal(afterApprove.maxDoses.find(row => row.id === line.id).status, 'approved');
    assert.equal(afterApprove.canApprove, true);
    const director = await login('director');
    assert.equal((await post(director, `/api/drug-safety/max-doses/${line.id}/reject`, {})).status, 200);
    assert.equal((await post(pharmacy, `/api/drug-safety/max-doses/${line.id}/approve`, {})).status, 200);
    const pagePharmacy = await fetch(origin + '/admin/drug-safety', { headers: { Cookie: pharmacy.Cookie }, redirect: 'manual' });
    assert.equal(pagePharmacy.status, 200, 'the Head of Pharmacy opens the page');
    assert.equal((await post(doctor, '/api/drug-safety/unconverted', { doseKey: 'paracetamol|ORAL', label: 'Synthetic', unit: 'ដប' })).status, 201);

    // A red alert: continuing without a reason is refused; with a reason it is saved and audited.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(new Date());
    const tablet = { rowType: 'regularRow', name: 'AA0411-Paracetamol-Tablet-500 mg', route: 'po', unit: 'គ្រាប់', m: '4', a: '4', e: '4', n: '0', d: '3', total: '36', note: '', doseAmount: '4', scheduleType: 'tid', cmsCode: 'AA0411', doseOverrideReason: 'Synthetic evidence' };
    const oldLine = { rowType: 'regularRow', name: 'Paracetamol 500 mg', route: 'po', unit: 'ម.ក្រ', m: '1', a: '0', e: '1', n: '0', d: '5', total: '10', note: '', doseAmount: '1', scheduleType: 'bid' };
    const freeText = { ...oldLine, name: 'Synthetic medicine not in the list', unit: 'គ្រាប់' };
    const saved = await fetch(origin + '/api/patient-record', { method: 'PUT', headers: doctor, body: JSON.stringify({
      patientKey: 'case:V425-1', editorScope: 'medical',
      summary: { caseNumber: 'V425-1', healthId: '', firstName: 'Synthetic', lastName: 'Dose', fullName: 'Synthetic Dose', sex: 'ប្រុស', age: '40', departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: today },
      data: { 'scope:medical:id:ipd_first_exam_date': today, 'system:initialIpdMedications': JSON.stringify([tablet, oldLine, freeText]) },
    }) });
    assert.equal(saved.status, 200, await saved.clone().text());
    const stored = JSON.parse(JSON.parse(app.database.findPatient('case:V425-1').record_json)['system:initialIpdMedications']);
    assert.deepEqual(stored, [tablet, oldLine, freeText], 'cmsCode and reason kept; old line and free text unchanged');
    const override = { patientKey: 'case:V425-1', medicine: tablet.name, warnings: [{ kind: 'max-dose', detail: 'Per dose: 2000 mg (maximum 1000 mg)' }] };
    assert.equal((await post(doctor, '/api/prescribing-overrides', { ...override, reason: '' })).status, 400, 'no reason: refused');
    assert.equal((await post(doctor, '/api/prescribing-overrides', { ...override, reason: 'Synthetic evidence' })).status, 201);
    const audited = app.database.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='PRESCRIBING_WARNING_OVERRIDDEN'").get().n;
    assert.equal(audited, 1);
    const actions = new Set(app.database.sqlite.prepare('SELECT action FROM audit_events').all().map(row => row.action));
    for (const action of ['DRUG_MAX_DOSE_APPROVED', 'DRUG_MAX_DOSE_REJECTED']) assert.ok(actions.has(action), action);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
