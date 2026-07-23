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
import { Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SelectFilter } from '@/components/ui/select-filter';
import { AGING_ROW_CLASS, AgingBadge, agingLevel } from '@/components/ui/aging-badge';
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

/** Ringkasan jumlah paket belum Clear TTD per tingkat aging. */
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

export function FeedbackTable({ readOnly = false }: { readOnly?: boolean }) {
  const { data, isLoading, error } = useLongTail();
  const options = useFeedbackOptions();
  const submit = useSubmitFeedback();

  const [sorting, setSorting] = useState<SortingState>([{ id: 'umur', desc: true }]); // umur tertua di atas (Bagian 9.1)
  const [globalFilter, setGlobalFilter] = useState('');
  const [dpFilter, setDpFilter] = useState('');
  const [umurFilter, setUmurFilter] = useState('');
  const [sprinterFilter, setSprinterFilter] = useState('');
  const [onlyBelum, setOnlyBelum] = useState(false);

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
    const base: ColumnDef<LongTailRow>[] = [
      {
        id: 'waybill',
        header: 'No. Waybill',
        // accessorFn, bukan accessorKey: TanStack menafsirkan titik di
        // 'No. Waybill' sebagai deep path (row['No'][' Waybill']) -> undefined.
        accessorFn: (r) => r['No. Waybill'],
        cell: (c) => <span className="font-mono text-[11px]">{c.getValue<string>()}</span>,
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
        cell: (c) =>
          readOnly ? (
            c.row.original.Feedback ? (
              <span>{c.row.original.Feedback}</span>
            ) : (
              <span className="text-muted-foreground italic">Belum ada</span>
            )
          ) : (
            <FeedbackCell
              row={c.row.original}
              optionsListId={OPTIONS_LIST_ID}
              saving={submit.isPending && submit.variables?.waybill === c.row.original['No. Waybill']}
              onCommit={handleCommit}
              registerRef={registerRef}
              onEnterNext={focusNext}
            />
          ),
      },
      {
        accessorKey: 'Log Feedback',
        header: 'Log Feedback',
        cell: (c) => (
          <pre className="text-muted-foreground max-w-48 text-[11px] leading-tight whitespace-pre-wrap">
            {c.getValue<string>()}
          </pre>
        ),
      },
      {
        id: 'review',
        header: 'Review',
        cell: (c) =>
          String(c.row.original['Perlu Review'] ?? '').trim() ? (
            <Badge variant="destructive" className="text-[10px]">
              Perlu Review
            </Badge>
          ) : null,
      },
    ];
    return base;
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
    initialState: { pagination: { pageSize: 25 } },
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
    <div className="space-y-2.5">
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
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {table.getFilteredRowModel().rows.length} baris
        </span>
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

      <div className="max-h-[calc(100dvh-320px)] overflow-auto rounded-lg border">
        <Table className="text-xs">
          <TableHeader className="bg-muted/60 sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className={cn(
                      'h-8 px-2 whitespace-nowrap',
                      h.column.getCanSort() && 'cursor-pointer select-none',
                    )}
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((r) => {
              const row = r.original;
              const level = agingLevel(umurValue(row), row.__isClearTTD);
              const active = activeWaybill === row['No. Waybill'];
              return (
                <TableRow
                  key={row['No. Waybill']}
                  data-active={active || undefined}
                  className={cn(AGING_ROW_CLASS[level], 'data-[active=true]:ring-ring/60 data-[active=true]:ring-1')}
                >
                  {r.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2 py-1 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-muted-foreground py-10 text-center">
                  Tidak ada paket yang cocok dengan filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!readOnly ? (
          <p className="text-muted-foreground text-[11px]">
            Tips: <kbd className="bg-muted rounded px-1">Enter</kbd> simpan &amp; pindah ke baris berikutnya.
          </p>
        ) : (
          <p className="text-muted-foreground text-[11px]">
            Mode lihat data — pengisian feedback ada di menu Feedback Long Tail.
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Sebelumnya
          </Button>
          <span className="text-xs tabular-nums">
            Hal {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  );
}
