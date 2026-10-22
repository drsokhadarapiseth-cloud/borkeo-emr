import crypto from 'node:crypto';
import { ROLES, listAllWards, setUserAccess, IMAGING_SUBTYPES } from './access.mjs';
import { setESignature } from './esign.mjs';

export const SUPERUSER_USERNAME = 'Superuser';
export const SUPERUSER_PASSWORD = '1234';

function superuserPasswordHash() {
  const N = 32768;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(SUPERUSER_PASSWORD, salt, 64, {
    N, r, p, maxmem: 128 * 1024 * 1024,
  });
  return ['scrypt', N, r, p, salt.toString('base64url'), derived.toString('base64url')].join('$');
}

export function ensureSuperuser(database, now = Date.now()) {
  const existing = database.findUser(SUPERUSER_USERNAME);
  const passwordHash = superuserPasswordHash();
  // v42.1: the Superuser is a "switch user type" account. It holds every real
  // staff role and every ward (so it can switch to any user type), but never
  // the SUPERUSER role itself: setUserAccess replaces the account's rows, so an
  // old SUPERUSER row in user_roles is removed here.
  const allRoles = [...ROLES];
  const allWardCodes = listAllWards(database).map(w => w.code);
  let userId;

  if (existing) {
    userId = existing.id;
    database.sqlite.prepare(`
      UPDATE users
      SET password_hash = ?, is_active = 1, must_change_password = 0, updated_at = ?
      WHERE id = ?
    `).run(passwordHash, now, userId);
  } else {
    userId = crypto.randomUUID();
    database.createUser({
      id: userId,
      username: SUPERUSER_USERNAME,
      displayName: SUPERUSER_USERNAME,
      role: 'ADMIN',
      passwordHash,
      createdAt: now,
    });
  }

  setUserAccess(database, userId, allRoles, allWardCodes, now, IMAGING_SUBTYPES);
  try {
    setESignature(database, userId, { signerName: SUPERUSER_USERNAME }, userId, now);
  } catch {}

  try {
    database.audit({
      id: crypto.randomUUID(),
      userId,
      subjectUsername: SUPERUSER_USERNAME,
      action: 'SUPERUSER_ENSURED',
      details: { username: SUPERUSER_USERNAME, roles: allRoles.length, wards: allWardCodes.length },
      occurredAt: now,
    });
  } catch {}

  return userId;
}
