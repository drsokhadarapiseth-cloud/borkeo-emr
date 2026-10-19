import fs from 'node:fs';
import path from 'node:path';

function searchDir(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) continue;
    if (!full.endsWith('.js') && !full.endsWith('.mjs') && !full.endsWith('.html')) continue;
    const content = fs.readFileSync(full, 'utf8');
    content.split('\n').forEach((l, idx) => {
      if (l.includes("showOnlyPage('page3'") || l.includes('switchPage(3)') || l.includes("page3.classList.add('active'") || l.includes("page3") && l.includes("active")) {
        console.log(`${f}:${idx + 1}: ${l.trim().slice(0, 120)}`);
      }
    });
  }
}

searchDir('D:/EMR/Borkeo_EMR_v36.1/public');
searchDir('D:/EMR/Borkeo_EMR_v36.1/protected');
