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

test('v43.7: Top bar renders direct inline search input and attached instant dropdown', () => {
  const shell = read('public/app-shell.js');
  const css = read('public/app-shell.css');

  // Verify inline search input markup in the top bar
  assert.ok(shell.includes('id="emr-global-search-input"'), 'app-shell.js must define inline input #emr-global-search-input');
  assert.ok(shell.includes('id="emr-topbar-search-dropdown"'), 'app-shell.js must define dropdown #emr-topbar-search-dropdown');
  assert.ok(shell.includes('id="emr-search-dropdown-list"'), 'app-shell.js must define dropdown list #emr-search-dropdown-list');

  // Verify CSS styles for inline input and dropdown
  assert.ok(css.includes('.emr-topbar-search-wrap'), 'app-shell.css must define .emr-topbar-search-wrap');
  assert.ok(css.includes('.emr-topbar-search-input'), 'app-shell.css must define .emr-topbar-search-input');
  assert.ok(css.includes('.emr-topbar-search-dropdown'), 'app-shell.css must define .emr-topbar-search-dropdown');
  assert.ok(css.includes('.emr-search-dropdown-item'), 'app-shell.css must define .emr-search-dropdown-item');
});

test('v43.7: app-shell.js implements CSRF token auto-recovery on context and Superuser user-type switch', () => {
  const shell = read('public/app-shell.js');

  // Verify CSRF retry on 403 in switchContext
  assert.ok(
    shell.includes('if (res.status === 403)') && shell.includes("fetch('/api/auth/me'"),
    'switchContext and emr-user-type-form must auto-refresh token from /api/auth/me on 403'
  );
  assert.ok(
    shell.includes("headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': meData.csrfToken }"),
    'Must retry request using refreshed csrfToken'
  );
});
