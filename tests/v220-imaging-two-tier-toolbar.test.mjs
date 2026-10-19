import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.0 imaging.html has 2 distinct toolbar rows for primary procedures and status sub-tabs', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  
  // Verify Row 1: Primary Modality Toolbar
  assert.ok(html.includes('class="imaging-toolbar workspace-toolbar"'), 'has imaging-toolbar');
  assert.ok(html.includes('id="imaging-search"'), 'has search in main toolbar');
  assert.ok(html.includes('id="imaging-refresh"'), 'has refresh button in main toolbar');

  // Verify Row 2: Status Sub-tabs Bar
  assert.ok(html.includes('class="imaging-subtoolbar workspace-subtoolbar"'), 'has distinct imaging-subtoolbar');
  assert.ok(html.includes('id="imaging-status-subtabs"'), 'has status sub-tabs inside subtoolbar');

  // Verify CSS contains workspace-subtoolbar
  const css = fs.readFileSync(path.join(process.cwd(), 'public/paraclinic-workspace.css'), 'utf8');
  assert.ok(css.includes('.workspace-subtoolbar'), 'paraclinic-workspace.css styles workspace-subtoolbar');
});

