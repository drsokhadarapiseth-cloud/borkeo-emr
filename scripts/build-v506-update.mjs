import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';

const output='Borkeo-EMR-v50.6.0-ipd-cleanup-update.txt';
const baseline='640fc1bf41dde8e3da281297d29efec6e04b19e5';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])]
  .filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{
  const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};
});
const header="Borkeo EMR v50.6.0 - IPD display cleanup and pregnancy-history visibility\nBaseline primary 50.5.0, commit 640fc1bf41dde8e3da281297d29efec6e04b19e5.\nAlready installed: do not apply twice.\n1. Back up code and online databases; stop only the identified EMR launcher.\n2. Preserve .env, databases, uploads, keys/grants, attachments, backups, password\n   exports, .gitignore, later customizations and user workspace files.\n3. Parse BEGIN_JSON_FILES; write decoded content strings as UTF-8/LF. Verify\n   each payload byte count and SHA-256; do not write JSON escapes literally.\n4. Receiver overrides: package 50.6.0 to 50.5.0, visible/server v50.6 to v50.5.\n   Keep shared cache versions and original independent data paths.\n5. Verify in a disposable synthetic copy: npm test, npm run check:khmer and\n   doctor/nurse/read-only, female age boundary, diagnosis and allergy checks.\n6. Restart original launchers and refresh both browsers with Ctrl+F5.\nPregnancy history appears only for known females older than 13 completed years.\nHiding retains saved history. Primary diagnosis and medication checks remain.\nThe inline unverified-allergy notice and special/protocol add controls are hidden.\nActual allergy, interaction and overdose alerts and existing treatments remain.\nNo database migration, drug catalogue change, API pairing or patient import.\nRestore archived code into a NEW folder; never overwrite live data/secrets.\nSee docs/development/IPD_CLEANUP_V506_VALIDATION.md.\nBEGIN_JSON_FILES\n";
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
