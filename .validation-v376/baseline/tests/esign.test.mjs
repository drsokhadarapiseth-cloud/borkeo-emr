import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.mjs';
import { ensureESignSchema, getESignature, setESignature, signatureSnapshot } from '../server/esign.mjs';

test('admin-managed electronic signature can be snapshotted onto a clinical save', () => {
  const database = openDatabase(':memory:');
  ensureESignSchema(database);
  const now = Date.now();
  const userId = '11111111-1111-4111-8111-111111111111';
  database.createUser({ id:userId, username:'doctor1', displayName:'វេជ្ជបណ្ឌិត សុខា', role:'DOCTOR', passwordHash:'x', createdAt:now });
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const saved = setESignature(database, userId, { signerName:'វេជ្ជបណ្ឌិត សុខា', signatureDataUrl:png }, userId, now);
  assert.equal(saved.hasSignature, true);
  assert.equal(getESignature(database, userId).signerName, 'វេជ្ជបណ្ឌិត សុខា');
  const snapshot = signatureSnapshot(database, { user_id:userId, username:'doctor1', display_name:'វេជ្ជបណ្ឌិត សុខា', active_role:'DOCTOR', active_ward_code:'medicine' }, now + 1);
  assert.equal(snapshot.username, 'doctor1');
  assert.equal(snapshot.signatureDataUrl, png);
  assert.equal(snapshot.role, 'DOCTOR');
  assert.equal(snapshot.wardCode, 'medicine');
  database.close();
});
