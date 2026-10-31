import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';
const baseline='8c7382471488af8c13d2949aaf380d05c5254d8f';
const output='Borkeo-EMR-v51.6.0-pmrs-import-readiness-update.txt';
const run=args=>execFileSync('git',args,{encoding:'utf8'});
const files=run(['diff','--no-renames','--name-only',baseline]).trim().split('\n').filter(file=>file&&file!==output);
if(!files.every(safeCodePath))throw Error('Unsafe release path');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const records=files.map(file=>{
 let beforeSha256=null;
 try{beforeSha256=hash(execFileSync('git',['show',baseline+':'+file],{stdio:['ignore','pipe','ignore']}));}catch{}
 if(!fs.existsSync(file))return {file,action:'delete',beforeSha256};
 const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 return {file,action:'write',beforeSha256,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:hash(content),content};
});
fs.writeFileSync(output,`Borkeo EMR v51.6.0 — independent PMRS import/export readiness
Baseline v51.5.0 commit ${baseline}.
This patch fixes the import/export coupling. It DOES NOT enable an unverified
profile, invent mappings, or confirm the previous PMRS Save operation.
1. Inspect version and unfinished work. Back up clean code. Stop only the
   identified EMR launcher. Preserve all patient data, .env, .gitignore,
   uploads, backups, passwords, external profiles and diagnostic work.
2. Parse BEGIN_JSON_FILES as JSON with a script. For each existing file,
   compare SHA-256 of its LF-normalized UTF-8 content with beforeSha256.
   If it already equals the target sha256, skip it. If neither matches,
   STOP and review/merge local changes; do not overwrite customizations.
   A null beforeSha256 means a new file: do not replace an unexpected file.
3. Apply exact write/delete actions. Verify target bytes/SHA-256. Do not
   paste JSON escapes into source files. No hospital data paths are included.
4. In a disposable copy, run npm test, npm run check:khmer and
   node --test tests/pmrs-playwright-browser.mjs. Preserve failure evidence.
5. Restart the identified launcher and refresh /pmrs. Check importReady,
   exportReady and blockers from /api/pmrs/status while signed in.
Read docs/development/PMRS_IMPORT_READINESS_V516.md. Import needs verified
identity/read mappings and a configured profile path; export stays disabled
until independently verified. Never retry an unconfirmed Save to enable import.
Restore backups only into a NEW folder, never over live data/secrets.
BEGIN_JSON_FILES
`+JSON.stringify({baseline,version:'51.6.0',files:records},null,2)+'\nEND_JSON_FILES\n');
console.log(output+' ('+records.length+' code actions)');
