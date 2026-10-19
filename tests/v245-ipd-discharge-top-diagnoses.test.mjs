import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';


test('v24.5 login page does not contain demo accounts card', () => {
  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.ok(!loginHtml.includes('id="demo-accounts-card"'));
  assert.ok(!loginHtml.includes('demo-accounts-list'));
  assert.ok(!loginHtml.includes('demo-accounts-chips'));
});

test('v24.5 /api/reports/daily hospitalAnalytics counts Top 10 diagnoses strictly from IPD discharge records', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  try {
    // Login as admin to get cookie
    const loginRes = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' })
    });
    const cookie = loginRes.headers.get('set-cookie');
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Check initial state (empty database, should return empty array, NOT fallback fake diagnoses)
    const emptyRes = await fetch(`${origin}/api/reports/daily?date=${todayStr}`, {
      headers: { cookie }
    });
    assert.equal(emptyRes.status, 200);
    const emptyData = await emptyRes.json();
    assert.ok(emptyData.analytics);
    assert.deepEqual(emptyData.analytics.topDiagnoses, [], 'Empty DB must return empty diagnoses array without fallback mocks');

    const adminUser = app.database.sqlite.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    const adminId = adminUser?.id || crypto.randomUUID();
    const nowMs = Date.now();

    // p1: Discharged with Acute Appendicitis (K35)
    app.database.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, record_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'case:PAT-TEST-201',
      JSON.stringify({
        'scope:registration:id:web_first_name': 'សុខ',
        'scope:registration:id:web_last_name': 'គង់',
        'system:discharge': {
          dischargeDiagnosis: 'Acute Appendicitis',
          dischargeIcd10: 'K35'
        }
      }),
      adminId,
      adminId,
      nowMs,
      nowMs
    );

    // p2: Discharged with Acute Appendicitis (K35.8) in system:discharge
    app.database.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, record_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'case:PAT-TEST-202',
      JSON.stringify({
        'scope:registration:id:web_first_name': 'ចាន់',
        'scope:registration:id:web_last_name': 'ថន',
        'system:discharge': {
          dischargeDiagnosis: 'K35 - Acute Appendicitis',
          dischargeIcd10: ''
        }
      }),
      adminId,
      adminId,
      nowMs,
      nowMs
    );

    // p3: Discharged with Gastroenteritis (A09) in system:ipdDischargeSummary
    app.database.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, record_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'case:PAT-TEST-203',
      JSON.stringify({
        'scope:registration:id:web_first_name': 'សេង',
        'scope:registration:id:web_last_name': 'ហុង',
        'system:ipdDischargeSummary': {
          discharge: {
            diagnosis: 'Gastroenteritis and colitis of unspecified origin',
            icd10: 'A09'
          }
        }
      }),
      adminId,
      adminId,
      nowMs,
      nowMs
    );

    // Fetch reports
    const repRes = await fetch(`${origin}/api/reports/daily?date=${todayStr}`, {
      headers: { cookie }
    });
    assert.equal(repRes.status, 200);
    const repData = await repRes.json();

    assert.ok(repData.analytics.topDiagnoses.length === 2, 'Should have exactly 2 distinct diagnoses');
    
    // Top diagnosis should be Acute Appendicitis with count 2
    const top1 = repData.analytics.topDiagnoses[0];
    assert.equal(top1.count, 2);
    assert.match(top1.diagnosis, /Appendicitis/i);

    // Second diagnosis should be Gastroenteritis with count 1
    const top2 = repData.analytics.topDiagnoses[1];
    assert.equal(top2.count, 1);
    assert.equal(top2.icd10, 'A09');
    assert.match(top2.diagnosis, /Gastroenteritis/i);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});
