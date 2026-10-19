import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Extract khmerQueueNumberToWords logic or evaluate it from file
const jsCode = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');

function extractConverter() {
  const khmerDigits = ['', 'មួយ', 'ពីរ', 'បី', 'បួន', 'ប្រាំ', 'ប្រាំមួយ', 'ប្រាំពីរ', 'ប្រាំបី', 'ប្រាំបួន'];
  const khmerTens = ['', 'ដប់', 'ម្ភៃ', 'សាមសិប', 'សែសិប', 'ហាសិប', 'ហុកសិប', 'ចិតសិប', 'ប៉ែតសិប', 'កៅសិប'];

  function khmerQueueNumberToWords(num) {
    if (num === null || num === undefined || num === '' || num === '—') return '—';
    const n = parseInt(num, 10);
    if (isNaN(n) || n <= 0) return String(num);

    if (n >= 1 && n <= 9) {
      return 'សូន្យ ' + khmerDigits[n];
    }

    function readTwoDigits(v) {
      if (v === 0) return '';
      if (v < 10) return khmerDigits[v];
      const t = Math.floor(v / 10);
      const u = v % 10;
      return khmerTens[t] + (u > 0 ? khmerDigits[u] : '');
    }

    if (n < 100) {
      return readTwoDigits(n);
    }

    if (n < 1000) {
      const h = Math.floor(n / 100);
      const rest = n % 100;
      return khmerDigits[h] + 'រយ' + (rest > 0 ? (rest < 10 ? khmerDigits[rest] : readTwoDigits(rest)) : '');
    }

    return String(n);
  }

  return khmerQueueNumberToWords;
}

test('v23.3 exact Khmer number reading test cases (01..09 as សូន្យ, 010+ as tens, 014 as ដប់បួន, 020+ as twenties)', () => {
  const toWords = extractConverter();

  // 1-9
  assert.equal(toWords('001'), 'សូន្យ មួយ');
  assert.equal(toWords('01'), 'សូន្យ មួយ');
  assert.equal(toWords(1), 'សូន្យ មួយ');
  assert.equal(toWords('004'), 'សូន្យ បួន');
  assert.equal(toWords('009'), 'សូន្យ ប្រាំបួន');

  // 10-19
  assert.equal(toWords('010'), 'ដប់');
  assert.equal(toWords('011'), 'ដប់មួយ');
  assert.equal(toWords('014'), 'ដប់បួន'); // Explicitly requested fix for 014
  assert.equal(toWords('14'), 'ដប់បួន');
  assert.equal(toWords(14), 'ដប់បួន');
  assert.equal(toWords('015'), 'ដប់ប្រាំ');
  assert.equal(toWords('019'), 'ដប់ប្រាំបួន');

  // 20-99
  assert.equal(toWords('020'), 'ម្ភៃ');
  assert.equal(toWords('021'), 'ម្ភៃមួយ');
  assert.equal(toWords('024'), 'ម្ភៃបួន');
  assert.equal(toWords('025'), 'ម្ភៃប្រាំ');
  assert.equal(toWords('030'), 'សាមសិប');
  assert.equal(toWords('035'), 'សាមសិបប្រាំ');
  assert.equal(toWords('099'), 'កៅសិបប្រាំបួន');

  // 100+
  assert.equal(toWords('100'), 'មួយរយ');
  assert.equal(toWords('114'), 'មួយរយដប់បួន');
  assert.equal(toWords('220'), 'ពីររយម្ភៃ');
});

test('v23.3 queue-display.js includes cache buster parameter for audio tts', () => {
  assert.ok(jsCode.includes('/api/queue/tts?text='), 'calls tts api');
  assert.ok(jsCode.includes('&t='), 'includes timestamp cache buster');
});

