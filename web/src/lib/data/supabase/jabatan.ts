import { db } from './client';
import { requireActor } from './helpers';
import { ApiError } from '@/lib/errors';
import type { JabatanRow } from '@/lib/data/types';

type DbRow = {
  id: string;
  nama: string;
  tingkat: number;
  deskripsi: string | null;
};

function toRow(r: DbRow): JabatanRow {
  return {
    Id: String(r.id ?? ''),
    Nama: String(r.nama ?? ''),
    Tingkat: Number(r.tingkat ?? 0),
    Deskripsi: String(r.deskripsi ?? ''),
  };
}

/** Semua 6 baris (termasuk yang belum bisa dipilih di form manapun - lihat
 *  catatan Opsi 1 di user-management-client.tsx) - siapa pun yang login
 *  boleh baca, konsisten dgn listDropPoints/listCabang. */
export async function listJabatan(actorEmail: string): Promise<JabatanRow[]> {
  await requireActor(actorEmail);
  const { data, error } = await db().from('jabatan').select('id, nama, tingkat, deskripsi').order('tingkat');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => toRow(r as DbRow));
}
