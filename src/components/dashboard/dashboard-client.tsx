'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Package,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { AgingBarChart } from '@/components/charts/aging-bar-chart';
import { FeedbackDonut } from '@/components/charts/feedback-donut';
import { ProgressGauge } from '@/components/charts/progress-gauge';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { PaketPrioritas } from '@/components/dashboard/paket-prioritas';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { DashboardData } from '@/lib/apps-script/dashboard';

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

function pct(part: number, whole: number) {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1).replace('.', ',')}% dari total` : '—';
}

/**
 * Grid kartu ringkasan. Memakai container query (@) supaya jumlah kolom
 * mengikuti lebar area konten, bukan viewport - lihat catatan di (app)/layout.
 * 7 kartu -> maksimal 2 baris saat kontainer >= 48rem.
 */
const STAT_GRID = 'grid grid-cols-1 gap-2 @sm:grid-cols-2 @3xl:grid-cols-4';

function StatSkeleton() {
  return (
    <div className={STAT_GRID}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="bg-muted h-[58px] animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

export function DashboardClient({ title, description }: { title: string; description: string }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  const isCabang = data?.role === 'Admin Cabang';
  const s = data?.summary;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
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
            {/* 7 summary card (PRD Bagian 8), grid 4 kolom -> maks 2 baris.
                Progress Feedback (%) jadi sub-teks kartu "Sudah Feedback". */}
            <div className={STAT_GRID}>
              <StatCard label="Total Paket" value={s.total.toLocaleString('id-ID')} hint="Semua paket" icon={Package} accent="blue" />
              <StatCard
                label="Sudah Feedback"
                value={s.sudahFeedback.toLocaleString('id-ID')}
                hint={`${s.progressFeedbackPct}% progress`}
                icon={TrendingUp}
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
                label="Clear TTD"
                value={s.clearTTD.toLocaleString('id-ID')}
                hint={pct(s.clearTTD, s.total)}
                icon={CheckCircle2}
                accent="green"
              />
              <StatCard
                label="Belum Clear TTD"
                value={s.belumClearTTD.toLocaleString('id-ID')}
                hint={pct(s.belumClearTTD, s.total)}
                icon={Clock}
                accent="amber"
              />
              <StatCard
                label="Paket > 3 Hari"
                value={s.paketLebih3Hari.toLocaleString('id-ID')}
                hint="Perlu segera ditindaklanjuti"
                icon={AlertTriangle}
                accent="red"
              />
              <StatCard
                label="Paket Tertua"
                value={s.paketTertua ? `${s.paketTertua} Hari` : '—'}
                hint={s.paketTertuaWaybill ? `Waybill: ${s.paketTertuaWaybill}` : undefined}
                icon={CalendarClock}
                accent="rose"
                valueClassName={s.paketTertua >= 3 ? 'text-aging-3-fg' : undefined}
              />
            </div>

            {/* Chart. "Progress Hari Ini" hanya untuk Admin DP (PRD Bagian 8);
                Admin Cabang memakai Progress Feedback (%) di kartu. */}
            <div className={cn('grid gap-2.5', isCabang ? '@3xl:grid-cols-2' : '@3xl:grid-cols-2 @6xl:grid-cols-3')}>
              <SectionCard
                title="Statistik Aging (Belum Clear TTD)"
                description="Umur paket yang masih harus ditindaklanjuti."
              >
                <AgingBarChart data={data.aging} />
              </SectionCard>

              <SectionCard title="Distribusi Feedback" description="Status terkini per paket.">
                <FeedbackDonut data={data.distribusiFeedback} />
              </SectionCard>

              {!isCabang && (
                <SectionCard title="Progress Hari Ini" description="Paket yang di-follow-up hari ini.">
                  <ProgressGauge value={s.progressHariIni} total={s.total} />
                </SectionCard>
              )}
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

                <SectionCard title="Progress per Sprinter Delivery" bodyClassName="px-0 pb-0">
                  <div className="max-h-[210px] overflow-auto">
                    <Table className="text-xs">
                      <TableHeader className="bg-muted/60 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="h-8 px-3">Sprinter</TableHead>
                          <TableHead className="h-8 px-2 text-right">Total</TableHead>
                          <TableHead className="h-8 px-2 text-right">Sudah</TableHead>
                          <TableHead className="h-8 w-28 px-2">Progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.progressPerSprinter.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                              Belum ada data Sprinter.
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.progressPerSprinter.map((p) => (
                            <TableRow key={p.sprinter}>
                              <TableCell className="px-3 py-1.5 font-medium">{p.sprinter}</TableCell>
                              <TableCell className="px-2 py-1.5 text-right tabular-nums">{p.total}</TableCell>
                              <TableCell className="px-2 py-1.5 text-right tabular-nums">{p.sudah}</TableCell>
                              <TableCell className="px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                                    <div
                                      className="bg-accent-blue h-full rounded-full"
                                      style={{ width: `${p.progressPct}%` }}
                                    />
                                  </div>
                                  <span className="shrink-0 font-medium tabular-nums">{p.progressPct}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </SectionCard>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
