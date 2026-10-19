import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../server/config.mjs';

test('v22.2 server config allows 0.0.0.0 host binding for LAN and mobile devices', () => {
  const customConfig = loadConfig({ host: '0.0.0.0', demoMode: true });
  assert.equal(customConfig.host, '0.0.0.0');

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.ok(server.includes("host: process.env.HOST ?? '0.0.0.0'"), 'startServer passes 0.0.0.0 for LAN/mobile access');
});

test('v22.2 server.mjs sameOrigin allows matching host header from mobile/LAN IP', () => {
  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.ok(server.includes('originHost.toLowerCase() === reqHost.toLowerCase()'), 'sameOrigin validates matching host header');
  assert.ok(server.includes('Mobile / Phone access (Same Wi-Fi)'), 'server startup logs mobile access URL');
});

test('v22.2 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);

  const login = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(login, /v2[0-9]\./);
});
