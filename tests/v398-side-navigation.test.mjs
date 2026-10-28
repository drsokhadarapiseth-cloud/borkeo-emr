import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createEmrServer } from '../server/server.mjs';

const read = file => fs.readFileSync(file, 'utf8');

function loadNavConfig() {
  const context = vm.createContext({ URL, URLSearchParams });
  vm.runInContext(read('public/nav-config.js'), context);
  return context.EmrNavConfig;
}

const MGMT_ITEMS = ['home', 'departments', 'patient-list', 'lab', 'imaging', 'pharmacy-opd', 'ward-medicines', 'pharmacy-medicines',
  'billing', 'expenses', 'finance', 'requests', 'admin-users', 'admin-organization', 'admin-health-facility', 'admin-record-log', 'admin-drug-safety', 'admin-interface', 'styleguide'];

// docs/nav-roles.md
const EXPECTED = [
  { role: 'REGISTRATION', ward: '', user: 'registration', items: ['register', 'patient-list', 'appointments'] },
  { role: 'TRIAGE', ward: '', user: 'triage', items: ['triage', 'patient-list', 'queue-display-triage'] },
  { role: 'DOCTOR', ward: 'opd', user: 'doctor_opd', items: ['opd-queue', 'patient-list', 'ipd-transfer', 'queue-display-opd'] },
  { role: 'DOCTOR', ward: 'medicine', user: 'doctor_medicine', items: ['home', 'medical-record', 'departments', 'patient-list', 'ward-medicines'] },
  { role: 'NURSE', ward: 'opd', user: 'nurse_opd', items: ['patient-list', 'opd-handoff'] },
  { role: 'NURSE', ward: 'medicine', user: 'nurse_medicine', items: ['departments', 'patient-list', 'ward-medicines'] },
  // v42.6: the midwife's maternal services queue.
  { role: 'MIDWIFE', ward: 'obstetric', user: 'nurse_obstetric', items: ['maternal-queue', 'departments', 'patient-list', 'ward-medicines'] },
  { role: 'CHIEF_WARD', ward: 'medicine', items: ['departments', 'patient-list', 'ward-medicines'] },
  { role: 'WARD_HEAD', ward: 'surgery', items: ['departments', 'patient-list', 'ward-medicines'] },
  { role: 'LAB', ward: '', user: 'lab', items: ['patient-list', 'lab', 'lab-materials'] },
  { role: 'IMAGING', ward: '', user: 'imaging', items: ['patient-list', 'imaging', 'imaging-films'] },
  { role: 'PHARMACY', ward: '', user: 'pharmacy', items: ['patient-list', 'pharmacy-opd', 'ward-medicines', 'pharmacy-medicines', 'pharmacy-display'] },
  { role: 'CLERK', ward: '', user: 'clerk', items: ['patient-list', 'billing'] },
  { role: 'ACCOUNTANT', ward: '', user: 'accountant', items: ['patient-list', 'billing', 'expenses'] },
  { role: 'ADMIN', ward: '', user: 'admin', items: [...MGMT_ITEMS, 'admin-emr-connections'] },
  { role: 'DIRECTOR', ward: '', user: 'director', items: MGMT_ITEMS },
  { role: 'VICE_DIRECTOR', ward: '', user: 'vice_director', items: MGMT_ITEMS },
];

const asUser = ({ role, ward }) => ({ activeRole: role, activeWard: ward ? { code: ward } : null });

test('v39.8 every role sees exactly the navigation items in docs/nav-roles.md', () => {
  const nav = loadNavConfig();
  for (const row of EXPECTED) {
    assert.deepEqual([...nav.visibleItemIds(asUser(row))], row.items, `${row.role}@${row.ward || '-'}`);
  }
  assert.deepEqual([...nav.visibleItemIds({ activeRole: '' })], [], 'no role, no menu');
});

test('incoming referrals use the receiving instance sidebar for every staff role', () => {
  const nav=loadNavConfig();
  for(const row of EXPECTED){
    const user=asUser(row);
    assert.ok(!nav.visibleItemIds(user).includes('incoming-referrals'));
    const receiver={...user,referralReceiver:true};
    assert.ok(nav.visibleItemIds(receiver).includes('incoming-referrals'),row.role);
    assert.ok(!nav.visibleItemIds(receiver,{hidden:['/referrals']}).includes('incoming-referrals'));
    const items=nav.visibleGroups(receiver).flatMap(group=>group.items);
    assert.equal(nav.activeItemId(items,'/referrals',''),'incoming-referrals');
  }
});

