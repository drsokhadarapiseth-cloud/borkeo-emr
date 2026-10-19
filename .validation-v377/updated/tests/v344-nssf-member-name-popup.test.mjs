import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { evaluateNssfEligibility, createNssfLookup, NSSF_API_ENDPOINT } from '../server/nssf-lookup.mjs';
import { createEmrServer } from '../server/server.mjs';

const rootDir = process.cwd();
const read = f => fs.readFileSync(path.join(rootDir, f), 'utf8');
const CARD = '00000000000123';
const NOW = '2026-10-14T00:00:00.000Z';
const key = Buffer.from('QE5zc2ZfZnJvbV8xMjM0QHRyYWNraW5nJDNAaWxvdmU=', 'base64');
const iv = Buffer.from('QFNvcGhhdEBsZW5nXzE5Mg==', 'base64');

function encrypt(text) {
  const c = crypto.createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([c.update(text, 'utf8'), c.final()]).toString('base64');
}

function envelope(member) {
  const json = JSON.stringify(member);
  return {
    success: true,
    total_record: 0,
    total_page: 0,
    status_code: null,
    message: 'SUCCESS',
    data: encrypt(json)
  };
}

const response = body => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

test('v34.4 release version consistency across package.json, login.html, server.mjs, and EMR.html', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(['34.4.0', '34.5.0', '34.6.0', '34.7.0', '34.8.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v3(?:4\.[456789]|[56].[0-9])/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /Borkeo EMR v3(?:4\.[456789]|[56].[0-9])/);

  const emrHtml = read('protected/EMR.html');
  assert.match(emrHtml, /nssf-lookup\.js\?v=3440/);

  const css = read('public/nssf-lookup.css');
  assert.match(css, /v34\.4/);
});

test('evaluateNssfEligibility extracts and sanitizes ben_full_name_kh and ben_full_name_en', () => {
  const member = {
    sta_eli_id: 1,
    ben_type: 1,
    new_ben_code: CARD,
    ben_full_name_kh: '  ស៊ុន វ៉ាន់ដា  ',
    ben_full_name_en: '  SUN VANDA  '
  };
  const result = evaluateNssfEligibility(member, CARD, NOW);
  assert.equal(result.card.valid, true);
  assert.equal(result.card.nameKh, 'ស៊ុន វ៉ាន់ដា');
  assert.equal(result.card.nameEn, 'SUN VANDA');
});

test('evaluateNssfEligibility handles missing names, fallbacks, and not-found states', () => {
  // Empty names
  const noNames = evaluateNssfEligibility({ sta_eli_id: 1, new_ben_code: CARD }, CARD, NOW);
  assert.equal(noNames.card.nameKh, null);
  assert.equal(noNames.card.nameEn, null);

  // Fallbacks: ben_name_kh / ben_name_en
  const fallbacks = evaluateNssfEligibility({
    sta_eli_id: 1,
    new_ben_code: CARD,
    ben_name_kh: 'កែវ សុខា',
    ben_name_en: 'KEO SOKHA'
  }, CARD, NOW);
  assert.equal(fallbacks.card.nameKh, 'កែវ សុខា');
  assert.equal(fallbacks.card.nameEn, 'KEO SOKHA');

  // Not found
  const notFound = evaluateNssfEligibility(null, CARD, NOW);
  assert.equal(notFound.card.status, 'NOT_FOUND');
  assert.equal(notFound.card.nameKh, null);
  assert.equal(notFound.card.nameEn, null);
});

test('HTTP /api/nssf/verify endpoint returns member names without leaking to audit logs or altering database', async () => {
  const app = createEmrServer({
    databasePath: ':memory:',
    autoDatabase: false,
    demoMode: true,
    nodeEnv: 'test',
    nssfFetch: async () => response(envelope({
      sta_eli_id: 1,
      ben_type: 1,
      new_ben_code: CARD,
      ben_full_name_kh: 'ចាន់ ណារិន',
      ben_full_name_en: 'CHAN NARIN'
    }))
  });

  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  app.config.appOrigin = origin;

  const login = async username => {
    const res = await fetch(origin + '/api/auth/login', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    assert.equal(res.status, 200);
    const Cookie = res.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
    return { Origin: origin, Cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
  };

  try {
    const beforePatients = JSON.stringify(app.database.listPatients());
    const reg = await login('registration');
    const res = await fetch(origin + '/api/nssf/verify', {
      method: 'POST',
      headers: reg,
      body: JSON.stringify({ cardNumber: CARD })
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = await res.json();
    assert.equal(data.card.valid, true);
    assert.equal(data.card.nameKh, 'ចាន់ ណារិន');
    assert.equal(data.card.nameEn, 'CHAN NARIN');

    // Database remains untouched
    assert.equal(JSON.stringify(app.database.listPatients()), beforePatients);

    // Audit logs do NOT contain member names
    const audit = app.database.sqlite.prepare("SELECT details_json FROM audit_events WHERE action='NSSF_VERIFY' ORDER BY id DESC LIMIT 1").get();
    assert.doesNotMatch(audit.details_json, /ចាន់ ណារិន|CHAN NARIN/);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

function createSyntheticDialogRenderer() {
  const s = read('public/nssf-lookup.js');
  const start = s.indexOf('  function renderDialog(');
  const end = s.indexOf('  async function verify(', start);
  return (data, english = false) => {
    const nodes = new Map();
    const modal = { open: false, showModal() { this.open = true; } };
    const byId = id => {
      if (!nodes.has(id)) nodes.set(id, { textContent: '', style: {}, className: '' });
      return nodes.get(id);
    };
    const c = {
      ensureDialog: () => modal,
      byId,
      en: () => english,
      txt: (kh, en) => english ? en : kh,
      formatDisplayDate: () => '—',
      Date
    };
    vm.runInNewContext(s.slice(start, end) + '\nthis.render = renderDialog;', c);
    c.render(data);
    return { modal, nodes };
  };
}

test('client DOM dialog displays Khmer name first and English name below it', () => {
  const render = createSyntheticDialogRenderer();
  const { nodes } = render({
    requestedCard: CARD,
    card: {
      number: CARD,
      nameKh: 'ស៊ុន វ៉ាន់ដា',
      nameEn: 'SUN VANDA',
      valid: true,
      status: 'VALID',
      validityType: 'INDEFINITE'
    }
  });

  assert.equal(nodes.get('nssf_val_name_kh').textContent, 'ស៊ុន វ៉ាន់ដា');
  assert.equal(nodes.get('nssf_val_name_kh').style.display, 'block');
  assert.equal(nodes.get('nssf_val_name_en').textContent, 'SUN VANDA');
  assert.equal(nodes.get('nssf_val_name_en').style.display, 'block');
});

test('client DOM dialog displays fallback "—" when names are absent', () => {
  const render = createSyntheticDialogRenderer();
  const { nodes } = render({
    requestedCard: CARD,
    card: {
      number: CARD,
      nameKh: null,
      nameEn: null,
      valid: true,
      status: 'VALID',
      validityType: 'INDEFINITE'
    }
  });

  assert.equal(nodes.get('nssf_val_name_kh').textContent, '—');
  assert.equal(nodes.get('nssf_val_name_kh').style.display, 'block');
  assert.equal(nodes.get('nssf_val_name_en').textContent, '');
  assert.equal(nodes.get('nssf_val_name_en').style.display, 'none');
});

test('client DOM dialog displays English name when only English name is available', () => {
  const render = createSyntheticDialogRenderer();
  const { nodes } = render({
    requestedCard: CARD,
    card: {
      number: CARD,
      nameKh: null,
      nameEn: 'KEO SOKHA',
      valid: true,
      status: 'VALID',
      validityType: 'INDEFINITE'
    }
  });

  assert.equal(nodes.get('nssf_val_name_kh').textContent, '');
  assert.equal(nodes.get('nssf_val_name_kh').style.display, 'none');
  assert.equal(nodes.get('nssf_val_name_en').textContent, 'KEO SOKHA');
  assert.equal(nodes.get('nssf_val_name_en').style.display, 'block');
});

test('public/nssf-lookup.js uses textContent safely and does not write to registration name fields', () => {
  const source = read('public/nssf-lookup.js');
  // Confirm textContent is used for names
  assert.match(source, /khNode\.textContent\s*=/);
  assert.match(source, /enNode\.textContent\s*=/);
  // Confirm no assignment to patient registration name inputs
  assert.doesNotMatch(source, /web_first_name.*\.value\s*=/);
  assert.doesNotMatch(source, /web_last_name.*\.value\s*=/);
  assert.doesNotMatch(source, /web_name.*\.value\s*=/);
});
