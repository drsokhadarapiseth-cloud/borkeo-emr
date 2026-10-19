import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

// 1. Update public/patient-photo.js
let photoJs = fs.readFileSync(path.join(ROOT, 'public', 'patient-photo.js'), 'utf8');
const isCrlf = photoJs.includes('\r\n');
const norm = s => s.replace(/\r\n/g, '\n');
let normPhotoJs = norm(photoJs);

const oldTriagePhoto = `    const triagePhotoFrames = document.querySelectorAll('.triage-patient-photo-frame, #triage_patient_photo_frame');
    triagePhotoFrames.forEach((frame) => {
      if (photo) {
        frame.innerHTML = \`<img src="\${photo}" alt="Patient Photo" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">\`;
      } else {
        frame.innerHTML = \`<div class="photo-placeholder" style="font-size: 48px; color: #cbd5e1;" title="គ្មានរូបថត">👤</div>\`;
      }
    });`;

const newTriagePhoto = `    const triagePhotoFrames = document.querySelectorAll('.triage-patient-photo-frame, #triage_patient_photo_frame');
    triagePhotoFrames.forEach((frame) => {
      frame.style.cursor = 'pointer';
      frame.setAttribute('data-action', 'capture-patient-photo');
      if (photo) {
        frame.innerHTML = \`<img src="\${photo}" alt="Patient Photo" style="width:100%; height:100%; object-fit:cover; border-radius:6px; cursor:pointer;">\`;
      } else {
        frame.innerHTML = \`<div class="photo-placeholder" style="font-size: 48px; color: #cbd5e1; cursor:pointer;" title="គ្មានរូបថត - ចុចដើម្បីថតរូប">👤</div>\`;
      }
    });`;

if (normPhotoJs.includes(oldTriagePhoto)) {
  normPhotoJs = normPhotoJs.replace(oldTriagePhoto, newTriagePhoto);
  fs.writeFileSync(path.join(ROOT, 'public', 'patient-photo.js'), isCrlf ? normPhotoJs.replace(/\n/g, '\r\n') : normPhotoJs, 'utf8');
  console.log('Successfully updated triagePhotoFrames in public/patient-photo.js');
} else {
  console.error('Could not find oldTriagePhoto in public/patient-photo.js');
}

// 2. Update tests/v364
let v364 = fs.readFileSync(path.join(ROOT, 'tests', 'v364-performance-and-triage-workflow.test.mjs'), 'utf8');
v364 = v364.replace(/\/v36\\\.[45]\//g, '/v36\\.[456]/');
v364 = v364.replace(/'36\.5\.0'\]/g, "'36.5.0', '36.6.0']");
fs.writeFileSync(path.join(ROOT, 'tests', 'v364-performance-and-triage-workflow.test.mjs'), v364, 'utf8');

// 3. Update tests/v365
let v365 = fs.readFileSync(path.join(ROOT, 'tests', 'v365-triage-free-edit.test.mjs'), 'utf8');
v365 = v365.replace("assert.equal(pkg.version, '36.5.0');", "assert.ok(['36.5.0', '36.6.0'].includes(pkg.version));");
v365 = v365.replace(/\/v36\\\.5\//g, '/v36\\.[56]/');
fs.writeFileSync(path.join(ROOT, 'tests', 'v365-triage-free-edit.test.mjs'), v365, 'utf8');

console.log('Tests v364 and v365 updated');
