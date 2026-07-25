'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* jatuh ke fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Tombol salin ke clipboard dengan feedback centang sesaat + toast. */
export function CopyButton({
  text,
  title,
  successMessage,
  className,
  iconClassName,
}: {
  text: string;
  title?: string;
  successMessage?: string;
  className?: string;
  iconClassName?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={title}
      aria-label={title ?? 'Salin'}
      onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!text) return;
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          toast.success(successMessage ?? 'Disalin');
          setTimeout(() => setCopied(false), 1200);
        } else {
          toast.error('Gagal menyalin');
        }
      }}
      className={cn(
        'text-muted-foreground hover:text-foreground hover:bg-muted inline-flex shrink-0 items-center justify-center rounded transition-colors',
        className,
      )}
    >
      {copied ? (
        <Check className={cn('size-3.5 text-green-600', iconClassName)} aria-hidden />
      ) : (
        <Copy className={cn('size-3.5', iconClassName)} aria-hidden />
      )}
    </button>
  );
}
