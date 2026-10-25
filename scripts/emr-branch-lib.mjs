import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const paths = text => text.split('\0').filter(Boolean);
export function sensitive(file) {
  return /^data\/[^/]+\.sqlite(?:[.-].*)?$/.test(file) || /^data\/(?:backups|uploads)\//.test(file) || /(^|\/)\.env(?:\..*)?$/.test(file) && !file.endsWith('.env.example') || /(^|\/)(?:borkeo-emr-passwords\.csv|.*passwords.*\.csv)$/i.test(file);
}
export function match(file, glob) {
  const regex = glob.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + regex + '$').test(file);
}
export function baseBranch(cwd) {
  for (const name of ['master', 'main']) {
    try { git(cwd, ['show-ref', '--verify', `refs/heads/${name}`]); return name; } catch {}
  }
  throw new Error('No local master or main branch. Run this in your existing EMR Git checkout after fetching its base branch.');
}
export function assertNoTrackedPatientData(cwd) {
  const bad = paths(git(cwd, ['ls-files', '-z'])).filter(sensitive);
  if (bad.length) throw new Error('Patient data or secrets are tracked in Git. Remove them from the index before continuing (keep local files):\n' + bad.join('\n'));
}
export function branchName(modules, moduleId, task) {
  if (!modules.some(m => m.id === moduleId)) throw new Error(`Unknown module: ${moduleId}. Use the list command.`);
  if (!task || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(task) || task.length > 70) throw new Error('Task must use lowercase words separated by hyphens, e.g. improve-prescription-form.');
  return `feature/${moduleId}-${task}`;
}
export function startBranch(cwd, modules, moduleId, task, destination) {
  const name = branchName(modules, moduleId, task);
  assertNoTrackedPatientData(cwd);
  const base = baseBranch(cwd);
  if (git(cwd, ['status', '--porcelain'])) throw new Error('Working tree is not clean. Commit or stash your changes first.');
  if (git(cwd, ['branch', '--show-current']) !== base) throw new Error(`Switch to ${base} and update it before creating a new task branch.`);
  let upstream;
  try { upstream = git(cwd, ['rev-parse', '--abbrev-ref', `${base}@{upstream}`]); } catch {}
  if (upstream && git(cwd, ['rev-parse', base]) !== git(cwd, ['rev-parse', upstream])) throw new Error(`${base} differs from its cached upstream. Fetch and reconcile it first. This helper never resets your work.`);
  if (destination) {
    const target = path.resolve(cwd, destination);
    if (fs.existsSync(target)) throw new Error('Worktree destination already exists. Choose a new directory.');
    git(cwd, ['worktree', 'add', '-b', name, target, base]);
    return { name, base, directory: target, upstream: upstream || null };
  }
  git(cwd, ['switch', '-c', name, base]);
  return { name, base, directory: cwd, upstream: upstream || null };
}
export function review(cwd, modules, moduleId) {
  const selected = modules.find(m => m.id === moduleId);
  if (!selected) throw new Error(`Unknown module: ${moduleId}`);
  assertNoTrackedPatientData(cwd);
  const base = baseBranch(cwd);
  const changed = [...new Set([
    ...paths(git(cwd, ['diff', '--name-only', '-z', `${base}...HEAD`])),
    ...paths(git(cwd, ['diff', '--name-only', '-z', 'HEAD'])),
    ...paths(git(cwd, ['ls-files', '--others', '--exclude-standard', '-z'])),
  ])].sort();
  const rows = changed.map(file => ({ file, sensitive: sensitive(file),
    scope: selected.primary.some(g => match(file, g)) ? 'primary' : selected.shared.some(g => match(file, g)) ? 'shared' : 'outside-module',
    relatedModules: modules.filter(m => [...m.primary, ...m.shared].some(g => match(file, g))).map(m => m.id),
  }));
  return { branch: git(cwd, ['branch', '--show-current']), base, module: moduleId, files: rows,
    affectedModules: [...new Set(rows.flatMap(r => r.relatedModules))].sort(),
    suggestedTests: selected.suggestedTests, manualChecks: selected.manualChecks,
    note: 'Static path hints only. Shared imports, inline forms, CSS and data flows require review; passing this report does not prove isolation.' };
}
