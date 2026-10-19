import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v26.6 protected/finance.html removes daily hospital report section and sets clean cashflow heading', () => {
  const html = fs.readFileSync(new URL('../protected/finance.html', import.meta.url), 'utf8');
  
  // daily hospital report panel and its elements must be removed
  assert.doesNotMatch(html, /class="daily-report-panel"/, 'daily-report-panel is removed');
  assert.doesNotMatch(html, /របាយការណ៍មន្ទីរពេទ្យប្រចាំថ្ងៃ/, 'daily hospital report text is removed');
  assert.doesNotMatch(html, /id="ward-report-body"/, 'ward-report-body is removed from finance');
  assert.doesNotMatch(html, /id="payment-report"/, 'payment-report is removed from finance');
  assert.doesNotMatch(html, /id="report-summary"/, 'report-summary is removed from finance');
  assert.doesNotMatch(html, /id="report-date"/, 'report-date input is removed');

  // Title and banner are clean cash flow
  assert.match(html, /<title>លំហូរសាច់ប្រាក់<\/title>/);
  assert.match(html, /<h1>លំហូរសាច់ប្រាក់<\/h1>/);

  // Calendar and monthly service panel remain preserved
  assert.match(html, /id="calendar"/);
  assert.match(html, /class="monthly-service-panel"/);
});

test('v26.6 public/finance.js cleans up daily report loading and keeps cashflow logic', () => {
  const js = fs.readFileSync(new URL('../public/finance.js', import.meta.url), 'utf8');
  
  // Removed daily report function and listener bindings
  assert.doesNotMatch(js, /function loadDailyReport/);
  assert.doesNotMatch(js, /api\('\/api\/reports\/daily\?date='/);
  assert.doesNotMatch(js, /\$\('report-date'\)/);
  assert.doesNotMatch(js, /\$\('report-today'\)/);

  // Cash flow calendar and monthly service report functions are preserved
  assert.match(js, /function loadCashflow/);
  assert.match(js, /function loadMonthlyServiceReport/);
  assert.match(js, /function loadMonthViews/);
  assert.match(js, /function day\(date\)/);
});

test('v26.6 public/emr-session.js moves cashflow under Home group for management and leaves billing/expenses under Cashier', () => {
  const js = fs.readFileSync(new URL('../public/emr-session.js', import.meta.url), 'utf8');

  // Management account home group includes របាយការណ៍ and លំហូរសាច់ប្រាក់
  assert.match(js, /label:'ទំព័រដើម',items:\[\['\/home','របាយការណ៍'\],\['\/finance','លំហូរសាច់ប្រាក់'\]\]/);

  // Cashier group has only 2 items: បេឡា and ចំណាយ
  assert.match(js, /label:'បេឡា',items:\[\['\/billing','បេឡា'\],\['\/expenses','ចំណាយ'\]\]/);
});
