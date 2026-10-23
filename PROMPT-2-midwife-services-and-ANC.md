Read AGENTS.md first and follow it. This prompt is the approved update, so you may code it.
Base: the current project in this folder (run PROMPT-1 first). Read the version in package.json and raise it by one minor step.
Do not touch patient data or any file under data/. Test only in a disposable copy with synthetic patients.
UI text is Khmer only (English only when the interface is switched to EN). No "Khmer / English" slash text.
Lab test names stay in English. Units mg, mL, mcg, g, IU, mmol are never translated.
Khmer text for the ANC record, colour chart and schedule must be copied EXACTLY from borkeo-update-files/anc/ (JSON files and page images).
Never retype or translate it from memory. Any word you cannot read with certainty: list it in docs/anc-khmer-to-confirm.md for the owner.

WORK MODE - AUTO NEXT
Work through Phase 1 to Phase 7 in order. Do not stop to ask me between phases.
At the end of each phase: run npm test and npm run check:khmer, fix any failure, print one line such as
"Phase 1 done - tests pass - starting Phase 2", then start the next phase.
Stop and ask me only if a change would delete or overwrite patient data, a test still fails after 3 attempts,
or two rules in this prompt contradict each other. Explain in one short paragraph and wait.
This WORK MODE overrides the "discuss one at a time / wait for approval" rule in AGENTS.md, for this update only.

INPUT FILES (borkeo-update-files/anc/; if missing, stop and tell me)
- anc-color-chart.json: the official colour-code chart (69 items in 4 sections, green / yellow / red), with "auto" rules where the EMR can decide.
- anc-visit-schedule.json: page 7 (green, 4 visits) and page 8 (yellow/red, 8 visits): records, lab, exam, ultrasound and care per visit.
- moh-2026-pages/page-2.jpg ... page-9.jpg: the official ANC record (pages 2-5), chart (6), schedules (7-8), referral levels (9).

OWNER DECISIONS (already agreed)
- Flow for maternal services: Registration -> Triage -> Cashier -> MIDWIFE. Counted as OPD services in reports.
- The midwife keeps the existing role MIDWIFE in the Obstetric ward. She gets a new menu item for her outpatient queue.
- Midwife services: ANC, PNC, family planning, cervical cancer screening, vaccination.
- The midwife does HIV, syphilis and Hb tests herself (rapid tests) and types the results. She orders HBsAg from the Laboratory and
  ultrasound from Imaging (both paid at the Cashier first, like other OPD paraclinic orders). She may prescribe: Ferrous salt,
  Ferrous salt + folic acid, Folic acid, Mebendazole, Calcium (and vaccines in the vaccination service).
- Colour result: green -> midwife ANC, 4 visits (page 7); yellow -> ANC continues HERE at Borkeo Referral Hospital (CPA2), 8 visits (page 8);
  red -> refer to the provincial hospital (CPA3) with a referral form signed by a doctor.
- Cervical screening: the midwife does the check, then sends the result to a doctor.
- Safe abortion moves from OPD to the Gynecology ward.
- Triage must fill every field it has (it can never be left blank), so the ANC record always imports them.
OWNER DECISIONS USED AS DEFAULTS (the owner may change them later; keep each one easy to change in server/clinical-options.json)
- Replace the current ANC form with the official ANC record. Old ANC forms stay readable, read-only.
- GA: from LMP; if a dating ultrasound before 14 weeks gives an EDD more than 7 days different, use the ultrasound EDD. Always show the source.
- Weight before pregnancy: first visit before 12 weeks -> use the Triage weight automatically; later -> the midwife types it.
- Chart gaps: age 18-19 and 35 = yellow; height under 145 cm = yellow (flag "check"); BMI under 18.5 = yellow; BP 140-159/90-109 = yellow,
  160/110 or more = red; 4 births = yellow, 5 or more = red; twins = red. Use the "auto" notes in anc-color-chart.json.
- Visit window: inside the weeks of the visit; single-week visits (26, 36, 38, 40) accept +/- 1 week.
- The "to do at this visit" list is a side panel always visible in the ANC record, and it also opens once when the record opens.
  A task can be closed undone only with a reason: មិនមានតេស្ត / អ្នកជំងឺបដិសេធ / ធ្វើរួចនៅកន្លែងផ្សេង / ផ្សេងៗ (text).
