import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v28.1 server records distinct opdDoctor and ipdDoctor signature snapshots', () => {
  const server = fs.readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /data\['system:signature:opdDoctor'\]\s*=\s*doctorSig;/);
  assert.match(server, /data\['system:signature:ipdDoctor'\]\s*=\s*doctorSig;/);
});

test('v28.1 client supports doctor session signature, clinicalSubTab and admission routing', () => {
  const client = fs.readFileSync(new URL('../public/emr-patient-record.js', import.meta.url), 'utf8');
  assert.match(client, /function currentDoctorIdentitySignature\(\)/);
  assert.match(client, /function getAdmissionDoctorSignature\(\)/);
  assert.match(client, /clinicalSubTab:\s*activeSubTab/);
  assert.match(client, /#adm-doctor-esign\s*\[data-emr-esign-content\]/);
  assert.match(client, /#opd-doctor-esign\s*\[data-emr-esign-content\]/);
  assert.match(client, /window\.getAdmissionDoctorSignature\s*=\s*getAdmissionDoctorSignature;/);
});

test('v28.1 protected EMR.html includes #adm-doctor-esign and print signature helpers', () => {
  const html = fs.readFileSync(new URL('../protected/EMR.html', import.meta.url), 'utf8');
  assert.match(html, /id="adm-doctor-esign"/);
  assert.match(html, /function populateAdmissionDoctorPrintSignature\(\)/);
  assert.match(html, /function populateOpdDoctorPrintSignature\(\)/);
  assert.match(html, /populateOpdDoctorPrintSignature\(\);\s*prepareMedicationRowsForPrint\(\);/);
  assert.match(html, /populateAdmissionDoctorPrintSignature\(\);\s*return window\.printEmrReport/);
});
