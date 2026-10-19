import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v28.2 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(/^28\.[2-9]\./.test(pkg.version));

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v28\.[2-9]/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /v28\.[2-9]/);
});

test('v28.2 finance.mjs provides bilingual charge names and defaults to Khmer', () => {
  const finance = read('server/finance.mjs');
  assert.match(finance, /descriptionKh\s*=\s*catItem\?\.name_kh/);
  assert.match(finance, /descriptionEn\s*=\s*catItem\?\.name_en/);
  assert.match(finance, /categoryKh\s*=/);
  assert.match(finance, /categoryEn\s*=/);
  assert.match(finance, /catalogItem\?\.nameKh\s*\|\|\s*catalogItem\?\.nameEn/);
});

test('v28.2 billing.js defaults to Khmer for service and department on standard invoice and receipt', () => {
  const billing = read('public/billing.js');
  assert.match(billing, /function chargeServiceLabel\(x,\s*isEn=false\)/);
  assert.match(billing, /function chargeCategoryLabel\(x,\s*isEn=false/);
  assert.match(billing, /ពិគ្រោះក្រៅ គ្មានលិខិតបញ្ជូនពីមណ្ឌលសុខភាព/);
  assert.match(billing, /ផ្នែកពិគ្រោះក្រៅ \(OPD\)/);
  assert.match(billing, /function receiptHtml\(payment,\s*bill=currentBill,\s*lang='km'\)/);
  assert.match(billing, /function invoiceHtml\(bill=currentBill,\s*lang='km'\)/);
});
