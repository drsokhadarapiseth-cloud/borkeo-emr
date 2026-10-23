# ANC Khmer to confirm (v42.6.0)

The Khmer of the official ANC record (pages 2-5) was transcribed from the page
images in `borkeo-update-files/anc/moh-2026-pages/` into
`server/catalogues/anc-record-labels.json`. The colour chart and the visit
schedule were copied unchanged from `anc-color-chart.json` and
`anc-visit-schedule.json`. Please check the words below against the paper
record; correct them in `server/catalogues/anc-record-labels.json` (the page
reads them from there) and in `docs/approved-source-khmer.json`.

## Label chosen without a source (owner instruction)

| Where | Khmer used | Meaning |
|---|---|---|
| Triage service choice, vaccination page title | ចាក់វ៉ាក់សាំង | Vaccination (free, by the midwife) |

## Words not read with certainty on the page images

| Page | Label key | Khmer used | Doubt |
|---|---|---|---|
| 2 | previous.complicationList 2 | បេរីណេមានស្នាមថ្មេរ មានផ្លែ ដុះសាច់/សិរមាន់ | The image reads "បេរីណេ"; the colour chart writes "ប៉េរីណេ". |
| 2 | previous.complicationList 9 | ធ្លាប់មានកូនកើតមកមានទំងន់ទាបធៀបនឹងអាយុគភ៌ | Small print: "ទំងន់" (the rest of the record writes "ទម្ងន់") and "នឹង" / "និង". |
| 2 | allergy.title | ប្រវត្តិអាល្លែកហ្ស៊ីថ្នាំ៖ | Spelling "អាល្លែកហ្ស៊ី" as on the image (the EMR elsewhere writes "អាលែកហ្ស៊ី"). |
| 2 | family.items.mental | ការយឺតយ៉ាវបញ្ញាស្មារតី | Small print. |
| 2 | gyn.cycle / gyn.duration | វដ្តរៀងរាល់ … ថ្ងៃ ចំនួនថ្ងៃ …/ប្រចាំខែ | Dotted line between the words; exact order of the words. |
| 2 | violence.title | កត្តាប្រឈម អំពើហិង្សាពាក់ព័ន្ធសុខភាពបន្តពូជ ផ្លូវភេទ និងយេនឌ័រ៖ | Bold small print. |
| 2 | identity.bmiNormal | (ទម្ងន់ធម្មតា 18.6-24.9) | The record prints 18.6; the colour chart uses 18.5. The colour code uses the chart (18.5). |
| 3 | labs.hct | - អេម៉ាតូគ្រីត HCT | Small print. |
| 3 | ultrasound columns | ទម្រង់បង្ហាញ · ក្បាលកូន · ទីតាំងសុក · ទឹកភ្លោះ · ទម្ងន់កូន | Underlined column headers. |
| 3-5 | visits column varices | ឡើងសរសៃវ៉ែន/ហើម | Three short lines in the header ("ឡើង / សរសៃ / វ៉ែន/ហើម"). |
| 3-5 | visits column diagnosis | មូលវិចារ (រោគវិនិច្ឆ័យ និងអន្តរាគមន៍) | The words in brackets are very small. |
| all | footer | ការិយាល័យគិលានុបដ្ឋាក និងឆ្មបនៃនាយកដ្ឋានសេវាសុខភាព ឆ្នាំ២០២៦ | Small print at the bottom of each page. |

## Notes on the official files (copied unchanged)

- `anc-color-chart.json`: twins are in both yellow and red; the EMR uses red
  (owner default, `levelOverrides` in `server/clinical-options.json`).
- The chart says "BMI ធម្មតា (18.5-24.9)" while the record page prints 18.6.

## Other new Khmer

Every other new Khmer text of this update (buttons, messages, the to-do panel,
the vaccination page, the referral letter) is listed in
`docs/translations-needed.csv` with "draft Khmer, owner to review" in the
context column. Change the khmer column there and run `npm run translations:apply`.
