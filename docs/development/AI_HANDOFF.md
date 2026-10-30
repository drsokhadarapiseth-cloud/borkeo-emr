# Task context for Codex, Gemini or OpenCode

## Reopen running EMRs - v49.2.0

Owner approved fixing both batch files and keeping distinct ports. Both services
were healthy; the previous launcher treated any occupied port as an error. The
new launcher verifies the existing EMR and opens its link successfully without
restarting it; otherwise it starts a new server then opens the browser. An
unrelated listener is neither opened nor terminated. Original is pinned to
127.0.0.1:3001, second copy to localhost:3002, even with inherited port settings.

Branch fix/reopen-wifi-instances; base c212c6083bec2c977f86fe22ac5abc284b282690.
Backup D:\EMR\Borkeo_EMR_Code_Backups\v49.1.0-c212c608-a90d4db7.
Separate-copy changed-code backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-reopen-1793162573999.
Second copy retains the same folder and instance-data, version 49.1.0; original
source is 49.2.0. No database, private settings or credential change. No server
restart is needed for the launcher repair. Separate explicit master publication
approval remains required by the pasted instructions. See
WIFI_REOPEN_V492_VALIDATION.md and the combined v49.2.0 update TXT.

## Independent Wi-Fi launchers - v49.1.0

Owner approved separate addresses and storage for the two local copies. Original
Borkeo_EMR_Git: http://127.0.0.1:3001, v49.1.0, existing hospital database. Second
copy D:\EMR\Borkeo_EMR_v48.9.0_Referral: http://localhost:3002, v49.0.0, isolated
instance-data database/uploads/backups. No hospital data or credentials copied.
The second folder is still a local source copy, not a completed Provincial EMR.

Branch fix/independent-wifi-launchers, base 6181c53050a46405cf381e3d632bf51a4b00d7ff.
Local setup is tested and running. The owner subsequently explicitly approved
merging and pushing the verified v49.1.0 update to master. Publish the verified
feature by fast-forward; no service restart or runtime-data change is needed.
Code backup D:\EMR\Borkeo_EMR_Code_Backups\v49.0.0-6181c530-645d5490.
Clone backup D:\EMR\Borkeo_EMR_Code_Backups\clone-before-wifi-1793160533933.
Removed taskkill from the batch file. The Node launcher refuses occupied ports
before opening a database. Per-copy nonsecret wifi-instance.local.json selects
the isolated simulation; a template lives under docs/development.

All 1,069 tests and Khmer passed, plus synthetic browser session-isolation checks.
Both actual batch files were tested running simultaneously and on duplicate start;
duplicates stopped neither service. Original patients: 22; second copy: 0.
See WIFI_SEPARATE_V491_VALIDATION.md and the combined v49.1.0 update TXT.
Use different hostnames (127.0.0.1 versus localhost), not just different ports, to
keep browser logins separate. Cross-hospital referral transmission remains pending.

## Referral activation for OPD and all inpatient wards - v49.0.0

Owner approved coding the referral form for the original Borkeo_EMR_Git, for
authorized OPD and IPD doctors in every ward, then explicitly approved merging,
pushing master and restarting Borkeo. Activation completed on 28 October 2026:
master includes 0067c09e10574dd464528db96f424c7437435356 and serves v49.0.0.
The implementation branch is
feature/referral-all-wards-activation, including v48.9.0 feature commit 1ba52514.
Pre-activation master: 45bd18dc2b4fb383f27c487186370feaac5c6396.
Code-only backup: D:\EMR\Borkeo_EMR_Code_Backups\v48.8.0-45bd18dc-735d1e6c.

The form is on OPD and inpatient medical pages for DOCTOR/CHIEF_WARD, subject to
existing access checks; ANC keeps its signed doctor workflow. Regression now
checks both roles in every configured inpatient ward, denies other roles signing,
and exercises the surgery doctor's actual inpatient popup in the browser.
See REFERRAL_ALL_WARDS_V490_VALIDATION.md and the combined v49.0.0 update TXT.

Database backup before activation:
C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v49-referral-2026-10-28T03-56-55-465Z.sqlite.
Health, served referral module and login version checks passed. All 22 patient
records remain byte-for-byte equivalent as SQL rows. All 30 users, actual
passwords, ward/role assignments and settings are preserved. Existing startup
refreshes role timestamps and re-salts the same Superuser password; those expected
metadata differences were verified against the backup. Database integrity is OK.

Cross-hospital electronic transmission remains pending: the Provincial receiving
EMR and secure connection have not been created. Do not claim a printed referral
was sent electronically. Owner approved all authenticated Provincial staff to
accept incoming referrals; reject permission is not yet specified. Original
patient records, accounts, photos and private settings must be preserved.

## One-page referral popup - v48.9.0 feature, 28 October 2026

Owner approved this referral form with "yes code it" before continuing the separate
Provincial simulation project. Reference: first white copy of owner 182_doc.pdf.
Base master 45bd18dc2b4fb383f27c487186370feaac5c6396, feature branch
feature/a4-referral-popup. Baseline code-only backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.8.0-45bd18dc-420a78b9

Fixed A4 editable popup includes general, maternal, child/newborn and sending/
receiving fields. Prefill is a copy; main patient data is not changed. Overflow
blocks printing instead of clipping or making a second page. Signature is the
current doctor's configured E-sign or pointer-drawn PNG, stamped by the server.
Signed immutable revisions are stored in referral_form_revisions with concurrency
checks and audit. Drafts may be unsigned; reprints use a signed saved revision.
Doctor/chief, ward, payment and closed-record guards remain. Closed records can
reprint but cannot edit/sign. ANC doctor action follows the existing signed-referral
workflow; midwife legacy printing is unchanged. No cross-hospital send occurs.

IMPORTANT: newer pasted instructions prohibit deployment/production changes
without separate approval. Publish feature branch only; do not merge master or
restart the existing Borkeo service in this coding step. Restore checkout master
after publication and keep the combined TXT for review. Activation and the two-
EMR local setup remain pending; password-copy choice remains unconfirmed.

See REFERRAL_A4_V489_VALIDATION.md for final synthetic checks, PDF evidence and
activation/rollback instructions. No live database, uploads or credentials used.


## Lab identity/code and editable order dialogs - v48.8.0, 27 October 2026

Owner approved with "yes code it". Base master
2892fdc6ae1c42695c33a127facc536f566e1596 (48.7.0), branch
fix/paraclinic-identity-editing. Clean code-only backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.7.0-2892fdc6-543a1154

Lab form and print show the full registered Health ID, including hyphens, instead
of stripping/truncating to ten characters. The manual Lab Code input is replaced
with a protected output describing automatic generation on save. Existing server
accession numbering remains; saved reprints use the order accession consistently.

Separate lab/imaging order-entry modals have an explicit paraclinic/transient
marker when created for existing canOrder roles. The encounter editor exempts
only those marked order dialogs from its global input/click/submit guard for
DOCTOR/ADMIN/VICE_DIRECTOR outside historical reports. The consultation stays
locked; result dialogs and all API authorization/ward/payment checks are intact.
No data migration, patient replacement, .env or staff-setting change.

Validation: 1,065 tests, Khmer and real OPD browser/PDF checks passed. The browser
natively typed into lab diagnosis and all 13 imaging forms while consultation
editing was locked, submitted an imaging order, and verified the lock remained.
Exact form/print ID and generated/stable saved accession are asserted. See
PARACLINIC_ID_EDIT_V488_VALIDATION.md and the combined update TXT.


## Other laboratory tests in print - v48.7.0, 27 October 2026

Owner approved the discussed preview/reprint change with "yes". Base master
66be22486d5aaf02b8753171d01e20322357a8f7 (48.6.0), branch
fix/lab-other-tests-print. Clean code-only backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.6.0-66be2248-1e2d2929

The lab print generator now puts additional test names in a full-width section
grouped by major catalog category instead of raw codes in the narrow Other area.
Preview and saved reprints share this generator. Urgent markers and checked states
remain. Standard tests stay in their original positions without duplicate extra
rows. Standalone ALT is printed when AST is not selected. Missing catalog items
fall back to saved metadata or code instead of disappearing. Rows flow naturally
across paper pages. No order, fee, route, clinical-storage or patient-data change.

The browser regression covers preview and saved reprint after a fresh OPD load,
standalone ALT, long-list pagination, deduplication, urgency and unchanged clinical
record JSON, alongside the retained lab selection/routing checks. See
LAB_OTHER_PRINT_V487_VALIDATION.md and the combined TXT for final results/evidence.


## OPD lab grouped selection and Khmer actions - v48.6.0, 27 October 2026

Owner approved all discussed changes with "please code all above". Base master
364af002b2bf72fa09cafcc1999aa9d3fc29f0db (48.5.0), branch
fix/opd-lab-grouped-selection. Clean committed code-only backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.5.0-364af002-4ea4b227

Removed the routing explanation box and localized the fee heading, paid/free
options and cashier/nurse buttons. Internal chargeMode/data-route actions and
server fee/handoff rules remain. The extra-test dropdown is now a full-width
searchable panel, grouped by catalog category, with checkboxes and batch Add.
Names omit parentheses/code suffixes; selected extra rows can be removed or
re-added. Existing simple main-form rows are reused. Individual AST selection
avoids activating the combined main-form AST/ALT action. Already ordered tests
remain disabled. Existing test-code deduplication and print generation remain.

New control sizes and narrow-screen wrapping are scoped to the lab form. The
shared IPD lab selector and OPD imaging fee/action helpers also receive their
shared changes. Patient records, photos, staff, settings and .env are preserved.
The unrelated untracked .vscode folder is not included.

See OPD_LAB_V486_VALIDATION.md and the combined update TXT for final verification.


## OPD imaging chooser and admission printing - v48.5.0, 27 October 2026

User approved the grouped clickable-name imaging chooser and clarified that it
belongs in the OPD form. The previously requested admission-print repair remains
included. Two minor steps from 48.3: admission repair 48.4, imaging update 48.5;
delivered together as 48.5.0. Base master 1f32bdb8703fd7d7726a7c5851abf929b4f4a701,
working branch fix/admission-letter-print.

Pre-update clean committed code backup (no hospital data or secrets):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v48.3.0-1f32bdb8-3c4aa64d

The OPD imaging chooser shows active catalog services exactly once under the six
existing specialties. Clicking a test name opens its unchanged order form. Removed
separate add buttons, duplicate name/code badges and category-selection controls.
Laboratory ordering, appointment fields, duplicate-order restrictions, permissions,
submission, charges and clinical data are retained. Shared IPD chooser uses the
same renderer. Khmer names are shown without duplicate English parentheticals.

