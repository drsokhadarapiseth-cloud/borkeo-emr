import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v25.9 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^25\./);

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v25\./);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /v25\./);
});

test('v25.9 home.js removes all bracketed words from metric cards 3, 4, and 5', () => {
  const homeJs = read('public/home.js');
  
  // Cards 3, 4, 5 use unbracketed main title 'បញ្ជូនចូល'
  assert.ok(homeJs.includes("metricCard('បញ្ជូនចូល', d.hcReferrals??0, 'មកខ្លួនឯង'"), 'Card 3 unbracketed with មកខ្លួនឯង');
  assert.ok(homeJs.includes("metricCard('បញ្ជូនចូល', d.hcAmbulance??0, 'រថយន្ត HC'"), 'Card 4 unbracketed with រថយន្ត HC');
  assert.ok(homeJs.includes("metricCard('បញ្ជូនចូល', d.rhAmbulance??0, 'រថយន្ត RH'"), 'Card 5 unbracketed with រថយន្ត RH');
  
  // No parentheses in metric card labels
  assert.ok(!homeJs.includes("បញ្ជូនចូល("), 'No parentheses in metricCard title');
  assert.ok(!homeJs.includes("បញ្ជូនចូល（"), 'No full-width parentheses');
});

test('v25.9 home.css ensures single-row grid and clear typography for unbracketed cards', () => {
  const homeCss = read('public/home.css');
  assert.ok(homeCss.includes('grid-template-columns: repeat(7, minmax(0, 1fr))'));
  assert.ok(homeCss.includes('.report-metric-card .metric-label'));
});
