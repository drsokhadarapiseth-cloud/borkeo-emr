import fs from 'node:fs';
import path from 'node:path';

function search(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) continue;
    if (!full.endsWith('.css') && !full.endsWith('.html')) continue;
    const content = fs.readFileSync(full, 'utf8');
    content.split('\n').forEach((l, idx) => {
      if (l.includes('emr-opd-workspace')) {
        console.log(`${f}:${idx + 1}: ${l.trim().slice(0, 120)}`);
      }
    });
  }
}

search('D:/EMR/Borkeo_EMR_v36.1/public');
search('D:/EMR/Borkeo_EMR_v36.1/protected');
