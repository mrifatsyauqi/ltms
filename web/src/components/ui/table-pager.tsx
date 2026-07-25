'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
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

  // Dropdown "jumlah/laman" yang membuka ke ATAS (pager ada di bawah halaman).
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sizeOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sizeOpen]);

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
        {/* Jumlah per laman: dropdown membuka ke atas */}
        <div ref={sizeRef} className="relative">
          <button
            type="button"
            onClick={() => setSizeOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={sizeOpen}
            className={cn(btn, 'border-input hover:bg-muted gap-1 tabular-nums')}
          >
            {pageSize}/laman
            <ChevronUp className={cn('size-3.5 transition-transform', sizeOpen && 'rotate-180')} aria-hidden />
          </button>
          {sizeOpen && (
            <ul
              role="listbox"
              className="border-border bg-card absolute right-0 bottom-full z-30 mb-1 min-w-[7.5rem] overflow-hidden rounded-lg border py-1 shadow-lg"
            >
              {pageSizeOptions.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={pageSize === n}
                    onClick={() => {
                      onPageSizeChange(n);
                      setSizeOpen(false);
                    }}
                    className={cn(
                      'hover:bg-muted block w-full px-3 py-1.5 text-left text-xs tabular-nums',
                      pageSize === n ? 'text-primary font-semibold' : 'text-foreground',
                    )}
                  >
                    {n}/laman
                  </button>
                </li>
              ))}
            </ul>
          )}
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
