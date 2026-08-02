import { db } from './client';

// Rate limiting login (anti brute-force, kompensasi hilangnya 2FA Google).
// Kunci = identifier yg diketik user saat login (NIK atau email), trim+lower
// -> baris login_attempts (kolom `nik` menyimpan identifier itu, bukan hanya
// NIK murni; nama kolom dipertahankan sesuai skema Tahap 1 migrasi auth).
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 15;

function normalizeKey(identifier: string): string {
  return String(identifier ?? '').trim().toLowerCase();
}

/** true kalau identifier sedang terkunci (locked_until di masa depan). */
export async function isLoginLocked(identifier: string): Promise<boolean> {
  const key = normalizeKey(identifier);
  if (!key) return false;
  const { data, error } = await db()
    .from('login_attempts')
    .select('locked_until')
    .eq('nik', key)
    .maybeSingle();
  if (error) throw new Error(`Supabase isLoginLocked: ${error.message}`);
  if (!data?.locked_until) return false;
  return new Date(data.locked_until).getTime() > Date.now();
}

/**
 * Catat 1 percobaan gagal. Window bergulir: kegagalan di luar
 * WINDOW_MENIT sejak kegagalan terakhir dianggap seri baru (count reset ke
 * 1). Setelah mencapai MAX_FAILED_ATTEMPTS dalam window aktif, kunci
 * LOCK_MINUTES ke depan.
 */
export async function recordLoginFailure(identifier: string): Promise<void> {
  const key = normalizeKey(identifier);
  if (!key) return;
  const { data, error } = await db()
    .from('login_attempts')
    .select('failed_count, updated_at')
    .eq('nik', key)
    .maybeSingle();
  if (error) throw new Error(`Supabase recordLoginFailure (read): ${error.message}`);

  const now = new Date();
  const withinWindow =
    data?.updated_at && now.getTime() - new Date(data.updated_at).getTime() < WINDOW_MINUTES * 60 * 1000;
  const newCount = withinWindow ? (data?.failed_count ?? 0) + 1 : 1;
  const lockedUntil =
    newCount >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString() : null;

  const { error: upsertError } = await db()
    .from('login_attempts')
    .upsert(
      { nik: key, failed_count: newCount, locked_until: lockedUntil, updated_at: now.toISOString() },
      { onConflict: 'nik' },
    );
  if (upsertError) throw new Error(`Supabase recordLoginFailure (write): ${upsertError.message}`);
}

/** Login berhasil -> reset counter identifier ini. */
export async function recordLoginSuccess(identifier: string): Promise<void> {
  const key = normalizeKey(identifier);
  if (!key) return;
  const { error } = await db().from('login_attempts').delete().eq('nik', key);
  if (error) throw new Error(`Supabase recordLoginSuccess: ${error.message}`);
}
