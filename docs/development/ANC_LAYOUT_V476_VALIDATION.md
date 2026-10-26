# ANC clean screen layout v47.6.0

Approved update (owner said "yes code it" on 26 October 2026, together with
v47.5). Only the ANC record page changes; screen only. Base master 52fa093
(47.5.0); branch feature/maternity-anc-clean-layout.

## What changed

- One field = one cell (`cell()` in public/anc-record.js): label on top, the
  box and its unit below; cells sit in a fixed grid of 4 columns (computer),
  2 (up to 1100 px) and 1 (up to 760 px). Boxes of a row are aligned at the
  bottom, so long Khmer labels no longer push a box down. Nothing falls under
  its neighbour; no page-wide horizontal scroll.
- Today's visit: blood pressure (mmHg) and pulse (ដង/នាទី) are two fields
  (they were one line "BP - pulse"); units for weight, weight gain,
  temperature, SpO2, fundal height, FHR, Hb; the required star stays at the
  end of the label. Rapid tests and additional visit details use the same grid.
- Page 2: identity fields in the grid (ultrasound EDD and its scan date are two
  cells); tick boxes of general, family and social history in aligned columns;
  yes / no questions in the same 4 columns on every row; gynaecology rows with
  a label column; numbered surgery / allergy rows with the same columns.
- Colour chart: one item per line, every box at the same left edge.
- To-do list: 4 / 2 / 1 columns, cards of the same height in a row, buttons
  together at the bottom of each card.
- Tables (previous pregnancies, laboratory, ultrasound): fixed column widths,
  every box fills its cell; wide tables scroll inside their box.
- Dropdown lists stay. New keys anc.bp / anc.pulse use the approved words
  សម្ពាធឈាម / ជីពចរ.

Print: the official printed record is unchanged. All new styles are inside
`@media screen`; the new wrappers in printed parts are inline spans, so the
print flow (label, value, unit) is the same.

## Backup and data preservation

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.5.0-52fa093b-067ecd0e
(commit 52fa093b15b8164ba8958f7f7ef3a9562c68f2b0)

Restore with `npm run restore:code -- "<backup-directory>"` into a NEW folder.
No database or data change.

## Verification

- tests/v476-anc-clean-layout.test.mjs (structure and screen-only styles).
- Explicit browser check (headless Edge, in-memory database, synthetic
  patient) at 1440, 1000 and 390 px for the visit, pregnancy, tests, care and
  risk sections: no misaligned box in any grid row, no box taller than one
  line, no page overflow, no JavaScript errors; screenshots reviewed. A style
  conflict (an older rule centred the cell content) was found and fixed.
- Print emulation: 2 printed pages, same text order as before.
- Full `npm test` and `npm run check:khmer` results are in the update TXT.
