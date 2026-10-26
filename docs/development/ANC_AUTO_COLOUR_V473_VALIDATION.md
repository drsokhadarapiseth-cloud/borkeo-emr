# ANC automatic colour code v47.3.0

Approved update (owner said "yes code it" on 26 October 2026). Only the ANC
record page changes. Base master a59ea43 (47.2.0); branch
feature/maternity-anc-auto-colour-code.

## What changed

1. Colour-code chart ("ចំណាត់ថ្នាក់ហានិភ័យ")
   - The word "ស្វ័យប្រវត្តិ" is no longer shown.
   - A box is ticked when its item applies: from Registration (age), Triage
     (height, weight, BP), this ANC record, released Laboratory and Imaging
     results, or the midwife's own tick. Green items are ticked too.
   - Boxes ticked from the data are locked (a click does nothing); the source
     value is corrected instead. They are not `disabled`, so the tick keeps its
     green / yellow / red colour. Items with no data source stay manual.
   - The chart updates while staff type (no reload needed).
   - New automatic links (public/anc-engine.mjs, AUTO table):
     - page 2 general history: diabetes, heart, thyroid, transfusion; chronic
       hypertension ticks the yellow hypertension item (severe BP stays red);
       "no chronic disease" when diabetes, heart, respiratory, hypertension and
       thyroid are all unticked;
     - previous pregnancies: delivery type vacuum; complication numbers 1-9 of
       the footnote (1 tear 3, 2 perineum, 3 varices, 4 pre-eclampsia (red),
       5 seizure (red), 6 placenta previa, 8 PPH, 9 low birth weight; 7 and 10
       have no chart item); loss after 12 weeks -> second-trimester loss;
     - ultrasound (latest scan with a value; typed and released Imaging):
       number of fetuses 1 -> singleton, 2-3 -> twins (red by the existing
       owner override); placenta previa -> red; amniotic fluid low/high -> red;
     - today's exam: presentation not cephalic at GA >= 36 weeks -> yellow
       malpresentation; FHR < 110 or > 160 -> red fetal distress; BP >= 140/90
       with proteinuria ++ or more -> red severe pre-eclampsia; from 20 weeks,
       fundal height > completed GA weeks + 3 cm -> yellow large uterus;
     - "normal course of this pregnancy" (green) when no yellow or red item
       of the current-pregnancy section applies.
   - Still manual: asthma, kidney, epilepsy, complicated diabetes, abruption,
     PROM, reduced fetal movement, growth restriction, malformation, severe
     PPH, preterm < 36 weeks, stillbirth items, malformed baby.

2. Ultrasound table: new column "ចំនួនទារក" (1/2/3); dropdowns for
   presentation (ក្បាល / គូទ / ទទឹង), placenta (ខាងមុខ / ខាងក្រោយ / បាតស្បូន /
   ចំហៀង / សុកពាំងមាត់ស្បូន) and amniotic fluid (ធម្មតា / តិច / ច្រើន); units
   in the headers: GA សប្តាហ៍, BPD mm, fetal weight ក្រាម.

3. Today's visit: fundal height "ស.ម", FHR "ដង/នាទី"; presentation dropdown;
   "ជាតិប្រៃ" renamed "ជាតិសាច់ក្នុងទឹកនោម" (- / + / ++ / +++ / ++++);
   "ជាតិផ្អែម" renamed "ជាតិស្ករក្នុងទឹកនោម" (- / + / ++ / +++).
   A value typed before v47.3 that is not in a list stays as its own option.

The official chart file server/catalogues/anc-color-chart.json is unchanged
(69 items). No database migration; saved records are read as they are.

## Backup and data preservation

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.2.0-a59ea43e-90c5620d
(commit a59ea43ee0da76296e79fba115ba4dddaf6e2e7e)

Restore with `npm run restore:code -- "<backup-directory>"` into a NEW folder.
Hospital databases, uploads, backups, password exports and .env are untouched.

## Verification

- tests/v473-anc-auto-colour.test.mjs: 9 tests for every new rule, the
  dropdown codes, the renamed labels and the unchanged official chart.
- Explicit browser check (headless Edge, in-memory database, one synthetic
  patient): age 25 from Registration ticks the green age box (locked); weight
  80 kg ticks red BMI > 30 live and turns the header red; dropdown options and
  units present; ++ protein with BP 150/95 ticks severe pre-eclampsia; FHR 180
  ticks fetal distress and a click does not untick it; one fetus ticks
  singleton; placenta previa ticks red and clears "normal course"; asthma stays
  a manual box. No JavaScript errors. Existing browser regressions
  v426-midwife-anc-browser and triage-anc-transfer-browser pass.
- Full `npm test` and `npm run check:khmer` results are in the update TXT.
