# Borkeo EMR branching workflow

This package adds development tools and documentation to the supplied v45.5.0 archive. It does not split or change clinical forms, API behavior, database schema, patient records, UI, release version, or application logic. The uploaded archive's package.json actually declares 45.4.0; record that mismatch before the next application release.

## Install into your existing Git checkout

The ZIP supplied to ChatGPT has no .git directory. It cannot preserve or replace the commit history of your existing repository. This package is an overlay containing only new files. Extract it into a separate folder first. Copy scripts/, tests/, and docs/ from the overlay into the matching folders of your existing EMR checkout. Do not replace the entire project directory. Do not copy any patient database, uploads, passwords or .env. The START_HERE.txt file provides a complete instruction for Codex/Gemini/OpenCode to perform this installation and validate it.

Commit only the added tooling paths after validation. Do not use git add . for this installation. Existing application test failures must be resolved before pushing under the existing AGENTS.md policy. This delivery has not been pushed or merged anywhere.

## Choose the work area

Run from your actual EMR repository root:

```bash
node scripts/emr-branch.mjs list
```

The IDs cover registration, triage, OPD, IPD, nursing, maternity, vaccination, beds, lab, imaging, pharmacy, stock, cashier, finance, reports, permissions, NPCA, requests, messages, surgery, shell, platform, and development.

MODULE_MAP.md lists current frontend/backend/shared files, suggested tests and practical verification for each module. modules.json stores the machine-readable map. Test suggestions are hints, not complete test coverage.

## Start an update

First fetch and fast-forward the stable branch in your existing checkout. The supplied AGENTS.md identifies master as the stable branch; the helper also supports repositories using main. Fetch failures or divergence must be resolved before proceeding; never reset or force push to bypass them.

```bash
git fetch origin
git switch master
git pull --ff-only
node scripts/emr-branch.mjs start opd improve-prescription-form
```

This creates feature/opd-improve-prescription-form from master and switches to it. Use a fresh, descriptive task name each time. Only one task branch is needed for the update you are doing. Do not pre-create permanent department branches.

The helper rejects dirty worktrees, tracked runtime databases/secrets, unknown module IDs, invalid task names, non-base current branches, existing branch names, and divergence from a configured cached upstream. It does not fetch automatically, so the fetch step is necessary. With no configured upstream, it can check only the local base.

## Create an actual second working folder

If you want the stable checkout and OPD task open at the same time, use this instead of the start command, while on updated master:

```bash
node scripts/emr-branch.mjs worktree opd improve-prescription-form ../Borkeo_EMR-opd
```

Git creates a new branch and directory, shares repository history, and leaves the original checkout on master. It does not copy ignored .env files or databases. Each worktree has its own source files. Worktrees and branches do not automatically isolate runtime data: the app's default production database can still point to the same hospital data directory.

Do not start a test server against the hospital database. Configure a unique disposable DATABASE_PATH, DATA_DIR and PORT for test use, or run the in-memory test fixtures. Check server/config.mjs before launching. Never copy the hospital .env or production credentials to a test worktree. The existing thirty-patient seed script resets the database path supplied to it; run it only in a disposable validation copy with data/demo.sqlite, never on hospital data.

## Edit and inspect the scope

Edit the primary files identified in MODULE_MAP.md. For example, OPD includes public/opd-* and public/emr-consultation-workspace.*, but its form and save paths also span protected/EMR.html, server/routes/patients.mjs and shared clinical helpers.

```bash
node scripts/emr-branch.mjs review opd
```

The report combines commits since the merge-base with master/main, staged and unstaged changes, and untracked non-ignored files. It labels files primary, shared or outside-module; lists other mapped areas and suggested tests; and flags runtime data/secrets. The tool does not inspect patient data contents, block all outside-module work, enforce folder permissions, or prove isolation. Unknown files need manual review. Ignore rules are not protection for files already tracked by Git.

If a shared file changes, verify its other consumers. In particular:

- protected/EMR.html contains several forms, inline scripts, storage keys and print layouts.
- server/routes/patients.mjs connects registration, clinical records, pharmacy, finance, transfers and NPCA.
- server/server.mjs has explicit static-file/page maps; moving assets without updating these breaks routes.
- server/database.mjs and record JSON keys affect multiple services and existing records.
- public/paraclinic.js and server/paraclinic.mjs connect lab, imaging, payment and results.
- shared CSS, translations, permissions and navigation affect several roles/pages.

## Validate and merge

Use a disposable copy with synthetic fixtures for npm test and npm run check:khmer. Browser-smoke the relevant role, save/reload and print flows listed in MODULE_MAP.md. Compare failures against VALIDATION.md. Do not declare the application suite green if it still fails. The existing AGENTS.md disallows pushing when tests fail.

After reviewing the diff, commit only the intended paths on the task branch. Once all required checks pass, push that task branch and open a pull request to master (or main). Keep the stable branch as the deployment source and check your host's existing automatic-deployment settings before a merge. After the pull request is merged, update the stable checkout and delete the completed task branch when no longer needed. Avoid long-lived branches per department because they drift away from each other.

If using a local merge instead of a pull request, first update the base, then run git merge --no-ff feature/opd-improve-prescription-form with a descriptive message, resolve any conflicts, and rerun relevant checks before pushing. Never force merge, silently accept all conflicts, or treat switching branches as a database rollback.

## Future physical separation

Branching is ready without a large refactor. A future separately approved task can extract one form at a time from protected/EMR.html and reduce shared routes. Preserve existing record keys, API contracts, Khmer text, form IDs, print layouts, role checks, clinical and financial behavior. Verify each extraction before doing the next module. A module directory or Git branch is not a guarantee against regressions.
