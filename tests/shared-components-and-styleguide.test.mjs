import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

let app;
let tempDir;
let baseUrl;

async function createUser(username, displayName, role) {
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('111111111111');
  app.database.createUser({
    id: userId,
    username,
    displayName,
    role,
    passwordHash,
    createdAt: Date.now(),
  });
  setUserAccess(app.database, userId, [role], []);
  return userId;
}

async function loginUser(username, password = '111111111111') {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
    },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `Login for ${username} must succeed`);
  const setCookie = res.headers.get('set-cookie');
  const cookie = setCookie.split(';')[0];
  return cookie;
}

test.before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-styleguide-test-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33894,
    appOrigin: 'http://127.0.0.1:33894',
    databasePath: dbPath,
    dataDirectory: tempDir,
    nodeEnv: 'test',
  });

  baseUrl = 'http://127.0.0.1:33894';

  await createUser('admin_test', 'System Admin', 'ADMIN');
  await createUser('clerk_test', 'Cashier Clerk', 'CLERK');

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33894, '127.0.0.1', resolve);
  });
});

test.after(async () => {
  await new Promise(resolve => app.server.close(resolve));
  if (app.database?.close) app.database.close();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('Shared Components: Static assets (icons.svg, components.css, components.js) are properly served', async () => {
  // Test icons.svg
  const svgRes = await fetch(`${baseUrl}/public/icons.svg`);
  assert.equal(svgRes.status, 200);
  assert.equal(svgRes.headers.get('content-type'), 'image/svg+xml');
  const svgText = await svgRes.text();
  assert.ok(svgText.includes('id="icon-user"'), 'SVG sprite must contain icon-user');
  assert.ok(svgText.includes('id="icon-stethoscope"'), 'SVG sprite must contain icon-stethoscope');
  assert.ok(svgText.includes('id="icon-pill"'), 'SVG sprite must contain icon-pill');
  assert.ok(svgText.includes('id="icon-bed"'), 'SVG sprite must contain icon-bed');
  assert.ok(svgText.includes('id="icon-check-circle"'), 'SVG sprite must contain icon-check-circle');

  // Test components.css
  const cssRes = await fetch(`${baseUrl}/public/components.css`);
  assert.equal(cssRes.status, 200);
  assert.ok(cssRes.headers.get('content-type').includes('text/css'));
  const cssText = await cssRes.text();
  assert.ok(cssText.includes('.btn-primary'), 'components.css must define .btn-primary');
  assert.ok(cssText.includes('.badge-soap-s'), 'components.css must define .badge-soap-s');
  assert.ok(cssText.includes('.modal-dialog'), 'components.css must define .modal-dialog');
  assert.ok(cssText.includes('.toast-container'), 'components.css must define .toast-container');
  assert.ok(cssText.includes('.table-sticky-header'), 'components.css must define .table-sticky-header');

  // Test components.js
  const jsRes = await fetch(`${baseUrl}/public/components.js`);
  assert.equal(jsRes.status, 200);
  assert.ok(jsRes.headers.get('content-type').includes('javascript'));
  const jsText = await jsRes.text();
  assert.ok(jsText.includes('window.openEmrModal'), 'components.js must export openEmrModal');
  assert.ok(jsText.includes('window.showEmrToast'), 'components.js must export showEmrToast');
  assert.ok(jsText.includes('window.setEmrTheme'), 'components.js must export setEmrTheme');
});

test('Styleguide: Access control protects /styleguide strictly for ADMIN only', async () => {
  // 1. Unauthenticated request must redirect to /login
  const unauthRes = await fetch(`${baseUrl}/styleguide`, { redirect: 'manual' });
  assert.equal(unauthRes.status, 302, 'Unauthenticated request to /styleguide must redirect with 302');
  assert.equal(unauthRes.headers.get('location'), '/login');

  // 2. Non-admin role (CLERK) must be rejected with 403
  const clerkCookie = await loginUser('clerk_test');
  const clerkRes = await fetch(`${baseUrl}/styleguide`, {
    headers: { Cookie: clerkCookie },
  });
  assert.equal(clerkRes.status, 403, 'Non-admin role must be rejected from /styleguide with 403');

  // 3. ADMIN role must succeed with 200 and strict CSP
  const adminCookie = await loginUser('admin_test');
  const adminRes = await fetch(`${baseUrl}/styleguide`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(adminRes.status, 200, 'ADMIN role must successfully open /styleguide');
  
  const csp = adminRes.headers.get('content-security-policy');
  assert.ok(csp, 'Strict CSP must be applied');
  assert.ok(!csp.includes("'unsafe-inline'"), 'Strict CSP on /styleguide must not allow unsafe-inline');

  const html = await adminRes.text();
  assert.ok(html.includes('មគ្គុទ្ទេសក៍រចនាប័ទ្ម'), 'Styleguide page must load Khmer title');
  assert.ok(html.includes('demo-sample-modal'), 'Styleguide page must contain interactive demo modal');
  assert.ok(html.includes('demo-sample-drawer'), 'Styleguide page must contain interactive demo drawer');
  assert.ok(html.includes('badge-soap-s'), 'Styleguide page must showcase SOAP clinical badges');
});
