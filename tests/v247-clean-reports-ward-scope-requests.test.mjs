import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';


test('v24.7 home.html and home.js remove English annotations from report cards, titles, and legends', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/home.html'), 'utf8');
  assert.ok(!html.includes('(Patient Analytics)'), 'Patient Analytics annotation removed');
  assert.ok(!html.includes('(Top 10 Diagnoses)'), 'Top 10 Diagnoses annotation removed');
  assert.ok(!html.includes('(Ward Distribution)'), 'Ward Distribution annotation removed');
  assert.ok(!html.includes('(Demographics)'), 'Demographics annotation removed');

  const js = fs.readFileSync(path.join(process.cwd(), 'public/home.js'), 'utf8');
  assert.ok(!js.includes('Total Admissions'), 'Total Admissions subtitle removed');
  assert.ok(!js.includes('Internal Transfers'), 'Internal Transfers subtitle removed');
  assert.ok(!js.includes('HC Referrals'), 'HC Referrals subtitle removed');
  assert.ok(!js.includes('Ambulance Income'), 'Ambulance Income subtitle removed');
  assert.ok(!js.includes('(Male)'), 'Male translation annotation removed');
  assert.ok(!js.includes('(Female)'), 'Female translation annotation removed');
});

test('v24.7 emr-session.js and navigation-settings.mjs remove requests button for non-management accounts', () => {
  const sessionJs = fs.readFileSync(path.join(process.cwd(), 'public/emr-session.js'), 'utf8');
  const navSettings = fs.readFileSync(path.join(process.cwd(), 'server/navigation-settings.mjs'), 'utf8');

  // Both should only permit management accounts
  assert.ok(sessionJs.includes("if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role))links.push(['/requests','ការស្នើរសុំ']);"));
  assert.ok(navSettings.includes("if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role))links.push(['/requests','ការស្នើរសុំ']);"));
});

test('v24.7 daily report is scoped to active ward for ward staff and hospital-wide for management', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  try {
    const adminUser = app.database.sqlite.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    const adminId = adminUser?.id || crypto.randomUUID();
    const nowMs = Date.now();
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Patient in Medicine ward
    app.database.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, record_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'case:PAT-MED-1',
      JSON.stringify({
        'scope:registration:id:web_first_name': 'សុខ',
        'scope:registration:id:web_last_name': 'មាន',
        'system:currentWardCode': 'medicine',
        'system:discharge': {
          dischargeDiagnosis: 'Acute Gastroenteritis',
          dischargeIcd10: 'A09'
        }
      }),
      adminId,
      adminId,
      nowMs,
      nowMs
    );

    // Patient in Surgery ward
    app.database.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, record_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'case:PAT-SURG-1',
      JSON.stringify({
        'scope:registration:id:web_first_name': 'ចាន់',
        'scope:registration:id:web_last_name': 'ធី',
        'system:currentWardCode': 'surgery',
        'system:discharge': {
          dischargeDiagnosis: 'Appendicitis',
          dischargeIcd10: 'K35'
        }
      }),
      adminId,
      adminId,
      nowMs,
      nowMs
    );

    // Movement: Medicine admission
    app.database.sqlite.prepare(`
      INSERT INTO patient_movement_events (id, patient_key, event_type, from_ward_code, to_ward_code, from_department_code, to_department_code, event_at, created_by, details_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'case:PAT-MED-1',
      'ADMISSION',
      '',
      'medicine',
      '',
      'medicine',
      nowMs,
      adminId,
      JSON.stringify({ admissionDate: todayStr })
    );

    // Movement: Surgery admission
    app.database.sqlite.prepare(`
      INSERT INTO patient_movement_events (id, patient_key, event_type, from_ward_code, to_ward_code, from_department_code, to_department_code, event_at, created_by, details_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'case:PAT-SURG-1',
      'ADMISSION',
      '',
      'surgery',
      '',
      'surgery',
      nowMs,
      adminId,
      JSON.stringify({ admissionDate: todayStr })
    );

    // 1. Admin login (Management) -> Sees 2 total admissions across all wards
    const adminLogin = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' })
    });
    const adminCookie = adminLogin.headers.get('set-cookie');

    const adminReportRes = await fetch(`${origin}/api/reports/daily?date=${todayStr}`, {
      headers: { cookie: adminCookie }
    });
    assert.equal(adminReportRes.status, 200);
    const adminReport = await adminReportRes.json();
    assert.equal(adminReport.totalAdmissions, 2, 'Admin receives all admissions');
    assert.equal(adminReport.analytics.topDiagnoses.length, 2, 'Admin sees all diagnoses');

    // 2. Doctor Medicine login -> Sees only 1 admission and 1 diagnosis (medicine)
    const docLogin = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'doctor_medicine' })
    });
    const docCookie = docLogin.headers.get('set-cookie');

    const docReportRes = await fetch(`${origin}/api/reports/daily?date=${todayStr}`, {
      headers: { cookie: docCookie }
    });
    assert.equal(docReportRes.status, 200);
    const docReport = await docReportRes.json();
    assert.equal(docReport.wardCode, 'medicine', 'Ward code is scoped');
    assert.equal(docReport.totalAdmissions, 1, 'Doctor medicine sees only medicine admissions');
    assert.equal(docReport.analytics.topDiagnoses.length, 1, 'Doctor medicine sees only medicine diagnoses');
    assert.equal(docReport.analytics.topDiagnoses[0].icd10, 'A09');
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});
