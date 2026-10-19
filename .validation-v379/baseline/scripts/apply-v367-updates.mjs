import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

function replaceInFile(filePath, searchStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCrlf = content.includes('\r\n');
  const norm = s => s.replace(/\r\n/g, '\n');
  let normContent = norm(content);
  let normSearch = norm(searchStr);
  let normReplace = norm(replaceStr);

  if (!normContent.includes(normSearch)) {
    console.error(`Could not find search string in ${filePath}`);
    return false;
  }
  normContent = normContent.replace(normSearch, normReplace);
  fs.writeFileSync(filePath, isCrlf ? normContent.replace(/\n/g, '\r\n') : normContent, 'utf8');
  console.log(`Updated ${filePath}`);
  return true;
}

const caregiverSectionHtml = `                    <div class="modern-section" id="caregiver_section">
                        <h3 style="color:#2e7d32; font-weight:700; margin-top:0; margin-bottom:12px;">ព័ត៌មានអ្នកកំដរ</h3>
                        <div style="display:grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr; gap:16px; align-items:flex-end;">
                            <div class="input-group">
                                <label for="web_caregiver_name">ឈ្មោះអ្នកកំដរ</label>
                                <input type="text" class="modern-input" id="web_caregiver_name" name="scope:registration:id:web_caregiver_name" data-emr-no-auto-index placeholder="សូមបញ្ចូល" oninput="syncFields()">
                            </div>
                            <div class="input-group">
                                <label for="web_caregiver_phone">លេខទូរសព្ទ</label>
                                <input type="tel" class="modern-input" id="web_caregiver_phone" name="scope:registration:id:web_caregiver_phone" data-emr-no-auto-index placeholder="000 000 0000" oninput="syncFields()">
                            </div>
                            <div class="input-group">
                                <label for="web_caregiver_relation">ទំនាក់ទំនង</label>
                                <select class="modern-input" id="web_caregiver_relation" name="scope:registration:id:web_caregiver_relation" data-emr-no-auto-index onchange="syncFields()">
                                    <option value="">ជ្រើសរើស</option>
                                    <option value="ឪពុក/ម្ដាយ">ឪពុក/ម្ដាយ</option>
                                    <option value="ប្ដី/ប្រពន្ធ">ប្ដី/ប្រពន្ធ</option>
                                    <option value="កូន">កូន</option>
                                    <option value="បងប្អូន">បងប្អូន</option>
                                    <option value="សាច់ញាតិ">សាច់ញាតិ</option>
                                    <option value="អាណាព្យាបាល">អាណាព្យាបាល</option>
                                    <option value="អ្នកជិតខាង">អ្នកជិតខាង</option>
                                    <option value="ផ្សេងៗ">ផ្សេងៗ</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>ភេទ</label>
                                <div class="radio-group" style="display:flex; gap:16px; align-items:center; height:38px;">
                                    <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer; font-weight:normal;">
                                        <input type="radio" name="web_caregiver_sex" id="web_caregiver_sex_male" value="ប្រុស" data-emr-no-auto-index onchange="syncFields()"> ប្រុស
                                    </label>
                                    <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer; font-weight:normal;">
                                        <input type="radio" name="web_caregiver_sex" id="web_caregiver_sex_female" value="ស្រី" data-emr-no-auto-index onchange="syncFields()"> ស្រី
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>`;

// 1. Update protected/EMR.html
const targetProtected = `                                <div class="input-group" style="grid-column: span 12;"><label>កាយសម្បទា <span
                                            style="color:red">*</span></label>
                                    <div class="radio-group">
                                        <label><input type="radio" name="disability"> ពិការ</label>
                                        <label><input type="radio" name="disability"> មិនពិការ</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;

replaceInFile(
  path.join(ROOT, 'protected', 'EMR.html'),
  targetProtected,
  `${targetProtected}\n\n${caregiverSectionHtml}`
);

// Update cache busters in protected/EMR.html
let emrProtected = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
emrProtected = emrProtected.replace(/\?v=3660/g, '?v=3670');
fs.writeFileSync(path.join(ROOT, 'protected', 'EMR.html'), emrProtected, 'utf8');
console.log('Updated cache busters in protected/EMR.html');

// 2. Update legacy-html/EMR.html
const targetLegacy = `                                <div class="input-group" style="grid-column: span 12;"><label>ការយល់ដឹង <span
                                            style="color:red">*</span></label>
                                    <div class="radio-group">
                                        <label><input type="radio" name="disability"> ពិការ</label>
                                        <label><input type="radio" name="disability"> មិនពិការ</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;

replaceInFile(
  path.join(ROOT, 'legacy-html', 'EMR.html'),
  targetLegacy,
  `${targetLegacy}\n\n${caregiverSectionHtml}`
);

let emrLegacy = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');
emrLegacy = emrLegacy.replace(/\?v=3660/g, '?v=3670');
fs.writeFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), emrLegacy, 'utf8');
console.log('Updated cache busters in legacy-html/EMR.html');

