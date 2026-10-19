import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');


test('v25.6 billing.html contains default Khmer invoice and dedicated Print EN Invoice buttons', () => {
  const billingHtml = read('protected/billing.html');
  
  // Itemized bill tools
  assert.match(billingHtml, /<button id="print-invoice"[^>]*>បោះពុម្ពវិក្កយបត្រ<\/button>/);
  assert.match(billingHtml, /<button id="print-invoice-en"[^>]*>Print EN Invoice<\/button>/);
  
  // Khmer table headings for invoice charges detail
  assert.match(billingHtml, /<th>សេវា<\/th><th>ផ្នែក<\/th><th>ចំនួន<\/th><th>តម្លៃរាយ<\/th><th>សរុប<\/th><th>ស្ថានភាព<\/th>/);
});

test('v25.6 billing.js implements bilingual invoice generation with Khmer default and English print', () => {
  const billingJs = read('public/billing.js');
  
  // Function signature with default Khmer
  assert.match(billingJs, /function invoiceHtml\(bill=currentBill,\s*lang='km'\)/);
  assert.match(billingJs, /function printInvoice\(lang='km'\)/);
  
  // English translations inside invoiceHtml
  assert.match(billingJs, /isEn\?`Gross Total \$\{c\}`:`សរុប \$\{c\}`/);
  assert.match(billingJs, /isEn\?`Discount \/ Waiver \$\{c\}`:`តម្លៃលើកលែង \$\{c\}`/);
  assert.match(billingJs, /isEn\?`Net Amount Due \$\{c\}`:`ត្រូវបង់ \$\{c\}`/);
  assert.match(billingJs, /isEn\?'<h3>OFFICIAL INVOICE<\/h3>':'<h3 class="invoice-moul">វិក្កយបត្របង់ប្រាក់<\/h3>'/);
  assert.match(billingJs, /isEn\?'Payer Signature':'អ្នកបង់ប្រាក់'/);
  assert.match(billingJs, /isEn\?'Cashier:':'អ្នកទទួលប្រាក់:'/);
  
  // History cards and event listeners
  assert.match(billingJs, /data-history-print-en/);
  assert.match(billingJs, /\$\('print-invoice-en'\)\?\.addEventListener\('click',\(?\)?\s*=>\s*printInvoice\('en'\)\)/);
});
