# SOAP Note Integration Impact Analysis (Step 5.0)

## 1. Overview
This document analyzes all doctor-written clinical note areas and all downstream systems that consume evolution and conclusion notes within Borkeo EMR. The goal is to introduce a 4-box colour-coded SOAP note (**S**ubjective, **O**bjective, **A**ssessment, **P**lan) with strictly additive data, zero breaking changes to existing patient records, and 100% preservation of PMRS2 export, printing, and audit history.

> [!IMPORTANT]
> **Nursing Notes Exclusion**: Per IEC 62366-1 guidance and project constraints, nursing notes (`#sub_nursing`, nursing process, nursing care cards, and midwife partograph) are strictly clinical nursing workflows and are **NOT** modified.

---

## 2. Doctor-Written Note Areas (Write Operations)

### A. IPD Daily Follow-Up Note Modal (`#mon_modal`)
- **Location**: `protected/EMR.html` (lines 12680–12780)
- **Current Inputs**:
  - `#mon_input_date`: Date & time of follow-up
  - `#mon_input_temp`, `#mon_input_bp_sys`, `#mon_input_bp_dia`, `#mon_input_pulse`, `#mon_input_resp`, `#mon_input_spo2`: Vital signs
  - `#mon_input_evol`: Free-text evolution textarea ("ការវិវត្តន៍")
  - `#mon_input_conclusion`: Free-text conclusion textarea ("សេចក្តីសន្និដ្ឋាន")
  - `#mon_input_icd10`: ICD-10 code input and diagnosis picker
  - `#mon_rx_tbody`: Prescribed medications table
- **Save Handler**: `saveDailyMonitoring()` in `protected/EMR.html` (lines 21422–21598)
- **Planned Conversion**:
  - Replace the single free-text `#mon_input_evol` and `#mon_input_conclusion` UI with the 4-box colour-coded SOAP component.
  - S (Subjective - Blue): Complaints and patient history (`mon_input_soap_s`).
  - O (Objective - Green): Integrates existing vitals inputs, physical exam findings (`mon_input_soap_o`), and latest paraclinic results pull button.
  - A (Assessment - Amber): Integrates ICD-10 selector, clinical impression, and conclusion (`mon_input_soap_a`).
  - P (Plan - Purple): Integrates daily medications table, next follow-up, and plan narrative (`mon_input_soap_p`).
  - Keep hidden or synchronized `#mon_input_evol` and `#mon_input_conclusion` fields so existing DOM consumers and test assertions continue to pass without change.

### B. Daily Monitoring Feed Cards (`#daily_monitoring_feed`)
- **Location**: `protected/EMR.html` (lines 21505–21575)
- **Storage Target**: `card._monitoringCopyData` saved into `system:dailyMonitoringRecords` JSON array.
- **Planned Conversion**:
  - Store additive `soap: { s, o, a, p }` on each record.
  - Retain `evol` and `conclusion` properties populated from S/O and A/P text for backward compatibility.
  - Render modern 4-color SOAP cards when `soap` structure is present.
  - Display legacy cards with clear "ចំណាំចាស់" badge when viewing older non-SOAP records.

### C. Daily Monitoring Print Layout
- **Location**: `protected/EMR.html` (`#monitoring-print-layout`, lines 21600–21750)
- **Current IDs**: `prx_*` print elements and print preview templates.
- **Planned Conversion**:
  - Print layout formatted with clean A4 section borders for S, O, A, P with dual-mode grayscale legibility.

### D. OPD Medical Consultation Form (`#sub_opd`)
- **Location**: `protected/EMR.html` (`#sub_opd`, lines 7340–7600)
- **Current Inputs**: Chief complaints, physical examination, conclusion, and treatment.
- **Planned Conversion**:
  - Compatible SOAP structure option for OPD follow-up consultations.

### E. IPD Admission & Medical Record Form (`#sub_ipd`)
- **Location**: `protected/EMR.html` (`#sub_ipd`, lines 7600–8200)
- **Current Inputs**: Admission diagnosis, clinical examination, treatment protocol.
- **Planned Conversion**:
  - Standardized SOAP clinical summary card integration.

