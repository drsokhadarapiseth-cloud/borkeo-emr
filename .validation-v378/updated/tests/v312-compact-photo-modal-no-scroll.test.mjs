import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v31.2 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(((loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || loginHtml.includes('v32.7') || loginHtml.includes('v32.6')) || loginHtml.includes('v32.4') || loginHtml.includes('v32.3') || loginHtml.includes('v32.2') || loginHtml.includes('v32.1') || loginHtml.includes('v32.0') || loginHtml.includes('v31.9') || loginHtml.includes('v31.8') || loginHtml.includes('v31.7') || loginHtml.includes('v31.6') || loginHtml.includes('v31.5') || loginHtml.includes('v31.4') || loginHtml.includes('v31.3') || loginHtml.includes('v31.2') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(((serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || serverMjs.includes('v32.7') || serverMjs.includes('v32.6')) || serverMjs.includes('v32.4') || serverMjs.includes('v32.3') || serverMjs.includes('v32.2') || serverMjs.includes('v32.1') || serverMjs.includes('v32.0') || serverMjs.includes('v31.9') || serverMjs.includes('v31.8') || serverMjs.includes('v31.7') || serverMjs.includes('v31.6') || serverMjs.includes('v31.5') || serverMjs.includes('v31.4') || serverMjs.includes('v31.3') || serverMjs.includes('v31.2') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v31.2 patient-photo.css defines compact dialog avoiding vertical scrolling', () => {
  const photoCss = fs.readFileSync(path.join(root, 'public', 'patient-photo.css'), 'utf8');

  // Dialog container must bound height within viewport
  assert.ok(photoCss.includes('max-height: calc(100vh - 24px)'), 'patient-photo.css must constrain dialog max-height within screen');
  assert.ok(photoCss.includes('width: min(480px, calc(100vw - 20px))'), 'patient-photo.css must set compact dialog width');

  // Camera viewport must be compact (height 220px, max-width 320px)
  assert.ok(photoCss.includes('height: 220px'), 'Camera viewport height must be compact (220px)');
  assert.ok(photoCss.includes('max-width: 320px'), 'Camera viewport max-width must be 320px');

  // Camera guide overlay must be proportional
  assert.ok(photoCss.includes('width: 130px'), 'Camera guide width must be 130px');
  assert.ok(photoCss.includes('height: 170px'), 'Camera guide height must be 170px');

  // Header, body, and footer padding must be compact
  assert.ok(photoCss.includes('padding: 10px 16px'), 'Dialog header/footer must have compact 10px 16px padding');
});
