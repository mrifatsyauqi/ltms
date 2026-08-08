// Formula direplikasi dari sheet HASIL (LAPORAN_HARIAN_BGG16.xlsx, target
// user, diverifikasi COCOK 100% via simulasi Python thd DATA COPAS sebelum
// ditulis di sini). Test ini pakai fixture kecil buatan (bukan real data
// ribuan baris) yang sengaja mencakup tiap cabang logika: semua clear,
// campuran clear/belum, sprinter tanpa COD (harus dikecualikan), dan nama
// non-sprinter (harus diabaikan).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeCodTable, extractCodDetailRows, type CodDetailRawRow } from '../parse-cod-detail.ts';

describe('computeCodTable', () => {
  it('menghitung SEMUA 8 kolom per sprinter sesuai formula sheet HASIL', () => {
    const rows: CodDetailRawRow[] = [
      // Mtr Budi: 3 paket, SEMUA sudah TTD (DP TTD terisi) -> 100% clear.
      { sprinterDelivery: 'Mtr Budi', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Budi', cod: 1000 },
      { sprinterDelivery: 'Mtr Budi', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Budi', cod: 2000 },
      { sprinterDelivery: 'Mtr Budi', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Budi', cod: 0 },
      // Mtr Siti: 4 paket, 2 sudah TTD (COD 500+500), 2 BELUM TTD (COD 0 dan 800).
      { sprinterDelivery: 'Mtr Siti', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Siti', cod: 500 },
      { sprinterDelivery: 'Mtr Siti', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Siti', cod: 500 },
      { sprinterDelivery: 'Mtr Siti', dpTtd: '', sprinterDeliveryTtd: '', cod: 0 },
      { sprinterDelivery: 'Mtr Siti', dpTtd: '', sprinterDeliveryTtd: '', cod: 800 },
      // Mtr NoCod: 2 paket, COD selalu 0 -> HARUS dikecualikan sepenuhnya.
      { sprinterDelivery: 'Mtr NoCod', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr NoCod', cod: 0 },
      { sprinterDelivery: 'Mtr NoCod', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr NoCod', cod: 0 },
      // Bukan sprinter (tak berawalan "Mtr") -> harus diabaikan sepenuhnya.
      { sprinterDelivery: 'Budi Santoso', dpTtd: '', sprinterDeliveryTtd: '', cod: 5000 },
    ];

    const { rows: table, totals } = computeCodTable(rows);

    assert.equal(table.length, 2, 'Mtr NoCod (total COD=0) dan non-sprinter harus dikecualikan');
    assert.deepEqual(
      table.map((r) => r.idSprinter),
      ['Mtr Budi', 'Mtr Siti'],
      'urut alfabetis'
    );

    const budi = table[0];
    assert.equal(budi.semuaDeliv, 3);
    assert.equal(budi.semuaNominalCod, 3000);
    assert.equal(budi.resiSisaNonCod, 0);
    assert.equal(budi.resiSisaCod, 0);
    assert.equal(budi.nominalSisaCod, 0);
    assert.equal(budi.suksesTtd, 3);
    assert.equal(budi.pctClearPaket, 1);
    assert.equal(budi.pctClearNominalCod, 1);
    assert.equal(budi.pctSelisih, 0);
    assert.equal(budi.pctTtd, budi.pctClearPaket);

    const siti = table[1];
    assert.equal(siti.semuaDeliv, 4);
    assert.equal(siti.semuaNominalCod, 1800);
    assert.equal(siti.resiSisaNonCod, 1, '1 paket belum TTD dengan COD<=0');
    assert.equal(siti.resiSisaCod, 1, '1 paket belum TTD dengan COD>0');
    assert.equal(siti.nominalSisaCod, 800, '1800 total - 1000 yang sudah TTD (via Sprinter Delivery TTD)');
    assert.equal(siti.suksesTtd, 2);
    assert.equal(siti.pctClearPaket, 0.5);
    assert.ok(Math.abs((siti.pctClearNominalCod ?? 0) - 1000 / 1800) < 1e-9);
    assert.ok(Math.abs((siti.pctSelisih ?? 0) - (0.5 - 1000 / 1800)) < 1e-9);

    // Baris TOTAL - dihitung ULANG dari agregat (bukan rata-rata per baris).
    assert.equal(totals.semuaDeliv, 7);
    assert.equal(totals.semuaNominalCod, 4800);
    assert.equal(totals.resiSisaNonCod, 1);
    assert.equal(totals.resiSisaCod, 1);
    assert.equal(totals.nominalSisaCod, 800);
    assert.equal(totals.suksesTtd, 5);
    assert.ok(Math.abs(totals.pctClearPaket - 5 / 7) < 1e-9);
  });

  it('COD dari paket yg di-TTD oleh sprinter LAIN (bukan sprinter pengantar) TIDAK ikut mengurangi Nominal Sisa COD sprinter pengantar - replikasi quirk formula asli, bukan bug', () => {
    const rows: CodDetailRawRow[] = [
      // Diantar Mtr A, tapi di-TTD oleh Mtr B (kolom Sprinter Delivery TTD = Mtr B).
      { sprinterDelivery: 'Mtr A', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr B', cod: 1000 },
    ];
    const { rows: table } = computeCodTable(rows);
    const a = table.find((r) => r.idSprinter === 'Mtr A')!;
    // Total COD Mtr A = 1000, tapi SUM(COD where Sprinter Delivery TTD=='Mtr A') = 0
    // (karena kolom itu berisi 'Mtr B' utk baris ini) -> Nominal Sisa COD Mtr A tetap 1000.
    assert.equal(a.semuaNominalCod, 1000);
    assert.equal(a.nominalSisaCod, 1000);
  });
});

describe('extractCodDetailRows', () => {
  it('membaca kolom lewat NAMA header (toleran spasi/kapitalisasi), lewati baris tanpa Sprinter Delivery', () => {
    const raw = [
      { 'sprinter delivery': ' Mtr Agus ', 'DP TTD': 'BATANG01', 'Sprinter Delivery TTD': 'Mtr Agus', COD: '1.234' },
      { 'Sprinter Delivery': '', 'DP TTD': '', 'Sprinter Delivery TTD': '', COD: 0 },
    ];
    const out = extractCodDetailRows(raw);
    assert.equal(out.length, 1, 'baris tanpa Sprinter Delivery harus dilewati');
    assert.equal(out[0].sprinterDelivery, 'Mtr Agus');
    assert.equal(out[0].cod, 1.234);
  });
});
