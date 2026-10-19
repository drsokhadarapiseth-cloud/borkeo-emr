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

