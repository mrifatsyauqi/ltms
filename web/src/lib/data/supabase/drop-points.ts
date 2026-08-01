import { db } from './client';
import { aktifText, assertKotaExists, assertUserExists, getSupervisedDPs, requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import { FULL_ACCESS_ROLES } from '@/lib/roles';
import type {
  CreateDropPointInput,
  DropPointRow,
  SupervisedDropPointRow,
  UpdateDropPointInput,
} from '@/lib/data/types';

type DbRow = {
  kode_dp: string;
  nama_dp: string;
  wilayah: string | null;
  status_aktif: boolean;
  kode_kota: string | null;
  spv_drop_point_user_id: string | null;
};

type Lookups = {
  namaKotaByKode: Map<string, string>;
  namaUserById: Map<string, string>;
  adminDpByKode: Map<string, string[]>;
};

/** Query pendukung buat Nama Kota, Nama SPV, dan daftar Admin DP per baris -
 *  dijalankan sekali per list (bukan N+1 per baris). */
async function buildLookups(rows: DbRow[]): Promise<Lookups> {
  const kodeKotaList = [...new Set(rows.map((r) => r.kode_kota).filter((v): v is string => !!v))];
  const spvIds = [...new Set(rows.map((r) => r.spv_drop_point_user_id).filter((v): v is string => !!v))];
  const kodeDpList = rows.map((r) => r.kode_dp);

  const [cabangRes, spvRes, adminDpRes] = await Promise.all([
    kodeKotaList.length
      ? db().from('cabang').select('kode_kota, nama_kota').in('kode_kota', kodeKotaList)
      : Promise.resolve({ data: [] as { kode_kota: string; nama_kota: string }[], error: null }),
    spvIds.length
      ? db().from('users').select('id, nama_tampilan, nama').in('id', spvIds)
      : Promise.resolve({ data: [] as { id: string; nama_tampilan: string | null; nama: string }[], error: null }),
    kodeDpList.length
      ? db().from('users').select('nama_tampilan, nama, drop_point').eq('role', 'Admin DP').in('drop_point', kodeDpList)
      : Promise.resolve({ data: [] as { nama_tampilan: string | null; nama: string; drop_point: string }[], error: null }),
  ]);
  if (cabangRes.error) throw new ApiError('INTERNAL_ERROR', cabangRes.error.message);
  if (spvRes.error) throw new ApiError('INTERNAL_ERROR', spvRes.error.message);
  if (adminDpRes.error) throw new ApiError('INTERNAL_ERROR', adminDpRes.error.message);

  const namaKotaByKode = new Map((cabangRes.data ?? []).map((c) => [String(c.kode_kota), String(c.nama_kota)]));
  const namaUserById = new Map(
    (spvRes.data ?? []).map((u) => [String(u.id), String(u.nama_tampilan || u.nama || '')]),
  );
  const adminDpByKode = new Map<string, string[]>();
  for (const u of adminDpRes.data ?? []) {
    const kode = String(u.drop_point);
    const list = adminDpByKode.get(kode) ?? [];
    list.push(String(u.nama_tampilan || u.nama || ''));
    adminDpByKode.set(kode, list);
  }
  return { namaKotaByKode, namaUserById, adminDpByKode };
}

/** Baris DB (snake_case, boolean) -> bentuk respons lama (dipakai frontend). */
function toRow(r: DbRow, lk: Lookups): DropPointRow {
  return {
    'Kode DP': String(r.kode_dp ?? ''),
    'Nama DP': String(r.nama_dp ?? ''),
    'Wilayah/Cabang': String(r.wilayah ?? ''),
    'Status Aktif': aktifText(r.status_aktif),
    'Kode Kota': String(r.kode_kota ?? ''),
    'Nama Kota': r.kode_kota ? (lk.namaKotaByKode.get(r.kode_kota) ?? '') : '',
    'SPV Drop Point': String(r.spv_drop_point_user_id ?? ''),
    'SPV Drop Point Nama': r.spv_drop_point_user_id ? (lk.namaUserById.get(r.spv_drop_point_user_id) ?? '') : '',
    'Admin DP': lk.adminDpByKode.get(r.kode_dp) ?? [],
  };
}

export async function listDropPoints(actorEmail: string): Promise<DropPointRow[]> {
  await requireActor(actorEmail); // siapa pun yang login boleh baca (dropdown)
  const { data, error } = await db().from('master_drop_point').select('*').order('kode_dp');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const rows = (data ?? []) as DbRow[];
  const lk = await buildLookups(rows);
  return rows.map((r) => toRow(r, lk));
}

/** DP yang disupervisi actor yang SEDANG LOGIN (bukan daftar DP lengkap
 *  sistem) - dipakai sidebar (SupervisedScopeBox) utk SPV Drop Point. Aman
 *  utk role apapun (bukan cuma SPV): tinggal pulang array kosong kalau
 *  actor.id tak disupervisikan ke DP manapun. */
export async function listSupervisedDropPoints(actorEmail: string): Promise<SupervisedDropPointRow[]> {
  const actor = await requireActor(actorEmail);
  const kodeList = await getSupervisedDPs(actor.id);
  if (kodeList.length === 0) return [];
  const { data, error } = await db()
    .from('master_drop_point')
    .select('kode_dp, nama_dp')
    .in('kode_dp', kodeList)
    .order('kode_dp');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => ({
    'Kode DP': String((r as { kode_dp: string }).kode_dp ?? ''),
    'Nama DP': String((r as { nama_dp: string }).nama_dp ?? ''),
  }));
}

