import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExcelDate } from './excel-date';

test('parseExcelDate parses Excel serial float numbers accurately', () => {
  // Waktu Upload: 46236.76099537037 -> 2026-08-02 18:15:50
  const uploadResult = parseExcelDate(46236.76099537037);
  assert.ok(uploadResult);
  assert.equal(uploadResult.formatted.startsWith('2026-08-02'), true);
  assert.equal(uploadResult.timeOnly.startsWith('18:15:'), true);

  // Waktu TTD: 46237.36094907407 -> 2026-08-03 08:39:46
  const ttdResult = parseExcelDate(46237.36094907407);
  assert.ok(ttdResult);
  assert.equal(ttdResult.formatted.startsWith('2026-08-03'), true);
  assert.equal(ttdResult.timeOnly.startsWith('08:39:'), true);
});

test('parseExcelDate handles string numbers and ISO/DMY strings', () => {
  const strNumResult = parseExcelDate('46237.36094907407');
  assert.ok(strNumResult);
  assert.equal(strNumResult.formatted.startsWith('2026-08-03'), true);

  const isoResult = parseExcelDate('2026-08-03 08:39:34');
  assert.ok(isoResult);
  assert.equal(isoResult.formatted, '2026-08-03 08:39:34');
  assert.equal(isoResult.timeOnly, '08:39:34');

  const dmyResult = parseExcelDate('03/08/2026 08:39:34');
  assert.ok(dmyResult);
  assert.equal(dmyResult.formatted, '2026-08-03 08:39:34');
});

test('parseExcelDate returns null for invalid / empty / Belum TTD strings', () => {
  assert.equal(parseExcelDate('Belum TTD'), null);
  assert.equal(parseExcelDate('BELUM TTD'), null);
  assert.equal(parseExcelDate('-'), null);
  assert.equal(parseExcelDate(''), null);
  assert.equal(parseExcelDate(null), null);
  assert.equal(parseExcelDate(undefined), null);
});
