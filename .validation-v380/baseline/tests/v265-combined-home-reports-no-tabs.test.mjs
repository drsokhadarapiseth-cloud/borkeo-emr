import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('v26.5 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '26.5.0');

  const loginHtml = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
  assert.match(loginHtml, /v26\.5/);

  const server = fs.readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /v26\.5/);
});

test('v26.5 protected/home.html removes the 3 switcher buttons and combines OPD, IPD and payment in 1 page', () => {
  const html = fs.readFileSync(new URL('../protected/home.html', import.meta.url), 'utf8');
  
  // Department switcher buttons must be removed
  assert.doesNotMatch(html, /data-dept-tab="all"/, 'all dept tab removed');
  assert.doesNotMatch(html, /data-dept-tab="opd"/, 'opd dept tab removed');
  assert.doesNotMatch(html, /data-dept-tab="ipd"/, 'ipd dept tab removed');
  assert.doesNotMatch(html, /class="report-dept-tabs"/, 'report-dept-tabs nav removed');

  // Both IPD and OPD tables must be present together on the same page
  assert.match(html, /id="ward-report-body"/, 'Inpatient ward table is present');
  assert.match(html, /id="payment-report"/, 'Payment status report is present');
  assert.match(html, /id="opd-report-body"/, 'OPD indicator table is present');
});

test('v26.5 public/home.js renders both IPD and OPD reports cleanly without tab switching dependency', () => {
  const js = fs.readFileSync(new URL('../public/home.js', import.meta.url), 'utf8');
  
  // Populates ward and opd tables
  assert.match(js, /\$\('ward-report-body'\)\.innerHTML\s*=/);
  assert.match(js, /\$\('opd-report-body'\)\.innerHTML\s*=/);
  assert.match(js, /\$\('payment-report'\)\.innerHTML\s*=/);
  
  // No leftover tab switching click listeners for data-dept-tab
  assert.doesNotMatch(js, /data-dept-tab/);
});
