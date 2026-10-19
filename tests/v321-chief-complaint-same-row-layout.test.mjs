import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');


test('v32.1 protected/EMR.html aligns chief complaint title and tags on same row and deletes box actions', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  const page2Part = emrHtml.split('id="page2"')[1].split('id="page3"')[0];
  assert.ok(page2Part.includes('class="chief-complaint-row"'), 'Page 2 must contain chief-complaint-row container');

  // Verify same row container houses both title and tag box
  const rowBlock = page2Part.split('class="chief-complaint-row"')[1].split('id="triage_patient_photo_container"')[0];
  assert.ok(rowBlock.includes('data-key="refer_sign"'), 'Title must be inside chief-complaint-row');
  assert.ok(rowBlock.includes('id="chief_complaint_tag_box"'), 'Tag box must be inside chief-complaint-row');
  assert.ok(rowBlock.includes('id="cc_inline_input"') || rowBlock.includes('id="cc_search_input"'), 'Input must be inside container');

  // Verify cross and down arrow on the right side of box are removed
  assert.ok(!rowBlock.includes('id="cc_clear_all"'), 'Clear all cross on box must be deleted');
  assert.ok(!rowBlock.includes('id="cc_toggle_dropdown"'), 'Toggle dropdown arrow on box must be deleted');
  assert.ok(!rowBlock.includes('class="cc-box-actions"'), 'cc-box-actions container must be deleted');
});

test('v32.1 public/chief-complaint-tags.css defines single row alignment and print styles', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'chief-complaint-tags.css'), 'utf8');

  assert.ok(css.includes('.chief-complaint-row'), 'css must define .chief-complaint-row');
  assert.ok(css.includes('.cc-tag-box'), 'css must define .cc-tag-box');
  assert.ok(css.includes('.cc-tag'), 'css must define .cc-tag');
  assert.ok(css.includes('.cc-tag-remove'), 'css must define .cc-tag-remove');
  assert.ok(!css.includes('.cc-box-actions'), 'css must not include .cc-box-actions');
  assert.ok(css.includes('@media print'), 'css must define print hiding rules');
});
