import { callAppsScript } from './client';

export type RiwayatFeedbackRow = {
  waybill: string;
  tanggal: string;
  jam: string;
  attempt: number | string;
  feedbackSaatItu: string;
  adminDp: string;
  dp: string;
  /** 'Clear TTD' | 'Belum Clear TTD' | 'Tidak ada di LongTail' */
  statusTerkini: string;
  ts: number | null;
};

/**
 * Riwayat aktivitas feedback dari Activity_Log (di-JOIN ke LongTail untuk
 * Status Terkini). Rentang tanggal ISO 'YYYY-MM-DD'; scoping DP server-side.
 */
export function listRiwayatFeedback(actorEmail: string, from?: string, to?: string) {
  return callAppsScript<RiwayatFeedbackRow[]>('listRiwayatFeedback', { email: actorEmail, from, to });
}
