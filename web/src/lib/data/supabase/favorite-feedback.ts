import { db } from './client';
import { requireActor } from './helpers';
import { ApiError } from '@/lib/errors';
import type { FavoriteFeedbackRow } from '@/lib/apps-script/favorite-feedback';

type DbRow = { email_admin_dp: string; nama_feedback: string; urutan: number };

function toRow(r: DbRow): FavoriteFeedbackRow {
  return {
    'Email Admin DP': String(r.email_admin_dp ?? ''),
    'Nama Feedback': String(r.nama_feedback ?? ''),
    Urutan: Number(r.urutan ?? 0),
  };
}

export async function listFavoriteFeedback(actorEmail: string): Promise<FavoriteFeedbackRow[]> {
  const actor = await requireActor(actorEmail);
  const { data, error } = await db()
    .from('favorite_feedback')
    .select('email_admin_dp, nama_feedback, urutan')
    .eq('email_admin_dp', actor.email)
    .order('urutan');
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => toRow(r as DbRow));
}

export async function addFavoriteFeedback(
  actorEmail: string,
  namaFeedback: string,
): Promise<{ namaFeedback: string }> {
  const actor = await requireActor(actorEmail);
  const nama = String(namaFeedback ?? '').trim();
  if (!nama) throw new ApiError('VALIDATION_ERROR', 'Nama Feedback wajib diisi');

  const { data: mine, error: readErr } = await db()
    .from('favorite_feedback')
    .select('nama_feedback, urutan')
    .eq('email_admin_dp', actor.email);
  if (readErr) throw new ApiError('INTERNAL_ERROR', readErr.message);
  if ((mine ?? []).some((r) => String(r.nama_feedback).trim().toLowerCase() === nama.toLowerCase())) {
    throw new ApiError('CONFLICT', 'Feedback sudah ada di favorit');
  }
  const nextOrder = (mine ?? []).reduce((max, r) => Math.max(max, Number(r.urutan) || 0), 0) + 1;

  const { error } = await db()
    .from('favorite_feedback')
    .insert({ email_admin_dp: actor.email, nama_feedback: nama, urutan: nextOrder });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { namaFeedback: nama };
}

export async function removeFavoriteFeedback(
  actorEmail: string,
  namaFeedback: string,
): Promise<{ namaFeedback: string }> {
  const actor = await requireActor(actorEmail);
  const { error } = await db()
    .from('favorite_feedback')
    .delete()
    .eq('email_admin_dp', actor.email)
    .eq('nama_feedback', namaFeedback);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { namaFeedback };
}