Admission printing was blank because inactive page1 retained content-visibility:
hidden in the isolated print document. The selected print snapshot and its copied
ancestor shells now explicitly use visible. Live page visibility is unchanged.
The synthetic regression opens all 13 imaging forms, retains laboratory access,
checks desktop/mobile emulation, prints a populated admission PDF, and verifies
that printing/opening forms does not mutate the patient record.

See OPD_IMAGING_PRINT_V485_VALIDATION.md and the combined update TXT for final
verification and evidence. Never copy disposable databases or browser profiles
into a hospital installation. Existing patient records and photos are preserved.


## OPD direct editing and old-ANC notice removal - v48.3.0, 27 October 2026

User approved the agreed changes with "yes code it". Base local master 5f47771
(48.2.0), branch fix/opd-direct-edit. Pre-update committed code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v48.2.0-5f47771b-d756d774

Removed the legacy old-ANC notice creator and remove any existing notice nodes
when initializing the inert old form. Its saved fields and readonly behavior
remain; no replacement notice is added to the official ANC workspace.

An ordinary OPD consultation opens ready to type for authorized doctor/chief/
management roles once server canEdit is true. Doctors also require the existing
DOCTOR_READY/IN_CONSULTATION payment state. This includes the normal mode=view
link. Historical recordPage reports remain readonly; other view semantics,
wrong-ward/discharged/correction and prepayment clinical restrictions remain.
Eligible OPD editing stays enabled after Save. No auto-save or new permission
grant occurs. Patient data, shared fields, billing and clinical rules are intact.

Validation: 1,065 tests and Khmer check passed. The browser typed and saved a
Subjective note from OPD View with no Edit click, verified shared vitals/complaint
updates, absence of the old notice in OPD/ANC, continued editing after Save,
desktop/mobile, ANC print/PDF and retained maternal workflows. See
OPD_DIRECT_EDIT_V483_VALIDATION.md and the combined update TXT.

## Triage paraclinic label - v48.2.0, 27 October 2026

User supplied the exact Khmer checkbox wording and requested a command to push
after the update. Publish manually for this task: prepare a local commit/master
merge and provide `git -C "D:\EMR\Borkeo_EMR_Git" push origin master`.
Do not claim GitHub has been updated before that command is run successfully.

Clean base master/origin master 81bf338 (48.1.0), branch
fix/triage-paraclinic-label. Pre-update code-only snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v48.1.0-81bf3389-f066c2cf

The highlighted option now contains only the supplied Khmer label. Removed the
English explanatory paragraph from that block; added its label's EN mapping and
registered the owner's exact phrase in Khmer approval/translation metadata.
The existing triage_paraclinic ID, no-auto-index attribute, no-print wrapper,
storage and all triage/doctor/cashier rules are unchanged. Input positions and
clinical keys are preserved. Package/login/server release labels are 48.2.
No patient data is included in the update or source commit. See
TRIAGE_PARACLINIC_LABEL_V482_VALIDATION.md and the combined update TXT.

## NPCA practice mode and 30 fresh test patients - v48.1.0, 27 October 2026

User asked to remove all codespace patients, make 30 new ones without photos
(Registration complete, Triage measured, waiting only for the service), and to
have HEF / NSSF patients that the system verifies so NPCA can be practised;
user confirmed the plan ("yes"). Clean master 6f465b9 (48.0.0); branch
feature/npca-practice-hosting. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v48.0.0-6f465b9e-af0d6825

Seed: 12 HEF / 12 NSSF (saved card check; 011 and 012 not eligible) / 6 cash,
no photo. NPCA_PRACTICE=true (server/npca/practice.mjs): HEF, NSSF and NPCA
card checks answer from the test patients; practice NPCA (client fetchImpl)
gives Processing then Ready after a minute, failures with reasons; banner;
refuses production, NPCA_ENABLED=true, and real patients before first start.
Fake card numbers cannot be verified by the real IDPoor / NSSF / NPCA, and real
people's cards must not be put in the cloud: that is why practice mode exists.
See NPCA_PRACTICE_V481_VALIDATION.md.

## NPCA v1.4 PDF alignment and approval pack - v48.0.0, 26 October 2026

User asked to integrate the EMR with the NPCA API following the v1.4 PDF guide
and to do as much as possible towards approval; after the gap review the user
said "yes code for all". Clean master a5f9245 (47.9.0); branch
feature/npca-v14-pdf-alignment. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.9.0-a5f92450-1a4c4d24

The v42.8 integration already covered the PDF flow. v48.0 adds: current
Registration positions for marital status / occupation / disability (the old
positions blocked every patient), occupation + disabilities, encounter class,
PDF field names next to the workbook names, single-CMS-code check, the 4.4
date-range status check (POST /api/npca/check-processed, NPCA page section),
and the approval pack (scripts/build-npca-approval-pack.mjs,
docs/npca/approval-pack/, docs/npca/NPCA-V1.4-CONFORMANCE.md, questions 22-27).
Still external: NPCA credentials, test-server acceptance, service codes.
See NPCA_PDF_ALIGNMENT_V480_VALIDATION.md.

## Hosting test patients - v47.9.0, 26 October 2026

User approved ("yes code it") 30 complete synthetic patients for the GitHub
Codespace test hosting. Clean master b839489 (47.8.0); branch
feature/registration-hosting-test-patients. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.8.0-b8394899-5e379cfb

