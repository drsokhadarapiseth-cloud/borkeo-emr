Read AGENTS.md first and follow it. This prompt is the approved update, so you may code it.
Base: the current project in this folder. Read the version in package.json and raise it by one minor step.
Do not touch patient data or any file under data/. Test only in a disposable copy with synthetic patients.
UI text is Khmer only (English only when the interface is switched to EN). No "Khmer / English" slash text.
Medicine names, CMS codes, forms and strengths stay in English exactly as in the Essential Medicines List.
Measurement units mg, mL, mcg, g, IU and mmol are NEVER translated (owner's explicit order; if npm run check:khmer flags them, add them to its allowed list).

WORK MODE - AUTO NEXT
Work through Phase 1 to Phase 5 in order. Do not stop to ask me between phases.
At the end of each phase: run npm test and npm run check:khmer, fix any failure, print one line such as
"Phase 1 done - tests pass - starting Phase 2", then start the next phase.
Stop and ask me only if a change would delete or overwrite patient data, a test still fails after 3 attempts,
or two rules in this prompt contradict each other. Explain in one short paragraph and wait.
This WORK MODE overrides the "discuss one at a time / wait for approval" rule in AGENTS.md, for this update only.

INPUT FILES (in the folder borkeo-update-files/ next to package.json; if missing, stop and tell me)
- medicines.json: 704 lines of the Cambodia Essential Medicines List (10th edition). Fields per line:
  id, code (CMS code, may be empty), name (generic name, one per medicine, 339 distinct names, compared case-insensitively), synonyms (other names, e.g. "acetaminophen"),
  form, strength, label ("CMS-Name-Form-Strength"), unit (final EMR unit: mg, mL, mcg, g, IU, mmol, គ្រាប់, កញ្ចប់, ដំណក់, បាញ់, ដុំ),
  route, atc, ven, group, adult (true/false), child (true/false), femaleOnly, neonateOnly, vaccine,
  childLimit (text such as "> 3 months"), adultLimit (text such as "Not older than 60 years"), notes (list of short notes), doseKey.
- dose-limits-draft.json: maximum doses for every doseKey (395 entries). type = "check" | "protocol" | "none";
  adult: maxPerDose, maxPerDay, maxPerDosePerKg, maxPerDayPerKg; child: maxPerDosePerKg, maxPerDayPerKg, maxPerDose, maxPerDay;
  component (for combinations), unit, note. Every item has status "draft".
- Borkeo-max-dose-table-DRAFT.xlsx: the same table for the Head of Pharmacy and the Director to review (reference only).

PHASE 1 - Data and serving
1. Copy medicines.json to server/catalogues/medicines-eml-2024.json and dose-limits-draft.json to server/catalogues/dose-limits-draft.json.
2. Serve the medicine catalogue to logged-in users (same way as other catalogues). Every new file under public/ must also be added to the
   publicFiles map in server/server.mjs, or it returns 404.
3. Add public/medicine-autocomplete.js and public/medicine-autocomplete.css (register both). No npm packages, no server search while typing.
   Do not inject <style> tags if the page CSP forbids it (check server/security.mjs).

PHASE 2 - Prescription forms
1. Connect every medicine name input: grep -n 'list="meds_list"' protected/EMR.html public/*.js
   Known: IPD admission rows (rx), daily note rows (mon), OPD rows (orx) in protected/EMR.html (row template near "tr.innerHTML" and
   getMedicationEntryRowHtml()), and discharge rows in public/emr-inpatient-workflow.js addDischargeMedicineRow()
   (data-med="name", "doseAmount", "unit" text box). Report any other prescription inputs (pharmacy, periop forms).
   Remove list="meds_list" from connected inputs so the old 25-item list does not open on top. Rows added with "+" must work (event delegation).
2. TWO-STEP SEARCH
   - Step 1: typing 2 or more letters shows each matching medicine NAME only once (match name, synonyms, CMS code).
     Example: "para" shows only "Paracetamol"; "acetam" also finds Paracetamol; "cotrim" finds Sulfamethoxazole + trimethoprim.
   - Step 2: choosing a name shows its forms and strengths as "CMS code · Form · Strength" (no code when empty), filtered for this patient (rule 3).
     Any note (notes, childLimit, adultLimit) shows as an orange line under the choice, e.g. "⚠ Children: > 3 months".
   - If only one form and strength is allowed for this patient, choose it automatically.
   - Typing a full CMS code (e.g. AA0410) jumps straight to that exact item.
   - Keyboard: arrows and Enter in both steps; Backspace from step 2 returns to step 1; Esc closes. "No match" text is Khmer (រកមិនឃើញឱសថ).
   - After choosing: the name box shows the label (CMS-Name-Form-Strength); the number box is cleared and gets focus; the unit is set from "unit";
     the existing change handlers run (handleMedicationQuickChange etc.). Free text is still allowed.
3. FILTER BY PATIENT (use the open patient's age, sex, ward and service)
   - Child = age 0-14 years (paediatricMaxAge in server/clinical-options.json) OR in the Pediatric ward or NCU. Unknown age = show everything.
   - Child sees lines with child = true. Adult sees lines with adult = true. Lines where both are true show to everyone.
   - femaleOnly lines: only female patients aged 15 or more, OR any female who is pregnant (EDD recorded), in the Obstetric or Gynecology ward,
     or seen for ANC, PNC or family planning. Never shown for male patients.
   - neonateOnly lines: only babies under 28 days old or patients in the NCU.
   - childLimit / adultLimit lines (age or weight limits, "not over 60"): SHOW them with the orange warning; do not hide.
   - The filter never changes or removes a saved prescription.
4. Dose box and units
   - The number of medicine is BLANK by default: change value="1" placeholder="1" on the "<prefix>-dose" inputs. Totals must be empty, never NaN.
   - Unit selects: change these options so value and text are the original unit: ម.ក្រ (mg) -> "mg", ម.ល (ml) -> "mL",
     ម៉ៃក្រូក្រាម (mcg/µg) -> "mcg", ក្រាម (g) -> "g", UI / IU -> "IU". Keep the other options. Add one new option "ដុំ".
     Old saved lines with ម.ក្រ, ម.ល, ម៉ៃក្រូក្រាម, ក្រាម or UI are SHOWN as mg, mL, mcg, g, IU (data is rewritten only when a user saves again).
   - Treat the old and new forms of these 5 units as equal wherever a unit is compared (server/stock.mjs syncMedicineStock, ward medicine
     reports, MAR, drug safety, printing, PMRS2 export). This unit alias is the only change allowed in stock code.
5. Route ("how to use")
   - Every NEW row starts blank: add a first empty option "-- ជ្រើស --" (value "") to the list built by populateMedicationRouteSelect /
     getMedicationRouteDefinitions; new rows start on it (today they start on 'po'). Choosing a medicine does NOT fill the route.
     An empty route must not show the "(ពិនិត្យផ្លូវប្រើ)" option.
   - A row with a medicine but no route cannot be saved; show next to the row: សូមជ្រើសរើសផ្លូវប្រើថ្នាំ. Empty rows are ignored.
   - Simplify the injection routes the doctor can pick for a NEW line to: ចាក់សរសៃ (IV) (value other_iv), ចាក់សាច់ដុំ (IM) (value other_im),
     ចាក់ក្រោមស្បែក (SC). Remove from the choices: សារធាតុរាវតាមសរសៃឈាម (IV), អង់ទីប៊ីយ៉ូទិកតាមសរសៃឈាម (IV), អង់ទីប៊ីយ៉ូទិកចាក់សាច់ដុំ (IM),
     ថ្នាំផ្សេងតាមសរសៃឈាម (IV), ថ្នាំផ្សេងចាក់សាច់ដុំ (IM), ចាក់ (ត្រូវបញ្ជាក់ផ្លូវ). Keep លេប (PO), លាប, បន្តក់, ស្រូប, តាមទ្វារមាស, តាមទ្វារធំ (PR), ក្រោមអណ្តាត (SL).
   - Do NOT delete the old route values (iv_fluid, antibiotic_iv, antibiotic_im, injection_unspecified): saved records, pharmacy, messages,
     nursing chart and PMRS2 import use them. Old lines open unchanged and display as ចាក់សរសៃ (IV) / ចាក់សាច់ដុំ (IM).
     Use the same labels everywhere a route is shown (EMR.html, emr-inpatient-workflow.js, pharmacy-opd.js, messages.js, print views).
     Report how the nursing chart now orders medicines (route priority).
6. Default rows: each prescription table (OPD, IPD admission, daily note) starts with 3 rows, not 5 (the "i < 5" loops, the daily note
   "1 starter + 4", and the "while (... .length < 5)" fill-ups). A saved record with more lines shows all of them.
7. Save the CMS code with each medication line as a new field cmsCode (additive only; no key renamed or removed; old lines unchanged).

PHASE 3 - Maximum dose check (adult and paediatric)
1. Load dose-limits-draft.json into the existing drug-safety storage (server/medication-safety.mjs drug_max_doses), extended additively with:
   dose_key, type, component, adult per-kg limits, child per-kg limits, child absolute caps, note, status (draft/approved/rejected),
   approved_by (name), approved_at. Never overwrite a line that an administrator already changed or approved.
2. Admin page /admin/drug-safety: list the table with filters; ADMIN can edit values; the Head of Pharmacy (PHARMACY role) and the
   Director can mark each line Approved or Rejected (one click, their name and time saved, audited). Only APPROVED lines are used by the check.
3. The check runs when a doctor (or midwife) adds or changes a line, and again on save:
   - dose in the unit of the limit = number typed x strength (tablets x mg per tablet; mL x mg per mL from the strength text; mg as typed).
     For combinations use "component" (e.g. trimethoprim). If the dose cannot be converted, show no alert (log it for the pharmacist).
   - per day = per dose x doses per day from the schedule (QD/BID/TID/QID/qH/protocol).
   - Adult: compare with maxPerDose / maxPerDay and, when given, per-kg limits x the latest Triage weight; use the lower limit.
   - Child (same child rule as Phase 2): compare with child per-kg limits x Triage weight, never above the child absolute caps.
     If no weight is recorded for a child, show an orange note "បញ្ចូលទម្ងន់ ដើម្បីពិនិត្យកម្រិតថ្នាំ" (no red alert).
   - "protocol" lines: no alert; show the note as guidance. "none": nothing.
   - Above a maximum: RED alert with the maximum and the calculated dose. The prescriber may continue only after writing the
     evidence / reason; it is saved with the prescription line and in the existing prescribing_overrides audit.
4. Re-use the existing allergy / duplicate / interaction warning UI so all warnings look the same.

PHASE 4 - Tests
Add tests/<new version>-medicine-list-dose-check.test.mjs covering at least:
- catalogue has 704 lines and 339 distinct names (case-insensitive); route needs login; script and CSS served (not 404)
- step 1 "par" returns one "Paracetamol"; "acetam" finds Paracetamol; typing AA0410 jumps to that line; single allowed form is auto-chosen
- 5-year-old: child-only line visible, adult-only line hidden; 40-year-old: "Indicated for children" line hidden; unknown age: all shown
- oxytocin hidden for a male and for a 12-year-old girl not pregnant; shown for a 14-year-old in the Obstetric ward; caffeine citrate only < 28 days or NCU
- units: tablet -> គ្រាប់, oral liquid -> mL, mg injection -> mg, micrograms -> mcg, IU -> IU, cream -> g; old ម.ក្រ line shows mg and stock still matches
- dose and route blank in a new row; row with medicine but no route cannot be saved; old PO line opens as PO; tables start with 3 rows
- dose check: adult paracetamol 4 x 500 mg tablets TID -> red (2 g per dose, 6 g per day); 2 x 500 mg QID -> no alert;
  child 10 kg paracetamol 250 mg -> red (limit 150 mg); child without weight -> orange note; draft (unapproved) line -> no alert;
  continuing a red alert without a reason is refused; with a reason it is saved and audited
- cmsCode saved; free text accepted; old prescriptions open unchanged; tests/v398-side-navigation.test.mjs still passes
Run npm test and npm run check:khmer: all must pass. Browser check with synthetic patients (adult, 5-year-old, pregnant woman) in OPD,
IPD admission, daily note and discharge: search, choose, "+", dose, save, reopen, print.

PHASE 5 - Version and delivery
1. Version in package.json, public/login.html and CHANGELOG.md; update tests that check the version.
2. Write ONE file Borkeo-EMR-<new version>-update.txt in the format of the latest update file (what was wrong, what changed, files,
   installation one step at a time, full unified diff).
3. Final report: files changed; every medicine input connected (and any not); route ordering in the nursing chart; anything in stock,
   pharmacy, MAR, printing or PMRS2 that changed or no longer matches (especially stock names); anything you could not do.
