import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v26.7 protected/home.html provides OPD payment status card side-by-side with OPD indicator table', () => {
  const html = fs.readFileSync(new URL('../protected/home.html', import.meta.url), 'utf8');

  // Both OPD indicators table and OPD payment status card must exist
  assert.match(html, /id="opd-report-body"/, 'OPD indicator report body exists');
  assert.match(html, /id="opd-payment-report"/, 'OPD payment report container exists');
  assert.match(html, /ស្ថានភាពទូទាត់ផ្នែក OPD/, 'OPD payment card title exists');

  // IPD ward census and payment status remain intact
  assert.match(html, /id="ward-report-body"/, 'Ward report body exists');
  assert.match(html, /id="payment-report"/, 'General/IPD payment report container exists');
});

test('v26.7 public/home.js populates both general payment-report and opd-payment-report', () => {
  const js = fs.readFileSync(new URL('../public/home.js', import.meta.url), 'utf8');

  assert.match(js, /\$\('payment-report'\)\.innerHTML\s*=/);
  assert.match(js, /\$\('opd-payment-report'\)\.innerHTML\s*=/);
  assert.match(js, /d\.opdReport\?\.paymentStatus/);
});
