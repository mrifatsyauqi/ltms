import { cn } from '@/lib/utils';

/** Badge status Aktif/Nonaktif — dipakai di semua halaman Master Data. */
export function StatusBadge({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        aktif ? 'bg-accent-green/15 text-accent-green' : 'bg-muted text-muted-foreground',
      )}
    >
      <span className={cn('size-1.5 rounded-full', aktif ? 'bg-accent-green' : 'bg-muted-foreground')} aria-hidden />
      {aktif ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

export function isAktif(status: string | undefined): boolean {
  return String(status ?? '').trim().toLowerCase() === 'aktif';
}
