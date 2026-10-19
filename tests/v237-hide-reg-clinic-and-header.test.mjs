import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


test('v23.7 EMR.html hides clinical box on registration screen while keeping print admission intact', () => {
  const emrHtml = fs.readFileSync(path.join(process.cwd(), 'protected/EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('sec_clinical'), 'contains sec_clinical key');
  assert.ok(
    emrHtml.includes('class="modern-section" style="display: none;"') ||
    emrHtml.includes('style="display: none;"') ||
    emrHtml.includes('style="display:none;"'),
    'hides sec_clinical section on registration screen'
  );

  const printAdmissionIndex = emrHtml.indexOf('<div id="print-admission">');
  assert.ok(printAdmissionIndex > 0, 'has print-admission section');
  const printAdmissionContent = emrHtml.slice(printAdmissionIndex, printAdmissionIndex + 8000);
  assert.ok(printAdmissionContent.includes('រោគវិនិច្ឆ័យនៅពេលចូលសម្រាកព្យាបាល') || printAdmissionContent.includes('data-key="diagnosis"'), 'print admission contains admission diagnosis field');
  assert.ok(printAdmissionContent.includes('បញ្ជូនទៅបន្ទប់') || printAdmissionContent.includes('data-key="refer_to"'), 'print admission contains refer to section field');
});

test('v23.7 queue-display.html renders single hospital brand without duplicate middle text', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/queue-display.html'), 'utf8');
  assert.ok(html.includes('tv-brand-kh notranslate'), 'uses single non-translatable Khmer hospital brand');
  assert.ok(html.includes('v=2370'), 'uses cache buster v=2370 for CSS and JS assets');
});
