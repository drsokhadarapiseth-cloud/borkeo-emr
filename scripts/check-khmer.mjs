// npm run check:khmer - fails when any Khmer string in docs/khmer-baseline.json
// was changed or removed (except approved section-number removals in
// docs/khmer-approved-changes.md), or when a new Khmer string is not in
// docs/approved-new-khmer.json.
import fs from 'node:fs';
import { approvedChangesPath, baselinePath, checkAgainstBaseline, extractProject, readApprovedChanges, readApprovedNew } from './khmer-lib.mjs';

export function runKhmerCheck() {
  if (!fs.existsSync(baselinePath)) return ['docs/khmer-baseline.json is missing. Run node scripts/extract-khmer.mjs once to create it.'];
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).strings;
  return checkAgainstBaseline({
    baseline,
    current: extractProject(),
    approvedChanges: readApprovedChanges(approvedChangesPath),
    approvedNew: readApprovedNew(),
  });
}

if (process.argv[1]?.endsWith('check-khmer.mjs')) {
  const problems = runKhmerCheck();
  if (problems.length) {
    console.error(`Khmer check FAILED (${problems.length} problem(s)):`);
    for (const problem of problems.slice(0, 200)) console.error('  ' + problem);
    process.exit(1);
  }
  console.log('Khmer check passed: no existing Khmer text was changed or removed, and no unapproved Khmer was added.');
}
