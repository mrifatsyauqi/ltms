import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCityName, isCityMatch, resolveCityFromDropPoint } from './city-matcher';

test('normalizeCityName: membersihkan prefix administratif dan keterangan tambahan', () => {
  assert.equal(normalizeCityName('BATANG'), 'BATANG');
  assert.equal(normalizeCityName('batang'), 'BATANG');
  assert.equal(normalizeCityName('KOTA BATANG'), 'BATANG');
  assert.equal(normalizeCityName('KAB. BATANG'), 'BATANG');
  assert.equal(normalizeCityName('KABUPATEN BATANG'), 'BATANG');
  assert.equal(normalizeCityName('KAB BATANG'), 'BATANG');
  assert.equal(normalizeCityName('KODYA BATANG'), 'BATANG');
  assert.equal(normalizeCityName('Batang, Jawa Tengah'), 'BATANG');
  assert.equal(normalizeCityName('Kab. Batang (Jateng)'), 'BATANG');
  assert.equal(normalizeCityName('BATANG - JAWA TENGAH'), 'BATANG');
});

test('isCityMatch: mencocokkan variasi penulisan kota BATANG dengan benar', () => {
  const target = 'BATANG';

  assert.equal(isCityMatch('BATANG', target), true);
  assert.equal(isCityMatch('batang', target), true);
  assert.equal(isCityMatch('KOTA BATANG', target), true);
  assert.equal(isCityMatch('KAB. BATANG', target), true);
  assert.equal(isCityMatch('KABUPATEN BATANG', target), true);
  assert.equal(isCityMatch('Kab. Batang', target), true);
  assert.equal(isCityMatch('BATANG (KAB)', target), true);
  assert.equal(isCityMatch('BATANG, JAWA TENGAH', target), true);
});

test('isCityMatch: MENOLAK kota lain yang mengandung kata "BATANG" seperti BATANG HARI', () => {
  const target = 'BATANG';

  // BATANG HARI adalah kabupaten di Jambi, TIDAK boleh masuk ke BATANG
  assert.equal(isCityMatch('BATANG HARI', target), false);
  assert.equal(isCityMatch('KOTA BATANG HARI', target), false);
  assert.equal(isCityMatch('KABUPATEN BATANG HARI', target), false);
  assert.equal(isCityMatch('KAB. BATANG HARI', target), false);
  assert.equal(isCityMatch('BATANGHARI', target), false);
  assert.equal(isCityMatch('BATANG KUIS', target), false);
  assert.equal(isCityMatch('BATANG CENAKU', target), false);
  assert.equal(isCityMatch('BATANG GANSAL', target), false);
  assert.equal(isCityMatch('BATANG TORU', target), false);
  assert.equal(isCityMatch('PADANG BATANG', target), false);
});

test('isCityMatch: mendukung pencocokan multi-kota lain (Pekalongan, Semarang, dll)', () => {
  assert.equal(isCityMatch('KOTA PEKALONGAN', 'PEKALONGAN'), true);
  assert.equal(isCityMatch('KAB. PEKALONGAN', 'PEKALONGAN'), true);
  assert.equal(isCityMatch('PEKALONGAN', 'PEKALONGAN'), true);
  assert.equal(isCityMatch('KOTA SEMARANG', 'SEMARANG'), true);
  assert.equal(isCityMatch('KOTA TEGAL', 'TEGAL'), true);
  assert.equal(isCityMatch('KOTA PEKALONGAN', 'BATANG'), false);
});

test('resolveCityFromDropPoint: memetakan drop point akun ke kota yang sesuai', () => {
  const dropPointsList = [
    { 'Kode DP': 'BATANG01', 'Nama Kota': 'BATANG', 'Wilayah/Cabang': 'Batang' },
    { 'Kode DP': 'REBAN', 'Nama Kota': 'BATANG', 'Wilayah/Cabang': 'Batang' },
    { 'Kode DP': 'PKL_KOTA', 'Nama Kota': 'PEKALONGAN', 'Wilayah/Cabang': 'Pekalongan' },
  ];

  assert.equal(resolveCityFromDropPoint('BATANG01', dropPointsList), 'BATANG');
  assert.equal(resolveCityFromDropPoint('REBAN', dropPointsList), 'BATANG');
  assert.equal(resolveCityFromDropPoint('PKL_KOTA', dropPointsList), 'PEKALONGAN');
  assert.equal(resolveCityFromDropPoint('BATANG_UTARA', null), 'BATANG');
  assert.equal(resolveCityFromDropPoint(null, null, 'BATANG'), 'BATANG');
});