- Cervical result: sent as a message to the Gynecology ward doctors' inbox (existing staff messages), with the patient link.
- Vaccination: all ages (national schedule vaccines in the medicine list), FREE (Triage sends straight to the midwife, no Cashier),
  each dose is deducted from stock, form = vaccine, dose number, date, batch number, injection site, next appointment, reaction.
- Safe abortion: Triage sends the patient to the Gynecology ward queue; the gynecology doctor sees her as an outpatient service and may admit.
- CPA3 referral form: the owner will upload the official form later. Until then print a simple referral letter (letterhead, patient,
  GA, colour and red reasons, vital signs, test results, treatment given, referring doctor signature line) and keep the layout easy to replace.

PHASE 1 - Routing and the midwife queue
1. Triage choices (public/emr-patient-record.js departmentDefinitions / otherDefinitions, protected/EMR.html "Other" list):
   ANC (anc), PNC (pnc), family planning (family-planning), cervical screening (cervix-screening): after triage -> Cashier -> midwife queue.
   Add "ចាក់វ៉ាក់សាំង" (code vaccination, mode opd): after triage -> midwife queue directly (free). Ask nothing: use this Khmer label and list it
   in docs/anc-khmer-to-confirm.md.
   Safe abortion (safe-abortion): after triage -> Gynecology ward queue (see Phase 6).
2. New page "បញ្ជីអ្នកជំងឺសេវាមាតា" for MIDWIFE (obstetric) in public/nav-config.js (group care) and in the server page rules
   (server/access.mjs roleCanPage), listing today's paid ANC/PNC/family planning/cervix patients and vaccination patients, with a call button
   like the OPD queue. Opening a patient opens the right form. Real midwife accounts and the Superuser switched to Midwife both see it.
3. Permissions: midwife can open and save these forms for these patients (server/encounter-access.mjs, record access), order HBsAg and
   ultrasound (server/routes/paraclinic.mjs: allow MIDWIFE for these orders only), and prescribe only the medicines listed above
   (filter the medicine search for MIDWIFE in these services). Reports count these visits as OPD services as today.

PHASE 2 - The official ANC record (one per pregnancy)
1. New record type "ANC pregnancy record" linked to the patient's Health ID, opened at the first ANC visit and reused at every visit until
   delivery, referral to CPA3 or closing by the midwife. Store additively (new table or clinical form type); never change old ANC forms.
2. Build pages 2-5 as on the official images (same order, same Khmer labels, same tables):
   - identity, LMP, EDD (calculated: LMP + 280 days), EDD by first-trimester ultrasound, height, weight before pregnancy, BMI before pregnancy
   - general, surgical, drug allergy (link to the structured allergy record), family, gynaecological and social history; risk factors; mouth and
     teeth check; anaemia check
   - previous pregnancies table with the 10 complications listed in the page-2 footnote
   - lab results table by date (HIV, Syphilis, HBsAg, Anti HCV, Hb, HCT, PLT, Group/RH, 3 free rows): released Lab results fill it
     automatically; the midwife's own rapid tests (HIV, Syphilis, Hb) are typed in the ANC visit and appear here too
   - ultrasound table (DATE, GA, presentation, BPD, placenta, AFI, weight, EDD, other): filled from released Imaging reports when the fields
     exist, otherwise typed
   - visit table, one row per visit (DATE, GA, UH, FP, FHR, BP&P, Weight, WP, Proteinuria, Glucosuria, Varices, Fer, Vaccination,
     Chief complaint, Diagnosis and intervention, Appointment, NAME)
3. Auto-fill (editable by the midwife; the original value stays saved): name, date of birth, age (Registration); weight, height, BP, pulse,
   temperature, SpO2 (Triage of the same visit); BMI, weight gain, GA, EDD (calculated); midwife name from the login; vaccination from Phase 5.
4. Print pages 2-5 in the official layout (A4 landscape) with the colour box ticked.

