import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.4 public and protected HTML pages use desktop viewport width=1200', () => {
  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.ok(loginHtml.includes('content="width=1200, user-scalable=yes"'), 'login.html has desktop viewport 1200');

  const homeHtml = fs.readFileSync(path.join(process.cwd(), 'protected/home.html'), 'utf8');
  assert.ok(homeHtml.includes('content="width=1200, user-scalable=yes"'), 'home.html has desktop viewport 1200');

  const patientHtml = fs.readFileSync(path.join(process.cwd(), 'protected/patient-list.html'), 'utf8');
  assert.ok(patientHtml.includes('content="width=1200, user-scalable=yes"'), 'patient-list.html has desktop viewport 1200');

  const triageHtml = fs.readFileSync(path.join(process.cwd(), 'protected/triage.html'), 'utf8');
  assert.ok(triageHtml.includes('content="width=1200, user-scalable=yes"'), 'triage.html has desktop viewport 1200');

  const imagingHtml = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  assert.ok(imagingHtml.includes('content="width=1200, user-scalable=yes"'), 'imaging.html has desktop viewport 1200');
});

test('v22.4 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);

  const login = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(login, /v2[0-9]\./);
});
