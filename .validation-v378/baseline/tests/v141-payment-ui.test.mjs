import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DIRECT_PAYMENT_TYPES, PAYMENT_TYPES } from '../server/finance.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('v14.3 cashier retains payment types and exposes cashier fee adjustments',()=>{
  assert.deepEqual(PAYMENT_TYPES.filter(item=>item.code!=='NOT_PAID').map(item=>item.code),[
    'DIRECT','HEF','NSSF','INSURANCE','NGO',
  ]);
  assert.deepEqual(DIRECT_PAYMENT_TYPES.map(item=>item.code),[
    'FULL','DISCOUNT','FULL_WAIVER',
  ]);
  const html=read('protected/billing.html');
  const js=read('public/billing.js');
  assert.match(html,/id="direct-payment-type"/);
  assert.match(html,/id="discount-amount"/);
  assert.match(html,/id="discount-currency"/);
  assert.doesNotMatch(html,/id="hef-type"/);
  assert.match(html,/id="adjustment-mode"/);
  assert.match(html,/id="adjustment-percent"/);
  assert.doesNotMatch(html,/value="PARTIAL_WAIVER"/);assert.match(html,/id="request-cash-waiver"/);
  assert.match(html,/លើកលែងទាំងស្រុង/);
  assert.match(js,/paymentSubtype,discountAmount,discountPercent/);
  assert.match(js,/PERCENT_DISCOUNT:'DISCOUNT'/);
});
