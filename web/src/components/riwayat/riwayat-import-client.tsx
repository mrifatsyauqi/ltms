'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TablePager } from '@/components/ui/table-pager';
import { cn } from '@/lib/utils';
import type { ImportBatchRow } from '@/lib/data/import';

async function fetchBatches(): Promise<ImportBatchRow[]> {
  const res = await fetch('/api/import/history');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

export function RiwayatImportClient() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['import-batches'],
    queryFn: fetchBatches,
  });

  const [q, setQ] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data ?? [];
    if (!needle) return all;
    return all.filter(
      (r) =>
        String(r['Nama File']).toLowerCase().includes(needle) ||
        String(r['Batch ID']).toLowerCase().includes(needle) ||
        String(r['Admin Cabang']).toLowerCase().includes(needle),
    );
  }, [data, q]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  return (
    <>
      <PageHeader
        title="Riwayat Import"
        description="Riwayat proses import Long Tail per batch/file."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        <div className="relative w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
          <Input
            placeholder="Cari nama file / batch / admin…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPageIndex(0);
            }}
            className="h-8 pl-7 text-xs"
          />
        </div>

        {isLoading && (
          <div className="space-y-1.5" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted h-9 animate-pulse rounded" />
            ))}
          </div>
        )}
        {error && (
          <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-xs">
            <p className="text-destructive font-medium">Gagal memuat riwayat import</p>
            <p className="text-muted-foreground mt-0.5">{(error as Error).message}</p>
          </div>
        )}

        {data && (
          <>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="h-8 border-b px-3 text-left font-medium">Tanggal</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Nama File</th>
                    <th className="h-8 border-b px-3 text-right font-medium">Total</th>
                    <th className="h-8 border-b px-3 text-right font-medium">Berhasil</th>
                    <th className="h-8 border-b px-3 text-right font-medium">Gagal</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Status</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Keterangan</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Admin</th>
                    <th className="h-8 border-b px-3 text-left font-medium">File Asli</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => (
                    <tr key={`${r['Batch ID']}-${i}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {r.Tanggal} <span className="text-muted-foreground">{r.Jam}</span>
                      </td>
                      <td className="px-3 py-1.5">{r['Nama File']}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r['Total Baris']}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.Berhasil}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {Number(r.Gagal) > 0 ? (
                          <span className="bg-aging-3 text-aging-3-fg rounded px-1.5 py-0.5 font-medium">{r.Gagal}</span>
                        ) : (
                          0
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            String(r.Status).toLowerCase().includes('sukses') || String(r.Status).toLowerCase().includes('berhasil')
                              ? 'bg-accent-green/15 text-accent-green'
                              : 'bg-aging-2 text-aging-2-fg',
                          )}
                        >
                          {r.Status || '—'}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-3 py-1.5">{r.Keterangan || '—'}</td>
                      <td className="text-muted-foreground px-3 py-1.5">{r['Admin Cabang']}</td>
                      <td className="px-3 py-1.5">
                        {r.Files.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.Files.map((f) => (
                              <Button
                                key={f.id}
                                variant="outline"
                                size="xs"
                                title={f.namaFile}
                                render={<a href={`/api/import/files/${f.id}/download`} download />}
                              >
                                <Download aria-hidden /> Unduh
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-muted-foreground py-10 text-center">
                        {q ? 'Tidak ada riwayat yang cocok.' : 'Belum ada riwayat import.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePager
              pageIndex={pageIndex}
              pageCount={pageCount}
              onGoto={(i) => setPageIndex(Math.max(0, Math.min(i, pageCount - 1)))}
              canPrev={pageIndex > 0}
              canNext={pageIndex < pageCount - 1}
              totalRows={rows.length}
              pageSize={pageSize}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPageIndex(0);
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
