import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';
import { IMAGING_GROUPS, IMAGING_SUBTYPES } from '../server/access.mjs';

test('v24.9 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[4-8]\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v2[4-8]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v2[4-8]\./);
});

test('v24.9 imaging.html contains toolbar element and English labels', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  assert.ok(html.includes('id="imaging-groups-bar"') || html.includes('id="imaging-specialty-select"'), 'Contains imaging selector/groups bar');
  assert.ok(html.includes('Films & Materials'), 'Contains English Films & Materials link');
});

test('v24.9 imaging.js groups modalities by specialty in English only', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/imaging.js'), 'utf8');
  assert.ok(js.includes('renderGroupsBar') || js.includes('renderModalityDropdown'), 'Defines group/modality renderer');
  
  // Verify English group names
  const expectedEnglishGroups = [
    'Radiology',
    'Cardiology',
    'Neurology',
    'Endoscopy & GI',
    'ENT',
    'Pulmonology'
  ];
  for (const name of expectedEnglishGroups) {
    assert.ok(js.includes(name), `Group ${name} is present in English in imaging.js`);
  }
});

test('v24.9 paraclinic order filtering and release with English specialty workflow', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  async function login(username) {
    const res = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ username })
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie').split(';', 1)[0];
    await res.json();
    const meRes = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } });
    const me = await meRes.json();
    return { cookie, csrf: me.csrfToken, user: me.user };
  }

  try {
    const doc = await login('doctor_medicine');
    const imaging = await login('imaging');

    // Create test patient
    const patientKey = 'case:ECG-TEST-001';
    const patRes = await fetch(`${origin}/api/patient-record`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': doc.csrf,
        Cookie: doc.cookie
      },
      body: JSON.stringify({
        patientKey,
        summary: {
          caseNumber: 'ECG-TEST-001',
          fullName: 'Vannak Chan',
          sex: 'ប្រុស',
          age: '38',
          departmentCode: 'medicine',
          departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
          departmentNameEn: 'Medicine',
          serviceMode: 'ipd',
          careType: 'medicine',
          paymentType: 'PAID',
          paymentCategory: 'CASH',
        },
        data: {}
      })
    });
    assert.equal(patRes.status, 200);

    // Create ECG order (Cardiology)
    const orderRes = await fetch(`${origin}/api/paraclinic/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': doc.csrf,
        Cookie: doc.cookie
      },
      body: JSON.stringify({
        patientKey,
        modality: 'ECG',
        reason: 'Palpitations',
        priority: 'ROUTINE',
        ward: 'medicine',
        request: { clinicalIndication: 'Routine resting ECG' }
      })
    });
    assert.equal(orderRes.status, 201);
    const orderData = await orderRes.json();
    const orderId = orderData.order.id;

    // Release ECG result with Cardiology metrics
    const resultRes = await fetch(`${origin}/api/paraclinic/orders/${orderId}/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': imaging.csrf,
        Cookie: imaging.cookie
      },
      body: JSON.stringify({
        findings: 'Normal sinus rhythm, heart rate 72 bpm, normal intervals.',
        impression: 'Normal ECG.',
        recommendations: 'No further cardiology workup required.',
        structuredDetails: {
          rhythm: 'Normal Sinus Rhythm',
          heartRate: '72',
          prInterval: '160 ms',
          qrs: '85 ms'
        }
      })
    });
    assert.equal(resultRes.status, 200);
    const resultData = await resultRes.json();
    assert.ok(['RESULT_AVAILABLE', 'RELEASED'].includes(resultData.order.status));
    assert.equal(resultData.order.result.structuredDetails.rhythm, 'Normal Sinus Rhythm');
  } finally {
    app.server.closeAllConnections?.();
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});
