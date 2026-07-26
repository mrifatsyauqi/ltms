'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { TruncatedText } from '@/components/ui/truncated-text';
import { CopyButton } from '@/components/ui/copy-button';
import { AGING_ROW_CLASS, AGING_STICKY_BG, AgingBadge, agingLevel } from '@/components/ui/aging-badge';
import { cn } from '@/lib/utils';
import type { LongTailRow } from '@/lib/data/longtail';
import { formatWaktuSampai, umurValue } from '@/lib/feedback-format';
import {
  useFeedbackOptions,
  useLongTail,
  useSubmitFeedback,
  type SubmitFeedbackError,
} from './feedback-hooks';
import { FeedbackCell } from './feedback-cell';

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
  initialDpFilter = '',
}: {
  readOnly?: boolean;
  /** Preset filter umur dari URL, mis. dari alert Notifikasi Aging (?umur=3). */
  initialUmurFilter?: string;
  /** Preset filter DP dari URL, mis. dari 'Lihat semua' Aging Prioritas (?dp=). */
  initialDpFilter?: string;
}) {
  const { data, isLoading, error } = useLongTail();
  const options = useFeedbackOptions();
  const submit = useSubmitFeedback();

  const [sorting, setSorting] = useState<SortingState>([{ id: 'umur', desc: true }]); // umur tertua di atas (Bagian 9.1)
  const [globalFilter, setGlobalFilter] = useState('');
  const [dpFilter, setDpFilter] = useState(initialDpFilter);
  const [umurFilter, setUmurFilter] = useState(initialUmurFilter);
  const [alasanFilter, setAlasanFilter] = useState('');
  const [sprinterFilter, setSprinterFilter] = useState('');
  const [onlyBelum, setOnlyBelum] = useState(false);
  const [historyRow, setHistoryRow] = useState<LongTailRow | null>(null);

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [activeWaybill, setActiveWaybill] = useState<string | null>(null);
  // Input berikutnya yang harus tetap fokus setelah submit (survive re-render
  // akibat setQueryData). Ala spreadsheet: enter/pilih -> lompat & siap ketik.
  const pendingFocusRef = useRef<string | null>(null);

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
      // dpFilter tetap didukung untuk drill-down dari Dashboard (?dp=), tapi
      // dropdown-nya kini diganti filter Alasan Bermasalah (lihat chip di UI).
      if (dpFilter && String(r['DP Sampai']).trim() !== dpFilter) return false;
      if (alasanFilter && String(r['Alasan Paket Bermasalah']).trim() !== alasanFilter) return false;
      if (sprinterFilter && String(r['Sprinter Delivery']).trim() !== sprinterFilter) return false;
      if (onlyBelum && String(r.Feedback ?? '').trim() !== '') return false;
      if (umurFilter) {
        const lvl = agingLevel(umurValue(r), r.__isClearTTD);
        if (umurFilter === 'clear' && !r.__isClearTTD) return false;
        if (umurFilter !== 'clear' && String(lvl) !== umurFilter) return false;
      }
      return true;
    });
  }, [rows, dpFilter, alasanFilter, sprinterFilter, onlyBelum, umurFilter]);

  const aging = useMemo(() => ringkasanAging(rows), [rows]);

  function registerRef(waybill: string, el: HTMLInputElement | null) {
    if (el) inputRefs.current.set(waybill, el);
    else inputRefs.current.delete(waybill);
  }

  function focusNext(currentWaybill: string) {
    pendingFocusRef.current = null;
    const ordered = table.getRowModel().rows.map((r) => r.original['No. Waybill']);
    const idx = ordered.indexOf(currentWaybill);
    for (let i = idx + 1; i < ordered.length; i++) {
      const el = inputRefs.current.get(ordered[i]);
      if (el && !el.disabled) {
        pendingFocusRef.current = ordered[i]; // target fokus yg dipertahankan
        el.focus();
        setActiveWaybill(ordered[i]);
        return;
      }
    }
  }

  // Setelah data ter-update (submit sukses -> setQueryData -> re-render), pastikan
  // fokus tetap di input tujuan supaya user bisa langsung mengetik (tanpa klik).
  // Hanya diterapkan bila fokus benar-benar hilang; kalau user sudah pindah ke
  // input lain secara sadar, jangan direbut.
  useEffect(() => {
    const wb = pendingFocusRef.current;
    if (!wb) return;
    const el = inputRefs.current.get(wb);
    if (!el || el.disabled) return;
    const activeEl = document.activeElement;
    // Hanya kembalikan bila fokus benar-benar hilang (jatuh ke body akibat
    // re-render). Jika masih di el, atau user sengaja pindah ke elemen lain,
    // jangan direbut. TIDAK di-clear: submit memicu DUA re-render (optimistic
    // lalu sukses server) — keduanya harus mempertahankan fokus. Target diganti
    // saat focusNext berikutnya, jadi tak menempel selamanya.
    const focusLost = !activeEl || activeEl === document.body;
    if (focusLost) el.focus();
  }, [rows]);

  function handleCommit(waybill: string, feedback: string, baseVersion: string | undefined) {
    submit.mutate(
      { waybill, feedback, baseVersion },
      {
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
        // Header + tombol salin SEMUA No. Waybill di halaman ini (mengikuti
        // jumlah /laman & halaman aktif). stopPropagation di CopyButton mencegah
        // klik ikut men-toggle sort kolom.
        header: ({ table: t }) => {
          const list = t.getRowModel().rows.map((rr) => rr.original['No. Waybill']).filter(Boolean);
          return (
            <span className="inline-flex items-center gap-1">
              No. Waybill
              <CopyButton
                text={list.join('\n')}
                title={`Salin ${list.length} No. Waybill di halaman ini`}
                successMessage={`${list.length} No. Waybill disalin`}
                className="size-5"
              />
            </span>
          );
        },
        // accessorFn, bukan accessorKey: titik di 'No. Waybill' ditafsirkan
        // TanStack sbg deep path -> undefined.
        accessorFn: (r) => r['No. Waybill'],
        cell: (c) => {
          const r = c.row.original;
          const wb = c.getValue<string>();
          const perluReview = String(r['Perlu Review'] ?? '').trim();
          return (
            <div className="min-w-0">
              {/* justify-between: nomor di kiri, ikon salin rata kanan (seragam). */}
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[11px] tabular-nums">{wb}</span>
                <CopyButton
                  text={wb}
                  title={`Salin ${wb}`}
                  successMessage="No. Waybill disalin"
                  className="size-4"
                  iconClassName="size-3"
                />
              </span>
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
        id: 'feedback',
        header: 'Feedback',
        // Lencana jumlah feedback DIHAPUS dari sini — cukup satu di ikon jam (Aksi).
        cell: (c) => {
          const r = c.row.original;
          return readOnly ? (
            r.Feedback ? (
              <span className="line-clamp-1">{r.Feedback}</span>
            ) : (
              <span className="text-muted-foreground italic">Belum ada</span>
            )
          ) : (
            <FeedbackCell
              row={r}
              options={options}
              saving={submit.isPending && submit.variables?.waybill === r['No. Waybill']}
              onCommit={handleCommit}
              registerRef={registerRef}
              onEnterNext={focusNext}
            />
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
          label="Filter alasan bermasalah"
          value={alasanFilter}
          onChange={setAlasanFilter}
          options={[
            { value: '', label: 'Semua Alasan' },
            ...alasanOptions.map((a) => ({ value: a, label: a })),
          ]}
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
        {/* Chip DP aktif dari drill-down Dashboard (?dp=) - bisa dihapus. */}
        {dpFilter && (
          <span className="bg-brand-muted text-brand inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
            DP: {dpFilter}
            <button
              type="button"
              onClick={() => setDpFilter('')}
              aria-label="Hapus filter DP"
              className="hover:text-brand-strong -mr-0.5 leading-none"
            >
              ✕
            </button>
          </span>
        )}
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
                          'px-2 py-0.5 align-middle',
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
        pageSizeOptions={[10, 20, 30, 40, 50, 100]}
      />

      {/* Popup riwayat feedback (gantikan kolom Log Feedback yg bikin baris tinggi) */}
      <Dialog open={!!historyRow} onOpenChange={(o) => !o && setHistoryRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tabular-nums">{historyRow?.['No. Waybill']}</DialogTitle>
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
