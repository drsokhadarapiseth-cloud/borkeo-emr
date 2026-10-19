import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v23.1 seed patient records use authentic Khmer names', () => {
  const seed194 = fs.readFileSync(path.join(process.cwd(), 'scripts/seed-v194-patients.mjs'), 'utf8');
  assert.ok(seed194.includes('សុខ ពិសិដ្ឋ'), 'seed-v194 includes Khmer names');
  assert.ok(seed194.includes('ចាន់ ដារ៉ា'), 'seed-v194 includes Khmer names');
  assert.ok(seed194.includes('គឹម ស្រីពៅ'), 'seed-v194 includes Khmer names');

  const seedDemo = fs.readFileSync(path.join(process.cwd(), 'scripts/seed-demo-patients.mjs'), 'utf8');
  assert.ok(seedDemo.includes('សុខ ដារ៉ា'), 'seed-demo includes Khmer names');
  assert.ok(seedDemo.includes('ខេម រ័ត្ន'), 'seed-demo includes Khmer names');
});

