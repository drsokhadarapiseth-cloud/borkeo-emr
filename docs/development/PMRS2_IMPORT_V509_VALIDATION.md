# PMRS2 -> Borkeo registration import (Stage 1) - v50.9.0 validation

Owner request: integrate the PMRS2 government site (pmrs.digitalsp.gov.kh) with
Borkeo EMR. PMRS2 offers the owner no API. Agreed approach ("yes code it"): a
browser helper, with staff logging in to PMRS2 themselves. The owner asked to
auto-fill the Google Authenticator code to auto-login; this was declined because
it defeats 2FA on a government system and likely breaks its rules, so login stays
manual. Both directions were agreed, built one stage at a time. This is Stage 1
(PMRS2 identity/address -> Borkeo registration). Stage 2 (Borkeo OPD -> PMRS2 OPD
forms) is planned next.

Baseline master 142ca91c21302f73859304e755fd90dbe43bed43, package 50.8.0.
Clean code backup: C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.8.0-142ca91c-c8d6afb5\code.zip.

## What was built

- `public/pmrs2-import.mjs` (loaded on EMR.html): `window.applyPmrs2Registration(payload)`
  fills the registration form from a scraped PMRS2 payload, resolves the Khmer
  province/district/commune/village to the Borkeo gazetteer (reusing
  `window.restorePatientAddress`), and searches for a possible duplicate by
  health-card number, then phone, then name via `/api/emr-network/local-search`.
  It never saves; staff review and press Save. Pure helpers (normalise, name
  split, province containment match, address record) are exported for testing.
- `pmrs2-helper/` browser extension (MV3): a floating button on PMRS2 pages
  scrapes the patient fields by their Khmer captions, stores them, and opens
  Borkeo registration (`/emr?view=register&pmrs2Import=1`) pre-filled. A content
  script on Borkeo hands the payload to the page across worlds. Options page sets
  the Borkeo address. No PMRS2 credentials are read or stored.

## Safety and preservation

- No server data model, patient data, clinical/pharmacy/laboratory/financial
  logic, or NPCA/PMRS2 export mapping was changed.
- The helper's own Khmer (its small UI plus copies of PMRS2's external captions)
  is excluded from the EMR Khmer baseline (`scripts/khmer-lib.mjs` SKIP_DIRS),
  because it is not EMR UI text; the EMR's Khmer safety net is otherwise intact.
- Province/district/commune/village codes are resolved through the existing
  gazetteer; spelling differences (e.g. a province prefix) are matched by
  containment, and anything unresolved is left for staff to pick.

## Results

- `npm test` (PowerShell): 1,098/1,098 pass, including `tests/pmrs2-import.test.mjs`
  (normalise, family-name-first split, province containment match, padded code,
  address record).
- `npm run check:khmer`: pass.
- `tests/pmrs2-import-browser.mjs` (Chromium): on a synthetic Kandal patient built
  from the gazetteer, the registration form fills (family/given name, sex, DOB,
  phone, health-card, entry type, street); the province resolves to code 08 and
  the district/commune/village codes resolve through the hierarchy; a seeded
  patient is flagged as a duplicate by health-card number; the extension's
  data-attribute + event hand-off fills the form; and the scraper reads a
  PMRS2-like form built from the extension's own captions. No page errors.
- Synthetic desktop screenshot of the filled registration form reviewed.

## Not claimed

- The extension was not run against the real PMRS2 site (authenticated government
  system). Its scraping selectors in `pmrs2-helper/pmrs2-fields.js` may need
  tuning against the live page; captions are centralised there for that reason.
- No automatic PMRS2 login, no credential storage, no save in PMRS2.
