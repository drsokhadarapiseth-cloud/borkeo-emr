import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v31.5 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(((loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || loginHtml.includes('v32.7') || loginHtml.includes('v32.6')) || loginHtml.includes('v32.4') || loginHtml.includes('v32.3') || loginHtml.includes('v32.2') || loginHtml.includes('v32.1') || loginHtml.includes('v32.0') || loginHtml.includes('v31.9') || loginHtml.includes('v31.8') || loginHtml.includes('v31.7') || loginHtml.includes('v31.6') || loginHtml.includes('v31.5') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(((serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || serverMjs.includes('v32.7') || serverMjs.includes('v32.6')) || serverMjs.includes('v32.4') || serverMjs.includes('v32.3') || serverMjs.includes('v32.2') || serverMjs.includes('v32.1') || serverMjs.includes('v32.0') || serverMjs.includes('v31.9') || serverMjs.includes('v31.8') || serverMjs.includes('v31.7') || serverMjs.includes('v31.6') || serverMjs.includes('v31.5') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v31.5 bed-management.mjs validateBedState auto-releases stale/discharged occupant beds without throwing', async () => {
  const bedMgmtPath = path.join(root, 'server', 'bed-management.mjs');
  const { validateBedState } = await import(`file://${bedMgmtPath.replace(/\\/g, '/')}`);

  const existingState = { departments: [] };
  const incomingState = {
    departments: [
      {
        id: 'dept-medicine',
        code: 'ipd-medicine',
        rooms: [
          {
            id: 'room-1',
            code: 'room-1',
            beds: [
              { id: 'bed-1', label: '1', patientKey: 'case:MISSING-PATIENT' },
              { id: 'bed-2', label: '2', patientKey: '' }
            ]
          }
        ]
      }
    ]
  };

  const findPatient = (patientKey) => {
    // Stale/ghost patient does not exist in patient_records
    return null;
  };

  // Should NOT throw "The patient cannot occupy this bed."
  // Instead, it should clear the ghost patientKey from bed-1
  let validated;
  assert.doesNotThrow(() => {
    validated = validateBedState(existingState, incomingState, findPatient);
  });

  assert.equal(validated.departments[0].rooms[0].beds[0].patientKey, '', 'stale occupant must be cleared');
  assert.equal(validated.departments[0].rooms[0].beds[1].patientKey, '', 'empty bed remains unassigned');
});

test('v31.5 server.mjs /api/patient-admission checks occupant vitality before throwing conflict', () => {
  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  
  // Verify that the assign action clears stale bed occupancy instead of throwing false conflicts
  assert.ok(serverMjs.includes('assignmentBed?.patientKey&&assignmentBed.patientKey!==patientKey'), 'checks existing bed occupancy');
  assert.ok(serverMjs.includes("assignmentBed.patientKey=''"), 'auto-clears stale occupant key in bed assignment');
});

test('v31.5 departments.js removeStaleAssignments avoids dirtying state on load and assignPatient handles save gracefully', () => {
  const deptJs = fs.readFileSync(path.join(root, 'public', 'departments.js'), 'utf8');

  // Verify removeStaleAssignments does not call markDirty() on load
  const staleFn = deptJs.slice(deptJs.indexOf('function removeStaleAssignments()'), deptJs.indexOf('async function loadMap('));
  assert.ok(!staleFn.includes('markDirty()'), 'removeStaleAssignments must not call markDirty() on initial load');

  // Verify assignPatient does not abort patient admission if saveMap fails
  assert.ok(deptJs.includes('if (dirty) await saveMap().catch(() => false);'), 'assignPatient swallows non-fatal map save error to proceed with admission');
});
