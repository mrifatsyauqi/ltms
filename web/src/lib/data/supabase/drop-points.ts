import { db } from './client';
import { aktifText, requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import type {
  CreateDropPointInput,
  DropPointRow,
  UpdateDropPointInput,
} from '@/lib/data/types';

type DbRow = {
  kode_dp: string;
  nama_dp: string;
  wilayah: string | null;
  status_aktif: boolean;
};

/** Baris DB (snake_case, boolean) -> bentuk respons lama (dipakai frontend). */
function toRow(r: DbRow): DropPointRow {
  return {
    'Kode DP': String(r.kode_dp ?? ''),
    'Nama DP': String(r.nama_dp ?? ''),
    'Wilayah/Cabang': String(r.wilayah ?? ''),
    'Status Aktif': aktifText(r.status_aktif),
  };
}

export async function listDropPoints(actorEmail: string): Promise<DropPointRow[]> {
  await requireActor(actorEmail); // siapa pun yang login boleh baca (dropdown)
  const { data, error } = await db().from('master_drop_point').select('*').order('kode_dp');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => toRow(r as DbRow));
}

export async function createDropPoint(
  actorEmail: string,
  data: CreateDropPointInput,
): Promise<{ kodeDp: string }> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const kodeDp = String(data?.kodeDp ?? '').trim();
  const namaDp = String(data?.namaDp ?? '').trim();
  if (!kodeDp || !namaDp) throw new ApiError('VALIDATION_ERROR', 'Kode DP dan Nama DP wajib diisi');

  const { data: exists } = await db()
    .from('master_drop_point')
    .select('kode_dp')
    .eq('kode_dp', kodeDp)
    .maybeSingle();
  if (exists) throw new ApiError('CONFLICT', 'Kode DP sudah ada');

  const { error } = await db()
    .from('master_drop_point')
    .insert({ kode_dp: kodeDp, nama_dp: namaDp, wilayah: data.wilayah ?? '', status_aktif: true });
  if (error) {
    if (error.code === '23505') throw new ApiError('CONFLICT', 'Kode DP sudah ada');
    throw new ApiError('INTERNAL_ERROR', error.message);
  }
  return { kodeDp };
}

export async function updateDropPoint(
  actorEmail: string,
  kodeDp: string,
  data: UpdateDropPointInput,
): Promise<DropPointRow> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const patch: Record<string, unknown> = {};
  if (data.namaDp !== undefined) patch.nama_dp = data.namaDp;
  if (data.wilayah !== undefined) patch.wilayah = data.wilayah;
  if (data.statusAktif !== undefined) patch.status_aktif = !!data.statusAktif;

  const { data: updated, error } = await db()
    .from('master_drop_point')
    .update(patch)
    .eq('kode_dp', kodeDp)
    .select()
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!updated) throw new ApiError('NOT_FOUND', `Kode DP "${kodeDp}" tidak ditemukan`);
  return toRow(updated as DbRow);
}

export async function deleteDropPoint(
  actorEmail: string,
  kodeDp: string,
): Promise<{ kodeDp: string }> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const { error } = await db().from('master_drop_point').delete().eq('kode_dp', kodeDp);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { kodeDp };
}
