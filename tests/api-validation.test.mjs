import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { v, validate, assertValid, Schemas } from '../server/validation.mjs';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

test('Validator engine: v.string constraints', () => {
  const schema = v.string({ min: 3, max: 10, trim: true, nonEmpty: true });

  assert.equal(validate('hello', schema).valid, true);
  assert.equal(validate('   hello   ', schema).value, 'hello');

  assert.equal(validate('', schema).valid, false);
  assert.equal(validate('hi', schema).valid, false);
  assert.equal(validate('this is way too long', schema).valid, false);
  assert.equal(validate(12345, schema).valid, false);
  assert.equal(validate(null, schema).valid, false);
});

test('Validator engine: v.number constraints', () => {
  const schema = v.number({ min: 1, max: 100, integer: true });

  assert.equal(validate(50, schema).valid, true);
  assert.equal(validate(1, schema).valid, true);
  assert.equal(validate(100, schema).valid, true);

  assert.equal(validate(0, schema).valid, false);
  assert.equal(validate(101, schema).valid, false);
  assert.equal(validate(50.5, schema).valid, false);
  assert.equal(validate(NaN, schema).valid, false);
  assert.equal(validate(Infinity, schema).valid, false);
  assert.equal(validate('50', schema).valid, false);
});

test('Validator engine: v.enum constraints', () => {
  const schema = v.enum(['KHR', 'USD']);

  assert.equal(validate('KHR', schema).valid, true);
  assert.equal(validate('USD', schema).valid, true);
  assert.equal(validate('EUR', schema).valid, false);
  assert.equal(validate('', schema).valid, false);
});

test('Validator engine: v.object constraints and strict rejection of unexpected fields', () => {
  const schema = v.object({
    name: v.string({ min: 1 }),
    age: v.optional(v.number({ min: 0 })),
  }, { allowUnknown: false });

  assert.equal(validate({ name: 'Alice', age: 30 }, schema).valid, true);
  assert.equal(validate({ name: 'Bob' }, schema).valid, true);

  // Unknown field rejected
  const unknownRes = validate({ name: 'Charlie', evilPayload: 'injection' }, schema);
  assert.equal(unknownRes.valid, false);
  assert.match(unknownRes.error, /evilPayload is not an allowed field/);

  // Missing required field
  const missingRes = validate({}, schema);
  assert.equal(missingRes.valid, false);
});

test('Validator engine: assertValid throws 400 ValidationError with details', () => {
  const schema = v.object({
    code: v.string({ min: 3 }),
  });

  assert.throws(
    () => assertValid({ code: 'a' }, schema),
    (err) => err.status === 400 && Array.isArray(err.details) && err.details.length > 0
  );
});

test('HTTP API: Login validation rejects malformed bodies with 400 Bad Request', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-val-login-'));
  const dbPath = path.join(tempDir, 'val-login.sqlite');

  const app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33861,
    appOrigin: 'http://127.0.0.1:33861',
    databasePath: dbPath,
    nodeEnv: 'test',
  });

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33861, '127.0.0.1', resolve);
  });

  try {
    // 1. Missing username
    const res1 = await fetch('http://127.0.0.1:33861/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:33861' },
      body: JSON.stringify({ password: 'somePassword123!' }),
    });
    assert.equal(res1.status, 400);
    const json1 = await res1.json();
    assert.match(json1.error, /Login information is invalid/);

    // 2. Username too short (< 3 chars)
    const res2 = await fetch('http://127.0.0.1:33861/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:33861' },
      body: JSON.stringify({ username: 'ab', password: 'somePassword123!' }),
    });
    assert.equal(res2.status, 400);

    // 3. Username empty
    const res3 = await fetch('http://127.0.0.1:33861/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:33861' },
      body: JSON.stringify({ username: '   ', password: 'somePassword123!' }),
    });
    assert.equal(res3.status, 400);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    if (app.database?.close) app.database.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

