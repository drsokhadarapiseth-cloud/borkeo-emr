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
if (!/^29\.[56789]\./.test(version) && !/^30\.[0123456]\./.test(version)) {
    throw Error('Requires v29.5 - v30.6; found ' + version);
}

const files = [
    'package.json',
    'server/server.mjs',
    'server/invoice-edits.mjs',
    'server/patient-photo.mjs',
    'public/login.html',
    'public/patient-photo.js',
    'protected/billing.html',
    'public/billing.js',
    'public/billing.css',
    'tests/v307-cashier-history-discharge-and-photo-auto-apply.test.mjs',
    'Borkeo_EMR_v30.7_UPDATE.txt'
];

for (const name of files) {
    if (!fs.existsSync(path.join(source, name))) {
        throw Error('Missing update file: ' + name);
    }
}

const backup = path.join(target, '.backup_v307_' + Date.now());
fs.mkdirSync(backup, { recursive: true });
const saved = [];

try {
    for (const name of files) {
        const dest = path.join(target, name);
        const prior = fs.existsSync(dest);
        if (prior) {
            const relBackup = path.join(backup, name);
            fs.mkdirSync(path.dirname(relBackup), { recursive: true });
            fs.copyFileSync(dest, relBackup);
        }
        saved.push({ name, prior });
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(source, name), dest);
    }
    console.log('v30.7 update applied successfully to ' + target);
    console.log('Backup saved in ' + backup);
} catch (error) {
    for (const { name, prior } of saved) {
        const dest = path.join(target, name);
        if (prior) {
            fs.copyFileSync(path.join(backup, name), dest);
        } else if (fs.existsSync(dest)) {
            fs.unlinkSync(dest);
        }
    }
    throw error;
}
