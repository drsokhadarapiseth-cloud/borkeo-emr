import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');


test('v31.1 EMR.html moves camera button into photo frame and removes external text button', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  // Verify external text button is removed from OPD and IPD banners
  assert.ok(!emrHtml.includes('📷 រូបថតអ្នកជំងឺ'), 'External "📷 រូបថតអ្នកជំងឺ" text button must be removed from EMR.html banners');

  // Verify photo-retake-camera-badge exists inside photo frames
  assert.ok(emrHtml.includes('class="photo-retake-camera-badge"'), 'EMR.html must contain photo-retake-camera-badge');
  assert.ok(emrHtml.includes('data-action="capture-patient-photo"'), 'Badge must have data-action="capture-patient-photo"');
});

test('v31.1 patient-photo.js updates frame with photo-retake-camera-badge', () => {
  const photoJs = fs.readFileSync(path.join(root, 'public', 'patient-photo.js'), 'utf8');
  assert.ok(photoJs.includes('photo-retake-camera-badge'), 'patient-photo.js must render camera badge inside photo frames');
  assert.ok(photoJs.includes('capture-patient-photo'), 'patient-photo.js must hook camera badge to capture action');
});

test('v31.1 patient-photo.css defines camera badge overlay styling and print exclusion', () => {
  const photoCss = fs.readFileSync(path.join(root, 'public', 'patient-photo.css'), 'utf8');
  assert.ok(photoCss.includes('.photo-retake-camera-badge'), 'patient-photo.css must style .photo-retake-camera-badge');
  assert.ok(photoCss.includes('position: absolute'), 'Camera badge must be positioned absolutely over photo');
  assert.ok(photoCss.includes('border-radius: 50%'), 'Camera badge must be circular');
  assert.ok(photoCss.includes('.photo-retake-camera-badge') && photoCss.includes('display: none !important'), 'Camera badge must be hidden during print');
});
