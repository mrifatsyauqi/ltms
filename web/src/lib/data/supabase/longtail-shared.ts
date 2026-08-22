import { db } from './client';
import { ApiError } from '@/lib/errors';
import { expandDpMatchValues, resolveScopedDps, type Actor } from './helpers';
import type { LongtailDbRow } from './longtail-pure';

// Re-export semua helper MURNI supaya import lama dari './longtail-shared' tetap jalan.
export * from './longtail-pure';

/** Ambil semua baris LongTail ter-scope: full access -> opsional filter
 *  dpFilter (mis. Admin Cabang pilih 1 DP di CAKUPAN); Admin DP -> DP-nya;
 *  SPV Drop Point -> semua DP yang disupervisi (bisa >1, lihat resolveScopedDps). */
export async function fetchLongtailScoped(actor: Actor, dpFilter?: string): Promise<LongtailDbRow[]> {
  const PAGE = 1000;
  const out: LongtailDbRow[] = [];
  const scopedDps = await resolveScopedDps(actor);
  // Kode DP -> nilai dp_sampai yang SAH (termasuk Nama DP) - lihat komentar
  // expandDpMatchValues (beberapa DP py Kode DP master beda dari teks
  // "DP Sampai" yang terlanjur ter-import).
  const matchValues = scopedDps
    ? await expandDpMatchValues(scopedDps)
    : dpFilter
      ? await expandDpMatchValues([dpFilter])
      : null;
  for (let from = 0; ; from += PAGE) {
    let q = db().from('longtail').select('*').order('no_waybill').range(from, from + PAGE - 1);
    if (matchValues) q = q.in('dp_sampai', matchValues);
    const { data, error } = await q;
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    const batch = (data ?? []) as LongtailDbRow[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/** Attempt berikutnya = jumlah baris Activity_Log utk waybill itu + 1. */
export async function nextAttempt(waybill: string): Promise<number> {
  const { count, error } = await db()
    .from('activity_log')
    .select('*', { count: 'exact', head: true })
    .eq('waybill', waybill);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (count ?? 0) + 1;
}

export async function appendActivityLog(entry: {
  user: string;
  dp: string;
  waybill: string;
  attempt: number;
  dataLama: string;
  dataBaru: string;
  sumber: string;
}): Promise<void> {
  const { error } = await db().from('activity_log').insert({
    user_email: entry.user,
    dp: entry.dp,
    waybill: entry.waybill,
    attempt_ke: entry.attempt,
    data_lama: entry.dataLama,
    data_baru: entry.dataBaru,
    sumber: entry.sumber,
  });
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
}
