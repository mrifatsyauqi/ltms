import { db } from './client';
import { ApiError } from '@/lib/errors';
import { requireActor, type Actor } from './helpers';

/**
 * Vocabulary lengkap menu_key (harus SAMA PERSIS dgn CHECK constraint
 * role_permissions/user_permissions.menu_key - lihat
 * supabase/role_akses_hierarchy_migration.sql). Relevansi per role BEDA:
 * SPV Drop Point/Admin DP cuma pakai 5 (dashboard, feedback_longtail_view,
 * feedback_longtail_edit, riwayat_feedback, monitoring_delivery_dp - mode
 * per-Sprinter); Admin Cabang/Manager Kota/Asisten Manager Kota pakai
 * cakupan lebih luas termasuk monitoring_delivery_cabang (mode Refine
 * Total per DP) - lihat pemetaan menuKey per item di lib/nav.ts. Profil
 * SENGAJA tak masuk vocabulary ini sama sekali - selalu accessible utk
 * semua role, tak pernah digating.
 */
export const MENU_KEYS = [
  'dashboard',
  'feedback_longtail_view',
  'feedback_longtail_edit',
  'data_longtail',
  'import_longtail',
  'monitoring_delivery_dp',
  'monitoring_delivery_cabang',
  'monitoring_inc',
  'laporan_harian',
  'master_cabang',
  'master_drop_point',
  'master_feedback',
  'user_management',
  'riwayat_import',
  'riwayat_feedback',
  'pengaturan',
  'role_akses',
] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

export function isMenuKey(v: string): v is MenuKey {
  return (MENU_KEYS as readonly string[]).includes(v);
}

/**
 * 5 role yang bisa "diatur" TOTAL lewat UI Role & Akses (union semua
 * manager - lihat manageableRolesFor() utk siapa boleh atur yang mana).
 * Super Admin TIDAK PERNAH masuk sini - satu-satunya yang tetap hardcode
 * bypass (lihat hasPermission()).
 */
export const ALL_MANAGEABLE_ROLES = ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota', 'SPV Drop Point', 'Admin DP'] as const;
export type ManageableRole = (typeof ALL_MANAGEABLE_ROLES)[number];

export function isManageableRole(v: string): v is ManageableRole {
  return (ALL_MANAGEABLE_ROLES as readonly string[]).includes(v);
}

/**
 * Role yang OTORISASI RUNTIME-nya (hasPermission/getEffectiveMenuAccess)
 * dicek ke matrix role_permissions/user_permissions - SEKARANG SAMA PERSIS
 * dgn ALL_MANAGEABLE_ROLES (5 role, bukan cuma SPV Drop Point/Admin DP lagi
 * spt sebelumnya) - alias langsung ke konstanta yg sama supaya TIDAK
 * PERNAH bisa drift antara "siapa dicek" & "siapa bisa diatur SUPER ADMIN".
 * Super Admin tetap satu-satunya di luar sini, hardcode bypass permanen.
 *
 * CATATAN PENTING: JANGAN dipakai utk "role apa yang boleh diatur Admin
 * Cabang/Manager Kota/Asisten Manager Kota" - itu scope BEDA & LEBIH
 * SEMPIT (cuma 2, lihat CABANG_MANAGEABLE_ROLES di manageableRolesFor) -
 * GATED_ROLES sekarang 5 justru krn scope OTORISASI RUNTIME melebar,
 * BUKAN berarti Admin Cabang dkk ikut boleh atur role sesama full access.
 */
export const GATED_ROLES = ALL_MANAGEABLE_ROLES;
export type GatedRole = ManageableRole;

export function isGatedRole(v: string): v is GatedRole {
  return (GATED_ROLES as readonly string[]).includes(v);
}

/** Role yang boleh diatur Admin Cabang/Manager Kota/Asisten Manager Kota -
 *  SENGAJA konstanta TERPISAH dari GATED_ROLES (jangan digabung lagi -
 *  GATED_ROLES sekarang 5 utk scope otorisasi runtime yg BEDA tujuan, lihat
 *  catatan di GATED_ROLES). Tidak pernah berubah sejak awal fitur ini. */
const CABANG_MANAGEABLE_ROLES = ['SPV Drop Point', 'Admin DP'] as const;

/**
 * Role yang boleh diatur actor ini via Role & Akses. Super Admin: SEMUA 5
 * (5 kartu jabatan di grid). Admin Cabang/Manager Kota/Asisten Manager
 * Kota: HANYA SPV Drop Point/Admin DP (2 kartu, tidak berubah) - TIDAK BISA
 * lihat/atur kartu role mereka sendiri (Admin Cabang/Manager Kota/Asisten
 * Manager Kota), itu privilese eksklusif Super Admin.
 */
export function manageableRolesFor(actorRole: string): readonly ManageableRole[] {
  return actorRole === 'Super Admin' ? ALL_MANAGEABLE_ROLES : CABANG_MANAGEABLE_ROLES;
}

/** Ambil SEMUA baris efektif (override + default) sekaligus utk 1 actor
 *  GATED (5 role - lihat GATED_ROLES) - dipakai bersama oleh hasPermission()
 *  (1 menu_key) & getEffectiveMenuAccess() (semua menu_key, mis. utk render
 *  Sidebar) SUPAYA KEDUANYA SELALU SEPAKAT (satu sumber resolusi, bukan 2
 *  logic terpisah yang bisa drift - itulah akar bug menu sidebar tampil
 *  padahal backend sudah FORBIDDEN). Prioritas: user_permissions (override
 *  per akun) menang kalau ada barisnya (termasuk kalau nilainya false),
 *  fallback ke role_permissions (default per role) - baris yg somehow
 *  hilang dianggap true (jaring pengaman, seed selalu lengkap - INI yang
 *  mencegah lockout massal kalau ada baris seed yang somehow belum lengkap
 *  utk Admin Cabang/Manager Kota/Asisten Manager Kota). */
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
 * Resolusi akses menu utk 1 actor: Super Admin SELALU true, TIDAK PERNAH
 * dicek ke DB - satu-satunya bypass yang tersisa (permanen, jangan pernah
 * dipindah jadi anggota biasa GATED_ROLES - lihat requireRole() di
 * helpers.ts utk pola sama). SEMUA role lain (Admin Cabang/Manager
 * Kota/Asisten Manager Kota/SPV Drop Point/Admin DP - lihat GATED_ROLES)
 * SEKARANG dicek matrix lewat fetchGatedPermissionMap() - TIDAK ADA LAGI
 * bypass grup full access seperti sebelumnya (Langkah "hapus bypass").
 * Role di luar 6 yang dikenal (seharusnya tak pernah terjadi, users.role
 * sudah di-CHECK constraint - TAPI ADA pengecualian sengaja: role legacy
 * 'Admin Pusat' di Monitoring Delivery, lihat carve-out eksplisit di
 * app/(app)/monitoring-delivery/page.tsx) dianggap tak punya akses.
 */
export async function hasPermission(actor: Actor, menuKey: MenuKey): Promise<boolean> {
  if (actor.role === 'Super Admin') return true;
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
 *  (fetchGatedPermissionMap) - Super Admin selalu semua true TANPA query DB
 *  (satu-satunya bypass yang tersisa). */
export async function getEffectiveMenuAccess(actor: Actor): Promise<Record<MenuKey, boolean>> {
  if (actor.role === 'Super Admin') {
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
