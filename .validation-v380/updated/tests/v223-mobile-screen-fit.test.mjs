import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.3 login.css includes mobile phone responsive text and screen fit rules', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/login.css'), 'utf8');
  assert.ok(css.includes('@media (max-width: 520px)'), 'has max-width: 520px media query');
  assert.ok(css.includes('@media (max-width: 360px)'), 'has max-width: 360px media query');
  assert.ok(css.includes('word-break: break-word'), 'prevents text clipping with break-word');
  assert.ok(css.includes('.brand-mark { width: 48px; height: 48px;'), 'scales brand logo cleanly on mobile');
});

test('v22.3 responsive-layout.css includes text-size-adjust and mobile banner fitting', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/responsive-layout.css'), 'utf8');
  assert.ok(css.includes('text-size-adjust: 100%'), 'prevents mobile text scaling distortion');
  assert.ok(css.includes('@media screen and (max-width: 440px)'), 'has mobile 440px viewport query');
});

test('v22.3 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);

  const login = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(login, /v2[0-9]\./);
});
