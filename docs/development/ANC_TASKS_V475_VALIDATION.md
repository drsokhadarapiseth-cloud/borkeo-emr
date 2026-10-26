# ANC to-do list ticked from the data v47.5.0

Approved update (owner said "yes code it" on 26 October 2026). Only the ANC
record page changes. Base master 64d2bff (47.4.0); branch
feature/maternity-anc-task-auto-done.

## What changed

The "to do at this visit" list (and the overdue list) now ticks a task, locked,
when the data exists. Rules: `taskAction` / `taskDoneByData` in
public/anc-engine.mjs. "This visit's weeks" = from the first to the last week
of the scheduled visit (by the EDD), or today.

| Task | Done when |
|---|---|
| ANC record, digital system, "*create the file" | always (the record exists) |
| Weight / weight gain | today's weight > 0 |
| Height, BMI | height on page 2; BMI can be calculated |
| Vital signs | today's BP, pulse, temperature and SpO2 (owner choice) |
| FHR, fundal height, presentation | today's value |
| Urine | today's proteinuria or glucosuria (unchanged) |
| Anaemia | visit 1: the three page 2 anaemia answers; later: today's Hb or an Hb in the visit's weeks |
| Breast, mouth and teeth | page 2 answers |
| Dating ultrasound (visit 1) | an ultrasound row, or ultrasound EDD + scan date |
| Other ultrasounds | an ultrasound (typed or Imaging) dated in the visit's weeks |
| CBC 2, blood check before delivery | an Hb result dated in the visit's weeks (fix: CBC 2 was ticked by the first Hb) |
| OGTT | a released glucose result (Lab codes OGTT, GTT or GLU) in the visit's weeks |
| Iron / folic acid | today's iron field > 0 (sending iron to Pharmacy fills it) |
| Tetanus vaccine | a dose recorded in the visit's weeks, or the tetanus field "complete" |
| Education (all) | the new "Education given" tick box of that visit (saved as `educationDone`) |
| HIV, Syphilis, Hepatitis B, blood group, CBC (visit 1) | unchanged |

Still manual: the two paper books, "*additional examination", post-term
management over 41 weeks. Overdue tasks of an earlier visit use the visit saved
within that visit's weeks. The count updates while staff type.

## Backup and data preservation

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.4.0-64d2bff5-17922394
(commit 64d2bff571763c62c5eb691af481ae5c7d5b9475)

Restore with `npm run restore:code -- "<backup-directory>"` into a NEW folder.
No database migration. Hospital data, uploads, backups, password exports and
.env are untouched.

## Verification

- tests/v475-anc-task-auto-done.test.mjs: 9 tests (every rule, the CBC 2 fix,
  OGTT, ultrasound windows, tetanus, overdue, page and server wiring).
- Explicit browser check (headless Edge, in-memory database, synthetic
  patient): 6/21 tasks done at opening from Registration/Triage (records,
  weight, height, BMI, vital signs); typing FHR and ticking "Education given"
  makes 8/21 live; no JavaScript errors.
- Full `npm test` and `npm run check:khmer` results are in the update TXT.
