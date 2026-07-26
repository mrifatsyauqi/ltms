import { db } from './client';
import { requireActor } from './helpers';
import { ApiError } from '@/lib/errors';
import { isClearTTD, jakartaParts } from './longtail-shared';
import type { RiwayatFeedbackRow } from '@/lib/apps-script/riwayat-feedback';

type LogRow = {
  waybill: string | null;
  user_email: string | null;
  dp: string | null;
  attempt_ke: number | null;
  data_baru: string | null;
  created_at: string;
};

/**
 * Riwayat aktivitas feedback dari Activity_Log (sumber 'Manual Feedback'),
 * di-JOIN ke LongTail untuk "Status Terkini". Rentang tanggal ISO 'YYYY-MM-DD'
 * (batas hari zona Jakarta). Scoping DP server-side; terbaru di atas.
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
    .select('waybill, user_email, dp, attempt_ke, data_baru, created_at')
    .eq('sumber', 'Manual Feedback')
    .order('created_at', { ascending: false });
  if (!isCabang) q = q.eq('dp', actor.dropPoint);
  if (from) q = q.gte('created_at', `${from}T00:00:00+07:00`);
  if (to) q = q.lte('created_at', `${to}T23:59:59.999+07:00`);

  const { data, error } = await q;
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const rows = (data ?? []) as LogRow[];
  if (rows.length === 0) return [];

  // Index LongTail utk Status Terkini (1 kali baca utk waybill yang muncul).
  const wbList = [...new Set(rows.map((r) => String(r.waybill ?? '').trim()).filter(Boolean))];
  const ltMap = new Map<string, string>(); // waybill -> feedback
  const CH = 500;
  for (let i = 0; i < wbList.length; i += CH) {
    const chunk = wbList.slice(i, i + CH);
    const { data: lt, error: ltErr } = await db().from('longtail').select('no_waybill, feedback').in('no_waybill', chunk);
    if (ltErr) throw new ApiError('INTERNAL_ERROR', ltErr.message);
    (lt ?? []).forEach((r) => {
      const rec = r as { no_waybill: string; feedback: string | null };
      ltMap.set(String(rec.no_waybill).trim().toLowerCase(), String(rec.feedback ?? ''));
    });
  }

  return rows.map((a) => {
    const wb = String(a.waybill ?? '').trim();
    const d = new Date(String(a.created_at));
    const parts = jakartaParts(d);
    const hasLt = ltMap.has(wb.toLowerCase());
    return {
      waybill: wb,
      tanggal: parts.tanggal,
      jam: parts.jam,
      attempt: a.attempt_ke ?? '',
      feedbackSaatItu: String(a.data_baru ?? ''),
      adminDp: String(a.user_email ?? ''),
      dp: String(a.dp ?? ''),
      statusTerkini: hasLt
        ? (isClearTTD(ltMap.get(wb.toLowerCase())) ? 'Clear TTD' : 'Belum Clear TTD')
        : 'Tidak ada di LongTail',
      ts: d.getTime(),
    };
  });
}
