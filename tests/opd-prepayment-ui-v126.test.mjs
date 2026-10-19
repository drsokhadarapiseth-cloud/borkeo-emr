import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

test('v12.6 OPD pre-payment review keeps the OPD form visible but locks clinical input', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'public/paraclinic.css'), 'utf8');
  const permissions = fs.readFileSync(path.join(projectRoot, 'public/emr-permissions.js'), 'utf8');
  const paraclinic = fs.readFileSync(path.join(projectRoot, 'public/paraclinic.js'), 'utf8');
  const emr = fs.readFileSync(path.join(projectRoot, 'protected/EMR.html'), 'utf8');
  assert.doesNotMatch(css, /html\.opd-paraclinic-review \.paraclinic-medical-main\{display:none/);
  assert.match(css, /Pre-payment Paraclinic Review/);
  assert.match(permissions, /prePaymentParaclinicReview/);
  assert.match(permissions, /setReadonly\(outpatient,.+prePaymentParaclinicReview/);
  assert.match(permissions, /data-permission-scope="paraclinic"/);
  assert.match(paraclinic, /permissionScope = 'paraclinic'/);
  assert.match(paraclinic, /applyInvestigationText/);
  assert.match(paraclinic, /data-order="LAB"/);
  for (const modality of ['ULTRASOUND','XRAY','CT','MRI']) assert.ok(paraclinic.includes(`'${modality}'`));
  assert.match(emr, /id="opd_temp"[^>]*readonly/);
  assert.match(emr, /id="opd_bp_sys"[^>]*readonly/);
  assert.match(emr, /id="opd_bp_dia"[^>]*readonly/);
  assert.match(emr, /id="opd_pulse"[^>]*readonly/);
  assert.match(emr, /id="opd_resp"[^>]*readonly/);
});

test('v12.6 patient record API exposes structured triage vital signs for OPD import', () => {
  const server = fs.readFileSync(path.join(projectRoot, 'server/server.mjs'), 'utf8');
  const client = fs.readFileSync(path.join(projectRoot, 'public/emr-patient-record.js'), 'utf8');
  assert.match(server, /function triageVitalsFromData/);
  assert.match(server, /triageVitals: triageVitalsFromData\(data\)/);
  assert.match(client, /loadedPatient\?\.triageVitals/);
  assert.match(client, /oxygenSaturation: 'opd_spo2'/);
});
