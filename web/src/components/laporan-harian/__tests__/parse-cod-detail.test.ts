// Formula direplikasi dari sheet HASIL (LAPORAN_HARIAN_BGG16.xlsx, target
// user, diverifikasi COCOK 100% via simulasi Python thd DATA COPAS sebelum
// ditulis di sini). Test ini pakai fixture kecil buatan (bukan real data
// ribuan baris) yang sengaja mencakup tiap cabang logika.
//
// REVISI filter pengambilan data (lihat passesRowFilter di parse-cod-detail.ts):
// pengelompokan sprinter kini memakai kolom "Sprinter Delivery TTD" (bukan
// lagi "Sprinter Delivery"), ditambah syarat "TTD Retur" = 0 dan "COD" != 0,
// SEMUA per baris sekaligus. Formula "Nominal Sisa COD" (codViaSprinterTtd)
// SENGAJA TIDAK direvisi - tetap dihitung dari SELURUH baris mentah (bukan
// hasil filter baru) - konsekuensinya bisa NEGATIF / "% Clear Nominal COD"
// bisa >100% begitu ada baris yang dikecualikan filter baru (retur/COD=0)
// tapi kolom "Sprinter Delivery TTD"-nya cocok - ini KONSEKUENSI YANG
// DISENGAJA (dikonfirmasi user), bukan bug.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeCodTable, extractCodDetailRows, type CodDetailRawRow } from '../parse-cod-detail.ts';

