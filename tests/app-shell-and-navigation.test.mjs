import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';

const read = file => fs.readFileSync(file, 'utf8');

test('Phase 3: Version consistency across package.json, server.mjs, and login.html', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^39\.[2-9]\.0$/);

  const serverSrc = read('server/server.mjs');
  assert.match(serverSrc, /Borkeo EMR v39\.[2-9]/);

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /data-app-version[^>]*>v39\.[2-9]<\/span>/);
});

test('Phase 3: App shell assets and icons are served statically with correct content types', async () => {
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

    const cssRes = await fetch(`${origin}/public/app-shell.css`);
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.headers.get('content-type'), /text\/css/);
    const cssText = await cssRes.text();
    assert.match(cssText, /\.emr-topbar/);
    assert.match(cssText, /\.emr-sidebar/);
    assert.match(cssText, /\.skip-to-content/);

    const jsRes = await fetch(`${origin}/public/app-shell.js`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type'), /javascript/);
    const jsText = await jsRes.text();
    assert.match(jsText, /initEmrAppShell/);
    assert.match(jsText, /emr-command-palette/);

    // Verify SVG icon sprite contains the navigation icons
    const iconsRes = await fetch(`${origin}/public/icons.svg`);
    assert.equal(iconsRes.status, 200);
    const iconsSvg = await iconsRes.text();
    assert.match(iconsSvg, /id="icon-home"/);
    assert.match(iconsSvg, /id="icon-chart"/);
    assert.match(iconsSvg, /id="icon-dollar"/);
    assert.match(iconsSvg, /id="icon-palette"/);
    assert.match(iconsSvg, /id="icon-panel-left"/);
    assert.match(iconsSvg, /id="icon-help-circle"/);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('Phase 3: Protected pages receive app-shell stylesheet and script while print-preview remains clean', async () => {
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

    // Check staff pages
    for (const page of ['/home', '/departments', '/patient-list', '/billing', '/lab']) {
      const pageRes = await fetch(`${origin}${page}`, { headers: { Cookie } });
      assert.equal(pageRes.status, 200, `Page ${page} failed to load`);
      const html = await pageRes.text();
      assert.match(html, /\/public\/app-shell\.css\?v=39[2-9]0/);
      assert.match(html, /\/public\/app-shell\.js\?v=39[2-9]0/);
    }

    // Verify print-preview remains strictly script-free
    const printRes = await fetch(`${origin}/print-preview`, { headers: { Cookie } });
    assert.equal(printRes.status, 200);
    const printHtml = await printRes.text();
    assert.doesNotMatch(printHtml, /<script/i);
    assert.doesNotMatch(printHtml, /app-shell/i);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('Phase 3: Khmer-only default presentation and navigation structure in app-shell.js', () => {
  const js = read('public/app-shell.js');
  // Check no bilingual slash text in navigation labels
  assert.doesNotMatch(js, /['"][^'"]+\s+\/\s+[A-Za-z]+['"]/);
  // Check role labels are strictly in Khmer
  assert.match(js, /ADMIN:\s*'អ្នកគ្រប់គ្រងប្រព័ន្ធ'/);
  assert.match(js, /DOCTOR:\s*'វេជ្ជបណ្ឌិត'/);
  assert.match(js, /NURSE:\s*'គិលានុបដ្ឋាក'/);
  assert.match(js, /PHARMACY:\s*'ឱសថស្ថាន'/);
  assert.match(js, /LAB:\s*'មន្ទីរពិសោធន៍'/);
  assert.match(js, /CLERK:\s*'បេឡា'/);
  // Check keyboard navigation shortcuts exist
  assert.match(js, /Ctrl\s*\+\s*K/i);
  assert.match(js, /Alt\+1/);
});
