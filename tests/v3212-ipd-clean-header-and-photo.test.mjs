import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('v32.12 Section 6 renumbered: 1. Personal History, 2. OB/GYN History, 3. Family History, 4. Community History', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(rootDir, 'legacy-html/EMR.html'), 'utf8');

  [emrHtml, legacyHtml].forEach(html => {
    assert.match(html, /<strong data-key="ipd_v1">1: សាវតារោគផ្ទាល់ខ្លួន<\/strong>/, 'Section 1 must be 1: សាវតារោគផ្ទាល់ខ្លួន');
    assert.match(html, /2: ប្រវត្តិសម្ភព និងរោគស្ត្រី:/, 'Section 2 must be 2: ប្រវត្តិសម្ភព និងរោគស្ត្រី:');
    assert.match(html, /<strong data-key="ipd_v2">3: សាវតាក្នុងគ្រួសារ<\/strong>/, 'Section 3 must be 3: សាវតាក្នុងគ្រួសារ');
    assert.match(html, /<strong data-key="ipd_v3">4: សាវតារោគក្នុងសហគមន៍<\/strong>/, 'Section 4 must be 4: សាវតារោគក្នុងសហគមន៍');

    // Dictionaries
    assert.match(html, /ipd_obgyn_title:\s*"2: ប្រវត្តិសម្ភព និងរោគស្ត្រី:"/, 'Khmer dictionary must have 2: OB/GYN');
    assert.match(html, /ipd_v2:\s*"3: សាវតាក្នុងគ្រួសារ"/, 'Khmer dictionary must have 3: Family History');
    assert.match(html, /ipd_v3:\s*"4: សាវតារោគក្នុងសហគមន៍"/, 'Khmer dictionary must have 4: Community History');

    assert.match(html, /ipd_obgyn_title:\s*"2: Obstetric & Gynecological History:"/, 'English dictionary must have 2: OB/GYN');
    assert.match(html, /ipd_v2:\s*"3: Family History"/, 'English dictionary must have 3: Family History');
    assert.match(html, /ipd_v3:\s*"4: Community Medical History"/, 'English dictionary must have 4: Community History');
  });
});

test('v32.12 IPD photo frame enlarged to standard 4x6 cm portrait dimensions matching OPD', () => {
  const css = fs.readFileSync(path.join(rootDir, 'public/patient-photo.css'), 'utf8');

  assert.match(css, /#ipd_patient_photo_frame\{[^}]*width:\s*4cm\s*!important/, 'IPD photo frame width must be 4cm');
  assert.match(css, /#ipd_patient_photo_frame\{[^}]*height:\s*6cm\s*!important/, 'IPD photo frame height must be 6cm');
  assert.match(css, /#ipd_patient_photo_frame\{[^}]*aspect-ratio:\s*2\/3\s*!important/, 'IPD photo frame aspect ratio must be 2/3');
  assert.match(css, /#ipd_patient_photo_frame\s+img\{[^}]*object-fit:\s*contain\s*!important/, 'IPD photo image must have object-fit: contain');
});

test('v32.12 Top navigation bar and green status boxes are hidden/removed', () => {
  const css = fs.readFileSync(path.join(rootDir, 'public/patient-photo.css'), 'utf8');

  assert.match(css, /#inpatient-view-toolbar[^}]*display:\s*none\s*!important/, 'Inpatient view toolbar must be hidden');
  assert.match(css, /#emr-record-status[^}]*display:\s*none\s*!important/, 'Record status green box must be hidden');
});
