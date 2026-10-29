// Code-only delivery. Binary font payloads must never pass through UTF-8 decoding.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {safeCodePath} from './code-backup.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output='Borkeo-EMR-v50.1.0-topbar-record-fonts-update.txt';
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only','1603850a9fdbf9a404a79fe2661ddd7f910c0cdd']),...git(['ls-files','--others','--exclude-standard'])])].filter(f=>f!==output&&!f.startsWith('.vscode/')).sort();
if(files.some(f=>!safeCodePath(f)||! /^(?:docs\/|protected\/|public\/|server\/|scripts\/|tests\/|package\.json$)/.test(f)))throw Error('Unexpected delivery path');
const records=files.map(file=>{const binary=file.endsWith('.ttf'),bytes=binary?fs.readFileSync(path.join(root,file)):Buffer.from(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'));return {file,encoding:binary?'base64':'utf8',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,payload:binary?bytes.toString('base64'):bytes.toString('utf8')}});
let text=`Borkeo EMR v50.1.0 - Topbar patient search, styled read-only records and local Khmer fonts
Baseline: 50.0.0, 1603850a9fdbf9a404a79fe2661ddd7f910c0cdd
Already installed working copy: do not apply twice.
1. Take code and online database backups; stop only the identified EMR listener.
2. Review later customizations. Apply only manifest paths to a matching baseline.
3. BEGIN_FILE payloads are UTF-8, LF normalized. BEGIN_BINARY_FILE payloads are
   base64: decode directly to bytes. Verify the manifest SHA-256 of decoded bytes.
   Preserve trailing newline by using each manifest byte count.
4. Preserve .env, live databases, uploads, keys, backups, passwords and .gitignore.
5. Receiver version overrides only package.json 50.1.0 -> 50.0.0 and visible/server
   v50.1 -> v50.0. Keep both installations' original environment/data paths.
6. Run npm test and npm run check:khmer in a disposable synthetic copy; restart
   the original launch command and refresh the browser with Ctrl+F5.
Restore archived code into a NEW folder, never over live data or secrets.
See docs/development/TOPBAR_RECORD_FONTS_V501_VALIDATION.md for evidence.

MANIFEST
${JSON.stringify(records.map(({payload,...r})=>r),null,2)}
END_MANIFEST
`;
for(const r of records)text+=`\n${r.encoding==='base64'?'BEGIN_BINARY_FILE':'BEGIN_FILE'} ${r.file}\n${r.payload}\n${r.encoding==='base64'?'END_BINARY_FILE':'END_FILE'} ${r.file}\n`;
fs.writeFileSync(path.join(root,output),text);for(const r of records){const bytes=r.encoding==='base64'?Buffer.from(r.payload,'base64'):Buffer.from(r.payload);if(bytes.length!==r.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==r.sha256)throw Error('Payload mismatch: '+r.file)}console.log(JSON.stringify({output,files:records.length,binary:records.filter(r=>r.encoding==='base64').length}));
