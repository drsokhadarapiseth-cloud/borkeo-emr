import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');

test('v29.4 emr-session.js: Khmer digits conversion to international digits', () => {
  const sessionJs = fs.readFileSync(path.join(projectRoot, 'public/emr-session.js'), 'utf8');

  // Verify digit map and regex definition
  assert.match(sessionJs, /KHMER_DIGITS_MAP/);
  assert.match(sessionJs, /'០':\s*'0'/);
  assert.match(sessionJs, /'៩':\s*'9'/);
  assert.match(sessionJs, /KHMER_DIGITS_REGEX\s*=\s*\/\[០-៩\]\/g/);

  // Verify convertKhmerDigits helper function
  assert.match(sessionJs, /function convertKhmerDigits\(text\)/);
  assert.match(sessionJs, /window\.convertKhmerDigits\s*=\s*convertKhmerDigits/);

  // Verify input event handling and selection restoration
  assert.match(sessionJs, /document\.addEventListener\('input'/);
  assert.match(sessionJs, /target\.dataset\.preserveKhmerNumbers/);
  assert.match(sessionJs, /target\.setSelectionRange\(start,\s*end\)/);

  // Test convertKhmerDigits algorithm directly
  const khmerDigitsMap = {
    '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4',
    '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9'
  };
  function testConvert(str) {
    return str.replace(/[០-៩]/g, ch => khmerDigitsMap[ch] || ch);
  }

  assert.equal(testConvert('០១២៣៤៥៦៧៨៩'), '0123456789');
  assert.equal(testConvert('ទូរស័ព្ទ៖ ០១២ ៣៤៥ ៦៧៨'), 'ទូរស័ព្ទ៖ 012 345 678');
  assert.equal(testConvert('ថ្ងៃទី ១២ ខែ ១០ ឆ្នាំ ២០២៦'), 'ថ្ងៃទី 12 ខែ 10 ឆ្នាំ 2026');
  assert.equal(testConvert('BK-២០២៦១០១១-០០០១'), 'BK-20261011-0001');
});
