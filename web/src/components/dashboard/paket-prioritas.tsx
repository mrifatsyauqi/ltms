'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { SectionCard } from '@/components/layout/section-card';
import { AgingBadge } from '@/components/ui/aging-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LongTailRow } from '@/lib/data/longtail';

const MAX_ROWS = 6;

async function fetchLongTail(): Promise<LongTailRow[]> {
  const res = await fetch('/api/longtail');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

function umurOf(r: LongTailRow): number | null {
  const v = r['Umur Paket'];
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Preview paket paling mendesak untuk Admin DP: umur tertua & belum Clear TTD.
 * Read-only (tanpa filter/pagination/input) supaya tidak menduplikasi halaman
 * Feedback Long Tail - pengisian feedback tetap di sana.
 */
export function PaketPrioritas() {
  const { data, isLoading, error } = useQuery({ queryKey: ['longtail'], queryFn: fetchLongTail });

  const rows = (data ?? [])
    .filter((r) => !r.__isClearTTD)
    .sort((a, b) => (umurOf(b) ?? -1) - (umurOf(a) ?? -1))
    .slice(0, MAX_ROWS);

  return (
    <SectionCard
      title="Paket Prioritas"
      description="Umur tertua & belum Clear TTD."
      actions={
        <Link
          href="/feedback"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] font-medium"
        >
          Lihat semua
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      }
      bodyClassName="px-0 pb-0"
    >
      {isLoading && (
        <div className="space-y-1 px-3 pb-3" aria-busy="true" aria-label="Memuat paket prioritas">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-7 animate-pulse rounded" />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive px-3 pb-3 text-xs">
          Gagal memuat: {(error as Error).message}
        </p>
      )}

      {data && (
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="h-8 px-3">No. Waybill</TableHead>
                <TableHead className="h-8 px-2">Umur</TableHead>
                <TableHead className="h-8 px-2">Status Terakhir</TableHead>
                <TableHead className="h-8 px-2">Sprinter</TableHead>
                <TableHead className="h-8 px-2">Feedback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                    Semua paket sudah Clear TTD. Tidak ada yang perlu ditindaklanjuti.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r['No. Waybill']}>
                    <TableCell className="px-3 py-1.5 font-mono text-[11px]">{r['No. Waybill']}</TableCell>
                    <TableCell className="px-2 py-1.5">
                      <AgingBadge umur={umurOf(r)} />
                    </TableCell>
                    <TableCell className="px-2 py-1.5">{r['Status Terakhir'] || '—'}</TableCell>
                    <TableCell className="text-muted-foreground px-2 py-1.5">
                      {r['Sprinter Delivery'] || '—'}
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
                      {r.Feedback ? (
                        <span className="truncate">{r.Feedback}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Belum ada</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
