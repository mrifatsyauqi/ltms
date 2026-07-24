import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Notifikasi Aging (PRD Bagian 9.3): alert menonjol saat ada paket >= 3 hari
 * yang belum Clear TTD. Sengaja bukan ikon lonceng (dihapus atas permintaan
 * user) — alert kontekstual di Dashboard, dgn tautan langsung ke daftar paket
 * mendesak (Feedback difilter umur >= 3).
 */
export function AgingAlert({ count, isCabang }: { count: number; isCabang: boolean }) {
  if (count <= 0) return null;

  return (
    <div
      role="alert"
      className="border-brand/30 bg-brand-muted flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5"
    >
      <span className="bg-brand text-brand-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <AlertTriangle className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          <span className="text-brand tabular-nums">{count.toLocaleString('id-ID')}</span> paket sudah ≥ 3 hari belum
          Clear TTD
        </p>
        <p className="text-muted-foreground text-xs">
          {isCabang ? 'Tersebar di beberapa Drop Point. ' : 'Di Drop Point Anda. '}
          Perlu segera ditindaklanjuti.
        </p>
      </div>
      <Link
        href="/feedback?umur=3"
        className="bg-brand text-brand-foreground hover:bg-brand-strong inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
      >
        Lihat paket
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
