import { db } from './client';
import { attributionName, requireActor, requireRole, resolveScopedDps, type Actor } from './helpers';
import { ApiError } from '@/lib/errors';
import { FULL_ACCESS_ROLES } from '@/lib/roles';
import {
  appendActivityLog,
  decideFeedbackTransition,
  decorateLongTailRow,
  fetchLongtailScoped,
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

/** FORBIDDEN kalau dp_sampai waybill di luar cakupan actor. Full access = tak
 *  pernah ditolak; SPV Drop Point = boleh kalau salah satu DP disupervisi;
 *  Admin DP = boleh kalau DP-nya sendiri (perilaku sama seperti sebelumnya). */
async function assertCanAccessDp(actor: Actor, dpSampai: string | null): Promise<void> {
  const scopedDps = await resolveScopedDps(actor);
  if (scopedDps && !scopedDps.some((dp) => sameDp(dpSampai, dp))) {
    throw new ApiError('FORBIDDEN', 'Tidak punya akses ke waybill ini');
  }
}

export async function listLongTail(actorEmail: string, dpFilter?: string): Promise<LongTailRow[]> {
  const actor = await requireActor(actorEmail);
  const rows = await fetchLongtailScoped(actor, dpFilter);
  return rows.map(decorateLongTailRow);
}

/**
 * Semua baris LongTail TANPA auth, selalu "Semua DP" - dipakai endpoint
 * publik (Link Berbagi Laporan) setelah token divalidasi terpisah. Aktor
 * sintetis ('Admin Cabang', dropPoint kosong) hanya utk lolos syarat
 * `fetchLongtailScoped`/`resolveScopedDps` (role di luar FULL_ACCESS_ROLES ->
 * scope terbatas) - tak pernah benar2 dipakai utk otorisasi krn tak ada
 * requireActor/requireRole di jalur ini sama sekali.
 */
export async function listLongTailPublic(): Promise<LongTailRow[]> {
  const rows = await fetchLongtailScoped({ id: '', email: '', role: 'Admin Cabang', dropPoint: '', nik: '', namaTampilan: '', tipeAkun: 'individual' });
  return rows.map(decorateLongTailRow);
}

export async function getLongTail(actorEmail: string, waybill: string): Promise<LongTailRow> {
  const actor = await requireActor(actorEmail);
  const row = await findRow(waybill);
  if (!row) throw new ApiError('NOT_FOUND', 'Waybill tidak ditemukan');
  await assertCanAccessDp(actor, row.dp_sampai);
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
  await assertCanAccessDp(actor, current.dp_sampai);
  // Baris Clear TTD di LongTail AKTIF (belum diarsipkan) TETAP BISA disubmit
  // ulang - mis. koreksi salah tandai Clear TTD kembali ke status lain (lihat
  // logic wasClearTTD/willBeClearTTD di bawah utk aturan freeze/resume &
  // "Koreksi Manual"). Setelah diarsipkan (Auto-Close), baris sudah tak ada
  // lagi di tabel ini sama sekali - findRow di atas otomatis NOT_FOUND.

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
    log_feedback: newLog,
    version: Number(current.version) + 1,
  };

  // Keputusan freeze/resume umur & sumber Activity_Log — logic MURNI, diuji
  // langsung tanpa DB (longtail-pure.test.ts), pola sama dgn decideAutoClose.
  const transition = decideFeedbackTransition(current, feedback);
  if (transition.umurFrozen !== undefined) patch.umur_frozen = transition.umurFrozen;

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
    user: attributionName(actor),
    dp: String(current.dp_sampai ?? ''),
    waybill,
    attempt: await nextAttempt(waybill),
    dataLama: transition.dataLama,
    dataBaru: feedback,
    sumber: transition.sumber,
  });

  return decorateLongTailRow(updatedRows[0] as LongtailDbRow);
}

export async function createLongTail(
  actorEmail: string,
  data: CreateLongTailInput,
): Promise<{ noWaybill: string }> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
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
  // FULL_ACCESS_ROLES SAJA (bukan assertCanAccessDp spt getLongTail/submitFeedback)
  // - fungsi ini bisa mengubah field `dp_sampai` sendiri (lihat map di bawah),
  // jadi TIDAK BOLEH diberikan ke Admin DP/SPV Drop Point sekalipun untuk
  // baris di cakupan mereka sendiri (kalau tidak, mereka bisa memindahkan
  // waybill keluar dari cakupannya via field itu). PRD Bagian 5: Admin DP
  // "hanya dapat MELIHAT data sesuai DP" - tidak ada hak edit baris LongTail
  // umum, cuma submitFeedback (sama berlaku utk SPV Drop Point).
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const current = await findRow(waybill);
  if (!current) throw new ApiError('NOT_FOUND', 'Waybill tidak ditemukan');
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
  const actor = requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  if (!waybill) throw new ApiError('VALIDATION_ERROR', 'waybill wajib diisi');
  const target = await findRow(waybill);
  if (!target) throw new ApiError('NOT_FOUND', 'Waybill tidak ditemukan');

  await appendActivityLog({
    user: attributionName(actor),
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
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
  const counts: Record<string, number> = {};
  for (const t of RESET_TARGETS) counts[t.key] = await countTable(t.table);
  return { dryRun: true, counts };
}

export async function resetLongTailData(actorEmail: string, targets?: string[]): Promise<ResetResult> {
  requireRole(await requireActor(actorEmail), FULL_ACCESS_ROLES);
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
