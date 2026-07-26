import { db } from './client';
import { requireActor, requireRole } from './helpers';
import { ApiError } from '@/lib/errors';
import { computeUmur, isClearTTD, type LongtailDbRow } from './longtail-shared';
import type { ArchivePreview, ArchiveResult } from '@/lib/apps-script/archive';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function fetchAll(): Promise<LongtailDbRow[]> {
  const PAGE = 1000;
  const out: LongtailDbRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().from('longtail').select('*').order('no_waybill').range(from, from + PAGE - 1);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    const batch = (data ?? []) as LongtailDbRow[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/**
 * Arsipkan paket Clear TTD yang sudah > thresholdDays sejak menjadi Clear TTD.
 * Tanggal clear diperkirakan dari waktu_sampai + umur (beku). dryRun hanya
 * menghitung. Hanya Admin Cabang.
 */
export async function archiveClearTTD(
  actorEmail: string,
  opts: { thresholdDays?: number; dryRun?: boolean; waybills?: string[] } = {},
): Promise<ArchivePreview | ArchiveResult> {
  requireRole(await requireActor(actorEmail), ['Admin Cabang']);
  const thresholdDays = opts.thresholdDays != null ? Number(opts.thresholdDays) : 30;
  const dryRun = !!opts.dryRun;
  const only = Array.isArray(opts.waybills) && opts.waybills.length
    ? opts.waybills.map((w) => String(w).trim().toLowerCase())
    : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await fetchAll();
  const eligible = rows.filter((r) => {
    if (!isClearTTD(r.feedback)) return false;
    if (only) return only.indexOf(String(r.no_waybill).trim().toLowerCase()) !== -1;
    const ws = r.waktu_sampai;
    const d = ws ? new Date(ws) : null;
    const umur = Number(computeUmur(r));
    if (!d || isNaN(d.getTime()) || !isFinite(umur)) return false; // tak bisa tentukan tgl clear -> jangan arsip
    const clearDate = new Date(d.getTime() + umur * MS_PER_DAY);
    const hariSejakClear = Math.floor((today.getTime() - clearDate.getTime()) / MS_PER_DAY);
    return hariSejakClear > thresholdDays;
  });

  if (dryRun) return { eligible: eligible.length, thresholdDays };

  if (eligible.length) {
    const archiveRows = eligible.map((r) => ({
      no_waybill: r.no_waybill,
      status_terakhir: r.status_terakhir,
      alasan_bermasalah: r.alasan_bermasalah,
      dp_sampai: r.dp_sampai,
      waktu_sampai: r.waktu_sampai,
      umur_frozen: r.umur_frozen,
      sprinter_delivery: r.sprinter_delivery,
      cod: r.cod,
      delivery_attempt: r.delivery_attempt,
      feedback: r.feedback,
      log_feedback: r.log_feedback,
      // tanggal_arsip: default current_date
    }));
    const CH = 500;
    for (let i = 0; i < archiveRows.length; i += CH) {
      const { error } = await db().from('longtail_archive').upsert(archiveRows.slice(i, i + CH), { onConflict: 'no_waybill' });
      if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    }
    const wbs = eligible.map((r) => r.no_waybill);
    for (let i = 0; i < wbs.length; i += CH) {
      const { error } = await db().from('longtail').delete().in('no_waybill', wbs.slice(i, i + CH));
      if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    }
  }

  return { archived: eligible.length, thresholdDays };
}

export function previewArchive(actorEmail: string, thresholdDays = 30): Promise<ArchivePreview> {
  return archiveClearTTD(actorEmail, { thresholdDays, dryRun: true }) as Promise<ArchivePreview>;
}

export function runArchive(actorEmail: string, thresholdDays = 30): Promise<ArchiveResult> {
  return archiveClearTTD(actorEmail, { thresholdDays }) as Promise<ArchiveResult>;
}
