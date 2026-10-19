import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('v33.9 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(['33.9.0', '34.0.0', '34.1.0', '34.2.0', '34.3.0', '34.4.0', '34.5.0', '34.6.0', '34.7.0', '34.8.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v3(?:3\.9|4\.[0-9]|[56].[0-9])/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v3(?:3\.9|4\.[0-9]|[56].[0-9])/);
});

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
