'use client';

/**
 * Gauge setengah lingkaran untuk "Progress Hari Ini".
 * Penyebut = Total Paket (keputusan user), pembilang = waybill unik yg dapat
 * feedback hari ini. Pakai SVG murni (tanpa lib) supaya ringan & mudah diaudit.
 */
export function ProgressGauge({
  value,
  total,
  caption,
  secondary,
}: {
  value: number;
  total: number;
  caption?: string;
  /** Baris tambahan di bawah, mis. progress feedback keseluruhan. */
  secondary?: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const r = 70;
  const circumference = Math.PI * r; // setengah lingkaran
  const dash = (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <svg viewBox="0 0 180 100" className="w-full max-w-[220px]" role="img" aria-label={`Progress ${pct.toFixed(1)} persen`}>
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="var(--muted)" strokeWidth={16} strokeLinecap="round" />
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke="var(--brand)"
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
        <text x="90" y="80" textAnchor="middle" className="fill-foreground" fontSize="26" fontWeight="700">
          {pct.toFixed(1).replace('.', ',')}%
        </text>
      </svg>
      <p className="text-muted-foreground mt-1 text-center text-xs">
        <span className="text-foreground font-medium tabular-nums">{value.toLocaleString('id-ID')}</span> dari{' '}
        <span className="tabular-nums">{total.toLocaleString('id-ID')}</span> {caption ?? 'paket sudah di-follow-up hari ini'}
      </p>
      {secondary && (
        <p className="text-muted-foreground border-border mt-2 w-full border-t pt-2 text-center text-[11px]">
          {secondary}
        </p>
      )}
    </div>
  );
}
