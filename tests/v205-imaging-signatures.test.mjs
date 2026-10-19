import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

test('v20.5 ward medicine order delivery form displays 6 signatures in a single horizontal row', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'public', 'ward-medicines.css'), 'utf8');
  assert.match(css, /\.signatures\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s+print\s*\{[^}]*\.signatures\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);

  const js = fs.readFileSync(path.join(projectRoot, 'public', 'ward-medicine-table.js'), 'utf8');
  // Verify ordered sequence: director, pharmacy, sender, chief, receiver, nurse
  const directorIdx = js.indexOf("[3,'ប្រធានមន្ទីរពេទ្យ'");
  const pharmacyIdx = js.indexOf("[4,'ឱសថការី'");
  const senderIdx = js.indexOf("[5,'អ្នកប្រគល់'");
  const chiefIdx = js.indexOf("[2,");
  const receiverIdx = js.indexOf("[6,'អ្នកទទួល'");
  const nurseIdx = js.indexOf("[1,'នាយសាល'");

  assert.ok(directorIdx > 0 && pharmacyIdx > directorIdx && senderIdx > pharmacyIdx && chiefIdx > senderIdx && receiverIdx > chiefIdx && nurseIdx > receiverIdx, 'Signatures must be ordered: director, pharmacy, sender, chief, receiver, nurse');
});

test('v20.5 imaging hierarchy presents status filters as sub-buttons of specific procedures and shares identical unified styles', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'protected', 'imaging.html'), 'utf8');
  assert.match(html, /id="imaging-status-subtabs"/);
  assert.match(html, /data-modality=""/);
  assert.match(html, /data-modality="ULTRASOUND"/);

  const js = fs.readFileSync(path.join(projectRoot, 'public', 'imaging.js'), 'utf8');
  assert.match(js, /img-status-tabs/);

  const imgCss = fs.readFileSync(path.join(projectRoot, 'public', 'imaging.css'), 'utf8');
  assert.match(imgCss, /\.mod-tabs,\s*\.img-status-tabs/);
  assert.match(imgCss, /\.mod-tabs\s+button\.active,\s*\.img-status-tabs\s+button\.active/);

  const sharedCss = fs.readFileSync(path.join(projectRoot, 'public', 'shared-controls.css'), 'utf8');
  assert.match(sharedCss, /#imaging-refresh/);
  assert.match(sharedCss, /:not\(\[data-modality\]\):not\(\[data-status\]\)/);
});
