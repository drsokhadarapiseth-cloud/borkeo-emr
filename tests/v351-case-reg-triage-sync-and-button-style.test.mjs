import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('Case number uses REG prefix and placeholder 160201-REG-YYMMDD-001', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  // Verify nextCaseNumber returns REG format
  assert.match(emrHtml, /HOSPITAL_FACILITY_CODE\s*\+\s*'-REG-'\s*\+\s*yyDate\s*\+\s*'-'\s*\+\s*pad\(current,\s*3\)/);

  // Verify placeholder
  assert.match(emrHtml, /HOSPITAL_FACILITY_CODE\s*\+\s*'-REG-YYMMDD-001'/);
});

test('Case number and Triage ID synchronize counters and sequences', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  // Verify nextCaseNumber checks and updates both case and triage counters
  assert.match(emrHtml, /triageCounterKey\s*=\s*['"]borkeo-emr-triage-counter:['"]/);
  assert.match(emrHtml, /Math\.max\(\s*Number\(window\.localStorage\.getItem\(counterKey\)/);

  // Verify nextTriageId inspects web_adm_no to match sequence
  assert.match(emrHtml, /var caseField = document\.getElementById\('web_adm_no'\);/);
  assert.match(emrHtml, /var match = caseVal\.match\(\/-\(\\d\{6\}\)-\(\\d\{3,4\}\)\$\/\);/);
  assert.match(emrHtml, /return HOSPITAL_FACILITY_CODE \+ '-TR-' \+ match\[1\] \+ '-' \+ match\[2\];/);

  // Verify applyAutoCaseNumber also calls applyAutoTriageId
  assert.match(emrHtml, /if\s*\(typeof applyAutoTriageId === 'function'\)\s*\{\s*applyAutoTriageId\(force\);/);
});

test('public/emr-patient-record.js syncTriageId falls back to case number sequence', () => {
  const recordJs = fs.readFileSync(path.join(rootDir, 'public/emr-patient-record.js'), 'utf8');

  assert.match(recordJs, /document\.getElementById\('web_adm_no'\)\?\.value\?\.trim\(\)\s*\|\|\s*loadedPatient\?\.caseNumber/);
  assert.match(recordJs, /160201-TR-\$\{match\[1\]\}-\$\{match\[2\]\}/);
});

test('triage.css .triage-open button matches top ចាកចេញ button styling', () => {
  const triageCss = fs.readFileSync(path.join(rootDir, 'public/triage.css'), 'utf8');

  // Must have gradient background, border, text color, and hover styles
  assert.match(triageCss, /\.triage-open\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*#ffffff,\s*#f0f7fa\)/);
  assert.match(triageCss, /\.triage-open\s*\{[^}]*color:\s*#087fa8/);
  assert.match(triageCss, /\.triage-open\s*\{[^}]*border:\s*1px solid #b7dbe7/);
  assert.match(triageCss, /\.triage-open\s*\{[^}]*border-radius:\s*8px/);
  assert.match(triageCss, /\.triage-open:hover[^}]*background:\s*#087fa8/);
  assert.match(triageCss, /\.triage-open:hover[^}]*color:\s*#fff/);
});

test('functional simulation of ID generation and synchronization', () => {
  const storage = {};
  const mockLocalStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
  };

  const HOSPITAL_FACILITY_CODE = '160201';
  const pad = (v, s) => String(v).padStart(s, '0');
  const datePart = '20261014';
  const yyDate = '261014';

  function nextCaseNumber() {
    const counterKey = 'borkeo-emr-case-counter:' + datePart;
    const triageCounterKey = 'borkeo-emr-triage-counter:' + datePart;
    const current = Math.max(
      Number(mockLocalStorage.getItem(counterKey) || '0'),
      Number(mockLocalStorage.getItem(triageCounterKey) || '0')
    ) + 1;
    mockLocalStorage.setItem(counterKey, String(current));
    mockLocalStorage.setItem(triageCounterKey, String(current));
    return HOSPITAL_FACILITY_CODE + '-REG-' + yyDate + '-' + pad(current, 3);
  }

  function nextTriageId(caseVal) {
    const match = (caseVal || '').trim().match(/-(\d{6})-(\d{3,4})$/);
    if (match) {
      return HOSPITAL_FACILITY_CODE + '-TR-' + match[1] + '-' + match[2];
    }
    const counterKey = 'borkeo-emr-triage-counter:' + datePart;
    const caseCounterKey = 'borkeo-emr-case-counter:' + datePart;
    const current = Math.max(
      Number(mockLocalStorage.getItem(counterKey) || '0'),
      Number(mockLocalStorage.getItem(caseCounterKey) || '0')
    ) + 1;
    mockLocalStorage.setItem(counterKey, String(current));
    mockLocalStorage.setItem(caseCounterKey, String(current));
    return HOSPITAL_FACILITY_CODE + '-TR-' + yyDate + '-' + pad(current, 3);
  }

  // Patient 1
  const case1 = nextCaseNumber();
  const triage1 = nextTriageId(case1);
  assert.equal(case1, '160201-REG-261014-001');
  assert.equal(triage1, '160201-TR-261014-001');

  // Patient 2 (e.g. up to 36)
  mockLocalStorage.setItem('borkeo-emr-case-counter:' + datePart, '35');
  mockLocalStorage.setItem('borkeo-emr-triage-counter:' + datePart, '35');

  const case36 = nextCaseNumber();
  const triage36 = nextTriageId(case36);
  assert.equal(case36, '160201-REG-261014-036');
  assert.equal(triage36, '160201-TR-261014-036');
});
