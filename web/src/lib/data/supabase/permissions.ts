import { db } from './client';
import { ApiError } from '@/lib/errors';
import { hasFullAccess } from '@/lib/roles';
import { requireActor, type Actor } from './helpers';

/** Menu yang bisa digating lewat Role & Akses - HANYA menu yang memang
 *  dimiliki SPV Drop Point/Admin DP di sidebar (lihat lib/nav.ts).
 *  Monitoring Delivery & Profil SENGAJA tak masuk - selalu accessible. */
export const MENU_KEYS = ['dashboard', 'feedback_longtail_view', 'feedback_longtail_edit', 'riwayat_feedback'] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

export function isMenuKey(v: string): v is MenuKey {
  return (MENU_KEYS as readonly string[]).includes(v);
}

/** 2 role yang "diatur" lewat matrix Role & Akses. Role lain (full access)
 *  TIDAK PERNAH masuk matrix ini - akses mereka given/hardcoded dari
 *  Langkah 3, tak dicek lewat hasPermission() sama sekali. */
export const GATED_ROLES = ['SPV Drop Point', 'Admin DP'] as const;
export type GatedRole = (typeof GATED_ROLES)[number];

export function isGatedRole(v: string): v is GatedRole {
  return (GATED_ROLES as readonly string[]).includes(v);
}

/** Ambil SEMUA baris efektif (override + default) sekaligus utk 1 actor
 *  GATED (SPV Drop Point/Admin DP) - dipakai bersama oleh hasPermission()
 *  (1 menu_key) & getEffectiveMenuAccess() (semua menu_key, mis. utk render
 *  Sidebar) SUPAYA KEDUANYA SELALU SEPAKAT (satu sumber resolusi, bukan 2
 *  logic terpisah yang bisa drift - itulah akar bug menu sidebar tampil
 *  padahal backend sudah FORBIDDEN). Prioritas: user_permissions (override
 *  per akun) menang kalau ada barisnya (termasuk kalau nilainya false),
 *  fallback ke role_permissions (default per role) - baris yg somehow
 *  hilang dianggap true (jaring pengaman, seed selalu lengkap). */
async function fetchGatedPermissionMap(actor: Actor): Promise<Record<MenuKey, boolean>> {
  const [overrideRes, defaultRes] = await Promise.all([
    db().from('user_permissions').select('menu_key, enabled').eq('user_id', actor.id),
    db().from('role_permissions').select('menu_key, enabled').eq('role', actor.role),
  ]);
  if (overrideRes.error) throw new ApiError('INTERNAL_ERROR', overrideRes.error.message);
  if (defaultRes.error) throw new ApiError('INTERNAL_ERROR', defaultRes.error.message);

  const overrides = new Map<string, boolean>();
  (overrideRes.data ?? []).forEach((r) => {
    const row = r as { menu_key: string; enabled: boolean };
    overrides.set(String(row.menu_key), Boolean(row.enabled));
  });
  const defaults = new Map<string, boolean>();
  (defaultRes.data ?? []).forEach((r) => {
    const row = r as { menu_key: string; enabled: boolean };
    defaults.set(String(row.menu_key), Boolean(row.enabled));
  });

  const out = {} as Record<MenuKey, boolean>;
  for (const key of MENU_KEYS) out[key] = overrides.has(key) ? overrides.get(key)! : (defaults.get(key) ?? true);
  return out;
}

/**
 * Resolusi akses menu utk 1 actor: Super Admin & full access (Admin Cabang/
 * Manager Kota/Asisten Manager Kota) SELALU true, tidak pernah dicek ke DB
 * (given dari Langkah 3, di luar cakupan matrix ini). Utk SPV Drop
 * Point/Admin DP: lihat fetchGatedPermissionMap(). Role di luar 6 yang
 * dikenal (seharusnya tak pernah terjadi, users.role sudah di-CHECK
 * constraint) dianggap tak punya akses.
 */
export async function hasPermission(actor: Actor, menuKey: MenuKey): Promise<boolean> {
  if (actor.role === 'Super Admin') return true;
  if (hasFullAccess(actor.role)) return true;
  if (!isGatedRole(actor.role)) return false;
  const map = await fetchGatedPermissionMap(actor);
  return map[menuKey];
}

/** Defense-in-depth di endpoint: FORBIDDEN eksplisit kalau menu dimatikan
 *  utk actor ini (lewat override akun atau default role-nya). */
export async function requirePermission(actor: Actor, menuKey: MenuKey): Promise<void> {
  if (!(await hasPermission(actor, menuKey))) {
    throw new ApiError('FORBIDDEN', `Menu "${menuKey}" tidak diaktifkan untuk akun ini`);
  }
}

/** Semua menu_key sekaligus (bukan cuma 1) - dipakai Sidebar (lib/nav.ts)
 *  utk SEMBUNYIKAN TOTAL menu yang enabled=false, bukan cuma memblokir
 *  isinya setelah diklik. Pakai resolusi SAMA PERSIS dgn hasPermission()
 *  (fetchGatedPermissionMap) - full access selalu semua true TANPA query DB. */
export async function getEffectiveMenuAccess(actor: Actor): Promise<Record<MenuKey, boolean>> {
  if (actor.role === 'Super Admin' || hasFullAccess(actor.role)) {
    return Object.fromEntries(MENU_KEYS.map((k) => [k, true])) as Record<MenuKey, boolean>;
  }
  if (!isGatedRole(actor.role)) {
    return Object.fromEntries(MENU_KEYS.map((k) => [k, false])) as Record<MenuKey, boolean>;
  }
  return fetchGatedPermissionMap(actor);
}

/** Sama seperti getEffectiveMenuAccess(), tapi mulai dari email (dipakai
 *  langsung dari Server Component - lib/data/permissions.ts). */
export async function getMyMenuAccess(actorEmail: string): Promise<Record<MenuKey, boolean>> {
  const actor = await requireActor(actorEmail);
  return getEffectiveMenuAccess(actor);
}