describe('computeCodTable', () => {
  it('mengelompokkan via "Sprinter Delivery TTD" (bukan "Sprinter Delivery"), filter TTD Retur=0 & COD!=0', () => {
    const rows: CodDetailRawRow[] = [
      // --- Mtr Budi: 4 baris mentah, hanya 2 yang LOLOS filter baru ---
      { sprinterDelivery: 'Mtr Budi', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Budi', cod: 1000, ttdRetur: 0 },
      { sprinterDelivery: 'Mtr Budi', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Budi', cod: 2000, ttdRetur: 0 },
      // COD=0 -> dikecualikan filter baru (tapi tetap ikut dihitung codViaSprinterTtd, kontribusi 0).
      { sprinterDelivery: 'Mtr Budi', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Budi', cod: 0, ttdRetur: 0 },
      // TTD Retur=1 (retur) -> dikecualikan filter baru, TAPI cod=500 TETAP ikut codViaSprinterTtd
      // (formula lama tak direvisi) -> bikin Nominal Sisa COD Mtr Budi jadi NEGATIF.
      { sprinterDelivery: 'Mtr Budi', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Budi', cod: 500, ttdRetur: 1 },

      // --- Mtr Siti: didatangi/diantar oleh "Mtr Andi" tapi TTD oleh "Mtr Siti" ---
      // Membuktikan pengelompokan sekarang ikut kolom TTD, BUKAN Delivery -
      // baris ini harus masuk ke Mtr Siti, bukan Mtr Andi (yang bahkan tak
      // boleh muncul sama sekali di hasil).
      { sprinterDelivery: 'Mtr Andi', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Siti', cod: 800, ttdRetur: 0 },

      // --- Mtr Zaki: 1 baris lolos (belum TTD, COD>0), 1 baris TTD Retur kosong (bukan 0 persis) -> dikecualikan ---
      { sprinterDelivery: 'Mtr Zaki', dpTtd: '', sprinterDeliveryTtd: 'Mtr Zaki', cod: 1200, ttdRetur: 0 },
      { sprinterDelivery: 'Mtr Zaki', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr Zaki', cod: 300, ttdRetur: '' },

      // --- Bukan sprinter (kolom Sprinter Delivery TTD tak berawalan "Mtr") -> harus diabaikan sepenuhnya. ---
      { sprinterDelivery: 'Mtr Budi', dpTtd: '', sprinterDeliveryTtd: 'Budi Santoso', cod: 5000, ttdRetur: 0 },
    ];

    const { rows: table, totals } = computeCodTable(rows);

    assert.deepEqual(
      table.map((r) => r.idSprinter),
      ['Mtr Budi', 'Mtr Siti', 'Mtr Zaki'],
      'urut alfabetis; "Mtr Andi" & "Budi Santoso" tidak boleh muncul'
    );

    const budi = table[0];
    assert.equal(budi.semuaDeliv, 2, 'hanya 2 baris yg lolos (COD=0 & retur=1 dikecualikan)');
    assert.equal(budi.semuaNominalCod, 3000);
    assert.equal(budi.resiSisaNonCod, 0, 'selalu 0 skrg - matched cuma berisi baris COD!=0');
    assert.equal(budi.resiSisaCod, 0, 'dpTtd terisi utk kedua baris matched -> tak ada resi sisa');
    assert.equal(budi.nominalSisaCod, -500, '3000 - 3500 (formula lama ikut hitung baris retur/COD=0 via kolom TTD)');
    assert.equal(budi.suksesTtd, 2);
    assert.equal(budi.pctClearPaket, 1);
    assert.ok(Math.abs((budi.pctClearNominalCod ?? 0) - 3500 / 3000) < 1e-9, '>100% - konsekuensi disengaja');
    assert.ok(Math.abs((budi.pctSelisih ?? 0) - (1 - 3500 / 3000)) < 1e-9);

    const siti = table[1];
    assert.equal(siti.semuaDeliv, 1, 'baris yg diantar Mtr Andi tapi di-TTD Mtr Siti ikut Mtr Siti');
    assert.equal(siti.semuaNominalCod, 800);
    assert.equal(siti.nominalSisaCod, 0);
    assert.equal(siti.pctClearNominalCod, 1);

    const zaki = table[2];
    assert.equal(zaki.semuaDeliv, 1, 'baris kedua (TTD Retur kosong, bukan persis 0) dikecualikan');
    assert.equal(zaki.semuaNominalCod, 1200);
    assert.equal(zaki.resiSisaNonCod, 0, 'cod>0 -> tak pernah masuk kategori Non COD');
    assert.equal(zaki.resiSisaCod, 1, 'dpTtd kosong & cod>0 -> resi sisa COD');
    assert.equal(zaki.nominalSisaCod, -300, '1200 - 1500 (baris retur-kosong tetap ikut lewat kolom TTD)');
    assert.equal(zaki.suksesTtd, 0);
    assert.equal(zaki.pctClearPaket, 0);

    // Baris TOTAL - dihitung ULANG dari agregat (bukan rata-rata per baris).
    assert.equal(totals.semuaDeliv, 4);
    assert.equal(totals.semuaNominalCod, 5000);
    assert.equal(totals.resiSisaNonCod, 0);
    assert.equal(totals.resiSisaCod, 1);
    assert.equal(totals.nominalSisaCod, -800);
    assert.equal(totals.suksesTtd, 3);
    assert.ok(Math.abs(totals.pctClearPaket - 3 / 4) < 1e-9);
  });

  it('COD=0 dikecualikan sepenuhnya walau TTD Retur=0 & kode MTR valid', () => {
    const rows: CodDetailRawRow[] = [
      { sprinterDelivery: 'Mtr NoCod', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr NoCod', cod: 0, ttdRetur: 0 },
      { sprinterDelivery: 'Mtr NoCod', dpTtd: 'BATANG01', sprinterDeliveryTtd: 'Mtr NoCod', cod: 0, ttdRetur: 0 },
    ];
    const { rows: table } = computeCodTable(rows);
    assert.equal(table.length, 0, 'sprinter tanpa satupun baris ber-COD tak boleh muncul');
  });
});

describe('extractCodDetailRows', () => {
  it('membaca kolom lewat NAMA header (toleran spasi/kapitalisasi), termasuk TTD Retur, lewati baris tanpa Sprinter Delivery', () => {
    const raw = [
      {
        'sprinter delivery': ' Mtr Agus ',
        'DP TTD': 'BATANG01',
        'Sprinter Delivery TTD': 'Mtr Agus',
        COD: '1.234',
        'ttd retur': 0,
      },
      { 'Sprinter Delivery': '', 'DP TTD': '', 'Sprinter Delivery TTD': '', COD: 0, 'TTD Retur': 0 },
    ];
    const out = extractCodDetailRows(raw);
    assert.equal(out.length, 1, 'baris tanpa Sprinter Delivery harus dilewati');
    assert.equal(out[0].sprinterDelivery, 'Mtr Agus');
    assert.equal(out[0].cod, 1.234);
    assert.equal(out[0].ttdRetur, 0);
  });
});
