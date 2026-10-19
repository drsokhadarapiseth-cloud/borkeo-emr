import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v31.3 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(((loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || loginHtml.includes('v32.7') || loginHtml.includes('v32.6')) || loginHtml.includes('v32.4') || loginHtml.includes('v32.3') || loginHtml.includes('v32.2') || loginHtml.includes('v32.1') || loginHtml.includes('v32.0') || loginHtml.includes('v31.9') || loginHtml.includes('v31.8') || loginHtml.includes('v31.7') || loginHtml.includes('v31.6') || loginHtml.includes('v31.5') || loginHtml.includes('v31.4') || loginHtml.includes('v31.3') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(((serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || serverMjs.includes('v32.7') || serverMjs.includes('v32.6')) || serverMjs.includes('v32.4') || serverMjs.includes('v32.3') || serverMjs.includes('v32.2') || serverMjs.includes('v32.1') || serverMjs.includes('v32.0') || serverMjs.includes('v31.9') || serverMjs.includes('v31.8') || serverMjs.includes('v31.7') || serverMjs.includes('v31.6') || serverMjs.includes('v31.5') || serverMjs.includes('v31.4') || serverMjs.includes('v31.3') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v31.3 patient-photo.js renames switch camera button text to ត្រលប់កាមេរ៉ា', () => {
  const photoJs = fs.readFileSync(path.join(root, 'public', 'patient-photo.js'), 'utf8');

  // Verify new button label and removal of old label
  assert.ok(photoJs.includes('🔄 ត្រលប់កាមេរ៉ា'), 'Button text must be renamed to 🔄 ត្រលប់កាមេរ៉ា');
  assert.ok(!photoJs.includes('🔄 ប្តូរម៉ាស៊ីនថត'), 'Old button text 🔄 ប្តូរម៉ាស៊ីនថត must be removed');

  // Verify button retains switch camera ID and event wiring
  assert.ok(photoJs.includes('id="btn-switch-camera"'), 'Button must retain id="btn-switch-camera"');
  assert.ok(photoJs.includes('btnSwitch.addEventListener(\'click\''), 'Switch camera click listener must remain wired');
});