test('HTTP API: Finance expense and void endpoints reject invalid input with 400 Bad Request', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-val-finance-'));
  const dbPath = path.join(tempDir, 'val-finance.sqlite');

  const app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33862,
    appOrigin: 'http://127.0.0.1:33862',
    databasePath: dbPath,
    nodeEnv: 'test',
  });

  const accountantId = crypto.randomUUID();
  app.database.createUser({
    id: accountantId,
    username: 'accountant.test',
    displayName: 'Test Accountant',
    role: 'ACCOUNTANT',
    passwordHash: await hashPassword('AccountantPass2026!'),
    createdAt: Date.now(),
  });
  setUserAccess(app.database, accountantId, ['ACCOUNTANT'], []);

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33862, '127.0.0.1', resolve);
  });

  try {
    // Login to get session
    const loginRes = await fetch('http://127.0.0.1:33862/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:33862' },
      body: JSON.stringify({ username: 'accountant.test', password: 'AccountantPass2026!' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];
    const meRes = await fetch('http://127.0.0.1:33862/api/auth/me', { headers: { Cookie: cookie } });
    const me = await meRes.json();
    const csrfToken = me.csrfToken;

    // Set working context to ACCOUNTANT
    const contextRes = await fetch('http://127.0.0.1:33862/api/auth/context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33862',
      },
      body: JSON.stringify({ role: 'ACCOUNTANT' }),
    });
    assert.equal(contextRes.status, 200);

    // 1. Post expense with invalid currency (EUR)
    const resBadCurrency = await fetch('http://127.0.0.1:33862/api/finance/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33862',
      },
      body: JSON.stringify({
        category: 'Office Supplies',
        description: 'Printer paper',
        amount: 25,
        currency: 'EUR',
      }),
    });
    assert.equal(resBadCurrency.status, 400);
    const jsonBadCurrency = await resBadCurrency.json();
    assert.ok(jsonBadCurrency.error);

    // 2. Post expense with negative amount
    const resBadAmount = await fetch('http://127.0.0.1:33862/api/finance/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33862',
      },
      body: JSON.stringify({
        category: 'Office Supplies',
        description: 'Printer paper',
        amount: -50,
        currency: 'KHR',
      }),
    });
    assert.equal(resBadAmount.status, 400);

    // 3. Post valid expense -> succeeds 201
    const resValidExpense = await fetch('http://127.0.0.1:33862/api/finance/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33862',
      },
      body: JSON.stringify({
        category: 'Office Supplies',
        description: 'Printer paper',
        amount: 20000,
        currency: 'KHR',
      }),
    });
    assert.equal(resValidExpense.status, 201);
    const validData = await resValidExpense.json();
    assert.equal(validData.expense.category, 'Office Supplies');

    // 4. Void item with invalid kind
    const resBadVoid = await fetch('http://127.0.0.1:33862/api/finance/void', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33862',
      },
      body: JSON.stringify({
        kind: 'unsupported_kind',
        id: validData.expense.id,
        reason: 'Correction',
      }),
    });
    assert.equal(resBadVoid.status, 400);

    // 5. Void item with empty reason
    const resEmptyReason = await fetch('http://127.0.0.1:33862/api/finance/void', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33862',
      },
      body: JSON.stringify({
        kind: 'expense',
        id: validData.expense.id,
        reason: '   ',
      }),
    });
    assert.equal(resEmptyReason.status, 400);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    if (app.database?.close) app.database.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

test('HTTP API: Admin roles and wards reject invalid schemas with 400 Bad Request', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-val-admin-'));
  const dbPath = path.join(tempDir, 'val-admin.sqlite');

  const app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33863,
    appOrigin: 'http://127.0.0.1:33863',
    databasePath: dbPath,
    nodeEnv: 'test',
  });

  const adminId = crypto.randomUUID();
  app.database.createUser({
    id: adminId,
    username: 'admin.val',
    displayName: 'Test Admin',
    role: 'ADMIN',
    passwordHash: await hashPassword('AdminSecretPass2026!'),
    createdAt: Date.now(),
  });
  setUserAccess(app.database, adminId, ['ADMIN'], []);

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33863, '127.0.0.1', resolve);
  });

  try {
    const loginRes = await fetch('http://127.0.0.1:33863/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:33863' },
      body: JSON.stringify({ username: 'admin.val', password: 'AdminSecretPass2026!' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch('http://127.0.0.1:33863/api/auth/me', { headers: { Cookie: cookie } })).json();
    const csrfToken = me.csrfToken;

    // 1. Role with invalid code (< 2 chars)
    const resBadRole = await fetch('http://127.0.0.1:33863/api/admin/roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33863',
      },
      body: JSON.stringify({ code: 'X', labelKh: 'តេស្ត' }),
    });
    assert.equal(resBadRole.status, 400);

    // 2. Role with empty labelKh
    const resEmptyLabel = await fetch('http://127.0.0.1:33863/api/admin/roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33863',
      },
      body: JSON.stringify({ code: 'NURSE_SPECIALIST', labelKh: '   ' }),
    });
    assert.equal(resEmptyLabel.status, 400);

    // 3. Valid role succeeds (201)
    const resValidRole = await fetch('http://127.0.0.1:33863/api/admin/roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33863',
      },
      body: JSON.stringify({ code: 'PHYSIO', labelKh: 'ចលនាព្យាបាល', labelEn: 'Physiotherapist' }),
    });
    assert.equal(resValidRole.status, 201);

    // 4. Ward with invalid code (< 2 chars)
    const resBadWard = await fetch('http://127.0.0.1:33863/api/admin/wards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33863',
      },
      body: JSON.stringify({ code: 'W', nameKh: 'វួដតេស្ត' }),
    });
    assert.equal(resBadWard.status, 400);

    // 5. Ward with empty nameKh
    const resEmptyWardName = await fetch('http://127.0.0.1:33863/api/admin/wards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33863',
      },
      body: JSON.stringify({ code: 'dialysis', nameKh: '   ' }),
    });
    assert.equal(resEmptyWardName.status, 400);

    // 6. Valid ward succeeds (201)
    const resValidWard = await fetch('http://127.0.0.1:33863/api/admin/wards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://127.0.0.1:33863',
      },
      body: JSON.stringify({ code: 'dialysis', nameKh: 'ផ្នែកលាងឈាម', nameEn: 'Hemodialysis Unit' }),
    });
    assert.equal(resValidWard.status, 201);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    if (app.database?.close) app.database.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

