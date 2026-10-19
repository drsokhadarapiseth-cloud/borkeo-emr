import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v24.0 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^24\./);

  const login = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(login, /v24\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /v24\./);
});

test('v24.0 EMR.html includes vertical spacing for chief complaint above department table', () => {
  const emrHtml = fs.readFileSync(path.join(process.cwd(), 'protected/EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('pmrs_chief_complaint'), 'has pmrs_chief_complaint input');
  assert.ok(emrHtml.includes('margin: 12px 0 14px 0') || emrHtml.includes('margin:12px 0 14px 0'), 'has spacing wrapper around chief complaint');
});
