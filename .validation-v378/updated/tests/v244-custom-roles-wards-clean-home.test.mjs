import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';

test('v24.4 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^24\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v24\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v24\./);
});

test('v24.4 home.html and home.js remove stray nav buttons and remove icons from reports', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/home.html'), 'utf8');
  assert.ok(!html.includes('href="/ipd-transfer"'), 'stray IPD Transfer link removed');
  assert.ok(!html.includes('href="/requests"'), 'stray Requests link removed');
  assert.ok(!html.includes('href="/queue-display"'), 'stray queue display link removed');

  const js = fs.readFileSync(path.join(process.cwd(), 'public/home.js'), 'utf8');
  assert.ok(!js.includes('🏥'), 'medical icon removed');
  assert.ok(!js.includes('🚑'), 'ambulance icon removed');
  assert.ok(!js.includes('👨'), 'demographic icon removed');
});

test('v24.4 user management supports adding custom roles and custom services/wards via API and assigning to users', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  try {
    // Login as admin
    const loginRes = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie');
    const meRes = await (await fetch(`${origin}/api/auth/me`, { headers: { cookie } })).json();
    const csrf = meRes.csrfToken;

    // Add Custom Role: PHYSIOTHERAPIST
    const roleRes = await fetch(`${origin}/api/admin/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, cookie, origin },
      body: JSON.stringify({ code: 'PHYSIOTHERAPIST', labelKh: 'អ្នកព្យាបាលចលនា', labelEn: 'Physiotherapist' })
    });
    assert.equal(roleRes.status, 201);
    const roleData = await roleRes.json();
    assert.ok(roleData.roles.includes('PHYSIOTHERAPIST'));
    assert.equal(roleData.roleLabels['PHYSIOTHERAPIST'], 'អ្នកព្យាបាលចលនា');

    // Add Custom Ward: Cardiology
    const wardRes = await fetch(`${origin}/api/admin/wards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, cookie, origin },
      body: JSON.stringify({ code: 'cardiology', nameKh: 'ផ្នែកជំងឺបេះដូង', nameEn: 'Cardiology' })
    });
    assert.equal(wardRes.status, 201);
    const wardData = await wardRes.json();
    assert.ok(wardData.wards.some(w => w.code === 'cardiology' && w.nameKh === 'ផ្នែកជំងឺបេះដូង'));

    // Create a new user with the custom role and custom ward
    const createRes = await fetch(`${origin}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, cookie, origin },
      body: JSON.stringify({
        displayName: 'សាន ចាន់ថា',
        username: 'physio_chantha',
        roles: ['PHYSIOTHERAPIST'],
        wards: ['cardiology']
      })
    });
    assert.equal(createRes.status, 201);
    const createdUser = (await createRes.json()).user;
    assert.equal(createdUser.username, 'physio_chantha');
    assert.deepEqual(createdUser.roles, ['PHYSIOTHERAPIST']);
    assert.deepEqual(createdUser.wards, ['cardiology']);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});
