'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectFilter } from '@/components/ui/select-filter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { RiwayatFeedbackRow } from '@/lib/apps-script/riwayat-feedback';

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

/** Preset rentang tanggal; default 7 hari terakhir (permintaan user). */
const PRESETS = [
  { value: '7', label: '7 hari terakhir' },
  { value: '30', label: '30 hari terakhir' },
  { value: '1', label: 'Hari ini' },
  { value: 'custom', label: 'Rentang custom…' },
];

/**
 * Kunci urut presisi detik. `ts` dari backend hanya ber-granularitas hari
 * (dibuat dari kolom Tanggal saja), jadi tanpa ini aktivitas di hari yang sama
 * tidak terurut. Gabungkan Tanggal 'dd/MM/yy' + Jam 'HH:mm:ss'.
 */
function sortKey(r: RiwayatFeedbackRow): number {
  const d = r.tanggal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!d) return r.ts ?? 0;
  const yy = Number(d[3]) < 100 ? 2000 + Number(d[3]) : Number(d[3]);
  const t = r.jam.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  return new Date(
    yy,
    Number(d[2]) - 1,
    Number(d[1]),
    t ? Number(t[1]) : 0,
    t ? Number(t[2]) : 0,
    t && t[3] ? Number(t[3]) : 0,
  ).getTime();
}

async function fetchRiwayat(from: string, to: string): Promise<RiwayatFeedbackRow[]> {
  const res = await fetch(`/api/riwayat-feedback?from=${from}&to=${to}`);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return (body.data as RiwayatFeedbackRow[]).sort((a, b) => sortKey(b) - sortKey(a));
}

function StatusBadge({ status }: { status: string }) {
  const clear = status === 'Clear TTD';
  const hilang = status === 'Tidak ada di LongTail';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        clear && 'bg-aging-1 text-aging-1-fg',
        !clear && !hilang && 'border-aging-2-fg/40 text-aging-2-fg border bg-transparent',
        hilang && 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </span>
  );
}

export function RiwayatFeedbackClient({ isCabang, scope }: { isCabang: boolean; scope: string }) {
  const [preset, setPreset] = useState('7');
  const [customFrom, setCustomFrom] = useState(isoDaysAgo(7));
  const [customTo, setCustomTo] = useState(today());
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { from, to } =
    preset === 'custom'
      ? { from: customFrom, to: customTo }
      : { from: isoDaysAgo(Number(preset) - 1), to: today() };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['riwayat-feedback', from, to],
    queryFn: () => fetchRiwayat(from, to),
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (statusFilter && r.statusTerkini !== statusFilter) return false;
      if (!needle) return true;
      return (
        r.waybill.toLowerCase().includes(needle) ||
        r.feedbackSaatItu.toLowerCase().includes(needle) ||
        r.adminDp.toLowerCase().includes(needle)
      );
    });
  }, [data, q, statusFilter]);

  return (
    <>
      <PageHeader
        title="Riwayat Feedback"
        description={`${scope}. Sumber: catatan aktivitas feedback per waybill.`}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        }
      />

      <div className="space-y-2.5 p-3">
        {/* Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <SelectFilter label="Rentang tanggal" value={preset} onChange={setPreset} options={PRESETS} />

          {preset === 'custom' && (
            <>
              <label className="text-muted-foreground flex items-center gap-1 text-xs">
                Dari
                <Input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 w-[140px] text-xs"
                />
              </label>
              <label className="text-muted-foreground flex items-center gap-1 text-xs">
                s/d
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={today()}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 w-[140px] text-xs"
                />
              </label>
            </>
          )}

          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              placeholder="Cari waybill / feedback / admin…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 w-64 pl-7 text-xs"
            />
          </div>

          <SelectFilter
            label="Filter status terkini"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'Semua Status' },
              { value: 'Clear TTD', label: 'Clear TTD' },
              { value: 'Belum Clear TTD', label: 'Belum Clear TTD' },
            ]}
          />

          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {rows.length} aktivitas · {from} s/d {to}
          </span>
        </div>

        {isLoading && (
          <div className="space-y-1.5" aria-busy="true" aria-label="Memuat riwayat feedback">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-muted h-8 animate-pulse rounded" />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
            <p className="text-destructive text-xs font-medium">Gagal memuat riwayat</p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">{(error as Error).message}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Coba lagi
            </Button>
          </div>
        )}

        {data && (
          <div className="max-h-[calc(100dvh-220px)] overflow-auto rounded-lg border">
            <Table className="text-xs">
              <TableHeader className="bg-muted/60 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="h-8 px-3">No. Waybill</TableHead>
                  <TableHead className="h-8 px-2">Tanggal Aktivitas</TableHead>
                  <TableHead className="h-8 px-2">Feedback Saat Itu</TableHead>
                  <TableHead className="h-8 px-2">Status Terkini</TableHead>
                  {isCabang && <TableHead className="h-8 px-2">DP</TableHead>}
                  <TableHead className="h-8 px-2">Admin DP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isCabang ? 6 : 5} className="text-muted-foreground py-10 text-center">
                      Tidak ada aktivitas feedback pada rentang ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={`${r.waybill}-${r.ts}-${i}`}>
                      <TableCell className="px-3 py-1.5 font-mono text-[11px]">{r.waybill}</TableCell>
                      <TableCell className="px-2 py-1.5 whitespace-nowrap">
                        {r.tanggal} <span className="text-muted-foreground">{r.jam}</span>
                      </TableCell>
                      <TableCell className="px-2 py-1.5">{r.feedbackSaatItu || '—'}</TableCell>
                      <TableCell className="px-2 py-1.5">
                        <StatusBadge status={r.statusTerkini} />
                      </TableCell>
                      {isCabang && <TableCell className="px-2 py-1.5">{r.dp || '—'}</TableCell>}
                      <TableCell className="text-muted-foreground px-2 py-1.5">{r.adminDp || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
