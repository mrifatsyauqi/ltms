'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronLeft, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navForRole, type NavItem } from '@/lib/nav';
import { hasFullAccess } from '@/lib/roles';
import { signOutAction } from '@/app/actions/auth';
import { ScopeFilter } from '@/components/dashboard/scope-filter';
import { SupervisedScopeBox } from '@/components/dashboard/supervised-scope-box';

type SidebarProps = {
  role?: string;
  nama?: string;
  dropPoint?: string;
};

export function Sidebar({ role, nama, dropPoint }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  // Override manual per item (toggle chevron). Tanpa override, submenu ikut
  // status default (kebuka otomatis kalau lagi ada di salah satu halaman
  // anaknya) - dihitung langsung tiap render, bukan lewat effect+setState.
  const [manualExpand, setManualExpand] = useState<Map<string, boolean>>(new Map());
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

  function hasActiveChild(item: NavItem) {
    return item.children?.some((c) => isActive(c.href)) ?? false;
  }

  function isExpanded(item: NavItem) {
    return manualExpand.get(item.href) ?? hasActiveChild(item);
  }

  function toggleExpanded(item: NavItem) {
    setManualExpand((prev) => {
      const next = new Map(prev);
      next.set(item.href, !isExpanded(item));
      return next;
    });
  }

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground flex shrink-0 flex-col border-r border-sidebar-border transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[200px]',
      )}
    >
      {/* Logo. Collapsed: mark ikon saja (logo-icon-master.png). Expanded:
          ikon+wordmark+tagline sejajar horizontal (logo-horizontal.png) -
          sudah mengandung teks "LTMS"/tagline sendiri, tak perlu label
          teks terpisah lagi spt sebelumnya (Package + "LTMS"/"LongTail
          System"). Tinggi disamakan dgn tinggi konten lama (~40px) supaya
          tinggi total header sidebar tidak berubah. */}
      <div className="flex items-center px-4 py-3">
        {collapsed ? (
          <Image
            src="/branding/logo-icon-master.png"
            alt="LTMS - Longtail Monitoring System"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg"
          />
        ) : (
          <Image
            src="/branding/logo-horizontal.png"
            alt="LTMS - Longtail Monitoring System"
            width={121}
            height={40}
            className="h-10 w-auto"
          />
        )}
      </div>

      {/* Konteks DP aktif. Full access (Admin Cabang/Manager Kota/Asisten
          Manager Kota/Super Admin - Langkah 3): dropdown filter CAKUPAN ke
          SEMUA DP di sistem. SPV Drop Point: SupervisedScopeBox merender
          label+isi sendiri (statis kalau cuma 0/1 DP disupervisi - sama
          persis pola Admin DP, atau dropdown kalau >1 DP TAPI opsinya cuma
          DP yang disupervisi). Admin DP: label statis DP miliknya. */}
      {!collapsed && (
        <div className="border-sidebar-border bg-sidebar-accent/50 mx-3 mb-2 rounded-lg border px-2.5 py-1.5">
          {hasFullAccess(role) ? (
            <>
              <div className="text-[10px] tracking-wide uppercase opacity-60">Cakupan</div>
              <ScopeFilter />
            </>
          ) : role === 'SPV Drop Point' ? (
            <SupervisedScopeBox />
          ) : (
            <>
              <div className="text-[10px] tracking-wide uppercase opacity-60">DP Aktif</div>
              <div className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">
                {dropPoint || '-'}
              </div>
            </>
          )}
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
                const isOpen = isExpanded(item);

                return (
                  <li key={item.href}>
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                          'focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none',
                          active
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                            : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        )}
                      >
                        <Icon className="size-[17px] shrink-0" aria-hidden />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                      {item.children && !collapsed && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item)}
                          aria-expanded={isOpen}
                          aria-label={isOpen ? `Tutup submenu ${item.label}` : `Buka submenu ${item.label}`}
                          className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring shrink-0 rounded-lg p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <ChevronDown
                            className={cn('size-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')}
                            aria-hidden
                          />
                        </button>
                      )}
                    </div>

                    {item.children && !collapsed && isOpen && (
                      <ul className="border-sidebar-border mt-0.5 ml-4 space-y-0.5 border-l pl-2">
                        {item.children.map((child) => {
                          const childActive = isActive(child.href);
                          const ChildIcon = child.icon;

                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                aria-current={childActive ? 'page' : undefined}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                                  'focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none',
                                  childActive
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                                    : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                )}
                              >
                                <ChildIcon className="size-[17px] shrink-0" aria-hidden />
                                <span className="truncate">{child.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
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
          {!collapsed && <span>Sembunyikan</span>}
        </button>
      </div>
    </aside>
  );
}
