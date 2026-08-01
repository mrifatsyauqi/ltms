import { db } from './client';
import { requireActor, requireRole, type Actor } from './helpers';
import { ApiError } from '@/lib/errors';
import { FULL_ACCESS_ROLES } from '@/lib/roles';
import { isMenuKey, manageableRolesFor, requirePermission, type ManageableRole, type MenuKey } from './permissions';
import type {
  RoleAksesAccount,
  RoleAksesAccountDetail,
  RoleAksesSummary,
  RolePermissionRow,
  UserPermissionRow,
} from '@/lib/data/types';

/** Semua fungsi di file ini HANYA boleh dipanggil actor full access (Admin
 *  Cabang/Manager Kota/Asisten Manager Kota/Super Admin) - merekalah yang
 *  "mengatur" akses role lain, bukan sebaliknya (lihat prompt Role & Akses).
 *  Dipanggil di SETIAP fungsi export, bukan cuma di endpoint, supaya tetap
 *  aman dipanggil langsung (mis. dari test) tanpa lewat route. Otorisasi
 *  KASAR ini ("boleh panggil fungsi role-akses sama sekali") dipasangkan dgn
 *  assertManageableRole() (otorisasi HALUS - "boleh atur role SPESIFIK ini")
 *  di tiap fungsi yang menyentuh 1 role/akun.
 *
 *  DUA LAPIS, BUKAN PENGGANTI:
 *  1. requireRole(FULL_ACCESS_ROLES) - lapis KASAR yang sudah ada sejak awal,
 *     JANGAN DIHAPUS: inilah satu-satunya yang memblokir SPV Drop Point/Admin
 *     DP. Lapis granular di bawah TIDAK bisa menggantikannya krn baris
 *     role_akses memang tak pernah ada utk kedua role itu & fallback
 *     fetchGatedPermissionMap() adalah `?? true` (lihat permissions.ts) -
 *     kalau requireRole dicabut, mereka justru LOLOS.
 *  2. requirePermission(actor, 'role_akses') - lapis GRANULAR baru: Super
 *     Admin bisa mencabut kemampuan SATU akun Admin Cabang/Manager
 *     Kota/Asisten Manager Kota utk mengedit matrix, TANPA menurunkan status
 *     full access-nya yang lain. Super Admin sendiri tak pernah kena (bypass
 *     permanen di hasPermission()). Dgn seed produksi (semua baris
 *     role_akses enabled=true) lapis ini NOL perubahan perilaku - baru
 *     terasa setelah Super Admin sengaja mematikannya utk akun/role tertentu.
 *
 *  Tidak ada jalur self-lockout baru: assertManageableRole() sudah melarang
 *  Admin Cabang/Manager Kota/Asisten Manager Kota menyentuh kartu role mereka
 *  SENDIRI, jadi cuma Super Admin yang bisa mematikan role_akses utk mereka. */
async function requireManagerActor(actorEmail: string): Promise<Actor> {
  const actor = requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  await requirePermission(actor, 'role_akses');
  return actor;
}

/** Super Admin: boleh atur SEMUA 5 role (termasuk Admin Cabang/Manager
 *  Kota/Asisten Manager Kota - privilese eksklusif). Admin Cabang/Manager
 *  Kota/Asisten Manager Kota: HANYA SPV Drop Point/Admin DP, TIDAK BISA
 *  atur kartu role mereka sendiri - lihat manageableRolesFor(). */
function assertManageableRole(actorRole: string, targetRole: string): asserts targetRole is ManageableRole {
  if (!(manageableRolesFor(actorRole) as readonly string[]).includes(targetRole)) {
    throw new ApiError('VALIDATION_ERROR', `Role "${targetRole}" tidak diatur lewat Role & Akses (atau di luar cakupan Anda)`);
  }
}

function assertMenuKey(menuKey: string): asserts menuKey is MenuKey {
  if (!isMenuKey(menuKey)) {
    throw new ApiError('VALIDATION_ERROR', `menu_key "${menuKey}" tidak dikenal`);
  }
}

