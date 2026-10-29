import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';

const output='Borkeo-EMR-v50.8.0-ipd-exam-form-update.txt';
const baseline='5a041e889f07f9cc32551ff70afada4efab269fa';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])]
  .filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{
  const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};
});
const header="Borkeo EMR v50.8.0 - Clean professional IPD physical examination form\nBaseline 50.7.0, commit 5a041e889f07f9cc32551ff70afada4efab269fa.\nAlready installed: do not apply twice.\n1. Back up code (npm run backup:code); stop only the identified EMR launcher.\n2. Preserve .env, all databases, uploads, API keys/grants, attachments, backups,\n   password exports, .gitignore, later customizations and user workspace files.\n3. Parse BEGIN_JSON_FILES; write each decoded content string as UTF-8/LF. Verify\n   byte counts and SHA-256. Do not write JSON escapes literally.\n4. Run npm test and npm run check:khmer.\n5. Restart the EMR launcher and refresh the browser with Ctrl+F5.\nThe IPD physical examination now uses a label column with boxed fields,\nleft/right eye and ear on one row, compact pain/CRT/GCS boxes and pill choices.\nPresentation only: same fields, IDs and storage keys; no database migration;\nSOAP wording unchanged; GCS total stays manual.\nRestore archived code into a NEW folder; never overwrite live data/secrets.\nSee docs/development/IPD_EXAM_FORM_V508_VALIDATION.md for evidence.\nBEGIN_JSON_FILES\n";
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
