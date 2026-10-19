import fs from 'node:fs';
import path from 'node:path';

const dir = 'tests';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs'));
for (const f of files) {
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes("'36.3.0']") && !c.includes("'36.5.0'")) {
    c = c.replace(/'36\.3\.0'\]/g, "'36.3.0', '36.4.0', '36.5.0']");
    fs.writeFileSync(p, c, 'utf8');
    console.log('Updated', f);
  }
}
