# Other laboratory tests in print - v48.7.0

Owner approved the discussed print change with "yes" on 27 October 2026. Base
master 66be22486d5aaf02b8753171d01e20322357a8f7 (48.6.0), branch
fix/lab-other-tests-print. Clean code-only baseline backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.6.0-66be2248-1e2d2929

## Change

The lab print generator previously put additional tests in a narrow "Other test"
area and displayed raw codes. Both unsaved preview and saved-order reprint now
render the additional tests in a full-width section, grouped by catalog category,
with full test names, checked boxes and their urgent markers. Labels omit appended
codes and parentheses, matching the chooser. Test and category names remain in
English under the laboratory-name exception.

Standard tests keep their existing paper positions and are not repeated in the
additional section. ALT selected without AST is included because the fixed paper
form has no standalone ALT checkbox. Duplicate selected codes are deduplicated by
the existing Set. If a historical test is missing from the current catalog, the
saved item metadata is used when available, then its code is retained as a fallback;
tests are never dropped just because a catalog label is unavailable.

Additional rows flow normally across pages, with headings kept next to their rows
and individual rows kept together. No fixed height, clipping or scrolling is added
to print. The standard form, patient details, diagnosis, signatures, ordering,
clinical storage, fee calculation and cashier/nurse/lab routing remain unchanged.
Package, visible login and source release labels are 48.7.

## Verification

Disposable source copy uses tracked reference data and synthetic demo fixtures.
Live .env, hospital databases, uploads, password exports and photos outside the
tracked synthetic fixtures are excluded. Temporary browser profiles remain on D:.

The browser regression uses real OPD registration, triage, payment and lab ordering.
It verifies additional names and categories in unsaved preview, urgent marks,
one row per selected additional test, no duplicate standard test, and standalone
ALT. A long additional list exercises multi-page printing without dropped rows.
It then reloads OPD and reprints the saved order directly from the patient record,
without opening the order form. Preview, reprint and bulk-preview PDFs/screenshots
are retained. Printing leaves clinical record JSON unchanged. Existing paid/free,
missing-fee, nurse-route and duplicate-order browser assertions remain.

Final verification: npm test passed 1,065/1,065; npm run check:khmer passed;
explicit browser workflow passed. Preview and saved reprint each render on one
A4 PDF page; the bulk preview renders on three pages. Screenshots were inspected.
The initial browser reload check incorrectly required clinical edit permission
after pending-fee orders; it now correctly waits for the loaded read/print view.
Archive: D:\EMR\Borkeo_EMR_Validation\v48.7-lab-print-20261027.
Logs: tests.log, khmer.log, browser-final.log. PDFs/screenshots/snapshots:
.validation-lab-evidence/preview.*, reprint.* and bulk-preview.*.

Browser/PDF evidence does not certify a physical hospital printer.

## Installation

Read Borkeo-EMR-v48.7.0-lab-other-tests-print-update.txt. Back up code and apply
only its named files, preserving newer unrelated changes and .vscode. Keep .env,
credentials, patient databases, uploads, archived photos and backups. Run npm test
and npm run check:khmer, restart the verified project launcher and refresh OPD.
