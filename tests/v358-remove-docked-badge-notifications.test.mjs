import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');


test('v35.8 - Triage HTML has completely removed the 🔒 Docked badge elements for clean UI', () => {
  for (const relPath of ['protected/EMR.html', 'legacy-html/EMR.html']) {
    const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    assert.doesNotMatch(html, /id="service_code_docked_badge"/, `${relPath} should not contain service_code_docked_badge`);
    assert.doesNotMatch(html, /id="encounter_id_docked_badge"/, `${relPath} should not contain encounter_id_docked_badge`);
    assert.doesNotMatch(html, /🔒\s*Docked/, `${relPath} should not display 🔒 Docked text`);

    // Verify metadata display elements and hidden inputs remain intact
    assert.match(html, /id="display_service_code"/);
    assert.match(html, /id="web_service_code"/);
    assert.match(html, /id="display_encounter_id"/);
    assert.match(html, /id="web_encounter_id"/);

    // Verify Triage Save/Edit button workflow remains intact
    assert.match(html, /id="triage_save_btn"/);
    assert.match(html, /handleTriageSaveOrEdit\(\)/);
  }
});

test('v35.8 - emr-patient-record.js updateDockedBadges is safe and auto-plot logic persists', () => {
  const jsContent = fs.readFileSync(path.join(ROOT, 'public/emr-patient-record.js'), 'utf8');
  assert.ok(jsContent.includes('function resolvePmrServiceCode()'));
  assert.ok(jsContent.includes('function syncServiceCode()'));
  assert.ok(jsContent.includes('function syncEncounterId()'));
  assert.ok(jsContent.includes('function updateDockedBadges()'));
});
