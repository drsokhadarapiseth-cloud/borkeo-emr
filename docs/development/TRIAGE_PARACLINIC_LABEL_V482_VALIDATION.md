# Triage paraclinic label v48.2.0

Owner supplied the exact replacement Khmer label on 27 October 2026 and asked
for the GitHub push command after the update. Base 81bf338 (48.1.0).

The highlighted checkbox block now displays the supplied wording without its
former English explanation. The checkbox identifier, stored flag, no-auto-index
attribute and no-print behavior are preserved. Its English label is mapped for
the existing language system. Clinical, payment and transfer rules are unchanged.
The new Khmer phrase is recorded with owner provenance; no baseline is weakened.

Pre-update code-only snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v48.1.0-81bf3389-f066c2cf

Disposable source validation:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-paraclinic-label-yJ4bzo

`npm test` passed 1,064/1,064. `npm run check:khmer` passed. The synthetic browser
check confirmed the exact Khmer label, removed English paragraph, and interactive
checkbox. Logs are validation-tests.log, validation-khmer.log and
validation-browser.log; the screenshot is triage-label.png. No hospital data,
.env, uploads, backups or passwords were copied into the validation source.
`git diff --check` passed. The .gitignore and patient database are unchanged.

The combined update TXT contains complete UTF-8 replacement files for Antigravity
on the matching 48.1 base. Preserve unrelated later customizations and hospital
data. This task is committed/merged locally; GitHub publishing is left to the
user-requested command: `git -C "D:\EMR\Borkeo_EMR_Git" push origin master`.
