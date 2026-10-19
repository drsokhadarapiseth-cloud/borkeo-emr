import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const root = projectRoot;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('v19.7 shows stable KH and EN controls throughout the app while Paraclinic defaults to Khmer', () => {
  assert.match(JSON.parse(read('package.json')).version, /^[0-9]+\.[0-9]+\./);
  const server = read('server/server.mjs');
  assert.match(server, /emr-language-data\.js/);
  assert.match(server, /emr-language\.css/);
  assert.match(server, /emr-language\.js/);
  const language = read('public/emr-language.js');
  assert.ok(language.includes('englishDisabled') || language.includes('borkeo-emr-language'));
  assert.match(language, /borkeo-emr-language/);
  const pairs = read('public/emr-language-data.js');
  assert.match(pairs, /Electronic Medical Record System/);
  assert.match(pairs, /Patient Info/);
  for (const file of ['public/patient-list.js', 'public/departments.js']) {
    assert.match(read(file), /borkeo-language-change/);
  }
  assert.match(read('protected/EMR.html'), /window\.applyEmrLanguage/);
});

test('v19.4 uses an English laboratory print header and shaded category band', () => {
  const lab = read('public/lab.js');
  for (const phrase of [
    'Kingdom of Cambodia',
    'Nation Religion King',
    'Laboratory of Borkeo Referral Hospital',
    'Laboratory Results',
  ]) assert.ok(lab.includes(phrase), `Missing print header text: ${phrase}`);
  const css = read('public/lab.css');
  assert.match(css, /lab-print-letterhead[^\n]*LabMoul/);
  assert.match(css, /lab-print-specimen[^\n]*background:#e7e7e7/);
  assert.match(css, /lab-print-tacteing/);
  assert.match(lab, /src="\/emr-assets\/Tacteing-6\.png"/);
  assert.match(lab, /src="\/api\/organization\/logo"/);
  assert.match(lab, /Requesting doctor/);
  const html = read('protected/lab.html');
  assert.match(html, /family=Moul/);
  assert.match(html, /lab\.js\?v=\d+/);
  const imaging = read('public/imaging.js');
  assert.match(imaging, /imagingPrintReportHtml/);
  assert.match(imaging, /Requesting doctor/);
  assert.match(imaging, /\/emr-assets\/Tacteing-6\.png/);
  const imagingCss = read('public/imaging.css');
  assert.match(imagingCss, /imaging-print-band[^}]*background:#e7e7e7/);
  assert.match(imagingCss, /#imaging-detail> :not\(\.imaging-print-report\)/);
  const imagingHtml = read('protected/imaging.html');
  assert.match(imagingHtml, /imaging\.js\?v=\d+/);
  assert.match(imagingHtml, /family=Moul/);
  assert.match(imagingHtml, /emr-session\.js\?v=1970/);
  assert.match(html, /emr-session\.js\?v=1970/);
  assert.match(read('public/emr-session.js'), /messages\.js\?v=1970/);
});

test('v19.4 uses department wording and holds later pre-consult tests for Cashier', () => {
  assert.match(read('protected/billing.html'), /បានបញ្ជូនពីផ្នែក/);
  assert.doesNotMatch(read('protected/billing.html'), /វូដ|វួដ/);
  const messages = read('public/messages.js');
  assert.match(messages, /cleanWardText/);
  assert.match(messages, /\(\?:ផ្នែក\|វួដ\)/);
  const server = read('server/server.mjs');
  assert.match(server, /'PARACLINIC_RESULTS_PENDING','DOCTOR_READY'\]\.includes\(workflowStage\)/);
  const scenario = read('tests/opd-paraclinic-prepayment.test.mjs');
  assert.match(scenario, /later pre-consult paid order must wait for Cashier/);
  assert.match(scenario, /hidden from Lab until Cashier confirms payment/);
});

test('Cashier handoff confirms with the requested Khmer message', () => {
  const paraclinic = read('public/paraclinic.js');
  assert.ok((paraclinic.match(/alert\('បានបញ្ជូនទៅបញ្ជរបង់ប្រាក់'\)/g) || []).length >= 2);
});
