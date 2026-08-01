import { db } from './client';
import { aktifText, assertDropPointActive, requireActor, requireRole, resolveJabatanIdByRole } from './helpers';
import { ApiError } from '@/lib/errors';
import type { CreateGeneralAccountResult, CreateUserInput, UpdateUserInput, UserRow } from '@/lib/data/types';

const SELECT_COLUMNS = 'id, nama, email, nik, nama_tampilan, tipe_akun, role, drop_point, status_aktif';

type DbRow = {
  id: string;
  nama: string;
  email: string;
  nik: string | null;
  nama_tampilan: string | null;
  tipe_akun: string | null;
  role: string;
  drop_point: string | null;
  status_aktif: boolean;
};

/** Tanpa password_hash — sengaja tidak pernah dikirim ke client. */
function toRow(r: DbRow): UserRow {
  return {
    Id: String(r.id ?? ''),
    Nama: String(r.nama ?? ''),
    Email: String(r.email ?? ''),
    NIK: String(r.nik ?? ''),
    'Tipe Akun': r.tipe_akun === 'general' ? 'general' : 'individual',
    Role: String(r.role ?? ''),
    'Drop Point': String(r.drop_point ?? ''),
    'Status Aktif': aktifText(r.status_aktif),
  };
}

const norm = (e: string) => String(e ?? '').trim().toLowerCase();

/** Pesan konflik unique-constraint yg dibedakan by nama constraint di error Postgres. */
function conflictMessage(message: string): string {
  if (message.includes('nik')) return 'NIK sudah dipakai user lain';
  return 'Email sudah terdaftar';
}

export async function listUsers(actorEmail: string): Promise<UserRow[]> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const { data, error } = await db().from('users').select(SELECT_COLUMNS).order('email');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => toRow(r as DbRow));
}

export async function createUser(actorEmail: string, data: CreateUserInput): Promise<{ email: string }> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const nama = String(data?.nama ?? '').trim();
  const email = norm(data?.email);
  const nik = String(data?.nik ?? '').trim();
  const role = data?.role;
  if (!nama || !email || !nik || !role) throw new ApiError('VALIDATION_ERROR', 'nama, email, NIK, role wajib diisi');
  if (role !== 'Admin Cabang' && role !== 'Admin DP') {
    throw new ApiError('VALIDATION_ERROR', 'role harus "Admin Cabang" atau "Admin DP"');
  }
  if (role === 'Admin DP') {
    if (!data.dropPoint) throw new ApiError('VALIDATION_ERROR', 'Admin DP wajib dikaitkan ke minimal satu Drop Point');
    await assertDropPointActive(data.dropPoint);
  }
  const jabatanId = await resolveJabatanIdByRole(role);

  // Cek konflik eksplisit dulu (email = PK, nik = unique) supaya pesan
  // spesifik ("Email sudah terdaftar" vs "NIK sudah dipakai user lain") -
  // fallback error.code 23505 di bawah tetap ada utk race condition.
  const { data: existingEmail } = await db().from('users').select('email').eq('email', email).maybeSingle();
  if (existingEmail) throw new ApiError('CONFLICT', 'Email sudah terdaftar');
  const { data: existingNik } = await db().from('users').select('email').eq('nik', nik).maybeSingle();
  if (existingNik) throw new ApiError('CONFLICT', 'NIK sudah dipakai user lain');

  const { error } = await db().from('users').insert({
    nama,
    nama_tampilan: nama,
    email,
    nik,
    tipe_akun: 'individual',
    role,
    jabatan_id: jabatanId,
    drop_point: role === 'Admin DP' ? data.dropPoint : '',
    status_aktif: true,
  });
  if (error) {
    if (error.code === '23505') throw new ApiError('CONFLICT', conflictMessage(error.message));
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
  let nikPatch: string | undefined;
  if (data.nik !== undefined) {
    nikPatch = String(data.nik).trim();
    if (!nikPatch) throw new ApiError('VALIDATION_ERROR', 'NIK wajib diisi');
    const { data: existingNik } = await db().from('users').select('email').eq('nik', nikPatch).maybeSingle();
    if (existingNik && norm(String(existingNik.email)) !== norm(targetEmail)) {
      throw new ApiError('CONFLICT', 'NIK sudah dipakai user lain');
    }
  }
  const patch: Record<string, unknown> = {};
  if (data.nama !== undefined) {
    patch.nama = data.nama;
    patch.nama_tampilan = data.nama; // akun individual: nama_tampilan ikut nama (akun general tak diedit lewat sini)
  }
  if (nikPatch !== undefined) patch.nik = nikPatch;
  if (data.role !== undefined) {
    patch.role = data.role;
    patch.jabatan_id = await resolveJabatanIdByRole(data.role); // ikut disinkronkan, lihat helpers.ts
  }
  // Role Admin Cabang -> DP dikosongkan (cakupan semua DP).
  if (data.role === 'Admin Cabang') patch.drop_point = '';
  else if (data.dropPoint !== undefined) patch.drop_point = data.dropPoint;
  if (data.statusAktif !== undefined) patch.status_aktif = !!data.statusAktif;

  const { data: updated, error } = await db()
    .from('users')
    .update(patch)
    .eq('email', norm(targetEmail))
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) {
    if (error.code === '23505') throw new ApiError('CONFLICT', conflictMessage(error.message));
    throw new ApiError('INTERNAL_ERROR', error.message);
  }
  if (!updated) throw new ApiError('NOT_FOUND', `Email "${targetEmail}" tidak ditemukan`);
  return toRow(updated as DbRow);
}

/**
 * Akun General satu per Drop Point (dipicu dari halaman Master Drop Point,
 * bukan dari dialog Tambah User biasa). NIK format "GENERAL-<KODE_DP>",
 * nama_tampilan "DP <KODE_DP>" (dicatat ke Activity_Log, BUKAN nama
 * personal — lihat attributionName di helpers.ts). Email placeholder
 * deterministik ("general-<kode_dp>@ltms.local") WAJIB diisi krn masih PK
 * users, tapi TAK PERNAH dipakai login (login akun ini lewat NIK).
 */
export async function createGeneralAccount(
  actorEmail: string,
  kodeDp: string,
  passwordHash: string,
): Promise<CreateGeneralAccountResult> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const kode = String(kodeDp ?? '').trim();
  if (!kode) throw new ApiError('VALIDATION_ERROR', 'Kode DP wajib diisi');
  if (!passwordHash) throw new ApiError('VALIDATION_ERROR', 'Password awal wajib diisi');
  await assertDropPointActive(kode);

  const nik = `GENERAL-${kode.toUpperCase()}`;
  const namaTampilan = `DP ${kode.toUpperCase()}`;
  const email = `general-${kode.toLowerCase()}@ltms.local`;

  const { data: existingNik } = await db().from('users').select('email').eq('nik', nik).maybeSingle();
  if (existingNik) throw new ApiError('CONFLICT', `Akun General untuk DP "${kode}" sudah ada.`);

  const jabatanId = await resolveJabatanIdByRole('Admin DP');
  const { error } = await db().from('users').insert({
    nama: namaTampilan,
    nama_tampilan: namaTampilan,
    email,
    nik,
    tipe_akun: 'general',
    role: 'Admin DP',
    jabatan_id: jabatanId,
    drop_point: kode,
    password_hash: passwordHash,
    status_aktif: true,
  });
  if (error) {
    if (error.code === '23505') throw new ApiError('CONFLICT', `Akun General untuk DP "${kode}" sudah ada.`);
    throw new ApiError('INTERNAL_ERROR', error.message);
  }
  return { email, nik, namaTampilan };
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
