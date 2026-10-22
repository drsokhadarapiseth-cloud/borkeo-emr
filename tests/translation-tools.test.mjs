// Phase 0 translation tools: newText placeholders and scripts/apply-translations.mjs.
// Khmer is written as \u escapes so this file adds no Khmer strings.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTranslations, parseCsv } from '../scripts/apply-translations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KH = '\u1794\u17d2\u179a\u179c\u178f\u17d2\u178f\u17b7';

function fixture(csvRows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-translate-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.mkdirSync(path.join(dir, 'public'));
  fs.writeFileSync(path.join(dir, 'docs', 'translations-needed.csv'), ['key,English placeholder,context,file,khmer', ...csvRows].join('\n') + '\n');
  fs.copyFileSync(path.join(root, 'public', 'new-text-data.js'), path.join(dir, 'public', 'new-text-data.js'));
  fs.writeFileSync(path.join(dir, 'public', 'emr-language-data.js'), 'window.BORKEO_EMR_LANGUAGE_PAIRS=[["a","b"]];');
  fs.writeFileSync(path.join(dir, 'docs', 'approved-new-khmer.json'), JSON.stringify({ entries: [] }));
  return dir;
}

test('approved-new-khmer.json holds the 61 approved RULE 2 entries, then only owner-filled translations', () => {
  const approved = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'approved-new-khmer.json'), 'utf8'));
  assert.ok(approved.entries.length >= 61);
  assert.equal(approved.entries[0].en, 'Patient Summary Banner');
  assert.ok(approved.entries.every((entry) => entry.en && /[\u1780-\u17ff]/.test(entry.kh)));
  // v41.3: entries after the RULE 2 table come from scripts/apply-translations.mjs,
  // so each one is a row the owner filled in docs/translations-needed.csv.
  const [header, ...rows] = parseCsv(fs.readFileSync(path.join(root, 'docs', 'translations-needed.csv'), 'utf8'));
  const enAt = header.indexOf('English placeholder'), khAt = header.indexOf('khmer');
  const filled = new Set(rows.filter((row) => row[khAt]).map((row) => `${row[enAt]}\u0000${row[khAt].trim()}`));
  for (const entry of approved.entries.slice(61)) assert.ok(filled.has(`${entry.en}\u0000${entry.kh}`), entry.en);
});

test('translations-needed.csv has the agreed columns and every newText key in public/ is listed', () => {
  const [header, ...rows] = parseCsv(fs.readFileSync(path.join(root, 'docs', 'translations-needed.csv'), 'utf8'));
  assert.deepEqual(header, ['key', 'English placeholder', 'context', 'file', 'khmer']);
  const listed = new Set(rows.map((row) => row[0]));
  const used = new Set();
  for (const file of fs.readdirSync(path.join(root, 'public')).filter((name) => /\.(js|html)$/.test(name) && name !== 'new-text.js')) {
    const text = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    for (const match of text.matchAll(/newText(?:Html)?\(\s*['"]([^'"]+)['"]|data-new-text="([^"]+)"/g)) used.add(match[1] || match[2]);
  }
  for (const key of used) assert.ok(listed.has(key), `${key} must be listed in docs/translations-needed.csv`);
});

test('apply-translations writes filled rows, skips empty ones and keeps an existing Khmer value unless confirmed', async () => {
  const dir = fixture(['soap.planNotesHint,Write the plan,Plan box,public/x.js,' + KH, 'soap.other,Other text,Plan box,public/x.js,']);
  const quiet = () => {};
  const first = await applyTranslations({ root: dir, log: quiet });
  assert.equal(first.changes.length, 1);
  assert.equal(first.skipped, 1);
  assert.match(fs.readFileSync(path.join(dir, 'public', 'new-text-data.js'), 'utf8'), new RegExp(`"soap.planNotesHint": "${KH}"`));
  assert.match(fs.readFileSync(path.join(dir, 'public', 'emr-language-data.js'), 'utf8'), /BORKEO_EMR_LANGUAGE_PAIRS\.push\(\[".+","Write the plan"\]\)/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'docs', 'approved-new-khmer.json'), 'utf8')).entries[0].kh, KH);

  fs.writeFileSync(path.join(dir, 'docs', 'translations-needed.csv'), `key,English placeholder,context,file,khmer\nsoap.planNotesHint,Write the plan,Plan box,public/x.js,${KH}\u17cb\n`);
  await applyTranslations({ root: dir, log: quiet, confirm: async () => false });
  assert.match(fs.readFileSync(path.join(dir, 'public', 'new-text-data.js'), 'utf8'), new RegExp(`"soap.planNotesHint": "${KH}"\\n|"soap.planNotesHint": "${KH}",`));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('apply-translations refuses a translated row without a key', async () => {
  const dir = fixture([',Write the plan,Plan box,public/x.js,' + KH]);
  await assert.rejects(applyTranslations({ root: dir, log: () => {} }), /Refusing/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('new-text helper and SHOW_UNTRANSLATED meta are served on staff pages', () => {
  const server = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.match(server, /'\/public\/new-text\.js'/);
  assert.match(server, /borkeo-show-untranslated/);
  const helper = fs.readFileSync(path.join(root, 'public', 'new-text.js'), 'utf8');
  assert.match(helper, /needs-translation/);
  assert.match(fs.readFileSync(path.join(root, 'public', 'new-text.css'), 'utf8'), /\.needs-translation\s*\{[^}]*dashed/);
});
