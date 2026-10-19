import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';

const read = file => fs.readFileSync(file, 'utf8');

test('Phase 4: Version consistency across package.json, server.mjs, and login.html', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^39\.[3-9]\.0$/);

  const serverSrc = read('server/server.mjs');
  assert.match(serverSrc, /Borkeo EMR v39\.[3-9]/);

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /data-app-version[^>]*>v39\.[3-9]<\/span>/);
});

test('Phase 4: Patient banner and chart assets are served statically with correct content types', async () => {
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
    assert.match(cssText, /\.emr-patient-banner/);
    assert.match(cssText, /\.emr-chart-tabs/);
    assert.match(cssText, /\.emr-summary-dashboard/);
    assert.match(cssText, /\.allergy-alert/);

    const jsRes = await fetch(`${origin}/public/patient-banner.js`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type'), /javascript/);
    const jsText = await jsRes.text();
    assert.match(jsText, /initPatientBannerAndChart/);
    assert.match(jsText, /renderPatientBanner/);
    assert.match(jsText, /createSummaryDashboard/);
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

test('Phase 4: Khmer-only default presentation and 7 Chart Tabs in patient-banner.js', () => {
  const js = read('public/patient-banner.js');
  // Check no bilingual slash text in banner labels or tabs
  assert.doesNotMatch(js, /['"][^'"]+\s+\/\s+[A-Za-z]+['"]/);
  // Check 7 chart tabs exist in Khmer
  assert.match(js, /<span>សង្ខេប<\/span>/);
  assert.match(js, /<span>សញ្ញាជីវិត<\/span>/);
  assert.match(js, /<span>បញ្ជា<\/span>/);
  assert.match(js, /<span>លទ្ធផល<\/span>/);
  assert.match(js, /<span>ឱសថ<\/span>/);
  assert.match(js, /<span>កំណត់ត្រា<\/span>/);
  assert.match(js, /<span>បេឡា<\/span>/);
  // Check allergy and payer badges in Khmer
  assert.match(js, /គ្មានប្រវត្តិអាលែកហ្ស៊ី/);
  assert.match(js, /អាលែកហ្ស៊ី/);
  assert.match(js, /មូលនិធិសមធម៌/);
  assert.match(js, /មិនបានបញ្ជាក់/);
});
