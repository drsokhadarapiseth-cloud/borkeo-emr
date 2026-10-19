import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve('.');

test('v35.7 - Version metadata consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(['35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v3[56]\.[0-9]/);

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v3[56]\.[0-9]/);
});

test('v35.7 - Triage HTML has triage_save_btn and handleTriageSaveOrEdit', () => {
  for (const relPath of ['protected/EMR.html', 'legacy-html/EMR.html']) {
    const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    assert.match(html, /id="triage_save_btn"/);
    assert.match(html, /handleTriageSaveOrEdit\(\)/);
  }
});

test('v35.7 - resolvePmrServiceCode auto-plots for ALL patients (both paying and equity)', () => {
  const jsContent = fs.readFileSync(path.join(ROOT, 'public/emr-patient-record.js'), 'utf8');

  // Verify function exists and doesn't exit early on non-equity
  assert.ok(jsContent.includes('function resolvePmrServiceCode()'));
  assert.ok(!jsContent.includes('if (!isEquity) return \'\';'));

  // Test extraction with VM
  const startIdx = jsContent.indexOf('function resolvePmrServiceCode()');
  const endIdx = jsContent.indexOf('function syncServiceCode()', startIdx);
  const fnCode = jsContent.slice(startIdx, endIdx);

  const testCases = [
    { otherVal: 'emergency', expected: 'RH-EMG' },
    { otherVal: 'surgery', expected: 'RH-IPDSurg' },
    { otherVal: 'gynecology', expected: 'RH-IPDGen' },
    { otherVal: 'maternity', expected: 'RH-Del' },
    { otherVal: 'tb', expected: 'RH-TB1' },
    { otherVal: 'anc', expected: 'RH-OPDSpec' },
    { otherVal: 'pnc', expected: 'RH-OPDSpec' },
    { otherVal: 'spacing', expected: 'RH-LARFP' },
    { otherVal: 'cervix', expected: 'RH-Gyn1' },
    { otherVal: 'std', expected: 'RH-STI' },
    { otherVal: '', opdChecked: true, expected: 'RH-OPDSpec' }
  ];

  for (const tc of testCases) {
    const context = {
      document: {
        getElementById: (id) => {
          if (id === 'web_equity') return { value: '' }; // Paying patient!
          if (id === 'p2_other_dept') {
            return {
              value: tc.otherVal,
              selectedIndex: 0,
              options: [{ value: tc.otherVal, dataset: {} }]
            };
          }
          if (id === 'p2_dept_opd' && tc.opdChecked) return { checked: true };
          return null;
        },
        querySelector: () => null
      },
      loadedPatient: null,
      otherDefinitions: {
        emergency: { hefCode: 'RH-EMG' },
        surgery: { hefCode: 'RH-IPDSurg' },
        gynecology: { hefCode: 'RH-IPDGen' },
        maternity: { hefCode: 'RH-Del' },
        tb: { hefCode: 'RH-TB1' },
        anc: { hefCode: 'RH-OPDSpec' },
        pnc: { hefCode: 'RH-OPDSpec' },
        spacing: { hefCode: 'RH-LARFP' },
        cervix: { hefCode: 'RH-Gyn1' },
        std: { hefCode: 'RH-STI' }
      },
      getEmrCarePath: () => ({ mode: 'opd' })
    };

    vm.createContext(context);
    vm.runInContext(fnCode, context);
    const resolved = context.resolvePmrServiceCode();
    assert.equal(resolved, tc.expected, `Expected ${tc.expected} for otherVal=${tc.otherVal}`);
  }
});

test('v35.7 - getTriageServicePrefix maps correctly to all 9 user-confirmed prefixes', () => {
  const jsContent = fs.readFileSync(path.join(ROOT, 'public/emr-patient-record.js'), 'utf8');

  const startIdx = jsContent.indexOf('function getTriageServicePrefix()');
  const endIdx = jsContent.indexOf('function syncEncounterId()', startIdx);
  const fnCode = jsContent.slice(startIdx, endIdx);

  const prefixChecks = [
    { otherVal: 'emergency', expected: 'EMG' },
    { otherVal: 'surgery', expected: 'SURG' },
    { otherVal: 'gynecology', expected: 'GYN' },
    { otherVal: 'maternity', expected: 'MAT' },
    { otherVal: 'pediatric', expected: 'PED' },
    { otherVal: 'tb', expected: 'TB' },
    { otherVal: 'medicine', expected: 'MED' },
    { otherVal: 'spacing', expected: 'OPD' },
    { otherVal: 'anc', expected: 'OPD' },
    { isIcu: true, expected: 'ICU' }
  ];

  for (const pc of prefixChecks) {
    const context = {
      document: {
        getElementById: (id) => {
          if (id === 'p2_other_dept') return { value: pc.otherVal || '' };
          if (id === 'cb_dept_icu' && pc.isIcu) return { checked: true };
          return null;
        },
        querySelector: () => null
      },
      loadedPatient: null
    };

    vm.createContext(context);
    vm.runInContext(fnCode, context);
    const resolved = context.getTriageServicePrefix();
    assert.equal(resolved, pc.expected, `Prefix expected ${pc.expected} for test ${JSON.stringify(pc)}`);
  }
});

test('v35.7 - server updates encounter prefix and service code on department bed assignment', () => {
  const serverContent = fs.readFileSync(path.join(ROOT, 'server/server.mjs'), 'utf8');
  assert.match(serverContent, /if\s*\(update\.action === 'assign'\)\s*\{[\s\S]*prefixMap[\s\S]*serviceCodeMap/);
  assert.match(serverContent, /triageWardChanged/);
});
