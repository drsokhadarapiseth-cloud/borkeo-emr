import fs from 'node:fs';
import path from 'node:path';

const dir = 'tests';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs'));
for (const f of files) {
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  let changed = false;
  if (c.includes("'36.5.0']") && !c.includes("'36.6.0'")) {
    c = c.replace(/'36\.5\.0'\]/g, "'36.5.0', '36.6.0']");
    changed = true;
  }
  if (c.includes("/v36\\.[345]/")) {
    c = c.replace(/\/v36\\\.[345]\//g, "/v36\\.[3456]/");
    changed = true;
  }
  if (c.includes("/v36\\.[2-5]/")) {
    c = c.replace(/\/v36\\\.[2-5]\//g, "/v36\\.[2-6]/");
    changed = true;
  }
  if (c.includes("/v36\\.[1-5]/")) {
    c = c.replace(/\/v36\\\.[1-5]\//g, "/v36\\.[1-6]/");
    changed = true;
  }
  if (c.includes("/v36\\.[45]/")) {
    c = c.replace(/\/v36\\\.[45]\//g, "/v36\\.[456]/");
    changed = true;
  }
  if (c.includes("?v=3650") && !c.includes("?v=3660")) {
    c = c.replace(/\?v=3650/g, "?v=3660");
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(p, c, 'utf8');
    console.log('Updated test file:', f);
  }
}
