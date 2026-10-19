import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

// 1. Format emr-permissions.js with if (role === 'TRIAGE') for nextBtn
let perms = fs.readFileSync(path.join(ROOT, 'public', 'emr-permissions.js'), 'utf8');
const oldNext = `    const nextBtn = document.querySelector('#page2 .btn-next');\n    if (nextBtn) hide(nextBtn, true);`;
const oldNextCrlf = `    const nextBtn = document.querySelector('#page2 .btn-next');\r\n    if (nextBtn) hide(nextBtn, true);`;
const newNext = `    if (role === 'TRIAGE') {\n      const nextBtn = document.querySelector('#page2 .btn-next');\n      if (nextBtn) hide(nextBtn, true);\n    }`;
const newNextCrlf = `    if (role === 'TRIAGE') {\r\n      const nextBtn = document.querySelector('#page2 .btn-next');\r\n      if (nextBtn) hide(nextBtn, true);\r\n    }`;

if (perms.includes(oldNextCrlf)) {
  perms = perms.replace(oldNextCrlf, newNextCrlf);
} else if (perms.includes(oldNext)) {
  perms = perms.replace(oldNext, newNext);
}
fs.writeFileSync(path.join(ROOT, 'public', 'emr-permissions.js'), perms, 'utf8');

// 2. Update test files version arrays
const testFiles = [
  'tests/v352-sticker-gap-customization.test.mjs',
  'tests/v353-editable-sticker-count.test.mjs',
  'tests/v354-nursing-khmer-and-remove-ambulance.test.mjs',
  'tests/v355-triage-dropdown-hef-and-coverage-area.test.mjs',
  'tests/v356-triage-contraception-and-hef-code.test.mjs',
  'tests/v357-triage-auto-plot-docking-and-edit-button.test.mjs',
  'tests/v358-remove-docked-badge-notifications.test.mjs',
  'tests/v359-triage-edit-button-state-and-locking.test.mjs',
  'tests/v360-http-compression-and-performance-caching.test.mjs',
  'tests/v361-smart-polling-and-batch-query-performance.test.mjs',
  'tests/v362-triage-patient-list-actions.test.mjs',
  'tests/v363-speed-and-patient-summaries.test.mjs',
];

for (const tf of testFiles) {
  const p = path.join(ROOT, tf);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/'36\.4\.0'/g, "'36.4.0', '36.5.0'");
    fs.writeFileSync(p, content, 'utf8');
  }
}

// 3. Update tests/v363 cache buster
let v363 = fs.readFileSync(path.join(ROOT, 'tests', 'v363-speed-and-patient-summaries.test.mjs'), 'utf8');
v363 = v363.replace(
  "assert.ok(patientListHtml.includes('/public/patient-list.js?v=3630') || patientListHtml.includes('/public/patient-list.js?v=3640'), 'patient-list.html must cache-bust with v=3630 or v=3640');",
  "assert.ok(patientListHtml.includes('/public/patient-list.js?v=3630') || patientListHtml.includes('/public/patient-list.js?v=3640') || patientListHtml.includes('/public/patient-list.js?v=3650'), 'patient-list.html must cache-bust with v=3630, v=3640, or v=3650');"
);
v363 = v363.replace(
  "assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3630') || emrHtml.includes('/public/emr-permissions.js?v=3640'), 'EMR.html must cache-bust permissions with v=3630 or v=3640');",
  "assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3630') || emrHtml.includes('/public/emr-permissions.js?v=3640') || emrHtml.includes('/public/emr-permissions.js?v=3650'), 'EMR.html must cache-bust permissions with v=3630, v=3640, or v=3650');"
);
fs.writeFileSync(path.join(ROOT, 'tests', 'v363-speed-and-patient-summaries.test.mjs'), v363, 'utf8');

// 4. Update tests/v364
let v364 = fs.readFileSync(path.join(ROOT, 'tests', 'v364-performance-and-triage-workflow.test.mjs'), 'utf8');
v364 = v364.replace("assert.equal(pkg.version, '36.4.0');", "assert.ok(['36.4.0', '36.5.0'].includes(pkg.version));");
v364 = v364.replace("/public/emr-inpatient-workflow.js?v=3640", "/public/emr-inpatient-workflow.js?v=3650");
v364 = v364.replace("/public/emr-patient-record.js?v=3640", "/public/emr-patient-record.js?v=3650");
v364 = v364.replace("/public/emr-permissions.js?v=3640", "/public/emr-permissions.js?v=3650");
v364 = v364.replace("patientListHtml.includes('/public/patient-list.js?v=3640')", "patientListHtml.includes('/public/patient-list.js?v=3650')");
v364 = v364.replace("triageHtml.includes('/public/patient-list.js?v=3640')", "triageHtml.includes('/public/patient-list.js?v=3650')");
v364 = v364.replace("perms.includes('const nextBtn", "perms.replace(/\\r\\n/g, '\\n').includes('const nextBtn");
fs.writeFileSync(path.join(ROOT, 'tests', 'v364-performance-and-triage-workflow.test.mjs'), v364, 'utf8');

console.log('Updated test files for v36.5 compatibility');
