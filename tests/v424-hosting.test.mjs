// v42.4 - Ready for an online Node.js host (Railway first): production security,
// proxy, DATA_DIR, health check, Docker files. Local hospital use is unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const ORIGIN = 'https://emr.example.test';
const STRONG = 'Synthetic-Strong-Pass-42';

async function start(options) {
  const app = createEmrServer({ host: '127.0.0.1', port: 0, nodeEnv: 'test', ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const login = (username, password, headers = {}) => fetch(base + '/api/auth/login', {
    method: 'POST', headers: { Origin: app.config.appOrigin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ username, password }),
  });
  const stop = async () => { await new Promise(resolve => app.server.close(resolve)); app.database.close(); };
  return { app, base, login, stop };
}

const production = extra => ({ nodeEnv: 'production', demoMode: false, databasePath: ':memory:', appOrigin: ORIGIN, cookieSecure: true, ...extra });

test('production refuses the Superuser without a SUPERUSER_PASSWORD of 12+ characters; the server still starts', async () => {
  for (const superuserPassword of ['', '1234', 'short-pass1']) {
    const server = await start(production({ superuserPassword }));
    try {
      assert.notEqual((await server.login('Superuser', '1234')).status, 200, `password "${superuserPassword.length}" chars`);
      assert.notEqual((await server.login('Superuser', superuserPassword || 'x')).status, 200);
      assert.equal(server.app.database.findUser('Superuser').is_active, 0, 'inactive');
      assert.equal((await fetch(server.base + '/api/health')).status, 200, 'the server runs');
    } finally { await server.stop(); }
  }
});

test('production accepts the Superuser with a 12+ character password, never 1234, and keeps it across restarts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v424-'));
  const databasePath = path.join(dir, 'emr.sqlite');
  try {
    let server = await start(production({ databasePath, superuserPassword: STRONG }));
    let hash;
    try {
      assert.equal((await server.login('Superuser', STRONG)).status, 200);
      assert.notEqual((await server.login('Superuser', '1234')).status, 200);
      hash = server.app.database.findUser('Superuser').password_hash;
      assert.equal(server.app.database.findUser('doctor_medicine'), null, 'no shared-password ward accounts online');
    } finally { await server.stop(); }
    server = await start(production({ databasePath, superuserPassword: STRONG }));
    try {
      assert.equal(server.app.database.findUser('Superuser').password_hash, hash, 'not reset at every start');
      assert.equal((await server.login('Superuser', STRONG)).status, 200);
    } finally { await server.stop(); }
    server = await start(production({ databasePath, superuserPassword: STRONG + '-new' }));
    try {
      assert.equal((await server.login('Superuser', STRONG)).status === 200, false, 'a new SUPERUSER_PASSWORD replaces the old one');
      assert.equal((await server.login('Superuser', STRONG + '-new')).status, 200);
    } finally { await server.stop(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the Superuser password is never printed or listed in the configuration', async () => {
  const printed = [];
  const originals = {};
  for (const name of ['log', 'info', 'warn', 'error']) {
    originals[name] = console[name];
    console[name] = (...args) => { printed.push(args.map(String).join(' ')); };
  }
  let server;
  try {
    server = await start(production({ superuserPassword: STRONG }));
    await server.login('Superuser', STRONG);
    await server.login('Superuser', 'wrong-password-x');
    assert.equal(JSON.stringify(server.app.config).includes(STRONG), false, 'not in the configuration');
    assert.equal(Object.keys(server.app.config).includes('superuserPassword'), false);
  } finally {
    for (const name of Object.keys(originals)) console[name] = originals[name];
    if (server) await server.stop();
  }
  assert.equal(printed.some(line => line.includes(STRONG)), false, 'never printed');
});

test('local use is unchanged: demo mode and the hospital (password) mode accept Superuser / 1234', async () => {
  const demo = await start({ demoMode: true, databasePath: ':memory:', appOrigin: 'http://127.0.0.1:0' });
  try {
    assert.equal((await demo.login('Superuser', '1234')).status, 200);
    assert.ok(demo.app.database.findUser('doctor_medicine'), 'demo accounts as before');
  } finally { await demo.stop(); }
  const hospital = await start({ demoMode: false, databasePath: ':memory:', appOrigin: 'http://127.0.0.1:3001' });
  try {
    assert.equal((await hospital.login('Superuser', '1234')).status, 200);
    assert.ok(hospital.app.database.findUser('doctor_medicine'), 'default ward accounts as before');
    const config = await (await fetch(hospital.base + '/api/auth/config')).json();
    assert.equal(config.production, false);
  } finally { await hospital.stop(); }
});

test('production login page lists no accounts and offers no quick login', async () => {
  const server = await start(production({ superuserPassword: STRONG }));
  try {
    const config = await (await fetch(server.base + '/api/auth/config')).json();
    assert.deepEqual([config.demoMode, config.production, config.accounts], [false, true, []]);
  } finally { await server.stop(); }
  const login = read('public/login.js');
  assert.match(login, /if \(data\.production === true\) hideAccountLists\(\);/);
  const hide = login.slice(login.indexOf('function hideAccountLists'), login.indexOf('function populateAccounts'));
  assert.match(hide, /userAccountsList\.replaceChildren\(\)/);
  assert.match(hide, /quickRoleSelect\.replaceChildren\(\)/);
  assert.match(hide, /field\.hidden = true/);
});

test('behind the proxy (TRUST_PROXY=true) login lockout and the audit log use the real client address', async () => {
  const server = await start(production({ superuserPassword: STRONG, trustProxy: true, loginMaxAttempts: 2 }));
  try {
    const from = ip => ({ 'X-Forwarded-For': `203.0.113.99, ${ip}` });
    for (let i = 0; i < 3; i++) await server.login('nobody', 'wrong-password-x', from('198.51.100.7'));
    assert.equal((await server.login('Superuser', STRONG, from('198.51.100.7'))).status, 429, 'the attacking address is locked out');
    assert.equal((await server.login('Superuser', STRONG, from('198.51.100.8'))).status, 200, 'another client is not');
    const audited = server.app.database.sqlite.prepare("SELECT ip_address FROM audit_events WHERE action='LOGIN_FAILED'").all().map(row => row.ip_address);
    assert.ok(audited.length && audited.every(ip => ip === '198.51.100.7'), 'the last X-Forwarded-For address is recorded');
  } finally { await server.stop(); }
  const direct = await start(production({ superuserPassword: STRONG }));
  try {
    await direct.login('nobody', 'wrong-password-x', { 'X-Forwarded-For': '198.51.100.7' });
    const ip = direct.app.database.sqlite.prepare("SELECT ip_address FROM audit_events WHERE action='LOGIN_FAILED'").get().ip_address;
    assert.notEqual(ip, '198.51.100.7', 'without TRUST_PROXY the header is ignored');
  } finally { await direct.stop(); }
  assert.match(read('server/record-access.mjs'), /ip: requestIp \? requestIp\(request\) : ''/, 'the record view log uses the same address');
});

test('DATA_DIR holds the database, uploads and backups; without it the locations are unchanged', async () => {
  const { loadConfig, uploadDirectory } = await import('../server/config.mjs');
  const dataDir = path.join(os.tmpdir(), 'borkeo-v424-volume');
  const online = loadConfig(production({ databasePath: undefined, dataDirectory: dataDir, superuserPassword: STRONG }));
  assert.equal(online.databasePath, path.join(dataDir, 'emr.sqlite'));
  assert.equal(online.autoDatabase, false, 'no recovery scan of the project folder online');
  assert.equal(uploadDirectory(online, 'patients'), path.join(dataDir, 'uploads', 'patients'));
  assert.equal(online.backupDirectory, path.join(dataDir, 'backups'));
  const explicit = loadConfig(production({ databasePath: path.join(os.tmpdir(), 'other.sqlite'), dataDirectory: dataDir }));
  assert.equal(explicit.databasePath, path.join(os.tmpdir(), 'other.sqlite'), 'DATABASE_PATH still wins');
  assert.equal(uploadDirectory(explicit, 'messages', 'x'), path.join(dataDir, 'uploads', 'messages', 'x'));

  const saved = { DATA_DIR: process.env.DATA_DIR, DATABASE_PATH: process.env.DATABASE_PATH };
  delete process.env.DATA_DIR; delete process.env.DATABASE_PATH;
  try {
    const hospital = loadConfig({ demoMode: false, nodeEnv: 'development', appOrigin: 'http://127.0.0.1:3001' });
    assert.equal(hospital.databasePath, path.join(os.homedir(), 'Borkeo_EMR_Data', 'emr.sqlite'), 'hospital computer unchanged');
    assert.equal(hospital.autoDatabase, true);
    assert.equal(hospital.dataDirectory, '');
    assert.equal(hospital.backupDirectory, '');
    assert.equal(uploadDirectory(hospital, 'patients'), path.join(os.homedir(), 'Borkeo_EMR_Data', 'uploads', 'patients'));
    process.env.DATABASE_PATH = '';
    assert.equal(loadConfig({ demoMode: false, nodeEnv: 'development', appOrigin: 'http://127.0.0.1:3001' }).autoDatabase, true, 'an empty DATABASE_PATH means not set');
    const demo = loadConfig({ demoMode: true, dataDirectory: dataDir, appOrigin: 'http://127.0.0.1:3001' });
    assert.equal(demo.dataDirectory, '', 'the local demo ignores DATA_DIR');
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  for (const file of ['server/routes/finance.mjs', 'server/routes/messages.mjs', 'server/routes/paraclinic.mjs']) {
    assert.match(read(file), /const uploadRoot = uploadDirectory\(config, /, file);
  }
});

test('a patient survives a restart in DATA_DIR; health check and backups work without patient data in the answer', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v424-data-'));
  try {
    let server = await start(production({ databasePath: undefined, dataDirectory: dataDir, superuserPassword: STRONG }));
    try {
      const health = await fetch(server.base + '/api/health');
      assert.deepEqual(await health.json(), { ok: true });
      const login = await server.login('Superuser', STRONG);
      const Cookie = login.headers.get('set-cookie').split(';')[0];
      const me = await (await fetch(server.base + '/api/auth/me', { headers: { Cookie } })).json();
      const headers = { Cookie, Origin: ORIGIN, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
      const as = role => fetch(server.base + '/api/auth/context', { method: 'POST', headers, body: JSON.stringify({ role }) });
      assert.equal((await as('REGISTRATION')).status, 200);
      const summary = { caseNumber: 'V424-SURVIVE', healthId: 'H-V424', firstName: 'Volume', lastName: 'Synthetic', fullName: 'Synthetic Volume', sex: 'ស្រី', age: '33', departmentCode: '', serviceMode: '', entryDate: '2026-10-23' };
      const saved = await fetch(server.base + '/api/patient-record', { method: 'PUT', headers, body: JSON.stringify({ patientKey: 'case:V424-SURVIVE', summary, data: { 'scope:registration:id:emr_pmrs_case_new': true } }) });
      assert.equal(saved.status, 200, await saved.clone().text());
      assert.equal((await as('ADMIN')).status, 200);
      assert.equal((await fetch(server.base + '/api/admin/backup', { method: 'POST', headers })).status, 201);
      const list = await (await fetch(server.base + '/api/admin/backups', { headers })).json();
      assert.ok(list.backups.length >= 1);
      const download = await fetch(server.base + '/api/admin/backups/latest', { headers });
      assert.equal(download.status, 200);
      assert.match(download.headers.get('content-disposition'), /attachment; filename="[A-Za-z0-9._-]+\.sqlite"/);
      assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0, 15).toString(), 'SQLite format 3');
      assert.notEqual((await fetch(server.base + '/api/admin/backups/..%2Femr.sqlite', { headers })).status, 200, 'only backup files');
      assert.equal((await fetch(server.base + '/api/admin/backups/latest')).status, 401, 'login needed');
      assert.equal((await as('REGISTRATION')).status, 200);
      assert.equal((await fetch(server.base + '/api/admin/backups/latest', { headers })).status, 403, 'management only');
    } finally { await server.stop(); }
    assert.ok(fs.existsSync(path.join(dataDir, 'emr.sqlite')));
    assert.ok(fs.readdirSync(path.join(dataDir, 'backups')).some(name => name.endsWith('.sqlite')));
    server = await start(production({ databasePath: undefined, dataDirectory: dataDir, superuserPassword: STRONG }));
    try {
      assert.equal(server.app.database.findPatient('case:V424-SURVIVE')?.full_name, 'Synthetic Volume', 'the patient is still there after a restart');
    } finally { await server.stop(); }
  } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('hosting files: Dockerfile, .dockerignore, .env.example, .gitignore, docs/DEPLOY.md; no vercel.json', () => {
  const docker = read('Dockerfile');
  assert.match(docker, /^FROM node:24-slim$/m);
  assert.match(docker, /NODE_ENV=production/);
  assert.match(docker, /HOST=0\.0\.0\.0/);
  assert.match(docker, /DATA_DIR=\/data/);
  assert.match(docker, /CMD \["node", "server\/server\.mjs"\]/);
  assert.doesNotMatch(docker, /npm (ci|install)/, 'the project has no npm packages');
  const ignore = read('.dockerignore').split('\n');
  for (const line of ['node_modules', '.git', '.env', 'data/uploads', 'data/backups', '**/*.sqlite', '!data/icd10/catalogue.sqlite']) assert.ok(ignore.includes(line), line);
  const env = read('.env.example');
  for (const name of ['NODE_ENV', 'PORT', 'HOST', 'APP_ORIGIN', 'COOKIE_SECURE', 'TRUST_PROXY', 'DATA_DIR', 'DATABASE_PATH', 'SUPERUSER_PASSWORD', 'SESSION_TTL_MINUTES', 'LOGIN_MAX_ATTEMPTS', 'LOG_LEVEL']) {
    assert.match(env, new RegExp(`^${name}=`, 'm'), name);
  }
  const gitignore = read('.gitignore').split('\n');
  for (const line of ['node_modules/', '.env', '.env.*', '!.env.example', 'data/uploads/', 'data/backups/', '*.sqlite', '*.sqlite-wal', '*.sqlite-shm', '*.db', 'logs/', '*.log', 'Borkeo_EMR_Data/', '!data/icd10/catalogue.sqlite']) {
    assert.ok(gitignore.includes(line), line);
  }
  assert.equal(fs.existsSync(path.join(root, 'vercel.json')), false);
  const deploy = read('docs/DEPLOY.md');
  for (const text of ['/data', 'APP_ORIGIN', 'TRUST_PROXY', 'SUPERUSER_PASSWORD', '/api/admin/backups/latest', 'Render', 'Fly.io', 'Why Vercel does not work']) assert.ok(deploy.includes(text), text);
});
