import { db } from './client';
import { assertUserExists, requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import { FULL_ACCESS_ROLES } from '@/lib/roles';
import type { CabangRow, CreateCabangInput, UpdateCabangInput } from '@/lib/data/types';

type DbRow = {
  kode_kota: string;
  nama_kota: string;
  manager_kota_user_id: string | null;
  asisten_manager_user_id: string | null;
};

const CABANG_COLUMNS = 'kode_kota, nama_kota, manager_kota_user_id, asisten_manager_user_id';

/** nama_tampilan (individual = nama, general = "DP <KODE_DP>") per users.id -
 *  dipakai buat label Manager Kota/Asisten Manager di tabel, tanpa query N+1. */
async function namaByUserIds(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (unique.length === 0) return new Map();
  const { data, error } = await db().from('users').select('id, nama_tampilan, nama').in('id', unique);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return new Map((data ?? []).map((u) => [String(u.id), String(u.nama_tampilan || u.nama || '')]));
}

function toRow(r: DbRow, namaById: Map<string, string>): CabangRow {
  return {
    'Kode Kota': String(r.kode_kota ?? ''),
    'Nama Kota': String(r.nama_kota ?? ''),
    'Manager Kota': String(r.manager_kota_user_id ?? ''),
    'Manager Kota Nama': r.manager_kota_user_id ? (namaById.get(r.manager_kota_user_id) ?? '') : '',
    'Asisten Manager': String(r.asisten_manager_user_id ?? ''),
    'Asisten Manager Nama': r.asisten_manager_user_id ? (namaById.get(r.asisten_manager_user_id) ?? '') : '',
  };
}

export async function listCabang(actorEmail: string): Promise<CabangRow[]> {
  await requireActor(actorEmail); // siapa pun yang login boleh baca (dropdown), konsisten dgn listDropPoints
  const { data, error } = await db().from('cabang').select(CABANG_COLUMNS).order('kode_kota');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const rows = (data ?? []) as DbRow[];
  const namaById = await namaByUserIds(rows.flatMap((r) => [r.manager_kota_user_id, r.asisten_manager_user_id]));
  return rows.map((r) => toRow(r, namaById));
}

export async function createCabang(actorEmail: string, data: CreateCabangInput): Promise<{ kodeKota: string }> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const kodeKota = String(data?.kodeKota ?? '').trim();
  const namaKota = String(data?.namaKota ?? '').trim();
  if (!kodeKota || !namaKota) throw new ApiError('VALIDATION_ERROR', 'Kode Kota dan Nama Kota wajib diisi');

  const managerKotaUserId = data.managerKotaUserId || null;
  const asistenManagerUserId = data.asistenManagerUserId || null;
  if (managerKotaUserId) await assertUserExists(managerKotaUserId);
  if (asistenManagerUserId) await assertUserExists(asistenManagerUserId);

  const { data: exists } = await db().from('cabang').select('kode_kota').eq('kode_kota', kodeKota).maybeSingle();
  if (exists) throw new ApiError('CONFLICT', 'Kode Kota sudah ada');

  const { error } = await db().from('cabang').insert({
    kode_kota: kodeKota,
    nama_kota: namaKota,
    manager_kota_user_id: managerKotaUserId,
    asisten_manager_user_id: asistenManagerUserId,
  });
  if (error) {
    if (error.code === '23505') throw new ApiError('CONFLICT', 'Kode Kota sudah ada');
    throw new ApiError('INTERNAL_ERROR', error.message);
  }
  return { kodeKota };
}

export async function updateCabang(
  actorEmail: string,
  kodeKota: string,
  data: UpdateCabangInput,
): Promise<CabangRow> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const patch: Record<string, unknown> = {};
  if (data.namaKota !== undefined) {
    const namaKota = String(data.namaKota).trim();
    if (!namaKota) throw new ApiError('VALIDATION_ERROR', 'Nama Kota wajib diisi');
    patch.nama_kota = namaKota;
  }
  if (data.managerKotaUserId !== undefined) {
    if (data.managerKotaUserId) await assertUserExists(data.managerKotaUserId);
    patch.manager_kota_user_id = data.managerKotaUserId || null;
  }
  if (data.asistenManagerUserId !== undefined) {
    if (data.asistenManagerUserId) await assertUserExists(data.asistenManagerUserId);
    patch.asisten_manager_user_id = data.asistenManagerUserId || null;
  }

  const { data: updated, error } = await db()
    .from('cabang')
    .update(patch)
    .eq('kode_kota', kodeKota)
    .select(CABANG_COLUMNS)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!updated) throw new ApiError('NOT_FOUND', `Kode Kota "${kodeKota}" tidak ditemukan`);
  const row = updated as DbRow;
  const namaById = await namaByUserIds([row.manager_kota_user_id, row.asisten_manager_user_id]);
  return toRow(row, namaById);
}
