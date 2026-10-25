import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';

const read = file => fs.readFileSync(file, 'utf8');

test('Phase 4: Version consistency across package.json, server.mjs, and login.html', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^(?:39\.[3-9]|4[0-9]\.[0-9])\.0$/);

  const serverSrc = read('server/server.mjs');
  assert.match(serverSrc, /Borkeo EMR v(?:39\.[3-9]|4[0-9]\.[0-9])/);

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /data-app-version[^>]*>v(?:39\.[3-9]|4[0-9]\.[0-9])<\/span>/);
});

test('Phase 4: Chart navigation assets are served statically with correct content types', async () => {
  const app = createEmrServer({
    demoMode: true,
    databasePath: ':memory:',
    host: '127.0.0.1',
    port: 0,
    appOrigin: 'http://127.0.0.1:0',
    nodeEnv: 'test'
  });

  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${app.server.address().port}`;

    const cssRes = await fetch(`${origin}/public/patient-banner.css`);
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.headers.get('content-type'), /text\/css/);
    const cssText = await cssRes.text();
    assert.match(cssText, /\.emr-chart-tabs-wrap/);
    assert.match(cssText, /\.emr-chart-tabs/);
    assert.match(cssText, /\.emr-chart-tab\.is-active/);
    assert.match(cssText, /@media print\s*\{\s*\.emr-chart-tabs-wrap\s*\{\s*display:\s*none\s*!important;/);

    const jsRes = await fetch(`${origin}/public/patient-banner.js`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type'), /javascript/);
    const jsText = await jsRes.text();
    assert.match(jsText, /initPatientChartTabs/);
    assert.match(jsText, /window\.setupChartTabs = setupChartTabs/);
    assert.match(jsText, /role="tablist"/);
    assert.match(jsText, /role="tab"/);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('Phase 4: Clinical screens receive patient-banner stylesheet and script while print-preview remains clean', async () => {
  const app = createEmrServer({
    demoMode: true,
    databasePath: ':memory:',
    host: '127.0.0.1',
    port: 0,
    appOrigin: 'http://127.0.0.1:0',
    nodeEnv: 'test'
  });

  try {
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${app.server.address().port}`;

    const loginRes = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: app.config.appOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' })
    });
    const Cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // Check clinical screens
    for (const page of ['/emr', '/lab', '/imaging', '/billing', '/departments']) {
      const pageRes = await fetch(`${origin}${page}`, { headers: { Cookie } });
      assert.equal(pageRes.status, 200, `Page ${page} failed to load`);
      const html = await pageRes.text();
      assert.match(html, /\/public\/patient-banner\.css\?v=\d+/);
      assert.match(html, /\/public\/patient-banner\.js\?v=\d+/);
    }

    // Verify print-preview remains strictly script-free
    const printRes = await fetch(`${origin}/print-preview`, { headers: { Cookie } });
    assert.equal(printRes.status, 200);
    const printHtml = await printRes.text();
    assert.doesNotMatch(printHtml, /<script/i);
    assert.doesNotMatch(printHtml, /patient-banner/i);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('Phase 4: Khmer-only chart tabs filter by role and navigate without a patient banner', async () => {
  const js = read('public/patient-banner.js');
  // Check no bilingual slash text in chart labels.
  assert.doesNotMatch(js, /['"][^'"]+\s+\/\s+[A-Za-z]+['"]/);
  // Check 7 chart tabs exist in Khmer
  assert.match(js, /<span>សង្ខេប<\/span>/);
  assert.match(js, /<span>សញ្ញាជីវិត<\/span>/);
  assert.match(js, /<span>បញ្ជា<\/span>/);
  assert.match(js, /<span>លទ្ធផល<\/span>/);
  assert.match(js, /<span>ឱសថ<\/span>/);
  assert.match(js, /<span>កំណត់ត្រា<\/span>/);
  assert.match(js, /<span>បេឡា<\/span>/);
  // Execute the complete navigation script, with only its DOM boundary stubbed.
  const { default: vm } = await import('node:vm');
  const labels = new Map([
    ['summary', 'សង្ខេប'], ['vitals', 'សញ្ញាជីវិត'], ['orders', 'បញ្ជា'],
    ['results', 'លទ្ធផល'], ['meds', 'ឱសថ'], ['notes', 'កំណត់ត្រា'], ['billing', 'បេឡា'],
  ]);
  const clinical = ['summary', 'vitals', 'orders', 'results', 'meds', 'notes'];
  const all = [...labels.keys()];
  const roles = [
    ...['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].map(role => [role, all]),
    ...['DOCTOR', 'WARD_HEAD', 'CHIEF_WARD', 'NURSE', 'MIDWIFE'].map(role => [role, clinical]),
    ['TRIAGE', ['vitals']], ['REGISTRATION', ['summary', 'vitals']],
    ...['CLERK', 'ACCOUNTANT'].map(role => [role, ['summary', 'billing']]),
    ['PHARMACY', ['summary', 'meds']],
    ...['LAB', 'IMAGING'].map(role => [role, ['summary', 'orders', 'results']]),
    ['doctor', clinical], ['UNKNOWN', clinical],
  ];
  function fixture(role, pathname = '/emr') {
    const nodes = new Map(), actions = [], windowEvents = new Map(), documentEvents = new Map();
    let insertions = 0;
    const insert = element => { insertions++; nodes.set(element.id, element); };
    const host = { prepend: insert, dataset: { encounterView: 'medical' } };
    nodes.set('main-content', host);
    const recent = { open: false };
    const panel = { querySelector: () => recent, scrollIntoView: options => actions.push(['scroll', 'paraclinic-inline', options.behavior]) };
    const medications = { scrollIntoView: options => actions.push(['scroll', 'ipd_rx_container', options.behavior]) };
    nodes.set('sub_ipd', { querySelector: selector => selector === '.paraclinic-inline' ? panel : medications });
    const document = {
      body: host,
      getElementById: id => nodes.get(id),
      querySelector: selector => selector === 'main' ? host : null,
      addEventListener: (name, listener) => documentEvents.set(name, listener),
      createElement() {
        let html = '', tabs = [];
        return {
          get innerHTML() { return html; },
          set innerHTML(value) {
            html = value;
            tabs = [...value.matchAll(/<button\b([^>]+)>([\s\S]*?)<\/button>/g)].map(([, attributes, content]) => {
              const classes = new Set(attributes.match(/class="([^"]*)"/)[1].split(/\s+/));
              const listeners = new Map();
              const attrs = { 'aria-selected': attributes.match(/aria-selected="([^"]*)"/)[1] };
              return {
                dataset: { chartTab: attributes.match(/data-chart-tab="([^"]*)"/)[1] },
                text: content.match(/<span>([^<]+)<\/span>/)[1],
                classList: { contains: name => classes.has(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
                setAttribute: (name, next) => { attrs[name] = next; },
                getAttribute: name => attrs[name],
                addEventListener: (name, listener) => listeners.set(name, listener),
                click: () => listeners.get('click')(),
              };
            });
          },
          querySelector: () => tabs.find(tab => tab.classList.contains('is-active')),
          querySelectorAll: () => tabs,
        };
      },
    };
    const window = {
      location: { pathname, assign: url => actions.push(['navigate', url]) },
      emrSession: { user: { activeRole: role } },
      switchPage: page => actions.push(['page', page]),
      addEventListener: (name, listener) => windowEvents.set(name, listener),
    };
    vm.runInNewContext(js, { window, document });
    return { window, actions, windowEvents, documentEvents, insertions: () => insertions,
      wrapper: () => nodes.get('emr-chart-tabs-wrapper') };
  }
  const patient = { patientKey: 'case:Synthetic / A&B' };
  const expectedActions = new Map([
    ['summary', []], ['vitals', [['page', 2]]], ['notes', [['page', 3]]],
    ['orders', [['page', 3], ['scroll', 'paraclinic-inline', 'smooth']]],
    ['results', [['page', 3], ['scroll', 'paraclinic-inline', 'smooth']]],
    ['meds', [['page', 3], ['scroll', 'ipd_rx_container', 'smooth']]],
    ['billing', [['navigate', `/billing?patient=${encodeURIComponent(patient.patientKey)}`]]],
  ]);
  for (const [role, allowed] of roles) {
    const f = fixture(role);
    assert.deepEqual(Array.from(f.window.getAllowedTabsForRole(role)), allowed, role);
    f.documentEvents.get('emr:patient-loaded')({ detail: { patient } });
    const tabs = f.wrapper().querySelectorAll('.emr-chart-tab');
    assert.deepEqual(tabs.map(tab => tab.dataset.chartTab), allowed, role);
    assert.deepEqual(tabs.map(tab => tab.text), allowed.map(id => labels.get(id)), role);
    assert.match(f.wrapper().innerHTML, /role="tablist" aria-label="[\u1780-\u17ff]/);
    assert.doesNotMatch(f.wrapper().innerHTML, /emr-patient-banner|emr-summary-dashboard|allergy-alert/);
    assert.equal(tabs.filter(tab => tab.getAttribute('aria-selected') === 'true').length, 1);
    for (const tab of tabs) {
      f.actions.length = 0;
      tab.click();
      assert.deepEqual(f.actions, expectedActions.get(tab.dataset.chartTab), `${role}: ${tab.dataset.chartTab}`);
      for (const other of tabs) {
        assert.equal(other.classList.contains('is-active'), other === tab);
        assert.equal(other.getAttribute('aria-selected'), String(other === tab));
      }
    }
    const selected = tabs.at(-1).dataset.chartTab;
    f.window.getLoadedEmrPatient = () => patient;
    f.windowEvents.get('emr-session-ready')();
    assert.equal(f.insertions(), 1, 'refresh reuses the existing wrapper');
    assert.equal(f.wrapper().querySelector('.is-active').dataset.chartTab, selected, 'refresh preserves an allowed selection');
  }
  const changedRole = fixture('ADMIN');
  changedRole.window.setupChartTabs(patient);
  changedRole.wrapper().querySelectorAll().find(tab => tab.dataset.chartTab === 'billing').click();
  changedRole.window.emrSession.user.activeRole = 'TRIAGE';
  changedRole.window.setupChartTabs(patient);
  assert.deepEqual(changedRole.wrapper().querySelectorAll().map(tab => tab.dataset.chartTab), ['vitals']);
  assert.equal(changedRole.wrapper().querySelector().dataset.chartTab, 'vitals', 'a disallowed selection falls back to vitals');
  changedRole.actions.length = 0;
  const tampered = changedRole.wrapper().querySelectorAll()[0];
  tampered.dataset.chartTab = 'billing'; tampered.click();
  assert.deepEqual(changedRole.actions, [['page', 2]], 'a disallowed tab falls back to the allowed vitals page');
  const unsaved = fixture('CLERK');
  unsaved.window.setupChartTabs(null);
  unsaved.wrapper().querySelectorAll().find(tab => tab.dataset.chartTab === 'billing').click();
  assert.deepEqual(unsaved.actions, [], 'billing requires a saved patient key');
  const otherPage = fixture('ADMIN', '/lab');
  otherPage.window.setupChartTabs(patient);
  assert.equal(otherPage.insertions(), 0, 'chart navigation renders only on /emr');
});
