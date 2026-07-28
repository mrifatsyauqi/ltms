import { db } from './client';
import { requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import {
  appendActivityLog,
  computeUmurLive,
  decorateLongTailRow,
  fetchLongtailScoped,
  isClearTTD,
  jakartaNowParts,
  nextAttempt,
  type LongtailDbRow,
} from './longtail-shared';
import type { CreateLongTailInput, LongTailRow, ResetPreview, ResetResult, UpdateLongTailInput } from '@/lib/data/types';

async function findRow(waybill: string): Promise<LongtailDbRow | null> {
  const { data, error } = await db().from('longtail').select('*').eq('no_waybill', waybill).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? null) as LongtailDbRow | null;
}

const sameDp = (a: string | null, b: string) =>
  String(a ?? '').trim().toLowerCase() === String(b).trim().toLowerCase();

export async function listLongTail(actorEmail: string, dpFilter?: string): Promise<LongTailRow[]> {
  const actor = await requireActor(actorEmail);
  const rows = await fetchLongtailScoped(actor, dpFilter);
  return rows.map(decorateLongTailRow);
}

export async function getLongTail(actorEmail: string, waybill: string): Promise<LongTailRow> {
  const actor = await requireActor(actorEmail);
  const row = await findRow(waybill);
  if (!row) throw new ApiError('NOT_FOUND', 'Waybill tidak ditemukan');
  if (actor.role !== 'Admin Cabang' && !sameDp(row.dp_sampai, actor.dropPoint)) {
    throw new ApiError('FORBIDDEN', 'Tidak punya akses ke waybill ini');
  }
  return decorateLongTailRow(row);
}

export async function submitFeedback(
  actorEmail: string,
  waybill: string,
  feedbackRaw: string,
  baseVersion?: string,
): Promise<LongTailRow> {
  const actor = await requireActor(actorEmail);
  const feedback = String(feedbackRaw ?? '').trim();
  if (!waybill) throw new ApiError('VALIDATION_ERROR', 'waybill wajib diisi');
  if (!feedback) throw new ApiError('VALIDATION_ERROR', 'feedback tidak boleh kosong');

  const current = await findRow(waybill);
  if (!current) throw new ApiError('NOT_FOUND', 'Waybill tidak ditemukan');
  if (actor.role !== 'Admin Cabang' && !sameDp(current.dp_sampai, actor.dropPoint)) {
    throw new ApiError('FORBIDDEN', 'Tidak punya akses ke waybill ini');
  }
  if (isClearTTD(current.feedback)) {
    throw new ApiError('ALREADY_CLEAR_TTD', 'Waybill sudah Clear TTD - feedback dibekukan, tidak bisa diubah.');
  }

  const serverVersion = String(current.version ?? '');
  if (baseVersion != null && String(baseVersion) !== serverVersion) {
    throw new ApiError('VERSION_CONFLICT', 'Baris ini sudah diubah oleh proses/user lain. Muat ulang sebelum menyimpan.', decorateLongTailRow(current));
  }

  const parts = jakartaNowParts();
  const oldLog = String(current.log_feedback ?? '');
  const newLogLine = `${parts.tanggal} : ${feedback}`;
  const newLog = oldLog ? `${oldLog}\n${newLogLine}` : newLogLine;

  const patch: Record<string, unknown> = {
    feedback,
    status_terakhir: feedback, // Bagian 9.0
    log_feedback: newLog,
    version: Number(current.version) + 1,
  };
  if (isClearTTD(feedback)) {
    patch.umur_frozen = computeUmurLive(current.waktu_sampai); // beku tepat saat Clear TTD
  }

  // Optimistic lock di level DB: hanya update bila version masih sama.
  const { data: updatedRows, error } = await db()
    .from('longtail')
    .update(patch)
    .eq('no_waybill', waybill)
    .eq('version', Number(current.version))
    .select();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!updatedRows || updatedRows.length === 0) {
    const fresh = await findRow(waybill);
    throw new ApiError(
      'VERSION_CONFLICT',
      'Baris ini sudah diubah oleh proses/user lain. Muat ulang sebelum menyimpan.',
      fresh ? decorateLongTailRow(fresh) : undefined,
    );
  }

  await appendActivityLog({
    user: actor.email,
    dp: String(current.dp_sampai ?? ''),
    waybill,
    attempt: await nextAttempt(waybill),
    dataLama: String(current.feedback ?? ''),
    dataBaru: feedback,
    sumber: 'Manual Feedback',
  });

  return decorateLongTailRow(updatedRows[0] as LongtailDbRow);
}

