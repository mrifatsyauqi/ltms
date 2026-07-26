import { callAppsScript } from './client';

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
  /** Sumber aktivitas: 'Manual Feedback' | 'Auto-Close (tidak muncul di import)' (Supabase v1.3). */
  sumber?: string;
};

/**
 * Riwayat aktivitas feedback dari Activity_Log (di-JOIN ke LongTail untuk
 * Status Terkini). Rentang tanggal ISO 'YYYY-MM-DD'; scoping DP server-side.
 */
export function listRiwayatFeedback(actorEmail: string, from?: string, to?: string) {
  return callAppsScript<RiwayatFeedbackRow[]>('listRiwayatFeedback', { email: actorEmail, from, to });
}
