# PMRS2 ID into other-card, case number separate - v51.0.0 validation

Owner refinement of Stage 1 (approved "yes"): store the PMRS2 patient ID in the
registration "other card" field (not the hospital health-card field) so it cannot
collide with hospital numbering, and keep the PMRS2 case number in its own
separate read-only field. Card type = "Other Card", issuer = "PMRS2". Decisions
confirmed by the owner: store both numbers, use the existing "Other Card" type,
and put the case number in a new dedicated field rather than combined with the ID.

Baseline master 10ad6bb9ffc261fcc191017c0f91779a40811e0f, package 50.9.0.
Clean code backup: C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.9.0-10ad6bb9-5076aa65\code.zip.

## What changed

- protected/EMR.html: a new read-only registration field `web_pmrs2_case_number`
  (labelled លេខករណី PMRS2) next to the EMR case number. It carries
  data-emr-no-auto-index, so existing records' saved field positions are
  unchanged and its storage key is scope:registration:id:web_pmrs2_case_number.
- public/pmrs2-import.mjs: the PMRS2 ID now fills the other-card number
  (web_other_card_number), with web_other_card_type = "4. Other Card",
  web_other_card_issuer = "PMRS2", and the "has other card" radio ticked without
  opening its modal; the PMRS2 case number fills the new read-only field; the
  health-card field (web_health_id) is no longer touched; duplicate search matches
  the PMRS2 ID with mode "other" (the other-card column), plus phone and name.
- pmrs2-helper/pmrs2-fields.js: the scraper also reads the PMRS2 case number
  (លេខករណី).

## Results

- npm test (PowerShell): 1,098/1,098 pass.
- npm run check:khmer: pass (the new label reuses the existing "លេខករណី" string;
  "PMRS2" is a separate non-Khmer span, so no new Khmer was introduced).
- tests/pmrs2-import-browser.mjs (Chromium): PMRS2 ID lands in the other-card
  number with type "4. Other Card" and issuer "PMRS2" and the radio ticked; the
  PMRS2 case number lands in the new read-only field; the hospital health-card
  field is not overwritten; the address resolves (province 08 + hierarchy); the
  duplicate is found by the other-card match; the extension event hand-off fills
  the other-card; and the scraper reads a caption-built form.
- Synthetic registration screenshot reviewed: EMR case number, separate
  "លេខករណី PMRS2" read-only field, other-card preview "4. Other Card |
  000-101-941-8 ( PMRS2 )", and the hospital health-card number untouched.

## Not claimed

- Not run against the live PMRS2 site; scraper captions remain in
  pmrs2-helper/pmrs2-fields.js for tuning. No PMRS2 login, no credential storage,
  no save in PMRS2.
