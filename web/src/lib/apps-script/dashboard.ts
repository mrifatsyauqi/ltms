import { callAppsScript } from './client';

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

/**
 * Semua angka dihitung & di-scope server-side (Admin DP hanya DP-nya).
 * `dp` opsional: bila diisi (Admin Cabang memilih 1 DP di filter CAKUPAN),
 * server memfilter ke DP itu memakai jalur yang sama dengan Admin DP.
 */
export function getDashboard(actorEmail: string, dp?: string) {
  return callAppsScript<DashboardData>('getDashboard', { email: actorEmail, dp });
}
