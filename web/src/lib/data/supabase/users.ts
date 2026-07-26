import { db } from './client';
import { aktifText, assertDropPointActive, requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import type { CreateUserInput, UpdateUserInput, UserRow } from '@/lib/apps-script/users';

type DbRow = {
  nama: string;
  email: string;
  role: string;
  drop_point: string | null;
  status_aktif: boolean;
};

/** Tanpa password_hash — sengaja tidak pernah dikirim ke client. */
function toRow(r: DbRow): UserRow {
  return {
    Nama: String(r.nama ?? ''),
    Email: String(r.email ?? ''),
    Role: String(r.role ?? ''),
    'Drop Point': String(r.drop_point ?? ''),
    'Status Aktif': aktifText(r.status_aktif),
  };
}

const norm = (e: string) => String(e ?? '').trim().toLowerCase();

export async function listUsers(actorEmail: string): Promise<UserRow[]> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const { data, error } = await db()
    .from('users')
    .select('nama, email, role, drop_point, status_aktif')
    .order('email');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => toRow(r as DbRow));
}

export async function createUser(actorEmail: string, data: CreateUserInput): Promise<{ email: string }> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const nama = String(data?.nama ?? '').trim();
  const email = norm(data?.email);
  const role = data?.role;
  if (!nama || !email || !role) throw new ApiError('VALIDATION_ERROR', 'nama, email, role wajib diisi');
  if (role !== 'Admin Cabang' && role !== 'Admin DP') {
    throw new ApiError('VALIDATION_ERROR', 'role harus "Admin Cabang" atau "Admin DP"');
  }
  if (role === 'Admin DP') {
    if (!data.dropPoint) throw new ApiError('VALIDATION_ERROR', 'Admin DP wajib dikaitkan ke minimal satu Drop Point');
    await assertDropPointActive(data.dropPoint);
  }

  const { error } = await db().from('users').insert({
    nama,
    email,
    role,
    drop_point: role === 'Admin DP' ? data.dropPoint : '',
    status_aktif: true,
  });
  if (error) {
    if (error.code === '23505') throw new ApiError('CONFLICT', 'Email sudah terdaftar');
    throw new ApiError('INTERNAL_ERROR', error.message);
  }
  return { email };
}

export async function updateUser(
  actorEmail: string,
  targetEmail: string,
  data: UpdateUserInput,
): Promise<UserRow> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  if (!targetEmail) throw new ApiError('VALIDATION_ERROR', 'targetEmail wajib diisi');
  if (data.role === 'Admin DP') {
    if (!data.dropPoint) throw new ApiError('VALIDATION_ERROR', 'Admin DP wajib dikaitkan ke minimal satu Drop Point');
    await assertDropPointActive(data.dropPoint);
  }
  const patch: Record<string, unknown> = {};
  if (data.nama !== undefined) patch.nama = data.nama;
  if (data.role !== undefined) patch.role = data.role;
  // Role Admin Cabang -> DP dikosongkan (cakupan semua DP).
  if (data.role === 'Admin Cabang') patch.drop_point = '';
  else if (data.dropPoint !== undefined) patch.drop_point = data.dropPoint;
  if (data.statusAktif !== undefined) patch.status_aktif = !!data.statusAktif;

  const { data: updated, error } = await db()
    .from('users')
    .update(patch)
    .eq('email', norm(targetEmail))
    .select('nama, email, role, drop_point, status_aktif')
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!updated) throw new ApiError('NOT_FOUND', `Email "${targetEmail}" tidak ditemukan`);
  return toRow(updated as DbRow);
}

export async function deleteUser(actorEmail: string, targetEmail: string): Promise<{ email: string }> {
  const actor = requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  if (!targetEmail) throw new ApiError('VALIDATION_ERROR', 'targetEmail wajib diisi');
  if (norm(targetEmail) === norm(actor.email)) {
    throw new ApiError('VALIDATION_ERROR', 'Tidak bisa menghapus akun sendiri');
  }
  const { error } = await db().from('users').delete().eq('email', norm(targetEmail));
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { email: targetEmail };
}

export async function setUserPassword(
  actorEmail: string,
  targetEmail: string,
  passwordHash: string,
): Promise<{ email: string }> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  if (!targetEmail || !passwordHash) {
    throw new ApiError('VALIDATION_ERROR', 'targetEmail dan passwordHash wajib diisi');
  }
  const { data, error } = await db()
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('email', norm(targetEmail))
    .select('email')
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) throw new ApiError('NOT_FOUND', `Email "${targetEmail}" tidak ditemukan`);
  return { email: targetEmail };
}
