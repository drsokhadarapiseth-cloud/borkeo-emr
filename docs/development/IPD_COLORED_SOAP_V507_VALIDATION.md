# Colored concise IPD SOAP and expanding text - v50.7.0

Owner explicitly approved all three pending changes: remove the IPD
resuscitation-status box, show full long examination text by wrapping and
vertical expansion, and replace the flat SOAP view with four colored editable
sections that summarize normal systems and retain abnormal findings.

## Behavior and clinical boundaries

SOAP uses blue S, green O, amber A and red P cards, with Khmer default titles.
Each section is independently editable. The existing canonical
scope:medical:id:ipd_soap_summary and ipd_soap_manual fields remain the save
contract. Four visual editors are transient and do not take storage indexes.
Editing any section protects the note from subsequent automatic source updates.
Explicit regeneration still requires confirmation after manual changes. Typing
new lines does not replace the active field or reset its text. Legacy unsectioned
manual text is displayed intact in S and is not rewritten by opening a record.
Saved notes are not regenerated in read-only/historical views.

The Objective formatter uses existing clinician-selected normal examination
templates in Khmer, English and French. A complete documented system that matches
known normal template values becomes one normal line. Mixed systems omit their
normal template components and list their non-template findings with concise
component labels. Missing or partially documented systems are never inferred
normal: only documented components are described. Neurological abnormalities
retain numeric GCS facts so contradictory observations are not hidden. Pain zero
is preserved. Unrecognized free text is retained verbatim because safely
paraphrasing it requires clinical interpretation. No AI, new clinical thresholds,
diagnoses, dose calculations or external service is introduced. Clinicians must
review the draft before saving/signing. Existing PMRS2/export logic is unchanged.

Vitals remain factual measurements; repeated system headings and verbose normal
template lines are removed from the draft. Unrecorded pregnancy statuses are
omitted from the draft rather than asserted as negative findings. Existing
pregnancy visibility and saved history remain unchanged.

Narrative examination controls become full-width, automatically growing
textareas. IDs, medical scope, frozen indexes, migration keys, values and role
locks are retained. Numeric controls and prescribing tables remain unchanged.
Paired examination columns stack on mobile. Fonts, resize and input changes
recalculate field heights. Read-only views and actual print snapshots retain
full text; the script-free remote renderer uses the same conversion and cards.

The resuscitation-status box is hidden only in the IPD presentation, including
print. Status data, its authorized API and all underlying clinical decisions are
preserved. Medication safety evaluation and the existing OPD/follow-up/discharge
forms retain their behavior. No database migration is needed.

## Baseline, backups and preservation

Primary clean baseline 50.6.0, master,
0bf6c03cd620125177f9351cfedb87a55157730a. Code-only backup before edits:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.6.0-0bf6c03c-2269c53d.
Receiver 50.5.0 code-only archive and manifest:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-ipd507-20261029.
Fifteen affected existing receiver files matched the baseline with independent
version differences. Restore creates a new folder, excluding hospital data and
secrets.

Online database backups:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v507-soap-1793287765119.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v507-soap-1793287765315.sqlite

Disposable synthetic validation: borkeo-restored-code-6Qqwol. Four reviewed Khmer
titles have translation provenance; the Khmer baseline is unchanged. Preserve
.vscode, .gitignore, live databases, uploads, passwords and API keys/grants.

## Validation and delivery

Pure tests cover three template languages, complete/partial/mixed examinations,
non-template findings, contradictory neurological status/GCS, zero pain, legacy
notes and structured SOAP round trips. Browser checks cover colors, full text at
desktop/mobile widths, legacy field restoration, caret/newline behavior, manual
protection and confirmed regeneration, normal physician Save/reopen, role locks,
historical view, script-free remote review, literal markup safety, actual print
snapshot and PDF. Final results and activation checks follow after completion.

Delivery: Borkeo-EMR-v50.7.0-ipd-colored-soap-update.txt, with complete UTF-8/LF
payloads, byte counts and SHA-256. Browser/PDF evidence does not establish
physical-printer acceptance or clinical certification of the generated draft.

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
