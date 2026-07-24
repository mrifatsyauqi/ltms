'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type TablePagerProps = {
  pageIndex: number; // 0-based
  pageCount: number;
  onGoto: (pageIndex: number) => void;
  canPrev: boolean;
  canNext: boolean;
  totalRows: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
};

/** Deret nomor halaman ringkas dgn elipsis: 1 … 4 5 [6] 7 8 … 47. */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('gap');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('gap');
  out.push(total);
  return out;
}

export function TablePager({
  pageIndex,
  pageCount,
  onGoto,
  canPrev,
  canNext,
  totalRows,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [20, 60, 80, 100],
}: TablePagerProps) {
  const current = pageIndex + 1;
  const pages = pageCount > 0 ? pageWindow(current, pageCount) : [1];
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(totalRows, (pageIndex + 1) * pageSize);

  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted-foreground text-xs tabular-nums">
        Menampilkan <span className="text-foreground font-medium">{from.toLocaleString('id-ID')}</span>–
        <span className="text-foreground font-medium">{to.toLocaleString('id-ID')}</span> dari{' '}
        <span className="text-foreground font-medium">{totalRows.toLocaleString('id-ID')}</span> data
      </p>

      <div className="flex items-center gap-2">
        {/* Jumlah per halaman (poin e): 20/60/80/100 */}
        <div className="flex items-center gap-1">
          {pageSizeOptions.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageSizeChange(n)}
              aria-pressed={pageSize === n}
              className={cn(
                btn,
                pageSize === n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-input hover:bg-muted',
              )}
            >
              {n}
            </button>
          ))}
          <span className="text-muted-foreground ml-0.5 text-xs">/ hal</span>
        </div>

        {/* Navigasi halaman */}
        <nav className="flex items-center gap-1" aria-label="Navigasi halaman">
          <button
            type="button"
            onClick={() => onGoto(pageIndex - 1)}
            disabled={!canPrev}
            aria-label="Sebelumnya"
            className={cn(btn, 'border-input hover:bg-muted')}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>

          {pages.map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="text-muted-foreground px-1 text-xs">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onGoto(p - 1)}
                aria-current={p === current ? 'page' : undefined}
                className={cn(
                  btn,
                  p === current
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-muted',
                )}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onGoto(pageIndex + 1)}
            disabled={!canNext}
            aria-label="Berikutnya"
            className={cn(btn, 'border-input hover:bg-muted')}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      </div>
    </div>
  );
}
