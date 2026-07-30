import { db } from './client';
import { requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import { isClearTTD, jakartaParts, jakartaStamp, planAutoClose } from './longtail-shared';
import type { LongtailDbRow } from './longtail-shared';
import type { ImportBatchRow, ImportResult, MappingTemplate } from '@/lib/data/types';
import type { MappedRow } from '@/lib/import/types';

const CHUNK = 500;
function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Kolom lengkap & seragam utk upsert longtail (union kolom harus sama di semua baris). */
type LongtailUpsert = {
  no_waybill: string;
  status_terakhir: string;
  alasan_bermasalah: string;
  dp_sampai: string;
  waktu_sampai: string;
  umur_frozen: number | null;
  sprinter_delivery: string;
  cod: string;
  delivery_attempt: number;
  feedback: string;
  log_feedback: string;
  perlu_review: boolean;
  version: number;
};

const s = (v: unknown) => String(v == null ? '' : v);
function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Baris DB (select *) -> bentuk upsert seragam. */
function fromDb(r: LongtailDbRow): LongtailUpsert {
  return {
    no_waybill: r.no_waybill,
    status_terakhir: s(r.status_terakhir),
    alasan_bermasalah: s(r.alasan_bermasalah),
    dp_sampai: s(r.dp_sampai),
    waktu_sampai: s(r.waktu_sampai),
    umur_frozen: r.umur_frozen ?? null,
    sprinter_delivery: s(r.sprinter_delivery),
    cod: s(r.cod),
    delivery_attempt: toInt(r.delivery_attempt),
    feedback: s(r.feedback),
    log_feedback: s(r.log_feedback),
    perlu_review: !!r.perlu_review,
    version: Number(r.version ?? 1),
  };
}

type LogInsert = {
  user_email: string;
  dp: string;
  waybill: string;
  attempt_ke: number;
  data_lama: string;
  data_baru: string;
  sumber: string;
};

/**
 * Import bertahap (Bagian 7.3): satu file = satu panggilan. Untuk tiap waybill:
 *  - baru        -> insert (feedback kosong, perlu_review false)
 *  - Clear TTD   -> set perlu_review = true (feedback dibekukan, tidak diubah)
 *  - selain itu  -> patch field non-feedback yang berubah (Feedback/Log dijaga)
 * Menegakkan atomicity via bulk upsert; log & batch dicatat ke Supabase.
 */
export async function importLongTail(
  actorEmail: string,
  fileName: string,
  rows: MappedRow[],
): Promise<ImportResult> {
  const actor = requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const incoming = Array.isArray(rows) ? rows : [];

  // Kumpulkan baris valid (punya waybill), hitung skip utk yang kosong.
  const items: { wb: string; row: MappedRow }[] = [];
  let skipped = 0;
  for (const row of incoming) {
    const wb = s(row?.noWaybill).trim();
    if (!wb) { skipped++; continue; }
    items.push({ wb, row });
  }

  const wbList = [...new Set(items.map((i) => i.wb))];

  // Ambil baris LongTail yang sudah ada + hitung attempt dasar dari
  // Activity_Log, PER CHUNK waybill yang sama sekaligus (2 tabel independen
  // - longtail & activity_log tak saling butuh hasil satu sama lain, hanya
  // dipakai terpisah di loop pemrosesan bawah) - pola sama dgn
  // riwayat-feedback.ts, bukan lagi 2 loop chunk terpisah berurutan.
  const existingMap = new Map<string, LongtailUpsert>();
  const attemptMap = new Map<string, number>();
  for (const chunk of chunks(wbList, CHUNK)) {
    const [ltRes, alRes] = await Promise.all([
      db().from('longtail').select('*').in('no_waybill', chunk),
      db().from('activity_log').select('waybill').in('waybill', chunk),
    ]);
    if (ltRes.error) throw new ApiError('INTERNAL_ERROR', ltRes.error.message);
    if (alRes.error) throw new ApiError('INTERNAL_ERROR', alRes.error.message);
    (ltRes.data ?? []).forEach((r) => existingMap.set((r as LongtailDbRow).no_waybill, fromDb(r as LongtailDbRow)));
    (alRes.data ?? []).forEach((r) => {
      const w = s((r as { waybill: string }).waybill);
      attemptMap.set(w, (attemptMap.get(w) ?? 0) + 1);
    });
  }
  const nextAttempt = (wb: string) => {
    attemptMap.set(wb, (attemptMap.get(wb) ?? 0) + 1);
    return attemptMap.get(wb)!;
  };

  // Proses berurutan (mutasi in-memory spt Apps Script), kumpulkan state final.
  const workIndex = new Map<string, LongtailUpsert>(existingMap);
  const finalRows = new Map<string, LongtailUpsert>();
  const logs: LogInsert[] = [];
  let inserted = 0, updated = 0, needReview = 0;

  for (const { wb, row } of items) {
    const existing = workIndex.get(wb);

    if (!existing) {
      const obj: LongtailUpsert = {
        no_waybill: wb,
        status_terakhir: s(row.statusTerakhir),
        alasan_bermasalah: s(row.alasanBermasalah),
        dp_sampai: s(row.dpSampai),
        waktu_sampai: row.waktuSampai ? s(row.waktuSampai) : '',
        umur_frozen: null,
        sprinter_delivery: s(row.sprinterDelivery),
        cod: s(row.cod),
        delivery_attempt: row.deliveryAttempt === undefined || row.deliveryAttempt === '' ? 0 : toInt(row.deliveryAttempt),
        feedback: '',
        log_feedback: '',
        perlu_review: false,
        version: 1,
      };
      finalRows.set(wb, obj);
      workIndex.set(wb, obj);
      inserted++;
      logs.push({
        user_email: actor.email, dp: obj.dp_sampai, waybill: wb, attempt_ke: nextAttempt(wb),
        data_lama: '', data_baru: 'Import baru: ' + (obj.status_terakhir || ''), sumber: 'Auto-update Import',
      });
      continue;
    }

    if (isClearTTD(existing.feedback)) {
      const merged: LongtailUpsert = { ...existing, perlu_review: true };
      finalRows.set(wb, merged);
      workIndex.set(wb, merged);
      needReview++;
      logs.push({
        user_email: actor.email, dp: existing.dp_sampai, waybill: wb, attempt_ke: nextAttempt(wb),
        data_lama: 'Clear TTD', data_baru: 'Muncul lagi di import -> Perlu Review', sumber: 'Auto-update Import',
      });
      continue;
    }

    const before = {
      'Status Terakhir': existing.status_terakhir,
      'Waktu Sampai': existing.waktu_sampai,
      'DP Sampai': existing.dp_sampai,
    };
    const patch: Partial<LongtailUpsert> = {};
    const patchLog: Record<string, unknown> = {};
    if (row.statusTerakhir) { patch.status_terakhir = s(row.statusTerakhir); patchLog['Status Terakhir'] = patch.status_terakhir; }
    if (row.alasanBermasalah) { patch.alasan_bermasalah = s(row.alasanBermasalah); patchLog['Alasan Paket Bermasalah'] = patch.alasan_bermasalah; }
    if (row.dpSampai) { patch.dp_sampai = s(row.dpSampai); patchLog['DP Sampai'] = patch.dp_sampai; }
    if (row.waktuSampai) { patch.waktu_sampai = s(row.waktuSampai); patchLog['Waktu Sampai'] = patch.waktu_sampai; }
    if (row.sprinterDelivery) { patch.sprinter_delivery = s(row.sprinterDelivery); patchLog['Sprinter Delivery'] = patch.sprinter_delivery; }
    if (row.cod) { patch.cod = s(row.cod); patchLog['COD'] = patch.cod; }
    if (row.deliveryAttempt !== undefined && row.deliveryAttempt !== '') { patch.delivery_attempt = toInt(row.deliveryAttempt); patchLog['Delivery Attempt'] = patch.delivery_attempt; }

    const merged: LongtailUpsert = { ...existing, ...patch };
    finalRows.set(wb, merged);
    workIndex.set(wb, merged);
    updated++;
    logs.push({
      user_email: actor.email, dp: merged.dp_sampai, waybill: wb, attempt_ke: nextAttempt(wb),
      data_lama: JSON.stringify(before), data_baru: JSON.stringify(patchLog), sumber: 'Auto-update Import',
    });
  }

  // Tulis: upsert LongTail (onConflict no_waybill) & insert Activity_Log
  // BERSAMAAN (2 tabel independen, logs sudah lengkap dihitung di loop atas,
  // tak butuh hasil upsert longtail), baru lanjut batch.
  const payload = [...finalRows.values()];
  await Promise.all([
    (async () => {
      for (const chunk of chunks(payload, CHUNK)) {
        const { error } = await db().from('longtail').upsert(chunk, { onConflict: 'no_waybill' });
        if (error) throw new ApiError('INTERNAL_ERROR', error.message);
      }
    })(),
    (async () => {
      for (const chunk of chunks(logs, CHUNK)) {
        const { error } = await db().from('activity_log').insert(chunk);
        if (error) throw new ApiError('INTERNAL_ERROR', error.message);
      }
    })(),
  ]);

  // === TAHAP 2 (v1.3): AUTO-CLOSE waybill yang HILANG dari tarikan ===
  // Scope per-DP: hanya DP yang muncul di file; DP lain tidak tersentuh.
  const presentLower = new Set(items.map((i) => i.wb.toLowerCase()));
  const dpsInFile = [...new Set(items.map((i) => s(i.row.dpSampai).trim()).filter(Boolean))];
  let closed = 0, closedClearTTD = 0, closedAlur = 0;

  if (dpsInFile.length) {
    // Ambil semua baris AKTIF di DP tsb (paginasi 1000 + chunk .in()).
    const active: LongtailDbRow[] = [];
    for (const dpChunk of chunks(dpsInFile, CHUNK)) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db()
          .from('longtail')
          .select('*')
          .in('dp_sampai', dpChunk)
          .order('no_waybill')
          .range(from, from + 999);
        if (error) throw new ApiError('INTERNAL_ERROR', error.message);
        const batch = (data ?? []) as LongtailDbRow[];
        active.push(...batch);
        if (batch.length < 1000) break;
      }
    }

    const plan = planAutoClose(active, presentLower);
    if (plan.length) {
      const archiveRows = plan.map(({ row, decision }) => ({
        no_waybill: row.no_waybill,
        status_terakhir: decision.statusTerakhir, // 'CLOSE ALUR' utk Close Alur; tak diubah utk Clear TTD
        alasan_bermasalah: row.alasan_bermasalah,
        dp_sampai: row.dp_sampai,
        waktu_sampai: row.waktu_sampai,
        umur_frozen: decision.umurFrozen, // Close Alur -> umur di-freeze; Clear TTD -> apa adanya
        sprinter_delivery: row.sprinter_delivery,
        cod: row.cod,
        delivery_attempt: row.delivery_attempt,
        feedback: row.feedback,
        log_feedback: row.log_feedback,
        tipe_close: decision.tipeClose, // 'Clear TTD' | 'Close Alur'
      }));
      for (const chunk of chunks(archiveRows, CHUNK)) {
        const { error } = await db().from('longtail_archive').upsert(chunk, { onConflict: 'no_waybill' });
        if (error) throw new ApiError('INTERNAL_ERROR', error.message);
      }
      const wbs = plan.map((p) => p.row.no_waybill);
      for (const chunk of chunks(wbs, CHUNK)) {
        const { error } = await db().from('longtail').delete().in('no_waybill', chunk);
        if (error) throw new ApiError('INTERNAL_ERROR', error.message);
      }
      const closeLogs: LogInsert[] = plan.map(({ row, decision }) => ({
        user_email: actor.email, // jejak Admin Cabang pemicu import (bukan dikosongkan)
        dp: s(row.dp_sampai),
        waybill: row.no_waybill,
        attempt_ke: 0, // event sistem, bukan attempt feedback
        data_lama: decision.dataLama,
        data_baru: decision.dataBaru,
        sumber: 'Auto-Close (tidak muncul di import)',
      }));
      for (const chunk of chunks(closeLogs, CHUNK)) {
        const { error } = await db().from('activity_log').insert(chunk);
        if (error) throw new ApiError('INTERNAL_ERROR', error.message);
      }
      closed = plan.length;
      closedClearTTD = plan.filter((p) => p.decision.tipeClose === 'Clear TTD').length;
      closedAlur = closed - closedClearTTD;
    }
  }

  const batchId = 'B' + jakartaStamp() + '-' + Math.floor(Math.random() * 1000);
  const { error: batchErr } = await db().from('import_batch').insert({
    batch_id: batchId,
    admin_cabang: actor.email,
    nama_file: fileName || '',
    total_baris: incoming.length,
    berhasil: inserted + updated + needReview,
    gagal: skipped,
    status: skipped > 0 ? 'Sebagian' : 'Sukses',
    keterangan: `Baru ${inserted}, Update ${updated}, Perlu Review ${needReview}, Skip ${skipped}, Close ${closed}`,
  });
  if (batchErr) throw new ApiError('INTERNAL_ERROR', batchErr.message);

  return { batchId, total: incoming.length, inserted, updated, needReview, skipped, closed, closedClearTTD, closedAlur };
}

