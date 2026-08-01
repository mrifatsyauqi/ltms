'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Package, RefreshCw } from 'lucide-react';
import { AgingBarChart } from '@/components/charts/aging-bar-chart';
import { FeedbackDonut } from '@/components/charts/feedback-donut';
import { ProgressGauge } from '@/components/charts/progress-gauge';
import { Pkt3HariChart, Pkt3HariSummary } from '@/components/charts/pkt3hari-chart';
import { SectionCard } from '@/components/layout/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DashboardData } from '@/lib/data/dashboard';

async function fetchPublicDashboard(token: string): Promise<DashboardData> {
  const res = await fetch(`/api/public/${token}/dashboard`);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as DashboardData;
}

function pct(part: number, whole: number) {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1).replace('.', ',')}% dari total` : '—';
}

const STAT_GRID = 'grid grid-cols-1 gap-2 @sm:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5';

/**
 * Versi publik/read-only dari DashboardClient - SELALU "Semua DP" (tak ada
 * dropdown Cakupan, terkunci), tanpa AgingAlert (linknya ke /feedback
 * internal - tak boleh ada di sini), tanpa "Keadaan tanggal" (snapshot
 * historis, di luar cakupan fitur ini), tanpa PaketPrioritas/BreakdownAlasan/
 * AgingPrioritas (widget mode Admin DP/DP-spesifik yg tak pernah aktif di
 * sini, dan masing2 fetch dari endpoint internal ber-auth). Satu2nya aksi:
 * Refresh manual.
 */
export function PublicDashboardClient({ token }: { token: string }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['public-dashboard', token],
    queryFn: () => fetchPublicDashboard(token),
  });
  const s = data?.summary;

  return (
    <div className="space-y-2.5" aria-busy={isLoading}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h1 className="text-base leading-tight font-semibold tracking-tight">Dashboard — Semua Drop Point</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">Ringkasan real-time, hanya lihat.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
          <span className="sr-only sm:not-sr-only">Refresh</span>
        </Button>
      </div>

      {isLoading && (
        <div className={STAT_GRID}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted h-[58px] animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-xl border p-4">
          <p className="text-destructive text-sm font-medium">Gagal memuat data</p>
          <p className="text-muted-foreground mt-1 text-xs">{(error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Coba lagi
          </Button>
        </div>
      )}

      {data && s && (
        <>
          <div className={STAT_GRID}>
            <StatCard label="Total Paket" value={s.total.toLocaleString('id-ID')} hint="Semua paket" icon={Package} accent="blue" />
            <StatCard
              label="Belum Clear TTD"
              value={s.belumClearTTD.toLocaleString('id-ID')}
              hint={pct(s.belumClearTTD, s.total)}
              icon={Clock}
              accent="amber"
            />
            <StatCard
              label="Sudah Clear TTD"
              value={s.clearTTD.toLocaleString('id-ID')}
              hint={pct(s.clearTTD, s.total)}
              icon={CheckCircle2}
              accent="green"
            />
            <StatCard
              label="Belum Feedback"
              value={s.belumFeedback.toLocaleString('id-ID')}
              hint={pct(s.belumFeedback, s.total)}
              icon={ClipboardCheck}
              accent="violet"
            />
            <StatCard
              label="Paket > 3 Hari"
              value={s.paketLebih3Hari.toLocaleString('id-ID')}
              hint={
                s.paketTertua
                  ? `Tertua ${s.paketTertua} Hari${s.paketTertuaWaybill ? ` · ${s.paketTertuaWaybill}` : ''}`
                  : 'Tidak ada paket tertunggak'
              }
              icon={AlertTriangle}
              accent="red"
              valueClassName={s.paketLebih3Hari > 0 ? 'text-aging-3-fg' : undefined}
            />
          </div>

          <div className="grid gap-2.5 @2xl:grid-cols-2 @4xl:grid-cols-3">
            <SectionCard title="Statistik Aging (Belum Clear TTD)" description="Umur paket yang masih harus ditindaklanjuti.">
              <AgingBarChart data={data.aging} />
            </SectionCard>

            <SectionCard title="Distribusi Feedback" description="Status terkini per paket.">
              <FeedbackDonut data={data.distribusiFeedback} />
            </SectionCard>

            <SectionCard
              title="Progress Hari Ini"
              description="Paket yang di-follow-up hari ini."
              className="@2xl:col-span-2 @4xl:col-span-1"
            >
              <ProgressGauge
                value={s.progressHariIni}
                total={s.total}
                secondary={`Sudah feedback keseluruhan: ${s.sudahFeedback.toLocaleString('id-ID')} dari ${s.total.toLocaleString('id-ID')} (${s.progressFeedbackPct}%)`}
              />
            </SectionCard>
          </div>

          <div className="grid gap-2.5 @3xl:grid-cols-2">
            <SectionCard title="Progress per Drop Point" bodyClassName="px-0 pb-0 h-full flex flex-col">
              <div className="flex-1 overflow-auto">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/60 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="h-8 px-3">DP</TableHead>
                      <TableHead className="h-8 px-2 text-right">Total</TableHead>
                      <TableHead className="h-8 px-2 text-right">Sudah (Total)</TableHead>
                      <TableHead className="h-8 px-2 text-right">&gt;3 Hr</TableHead>
                      <TableHead className="h-8 w-28 px-2">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.monitoringDp.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                          Belum ada data Drop Point.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.monitoringDp.map((d) => (
                        <TableRow key={d.dp}>
                          <TableCell className="px-3 py-1.5 font-medium">{d.dp}</TableCell>
                          <TableCell className="px-2 py-1.5 text-right tabular-nums">{d.total}</TableCell>
                          <TableCell className="px-2 py-1.5 text-right tabular-nums">{d.sudah}</TableCell>
                          <TableCell className="px-2 py-1.5 text-right tabular-nums">
                            {d.lebih3 > 0 ? (
                              <span className="bg-aging-3 text-aging-3-fg rounded px-1.5 py-0.5 font-medium">{d.lebih3}</span>
                            ) : (
                              0
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                                <div className="bg-accent-green h-full rounded-full" style={{ width: `${d.progressPct}%` }} />
                              </div>
                              <span className="shrink-0 font-medium tabular-nums">{d.progressPct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>

            <SectionCard title="Persentase Paket >3 Hari" description="Per Drop Point." bodyClassName="px-0 pb-0">
              <Pkt3HariSummary total={s.total} lebih3={s.paketLebih3Hari} />
              {/* onSelectDp SENGAJA tak diisi - cakupan publik terkunci "Semua DP", chart tak boleh jadi cara memfilter ke 1 DP. */}
              <Pkt3HariChart data={data.monitoringDp} />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
