import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v27.7 server/server.mjs provides IMAGING_SUBTYPE_DETAILS in /api/admin/users', () => {
  const server = fs.readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /imagingSubtypeDetails:\s*IMAGING_SUBTYPE_DETAILS/);
});

test('v27.7 public/admin-users.js renders direct modality grid with all 13 diagnostic imaging modalities', () => {
  const js = fs.readFileSync(new URL('../public/admin-users.js', import.meta.url), 'utf8');
  const expectedModalities = [
    'ULTRASOUND', 'XRAY', 'ECG', 'CT', 'MRI',
    'ECHOCARDIOLOGY', 'EEG', 'FIBROSCOPY', 'COLOSCOPY',
    'OTOSCOPY', 'RHINOSCOPY', 'LARYNGOSCOPY', 'BRONCHOSCOPY'
  ];

  for (const mod of expectedModalities) {
    assert.match(js, new RegExp(`code:\\s*'${mod}'`), `Modalities list includes ${mod}`);
  }

  assert.match(js, /direct-modality-grid/, 'Renders direct modality grid container');
  assert.match(js, /modality-item-card/, 'Renders modality item cards');
  assert.match(js, /btn-toggle-all-subtypes/, 'Maintains select all toggle button');
});

test('v27.7 public/admin-users.css contains styling for direct modality grid and cards', () => {
  const css = fs.readFileSync(new URL('../public/admin-users.css', import.meta.url), 'utf8');
  assert.match(css, /\.direct-modality-grid/, 'CSS defines .direct-modality-grid');
  assert.match(css, /\.modality-item-card/, 'CSS defines .modality-item-card');
});
