# IPD physical examination form - v50.8.0 validation

Owner request: make the IPD physical examination a clean, professional filling
form instead of the paper-style dotted layout. Proposal (label column, boxed
fields, left/right pairs on one row, compact GCS/pain/CRT, pill choices, clean
print) was confirmed by the owner with "yes". GCS total stays manual.

Baseline master 5a041e889f07f9cc32551ff70afada4efab269fa, package 50.7.0.
Clean code backup: C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.7.0-5a041e88-058fedfb.

## What changed (presentation only)

- `organizeIpdExam` builds each numbered card from explicit rows. The original
  controls, IDs, storage keys, frozen indexes and migration keys are moved, not
  recreated; the control-count guard still throws if any control is lost.
- Each caption remains the previous sibling of its control, so the SOAP
  Objective labels (for example "ភ្នែក ស្តាំ") are unchanged.
- Leading list markers and trailing colons are stripped from captions; a
  MutationObserver re-cleans them after a language rewrite.
- Boxed fields without resize handles; eyes and ears show ឆ្វេង/ស្តាំ on one row;
  pain, CRT and GCS E/V/M/total are short centred boxes; general condition and
  consciousness are pill choices; one column on phones.
- Print snapshot: grey headers, underlined values, normal buttons hidden.

No new Khmer strings, no data migration, no change to normal templates, SOAP
summarizer, permissions, clinical, pharmacy, laboratory or financial logic.

## Results

- `npm test` (PowerShell): 1,092/1,092 pass. Under Git Bash the code-backup
  test fails only because GNU tar parses `C:` as a remote host (environment).
- `npm run check:khmer`: pass.
- Browser workflows: ipd-soap-browser (with new caption/pair/boxed-field/label
  assertions), ipd-record-browser, ipd-cleanup-browser pass;
  clinical-summary-provider-browser passes alone (timed out only when run
  back-to-back with the other three).
- Synthetic screenshots reviewed: empty and filled form at 1440 px and 390 px,
  and the actual IPD print snapshot with a long wrapped finding.