export async function listImportBatches(actorEmail: string): Promise<ImportBatchRow[]> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const { data, error } = await db()
    .from('import_batch')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => {
    const parts = jakartaParts(new Date(String((r as { created_at: string }).created_at)));
    return {
      'Batch ID': s((r as { batch_id: string }).batch_id),
      Tanggal: parts.tanggal,
      Jam: parts.jam,
      'Admin Cabang': s((r as { admin_cabang: string }).admin_cabang),
      'Nama File': s((r as { nama_file: string }).nama_file),
      'Total Baris': toInt((r as { total_baris: number }).total_baris),
      Berhasil: toInt((r as { berhasil: number }).berhasil),
      Gagal: toInt((r as { gagal: number }).gagal),
      Status: s((r as { status: string }).status),
      Keterangan: s((r as { keterangan: string }).keterangan),
    };
  });
}

export async function listMappingTemplates(actorEmail: string): Promise<MappingTemplate[]> {
  await requireActor(actorEmail);
  const { data, error } = await db()
    .from('import_mapping')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => {
    const rec = r as { nama_template: string; mapping: Record<string, string | null>; dibuat_oleh: string; created_at: string };
    return {
      namaTemplate: s(rec.nama_template),
      mapping: (rec.mapping ?? {}) as Record<string, string | null>,
      dibuatOleh: s(rec.dibuat_oleh),
      tanggal: jakartaParts(new Date(String(rec.created_at))).tanggal,
    };
  });
}

export async function saveMappingTemplate(
  actorEmail: string,
  namaTemplate: string,
  mapping: Record<string, string | null>,
): Promise<{ namaTemplate: string }> {
  const actor = requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  if (!namaTemplate || !mapping) throw new ApiError('VALIDATION_ERROR', 'namaTemplate & mapping wajib diisi');
  const { error } = await db()
    .from('import_mapping')
    .upsert({ nama_template: namaTemplate, mapping, dibuat_oleh: actor.email }, { onConflict: 'nama_template' });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { namaTemplate };
}

export async function deleteMappingTemplate(
  actorEmail: string,
  namaTemplate: string,
): Promise<{ namaTemplate: string }> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const { error } = await db().from('import_mapping').delete().eq('nama_template', namaTemplate);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return { namaTemplate };
}
