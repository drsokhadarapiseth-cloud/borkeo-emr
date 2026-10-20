import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('v40.1 chart tabs: role-based visibility rules in patient-banner.js', () => {
  const bannerCode = fs.readFileSync(path.join(projectRoot, 'public', 'patient-banner.js'), 'utf8');

  // Verify function definitions and export
  assert.match(bannerCode, /function getAllowedTabsForRole\s*\(/, 'patient-banner.js must define getAllowedTabsForRole');
  assert.match(bannerCode, /window\.getAllowedTabsForRole\s*=\s*getAllowedTabsForRole/, 'patient-banner.js must expose getAllowedTabsForRole');

  // Run in VM with sandbox
  const sandbox = {
    URLSearchParams,
    setTimeout: () => {},
    clearTimeout: () => {},
    window: {
      location: { pathname: '/emr', search: '' },
      addEventListener: () => {}
    },
    location: { pathname: '/emr', search: '' },
    document: {
      addEventListener: () => {},
      readyState: 'complete',
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    }
  };
  sandbox.window.document = sandbox.document;
  sandbox.document.defaultView = sandbox.window;
  sandbox.window.URLSearchParams = URLSearchParams;

  // Evaluate the helper logic
  const context = vm.createContext(sandbox);
  vm.runInContext(bannerCode, context);

  const getTabs = role => Array.from(sandbox.window.getAllowedTabsForRole(role));
  assert.equal(typeof sandbox.window.getAllowedTabsForRole, 'function', 'getAllowedTabsForRole must be callable');

  // 1. Management roles see all 7 tabs
  for (const role of ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']) {
    const tabs = getTabs(role);
    assert.deepEqual(tabs, ['summary', 'vitals', 'orders', 'results', 'meds', 'notes', 'billing'], `${role} must see all 7 tabs`);
  }

  // 2. Clinical roles (Doctor, Ward Head, Chief Ward) see clinical tabs, NO billing
  for (const role of ['DOCTOR', 'WARD_HEAD', 'CHIEF_WARD']) {
    const tabs = getTabs(role);
    assert.deepEqual(tabs, ['summary', 'vitals', 'orders', 'results', 'meds', 'notes'], `${role} must see clinical tabs without billing`);
    assert.ok(!tabs.includes('billing'), `${role} must not see billing tab`);
  }

  // 3. Inpatient Nursing roles (Nurse, Midwife) see clinical tabs, NO billing
  for (const role of ['NURSE', 'MIDWIFE']) {
    const tabs = getTabs(role);
    assert.deepEqual(tabs, ['summary', 'vitals', 'orders', 'results', 'meds', 'notes'], `${role} must see clinical tabs without billing`);
    assert.ok(!tabs.includes('billing'), `${role} must not see billing tab`);
  }

  // 4. Triage and Registration
  assert.deepEqual(getTabs('TRIAGE'), ['summary', 'vitals'], 'TRIAGE must see summary and vitals');
  assert.deepEqual(getTabs('REGISTRATION'), ['summary', 'vitals'], 'REGISTRATION must see summary and vitals');

  // 5. Billing / Finance roles
  for (const role of ['CLERK', 'ACCOUNTANT']) {
    const tabs = getTabs(role);
    assert.deepEqual(tabs, ['summary', 'billing'], `${role} must see summary and billing`);
    assert.ok(!tabs.includes('notes'), `${role} must not see clinical notes`);
  }

  // 6. Pharmacy
  assert.deepEqual(getTabs('PHARMACY'), ['summary', 'meds'], 'PHARMACY must see summary and meds');

  // 7. Paraclinic (Lab, Imaging)
  for (const role of ['LAB', 'IMAGING']) {
    const tabs = getTabs(role);
    assert.deepEqual(tabs, ['summary', 'orders', 'results'], `${role} must see summary, orders, results`);
  }
});
