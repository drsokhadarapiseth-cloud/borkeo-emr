import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(process.argv[2] || '');

if (!process.argv[2] || source === target) {
    throw Error('Extract update separately. Provide existing project folder; stop its server first.');
}

const targetPkgPath = path.join(target, 'package.json');
if (!fs.existsSync(targetPkgPath)) {
    throw Error('Invalid target project: package.json not found in ' + target);
}

const version = JSON.parse(fs.readFileSync(targetPkgPath, 'utf8')).version;
if (!/^29\.[56789]\./.test(version) && !/^30\.0\./.test(version)) {
    throw Error('Requires v29.5 - v29.9; found ' + version);
}

const files = [
    'package.json',
    'server/server.mjs',
    'public/login.html',
    'protected/EMR.html',
    'public/patient-photo.js',
    'scripts/seed-v299-thirty-triage-patients.mjs',
    'tests/v300-patient-sex-and-triage-photo.test.mjs',
    'tests/v288-ipd-medical-record-access.test.mjs',
    'Borkeo_EMR_v30.0_UPDATE.txt'
];

for (const name of files) {
    if (!fs.existsSync(path.join(source, name))) {
        throw Error('Missing update file: ' + name);
    }
}

// Also ensure demo-photos folder is copied if present
const photoSrcDir = path.join(source, 'data', 'demo-photos');
const photoDestDir = path.join(target, 'data', 'demo-photos');
if (fs.existsSync(photoSrcDir)) {
    fs.mkdirSync(photoDestDir, { recursive: true });
    for (const img of fs.readdirSync(photoSrcDir)) {
        fs.copyFileSync(path.join(photoSrcDir, img), path.join(photoDestDir, img));
    }
}

const backup = path.join(target, '.backup_v300_' + Date.now());
fs.mkdirSync(backup, { recursive: true });
const saved = [];

try {
    for (const name of files) {
        const dest = path.join(target, name);
        const prior = fs.existsSync(dest);
        if (prior) {
            const b = path.join(backup, name);
            fs.mkdirSync(path.dirname(b), { recursive: true });
            fs.copyFileSync(dest, b);
        }
        saved.push({ name, prior });
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(source, name), dest);
    }
    console.log('v30.0 installed successfully. Backup: ' + backup);
} catch (error) {
    for (const { name, prior } of saved.reverse()) {
        const dest = path.join(target, name);
        if (prior) {
            const b = path.join(backup, name);
            fs.copyFileSync(b, dest);
        } else if (fs.existsSync(dest)) {
            fs.unlinkSync(dest);
        }
    }
    throw error;
}
