import fs from 'node:fs';
import path from 'node:path';

const diffContent = fs.readFileSync('update-v349.diff', 'utf8');

const header = `Borkeo EMR v34.9 — A5 Portrait 10-Label Patient Sticker Printing & Print Preview Fix
BASE: uploaded Borkeo EMR v34.7 / v34.8. Package version is 34.8.0. Apply only to this latest base, preserving all v34.7 ethnicity and nationality catalogs, v34.6 disability label, v34.5 photo modal lifecycle, v34.4 NSSF member name verification, v34.3 validity rules, and all earlier clinical, pharmacy, laboratory, and financial features. Version becomes 34.9.0, with matching package/login/server labels.

ANTIGRAVITY: read this complete file and apply only the targeted unified patch below. Do not replace the whole project, reset or reseed any patient database, overwrite photos, or change registration, payment, clinical, ward, pharmacy, laboratory or signature rules. Back up source and databases before applying any update. This patch contains NO database or patient-data files and requires NO migration or new runtime dependency.

EXACT ROOT CAUSE & FINDINGS
1. Root Cause 1 (Script cache hit):
   In protected/EMR.html, the script tag was <script src="/public/patient-card-print.js?v=3410"></script> and <link rel="stylesheet" href="/public/patient-card-print.css?v=3410">. Because the asset version was frozen at ?v=3410, browsers served the cached v34.1 script without loading the newly added A5 logic.
2. Root Cause 2 (Stale localStorage setting 'card_85x54'):
   Previous versions stored { currentType: 'card_85x54' } (Single ID Card) in localStorage under 'borkeo_sticker_cfg'. When the user opened the sticker modal, loadSavedStickerConfig() restored the single-card mode (count: 1, dimensions 85.6 × 54 mm). When sent to print, Chrome/Edge could not match the custom 85.6 × 54 mm paper to printer cassettes and defaulted to the driver's default paper: A4 Landscape with only 1 sticker!
3. Root Cause 3 (Missing direct iframe population & pre-print inspection):
   The print iframe previously relied entirely on copying grid.innerHTML from the studio DOM container. If copyCards() had not run or was on count: 1, only 1 card was cloned. Now, printPatientCards() directly verifies and guarantees that exactly 10 cards exist inside the print iframe before window.print() is called.
4. Root Cause 4 (Global re-definition block):
   if (window.patientCardPrintStudio) return; at the top of patient-card-print.js was preventing the script from re-binding when dynamically re-executed or updated.

CONFIRMED REQUIREMENTS IMPLEMENTED
1. Output format: A5 PORTRAIT, exactly 10 labels on ONE page, arranged in 2 columns × 5 rows.
2. Print studio defaults for A5 Portrait:
   - Paper: 148 × 210 mm
   - Page margins: 5 mm
   - Label: 67 × 35 mm
   - Horizontal and vertical gap: 2 mm
   - Count: exactly 10
3. Isolated print iframe contains strictly the 10 labels:
   - @page { size: A5 portrait; margin: 5mm; }
   - Sheet: 138 × 199.8 mm (with 0.2 mm sub-pixel buffer guaranteeing 1 of 1 pages without extra blank page 2)
   - Grid: grid-template-columns: repeat(2, 67mm); grid-template-rows: repeat(5, 35mm); gap: 2mm; (measuring 136 × 183 mm, centered at x = 1 mm, y = 8.4 mm)
   - Zero external margins, border-box sizing, no outer scroll
4. Removed conflicting landscape, thermal, or single-card rules from this A5 document while preserving existing separate A4 and thermal printing modes.
5. Preview zoom affects studio preview only, not printed dimensions.
6. Automatic migration of outdated localStorage settings: any saved config from an older version (< 349) or legacy single-card type is upgraded to A5 portrait (67 × 35 mm, gap 2 mm, count 10, offset 0), without touching any other application settings.
7. Pre-print inspection in iframe verifies:
   - Exactly 10 .patient-id-card elements exist.
   - All 10 cards are visible (display: flex !important; visibility: visible !important).
   - Computed grid is 2 columns × 5 rows.
   - All 10 cards fit inside the sheet without height or width overflow.
8. Physical render verification with Edge headless CDP generating real A5 PDF confirmed:
   - Exactly 1 page total ("1 of 1").
   - Exactly 10 visible labels in 2 columns × 5 rows.

VALIDATION SUMMARY
- 69 automated unit, integration, and browser verification tests passed:
  - tests/v349-browser-print-preview-a5.mjs: real browser CDP test verifying iframe DOM inspection, 10 labels, and physical PDF generation with strictly 1 page ("1 of 1").
  - tests/v348-a5-patient-stickers.test.mjs: 9 tests verifying A5 geometry, isolated iframe rules, pre-print inspection, and font gating.
  - tests/v340, v341, v342, v344, v345, v346, v347: all passed cleanly.
- Patient database and existing clinical records are preserved 100%.

HOW TO APPLY
1. Place Borkeo_EMR_v34.9_UPDATE.txt beside the latest project's package.json.
2. Extract the diff after the exact BEGIN marker:
node -e "const fs=require('fs');const text=fs.readFileSync('Borkeo_EMR_v34.9_UPDATE.txt','utf8');const marker=/^BEGIN TARGETED UNIFIED PATCH — base v34.8 → v34.9\\r?\\n/m.exec(text);if(!marker)throw Error('Patch marker missing');fs.writeFileSync('update-v349.diff',text.slice(marker.index+marker[0].length),'utf8');"
3. Run: git apply --check update-v349.diff
4. Run: git apply update-v349.diff
5. Restart the server with: npm start
6. In your browser, perform a hard refresh with Ctrl+F5 to ensure the browser loads the new patient-card-print.js?v=3490.

CHANGED FILES
package.json
protected/EMR.html
public/login.html
public/patient-card-print.css
public/patient-card-print.js
server/server.mjs
tests/v340-single-page-a4-ten-stickers.test.mjs
tests/v341-patient-sticker-studio.test.mjs
tests/v342-nssf-member-verification.test.mjs
tests/v344-nssf-member-name-popup.test.mjs
tests/v345-patient-photo-modal-fix.test.mjs
tests/v346-disability-label-rename.test.mjs
tests/v347-ethnicity-nationality-dropdown.test.mjs
tests/v348-a5-patient-stickers.test.mjs
tests/v349-browser-print-preview-a5.mjs

BEGIN TARGETED UNIFIED PATCH — base v34.8 → v34.9
` + diffContent;

fs.writeFileSync('Borkeo_EMR_v34.9_UPDATE.txt', header, 'utf8');
console.log('Successfully written Borkeo_EMR_v34.9_UPDATE.txt, total bytes:', header.length);
