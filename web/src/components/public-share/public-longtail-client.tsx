'use client';

import { useMemo, useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SelectFilter } from '@/components/ui/select-filter';
import { TablePager } from '@/components/ui/table-pager';
import { TruncatedText } from '@/components/ui/truncated-text';
import { AGING_ROW_CLASS, AGING_STICKY_BG, AgingBadge, agingLevel } from '@/components/ui/aging-badge';
import { cn } from '@/lib/utils';
import { formatWaktuSampai, umurValue } from '@/lib/feedback-format';
import type { LongTailRow } from '@/lib/data/longtail';

async function fetchPublicLongtail(token: string): Promise<LongTailRow[]> {
  const res = await fetch(`/api/public/${token}/longtail`);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as LongTailRow[];
}

const STICKY_POS: Record<string, string> = {
  waybill: 'sticky left-0 z-10',
};

/**
 * Versi publik/read-only dari FeedbackTable - SEMUA kolom sama seperti
 * internal (termasuk Sprinter Delivery apa adanya, tanpa masking) KECUALI:
 * Feedback jadi teks biasa (bukan <FeedbackCell> interaktif), kolom Aksi
 * (ikon riwayat) dihapus total. Tidak ada mutation/submit sama sekali -
 * karena itu tidak butuh mekanisme sort-freeze/pagination-controlled dari
 * FeedbackTable internal (Masalah 1/3 fix di sana ada krn ada patch cache
 * lokal dari submit; di sini data HANYA pernah berubah lewat refetch asli).
 * Cakupan selalu "Semua DP" - tak ada dropdown Cakupan.
 */
