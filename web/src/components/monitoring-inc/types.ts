export type IncRow = {
  awb: string;
  tempatTujuan: string;
  /** Kolom opsional "DP Delivery" dari file tarikan JMS (Kode/Nama DP) -
   *  dipakai sbg disambiguator UTAMA saat 1 Kecamatan dipakai >1 DP. Kosong
   *  utk file lama yg belum punya kolom ini - fallback ke Kecamatan. */
  dpDelivery?: string;
  namaPenerima: string;
  alamatPenerima: string;
  cod: number;
  waktuTtd: string; // 'YYYY-MM-DD HH:mm:ss' or ''
  maksimalTtd: string; // 'HH:mm:ss'
  maksimalTtdFull?: string;
  waktuUploadSistem: string; // 'YYYY-MM-DD HH:mm:ss'
  isClearTtd: boolean;
  isLate: boolean;
  status: 'CLEAR' | 'BELUM' | 'LATE';
  slaHours?: number | null;
};

export type IncStats = {
  total: number;
  clear: number;
  belum: number;
  late: number;
  percent: number;
  totalCod: number;
  avgSlaHours: number;
};

export type UploadStage =
  | 'idle'
  | 'reading'
  | 'parsing'
  | 'filtering'
  | 'counting'
  | 'validating'
  | 'completed';

export type UploadedFileInfo = {
  name: string;
  sizeFormatted: string;
  totalResi: number; // Filtered count for target city
  rawTotalResi: number; // Total rows in Excel file
  uploadTimestamp: string;
  targetKota: string;
  file?: File;
};

export type RecentUploadHistoryItem = {
  id: string;
  fileName: string;
  targetKota: string;
  totalResi: number; // Filtered count
  rawTotalResi?: number;
  uploadTimestamp: string;
  createdAt: number; // Unix timestamp in milliseconds for 7-day retention
  status: 'Processing' | 'Success' | 'Failed' | 'Berhasil' | 'Gagal';
  dataUrl?: string;
};

export type ProcessingStep = {
  id: number;
  label: string;
  status: 'idle' | 'running' | 'done';
};

export const DEFAULT_PROCESSING_STEPS: { id: number; label: string }[] = [
  { id: 1, label: 'Membaca File' },
  { id: 2, label: 'Memfilter Kota' },
  { id: 3, label: 'Mapping Kecamatan' },
  { id: 4, label: 'Menghitung SLA' },
  { id: 5, label: 'Menyimpan Monitoring' },
];

export const AVAILABLE_CITIES = [
  'BATANG',
  'PEKALONGAN',
  'PEMALANG',
  'TEGAL',
  'SEMARANG',
  'KENDAL',
  'BREBES',
] as const;
