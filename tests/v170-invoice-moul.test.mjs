import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v19.4 uses Moul for the Khmer hospital and payment-invoice headings', () => {
  assert.match(JSON.parse(read('package.json')).version, /^[0-9]+\.[0-9]+\./);
  const billing = read('public/billing.js');
  assert.equal((billing.match(/fonts\.googleapis\.com\/css2\?family=Moul/g) || []).length, 2);
  assert.equal((billing.match(/class="invoice-moul"/g) || []).length, 5);
  assert.equal((billing.match(/វិក្កយបត្របង់ប្រាក់/g) || []).length >= 2, true);
  const receiptCss = read('public/receipt.css');
  assert.match(receiptCss, /\.header-text \.invoice-moul\s*\{[^}]*font-family:\s*"Moul"/);
  assert.match(read('protected/billing.html'), /billing\.js\?v=\d+/);
});
