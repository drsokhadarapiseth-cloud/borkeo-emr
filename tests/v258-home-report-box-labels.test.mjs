import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');


test('v25.8 home.js renders the 7 renamed report cards', () => {
  const homeJs = read('public/home.js');
  assert.ok(homeJs.includes("metricCard('សម្រាកពេទ្យសរុប'"), 'Card 1: សម្រាកពេទ្យសរុប');
  assert.ok(homeJs.includes("metricCard('ផ្ទេរជំងឺក្នុងមន្ទីរពេទ្យ'"), 'Card 2: ផ្ទេរជំងឺក្នុងមន្ទីរពេទ្យ');
  assert.ok(homeJs.includes("metricCard('បញ្ជូនចូល'"), 'Card 3, 4, 5: បញ្ជូនចូល');
  assert.ok(homeJs.includes("metricCard('បញ្ជូនចេញ'"), 'Card 6: បញ្ជូនចេញ');
  assert.ok(homeJs.includes("metricCard('ចំណូលរថយន្តសរុប'"), 'Card 7: ចំណូលរថយន្តសរុប');
});

test('v25.8 home.css maintains 1-row 7-column grid and full label visibility without ellipsis clipping', () => {
  const homeCss = read('public/home.css');
  assert.ok(homeCss.includes('grid-template-columns: repeat(7, minmax(0, 1fr))'), '7-column single row grid');
  assert.ok(homeCss.includes('.report-metric-card .metric-label'), 'metric-label styled');
  assert.ok(homeCss.includes('overflow: visible'), 'overflow visible so letters are not clipped');
});
