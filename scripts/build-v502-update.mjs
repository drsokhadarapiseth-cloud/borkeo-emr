import fs from 'node:fs';import crypto from 'node:crypto';
const files=['package.json','public/login.html','server/server.mjs','public/app-shell.js','public/topbar-patient-search.mjs','tests/network-registration-browser.mjs','scripts/build-v502-update.mjs','docs/development/SEARCH_CLEANUP_V502_VALIDATION.md','docs/development/AI_HANDOFF.md'];
const records=files.map(file=>{const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content}});
const header=`Borkeo EMR v50.2.0 - Clean global patient search
Baseline 50.1.0, commit 048a516b0a5fcdb212ef5b8c897fed0de8f8fc5e.
Removes the gray read-only helper message beneath the facility selector.
Retains View and authorized Register at this hospital actions and all admission rules.
Already installed: do not apply twice.
1. Back up code and the live database using the existing online backup procedure.
2. Stop only the identified EMR process and review later customizations.
3. Parse the JSON array below. Write each content string as UTF-8/LF to its file;
   verify byte count and SHA-256. Do not write JSON escapes literally.
4. Receiver keeps independent versions: package 50.2.0 -> 50.1.0 and visible/server
   v50.2 -> v50.1. Preserve asset cache versions.
5. Preserve databases, .env, uploads, keys, grants, backups and .gitignore.
6. Run npm test and npm run check:khmer in a disposable synthetic copy, restart
   the original launcher, then refresh with Ctrl+F5.
Restore backups into a NEW folder; never overwrite patient data or secrets.
BEGIN_JSON_FILES
`;
fs.writeFileSync('Borkeo-EMR-v50.2.0-search-cleanup-update.txt',header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');console.log(JSON.stringify({files:records.length}));
