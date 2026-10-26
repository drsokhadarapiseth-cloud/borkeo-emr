# ANC orders sent once per visit, with a notice v47.8.0

Approved update (owner said "yes" on 26 October 2026; scope chosen: once per
visit). Only the ANC record page and the midwife's order checks change. Base
master d18bc5c (47.7.0); branch feature/maternity-anc-orders-once.

## Cause

- The "sent" message was written to the status line and immediately replaced
  by "Saved." (run()), so staff did not see that an order went; asking a
  doctor showed only "Saved.".
- Nothing stopped a second Laboratory / Imaging order (a second charge at the
  Cashier) or a second message to the doctor for the same test.

## What changed

- After sending: a green message at the top and a notice at the bottom of the
  screen for 6 seconds - Laboratory "បានបញ្ជូនទៅមន្ទីរពិសោធន៍៖ <test> ·
  អ្នកជំងឺបង់ប្រាក់នៅបេឡា។", Imaging "បានបញ្ជូនអេកូសាស្ត្រទៅផ្នែករូបភាព
  វេជ្ជសាស្ត្រ។ អ្នកជំងឺបង់ប្រាក់នៅបេឡា។", doctor "បានស្នើវេជ្ជបណ្ឌិតឱ្យចេញ
  សំណើ៖ <test>". Test names stay in English (Laboratory rule).
- The button is replaced by "✓ បានបញ្ជូនថ្ងៃនេះ" (sent today) or
  "✓ កំពុងរង់ចាំលទ្ធផល" (an earlier order still waiting for its result); it
  stays after a reload and on another computer (GET /api/anc/record
  `sentOrders`). The button is disabled while sending (no double click).
- Server (`ancSentOrders` / `ancOrderAlreadySent` in server/maternal.mjs): for
  the midwife, POST /api/paraclinic/orders and POST /api/maternal/ask-doctor
  return 409 `ALREADY_SENT` when the same test was sent today for this woman
  (any of her encounters) or an earlier order of it is not released; the page
  then shows "បានបញ្ជូនរួចហើយ។" and the note. A cancelled order does not
  count. Next visit the test can be sent again (CBC twice, several
  ultrasounds). Orders by doctors elsewhere are not limited by this rule (the
  existing Laboratory rule "same test once per encounter" is unchanged).

## Backup and data preservation

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.7.0-d18bc5c8-1f411f3c
(commit d18bc5c8ee9668c6badee9a4553eafc1c29a9f5e)

Restore with `npm run restore:code -- "<backup-directory>"` into a NEW folder.
No database migration; existing orders and messages are only read.

## Verification

- tests/v478-anc-orders-once.test.mjs (API, in-memory database, synthetic
  patient): HBsAg, ultrasound and OGTT / CBC requests once; the second gets
  409 ALREADY_SENT (lower-case test codes too); a waiting HBsAg blocks asking a
  doctor for it; the record lists what was sent; a released order and an old
  doctor request no longer block, a waiting ultrasound still does.
- Explicit browser check (headless Edge): HBsAg, ultrasound and OGTT sent; the
  notice and the green top message show the right Khmer text; each button
  became "sent today"; after a reload the notes remain and only CBC and blood
  group can still be sent; no JavaScript errors.
- Full `npm test` and `npm run check:khmer` results are in the update TXT.

Seen, not changed: the hint under the laboratory table ("Released Laboratory
results and the midwife's rapid tests are filled in automatically.") has no
approved Khmer yet (key anc.labsHint) and shows in English.
