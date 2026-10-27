# OPD laboratory order form - v48.6.0

Owner approved all discussed changes with "please code all above" on 27 October
2026. Base master 364af002b2bf72fa09cafcc1999aa9d3fc29f0db (48.5.0), branch
fix/opd-lab-grouped-selection. Clean code-only baseline backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.5.0-364af002-4ea4b227

## Approved behavior

- Removed the "Send the order" explanatory fieldset. Paid/free fee choices remain.
- Fee heading, paid/free choices and cashier/nurse buttons use Khmer by default.
  Existing internal chargeMode and data-route values remain unchanged.
- Replaced the extra-test dropdown with a searchable, full-width panel grouped
  by the existing catalog's major laboratory categories. Lab names and categories
  remain English; test labels omit parentheses and appended duplicate codes.
- Staff can check several tests and add them together. The pending count updates;
  adding closes the panel and retains visible, removable extra rows. Choosing a
  regular main-form test checks its existing row. Re-adding does not duplicate it.
- Already ordered tests remain disabled. Catalog active filtering, server fee
  checks, request codes, item deduplication, urgency, print preview and routes remain.
- Individual additional AST selection does not silently select the main form's
  combined AST/ALT row. The existing combined main-form action remains unchanged.
- Corrected checkbox sizing under the shared input styles. Narrow screen lab
  headers, columns, footer and buttons wrap; print templates are unchanged.

Shared OPD imaging fee/action helpers also receive these Khmer labels and lose the
same explanatory note. The lab selector is shared with the IPD lab order form.
No database migration, patient replacement, staff change or dependency is added.

## Validation

Disposable copy .validation-lab-v486 contains source, tracked reference data,
synthetic demo fixtures and temporary browser profiles on D:. It excludes live
.env, hospital databases, uploads and password exports. No live patient data is
used for tests. Khmer approval entries and translation CSV rows record the approved
new labels; exact removed legacy Khmer strings are documented separately.

The real-browser workflow registers and triages a synthetic patient, pays the OPD
fee and opens doctor OPD. It verifies all active tests appear in their catalog
groups, no parentheses remain in picker labels, search works, multiple selection,
the pending count, main-row reuse, remove/re-add, and duplicate prevention. It
captures desktop and 390px narrow CSS viewport screenshots without overflow.

It submits a multi-test request and confirms the existing missing-price guard
rejects a paid test without a configured fee. Marking it free submits exactly the
selected tests. Separate paid and nurse requests retain their cashier/handoff
flags. An individual AST request includes only AST. Already ordered tests stay
disabled and picking tests alone leaves clinical record JSON unchanged.

Final results: npm test passed 1,065/1,065; npm run check:khmer passed;
explicit Chromium lab workflow passed. Final logs: tests-final.log,
khmer-final.log and browser-verified.log. Screenshots and request/response
evidence: .validation-lab-evidence/lab-1440.png, lab-390.png and workflow.json.
Archive: D:\EMR\Borkeo_EMR_Validation\v48.6-opd-lab-20261027.
Initial browser sizing defects and a synthetic missing-fee assumption were
corrected before final verification. Translation CSV provenance was completed
and the full suite rerun successfully.

## Installation and preservation

Apply only the named files in Borkeo-EMR-v48.6.0-opd-lab-order-update.txt, preserving
newer unrelated changes. Keep .env, credentials, hospital databases, photos,
uploads and backups. Run npm test and npm run check:khmer, then restart only the
verified project launcher and refresh OPD. The unrelated .vscode folder is kept
outside the update. Browser rendering does not certify a physical printer.
