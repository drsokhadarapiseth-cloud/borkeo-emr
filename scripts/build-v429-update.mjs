// Explicit, non-sensitive release allowlist; no patient paths or environment files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = '107ed3a';
const files = [
  'CHANGELOG.md', 'package.json', 'public/login.html', 'public/login.js',
  'protected/context.html', 'public/context.js', 'public/context.css',
  'server/server.mjs', 'docs/approved-new-khmer.json', 'docs/translations-needed.csv',
  'tests/accessibility-quality-smoke.test.mjs', 'tests/v1200-release.test.mjs',
  'tests/v399-password-change-loop.test.mjs',
  'tests/context-recovery.test.mjs', 'tests/context-recovery-browser.mjs',
  'tests/helpers/context-browser.mjs', 'scripts/build-v429-update.mjs',
  ...['STATUS', 'TASKS', 'DECISIONS', 'TEST_RESULTS', 'CHANGES'].map(name => `docs/ai-handoff/${name}.md`),
];
const git = (args, options = {}) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-429-patch-base-'));
let patch = '';
const manifest = [];
for (const file of files) {
  const current = path.join(root, file);
  const old = path.join(temporary, file);
  const original = git(['show', `${baseline}:${file}`]);
  const existed = original.status === 0;
  if (existed) {
    fs.mkdirSync(path.dirname(old), { recursive: true });
    fs.writeFileSync(old, original.stdout);
  }
  const diff = git(['diff', '--no-index', '--ignore-space-at-eol', '--', existed ? old.replaceAll('\\', '/') : '/dev/null', current.replaceAll('\\', '/')]);
  if (diff.status === 0) continue;
  if (diff.status !== 1) throw new Error(`Cannot build patch for ${file}: ${diff.stderr}`);
  const lines = diff.stdout.replace(/\r\n/g, '\n').split('\n');
  lines[0] = `diff --git a/${file} b/${file}`;
  const hunk = lines.findIndex(line => line.startsWith('@@'));
  for (let index = 1; index < hunk; index++) {
    if (lines[index].startsWith('--- ')) lines[index] = existed ? `--- a/${file}` : '--- /dev/null';
    if (lines[index].startsWith('+++ ')) lines[index] = `+++ b/${file}`;
  }
  patch += lines.join('\n');
  manifest.push(`${crypto.createHash('sha256').update(fs.readFileSync(current)).digest('hex')}  ${file}`);
}
const checked = git(['apply', '--reverse', '--check', '--ignore-space-change', '-'], { input: patch });
if (checked.status !== 0) throw new Error(`Reverse patch validation failed: ${checked.stderr}`);
const header = `Borkeo EMR 42.9.0 - Login and work-context recovery
Baseline: 42.8.0, ${baseline}. Apply only to this baseline; preserve later work.

This is the first incremental master-task update. The whole master task is NOT
complete. See docs/ai-handoff/TASKS.md for exact remaining requirements.

Behavior: safe context bootstrap/retry, session expiration/account change checks,
fresh cookie-bound CSRF, safe Khmer login/context errors. Existing authorization
and separate doctor contexts remain. Two old demo tests now seed their own
in-memory fixtures. No migration, clinical-data edits or runtime dependencies.

INSTALLATION FOR ANTIGRAVITY - perform one step at a time
1. Stop the local server and use the existing hospital backup procedure.
2. Review local changes against baseline ${baseline}; apply the patch below only
   to its listed code/doc/test files. Never overwrite .env, .gitignore, databases,
   uploads, backups, credentials or unrelated local work.
3. Run npm test and npm run check:khmer in a disposable synthetic copy.
4. Restart with the existing launcher, refresh the browser and verify login and
   authorized context selection. Production deployment remains separately gated.

VALIDATION AND LIMITATIONS
See docs/ai-handoff/TEST_RESULTS.md. No deployment-specific network fault was
established from the unavailable screenshot. No print action was changed or
visually verified in this increment. No live NPCA verification/transmission.
Rollback: restore only these source files from baseline; no database rollback.

SHA-256 FILE MANIFEST (bytes in the prepared Windows workspace)
${manifest.join('\n')}

BEGIN BORKEO 42.9.0 UNIFIED PATCH
`;
fs.writeFileSync(path.join(root, 'Borkeo-EMR-v42.9.0-update.txt'), header + patch + 'END BORKEO 42.9.0 UNIFIED PATCH\n');
console.log(`Built combined update: ${manifest.length} files; reverse patch check passed.`);
