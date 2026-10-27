# Task context for Codex, Gemini or OpenCode

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
