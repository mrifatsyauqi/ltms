import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatAccent = 'blue' | 'amber' | 'green' | 'violet' | 'red' | 'rose';

const ACCENT: Record<StatAccent, string> = {
  blue: 'bg-accent-blue/12 text-accent-blue',
  amber: 'bg-accent-amber/15 text-accent-amber',
  green: 'bg-accent-green/12 text-accent-green',
  violet: 'bg-accent-violet/12 text-accent-violet',
  red: 'bg-accent-red/12 text-accent-red',
  rose: 'bg-accent-rose/12 text-accent-rose',
};

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: StatAccent;
  /** Warnai angka utama (mis. Paket Tertua yang kritis). */
  valueClassName?: string;
};

/** Card statistik ringkas: ikon berwarna di kiri, label kecil, angka besar, sub-teks. */
export function StatCard({ label, value, hint, icon: Icon, accent = 'blue', valueClassName }: StatCardProps) {
  return (
    <div className="bg-card border-border rounded-lg border p-2.5">
      <div className="flex items-center gap-2.5">
        <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', ACCENT[accent])}>
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="text-muted-foreground truncate text-[11px] leading-tight font-medium">{label}</div>
          <div className={cn('text-lg leading-tight font-bold tabular-nums', valueClassName)}>{value}</div>
          {hint && <div className="text-muted-foreground truncate text-[10px] leading-tight">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
