import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {safeCodePath} from './code-backup.mjs';
const output='Borkeo-EMR-v50.4.0-search-popup-qr-update.txt',baseline='4337ce770697f4205a1f17b02221b99f3fa0ccb5';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])].filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content}});
const header=`Borkeo EMR v50.4.0 - Submitted search icons, separate results and QR camera
Baseline 50.3.0, commit ${baseline}. Already installed: do not apply twice.
1. Take code and online database backups; stop only the identified EMR launcher.
2. Review later customizations. Preserve .env, live databases, uploads, keys,
   attachments, backups, passwords, .gitignore and unrelated workspace files.
3. Parse BEGIN_JSON_FILES. Write each decoded content string as UTF-8/LF to its
   file. Verify byte counts and SHA-256; do not write JSON escapes literally.
4. Receiver overrides: package 50.4.0 -> 50.3.0; visible/server v50.4 -> v50.3.
   Preserve shared cache versions and both installations' original data paths.
5. Run npm test and npm run check:khmer in a disposable synthetic copy. Restart
   the original launchers; no data migration/search index is part of this update.
6. Refresh with Ctrl+F5. Enter/Search submits Patient ID. Advanced search opens
   a popup. QR scans automatically open results; admission always requires action.
Phone camera needs HTTPS and permission. This does not configure HTTPS hosting.
Fingerprint matching still needs compatible equipment. No real hardware or
million-patient/30-server load-test acceptance is claimed.
Restore archived code into a NEW folder only; never overwrite live data/secrets.
See docs/development/SEARCH_POPUP_QR_V504_VALIDATION.md for evidence/limits.
BEGIN_JSON_FILES
`;
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');console.log(JSON.stringify({output,files:records.length}));
