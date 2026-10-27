import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');


test('Paraclinic request modal retains grouped Imaging procedures with a full-width trigger', () => {
  const js = fs.readFileSync(path.join(projectRoot, 'public', 'paraclinic.js'), 'utf8');
  assert.ok(js.includes('data-request-paraclinic'));
  assert.ok(js.includes('imaging-order-groups'));
  for (const group of ['RADIOLOGY','CARDIOLOGY','NEUROLOGY','GASTROENTEROLOGY','ENT','PULMONOLOGY']) assert.ok(js.includes(group));
  for (const modality of ['XRAY','CT','MRI','ULTRASOUND','ECG','EEG','ECHOCARDIOLOGY','FIBROSCOPY','BRONCHOSCOPY']) assert.ok(js.includes(modality));
  assert.ok(!js.includes("layout.className = 'paraclinic-split'"));
});

test('v25.7 paraclinic.css and shared-controls.css provide clean, professional button styling and exclusions', () => {
  const paraclinicCss = read('public/paraclinic.css');
  assert.ok(paraclinicCss.includes('.branch-buttons.grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}'), 'Defines grid-2 columns');
  assert.ok(paraclinicCss.includes('.branch-buttons.grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}'), 'Defines grid-3 columns');
  assert.ok(paraclinicCss.includes('.paraclinic-actions .btn-head-lab'), 'Defines hero lab button styling');

  const sharedCss = read('public/shared-controls.css');
  assert.ok(sharedCss.includes(':not([data-order]):not(.btn-head-lab):not(.collapse)'), 'Excludes paraclinic buttons from heavy global override');
});
