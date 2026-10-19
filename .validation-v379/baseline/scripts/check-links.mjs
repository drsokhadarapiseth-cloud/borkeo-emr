import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('protected/EMR.html', 'utf8');
const regex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
let m;
while ((m = regex.exec(html)) !== null) {
  if (m[0].includes('stylesheet')) {
    const href = m[1];
    if (href.startsWith('/public/')) {
      const cleanPath = href.split('?')[0].slice(1);
      const exists = fs.existsSync(cleanPath);
      console.log(cleanPath, exists ? 'EXISTS' : 'MISSING 404!!!');
    }
  }
}
