import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('Phase 8: Version consistency across package.json, server.mjs, and login.html', () => {
  const pkg = JSON.parse(read('package.json'));
  const serverCode = read('server/server.mjs');
  const loginHtml = read('public/login.html');

  assert.equal(pkg.version, '42.3.0', 'package.json version must be 42.3.0');
  assert.match(serverCode, /Borkeo EMR v(?:39\.[6-9]|4[0-9]\.[0-9])/, 'server.mjs must declare v39.6 or above');
  assert.match(serverCode, /design-system\.css\?v=3970/, 'server.mjs must inject design-system.css with v=3970');
  assert.match(serverCode, /worklists-feedback\.css\?v=3970/, 'server.mjs must inject worklists-feedback.css with v=3970');
  assert.match(loginHtml, /data-app-version[^>]*>v42\.3<\/span>/, 'login.html must display v42.3');
});

test('Phase 8: Complete presentation-layer suite of assets is present and registered', () => {
  const assets = [
    'public/design-system.css',
    'public/components.css',
    'public/components.js',
    'public/app-shell.css',
    'public/app-shell.js',
    'public/patient-banner.css',
    'public/patient-banner.js',
    'public/soap-note.css',
    'public/soap-note.js',
    'public/clinical-data.css',
    'public/clinical-data.js',
    'public/worklists-feedback.css',
    'public/worklists-feedback.js'
  ];

  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(rootDir, asset)), `Asset ${asset} must exist on disk`);
  }

  const serverCode = read('server/server.mjs');
  for (const asset of assets) {
    const filename = path.basename(asset);
    assert.ok(serverCode.includes(filename), `server.mjs must reference ${filename}`);
  }
});

test('Phase 8: WCAG 2.2 AA accessibility features are defined in CSS', () => {
  const dsCss = read('public/design-system.css');

  // Focus visible (WCAG 2.4.7)
  assert.match(dsCss, /:focus-visible/, 'Must define :focus-visible rules');

  // Skip-to-content links (WCAG 2.4.1)
  assert.match(dsCss, /\.skip-link/, 'Must define .skip-link class');

  // Screen-reader utilities (WCAG 4.1.2)
  assert.match(dsCss, /\.sr-only/, 'Must define .sr-only class');
  assert.match(dsCss, /\.visually-hidden/, 'Must define .visually-hidden class');

  // Reduced motion preference (WCAG 2.3.3)
  assert.match(dsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Must honor prefers-reduced-motion');

  // Windows Forced Colors / High Contrast mode
  assert.match(dsCss, /@media\s*\(forced-colors:\s*active\)/, 'Must support forced-colors mode');
});

test('Phase 8: Zero external CDN dependencies across core templates and strict local assets', () => {
  const templates = [
    'public/login.html',
    'protected/EMR.html',
    'protected/queue-display.html'
  ];

  for (const tpl of templates) {
    const content = read(tpl);
    assert.doesNotMatch(content, /https?:\/\/(?!localhost|127\.0\.0\.1|cdnjs\.cloudflare\.com|cdn\.)[a-z0-9.-]+\.cdn/i, `${tpl} must not contain external CDN scripts or styles`);
    assert.doesNotMatch(content, /https?:\/\/fonts\.googleapis\.com/i, `${tpl} must not load Google Fonts externally`);
  }
});

test('Phase 8: UI Standards documentation exists with WCAG 2.2 AA, IEC 62366-1, and explicit non-claims', () => {
  const doc = read('docs/UI_STANDARDS.md');

  assert.match(doc, /WCAG 2\.2 Level AA/, 'UI_STANDARDS.md must document WCAG 2.2 AA alignment');
  assert.match(doc, /IEC 62366-1/, 'UI_STANDARDS.md must document IEC 62366-1 alignment');
  assert.match(doc, /Explicit Non-Claims/, 'UI_STANDARDS.md must have Explicit Non-Claims section');
  assert.match(doc, /No Formal Regulatory Certification/, 'UI_STANDARDS.md must disclaim formal certification');
  assert.match(doc, /No FHIR \/ HL7 Conformance Claim/, 'UI_STANDARDS.md must state no FHIR/HL7 claims');
});
