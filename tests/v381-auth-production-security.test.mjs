import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { loadConfig } from '../server/config.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { generateTotpCode, generateTotpSecret, verifyTotpCode } from '../server/totp.mjs';

let app;
let baseUrl;
let tempDir;
let adminId;
let doctorId;
const adminPassword = 'AdminSecretPass2026!';
const doctorPassword = 'DoctorInitialPass2026!';

test.before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-v381-test-'));
  const dbPath = path.join(tempDir, 'prod-test.sqlite');

  app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33810,
    appOrigin: 'http://127.0.0.1:33810',
    databasePath: dbPath,
    nodeEnv: 'test',
    loginMaxAttempts: 3,
    loginWindowMinutes: 5,
  });

  adminId = crypto.randomUUID();
  app.database.createUser({
    id: adminId,
    username: 'admin.prod',
    displayName: 'Admin User',
    role: 'ADMIN',
    passwordHash: await hashPassword(adminPassword),
    createdAt: Date.now(),
  });
  setUserAccess(app.database, adminId, ['ADMIN'], []);

  doctorId = crypto.randomUUID();
  app.database.createUser({
    id: doctorId,
    username: 'doctor.prod',
    displayName: 'Doctor User',
    role: 'DOCTOR',
    passwordHash: await hashPassword(doctorPassword),
    mustChangePassword: true,
    createdAt: Date.now(),
  });
  setUserAccess(app.database, doctorId, ['DOCTOR'], ['medicine']);

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33810, '127.0.0.1', resolve);
  });
  baseUrl = 'http://127.0.0.1:33810';
});

test.after(async () => {
  await new Promise(resolve => app.server.close(resolve));
  app.database.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('server does not bind to 0.0.0.0 by default and demo mode is opt-in', () => {
  const origHost = process.env.HOST;
  const origMode = process.env.EMR_MODE;
  try {
    delete process.env.HOST;
    delete process.env.EMR_MODE;

    const prodConfig = loadConfig();
    assert.equal(prodConfig.host, '127.0.0.1', 'Default host must be 127.0.0.1');
    assert.equal(prodConfig.demoMode, false, 'Default demoMode must be false (opt-in)');

    process.env.EMR_MODE = 'demo';
    const demoConfig = loadConfig();
    assert.equal(demoConfig.demoMode, true, 'EMR_MODE=demo must enable demoMode');
    assert.equal(demoConfig.host, '127.0.0.1', 'Demo mode must still default to 127.0.0.1');

    process.env.EMR_MODE = 'production';
    const explicitProd = loadConfig();
    assert.equal(explicitProd.demoMode, false);
    assert.equal(explicitProd.cookieSecure, true, 'Production must enforce cookieSecure');
  } finally {
    if (origHost) process.env.HOST = origHost; else delete process.env.HOST;
    if (origMode) process.env.EMR_MODE = origMode; else delete process.env.EMR_MODE;
  }
});

test('/api/auth/config returns no usernames in production', async () => {
  const res = await fetch(`${baseUrl}/api/auth/config`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.demoMode, false);
  assert.deepEqual(data.accounts, []);
});

test('no login without password in production', async () => {
  // 1. Missing password
  const resMissing = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod' }),
  });
  assert.equal(resMissing.status, 401);

  // 2. Incorrect password
  const resWrong = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod', password: 'WrongPassword123!' }),
  });
  assert.equal(resWrong.status, 401);

  // 3. Correct password succeeds
  const resOk = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod', password: adminPassword }),
  });
  assert.equal(resOk.status, 200);
  const okData = await resOk.json();
  assert.equal(okData.user.username, 'admin.prod');
  assert.ok(resOk.headers.get('set-cookie'));
});

test('lockout works after repeated failed login attempts', async () => {
  const targetUser = 'lockout.target';
  const id = crypto.randomUUID();
  app.database.createUser({
    id,
    username: targetUser,
    displayName: 'Lockout Target',
    role: 'DOCTOR',
    passwordHash: await hashPassword('ValidPassword123!'),
    createdAt: Date.now(),
  });

  // Attempt 3 failures (loginMaxAttempts = 3)
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ username: targetUser, password: 'WrongPassword999!' }),
    });
    assert.equal(res.status, 401);
  }

  // 4th attempt should be locked out with 429 Too Many Requests
  const lockedRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: targetUser, password: 'ValidPassword123!' }),
  });
  assert.equal(lockedRes.status, 429);
  const lockedData = await lockedRes.json();
  assert.ok(lockedData.error.includes('ផ្អាក') || lockedData.error.toLowerCase().includes('wait') || lockedData.retryAfter > 0);

  // Clear IP limit so subsequent tests can log in
  app.database.clearLoginLimit('ip:127.0.0.1');
  app.database.clearLoginLimit(`user:${targetUser}`);
});

test('forced password change at first login restricts access until password changed', async () => {
  // Login as doctor with mustChangePassword: true
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'doctor.prod', password: doctorPassword }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.equal(loginData.mustChangePassword, true);

  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  const meData = await meRes.json();
  const csrfToken = meData.csrfToken;

  // Accessing a clinical or protected endpoint before password change should be 403
  const protectedRes = await fetch(`${baseUrl}/api/patients`, {
    headers: { Cookie: cookie },
  });
  assert.equal(protectedRes.status, 403);
  const protectedData = await protectedRes.json();
  assert.equal(protectedData.mustChangePassword, true);

  // Now change password
  const newPassword = 'NewDoctorSecurePass2026!';
  const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      Cookie: cookie,
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({
      currentPassword: doctorPassword,
      newPassword,
      confirmation: newPassword,
    }),
  });
  assert.equal(changeRes.status, 200);
  const changeData = await changeRes.json();
  assert.equal(changeData.ok, true);

  // Login again with new password
  const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'doctor.prod', password: newPassword }),
  });
  assert.equal(newLoginRes.status, 200);
  const newLoginData = await newLoginRes.json();
  assert.equal(newLoginData.mustChangePassword, false);
});