test('v39.8 navigation map is one central declarative config; empty groups disappear', () => {
  const nav = loadNavConfig();
  const ids = nav.ITEMS.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'item ids are unique');
  for (const item of nav.ITEMS) {
    assert.ok(nav.GROUPS.some(group => group.id === item.group), `${item.id} has a known group`);
    assert.ok(Array.isArray(item.access) && item.access.length, `${item.id} declares access`);
    // v41.2: an item without approved Khmer yet has a newText key instead (docs/translations-needed.csv).
    assert.ok((item.label || item.newTextKey) && item.labelEn && item.icon.startsWith('icon-'), `${item.id} has labels and icon`);
  }
  const clerkGroups = nav.visibleGroups(asUser({ role: 'CLERK' }));
  assert.deepEqual([...clerkGroups.map(group => group.id)], ['care', 'finance'], 'only groups with items are kept');
  const nurseOpd = nav.visibleGroups(asUser({ role: 'NURSE', ward: 'opd' }));
  assert.deepEqual([...nurseOpd.map(group => [group.id, group.items.length])].map(pair => [...pair]), [['care', 1], ['clinical', 1]], 'single-item groups keep their heading');
  // Requests stay management-only (v23.9 / v24.7 decisions).
  for (const role of ['TRIAGE', 'DOCTOR', 'NURSE', 'PHARMACY', 'CLERK']) {
    assert.ok(!nav.visibleItemIds(asUser({ role, ward: 'medicine' })).includes('requests'), `${role} has no requests button`);
  }
});

