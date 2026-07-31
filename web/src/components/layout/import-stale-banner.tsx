'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, TriangleAlert, X } from 'lucide-react';
import { useLastUpdate } from '@/components/layout/data-freshness';

/** Kunci sessionStorage dismiss banner, per TANGGAL Jakarta - otomatis "reset" tiap hari baru & tiap sesi/tab baru (sessionStorage bawaan browser). */
function dismissKey(): string {
  const j = new Date(Date.now() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `ltms:import-stale-dismissed:${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())}`;
}

/**
 * Banner (bukan modal - tidak memblokir kerja) di Dashboard & Feedback Long
 * Tail: muncul otomatis kalau import Data Long Tail terakhir BUKAN hari ini.
 * Reuse useLastUpdate() (data-freshness.tsx) - satu sumber kebenaran yang
 * sama dgn highlight merah di header, tak diduplikasi.
 *
 * "Sekali per sesi/hari, bukan tiap pindah halaman": status dismiss disimpan
 * di sessionStorage (bukan React state biasa) supaya bertahan lintas
 * mount/unmount saat navigasi Dashboard <-> Feedback Long Tail, tapi otomatis
 * hilang di hari/sesi berikutnya. Dibaca LANGSUNG di render (bukan lewat
 * useEffect+setState - dilarang eslint react-hooks/set-state-in-effect) -
 * aman krn baris ini cuma pernah relevan setelah `data` react-query datang
 * (async, jauh sesudah hydration selesai), jadi tak ada risiko mismatch SSR.
 * Hilang sendiri (tanpa perlu dismiss) begitu ada import baru masuk -
 * isStale re-evaluasi reaktif tiap kali cache `useLastUpdate` di-refetch.
 */
export function ImportStaleBanner({ isCabang }: { isCabang: boolean }) {
  const { data, isStale } = useLastUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!isStale || !data?.hasUpdate) return null;
  if (dismissed) return null;
  if (typeof window !== 'undefined' && sessionStorage.getItem(dismissKey()) === '1') return null;

  function handleDismiss() {
    sessionStorage.setItem(dismissKey(), '1');
    setDismissed(true);
  }

  const jam = data.jam.slice(0, 5).replace(':', '.'); // HH:mm:ss -> HH.mm

  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5"
    >
      <span className="bg-destructive/15 text-destructive flex size-8 shrink-0 items-center justify-center rounded-lg">
        <TriangleAlert className="size-4" aria-hidden />
      </span>
      <p className="text-destructive min-w-0 flex-1 text-xs font-medium">
        Data Long Tail belum diperbarui hari ini — import terakhir: {data.tanggal} pukul {jam}.
      </p>
      {isCabang && (
        <Link
          href="/import"
          className="bg-destructive/90 hover:bg-destructive inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          Import sekarang
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Tutup notifikasi"
        title="Tutup - tidak muncul lagi sampai sesi/hari berikutnya"
        className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
