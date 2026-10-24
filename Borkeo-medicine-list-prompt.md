Read AGENTS.md first and follow it. This prompt is the approved update, so you may code it.
Base: the current project in this folder. Read the version in package.json and raise it by one minor step (for example 42.1.0 -> 42.2.0).
Do not touch patient data or any file under data/. Test only in a disposable copy with synthetic patients.
UI text is Khmer only (English only when the interface is switched to EN). No "Khmer / English" slash text.
Medicine names, CMS codes, forms and strengths stay in English, exactly as in the Cambodia Essential Medicines List.

WORK MODE - AUTO NEXT
Work through the phases in this order: Phase 1, Phase 2, Phase 3, Phase 4.
Do not stop to ask me between phases.
At the end of each phase:
  1. Run npm test and npm run check:khmer.
  2. If anything fails, fix it before moving on.
  3. Print one short line, for example:
     "Phase 1 done - tests pass - starting Phase 2".
  4. Start the next phase immediately.
Stop and ask me only if:
  - a change would delete or overwrite patient data, or
  - a test still fails after 3 attempts to fix it, or
  - two rules in this prompt contradict each other.
In those cases, explain the problem in one short paragraph and wait.
After Phase 4, give the final report.
This WORK MODE overrides the "discuss one at a time / wait for approval" rule in AGENTS.md, for this update only.

GOAL
Every medicine name box in the prescription forms searches the Cambodia Essential Medicines List (10th edition, 2023-2024, 704 medicines).
- The search starts after 2 or 3 letters.
- It matches the medicine name, the CMS code, the form and the strength.
- Each choice is shown and filled as: CMS code-Name-Form-Strength
  Example: AA0410-Paracetamol-Tablet-250 mg
  A medicine with no CMS code in the list is shown without the code: Name-Form-Strength.
- After a medicine is chosen, the dose column (3rd column) has:
  - the number of medicine: BLANK by default (the doctor types it)
  - the unit: set automatically from the medicine (rules in Phase 2). mg, mL, mcg, g and IU are written in the original units, not translated.
- The route ("how to use") is blank in every new row; the doctor chooses it. There is no default PO.
- Each prescription table starts with 3 rows, not 5.

INPUT FILES (I put them in this folder, next to package.json)
- medicines.json: 704 items. Fields: id, code (CMS code, can be empty), name, form, strength, label ("CMS-Name-Form-Strength"), unit, kind, ven, group.
- medicine-autocomplete.js: a working search script (no libraries, searches in the browser, about 0.2 ms per search). Reuse its search and keyboard logic, but adapt it to this EMR as described below.
If either file is missing, stop and tell me.

PHASE 1 - Data and serving
1. Move medicines.json to server/catalogues/medicines-eml-2024.json (same folder as symptoms-v327.json).
2. Serve it to logged-in users. Use the same way the project serves other catalogues (for example GET /api/... with a session), or add it to the publicFiles map in server/server.mjs.
   Remember: every new file under public/ must also be added to the publicFiles map in server/server.mjs, or it returns 404 (this happened to ipd-transfer.js in v42.0).
3. Put the search script at public/medicine-autocomplete.js and register it in publicFiles.
   - Do not inject a <style> tag if the page Content-Security-Policy forbids it (check server/security.mjs). Put the CSS in public/medicine-autocomplete.css instead and register it.
   - The "no match" text must be Khmer (for example: រកមិនឃើញឱសថ). Keyboard: Arrow up and down, Enter to choose, Esc to close.
4. Do not add any npm package and do not search on the server while typing.

