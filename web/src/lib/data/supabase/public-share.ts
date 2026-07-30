import { db } from './client';
import { ApiError } from '@/lib/errors';

export type PublicShareLink = {
  token: string;
  dibuatOleh: string;
  createdAt: string;
};

type ShareLinkDbRow = {
  token: string;
  dibuat_oleh: string;
  revoked: boolean;
  created_at: string;
};

/**
 * Validasi token link berbagi: ada di DB & belum di-revoke. Dipanggil dari
 * layout/page (render) MAUPUN endpoint publik (independen, defense-in-depth)
 * - keduanya WAJIB menolak dgn pesan generik (tak boleh bedakan "tidak ada"
 * vs "revoked", lihat komentar pemanggil).
 */
export async function findActiveShareLink(token: string): Promise<{ token: string } | null> {
  const t = String(token ?? '').trim();
  if (!t) return null;
  const { data, error } = await db()
    .from('public_share_links')
    .select('token, revoked')
    .eq('token', t)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data || data.revoked) return null;
  return { token: String(data.token) };
}

/** Link yg SEDANG aktif (utk UI Kelola Link Laporan) - null bila belum pernah dibuat/sudah dicabut total tanpa regenerate. */
export async function getActiveShareLink(): Promise<PublicShareLink | null> {
  const { data, error } = await db()
    .from('public_share_links')
    .select('token, dibuat_oleh, created_at')
    .eq('revoked', false)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) return null;
  const r = data as ShareLinkDbRow;
  return { token: r.token, dibuatOleh: r.dibuat_oleh, createdAt: r.created_at };
}

/**
 * Catat 1 akses ke halaman publik. SENGAJA tidak melempar error ke pemanggil
 * kalau insert log gagal (mis. hiccup DB sesaat) - kegagalan mencatat 1 baris
 * audit tidak boleh membuat laporan yg dilihat manager ikut gagal tampil;
 * lebih penting kontennya tetap muncul drpd 1 baris log hilang.
 */
export async function logPublicAccess(
  token: string,
  halaman: 'dashboard' | 'data-longtail',
  meta: { ipAddress: string | null; userAgent: string | null },
): Promise<void> {
  try {
    await db().from('public_share_access_log').insert({
      token,
      halaman,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });
  } catch {
    // Diamkan sengaja - lihat komentar fungsi.
  }
}

/** Ekstrak IP klien dari header standar Vercel/proxy (bukan `request.ip`, tak tersedia di Next.js App Router). */
export function clientIpFromHeaders(headers: Headers): string | null {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip');
}
