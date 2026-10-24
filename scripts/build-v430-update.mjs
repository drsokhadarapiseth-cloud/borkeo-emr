// Explicit, non-sensitive release allowlist; no patient paths or environment files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = 'ba812ed';
const files = [
  'CHANGELOG.md', 'package.json', 'public/login.html', 'server/server.mjs',
  'server/routes/paraclinic.mjs', 'tests/accessibility-quality-smoke.test.mjs',
  'tests/v309-release-catchup.test.mjs',
  'tests/access-audit.test.mjs', 'tests/access-audit-browser.mjs',
  'tests/helpers/access-audit-contexts.mjs', 'scripts/write-access-audit.mjs',
  'docs/access-audit.md', 'scripts/build-v430-update.mjs',
  ...['STATUS', 'TASKS', 'DECISIONS', 'TEST_RESULTS', 'CHANGES'].map(name => `docs/ai-handoff/${name}.md`),
];
const git = (args, options = {}) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-430-patch-base-'));
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
const forward = git(['apply', '--check', '--ignore-space-change', '-'], { cwd: temporary, input: patch });
if (forward.status !== 0) throw new Error(`Baseline patch validation failed: ${forward.stderr}`);
const header = `Borkeo EMR 43.0.0 - Scoped paraclinic access and role audit
Baseline: 42.9.0, ${baseline}. Apply only to this baseline; preserve later work.

This is an incremental master-task update. The whole master task is NOT
complete. See docs/ai-handoff/TASKS.md for exact remaining requirements.

Behavior: remove doctor bypasses for cross-service paraclinic order reads and
creation. Enforce specialist modality restrictions on direct order and attachment
reads. Retain existing patient-access, emergency/transfer exceptions, own-service
care and explicit multi-ward context selection. No new role/account permissions.
Source inventory and synthetic all-role API/menu/browser tests included.
No migration, clinical-data edits or runtime dependencies.

INSTALLATION - VS CODE DIRECTLY OR OPTIONAL PATCH, one step at a time
The working project already has these edits. Do not apply the patch twice.
1. Stop the local server and use the existing hospital backup procedure.
2. If updating another 42.9 copy, review its changes against ${baseline}; apply only
   to its listed code/doc/test files. Never overwrite .env, .gitignore, databases,
   uploads, backups, credentials or unrelated local work.
3. Run npm test and npm run check:khmer in a disposable synthetic copy.
4. Restart with the existing launcher and refresh the browser. Verify own-service
   orders and denied cross-service direct access. Deployment is separately gated.

VALIDATION AND LIMITATIONS
See docs/ai-handoff/TEST_RESULTS.md and docs/access-audit.md. Full action/save/
reopen/print audit and maternal context/routing changes remain unfinished.
No print action visually verified. No live NPCA verification/transmission.
Rollback: restore only these source files from baseline; no database rollback.

SHA-256 FILE MANIFEST (bytes in the prepared Windows workspace)
${manifest.join('\n')}

BEGIN BORKEO 43.0.0 UNIFIED PATCH
`;
fs.writeFileSync(path.join(root, 'Borkeo-EMR-v43.0.0-update.txt'), header + patch + 'END BORKEO 43.0.0 UNIFIED PATCH\n');
console.log(`Built combined update: ${manifest.length} files; baseline and reverse patch checks passed.`);
