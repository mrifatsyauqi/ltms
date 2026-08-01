import { db } from './client';
import { aktifText, requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import { FULL_ACCESS_ROLES } from '@/lib/roles';
import type { MasterFeedbackRow } from '@/lib/data/types';

type DbRow = { id: number; nama_feedback: string; status_aktif: boolean };

function toRow(r: DbRow): MasterFeedbackRow {
  return { ID: Number(r.id), 'Nama Feedback': String(r.nama_feedback ?? ''), 'Status Aktif': aktifText(r.status_aktif) };
}

export async function listMasterFeedback(actorEmail: string): Promise<MasterFeedbackRow[]> {
  await requireActor(actorEmail);
  const { data, error } = await db().from('master_feedback').select('*').order('id');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => toRow(r as DbRow));
}

export async function createMasterFeedback(actorEmail: string, namaFeedback: string): Promise<{ id: number }> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const nama = String(namaFeedback ?? '').trim();
  if (!nama) throw new ApiError('VALIDATION_ERROR', 'Nama Feedback wajib diisi');

  const { data: all } = await db().from('master_feedback').select('nama_feedback');
  const dup = (all ?? []).some((r) => String(r.nama_feedback).trim().toLowerCase() === nama.toLowerCase());
  if (dup) throw new ApiError('CONFLICT', 'Nama Feedback sudah ada');

  const { data, error } = await db()
    .from('master_feedback')
    .insert({ nama_feedback: nama, status_aktif: true })
    .select('id')
    .single();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { id: Number(data.id) };
}

export async function updateMasterFeedback(
  actorEmail: string,
  id: number | string,
  data: Partial<{ namaFeedback: string; statusAktif: boolean }>,
): Promise<MasterFeedbackRow> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const patch: Record<string, unknown> = {};
  if (data.namaFeedback !== undefined) patch.nama_feedback = data.namaFeedback;
  if (data.statusAktif !== undefined) patch.status_aktif = !!data.statusAktif;

  const { data: updated, error } = await db()
    .from('master_feedback')
    .update(patch)
    .eq('id', Number(id))
    .select()
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!updated) throw new ApiError('NOT_FOUND', `ID "${id}" tidak ditemukan`);
  return toRow(updated as DbRow);
}

export async function deleteMasterFeedback(
  actorEmail: string,
  id: number | string,
): Promise<{ id: number | string }> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const { error } = await db().from('master_feedback').delete().eq('id', Number(id));
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { id };
}
