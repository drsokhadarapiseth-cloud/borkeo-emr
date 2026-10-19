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

// 1. Update package.json version 36.7.0 -> 36.8.0
const pkgPath = path.join(ROOT, 'package.json');
let pkgContent = fs.readFileSync(pkgPath, 'utf8');
pkgContent = pkgContent.replace('"version": "36.7.0"', '"version": "36.8.0"');
fs.writeFileSync(pkgPath, pkgContent, 'utf8');
console.log('Updated package.json to v36.8.0');

// 2. Update public/login.html
const loginPath = path.join(ROOT, 'public', 'login.html');
let loginContent = fs.readFileSync(loginPath, 'utf8');
loginContent = loginContent.replace(/v36\.7/g, 'v36.8');
fs.writeFileSync(loginPath, loginContent, 'utf8');
console.log('Updated public/login.html to v36.8');

// 3. Update server/server.mjs
const serverPath = path.join(ROOT, 'server', 'server.mjs');
let serverContent = fs.readFileSync(serverPath, 'utf8');
serverContent = serverContent.replace(/Borkeo EMR v36\.7/g, 'Borkeo EMR v36.8');
fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Updated server/server.mjs to v36.8');

// 4. Update protected/EMR.html with asterisks, CSS, and switchPage check
const oldCaregiverHtml = `                    <div class="modern-section" id="caregiver_section">
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

const newCaregiverHtml = `                    <div class="modern-section" id="caregiver_section">
                        <h3 style="color:#2e7d32; font-weight:700; margin-top:0; margin-bottom:12px;">ព័ត៌មានអ្នកកំដរ <span style="color:red">*</span></h3>
                        <div style="display:grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr; gap:16px; align-items:flex-end;">
                            <div class="input-group">
                                <label for="web_caregiver_name">ឈ្មោះអ្នកកំដរ <span style="color:red">*</span></label>
                                <input type="text" class="modern-input" id="web_caregiver_name" name="scope:registration:id:web_caregiver_name" data-emr-no-auto-index placeholder="សូមបញ្ចូល" oninput="syncFields()">
                            </div>
                            <div class="input-group">
                                <label for="web_caregiver_phone">លេខទូរសព្ទ <span style="color:red">*</span></label>
                                <input type="tel" class="modern-input" id="web_caregiver_phone" name="scope:registration:id:web_caregiver_phone" data-emr-no-auto-index placeholder="000 000 0000" oninput="syncFields()">
                            </div>
                            <div class="input-group">
                                <label for="web_caregiver_relation">ទំនាក់ទំនង <span style="color:red">*</span></label>
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
                                <label>ភេទ <span style="color:red">*</span></label>
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

// Apply caregiver HTML with asterisks to protected/EMR.html and legacy-html/EMR.html
replaceInFile(path.join(ROOT, 'protected', 'EMR.html'), oldCaregiverHtml, newCaregiverHtml);
replaceInFile(path.join(ROOT, 'legacy-html', 'EMR.html'), oldCaregiverHtml, newCaregiverHtml);

// Add CSS .field-missing to protected/EMR.html and legacy-html/EMR.html
const oldVitalMissingCss = `        input.vital-missing {
            border-color: #94a3b8 !important;
            background: #fff !important;
            box-shadow: none !important;
        }`;

const newFieldMissingCss = `        input.vital-missing {
            border-color: #94a3b8 !important;
            background: #fff !important;
            box-shadow: none !important;
        }

        .field-missing {
            border-color: #dc2626 !important;
            box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2) !important;
        }`;

replaceInFile(path.join(ROOT, 'protected', 'EMR.html'), oldVitalMissingCss, newFieldMissingCss);
replaceInFile(path.join(ROOT, 'legacy-html', 'EMR.html'), oldVitalMissingCss, newFieldMissingCss);

// Add validateCaregiverInfoForForm and update switchPage
const oldSwitchPage = `        function switchPage(pageNumber) {
            var activeRole = String(window.emrSession?.user?.activeRole || window.sessionStorage?.getItem('borkeo-active-role') || '').toUpperCase();
            if (activeRole === 'TRIAGE' && Number(pageNumber) !== 2) return false;
            if (pageNumber === 3 && !validateTriageVitalsForForm()) return false;`;

