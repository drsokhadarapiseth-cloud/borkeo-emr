import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v26.1 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.version, '26.1.0');

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v26\.1/);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v26\.1/);
});

test('v26.1 protected/home.html provides department view tabs and separate OPD/IPD styles', () => {
  const homeHtml = fs.readFileSync(path.join(process.cwd(), 'protected/home.html'), 'utf8');
  assert.ok(homeHtml.includes('data-dept-tab="all"'), 'Overview tab present');
  assert.ok(homeHtml.includes('data-dept-tab="opd"'), 'OPD tab present');
  assert.ok(homeHtml.includes('data-dept-tab="ipd"'), 'IPD tab present');
  assert.ok(homeHtml.includes('id="view-opd"'), 'view-opd section present');
  assert.ok(homeHtml.includes('id="view-ipd"'), 'view-ipd section present');
  assert.ok(homeHtml.includes('id="opd-standalone-report-body"'), 'opd-standalone-report-body present');
  assert.ok(homeHtml.includes('id="opd-payment-report"'), 'opd-payment-report present');
});

test('v26.1 public/home.js implements department switching and separate OPD/IPD rendering', () => {
  const homeJs = fs.readFileSync(path.join(process.cwd(), 'public/home.js'), 'utf8');
  assert.ok(homeJs.includes('data-dept-tab'), 'department tab handling present in home.js');
  assert.ok(homeJs.includes('opd-standalone-report-body'), 'opd-standalone-report-body populated in home.js');
  assert.ok(homeJs.includes('ipd-standalone-report-body'), 'ipd-standalone-report-body populated in home.js');
  assert.ok(homeJs.includes('opd-payment-report'), 'opd-payment-report populated in home.js');
});
