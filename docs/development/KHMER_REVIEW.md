# Exact Khmer change review - remaining-work continuation

Authority: D:\EMR\EMR_FINISH_REMAINING.txt (25 October 2026), Work E.
The original 67 diagnostics were 66 missing-text counts plus one new menu label.
Every missing original text is attributable to the removed patient banner except
the explicitly removed submenu label. Some first diagnostic locations misleadingly
pointed at legacy forms because the checker counts text across files. Per-file audit
confirms that those clinical forms were not changed or deleted.

The current review additionally covers four removed test-source expressions from
the completed Work A, rather than restoring obsolete test code as visible UI.
Clinical fields, allergy logic, saved keys, roles and EWS remain under behavior tests.

Classification: (a) removed banner copies; (b) removed legacy submenu, superseded by
the existing grouped sidebar; (c) necessary current labels narrowly approved below;
(d) obsolete source-code assertions, not user-facing text. No ambiguous clinical
wording or changed clinical semantics were identified in the original 67 differences.

## Evidence for each removed occurrence

| Category | File and baseline lines | Exact checker value | Evidence |
|---|---|---|---|
| a | public/patient-banner.js:414 | កាលបរិច្ឆេទ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:299 | លេខប័ណ្ណសុខភាព | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:221 | ខែ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:32,33 | ផ្នែកសម្ភព | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:31 | ផ្នែកជំងឺកុមារ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:38 | ផ្នែកធ្មេញ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:39 | ផ្នែកសុខភាពផ្លូវចិត្ត | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:34 | ផ្នែករោគស្ត្រី | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:37 | ផ្នែកជំងឺឆ្លង | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:28 | ផ្នែកពិគ្រោះក្រៅ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:281 | សម្រាកពេទ្យ (IPD) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:221 | ឆ្នាំ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:35 | ផ្នែកសង្គ្រោះបន្ទាន់ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:220,221,222,223,224,226,296,300,832 | មិនបានបញ្ជាក់ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:376 | ពិន្ទុវាយតម្លៃកម្រិតសង្គ្រោះបន្ទាន់ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:29 | ផ្នែកជំងឺទូទៅ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:30 | ផ្នែកវះកាត់ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:36 | ផ្នែកជំងឺរបេង | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:281 | ពិគ្រោះក្រៅ (OPD) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:558 | អុកស៊ីសែន (SpO2) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:411 | កំណត់ត្រាប្រតិកម្មអាលែកហ្ស៊ី | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:413 | សារធាតុ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:413 | ប្រតិកម្ម | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:414 | កម្រិតធ្ងន់ធ្ងរ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:414 | អ្នកកត់ត្រា | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:377,420 | បញ្ជីបញ្ហាសុខភាពកំពុងជួបប្រទះ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:227 | គ្រែ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:273 | ប្រតិកម្មអាលែកហ្ស៊ី | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:372,381 | ផ្ទាំងសង្ខេបព័ត៌មានអ្នកជំងឺ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:379,424 | ឱសថដែលកំពុងប្រើ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:373,428,431 | ស្ថានភាពការសង្គ្រោះជីវិត | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:23 | បញ្ចុះតម្លៃ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| b | public/emr-session.js:231 | ផ្ទាំងរង | 0d66c1a: explicit global emr-sub-nav removal; current grouped sidebar and role/counter tests retained |
| a | public/patient-banner.js:19 | មូលនិធិសមធម៌ (HEF) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:20 | ប.ស.ស. (NSSF) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:21 | បង់ផ្ទាល់ (Direct) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:22 | មិនគិតថ្លៃ (Free) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:24 | លើកលែងការបង់ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:51 | const hasAllergy = Boolean(allergyText && !/^(គ្មាន\|no\|none\|neg\|negative\|-)$/i.test(allergyText.trim())); | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:227 | សេវាក្រៅ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:227 | មិនទាន់មានគ្រែ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:246 | ព័ត៌មានអ្នកជំងឺបច្ចុប្បន្ន | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:269 | អាលែកហ្ស៊ី៖ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:271,417 | គ្មានប្រវត្តិអាលែកហ្ស៊ី | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:277 | បង់ផ្ទាល់ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:280 | បានចេញពីពេទ្យ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:303 | ផ្នែក & គ្រែ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:326 | បៃតង | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:326 | លឿង | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:326 | ក្រហម | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:512 | សញ្ញាជីវិតចុងក្រោយ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:518 | កម្តៅ (Temp) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:528 | សម្ពាធឈាម (BP) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:538 | ជីពចរ (Pulse) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:548 | ដង្ហើម (Resp) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:576 | រោគវិនិច្ឆ័យបច្ចុប្បន្ន | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:585 | មិនទាន់មានរោគវិនិច្ឆ័យដែលបានកត់ត្រានៅឡើយទេ។ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:594 | ឱសថកំពុងប្រើប្រាស់ ( | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:602 | មិនមានឱសថកំពុងប្រើប្រាស់នៅឡើយទេ។ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:611 | ការបញ្ជា និងលទ្ធផលប៉ារ៉ាគ្លីនិក | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:616 | សូមពិនិត្យផ្ទាំង | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:616 | បញ្ជា (Orders) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:616 | ឬ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:616 | លទ្ធផល (Results) | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| a | public/patient-banner.js:616 | ដើម្បីមើលព័ត៌មានលម្អិតអំពីតេស្តមន្ទីរពិសោធន៍ និងរូបភាពវេជ្ជសាស្ត្រ។ | 96b6159 / CHANGELOG v45.4.0: intentional patient banner/dashboard removal |
| d | tests/patient-banner-and-chart.test.mjs:111 | assert.match(js, /គ្មានប្រវត្តិអាលែកហ្ស៊ី/); | Completed Work A: obsolete banner/payer assertions replaced with actual role-filtered chart navigation coverage |
| d | tests/patient-banner-and-chart.test.mjs:112 | assert.match(js, /អាលែកហ្ស៊ី/); | Completed Work A: obsolete banner/payer assertions replaced with actual role-filtered chart navigation coverage |
| d | tests/patient-banner-and-chart.test.mjs:113 | assert.match(js, /មូលនិធិសមធម៌/); | Completed Work A: obsolete banner/payer assertions replaced with actual role-filtered chart navigation coverage |
| d | tests/patient-banner-and-chart.test.mjs:114 | assert.match(js, /មិនបានបញ្ជាក់/); | Completed Work A: obsolete banner/payer assertions replaced with actual role-filtered chart navigation coverage |

## Necessary new text

- សកម្មភាពផ្សេងៗ - Other actions. EMR_FINISH_REMAINING.txt Work E: existing v45.1 consultation actions menu label; classification (c), no clinical meaning or policy change.
- សង្គ្រោះជីវិតពេញលេញ - Full resuscitation. EMR_FINISH_REMAINING.txt Work C/E: read-only display of existing explicit full code from authorized clinical summary API. Reuses existing resuscitation terminology; creates no order, editing workflow or policy.

Work D also exposed untranslated audit-viewer controls despite an existing Khmer
page title. The viewer now owns its static/dynamic translations and its error
message uses the already reviewed request-error text. Seven nonclinical values
were narrowly added to approved-new-khmer.json: recordLog.patient, recordLog.user,
recordLog.open, recordLog.export, recordLog.document, recordLog.from, recordLog.time.
English remains available through the existing language event. This is category
(d) localization wiring repair plus category (c) exact new labels, not a clinical
wording/policy change. Existing Khmer words are reused for all other controls.

The unchanged full-suite provenance test requires every post-RULE-2 approval
to match an owner-reviewed filled CSV pair. The 31 provider/completion pairs
are therefore appended under reviewed.* keys in docs/translations-needed.csv,
preserving existing rows and blank translations. The escaping pair is marked
test-only. No apply-translations script or baseline regeneration was run.

The test-only HTML escaping value remains marked testOnly in approved-new-khmer.json.
No baseline snapshot was regenerated; removal approval is bounded by exact file/line
occurrences and tests reject excess removals, wrong files/lines and unapproved changes.
