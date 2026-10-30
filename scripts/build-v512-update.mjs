import fs from 'node:fs';
import crypto from 'node:crypto';
import { safeCodePath } from './code-backup.mjs';
const output = 'Borkeo-EMR-v51.2.0-pmrs2-import-repair-update.txt';
const files = ['package.json','server/server.mjs','public/login.html','public/pmrs2-import.mjs','pmrs2-helper/manifest.json','pmrs2-helper/README.md','pmrs2-helper/scrape.js','pmrs2-helper/pmrs2-fields.js','pmrs2-helper/pmrs2-content.js','pmrs2-helper/borkeo-content.js','tests/pmrs2-helper.test.mjs','tests/pmrs2-import-browser.mjs','docs/development/AI_HANDOFF.md','scripts/build-v512-update.mjs'];
if (!files.every(safeCodePath)) throw Error('Unsafe code path');
const records = files.map(file => {const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};});
const header = `Borkeo EMR v51.2.0 - PMRS2 import repair
Baseline: v51.1.0 commit 207e5540e12212993f3d6080debef6503105aef6.
Do not reapply over later customizations. This is the focused Stage 1 import repair.
1. Back up code. Restore only into a NEW folder; never overwrite patient data.
2. Preserve .env, .gitignore, databases, uploads, backups, API keys, passwords,
   instance data and workspace customizations.
3. Decode BEGIN_JSON_FILES and write the listed UTF-8/LF contents. Verify bytes
   and SHA-256. Never write JSON escape sequences literally.
4. Run npm test and npm run check:khmer before activation.
5. Reload the unpacked pmrs2-helper extension, refresh both application tabs,
   and restart the identified EMR launcher. Sign in manually to Borkeo first.
6. Set the receiving loopback origin including its port in extension Options.
   Retry PMRS2 -> Borkeo and review all details before saving.
Reverse clinical export into PMRS2 remains unimplemented.
No real PMRS2 account or patient data was used for verification.
BEGIN_JSON_FILES
`;
fs.writeFileSync(output, header + JSON.stringify(records,null,2) + '\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
