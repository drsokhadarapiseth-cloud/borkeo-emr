import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema, getUserAccess, WARDS } from '../server/access.mjs';
import { DEFAULT_WARD_PASSWORD, defaultWardAccountPlan, ensureDefaultWardUsers } from '../server/default-ward-users.mjs';
import { verifyPassword } from '../server/password.mjs';

test('default doctor and nursing account are generated for every ward', async () => {
  const database = openDatabase(':memory:');
  try {
    ensureAccessSchema(database);
    const first = ensureDefaultWardUsers(database, 1700000000000);
    assert.equal(first.created.length, WARDS.length * 2 + 1);
    const plan = defaultWardAccountPlan();
    assert.equal(plan.length, WARDS.length * 2 + 1);

    for (const account of plan) {
      const user = database.findUser(account.username);
      assert.ok(user, account.username);
      assert.equal(await verifyPassword(DEFAULT_WARD_PASSWORD, user.password_hash), true);
      const access = getUserAccess(database, user.id);
      assert.deepEqual(access.wards, account.wardCode ? [account.wardCode] : []);
      assert.deepEqual(access.roles, [account.role]);
    }

    const second = ensureDefaultWardUsers(database, 1700000001000);
    assert.equal(second.created.length, 0);
    const count = database.sqlite.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    assert.equal(count, WARDS.length * 2 + 1);
  } finally {
    database.close();
  }
});
