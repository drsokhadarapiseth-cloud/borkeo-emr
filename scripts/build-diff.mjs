import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const files = [
  { oldPath: '.backup_v347/package.json', relPath: 'package.json' },
  { oldPath: '.backup_v347/EMR.html', relPath: 'protected/EMR.html' },
  { oldPath: '.backup_v347/login.html', relPath: 'public/login.html' },
  { oldPath: '.backup_v347/patient-card-print.css', relPath: 'public/patient-card-print.css' },
  { oldPath: '.backup_v347/patient-card-print.js', relPath: 'public/patient-card-print.js' },
  { oldPath: '.backup_v347/server.mjs', relPath: 'server/server.mjs' }
];

let fullDiff = '';

for (const { oldPath, relPath } of files) {
  try {
    execSync(`git diff --no-index --src-prefix=a/ --dst-prefix=b/ "${oldPath}" "${relPath}"`, { encoding: 'utf8' });
  } catch (err) {
    let patch = err.stdout;
    // Replace oldPath with a/relPath and b/relPath
    patch = patch.replaceAll(oldPath, relPath);
    fullDiff += patch + '\n';
  }
}

// Add new test file to diff
try {
  execSync(`git diff --no-index --src-prefix=a/ --dst-prefix=b/ /dev/null tests/v349-browser-print-preview-a5.mjs`, { encoding: 'utf8' });
} catch (err) {
  fullDiff += err.stdout + '\n';
}

fs.writeFileSync('update-v349.diff', fullDiff, 'utf8');
console.log('Successfully written update-v349.diff, total bytes:', fullDiff.length);
