import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {safeCodePath} from './code-backup.mjs';

const output='Borkeo-EMR-v51.1.0-pmrs2-text-scrape-update.txt';
const baseline='685eaeab82fd4aead5582fd7fee7540077ecf456';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])]
  .filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|pmrs2-helper\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{
  const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};
});
const header="Borkeo EMR v51.1.0 - PMRS2 helper reads plain-text summary pages\nBaseline 51.0.0, commit 685eaeab82fd4aead5582fd7fee7540077ecf456.\nAlready installed: do not apply twice.\n1. Back up code (npm run backup:code); stop only the identified EMR launcher.\n2. Preserve .env, all databases, uploads, API keys/grants, attachments, backups,\n   password exports, .gitignore, later customizations and user workspace files.\n3. Parse BEGIN_JSON_FILES; write each decoded content string as UTF-8/LF. Verify\n   byte counts and SHA-256. Do not write JSON escapes literally.\n4. Run npm test and npm run check:khmer.\n5. Reload the pmrs2-helper extension in the browser; restart the EMR launcher.\nThe PMRS2 helper scraper now reads values shown as plain text beside a caption\n(the PMRS2 patient summary page), the right-side info box (case number, health\ncard), and still editable form controls. It also reads the combined address\ncaption. Reload the pmrs2-helper extension folder for this to take effect.\nRestore archived code into a NEW folder; never overwrite live data/secrets.\nSee docs/development/AI_HANDOFF.md for evidence.\nBEGIN_JSON_FILES\n";
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');
console.log(JSON.stringify({output,files:records.length}));
