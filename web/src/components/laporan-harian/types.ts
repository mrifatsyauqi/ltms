// Laporan Harian Operasional DP - lihat parse-cod-detail.ts utk sumber
// perhitungan (formula direplikasi PERSIS dari sheet HASIL, file target
// LAPORAN_HARIAN_BGG16.xlsx yang diverifikasi manual oleh user).

/** Satu baris Rincian Nominal COD Kurir (Bagian A), per Sprinter. */
export interface SprinterCodRow {
  idSprinter: string;
  semuaDeliv: number;
  semuaNominalCod: number;
  resiSisaNonCod: number;
  resiSisaCod: number;
  nominalSisaCod: number;
  /** fraksi 0-1, SAMA dgn pctTtd (lihat parse-cod-detail.ts). */
  pctClearPaket: number;
  /** fraksi 0-1, bisa null kalau semuaNominalCod = 0 (dibagi nol). */
  pctClearNominalCod: number | null;
  /** pctClearPaket - pctClearNominalCod (null kalau salah satu null). */
  pctSelisih: number | null;
  suksesTtd: number;
  /** fraksi 0-1, identik dgn pctClearPaket (kolom "TARGET 95% - % TTD"). */
  pctTtd: number;
}

/** Baris TOTAL (footer tabel Bagian A) - bentuk sama minus idSprinter. */
export type CodTableTotals = Omit<SprinterCodRow, 'idSprinter'>;

export type OkIndicator = 'OK' | 'KURANG' | 'LEBIH' | 'CEK';

/** Field ABSENSI + indikasi lain - SEMUA manual, angka polos. */
export interface ManualNumericFields {
  totalScanSampai: number | null;
  /** MANUAL (bukan auto-SUM) - dikonfirmasi user, sesuai file target. */
  totalScanDelivery: number | null;
  jumlahAdmin: number | null;
  jumlahSprinter: number | null;
  jumlahSortir: number | null;
  penambahanPeakseason: number | null;
}

/** Field teks bebas TANPA logic/formula apa pun - textarea kosong. */
export interface ManualTextFields {
  namaTerlambatIjin: string;
  missroute: string;
  namaIndikasiCod: string;
  namaTelatSetoranH1: string;
  catatanKhusus: string;
}

/** Sisa Setoran H-1 - opsional, TANPA default/formula (lihat spek). */
export interface OptionalManualFields {
  sisaSetoranH1: number | null;
}

export interface PhotoSlot {
  label: string;
  imageDataUrl: string | null;
  jam: string;
  kondisi: string;
}

export const PHOTO_SLOT_LABELS = ['FOTO 1', 'FOTO 2', 'FOTO 3', 'FOTO 4', 'FOTO 5'] as const;

export function emptyPhotoSlots(): PhotoSlot[] {
  return PHOTO_SLOT_LABELS.map((label) => ({ label, imageDataUrl: null, jam: '', kondisi: '' }));
}

export function emptyManualNumericFields(): ManualNumericFields {
  return {
    totalScanSampai: null,
    totalScanDelivery: null,
    jumlahAdmin: null,
    jumlahSprinter: null,
    jumlahSortir: null,
    penambahanPeakseason: null,
  };
}

export function emptyManualTextFields(): ManualTextFields {
  return {
    namaTerlambatIjin: '',
    missroute: '',
    namaIndikasiCod: '',
    namaTelatSetoranH1: '',
    catatanKhusus: '',
  };
}
