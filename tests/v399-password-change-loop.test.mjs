import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

const port = 33990;
const base = `http://127.0.0.1:${port}`;
const initialPassword = 'InitialPass2026!';
const newPassword = 'ChangedPass2026!';
let app;
let tempDir;

test.before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-v399-test-'));
  app = createEmrServer({
    demoMode: false, host: '127.0.0.1', port, appOrigin: base,
    databasePath: path.join(tempDir, 'test.sqlite'), nodeEnv: 'test',
  });
  const id = crypto.randomUUID();
  app.database.createUser({
    id, username: 'reg.change', displayName: 'Registration', role: 'REGISTRATION',
    passwordHash: await hashPassword(initialPassword), mustChangePassword: true, createdAt: Date.now(),
  });
  setUserAccess(app.database, id, ['REGISTRATION'], []);
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(port, '127.0.0.1', resolve);
  });
});

test.after(async () => {
  await new Promise(resolve => app.server.close(resolve));
  app.database.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function login(password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ username: 'reg.change', password }),
  });
  return { response, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function follow(url, cookie, limit = 6) {
  const hops = [];
  for (let i = 0; i < limit; i++) {
    const response = await fetch(base + url, { headers: { Cookie: cookie }, redirect: 'manual' });
    hops.push([url, response.status]);
    if (response.status !== 302) return hops;
    url = response.headers.get('location');
  }
  return hops;
}

test('v39.9 an account that must change its password is not caught in a redirect loop', async () => {
  const { response, body, cookie } = await login(initialPassword);
  assert.equal(response.status, 200);
  assert.equal(body.mustChangePassword, true);

  // Work page -> /login?passwordChange=1 -> the sign-in page itself (200), not back again.
  const hops = await follow('/emr?view=register', cookie);
  assert.deepEqual(hops, [['/emr?view=register', 302], ['/login?passwordChange=1', 200]]);
  assert.deepEqual(await follow('/login', cookie), [['/login', 200]]);
  assert.deepEqual(await follow('/', cookie), [['/', 302], ['/login?passwordChange=1', 200]]);

  // The page can learn about the pending change and the CSRF token it needs.
  const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  const identity = await me.json();
  assert.equal(identity.user.mustChangePassword, true);
  assert.ok(identity.csrfToken);

  const change = await fetch(`${base}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, 'X-CSRF-Token': identity.csrfToken },
    body: JSON.stringify({ currentPassword: initialPassword, newPassword, confirmation: newPassword }),
  });
  assert.equal(change.status, 200);

  // Signing in again with the new password reaches the work page normally.
  const again = await login(newPassword);
  assert.equal(again.response.status, 200);
  assert.equal(again.body.mustChangePassword, false);
  assert.deepEqual(await follow('/login', again.cookie, 2), [['/login', 302], ['/emr?view=register', 200]]);
});

test('v39.9 sign-in page shows a Khmer change-password form instead of redirecting', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
  const html = fs.readFileSync(path.join(root, 'public/login.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public/login.js'), 'utf8');
  assert.match(html, /<form id="password-change-form"[^>]*hidden/);
  assert.match(html, /ប្តូរពាក្យសម្ងាត់/);
  assert.match(html, /id="password-change-next"[^>]*autocomplete="new-password"/);
  assert.match(html, /login\.js\?v=3990/);
  assert.doesNotMatch(html, /<script>(?!<\/script>)/, 'no inline scripts (CSP)');
  assert.match(script, /result\.mustChangePassword[\s\S]*showPasswordChange/);
  assert.match(script, /result\.user\?\.mustChangePassword\) \{ showPasswordChange/);
  assert.match(script, /\/api\/auth\/change-password/);
});
