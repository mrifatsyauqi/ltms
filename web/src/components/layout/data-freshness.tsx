'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LastUpdate } from '@/lib/data/meta';

async function fetchLastUpdate(): Promise<LastUpdate> {
  const res = await fetch('/api/last-update');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

/** Tanggal hari ini di Jakarta (UTC+7), format sama dgn LastUpdate.tanggal ('dd/MM/yy') - dipakai utk bandingkan "sudah import hari ini?". */
function todayJakartaTanggal(): string {
  const j = new Date(Date.now() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(j.getUTCDate())}/${p(j.getUTCMonth() + 1)}/${String(j.getUTCFullYear()).slice(-2)}`;
}

/**
 * Hook bersama (satu-satunya sumber kebenaran) utk "kapan Data Long Tail
 * terakhir di-import" - dipakai DataFreshness (teks di header) &
 * ImportStaleBanner (notifikasi banner), supaya logic "belum import hari
 * ini?" tidak diduplikasi di tiap pemakai. `isStale` true kalau SUDAH pernah
 * ada import tapi tanggalnya BUKAN hari ini (belum pernah import sama sekali
 * bukan "stale" - itu kondisi terpisah, `!data.hasUpdate`).
 */
export function useLastUpdate() {
  const query = useQuery({ queryKey: ['last-update'], queryFn: fetchLastUpdate });
  const { data } = query;
  const isStale = !!data && data.hasUpdate && data.tanggal !== todayJakartaTanggal();
  return { ...query, isStale };
}

/**
 * Baris info kecil di bawah header: kapan Data Long Tail terakhir DI-IMPORT
 * (bukan aktivitas feedback manual) - lihat getLastUpdate. Dipakai di
 * halaman berdata statistik (Dashboard, Feedback & Data Long Tail). Sama
 * untuk Admin Cabang & Admin DP (import bersifat global, tak di-scope per DP).
 * Highlight merah kalau tanggal import terakhir BUKAN hari ini (WIB).
 */
export function DataFreshness() {
  const { data, isLoading, isStale } = useLastUpdate();

  let text = 'Memuat info pembaruan…';
  if (!isLoading && data) {
    if (data.hasUpdate) {
      const jam = data.jam.slice(0, 5).replace(':', '.'); // HH:mm:ss -> HH.mm
      text = `Data Long Tail terakhir di-import: ${data.tanggal} pukul ${jam}`;
    } else {
      text = 'Belum ada data Long Tail yang di-import.';
    }
  }

  return (
    <p
      className={cn(
        'flex items-center gap-1.5 border-b px-4 py-1.5 text-[11px]',
        isStale ? 'border-destructive/20 bg-destructive/5 text-destructive' : 'text-muted-foreground border-border',
      )}
    >
      {isStale ? <TriangleAlert className="size-3 shrink-0" aria-hidden /> : <Clock className="size-3 shrink-0" aria-hidden />}
      <span className="truncate">{text}</span>
    </p>
  );
}
