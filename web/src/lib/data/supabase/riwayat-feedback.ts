import { db } from './client';
import { requireActor } from './helpers';
import { ApiError } from '@/lib/errors';
import { isClearTTD, jakartaParts } from './longtail-shared';
import type { RiwayatFeedbackRow } from '@/lib/data/types';

const AUTO_CLOSE = 'Auto-Close (tidak muncul di import)';

type LogRow = {
  waybill: string | null;
  user_email: string | null;
  dp: string | null;
  attempt_ke: number | null;
  data_baru: string | null;
  sumber: string | null;
  created_at: string;
};

/**
 * Riwayat aktivitas per waybill dari Activity_Log: feedback manual + event
 * Auto-Close (v1.3) supaya paket yang sudah diarsipkan tetap bisa ditelusuri.
 * "Status Terkini" join ke LongTail aktif & LongTail_Archive:
 *   aktif Clear TTD -> 'Clear TTD'; aktif lain -> 'Belum Clear TTD';
 *   arsip -> 'Clear TTD (Arsip)' / 'Close Alur (Arsip)'; sisanya 'Tidak ada di LongTail'.
 * Rentang tanggal ISO 'YYYY-MM-DD' (batas hari Jakarta). Scoping DP server-side.
 */
export async function listRiwayatFeedback(
  actorEmail: string,
  from?: string,
  to?: string,
): Promise<RiwayatFeedbackRow[]> {
  const actor = await requireActor(actorEmail);
  const isCabang = actor.role === 'Admin Cabang';

  let q = db()
    .from('activity_log')
    .select('waybill, user_email, dp, attempt_ke, data_baru, sumber, created_at')
    .in('sumber', ['Manual Feedback', AUTO_CLOSE])
    .order('created_at', { ascending: false });
  if (!isCabang) q = q.eq('dp', actor.dropPoint);
  if (from) q = q.gte('created_at', `${from}T00:00:00+07:00`);
  if (to) q = q.lte('created_at', `${to}T23:59:59.999+07:00`);

  const { data, error } = await q;
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const rows = (data ?? []) as LogRow[];
  if (rows.length === 0) return [];

  const wbList = [...new Set(rows.map((r) => String(r.waybill ?? '').trim()).filter(Boolean))];
  const CH = 500;

  // Index LongTail aktif (feedback) & LongTail_Archive (tipe_close) utk Status Terkini.
  const activeFb = new Map<string, string>(); // waybill(lower) -> feedback
  const archived = new Map<string, string>(); // waybill(lower) -> tipe_close
  for (let i = 0; i < wbList.length; i += CH) {
    const chunk = wbList.slice(i, i + CH);
    const [ltRes, arRes] = await Promise.all([
      db().from('longtail').select('no_waybill, feedback').in('no_waybill', chunk),
      db().from('longtail_archive').select('no_waybill, tipe_close').in('no_waybill', chunk),
    ]);
    if (ltRes.error) throw new ApiError('INTERNAL_ERROR', ltRes.error.message);
    if (arRes.error) throw new ApiError('INTERNAL_ERROR', arRes.error.message);
    (ltRes.data ?? []).forEach((r) => {
      const rec = r as { no_waybill: string; feedback: string | null };
      activeFb.set(String(rec.no_waybill).trim().toLowerCase(), String(rec.feedback ?? ''));
    });
    (arRes.data ?? []).forEach((r) => {
      const rec = r as { no_waybill: string; tipe_close: string | null };
      archived.set(String(rec.no_waybill).trim().toLowerCase(), String(rec.tipe_close ?? ''));
    });
  }

  function statusTerkini(wbLower: string): string {
    if (activeFb.has(wbLower)) return isClearTTD(activeFb.get(wbLower)) ? 'Clear TTD' : 'Belum Clear TTD';
    if (archived.has(wbLower)) return archived.get(wbLower) === 'Clear TTD' ? 'Clear TTD (Arsip)' : 'Close Alur (Arsip)';
    return 'Tidak ada di LongTail';
  }

  return rows.map((a) => {
    const wb = String(a.waybill ?? '').trim();
    const d = new Date(String(a.created_at));
    const parts = jakartaParts(d);
    return {
      waybill: wb,
      tanggal: parts.tanggal,
      jam: parts.jam,
      attempt: a.attempt_ke ?? '',
      feedbackSaatItu: String(a.data_baru ?? ''),
      adminDp: String(a.user_email ?? ''),
      dp: String(a.dp ?? ''),
      statusTerkini: statusTerkini(wb.toLowerCase()),
      ts: d.getTime(),
      sumber: String(a.sumber ?? ''),
    };
  });
}
