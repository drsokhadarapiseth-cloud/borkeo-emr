# OPD imaging and admission print - v48.5.0

Approved on 27 October 2026. Base master: 1f32bdb8703fd7d7726a7c5851abf929b4f4a701
(48.3.0). The admission-print repair accounts for 48.4; the separately approved
imaging chooser accounts for 48.5. Both are delivered together in 48.5.0.

## Behavior

The OPD imaging request chooser lists each active service once under its existing
specialty: radiology, cardiology, neurology, gastroenterology, ENT, pulmonology.
A test name is a native button that opens its existing order form directly.
There are no extra plus buttons, repeated name/code badges, category selectors,
or English explanatory counts. Default chooser labels are Khmer. The existing
Laboratory entry remains. The shared IPD chooser uses the same renderer.

The catalog, active-service filtering, clinical order fields, appointment time,
duplicate-order checks, permissions and cashier/department submission are retained.
No patient records, photos, charges or staff settings are migrated or replaced.

The admission button previously produced blank paper even though its selected
form contained text and had nonzero dimensions. Its cloned inactive Registration
page retained content-visibility:hidden. The selected print snapshot and copied
ancestor wrappers now explicitly set content-visibility:visible. This affects the
isolated print document, preserving live page visibility and the admission layout.

## Reproduction and checks

The baseline browser reproduced a blank admission screenshot/PDF from paid OPD.
The final synthetic browser workflow registers a patient, completes triage and
cashier payment, opens doctor OPD, checks all 13 active imaging services appear
exactly once, and opens each existing examination form by its name. It also opens
the retained laboratory form, captures desktop/narrow-viewport chooser screenshots,
then clicks the real admission-print button and generates a populated PDF. Patient
record JSON remains identical before/after opening forms and printing.

The final PDF has one page with populated patient information. This is browser/PDF
verification; a physical hospital printer has not been tested. The EMR's existing
fixed mobile viewport is unchanged; narrow CSS viewport behavior is verified.

Obsolete tests requiring the removed badge/sidebar layout were updated to reflect
the approved chooser. Laboratory and clinical assertions remain. Exact authorized
Khmer removals are recorded in docs/khmer-approved-changes.md.

Disposable validation excludes live .env, hospital databases, uploads and password
exports. It retains the tracked reference ICD catalogue and creates its own
30-patient synthetic demo database for legacy suite checks. C: had insufficient
space, so the disposable source and browser temp profiles were placed on D:.
An initial source-copy omission and a concurrent temp-directory scan race were
corrected in validation setup, with final checks rerun before publication.

Final results: npm test passed 1,065/1,065; npm run check:khmer passed;
explicit OPD imaging/admission browser regression passed. Admission PDF: one
page, 382,956 bytes in the first verified capture; final capture retained.

## Backup and installation

Clean baseline code-only backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v48.3.0-1f32bdb8-3c4aa64d

Read Borkeo-EMR-v48.5.0-opd-imaging-print-update.txt. Apply only its named source,
test and documentation files, preserving newer unrelated changes. Never replace
.env, hospital databases, uploads, archived photos or backups. Run npm test and
npm run check:khmer before restarting the verified project launcher. Refresh OPD.

Validation evidence: D:\EMR\Borkeo_EMR_Validation\v48.5-opd-imaging-print-20261027
(tests-final-pass.log, khmer-release.log, browser-release.log,
validation-imaging/chooser-1440.png and chooser-390.png,
validation-admission-print/admission.pdf and admission.png).
