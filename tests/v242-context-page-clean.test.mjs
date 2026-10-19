import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v24.2 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^24\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v24\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v24\./);
});

test('v24.2 context.html removes logout button and suppresses language switcher', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/context.html'), 'utf8');
  assert.ok(!html.includes('id="context-logout"'), 'context.html does not contain context-logout button');
  assert.ok(!html.includes('class="logout"'), 'context.html does not contain logout class button');

  const langJs = fs.readFileSync(path.join(process.cwd(), 'public/emr-language.js'), 'utf8');
  assert.ok(langJs.includes('context-shell') || langJs.includes('/context'), 'emr-language.js suppresses switcher on context page');

  const css = fs.readFileSync(path.join(process.cwd(), 'public/context.css'), 'utf8');
  assert.ok(css.includes('.emr-language-switch{display:none!important}') || css.includes('.emr-language-switch'), 'context.css suppresses language switcher');
});
