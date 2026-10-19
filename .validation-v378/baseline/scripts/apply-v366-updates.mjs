import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

// Helper for CRLF-safe string replacement
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

// 1. package.json
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
pkg.version = '36.6.0';
fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('Updated package.json to 36.6.0');

// 2. public/login.html
let login = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
login = login.replace(/data-app-version data-language-exclude>v36\.[0-9]</g, 'data-app-version data-language-exclude>v36.6<');
fs.writeFileSync(path.join(ROOT, 'public', 'login.html'), login, 'utf8');
console.log('Updated public/login.html');

// 3. server/server.mjs
let server = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
server = server.replace(/Borkeo EMR v36\.[0-9]/g, 'Borkeo EMR v36.6');
fs.writeFileSync(path.join(ROOT, 'server', 'server.mjs'), server, 'utf8');
console.log('Updated server/server.mjs');

// 4. server/access.mjs: allow staff to access patient for photo if no patientWard assigned yet
replaceInFile(
  path.join(ROOT, 'server', 'access.mjs'),
  "  const patientWard = patientWorkWard(row);\n  if (!patientWard && (role === 'REGISTRATION' || role === 'TRIAGE')) return true;",
  "  const patientWard = patientWorkWard(row);\n  if (!patientWard) return true;"
);

// 5. public/emr-patient-record.js: otherDefinitions & getTriageServicePrefix
const oldOtherDefs = `  const otherDefinitions = {
    emergency: { code: 'emergency', kh: 'ផ្នែកសង្គ្រោះបន្ទាន់', en: 'Emergency', mode: 'ipd', hefCode: 'RH-EMG' },
    medicine: { code: 'medicine', kh: 'ផ្នែកជំងឺទូទៅ', en: 'Medicine', mode: 'ipd', hefCode: 'RH-IPDGen' },
    surgery: { code: 'surgery', kh: 'ផ្នែកវះកាត់', en: 'Surgery', mode: 'ipd', hefCode: 'RH-IPDSurg' },
    gynecology: { code: 'gynecology', kh: 'ផ្នែករោគស្ត្រី', en: 'Gynecology', mode: 'ipd', hefCode: 'RH-IPDGen' },
    maternity: { code: 'obstetric', kh: 'ផ្នែកសម្ភព', en: 'Maternity', mode: 'ipd', hefCode: 'RH-Del' },
    pediatric: { code: 'pediatric', kh: 'ផ្នែកជំងឺកុមារ', en: 'Pediatric', mode: 'ipd', hefCode: 'RH-IPDGen' },
    tb: { code: 'tb', kh: 'ផ្នែកជំងឺរបេង', en: 'Tuberculosis', mode: 'ipd', hefCode: 'RH-TB1' },
    anc: { code: 'anc', kh: 'ពិនិត្យផ្ទៃពោះ', en: 'Antenatal Care', mode: 'opd', module: 'anc', hefCode: 'RH-OPDSpec' },
    pnc: { code: 'pnc', kh: 'ថែទាំក្រោយសម្រាល', en: 'Postnatal Care', mode: 'opd', module: 'pnc', hefCode: 'RH-OPDSpec' },
    spacing: { code: 'family-planning', kh: 'ពន្យាកំណើត', en: 'Family Planning / Contraception', mode: 'opd', module: 'spacing', hefCode: 'RH-LARFP' },
    safe: { code: 'safe-abortion', kh: 'រំលូតកូនដោយសុវត្ថិភាព', en: 'Safe Abortion', mode: 'opd', module: 'safe', hefCode: 'RH-Del' },
    cervix: { code: 'cervix-screening', kh: 'ពិនិត្យមហារីកមាត់ស្បូន', en: 'Cervical Cancer Screening', mode: 'opd', module: 'cervix', hefCode: 'RH-Gyn1' },
    std: { code: 'std', kh: 'ជំងឺកាមរោគ', en: 'Sexually Transmitted Diseases', mode: 'opd', module: 'general', hefCode: 'RH-STI' },
  };`;

