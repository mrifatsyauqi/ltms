'use client';

import { useMemo, useRef, useState } from 'react';
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
import { toast } from 'sonner';
import { History, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SelectFilter } from '@/components/ui/select-filter';
import { TablePager } from '@/components/ui/table-pager';
import { AGING_ROW_CLASS, AGING_STICKY_BG, AgingBadge, agingLevel } from '@/components/ui/aging-badge';
import { cn } from '@/lib/utils';
import type { LongTailRow } from '@/lib/apps-script/longtail';
import { formatWaktuSampai, umurValue } from '@/lib/feedback-format';
import {
  useFeedbackOptions,
  useLongTail,
  useSubmitFeedback,
  type SubmitFeedbackError,
} from './feedback-hooks';
import { FeedbackCell } from './feedback-cell';

const OPTIONS_LIST_ID = 'feedback-options';

/** Kolom mana yang di-pin & ke sisi mana (offset kanan disetel via kelas). */
const STICKY_POS: Record<string, string> = {
  waybill: 'sticky left-0 z-10',
  feedback: 'sticky right-12 z-10',
  aksi: 'sticky right-0 z-10',
};

function logLines(row: LongTailRow): string[] {
  return String(row['Log Feedback'] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function ringkasanAging(rows: LongTailRow[]) {
  const acc = { 1: 0, 2: 0, 3: 0, total: 0 };
  for (const r of rows) {
    if (r.__isClearTTD) continue;
    acc.total++;
    const lvl = agingLevel(umurValue(r));
    if (lvl === 1) acc[1]++;
    else if (lvl === 2) acc[2]++;
    else if (lvl === 3) acc[3]++;
  }
  return acc;
}

export function FeedbackTable({
  readOnly = false,
  initialUmurFilter = '',
}: {
  readOnly?: boolean;
  /** Preset filter umur dari URL, mis. dari alert Notifikasi Aging (?umur=3). */
  initialUmurFilter?: string;
}) {
  const { data, isLoading, error } = useLongTail();
  const options = useFeedbackOptions();
  const submit = useSubmitFeedback();

  const [sorting, setSorting] = useState<SortingState>([{ id: 'umur', desc: true }]); // umur tertua di atas (Bagian 9.1)
  const [globalFilter, setGlobalFilter] = useState('');
  const [dpFilter, setDpFilter] = useState('');
  const [umurFilter, setUmurFilter] = useState(initialUmurFilter);
  const [sprinterFilter, setSprinterFilter] = useState('');
  const [onlyBelum, setOnlyBelum] = useState(false);
  const [historyRow, setHistoryRow] = useState<LongTailRow | null>(null);

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [activeWaybill, setActiveWaybill] = useState<string | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  const dpOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => String(r['DP Sampai']).trim()).filter(Boolean))).sort(),
    [rows],
  );
  const sprinterOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => String(r['Sprinter Delivery']).trim()).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (dpFilter && String(r['DP Sampai']).trim() !== dpFilter) return false;
      if (sprinterFilter && String(r['Sprinter Delivery']).trim() !== sprinterFilter) return false;
      if (onlyBelum && String(r.Feedback ?? '').trim() !== '') return false;
      if (umurFilter) {
        const lvl = agingLevel(umurValue(r), r.__isClearTTD);
        if (umurFilter === 'clear' && !r.__isClearTTD) return false;
        if (umurFilter !== 'clear' && String(lvl) !== umurFilter) return false;
      }
      return true;
    });
  }, [rows, dpFilter, sprinterFilter, onlyBelum, umurFilter]);

  const aging = useMemo(() => ringkasanAging(rows), [rows]);

  function registerRef(waybill: string, el: HTMLInputElement | null) {
    if (el) inputRefs.current.set(waybill, el);
    else inputRefs.current.delete(waybill);
  }

  function focusNext(currentWaybill: string) {
    const ordered = table.getRowModel().rows.map((r) => r.original['No. Waybill']);
    const idx = ordered.indexOf(currentWaybill);
    for (let i = idx + 1; i < ordered.length; i++) {
      const el = inputRefs.current.get(ordered[i]);
      if (el && !el.disabled) {
        el.focus();
        setActiveWaybill(ordered[i]);
        return;
      }
    }
  }

  function handleCommit(waybill: string, feedback: string, baseVersion: string | undefined) {
    submit.mutate(
      { waybill, feedback, baseVersion },
      {
        onSuccess: (updated) => {
          if (updated.__isClearTTD) toast.success(`${waybill}: Clear TTD — aging dibekukan.`);
          else toast.success(`Feedback tersimpan untuk ${waybill}.`);
        },
        onError: (err: SubmitFeedbackError) => {
          if (err.code === 'VERSION_CONFLICT') {
            toast.warning(`${waybill}: data sudah diubah pihak lain. Baris di-refresh, cek lalu isi ulang.`);
          } else if (err.code === 'ALREADY_CLEAR_TTD') {
            toast.warning(`${waybill}: sudah Clear TTD, feedback dibekukan.`);
          } else {
            toast.error(`Gagal menyimpan ${waybill}: ${err.message}`);
          }
        },
      },
    );
  }

  const columns = useMemo<ColumnDef<LongTailRow>[]>(() => {
    return [
      {
        id: 'waybill',
        header: 'No. Waybill',
        // accessorFn, bukan accessorKey: titik di 'No. Waybill' ditafsirkan
        // TanStack sbg deep path -> undefined.
        accessorFn: (r) => r['No. Waybill'],
        cell: (c) => {
          const r = c.row.original;
          const perluReview = String(r['Perlu Review'] ?? '').trim();
          return (
            <div className="min-w-0">
              <span className="font-mono text-[11px]">{c.getValue<string>()}</span>
              {perluReview && (
                <Badge variant="destructive" className="mt-0.5 block w-fit text-[9px]">
                  Perlu Review
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'umur',
        header: 'Umur',
        accessorFn: (r) => umurValue(r),
        cell: (c) => <AgingBadge umur={umurValue(c.row.original)} frozen={c.row.original.__isClearTTD} />,
      },
      { accessorKey: 'Status Terakhir', header: 'Status Terakhir' },
      { accessorKey: 'Alasan Paket Bermasalah', header: 'Alasan Bermasalah', cell: (c) => c.getValue<string>() || '—' },
      { accessorKey: 'DP Sampai', header: 'DP' },
      {
        accessorKey: 'Waktu Sampai',
        header: 'Waktu Sampai',
        cell: (c) => <span className="whitespace-nowrap">{formatWaktuSampai(c.getValue<string>())}</span>,
      },
      { accessorKey: 'Sprinter Delivery', header: 'Sprinter', cell: (c) => c.getValue<string>() || '—' },
      { accessorKey: 'COD', header: 'COD' },
      { accessorKey: 'Delivery Attempt', header: 'Attempt' },
      {
        id: 'feedback',
        header: 'Feedback',
        cell: (c) => {
          const r = c.row.original;
          const n = logLines(r).length;
          return (
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                {readOnly ? (
                  r.Feedback ? (
                    <span className="line-clamp-1">{r.Feedback}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Belum ada</span>
                  )
                ) : (
                  <FeedbackCell
                    row={r}
                    optionsListId={OPTIONS_LIST_ID}
                    saving={submit.isPending && submit.variables?.waybill === r['No. Waybill']}
                    onCommit={handleCommit}
                    registerRef={registerRef}
                    onEnterNext={focusNext}
                  />
                )}
              </div>
              {n > 1 && (
                <span
                  className="bg-brand-muted text-brand shrink-0 rounded px-1 text-[10px] font-semibold tabular-nums"
                  title={`${n} kali feedback`}
                >
                  {n}×
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'aksi',
        header: 'Aksi',
        cell: (c) => {
          const r = c.row.original;
          const n = logLines(r).length;
          return (
            <button
              type="button"
              onClick={() => setHistoryRow(r)}
              disabled={n === 0}
              title={n === 0 ? 'Belum ada riwayat feedback' : 'Lihat riwayat feedback'}
              aria-label="Lihat riwayat feedback"
              className="hover:bg-muted focus-visible:ring-ring relative inline-flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-30"
            >
              <History className="size-4" aria-hidden />
              {n > 0 && (
                <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold tabular-nums">
                  {n}
                </span>
              )}
            </button>
          );
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit.isPending, submit.variables, readOnly]);

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
            { value: 'clear', label: 'Sudah Clear TTD' },
          ]}
        />
        <SelectFilter
          label="Filter Drop Point"
          value={dpFilter}
          onChange={setDpFilter}
          options={[{ value: '', label: 'Semua DP' }, ...dpOptions.map((dp) => ({ value: dp, label: dp }))]}
        />
        <SelectFilter
          label="Filter sprinter"
          value={sprinterFilter}
          onChange={setSprinterFilter}
          options={[
            { value: '', label: 'Semua Sprinter' },
            ...sprinterOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={onlyBelum} onChange={(e) => setOnlyBelum(e.target.checked)} />
          Belum feedback saja
        </label>
      </div>

      {/* Ringkasan aging - warna konsisten dgn badge & chart */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-[11px] font-medium">Ringkasan Aging (Belum Clear TTD):</span>
        <span className="bg-aging-1 text-aging-1-fg rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
          1 Hari · {aging[1]}
        </span>
        <span className="bg-aging-2 text-aging-2-fg rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
          2 Hari · {aging[2]}
        </span>
        <span className="bg-aging-3 text-aging-3-fg rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
          ≥ 3 Hari · {aging[3]}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
          Total · {aging.total}
        </span>
      </div>

      {/* datalist bersama: favorit dulu lalu master, tetap boleh ketik bebas */}
      {!readOnly && (
        <datalist id={OPTIONS_LIST_ID}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}

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
                        'bg-muted text-muted-foreground h-8 border-b px-2 text-left font-medium whitespace-nowrap',
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
              const active = activeWaybill === row['No. Waybill'];
              const stickyBg = AGING_STICKY_BG[level];
              return (
                <tr
                  key={row['No. Waybill']}
                  data-active={active || undefined}
                  className={cn(
                    'border-b',
                    AGING_ROW_CLASS[level],
                    'data-[active=true]:ring-ring/60 data-[active=true]:ring-1',
                  )}
                >
                  {r.getVisibleCells().map((cell) => {
                    const sticky = STICKY_POS[cell.column.id];
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-2 py-1 align-middle',
                          // Sel sticky butuh latar solid supaya kolom lain tidak
                          // tembus di baliknya saat scroll horizontal.
                          sticky && `${sticky} ${stickyBg}`,
                        )}
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

      {/* Pagination - shrink-0 di bawah area scroll, selalu terlihat */}
      <TablePager
        pageIndex={table.getState().pagination.pageIndex}
        pageCount={table.getPageCount()}
        onGoto={(i) => table.setPageIndex(i)}
        canPrev={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        totalRows={table.getFilteredRowModel().rows.length}
        pageSize={table.getState().pagination.pageSize}
        onPageSizeChange={(n) => table.setPageSize(n)}
      />

      {/* Popup riwayat feedback (gantikan kolom Log Feedback yg bikin baris tinggi) */}
      <Dialog open={!!historyRow} onOpenChange={(o) => !o && setHistoryRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{historyRow?.['No. Waybill']}</DialogTitle>
            <DialogDescription>Riwayat feedback (Log Feedback) untuk waybill ini.</DialogDescription>
          </DialogHeader>
          <ol className="max-h-80 space-y-1.5 overflow-auto">
            {historyRow &&
              logLines(historyRow).map((line, i) => {
                const [tgl, ...rest] = line.split(' : ');
                const isi = rest.join(' : ');
                return (
                  <li key={i} className="border-border flex gap-2 border-b pb-1.5 text-xs last:border-0">
                    <span className="text-muted-foreground shrink-0 tabular-nums">{isi ? tgl : ''}</span>
                    <span>{isi || tgl}</span>
                  </li>
                );
              })}
            {historyRow && logLines(historyRow).length === 0 && (
              <li className="text-muted-foreground text-xs">Belum ada riwayat.</li>
            )}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
