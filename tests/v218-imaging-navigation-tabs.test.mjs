import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v21.8 imaging toolbar in stock.html renders all modality tabs with active highlight on film tab', () => {
  const stockHtml = fs.readFileSync(path.join(process.cwd(), 'protected/stock.html'), 'utf8');
  assert.ok(stockHtml.includes('href="/imaging"'), 'stock.html has ទាំងអស់ link to /imaging');
  assert.ok(stockHtml.includes('href="/imaging?modality=XRAY"'), 'stock.html has X-ray link');
  assert.ok(stockHtml.includes('group-btn-films active'), 'stock.html has film tab highlighted as active');
  assert.ok(stockHtml.includes('id="film-stock-search"'), 'stock.html has top search input for film stock');
});

test('v21.8 imaging.html toolbar tabs and imaging.js query param support', () => {
  const imagingHtml = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  assert.ok(imagingHtml.includes('id="imaging-films-tab"'), 'imaging.html contains imaging-films-tab');
  assert.ok(imagingHtml.includes('group-btn-films'), 'imaging.html has group-btn-films class');

  const imagingJs = fs.readFileSync(path.join(process.cwd(), 'public/imaging.js'), 'utf8');
  assert.ok(imagingJs.includes('new URLSearchParams(location.search).get(\'modality\')'), 'imaging.js reads modality query param on initialization');

  const sharedCss = fs.readFileSync(path.join(process.cwd(), 'public/shared-controls.css'), 'utf8');
  assert.ok(sharedCss.includes('.mod-tabs') || sharedCss.includes('.group-btn-films'), 'shared-controls.css styles mod-tabs or group-btn-films anchor tabs');
});

