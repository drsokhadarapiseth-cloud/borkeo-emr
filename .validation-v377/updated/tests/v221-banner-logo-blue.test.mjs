import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.1 banner hospital name and eyebrow use deep hospital logo blue color', () => {
  const themeCss = fs.readFileSync(path.join(process.cwd(), 'public/interface-theme.css'), 'utf8');
  assert.ok(themeCss.includes('color:#003b8e!important'), 'interface-theme.css uses #003b8e for hospital title');
  assert.ok(themeCss.includes('color:#004b99!important'), 'interface-theme.css uses #004b99 for eyebrow subtitle');

  const loginCss = fs.readFileSync(path.join(process.cwd(), 'public/login.css'), 'utf8');
  assert.ok(loginCss.includes('color: #003b8e;'), 'login.css uses #003b8e for hospital-name-kh');
  assert.ok(loginCss.includes('color: #004b99;'), 'login.css uses #004b99 for eyebrow');
});

test('v22.1 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);

  const login = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(login, /v2[0-9]\./);
});
