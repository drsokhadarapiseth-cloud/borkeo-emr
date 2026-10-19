import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v25.4 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^25\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v25\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v25\./);
});

test('v25.4 imaging.js uses streamlined tab labels with full specialty descriptions in submenus', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/imaging.js'), 'utf8');
  assert.ok(js.includes("name: 'Radiology'"), 'Uses compact Radiology label');
  assert.ok(js.includes("name: 'Endoscopy'"), 'Uses compact Endoscopy label');
  assert.ok(js.includes('>All</button>'), 'Uses compact All tab label');
  assert.ok(js.includes('General Radiology'), 'Preserves General Radiology full title');
  assert.ok(js.includes('Endoscopy & GI'), 'Preserves Endoscopy & GI full title');
});

test('v25.4 imaging.css ensures 1-row flex nowrap toolbar fit and compact sizing', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/imaging.css'), 'utf8');
  assert.ok(css.includes('flex-wrap:nowrap !important') || css.includes('flex-wrap: nowrap !important'), 'Forces nowrap on workspace toolbar and filters');
  assert.ok(css.includes('min-height:32px !important') || css.includes('height:32px !important'), 'Uses compact 32px tab height');
  assert.ok(css.includes('clamp(120px'), 'Streamlines search input width');
});
