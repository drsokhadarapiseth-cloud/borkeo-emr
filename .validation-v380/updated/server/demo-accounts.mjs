import crypto from 'node:crypto';
import { ROLES, WARDS, setUserAccess } from './access.mjs';
import { defaultWardAccountPlan } from './default-ward-users.mjs';
import { setESignature, getESignature } from './esign.mjs';

const DEMO_ROLES = [
  ['admin', 'អ្នកគ្រប់គ្រងសាកល្បង', 'ADMIN'],
  ['registration', 'បុគ្គលិកចុះឈ្មោះសាកល្បង', 'REGISTRATION'],
  ['triage', 'បុគ្គលិកតម្រៀបអ្នកជំងឺសាកល្បង', 'TRIAGE'],
  ['pharmacy', 'ឱសថស្ថានសាកល្បង', 'PHARMACY'],
  ['lab', 'មន្ទីរពិសោធន៍សាកល្បង', 'LAB'],
  ['imaging', 'រូបភាពវេជ្ជសាស្ត្រសាកល្បង', 'IMAGING'],
  ['accountant', 'គណនេយ្យសាកល្បង', 'ACCOUNTANT'],
  ['clerk', 'បេឡាសាកល្បង', 'CLERK'],
  ['vice_director', 'អនុប្រធានមន្ទីរពេទ្យ', 'VICE_DIRECTOR'],
  ['director', 'នាយកសាកល្បង', 'DIRECTOR'],
].map(([username, displayName, role]) => ({ username, displayName, role, wardCode: '' }));

// Passwords cannot authenticate in demo mode. Keep a non-password placeholder
// for compatibility with the existing NOT NULL column and old account tools.
export function disabledDemoPasswordHash() {
  return `demo-disabled$${crypto.randomBytes(32).toString('hex')}`;
}

export function ensureDemoAccounts(database, now = Date.now()) {
  const created = [];
  for (const account of [...DEMO_ROLES, ...defaultWardAccountPlan()]) {
    const existing = database.findUser(account.username);
    // Upgrade the demo administrator even when an older demo database is
    // copied forward. Other user assignments remain untouched.
    if (existing) {
      if(account.username==='vice_director')database.sqlite.prepare('UPDATE users SET display_name=? WHERE id=?').run('អនុប្រធានមន្ទីរពេទ្យ',existing.id);
      if (account.username === 'admin') setUserAccess(database, existing.id, ROLES, WARDS.map(ward => ward.code), now);
      if (!getESignature(database, existing.id)?.hasSignature) {
        setESignature(database, existing.id, { signerName: existing.display_name }, existing.id, now);
      }
      continue;
    }
    const id = crypto.randomUUID();
    database.createUser({
      id, username: account.username, displayName: account.displayName,
      role: account.role, passwordHash: disabledDemoPasswordHash(), createdAt: now,
    });
    setUserAccess(database, id, account.username === 'admin' ? ROLES : [account.role],
      account.username === 'admin' ? WARDS.map(ward => ward.code) : account.wardCode ? [account.wardCode] : [], now);
    setESignature(database, id, { signerName: account.displayName }, id, now);
    created.push(account.username);
  }
  return created;
}
