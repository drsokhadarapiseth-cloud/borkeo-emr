import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
let s = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
const isCrlf = s.includes('\r\n');
const norm = str => str.replace(/\r\n/g, '\n');
let sNorm = norm(s);

const oldChunk = `        const effectiveRoleForMerge = registrationSave ? 'REGISTRATION' : (triageSave ? 'TRIAGE' : activeRoleBeforeSave);
        summary = mergePatientSummaryForRole(existingPatient, submittedSummary, effectiveRoleForMerge);
        const data = mergeRecordDataForRole(existingData, submittedData, effectiveRoleForMerge, Boolean(existingPatient));`;

const newChunk = `        const activeClinicalRole = sessionRole(session);
        const editorScope = ['ADMIN','VICE_DIRECTOR'].includes(activeClinicalRole) && ['triage','medical','nursing'].includes(body.editorScope)
          ? body.editorScope : '';
        const triageSave = body.triageSave === true || activeClinicalRole === 'TRIAGE' || editorScope === 'triage';
        const effectiveRoleForMerge = registrationSave ? 'REGISTRATION' : (triageSave ? 'TRIAGE' : activeRoleBeforeSave);
        summary = mergePatientSummaryForRole(existingPatient, submittedSummary, effectiveRoleForMerge);
        const data = mergeRecordDataForRole(existingData, submittedData, effectiveRoleForMerge, Boolean(existingPatient));`;

const oldLower = `        const activeClinicalRole = sessionRole(session);
        const editorScope=['ADMIN','VICE_DIRECTOR'].includes(activeClinicalRole) && ['triage','medical','nursing'].includes(body.editorScope)
          ? body.editorScope : '';
        const triageSave=body.triageSave===true || activeClinicalRole==='TRIAGE' || editorScope==='triage';`;

if (sNorm.includes(oldChunk)) {
  sNorm = sNorm.replace(oldChunk, newChunk);
  sNorm = sNorm.replace(oldLower, '// (activeClinicalRole, editorScope, triageSave declared earlier)');
  fs.writeFileSync(path.join(ROOT, 'server', 'server.mjs'), isCrlf ? sNorm.replace(/\n/g, '\r\n') : sNorm, 'utf8');
  console.log('Fixed declaration order in server/server.mjs');
} else {
  console.error('Could not find oldChunk in server/server.mjs');
}
