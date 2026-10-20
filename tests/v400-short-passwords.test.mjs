import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { createEmrServer } from '../server/server.mjs';
import { setUserAccess } from '../server/access.mjs';
import { DEFAULT_WARD_PASSWORD } from '../server/default-ward-users.mjs';
import {
  DEFAULT_STAFF_PASSWORD, MIN_PASSWORD_LENGTH, hashPassword, validatePassword, verifyPassword,
} from '../server/password.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('v40.0 passwords need at least 4 characters and the staff default is 1234', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 4);
  assert.equal(DEFAULT_STAFF_PASSWORD, '1234');
  assert.equal(DEFAULT_WARD_PASSWORD, '1234');
  assert.equal(validatePassword('1234'), '1234');
  assert.throws(() => validatePassword('123'), /4–128/);
  assert.throws(() => validatePassword('x'.repeat(129)), /4–128/);

  // Every password box in the browser follows the same rule.
  assert.match(read('public/login.html'), /id="password"[^>]*\s+minlength="4"/);
  assert.match(read('public/login.html'), /id="password-change-next"[^>]*minlength="4"/);
  assert.match(read('public/login.js'), /MIN_PASSWORD_LENGTH = 4;/);
  assert.match(read('public/login.js'), /password\.value = '1234'/);
  assert.equal((read('public/emr-session.js').match(/minlength="4"/g) || []).length, 3);
  assert.match(read('protected/admin-users.html'), /id="password" type="password" minlength="4"/);
  assert.match(read('public/admin-users.js'), /យ៉ាងតិច 4 តួអក្សរ/);
  for (const file of ['public/login.html', 'public/login.js', 'public/emr-session.js', 'protected/admin-users.html', 'public/admin-users.js']) {
    assert.doesNotMatch(read(file), /minlength="12"|យ៉ាងតិច 12|111111111111/, `${file} still uses the old 12-character rule`);
  }
});

test('v40.0 a staff member can change to a 4-character password', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-v400-change-'));
  const port = 34000;
  const base = `http://127.0.0.1:${port}`;
  const app = createEmrServer({
    demoMode: false, host: '127.0.0.1', port, appOrigin: base,
    databasePath: path.join(dir, 'test.sqlite'), nodeEnv: 'test',
  });
  const id = crypto.randomUUID();
  app.database.createUser({
    id, username: 'nurse.short', displayName: 'Nurse', role: 'NURSE',
    passwordHash: await hashPassword('5678'), createdAt: Date.now(),
  });
  setUserAccess(app.database, id, ['NURSE'], ['medicine']);
  await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
  try {
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ username: 'nurse.short', password: '5678' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const { csrfToken } = await (await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).json();
    const change = (newPassword) => fetch(`${base}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ currentPassword: '5678', newPassword, confirmation: newPassword }),
    });
    assert.equal((await change('123')).status, 400, 'three characters are still refused');
    assert.equal((await change('1234')).status, 200);
    const again = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ username: 'nurse.short', password: '1234' }),
    });
    assert.equal(again.status, 200);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('v40.0 set-all-passwords backs up first, sets every account to 1234 and leaves patients alone', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-v400-script-'));
  const databasePath = path.join(dir, 'emr.sqlite');
  const database = openDatabase(databasePath);
  const accounts = [
    ['admin', 'ADMIN', 'AdminLongPassword2026!', false],
    ['doctor_medicine', 'DOCTOR', '111111111111', true],
    ['registration', 'REGISTRATION', 'SomethingElse2026', true],
  ];
  for (const [username, role, password, mustChangePassword] of accounts) {
    database.createUser({
      id: crypto.randomUUID(), username, displayName: username, role,
      passwordHash: await hashPassword(password), mustChangePassword, createdAt: Date.now(),
    });
  }
  const tables = database.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('users','sessions','audit_events')").all().map(row => row.name);
  const countRows = db => Object.fromEntries(tables.map(name => [name, db.sqlite.prepare(`SELECT count(*) AS c FROM "${name}"`).get().c]));
  const before = countRows(database);
  database.close();

  try {
    const result = spawnSync(process.execPath, ['scripts/set-all-passwords.mjs', '--database', databasePath, '--skip-running-check'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, EMR_MODE: '', NODE_ENV: 'test' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Backup written: .*emr-before-1234-\d{8}-\d{6}\.sqlite/);
    assert.match(result.stdout, /3 account\(s\)/);

    const backups = fs.readdirSync(path.join(dir, 'backups'));
    assert.equal(backups.length, 1);
    const backup = openDatabase(path.join(dir, 'backups', backups[0]));
    assert.equal(await verifyPassword('AdminLongPassword2026!', backup.findUser('admin').password_hash), true, 'backup keeps the old passwords');
    backup.close();

    const after = openDatabase(databasePath);
    for (const [username] of accounts) {
      const user = after.findUser(username);
      assert.equal(await verifyPassword('1234', user.password_hash), true, `${username} uses 1234`);
      assert.equal(user.must_change_password, 0, `${username} is not forced to change`);
    }
    assert.equal(after.sqlite.prepare("SELECT count(*) AS c FROM audit_events WHERE action='PASSWORD_SET_TO_HOSPITAL_DEFAULT'").get().c, 3);
    assert.deepEqual(countRows(after), before, 'no other table changed');
    after.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
