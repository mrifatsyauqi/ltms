import { db } from './client';
import { requireActor } from './helpers';
import { ApiError } from '@/lib/errors';
import {
  categorizeFeedback,
  computeUmur,
  isClearTTD,
  jakartaTodayIso,
  type LongtailDbRow,
} from './longtail-shared';
import type { DashboardData } from '@/lib/data/types';

/** Ambil baris LongTail ter-scope: Admin DP -> DP-nya; Admin Cabang -> semua atau 1 DP (filter CAKUPAN). */
async function fetchScoped(dpFilter: string | null): Promise<LongtailDbRow[]> {
  const PAGE = 1000;
  const out: LongtailDbRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db().from('longtail').select('*').order('no_waybill').range(from, from + PAGE - 1);
    if (dpFilter) q = q.eq('dp_sampai', dpFilter);
    const { data, error } = await q;
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    const batch = (data ?? []) as LongtailDbRow[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/**
 * Semua angka dihitung & di-scope server-side (Admin DP hanya DP-nya). `dp`
 * opsional: bila diisi (Admin Cabang memilih 1 DP di filter CAKUPAN) memfilter
 * ke DP itu memakai jalur yang sama dengan Admin DP. Read-only.
 */
export async function getDashboard(actorEmail: string, dp?: string): Promise<DashboardData> {
  const actor = await requireActor(actorEmail);
  const isCabang = actor.role === 'Admin Cabang';

  // Tentukan filter DP efektif.
  let dpFilter: string | null = null;
  if (!isCabang) dpFilter = actor.dropPoint;
  else if (dp && String(dp) !== 'ALL') dpFilter = String(dp);

  return computeDashboard(dpFilter, actor.role, actor.dropPoint || '');
}

/** Inti agregasi Dashboard tanpa auth — dipakai getDashboard (live) & snapshot cron. */
async function computeDashboard(dpFilter: string | null, role: string, dropPoint: string): Promise<DashboardData> {
  const rows = await fetchScoped(dpFilter);

  const total = rows.length;
  let sudah = 0, clearTTD = 0, lebih3 = 0, paketTertua = 0, paketTertuaWb = '';
  const distribusi: Record<string, number> = {
    'Clear TTD': 0, 'On Delivery': 0, 'Reschedule': 0, 'Penerima Tidak Di Tempat': 0,
    'Alamat Tidak Ditemukan': 0, 'Lainnya': 0, 'Belum Feedback': 0,
  };
  const agingBuckets: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7+': 0 };
  const perDp: Record<string, { dp: string; total: number; sudah: number; clearTTD: number; lebih3: number }> = {};
  const perSprinter: Record<string, { sprinter: string; total: number; sudah: number }> = {};

  const currentWb = new Set<string>();

  for (const r of rows) {
    const fb = String(r.feedback ?? '').trim();
    const isTTD = isClearTTD(fb);
    const umur = computeUmur(r);
    let umurNum: number | null = typeof umur === 'number' ? umur : Number(umur);
    if (!Number.isFinite(umurNum as number)) umurNum = null;

    if (fb !== '') sudah++;
    if (isTTD) clearTTD++;
    distribusi[categorizeFeedback(fb)]++;

    if (!isTTD && umurNum != null) {
      if (umurNum >= 3) lebih3++;
      if (umurNum > paketTertua) { paketTertua = umurNum; paketTertuaWb = String(r.no_waybill ?? ''); }
      if (umurNum >= 1) {
        const key = umurNum >= 7 ? '7+' : String(umurNum);
        agingBuckets[key]++;
      }
    }

    const dpKey = String(r.dp_sampai ?? '').trim() || '(kosong)';
    if (!perDp[dpKey]) perDp[dpKey] = { dp: dpKey, total: 0, sudah: 0, clearTTD: 0, lebih3: 0 };
    perDp[dpKey].total++;
    if (fb !== '') perDp[dpKey].sudah++;
    if (isTTD) perDp[dpKey].clearTTD++;
    if (!isTTD && umurNum != null && umurNum >= 3) perDp[dpKey].lebih3++;

    const sp = String(r.sprinter_delivery ?? '').trim() || '(kosong)';
    if (!perSprinter[sp]) perSprinter[sp] = { sprinter: sp, total: 0, sudah: 0 };
    perSprinter[sp].total++;
    if (fb !== '') perSprinter[sp].sudah++;

    currentWb.add(String(r.no_waybill ?? '').trim().toLowerCase());
  }

  // Progress Hari Ini: waybill (yang masih ada, ter-scope) dengan Manual Feedback hari ini (Jakarta).
  const today = jakartaTodayIso();
  let alQ = db()
    .from('activity_log')
    .select('waybill')
    .eq('sumber', 'Manual Feedback')
    .gte('created_at', `${today}T00:00:00+07:00`)
    .lte('created_at', `${today}T23:59:59.999+07:00`);
  if (dpFilter) alQ = alQ.eq('dp', dpFilter);
  const { data: alData, error: alErr } = await alQ;
  if (alErr) throw new ApiError('INTERNAL_ERROR', alErr.message);
  const todayWb = new Set<string>();
  (alData ?? []).forEach((a) => {
    const k = String((a as { waybill: string }).waybill ?? '').trim().toLowerCase();
    if (currentWb.has(k)) todayWb.add(k);
  });
  const progressHariIni = todayWb.size;

  const monitoringDp = Object.keys(perDp).map((k) => {
    const d = perDp[k];
    return {
      dp: d.dp,
      total: d.total,
      sudah: d.sudah,
      belum: d.total - d.sudah,
      clearTTD: d.clearTTD,
      lebih3: d.lebih3,
      progressPct: d.total ? Math.round((d.sudah / d.total) * 100) : 0,
      lastUpdate: '', // tidak dirender UI; dikosongkan utk hemat query.
    };
  });

  const progressPerSprinter = Object.keys(perSprinter).map((k) => {
    const sp = perSprinter[k];
    return { sprinter: sp.sprinter, total: sp.total, sudah: sp.sudah, progressPct: sp.total ? Math.round((sp.sudah / sp.total) * 100) : 0 };
  });

  return {
    role,
    dropPoint,
    summary: {
      total,
      sudahFeedback: sudah,
      belumFeedback: total - sudah,
      clearTTD,
      belumClearTTD: total - clearTTD,
      progressFeedbackPct: total ? Math.round((sudah / total) * 100) : 0,
      paketTertua,
      paketTertuaWaybill: paketTertuaWb,
      paketLebih3Hari: lebih3,
      progressHariIni,
    },
    distribusiFeedback: Object.keys(distribusi).map((key) => ({ kategori: key, jumlah: distribusi[key] })),
    aging: Object.keys(agingBuckets).map((key) => ({ hari: key, jumlah: agingBuckets[key] })),
    monitoringDp,
    progressPerSprinter,
  };
}

/**
 * Rekam snapshot Dashboard harian (v1.3): scope 'ALL' + tiap DP aktif. Idempotent
 * per hari (upsert (tanggal, scope)), jadi aman dipanggil ulang. Dipanggil cron
 * (~23:55 WIB) atau manual oleh Admin Cabang.
 */
export async function writeDailySnapshot(): Promise<{ tanggal: string; scopes: number }> {
  const tanggal = jakartaTodayIso();
  const rows: { tanggal: string; scope: string; data: DashboardData }[] = [];

  rows.push({ tanggal, scope: 'ALL', data: await computeDashboard(null, 'Admin Cabang', '') });

  const { data: dps, error } = await db()
    .from('master_drop_point')
    .select('kode_dp')
    .eq('status_aktif', true);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  for (const d of (dps ?? []) as { kode_dp: string }[]) {
    const kode = String(d.kode_dp);
    rows.push({ tanggal, scope: kode, data: await computeDashboard(kode, 'Admin DP', kode) });
  }

  const { error: upErr } = await db().from('dashboard_snapshot').upsert(rows, { onConflict: 'tanggal,scope' });
  if (upErr) throw new ApiError('INTERNAL_ERROR', upErr.message);
  return { tanggal, scopes: rows.length };
}

/**
 * Baca Dashboard "keadaan tanggal X" dari snapshot. Scope ditentukan role/DP
 * aktor (Admin DP -> DP-nya; Admin Cabang -> 'ALL' atau DP terpilih). Null bila
 * snapshot tanggal itu belum ada (mis. sebelum fitur aktif). role/dropPoint
 * di-override dari aktor supaya UI konsisten.
 */
export async function getDashboardSnapshot(
  actorEmail: string,
  dateIso: string,
  dp?: string,
): Promise<DashboardData | null> {
  const actor = await requireActor(actorEmail);
  const isCabang = actor.role === 'Admin Cabang';
  let scope = 'ALL';
  if (!isCabang) scope = actor.dropPoint;
  else if (dp && String(dp) !== 'ALL') scope = String(dp);

  const { data, error } = await db()
    .from('dashboard_snapshot')
    .select('data')
    .eq('tanggal', dateIso)
    .eq('scope', scope)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) return null;
  const dd = (data as { data: DashboardData }).data;
  return { ...dd, role: actor.role, dropPoint: actor.dropPoint || '' };
}
