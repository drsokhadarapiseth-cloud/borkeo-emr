import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {safeCodePath} from './code-backup.mjs';
const output='Borkeo-EMR-v50.3.0-network-search-chat-update.txt',baseline='04c09a43b6ffdaa65e93f267c2c4c4dfee5d9ae4';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only',baseline]),...git(['ls-files','--others','--exclude-standard'])])].filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(docs\/|protected\/|public\/|server\/|scripts\/|tests\/|package\.json$)/.test(f)))throw Error('Unexpected delivery file');
const records=files.map(file=>{const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');return {file,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content}});
const header=`Borkeo EMR v50.3.0 - Typed global search and private staff network
Baseline 50.2.0, commit ${baseline}.
Already installed working copy: do not apply twice. Fingerprint matching remains
unavailable until compatible hardware/SDK is supplied; no biometric is collected.
1. Take code and online database backups. Stop only the identified EMR process.
2. Review later customizations and preserve all live data, secrets and .gitignore.
3. Parse BEGIN_JSON_FILES. Write each decoded content string as UTF-8/LF to its
   file. Verify byte count and SHA-256; never write JSON escapes literally.
4. Receiver version overrides: package 50.3.0 -> 50.2.0 and visible/server
   v50.3 -> v50.2. Preserve the shared cache versions and original data paths.
5. Run npm test and npm run check:khmer in a disposable synthetic copy. Restart
   the existing launcher; the additive attachment table is created automatically.
6. Refresh both browsers using Ctrl+F5. Existing keys/grants remain unchanged.
Never replace hospital databases/uploads/.env with test data. Restore old code
into a NEW folder only; do not overwrite live data or delete attachment history.
See docs/development/NETWORK_SEARCH_CHAT_V503_VALIDATION.md for evidence/limits.
BEGIN_JSON_FILES
`;
fs.writeFileSync(output,header+JSON.stringify(records,null,2)+'\nEND_JSON_FILES\n');console.log(JSON.stringify({output,files:records.length}));
