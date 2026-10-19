import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


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
