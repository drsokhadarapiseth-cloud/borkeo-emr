# Approved changes to existing Khmer labels

The only approved change is removing a leading section number ("I. ", "II. ",
"១. ", "២. " ...) when a label is placed inside a SOAP box. The text after the
number stays exactly the same.

`npm run check:khmer` reads the table below. A baseline string may disappear
only if it is listed here in the `before` column and its `after` text (the same
text without the number) exists in the project.

| file | line | before | after |
|------|------|--------|-------|
| protected/EMR.html | 7705 | ១. សញ្ញាជីវិត | សញ្ញាជីវិត |
| protected/EMR.html | 7574 | ២. មូលហេតុចូល: | មូលហេតុចូល: |
| protected/EMR.html | 7580 | ៣. ប្រវត្តិជំងឺបច្ចុប្បន្ន: | ប្រវត្តិជំងឺបច្ចុប្បន្ន: |
| protected/EMR.html | 7586 | ៤. សញ្ញាតម្អូញផេ្សងទៀត: | សញ្ញាតម្អូញផេ្សងទៀត: |
| protected/EMR.html | 7598 | ៥. ឱសថដែលកំពុងប្រើព្យាបាល: | ឱសថដែលកំពុងប្រើព្យាបាល: |
| protected/EMR.html | 7604 | ៦. សាវតារោគ | សាវតារោគ |
| protected/EMR.html | 7736 | ៧. ការពិនិត្យរាង្គកាយ: | ការពិនិត្យរាង្គកាយ: |
| protected/EMR.html | 15620 (KH dictionary) | ១. សញ្ញាជីវិត | សញ្ញាជីវិត |
| protected/EMR.html | 15621 (KH dictionary) | ២. មូលហេតុចូល: | មូលហេតុចូល: |
| protected/EMR.html | 15621 (KH dictionary) | ៣. ប្រវត្តិជំងឺបច្ចុប្បន្ន: | ប្រវត្តិជំងឺបច្ចុប្បន្ន: |
| protected/EMR.html | 15621 (KH dictionary) | ៤. សញ្ញាតម្អូញផេ្សងទៀត: | សញ្ញាតម្អូញផេ្សងទៀត: |
| protected/EMR.html | 15621 (KH dictionary) | ៥. ឱសថដែលកំពុងប្រើព្យាបាល: | ឱសថដែលកំពុងប្រើព្យាបាល: |
| protected/EMR.html | 15621 (KH dictionary) | ៦. សាវតារោគ | សាវតារោគ |
| protected/EMR.html | 15623 (KH dictionary) | ៧. ការពិនិត្យរាង្គកាយ: | ការពិនិត្យរាង្គកាយ: |
| protected/EMR.html | 7383 | I. ប្រវត្តិជំងឺ | ប្រវត្តិជំងឺ |
| protected/EMR.html | 7421 | II. ពិនិត្យរាងកាយ | ពិនិត្យរាងកាយ |
| protected/EMR.html | 7454 | III. ពិនិត្យអមគ្លីនិក | ពិនិត្យអមគ្លីនិក |
| protected/EMR.html | 7496 | IV. រោគវិនិច្ឆ័យ ICD-10 | រោគវិនិច្ឆ័យ ICD-10 |
| protected/EMR.html | 7527 | V. វេជ្ជបញ្ជា | វេជ្ជបញ្ជា |
| protected/EMR.html | 15701 (KH dictionary) | I. ប្រវត្តិជំងឺ | ប្រវត្តិជំងឺ |
| protected/EMR.html | 15702 (KH dictionary) | II. ពិនិត្យរាងកាយ | ពិនិត្យរាងកាយ |
| protected/EMR.html | 15702 (KH dictionary) | III. ពិនិត្យអមគ្លីនិក | ពិនិត្យអមគ្លីនិក |
| protected/EMR.html | 15702 (KH dictionary) | IV. រោគវិនិច្ឆ័យ ICD-10 | រោគវិនិច្ឆ័យ ICD-10 |
| protected/EMR.html | 15703 (KH dictionary) | V. វេជ្ជបញ្ជា | វេជ្ជបញ្ជា |

