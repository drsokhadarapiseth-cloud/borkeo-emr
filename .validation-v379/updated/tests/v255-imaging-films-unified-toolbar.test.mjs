import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';

test('v25.5 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^25\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v25\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v25\./);
});

test('v25.5 stock.html shares identical unified specialty tabs with /imaging', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/stock.html'), 'utf8');
  assert.ok(html.includes('imaging.css'), 'Loads imaging.css');
  assert.ok(html.includes('id="stock-imaging-groups-bar"'), 'Contains stock-imaging-groups-bar');
  assert.ok(html.includes('id="imaging-films-tab"'), 'Contains imaging-films-tab');
  assert.ok(html.includes('Films & Materials</a>'), 'Films & Materials tab is labeled in English');
  assert.ok(html.includes('Radiology <span class="group-dropdown-caret">▾</span>'), 'Contains Radiology tab');
  assert.ok(html.includes('Cardiology <span class="group-dropdown-caret">▾</span>'), 'Contains Cardiology tab');
  assert.ok(html.includes('Endoscopy <span class="group-dropdown-caret">▾</span>'), 'Contains Endoscopy tab');
  assert.ok(!html.includes('href="/imaging?modality=ULTRASOUND"'), 'Legacy separate modality links removed from stock.html');
});

test('v25.5 /imaging/films HTTP endpoint delivers unified toolbar to authenticated imaging user', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  try {
    const loginRes = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ username: 'imaging' })
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';', 1)[0];
    await loginRes.json();

    const filmsRes = await fetch(`${origin}/imaging/films`, {
      headers: { Cookie: cookie }
    });
    assert.equal(filmsRes.status, 200);
    const filmsHtml = await filmsRes.text();
    assert.ok(filmsHtml.includes('id="stock-imaging-groups-bar"'), 'Films page serves unified imaging toolbar');
    assert.ok(filmsHtml.includes('Films & Materials'), 'Films page includes active Films & Materials tab');
  } finally {
    await new Promise(r => app.server.close(r));
    app.server.closeAllConnections?.();
  }
});
