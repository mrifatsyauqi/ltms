'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Package,
  RefreshCw,
} from 'lucide-react';
import { AgingBarChart } from '@/components/charts/aging-bar-chart';
import { FeedbackDonut } from '@/components/charts/feedback-donut';
import { ProgressGauge } from '@/components/charts/progress-gauge';
import { Pkt3HariChart, Pkt3HariSummary } from '@/components/charts/pkt3hari-chart';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { PaketPrioritas } from '@/components/dashboard/paket-prioritas';
import { AgingAlert } from '@/components/dashboard/aging-alert';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ALL_SCOPE, useDashboardScope } from '@/components/dashboard/scope-context';
import type { DashboardData } from '@/lib/apps-script/dashboard';

async function fetchDashboard(scope: string): Promise<DashboardData> {
  // Mode "Semua DP" memanggil endpoint tanpa query -> identik dgn perilaku lama.
  const url = scope && scope !== ALL_SCOPE ? `/api/dashboard?dp=${encodeURIComponent(scope)}` : '/api/dashboard';
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

function pct(part: number, whole: number) {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1).replace('.', ',')}% dari total` : '—';
}

/**
 * Grid kartu ringkasan: 5 kolom dalam SATU baris di layar lebar.
 * Memakai container query (@) supaya jumlah kolom mengikuti lebar area konten,
 * bukan viewport - lihat catatan di (app)/layout.
 */
const STAT_GRID = 'grid grid-cols-1 gap-2 @sm:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5';

function StatSkeleton() {
  return (
    <div className={STAT_GRID}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-muted h-[58px] animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

export function DashboardClient({ title, description }: { title: string; description: string }) {
  const { scope, setScope } = useDashboardScope();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    // scope masuk queryKey: ganti filter -> refetch otomatis; Refresh tetap
    // menyegarkan scope yang sedang aktif.
    queryKey: ['dashboard', scope],
    queryFn: () => fetchDashboard(scope),
  });

  const isCabang = data?.role === 'Admin Cabang';
  const s = data?.summary;

  // Mode DP Spesifik = Admin Cabang memfilter ke 1 DP lewat CAKUPAN.
  const dpFilter = isCabang && scope !== ALL_SCOPE ? scope : undefined;
  const effectiveDescription = dpFilter ? `Ringkasan Drop Point ${dpFilter}.` : description;

  return (
    <>
      <PageHeader
        title={title}
        description={effectiveDescription}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        }
      />

      <div className="space-y-2.5 p-3" aria-busy={isLoading}>
        {isLoading && <StatSkeleton />}

        {error && (
          <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-xl border p-4">
            <p className="text-destructive text-sm font-medium">Gagal memuat dashboard</p>
            <p className="text-muted-foreground mt-1 text-xs">{(error as Error).message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Coba lagi
            </Button>
          </div>
        )}

        {data && s && (
          <>
            {/* Notifikasi Aging (Fase 7 / Bagian 9.3): tampil di paling atas
                bila ada paket >= 3 hari belum Clear TTD. */}
            <AgingAlert count={s.paketLebih3Hari} isCabang={!!isCabang} dpLabel={dpFilter} />

            {/* 5 summary card dalam satu baris. Kartu ke-5 menggabungkan dua
                metrik urgensi (Paket > 3 Hari + Paket Tertua). Kartu "Sudah
                Feedback" dipindah jadi progress arc di samping donut. */}
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

            {/* Aging | Distribusi Feedback | Progress (arc) - 3 panel sejajar.
                Arc menggantikan kartu "Sudah Feedback" yang dihapus, dan tetap
                membawa angka progress feedback keseluruhan di baris bawahnya
                supaya metrik PRD Bagian 8 tidak hilang. */}
            <div className="grid gap-2.5 @2xl:grid-cols-2 @4xl:grid-cols-3">
              <SectionCard
                title="Statistik Aging (Belum Clear TTD)"
                description="Umur paket yang masih harus ditindaklanjuti."
              >
                <AgingBarChart data={data.aging} />
              </SectionCard>

              <SectionCard title="Distribusi Feedback" description="Status terkini per paket.">
                <FeedbackDonut data={data.distribusiFeedback} />
              </SectionCard>

              <SectionCard
                title="Progress Hari Ini"
                description="Paket yang di-follow-up hari ini."
                // Saat layout jatuh ke 2 kolom (kontainer sempit), panel ke-3
                // melebar penuh supaya tidak menggantung sendirian.
                className="@2xl:col-span-2 @4xl:col-span-1"
              >
                <ProgressGauge
                  value={s.progressHariIni}
                  total={s.total}
                  secondary={`Sudah feedback keseluruhan: ${s.sudahFeedback.toLocaleString('id-ID')} dari ${s.total.toLocaleString('id-ID')} (${s.progressFeedbackPct}%)`}
                />
              </SectionCard>
            </div>

            {/* Admin DP: preview paket paling mendesak (read-only). Admin Cabang
                memakai tabel Progress per DP/Sprinter di bawah. */}
            {!isCabang && <PaketPrioritas />}

            {/* Progress per DP & per Sprinter - Admin Cabang saja */}
            {isCabang && (
              <div className="grid gap-2.5 @3xl:grid-cols-2">
                <SectionCard title="Progress per Drop Point" bodyClassName="px-0 pb-0">
                  <div className="max-h-[210px] overflow-auto">
                    <Table className="text-xs">
                      <TableHeader className="bg-muted/60 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="h-8 px-3">DP</TableHead>
                          <TableHead className="h-8 px-2 text-right">Total</TableHead>
                          <TableHead className="h-8 px-2 text-right">Sudah</TableHead>
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
                                  <span className="bg-aging-3 text-aging-3-fg rounded px-1.5 py-0.5 font-medium">
                                    {d.lebih3}
                                  </span>
                                ) : (
                                  0
                                )}
                              </TableCell>
                              <TableCell className="px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                                    <div
                                      className="bg-accent-green h-full rounded-full"
                                      style={{ width: `${d.progressPct}%` }}
                                    />
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

                <SectionCard
                  title="Persentase Paket >3 Hari"
                  description="Per Drop Point. Klik satu DP untuk memfilter dashboard ke DP itu."
                  bodyClassName="px-0 pb-0"
                >
                  <Pkt3HariSummary total={s.total} lebih3={s.paketLebih3Hari} />
                  <Pkt3HariChart data={data.monitoringDp} onSelectDp={setScope} />
                </SectionCard>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
