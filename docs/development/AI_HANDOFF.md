# Task context for Codex, Gemini or OpenCode

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
