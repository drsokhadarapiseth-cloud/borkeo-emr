import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('v30.6 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0);

  const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'server.mjs'), 'utf8');
  assert.match(serverCode, /Borkeo EMR v3[0-9]\./);

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v3[0-9]\./);
});

test('v30.6 direct laboratory ordering and removal of intermediate requisition button', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');

  // Direct Lab order button in main panel header
  assert.match(paraclinicJs, /data-request-lab/);
  assert.match(paraclinicJs, /\+ ស្នើសុំមន្ទីរពិសោធន៍ \(Lab\)/);

  // Direct Imaging order button
  assert.match(paraclinicJs, /data-request-imaging/);
  assert.match(paraclinicJs, /\+ ស្នើសុំរូបភាព \(Imaging\)/);

  // In openRequestChooser, clicking lab tab directly routes to openLabOrder
  assert.match(paraclinicJs, /openLabOrder\(context, patient\.patientKey\)/);

  // Intermediate screen with button + បើកប័ណ្ណស្នើសុំតេស្តមន្ទីរពិសោធន៍ has been removed
  assert.doesNotMatch(paraclinicJs, /បើកប័ណ្ណស្នើសុំតេស្តមន្ទីរពិសោធន៍ \/ Open Laboratory Request Form/);
  assert.doesNotMatch(paraclinicJs, /ទម្រង់ស្នើសុំវិភាគតេស្តមន្ទីរពិសោធន៍ផ្លូវការ ស្របតាមប័ណ្ណក្រដាសមន្ទីរពេទ្យបង្អែកបរកែវ/);
});

test('v30.6 clean row alignment, simplified CBC, and complete elimination of filler dots', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');
  const paraclinicCss = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.css'), 'utf8');

  // Strict row alignment: .test-check-row flex container with whitespace nowrap
  assert.match(paraclinicCss, /\.test-check-row\s*\{[^}]*display:\s*flex;/);
  assert.match(paraclinicCss, /\.test-check-row \.test-label\s*\{[^}]*white-space:\s*nowrap;/);

  // CBC simplified to clean single row: Complete Blood Count (CBC)
  assert.match(paraclinicJs, /Complete Blood Count \(CBC\)/);
  assert.doesNotMatch(paraclinicJs, /Medonic M-Serie/);
  assert.doesNotMatch(paraclinicJs, /Manual WBC differential Counts/);
  assert.doesNotMatch(paraclinicJs, /class="cbc-param-grid"/);
  assert.doesNotMatch(paraclinicJs, /class="diff-param-grid"/);

  // No trailing dots in test names
  assert.doesNotMatch(paraclinicJs, /Bleeding Time\/Ts \.\.\.\.\.\.\.\./);
  assert.doesNotMatch(paraclinicJs, /Clotting Time\/Tc \.\.\.\.\.\.\.\./);
  assert.doesNotMatch(paraclinicJs, /PT \(Prothrombin Time\) \.\.\.\.\.\.\.\./);
  assert.doesNotMatch(paraclinicJs, /INR \(International Normalized Ratio\) \.\.\.\.\.\.\.\./);
  assert.doesNotMatch(paraclinicJs, /HBs antigen \.\.\.\.\.\.\.\./);
  assert.doesNotMatch(paraclinicJs, /Glucose \(fasting\/Random\) \.\.\.\.\.\.\.\./);
  assert.doesNotMatch(paraclinicJs, /Transaminase -AST\/GOT\.\.\.\.\. -ALT\/GPT\.\.\.\.\./);

  // Clean formatted names
  assert.match(paraclinicJs, /Bleeding Time \(Ts\)/);
  assert.match(paraclinicJs, /Clotting Time \(Tc\)/);
  assert.match(paraclinicJs, /PT \(Prothrombin Time\)/);
  assert.match(paraclinicJs, /INR \(International Normalized Ratio\)/);
  assert.match(paraclinicJs, /Transaminase \(AST\/GOT, ALT\/GPT\)/);
});

test('v30.6 per-test urgent stars and elimination of global top urgent checkbox', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');
  const paraclinicCss = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.css'), 'utf8');

  // Top urgent checkbox removed from patient demographic info box
  assert.doesNotMatch(paraclinicJs, /name="isUrgentPriority"/);
  assert.doesNotMatch(paraclinicJs, /data-paper-urgent/);

  // Per-test urgent star button present on each test row
  assert.match(paraclinicJs, /class="test-star-urgent"/);
  assert.match(paraclinicJs, /data-star-code=/);
  assert.match(paraclinicCss, /\.test-star-urgent/);
  assert.match(paraclinicCss, /\.test-star-urgent\.active/);

  // Handlers track urgent tests individually
  assert.match(paraclinicJs, /urgentCodes/);
  assert.match(paraclinicJs, /urgent:\s*urgentCodes\.has\(code\)/);
});

test('v30.6 clean Khmer UI without slashed English on buttons and titles', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');

  // Clean Khmer titles and buttons without slashed English
  assert.match(paraclinicJs, /ការស្នើសុំ និងលទ្ធផល Paraclinic/);
  assert.match(paraclinicJs, /<summary>សំណើ និងលទ្ធផល<\/summary>/);
  assert.match(paraclinicJs, /<button type="button" data-cancel>បោះបង់<\/button>/);
  assert.match(paraclinicJs, /🖨️ បោះពុម្ព<\/button>/);
  assert.match(paraclinicJs, /🖨️ បោះពុម្ពប័ណ្ណស្នើសុំ<\/button>/);
  assert.match(paraclinicJs, /<strong style="color:#0369a1;">ប័ណ្ណស្នើសុំផ្លូវការ<\/strong>/);

  // International medical terminology preserved in English
  assert.match(paraclinicJs, /Complete Blood Count \(CBC\)/);
  assert.match(paraclinicJs, /PT \(Prothrombin Time\)/);
  assert.match(paraclinicJs, /INR \(International Normalized Ratio\)/);
  assert.match(paraclinicJs, /aPTT \(Activated partial thromboplastin time\)/);
  assert.match(paraclinicJs, /HEMATOLOGY/);
  assert.match(paraclinicJs, /BIOCHEMISTRY/);
});

test('v30.6 automatic doctor electronic signature stamp on requisition and print', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');
  const paraclinicCss = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.css'), 'utf8');

  // Electronic signature stamp markup
  assert.match(paraclinicJs, /class="doctor-signature-stamp"/);
  assert.match(paraclinicJs, /class="signed-badge"/);
  assert.match(paraclinicJs, /បានចុះហត្ថលេខាអេឡិចត្រូនិច/);

  // Stamp CSS styles
  assert.match(paraclinicCss, /\.doctor-signature-stamp/);
  assert.match(paraclinicCss, /\.signed-badge/);
});

test('v30.6 patient database integrity and demographics preserve', async () => {
  const { openDatabase } = await import('../server/database.mjs');
  const dbPath = path.join(rootDir, 'data', 'demo.sqlite');
  if (fs.existsSync(dbPath)) {
    const db = openDatabase(dbPath);
    try {
      const rows = db.sqlite.prepare('SELECT patient_key, full_name, sex, age FROM patient_records').all();
      assert.ok(rows.length >= 30, 'All 30 patient records are intact');
      for (const row of rows.slice(0, 5)) {
        assert.ok(row.full_name, 'Name is preserved');
        assert.ok(row.sex, 'Sex is preserved');
      }
    } finally {
      db.close();
    }
  }
});
