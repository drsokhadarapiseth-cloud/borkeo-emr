import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDatabase } from '../server/database.mjs';
import { ensureFinanceSchema, cashflowRange, serviceRevenueRange, addPayment, addExpense } from '../server/finance.mjs';


test('v27.3 protected/finance.html provides period range controls (month, trimester, semester, year, custom)', () => {
  const html = fs.readFileSync(new URL('../protected/finance.html', import.meta.url), 'utf8');

  // Must have period selector
  assert.match(html, /class="period-pills-nav"/);
  assert.match(html, /data-period="month"/);
  assert.match(html, /data-period="trimester"/);
  assert.match(html, /data-period="semester"/);
  assert.match(html, /data-period="year"/);
  assert.match(html, /data-period="custom"/);

  // Must have individual period control groups
  assert.match(html, /id="controls-month"/);
  assert.match(html, /id="controls-trimester"/);
  assert.match(html, /id="controls-semester"/);
  assert.match(html, /id="controls-year"/);
  assert.match(html, /id="controls-custom"/);

  // Must have flexible views for both single-month calendar and multi-month period days
  assert.match(html, /id="month-calendar-view"/);
  assert.match(html, /id="period-days-view"/);
  assert.match(html, /id="period-days-grid"/);
});

test('v27.3 public/finance.js implements getActiveRange and renders period day cards', () => {
  const js = fs.readFileSync(new URL('../public/finance.js', import.meta.url), 'utf8');

  assert.match(js, /function getActiveRange/);
  assert.match(js, /function renderPeriodDaysList/);
  assert.match(js, /function renderDaysOrCalendar/);
  assert.match(js, /function initPeriodControls/);
  assert.match(js, /startDate=/);
  assert.match(js, /endDate=/);
});

test('v27.3 backend cashflowRange and serviceRevenueRange calculate totals across arbitrary date ranges', () => {
  const db = openDatabase(':memory:');
  try {
    ensureFinanceSchema(db);

    // Seed dummy user
    db.sqlite.prepare(`INSERT INTO users(id,username,password_hash,display_name,role,is_active,created_at,updated_at)
      VALUES('u1','test','hash','Test User','ADMIN',1,1000,1000)`).run();

    // January 2026 (Trimester 1, Semester 1)
    const janTime = new Date(2026, 0, 15, 10, 0, 0).getTime();
    db.sqlite.prepare(`INSERT INTO finance_payments
      (id,patient_key,invoice_id,source,amount_minor,currency,purpose,receipt_no,service_code,category_code,reference,note,received_by,cashier_name_snapshot,received_at,created_at)
      VALUES('pay1','p1','inv1','CASH',40000,'KHR','OPD_CONSULTATION','RCPT-001','GEN_OPD','OPD','','','u1','Cashier',?,?)`).run(janTime, janTime);

    // May 2026 (Trimester 2, Semester 1)
    const mayTime = new Date(2026, 4, 10, 11, 0, 0).getTime();
    db.sqlite.prepare(`INSERT INTO finance_payments
      (id,patient_key,invoice_id,source,amount_minor,currency,purpose,receipt_no,service_code,category_code,reference,note,received_by,cashier_name_snapshot,received_at,created_at)
      VALUES('pay2','p2','inv2','CASH',1000,'USD','LAB','RCPT-002','LAB_CBC','LABORATORY','','','u1','Cashier',?,?)`).run(mayTime, mayTime);

    // Add an expense in January 2026
    db.sqlite.prepare(`INSERT INTO finance_expenses
      (id,category,description,amount_minor,currency,reference,spent_at,created_by,created_at)
      VALUES('exp1','SUPPLIES','Gloves',15000,'KHR','EXP-001',?,'u1',?)`).run(janTime, janTime);

    // Test 1: Query Month 2026-01
    const janFlow = cashflowRange(db, { month: '2026-01' });
    assert.equal(janFlow.totals.income.KHR, 40000);
    assert.equal(janFlow.totals.expense.KHR, 15000);
    assert.equal(janFlow.totals.net.KHR, 25000);

    // Test 2: Query Trimester 1 (2026-01-01 to 2026-03-31)
    const q1Flow = cashflowRange(db, { startDate: '2026-01-01', endDate: '2026-03-31' });
    assert.equal(q1Flow.totals.income.KHR, 40000);
    assert.equal(q1Flow.totals.income.USD, 0);

    // Test 3: Query Semester 1 (2026-01-01 to 2026-06-30) -> captures both Jan and May
    const s1Flow = cashflowRange(db, { startDate: '2026-01-01', endDate: '2026-06-30' });
    assert.equal(s1Flow.totals.income.KHR, 40000);
    assert.equal(s1Flow.totals.income.USD, 10);
    assert.equal(s1Flow.totals.expense.KHR, 15000);

    // Test 4: Query Yearly Service Revenue (2026-01-01 to 2026-12-31)
    const yearSrv = serviceRevenueRange(db, { startDate: '2026-01-01', endDate: '2026-12-31' });
    assert.equal(yearSrv.totals.KHR, 40000);
    assert.equal(yearSrv.totals.USD, 10);
    assert.equal(yearSrv.services.length, 2);
  } finally {
    db.sqlite.close();
  }
});
