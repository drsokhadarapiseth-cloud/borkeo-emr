import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


test('v26.2 protected/home.html does not duplicate OPD report', () => {
  const homeHtml = fs.readFileSync(path.join(process.cwd(), 'protected/home.html'), 'utf8');
  
  // Verify opd-report-body appears only once in the entire file
  const matches = homeHtml.match(/id="opd-report-body"/g);
  assert.equal(matches ? matches.length : 0, 1, 'OPD report body table must appear exactly once');
  
  // Verify old duplicate standalone id does not exist
  assert.ok(!homeHtml.includes('id="opd-standalone-report-body"'), 'duplicate standalone body removed');
});

test('v26.2 public/home.js renders single OPD report without duplicating', () => {
  const homeJs = fs.readFileSync(path.join(process.cwd(), 'public/home.js'), 'utf8');
  assert.ok(homeJs.includes('opd-report-body'), 'opd-report-body populated');
  assert.ok(!homeJs.includes('opd-standalone-report-body'), 'duplicate standalone body reference removed');
});
