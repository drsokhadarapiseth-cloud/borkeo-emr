import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('v32.13 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 32.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v(?:3[2-6]\.)/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v(?:3[2-6]\.)/);
});

test('v32.13 IPD title renamed to សំណុំឯកសារអ្នកជំងឺសម្រាកពេទ្យ in HTML templates and dictionaries', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(rootDir, 'legacy-html/EMR.html'), 'utf8');
  const langData = fs.readFileSync(path.join(rootDir, 'public/emr-language-data.js'), 'utf8');

  [emrHtml, legacyHtml].forEach(html => {
    // Assert the rendered text inside moul-font data-key="ipd_title"
    assert.match(
      html,
      /data-key="ipd_title">\s*សំណុំឯកសារអ្នកជំងឺសម្រាកពេទ្យ\s*<\/div>/,
      'IPD title banner must be សំណុំឯកសារអ្នកជំងឺសម្រាកពេទ្យ'
    );

    // Assert the dictionary entry
    assert.match(
      html,
      /ipd_title:\s*"សំណុំឯកសារអ្នកជំងឺសម្រាកពេទ្យ"/,
      'Dictionary ipd_title must be សំណុំឯកសារអ្នកជំងឺសម្រាកពេទ្យ'
    );
  });

  // Assert language pairs in emr-language-data.js
  assert.ok(
    langData.includes('["សំណុំឯកសារអ្នកជំងឺសម្រាកពេទ្យ","Inpatient Medical Record"]'),
    'emr-language-data.js must contain updated pair'
  );
});
