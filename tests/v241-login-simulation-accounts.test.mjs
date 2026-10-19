import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';


test('v24.1 /api/auth/config returns dynamic simulation accounts in demo mode and updates on user creation', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  try {
    const res = await fetch(`${origin}/api/auth/config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.demoMode, true);
    assert.ok(Array.isArray(data.accounts));
    assert.ok(data.accounts.some(a => a.username === 'admin'));
    assert.ok(data.accounts.some(a => a.username === 'registration'));

    // Create a new custom user
    const newUsername = 'new_nurse_' + Date.now();
    app.database.createUser({
      id: crypto.randomUUID(),
      username: newUsername,
      displayName: 'គិលានុបដ្ឋាកថ្មី',
      role: 'NURSE',
      passwordHash: 'dummy',
      createdAt: Date.now(),
    });

    const res2 = await fetch(`${origin}/api/auth/config`);
    const data2 = await res2.json();
    assert.ok(data2.accounts.some(a => a.username === newUsername), 'new user is returned dynamically in accounts list');
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('v24.1 / v24.5 login UI templates ensure demo accounts card is removed as requested by user', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.ok(!html.includes('id="demo-accounts-card"'), 'demo-accounts-card has been removed from login.html');
});

