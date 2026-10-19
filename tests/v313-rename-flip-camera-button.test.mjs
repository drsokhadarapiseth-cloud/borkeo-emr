import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');


test('v31.3 patient-photo.js renames switch camera button text to ត្រលប់កាមេរ៉ា', () => {
  const photoJs = fs.readFileSync(path.join(root, 'public', 'patient-photo.js'), 'utf8');

  // Verify new button label and removal of old label
  assert.ok(photoJs.includes('🔄 ត្រលប់កាមេរ៉ា'), 'Button text must be renamed to 🔄 ត្រលប់កាមេរ៉ា');
  assert.ok(!photoJs.includes('🔄 ប្តូរម៉ាស៊ីនថត'), 'Old button text 🔄 ប្តូរម៉ាស៊ីនថត must be removed');

  // Verify button retains switch camera ID and event wiring
  assert.ok(photoJs.includes('id="btn-switch-camera"'), 'Button must retain id="btn-switch-camera"');
  assert.ok(photoJs.includes('btnSwitch.addEventListener(\'click\''), 'Switch camera click listener must remain wired');
});
