import fs from 'node:fs';import crypto from 'node:crypto';import {safeCodePath} from './code-backup.mjs';
const before={
  "package.json": "e99d672bba46c8e4f9b7c82c6a8557dbcf01c553e6f9941f7d7807a7f66e0c47",
  "package-lock.json": "56ff06ba7ff834e6741f1ef7a680008a7f5ddb4dc1756bb92c3f3ae5ff59aa10",
  "protected/EMR.html": "eb9cdc2c598761a850fab080af457f9886f67ae3c2e97b5fbeb9248d21b21460",
  "public/patient-photo.css": "dbcc8ffd78408cb97f44ebaddc3f0a4aa753b4b8a6c88732bfaede2d90613d2b",
  "public/login.html": "9ddb3c8e84dad23b79ebc8dface64894c32cca9eb7278de7d6140bef572f010c",
  "server/server.mjs": "99d4b4ff7604024bca26a113505b26bed3f4466399b1e2bb0c2bef642e3d391d"
};
const files=['package.json','package-lock.json','protected/EMR.html','public/patient-photo.css','public/login.html','server/server.mjs','docs/development/FINGERPRINT_PHOTO_V518_HANDOFF.md','scripts/build-v518-update.mjs'];
if(!files.every(safeCodePath))throw Error('Unsafe update file');
const records=files.map(file=>{const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');return {file,action:'write',beforeSha256:before[file]??null,encoding:'utf8',bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),content};});
const output='Borkeo-EMR-v51.8.0-registration-fingerprint-layout-update.txt';
const header=`Borkeo EMR v51.8.0 - Fingerprint enrollment below registration photo
Baseline working code v51.7.0. Preserve unrelated customizations and unfinished work.
1. Take a code-only backup; restore only into a NEW folder, never over live data.
2. Preserve .env, .gitignore, databases, uploads, backups, passwords, external PMRS
   profiles, diagnostics and user workspace/extension extraction files.
3. Parse standalone BEGIN_JSON_FILES/END_JSON_FILES. Before every replacement,
   compare SHA-256 of LF-normalized current UTF-8 content to beforeSha256.
   If already at target hash, skip. Stop/merge unexpected differences.
4. Write decoded UTF-8/LF content and verify target byte counts/SHA-256.
5. In a disposable code copy run npm test and npm run check:khmer; inspect
   registration at desktop/narrow widths. Do not use live patient data.
6. When ready to activate, restart only the identified updated EMR and refresh
   registration. Keep other EMR instances and all PMRS settings unchanged.
Only layout and version metadata change; fingerprint/photo behavior is preserved.
BEGIN_JSON_FILES
`;
fs.writeFileSync(output,header+JSON.stringify({baselineVersion:'51.7.0',version:'51.8.0',files:records},null,2)+'\nEND_JSON_FILES\n');console.log(JSON.stringify({output,files:records.length}));