/** Jumlah akun per role yang BOLEH diatur actor ini - grid kartu Jabatan:
 *  Super Admin -> 5 kartu, Admin Cabang/Manager Kota/Asisten Manager Kota
 *  -> 2 kartu (tidak berubah). */
export async function listRoleAksesSummary(actorEmail: string): Promise<RoleAksesSummary[]> {
  const actor = await requireManagerActor(actorEmail);
  const roles = manageableRolesFor(actor.role);
  const out: RoleAksesSummary[] = [];
  for (const role of roles) {
    const { count, error } = await db().from('users').select('*', { count: 'exact', head: true }).eq('role', role);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    out.push({ role, count: count ?? 0 });
  }
  return out;
}

type UserDbRow = { id: string; nama: string; email: string; nik: string | null; role: string; drop_point: string | null };

/** Konteks 1 akun (single-account query - dipakai getAccountPermissions,
 *  BUKAN listAccountsByRole yang query batch demi hindari N+1). */
async function kontekForAccount(role: string, userId: string, dropPoint: string | null): Promise<string> {
  if (role === 'SPV Drop Point') {
    const { data, error } = await db().from('master_drop_point').select('kode_dp').eq('spv_drop_point_user_id', userId);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    return `Supervisi ${(data ?? []).length} Drop Point`;
  }
  if (role === 'Admin DP') {
    return `Drop Point ${String(dropPoint ?? '') || '(belum di-assign)'}`;
  }
  if (role === 'Manager Kota' || role === 'Asisten Manager Kota') {
    const col = role === 'Manager Kota' ? 'manager_kota_user_id' : 'asisten_manager_user_id';
    const { data, error } = await db().from('cabang').select('nama_kota').eq(col, userId);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    const kota = (data ?? []).map((r) => String((r as { nama_kota: string }).nama_kota));
    return kota.length > 0 ? `Kota ${kota.join(', ')}` : '(belum ditugaskan ke Kota)';
  }
  return 'Akses penuh (Cabang)'; // Admin Cabang - tak terikat 1 Kota tertentu.
}

/** Daftar akun 1 role, + konteks (SPV: jumlah DP disupervisi; Admin DP:
 *  kode DP-nya; Manager Kota/Asisten Manager Kota: nama Kota yang
 *  ditugaskan lewat tabel cabang; Admin Cabang: label statis - akses
 *  seluruh sistem, tak terikat 1 Kota) + jumlah override user_permissions
 *  ("X izin custom"). */
