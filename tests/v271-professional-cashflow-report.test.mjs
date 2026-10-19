import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v27.1 protected/finance.html provides executive accountant layout, table footers, and print signatures', () => {
  const html = fs.readFileSync(new URL('../protected/finance.html', import.meta.url), 'utf8');

  // Print report button in toolbar
  assert.match(html, /btn-print-pro/, 'Print button class present');
  assert.match(html, /id="print-month-report"/, 'Print button present');

  // Table footers for accounting double-underline grand totals
  assert.match(html, /id="monthly-service-foot"/, 'monthly-service-foot present');

  // Financial statement formal signatures
  assert.match(html, /class="finance-statement-signatures"/, 'Signatures section present');
  assert.match(html, /Chief Accountant/, 'Chief Accountant signature block present');
  assert.match(html, /Hospital Director/, 'Hospital Director signature block present');
});

test('v27.1 public/finance.js renders executive KPI cards, accounting footers, and structured daily ledger', () => {
  const js = fs.readFileSync(new URL('../public/finance.js', import.meta.url), 'utf8');

  // Executive KPI cards
  assert.match(js, /exec-card income-exec-card/);
  assert.match(js, /exec-card expense-exec-card/);
  assert.match(js, /exec-card net-exec-card/);

  // Accounting Grand Total footers
  assert.match(js, /monthly-category-foot/);
  assert.match(js, /monthly-service-foot/);
  assert.match(js, /Grand Total/);

  // Daily transaction card formatting
  assert.match(js, /txn-card inc-card/);
  assert.match(js, /txn-card exp-card/);
});

test('v27.1 public/finance.css includes accounting table double-underline and responsive cards', () => {
  const css = fs.readFileSync(new URL('../public/finance.css', import.meta.url), 'utf8');

  // Double border for accounting grand total
  assert.match(css, /double #0f354a/);
  assert.match(css, /\.exec-card/);
  assert.match(css, /\.finance-statement-signatures/);
});
