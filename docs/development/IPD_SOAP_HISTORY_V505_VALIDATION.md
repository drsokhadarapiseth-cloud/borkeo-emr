# IPD record, SOAP draft and pregnancy history - v50.5.0

Approved scope: the IPD presentation and SOAP changes discussed with the owner,
pregnancy history, and a manual Medscape reference because no licensed vendor
API was supplied. The drug CDS prompt was treated as reference material; this
release does not activate a Medscape data integration.

## Behavior

IPD no longer displays the six chart navigation buttons, visual SOAP group
headers, early-warning score panel, preliminary diagnosis, active-problem panel
or extra ICD diagnosis-detail box. Existing stored values and their services
remain intact. ICD selections appear on separate full-width rows, retaining
main/secondary selection. Clinical source fields remain in their original order
and storage positions. IPD actions stay on one horizontally scrollable row.
OPD navigation and its consultation workflow remain unchanged.

Eight IPD vital fields initially use the same encounter's triage measurements
when no IPD measurement is stored. Doctors can edit them in the medical form;
nurses and midwives can save them from a separate nursing panel. The endpoint
allows only these measurements, checks ward/role/discharge/correction scope,
requires CSRF and an exact encounter version, and records editor/audit history
within the write transaction. Original triage, prescriptions, diagnoses, notes
and unrelated nursing data are preserved. A normal physician Save also saves
the IPD values through the existing medical scope; nursing saves cannot edit
medical SOAP, pregnancy status or other physician fields.

The new editable SOAP box replaces the visible plan-notes box. A deterministic
local JavaScript formatter assembles documented symptoms, current history,
selected history, pregnancy status, vital signs, entered examination findings,
investigations, selected ICD diagnoses and documented treatment/monitoring.
Empty findings stay empty; unchecked radio/checkbox values are never findings.
Legacy plan notes are retained and included in P. No diagnosis, dose, normal
examination or negative pregnancy result is inferred. No Python service,
external AI request or clinical decision engine is added.

The draft updates until a clinician edits it. Manual text and its manual flag
are saved with the encounter; regeneration then requires explicit confirmation.
The draft is labeled for review before saving/signing, and does not constitute
a signed note. The existing save/signing workflow remains authoritative.

Past-pregnancy history, current-visit pregnancy status, breastfeeding, gestational
weeks, confirmation date, prior ectopic count and history notes have stable
medical storage keys. Unknown defaults are explicit. Past pregnancy does not
set current pregnancy. Existing GPAL fields remain. These documentation fields
do not silently alter existing obstetric display thresholds or drug checks.

Saved SOAP and pregnancy fields also render in dated, styled, script-free
cross-hospital read-only reviews. New controls do not shift legacy auto indexes.
No remote record becomes writable through this presentation update.

The Medscape button opens exactly https://reference.medscape.com/ in a separate
tab using noopener, noreferrer and no-referrer. It sends no patient or medication
query parameters. Users sign in on Medscape itself. No login email/password is
stored by the EMR. Catalogue, codes, stock, prices, max-dose and interaction
tables are unchanged; automatic Medscape dosing/pregnancy advice is unavailable.

## Baseline, backups and preservation

Primary clean baseline: 50.4.0, master,
8272cbb65387da67fdbdb805bfb78fde85d12f44. Code-only backup made before edits:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.4.0-8272cbb6-24c525ee.
Receiver baseline 50.3.0: 20 changed existing files compared to that commit
with only its independent version difference. Code-only archive/manifest:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-ipd505-20261029.
Both code backups restore to a new folder; they exclude hospital data/secrets.

Online SQLite backups:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v505-ipd-1793273135326.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v505-ipd-1793273135888.sqlite

Disposable synthetic validation root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-8Ha2fM.
No real patient fixture, drug-table change, schema migration, private settings
replacement or automatic hospital connection is included. The user's .vscode
folder and .gitignore are preserved.

## Validation and delivery

Final complete automated run: 1,087/1,087 tests and Khmer check pass.
Three relevant browser workflows pass: IPD clinical-summary/prescribing safety,
IPD doctor/nurse vital edits plus normal Save/reopen and actual print snapshot/
PDF, and cross-hospital styled read-only history/private nurse attachments.
Normal Save persists pregnancy history, current unknown status, manual SOAP and
its protection flag; printing does not save clinical data. Browser tests now
wait for the full patient-loaded event and use a registration-only fixture,
without unrelated seeded clinical state. The old consultation checklist test
was retired because its legacy workspace is already disabled in the baseline. Synthetic evidence: .validation-ipd505 and
.validation-emr-network, plus test logs in the disposable root.

Browser/PDF evidence does not establish physical-printer acceptance or a licensed
Medscape CDS integration. The combined UTF-8/LF update TXT includes full decoded
file contents, byte counts and SHA-256 for review by Antigravity.

Installed primary 50.5.0 PID 32020 at http://127.0.0.1:3001 and receiver
50.4.0 PID 31840 at http://localhost:3002 using the original hidden launchers.
Health, visible versions and all four new assets pass on both; unauthenticated
IPD vital writes return 401. All 98 pre-existing non-audit/non-nonce tables
compare equivalent to online backups. Patient rows, attachments, clinical
content, API keys/grants and existing approval decisions are preserved.
Patients remain 22 and 0, integrity OK. One pending primary workflow snapshot
was refreshed by existing startup logic: only missing created_by/updated_by
metadata was added, verified against its unchanged patient row. The preservation
check allows those two additions and known startup metadata/session normalization,
not changed clinical content. No automatic pairing or patient import occurred.

Final mobile review corrected the inherited column direction and moved the
existing referral control into the IPD print/Save/PMRS action row. The same
referral handler and permissions remain; small screens scroll horizontally.
Synthetic mobile checks confirm row direction, no wrapping, the referral control
in that row, disabled view mode and no record writes. Pregnancy and SOAP desktop/
mobile screenshots and the actual IPD print snapshot/PDF were reviewed.