## v42.3: medication units written as international units (owner's order)

The owner ordered that mg, mL, mcg, g and IU are written in the original
international units, not translated, in the medication unit lists
(protected/EMR.html unit selects and their EN/KH label table, public/pmrs-import.js).
A Khmer unit label listed here may disappear only when it is replaced by one of
these five units (scripts/khmer-lib.mjs INTERNATIONAL_UNITS). Records saved with
the old labels still open as the new units (public/medicine-units.js).

| file | line | before | after |
|------|------|--------|-------|
| protected/EMR.html, public/pmrs-import.js | unit lists | ម.ក្រ (mg) | mg |
| protected/EMR.html, public/pmrs-import.js | unit lists | ម.ក្រ | mg |
| protected/EMR.html, public/pmrs-import.js | unit lists | ម.ល (ml) | mL |
| protected/EMR.html, public/pmrs-import.js | unit lists | ម.ល | mL |
| protected/EMR.html, public/pmrs-import.js | unit lists | ម៉ៃក្រូក្រាម (mcg/µg) | mcg |
| protected/EMR.html, public/pmrs-import.js | unit lists | ម៉ៃក្រូក្រាម | mcg |
| protected/EMR.html, public/pmrs-import.js | unit lists | ក្រាម (g) | g |

## v42.5: medication routes, one table for every page (owner's order)

The owner ordered (PROMPT-1, Phase 2.5) that a new prescription line offers only
ចាក់សរសៃ (IV), ចាក់សាច់ដុំ (IM), ចាក់ក្រោមស្បែក (SC) for injections, that the old
injection choices are removed from the list, that old lines are shown as IV / IM,
and that the same labels are used everywhere a route is shown. The route labels
now live in one file (public/medication-routes.js) instead of four copies, so the
labels that stay the same are listed here with the same text before and after.

| file | line | before | after |
|------|------|--------|-------|
| protected/EMR.html | route list | សារធាតុរាវតាមសរសៃឈាម (IV) | ចាក់សរសៃ (IV) |
| protected/EMR.html | route list | អង់ទីប៊ីយ៉ូទិកតាមសរសៃឈាម (IV) | ចាក់សរសៃ (IV) |
| protected/EMR.html | route list | អង់ទីប៊ីយ៉ូទិកចាក់សាច់ដុំ (IM) | ចាក់សាច់ដុំ (IM) |
| protected/EMR.html | route list | ថ្នាំផ្សេងតាមសរសៃឈាម (IV) | ចាក់សរសៃ (IV) |
| protected/EMR.html | route list | ថ្នាំផ្សេងចាក់សាច់ដុំ (IM) | ចាក់សាច់ដុំ (IM) |
| protected/EMR.html | nursing chart | IV សារធាតុរាវ | IV |
| public/messages.js, public/pharmacy-opd.js | route labels | បញ្ចូលតាមសរសៃ (IV) | ចាក់សរសៃ (IV) |
| public/messages.js, public/pharmacy-opd.js | route labels | ក្រោមស្បែក | ចាក់ក្រោមស្បែក (SC) |
| public/messages.js, public/pharmacy-opd.js | route labels | តាមទ្វារធំ | តាមទ្វារធំ (PR) |
| public/messages.js, public/pharmacy-opd.js | route labels | ក្រោមអណ្ដាត | ក្រោមអណ្តាត (SL) |
| protected/EMR.html, public/messages.js, public/pharmacy-opd.js | route labels (one copy) | លេប (PO) | លេប (PO) |
| protected/EMR.html | route labels (one copy) | បន្តក់ | បន្តក់ |
| protected/EMR.html | route labels (one copy) | ស្រូប | ស្រូប |
| protected/EMR.html | route labels (one copy) | តាមទ្វារមាស | តាមទ្វារមាស |
| protected/EMR.html | route labels (one copy) | លាប | លាប |
