import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../server/database.mjs';
import { checkDatabaseIntegrity, createDatabaseBackup, pruneBackups } from '../server/backup.mjs';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

test('Database integrity check: verifies schema, indexes, and foreign keys', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-db-integrity-'));
  const dbPath = path.join(tempDir, 'test-integrity.sqlite');

  const database = openDatabase(dbPath);
  try {
    const result = checkDatabaseIntegrity(database);
    assert.equal(result.ok, true, 'Integrity check on clean database must pass');
    assert.equal(result.errors.length, 0);

    const dbResult = database.checkIntegrity();
    assert.equal(dbResult.ok, true);
  } finally {
    database.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

test('Database backup: creates online consistent snapshot with VACUUM INTO and zero data loss', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-db-backup-'));
  const dbPath = path.join(tempDir, 'source.sqlite');
  const backupDir = path.join(tempDir, 'backups');

  const database = openDatabase(dbPath);

  // Seed sample patient and user data
  const userId = crypto.randomUUID();
  database.createUser({
    id: userId,
    username: 'doctor.backup',
    displayName: 'Dr. Backup',
    role: 'DOCTOR',
    passwordHash: 'scrypt$32768$8$1$dummy',
    createdAt: Date.now(),
  });

  database.upsertPatient({
    id: crypto.randomUUID(),
    patientKey: 'case:BK-2026-001',
    summary: {
      caseNumber: 'BK-2026-001',
      healthId: 'HC-BK-001',
      firstName: 'Sok',
      lastName: 'Dara',
      fullName: 'Dara Sok',
      sex: 'ប្រុស',
      age: '35',
      dateOfBirth: '1991-05-10',
      phone: '012345678',
      equityCard: '',
      paymentType: 'CASH',
      departmentCode: 'medicine',
      departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
      departmentNameEn: 'Internal Medicine',
      serviceMode: 'opd',
      entryDate: '2026-10-19',
      dischargeDate: '',
    },
    data: { 'scope:triage:id:chief_complaint': 'Fever for 3 days' },
    userId,
    savedAt: Date.now(),
  });

  try {
    // Perform backup
    const result = createDatabaseBackup(database, {
      backupDirectory: backupDir,
      filename: 'test-backup.sqlite',
    });

    assert.equal(result.ok, true);
    assert.ok(fs.existsSync(result.filepath));
    assert.ok(result.sizeBytes > 0);

    // Open backup database directly and verify zero data loss
    const restoredDb = new DatabaseSync(result.filepath);
    try {
      const integrity = checkDatabaseIntegrity(restoredDb);
      assert.equal(integrity.ok, true, 'Restored database must pass integrity check');

      const restoredUser = restoredDb.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      assert.ok(restoredUser);
      assert.equal(restoredUser.username, 'doctor.backup');

      const restoredPatient = restoredDb.prepare('SELECT * FROM patient_records WHERE patient_key = ?').get('case:BK-2026-001');
      assert.ok(restoredPatient);
      assert.equal(restoredPatient.full_name, 'Dara Sok');
      assert.equal(restoredPatient.case_number, 'BK-2026-001');

      const data = JSON.parse(restoredPatient.record_json);
      assert.equal(data['scope:triage:id:chief_complaint'], 'Fever for 3 days');
    } finally {
      restoredDb.close();
    }
  } finally {
    database.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

test('Database backup: pruning keeps specified number of recent backups', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-db-prune-'));
  const backupDir = path.join(tempDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  // Create 6 dummy backup files
  for (let i = 1; i <= 6; i++) {
    const fPath = path.join(backupDir, `borkeo-emr-backup-2026-10-19T10-0${i}-00.sqlite`);
    fs.writeFileSync(fPath, `dummy sqlite content ${i}`);
  }

  assert.equal(fs.readdirSync(backupDir).length, 6);

  // Prune to keep 3
  const pruned = pruneBackups(backupDir, 3);
  assert.equal(pruned, 3);

  const remaining = fs.readdirSync(backupDir);
  assert.equal(remaining.length, 3);

  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('HTTP API: /api/admin/backup allows authorized administrators and creates snapshot', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-api-backup-'));
  const dbPath = path.join(tempDir, 'api-backup.sqlite');

  const app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33881,
    appOrigin: 'http://127.0.0.1:33881',
    databasePath: dbPath,
    dataDirectory: tempDir,
    nodeEnv: 'test',
  });

  const adminId = crypto.randomUUID();
  app.database.createUser({
    id: adminId,
    username: 'admin.backup',
    displayName: 'Admin Backup Test',
    role: 'ADMIN',
    passwordHash: await hashPassword('AdminPass2026!'),
    createdAt: Date.now(),
  });
  setUserAccess(app.database, adminId, ['ADMIN'], []);

  const nurseId = crypto.randomUUID();
  app.database.createUser({
    id: nurseId,
    username: 'nurse.backup',
    displayName: 'Nurse Backup Test',
    role: 'NURSE',
    passwordHash: await hashPassword('NursePass2026!'),
    createdAt: Date.now(),
  });
  setUserAccess(app.database, nurseId, ['NURSE'], ['medicine']);

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33881, '127.0.0.1', resolve);
  });

  try {
    // 1. Nurse cannot trigger backup (403)
    const nurseLogin = await fetch('http://127.0.0.1:33881/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:33881' },
      body: JSON.stringify({ username: 'nurse.backup', password: 'NursePass2026!' }),
    });
    assert.equal(nurseLogin.status, 200);
    const nurseCookie = nurseLogin.headers.get('set-cookie').split(';')[0];
    const nurseMe = await (await fetch('http://127.0.0.1:33881/api/auth/me', { headers: { Cookie: nurseCookie } })).json();

    const nurseBackupRes = await fetch('http://127.0.0.1:33881/api/admin/backup', {
      method: 'POST',
      headers: {
        'Cookie': nurseCookie,
        'X-CSRF-Token': nurseMe.csrfToken,
        'Origin': 'http://127.0.0.1:33881',
      },
    });
    assert.equal(nurseBackupRes.status, 403);

    // 2. Admin can trigger backup (201)
    const adminLogin = await fetch('http://127.0.0.1:33881/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:33881' },
      body: JSON.stringify({ username: 'admin.backup', password: 'AdminPass2026!' }),
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.headers.get('set-cookie').split(';')[0];
    const adminMe = await (await fetch('http://127.0.0.1:33881/api/auth/me', { headers: { Cookie: adminCookie } })).json();

    const adminBackupRes = await fetch('http://127.0.0.1:33881/api/admin/backup', {
      method: 'POST',
      headers: {
        'Cookie': adminCookie,
        'X-CSRF-Token': adminMe.csrfToken,
        'Origin': 'http://127.0.0.1:33881',
      },
    });
    assert.equal(adminBackupRes.status, 201);
    const backupJson = await adminBackupRes.json();
    assert.equal(backupJson.ok, true);
    assert.ok(backupJson.filename);
    assert.ok(backupJson.sizeBytes > 0);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    if (app.database?.close) app.database.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});
