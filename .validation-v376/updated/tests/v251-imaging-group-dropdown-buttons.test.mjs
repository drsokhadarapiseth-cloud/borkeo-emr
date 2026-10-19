import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';

test('v25.1 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^25\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v25\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v25\./);
});

test('v25.1 imaging.html contains imaging-groups-bar and action buttons', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  assert.ok(html.includes('id="imaging-groups-bar"'), 'Contains imaging-groups-bar');
  assert.ok(html.includes('id="imaging-films-tab"'), 'Contains Films & Materials tab');
  assert.ok(html.includes('id="imaging-search"'), 'Contains search input');
  assert.ok(html.includes('id="imaging-refresh"'), 'Contains refresh button');
});

test('v25.1 imaging.js implements group dropdown buttons with sub-lists', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/imaging.js'), 'utf8');
  assert.ok(js.includes('renderGroupsBar'), 'Defines renderGroupsBar');
  assert.ok(js.includes('closeAllGroupDropdowns'), 'Defines closeAllGroupDropdowns');
  assert.ok(js.includes('group-dropdown'), 'Renders group-dropdown wrapper');
  assert.ok(js.includes('group-dropdown-btn'), 'Renders group-dropdown-btn');
  assert.ok(js.includes('group-dropdown-menu'), 'Renders group-dropdown-menu');
  assert.ok(js.includes('group-menu-item'), 'Renders group-menu-item');
  assert.ok(js.includes('group-btn-all'), 'Renders group-btn-all for All Modalities');
  assert.ok(js.includes('data-group-toggle'), 'Implements data-group-toggle attribute');
});

test('v25.1 imaging.css defines styles for group dropdown buttons and menus', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/imaging.css'), 'utf8');
  assert.ok(css.includes('.imaging-groups-bar'), 'Includes .imaging-groups-bar');
  assert.ok(css.includes('.group-dropdown'), 'Includes .group-dropdown');
  assert.ok(css.includes('.group-dropdown-btn'), 'Includes .group-dropdown-btn');
  assert.ok(css.includes('.group-dropdown-menu'), 'Includes .group-dropdown-menu');
  assert.ok(css.includes('.group-menu-item'), 'Includes .group-menu-item');
  assert.ok(css.includes('.group-btn-all'), 'Includes .group-btn-all');
});

test('v25.1 end-to-end multi-specialty order generation and result workflow', async () => {
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
    const patientKey = 'case:SPECIALTY-TEST-001';
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
          caseNumber: 'SPECIALTY-TEST-001',
          fullName: 'Sokha Meng',
          sex: 'ស្រី',
          age: '45',
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

    // 1. Order Bronchoscopy (Pulmonology)
    const bronchoOrderRes = await fetch(`${origin}/api/paraclinic/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': doc.csrf,
        Cookie: doc.cookie
      },
      body: JSON.stringify({
        patientKey,
        modality: 'BRONCHOSCOPY',
        requesterName: 'Dr. Medicine',
        request: { examination: 'Diagnostic Bronchoscopy', clinicalIndication: 'Chronic Hemoptysis' }
      })
    });
    assert.equal(bronchoOrderRes.status, 201);
    const bronchoOrder = await bronchoOrderRes.json();

    // 2. Complete and Release Bronchoscopy
    const bronchoResultRes = await fetch(`${origin}/api/paraclinic/orders/${bronchoOrder.order.id}/result`, {
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
          vocalCords: 'Normal mobility, bilateral',
          carina: 'Sharp and mobile',
          bronchialTree: 'No endobronchial mass or active bleeding',
          conclusion: 'Normal flexible bronchoscopy'
        }
      })
    });
    assert.equal(bronchoResultRes.status, 200);
    const bronchoReleased = await bronchoResultRes.json();
    assert.equal(bronchoReleased.order.status, 'RESULT_AVAILABLE');
    assert.equal(bronchoReleased.order.result.conclusion, 'Normal flexible bronchoscopy');
  } finally {
    await new Promise(r => app.server.close(r));
    app.server.closeAllConnections?.();
  }
});
