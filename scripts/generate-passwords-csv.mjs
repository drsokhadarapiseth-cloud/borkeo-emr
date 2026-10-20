import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data', 'demo.sqlite');
const db = new DatabaseSync(dbPath);
const users = db.prepare('SELECT username, display_name, role FROM users WHERE is_active=1 ORDER BY role, username').all();
const urls = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://192.168.1.4:3000',
  'http://192.168.1.6:3000'
];
const defaultPass = '1234';

const rows = ['name,url,username,password'];
for (const u of users) {
  for (const url of urls) {
    const cleanName = `Borkeo EMR - ${u.display_name} (${u.username})`.replace(/"/g, '""');
    rows.push(`"${cleanName}","${url}","${u.username}","${defaultPass}"`);
  }
}

const outputPath = path.join(process.cwd(), 'borkeo-emr-passwords.csv');
fs.writeFileSync(outputPath, rows.join('\r\n'), 'utf8');
console.log(`Generated ${outputPath} with ${rows.length - 1} password records for Chrome and Firefox.`);
