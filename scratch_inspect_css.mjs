import fs from 'node:fs';

const html = fs.readFileSync('D:/EMR/Borkeo_EMR_v36.1/protected/EMR.html', 'utf8');
const lines = html.split('\n');

console.log('--- CSS for .page ---');
lines.forEach((l, i) => {
  if (l.includes('.page ') || l.includes('.page{') || l.includes('.page.') || l.includes('display: none') && lines[i-1]?.includes('page')) {
    console.log(i + 1, l.trim());
  }
});