---

## 3. Downstream Read Areas (Consumers)

| Consumer | Location | What it Reads | Backward Compatibility Strategy |
| :--- | :--- | :--- | :--- |
| **PMRS2 Export Mapping** | `server/pmrs2-mapping.mjs` (lines 115–120, 236–238) | `record.evol`, `record.conclusion`, `record.medications` | Both legacy `evol` and `conclusion` remain populated on the JSON record so PMRS2 mapping produces exact checksums and warnings without server modifications. |
| **Previous Records Panel** | `protected/EMR.html`, `public/emr-patient-record.js` | `system:dailyMonitoringRecords` | Renders cards supporting both new `soap: {s, o, a, p}` structure and legacy `evol` / `conclusion` text. |
| **Editor History / Audit Log** | `server/editor-history.mjs` (line 76), `server/server.mjs` | Key `system:dailyMonitoringRecords` | The key name is preserved; change notes track modified SOAP sections. |
| **Ward Medicine Sync & Dispensing** | `server/ward-medicines.mjs`, `server/ward-medicine-approvals.mjs` | `record.medications` | Medications array inside daily monitoring remains in identical format. |
| **Discharge Summary Generator** | `protected/EMR.html` (`openDischargeFromFollowUp`) | Latest follow-up diagnosis, vitals, conclusion | Reads from Assessment/Conclusion and Objective vitals seamlessly. |
| **Patient Summary Dashboard** | `public/patient-banner.js` | Latest vitals and diagnosis from `system:dailyMonitoringRecords` | Directly displays latest vitals and primary ICD-10 diagnosis. |

---

## 4. Planned Conversion Strategy for Phase 5

1. **Primary Target**:
   - Convert **IPD Daily Follow-Up Note** (`#mon_modal` & `#daily_monitoring_feed`) into the full 4-box colour-coded SOAP component.
2. **Data Structure (Additive)**:
   ```json
   {
     "dtVal": "2026-10-19 09:00",
     "temp": "37.2",
     "bp_sys": "120",
     "bp_dia": "80",
     "pulse": "76",
     "resp": "18",
     "spo2": "99",
     "soap": {
       "s": "អ្នកជំងឺដឹងខ្លួនល្អ គ្មានក្តៅខ្លួន គ្មានក្អក",
       "o": "សញ្ញាជីវិតធម្មតា ពោះទន់ គ្មានរឹង",
       "a": "រលាកក្រពះស្រួចស្រាវ (Acute gastritis)",
       "p": "បន្តថ្នាំចាក់ Omeprazole IV និងតាមដានរៀងរាល់ ៤ ម៉ោង"
     },
     "evol": "S: អ្នកជំងឺដឹងខ្លួនល្អ គ្មានក្តៅខ្លួន គ្មានក្អក\nO: សញ្ញាជីវិតធម្មតា ពោះទន់ គ្មានរឹង",
     "conclusion": "A: រលាកក្រពះស្រួចស្រាវ (Acute gastritis)\nP: បន្តថ្នាំចាក់ Omeprazole IV និងតាមដានរៀងរាល់ ៤ ម៉ោង",
     "icd10": "K29.1",
     "diagnoses": [...],
     "medications": [...]
   }
   ```
3. **Required Fields & Validation**:
   - Minimum required fields: **S** (Subjective) and **A** (Assessment) required before save; ICD-10 format validation maintained.
4. **Khmer Terminology**:
   - **S** = `ពាក្យបណ្តឹង និងប្រវត្តិ` (Subjective: Blue)
   - **O** = `ការពិនិត្យ និងលទ្ធផល` (Objective: Green)
   - **A** = `ការវាយតម្លៃ និងរោគវិនិច្ឆ័យ` (Assessment: Amber)
   - **P** = `ផែនការព្យាបាល` (Plan: Purple)
