import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');


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
