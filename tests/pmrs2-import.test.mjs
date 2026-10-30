import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKh, splitKhmerName, padProvinceCode, resolveProvince, buildAddressRecord } from '../public/pmrs2-import.mjs';

test('normalizeKh collapses whitespace and drops zero-width marks', () => {
  assert.equal(normalizeKh('  a​b   c '), 'ab c');
  assert.equal(normalizeKh('﻿x‍y'), 'xy');
  assert.equal(normalizeKh(null), '');
});

test('splitKhmerName keeps family name first', () => {
  assert.deepEqual(splitKhmerName('Chan Dara Reach'), { lastName: 'Chan', firstName: 'Dara Reach' });
  assert.deepEqual(splitKhmerName('Solo'), { lastName: 'Solo', firstName: '' });
  assert.deepEqual(splitKhmerName('   '), { lastName: '', firstName: '' });
});

test('padProvinceCode normalises to two digits', () => {
  assert.equal(padProvinceCode('8'), '08');
  assert.equal(padProvinceCode('08'), '08');
  assert.equal(padProvinceCode('kandal-08'), '08');
  assert.equal(padProvinceCode(''), '');
});

test('resolveProvince matches when either name contains the other', () => {
  const provinces = [{ local: 'XYZ Kandal', code: '8' }, { local: 'Phnom Penh Capital', code: '12' }];
  assert.equal(resolveProvince('Kandal', provinces)?.code, '8');          // gazetteer name contains PMRS2 name
  assert.equal(resolveProvince('Phnom Penh Capital City', provinces)?.code, '12'); // PMRS2 name contains gazetteer name
  assert.equal(resolveProvince('Battambang', provinces), null);
  assert.equal(resolveProvince('', provinces), null);
});

test('buildAddressRecord emits registration-scoped keys and padded province code', () => {
  const record = buildAddressRecord(
    { district: 'D town', commune: 'C', village: 'V', street: 'House 1' },
    { local: 'XYZ Kandal', code: '8' }
  );
  assert.equal(record['scope:registration:id:web_province'], 'XYZ Kandal');
  assert.equal(record['scope:registration:id:web_province_code'], '08');
  assert.equal(record['scope:registration:id:web_district'], 'D town');
  assert.equal(record['scope:registration:id:web_commune'], 'C');
  assert.equal(record['scope:registration:id:web_village'], 'V');
  assert.equal(record['scope:registration:id:web_street_address'], 'House 1');
});

test('buildAddressRecord without a province match keeps the raw name only', () => {
  const record = buildAddressRecord({ province: 'Unknown', district: 'D' }, null);
  assert.equal(record['scope:registration:id:web_province'], 'Unknown');
  assert.equal(record['scope:registration:id:web_province_code'], undefined);
  assert.equal(record['scope:registration:id:web_district'], 'D');
});
