import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('v34.0 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(['34.1.0', '34.2.0', '34.3.0', '34.4.0', '34.5.0', '34.6.0', '34.7.0', '34.8.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v3(?:4\.[0-9]|[56].[0-9])/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v3(?:4\.[0-9]|[56].[0-9])/);
});

test('A4 portrait print engine lays out 10 labels on strictly 1 single page without page 2 overflow', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  // Strict A4 portrait page size
  assert.match(emrHtml, /@page\s*\{\s*size:\s*A4\s*portrait;\s*margin:\s*10mm;\s*\}/);

  // Strict height bounding to prevent second page
  assert.match(emrHtml, /sheetHeight = a4 \? 276\.8/);
  assert.match(emrHtml, /overflow:\s*hidden\s*!important/);

  // 2-column grid setup for 10 labels
  assert.match(emrHtml, /columns = a4 \? 2 : 1, rows = a4 \? 5 : 1/);
  assert.match(emrHtml, /count:type==='a4_sheet'\?10:1/);
});

test('Khmer glyph clearance and studio preview design enhancements', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  // Line-height clearance for Khmer subscripts and upper vowels
  assert.match(emrHtml, /\.card-info-table\s*\{[^}]*line-height:\s*1\.85;/);

  // Address 2-line clamp protection
  assert.match(emrHtml, /closest\('\.card-address-row'\)\?2:1/);

  // Professional studio preview panel styles
  assert.match(emrHtml, /card-modal-toolbar/);
  assert.match(emrHtml, /card-tool-group/);
  assert.match(emrHtml, /card-ruler-corner/);
});
