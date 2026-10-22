# Borkeo EMR update preferences

For future development, discuss requested changes with the user one at a time. Confirm the agreed behavior and wait for an explicit instruction to code before editing. An explicit instruction such as "yes code it" authorizes the agreed update.

Use the latest project supplied by the user as the base. Preserve unrelated customizations and clinical, pharmacy, laboratory, and financial logic. Do not replace patient data when applying a code update.

Increase the release version by one minor step for each approved update: 19.6 -> 19.7 -> 19.8 -> 19.9 -> 20.0. Keep the visible version and package version consistent.

Validate in a disposable copy with synthetic fixtures. Deliver one combined update text file that Antigravity can read from the project folder, and an optional full project ZIP. Explain installation one step at a time; do not ask the user to paste many separate code blocks.

After every update is finished and verified (npm test and npm run check:khmer pass, update text file written), commit it and push it to GitHub automatically, without asking again. The project folder is a git working copy of the private repository drsokhadarapiseth-cloud/borkeo-emr, branch master. Before committing, check git status: patient data must never be pushed (data/*.sqlite, data/backups/, data/uploads/, password CSV files); keep .gitignore as it is. Write a commit message that says what changed and the new version. If a test fails, do not push; tell the user.

Default UI text must be in Khmer only. English is strictly reserved for when the interface language is switched to EN, unless the user explicitly orders English text. Do not display bilingual slash text (e.g. "Khmer / English"). Exception: Laboratory test names and lab test group names remain in English.

