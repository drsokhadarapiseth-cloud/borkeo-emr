import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';
import { openDatabase } from '../server/database.mjs';
import { ensureFacilitySchema, getFacility, saveFacility } from '../server/health-facility.mjs';

const rootDir = process.cwd();

test('v35.5 version consistency in package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(['35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0', '36.7.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v3[56]\.[0-9]/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v3[56]\.[0-9]/);
});

test('v35.5 Triage dropdown p2_other_dept separates Gynecology from Maternity and has all 13 confirmed HEF codes', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  // Verify p2_other_dept options
  assert.match(emrHtml, /<select id="p2_other_dept"/);
  assert.match(emrHtml, /<option value="emergency" data-key="opt_er" data-hef-code="RH-EMG">/);
  assert.match(emrHtml, /<option value="medicine" data-key="opt_gen" data-hef-code="RH-IPDGen">/);
  assert.match(emrHtml, /<option value="surgery" data-key="opt_surg" data-hef-code="RH-IPDSurg">/);
  assert.match(emrHtml, /<option value="gynecology" data-key="opt_gyn" data-hef-code="RH-IPDGen">ផ្នែករោគស្ត្រី<\/option>/);
  assert.match(emrHtml, /<option value="maternity" data-key="opt_maternity" data-hef-code="RH-Del">ផ្នែកសម្ភព<\/option>/);
  assert.match(emrHtml, /<option value="pediatric" data-key="opt_ped2" data-hef-code="RH-IPDGen">/);
  assert.match(emrHtml, /<option value="tb" data-key="opt_tb" data-hef-code="RH-TB1">/);
  assert.match(emrHtml, /<option value="anc" data-key="opt_anc" data-hef-code="RH-OPDSpec">ពិនិត្យផ្ទៃពោះ \(ANC\)<\/option>/);
  assert.match(emrHtml, /<option value="pnc" data-key="opt_pnc" data-hef-code="RH-OPDSpec">ថែទាំក្រោយសម្រាល \(PNC\)<\/option>/);
  assert.match(emrHtml, /<option value="spacing" data-key="opt_family_planning" data-hef-code="RH-LARFP">ពន្យាកំណើត<\/option>/);
  assert.match(emrHtml, /<option value="safe" data-key="opt_safe_abortion" data-hef-code="RH-Del">រំលូតកូនដោយសុវត្ថិភាព<\/option>/);
  assert.match(emrHtml, /<option value="cervix" data-key="opt_cervix_screening" data-hef-code="RH-Gyn1">ពិនិត្យមហារីកមាត់ស្បូន<\/option>/);
  assert.match(emrHtml, /<option value="std" data-key="opt_std" data-hef-code="RH-STI">ជំងឺកាមរោគ \(STD\)<\/option>/);

  // Verify translations
  assert.match(emrHtml, /opt_gyn:\s*"ផ្នែករោគស្ត្រី"/);
  assert.match(emrHtml, /opt_maternity:\s*"ផ្នែកសម្ភព"/);
  assert.match(emrHtml, /opt_gyn:\s*"Gynecology"/);
  assert.match(emrHtml, /opt_maternity:\s*"Maternity"/);
});

test('v35.5 client definitions in public/emr-patient-record.js include separate maternity and hefCodes', () => {
  const js = fs.readFileSync(path.join(rootDir, 'public/emr-patient-record.js'), 'utf8');

  assert.match(js, /gynecology:\s*\{\s*code:\s*'gynecology',\s*kh:\s*'ផ្នែករោគស្ត្រី',\s*en:\s*'Gynecology',\s*mode:\s*'ipd',\s*hefCode:\s*'RH-IPDGen'\s*\}/);
  assert.match(js, /maternity:\s*\{\s*code:\s*'obstetric',\s*kh:\s*'ផ្នែកសម្ភព',\s*en:\s*'Maternity',\s*mode:\s*'ipd',\s*hefCode:\s*'RH-Del'\s*\}/);
  assert.match(js, /anc:\s*\{[^}]*hefCode:\s*'RH-OPDSpec'/);
  assert.match(js, /pnc:\s*\{[^}]*hefCode:\s*'RH-OPDSpec'/);
  assert.match(js, /spacing:\s*\{[^}]*hefCode:\s*'RH-LARFP'/);
  assert.match(js, /safe:\s*\{[^}]*hefCode:\s*'RH-Del'/);
  assert.match(js, /cervix:\s*\{[^}]*hefCode:\s*'RH-Gyn1'/);
  assert.match(js, /std:\s*\{[^}]*hefCode:\s*'RH-STI'/);

  // PMRS service code resolution
  assert.match(js, /p2_other_dept/);
  assert.match(js, /dataset\.hefCode/);
});

