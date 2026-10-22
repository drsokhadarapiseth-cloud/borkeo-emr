import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDatabase } from '../server/database.mjs';
import { ensureSuperuser } from '../server/superuser.mjs';
import { verifyPassword } from '../server/password.mjs';
import { ROLES, WARDS, buildIdentity, getUserAccess, roleCanPage, ensureAccessSchema, isSuperuser, canAccessPatient } from '../server/access.mjs';
import { listStaffMessages, canViewStaffMessage, createStaffMessage, ensureMessagingSchema } from '../server/messages.mjs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// v42.1: the Superuser is a "switch user type" account. It holds every real
// staff role and ward, but never grants anything by itself.
test('v42.1 Superuser account: password, every real role and ward, no SUPERUSER role', async () => {
  const database = openDatabase(':memory:');
  ensureAccessSchema(database);
  // An account from v42.0 still has the old SUPERUSER row; it is removed.
  const userId = ensureSuperuser(database);
  database.sqlite.prepare('INSERT OR IGNORE INTO user_roles (user_id, role, created_at) VALUES (?, ?, ?)').run(userId, 'SUPERUSER', Date.now());
  assert.equal(ensureSuperuser(database), userId);

  const user = database.findUser('Superuser');
  assert.equal(user.is_active, 1);
  assert.equal(user.must_change_password, 0);
  assert.equal(await verifyPassword('1234', user.password_hash), true);

  const access = getUserAccess(database, userId);
  assert.deepEqual([...access.roles].sort(), [...ROLES].sort());
  assert.equal(access.roles.includes('SUPERUSER'), false);
  assert.equal(ROLES.length, 15);
  assert.deepEqual([...access.wards].sort(), WARDS.map(w => w.code).sort());
  database.close();
});

test('v42.1 isSuperuser only identifies the account; SUPERUSER is not a role', () => {
  const database = openDatabase(':memory:');
  ensureAccessSchema(database);
  const userId = ensureSuperuser(database);
  assert.equal(isSuperuser({ username: 'Superuser' }), true);
  assert.equal(isSuperuser({ username: 'doctor', active_role: 'SUPERUSER' }), false);
  assert.equal(isSuperuser({ username: 'doctor', isSuperuser: true }), false);

  for (const page of ['/emr', '/patient-list', '/lab', '/billing', '/finance', '/admin/users']) {
    assert.equal(roleCanPage('SUPERUSER', page), false, page);
  }
  // Without a chosen user type the account can open no patient.
  const patient = { department_code: 'surgery', service_mode: 'ipd', record_json: '{}' };
  assert.equal(canAccessPatient(database, { user_id: userId, username: 'Superuser', active_role: null }, patient), false);

  // An old session saved with active_role SUPERUSER means "no role chosen".
  const identity = buildIdentity(database, { user_id: userId, username: 'Superuser', display_name: 'Superuser', active_role: 'SUPERUSER', active_ward_code: '' });
  assert.equal(identity.isSuperuser, true);
  assert.equal(identity.activeRole, '');
  assert.equal(identity.needsContext, true);
  database.close();
});

test('v42.1 Superuser messages follow the active team, with no aggregated inbox', () => {
  const database = openDatabase(':memory:');
  ensureAccessSchema(database);
  ensureMessagingSchema(database);
  const userId = ensureSuperuser(database);
  const send = (destinationType, destinationCode = '', destinationRole = '') => createStaffMessage(database, {
    senderUserId: userId, senderRole: 'DOCTOR', senderWardCode: 'opd',
    destinationType, destinationCode, destinationRole, subject: `to ${destinationType}`, body: 'x',
  });
  send('LAB');
  send('WARD', 'obstetric', 'MIDWIFE');
  const asLab = { userId, role: 'LAB', wardCode: '', username: 'Superuser' };
  const lab = listStaffMessages(database, asLab);
  assert.deepEqual(lab.map(m => m.destinationType), ['LAB']);
  const asNone = { userId, role: '', wardCode: '', username: 'Superuser', isSuperuser: true };
  assert.equal(listStaffMessages(database, asNone).length, 0);
  const asPharmacy = { userId: 'someone-else', role: 'PHARMACY', wardCode: '', username: 'Superuser' };
  assert.equal(canViewStaffMessage(lab[0], asPharmacy), false);
  database.close();
});

test('v42.1 no Superuser permission bypass is left in server or page scripts', () => {
  const files = [
    // database.mjs keeps SUPERUSER only in the users table CHECK constraint.
    ...fs.readdirSync(new URL('../server/', import.meta.url)).filter(f => f.endsWith('.mjs') && f !== 'database.mjs').map(f => `server/${f}`),
    ...fs.readdirSync(new URL('../server/routes/', import.meta.url)).map(f => `server/routes/${f}`),
    ...fs.readdirSync(new URL('../public/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => `public/${f}`),
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /'SUPERUSER'\s*[,\]]/, `${file} lists SUPERUSER as a role`);
    assert.doesNotMatch(source, /isSuperuser\(session\)\s*(\|\||&&|\))|!isSuperuser\(session\)|identity\.isSuperuser|user\?\.isSuperuser\s*(\|\||\))/, `${file} uses the Superuser as a permission`);
  }
  assert.doesNotMatch(read('server/superuser.mjs'), /superuserPageContext|PAGE_RULES/);
  assert.doesNotMatch(read('server/server.mjs'), /superuserPageContext/);
});

test('v42.1 the switch user type button and picker exist only for the Superuser', () => {
  const shell = read('public/app-shell.js');
  assert.match(shell, /switchUserType: 'ប្តូរប្រភេទអ្នកប្រើ'/);
  assert.match(shell, /const userTypeHtml = user\.isSuperuser \?/, 'the top bar button is rendered only for the Superuser');
  assert.match(shell, /if \(user\.isSuperuser\) \{\s+userTypeBackdrop = document\.createElement/, 'the window is created only for the Superuser');
  assert.match(shell, /fetch\('\/api\/auth\/context'[\s\S]*?window\.location\.assign\(result\.landingPath/);
  const context = read('public/context.js');
  for (const role of ROLES) assert.match(context, new RegExp(`[{,]${role}:'`), `context.js labels ${role}`);
  assert.match(context, /location\.replace\(result\.landingPath\|\|/, '/context uses the landing page from the server');
  assert.match(read('server/routes/auth.mjs'), /landingPathForRole\(chosen\.role, chosen\.wardCode\)/);
});

test('v42.1 signatures name the switched user type only for the Superuser', async () => {
  const { switchedSignerName } = await import('../server/esign.mjs');
  assert.equal(switchedSignerName('Superuser', 'Superuser', 'REGISTRATION'), `Superuser · ${'ចុះឈ្មោះ'}`);
  assert.equal(switchedSignerName('Superuser', 'Superuser', 'NURSE'), `Superuser · ${'គិលានុបដ្ឋាក'}`);
  assert.equal(switchedSignerName('Dr. Sok', 'doctor_medicine', 'DOCTOR'), 'Dr. Sok', 'real staff signatures are unchanged');
});
