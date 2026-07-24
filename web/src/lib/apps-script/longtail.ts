import { callAppsScript } from './client';

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

// 'feedback' sengaja tidak ada: ubah feedback HANYA lewat submitFeedback
// (append Log Feedback + Activity_Log + freeze Umur), lihat Code.gs updateLongTail.
export type UpdateLongTailInput = Partial<{
  statusTerakhir: string;
  alasanBermasalah: string;
  dpSampai: string;
  waktuSampai: string;
  sprinterDelivery: string;
  cod: string;
  deliveryAttempt: number;
}>;

/** Admin Cabang melihat semua baris; Admin DP otomatis di-scope ke DP miliknya sendiri di Apps Script (Bagian 5 PRD). */
export function listLongTail(actorEmail: string) {
  return callAppsScript<LongTailRow[]>('listLongTail', { email: actorEmail });
}

export function getLongTail(actorEmail: string, waybill: string) {
  return callAppsScript<LongTailRow>('getLongTail', { email: actorEmail, waybill });
}

export function createLongTail(actorEmail: string, data: CreateLongTailInput) {
  return callAppsScript<{ noWaybill: string }>('createLongTail', { email: actorEmail, data });
}

export function updateLongTail(actorEmail: string, waybill: string, data: UpdateLongTailInput) {
  return callAppsScript<LongTailRow>('updateLongTail', { email: actorEmail, waybill, data });
}

/**
 * Submit feedback untuk satu waybill (Fase 4, Bagian 9.0/9.4). `baseVersion`
 * adalah token __version dari baris saat terakhir dimuat client — dipakai
 * untuk optimistic locking. Bila server menolak (VERSION_CONFLICT), error-nya
 * membawa `data` = baris terkini untuk refresh.
 */
export function submitFeedback(actorEmail: string, waybill: string, feedback: string, baseVersion?: string) {
  return callAppsScript<LongTailRow>('submitFeedback', {
    email: actorEmail,
    waybill,
    feedback,
    baseVersion,
  });
}

/** Hapus 1 baris LongTail (Admin Cabang) — koreksi salah-import / bersihkan data test. */
export function deleteLongTail(actorEmail: string, waybill: string) {
  return callAppsScript<{ waybill: string }>('deleteLongTail', { email: actorEmail, waybill });
}