export function PublicLongtailClient({ token }: { token: string }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['public-longtail', token],
    queryFn: () => fetchPublicLongtail(token),
  });

  const [sorting, setSorting] = useState<SortingState>([{ id: 'umur', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [umurFilter, setUmurFilter] = useState('');
  const [alasanFilter, setAlasanFilter] = useState('');
  const [sprinterFilter, setSprinterFilter] = useState('');
  const [onlyBelum, setOnlyBelum] = useState(false);

  const rows = useMemo(() => data ?? [], [data]);

  const sprinterOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => String(r['Sprinter Delivery']).trim()).filter(Boolean))).sort(),
    [rows],
  );
  const alasanOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => String(r['Alasan Paket Bermasalah']).trim()).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (alasanFilter && String(r['Alasan Paket Bermasalah']).trim() !== alasanFilter) return false;
      if (sprinterFilter && String(r['Sprinter Delivery']).trim() !== sprinterFilter) return false;
      if (onlyBelum && String(r.Feedback ?? '').trim() !== '') return false;
      if (umurFilter === 'clear') {
        if (!r.__isClearTTD) return false;
      } else if (umurFilter) {
        if (r.__isClearTTD) return false;
        const lvl = agingLevel(umurValue(r));
        if (String(lvl) !== umurFilter) return false;
      }
      return true;
    });
  }, [rows, alasanFilter, sprinterFilter, onlyBelum, umurFilter]);

  const columns = useMemo<ColumnDef<LongTailRow>[]>(
    () => [
      {
        id: 'waybill',
        header: 'No. Waybill',
        accessorFn: (r) => r['No. Waybill'],
        cell: (c) => <span className="text-[11px] tabular-nums">{c.getValue<string>()}</span>,
      },
      {
        id: 'umur',
        header: 'Umur',
        accessorFn: (r) => umurValue(r),
        cell: (c) => <AgingBadge umur={umurValue(c.row.original)} frozen={c.row.original.__isClearTTD} />,
      },
      {
        accessorKey: 'Status Terakhir',
        header: 'Status Terakhir',
        cell: (c) => <TruncatedText text={c.getValue<string>()} />,
      },
      {
        accessorKey: 'Alasan Paket Bermasalah',
        header: 'Alasan Bermasalah',
        cell: (c) => <TruncatedText text={c.getValue<string>()} />,
      },
      { accessorKey: 'DP Sampai', header: 'DP' },
      {
        accessorKey: 'Waktu Sampai',
        header: 'Waktu Sampai',
        cell: (c) => <span className="whitespace-nowrap">{formatWaktuSampai(c.getValue<string>())}</span>,
      },
      {
        accessorKey: 'Sprinter Delivery',
        header: 'Sprinter',
        cell: (c) => <TruncatedText text={c.getValue<string>()} />,
      },
      { accessorKey: 'COD', header: 'COD' },
      { accessorKey: 'Delivery Attempt', header: 'Attempt' },
      {
        accessorKey: 'Feedback',
        header: 'Feedback',
        // TEKS BIASA - bukan dropdown/input interaktif, tidak bisa diklik/diubah.
        cell: (c) => {
          const v = c.getValue<string>();
          return v ? <span className="line-clamp-1">{v}</span> : <span className="text-muted-foreground italic">Belum ada</span>;
        },
      },
      // TIDAK ADA kolom Aksi (ikon riwayat) - dihapus seluruhnya di versi publik ini.
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  if (isLoading) {
    return (
      <div className="space-y-1.5" aria-busy="true" aria-label="Memuat data Long Tail">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted h-8 animate-pulse rounded" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
        <p className="text-destructive text-xs font-medium">Gagal memuat data Long Tail</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div>
        <h1 className="text-base leading-tight font-semibold tracking-tight">Data Long Tail — Semua Drop Point</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">Real-time, hanya lihat.</p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
          <Input
            placeholder="Cari waybill / status / alasan / sprinter…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 w-72 pl-7 text-xs"
          />
        </div>
        <SelectFilter
          label="Filter umur"
          value={umurFilter}
          onChange={setUmurFilter}
          options={[
            { value: '', label: 'Semua Umur' },
            { value: '1', label: '1 Hari' },
            { value: '2', label: '2 Hari' },
            { value: '3', label: '≥ 3 Hari' },
            { value: '0', label: 'Baru sampai (0 hari)' },
            { value: 'clear', label: 'Clear TTD' },
          ]}
        />
        <SelectFilter
          label="Filter alasan bermasalah"
          value={alasanFilter}
          onChange={setAlasanFilter}
          options={[{ value: '', label: 'Semua Alasan' }, ...alasanOptions.map((a) => ({ value: a, label: a }))]}
        />
        <SelectFilter
          label="Filter sprinter"
          value={sprinterFilter}
          onChange={setSprinterFilter}
          options={[{ value: '', label: 'Semua Sprinter' }, ...sprinterOptions.map((s) => ({ value: s, label: s }))]}
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={onlyBelum} onChange={(e) => setOnlyBelum(e.target.checked)} />
          Belum feedback saja
        </label>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
          <span className="sr-only sm:not-sr-only">Refresh</span>
        </Button>
      </div>

      {/* Area tabel scroll (flex-1) -> pagination di bawah selalu terlihat */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sticky = STICKY_POS[h.column.id];
                  return (
                    <th
                      key={h.id}
                      className={cn(
                        'bg-muted text-muted-foreground h-7 border-b px-2 text-left font-medium whitespace-nowrap',
                        h.column.getCanSort() && 'cursor-pointer select-none',
                        sticky && `${sticky} !z-30`,
                      )}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => {
              const row = r.original;
              const level = agingLevel(umurValue(row), row.__isClearTTD);
              const stickyBg = AGING_STICKY_BG[level];
              return (
                <tr key={row['No. Waybill']} className={cn('border-b', AGING_ROW_CLASS[level])}>
                  {r.getVisibleCells().map((cell) => {
                    const sticky = STICKY_POS[cell.column.id];
                    return (
                      <td
                        key={cell.id}
                        className={cn('px-2 py-0.5 align-middle', sticky && `${sticky} ${stickyBg}`)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-muted-foreground py-10 text-center">
                  Tidak ada paket yang cocok dengan filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <TablePager
        pageIndex={table.getState().pagination.pageIndex}
        pageCount={table.getPageCount()}
        onGoto={(i) => table.setPageIndex(i)}
        canPrev={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        totalRows={table.getFilteredRowModel().rows.length}
        pageSize={table.getState().pagination.pageSize}
        onPageSizeChange={(n) => table.setPageSize(n)}
        pageSizeOptions={[10, 20, 30, 40, 50, 100]}
      />
    </div>
  );
}
