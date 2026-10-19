import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const files = [
  'package.json',
  'public/login.html',
  'server/server.mjs',
  'server/cambodia-phone.mjs',
  'public/cambodia-phone.js',
  'protected/EMR.html',
  'legacy-html/EMR.html',
  'protected/patient-list.html',
  'protected/triage.html',
  'public/emr-patient-record.js',
  'tests/v371-phone-policy.test.mjs',
  'tests/v368-caregiver-validation.test.mjs',
];

let out = `# Borkeo EMR v37.1 Consolidated Update File\n# Generated: ${new Date().toISOString()}\n\n`;

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

fs.writeFileSync(path.join(ROOT, 'Borkeo_EMR_v37.1_UPDATE.txt'), out, 'utf8');
console.log('Successfully generated Borkeo_EMR_v37.1_UPDATE.txt');
