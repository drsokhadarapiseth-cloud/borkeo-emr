import fs from 'node:fs';import crypto from 'node:crypto';import {safeCodePath} from './code-backup.mjs';
const output='Borkeo-EMR-v51.4.0-pmrs2-one-click-repair-update.txt';
const files=['package.json','public/login.html','server/server.mjs','public/pmrs2-import.mjs','public/pmrs2-panel.mjs','pmrs2-helper/manifest.json','pmrs2-helper/background.mjs','pmrs2-helper/connection.mjs','pmrs2-helper/pmrs2-content.js','pmrs2-helper/borkeo-content.js','pmrs2-helper/options.js','pmrs2-helper/options.html','pmrs2-helper/README.md','tests/pmrs2-helper.test.mjs','tests/pmrs2-extension-browser.mjs','tests/helpers/context-browser.mjs','docs/development/AI_HANDOFF.md','scripts/build-v514-update.mjs'];
if(!files.every(safeCodePath))throw Error('Unsafe release file');
const records=files.map(file=>{const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};});
const header=`Borkeo EMR v51.4.0 - One-click PMRS2 extension repair
Baseline v51.3.0 commit 2dd033b9a5669daf75e8c42e0b1065bf251e37fb.
Do not reapply over later changes without review.
1. Back up code. Restore archived code into a NEW folder only.
2. Preserve .env, .gitignore, databases, uploads, backups, keys, password exports,
   instance data and user workspace files. This package contains code only.
3. Decode BEGIN_JSON_FILES into the listed UTF-8/LF files. Verify byte lengths
   and SHA-256. Never write literal JSON escapes into source files.
4. Run npm test and npm run check:khmer before activation.
5. Restart only the identified updated EMR launcher; refresh its tabs.
6. Reload the unpacked pmrs2-helper extension. REFRESH the PMRS2 patient tab.
   Its helper status must show 51.4.0. Set the correct receiving loopback origin
   including port in helper Options. The receiving EMR needs this update too.
7. Click transfer once. If EMR asks for login, sign in in that same receiving tab.
   Wait for filled confirmation, review registration/duplicates, save manually.
No copy/paste required. No PMRS2 password or authenticator secret stored.
No clinical export or PMRS2 login automation. No live PMRS2 acceptance claimed:
real unpacked-extension validation used an intercepted synthetic page only.
See pmrs2-helper/README.md and docs/development/AI_HANDOFF.md.
BEGIN_JSON_FILES
`;
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');console.log(JSON.stringify({output,files:records.length}));
