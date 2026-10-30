import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';

const output='Borkeo-EMR-v51.0.0-pmrs2-id-card-update.txt';
const baseline='10ad6bb9ffc261fcc191017c0f91779a40811e0f';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])]
  .filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|pmrs2-helper\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{
  const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};
});
const header="Borkeo EMR v51.0.0 - PMRS2 ID into the other-card field, case number separate\nBaseline 50.9.0, commit 10ad6bb9ffc261fcc191017c0f91779a40811e0f.\nAlready installed: do not apply twice.\n1. Back up code (npm run backup:code); stop only the identified EMR launcher.\n2. Preserve .env, all databases, uploads, API keys/grants, attachments, backups,\n   password exports, .gitignore, later customizations and user workspace files.\n3. Parse BEGIN_JSON_FILES; write each decoded content string as UTF-8/LF. Verify\n   byte counts and SHA-256. Do not write JSON escapes literally.\n4. Run npm test and npm run check:khmer.\n5. Restart the EMR launcher and refresh the browser with Ctrl+F5.\nThe PMRS2 import now stores the PMRS2 patient ID in the registration other-card\nfield (type Other Card, issuer PMRS2), not the hospital health-card field, so it\ncannot collide with hospital numbering. The PMRS2 case number is saved in a new\nread-only registration field of its own. Duplicate search matches the PMRS2 ID\nagainst the other-card field. The new field uses data-emr-no-auto-index so saved\nrecord positions are unchanged. Reinstall the pmrs2-helper extension folder.\nRestore archived code into a NEW folder; never overwrite live data/secrets.\nSee docs/development/PMRS2_IDCARD_V510_VALIDATION.md for evidence.\nBEGIN_JSON_FILES\n";
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
