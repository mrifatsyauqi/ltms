'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * Toggle Mode Gelap/Terang. Default 'system' (next-themes, ikut preferensi
 * OS) sampai user pertama kali menekan toggle ini, lalu jadi eksplisit
 * 'light'/'dark' (tersimpan localStorage, next-themes bawaan).
 *
 * `mounted` WAJIB: next-themes baru tahu resolvedTheme SESUNGGUHNYA setelah
 * render client pertama (SSR tak tahu preferensi OS) - tanpa ini ikon
 * sun/moon bisa salah sekilas lalu "lompat" (hydration flash).
 */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        title={mounted ? (isDark ? 'Mode Terang' : 'Mode Gelap') : undefined}
        aria-label="Ganti mode tampilan"
        className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex w-full items-center justify-center rounded-lg py-1.5 text-sidebar-foreground opacity-80 transition-colors hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
      >
        {isDark ? <Moon className="size-4 shrink-0" aria-hidden /> : <Sun className="size-4 shrink-0" aria-hidden />}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-sidebar-foreground opacity-80">
      <span className="flex items-center gap-2">
        <span className="relative size-4 shrink-0">
          <Sun
            className={cn(
              'absolute inset-0 size-4 transition-all duration-200',
              isDark ? 'scale-50 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
            )}
            aria-hidden
          />
          <Moon
            className={cn(
              'absolute inset-0 size-4 transition-all duration-200',
              isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-50 -rotate-90 opacity-0',
            )}
            aria-hidden
          />
        </span>
        Mode Gelap
      </span>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        aria-label="Ganti mode tampilan"
      />
    </div>
  );
}
