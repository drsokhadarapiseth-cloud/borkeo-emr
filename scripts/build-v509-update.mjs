import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';

const output='Borkeo-EMR-v50.9.0-pmrs2-import-update.txt';
const baseline='142ca91c21302f73859304e755fd90dbe43bed43';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])]
  .filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|pmrs2-helper\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{
  const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};
});
const header="Borkeo EMR v50.9.0 - PMRS2 to Borkeo registration import (Stage 1)\nBaseline 50.8.0, commit 142ca91c21302f73859304e755fd90dbe43bed43.\nAlready installed: do not apply twice.\n1. Back up code (npm run backup:code); stop only the identified EMR launcher.\n2. Preserve .env, all databases, uploads, API keys/grants, attachments, backups,\n   password exports, .gitignore, later customizations and user workspace files.\n3. Parse BEGIN_JSON_FILES; write each decoded content string as UTF-8/LF. Verify\n   byte counts and SHA-256. Do not write JSON escapes literally.\n4. Run npm test and npm run check:khmer.\n5. Restart the EMR launcher and refresh the browser with Ctrl+F5.\nStage 1 copies patient identity and address from an open PMRS2 patient page into\nBorkeo registration, via the pmrs2-helper browser extension. Staff sign in to\nPMRS2 themselves; the helper never signs in, never saves, and stores no PMRS2\npassword or authenticator code. It fills the registration form, resolves the\nKhmer province/district/commune/village to the Borkeo gazetteer and flags a\npossible duplicate; staff review and press Save. Install the extension per\npmrs2-helper/README.md. Stage 2 (Borkeo OPD into the PMRS2 OPD forms) is not in\nthis version. Restore archived code into a NEW folder; never overwrite live\ndata/secrets. See docs/development/PMRS2_IMPORT_V509_VALIDATION.md for evidence.\nBEGIN_JSON_FILES\n";
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
