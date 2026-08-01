import {
  Building2,
  ClipboardList,
  Database,
  FileClock,
  History,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Table2,
  Truck,
  Upload,
  UserCog,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { hasFullAccess } from '@/lib/roles';
import type { MenuKey } from '@/lib/data/supabase/permissions';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
  /** Menu_key Role & Akses (lib/data/supabase/permissions.ts) yang menentukan
   *  TAMPIL/TIDAKnya item ini utk SPV Drop Point/Admin DP (lihat
   *  filterNavByAccess) - undefined = SELALU tampil (mis. Monitoring
   *  Delivery/Profil Saya, atau item apa pun di menu full access yg tak
   *  pernah masuk matrix ini). */
  menuKey?: MenuKey;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

/**
 * Menu per role (Langkah 3 - Perluasan Role):
 * - Full access (Super Admin/Admin Cabang/Manager Kota/Asisten Manager Kota):
 *   menu utama + grup Master Data, Laporan, Pengaturan - SAMA PERSIS, tidak
 *   dibedakan berdasar jabatan (lihat lib/roles.ts).
 * - Admin DP & SPV Drop Point: flat, hanya 4 menu. TIDAK punya akses Master
 *   Data / Import / Laporan Import - SPV Drop Point dapat menu SAMA PERSIS
 *   dgn Admin DP (cakupan >1 DP ditegakkan server-side, bukan lewat menu).
 * "Data Long Tail" & "Feedback Long Tail" memakai halaman yang sama (/feedback)
 * dengan view berbeda lewat query param.
 * "Drop Point" nested sbg children di bawah "Cabang" (struktur organisasi
 * Kota -> Drop Point) - lihat rendering submenu expand/collapse di Sidebar.
 */
export function navForRole(role: string | undefined): NavGroup[] {
  if (hasFullAccess(role)) {
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
          { label: 'Role & Akses', href: '/master/role-akses', icon: ShieldCheck },
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

  // Admin DP & SPV Drop Point - menuKey diisi utk 3 item yang diatur lewat
  // Role & Akses (Monitoring Delivery & Profil Saya SENGAJA tanpa menuKey ->
  // selalu tampil, lihat filterNavByAccess).
  return [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, menuKey: 'dashboard' },
        { label: 'Monitoring Delivery', href: '/monitoring-delivery', icon: Truck },
        { label: 'Feedback Long Tail', href: '/feedback', icon: MessageSquareText, menuKey: 'feedback_longtail_view' },
        { label: 'Riwayat Feedback', href: '/riwayat-feedback', icon: History, menuKey: 'riwayat_feedback' },
        { label: 'Profil Saya', href: '/profil', icon: UserRound },
      ],
    },
  ];
}

/**
 * Sembunyikan TOTAL item nav yang menu_key-nya enabled=false utk actor ini -
 * bukan cuma memblokir isinya setelah diklik (lihat lib/data/supabase/
 * permissions.ts, requirePermission() di endpoint). `access` null = actor
 * full access (Super Admin/Admin Cabang/Manager Kota/Asisten Manager Kota)
 * - TIDAK PERNAH difilter, kembalikan `groups` apa adanya (mereka given dari
 * Langkah 3, di luar cakupan matrix Role & Akses). Item tanpa `menuKey`
 * (Monitoring Delivery/Profil Saya) selalu tampil apa pun isi `access`.
 * Grup yang kehabisan seluruh item-nya ikut dibuang (tak ada saat ini krn
 * grup Admin DP/SPV Drop Point cuma 1, tapi dijaga generik).
 */
export function filterNavByAccess(groups: NavGroup[], access: Record<MenuKey, boolean> | null): NavGroup[] {
  if (!access) return groups;
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.menuKey || access[item.menuKey]) }))
    .filter((group) => group.items.length > 0);
}
