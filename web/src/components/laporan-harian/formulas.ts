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

/** "Total Karyawan Masuk" = Jumlah Admin + Jumlah Sprinter (formula asli
 *  Excel: D15=D16+D17) - AUTO, bukan input manual terpisah, meski
 *  komponen-komponennya (Admin/Sprinter/Sortir/Peakseason) tetap manual. */
export function totalKaryawanMasuk(fields: ManualNumericFields): number | null {
  if (fields.jumlahAdmin === null && fields.jumlahSprinter === null) return null;
  return (fields.jumlahAdmin ?? 0) + (fields.jumlahSprinter ?? 0);
}
