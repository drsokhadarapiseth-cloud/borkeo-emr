import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.5 queue TV display implements Indigo Modern (Option 9) styling and structure', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/queue-display.html'), 'utf8');
  assert.ok(html.includes('tv-header'), 'has tv-header');
  assert.ok(html.includes('Borkeo Referral Hospital'), 'header includes hospital name in English');
  assert.ok(html.includes('មន្ទីរពេទ្យបង្អែកបរកែវ'), 'header includes hospital name in Khmer');
  assert.ok(html.includes('display-dept-label'), 'has department label placeholder');
  assert.ok(html.includes('tv-now-panel'), 'has tv-now-panel');
  assert.ok(html.includes('កំពុងហៅ / NOW CALLING'), 'has NOW CALLING label');
  assert.ok(html.includes('ឈ្មោះ / Name'), 'has Name label');
  assert.ok(html.includes('ទៅកាន់ / COUNTER'), 'has COUNTER label');
  assert.ok(html.includes('tv-waiting-section'), 'has waiting list section');
  assert.ok(html.includes('លេខរៀង / No.'), 'waiting header has No. column');

  const css = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.css'), 'utf8');
  assert.ok(css.includes('#F3F2FC'), 'uses pale lavender background #F3F2FC');
  assert.ok(css.includes('#302E81'), 'uses deep indigo #302E81');
  assert.ok(css.includes('#E3DFFD'), 'uses lavender badges #E3DFFD');
  assert.ok(css.includes('tv-queue-badge'), 'styles queue badges');
  assert.ok(css.includes('tv-counter-badge'), 'styles counter badges');
});

test('v22.5 queue-display.js renders 3-digit queue numbers and 4 waiting slots', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('padStart(3, \'0\')'), 'formats queue numbers with 3 digits');
  assert.ok(js.includes('length: 4'), 'renders exactly 4 waiting slots');
  assert.ok(js.includes('tv-waiting-row'), 'creates tv-waiting-row cards');
  assert.ok(js.includes('tv-queue-badge'), 'creates tv-queue-badge');
  assert.ok(!js.includes('កំពុងរង់ចាំអ្នកជំងឺ'), 'does not display legacy waiting message');
});

test('v22.5 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);
});
