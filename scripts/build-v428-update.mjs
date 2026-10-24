// Development-only delivery helper. Reconstruct the approved, uncommitted
// v42.7 baseline before generating the NPCA patch. No patient files are read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const tracked=['.env.example','CHANGELOG.md','docs/approved-new-khmer.json','docs/approved-source-khmer.json','docs/translations-needed.csv','package.json','protected/EMR.html','public/emr-patient-record.js','public/login.html','public/patient-card-print.js','server/access.mjs','server/config.mjs','server/routes/patients.mjs','server/server.mjs','tests/accessibility-quality-smoke.test.mjs','tests/v338-restore-patient-card-print-modal.test.mjs','tests/v352-sticker-gap-customization.test.mjs','tests/v353-editable-sticker-count.test.mjs'];
const added=['protected/npca.html','public/npca.js','public/npca.css','public/npca-registration.js','public/npca-widget.js','public/npca-forms.js','scripts/import-npca-standards.py','scripts/build-v428-update.mjs','server/routes/npca.mjs','tests/helpers/npca-mock.mjs','tests/helpers/npca-fixtures.mjs','tests/v427-registration-card.test.mjs','tests/v428-npca.test.mjs',...fs.readdirSync('server/npca').map(f=>'server/npca/'+f),...fs.readdirSync('docs/npca').map(f=>'docs/npca/'+f)];
const git=(args,extra={})=>spawnSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024,...extra});
const base=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-427-base-'));
for(const file of tracked){
  const blob=git(['show','8c92552:'+file]);if(blob.status!==0)throw Error('Cannot read committed baseline '+file+': '+blob.stderr);
  const destination=path.join(base,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,blob.stdout);
}
const previous=fs.readFileSync('Borkeo-EMR-v42.7.0-update.txt','utf8').replace(/\r\n/g,'\n').split('FULL UNIFIED DIFF\n')[1];
if(!previous)throw Error('Missing approved v42.7 patch.');
const applied=git(['apply','--no-index','--ignore-space-change','-'],{cwd:base,input:previous});
if(applied.status!==0)throw Error('Cannot reconstruct v42.7: '+applied.stderr);
let full='';const files=[];
for(const file of [...new Set([...tracked,...added])]){
  const old=path.join(base,file),now=path.join(root,file),exists=fs.existsSync(old);
  const diff=git(['diff','--no-index','--ignore-space-at-eol','--',exists?old.replaceAll('\\','/'):'/dev/null',now.replaceAll('\\','/')]);
  if(diff.status===0)continue;if(diff.status!==1)throw Error(diff.stderr);
  const lines=diff.stdout.replace(/\r\n/g,'\n').split('\n'),hunk=lines.findIndex(line=>line.startsWith('@@'));
  lines[0]='diff --git a/'+file+' b/'+file;
  for(let i=1;i<hunk;i++){if(lines[i].startsWith('--- '))lines[i]=exists?'--- a/'+file:'--- /dev/null';if(lines[i].startsWith('+++ '))lines[i]='+++ b/'+file;}
  full+=lines.join('\n');files.push(file);
}
const header=`================================================================================
Borkeo EMR v42.8.0 - NPCA v1.4 integration (disabled by default)
================================================================================
Previous working version: 42.7.0
New version: 42.8.0
No real patient data changed or sent during development. No new runtime packages.

WHAT WAS WRONG
The EMR had no NPCA beneficiary identity link, clinical visit export, certification
submission queue, or processing status workflow.

WHAT CHANGED
Configurable settings and OAuth; verified Registration beneficiary selection;
official Excel mappings; visit builder and local validation; authorized durable
queue with retries and reconciliation; polling and review pages; optional clinical
assessment/referral fields; record/Billing badges; local mock and regression tests.
NPCA_ENABLED defaults false. Unknown mappings and missing clinical data block claims.
Existing stock and financial calculations and the v42.7 card/QR workflow remain.

FILES CHANGED
${files.join('\n')}

INSTALLATION - ANTIGRAVITY, ONE STEP AT A TIME
1. Use the current v42.7.0 project as the base. Stop the server and back up the
   hospital database using the existing backup procedure.
2. Apply the unified diff below to the listed code files only. Never replace
   data/, patient databases, backups, uploads, .env, or .gitignore.
3. Read docs/npca/INTEGRATION.md. Add NPCA settings from .env.example to the
   existing local .env, preserving unrelated settings. Leave NPCA_ENABLED=false.
4. Restart with Start-Borkeo-WiFi.bat and refresh the browser.
5. Test using synthetic patients and the local mock. Do not send real patients
   to any external development/test server.
6. Ask NPCA to resolve OPEN-QUESTIONS.md, supply test credentials and confirmed
   service mappings, and accept the synthetic payloads before enabling integration.

VALIDATION
See docs/npca/VERIFICATION.md for final test results. Tests run in a disposable
copy with synthetic fixtures and a loopback NPCA mock. The diff is verified
against a reconstructed v42.7 baseline. No live NPCA certification was performed.

WHAT STILL NEEDS NPCA CONFIRMATION
Credentials, endpoints/token encoding, eligibility fields, service codes, missing
Positivity values, referral documents, mixed-currency/discount rules, and actual
NPCA test-server acceptance. The earlier ANC chart redesign is a separate update.

FULL UNIFIED DIFF AGAINST v42.7.0
`;
fs.writeFileSync('Borkeo-EMR-v42.8.0-update.txt',header+full);
const checked=git(['apply','--reverse','--check','--ignore-space-change','-'],{input:full});
if(checked.status!==0)throw Error('Patch verification failed: '+checked.stderr);
fs.writeFileSync(path.join(os.tmpdir(),'borkeo-npca-release-manifest.json'),JSON.stringify({root,base,files,tracked,added},null,2));
console.log('Created v42.8 combined update: '+files.length+' files; patch verified.');
