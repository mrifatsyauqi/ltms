'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Tab navigasi HANYA di antara 2 halaman publik ini - TIDAK ADA link ke
 * halaman lain manapun (Import, Master Data, Pengaturan, Feedback Long Tail
 * versi internal, dll). Aktif ditentukan dari pathname, bukan prop, supaya
 * page.tsx anak tak perlu tahu-menahu soal tab.
 */
export function PublicShareTabs({ token }: { token: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/public/${token}/dashboard`, label: 'Dashboard' },
    { href: `/public/${token}/data-longtail`, label: 'Data Long Tail' },
  ];

  return (
    <nav className="border-border bg-card flex items-center gap-1 border-b px-3 py-2">
      <span className="text-muted-foreground mr-2 text-xs font-medium">Laporan LTMS</span>
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
