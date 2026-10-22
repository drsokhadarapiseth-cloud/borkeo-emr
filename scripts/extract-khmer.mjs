// Writes docs/khmer-baseline.json: every Khmer string in the project with
// file, line and exact text. "npm run khmer:accept" runs this to accept the
// current text as the new baseline; only the hospital owner runs that command.
import fs from 'node:fs';
import path from 'node:path';
import { baselinePath, extractProject } from './khmer-lib.mjs';

const strings = extractProject();
fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
fs.writeFileSync(baselinePath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: 'Khmer text baseline. Do not edit by hand; the owner accepts changes with npm run khmer:accept.',
  count: strings.length,
  strings,
}, null, 1) + '\n');
console.log(`Khmer baseline written: ${strings.length} strings in ${new Set(strings.map((s) => s.file)).size} files -> ${path.relative(process.cwd(), baselinePath)}`);
