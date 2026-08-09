import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOkIndicator,
  pctDelivery,
  totalKaryawanMasuk,
  totalSetoranKurir,
  ttdCodSistem,
} from '../formulas.ts';
import { emptyManualNumericFields } from '../types.ts';
import type { CodTableTotals } from '../types.ts';

const totals: CodTableTotals = {
  semuaDeliv: 1950,
  semuaNominalCod: 69017044,
  resiSisaNonCod: 1,
  resiSisaCod: 74,
  nominalSisaCod: 4133206,
  pctClearPaket: 0.9615,
  pctClearNominalCod: 0.9401,
  pctSelisih: 0.0214,
  suksesTtd: 1875,
  pctTtd: 0.9615,
};

describe('Laporan Harian formulas (verified against LAPORAN_HARIAN_BGG16.xlsx target)', () => {
  it('Total Setoran Kurir = J56 - M56 (contoh target: 69.017.044 - 4.133.206 = 64.883.838)', () => {
    assert.equal(totalSetoranKurir(totals), 64883838);
  });

  it('TTD COD (Sistem) identik dgn Total Setoran Kurir', () => {
    assert.equal(ttdCodSistem(totals), totalSetoranKurir(totals));
  });

  it('Indikator OK ketika Total Setoran Kurir == TTD COD Sistem (selalu terjadi krn rumus identik)', () => {
    const s = totalSetoranKurir(totals);
    const t = ttdCodSistem(totals);
    assert.equal(computeOkIndicator(s, t), 'OK');
  });

  it('Indikator KURANG ketika selisih < 0', () => {
    assert.equal(computeOkIndicator(100, 150), 'KURANG');
  });

  it('Indikator LEBIH ketika selisih > 0', () => {
    assert.equal(computeOkIndicator(150, 100), 'LEBIH');
  });

  it('Indikator CEK ketika salah satu nilai null/kosong', () => {
    assert.equal(computeOkIndicator(null, 100), 'CEK');
    assert.equal(computeOkIndicator(100, null), 'CEK');
  });

  it('% Delivery = Total Scan Delivery / Total Scan Sampai (contoh target: 2962/2946 ~ 101%)', () => {
    const fields = { ...emptyManualNumericFields(), totalScanSampai: 2946, totalScanDelivery: 2962 };
    const pct = pctDelivery(fields);
    assert.ok(pct !== null && Math.abs(pct - 2962 / 2946) < 1e-9);
  });

  it('% Delivery null kalau Total Scan Sampai kosong/0 (hindari bagi nol)', () => {
    const fields = { ...emptyManualNumericFields(), totalScanSampai: 0, totalScanDelivery: 100 };
    assert.equal(pctDelivery(fields), null);
  });

  it('Total Karyawan Masuk = Jumlah Admin + Jumlah Sprinter + Jumlah Sortir + Penambahan Peakseason (contoh laporan: 3 + 33 + 1 + 0 = 37)', () => {
    const fields = {
      ...emptyManualNumericFields(),
      jumlahAdmin: 3,
      jumlahSprinter: 33,
      jumlahSortir: 1,
      penambahanPeakseason: 0,
    };
    assert.equal(totalKaryawanMasuk(fields), 37);
  });

  it('Total Karyawan Masuk ikut menjumlahkan Penambahan Peakseason kalau terisi', () => {
    const fields = {
      ...emptyManualNumericFields(),
      jumlahAdmin: 2,
      jumlahSprinter: 29,
      jumlahSortir: 1,
      penambahanPeakseason: 5,
    };
    assert.equal(totalKaryawanMasuk(fields), 37);
  });
});