const newSwitchPage = `        function validateCaregiverInfoForForm() {
            var activeRole = String(window.emrSession?.user?.activeRole || window.sessionStorage?.getItem('borkeo-active-role') || '').toUpperCase();
            var requestedBedView = new URLSearchParams(window.location.search).get('view') || '';
            if (['medical', 'daily', 'nursing', 'discharge', 'triage'].indexOf(requestedBedView) !== -1) {
                return true;
            }
            var loadedPatient = window.getLoadedEmrPatient?.();
            if (loadedPatient && (String(loadedPatient.serviceMode || '').toLowerCase() === 'ipd' || loadedPatient.admissionStatus === 'admitted') && ['DOCTOR', 'NURSE', 'MIDWIFE'].indexOf(activeRole) !== -1) {
                return true;
            }

            var nameInput = document.getElementById('web_caregiver_name');
            var phoneInput = document.getElementById('web_caregiver_phone');
            var relationSelect = document.getElementById('web_caregiver_relation');
            var sexRadio = document.querySelector('input[name="web_caregiver_sex"]:checked');

            var nameVal = String(nameInput?.value || '').trim();
            var phoneVal = String(phoneInput?.value || '').trim();
            var relationVal = String(relationSelect?.value || '').trim();
            var sexVal = String(sexRadio?.value || '').trim();

            var missingFields = [];
            if (!nameVal) missingFields.push('ឈ្មោះអ្នកកំដរ');
            if (!phoneVal) missingFields.push('លេខទូរសព្ទ');
            if (!relationVal) missingFields.push('ទំនាក់ទំនង');
            if (!sexVal) missingFields.push('ភេទ');

            if (nameInput) nameInput.classList.toggle('field-missing', !nameVal);
            if (phoneInput) phoneInput.classList.toggle('field-missing', !phoneVal);
            if (relationSelect) relationSelect.classList.toggle('field-missing', !relationVal);

            if (missingFields.length > 0) {
                alert('សូមបំពេញព័ត៌មានអ្នកកំដរឱ្យបានគ្រប់ជ្រុងជ្រោយ (' + missingFields.join(', ') + ') មុនបន្ត!');
                if (!nameVal && nameInput) nameInput.focus();
                else if (!phoneVal && phoneInput) phoneInput.focus();
                else if (!relationVal && relationSelect) relationSelect.focus();
                return false;
            }
            return true;
        }

        function switchPage(pageNumber) {
            var activeRole = String(window.emrSession?.user?.activeRole || window.sessionStorage?.getItem('borkeo-active-role') || '').toUpperCase();
            if (activeRole === 'TRIAGE' && Number(pageNumber) !== 2) return false;
            if (Number(pageNumber) > 1 && document.getElementById('page1')?.classList.contains('active')) {
                if (typeof window.validateCaregiverInfo === 'function') {
                    var caregiverErr = window.validateCaregiverInfo();
                    if (caregiverErr) {
                        alert(caregiverErr);
                        return false;
                    }
                } else if (typeof validateCaregiverInfoForForm === 'function' && !validateCaregiverInfoForForm()) {
                    return false;
                }
            }
            if (pageNumber === 3 && !validateTriageVitalsForForm()) return false;`;

replaceInFile(path.join(ROOT, 'protected', 'EMR.html'), oldSwitchPage, newSwitchPage);
replaceInFile(path.join(ROOT, 'legacy-html', 'EMR.html'), oldSwitchPage, newSwitchPage);