PHASE 3 - Colour code, schedule and "to do" panel
1. Colour engine from anc-color-chart.json: auto items decide from the data; other items are tick boxes; the highest level wins.
   Re-check at every visit and every save. Show the result as a coloured box at the top of the record (the official boxes បៃតង / លឿង / ក្រហម)
   and as a badge in the patient banner on every page. Keep the history of colour changes (date, reasons, who).
2. Schedule from anc-visit-schedule.json by colour (green: 4 visits; yellow/red: 8 visits) and GA: show which visit this is, its tasks
   (records, lab, exam, ultrasound, care) as check items, overdue tasks from earlier visits in red, and "not a scheduled visit" between visits.
   Each task acts: own tests open the result field; HBsAg / OGTT / CBC / ultrasound create the order (patient pays at Cashier); iron/folic acid
   adds the prescription; tetanus vaccine opens the vaccination entry. Closing undone needs a reason (defaults above).
3. Next appointment: suggest the date of the next scheduled visit for the colour; the midwife can change it.
4. Yellow: show "ANC continues at Borkeo Referral Hospital (CPA2) - 8 visits". Red: show the referral button; a doctor (DOCTOR or
   CHIEF_WARD of Obstetric/Gynecology) signs the referral (existing e-signature); print the referral letter; mark the visit "referred to CPA3"
   so reports count it. The referral print layout must be replaceable by the official form later.

PHASE 4 - PNC, family planning, cervical screening
1. Move these existing forms from the OPD doctor to the midwife queue (forms unchanged).
2. Cervical screening: when the midwife saves a result, send a staff message to the Gynecology ward doctors with patient, result and link;
   the doctor's acknowledgement completes it (existing message completion).

PHASE 5 - Vaccination service
1. New vaccination form (fields in the defaults) with the vaccine chosen from the medicine list lines where vaccine = true.
2. Each dose deducts the vaccine from stock (existing stock movement, reference = the vaccination id). Same vaccine and dose number twice ->
   warning. Tetanus vaccine given to a pregnant woman also appears in her ANC record (visit table "Vaccination").
3. Vaccination history per patient (Health ID) with next appointment; print a vaccination card section.

PHASE 6 - Safe abortion to the Gynecology ward
1. Triage choice safe-abortion -> Gynecology ward queue (not OPD doctor, not midwife). The existing safe abortion form opens for DOCTOR and
   CHIEF_WARD in Gynecology; admission stays possible through the normal flow. Old safe abortion records stay readable.
2. Update finance/department mapping so the service is billed under Gynecology.

PHASE 7 - Tests, version, delivery
1. Tests (new file tests/<new version>-midwife-anc.test.mjs), at least:
   - ANC patient: triage -> cashier -> appears in the midwife queue, not in the OPD doctor queue; vaccination patient skips the cashier
   - midwife can order HBsAg and ultrasound but not other lab tests; can prescribe only the allowed medicines
   - one ANC record per pregnancy reused across 3 visits; Triage values imported; EDD = LMP + 280 days; ultrasound EDD used when > 7 days apart
   - colour: 40-year-old -> yellow; Hb 6.5 -> red; BP 165/112 -> red; two previous caesareans ticked -> red; all normal -> green
   - schedule: yellow at 26 weeks shows OGTT; green at 27 weeks shows "not a scheduled visit" and the next date; missed HBsAg shows overdue
   - closing a task undone requires a reason; red referral requires a doctor signature and marks the visit referred
   - cervical result creates a message for Gynecology doctors; vaccination deducts stock and TT appears in the ANC record
   - safe abortion goes to the Gynecology ward queue; old ANC forms open read-only; real staff menus otherwise unchanged
2. npm test and npm run check:khmer must pass. Browser check with synthetic patients: green, yellow and red pregnancies across several visits,
   a vaccination, a cervical screening, a safe abortion.
3. Version in package.json, public/login.html, CHANGELOG.md; one update file Borkeo-EMR-<new version>-update.txt (same format as before,
   full diff, installation one step at a time).
4. Final report: files changed, decisions used as defaults, docs/anc-khmer-to-confirm.md contents, anything not done.
