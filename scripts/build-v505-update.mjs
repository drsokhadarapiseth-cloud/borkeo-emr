import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';

const output='Borkeo-EMR-v50.5.0-ipd-soap-history-update.txt';
const baseline='8272cbb65387da67fdbdb805bfb78fde85d12f44';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])]
  .filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{
  const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};
});
const header=`Borkeo EMR v50.5.0 - IPD layout, editable SOAP draft and pregnancy history
Baseline 50.4.0, commit ${baseline}. Already installed: do not apply twice.
1. Take code-only and online database backups. Stop only the identified EMR.
2. Preserve later customizations, .env, all live databases, uploads, attachments,
   API keys/grants, password exports, backups, .gitignore and user workspace files.
3. Parse BEGIN_JSON_FILES. Write each decoded content string as UTF-8/LF to its
   file. Verify bytes and SHA-256. Do not write JSON escapes literally.
4. Receiver overrides: package 50.5.0 -> 50.4.0; visible/server v50.5 -> v50.4.
   Preserve shared cache versions and both installations' original data paths.
5. Run npm test and npm run check:khmer in a disposable synthetic copy. Check
   doctor/nurse permissions, original triage preservation, Save/reopen, remote
   read-only review, desktop/mobile and print. Restart original launchers.
6. Refresh with Ctrl+F5. SOAP drafts use entered current-visit fields and must be
   reviewed before Save/signing. Manual edits persist until explicit regeneration.
Past pregnancy does not establish current pregnancy. Unknown remains unknown.
Drug catalogue, stock, prices, dose tables and interaction rules are unchanged.
Medscape is a fixed manual reference link only: no API, scraping, automated CDS,
stored Medscape password, external AI or patient-data query is included.
No database migration, automatic clinical import or API pairing is included.
Restore archived code into a NEW folder only; never overwrite live data/secrets.
See docs/development/IPD_SOAP_HISTORY_V505_VALIDATION.md for evidence and limits.
BEGIN_JSON_FILES
`;
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
