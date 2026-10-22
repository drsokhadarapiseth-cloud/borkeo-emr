// npm run translations:apply
// Reads docs/translations-needed.csv. For every row where the owner filled the
// "khmer" column it:
//   - writes that exact Khmer into public/new-text-data.js (by key), which
//     removes the yellow "needs translation" highlight,
//   - adds the pair [khmer, English] to the language dictionary
//     (public/emr-language-data.js) so EN mode shows the English,
//   - adds the Khmer to docs/approved-new-khmer.json,
// and prints what changed. Rows with an empty khmer column are skipped. An
// existing different Khmer value is never overwritten without a "yes".
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { projectRoot } from './khmer-lib.mjs';

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell !== ''));
}

const js = (value) => JSON.stringify(value);

function readNewTextData(file) {
  const text = fs.readFileSync(file, 'utf8');
  const body = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(body.replace(/,\s*}$/, '}'));
}

function writeNewTextData(file, data) {
  const lines = Object.entries(data).map(([key, khmer]) => `  ${js(key)}: ${js(khmer)},`);
  fs.writeFileSync(file, [
    '// Approved Khmer for new UI text, by key. Written only by scripts/apply-translations.mjs',
    '// from the khmer column the owner fills in docs/translations-needed.csv.',
    'window.BORKEO_NEW_TEXT_KH = {',
    ...lines,
    '};',
    '',
  ].join('\n'));
}

export async function applyTranslations({ root = projectRoot, confirm = async () => false, log = console.log } = {}) {
  const csvFile = path.join(root, 'docs', 'translations-needed.csv');
  const dataFile = path.join(root, 'public', 'new-text-data.js');
  const dictionaryFile = path.join(root, 'public', 'emr-language-data.js');
  const approvedFile = path.join(root, 'docs', 'approved-new-khmer.json');

  const [header, ...rows] = parseCsv(fs.readFileSync(csvFile, 'utf8'));
  const column = (name) => header.findIndex((cell) => cell.trim().toLowerCase() === name);
  const keyAt = column('key'), englishAt = column('english placeholder'), khmerAt = column('khmer');
  if (keyAt < 0 || englishAt < 0 || khmerAt < 0) throw new Error('translations-needed.csv must have the columns key, English placeholder, khmer.');

  const data = readNewTextData(dataFile);
  const approved = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
  const approvedKhmer = new Set(approved.entries.map((entry) => entry.kh));
  const dictionary = fs.readFileSync(dictionaryFile, 'utf8');
  const pairsToAdd = [];
  const changes = [];
  let skipped = 0;

  for (const row of rows) {
    const key = (row[keyAt] || '').trim();
    const english = (row[englishAt] || '').trim();
    const khmer = (row[khmerAt] || '').replace(/^[ \t]+|[ \t]+$/g, '');
    if (!khmer) { skipped++; continue; }
    if (!key || !english) throw new Error(`Refusing a row without key or English placeholder: ${row.join(',')}`);
    if (data[key] && data[key] !== khmer) {
      const ok = await confirm(`Key "${key}" already has Khmer "${data[key]}". Replace it with "${khmer}"?`);
      if (!ok) { log(`KEPT existing Khmer for ${key}`); continue; }
    }
    if (data[key] !== khmer) { data[key] = khmer; changes.push(`${key}: "${english}" -> "${khmer}"`); }
    if (!dictionary.includes(`[${js(khmer)},${js(english)}]`) && !pairsToAdd.some(([k, e]) => k === khmer && e === english)) pairsToAdd.push([khmer, english]);
    if (!approvedKhmer.has(khmer)) {
      approved.entries.push({ en: english, kh: khmer, key, source: 'docs/translations-needed.csv' });
      approvedKhmer.add(khmer);
    }
  }

  writeNewTextData(dataFile, data);
  if (pairsToAdd.length) {
    const lines = pairsToAdd.map((pair) => `window.BORKEO_EMR_LANGUAGE_PAIRS.push(${js(pair)});`).join('\n');
    fs.writeFileSync(dictionaryFile, dictionary.replace(/\n?$/, '\n') + lines + '\n');
  }
  fs.writeFileSync(approvedFile, JSON.stringify(approved, null, 2) + '\n');

  for (const change of changes) log('APPLIED ' + change);
  for (const [khmer, english] of pairsToAdd) log(`DICTIONARY + ["${khmer}", "${english}"]`);
  log(`${changes.length} translation(s) applied, ${skipped} row(s) still without Khmer.`);
  return { changes, pairsToAdd, skipped };
}

if (process.argv[1]?.endsWith('apply-translations.mjs')) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = async (question) => process.stdin.isTTY && /^y(es)?$/i.test((await prompt.question(question + ' (yes/no) ')).trim());
  applyTranslations({ confirm })
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prompt.close());
}
