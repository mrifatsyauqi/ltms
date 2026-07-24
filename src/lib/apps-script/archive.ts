import { callAppsScript } from './client';

export type ArchivePreview = { eligible: number; thresholdDays: number };
export type ArchiveResult = { archived: number; thresholdDays: number };

/** Hitung berapa paket Clear TTD > threshold hari yang siap diarsipkan (tanpa memindah). */
export function previewArchive(actorEmail: string, thresholdDays = 30) {
  return callAppsScript<ArchivePreview>('archiveClearTTD', {
    email: actorEmail,
    thresholdDays,
    dryRun: true,
  });
}

/** Pindahkan paket Clear TTD > threshold hari ke LongTail_Archive. */
export function runArchive(actorEmail: string, thresholdDays = 30) {
  return callAppsScript<ArchiveResult>('archiveClearTTD', { email: actorEmail, thresholdDays });
}
