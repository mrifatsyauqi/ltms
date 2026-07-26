import { db } from './client';
import { requireActor } from './helpers';
import { ApiError } from '@/lib/errors';
import { jakartaParts } from './longtail-shared';
import type { LastUpdate } from '@/lib/apps-script/meta';

/**
 * Waktu data Long Tail terakhir berubah (import/feedback) = entri terakhir di
 * Activity_Log. Admin DP di-scope ke DP-nya; Admin Cabang global.
 */
export async function getLastUpdate(actorEmail: string): Promise<LastUpdate> {
  const actor = await requireActor(actorEmail);
  const isCabang = actor.role === 'Admin Cabang';

  let q = db()
    .from('activity_log')
    .select('created_at, sumber, dp')
    .order('created_at', { ascending: false })
    .limit(1);
  if (!isCabang) q = q.eq('dp', actor.dropPoint);

  const { data, error } = await q;
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const row = (data ?? [])[0] as { created_at: string; sumber: string | null } | undefined;
  if (!row) return { hasUpdate: false };

  const parts = jakartaParts(new Date(String(row.created_at)));
  return { hasUpdate: true, tanggal: parts.tanggal, jam: parts.jam, sumber: String(row.sumber ?? '') };
}