// 5. Update cache busters to ?v=3680
for (const file of [
  path.join(ROOT, 'protected', 'EMR.html'),
  path.join(ROOT, 'legacy-html', 'EMR.html'),
  path.join(ROOT, 'protected', 'patient-list.html'),
  path.join(ROOT, 'protected', 'triage.html'),
]) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\?v=3670/g, '?v=3680');
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated cache busters in ${file}`);
}

// 6. Update public/emr-patient-record.js: add validateCaregiverInfo, update validatePatient, clear field-missing on input
const oldValidatePatient = `  function validatePatient(context, options = {}) {
    if (!context.key) return t('idRequired');
    if (!context.summary.fullName) return t('nameRequired');
    if (!context.summary.sex || !context.summary.age || !context.summary.entryDate) return t('detailsRequired');
    const currentRole = String(window.emrSession?.user?.activeRole || '').toUpperCase();
    if (currentRole === 'REGISTRATION' && !selectedCaseType()) return 'សូមជ្រើសរើស ករណីថ្មី ឬ ករណីចាស់ មុនរក្សាទុកការចុះឈ្មោះ។';
    if (!options.allowMissingDepartment && !context.summary.departmentCode) return t('departmentRequired');
    return '';
  }`;

const newValidatePatient = `  function validateCaregiverInfo() {
    const nameInput = document.getElementById('web_caregiver_name');
    const phoneInput = document.getElementById('web_caregiver_phone');
    const relationSelect = document.getElementById('web_caregiver_relation');
    const sexRadio = document.querySelector('input[name="web_caregiver_sex"]:checked');

    const nameVal = String(nameInput?.value || '').trim();
    const phoneVal = String(phoneInput?.value || '').trim();
    const relationVal = String(relationSelect?.value || '').trim();
    const sexVal = String(sexRadio?.value || '').trim();

    nameInput?.classList.toggle('field-missing', !nameVal);
    phoneInput?.classList.toggle('field-missing', !phoneVal);
    relationSelect?.classList.toggle('field-missing', !relationVal);

    const missing = [];
    if (!nameVal) missing.push('ឈ្មោះអ្នកកំដរ');
    if (!phoneVal) missing.push('លេខទូរសព្ទ');
    if (!relationVal) missing.push('ទំនាក់ទំនង');
    if (!sexVal) missing.push('ភេទ');

    if (missing.length > 0) {
      if (!nameVal) nameInput?.focus();
      else if (!phoneVal) phoneInput?.focus();
      else if (!relationVal) relationSelect?.focus();
      return 'សូមបំពេញព័ត៌មានអ្នកកំដរឱ្យបានគ្រប់ជ្រុងជ្រោយ (' + missing.join(', ') + ') មុនបន្ត!';
    }
    return '';
  }
  window.validateCaregiverInfo = validateCaregiverInfo;

  function validatePatient(context, options = {}) {
    if (!context.key) return t('idRequired');
    if (!context.summary.fullName) return t('nameRequired');
    if (!context.summary.sex || !context.summary.age || !context.summary.entryDate) return t('detailsRequired');
    const currentRole = String(window.emrSession?.user?.activeRole || '').toUpperCase();
    if (currentRole === 'REGISTRATION' && !selectedCaseType()) return 'សូមជ្រើសរើស ករណីថ្មី ឬ ករណីចាស់ មុនរក្សាទុកការចុះឈ្មោះ។';

    const inRegistrationScope = activeEditorScope() === 'registration' || options.transferToTriage || currentRole === 'REGISTRATION';
    if (inRegistrationScope) {
      const caregiverError = validateCaregiverInfo();
      if (caregiverError) return caregiverError;
    }

    if (!options.allowMissingDepartment && !context.summary.departmentCode) return t('departmentRequired');
    return '';
  }`;

replaceInFile(path.join(ROOT, 'public', 'emr-patient-record.js'), oldValidatePatient, newValidatePatient);

// Add event listener binding to clear field-missing on input in emr-patient-record.js
const oldAttachEvents = `  function attachGlobalListeners() {`;
const newAttachEvents = `  function attachGlobalListeners() {
    document.getElementById('web_caregiver_name')?.addEventListener('input', function() {
      if (this.value.trim()) this.classList.remove('field-missing');
    });
    document.getElementById('web_caregiver_phone')?.addEventListener('input', function() {
      if (this.value.trim()) this.classList.remove('field-missing');
    });
    document.getElementById('web_caregiver_relation')?.addEventListener('change', function() {
      if (this.value.trim()) this.classList.remove('field-missing');
    });
    document.querySelectorAll('input[name="web_caregiver_sex"]').forEach(radio => {
      radio.addEventListener('change', function() {
        document.querySelectorAll('input[name="web_caregiver_sex"]').forEach(r => r.classList.remove('field-missing'));
      });
    });`;

replaceInFile(path.join(ROOT, 'public', 'emr-patient-record.js'), oldAttachEvents, newAttachEvents);

console.log('All v36.8 updates applied successfully!');
