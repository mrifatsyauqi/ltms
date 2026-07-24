'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, LogOut, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navForRole } from '@/lib/nav';
import { signOutAction } from '@/app/actions/auth';

type SidebarProps = {
  role?: string;
  nama?: string;
  dropPoint?: string;
};

export function Sidebar({ role, nama, dropPoint }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groups = navForRole(role);
  const currentView = searchParams.get('view');

  function isActive(href: string) {
    const [path, query] = href.split('?');
    if (pathname !== path) return false;
    // Bedakan "Feedback Long Tail" (/feedback) vs "Data Long Tail" (/feedback?view=data)
    const wantView = query ? new URLSearchParams(query).get('view') : null;
    return (wantView ?? null) === (currentView ?? null);
  }

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground flex shrink-0 flex-col border-r border-sidebar-border transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Package className="size-5" aria-hidden />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-base leading-tight font-semibold text-sidebar-accent-foreground">LTMS</div>
            <div className="truncate text-[11px] leading-tight opacity-70">LongTail System</div>
          </div>
        )}
      </div>

      {/* Konteks DP aktif (Admin DP terikat 1 DP; Admin Cabang lihat semua) */}
      {!collapsed && (
        <div className="border-sidebar-border bg-sidebar-accent/50 mx-3 mb-2 rounded-lg border px-2.5 py-1.5">
          <div className="text-[10px] tracking-wide uppercase opacity-60">
            {role === 'Admin Cabang' ? 'Cakupan' : 'DP Aktif'}
          </div>
          <div className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">
            {role === 'Admin Cabang' ? 'Semua DP' : (dropPoint || '-')}
          </div>
        </div>
      )}

      {/* Navigasi */}
      <nav className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-3 pb-3" aria-label="Navigasi utama">
        {groups.map((group, gi) => (
          <div key={group.label ?? `g-${gi}`}>
            {group.label && !collapsed && (
              <div className="px-2 pb-1 text-[10px] font-medium tracking-wider uppercase opacity-50">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                        'focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none',
                        active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Icon className="size-[17px] shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User + collapse */}
      <div className="border-sidebar-border border-t p-3">
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-2.5">
            <div className="bg-sidebar-accent flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-sidebar-accent-foreground">
              {(nama ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-sidebar-accent-foreground">{nama ?? '-'}</div>
              <div className="truncate text-[11px] opacity-60">{role ?? '-'}</div>
            </div>
          </div>
        ) : (
          <div className="bg-sidebar-accent mx-auto mb-2 flex size-9 items-center justify-center rounded-full text-xs font-semibold text-sidebar-accent-foreground">
            {(nama ?? '?').slice(0, 2).toUpperCase()}
          </div>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            title={collapsed ? 'Keluar' : undefined}
            className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] opacity-80 transition-colors hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {!collapsed && <span>Keluar</span>}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] opacity-70 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className={cn('size-4 shrink-0 transition-transform', collapsed && 'rotate-180')} aria-hidden />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
