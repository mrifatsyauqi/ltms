import { cn } from '@/lib/utils';

/**
 * Warna aging sesuai PRD Bagian 9.1: 1 hari hijau, 2 hari kuning, >=3 hari merah.
 * Umur 0 (baru sampai hari ini) & paket Clear TTD (umur dibekukan) tampil netral.
 * Satu-satunya tempat aturan warna ini didefinisikan - jangan duplikasi di halaman.
 */
export function agingLevel(umur: number | null | undefined, frozen = false): 0 | 1 | 2 | 3 {
  if (frozen || umur == null || !isFinite(umur) || umur < 1) return 0;
  if (umur === 1) return 1;
  if (umur === 2) return 2;
  return 3;
}

const LEVEL_CLASS: Record<0 | 1 | 2 | 3, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-aging-1 text-aging-1-fg',
  2: 'bg-aging-2 text-aging-2-fg',
  3: 'bg-aging-3 text-aging-3-fg',
};

/** Warna latar baris tabel mengikuti urgensi aging (tipis, tidak mengganggu teks). */
export const AGING_ROW_CLASS: Record<0 | 1 | 2 | 3, string> = {
  0: '',
  1: 'bg-aging-1/25',
  2: 'bg-aging-2/25',
  3: 'bg-aging-3/25',
};

type AgingBadgeProps = {
  umur: number | null | undefined;
  /** true jika Clear TTD - umur dibekukan, tidak lagi dihitung sbg urgensi. */
  frozen?: boolean;
  className?: string;
};

export function AgingBadge({ umur, frozen = false, className }: AgingBadgeProps) {
  const level = agingLevel(umur, frozen);
  const showDash = umur == null || !isFinite(umur);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums',
        LEVEL_CLASS[level],
        className,
      )}
      title={frozen ? 'Umur dibekukan sejak Clear TTD' : undefined}
    >
      {showDash ? '—' : `${umur} Hari`}
      {frozen && !showDash ? ' (beku)' : ''}
    </span>
  );
}
