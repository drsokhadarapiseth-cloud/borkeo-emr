import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { validateAddressHierarchy, getProvinces, getProvinceDetail } from '../server/gazetteer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('Cambodia administrative address hierarchy dataset and EMR integration', async () => {
  // 1. Verify dataset structure and server/gazetteer.mjs
  const provinces = getProvinces();
  assert.ok(Array.isArray(provinces), 'provinces should be an array');
  assert.equal(provinces.length, 25, 'Cambodia has exactly 25 provinces/capital');

  const ratanakKiri = provinces.find(p => p.code === '16');
  assert.ok(ratanakKiri, 'Ratanak Kiri (code 16) must exist');
  assert.equal(ratanakKiri.nameKh, 'ខេត្តរតនគិរី');

  const rkDistricts = getProvinceDetail('16');
  assert.ok(Array.isArray(rkDistricts) && rkDistricts.length > 0, 'Ratanak Kiri must have districts');

  // Find Bar Kaev / Borkeo district (code 1603)
  const borkeo = rkDistricts.find(d => d.code === '1603');
  assert.ok(borkeo, 'Borkeo district (code 1603) must exist');
  assert.ok(borkeo.communes.length > 0, 'Borkeo district must have communes');

  const firstCommune = borkeo.communes[0];
  assert.ok(firstCommune.code, 'commune must have code');
  assert.ok(firstCommune.villages.length > 0, 'commune must have villages');
  const firstVillage = firstCommune.villages[0];

  // Validate hierarchy validation helper
  const validCheck = validateAddressHierarchy({
    provinceCode: '16',
    districtCode: borkeo.code,
    communeCode: firstCommune.code,
    villageCode: firstVillage.code
  });
  assert.equal(validCheck.valid, true, 'Valid hierarchy must pass');

  const invalidCheck = validateAddressHierarchy({
    provinceCode: '16',
    districtCode: '1201', // Phnom Penh district
    communeCode: firstCommune.code,
    villageCode: firstVillage.code
  });
  assert.equal(invalidCheck.valid, false, 'Mismatched hierarchy must fail');

  // 2. Start disposable test server
  const testDbPath = path.join(projectRoot, 'data', `test-addr-${Date.now()}.sqlite`);
  const env = {
    ...process.env,
    PORT: '3196',
    EMR_MODE: 'demo',
    DATABASE_PATH: testDbPath,
    SESSION_SECRET: 'test-secret-address',
  };

  const serverProc = spawn('node', ['server/server.mjs'], {
    cwd: projectRoot,
    env,
    stdio: 'inherit'
  });

  const stopServer = () => {
    try { serverProc.kill(); } catch (_) {}
    try { if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); } catch (_) {}
  };

  try {
    // Wait for server to start
    let up = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:3196/health');
        if (res.ok) { up = true; break; }
      } catch (_) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    assert.ok(up, 'Server must start within 6 seconds');

    // Verify static gazetteer serving
    const gzRes = await fetch('http://127.0.0.1:3196/data/gazetteer/provinces.json');
    assert.equal(gzRes.status, 200, 'Gazetteer provinces.json must be accessible');
    const gzProvinces = await gzRes.json();
    assert.equal(gzProvinces.length, 25);

    const rkRes = await fetch('http://127.0.0.1:3196/data/gazetteer/provinces/ratanak_kiri.json');
    assert.equal(rkRes.status, 200, 'Ratanak Kiri province details must be accessible');

    // Login as registration
    const loginRes = await fetch('http://127.0.0.1:3196/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'registration', password: 'password' })
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie, 'Cookie returned on login');

    const meRes = await fetch('http://127.0.0.1:3196/api/auth/me', {
      headers: { 'Cookie': cookie }
    });
    const meData = await meRes.json();
    const csrf = meData.csrfToken;
    assert.ok(csrf, 'CSRF token returned');

    // Create a new patient with full Cambodian administrative address
    const patientKey = `case:TEST-ADDR-${Date.now()}`;
    const payload = {
      patientKey,
      editorScope: 'registration',
      summary: {
        caseNumber: `TEST-ADDR-${Date.now()}`,
        healthId: `H-ADDR-${Date.now()}`,
        firstName: 'សប្បាយ',
        lastName: 'សុខ',
        fullName: 'សុខ សប្បាយ',
        sex: 'ប្រុស',
        age: '28',
        phone: '012345678',
        ward: 'opd',
        departmentCode: 'opd',
        serviceMode: 'opd',
        entryDate: '2026-10-10'
      },
      data: {
        'scope:registration:id:emr_pmrs_case_new': true,
        'scope:registration:id:web_first_name': 'សុខ',
        'scope:registration:id:web_last_name': 'សប្បាយ',
        'scope:registration:id:web_sex': 'ប្រុស',
        'scope:registration:id:web_phone': '012345678',
        'scope:registration:id:web_province': ratanakKiri.nameKh,
        'scope:registration:id:web_province_code': ratanakKiri.code,
        'scope:registration:id:web_district': borkeo.nameKh,
        'scope:registration:id:web_district_code': borkeo.code,
        'scope:registration:id:web_commune': firstCommune.nameKh,
        'scope:registration:id:web_commune_code': firstCommune.code,
        'scope:registration:id:web_village': firstVillage.nameKh,
        'scope:registration:id:web_village_code': firstVillage.code,
        'scope:registration:id:web_street_address': 'ផ្ទះលេខ ១២ ផ្លូវលំ'
      }
    };

    const saveRes = await fetch('http://127.0.0.1:3196/api/patient-record', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'Origin': 'http://127.0.0.1:3196',
        'X-CSRF-Token': csrf
      },
      body: JSON.stringify(payload)
    });
    const saveText = await saveRes.clone().text();
    assert.equal(saveRes.status, 200, `Patient registration must succeed: ${saveText}`);
    assert.equal(saveRes.status, 200, 'Patient registration must succeed');
    const saveResult = await saveRes.json();
    assert.ok(saveResult.patient, 'Result contains patient object');

    // Verify patient summary address fields
    const p = saveResult.patient;
    assert.equal(p.province, ratanakKiri.nameKh);
    assert.equal(p.provinceCode, ratanakKiri.code);
    assert.equal(p.district, borkeo.nameKh);
    assert.equal(p.districtCode, borkeo.code);
    assert.equal(p.commune, firstCommune.nameKh);
    assert.equal(p.communeCode, firstCommune.code);
    assert.equal(p.village, firstVillage.nameKh);
    assert.equal(p.villageCode, firstVillage.code);
    assert.equal(p.streetAddress, 'ផ្ទះលេខ ១២ ផ្លូវលំ');
    assert.ok(p.address.includes(firstVillage.nameKh), 'Address string includes village');
    assert.ok(p.address.includes(ratanakKiri.nameKh), 'Address string includes province');

    // Verify GET /api/patient-record retrieves the full address details in data
    const getRes = await fetch(`http://127.0.0.1:3196/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`, {
      headers: { 'Cookie': cookie }
    });
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.patient.data['scope:registration:id:web_province_code'], ratanakKiri.code);
    assert.equal(getData.patient.data['scope:registration:id:web_commune_code'], firstCommune.code);
    assert.equal(getData.patient.data['scope:registration:id:web_village_code'], firstVillage.code);
    assert.equal(getData.patient.data['scope:registration:id:web_street_address'], 'ផ្ទះលេខ ១២ ផ្លូវលំ');
  } finally {
    try {
      const { openDatabase } = await import('../server/database.mjs');
      const db = openDatabase(path.join(projectRoot, 'data', 'demo.sqlite'));
      db.sqlite.prepare('DELETE FROM patient_records WHERE patient_key = ?').run(patientKey);
      db.close();
    } catch (_) {}
    stopServer();
  }
});
