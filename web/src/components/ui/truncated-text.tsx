'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Teks tabel yang dipotong ke `max` karakter (default 20) + "…". Teks lengkap
 * muncul sebagai tooltip melayang saat hover (desktop) atau klik/tap (sentuh).
 * Tooltip dirender via portal ke body supaya tidak terpotong container scroll.
 */
export function TruncatedText({
  text,
  max = 20,
  className,
}: {
  text: string | null | undefined;
  max?: number;
  className?: string;
}) {
  const s = (text ?? '').toString();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  if (s.length <= max) {
    return <span className={cn('whitespace-nowrap', className)}>{s || '—'}</span>;
  }

  const showAt = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPos({ left: r.left, top: r.top });
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          'decoration-muted-foreground/40 cursor-help text-left whitespace-nowrap underline decoration-dotted underline-offset-2',
          className,
        )}
        onMouseEnter={(e) => showAt(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onClick={(e) => (pos ? setPos(null) : showAt(e.currentTarget))}
      >
        {s.slice(0, max).trimEnd()}…
      </button>
      {pos &&
        createPortal(
          <span
            style={{ position: 'fixed', left: pos.left, top: pos.top - 6, transform: 'translateY(-100%)' }}
            className="border-border bg-card text-foreground pointer-events-none z-[100] max-w-xs rounded-md border px-2 py-1 text-xs whitespace-normal shadow-lg"
          >
            {s}
          </span>,
          document.body,
        )}
    </>
  );
}
