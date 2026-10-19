import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('v27.2 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.version, /^(?:27\.|28\.)/);

  const loginHtml = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
  assert.match(loginHtml, /v(?:27\.|28\.)/);

  const server = fs.readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /v(?:27\.|28\.)/);
});

test('v27.2 protected/finance.html replaces duplicate side-by-side tables with single unified ledger table', () => {
  const html = fs.readFileSync(new URL('../protected/finance.html', import.meta.url), 'utf8');

  // Must NOT have the duplicate side-by-side grid
  assert.doesNotMatch(html, /class="monthly-report-grid"/);
  assert.doesNotMatch(html, /id="monthly-category-body"/);

  // Unified single full-width ledger table must exist
  assert.match(html, /class="monthly-report-single-wrap"/);
  assert.match(html, /class="report-card full-width-ledger"/);
  assert.match(html, /id="monthly-service-body"/);
  assert.match(html, /id="monthly-service-foot"/);
});

test('v27.2 public/finance.js populates the unified ledger with service and department breakdown', () => {
  const js = fs.readFileSync(new URL('../public/finance.js', import.meta.url), 'utf8');

  // Renders both service name and department tag in unified table
  assert.match(js, /class="service-name"/);
  assert.match(js, /class="dept-tag"/);
  assert.match(js, /monthly-service-foot/);
});
