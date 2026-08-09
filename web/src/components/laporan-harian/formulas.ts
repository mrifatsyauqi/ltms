import type { CodTableTotals, ManualNumericFields, OkIndicator } from './types';

/** "Total Setoran Kurir" = SUM(Semua Nominal COD) - SUM(Nominal Sisa COD)
 *  dari tabel Bagian A (formula asli Excel: =J56-M56). */
export function totalSetoranKurir(totals: CodTableTotals): number {
  return totals.semuaNominalCod - totals.nominalSisaCod;
}

/** "TTD COD (Sistem)" - RUMUS SAMA PERSIS dgn Total Setoran Kurir
 *  (dikonfirmasi user: kedua field secara matematis identik). Dihitung
 *  ULANG di sini (bukan alias langsung) supaya kalau salah satu field ini
 *  nanti bisa di-override manual, indikator OK di bawah tetap benar
 *  otomatis tanpa perlu ubah kode. */
export function ttdCodSistem(totals: CodTableTotals): number {
  return totals.semuaNominalCod - totals.nominalSisaCod;
}

/** Indikator "OK"/"KURANG"/"LEBIH"/"CEK" - replikasi PERSIS formula Excel:
 *  D11 = Total Setoran Kurir - TTD COD (Sistem)
 *  D11 < 0 -> KURANG, D11 = 0 -> OK, D11 kosong/N/A -> CEK, selain itu -> LEBIH. */
export function computeOkIndicator(setoranKurir: number | null, ttdCod: number | null): OkIndicator {
  if (setoranKurir === null || ttdCod === null || Number.isNaN(setoranKurir) || Number.isNaN(ttdCod)) {
    return 'CEK';
  }
  const selisih = setoranKurir - ttdCod;
  if (selisih < 0) return 'KURANG';
  if (selisih === 0) return 'OK';
  return 'LEBIH';
}

/** "% Delivery" = Total Scan Delivery / Total Scan Sampai (keduanya manual). */
export function pctDelivery(fields: ManualNumericFields): number | null {
  if (!fields.totalScanSampai || fields.totalScanDelivery === null) return null;
  return fields.totalScanDelivery / fields.totalScanSampai;
}

/** "Total Karyawan Masuk" = Jumlah Admin + Jumlah Sprinter + Jumlah Sortir +
 *  Penambahan Peakseason - AUTO, bukan input manual terpisah (dikonfirmasi
 *  user: SEMUA 4 komponen ikut dijumlahkan - file Excel asli cuma
 *  menjumlahkan Admin+Sprinter (D15=D16+D17), tapi user secara eksplisit
 *  meng-override itu utk sistem ini). Komponen-komponennya sendiri
 *  (Admin/Sprinter/Sortir/Peakseason) tetap input manual terpisah. */
export function totalKaryawanMasuk(fields: ManualNumericFields): number | null {
  const { jumlahAdmin, jumlahSprinter, jumlahSortir, penambahanPeakseason } = fields;
  if (jumlahAdmin === null && jumlahSprinter === null && jumlahSortir === null && penambahanPeakseason === null) {
    return null;
  }
  return (jumlahAdmin ?? 0) + (jumlahSprinter ?? 0) + (jumlahSortir ?? 0) + (penambahanPeakseason ?? 0);
}
