// Tipe kanonik lapisan data (Supabase-only sejak Tahap 8). Bentuk respons tetap
// "shape sheet lama" (mis. 'No. Waybill') supaya API & frontend tidak berubah.

// ---- Drop Point -------------------------------------------------------------
export type DropPointRow = {
  'Kode DP': string;
  'Nama DP': string;
  'Wilayah/Cabang': string;
  'Status Aktif': string;
};
export type CreateDropPointInput = {
  kodeDp: string;
  namaDp: string;
  wilayah?: string;
};
export type UpdateDropPointInput = Partial<{
  namaDp: string;
  wilayah: string;
  statusAktif: boolean;
}>;

// ---- Master Feedback --------------------------------------------------------
export type MasterFeedbackRow = {
  ID: number;
  'Nama Feedback': string;
  'Status Aktif': string;
};

// ---- Favorite Feedback ------------------------------------------------------
export type FavoriteFeedbackRow = {
  'Email Admin DP': string;
  'Nama Feedback': string;
  Urutan: number;
};

// ---- Users ------------------------------------------------------------------
export type UserRow = {
  Nama: string;
  Email: string;
  NIK: string;
  'Tipe Akun': 'individual' | 'general';
  Role: string;
  'Drop Point': string;
  'Status Aktif': string;
};
export type CreateUserInput = {
  nama: string;
  email: string;
  nik: string;
  role: 'Admin Cabang' | 'Admin DP';
  dropPoint?: string;
};
export type UpdateUserInput = Partial<{
  nama: string;
  nik: string;
  role: 'Admin Cabang' | 'Admin DP';
  dropPoint: string;
  statusAktif: boolean;
}>;
/** Akun General satu per Drop Point (dibuat dari halaman Master Drop Point). */
export type CreateGeneralAccountResult = {
  email: string;
  nik: string;
  namaTampilan: string;
};
export type CredentialsUser = {
  nama: string;
  namaTampilan: string;
  email: string;
  nik: string;
  tipeAkun: 'individual' | 'general';
  role: string;
  dropPoint: string;
};

/** Resolusi role + Drop Point dari tabel users (untuk NextAuth). */
export type AuthUser = {
  nama: string;
  email: string;
  role: string;
  dropPoint: string;
  statusAktif: boolean;
};

// ---- LongTail ---------------------------------------------------------------
export type LongTailRow = {
  'No. Waybill': string;
  'Status Terakhir': string;
  'Alasan Paket Bermasalah': string;
  'DP Sampai': string;
  'Waktu Sampai': string;
  'Umur Paket': number | string;
  'Sprinter Delivery': string;
  COD: string;
  'Delivery Attempt': number;
  Feedback: string;
  'Log Feedback': string;
  'Perlu Review'?: string;
  /** true jika Feedback sudah mengandung 'TTD' (aging beku). Diisi server. */
  __isClearTTD?: boolean;
  /** Token versi utk optimistic locking (Bagian 9.4). Diisi server. */
  __version?: string;
};
export type CreateLongTailInput = {
  noWaybill: string;
  statusTerakhir?: string;
  alasanBermasalah?: string;
  dpSampai?: string;
  waktuSampai?: string;
  sprinterDelivery?: string;
  cod?: string;
  deliveryAttempt?: number;
};
// 'feedback' sengaja tidak ada: ubah feedback HANYA lewat submitFeedback.
export type UpdateLongTailInput = Partial<{
  statusTerakhir: string;
  alasanBermasalah: string;
  dpSampai: string;
  waktuSampai: string;
  sprinterDelivery: string;
  cod: string;
  deliveryAttempt: number;
}>;
export type ResetPreview = { dryRun: true; counts: Record<string, number> };
export type ResetResult = { cleared: Record<string, number> };

// ---- Import -----------------------------------------------------------------
export type ImportResult = {
  batchId: string;
  total: number;
  inserted: number;
  updated: number;
  /** Waybill Clear TTD yang muncul lagi di tarikan dgn status baru - dikoreksi otomatis (PRD 7.1 revisi). */
  koreksiOtomatis: number;
  skipped: number;
  /** Auto-Close (v1.3): jumlah waybill yang hilang dari tarikan lalu diarsipkan. */
  closed?: number;
  closedClearTTD?: number;
  closedAlur?: number;
};
export type ImportBatchRow = {
  'Batch ID': string;
  Tanggal: string;
  Jam: string;
  'Admin Cabang': string;
  'Nama File': string;
  'Total Baris': number;
  Berhasil: number;
  Gagal: number;
  Status: string;
  Keterangan: string;
};
export type MappingTemplate = {
  namaTemplate: string;
  mapping: Record<string, string | null>;
  dibuatOleh: string;
  tanggal: string;
};

// ---- Meta -------------------------------------------------------------------
/** Waktu import Data Long Tail terakhir (bukan aktivitas feedback manual) - lihat getLastUpdate. */
export type LastUpdate =
  | { hasUpdate: true; tanggal: string; jam: string }
  | { hasUpdate: false };

// ---- Riwayat Feedback -------------------------------------------------------
export type RiwayatFeedbackRow = {
  waybill: string;
  tanggal: string;
  jam: string;
  attempt: number | string;
  feedbackSaatItu: string;
  adminDp: string;
  dp: string;
  /** 'Clear TTD' | 'Belum Clear TTD' | 'Clear TTD (Arsip)' | 'Close Alur (Arsip)' | 'Tidak ada di LongTail' */
  statusTerkini: string;
  ts: number | null;
  /** 'Manual Feedback' | 'Auto-Close (tidak muncul di import)'. */
  sumber?: string;
};

// ---- Dashboard --------------------------------------------------------------
export type DashboardSummary = {
  total: number;
  sudahFeedback: number;
  belumFeedback: number;
  clearTTD: number;
  belumClearTTD: number;
  progressFeedbackPct: number;
  paketTertua: number;
  paketTertuaWaybill: string;
  paketLebih3Hari: number;
  progressHariIni: number;
};
export type MonitoringDpRow = {
  dp: string;
  total: number;
  sudah: number;
  belum: number;
  clearTTD: number;
  lebih3: number;
  progressPct: number;
  lastUpdate: string;
};
export type DashboardData = {
  role: string;
  dropPoint: string;
  summary: DashboardSummary;
  distribusiFeedback: { kategori: string; jumlah: number }[];
  aging: { hari: string; jumlah: number }[];
  monitoringDp: MonitoringDpRow[];
  progressPerSprinter: { sprinter: string; total: number; sudah: number; progressPct: number }[];
};
