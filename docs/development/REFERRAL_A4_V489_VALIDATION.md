# One-page referral popup - v48.9.0

Owner approved the agreed referral layout with "yes code it" on 28 October 2026.
Reference: owner-provided 182_doc.pdf (four distribution copies of the same form);
the clean white first copy informed this editable reconstruction. Uses the existing
hospital logo. It is not a claim of official Ministry certification.

Base master: 45bd18dc2b4fb383f27c487186370feaac5c6396 (48.8.0).
Feature branch: feature/a4-referral-popup. Clean code-only baseline backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.8.0-45bd18dc-420a78b9

## Scope and behavior

Doctors/chief doctors can open the referral from their OPD/IPD record. The popup
has editable hospital details, referral number, full patient ID, demographics,
companion/contact/address, admission date/time, complaint, history, examination,
tests, diagnosis, treatment, intervention, vitals and referral reason. Maternal,
under-five and newborn sections, document choices and sending/receiving fields
are retained. Available registration and triage values prefill the referral copy.
Changing that copy does not overwrite the underlying clinical record.

Inputs use a fixed aligned A4 portrait grid. Text boxes do not expand or print
scrollbars. Live overflow checks flag excessive text and block printing until
shortened; entered text can still be saved as a draft. No truncation is used to
force content onto one page. Printing converts controls to static text/checkboxes,
waits for bundled fonts/signature images and checks page bounds. Print action:
the owner's exact Khmer label, supplied in the reference-update request.

Signature choices are the current doctor's configured E-sign or pointer drawing
(mouse/touch/stylus). No synthetic fallback is accepted for saved-signature mode.
Signature identity and time are stamped by the server; client-supplied signer
names/IDs are ignored. A draft may be unsigned; printing requires a signed saved
revision. Editing an older signed copy requires an explicit new signature choice.
The user's configured E-sign is not replaced by drawing on a referral.

Each save appends a new immutable revision in referral_form_revisions, with an
optimistic revision check and audit event. Reprints log the signed revision without
editing it. A recipient name/signature text field is part of the letter only;
it does not record acceptance by another hospital or transmit anything.

API checks enforce role, ward, consultation payment, closed/dispensed encounter
locks, CSRF, field allowlists, value types/lengths and signature PNG limits.
Only DOCTOR/CHIEF_WARD can edit/sign; management can review. Midwife access remains
within existing maternal permissions. ANC doctors use the popup from the signed
referral print action only after the existing Obstetric/Gynecology signing flow;
the original midwife print behavior remains available. ANC reason/treatment and
available visit values prefill from the signed referral. No ANC signing permission
is broadened.

Referral opener and reprint buttons are view actions, so a closed record can
reprint a saved letter. The popup is then readonly: no save/sign action or clinical
edit is enabled. Referral controls are transient and separate from the main EMR
required-field and storage indexing mechanisms.

## Verification

All validation uses a disposable source copy on D:, synthetic fixtures and
in-memory patients. Live .env, hospital databases, patient uploads, password
exports, archives and staff credentials are excluded. The tracked ICD catalogue,
gazetteer and synthetic reference photos are retained where required by tests.

The new API regression covers unpaid OPD denial, invalid fields/oversized values,
invalid signature type, authenticated signature ownership, missing stored E-sign,
stale revisions, closed/dispensed locks and own/wrong-ward inpatient access.

The browser fills every text-entry field, types clinical text, deliberately
overflows then corrects a field, imports E-sign and saves/prints a one-page A4 PDF.
It verifies nurse/registration/wrong-ward API denials and CSRF rejection. It draws
with native pointer input, appends a second signed revision, reopens the saved
letter, captures a narrow viewport and reprints from a closed record without
creating a new revision or reopening clinical editing. Source record JSON remains
unchanged by referral entry/signing/printing. The maternal browser retains its
red-ANC doctor-signing, green/yellow follow-up, vaccination, cervical and safe-
abortion checks and verifies the new doctor referral popup.

Final results: npm test passed 1,066/1,066; npm run check:khmer passed; referral
browser/PDF and maternal browser workflows passed. The populated PDF has exactly
one A4 page. Initial font measurement/image-load timing and closed-record view
button classification defects were fixed before final verification. Browser/PDF evidence verifies
layout, not acceptance by a physical hospital printer.

Evidence archive: D:\EMR\Borkeo_EMR_Validation\v48.9-referral-form-20261028
(tests-acceptance.log, khmer-release.log, browser-final-a4.log,
maternal-release.log and .validation-referral-evidence/referral.pdf/screenshots).

## Publication, activation and rollback

The owner's newer pasted project instructions require separate approval before
deployment/production changes. Publish this feature branch only. Do not merge
master, restart the existing Borkeo service, initialize tables in its database or
start the Provincial simulation during this coding step. Keep the live checkout
on the original master after publication and retain the combined update TXT for
review. The two-hospital project and password-copy decision remain pending.

After explicit activation approval: check current master/user changes; back up
code and the target database/uploads; merge reviewed code; run required checks;
restart only the verified project launcher. Startup adds the new referral table;
it never replaces patient records. Preserve .env, uploads, photos, accounts and
settings. Roll back code in a separate folder using the code-only restore tool;
retain the additive referral table and its revisions rather than deleting data.

Delivery: Borkeo-EMR-v48.9.0-a4-referral-popup-update.txt contains an explicit file
manifest and complete normalized UTF-8 payloads. Keep .gitignore and .vscode intact.
