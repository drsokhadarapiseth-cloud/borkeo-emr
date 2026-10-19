import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const files = [
  'package.json',
  'public/login.html',
  'server/server.mjs',
  'server/access.mjs',
  'public/patient-photo.css',
  'public/patient-photo.js',
  'public/emr-patient-record.js',
  'protected/EMR.html',
  'legacy-html/EMR.html',
  'protected/patient-list.html',
  'protected/triage.html',
  'tests/v361-smart-polling-and-batch-query-performance.test.mjs',
  'tests/v362-triage-patient-list-actions.test.mjs',
  'tests/v366-triage-services-and-photo-workflow.test.mjs',
];

let out = `# Borkeo EMR v36.6 Consolidated Update File\n# Generated: ${new Date().toISOString()}\n\n`;

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

fs.writeFileSync(path.join(ROOT, 'Borkeo_EMR_v36.6_UPDATE.txt'), out, 'utf8');
console.log('Successfully generated Borkeo_EMR_v36.6_UPDATE.txt');
