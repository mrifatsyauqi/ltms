import { db } from './client';
import { requireActor, resolveScopedDps } from './helpers';
import { hasFullAccess } from '@/lib/roles';
import { ApiError } from '@/lib/errors';
import {
  categorizeFeedback,
  computeUmur,
  isClearTTD,
  jakartaTodayIso,
  type LongtailDbRow,
} from './longtail-shared';
import type { DashboardData } from '@/lib/data/types';

type DpFilter = string | string[] | null;

/** Ambil baris LongTail ter-scope: Admin DP -> DP-nya; SPV Drop Point -> semua
 *  DP yang disupervisi (array); full access -> semua atau 1 DP (filter CAKUPAN). */
async function fetchScoped(dpFilter: DpFilter): Promise<LongtailDbRow[]> {
  const PAGE = 1000;
  const out: LongtailDbRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db().from('longtail').select('*').order('no_waybill').range(from, from + PAGE - 1);
    if (Array.isArray(dpFilter)) q = q.in('dp_sampai', dpFilter);
    else if (dpFilter) q = q.eq('dp_sampai', dpFilter);
    const { data, error } = await q;
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    const batch = (data ?? []) as LongtailDbRow[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/** Ambil SEMUA baris Activity_Log "Manual Feedback" hari ini (Jakarta) ter-scope
 *  DP - HARUS dipaginasi spt fetchScoped() di atas, krn PostgREST/Supabase
 *  default memotong response unbounded di 1000 baris: kalau total aktivitas
 *  "Manual Feedback" hari ini (system-wide, tanpa filter dp utk full access)
 *  lebih dari 1000, select tanpa .range() diam-diam terpotong -> DP tertentu
 *  bisa under-count parah walau Total (dari fetchScoped, sudah dipaginasi)
 *  tetap benar. Bug nyata yg ditemukan: BATANG01 punya 278 feedback hari ini
 *  tapi cuma 66 yang muncul, krn query lama sekali fetch tanpa batas. */
async function fetchTodayActivityLog(dpFilter: DpFilter, today: string): Promise<{ waybill: string }[]> {
  const PAGE = 1000;
  const out: { waybill: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db()
      .from('activity_log')
      .select('waybill')
      .eq('sumber', 'Manual Feedback')
      .gte('created_at', `${today}T00:00:00+07:00`)
      .lte('created_at', `${today}T23:59:59.999+07:00`)
      .order('id')
      .range(from, from + PAGE - 1);
    if (Array.isArray(dpFilter)) q = q.in('dp', dpFilter);
    else if (dpFilter) q = q.eq('dp', dpFilter);
    const { data, error } = await q;
    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    const batch = (data ?? []) as { waybill: string }[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/**
 * Semua angka dihitung & di-scope server-side (Admin DP hanya DP-nya, SPV
 * Drop Point semua DP yang disupervisi - atau 1 DP tunggal kalau `dp` diisi
 * & tervalidasi ada di daftar yang disupervisinya, lihat SupervisedScopeBox
 * di sidebar). `dp` utk full access: bila diisi (memilih 1 DP di filter
 * CAKUPAN) memfilter ke DP itu tanpa perlu validasi tambahan (sudah bebas
 * DP manapun). Read-only.
 */
export async function getDashboard(actorEmail: string, dp?: string): Promise<DashboardData> {
  const actor = await requireActor(actorEmail);
  const isFullAccess = hasFullAccess(actor.role);

  // Tentukan filter DP efektif.
  let dpFilter: DpFilter = null;
  if (isFullAccess) {
    if (dp && String(dp) !== 'ALL') dpFilter = String(dp);
  } else {
    const scopedDps = await resolveScopedDps(actor);
    // `dp` dari SPV Drop Point HANYA dipakai kalau memang salah satu DP yang
    // disupervisinya sendiri (tervalidasi thd resolveScopedDps, bukan
    // dipercaya mentah2 dari client) - persempit ke 1 DP itu; selain itu
    // (tak diisi/'ALL'/tak valid) tetap agregat SEMUA DP yang disupervisi.
    if (dp && String(dp) !== 'ALL' && scopedDps?.includes(String(dp))) {
      dpFilter = String(dp);
    } else {
      dpFilter = scopedDps;
    }
  }

  return computeDashboard(dpFilter, actor.role, actor.dropPoint || '');
}

/**
 * Dashboard "Semua DP" TANPA auth - dipakai endpoint publik (Link Berbagi
 * Laporan) setelah token divalidasi terpisah. Selalu agregat penuh (dpFilter
 * null), tidak pernah menerima input scope dari luar (link publik terkunci
 * ke "Semua DP", tak ada cara memfilter ke 1 DP dari sini).
 */
export async function getDashboardPublic(): Promise<DashboardData> {
  return computeDashboard(null, 'Admin Cabang', '');
}

/** Inti agregasi Dashboard tanpa auth — dipakai getDashboard (live) & snapshot cron. */
async function computeDashboard(dpFilter: DpFilter, role: string, dropPoint: string): Promise<DashboardData> {
  // Progress Hari Ini: waybill (yang masih ada, ter-scope) dengan Manual Feedback hari ini (Jakarta).
  const today = jakartaTodayIso();

  // fetchScoped() (longtail) & fetchTodayActivityLog() (activity_log) di atas
  // SALING INDEPENDEN (activity_log tak butuh hasil longtail sama sekali,
  // baru digabung lewat currentWb SETELAH loop di bawah) -> jalankan
  // BERSAMAAN, bukan menunggu satu selesai baru mulai yang lain. Urutan
  // pemrosesan `rows` di loop bawah TIDAK berubah sama sekali (masih
  // sequential, masih urutan yg sama dari fetchScoped) - yang paralel murni
  // fetch-nya. Keduanya sudah dipaginasi masing-masing (lihat komentar
  // fetchTodayActivityLog).
  const [rows, alData] = await Promise.all([fetchScoped(dpFilter), fetchTodayActivityLog(dpFilter, today)]);

  const total = rows.length;
  let sudah = 0, clearTTD = 0, lebih3 = 0, paketTertua = 0, paketTertuaWb = '';
  const distribusi: Record<string, number> = {
    'Clear TTD': 0, 'On Delivery': 0, 'Reschedule': 0, 'Penerima Tidak Di Tempat': 0,
    'Alamat Tidak Ditemukan': 0, 'Lainnya': 0, 'Belum Feedback': 0,
  };
  const agingBuckets: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7+': 0 };
  const perDp: Record<string, { dp: string; total: number; clearTTD: number; lebih3: number }> = {};
  const perSprinter: Record<string, { sprinter: string; total: number; sudah: number }> = {};

  const currentWb = new Set<string>();
  const wbToDpKey: Record<string, string> = {};

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
    if (!perDp[dpKey]) perDp[dpKey] = { dp: dpKey, total: 0, clearTTD: 0, lebih3: 0 };
    perDp[dpKey].total++;
    if (isTTD) perDp[dpKey].clearTTD++;
    if (!isTTD && umurNum != null && umurNum >= 3) perDp[dpKey].lebih3++;

    const sp = String(r.sprinter_delivery ?? '').trim() || '(kosong)';
    if (!perSprinter[sp]) perSprinter[sp] = { sprinter: sp, total: 0, sudah: 0 };
    perSprinter[sp].total++;
    if (fb !== '') perSprinter[sp].sudah++;

    const wb = String(r.no_waybill ?? '').trim().toLowerCase();
    currentWb.add(wb);
    wbToDpKey[wb] = dpKey;
  }

  // "Sudah" per DP di tabel Progress per Drop Point HARUS pakai definisi yang
  // SAMA dgn gauge "Progress Hari Ini" di atasnya (activity_log hari ini,
  // bukan status feedback longtail saat ini yg cumulative). Dikelompokkan
  // per DP SAAT INI milik waybill itu (wbToDpKey, sama dgn key yg dipakai
  // perDp/total/clearTTD/lebih3) - BUKAN dp yg tercatat di activity_log saat
  // event terjadi - supaya tiap waybill hari ini selalu jatuh ke key yg
  // sudah pasti ada di perDp, dan total across-DP selalu sama persis dgn
  // progressHariIni (invariant yg diminta), termasuk kasus waybill sempat
  // berpindah DP sejak event dicatat.
  const todayWb = new Set<string>();
  const perDpTodayWb: Record<string, Set<string>> = {};
  alData.forEach((a) => {
    const k = String(a.waybill ?? '').trim().toLowerCase();
    if (!currentWb.has(k)) return;
    todayWb.add(k);
    const dpKey = wbToDpKey[k];
    if (!perDpTodayWb[dpKey]) perDpTodayWb[dpKey] = new Set<string>();
    perDpTodayWb[dpKey].add(k);
  });
  const progressHariIni = todayWb.size;

  const monitoringDp = Object.keys(perDp).map((k) => {
    const d = perDp[k];
    const sudah = perDpTodayWb[k]?.size ?? 0;
    return {
      dp: d.dp,
      total: d.total,
      sudah,
      belum: d.total - sudah,
      clearTTD: d.clearTTD,
      lebih3: d.lebih3,
      progressPct: d.total ? Math.round((sudah / d.total) * 100) : 0,
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
 * aktor (Admin DP -> DP-nya; full access -> 'ALL' atau DP terpilih). Null bila
 * snapshot tanggal itu belum ada (mis. sebelum fitur aktif). role/dropPoint
 * di-override dari aktor supaya UI konsisten.
 *
 * Snapshot harian (writeDailySnapshot) granularitasnya per-DP TUNGGAL ('ALL'
 * + 1 baris/DP aktif) - belum ada agregat historis multi-DP. SPV Drop Point
 * BISA lihat snapshot kalau: disupervisi TEPAT 1 DP (jalur sama dgn Admin
 * DP), ATAU mempersempit sendiri ke 1 DP lewat `dp` (tervalidasi thd
 * resolveScopedDps - lihat getDashboard, pola sama). Kalau masih "Semua DP
 * Disupervisi" (agregat, >1 DP, tanpa `dp` valid) sengaja pulang null (bukan
 * menggabungkan angka snapshot per-DP secara serampangan - beberapa field
 * spt progress% & paket tertua tidak valid kalau cuma dijumlah). Dashboard
 * LIVE (getDashboard, bukan fungsi ini) sudah benar mengagregasi real-time
 * utk SPV multi-DP - keterbatasan ini CUMA di fitur "keadaan tanggal X".
 */
export async function getDashboardSnapshot(
  actorEmail: string,
  dateIso: string,
  dp?: string,
): Promise<DashboardData | null> {
  const actor = await requireActor(actorEmail);
  const isFullAccess = hasFullAccess(actor.role);
  let scope = 'ALL';
  if (isFullAccess) {
    if (dp && String(dp) !== 'ALL') scope = String(dp);
  } else {
    const scopedDps = await resolveScopedDps(actor);
    if (dp && String(dp) !== 'ALL' && scopedDps?.includes(String(dp))) {
      scope = String(dp);
    } else if (scopedDps && scopedDps.length === 1) {
      scope = scopedDps[0];
    } else {
      return null;
    }
  }

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
