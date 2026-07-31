import { db } from './client';
import { requireActor } from './helpers';
import { ApiError } from '@/lib/errors';
import { jakartaParts } from './longtail-shared';
import type { LastUpdate } from '@/lib/data/types';

/**
 * Waktu IMPORT Data Long Tail terakhir - dibaca langsung dari `import_batch`
 * (satu baris per proses import, lihat import.ts), BUKAN lagi dari entri
 * Activity_Log terbaru (yg sebelumnya bisa jadi submit feedback manual,
 * bukan import - membingungkan krn label "pembaruan terakhir" seharusnya
 * spesifik soal kapan data ditarik ulang dari sumbernya, bukan aktivitas
 * apa pun). Import bersifat GLOBAL (bisa mencakup banyak DP sekaligus,
 * `import_batch` tak punya kolom dp) - jadi tak lagi di-scope per DP spt
 * sebelumnya, Admin Cabang & Admin DP melihat waktu import global yg sama.
 */
export async function getLastUpdate(actorEmail: string): Promise<LastUpdate> {
  await requireActor(actorEmail); // tetap wajib actor valid, walau hasil tak lagi di-scope per DP

  const { data, error } = await db()
    .from('import_batch')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const row = (data ?? [])[0] as { created_at: string } | undefined;
  if (!row) return { hasUpdate: false };

  const parts = jakartaParts(new Date(String(row.created_at)));
  return { hasUpdate: true, tanggal: parts.tanggal, jam: parts.jam };
}
