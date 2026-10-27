# Paraclinic identity and order entry - v48.8.0

Owner approved with "yes code it" on 27 October 2026. Base master
2892fdc6ae1c42695c33a127facc536f566e1596 (48.7.0), branch
fix/paraclinic-identity-editing. Clean code-only baseline backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.7.0-2892fdc6-543a1154

## Approved behavior and cause

The lab header stripped hyphens from the registered ID and truncated it to ten
characters. Both form and print now show the full registered Health ID, with the
existing identity/saved-snapshot fallback order unchanged. Identity is display-only.
The patient-ID label is Khmer and header rows wrap without truncating the ID.

The former manual Lab Code textbox is now a protected output explaining that the
code is generated when saved. The server already creates a LAB accession number
for each saved request; it remains authoritative. Saved reprints always use that
accession number. Unsaved previews show the automatic-generation message and do
not reserve a number or create an order. No new code-generation service, database
migration or change to the existing accession format is introduced.

The encounter editor's global beforeinput/click/submit guards also blocked
separate order dialogs whenever consultation editing was locked, including
prepayment. Only lab/imaging order-entry modals created for the existing canOrder
roles are marked as separate paraclinic order scope and transient controls.
The global event guard allows input inside those marked dialogs for DOCTOR,
ADMIN and VICE_DIRECTOR, except historical report pages. It does not unlock the
consultation, exempt result dialogs, or grant new server permissions. Existing
patient/ward/payment/order authorization remains enforced by the APIs.

## Verification

Disposable source copy uses tracked reference catalogs and synthetic demo data.
It excludes live .env, patient databases, uploads and password exports. All browser
profiles and generated evidence are on D:.

The OPD browser workflow checks the complete ID including hyphens in the lab form,
preview and saved reprint. It checks that Lab Code is an output, a server-generated
LAB accession appears after saving, and the same accession is used on reprint.
It retains grouped multi-selection, urgency, duplicate checks, paid/free/nurse
routing, additional-test print, ALT and multi-page PDF assertions.

With pending fees making the consultation read-only, the browser confirms ordinary
clinical beforeinput remains blocked. It then uses native text input to type into
lab diagnosis and the indication/history/question fields of all 13 imaging
modalities. Every imaging order-entry input/select/textarea is enabled. A real
imaging submission succeeds from this state and the consultation remains locked.
Opening/typing in the dialogs alone does not save the clinical record.

Results: npm test passed 1,065/1,065; npm run check:khmer passed; explicit OPD
browser/PDF workflow passed. Generated reprint screenshot was visually inspected.
Browser/PDF checks do not certify a physical hospital printer.

Evidence archive: D:\EMR\Borkeo_EMR_Validation\v48.8-paraclinic-id-edit-20261027
(tests.log, khmer.log, browser.log and .validation-lab-evidence/ preview/reprint/
bulk-preview PDFs, screenshots and snapshots).

## Installation

Apply only files named by Borkeo-EMR-v48.8.0-paraclinic-id-edit-update.txt, preserving
newer unrelated code and .vscode. Keep .env, credentials, hospital databases,
photos, uploads and backups. Run npm test and npm run check:khmer, restart only the
verified project launcher and refresh OPD. Package and visible version are 48.8.
