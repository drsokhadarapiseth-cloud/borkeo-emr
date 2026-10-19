# SOAP Note Clinical Terminology (Step 5.3)

This document records the official Khmer and English clinical titles, section hints, and labels used in the colour-coded SOAP note component.

## 1. Primary Section Titles & Hints

| Section | Color Token | Khmer Title (Default) | Khmer Hint | English Mode (EN) | English Hint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S** | `--color-soap-s-stripe` (Blue) | **ពាក្យបណ្តឹង និងប្រវត្តិ** | អ្វីដែលអ្នកជំងឺរាយការណ៍ (រោគសញ្ញា ប្រវត្តិជំងឺ) | **Subjective** | Patient-reported complaints, symptoms, interval history |
| **O** | `--color-soap-o-stripe` (Green) | **ការពិនិត្យ និងលទ្ធផល** | សញ្ញាជីវិត ការពិនិត្យរាងកាយ និងលទ្ធផលវិភាគ | **Objective** | Vital signs, physical examination, diagnostic results |
| **A** | `--color-soap-a-stripe` (Amber) | **ការវាយតម្លៃ និងរោគវិនិច្ឆ័យ** | រោគវិនិច្ឆ័យចម្បង លេខកូដ ICD-10 និងការវាយតម្លៃ | **Assessment** | Working diagnosis, ICD-10 code, clinical impression |
| **P** | `--color-soap-p-stripe` (Purple) | **ផែនការព្យាបាល** | ឱសថព្យាបាល ការបញ្ជាបន្ថែម និងការណែនាំ | **Plan** | Treatment orders, medications, follow-up plan |

---

## 2. Component Labels & Action Buttons

| UI Element | Khmer (Default) | English (EN) | Note |
| :--- | :--- | :--- | :--- |
| Pull Latest Results | `ទាញលទ្ធផលចុងក្រោយ` | `Pull Latest Results` | Inserts latest lab/imaging summary into Objective text |
| Copy Previous Note | `ចម្លងពីកំណត់ត្រាមុន` | `Copy From Previous Note` | Copies S/O/A/P from prior day's note with copied mark |
| Legacy Note Badge | `ចំណាំចាស់` | `Legacy Note` | Displayed on historical notes created before SOAP format |
| Required Marker | `(ចាំបាច់)` | `(Required)` | S and A sections are required before saving |
| Status Filled | `បានបំពេញ` | `Completed` | Status indicator dot when section has content |
| Status Empty | `មិនទាន់បំពេញ` | `Empty` | Status indicator dot when section is blank |
| Show More / Less | `បង្ហាញបន្ថែម` / `បង្រួម` | `Show more` / `Show less` | Expand/collapse note in feed |

---

## 3. Quick-Phrase Neutral Defaults (Khmer)

- **Subjective (S)**:
  - `អ្នកជំងឺដឹងខ្លួនល្អ គ្មានក្តៅខ្លួន`
  - `ពាក្យបណ្តឹង៖ ឈឺក្បាល អស់កម្លាំង`
  - `រោគសញ្ញាបានធូរស្រាលច្រើន`
- **Objective (O)**:
  - `សញ្ញាជីវិតមានស្ថេរភាព`
  - `ពោះទន់ គ្មានរឹង គ្មានឈឺចុច`
  - `បេះដូង និងសួតធម្មតា`
- **Assessment (A)**:
  - `ស្ថានភាពជំងឺមានការវិវត្តល្អ`
  - `រង់ចាំតាមដានលទ្ធផលឈាមបន្ថែម`
- **Plan (P)**:
  - `បន្តការព្យាបាលតាមវេជ្ជបញ្ជាដដែល`
  - `តាមដានសញ្ញាជីវិតរៀងរាល់ ៤ ម៉ោង`
  - `ត្រៀមបញ្ចេញអ្នកជំងឺនៅថ្ងៃស្អែក`