test('v39.8 switching role or ward changes the menu; admin settings only hide or reorder', () => {
  const nav = loadNavConfig();
  const opd = nav.visibleItemIds(asUser({ role: 'DOCTOR', ward: 'opd' }));
  const medicine = nav.visibleItemIds(asUser({ role: 'DOCTOR', ward: 'medicine' }));
  assert.notDeepEqual([...opd], [...medicine]);
  assert.ok(opd.includes('opd-queue') && !opd.includes('departments'));
  assert.ok(medicine.includes('departments') && !medicine.includes('opd-queue'));
  assert.notDeepEqual([...nav.visibleItemIds(asUser({ role: 'NURSE', ward: 'opd' }))], [...nav.visibleItemIds(asUser({ role: 'NURSE', ward: 'medicine' }))]);

  const prefs = { hidden: ['/expenses'], order: ['/patient-list', '/billing'] };
  const accountant = nav.visibleGroups(asUser({ role: 'ACCOUNTANT' }), prefs);
  assert.deepEqual([...accountant.flatMap(group => group.items.map(item => item.id))], ['patient-list', 'billing']);
  const sneaky = nav.visibleItemIds(asUser({ role: 'CLERK' }), { hidden: [], order: ['/admin/users', '/finance'] });
  assert.ok(!sneaky.includes('admin-users') && !sneaky.includes('finance'), 'preferences never add pages');

  const items = nav.visibleGroups(asUser({ role: 'REGISTRATION' })).flatMap(group => group.items);
  assert.equal(nav.activeItemId(items, '/patient-list', '?view=appointments'), 'appointments');
  assert.equal(nav.activeItemId(items, '/patient-list', ''), 'patient-list');
  assert.equal(nav.activeItemId(items, '/emr', '?view=register&x=1'), 'register');

  const shell = read('public/app-shell.js');
  assert.match(shell, /const switchContext = async/, 'role/ward switch happens in place');
  assert.match(shell, /renderShellForUser\(\);\s*window\.dispatchEvent\(new CustomEvent\('emr-context-changed'/, 'menu re-renders before the context event');
});

test('v39.8 every visible link opens for its role and hidden forbidden pages are still rejected', async () => {
  const port = 34398;
  const origin = `http://127.0.0.1:${port}`;
  const app = createEmrServer({ demoMode: true, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
  try {
    const nav = loadNavConfig();
    const login = async username => {
      const res = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      assert.equal(res.status, 200, `login ${username}`);
      return res.headers.get('set-cookie').split(';')[0];
    };
    const status = async (cookie, href) => (await fetch(origin + href, { headers: { Cookie: cookie }, redirect: 'manual' })).status;

    for (const row of EXPECTED.filter(entry => entry.user)) {
      const cookie = await login(row.user);
      const me = await (await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } })).json();
      assert.equal(me.user.activeRole, row.role, `${row.user} role`);
      for (const group of nav.visibleGroups(me.user)) {
        for (const item of group.items) assert.equal(await status(cookie, item.href), 200, `${row.user} opens ${item.href}`);
      }
    }

    const forbidden = {
      registration: ['/billing', '/lab', '/admin/users', '/departments'],
      triage: ['/billing', '/pharmacy/opd'],
      doctor_medicine: ['/ipd-transfer', '/lab', '/imaging', '/billing'],
      doctor_opd: ['/lab', '/imaging', '/expenses'],
      nurse_medicine: ['/opd-paraclinic-nurse', '/billing', '/lab'],
      lab: ['/imaging', '/pharmacy/medicines', '/billing'],
      imaging: ['/lab', '/lab/materials'],
      pharmacy: ['/billing', '/lab', '/admin/users'],
      clerk: ['/expenses', '/finance', '/lab'],
      accountant: ['/admin/users', '/lab'],
    };
    for (const [username, paths] of Object.entries(forbidden)) {
      const cookie = await login(username);
      for (const href of paths) assert.equal(await status(cookie, href), 403, `${username} is refused ${href}`);
    }
    assert.equal(await status(await login('lab'), '/stock'), 404, 'old /stock sidebar link never existed');

    const apiDenied = {
      registration: ['/api/admin/users', '/api/finance/expenses', '/api/pharmacy/opd-prescriptions'],
      doctor_medicine: ['/api/finance/cashflow', '/api/pharmacy/dispensing-board'],
      clerk: ['/api/finance/expenses', '/api/admin/users'],
    };
    for (const [username, paths] of Object.entries(apiDenied)) {
      const cookie = await login(username);
      for (const href of paths) assert.equal(await status(cookie, href), 403, `${username} API ${href}`);
    }
  } finally {
    await new Promise(resolve => app.server.close(resolve));
  }
});

test('v39.8 sidebar shell: overlay rail, hover/focus, drawer, pin, reduced motion, print and CSP', () => {
  const shell = read('public/app-shell.js');
  const css = read('public/app-shell.css');
  const server = read('server/server.mjs');
  const icons = read('public/icons.svg');

  assert.match(server, /\['\/public\/nav-config\.js', \['nav-config\.js', 'text\/javascript; charset=utf-8'\]\]/);
  const navIndex=server.indexOf('nav-config.js?v='),shellIndex=server.indexOf('app-shell.js?v=');
  assert.ok(navIndex>=0 && shellIndex>navIndex, 'nav map loads before the shell');
  assert.doesNotMatch(shell, /getRoleNavGroups/, 'old per-role menu copy removed');
  assert.match(shell, /window\.EmrNavConfig/);
  assert.doesNotMatch(shell, /\sonerror=|\sonclick=/, 'no inline handlers (strict CSP)');
  assert.doesNotMatch(shell, /v39\.2\.0/, 'stale version label removed');
  assert.match(shell, /if \(shellMounting \|\| document\.getElementById\('emr-topbar'\)\) return;/, 'shell mounts once (no duplicate breadcrumbs)');
  assert.match(shell, /const COLLAPSE_DELAY_MS = 200;/);
  assert.match(shell, /addEventListener\('pointerenter'/);
  assert.match(shell, /addEventListener\('focusin'/);
  assert.match(shell, /dragging \|\| printing \|\| e\.buttons \|\| modalOpen\(\)/, 'no hover expansion while dragging, printing or with a modal open');
  assert.match(shell, /borkeo_sidebar_pinned:\$\{user\.id \|\| user\.username/, 'pin is remembered per user');
  assert.match(shell, /get\(key\) \{ try \{ return window\.localStorage\.getItem\(key\); \} catch/, 'storage wrapped in try/catch');
  assert.match(shell, /matchMedia\('\(max-width: 768px\), \(hover: none\)'\)/, 'drawer on touch and narrow screens');
  assert.match(shell, /sidebarBackdrop\.addEventListener\('click', \(\) => closeDrawer\(true\)\)/);
  assert.match(shell, /aria-label="\$\{escapeHtml\(label\)\}" data-tooltip=/, 'every link has an accessible name and tooltip');

  assert.match(css, /padding-left: var\(--emr-sidebar-collapsed-width\) !important;/, 'content keeps the collapsed margin');
  assert.match(css, /\.emr-sidebar\.is-expanded \{\s*width: var\(--emr-sidebar-width\);\s*box-shadow: var\(--emr-nav-shadow\);/, 'expanded menu overlays with a shadow');
  assert.match(css, /--emr-sidebar-width: 264px;/);
  assert.match(css, /--emr-sidebar-collapsed-width: 68px;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print \{[\s\S]*\.emr-sidebar,[\s\S]*\.emr-sidebar-backdrop,/, 'sidebar never printed');
  assert.match(css, /@layer emr-shell-controls/, 'shell buttons protected from the global button theme');
  assert.match(css, /--emr-nav-accent: var\(--emr-primary,/, 'admin interface theme colour drives the accent');

  for (const id of ['icon-user-plus', 'icon-flask', 'icon-scan', 'icon-package', 'icon-monitor', 'icon-receipt', 'icon-wallet', 'icon-inbox', 'icon-log-out', 'icon-pin', 'icon-globe']) {
    assert.match(icons, new RegExp(`<symbol id="${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"`), `${id} in the shared sprite style`);
  }
  for (const item of loadNavConfig().ITEMS) assert.match(icons, new RegExp(`id="${item.icon}"`), `${item.icon} exists`);
});

test('v39.8 SOAP titles are always Subjective, Objective, Assessment, Plan in KH, EN and print', () => {
  const html = read('protected/EMR.html');
  const js = read('public/soap-note.js');
  const titles = { s: 'Subjective', o: 'Objective', a: 'Assessment', p: 'Plan' };

  for (const [sec, word] of Object.entries(titles)) {
    const box = html.slice(html.indexOf(`<div class="emr-soap-box section-${sec}">`));
    assert.match(box, new RegExp(`^[\\s\\S]*?<div class="emr-soap-badge" data-language-exclude>${sec.toUpperCase()}</div>`), `${sec} letter badge`);
    assert.match(box, new RegExp(`^[\\s\\S]*?<span class="emr-soap-title" data-language-exclude>${word}( <span|<)`), `${sec} title is ${word}`);
    assert.match(html, new RegExp(`<strong data-language-exclude>${sec.toUpperCase()} · ${word}:</strong>`), `${sec} print title`);
  }
  assert.doesNotMatch(js, /[spoa]Title:/, 'titles are not in the translation dictionaries');

  // Run the controller with a tiny DOM in both interface languages.
  const nodes = {};
  const element = () => ({ innerHTML: '', textContent: '', attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } });
  const document = {
    querySelector(selector) { return (nodes[selector] ??= element()); },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener() {},
  };
  const context = vm.createContext({ document, addEventListener() {}, currentLang: 'khmer' });
  context.window = context;
  vm.runInContext(js, context);
  const api = context.EmrSoapNote;
  assert.deepEqual({ ...api.titles }, titles);

  for (const lang of ['khmer', 'english']) {
    context.currentLang = lang;
    api.refreshLanguageLabels();
    for (const [sec, word] of Object.entries(titles)) {
      // v40.7: the daily follow-up boxes are looked up apart from the IPD record boxes.
      const title = nodes[`.emr-soap-box.section-${sec}:not([data-soap-record-box]) .emr-soap-title`];
      assert.equal(title.innerHTML.replace(/ <span[\s\S]*$/, ''), word, `${lang}: ${sec}`);
      assert.equal(title.attrs['data-language-exclude'], '', `${lang}: ${sec} excluded from translation`);
    }
    const card = api.renderCardGrid({ soap: { s: 'x', o: 'y', a: 'z', p: 'w' } });
    for (const [sec, word] of Object.entries(titles)) {
      assert.ok(card.includes(`<span class="emr-soap-card-title" data-language-exclude>${word} (${sec.toUpperCase()})</span>`), `${lang}: card ${sec}`);
    }
  }
  context.currentLang = 'khmer';
  api.refreshLanguageLabels();
  assert.equal(nodes['.emr-soap-box.section-s:not([data-soap-record-box]) .emr-soap-hint'].textContent, 'អ្វីដែលអ្នកជំងឺរាយការណ៍ (រោគសញ្ញា ប្រវត្តិជំងឺ)', 'hint follows Khmer');
  context.currentLang = 'english';
  api.refreshLanguageLabels();
  assert.equal(nodes['.emr-soap-box.section-s:not([data-soap-record-box]) .emr-soap-hint'].textContent, 'Patient-reported complaints, symptoms, interval history', 'hint follows EN');

  // The page translator skips [data-language-exclude], so the KH-mode
  // reverse dictionary ("Assessment" -> Khmer) cannot touch the titles.
  assert.match(read('public/emr-language.js'), /\[data-language-exclude\]/);
});

test('v39.8 Wi-Fi start for phones: LAN listening, phone address printed, production refused', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['start:wifi'], 'node scripts/start-wifi.mjs');
  const launcher = read('scripts/start-wifi.mjs');
  assert.match(launcher, /process\.env\.HOST = '0\.0\.0\.0';/);
  assert.match(read('server/server.mjs'), /^import os from 'node:os';$/m, 'phone address listing needs the os module');

  const refused = spawnSync(process.execPath, ['scripts/start-wifi.mjs'], { env: { ...process.env, NODE_ENV: 'production', EMR_MODE: '' }, encoding: 'utf8', timeout: 20000 });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /secure \(https\) cookies/);
});
