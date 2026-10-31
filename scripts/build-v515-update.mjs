import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';
const baseline='a830a8b52b44355e669f29de2a8358ccd0867943';
const output='Borkeo-EMR-v51.5.0-pmrs-playwright-update.txt';
const files=execFileSync('git',['diff','--no-renames','--name-only',baseline],{encoding:'utf8'}).trim().split('\n').filter(file=>file&&file!==output);
if(!files.every(safeCodePath))throw Error('Unsafe release path');
const records=files.map(file=>{
 if(!fs.existsSync(file))return {file,action:'delete'};
 const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 return {file,action:'write',encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};
});
fs.writeFileSync(output,`Borkeo EMR v51.5.0 — PMRS browser transfer with Playwright
Baseline v51.4.0 commit ${baseline}. Do not reapply over later customizations.
Live PMRS transfer remains DISABLED pending verified authorized site mappings.
1. Back up code. Stop only the identified EMR launcher; disable the old PMRS2
   Helper extension. Preserve .env, .gitignore, all hospital databases, uploads,
   backups, keys/grants, password exports and unrelated customizations.
2. Read BEGIN_JSON_FILES as JSON. For action=write, decode content as UTF-8/LF
   and verify bytes/SHA-256. For action=delete, remove only that exact code path.
   Never delete hospital data or run old PMRS2 bundles to restore these paths.
3. Run npm ci, npx playwright install chromium, npm test, npm run check:khmer.
   Linux backup restore requires BSD tar, as documented in the setup guide.
4. Restart the desktop EMR launcher and refresh the browser. Read
   docs/development/PMRS_PLAYWRIGHT_V515.md before configuring a live connection.
No PMRS passwords, authenticator codes, cookies or browser profiles belong in
this project. The visible browser runs on the computer that runs the EMR server.
Rollback: restore the code backup into a NEW folder, never over live data/secrets.
BEGIN_JSON_FILES
`+JSON.stringify({baseline,version:'51.5.0',files:records},null,2)+'\nEND_JSON_FILES\n');
console.log(output+' ('+records.length+' code file actions)');
