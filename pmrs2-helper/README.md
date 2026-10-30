# Borkeo PMRS2 Helper (browser extension)

Stage 1 of the PMRS2 integration: copy a patient's identity and address from an
open **PMRS2 patient page** into **Borkeo EMR registration**. Staff review and save.

This helper does **not** sign in to PMRS2, does **not** save anything in PMRS2,
and stores **no** PMRS2 password or authenticator code. Staff log in to PMRS2
themselves, as usual.

## What it does

1. On a PMRS2 patient page, a floating **បញ្ចូនទៅ Borkeo** button appears.
2. Clicking it reads the visible patient fields (name, sex, date of birth, phone,
   health-card and equity-card numbers, province/district/commune/village,
   location, entry type, caregiver).
3. It opens Borkeo registration in a new tab with those fields pre-filled, matches
   the Khmer province/district/commune/village to the Borkeo gazetteer, and
   searches Borkeo for a possible existing patient (by health-card number, phone,
   then name).
4. Staff check the form, resolve any duplicate, and press **Save** in Borkeo.

## Install (Chrome or Edge, one computer at a time)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this `pmrs2-helper` folder.
4. Open the extension's **Options** (click the extension icon) and set the Borkeo
   EMR address (default `http://127.0.0.1:3001`; use the address staff open Borkeo
   with, e.g. `http://localhost:3002` for the referral copy).

## Notes and limits

- PMRS2 builds its pages with JavaScript and may change its field captions. The
  captions this helper looks for live in `pmrs2-fields.js`; if a field imports
  empty on the real site, adjust the caption there. No other file needs editing.
- The helper reads only what is visible on the current PMRS2 page. Name is split
  into family/given name on the first space for staff to correct.
- Stage 2 (export a Borkeo OPD record into the PMRS2 OPD/triage/prescription/
  discharge forms) is planned next and is not in this version.

## Files

- `manifest.json` — extension manifest (MV3).
- `pmrs2-fields.js` — PMRS2 captions mapped to Borkeo payload keys.
- `scrape.js` — reads the fields off the PMRS2 page.
- `pmrs2-content.js` — the button on PMRS2 pages.
- `borkeo-content.js` + `page-fill.js` — hand the data to Borkeo registration.
- `options.html` / `options.js` — set the Borkeo address.

## v51.2 import repair

Reload this unpacked extension, then refresh both PMRS2 and Borkeo tabs. Sign in
manually to Borkeo before sending. In extension Options choose the receiving
loopback origin (including port), e.g. http://127.0.0.1:3001 or
http://localhost:3002. Each instance must be selected explicitly.

Inline caption aliases and long names are supported. Pending details are scoped
to the selected origin and eligible for retry for ten minutes; they are
cleared only when registration acknowledges populated fields. On timeout, sign
in, refresh the registration tab and retry from PMRS2. A newer pending transfer
is not cleared by an older acknowledgement. Opening registration does not mean
the patient has been saved: staff still review and save. This remains Stage 1;
exporting clinical records into PMRS2 is not implemented.