// 3. Update cache busters in protected/patient-list.html and protected/triage.html
let patientList = fs.readFileSync(path.join(ROOT, 'protected', 'patient-list.html'), 'utf8');
patientList = patientList.replace(/\?v=3660/g, '?v=3670');
fs.writeFileSync(path.join(ROOT, 'protected', 'patient-list.html'), patientList, 'utf8');
console.log('Updated cache busters in protected/patient-list.html');

let triage = fs.readFileSync(path.join(ROOT, 'protected', 'triage.html'), 'utf8');
triage = triage.replace(/\?v=3660/g, '?v=3670');
fs.writeFileSync(path.join(ROOT, 'protected', 'triage.html'), triage, 'utf8');
console.log('Updated cache busters in protected/triage.html');

// 4. Update public/emr-patient-record.js for caregiver persistence
const readTarget = `    const photoValue = document.getElementById('web_patient_photo')?.value ||
      document.querySelector('input[name="scope:registration:id:patient_photo"]')?.value ||
      document.querySelector('input[name="system:patientPhoto"]')?.value || '';
    if (photoValue) {
      data['scope:registration:id:patient_photo'] = photoValue;
      data['system:patientPhoto'] = photoValue;
    }`;

const readReplacement = `    const photoValue = document.getElementById('web_patient_photo')?.value ||
      document.querySelector('input[name="scope:registration:id:patient_photo"]')?.value ||
      document.querySelector('input[name="system:patientPhoto"]')?.value || '';
    if (photoValue) {
      data['scope:registration:id:patient_photo'] = photoValue;
      data['system:patientPhoto'] = photoValue;
    }
    const caregiverName = document.getElementById('web_caregiver_name')?.value?.trim() || '';
    const caregiverPhone = document.getElementById('web_caregiver_phone')?.value?.trim() || '';
    const caregiverRelation = document.getElementById('web_caregiver_relation')?.value?.trim() || '';
    const caregiverSexRadio = document.querySelector('input[name="web_caregiver_sex"]:checked');
    const caregiverSex = caregiverSexRadio ? caregiverSexRadio.value : '';

    if (caregiverName) data['scope:registration:id:web_caregiver_name'] = caregiverName;
    if (caregiverPhone) data['scope:registration:id:web_caregiver_phone'] = caregiverPhone;
    if (caregiverRelation) data['scope:registration:id:web_caregiver_relation'] = caregiverRelation;
    if (caregiverSex) data['scope:registration:id:web_caregiver_sex'] = caregiverSex;`;

replaceInFile(path.join(ROOT, 'public', 'emr-patient-record.js'), readTarget, readReplacement);

const restoreTarget = `    const storedCaseType = String(data['system:caseType'] || '').toLowerCase();
    if (storedCaseType === 'new' || storedCaseType === 'old') {
      document.querySelectorAll('input[name="emr_pmrs_case_type"]').forEach(control => { control.checked = control.value === storedCaseType; });
    }`;

const restoreReplacement = `    const storedCaseType = String(data['system:caseType'] || '').toLowerCase();
    if (storedCaseType === 'new' || storedCaseType === 'old') {
      document.querySelectorAll('input[name="emr_pmrs_case_type"]').forEach(control => { control.checked = control.value === storedCaseType; });
    }
    const cName = data['scope:registration:id:web_caregiver_name'] || data['web_caregiver_name'] || '';
    const cPhone = data['scope:registration:id:web_caregiver_phone'] || data['web_caregiver_phone'] || '';
    const cRelation = data['scope:registration:id:web_caregiver_relation'] || data['web_caregiver_relation'] || '';
    const cSex = data['scope:registration:id:web_caregiver_sex'] || data['web_caregiver_sex'] || '';

    const cNameEl = document.getElementById('web_caregiver_name');
    if (cNameEl && cName) cNameEl.value = cName;

    const cPhoneEl = document.getElementById('web_caregiver_phone');
    if (cPhoneEl && cPhone) cPhoneEl.value = cPhone;

    const cRelEl = document.getElementById('web_caregiver_relation');
    if (cRelEl && cRelation) cRelEl.value = cRelation;

    if (cSex === 'ប្រុស') {
      const m = document.getElementById('web_caregiver_sex_male');
      if (m) m.checked = true;
    } else if (cSex === 'ស្រី') {
      const f = document.getElementById('web_caregiver_sex_female');
      if (f) f.checked = true;
    }`;

replaceInFile(path.join(ROOT, 'public', 'emr-patient-record.js'), restoreTarget, restoreReplacement);

// In loadNewRegistrationVisit, include caregiver fields
const visitTarget = `for (const id of ['web_nssf','web_nat','web_province','web_province_code','web_district','web_district_code','web_commune','web_commune_code','web_village','web_village_code','web_street_address','web_coverage_area']) {`;
const visitReplacement = `for (const id of ['web_nssf','web_nat','web_province','web_province_code','web_district','web_district_code','web_commune','web_commune_code','web_village','web_village_code','web_street_address','web_coverage_area','web_caregiver_name','web_caregiver_phone','web_caregiver_relation']) {`;

replaceInFile(path.join(ROOT, 'public', 'emr-patient-record.js'), visitTarget, visitReplacement);

console.log('All v36.7 updates applied successfully!');
