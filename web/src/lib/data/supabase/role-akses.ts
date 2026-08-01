import { db } from './client';
import { requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import { FULL_ACCESS_ROLES } from '@/lib/roles';
import { GATED_ROLES, isGatedRole, isMenuKey, type GatedRole, type MenuKey } from './permissions';
import type {
  RoleAksesAccount,
  RoleAksesAccountDetail,
  RoleAksesSummary,
  RolePermissionRow,
  UserPermissionRow,
} from '@/lib/data/types';

/** Semua fungsi di file ini HANYA boleh dipanggil actor full access (Admin
 *  Cabang/Manager Kota/Asisten Manager Kota/Super Admin) - merekalah yang
 *  "mengatur" akses SPV Drop Point/Admin DP, bukan sebaliknya (lihat prompt
 *  Role & Akses). Dipanggil di SETIAP fungsi export, bukan cuma di endpoint,
 *  supaya tetap aman dipanggil langsung (mis. dari test) tanpa lewat route. */
async function requireManagerActor(actorEmail: string) {
  return requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
}

function assertGatedRole(role: string): asserts role is GatedRole {
  if (!isGatedRole(role)) {
    throw new ApiError('VALIDATION_ERROR', `Role "${role}" tidak diatur lewat Role & Akses (hanya SPV Drop Point/Admin DP)`);
  }
}

function assertMenuKey(menuKey: string): asserts menuKey is MenuKey {
  if (!isMenuKey(menuKey)) {
    throw new ApiError('VALIDATION_ERROR', `menu_key "${menuKey}" tidak dikenal`);
  }
}

/** Jumlah akun per role "diatur" - dipakai grid kartu Jabatan (2 kartu). */
export async function listRoleAksesSummary(actorEmail: string): Promise<RoleAksesSummary[]> {
  await requireManagerActor(actorEmail);
  const out: RoleAksesSummary[] = [];
  for (const role of GATED_ROLES) {
    const { count, error } = await db().from('users').select('*', { count: 'exact', head: true }).eq('role', role);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    out.push({ role, count: count ?? 0 });
  }
  return out;
}

type UserDbRow = { id: string; nama: string; email: string; nik: string | null; role: string; drop_point: string | null };

/** Daftar akun 1 role "diatur", + konteks (SPV: jumlah DP disupervisi; Admin
 *  DP: kode DP-nya) + jumlah override user_permissions ("X izin custom"). */
export async function listAccountsByRole(actorEmail: string, role: string): Promise<RoleAksesAccount[]> {
  await requireManagerActor(actorEmail);
  assertGatedRole(role);

  const { data, error } = await db()
    .from('users')
    .select('id, nama, email, nik, role, drop_point')
    .eq('role', role)
    .order('nama');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const users = (data ?? []) as UserDbRow[];
  if (users.length === 0) return [];
  const ids = users.map((u) => String(u.id));

  const [supervisedRes, overridesRes] = await Promise.all([
    role === 'SPV Drop Point'
      ? db().from('master_drop_point').select('kode_dp, spv_drop_point_user_id').in('spv_drop_point_user_id', ids)
      : Promise.resolve({ data: [], error: null }),
    db().from('user_permissions').select('user_id').in('user_id', ids),
  ]);
  if (supervisedRes.error) throw new ApiError('INTERNAL_ERROR', supervisedRes.error.message);
  if (overridesRes.error) throw new ApiError('INTERNAL_ERROR', overridesRes.error.message);

  const supervisedCount = new Map<string, number>();
  (supervisedRes.data ?? []).forEach((r) => {
    const uid = String((r as { spv_drop_point_user_id: string }).spv_drop_point_user_id);
    supervisedCount.set(uid, (supervisedCount.get(uid) ?? 0) + 1);
  });
  const customCount = new Map<string, number>();
  (overridesRes.data ?? []).forEach((r) => {
    const uid = String((r as { user_id: string }).user_id);
    customCount.set(uid, (customCount.get(uid) ?? 0) + 1);
  });

  return users.map((u) => {
    const id = String(u.id);
    const konteks =
      role === 'SPV Drop Point'
        ? `Supervisi ${supervisedCount.get(id) ?? 0} Drop Point`
        : `Drop Point ${String(u.drop_point ?? '') || '(belum di-assign)'}`;
    return {
      id,
      nama: String(u.nama ?? ''),
      email: String(u.email ?? ''),
      nik: String(u.nik ?? ''),
      role,
      konteks,
      customCount: customCount.get(id) ?? 0,
    };
  });
}

/** Default matrix 1 role - PERSIS baris yang ada di role_permissions utk
 *  role itu (bukan map ke semua MENU_KEYS global - role_permissions cakupan
 *  BEDA per role: SPV Drop Point/Admin DP cuma 5, role lain nanti bisa
 *  sampai 15, lihat permissions.ts). Baris yang seharusnya ada tapi hilang
 *  (data corrupt, seharusnya tak pernah terjadi krn seed migrasi lengkap)
 *  berarti menu itu tak muncul di editor - lebih aman drpd disintesis true. */
export async function getRoleDefaultPermissions(actorEmail: string, role: string): Promise<RolePermissionRow[]> {
  await requireManagerActor(actorEmail);
  assertGatedRole(role);
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
  await requireManagerActor(actorEmail);
  assertGatedRole(role);
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
  await requireManagerActor(actorEmail);

  const { data: userData, error: userErr } = await db()
    .from('users')
    .select('id, nama, email, nik, role, drop_point')
    .eq('id', targetUserId)
    .maybeSingle();
  if (userErr) throw new ApiError('INTERNAL_ERROR', userErr.message);
  if (!userData) throw new ApiError('NOT_FOUND', 'Akun tidak ditemukan');
  const u = userData as UserDbRow;
  assertGatedRole(u.role);

  const [supervisedRes, overrideRes, defaultRows] = await Promise.all([
    u.role === 'SPV Drop Point'
      ? db().from('master_drop_point').select('kode_dp').eq('spv_drop_point_user_id', targetUserId)
      : Promise.resolve({ data: [], error: null }),
    db().from('user_permissions').select('menu_key, enabled').eq('user_id', targetUserId),
    getRoleDefaultPermissions(actorEmail, u.role),
  ]);
  if (supervisedRes.error) throw new ApiError('INTERNAL_ERROR', supervisedRes.error.message);
  if (overrideRes.error) throw new ApiError('INTERNAL_ERROR', overrideRes.error.message);

  const overrides = new Map<string, boolean>();
  (overrideRes.data ?? []).forEach((r) =>
    overrides.set(String((r as { menu_key: string }).menu_key), Boolean((r as { enabled: boolean }).enabled)),
  );
  const permissions: UserPermissionRow[] = defaultRows.map((d) => {
    const isOverride = overrides.has(d.menuKey);
    return { menuKey: d.menuKey, enabled: isOverride ? overrides.get(d.menuKey)! : d.enabled, isOverride };
  });

  const konteks =
    u.role === 'SPV Drop Point'
      ? `Supervisi ${(supervisedRes.data ?? []).length} Drop Point`
      : `Drop Point ${String(u.drop_point ?? '') || '(belum di-assign)'}`;

  return {
    id: String(u.id),
    nama: String(u.nama ?? ''),
    email: String(u.email ?? ''),
    nik: String(u.nik ?? ''),
    role: u.role,
    konteks,
    customCount: overrides.size,
    permissions,
  };
}

async function assertTargetIsGated(targetUserId: string): Promise<GatedRole> {
  const { data, error } = await db().from('users').select('role').eq('id', targetUserId).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) throw new ApiError('NOT_FOUND', 'Akun tidak ditemukan');
  const role = String((data as { role: string }).role);
  assertGatedRole(role);
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
  await requireManagerActor(actorEmail);
  await assertTargetIsGated(targetUserId);
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
  await requireManagerActor(actorEmail);
  await assertTargetIsGated(targetUserId);
  assertMenuKey(menuKey);
  const { error } = await db().from('user_permissions').delete().eq('user_id', targetUserId).eq('menu_key', menuKey);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return getAccountPermissions(actorEmail, targetUserId);
}
