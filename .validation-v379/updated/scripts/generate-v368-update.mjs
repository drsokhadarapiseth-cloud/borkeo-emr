import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const files = [
  'package.json',
  'public/login.html',
  'server/server.mjs',
  'protected/EMR.html',
  'legacy-html/EMR.html',
  'protected/patient-list.html',
  'protected/triage.html',
  'public/emr-patient-record.js',
  'public/cambodia-address.js',
  'public/hef-lookup.js',
  'public/report-print.js',
  'tests/report-print.test.mjs',
  'tests/v332-triage-button-and-hef-dialog.test.mjs',
  'tests/v355-triage-dropdown-hef-and-coverage-area.test.mjs',
  'tests/v365-triage-free-edit.test.mjs',
  'tests/v367-registration-caregiver-info.test.mjs',
  'tests/v368-caregiver-validation.test.mjs',
];

let out = `# Borkeo EMR v36.8 Consolidated Update File\n# Generated: ${new Date().toISOString()}\n\n`;

for (const rel of files) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) {
    console.error('Missing file:', rel);
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  out += `=== FILE: ${rel.replace(/\\/g, '/')} ===\n`;
  out += content;
  if (!content.endsWith('\n')) out += '\n';
  out += `=== END FILE ===\n\n`;
}

fs.writeFileSync(path.join(ROOT, 'Borkeo_EMR_v36.8_UPDATE.txt'), out, 'utf8');
console.log('Successfully generated Borkeo_EMR_v36.8_UPDATE.txt');
