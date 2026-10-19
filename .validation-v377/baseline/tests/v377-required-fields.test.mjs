import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createEmrServer } from '../server/server.mjs';

const read = file => fs.readFileSync(file, 'utf8');

test('all workspace and login templates load required validation before their own scripts', () => {
  const source = read('server/server.mjs');
  const start = source.indexOf('function getProcessedHtml('), end = source.indexOf('\nfunction sendJson(', start);
  const context = vm.createContext({ fs, path, Buffer, htmlTemplateCache: new Map() });
  vm.runInContext(source.slice(start, end), context);
  const templates = fs.readdirSync('protected').filter(file => file.endsWith('.html') && file !== 'print-preview.html')
    .map(file => path.resolve('protected', file));
  templates.push(path.resolve('public/login.html'));
  for (const file of templates) {
    const html = context.getProcessedHtml(file, 'text/html; charset=utf-8', {}, '37.7').toString();
    const scripts = Array.from(html.matchAll(/<script\b[^>]*src="([^"]+)"/gi), match => match[1]);
    assert.equal(scripts[1], '/public/emr-required-fields.js?v=3770&build=37.7', file);
    assert.ok(html.includes('/public/emr-required-fields.css?v=3770&build=37.7'), file);
  }
  assert.ok(templates.length >= 25);
});

test('a direct Registration save/transfer validates before clinical synchronization or any network work', async () => {
  const source = read('public/emr-patient-record.js');
  const start = source.indexOf('  async function savePatientRecord(options = {}) {');
  const end = source.indexOf('    ensureFirstExamDateTime();', start);
  assert.ok(start >= 0 && end > start);
  const registration = {}, active = {};
  const seen = [];
  let allow = false;
  const context = vm.createContext({ window: { BorkeoRequiredFields: { validate: scope => { seen.push(scope); return allow; } } },
    document: { getElementById: id => { assert.equal(id, 'sub_reg'); return registration; }, querySelector: () => active } });
  vm.runInContext(source.slice(start, end) + 'return "allowed";\n}', context);
  assert.equal(await context.savePatientRecord({ transferToTriage: true }), false);
  assert.equal(await context.savePatientRecord({}), false);
  assert.deepEqual(seen, [registration, active]);
  allow = true;
  assert.equal(await context.savePatientRecord({ transferToTriage: true }), 'allowed');
});

test('required validation assets are served through the public allowlist and metadata agrees', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '37.7.0');
  const server = read('server/server.mjs');
  for (const asset of ['emr-required-fields.js', 'emr-required-fields.css']) {
    assert.ok(server.includes("['/public/" + asset + "', ['" + asset + "',"));
    assert.ok(fs.existsSync('public/' + asset));
  }
  assert.match(server, /Borkeo EMR v37\.7/);
  assert.match(read('public/login.html'), /data-app-version[^>]*>v37\.7</);
});

test('specialty storage cannot write a form that fails required-field validation', async () => {
  const source = read('public/opd-clinical-storage.js');
  const start = source.indexOf('  async function saveForm(type, options = {}) {');
  const end = source.indexOf('    if (!context.key) {', start);
  assert.ok(start >= 0 && end > start);
  const root = {};
  let checked = 0;
  const context = vm.createContext({ formOrder: ['anc'], rootForType: () => root,
    patientContext: () => ({ key: 'synthetic' }), window: { BorkeoRequiredFields: { validate: actual => {
      assert.equal(actual, root); checked++; return false;
    } } } });
  vm.runInContext(source.slice(start, end) + 'throw Error("Saving should have stopped");\n}', context);
  assert.equal(await context.saveForm('anc'), false);
  assert.equal(checked, 1);
});

test('HTTP serves both required-field assets without authentication', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', port: 0, nodeEnv: 'test' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  try {
    for (const [file, mime, content] of [
      ['emr-required-fields.js', /javascript/, /requiredFieldsForEveryWorkspace/],
      ['emr-required-fields.css', /text\/css/, /emr-required-missing/],
    ]) {
      const response = await fetch(origin + '/public/' + file + '?v=3770');
      assert.equal(response.status, 200, file);
      assert.match(response.headers.get('content-type'), mime);
      assert.match(await response.text(), content);
    }
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
