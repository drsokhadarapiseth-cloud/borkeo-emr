import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';
const baseline='9c5cfd5ba6f3240ca6745d21bfea911a9693766a';
const output='Borkeo-EMR-v51.7.0-chrome-import-update.txt';
const paths=execFileSync('git',['diff','--no-renames','--name-only',baseline],{encoding:'utf8'}).trim().split('\n').filter(file=>file&&file!==output);
if(!paths.every(safeCodePath))throw Error('Unsafe release path');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const files=paths.map(file=>{
 let beforeSha256=null;
 try{beforeSha256=hash(execFileSync('git',['show',baseline+':'+file],{stdio:['ignore','pipe','ignore']}));}catch{}
 if(!fs.existsSync(file))return {file,action:'delete',beforeSha256};
 const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 return {file,action:'write',beforeSha256,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:hash(content),content};
});
fs.writeFileSync(output,`Borkeo EMR v51.7.0 — Chrome PMRS registration transfer
Baseline v51.6.0 commit ${baseline}.
Creates a NEW extension and matching EMR receiver. Does not enable Playwright
profiles, save patients automatically, or modify PMRS records. Review then Save.
1. Inspect local version and unfinished work. Take a code-only backup. Preserve
   all patient data, uploads, .env, .gitignore, external profiles and diagnostics.
   Stop only the updated port-3001 launcher; leave the older port 3002 untouched.
2. Parse BEGIN_JSON_FILES as JSON. Compare SHA-256 of LF-normalized UTF-8
   current files against beforeSha256. If already at target sha256, skip.
   If neither matches, STOP and merge local work; never overwrite it.
   A null beforeSha256 means a new file; do not replace an unexpected file.
3. Apply the exact actions and verify result bytes/SHA-256. Do not paste JSON
   escapes into files. No data/secret paths are part of this update.
4. In a disposable code copy run npm test, npm run check:khmer, and
   node --test tests/pmrs-extension-browser.mjs tests/pmrs-playwright-browser.mjs.
   The installed-extension acceptance test is opt-in; see the README.
5. Restart port 3001 normally. Disable the old helper, install the new extension
   from tools/pmrs-chrome-import, and configure the exact EMR origin. Use normal
   Chrome, not the guarded Playwright window. No npm dependency change.
Read tools/pmrs-chrome-import/README.md. Registration-only draft fill, not a
confirmed patient save. Review duplicate warnings and local required fields.
No PMRS API needed. The receiver uses existing authenticated EMR routes and
the normal registration Save action; no new cross-origin write endpoint.
Restore backups into a NEW folder only, never over live data or secrets.
BEGIN_JSON_FILES
`+JSON.stringify({baseline,version:'51.7.0',files},null,2)+'\nEND_JSON_FILES\n');
console.log(output+' ('+files.length+' code actions)');
