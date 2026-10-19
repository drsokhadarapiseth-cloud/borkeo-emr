import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('v28.0 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.version >= '28.0.0');

  const loginHtml = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
  assert.match(loginHtml, /v28\./);

  const server = fs.readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /v28\./);
});

test('v28.0 admission print form title is renamed to លិខិតអនុញ្ញាតចូលសម្រាកពេទ្យ', () => {
  const html = fs.readFileSync(new URL('../protected/EMR.html', import.meta.url), 'utf8');
  assert.match(html, /data-key="adm_print_title"[^>]*class="moul-font">លិខិតអនុញ្ញាតចូលសម្រាកពេទ្យ<\/div>/);
  assert.match(html, /adm_print_title:\s*"លិខិតអនុញ្ញាតចូលសម្រាកពេទ្យ"/);
  assert.match(html, /adm_print_title:\s*"Hospital Admission Permission Letter"/);
});

test('v28.0 admission diagnosis is dynamically synced based on Triage route (IPD vs OPD)', () => {
  const html = fs.readFileSync(new URL('../protected/EMR.html', import.meta.url), 'utf8');
  assert.match(html, /function syncAdmissionDiagnosis\(\)/);
  assert.match(html, /function getPrimaryDiagnosis\(kind\)/);
  assert.match(html, /window\.syncAdmissionDiagnosis\s*=\s*syncAdmissionDiagnosis;/);
});
