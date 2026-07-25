'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import type { LastUpdate } from '@/lib/apps-script/meta';

async function fetchLastUpdate(): Promise<LastUpdate> {
  const res = await fetch('/api/last-update');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

/**
 * Baris info kecil di bawah header: kapan data ditampilkan terakhir berubah
 * (import/feedback). Dipakai di halaman berdata statistik (Dashboard, Feedback
 * & Data Long Tail). Berlaku untuk Admin Cabang & Admin DP (di-scope server).
 */
export function DataFreshness() {
  const { data, isLoading } = useQuery({ queryKey: ['last-update'], queryFn: fetchLastUpdate });

  let text = 'Memuat info pembaruan…';
  if (!isLoading && data) {
    if (data.hasUpdate) {
      const jam = data.jam.slice(0, 5).replace(':', '.'); // HH:mm:ss -> HH.mm
      text = `Data berdasarkan pembaruan terakhir: ${data.tanggal} pukul ${jam}`;
    } else {
      text = 'Belum ada pembaruan data.';
    }
  }

  return (
    <p className="text-muted-foreground border-border flex items-center gap-1.5 border-b px-4 py-1.5 text-[11px]">
      <Clock className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </p>
  );
}
