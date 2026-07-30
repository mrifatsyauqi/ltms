import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionCardProps = {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/** Panel konten standar (judul + aksi opsional + isi). Dipakai semua halaman. */
export function SectionCard({
  id,
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section id={id} className={cn('bg-card border-border rounded-lg border', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2.5 pb-1">
        <div className="min-w-0">
          <h2 className="text-[13px] leading-tight font-semibold">{title}</h2>
          {description && <p className="text-muted-foreground mt-0.5 text-[11px]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* @container: isi panel bisa menyesuaikan lebar PANEL-nya sendiri
          (mis. legend donut turun ke bawah saat panel sempit). */}
      <div className={cn('@container px-3 pt-1 pb-2.5', bodyClassName)}>{children}</div>
    </section>
  );
}
