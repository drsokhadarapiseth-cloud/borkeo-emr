import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, startBranch, review, sensitive } from '../scripts/emr-branch-lib.mjs';
const modules = [{ id: 'opd', primary: ['public/opd-*'], shared: ['protected/EMR.html'], suggestedTests: [], manualChecks: [] }, { id: 'lab', primary: ['public/lab.js'], shared: ['protected/EMR.html'] }];
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-branch-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, ['init', '-b', 'master']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Synthetic Test']);
  fs.mkdirSync(path.join(dir, 'public')); fs.mkdirSync(path.join(dir, 'protected'));
  fs.writeFileSync(path.join(dir, 'public/opd-form.js'), 'baseline');
  fs.writeFileSync(path.join(dir, 'public/lab.js'), 'baseline');
  fs.writeFileSync(path.join(dir, 'protected/EMR.html'), 'baseline');
  git(dir, ['add', '.']); git(dir, ['commit', '-m', 'Synthetic baseline']);
  return dir;
}
test('task branch starts at base without changing master', t => {
  const dir = fixture(t), base = git(dir, ['rev-parse', 'master']);
  assert.equal(startBranch(dir, modules, 'opd', 'improve-form').name, 'feature/opd-improve-form');
  assert.equal(git(dir, ['rev-parse', 'HEAD']), base);
  assert.equal(git(dir, ['rev-parse', 'master']), base);
});
test('reject dirty checkout, unknown module and unsafe task name', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'public/lab.js'), 'changed');
  assert.throws(() => startBranch(dir, modules, 'opd', 'task'), /not clean/);
  assert.throws(() => startBranch(dir, modules, 'unknown', 'task'), /Unknown module/);
  assert.throws(() => startBranch(dir, modules, 'opd', '../task'), /lowercase/);
  assert.equal(git(dir, ['branch', '--show-current']), 'master');
});
test('review covers committed, staged and untracked changes across modules', t => {
  const dir = fixture(t); startBranch(dir, modules, 'opd', 'task');
  fs.writeFileSync(path.join(dir, 'public/opd-form.js'), 'committed');
  git(dir, ['add', 'public/opd-form.js']); git(dir, ['commit', '-m', 'OPD fixture change']);
  fs.writeFileSync(path.join(dir, 'protected/EMR.html'), 'staged'); git(dir, ['add', 'protected/EMR.html']);
  fs.writeFileSync(path.join(dir, 'public/lab.js'), 'unstaged');
  fs.writeFileSync(path.join(dir, 'new.txt'), 'untracked');
  const result = review(dir, modules, 'opd');
  assert.equal(result.files.length, 4);
  assert.equal(result.files.find(f => f.file === 'protected/EMR.html').scope, 'shared');
  assert.deepEqual(result.affectedModules, ['lab', 'opd']);
  assert.equal(result.files.find(f => f.file === 'public/lab.js').scope, 'outside-module');
});
test('blocks tracked patient database and detects credentials while allowing reference catalogue', t => {
  const dir = fixture(t); fs.mkdirSync(path.join(dir, 'data'));
  fs.writeFileSync(path.join(dir, 'data/emr.sqlite'), 'synthetic marker only'); git(dir, ['add', 'data/emr.sqlite']);
  assert.throws(() => startBranch(dir, modules, 'opd', 'task'), /tracked in Git/);
  assert.equal(sensitive('data/emr.sqlite-wal'), true);
  assert.equal(sensitive('data/uploads/document.pdf'), true);
  assert.equal(sensitive('.env'), true);
  assert.equal(sensitive('borkeo-emr-passwords.csv'), true);
  assert.equal(sensitive('data/icd10/catalogue.sqlite'), false);
  assert.equal(sensitive('.env.example'), false);
});
test('separate worktree preserves master checkout', t => {
  const dir = fixture(t), destination = dir + '-opd';
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  startBranch(dir, modules, 'opd', 'parallel-form', destination);
  assert.equal(git(dir, ['branch', '--show-current']), 'master');
  assert.equal(git(destination, ['branch', '--show-current']), 'feature/opd-parallel-form');
});
test('rejects stale upstream before branch creation', t => {
  const dir = fixture(t);
  git(dir, ['branch', 'tracking']);
  git(dir, ['branch', '--set-upstream-to=tracking', 'master']);
  fs.writeFileSync(path.join(dir, 'public/lab.js'), 'ahead'); git(dir, ['add', '.']); git(dir, ['commit', '-m', 'Ahead fixture']);
  assert.throws(() => startBranch(dir, modules, 'opd', 'task'), /differs from its cached upstream/);
});
