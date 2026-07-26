import { db } from './client';
import { ApiError } from '@/lib/errors';

export type Actor = { email: string; role: string; dropPoint: string };

/**
 * Resolusi + validasi aktor dari tabel users (ganti requireActor_ Apps Script).
 * Email disimpan & dibandingkan lowercase (hindari wildcard ilike). Menolak
 * user yang tidak ada atau nonaktif.
 */
export async function requireActor(email: string | null | undefined): Promise<Actor> {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) throw new ApiError('UNAUTHENTICATED', 'Email kosong');
  const { data, error } = await db()
    .from('users')
    .select('email, role, drop_point, status_aktif')
    .eq('email', e)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data || data.status_aktif !== true) {
    throw new ApiError('UNAUTHENTICATED', 'User tidak dikenali atau nonaktif di tabel users');
  }
  return { email: String(data.email), role: String(data.role), dropPoint: String(data.drop_point ?? '') };
}

export function requireRole(actor: Actor, roles: string[]): Actor {
  if (!roles.includes(actor.role)) {
    throw new ApiError('FORBIDDEN', `Role ${actor.role} tidak diizinkan untuk aksi ini`);
  }
  return actor;
}

/** Boolean DB -> teks 'Aktif'/'Nonaktif' seperti bentuk lama sheet. */
export function aktifText(v: unknown): string {
  return v ? 'Aktif' : 'Nonaktif';
}
