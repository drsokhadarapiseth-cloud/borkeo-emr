import fs from 'node:fs';
import crypto from 'node:crypto';
import { safeCodePath } from './code-backup.mjs';
const output='Borkeo-EMR-v51.3.0-pmrs2-paste-panel-update.txt';
const files=['package.json','server/server.mjs','public/login.html','public/pmrs2-panel.mjs','public/pmrs2-panel.css','public/pmrs2-paste.mjs','tests/pmrs2-paste.test.mjs','tests/pmrs2-import-browser.mjs','docs/approved-new-khmer.json','docs/translations-needed.csv','docs/development/AI_HANDOFF.md','scripts/build-v513-update.mjs'];
if(!files.every(safeCodePath))throw Error('Unsafe release file');
const records=files.map(file=>{const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};});
const header=`Borkeo EMR v51.3.0 - Extension-free PMRS2 paste-import panel
Baseline v51.2.0 commit 9208f3d4992e39ccaf7ecc3c59fac81428948d55.
Do not apply over later customizations without review.
1. Back up code. Restore archived code into a NEW folder only.
2. Preserve .env, .gitignore, databases, uploads, backups, keys, password exports,
   instance data and user workspace files. This is a code-only update.
3. Decode BEGIN_JSON_FILES into the listed UTF-8/LF files; verify byte lengths
   and SHA-256. Do not write literal JSON escape sequences into source files.
4. Run npm test and npm run check:khmer before activation.
5. Restart only the identified EMR launcher; refresh registration.
6. Open the PMRS2 import panel, open PMRS2 and sign in manually, copy ONE patient
   summary including field captions, paste, preview, review, then Apply.
7. Close the panel, check the registration and duplicates, and save manually.
No browser extension required. No password or authenticator code is stored.
Reverse export into PMRS2 and complete clinical-record import are not included.
No real PMRS2 account or patient data was used in validation.
BEGIN_JSON_FILES
`;
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
