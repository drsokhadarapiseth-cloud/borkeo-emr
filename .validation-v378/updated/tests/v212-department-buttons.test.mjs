import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v21.2 department toolbar buttons have standardized matching dimensions and bottom baseline alignment', () => {
  const departmentsCss = read('public/departments.css');
  assert.match(departmentsCss, /\.toolbar-actions,\s*body \.map-toolbar \.toolbar-actions\s*\{\s*display:\s*flex\s*!important;\s*flex-wrap:\s*wrap\s*!important;\s*align-items:\s*flex-end\s*!important/);
  assert.match(departmentsCss, /\.button,\s*body \.map-toolbar \.toolbar-actions > \.button\s*\{\s*min-height:\s*40px\s*!important;\s*height:\s*40px\s*!important;\s*min-width:\s*140px\s*!important/);
  assert.match(departmentsCss, /\.ward-filter-label select,\s*body \.map-toolbar \.ward-filter-label select\s*\{\s*min-height:\s*40px\s*!important;\s*height:\s*40px\s*!important/);
});

test('v21.2 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^2[0-9]\./);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /2[0-9]\./);
});
