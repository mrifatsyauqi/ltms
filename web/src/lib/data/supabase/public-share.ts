import { randomBytes } from 'node:crypto';
import { db } from './client';
import { requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';

export type PublicShareLink = {
  token: string;
  dibuatOleh: string;
  createdAt: string;
};

export type ShareLinkStats = PublicShareLink & {
  totalDashboard: number;
  totalDataLongtail: number;
  akses7HariTerakhir: number;
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
      // Eksplisit (bukan andalkan default now() Postgres) - isRateLimited
      // butuh nilai ini SEGERA (query .gte() berikutnya bisa terjadi dlm
      // request yg sama/berdekatan), jangan bergantung ke round-trip DB.
      accessed_at: new Date().toISOString(),
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

/** Default endpoint agregat (Dashboard). */
export const RATE_LIMIT_DASHBOARD_MAX = 30;
/** Lebih ketat drpd Dashboard - data per-baris (Data Long Tail) jauh lebih besar volumenya per request. */
export const RATE_LIMIT_LONGTAIL_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * Rate limit PER TOKEN, dihitung dari `public_share_access_log` yg SUDAH ADA
 * (khusus baris `halaman` yg cocok - dashboard & data-longtail dihitung
 * TERPISAH, masing2 endpoint punya limit sendiri, bukan budget gabungan)
 * - bukan penyimpanan baru (Redis/KV dll, proyek ini tak punya dependency
 * itu, dan in-memory per-proses TIDAK bisa diandalkan di Vercel serverless
 * krn tiap invocation bisa lompat ke instance berbeda; hitung dari DB
 * memberi jendela geser yg benar lintas instance). Hanya akses yg BERHASIL
 * dicatat (invalid-token/rate-limited sebelumnya tak pernah masuk log -
 * lihat findActiveShareLink/logPublicAccess), jadi window otomatis
 * "mengoreksi diri" tiap request baru.
 */
export async function isRateLimited(
  token: string,
  halaman: 'dashboard' | 'data-longtail',
  maxRequests: number,
): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await db()
    .from('public_share_access_log')
    .select('*', { count: 'exact', head: true })
    .eq('token', token)
    .eq('halaman', halaman)
    .gte('accessed_at', since);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (count ?? 0) >= maxRequests;
}

// ============================================================================
// UI Admin Cabang: generate/kelola link (Pengaturan). Hanya Admin Cabang
// (requireRole) - PRD Bagian 5, Admin DP tak punya akses fitur ini sama
// sekali.
// ============================================================================

/** Token 32 hex char via crypto random (bukan UUID sekuensial/tebakable) - cocok dgn CHECK constraint di skema. */
function generateToken(): string {
  return randomBytes(16).toString('hex');
}

async function countAccess(token: string, halaman?: 'dashboard' | 'data-longtail', sinceIso?: string): Promise<number> {
  let q = db().from('public_share_access_log').select('*', { count: 'exact', head: true }).eq('token', token);
  if (halaman) q = q.eq('halaman', halaman);
  if (sinceIso) q = q.gte('accessed_at', sinceIso);
  const { count, error } = await q;
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return count ?? 0;
}

/** Statistik link aktif (UI Kelola Link Laporan) - null kalau belum pernah dibuat/sudah dicabut total. Admin Cabang saja. */
export async function getShareLinkStats(actorEmail: string): Promise<ShareLinkStats | null> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const link = await getActiveShareLink();
  if (!link) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [totalDashboard, totalDataLongtail, akses7HariTerakhir] = await Promise.all([
    countAccess(link.token, 'dashboard'),
    countAccess(link.token, 'data-longtail'),
    countAccess(link.token, undefined, sevenDaysAgo),
  ]);

  return { ...link, totalDashboard, totalDataLongtail, akses7HariTerakhir };
}

/** "Buat Link Laporan" - hanya kalau BELUM ada link aktif (ditegakkan jg di DB via unique partial index). Admin Cabang saja. */
export async function createShareLink(actorEmail: string): Promise<{ token: string }> {
  const actor = requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const existing = await getActiveShareLink();
  if (existing) throw new ApiError('CONFLICT', 'Sudah ada link aktif - gunakan Regenerate untuk mengganti, atau Cabut Total dulu.');

  const token = generateToken();
  const { error } = await db().from('public_share_links').insert({ token, dibuat_oleh: actor.email, revoked: false });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { token };
}

/**
 * "Regenerate Link" - link lama bocor/tersebar ke pihak tak dimaksud: revoke
 * lama SEKETIKA, buat token baru sekaligus. URUTAN WAJIB revoke dulu baru
 * insert (bukan sebaliknya) - unique partial index (revoked=false) di skema
 * akan menolak insert baru selama yg lama masih revoked=false, jadi urutan
 * ini satu2nya yg bisa berhasil. @supabase/supabase-js (PostgREST) tak
 * mendukung transaction sungguhan lintas 2 panggilan .from() berbeda (sama
 * spt catatan di import.ts) - risiko: kalau insert token baru gagal SETELAH
 * revoke lama berhasil, link jadi kosong sementara (bukan 2 link aktif
 * sekaligus - kegagalan "aman", admin tinggal generate ulang, bukan state
 * korup/ambigu).
 */
export async function regenerateShareLink(actorEmail: string): Promise<{ token: string }> {
  const actor = requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const existing = await getActiveShareLink();
  if (existing) {
    const { error: revokeErr } = await db().from('public_share_links').update({ revoked: true }).eq('token', existing.token);
    if (revokeErr) throw new ApiError('INTERNAL_ERROR', revokeErr.message);
  }

  const token = generateToken();
  const { error } = await db().from('public_share_links').insert({ token, dibuat_oleh: actor.email, revoked: false });
  if (error) {
    throw new ApiError(
      'INTERNAL_ERROR',
      `Link lama sudah dicabut tapi gagal membuat token baru: ${error.message}. Tidak ada link aktif sekarang - coba Buat Link Laporan lagi.`,
    );
  }
  return { token };
}

/** "Cabut Total" - revoke tanpa generate baru, mematikan fitur sepenuhnya sampai dibuat ulang manual. Admin Cabang saja. */
export async function revokeShareLink(actorEmail: string): Promise<void> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const existing = await getActiveShareLink();
  if (!existing) return; // tak ada apa2 utk dicabut - idempotent, bukan error.
  const { error } = await db().from('public_share_links').update({ revoked: true }).eq('token', existing.token);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
}
