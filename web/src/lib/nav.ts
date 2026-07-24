import {
  ClipboardList,
  Database,
  FileClock,
  History,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Table2,
  Upload,
  UserCog,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
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
        ],
      },
      {
        label: 'Master Data',
        items: [
          { label: 'Drop Point', href: '/master/drop-point', icon: Database },
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
        { label: 'Feedback Long Tail', href: '/feedback', icon: MessageSquareText },
        { label: 'Riwayat Feedback', href: '/riwayat-feedback', icon: History },
        { label: 'Profil Saya', href: '/profil', icon: UserRound },
      ],
    },
  ];
}
