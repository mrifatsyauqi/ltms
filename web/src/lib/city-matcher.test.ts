import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCityName, isCityMatch, resolveCityFromDropPoint } from './city-matcher';

test('normalizeCityName cleans prefixes and casing', () => {
  assert.equal(normalizeCityName('KOTA BATANG'), 'BATANG');
  assert.equal(normalizeCityName('KABUPATEN BATANG'), 'BATANG');
  assert.equal(normalizeCityName('Kab. Batang'), 'BATANG');
  assert.equal(normalizeCityName('  batang  '), 'BATANG');
  assert.equal(normalizeCityName('KOTA PEKALONGAN'), 'PEKALONGAN');
});

test('isCityMatch matches correctly and avoids false positives', () => {
  assert.equal(isCityMatch('KOTA BATANG', 'BATANG'), true);
  assert.equal(isCityMatch('KABUPATEN BATANG', 'BATANG'), true);
  assert.equal(isCityMatch('BATANG', 'BATANG'), true);
  assert.equal(isCityMatch('KAB. BATANG', 'BATANG'), true);

  // False positives must be prevented
  assert.equal(isCityMatch('KOTA BATANG HARI', 'BATANG'), false);
  assert.equal(isCityMatch('BATANG KUIS', 'BATANG'), false);
  assert.equal(isCityMatch('KOTA SEMARANG', 'BATANG'), false);
  assert.equal(isCityMatch('JAKARTA BARAT', 'BATANG'), false);
});

test('resolveCityFromDropPoint extracts city from DP code', () => {
  assert.equal(resolveCityFromDropPoint('DP BATANG01'), 'BATANG');
  assert.equal(resolveCityFromDropPoint('DP PEKALONGAN02'), 'PEKALONGAN');
  assert.equal(resolveCityFromDropPoint('BATANG'), 'BATANG');
  assert.equal(resolveCityFromDropPoint(''), null);
  assert.equal(resolveCityFromDropPoint(null), null);
});