PHASE 2 - Connect to every prescription form
1. Find every medicine name input:
   grep -n 'list="meds_list"' protected/EMR.html public/*.js
   Known places:
   - protected/EMR.html: the IPD admission rows, the daily note (mon) rows and the OPD rows (orx). They are built by the row template near "tr.innerHTML" and by getMedicationEntryRowHtml(). The inputs have class "<prefix>-name", the dose "<prefix>-dose" and the unit select "<prefix>-unit".
   - public/emr-inpatient-workflow.js addDischargeMedicineRow(): data-med="name", data-med="doseAmount", data-med="unit" (a text box, not a select).
   - Search for any other prescription name input (pharmacy, periop forms) and report them.
2. On those inputs, remove list="meds_list" so the old short list does not open on top of the new one. Keep the <datalist id="meds_list"> element only if something else still uses it.
3. Rows added later with the "+" button must work too (use event delegation).
4. The number of medicine must be blank by default.
   - Change value="1" placeholder="1" on the "<prefix>-dose" inputs to an empty value with no placeholder number.
   - Check that calculateMedicationQuickTotal(), handleMedicationQuickChange() and updateMedicationLegacyDoseFields() still work when the dose is empty. The total should be empty, never NaN.
   - Saved old prescriptions must still open with their saved dose.
5. Units: DO NOT TRANSLATE the measurement units. mg, mL, mcg, g and IU stay as the original international units, in both the option value and the text shown. This is my explicit order, so it is allowed by the Khmer-only rule in AGENTS.md. If npm run check:khmer flags these units, add them to its allowed list.
   - In every unit select (the "<prefix>-unit" selects in protected/EMR.html, and any copy of the same list), change these 5 options:
       ម.ក្រ (mg)               -> value "mg",  text "mg"
       ម.ល (ml)                 -> value "mL",  text "mL"
       ម៉ៃក្រូក្រាម (mcg/µg)    -> value "mcg", text "mcg"
       ក្រាម (g)                -> value "g",   text "g"
       UI / IU                  -> value "IU",  text "IU"
     Keep all other options as they are (mmol, mEq, គ្រាប់, កញ្ចប់, ដំណក់, បាញ់, អំពូល ...). Do not create duplicates.
     Add one new option, "ដុំ", for patches, IUDs and implants.
   - Old saved prescriptions: a saved line with unit ម.ក្រ, ម.ល, ម៉ៃក្រូក្រាម, ក្រាម or UI is shown as mg, mL, mcg, g or IU. Do not rewrite saved data by itself; the new value is saved only when a user saves the record again.
   - Make the old and new forms of these 5 units count as equal wherever a unit is compared: server/stock.mjs syncMedicineStock (stock matches by name AND unit), ward medicine reports, the MAR, drug-safety maximum dose, printing, PMRS2 export. This unit alias is the only change allowed in stock and drug-safety code.
   Map the unit in medicines.json to the option value:
     mg -> mg, mL -> mL, mcg -> mcg, g -> g, IU -> IU, mmol -> mmol,
     គ្រាប់ -> គ្រាប់, កញ្ចប់ -> កញ្ចប់, ដំណក់ -> ដំណក់, ដង (puff) -> បាញ់,
     ក្រាម (creams, ointments, gels) -> g, ដុំ -> ដុំ
   The rules behind these units, which I chose:
   - Injections (ampoule or vial): the dose is written in mg, mcg, IU, g or mmol, taken from the strength. Never in ampoules. Infusions such as glucose and NaCl use mL.
   - Oral liquids, suspensions and syrups: mL.
   - Tablets, capsules and suppositories: គ្រាប់. Sachets and powders: កញ្ចប់. Eye, ear and nose drops: ដំណក់. Inhalers: បាញ់. Creams, ointments and gels: g. Patches, IUDs and implants: ដុំ.
   The doctor can still change the unit by hand after choosing.
   For the discharge rows (a unit text box), write the same unit into the box, untranslated.
5b. Route ("how to use") must be BLANK in every new row. The doctor chooses it; there is no default PO any more.
   - Today every new row is set to PO: populateMedicationRouteSelect(..., 'po') in addOpdRxRow, addRxRow, addMonRxRow and the other row builders, and the row template starts with only a PO option.
   - Add a first empty option "-- ជ្រើស --" (value "") to the route list built by populateMedicationRouteSelect / getMedicationRouteDefinitions, and start new rows on it.
   - An empty route must not show the "(ពិនិត្យផ្លូវប្រើ)" unverified option.
   - Choosing a medicine from the list does NOT fill the route.
   - Old saved lines keep their saved route. Lines loaded with no saved route (the "med.route || 'po'" code) stay as today, so old records do not change.
   - Saving: a row that has a medicine name but no route cannot be saved. Show this Khmer message next to the row: សូមជ្រើសរើសផ្លូវប្រើថ្នាំ. Empty rows (no medicine name) are ignored, as today.
   - Check that an empty route does not break the nursing medication chart, the MAR, the ward medicine report or route-based ordering (route priority).
5c. Default number of rows: 3, not 5.
   - Each prescription table (OPD, IPD admission, daily note) starts with 3 empty rows. The "+" button still adds more.
   - Today the code makes 5: the "for (var i = 0; i < 5; i++)" loops (OPD and IPD), the daily note "1 starter row + 4", and the "while (... .length < 5)" fill-ups after loading a saved record. Change all of them to 3, so the daily note is 1 starter + 2.
   - A saved record with more than 3 lines still shows all its lines.
6. When a medicine is chosen:
   - the name box gets the label (CMS code-Name-Form-Strength)
   - the number box is cleared and gets the focus
   - the unit is set by the rules above
   - fire the existing change handlers (handleMedicationQuickChange etc.) so totals, legacy fields and saving update.
7. Free text is still allowed. A doctor can type a medicine that is not in the list, as today.

PHASE 3 - Save the CMS code, keep everything else working
1. Add the CMS code to each saved medication line as a new field (for example cmsCode), next to the existing name, dose and unit. This is additive only:
   - no existing key is renamed or removed
   - no database schema change unless it is really needed (if needed, show it in the update file)
   - old prescriptions without cmsCode open and save exactly as before.
2. Check that these still work with the new long names, and report anything that changed:
   - OPD prescription sent to pharmacy (submitOpdPrescription) and pharmacy dispensing
   - ward daily medicine report (ward-medicines) and its 6 sign steps
   - stock deduction (server/stock.mjs syncMedicineStock matches stock by exact name AND unit)
   - prescribing warnings: allergy, duplicate medicine, interaction and maximum dose (server/medication-safety.mjs)
   - the nursing medication administration record (MAR)
   - printing of prescriptions and the discharge summary
   - PMRS2 export (pmrs2-mapping / pmrs2-transfer).
   Do NOT change pharmacy, stock or drug-safety logic in this update. If a medicine chosen from the new list no longer matches a stock item (because the stock item has a different name), only report it. Do not change stock names and do not change the matching rule.
3. The saved field keys of the record must not change (the same storage-key checks as earlier updates).

PHASE 4 - Tests, version, delivery
1. Add tests/<new version>-medicine-list.test.mjs:
   - the catalogue has 704 items, and every item has a label and a unit
   - the catalogue route needs a login
   - the script and CSS files are served (not 404)
   - search "par" finds Paracetamol; "AA04" finds the AA04.. codes; "amox" finds Amoxicillin
   - choosing a tablet sets គ្រាប់; an oral liquid sets mL; an injection with "mg" in the strength sets mg; with "micrograms" sets mcg; with "IU" sets IU; a cream sets g
   - the unit selects show mg, mL, mcg, g and IU (never ម.ក្រ, ម.ល, ម៉ៃក្រូក្រាម, ក្រាម or UI)
   - an old line saved with ម.ក្រ opens as mg, and stock still matches it
   - the dose box and the route are blank in a new row; there is no default PO
   - a row with a medicine but no route cannot be saved; an empty row is ignored
   - an old saved line with route PO still opens as PO
   - each prescription table starts with 3 rows; a saved record with 6 lines shows all 6
   - an old saved prescription with dose 1 and no cmsCode opens unchanged
   - cmsCode is saved with a chosen medicine
   - free text is still accepted
   - no NaN in the total when the dose is empty.
2. Run npm test (all must pass) and npm run check:khmer.
3. Browser check with synthetic patients (log in as a doctor, or as the Superuser switched to a doctor):
   - OPD prescription
   - IPD admission prescription
   - daily note prescription
   - discharge medicines
   In each: type "par", choose with the keyboard, add a row with "+", type a dose, save, reopen, print.
4. Version: package.json, public/login.html and CHANGELOG.md. Update any test that checks the version.
5. Write ONE file, Borkeo-EMR-<new version>-update.txt, in the same format as the latest update file:
   - what was wrong
   - what changed
   - the list of files
   - installation steps, one at a time
   - the full unified diff against the previous version.
6. Final report:
   - the files changed
   - every medicine input that was connected (and any that were not)
   - anything in Phase 3 step 2 that changed or no longer matches (especially stock)
   - anything you could not do.
