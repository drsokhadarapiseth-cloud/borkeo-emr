// Versioned code snapshots only. Restore always creates a separate new folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function safeCodePath(value) {
  const file = value.replaceAll('\\', '/');
  return file && !file.startsWith('/') && !/^[a-z]:/i.test(file) && !file.split('/').includes('..') &&
    !/^\.git(?:\/|$)/i.test(file) && !/(?:^|\/)\.env(?:\.|$)/i.test(file.replace(/^\.env\.example$/, 'reference-example')) && !/password[^/]*\.csv$/i.test(file) &&
    (!file.startsWith('data/') || /^data\/(icd10|gazetteer|health-facility|demo-photos)\//.test(file) || file === 'data/' || file === 'data/.gitkeep');
}
export function createCodeBackup({ cwd = project, destination = path.join(os.homedir(), 'Borkeo_EMR_Code_Backups') } = {}) {
  if (run(['status', '--porcelain', '--untracked-files=no'], cwd)) throw new Error('Commit or preserve tracked changes before taking a version snapshot.');
  const commit = run(['rev-parse', 'HEAD'], cwd);
  const files = run(['ls-tree', '-r', '--name-only', commit], cwd).split('\n');
  if (!files.every(safeCodePath)) throw new Error('Snapshot refused: tracked patient data or secret path.');
  const version = JSON.parse(run(['show', `${commit}:package.json`], cwd)).version;
  const directory = path.join(destination, `v${version}-${commit.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`);
  fs.mkdirSync(directory, { recursive: true });
  const archive = path.join(directory, 'code.zip');
  run(['archive', '--format=zip', `--output=${archive}`, commit], cwd);
  const manifest = { version, commit, createdAt: new Date().toISOString(), sha256: sha(archive), files };
  fs.writeFileSync(path.join(directory, 'backup.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { directory, ...manifest };
}
export function restoreCodeBackup(directory, { destination = os.tmpdir() } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'backup.json'), 'utf8'));
  const archive = path.join(directory, 'code.zip');
  if (sha(archive) !== manifest.sha256 || !Array.isArray(manifest.files) || !manifest.files.every(safeCodePath)) throw new Error('Invalid or altered code backup.');
  const entries = execFileSync('tar', ['-tf', archive], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(Boolean);
  if (!entries.every(safeCodePath)) throw new Error('Unsafe backup archive path.');
  fs.mkdirSync(destination, { recursive: true });
  const restored = fs.mkdtempSync(path.join(destination, 'borkeo-restored-code-'));
  execFileSync('tar', ['-xf', archive, '-C', restored], { windowsHide: true });
  return { directory: restored, version: manifest.version, commit: manifest.commit };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action = 'create', directory] = process.argv.slice(2);
  if (!['create', 'restore'].includes(action) || action === 'restore' && !directory) throw new Error('Use create, or restore <backup-directory>.');
  const result = action === 'create' ? createCodeBackup() : restoreCodeBackup(directory);
  console.log(JSON.stringify({ directory: result.directory, version: result.version, commit: result.commit }, null, 2));
}
