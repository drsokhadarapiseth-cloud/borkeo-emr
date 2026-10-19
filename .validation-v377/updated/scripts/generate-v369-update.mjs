import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const files = [
  'AGENTS.md',
  'package.json',
  'public/login.html',
  'server/server.mjs',
  'protected/EMR.html',
  'legacy-html/EMR.html',
  'protected/patient-list.html',
  'protected/triage.html',
  'protected/health-facility.html',
  'public/emr-patient-record.js',
  'public/cambodia-address.js',
  'public/hef-lookup.js',
  'public/health-facility.js',
  'public/report-print.js',
  'tests/v368-caregiver-validation.test.mjs',
  'tests/v369-hef-msg-and-od-khmer.test.mjs',
];

let out = `# Borkeo EMR v36.9 Consolidated Update File\n# Generated: ${new Date().toISOString()}\n\n`;

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

fs.writeFileSync(path.join(ROOT, 'Borkeo_EMR_v36.9_UPDATE.txt'), out, 'utf8');
console.log('Successfully generated Borkeo_EMR_v36.9_UPDATE.txt');
