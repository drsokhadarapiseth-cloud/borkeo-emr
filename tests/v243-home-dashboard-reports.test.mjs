import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';
import { recordMovement } from '../server/daily-report.mjs';


test('v24.3 protected/home.html contains 7 metric cards container, report panels, and removes old module-grid', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/home.html'), 'utf8');
  
  // Confirms module-grid is removed
  assert.ok(!html.includes('class="module-grid"'), 'home.html does not contain module-grid');

  // Confirms 7 metric cards container and components are present
  assert.ok(html.includes('id="report-summary"'), 'report-summary present');
  assert.ok(html.includes('report-summary-grid-7'), 'report-summary-grid-7 class present');
  assert.ok(html.includes('id="ward-report-body"'), 'ward-report-body present');
  assert.ok(html.includes('id="payment-report"'), 'payment-report present');
  assert.ok(html.includes('id="top-diagnoses-list"'), 'top-diagnoses-list present');
  assert.ok(html.includes('id="ward-chart-container"'), 'ward-chart-container present');
  assert.ok(html.includes('id="demographics-chart-container"'), 'demographics-chart-container present');

  // Verify JS logic includes 7 cards
  const js = fs.readFileSync(path.join(process.cwd(), 'public/home.js'), 'utf8');
  assert.ok(js.includes('admissions-card'), 'Home JS has admissions card');
  assert.ok(js.includes('transfers-card'), 'Home JS has internal transfers card');
  assert.ok(js.includes('hc-referral-card'), 'Home JS has HC referrals card');
  assert.ok(js.includes('hc-ambulance-card'), 'Home JS has HC ambulance card');
  assert.ok(js.includes('rh-ambulance-card'), 'Home JS has RH ambulance card');
  assert.ok(js.includes('provincial-card'), 'Home JS has Provincial referrals card');
  assert.ok(js.includes('ambulance-income-card'), 'Home JS has Ambulance income card');
});

test('v24.3 /api/reports/daily calculates 7 metrics and patient analytics including Top 10 Diagnoses', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  try {
    // Login as admin
    const loginRes = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie');

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const nowMs = Date.now();

    const adminUser = app.database.sqlite.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    const adminId = adminUser?.id || crypto.randomUUID();

    // Patient 1: HC Referral with RH Ambulance and Gastroenteritis
    const p1Key = 'case:PAT-TEST-101';
    app.database.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, record_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      p1Key,
      JSON.stringify({
        'scope:registration:id:web_first_name': 'សុខ',
        'scope:registration:id:web_last_name': 'មាន',
        'scope:registration:id:web_sex': 'ប្រុស',
        'scope:registration:id:web_entry_type': 'មណ្ឌលសុខភាព (HC Referral)',
        'scope:registration:id:referral_transport': 'RH_AMBULANCE',
        'system:discharge': {
          dischargeDiagnosis: 'A09 - Acute Gastroenteritis',
          dischargeIcd10: 'A09'
        },
        'scope:registration:id:web_ward': 'medicine',
        'scope:registration:id:web_adm_date': todayStr,
      }),
      adminId,
      adminId,
      nowMs,
      nowMs
    );

    recordMovement(app.database, {
      patientKey: p1Key,
      eventType: 'ADMISSION',
      toWardCode: 'medicine',
      eventAt: nowMs,
      details: { admissionDate: todayStr }
    });

    // Patient 2: HC Referral with HC Ambulance and Dengue Fever
    const p2Key = 'case:PAT-TEST-102';
    app.database.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, record_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      p2Key,
      JSON.stringify({
        'scope:registration:id:web_first_name': 'ចាន់',
        'scope:registration:id:web_last_name': 'ធី',
        'scope:registration:id:web_sex': 'ស្រី',
        'scope:registration:id:web_entry_type': 'HC Referral',
        'scope:registration:id:referral_transport': 'HC_AMBULANCE',
        'system:discharge': {
          dischargeDiagnosis: 'A90 - Dengue Fever',
          dischargeIcd10: 'A90'
        },
        'scope:registration:id:web_ward': 'pediatric',
        'scope:registration:id:web_adm_date': todayStr,
      }),
      adminId,
      adminId,
      nowMs,
      nowMs
    );

    recordMovement(app.database, {
      patientKey: p2Key,
      eventType: 'ADMISSION',
      toWardCode: 'pediatric',
      eventAt: nowMs,
      details: { admissionDate: todayStr }
    });

    // Request daily report
    const reportRes = await fetch(`${origin}/api/reports/daily?date=${todayStr}`, {
      headers: { cookie }
    });
    assert.equal(reportRes.status, 200);
    const data = await reportRes.json();

    assert.equal(data.date, todayStr);
    assert.ok(data.totalAdmissions >= 2, 'Admissions counted');
    assert.ok(data.hcReferrals >= 2, 'HC referrals detected');
    assert.ok(data.hcAmbulance >= 1, 'HC ambulance detected');
    assert.ok(data.rhAmbulance >= 1, 'RH ambulance detected');
    assert.ok(typeof data.internalTransfers === 'number');
    assert.ok(typeof data.externalProvincialTransfers === 'number');
    assert.ok(typeof data.ambulanceReferralIncome === 'object' && typeof data.ambulanceReferralIncome.KHR === 'number');

    // Verify analytics
    assert.ok(data.analytics, 'Analytics object present');
    assert.ok(Array.isArray(data.analytics.topDiagnoses), 'topDiagnoses is an array');
    assert.ok(data.analytics.topDiagnoses.length <= 10, 'topDiagnoses at most 10');
    assert.ok(data.analytics.topDiagnoses.some(d => d.diagnosis.includes('Gastroenteritis') || d.diagnosis.includes('Dengue')), 'Diagnoses extracted');
    assert.ok(Array.isArray(data.analytics.wardDistribution), 'wardDistribution present');
    assert.ok(data.analytics.paymentDistribution, 'paymentDistribution present');
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});