export async function listAccountsByRole(actorEmail: string, role: string): Promise<RoleAksesAccount[]> {
  const actor = await requireManagerActor(actorEmail);
  assertManageableRole(actor.role, role);

  const { data, error } = await db()
    .from('users')
    .select('id, nama, email, nik, role, drop_point')
    .eq('role', role)
    .order('nama');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const users = (data ?? []) as UserDbRow[];
  if (users.length === 0) return [];
  const ids = users.map((u) => String(u.id));

  const needsSupervised = role === 'SPV Drop Point';
  const needsCabang = role === 'Manager Kota' || role === 'Asisten Manager Kota';

  const [supervisedRes, cabangRes, overridesRes] = await Promise.all([
    needsSupervised
      ? db().from('master_drop_point').select('kode_dp, spv_drop_point_user_id').in('spv_drop_point_user_id', ids)
      : Promise.resolve({ data: [], error: null }),
    needsCabang
      ? db().from('cabang').select('nama_kota, manager_kota_user_id, asisten_manager_user_id')
      : Promise.resolve({ data: [], error: null }),
    db().from('user_permissions').select('user_id').in('user_id', ids),
  ]);
  if (supervisedRes.error) throw new ApiError('INTERNAL_ERROR', supervisedRes.error.message);
  if (cabangRes.error) throw new ApiError('INTERNAL_ERROR', cabangRes.error.message);
  if (overridesRes.error) throw new ApiError('INTERNAL_ERROR', overridesRes.error.message);

  const supervisedCount = new Map<string, number>();
  (supervisedRes.data ?? []).forEach((r) => {
    const uid = String((r as { spv_drop_point_user_id: string }).spv_drop_point_user_id);
    supervisedCount.set(uid, (supervisedCount.get(uid) ?? 0) + 1);
  });
  const kotaByManager = new Map<string, string[]>();
  const kotaByAsisten = new Map<string, string[]>();
  (cabangRes.data ?? []).forEach((r) => {
    const row = r as { nama_kota: string; manager_kota_user_id: string | null; asisten_manager_user_id: string | null };
    if (row.manager_kota_user_id) {
      const list = kotaByManager.get(row.manager_kota_user_id) ?? [];
      list.push(row.nama_kota);
      kotaByManager.set(row.manager_kota_user_id, list);
    }
    if (row.asisten_manager_user_id) {
      const list = kotaByAsisten.get(row.asisten_manager_user_id) ?? [];
      list.push(row.nama_kota);
      kotaByAsisten.set(row.asisten_manager_user_id, list);
    }
  });
  const customCount = new Map<string, number>();
  (overridesRes.data ?? []).forEach((r) => {
    const uid = String((r as { user_id: string }).user_id);
    customCount.set(uid, (customCount.get(uid) ?? 0) + 1);
  });

  return users.map((u) => {
    const id = String(u.id);
    let konteks: string;
    if (role === 'SPV Drop Point') {
      konteks = `Supervisi ${supervisedCount.get(id) ?? 0} Drop Point`;
    } else if (role === 'Admin DP') {
      konteks = `Drop Point ${String(u.drop_point ?? '') || '(belum di-assign)'}`;
    } else if (role === 'Manager Kota') {
      const kota = kotaByManager.get(id);
      konteks = kota && kota.length > 0 ? `Kota ${kota.join(', ')}` : '(belum ditugaskan ke Kota)';
    } else if (role === 'Asisten Manager Kota') {
      const kota = kotaByAsisten.get(id);
      konteks = kota && kota.length > 0 ? `Kota ${kota.join(', ')}` : '(belum ditugaskan ke Kota)';
    } else {
      konteks = 'Akses penuh (Cabang)';
    }
    return {
      id,
      nama: String(u.nama ?? ''),
      email: String(u.email ?? ''),
      nik: String(u.nik ?? ''),
      role: role as ManageableRole,
      konteks,
      customCount: customCount.get(id) ?? 0,
    };
  });
}

/** Default matrix 1 role - PERSIS baris yang ada di role_permissions utk
 *  role itu (bukan map ke semua MENU_KEYS global - role_permissions cakupan
 *  BEDA per role: SPV Drop Point/Admin DP cuma 5, Admin Cabang/Manager
 *  Kota/Asisten Manager Kota sampai 15, lihat permissions.ts). Baris yang
 *  seharusnya ada tapi hilang (data corrupt, seharusnya tak pernah terjadi
 *  krn seed migrasi lengkap) berarti menu itu tak muncul di editor - lebih
 *  aman drpd disintesis true. */
export async function getRoleDefaultPermissions(actorEmail: string, role: string): Promise<RolePermissionRow[]> {
  const actor = await requireManagerActor(actorEmail);
  assertManageableRole(actor.role, role);
  const { data, error } = await db().from('role_permissions').select('menu_key, enabled').eq('role', role).order('menu_key');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => {
    const row = r as { menu_key: string; enabled: boolean };
    return { menuKey: row.menu_key as MenuKey, enabled: Boolean(row.enabled) };
  });
}

/** Ubah default 1 menu_key utk 1 role (berlaku ke SEMUA akun role itu yang
 *  TIDAK punya override sendiri) - mode "Per Role". */
export async function setRoleDefaultPermission(
  actorEmail: string,
  role: string,
  menuKey: string,
  enabled: boolean,
): Promise<RolePermissionRow[]> {
  const actor = await requireManagerActor(actorEmail);
  assertManageableRole(actor.role, role);
  assertMenuKey(menuKey);
  const { error } = await db()
    .from('role_permissions')
    .upsert({ role, menu_key: menuKey, enabled }, { onConflict: 'role,menu_key' });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return getRoleDefaultPermissions(actorEmail, role);
}

