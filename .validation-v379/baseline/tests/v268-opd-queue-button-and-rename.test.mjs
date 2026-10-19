import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('v26.8 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.version >= '26.8.0');

  const loginHtml = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
  assert.match(loginHtml, /v2[6-8]\./);

  const server = fs.readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /v2[6-8]\./);
});

test('v26.8 protected/opd-queue.html removes the bottom ពិនិត្យលេខរៀង button from toolbar', () => {
  const html = fs.readFileSync(new URL('../protected/opd-queue.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /data-opd-tv/);
  assert.doesNotMatch(html, /tv-display-tab/);
  assert.doesNotMatch(html, /ពិនិត្យលេខរៀង/);
});

test('v26.8 queue display navigation links renamed to បើកផ្ទាំងលេខរៀង', () => {
  const sessionJs = fs.readFileSync(new URL('../public/emr-session.js', import.meta.url), 'utf8');
  const navMjs = fs.readFileSync(new URL('../server/navigation-settings.mjs', import.meta.url), 'utf8');
  const pharmacyOpdHtml = fs.readFileSync(new URL('../protected/pharmacy-opd.html', import.meta.url), 'utf8');

  // Doctor OPD
  assert.match(sessionJs, /\/queue-display\?service=OPD','បើកផ្ទាំងលេខរៀង'/);
  assert.match(navMjs, /\/queue-display\?service=OPD','បើកផ្ទាំងលេខរៀង'/);

  // Triage
  assert.match(sessionJs, /\/queue-display\?service=TRIAGE','បើកផ្ទាំងលេខរៀង'/);
  assert.match(navMjs, /\/queue-display\?service=TRIAGE','បើកផ្ទាំងលេខរៀង'/);

  // Pharmacy
  assert.match(sessionJs, /\/pharmacy\/display','បើកផ្ទាំងលេខរៀង'/);
  assert.match(navMjs, /\/pharmacy\/display','បើកផ្ទាំងលេខរៀង'/);
  assert.match(pharmacyOpdHtml, /href="\/pharmacy\/display"[^>]*>បើកផ្ទាំងលេខរៀង<\/a>/);
});
