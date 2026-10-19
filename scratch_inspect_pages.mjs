import fs from 'node:fs';

const html = fs.readFileSync('D:/EMR/Borkeo_EMR_v36.1/protected/EMR.html', 'utf8');
const lines = html.split('\n');

console.log('--- Pages in EMR.html ---');
lines.forEach((l, i) => {
  if (l.includes('id="page') || l.includes('id="btn_page') || l.includes('id="sub_opd') || l.includes('id="sub_ipd')) {
    console.log(i + 1, l.trim().slice(0, 100));
  }
});