const newOtherDefs = `  const otherDefinitions = {
    emergency: { code: 'emergency', kh: 'ផ្នែកសង្គ្រោះបន្ទាន់', en: 'Emergency', mode: 'ipd', hefCode: 'RH-EMG' },
    medicine: { code: 'medicine', kh: 'ផ្នែកជំងឺទូទៅ', en: 'Medicine', mode: 'ipd', hefCode: 'RH-IPDGen' },
    surgery: { code: 'surgery', kh: 'ផ្នែកវះកាត់', en: 'Surgery', mode: 'ipd', hefCode: 'RH-IPDSurg' },
    gynecology: { code: 'gynecology', kh: 'ផ្នែករោគស្ត្រី', en: 'Gynecology', mode: 'ipd', hefCode: 'RH-IPDGen' },
    maternity: { code: 'obstetric', kh: 'ផ្នែកសម្ភព', en: 'Maternity', mode: 'ipd', hefCode: 'RH-Del' },
    pediatric: { code: 'pediatric', kh: 'ផ្នែកជំងឺកុមារ', en: 'Pediatric', mode: 'ipd', hefCode: 'RH-IPDGen' },
    tb: { code: 'tb', kh: 'ផ្នែកជំងឺរបេង', en: 'Tuberculosis', mode: 'ipd', hefCode: 'RH-TB1' },
    infectious: { code: 'infectious', kh: 'ផ្នែកជំងឺឆ្លង', en: 'Infectious Diseases Ward', mode: 'ipd', hefCode: 'RH-IPDGen' },
    eyecare: { code: 'eyecare', kh: 'មណ្ឌលថែទាំភ្នែក', en: 'Eye Care Service', mode: 'opd', module: 'general', hefCode: 'RH-OPDSpec' },
    anc: { code: 'anc', kh: 'ពិនិត្យផ្ទៃពោះ', en: 'Antenatal Care', mode: 'opd', module: 'anc', hefCode: 'RH-OPDSpec' },
    pnc: { code: 'pnc', kh: 'ថែទាំក្រោយសម្រាល', en: 'Postnatal Care', mode: 'opd', module: 'pnc', hefCode: 'RH-OPDSpec' },
    spacing: { code: 'family-planning', kh: 'ពន្យាកំណើត', en: 'Family Planning / Contraception', mode: 'opd', module: 'spacing', hefCode: 'RH-LARFP' },
    safe: { code: 'safe-abortion', kh: 'រំលូតកូនដោយសុវត្ថិភាព', en: 'Safe Abortion', mode: 'opd', module: 'safe', hefCode: 'RH-Del' },
    cervix: { code: 'cervix-screening', kh: 'ពិនិត្យមហារីកមាត់ស្បូន', en: 'Cervical Cancer Screening', mode: 'opd', module: 'cervix', hefCode: 'RH-Gyn1' },
    std: { code: 'std', kh: 'ជំងឺកាមរោគ', en: 'Sexually Transmitted Diseases', mode: 'opd', module: 'general', hefCode: 'RH-STI' },
  };`;

replaceInFile(path.join(ROOT, 'public', 'emr-patient-record.js'), oldOtherDefs, newOtherDefs);

replaceInFile(
  path.join(ROOT, 'public', 'emr-patient-record.js'),
  "if (['anc', 'pnc', 'spacing', 'cervix', 'std'].includes(otherDept)) return 'OPD';",
  "if (otherDept === 'infectious') return 'MED';\n      if (['anc', 'pnc', 'spacing', 'cervix', 'std', 'eyecare'].includes(otherDept)) return 'OPD';"
);

// 6. protected/EMR.html & legacy-html/EMR.html
const oldSelectHtml = `                            <option value="tb" data-key="opt_tb" data-hef-code="RH-TB1">ជំងឺរបេង</option>
                            <option value="anc" data-key="opt_anc" data-hef-code="RH-OPDSpec">ពិនិត្យផ្ទៃពោះ (ANC)</option>`;

const newSelectHtml = `                            <option value="tb" data-key="opt_tb" data-hef-code="RH-TB1">ជំងឺរបេង</option>
                            <option value="infectious" data-key="opt_infectious" data-hef-code="RH-IPDGen">ផ្នែកជំងឺឆ្លង</option>
                            <option value="eyecare" data-key="opt_eyecare" data-hef-code="RH-OPDSpec">មណ្ឌលថែទាំភ្នែក</option>
                            <option value="anc" data-key="opt_anc" data-hef-code="RH-OPDSpec">ពិនិត្យផ្ទៃពោះ (ANC)</option>`;

replaceInFile(path.join(ROOT, 'protected', 'EMR.html'), oldSelectHtml, newSelectHtml);
replaceInFile(path.join(ROOT, 'legacy-html', 'EMR.html'), oldSelectHtml, newSelectHtml);

const oldKhmerTrans = 'opt_tb: "ផ្នែកជំងឺរបេង", opt_anc:';
const newKhmerTrans = 'opt_tb: "ផ្នែកជំងឺរបេង", opt_infectious: "ផ្នែកជំងឺឆ្លង", opt_eyecare: "មណ្ឌលថែទាំភ្នែក", opt_anc:';
replaceInFile(path.join(ROOT, 'protected', 'EMR.html'), oldKhmerTrans, newKhmerTrans);
replaceInFile(path.join(ROOT, 'legacy-html', 'EMR.html'), oldKhmerTrans, newKhmerTrans);

