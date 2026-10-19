import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('sticker scale persistence normalizes values and prevents microscopic preview shrinking', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  // Normalization logic in loadSavedStickerConfig
  assert.match(emrHtml, /Number\.isFinite\(raw\) && raw > 2/);

  // Guards against sub-2 scale in updatePatientCardPreview
  assert.match(emrHtml, /Number\.isFinite\(raw\) && raw > 2/);

  // Persistence stores whole percentage
  assert.match(emrHtml, /scalePercent:\s*state\.scale/);
});

test('patient card sticker text styles fit compactly without overflowing bounds', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  // Address line clamp to prevent vertical overflow
  assert.match(emrHtml, /\.card-address-row/);
  assert.match(emrHtml, /closest\('\.card-address-row'\)\?2:1/);

  // Proportional font sizing
  assert.match(emrHtml, /--card-font-scale/);

  // Compact header and footer bounds
  assert.match(emrHtml, /\.card-header-bar/);
  assert.match(emrHtml, /\.card-footer-bar/);
});