test('v35.5 Patient Registration Coverage Area (តំបន់ទទួលខុសត្រូវ) UI elements and logic', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  assert.match(emrHtml, /id="coverage_area_group"/);
  assert.match(emrHtml, /តំបន់ទទួលខុសត្រូវ/);
  assert.match(emrHtml, /id="web_coverage_in_od"[^>]*value="in_od"/);
  assert.match(emrHtml, /id="web_coverage_out_od"[^>]*value="out_od"/);
  assert.match(emrHtml, /id="web_coverage_area"[^>]*name="scope:registration:id:web_coverage_area"/);
  assert.match(emrHtml, /ក្នុងស្រុកប្រតិបត្តិ/);
  assert.match(emrHtml, /ក្រៅស្រុកប្រតិបត្តិ/);

  // Check helper functions
  assert.match(emrHtml, /window\.DEFAULT_OD_DISTRICT_CODES\s*=\s*\['1601',\s*'1603',\s*'1607'\]/);
  assert.match(emrHtml, /isDistrictInOD/);
  assert.match(emrHtml, /updateCoverageAreaFromDistrict/);
  assert.match(emrHtml, /setCoverageAreaManual/);
});

test('v35.5 Operational District default configuration and server endpoint /api/operational-district', async () => {
  const defaults = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/health-facility/hospital-defaults.json'), 'utf8'));
  assert.equal(defaults.operationalDistrict.province, '16');
  assert.deepEqual(defaults.operationalDistrict.districts, ['1601', '1603', '1607']);

  const app = createEmrServer({
    databasePath: ':memory:',
    host: '127.0.0.1',
    port: 33596,
    appOrigin: 'http://127.0.0.1:33596',
  });
  await new Promise(r => app.server.listen(33596, '127.0.0.1', r));
  const base = 'http://127.0.0.1:33596';

  try {
    // Unauthenticated GET returns 401
    const unauth = await fetch(base + '/api/operational-district');
    assert.equal(unauth.status, 401);

    // Login as registration clerk
    const loginRes = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ username: 'registration' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.getSetCookie().map(s => s.split(';')[0]).join('; ');

    // Authenticated GET returns operational district config
    const res = await fetch(base + '/api/operational-district', {
      headers: { Cookie: cookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.province, '16');
    assert.deepEqual(data.districts, ['1601', '1603', '1607']);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('v35.5 Admin can update operational district in health facility schema', () => {
  const db = openDatabase(':memory:');
  ensureFacilitySchema(db);
  try {
    const initial = getFacility(db);
    assert.deepEqual(initial.data.operationalDistrict.districts, ['1601', '1603', '1607']);

    // Admin updates operational district
    const updated = saveFacility(db, {
      section: 'operationalDistrict',
      revision: initial.revision,
      value: { province: '16', districts: ['1601', '1603', '1605', '1607'] },
    }, null);

    assert.equal(updated.data.operationalDistrict.province, '16');
    assert.deepEqual(updated.data.operationalDistrict.districts, ['1601', '1603', '1605', '1607']);

    // Reload from database
    const reloaded = getFacility(db);
    assert.deepEqual(reloaded.data.operationalDistrict.districts, ['1601', '1603', '1605', '1607']);
  } finally {
    db.close();
  }
});
