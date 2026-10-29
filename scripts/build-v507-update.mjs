import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';

const output='Borkeo-EMR-v50.7.0-ipd-colored-soap-update.txt';
const baseline='0bf6c03cd620125177f9351cfedb87a55157730a';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])]
  .filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{
  const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};
});
const header="Borkeo EMR v50.7.0 - Colored concise SOAP and head-to-toe IPD examination\nBaseline primary 50.6.0, commit 0bf6c03cd620125177f9351cfedb87a55157730a.\nAlready installed: do not apply twice.\n1. Back up code and online databases; stop only the identified EMR launcher.\n2. Preserve .env, all databases, uploads, API keys/grants, attachments, backups,\n   password exports, .gitignore, later customizations and user workspace files.\n3. Parse BEGIN_JSON_FILES; write each decoded content string as UTF-8/LF. Verify\n   byte counts and SHA-256. Do not write JSON escapes literally.\n4. Receiver overrides: package 50.7.0 to 50.6.0; visible/server v50.7 to v50.6.\n   Preserve shared cache versions and both installations original data paths.\n5. Run npm test, npm run check:khmer and relevant synthetic browser workflows.\n   Verify old record keys, doctor/nurse permissions, Save/reopen, read-only\n   historical text, remote rendering, full text at mobile widths and print/PDF.\n6. Restart the original launchers and refresh both browsers with Ctrl+F5.\nSOAP now has four editable colored sections, stored in the existing canonical\nnote and manual-protection flag. Existing manual notes remain protected; saved\nnotes are not regenerated in read-only view. Regeneration requires confirmation\nafter manual editing. Only fully documented normal systems become normal.\nMixed systems list non-template findings; unknown/partial systems are not inferred\nnormal. Unstructured free-text findings are retained exactly for clinical review.\nNumbered head-to-toe sections retain existing fields, IDs and storage keys.\nNarrative examination fields wrap and grow to show full text.\nThe IPD resuscitation-status box is hidden, preserving its underlying data/API.\nNo database migration, external AI, drug change, automatic connection or import.\nRestore archived code into a NEW folder; never overwrite live data/secrets.\nSee docs/development/IPD_COLORED_SOAP_V507_VALIDATION.md for evidence and limits.\nBEGIN_JSON_FILES\n";
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
