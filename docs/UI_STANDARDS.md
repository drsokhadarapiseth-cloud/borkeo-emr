# Borkeo EMR — UI/UX Standards & Usability Conventions (v39.7)

This document establishes the UI/UX design standards, accessibility alignment, and medical usability engineering conventions implemented across Borkeo EMR.

---

## 1. Regulatory & Usability Alignment

### 1.1 WCAG 2.2 Level AA Alignment
The interface presentation layer is designed to conform with **WCAG 2.2 Level AA**:
- **1.4.1 Use of Color (Level A)**: Color is never used as the sole method of conveying clinical status, alert level, or criticality.
  - *Lab abnormal/critical flags*: Always accompanied by text and icons (`▼ Low`, `▲ High`, `⚠️▼ Crit Low`, `⚠️▲ Crit High`).
  - *SOAP clinical note sections*: Identified by large letter badges (S / O / A / P), Khmer category headers, and icons in addition to color accents.
  - *Worklist status chips*: Combine distinctive background hues, border contrast, SVG icons, and explicit Khmer text (`រង់ចាំ`, `កំពុងពិនិត្យ`, `បានបញ្ចប់`, `បន្ទាន់`).
- **1.4.3 Contrast (Minimum) (Level AA)**:
  - Body and table text maintains a minimum contrast ratio of **4.5:1** against backgrounds.
  - Bold headers and large text maintain at least **3.0:1** contrast.
  - Essential UI components and form input borders meet or exceed **3.0:1**.
  - Verified across both light and dark themes (see `docs/contrast-report.md`).
- **2.1 Keyboard Accessible (Level A & AA)**:
  - Every interactive control (buttons, search palette, sidebar navigation, form inputs, modal dialogs) is keyboard operable.
  - Skip-to-content links (`.skip-link`) bypass navigation bars directly to primary clinical workflows.
  - Command palette (`Ctrl+K`) allows rapid keyboard-driven patient search across all views.
  - Modal dialogs trap focus and release focus cleanly on `Escape` or action execution.
- **2.3.3 Animation from Interactions (Level AAA guidance applied)**:
  - `@media (prefers-reduced-motion: reduce)` is honored globally across all CSS files, neutralizing CSS transitions and animations for users sensitive to motion.
- **2.4.7 Focus Visible (Level AA)**:
  - All interactive elements render a prominent, high-contrast focus ring (`:focus-visible`) with explicit outline offset.
- **2.5.8 Target Size (Minimum) (Level AA)**:
  - All touch and click targets across forms, tables, and toolbars meet or exceed 24×24 CSS pixels with adequate spacing, with standard touch targets sized at 40-48px.

### 1.2 IEC 62366-1 Medical Usability Engineering Alignment
- **Error Prevention and Forgiveness**:
  - Destructive actions (e.g. discharging patients, canceling orders) require explicit accessible confirmation via modal dialogs rather than accidental single clicks.
  - Stale-save conflict detection prevents silent overwrite of clinical documentation when multiple clinicians review records simultaneously.
- **Cognitive Load Reduction**:
  - Persistent sticky patient banner across clinical screens (OPD/IPD form, lab, imaging, pharmacy, cashier) guarantees continuous patient identification (Photo, Name, Age/Sex, Case ID, Health ID, Allergies, Payer type).
  - Clear visual chunking of doctor follow-up notes into color-coded SOAP quadrants (Subjective, Objective, Assessment, Plan).
  - Real-time autosave indicators (`កំពុងរក្សាទុក…`, `បានរក្សាទុក`, `មិនអាចរក្សាទុក`) reassure clinicians that input is persisted.

### 1.3 Strict Local Security & Zero External CDN Dependencies
- All fonts (`Battambang`, `Moul`) are served strictly as local font files located in `/public/fonts/`.
- All icons are served via local SVG sprites (`/public/icons.svg`) or embedded inline SVGs.
- No third-party CDN scripts or styles are loaded, strictly complying with the local offline server Content Security Policy (CSP).

### 1.4 Strict Khmer-First Language Architecture
- In accordance with national medical records regulations and hospital workflow requirements, the default user interface is exclusively in Khmer (`km`).
- English is strictly reserved for when the interface language is intentionally toggled to EN.
- Bilingual slash labels (e.g., `Khmer / English`) are prohibited.
- Exception: Laboratory test names and lab test group codes remain in standardized English/Latin medical terms.

---

## 2. Explicit Non-Claims & Boundaries

To ensure complete clarity regarding regulatory and technical boundaries, the following **are NOT claimed**:

1. **No Formal Regulatory Certification**:
   - Borkeo EMR has not been formally certified as a medical device software (SaMD) under FDA 510(k), EU MDR 2017/745, or ISO 13485.
   - Alignment with IEC 62366-1 principles represents adherence to user-interface usability design best practices, not an accredited third-party certification.

2. **No FHIR / HL7 Conformance Claim**:
   - The current internal database schema and JSON REST endpoints are purpose-built for high-speed local offline clinic operation and Cambodia PMRS2 national reporting.
   - Borkeo EMR does not claim compliance with HL7 FHIR R4/R5 or HL7 v2 messaging standards.

3. **No Direct Device Hardware Control**:
   - The software does not directly control physical medical hardware or life-support telemetry monitors. Vitals and lab results are entered manually or received via verified file imports.

---

## 3. Architecture Summary

| Phase | Component | Key Standards & Conventions |
|---|---|---|
| **Phase 1** | Design System (`design-system.css`) | 4.5:1 text contrast, 3:1 UI contrast, light/dark themes, local fonts, SOAP variables |
| **Phase 2** | Shared Components (`components.css`, `components.js`) | Accessible buttons, inputs, tables, status chips, modals, toasts, `/styleguide` |
| **Phase 3** | App Shell & Navigation (`app-shell.css`, `app-shell.js`) | Role-based collapsible sidebar, `Ctrl+K` patient search, skip link, breadcrumbs |
| **Phase 4** | Patient Banner & Chart (`patient-banner.css`, `patient-banner.js`) | Sticky demographic banner, allergy badges, chart tab layout, vitals summary |
| **Phase 5** | SOAP Note for Doctors (`soap-note.css`, `soap-note.js`) | 4-box SOAP layout, S/O/A/P letter badges, autosave badge, legacy note compatibility |
| **Phase 6** | Clinical Data Display (`clinical-data.css`, `clinical-data.js`) | Multi-modal lab flags, tabular nums, inline SVG vitals sparklines, A4 print letterhead |
| **Phase 7** | Worklists, Forms & Feedback (`worklists-feedback.css`, `worklists-feedback.js`) | Sticky headers, status chips, localStorage filter persistence, accessible modal dialogs |
| **Phase 8** | Accessibility & Quality | Automated checks, visible focus, reduced motion, UI smoke test suite, full documentation |
