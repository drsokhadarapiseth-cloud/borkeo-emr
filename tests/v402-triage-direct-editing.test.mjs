import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('v40.2 triage direct editing: queue links and encounter editor behavior', () => {
  const triageJs = fs.readFileSync(path.join(projectRoot, 'public', 'triage.js'), 'utf8');
  const editorJs = fs.readFileSync(path.join(projectRoot, 'public', 'emr-encounter-editor.js'), 'utf8');

  // 1. Triage queue links pass edit=1 for direct editing
  assert.match(triageJs, /view=triage&edit=1/, 'triage.js must pass view=triage&edit=1 for active triage entries');
  assert.match(triageJs, /view=triage&mode=view/, 'triage.js must pass mode=view for completed view-only triage');

  // 2. Encounter editor initializes direct editing mode
  assert.match(editorJs, /isDirectEditAllowed/, 'encounter editor must define isDirectEditAllowed');
  assert.match(editorJs, /explicitView/, 'encounter editor must respect explicit mode=view');
});
