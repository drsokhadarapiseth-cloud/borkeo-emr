import crypto from 'node:crypto';
import { WARDS, setUserAccess } from './access.mjs';
import { setESignature } from './esign.mjs';

export const DEFAULT_WARD_PASSWORD = '1234';

function sharedPasswordHash() {
  const N = 32768;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(DEFAULT_WARD_PASSWORD, salt, 64, {
    N, r, p, maxmem: 128 * 1024 * 1024,
  });
  return ['scrypt', N, r, p, salt.toString('base64url'), derived.toString('base64url')].join('$');
}

export function defaultWardAccountPlan() {
  const wardAccounts = WARDS.flatMap(ward => {
    const nursingRole = ward.code === 'obstetric' ? 'MIDWIFE' : 'NURSE';
    const nursingTitle = ward.code === 'obstetric' ? 'គិលានុបដ្ឋាក/ឆ្មប' : 'គិលានុបដ្ឋាក';
    return [
      {
        username: `doctor_${ward.code}`,
        displayName: `វេជ្ជបណ្ឌិត - ${ward.nameKh}`,
        role: 'DOCTOR',
        wardCode: ward.code,
      },
      {
        username: `nurse_${ward.code}`,
        displayName: `${nursingTitle} - ${ward.nameKh}`,
        role: nursingRole,
        wardCode: ward.code,
      },
    ];
  });
  return [
    ...wardAccounts,
    {
      username: 'nurse_triage',
      displayName: 'គិលានុបដ្ឋាក - ផ្នែកទ្រីយ៉ា',
      role: 'TRIAGE',
      wardCode: '',
    },
  ];
}

export function ensureDefaultWardUsers(database, now = Date.now()) {
  const plan = defaultWardAccountPlan();
  const missing = plan.filter(account => !database.findUser(account.username));
  if (!missing.length) return { created: [], existing: plan.map(item => item.username) };

  // All requested default ward accounts intentionally begin with the same
  // temporary password. Staff can change their own password after login.
  const passwordHash = sharedPasswordHash();
  const created = [];

  for (const account of missing) {
    const id = crypto.randomUUID();
    database.createUser({
      id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      passwordHash,
      createdAt: now,
    });
    setUserAccess(database, id, [account.role], account.wardCode ? [account.wardCode] : [], now);
    try {
      setESignature(database, id, { signerName: account.displayName }, id, now);
    } catch {}
    database.audit({
      id: crypto.randomUUID(),
      subjectUsername: account.username,
      action: 'DEFAULT_WARD_USER_CREATED',
      details: { role: account.role, wardCode: account.wardCode },
      occurredAt: now,
    });
    created.push(account.username);
  }

  return { created, existing: plan.filter(item => !missing.includes(item)).map(item => item.username) };
}
