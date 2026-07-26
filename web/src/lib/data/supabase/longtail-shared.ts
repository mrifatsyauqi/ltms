import { db } from './client';
import { ApiError } from '@/lib/errors';
import type { Actor } from './helpers';
import type { LongTailRow } from '@/lib/apps-script/longtail';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type LongtailDbRow = {
  no_waybill: string;
  status_terakhir: string | null;
  alasan_bermasalah: string | null;
  dp_sampai: string | null;
  waktu_sampai: string | null;
  umur_frozen: number | null;
  sprinter_delivery: string | null;
  cod: string | null;
  delivery_attempt: number | null;
  feedback: string | null;
  log_feedback: string | null;
  perlu_review: boolean | null;
  version: number;
};

/** Feedback dianggap Clear TTD bila mengandung kata 'TTD'. */
export function isClearTTD(feedback: unknown): boolean {
  return /\bTTD\b/i.test(String(feedback ?? ''));
}

/** Kategori Distribusi Feedback (Bagian 8 PRD). */
export function categorizeFeedback(feedback: unknown): string {
  const f = String(feedback ?? '').trim();
  if (f === '') return 'Belum Feedback';
  if (isClearTTD(f)) return 'Clear TTD';
  const u = f.toUpperCase();
  if (u.includes('ON DELIVERY') || u.includes('ONDELIVERY')) return 'On Delivery';
  if (u.includes('RESCHEDULE')) return 'Reschedule';
  if (u.includes('TIDAK DI TEMPAT') || u.includes('PENERIMA TIDAK')) return 'Penerima Tidak Di Tempat';
  if (u.includes('ALAMAT')) return 'Alamat Tidak Ditemukan';
  return 'Lainnya';
}

/** Umur live dari waktu_sampai (hari, >=0) atau null bila tak valid. */
export function computeUmurLive(waktuSampai: string | null): number | null {
  const ws = String(waktuSampai ?? '').trim();
  if (!ws) return null;
  const d = new Date(ws);
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / MS_PER_DAY);
  return diff < 0 ? 0 : diff;
}

/** Umur Paket: beku bila Clear TTD (umur_frozen), selain itu live. '' bila tak tahu. */
export function computeUmur(r: LongtailDbRow): number | '' {
  if (isClearTTD(r.feedback) && r.umur_frozen != null && !isNaN(Number(r.umur_frozen))) {
    return Number(r.umur_frozen);
  }
  const live = computeUmurLive(r.waktu_sampai);
  if (live != null) return live;
  return r.umur_frozen != null ? Number(r.umur_frozen) : '';
}

/** Baris DB -> bentuk lama + field turunan (Umur, __isClearTTD, __version). */
export function decorateLongTailRow(r: LongtailDbRow): LongTailRow {
  return {
    'No. Waybill': String(r.no_waybill ?? ''),
    'Status Terakhir': String(r.status_terakhir ?? ''),
    'Alasan Paket Bermasalah': String(r.alasan_bermasalah ?? ''),
    'DP Sampai': String(r.dp_sampai ?? ''),
    'Waktu Sampai': String(r.waktu_sampai ?? ''),
    'Umur Paket': computeUmur(r),
    'Sprinter Delivery': String(r.sprinter_delivery ?? ''),
    COD: String(r.cod ?? ''),
    'Delivery Attempt': Number(r.delivery_attempt ?? 0),
    Feedback: String(r.feedback ?? ''),
    'Log Feedback': String(r.log_feedback ?? ''),
    'Perlu Review': r.perlu_review ? 'Ya' : '',
    __isClearTTD: isClearTTD(r.feedback),
    __version: String(r.version ?? ''),
  };
}

/** Ambil semua baris LongTail ter-scope (Admin DP -> DP-nya), paginasi 1000. */
export async function fetchLongtailScoped(actor: Actor): Promise<LongtailDbRow[]> {
  const PAGE = 1000;
  const out: LongtailDbRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db().from('longtail').select('*').order('no_waybill').range(from, from + PAGE - 1);
    if (actor.role !== 'Admin Cabang') q = q.eq('dp_sampai', actor.dropPoint);
    const { data, error } = await q;
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    const batch = (data ?? []) as LongtailDbRow[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/** Waktu Jakarta (UTC+7) sebagai bagian tanggal 'dd/MM/yy' & jam 'HH:mm:ss'. */
export function jakartaNowParts(): { tanggal: string; jam: string } {
  const j = new Date(Date.now() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    tanggal: `${p(j.getUTCDate())}/${p(j.getUTCMonth() + 1)}/${String(j.getUTCFullYear()).slice(-2)}`,
    jam: `${p(j.getUTCHours())}:${p(j.getUTCMinutes())}:${p(j.getUTCSeconds())}`,
  };
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
