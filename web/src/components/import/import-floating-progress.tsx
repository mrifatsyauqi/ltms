'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FloatingProgressProps = {
  title: string;
  subtitle: string;
  /** 0-100 bila progres nyata diketahui (mis. N dari M file terbaca). undefined = indeterminate (spinner berputar, tanpa angka palsu). */
  percent?: number;
  onCancel?: () => void;
};

/**
 * Widget progres mengambang kanan-bawah. SENGAJA tidak menampilkan persentase
 * palsu: fase baca file pakai progres nyata (N/M file selesai dibaca, karena
 * diproses berurutan); fase submit import (satu panggilan gabungan ke server)
 * pakai cincin berputar indeterminate karena tidak ada sinyal progres nyata
 * dari server untuk satu request.
 */
export function ImportFloatingProgress({ title, subtitle, percent, onCancel }: FloatingProgressProps) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = percent != null ? (percent / 100) * c : c * 0.28; // busur pendek saat indeterminate

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-border bg-card fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-xl border p-3 shadow-lg sm:right-6 sm:bottom-6"
    >
      <svg viewBox="0 0 56 56" className={cn('size-12 shrink-0', percent == null && 'animate-spin')}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--muted)" strokeWidth={5} />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 28 28)"
        />
        {percent != null && (
          <text x="28" y="32" textAnchor="middle" className="fill-foreground" fontSize="13" fontWeight="700">
            {Math.round(percent)}%
          </text>
        )}
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
        {onCancel && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onCancel}
            className="text-destructive h-auto p-0 text-xs"
          >
            Batalkan
          </Button>
        )}
      </div>
    </div>
  );
}