const oldEngTrans = 'opt_tb: "Tuberculosis (TB)", opt_anc:';
const newEngTrans = 'opt_tb: "Tuberculosis (TB)", opt_infectious: "Infectious Diseases Ward", opt_eyecare: "Eye Care Service", opt_anc:';
replaceInFile(path.join(ROOT, 'protected', 'EMR.html'), oldEngTrans, newEngTrans);
replaceInFile(path.join(ROOT, 'legacy-html', 'EMR.html'), oldEngTrans, newEngTrans);

// 7. public/patient-photo.js: clean photo click without camera icon
let photoJs = fs.readFileSync(path.join(ROOT, 'public', 'patient-photo.js'), 'utf8');

// Ensure persistPatientPhotoIfLoaded grabs ?patient= parameter
photoJs = photoJs.replace(
  "const patientKey = p?.patientKey || new URLSearchParams(location.search).get('patientKey') || '';",
  "const patientKey = p?.patientKey || p?.id || p?.patient_key || new URLSearchParams(location.search).get('patient') || new URLSearchParams(location.search).get('patientKey') || '';"
);

// Click listeners: add .triage-patient-photo-frame and #triage_patient_photo_frame
photoJs = photoJs.replace(
  "e.target.closest('.registration-avatar, #reg_patient_photo_avatar, .patient-header-photo-frame, .inpatient-context-avatar-card, [data-action=\"capture-patient-photo\"]');",
  "e.target.closest('.registration-avatar, #reg_patient_photo_avatar, .patient-header-photo-frame, .inpatient-context-avatar-card, .triage-patient-photo-frame, #triage_patient_photo_frame, [data-action=\"capture-patient-photo\"]');"
);

// Triage photo frame: make clickable
photoJs = photoJs.replace(
  `    const triagePhotoFrames = document.querySelectorAll('.triage-patient-photo-frame, #triage_patient_photo_frame');
    triagePhotoFrames.forEach((frame) => {
      if (photo) {
        frame.innerHTML = \`<img src="\${photo}" alt="Patient Photo" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">\`;
      } else {
        frame.innerHTML = \`<div class="photo-placeholder" style="font-size: 48px; color: #cbd5e1;" title="គ្មានរូបថត">👤</div>\`;
      }
    });`,
  `    const triagePhotoFrames = document.querySelectorAll('.triage-patient-photo-frame, #triage_patient_photo_frame');
    triagePhotoFrames.forEach((frame) => {
      frame.style.cursor = 'pointer';
      frame.setAttribute('data-action', 'capture-patient-photo');
      if (photo) {
        frame.innerHTML = \`<img src="\${photo}" alt="Patient Photo" style="width:100%; height:100%; object-fit:cover; border-radius:6px; cursor:pointer;">\`;
      } else {
        frame.innerHTML = \`<div class="photo-placeholder" style="font-size: 48px; color: #cbd5e1; cursor:pointer;" title="គ្មានរូបថត - ចុចដើម្បីថតរូប">👤</div>\`;
      }
    });`
);

fs.writeFileSync(path.join(ROOT, 'public', 'patient-photo.js'), photoJs, 'utf8');
console.log('Updated public/patient-photo.js');

// 8. public/patient-photo.css: hide camera badge and set cursor: pointer on all photo frames
let photoCss = fs.readFileSync(path.join(ROOT, 'public', 'patient-photo.css'), 'utf8');
if (!photoCss.includes('.photo-retake-camera-badge { display: none !important; }')) {
  photoCss += `\n/* v36.6 - Hide camera icon overlay badge; direct click on photo opens modal */\n.photo-retake-camera-badge { display: none !important; }\n.opd-patient-photo-frame, .ipd-patient-photo-frame, .triage-patient-photo-frame, .inpatient-context-avatar-card, .registration-avatar { cursor: pointer !important; }\n`;
  fs.writeFileSync(path.join(ROOT, 'public', 'patient-photo.css'), photoCss, 'utf8');
  console.log('Updated public/patient-photo.css');
}

// 9. Cache busters
const htmlFiles = [
  'protected/EMR.html',
  'legacy-html/EMR.html',
  'protected/patient-list.html',
  'protected/triage.html'
];
for (const file of htmlFiles) {
  let content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  content = content.replace(/\?v=3650/g, '?v=3660');
  fs.writeFileSync(path.join(ROOT, file), content, 'utf8');
  console.log('Updated cache busters in', file);
}
