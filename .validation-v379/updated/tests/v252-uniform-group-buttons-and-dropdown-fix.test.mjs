import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v25.2 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^25\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v25\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v25\./);
});

test('v25.2 imaging.html has data-language-exclude on toolbar, groups bar, and films tab with uniform button class', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  assert.ok(html.includes('id="imaging-groups-bar" data-language-exclude'), 'imaging-groups-bar has data-language-exclude');
  assert.ok(html.includes('class="group-btn-all group-btn-films" id="imaging-films-tab" role="button" data-language-exclude'), 'Films tab has uniform group button class and data-language-exclude');
  assert.ok(html.indexOf('paraclinic-workspace.css') < html.indexOf('imaging.css'), 'imaging.css is loaded after paraclinic-workspace.css');
});

test('v25.2 imaging.js defines pure English ENT group without translation triggers', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/imaging.js'), 'utf8');
  assert.ok(js.includes("name: 'ENT'"), 'ENT group name is pure English ENT');
  assert.ok(!js.includes("name: 'ENT (Ear, Nose, Throat)'"), 'No dictionary-triggering parenthetical in ENT name');
  assert.ok(js.includes('data-language-exclude'), 'renderGroupsBar stamps data-language-exclude on all buttons');
});

test('v25.2 imaging.css ensures overflow visibility and uniform button height and styling', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/imaging.css'), 'utf8');
  assert.ok(css.includes('overflow:visible !important') || css.includes('overflow: visible !important'), 'Toolbar overflow is visible for dropdown menus');
  assert.ok(css.includes('z-index:99999 !important') || css.includes('z-index: 99999 !important'), 'Dropdown menus have top z-index');
  assert.ok(css.includes('min-height:3'), 'Uniform minimum button height');
  assert.ok(css.includes('.group-btn-films'), 'Includes dedicated styling for films button');
});
