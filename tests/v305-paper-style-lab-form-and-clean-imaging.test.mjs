import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');


test('v30.5 medical imaging order uses accessible test names without duplicate controls', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');

  // The approved name-only chooser replaces the old badge and add-button layout.
  assert.match(paraclinicJs, /class="imaging-test-name" data-order=/);
  assert.doesNotMatch(paraclinicJs, /class="imaging-card-(badge|btn|icon)"/);
  assert.doesNotMatch(paraclinicJs, /const MODALITY_ICONS/);
  const css = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.css'), 'utf8');
  assert.match(css, /imaging-test-name:focus-visible/);
});

test('v30.5 authentic paper-style laboratory request form layout and Moul header', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');

  // Must omit ក្រសួងសុខាភិបាល and have hospital title in Moul font
  assert.match(paraclinicJs, /class="hospital-name-moul">មន្ទីរពេទ្យបង្អែក បរកែវ<\/div>/);
  assert.doesNotMatch(paraclinicJs, /ក្រសួងសុខាភិបាល/);

  // Exact Khmer and English requisition titles matching paper form
  assert.match(paraclinicJs, /ប័ណ្ណស្នើសុំវិភាគតេស្តមន្ទីរពិសោធន៍/);
  assert.match(paraclinicJs, /Laboratory Request Form/);

  // Logo and code boxes
  assert.match(paraclinicJs, /\/public\/logo-hospital\.jpg/);
  assert.match(paraclinicJs, /លេខកូដមន្ទីរពិសោធន៍/);
  assert.match(paraclinicJs, /PMRS CODE/);

  // Patient demographics fields
  assert.match(paraclinicJs, /ឈ្មោះអ្នកជំងឺ/);
  assert.match(paraclinicJs, /អាយុ/);
  assert.match(paraclinicJs, /ថ្ងៃខែឆ្នាំកំណើត/);
  assert.match(paraclinicJs, /ភេទ/);
  assert.match(paraclinicJs, /ស្រី/);
  assert.match(paraclinicJs, /ប្រុស/);
  assert.match(paraclinicJs, /អាសយដ្ឋានអ្នកជំងឺ/);
  assert.match(paraclinicJs, /ភូមិ/);
  assert.match(paraclinicJs, /ឃុំ/);
  assert.match(paraclinicJs, /ស្រុក/);
  assert.match(paraclinicJs, /ខេត្ត/);
  assert.match(paraclinicJs, /ផ្នែក/);
  assert.match(paraclinicJs, /រោគវិនិច្ឆ័យ/);
  assert.match(paraclinicJs, /កាលបរិច្ឆេទស្រង់វត្ថុវិភាគ/);
  assert.match(paraclinicJs, /បន្ទាន់/);

  // Authentic 3-column test checklist
  // Col 1: HEMATOLOGY
  assert.match(paraclinicJs, /HEMATOLOGY/);
  assert.match(paraclinicJs, /Complete Blood Count \(CBC\)/);
  assert.match(paraclinicJs, /Reticulocyte/);
  assert.match(paraclinicJs, /Malaria \( D1, D2, C1, C1 \)/);
  assert.match(paraclinicJs, /ESR\/VS/);
  assert.match(paraclinicJs, /Blood cell morphology/);

  // Col 2: HEMATO-IMMUNOLOGY & HEMOSTASIS & SERO-IMMUNOLOGY & URINE/STOOL
  assert.match(paraclinicJs, /HEMATO- IMMUNOLOGY/);
  assert.match(paraclinicJs, /ABO and Rh blood group/);
  assert.match(paraclinicJs, /HEMOSTASIS/);
  assert.match(paraclinicJs, /Bleeding Time/);
  assert.match(paraclinicJs, /Clotting Time/);
  assert.match(paraclinicJs, /PT \(Prothrombin Time\)/);
  assert.match(paraclinicJs, /INR \(International Normalized Ratio\)/);
  assert.match(paraclinicJs, /aPTT \(Activated partial thromboplastin time\)/);
  assert.match(paraclinicJs, /SERO- IMMUNOLOGY/);
  assert.match(paraclinicJs, /HBs antigen/);
  assert.match(paraclinicJs, /HBs antibody/);
  assert.match(paraclinicJs, /HCV antibody/);
  assert.match(paraclinicJs, /HIV antibody/);
  assert.match(paraclinicJs, /Syphilis RPR antibody/);
  assert.match(paraclinicJs, /Syphilis TPHA antibody/);
  assert.match(paraclinicJs, /ASO \(antistreptolysin-o\)/);
  assert.match(paraclinicJs, /CRP \(C-Reactive Protein\)/);
  assert.match(paraclinicJs, /H\.Pylori antibody/);
  assert.match(paraclinicJs, /Dengue NS1Ag\/IgM\/IgG/);
  assert.match(paraclinicJs, /URINE & STOOL ANALYSIS/);
  assert.match(paraclinicJs, /Chemistry/);
  assert.match(paraclinicJs, /Pregnancy test/);
  assert.match(paraclinicJs, /Stool Microscopy/);

  // Col 3: BIOCHEMISTRY
  assert.match(paraclinicJs, /BIOCHEMISTRY/);
  assert.match(paraclinicJs, /Glucose \(fasting\/Random\)/);
  assert.match(paraclinicJs, /Calcium/);
  assert.match(paraclinicJs, /Uric acid/);
  assert.match(paraclinicJs, /Renal Function/);
  assert.match(paraclinicJs, /Urea/);
  assert.match(paraclinicJs, /Creatinine/);
  assert.match(paraclinicJs, /Electrolytes/);
  assert.match(paraclinicJs, /Liver Function/);
  assert.match(paraclinicJs, /Bilirubin Direct & Total/);
  assert.match(paraclinicJs, /Transaminase/);
  assert.match(paraclinicJs, /Gamma GT/);
  assert.match(paraclinicJs, /PAL \(Phosphatase alkaline\)/);
  assert.match(paraclinicJs, /Total protein/);
  assert.match(paraclinicJs, /Albumin/);
  assert.match(paraclinicJs, /Lipid Profile/);
  assert.match(paraclinicJs, /Cholesterol/);
  assert.match(paraclinicJs, /HDL Cholesterol/);
  assert.match(paraclinicJs, /LDL Cholesterol/);
  assert.match(paraclinicJs, /Triglycerides/);
  assert.match(paraclinicJs, /Pancreatic enzyme/);
  assert.match(paraclinicJs, /Amylase/);
  assert.match(paraclinicJs, /Lipase/);
  assert.match(paraclinicJs, /Other test/);
});

test('v30.5 permanent reprint capability for lab and imaging orders', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');

  // Preview / print button right inside the ordering requisition modal
  assert.match(paraclinicJs, /data-preview-print/);
  assert.match(paraclinicJs, /🖨️ បោះពុម្ពប័ណ្ណស្នើសុំ/);

  // Print button on every recent order card (available before or after completion)
  assert.match(paraclinicJs, /data-print-order/);
  assert.match(paraclinicJs, /class="btn-print-order-inline"/);

  // Permanent print button inside the result/order viewer modal
  assert.match(paraclinicJs, /data-modal-print-requisition/);

  // Print functions generate clean HTML documents with Moul font and trigger print
  assert.match(paraclinicJs, /function generateLabRequestPrintHtml/);
  assert.match(paraclinicJs, /function generateImagingRequestPrintHtml/);
  assert.match(paraclinicJs, /function printOrderRequisition/);
  assert.match(paraclinicJs, /function printHtmlContent/);
});

test('v30.5 demo sqlite patient database integrity and demographics preserve', async () => {
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
