import { callAppsScript } from './client';

export type LastUpdate =
  | { hasUpdate: true; tanggal: string; jam: string; sumber: string }
  | { hasUpdate: false };

/**
 * Waktu data Long Tail terakhir berubah (import/feedback), dari Activity_Log.
 * Di-scope server-side: Admin DP hanya DP-nya, Admin Cabang global.
 */
export function getLastUpdate(actorEmail: string) {
  return callAppsScript<LastUpdate>('getLastUpdate', { email: actorEmail });
}
