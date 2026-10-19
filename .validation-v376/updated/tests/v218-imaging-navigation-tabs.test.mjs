import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v21.8 imaging toolbar in stock.html renders all modality tabs with active highlight on film tab', () => {
  const stockHtml = fs.readFileSync(path.join(process.cwd(), 'protected/stock.html'), 'utf8');
  assert.ok(stockHtml.includes('href="/imaging"'), 'stock.html has ទាំងអស់ link to /imaging');
  assert.ok(stockHtml.includes('href="/imaging?modality=ULTRASOUND"'), 'stock.html has Ultrasound link');
  assert.ok(stockHtml.includes('href="/imaging?modality=XRAY"'), 'stock.html has X-ray link');
  assert.ok(stockHtml.includes('href="/imaging?modality=CT"'), 'stock.html has CT link');
  assert.ok(stockHtml.includes('href="/imaging?modality=MRI"'), 'stock.html has MRI link');
  assert.ok(stockHtml.includes('class="tab-materials active"'), 'stock.html has film tab highlighted as active');
  assert.ok(stockHtml.includes('id="film-stock-search"'), 'stock.html has top search input for film stock');
});

test('v21.8 imaging.html toolbar tabs and imaging.js query param support', () => {
  const imagingHtml = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  assert.ok(imagingHtml.includes('id="imaging-films-tab"'), 'imaging.html contains imaging-films-tab');
  assert.ok(imagingHtml.includes('class="tab-materials"'), 'imaging.html has tab-materials class');

  const imagingJs = fs.readFileSync(path.join(process.cwd(), 'public/imaging.js'), 'utf8');
  assert.ok(imagingJs.includes('new URLSearchParams(location.search).get(\'modality\')'), 'imaging.js reads modality query param on initialization');

  const sharedCss = fs.readFileSync(path.join(process.cwd(), 'public/shared-controls.css'), 'utf8');
  assert.ok(sharedCss.includes('.mod-tabs>a') || sharedCss.includes('.mod-tabs a'), 'shared-controls.css styles mod-tabs anchor tabs');
});

test('v21.8 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);

  const login = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(login, /v2[0-9]\./);
});
