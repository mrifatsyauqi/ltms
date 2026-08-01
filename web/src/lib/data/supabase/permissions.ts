import { db } from './client';
import { ApiError } from '@/lib/errors';
import { hasFullAccess } from '@/lib/roles';
import type { Actor } from './helpers';

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

/**
 * Resolusi akses menu utk 1 actor: Super Admin & full access (Admin Cabang/
 * Manager Kota/Asisten Manager Kota) SELALU true, tidak pernah dicek ke DB
 * (given dari Langkah 3, di luar cakupan matrix ini). Utk SPV Drop
 * Point/Admin DP: cek user_permissions (override per akun) dulu - kalau ADA
 * barisnya, itu yang menang (termasuk kalau nilainya false); kalau TIDAK
 * ada baris override, fallback ke role_permissions (default per role).
 * Role di luar 6 yang dikenal (seharusnya tak pernah terjadi, users.role
 * sudah di-CHECK constraint) dianggap tak punya akses.
 */
export async function hasPermission(actor: Actor, menuKey: MenuKey): Promise<boolean> {
  if (actor.role === 'Super Admin') return true;
  if (hasFullAccess(actor.role)) return true;
  if (!(GATED_ROLES as readonly string[]).includes(actor.role)) return false;

  const { data: override, error: overrideErr } = await db()
    .from('user_permissions')
    .select('enabled')
    .eq('user_id', actor.id)
    .eq('menu_key', menuKey)
    .maybeSingle();
  if (overrideErr) throw new ApiError('INTERNAL_ERROR', overrideErr.message);
  if (override) return Boolean((override as { enabled: boolean }).enabled);

  const { data: roleDefault, error: roleErr } = await db()
    .from('role_permissions')
    .select('enabled')
    .eq('role', actor.role)
    .eq('menu_key', menuKey)
    .maybeSingle();
  if (roleErr) throw new ApiError('INTERNAL_ERROR', roleErr.message);
  // Baris role_permissions seharusnya SELALU ada (seed mencakup semua
  // kombinasi role x menu_key) - default true kalau ternyata tak ada sama
  // sekali cuma jaring pengaman, bukan jalur normal.
  return Boolean((roleDefault as { enabled: boolean } | null)?.enabled ?? true);
}

/** Defense-in-depth di endpoint: FORBIDDEN eksplisit kalau menu dimatikan
 *  utk actor ini (lewat override akun atau default role-nya). */
export async function requirePermission(actor: Actor, menuKey: MenuKey): Promise<void> {
  if (!(await hasPermission(actor, menuKey))) {
    throw new ApiError('FORBIDDEN', `Menu "${menuKey}" tidak diaktifkan untuk akun ini`);
  }
}
