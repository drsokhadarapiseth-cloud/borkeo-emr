// Explicit code-only allowlist. Never package clinical data, credentials or .gitignore.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline='13ac56b';
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const files=[
 'CHANGELOG.md','package.json','docs/approved-new-khmer.json','docs/translations-needed.csv','docs/visit-history.md',
 'protected/patient-list.html','protected/triage.html','protected/record-viewer.html',
 'public/emr-encounter-editor.js','public/emr-permissions.js','public/login.html','public/patient-list.js','public/record-viewer.js','public/record-viewer.css',
 'server/access.mjs','server/encounter-access.mjs','server/requests.mjs','server/routes/clinical.mjs','server/routes/paraclinic.mjs','server/routes/patients.mjs','server/server.mjs',
 'tests/accessibility-quality-smoke.test.mjs','tests/v378-encounter-access.test.mjs','tests/v408-opd-soap-record.test.mjs','tests/v432-modern-consultation-workspace.test.mjs',
 'tests/v438-patient-list-dedup-and-actions.test.mjs','tests/v438-patient-visits.test.mjs','tests/v438-visit-history-browser.mjs','scripts/build-visit-history-update.mjs',
];
const git=(args,options={})=>spawnSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,...options});
const temporary=fs.mkdtempSync(path.join(root,'.validation-patch-'));
try{
 let patch='';const manifest=[];
 for(const file of files){
  const current=path.join(root,file),old=path.join(temporary,file),original=git(['show',`${baseline}:${file}`]),existed=original.status===0;
  if(existed){fs.mkdirSync(path.dirname(old),{recursive:true});fs.writeFileSync(old,original.stdout);}
  const diff=git(['diff','--no-index','--ignore-space-at-eol','--',existed?old.replaceAll('\\','/'):'/dev/null',current.replaceAll('\\','/')]);
  if(diff.status===0)continue;if(diff.status!==1)throw Error(`Cannot build patch for ${file}: ${diff.stderr}`);
  const lines=diff.stdout.replace(/\r\n/g,'\n').split('\n');lines[0]=`diff --git a/${file} b/${file}`;
  const hunk=lines.findIndex(line=>line.startsWith('@@'));
  for(let i=1;i<hunk;i++){if(lines[i].startsWith('--- '))lines[i]=existed?`--- a/${file}`:'--- /dev/null';if(lines[i].startsWith('+++ '))lines[i]=`+++ b/${file}`;}
  patch+=lines.join('\n');manifest.push(`${crypto.createHash('sha256').update(fs.readFileSync(current)).digest('hex')}  ${file}`);
 }
 const reverse=git(['apply','--reverse','--check','--ignore-space-change','-'],{input:patch});if(reverse.status!==0)throw Error(reverse.stderr);
 const forward=git(['apply','--check','--ignore-space-change','-'],{cwd:temporary,input:patch});if(forward.status!==0)throw Error(forward.stderr);
 const header=`Borkeo EMR ${version} - Patient visit history and discharge controls
Baseline commit: ${baseline}. Apply only to this baseline, preserving later changes.

One directory row per Health ID; latest visit dates; visit-specific Triage View;
OPD/IPD medical history with laboratory and imaging results; discharged visits
locked; treatment correction only after Director approval. All visits retained.
No database migration or patient-data replacement. See docs/visit-history.md.

INSTALLATION - follow one step at a time
The current working project already contains this update. Do not apply it twice.
1. Stop the server and use the existing hospital backup procedure.
2. For another matching baseline copy, give Antigravity this entire file and ask
   it to apply the unified patch only to the listed source files. Preserve .env,
   .gitignore, databases, uploads, backups, passwords and unrelated customizations.
3. Run npm test and npm run check:khmer in a disposable synthetic copy, then
   restart the existing launcher and refresh the browser.
4. Check returning visits, Triage date selection and discharge locks. Doctors
   request treatment corrections through the existing requests workflow.
Rollback restores only these source files from the baseline; retain patient data.

SHA-256 FILE MANIFEST (prepared workspace bytes)
${manifest.join('\n')}

BEGIN BORKEO ${version} UNIFIED PATCH
`;
 fs.writeFileSync(path.join(root,`Borkeo-EMR-v${version}-update.txt`),header+patch+`END BORKEO ${version} UNIFIED PATCH\n`);
 console.log(`Built combined update for ${version}: ${manifest.length} files; forward and reverse patch checks passed.`);
}finally{
 if(path.dirname(temporary)!==root||!path.basename(temporary).startsWith('.validation-patch-'))throw Error('Unsafe cleanup path');
 fs.rmSync(temporary,{recursive:true,force:true});
}
