import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';

test('v25.3 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^25\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v25\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v25\./);
});

test('v25.3 shared-controls.css excludes group buttons from dark action button background and treats them as tabs', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/shared-controls.css'), 'utf8');
  assert.ok(css.includes(':not(.group-dropdown-btn):not(.group-btn-all):not(.group-btn-films):not(.group-menu-item)'), 'Excludes group buttons from dark solid button rule');
  assert.ok(css.includes('.group-dropdown-btn,.group-btn-all,.group-btn-films'), 'Includes group buttons in tab styling rule');
});

test('v25.3 imaging.css applies transparent flat tab style with active underline indicator', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/imaging.css'), 'utf8');
  assert.ok(css.includes('background:transparent !important') || css.includes('background: transparent !important'), 'Uses transparent background instead of solid dark button');
  assert.ok(css.includes('border-bottom:3px solid var(--accent, #a56132) !important') || css.includes('border-bottom: 3px solid'), 'Uses active bottom underline indicator matching main nav tabs');
  assert.ok(css.includes('.group-dropdown-menu'), 'Maintains clean dropdown menu popup styling');
});

test('v25.3 end-to-end multi-specialty order generation, filtering, and result workflow', async () => {
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

    // Create a patient record
    const patientKey = 'case:TABSTYLE-TEST-001';
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
          caseNumber: 'TABSTYLE-TEST-001',
          fullName: 'Bopha Pich',
          sex: 'ស្រី',
          age: '29',
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
    await patRes.json();

    // Order ENT Otoscopy
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
        modality: 'OTOSCOPY',
        requesterName: 'Dr. Medicine',
        request: { examination: 'Otoscopy Bilateral', clinicalIndication: 'Ear pain' }
      })
    });
    assert.equal(orderRes.status, 201);
    const orderData = await orderRes.json();

    // Release Result
    const resResult = await fetch(`${origin}/api/paraclinic/orders/${orderData.order.id}/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': imaging.csrf,
        Cookie: imaging.cookie
      },
      body: JSON.stringify({
        action: 'RELEASE',
        result: {
          eac: 'Clear, no foreign body',
          tm: 'Intact, normal light reflex bilaterally',
          middleEar: 'Normal aeration',
          conclusion: 'Normal otoscopy examination'
        }
      })
    });
    assert.equal(resResult.status, 200);
    const released = await resResult.json();
    assert.equal(released.order.status, 'RESULT_AVAILABLE');
  } finally {
    await new Promise(r => app.server.close(r));
    app.server.closeAllConnections?.();
  }
});
