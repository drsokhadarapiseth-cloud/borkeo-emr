import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('version metadata consistency across package.json, login.html, and server.mjs', () => {
  const pkgPath = path.join(projectRoot, 'package.json');
  const loginPath = path.join(projectRoot, 'public', 'login.html');
  const serverPath = path.join(projectRoot, 'server', 'server.mjs');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const loginHtml = fs.readFileSync(loginPath, 'utf8');
  const serverMjs = fs.readFileSync(serverPath, 'utf8');

  // Extract versions
  const pkgVersion = pkg.version; // e.g. "38.2.0"
  assert.match(pkgVersion, /^\d+\.\d+\.\d+$/, 'package.json must have semver version');

  const majorMinor = pkgVersion.split('.').slice(0, 2).join('.'); // e.g. "38.2"

  // Check login.html
  const loginBuildMatch = loginHtml.match(/class="login-build-version"[^>]*>v?([0-9]+\.[0-9]+)<\/span>/);
  assert.ok(loginBuildMatch, 'login.html must contain login-build-version span');
  assert.equal(loginBuildMatch[1], majorMinor, 'login.html build version must match package.json major.minor');

  const loginH3Match = loginHtml.match(/<h3><span>[^<]*<\/span>\s*<span[^>]*data-app-version[^>]*>v?([0-9]+\.[0-9]+)<\/span><\/h3>/);
  assert.ok(loginH3Match, 'login.html must contain app-version in aside info-card');
  assert.equal(loginH3Match[1], majorMinor, 'login.html info-card version must match package.json major.minor');

  // Check server.mjs header
  const serverHeaderMatch = serverMjs.match(/^\/\/\s*Borkeo\s+EMR\s+v?([0-9]+\.[0-9]+)/m);
  assert.ok(serverHeaderMatch, 'server.mjs must contain Borkeo EMR version header');
  assert.equal(serverHeaderMatch[1], majorMinor, 'server.mjs header version must match package.json major.minor');
});
