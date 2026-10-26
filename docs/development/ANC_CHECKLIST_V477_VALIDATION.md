# ANC to-do list as a clean checklist v47.7.0

Approved update (owner said "yes" to the v47.7 proposal on 26 October 2026,
keeping the orders next to their fields). Only the ANC record page changes.
Base master 3b255d5 (47.6.0); branch feature/maternity-anc-clean-checklist.

## What changed

- The "to do at this visit" list shows only a tick box and the task text,
  grouped under Records / Laboratory / Examination / Ultrasound / Care
  (ឯកសារ · មន្ទីរពិសោធន៍ · ការពិនិត្យ · អេកូសាស្ត្រ · ការថែទាំ), in 3 / 2 / 1
  aligned columns. No buttons and no cards. Done tasks: green tick, grey text
  (not crossed out); closed tasks: amber text with the reason; overdue: red.
- Clicking the text opens the section of the field where the task is filled,
  scrolls to it, puts the cursor in it and highlights it (TASK_TARGETS in
  public/anc-record.js). Tasks without a field (paper books, additional
  examination, post-term management) tick their box when the text is clicked.
- Tick box: data tasks tick themselves (green, locked). Ticking a data task by
  hand opens the reason window (no test / refused / done elsewhere / other),
  which replaces "close without doing"; Cancel leaves it unticked. Ticking the
  education task also ticks today's "education given" box. Manual tasks: a
  tick means done; unticking a done or closed task reopens it.
- The order actions moved next to their fields: Laboratory order beside
  Hepatitis B, ask a doctor beside CBC and blood group, an OGTT line under the
  laboratory table, Imaging order beside the ultrasound title, add iron to the
  prescription beside the iron field, open the vaccination beside the tetanus
  field. They are not printed.
- The task text is a link (`<a>`), not a button, because the shared button
  style in shared-controls.css (!important) would draw it as a button.

## Backup and data preservation

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.6.0-3b255d52-bfb4f9f6
(commit 3b255d52bfe6a764735760390e8b8dcd203fadbc)

Restore with `npm run restore:code -- "<backup-directory>"` into a NEW folder.
No database or data change; task states are saved as before.

## Verification

- tests/v477-anc-clean-checklist.test.mjs: 5 tests. The v42.6 browser
  regression now closes a task by ticking a data task (reason window).
- Explicit browser check (headless Edge, in-memory database, synthetic
  patient): no button in the list; five headings; clicking FHR, HIV, anaemia
  and the dating ultrasound opened the visit, tests, pregnancy and tests
  sections with the cursor in the right field and the highlight; ticking HIV
  opened the reason window and Cancel left it unticked; the maternal health
  book ticked done; the education task ticked today's box; a data tick could
  not be unticked; all 7 order buttons are next to their fields; no
  JavaScript errors. Screenshot reviewed.
- Full `npm test` and `npm run check:khmer` results are in the update TXT.
