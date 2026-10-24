/**
 * Test Suite: v43.5 Same-Row Action Bar for Registration
 * Verifies that the Save button and Send to Triage button reside in the same unified row
 * at the bottom of the registration form.
 */

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

test('v43.5: EMR.html declares #reg_action_bar containing Send to Triage button', () => {
  const emrHtml = read('protected/EMR.html');
  assert.ok(emrHtml.includes('id="reg_action_bar"'), 'EMR.html must declare #reg_action_bar');
  assert.match(emrHtml, /id="reg_action_bar"[^>]*>[\s\S]*?class="btn-next"[^>]*>បញ្ជូនទៅផ្នែកទ្រីយ៉ា<\/button>/,
    '#reg_action_bar must contain the Send to Triage button');
});

test('v43.5: emr-encounter-editor.js prepends toolbar inside registration action bar', () => {
  const editorJs = read('public/emr-encounter-editor.js');
  assert.match(editorJs, /current\s*===\s*'register'\s*\?\s*\(root\.querySelector\('\.action-bar'\)/,
    'emr-encounter-editor.js must detect registration action bar');
  assert.match(editorJs, /regActionBar\.prepend\(bar\)/,
    'emr-encounter-editor.js must prepend encounter toolbar into regActionBar');
});

test('v43.5: emr-encounter-editor.css styles registration toolbar for same-row alignment', () => {
  const editorCss = read('public/emr-encounter-editor.css');
  assert.ok(editorCss.includes('#reg_action_bar .emr-encounter-toolbar'),
    'emr-encounter-editor.css must style #reg_action_bar .emr-encounter-toolbar');
  assert.match(editorCss, /#reg_action_bar\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*flex-end;\s*gap:\s*12px;/,
    '#reg_action_bar must use flex alignment with gap');
  assert.ok(editorCss.includes('#reg_action_bar button[data-editor-toggle]'),
    '#reg_action_bar must style data-editor-toggle button');
});