export async function createLongTail(
  actorEmail: string,
  data: CreateLongTailInput,
): Promise<{ noWaybill: string }> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const noWaybill = String(data?.noWaybill ?? '').trim();
  if (!noWaybill) throw new ApiError('VALIDATION_ERROR', 'No. Waybill wajib diisi');

  const { error } = await db().from('longtail').insert({
    no_waybill: noWaybill,
    status_terakhir: data.statusTerakhir ?? '',
    alasan_bermasalah: data.alasanBermasalah ?? '',
    dp_sampai: data.dpSampai ?? '',
    waktu_sampai: data.waktuSampai ?? '',
    sprinter_delivery: data.sprinterDelivery ?? '',
    cod: data.cod ?? '',
    delivery_attempt: data.deliveryAttempt ?? 0,
    feedback: '',
    log_feedback: '',
    perlu_review: false,
    version: 1,
  });
  if (error) {
    if (error.code === '23505') throw new ApiError('CONFLICT', 'Waybill sudah ada');
    throw new ApiError('INTERNAL_ERROR', error.message);
  }
  return { noWaybill };
}

export async function updateLongTail(
  actorEmail: string,
  waybill: string,
  data: UpdateLongTailInput,
): Promise<LongTailRow> {
  const actor = await requireActor(actorEmail);
  const current = await findRow(waybill);
  if (!current) throw new ApiError('NOT_FOUND', 'Waybill tidak ditemukan');
  if (actor.role !== 'Admin Cabang' && !sameDp(current.dp_sampai, actor.dropPoint)) {
    throw new ApiError('FORBIDDEN', 'Tidak punya akses ke waybill ini');
  }
  // Feedback SENGAJA tidak diubah di sini (hanya lewat submitFeedback).
  const map: Record<string, string> = {
    statusTerakhir: 'status_terakhir',
    alasanBermasalah: 'alasan_bermasalah',
    dpSampai: 'dp_sampai',
    waktuSampai: 'waktu_sampai',
    sprinterDelivery: 'sprinter_delivery',
    cod: 'cod',
    deliveryAttempt: 'delivery_attempt',
  };
  const patch: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) {
    const v = (data as Record<string, unknown>)[k];
    if (v !== undefined) patch[col] = v;
  }
  const { data: updated, error } = await db()
    .from('longtail')
    .update(patch)
    .eq('no_waybill', waybill)
    .select()
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!updated) throw new ApiError('NOT_FOUND', 'Waybill tidak ditemukan');
  return decorateLongTailRow(updated as LongtailDbRow);
}

export async function deleteLongTail(actorEmail: string, waybill: string): Promise<{ waybill: string }> {
  const actor = requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  if (!waybill) throw new ApiError('VALIDATION_ERROR', 'waybill wajib diisi');
  const target = await findRow(waybill);
  if (!target) throw new ApiError('NOT_FOUND', 'Waybill tidak ditemukan');

  await appendActivityLog({
    user: actor.email,
    dp: String(target.dp_sampai ?? ''),
    waybill,
    attempt: await nextAttempt(waybill),
    dataLama: JSON.stringify({ 'Status Terakhir': target.status_terakhir, Feedback: target.feedback }),
    dataBaru: 'DELETED',
    sumber: 'Hapus Manual', // bukan 'Manual Feedback' -> tak terhitung Progress Hari Ini
  });

  const { error } = await db().from('longtail').delete().eq('no_waybill', waybill);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { waybill };
}

// ---- Reset data transaksi (bersihkan untuk go-live) --------------------------
// Kosongkan HANYA tabel transaksi; master data tidak disentuh. Admin Cabang saja.
// Key hasil dipertahankan sesuai nama sheet lama agar UI tak berubah.
const RESET_TARGETS: { key: string; table: string; pk: string }[] = [
  { key: 'LongTail', table: 'longtail', pk: 'no_waybill' },
  { key: 'LongTail_Archive', table: 'longtail_archive', pk: 'no_waybill' },
  { key: 'Activity_Log', table: 'activity_log', pk: 'id' },
  { key: 'Import Batch', table: 'import_batch', pk: 'batch_id' },
];

async function countTable(table: string): Promise<number> {
  const { count, error } = await db().from(table).select('*', { count: 'exact', head: true });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return count ?? 0;
}

export async function previewResetLongTail(actorEmail: string): Promise<ResetPreview> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const counts: Record<string, number> = {};
  for (const t of RESET_TARGETS) counts[t.key] = await countTable(t.table);
  return { dryRun: true, counts };
}

export async function resetLongTailData(actorEmail: string, targets?: string[]): Promise<ResetResult> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const cleared: Record<string, number> = {};
  
  const tablesToReset = targets 
    ? RESET_TARGETS.filter(t => targets.includes(t.key)) 
    : RESET_TARGETS;

  for (const t of tablesToReset) {
    cleared[t.key] = await countTable(t.table);
    // PK selalu non-null -> filter ini mencakup semua baris (PostgREST wajib ada filter).
    const { error } = await db().from(t.table).delete().not(t.pk, 'is', null);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  }
  return { cleared };
}
