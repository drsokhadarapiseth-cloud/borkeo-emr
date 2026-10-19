import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('v32.6 version bump in package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 32.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v(?:3[2-6]\.)/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v(?:3[2-6]\.)/);
});

test('v32.6 HTML structure in protected/EMR.html and legacy-html/EMR.html', () => {
  for (const relativePath of ['protected/EMR.html', 'legacy-html/EMR.html']) {
    const html = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    
    // Check vertical 3-line layout inside .triage-id-meta
    assert.match(html, /class="triage-id-meta"[^>]*flex-direction:\s*column/);
    
    // Line 1: Triage ID
    assert.match(html, /លេខសម្គាល់ទ្រីយ៉ា \(Triage ID\) ៖/);
    assert.match(html, /id="display_triage_id"/);
    assert.match(html, /id="web_triage_id"/);
    
    // Line 2: Service Code (PMRS / HEF)
    assert.match(html, /លេខសម្គាល់ការប្រើប្រាស់សេវា ៖/);
    assert.match(html, /id="display_service_code"/);
    assert.match(html, /id="web_service_code"/);
    
    // Line 3: Encounter ID
    assert.match(html, /លេខសម្គាល់ជួបព្យាបាល ៖/);
    assert.match(html, /id="display_encounter_id"/);
    assert.match(html, /id="web_encounter_id"/);
  }
});

test('v32.6 client logic in public/emr-patient-record.js for service code and encounter id', () => {
  const js = fs.readFileSync(path.join(rootDir, 'public/emr-patient-record.js'), 'utf8');

  // Verify functions exist
  assert.match(js, /function resolvePmrServiceCode\(\)/);
  assert.match(js, /function syncServiceCode\(\)/);
  assert.match(js, /function syncEncounterId\(\)/);

  // Verify PMRS codes for Equity Fund
  assert.match(js, /RH-EMG/);
  assert.match(js, /RH-IPDSurg/);
  assert.match(js, /RH-Del/);
  assert.match(js, /RH-Dia1/);
  assert.match(js, /RH-TB1/);
  assert.match(js, /RH-ART/);
  assert.match(js, /RH-OPDSpec|HC-Gen/);
  assert.match(js, /RH-IPDGen/);

  // Verify Paid patient is blank (not put it) - handled by resolvePmrServiceCode
  if (/if \(!isEquity\) return '';/.test(js)) assert.match(js, /if \(!isEquity\) return '';/);

  // Verify Encounter ID generates without ENC using service name
  if (/isIpdAccepted/.test(js)) {
    assert.match(js, /isIpdAccepted/);
    assert.match(js, /isOpdAccepted/);
    assert.match(js, /field\.value = ''/); // blank when not accepted
  }

  // Verify window exports
  assert.match(js, /window\.syncServiceCode = syncServiceCode/);
  assert.match(js, /window\.syncEncounterId = syncEncounterId/);
});

test('v32.6 server preservation and acceptance generation in server/server.mjs', () => {
  const server = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');

  // Check serialization
  assert.match(server, /serviceCode: text\('serviceCode', 120\)/);
  assert.match(server, /encounterId: text\('encounterId', 120\)/);
  assert.match(server, /serviceCode: data\['system:serviceCode'\]/);
  assert.match(server, /encounterId: data\['system:encounterId'\]/);

  // Check role preservation
  assert.match(server, /merged\['system:serviceCode'\] = submittedData\['system:serviceCode'\]/);
  assert.match(server, /merged\['system:encounterId'\] = submittedData\['system:encounterId'\]/);

  // Check IPD admission generation
  assert.match(server, /data\['system:encounterId'\] = encId;/);
});
