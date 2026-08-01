import {
  Building2,
  ClipboardList,
  Database,
  FileClock,
  History,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Table2,
  Truck,
  Upload,
  UserCog,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

/**
 * Menu per role sesuai PRD Bagian 5 + konfirmasi user:
 * - Admin DP  : flat, hanya 4 menu. TIDAK punya akses Master Data / Import / Laporan Import.
 * - Admin Cabang: menu utama + grup Master Data, Laporan, Pengaturan.
 * "Data Long Tail" & "Feedback Long Tail" memakai halaman yang sama (/feedback)
 * dengan view berbeda lewat query param.
 * "Drop Point" nested sbg children di bawah "Cabang" (struktur organisasi
 * Kota -> Drop Point) - lihat rendering submenu expand/collapse di Sidebar.
 */
export function navForRole(role: string | undefined): NavGroup[] {
  if (role === 'Admin Cabang') {
    return [
      {
        items: [
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { label: 'Feedback Long Tail', href: '/feedback', icon: MessageSquareText },
          { label: 'Data Long Tail', href: '/feedback?view=data', icon: Table2 },
          { label: 'Import Long Tail', href: '/import', icon: Upload },
          { label: 'Monitoring Delivery', href: '/monitoring-delivery', icon: Truck },
        ],
      },
      {
        label: 'Master Data',
        items: [
          {
            label: 'Cabang',
            href: '/master/cabang',
            icon: Building2,
            children: [{ label: 'Drop Point', href: '/master/drop-point', icon: Database }],
          },
          { label: 'Master Feedback', href: '/master/feedback', icon: ClipboardList },
          { label: 'User Management', href: '/master/users', icon: UserCog },
        ],
      },
      {
        label: 'Laporan',
        items: [
          { label: 'Riwayat Import', href: '/riwayat-import', icon: FileClock },
          { label: 'Riwayat Feedback', href: '/riwayat-feedback', icon: History },
        ],
      },
      {
        label: 'Pengaturan',
        items: [
          { label: 'Pengaturan', href: '/pengaturan', icon: Settings },
          { label: 'Profile', href: '/profil', icon: UserRound },
        ],
      },
    ];
  }

  // Admin DP
  return [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Monitoring Delivery', href: '/monitoring-delivery', icon: Truck },
        { label: 'Feedback Long Tail', href: '/feedback', icon: MessageSquareText },
        { label: 'Riwayat Feedback', href: '/riwayat-feedback', icon: History },
        { label: 'Profil Saya', href: '/profil', icon: UserRound },
      ],
    },
  ];
}
