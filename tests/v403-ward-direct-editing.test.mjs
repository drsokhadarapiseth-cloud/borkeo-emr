import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('v40.3 ward direct editing: nursing and doctor bed actions enter edit mode immediately', () => {
  const departmentsJs = fs.readFileSync(path.join(projectRoot, 'public', 'departments.js'), 'utf8');
  const editorJs = fs.readFileSync(path.join(projectRoot, 'public', 'emr-encounter-editor.js'), 'utf8');

  // 1. Ward bed actionUrl passes edit=1 for clinical views
  assert.match(departmentsJs, /parameters\.set\('edit',\s*'1'\)/, 'departments.js actionUrl must set edit=1 for clinical views');
  assert.match(departmentsJs, /\['nursing',\s*'medical',\s*'daily'\]\.includes\(view\)/, 'departments.js must target nursing, medical, and daily views');

  // 2. Encounter editor defines and uses isDirectEditAllowed for nurse and doctor roles
  assert.match(editorJs, /function isDirectEditAllowed\s*\(\)/, 'emr-encounter-editor.js must define isDirectEditAllowed');
  assert.match(editorJs, /v\s*===\s*'nursing'\s*&&\s*\(\['NURSE',\s*'MIDWIFE'/, 'must allow direct editing for nursing roles');
  assert.match(editorJs, /\(v\s*===\s*'medical'\s*\|\|\s*v\s*===\s*'daily'\)\s*&&\s*\(\['DOCTOR'/, 'must allow direct editing for doctor roles');
});
