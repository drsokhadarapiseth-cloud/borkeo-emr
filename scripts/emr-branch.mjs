import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, review, startBranch } from './emr-branch-lib.mjs';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { modules } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'docs/development/modules.json'), 'utf8'));
const [command = 'help', moduleId, task, destination] = process.argv.slice(2);
try {
  if (command === 'list') {
    console.log(modules.map(m => `${m.id.padEnd(15)} ${m.label}`).join('\n'));
  } else if (command === 'start' || command === 'worktree') {
    const cwd = git(projectRoot, ['rev-parse', '--show-toplevel']);
    if (path.resolve(cwd) !== projectRoot) throw new Error('The toolkit must be installed at the root of the existing EMR repository.');
    if (command === 'worktree' && !destination) throw new Error('Supply a new worktree directory after the task name.');
    console.log(JSON.stringify(startBranch(cwd, modules, moduleId, task, command === 'worktree' ? destination : undefined), null, 2));
    console.log('Use a disposable database for testing. Branches/worktrees do not isolate the default hospital database.');
  } else if (command === 'review') {
    const cwd = git(projectRoot, ['rev-parse', '--show-toplevel']);
    if (path.resolve(cwd) !== projectRoot) throw new Error('Install the toolkit at the EMR repository root.');
    const result = review(cwd, modules, moduleId);
    console.log(JSON.stringify(result, null, 2));
    if (result.files.some(f => f.sensitive)) process.exitCode = 2;
  } else {
    if (command !== 'help') throw new Error('Unknown command.');
    console.log('node scripts/emr-branch.mjs list\nnode scripts/emr-branch.mjs start <module> <task>\nnode scripts/emr-branch.mjs worktree <module> <task> <new-directory>\nnode scripts/emr-branch.mjs review <module>\n\nFetch and update master/main before starting. Nothing is automatically committed, merged, pushed or deleted.');
  }
} catch (error) {
  console.error('Branch workflow: ' + (error.stderr?.toString().trim() || error.message));
  process.exitCode = 1;
}
