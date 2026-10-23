// Shared helpers for the Khmer text safety net (extract-khmer.mjs, check-khmer.mjs).
// A "Khmer string" is a piece of a line between quotes, tags or template
// placeholders that contains at least one Khmer character. Pieces are compared
// as exact text (invisible characters included) wherever they are in the
// project, so moving an element to another place keeps its strings intact.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const baselinePath = path.join(projectRoot, 'docs', 'khmer-baseline.json');
export const approvedChangesPath = path.join(projectRoot, 'docs', 'khmer-approved-changes.md');
export const approvedNewPath = path.join(projectRoot, 'docs', 'approved-new-khmer.json');

const KHMER = /[ក-៿᧠-᧿]/;
const EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json']);
// borkeo-update-files: the owner's input files for an update (not served; copied into server/).
const SKIP_DIRS = new Set(['node_modules', 'data', 'docs', 'backups', '.git', 'borkeo-update-files']);
const SKIP_DIR_PATTERN = /^(\.validation-|_backup_)/;
// Splits a line at quotes, tag brackets and ${ } template placeholders.
const DELIMITERS = /["'`<>]|\$\{|\}/;
// Only ordinary whitespace is trimmed; zero-width characters (U+200B-U+200D) are kept.
const EDGE_SPACE = /^[ \t\r\n\f\v ﻿]+|[ \t\r\n\f\v ﻿]+$/g;

export function hasKhmer(text) {
  return KHMER.test(text);
}

export function listSourceFiles(root = projectRoot) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || SKIP_DIR_PATTERN.test(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(path.join(dir, entry.name));
      }
    }
  };
  walk(root);
  return files.sort();
}

export function extractFromText(text, file) {
  const result = [];
  text.split('\n').forEach((line, index) => {
    if (!hasKhmer(line)) return;
    for (const piece of line.split(DELIMITERS)) {
      const trimmed = piece.replace(EDGE_SPACE, '');
      if (trimmed && hasKhmer(trimmed)) result.push({ file, line: index + 1, text: trimmed });
    }
  });
  return result;
}

export function extractProject(root = projectRoot) {
  const strings = [];
  for (const file of listSourceFiles(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    strings.push(...extractFromText(fs.readFileSync(file, 'utf8'), relative));
  }
  return strings;
}

export function countByText(strings) {
  const counts = new Map();
  for (const item of strings) counts.set(item.text, (counts.get(item.text) || 0) + 1);
  return counts;
}

// Removes a leading section number such as "I. ", "II. ", "១. ", "២. " or "6. ".
export function stripSectionNumber(text) {
  return text.replace(/^(?:[IVXLC]+|[0-9]+|[០-៩]+)\s*[.)]\s*/, '');
}

// v42.3 (owner's order): measurement units are written as the original
// international units, never translated. An approved row may replace a Khmer unit
// label with one of these units (docs/khmer-approved-changes.md, unit table).
export const INTERNATIONAL_UNITS = new Set(['mg', 'mL', 'mcg', 'g', 'IU']);

// Reads the "| file | line | before | after |" table in docs/khmer-approved-changes.md.
// v42.5: rows under a "## ... (owner's order)" heading are changes the owner
// ordered in an approved update prompt (ordered: true): the "before" text may
// disappear when the "after" text is in the project.
export function readApprovedChanges(file = approvedChangesPath) {
  if (!fs.existsSync(file)) return [];
  const rows = [];
  let ordered = false;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('#')) { ordered = /\(owner's order\)/.test(line); continue; }
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.replace(EDGE_SPACE, ''));
    if (cells.length < 4 || !hasKhmer(cells[2])) continue;
    rows.push({ file: cells[0], line: cells[1], before: cells[2], after: cells[3], ordered });
  }
  return rows;
}

export function readApprovedNew(file = approvedNewPath) {
  if (!fs.existsSync(file)) return new Set();
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Set((json.entries || []).map((entry) => entry.kh));
}

export function checkAgainstBaseline({ baseline, current, approvedChanges, approvedNew }) {
  const before = countByText(baseline);
  const now = countByText(current);
  const changes = new Map(approvedChanges.map((row) => [row.before, row]));
  const allowedAfter = new Set(approvedChanges.map((row) => row.after));
  const problems = [];
  for (const [text, count] of before) {
    const missing = count - (now.get(text) || 0);
    if (missing <= 0) continue;
    const change = changes.get(text);
    if (change && change.after === stripSectionNumber(text) && now.has(change.after)) continue;
    if (change && INTERNATIONAL_UNITS.has(change.after)) continue;
    if (change && change.ordered && (now.has(change.after) || !hasKhmer(change.after))) continue;
    const where = baseline.filter((item) => item.text === text).map((item) => `${item.file}:${item.line}`).slice(0, 3).join(', ');
    problems.push(`CHANGED OR REMOVED (${missing} of ${count}): "${text}" (was at ${where})`);
  }
  for (const [text] of now) {
    if (before.has(text) || approvedNew.has(text) || allowedAfter.has(text)) continue;
    const where = current.filter((item) => item.text === text).map((item) => `${item.file}:${item.line}`).slice(0, 3).join(', ');
    problems.push(`NEW, NOT APPROVED: "${text}" (at ${where})`);
  }
  return problems;
}
