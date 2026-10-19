import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


test('v26.1 protected/home.html provides separate OPD/IPD styles and tables', () => {
  const homeHtml = fs.readFileSync(path.join(process.cwd(), 'protected/home.html'), 'utf8');
  assert.ok(homeHtml.includes('ward-report-body'), 'ward-report-body present');
  assert.ok(homeHtml.includes('payment-report'), 'payment-report present');
  assert.ok(homeHtml.includes('opd-report-body'), 'opd-report-body present');
  assert.ok(homeHtml.includes('opd-payment-report'), 'opd-payment-report present');
});

test('v26.1 public/home.js implements separate OPD/IPD rendering', () => {
  const homeJs = fs.readFileSync(path.join(process.cwd(), 'public/home.js'), 'utf8');
  assert.ok(homeJs.includes('ward-report-body'), 'ward-report-body populated in home.js');
  assert.ok(homeJs.includes('opdRowsHtml') || homeJs.includes('opd-report-body'), 'opd report populated in home.js');
  assert.ok(homeJs.includes('opd-payment-report'), 'opd-payment-report populated in home.js');
});
