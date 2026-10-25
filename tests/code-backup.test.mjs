import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCodeBackup, restoreCodeBackup, safeCodePath } from '../scripts/code-backup.mjs';

test('code backup restores into a new folder and never includes untracked live data', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-code-backup-test-'));
  const git = args => execFileSync('git', args, { cwd, windowsHide: true, stdio: 'pipe' });
  git(['init']);
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"version":"1.2.0"}');
  fs.writeFileSync(path.join(cwd, 'app.js'), 'export const version = 1;');
  fs.writeFileSync(path.join(cwd, '.env'), 'SYNTHETIC_SECRET=not-for-backup');
  git(['add', 'package.json', 'app.js']);
  git(['-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', 'commit', '-m', 'fixture']);
  const backup = createCodeBackup({ cwd, destination: path.join(cwd, 'backups') });
  assert.equal(backup.version, '1.2.0');
  assert.equal(backup.files.includes('.env'), false);
  fs.writeFileSync(path.join(cwd, 'app.js'), 'new work stays here');
  assert.throws(() => createCodeBackup({ cwd, destination: path.join(cwd, 'backups') }), /tracked changes/);
  const restored = restoreCodeBackup(backup.directory, { destination: cwd });
  assert.equal(fs.readFileSync(path.join(restored.directory, 'app.js'), 'utf8'), 'export const version = 1;');
  assert.equal(fs.existsSync(path.join(restored.directory, '.env')), false);
  assert.equal(fs.readFileSync(path.join(cwd, 'app.js'), 'utf8'), 'new work stays here');
  fs.appendFileSync(path.join(backup.directory, 'code.zip'), 'tampered');
  assert.throws(() => restoreCodeBackup(backup.directory, { destination: cwd }), /altered/);
});
test('code backup rejects patient files, credentials and traversal paths', () => {
  for (const file of ['.git/config', '.env', '.env.production', 'config/.env.local', '../app.js', 'C:/outside.js', '/outside.js', 'data/emr.sqlite', 'data/uploads/photo.jpg', 'borkeo-emr-passwords.csv']) assert.equal(Boolean(safeCodePath(file)), false, file);
  for (const file of ['server/server.mjs', 'public/login.html', '.env.example', 'data/icd10/catalogue.sqlite']) assert.equal(Boolean(safeCodePath(file)), true, file);
});