test('admin can reset password and forces change on next login', async () => {
  // Admin logs in
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod', password: adminPassword }),
  });
  assert.equal(adminLoginRes.status, 200);
  const adminCookie = adminLoginRes.headers.get('set-cookie').split(';')[0];
  const adminMe = await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: adminCookie } })).json();

  // Reset doctor's password
  const resetPass = 'AdminAssignedPass2026!';
  const resetRes = await fetch(`${baseUrl}/api/admin/users/${doctorId}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      Cookie: adminCookie,
      'x-csrf-token': adminMe.csrfToken,
    },
    body: JSON.stringify({ password: resetPass }),
  });
  assert.equal(resetRes.status, 200);

  // Doctor logs in with reset password -> mustChangePassword must be true
  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'doctor.prod', password: resetPass }),
  });
  assert.equal(docLogin.status, 200);
  const docData = await docLogin.json();
  assert.equal(docData.mustChangePassword, true);
});

test('optional TOTP two-factor authentication for Admin and Director', async () => {
  // Admin logs in
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod', password: adminPassword }),
  });
  const cookie = adminLoginRes.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json();

  // 1. Setup 2FA
  const setupRes = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
    headers: { Cookie: cookie },
  });
  assert.equal(setupRes.status, 200);
  const { secret, uri } = await setupRes.json();
  assert.ok(secret && secret.length >= 16);
  assert.ok(uri.startsWith('otpauth://totp/'));

  // 2. Enable with invalid code fails
  const badEnable = await fetch(`${baseUrl}/api/auth/2fa/enable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      Cookie: cookie,
      'x-csrf-token': me.csrfToken,
    },
    body: JSON.stringify({ secret, code: '000000' }),
  });
  assert.equal(badEnable.status, 400);

  // 3. Enable with valid code succeeds
  const validCode = generateTotpCode(secret);
  const goodEnable = await fetch(`${baseUrl}/api/auth/2fa/enable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      Cookie: cookie,
      'x-csrf-token': me.csrfToken,
    },
    body: JSON.stringify({ secret, code: validCode }),
  });
  assert.equal(goodEnable.status, 200);
  const enableData = await goodEnable.json();
  assert.equal(enableData.enabled, true);

  // 4. Next login requires TOTP code
  const step1Login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod', password: adminPassword }),
  });
  assert.equal(step1Login.status, 200);
  const step1Data = await step1Login.json();
  assert.equal(step1Data.totpRequired, true);

  // 5. Login with invalid TOTP code fails
  const badTotpLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod', password: adminPassword, totpCode: '111111' }),
  });
  assert.equal(badTotpLogin.status, 401);

  // 6. Login with valid TOTP code succeeds
  const freshCode = generateTotpCode(secret);
  const goodTotpLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod', password: adminPassword, totpCode: freshCode }),
  });
  assert.equal(goodTotpLogin.status, 200);
  const goodTotpData = await goodTotpLogin.json();
  assert.equal(goodTotpData.user.username, 'admin.prod');
  const freshCookie = goodTotpLogin.headers.get('set-cookie').split(';')[0];
  const freshMe = await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: freshCookie } })).json();

  // 7. Disable 2FA with current password
  const disableRes = await fetch(`${baseUrl}/api/auth/2fa/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      Cookie: freshCookie,
      'x-csrf-token': freshMe.csrfToken,
    },
    body: JSON.stringify({ password: adminPassword }),
  });
  assert.equal(disableRes.status, 200);
  const disableData = await disableRes.json();
  assert.equal(disableData.enabled, false);

  // 8. Login again without TOTP succeeds
  const normalLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'admin.prod', password: adminPassword }),
  });
  assert.equal(normalLogin.status, 200);
  const normalData = await normalLogin.json();
  assert.equal(normalData.totpRequired, undefined);
  assert.equal(normalData.user.username, 'admin.prod');
});

test('create-user.mjs and reset-password.mjs scripts work for production', async () => {
  const { execFileSync } = await import('node:child_process');
  const dbPath = path.join(tempDir, 'prod-test.sqlite');

  // 1. Create a user via script
  const scriptUser = 'script.nurse';
  const scriptPass = 'NurseInitialPass2026!';
  execFileSync(process.execPath, [
    'scripts/create-user.mjs',
    '--username', scriptUser,
    '--display-name', 'Script Nurse',
    '--role', 'NURSE',
    '--ward', 'medicine',
    '--password', scriptPass,
    '--database', dbPath,
  ], { cwd: app.config.projectRoot });

  // Verify created user can login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: scriptUser, password: scriptPass }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.equal(loginData.user.username, scriptUser);
  assert.equal(loginData.mustChangePassword, true);

  // 2. Reset password via script
  const newScriptPass = 'NurseResetPass2026!';
  execFileSync(process.execPath, [
    'scripts/reset-password.mjs',
    '--username', scriptUser,
    '--password', newScriptPass,
    '--database', dbPath,
  ], { cwd: app.config.projectRoot });

  // Old password should fail
  const oldLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: scriptUser, password: scriptPass }),
  });
  assert.equal(oldLogin.status, 401);

  // New password succeeds and requires password change
  const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: scriptUser, password: newScriptPass }),
  });
  assert.equal(newLogin.status, 200);
  const newLoginData = await newLogin.json();
  assert.equal(newLoginData.mustChangePassword, true);
});