scripts/seed-hosting-test-patients.mjs builds on the v46.5 complete
registration fixture (IDs 160201-YYYYMMDD-###, same photos), adds street
address, entry types, HEF / NSSF / other-card numbers (never fake
verification), triage measurements (TRIAGE_WAITING, no service), and makes the
1234 accounts usable. It refuses a database with any non-synthetic patient.
Codespace steps: docs/DEPLOY.md. The previously proposed browser autosave draft
was put aside by the user ("forget this") and is not implemented.
See HOSTING_TEST_PATIENTS_V479_VALIDATION.md.

## ANC orders sent once per visit - v47.8.0, 26 October 2026

User approved ("yes", scope once per visit) a notice after every ANC order /
doctor request and sending each only once. Clean master d18bc5c (47.7.0);
branch feature/maternity-anc-orders-once. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.7.0-d18bc5c8-1f411f3c

Server: ancSentOrders / ancOrderAlreadySent (server/maternal.mjs) - sent today
for any of the woman's encounters, or an unreleased earlier order; used by the
midwife branch of POST /api/paraclinic/orders and by POST
/api/maternal/ask-doctor (409 code ALREADY_SENT) and returned as
`sentOrders` by GET /api/anc/record. Page: orderButton shows the note,
sendOnce + showToast, run() keeps a returned message. Pending: Khmer for
anc.labsHint (shows English). See ANC_ORDERS_V478_VALIDATION.md.

## ANC to-do list as a clean checklist - v47.7.0, 26 October 2026

User approved ("yes") replacing the to-do cards and buttons by a grouped
checklist (tick box + text); the text opens the field to fill. Clean master
3b255d5 (47.6.0); branch feature/maternity-anc-clean-checklist. Pre-update
code snapshot: C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.6.0-3b255d52-bfb4f9f6

TASK_TARGETS / goToTask / orderButton / taskItem / taskGroups in
public/anc-record.js. Ticking a data task by hand = close with a reason;
education ticks draft.educationDone. Orders (Lab, Imaging, ask doctor, iron,
vaccination) are next to their fields and removed from the print snapshot.
Task text is an <a>, because shared-controls.css restyles every <button>.
See ANC_CHECKLIST_V477_VALIDATION.md.

## ANC clean screen layout - v47.6.0, 26 October 2026

Second part of the approval given for v47.5. Clean master 52fa093 (47.5.0);
branch feature/maternity-anc-clean-layout. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.5.0-52fa093b-067ecd0e

Screen-only layout: `cell()` helper (label / box + unit), fixed 4/2/1 grid,
BP and pulse split (anc.bp / anc.pulse), aligned tick boxes (anc-check-grid,
anc-choice), yes/no and form rows, fixed table columns, equal task cards.
Printing clones the screen markup of page 2/3: keep new styles inside
`@media screen` and new wrappers inline, or the official print changes. The
older rule `.anc-visit-grid label { align-items:center }` still exists; the
cell rule overrides it. See ANC_LAYOUT_V476_VALIDATION.md.

## ANC to-do list ticked from the data - v47.5.0, 26 October 2026

User approved ("yes code it") ticking the ANC visit tasks from Registration,
Triage, midwife, Laboratory and Imaging data. Clean master 64d2bff (47.4.0);
branch feature/maternity-anc-task-auto-done. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.4.0-64d2bff5-17922394

Rules: TASK_DATA / taskAction / taskDoneByData in public/anc-engine.mjs;
tasks carry gaFrom/gaTo; facts add dates of Hb, glucose, ultrasound and
tetanus (ancStatus `vaccinations`). Vital signs need BP, pulse, temperature
and SpO2 (owner). New visit key `educationDone` ("អប់រំរួច" box) marks the
visit's education task. CBC 2 no longer ticks from the first Hb. Lab codes
OGTT/GTT/GLU map to `glucose`. Paper books, "*additional examination" and
post-term management stay manual. Next approved step: v47.6 ANC screen layout
(fixed grid, aligned tick boxes, no wrapping). See ANC_TASKS_V475_VALIDATION.md.

## ANC age and BMI correction - v47.4.0, 26 October 2026

User reported a 13-year-old not ticking "<18 / >35 years" and an empty BMI,
and approved the fix ("yes"). Clean master f24410b (47.3.0); branch
feature/maternity-anc-age-bmi-fix. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.3.0-f24410b4-d61951c7

Registration age is text ("13 <year word>" / "13 Yrs"); ancFacts now uses
ageYears() (date of birth first). The pre-pregnancy weight takes the Triage
weight at any GA because maternal option prePregnancyWeightFromTriageMaxWeeks
is now null (owner decision, BMI may be overestimated after 12 weeks; a number
restores the old first-visit rule). See ANC_AGE_BMI_V474_VALIDATION.md and the
v47.4 update TXT. Test fixtures must use the real Registration age format.

## ANC automatic colour code - v47.3.0, 26 October 2026

User approved ("yes code it") automatic ticking of the ANC colour-code chart
from patient data, dropdowns for the ultrasound table, units on today's visit,
and the urine fields renamed ជាតិសាច់ក្នុងទឹកនោម / ជាតិស្ករក្នុងទឹកនោម with
plus-sign dropdowns. Clean master a59ea43 (47.2.0); branch
feature/maternity-anc-auto-colour-code. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.2.0-a59ea43e-90c5620d

Rules live in the AUTO table of public/anc-engine.mjs; evaluateColour now
returns `applied` (every item that applies, green too) and `automatic` (locked
ticks). The server merges released Imaging ultrasounds like Laboratory results.
Only ANC files, version files and Khmer approval files changed. The official
chart JSON is unchanged. Owner decisions taken: FHR < 110 / > 160 red; BP
>= 140/90 with protein ++ red; fundal height > GA + 3 cm from 20 weeks yellow;
fetus count column added. See ANC_AUTO_COLOUR_V473_VALIDATION.md and the v47.3
update TXT. Running v426-midwife-anc-browser rewrites verification-v431/*.png;
do not commit those images unless intended.

## ANC triage transfer correction - v47.2.0, 26 October 2026

User explicitly requested fixing the triage ANC transfer that opened a JSON
permission-denied page. Clean master baseline 061288a (47.1.0); branch
fix/triage-anc-transfer. Pre-update code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.1.0-061288a9-3a066948

The ANC module-change listener was navigating on programmatic changes caused
by care-path synchronization, including the hidden OPD selector during triage.
It now checks role/workspace before opening the clinical ANC page. Triage and
registration never navigate there from that listener; management using their
triage/registration workspace also stays in place. Authorized clinical ANC
opening is retained. The legacy notice does not offer an inaccessible ANC link.

Server page/API authorization and ANC fees/cashier/midwife routing are unchanged.
Triage saves and returns to its list; the patient follows the existing cashier
step and then appears in the midwife queue. No patient migration or live-data
test occurred. Required ANC fields from 47.1 remain intact. Midwife list direct
opening and colour-chart checkbox synchronization remain separate pending work.
See TRIAGE_ANC_V472_VALIDATION.md and the combined v47.2 update TXT.

## ANC required entries - v47.1.0, 26 October 2026

The user confirmed the FIRST of four proposed ANC changes. Only required
entries/missing fields are included. Direct ANC opening from the midwife list,
the triage redirect error, and automatic colour-chart checkbox synchronization
remain pending separate approvals. Do not claim this release fixes those.

Clean baseline master b21d28da7cf1f51361cf3f4116433269324a4d88 (47.0.0), branch
feature/anc-required-fields. Code-only backup before edits:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.0.0-b21d28da-288d8800

Added required stars/accessible attributes and a shared client/server completion
check for the unified Save visit action. A missing entry reveals its section,
shows the existing Khmer required-field message and does not save. No values
are invented or backfilled. Zero supplements are accepted. Existing pregnancy
records remain readable; opening a draft, legacy partial-record APIs, referral,
prescribing and other independent actions retain their existing behavior.

Added missing encounter ICD10 text entry and visit number (1-8), with tetanus
status entered as text to preserve values such as TT2. Gestational age uses the
existing dating engine and is displayed as completed weeks plus days, updated
when dates change. Existing complaint, gravida, LMP, iron and vital fields are
reused rather than duplicated. Supplemental values are per visit. Pending lab
samples/results are not universally required; no clinical rules were changed.

See ANC_REQUIRED_V471_VALIDATION.md and the v47.1 combined update file.

## Combined approved updates - v47.0.0, 25 October 2026

User explicitly requested every pending discussed update. Base is clean master
cd41efd (46.5.0); development branch feature/unified-anc-workspace. Five pending
minor steps are delivered together as 47.0.0, with package/login/server aligned.
Earlier notes below are historical; registration separation and backups are
now included. Preserve all supplied 46.2-46.5 triage and fixture improvements.

- Registration Save writes registration only and leaves a new patient REGISTERED;
  explicit Send to Triage changes that patient to WAITING. Already transferred
  patients retain their clinical state. Registration chart navigation is hidden.
- OPD plus paraclinic retains the doctor-first ordering flow; OPD alone retains
  direct cashier routing. The notification now explains the correct destination.
- The duplicate OPD consultation editor/navigation and top auxiliary controls
  shown in the screenshot are hidden. Native SOAP remains. Chief complaint is
  editable in Subjective; eight vital measurements and complaint use canonical
  triage fields in the same encounter. Explicit clearing is supported. Existing
  role, ward, payment, discharge and version guards remain; earlier visits and
  protected registration demographics are not overwritten by doctor edits.
- ANC opens one workspace from the old entry point, with current visit,
  pregnancy, tests, care, history, risk and legacy sections. Old-only fields are
  available as supplemental per-visit details. Existing legacy encounter values
  are shown read-only without silently copying a different pregnancy. Record
  and visit Save are atomic; previous encounter links retain their own pregnancy.
- npm run backup:code archives committed code with a checksum. Restore extracts
  into a new folder and never overwrites hospital data or the current app.

The address loader now waits for linked address restoration before enabling
shared editing/saving; stale patient loads cannot apply a prior address/photo.
Independent allergy/problem editors validate their own actions rather than
blocking the main encounter Save with an empty, unrelated draft.

Pre-update verified code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v46.5.0-cd41efdd-72a766bc
Restored successfully to a separate temporary folder with version/commit intact.
See COMBINED_UPDATE_V470_VALIDATION.md for verification and installation.

## Current synthetic-registration task - v46.5.0, 25 October 2026

User selected 30 synthetic test patients, not updates to real registrations,
and approved IDs 160201-YYYYMMDD-### with a daily three-digit sequence. Explicit
coding approval received. Branch: feature/complete-synthetic-registration.
Actual clean base is 28f763a, including the supplied 46.2/46.3/46.4 triage changes
after our last 46.1 release. Preserve those changes. Package was already 46.4
while visible/server version labels were 46.1; this release aligns all at 46.5.

Added a standalone generator that creates a new temporary SQLite file only.
The legacy reset/seed helper runs exclusively in a newly created in-memory
template database. The generated output never targets the hospital database,
and the CLI accepts no destination arguments. All 30 Health IDs and case
numbers use the requested format, with Khmer sex, age/DOB, linked gazetteer
addresses, required marital/occupation/disability/coverage/other-ID choices and
caregiver information. Registration is complete and triage remains waiting;
no clinical measurements are fabricated in the new fixture.

Ollama Claude received the no-tools implementation prompt through ollama launch
claude using local qwen3.5:4b. Its proposal contained mismatched dates/address
formats and age restrictions; those were not adopted. The implementation uses
the actual project form/storage keys and gazetteer, verified in Chromium.

Four existing 46.4 labels were absent from approval metadata. Exact existing
wording was preserved and narrowly registered with translation provenance;
no baseline or runtime triage logic changed. The existing record loader does
not call its linked-address helper; the fixture browser harness invokes that
helper explicitly. No unrelated production loading fix is included.

Registration button/save separation and the proposed backup/rollback tool are
still separate pending updates. Do not claim they are implemented by this task.
See COMPLETE_REGISTRATION_FIXTURE_VALIDATION.md and the combined update TXT.

## Latest correction - v46.1.0, 25 October 2026

User explicitly authorized fixing Skip for an older patient whose active call
has a valid queue number but registration JSON lacks it. Base: clean fetched
master 838f069. Branch: fix/triage-skip-active-queue-number.

skipQueuePatient retains valid supplied/saved numbers. If they are missing or
invalid it reads the latest active call for exactly the same patient and
normalized service, validates that number, and uses it for the existing skip
operation. It never allocates a new number or rewrites registration/clinical
JSON. A missing valid active number still fails rather than borrowing another
patient, an inactive call or another service. Existing role/ward/CSRF guards,
the skipped-list direct-edit action, admission form and UI are unchanged.

The regression and Chromium fixture now remove both registration queue-number
keys before testing, matching the reported older-record case. The previous
46.0 fixture always had saved numbers and therefore missed this case.
Release versions advance together from 46.0.0 to 46.1.0 / visible 46.1.
See TRIAGE_SKIP_ACTIVE_NUMBER_VALIDATION.md and the combined
Borkeo-EMR-v46.1.0-triage-skip-fix-update.txt. Earlier notes are historical.

## Latest update - v46.0.0 triage skip, 25 October 2026

User authorized adding Skip to the bottom triage action row, returning to the
skipped-patient list without saving unfinished form edits, keeping the existing
Complete Triage action in that list as direct edit without an approval request,
and removing only the triage admission-print button while preserving the
admission form. Base: clean fetched master a8c666c. Development branch:
feature/triage-skip-action. Version rolls from 45.9.0 to 46.0.0.

The UI uses the existing authenticated/CSRF-protected queue skip endpoint.
Skip is available for the TRIAGE role on unfinished editable triage, and its
failure message is visible beside the button. No unfinished clinical fields
are saved. The skipped row retains its existing direct edit=1 link and label.
Corrected skipped-list filtering for blank discharge dates (the current schema
stores empty strings, not NULL) and excluded active skips from triage waiting.
Discharged patients remain excluded. Existing role, ward, CSRF and edit policies
are unchanged. No patient data or ignore rules were altered.

One exact baseline print-label removal and one safe retry-message translation
are narrowly recorded in the Khmer approval/provenance files. Baseline unchanged.
Validation and delivery: docs/development/TRIAGE_SKIP_VALIDATION.md and
Borkeo-EMR-v46.0.0-triage-skip-update.txt. Earlier sections are historical.

## Latest approved update - v45.9.0, 25 October 2026

Based on clean fetched master 8539292, developed on feature/triage-form-actions.
The user approved removing the three shared editor toolbar buttons and the
remaining Vitals tab from the triage view, using the native cancel beside Save
and Transfer to return to /triage without saving, and containing the Khmer form
heading inside its white box. Routine implementation choices were delegated
to the assistant. Other roles retain their editor toolbars and chart tabs.

Implemented the previously undefined handleTriageDiscard without a save call,
marked cancel as a required-field bypass, suppressed triage's duplicate toolbar
and tab strip, and added screen-only heading padding/wrapping plus responsive
save/cancel layout. No saved field IDs, clinical rules, queue logic or patient
data were changed. Skip-to-late and permanent startup changes are outside this
approved update. Versions are consistently 45.9.0 / visible 45.9.

Validation: 1007/1007 npm tests and check:khmer pass in a disposable synthetic
copy; explicit Chromium test passes at 1440px and 390px, including cancellation
with an empty required field and unchanged persisted patient data. See
docs/development/TRIAGE_FORM_VALIDATION.md and the single combined
Borkeo-EMR-v45.9.0-triage-form-update.txt delivery artifact. Earlier continuation
instructions below are historical; do not repeat their branch setup or releases.

## Current triage update - 25 October 2026

The historical pause instructions below have been superseded by merged master
at bff56ec. The working tree was clean and origin fetched before creating
feature/triage-remove-summary. The user authorized a separate triage branch,
verification, publication and merge for the next release.

Following the one-change-at-a-time instruction, this update implements item 1:
remove the Summary tab for TRIAGE only, retaining Vitals and every other role's
existing tabs. Package/login/server versions advance from 45.7 to 45.8.0;
the earlier master commit title mentioned 45.8 but did not update metadata.

Items 2-4 (white page coverage, footer buttons/cancel placement, skip-to-late
action) remain for individual agreement and coding authorization. Do not claim
that this release implements them. Patient records and clinical logic are unchanged.

Validation and release evidence: docs/development/TRIAGE_SUMMARY_VALIDATION.md.
Delivery: Borkeo-EMR-v45.8.0-triage-summary-update.txt.

User goal: safely create a branch or a separate working copy for one EMR module, edit it, test it, and merge it back. The agreed first scope is to map modules and establish a branching workflow. Large physical extraction of forms is a later task.

Completed: inspected supplied Borkeo_EMR_v45.5.0.zip; mapped 23 areas; added cross-platform Node branch helper, worktree helper and change-scope review; tested with disposable Git repositories. Clinical forms, backend runtime, saved keys, patient data and .gitignore are unchanged.

Known source issues: package.json declares 45.4.0 despite archive filename 45.5.0. Several tests refer to earlier patient-banner behavior intentionally removed according to the supplied changelog. See VALIDATION.md for measured baseline failures; do not automatically restore removed UI to satisfy old tests.

There was no .git history or authenticated GitHub checkout available in the attachment. No remote branches, pushes, pull requests or merges were made. Install into the user's existing checkout; never replace its .git directory or initialize an unrelated replacement history.

Next action in an existing checkout: read its current AGENTS.md and this package's BRANCHING_GUIDE.md; verify installation is additive and matches the latest supplied project; run helper tests; run application/Khmer checks in disposable data and compare baseline. If checks fail, follow the existing AGENTS.md no-push rule and report failures. Do not modify clinical behavior or real data under this tooling task.

Continue after interruption by inspecting Git status, this handoff and validation report. Preserve unrelated uncommitted work and do not restart/refactor the project.

## Installed in the existing checkout - 25 October 2026

Installed at D:\EMR\Borkeo_EMR_Git from D:\EMR\Borkeo_EMR_Branching_Toolkit. The initial working tree was clean. Fetched origin successfully; master was already current at 8b26d6ec29f664fcda3d696423b74229df9395ba. Created feature/development-branching-toolkit from that stable commit without resetting or replacing history.

Added only the two scripts, the helper test and the five supplied docs/development files. All eight files matched the toolkit byte for byte before these installation notes were appended to AI_HANDOFF.md and VALIDATION.md. Existing tracked files, release metadata, .gitignore and runtime data remain unchanged. The CLI lists 23 modules and its development review identifies only the eight intended additions with no sensitive files.

Validation on Node 24.21.0: helper tests 6 pass; npm test 998 total, 985 pass, 13 fail; check:khmer fails with 67 issues. Failure names match the supplied VALIDATION.md baseline, with no additional failures. Validation used a disposable source copy and resetAndSeedThirtyTriagePatients to generate 30 synthetic patients; no hospital database, uploads, backups or .env were copied. An initial run used the older ten-patient fixture and had seven extra fixture failures; correcting the disposable fixture removed all seven.

Validation copy and logs: C:\Users\Local-admin\AppData\Local\Temp\borkeo-toolkit-validation-0812ba7a5879493e822f52781b71729b (validation-tests.log and validation-khmer.log).

The installation is present locally and remains uncommitted and unpushed because the required application checks fail. No merge or pull request was performed. Next concrete step: separately agree on diagnosis/remediation of the 13 existing test failures and 67 Khmer issues, then rerun the required checks before committing/pushing the intended tooling paths. Do not restore removed UI, accept a Khmer baseline, or change release metadata under this installation task. No combined update artifact outside the requested eight paths was added, respecting the user's install-only scope.

## Remaining-work continuation - 25 October 2026

Authority: D:\EMR\EMR_FINISH_REMAINING.txt, read completely. Current branch feature/development-branching-toolkit remains at 8b26d6ec29f664fcda3d696423b74229df9395ba with authorized staged toolkit files and unstaged provider/version/test/approval work. Do not switch/reset/reinstall. Current package is 45.6.0; the earlier paragraphs above are historical installation evidence, not the current completion state.

- [x] Read current AGENTS.md; only root AGENTS.md found. Inspected branch, origin, staged/unstaged files, guides, module map, release notes and prior update artifacts.
- [x] Work A already completed: the two banner appearance tests now cover HTTP/MIME, actual role-filtered Khmer chart navigation and events. Preserve that work.
- [x] Prior provider/wording work present; approval file has the 22 narrowly reviewed additions (370 entries). Baseline remains unregenerated. Prior focused results are not a final full-suite result.
- [ ] Work B: replace four remaining banner-helper safety assertions with provider/UI/API/storage behavior coverage; audit patient/revision and mutation isolation.
- [ ] Work C: preserve IPD EWS and reconnect only explicit existing DNR/risk information in a non-banner clinical area, or document precise clinical blockers.
- [ ] Work D: investigate current management menu and missing access-logging connection; verify direct access/audit behavior.
- [ ] Work E: classify the full original 67 Khmer issues and narrowly resolve evidenced changes via supported mechanisms; no blanket baseline acceptance.
- [ ] Work F: final disposable synthetic validation, browser/helper checks, refreshed map/report and one new combined update artifact.
- [ ] Work G: stage only intended files; commit/push feature branch and prepare draft PR only if checks and clinical completion permit. Never merge/deploy.

Git ignore warning: the restricted shell cannot stat C:\Users\Local-admin\.config\git\ignore (access denied). Do not change ACL/global config or request system elevation to silence it. Project ignore checks correctly ignore data/test.sqlite, data/backups/test, data/uploads/test, .env and the password export. Further read-only diagnosis remains pending; .gitignore stays unchanged.

Next action: inspect safety tests, actual provider/editors, current navigation/audit and the complete checker diagnostics; checkpoint each completed group here. All hospital data stays excluded from validation.

### Checkpoint: Work B/C/D/E implementation

- Work B: four old banner-helper assertions now target frozen keys 82/83, server/provider allergy states (including existing conflicting-input precedence), actual transient-key numbering and doctor/read-only editor forms. Provider race/error/mutation isolation tests remain. No encounter-lock route or policy changed; summary writes retain doctor-role and patient-access enforcement. Their relationship to encounter locking was deliberately not redefined.
- Work C: historical source 96b6159^ confirms that risk flags were explicit DNR and severe/life-threatening structured allergies only. Added a read-only section in the existing IPD allergy/clinical area using that established source; unknown/error never becomes full resuscitation. No orders, editing or new calculations. Independent IPD EWS rendering/exclusions now have behavioral coverage.
- Work D: updated obsolete submenu expectations to current grouped sidebar behavior. Reconnected window.logRecordAccess in public/record-access.js, retaining server-owned opens, CSRF, patient guards and duplicate suppression. Management viewer now identifies the displayed encounter, clears it during loading, and waits for summary readiness before snapshots. Found and repaired missing Khmer-default audit-viewer label wiring; English switching remains.
- Work E: all original 66 missing-text diagnostics are evidenced by banner removal 96b6159 and submenu removal 0d66c1a. Added exact file/baseline-line approvals and tests that reject loss elsewhere or excess copies. Four additional removed test-source expectations from completed Work A are separately documented. Existing baseline JSON and first 370 approval entries remain unchanged; further narrow approvals are explained in KHMER_REVIEW.md.
- Focused checkpoint: 35 tests passed and check:khmer passed before the final management-viewer localization/context additions. Do not treat that checkpoint as final proof for later edits.
- Current release increment: 45.7.0, one increment for this remaining-work set. Package, server current header and both login labels agree. Historical notes/artifacts preserved.
- Fresh disposable copy: C:\Users\Local-admin\AppData\Local\Temp\borkeo-finish-1b20881f2bd845e2b78cb211727becaf. No hospital .env, runtime DB, credentials, backups or uploads were copied. Retained tracked ICD-10/gazetteer and synthetic demo portraits. Browser/targeted final checks are next, then seed only its data/demo.sqlite with the 30-patient fixture before the final full suite.

### Checkpoint: integration findings and provenance

- Management Chromium passed: the actual read-only viewer snapshots recorded DNR, switches between two synthetic encounters and binds print/export logs to the displayed encounter; no log is sent during loading. Management roles retain viewer access; doctor/ward denials and missing-CSRF denials remain. Audit viewer labels switch KH/EN; Triage keeps its queue-display navigation.
- Initial full run: 1007 total, 1006 pass, 1 failure in the unchanged translation provenance assertion. It requires approval pairs in translations-needed.csv. Registered exactly the 31 direct-review/completion pairs under reviewed.* keys without modifying existing rows or weakening that test. Subsequent focused run: 25 pass; check:khmer passes.
- Actual Chromium chart navigation exposed dead orders/results/medication anchor IDs that the earlier DOM stub did not reveal. Reconnected these tabs to the current encounter's existing paraclinic panel/recent-results details and medication section. No new panels, orders, fields or saved keys; existing role filtering/page guards remain. Removed the fake obsolete anchors from the unit fixture. A final browser run and final full run are now required for this correction.
- Publication preflight: gh auth status --hostname github.com reports the configured drsokhadarapiseth-cloud token invalid in the restricted shell. Do not change credentials or seek system privileges. Git HTTPS credentials may be independent; verify only normal configured-remote access after final validation. No PR URL/number exists yet.

## PAUSED BY USER - 25 October 2026 (latest authoritative checkpoint)

The user explicitly paused this task and requested only this handoff update.
Preserve every staged, unstaged and untracked file. No further development,
staging, commit, push, PR creation or merge is authorized while paused. The
earlier unchecked lists and validation warnings above are chronological history;
the status below supersedes them. No active validation process remains known:
all launched test/fetch sessions returned completion before this pause.

### Verified state and completed work

- Branch: feature/development-branching-toolkit. Current release: 45.7.0.
- HEAD remains 8b26d6ec29f664fcda3d696423b74229df9395ba. A successful configured-origin fetch immediately before the pause confirmed origin/master at the same SHA. No branch switch, merge, reset, history replacement, commit or push occurred.
- Work A/B/C/D/E implementation is complete locally: current chart navigation and role filtering; allergy/provider/editor/storage protections; read-only explicitly recorded DNR/severe-allergy display; independent EWS; print/export audit provider and selected-encounter viewer context; localized audit/viewer errors and KH/EN audit controls; exact Khmer removal/approval review.
- The late chart-navigation correction is now browser-verified against actual existing paraclinic/results/prescription sections, not invented anchor IDs. Results opens the existing recent-results details. No banner was restored.
- The management viewer waits for clinical summary readiness (or a safe error state) before snapshotting, clears the active patient during loading/empty selections, and logs only the displayed encounter. Its unavailable-record message is safe Khmer by default rather than raw backend diagnostics.
- Clinical schema, saved field IDs/positional keys, EWS thresholds, DNR ordering/editing policy and encounter-lock policy were not changed. Backend summary role/ward guards remain; no hospital data or .env was used.
- Baseline JSON hash remains EE9BEA0014CBD41945C3F79E406D76247E2385A214DC4B822168F6B5FD74FE88. .gitignore is unchanged. Original 348 approvals and the earlier reviewed 22 remain intact; there are 379 approved entries, including 9 narrowly documented completion labels. The test-only escaping value retains testOnly metadata.
- KHMER_REVIEW.md records historical evidence (96b6159 banner removal; 0d66c1a submenu removal), 69 exact file/text removal rows, the four obsolete test-source removals, and the narrow new-label decisions. The removal checker is bounded to exact baseline file/line occurrences and has excess/wrong-file/wrong-line rejection tests. No baseline regeneration or blanket snapshot acceptance occurred.
- Exactly 31 reviewed approval pairs were appended under reviewed.* keys in translations-needed.csv to satisfy the unchanged provenance test; existing CSV rows and blank translations were preserved. No apply-translations script ran.
- Module map and modules.json have been refreshed for the provider, audit scripts, navigation and tests. The 23 modules are task-branch choices, not permanent branches or physically extracted forms.

### Actual validation results

Disposable root: C:\Users\Local-admin\AppData\Local\Temp\borkeo-finish-1b20881f2bd845e2b78cb211727becaf.
Only its data/demo.sqlite was reset/seeded with resetAndSeedThirtyTriagePatients
(30 synthetic patients). Reference ICD-10/gazetteer and synthetic portraits were
retained; runtime hospital databases, uploads, backups, secrets and .env excluded.

| Check | Result | Log in disposable root |
| --- | --- | --- |
| npm test (latest full run) | 1007 tests, 1007 pass, 0 fail | validation-finish-full.log |
| npm run check:khmer | Pass, 0 issues | validation-finish-khmer.log |
| Toolkit helper tests | 6 pass, 0 fail | validation-finish-helper.log |
| Focused provenance/chart/clinical/EWS checks | 25 pass, 0 fail | validation-finish-provenance.log |
| Chromium clinical/provider/chart navigation/print CSS | 1 integration test pass | validation-finish-provider-browser.log |
| Chromium management viewer/audit/KH-EN/role-ward/CSRF/unavailable-record checks | 1 integration test pass | validation-finish-management-browser.log |
| git diff --check | Pass; only ordinary LF/CRLF conversion warnings | checked in actual checkout |

The full run followed the provenance registration and real-anchor correction.
The final viewer error-message localization was completed afterward and verified
by the latest successful management Chromium run; that error branch does not
change clinical/server logic. No claim that old checkpoint failures remain is
current. If source changes on resume, rerun affected checks; do not blindly repeat
unchanged suites or seed the live checkout.

### Remaining tasks and blockers

- Work F documentation/delivery remains: update docs/development/VALIDATION.md with these actual final results and final source scope. It still contains historical baseline/installation results. Review MODULE_MAP.md/modules.json for any final documentation adjustments.
- Produce ONE new combined 45.7.0 final update TXT containing the intended final source/toolkit/docs changes plus installation/continuation instructions. This final artifact has NOT been written. Preserve the existing 45.5.0 and 45.6.0 update TXT files as historical artifacts; do not mistake them for the final release.
- Reconcile final source/test coverage carefully before publication. The final unavailable-record error helper was browser-verified after the full run; run the relevant focused viewer/audit test if needed, without unnecessarily repeating the whole unchanged suite.
- Work G remains entirely unfinished: inspect staged and unstaged diffs, audit exact staged paths for patient data/secrets, stage only intended paths, and (only after the user resumes and required validation/completion still holds) create descriptive local commit(s), push ONLY the feature branch, and prepare a draft PR if normal access permits. Never merge/deploy under this task.
- GitHub CLI preflight reported an invalid token for drsokhadarapiseth-cloud in the restricted shell. Normal Git HTTPS fetch succeeded independently. Draft-PR access is therefore unresolved, not proven available. Do not change credentials or claim a PR exists; if publication access is blocked, retain work and give the exact manual next step/compare URL.
- The global Git ignore warning persists in the restricted shell. Do not weaken ACLs or change global settings. Project ignore checks passed; the sole tracked data/*.sqlite match is the allowed reference data/icd10/catalogue.sqlite, not a patient database. No .github workflow directory exists in this checkout.
- The index still holds the original toolkit additions, with newer handoff/map edits unstaged (AM). Other application/test/approval changes are unstaged; new provider/browser/helper/audit-review files and both older TXT artifacts remain untracked. Do not discard or blanket-stage them.

### Exact next action after an explicit resume

First read this latest pause section and run git status plus git branch
--show-current. Confirm branch/release/source have not changed. Then update ONLY
docs/development/VALIDATION.md from the verified results above and prepare the
new Borkeo-EMR-v45.7.0-final-update.txt from a reviewed explicit file manifest.
After that, perform the final diff/sensitive-path audit and resume Work G only
within the original publication authorization and any new user constraints.
Do not rerun installation, recreate the branch, restore the banner, regenerate
the Khmer baseline, or run the branch-start helper on this dirty/unmerged base.


## 28 October 2026 - authorized blank OPD/IPD repair

The owner authorized repair of both installed EMRs after reporting blank forms.
Current master baseline is 8ed42bb3632ec25419a4d3857bb4f915eebef1de (49.2.0);
the historical 25 October pause above describes an older completed task state.
See FORM_OPENING_V493_VALIDATION.md for baseline backup, independent copy versions,
reproduced stale-Triage CSS cause, explicit installed paths and synthetic evidence.
Full suite 1,072/1,072 and Khmer passed; desktop/mobile OPD/IPD recovery and Triage
isolation browser regression passed. No runtime data/configuration changed.
Publication to master is authorized by the current AGENTS.md after validation.

## 28 October 2026 - approved local provincial referral workflow

Owner confirmed localhost:3002 as the new receiving EMR and authorized coding
with "yes". See PROVINCIAL_REFERRAL_V494_VALIDATION.md for exact scope, code and
database backup paths, installation, pairing safeguards and test evidence.
Primary baseline e6142a63bc9c300960691ca8bf092d31c14eaa8b (49.3.0); releases
are primary 49.4.0 and separate receiving copy 49.3.0. The two verified Wi-Fi
listeners were restarted and both are healthy. Patient rows and staff identity/
role hashes match before/after; database integrity is OK. No test patient was
sent to either runtime database. The shared pairing key stays outside the repos.

OPD's visible transfer control opens a responsive referral popup. Signature
entry opens on tap; Send delivers an immutable signed referral to the second
EMR's authenticated incoming queue. Staff acceptance is audited and reflected
in the sender. Existing internal ward/admission keys, encounters and financial
rules remain intact. Receipt does not automatically create an admission/bill.
Full suite 1,074/1,074; Khmer; two desktop/mobile/print browser regressions passed.
The final queue error-display change passed the affected browser regression.
Combined artifact: Borkeo-EMR-v49.4.0-provincial-referral-update.txt.
Current AGENTS.md authorizes committing and pushing this verified update to master.

## 28 October 2026 - referred-patient sidebar/table and visit review

Owner approved coding the transferred-patient list, asked to place it in the
sidebar, and specified dated visit selection for medical/OPD/referral/nursing
review. Owner explicitly chose doctors and management only for rejection.
Base master f6ecd80872a45d08b64b6e9dcb71be46b2d856a7 (49.4.0); releases primary
49.5.0 and independent receiving copy 49.4.0. See
REFERRED_PATIENTS_V495_VALIDATION.md for backups, source/receiver scope and evidence.

The receiving sidebar contains the requested facility-patient name; its table
supports read-only dated record choices and existing acceptance. Rejection is
server-limited to doctor/chief doctor/hospital management, requires a reason and
updates the sender. History is authenticated, transfer-scoped and isolated from
other identities. Static review documents cannot execute scripts or edit records.
Full suite 1,075/1,075 and Khmer passed. Rendered desktop/mobile record review,
structured nursing, malicious-text isolation and decision browser checks passed.

Both verified listeners were restarted. Patient/account/role, ward/imaging and
existing referral snapshot comparisons match the consistent pre-activation
backups; integrity is OK and no synthetic fixture entered runtime databases.
The external pairing key, .env, .gitignore and launcher settings are preserved.
Combined artifact: Borkeo-EMR-v49.5.0-referred-patient-list-update.txt.
Current AGENTS.md authorizes automatic master commit/push after these checks.

## Approved staged update - clean treatment v49.6.0

Owner selected "Both, implemented in stages": complete the treatment presentation
correction, then the approved multi-peer API/messaging/search scope. Stage 1 is
complete: see TREATMENT_VIEW_V496_VALIDATION.md for baseline commit/backup and
synthetic checks. Primary 49.6.0, independent receiver 49.5.0. All 1,077 tests,
Khmer and rendered treatment/browser workflow passed. Both listeners activated;
patient/account/role/integrity checks preserved runtime data. No prescribing,
clinical or financial behavior changed. The larger API stage remains authorized.

## Approved staged update - multi-EMR API v49.7.0

Stage 2 completes the approved multiple-peer settings, reciprocal API approval,
bidirectional referrals, read-only patient search and doctor messaging scope.
See EMR_NETWORK_V497_VALIDATION.md for use, safeguards and limits. Baseline
caa15cf6b7b69412536b7d054378b326328a2350; clean code backup
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.6.0-caa15cf6-ba188c24.
Receiver baseline code archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-network-20261028.

Disposable synthetic validation: borkeo-restored-code-p8ELKC under the local
Temp folder. Full suite 1,078/1,078 and Khmer passed. Desktop/mobile admin/search/
message browser checks passed, as did multi-recipient signed referral selection,
dated OPD/IPD/nursing/letter review and accept/reject controls. Identity checks
prevent clinical data going to an unverified target; disabled permissions, key
rotation, peer isolation and message idempotency are covered. No universal
security certification or Internet federation is claimed.

Primary 49.7.0 and independent receiver 49.6.0 activated at their existing
origins. Final verified listeners are primary PID 29568 and receiver 32832.
Each has an independent runtime API key and reciprocal approved peer. Signed
ping succeeded both ways; validated old referral rows were bound to that peer.
The private old link file remains intact, but managed mode disables its endpoint.
No keys, .env, uploads, databases, backups or unrelated .vscode files are staged.

Final hardening adds unshared Ed25519 private signing seeds. Copied API tokens
carry only the public verification identity; even another connected peer that
knows both public tokens cannot impersonate the source. Explicit forgery and
replay tests cover this. Fresh signing seeds replace the intermediate shared
bootstrap material for request authentication; existing payloads remain intact.

Online backups and before/after patient/account/role hashes match: primary 22
patients, receiver 0 local patient records, integrity OK. Across 93 pre-existing
tables, clinical, financial and referral payload/state data are unchanged;
new peer bindings and tables are intentional. The existing startup bootstrap
updates its Superuser password salt and metadata timestamps; full staff access,
ward/imaging assignments and signature content remain equivalent. Sessions only
changed last-seen times and expired nonces were pruned. Detailed comparisons:
activation-table-preservation.json, activation-account-columns.json and
activation-semantic-preservation.json in the disposable evidence folder.
The final private-signature activation comparison is
activation-final-preservation.json: all 92 existing non-audit/non-nonce tables
match semantically on both installations, with only the documented startup
metadata, Superuser salt and explicit referral peer bindings excluded.

Served login versions and all new assets were verified on both listeners;
unauthenticated settings requests return 401. Delivery artifact:
Borkeo-EMR-v49.7.0-multi-emr-network-update.txt. Current AGENTS.md authorizes
automatic master commit and push after these passed checks.

## Connection table and request approval - v49.8.0

Owner approved updating both EMRs after confirming the five-column connection
table and ADMIN accept/reject flow. Later clarification takes precedence over
the earlier Old Case assumption: only this hospital's own prior visits determine
case type. A source-only patient is New Case here; a matching existing local
Patient ID is Old Case here. Remote search displays this receiving-hospital hint.
Original source records stay read-only; normal local registration/admission
creates its own encounter and retains all existing clinical/financial rules.

Baseline master 3b94d8eaed6fdf9b6936718fbef74845712f319f (49.7.0). Clean backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.7.0-3b94d8ea-8300fb6d.
Receiver baseline 49.6.0 archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-connections-20261029.
Primary target 49.8.0; independent receiver target 49.7.0. Validation guide:
CONNECTION_TABLE_V498_VALIDATION.md. Combined delivery:
Borkeo-EMR-v49.8.0-connection-table-update.txt.

Synthetic validation root is borkeo-restored-code-d4qND7 under local Temp. Full
suite has 1,079 tests and Khmer validation; desktop/mobile browser checks cover
connected/disconnected five-column tables, masked keys, request approval and
rejection, immediate peer-selector refresh and restricted staff controls. The
existing read-only history/search/private-message workflow is also exercised.
Focused security checks cover stale/revoked approvals, two-sided consent,
unchanged service scopes, CSRF/roles, peer isolation, and an in-flight disable.
Requests share no patient payloads; no live synthetic records are created.

Existing runtime keys/grants and the old link file are preserved; this update
does not rerun the pairing bootstrap or automatically import/admit patients.
Source .env, databases, uploads, backups, .gitignore and unrelated .vscode work
are excluded from staging. Activation verification is recorded below.

Activation finished: primary 49.8.0 PID 24944 and receiver 49.7.0 PID 25184,
using their original startup commands and separate hostname/port configuration.
Signed bidirectional identity and incoming/outgoing checks pass. Existing API
identities, private signing seeds and grants match their pre-activation backups;
no live requests or test patients were added. Full 1,079/1,079 tests, Khmer and
both browser workflows passed in the disposable copy. Screenshots were reviewed.

Patient/account/role hashes match (primary 22 patients, receiver 0 local records)
and both databases report integrity OK. The final comparison covers all 95
pre-existing non-audit/non-nonce tables, including clinical, financial, referral
and network tables. Only existing startup Superuser salt/metadata timestamps and
session last-seen times are normalized. Evidence:
activation-preservation-and-connection.json, primary-before/after.json and
receiver-before/after.json in the disposable validation folder. New request
tables are empty in both real installations. No database/key bootstrap was run.

The user's latest New Case/Old Case rule is reflected in remote search only;
viewing/accepting a referral still does not automatically admit or import a
patient. The existing local registration/admission flow must be completed for
the local encounter and remains subject to the normal clinical access checks.

## Owner manual disconnection and API copy icon - v49.9.0

Owner explicitly requested both hospitals be disconnected so they can perform
the copy/paste/request/approval themselves. Both exact peer entries now have
incoming/outgoing off, revisions incremented and pending approvals stale.
Keys and patient records are preserved. Do not run pair-local-emrs.mjs or
re-enable the pair unless the owner explicitly asks. The API/peer service remains
enabled so a new owner-initiated signed request can be received; sharing is off.

Owner then requested a copy icon and asked whether messaging transfers the full
key. The ADMIN local API display now has the existing copy SVG beside its masked
hint. Copy still fetches the complete 106-character public connection identity
from the existing protected endpoint. It never copies the private signing seed.
See API_COPY_V499_VALIDATION.md for the manual workflow and backup paths. The
existing two identities remain configured; unknown hospitals still require
mutual ADMIN identity configuration, not unauthenticated self-enrolment.

Baseline master 8d4df4e4cfb68bdd4ab314f1d4f27ab615cfecb6 (49.8.0), clean code
backup C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.8.0-8d4df4e4-4942e03c.
Receiver baseline 49.7.0 archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-api-copy-20261029.
Primary 49.9.0 PID 31148 and receiver 49.8.0 PID 12008 are installed using their
original hidden startup commands and existing environment/data configuration.
Both remain disconnected with zero pending approvals after restart.

Disposable validation: borkeo-restored-code-R0fC5w under local Temp. All 1,079
tests and Khmer checks pass. Browser verifies the icon, full 106-character
clipboard value, excluded private seed, desktop/mobile layout and the existing
search/read-only history/message workflow. A synthetic clipboard avoids writing
to the user's desktop clipboard. Screenshots were reviewed.

Final activation-disconnected-preservation.json verifies all 96 pre-existing
non-audit/non-nonce tables match the post-disconnection backup, including keys,
grants and requests. Only existing Superuser startup salt, metadata timestamps
and session last-seen values are normalized. Patient counts remain 22 and 0;
integrity OK. No synthetic patient, key rotation or automatic pairing was used.
Served login versions and copy CSS were checked on both listeners.

Delivery: Borkeo-EMR-v49.9.0-api-copy-update.txt. Unrelated .vscode work,
databases, backups, uploads, .env, keys and .gitignore are not staged.

## Normal-list remote search and local registration - v50.0.0

Owner reported API-connected Patient ID search returned no patient and identified
the exact page as http://localhost:3002/patient-list. Read-only diagnostics found
both connections/search permissions enabled, Borkeo 22 local records and receiver
0. The local patient list did not search connected hospitals, and remote lookup
omitted case/visit numbers. The owner requested registration/admission using a
patient already registered at the other hospital.

This release adds an explicit facility-selected API search panel to the normal
patient list, improves Health ID/case/phone matching (including Khmer digits and
dash/space variations), and adds a role-restricted local-registration handoff to
both remote-search UIs. A user-bound 30-minute draft prefills identity only; the
normal editable Registration view creates a distinct local visit with its own
case number. New/Old Case uses only local visit history. Staff complete required
local questions and use normal triage/payment/admission before clinical work.
Source notes, prescriptions, signatures, eligibility, discharge and beds are not
imported. Source and previous local records remain unchanged. Token consumption
is atomic with patient creation and rejects reuse, expiry, role/user changes,
identifier tampering and revoked peers. Server-owned provenance is retained.

Baseline 26ca41891aa0c17629ea79d4d8778eefcef1de5d (49.9.0); clean backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.9.0-26ca4189-3a61d45e.
Receiver baseline 49.8.0 archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-network-registration-20261029.
See NETWORK_REGISTRATION_V500_VALIDATION.md for pre-install SQLite backups and
workflow details. Version advances across the owner's minor-step boundary to
50.0.0; old tests that capped releases at 49.x were corrected, and saved-card
test context includes the new draft state.

All 1,080 tests and Khmer validation pass in disposable
borkeo-restored-code-jBgRZS. The real patient-list/API/register/save/card-preview
browser workflow passes for New Case and a later Old Case; desktop/mobile
screenshots reviewed. Existing connections, copy key, read-only medical/nursing
history and doctor messaging browser checks pass. No synthetic patient or draft
was added to the real installations.

Installed primary 50.0.0 PID 35476 and independent receiver 49.9.0 PID 37084 using
their original hidden launch commands and environment/data paths. The owner's
manually approved API keys and permissions are preserved; no pairing/bootstrap
or disconnection was performed. Served versions/assets and unauthenticated draft
denial were verified. A real read-only provincial-to-Borkeo lookup succeeds by
Patient ID and a different visit ID; only success flags were printed, with no
patient contents displayed or local import performed.

Final activation-preservation.json verifies 96 pre-existing non-audit/non-nonce
tables remain equivalent (except existing bootstrap metadata/Superuser salt and
session last-seen normalization). One pending Borkeo request snapshot gained
created_by/updated_by fields during the existing startup refresh; those values
were checked against the unchanged patient row, and every prior snapshot value
and request decision/state remains equivalent. Patients remain 22 and 0, signing keys/grants
match, new draft tables are empty, integrity OK. Keep live databases, keys,
uploads, .env, .gitignore and unrelated .vscode work out of Git.
Delivery: Borkeo-EMR-v50.0.0-patient-search-registration-update.txt.

The separate API-page proposal (remote verified facility labels, connection
success popup, professional table borders, and one NPCA/other-hospital page) was
discussed but is not represented as implemented by this focused search fix.
No live NPCA connectivity/certification or new unauthenticated hospital enrolment
endpoint is claimed.

## Topbar remote search and styled read-only review - v50.1.0

Approved update moves connected-hospital patient lookup into the global top bar
and removes the separate search panels. Results show source facility, View and
role-restricted local registration. Existing user-bound single-use registration
drafts still use normal local admission and this hospital's New/Old Case rules.
No source medical notes/orders are imported or editable remotely.

Protected /connected-record reconstructs dated source OPD/IPD/nursing records
with original template classes and application-owned shared CSS/source theme.
Scripts and event handlers are removed; controls remain disabled in a sandboxed
iframe. Other page CSPs remain unchanged. Original KhmerOS Siemreap, Muol and
Muol Light fonts are bundled locally with notices/licenses and hashes.

Clean baseline 50.0.0 commit 1603850a9fdbf9a404a79fe2661ddd7f910c0cdd;
code backup C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.0.0-1603850a-55f33805.
Receiver 49.9.0 backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-topbar-fonts-20261029.
See TOPBAR_RECORD_FONTS_V501_VALIDATION.md for online SQLite backups and evidence.

All 1,080 tests and Khmer check pass in disposable borkeo-restored-code-Wm3FA4.
Edge verifies New/Old registration, normal save/card preview, source preservation,
dated read-only review, no enabled controls/scripts, font loading and messaging.
Firefox loads all three font faces. Desktop/mobile screenshots were reviewed;
mobile dropdown clipping was corrected. Safari is not claimed tested.

Installed primary 50.1.0 PID 25460, receiver 50.0.0 PID 19708 with their original
hidden launch commands. All 97 pre-existing non-audit/non-nonce tables compare
equivalent: patient rows, workflow snapshots, API keys and grants remain exact,
with existing metadata/Superuser startup rehash/session timestamp normalization
and append-only access-log events. Patients remain 22 and 0; integrity OK.
No automatic pairing, key reset, synthetic real registration or data import.

Delivery: Borkeo-EMR-v50.1.0-topbar-record-fonts-update.txt. Font payloads use
base64 with decoded-byte SHA-256 values; text is UTF-8/LF. Preserve .vscode,
.gitignore, live databases, secrets, backups and uploads. Broader NPCA/API-page
proposals remain separate work; this update does not claim those completed.

## Search helper cleanup - v50.2.0

Owner explicitly approved removing the gray helper message below the global
search facility selector. Selector and loading/error status remain. Existing
View and Register at this hospital buttons are retained for authorized staff;
normal local new/old registration and source-record read-only rules are unchanged.
Browser verification now explicitly asserts successful search leaves no helper
text and still completes new and returning local registrations.

Clean baseline 50.1.0 commit 048a516b0a5fcdb212ef5b8c897fed0de8f8fc5e;
backup C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.1.0-048a516b-ef8675af.
Receiver baseline 50.0.0 backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-search-cleanup-20261029.
See SEARCH_CLEANUP_V502_VALIDATION.md for online SQLite backups and evidence.
All 1,080 tests, Khmer check and synthetic browser registration pass in
borkeo-restored-code-MTwIaZ; desktop/mobile screenshots reviewed.

Installed primary 50.2.0 PID 17992 and receiver 50.1.0 PID 34776 using original
hidden launch commands. All 97 pre-existing non-audit/non-nonce tables compare
equivalent with known startup metadata normalization/append-only access events.
Patient records, snapshots, API keys/grants remain exact; patients 22 and 0,
integrity OK. No automatic pairing, real registration or clinical import.
Delivery: Borkeo-EMR-v50.2.0-search-cleanup-update.txt, JSON UTF-8 payloads with
byte counts and hashes. Preserve unrelated .vscode and all live data/secrets.

## Typed automatic API search and private staff network - v50.3.0

Owner approved removing the topbar facility selector and searching all permitted
peers automatically, default Patient ID with separate name, phone, other ID and
fingerprint choices. Implemented typed local/API lookup with existing identity
access, field isolation, normalized matching, bounded peer concurrency and source
labels. Register still uses the normal user-bound local registration/admission;
remote history remains read-only. Typed API calls require a signed capability so
older peers cannot silently fall back to unrestricted all-field matching.

Renamed network sidebar/page to the owner's Khmer label. Two sections show API
connections/status and hospital-selected active chat-eligible staff with roles
and wards. Doctors/ward chiefs/nurses/midwives can privately send and receive PDF,
PNG or JPEG attachments: max 3 files, 512 KiB each, 1 MiB total. A new indexed
attachment BLOB table stores files atomically with messages; signed transport,
exact retries, file validation, participant-only downloads and revoked grant
checks apply. No public file path, raw attachment in list responses, or new
clinical editing permission. Existing doctor-only assertions were updated only
for the explicitly approved nurse messaging access; new isolation tests added.

No scanner/SDK/model was supplied: search and registration explain unavailable
fingerprint hardware, enrollment is disabled and no biometric data is collected.
Actual enrollment, cross-ward capture and API matching remain pending compatible
hardware/SDK. Do not claim working fingerprint matching.

Clean baseline 50.2.0 commit 04c09a43b6ffdaa65e93f267c2c4c4dfee5d9ae4;
backup C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.2.0-04c09a43-da8f11d3.
Receiver baseline 50.1.0 archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-network-search-chat-20261029.
See NETWORK_SEARCH_CHAT_V503_VALIDATION.md for online database backups/details.

All 1,082 tests and Khmer check pass in borkeo-restored-code-ChkFe1. Synthetic
Edge workflows verify typed remote name/phone/other-ID lookup, default ID/no
facility selector, pending fingerprint UI, New/Old registration, saved-card
preview, read-only styled histories, staff/ward directory and doctor-to-nurse
attachment delivery/download on desktop/mobile. API tests verify private nurse
messages/files, invalid formats/size/path, exact retries and revocation. Eleven
reviewed Khmer strings have approval/provenance; baseline/.gitignore unchanged.

Installed primary 50.3.0 PID 3860, receiver 50.2.0 PID 29752 using original hidden
launchers. All 97 existing non-audit/non-nonce tables compare equivalent with
known startup metadata normalization/append-only access events. Patient rows,
snapshots, keys/grants exact, patient counts 22 and 0, integrity OK. New attachment
tables empty. No pairing, real message/patient fixture or data import performed.
Delivery: Borkeo-EMR-v50.3.0-network-search-chat-update.txt, verified UTF-8/LF JSON
payloads and hashes. Preserve .vscode and all live data/secrets. Broader NPCA
proposals remain separate; this release does not claim NPCA certification.

## Submitted search, separate results and QR camera - v50.4.0

Owner approved main Patient ID search on Enter/Search, QR/fingerprint/advanced
icons, and a separate results popup with View and authorized Admit actions.
Typing/focus no longer issues patient queries. Advanced mode opens its own native
dialog for name/phone/ID/other ID. Local/all permitted peer results append as they
arrive; close aborts browser requests and invalidates late replies. Mobile header
uses a second row so input/icons remain visible. Admission retains the normal
local New/Old registration/admission workflow; source clinical records stay read-only.

New submitted searches use CSRF-protected POST bodies and normalized exact
identifier/phone/other-ID matching; names use prefix matching. Signed exactSearch
capability prevents older peers from silently broadening searches. Legacy GET
partial lookup stays compatible. No million-patient indexing or remote-HTTPS
deployment is included; a custom-function index experiment was rejected by the
maintenance-script checks and never installed on a live database.

The QR decoder is pinned jsQR 1.4.0, Apache-2.0, locally bundled after registry
SHA-512 verification; provenance/license and LF-canonical SHA-256 are included.
Frames stay in-browser. Plain patient-card QR automatically submits and opens
results, never admission. Camera stops on detection, close, page hide/navigation;
invalid codes and camera errors have Khmer feedback. Protected HTML permits
self-only camera/media; login/API/print-preview stay camera-disabled, microphone/
USB/geolocation remain disabled. Existing script/style CSP rules are unchanged.
Phone camera needs HTTPS and permission; S22 hardware acceptance remains pending
an approved HTTPS setup. Fingerprint enrollment/matching still needs hardware/SDK.

Clean baseline 50.3.0 commit 4337ce770697f4205a1f17b02221b99f3fa0ccb5;
backup C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.3.0-4337ce77-4538c0d4.
Receiver 50.2.0 archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-search-popup-20261029.
See SEARCH_POPUP_QR_V504_VALIDATION.md for online SQLite backups and evidence.

All 1,085 tests and Khmer validation pass in borkeo-restored-code-fjeWy3.
Three Edge workflows verify native results/advanced dialogs, no typing requests,
actual generated QR pixels through a synthetic video stream, automatic results,
no auto-admission, invalid links, stopped tracks, denied camera, mobile icons,
New/Old registration/save/card, read-only histories and private nurse attachments.
Screenshots reviewed. An existing startup lock race was fixed by moving the same
5000 ms busy_timeout before journal_mode; a real child-process lock test passes.
Ten reviewed Khmer strings have approval/provenance; baseline/.gitignore unchanged.

Installed primary 50.4.0 PID 17632, receiver 50.3.0 PID 16060, original hidden
launchers. All 98 pre-existing non-audit/non-nonce tables compare equivalent after
known startup metadata normalization/append-only access events. Patient rows,
workflow snapshots, attachments and API keys/grants exact; patients 22 and 0,
integrity OK. No rejected indexes, pairing, real patient fixture or data import.
Delivery: Borkeo-EMR-v50.4.0-search-popup-qr-update.txt. UTF-8/LF JSON payloads
include verified hashes and third-party license/provenance. Preserve .vscode,
live databases, uploads, backups, passwords, .env and other secrets.

## IPD SOAP and pregnancy history - v50.5.0

Owner explicitly approved coding the IPD cleanup, pregnancy history and manual
Medscape reference after confirming that no licensed API was available. No
automatic Medscape CDS, credential storage or external clinical-data request.
Drug catalogue, stock, pricing, dose and interaction tables remain unchanged.

IPD chart tabs, visual SOAP grouping, preliminary diagnosis, EWS panel, active
problem panel and extra ICD detail are hidden; historical values remain. ICD
choices use separate rows, actions scroll horizontally. The editable local SOAP
draft uses documented current-visit sources; manual text remains protected until
explicit regeneration. Past/current pregnancy are separate, unknown by default.
Eight IPD vital fields copy triage initially and can be updated by authorized
doctors/nurses without changing triage. Ward/version/CSRF/discharge/correction
checks and audit/editor history apply. Remote history retains its styled,
script-free read-only view including saved SOAP and pregnancy fields.

Baseline master 50.4.0, 8272cbb65387da67fdbdb805bfb78fde85d12f44. Clean backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.4.0-8272cbb6-24c525ee.
Receiver 50.3.0 baseline code archive/manifest:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-ipd505-20261029.
Online DB backup paths and details: IPD_SOAP_HISTORY_V505_VALIDATION.md.

Disposable borkeo-restored-code-8Ha2fM: final 1,087/1,087 npm tests and Khmer
check pass. Three relevant browser workflows pass, including normal physician
Save/reopen of pregnancy/manual SOAP, nurse vital-only save, original triage
preservation, stale/wrong-ward/discharged/CSRF failures, remote styled history
and actual IPD print snapshot/PDF. Screenshots and PDF are synthetic only.
Physical-printer acceptance and licensed Medscape integration are not claimed.
Combined delivery: Borkeo-EMR-v50.5.0-ipd-soap-history-update.txt.

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

## IPD display cleanup - v50.6.0

Owner approved hiding the medicine inline notice, special/protocol-add controls
and IPD Set as main control; simplify ICD-10 rows; pregnancy history only for
known females older than 13 completed years. Saved data, primary flags, actual
allergy/interaction/overdose alerts and existing treatment remain intact.
The same visibility rule applies to script-free review and print; hiding never
clears history. Unknown/null loading state is hidden safely.

Baseline master 640fc1bf41dde8e3da281297d29efec6e04b19e5, 50.5.0. Backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.5.0-640fc1bf-cff45fc1.
Receiver 50.4.0 code backup: D:\EMR\Borkeo_EMR_Code_Backups\clone-before-ipd506-20261029.
See IPD_CLEANUP_V506_VALIDATION.md for online database backups and details.
Disposable synthetic root: borkeo-restored-code-omzjZa.

Final validation: 1,088/1,088 automated tests and Khmer check pass. The
synthetic browser workflow passes female age 13/14, male and unknown visibility,
retained hidden history, preserved primary diagnosis, hidden notice/protocol
controls, desktop/mobile rows, print-media hiding, script-free remote rendering
and active real allergy evaluation. Patient record JSON remains unchanged.
The new null loading-state boundary is covered by automated tests.

Delivery: Borkeo-EMR-v50.6.0-ipd-cleanup-update.txt. Preserve .vscode, .gitignore,
all hospital data, uploads, passwords, API keys/grants and private settings.

Installed primary 50.6.0 PID 26692 at http://127.0.0.1:3001 and receiver
50.5.0 PID 31804 at http://localhost:3002 with the original hidden launchers.
Health, visible versions and final assets pass on both. All 98 pre-existing
non-audit/non-nonce tables compare equivalent to the online backups, with
known startup metadata/session normalization only; no new snapshot provenance
change. Exact patient rows, clinical content, attachments and API keys/grants
are preserved. Patients remain 22 and 0; integrity OK. No automatic connection,
patient import or schema migration. Desktop/mobile diagnosis screenshots were
reviewed after dismissing the verified actual allergy warning in the synthetic
fixture; allergy evaluation and alerts remain active.

## Colored IPD SOAP and fully readable examination text - v50.7.0

Owner explicitly approved all pending changes with "yes code it" and "code all
the thing we have talked": hide the IPD resuscitation-status box, wrap/expand
long examination text and use four colored concise SOAP editors. No clinical
source data, status/API, permissions, drug catalogue or PMRS2 logic is removed.

Blue S, green O, amber A and red P use transient editors backed by the existing
canonical SOAP text/manual flag. Manual notes remain protected; saved historical
notes are not regenerated in read-only view. Only fully documented known-normal
systems become normal. Mixed systems retain non-template findings; partial and
unassessed systems are never asserted normal. Unrecognized free text is kept
verbatim for clinical review. Numeric GCS facts remain with abnormal status.
Narrative examination fields retain IDs/scopes/frozen indexes/migration keys,
wrap at full available width and stack on mobile. Read-only remote/print views
use the same cards and full text, with script-free escaped clinical content.

Baseline master 0bf6c03cd620125177f9351cfedb87a55157730a, primary 50.6.0.
Clean code backup C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.6.0-0bf6c03c-2269c53d.
Receiver 50.5.0 archive: D:\EMR\Borkeo_EMR_Code_Backups\clone-before-ipd507-20261029.
Online DB backups and details: IPD_COLORED_SOAP_V507_VALIDATION.md.
Disposable synthetic root: borkeo-restored-code-6Qqwol.

Final validation: all 1,091 automated tests and Khmer check pass. All three
final Chromium workflows pass: new SOAP/wrapping/save/reopen/remote/print-PDF,
doctor/nurse vital editing with original triage preservation and manual SOAP
protection, and structured clinical summary/prescribing safety with stale-override
rejection. Read-only saved SOAP is verified against accidental regeneration.
New narrative textareas restore legacy auto keys and save full values under
their original medical IDs. Clinical-summary data remain present while the
requested IPD status box is hidden. Synthetic desktop/mobile screenshots were
reviewed; two browser workflows generated actual IPD print snapshots and PDFs.
Evidence remains in .validation-ipd507, .validation-ipd505 and test logs in the
disposable root. No physical-printer acceptance is claimed.

Delivery: Borkeo-EMR-v50.7.0-ipd-colored-soap-update.txt. Preserve .vscode,
.gitignore, all hospital data, uploads, passwords, API keys/grants and settings.

## Head-to-toe examination follow-up

The owner additionally requested a clean professional head-to-toe layout and
explicitly asked to continue. This remains part of the same uncommitted 50.7.0
update. Existing controls are moved into ten numbered sections: general condition
with pain, head/neck, respiratory, cardiovascular, abdomen, genitourinary, limbs
with CRT, musculoskeletal, neurological with GCS, and other findings. Per-system
normal-fill actions are retained and disabled in read-only contexts. No new
clinical findings, mandatory fields, assessment thresholds or data migration.
The shared formatter follows the same anatomical order; source values, IDs,
scopes, frozen indexes and migration keys are preserved. Desktop/mobile browser
checks confirm section order, normal-fill actions, storage restoration, full text,
SOAP editing, Save/reopen, historical view, script-free remote review and print.
Final shared asset cache is 5071; package versions remain 50.7.0 and 50.6.0.

Final combined results after the head-to-toe follow-up: 1,092/1,092 automated
tests and Khmer check pass. The expanded head-to-toe browser workflow passes
section order, retained normal actions and original controls, legacy storage-key
restoration, multiline full text, manual SOAP protection, Save/reopen, read-only
records, script-free remote rendering and actual print/PDF. Desktop and mobile
numbered-section screenshots were reviewed. Earlier three role/safety workflows
remain documented above; all source changes are included in this one release.

Live preservation checks identified two authenticated DOCTOR browser saves on
one existing primary encounter while the update was running, one resulting
staff-task completion and a pending admission snapshot refresh through existing
logic. These legitimate edits and their editor history were retained. The
receiver also had one audited browser work-context switch. Across all 98
pre-existing non-audit/non-nonce tables, all unrelated clinical data, identities,
attachments, approval decisions and API keys/grants remain equivalent to the
online backups, allowing known startup metadata/session timestamp normalization
only. Patients remain 22 and 0; database integrity is OK. No rollback, data import
or automatic connection was performed. Verification uses read transactions
and checks the corresponding audit records rather than discarding user edits.

Final activation: primary 50.7.0 PID 33632 at http://127.0.0.1:3001 and
receiver 50.6.0 PID 22588 at http://localhost:3002, using original hidden
start-wifi launchers. Both health endpoints, visible versions, head-to-toe
module/styles at cache 5071 and unauthenticated vital-write denial (401) pass.
Final preservation verification passes across 98 tables with the audited user
saves/context switch retained as described above. No source, patient or
connection rollback was performed.

## Clean IPD physical examination form - v50.8.0

Owner asked for a clean, professional physical examination filling form and
confirmed the proposed layout with "yes" (GCS total remains manual). The ten
numbered sections now use a label column with boxed fields, left/right eye and
ear on one row, compact pain/CRT/GCS boxes and pill choices, without list dots
or trailing colons. Controls are moved with their IDs, storage keys, frozen
indexes and migration keys; captions remain the previous sibling of each control
so SOAP Objective wording is unchanged. Presentation only: no data migration,
new Khmer text, or clinical/pharmacy/laboratory/financial logic change.

Baseline master 5a041e889f07f9cc32551ff70afada4efab269fa, package 50.7.0.
Clean code backup C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.7.0-5a041e88-058fedfb.
Shared cache 5080. Validation: 1,092/1,092 tests and Khmer check pass; IPD
browser workflows pass. Details: IPD_EXAM_FORM_V508_VALIDATION.md.
Delivery: Borkeo-EMR-v50.8.0-ipd-exam-form-update.txt. Running servers were not
restarted by this update.

## PMRS2 -> Borkeo registration import (Stage 1) - v50.9.0

Owner approved ("yes code it") integrating the PMRS2 site (pmrs.digitalsp.gov.kh)
with Borkeo. PMRS2 gives the owner no API, so the agreed design is a browser
helper with staff logging in to PMRS2 themselves. The owner asked to auto-fill the
Google Authenticator code to auto-login; declined (defeats 2FA on a government
system, likely breaks its rules) - login stays manual. Both directions agreed,
built one stage at a time; this is Stage 1 (PMRS2 identity/address -> Borkeo
registration). Stage 2 (Borkeo OPD -> PMRS2 OPD/triage/prescription/discharge) is
next and NOT in this version.

Built: public/pmrs2-import.mjs exposes window.applyPmrs2Registration(payload) -
fills the registration form, resolves Khmer province/district/commune/village to
the gazetteer via window.restorePatientAddress, and flags duplicates via
/api/emr-network/local-search (health-card, then phone, then name). Never saves.
pmrs2-helper/ is an MV3 browser extension: a button on PMRS2 scrapes identity by
Khmer captions and opens Borkeo registration (/emr?view=register&pmrs2Import=1)
pre-filled; it stores no PMRS2 credentials. The helper's Khmer is excluded from
the EMR Khmer baseline (khmer-lib.mjs SKIP_DIRS) as it is not EMR UI text.

Baseline master 142ca91c21302f73859304e755fd90dbe43bed43, package 50.8.0. Clean
code backup C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.8.0-142ca91c-c8d6afb5\code.zip
(the ZIP the owner asked to reserve for rollback). Shared cache 5090.

Validation: 1,098/1,098 tests and Khmer check pass; new unit test
(tests/pmrs2-import.test.mjs) and Chromium test (tests/pmrs2-import-browser.mjs)
pass - registration fill, province code 08 + hierarchy resolution, duplicate
flag, extension event hand-off, and scraper against a caption-built form. Filled
registration screenshot reviewed. The extension was NOT run against the live
PMRS2 site; its captions live in pmrs2-helper/pmrs2-fields.js for tuning.
Delivery: Borkeo-EMR-v50.9.0-pmrs2-import-update.txt. Running servers were not
restarted by this update.