/** Detail 1 akun: info dasar + baris permission EFEKTIF (override kalau ada,
 *  else default role-nya) + flag isOverride per baris - cakupan menu_key
 *  ikut role akun ini (lihat getRoleDefaultPermissions) - dipakai Editor
 *  Izin mode "Per Akun" (toggle + badge "Custom" + "Reset ke Default"). */
export async function getAccountPermissions(actorEmail: string, targetUserId: string): Promise<RoleAksesAccountDetail> {
  const actor = await requireManagerActor(actorEmail);

  const { data: userData, error: userErr } = await db()
    .from('users')
    .select('id, nama, email, nik, role, drop_point')
    .eq('id', targetUserId)
    .maybeSingle();
  if (userErr) throw new ApiError('INTERNAL_ERROR', userErr.message);
  if (!userData) throw new ApiError('NOT_FOUND', 'Akun tidak ditemukan');
  const u = userData as UserDbRow;
  assertManageableRole(actor.role, u.role);

  const [konteks, overrideRes, defaultRows] = await Promise.all([
    kontekForAccount(u.role, targetUserId, u.drop_point),
    db().from('user_permissions').select('menu_key, enabled').eq('user_id', targetUserId),
    getRoleDefaultPermissions(actorEmail, u.role),
  ]);
  if (overrideRes.error) throw new ApiError('INTERNAL_ERROR', overrideRes.error.message);

  const overrides = new Map<string, boolean>();
  (overrideRes.data ?? []).forEach((r) =>
    overrides.set(String((r as { menu_key: string }).menu_key), Boolean((r as { enabled: boolean }).enabled)),
  );
  const permissions: UserPermissionRow[] = defaultRows.map((d) => {
    const isOverride = overrides.has(d.menuKey);
    return { menuKey: d.menuKey, enabled: isOverride ? overrides.get(d.menuKey)! : d.enabled, isOverride };
  });

  return {
    id: String(u.id),
    nama: String(u.nama ?? ''),
    email: String(u.email ?? ''),
    nik: String(u.nik ?? ''),
    role: u.role as ManageableRole,
    konteks,
    customCount: overrides.size,
    permissions,
  };
}

async function assertTargetIsManageable(actorRole: string, targetUserId: string): Promise<ManageableRole> {
  const { data, error } = await db().from('users').select('role').eq('id', targetUserId).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) throw new ApiError('NOT_FOUND', 'Akun tidak ditemukan');
  const role = String((data as { role: string }).role);
  assertManageableRole(actorRole, role);
  return role;
}

/** Set/timpa override 1 menu_key KHUSUS akun ini (tidak menyentuh default
 *  role atau akun lain sama sekali). */
export async function setUserPermissionOverride(
  actorEmail: string,
  targetUserId: string,
  menuKey: string,
  enabled: boolean,
): Promise<RoleAksesAccountDetail> {
  const actor = await requireManagerActor(actorEmail);
  await assertTargetIsManageable(actor.role, targetUserId);
  assertMenuKey(menuKey);
  const { error } = await db()
    .from('user_permissions')
    .upsert({ user_id: targetUserId, menu_key: menuKey, enabled }, { onConflict: 'user_id,menu_key' });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return getAccountPermissions(actorEmail, targetUserId);
}

/** Hapus override 1 menu_key ("Reset ke Default") - akun kembali ikut
 *  default role-nya utk menu itu saja, menu lain yg sudah di-override tetap. */
export async function resetUserPermissionOverride(
  actorEmail: string,
  targetUserId: string,
  menuKey: string,
): Promise<RoleAksesAccountDetail> {
  const actor = await requireManagerActor(actorEmail);
  await assertTargetIsManageable(actor.role, targetUserId);
  assertMenuKey(menuKey);
  const { error } = await db().from('user_permissions').delete().eq('user_id', targetUserId).eq('menu_key', menuKey);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return getAccountPermissions(actorEmail, targetUserId);
}