export async function createDropPoint(
  actorEmail: string,
  data: CreateDropPointInput,
): Promise<{ kodeDp: string }> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const kodeDp = String(data?.kodeDp ?? '').trim();
  const namaDp = String(data?.namaDp ?? '').trim();
  if (!kodeDp || !namaDp) throw new ApiError('VALIDATION_ERROR', 'Kode DP dan Nama DP wajib diisi');

  const kodeKota = data.kodeKota || null;
  const spvDropPointUserId = data.spvDropPointUserId || null;
  if (kodeKota) await assertKotaExists(kodeKota);
  if (spvDropPointUserId) await assertUserExists(spvDropPointUserId);

  const { data: exists } = await db()
    .from('master_drop_point')
    .select('kode_dp')
    .eq('kode_dp', kodeDp)
    .maybeSingle();
  if (exists) throw new ApiError('CONFLICT', 'Kode DP sudah ada');

  const { error } = await db().from('master_drop_point').insert({
    kode_dp: kodeDp,
    nama_dp: namaDp,
    wilayah: data.wilayah ?? '',
    status_aktif: true,
    kode_kota: kodeKota,
    spv_drop_point_user_id: spvDropPointUserId,
  });
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
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const patch: Record<string, unknown> = {};
  if (data.namaDp !== undefined) patch.nama_dp = data.namaDp;
  if (data.wilayah !== undefined) patch.wilayah = data.wilayah;
  if (data.statusAktif !== undefined) patch.status_aktif = !!data.statusAktif;
  if (data.kodeKota !== undefined) {
    if (data.kodeKota) await assertKotaExists(data.kodeKota);
    patch.kode_kota = data.kodeKota || null;
  }
  if (data.spvDropPointUserId !== undefined) {
    if (data.spvDropPointUserId) await assertUserExists(data.spvDropPointUserId);
    patch.spv_drop_point_user_id = data.spvDropPointUserId || null;
  }

  const { data: updated, error } = await db()
    .from('master_drop_point')
    .update(patch)
    .eq('kode_dp', kodeDp)
    .select()
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!updated) throw new ApiError('NOT_FOUND', `Kode DP "${kodeDp}" tidak ditemukan`);
  const row = updated as DbRow;
  const lk = await buildLookups([row]);
  return toRow(row, lk);
}

export async function deleteDropPoint(
  actorEmail: string,
  kodeDp: string,
): Promise<{ kodeDp: string }> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const { error } = await db().from('master_drop_point').delete().eq('kode_dp', kodeDp);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { kodeDp };
}

/**
 * Assign/lepas SPV Drop Point ke BANYAK DP sekaligus dari form User (jalur
 * KEDUA selain edit per-DP satu-satu di halaman Drop Point - keduanya nulis
 * ke kolom yang SAMA, spv_drop_point_user_id, jadi otomatis tetap sinkron).
 * `kodeDpList` = daftar FINAL yang diinginkan (bukan "tambahkan ke") - DP
 * yang sebelumnya ter-assign ke user ini tapi TIDAK ada di daftar baru
 * otomatis dilepas (spv_drop_point_user_id -> null), DP lain milik SPV lain
 * TIDAK disentuh sama sekali.
 */
export async function syncSupervisedDropPoints(
  actorEmail: string,
  targetEmail: string,
  kodeDpList: string[],
): Promise<{ assigned: string[] }> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const email = String(targetEmail ?? '').trim().toLowerCase();
  if (!email) throw new ApiError('VALIDATION_ERROR', 'targetEmail wajib diisi');

  const { data: target, error: targetErr } = await db().from('users').select('id, role').eq('email', email).maybeSingle();
  if (targetErr) throw new ApiError('INTERNAL_ERROR', targetErr.message);
  if (!target) throw new ApiError('NOT_FOUND', `Email "${targetEmail}" tidak ditemukan`);
  if (target.role !== 'SPV Drop Point') {
    throw new ApiError('VALIDATION_ERROR', 'Assignment DP yang disupervisi cuma berlaku utk Jabatan "SPV Drop Point"');
  }
  const targetId = String(target.id);

  const kodeList = [...new Set((kodeDpList ?? []).map((k) => String(k).trim()).filter(Boolean))];
  if (kodeList.length > 0) {
    const { data: exist, error: existErr } = await db().from('master_drop_point').select('kode_dp').in('kode_dp', kodeList);
    if (existErr) throw new ApiError('INTERNAL_ERROR', existErr.message);
    const foundSet = new Set((exist ?? []).map((r) => String((r as { kode_dp: string }).kode_dp)));
    const missing = kodeList.filter((k) => !foundSet.has(k));
    if (missing.length > 0) throw new ApiError('VALIDATION_ERROR', `Drop Point tidak ditemukan: ${missing.join(', ')}`);
  }

  // Diff thd assignment SEBELUMNYA (bukan overwrite serampangan) - lepas cuma
  // DP milik TARGET INI yang tak lagi dipilih; DP milik SPV lain tak pernah
  // ikut ter-query (filter by spv_drop_point_user_id = targetId), jadi aman.
  const { data: currentRows, error: curErr } = await db()
    .from('master_drop_point')
    .select('kode_dp')
    .eq('spv_drop_point_user_id', targetId);
  if (curErr) throw new ApiError('INTERNAL_ERROR', curErr.message);
  const currentSet = new Set((currentRows ?? []).map((r) => String((r as { kode_dp: string }).kode_dp)));
  const toUnassign = [...currentSet].filter((k) => !kodeList.includes(k));

  if (toUnassign.length > 0) {
    const { error } = await db()
      .from('master_drop_point')
      .update({ spv_drop_point_user_id: null })
      .in('kode_dp', toUnassign);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  }
  if (kodeList.length > 0) {
    const { error } = await db()
      .from('master_drop_point')
      .update({ spv_drop_point_user_id: targetId })
      .in('kode_dp', kodeList);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  }
  return { assigned: kodeList };
}
